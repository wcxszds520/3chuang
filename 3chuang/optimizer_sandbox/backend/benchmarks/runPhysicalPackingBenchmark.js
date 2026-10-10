'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const HybridConstraintPackingSolverV2 = require('../services/HybridConstraintPackingSolverV2');
const HybridConstraintPackingSolverV23 = require('../services/HybridConstraintPackingSolverV23');
const { analyzeLayoutQuality } = require('../services/packing/LayoutQualityAnalyzer');
const { analyzeSecuring } = require('../services/packing/SecuringAnalyzer');
const { analyzeOperationFeasibility } = require('../services/packing/CanonicalOperationFeasibility');
const { buildProjectBenchmarkCases } = require('./projectBenchmarkCases');
const { buildSyntheticBenchmarkCases } = require('./solverBenchmarkCases');
const { buildPhysicalPackingChallengeCases, CHALLENGE_CLASSES } = require('./physicalPackingChallengeCases');
const { buildTinyOracleCases } = require('./tinyOracleCases');
const { solveTinyFloorPacking } = require('./TinyFloorPackingOracle');
const { placementHash } = require('./runPhysicalPackingBaseline');

const STRATEGIES = Object.freeze(['SPACE', 'BALANCE', 'OPERATION']);

async function runPhysicalPackingBenchmark({
  outputDirectory = path.resolve(__dirname, '../../artifacts/competition-2.3'),
  fixedCaseCount = 48,
  challengeCaseCount = 64,
  tinyCaseCount = 20,
  repeatDeterminism = true,
  onProgress = () => {}
} = {}) {
  const startedAt = Date.now();
  const frontend = await loadFrontendOperationRuntime();
  const historicalBaseline = readHistoricalBaseline(outputDirectory);
  const projectCases = await buildProjectBenchmarkCases();
  const project = {};
  const crossSectionRows = [];

  for (const benchmarkCase of projectCases) {
    const strategies = {};
    for (const strategy of STRATEGIES) {
      onProgress(`project ${benchmarkCase.id} ${strategy} V2.1`);
      const v21 = await solveAndEvaluate(HybridConstraintPackingSolverV2, benchmarkCase, strategy, frontend);
      onProgress(`project ${benchmarkCase.id} ${strategy} V2.3`);
      const v23 = await solveAndEvaluate(HybridConstraintPackingSolverV23, benchmarkCase, strategy, frontend);
      const repeat = repeatDeterminism
        ? await solveAndHash(HybridConstraintPackingSolverV23, benchmarkCase, strategy)
        : { placementHash: v23.placementHash };
      v23.determinism = {
        firstHash: v23.placementHash,
        repeatHash: repeat.placementHash,
        pass: v23.placementHash === repeat.placementHash
      };
      strategies[strategy] = { v21, v23, delta: compareEvaluations(v21, v23) };
      appendCrossSections(crossSectionRows, benchmarkCase.id, strategy, 'V2.1', v21.crossSectionReport);
      appendCrossSections(crossSectionRows, benchmarkCase.id, strategy, 'V2.3', v23.crossSectionReport);
    }
    project[benchmarkCase.id] = {
      label: benchmarkCase.label,
      dataClassification: benchmarkCase.dataClassification,
      strategies
    };
  }

  onProgress(`fixed synthetic corpus (${fixedCaseCount})`);
  const fixedSynthetic = await runSyntheticCorpus({
    corpusId: 'ORIGINAL_FIXED_SYNTHETIC',
    cases: buildSyntheticBenchmarkCases(fixedCaseCount),
    frontend,
    repeatDeterminism,
    onProgress
  });
  onProgress(`Competition 2.3 challenge corpus (${challengeCaseCount})`);
  const challengeSynthetic = await runSyntheticCorpus({
    corpusId: 'COMPETITION_2_3_DETERMINISTIC',
    cases: buildPhysicalPackingChallengeCases(challengeCaseCount),
    frontend,
    repeatDeterminism,
    onProgress
  });

  onProgress(`tiny exact oracle (${tinyCaseCount})`);
  const tinyOracle = await runTinyOracle({ count: tinyCaseCount, frontend, repeatDeterminism, onProgress });
  const promotion = evaluatePromotion({ project, challengeSynthetic, tinyOracle });
  const report = {
    benchmarkId: 'PORTCUBE-COMPETITION-2.3-PHYSICAL-PACKING-BENCHMARK',
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    dataClassification: {
      project: 'DEMO_DATA',
      synthetic: 'SYNTHETIC_BENCHMARK',
      tinyOracle: 'SYNTHETIC_TINY_ORACLE'
    },
    coordinateContract: {
      lengthAxis: 'x',
      gravityAxis: 'y',
      widthAxis: 'z',
      doorSide: 'higher x coordinate',
      loadingOrder: 'low x to high x, floor before stack, wall before centre'
    },
    historicalBaselineEvidence: historicalBaseline,
    project,
    synthetic: { fixed: fixedSynthetic, challenge: challengeSynthetic },
    tinyOracle,
    promotion
  };

  fs.mkdirSync(outputDirectory, { recursive: true });
  const jsonPath = path.join(outputDirectory, 'competition-2.3-benchmark.json');
  const crossSectionCsvPath = path.join(outputDirectory, 'competition-2.3-cross-sections.csv');
  const syntheticCsvPath = path.join(outputDirectory, 'competition-2.3-synthetic.csv');
  const tinyOracleCsvPath = path.join(outputDirectory, 'competition-2.3-tiny-oracle.csv');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(crossSectionCsvPath, crossSectionCsv(crossSectionRows), 'utf8');
  fs.writeFileSync(syntheticCsvPath, syntheticCsv([...fixedSynthetic.rows, ...challengeSynthetic.rows]), 'utf8');
  fs.writeFileSync(tinyOracleCsvPath, tinyOracleCsv(tinyOracle.rows), 'utf8');
  return { report, jsonPath, crossSectionCsvPath, syntheticCsvPath, tinyOracleCsvPath };
}

