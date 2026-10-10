import { describe, expect, it } from 'vitest';
import LZString from 'lz-string';
import { createInitialSession, SESSION_SCHEMA_VERSION } from '../../domain/session/initialSession.js';
import { loadSession, saveSession, SESSION_STORAGE_KEY } from './sessionStorage.js';
import { planningFingerprint } from '../../domain/plan/planRevision.js';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    value: (key) => values.get(key)
  };
}

describe('session storage', () => {
  it('round-trips the versioned session and strips transient error states', () => {
    const storage = memoryStorage();
    const session = {
      ...createInitialSession(),
      backendPlan: { planId: 'PLAN-1' },
      planStatus: 'error',
      planError: 'network',
      aiAuditStatus: 'error',
      aiAuditError: 'timeout'
    };
    session.backendPlanFingerprint = planningFingerprint(session);

    expect(saveSession(session, storage)).toBe(true);
    const loaded = loadSession(storage);
    expect(loaded.backendPlan.planId).toBe('PLAN-1');
    expect(loaded.planStatus).toBe('ready');
    expect(loaded.planError).toBeNull();
    expect(loaded.aiAuditStatus).toBe('idle');
  });

  it('falls back safely for malformed or incompatible data', () => {
    const malformed = memoryStorage({ [SESSION_STORAGE_KEY]: '{broken' });
    const incompatible = memoryStorage({
      [SESSION_STORAGE_KEY]: JSON.stringify({ schemaVersion: SESSION_SCHEMA_VERSION + 1, cargo: [], order: { orderNo: 'X' } })
    });

    expect(loadSession(malformed)).toMatchObject({ order: { orderNo: createInitialSession().order.orderNo }, recoveryNotice: expect.stringContaining('数据损坏') });
    expect(loadSession(incompatible)).toMatchObject({ schemaVersion: SESSION_SCHEMA_VERSION, recoveryNotice: expect.stringContaining('版本不兼容') });
  });

  it('reports storage write failures without throwing', () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(saveSession(createInitialSession(), storage)).toBe(false);
  });

  it('preserves unknown external-dataset facts across persistence', () => {
    const storage = memoryStorage();
    const session = {
      ...createInitialSession(),
      cargo: [{
        cargoId: 'external-1',
        sku: 'ORTEC-1',
        length: 100,
        width: 80,
        height: 60,
        weight: 12,
        quantity: 1,
        packagingType: null,
        stackable: null,
        maxStackLayers: null,
        destinationPort: null,
        portSequence: null,
        handlingMethod: null,
        dangerous: null,
        orientationConstraints: { x: true, y: false, z: true },
        externalMetadata: { source: 'ortec', orientationConstraints: { x: true, y: false, z: true } }
      }]
    };

    session.backendPlanFingerprint = planningFingerprint(session);
    expect(saveSession(session, storage)).toBe(true);
    expect(loadSession(storage).cargo[0]).toMatchObject({
      packagingType: null,
      stackable: null,
      maxStackLayers: null,
      destinationPort: null,
      portSequence: null,
      handlingMethod: null,
      dangerous: null
    });
    expect(loadSession(storage).cargo[0].orientationConstraints).toEqual({ x: true, y: false, z: true });
  });

  it('stores converged strategy placements once and reconstructs every formal plan', () => {
    const storage = memoryStorage();
    const loadedCargo = [{ cargoId: 'A-1', x: 100, y: 0, z: 20, candidateTrace: { accepted: true } }];
    const plans = Object.fromEntries(['SPACE', 'BALANCE', 'OPERATION'].map((strategy, index) => [strategy, {
      planId: `PLAN-${strategy}`,
      placementHash: 'same-hash',
      loadedCargo: structuredClone(loadedCargo),
      unloadedCargo: [],
      securing: { securingRequiredCount: index }
    }]));
    const session = {
      ...createInitialSession(),
      selectedStrategy: 'BALANCE',
      strategyPlans: plans,
      backendPlan: plans.BALANCE,
      packingCase: { caseId: 'CASE-1', status: 'SOLVED', packingPlan: plans.BALANCE }
    };
    session.backendPlanFingerprint = planningFingerprint(session);

    expect(saveSession(session, storage)).toBe(true);
    const stored = storage.value(SESSION_STORAGE_KEY);
    expect(stored.startsWith('pc-lz16:')).toBe(true);
    const raw = JSON.parse(LZString.decompressFromUTF16(stored.slice('pc-lz16:'.length)));
    expect(raw.backendPlan).toBeUndefined();
    expect(raw.strategyPlans.SPACE.loadedCargo).toBeUndefined();
    expect(raw.strategyPlacementPool.loadedCargo).toHaveLength(1);

    const loaded = loadSession(storage);
    expect(loaded.backendPlan.planId).toBe('PLAN-BALANCE');
    expect(loaded.strategyPlans.OPERATION.loadedCargo).toEqual(loadedCargo);
    expect(loaded.strategyPlans.SPACE.securing.securingRequiredCount).toBe(0);
    expect(loaded.strategyPlans.OPERATION.securing.securingRequiredCount).toBe(2);
  });

  it('losslessly restores strategy-specific placement evidence and shared plan audits', () => {
    const storage = memoryStorage();
    const commonAudit = { rows: Array.from({ length: 40 }, (_, index) => ({ index, status: 'PASS', detail: `audit-${index}` })) };
    const plans = Object.fromEntries(['SPACE', 'BALANCE', 'OPERATION'].map((strategy, index) => [strategy, {
      planId: `PLAN-${strategy}`,
      strategy,
      placementHash: 'converged-hash',
      loadedCargo: [{
        cargoId: 'A-1', x: 100, y: 0, z: 20,
        candidateTrace: { strategy, accepted: true, iteration: index },
        algorithmMeta: index === 0 ? undefined : { challenger: strategy }
      }],
      unloadedCargo: [],
      validator: commonAudit,
      stability: commonAudit,
      ext_stability: commonAudit
    }]));
    const session = {
      ...createInitialSession(),
      selectedStrategy: 'BALANCE',
      strategyPlans: plans,
      backendPlan: plans.BALANCE,
      packingCase: { caseId: 'CASE-1', status: 'SOLVED', packingPlan: plans.BALANCE }
    };
    session.backendPlanFingerprint = planningFingerprint(session);

    expect(saveSession(session, storage)).toBe(true);
    const stored = storage.value(SESSION_STORAGE_KEY);
    const raw = JSON.parse(LZString.decompressFromUTF16(stored.slice('pc-lz16:'.length)));
    expect(raw.strategyPlacementPool.version).toBe(2);
    expect(raw.strategyPlacementPool.overrides.BALANCE[0].set.candidateTrace.strategy).toBe('BALANCE');
    expect(raw.strategySharedPlanFields.validator).toEqual(commonAudit);
    expect(raw.strategySharedPlanAliases).toMatchObject({ stability: 'validator', ext_stability: 'validator' });
    expect(raw.packingCase).toMatchObject({ caseId: 'CASE-1', packingPlanStrategy: 'BALANCE' });
    expect(raw.packingCase.packingPlan).toBeUndefined();

    const loaded = loadSession(storage);
    expect(loaded.strategyPlans).toEqual(plans);
    expect(loaded.backendPlan).toEqual(plans.BALANCE);
    expect(loaded.packingCase).toEqual(session.packingCase);
  });

  it('retains a stale snapshot after refresh and never restores its passing evidence as current', () => {
    const storage = memoryStorage();
    const session = createInitialSession();
    session.backendPlan = { planId: 'OLD', loadedCargo: [], shipmentReadiness: { overallStatus: 'PASS' } };
    session.backendPlanFingerprint = planningFingerprint(session);
    session.actualContainer = { doorWidth: 1900 };
    expect(saveSession(session, storage)).toBe(true);
    const loaded = loadSession(storage);
    expect(loaded.backendPlan).toBeNull();
    expect(loaded.stalePlan.planId).toBe('OLD');
    expect(loaded.planStatus).toBe('stale');
    expect(saveSession(loaded, storage)).toBe(true);
    expect(loadSession(storage).planStatus).toBe('stale');
  });
});
