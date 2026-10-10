'use strict';

const { analyzeLayoutQuality } = require('../../services/packing/LayoutQualityAnalyzer');
const { analyzeVoidJustification, VOID_CLASSES } = require('../../services/packing/VoidJustificationAnalyzer');

describe('VoidJustificationAnalyzer V2.5', () => {
  test('classifies every material zone and exposes refillable void as unexplained space', () => {
    const container = { innerLength: 1200, innerWidth: 1000, innerHeight: 1000, maxWeight: 10000 };
    const cargoList = [
      { cargoId: 'A', length: 300, width: 1000, height: 500, weight: 100, quantity: 1, canRotate: true },
      { cargoId: 'B', length: 300, width: 1000, height: 500, weight: 100, quantity: 1, canRotate: true },
      { cargoId: 'FILL', length: 200, width: 200, height: 200, weight: 10, quantity: 1, canRotate: true }
    ];
    const placements = [
      { cargoId: 'A_1', x: 0, y: 0, z: 0, l: 300, w: 1000, h: 500, weight: 100, portSequence: 1 },
      { cargoId: 'B_1', x: 700, y: 0, z: 0, l: 300, w: 1000, h: 500, weight: 100, portSequence: 1 }
    ];
    const layoutQuality = analyzeLayoutQuality({ placements, cargoList, container });
    const result = analyzeVoidJustification({ placements, cargoList, container, layoutQuality });
    expect(VOID_CLASSES).toContain('UNEXPLAINED_VOID');
    expect(result.zones.every((zone) => VOID_CLASSES.includes(zone.classification))).toBe(true);
    expect(result.unexplainedVoidVolume).toBeGreaterThan(0);
    expect(result.zones.some((zone) => zone.classification === 'UNEXPLAINED_VOID' && zone.label === '未解释剩余空间')).toBe(true);
  });
});
