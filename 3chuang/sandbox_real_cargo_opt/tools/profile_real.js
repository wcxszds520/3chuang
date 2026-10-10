'use strict';
/** 真实数据引擎耗时剖析：engine / PlanValidator / 组数 */
const { buildRealBenchmarkCases } = require('../backend/services/realcargo/IngestRealCargo');
const FastBlock = require('../backend/services/FastBlockPackingEngine');
const PlanValidator = require('../backend/services/packing/PlanValidator');
const { performance } = require('perf_hooks');

async function main() {
  const cases = buildRealBenchmarkCases();
  for (const c of cases) {
    const t1 = performance.now();
    const engRes = await new FastBlock().generatePackingPlan(c.cargoList.map((x) => ({ ...x })), { ...c.container });
    const t2 = performance.now();
    const pv = new PlanValidator().validate({ placements: engRes.loadedCargo || [], cargoList: c.cargoList, container: c.container });
    const t3 = performance.now();
    // 重复跑一次引擎取稳定值
    const t4 = performance.now();
    await new FastBlock().generatePackingPlan(c.cargoList.map((x) => ({ ...x })), { ...c.container });
    const t5 = performance.now();
    console.log(c.id.padEnd(24), 'engine', (t2 - t1).toFixed(1), '/', (t5 - t4).toFixed(1), 'ms  pv', (t3 - t2).toFixed(1), 'ms  groups', c.cargoList.length, 'loaded', (engRes.loadedCargo || []).length);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
