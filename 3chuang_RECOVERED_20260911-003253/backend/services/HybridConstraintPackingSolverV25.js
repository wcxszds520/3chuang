'use strict';

const crypto = require('crypto');
const PlanValidator = require('./packing/PlanValidator');
const { calculatePlanMetrics, normalizeContainer } = require('./packing/PlanMetrics');
const { analyzeLayoutQuality } = require('./packing/LayoutQualityAnalyzer');
const { analyzeVoidJustification } = require('./packing/VoidJustificationAnalyzer');
const { normalizeCargoList } = require('./packing/PackagingProfile');
const { analyzeSecuring } = require('./packing/SecuringAnalyzer');
const { analyzeOperationFeasibility, canonicalLoadingSequence, validateActorCargo } = require('./packing/CanonicalOperationFeasibility');
const { analyzeLoadDistribution } = require('./realworld/LoadDistributionAnalyzer');
const { validatePortAccessibility } = require('./realworld/PortAccessibilityValidator');

const { solveBackWall } = require('./packing/BackWallSolverPass');
const { rearWallMetrics, exactVoidMetrics } = require('./packing/ExactLayoutMetrics');
class HybridConstraintPackingSolverV25 {
  constructor(config = {}) { this.config = config; this.validator = config.validator || new PlanValidator(config); }
  async generatePackingPlan(cargoInput = [], containerInput = {}, options = {}) {
    const container = normalizeContainer(containerInput);
    const cargoList = normalizeCargoList(cargoInput, { source: options.inputSource || 'LEGACY_INPUT' });
    const strategy = normalizeStrategy(options.strategy);
    const context = { cargoList, container, strategy, route: options.route || options.caseContext?.route || [], caseContext: options.caseContext || {}, validator: this.validator };
    const result = await solveBackWall({ cargoList, container, options: { ...options, strategy }, config: this.config,
      evaluate: seed => evaluateCandidate({ ...seed, ...context }), compare: (a,b) => comparePlanQualityV25(a,b,strategy) });
    result.packagingModel = packagingSummary(cargoList);
    return result;
  }
}

