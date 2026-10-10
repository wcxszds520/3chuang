/**
 * FastBlockPackingEngine
 *
 * A deterministic SKU/block-first packing engine for large roadshow datasets.
 * It trades fine-grained gap search for predictable speed: same-SKU cargo is
 * packed into compact blocks, then expanded to the flat loadedCargo contract
 * consumed by the existing mini-program and future Web digital-twin viewer.
 */

const packingPolicy = require('../config/packingPolicy');
const { calculateSupport } = require('./packing/SupportGeometry');
const { evaluateInsertionPath } = require('./packing/InsertionPathFeasibility');
const { resolveAllowedOrientations } = require('./packing/OrientationConstraint');
const { fitsDoor } = require('./packing/InsertionPathFeasibility');
const { explicitTopLoadsPass } = require('./packing/TopLoadConstraint');

class FastBlockPackingEngine {
  constructor(config = {}) {
    this.config = {
      debugMode: false,
      lateralLimitPercent: 5,
      finalLongitudinalLimitPercent: 10,
      manualTopFillMaxWeightKg: 12,
      manualTopFillMaxHeightMm: 450,
      manualTopFillMaxReachY: 1600,
      overheadClearanceMm: 80,
      supportRatioMin: packingPolicy.supportRatioMin,
      contactToleranceMm: packingPolicy.contactToleranceMm,
      heavyOnLightRatio: packingPolicy.heavyOnLightRatio,
      supportLoadMultiplier: packingPolicy.supportLoadMultiplier,
      ...config
    };
    this.palette = [
      '#5B8DEF',
      '#00C2A8',
      '#F2994A',
      '#EB5757',
      '#9B51E0',
      '#2D9CDB',
      '#27AE60',
      '#F2C94C',
      '#56CCF2',
      '#BB6BD9'
    ];
  }

  async generatePackingPlan(cargoList, container) {
    const startTime = Date.now();
    this.container = this._normalizeContainer(container);
    this.containerVolume = this.container.innerLength * this.container.innerWidth * this.container.innerHeight;
    this.loadedCargo = [];
    this.unloadedCargo = [];
    this.pendingUnloaded = [];
    this.freeSpaces = [];
    this.totalLoadedVolume = 0;
    this.loadingIndex = 0;
    this.loadedWeight = 0;
    this.weightedX = 0;
    this.weightedZ = 0;
    this.totalInputWeight = 0;
    this.dynamicBalanceRejections = 0;
    this.constraintRejections = [];
    this.supportLoads = new Map();
    this.supportLayers = new Map();
    this.spatialIndex = new Map();
    this.mainBlockIndex = new Map();

    const groups = this._buildGroups(cargoList);
    this.maxPortSequence = Math.max(...groups.map(group => group.cargo.portSequence || 1), 1);
    this.hasMultiplePorts = new Set(groups.map(group => group.cargo.portSequence || 1)).size > 1;
    this.totalInputWeight = groups.reduce(
      (sum, group) => sum + (Number(group.cargo.weight || 0) * group.quantity),
      0
    );
    let cursorX = 0;

    for (const group of groups) {
      const orientation = this._chooseOrientation(group);
      if (!orientation) {
        this._queueGroupUnloaded(group, 'OVERSIZE_OR_UNSUPPORTED_ORIENTATION');
        continue;
      }

      const positions = this._buildSlicePositions(orientation, group.cargo);
      if (positions.length === 0) {
        this._queueGroupUnloaded(group, 'NO_CROSS_SECTION_CAPACITY');
        continue;
      }

      let remaining = group.quantity;
      while (remaining > 0) {
        if (this._wouldExceedPayload(group.cargo)) {
          this._queueQuantityUnloaded(group, remaining, 'MAX_PAYLOAD_EXCEEDED');
          break;
        }
        if (cursorX + orientation.l > this.container.innerLength) {
          this._queueQuantityUnloaded(group, remaining, 'INSUFFICIENT_LENGTH');
          break;
        }

        const placedPositions = [];
        for (const pos of positions) {
          if (remaining <= 0) break;
          const placed = this._pushLoadedCargo(group, orientation, {
            x: cursorX,
            y: pos.y,
            z: pos.z
          }, { mainBlock: true });
          if (placed) {
            remaining--;
            placedPositions.push(pos);
          }
        }

        this._recordSliceFreeSpaces(orientation, placedPositions, cursorX, group);
        cursorX += orientation.l;
      }
    }

    this._recordTailFreeSpace(cursorX, this.maxPortSequence);
    this._fillQueuedCargo();
    this._flushPendingUnloaded();
    this._centerLoadedCargoAlongLength();

    return this._buildResult(Date.now() - startTime);
  }

  _normalizeContainer(container) {
    return {
      doorWidth: container.doorWidth ?? container.doorWidthMm,
      doorHeight: container.doorHeight ?? container.doorHeightMm,
      typeId: container.typeId || container.id || 'container',
      innerLength: Number(container.innerLength || container.length || 0),
      innerWidth: Number(container.innerWidth || container.width || 0),
      innerHeight: Number(container.innerHeight || container.height || 0),
      maxWeight: Number(container.maxWeight || 0)
    };
  }

