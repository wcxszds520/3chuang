const LABELS = Object.freeze({
  STABLE: '稳定',
  EMPTY_CTU: '箱内已空',
  DATA_REQUIRED: '待补资料',
  BACKEND_SOLVED: '方案已求解',
  LOCAL_PREVIEW: '本地预览',
  REFERENCE_PROFILE: '参考箱型',
  ACTUAL_CONTAINER: '实际箱',
  WITHIN_GENERAL_GUIDANCE: '一般指导范围内',
  PARTICULAR_CIRCUMSTANCES_REVIEW: '需要工程复核',
  COMPLETE_FOR_GUIDANCE: '证据已满足指导计算',
  GUIDANCE_BAND: '重心指导区间',
  OUTSIDE_GUIDANCE: '超出指导范围',
  FULL_UNLOAD_PASS: '逐港卸载通过',
  EXTERNAL_CONFIRMATION_REQUIRED: '需外部确认',
  REVIEW_REQUIRED: '需责任人复核',
  READY: '本项已就绪',
  BLOCKED: '阻断',
  NOT_APPLICABLE: '不适用',
  SPACE: '空间优先',
  BALANCE: '平衡优先',
  OPERATION: '作业优先',
  VALID: '硬约束通过',
  INVALID: '硬约束未通过',
  SECURING_NOT_REQUIRED: '未触发附加系固区',
  SECURING_REQUIRED: '需要系固方案',
  SECURING_UNRESOLVED: '系固能力待复核',
  USER_CONFIRMATION_REQUIRED: '待用户确认',
  USER_CONFIRMED: '用户已确认',
  LEGACY_MAPPED: '旧数据已映射',
  NO_LIVE_TERMINAL_API: '无实时码头接口'
});

export function zhEnum(value, fallback = '待确认') {
  if (value === null || value === undefined || value === '') return fallback;
  return LABELS[String(value).toUpperCase()] || String(value);
}

export function readinessTone(status) {
  return ({ READY: 'ready', BLOCKED: 'FAIL', DATA_REQUIRED: 'warning', EXTERNAL_CONFIRMATION_REQUIRED: 'info', REVIEW_REQUIRED: 'warning', NOT_APPLICABLE: 'neutral' })[status] || 'neutral';
}

export function ruleLevelLabel(level) {
  return ({ LEGAL_REQUIREMENT: '法律要求', ENGINEERING_GUIDANCE: '工程指导', PORT_TERMINAL_CONSTRAINT: '港口/码头约束', REFERENCE_DATA: '参考资料', PROJECT_POLICY: '项目策略' })[level] || level || '未分级';
}

export const CHINESE_ENUM_LABELS = LABELS;