function evaluateCandidate({ candidateId, sourceAlgorithm, placements, unloadedCargo, inheritedWarnings, inheritedConstraintMeta, handlingAssumptions, sourceRuntimeMs, generationPhase, runtimeTieBreakClass, cargoList, container, strategy, route, caseContext, validator }) {
  const translation = inheritedConstraintMeta?.backWallConstruction?.translation
    || { shiftX: 0, shiftZ: 0, mode: 'BACK_WALL_CONSTRUCTION_NO_GLOBAL_TRANSLATION' };
  renumberLoading(placements, container);
  const validation = validator.validate({ placements, cargoList, unloadedCargo, container, requireOrientationMetadata: true });
  attachStability(placements, validation.stability);
  const operationFeasibility = analyzeOperationFeasibility({ placements, container });
  const portAccessibility = validatePortAccessibility({ placements, container, route, caseContext });
  const layoutQuality = analyzeLayoutQuality({ placements, container, cargoList });
  const securing = analyzeSecuring({ placements, container, layoutQuality });
  const loadDistribution = analyzeLoadDistribution({ placements, container, caseContext });
  const voidJustification = analyzeVoidJustification({ placements, cargoList, container, layoutQuality, route, securing });
  const metrics = calculatePlanMetrics(placements, container, unloadedCargo.length, 0);
  metrics.rearWall = rearWallMetrics(placements, container);
  metrics.exactVoid = exactVoidMetrics(placements, container);
  const mandatoryGateViolationCount = mandatoryGateViolations({ placements, caseContext, validation, loadDistribution });
  const tightStow = {
    model: 'PORTCUBE_TIGHT_STOW_V2_5',
    unexplainedVoidVolume: voidJustification.unexplainedVoidVolume,
    maxUnexplainedGapMm: voidJustification.maxUnexplainedGapMm,
    internalVoidVolume: layoutQuality.internalVoidVolume,
    crossSectionP10: layoutQuality.crossSectionFillP10,
    lowFillInteriorSlices: layoutQuality.lowFillInteriorSliceCount,
    contactRatio: layoutQuality.contactRatioMean,
    securingStatus: securing.status,
    operationCost: number(metrics.operation?.totalCost)
  };
  Object.assign(metrics, {
    algorithm: 'hybrid-v2.5', solverVersion: '2.5', selectedCandidateAlgorithm: sourceAlgorithm, strategy,
    stability: compactStability(validation.stability), layoutQuality, securing, operationFeasibility,
    voidJustification, tightStow, sourceRuntimeMs: number(sourceRuntimeMs)
  });
  metrics.cog.withinPolicy = validation.checks.cog.withinPolicy;
  metrics.cog.recommendationStatus = loadDistribution.centreOfGravity.guidanceStatus;
  metrics.cog.longitudinalDistanceMm = metrics.cog.x-container.innerLength/2;
  metrics.cog.transverseDistanceMm = metrics.cog.z-container.innerWidth/2;
  metrics.cog.percentageDefinition = 'ABS_DISTANCE_FROM_MIDPOINT_DIVIDED_BY_FULL_INNER_SPAN';
  const hardConstraintsPass = validation.valid && validation.checks.cog.withinPolicy
    && operationFeasibility.blockedCount === 0 && portAccessibility.status === 'FULL_UNLOAD_PASS'
    && portAccessibility.postUnloadStabilityPass && mandatoryGateViolationCount === 0;
  metrics.operation = { ...metrics.operation, actualBlockedCount: operationFeasibility.blockedCount, actualOperationPass: operationFeasibility.operationPathPass };
  return {
    candidateId, sourceAlgorithm, loadedCargo: placements, unloadedCargo, hardConstraintsPass,
    spaceUtilization: metrics.volumeUtilization, totalWeight: metrics.loadedWeight,
    cog: { x: metrics.cog.x, y: metrics.cog.y, z: metrics.cog.z },
    cogOffset: { lateral: metrics.cog.lateral, longitudinal: metrics.cog.longitudinal, direction: metrics.cog.z >= container.innerWidth / 2 ? 'right' : 'left', percentage: metrics.cog.lateral.toFixed(2) },
    metrics, validator: validation, layoutQuality, tightStow, voidJustification, securing, operationFeasibility,
    portAccessibility, loadDistribution, mandatoryGateViolationCount,
    handlingAssumptions: handlingAssumptions || [], placementHash: placementHash(placements),
    sourceRuntimeMs: number(sourceRuntimeMs), runtimeTieBreakClass: number(runtimeTieBreakClass), generationPhase,
    constraintMeta: { ...inheritedConstraintMeta, translation }, warnings: inheritedWarnings || []
  };
}

