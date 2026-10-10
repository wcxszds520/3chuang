'use strict';

const { legalOrientations } = require('./PlanValidator');
const { normalizeContainer } = require('./PlanMetrics');
const { fitsDoor } = require('./InsertionPathFeasibility');
const CrossSectionLayerBuilder = require('./CrossSectionLayerBuilder');
const { analyzeOperationFeasibility } = require('./CanonicalOperationFeasibility');

const EPSILON = 0.001;

/**
 * A deterministic, bounded extreme-point beam for small floor-only sets.
 * This is an independent production candidate, not the test oracle: it uses
 * fixed sort starts and a bounded state frontier instead of exhaustive DFS.
 */
class FloorExtremePointCandidate {
  constructor(config = {}) {
    this.config = { maximumInstances: 9, beamWidth: 512, maximumStarts: 8, ...config };
  }

  build(cargoList = [], containerInput = {}) {
    const container = normalizeContainer(containerInput);
    const instances = CrossSectionLayerBuilder.expandInstances(cargoList);
    if (!eligible(instances, container, this.config.maximumInstances)) return null;
    const starts = deterministicStarts(instances).slice(0, this.config.maximumStarts);
    let best = { placements: [], loadedVolume: 0 };
    let exploredStateCount = 0;
    for (const ordered of starts) {
      let frontier = [{ placements: [], loadedVolume: 0 }];
      for (const instance of ordered) {
        const next = [];
        for (const state of frontier) {
          next.push(state);
          for (const dims of operationSafeOrientations(instance).filter(o=>fitsDoor(o,container))) {
            if (dims.l > container.innerLength + EPSILON || dims.w > container.innerWidth + EPSILON || dims.h > container.innerHeight + EPSILON) continue;
            for (const point of extremePoints(state.placements, dims, container)) {
              const placement = toPlacement(instance, dims, point);
              if (state.placements.some((other) => intersectsFloor(placement, other))) continue;
              next.push({
                placements: [...state.placements, placement],
                loadedVolume: state.loadedVolume + dims.l * dims.w * dims.h
              });
            }
          }
        }
        exploredStateCount += next.length;
        // Sorting is independent of operation feasibility. Scan in that same
        // order until the beam contains enough verified states. This returns
        // exactly the former filter/sort/slice result without auditing states
        // that cannot enter the beam.
        const ranked = deduplicate(next, container).sort((left,right)=>compareStates(left,right,container));
        frontier = [];
        for (const state of ranked) {
          if (analyzeOperationFeasibility({placements:state.placements,container}).blockedCount === 0) frontier.push(state);
          if (frontier.length >= this.config.beamWidth) break;
        }
      }
      const candidate = frontier.sort((left, right) => compareStates(left, right, container))[0]
        || { placements: [], loadedVolume: 0 };
      if (compareStates(candidate, best, container) < 0) best = candidate;
    }
    const loadedIds = new Set(best.placements.map((placement) => placement.cargoId));
    const occupiedDepth = best.placements.reduce((maximum, placement) => Math.max(maximum, placement.x + placement.l), 0);
    return {
      candidateSource: 'FLOOR_EXTREME_POINT_BEAM',
      mixedSkuPolicy: 'SKU and batch are not spatial barriers; the candidate is restricted to one port and floor-only cargo.',
      deterministic: true,
      placements: best.placements,
      unloaded: instances.filter((item) => !loadedIds.has(item.instanceId)).map((item) => ({ ...item, cargoId: item.instanceId, quantity: 1, reason: 'NO_FLOOR_EXTREME_POINT_CAPACITY' })),
      occupiedDepth,
      layers: [],
      stageReports: [{
        portSequence: number(instances[0]?.portSequence || 1),
        inputCount: instances.length,
        loadedCount: best.placements.length,
        occupiedDepth,
        variant: 'BOUNDED_FLOOR_EXTREME_POINT_BEAM',
        exploredStateCount
      }]
    };
  }
}

function eligible(instances, container, maximumInstances) {
  if (instances.length === 0 || instances.length > maximumInstances) return false;
  if (new Set(instances.map((item) => number(item.portSequence || 1))).size !== 1) return false;
  if (instances.some((item) => item.stackable !== false && number(item.maxStackLayers || 1) > 1)) return false;
  return instances.every((item) => operationSafeOrientations(item).some((dims) => fitsDoor(dims,container) && dims.l <= container.innerLength + EPSILON
    && dims.w <= container.innerWidth + EPSILON && dims.h <= container.innerHeight + EPSILON));
}