  _buildGroups(cargoList) {
    const etaToSequence = this._buildEtaSequenceMap(cargoList);
    const indexed = cargoList.map((rawCargo, index) => {
      const resolvedPortSequence = rawCargo.eta && etaToSequence
        ? etaToSequence[rawCargo.eta]
        : Number(rawCargo.portSequence || 1);
      const cargo = {
        ...rawCargo,
        portSequence: resolvedPortSequence,
        batchId: rawCargo.batchId || `batch_${resolvedPortSequence}`,
        batchKey: rawCargo.batchKey || rawCargo.batchId || `batch_${resolvedPortSequence}`,
        batchLabel: rawCargo.batchLabel || this._makeBatchLabel({
          ...rawCargo,
          portSequence: resolvedPortSequence
        })
      };

      return {
        cargo,
        index,
        quantity: Math.max(1, Number(cargo.quantity || 1)),
        sku: cargo.sku || cargo.name || cargo.cargoId || cargo.id || `sku_${index}`,
        volume: (cargo.length || 0) * (cargo.width || 0) * (cargo.height || 0)
      };
    });

    return indexed.sort((a, b) => {
      const portA = a.cargo.portSequence || 1;
      const portB = b.cargo.portSequence || 1;
      if (portA !== portB) return portA - portB;
      if (b.volume !== a.volume) return b.volume - a.volume;
      return (b.cargo.weight || 0) - (a.cargo.weight || 0);
    });
  }

  _buildEtaSequenceMap(cargoList) {
    const uniqueEtas = [...new Set(cargoList.map(cargo => cargo.eta).filter(Boolean))].sort();
    if (uniqueEtas.length === 0) return null;
    return uniqueEtas.reduce((map, eta, index) => {
      map[eta] = index + 1;
      return map;
    }, {});
  }

  _chooseOrientation(group) {
    const cargo = group.cargo;
    const candidates = this._getOrientationCandidates(cargo);

    let best = null;
    for (const candidate of candidates) {
      if (!this._fitsContainer(candidate)) continue;
      const positions = this._buildSlicePositions(candidate, cargo);
      if (positions.length === 0) continue;
      const slices = Math.ceil(group.quantity / positions.length);
      const requiredLength = slices * candidate.l;
      const crossSectionFill = (positions.length * candidate.w * candidate.h) /
        (this.container.innerWidth * this.container.innerHeight);
      const score = requiredLength - crossSectionFill * 100;

      if (!best || score < best.score) {
        best = { ...candidate, score, perSlice: positions.length };
      }
    }

    return best;
  }

  _getOrientationCandidates(cargo) {
    return resolveAllowedOrientations(cargo).filter(o => fitsDoor(o, this.container)).map((orientation) => ({ ...orientation, inverted: false }));
  }

  _fitsContainer(dims) {
    return dims.l > 0 &&
      dims.w > 0 &&
      dims.h > 0 &&
      dims.l <= this.container.innerLength &&
      dims.w <= this.container.innerWidth &&
      dims.h <= this.container.innerHeight;
  }

  _buildSlicePositions(dims, cargo) {
    const widthCount = Math.floor(this.container.innerWidth / dims.w);
    let heightCount = Math.floor(this.container.innerHeight / dims.h);

    if (cargo.stackable === false || cargo.fragile === true) {
      heightCount = 1;
    } else if (cargo.maxStackLayers) {
      heightCount = Math.min(heightCount, Math.max(1, Number(cargo.maxStackLayers)));
    }
    const topCapacity = cargo.maximumSupportedWeightKg ?? cargo.maxSupportedWeight;
    if (topCapacity != null && Number(cargo.weight) > 0) heightCount = Math.min(heightCount, 1 + Math.floor(Number(topCapacity) / Number(cargo.weight)));

    if (widthCount <= 0 || heightCount <= 0) return [];

    const zPositions = this._centerOutPositions(widthCount, dims.w, this.container.innerWidth);
    const positions = [];
    for (let yIndex = 0; yIndex < heightCount; yIndex++) {
      for (const z of zPositions) {
        positions.push({
          y: yIndex * dims.h,
          z
        });
      }
    }
    return positions;
  }

  _centerOutPositions(count, unitWidth, containerWidth) {
    const usedWidth = count * unitWidth;
    const start = Math.max(0, (containerWidth - usedWidth) / 2);
    const raw = [];
    for (let i = 0; i < count; i++) {
      raw.push(start + i * unitWidth);
    }

    const center = containerWidth / 2;
    return raw.sort((a, b) => {
      const da = Math.abs((a + unitWidth / 2) - center);
      const db = Math.abs((b + unitWidth / 2) - center);
      return da - db;
    });
  }

