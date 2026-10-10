import { describe, expect, it, vi } from 'vitest';
import { replanPackingPlan } from './packingApi.js';

describe('replan API boundary', () => {
  it('sends exact previous placements and the new input to the replan endpoint', async () => {
    const previousPlan = { planId: 'OLD', loadedCargo: [{ cargoId: 'A-1', x: 10, y: 0, z: 50, orientation: 'LWH' }] };
    const previousCargo = [{ cargoId: 'A', length: 500, width: 500, height: 400, quantity: 1, weight: 20 }];
    const cargoList = [{ ...previousCargo[0], width: 600 }];
    const result = { planId: 'NEW', loadedCargo: [{ ...previousPlan.loadedCargo[0], x: 80 }], containerInfo: { typeId: '20GP' }, replan: { method: 'LOCAL_REPAIR' } };
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ code: 200, data: result }) }));
    const normalized = await replanPackingPlan({ containerType: '20GP', cargoList, previousPlan, previousCargo, reason: '宽度变更' }, { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/packing/replan');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.previousPlan).toEqual(previousPlan);
    expect(body.previousCargo).toEqual(previousCargo);
    expect(body.cargoList[0].width).toBe(600);
    expect(normalized.loadedCargo[0].x).toBe(80);
    expect(normalized.replan.method).toBe('LOCAL_REPAIR');
    expect(previousPlan.loadedCargo[0].x).toBe(10);
  });

  it('requires an actual previous plan and preserves unsupported errors', async () => {
    await expect(replanPackingPlan({ previousPlan: null })).rejects.toThrow('上一版正式方案');
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 422, json: async () => ({ code: 422, message: 'SOURCE_REPLAN_UNSUPPORTED' }) }));
    await expect(replanPackingPlan({ containerType: '20GP', cargoList: [], previousPlan: { planId: 'OLD' } }, { fetchImpl })).rejects.toMatchObject({ status: 422, message: 'SOURCE_REPLAN_UNSUPPORTED' });
  });
});
