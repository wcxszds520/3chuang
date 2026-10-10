'use strict';

const packingPolicy = require('../config/packingPolicy');
const FastBlockPackingEngine = require('./FastBlockPackingEngine');
const { evaluateInsertionPath } = require('./packing/InsertionPathFeasibility');
const PlanValidator = require('./packing/PlanValidator');
const { legalOrientations, unionArea } = require('./packing/PlanValidator');
const { convexHull, signedDistanceToPolygon } = require('./packing/StabilityAnalyzer');
const {
  calculatePlanMetrics,
  calculateCoG,
  normalizeContainer,
  partitionResidualSpaces,
  intersects,
  volume,
  clamp
} = require('./packing/PlanMetrics');

const STRATEGY_WEIGHTS = Object.freeze({
  SPACE: Object.freeze({ compactness: 0.45, balance: 0.30, operation: 0.15, futureFit: 0.10 }),
  BALANCE: Object.freeze({ compactness: 0.20, balance: 0.60, operation: 0.10, futureFit: 0.10 }),
  OPERATION: Object.freeze({ compactness: 0.10, balance: 0.30, operation: 0.50, futureFit: 0.10 })
});

class HybridConstraintPackingSolverV2 {
  constructor(config = {}) {
    this.config = {
      beamWidth: 4,
      lookaheadDepth: 2,
      candidateLimit: 10,
      rawCandidateLimit: 240,
      maxRepairIterations: 40,
      maxCogRepairIterations: 10,
      maxCogRepairComponents: 16,
      maxCogRepairAxisPositions: 6,
      supportRatioMin: packingPolicy.supportRatioMin,
      contactToleranceMm: packingPolicy.contactToleranceMm,
      collisionToleranceMm: packingPolicy.collisionToleranceMm,
      heavyOnLightRatio: packingPolicy.heavyOnLightRatio,
      supportLoadMultiplier: packingPolicy.supportLoadMultiplier,
      lateralLimitPercent: packingPolicy.cog.lateralLimitPercent,
      longitudinalLimitPercent: packingPolicy.cog.longitudinalLimitPercent,
      ...packingPolicy.stability,
      ...config
    };
    this.validator = config.validator || new PlanValidator(this.config);
    this.palette = ['#346FE8', '#08A6C7', '#ED8B32', '#D6544D', '#7658C9', '#238CC8', '#24A268', '#D5A42B'];
  }

  async generatePackingPlan(cargoList, containerInput, options = {}) {
    const requestedStrategy = normalizeStrategy(options.strategy || this.config.strategy || 'SPACE');
    if (requestedStrategy === 'SPACE' || this.config.portfolioGuardrail === false) {
      return this._generateSingleStrategy(cargoList, containerInput, { ...options, strategy: requestedStrategy });
    }
    const portfolioStartedAt = Date.now();
    const baselineSolver = new HybridConstraintPackingSolverV2({
      ...this.config,
      validator: new PlanValidator(this.config),
      portfolioGuardrail: false
    });
    const spaceBaseline = await baselineSolver._generateSingleStrategy(cargoList, containerInput, { ...options, strategy: 'SPACE' });
    const requested = await this._generateSingleStrategy(cargoList, containerInput, { ...options, strategy: requestedStrategy });
    const selected = selectLexicographicPlan(requested, spaceBaseline, requestedStrategy);
    const portfolioSolveMs = Date.now() - portfolioStartedAt;
    selected.metrics.solveMs = portfolioSolveMs;
    selected.metrics.elapsedMs = portfolioSolveMs;
    selected.metrics.strategy = requestedStrategy;
    selected.metrics.portfolio = {
      requestedStrategy,
      selectedCandidateStrategy: selected === requested ? requestedStrategy : 'SPACE',
      selectionOrder: ['hardViolations', 'stabilityViolations', 'loadedCount', 'LIFO/insertion', 'CoG guardrail', 'strategy objective', 'layout quality', 'runtime']
    };
    selected.constraintMeta = {
      ...selected.constraintMeta,
      portfolioGuardrail: selected.metrics.portfolio
    };
    selected._strategyUsed = requestedStrategy.toLowerCase();
    if (selected !== requested) {
      selected.warnings = [...(selected.warnings || []), {
        type: 'STRATEGY_GUARDRAIL',
        message: `${requestedStrategy} 候选在更高优先级指标上落后，采用 SPACE 候选作为该策略的安全下限`
      }];
    }
    return selected;
  }

  async _generateSingleStrategy(cargoList, containerInput, options = {}) {
    const startedAt = Date.now();
    this.container = normalizeContainer(containerInput);
    this.strategy = normalizeStrategy(options.strategy || this.config.strategy || 'SPACE');
    this.weights = STRATEGY_WEIGHTS[this.strategy];
    const instances = this._expandAndOrder(cargoList);
    this.minPortSequence = instances.length > 0 ? Math.min(...instances.map((item) => number(item.portSequence || 1))) : 1;
    const blockBaseline = await new FastBlockPackingEngine({ debugMode: false }).generatePackingPlan(cargoList, this.container);
    if (blockBaseline.loadedCargo.length === instances.length) {
      const saturatedBlock = this._buildBlockCandidateResult(blockBaseline, cargoList, startedAt);
      if (saturatedBlock.validator.valid && saturatedBlock.metrics.cog.withinPolicy) return saturatedBlock;
    }
    const state = this._initialState();
    const unloadedCargo = [];

    for (let index = 0; index < instances.length; index++) {
      const instance = instances[index];
      if (state.loadedWeight + number(instance.weight) > this.container.maxWeight + 0.001 && this.container.maxWeight > 0) {
        unloadedCargo.push(this._unloaded(instance, 'PAYLOAD'));
        continue;
      }
      const ranked = this._rankCandidates(instance, state, true);
      const valid = ranked.filter((entry) => entry.valid);
      if (valid.length === 0) {
        unloadedCargo.push(this._unloaded(instance, mostUsefulFailure(ranked)));
        continue;
      }
      const selected = this._selectWithBoundedBeam(instances, index, state, valid);
      const rejected = this._evidenceRejections(ranked, selected);
      const placement = this._makePlacement(instance, selected, state.placements.length + 1, rejected);
      this._commit(state, placement, selected.constraint);
    }

    // Block Candidate 是 V2 的正式候选来源之一。它同时保证成熟 V1 块解是
    // V2 的装载数量下限；V2 仍须重新评分、生成证据并通过独立 Validator。
    if (blockBaseline.loadedCargo.length > state.placements.length) {
      const blockCandidate = this._buildBlockCandidateResult(blockBaseline, cargoList, startedAt);
      if (blockCandidate.validator.valid) return blockCandidate;
    }

    const repair = this._localRepair(state.placements);
    let cogGuardrail = this._applyCogGuardrail(state.placements);
    const cogComponentRepair = cogGuardrail.withinPolicy
      ? { iterations: 0, improvements: 0, reason: 'ALREADY_WITHIN_POLICY' }
      : this._repairCogByComponents(state.placements, cargoList);
    if (cogComponentRepair.improvements > 0) cogGuardrail = this._applyCogGuardrail(state.placements);
    this._renumberLoadingSequence(state.placements);
    const solveMs = Date.now() - startedAt;
    const metrics = calculatePlanMetrics(state.placements, this.container, unloadedCargo.length, solveMs);
    const validation = this.validator.validate({ placements: state.placements, cargoList, container: this.container });
    this._attachStability(state.placements, validation.stability);
    metrics.stability = stabilityMetrics(validation.stability);
    metrics.cog.withinPolicy = validation.checks.cog.withinPolicy;
    metrics.cog.recommendationStatus = validation.checks.cog.withinPolicy ? 'WITHIN_RECOMMENDED_PROJECT_POLICY' : 'OUTSIDE_RECOMMENDED_PROJECT_POLICY';
    const warnings = [];
    if (unloadedCargo.length > 0) warnings.push({ type: 'HYBRID_V2_PARTIAL', message: `${unloadedCargo.length} 件未装入` });
    if (validation.warnings.length > 0) warnings.push(...validation.warnings.map((entry) => ({ type: entry.code, message: entry.message, evidence: entry.evidence })));
    if (!validation.valid) warnings.push({ type: 'PLAN_VALIDATOR_INVALID', message: `独立 Validator 发现 ${validation.hardViolationCount} 项硬约束违规` });

    return {
      loadedCargo: state.placements,
      unloadedCargo,
      spaceUtilization: metrics.volumeUtilization,
      totalWeight: metrics.loadedWeight,
      cog: { x: metrics.cog.x, y: metrics.cog.y, z: metrics.cog.z },
      cogOffset: {
        lateral: metrics.cog.lateral,
        longitudinal: metrics.cog.longitudinal,
        direction: metrics.cog.z >= this.container.innerWidth / 2 ? 'right' : 'left',
        percentage: metrics.cog.lateral.toFixed(2)
      },
      metrics: {
        algorithm: 'hybrid-v2',
        strategy: this.strategy,
        elapsedMs: solveMs,
        ...metrics,
        repair: { ...repair, cogGuardrail, cogComponentRepair }
      },
      validator: validation,
      constraintMeta: {
        standardsProfile: 'PORTCUBE project policy + CTU/SOLAS-compatible deterministic constraints',
        enforcedConstraints: ['bounds', 'AABB collision', 'payload', 'legal orientation', 'support union ratio', 'support polygon CoG', 'stack CoG', 'stack/fragile/carrying', 'access-aware LIFO', 'insertion path', 'CoG project-policy guardrail'],
        supportRatioMin: this.config.supportRatioMin,
        doorSide: 'higher x coordinate',
        candidateSources: ['BLOCK', 'EXTREME_POINT', 'RESIDUAL_SPACE'],
        beamWidth: this.config.beamWidth,
        lookaheadDepth: this.config.lookaheadDepth,
        candidateLimit: this.config.candidateLimit,
        strategyWeights: this.weights,
        validatorStatus: validation.status,
        lifoCompliant: validation.checks.lifo,
        insertionCompliant: validation.checks.insertion,
        stabilityStatus: validation.stability.status,
        cogRecommendationStatus: metrics.cog.recommendationStatus
      },
      warnings,
      _strategyUsed: this.strategy.toLowerCase(),
      _algorithmId: 'hybrid-v2'
    };
  }