  _recordSliceFreeSpaces(dims, positions, x, group) {
    if (positions.length === 0) return;

    const zMin = Math.min(...positions.map(pos => pos.z));
    const zMax = Math.max(...positions.map(pos => pos.z + dims.w));
    const yMax = Math.max(...positions.map(pos => pos.y + dims.h));

    this._addFreeSpace({
      kind: 'side-left',
      x,
      y: 0,
      z: 0,
      l: dims.l,
      h: this.container.innerHeight,
      w: zMin,
      portSequence: group.cargo.portSequence || 1,
      sku: group.sku
    });

    this._addFreeSpace({
      kind: 'side-right',
      x,
      y: 0,
      z: zMax,
      l: dims.l,
      h: this.container.innerHeight,
      w: this.container.innerWidth - zMax,
      portSequence: group.cargo.portSequence || 1,
      sku: group.sku
    });

    this._addFreeSpace({
      kind: 'top',
      x,
      y: yMax,
      z: zMin,
      l: dims.l,
      h: this.container.innerHeight - yMax,
      w: zMax - zMin,
      portSequence: group.cargo.portSequence || 1,
      sku: group.sku
    });
  }

  _recordTailFreeSpace(cursorX, portSequence) {
    this._addFreeSpace({
      kind: 'tail',
      x: cursorX,
      y: 0,
      z: 0,
      l: this.container.innerLength - cursorX,
      h: this.container.innerHeight,
      w: this.container.innerWidth,
      portSequence
    });
  }

  _addFreeSpace(space) {
    const minUsefulSize = 80;
    if (space.l < minUsefulSize || space.h < minUsefulSize || space.w < minUsefulSize) return;
    this.freeSpaces.push({
      ...space,
      cursorX: space.x,
      cursorY: space.y,
      cursorZ: space.z,
      rowDepth: 0,
      layerHeight: 0
    });
  }

  _fillQueuedCargo() {
    for (const pending of this.pendingUnloaded) {
      let progress = true;
      while (pending.quantity > 0 && progress) {
        progress = false;
        for (const space of this.freeSpaces) {
          if (this._tryPlaceInFreeSpace(space, pending.group)) {
            pending.quantity--;
            progress = true;
            break;
          }
        }
      }
      if (pending.quantity > 0 && this._wouldExceedPayload(pending.group.cargo)) pending.reason = 'MAX_PAYLOAD_EXCEEDED';
    }
  }

  _tryPlaceInFreeSpace(space, group) {
    if (!this._spaceAcceptsGroup(space, group)) return false;

    const dims = this._chooseOrientationForSpace(group.cargo, space);
    if (!dims) return false;

    const maxX = space.x + space.l;
    const maxY = space.y + space.h;
    const maxZ = space.z + space.w;

    if (space.cursorZ + dims.w > maxZ + 0.001) {
      space.cursorZ = space.z;
      space.cursorY += Math.max(space.layerHeight, dims.h);
      space.layerHeight = 0;
    }

    if (space.cursorY + dims.h > maxY + 0.001) {
      space.cursorY = space.y;
      space.cursorZ = space.z;
      space.cursorX += Math.max(space.rowDepth, dims.l);
      space.rowDepth = 0;
      space.layerHeight = 0;
    }

    if (space.cursorX + dims.l > maxX + 0.001) {
      return false;
    }

    const placed = this._pushLoadedCargo(group, dims, {
      x: space.cursorX,
      y: space.cursorY,
      z: space.cursorZ
    }, {
      fillPacked: true,
      spaceKind: space.kind,
      spacePortSequence: space.portSequence
    });
    if (!placed) return false;

    space.cursorZ += dims.w;
    space.rowDepth = Math.max(space.rowDepth, dims.l);
    space.layerHeight = Math.max(space.layerHeight, dims.h);
    return true;
  }

  _spaceAcceptsGroup(space, group) {
    const groupPort = group.cargo.portSequence || 1;
    if (space.portSequence !== groupPort) return false;
    if (space.kind === 'tail' && groupPort !== this.maxPortSequence) return false;
    return true;
  }

  _chooseOrientationForSpace(cargo, space) {
    if (space.kind === 'top' && !this._isTopFillCargoAllowed(cargo, space)) {
      return null;
    }

    const candidates = this._getOrientationCandidates(cargo);
    let best = null;
    for (const dims of candidates) {
      if (space.kind === 'top') {
        const topY = space.cursorY + dims.h;
        if (dims.h > this.config.manualTopFillMaxHeightMm) continue;
        if (topY > this.container.innerHeight - this.config.overheadClearanceMm) continue;
      }
      if (dims.l <= space.l && dims.w <= space.w && dims.h <= space.h) {
        const score = dims.l * 0.6 + dims.h * 0.3 + dims.w * 0.1;
        if (!best || score < best.score) {
          best = { ...dims, score };
        }
      }
    }
    return best;
  }

  _isTopFillCargoAllowed(cargo, space) {
    const weight = Number(cargo.weight || 0);
    if (weight > this.config.manualTopFillMaxWeightKg) return false;
    if (cargo.fragile === true) return false;
    if (space.y > this.config.manualTopFillMaxReachY) return false;
    return true;
  }

