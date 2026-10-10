'use strict';

const { legalOrientations } = require('./PlanValidator');
const { normalizeContainer, clamp } = require('./PlanMetrics');

const EPSILON = 0.001;

const DEFAULT_POLICY = Object.freeze({
  lowFillThreshold: 0.65,
  crossSectionSliceMm: 100,
  minimumGridCellMm: 50,
  maximumGridCellMm: 150,
  interiorGapThresholdMm: 150,
  contactGapToleranceMm: 30,
  meaningfulContactRatio: 0.35,
  // Fill changes below three percentage points are treated as normal packing
  // texture, not a distinct fragmented cavity. Raw per-slice fill remains in
  // the report, so the tolerance cannot hide a low-fill band.
  fragmentationValleyThreshold: 0.03
});

/**
 * Deterministic layout-quality analysis for PORTCUBE Competition 2.3.
 *
 * The model intentionally describes geometry, connectivity and project-policy
 * guidance. It does not claim friction, lashing force or dynamic ship motion.
 */
function analyzeLayoutQuality({ placements = [], container: containerInput = {}, cargoList = [], policy: policyInput = {} } = {}) {
  const container = normalizeContainer(containerInput);
  const policy = { ...DEFAULT_POLICY, ...policyInput };
  const containerVolume = container.innerLength * container.innerWidth * container.innerHeight;
  const bounds = placementBounds(placements);
  const occupiedDepth = bounds ? bounds.maxX - bounds.minX : 0;
  const crossSection = analyzeCrossSections(placements, container, policy);
  const topology = analyzeOccupancyTopology(placements, cargoList, container, bounds, policy);
  const gaps = analyzeInteriorGaps(placements, policy);
  const contacts = analyzeContacts(placements, container, policy);
  const internalVoidVolume = Math.max(topology.internalVoidVolume, crossSection.fragmentedVoidVolume);
  const internalVoidRegionCount = Math.max(topology.internalVoidRegionCount, crossSection.fragmentedVoidRegionCount);
  const largestContiguousReserve = Math.max(0, topology.largestContiguousReserve - internalVoidVolume);

  return {
    model: 'PORTCUBE_LAYOUT_QUALITY_V2_3',
    dataClassification: 'PROJECT_POLICY',
    policy: {
      lowFillThreshold: policy.lowFillThreshold,
      crossSectionSliceMm: crossSection.sliceWidth,
      occupancyGridCellMm: topology.gridCellMm,
      interiorGapThresholdMm: policy.interiorGapThresholdMm,
      contactGapToleranceMm: policy.contactGapToleranceMm,
      fragmentationValleyThreshold: policy.fragmentationValleyThreshold
    },
    occupiedDepth,
    occupiedLengthRatio: safeDivide(occupiedDepth, container.innerLength),
    occupiedDepthRatio: safeDivide(occupiedDepth, container.innerLength),
    crossSectionFillMean: crossSection.mean,
    crossSectionFillP10: crossSection.p10,
    crossSectionFillMinimumInterior: crossSection.minimumInterior,
    lowFillInteriorSliceCount: crossSection.lowFillInteriorSliceCount,
    crossSectionSmoothness: crossSection.smoothness,
    crossSectionReport: crossSection.report,
    internalVoidVolume,
    internalVoidRatio: safeDivide(internalVoidVolume, containerVolume),
    narrowVoidVolume: topology.narrowVoidVolume,
    enclosedVoidVolume: topology.enclosedVoidVolume,
    residualRegionCount: topology.residualRegionCount,
    reserveRegionCount: topology.reserveRegionCount,
    internalVoidRegionCount,
    largestContiguousReserve,
    reserveVolume: Math.max(0, topology.reserveVolume - internalVoidVolume),
    voidRegions: topology.regions,
    interiorGapVolume: gaps.volume,
    meanInteriorGap: gaps.mean,
    maxInteriorGap: gaps.maximum,
    meanInteriorHorizontalGap: gaps.mean,
    maxInteriorHorizontalGap: gaps.maximum,
    gapClassifications: gaps.classifications,
    contactRatioMean: contacts.cargoContactRatioMean,
    cargoContactRatioMean: contacts.cargoContactRatioMean,
    wallContactRatio: contacts.wallContactRatio,
    bounds,
    analysisNotes: [
      'Internal void is free grid volume below the local cargo envelope and inside the occupied length/lateral span.',
      'Reserve excludes cells classified as internal fragmented void.',
      'All thresholds are PORTCUBE project policy, not statutory limits.'
    ]
  };
}

