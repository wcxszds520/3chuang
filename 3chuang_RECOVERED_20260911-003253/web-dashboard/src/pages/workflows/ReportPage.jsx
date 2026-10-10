import { useMemo, useState } from 'react';
import { Braces, CheckCircle2, Download, FileCode2, FileSpreadsheet, Printer, TriangleAlert } from 'lucide-react';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { useFeedback } from '../../components/feedback/FeedbackProvider.jsx';
import { SourceNote, StatusPill } from '../../components/common/Status.jsx';
import { PlanProjection } from '../../components/visual/PlanProjection.jsx';
import { evaluateLocalCompliance } from '../../domain/compliance/evaluate.js';
import { getHumanReviewLabel, resolveDeliveryCompliance } from '../../domain/compliance/statusModel.js';
import { buildComplianceEvidence } from '../../domain/compliance/regulationEvidence.js';
import {
  buildCargoCsv,
  buildReportFilename,
  buildReportHtml,
  buildReportModel,
  serializeReportJson
} from '../../domain/report/reportBuilders.js';
import { downloadTextFile, printHtmlReport } from '../../services/downloads.js';
import { PAGE_COPY } from '../../domain/presentation/productCopy.js';
import { PRODUCT_METADATA } from '../../domain/presentation/productMetadata.js';
import { getPlanSourceLabel, isBackendSolved, normalizePlanSource } from '../../domain/provenance/planSource.js';

const REPORT_CHAPTERS = Object.freeze([
  { id: 'plan', label: '装柜方案', kicker: '第 01 章' },
  { id: 'compliance', label: '合规摘要', kicker: '第 02 章' },
  { id: 'evidence', label: '法规证据', kicker: '第 03 章' },
  { id: 'manual', label: '人工复核', kicker: '第 04 章' }
]);

