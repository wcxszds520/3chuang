export const PLAN_SOURCE_CODES = Object.freeze({
  LOCAL_PREVIEW: 'LOCAL_PREVIEW',
  BACKEND_SOLVED: 'BACKEND_SOLVED',
  OFFLINE_DEMO: 'OFFLINE_DEMO',
  UNKNOWN: 'UNKNOWN'
});

const LEGACY_SOURCE_CODES = Object.freeze({
  'local-preview': PLAN_SOURCE_CODES.LOCAL_PREVIEW,
  backend: PLAN_SOURCE_CODES.BACKEND_SOLVED,
  'offline-demo': PLAN_SOURCE_CODES.OFFLINE_DEMO
});

const SOURCE_LABELS = Object.freeze({
  [PLAN_SOURCE_CODES.LOCAL_PREVIEW]: '方案预览',
  [PLAN_SOURCE_CODES.BACKEND_SOLVED]: '装载方案',
  [PLAN_SOURCE_CODES.OFFLINE_DEMO]: '示例方案',
  [PLAN_SOURCE_CODES.UNKNOWN]: '来源未确认'
});

export function normalizePlanSource(source) {
  const value = typeof source === 'object' && source
    ? source.sourceCode || source.source
    : source;
  if (Object.values(PLAN_SOURCE_CODES).includes(value)) return value;
  return LEGACY_SOURCE_CODES[value] || PLAN_SOURCE_CODES.UNKNOWN;
}

export function getPlanSourceLabel(source) {
  if (source?.study?.purpose === 'SPACE_STUDY') return '空间方案';
  return SOURCE_LABELS[normalizePlanSource(source)];
}

export function isBackendSolved(source) {
  return normalizePlanSource(source) === PLAN_SOURCE_CODES.BACKEND_SOLVED;
}
