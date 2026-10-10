'use strict';

const { buildTinyOracleCases } = require('../../benchmarks/tinyOracleCases');
const { solveTinyFloorPacking } = require('../../benchmarks/TinyFloorPackingOracle');

describe('tiny exact floor-packing oracle', () => {
  test('is deterministic and returns collision-free exact placements', () => {
    const cases = buildTinyOracleCases(20);
    expect(cases).toHaveLength(20);
    expect(cases).toEqual(buildTinyOracleCases(20));
    for (const benchmarkCase of cases) {
      const first = solveTinyFloorPacking(benchmarkCase.cargoList, benchmarkCase.container);
      const second = solveTinyFloorPacking(benchmarkCase.cargoList, benchmarkCase.container);
      expect(first).toEqual(second);
      expect(first.exact).toBe(true);
      expect(first.loadedCount).toBeGreaterThan(0);
      expect(first.loadedCount).toBeLessThanOrEqual(benchmarkCase.cargoList.length);
    }
  });

  test('keeps raw and accepted optima separate', () => {
    const benchmarkCase = buildTinyOracleCases(1)[0];
    const result = solveTinyFloorPacking(benchmarkCase.cargoList, benchmarkCase.container, {
      acceptedModel: 'MAXIMUM_TWO_ITEMS',
      acceptPlacements: (placements) => placements.length <= 2
    });
    expect(result.loadedCount).toBe(4);
    expect(result.acceptedLoadedCount).toBe(2);
    expect(result.acceptedModel).toBe('MAXIMUM_TWO_ITEMS');
  });
});
