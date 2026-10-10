import { apiRequest, unwrapApiData } from './apiClient.js';
import { normalizePlanSource } from '../domain/provenance/planSource.js';

export function buildPackingCasePayload({ session, plan, status = 'SOLVED', complianceSummary = null }) {
  if (!session?.order?.orderNo) throw new Error('当前会话缺少 caseId');
  if (!Array.isArray(session.cargo)) throw new Error('当前会话缺少 cargoSnapshot');
  if(plan?.executionStatus?.persistence==='FAILED')throw new Error('方案持久化失败，不能把未保存 planId 标记为已保存任务');
  return {
    // Only a previously persisted task identifies an update. Source/order IDs
    // remain provenance; the backend allocates a fresh Case ID on creation.
    ...(session.packingCase?.caseId ? {caseId:session.packingCase.caseId} : {}),
    taskIdentity: {
      sessionTaskId:session.sessionTaskId,
      orderId:session.order.orderNo,
      sourceCaseId:session.caseContext?.caseId ?? null,
      externalTaskId:session.externalDataset ? session.order.orderNo : null,
      benchmarkInstanceId:session.externalDataset?.instanceId ?? null
    },
    solverMode:session.solverMode ?? 'PORTCUBE_BUSINESS_SIMULATION',
    dataClassification:session.dataClassification ?? 'UNKNOWN',
    datasetId:session.datasetId ?? null,
    benchmarkMode:session.benchmarkMode ?? null,
    externalDataset:session.externalDataset ?? null,
    datasetCapabilities:session.datasetCapabilities ?? null,
    sourceContainer:session.sourceContainer ?? null,
    executionStatus:{
      solve:plan ? 'COMPLETED' : 'NOT_RUN',
      validation:plan?.executionStatus?.validation ?? plan?.validator?.status ?? plan?.validation?.status ?? plan?.ext_validation?.status ?? 'NOT_VERIFIED',
      persistence:'SAVED',
      benchmark:plan?.executionStatus?.benchmark ?? plan?.benchmarkStatus ?? 'NOT_RUN',
      businessReadiness:plan?.executionStatus?.businessReadiness ?? plan?.ext_readiness?.status ?? 'NOT_VERIFIED'
    },
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
  if (input.caseId) return updatePackingCase(input.caseId,input,config);
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
  const record=unwrapApiData(payload);
  if(record?.packingPlanId) {
    const stored=unwrapApiData(await apiRequest(`/api/packing/plans/${encodeURIComponent(record.packingPlanId)}`,{signal:config.signal},config));
    if(record.packingPlan && JSON.stringify(record.packingPlan.loadedCargo)!==JSON.stringify(stored.loadedCargo)) throw new Error('任务快照与已保存方案货位不一致');
    return {...record,packingPlan:stored,sourceCode:stored.sourceCode};
  }
  return record;
}

export async function listPackingCases(config = {}) {
  const payload = await apiRequest('/api/cases', { signal: config.signal }, config);
  return unwrapApiData(payload);
}