export default function ReportPage() {
  const { session, activePlan, container, planSource } = useSession();
  const { notify } = useFeedback();
  const [chapter, setChapter] = useState(0);
  const localCompliance = useMemo(() => evaluateLocalCompliance({
    plan: activePlan,
    cargoList: session.cargo,
    container,
    vgmSubmitted: session.vgmSubmitted
  }), [activePlan, session.cargo, session.vgmSubmitted, container]);
  const deliveryCompliance = useMemo(() => resolveDeliveryCompliance(localCompliance, session.aiAudit, session.manualReview), [localCompliance, session.aiAudit, session.manualReview]);
  const regulationEvidence = useMemo(() => buildComplianceEvidence(localCompliance.rows), [localCompliance.rows]);
  const model = useMemo(() => buildReportModel({ session, plan: activePlan, compliance: deliveryCompliance, container }), [session, activePlan, deliveryCompliance, container]);
  const html = useMemo(() => buildReportHtml(model), [model]);

  const download = (format) => {
    try {
      const content = format === 'html' ? html : format === 'csv' ? buildCargoCsv(model) : serializeReportJson(model);
      const mimeType = format === 'html' ? 'text/html;charset=utf-8' : format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
      const result = downloadTextFile({ content, filename: buildReportFilename(session.order.orderNo, format, model.provenance.dataset), mimeType });
      notify(`${result.filename} 已生成（${result.bytes.toLocaleString()} bytes）`, { variant: 'success' });
    } catch (error) {
      notify(error.message || '文件生成失败', { variant: 'error' });
    }
  };
  const print = () => {
    try {
      printHtmlReport(html);
      notify('已打开浏览器打印，可选择“另存为 PDF”', { variant: 'info' });
    } catch (error) {
      notify(error.message, { variant: 'error' });
    }
  };

  const unloaded = Math.max(activePlan.unloadedCargo?.length || 0, Number(activePlan.totalCargoInput || 0) - Number(activePlan.totalCargoCount || 0));

  return (
    <div className="page report-page" data-order-no={model.summary.orderNo} data-sku-count={model.summary.skuCount} data-total-input={model.summary.totalInput} data-port-count={model.summary.destinationPortCount} data-container-type={model.summary.containerType} data-loaded-count={model.summary.loadedCount} data-unloaded-count={model.summary.unloadedCount} data-evidence-count={model.summary.evidenceCount}>
      <header className="page-header">
        <div><span className="page-kicker">DELIVERY WORKSPACE</span><h1>{PAGE_COPY.report.title}</h1><p>{PAGE_COPY.report.subtitle}</p></div>
        <button className="button button--primary" type="button" onClick={() => download('html')}><Download size={18} />下载 HTML 报告</button>
      </header>

      <div className="report-layout">
        <div className="report-document">
          <nav className="report-chapters" role="tablist" aria-label="报告章节">{REPORT_CHAPTERS.map((item, index) => <button id={`report-tab-${item.id}`} role="tab" aria-selected={chapter === index} aria-controls={`report-chapter-${item.id}`} className={chapter === index ? 'active' : ''} type="button" key={item.id} onClick={() => setChapter(index)}>{item.label}</button>)}</nav>
          <article className="report-sheet" data-paper="a4">
            <header className="report-sheet__header"><div><span>{PRODUCT_METADATA.name} · {model.document.label}</span><h2>{model.document.title}</h2><p>{session.order.orderNo} · {session.order.route} · {session.order.vessel}</p>{model.provenance.dataset === 'DEMO_DATA' && <strong className="report-demo-mark">DEMO DATA</strong>}</div><div className="report-stamp"><StatusPill status={deliveryCompliance.ruleStatus}>RULE {deliveryCompliance.ruleStatus}</StatusPill><small>WORKFLOW {deliveryCompliance.workflowDecision}</small></div></header>

            <section className="report-chapter" id={`report-chapter-${REPORT_CHAPTERS[chapter].id}`} role="tabpanel" aria-labelledby={`report-tab-${REPORT_CHAPTERS[chapter].id}`}>
              <div className="report-chapter__heading"><span>{REPORT_CHAPTERS[chapter].kicker}</span><h3>{REPORT_CHAPTERS[chapter].label}</h3><p>{chapterDescription(chapter)}</p></div>

              {chapter === 0 && <>
                <section className="report-summary"><dl><div><dt>柜型</dt><dd>{container.typeId}</dd></div><div><dt>装入</dt><dd>{activePlan.totalCargoCount}/{activePlan.totalCargoInput} 件</dd></div><div><dt>空间利用率</dt><dd>{Number(activePlan.spaceUtilization || 0).toFixed(1)}%</dd></div><div><dt>横向重心</dt><dd>{Number(activePlan.cogOffset?.lateral || 0).toFixed(2)}%</dd></div></dl><SourceNote>{getPlanSourceLabel(activePlan)}</SourceNote></section>
                <PlanProjection plan={activePlan} compact showLegend={false} />
                <dl className="report-plan-meta"><div><dt>方案来源</dt><dd>{getPlanSourceLabel(activePlan)}</dd>{isBackendSolved(planSource) && <details className="trace-details"><summary>追溯信息</summary><code>{activePlan.planId}</code></details>}</div><div><dt>未装货物</dt><dd className={unloaded ? 'text-danger' : ''}>{unloaded} 件</dd></div><div><dt>作业门端</dt><dd>集装箱后门 · 双开门</dd></div><div><dt>作业主体</dt><dd>人工 {model.summary.actorCounts.manual} 件 · 叉车 {model.summary.actorCounts.forklift} 件</dd></div></dl>
              </>}

              {chapter === 1 && <>
                <div className="report-checks">{deliveryCompliance.rows.map((row) => <div key={row.key}><StatusPill status={row.result}>{row.result}</StatusPill><span><strong>{row.dimension}</strong>{row.actual}</span></div>)}</div>
                <div className={`report-conclusion ${deliveryCompliance.ruleStatus === 'FAIL' ? 'report-conclusion--danger' : ''}`}>{deliveryCompliance.ruleStatus === 'FAIL' ? <TriangleAlert size={21} /> : <CheckCircle2 size={21} />}<p>{deliveryCompliance.finalDescription}</p></div>
              </>}

              {chapter === 2 && <>
                <dl className="report-evidence"><div><dt>本地法规摘编包</dt><dd>{new Set(regulationEvidence.map((item) => item.documentId)).size} 份多页 PDF</dd></div><div><dt>规则证据索引</dt><dd>{regulationEvidence.length} 条</dd></div><div><dt>后端规则 / AI 解释来源</dt><dd>{session.aiAudit?.sourceLabel || '未运行'}</dd></div><div><dt>证据状态</dt><dd>本地摘编 / 页码 / 参考条款已索引</dd></div></dl>
                <div className="report-citations">{regulationEvidence.map((item) => <article key={item.ruleId}><strong>{item.ruleName} · {item.ruleResult}</strong><p>{item.documentTitle} · 第 {item.pageNumber} 页 · {item.sectionId}</p><small>{item.snippet}</small></article>)}</div>
              </>}

              {chapter === 3 && <>
                {session.manualReview ? <div className="report-manual-record"><span>{getHumanReviewLabel(session.manualReview)}</span><h4>{session.manualReview.reviewer}</h4><time>{formatDate(session.manualReview.reviewedAt)}</time><p>{session.manualReview.note || '复核人未填写附加说明。'}</p></div> : <div className="report-manual-empty"><strong>尚无人工复核</strong><p>当前报告保留确定性规则预审与 AI 解释；提交人工结论后，本章将显示复核人、时间与备注。</p></div>}
                <dl className="report-evidence"><div><dt>RULE STATUS</dt><dd>{deliveryCompliance.ruleStatus}</dd></div><div><dt>HUMAN REVIEW</dt><dd>{deliveryCompliance.humanReview}</dd></div><div><dt>WORKFLOW DECISION</dt><dd>{deliveryCompliance.workflowDecision}</dd></div><div><dt>后端确定性复核</dt><dd>{session.aiAudit ? `${session.aiAudit.score} 分 · ${session.aiAudit.status}（AI 仅解释）` : '未运行'}</dd></div></dl>
              </>}
            </section>

            <footer className="report-sheet__footer"><span>{getPlanSourceLabel(activePlan)}</span><span>DATA CLASSIFICATION {model.provenance.dataset}</span><span>DATA SOURCE {normalizePlanSource(activePlan)} / {deliveryCompliance.source}</span><span className="report-sheet__page-number">第 {chapter + 1} 页 / 共 {REPORT_CHAPTERS.length} 页 · {formatDate(model.generatedAt)}</span></footer>
          </article>
        </div>

        <aside className="delivery-panel">
          <h2>可交付格式</h2><p>所有文件在浏览器本地实时生成；内容包含当前订单号与方案来源。</p>
          <button className="delivery-option" type="button" onClick={() => download('html')}><FileCode2 size={21} /><span><strong>HTML 完整报告</strong><small>管理层与人工阅读</small></span><Download size={17} /></button>
          <button className="delivery-option" type="button" onClick={() => download('csv')}><FileSpreadsheet size={21} /><span><strong>CSV 逐件坐标明细</strong><small>装载明细与数据分析</small></span><Download size={17} /></button>
          <button className="delivery-option" type="button" onClick={() => download('json')}><Braces size={21} /><span><strong>JSON 完整数据</strong><small>系统归档与二次集成</small></span><Download size={17} /></button>
          <button className="delivery-option" type="button" onClick={print}><Printer size={21} /><span><strong>打印 / 另存为 PDF</strong><small>使用浏览器打印能力，不声称后端 PDF</small></span><Printer size={17} /></button>
          <div className="delivery-integrity"><strong>交付完整性</strong><ul><li>文档类型：{model.document.type}</li><li>数据分类：{model.provenance.dataset}</li><li>订单号：{session.order.orderNo}</li><li>方案：{getPlanSourceLabel(activePlan)}（{normalizePlanSource(activePlan)}）</li><li>RULE STATUS：{deliveryCompliance.ruleStatus}</li><li>HUMAN REVIEW：{deliveryCompliance.humanReview}</li><li>WORKFLOW DECISION：{deliveryCompliance.workflowDecision}</li><li>货物：{model.summary.skuCount} 个 SKU / {model.summary.loadedCount} 件已装 / {model.summary.unloadedCount} 件未装</li><li>目的港：{model.summary.destinationPortCount} 个</li><li>法规证据：{model.summary.evidenceCount} 条</li></ul></div>
        </aside>
      </div>
    </div>
  );
}

function chapterDescription(chapter) {
  return [
    '柜型、装入结果、重心与真实装箱坐标概览。',
    '确定性规则状态、AI 解释与独立工作流结论。',
    '当前报告引用的法规目录与逐项规则依据。',
    '最新人工结论、复核人、时间与保留意见。'
  ][chapter];
}
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '—') : date.toLocaleString('zh-CN', { hour12: false });
}
