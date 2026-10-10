'use strict';

const { buildShipmentReadiness, DOMAIN_ORDER } = require('../../services/realworld/ShipmentReadinessService');

describe('ShipmentReadinessService V2.5', () => {
  test('returns five business domains and treats unavailable terminal state as external confirmation', () => {
    const result = buildShipmentReadiness({
      container: { innerLength: 12000, innerWidth: 2350, innerHeight: 2690, maxWeight: 26000 },
      cargoList: [{ cargoId: 'C1', name: '纸箱', weight: 100, quantity: 1, packagingType: 'CARTON', portSequence: 1 }],
      placements: [{ cargoId: 'C1_1', weight: 100, x: 0, y: 0, z: 0, l: 1000, w: 1000, h: 1000, portSequence: 1, handlingMethod: 'manual' }],
      validator: { checks: { stack: true, carrying: true }, stability: { invalidCount: 0 } },
      voidJustification: { unexplainedVoidVolume: 0, zones: [] },
      portAccessibility: { status: 'FULL_UNLOAD_PASS', blockedCount: 0, rehandleCount: 0, postUnloadStabilityPass: true, calls: [] },
      loadDistribution: { centreOfGravity: { guidanceStatus: 'WITHIN_GENERAL_GUIDANCE', lateralOffsetPercent: 0, longitudinalOffsetPercent: 0 }, segments: { longitudinal: [] } },
      securing: { status: 'SECURING_NOT_REQUIRED' }
    });
    expect(result.domains.map((domain) => domain.id)).toEqual(DOMAIN_ORDER);
    const terminal = result.evidence.find((item) => item.id === 'CONDITION-TERMINAL');
    expect(terminal.status).toBe('EXTERNAL_CONFIRMATION_REQUIRED');
    expect(terminal.source).toBe('NO_LIVE_TERMINAL_API');
    expect(result.uiPolicy).toEqual(expect.objectContaining({ passedCollapsed: true, notApplicableHidden: true }));
    expect(result.evidence.every((item) => ['id', 'domain', 'title', 'status', 'currentValue', 'limit', 'comparison', 'summary', 'detail', 'ruleReferences', 'inputReferences', 'spaceEvidence', 'requiredAction', 'responsibility'].every((key) => Object.prototype.hasOwnProperty.call(item, key)))).toBe(true);
  });
});
