const { generateLaneStackCandidates } = require('../../services/packing/LaneStackRepacking');
const { analyzeExactVoidGeometry } = require('../../services/packing/ExactVoidGeometry');
const PlanValidator = require('../../services/packing/PlanValidator');
const { normalizeCargoList } = require('../../services/packing/PackagingProfile');
const input = require('../../../artifacts/rebuild/original-212-input.json');
const baseline = require('../../../artifacts/rebuild/original-212-baseline.json').plan;

test('multiple cumulative lane moves improve the unchanged dense order without increasing exact internal void or breaking physical rules', () => {
  const candidates = generateLaneStackCandidates({ basePlacements: baseline.loadedCargo, container: input.container, maximumResults: 1 });
  expect(candidates).toHaveLength(1);
  const candidate = candidates[0];
  expect(candidate.evidence.cumulativeMoves.length).toBeGreaterThan(1);
  const byId = new Map(baseline.loadedCargo.map(item => [item.cargoId, item]));
  expect(new Set(candidate.placements.map(item => item.cargoId)).size).toBe(212);
  for (const item of candidate.placements) {
    const source = byId.get(item.cargoId);
    for (const field of ['sourceCargoId', 'l', 'w', 'h', 'weight', 'portSequence', 'fragile', 'stackable', 'maxStackLayers']) expect(item[field]).toEqual(source[field]);
  }
  const result = new PlanValidator().validate({ placements: candidate.placements, cargoList: normalizeCargoList(input.cargo), container: input.container });
  expect(result.violations).toEqual([]);
  expect(Math.min(...candidate.placements.map(item => item.x))).toBeLessThan(667.695);
  const oldVoid = analyzeExactVoidGeometry(baseline.loadedCargo);
  const nextVoid = analyzeExactVoidGeometry(candidate.placements);
  expect(nextVoid.internalVoidVolume).toBeLessThanOrEqual(oldVoid.internalVoidVolume + 1);
  expect(nextVoid.unexplainedVoidVolume).toBeLessThanOrEqual(oldVoid.unexplainedVoidVolume + 1);
}, 30000);