  _pushLoadedCargo(group, dims, position, meta = {}) {
    const cargo = group.cargo;
    const color = this._colorFor(group.sku);
    const x = this.container.innerLength - (position.x + dims.l);
    if (!explicitTopLoadsPass([...this.loadedCargo, {...cargo,...dims,...position,x}],this.config.contactToleranceMm)) {
      this.constraintRejections.push({sku:group.sku,code:'EXPLICIT_TOP_LOAD',message:'候选将使整垛传递重量超过声明承重'});
      return false;
    }

    const constraint = meta.mainBlock === true
      ? this._evaluateMainBlockConstraints(cargo, dims, { ...position, x })
      : this._evaluatePlacementConstraints(cargo, dims, { ...position, x });
    if (!constraint.valid) {
      this.constraintRejections.push({ sku: group.sku, ...constraint.reason });
      return false;
    }

    if (!this._passesDynamicBalance(cargo, dims, { ...position, x })) {
      this.dynamicBalanceRejections++;
      this.constraintRejections.push({ sku: group.sku, code: 'DYNAMIC_BALANCE', message: '候选位置超过动态重心阈值' });
      return false;
    }

    this.loadingIndex++;

    const loadedItem = {
      loadingIndex: this.loadingIndex,
      name: cargo.name,
      cargoId: `${cargo.cargoId || cargo.id || group.sku}_${this.loadingIndex}`,
      sourceCargoId: cargo.cargoId || cargo.id || group.sku,
      x,
      y: position.y,
      z: position.z,
      l: dims.l,
      h: dims.h,
      w: dims.w,
      color,
      type: this._mapCargoType(cargo),
      packagingType: cargo.packagingType,
      weight: cargo.weight || 0,
      fragile: cargo.fragile === true,
      dangerous: cargo.dangerous === true,
      stackable: cargo.stackable !== false,
      maxStackLayers: Number(cargo.maxStackLayers || cargo.maxStack || 1),
      maximumSupportedWeightKg: cargo.maximumSupportedWeightKg ?? cargo.maxSupportedWeight ?? null,
      maxSupportedWeight: cargo.maximumSupportedWeightKg ?? cargo.maxSupportedWeight ?? null,
      canRotate: cargo.canRotate !== false,
      canInvert: cargo.canInvert === true,
      canLayFlat: cargo.canLayFlat === true,
      orientationPolicy: cargo.orientationPolicy || null,
      orientationConstraints: cargo.orientationConstraints || null,
      batchId: cargo.batchId || `batch_${cargo.portSequence || 1}`,
      batchKey: cargo.batchKey || cargo.batchId || `batch_${cargo.portSequence || 1}`,
      batchLabel: cargo.batchLabel || this._makeBatchLabel(cargo),
      destinationPort: cargo.destinationPort,
      eta: cargo.eta,
      portSequence: cargo.portSequence || 1,
      sku: group.sku,
      handlingMethod: cargo.handlingMethod || ((cargo.weight || 0) >= 20 ? 'forklift' : 'manual'),
      handlingPolicy: cargo.handlingPolicy || 'derived',
      heavy: cargo.heavy === true || (cargo.weight || 0) >= 20,
      wooden: cargo.wooden === true || /wood|pallet|木/i.test(cargo.packagingType || ''),
      riskNotes: Array.isArray(cargo.riskNotes) ? [...cargo.riskNotes] : [],
      source: cargo.source || null,
      orientation: dims.legacyLabel || dims.label,
      orientationId: dims.id || dims.label,
      canonicalOrientation: dims.id || dims.label,
      axisMap: dims.axisMap ? { ...dims.axisMap } : null,
      uprightOriginalAxis: dims.uprightOriginalAxis || null,
      inverted: dims.inverted === true,
      stackLevel: constraint.stackLevel,
      supportRatio: constraint.supportRatio,
      placementReason: {
        unloadingGroup: cargo.portSequence || 1,
        block: meta.spaceKind || 'main',
        layer: constraint.stackLevel,
        orientation: dims.label,
        balanceInfluence: constraint.balanceInfluence,
        rejectedConstraintsBeforePlacement: this.constraintRejections.filter((entry) => entry.sku === group.sku).slice(-4)
      },
      algorithmMeta: {
        blockPacked: meta.fillPacked !== true,
        fillPacked: meta.fillPacked === true,
        spaceKind: meta.spaceKind || 'main',
        spacePortSequence: meta.spacePortSequence,
        orientation: dims.label,
        lifoSafeFill: meta.fillPacked === true ? true : undefined,
        handlingMode: cargo.handlingMethod || ((cargo.weight || 0) >= 20 ? 'forklift' : 'manual'),
        placementMode: meta.spaceKind === 'top' ? 'manual-light-top-fill' : 'floor-or-block'
      }
    };

    this.loadedCargo.push(loadedItem);
    this.totalLoadedVolume += dims.l * dims.w * dims.h;
    this._commitSupportLoads(loadedItem, constraint.supports);
    if (meta.mainBlock === true) this.mainBlockIndex.set(mainBlockKey(loadedItem), loadedItem);
    this._commitWeightMoments(loadedItem);
    return true;
  }

  _wouldExceedPayload(cargo) {
    const maxPayload = Number(this.container.maxWeight || 0);
    return maxPayload > 0 && this.loadedWeight + Number(cargo.weight || 0) > maxPayload + 0.0001;
  }

