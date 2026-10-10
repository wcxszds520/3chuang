'use strict';

const FloorExtremePointCandidate = require('../../services/packing/FloorExtremePointCandidate');
const { analyzeOperationFeasibility } = require('../../services/packing/CanonicalOperationFeasibility');
const { buildTinyOracleCases } = require('../../benchmarks/tinyOracleCases');

describe('bounded floor extreme-point candidate', () => {
  test('recovers an operation-feasible four-item layout missed by the layer-only candidate', () => {
    const benchmarkCase = buildTinyOracleCases(3)[2];
    const first = new FloorExtremePointCandidate().build(benchmarkCase.cargoList, benchmarkCase.container);
    const second = new FloorExtremePointCandidate().build(benchmarkCase.cargoList, benchmarkCase.container);
    expect(first.placements).toEqual(second.placements);
    expect(first.placements).toHaveLength(4);
    expect(analyzeOperationFeasibility({ placements: first.placements, container: benchmarkCase.container }).blockedCount).toBe(0);
  });
});
