'use strict';
/** 进程内多次重复基准：区分冷/热启动，定位真实热点 */
const { buildRealBenchmarkCases } = require('../backend/services/realcargo/IngestRealCargo');
const FastBlock = require('../backend/services/FastBlockPackingEngine');
const { performance } = require('perf_hooks');

async function main() {
  const cases = buildRealBenchmarkCases();
  const REPS = 7;
  for (const c of cases) {
    const times = [];
    let last = null;
    for (let i = 0; i < REPS; i++) {
      const t0 = performance.now();
      const res = await new FastBlock().generatePackingPlan(c.cargoList.map((x) => ({ ...x })), { ...c.container });
      const t1 = performance.now();
      times.push(t1 - t0);
      last = res;
    }
    const sorted = [...times].sort((a, b) => a - b);
    const min = sorted[0].toFixed(1);
    const med = sorted[Math.floor(REPS / 2)].toFixed(1);
    const max = sorted[REPS - 1].toFixed(1);
    const groups = c.cargoList.length;
    const units = c.cargoList.reduce((s, x) => s + Math.max(1, Number(x.quantity || 1)), 0);
    console.log(c.id.padEnd(24), `groups=${String(groups).padStart(3)} units=${String(units).padStart(3)} engine ms min=${min} med=${med} max=${max}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
