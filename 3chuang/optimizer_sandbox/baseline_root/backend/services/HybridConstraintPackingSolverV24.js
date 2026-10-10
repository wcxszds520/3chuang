'use strict';

const crypto = require('crypto');
const HybridConstraintPackingSolverV2 = require('./HybridConstraintPackingSolverV2');
const HybridConstraintPackingSolverV23 = require('./HybridConstraintPackingSolverV23');
const PlanValidator = require('./packing/PlanValidator');
const { calculatePlanMetrics, calculateCoG, normalizeContainer, clamp } = require('./packing/PlanMetrics');
const { analyzeLayoutQuality } = require('./packing/LayoutQualityAnalyzer');
const { analyzeSecuring } = require('./packing/SecuringAnalyzer');
const { analyzeOperationFeasibility, canonicalLoadingSequence, validateActorCargo } = require('./packing/CanonicalOperationFeasibility');
const { analyzeLoadDistribution } = require('./realworld/LoadDistributionAnalyzer');
const { validatePortAccessibility } = require('./realworld/PortAccessibilityValidator');

/**
 * Hybrid V2.4 preserves the V2.3 physical core and adds a bounded deterministic
 * candidate portfolio. Safety/admission evidence ranks before compactness.
 */
class HybridConstraintPackingSolverV24 {
  constructor(config = {}) {
    this.config = { maximumCandidates: 8, ...config };
    this.validator = config.validator || new PlanValidator(config);
  }

  async generatePackingPlan(cargoList = [], containerInput = {}, options = {}) {
    const startedAt = Date.now();
    const container = normalizeContainer(containerInput);
    const strategy = normalizeStrategy(options.strategy);
    const density = densityRegime(cargoList, container);
    const v23 = await new HybridConstraintPackingSolverV23({ enableV21Guardrail: false })
      .generatePackingPlan(cargoList, container, { strategy });
    const v21 = await new HybridConstraintPackingSolverV2({ portfolioGuardrail: false })
      .generatePackingPlan(cargoList, container, { strategy });

    const seeds = [
      seedCandidate('V23_BASE', 'hybrid-v2.3', v23, false),
      seedCandidate('V23_GLOBAL_BALANCE', 'hybrid-v2.3', v23, true),
      seedCandidate('V21_BASE_ASSISTED', 'hybrid-v2.1', v21, false, true),
      seedCandidate('V21_GLOBAL_BALANCE_ASSISTED', 'hybrid-v2.1', v21, true, true)
    ].slice(0, this.config.maximumCandidates);
    const evaluated = seeds.map((seed) => evaluateCandidate({
      ...seed, cargoList, container, strategy, route: options.route || options.caseContext?.route || [], caseContext: options.caseContext || {}, validator: this.validator
    }));
    evaluated.sort((left, right) => comparePlanQualityV24(left, right, strategy));
    const selected = evaluated[0];
    const solveMs = Date.now() - startedAt;
    selected.metrics.solveMs = solveMs;
    selected.metrics.elapsedMs = solveMs;
    selected.metrics.algorithm = 'hybrid-v2.4';
    selected.metrics.solverVersion = '2.4';
    selected.metrics.selectedCandidateAlgorithm = selected.sourceAlgorithm;
    selected.metrics.strategy = strategy;
    selected.metrics.densityRegime = density;
    selected.metrics.loadDistribution = selected.loadDistribution;
    selected.metrics.portAccessibility = selected.portAccessibility;
    selected.constraintMeta = {
      ...(selected.constraintMeta || {}),
      solverVersion: '2.4', officialSolver: 'hybrid-v2.4', densityRegime: density,
      portfolio: {
        maximumCandidates: this.config.maximumCandidates,
        candidatesEvaluated: evaluated.length,
        selectedCandidateId: selected.candidateId,
        selectedCandidateAlgorithm: selected.sourceAlgorithm,
        reason: 'V2_4_SAFETY_FIRST_LEXICOGRAPHIC_SELECTION',
        selectionOrder: selectionOrder(),
        runtimeUsedAsTieBreak: false,
        candidates: evaluated.map(candidateSummary)
      },
      portAccessModel: selected.portAccessibility.model,
      fullUnloadPass: selected.portAccessibility.status === 'FULL_UNLOAD_PASS',
      postUnloadStabilityPass: selected.portAccessibility.postUnloadStabilityPass,
      handlingAssumptions: selected.handlingAssumptions
    };
    selected._algorithmId = 'hybrid-v2.4';
    selected._strategyUsed = strategy.toLowerCase();
    selected.warnings = [...(selected.warnings || [])];
    if (selected.handlingAssumptions.length > 0) selected.warnings.push({
      type: 'DERIVED_TEAM_MANUAL_POLICY',
      message: `${selected.handlingAssumptions.length} 件货物采用可追溯的项目协同人工搬运假设；现场作业方案仍需确认。`,
      evidence: selected.handlingAssumptions
    });
    if (selected.portAccessibility.status !== 'FULL_UNLOAD_PASS') selected.warnings.push({
      type: selected.portAccessibility.status,
      message: '完整港序卸载或卸后稳定性门禁未通过。', evidence: candidatePortSummary(selected.portAccessibility)
    });
    if (selected.loadDistribution.status !== 'WITHIN_GUIDANCE') selected.warnings.push({
      type: 'LOAD_DISTRIBUTION_REVIEW', message: `载荷分布状态：${selected.loadDistribution.status}`, evidence: selected.loadDistribution.centreOfGravity
    });
    return selected;
  }
}

