'use strict';

module.exports = Object.freeze({
  officialSolver: 'hybrid-v2.5',
  fallbackSolver: 'fast-block-v1',
  defaultStrategy: 'SPACE',
  v2: Object.freeze({ beamWidth: 4, lookaheadDepth: 2, candidateLimit: 10 }),
  v23: Object.freeze({ longitudinalShiftQuantumMm: 50, enableV21Guardrail: true }),
  v24: Object.freeze({ maximumCandidates: 8 }),
  v25: Object.freeze({ maximumCandidates: 8, enableVoidLocalRepair: true, maximumLocalRepairItems: 30, maximumLocalRepairTrials: 18 }),
  benchmarkProfile: Object.freeze({
    version: 'competition-2.4',
    dataClassification: 'DEMO_DATA_AND_SYNTHETIC_BENCHMARK',
    datasetAInputCount: 212,
    datasetALoadedCount: 212,
    datasetAHardViolations: 0,
    datasetAStabilityInvalid: 0,
    datasetAOperationBlocked: 0,
    datasetAV21InternalVoid: 7523920000,
    datasetAV23InternalVoid: 3766360000,
    datasetAInternalVoidImprovementPercent: 49.94151984603769,
    datasetAV21LowFillSlices: 12,
    datasetAV23LowFillSlices: 6,
    datasetAV21LargestReserve: 7953369272,
    datasetAV23LargestReserve: 8542014271.999999,
    datasetAV23RuntimeMs: 2629,
    fixedSyntheticCaseCount: 48,
    challengeCaseCount: 64,
    tinyOracleCaseCount: 20,
    promotionDecision: 'PROMOTE_HYBRID_V2_3'
  })
});