  _buildBlockCandidateResult(blockBaseline, cargoList, startedAt) {
    const placements = blockBaseline.loadedCargo.map((item) => ({
      ...item,
      placementReason: { ...(item.placementReason || {}) },
      algorithmMeta: { ...(item.algorithmMeta || {}) },
      riskNotes: Array.isArray(item.riskNotes) ? [...item.riskNotes] : []
    }));
    const originalPositions = new Map(placements.map((item) => [item.cargoId, { x: item.x, y: item.y, z: item.z }]));
    const minX = placements.length > 0 ? Math.min(...placements.map((item) => number(item.x))) : 0;
    const maxX = placements.length > 0 ? Math.max(...placements.map((item) => number(item.x) + number(item.l))) : 0;
    const originalValidation = this.validator.validate({ placements, cargoList, container: this.container });
    let globalShift = 0;
    if (this.strategy === 'SPACE') {
      globalShift = -minX;
    } else if (this.strategy === 'BALANCE') {
      const cog = calculateCoG(placements, this.container);
      globalShift = clamp(this.container.innerLength / 2 - cog.x, -minX, this.container.innerLength - maxX);
    } else if (this.strategy === 'OPERATION') {
      globalShift = this.container.innerLength - maxX;
    }
    for (const item of placements) item.x += globalShift;
    let cogGuardrail = this._applyCogGuardrail(placements);
    const cogComponentRepair = cogGuardrail.withinPolicy
      ? { iterations: 0, improvements: 0, reason: 'ALREADY_WITHIN_POLICY' }
      : this._repairCogByComponents(placements, cargoList);
    if (cogComponentRepair.improvements > 0) cogGuardrail = this._applyCogGuardrail(placements);
    globalShift += cogGuardrail.shiftX;
    const globalShiftZ = cogGuardrail.shiftZ;
    let validation = this.validator.validate({ placements, cargoList, container: this.container });
    if (!validation.valid && originalValidation.valid && (Math.abs(globalShift) > 0.001 || Math.abs(globalShiftZ) > 0.001)) {
      for (const item of placements) {
        item.x -= globalShift;
        item.z -= globalShiftZ;
      }
      globalShift = 0;
      cogGuardrail.rolledBackForValidation = true;
      validation = this.validator.validate({ placements, cargoList, container: this.container });
    }
    this._renumberLoadingSequence(placements);
    this._attachStability(placements, validation.stability);
    for (const item of placements) {
      const original = originalPositions.get(item.cargoId);
      const moved = original && Math.abs(number(original.x) - number(item.x)) > 0.001;
      const components = blockEvidenceComponents(this.strategy, item, placements, this.container);
      item.placementReason = {
        ...(item.placementReason || {}),
        strategy: this.strategy,
        candidateSource: 'BLOCK',
        components,
        statement: deterministicReason(this.strategy, 'BLOCK', components),
        localRepair: moved ? { type: 'GLOBAL_AXIS_REPAIR', deltaX: globalShift } : null
      };
      item.candidateTrace = {
        accepted: {
          position: { x: item.x, y: item.y, z: item.z },
          orientation: item.orientation,
          score: weightedScore(components, this.weights),
          components,
          source: 'BLOCK',
          status: 'SELECTED'
        },
        rejected: moved ? [{
          position: original,
          orientation: item.orientation,
          reason: this.strategy === 'BALANCE' ? 'BALANCE_PENALTY' : 'LOW_SCORE',
          status: 'VALID_NOT_SELECTED',
          source: 'BLOCK'
        }] : []
      };
      item.algorithmMeta = {
        ...(item.algorithmMeta || {}),
        algorithm: 'hybrid-v2',
        strategy: this.strategy,
        candidateSource: 'BLOCK',
        blockCandidateBaseline: 'fast-block-v1',
        globalAxisRepairMm: globalShift
      };
    }
    const solveMs = Date.now() - startedAt;
    const unloadedCargo = (blockBaseline.unloadedCargo || []).map((item) => ({ ...item }));
    const metrics = calculatePlanMetrics(placements, this.container, unloadedCargo.length, solveMs);
    metrics.stability = stabilityMetrics(validation.stability);
    metrics.cog.withinPolicy = validation.checks.cog.withinPolicy;
    metrics.cog.recommendationStatus = validation.checks.cog.withinPolicy ? 'WITHIN_RECOMMENDED_PROJECT_POLICY' : 'OUTSIDE_RECOMMENDED_PROJECT_POLICY';
    const warnings = [...(blockBaseline.warnings || [])];
    if (!validation.valid) warnings.push({ type: 'PLAN_VALIDATOR_INVALID', message: `Block Candidate 未通过独立 Validator（${validation.hardViolationCount} 项）` });
    if (validation.warnings.length > 0) warnings.push(...validation.warnings.map((entry) => ({ type: entry.code, message: entry.message, evidence: entry.evidence })));
    return {
      loadedCargo: placements,
      unloadedCargo,
      spaceUtilization: metrics.volumeUtilization,
      totalWeight: metrics.loadedWeight,
      cog: { x: metrics.cog.x, y: metrics.cog.y, z: metrics.cog.z },
      cogOffset: {
        lateral: metrics.cog.lateral,
        longitudinal: metrics.cog.longitudinal,
        direction: metrics.cog.z >= this.container.innerWidth / 2 ? 'right' : 'left',
        percentage: metrics.cog.lateral.toFixed(2)
      },
      metrics: {
        algorithm: 'hybrid-v2',
        strategy: this.strategy,
        elapsedMs: solveMs,
        ...metrics,
        repair: { type: 'bounded-global-axis-repair', globalShiftMm: globalShift, cogGuardrail, cogComponentRepair, loadedCountPreserved: true }
      },
      validator: validation,
      constraintMeta: {
        ...(blockBaseline.constraintMeta || {}),
        candidateSources: ['BLOCK', 'EXTREME_POINT', 'RESIDUAL_SPACE'],
        selectedCandidateSource: 'BLOCK',
        strategyWeights: this.weights,
        validatorStatus: validation.status,
        blockCandidateBaseline: 'fast-block-v1',
        lifoCompliant: validation.checks.lifo,
        insertionCompliant: validation.checks.insertion,
        stabilityStatus: validation.stability.status,
        cogRecommendationStatus: metrics.cog.recommendationStatus
      },
      warnings,
      _strategyUsed: this.strategy.toLowerCase(),
      _algorithmId: 'hybrid-v2'
    };
  }

  _initialState() {
    return {
      placements: [],
      freeSpaces: partitionResidualSpaces([], this.container),
      loadedWeight: 0,
      totalVolume: 0,
      weightedX: 0,
      weightedZ: 0,
      supportLoads: new Map(),
      lastHandling: null
    };
  }

  _expandAndOrder(cargoList) {
    const etaSequence = etaSequenceMap(cargoList);
    const instances = [];
    cargoList.forEach((raw, sourceIndex) => {
      const cargo = {
        ...raw,
        portSequence: raw.eta && etaSequence.has(raw.eta) ? etaSequence.get(raw.eta) : Math.max(1, number(raw.portSequence || 1)),
        sku: raw.sku || raw.name || raw.cargoId || raw.id || `sku_${sourceIndex}`
      };
      const quantity = Math.max(1, Math.floor(number(raw.quantity || 1)));
      for (let index = 0; index < quantity; index++) {
        const sourceCargoId = String(raw.cargoId || raw.id || cargo.sku);
        instances.push({
          ...cargo,
          sourceCargoId,
          instanceIndex: index + 1,
          instanceId: `${sourceCargoId}_${index + 1}`,
          quantity: 1,
          sourceIndex
        });
      }
    });
    return instances.sort((left, right) => {
      if (right.portSequence !== left.portSequence) return right.portSequence - left.portSequence;
      const leftPriority = priority(left);
      const rightPriority = priority(right);
      if (rightPriority !== leftPriority) return rightPriority - leftPriority;
      if (right.sourceIndex !== left.sourceIndex) return right.sourceIndex - left.sourceIndex;
      return left.instanceIndex - right.instanceIndex;
    });
  }