function seedCandidate(candidateId, sourceAlgorithm, result, center, deriveTeamManual = false) {
  const placements = clone(result.loadedCargo || []);
  const handlingAssumptions = deriveTeamManual ? applyDerivedTeamManual(placements) : [];
  return {
    candidateId, sourceAlgorithm, placements, unloadedCargo: clone(result.unloadedCargo || []),
    inheritedWarnings: clone(result.warnings || []), inheritedConstraintMeta: clone(result.constraintMeta || {}),
    handlingAssumptions, translationRequested: center
  };
}

function evaluateCandidate({ candidateId, sourceAlgorithm, placements, unloadedCargo, inheritedWarnings, inheritedConstraintMeta, handlingAssumptions, translationRequested, cargoList, container, strategy, route, caseContext, validator }) {
  const translation = translationRequested ? centerPlan(placements, container) : { shiftX: 0, shiftZ: 0, mode: 'UNCHANGED' };
  renumberLoading(placements, container);
  const validation = validator.validate({ placements, cargoList, container });
  attachStability(placements, validation.stability);
  const operationFeasibility = analyzeOperationFeasibility({ placements, container });
  const portAccessibility = validatePortAccessibility({ placements, container, route, caseContext });
  const layoutQuality = analyzeLayoutQuality({ placements, container, cargoList });
  const securing = analyzeSecuring({ placements, container, layoutQuality });
  const loadDistribution = analyzeLoadDistribution({ placements, container, caseContext });
  const metrics = calculatePlanMetrics(placements, container, unloadedCargo.length, 0);
  metrics.algorithm = 'hybrid-v2.4';
  metrics.solverVersion = '2.4';
  metrics.selectedCandidateAlgorithm = sourceAlgorithm;
  metrics.strategy = strategy;
  metrics.stability = compactStability(validation.stability);
  metrics.layoutQuality = layoutQuality;
  metrics.securing = securing;
  metrics.operationFeasibility = operationFeasibility;
  metrics.cog.withinPolicy = validation.checks.cog.withinPolicy;
  metrics.cog.recommendationStatus = loadDistribution.centreOfGravity.guidanceStatus;
  metrics.operation = { ...metrics.operation, actualBlockedCount: operationFeasibility.blockedCount, actualOperationPass: operationFeasibility.operationPathPass };
  return {
    candidateId, sourceAlgorithm, loadedCargo: placements, unloadedCargo,
    spaceUtilization: metrics.volumeUtilization, totalWeight: metrics.loadedWeight,
    cog: { x: metrics.cog.x, y: metrics.cog.y, z: metrics.cog.z },
    cogOffset: { lateral: metrics.cog.lateral, longitudinal: metrics.cog.longitudinal, direction: metrics.cog.z >= container.innerWidth / 2 ? 'right' : 'left', percentage: metrics.cog.lateral.toFixed(2) },
    metrics, validator: validation, layoutQuality, securing, operationFeasibility, portAccessibility, loadDistribution,
    handlingAssumptions, placementHash: placementHash(placements),
    constraintMeta: { ...inheritedConstraintMeta, translation }, warnings: inheritedWarnings
  };
}

