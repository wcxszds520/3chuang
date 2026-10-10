'use strict';

const packingPolicy = require('../../config/packingPolicy');
const { legalOrientations } = require('./PlanValidator');
const { normalizeContainer, clamp } = require('./PlanMetrics');
const { fitsDoor } = require('./InsertionPathFeasibility');
const { explicitTopLoadsPass } = require('./TopLoadConstraint');

const EPSILON = 0.001;

/**
 * Builds mixed-compatible Width × Height layers and advances them along X.
 * SKU and batch identity are deliberately absent from spatial compatibility;
 * port/access, orientation, handling, support, stack and carrying rules remain.
 */
class CrossSectionLayerBuilder {
  constructor(config = {}) {
    this.config = {
      supportRatioMin: packingPolicy.supportRatioMin,
      contactToleranceMm: packingPolicy.contactToleranceMm,
      heavyOnLightRatio: packingPolicy.heavyOnLightRatio,
      supportLoadMultiplier: packingPolicy.supportLoadMultiplier,
      maximumLayerVariants: 5,
      maximumDepthCandidates: 8,
      candidatePasses: 2,
      columnCandidateMode: 'LOW_FILL_THEN_VOID',
      columnCandidateModeByPort: null,
      layerOrderingModeByPort: null,
      ...config
    };
  }

  build(cargoList = [], containerInput = {}, options = {}) {
    this.container = normalizeContainer(containerInput);
    this.strategy = normalizeStrategy(options.strategy);
    const instances = expandInstances(cargoList);
    const stageMap = groupByPort(instances);
    const portSequence = [...stageMap.keys()].sort((left, right) => right - left);
    let remaining = [...instances];
    const layers = [];
    const unloaded = [];
    const stageReports = [];
    let cursorX = 0;
    let cumulativeMomentZ = 0;
    let cumulativeWeight = 0;

    for (const port of portSequence) {
      const availableDepth = Math.max(0, this.container.innerLength - cursorX);
      const stageInputCount = remaining.filter((item) => item.portSequence === port).length;
      if (stageInputCount === 0) continue;
      const stage = this._buildBestStage(remaining, availableDepth, port);
      for (const layer of stage.layers) {
        const mirrored = chooseMirroring(layer.placements, this.container, cumulativeMomentZ, cumulativeWeight);
        const layerPlacements = mirrored.placements.map((placement) => this._toPlacement(placement, cursorX, layers.length + 1));
        for (const placement of layerPlacements) {
          cumulativeWeight += number(placement.weight);
          cumulativeMomentZ += (number(placement.z) + number(placement.w) / 2) * number(placement.weight);
        }
        layers.push({
          index: layers.length,
          portSequence: port,
          x: cursorX,
          depth: layer.depth,
          fillRatio: layer.fillRatio,
          mixedSkuCount: new Set(layerPlacements.map((item) => item.sku)).size,
          mirrored: mirrored.mirrored,
          placements: layerPlacements
        });
        cursorX += layer.depth;
      }
      const loadedIds = new Set(stage.layers.flatMap((layer) => layer.placements.map((placement) => placement.instance.instanceId)));
      remaining = remaining.filter((item) => !loadedIds.has(item.instanceId));
      stageReports.push({
        portSequence: port,
        inputCount: stageInputCount,
        loadedCount: stage.layers.reduce((sum, layer) => sum + layer.placements.filter((placement) => placement.instance.portSequence === port).length, 0),
        fillerCount: stage.layers.reduce((sum, layer) => sum + layer.placements.filter((placement) => placement.instance.portSequence < port).length, 0),
        layerCount: stage.layers.length,
        occupiedDepth: stage.occupiedDepth,
        averageFill: average(stage.layers.map((layer) => layer.fillRatio)),
        variant: stage.variant
      });
    }

    unloaded.push(...remaining.map((item) => ({ ...item, cargoId: item.instanceId, quantity: 1, reason: 'NO_CROSS_SECTION_LAYER_CAPACITY' })));

    const placements = layers.flatMap((layer) => layer.placements);
    return {
      placements,
      unloaded,
      layers: layers.map(({ placements: layerPlacements, ...layer }) => ({ ...layer, cargoIds: layerPlacements.map((item) => item.cargoId) })),
      stageReports,
      occupiedDepth: cursorX,
      candidateSource: 'CROSS_SECTION_LAYER',
      mixedSkuPolicy: 'SKU_AND_BATCH_ARE_NOT_SPATIAL_BARRIERS',
      deterministic: true
    };
  }

  _buildBestStage(items, maximumDepth, portSequence) {
    const variants = ['BASE_FIRST', 'AREA_FIRST', 'WIDTH_FIRST', 'HEIGHT_FIRST', 'VOLUME_FIRST'].slice(0, this.config.maximumLayerVariants);
    const candidates = [
      ...variants.map((variant) => this._buildStage(items, maximumDepth, portSequence, variant)),
      this._buildColumnStage(items, maximumDepth, portSequence)
    ];
    return candidates.sort(compareStages)[0];
  }

  _buildColumnStage(items, maximumDepth, portSequence) {
    const primary = items.filter((item) => item.portSequence === portSequence);
    const groups = partitionByDominantDepth(primary, this.container);
    const layers = [];
    const loadedIds = new Set();
    for (const group of groups) {
      const remainingDepth = maximumDepth - layers.reduce((sum, layer) => sum + layer.depth, 0);
      const packed = this._packColumnDepthGroup(group.items, group.depth, portSequence, remainingDepth);
      if (!packed || packed.loadedCount !== group.items.length) continue;
      layers.push(...packed.layers);
      for (const layer of packed.layers) for (const placement of layer.placements) loadedIds.add(placement.instance.instanceId);
    }
    const compactedLayers = this._compactHomogeneousResidualLayers(layers, portSequence);
    const remaining = items.filter((item) => !loadedIds.has(item.instanceId));
    const orderedLayers = orderStageLayersForLongitudinalBalance(compactedLayers, portSequence, resolveLayerOrderingMode(this.config, portSequence));
    return {
      variant: 'BALANCED_STACK_COLUMNS',
      layers: orderedLayers,
      occupiedDepth: orderedLayers.reduce((sum, layer) => sum + layer.depth, 0),
      remaining,
      unloaded: remaining.filter((item) => item.portSequence === portSequence).map((item) => ({ ...item, cargoId: item.instanceId, quantity: 1, reason: 'NO_STACK_COLUMN_CAPACITY' }))
    };
  }

  _compactHomogeneousResidualLayers(layers, portSequence) {
    return layers.map((layer) => {
      if (layer.fillRatio >= 0.65 - EPSILON || layer.placements.length === 0) return layer;
      const sourceIds = new Set(layer.placements.map((placement) => placement.instance.sourceCargoId));
      if (sourceIds.size !== 1) return layer;
      const instances = layer.placements.map((placement) => placement.instance);
      const alternativeDepths = [...new Set(instances.flatMap((instance) => operationSafeOrientations(instance, this.container)
        .map((orientation) => round(orientation.l))
        .filter((depth) => depth + EPSILON < layer.depth
          && instances.every((item) => matchingOrientations(item, depth, this.container).length > 0))))].sort((left, right) => left - right);
      const candidates = [layer];
      for (const depth of alternativeDepths) {
        const packed = this._packColumnDepthGroup(instances, depth, portSequence, depth);
        if (packed && packed.loadedCount === instances.length && packed.layers.length === 1) candidates.push(packed.layers[0]);
      }
      return candidates.sort((left, right) => left.depth - right.depth
        || Math.max(0, 0.65 - left.fillRatio) * left.depth - Math.max(0, 0.65 - right.fillRatio) * right.depth
        || right.fillRatio - left.fillRatio)[0];
    });
  }

