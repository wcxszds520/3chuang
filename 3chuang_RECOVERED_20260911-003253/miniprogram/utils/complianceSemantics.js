function normalizeRuleStatus(value) {
  const status = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return ['PASS', 'WARNING', 'FAIL', 'REVIEW_REQUIRED'].includes(status) ? status : 'REVIEW_REQUIRED';
}

function normalizeHumanReview(value) {
  const raw = typeof value === 'object' && value ? value.status || value.decision : value;
  const status = String(raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return ['APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED'].includes(status) ? status : 'UNREVIEWED';
}

function deriveWorkflowDecision(humanReview) {
  const status = normalizeHumanReview(humanReview);
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'APPROVED_WITH_CONDITIONS') return 'REVIEWED_WITH_CONDITIONS';
  if (status === 'APPROVED') return 'REVIEWED';
  return 'READY';
}

function summarizeCompliance(summary) {
  if (!summary) return null;
  const humanReview = normalizeHumanReview(summary.humanReview);
  return {
    ruleStatus: normalizeRuleStatus(summary.ruleStatus || summary.deterministic?.status || summary.status),
    humanReview,
    workflowDecision: summary.workflowDecision || deriveWorkflowDecision(humanReview)
  };
}

module.exports = { normalizeRuleStatus, normalizeHumanReview, deriveWorkflowDecision, summarizeCompliance };