function applyDerivedTeamManual(placements) {
  const assumptions = [];
  for (const item of placements) {
    if (item.handlingMethod !== 'manual' || item.handlingPolicy !== 'derived') continue;
    if (validateActorCargo(item).valid) continue;
    const assisted = { ...item, handlingMethod: 'team_manual' };
    if (!validateActorCargo(assisted).valid) continue;
    item.handlingMethod = 'team_manual';
    item.handlingEvidence = {
      classification: 'PROJECT_POLICY', assumption: 'TEAM_MANUAL_TWO_PERSON_ASSIST',
      limits: { weightKg: 50, lengthMm: 1800, widthMm: 1400, heightMm: 1500 },
      externalConfirmationRequired: true
    };
    assumptions.push({ cargoId: item.cargoId, from: 'manual', to: 'team_manual', evidence: item.handlingEvidence });
  }
  return assumptions;
}

function centerPlan(placements, container) {
  if (placements.length === 0) return { shiftX: 0, shiftZ: 0, mode: 'EMPTY_PLAN' };
  const bounds = placementBounds(placements);
  const cog = calculateCoG(placements, container);
  const minShiftX = -bounds.minX; const maxShiftX = container.innerLength - bounds.maxX;
  const minShiftZ = -bounds.minZ; const maxShiftZ = container.innerWidth - bounds.maxZ;
  const shiftX = round(clamp(container.innerLength / 2 - cog.x, minShiftX, maxShiftX));
  const shiftZ = round(clamp(container.innerWidth / 2 - cog.z, minShiftZ, maxShiftZ));
  for (const item of placements) {
    item.x = round(number(item.x) + shiftX); item.z = round(number(item.z) + shiftZ);
    item.algorithmMeta = { ...(item.algorithmMeta || {}), v24GlobalBalanceShiftX: shiftX, v24GlobalBalanceShiftZ: shiftZ };
  }
  return { shiftX, shiftZ, mode: 'LEGAL_GLOBAL_COG_BALANCE', availableShiftRangeX: [round(minShiftX), round(maxShiftX)], availableShiftRangeZ: [round(minShiftZ), round(maxShiftZ)] };
}

function comparePlanQualityV24(left, right, strategy) {
  const pairs = [
    [number(left.validator?.hardViolationCount), number(right.validator?.hardViolationCount)],
    [number(left.operationFeasibility?.blockedCount), number(right.operationFeasibility?.blockedCount)],
    [number(left.portAccessibility?.blockedCount), number(right.portAccessibility?.blockedCount)],
    [number(left.portAccessibility?.rehandleCount), number(right.portAccessibility?.rehandleCount)],
    [postUnloadInvalid(left), postUnloadInvalid(right)],
    [number(left.metrics?.stability?.invalidCount), number(right.metrics?.stability?.invalidCount)],
    [left.validator?.checks?.lifo && left.validator?.checks?.insertion ? 0 : 1, right.validator?.checks?.lifo && right.validator?.checks?.insertion ? 0 : 1],
    [-number(left.metrics?.loadedCount), -number(right.metrics?.loadedCount)],
    [-number(left.metrics?.loadedVolume), -number(right.metrics?.loadedVolume)],
    [distributionRank(left.loadDistribution), distributionRank(right.loadDistribution)],
    [securingRank(left.securing), securingRank(right.securing)],
    [strategyCost(left, strategy), strategyCost(right, strategy)]
  ];
  for (const [a, b] of pairs) if (Math.abs(a - b) > 1e-9) return a - b;
  return left.placementHash.localeCompare(right.placementHash) || left.candidateId.localeCompare(right.candidateId);
}

function strategyCost(result, strategy) {
  if (strategy === 'BALANCE') return distributionRank(result.loadDistribution) * 1e15 + number(result.layoutQuality?.internalVoidVolume);
  if (strategy === 'OPERATION') return number(result.metrics?.operation?.totalCost) * 1e12 + number(result.layoutQuality?.internalVoidVolume);
  return number(result.layoutQuality?.internalVoidVolume) + number(result.layoutQuality?.lowFillInteriorSliceCount) * 1e12 - number(result.layoutQuality?.largestContiguousReserve) * 0.1;
}