async function runSyntheticCorpus({ corpusId, cases, frontend, repeatDeterminism, onProgress }) {
  const rows = [];
  for (let index = 0; index < cases.length; index++) {
    const benchmarkCase = cases[index];
    onProgress(`${corpusId} ${index + 1}/${cases.length} ${benchmarkCase.id}`);
    const v21 = await solveAndEvaluate(HybridConstraintPackingSolverV2, benchmarkCase, 'SPACE', frontend, { compact: true });
    const v23 = await solveAndEvaluate(HybridConstraintPackingSolverV23, benchmarkCase, 'SPACE', frontend, { compact: true });
    const repeat = repeatDeterminism
      ? await solveAndHash(HybridConstraintPackingSolverV23, benchmarkCase, 'SPACE')
      : { placementHash: v23.placementHash };
    rows.push({
      id: benchmarkCase.id,
      seed: benchmarkCase.seed,
      scenario: benchmarkCase.scenario,
      challengeClass: benchmarkCase.challengeClass || benchmarkCase.scenario,
      dataClassification: benchmarkCase.dataClassification,
      v21,
      v23: {
        ...v23,
        determinism: {
          firstHash: v23.placementHash,
          repeatHash: repeat.placementHash,
          pass: v23.placementHash === repeat.placementHash
        }
      },
      delta: compareEvaluations(v21, v23)
    });
  }
  return {
    corpusId,
    caseCount: rows.length,
    challengeClasses: [...new Set(rows.map((row) => row.challengeClass))],
    requiredChallengeClasses: corpusId === 'COMPETITION_2_3_DETERMINISTIC' ? [...CHALLENGE_CLASSES] : undefined,
    summary: summarizeSynthetic(rows),
    rows
  };
}

