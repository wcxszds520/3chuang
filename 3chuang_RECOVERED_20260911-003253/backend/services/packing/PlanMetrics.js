'use strict';

const EPSILON = 0.001;

function normalizeContainer(container = {}) {
  return {
    ...(container.doorWidth != null || container.doorWidthMm != null ? { doorWidth:Number(container.doorWidth ?? container.doorWidthMm) } : {}),
    ...(container.doorHeight != null || container.doorHeightMm != null ? { doorHeight:Number(container.doorHeight ?? container.doorHeightMm) } : {}),
    typeId: container.typeId || container.id || 'container',
    innerLength: number(container.innerLength || container.length),
    innerWidth: number(container.innerWidth || container.width),
    innerHeight: number(container.innerHeight || container.height),
    maxWeight: number(container.maxWeight)
  };
}

function calculatePlanMetrics(placements = [], containerInput = {}, unloadedCount = 0, solveMs = 0) {
  const container = normalizeContainer(containerInput);
  const containerVolume = container.innerLength * container.innerWidth * container.innerHeight;
  const loadedVolume = placements.reduce((sum, item) => sum + volume(item), 0);
  const loadedWeight = placements.reduce((sum, item) => sum + number(item.weight), 0);
  const cog = calculateCoG(placements, container, loadedWeight);
  const residual = partitionResidualSpaces(placements, container);

  const bounds = placements.length === 0 ? null : placements.reduce((acc, item) => ({
    minX: Math.min(acc.minX, number(item.x)),
    minY: Math.min(acc.minY, number(item.y)),
    minZ: Math.min(acc.minZ, number(item.z)),
    maxX: Math.max(acc.maxX, number(item.x) + number(item.l)),
    maxY: Math.max(acc.maxY, number(item.y) + number(item.h)),
    maxZ: Math.max(acc.maxZ, number(item.z) + number(item.w))
  }), { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity });
  const boundingVolume = bounds
    ? (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) * (bounds.maxZ - bounds.minZ)
    : 0;
  const minCargoVolume = placements.length > 0 ? Math.min(...placements.map(volume)) : 0;
  const meaningfulThreshold = Math.max(minCargoVolume * 0.25, containerVolume * 0.00025);
  const meaningfulResidual = residual.filter((space) => volume(space) >= meaningfulThreshold);

  const ordered = [...placements].sort((a, b) => number(a.loadingIndex) - number(b.loadingIndex) || number(a.x) - number(b.x));
  let handlingSwitchCount = 0;
  for (let index = 1; index < ordered.length; index++) {
    if (handling(ordered[index - 1]) !== handling(ordered[index])) handlingSwitchCount++;
  }
  const portFragmentation = countPortGroups([...placements].sort((a, b) => number(a.x) - number(b.x)));
  const insertionTravel = placements.reduce((sum, item) => {
    const distance = Math.max(0, container.innerLength - (number(item.x) + number(item.l) / 2));
    return sum + safeDivide(distance, container.innerLength);
  }, 0);
  const normalizedInsertionTravel = placements.length > 0 ? insertionTravel / placements.length : 0;
  const difficulty = placements.reduce((sum, item) => {
    const weightCost = clamp(number(item.weight) / 100, 0, 1);
    const sizeCost = clamp(volume(item) / Math.max(containerVolume * 0.02, 1), 0, 1);
    return sum + (handling(item) === 'forklift' ? 0.35 : 0.08) + weightCost * 0.4 + sizeCost * 0.25;
  }, 0);
  const normalizedSwitches = ordered.length > 1 ? handlingSwitchCount / (ordered.length - 1) : 0;
  const normalizedFragmentation = placements.length > 0 ? Math.max(0, portFragmentation.groupCount - portFragmentation.portCount) / placements.length : 0;
  const normalizedDifficulty = placements.length > 0 ? difficulty / placements.length : 0;
  const operationTotalCost = 100 * clamp(
    normalizedSwitches * 0.3 + normalizedFragmentation * 0.25 + normalizedInsertionTravel * 0.3 + normalizedDifficulty * 0.15,
    0,
    1
  );

  return {
    loadedCount: placements.length,
    unloadedCount: number(unloadedCount),
    loadedWeight,
    loadedVolume,
    volumeUtilization: containerVolume > 0 ? loadedVolume / containerVolume * 100 : 0,
    solveMs: number(solveMs),
    cog: {
      x: cog.x,
      y: cog.y,
      z: cog.z,
      lateral: cog.lateral,
      longitudinal: cog.longitudinal
    },
    compactness: {
      boundingCompactness: boundingVolume > 0 ? loadedVolume / boundingVolume : 0,
      occupiedDepth: bounds ? bounds.maxX - bounds.minX : 0,
      residualRegionCount: meaningfulResidual.length,
      largestResidualVolume: meaningfulResidual.reduce((max, space) => Math.max(max, volume(space)), 0),
      residualPartitionMethod: 'axis-aligned-disjoint-split'
    },
    operation: {
      handlingSwitchCount,
      portFragmentation: portFragmentation.groupCount,
      insertionTravel: normalizedInsertionTravel,
      handlingDifficulty: normalizedDifficulty,
      totalCost: operationTotalCost
    }
  };
}

