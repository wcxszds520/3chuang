'use strict';

/**
 * Bounded V2.5 challenger that exchanges equal solver envelopes inside the
 * same discharge port and compatible handling/packaging group. The geometric
 * topology therefore remains unchanged; the caller still re-runs every hard,
 * operation, port-access and stability gate before any promotion.
 */
function attemptLoadBalanceAwareLocalRepair({ baseCandidate, evaluate, maximumTrials = 8, minimumImprovementPercent = 0.01 } = {}) {
  if (!baseCandidate || typeof evaluate !== 'function') return noRepair('INVALID_INPUT');
  const placements = baseCandidate.loadedCargo || [];
  const pairs = candidatePairs(placements);
  if (!pairs.length) return noRepair('NO_SAME_PORT_COMPATIBLE_ENVELOPE_SWAP', { eligiblePairCount: 0 });

  const baseCog = continuousCog(baseCandidate);
  let best = baseCandidate;
  let bestCog = baseCog;
  let trials = 0;
  let stagnant = 0;
  for (const [left, right] of pairs) {
    if (trials >= maximumTrials || stagnant >= 3) break;
    trials++;
    const moved = clone(placements);
    const byId = new Map(moved.map((item) => [String(item.cargoId), item]));
    swapCoordinates(byId.get(String(left.cargoId)), byId.get(String(right.cargoId)));
    const candidate = evaluate(moved, {
      repairType: 'SAME_PORT_COMPATIBLE_ENVELOPE_SWAP',
      repairScopeCargoIds: [left.cargoId, right.cargoId],
      portSequence: number(left.portSequence || 1),
      compatibilityKey: compatibilityKey(left)
    });
    const nextCog = continuousCog(candidate);
    if (safePromotion(baseCandidate, candidate) && topologyPreserved(baseCandidate, candidate) && nextCog < bestCog - minimumImprovementPercent) {
      best = candidate;
      bestCog = nextCog;
      stagnant = 0;
    } else stagnant++;
  }
  if (best === baseCandidate) return noRepair(stagnant >= 3 ? 'THREE_CONSECUTIVE_NO_MEANINGFUL_IMPROVEMENT' : 'NO_SAFE_BALANCE_PROMOTION', {
    trials, eligiblePairCount: pairs.length, baseCogPercent: baseCog, bestCogPercent: baseCog
  });
  return {
    promoted: true,
    reason: 'CONTINUOUS_COG_REDUCED_WITH_TOPOLOGY_AND_HIGHER_GATES_PRESERVED',
    trials,
    eligiblePairCount: pairs.length,
    baseCogPercent: baseCog,
    bestCogPercent: bestCog,
    candidate: best
  };
}

function candidatePairs(placements) {
  const pairs = [];
  for (let leftIndex = 0; leftIndex < placements.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < placements.length; rightIndex++) {
      const left = placements[leftIndex]; const right = placements[rightIndex];
      if (number(left.portSequence || 1) !== number(right.portSequence || 1)) continue;
      if (compatibilityKey(left) !== compatibilityKey(right)) continue;
      if (envelopeKey(left) !== envelopeKey(right)) continue;
      if (Math.abs(number(left.weight) - number(right.weight)) < 0.01) continue;
      const potential = Math.abs((number(left.weight) - number(right.weight)) * (centerX(left) - centerX(right)));
      pairs.push([left, right, potential]);
    }
  }
  return pairs.sort((a, b) => b[2] - a[2] || String(a[0].cargoId).localeCompare(String(b[0].cargoId))).map(([left, right]) => [left, right]);
}

function compatibilityKey(item) {
  return [item.packagingType || 'GENERIC', item.handlingMethod || 'unknown', item.orientationPolicy || item.algorithmMeta?.orientation || 'placed'].join('|');
}
function envelopeKey(item) { return [number(item.l), number(item.w), number(item.h)].join('x'); }
function centerX(item) { return number(item.x) + number(item.l) / 2; }

function swapCoordinates(left, right) {
  if (!left || !right) return;
  const first = { x: left.x, y: left.y, z: left.z };
  left.x = right.x; left.y = right.y; left.z = right.z;
  right.x = first.x; right.y = first.y; right.z = first.z;
  left.algorithmMeta = { ...(left.algorithmMeta || {}), v25BalanceRepair: { swappedWith: right.cargoId } };
  right.algorithmMeta = { ...(right.algorithmMeta || {}), v25BalanceRepair: { swappedWith: left.cargoId } };
}

function safePromotion(base, candidate) {
  if (!candidate) return false;
  const gates = [
    (value) => number(value.validator?.hardViolationCount),
    (value) => number(value.operationFeasibility?.blockedCount),
    (value) => number(value.portAccessibility?.blockedCount),
    (value) => number(value.portAccessibility?.rehandleCount),
    (value) => postUnloadInvalid(value),
    (value) => number(value.metrics?.stability?.invalidCount),
    (value) => number(value.mandatoryGateViolationCount),
    (value) => guidanceRank(value.loadDistribution?.centreOfGravity?.guidanceStatus),
    (value) => -number(value.metrics?.loadedCount)
  ];
  return gates.every((getter) => getter(candidate) <= getter(base));
}

function topologyPreserved(base, candidate) {
  const tolerance = 1_000_000;
  return Math.abs(number(candidate.voidJustification?.unexplainedVoidVolume) - number(base.voidJustification?.unexplainedVoidVolume)) <= tolerance
    && Math.abs(number(candidate.layoutQuality?.internalVoidVolume) - number(base.layoutQuality?.internalVoidVolume)) <= tolerance
    && number(candidate.layoutQuality?.lowFillInteriorSliceCount) <= number(base.layoutQuality?.lowFillInteriorSliceCount);
}

function continuousCog(value) {
  const cog = value?.loadDistribution?.centreOfGravity || {};
  return Math.max(Math.abs(number(cog.lateralOffsetPercent)), Math.abs(number(cog.longitudinalOffsetPercent)));
}
function noRepair(reason, extra = {}) { return { promoted: false, reason, trials: 0, eligiblePairCount: 0, candidate: null, ...extra }; }
function guidanceRank(value) { return ({ WITHIN_GENERAL_GUIDANCE: 0, PARTICULAR_CIRCUMSTANCES_REVIEW: 1, OUTSIDE_GUIDANCE: 2 })[value] ?? 3; }
function postUnloadInvalid(result) { return (result.portAccessibility?.calls || []).reduce((sum, call) => sum + number(call.postUnloadStability?.invalidCount), 0); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = { attemptLoadBalanceAwareLocalRepair, candidatePairs, safePromotion, topologyPreserved };