  _packColumnDepthGroup(items, depth, portSequence, maximumDepth) {
    const topItems = items.filter(isTopOnlyItem);
    const baseItems = items.filter((item) => !isTopOnlyItem(item));
    const columnGroups = buildColumnGroups(baseItems, depth, this.container);
    if (baseItems.length > 0 && columnGroups.length === 0) return null;
    const supportGroups = columnGroups.filter((group) => group.stackable && !group.fragile);
    const extraConfigurations = [{ groupKey: null, extra: 0 }];
    if (topItems.length > 0) {
      for (const group of supportGroups) {
        for (let extra = 1; extra <= Math.min(topItems.length + 2, group.items.length - group.minimumColumns); extra++) {
          extraConfigurations.push({ groupKey: group.key, extra });
        }
      }
    }
    const candidates = [];
    for (const configuration of extraConfigurations) {
      const columns = buildStackColumns(columnGroups, configuration);
      const bundled = bundleTopItems(columns, topItems, depth, this.container, this.config);
      if (!bundled.valid) continue;
      const totalArea = bundled.units.reduce((sum, unit) => sum + unit.area, 0);
      const minimumByArea = Math.max(1, Math.ceil(totalArea / Math.max(this.container.innerWidth * this.container.innerHeight, 1) - EPSILON));
      const minimumByWidth = Math.max(1, Math.ceil(bundled.units.reduce((sum, unit) => sum + unit.width, 0) / Math.max(this.container.innerWidth, 1) - EPSILON));
      const minimumLayers = Math.max(minimumByArea, minimumByWidth);
      const maximumLayers = Math.min(items.length, Math.floor((maximumDepth + EPSILON) / Math.max(depth, 1)));
      for (let layerCount = minimumLayers; layerCount <= Math.min(maximumLayers, minimumLayers + 4); layerCount++) {
        for (const variant of ['AREA_BALANCE', 'WIDTH_BALANCE', 'SUPPORT_FIRST', 'WEIGHT_GROUPED']) {
          const bins = assignColumnUnits(bundled.units, layerCount, this.container.innerWidth, variant);
          if (!bins) continue;
          const layerResult = materializeColumnLayers(bins, depth, portSequence, this.container, this.strategy);
          candidates.push({
            layers: layerResult,
            loadedCount: layerResult.reduce((sum, layer) => sum + layer.placements.length, 0),
            lowFillCount: layerResult.filter((layer) => layer.fillRatio < 0.65).length,
            minimumFill: Math.min(...layerResult.map((layer) => layer.fillRatio)),
            meanFill: average(layerResult.map((layer) => layer.fillRatio)),
            envelopeVoidVolume: layerResult.reduce((sum, layer) => sum + layerEnvelopeVoidArea(layer) * layer.depth, 0),
            lowFillDeficitVolume: layerResult.reduce((sum, layer) => sum
              + Math.max(0, 0.65 - layer.fillRatio) * this.container.innerWidth * this.container.innerHeight * layer.depth, 0),
            occupiedDepth: layerResult.length * depth,
            massOrderingMoment: maximumLayerMassMoment(layerResult),
            variant,
            configuration
          });
        }
        if (candidates.some((candidate) => candidate.loadedCount === items.length && candidate.occupiedDepth === layerCount * depth && candidate.lowFillCount === 0)) break;
      }
    }
    const candidateMode = resolveColumnCandidateMode(this.config, portSequence);
    const validCandidates = candidates.filter((candidate) => candidate.loadedCount === items.length)
      .sort((left, right) => compareColumnPackCandidates(left, right, candidateMode));
    if (validCandidates.length === 0) return null;
    return {
      ...validCandidates[0],
      alternativeSummary: validCandidates.slice(0, 24).map((candidate) => ({
        configuration: candidate.configuration,
        variant: candidate.variant,
        lowFillCount: candidate.lowFillCount,
        minimumFill: candidate.minimumFill,
        envelopeVoidVolume: candidate.envelopeVoidVolume,
        lowFillDeficitVolume: candidate.lowFillDeficitVolume,
        occupiedDepth: candidate.occupiedDepth,
        massOrderingMoment: candidate.massOrderingMoment,
        fills: candidate.layers.map((layer) => layer.fillRatio)
      }))
    };
  }

  _buildBalancedStage(items, maximumDepth, portSequence, variant) {
    const primary = items.filter((item) => item.portSequence === portSequence);
    const groups = partitionByDominantDepth(primary, this.container);
    const layers = [];
    const loadedIds = new Set();
    let occupiedDepth = 0;
    for (const group of groups) {
      const minimumLayers = Math.max(1, Math.ceil(group.crossSectionArea / Math.max(this.container.innerWidth * this.container.innerHeight, 1) - EPSILON));
      let packed = null;
      for (let layerCount = minimumLayers; layerCount <= minimumLayers + 4; layerCount++) {
        if (occupiedDepth + layerCount * group.depth > maximumDepth + EPSILON) break;
        const candidate = this._packBalancedDepthGroup(group.items, group.depth, variant, portSequence, layerCount);
        if (candidate.loadedCount === group.items.length) { packed = candidate; break; }
      }
      if (!packed) continue;
      layers.push(...packed.layers);
      occupiedDepth += packed.layers.reduce((sum, layer) => sum + layer.depth, 0);
      for (const layer of packed.layers) for (const placement of layer.placements) loadedIds.add(placement.instance.instanceId);
    }
    const remaining = items.filter((item) => !loadedIds.has(item.instanceId));
    const orderedLayers = orderStageLayersForLongitudinalBalance(layers, portSequence, resolveLayerOrderingMode(this.config, portSequence));
    return {
      variant: `BALANCED_${variant}`,
      layers: orderedLayers,
      occupiedDepth: orderedLayers.reduce((sum, layer) => sum + layer.depth, 0),
      remaining,
      unloaded: remaining.filter((item) => item.portSequence === portSequence).map((item) => ({ ...item, cargoId: item.instanceId, quantity: 1, reason: 'NO_BALANCED_CROSS_SECTION_CAPACITY' }))
    };
  }

  _packBalancedDepthGroup(items, depth, variant, portSequence, layerCount) {
    const states = Array.from({ length: layerCount }, () => ({
      placements: [], supportLoads: new Map(), loadedIds: new Set(), lastHandling: null,
      stagePort: portSequence, hasFillers: false, occupiedArea: 0, floorRequiredCount: 0
    }));
    let pending = [...items].sort(itemComparator(variant, portSequence));
    for (let pass = 0; pass < this.config.candidatePasses + 2 && pending.length > 0; pass++) {
      const next = [];
      let progress = false;
      for (const instance of pending) {
        const options = states.flatMap((state, stateIndex) => {
          const candidate = this._bestCrossSectionCandidate(instance, depth, state);
          return candidate ? [{ state, stateIndex, candidate }] : [];
        }).sort((left, right) => compareBalancedStateCandidates(left, right, instance));
        const selected = options[0];
        if (!selected) { next.push(instance); continue; }
        const placement = {
          instance,
          dims: selected.candidate.dims,
          y: selected.candidate.y,
          z: selected.candidate.z,
          stackLevel: selected.candidate.constraint.stackLevel,
          supportRatio: selected.candidate.constraint.supportRatio,
          supportMargin: selected.candidate.constraint.supportMargin,
          supportIds: selected.candidate.constraint.supports.map((entry) => entry.placement.instance.instanceId),
          score: selected.candidate.score,
          scoreComponents: selected.candidate.components
        };
        selected.state.placements.push(placement);
        selected.state.loadedIds.add(instance.instanceId);
        selected.state.lastHandling = handling(instance);
        selected.state.occupiedArea += placement.dims.w * placement.dims.h;
        if (isFloorRequired(instance)) selected.state.floorRequiredCount += 1;
        this._commitSupportLoads(selected.state, placement, selected.candidate.constraint.supports);
        progress = true;
      }
      pending = next;
      if (!progress) break;
    }
    const layers = states.filter((state) => state.placements.length > 0).map((state) => ({
      depth,
      portSequence,
      placements: state.placements,
      occupiedArea: state.occupiedArea,
      fillRatio: state.occupiedArea / Math.max(this.container.innerWidth * this.container.innerHeight, 1),
      primaryCount: state.placements.length,
      mixedSkuCount: new Set(state.placements.map((placement) => placement.instance.sku)).size,
      contactQuality: average(state.placements.map((placement) => placement.scoreComponents.contactQuality)),
      heightSmoothness: crossSectionHeightSmoothness(state.placements, this.container)
    }));
    return { layers, loadedCount: items.length - pending.length, unloaded: pending };
  }

