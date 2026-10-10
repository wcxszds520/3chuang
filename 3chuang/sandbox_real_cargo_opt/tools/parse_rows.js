'use strict';
/** 解析 mysqldump 单行 INSERT（扩展插入多行 + MySQL 转义），汇总 load_task/packing_case 内容 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'real_forwarder_dataset');

function parseInsert(line) {
  if (!line.startsWith('INSERT INTO `')) return null;
  const tEnd = line.indexOf('`', 13);
  const table = line.slice(13, tEnd);
  const marker = ' VALUES (';
  const vIdx = line.indexOf(marker);
  if (vIdx < 0) return null;
  let body = line.slice(vIdx + marker.length); // 位于第一个元组内部
  if (body.endsWith(';')) body = body.slice(0, -1);

  const ESC = { n: '\n', r: '\r', t: '\t', 0: '\0', b: '\b', Z: '\x1a', "'": "'", '"': '"', '\\': '\\' };
  const tuples = [];
  let cur = '';
  let depth = 1; // body 起点在第一个元组内部
  let inStr = false;
  let esc = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (esc) {
      cur += (ESC[ch] !== undefined ? ESC[ch] : '\\' + ch);
      esc = false;
      continue;
    }
    if (inStr) {
      if (ch === '\\') { esc = true; continue; }
      if (ch === "'") { inStr = false; cur += ch; continue; }
      cur += ch;
      continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === '(') { depth++; if (depth > 1) cur += ch; continue; }
    if (ch === ')') {
      depth--;
      if (depth === 0) { tuples.push(cur); cur = ''; }
      else cur += ch;
      continue;
    }
    if (depth >= 1) cur += ch;
  }
  return tuples.map((tuple) => {
    // 元组内按顶层逗号切列（元组内容已还原为 SQL 字面值）
    const cols = [];
    let c = '';
    inStr = false; esc = false;
    for (let i = 0; i < tuple.length; i++) {
      const ch = tuple[i];
      if (esc) { c += ESC[ch] !== undefined ? ESC[ch] : '\\' + ch; esc = false; continue; }
      if (inStr) {
        if (ch === '\\') { esc = true; continue; }
        if (ch === "'") { inStr = false; continue; }
        c += ch;
        continue;
      }
      if (ch === "'") { inStr = true; continue; }
      if (ch === ',') { cols.push(c); c = ''; continue; }
      c += ch;
    }
    cols.push(c);
    return { table, cols };
  });
}

function summarizeTask(snap, id, rev) {
  console.log(`task ${id} rev${rev}: ${snap.name}`);
  console.log(`  rows=${(snap.rows || []).length} units=${(snap.units || []).length}`);
  const ports = {};
  for (const r of (snap.rows || [])) {
    const p = `${r.destinationPort || '?'}(seq${r.portSequence})`;
    ports[p] = (ports[p] || 0) + Number(r.quantity || 1);
    console.log(`    ${r.sku} ${r.length}x${r.width}x${r.height} w=${r.weight} qty=${r.quantity} ${p} stack=${r.stackable} max=${r.maxStackLayers} pkg=${r.packagingType} frag=${r.fragile} rot=${r.canRotate} cust=${String(r.customerId).slice(0, 12)}`);
  }
  console.log('  units per port:', JSON.stringify(ports));
  const u = (snap.units || [])[0];
  if (u) console.log('  unit[0] keys:', Object.keys(u).join(','));
  const extra = ['selectedContainer', 'containers', 'containerSpec', 'containerInfo', 'options', 'algorithm', 'multiContainerPlan', 'containerPlan'];
  for (const k of extra) if (snap[k] !== undefined) console.log(`  ${k}:`, JSON.stringify(snap[k]).slice(0, 300));
}

function main() {
  for (const f of ['container_type.rows.jsonl', 'load_task.rows.jsonl', 'packing_case.rows.jsonl']) {
    console.log('========', f);
    const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter((l) => l.startsWith('INSERT'));
    for (const line of lines) {
      const rows = parseInsert(line) || [];
      for (const p of rows) {
        if (p.table === 'container_type') {
          console.log('  container_type:', p.cols.slice(0, 8).join(' | '));
          continue;
        }
        let snap = null;
        for (const c of p.cols) {
          if (c && c.trim().startsWith('{')) {
            try { snap = JSON.parse(c); } catch (e) { /* try next col */ }
            if (snap) break;
          }
        }
        if (!snap) { console.log('  [no JSON payload]', p.cols.map((c) => String(c).slice(0, 30)).join(' | ')); continue; }
        if (p.table === 'load_task') { summarizeTask(snap, p.cols[0], p.cols[1]); continue; }
        if (p.table === 'packing_case') {
          console.log(`  case ${p.cols[0]}: keys=${Object.keys(snap).join(',').slice(0, 200)}`);
          const cargo = snap.cargoList || snap.cargo || snap.rows;
          if (cargo) console.log('    cargo entries:', cargo.length, JSON.stringify(cargo[0] || {}).slice(0, 220));
          const cont = snap.containerInfo || snap.container;
          if (cont) console.log('    container:', JSON.stringify(cont).slice(0, 180));
          const metrics = snap.metrics;
          if (metrics) console.log('    metrics.utilization:', metrics.space_utilization ?? metrics.utilization, 'loaded:', metrics.loadedCount ?? (snap.loadedCargo || []).length, 'solveMs:', metrics.solveMs ?? metrics.elapsedMs);
        }
      }
    }
  }
}

main();
