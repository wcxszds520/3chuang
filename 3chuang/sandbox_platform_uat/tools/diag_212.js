'use strict';
/** 单次 212 generate 诊断：耗时分解 + validator 详情 */
const { createUatApp } = require('../uat_server');
const path = require('path');
const { buildRealBenchmarkCases } = require('../backend/services/realcargo/IngestRealCargo');
const http = require('http');

async function main() {
  const app = createUatApp();
  const server = http.createServer(app);
  await new Promise((r) => server.listen(3799, '127.0.0.1', r));
  const cases = buildRealBenchmarkCases(path.join(__dirname,'..','data_real_forwarder_dataset'));
  const c212 = cases.find((c) => c.id === 'REAL-MULTIPORT-212');
  const body = JSON.stringify({ cargoList: c212.cargoList.map((x) => ({ ...x })), containerType: '40HQ' });
  const t0 = Date.now();
  const res = await new Promise((resolve, reject) => {
    const req = http.request('http://127.0.0.1:3799/api/packing/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve(JSON.parse(b)));
    });
    req.write(body); req.end();
  });
  const wall = Date.now() - t0;
  const data = res.data || {};
  console.log('wall', wall, 'ms; loaded', data.loadedCargo ? data.loadedCargo.length : '-');
  const v = data.validator;
  if (v) {
    console.log('validator: hard', v.hardViolationCount, 'status', v.status, 'checks', JSON.stringify({
      bounds: v.checks && v.checks.bounds, collision: v.checks && v.checks.collision,
      support: v.checks && v.checks.support, lifo: v.checks && v.checks.lifo,
      insertion: v.checks && v.checks.insertion, stack: v.checks && v.checks.stack,
      carrying: v.checks && v.checks.carrying, stability: v.checks && v.checks.stability
    }));
  } else console.log('validator: none');
  console.log('warnings:', JSON.stringify(data.warnings || []).slice(0, 250));
  console.log('unloaded:', (data.unloadedCargo || []).length);
  server.close();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