  _buildStage(items, maximumDepth, portSequence, variant) {
    let remaining = [...items];
    const layers = [];
    let occupiedDepth = 0;
    while (remaining.some((item) => item.portSequence === portSequence) && occupiedDepth < maximumDepth - EPSILON) {
      const remainingPrimaryCount = remaining.filter((item) => item.portSequence === portSequence).length;
      const depthCandidates = rankDepthCandidates(remaining, this.container, this.config.maximumDepthCandidates);
      const primaryOnlyCandidates = depthCandidates
        .filter((depth) => occupiedDepth + depth <= maximumDepth + EPSILON)
        .map((depth) => this._packLayer(remaining, depth, variant, portSequence, false))
        .filter((layer) => layer.primaryCount > 0)
      // An earlier-port filler may only enter the terminal layer of this port.
      // If primary cargo remained in a higher-X layer, that cargo could block
      // the filler's extraction corridor even though both layers are valid in
      // isolation. Requiring the mixed candidate to consume every remaining
      // primary item makes the invariant local, deterministic and auditable.
      const terminalMixedCandidates = depthCandidates
        .filter((depth) => occupiedDepth + depth <= maximumDepth + EPSILON)
        .map((depth) => this._packLayer(remaining, depth, variant, portSequence, true))
        .filter((layer) => layer.primaryCount === remainingPrimaryCount);
      const layerCandidates = [...primaryOnlyCandidates, ...terminalMixedCandidates].sort(compareLayers);
      if (layerCandidates.length === 0) break;
      const selected = layerCandidates[0];
      layers.push(selected);
      occupiedDepth += selected.depth;
      const loadedIds = new Set(selected.placements.map((placement) => placement.instance.instanceId));
      remaining = remaining.filter((item) => !loadedIds.has(item.instanceId));
    }
    const orderedLayers = orderStageLayersForLongitudinalBalance(layers, portSequence, resolveLayerOrderingMode(this.config, portSequence));
    return {
      variant,
      layers: orderedLayers,
      occupiedDepth: orderedLayers.reduce((sum, layer) => sum + layer.depth, 0),
      remaining,
      unloaded: remaining.filter((item) => item.portSequence === portSequence).map((item) => ({ ...item, cargoId: item.instanceId, quantity: 1, reason: 'NO_CROSS_SECTION_LAYER_CAPACITY' }))
    };
  }

  _packLayer(items, depth, variant, portSequence, allowFillers = false) {
    // Only the adjacent earlier-unload stage may fill the current stage. This
    // prevents a port-1 filler deep in port-3 space from being trapped behind
    // still-unplaced port-2 cargo while keeping stage boundaries soft.
    const eligible = items.filter((item) => item.portSequence <= portSequence
      && item.portSequence >= (allowFillers ? Math.max(1, portSequence - 1) : portSequence)
      && matchingOrientations(item, depth, this.container).length > 0).sort(itemComparator(variant, portSequence));
    const state = { placements: [], supportLoads: new Map(), loadedIds: new Set(), lastHandling: null, stagePort: portSequence, hasFillers: allowFillers && eligible.some((item) => item.portSequence < portSequence) };
    let pending = eligible;
    for (let pass = 0; pass < this.config.candidatePasses && pending.length > 0; pass++) {
      const next = [];
      let progress = false;
      for (const instance of pending) {
        const selected = this._bestCrossSectionCandidate(instance, depth, state);
        if (!selected) { next.push(instance); continue; }
        const placement = {
          instance,
          dims: selected.dims,
          y: selected.y,
          z: selected.z,
          stackLevel: selected.constraint.stackLevel,
          supportRatio: selected.constraint.supportRatio,
          supportMargin: selected.constraint.supportMargin,
          supportIds: selected.constraint.supports.map((entry) => entry.placement.instance.instanceId),
          score: selected.score,
          scoreComponents: selected.components
        };
        state.placements.push(placement);
        state.loadedIds.add(instance.instanceId);
        state.lastHandling = handling(instance);
        this._commitSupportLoads(state, placement, selected.constraint.supports);
        progress = true;
      }
      pending = next;
      if (!progress) break;
    }
    const occupiedArea = state.placements.reduce((sum, placement) => sum + placement.dims.w * placement.dims.h, 0);
    return {
      depth,
      portSequence,
      placements: state.placements,
      occupiedArea,
      fillRatio: occupiedArea / Math.max(this.container.innerWidth * this.container.innerHeight, 1),
      primaryCount: state.placements.filter((placement) => placement.instance.portSequence === portSequence).length,
      mixedSkuCount: new Set(state.placements.map((placement) => placement.instance.sku)).size,
      contactQuality: average(state.placements.map((placement) => placement.scoreComponents.contactQuality)),
      heightSmoothness: crossSectionHeightSmoothness(state.placements, this.container)
    };
  }

  _bestCrossSectionCandidate(instance, depth, state) {
    const candidates = [];
    for (const dims of matchingOrientations(instance, depth, this.container)) {
      for (const point of crossSectionCandidatePoints(dims, state.placements, this.container)) {
        const constraint = evaluateCrossSectionConstraint(instance, dims, point, state, this.container, this.config);
        if (!constraint.valid) continue;
        const components = scoreCrossSectionCandidate(instance, dims, point, constraint, state, this.container, this.strategy);
        const weights = strategyWeights(this.strategy);
        const score = components.contactQuality * weights.contact
          + components.balance * weights.balance
          + components.heightSmoothness * weights.height
          + components.futureFit * weights.futureFit
          + components.operation * weights.operation;
        candidates.push({ ...point, dims, constraint, components, score });
      }
    }
    return candidates.sort(compareCrossSectionCandidates)[0] || null;
  }

  _commitSupportLoads(state, placement, supports) {
    const totalArea = supports.reduce((sum, entry) => sum + entry.area, 0);
    for (const support of supports) {
      const share = totalArea > 0 ? number(placement.instance.weight) * support.area / totalArea : 0;
      const id = support.placement.instance.instanceId;
      state.supportLoads.set(id, number(state.supportLoads.get(id)) + share);
    }
  }

  _toPlacement(layerPlacement, x, layerIndex) {
    const instance = layerPlacement.instance;
    const dims = layerPlacement.dims;
    return {
      loadingIndex: 0,
      name: instance.name,
      cargoId: instance.instanceId,
      sourceCargoId: instance.sourceCargoId,
      x,
      y: layerPlacement.y,
      z: layerPlacement.z,
      l: dims.l,
      w: dims.w,
      h: dims.h,
      color: colorFor(instance.sku),
      type: instance.fragile ? 'fragile' : number(instance.weight) >= 20 ? 'heavy' : 'normal',
      packagingType: instance.packagingType,
      packagingProfile: instance.packagingProfile || null,
      cargoPhysicalProfile: instance.cargoPhysicalProfile || null,
      visualProfile: instance.visualProfile || null,
      weight: number(instance.weight),
      fragile: instance.fragile === true,
      dangerous: instance.dangerous === true,
      stackable: instance.stackable !== false,
      maxStackLayers: Math.max(1, number(instance.maxStackLayers || instance.maxStack || 1)),
      maxSupportedWeight: instance.maximumSupportedWeightKg ?? instance.maxSupportedWeight ?? null,
      maximumSupportedWeightKg: instance.maximumSupportedWeightKg ?? instance.maxSupportedWeight ?? null,
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
      batchLabel: instance.batchLabel || instance.destinationPort || `Batch ${instance.portSequence}`,
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
      stackLevel: layerPlacement.stackLevel,
      supportRatio: layerPlacement.supportRatio,
      supportMargin: layerPlacement.supportMargin,
      supportCargoIds: [...layerPlacement.supportIds],
      placementReason: {
        strategy: this.strategy,
        candidateSource: 'CROSS_SECTION_LAYER',
        layerIndex,
        mixedSkuLayer: true,
        components: layerPlacement.scoreComponents,
        statement: `混合兼容横截面层候选通过支撑、堆叠和承载硬约束；SKU/Batch 不作为空间隔离条件`
      },
      candidateTrace: {
        accepted: {
          position: { x, y: layerPlacement.y, z: layerPlacement.z },
          orientation: dims.id || dims.label,
          score: layerPlacement.score,
          components: layerPlacement.scoreComponents,
          source: 'CROSS_SECTION_LAYER',
          status: 'SELECTED'
        },
        rejected: []
      },
      algorithmMeta: {
        algorithm: 'hybrid-v2.3',
        strategy: this.strategy,
        candidateSource: 'CROSS_SECTION_LAYER',
        layerIndex,
        blockSplit: true,
        mixedSkuLayer: true
      }
    };
  }
}