  _rankCandidates(instance, state, includeEvidence) {
    const evaluations = [];
    for (const dims of legalOrientations(instance)) {
      const points = this._candidatePoints(instance, dims, state);
      for (const point of points) {
        const constraint = this._evaluateHardConstraints(instance, dims, point, state);
        if (!constraint.valid) {
          if (includeEvidence) evaluations.push({ valid: false, point, dims, source: point.source, reason: constraint.reason });
          continue;
        }
        const components = this._scoreComponents(instance, dims, point, state, constraint);
        const score = Object.entries(this.weights).reduce((sum, [key, weight]) => sum + components[key] * weight, 0);
        evaluations.push({ valid: true, point, dims, source: point.source, constraint, components, score });
      }
    }
    const valid = evaluations.filter((entry) => entry.valid).sort(compareCandidates).slice(0, this.config.candidateLimit);
    if (!includeEvidence) return valid;
    const invalid = evaluations.filter((entry) => !entry.valid).slice(0, 24);
    return [...valid, ...invalid];
  }

  _candidatePoints(instance, dims, state) {
    const points = [];
    const add = (x, y, z, source) => {
      if (![x, y, z].every(Number.isFinite)) return;
      const px = clamp(x, 0, Math.max(0, this.container.innerLength - dims.l));
      const py = clamp(y, 0, Math.max(0, this.container.innerHeight - dims.h));
      const pz = clamp(z, 0, Math.max(0, this.container.innerWidth - dims.w));
      points.push({ x: px, y: py, z: pz, source });
    };
    add(0, 0, 0, 'EXTREME_POINT');
    add(0, 0, (this.container.innerWidth - dims.w) / 2, 'EXTREME_POINT');
    add(0, 0, this.container.innerWidth - dims.w, 'EXTREME_POINT');
    if (number(instance.portSequence || 1) === this.minPortSequence) {
      add(this.container.innerLength - dims.l, 0, (this.container.innerWidth - dims.w) / 2, 'EXTREME_POINT');
    }

    for (const placement of state.placements) {
      add(number(placement.x) + number(placement.l), 0, number(placement.z), placement.sku === instance.sku ? 'BLOCK' : 'EXTREME_POINT');
      add(number(placement.x), 0, number(placement.z) + number(placement.w), placement.sku === instance.sku ? 'BLOCK' : 'EXTREME_POINT');
      add(number(placement.x), 0, number(placement.z) - dims.w, 'EXTREME_POINT');
      add(number(placement.x), number(placement.y) + number(placement.h), number(placement.z), placement.sku === instance.sku ? 'BLOCK' : 'EXTREME_POINT');
      add(number(placement.x) + number(placement.l), number(placement.y), number(placement.z), 'EXTREME_POINT');
    }

    const fittingResiduals = state.freeSpaces
      .filter((space) => dims.l <= space.l + 0.001 && dims.w <= space.w + 0.001 && dims.h <= space.h + 0.001)
      .sort((left, right) => volume(left) - volume(right))
      .slice(0, 48);
    for (const space of fittingResiduals) {
      add(space.x, space.y, space.z, 'RESIDUAL_SPACE');
      add(space.x, space.y, space.z + space.w - dims.w, 'RESIDUAL_SPACE');
      if (number(instance.portSequence || 1) === this.minPortSequence) {
        add(space.x + space.l - dims.l, space.y, space.z, 'RESIDUAL_SPACE');
      }
    }

    const unique = new Map();
    for (const point of points) {
      const key = `${round(point.x)}:${round(point.y)}:${round(point.z)}`;
      const current = unique.get(key);
      if (!current || sourcePriority(point.source) > sourcePriority(current.source)) unique.set(key, point);
      if (unique.size >= this.config.rawCandidateLimit) break;
    }
    return [...unique.values()];
  }

  _evaluateHardConstraints(instance, dims, point, state) {
    const candidate = { ...point, l: dims.l, w: dims.w, h: dims.h, weight: number(instance.weight) };
    if (!(dims.l > 0 && dims.w > 0 && dims.h > 0)) return failure('ORIENTATION');
    if (candidate.x < 0 || candidate.y < 0 || candidate.z < 0
      || candidate.x + candidate.l > this.container.innerLength + 0.001
      || candidate.y + candidate.h > this.container.innerHeight + 0.001
      || candidate.z + candidate.w > this.container.innerWidth + 0.001) return failure('OUT_OF_BOUNDS');
    if (this.container.maxWeight > 0 && state.loadedWeight + number(instance.weight) > this.container.maxWeight + 0.001) return failure('PAYLOAD');
    const collision = state.placements.find((item) => intersects(candidate, item));
    if (collision) return failure('COLLISION', { cargoId: collision.cargoId });
    const wouldBecomeNewSupport = state.placements.find((item) => Math.abs(candidate.y + candidate.h - number(item.y)) <= this.config.contactToleranceMm
      && horizontalOverlap(candidate, item));
    if (wouldBecomeNewSupport) {
      return failure('INSERTION_PATH', { relationship: 'UNDER_EXISTING_CARGO', cargoId: wouldBecomeNewSupport.cargoId });
    }

    for (const existing of state.placements) {
      const existingPort = number(existing.portSequence || 1);
      const candidatePort = number(instance.portSequence || 1);
      if (candidatePort < existingPort && blocksDoorCorridor(candidate, existing)) return failure('LIFO', { relationship: 'DOOR_CORRIDOR_BLOCK', cargoId: existing.cargoId });
      if (candidatePort > existingPort && blocksDoorCorridor(existing, candidate)) return failure('LIFO', { relationship: 'DOOR_CORRIDOR_BLOCK', cargoId: existing.cargoId });
    }

    const support = this._support(candidate, state.placements);
    if (candidate.y > this.config.contactToleranceMm && support.ratio + 1e-9 < this.config.supportRatioMin) {
      return failure('SUPPORT', { supportRatio: support.ratio, required: this.config.supportRatioMin });
    }
    let stackLevel = 1;
    for (const entry of support.supports) {
      const lower = entry.cargo;
      if (number(instance.portSequence || 1) > number(lower.portSequence || 1)) return failure('LIFO', { relationship: 'SUPPORT_DEPENDENCY_BLOCK', cargoId: lower.cargoId });
      stackLevel = Math.max(stackLevel, number(lower.stackLevel || 1) + 1);
      if (lower.fragile === true) return failure('FRAGILE', { cargoId: lower.cargoId });
      if (lower.stackable === false) return failure('STACK', { cargoId: lower.cargoId });
      if (number(lower.stackLevel || 1) >= Math.max(1, number(lower.maxStackLayers || lower.maxStack || 1))) return failure('STACK', { cargoId: lower.cargoId });
      const lowerWeight = number(lower.weight);
      const upperWeight = number(instance.weight);
      const reinforced = lower.wooden === true || /wood|pallet|reinforced|木/i.test(String(lower.packagingType || ''));
      if (!reinforced && lowerWeight > 0 && upperWeight > lowerWeight * this.config.heavyOnLightRatio) return failure('CARRYING', { cargoId: lower.cargoId });
      const share = support.supportedArea > 0 ? upperWeight * entry.area / support.supportedArea : upperWeight;
      const explicitCapacity = number(lower.maximumSupportedWeightKg || lower.maxSupportedWeight);
      const capacity = explicitCapacity > 0 ? explicitCapacity : Math.max(lowerWeight, 1) * this.config.supportLoadMultiplier;
      if (number(state.supportLoads.get(lower.cargoId)) + share > capacity + 0.001) return failure('CARRYING', { cargoId: lower.cargoId });
    }

    let supportMargin = Math.min(candidate.l, candidate.w) / 2;
    if (candidate.y > this.config.contactToleranceMm) {
      const points = support.supports.flatMap((entry) => [
        { x: entry.x0, z: entry.z0 }, { x: entry.x1, z: entry.z0 },
        { x: entry.x1, z: entry.z1 }, { x: entry.x0, z: entry.z1 }
      ]);
      const polygon = convexHull(points);
      supportMargin = signedDistanceToPolygon({ x: candidate.x + candidate.l / 2, z: candidate.z + candidate.w / 2 }, polygon);
      if (supportMargin < -0.001) return failure('CARGO_COG_OUTSIDE_SUPPORT', { supportMargin, supportPolygon: polygon });
    }

    const stability = evaluateIncrementalStackStability(candidate, instance, support.supports, state.placements, this.container, this.config);
    if (!stability.valid) return failure(stability.code, stability.evidence);

    const insertion = evaluateInsertionPath(candidate, state.placements, this.container);
    if (!insertion.feasible) return failure('INSERTION_PATH', { reasons: insertion.reasons });
    return { valid: true, supportRatio: support.ratio, supportMargin, supports: support.supports, supportedArea: support.supportedArea, stackLevel };
  }

  _support(candidate, placements) {
    if (candidate.y <= this.config.contactToleranceMm) {
      return { ratio: 1, supportedArea: candidate.l * candidate.w, supports: [] };
    }
    const supports = placements.flatMap((lower) => {
      if (Math.abs(number(lower.y) + number(lower.h) - candidate.y) > this.config.contactToleranceMm) return [];
      const x0 = Math.max(candidate.x, number(lower.x));
      const x1 = Math.min(candidate.x + candidate.l, number(lower.x) + number(lower.l));
      const z0 = Math.max(candidate.z, number(lower.z));
      const z1 = Math.min(candidate.z + candidate.w, number(lower.z) + number(lower.w));
      const area = Math.max(0, x1 - x0) * Math.max(0, z1 - z0);
      return area > 0 ? [{ cargo: lower, area, x0, x1, z0, z1 }] : [];
    });
    const supportedArea = unionArea(supports);
    const bottomArea = candidate.l * candidate.w;
    return { ratio: bottomArea > 0 ? supportedArea / bottomArea : 0, supportedArea, supports };
  }

