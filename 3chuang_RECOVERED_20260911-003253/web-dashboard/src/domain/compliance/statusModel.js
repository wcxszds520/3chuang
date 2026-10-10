export const RULE_STATUS_CODES = Object.freeze({
  PASS: 'PASS',
  WARNING: 'WARNING',
  FAIL: 'FAIL',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED'
});

export const HUMAN_REVIEW_CODES = Object.freeze({
  UNREVIEWED: 'UNREVIEWED',
  APPROVED: 'APPROVED',
  APPROVED_WITH_CONDITIONS: 'APPROVED_WITH_CONDITIONS',
  REJECTED: 'REJECTED'
});

export const WORKFLOW_DECISION_CODES = Object.freeze({
  READY: 'READY',
  REVIEWED: 'REVIEWED',
  REVIEWED_WITH_CONDITIONS: 'REVIEWED_WITH_CONDITIONS',
  REJECTED: 'REJECTED'
});

const RULE_SEVERITY = Object.freeze({ PASS: 0, WARNING: 1, REVIEW_REQUIRED: 2, FAIL: 3 });
const HUMAN_REVIEW_LABELS = Object.freeze({
  UNREVIEWED: '未复核',
  APPROVED: '已通过',
  APPROVED_WITH_CONDITIONS: '有条件通过',
  REJECTED: '已驳回'
});
const WORKFLOW_DECISION_LABELS = Object.freeze({
  READY: '待人工复核',
  REVIEWED: '已复核',
  REVIEWED_WITH_CONDITIONS: '已有条件复核',
  REJECTED: '已驳回'
});

export function normalizeRuleStatus(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return RULE_STATUS_CODES[normalized] || RULE_STATUS_CODES.REVIEW_REQUIRED;
}

export function combineRuleStatuses(...values) {
  const statuses = values.filter(Boolean).map(normalizeRuleStatus);
  if (!statuses.length) return RULE_STATUS_CODES.REVIEW_REQUIRED;
  return statuses.reduce((worst, status) => RULE_SEVERITY[status] > RULE_SEVERITY[worst] ? status : worst);
}

export function normalizeHumanReview(review) {
  const value = typeof review === 'object' && review ? review.status || review.decision : review;
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return HUMAN_REVIEW_CODES[normalized] || HUMAN_REVIEW_CODES.UNREVIEWED;
}

export function deriveWorkflowDecision(review) {
  const status = normalizeHumanReview(review);
  if (status === HUMAN_REVIEW_CODES.REJECTED) return WORKFLOW_DECISION_CODES.REJECTED;
  if (status === HUMAN_REVIEW_CODES.APPROVED_WITH_CONDITIONS) return WORKFLOW_DECISION_CODES.REVIEWED_WITH_CONDITIONS;
  if (status === HUMAN_REVIEW_CODES.APPROVED) return WORKFLOW_DECISION_CODES.REVIEWED;
  return WORKFLOW_DECISION_CODES.READY;
}

export function getHumanReviewLabel(review) {
  return HUMAN_REVIEW_LABELS[normalizeHumanReview(review)];
}

export function getWorkflowDecisionLabel(decision) {
  const normalized = String(decision || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const workflowDecision = WORKFLOW_DECISION_CODES[normalized] || deriveWorkflowDecision(decision);
  return WORKFLOW_DECISION_LABELS[workflowDecision] || WORKFLOW_DECISION_LABELS.READY;
}

export function resolveComplianceSemantics({ localStatus, backendStatus, manualReview } = {}) {
  const ruleStatus = combineRuleStatuses(localStatus, backendStatus);
  const humanReview = normalizeHumanReview(manualReview);
  const workflowDecision = deriveWorkflowDecision(humanReview);
  return { ruleStatus, humanReview, workflowDecision };
}

export function resolveDeliveryCompliance(local = {}, ai = null, manualReview = null) {
  const semantics = resolveComplianceSemantics({
    localStatus: local.status,
    backendStatus: ai?.status,
    manualReview
  });
  const localStatus = normalizeRuleStatus(local.status);
  const backendStatus = ai ? normalizeRuleStatus(ai.status) : 'NOT_RUN';
  const reviewedBy = manualReview?.reviewer ? `${manualReview.reviewer} 已提交人工复核` : '尚无人工复核';
  return {
    ...local,
    status: semantics.ruleStatus,
    ruleStatus: semantics.ruleStatus,
    localStatus,
    backendStatus,
    aiStatus: backendStatus,
    humanReview: semantics.humanReview,
    manualStatus: semantics.humanReview,
    workflowDecision: semantics.workflowDecision,
    source: ai ? 'deterministic-rules + ai-explanation' : 'local-deterministic-rules',
    finalLabel: `RULE ${semantics.ruleStatus}`,
    finalDescription: `确定性规则状态为 ${semantics.ruleStatus}；${reviewedBy}，工作流状态为 ${semantics.workflowDecision}。人工结论不改写历史规则结果。`
  };
}