function calculateCoG(placements, container, loadedWeight = null) {
  const weight = loadedWeight === null
    ? placements.reduce((sum, item) => sum + number(item.weight), 0)
    : loadedWeight;
  if (!(weight > 0)) return { x: 0, y: 0, z: 0, lateral: 0, longitudinal: 0 };
  const moments = placements.reduce((acc, item) => {
    const itemWeight = number(item.weight);
    acc.x += (number(item.x) + number(item.l) / 2) * itemWeight;
    acc.y += (number(item.y) + number(item.h) / 2) * itemWeight;
    acc.z += (number(item.z) + number(item.w) / 2) * itemWeight;
    return acc;
  }, { x: 0, y: 0, z: 0 });
  const x = moments.x / weight;
  const y = moments.y / weight;
  const z = moments.z / weight;
  return {
    x,
    y,
    z,
    percentageDefinition: 'ABS_DISTANCE_FROM_MIDPOINT_DIVIDED_BY_FULL_INNER_SPAN',
    longitudinalDistanceMm: x - container.innerLength / 2,
    transverseDistanceMm: z - container.innerWidth / 2,
    lateral: container.innerWidth > 0 ? Math.abs(z - container.innerWidth / 2) / container.innerWidth * 100 : 0,
    longitudinal: container.innerLength > 0 ? Math.abs(x - container.innerLength / 2) / container.innerLength * 100 : 0
  };
}

function partitionResidualSpaces(placements = [], containerInput = {}) {
  const container = normalizeContainer(containerInput);
  if (!(container.innerLength > 0 && container.innerWidth > 0 && container.innerHeight > 0)) return [];
  let spaces = [{ x: 0, y: 0, z: 0, l: container.innerLength, h: container.innerHeight, w: container.innerWidth }];
  for (const placement of placements) {
    const next = [];
    for (const space of spaces) {
      if (!intersects(space, placement)) {
        next.push(space);
        continue;
      }
      next.push(...splitSpace(space, placement));
    }
    spaces = next.filter(validSpace);
  }
  return spaces;
}

function splitSpace(space, box) {
  const sx0 = number(space.x);
  const sy0 = number(space.y);
  const sz0 = number(space.z);
  const sx1 = sx0 + number(space.l);
  const sy1 = sy0 + number(space.h);
  const sz1 = sz0 + number(space.w);
  const bx0 = clamp(number(box.x), sx0, sx1);
  const by0 = clamp(number(box.y), sy0, sy1);
  const bz0 = clamp(number(box.z), sz0, sz1);
  const bx1 = clamp(number(box.x) + number(box.l), sx0, sx1);
  const by1 = clamp(number(box.y) + number(box.h), sy0, sy1);
  const bz1 = clamp(number(box.z) + number(box.w), sz0, sz1);
  const middleL = bx1 - bx0;
  const middleW = bz1 - bz0;
  return [
    { x: sx0, y: sy0, z: sz0, l: bx0 - sx0, h: sy1 - sy0, w: sz1 - sz0 },
    { x: bx1, y: sy0, z: sz0, l: sx1 - bx1, h: sy1 - sy0, w: sz1 - sz0 },
    { x: bx0, y: sy0, z: sz0, l: middleL, h: sy1 - sy0, w: bz0 - sz0 },
    { x: bx0, y: sy0, z: bz1, l: middleL, h: sy1 - sy0, w: sz1 - bz1 },
    { x: bx0, y: sy0, z: bz0, l: middleL, h: by0 - sy0, w: middleW },
    { x: bx0, y: by1, z: bz0, l: middleL, h: sy1 - by1, w: middleW }
  ];
}

function countPortGroups(placements) {
  const ports = new Set();
  let groupCount = 0;
  let previous = null;
  for (const item of placements) {
    const port = number(item.portSequence || 1);
    ports.add(port);
    if (port !== previous) groupCount++;
    previous = port;
  }
  return { groupCount, portCount: ports.size };
}

function intersects(a, b) {
  return number(a.x) < number(b.x) + number(b.l) - EPSILON
    && number(a.x) + number(a.l) > number(b.x) + EPSILON
    && number(a.y) < number(b.y) + number(b.h) - EPSILON
    && number(a.y) + number(a.h) > number(b.y) + EPSILON
    && number(a.z) < number(b.z) + number(b.w) - EPSILON
    && number(a.z) + number(a.w) > number(b.z) + EPSILON;
}

function handling(item) {
  return item.handlingMethod || (number(item.weight) >= 20 ? 'forklift' : 'manual');
}

function validSpace(space) {
  return number(space.l) > EPSILON && number(space.w) > EPSILON && number(space.h) > EPSILON;
}

function volume(item) {
  return Math.max(0, number(item.l ?? item.length)) * Math.max(0, number(item.w ?? item.width)) * Math.max(0, number(item.h ?? item.height));
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDivide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

module.exports = {
  calculatePlanMetrics,
  calculateCoG,
  normalizeContainer,
  partitionResidualSpaces,
  splitSpace,
  intersects,
  volume,
  clamp
};
