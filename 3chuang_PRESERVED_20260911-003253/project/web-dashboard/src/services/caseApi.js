import { apiRequest, unwrapApiData } from './apiClient.js';
import { normalizePlanSource } from '../domain/provenance/planSource.js';

export function buildPackingCasePayload({ session, plan, status = 'SOLVED', complianceSummary = null }) {
  if (!session?.order?.orderNo) throw new Error('当前会话缺少 caseId');
  if (!Array.isArray(session.cargo)) throw new Error('当前会话缺少 cargoSnapshot');
  return {
    caseId: session.packingCase?.caseId || session.order.orderNo,
    cargoSnapshot: session.cargo.map((item) => ({ ...item, riskNotes: [...(item.riskNotes || [])] })),
    containerType: session.selectedContainerType,
    caseContext: session.caseContext,
    containerMode: session.containerMode,
    actualContainer: session.actualContainer,
    massEvidence: session.massEvidence,
    vgm: session.vgm,
    transport: session.transport,
    securingInputs: session.securingInputs,
    packingPlanId: plan?.planId || null,
    packingPlan: plan || null,
    complianceSummary,
    sourceCode: normalizePlanSource(plan),
    status
  };
}

export async function savePackingCase(input, config = {}) {
  const payload = await apiRequest('/api/cases', {
    method: 'POST',
    body: JSON.stringify(input),
    signal: config.signal
  }, config);
  return unwrapApiData(payload);
}

export async function updatePackingCase(caseId, patch, config = {}) {
  const payload = await apiRequest(`/api/cases/${encodeURIComponent(caseId)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
    signal: config.signal
  }, config);
  return unwrapApiData(payload);
}

export async function getPackingCase(caseId, config = {}) {
  const payload = await apiRequest(`/api/cases/${encodeURIComponent(caseId)}`, {
    signal: config.signal
  }, config);
  return unwrapApiData(payload);
}

export async function listPackingCases(config = {}) {
  const payload = await apiRequest('/api/cases', { signal: config.signal }, config);
  return unwrapApiData(payload);
}
