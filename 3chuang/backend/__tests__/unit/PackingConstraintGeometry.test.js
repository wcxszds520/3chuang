'use strict';

const { calculateSupport } = require('../../services/packing/SupportGeometry');
const { evaluateInsertionPath } = require('../../services/packing/InsertionPathFeasibility');

describe('packing constraint geometry', () => {
  test('calculates real bottom-face intersection support ratio', () => {
    const candidate = { x: 0, y: 100, z: 0, l: 100, w: 100, h: 50 };
    const support = calculateSupport(candidate, [{ cargoId: 'S', x: 0, y: 0, z: 0, l: 50, w: 100, h: 100 }]);
    expect(support.supportedArea).toBe(5000);
    expect(support.ratio).toBe(0.5);
  });

  test('checks the high-X insertion segment against loaded AABBs', () => {
    const container = { innerLength: 1000, innerWidth: 400, innerHeight: 400 };
    const candidate = { x: 100, y: 0, z: 0, l: 100, w: 100, h: 100 };
    const blocker = { cargoId: 'BLOCK', x: 600, y: 0, z: 0, l: 100, w: 100, h: 100 };
    expect(evaluateInsertionPath(candidate, [blocker], container).feasible).toBe(false);
    expect(evaluateInsertionPath({ ...candidate, z: 200 }, [blocker], container).feasible).toBe(true);
  });
});