  _scoreComponents(instance, dims, point, state, constraint) {
    const candidateVolume = dims.l * dims.w * dims.h;
    const nextVolume = state.totalVolume + candidateVolume;
    const minX = Math.min(point.x, ...state.placements.map((item) => number(item.x)));
    const maxX = Math.max(point.x + dims.l, ...state.placements.map((item) => number(item.x) + number(item.l)));
    const minY = Math.min(point.y, ...state.placements.map((item) => number(item.y)));
    const maxY = Math.max(point.y + dims.h, ...state.placements.map((item) => number(item.y) + number(item.h)));
    const minZ = Math.min(point.z, ...state.placements.map((item) => number(item.z)));
    const maxZ = Math.max(point.z + dims.w, ...state.placements.map((item) => number(item.z) + number(item.w)));
    const boundingVolume = Math.max(1, (maxX - minX) * (maxY - minY) * (maxZ - minZ));
    const boundingCompactness = clamp(nextVolume / boundingVolume, 0, 1);
    const occupiedDepthScore = 1 - clamp((maxX - minX) / Math.max(this.container.innerLength, 1), 0, 1);
    const restraintQuality = candidateContactQuality(point, dims, state.placements, this.container, this.config);
    const contactScore = clamp(constraint.supportRatio * 0.55 + restraintQuality * 0.45, 0, 1);
    const compactness = clamp(boundingCompactness * 0.50 + occupiedDepthScore * 0.20 + contactScore * 0.30, 0, 1);

    const projectedWeight = state.loadedWeight + number(instance.weight);
    const cogX = projectedWeight > 0 ? (state.weightedX + (point.x + dims.l / 2) * number(instance.weight)) / projectedWeight : this.container.innerLength / 2;
    const cogZ = projectedWeight > 0 ? (state.weightedZ + (point.z + dims.w / 2) * number(instance.weight)) / projectedWeight : this.container.innerWidth / 2;
    const longitudinal = this.container.innerLength > 0 ? Math.abs(cogX - this.container.innerLength / 2) / (this.container.innerLength / 2) : 0;
    const lateral = this.container.innerWidth > 0 ? Math.abs(cogZ - this.container.innerWidth / 2) / (this.container.innerWidth / 2) : 0;
    // Later-port cargo is intentionally compacted toward the closed end first.
    // Treating the partial-plan CoG as final during that phase spreads it across
    // the full length and leaves no room to counterbalance early-port cargo.
    const laterPortBalanceInfluence = this.strategy === 'BALANCE' ? 0.75 : 0.45;
    const finalBalanceInfluence = number(instance.portSequence || 1) === this.minPortSequence ? 1 : laterPortBalanceInfluence;
    const balance = 1 - clamp((lateral * 0.65 + longitudinal * 0.35) * finalBalanceInfluence, 0, 1);

    const method = handling(instance);
    const switchCost = state.lastHandling && state.lastHandling !== method ? 1 : 0;
    const insertionTravel = clamp((this.container.innerLength - (point.x + dims.l / 2)) / Math.max(this.container.innerLength, 1), 0, 1);
    const previous = state.placements[state.placements.length - 1];
    const portBreak = previous && number(previous.portSequence) !== number(instance.portSequence) ? 1 : 0;
    const difficulty = clamp(number(instance.weight) / 100 * 0.6 + candidateVolume / Math.max(this.container.innerLength * this.container.innerWidth * this.container.innerHeight * 0.03, 1) * 0.4, 0, 1);
    const insertionInfluence = number(instance.portSequence || 1) === this.minPortSequence ? 1 : 0.2;
    const operation = 1 - clamp(switchCost * 0.35 + insertionTravel * 0.35 * insertionInfluence + portBreak * 0.15 + difficulty * 0.15, 0, 1);

    const fittingSpace = state.freeSpaces.find((space) => point.x >= space.x - 0.001 && point.y >= space.y - 0.001 && point.z >= space.z - 0.001
      && point.x + dims.l <= space.x + space.l + 0.001
      && point.y + dims.h <= space.y + space.h + 0.001
      && point.z + dims.w <= space.z + space.w + 0.001);
    const waste = fittingSpace ? 1 - clamp(candidateVolume / Math.max(volume(fittingSpace), 1), 0, 1) : 0.5;
    const futureFit = clamp(contactScore * 0.55 + (1 - waste) * 0.45, 0, 1);
    return { compactness, balance, operation, futureFit, contactQuality: contactScore, supportMargin: constraint.supportMargin };
  }

  _selectWithBoundedBeam(instances, index, state, validCandidates) {
    const roots = validCandidates.slice(0, this.config.beamWidth);
    let best = roots[0];
    let bestScore = -Infinity;
    for (const candidate of roots) {
      const simulation = cloneState(state);
      const simulatedPlacement = this._makePlacement(instances[index], candidate, simulation.placements.length + 1, []);
      this._commit(simulation, simulatedPlacement, candidate.constraint);
      const futureScore = this._lookahead(instances, index + 1, simulation, this.config.lookaheadDepth - 1);
      const beamScore = candidate.score + futureScore * 0.35;
      if (beamScore > bestScore + 1e-9 || (Math.abs(beamScore - bestScore) <= 1e-9 && compareCandidates(candidate, best) < 0)) {
        best = { ...candidate, beamScore };
        bestScore = beamScore;
      }
    }
    return best;
  }

  _lookahead(instances, index, state, depth) {
    if (depth <= 0 || index >= instances.length) return 0;
    const candidates = this._rankCandidates(instances[index], state, false).slice(0, this.config.beamWidth);
    if (candidates.length === 0) return -0.4;
    let best = -Infinity;
    for (const candidate of candidates) {
      const simulation = cloneState(state);
      const placement = this._makePlacement(instances[index], candidate, simulation.placements.length + 1, []);
      this._commit(simulation, placement, candidate.constraint);
      const value = candidate.score + this._lookahead(instances, index + 1, simulation, depth - 1) * 0.35;
      best = Math.max(best, value);
    }
    return best;
  }

  _makePlacement(instance, selected, loadingIndex, rejected) {
    const { dims, point, constraint, components } = selected;
    return {
      loadingIndex,
      name: instance.name,
      cargoId: instance.instanceId,
      sourceCargoId: instance.sourceCargoId,
      x: point.x,
      y: point.y,
      z: point.z,
      l: dims.l,
      w: dims.w,
      h: dims.h,
      color: colorFor(instance.sku, this.palette),
      type: cargoType(instance),
      packagingType: instance.packagingType,
      packagingProfile: instance.packagingProfile || null,
      cargoPhysicalProfile: instance.cargoPhysicalProfile || null,
      visualProfile: instance.visualProfile || null,
      weight: number(instance.weight),
      fragile: instance.fragile === true,
      dangerous: instance.dangerous === true,
      stackable: instance.stackable !== false,
      maxStackLayers: Math.max(1, number(instance.maxStackLayers || instance.maxStack || 1)),
      maxSupportedWeight: number(instance.maximumSupportedWeightKg || instance.maxSupportedWeight) || null,
      maximumSupportedWeightKg: number(instance.maximumSupportedWeightKg || instance.maxSupportedWeight) || null,
      orientationPolicy: instance.orientationPolicy || null,
      orientationConstraints: instance.orientationConstraints || null,
      forkEntry: instance.forkEntry || null,
      woodPackagingClass: instance.woodPackagingClass || null,
      dangerousGoodsContext: instance.dangerousGoodsContext || null,
      canRotate: instance.canRotate !== false,
      canInvert: instance.canInvert === true,
      canLayFlat: instance.canLayFlat === true,
      batchId: instance.batchId || `batch_${instance.portSequence}`,
      batchKey: instance.batchKey || instance.batchId || `batch_${instance.portSequence}`,
      batchLabel: instance.batchLabel || makeBatchLabel(instance),
      destinationPort: instance.destinationPort,
      eta: instance.eta,
      portSequence: instance.portSequence,
      sku: instance.sku,
      handlingMethod: handling(instance),
      handlingPolicy: instance.handlingPolicy || 'derived',
      heavy: instance.heavy === true || number(instance.weight) >= 20,
      wooden: instance.wooden === true || /wood|pallet|木/i.test(String(instance.packagingType || '')),
      riskNotes: Array.isArray(instance.riskNotes) ? [...instance.riskNotes] : [],
      source: instance.source || null,
      orientation: dims.legacyLabel || dims.label,
      orientationId: dims.id || dims.label,
      canonicalOrientation: dims.id || dims.label,
      axisMap: dims.axisMap ? { ...dims.axisMap } : null,
      uprightOriginalAxis: dims.uprightOriginalAxis || null,
      inverted: false,
      stackLevel: constraint.stackLevel,
      supportRatio: constraint.supportRatio,
      supportMargin: constraint.supportMargin,
      supportCargoIds: constraint.supports.map((entry) => entry.cargo.cargoId),
      placementReason: {
        strategy: this.strategy,
        candidateSource: point.source,
        orientation: dims.label,
        supportRatio: constraint.supportRatio,
        supportMargin: constraint.supportMargin,
        components,
        statement: deterministicReason(this.strategy, point.source, components)
      },
      candidateTrace: {
        accepted: {
          position: { x: point.x, y: point.y, z: point.z },
          orientation: dims.label,
          score: selected.score,
          beamScore: selected.beamScore ?? selected.score,
          components,
          source: point.source,
          status: 'SELECTED'
        },
        rejected
      },
      algorithmMeta: {
        algorithm: 'hybrid-v2',
        strategy: this.strategy,
        candidateSource: point.source,
        beamWidth: this.config.beamWidth,
        lookaheadDepth: this.config.lookaheadDepth
      }
    };
  }

