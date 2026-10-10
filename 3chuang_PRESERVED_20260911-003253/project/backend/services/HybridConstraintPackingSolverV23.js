'use strict';

const packingPolicy = require('../config/packingPolicy');
const HybridConstraintPackingSolverV2 = require('./HybridConstraintPackingSolverV2');
const CrossSectionLayerBuilder = require('./packing/CrossSectionLayerBuilder');
const FloorExtremePointCandidate = require('./packing/FloorExtremePointCandidate');
const PlanValidator = require('./packing/PlanValidator');
const { calculatePlanMetrics, calculateCoG, normalizeContainer, clamp } = require('./packing/PlanMetrics');
const { analyzeLayoutQuality } = require('./packing/LayoutQualityAnalyzer');
const { analyzeSecuring } = require('./packing/SecuringAnalyzer');
const { analyzeOperationFeasibility, canonicalLoadingSequence } = require('./packing/CanonicalOperationFeasibility');

/**
 * PORTCUBE Hybrid V2.3
 *
 * V2.3 preserves V1/V2.1 as independent algorithms. Its challenger path uses
 * mixed-SKU cross-section layers, stack-column balancing, residual-layer
 * reorientation, canonical operation replay and an independent final gate.
 */
class HybridConstraintPackingSolverV23 {
  constructor(config = {}) {
    this.config = {
      longitudinalShiftQuantumMm: 50,
      lateralLimitPercent: packingPolicy.cog.lateralLimitPercent,
      longitudinalLimitPercent: packingPolicy.cog.longitudinalLimitPercent,
      enableV21Guardrail: true,
      enableFloorCandidate: true,
      ...config
    };
    this.validator = config.validator || new PlanValidator(this.config);
  }

  async generatePackingPlan(cargoList = [], containerInput = {}, options = {}) {
    const startedAt = Date.now();
    const container = normalizeContainer(containerInput);
    const strategy = normalizeStrategy(options.strategy || this.config.strategy || 'SPACE');
    const totalInputCount = cargoList.reduce((sum, cargo) => sum + Math.max(1, Math.floor(number(cargo.quantity || 1))), 0);
    const expanded = CrossSectionLayerBuilder.expandInstances(cargoList);
    const ports = [...new Set(expanded.map((item) => number(item.portSequence || 1)))].sort((left, right) => left - right);
    const earliestPort = ports[0] || 1;
    const builder = new CrossSectionLayerBuilder({
      columnCandidateModeByPort: { [earliestPort]: 'VOID_FIRST' },
      layerOrderingModeByPort: { [earliestPort]: 'FILL_DESC' },
      ...(this.config.layerBuilder || {})
    });
    const crossSectionBuilt = builder.build(cargoList, container, { strategy });
    const floorBuilt = this.config.enableFloorCandidate
      ? new FloorExtremePointCandidate(this.config.floorExtremePoint || {}).build(cargoList, container) : null;
    const builtCandidates = [crossSectionBuilt, floorBuilt].filter(Boolean);
    const evaluatedCandidates = builtCandidates.map((built) => {
      const placements = built.placements.map((placement) => ({
        ...placement,
        riskNotes: Array.isArray(placement.riskNotes) ? [...placement.riskNotes] : [],
        supportCargoIds: Array.isArray(placement.supportCargoIds) ? [...placement.supportCargoIds] : []
      }));
      const translation = applyStrategyTranslation(placements, container, strategy, this.config);
      renumberCanonicalLoadingSequence(placements, container);
      return buildResult({
        placements,
        unloadedCargo: built.unloaded,
        cargoList,
        container,
        strategy,
        startedAt,
        validator: this.validator,
        translation,
        builderEvidence: {
          candidateSource: built.candidateSource,
          candidateSourcesEvaluated: builtCandidates.map((entry) => entry.candidateSource),
          mixedSkuPolicy: built.mixedSkuPolicy,
          deterministic: built.deterministic,
          occupiedDepth: built.occupiedDepth,
          layers: built.layers,
          stageReports: built.stageReports
        }
      });
    });
    const candidate = evaluatedCandidates.sort((left, right) => comparePlanQuality(left, right, strategy))[0];

    const needsGuardrail = !candidate.validator.valid
      || candidate.operationFeasibility.blockedCount > 0
      || number(candidate.metrics.stability?.invalidCount) > 0
      || candidate.metrics.loadedCount < totalInputCount
      || candidate.metrics.cog.withinPolicy === false;
    if (!needsGuardrail || this.config.enableV21Guardrail === false) return candidate;

    const v21 = await new HybridConstraintPackingSolverV2({ portfolioGuardrail: false }).generatePackingPlan(cargoList, container, { strategy });
    const enrichedV21 = enrichLegacyCandidate(v21, cargoList, container, startedAt, strategy);
    const selected = comparePlanQuality(candidate, enrichedV21, strategy) <= 0 ? candidate : enrichedV21;
    selected.metrics.solveMs = Date.now() - startedAt;
    selected.metrics.elapsedMs = selected.metrics.solveMs;
    selected.metrics.algorithm = 'hybrid-v2.3';
    selected.metrics.solverVersion = '2.3';
    selected.metrics.selectedCandidateAlgorithm = selected === candidate ? 'hybrid-v2.3' : 'hybrid-v2';
    selected.constraintMeta = {
      ...(selected.constraintMeta || {}),
      solverPortfolio: {
        officialSolver: 'hybrid-v2.3',
        selectedCandidateAlgorithm: selected.metrics.selectedCandidateAlgorithm,
        reason: selected === candidate ? 'V2_3_LEXICOGRAPHIC_WIN' : 'V2_1_SAFETY_GUARDRAIL',
        selectionOrder: lexicographicOrder()
      }
    };
    selected._algorithmId = 'hybrid-v2.3';
    selected._strategyUsed = strategy.toLowerCase();
    if (selected !== candidate) selected.warnings = [
      ...(selected.warnings || []),
      { type: 'HYBRID_V23_GUARDRAIL', message: 'V2.3 challenger did not clear a higher-priority gate; selected the preserved V2.1 candidate.' }
    ];
    return selected;
  }
}

