'use strict';

const { normalizeContainer } = require('./PlanMetrics');

const EPSILON = 0.001;

const DEFAULT_POLICY = Object.freeze({
  unsecuredGapThresholdMm: 150,
  contactGapToleranceMm: 30,
  meaningfulContactRatio: 0.35,
  maximumResolvedZones: 4
});

/**
 * Detects where blocking/bracing/dunnage is required. This is a deterministic
 * securing-requirement model, not a lashing-force or friction simulation.
 */
function analyzeSecuring({ placements = [], container: containerInput = {}, layoutQuality = {}, policy: policyInput = {} } = {}) {
  const container = normalizeContainer(containerInput);
  const policy = { ...DEFAULT_POLICY, ...policyInput };
  if (placements.length === 0) return emptyResult(policy);
  const bounds = layoutQuality.bounds || placementBounds(placements);
  const zones = boundaryZones(bounds, placements, container, policy);
  const exposed = analyzeExposedFaces(placements, container, policy);
  const internalVoid = number(layoutQuality.internalVoidVolume);
  const containerVolume = container.innerLength * container.innerWidth * container.innerHeight;
  const fragmented = number(layoutQuality.internalVoidRegionCount) > 3
    || (containerVolume > 0 && internalVoid / containerVolume > 0.03)
    || number(layoutQuality.maxInteriorGap) > policy.unsecuredGapThresholdMm * 2;
  const required = zones.length > 0 || exposed.requiredCargoIds.length > 0;
  const status = !required
    ? 'SECURING_NOT_REQUIRED'
    : fragmented || zones.length > policy.maximumResolvedZones
      ? 'SECURING_UNRESOLVED'
      : 'SECURING_REQUIRED';
  return {
    model: 'PORTCUBE_SECURING_REQUIREMENT_V2_3',
    dataClassification: 'PROJECT_POLICY',
    status,
    required,
    securingRequiredCount: exposed.requiredCargoIds.length,
    requiredCargoIds: exposed.requiredCargoIds,
    securingPlaneCount: zones.length,
    exposedCargoFaceArea: exposed.area,
    fragmentedSecuringZones: fragmented ? Math.max(zones.length, number(layoutQuality.internalVoidRegionCount)) : zones.length,
    zones,
    policy: {
      unsecuredGapThresholdMm: policy.unsecuredGapThresholdMm,
      contactGapToleranceMm: policy.contactGapToleranceMm,
      statement: 'PORTCUBE project guidance; actual securing depends on cargo and the selected blocking/bracing/dunnage method.'
    },
    limitations: ['no friction coefficient', 'no lashing tension', 'no ship-motion simulation', 'no material deformation']
  };
}

function boundaryZones(bounds, placements, container, policy) {
  if (!bounds) return [];
  const candidates = [
    { direction: 'rear', axis: 'x', position: bounds.minX, gap: bounds.minX, area: exposedPlaneArea(placements, 'rear') },
    { direction: 'door', axis: 'x', position: bounds.maxX, gap: container.innerLength - bounds.maxX, area: exposedPlaneArea(placements, 'front') },
    { direction: 'left', axis: 'z', position: bounds.minZ, gap: bounds.minZ, area: exposedPlaneArea(placements, 'left') },
    { direction: 'right', axis: 'z', position: bounds.maxZ, gap: container.innerWidth - bounds.maxZ, area: exposedPlaneArea(placements, 'right') }
  ];
  return candidates.filter((entry) => entry.gap > policy.unsecuredGapThresholdMm + EPSILON && entry.area > EPSILON).map((entry, index) => ({
    id: `SECURING-ZONE-${index + 1}`,
    type: 'BLOCKING_PLANE_REQUIRED',
    axis: entry.axis,
    direction: entry.direction,
    position: entry.position,
    reserveGap: entry.gap,
    exposedArea: entry.area,
    reason: `${entry.direction} 方向存在超过 ${policy.unsecuredGapThresholdMm} mm 的未约束边界空区`,
    classification: 'PROJECT_GUIDANCE'
  }));
}