function analyzeCrossSections(placements, container, policy) {
  if (!(container.innerLength > 0 && container.innerWidth > 0 && container.innerHeight > 0)) return emptyCrossSection(policy.crossSectionSliceMm);
  const sliceWidth = Math.max(50, number(policy.crossSectionSliceMm));
  const count = Math.max(1, Math.ceil(container.innerLength / sliceWidth));
  const usableArea = container.innerWidth * container.innerHeight;
  // Split the regular sampling grid at every physical X face. Integrating a
  // midpoint across a face previously charged up to half a grid cell to the
  // wrong cross section (including narrow cavities invisible to the grid).
  const cuts = [...new Set([0, container.innerLength,
    ...Array.from({ length: count }, (_, i) => Math.min(container.innerLength, i * sliceWidth)),
    ...placements.flatMap(p => [clamp(number(p.x), 0, container.innerLength), clamp(number(p.x) + number(p.l), 0, container.innerLength)])
  ])].sort((a,b) => a-b);
  const report = cuts.slice(0,-1).map((x0, index) => {
    const x1 = cuts[index+1];
    const sample = (x0 + x1) / 2;
    const rectangles = placements
      .filter((item) => sample >= number(item.x) - EPSILON && sample < number(item.x) + number(item.l) - EPSILON)
      .map((item) => ({
        a0: clamp(number(item.z), 0, container.innerWidth),
        a1: clamp(number(item.z) + number(item.w), 0, container.innerWidth),
        b0: clamp(number(item.y), 0, container.innerHeight),
        b1: clamp(number(item.y) + number(item.h), 0, container.innerHeight)
      }));
    const occupiedArea = unionRectangleArea(rectangles);
    return {
      sliceIndex: index,
      slicePosition: sample,
      sliceStart: x0,
      sliceEnd: x1,
      fillRatio: usableArea > 0 ? clamp(occupiedArea / usableArea, 0, 1) : 0,
      occupiedArea,
      internalVoid: 0
    };
  });
  const occupied = report.filter((entry) => entry.occupiedArea > EPSILON);
  if (occupied.length === 0) return { ...emptyCrossSection(sliceWidth), report };
  const first = occupied[0].sliceIndex;
  const last = occupied[occupied.length - 1].sliceIndex;
  const interior = report.slice(first, last + 1);
  for (const entry of interior) entry.internalVoid = Math.max(0, usableArea - entry.occupiedArea) * (entry.sliceEnd - entry.sliceStart);
  const sortedSlices = [...interior].sort((a,b) => a.fillRatio-b.fillRatio);
  const occupiedSpan = interior.reduce((sum,e) => sum+e.sliceEnd-e.sliceStart,0);
  let quantileSpan = 0;
  const p10 = sortedSlices.find(e => { quantileSpan += e.sliceEnd-e.sliceStart; return quantileSpan >= occupiedSpan * 0.1; })?.fillRatio || 0;
  const prefixMaximum = [];
  const suffixMaximum = [];
  interior.forEach((entry, index) => { prefixMaximum[index] = Math.max(index > 0 ? prefixMaximum[index - 1] : 0, entry.fillRatio); });
  for (let index = interior.length - 1; index >= 0; index--) suffixMaximum[index] = Math.max(index < interior.length - 1 ? suffixMaximum[index + 1] : 0, interior[index].fillRatio);
  const fragmented = interior.map((entry, index) => {
    const envelope = Math.min(prefixMaximum[index], suffixMaximum[index]);
    const rawRatio = Math.max(0, envelope - entry.fillRatio);
    const ratio = rawRatio + EPSILON >= policy.fragmentationValleyThreshold ? rawRatio : 0;
    entry.fragmentationDelta = rawRatio;
    entry.internalVoid = ratio * usableArea * (entry.sliceEnd - entry.sliceStart);
    return ratio > EPSILON;
  });
  let fragmentedVoidRegionCount = 0;
  for (let index = 0; index < fragmented.length; index++) if (fragmented[index] && !fragmented[index - 1]) fragmentedVoidRegionCount++;
  let variation = 0;
  for (let index = 0; index < interior.length - 1; index++) variation += Math.abs(interior[index].fillRatio - interior[index + 1].fillRatio);
  const normalizedVariation = interior.length > 1 ? variation / (interior.length - 1) : 0;
  return {
    sliceWidth,
    report,
    occupiedSliceRange: [first, last],
    mean: safeDivide(interior.reduce((sum,e) => sum+e.fillRatio*(e.sliceEnd-e.sliceStart),0),occupiedSpan),
    p10,
    minimumInterior: sortedSlices[0]?.fillRatio || 0,
    lowFillInteriorSliceCount: interior.filter((entry) => entry.fillRatio < policy.lowFillThreshold).length,
    smoothness: clamp(1 - normalizedVariation, 0, 1),
    fragmentedVoidVolume: interior.reduce((sum, entry) => sum + entry.internalVoid, 0),
    fragmentedVoidRegionCount
  };
}