function buildResult({ placements, unloadedCargo, cargoList, container, strategy, startedAt, validator, translation, builderEvidence }) {
  const validation = validator.validate({ placements, cargoList, container });
  attachStability(placements, validation.stability);
  const solveMs = Date.now() - startedAt;
  const metrics = calculatePlanMetrics(placements, container, unloadedCargo.length, solveMs);
  const layoutQuality = analyzeLayoutQuality({ placements, container, cargoList });
  const securing = analyzeSecuring({ placements, container, layoutQuality });
  const operationFeasibility = analyzeOperationFeasibility({ placements, container });
  metrics.algorithm = 'hybrid-v2.3';
  metrics.solverVersion = '2.3';
  metrics.selectedCandidateAlgorithm = 'hybrid-v2.3';
  metrics.strategy = strategy;
  metrics.elapsedMs = solveMs;
  metrics.stability = stabilityMetrics(validation.stability);
  metrics.layoutQuality = layoutQuality;
  metrics.securing = securing;
  metrics.operationFeasibility = operationFeasibility;
  metrics.operation = {
    ...(metrics.operation || {}),
    actualBlockedCount: operationFeasibility.blockedCount,
    actualOperationPass: operationFeasibility.operationPathPass
  };
  metrics.cog.withinPolicy = validation.checks.cog.withinPolicy;
  metrics.cog.recommendationStatus = validation.checks.cog.withinPolicy
    ? 'WITHIN_RECOMMENDED_PROJECT_POLICY'
    : 'OUTSIDE_RECOMMENDED_PROJECT_POLICY';
  const warnings = validation.warnings.map((entry) => ({ type: entry.code, message: entry.message, evidence: entry.evidence }));
  if (!validation.valid) warnings.push({ type: 'PLAN_VALIDATOR_INVALID', message: `V2.3 independent validator found ${validation.hardViolationCount} hard violations.` });
  if (operationFeasibility.blockedCount > 0) warnings.push({ type: 'ACTUAL_OPERATION_BLOCKED', message: `${operationFeasibility.blockedCount} canonical replay steps are blocked.` });
  if (securing.required) warnings.push({ type: 'SECURING_GUIDANCE_REQUIRED', message: `${securing.securingRequiredCount} cargo items require blocking/bracing/dunnage review.` });
  return {
    loadedCargo: placements,
    unloadedCargo,
    spaceUtilization: metrics.volumeUtilization,
    totalWeight: metrics.loadedWeight,
    cog: { x: metrics.cog.x, y: metrics.cog.y, z: metrics.cog.z },
    cogOffset: {
      lateral: metrics.cog.lateral,
      longitudinal: metrics.cog.longitudinal,
      direction: metrics.cog.z >= container.innerWidth / 2 ? 'right' : 'left',
      percentage: metrics.cog.lateral.toFixed(2)
    },
    metrics,
    layoutQuality,
    securing,
    operationFeasibility,
    validator: validation,
    constraintMeta: {
      standardsProfile: 'PORTCUBE project policy; deterministic CTU/SOLAS-compatible constraint model',
      solverVersion: '2.3',
      candidateSources: builderEvidence.candidateSourcesEvaluated || ['CROSS_SECTION_LAYER'],
      selectedCandidateSource: builderEvidence.candidateSource,
      positioning: ['constraint-aware', 'stability-aware', 'compaction-aware', 'operation-feasible'],
      coordinateContract: { lengthAxis: 'x', gravityAxis: 'y', widthAxis: 'z', doorSide: 'higher x coordinate' },
      skuAndBatchSpatialBarriers: false,
      portAccessConstraint: 'earlier-unload cargo must retain a higher-X extraction corridor',
      stabilityModel: validation.stability?.model,
      securingModel: securing.model,
      operationModel: operationFeasibility.model,
      geometricStabilityStatus: validation.stability?.status,
      securingStatus: securing.status,
      actualOperationBlockedCount: operationFeasibility.blockedCount,
      lifoCompliant: validation.checks?.lifo === true,
      translation,
      builderEvidence,
      selectionOrder: lexicographicOrder()
    },
    warnings,
    _strategyUsed: strategy.toLowerCase(),
    _algorithmId: 'hybrid-v2.3'
  };
}