async function runTinyOracle({ count, frontend, repeatDeterminism, onProgress }) {
  const rows = [];
  const cases = buildTinyOracleCases(count);
  for (let index = 0; index < cases.length; index++) {
    const benchmarkCase = cases[index];
    onProgress(`tiny ${index + 1}/${cases.length} ${benchmarkCase.id}`);
    const oracleStarted = Date.now();
    const oracle = solveTinyFloorPacking(benchmarkCase.cargoList, benchmarkCase.container);
    const oracleMs = Date.now() - oracleStarted;
    const oracleLayout = analyzeLayoutQuality({ placements: oracle.placements, container: benchmarkCase.container, cargoList: benchmarkCase.cargoList });
    const oracleOperation = analyzeOperationFeasibility({ placements: oracle.placements, container: benchmarkCase.container });
    const v23 = await solveAndEvaluate(HybridConstraintPackingSolverV23, benchmarkCase, 'SPACE', frontend, { compact: true });
    const repeat = repeatDeterminism
      ? await solveAndHash(HybridConstraintPackingSolverV23, benchmarkCase, 'SPACE')
      : { placementHash: v23.placementHash };
    rows.push({
      id: benchmarkCase.id,
      seed: benchmarkCase.seed,
      oracle: {
        exact: oracle.exact,
        model: oracle.model,
        exploredStateCount: oracle.exploredStateCount,
        solveMs: oracleMs,
        loadedCount: oracle.loadedCount,
        loadedVolume: oracle.loadedVolume,
        placementHash: placementHash(oracle.placements),
        internalVoidVolume: oracleLayout.internalVoidVolume,
        lowFillInteriorSliceCount: oracleLayout.lowFillInteriorSliceCount,
        operationBlockedCount: oracleOperation.blockedCount,
        operationPathPass: oracleOperation.operationPathPass
      },
      v23: {
        ...v23,
        determinism: {
          firstHash: v23.placementHash,
          repeatHash: repeat.placementHash,
          pass: v23.placementHash === repeat.placementHash
        }
      },
      loadedCountGap: v23.loadedCount - oracle.loadedCount,
      internalVoidGap: v23.layoutQuality.internalVoidVolume - oracleLayout.internalVoidVolume
    });
  }
  const exactLoadedMatches = rows.filter((row) => row.loadedCountGap === 0).length;
  const worseLoadedCases = rows.filter((row) => row.loadedCountGap < 0);
  const operationConstrainedGaps = worseLoadedCases.filter((row) => row.oracle.operationBlockedCount > 0 && row.v23.frontendOperation.blockedCount === 0);
  const unexplainedLoadedGaps = worseLoadedCases.filter((row) => row.oracle.operationBlockedCount === 0);
  return {
    model: 'PORTCUBE_TINY_FLOOR_ORACLE',
    caseCount: rows.length,
    exactLoadedMatches,
    exactLoadedMatchRate: ratio(exactLoadedMatches, rows.length),
    totalLoadedCountGap: sum(rows, (row) => row.loadedCountGap),
    worstLoadedCountGap: rows.reduce((minimum, row) => Math.min(minimum, row.loadedCountGap), 0),
    worseLoadedCaseIds: worseLoadedCases.map((row) => row.id),
    operationConstrainedGapCaseIds: operationConstrainedGaps.map((row) => row.id),
    unexplainedLoadedGapCaseIds: unexplainedLoadedGaps.map((row) => row.id),
    deterministicCases: rows.filter((row) => row.v23.determinism.pass).length,
    rows
  };
}

