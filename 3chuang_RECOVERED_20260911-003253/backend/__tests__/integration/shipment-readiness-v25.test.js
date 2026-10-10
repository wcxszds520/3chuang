'use strict';

jest.mock('../../config/database', () => ({ query: jest.fn(), end: jest.fn() }));

const request = require('supertest');
const { app } = require('../../server');

describe('POST /api/packing/shipment-readiness', () => {
  test('returns backend-owned five-domain DecisionEvidence truth', async () => {
    const response = await request(app)
      .post('/api/packing/shipment-readiness')
      .send({
        container: { innerLength: 12000, innerWidth: 2350, innerHeight: 2690, maxWeight: 26000 },
        cargoList: [{ cargoId: 'API-C1', name: 'API 纸箱', length: 800, width: 600, height: 500, weight: 12, quantity: 1, packagingType: 'CARTON', portSequence: 1 }],
        placements: [{ cargoId: 'API-C1_1', sourceCargoId: 'API-C1', x: 0, y: 0, z: 0, l: 800, w: 600, h: 500, weight: 12, portSequence: 1, handlingMethod: 'manual' }],
        validator: { checks: { stack: true, carrying: true }, stability: { invalidCount: 0 } },
        voidJustification: { unexplainedVoidVolume: 0, zones: [] },
        portAccessibility: { status: 'FULL_UNLOAD_PASS', blockedCount: 0, rehandleCount: 0, postUnloadStabilityPass: true, calls: [] },
        loadDistribution: { centreOfGravity: { guidanceStatus: 'WITHIN_GENERAL_GUIDANCE', lateralOffsetPercent: 0, longitudinalOffsetPercent: 0 }, segments: { longitudinal: [] } },
        securing: { status: 'SECURING_NOT_REQUIRED' }
      })
      .expect(200);
    expect(response.body.data.model).toBe('PORTCUBE_SHIPMENT_READINESS_V2_5');
    expect(response.body.data.domains).toHaveLength(5);
    expect(response.body.data.evidence.find((item) => item.id === 'CONDITION-TERMINAL').status).toBe('EXTERNAL_CONFIRMATION_REQUIRED');
  });
});
