import { describe, expect, it, vi } from 'vitest';
import { buildPackingCasePayload, getPackingCase, savePackingCase, updatePackingCase } from './caseApi.js';
import { createInitialSession } from '../domain/session/initialSession.js';

describe('shared packing case API', () => {
  it('builds one snapshot without changing placement coordinates or provenance', () => {
    const session = createInitialSession();
    const plan = {
      planId: 'REQ_CASE_1', source: 'backend', sourceCode: 'BACKEND_SOLVED',
      loadedCargo: [{ cargoId: 'C1', x: 1, y: 2, z: 3, l: 4, w: 5, h: 6 }]
    };
    const payload = buildPackingCasePayload({ session, plan });
    expect(payload).toMatchObject({
      caseId: session.order.orderNo,
      containerType: '40HQ',
      packingPlanId: 'REQ_CASE_1',
      sourceCode: 'BACKEND_SOLVED',
      status: 'SOLVED'
    });
    expect(payload.packingPlan.loadedCargo[0]).toEqual(plan.loadedCargo[0]);
    expect(payload.cargoSnapshot).toHaveLength(session.cargo.length);
  });

  it('uses the create, read and update case endpoints', async () => {
    const responses = [
      { code: 200, data: { caseId: 'CASE_1', status: 'SOLVED' } },
      { code: 200, data: { caseId: 'CASE_1', status: 'SOLVED' } },
      { code: 200, data: { caseId: 'CASE_1', status: 'ANALYZED' } }
    ];
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => responses.shift() }));
    await expect(savePackingCase({ caseId: 'CASE_1' }, { fetchImpl })).resolves.toMatchObject({ status: 'SOLVED' });
    await expect(getPackingCase('CASE_1', { fetchImpl })).resolves.toMatchObject({ caseId: 'CASE_1' });
    await expect(updatePackingCase('CASE_1', { status: 'ANALYZED' }, { fetchImpl })).resolves.toMatchObject({ status: 'ANALYZED' });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual(['/api/cases', '/api/cases/CASE_1', '/api/cases/CASE_1']);
  });
});
