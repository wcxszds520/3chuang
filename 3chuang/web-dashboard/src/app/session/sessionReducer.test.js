import { describe, expect, it } from 'vitest';
import { createInitialSession } from '../../domain/session/initialSession.js';
import { SESSION_ACTIONS, sessionReducer } from './sessionReducer.js';
import { cargoFingerprint } from '../../domain/cargo/cargo.js';
import { loadSession, saveSession } from './sessionStorage.js';

function computedState() {
  return {
    ...createInitialSession(),
    backendPlan: { planId: 'PLAN-1' },
    backendPlanFingerprint: 'abc123',
    planStatus: 'ready',
    aiAudit: { status: 'passed', score: 96 },
    aiAuditStatus: 'ready',
    manualReview: { decision: 'approved' }
  };
}

describe('session reducer', () => {
  it('opens a saved case with its own cargo and formal plan, and restores the same identity after storage',()=>{
    const old=computedState(),cargo=createInitialSession({dataset:'legacy'}).cargo;
    const saved={caseId:'ORIGINAL-212',containerType:'40HQ',cargoSnapshot:cargo,packingPlan:{planId:'REQ-212',placementHash:'new-212',sourceCode:'BACKEND_SOLVED'},contextSnapshot:{caseContext:{origin:'Ningbo',destination:'Antwerp',route:[]},vgm:{declaredVGMKg:null}}};
    const next=sessionReducer(old,{type:SESSION_ACTIONS.OPEN_SAVED_CASE,packingCase:saved});
    expect(next.cargo.reduce((sum,row)=>sum+row.quantity,0)).toBe(212);expect(next.order.orderNo).toBe('ORIGINAL-212');expect(next.backendPlanFingerprint).toBe(cargoFingerprint(next.cargo,'40HQ'));
    expect(next.strategyPlans).toEqual({});expect(next.aiAudit).toBeNull();expect(next.planHistory.some(entry=>entry.plan.planId==='PLAN-1')).toBe(true);
    const store=new Map(),storage={setItem:(key,value)=>store.set(key,value),getItem:key=>store.get(key)};
    expect(saveSession(next,storage)).toBe(true);const loaded=loadSession(storage);expect(loaded.backendPlan.placementHash).toBe('new-212');expect(loaded.cargo).toEqual(next.cargo);
  });
  it('a new formal solve retires the previous strategy portfolio and preserves its current plan in history', () => {
    const old={planId:'OLD',placementHash:'old-layout'};
    const plan={planId:'NEW',placementHash:'new-layout'};
    const state={...computedState(),backendPlan:old,strategyPlans:{SPACE:old,BALANCE:old,OPERATION:old}};
    const solved=sessionReducer(state,{type:SESSION_ACTIONS.PLAN_SUCCESS,plan,fingerprint:'new-input'});
    expect(solved.backendPlan).toBe(plan);
    expect(solved.strategyPlans).toEqual({});
    expect(solved.planHistory.some(item=>item.plan.planId==='OLD')).toBe(true);
    const switched=sessionReducer(solved,{type:SESSION_ACTIONS.SET_STRATEGY,strategy:'OPERATION'});
    expect(switched.backendPlan).toBe(plan);
  });
  it('invalidates plan and compliance evidence when cargo changes', () => {
    const state = computedState();
    const next = sessionReducer(state, {
      type: SESSION_ACTIONS.UPDATE_CARGO,
      cargoId: state.cargo[0].cargoId,
      patch: { quantity: state.cargo[0].quantity + 1 },
      at: '2026-07-10T00:00:00.000Z'
    });

    expect(next.backendPlan).toBeNull();
    expect(next.planStatus).toBe('preview');
    expect(next.aiAudit).toBeNull();
    expect(next.manualReview).toBeNull();
    expect(next.lastSavedAt).toBe('2026-07-10T00:00:00.000Z');
  });

  it('duplicates next to its source with an independent identity', () => {
    const state = createInitialSession();
    const source = state.cargo[1];
    const next = sessionReducer(state, {
      type: SESSION_ACTIONS.DUPLICATE_CARGO,
      cargoId: source.cargoId,
      newCargoId: 'copy_1'
    });

    expect(next.cargo[2]).toMatchObject({ cargoId: 'copy_1', sku: `${source.sku}-COPY` });
    expect(next.cargo).toHaveLength(state.cargo.length + 1);
  });

  it('records AI and manual evidence as immutable history entries', () => {
    const state = createInitialSession();
    const afterAi = sessionReducer(state, {
      type: SESSION_ACTIONS.AI_SUCCESS,
      audit: { status: 'warning', score: 82, source: 'backend-deterministic-with-ai-explanation' },
      historyId: 'ai_1',
      at: '2026-07-10T01:00:00.000Z'
    });
    const afterManual = sessionReducer(afterAi, {
      type: SESSION_ACTIONS.MANUAL_REVIEW,
      review: { reviewer: '王宁', decision: 'approved-with-conditions', note: '补充绑扎照片' },
      historyId: 'manual_1',
      at: '2026-07-10T02:00:00.000Z'
    });

    expect(afterManual.complianceHistory).toHaveLength(2);
    expect(afterManual.complianceHistory[1]).toMatchObject({
      id: 'manual_1',
      basedOnAiStatus: 'warning',
      basedOnAiScore: 82
    });
    expect(afterManual.aiAudit).toEqual(afterAi.aiAudit);
  });

  it('ignores actions that do not target an existing cargo item', () => {
    const state = createInitialSession();
    expect(sessionReducer(state, {
      type: SESSION_ACTIONS.UPDATE_CARGO,
      cargoId: 'missing',
      patch: { quantity: 9 }
    })).toBe(state);
  });

  it('stores three backend strategies and switches the authoritative plan without changing evidence', () => {
    const state = createInitialSession();
    const plans = {
      SPACE: { planId: 'SPACE-1', loadedCargo: [{ cargoId: 'cargo_1', x: 0 }] },
      BALANCE: { planId: 'BALANCE-1', loadedCargo: [{ cargoId: 'cargo_1', x: 42 }] },
      OPERATION: { planId: 'OPERATION-1', loadedCargo: [{ cargoId: 'cargo_1', x: 84 }] }
    };
    const generated = sessionReducer(state, {
      type: SESSION_ACTIONS.STRATEGY_PLANS_SUCCESS,
      plans,
      selectedStrategy: 'SPACE',
      fingerprint: 'strategy-fingerprint'
    });
    const selected = sessionReducer(generated, { type: SESSION_ACTIONS.SET_STRATEGY, strategy: 'balance' });

    expect(generated.strategyPlans).toEqual(plans);
    expect(selected.selectedStrategy).toBe('BALANCE');
    expect(selected.backendPlan).toBe(plans.BALANCE);
    expect(selected.strategyPlans.SPACE).toBe(plans.SPACE);
    expect(selected.backendPlanFingerprint).toBe('strategy-fingerprint');
  });
});
