'use strict';

const { analyzeLayoutQuality } = require('../../services/packing/LayoutQualityAnalyzer');
const { analyzeSecuring } = require('../../services/packing/SecuringAnalyzer');
const { analyzeOperationFeasibility, canonicalLoadingSequence, validateActorCargo } = require('../../services/packing/CanonicalOperationFeasibility');

const container = { typeId: 'TEST', innerLength: 1000, innerWidth: 1000, innerHeight: 1000, maxWeight: 10000 };

describe('Competition 2.3 physical packing metrics', () => {
  test('integrates narrow cavities at physical faces instead of missing them between sample centres', () => {
    const {analyzeCrossSections,DEFAULT_POLICY}=require('../../services/packing/LayoutQualityAnalyzer');
    const placements=[{...box('A',0),l:490},{...box('B',510),l:490}];
    const a=analyzeCrossSections(placements,container,{...DEFAULT_POLICY,crossSectionSliceMm:100});
    const b=analyzeCrossSections(placements,container,{...DEFAULT_POLICY,crossSectionSliceMm:70});
    expect(a.fragmentedVoidVolume).toBe(20_000_000);
    expect(b.fragmentedVoidVolume).toBe(a.fragmentedVoidVolume);
    expect(a.mean).toBeCloseTo(0.98,12);
  });
  test('distinguishes a controlled edge reserve from an equal-volume fragmented interior gap', () => {
    const cargoList = [{ cargoId: 'BOX', sku: 'BOX', length: 400, width: 1000, height: 1000, quantity: 2, canRotate: false }];
    const compact = [box('A', 0), box('B', 400)];
    const fragmented = [box('A', 0), box('B', 600)];
    const compactQuality = analyzeLayoutQuality({ placements: compact, cargoList, container, policy: { crossSectionSliceMm: 100 } });
    const fragmentedQuality = analyzeLayoutQuality({ placements: fragmented, cargoList, container, policy: { crossSectionSliceMm: 100 } });

    expect(compactQuality.internalVoidVolume).toBe(0);
    expect(fragmentedQuality.internalVoidVolume).toBeCloseTo(200_000_000, -3);
    expect(fragmentedQuality.lowFillInteriorSliceCount).toBeGreaterThan(compactQuality.lowFillInteriorSliceCount);
    expect(fragmentedQuality.largestContiguousReserve).toBeLessThan(compactQuality.largestContiguousReserve);
  });

  test('reports geometric stability separately from a blocking-plane requirement', () => {
    const placements = [box('A', 0), box('B', 400)];
    const quality = analyzeLayoutQuality({ placements, container, cargoList: [] });
    const securing = analyzeSecuring({ placements, container, layoutQuality: quality });
    expect(securing.status).toBe('SECURING_REQUIRED');
    expect(securing.required).toBe(true);
    expect(securing.securingPlaneCount).toBe(1);
    expect(securing.zones[0]).toMatchObject({ axis: 'x', direction: 'door', type: 'BLOCKING_PLANE_REQUIRED' });
  });

  test('uses wall-first lateral order and completes the canonical door-clearance path', () => {
    const operationContainer = { innerLength: 12032, innerWidth: 2352, innerHeight: 2698 };
    const placements = [
      operationBox('LEFT', 6),
      operationBox('CENTRE', 786),
      operationBox('RIGHT', 1566)
    ];
    const sequence = canonicalLoadingSequence(placements, operationContainer);
    expect(sequence.map((item) => item.cargoId)).toEqual(['LEFT', 'RIGHT', 'CENTRE']);
    const result = analyzeOperationFeasibility({ placements, container: operationContainer });
    expect(result).toMatchObject({ cargoInsertionPass: true, operationPathPass: true, blockedCount: 0 });
  });

  test('does not overshoot a door-adjacent stacked target before lowering it', () => {
    const operationContainer = { innerLength: 12032, innerWidth: 2352, innerHeight: 2698 };
    const placements = [
      { ...operationBox('LOWER', 100), x: 11382, y: 0, w: 560, h: 520 },
      { ...operationBox('UPPER', 100), x: 11382, y: 520, w: 560, h: 520 }
    ];
    const result = analyzeOperationFeasibility({ placements, container: operationContainer });
    expect(result).toMatchObject({ cargoInsertionPass: true, operationPathPass: true, blockedCount: 0 });
  });

  test('applies the same manual-handling orientation boundary as the web operation machine', () => {
    expect(validateActorCargo({ handlingMethod: 'manual', l: 1200, w: 100, h: 900, weight: 15 })).toEqual({ valid: true, reasons: [] });
    const invalid = validateActorCargo({ handlingMethod: 'manual', l: 900, w: 100, h: 1200, weight: 15 });
    expect(invalid.valid).toBe(false);
    expect(invalid.reasons[0].code).toBe('MANUAL_CAPACITY_EXCEEDED');
  });
});

function box(cargoId, x) {
  return { cargoId, sku: 'BOX', x, y: 0, z: 0, l: 400, w: 1000, h: 1000, weight: 10, loadingIndex: cargoId === 'A' ? 1 : 2 };
}

function operationBox(cargoId, z) {
  return { cargoId, sku: cargoId, x: 0, y: 0, z, l: 650, w: 780, h: 650, weight: 35 };
}
