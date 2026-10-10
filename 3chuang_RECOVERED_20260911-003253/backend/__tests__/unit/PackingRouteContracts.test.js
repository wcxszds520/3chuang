const request = require('supertest');
const express = require('express');
const mockExecute = jest.fn();
const mockQuery = jest.fn();
const mockReplan = jest.fn();
jest.mock('../../services/AlgorithmOrchestrator', () => jest.fn().mockImplementation(() => ({ execute: mockExecute })));
jest.mock('../../config/database', () => ({ query: (...args) => mockQuery(...args) }));
jest.mock('../../services/packing/ReplanService', () => ({ replan: (...args) => mockReplan(...args) }));
jest.mock('../../services/ResultCache', () => jest.fn());
jest.mock('../../services/ComplianceTaskManager', () => jest.fn());
jest.mock('../../services/AIComplianceService', () => ({ generateComplianceReport: jest.fn().mockResolvedValue({ status: 'ACTION_REQUIRED', issues: [] }) }));

const app = express();
app.use(express.json());
app.use(require('../../middleware/response'));
app.use('/packing', require('../../routes/packing'));
app.use('/ai-packing', require('../../routes/ai-packing'));
const cargo = { cargoId: 'c', name: '测试木箱', length: 600, width: 500, height: 400, weight: 100, quantity: 1,
  packagingType: 'WOOD_CRATE', stackable: false, canRotate: false, canInvert: false, canLayFlat: false };
const body = () => ({ cargoList: [cargo], containerType: '20GP', options: { includeAiExplanation: false } });
const inserts = () => mockQuery.mock.calls.filter(([sql]) => sql.startsWith('INSERT'));

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockResolvedValue([[], []]);
  mockExecute.mockResolvedValue({ success: true, loadedCargo: [{ ...cargo, cargoId: 'c_1', sourceCargoId: 'c',
    x: 0, y: 0, z: 0, l: 600, w: 500, h: 400, orientationId: 'LWH' }], unloadedCargo: [],
    totalWeight: 100, metrics: { space_utilization: 1 }, cogOffset: { lateral: 0, longitudinal: 0 },
    validator: { valid: true, checks: { stability: true, cog: { withinPolicy: true } } } });
});

test('actual door dimensions reach solver and returned placement container contract', async () => {
  const res = await request(app).post('/packing/generate').send({ ...body(), containerMode: 'ACTUAL_CONTAINER',
    actualContainer: { innerLength: 5900, innerWidth: 2350, innerHeight: 2390, doorWidth: 1800, doorHeight: 2000, maxGross: 30000, tare: 2300 } });
  expect(res.status).toBe(200);
  expect(mockExecute.mock.calls[0][0].container).toMatchObject({ doorWidth: 1800, doorHeight: 2000, maxWeight: 27700 });
  expect(res.body.data.containerInfo).toMatchObject({ doorWidth: 1800, doorHeight: 2000, maxGross: 30000, tare: 2300 });
});

test.each([{ weight: null }, { quantity: 1.3 }])('invalid raw cargo is rejected before solver or persistence: %o', async patch => {
  const res = await request(app).post('/packing/generate').send({ ...body(), cargoList: [{ ...cargo, ...patch }] });
  expect(res.status).toBe(400);
  expect(res.body.code).toBe('PACKING_INPUT_INVALID');
  expect(mockExecute).not.toHaveBeenCalled();
  expect(inserts()).toHaveLength(0);
});

test('missing actual-container tare cannot turn gross mass into payload', async () => {
  const res = await request(app).post('/packing/generate').send({ ...body(), containerMode: 'ACTUAL_CONTAINER', actualContainer: { maxGross: 30000 } });
  expect(res.status).toBe(400);
  expect(mockExecute).not.toHaveBeenCalled();
});

test('actual-container mode cannot silently inherit missing measured dimensions from reference', async () => {
  const res = await request(app).post('/packing/generate').send({ ...body(), containerMode: 'ACTUAL_CONTAINER', actualContainer: { maxGross: 30000, tare: 2300 } });
  expect(res.status).toBe(400);
  expect(res.body.message).toContain('不能用参考尺寸');
  expect(mockExecute).not.toHaveBeenCalled();
});

