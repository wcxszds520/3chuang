const { PackingCaseService, normalizeInput, mapRow, normalizePlanSource } = require('../../services/PackingCaseService');

describe('PackingCaseService', () => {
  it('creates, reads, updates and lists the same cross-device snapshot', async () => {
    const db = createMemoryDb();
    const service = new PackingCaseService(db);
    const created = await service.create({
      caseId: 'NB2026-CASE-001',
      cargoSnapshot: [{ cargoId: 'C1', sku: 'SKU-1', quantity: 1 }],
      containerType: '40HQ',
      packingPlanId: 'REQ_PLAN_001',
      packingPlan: { planId: 'REQ_PLAN_001', sourceCode: 'BACKEND_SOLVED', loadedCargo: [{ cargoId: 'C1', x: 0, y: 0, z: 0, l: 1, w: 1, h: 1 }] },
      complianceSummary: { status: 'WARNING', source: 'deterministic-rules' },
      caseContext: { caseDate: '2026-08-24', terminal: 'NBSCT' },
      sourceCode: 'BACKEND_SOLVED',
      status: 'SOLVED'
    });

    expect(created).toMatchObject({
      caseId: 'NB2026-CASE-001',
      packingPlanId: 'REQ_PLAN_001',
      sourceCode: 'BACKEND_SOLVED',
      status: 'SOLVED',
      cargoSnapshot: [{ sku: 'SKU-1' }],
      packingPlan: { loadedCargo: [{ x: 0, y: 0, z: 0, l: 1, w: 1, h: 1 }] }
    });

    const updated = await service.update(created.caseId, { status: 'ANALYZED' });
    expect(updated.status).toBe('ANALYZED');
    expect(updated.packingPlan.loadedCargo[0].cargoId).toBe('C1');
    expect(await service.list()).toHaveLength(1);
    expect(await service.list()).toEqual([expect.objectContaining({
      caseId: 'NB2026-CASE-001',
      containerType: '40HQ',
      sourceCode: 'BACKEND_SOLVED',
      status: 'ANALYZED'
    })]);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS packing_case'));
  });

  it('rejects invalid identity, status and cargo snapshots', () => {
    expect(() => normalizeInput({ caseId: '../bad', cargoSnapshot: [], containerType: '40HQ' })).toThrow('caseId 无效');
    expect(() => normalizeInput({ caseId: 'CASE_OK', cargoSnapshot: {}, containerType: '40HQ' })).toThrow('cargoSnapshot 必须是数组');
    expect(() => normalizeInput({ caseId: 'CASE_OK', cargoSnapshot: [], containerType: '40HQ', status: 'MAGIC' })).toThrow('status 无效');
  });

  it('normalizes legacy plan sources and accepts independent workflow decisions', () => {
    expect(normalizePlanSource('backend')).toBe('BACKEND_SOLVED');
    expect(normalizePlanSource('untrusted')).toBe('UNKNOWN');
    expect(normalizeInput({
      caseId: 'CASE_REVIEW', cargoSnapshot: [], containerType: '40HQ',
      sourceCode: 'local-preview', status: 'REVIEWED_WITH_CONDITIONS'
    })).toMatchObject({ sourceCode: 'LOCAL_PREVIEW', status: 'REVIEWED_WITH_CONDITIONS' });
  });

  it('maps MySQL JSON values without changing placement coordinates', () => {
    const row = mapRow({
      case_id: 'CASE_MAP',
      cargo_snapshot: JSON.stringify([{ cargoId: 'C1' }]),
      container_type: '20GP',
      packing_plan_id: 'PLAN_MAP',
      plan_snapshot: JSON.stringify({ loadedCargo: [{ x: 11, y: 22, z: 33, l: 44, w: 55, h: 66 }] }),
      compliance_snapshot: JSON.stringify({ status: 'PASS' }),
      source_code: 'BACKEND_SOLVED',
      status: 'REVIEWED',
      created_at: '2026-08-08T00:00:00.000Z',
      updated_at: '2026-08-08T01:00:00.000Z'
    });
    expect(row.packingPlan.loadedCargo[0]).toEqual({ x: 11, y: 22, z: 33, l: 44, w: 55, h: 66 });
  });
});

function createMemoryDb() {
  const rows = new Map();
  return {
    query: jest.fn(async (sql, params = []) => {
      if (sql.includes('CREATE TABLE')) return [[], []];
      if (sql.includes('ALTER TABLE')) return [[], []];
      if (sql.startsWith('UPDATE packing_case SET')) {
        const id=params[9], old=rows.get(id);
        if (!old) return [{affectedRows:0},[]];
        rows.set(id,{...old,cargo_snapshot:params[0],container_type:params[1],packing_plan_id:params[2],plan_snapshot:params[3],compliance_snapshot:params[4],context_snapshot:params[5],admission_snapshot:params[6],source_code:params[7],status:params[8]});
        return [{affectedRows:1},[]];
      }
      if (sql.includes('INSERT INTO packing_case')) {
        const existing = rows.get(params[0]);
        const now = new Date().toISOString();
        rows.set(params[0], {
          case_id: params[0], cargo_snapshot: params[1], container_type: params[2], packing_plan_id: params[3],
          plan_snapshot: params[4], compliance_snapshot: params[5], context_snapshot: params[6], admission_snapshot: params[7], source_code: params[8], status: params[9],
          created_at: existing?.created_at || now, updated_at: now
        });
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('WHERE case_id = ?')) return [[rows.get(params[0])].filter(Boolean), []];
      if (sql.includes('ORDER BY updated_at')) return [[...rows.values()], []];
      throw new Error(`Unexpected SQL: ${sql}`);
    })
  };
}