async function solveAndEvaluate(Solver, benchmarkCase, strategy, frontend, { compact = false } = {}) {
  const startedAt = Date.now();
  const result = await new Solver().generatePackingPlan(benchmarkCase.cargoList, benchmarkCase.container, { strategy });
  const wallMs = Date.now() - startedAt;
  const placements = result.loadedCargo || [];
  const layoutQuality = analyzeLayoutQuality({ placements, container: benchmarkCase.container, cargoList: benchmarkCase.cargoList });
  const securing = analyzeSecuring({ placements, container: benchmarkCase.container, layoutQuality });
  const canonicalOperation = analyzeOperationFeasibility({ placements, container: benchmarkCase.container });
  const frontendReplay = replayFrontendOperation(placements, benchmarkCase.container, frontend.OperationMachine);
  const evaluation = {
    algorithm: result.metrics?.algorithm || result._algorithmId || Solver.name,
    selectedCandidateAlgorithm: result.metrics?.selectedCandidateAlgorithm || result.metrics?.algorithm || result._algorithmId,
    strategy,
    placementHash: placementHash(placements),
    loadedCount: number(result.metrics?.loadedCount ?? placements.length),
    unloadedCount: number(result.metrics?.unloadedCount ?? result.unloadedCargo?.length),
    loadedVolume: number(result.metrics?.loadedVolume),
    volumeUtilization: number(result.metrics?.volumeUtilization ?? result.spaceUtilization),
    loadedWeight: number(result.metrics?.loadedWeight ?? result.totalWeight),
    solveMs: number(result.metrics?.solveMs ?? wallMs),
    wallMs,
    cog: result.metrics?.cog || {},
    stability: result.metrics?.stability || compactStability(result.validator?.stability),
    validator: {
      status: result.validator?.status,
      valid: Boolean(result.validator?.valid ?? result.validator?.status === 'VALID'),
      hardViolationCount: number(result.validator?.hardViolationCount),
      lifo: Boolean(result.validator?.checks?.lifo),
      insertion: Boolean(result.validator?.checks?.insertion)
    },
    layoutQuality: withoutLargeDetails(layoutQuality),
    securing: compactSecuring(securing),
    canonicalOperation: compactOperation(canonicalOperation),
    frontendOperation: frontendReplay,
    operationCost: number(result.metrics?.operation?.totalCost),
    legacyCompactness: result.metrics?.compactness || null,
    crossSectionReport: compact ? undefined : layoutQuality.crossSectionReport
  };
  if (compact) delete evaluation.crossSectionReport;
  return evaluation;
}

async function solveAndHash(Solver, benchmarkCase, strategy) {
  const result = await new Solver().generatePackingPlan(benchmarkCase.cargoList, benchmarkCase.container, { strategy });
  return { placementHash: placementHash(result.loadedCargo || []), loadedCount: number(result.metrics?.loadedCount) };
}

function replayFrontendOperation(placements, container, OperationMachine) {
  const machine = new OperationMachine({ loadedCargo: placements, containerInfo: container });
  const blocked = [];
  const maximumSteps = Math.max(20, machine.queue.length * 20 + 20);
  let steps = 0;
  while (machine.phase !== 'COMPLETED' && steps < maximumSteps) {
    const snapshot = machine.stepForward();
    steps += 1;
    if (snapshot.phase === 'BLOCKED') {
      blocked.push({
        step: snapshot.currentIndex + 1,
        cargoId: snapshot.currentCargo?.cargoId,
        reasons: snapshot.blockedReasons
      });
      machine.skipCurrent();
    }
  }
  return {
    model: 'WEB_OPERATION_MACHINE_V2_3_SHARED_GEOMETRY',
    completed: machine.phase === 'COMPLETED',
    completedCount: machine.completedIndices.length,
    total: machine.queue.length,
    blockedCount: blocked.length,
    firstBlocked: blocked[0] || null,
    blocked,
    machineSteps: steps
  };
}