function enrichLegacyCandidate(result, cargoList, container, startedAt, strategy) {
  const placements = result.loadedCargo || [];
  renumberCanonicalLoadingSequence(placements, container);
  const layoutQuality = analyzeLayoutQuality({ placements, container, cargoList });
  const securing = analyzeSecuring({ placements, container, layoutQuality });
  const operationFeasibility = analyzeOperationFeasibility({ placements, container });
  result.layoutQuality = layoutQuality;
  result.securing = securing;
  result.operationFeasibility = operationFeasibility;
  result.metrics = {
    ...(result.metrics || {}),
    layoutQuality,
    securing,
    operationFeasibility,
    solveMs: Date.now() - startedAt,
    strategy,
    selectedCandidateAlgorithm: 'hybrid-v2'
  };
  result.metrics.operation = {
    ...(result.metrics.operation || {}),
    actualBlockedCount: operationFeasibility.blockedCount,
    actualOperationPass: operationFeasibility.operationPathPass
  };
  return result;
}

function applyStrategyTranslation(placements, container, strategy, config) {
  if (placements.length === 0) return { shiftX: 0, shiftZ: 0, mode: 'EMPTY_PLAN' };
  const minX = Math.min(...placements.map((item) => number(item.x)));
  const maxX = Math.max(...placements.map((item) => number(item.x) + number(item.l)));
  const minZ = Math.min(...placements.map((item) => number(item.z)));
  const maxZ = Math.max(...placements.map((item) => number(item.z) + number(item.w)));
  const cog = calculateCoG(placements, container);
  const minimumShiftX = -minX;
  const maximumShiftX = container.innerLength - maxX;
  const halfLength = container.innerLength / 2;
  const allowedX = container.innerLength * number(config.longitudinalLimitPercent) / 100;
  const policyShiftX = halfLength - allowedX - cog.x;
  let desiredShiftX;
  if (strategy === 'SPACE') {
    const quantum = Math.max(1, number(config.longitudinalShiftQuantumMm));
    desiredShiftX = Math.ceil(Math.max(minimumShiftX, policyShiftX) / quantum) * quantum;
  } else if (strategy === 'BALANCE') desiredShiftX = halfLength - cog.x;
  else desiredShiftX = maximumShiftX;
  const shiftX = round(clamp(desiredShiftX, minimumShiftX, maximumShiftX));
  const minimumShiftZ = -minZ;
  const maximumShiftZ = container.innerWidth - maxZ;
  const shiftZ = round(clamp(container.innerWidth / 2 - cog.z, minimumShiftZ, maximumShiftZ));
  for (const placement of placements) {
    placement.x = round(number(placement.x) + shiftX);
    placement.z = round(number(placement.z) + shiftZ);
    placement.algorithmMeta = { ...(placement.algorithmMeta || {}), globalCompactionShiftX: shiftX, lateralBalanceShiftZ: shiftZ };
  }
  return {
    shiftX,
    shiftZ,
    mode: strategy === 'SPACE' ? 'MINIMUM_QUANTIZED_COG_GUARDRAIL' : strategy === 'BALANCE' ? 'COG_TARGET' : 'DOOR_COMPACT_OPERATION',
    quantumMm: number(config.longitudinalShiftQuantumMm),
    availableShiftRangeX: [minimumShiftX, maximumShiftX]
  };
}