  _evaluatePlacementConstraints(cargo, dims, position) {
    const candidate = { ...position, l: dims.l, w: dims.w, h: dims.h, weight: Number(cargo.weight || 0) };
    if (this._wouldExceedPayload(cargo)) return invalid('MAX_PAYLOAD_EXCEEDED', '累计货重将超过柜型 max payload');
    if (candidate.x < 0 || candidate.y < 0 || candidate.z < 0
      || candidate.x + candidate.l > this.container.innerLength + 0.001
      || candidate.y + candidate.h > this.container.innerHeight + 0.001
      || candidate.z + candidate.w > this.container.innerWidth + 0.001) return invalid('OUT_OF_BOUNDS', '候选位置超出柜内边界');
    const collision = this._collisionCandidates(candidate).find((item) => intersects(candidate, item, packingPolicy.collisionToleranceMm));
    if (collision) return invalid('COLLISION', `候选位置与 ${collision.cargoId} 相交`, { cargoId: collision.cargoId });

    const support = calculateSupport(candidate, this._supportCandidates(candidate.y), this.config.contactToleranceMm);
    if (candidate.y > this.config.contactToleranceMm && support.ratio + 1e-9 < this.config.supportRatioMin) {
      return invalid('SUPPORT_RATIO', `支撑率 ${(support.ratio * 100).toFixed(1)}% 低于 ${(this.config.supportRatioMin * 100).toFixed(1)}%`, { supportRatio: support.ratio });
    }
    let stackLevel = 1;
    for (const entry of support.supports) {
      const lower = entry.cargo;
      stackLevel = Math.max(stackLevel, Number(lower.stackLevel || 1) + 1);
      if (lower.fragile === true) return invalid('FRAGILE_SUPPORT', `易碎货物 ${lower.cargoId} 上方禁止承载`, { cargoId: lower.cargoId });
      if (lower.stackable === false) return invalid('NON_STACKABLE_SUPPORT', `不可堆叠货物 ${lower.cargoId} 上方禁止放置`, { cargoId: lower.cargoId });
      if (Number(lower.stackLevel || 1) >= Number(lower.maxStackLayers || 1)) return invalid('MAX_STACK', `${lower.cargoId} 已达到最大堆叠层数`, { cargoId: lower.cargoId });
      const upperWeight = Number(cargo.weight || 0);
      const lowerWeight = Number(lower.weight || 0);
      const lowerIsReinforced = lower.wooden === true || /wood|pallet|reinforced/i.test(String(lower.packagingType || ''));
      if (!lowerIsReinforced && lowerWeight > 0 && upperWeight > lowerWeight * this.config.heavyOnLightRatio) {
        return invalid('HEAVY_ON_LIGHT', `${upperWeight}kg 货物不得压在 ${lowerWeight}kg 的 ${lower.cargoId} 上`, { cargoId: lower.cargoId });
      }
      const share = support.supportedArea > 0 ? upperWeight * (entry.area / support.supportedArea) : upperWeight;
      const existingLoad = Number(this.supportLoads.get(lower.cargoId) || 0);
      const capacity = lower.maximumSupportedWeightKg ?? lower.maxSupportedWeight ?? Math.max(lowerWeight, 1) * this.config.supportLoadMultiplier;
      if (existingLoad + share > capacity) return invalid('SUPPORT_LOAD_CAPACITY', `${lower.cargoId} 的基础承载规则上限已达到`, { cargoId: lower.cargoId });
    }
    return {
      valid: true,
      supportRatio: support.ratio,
      supports: support.supports,
      stackLevel,
      balanceInfluence: this._projectedBalanceInfluence(cargo, dims, position)
    };
  }

  _evaluateMainBlockConstraints(cargo, dims, position) {
    if (this._wouldExceedPayload(cargo)) return invalid('MAX_PAYLOAD_EXCEEDED', '累计货重将超过柜型 max payload');
    if (position.x < 0 || position.y < 0 || position.z < 0
      || position.x + dims.l > this.container.innerLength + 0.001
      || position.y + dims.h > this.container.innerHeight + 0.001
      || position.z + dims.w > this.container.innerWidth + 0.001) return invalid('OUT_OF_BOUNDS', '候选位置超出柜内边界');

    let stackLevel = 1;
    let supports = [];
    if (position.y > this.config.contactToleranceMm) {
      const lower = this.mainBlockIndex.get(mainBlockKey({
        x: position.x,
        y: position.y - dims.h,
        z: position.z,
        l: dims.l,
        h: dims.h,
        w: dims.w
      }));
      // A missing exact lower block means this is no longer the regular block
      // geometry; retain the general collision/support validator as a safe fallback.
      if (!lower) return this._evaluatePlacementConstraints(cargo, dims, position);
      const upperWeight = Number(cargo.weight || 0);
      const lowerWeight = Number(lower.weight || 0);
      const existingLoad = Number(this.supportLoads.get(lower.cargoId) || 0);
      const capacity = Math.max(lowerWeight, 1) * this.config.supportLoadMultiplier;
      if (existingLoad + upperWeight > capacity) {
        return invalid('SUPPORT_LOAD_CAPACITY', `${lower.cargoId} 的基础承载规则上限已达到`, { cargoId: lower.cargoId });
      }
      stackLevel = Number(lower.stackLevel || 1) + 1;
      supports = [{ cargo: lower, area: dims.l * dims.w }];
    }

    return {
      valid: true,
      supportRatio: 1,
      supports,
      stackLevel,
      balanceInfluence: this._projectedBalanceInfluence(cargo, dims, position)
    };
  }