function comparePlanQualityV25(left, right, strategy = 'SPACE') {
  if (left.metrics?.rearWall && right.metrics?.rearWall) {
    const pairs = [
      [left.hardConstraintsPass ? 0 : 1, right.hardConstraintsPass ? 0 : 1],
      // Invalid results are diagnostic candidates, never labelled successful.
      [number(left.validator?.hardViolationCount)+number(left.operationFeasibility?.blockedCount)+number(left.portAccessibility?.blockedCount),number(right.validator?.hardViolationCount)+number(right.operationFeasibility?.blockedCount)+number(right.portAccessibility?.blockedCount)],
      [-left.loadedCargo.length,-right.loadedCargo.length],
      [left.metrics.rearWall.deepEndPrimaryGap ?? Infinity,right.metrics.rearWall.deepEndPrimaryGap ?? Infinity],
      [left.metrics.exactVoid.volumesMm3.irregularInternalVoid,right.metrics.exactVoid.volumesMm3.irregularInternalVoid],
      [left.metrics.exactVoid.internalVoidMm3,right.metrics.exactVoid.internalVoidMm3],
      [continuousCogCost(left),continuousCogCost(right)],
      [number(left.metrics.operation?.totalCost),number(right.metrics.operation?.totalCost)]
    ];
    for(const [a,b] of pairs) if(Math.abs(a-b)>1e-7)return a-b;
    return left.placementHash.localeCompare(right.placementHash);
  }
  const higherGatePairs = [
    [number(left.validator?.hardViolationCount), number(right.validator?.hardViolationCount)],
    [number(left.operationFeasibility?.blockedCount), number(right.operationFeasibility?.blockedCount)],
    [number(left.portAccessibility?.blockedCount), number(right.portAccessibility?.blockedCount)],
    [number(left.portAccessibility?.rehandleCount), number(right.portAccessibility?.rehandleCount)],
    [postUnloadInvalid(left), postUnloadInvalid(right)],
    [number(left.metrics?.stability?.invalidCount), number(right.metrics?.stability?.invalidCount)],
    [number(left.mandatoryGateViolationCount), number(right.mandatoryGateViolationCount)],
    [distributionRank(left.loadDistribution), distributionRank(right.loadDistribution)],
    [-number(left.metrics?.loadedCount), -number(right.metrics?.loadedCount)]
  ];
  for (const [a, b] of higherGatePairs) if (Math.abs(a - b) > 1e-9) return a - b;

  const dominance = paretoDominance(left, right);
  if (dominance !== 0) return dominance;
  const layoutPairs = [
    [number(left.voidJustification?.unexplainedVoidVolume), number(right.voidJustification?.unexplainedVoidVolume)],
    [number(left.voidJustification?.maxUnexplainedGapMm), number(right.voidJustification?.maxUnexplainedGapMm)],
    [number(left.layoutQuality?.internalVoidVolume), number(right.layoutQuality?.internalVoidVolume)],
    [-number(left.layoutQuality?.crossSectionFillP10), -number(right.layoutQuality?.crossSectionFillP10)],
    [number(left.layoutQuality?.lowFillInteriorSliceCount), number(right.layoutQuality?.lowFillInteriorSliceCount)],
    [-number(left.layoutQuality?.contactRatioMean), -number(right.layoutQuality?.contactRatioMean)],
    [securingRank(left.securing), securingRank(right.securing)],
    [strategyObjective(left, strategy), strategyObjective(right, strategy)],
    [continuousCogCost(left), continuousCogCost(right)],
    [number(left.runtimeTieBreakClass), number(right.runtimeTieBreakClass)]
  ];
  for (const [a, b] of layoutPairs) if (Math.abs(a - b) > 1e-9) return a - b;
  return left.placementHash.localeCompare(right.placementHash) || left.candidateId.localeCompare(right.candidateId);
}

function paretoDominance(left, right) {
  const leftVector = paretoVector(left);
  const rightVector = paretoVector(right);
  const leftNoWorse = leftVector.every((value, index) => value <= rightVector[index] + 1e-9);
  const rightNoWorse = rightVector.every((value, index) => value <= leftVector[index] + 1e-9);
  const leftStrict = leftVector.some((value, index) => value < rightVector[index] - 1e-9);
  const rightStrict = rightVector.some((value, index) => value < leftVector[index] - 1e-9);
  if (leftNoWorse && leftStrict) return -1;
  if (rightNoWorse && rightStrict) return 1;
  return 0;
}

function paretoVector(result) {
  return [
    number(result.voidJustification?.unexplainedVoidVolume),
    number(result.voidJustification?.maxUnexplainedGapMm),
    number(result.layoutQuality?.internalVoidVolume),
    -number(result.layoutQuality?.crossSectionFillP10),
    number(result.layoutQuality?.lowFillInteriorSliceCount),
    -number(result.layoutQuality?.contactRatioMean),
    securingRank(result.securing),
    number(result.metrics?.operation?.totalCost),
    continuousCogCost(result)
  ];
}

function annotateParetoFronts(candidates) {
  for (const candidate of candidates) {
    candidate.layoutParetoFront = 1 + candidates.filter((other) => other !== candidate && sameHigherClass(candidate, other) && paretoDominance(other, candidate) < 0).length;
  }
}

