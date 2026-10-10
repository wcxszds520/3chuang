'use strict';

const { calculateCoG } = require('./PlanMetrics');
const { compactDeepEnd } = require('./EndGapCompaction');
const { safePromotion } = require('./LoadBalanceAwareLocalRepair');

// Move complete, non-overlapping depth slabs. Every supporter stays with its
// stack; unlike a box swap this never puts a heavy box on a weaker package.
function depthWalls(placements) {
  const sorted = [...placements].sort((a, b) => a.x - b.x || String(a.cargoId).localeCompare(String(b.cargoId)));
  const walls = [];
  for (const item of sorted) {
    let wall = walls[walls.length - 1];
    if (!wall || item.x >= wall.end - 0.001) {
      wall = { start: item.x, end: item.x + item.l, items: [], ports: new Set(), weight: 0 };
      walls.push(wall);
    }
    wall.end = Math.max(wall.end, item.x + item.l);
    wall.items.push(item);
    wall.ports.add(Number(item.portSequence || 1));
    wall.weight += Number(item.weight || 0);
  }
  return walls;
}

function reorderedWalls(placements, direction) {
  const walls = depthWalls(placements);
  const moves = [];
  const output = [];
  for (let index = 0; index < walls.length;) {
    const first = walls[index];
    const run = [first];
    let next = index + 1;
    while (first.ports.size === 1 && next < walls.length && walls[next].ports.size === 1
      && [...first.ports][0] === [...walls[next].ports][0]
      && Math.abs(walls[next].start - walls[next - 1].end) < 1) run.push(walls[next++]);
    const ordered = [...run].sort((a, b) => {
      const difference = direction * (a.weight / (a.end - a.start) - b.weight / (b.end - b.start));
      return Math.abs(difference) > 1e-9 ? difference : a.start - b.start;
    });
    let cursor = first.start;
    for (const wall of ordered) {
      const shift = cursor - wall.start;
      if (Math.abs(shift) > 0.001) moves.push({ portSequence: [...wall.ports][0], fromX: wall.start, toX: cursor, cargoIds: wall.items.map(c => c.cargoId) });
      output.push(...wall.items.map(item => ({ ...item, x: item.x + shift })));
      cursor += wall.end - wall.start;
    }
    index = next;
  }
  return { placements: output, moves };
}

function attemptWallOrderRepair({ baseCandidate, container, evaluate }) {
  const before = baseCandidate.loadedCargo;
  if (!before.length) return { promoted: false, reason: 'EMPTY_PLAN', trials: 0 };
  const originalGap = Math.min(...before.map(c => c.x));
  const cog = calculateCoG(before, container);
  const direction = cog.x <= container.innerLength / 2 ? 1 : -1;
  const rearranged = reorderedWalls(before, direction);
  if (!rearranged.moves.length) return { promoted: false, reason: 'WALL_ORDER_ALREADY_BALANCED', trials: 0 };
  const baseOffset = Math.max(cog.lateral, cog.longitudinal);
  const compacted = compactDeepEnd(rearranged.placements, container, { guidanceLimitPercent: baseOffset <= 5.001 ? 5 : 10 });
  const placements = compacted?.placements || rearranged.placements;
  const gap = Math.min(...placements.map(c => c.x));
  const evidence = {
    model: 'SAME_PORT_WHOLE_WALL_REORDER_V1', scope: 'CONTIGUOUS_SAME_PORT_DEPTH_WALLS',
    previousGapMm: originalGap, gapMm: gap, movedWallCount: rearranged.moves.length,
    wallMoves: rearranged.moves, compaction: compacted?.evidence || null,
    limitation: 'BOUNDED_WALL_ORDER_SEARCH_NOT_GLOBAL_OPTIMALITY_PROOF'
  };
  const candidate = evaluate(placements, evidence);
  const beforeVoid = Number(baseCandidate.voidJustification?.unexplainedVoidVolume || 0);
  const afterVoid = Number(candidate.voidJustification?.unexplainedVoidVolume || 0);
  evidence.previousUnexplainedVoidM3 = beforeVoid / 1e9;
  evidence.candidateUnexplainedVoidM3 = afterVoid / 1e9;
  const layoutPreserved = afterVoid <= beforeVoid + 1;
  const accepted = gap < originalGap - 1 && safePromotion(baseCandidate, candidate) && layoutPreserved;
  return { promoted: accepted, reason: accepted ? 'REAR_GAP_REDUCED_WITH_SAME_PORT_STACKS_AND_GATES_PRESERVED' : !layoutPreserved ? 'INTERNAL_VOID_REGRESSION' : 'NO_SAFE_REAR_GAP_IMPROVEMENT', trials: 1, evidence, candidate: accepted ? candidate : null };
}

module.exports = { depthWalls, reorderedWalls, attemptWallOrderRepair };
