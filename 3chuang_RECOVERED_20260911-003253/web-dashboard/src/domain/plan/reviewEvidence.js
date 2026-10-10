import { planningFingerprint, planningInputSnapshot, stableSerialize, diffPlans } from './planRevision.js';
import { isBackendSolved } from '../provenance/planSource.js';

// Deliberately omit provider configuration, credentials and the unrelated session.
export function currentReviewState(session) {
  const fingerprint = planningFingerprint(session);
  const current = Boolean(session.backendPlan && isBackendSolved(session.backendPlan)
    && session.backendPlanFingerprint === fingerprint);
  const stale = !current && Boolean(session.stalePlan || session.backendPlan);
  return { current, status: current ? 'CURRENT' : stale ? 'STALE' : 'PREVIEW',
    plan: current ? session.backendPlan : null, fingerprint };
}

const projectPlan = plan => plan ? {
  planId: plan.planId ?? null, sourceCode: plan.sourceCode || plan.source,
  placementHash: plan.placementHash ?? null, inputFingerprint: plan.inputFingerprint ?? null,
  solverRevision: plan.constraintMeta?.solverRevision || plan.metrics?.solverVersion || null,
  containerInfo: plan.containerInfo ?? null, loadedCargo: plan.loadedCargo || [], unloadedCargo: plan.unloadedCargo || [],
  executionStatus: plan.executionStatus ?? null, replan: plan.replan ?? null,
  shipmentReadiness: plan.shipmentReadiness || plan.ext_shipmentReadiness || null
} : null;

async function sha256(value) {
  const bytes = new TextEncoder().encode(stableSerialize(value));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildReviewEvidence(session, capabilities = null, capturedAt = new Date().toISOString()) {
  // Freeze a copy before async hashing so a later edit cannot mix two input versions.
  const snapshot = structuredClone(session);
  const state = currentReviewState(snapshot);
  const inputs = planningInputSnapshot(snapshot);
  const currentInputSha256 = await sha256(inputs);
  const revisions = await Promise.all((snapshot.planRevisions || []).map(async revision => ({
    revisionId: revision.revisionId, parentRevisionId: revision.parentRevisionId ?? null,
    planId: revision.planId, createdAt: revision.createdAt,
    inputBindingVerified: Boolean(revision.inputSnapshot && revision.planId === revision.plan?.planId && revision.inputFingerprint === `planning-v2:${stableSerialize(revision.inputSnapshot)}`),
    inputSha256: revision.inputSnapshot ? await sha256(revision.inputSnapshot) : null,
    inputs: revision.inputSnapshot ?? null, plan: projectPlan(revision.plan)
  })));
  const currentRevision = revisions.findLast(revision => revision.planId === state.plan?.planId && revision.inputBindingVerified && revision.inputSha256 === currentInputSha256);
  const previousRevision = currentRevision?.parentRevisionId
    ? revisions.find(revision => revision.revisionId === currentRevision.parentRevisionId && revision.inputBindingVerified) : null;
  const comparison = previousRevision && state.current ? diffPlans(previousRevision.plan, state.plan,
    { previousCargo: previousRevision.inputs?.cargo || [], cargo: snapshot.cargo || [] }) : null;
  const payload = {
    schema: 'portcube-review-evidence/v1', capturedAt,
    scope: 'USER_INITIATED_LOCAL_EXPORT', dataClassification: snapshot.dataClassification || 'UNKNOWN',
    currentInputSha256, inputs,
    state: state.status, currentPlan: projectPlan(state.plan),
    stalePlanId: state.status === 'STALE' ? (snapshot.stalePlan || snapshot.backendPlan)?.planId ?? null : null,
    currentRevisionId: currentRevision?.revisionId ?? null, revisions, comparison,
    runtime: {
      checkedAt: capabilities?.checkedAt ?? null,
      service: capabilities?.unavailable ? 'UNAVAILABLE' : capabilities ? 'REACHABLE' : 'UNKNOWN',
      database: capabilities?.database?.status ?? 'UNKNOWN', aiConfiguration: capabilities?.ai?.status ?? 'UNKNOWN',
      aiCallVerified: false
    },
    boundaries: [
      'This export is a local snapshot, not a signed certificate or tamper-proof attestation.',
      'Historical revisions are comparison evidence, never current shipment authorization.',
      'A connected database does not prove this plan was persisted; inspect executionStatus.',
      'AI configuration does not prove a successful provider call.',
      'Computed placements and simulated operations do not prove real-world execution.',
      'Bounded search failure does not prove mathematical impossibility.'
    ]
  };
  return { ...payload, integrity: { algorithm: 'SHA-256', canonicalization: 'planRevision.stableSerialize; omit integrity', payloadSha256: await sha256(payload) } };
}