function expandInstances(cargoList) {
  const etaMap = etaSequenceMap(cargoList);
  const result = [];
  cargoList.forEach((raw, sourceIndex) => {
    const portSequence = raw.eta && etaMap.has(raw.eta) ? etaMap.get(raw.eta) : Math.max(1, number(raw.portSequence || 1));
    const sku = raw.sku || raw.name || raw.cargoId || raw.id || `sku_${sourceIndex}`;
    const sourceCargoId = String(raw.cargoId || raw.id || sku);
    const quantity = Math.max(1, Math.floor(number(raw.quantity || 1)));
    for (let index = 0; index < quantity; index++) result.push({
      ...raw,
      sku,
      portSequence,
      sourceCargoId,
      instanceIndex: index + 1,
      instanceId: `${sourceCargoId}_${index + 1}`,
      quantity: 1,
      sourceIndex
    });
  });
  return result;
}

function groupByPort(instances) {
  const groups = new Map();
  for (const item of instances) {
    if (!groups.has(item.portSequence)) groups.set(item.portSequence, []);
    groups.get(item.portSequence).push(item);
  }
  return groups;
}

function rankDepthCandidates(items, container, limit) {
  const statistics = new Map();
  for (const item of items) for (const orientation of operationSafeOrientations(item, container)) {
    if (orientation.l > container.innerLength + EPSILON || orientation.w > container.innerWidth + EPSILON || orientation.h > container.innerHeight + EPSILON) continue;
    const depth = round(orientation.l);
    const current = statistics.get(depth) || { depth, area: 0, count: 0, volume: 0 };
    current.area += orientation.w * orientation.h;
    current.volume += orientation.l * orientation.w * orientation.h;
    current.count += 1;
    statistics.set(depth, current);
  }
  return [...statistics.values()].sort((left, right) => right.area - left.area || right.count - left.count || left.depth - right.depth).slice(0, limit).map((entry) => entry.depth);
}

function partitionByDominantDepth(items, container) {
  let remaining = [...items];
  const groups = [];
  while (remaining.length > 0) {
    const statistics = new Map();
    for (const item of remaining) {
      const itemVolume = number(item.length) * number(item.width) * number(item.height);
      const seenDepths = new Set();
      for (const orientation of operationSafeOrientations(item, container)) {
        const depth = round(orientation.l);
        if (seenDepths.has(depth) || depth > container.innerLength + EPSILON
          || orientation.w > container.innerWidth + EPSILON || orientation.h > container.innerHeight + EPSILON) continue;
        seenDepths.add(depth);
        const entry = statistics.get(depth) || { depth, items: [], crossSectionArea: 0, loadedVolume: 0, preferredCount: 0 };
        entry.items.push(item);
        entry.crossSectionArea += orientation.w * orientation.h;
        entry.loadedVolume += itemVolume;
        if (approximatelyDepth(depth, number(item.length))) entry.preferredCount += 1;
        statistics.set(depth, entry);
      }
    }
    const ranked = [...statistics.values()].map((entry) => {
      const layerCount = Math.max(1, Math.ceil(entry.crossSectionArea / Math.max(container.innerWidth * container.innerHeight, 1) - EPSILON));
      const estimatedDepth = layerCount * entry.depth;
      return { ...entry, estimatedDepth, volumePerDepth: entry.loadedVolume / Math.max(estimatedDepth, 1) };
    }).sort((left, right) => right.preferredCount - left.preferredCount
      || right.volumePerDepth - left.volumePerDepth
      || right.items.length - left.items.length
      || left.estimatedDepth - right.estimatedDepth
      || left.depth - right.depth);
    const selected = ranked[0];
    if (!selected) break;
    groups.push(selected);
    const selectedIds = new Set(selected.items.map((item) => item.instanceId));
    remaining = remaining.filter((item) => !selectedIds.has(item.instanceId));
  }
  return groups;
}

function matchingOrientations(instance, depth, container) {
  return operationSafeOrientations(instance, container).filter((orientation) => Math.abs(number(orientation.l) - number(depth)) <= EPSILON);
}

function operationSafeOrientations(instance, container) {
  return legalOrientations(instance).filter(o => fitsDoor(o, container)).filter((orientation) => handling(instance) !== 'manual'
    || (number(instance.weight) > 0 && number(instance.weight) <= 25
      && orientation.l <= 1200 + EPSILON
      && orientation.w <= 1200 + EPSILON
      && orientation.h <= 1000 + EPSILON));
}

function itemComparator(variant, stagePort) {
  return (left, right) => {
    const leftPrimary = left.portSequence === stagePort ? 1 : 0;
    const rightPrimary = right.portSequence === stagePort ? 1 : 0;
    if (rightPrimary !== leftPrimary) return rightPrimary - leftPrimary;
    const leftFloorRequired = isFloorRequired(left) ? 1 : 0;
    const rightFloorRequired = isFloorRequired(right) ? 1 : 0;
    const leftLateTop = left.fragile === true || (left.stackable === false && !leftFloorRequired) ? 1 : 0;
    const rightLateTop = right.fragile === true || (right.stackable === false && !rightFloorRequired) ? 1 : 0;
    if (rightFloorRequired !== leftFloorRequired) return rightFloorRequired - leftFloorRequired;
    if (leftLateTop !== rightLateTop) return leftLateTop - rightLateTop;
    const metrics = {
      AREA_FIRST: (item) => number(item.width) * number(item.height),
      WIDTH_FIRST: (item) => number(item.width),
      HEIGHT_FIRST: (item) => number(item.height),
      VOLUME_FIRST: (item) => number(item.length) * number(item.width) * number(item.height),
      BASE_FIRST: (item) => number(item.weight) * 1e9 + number(item.width) * number(item.height)
    };
    const selector = metrics[variant] || metrics.BASE_FIRST;
    const difference = selector(right) - selector(left);
    if (Math.abs(difference) > EPSILON) return difference;
    if (right.portSequence !== left.portSequence) return right.portSequence - left.portSequence;
    if (left.sourceIndex !== right.sourceIndex) return left.sourceIndex - right.sourceIndex;
    return left.instanceIndex - right.instanceIndex;
  };
}

function isFloorRequired(item) {
  return item.stackable === false && (number(item.weight) >= 20 || number(item.height) > 500);
}

function isTopOnlyItem(item) {
  return !isFloorRequired(item) && (item.fragile === true || item.stackable === false);
}

