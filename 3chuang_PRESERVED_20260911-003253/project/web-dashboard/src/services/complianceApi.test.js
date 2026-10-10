import { describe, expect, it } from 'vitest';
import { fetchRegulationDetail } from './complianceApi.js';

describe('regulation detail contract', () => {
  it('rejects an empty detail response with a recoverable explicit error', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ code: 200, data: null }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
    await expect(fetchRegulationDetail('empty', { fetchImpl, timeoutMs: 100 }))
      .rejects.toMatchObject({ reason: 'contract', message: expect.stringContaining('本地 PDF 证据仍可用') });
  });
});
