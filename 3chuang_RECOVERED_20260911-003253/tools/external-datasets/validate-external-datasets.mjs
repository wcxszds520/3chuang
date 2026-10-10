import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RAW = path.join(ROOT, 'data/external/raw');
const NORMALIZED = path.join(ROOT, 'data/external/normalized');
const checks = [];
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const digest = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');
const record = (source, instance, item, fields, pass) => checks.push({ source, instance, item, fields, pass });
const sampleIndices = (length, count, seed) => {
  let state = seed >>> 0;
  const selected = new Set();
  while (selected.size < Math.min(length, count)) {
    state = (1664525 * state + 1013904223) >>> 0;
    selected.add(state % length);
  }
  return [...selected].sort((a, b) => a - b);
};

for (const source of await readdir(RAW)) {
  const manifestFile = path.join(RAW, source, 'source-manifest.json');
  try {
    const manifest = await readJson(manifestFile);
    for (const file of manifest.rawFiles) {
      const actual = await digest(path.join(RAW, source, file.path));
      if (actual !== file.sha256) throw new Error(`${source}/${file.path}: SHA256 mismatch`);
    }
    record(source, 'provenance', 'all raw files', { fileCount: manifest.rawFiles.length, sha256: 'MATCH' }, true);
  } catch (error) { record(source, 'provenance', 'manifest', { error: error.message }, false); }
}

const renault = await readJson(path.join(NORMALIZED, 'renault_esicup_2015/instances.json'));
const rInstance = renault.instances.find((item) => item.id === 'instancesA-ARG_BUR_STK_container');
const rRaw = (await readFile(path.join(RAW, 'renault_esicup_2015/instancesA/ARG_BUR_STK_container/input_items.csv'), 'utf8')).trim().split(/\r?\n/).slice(1).map((line) => line.split(';'));
for (const index of sampleIndices(rInstance.items.length, 5, 2015)) {
  const item = rInstance.items[index];
  const rows = rRaw.filter((row) => row[7] === item.externalItemId);
  const first = rows[0];
  const pass = Boolean(first) && Number(first[1]) === item.lengthMm && Number(first[2]) === item.widthMm && Number(first[3]) === item.heightMm && Number(first[4]) === item.weightKg && rows.length === item.quantity;
  record('renault_esicup_2015', rInstance.id, item.externalItemId, { raw: first ? { length: Number(first[1]), width: Number(first[2]), height: Number(first[3]), weight: Number(first[4]), quantity: rows.length } : null, normalized: { length: item.lengthMm, width: item.widthMm, height: item.heightMm, weight: item.weightKg, quantity: item.quantity } }, pass);
}

const ortec = await readJson(path.join(NORMALIZED, 'ortec_alonso_2019/instances.json'));
const oInstance = ortec.instances.find((item) => item.id === 'ortec-inst3d1');
const oRaw = (await readFile(path.join(RAW, 'ortec_alonso_2019/inst3d1.csv'), 'utf8')).trim().split(/\r?\n/).slice(1).map((line) => line.trim().split(/\s+/).map(Number));
for (const index of sampleIndices(oInstance.items.length, 5, 2019)) {
  const item = oInstance.items[index];
  const row = oRaw[index]; const pass = item.lengthMm === row[4] && item.widthMm === row[3] && item.heightMm === row[5] && item.weightKg === row[6] && item.quantity === row[2] && item.sourceFields.rotationX === row[7];
  record('ortec_alonso_2019', oInstance.id, item.externalItemId, { raw: row, normalized: { length: item.lengthMm, width: item.widthMm, height: item.heightMm, weight: item.weightKg, quantity: item.quantity, orientation: item.orientationConstraints, maxStackLayers: item.maxStackLayers } }, pass);
}

const thpack = await readJson(path.join(NORMALIZED, 'orlib_thpack/instances.json'));
const tInstance = thpack.instances.find((item) => item.id === 'thpack1-1');
const tTokens = (await readFile(path.join(RAW, 'orlib_thpack/thpack1.txt'), 'utf8')).trim().split(/\s+/).map(Number);
for (let index = 0; index < 3; index += 1) {
  const row = tTokens.slice(7 + index * 8, 15 + index * 8); const item = tInstance.items[index];
  const pass = item.lengthMm === row[1] * 10 && item.widthMm === row[3] * 10 && item.heightMm === row[5] * 10 && item.quantity === row[7] && item.weightKg === null;
  record('orlib_thpack', tInstance.id, item.externalItemId, { raw: row, normalized: { lengthMm: item.lengthMm, widthMm: item.widthMm, heightMm: item.heightMm, weightKg: item.weightKg, quantity: item.quantity, orientation: item.orientationConstraints } }, pass);
}

const wtpack = await readJson(path.join(NORMALIZED, 'orlib_wtpack/instances.json'));
const wInstance = wtpack.instances.find((item) => item.id === 'wtpack1-1');
const wTokens = (await readFile(path.join(RAW, 'orlib_wtpack/wtpack1.txt'), 'utf8')).trim().split(/\s+/).map(Number);
for (let index = 0; index < 3; index += 1) {
  const row = wTokens.slice(5 + index * 11, 16 + index * 11); const item = wInstance.items[index];
  const pass = item.lengthMm === row[0] * 10 && item.widthMm === row[2] * 10 && item.heightMm === row[4] * 10 && item.quantity === row[6] && item.weightKg === row[7] && item.loadBearingUnit === 'kg/cm²' && item.unknownFields.includes('normalizedLoadBearingKg');
  record('orlib_wtpack', wInstance.id, item.externalItemId, { raw: row, normalized: { lengthMm: item.lengthMm, widthMm: item.widthMm, heightMm: item.heightMm, weightKg: item.weightKg, quantity: item.quantity, loadBearing: item.loadBearing, loadBearingUnit: item.loadBearingUnit, normalizedLoadBearingKg: null } }, pass);
}

const irregular = await readJson(path.join(NORMALIZED, 'esicup_irregular/instances.json'));
for (const instance of irregular.instances) {
  const sample = instance.items[0]; const file = path.join(RAW, 'esicup_irregular', sample.geometryAsset); const bytes = (await stat(file)).size;
  record('esicup_irregular', instance.id, sample.externalItemId, { geometryAsset: sample.geometryAsset, bytes, weightKg: sample.weightKg, stackability: sample.stackability }, bytes > 0 && sample.weightKg === null && sample.stackability === 'UNKNOWN');
}

const report = { generatedAt: new Date().toISOString(), result: checks.every((check) => check.pass) ? 'PASS' : 'FAIL', checkCount: checks.length, failed: checks.filter((check) => !check.pass), checks };
await writeFile(path.join(ROOT, 'data/external/validation-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ result: report.result, checkCount: report.checkCount, failed: report.failed }, null, 2));
if (report.result !== 'PASS') process.exitCode = 1;
