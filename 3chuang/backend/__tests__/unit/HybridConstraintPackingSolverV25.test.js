'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const HybridConstraintPackingSolverV25 = require('../../services/HybridConstraintPackingSolverV25');
const { comparePlanQualityV25 } = HybridConstraintPackingSolverV25;
const { buildTinyOracleCases } = require('../../benchmarks/tinyOracleCases');

function candidate({ guidance = 'PARTICULAR_CIRCUMSTANCES_REVIEW', unexplained = 10, internal = 10, operation = 1, cog = 1, loaded = 10 } = {}) {
  return {
    candidateId: String(unexplained), placementHash: String(unexplained).padStart(16, '0'), runtimeTieBreakClass: 0,
    validator: { hardViolationCount: 0 }, operationFeasibility: { blockedCount: 0 },
    portAccessibility: { blockedCount: 0, rehandleCount: 0, calls: [] }, mandatoryGateViolationCount: 0,
    metrics: { stability: { invalidCount: 0 }, loadedCount: loaded, operation: { totalCost: operation } },
    loadDistribution: { centreOfGravity: { guidanceStatus: guidance, lateralOffsetPercent: cog, longitudinalOffsetPercent: cog }, segments: { longitudinal: [] } },
    voidJustification: { unexplainedVoidVolume: unexplained, maxUnexplainedGapMm: unexplained },
    layoutQuality: { internalVoidVolume: internal, crossSectionFillP10: 0.8, lowFillInteriorSliceCount: 1, contactRatioMean: 0.8 },
    securing: { status: 'SECURING_NOT_REQUIRED' }
  };
}

describe('HybridConstraintPackingSolver V2.5 selection policy', () => {
  jest.setTimeout(120000);

  test('same guidance class selects tighter layout before operation cost and continuous CoG', () => {
    const tight = candidate({ unexplained: 10, internal: 10, operation: 100, cog: 9 });
    const loose = candidate({ unexplained: 100, internal: 100, operation: 1, cog: 1 });
    expect(comparePlanQualityV25(tight, loose, 'OPERATION')).toBeLessThan(0);
  });

  test('guidance class remains ahead of layout compactness', () => {
    const within = candidate({ guidance: 'WITHIN_GENERAL_GUIDANCE', unexplained: 1000 });
    const particular = candidate({ guidance: 'PARTICULAR_CIRCUMSTANCES_REVIEW', unexplained: 1 });
    expect(comparePlanQualityV25(within, particular, 'SPACE')).toBeLessThan(0);
  });

  test('guidance class stays ahead of loaded count, then loaded count wins inside the same class', () => {
    const withinNine = candidate({ guidance: 'WITHIN_GENERAL_GUIDANCE', loaded: 9 });
    const particularTen = candidate({ guidance: 'PARTICULAR_CIRCUMSTANCES_REVIEW', loaded: 10 });
    const withinTen = candidate({ guidance: 'WITHIN_GENERAL_GUIDANCE', loaded: 10 });
    expect(comparePlanQualityV25(withinNine, particularTen, 'SPACE')).toBeLessThan(0);
    expect(comparePlanQualityV25(withinTen, withinNine, 'SPACE')).toBeLessThan(0);
  });

  test('bounded production candidate closes every historical operation-feasible tiny gap', async () => {
    const cases = buildTinyOracleCases(20);
    const historicalExactCounts = new Map([[1, 7], [3, 6], [5, 4], [13, 6], [19, 5]]);
    for (const [index, exactCount] of historicalExactCounts) {
      const benchmarkCase = cases[index];
      const result = await new HybridConstraintPackingSolverV25().generatePackingPlan(
        benchmarkCase.cargoList,
        benchmarkCase.container,
        { strategy: 'SPACE', caseContext: { caseDate: '2026-08-24', route: [1] } }
      );
      expect(result.loadedCargo).toHaveLength(exactCount);
      expect(result.validator.hardViolationCount).toBe(0);
      expect(result.operationFeasibility.blockedCount).toBe(0);
    }
  });

  test('repairs Dataset A operation regression and protects Dataset B CoG', () => {
    const backendRoot = path.resolve(__dirname, '../..');
    const script = `(async()=>{const {buildProjectBenchmarkCases}=require('./benchmarks/projectBenchmarkCases');const V=require('./services/HybridConstraintPackingSolverV25');const [a,b]=await buildProjectBenchmarkCases();const ar=await new V().generatePackingPlan(a.cargoList,a.container,{strategy:'OPERATION'});const br=await new V().generatePackingPlan(b.cargoList,b.container,{strategy:'OPERATION'});process.stdout.write(JSON.stringify({a:{loaded:ar.loadedCargo.length,candidate:ar.candidateId,source:ar.sourceAlgorithm,hard:ar.validator.hardViolationCount,op:ar.operationFeasibility.blockedCount,port:ar.portAccessibility.status,rehandle:ar.portAccessibility.rehandleCount,post:ar.portAccessibility.postUnloadStabilityPass,internal:ar.layoutQuality.internalVoidVolume},b:{loaded:br.loadedCargo.length,candidate:br.candidateId,hard:br.validator.hardViolationCount,op:br.operationFeasibility.blockedCount,port:br.portAccessibility.status,guide:br.loadDistribution.centreOfGravity.guidanceStatus,longitudinal:br.loadDistribution.centreOfGravity.longitudinalOffsetPercent}}));})().catch(e=>{console.error(e.stack);process.exit(1)});`;
    const result = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: backendRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
    expect(result.a).toMatchObject({ loaded: 212, source: 'hybrid-v2.3', hard: 0, op: 0, port: 'FULL_UNLOAD_PASS', rehandle: 0, post: true });
    expect(result.a.internal).toBeLessThan(4_000_000_000);
    expect(result.b).toMatchObject({ loaded: 69, hard: 0, op: 0, port: 'FULL_UNLOAD_PASS', guide: 'WITHIN_GENERAL_GUIDANCE' });
    expect(result.b.longitudinal).toBeLessThanOrEqual(5);
  });
});
