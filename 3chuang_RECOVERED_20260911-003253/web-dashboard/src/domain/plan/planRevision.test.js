import { describe, expect, it } from 'vitest';
import { createInitialSession } from '../session/initialSession.js';
import { createPlanRevision, diffPlans, planningFingerprint } from './planRevision.js';
import { buildActivePlanViewModel } from './activePlanViewModel.js';
import { SESSION_ACTIONS as A, sessionReducer } from '../../app/session/sessionReducer.js';

const placement = (cargoId, patch = {}) => ({ cargoId, sourceCargoId: cargoId, x: 0, y: 0, z: 0, l: 600, w: 500, h: 400, orientation: 'LWH', ...patch });
const plan = (id, loadedCargo = [placement('a')]) => ({ planId: id, sourceCode: 'BACKEND_SOLVED', loadedCargo, containerInfo: { typeId: '20GP' }, shipmentReadiness: { overallStatus: 'PASS' } });
const request = (state, requestId) => sessionReducer(state, { type: A.PLAN_REQUEST, requestId, fingerprint: planningFingerprint(state) });
const response = (state, requestId, result = plan(requestId)) => sessionReducer(state, { type: A.PLAN_SUCCESS, requestId, fingerprint: state.pendingPlanRequest?.fingerprint, plan: result });