function buildColumnGroups(items, depth, container) {
  const groups = new Map();
  for (const item of items) {
    const orientation = matchingOrientations(item, depth, container).sort((left, right) => {
      const leftCapacity = Math.min(Math.max(1, number(item.maxStackLayers || item.maxStack || 1)), Math.floor(container.innerHeight / Math.max(left.h, 1)));
      const rightCapacity = Math.min(Math.max(1, number(item.maxStackLayers || item.maxStack || 1)), Math.floor(container.innerHeight / Math.max(right.h, 1)));
      const leftPreferred = left.label === 'XYZ' ? 1 : 0;
      const rightPreferred = right.label === 'XYZ' ? 1 : 0;
      return rightPreferred - leftPreferred || rightCapacity - leftCapacity || right.w - left.w || left.label.localeCompare(right.label);
    })[0];
    if (!orientation) continue;
    const topCapacity = item.maximumSupportedWeightKg ?? item.maxSupportedWeight;
    const bearingLayers = topCapacity != null && number(item.weight) > 0 ? 1 + Math.floor(Number(topCapacity) / number(item.weight)) : Infinity;
    const maxLayers = item.stackable === false ? 1 : Math.max(1, Math.min(
      number(item.maxStackLayers || item.maxStack || 1),
      bearingLayers,
      Math.floor(container.innerHeight / Math.max(orientation.h, 1))
    ));
    const key = [item.sourceCargoId, orientation.label, orientation.w, orientation.h, maxLayers].join(':');
    const entry = groups.get(key) || {
      key,
      dims: orientation,
      maxLayers,
      stackable: item.stackable !== false,
      fragile: item.fragile === true,
      items: []
    };
    entry.items.push(item);
    groups.set(key, entry);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    items: [...group.items].sort(compareInstances),
    minimumColumns: Math.ceil(group.items.length / Math.max(group.maxLayers, 1))
  })).sort((left, right) => right.dims.w - left.dims.w || right.dims.h - left.dims.h || left.key.localeCompare(right.key));
}

function buildStackColumns(groups, configuration) {
  const columns = [];
  for (const group of groups) {
    const requested = group.minimumColumns + (configuration.groupKey === group.key ? configuration.extra : 0);
    const columnCount = clamp(Math.floor(requested), group.minimumColumns, group.items.length);
    const baseCount = Math.floor(group.items.length / columnCount);
    const remainder = group.items.length % columnCount;
    let cursor = 0;
    const counts = Array.from({ length: columnCount }, (_, index) => baseCount + (index < remainder ? 1 : 0)).sort((left, right) => left - right);
    for (let index = 0; index < counts.length; index++) {
      const instances = group.items.slice(cursor, cursor + counts[index]);
      cursor += counts[index];
      columns.push({
        id: `${group.key}:column:${index}`,
        groupKey: group.key,
        dims: group.dims,
        instances,
        width: group.dims.w,
      height: instances.length * group.dims.h,
      area: instances.length * group.dims.w * group.dims.h,
      weight: instances.reduce((sum, instance) => sum + number(instance.weight), 0),
        maxLayers: group.maxLayers,
        stackable: group.stackable,
        fragile: group.fragile
      });
    }
  }
  return columns;
}