  _projectedBalanceInfluence(cargo, dims, position) {
    const weight = Number(cargo.weight || 0);
    const projectedWeight = this.loadedWeight + weight;
    if (!(projectedWeight > 0)) return { lateralPercent: 0, longitudinalPercent: 0 };
    const centerX = position.x + dims.l / 2;
    const centerZ = position.z + dims.w / 2;
    const cogX = (this.weightedX + centerX * weight) / projectedWeight;
    const cogZ = (this.weightedZ + centerZ * weight) / projectedWeight;
    return {
      lateralPercent: this.container.innerWidth ? Math.abs((cogZ - this.container.innerWidth / 2) / (this.container.innerWidth / 2)) * 100 : 0,
      longitudinalPercent: this.container.innerLength ? Math.abs((cogX - this.container.innerLength / 2) / (this.container.innerLength / 2)) * 100 : 0
    };
  }

  _commitSupportLoads(item, supports) {
    const supportedArea = supports.reduce((sum, entry) => sum + entry.area, 0);
    for (const entry of supports) {
      const share = supportedArea > 0 ? Number(item.weight || 0) * entry.area / supportedArea : 0;
      this.supportLoads.set(entry.cargo.cargoId, Number(this.supportLoads.get(entry.cargo.cargoId) || 0) + share);
    }
    const topKey = Math.round((Number(item.y) + Number(item.h)) / this.config.contactToleranceMm);
    if (!this.supportLayers.has(topKey)) this.supportLayers.set(topKey, []);
    this.supportLayers.get(topKey).push(item);
    this._indexCargo(item);
  }

  _supportCandidates(y) {
    const key = Math.round(Number(y) / this.config.contactToleranceMm);
    return [key - 1, key, key + 1].flatMap((candidateKey) => this.supportLayers.get(candidateKey) || []);
  }

  _indexCargo(item) {
    for (const key of spatialKeys(item)) {
      if (!this.spatialIndex.has(key)) this.spatialIndex.set(key, []);
      this.spatialIndex.get(key).push(item);
    }
  }

  _collisionCandidates(candidate) {
    const unique = new Map();
    for (const key of spatialKeys(candidate)) {
      for (const item of this.spatialIndex.get(key) || []) unique.set(item.cargoId, item);
    }
    return [...unique.values()];
  }

  _passesDynamicBalance(cargo, dims, position) {
    const weight = Number(cargo.weight || 0);
    if (weight <= 0) return true;

    const projectedWeight = this.loadedWeight + weight;
    const centerX = position.x + dims.l / 2;
    const centerZ = position.z + dims.w / 2;
    const projectedCogX = (this.weightedX + centerX * weight) / projectedWeight;
    const projectedCogZ = (this.weightedZ + centerZ * weight) / projectedWeight;
    const lateral = this.container.innerWidth > 0
      ? Math.abs((projectedCogZ - this.container.innerWidth / 2) / (this.container.innerWidth / 2)) * 100
      : 0;
    const longitudinal = this.container.innerLength > 0
      ? Math.abs((projectedCogX - this.container.innerLength / 2) / (this.container.innerLength / 2)) * 100
      : 0;
    const minWeightForHardCheck = Math.max(600, this.totalInputWeight * 0.08);
    if (projectedWeight >= minWeightForHardCheck && lateral > this.config.lateralLimitPercent) {
      return false;
    }

    const finalPhaseWeight = Math.max(1000, this.totalInputWeight * 0.75);
    if (this.hasMultiplePorts &&
        projectedWeight >= finalPhaseWeight &&
        longitudinal > this.config.finalLongitudinalLimitPercent) {
      return false;
    }

    return true;
  }

  _commitWeightMoments(item) {
    const weight = Number(item.weight || 0);
    this.loadedWeight += weight;
    this.weightedX += (item.x + item.l / 2) * weight;
    this.weightedZ += (item.z + item.w / 2) * weight;
  }

  _centerLoadedCargoAlongLength() {
    if (this.loadedCargo.length === 0) return;

    const minX = Math.min(...this.loadedCargo.map(item => item.x));
    const maxX = Math.max(...this.loadedCargo.map(item => item.x + item.l));
    const usedLength = maxX - minX;
    if (usedLength >= this.container.innerLength - 1) return;

    const targetMinX = (this.container.innerLength - usedLength) / 2;
    const delta = targetMinX - minX;
    if (Math.abs(delta) < 1) return;

    for (const item of this.loadedCargo) {
      item.x += delta;
      item.algorithmMeta = {
        ...item.algorithmMeta,
        longitudinalCentered: true,
        securingRequired: 'dunnage-or-lashing'
      };
    }

    this.loadedWeight = 0;
    this.weightedX = 0;
    this.weightedZ = 0;
    for (const item of this.loadedCargo) {
      this._commitWeightMoments(item);
    }
  }

  _queueGroupUnloaded(group, reason) {
    this._queueQuantityUnloaded(group, group.quantity, reason);
  }