function emptyCrossSection(sliceWidth) {
  return {
    sliceWidth,
    report: [],
    occupiedSliceRange: null,
    mean: 0,
    p10: 0,
    minimumInterior: 0,
    lowFillInteriorSliceCount: 0,
    smoothness: 1,
    fragmentedVoidVolume: 0,
    fragmentedVoidRegionCount: 0
  };
}

function analyzeOccupancyTopology(placements, cargoList, container, bounds, policy) {
  const dimensions = relevantDimensions(cargoList, placements);
  const minimumDimension = dimensions.length > 0 ? Math.min(...dimensions) : policy.maximumGridCellMm * 4;
  const cell = clamp(minimumDimension / 4, policy.minimumGridCellMm, policy.maximumGridCellMm);
  if (!(container.innerLength > 0 && container.innerWidth > 0 && container.innerHeight > 0)) return emptyTopology(cell);
  const nx = Math.max(1, Math.ceil(container.innerLength / cell));
  const ny = Math.max(1, Math.ceil(container.innerHeight / cell));
  const nz = Math.max(1, Math.ceil(container.innerWidth / cell));
  const total = nx * ny * nz;
  const occupied = new Uint8Array(total);
  const internal = new Uint8Array(total);
  const indexOf = (x, y, z) => (x * ny + y) * nz + z;
  const cellCenter = (index, limit) => Math.min(limit - EPSILON, index * cell + Math.min(cell / 2, Math.max(EPSILON, limit - index * cell) / 2));

  for (const item of placements) {
    const x0 = clamp(Math.floor(number(item.x) / cell), 0, nx - 1);
    const x1 = clamp(Math.ceil((number(item.x) + number(item.l)) / cell) - 1, 0, nx - 1);
    const y0 = clamp(Math.floor(number(item.y) / cell), 0, ny - 1);
    const y1 = clamp(Math.ceil((number(item.y) + number(item.h)) / cell) - 1, 0, ny - 1);
    const z0 = clamp(Math.floor(number(item.z) / cell), 0, nz - 1);
    const z1 = clamp(Math.ceil((number(item.z) + number(item.w)) / cell) - 1, 0, nz - 1);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const cx = cellCenter(x, container.innerLength);
      const cy = cellCenter(y, container.innerHeight);
      const cz = cellCenter(z, container.innerWidth);
      if (cx >= number(item.x) - EPSILON && cx < number(item.x) + number(item.l) - EPSILON
        && cy >= number(item.y) - EPSILON && cy < number(item.y) + number(item.h) - EPSILON
        && cz >= number(item.z) - EPSILON && cz < number(item.z) + number(item.w) - EPSILON) occupied[indexOf(x, y, z)] = 1;
    }
  }

  const sliceProfile = buildSliceEnvelope(occupied, nx, ny, nz, indexOf);
  if (bounds) {
    const firstX = clamp(Math.floor(bounds.minX / cell), 0, nx - 1);
    const lastX = clamp(Math.ceil(bounds.maxX / cell) - 1, 0, nx - 1);
    fillLongitudinalEnvelopeGaps(sliceProfile, firstX, lastX);
    for (let x = firstX; x <= lastX; x++) {
      const profile = sliceProfile[x];
      if (profile.maxY < 0 || profile.minZ > profile.maxZ) continue;
      for (let z = profile.minZ; z <= profile.maxZ; z++) {
        for (let y = 0; y <= profile.maxY; y++) {
          const index = indexOf(x, y, z);
          if (!occupied[index]) internal[index] = 1;
        }
      }
    }
  }

  const internalComponents = collectComponents(internal, (index) => internal[index] === 1, nx, ny, nz, indexOf, cell, container);
  const reserveMask = new Uint8Array(total);
  for (let index = 0; index < total; index++) if (!occupied[index] && !internal[index]) reserveMask[index] = 1;
  const reserveComponents = collectComponents(reserveMask, (index) => reserveMask[index] === 1, nx, ny, nz, indexOf, cell, container);
  const allFreeMask = new Uint8Array(total);
  for (let index = 0; index < total; index++) if (!occupied[index]) allFreeMask[index] = 1;
  const freeComponents = collectComponents(allFreeMask, (index) => allFreeMask[index] === 1, nx, ny, nz, indexOf, cell, container);
  const orientationDimensions = legalDimensionTriples(cargoList, placements);
  for (const region of internalComponents) region.canFitCargo = canFitAnyOrientation(region, orientationDimensions);
  for (const region of reserveComponents) region.canFitCargo = canFitAnyOrientation(region, orientationDimensions);
  const narrowVoidVolume = internalComponents
    .filter((region) => !canFitAnyOrientation(region, orientationDimensions))
    .reduce((sum, region) => sum + region.volume, 0);
  const enclosedVoidVolume = freeComponents
    .filter((region) => !region.touchesDoor && !region.touchesTop)
    .reduce((sum, region) => sum + region.internalVolume, 0);
  return {
    gridCellMm: cell,
    internalVoidVolume: internalComponents.reduce((sum, region) => sum + region.volume, 0),
    narrowVoidVolume,
    enclosedVoidVolume,
    internalVoidRegionCount: internalComponents.length,
    reserveVolume: reserveComponents.reduce((sum, region) => sum + region.volume, 0),
    largestContiguousReserve: reserveComponents.reduce((max, region) => Math.max(max, region.volume), 0),
    reserveRegionCount: reserveComponents.length,
    residualRegionCount: freeComponents.length,
    regions: {
      internal: internalComponents.map(compactRegion),
      reserve: reserveComponents.map(compactRegion)
    }
  };
}

