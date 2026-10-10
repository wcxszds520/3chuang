'use strict';

const { buildShipmentReadiness } = require('../../services/realworld/ShipmentReadinessService');
const { validatePortAccessibility } = require('../../services/realworld/PortAccessibilityValidator');
const PlanValidator = require('../../services/packing/PlanValidator');

const container = { innerLength: 3000, innerWidth: 2400, innerHeight: 2400, maxWeight: 20000, doorWidth: 2300, doorHeight: 2300 };
const placements = [{ cargoId: 'C1_1', sourceCargoId: 'C1', weight: 20, x: 2000, y: 0, z: 900, l: 500, w: 500, h: 500, portSequence: 1, handlingMethod: 'manual' }];
const input = extra => ({ container, placements: structuredClone(placements), ...extra });
const evidence = (data, id) => buildShipmentReadiness(data).evidence.find(item => item.id === id);

describe('shipment readiness requires current evidence in every solver mode', () => {
  test.each(['PORTCUBE_BUSINESS_SIMULATION', 'COMMERCE', undefined])('missing analysis is unknown for mode %s', solverMode => {
    const data = input({ plan: { solverMode } });
    for (const id of ['SPACE-VOID', 'SPACE-STACKING', 'LOAD-STABILITY', 'LOAD-DISTRIBUTION', 'PORT-ACCESS']) {
      expect(evidence(data, id).status).toBe('DATA_REQUIRED');
    }
    expect(evidence(data, 'LOAD-STABILITY').currentValue).toEqual({ initialInvalid: null, postUnloadPass: null });
    expect(evidence(data, 'PORT-ACCESS').currentValue).toMatchObject({ blockedCount: null, rehandleCount: null });
  });

  test('local-plan initial validation alone cannot certify post-unload stability or operations', () => {
    const validator = new PlanValidator().validate({ placements, container });
    const result = input({ plan: { solverMode: 'PORTCUBE_BUSINESS_SIMULATION', validator } });
    expect(evidence(result, 'SPACE-STACKING').status).toBe('READY');
    expect(evidence(result, 'LOAD-STABILITY').status).toBe('DATA_REQUIRED');
    expect(evidence(result, 'LOAD-STABILITY').currentValue).toEqual({ initialInvalid: 0, postUnloadPass: null });
    expect(evidence(result, 'PORT-ACCESS').status).toBe('DATA_REQUIRED');
  });

  test('fresh complete validator and unload replay preserve planning readiness', () => {
    const validator = new PlanValidator().validate({ placements, container });
    const portAccessibility = validatePortAccessibility({ placements, container });
    expect(portAccessibility.status).toBe('FULL_UNLOAD_PASS');
    expect(portAccessibility.calls).toHaveLength(1);
    for (const solverMode of ['PORTCUBE_BUSINESS_SIMULATION', 'COMMERCE']) {
      const data = input({ plan: { solverMode, validator, portAccessibility }, voidJustification: { unexplainedVoidVolume: 0 } });
      for (const id of ['SPACE-VOID', 'SPACE-STACKING', 'LOAD-STABILITY', 'PORT-ACCESS', 'PORT-HANDLING']) {
        expect(evidence(data, id).status).toBe('READY');
      }
    }
  });

  test.each([undefined, null, '', NaN, -1])('invalid void report %s is not zero unexplained space', value => {
    expect(evidence(input({ voidJustification: { unexplainedVoidVolume: value } }), 'SPACE-VOID').status).toBe('DATA_REQUIRED');
  });

  test('an aggregate pass flag without stage evidence does not certify loaded cargo', () => {
    const data = input({ validator: { stability: { invalidCount: 0 } }, portAccessibility: {
      status: 'FULL_UNLOAD_PASS', blockedCount: 0, rehandleCount: 0, postUnloadStabilityPass: true, calls: []
    } });
    expect(evidence(data, 'LOAD-STABILITY').status).toBe('DATA_REQUIRED');
    expect(evidence(data, 'PORT-ACCESS').status).toBe('DATA_REQUIRED');
  });

  test('known failures take precedence over missing evidence and contradictory aggregate flags', () => {
    const data = input({ validator: { checks: { stack: false }, stability: { invalidCount: 2 } }, portAccessibility: {
      status: 'FULL_UNLOAD_PASS', blockedCount: 1, rehandleCount: 0, postUnloadStabilityPass: true,
      calls: [{ postUnloadStability: { invalidCount: 1 } }]
    } });
    expect(evidence(data, 'SPACE-STACKING').status).toBe('BLOCKED');
    expect(evidence(data, 'LOAD-STABILITY').status).toBe('BLOCKED');
    expect(evidence(data, 'LOAD-STABILITY').currentValue.postUnloadPass).toBe(false);
    expect(evidence(data, 'LOAD-STABILITY').summary).toContain('2 项');
    expect(evidence(data, 'PORT-ACCESS').status).toBe('BLOCKED');
  });

  test('a recorded operation failure is blocked even without a complete replay', () => {
    for (const report of [{ lifoCompliant: false }, { accessPass: false }, { rehandleCount: 1 }, { status: 'PORT_ACCESS_BLOCKED' }]) {
      expect(evidence(input({ portAccessibility: report }), 'PORT-ACCESS').status).toBe('BLOCKED');
    }
  });

  test('missing per-cargo handling method remains data required', () => {
    const data = input({ placements: [{ ...placements[0], handlingMethod: undefined }] });
    expect(evidence(data, 'PORT-HANDLING').status).toBe('DATA_REQUIRED');
    expect(evidence(input({ handlingAssumptions: [{ cargoId: 'C1_1' }] }), 'PORT-HANDLING').status).toBe('EXTERNAL_CONFIRMATION_REQUIRED');
  });
});
