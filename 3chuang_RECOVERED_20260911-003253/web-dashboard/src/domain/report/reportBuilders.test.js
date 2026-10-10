import { describe, expect, it } from 'vitest';
import { createInitialSession } from '../session/initialSession.js';
import { getContainer } from '../container/catalog.js';
import { generateLocalPreview } from '../container/localPreview.js';
import { evaluateLocalCompliance } from '../compliance/evaluate.js';
import {
  buildCargoCsv,
  buildReportHtml,
  buildReportModel,
  buildReportFilename,
  serializeReportJson
} from './reportBuilders.js';

function fixture() {
  const session = createInitialSession({ dataset: 'legacy' });
  session.order.orderNo = 'NB/2026:0418';
  session.cargo[0].name = '空调, "外机"';
  const container = getContainer(session.selectedContainerType);
  const plan = generateLocalPreview(session.cargo, container);
  const compliance = evaluateLocalCompliance({ plan, cargoList: session.cargo, container, vgmSubmitted: true });
  return { session, container, plan, compliance };
}

describe('report builders', () => {
  it('builds one current-session model with explicit provenance', () => {
    const model = buildReportModel(fixture());
    expect(model.schemaVersion).toBe(3);
    expect(model.order.orderNo).toBe('NB/2026:0418');
    expect(model.plan.planId).toMatch(/^LOCAL_/);
    expect(model.provenance).toMatchObject({ dataset: 'DEMO_DATA', order: 'demo-data', plan: 'LOCAL_PREVIEW', compliance: 'local-rules' });
    expect(model.provenance.documentType).toBe('COMPETITION_DEMO_REPORT');
    expect(model.document).toMatchObject({ title: '竞赛演示报告', classification: 'DEMO_DATA' });
    expect(model.cargo).toHaveLength(10);
    expect(model.regulationEvidence).toHaveLength(7);
    expect(model.summary).toMatchObject({ skuCount: 10, destinationPortCount: 3, evidenceCount: 7 });
  });

  it('serializes valid JSON without replacing the real order number', () => {
    const model = buildReportModel(fixture());
    const parsed = JSON.parse(serializeReportJson(model));
    expect(parsed.order.orderNo).toBe('NB/2026:0418');
    expect(parsed.plan.loadedCargo.length).toBeGreaterThan(0);
  });

  it('escapes commas and quotes in CSV cells', () => {
    const model = buildReportModel(fixture());
    const csv = buildCargoCsv(model);
    expect(csv).toContain('"空调, ""外机"""');
    expect(csv.startsWith('\uFEFF订单号,方案编号,记录状态')).toBe(true);
    expect(csv).toContain('目标X(mm),目标Y(mm),目标Z(mm)');
    expect(csv).toContain('批次ID');
    expect(csv).toContain('Actor');
    expect(csv.split('\r\n')).toHaveLength(model.plan.loadedCargo.length + model.plan.unloadedCargo.length + 1);
  });

  it('escapes user text in printable HTML and includes source labels', () => {
    const model = buildReportModel(fixture());
    model.order.vessel = '<script>alert(1)</script>';
    const html = buildReportHtml(model);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('LOCAL_PREVIEW');
    expect(html).toContain('DATA CLASSIFICATION DEMO_DATA');
    expect(html).toContain('DEMO DELIVERY REPORT');
    expect(html).toContain('DEMO DATA');
    expect(html).toContain('法规证据索引');
    expect(html).toContain('逐件装载坐标');
  });

  it('sanitizes local filenames for Windows', () => {
    expect(buildReportFilename('NB/2026:0418', 'json')).toBe('智港立方-NB_2026_0418.json');
    expect(buildReportFilename('NB/2026:0418', 'json', 'DEMO_DATA')).toBe('智港立方-DEMO-NB_2026_0418.json');
  });
});