function evaluatePromotion({ project, challengeSynthetic, tinyOracle }) {
  const datasetA = project['DATASET-A-212'];
  const datasetB = project['DATASET-B-MIXED-69'];
  const aSpace = datasetA.strategies.SPACE;
  const baseline = aSpace.v21;
  const challenger = aSpace.v23;
  const internalVoidImprovementPercent = percentImprovement(baseline.layoutQuality.internalVoidVolume, challenger.layoutQuality.internalVoidVolume);
  const lowFillReductionPercent = percentImprovement(baseline.layoutQuality.lowFillInteriorSliceCount, challenger.layoutQuality.lowFillInteriorSliceCount);
  const projectCore = Object.values(project).every((dataset) => Object.values(dataset.strategies).every(({ v23 }) => coreGate(v23)));
  const gates = {
    datasetALoaded212: challenger.loadedCount === 212,
    zeroHardViolations: challenger.validator.hardViolationCount === 0,
    zeroStabilityInvalid: number(challenger.stability?.invalidCount) === 0,
    zeroActualOperationBlocked: challenger.frontendOperation.blockedCount === 0 && challenger.canonicalOperation.blockedCount === 0,
    lifoAndAccessPass: challenger.validator.lifo && challenger.validator.insertion,
    internalVoidImprovementAtLeast30Percent: internalVoidImprovementPercent >= 30,
    lowFillInteriorSlicesReducedAtLeast50Percent: lowFillReductionPercent >= 50,
    largestContiguousReserveNotWorse: challenger.layoutQuality.largestContiguousReserve >= baseline.layoutQuality.largestContiguousReserve,
    cogWithinPolicy: challenger.cog?.withinPolicy !== false,
    datasetARuntimeBelow10Seconds: challenger.wallMs < 10000,
    challengeCorpusHas50To80Cases: challengeSynthetic.caseCount >= 50 && challengeSynthetic.caseCount <= 80,
    challengeClassesCovered: CHALLENGE_CLASSES.every((entry) => challengeSynthetic.challengeClasses.includes(entry)),
    deterministicProjectAndChallenge: Object.values(project).every((dataset) => Object.values(dataset.strategies).every(({ v23 }) => v23.determinism.pass))
      && challengeSynthetic.summary.deterministicCases === challengeSynthetic.caseCount,
    tinyOracleCaseCount15To30: tinyOracle.caseCount >= 15 && tinyOracle.caseCount <= 30
  };
  return {
    decision: Object.values(gates).every(Boolean) ? 'PROMOTE_HYBRID_V2_3' : 'REJECT_HYBRID_V2_3',
    gates,
    evidence: {
      internalVoidImprovementPercent,
      preferredInternalVoidImprovement50PercentReached: internalVoidImprovementPercent >= 50,
      lowFillReductionPercent,
      largestReserveDelta: challenger.layoutQuality.largestContiguousReserve - baseline.layoutQuality.largestContiguousReserve,
      datasetARuntimeMs: challenger.wallMs,
      datasetASelectedCandidate: challenger.selectedCandidateAlgorithm,
      allProjectStrategiesCorePass: projectCore,
      datasetBCorePass: Object.values(datasetB.strategies).every(({ v23 }) => coreGate(v23)),
      challengeSuccessRate: challengeSynthetic.summary.corePassRate,
      tinyOracleLoadedMatchRate: tinyOracle.exactLoadedMatchRate
    }
  };
}

function coreGate(result) {
  return result.validator.hardViolationCount === 0
    && number(result.stability?.invalidCount) === 0
    && result.canonicalOperation.blockedCount === 0
    && result.frontendOperation.blockedCount === 0
    && result.validator.lifo
    && result.validator.insertion
    && result.cog?.withinPolicy !== false;
}

function compareEvaluations(v21, v23) {
  return {
    loadedCount: v23.loadedCount - v21.loadedCount,
    loadedVolume: v23.loadedVolume - v21.loadedVolume,
    internalVoidVolume: v23.layoutQuality.internalVoidVolume - v21.layoutQuality.internalVoidVolume,
    internalVoidImprovementPercent: percentImprovement(v21.layoutQuality.internalVoidVolume, v23.layoutQuality.internalVoidVolume),
    lowFillInteriorSliceCount: v23.layoutQuality.lowFillInteriorSliceCount - v21.layoutQuality.lowFillInteriorSliceCount,
    lowFillReductionPercent: percentImprovement(v21.layoutQuality.lowFillInteriorSliceCount, v23.layoutQuality.lowFillInteriorSliceCount),
    largestContiguousReserve: v23.layoutQuality.largestContiguousReserve - v21.layoutQuality.largestContiguousReserve,
    occupiedDepth: v23.layoutQuality.occupiedDepth - v21.layoutQuality.occupiedDepth,
    actualOperationBlocked: v23.frontendOperation.blockedCount - v21.frontendOperation.blockedCount,
    solveMs: v23.wallMs - v21.wallMs
  };
}