function bundleTopItems(columns, topItems, depth, container, config) {
  const available = new Map(columns.map((column) => [column.id, column]));
  const units = [];
  const tops = [...topItems].map((item) => ({
    item,
    dims: matchingOrientations(item, depth, container).sort((left, right) => (right.label === 'XYZ' ? 1 : 0) - (left.label === 'XYZ' ? 1 : 0) || right.w - left.w || left.label.localeCompare(right.label))[0]
  })).sort((left, right) => number(right.dims?.w) - number(left.dims?.w) || compareInstances(left.item, right.item));
  if (tops.some((entry) => !entry.dims)) return { valid: false, units: [] };
  for (const top of tops) {
    const grouped = new Map();
    for (const column of available.values()) {
      if (!canColumnSupportTop(column, top, container, config)) continue;
      // Any compatible same-height contact surface can participate in a bridge.
      const key = `${round(column.height)}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(column);
    }
    const supportOptions = [];
    for (const compatible of grouped.values()) {
      compatible.sort((left, right) => right.width - left.width || left.id.localeCompare(right.id));
      const selected = [];
      let supportWidth = 0;
      for (const column of compatible) {
        selected.push(column);
        supportWidth += column.width;
        if (supportWidth + EPSILON >= top.dims.w) break;
      }
      if (supportWidth + EPSILON >= top.dims.w) supportOptions.push({ columns: selected, width: supportWidth });
    }
    const selected = supportOptions.sort((left, right) => left.width - right.width || left.columns.length - right.columns.length || left.columns[0].id.localeCompare(right.columns[0].id))[0];
    if (!selected) return { valid: false, units: [] };
    for (const column of selected.columns) available.delete(column.id);
    units.push({
      id: `top:${top.item.instanceId}`,
      columns: selected.columns,
      top,
      width: selected.width,
      area: selected.columns.reduce((sum, column) => sum + column.area, 0) + top.dims.w * top.dims.h,
      weight: selected.columns.reduce((sum, column) => sum + column.weight, 0) + number(top.item.weight),
      supportBundle: true
    });
  }
  for (const column of available.values()) units.push({
    id: `column:${column.id}`,
    columns: [column],
    top: null,
    width: column.width,
    area: column.area,
    weight: column.weight,
    supportBundle: false
  });
  return { valid: true, units };
}

function canColumnSupportTop(column, top, container, config) {
  const lower = column.instances[column.instances.length - 1];
  if (!lower || !column.stackable || column.fragile) return false;
  if (column.instances.length >= column.maxLayers) return false;
  if (column.height + top.dims.h > container.innerHeight + EPSILON) return false;
  if (number(top.item.portSequence || 1) > number(lower.portSequence || 1)) return false;
  const reinforced = lower.wooden === true || /wood|pallet|reinforced|木/i.test(String(lower.packagingType || ''));
  if (!reinforced && number(lower.weight) > 0 && number(top.item.weight) > number(lower.weight) * config.heavyOnLightRatio) return false;
  return column.width > EPSILON;
}

function assignColumnUnits(units, layerCount, containerWidth, variant) {
  if (units.some((unit) => unit.width > containerWidth + EPSILON) || layerCount <= 0) return null;
  const ordered = [...units].sort((left, right) => {
    if (variant === 'WEIGHT_GROUPED' && Math.abs(left.weight - right.weight) > EPSILON) return left.weight - right.weight;
    if (variant === 'SUPPORT_FIRST' && Number(right.supportBundle) !== Number(left.supportBundle)) return Number(right.supportBundle) - Number(left.supportBundle);
    if (variant === 'WIDTH_BALANCE' && Math.abs(right.width - left.width) > EPSILON) return right.width - left.width;
    if (Math.abs(right.area - left.area) > EPSILON) return right.area - left.area;
    if (Math.abs(right.width - left.width) > EPSILON) return right.width - left.width;
    return left.id.localeCompare(right.id);
  });
  const bins = Array.from({ length: layerCount }, (_, index) => ({ index, units: [], usedWidth: 0, area: 0 }));
  for (const unit of ordered) {
    const options = bins.filter((bin) => bin.usedWidth + unit.width <= containerWidth + EPSILON).sort((left, right) => {
      if (variant === 'WEIGHT_GROUPED') return left.index - right.index;
      if (variant === 'WIDTH_BALANCE') {
        const leftRemainder = containerWidth - left.usedWidth - unit.width;
        const rightRemainder = containerWidth - right.usedWidth - unit.width;
        if (Math.abs(leftRemainder - rightRemainder) > EPSILON) return leftRemainder - rightRemainder;
      }
      if (Math.abs(left.area - right.area) > EPSILON) return left.area - right.area;
      if (Math.abs(left.usedWidth - right.usedWidth) > EPSILON) return left.usedWidth - right.usedWidth;
      return left.index - right.index;
    });
    const selected = options[0];
    if (!selected) return null;
    selected.units.push(unit);
    selected.usedWidth += unit.width;
    selected.area += unit.area;
  }
  if (bins.some((bin) => bin.units.length === 0)) return null;
  return bins;
}

function materializeColumnLayers(bins, depth, portSequence, container, strategy) {
  return bins.map((bin) => {
    const placements = [];
    let cursorZ = 0;
    const orderedUnits = [...bin.units].sort((left, right) => Number(right.supportBundle) - Number(left.supportBundle)
      || right.width - left.width || left.id.localeCompare(right.id));
    for (const unit of orderedUnits) {
      const unitStartZ = cursorZ;
      const topSupports = [];
      for (const column of unit.columns) {
        let cursorY = 0;
        let previous = null;
        for (let level = 0; level < column.instances.length; level++) {
          const instance = column.instances[level];
          const placement = columnPlacement(instance, column.dims, cursorY, cursorZ, level + 1, previous, strategy);
          placements.push(placement);
          previous = placement;
          cursorY += column.dims.h;
        }
        if (previous) topSupports.push(previous);
        cursorZ += column.width;
      }
      if (unit.top) {
        const topZ = unitStartZ + (unit.width - unit.top.dims.w) / 2;
        const topY = Math.max(...topSupports.map((support) => support.y + support.dims.h));
        placements.push(columnTopPlacement(unit.top.item, unit.top.dims, topY, topZ, topSupports, strategy));
      }
    }
    const occupiedArea = placements.reduce((sum, placement) => sum + placement.dims.w * placement.dims.h, 0);
    return {
      depth,
      portSequence,
      placements,
      occupiedArea,
      fillRatio: occupiedArea / Math.max(container.innerWidth * container.innerHeight, 1),
      primaryCount: placements.length,
      mixedSkuCount: new Set(placements.map((placement) => placement.instance.sku)).size,
      contactQuality: average(placements.map((placement) => placement.scoreComponents.contactQuality)),
      heightSmoothness: crossSectionHeightSmoothness(placements, container)
    };
  });
}

function columnPlacement(instance, dims, y, z, stackLevel, previous, strategy) {
  return {
    instance,
    dims,
    y,
    z,
    stackLevel,
    supportRatio: 1,
    supportMargin: Math.min(dims.l, dims.w) / 2,
    supportIds: previous ? [previous.instance.instanceId] : [],
    score: 1,
    scoreComponents: { contactQuality: 1, balance: 1, heightSmoothness: 1, futureFit: 1, operation: 1, strategy }
  };
}

function columnTopPlacement(instance, dims, y, z, supports, strategy) {
  const supportWidth = unionIntervalLength(supports.map((support) => [Math.max(z, support.z), Math.min(z + dims.w, support.z + support.dims.w)]));
  return {
    instance,
    dims,
    y,
    z,
    stackLevel: Math.max(...supports.map((support) => support.stackLevel + 1)),
    supportRatio: supportWidth / Math.max(dims.w, 1),
    supportMargin: Math.min(dims.l, supportWidth) / 2,
    supportIds: supports.map((support) => support.instance.instanceId),
    score: 1,
    scoreComponents: { contactQuality: 1, balance: 1, heightSmoothness: 1, futureFit: 1, operation: 1, strategy }
  };
}

function compareColumnPackCandidates(left, right, mode = 'LOW_FILL_THEN_VOID') {
  if (Math.abs(left.occupiedDepth - right.occupiedDepth) > EPSILON) return left.occupiedDepth - right.occupiedDepth;
  const leftPhysicalVoid = left.envelopeVoidVolume + left.lowFillDeficitVolume;
  const rightPhysicalVoid = right.envelopeVoidVolume + right.lowFillDeficitVolume;
  if (mode === 'UNIFORM_FILL') {
    const leftRange = Math.max(...left.layers.map((layer) => layer.fillRatio)) - Math.min(...left.layers.map((layer) => layer.fillRatio));
    const rightRange = Math.max(...right.layers.map((layer) => layer.fillRatio)) - Math.min(...right.layers.map((layer) => layer.fillRatio));
    if (Math.abs(leftRange - rightRange) > EPSILON) return leftRange - rightRange;
  } else if (mode === 'VOID_FIRST') {
    if (Math.abs(leftPhysicalVoid - rightPhysicalVoid) > EPSILON) return leftPhysicalVoid - rightPhysicalVoid;
  } else if (left.lowFillCount !== right.lowFillCount) return left.lowFillCount - right.lowFillCount;
  if (Math.abs(leftPhysicalVoid - rightPhysicalVoid) > EPSILON) return leftPhysicalVoid - rightPhysicalVoid;
  if (left.lowFillCount !== right.lowFillCount) return left.lowFillCount - right.lowFillCount;
  if (Math.abs(right.minimumFill - left.minimumFill) > EPSILON) return right.minimumFill - left.minimumFill;
  if (Math.abs(right.meanFill - left.meanFill) > EPSILON) return right.meanFill - left.meanFill;
  if (Math.abs(right.massOrderingMoment - left.massOrderingMoment) > EPSILON) return right.massOrderingMoment - left.massOrderingMoment;
  if (left.configuration.extra !== right.configuration.extra) return left.configuration.extra - right.configuration.extra;
  return left.variant.localeCompare(right.variant);
}

function maximumLayerMassMoment(layers) {
  const ordered = [...layers].sort((left, right) => layerWeightDensity(left) - layerWeightDensity(right)
    || left.depth - right.depth || firstCargoId(left).localeCompare(firstCargoId(right)));
  let cursor = 0;
  let moment = 0;
  for (const layer of ordered) {
    const weight = layer.placements.reduce((sum, placement) => sum + number(placement.instance.weight), 0);
    moment += (cursor + layer.depth / 2) * weight;
    cursor += layer.depth;
  }
  return moment;
}

function layerEnvelopeVoidArea(layer) {
  if (!layer || layer.placements.length === 0) return 0;
  const minZ = Math.min(...layer.placements.map((placement) => placement.z));
  const maxZ = Math.max(...layer.placements.map((placement) => placement.z + placement.dims.w));
  const maxY = Math.max(...layer.placements.map((placement) => placement.y + placement.dims.h));
  return Math.max(0, (maxZ - minZ) * maxY - number(layer.occupiedArea));
}

function compareInstances(left, right) {
  if (number(left.sourceIndex) !== number(right.sourceIndex)) return number(left.sourceIndex) - number(right.sourceIndex);
  if (number(left.instanceIndex) !== number(right.instanceIndex)) return number(left.instanceIndex) - number(right.instanceIndex);
  return String(left.instanceId || '').localeCompare(String(right.instanceId || ''));
}

function approximatelyDepth(left, right) {
  return Math.abs(number(left) - number(right)) <= EPSILON;
}

function crossSectionCandidatePoints(dims, placements, container) {
  const zValues = [0, container.innerWidth - dims.w];
  const yValues = [0];
  for (const entry of placements) {
    zValues.push(entry.z, entry.z + entry.dims.w, entry.z - dims.w, entry.z + entry.dims.w - dims.w);
    yValues.push(entry.y + entry.dims.h);
  }
  const result = new Map();
  for (const rawY of yValues) for (const rawZ of zValues) {
    const y = round(clamp(rawY, 0, Math.max(0, container.innerHeight - dims.h)));
    const z = round(clamp(rawZ, 0, Math.max(0, container.innerWidth - dims.w)));
    result.set(`${y}:${z}`, { y, z });
  }
  return [...result.values()];
}

function evaluateCrossSectionConstraint(instance, dims, point, state, container, config) {
  if((instance.maximumSupportedWeightKg??instance.maxSupportedWeight)!=null || state.placements.some(p=>(p.instance.maximumSupportedWeightKg??p.instance.maxSupportedWeight)!=null)){
    const prospective=state.placements.map(p=>({...p.instance,...p.dims,x:0,y:p.y,z:p.z}));
    prospective.push({...instance,...dims,x:0,y:point.y,z:point.z});
    if(!explicitTopLoadsPass(prospective,config.contactToleranceMm))return {valid:false};
  }
  const candidate = { y: point.y, z: point.z, w: dims.w, h: dims.h };
  if (candidate.y < -EPSILON || candidate.z < -EPSILON || candidate.y + candidate.h > container.innerHeight + EPSILON || candidate.z + candidate.w > container.innerWidth + EPSILON) return { valid: false };
  if (state.placements.some((entry) => crossSectionIntersects(candidate, { y: entry.y, z: entry.z, w: entry.dims.w, h: entry.dims.h }))) return { valid: false };
  const wouldSupportExisting = state.placements.some((entry) => Math.abs(candidate.y + candidate.h - entry.y) <= config.contactToleranceMm && intervalOverlap(candidate.z, candidate.w, entry.z, entry.dims.w) > EPSILON);
  if (wouldSupportExisting) return { valid: false };
  if (candidate.y <= config.contactToleranceMm) return { valid: true, supportRatio: 1, supportMargin: Math.min(dims.l, dims.w) / 2, stackLevel: 1, supports: [] };
  const supports = state.placements.flatMap((entry) => {
    if (Math.abs(entry.y + entry.dims.h - candidate.y) > config.contactToleranceMm) return [];
    const overlap = intervalOverlap(candidate.z, candidate.w, entry.z, entry.dims.w);
    return overlap > EPSILON ? [{ placement: entry, overlap, area: overlap * Math.min(dims.l, entry.dims.l) }] : [];
  });
  const supportedWidth = unionIntervalLength(supports.map((entry) => [Math.max(candidate.z, entry.placement.z), Math.min(candidate.z + candidate.w, entry.placement.z + entry.placement.dims.w)]));
  const supportRatio = supportedWidth / Math.max(candidate.w, 1);
  if (supportRatio + EPSILON < config.supportRatioMin) return { valid: false };
  let stackLevel = 1;
  for (const support of supports) {
    const lower = support.placement.instance;
    stackLevel = Math.max(stackLevel, support.placement.stackLevel + 1);
    // Earlier-unload cargo may sit on later-unload cargo. The reverse would
    // require moving future-port cargo before the supporter can be extracted.
    if (number(instance.portSequence || 1) > number(lower.portSequence || 1)) return { valid: false };
    if (lower.fragile === true || lower.stackable === false) return { valid: false };
    if (support.placement.stackLevel >= Math.max(1, number(lower.maxStackLayers || lower.maxStack || 1))) return { valid: false };
    const lowerWeight = number(lower.weight);
    const upperWeight = number(instance.weight);
    const reinforced = lower.wooden === true || /wood|pallet|reinforced|木/i.test(String(lower.packagingType || ''));
    if (!reinforced && lowerWeight > 0 && upperWeight > lowerWeight * config.heavyOnLightRatio) return { valid: false };
    const share = upperWeight * support.area / Math.max(supports.reduce((sum, entry) => sum + entry.area, 0), 1);
    const explicitCapacity = lower.maximumSupportedWeightKg ?? lower.maxSupportedWeight;
    const capacity = explicitCapacity != null ? Number(explicitCapacity) : Math.max(lowerWeight, 1) * config.supportLoadMultiplier;
    if (number(state.supportLoads.get(lower.instanceId)) + share > capacity + EPSILON) return { valid: false };
  }
  if (state.hasFillers && number(instance.portSequence) === number(state.stagePort) && stackLevel > 2) return { valid: false };
  const supportMinZ = Math.min(...supports.map((entry) => Math.max(candidate.z, entry.placement.z)));
  const supportMaxZ = Math.max(...supports.map((entry) => Math.min(candidate.z + candidate.w, entry.placement.z + entry.placement.dims.w)));
  const supportMargin = Math.min(candidate.z + candidate.w / 2 - supportMinZ, supportMaxZ - (candidate.z + candidate.w / 2), dims.l / 2);
  if (supportMargin < -EPSILON) return { valid: false };
  return { valid: true, supportRatio, supportMargin, stackLevel, supports };
}

function scoreCrossSectionCandidate(instance, dims, point, constraint, state, container, strategy) {
  const candidate = { y: point.y, z: point.z, w: dims.w, h: dims.h };
  let contact = constraint.supportRatio;
  if (candidate.z <= EPSILON || candidate.z + candidate.w >= container.innerWidth - EPSILON) contact += 1;
  for (const other of state.placements) {
    const vertical = intervalOverlap(candidate.y, candidate.h, other.y, other.dims.h);
    const gap = Math.min(Math.abs(candidate.z - (other.z + other.dims.w)), Math.abs(other.z - (candidate.z + candidate.w)));
    if (gap <= EPSILON && vertical > EPSILON) contact += vertical / Math.max(candidate.h, 1);
  }
  const contactQuality = clamp(contact / 3, 0, 1);
  const projectedWeight = state.placements.reduce((sum, entry) => sum + Math.max(number(entry.instance.weight), 1), 0) + Math.max(number(instance.weight), 1);
  const projectedMoment = state.placements.reduce((sum, entry) => sum + (entry.z + entry.dims.w / 2) * Math.max(number(entry.instance.weight), 1), 0)
    + (candidate.z + candidate.w / 2) * Math.max(number(instance.weight), 1);
  const balance = 1 - clamp(Math.abs(projectedMoment / projectedWeight - container.innerWidth / 2) / Math.max(container.innerWidth / 2, 1), 0, 1);
  const provisional = [...state.placements, { ...candidate, dims, instance }];
  const heightSmoothness = crossSectionHeightSmoothness(provisional, container);
  const futureFit = futureFitScore(provisional, container);
  const method = handling(instance);
  const operation = state.lastHandling && state.lastHandling !== method ? 0.65 : 1;
  return { contactQuality, balance, heightSmoothness, futureFit, operation, strategy };
}

function crossSectionHeightSmoothness(placements, container) {
  const samples = 24;
  const heights = Array.from({ length: samples }, (_, index) => {
    const z = (index + 0.5) * container.innerWidth / samples;
    return placements.reduce((top, entry) => z >= entry.z - EPSILON && z < entry.z + entry.dims.w - EPSILON ? Math.max(top, entry.y + entry.dims.h) : top, 0);
  });
  let variation = 0;
  for (let index = 0; index < heights.length - 1; index++) variation += Math.abs(heights[index] - heights[index + 1]);
  return clamp(1 - variation / Math.max((heights.length - 1) * container.innerHeight, 1), 0, 1);
}

function futureFitScore(placements, container) {
  const floor = placements.filter((entry) => entry.y <= EPSILON).sort((left, right) => left.z - right.z);
  let largestGap = 0;
  let cursor = 0;
  for (const entry of floor) {
    largestGap = Math.max(largestGap, entry.z - cursor);
    cursor = Math.max(cursor, entry.z + entry.dims.w);
  }
  largestGap = Math.max(largestGap, container.innerWidth - cursor);
  return 1 - clamp(largestGap / Math.max(container.innerWidth, 1), 0, 1);
}

function chooseMirroring(placements, container, currentMoment, currentWeight) {
  const options = [false, true].map((mirrored) => {
    const candidate = placements.map((entry) => mirrored ? { ...entry, z: container.innerWidth - (entry.z + entry.dims.w) } : { ...entry });
    const weight = candidate.reduce((sum, entry) => sum + Math.max(number(entry.instance.weight), 1), 0);
    const moment = candidate.reduce((sum, entry) => sum + (entry.z + entry.dims.w / 2) * Math.max(number(entry.instance.weight), 1), 0);
    const projected = (currentMoment + moment) / Math.max(currentWeight + weight, 1);
    return { placements: candidate, mirrored, offset: Math.abs(projected - container.innerWidth / 2) };
  });
  return options.sort((left, right) => left.offset - right.offset || Number(left.mirrored) - Number(right.mirrored))[0];
}

function compareStages(left, right) {
  if (left.unloaded.length !== right.unloaded.length) return left.unloaded.length - right.unloaded.length;
  const leftLoaded = left.layers.reduce((sum, layer) => sum + layer.placements.length, 0);
  const rightLoaded = right.layers.reduce((sum, layer) => sum + layer.placements.length, 0);
  if (rightLoaded !== leftLoaded) return rightLoaded - leftLoaded;
  const leftLow = left.layers.filter((layer) => layer.fillRatio < 0.65).length;
  const rightLow = right.layers.filter((layer) => layer.fillRatio < 0.65).length;
  if (leftLow !== rightLow) return leftLow - rightLow;
  const leftPhysicalVoid = stagePhysicalVoidScore(left.layers);
  const rightPhysicalVoid = stagePhysicalVoidScore(right.layers);
  if (Math.abs(leftPhysicalVoid - rightPhysicalVoid) > EPSILON) return leftPhysicalVoid - rightPhysicalVoid;
  const leftMean = average(left.layers.map((layer) => layer.fillRatio));
  const rightMean = average(right.layers.map((layer) => layer.fillRatio));
  if (Math.abs(rightMean - leftMean) > EPSILON) return rightMean - leftMean;
  if (Math.abs(left.occupiedDepth - right.occupiedDepth) > EPSILON) return left.occupiedDepth - right.occupiedDepth;
  return left.variant.localeCompare(right.variant);
}

function stagePhysicalVoidScore(layers) {
  return layers.reduce((sum, layer) => sum + layerEnvelopeVoidArea(layer) * layer.depth
    + Math.max(0, 0.65 - layer.fillRatio) * layer.depth * 1e6, 0);
}

function orderStageLayersForLongitudinalBalance(layers, stagePort, mode = 'MASS_ASC') {
  const pure = [];
  const terminalMixed = [];
  for (const layer of layers) {
    const hasEarlierPortCargo = layer.placements.some((placement) => number(placement.instance.portSequence) < number(stagePort));
    (hasEarlierPortCargo ? terminalMixed : pure).push(layer);
  }
  pure.sort((left, right) => {
    if (mode === 'FILL_DESC' && Math.abs(right.fillRatio - left.fillRatio) > EPSILON) return right.fillRatio - left.fillRatio;
    if (mode === 'FILL_ASC' && Math.abs(left.fillRatio - right.fillRatio) > EPSILON) return left.fillRatio - right.fillRatio;
    return layerWeightDensity(left) - layerWeightDensity(right)
      || left.depth - right.depth
      || firstCargoId(left).localeCompare(firstCargoId(right));
  });
  // Mixed layers are terminal by construction. Keep them after all pure layers
  // so their earlier-port cargo never has current-port cargo on the door side.
  return [...pure, ...terminalMixed];
}

function resolveColumnCandidateMode(config, portSequence) {
  const mapping = config.columnCandidateModeByPort;
  if (mapping && typeof mapping === 'object') return mapping[portSequence] || mapping[String(portSequence)] || config.columnCandidateMode;
  return config.columnCandidateMode;
}

function resolveLayerOrderingMode(config, portSequence) {
  const mapping = config.layerOrderingModeByPort;
  if (mapping && typeof mapping === 'object') return mapping[portSequence] || mapping[String(portSequence)] || 'MASS_ASC';
  return 'MASS_ASC';
}

function layerWeightDensity(layer) {
  return layer.placements.reduce((sum, placement) => sum + number(placement.instance.weight), 0) / Math.max(number(layer.depth), 1);
}

function firstCargoId(layer) {
  return String(layer.placements[0]?.instance?.instanceId || '');
}

function compareLayers(left, right) {
  if (Math.abs(right.fillRatio - left.fillRatio) > EPSILON) return right.fillRatio - left.fillRatio;
  if (right.placements.length !== left.placements.length) return right.placements.length - left.placements.length;
  if (right.mixedSkuCount !== left.mixedSkuCount) return right.mixedSkuCount - left.mixedSkuCount;
  if (Math.abs(right.contactQuality - left.contactQuality) > EPSILON) return right.contactQuality - left.contactQuality;
  return left.depth - right.depth;
}

function compareBalancedStateCandidates(left, right, instance) {
  if (isFloorRequired(instance) && left.state.floorRequiredCount !== right.state.floorRequiredCount) {
    return left.state.floorRequiredCount - right.state.floorRequiredCount;
  }
  if (Math.abs(left.state.occupiedArea - right.state.occupiedArea) > EPSILON) {
    return left.state.occupiedArea - right.state.occupiedArea;
  }
  if (Math.abs(right.candidate.score - left.candidate.score) > EPSILON) return right.candidate.score - left.candidate.score;
  if (left.candidate.y !== right.candidate.y) return left.candidate.y - right.candidate.y;
  if (left.stateIndex !== right.stateIndex) return left.stateIndex - right.stateIndex;
  if (left.candidate.z !== right.candidate.z) return left.candidate.z - right.candidate.z;
  return left.candidate.dims.label.localeCompare(right.candidate.dims.label);
}

function compareCrossSectionCandidates(left, right) {
  if (Math.abs(right.score - left.score) > EPSILON) return right.score - left.score;
  if (left.y !== right.y) return left.y - right.y;
  const leftWall = Math.min(left.z, Math.max(0, 999999 - (left.z + left.dims.w)));
  const rightWall = Math.min(right.z, Math.max(0, 999999 - (right.z + right.dims.w)));
  if (leftWall !== rightWall) return leftWall - rightWall;
  if (left.z !== right.z) return left.z - right.z;
  return left.dims.label.localeCompare(right.dims.label);
}

function strategyWeights(strategy) {
  if (strategy === 'BALANCE') return { contact: 0.18, balance: 0.52, height: 0.12, futureFit: 0.13, operation: 0.05 };
  if (strategy === 'OPERATION') return { contact: 0.22, balance: 0.20, height: 0.10, futureFit: 0.13, operation: 0.35 };
  return { contact: 0.38, balance: 0.20, height: 0.18, futureFit: 0.19, operation: 0.05 };
}

function unionIntervalLength(intervals) {
  if (intervals.length === 0) return 0;
  const sorted = intervals.filter(([start, end]) => end > start + EPSILON).sort((left, right) => left[0] - right[0]);
  let result = 0; let start = null; let end = null;
  for (const interval of sorted) {
    if (start === null) { [start, end] = interval; }
    else if (interval[0] <= end + EPSILON) end = Math.max(end, interval[1]);
    else { result += end - start; [start, end] = interval; }
  }
  if (start !== null) result += end - start;
  return result;
}

function crossSectionIntersects(left, right) {
  return left.y < right.y + right.h - EPSILON && left.y + left.h > right.y + EPSILON
    && left.z < right.z + right.w - EPSILON && left.z + left.w > right.z + EPSILON;
}

function intervalOverlap(startA, sizeA, startB, sizeB) {
  return Math.max(0, Math.min(startA + sizeA, startB + sizeB) - Math.max(startA, startB));
}

function etaSequenceMap(cargoList) {
  const values = [...new Set(cargoList.map((cargo) => cargo.eta).filter(Boolean))].sort();
  return new Map(values.map((value, index) => [value, index + 1]));
}

function handling(item) { return item.handlingMethod || (number(item.weight) >= 20 ? 'forklift' : 'manual'); }
function normalizeStrategy(value) { const result = String(value || 'SPACE').toUpperCase(); return ['SPACE', 'BALANCE', 'OPERATION'].includes(result) ? result : 'SPACE'; }
function average(values) { return values.length > 0 ? values.reduce((sum, value) => sum + number(value), 0) / values.length : 0; }
function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

function colorFor(key) {
  const palette = ['#346FE8', '#08A6C7', '#ED8B32', '#D6544D', '#7658C9', '#238CC8', '#24A268', '#D5A42B'];
  let hash = 0;
  for (const character of String(key || '')) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

module.exports = CrossSectionLayerBuilder;
module.exports.expandInstances = expandInstances;
