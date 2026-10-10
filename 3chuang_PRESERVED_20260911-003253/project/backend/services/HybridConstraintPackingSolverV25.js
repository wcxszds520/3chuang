'use strict';

const crypto = require('crypto');
const HybridConstraintPackingSolverV2 = require('./HybridConstraintPackingSolverV2');
const HybridConstraintPackingSolverV23 = require('./HybridConstraintPackingSolverV23');
const PlanValidator = require('./packing/PlanValidator');
const { centerPlan, applyDerivedTeamManual } = require('./HybridConstraintPackingSolverV24');
const { calculatePlanMetrics, normalizeContainer } = require('./packing/PlanMetrics');
const { analyzeLayoutQuality } = require('./packing/LayoutQualityAnalyzer');
const { analyzeVoidJustification } = require('./packing/VoidJustificationAnalyzer');
const { attemptVoidDrivenLocalRepair } = require('./packing/VoidDrivenLocalRepair');
const { attemptLoadBalanceAwareLocalRepair } = require('./packing/LoadBalanceAwareLocalRepair');
const { compactDeepEnd } = require('./packing/EndGapCompaction');
const { attemptWallOrderRepair } = require('./packing/WallOrderRepair');
const { generateLaneStackCandidates } = require('./packing/LaneStackRepacking');
const { safePromotion } = require('./packing/LoadBalanceAwareLocalRepair');
const FloorExtremePointCandidate = require('./packing/FloorExtremePointCandidate');
const { normalizeCargoList } = require('./packing/PackagingProfile');
const { analyzeSecuring } = require('./packing/SecuringAnalyzer');
const { analyzeOperationFeasibility, canonicalLoadingSequence, validateActorCargo } = require('./packing/CanonicalOperationFeasibility');
const { analyzeLoadDistribution } = require('./realworld/LoadDistributionAnalyzer');
const { validatePortAccessibility } = require('./realworld/PortAccessibilityValidator');

/**
 * PORTCUBE V2.5 keeps the V2.3 physical topology and V2.1 fallback, but selects
 * by safety gates → guidance class → same-class layout truth. Continuous CoG
 * can no longer defeat a materially tighter layout inside the same class.
 */
class HybridConstraintPackingSolverV25 {
  constructor(config = {}) {
    this.config = {
      maximumCandidates: 8,
      enableVoidLocalRepair: true,
      maximumLocalRepairItems: 30,
      maximumLocalRepairTrials: 18,
      enableLoadBalanceRepair: true,
      maximumBalanceRepairTrials: 8,
      enableLaneStackRepacking: true,
      maximumLaneCandidates: 4,
      ...config
    };
    this.validator = config.validator || new PlanValidator(config);
  }