function sameHigherClass(left, right) {
  return number(left.validator?.hardViolationCount) === number(right.validator?.hardViolationCount)
    && number(left.operationFeasibility?.blockedCount) === number(right.operationFeasibility?.blockedCount)
    && number(left.portAccessibility?.blockedCount) === number(right.portAccessibility?.blockedCount)
    && number(left.portAccessibility?.rehandleCount) === number(right.portAccessibility?.rehandleCount)
    && postUnloadInvalid(left) === postUnloadInvalid(right)
    && number(left.metrics?.stability?.invalidCount) === number(right.metrics?.stability?.invalidCount)
    && distributionRank(left.loadDistribution) === distributionRank(right.loadDistribution)
    && number(left.metrics?.loadedCount) === number(right.metrics?.loadedCount);
}

function strategyObjective(result, strategy) {
  if (strategy === 'OPERATION') return number(result.metrics?.operation?.totalCost);
  if (strategy === 'BALANCE') return segmentVariance(result.loadDistribution?.segments?.longitudinal || []);
  return number(result.voidJustification?.unexplainedVoidVolume) + number(result.layoutQuality?.internalVoidVolume) * 0.1;
}

function segmentVariance(segments) {
  if (!segments.length) return 0;
  const values = segments.map((entry) => number(entry.massKg));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function continuousCogCost(result) {
  const cog = result.loadDistribution?.centreOfGravity || {};
  return Math.max(number(cog.lateralOffsetPercent), number(cog.longitudinalOffsetPercent));
}

function mandatoryGateViolations({ placements, caseContext, validation, loadDistribution }) {
  let count = validation?.checks?.payload === false ? 1 : 0;
  const available = new Set((caseContext.availableHandlingMethods || []).map((entry) => String(entry).toLowerCase()));
  if (available.size > 0) {
    count += new Set(placements.filter((item) => !available.has(String(item.handlingMethod || '').toLowerCase())).map((item) => item.handlingMethod)).size;
  }
  if (loadDistribution?.concentratedLoad?.status === 'OUTSIDE_OPERATOR_ENVELOPE') count++;
  return count;
}

function selectionOrder() {
  return [
    'hard constraints', 'canonical loading operation blocked', 'future-port access blocked', 'rehandle',
    'post-unload stability', 'initial stability', 'mandatory equipment/mass', 'load-distribution guidance class',
    'loaded count', 'same-class Pareto dominance', 'unexplained void', 'tight-stow/cross-section',
    'securing quality', 'strategy objective', 'continuous CoG', 'deterministic runtime class', 'placement hash'
  ];
}

function candidateSummary(candidate) {
  return {
    candidateId: candidate.candidateId, sourceAlgorithm: candidate.sourceAlgorithm, generationPhase: candidate.generationPhase,
    placementHash: candidate.placementHash, hardViolationCount: number(candidate.validator?.hardViolationCount),
    operationBlockedCount: number(candidate.operationFeasibility?.blockedCount), portAccessBlockedCount: number(candidate.portAccessibility?.blockedCount),
    rehandleCount: number(candidate.portAccessibility?.rehandleCount), postUnloadInvalidCount: postUnloadInvalid(candidate),
    initialStabilityInvalidCount: number(candidate.metrics?.stability?.invalidCount), mandatoryGateViolationCount: number(candidate.mandatoryGateViolationCount),
    loadedCount: number(candidate.metrics?.loadedCount), loadDistributionStatus: candidate.loadDistribution?.centreOfGravity?.guidanceStatus,
    layoutParetoFront: candidate.layoutParetoFront, unexplainedVoidVolume: number(candidate.voidJustification?.unexplainedVoidVolume),
    maxUnexplainedGapMm: number(candidate.voidJustification?.maxUnexplainedGapMm), internalVoidVolume: number(candidate.layoutQuality?.internalVoidVolume),
    crossSectionP10: number(candidate.layoutQuality?.crossSectionFillP10), lowFillInteriorSlices: number(candidate.layoutQuality?.lowFillInteriorSliceCount),
    contactRatio: number(candidate.layoutQuality?.contactRatioMean), securingStatus: candidate.securing?.status,
    operationCost: number(candidate.metrics?.operation?.totalCost), continuousCogCost: continuousCogCost(candidate),
    sourceRuntimeMs: candidate.sourceRuntimeMs, runtimeTieBreakClass: candidate.runtimeTieBreakClass,
    translation: candidate.constraintMeta?.translation
  };
}

function packagingSummary(cargoList) {
  const counts = {};
  let confirmationRequiredCount = 0;
  let explicitSupportLimitCount = 0;
  for (const cargo of cargoList) {
    const type = cargo.packagingType || 'GENERIC';
    counts[type] = number(counts[type]) + Math.max(1, number(cargo.quantity || 1));
    if (cargo.packagingProfile?.confirmationStatus === 'USER_CONFIRMATION_REQUIRED') confirmationRequiredCount++;
    if (number(cargo.maximumSupportedWeightKg) > 0) explicitSupportLimitCount++;
  }
  return { model: 'PORTCUBE_PACKAGING_PROFILE_V2_5', typeCounts: counts, confirmationRequiredCount, explicitSupportLimitCount };
}

function renumberLoading(placements, container) {
  const order = new Map(canonicalLoadingSequence(placements, container).map((item, index) => [String(item.cargoId), index + 1]));
  placements.forEach((item) => { item.loadingIndex = order.get(String(item.cargoId)) || 0; });
}
function attachStability(placements, stability) {
  for (const item of placements) {
    const entry = stability?.cargo?.[item.cargoId];
    if (entry) Object.assign(item, { supportRatio: entry.supportRatio, supportMargin: entry.supportMargin, stackStability: entry.stackStability, restraint: entry.restraint, slenderness: entry.slenderness, riskStatus: entry.riskStatus });
  }
}
function compactStability(stability) { return stability ? { model: stability.model, status: stability.status, invalidCount: stability.invalidCount, warningCount: stability.warningCount, ...(stability.summary || {}), policy: stability.policy } : null; }
function compactRepair(result) { return { promoted: result.promoted === true, reason: result.reason, trials: number(result.trials), scopedCargoCount: number(result.scopedCargoCount), targetZoneId: result.targetZoneId || null }; }
function compactBalanceRepair(result) { return { promoted: result.promoted === true, reason: result.reason, trials: number(result.trials), eligiblePairCount: number(result.eligiblePairCount), baseCogPercent: number(result.baseCogPercent), bestCogPercent: number(result.bestCogPercent) }; }
function distributionRank(result) { return ({ WITHIN_GENERAL_GUIDANCE: 0, PARTICULAR_CIRCUMSTANCES_REVIEW: 1, OUTSIDE_GUIDANCE: 2 })[result?.centreOfGravity?.guidanceStatus] ?? 3; }
function securingRank(result) { return ({ SECURING_NOT_REQUIRED: 0, SECURING_REQUIRED: 1, SECURING_UNRESOLVED: 2 })[result?.status] ?? 3; }
function postUnloadInvalid(result) { return (result.portAccessibility?.calls || []).reduce((sum, call) => sum + number(call.postUnloadStability?.invalidCount), 0); }
function placementHash(items) { return crypto.createHash('sha256').update(JSON.stringify([...items].sort((a, b) => String(a.cargoId).localeCompare(String(b.cargoId))).map((item) => [item.cargoId, round(item.x), round(item.y), round(item.z), round(item.l), round(item.h), round(item.w)]))).digest('hex').slice(0, 16); }
function densityRegime(cargoList, container) { const volume = cargoList.reduce((sum, item) => sum + number(item.length) * number(item.width) * number(item.height) * Math.max(1, number(item.quantity || 1)), 0); const ratio = volume / Math.max(1, container.innerLength * container.innerWidth * container.innerHeight); return ratio >= 0.65 ? 'DENSE' : ratio >= 0.35 ? 'MEDIUM' : 'SPARSE'; }
function normalizeStrategy(value) { const result = String(value || 'SPACE').toUpperCase(); return ['SPACE', 'BALANCE', 'OPERATION'].includes(result) ? result : 'SPACE'; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = HybridConstraintPackingSolverV25;
module.exports.comparePlanQualityV25 = comparePlanQualityV25;
module.exports.paretoDominance = paretoDominance;
module.exports.evaluateCandidate = evaluateCandidate;