function analyzeExposedFaces(placements, container, policy) {
  const required = new Set();
  let area = 0;
  for (const item of placements) {
    const faces = [
      { direction: 'rear', ownGap: number(item.x), faceArea: number(item.w) * number(item.h) },
      { direction: 'front', ownGap: container.innerLength - (number(item.x) + number(item.l)), faceArea: number(item.w) * number(item.h) },
      { direction: 'left', ownGap: number(item.z), faceArea: number(item.l) * number(item.h) },
      { direction: 'right', ownGap: container.innerWidth - (number(item.z) + number(item.w)), faceArea: number(item.l) * number(item.h) }
    ];
    for (const face of faces) {
      if (face.ownGap <= policy.contactGapToleranceMm + EPSILON) continue;
      const restraint = bestNeighborRestraint(item, placements, face.direction);
      if (restraint.gap <= policy.contactGapToleranceMm + EPSILON && restraint.ratio >= policy.meaningfulContactRatio) continue;
      if (restraint.gap <= policy.unsecuredGapThresholdMm + EPSILON) continue;
      required.add(item.cargoId);
      area += face.faceArea * Math.max(0, 1 - restraint.ratio);
    }
  }
  return { requiredCargoIds: [...required], area };
}

function bestNeighborRestraint(item, placements, direction) {
  let best = { gap: Infinity, ratio: 0 };
  for (const other of placements) {
    if (other === item) continue;
    const vertical = overlap(number(item.y), number(item.h), number(other.y), number(other.h));
    if (vertical <= EPSILON) continue;
    const xOverlap = overlap(number(item.x), number(item.l), number(other.x), number(other.l));
    const zOverlap = overlap(number(item.z), number(item.w), number(other.z), number(other.w));
    let gap = Infinity;
    let ratio = 0;
    if (direction === 'rear' && number(other.x) + number(other.l) <= number(item.x) + EPSILON) {
      gap = number(item.x) - (number(other.x) + number(other.l));
      ratio = zOverlap * vertical / Math.max(number(item.w) * number(item.h), 1);
    } else if (direction === 'front' && number(other.x) >= number(item.x) + number(item.l) - EPSILON) {
      gap = number(other.x) - (number(item.x) + number(item.l));
      ratio = zOverlap * vertical / Math.max(number(item.w) * number(item.h), 1);
    } else if (direction === 'left' && number(other.z) + number(other.w) <= number(item.z) + EPSILON) {
      gap = number(item.z) - (number(other.z) + number(other.w));
      ratio = xOverlap * vertical / Math.max(number(item.l) * number(item.h), 1);
    } else if (direction === 'right' && number(other.z) >= number(item.z) + number(item.w) - EPSILON) {
      gap = number(other.z) - (number(item.z) + number(item.w));
      ratio = xOverlap * vertical / Math.max(number(item.l) * number(item.h), 1);
    }
    if (gap < best.gap - EPSILON || (Math.abs(gap - best.gap) <= EPSILON && ratio > best.ratio)) best = { gap, ratio };
  }
  return best;
}

function exposedPlaneArea(placements, direction) {
  if (placements.length === 0) return 0;
  const coordinate = direction === 'rear' ? Math.min(...placements.map((item) => number(item.x)))
    : direction === 'front' ? Math.max(...placements.map((item) => number(item.x) + number(item.l)))
      : direction === 'left' ? Math.min(...placements.map((item) => number(item.z)))
        : Math.max(...placements.map((item) => number(item.z) + number(item.w)));
  return placements.filter((item) => direction === 'rear' ? Math.abs(number(item.x) - coordinate) <= EPSILON
    : direction === 'front' ? Math.abs(number(item.x) + number(item.l) - coordinate) <= EPSILON
      : direction === 'left' ? Math.abs(number(item.z) - coordinate) <= EPSILON
        : Math.abs(number(item.z) + number(item.w) - coordinate) <= EPSILON)
    .reduce((sum, item) => sum + (direction === 'rear' || direction === 'front' ? number(item.w) : number(item.l)) * number(item.h), 0);
}

function placementBounds(placements) {
  return placements.reduce((result, item) => ({
    minX: Math.min(result.minX, number(item.x)), minZ: Math.min(result.minZ, number(item.z)),
    maxX: Math.max(result.maxX, number(item.x) + number(item.l)), maxZ: Math.max(result.maxZ, number(item.z) + number(item.w))
  }), { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity });
}

function emptyResult(policy) {
  return { model: 'PORTCUBE_SECURING_REQUIREMENT_V2_3', dataClassification: 'PROJECT_POLICY', status: 'SECURING_NOT_REQUIRED', required: false, securingRequiredCount: 0, requiredCargoIds: [], securingPlaneCount: 0, exposedCargoFaceArea: 0, fragmentedSecuringZones: 0, zones: [], policy };
}

function overlap(startA, sizeA, startB, sizeB) {
  return Math.max(0, Math.min(startA + sizeA, startB + sizeB) - Math.max(startA, startB));
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = { analyzeSecuring, DEFAULT_POLICY };