  async generatePackingPlan(cargoInput = [], containerInput = {}, options = {}) {
    const startedAt = Date.now();
    const container = normalizeContainer(containerInput);
    const strategy = normalizeStrategy(options.strategy);
    const cargoList = normalizeCargoList(cargoInput, { source: options.inputSource || 'LEGACY_INPUT' });
    const route = options.route || options.caseContext?.route || [];
    const caseContext = options.caseContext || {};
    const v23Started = Date.now();
    // This portfolio owns the conditional floor completion below. V2.3 only
    // contributes its cross-section candidate, avoiding a duplicate beam.
    const v23 = await new HybridConstraintPackingSolverV23({ enableV21Guardrail: false, enableFloorCandidate: false })
      .generatePackingPlan(cargoList, container, { strategy });
    const v23Runtime = Date.now() - v23Started;
    const floorStarted = Date.now();
    const inputCount = cargoList.reduce((sum, cargo) => sum + Number(cargo.quantity || 1), 0);
    // Floor completion exists to repair a missing/invalid small-set incumbent.
    // Once a complete centered incumbent passes the same physical gates, the
    // remaining portfolio and local repairs compare layouts without rerunning
    // an expensive completion beam for a problem that is already complete.
    let completeFloorIncumbent = false;
    if (inputCount <= 9 && v23.loadedCargo?.length === inputCount) {
      const centered = clone(v23.loadedCargo);
      centerPlan(centered, container);
      const validation = this.validator.validate({ placements: centered, cargoList, container });
      completeFloorIncumbent = validation.valid && validation.checks.cog.withinPolicy
        && analyzeOperationFeasibility({ placements: centered, container }).operationPathPass
        && validatePortAccessibility({ placements: centered, container, route, caseContext }).status === 'FULL_UNLOAD_PASS';
    }
    const floorCompletion = completeFloorIncumbent ? null : new FloorExtremePointCandidate({ maximumInstances: 9, beamWidth: 512, maximumStarts: 8 })
      .build(cargoList, container);
    const floorRuntime = Date.now() - floorStarted;
    const v21Started = Date.now();
    const v21 = await new HybridConstraintPackingSolverV2({ portfolioGuardrail: false })
      // The preserved V2.1 SPACE solution is a safety fallback, not a request-
      // strategy competitor. On sparse multi-port Dataset B it is the known
      // within-guidance solution; requested-strategy V2.1 can regress to 14%.
      .generatePackingPlan(cargoList, container, { strategy: 'SPACE' });
    const v21Runtime = Date.now() - v21Started;

    const context = { cargoList, container, strategy, route, caseContext, validator: this.validator };
    const seeds = [
      seedCandidate('V23_BASE', 'hybrid-v2.3', v23, false, false, v23Runtime, 'V23_TIGHT_TOPOLOGY'),
      seedCandidate('V23_GLOBAL_BALANCE', 'hybrid-v2.3', v23, true, false, v23Runtime, 'LEGAL_GLOBAL_TRANSLATION'),
      floorCompletion && seedCandidate('BOUNDED_FLOOR_COMPLETION', 'hybrid-v2.5-floor-extreme-point', {
        loadedCargo: floorCompletion.placements,
        unloadedCargo: floorCompletion.unloaded,
        warnings: [],
        constraintMeta: { floorExtremePoint: { candidateSource: floorCompletion.candidateSource, stageReports: floorCompletion.stageReports } }
      }, false, false, floorRuntime, 'BOUNDED_SMALL_SET_FLOOR_COMPLETION', 3),
      floorCompletion && seedCandidate('BOUNDED_FLOOR_COMPLETION_GLOBAL_BALANCE', 'hybrid-v2.5-floor-extreme-point', {
        loadedCargo: floorCompletion.placements,
        unloadedCargo: floorCompletion.unloaded,
        warnings: [],
        constraintMeta: { floorExtremePoint: { candidateSource: floorCompletion.candidateSource, stageReports: floorCompletion.stageReports } }
      }, true, false, floorRuntime, 'BOUNDED_SMALL_SET_FLOOR_COMPLETION_GLOBAL_BALANCE', 4),
      seedCandidate('V21_BASE_ASSISTED', 'hybrid-v2.1', v21, false, true, v21Runtime, 'V21_FALLBACK_AFTER_LOCAL_REPAIR', 5),
      seedCandidate('V21_GLOBAL_BALANCE_ASSISTED', 'hybrid-v2.1', v21, true, true, v21Runtime, 'V21_FALLBACK_AFTER_LOCAL_REPAIR', 6)
    ].filter(Boolean).slice(0, this.config.maximumCandidates);
    const evaluated = seeds.map((seed, index) => evaluateCandidate({
      ...seed,
      ...context,
      runtimeTieBreakClass: seed.runtimeTieBreakClass ?? index
    }));

    const v23Base = evaluated.find((entry) => entry.candidateId === 'V23_BASE');
    let localRepair = { promoted: false, reason: 'DISABLED', trials: 0 };
    if (this.config.enableVoidLocalRepair && v23Base && evaluated.length < this.config.maximumCandidates) {
      localRepair = attemptVoidDrivenLocalRepair({
        baseCandidate: v23Base,
        maximumCargo: this.config.maximumLocalRepairItems,
        maximumTrials: this.config.maximumLocalRepairTrials,
        evaluate: (placements, repairMeta) => evaluateCandidate({
          candidateId: 'V23_VOID_REPAIR',
          sourceAlgorithm: 'hybrid-v2.3+void-local-repair',
          placements,
          unloadedCargo: clone(v23.unloadedCargo || []),
          inheritedWarnings: clone(v23.warnings || []),
          inheritedConstraintMeta: { ...(v23.constraintMeta || {}), localRepair: repairMeta },
          handlingAssumptions: [],
          translationRequested: false,
          sourceRuntimeMs: v23Runtime,
          generationPhase: 'BOUNDED_VOID_DRIVEN_LOCAL_REPAIR',
          runtimeTieBreakClass: 2,
          ...context
        })
      });
      if (localRepair.promoted && localRepair.candidate) evaluated.push(localRepair.candidate);
    }

    let loadBalanceRepair = { promoted: false, reason: 'DISABLED', trials: 0 };
    if (this.config.enableLoadBalanceRepair && v23Base && evaluated.length < this.config.maximumCandidates) {
      loadBalanceRepair = attemptLoadBalanceAwareLocalRepair({
        baseCandidate: v23Base,
        maximumTrials: this.config.maximumBalanceRepairTrials,
        evaluate: (placements, repairMeta) => evaluateCandidate({
          candidateId: 'V23_BALANCE_AWARE_REPAIR',
          sourceAlgorithm: 'hybrid-v2.3+balance-aware-local-repair',
          placements,
          unloadedCargo: clone(v23.unloadedCargo || []),
          inheritedWarnings: clone(v23.warnings || []),
          inheritedConstraintMeta: { ...(v23.constraintMeta || {}), loadBalanceRepair: repairMeta },
          handlingAssumptions: [],
          translationRequested: false,
          sourceRuntimeMs: v23Runtime,
          generationPhase: 'BOUNDED_LOAD_BALANCE_AWARE_LOCAL_REPAIR',
          runtimeTieBreakClass: 3,
          ...context
        })
      });
      if (loadBalanceRepair.promoted && loadBalanceRepair.candidate) evaluated.push(loadBalanceRepair.candidate);
    }

    annotateParetoFronts(evaluated);
    evaluated.sort((left, right) => comparePlanQualityV25(left, right, strategy));
    let selected = evaluated[0];
    const compacted = compactDeepEnd(selected.loadedCargo, container);
    if (compacted) {
      const challenger = evaluateCandidate({
        candidateId: `${selected.candidateId}_DEEP_COMPACT`, sourceAlgorithm: `${selected.sourceAlgorithm}+deep-compact-v1`,
        placements: compacted.placements, unloadedCargo: clone(selected.unloadedCargo),
        inheritedWarnings: clone(selected.warnings || []),
        inheritedConstraintMeta: { ...selected.constraintMeta, endGapCompaction: { ...compacted.evidence, parentPlacementHash: selected.placementHash } },
        handlingAssumptions: selected.handlingAssumptions, translationRequested: false,
        sourceRuntimeMs: selected.sourceRuntimeMs, runtimeTieBreakClass: selected.runtimeTieBreakClass,
        generationPhase: 'SAME_CLASS_DEEP_END_COMPACTION', ...context
      });
      // This candidate has identical pairwise geometry. Discrete grid estimates
      // cannot veto a translation; actual constraints and guidance still can.
      const gates = [
        c => c.validator.hardViolationCount, c => c.operationFeasibility.blockedCount,
        c => c.portAccessibility.blockedCount, c => c.portAccessibility.rehandleCount,
        postUnloadInvalid, c => c.metrics.stability.invalidCount,
        c => c.mandatoryGateViolationCount, c => distributionRank(c.loadDistribution),
        c => -c.metrics.loadedCount
      ];
      const accepted = gates.every(gate => gate(challenger) <= gate(selected));
      challenger.constraintMeta.endGapCompaction.accepted = accepted;
      evaluated.push(challenger);
      if (accepted) selected = challenger;
    }
    const wallOrderRepair = attemptWallOrderRepair({ baseCandidate: selected, container,
      evaluate: (placements, evidence) => evaluateCandidate({
        candidateId: `${selected.candidateId}_WALL_REORDER`, sourceAlgorithm: `${selected.sourceAlgorithm}+wall-reorder-v1`,
        placements, unloadedCargo: clone(selected.unloadedCargo), inheritedWarnings: clone(selected.warnings || []),
        inheritedConstraintMeta: { ...selected.constraintMeta, wallOrderRepair: { ...evidence, parentPlacementHash: selected.placementHash } },
        handlingAssumptions: selected.handlingAssumptions, translationRequested: false,
        sourceRuntimeMs: selected.sourceRuntimeMs, runtimeTieBreakClass: selected.runtimeTieBreakClass,
        generationPhase: 'SAME_PORT_WHOLE_WALL_REORDER', ...context
      })
    });
    if (wallOrderRepair.promoted) {
      selected = wallOrderRepair.candidate;
      selected.constraintMeta.wallOrderRepair.accepted = true;
      evaluated.push(selected);
    }
    const laneStackRepacking = { model: 'LANE_STACK_BEAM_REPACK_V1', promoted: false, candidates: [] };
    if (this.config.enableLaneStackRepacking) {
      const parent = selected;
      const candidates = generateLaneStackCandidates({ basePlacements: parent.loadedCargo, container, maximumResults: this.config.maximumLaneCandidates });
      for (const [index, proposal] of candidates.entries()) {
        const challenger = evaluateCandidate({
          candidateId: `${parent.candidateId}_LANES_${index}`, sourceAlgorithm: `${parent.sourceAlgorithm}+lane-stack-beam`,
          placements: proposal.placements, unloadedCargo: clone(parent.unloadedCargo), inheritedWarnings: clone(parent.warnings || []),
          inheritedConstraintMeta: { ...parent.constraintMeta, laneStackRepacking: { ...proposal.evidence, parentPlacementHash: parent.placementHash } },
          handlingAssumptions: parent.handlingAssumptions, translationRequested: false,
          sourceRuntimeMs: parent.sourceRuntimeMs, runtimeTieBreakClass: parent.runtimeTieBreakClass,
          generationPhase: 'CUMULATIVE_LANE_STACK_BEAM_REPACK', ...context
        });
        const oldExact = parent.layoutQuality.exactVoidGeometry;
        const nextExact = challenger.layoutQuality.exactVoidGeometry;
        const previousGap = Math.min(...selected.loadedCargo.map(item => item.x));
        const gap = Math.min(...challenger.loadedCargo.map(item => item.x));
        const safe = safePromotion(parent, challenger);
        const geometryPreserved = nextExact.internalVoidVolume <= oldExact.internalVoidVolume + 1
          && nextExact.unexplainedVoidVolume <= oldExact.unexplainedVoidVolume + 1;
        const accepted = safe && geometryPreserved && gap < previousGap - 0.001;
        const comparison = {
          accepted, candidateId: challenger.candidateId, placementHash: challenger.placementHash,
          previousGapMm: Math.min(...parent.loadedCargo.map(item => item.x)), gapMm: gap,
          measurementModel: nextExact.model, oldExact, nextExact,
          voxelEstimates: { oldInternal: parent.layoutQuality.internalVoidVolume, newInternal: challenger.layoutQuality.internalVoidVolume,
            oldUnexplained: parent.voidJustification.unexplainedVoidVolume, newUnexplained: challenger.voidJustification.unexplainedVoidVolume },
          reason: !safe ? 'PHYSICAL_GATE_REGRESSION' : !geometryPreserved ? 'EXACT_INTERNAL_VOID_REGRESSION' : accepted ? 'SMALLER_DEEP_GAP_WITH_EXACT_VOID_AND_PHYSICAL_GATES_PRESERVED' : 'NO_FURTHER_IMPROVEMENT'
        };
        laneStackRepacking.candidates.push(comparison);
        challenger.constraintMeta.laneStackRepacking.comparison = comparison;
        evaluated.push(challenger);
        if (accepted) { selected = challenger; laneStackRepacking.promoted = true; }
      }
    }
    const solveMs = Date.now() - startedAt;
    selected.metrics.solveMs = solveMs;
    selected.metrics.elapsedMs = solveMs;
    selected.metrics.algorithm = 'hybrid-v2.5';
    selected.metrics.solverVersion = '2.6.0';
    selected.metrics.selectedCandidateAlgorithm = selected.sourceAlgorithm;
    selected.metrics.strategy = strategy;
    selected.metrics.densityRegime = densityRegime(cargoList, container);
    selected.metrics.loadDistribution = selected.loadDistribution;
    selected.metrics.portAccessibility = selected.portAccessibility;
    selected.metrics.voidJustification = selected.voidJustification;
    selected.metrics.tightStow = selected.tightStow;
    selected.packagingModel = packagingSummary(cargoList);
    selected.constraintMeta = {
      ...(selected.constraintMeta || {}),
      solverVersion: '2.6.0',
      solverRevision: '2.6.0-rebuild',
      cogNormalization: 'CARGO_COG_FULL_INNER_SPAN_V1',
      officialSolver: 'hybrid-v2.5',
      densityRegime: selected.metrics.densityRegime,
      cargoTruthModel: 'CARGO_PHYSICAL_PROFILE_AND_PACKAGING_PROFILE_V2_5',
      portfolio: {
        maximumCandidates: this.config.maximumCandidates,
        candidatesEvaluated: evaluated.length,
        selectedCandidateId: selected.candidateId,
        selectedCandidateAlgorithm: selected.sourceAlgorithm,
        reason: 'V2_5_CLASS_FIRST_PARETO_LAYOUT_SELECTION',
        selectionOrder: selectionOrder(),
        continuousCogPolicy: 'ONLY_AFTER_GUIDANCE_CLASS_AND_LAYOUT_QUALITY',
        runtimePolicy: 'DETERMINISTIC_RUNTIME_CLASS_FINAL_TIE_BREAK',
        candidateGenerationPhases: [
          'V2.3 tight topology',
          'legal global translation',
          'V2.3 stage translation / local heavy repair',
          'bounded local void repair',
          'bounded same-port compatible-envelope balance repair',
          'same-port whole-wall reorder and constrained rear compaction',
          'bounded small-set floor completion / legal global translation',
          'V2.1 preserved fallback'
        ],
        localRepair: compactRepair(localRepair),
        loadBalanceRepair: compactBalanceRepair(loadBalanceRepair),
        wallOrderRepair: { promoted: wallOrderRepair.promoted, reason: wallOrderRepair.reason, trials: wallOrderRepair.trials, evidence: wallOrderRepair.evidence },
        laneStackRepacking,
        boundedFloorCompletion: floorCompletion ? {
          eligible: true,
          loadedCount: floorCompletion.placements.length,
          exploredStateCount: number(floorCompletion.stageReports?.[0]?.exploredStateCount)
        } : { eligible: false },
        candidates: evaluated.map(candidateSummary)
      },
      portAccessModel: selected.portAccessibility.model,
      fullUnloadPass: selected.portAccessibility.status === 'FULL_UNLOAD_PASS',
      postUnloadStabilityPass: selected.portAccessibility.postUnloadStabilityPass,
      handlingAssumptions: selected.handlingAssumptions
    };
    selected._algorithmId = 'hybrid-v2.5';
    selected._strategyUsed = strategy.toLowerCase();
    selected.warnings = [...(selected.warnings || [])];
    if (selected.handlingAssumptions.length > 0) selected.warnings.push({
      type: 'DERIVED_TEAM_MANUAL_POLICY',
      message: `${selected.handlingAssumptions.length} 件货物采用可追溯的协同人工搬运假设；现场仍需确认。`,
      evidence: selected.handlingAssumptions
    });
    if (selected.voidJustification.unexplainedVoidVolume > 0) selected.warnings.push({
      type: 'UNEXPLAINED_VOID',
      message: `存在 ${round(selected.voidJustification.unexplainedVoidVolume / 1e9)} m³ 未解释剩余空间，根因仍需候选拒绝链证明。`,
      evidence: selected.voidJustification.largestUnexplainedZone
    });
    return selected;
  }
}

