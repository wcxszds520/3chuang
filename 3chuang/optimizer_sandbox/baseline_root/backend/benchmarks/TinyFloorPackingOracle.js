'use strict';

const EPSILON = 0.001;

/**
 * Exact orthogonal floor-packing oracle for the deliberately tiny benchmark.
 * An optional predicate calculates a second exact optimum under a safety model
 * while preserving the independent raw geometric optimum.
 */
function solveTinyFloorPacking(cargoList = [], container = {}, options = {}) {
  const instances = cargoList.flatMap((cargo, sourceIndex) => Array.from({ length: Math.max(1, Math.floor(number(cargo.quantity || 1))) }, (_, index) => ({
    ...cargo,
    sourceIndex,
    instanceIndex: index + 1,
    instanceId: `${cargo.cargoId || cargo.id || sourceIndex}_${index + 1}`
  })));
  let best = { loadedCount: 0, loadedVolume: 0, placements: [] };
  let acceptedBest = { loadedCount: 0, loadedVolume: 0, placements: [] };
  const acceptPlacements = typeof options.acceptPlacements === 'function'
    ? options.acceptPlacements
    : () => true;
  const seen = new Map();

  const search = (remaining, placements, loadedVolume) => {
    if (placements.length > best.loadedCount || (placements.length === best.loadedCount && loadedVolume > best.loadedVolume)) {
      best = { loadedCount: placements.length, loadedVolume, placements: placements.map((placement) => ({ ...placement })) };
    }
    if (acceptPlacements(placements)
      && (placements.length > acceptedBest.loadedCount
        || (placements.length === acceptedBest.loadedCount && loadedVolume > acceptedBest.loadedVolume))) {
      acceptedBest = { loadedCount: placements.length, loadedVolume, placements: placements.map((placement) => ({ ...placement })) };
    }
    const upperBound = placements.length + remaining.length;
    if (upperBound < best.loadedCount && upperBound < acceptedBest.loadedCount) return;
    const stateKey = stateSignature(remaining, placements);
    if (seen.has(stateKey) && number(seen.get(stateKey)) >= placements.length) return;
    seen.set(stateKey, placements.length);

    const uniqueItems = new Set();
    for (let itemIndex = 0; itemIndex < remaining.length; itemIndex++) {
      const item = remaining[itemIndex];
      const itemSignature = `${item.length}:${item.width}:${item.height}:${item.canRotate !== false}`;
      if (uniqueItems.has(itemSignature)) continue;
      uniqueItems.add(itemSignature);
      const nextRemaining = remaining.filter((_, index) => index !== itemIndex);
      for (const dims of orientations(item)) {
        if (dims.l > number(container.innerLength) + EPSILON || dims.w > number(container.innerWidth) + EPSILON || dims.h > number(container.innerHeight) + EPSILON) continue;
        for (const point of extremePoints(placements, dims, container)) {
          const candidate = { cargoId: item.instanceId, x: point.x, y: 0, z: point.z, l: dims.l, w: dims.w, h: dims.h };
          if (placements.some((placed) => intersects(candidate, placed))) continue;
          search(nextRemaining, [...placements, candidate], loadedVolume + dims.l * dims.w * dims.h);
        }
      }
    }
  };

  search(instances.sort((left, right) => number(right.length) * number(right.width) - number(left.length) * number(left.width) || left.instanceId.localeCompare(right.instanceId)), [], 0);
  return {
    ...best,
    acceptedLoadedCount: acceptedBest.loadedCount,
    acceptedLoadedVolume: acceptedBest.loadedVolume,
    acceptedPlacements: acceptedBest.placements,
    exact: true,
    model: 'PORTCUBE_TINY_FLOOR_ORACLE',
    acceptedModel: options.acceptedModel || 'RAW_GEOMETRY',
    exploredStateCount: seen.size
  };
}

function extremePoints(placements, dims, container) {
  const xs = new Set([0]);
  const zs = new Set([0]);
  for (const placement of placements) {
    xs.add(number(placement.x) + number(placement.l));
    xs.add(number(placement.x) - dims.l);
    zs.add(number(placement.z) + number(placement.w));
    zs.add(number(placement.z) - dims.w);
  }
  const points = [];
  for (const x of xs) for (const z of zs) {
    if (x < -EPSILON || z < -EPSILON || x + dims.l > number(container.innerLength) + EPSILON || z + dims.w > number(container.innerWidth) + EPSILON) continue;
    points.push({ x: round(x), z: round(z) });
  }
  return points.sort((left, right) => left.x - right.x || left.z - right.z);
}

function orientations(item) {
  const result = [{ l: number(item.length), w: number(item.width), h: number(item.height) }];
  if (item.canRotate !== false && Math.abs(number(item.length) - number(item.width)) > EPSILON) result.push({ l: number(item.width), w: number(item.length), h: number(item.height) });
  return result;
}

function intersects(left, right) {
  return number(left.x) < number(right.x) + number(right.l) - EPSILON && number(left.x) + number(left.l) > number(right.x) + EPSILON
    && number(left.z) < number(right.z) + number(right.w) - EPSILON && number(left.z) + number(left.w) > number(right.z) + EPSILON;
}

function stateSignature(remaining, placements) {
  const rest = remaining.map((item) => `${item.length}:${item.width}:${item.height}:${item.canRotate !== false}`).sort().join(',');
  const placed = placements.map((item) => `${item.x}:${item.z}:${item.l}:${item.w}`).sort().join(',');
  return `${rest}|${placed}`;
}

function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = { solveTinyFloorPacking };
