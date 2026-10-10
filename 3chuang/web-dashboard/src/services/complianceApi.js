import { apiRequest, unwrapApiData } from './apiClient.js';

export const COMPLIANCE_ENDPOINT = '/api/packing/compliance-check-sync';

export function buildCompliancePayload(plan, cargoList, container, vgmSubmitted) {
  const declaredVGM = vgmSubmitted ? Math.round(Number(plan.totalWeight || 0) + Number(container.tareWeight || 0)) : 0;
  const byId = new Map(cargoList.map((cargo) => [String(cargo.cargoId), cargo]));
  const loadedCargo = (plan.loadedCargo || []).map((item) => {
    const baseId = String(item.cargoId || '').replace(/_\d+$/, '');
    const original = byId.get(baseId) || {};
    return {
      ...item,
      dangerous: item.dangerous ?? original.dangerous ?? false,
      stackable: item.stackable ?? original.stackable ?? true,
      maxStackLayers: item.maxStackLayers ?? original.maxStackLayers ?? 1
    };
  });
  const packingPlanData = {
    containerInfo: {
      typeId: container.typeId,
      name: container.name,
      innerLength: container.innerLength,
      innerWidth: container.innerWidth,
      innerHeight: container.innerHeight,
      maxWeight: container.maxWeight
    },
    loadedCargo,
    unloadedCargo: plan.unloadedCargo || [],
    spaceUtilization: Number(plan.spaceUtilization || 0),
    totalWeight: Number(plan.totalWeight || 0),
    cog: plan.cog || null,
    cogOffset: plan.cogOffset || { lateral: 0, longitudinal: 0 },
    constraintMeta: plan.constraintMeta || {},
    declaredVGM
  };
  return { packingPlanData, declaredVGM };
}

export function adaptAiComplianceReport(payload) {
  const data = unwrapApiData(payload);
  const report = data?.complianceReport || data;
  if (!report || !Array.isArray(report.reportTable)) {
    const error = new Error('合规复核接口返回结构不完整');
    error.reason = 'contract';
    throw error;
  }
  const status = String(report.status || report.overallStatus || inferStatus(report.reportTable)).toUpperCase();
  return {
    ...report,
    status,
    score: Number(report.score || 0),
    rows: report.reportTable.map((row, index) => ({
      key: row.key || `ai_${index + 1}`,
      dimension: row.dimension,
      standard: row.standard,
      actual: row.actual,
      result: String(row.result || 'WARNING').toUpperCase(),
      sourceRef: row.sourceRef || row.ruleSource || '后端确定性规则'
    })),
    risks: Array.isArray(report.rejection_risks) ? report.rejection_risks : [],
    advice: report.advice || 'AI 未返回额外建议，请以规则判定和人工复核为准。',
    source: 'backend-deterministic-with-ai-explanation',
    sourceLabel: '后端确定性规则 · AI 仅解释',
    aiExplanation: report.aiExplanation || null
  };
}

export async function runAiComplianceAudit({ plan, cargoList, container, vgmSubmitted }, config = {}) {
  const body = buildCompliancePayload(plan, cargoList, container, vgmSubmitted);
  const payload = await apiRequest(COMPLIANCE_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: config.signal
  }, { fetchImpl: config.fetchImpl, timeoutMs: config.timeoutMs ?? 30_000 });
  return adaptAiComplianceReport(payload);
}

export async function fetchRegulationList(config = {}) {
  const payload = await apiRequest('/api/compliance/regulations', {}, config);
  return unwrapApiData(payload);
}

export async function fetchRegulationDetail(docId, config = {}) {
  const payload = await apiRequest(`/api/compliance/regulation/${encodeURIComponent(docId)}`, {}, config);
  const detail = unwrapApiData(payload);
  if (!detail || typeof detail !== 'object' || !Array.isArray(detail.sections) || !detail.sections.length) {
    const error = new Error('法规详情返回为空，本地 PDF 证据仍可用，可重试远程详情。');
    error.reason = 'contract';
    throw error;
  }
  return detail;
}

export async function searchRegulations(query, config = {}) {
  const payload = await apiRequest('/api/compliance/hybrid-search', {
    method: 'POST',
    body: JSON.stringify({ query, topK: 3, maxResults: 5 }),
    signal: config.signal
  }, config);
  return unwrapApiData(payload);
}

function inferStatus(rows) {
  if (rows.some((row) => String(row.result).toUpperCase() === 'FAIL')) return 'FAIL';
  if (rows.some((row) => String(row.result).toUpperCase() === 'WARNING')) return 'WARNING';
  return 'PASS';
}
