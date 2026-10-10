'use strict';

const { validateCargoOperation } = require('../packing/CanonicalOperationFeasibility');
const { analyzeStability } = require('../packing/StabilityAnalyzer');
const { analyzeLoadDistribution } = require('./LoadDistributionAnalyzer');

/**
 * Replays every discharge call. Cargo for one port may be reordered, but no
 * later-port cargo is silently moved. Stability and load distribution are
 * recomputed after the port is fully discharged.
 */
function validatePortAccessibility({ placements = [], container = {}, route = [], caseContext = {} } = {}) {
  const remaining = placements.map(clonePlacement);
  const portSequences = [...new Set(remaining.map((item) => port(item)))].sort((a, b) => a - b);
  const calls = [];
  const allRehandleIds = new Set();
  let totalBlocked = 0;
  for (const sequence of portSequences) {
    const beforeCount = remaining.length;
    let pending = remaining.filter((item) => port(item) === sequence)
      .sort((a, b) => number(b.x) - number(a.x) || number(b.y) - number(a.y) || id(a).localeCompare(id(b)));
    const removed = [];
    const attemptEvidence = [];
    let progressed = true;
    while (pending.length > 0 && progressed) {
      progressed = false;
      for (let index = 0; index < pending.length; index++) {
        const target = pending[index];
        const blockers = remaining.filter((item) => id(item) !== id(target));
        const supportBlockers = directSupportedCargo(target, blockers);
        const operation = validateCargoOperation(target, container, blockers, { queueIndex: removed.length });
        const reasons = [...operation.reasons];
        if (supportBlockers.length > 0) reasons.push({
          code: 'SUPPORT_DEPENDENCY_BLOCK', message: 'Target supports cargo that remains in the CTU.',
          cargoIds: supportBlockers.map(id)
        });
        const feasible = reasons.length === 0;
        attemptEvidence.push({ cargoId: id(target), feasible, reasons });
        if (!feasible) continue;
        const remainingIndex = remaining.findIndex((item) => id(item) === id(target));
        if (remainingIndex >= 0) remaining.splice(remainingIndex, 1);
        pending.splice(index, 1);
        removed.push(id(target));
        progressed = true;
        break;
      }
    }
    const blocked = pending.map((target) => {
      const latest = [...attemptEvidence].reverse().find((entry) => entry.cargoId === id(target));
      const blockerIds = uniqueBlockerIds(latest?.reasons || []);
      const futureBlockerIds = blockerIds.filter((blockerId) => {
        const blocker = remaining.find((item) => id(item) === blockerId);
        return blocker && port(blocker) > sequence;
      });
      futureBlockerIds.forEach((blockerId) => allRehandleIds.add(blockerId));
      return { cargoId: id(target), reasons: latest?.reasons || [], blockerIds, futureBlockerIds };
    });
    totalBlocked += blocked.length;
    const remainingStability = analyzeStability(remaining, container);
    const remainingDistribution = analyzeLoadDistribution({ placements: remaining, container, caseContext });
    calls.push({
      portSequence: sequence, portCode: routePort(route, sequence), beforeCount, scheduledCount: removed.length + blocked.length,
      removedCount: removed.length, removedCargoIds: removed, blockedCount: blocked.length, blocked,
      futureCargoRehandleCount: new Set(blocked.flatMap((entry) => entry.futureBlockerIds)).size,
      afterCount: remaining.length,
      postUnloadStability: {
        status: remaining.length === 0 ? 'EMPTY_CTU' : remainingStability.status,
        invalidCount: remainingStability.invalidCount, warningCount: remainingStability.warningCount,
        violations: remainingStability.violations
      },
      postUnloadLoadDistribution: {
        status: remaining.length === 0 ? 'EMPTY_CTU' : remainingDistribution.status,
        centreOfGravity: remainingDistribution.centreOfGravity
      }
    });
    if (blocked.length > 0) break;
  }
  const postUnloadInvalidCount = sum(calls, (call) => number(call.postUnloadStability.invalidCount));
  const rehandleCount = allRehandleIds.size;
  const status = totalBlocked > 0 ? 'PORT_ACCESS_BLOCKED'
    : postUnloadInvalidCount > 0 ? 'POST_UNLOAD_STABILITY_INVALID'
      : rehandleCount > 0 ? 'REHANDLE_REQUIRED' : 'FULL_UNLOAD_PASS';
  return {
    model: 'PORTCUBE_FULL_PORT_UNLOAD_REPLAY_V2_4', status,
    accessPass: totalBlocked === 0, postUnloadStabilityPass: postUnloadInvalidCount === 0,
    blockedCount: totalBlocked, rehandleCount, rehandleCargoIds: [...allRehandleIds], calls,
    unloadOrder: calls.flatMap((call) => call.removedCargoIds),
    policy: { samePortReorderAllowed: true, futurePortRehandleAllowed: false, doorSide: 'higher x coordinate', dataClassification: 'PROJECT_POLICY' }
  };
}

function directSupportedCargo(target, blockers) {
  const top = number(target.y) + number(target.h);
  return blockers.filter((item) => Math.abs(number(item.y) - top) <= 2
    && overlap(number(target.x), number(target.l), number(item.x), number(item.l)) > 0
    && overlap(number(target.z), number(target.w), number(item.z), number(item.w)) > 0);
}

function uniqueBlockerIds(reasons) {
  const result = new Set();
  for (const reason of reasons) {
    if (reason.cargoId) result.add(String(reason.cargoId));
    for (const cargoId of reason.cargoIds || []) result.add(String(cargoId));
  }
  return [...result];
}

function routePort(route, sequence) {
  const entry = route.find((item) => number(item.portSequence ?? item.sequence) === sequence);
  return entry?.portCode || entry?.code || entry?.name || `PORT-${sequence}`;
}
function clonePlacement(item) { return { ...item, supportCargoIds: [...(item.supportCargoIds || [])], riskNotes: [...(item.riskNotes || [])] }; }
function port(item) { return Math.max(1, number(item.portSequence || 1)); }
function id(item) { return String(item.cargoId || item.id || item.sku || 'unknown'); }
function overlap(startA, sizeA, startB, sizeB) { return Math.max(0, Math.min(startA + sizeA, startB + sizeB) - Math.max(startA, startB)); }
function sum(values, mapper) { return values.reduce((total, value) => total + mapper(value), 0); }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = { validatePortAccessibility };