function buildSliceEnvelope(occupied, nx, ny, nz, indexOf) {
  return Array.from({ length: nx }, (_, x) => {
    let minZ = nz;
    let maxZ = -1;
    let maxY = -1;
    for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
      if (!occupied[indexOf(x, y, z)]) continue;
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      maxY = Math.max(maxY, y);
    }
    return { minZ, maxZ, maxY };
  });
}

function fillLongitudinalEnvelopeGaps(profile, first, last) {
  let previous = null;
  const previousOccupied = Array(profile.length).fill(null);
  for (let x = first; x <= last; x++) {
    if (profile[x].maxY >= 0) previous = profile[x];
    previousOccupied[x] = previous;
  }
  const nextOccupied = Array(profile.length).fill(null);
  let next = null;
  for (let x = last; x >= first; x--) {
    if (profile[x].maxY >= 0) next = profile[x];
    nextOccupied[x] = next;
  }
  for (let x = first; x <= last; x++) {
    const left = previousOccupied[x];
    const right = nextOccupied[x];
    if (!left || !right) continue;
    const bridge = {
      minZ: Math.max(left.minZ, right.minZ),
      maxZ: Math.min(left.maxZ, right.maxZ),
      maxY: Math.min(left.maxY, right.maxY)
    };
    if (bridge.minZ > bridge.maxZ || bridge.maxY < 0) continue;
    if (profile[x].maxY < 0) profile[x] = bridge;
    else if (bridge.maxY > profile[x].maxY) {
      profile[x] = {
        minZ: Math.max(profile[x].minZ, bridge.minZ),
        maxZ: Math.min(profile[x].maxZ, bridge.maxZ),
        maxY: bridge.maxY
      };
    }
  }
}