  _queueQuantityUnloaded(group, quantity, reason) {
    if (quantity <= 0) return;
    this.pendingUnloaded.push({
      group,
      quantity,
      reason
    });
  }

  _flushPendingUnloaded() {
    for (const pending of this.pendingUnloaded) {
      this._markQuantityUnloaded(pending.group, pending.quantity, pending.reason);
    }
    this.pendingUnloaded = [];
  }

  _markQuantityUnloaded(group, quantity, reason) {
    for (let i = 0; i < quantity; i++) {
      const cargo = group.cargo;
      this.unloadedCargo.push({
        ...cargo,
        cargoId: `${cargo.cargoId || cargo.id || group.sku}_unloaded_${i + 1}`,
        sourceCargoId: cargo.cargoId || cargo.id || group.sku,
        quantity: 1,
        reason
      });
    }
  }

  _buildResult(elapsedMs) {
    const totalWeight = this.loadedCargo.reduce((sum, item) => sum + (item.weight || 0), 0);
    const spaceUtilization = this.containerVolume > 0
      ? (this.totalLoadedVolume / this.containerVolume) * 100
      : 0;
    const cog = this._calculateCoG(totalWeight);
    const cogOffset = this._calculateCoGOffset(cog);
    const lifoCompliant = this._checkLIFOHardConstraint();
    const insertionPath = this._validateFinalInsertionPaths();
    const warnings = [];
    if (this.unloadedCargo.length > 0) warnings.push({ type: 'FAST_BLOCK_PARTIAL', message: `${this.unloadedCargo.length} 件未装入` });
    if (cogOffset.lateral > this.config.lateralLimitPercent || cogOffset.longitudinal > this.config.finalLongitudinalLimitPercent) warnings.push({ type: 'COG_OFFSET', message: `重心偏移横向 ${cogOffset.lateral.toFixed(2)}% / 纵向 ${cogOffset.longitudinal.toFixed(2)}% 超过配置阈值` });
    if (!lifoCompliant) warnings.push({ type: 'LIFO_VIOLATION', message: '最终 placement 未通过 LIFO 空间顺序检查' });
    if (!insertionPath.feasible) warnings.push({ type: 'INSERTION_PATH', message: `${insertionPath.failures.length} 件货物的 AABB 插入路径需复核` });

    return {
      loadedCargo: this.loadedCargo,
      unloadedCargo: this.unloadedCargo,
      spaceUtilization: Math.min(spaceUtilization, 100),
      totalWeight,
      cog,
      cogOffset,
      metrics: {
        algorithm: 'fast-block',
        elapsedMs,
        totalVolume: this.totalLoadedVolume,
        dynamicBalanceRejections: this.dynamicBalanceRejections,
        constraintRejections: this.constraintRejections.length
      },
      constraintMeta: {
        standardsProfile: 'Ningbo port entry + GB/T container limits + CTU Code + SOLAS VGM',
        enforcedConstraints: [
          'LIFO unloading order',
          'dynamic center-of-gravity',
          'container max payload',
          'orientation semantics',
          'support ratio and basic stacking',
          'AABB insertion path feasibility'
        ],
        lifoCompliant,
        insertionPathFeasible: insertionPath.feasible,
        insertionPathFailures: insertionPath.failures,
        supportRatioMin: this.config.supportRatioMin,
        maxPayloadEnforced: this.container.maxWeight > 0,
        fillPolicy: 'same-port-only; no cross-batch gap filling',
        topFillPolicy: `light non-fragile cargo only; <=${this.config.manualTopFillMaxWeightKg}kg; <=${this.config.manualTopFillMaxReachY}mm reach`,
        securingPolicy: 'partial loads are length-centered and require dunnage or lashing',
        doorSide: 'higher x coordinate',
        deepestSide: 'lower x coordinate'
      },
      warnings
    };
  }

  _validateFinalInsertionPaths() {
    const ordered = [...this.loadedCargo].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
    const crossSectionIndex = new Map();
    const failures = [];
    for (const item of ordered) {
      const candidates = new Map();
      for (const key of crossSectionKeys(item)) {
        for (const placed of crossSectionIndex.get(key) || []) candidates.set(placed.cargoId, placed);
      }
      // Items wholly deeper than the target cannot intersect its high-X door
      // insertion segment. Filtering them keeps final validation near-linear
      // for large, regular SKU blocks without relaxing the geometry check.
      const blockers = [...candidates.values()].filter((placed) =>
        Number(placed.x) + Number(placed.l) > Number(item.x) + packingPolicy.collisionToleranceMm
        && crossSectionOverlaps(item, placed, packingPolicy.collisionToleranceMm)
      );
      const result = evaluateInsertionPath(item, blockers, this.container);
      if (!result.feasible) failures.push({ cargoId: item.cargoId, reasons: result.reasons });
      for (const key of crossSectionKeys(item)) {
        if (!crossSectionIndex.has(key)) crossSectionIndex.set(key, []);
        crossSectionIndex.get(key).push(item);
      }
    }
    return { feasible: failures.length === 0, failures };
  }

