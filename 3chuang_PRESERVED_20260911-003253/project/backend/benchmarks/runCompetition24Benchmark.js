'use strict';

const fs = require('fs');
const path = require('path');
const HybridConstraintPackingSolverV24 = require('../services/HybridConstraintPackingSolverV24');
const { buildProjectBenchmarkCases } = require('./projectBenchmarkCases');
const { buildSyntheticBenchmarkCases } = require('./solverBenchmarkCases');
const { buildPhysicalPackingChallengeCases, CHALLENGE_CLASSES } = require('./physicalPackingChallengeCases');
const { buildTinyOracleCases } = require('./tinyOracleCases');
const { solveTinyFloorPacking } = require('./TinyFloorPackingOracle');
const { analyzeOperationFeasibility } = require('../services/packing/CanonicalOperationFeasibility');
const { evaluateAdmission } = require('../services/realworld/AdmissionPrecheckEngine');
const { resolveRules } = require('../services/realworld/RuleRegistry');

const STRATEGIES = ['SPACE', 'BALANCE', 'OPERATION'];

async function runCompetition24Benchmark({
  outputDirectory = path.resolve(__dirname, '../../artifacts/competition-2.4'),
  fixedCaseCount = 48, challengeCaseCount = 64, tinyCaseCount = 20, multiportCaseCount = 24,
  repeatDeterminism = true, concurrency = 2, onProgress = () => {}
} = {}) {
  const startedAt = Date.now();
  const projectCases = await buildProjectBenchmarkCases();
  const project = {};
  for (const benchmarkCase of projectCases) {
    project[benchmarkCase.id] = { label: benchmarkCase.label, strategies: {} };
    for (const strategy of STRATEGIES) {
      onProgress(`project ${benchmarkCase.id} ${strategy}`);
      const first = await solveCase(benchmarkCase, strategy);
      const repeat = repeatDeterminism ? await solveCase(benchmarkCase, strategy, true) : first;
      project[benchmarkCase.id].strategies[strategy] = { ...first, determinism: { firstHash: first.placementHash, repeatHash: repeat.placementHash, pass: first.placementHash === repeat.placementHash } };
    }
  }

  const fixedCases = buildSyntheticBenchmarkCases(fixedCaseCount);
  const challengeCases = buildPhysicalPackingChallengeCases(challengeCaseCount);
  const multiportCases = buildMultiportCases(multiportCaseCount);
  const fixed = await runCorpus('FIXED', fixedCases, { repeatDeterminism, concurrency, onProgress });
  const challenge = await runCorpus('CHALLENGE', challengeCases, { repeatDeterminism, concurrency, onProgress });
  const multiport = await runCorpus('MULTIPORT', multiportCases, { repeatDeterminism, concurrency, onProgress });
  const tiny = await runTinyCorpus(buildTinyOracleCases(tinyCaseCount), { repeatDeterminism, concurrency, onProgress });
  const admission = runAdmissionRuleCases();
  const gates = buildGates({ project, fixed, challenge, tiny, multiport, admission, fixedCaseCount, challengeCaseCount, tinyCaseCount, multiportCaseCount });
  const report = {
    benchmarkId: 'PORTCUBE-COMPETITION-2.4-REAL-WORLD-BENCHMARK', generatedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt,
    solver: 'hybrid-v2.4', coordinateContract: { lengthAxis: 'x', gravityAxis: 'y', widthAxis: 'z', doorSide: 'higher x coordinate' },
    dataClassification: { project: 'DEMO_DATA', fixed: 'SYNTHETIC_BENCHMARK', challenge: 'SYNTHETIC_BENCHMARK', tiny: 'SYNTHETIC_EXACT_ORACLE', multiport: 'SYNTHETIC_MULTIPORT', admission: 'DETERMINISTIC_RULE_CASES' },
    project, corpora: { fixed, challenge, tiny, multiport }, admission, gates,
    decision: Object.values(gates).every(Boolean) ? 'PORTCUBE_COMPETITION_2_4_FINAL_FREEZE' : 'READY_WITH_LIMITATIONS'
  };
  fs.mkdirSync(outputDirectory, { recursive: true });
  const jsonPath = path.join(outputDirectory, 'competition-2.4-benchmark.json');
  const csvPath = path.join(outputDirectory, 'competition-2.4-cases.csv');
  const admissionPath = path.join(outputDirectory, 'competition-2.4-admission-cases.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(csvPath, corpusCsv([...fixed.rows, ...challenge.rows, ...tiny.rows, ...multiport.rows]), 'utf8');
  fs.writeFileSync(admissionPath, `${JSON.stringify(admission, null, 2)}\n`, 'utf8');
  return { report, jsonPath, csvPath, admissionPath };
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
      acceptPlacements: (placements) => analyzeOperationFeasibility({
        placements,
        container: benchmarkCase.container
      }).blockedCount === 0
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

async function solveCase(benchmarkCase, strategy, hashOnly = false) {
  const startedAt = Date.now();
  const result = await new HybridConstraintPackingSolverV24().generatePackingPlan(benchmarkCase.cargoList, benchmarkCase.container, {
    strategy, caseContext: { caseDate: '2026-08-24', route: routeFor(benchmarkCase.cargoList) }
  });
  const row = {
    strategy, wallMs: Date.now() - startedAt, placementHash: result.placementHash, candidateId: result.candidateId,
    selectedCandidateAlgorithm: result.sourceAlgorithm, loadedCount: result.loadedCargo.length, unloadedCount: result.unloadedCargo.length,
    hardViolationCount: number(result.validator?.hardViolationCount), operationBlockedCount: number(result.operationFeasibility?.blockedCount),
    portAccessStatus: result.portAccessibility?.status, portAccessBlockedCount: number(result.portAccessibility?.blockedCount),
    rehandleCount: number(result.portAccessibility?.rehandleCount), postUnloadStabilityPass: Boolean(result.portAccessibility?.postUnloadStabilityPass),
    stabilityInvalidCount: number(result.metrics?.stability?.invalidCount), lifoPass: Boolean(result.validator?.checks?.lifo), insertionPass: Boolean(result.validator?.checks?.insertion),
    lateralCogPercent: number(result.loadDistribution?.centreOfGravity?.lateralOffsetPercent), longitudinalCogPercent: number(result.loadDistribution?.centreOfGravity?.longitudinalOffsetPercent),
    cogGuidanceStatus: result.loadDistribution?.centreOfGravity?.guidanceStatus, internalVoidVolume: number(result.layoutQuality?.internalVoidVolume),
    derivedTeamManualCount: result.handlingAssumptions?.length || 0
  };
  return hashOnly ? { placementHash: row.placementHash } : row;
}

function buildMultiportCases(count) {
  return buildSyntheticBenchmarkCases(Math.max(count, 24)).slice(0, count).map((entry, caseIndex) => ({
    ...entry, id: `MULTIPORT-${String(caseIndex + 1).padStart(2, '0')}`, scenario: 'DEDICATED_THREE_PORT_UNLOAD',
    cargoList: entry.cargoList.map((cargo, skuIndex) => {
      const portSequence = skuIndex % 3 + 1;
      return { ...cargo, portSequence, destinationPort: ['Hamburg', 'Rotterdam', 'Antwerp'][portSequence - 1], batchId: `MP-${caseIndex + 1}-${portSequence}` };
    })
  }));
}

function runAdmissionRuleCases() {
  const placements = [{ cargoId: 'C1', x: 5016, y: 0, z: 676, l: 2000, h: 800, w: 1000, weight: 1000, portSequence: 1, handlingMethod: 'forklift', packagingType: 'carton' }];
  const cargoList = [{ cargoId: 'C1', length: 2000, width: 1000, height: 800, weight: 1000, quantity: 1, portSequence: 1, packagingType: 'carton' }];
  const common = { containerType: '40GP', cargoList, placements, caseContext: { caseDate: '2026-08-24', terminal: 'NBSCT', carrier: 'UNKNOWN', voyage: 'UNKNOWN', route: [{ portSequence: 1, portCode: 'HAM' }] } };
  const cases = [
    admissionCase('MISSING_VGM', common, (result) => result.domains.massAndVGM.normalizedStatus === 'DATA_REQUIRED'),
    admissionCase('REFERENCE_CSC', common, (result) => result.domains.csc.status === 'DATA_REQUIRED'),
    admissionCase('OVER_MAX_GROSS', { ...common, massEvidence: zeroMass(), vgm: { declaredVGMKg: 33000, method: 'METHOD_1', shipperDeclaration: true, verifiedEvidence: true } }, (result) => result.overallStatus === 'BLOCKED'),
    admissionCase('DG_DATA_REQUIRED', { ...common, cargoList: [{ ...cargoList[0], dangerous: true }] }, (result) => result.domains.dangerousGoods.normalizedStatus === 'DATA_REQUIRED'),
    admissionCase('WOOD_MARK_REQUIRED', { ...common, cargoList: [{ ...cargoList[0], wooden: true, packagingType: 'solid raw wood crate' }] }, (result) => result.domains.woodPackaging.normalizedStatus === 'DATA_REQUIRED'),
    admissionCase('SECURING_DATA_REQUIRED', common, (result) => result.domains.transportSecuring.normalizedStatus === 'DATA_REQUIRED'),
    admissionCase('TERMINAL_EXTERNAL', common, (result) => result.domains.terminalAndVoyage.status === 'EXTERNAL_CONFIRMATION_REQUIRED'),
    admissionCase('FUTURE_RULE_NOT_ACTIVE', common, (result) => !result.ruleRegistry.activeRuleIds.includes('CN-GACC-ORDER-283-2026')),
    admissionCase('DRAFT_RULE_NOT_ACTIVE', common, (result) => !result.ruleRegistry.activeRuleIds.includes('CTU-REVISION-2025-DRAFT')),
    admissionCase('ACTUAL_CSC_EXPIRED', { ...common, containerMode: 'ACTUAL_CONTAINER', actualContainer: actualContainer({ nextExaminationDate: '2026-01-01' }) }, (result) => result.domains.csc.normalizedStatus === 'BLOCKED'),
    admissionCase('ACTUAL_COMPLETE_STILL_EXTERNAL', { ...common, containerMode: 'ACTUAL_CONTAINER', actualContainer: actualContainer(), massEvidence: zeroMass(), vgm: { declaredVGMKg: 4630, measuredGrossMassKg: 4630, method: 'METHOD_1', shipperDeclaration: true, verifiedEvidence: true } }, (result) => result.domains.terminalAndVoyage.normalizedStatus === 'CONDITIONAL')
  ];
  return { caseCount: cases.length, passCount: cases.filter((entry) => entry.pass).length, rows: cases, ruleSnapshot: resolveRules({ caseDate: '2026-08-24' }).map((rule) => ({ id: rule.id, status: rule.resolvedStatus, level: rule.level })) };
}

function admissionCase(id, input, assertion) { const result = evaluateAdmission(input); return { id, pass: Boolean(assertion(result)), overallStatus: result.overallStatus, decision: result.decision, domainStatuses: Object.fromEntries(Object.entries(result.domains).map(([key, value]) => [key, { status: value.status, normalizedStatus: value.normalizedStatus }])) }; }
function actualContainer(overrides = {}) { return { containerNumber: 'MSKU1234565', innerLength: 12032, innerWidth: 2352, innerHeight: 2393, doorWidth: 2340, doorHeight: 2280, tare: 3630, maxGross: 32500, cscPlateReference: 'CSC-EVIDENCE-01', nextExaminationDate: '2027-01-01', ...overrides }; }
function zeroMass() { return { packagingMassKg: 0, palletMassKg: 0, dunnageMassKg: 0, securingMassKg: 0 }; }

function summarizeCorpus(corpusId, rows) {
  return {
    corpusId, caseCount: rows.length, rows,
    hardGatePassCount: rows.filter(coreGate).length, deterministicCount: rows.filter((row) => row.determinismPass).length,
    fullUnloadPassCount: rows.filter((row) => row.portAccessStatus === 'FULL_UNLOAD_PASS').length,
    postUnloadStabilityPassCount: rows.filter((row) => row.postUnloadStabilityPass).length,
    zeroRehandleCount: rows.filter((row) => row.rehandleCount === 0).length,
    maximumWallMs: Math.max(0, ...rows.map((row) => row.wallMs)),
    failureIds: rows.filter((row) => !coreGate(row)).map((row) => row.id)
  };
}

function buildGates({ project, fixed, challenge, tiny, multiport, admission, fixedCaseCount, challengeCaseCount, tinyCaseCount, multiportCaseCount }) {
  const a = project['DATASET-A-212']?.strategies?.SPACE;
  const b = project['DATASET-B-MIXED-69']?.strategies?.SPACE;
  const projectRows = Object.values(project).flatMap((dataset) => Object.values(dataset.strategies));
  return {
    datasetA212Preserved: a?.loadedCount === 212 && coreGate(a),
    datasetAV23PhysicalCoreSelected: a?.selectedCandidateAlgorithm === 'hybrid-v2.3',
    datasetB69Loaded: b?.loadedCount === 69 && coreGate(b),
    datasetBWithinGeneralCogGuidance: b?.cogGuidanceStatus === 'WITHIN_GENERAL_GUIDANCE',
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
    admissionRuleCasesPass: admission.passCount === admission.caseCount
  };
}

function coreGate(row) { return row.hardViolationCount === 0 && row.operationBlockedCount === 0 && row.portAccessBlockedCount === 0 && row.portAccessStatus === 'FULL_UNLOAD_PASS' && row.postUnloadStabilityPass && row.stabilityInvalidCount === 0 && row.lifoPass && row.insertionPass; }
function routeFor(cargoList) { return [...new Set(cargoList.map((cargo) => number(cargo.portSequence || 1)))].sort((a, b) => a - b).map((portSequence) => ({ portSequence, portCode: ['HAM', 'RTM', 'ANR'][portSequence - 1] || `P${portSequence}` })); }
async function mapLimit(values, limit, mapper) { const rows = new Array(values.length); let cursor = 0; const workers = Array.from({ length: Math.max(1, limit) }, async () => { while (cursor < values.length) { const index = cursor++; rows[index] = await mapper(values[index], index); } }); await Promise.all(workers); return rows; }
function corpusCsv(rows) { const keys = ['corpusId', 'id', 'scenario', 'strategy', 'candidateId', 'selectedCandidateAlgorithm', 'loadedCount', 'unloadedCount', 'hardViolationCount', 'operationBlockedCount', 'portAccessStatus', 'portAccessBlockedCount', 'rehandleCount', 'postUnloadStabilityPass', 'stabilityInvalidCount', 'lifoPass', 'insertionPass', 'cogGuidanceStatus', 'lateralCogPercent', 'longitudinalCogPercent', 'placementHash', 'determinismPass', 'wallMs']; return `${keys.join(',')}\n${rows.map((row) => keys.map((key) => csv(row[key])).join(',')).join('\n')}\n`; }
function csv(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

if (require.main === module) {
  runCompetition24Benchmark({ onProgress: (message) => process.stdout.write(`${message}\n`) })
    .then(({ report, jsonPath, csvPath, admissionPath }) => process.stdout.write(`${JSON.stringify({ decision: report.decision, gates: report.gates, elapsedMs: report.elapsedMs, jsonPath, csvPath, admissionPath }, null, 2)}\n`))
    .catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
}

module.exports = { runCompetition24Benchmark, buildMultiportCases, runAdmissionRuleCases, coreGate };