function deterministicStarts(instances) {
  const comparators = [
    (a, b) => footprint(b) - footprint(a) || compareId(a, b),
    (a, b) => Math.max(number(b.length), number(b.width)) - Math.max(number(a.length), number(a.width)) || compareId(a, b),
    (a, b) => number(b.length) - number(a.length) || number(b.width) - number(a.width) || compareId(a, b),
    (a, b) => number(b.width) - number(a.width) || number(b.length) - number(a.length) || compareId(a, b),
    (a, b) => number(a.length) - number(b.length) || number(a.width) - number(b.width) || compareId(a, b),
    (a, b) => number(a.width) - number(b.width) || number(a.length) - number(b.length) || compareId(a, b),
    compareId
  ];
  const result = comparators.map((comparator) => [...instances].sort(comparator));
  result.push([...instances].sort(compareId).reverse());
  return [...new Map(result.map((ordered) => [ordered.map((item) => item.instanceId).join('|'), ordered])).values()];
}

function extremePoints(placements, dims, container) {
  const xs = new Set([0]);
  const zs = new Set([0, container.innerWidth - dims.w]);
  for (const placement of placements) {
    xs.add(placement.x + placement.l);
    xs.add(placement.x - dims.l);
    zs.add(placement.z + placement.w);
    zs.add(placement.z - dims.w);
  }
  const points = [];
  for (const rawX of xs) for (const rawZ of zs) {
    const x = round(rawX); const z = round(rawZ);
    if (x < -EPSILON || z < -EPSILON || x + dims.l > container.innerLength + EPSILON || z + dims.w > container.innerWidth + EPSILON) continue;
    points.push({ x, z });
  }
  return points.sort((left, right) => left.x - right.x
    || wallDistance(left.z, dims.w, container.innerWidth) - wallDistance(right.z, dims.w, container.innerWidth)
    || left.z - right.z);
}

function operationSafeOrientations(instance) {
  return legalOrientations(instance).filter((orientation) => handling(instance) !== 'manual'
    || (number(instance.weight) > 0 && number(instance.weight) <= 25
      && orientation.l <= 1200 + EPSILON && orientation.w <= 1200 + EPSILON && orientation.h <= 1000 + EPSILON));
}

function toPlacement(instance, dims, point) {
  return {
    cargoId: instance.instanceId,
    sourceCargoId: instance.sourceCargoId,
    name: instance.name,
    x: point.x,
    y: 0,
    z: point.z,
    l: dims.l,
    w: dims.w,
    h: dims.h,
    weight: number(instance.weight),
    color: colorFor(instance.sku || instance.sourceCargoId),
    fragile: instance.fragile === true,
    stackable: instance.stackable !== false,
    maxStackLayers: number(instance.maxStackLayers || 1),
    canInvert: instance.canInvert === true,
    canLayFlat: instance.canLayFlat === true,
    canRotate: instance.canRotate !== false,
    eta: instance.eta,
    portSequence: number(instance.portSequence || 1),
    sku: instance.sku,
    handlingMethod: handling(instance),
    handlingPolicy: instance.handlingPolicy || 'derived',
    heavy: instance.heavy === true || number(instance.weight) >= 20,
    wooden: instance.wooden === true || /wood|pallet|木/i.test(String(instance.packagingType || '')),
    packagingType: instance.packagingType,
    packagingMaterial: instance.packagingMaterial,
    transportUnit: instance.transportUnit,
    packagingProfile: instance.packagingProfile,
    cargoPhysicalProfile: instance.cargoPhysicalProfile,
    visualProfile: instance.visualProfile,
    orientationPolicy: instance.orientationPolicy,
    orientationConstraints: instance.orientationConstraints || null,
    orientation: dims.legacyLabel || dims.label,
    orientationId: dims.id || dims.label,
    canonicalOrientation: dims.id || dims.label,
    axisMap: dims.axisMap ? { ...dims.axisMap } : null,
    uprightOriginalAxis: dims.uprightOriginalAxis || null,
    maximumSupportedWeightKg: instance.maximumSupportedWeightKg,
    maxSupportedWeight: instance.maxSupportedWeight,
    forkEntry: instance.forkEntry,
    woodPackagingClass: instance.woodPackagingClass,
    dangerousGoodsContext: instance.dangerousGoodsContext,
    batchId: instance.batchId,
    batchLabel: instance.batchLabel,
    destinationPort: instance.destinationPort,
    dataClassification: instance.dataClassification,
    riskNotes: Array.isArray(instance.riskNotes) ? [...instance.riskNotes] : [],
    supportCargoIds: [],
    supportRatio: 1,
    supportMargin: Math.min(dims.l, dims.w) / 2,
    stackLevel: 1,
    algorithmMeta: {
      candidateSource: 'FLOOR_EXTREME_POINT_BEAM',
      orientation: dims.label,
      mixedSkuPolicy: 'SKU_NOT_A_SPATIAL_BARRIER',
      placementMode: 'floor-extreme-point'
    }
  };
}

const stateMetricCache = new WeakMap();
function stateMetrics(state, container) {
  const previous=stateMetricCache.get(state);
  if(previous?.container===container)return previous;
  const value={container,balance:achievableBalance(state.placements,container),envelope:envelope(state.placements),signature:stateSignature(state)};
  stateMetricCache.set(state,value);return value;
}

