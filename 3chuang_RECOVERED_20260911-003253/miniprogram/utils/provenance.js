const PLAN_SOURCE_CODES = Object.freeze({
  LOCAL_PREVIEW: 'LOCAL_PREVIEW',
  BACKEND_SOLVED: 'BACKEND_SOLVED',
  OFFLINE_DEMO: 'OFFLINE_DEMO',
  UNKNOWN: 'UNKNOWN'
});

const LABELS = Object.freeze({
  LOCAL_PREVIEW: '本地预览（非正式求解）',
  BACKEND_SOLVED: '后端正式求解',
  OFFLINE_DEMO: '离线演示数据',
  UNKNOWN: '来源未确认'
});

function normalizePlanSource(plan) {
  const value = typeof plan === 'object' && plan ? plan.sourceCode || plan.source : plan;
  if (Object.values(PLAN_SOURCE_CODES).includes(value)) return value;
  if (plan?.offlineMode || plan?.fallback || value === 'offline-demo') return PLAN_SOURCE_CODES.OFFLINE_DEMO;
  if (value === 'backend' || plan?.planId) return PLAN_SOURCE_CODES.BACKEND_SOLVED;
  if (value === 'local-preview') return PLAN_SOURCE_CODES.LOCAL_PREVIEW;
  return PLAN_SOURCE_CODES.UNKNOWN;
}

function getPlanSourceLabel(plan) {
  return LABELS[normalizePlanSource(plan)];
}

module.exports = { PLAN_SOURCE_CODES, normalizePlanSource, getPlanSourceLabel };
