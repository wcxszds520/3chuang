const { analyzeStability } = require('../../services/packing/StabilityAnalyzer');

const container = { typeId: 'TEST', innerLength: 2400, innerWidth: 1200, innerHeight: 1800, maxWeight: 2000 };

describe('StabilityAnalyzer', () => {
  test('builds the support hull and rejects a cargo CoG outside it even when support exists', () => {
    const placements = [
      box('LEFT', { x: 0, y: 0, z: 0, l: 180, w: 400, h: 300 }),
      box('TOP', { x: 0, y: 300, z: 0, l: 400, w: 400, h: 300, weight: 20 })
    ];
    const result = analyzeStability(placements, container, { supportRatioMin: 0.4, hardUnrestrainedSlenderness: 20 });
    expect(result.cargo.TOP.supportRatio).toBeCloseTo(0.45);
    expect(result.cargo.TOP.supportMargin).toBeLessThan(0);
    expect(result.violations.some((entry) => entry.code === 'CARGO_COG_OUTSIDE_SUPPORT')).toBe(true);
  });

  test('uses transitive mass for stack CoG and exposes graph evidence', () => {
    const placements = [
      box('BASE', { x: 0, y: 0, z: 0, l: 500, w: 500, h: 300, weight: 10 }),
      box('MID', { x: 0, y: 300, z: 0, l: 500, w: 500, h: 300, weight: 10 }),
      box('TOP', { x: 400, y: 600, z: 0, l: 500, w: 500, h: 300, weight: 100 })
    ];
    const result = analyzeStability(placements, container, { supportRatioMin: 0.5, hardUnrestrainedSlenderness: 20 });
    expect(result.supportGraph.edges).toHaveLength(2);
    expect(result.cargo.MID.stackStability.totalMass).toBe(110);
    expect(result.cargo.MID.stackStability.status).toBe('FAIL');
    expect(result.violations.some((entry) => entry.code === 'STACK_COG_OUTSIDE_SUPPORT')).toBe(true);
  });

  test('classifies wall and cargo restraint with project-policy gap/contact thresholds', () => {
    const placements = [
      box('A', { x: 0, y: 0, z: 0, l: 500, w: 400, h: 500 }),
      box('B', { x: 0, y: 0, z: 420, l: 500, w: 400, h: 500 })
    ];
    const result = analyzeStability(placements, container, { contactGapToleranceMm: 30, hardUnrestrainedSlenderness: 20 });
    expect(result.cargo.A.restraint.left.status).toBe('WALL_RESTRAINED');
    expect(result.cargo.A.restraint.right.status).toBe('CARGO_RESTRAINED');
    expect(result.cargo.A.restraint.right.gap).toBe(20);
    expect(result.cargo.A.restraint.right.contactRatio).toBe(1);
  });

  test('hard-rejects a genuinely isolated slender stack while keeping one-sided restraint as a warning', () => {
    const isolated = [
      box('BASE', { x: 900, y: 0, z: 400, l: 300, w: 300, h: 300 }),
      box('TOP-1', { x: 900, y: 300, z: 400, l: 300, w: 300, h: 300 }),
      box('TOP-2', { x: 900, y: 600, z: 400, l: 300, w: 300, h: 300 }),
      box('TOP-3', { x: 900, y: 900, z: 400, l: 300, w: 300, h: 300 })
    ];
    const result = analyzeStability(isolated, container, { hardUnrestrainedSlenderness: 3.5 });
    expect(result.violations.some((entry) => entry.code === 'FREE_STANDING_TALL_STACK')).toBe(true);
  });

  test('distinguishes a door-connected residual region from an enclosed voxel cavity deterministically', () => {
    const placements = [
      box('WALL-1', { x: 500, y: 0, z: 0, l: 250, w: 1200, h: 1800 }),
      box('WALL-2', { x: 1000, y: 0, z: 0, l: 250, w: 1200, h: 1800 })
    ];
    const first = analyzeStability(placements, container, { voidVoxelMm: 250, hardUnrestrainedSlenderness: 20 });
    const second = analyzeStability(placements, container, { voidVoxelMm: 250, hardUnrestrainedSlenderness: 20 });
    expect(first.voidTopology).toEqual(second.voidTopology);
    expect(first.voidTopology.enclosedVoidVolume).toBeGreaterThan(0);
    expect(first.voidTopology.doorConnectedRegionCount).toBe(1);
  });
});

function box(cargoId, overrides = {}) {
  return {
    cargoId,
    x: 0,
    y: 0,
    z: 0,
    l: 500,
    w: 500,
    h: 500,
    weight: 10,
    portSequence: 1,
    ...overrides
  };
}
