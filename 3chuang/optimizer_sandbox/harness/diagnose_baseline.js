'use strict';
/** 诊断：数据集 B 的违规明细 + PlanValidator 违规码分布 */
const path = require('path');
const SANDBOX_ROOT = path.resolve(__dirname, '..');
const AlgorithmOrchestrator = require(path.join(SANDBOX_ROOT, 'backend/services/AlgorithmOrchestrator'));
const PlanValidator = require(path.join(SANDBOX_ROOT, 'backend/services/packing/PlanValidator'));
const { buildProjectBenchmarkCases } = require(path.join(SANDBOX_ROOT, 'backend/benchmarks/projectBenchmarkCases'));
const { checkPhysical, checkOrientation, checkLifo } = require('./independent_check');

const NOOP_CACHE = { get: async () => null, set: async () => {} };

async function main() {
  const cases = await buildProjectBenchmarkCases();
  const orch = new AlgorithmOrchestrator({ cache: NOOP_CACHE, debugMode: false });
  for (const c of cases) {
    const result = await orch.execute({ cargoList: c.cargoList.map(x => ({ ...x })), container: { ...c.container }, options: { algorithmId: 'realistic4d-multi-strategy', seed: 42 } });
    const placements = result.loadedCargo || [];
    const phys = checkPhysical(placements, c.container);
    const orient = checkOrientation(placements, c.cargoList);
    const lifo = checkLifo(placements);
    console.log(`\n=== ${c.id} ===`);
    console.log(`strategyUsed=${result.metrics?.strategy_used} algoId=${result.metrics?.algorithm_id}`);
    console.log(`engine warnings: ${JSON.stringify(result.warnings || [])}`);
    console.log(`engine lifoCompliant=${result.constraintMeta?.lifoCompliant} insertionFeasible=${result.constraintMeta?.insertionPathFeasible}`);

    const byCode = {};
    for (const v of [...phys.violations, ...orient, ...lifo]) byCode[v.code] = (byCode[v.code] || 0) + 1;
    console.log(`independent violations: ${JSON.stringify(byCode)}`);
    for (const v of [...phys.violations, ...orient, ...lifo].slice(0, 8)) {
      console.log(`  - ${v.code} ${v.cargoId || ''}: ${v.message}`);
    }

    const pv = new PlanValidator().validate({ placements, cargoList: c.cargoList, container: c.container });
    const pvByCode = {};
    for (const v of pv.violations || []) pvByCode[v.code] = (pvByCode[v.code] || 0) + 1;
    console.log(`PlanValidator hard=${pv.hardViolationCount} codes=${JSON.stringify(pvByCode)}`);

    // 批次区间布局
    const batches = new Map();
    for (const it of placements) {
      const seq = Number(it.portSequence || 1);
      if (!batches.has(seq)) batches.set(seq, { minX: Infinity, maxX: -Infinity, fragileTop: 0 });
      const b = batches.get(seq);
      b.minX = Math.min(b.minX, it.x); b.maxX = Math.max(b.maxX, it.x + it.l);
    }
    console.log(`batch x-ranges: ${JSON.stringify([...batches.entries()].map(([s, b]) => ({ seq: s, minX: Math.round(b.minX), maxX: Math.round(b.maxX) })))}`);

    // 各 portSequence 输入
    const inSeq = {};
    for (const g of c.cargoList) inSeq[g.portSequence || 1] = (inSeq[g.portSequence || 1] || 0) + Math.max(1, g.quantity || 1);
    console.log(`input per portSequence: ${JSON.stringify(inSeq)}`);

    // fragile 堆叠明细
    const fragileIds = new Set(placements.filter(p => p.fragile).map(p => p.cargoId));
    if (fragileIds.size) {
      console.log(`fragile loaded: ${[...fragileIds].join(',')}`);
      const CONTACT = 2;
      for (const it of placements) {
        for (const low of placements) {
          if (low === it || !fragileIds.has(low.cargoId)) continue;
          if (Math.abs(low.y + low.h - it.y) > CONTACT) continue;
          const ox = Math.min(it.x + it.l, low.x + low.l) - Math.max(it.x, low.x);
          const oz = Math.min(it.z + it.w, low.z + low.w) - Math.max(it.z, low.z);
          if (ox > 0 && oz > 0) console.log(`  ${it.cargoId}(w=${it.weight}) rests on fragile ${low.cargoId}`);
        }
      }
    }
  }
}
main().catch(e => { console.error(e.stack); process.exit(1); });
