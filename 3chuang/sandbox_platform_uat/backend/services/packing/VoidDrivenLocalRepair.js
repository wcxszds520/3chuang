'use strict';

/**
 * Bounded deterministic local repair. It only translates a support-connected
 * neighbourhood (6–30 pieces) and delegates all safety/port/stability gates to
 * the caller. A move is promoted only when higher gates do not regress and the
 * unexplained void strictly improves.
 */
function attemptVoidDrivenLocalRepair({
  baseCandidate,
  evaluate,
  minimumCargo = 6,
  maximumCargo = 30,
  maximumTrials = 18,
  quantumMm = 50
} = {}) {
  if (!baseCandidate || typeof evaluate !== 'function') return noRepair('INVALID_INPUT');
  const zone = baseCandidate.voidJustification?.largestUnexplainedZone;
  if (!zone?.boundsMm) return noRepair('NO_UNEXPLAINED_ZONE');
  const placements = baseCandidate.loadedCargo || [];
  if (placements.length < minimumCargo) return noRepair('BELOW_MINIMUM_CARGO_SCOPE');
  const targetIds = new Set((zone.linkedCargoIds || []).map(String));
  const ordered = [...placements].sort((left, right) => {
    const linked = Number(targetIds.has(String(right.cargoId))) - Number(targetIds.has(String(left.cargoId)));
    if (linked) return linked;
    return distanceToZone(left, zone) - distanceToZone(right, zone) || String(left.cargoId).localeCompare(String(right.cargoId));
  });
  const neighbourhood = ordered.slice(0, Math.min(maximumCargo, Math.max(minimumCargo, targetIds.size || minimumCargo)));
  const neighbourhoodIds = new Set(neighbourhood.map((item) => String(item.cargoId)));
  const components = supportComponents(placements)
    .filter((component) => component.some((item) => neighbourhoodIds.has(String(item.cargoId))))
    .filter((component) => component.length <= maximumCargo)
    .sort((left, right) => distanceToZone(left[0], zone) - distanceToZone(right[0], zone) || left.length - right.length);
  if (components.length === 0) return noRepair('NO_BOUNDED_SUPPORT_COMPONENT');

  const base = baseCandidate;
  let best = base;
  let trials = 0;
  const vectors = repairVectors(zone, placements, quantumMm);
  for (const component of components) {
    if (trials >= maximumTrials) break;
    const ids = new Set(component.map((item) => String(item.cargoId)));
    for (const vector of vectors) {
      if (trials >= maximumTrials) break;
      trials++;
      const moved = clone(placements);
      for (const item of moved) if (ids.has(String(item.cargoId))) {
        item.x = round(number(item.x) + vector.x);
        item.z = round(number(item.z) + vector.z);
        item.algorithmMeta = { ...(item.algorithmMeta || {}), v25VoidRepair: { dx: vector.x, dz: vector.z } };
      }
      const candidate = evaluate(moved, {
        repairScopeCargoIds: [...ids],
        repairVector: vector,
        repairTargetZoneId: zone.id
      });
      if (safePromotion(base, candidate) && betterVoid(candidate, best)) best = candidate;
    }
  }
  if (best === base) return noRepair('NO_SAFE_PROMOTION', { trials, scopedCargoCount: neighbourhood.length, targetZoneId: zone.id });
  return {
    promoted: true,
    reason: 'UNEXPLAINED_VOID_REDUCED_WITH_HIGHER_GATES_PRESERVED',
    trials,
    scopedCargoCount: neighbourhood.length,
    targetZoneId: zone.id,
    candidate: best
  };
}

function safePromotion(base, candidate) {
  if (!candidate) return false;
  const keys = [
    (value) => number(value.validator?.hardViolationCount),
    (value) => number(value.operationFeasibility?.blockedCount),
    (value) => number(value.portAccessibility?.blockedCount),
    (value) => number(value.portAccessibility?.rehandleCount),
    (value) => postUnloadInvalid(value),
    (value) => number(value.metrics?.stability?.invalidCount),
    (value) => guidanceRank(value.loadDistribution?.centreOfGravity?.guidanceStatus),
    (value) => -number(value.metrics?.loadedCount)
  ];
  return keys.every((getter) => getter(candidate) <= getter(base));
}