function collectComponents(mask, isAvailable, nx, ny, nz, indexOf, cell, container) {
  const visited = new Uint8Array(mask.length);
  const directions = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const result = [];
  for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
    const start = indexOf(x, y, z);
    if (visited[start] || !isAvailable(start)) continue;
    const queue = [[x, y, z]];
    visited[start] = 1;
    let cursor = 0;
    let regionVolume = 0;
    let internalVolume = 0;
    const bounds = { minX: x, maxX: x, minY: y, maxY: y, minZ: z, maxZ: z };
    let touchesDoor = false;
    let touchesTop = false;
    while (cursor < queue.length) {
      const [cx, cy, cz] = queue[cursor++];
      const current = indexOf(cx, cy, cz);
      const currentVolume = gridCellVolume(cx, cy, cz, cell, container);
      regionVolume += currentVolume;
      if (mask !== undefined && mask[current] === 1) internalVolume += currentVolume;
      bounds.minX = Math.min(bounds.minX, cx); bounds.maxX = Math.max(bounds.maxX, cx);
      bounds.minY = Math.min(bounds.minY, cy); bounds.maxY = Math.max(bounds.maxY, cy);
      bounds.minZ = Math.min(bounds.minZ, cz); bounds.maxZ = Math.max(bounds.maxZ, cz);
      if (cx === nx - 1) touchesDoor = true;
      if (cy === ny - 1) touchesTop = true;
      for (const [dx, dy, dz] of directions) {
        const tx = cx + dx; const ty = cy + dy; const tz = cz + dz;
        if (tx < 0 || tx >= nx || ty < 0 || ty >= ny || tz < 0 || tz >= nz) continue;
        const target = indexOf(tx, ty, tz);
        if (visited[target] || !isAvailable(target)) continue;
        visited[target] = 1;
        queue.push([tx, ty, tz]);
      }
    }
    result.push({
      volume: regionVolume,
      internalVolume,
      touchesDoor,
      touchesTop,
      dimensions: {
        l: Math.min(container.innerLength, (bounds.maxX + 1) * cell) - bounds.minX * cell,
        h: Math.min(container.innerHeight, (bounds.maxY + 1) * cell) - bounds.minY * cell,
        w: Math.min(container.innerWidth, (bounds.maxZ + 1) * cell) - bounds.minZ * cell
      },
      boundsMm: {
        minX: bounds.minX * cell,
        maxX: Math.min(container.innerLength, (bounds.maxX + 1) * cell),
        minY: bounds.minY * cell,
        maxY: Math.min(container.innerHeight, (bounds.maxY + 1) * cell),
        minZ: bounds.minZ * cell,
        maxZ: Math.min(container.innerWidth, (bounds.maxZ + 1) * cell)
      },
      bounds
    });
  }
  return result;
}