function seedCandidate(candidateId, sourceAlgorithm, result, center, deriveTeamManual, sourceRuntimeMs, generationPhase, runtimeTieBreakClass = null) {
  const placements = clone(result.loadedCargo || []);
  const handlingAssumptions = deriveTeamManual ? applyDerivedTeamManual(placements) : [];
  return {
    candidateId,
    sourceAlgorithm,
    placements,
    unloadedCargo: clone(result.unloadedCargo || []),
    inheritedWarnings: clone(result.warnings || []),
    inheritedConstraintMeta: clone(result.constraintMeta || {}),
    handlingAssumptions,
    translationRequested: center,
    sourceRuntimeMs,
    generationPhase,
    runtimeTieBreakClass
  };
}

function evaluateCandidate({ candidateId, sourceAlgorithm, placements, unloadedCargo, inheritedWarnings, inheritedConstraintMeta, handlingAssumptions, translationRequested, sourceRuntimeMs, generationPhase, runtimeTieBreakClass, cargoList, container, strategy, route, caseContext, validator }) {
  const translation = translationRequested ? centerPlan(placements, container) : { shiftX: 0, shiftZ: 0, mode: 'UNCHANGED' };
  renumberLoading(placements, container);
  const validation = validator.validate({ placements, cargoList, container });
  attachStability(placements, validation.stability);
  const operationFeasibility = analyzeOperationFeasibility({ placements, container });
  const portAccessibility = validatePortAccessibility({ placements, container, route, caseContext });
  const layoutQuality = analyzeLayoutQuality({ placements, container, cargoList });
  const securing = analyzeSecuring({ placements, container, layoutQuality });
  const loadDistribution = analyzeLoadDistribution({ placements, container, caseContext });
  const voidJustification = analyzeVoidJustification({ placements, cargoList, container, layoutQuality, route, securing });
  const metrics = calculatePlanMetrics(placements, container, unloadedCargo.length, 0);
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
  metrics.operation = { ...metrics.operation, actualBlockedCount: operationFeasibility.blockedCount, actualOperationPass: operationFeasibility.operationPathPass };
  return {
    candidateId, sourceAlgorithm, loadedCargo: placements, unloadedCargo,
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