function betterVoid(candidate, incumbent) {
  const candidateUnexplained = number(candidate.voidJustification?.unexplainedVoidVolume);
  const incumbentUnexplained = number(incumbent.voidJustification?.unexplainedVoidVolume);
  if (candidateUnexplained < incumbentUnexplained - 1_000_000) return true;
  if (Math.abs(candidateUnexplained - incumbentUnexplained) > 1_000_000) return false;
  return number(candidate.layoutQuality?.internalVoidVolume) < number(incumbent.layoutQuality?.internalVoidVolume) - 1_000_000;
}

function supportComponents(placements) {
  const adjacency = new Map(placements.map((item) => [String(item.cargoId), new Set()]));
  for (let a = 0; a < placements.length; a++) for (let b = a + 1; b < placements.length; b++) {
    const left = placements[a]; const right = placements[b];
    const verticalContact = Math.abs(number(left.y) + number(left.h) - number(right.y)) <= 2
      || Math.abs(number(right.y) + number(right.h) - number(left.y)) <= 2;
    if (!verticalContact || overlap(left.x, left.l, right.x, right.l) <= 0 || overlap(left.z, left.w, right.z, right.w) <= 0) continue;
    adjacency.get(String(left.cargoId)).add(String(right.cargoId));
    adjacency.get(String(right.cargoId)).add(String(left.cargoId));
  }
  const byId = new Map(placements.map((item) => [String(item.cargoId), item]));
  const visited = new Set(); const result = [];
  for (const item of placements) {
    const id = String(item.cargoId);
    if (visited.has(id)) continue;
    const queue = [id]; visited.add(id); const component = [];
    while (queue.length) {
      const current = queue.shift(); component.push(byId.get(current));
      for (const next of adjacency.get(current) || []) if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
    result.push(component);
  }
  return result;
}

function repairVectors(zone, placements, quantum) {
  const center = { x: (number(zone.boundsMm.minX) + number(zone.boundsMm.maxX)) / 2, z: (number(zone.boundsMm.minZ) + number(zone.boundsMm.maxZ)) / 2 };
  const cargoCenter = {
    x: average(placements.map((item) => number(item.x) + number(item.l) / 2)),
    z: average(placements.map((item) => number(item.z) + number(item.w) / 2))
  };
  const signX = center.x >= cargoCenter.x ? 1 : -1;
  const signZ = center.z >= cargoCenter.z ? 1 : -1;
  return [
    { x: signX * quantum, z: 0 }, { x: signX * quantum * 2, z: 0 },
    { x: 0, z: signZ * quantum }, { x: 0, z: signZ * quantum * 2 },
    { x: signX * quantum, z: signZ * quantum },
    { x: -signX * quantum, z: 0 }, { x: 0, z: -signZ * quantum }
  ];
}

function distanceToZone(item, zone) {
  const x = number(item.x) + number(item.l) / 2;
  const z = number(item.z) + number(item.w) / 2;
  const cx = (number(zone.boundsMm.minX) + number(zone.boundsMm.maxX)) / 2;
  const cz = (number(zone.boundsMm.minZ) + number(zone.boundsMm.maxZ)) / 2;
  return Math.abs(x - cx) + Math.abs(z - cz);
}

function noRepair(reason, extra = {}) { return { promoted: false, reason, trials: 0, ...extra, candidate: null }; }
function guidanceRank(value) { return ({ WITHIN_GENERAL_GUIDANCE: 0, PARTICULAR_CIRCUMSTANCES_REVIEW: 1, OUTSIDE_GUIDANCE: 2 })[value] ?? 3; }
function postUnloadInvalid(result) { return (result.portAccessibility?.calls || []).reduce((sum, call) => sum + number(call.postUnloadStability?.invalidCount), 0); }
function overlap(a0, as, b0, bs) { return Math.max(0, Math.min(number(a0) + number(as), number(b0) + number(bs)) - Math.max(number(a0), number(b0))); }
function average(values) { return values.length ? values.reduce((sum, value) => sum + number(value), 0) / values.length : 0; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = { attemptVoidDrivenLocalRepair, safePromotion, betterVoid };