function analyzeInteriorGaps(placements, policy) {
  const entries = [];
  for (let left = 0; left < placements.length; left++) for (let right = left + 1; right < placements.length; right++) {
    const a = placements[left];
    const b = placements[right];
    const yOverlap = overlap(number(a.y), number(a.h), number(b.y), number(b.h));
    if (yOverlap <= EPSILON) continue;
    const zOverlap = overlap(number(a.z), number(a.w), number(b.z), number(b.w));
    const xOverlap = overlap(number(a.x), number(a.l), number(b.x), number(b.l));
    const xGap = intervalGap(number(a.x), number(a.l), number(b.x), number(b.l));
    const zGap = intervalGap(number(a.z), number(a.w), number(b.z), number(b.w));
    if (xGap > policy.interiorGapThresholdMm && zOverlap > EPSILON) entries.push({ axis: 'x', gap: xGap, area: yOverlap * zOverlap, volume: xGap * yOverlap * zOverlap, cargoIds: [a.cargoId, b.cargoId] });
    if (zGap > policy.interiorGapThresholdMm && xOverlap > EPSILON) entries.push({ axis: 'z', gap: zGap, area: yOverlap * xOverlap, volume: zGap * yOverlap * xOverlap, cargoIds: [a.cargoId, b.cargoId] });
  }
  const nearestByFace = nearestGapEntries(entries);
  return {
    volume: nearestByFace.reduce((sum, entry) => sum + entry.volume, 0),
    mean: average(nearestByFace.map((entry) => entry.gap)),
    maximum: nearestByFace.reduce((max, entry) => Math.max(max, entry.gap), 0),
    classifications: nearestByFace.slice(0, 50).map((entry) => ({ ...entry, classification: 'INTERIOR_GAP', policy: 'PROJECT_POLICY' }))
  };
}

function nearestGapEntries(entries) {
  const nearest = new Map();
  for (const entry of entries) {
    for (const cargoId of entry.cargoIds) {
      const key = `${cargoId}:${entry.axis}`;
      const current = nearest.get(key);
      if (!current || entry.gap < current.gap - EPSILON || (Math.abs(entry.gap - current.gap) <= EPSILON && entry.volume > current.volume)) nearest.set(key, entry);
    }
  }
  return [...new Map([...nearest.values()].map((entry) => [`${entry.axis}:${[...entry.cargoIds].sort().join(':')}`, entry])).values()];
}

function analyzeContacts(placements, container, policy) {
  if (placements.length === 0) return { cargoContactRatioMean: 0, wallContactRatio: 0 };
  let cargoRatio = 0;
  let wallFaces = 0;
  for (const item of placements) {
    const ratios = { rear: 0, front: 0, left: 0, right: 0 };
    if (number(item.x) <= policy.contactGapToleranceMm) wallFaces++;
    if (container.innerLength - (number(item.x) + number(item.l)) <= policy.contactGapToleranceMm) wallFaces++;
    if (number(item.z) <= policy.contactGapToleranceMm) wallFaces++;
    if (container.innerWidth - (number(item.z) + number(item.w)) <= policy.contactGapToleranceMm) wallFaces++;
    for (const other of placements) {
      if (other === item) continue;
      const vertical = overlap(number(item.y), number(item.h), number(other.y), number(other.h));
      if (vertical <= EPSILON) continue;
      const zOverlap = overlap(number(item.z), number(item.w), number(other.z), number(other.w));
      const xOverlap = overlap(number(item.x), number(item.l), number(other.x), number(other.l));
      const rearGap = number(item.x) - (number(other.x) + number(other.l));
      const frontGap = number(other.x) - (number(item.x) + number(item.l));
      const leftGap = number(item.z) - (number(other.z) + number(other.w));
      const rightGap = number(other.z) - (number(item.z) + number(item.w));
      if (rearGap >= -EPSILON && rearGap <= policy.contactGapToleranceMm) ratios.rear = Math.max(ratios.rear, zOverlap * vertical / Math.max(number(item.w) * number(item.h), 1));
      if (frontGap >= -EPSILON && frontGap <= policy.contactGapToleranceMm) ratios.front = Math.max(ratios.front, zOverlap * vertical / Math.max(number(item.w) * number(item.h), 1));
      if (leftGap >= -EPSILON && leftGap <= policy.contactGapToleranceMm) ratios.left = Math.max(ratios.left, xOverlap * vertical / Math.max(number(item.l) * number(item.h), 1));
      if (rightGap >= -EPSILON && rightGap <= policy.contactGapToleranceMm) ratios.right = Math.max(ratios.right, xOverlap * vertical / Math.max(number(item.l) * number(item.h), 1));
    }
    cargoRatio += average(Object.values(ratios));
  }
  return { cargoContactRatioMean: cargoRatio / placements.length, wallContactRatio: wallFaces / (placements.length * 4) };
}