  _evidenceRejections(ranked, selected) {
    const invalid = ranked.filter((entry) => !entry.valid).slice(0, 3).map((entry) => ({
      position: { x: entry.point.x, y: entry.point.y, z: entry.point.z },
      orientation: entry.dims.label,
      reason: entry.reason.code,
      status: 'INVALID',
      evidence: entry.reason.evidence || {},
      source: entry.source
    }));
    const validNotSelected = ranked.filter((entry) => entry.valid && !sameCandidate(entry, selected)).slice(0, Math.max(0, 3 - invalid.length)).map((entry) => ({
      position: { x: entry.point.x, y: entry.point.y, z: entry.point.z },
      orientation: entry.dims.label,
      reason: this.strategy === 'BALANCE' && entry.components.balance + 0.05 < selected.components.balance ? 'BALANCE_PENALTY' : 'LOW_SCORE',
      status: 'VALID_NOT_SELECTED',
      score: entry.score,
      components: entry.components,
      source: entry.source
    }));
    return [...invalid, ...validNotSelected];
  }

  _commit(state, placement, constraint) {
    state.placements.push(placement);
    state.loadedWeight += number(placement.weight);
    state.totalVolume += volume(placement);
    state.weightedX += (placement.x + placement.l / 2) * number(placement.weight);
    state.weightedZ += (placement.z + placement.w / 2) * number(placement.weight);
    state.lastHandling = placement.handlingMethod;
    const supportedArea = constraint.supports.reduce((sum, entry) => sum + entry.area, 0);
    for (const entry of constraint.supports) {
      const share = supportedArea > 0 ? number(placement.weight) * entry.area / supportedArea : 0;
      state.supportLoads.set(entry.cargo.cargoId, number(state.supportLoads.get(entry.cargo.cargoId)) + share);
    }
    state.freeSpaces = partitionResidualSpaces(state.placements, this.container);
  }

  _localRepair(placements) {
    if (this.strategy !== 'BALANCE' || placements.length < 2) return { maxIterations: this.config.maxRepairIterations, iterations: 0, improvements: 0 };
    let improvements = 0;
    let iterations = 0;
    let current = combinedCogOffset(placements, this.container);
    for (let left = 0; left < placements.length && iterations < this.config.maxRepairIterations; left++) {
      for (let right = left + 1; right < placements.length && iterations < this.config.maxRepairIterations; right++) {
        const a = placements[left];
        const b = placements[right];
        if (!repairCompatible(a, b, placements)) continue;
        iterations++;
        swapPosition(a, b);
        const next = combinedCogOffset(placements, this.container);
        if (next + 1e-6 < current) {
          current = next;
          improvements++;
          markRepair(a);
          markRepair(b);
        } else {
          swapPosition(a, b);
        }
      }
    }
    return { maxIterations: this.config.maxRepairIterations, iterations, improvements };
  }

  _applyCogGuardrail(placements) {
    if (placements.length === 0) return { shiftX: 0, shiftZ: 0, withinPolicy: true };
    const shiftX = guardrailAxisShift(placements, 'x', 'l', this.container.innerLength, this.config.longitudinalLimitPercent, 0);
    const shiftZ = guardrailAxisShift(placements, 'z', 'w', this.container.innerWidth, this.config.lateralLimitPercent, 0);
    if (Math.abs(shiftX) > 0.001 || Math.abs(shiftZ) > 0.001) {
      for (const item of placements) {
        item.x += shiftX;
        item.z += shiftZ;
        markRepair(item);
      }
    }
    const cog = calculateCoG(placements, this.container);
    return {
      shiftX,
      shiftZ,
      withinPolicy: cog.longitudinal <= this.config.longitudinalLimitPercent + 0.001
        && cog.lateral <= this.config.lateralLimitPercent + 0.001,
      lateral: cog.lateral,
      longitudinal: cog.longitudinal,
      policy: { lateralLimitPercent: this.config.lateralLimitPercent, longitudinalLimitPercent: this.config.longitudinalLimitPercent }
    };
  }

  _repairCogByComponents(placements, cargoList) {
    let validation = this.validator.validate({ placements, cargoList, container: this.container });
    if (!validation.valid) return { iterations: 0, improvements: 0, reason: 'INITIAL_PLAN_INVALID' };
    let currentCog = calculateCoG(placements, this.container);
    let currentQuality = cogRepairQuality(currentCog, this.config);
    let improvements = 0;
    let iterations = 0;
    const acceptedMoves = [];

    while (iterations < this.config.maxCogRepairIterations && !withinCogPolicy(currentCog, this.config)) {
      iterations++;
      const components = buildSupportComponents(placements, validation.stability?.supportGraph?.edges || [])
        .map((items) => componentDescriptor(items, placements))
        .sort((left, right) => right.leverage - left.leverage || left.id.localeCompare(right.id))
        .slice(0, this.config.maxCogRepairComponents);
      let best = null;
      for (const component of components) {
        const componentSet = new Set(component.items);
        const otherItems = placements.filter((item) => !componentSet.has(item));
        const desiredX = desiredComponentStart(component, placements, 'x', 'l', this.container.innerLength);
        const desiredZ = desiredComponentStart(component, placements, 'z', 'w', this.container.innerWidth);
        const xPositions = axisCandidatePositions(component, otherItems, 'x', 'l', this.container.innerLength, desiredX, this.config.maxCogRepairAxisPositions);
        const zPositions = axisCandidatePositions(component, otherItems, 'z', 'w', this.container.innerWidth, desiredZ, this.config.maxCogRepairAxisPositions);
        const moves = [];
        if (currentCog.longitudinal > this.config.longitudinalLimitPercent + 0.001) {
          for (const position of xPositions) moves.push({ x: position - component.minX, z: 0 });
        }
        if (currentCog.lateral > this.config.lateralLimitPercent + 0.001) {
          for (const position of zPositions) moves.push({ x: 0, z: position - component.minZ });
        }
        if (currentCog.longitudinal > this.config.longitudinalLimitPercent + 0.001
          && currentCog.lateral > this.config.lateralLimitPercent + 0.001) {
          moves.push({ x: desiredX - component.minX, z: desiredZ - component.minZ });
        }
        for (const move of uniqueMoves(moves)) {
          if (Math.abs(move.x) <= 0.001 && Math.abs(move.z) <= 0.001) continue;
          translateItems(component.items, move.x, move.z);
          const candidateValidation = this.validator.validate({ placements, cargoList, container: this.container });
          const candidateCog = calculateCoG(placements, this.container);
          const candidateQuality = cogRepairQuality(candidateCog, this.config);
          translateItems(component.items, -move.x, -move.z);
          if (!candidateValidation.valid || candidateQuality >= currentQuality - 1e-6) continue;
          if (!best || candidateQuality < best.quality - 1e-6
            || (Math.abs(candidateQuality - best.quality) <= 1e-6 && component.id.localeCompare(best.id) < 0)) {
            best = {
              id: component.id,
              operations: [{ component, move }],
              validation: candidateValidation,
              cog: candidateCog,
              quality: candidateQuality
            };
          }
        }
      }
      for (let left = 0; left < components.length; left++) {
        for (let right = left + 1; right < components.length; right++) {
          const a = components[left];
          const b = components[right];
          if (Math.abs(a.spanX - b.spanX) > 1 || Math.abs(a.spanZ - b.spanZ) > 1) continue;
          const moveA = { x: b.minX - a.minX, z: b.minZ - a.minZ };
          const moveB = { x: a.minX - b.minX, z: a.minZ - b.minZ };
          if (Math.abs(moveA.x) <= 0.001 && Math.abs(moveA.z) <= 0.001) continue;
          translateItems(a.items, moveA.x, moveA.z);
          translateItems(b.items, moveB.x, moveB.z);
          const candidateValidation = this.validator.validate({ placements, cargoList, container: this.container });
          const candidateCog = calculateCoG(placements, this.container);
          const candidateQuality = cogRepairQuality(candidateCog, this.config);
          translateItems(a.items, -moveA.x, -moveA.z);
          translateItems(b.items, -moveB.x, -moveB.z);
          const swapId = `${a.id}:${b.id}`;
          if (!candidateValidation.valid || candidateQuality >= currentQuality - 1e-6) continue;
          if (!best || candidateQuality < best.quality - 1e-6
            || (Math.abs(candidateQuality - best.quality) <= 1e-6 && swapId.localeCompare(best.id) < 0)) {
            best = {
              id: swapId,
              operations: [{ component: a, move: moveA }, { component: b, move: moveB }],
              validation: candidateValidation,
              cog: candidateCog,
              quality: candidateQuality
            };
          }
        }
      }
      if (!best) break;
      for (const operation of best.operations) {
        translateItems(operation.component.items, operation.move.x, operation.move.z);
        for (const item of operation.component.items) markRepair(item);
      }
      validation = this.validator.validate({ placements, cargoList, container: this.container });
      currentCog = calculateCoG(placements, this.container);
      currentQuality = cogRepairQuality(currentCog, this.config);
      improvements++;
      acceptedMoves.push({
        operations: best.operations.map((operation) => ({
          cargoIds: operation.component.items.map((item) => item.cargoId),
          shiftX: operation.move.x,
          shiftZ: operation.move.z
        })),
        quality: currentQuality
      });
    }
    return { iterations, improvements, withinPolicy: withinCogPolicy(currentCog, this.config), acceptedMoves };
  }