function summarizeSynthetic(rows) {
  const corePassCases = rows.filter((row) => coreGate(row.v23)).length;
  const hardViolationCases = rows.filter((row) => row.v23.validator.hardViolationCount > 0).length;
  const stabilityInvalidCases = rows.filter((row) => number(row.v23.stability?.invalidCount) > 0).length;
  const operationBlockedCases = rows.filter((row) => row.v23.frontendOperation.blockedCount > 0 || row.v23.canonicalOperation.blockedCount > 0).length;
  const deterministicCases = rows.filter((row) => row.v23.determinism.pass).length;
  return {
    corePassCases,
    corePassRate: ratio(corePassCases, rows.length),
    hardViolationCases,
    stabilityInvalidCases,
    operationBlockedCases,
    cogPolicyFailureCases: rows.filter((row) => row.v23.cog?.withinPolicy === false).length,
    deterministicCases,
    deterministicRate: ratio(deterministicCases, rows.length),
    v21LoadedCount: sum(rows, (row) => row.v21.loadedCount),
    v23LoadedCount: sum(rows, (row) => row.v23.loadedCount),
    loadedCountDelta: sum(rows, (row) => row.delta.loadedCount),
    averageInternalVoidImprovementPercent: average(rows, (row) => row.delta.internalVoidImprovementPercent),
    voidImprovedCases: rows.filter((row) => row.delta.internalVoidVolume < 0).length,
    averageV21RuntimeMs: average(rows, (row) => row.v21.wallMs),
    averageV23RuntimeMs: average(rows, (row) => row.v23.wallMs),
    maximumV23RuntimeMs: rows.reduce((maximum, row) => Math.max(maximum, row.v23.wallMs), 0)
  };
}

function withoutLargeDetails(layoutQuality) {
  const { crossSectionReport: _crossSectionReport, gapClassifications, ...summary } = layoutQuality;
  return { ...summary, gapClassificationCount: gapClassifications?.length || 0 };
}

function compactSecuring(securing) {
  return {
    model: securing.model,
    status: securing.status,
    required: securing.required,
    securingRequiredCount: securing.securingRequiredCount,
    requiredCargoIds: securing.requiredCargoIds,
    securingPlaneCount: securing.securingPlaneCount,
    fragmentedSecuringZones: securing.fragmentedSecuringZones,
    zones: securing.zones,
    policy: securing.policy,
    limitations: securing.limitations
  };
}

function compactOperation(operation) {
  return {
    model: operation.model,
    operationPathPass: operation.operationPathPass,
    blockedCount: operation.blockedCount,
    blockedCargoIds: operation.blockedCargoIds,
    reasons: operation.reasons,
    policy: operation.policy
  };
}

function compactStability(stability) {
  if (!stability) return null;
  return {
    model: stability.model,
    status: stability.status,
    invalidCount: stability.invalidCount,
    warningCount: stability.warningCount,
    ...(stability.summary || {}),
    policy: stability.policy
  };
}

function readHistoricalBaseline(outputDirectory) {
  const baselinePath = path.join(outputDirectory, 'v2.1-baseline.json');
  if (!fs.existsSync(baselinePath)) return { status: 'MISSING', path: baselinePath };
  const report = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const datasetA = report.datasets?.['DATASET-A-212'];
  return {
    status: 'PRESERVED_PRE_FIX_BASELINE',
    path: baselinePath,
    generatedAt: report.generatedAt,
    solver: report.solver,
    datasetAActualOperationBlocked: Object.fromEntries(STRATEGIES.map((strategy) => [strategy, datasetA?.strategies?.[strategy]?.actualOperationBlockedCount])),
    datasetAFirstBlocked: Object.fromEntries(STRATEGIES.map((strategy) => [strategy, datasetA?.strategies?.[strategy]?.actualOperationFirstBlocked || null])),
    note: 'The final benchmark recomputes current layout metrics from V2.1 placements while this artifact preserves the pre-fix web replay evidence.'
  };
}

async function loadFrontendOperationRuntime() {
  const operationMachinePath = path.resolve(__dirname, '../../web-dashboard/src/three/operation/operationMachine.js');
  return import(pathToFileURL(operationMachinePath).href);
}

function appendCrossSections(rows, dataset, strategy, solver, report = []) {
  for (const row of report || []) rows.push({ dataset, strategy, solver, ...row });
}

