import { describe, expect, it } from 'vitest';
import { buildComplianceEvidence, REGULATION_DOCUMENTS } from './regulationEvidence.js';

describe('local regulation PDF evidence index', () => {
  it('maps seven rules to the complete local multi-page PDF evidence pack', () => {
    const rows = ['vgm', 'weight', 'lifo', 'cog', 'stacking', 'documents', 'completeness']
      .map((key) => ({ key, result: 'PASS', actual: `${key} 实测值`, standard: `${key} 阈值`, sourceRef: `${key} 来源` }));
    const evidence = buildComplianceEvidence(rows);

    expect(REGULATION_DOCUMENTS).toHaveLength(9);
    expect(REGULATION_DOCUMENTS.every((document) => document.pdfPath.endsWith('.pdf') && document.renderedPages.length >= 2)).toBe(true);
    expect(new Set(evidence.map((item) => item.documentId)).size).toBe(5);
    expect(evidence).toHaveLength(7);
    expect(evidence.every((item) => item.documentId
      && item.documentTitle
      && item.sourceType === 'local-regulation-excerpt'
      && item.pageNumber > 0
      && item.snippet
      && item.ruleName
      && item.ruleResult === 'PASS'
      && item.hitReason
      && item.bbox.length === 4
      && item.sectionId)).toBe(true);
  });
});