describe('input identity and immutable plan revisions', () => {
  it('changes identity for nested evidence, handling, actual container and constraints', () => {
    const session = createInitialSession();
    const fingerprint = planningFingerprint(session);
    for (const patch of [
      { actualContainer: { doorWidth: 2200 } }, { securingInputs: { frictionCoefficient: 0.4 } },
      { vgm: { declaredVGMKg: 5100 } }, { caseContext: { ...session.caseContext, commerce: { enabled: true } } },
      { cargo: session.cargo.map((item, index) => index ? item : { ...item, maximumSupportedWeightKg: 20 }) }
    ]) expect(planningFingerprint({ ...session, ...patch })).not.toBe(fingerprint);
    expect(planningFingerprint({ ...session, planStatus: 'loading', lastSavedAt: 'now' })).toBe(fingerprint);
    expect(planningFingerprint({ ...session, actualContainer: { width: 2000, length: 6000 } }))
      .toBe(planningFingerprint({ ...session, actualContainer: { length: 6000, width: 2000 } }));
  });

  it('rejects an old solve and failure after an input edit, including when the input is reverted', () => {
    const initial = createInitialSession();
    const solving = request(initial, 'A');
    const original = initial.cargo[0];
    const edited = sessionReducer(solving, { type: A.UPDATE_CARGO, cargoId: original.cargoId, patch: { width: original.width + 100 } });
    const staleAction = { type: A.PLAN_SUCCESS, requestId: 'A', fingerprint: planningFingerprint(initial), plan: plan('A') };
    expect(sessionReducer(edited, staleAction)).toBe(edited);
    const reverted = sessionReducer(edited, { type: A.UPDATE_CARGO, cargoId: original.cargoId, patch: { width: original.width } });
    const second = request(reverted, 'B');
    expect(sessionReducer(second, staleAction)).toBe(second);
    expect(sessionReducer(second, { ...staleAction, type: A.PLAN_FAILURE, error: 'late error' })).toBe(second);
    expect(response(second, 'B').backendPlan.planId).toBe('B');
  });

  it('preserves old revisions and refuses stale readiness after replan', () => {
    const solved = response(request(createInitialSession(), 'A'), 'A');
    const old = solved.planRevisions[0];
    const edited = sessionReducer(solved, { type: A.UPDATE_CARGO, cargoId: solved.cargo[0].cargoId, patch: { width: 1100 } });
    expect(edited.backendPlan).toBeNull();
    expect(edited.stalePlan.planId).toBe('A');
    expect(edited.latestPlanDiff).toBeNull();
    expect(sessionReducer(edited, { type: A.READINESS_UPDATE, basePlanId: 'A', readiness: { overallStatus: 'PASS' } })).toBe(edited);
    const replanned = response(request(edited, 'B'), 'B', plan('B', [placement('a', { x: 100 })]));
    expect(replanned.planRevisions).toHaveLength(2);
    expect(replanned.planRevisions[0]).toBe(old);
    expect(Object.isFrozen(old.plan.loadedCargo[0])).toBe(true);
    expect(replanned.latestPlanDiff.counts.moved).toBe(1);
    expect(replanned.stalePlan).toBeNull();
    expect(sessionReducer(replanned, { type: A.CASE_SYNC_SUCCESS, basePlanId: 'A', packingCase: {} })).toBe(replanned);
  });

  it('rebuilds derived physical dimensions on an actual demo edit without rewriting source direction facts', () => {
    const session = createInitialSession();
    const edited = sessionReducer(session, { type: A.UPDATE_CARGO, cargoId: 'worksite-1-CASE', patch: { width: 1100 } });
    const cargo = edited.cargo.find(item => item.cargoId === 'worksite-1-CASE');
    expect(cargo.width).toBe(1100);
    expect(cargo.cargoPhysicalProfile.dimensions.widthMm).toBe(1100);
    expect(cargo.cargoPhysicalProfile.solverEnvelope.dimensions.widthMm).toBe(1100);
    expect(cargo.orientationPolicy).toBe('FIXED_ORIENTATION');
    expect(session.cargo.find(item => item.cargoId === 'worksite-1-CASE').width).toBe(1000);
    expect(edited.cargo.reduce((sum, item) => sum + item.quantity, 0)).toBe(42);
  });

  it('rebinds validated VGM evidence to the current input and rejects late evidence responses', () => {
    const solved = response(request(createInitialSession(), 'A'), 'A');
    const action = { type: A.READINESS_UPDATE, basePlanId: 'A', baseFingerprint: solved.backendPlanFingerprint,
      vgm: { ...solved.vgm, declaredVGMKg: 5000 }, readiness: { overallStatus: 'ACTION_REQUIRED' } };
    const updated = sessionReducer(solved, action);
    expect(updated.backendPlanFingerprint).toBe(planningFingerprint(updated));
    expect(updated.backendPlan.shipmentReadiness.overallStatus).toBe('ACTION_REQUIRED');
    expect(updated.planRevisions[0].inputSnapshot.vgm.declaredVGMKg).toBeNull();
    expect(sessionReducer(updated, { ...action, vgm: { declaredVGMKg: 4000 } })).toBe(updated);
  });

  it('classifies retained, moved, removed, added, rotated and resized cargo by actual placements', () => {
    const before = plan('A', ['same', 'move', 'remove', 'rotate', 'resize'].map(id => placement(id)));
    const after = plan('B', [placement('same'), placement('move', { x: 100 }), placement('add'), placement('rotate', { orientation: 'WLH', x: 200 }), placement('resize', { w: 650 })]);
    const diff = diffPlans(before, after);
    expect(diff.counts).toEqual({ unchanged: 2, moved: 1, removed: 1, added: 1, orientation_changed: 1, resized: 1 });
    expect(diff.entries.find(item => item.cargoId === 'rotate')).toMatchObject({ moved: true, orientationChanged: true });
    expect(diff.entries.find(item => item.cargoId === 'resize').reason).toContain('尺寸已改变');
    expect(diff.entries.every(item => item.reason.length > 0)).toBe(true);
    const session = createInitialSession();
    const snapshot = createPlanRevision({ session, plan: before, fingerprint: planningFingerprint(session), at: '2026-09-22' });
    before.loadedCargo[0].x = 999;
    session.cargo[0].width = 999;
    expect(snapshot.plan.loadedCargo[0].x).toBe(0);
    expect(snapshot.cargoSnapshot[0].width).not.toBe(999);
  });

  it('never promotes preview or stale evidence to ready metrics', () => {
    const candidate = plan('A');
    for (const [session, current] of [[{ planStatus: 'stale' }, candidate], [{ planStatus: 'preview' }, { ...candidate, sourceCode: 'LOCAL_PREVIEW' }]]) {
      const view = buildActivePlanViewModel({ session, plan: current, container: current.containerInfo });
      expect(view.isReady).toBe(false);
      expect(view.loadedCount).toBeNull();
      expect(view.shipmentReadiness).toBeNull();
    }
  });
});