  _checkLIFOHardConstraint() {
    const batches = new Map();
    for (const item of this.loadedCargo) {
      const portSequence = Number(item.portSequence || 1);
      if (!batches.has(portSequence)) {
        batches.set(portSequence, { minX: Infinity, maxX: -Infinity, count: 0 });
      }
      const batch = batches.get(portSequence);
      batch.minX = Math.min(batch.minX, item.x);
      batch.maxX = Math.max(batch.maxX, item.x + item.l);
      batch.count++;
    }

    const sequences = [...batches.keys()].sort((a, b) => a - b);
    for (let i = 0; i < sequences.length; i++) {
      for (let j = i + 1; j < sequences.length; j++) {
        const earlierUnloaded = batches.get(sequences[i]);
        const laterUnloaded = batches.get(sequences[j]);
        if (earlierUnloaded.minX + 1 < laterUnloaded.maxX) {
          return false;
        }
      }
    }
    return true;
  }

  _calculateCoG(totalWeight) {
    if (this.loadedCargo.length === 0 || totalWeight <= 0) {
      return { x: 0, y: 0, z: 0 };
    }

    let mx = 0;
    let my = 0;
    let mz = 0;
    for (const item of this.loadedCargo) {
      const weight = item.weight || 0;
      mx += (item.x + item.l / 2) * weight;
      my += (item.y + item.h / 2) * weight;
      mz += (item.z + item.w / 2) * weight;
    }

    return {
      x: mx / totalWeight,
      y: my / totalWeight,
      z: mz / totalWeight
    };
  }

  _calculateCoGOffset(cog) {
    const centerX = this.container.innerLength / 2;
    const centerZ = this.container.innerWidth / 2;
    const lateralRaw = centerZ > 0 ? ((cog.z - centerZ) / centerZ) * 100 : 0;
    const longitudinalRaw = centerX > 0 ? ((cog.x - centerX) / centerX) * 100 : 0;

    return {
      lateral: Math.abs(lateralRaw),
      longitudinal: Math.abs(longitudinalRaw),
      direction: lateralRaw > 0 ? 'right' : 'left',
      percentage: lateralRaw.toFixed(2)
    };
  }

  _mapCargoType(cargo) {
    if (cargo.fragile === true) return 'fragile';
    if ((cargo.weight || 0) >= 20) return 'heavy';
    const type = String(cargo.packagingType || '').toLowerCase();
    if (type.includes('glass') || type.includes('ceramic') || type.includes('porcelain')) {
      return 'fragile';
    }
    return 'normal';
  }

  _makeBatchLabel(cargo) {
    const port = cargo.destinationPort || '';
    const eta = cargo.eta || '';
    if (port && eta) return `${port} · ${eta}`;
    if (port) return port;
    if (eta) return eta;
    return `Batch ${cargo.portSequence || 1}`;
  }

  _colorFor(key) {
    let hash = 0;
    const str = String(key || '');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return this.palette[Math.abs(hash) % this.palette.length];
  }
}

function invalid(code, message, evidence = {}) {
  return { valid: false, reason: { code, message, ...evidence } };
}

function intersects(a, b, tolerance = 0.5) {
  return Number(a.x) < Number(b.x) + Number(b.l) - tolerance
    && Number(a.x) + Number(a.l) > Number(b.x) + tolerance
    && Number(a.y) < Number(b.y) + Number(b.h) - tolerance
    && Number(a.y) + Number(a.h) > Number(b.y) + tolerance
    && Number(a.z) < Number(b.z) + Number(b.w) - tolerance
    && Number(a.z) + Number(a.w) > Number(b.z) + tolerance;
}

function spatialKeys(box, cellSize = 500) {
  const minX = Math.floor(Number(box.x) / cellSize);
  const maxX = Math.floor((Number(box.x) + Number(box.l) - 0.001) / cellSize);
  const minY = Math.floor(Number(box.y) / cellSize);
  const maxY = Math.floor((Number(box.y) + Number(box.h) - 0.001) / cellSize);
  const minZ = Math.floor(Number(box.z) / cellSize);
  const maxZ = Math.floor((Number(box.z) + Number(box.w) - 0.001) / cellSize);
  const keys = [];
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) keys.push(`${x}:${y}:${z}`);
  return keys;
}

function crossSectionKeys(box, cellSize = 500) {
  const minY = Math.floor(Number(box.y) / cellSize);
  const maxY = Math.floor((Number(box.y) + Number(box.h) - 0.001) / cellSize);
  const minZ = Math.floor(Number(box.z) / cellSize);
  const maxZ = Math.floor((Number(box.z) + Number(box.w) - 0.001) / cellSize);
  const keys = [];
  for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) keys.push(`${y}:${z}`);
  return keys;
}

function crossSectionOverlaps(a, b, tolerance = 0.5) {
  return Number(a.y) < Number(b.y) + Number(b.h) - tolerance
    && Number(a.y) + Number(a.h) > Number(b.y) + tolerance
    && Number(a.z) < Number(b.z) + Number(b.w) - tolerance
    && Number(a.z) + Number(a.w) > Number(b.z) + tolerance;
}

function mainBlockKey(box) {
  return `${box.x}|${box.y}|${box.z}|${box.l}|${box.h}|${box.w}`;
}

module.exports = FastBlockPackingEngine;
