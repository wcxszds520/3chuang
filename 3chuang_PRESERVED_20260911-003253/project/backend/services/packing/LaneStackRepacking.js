'use strict';

const { depthWalls } = require('./WallOrderRepair');
const { calculateCoG, normalizeContainer } = require('./PlanMetrics');
const { centerPlan } = require('../HybridConstraintPackingSolverV24');
const { compactDeepEnd } = require('./EndGapCompaction');

/** Multi-step beam search over independent longitudinal stack lanes.
 * Whole support components stay intact. Unlike a global port wall, each lane
 * has its own discharge boundary. Cross-lane swaps reorder several downstream
 * stacks cumulatively; the caller checks every complete challenger.
 */
function generateLaneStackCandidates({ basePlacements = [], container: input = {}, beamWidth = 12, searchDepth = 8, maximumResults = 8 } = {}) {
  const container = normalizeContainer(input);
  const walls = depthWalls(basePlacements);
  if (!walls.length || basePlacements.length > 500) return [];
  const ports = [...new Set(basePlacements.map(item => item.portSequence))].sort((a, b) => b - a);
  if (ports.length < 2) return [];
  const firstPort = ports[ports.length - 1];
  const counts = new Map();
  walls.forEach(wall => counts.set(wall.end - wall.start, (counts.get(wall.end - wall.start) || 0) + wall.items.length));
  const depth = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const movable = walls.filter(wall => Math.abs(wall.end - wall.start - depth) < 0.001 && wall.items.every(item => item.portSequence !== firstPort));
  const retained = walls.filter(wall => !movable.includes(wall));
  const units = movable.flatMap(splitSupportColumns);
  if (!units.length || units.some(unit => new Set(unit.items.map(item => item.portSequence)).size !== 1 || Math.abs(unit.depth - depth) > 0.001 || unit.minY > 0.001)) return [];
  const width = Math.max(...units.map(unit => unit.width));
  const laneCount = Math.floor((container.innerWidth + 0.001) / width);
  if (laneCount < 2 || laneCount > 5 || units.length > 100) return [];
  const prefix = retained.filter(wall => !wall.items.every(item => item.portSequence === firstPort));
  const suffix = retained.filter(wall => wall.items.every(item => item.portSequence === firstPort));
  const prefixDepth = prefix.reduce((sum, wall) => sum + wall.end - wall.start, 0);
  const occupiedDepth = prefixDepth + Math.ceil(units.length / laneCount) * depth + suffix.reduce((sum, wall) => sum + wall.end - wall.start, 0);
  if (occupiedDepth > container.innerLength + 0.001) return [];
  const oldCog = calculateCoG(basePlacements, container);
  const guidance = Math.max(oldCog.lateral, oldCog.longitudinal) <= 5.001 ? 5 : 10;
  const unitOrder = (a, b) => b.port - a.port || a.mass - b.mass || a.key.localeCompare(b.key);
  let exploredStates = 0;
  function evaluate(lanes, history) {
    exploredStates++;
    const sorted = lanes.map(lane => [...lane].sort(unitOrder));
    const placements = [];
    let cursor = 0;
    for (const wall of prefix) { placements.push(...wall.items.map(item => ({ ...item, x: cursor + item.x - wall.start }))); cursor += wall.end - wall.start; }
    for (const [laneIndex, lane] of sorted.entries()) {
      const laneZ = laneIndex * width;
      for (const [row, unit] of lane.entries()) {
        // Centre narrow columns in their lane; contact components retain every
        // relative X/Y/Z coordinate and every source property.
        const z = laneZ + (laneIndex === 0 ? width - unit.width : 0);
        placements.push(...unit.items.map(item => ({ ...item, x: prefixDepth + row * depth + item.x - unit.minX, z: z + item.z - unit.minZ,
          algorithmMeta: { ...item.algorithmMeta, candidateSource: 'LANE_STACK_BEAM_REPACK' } })));
      }
    }
    cursor = prefixDepth + Math.max(...sorted.map(lane => lane.length)) * depth;
    for (const wall of suffix) { placements.push(...wall.items.map(item => ({ ...item, x: cursor + item.x - wall.start }))); cursor += wall.end - wall.start; }
    const cog = calculateCoG(placements, container);
    const minimumX = container.innerLength / 2 - container.innerLength * guidance / 100;
    const requiredGap = Math.max(0, minimumX - cog.x);
    const maxShift = container.innerLength - occupiedDepth;
    const lateralExcess = Math.max(0, cog.lateral - guidance);
    const interiorNarrowColumns = sorted.slice(1, -1).reduce((sum, lane) => sum + lane.filter(unit => unit.width < width - 0.001).length, 0);
    let envelopeVoid = 0;
    let unexplainedVoid = 0;
    for (let row = 0; row < Math.max(...sorted.map(lane => lane.length)); row++) {
      const present = sorted.map(lane => lane[row]).filter(Boolean);
      const maxHeight = Math.max(...present.map(unit => unit.height));
      envelopeVoid += (maxHeight * container.innerWidth - present.reduce((sum, unit) => sum + unit.area, 0)) * depth;
      const rowColumns = sorted.map((lane, laneIndex) => ({ unit: lane[row], laneIndex })).filter(entry => entry.unit);
      const minZ = Math.min(...rowColumns.map(({ unit, laneIndex }) => laneIndex * width + (laneIndex === 0 ? width - unit.width : 0)));
      const maxZ = Math.max(...rowColumns.map(({ unit, laneIndex }) => laneIndex * width + (laneIndex === 0 ? width : unit.width)));
      const noStackArea = present.reduce((sum, unit) => sum + unit.items.filter(item => item.stackable === false || item.fragile)
        .reduce((area, item) => area + item.w * Math.max(0, maxHeight - item.y - item.h), 0), 0);
      unexplainedVoid += Math.max(0, maxHeight * (maxZ - minZ) - present.reduce((sum, unit) => sum + unit.area, 0) - noStackArea) * depth;
    }
    const key = sorted.map(lane => lane.map(unit => unit.type).join(',')).join('|');
    return { lanes: sorted, placements, history, key, requiredGap, envelopeVoid, unexplainedVoid,
      score: interiorNarrowColumns * 10000000 + Math.max(0, requiredGap - maxShift) * 100000 + lateralExcess * 10000000 + unexplainedVoid / 1e9 * 1000000 + requiredGap };
  }
  const starts = [];
  let randomSeed = 9349;
  for (let start = 0; start < beamWidth; start++) {
    const shuffled = [...units].sort((a, b) => a.key.localeCompare(b.key));
    if (start > 0) for (let i = shuffled.length - 1; i > 0; i--) {
      randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
      const j = randomSeed % (i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const lanes = Array.from({ length: laneCount }, () => []);
    shuffled.forEach((unit, index) => lanes[index % laneCount].push(unit));
    starts.push(evaluate(lanes, []));
  }
  const rank = (a, b) => a.score - b.score || a.key.localeCompare(b.key);
  let frontier = starts.sort(rank).slice(0, beamWidth);
  const archive = new Map(frontier.map(state => [state.key, state]));
  for (let step = 0; step < searchDepth; step++) {
    const candidates = new Map(frontier.map(state => [state.key, state]));
    for (const state of frontier) for (let a = 0; a < laneCount; a++) for (let b = a + 1; b < laneCount; b++) {
      const usedPairs = new Set();
      for (let ai = 0; ai < state.lanes[a].length; ai++) for (let bi = 0; bi < state.lanes[b].length; bi++) {
        const left = state.lanes[a][ai]; const right = state.lanes[b][bi];
        const pair = `${left.type}|${right.type}`;
        if (left.type === right.type || usedPairs.has(pair)) continue;
        usedPairs.add(pair);
        const lanes = state.lanes.map(lane => [...lane]);
        [lanes[a][ai], lanes[b][bi]] = [right, left];
        const candidate = evaluate(lanes, [...state.history, { step: step + 1, fromLane: a, toLane: b, leftCargoIds: left.items.map(item => item.cargoId), rightCargoIds: right.items.map(item => item.cargoId) }]);
        if (!candidates.has(candidate.key) || rank(candidate, candidates.get(candidate.key)) < 0) candidates.set(candidate.key, candidate);
      }
    }
    frontier = [...candidates.values()].sort(rank).slice(0, beamWidth);
    for (const state of frontier) archive.set(state.key, state);
  }
  return [...archive.values()].sort(rank).slice(0, maximumResults).map((state, index) => {
    centerPlan(state.placements, container);
    const compacted = compactDeepEnd(state.placements, container, { guidanceLimitPercent: guidance });
    return { complete: true, placements: compacted?.placements || state.placements, evidence: {
      model: 'LANE_STACK_BEAM_REPACK_V1', candidateIndex: index, exploredStates, searchDepth, beamWidth,
      scopeCargoCount: units.reduce((sum, unit) => sum + unit.items.length, 0), stackComponentCount: units.length,
      laneCount, laneWidths: Array(laneCount).fill(width), cumulativeMoves: state.history,
      requiredGapMm: state.requiredGap, envelopeVoidM3: state.envelopeVoid / 1e9, unexplainedScopeVoidM3: state.unexplainedVoid / 1e9,
      compaction: compacted?.evidence || null, inputLimitsChanged: false,
      limitation: 'BOUNDED_BEAM_SEARCH_NO_GLOBAL_OPTIMALITY_CLAIM'
    } };
  });
}

function splitSupportColumns(wall) {
  const components = [];
  for (const item of [...wall.items].sort((a, b) => a.z - b.z)) {
    let component = components[components.length - 1];
    if (!component || item.z >= component.maxZ - 0.001) {
      component = { items: [], minZ: item.z, maxZ: item.z + item.w }; components.push(component);
    }
    component.items.push(item); component.maxZ = Math.max(component.maxZ, item.z + item.w);
  }
  return components.map(component => {
    const { items } = component;
    const minX = Math.min(...items.map(item => item.x)); const minY = Math.min(...items.map(item => item.y));
    const height = Math.max(...items.map(item => item.y + item.h));
    const type = items.map(item => [item.y, item.z - component.minZ, item.l, item.w, item.h, item.weight, item.portSequence, item.packagingType, item.maxStackLayers].join(':')).sort().join('/');
    return { ...component, width: component.maxZ - component.minZ, minX, minY, height,
      depth: Math.max(...items.map(item => item.x + item.l)) - minX, mass: items.reduce((sum, item) => sum + item.weight, 0),
      area: items.reduce((sum, item) => sum + item.w * item.h, 0), port: items[0].portSequence,
      key: items.map(item => item.cargoId).sort().join(','), type };
  });
}
module.exports = { generateLaneStackCandidates, splitSupportColumns };