function distributionRank(result) {
  return ({ WITHIN_GENERAL_GUIDANCE: 0, PARTICULAR_CIRCUMSTANCES_REVIEW: 1, OUTSIDE_GUIDANCE: 2 })[result?.centreOfGravity?.guidanceStatus] ?? 3;
}
function securingRank(result) { return ({ SECURING_NOT_REQUIRED: 0, SECURING_REQUIRED: 1, SECURING_UNRESOLVED: 2 })[result?.status] ?? 3; }
function postUnloadInvalid(result) { return (result.portAccessibility?.calls || []).reduce((sum, call) => sum + number(call.postUnloadStability?.invalidCount), 0); }
function selectionOrder() { return ['hard violations', 'canonical operation blocked', 'full-port access blocked', 'future-port rehandle', 'post-unload stability', 'initial stability', 'LIFO/insertion', 'loaded count', 'loaded volume', 'CTU CoG guidance band', 'geometric securing requirement', 'strategy objective', 'deterministic placement hash']; }

function candidateSummary(candidate) {
  return {
    candidateId: candidate.candidateId, sourceAlgorithm: candidate.sourceAlgorithm, placementHash: candidate.placementHash,
    hardViolationCount: number(candidate.validator?.hardViolationCount), operationBlockedCount: number(candidate.operationFeasibility?.blockedCount),
    portAccessBlockedCount: number(candidate.portAccessibility?.blockedCount), rehandleCount: number(candidate.portAccessibility?.rehandleCount),
    postUnloadInvalidCount: postUnloadInvalid(candidate), loadedCount: number(candidate.metrics?.loadedCount),
    loadDistributionStatus: candidate.loadDistribution?.centreOfGravity?.guidanceStatus,
    internalVoidVolume: number(candidate.layoutQuality?.internalVoidVolume), translation: candidate.constraintMeta?.translation
  };
}
function candidatePortSummary(result) { return { status: result.status, blockedCount: result.blockedCount, rehandleCount: result.rehandleCount, postUnloadStabilityPass: result.postUnloadStabilityPass }; }

function renumberLoading(placements, container) {
  const order = new Map(canonicalLoadingSequence(placements, container).map((item, index) => [String(item.cargoId), index + 1]));
  placements.forEach((item) => { item.loadingIndex = order.get(String(item.cargoId)) || 0; });
}
function attachStability(placements, stability) {
  for (const item of placements) {
    const entry = stability?.cargo?.[item.cargoId];
    if (!entry) continue;
    Object.assign(item, { supportRatio: entry.supportRatio, supportMargin: entry.supportMargin, stackStability: entry.stackStability, restraint: entry.restraint, slenderness: entry.slenderness, riskStatus: entry.riskStatus });
  }
}
function compactStability(stability) { return stability ? { model: stability.model, status: stability.status, invalidCount: stability.invalidCount, warningCount: stability.warningCount, ...(stability.summary || {}), policy: stability.policy } : null; }
function placementBounds(items) { return items.reduce((b, item) => ({ minX: Math.min(b.minX, number(item.x)), maxX: Math.max(b.maxX, number(item.x) + number(item.l)), minZ: Math.min(b.minZ, number(item.z)), maxZ: Math.max(b.maxZ, number(item.z) + number(item.w)) }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }); }
function placementHash(items) { return crypto.createHash('sha256').update(JSON.stringify([...items].sort((a, b) => String(a.cargoId).localeCompare(String(b.cargoId))).map((item) => [item.cargoId, round(item.x), round(item.y), round(item.z), round(item.l), round(item.h), round(item.w)]))).digest('hex').slice(0, 16); }
function densityRegime(cargoList, container) { const volume = cargoList.reduce((sum, item) => sum + number(item.length) * number(item.width) * number(item.height) * Math.max(1, number(item.quantity || 1)), 0); const ratio = volume / Math.max(1, container.innerLength * container.innerWidth * container.innerHeight); return ratio >= 0.65 ? 'DENSE' : ratio >= 0.35 ? 'MEDIUM' : 'SPARSE'; }
function normalizeStrategy(value) { const result = String(value || 'SPACE').toUpperCase(); return ['SPACE', 'BALANCE', 'OPERATION'].includes(result) ? result : 'SPACE'; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = HybridConstraintPackingSolverV24;
module.exports.comparePlanQualityV24 = comparePlanQualityV24;
module.exports.centerPlan = centerPlan;
module.exports.applyDerivedTeamManual = applyDerivedTeamManual;
