import { describe, expect, it, vi } from 'vitest';
import { apiRequest, unwrapApiData } from './apiClient.js';
import { buildPackingRequest, normalizeBackendPlan } from './packingApi.js';
import { adaptAiComplianceReport, buildCompliancePayload } from './complianceApi.js';
import { createInitialSession } from '../domain/session/initialSession.js';
import { getContainer } from '../domain/container/catalog.js';
import { generateLocalPreview } from '../domain/container/localPreview.js';

const session = createInitialSession();
const container = getContainer('40HQ');
const preview = generateLocalPreview(session.cargo, container);

describe('API service contracts', () => {
  it('unwraps the universal API envelope and preserves backend errors', async () => {
    const okFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ code: 200, data: { value: 7 } }) }));
    expect(unwrapApiData(await apiRequest('/ok', {}, { fetchImpl: okFetch }))).toEqual({ value: 7 });

    const failFetch = vi.fn(async () => ({ ok: false, status: 422, json: async () => ({ code: 422, message: 'bad cargo' }) }));
    await expect(apiRequest('/fail', {}, { fetchImpl: failFetch })).rejects.toMatchObject({ reason: 'backend', status: 422, message: 'bad cargo' });
  });

  it('builds the locked packing request and never mutates returned coordinates', () => {
    const request = buildPackingRequest({ containerType: '40HQ', cargoList: session.cargo, algorithmId: 'realistic4d-multi-strategy' });
    expect(request.options.algorithmId).toBe('hybrid-v2.5');
    expect(request.strategy).toBe('space');
    expect(request.cargoList[0]).toMatchObject({
      sku: 'SKU-ACC-01',
      destinationPort: 'Hamburg',
      portSequence: 1,
      batchId: 'BATCH-HAM-A',
      handlingMethod: 'manual',
      source: 'demo-dataset-a'
    });

    const original = { ...preview.loadedCargo[0], x: 987.5 };
    const result = normalizeBackendPlan({ code: 200, data: { ...preview, loadedCargo: [original] } }, {
      containerType: '40HQ', cargoList: session.cargo, algorithmId: 'realistic4d-multi-strategy'
    });
    expect(result.loadedCargo[0].x).toBe(987.5);
    expect(result.source).toBe('backend');
    expect(result.inputFingerprint).toHaveLength(8);
  });

  it('builds declared VGM and keeps backend rule authority separate from AI explanation', () => {
    const body = buildCompliancePayload(preview, session.cargo, container, true);
    expect(body.declaredVGM).toBe(Math.round(preview.totalWeight + container.tareWeight));
    const report = adaptAiComplianceReport({ data: { complianceReport: {
      status: 'warning', score: 82, reportTable: [{ dimension: 'VGM', standard: '提交', actual: '待核', result: 'WARNING' }]
    } } });
    expect(report).toMatchObject({ status: 'WARNING', score: 82, source: 'backend-deterministic-with-ai-explanation' });
    expect(report.rows[0].sourceRef).toContain('确定性规则');
  });
});