  _attachStability(placements, stability) {
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

  _renumberLoadingSequence(placements) {
    const ordered = [...placements].sort((a, b) => number(a.x) - number(b.x) || number(a.y) - number(b.y) || number(a.z) - number(b.z));
    ordered.forEach((item, index) => { item.loadingIndex = index + 1; });
  }

  _unloaded(instance, reason) {
    return { ...instance, cargoId: instance.instanceId, quantity: 1, reason };
  }
}

function cloneState(state) {
  return {
    placements: state.placements.map((item) => ({ ...item })),
    freeSpaces: state.freeSpaces.map((space) => ({ ...space })),
    loadedWeight: state.loadedWeight,
    totalVolume: state.totalVolume,
    weightedX: state.weightedX,
    weightedZ: state.weightedZ,
    supportLoads: new Map(state.supportLoads),
    lastHandling: state.lastHandling
  };
}

function priority(cargo) {
  const cargoVolume = number(cargo.length) * number(cargo.width) * number(cargo.height);
  return (cargo.stackable === false ? 5e12 : 0)
    + (cargo.fragile === true ? 4e12 : 0)
    + number(cargo.weight) * 1e9
    + cargoVolume;
}

function etaSequenceMap(cargoList) {
  const values = [...new Set(cargoList.map((cargo) => cargo.eta).filter(Boolean))].sort();
  return new Map(values.map((value, index) => [value, index + 1]));
}

function mostUsefulFailure(ranked) {
  const counts = new Map();
  for (const entry of ranked.filter((candidate) => !candidate.valid)) counts.set(entry.reason.code, number(counts.get(entry.reason.code)) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] || 'NO_FEASIBLE_CANDIDATE';
}

function failure(code, evidence = {}) {
  return { valid: false, reason: { code, evidence } };
}

function compareCandidates(left, right) {
  if (!right) return -1;
  if (Math.abs(right.score - left.score) > 1e-9) return right.score - left.score;
  if (left.point.x !== right.point.x) return left.point.x - right.point.x;
  if (left.point.y !== right.point.y) return left.point.y - right.point.y;
  if (left.point.z !== right.point.z) return left.point.z - right.point.z;
  return left.dims.label.localeCompare(right.dims.label);
}

function sameCandidate(left, right) {
  return left.dims.label === right.dims.label && round(left.point.x) === round(right.point.x)
    && round(left.point.y) === round(right.point.y) && round(left.point.z) === round(right.point.z);
}

function sourcePriority(source) {
  return source === 'BLOCK' ? 3 : source === 'RESIDUAL_SPACE' ? 2 : 1;
}

function blocksDoorCorridor(target, blocker, tolerance = 1) {
  return number(blocker.x) + tolerance >= number(target.x) + number(target.l)
    && overlap1d(number(target.y), number(target.h), number(blocker.y), number(blocker.h)) > 0
    && overlap1d(number(target.z), number(target.w), number(blocker.z), number(blocker.w)) > 0;
}

function evaluateIncrementalStackStability(candidate, instance, directSupports, placements, container, policy) {
  const hardLimit = number(policy.hardUnrestrainedSlenderness || 3.5);
  if (directSupports.length === 0
    && number(candidate.h) / Math.max(number(candidate.l), 0.001) <= hardLimit
    && number(candidate.h) / Math.max(number(candidate.w), 0.001) <= hardLimit) {
    return { valid: true };
  }
  const prospective = {
    ...candidate,
    cargoId: `__candidate_${instance.instanceId || instance.cargoId || 'cargo'}`,
    weight: number(instance.weight),
    supportCargoIds: directSupports.map((entry) => entry.cargo.cargoId)
  };
  const byId = new Map(placements.map((item) => [String(item.cargoId), item]));
  byId.set(prospective.cargoId, prospective);
  const ancestorIds = collectAncestorIds(prospective.supportCargoIds, byId);
  for (const ancestorId of ancestorIds) {
    const ancestor = byId.get(ancestorId);
    if (!ancestor) continue;
    const descendants = collectPlacementDescendants(ancestorId, [...placements, prospective]);
    const stack = [ancestor, ...descendants];
    const polygon = placementSupportPolygon(ancestor, placements, policy);
    const totalMass = stack.reduce((sum, item) => sum + Math.max(number(item.weight), 1), 0);
    const cog = stack.reduce((acc, item) => {
      const itemMass = Math.max(number(item.weight), 1);
      acc.x += (number(item.x) + number(item.l) / 2) * itemMass;
      acc.z += (number(item.z) + number(item.w) / 2) * itemMass;
      return acc;
    }, { x: 0, z: 0 });
    cog.x /= Math.max(totalMass, 1);
    cog.z /= Math.max(totalMass, 1);
    const margin = signedDistanceToPolygon(cog, polygon);
    if (margin < -0.001) {
      return {
        valid: false,
        code: 'STACK_COG_OUTSIDE_SUPPORT',
        evidence: { cargoId: ancestor.cargoId, supportMargin: margin, stackCoG: cog, totalMass, supportPolygon: polygon }
      };
    }
  }

  const rootIds = ancestorIds.filter((id) => {
    const item = byId.get(id);
    return item && (number(item.y) <= number(policy.contactToleranceMm || 2) || !Array.isArray(item.supportCargoIds) || item.supportCargoIds.length === 0);
  });
  if (number(prospective.y) <= number(policy.contactToleranceMm || 2)) rootIds.push(prospective.cargoId);
  for (const rootId of [...new Set(rootIds)]) {
    const root = byId.get(rootId);
    if (!root) continue;
    const stack = [root, ...collectPlacementDescendants(rootId, [...placements, prospective])];
    const stackSet = new Set(stack.map((item) => item.cargoId));
    const height = stack.reduce((max, item) => Math.max(max, number(item.y) + number(item.h)), number(root.y)) - number(root.y);
    const lengthSlenderness = height / Math.max(number(root.l), 0.001);
    const widthSlenderness = height / Math.max(number(root.w), 0.001);
    const restraint = stackBilateralRestraint(stack, stackSet, [...placements, prospective], container, policy);
    const lengthInvalid = lengthSlenderness > number(policy.hardUnrestrainedSlenderness || 3.5) && !restraint.rear && !restraint.front;
    const widthInvalid = widthSlenderness > number(policy.hardUnrestrainedSlenderness || 3.5) && !restraint.left && !restraint.right;
    if (lengthInvalid || widthInvalid) {
      return {
        valid: false,
        code: 'FREE_STANDING_TALL_STACK',
        evidence: {
          cargoId: root.cargoId,
          slenderness: { length: lengthSlenderness, width: widthSlenderness, stackHeight: height },
          restraint,
          hardUnrestrainedSlenderness: number(policy.hardUnrestrainedSlenderness || 3.5)
        }
      };
    }
  }
  return { valid: true };
}

function collectAncestorIds(startIds, byId) {
  const result = [];
  const seen = new Set();
  const queue = [...(startIds || []).map(String)];
  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    const item = byId.get(id);
    for (const parentId of item?.supportCargoIds || []) queue.push(String(parentId));
  }
  return result;
}

function collectPlacementDescendants(rootId, placements) {
  const result = [];
  const seen = new Set([String(rootId)]);
  const queue = [String(rootId)];
  while (queue.length > 0) {
    const id = queue.shift();
    for (const item of placements) {
      if (seen.has(String(item.cargoId))) continue;
      if (!(item.supportCargoIds || []).map(String).includes(id)) continue;
      seen.add(String(item.cargoId));
      result.push(item);
      queue.push(String(item.cargoId));
    }
  }
  return result;
}