test('full fallback is inserted once after immutable revision lineage is attached', async () => {
  mockReplan.mockImplementation(async (input, solveFull) => ({ ...await solveFull(input),
    replan: { previousPlanId: 'OLD', method: 'FULL_REPLAN' }, revision: { revisionId: 'R2', previousPlanId: 'OLD' } }));
  const res = await request(app).post('/packing/replan').send(body());
  expect(res.status).toBe(200);
  expect(inserts()).toHaveLength(1);
  const persisted = JSON.parse(inserts()[0][1][5]);
  expect(persisted.revision).toMatchObject({ revisionId: 'R2', previousPlanId: 'OLD' });
  expect(persisted.replan.method).toBe('FULL_REPLAN');
  expect(persisted.planId).toBe(res.body.data.planId);
});

test('database refusal retains computed plan but never claims it was saved', async () => {
  mockQuery.mockRejectedValue(Object.assign(new Error('test refusal'), { code: 'ER_ACCESS_DENIED_ERROR' }));
  const res = await request(app).post('/packing/generate').send(body());
  expect(res.status).toBe(200);
  expect(res.body.data.loadedCargo).toHaveLength(1);
  expect(res.body.data.executionStatus.persistence).toBe('FAILED');
  expect(res.body.data.persistenceError.code).toBe('ER_ACCESS_DENIED_ERROR');
});

test('compliance persistence targets submitted plan identity and keeps existing revision', async () => {
  mockQuery.mockResolvedValueOnce([[{ plan_id: 'PLAN-A', plan_data: JSON.stringify({ planId: 'PLAN-A', revision: { revisionId: 'R1' } }) }]]).mockResolvedValueOnce([{}]);
  const res = await request(app).post('/packing/compliance-check-sync').send({ packingPlanData: { planId: 'PLAN-A' } });
  expect(res.status).toBe(200);
  expect(mockQuery.mock.calls[0]).toEqual(['SELECT plan_id, plan_data FROM packing_plan WHERE plan_id = ? LIMIT 1', ['PLAN-A']]);
  const update = mockQuery.mock.calls[1];
  expect(update[1][2]).toBe('PLAN-A');
  expect(JSON.parse(update[1][1]).revision.revisionId).toBe('R1');
  expect(res.body.data.persistence).toBe('SAVED');
});

test('compliance without plan identity never updates an unrelated database row', async () => {
  const res = await request(app).post('/packing/compliance-check-sync').send({ packingPlanData: {} });
  expect(res.status).toBe(200);
  expect(mockQuery).not.toHaveBeenCalled();
  expect(res.body.data.persistence).toBe('NOT_REQUESTED');
});

test('legacy AI generate URL uses the real solver with supplied cargo facts', async () => {
  const res = await request(app).post('/ai-packing/generate').send(body());
  expect(res.status).toBe(200);
  expect(mockExecute).toHaveBeenCalledTimes(1);
  expect(mockExecute.mock.calls[0][0].cargoList[0]).toMatchObject({ cargoId: 'c', weight: 100, quantity: 1 });
  expect(res.body.data.totalCargoCount).toBe(1);
  expect(res.body.data.sourceCode).toBe('BACKEND_SOLVED');
  expect(res.body.data.demoMode).toBeUndefined();
});

test('strategy comparison measures actual solves without invented AI improvement', async () => {
  const res = await request(app).post('/ai-packing/compare').send(body());
  expect(res.status).toBe(200);
  expect(mockExecute).toHaveBeenCalledTimes(2);
  expect(mockExecute.mock.calls.map(([arg]) => arg.options.strategy)).toEqual(['space', 'balance']);
  expect(res.body.data.aiUsed).toBe(false);
  expect(res.body.data.candidates.every(c => c.plan.totalCargoCount === 1 && c.elapsedMs >= 0)).toBe(true);
  expect(inserts()).toHaveLength(0);
});

test.each(['preset-plan', 'preset-compliance', 'preset-presentation'])('precomputed success route %s is retired explicitly', async endpoint => {
  const res = await request(app).get(`/ai-packing/demo/${endpoint}`);
  expect(res.status).toBe(410);
  expect(res.body.code).toBe('PRESET_RESULT_RETIRED');
  expect(mockExecute).not.toHaveBeenCalled();
  expect(mockQuery).not.toHaveBeenCalled();
});