function compareStates(left, right, container) {
  if (left.placements.length !== right.placements.length) return right.placements.length - left.placements.length;
  const leftStats=stateMetrics(left,container),rightStats=stateMetrics(right,container);
  const leftBalance = leftStats.balance;
  const rightBalance = rightStats.balance;
  if (leftBalance.guidanceRank !== rightBalance.guidanceRank) return leftBalance.guidanceRank - rightBalance.guidanceRank;
  if (Math.abs(left.loadedVolume - right.loadedVolume) > EPSILON) return right.loadedVolume - left.loadedVolume;
  if (Math.abs(leftBalance.maximumOffsetPercent - rightBalance.maximumOffsetPercent) > EPSILON) {
    return leftBalance.maximumOffsetPercent - rightBalance.maximumOffsetPercent;
  }
  const leftEnvelope = leftStats.envelope; const rightEnvelope = rightStats.envelope;
  if (Math.abs(leftEnvelope.area - rightEnvelope.area) > EPSILON) return leftEnvelope.area - rightEnvelope.area;
  if (Math.abs(leftEnvelope.depth - rightEnvelope.depth) > EPSILON) return leftEnvelope.depth - rightEnvelope.depth;
  return leftStats.signature.localeCompare(rightStats.signature);
}

function deduplicate(states, container) {
  const unique = new Map();
  for (const state of states) {
    const key = state.placements.map((item) => `${item.cargoId}:${item.x}:${item.z}:${item.l}:${item.w}`).sort().join('|');
    const existing = unique.get(key);
    if (!existing || compareStates(state, existing, container) < 0) unique.set(key, state);
  }
  return [...unique.values()];
}

function achievableBalance(placements, container) {
  if (placements.length === 0) return { guidanceRank: 0, maximumOffsetPercent: 0 };
  const bounds = placements.reduce((result, item) => ({
    minX: Math.min(result.minX, number(item.x)),
    maxX: Math.max(result.maxX, number(item.x) + number(item.l)),
    minZ: Math.min(result.minZ, number(item.z)),
    maxZ: Math.max(result.maxZ, number(item.z) + number(item.w))
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const totalMass = placements.reduce((sum, item) => sum + number(item.weight), 0);
  const divisor = totalMass > 0 ? totalMass : placements.length;
  const weighted = totalMass > 0;
  const cogX = placements.reduce((sum, item) => sum + (number(item.x) + number(item.l) / 2) * (weighted ? number(item.weight) : 1), 0) / divisor;
  const cogZ = placements.reduce((sum, item) => sum + (number(item.z) + number(item.w) / 2) * (weighted ? number(item.weight) : 1), 0) / divisor;
  const shiftX = clamp(number(container.innerLength) / 2 - cogX, -bounds.minX, number(container.innerLength) - bounds.maxX);
  const shiftZ = clamp(number(container.innerWidth) / 2 - cogZ, -bounds.minZ, number(container.innerWidth) - bounds.maxZ);
  const longitudinal = number(container.innerLength) > 0
    ? Math.abs(cogX + shiftX - number(container.innerLength) / 2) / (number(container.innerLength) / 2) * 100 : 0;
  const lateral = number(container.innerWidth) > 0
    ? Math.abs(cogZ + shiftZ - number(container.innerWidth) / 2) / (number(container.innerWidth) / 2) * 100 : 0;
  const maximumOffsetPercent = Math.max(longitudinal, lateral);
  return { guidanceRank: maximumOffsetPercent <= 5 + EPSILON ? 0 : maximumOffsetPercent <= 10 + EPSILON ? 1 : 2, maximumOffsetPercent };
}

function envelope(placements) {
  if (placements.length === 0) return { depth: 0, width: 0, area: 0 };
  const depth = Math.max(...placements.map((item) => item.x + item.l)) - Math.min(...placements.map((item) => item.x));
  const width = Math.max(...placements.map((item) => item.z + item.w)) - Math.min(...placements.map((item) => item.z));
  return { depth, width, area: depth * width };
}

function stateSignature(state) {
  return state.placements.map((item) => `${item.cargoId}:${item.x}:${item.z}:${item.l}:${item.w}`).sort().join('|');
}

function intersectsFloor(left, right) {
  return left.x < right.x + right.l - EPSILON && left.x + left.l > right.x + EPSILON
    && left.z < right.z + right.w - EPSILON && left.z + left.w > right.z + EPSILON;
}

function wallDistance(z, width, containerWidth) { return Math.min(z, Math.max(0, containerWidth - (z + width))); }
function footprint(item) { return number(item.length) * number(item.width); }
function compareId(left, right) { return String(left.instanceId).localeCompare(String(right.instanceId)); }
function handling(item) { return item.handlingMethod || (number(item.weight) >= 20 ? 'forklift' : 'manual'); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

function colorFor(key) {
  const palette = ['#346FE8', '#08A6C7', '#ED8B32', '#D6544D', '#7658C9', '#238CC8', '#24A268', '#D5A42B'];
  let hash = 0;
  for (const character of String(key || '')) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

module.exports = FloorExtremePointCandidate;