function placementBounds(placements) {
  if (placements.length === 0) return null;
  return placements.reduce((result, item) => ({
    minX: Math.min(result.minX, number(item.x)),
    minY: Math.min(result.minY, number(item.y)),
    minZ: Math.min(result.minZ, number(item.z)),
    maxX: Math.max(result.maxX, number(item.x) + number(item.l)),
    maxY: Math.max(result.maxY, number(item.y) + number(item.h)),
    maxZ: Math.max(result.maxZ, number(item.z) + number(item.w))
  }), { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity });
}

function unionRectangleArea(rectangles) {
  if (rectangles.length === 0) return 0;
  const axes = [...new Set(rectangles.flatMap((entry) => [entry.a0, entry.a1]))].sort((a, b) => a - b);
  let result = 0;
  for (let index = 0; index < axes.length - 1; index++) {
    const a0 = axes[index]; const a1 = axes[index + 1];
    if (a1 <= a0) continue;
    const intervals = rectangles.filter((entry) => entry.a0 < a1 - EPSILON && entry.a1 > a0 + EPSILON)
      .map((entry) => [entry.b0, entry.b1]).sort((left, right) => left[0] - right[0]);
    let covered = 0; let start = null; let end = null;
    for (const [b0, b1] of intervals) {
      if (start === null) { start = b0; end = b1; }
      else if (b0 <= end + EPSILON) end = Math.max(end, b1);
      else { covered += end - start; start = b0; end = b1; }
    }
    if (start !== null) covered += end - start;
    result += (a1 - a0) * covered;
  }
  return result;
}

function relevantDimensions(cargoList, placements) {
  const values = [];
  for (const item of cargoList.length > 0 ? cargoList : placements) {
    for (const key of cargoList.length > 0 ? ['length', 'width', 'height'] : ['l', 'w', 'h']) {
      const value = number(item[key]);
      if (value > 0) values.push(value);
    }
  }
  return values;
}

function legalDimensionTriples(cargoList, placements) {
  if (cargoList.length > 0) return cargoList.flatMap((cargo) => legalOrientations(cargo));
  return placements.map((item) => ({ l: number(item.l), w: number(item.w), h: number(item.h) }));
}

function canFitAnyOrientation(region, orientations) {
  return orientations.some((dims) => number(dims.l) <= region.dimensions.l + EPSILON
    && number(dims.w) <= region.dimensions.w + EPSILON
    && number(dims.h) <= region.dimensions.h + EPSILON);
}

function compactRegion(region) {
  return {
    volume: region.volume,
    dimensions: region.dimensions,
    boundsMm: region.boundsMm,
    canFitCargo: region.canFitCargo === true,
    touchesDoor: region.touchesDoor,
    touchesTop: region.touchesTop
  };
}

function emptyTopology(cell) {
  return { gridCellMm: cell, internalVoidVolume: 0, narrowVoidVolume: 0, enclosedVoidVolume: 0, internalVoidRegionCount: 0, reserveVolume: 0, largestContiguousReserve: 0, reserveRegionCount: 0, residualRegionCount: 0, regions: { internal: [], reserve: [] } };
}

function gridCellVolume(x, y, z, cell, container) {
  return Math.max(0, Math.min(cell, container.innerLength - x * cell))
    * Math.max(0, Math.min(cell, container.innerHeight - y * cell))
    * Math.max(0, Math.min(cell, container.innerWidth - z * cell));
}

function intervalGap(startA, sizeA, startB, sizeB) {
  if (startA <= startB) return Math.max(0, startB - (startA + sizeA));
  return Math.max(0, startA - (startB + sizeB));
}

function overlap(startA, sizeA, startB, sizeB) {
  return Math.max(0, Math.min(startA + sizeA, startB + sizeB) - Math.max(startA, startB));
}

function average(values) {
  return values.length > 0 ? values.reduce((sum, value) => sum + number(value), 0) / values.length : 0;
}

function safeDivide(left, right) {
  return right > 0 ? left / right : 0;
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = { analyzeLayoutQuality, analyzeCrossSections, DEFAULT_POLICY };