function placementSupportPolygon(item, placements, policy) {
  if (number(item.y) <= number(policy.contactToleranceMm || 2)) {
    return [
      { x: number(item.x), z: number(item.z) },
      { x: number(item.x) + number(item.l), z: number(item.z) },
      { x: number(item.x) + number(item.l), z: number(item.z) + number(item.w) },
      { x: number(item.x), z: number(item.z) + number(item.w) }
    ];
  }
  const supporters = placements.filter((lower) => (item.supportCargoIds || []).includes(lower.cargoId));
  return convexHull(supporters.flatMap((lower) => {
    const x0 = Math.max(number(item.x), number(lower.x));
    const x1 = Math.min(number(item.x) + number(item.l), number(lower.x) + number(lower.l));
    const z0 = Math.max(number(item.z), number(lower.z));
    const z1 = Math.min(number(item.z) + number(item.w), number(lower.z) + number(lower.w));
    return [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
  }));
}

function stackBilateralRestraint(stack, stackSet, placements, container, policy) {
  const result = { left: false, right: false, rear: false, front: false };
  for (const item of stack) {
    for (const direction of Object.keys(result)) {
      if (hasMeaningfulDirectionalContact(item, direction, stackSet, placements, container, policy)) result[direction] = true;
    }
  }
  return {
    ...result,
    lateralBilateral: result.left && result.right,
    longitudinalBilateral: result.rear && result.front
  };
}

function hasMeaningfulDirectionalContact(item, direction, stackSet, placements, container, policy) {
  const tolerance = number(policy.contactGapToleranceMm || 30);
  const meaningful = number(policy.meaningfulContactRatio || 0.35);
  const wallGap = direction === 'left' ? number(item.z)
    : direction === 'right' ? container.innerWidth - (number(item.z) + number(item.w))
      : direction === 'rear' ? number(item.x) : container.innerLength - (number(item.x) + number(item.l));
  if (wallGap <= tolerance + 0.001) return true;
  for (const other of placements) {
    if (other === item || stackSet.has(String(other.cargoId))) continue;
    const vertical = overlap1d(number(item.y), number(item.h), number(other.y), number(other.h));
    if (vertical <= 0) continue;
    const xOverlap = overlap1d(number(item.x), number(item.l), number(other.x), number(other.l));
    const zOverlap = overlap1d(number(item.z), number(item.w), number(other.z), number(other.w));
    let gap = Infinity;
    let ratio = 0;
    if (direction === 'left' && number(other.z) + number(other.w) <= number(item.z) + 0.001) {
      gap = number(item.z) - (number(other.z) + number(other.w));
      ratio = xOverlap * vertical / Math.max(number(item.l) * number(item.h), 1);
    } else if (direction === 'right' && number(other.z) >= number(item.z) + number(item.w) - 0.001) {
      gap = number(other.z) - (number(item.z) + number(item.w));
      ratio = xOverlap * vertical / Math.max(number(item.l) * number(item.h), 1);
    } else if (direction === 'rear' && number(other.x) + number(other.l) <= number(item.x) + 0.001) {
      gap = number(item.x) - (number(other.x) + number(other.l));
      ratio = zOverlap * vertical / Math.max(number(item.w) * number(item.h), 1);
    } else if (direction === 'front' && number(other.x) >= number(item.x) + number(item.l) - 0.001) {
      gap = number(other.x) - (number(item.x) + number(item.l));
      ratio = zOverlap * vertical / Math.max(number(item.w) * number(item.h), 1);
    }
    if (gap <= tolerance + 0.001 && ratio >= meaningful) return true;
  }
  return false;
}

function candidateContactQuality(point, dims, placements, container, policy) {
  const tolerance = number(policy.contactGapToleranceMm || 30);
  const meaningful = number(policy.meaningfulContactRatio || 0.35);
  const candidate = { x: point.x, y: point.y, z: point.z, l: dims.l, w: dims.w, h: dims.h };
  const ratios = {
    left: candidate.z <= tolerance ? 1 : 0,
    right: container.innerWidth - (candidate.z + candidate.w) <= tolerance ? 1 : 0,
    rear: candidate.x <= tolerance ? 1 : 0,
    front: container.innerLength - (candidate.x + candidate.l) <= tolerance ? 1 : 0
  };
  for (const other of placements) {
    const vertical = overlap1d(candidate.y, candidate.h, number(other.y), number(other.h));
    if (vertical <= 0) continue;
    const xOverlap = overlap1d(candidate.x, candidate.l, number(other.x), number(other.l));
    const zOverlap = overlap1d(candidate.z, candidate.w, number(other.z), number(other.w));
    const leftGap = candidate.z - (number(other.z) + number(other.w));
    const rightGap = number(other.z) - (candidate.z + candidate.w);
    const rearGap = candidate.x - (number(other.x) + number(other.l));
    const frontGap = number(other.x) - (candidate.x + candidate.l);
    if (leftGap >= -0.001 && leftGap <= tolerance) ratios.left = Math.max(ratios.left, xOverlap * vertical / Math.max(candidate.l * candidate.h, 1));
    if (rightGap >= -0.001 && rightGap <= tolerance) ratios.right = Math.max(ratios.right, xOverlap * vertical / Math.max(candidate.l * candidate.h, 1));
    if (rearGap >= -0.001 && rearGap <= tolerance) ratios.rear = Math.max(ratios.rear, zOverlap * vertical / Math.max(candidate.w * candidate.h, 1));
    if (frontGap >= -0.001 && frontGap <= tolerance) ratios.front = Math.max(ratios.front, zOverlap * vertical / Math.max(candidate.w * candidate.h, 1));
  }
  const scored = Object.values(ratios).map((ratio) => ratio >= meaningful ? clamp(ratio, 0, 1) : ratio * 0.4);
  return scored.reduce((sum, value) => sum + value, 0) / scored.length;
}

function guardrailAxisShift(placements, coordinate, dimension, containerSize, limitPercent, desiredShift = 0) {
  if (placements.length === 0 || !(containerSize > 0)) return 0;
  const minimum = Math.min(...placements.map((item) => number(item[coordinate])));
  const maximum = Math.max(...placements.map((item) => number(item[coordinate]) + number(item[dimension])));
  const minShift = -minimum;
  const maxShift = containerSize - maximum;
  const totalMass = placements.reduce((sum, item) => sum + Math.max(number(item.weight), 1), 0);
  const cog = placements.reduce((sum, item) => sum
    + (number(item[coordinate]) + number(item[dimension]) / 2) * Math.max(number(item.weight), 1), 0) / Math.max(totalMass, 1);
  const half = containerSize / 2;
  const allowedOffset = half * number(limitPercent) / 100;
  const policyMinShift = half - allowedOffset - cog;
  const policyMaxShift = half + allowedOffset - cog;
  const feasibleMin = Math.max(minShift, policyMinShift);
  const feasibleMax = Math.min(maxShift, policyMaxShift);
  if (feasibleMin <= feasibleMax + 0.001) return clamp(desiredShift, feasibleMin, feasibleMax);
  return clamp(half - cog, minShift, maxShift);
}

function stabilityMetrics(stability) {
  if (!stability) return null;
  return {
    model: stability.model,
    dataClassification: stability.dataClassification,
    status: stability.status,
    invalidCount: stability.invalidCount,
    warningCount: stability.warningCount,
    ...stability.summary,
    policy: stability.policy
  };
}

function buildSupportComponents(placements, edges) {
  const byId = new Map(placements.map((item) => [String(item.cargoId), item]));
  const parent = new Map([...byId.keys()].map((id) => [id, id]));
  const find = (id) => {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current);
    let cursor = id;
    while (parent.get(cursor) !== cursor) {
      const next = parent.get(cursor);
      parent.set(cursor, current);
      cursor = next;
    }
    return current;
  };
  for (const edge of edges) {
    const left = String(edge.supporterId);
    const right = String(edge.supportedId);
    if (!parent.has(left) || !parent.has(right)) continue;
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(b, a);
  }
  const groups = new Map();
  for (const [id, item] of byId.entries()) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(item);
  }
  return [...groups.values()];
}

function componentDescriptor(items, placements) {
  const minX = Math.min(...items.map((item) => number(item.x)));
  const maxX = Math.max(...items.map((item) => number(item.x) + number(item.l)));
  const minZ = Math.min(...items.map((item) => number(item.z)));
  const maxZ = Math.max(...items.map((item) => number(item.z) + number(item.w)));
  const massValue = items.reduce((sum, item) => sum + Math.max(number(item.weight), 1), 0);
  const cogX = items.reduce((sum, item) => sum + (number(item.x) + number(item.l) / 2) * Math.max(number(item.weight), 1), 0) / Math.max(massValue, 1);
  const cogZ = items.reduce((sum, item) => sum + (number(item.z) + number(item.w) / 2) * Math.max(number(item.weight), 1), 0) / Math.max(massValue, 1);
  const planMinX = Math.min(...placements.map((item) => number(item.x)));
  const planMaxX = Math.max(...placements.map((item) => number(item.x) + number(item.l)));
  const planMinZ = Math.min(...placements.map((item) => number(item.z)));
  const planMaxZ = Math.max(...placements.map((item) => number(item.z) + number(item.w)));
  return {
    id: items.map((item) => String(item.cargoId)).sort()[0],
    items,
    minX,
    maxX,
    minZ,
    maxZ,
    spanX: maxX - minX,
    spanZ: maxZ - minZ,
    mass: massValue,
    cogX,
    cogZ,
    leverage: massValue * (Math.abs(cogX - (planMinX + planMaxX) / 2) + Math.abs(cogZ - (planMinZ + planMaxZ) / 2))
  };
}

