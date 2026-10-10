'use strict';

const fs = require('fs');
const path = require('path');
const HybridConstraintPackingSolverV24 = require('../services/HybridConstraintPackingSolverV24');
const HybridConstraintPackingSolverV25 = require('../services/HybridConstraintPackingSolverV25');
const { normalizeCargoPhysicalProfile } = require('../services/packing/PackagingProfile');
const { legalOrientations } = require('../services/packing/PlanValidator');
const { buildProjectBenchmarkCases } = require('./projectBenchmarkCases');
const { buildSyntheticBenchmarkCases } = require('./solverBenchmarkCases');
const { buildPhysicalPackingChallengeCases, CHALLENGE_CLASSES } = require('./physicalPackingChallengeCases');
const { buildTinyOracleCases } = require('./tinyOracleCases');
const { solveTinyFloorPacking } = require('./TinyFloorPackingOracle');
const { buildPackagingSemanticCases } = require('./packagingSemanticCases');
const { analyzeOperationFeasibility } = require('../services/packing/CanonicalOperationFeasibility');
const { buildMultiportCases, runAdmissionRuleCases, coreGate } = require('./runCompetition24Benchmark');

const STRATEGIES = ['SPACE', 'BALANCE', 'OPERATION'];

async function runCompetition25Benchmark({
  outputDirectory = path.resolve(__dirname, '../../artifacts/competition-2.5'),
  fixedCaseCount = 48,
  challengeCaseCount = 64,
  tinyCaseCount = 20,
  multiportCaseCount = 24,
  packagingCaseCount = 24,
  repeatDeterminism = true,
  concurrency = 2,
  onProgress = () => {}
} = {}) {
  const startedAt = Date.now();
  const projectCases = await buildProjectBenchmarkCases();
  const datasetA = projectCases.find((entry) => entry.id === 'DATASET-A-212');
  onProgress('dataset A V2.4 operation baseline');
  const v24Before = await solveWith(HybridConstraintPackingSolverV24, datasetA, 'OPERATION');
  const project = {};
  for (const benchmarkCase of projectCases) {
    project[benchmarkCase.id] = { label: benchmarkCase.label, strategies: {} };
    for (const strategy of STRATEGIES) {
      onProgress(`project ${benchmarkCase.id} ${strategy}`);
      const first = await solveCase(benchmarkCase, strategy);
      const repeat = repeatDeterminism ? await solveCase(benchmarkCase, strategy, true) : first;
      project[benchmarkCase.id].strategies[strategy] = {
        ...first,
        determinism: { firstHash: first.placementHash, repeatHash: repeat.placementHash, pass: first.placementHash === repeat.placementHash }
      };
    }
  }

  const fixed = await runCorpus('FIXED', buildSyntheticBenchmarkCases(fixedCaseCount), { repeatDeterminism, concurrency, onProgress });
  const challenge = await runCorpus('CHALLENGE', buildPhysicalPackingChallengeCases(challengeCaseCount), { repeatDeterminism, concurrency, onProgress });
  const tiny = await runTinyCorpus(buildTinyOracleCases(tinyCaseCount), { repeatDeterminism, concurrency, onProgress });
  const multiport = await runCorpus('MULTIPORT', buildMultiportCases(multiportCaseCount), { repeatDeterminism, concurrency, onProgress });
  const packaging = await runPackagingCorpus(buildPackagingSemanticCases().slice(0, packagingCaseCount), { repeatDeterminism, concurrency, onProgress });
  const admission = runAdmissionRuleCases();
  const datasetAAfter = project['DATASET-A-212'].strategies.OPERATION;
  const datasetComparison = {
    datasetId: 'DATASET-A-212',
    v24Operation: v24Before,
    v25Operation: datasetAAfter,
    internalVoidReduction: number(v24Before.internalVoidVolume) - number(datasetAAfter.internalVoidVolume),
    internalVoidReductionPercent: percentReduction(v24Before.internalVoidVolume, datasetAAfter.internalVoidVolume),
    rootCause: 'V2.4 strategy cost and continuous CoG could defeat tighter topology inside the same guidance class',
    fix: 'V2.5 guidance-class-first same-class Pareto layout selection'
  };
  const gates = buildGates({ project, fixed, challenge, tiny, multiport, packaging, admission, datasetComparison, fixedCaseCount, challengeCaseCount, tinyCaseCount, multiportCaseCount, packagingCaseCount });
  const report = {
    benchmarkId: 'PORTCUBE-COMPETITION-2.5-PRODUCT-TRUTH-BENCHMARK',
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    solver: 'hybrid-v2.5',
    coordinateContract: { lengthAxis: 'x', gravityAxis: 'y', widthAxis: 'z', doorSide: 'higher x coordinate' },
    dataClassification: {
      project: 'DEMO_DATA', fixed: 'SYNTHETIC_BENCHMARK', challenge: 'SYNTHETIC_BENCHMARK',
      tiny: 'SYNTHETIC_EXACT_ORACLE', multiport: 'SYNTHETIC_MULTIPORT', packaging: 'SYNTHETIC_PACKAGING_SEMANTICS',
      admission: 'DETERMINISTIC_RULE_CASES'
    },
    datasetComparison,
    project,
    corpora: { fixed, challenge, tiny, multiport, packaging },
    admission,
    gates,
    decision: Object.values(gates).every(Boolean) ? 'PORTCUBE_COMPETITION_2_5_FINAL_FREEZE' : 'READY_WITH_LIMITATIONS'
  };
  fs.mkdirSync(outputDirectory, { recursive: true });
  const jsonPath = path.join(outputDirectory, 'competition-2.5-benchmark.json');
  const csvPath = path.join(outputDirectory, 'competition-2.5-cases.csv');
  const packagingPath = path.join(outputDirectory, 'competition-2.5-packaging-cases.json');
  const comparisonPath = path.join(outputDirectory, 'competition-2.5-dataset-a-before-after.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(csvPath, corpusCsv([...fixed.rows, ...challenge.rows, ...tiny.rows, ...multiport.rows]), 'utf8');
  fs.writeFileSync(packagingPath, `${JSON.stringify(packaging, null, 2)}\n`, 'utf8');
  fs.writeFileSync(comparisonPath, `${JSON.stringify(datasetComparison, null, 2)}\n`, 'utf8');
  return { report, jsonPath, csvPath, packagingPath, comparisonPath };
}

async function solveCase(benchmarkCase, strategy, hashOnly = false) {
  const result = await solveWith(HybridConstraintPackingSolverV25, benchmarkCase, strategy);
  return hashOnly ? { placementHash: result.placementHash } : result;
}

async function solveWith(Solver, benchmarkCase, strategy, solverConfig = {}) {
  const startedAt = Date.now();
  const result = await new Solver(solverConfig).generatePackingPlan(benchmarkCase.cargoList, benchmarkCase.container, {
    strategy,
    caseContext: { caseDate: '2026-08-24', route: routeFor(benchmarkCase.cargoList) }
  });
  return {
    strategy,
    wallMs: Date.now() - startedAt,
    placementHash: result.placementHash,
    candidateId: result.candidateId,
    selectedCandidateAlgorithm: result.sourceAlgorithm,
    loadedCount: result.loadedCargo.length,
    unloadedCount: result.unloadedCargo.length,
    hardViolationCount: number(result.validator?.hardViolationCount),
    operationBlockedCount: number(result.operationFeasibility?.blockedCount),
    portAccessStatus: result.portAccessibility?.status,
    portAccessBlockedCount: number(result.portAccessibility?.blockedCount),
    rehandleCount: number(result.portAccessibility?.rehandleCount),
    postUnloadStabilityPass: Boolean(result.portAccessibility?.postUnloadStabilityPass),
    stabilityInvalidCount: number(result.metrics?.stability?.invalidCount),
    lifoPass: Boolean(result.validator?.checks?.lifo),
    insertionPass: Boolean(result.validator?.checks?.insertion),
    lateralCogPercent: number(result.loadDistribution?.centreOfGravity?.lateralOffsetPercent),
    longitudinalCogPercent: number(result.loadDistribution?.centreOfGravity?.longitudinalOffsetPercent),
    cogGuidanceStatus: result.loadDistribution?.centreOfGravity?.guidanceStatus,
    internalVoidVolume: number(result.layoutQuality?.internalVoidVolume),
    unexplainedVoidVolume: number(result.voidJustification?.unexplainedVoidVolume),
    crossSectionP10: number(result.layoutQuality?.crossSectionFillP10),
    lowFillInteriorSlices: number(result.layoutQuality?.lowFillInteriorSliceCount),
    derivedTeamManualCount: result.handlingAssumptions?.length || 0,
    localRepair: result.constraintMeta?.portfolio?.localRepair || null
  };
}

async function runCorpus(corpusId, cases, options) {
  const rows = await mapLimit(cases, options.concurrency, async (benchmarkCase, index) => {
    options.onProgress(`${corpusId} ${index + 1}/${cases.length} ${benchmarkCase.id}`);
    const first = await solveCase(benchmarkCase, 'SPACE');
    const repeat = options.repeatDeterminism ? await solveCase(benchmarkCase, 'SPACE', true) : first;
    return { corpusId, id: benchmarkCase.id, scenario: benchmarkCase.scenario, challengeClass: benchmarkCase.challengeClass || benchmarkCase.scenario, ...first, determinismPass: first.placementHash === repeat.placementHash };
  });
  return summarizeCorpus(corpusId, rows);
}

async function runTinyCorpus(cases, options) {
  const rows = await mapLimit(cases, options.concurrency, async (benchmarkCase, index) => {
    options.onProgress(`TINY ${index + 1}/${cases.length} ${benchmarkCase.id}`);
    const oracle = solveTinyFloorPacking(benchmarkCase.cargoList, benchmarkCase.container, {
      acceptedModel: 'CANONICAL_OPERATION_FEASIBLE',
      acceptPlacements: (placements) => analyzeOperationFeasibility({ placements, container: benchmarkCase.container }).blockedCount === 0
    });
    const first = await solveCase(benchmarkCase, 'SPACE');
    const repeat = options.repeatDeterminism ? await solveCase(benchmarkCase, 'SPACE', true) : first;
    return {
      corpusId: 'TINY', id: benchmarkCase.id, scenario: 'TINY_EXACT_ORACLE', ...first,
      oracleLoadedCount: oracle.loadedCount,
      operationFeasibleOracleLoadedCount: oracle.acceptedLoadedCount,
      loadedCountGap: first.loadedCount - oracle.loadedCount,
      operationFeasibleLoadedCountGap: first.loadedCount - oracle.acceptedLoadedCount,
      determinismPass: first.placementHash === repeat.placementHash
    };
  });
  return {
    ...summarizeCorpus('TINY', rows),
    exactLoadedMatches: rows.filter((row) => row.loadedCountGap === 0).length,
    operationFeasibleExactLoadedMatches: rows.filter((row) => row.operationFeasibleLoadedCountGap === 0).length,
    explainedRawGapCaseIds: rows.filter((row) => row.loadedCountGap < 0 && row.operationFeasibleLoadedCountGap === 0).map((row) => row.id),
    unexplainedLoadedGapCaseIds: rows.filter((row) => row.operationFeasibleLoadedCountGap < 0).map((row) => row.id)
  };
}

async function runPackagingCorpus(cases, options) {
  const rows = await mapLimit(cases, options.concurrency, async (benchmarkCase, index) => {
    options.onProgress(`PACKAGING ${index + 1}/${cases.length} ${benchmarkCase.id}`);
    const normalized = normalizeCargoPhysicalProfile(benchmarkCase.cargoList[0], { source: 'USER_INPUT' });
    const first = await solveWith(HybridConstraintPackingSolverV25, { ...benchmarkCase, cargoList: [normalized] }, 'SPACE', { enableVoidLocalRepair: false });
    const repeat = options.repeatDeterminism
      ? await solveWith(HybridConstraintPackingSolverV25, { ...benchmarkCase, cargoList: [normalized] }, 'SPACE', { enableVoidLocalRepair: false })
      : first;
    const semanticsPass = normalized.packagingType === benchmarkCase.expected.packagingType
      && normalized.visualProfile.assetKey === benchmarkCase.expected.visualAssetKey
      && legalOrientations(normalized).length === benchmarkCase.expected.orientationCount
      && normalized.stackable === benchmarkCase.expected.stackable
      && normalized.maxStackLayers === benchmarkCase.expected.maxStackLayers
      && normalized.wooden === benchmarkCase.expected.wooden;
    return {
      id: benchmarkCase.id,
      packagingType: normalized.packagingType,
      visualAssetKey: normalized.visualProfile.assetKey,
      allowedOrientationCount: legalOrientations(normalized).length,
      loadedCount: first.loadedCount,
      hardViolationCount: first.hardViolationCount,
      operationBlockedCount: first.operationBlockedCount,
      semanticsPass,
      solverPass: first.loadedCount === 3 && coreGate(first),
      determinismPass: first.placementHash === repeat.placementHash,
      placementHash: first.placementHash
    };
  });
  return {
    corpusId: 'PACKAGING', caseCount: rows.length, rows,
    semanticsPassCount: rows.filter((row) => row.semanticsPass).length,
    solverPassCount: rows.filter((row) => row.solverPass).length,
    deterministicCount: rows.filter((row) => row.determinismPass).length,
    typeCoverage: [...new Set(rows.map((row) => row.packagingType))]
  };
}

function summarizeCorpus(corpusId, rows) {
  return {
    corpusId, caseCount: rows.length, rows,
    hardGatePassCount: rows.filter(coreGate).length,
    deterministicCount: rows.filter((row) => row.determinismPass).length,
    fullUnloadPassCount: rows.filter((row) => row.portAccessStatus === 'FULL_UNLOAD_PASS').length,
    postUnloadStabilityPassCount: rows.filter((row) => row.postUnloadStabilityPass).length,
    zeroRehandleCount: rows.filter((row) => row.rehandleCount === 0).length,
    maximumWallMs: Math.max(0, ...rows.map((row) => row.wallMs)),
    failureIds: rows.filter((row) => !coreGate(row)).map((row) => row.id)
  };
}

function buildGates({ project, fixed, challenge, tiny, multiport, packaging, admission, datasetComparison, fixedCaseCount, challengeCaseCount, tinyCaseCount, multiportCaseCount, packagingCaseCount }) {
  const aRows = Object.values(project['DATASET-A-212']?.strategies || {});
  const bRows = Object.values(project['DATASET-B-MIXED-69']?.strategies || {});
  const projectRows = [...aRows, ...bRows];
  return {
    datasetA212AllStrategies: aRows.length === 3 && aRows.every((row) => row.loadedCount === 212 && coreGate(row)),
    datasetATightTopologyAllStrategies: aRows.every((row) => row.selectedCandidateAlgorithm === 'hybrid-v2.3'),
    datasetAOperationVoidRegressionFixed: datasetComparison.internalVoidReduction > 4_000_000_000 && datasetComparison.internalVoidReductionPercent > 50,
    datasetB69AllStrategies: bRows.length === 3 && bRows.every((row) => row.loadedCount === 69 && coreGate(row)),
    datasetBNoFourteenPercentRegression: bRows.every((row) => row.cogGuidanceStatus === 'WITHIN_GENERAL_GUIDANCE' && row.longitudinalCogPercent <= 5),
    projectDeterministic: projectRows.every((row) => row.determinism.pass),
    fixedCaseCount48: fixed.caseCount === fixedCaseCount && fixedCaseCount === 48,
    fixedCorePass: fixed.hardGatePassCount === fixed.caseCount,
    fixedDeterministic: fixed.deterministicCount === fixed.caseCount,
    challengeCaseCount64: challenge.caseCount === challengeCaseCount && challengeCaseCount === 64,
    challengeClassesCovered: CHALLENGE_CLASSES.every((entry) => challenge.rows.some((row) => row.challengeClass === entry)),
    challengeCorePass: challenge.hardGatePassCount === challenge.caseCount,
    challengeDeterministic: challenge.deterministicCount === challenge.caseCount,
    tinyCaseCount20: tiny.caseCount === tinyCaseCount && tinyCaseCount === 20,
    tinyNoUnexplainedLoadedGap: tiny.unexplainedLoadedGapCaseIds.length === 0,
    tinyDeterministic: tiny.deterministicCount === tiny.caseCount,
    multiportCaseCount20To30: multiport.caseCount === multiportCaseCount && multiportCaseCount >= 20 && multiportCaseCount <= 30,
    multiportFullUnloadAndPostStability: multiport.hardGatePassCount === multiport.caseCount,
    multiportZeroRehandle: multiport.zeroRehandleCount === multiport.caseCount,
    packagingCaseCount20To30: packaging.caseCount === packagingCaseCount && packagingCaseCount >= 20 && packagingCaseCount <= 30,
    packagingAllEightTypes: packaging.typeCoverage.length === 8,
    packagingSemanticsPass: packaging.semanticsPassCount === packaging.caseCount,
    packagingSolverPass: packaging.solverPassCount === packaging.caseCount,
    packagingDeterministic: packaging.deterministicCount === packaging.caseCount,
    admissionRuleCasesPass: admission.passCount === admission.caseCount
  };
}

function routeFor(cargoList) { return [...new Set(cargoList.map((cargo) => number(cargo.portSequence || 1)))].sort((a, b) => a - b).map((portSequence) => ({ portSequence, portCode: ['HAM', 'RTM', 'ANR'][portSequence - 1] || `P${portSequence}` })); }
async function mapLimit(values, limit, mapper) { const rows = new Array(values.length); let cursor = 0; const workers = Array.from({ length: Math.max(1, limit) }, async () => { while (cursor < values.length) { const index = cursor++; rows[index] = await mapper(values[index], index); } }); await Promise.all(workers); return rows; }
function percentReduction(before, after) { return number(before) > 0 ? round((number(before) - number(after)) / number(before) * 100) : 0; }
function corpusCsv(rows) { const keys = ['corpusId', 'id', 'scenario', 'strategy', 'candidateId', 'selectedCandidateAlgorithm', 'loadedCount', 'unloadedCount', 'hardViolationCount', 'operationBlockedCount', 'portAccessStatus', 'portAccessBlockedCount', 'rehandleCount', 'postUnloadStabilityPass', 'stabilityInvalidCount', 'cogGuidanceStatus', 'lateralCogPercent', 'longitudinalCogPercent', 'internalVoidVolume', 'unexplainedVoidVolume', 'placementHash', 'determinismPass', 'wallMs']; return `${keys.join(',')}\n${rows.map((row) => keys.map((key) => csv(row[key])).join(',')).join('\n')}\n`; }
function csv(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

if (require.main === module) {
  runCompetition25Benchmark({ onProgress: (message) => process.stdout.write(`${message}\n`) })
    .then(({ report, jsonPath, csvPath, packagingPath, comparisonPath }) => process.stdout.write(`${JSON.stringify({ decision: report.decision, gates: report.gates, elapsedMs: report.elapsedMs, jsonPath, csvPath, packagingPath, comparisonPath }, null, 2)}\n`))
    .catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
}

module.exports = { runCompetition25Benchmark, solveCase, runPackagingCorpus };
