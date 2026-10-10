import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { buildReviewEvidence } from './reviewEvidence.js';
import { planningFingerprint, createPlanRevision, stableSerialize } from './planRevision.js';

const makeSession = () => {
  const session = { cargo: [{ cargoId: 'box', quantity: 1, width: 100 }], dataClassification: 'DEMO_DATA',
    backendPlan: { planId: 'P1', sourceCode: 'BACKEND_SOLVED', loadedCargo: [{ cargoId: 'box', x: 0, y: 0, z: 0 }], shipmentReadiness: { overallStatus: 'DATA_REQUIRED' }, executionStatus: { persistence: 'FAILED' } } };
  session.backendPlanFingerprint = planningFingerprint(session);
  session.planRevisions = [createPlanRevision({ session, plan: session.backendPlan, fingerprint: session.backendPlanFingerprint, at: '2026-09-26T00:00:00Z' })];
  return session;
};
describe('review evidence boundaries', () => {
  it('binds current evidence and snapshot integrity to actual inputs without mutating session', async () => {
    const session = makeSession(), before = structuredClone(session);
    const result = await buildReviewEvidence(session);
    const { integrity, ...payload } = result;
    expect(integrity.payloadSha256).toBe(createHash('sha256').update(stableSerialize(payload)).digest('hex'));
    expect(result.currentRevisionId).toBe('P1:R1');
    expect(result.currentPlan.executionStatus.persistence).toBe('FAILED');
    expect(session).toEqual(before);
  });
  it('never exports stale readiness as current even when backendPlan remains in session', async () => {
    const session = makeSession(); session.cargo[0].width = 200;
    const result = await buildReviewEvidence(session);
    expect(result.state).toBe('STALE'); expect(result.currentPlan).toBeNull(); expect(result.comparison).toBeNull(); expect(result.currentRevisionId).toBeNull();
    expect(result.revisions[0].plan.shipmentReadiness.overallStatus).toBe('DATA_REQUIRED');
  });
  it('does not promote preview or a forged source merely because fingerprints match', async () => {
    const session = makeSession(); session.backendPlan.sourceCode = 'LOCAL_PREVIEW';
    expect((await buildReviewEvidence(session)).currentPlan).toBeNull();
    session.backendPlan = null; session.planRevisions = [];
    expect((await buildReviewEvidence(session)).state).toBe('PREVIEW');
  });
  it('retains current runtime uncertainty without leaking capability configuration', async () => {
    const session = makeSession(); session.apiKey = 'private';
    const result = await buildReviewEvidence(session, { ai: { status: 'CONFIGURED', key: 'secret' }, database: { status: 'CONNECTED', password: 'private' } });
    expect(result.runtime.aiCallVerified).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/private|secret/);
  });
  it('keeps an offline export useful without reporting connected services', async () => {
    const result = await buildReviewEvidence(makeSession(), { unavailable: true });
    expect(result.runtime.service).toBe('UNAVAILABLE'); expect(result.runtime.database).toBe('UNKNOWN');
  });
  it('does not bind corrupted revision inputs to the current plan', async () => {
    const session = structuredClone(makeSession()); session.planRevisions[0].inputSnapshot.cargo[0].width = 999;
    const result = await buildReviewEvidence(session);
    expect(result.revisions[0].inputBindingVerified).toBe(false); expect(result.currentRevisionId).toBeNull();
  });
  it('recomputes the comparison using the parent revision rather than an unrelated cached diff', async () => {
    const session = makeSession(), previous = session.planRevisions[0];
    session.cargo[0].width = 200; session.backendPlan = { ...session.backendPlan, planId: 'P2', loadedCargo: [{ cargoId: 'box', x: 10, y: 0, z: 0 }] };
    session.backendPlanFingerprint = planningFingerprint(session);
    session.planRevisions.push(createPlanRevision({ session, plan: session.backendPlan, fingerprint: session.backendPlanFingerprint, previous, at: '2026-09-26T01:00:00Z' }));
    session.latestPlanDiff = { counts: { moved: 999 } };
    const result = await buildReviewEvidence(session);
    expect(result.comparison.previousPlanId).toBe('P1'); expect(result.comparison.counts.moved).toBe(1);
  });
  it('captures inputs before asynchronous work and detects later tampering by digest', async () => {
    const session = makeSession(), pending = buildReviewEvidence(session);
    session.cargo[0].width = 888;
    const result = await pending;
    expect(result.inputs.cargo[0].width).toBe(100);
    result.inputs.cargo[0].width = 999;
    const { integrity, ...payload } = result;
    expect(createHash('sha256').update(stableSerialize(payload)).digest('hex')).not.toBe(integrity.payloadSha256);
  });
});