function desiredComponentStart(component, placements, coordinate, dimension, containerSize) {
  const totalMass = placements.reduce((sum, item) => sum + Math.max(number(item.weight), 1), 0);
  const planCog = placements.reduce((sum, item) => sum
    + (number(item[coordinate]) + number(item[dimension]) / 2) * Math.max(number(item.weight), 1), 0) / Math.max(totalMass, 1);
  const componentCog = coordinate === 'x' ? component.cogX : component.cogZ;
  const componentMin = coordinate === 'x' ? component.minX : component.minZ;
  const componentSpan = coordinate === 'x' ? component.spanX : component.spanZ;
  const delta = (containerSize / 2 - planCog) * totalMass / Math.max(component.mass, 1);
  const desiredCog = componentCog + delta;
  return clamp(componentMin + (desiredCog - componentCog), 0, Math.max(0, containerSize - componentSpan));
}

function axisCandidatePositions(component, otherItems, coordinate, dimension, containerSize, desired, limit) {
  const span = coordinate === 'x' ? component.spanX : component.spanZ;
  const current = coordinate === 'x' ? component.minX : component.minZ;
  const values = [desired, current, 0, Math.max(0, containerSize - span), Math.max(0, (containerSize - span) / 2)];
  for (const item of otherItems) {
    values.push(number(item[coordinate]) - span);
    values.push(number(item[coordinate]) + number(item[dimension]));
  }
  return [...new Set(values.map((value) => round(clamp(value, 0, Math.max(0, containerSize - span)))))]
    .sort((left, right) => Math.abs(left - desired) - Math.abs(right - desired) || left - right)
    .slice(0, Math.max(1, number(limit)));
}

function translateItems(items, shiftX, shiftZ) {
  for (const item of items) {
    item.x += shiftX;
    item.z += shiftZ;
  }
}

function uniqueMoves(moves) {
  const unique = new Map();
  for (const move of moves) {
    const normalized = { x: round(move.x), z: round(move.z) };
    unique.set(`${normalized.x}:${normalized.z}`, normalized);
  }
  return [...unique.values()];
}

function cogRepairQuality(cog, config) {
  const lateralLimit = Math.max(number(config.lateralLimitPercent), 0.001);
  const longitudinalLimit = Math.max(number(config.longitudinalLimitPercent), 0.001);
  const policyExcess = Math.max(0, number(cog.lateral) - lateralLimit) / lateralLimit
    + Math.max(0, number(cog.longitudinal) - longitudinalLimit) / longitudinalLimit;
  return policyExcess * 1000 + number(cog.lateral) * 0.65 + number(cog.longitudinal) * 0.35;
}

function withinCogPolicy(cog, config) {
  return number(cog.lateral) <= number(config.lateralLimitPercent) + 0.001
    && number(cog.longitudinal) <= number(config.longitudinalLimitPercent) + 0.001;
}

function selectLexicographicPlan(requested, baseline, strategy) {
  return comparePlanQuality(requested, baseline, strategy) <= 0 ? requested : baseline;
}

function comparePlanQuality(left, right, strategy) {
  const leftValidation = left.validator || {};
  const rightValidation = right.validator || {};
  const pairs = [
    [number(leftValidation.hardViolationCount), number(rightValidation.hardViolationCount)],
    [number(left.metrics?.stability?.invalidCount), number(right.metrics?.stability?.invalidCount)],
    [-number(left.metrics?.loadedCount), -number(right.metrics?.loadedCount)],
    [leftValidation.checks?.lifo && leftValidation.checks?.insertion ? 0 : 1, rightValidation.checks?.lifo && rightValidation.checks?.insertion ? 0 : 1],
    [left.metrics?.cog?.withinPolicy === false ? 1 : 0, right.metrics?.cog?.withinPolicy === false ? 1 : 0],
    [strategyObjectiveCost(left, strategy), strategyObjectiveCost(right, strategy)],
    [number(left.metrics?.stability?.unrestrainedTallStacks), number(right.metrics?.stability?.unrestrainedTallStacks)],
    [-number(left.metrics?.stability?.heightSmoothnessScore), -number(right.metrics?.stability?.heightSmoothnessScore)],
    [number(left.metrics?.stability?.narrowVoidVolume) + number(left.metrics?.stability?.enclosedVoidVolume),
      number(right.metrics?.stability?.narrowVoidVolume) + number(right.metrics?.stability?.enclosedVoidVolume)],
    [number(left.metrics?.solveMs), number(right.metrics?.solveMs)]
  ];
  for (const [a, b] of pairs) {
    if (Math.abs(a - b) > 1e-9) return a - b;
  }
  return 0;
}

function strategyObjectiveCost(result, strategy) {
  if (strategy === 'BALANCE') return number(result.metrics?.cog?.lateral) * 0.65 + number(result.metrics?.cog?.longitudinal) * 0.35;
  if (strategy === 'OPERATION') return number(result.metrics?.operation?.totalCost);
  return -number(result.metrics?.compactness?.boundingCompactness);
}

function overlap1d(startA, sizeA, startB, sizeB) {
  return Math.max(0, Math.min(startA + sizeA, startB + sizeB) - Math.max(startA, startB));
}

function normalizeStrategy(strategy) {
  const normalized = String(strategy || 'SPACE').trim().toUpperCase();
  return STRATEGY_WEIGHTS[normalized] ? normalized : 'SPACE';
}

function handling(cargo) {
  return cargo.handlingMethod || (number(cargo.weight) >= 20 ? 'forklift' : 'manual');
}

function cargoType(cargo) {
  if (cargo.fragile === true) return 'fragile';
  if (number(cargo.weight) >= 20) return 'heavy';
  return 'normal';
}

function makeBatchLabel(cargo) {
  if (cargo.destinationPort && cargo.eta) return `${cargo.destinationPort} · ${cargo.eta}`;
  return cargo.destinationPort || cargo.eta || `Batch ${cargo.portSequence || 1}`;
}

function deterministicReason(strategy, source, components) {
  const labels = {
    SPACE: `空间紧凑度 ${percent(components.compactness)}，保留连续剩余空间`,
    BALANCE: `重心评分 ${percent(components.balance)}，在合法候选中降低偏移`,
    OPERATION: `作业评分 ${percent(components.operation)}，减少搬运切换与插入距离`
  };
  return `${source} 候选通过全部硬约束；${labels[strategy]}`;
}

function blockEvidenceComponents(strategy, item, placements, container) {
  const planCog = calculateCoG(placements, container);
  const minX = Math.min(...placements.map((placement) => number(placement.x)));
  const maxX = Math.max(...placements.map((placement) => number(placement.x) + number(placement.l)));
  const depthScore = 1 - clamp((maxX - minX) / Math.max(container.innerLength, 1), 0, 1);
  const compactness = clamp(0.72 + depthScore * 0.28, 0, 1);
  const balance = 1 - clamp(planCog.lateral / 100 * 0.65 + planCog.longitudinal / 100 * 0.35, 0, 1);
  const insertionTravel = clamp((container.innerLength - (number(item.x) + number(item.l) / 2)) / Math.max(container.innerLength, 1), 0, 1);
  const operation = 1 - insertionTravel * 0.55;
  const futureFit = strategy === 'SPACE' ? 0.85 : 0.7;
  return { compactness, balance, operation, futureFit };
}

function weightedScore(components, weights) {
  return Object.entries(weights).reduce((sum, [key, weight]) => sum + number(components[key]) * weight, 0);
}

function percent(value) {
  return `${(clamp(value, 0, 1) * 100).toFixed(0)}%`;
}

function colorFor(key, palette) {
  let hash = 0;
  for (const char of String(key || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function combinedCogOffset(placements, container) {
  const cog = calculateCoG(placements, container);
  return cog.lateral * 0.65 + cog.longitudinal * 0.35;
}

function repairCompatible(a, b, placements) {
  if (number(a.portSequence) !== number(b.portSequence) || handling(a) !== handling(b)) return false;
  if (number(a.y) > 0.001 || number(b.y) > 0.001) return false;
  if (a.l !== b.l || a.w !== b.w || a.h !== b.h || number(a.weight) === number(b.weight)) return false;
  const supportsCargo = (base) => placements.some((item) => item !== base
    && Math.abs(number(item.y) - (number(base.y) + number(base.h))) <= 0.001
    && horizontalOverlap(item, base));
  return !supportsCargo(a) && !supportsCargo(b);
}

function horizontalOverlap(a, b) {
  return number(a.x) < number(b.x) + number(b.l) - 0.001
    && number(a.x) + number(a.l) > number(b.x) + 0.001
    && number(a.z) < number(b.z) + number(b.w) - 0.001
    && number(a.z) + number(a.w) > number(b.z) + 0.001;
}

function swapPosition(a, b) {
  const position = { x: a.x, y: a.y, z: a.z };
  a.x = b.x; a.y = b.y; a.z = b.z;
  b.x = position.x; b.y = position.y; b.z = position.z;
}

function markRepair(item) {
  item.algorithmMeta = { ...item.algorithmMeta, localRepair: true };
  if (item.candidateTrace?.accepted) item.candidateTrace.accepted.position = { x: item.x, y: item.y, z: item.z };
}

function round(value) {
  return Math.round(number(value) * 1000) / 1000;
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = HybridConstraintPackingSolverV2;
module.exports.STRATEGY_WEIGHTS = STRATEGY_WEIGHTS;
module.exports.normalizeStrategy = normalizeStrategy;