function crossSectionCsv(rows) {
  const headers = ['dataset', 'strategy', 'solver', 'sliceIndex', 'slicePosition', 'sliceStart', 'sliceEnd', 'fillRatio', 'occupiedArea', 'internalVoid', 'fragmentationDelta'];
  return rowsToCsv(headers, rows);
}

function syntheticCsv(rows) {
  const flat = rows.map((row) => ({
    id: row.id,
    seed: row.seed,
    scenario: row.scenario,
    challengeClass: row.challengeClass,
    v21Loaded: row.v21.loadedCount,
    v23Loaded: row.v23.loadedCount,
    loadedDelta: row.delta.loadedCount,
    v21InternalVoid: row.v21.layoutQuality.internalVoidVolume,
    v23InternalVoid: row.v23.layoutQuality.internalVoidVolume,
    internalVoidImprovementPercent: row.delta.internalVoidImprovementPercent,
    v23Hard: row.v23.validator.hardViolationCount,
    v23StabilityInvalid: row.v23.stability?.invalidCount,
    v23CanonicalBlocked: row.v23.canonicalOperation.blockedCount,
    v23FrontendBlocked: row.v23.frontendOperation.blockedCount,
    v23CogPolicy: row.v23.cog?.withinPolicy,
    deterministic: row.v23.determinism.pass,
    v21RuntimeMs: row.v21.wallMs,
    v23RuntimeMs: row.v23.wallMs
  }));
  return rowsToCsv(Object.keys(flat[0] || {}), flat);
}

function tinyOracleCsv(rows) {
  const flat = rows.map((row) => ({
    id: row.id,
    seed: row.seed,
    oracleLoaded: row.oracle.loadedCount,
    v23Loaded: row.v23.loadedCount,
    loadedCountGap: row.loadedCountGap,
    oracleInternalVoid: row.oracle.internalVoidVolume,
    oracleOperationBlocked: row.oracle.operationBlockedCount,
    v23InternalVoid: row.v23.layoutQuality.internalVoidVolume,
    internalVoidGap: row.internalVoidGap,
    oracleStates: row.oracle.exploredStateCount,
    oracleMs: row.oracle.solveMs,
    v23Ms: row.v23.wallMs,
    deterministic: row.v23.determinism.pass
  }));
  return rowsToCsv(Object.keys(flat[0] || {}), flat);
}

function rowsToCsv(headers, rows) {
  return `${headers.join(',')}\n${rows.map((row) => headers.map((header) => csv(row[header])).join(',')).join('\n')}\n`;
}

function csv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function percentImprovement(before, after) {
  const baseline = number(before);
  if (baseline <= 0) return after <= 0 ? 0 : -100;
  return (baseline - number(after)) / baseline * 100;
}

function average(rows, selector) { return rows.length ? sum(rows, selector) / rows.length : 0; }
function sum(rows, selector) { return rows.reduce((total, row) => total + number(selector(row)), 0); }
function ratio(numerator, denominator) { return denominator ? numerator / denominator : 0; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

if (require.main === module) {
  runPhysicalPackingBenchmark({ onProgress: (message) => process.stderr.write(`[benchmark] ${message}\n`) })
    .then((paths) => process.stdout.write(`${JSON.stringify({
      decision: paths.report.promotion.decision,
      gates: paths.report.promotion.gates,
      evidence: paths.report.promotion.evidence,
      fixedSynthetic: paths.report.synthetic.fixed.summary,
      challengeSynthetic: paths.report.synthetic.challenge.summary,
      tinyOracle: {
        caseCount: paths.report.tinyOracle.caseCount,
        exactLoadedMatchRate: paths.report.tinyOracle.exactLoadedMatchRate,
        worseLoadedCaseIds: paths.report.tinyOracle.worseLoadedCaseIds
      },
      elapsedMs: paths.report.elapsedMs,
      paths: {
        json: paths.jsonPath,
        crossSections: paths.crossSectionCsvPath,
        synthetic: paths.syntheticCsvPath,
        tinyOracle: paths.tinyOracleCsvPath
      }
    }, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  runPhysicalPackingBenchmark,
  evaluatePromotion,
  replayFrontendOperation,
  summarizeSynthetic
};