function renumberCanonicalLoadingSequence(placements, container) {
  const loadingIndex = new Map(canonicalLoadingSequence(placements, container).map((item, index) => [String(item.cargoId), index + 1]));
  for (const placement of placements) placement.loadingIndex = loadingIndex.get(String(placement.cargoId)) || 0;
}

function attachStability(placements, stability) {
  if (!stability?.cargo) return;
  for (const item of placements) {
    const entry = stability.cargo[item.cargoId];
    if (!entry) continue;
    item.supportRatio = entry.supportRatio;
    item.supportMargin = entry.supportMargin;
    item.stackStability = entry.stackStability;
    item.restraint = entry.restraint;
    item.slenderness = entry.slenderness;
    item.riskStatus = entry.riskStatus;
  }
}

function stabilityMetrics(stability) {
  if (!stability) return null;
  return {
    model: stability.model,
    dataClassification: stability.dataClassification,
    status: stability.status,
    invalidCount: stability.invalidCount,
    warningCount: stability.warningCount,
    ...(stability.summary || {}),
    policy: stability.policy
  };
}

function comparePlanQuality(left, right, strategy) {
  const pairs = [
    [number(left.validator?.hardViolationCount), number(right.validator?.hardViolationCount)],
    [number(left.operationFeasibility?.blockedCount), number(right.operationFeasibility?.blockedCount)],
    [number(left.metrics?.stability?.invalidCount), number(right.metrics?.stability?.invalidCount)],
    [-number(left.metrics?.loadedCount), -number(right.metrics?.loadedCount)],
    [-number(left.metrics?.loadedVolume), -number(right.metrics?.loadedVolume)],
    [left.validator?.checks?.lifo && left.validator?.checks?.insertion ? 0 : 1, right.validator?.checks?.lifo && right.validator?.checks?.insertion ? 0 : 1],
    [number(left.layoutQuality?.internalVoidVolume), number(right.layoutQuality?.internalVoidVolume)],
    [number(left.layoutQuality?.lowFillInteriorSliceCount), number(right.layoutQuality?.lowFillInteriorSliceCount)],
    [-number(left.layoutQuality?.largestContiguousReserve), -number(right.layoutQuality?.largestContiguousReserve)],
    [left.metrics?.cog?.withinPolicy === false ? 1 : 0, right.metrics?.cog?.withinPolicy === false ? 1 : 0],
    [strategyCost(left, strategy), strategyCost(right, strategy)],
    [number(left.metrics?.solveMs), number(right.metrics?.solveMs)]
  ];
  for (const [leftValue, rightValue] of pairs) if (Math.abs(leftValue - rightValue) > 1e-9) return leftValue - rightValue;
  return 0;
}

function strategyCost(result, strategy) {
  if (strategy === 'BALANCE') return number(result.metrics?.cog?.lateral) * 0.65 + number(result.metrics?.cog?.longitudinal) * 0.35;
  if (strategy === 'OPERATION') return number(result.metrics?.operation?.totalCost);
  return number(result.layoutQuality?.internalVoidVolume) - number(result.layoutQuality?.largestContiguousReserve) * 0.1;
}

function lexicographicOrder() {
  return ['hardViolations', 'actualOperationBlocked', 'stabilityInvalid', 'loadedCount', 'loadedVolume', 'LIFO/extraction', 'fragmentedVoid/unsecuredGap', 'largestReserve', 'CoGGuardrail', 'strategyObjective', 'runtime'];
}

function normalizeStrategy(value) {
  const normalized = String(value || 'SPACE').trim().toUpperCase();
  return ['SPACE', 'BALANCE', 'OPERATION'].includes(normalized) ? normalized : 'SPACE';
}

function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = HybridConstraintPackingSolverV23;
module.exports.comparePlanQuality = comparePlanQuality;
