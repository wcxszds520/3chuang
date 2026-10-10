'use strict';

const { AIComplianceService } = require('../../services/AIComplianceService');

describe('AIComplianceService authority boundary', () => {
  test('AI explanation cannot replace deterministic status, score, or metrics', async () => {
    const deterministic = {
      engine: 'DeterministicComplianceEngine',
      source: 'deterministic-rules',
      status: 'FAIL',
      score: 61,
      summary: { longitudinalOffset: 11.278, actualWeight: 28001 },
      issues: [{ key: 'payload', result: 'FAIL', actual: '28001 kg' }],
      reportTable: [{
        key: 'payload',
        dimension: '累计有效载荷',
        standard: '累计货重不得超过 max payload',
        actual: '28001 kg',
        result: 'FAIL',
        ruleSource: 'deterministic'
      }]
    };
    const service = new AIComplianceService({
      rules: { evaluate: jest.fn(() => deterministic) },
      explainer: {
        explain: jest.fn(async () => ({
          text: '建议复核载重。',
          source: 'ai-explanation',
          model: 'test-model',
          status: 'PASS',
          score: 100,
          summary: { longitudinalOffset: 0 }
        }))
      }
    });

    const report = await service.generateComplianceReport({});

    expect(report.status).toBe('FAIL');
    expect(report.score).toBe(61);
    expect(report.summary.longitudinalOffset).toBe(11.278);
    expect(report.reportTable[0].result).toBe('FAIL');
    expect(report.advice).toBe('建议复核载重。');
    expect(report.aiExplanation).toMatchObject({ authority: 'EXPLANATION_ONLY' });
  });
});
