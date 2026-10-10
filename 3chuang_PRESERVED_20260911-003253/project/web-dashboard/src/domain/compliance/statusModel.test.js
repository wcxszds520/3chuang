import { describe, expect, it } from 'vitest';
import {
  combineRuleStatuses,
  deriveWorkflowDecision,
  normalizeHumanReview,
  resolveComplianceSemantics,
  resolveDeliveryCompliance
} from './statusModel.js';

describe('compliance status model', () => {
  it('keeps the worst deterministic rule result', () => {
    expect(combineRuleStatuses('PASS', 'FAIL')).toBe('FAIL');
    expect(combineRuleStatuses('WARNING', 'PASS')).toBe('WARNING');
  });

  it('normalizes legacy human decisions without changing rule status', () => {
    const result = resolveComplianceSemantics({
      localStatus: 'FAIL',
      backendStatus: 'WARNING',
      manualReview: { decision: 'approved-with-conditions' }
    });
    expect(result).toEqual({
      ruleStatus: 'FAIL',
      humanReview: 'APPROVED_WITH_CONDITIONS',
      workflowDecision: 'REVIEWED_WITH_CONDITIONS'
    });
  });

  it('derives workflow independently of compliance', () => {
    expect(normalizeHumanReview(null)).toBe('UNREVIEWED');
    expect(deriveWorkflowDecision('approved')).toBe('REVIEWED');
    expect(deriveWorkflowDecision('rejected')).toBe('REJECTED');
  });

  it('never turns a deterministic failure into pass after approval', () => {
    const report = resolveDeliveryCompliance(
      { status: 'FAIL', score: 48, rows: [] },
      { status: 'FAIL', score: 48 },
      { decision: 'approved', reviewer: '复核人' }
    );
    expect(report.status).toBe('FAIL');
    expect(report.ruleStatus).toBe('FAIL');
    expect(report.humanReview).toBe('APPROVED');
    expect(report.workflowDecision).toBe('REVIEWED');
  });
});
