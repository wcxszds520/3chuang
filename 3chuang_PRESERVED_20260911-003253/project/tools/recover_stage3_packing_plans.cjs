const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const db = require('../backend/config/database');

const applyRecovery = process.argv.includes('--apply');
const mysqlbinlog = 'C:\\Program Files\\MySQL\\MySQL Server 9.4\\bin\\mysqlbinlog.exe';
const binlog = 'D:\\ MySQL\\Data\\LAPTOP-CIHAKPPT-bin.000114';
const startPosition = 114251330;
const stopPosition = 118810050;
const tableMarker = '### DELETE FROM `ningbo_port_packing`.`packing_plan`';
const outputPath = path.resolve('output/playwright/stage3/database-recovery.json');

function decodeMysqlString(value) {
  let decoded = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== '\\' || index === value.length - 1) {
      decoded += character;
      continue;
    }
    index += 1;
    const escaped = value[index];
    const escapes = {
      0: '\0',
      b: '\b',
      n: '\n',
      r: '\r',
      t: '\t',
      Z: '\x1a'
    };
    decoded += Object.prototype.hasOwnProperty.call(escapes, escaped) ? escapes[escaped] : escaped;
  }
  return decoded;
}

function parseVerboseValue(source) {
  const commentIndex = source.lastIndexOf(' /*');
  const literal = (commentIndex >= 0 ? source.slice(0, commentIndex) : source).trim();
  if (literal === 'NULL') return null;
  if (literal.startsWith("'")) {
    assert.equal(literal.endsWith("'"), true, 'unterminated mysqlbinlog string literal');
    return decodeMysqlString(literal.slice(1, -1));
  }
  const numeric = Number(literal);
  assert.equal(Number.isFinite(numeric), true, `unsupported mysqlbinlog literal: ${literal}`);
  return numeric;
}

function parseDeletedRows(verboseOutput) {
  const rows = [];
  let current = null;
  for (const line of verboseOutput.split(/\r?\n/)) {
    if (line === tableMarker) {
      if (current) rows.push(current);
      current = {};
      continue;
    }
    if (!current) continue;
    const field = line.match(/^###\s+@(\d+)=(.*)$/);
    if (field) current[Number(field[1])] = parseVerboseValue(field[2]);
  }
  if (current) rows.push(current);
  return rows;
}

async function main() {
  const verboseOutput = execFileSync(mysqlbinlog, [
    '--base64-output=DECODE-ROWS',
    '-vv',
    `--start-position=${startPosition}`,
    `--stop-position=${stopPosition}`,
    binlog
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  const rows = parseDeletedRows(verboseOutput);
  assert.equal(rows.length, 20, 'expected the exact first destructive-test transaction');
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).map(Number).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(typeof JSON.parse(row[7]), 'object');
  }

  const ids = rows.map(row => row[1]);
  const placeholders = ids.map(() => '?').join(', ');
  const [existingRows] = await db.query(
    `SELECT plan_id FROM packing_plan WHERE plan_id IN (${placeholders})`,
    ids
  );
  const existing = new Set(existingRows.map(row => row.plan_id));
  const missing = rows.filter(row => !existing.has(row[1]));

  if (applyRecovery && missing.length > 0) {
    await db.query('START TRANSACTION');
    try {
      for (const row of missing) {
        await db.query(
          'INSERT INTO packing_plan (plan_id, user_id, container_type, space_utilization, total_weight, total_cargo_count, plan_data, compliance_status, risk_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], new Date(row[10] * 1000)]
        );
      }
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  const [readback] = await db.query(
    `SELECT plan_id, total_cargo_count, created_at FROM packing_plan WHERE plan_id IN (${placeholders}) ORDER BY created_at`,
    ids
  );
  const report = {
    source: {
      binlog,
      startPosition,
      stopPosition,
      transactionTimestamp: '2026-07-12T04:00:16+08:00'
    },
    parsedRows: rows.length,
    preexistingRows: existing.size,
    missingRows: missing.length,
    applyRequested: applyRecovery,
    restoredRows: applyRecovery ? missing.length : 0,
    readbackRows: readback.length,
    restoredPlanIds: readback.map(row => row.plan_id),
    verdict: readback.length === rows.length ? 'RECOVERED' : 'DRY_RUN'
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .finally(() => db.end())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
