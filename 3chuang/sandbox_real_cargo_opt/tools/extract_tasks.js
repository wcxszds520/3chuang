'use strict';
/** 从 load_task.rows.jsonl 提取真实任务快照 → 基准数据集 JSON */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'real_forwarder_dataset');
const ESC = { n: '\n', r: '\r', t: '\t', 0: '\0', b: '\b', Z: '\x1a', "'": "'", '"': '"', '\\': '\\' };

function parseInsert(line) {
  if (!line.startsWith('INSERT INTO `')) return null;
  const tEnd = line.indexOf('`', 13);
  const table = line.slice(13, tEnd);
  const vIdx = line.indexOf(' VALUES (');
  if (vIdx < 0) return null;
  let body = line.slice(vIdx + ' VALUES ('.length);
  if (body.endsWith(';')) body = body.slice(0, -1);
  const tuples = [];
  let cur = '';
  let depth = 1;
  let inStr = false;
  let esc = false;
  for (const ch of body) {
    if (esc) { cur += (ESC[ch] !== undefined ? ESC[ch] : '\\' + ch); esc = false; continue; }
    if (inStr) {
      if (ch === '\\') { esc = true; continue; }
      if (ch === "'") { inStr = false; cur += ch; continue; }
      cur += ch; continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === '(') { depth++; if (depth > 1) cur += ch; continue; }
    if (ch === ')') { depth--; if (depth === 0) { tuples.push(cur); cur = ''; } else cur += ch; continue; }
    if (depth >= 1) cur += ch;
  }
  return tuples.map((tuple) => {
    const cols = [];
    let c = '';
    inStr = false; esc = false;
    for (const ch of tuple) {
      if (esc) { c += (ESC[ch] !== undefined ? ESC[ch] : '\\' + ch); esc = false; continue; }
      if (inStr) {
        if (ch === '\\') { esc = true; continue; }
        if (ch === "'") { inStr = false; continue; }
        c += ch; continue;
      }
      if (ch === "'") { inStr = true; continue; }
      if (ch === ',') { cols.push(c); c = ''; continue; }
      c += ch;
    }
    cols.push(c);
    return { table, cols };
  });
}

function main() {
  const src = path.join(DIR, 'load_task.rows.jsonl');
  const tasks = [];
  for (const line of fs.readFileSync(src, 'utf8').split('\n').filter((l) => l.startsWith('INSERT'))) {
    for (const p of (parseInsert(line) || [])) {
      let snap = null;
      for (const c of p.cols) {
        if (c && c.trim().startsWith('{')) { try { snap = JSON.parse(c); } catch (e) { /* next */ } if (snap) break; }
      }
      if (snap && p.table === 'load_task') tasks.push({ id: p.cols[0], rev: Number(p.cols[1]), snap });
    }
  }
  console.log('tasks parsed:', tasks.length);
  for (const t of tasks) {
    const cons = t.snap.containers || [];
    console.log(`\n=== ${t.id} rev${t.rev}: ${t.snap.name}`);
    console.log('  rows:', (t.snap.rows || []).length, 'units:', (t.snap.units || []).length, 'saved containers:', cons.length);
    if (t.snap.container) console.log('  snap.container:', JSON.stringify(t.snap.container).slice(0, 200));
    for (const c of cons.slice(0, 3)) {
      console.log('  saved-container keys:', Object.keys(c).join(','));
      for (const k of ['containerInfo', 'container', 'typeId', 'containerTypeId', 'spec']) {
        if (c[k]) console.log(`    ${k}:`, JSON.stringify(c[k]).slice(0, 220));
      }
      if (c.plan && c.plan.containerInfo) console.log('    plan.containerInfo:', JSON.stringify(c.plan.containerInfo).slice(0, 220));
      if (c.plan && c.plan.metrics) console.log('    plan util:', c.plan.metrics.space_utilization, 'loaded:', (c.plan.loadedCargo || []).length);
    }
    if (t.snap.containerSpec) console.log('  containerSpec:', JSON.stringify(t.snap.containerSpec).slice(0, 200));
    if (t.snap.containerInfo) console.log('  containerInfo:', JSON.stringify(t.snap.containerInfo).slice(0, 200));
  }
  // 落盘清洗后的任务快照
  for (const t of tasks) {
    const out = {
      taskId: t.id,
      revision: t.rev,
      name: t.snap.name,
      rows: t.snap.rows || [],
      units: t.snap.units || [],
      containers: t.snap.containers || [],
      container: t.snap.container || null,
      containerSpec: t.snap.containerSpec || t.snap.containerInfo || null
    };
    const file = path.join(DIR, `real_task_${t.id.slice(5, 13)}_rev${t.rev}.json`);
    fs.writeFileSync(file, JSON.stringify(out, null, 1), 'utf8');
    console.log('saved:', path.basename(file));
  }
}

main();
