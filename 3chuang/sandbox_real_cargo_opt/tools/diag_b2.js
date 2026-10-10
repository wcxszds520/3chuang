'use strict';
/** B2 诊断：fast-block 单测耗时/合规性 + 编排器路由分析 */
const path = require('path');
const { buildRealBenchmarkCases, consolidateRows } = require(path.join(__dirname, '..', 'backend/services/realcargo/IngestRealCargo'));
const FastBlock = require(path.join(__dirname, '..', 'backend/services/FastBlockPackingEngine'));
const PlanValidator = require(path.join(__dirname, '..', 'backend/services/packing/PlanValidator'));
const { performance } = require('perf_hooks');
const { CATALOG } = require(path.join(__dirname, '..', 'backend/services/realcargo/ContainerRecommender'));

function scaleRows(rows, factor) {
  const out = [];
  for (const r of rows) {
    const q = Math.max(1, Number(r.quantity || 1));
    const extra = Math.floor(q * (factor - 1));
    out.push({ ...r });
    for (let i = 0; i < extra; i++) out.push({ ...r, cargoId: (r.cargoId || r.sku) + '_x' + (i + 1) });
  }
  return out;
}

async function main() {
  const cases = buildRealBenchmarkCases();
  const multi = cases.find((c) => c.id === 'REAL-MULTIPORT-212');
  const rows = consolidateRows(scaleRows(multi.cargoList, 2.0));
  const totalUnits = rows.reduce((s, r) => s + Math.max(1, Number(r.quantity || 1)), 0);
  console.log('B2 rows:', rows.length, 'units:', totalUnits, 'container:', CATALOG['40HQ'].typeId);

  const t0 = performance.now();
  const fb = await new FastBlock().generatePackingPlan(rows.map((r) => ({ ...r })), { ...CATALOG['40HQ'] });
  const t1 = performance.now();
  console.log('fast-block wall:', (t1 - t0).toFixed(0), 'ms; loaded:', (fb.loadedCargo || []).length, '; unloaded:', (fb.unloadedCargo || []).length);
  console.log('fast-block warnings:', JSON.stringify(fb.warnings || []).slice(0, 300));
  console.log('fast-block lifoCompliant:', fb.constraintMeta && fb.constraintMeta.lifoCompliant, 'insertionFeasible:', fb.constraintMeta && fb.constraintMeta.insertionPathFeasible);
  const pv = new PlanValidator().validate({ placements: fb.loadedCargo || [], cargoList: rows, container: { ...CATALOG['40HQ'] } });
  console.log('fast-block PV hard:', pv.hardViolationCount, 'status:', pv.status);
  const byCode = {};
  for (const v of pv.violations || []) byCode[v.code] = (byCode[v.code] || 0) + 1;
  console.log('PV codes:', JSON.stringify(byCode));
  for (const v of (pv.violations || []).slice(0, 3)) console.log('  e.g.', v.code, JSON.stringify(v.cargoIds || []).slice(0, 80), String(v.message).slice(0, 90));
}
main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
