const HybridConstraintPackingSolverV2 = require('../../services/HybridConstraintPackingSolverV2');

const container = { typeId: '20GP', innerLength: 5898, innerWidth: 2352, innerHeight: 2393, maxWeight: 21770 };
const cargoList = [
  { cargoId: 'LATE', sku: 'late', name: '后卸设备', length: 600, width: 400, height: 350, weight: 25, quantity: 8, stackable: true, maxStackLayers: 4, portSequence: 2, handlingMethod: 'forklift' },
  { cargoId: 'EARLY', sku: 'early', name: '先卸配件', length: 500, width: 350, height: 300, weight: 8, quantity: 12, stackable: true, maxStackLayers: 5, portSequence: 1, handlingMethod: 'manual' }
];

describe('HybridConstraintPackingSolverV2', () => {
  test.each(['SPACE', 'BALANCE', 'OPERATION'])('returns a validator-approved %s plan with complete evidence', async (strategy) => {
    const result = await new HybridConstraintPackingSolverV2({ lookaheadDepth: 2 }).generatePackingPlan(cargoList, container, { strategy });
    expect(result.loadedCargo).toHaveLength(20);
    expect(result.unloadedCargo).toHaveLength(0);
    expect(result.validator.status).toBe('VALID');
    expect(result.metrics.strategy).toBe(strategy);
    expect(result.metrics.compactness.boundingCompactness).toBeGreaterThan(0);
    expect(result.metrics.operation.totalCost).toBeGreaterThanOrEqual(0);
    expect(result.loadedCargo[0].candidateTrace.accepted.status).toBe('SELECTED');
    expect(result.loadedCargo[0].candidateTrace.rejected.length).toBeLessThanOrEqual(3);
    expect(['BLOCK', 'EXTREME_POINT', 'RESIDUAL_SPACE']).toContain(result.loadedCargo[0].candidateTrace.accepted.source);
  });

  test('is deterministic for identical input and strategy', async () => {
    const first = await new HybridConstraintPackingSolverV2({ lookaheadDepth: 2 }).generatePackingPlan(cargoList, container, { strategy: 'BALANCE' });
    const second = await new HybridConstraintPackingSolverV2({ lookaheadDepth: 2 }).generatePackingPlan(cargoList, container, { strategy: 'BALANCE' });
    expect(first.loadedCargo.map(position)).toEqual(second.loadedCargo.map(position));
    expect(first.metrics.cog).toEqual(second.metrics.cog);
  });

  test('keeps utilization truthful when every strategy loads the same cargo', async () => {
    const results = await Promise.all(['SPACE', 'BALANCE', 'OPERATION'].map((strategy) => (
      new HybridConstraintPackingSolverV2({ lookaheadDepth: 2 }).generatePackingPlan(cargoList, container, { strategy })
    )));
    expect(new Set(results.map((result) => result.metrics.loadedVolume)).size).toBe(1);
    expect(new Set(results.map((result) => result.metrics.volumeUtilization)).size).toBe(1);
  });

  test('filters illegal candidates before scoring and preserves orientation semantics', async () => {
    const result = await new HybridConstraintPackingSolverV2({ lookaheadDepth: 2 }).generatePackingPlan([
      { cargoId: 'FIXED', sku: 'fixed', name: '固定朝向', length: 700, width: 300, height: 400, weight: 10, quantity: 2, canRotate: false, canLayFlat: false, stackable: false, maxStackLayers: 1, portSequence: 1 }
    ], container, { strategy: 'SPACE' });
    expect(result.loadedCargo.every((item) => item.orientation === 'XYZ')).toBe(true);
    expect(result.loadedCargo.every((item) => item.l === 700 && item.w === 300 && item.h === 400)).toBe(true);
    expect(result.validator.status).toBe('VALID');
  });
});

function position(item) {
  return { cargoId: item.cargoId, x: item.x, y: item.y, z: item.z, l: item.l, w: item.w, h: item.h, orientation: item.orientation };
}
