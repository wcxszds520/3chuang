import { buildComplianceEvidence } from '../compliance/regulationEvidence.js';
import { normalizePlanSource } from '../provenance/planSource.js';
import { getReportDocumentMetadata, PRODUCT_METADATA } from '../presentation/productMetadata.js';

export function buildReportModel({ session, plan, compliance, container }) {
  const cargo = (session.cargo || []).map((item) => ({ ...item, riskNotes: [...(item.riskNotes || [])] }));
  const clonedPlan = clonePlan(plan);
  const regulationEvidence = buildComplianceEvidence(compliance?.rows || []);
  const dataset = session.dataClassification || cargo.find((item) => item.dataClassification)?.dataClassification || 'UNCLASSIFIED';
  const document = getReportDocumentMetadata(dataset);
  return {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    product: PRODUCT_METADATA.name,
    document,
    order: { ...session.order },
    container: { ...container },
    cargo,
    plan: clonedPlan,
    compliance: clonePlain(compliance),
    aiAudit: clonePlain(session.aiAudit),
    vgmSubmitted: Boolean(session.vgmSubmitted),
    manualReview: session.manualReview ? { ...session.manualReview } : null,
    complianceHistory: (session.complianceHistory || []).map((entry) => ({ ...entry })),
    regulationEvidence,
    summary: buildSummary({ session, plan: clonedPlan, cargo, container, regulationEvidence }),
    provenance: {
      dataset,
      documentType: document.type,
      order: session.order?.source || session.dataSource?.order || 'unknown',
      cargo: session.dataSource?.cargo || 'current-session',
      plan: normalizePlanSource(plan),
      compliance: compliance?.source || 'unknown'
    }
  };
}

export function serializeReportJson(model) {
  return JSON.stringify(model, null, 2);
}

export function buildCargoCsv(model) {
  const headers = [
    '订单号', '方案编号', '记录状态', '货物ID', '原货物ID', '货物名称', 'SKU', '批次ID', '批次名称',
    '目的港', '港序', '作业方式', 'Actor', '目标X(mm)', '目标Y(mm)', '目标Z(mm)', '长(mm)', '宽(mm)', '高(mm)',
    '单重(kg)', '包装类型', '易碎', '重货', '木包装', '风险备注', '未装原因', '数据来源'
  ];
  const lines = [headers.map(csvCell).join(',')];
  const byId = new Map((model.cargo || []).map((cargo) => [String(cargo.cargoId), cargo]));
  for (const item of model.plan?.loadedCargo || []) {
    const originalId = originalCargoId(item.cargoId, byId);
    const cargo = byId.get(originalId) || item;
    lines.push([
      model.order?.orderNo,
      model.plan?.planId,
      '已装',
      item.cargoId,
      originalId,
      item.name || cargo.name,
      item.sku || cargo.sku,
      item.batchId || cargo.batchId,
      item.batchLabel || cargo.batchLabel,
      item.destinationPort || cargo.destinationPort,
      item.portSequence || cargo.portSequence,
      item.handlingMethod || cargo.handlingMethod,
      (item.handlingMethod || cargo.handlingMethod) === 'manual' ? 'manual-worker' : 'forklift',
      item.x,
      item.y,
      item.z,
      item.l || cargo.length,
      item.w || cargo.width,
      item.h || cargo.height,
      item.weight || cargo.weight,
      item.packagingType || cargo.packagingType,
      (item.fragile ?? cargo.fragile) ? '是' : '否',
      (item.heavy ?? cargo.heavy) ? '是' : '否',
      (item.wooden ?? cargo.wooden) ? '是' : '否',
      (item.riskNotes || cargo.riskNotes || []).join('；'),
      '',
      model.provenance?.plan
    ].map(csvCell).join(','));
  }
  for (const item of model.plan?.unloadedCargo || []) {
    const originalId = originalCargoId(item.cargoId, byId);
    const cargo = byId.get(originalId) || item;
    lines.push([
      model.order?.orderNo, model.plan?.planId, '未装', item.cargoId, originalId,
      item.name || cargo.name, item.sku || cargo.sku, item.batchId || cargo.batchId, item.batchLabel || cargo.batchLabel,
      item.destinationPort || cargo.destinationPort, item.portSequence || cargo.portSequence,
      item.handlingMethod || cargo.handlingMethod,
      (item.handlingMethod || cargo.handlingMethod) === 'manual' ? 'manual-worker' : 'forklift',
      '', '', '', item.l || cargo.length, item.w || cargo.width, item.h || cargo.height,
      item.weight || cargo.weight, item.packagingType || cargo.packagingType,
      (item.fragile ?? cargo.fragile) ? '是' : '否', (item.heavy ?? cargo.heavy) ? '是' : '否', (item.wooden ?? cargo.wooden) ? '是' : '否',
      (item.riskNotes || cargo.riskNotes || []).join('；'), item.reason || item.unloadedReason || '未返回原因', model.provenance?.plan
    ].map(csvCell).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

export function buildReportHtml(model) {
  const plan = model.plan || {};
  const compliance = model.compliance || {};
  const document = model.document || getReportDocumentMetadata(model.provenance?.dataset);
  const demoMark = document.classification === 'DEMO_DATA' ? '<strong class="demo-mark">DEMO DATA</strong>' : '';
  const cargoRows = (model.cargo || []).map((cargo) => `
    <tr><td>${html(cargo.sku)}</td><td>${html(cargo.name)}</td><td>${html(cargo.quantity)}</td><td>${html(`${cargo.length}×${cargo.width}×${cargo.height}`)}</td><td>${html(cargo.weight)}</td><td>${html(cargo.destinationPort)}</td></tr>`).join('');
  const checkRows = (compliance.rows || []).map((check) => `
    <tr><td>${html(check.dimension)}</td><td>${html(check.actual)}</td><td>${html(check.result)}</td><td>${html(check.sourceRef)}</td></tr>`).join('');
  const risks = (compliance.risks || []).map((risk) => `<li>${html(risk)}</li>`).join('') || '<li>无已识别风险。</li>';
  const placementRows = (plan.loadedCargo || []).map((item) => `
    <tr><td>${html(item.cargoId)}</td><td>${html(item.sku)}</td><td>${html(item.batchId)}</td><td>${html(item.handlingMethod)}</td><td>${html(item.destinationPort)}</td><td>${html(item.portSequence)}</td><td>${html(item.x)}</td><td>${html(item.y)}</td><td>${html(item.z)}</td></tr>`).join('');
  const evidenceRows = (model.regulationEvidence || []).map((item) => `
    <tr><td>${html(item.ruleName)}</td><td>${html(item.ruleResult)}</td><td>${html(item.documentTitle)}</td><td>${html(item.pageNumber)}</td><td>${html(item.sectionId)}</td><td>${html(item.snippet)}</td><td>${html(item.hitReason)}</td></tr>`).join('');

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${html(model.product)} · ${html(document.title)} · ${html(model.order?.orderNo)}</title>
<style>body{font:14px/1.55 system-ui,"Microsoft YaHei",sans-serif;color:#17201d;max-width:1040px;margin:32px auto;padding:0 24px}h1{font-size:26px}.document-label{color:#5d6a64;letter-spacing:.08em}.demo-mark{display:inline-block;margin:0 0 14px;padding:4px 8px;border:1px solid #b5672d;color:#8d4c20;font-size:12px;letter-spacing:.12em}h2{font-size:17px;margin-top:28px;border-bottom:1px solid #ccd5d0;padding-bottom:8px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f3f6f4;padding:16px}.meta span{display:block;color:#5d6a64;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #d8dfdb;padding:8px;text-align:left;vertical-align:top}th{background:#eef3f0}.source{font-size:12px;color:#5d6a64}@media print{body{margin:0;max-width:none}.no-print{display:none}}</style></head>
<body><p class="document-label">${html(document.label)}</p><h1>${html(model.product)} · ${html(document.title)}</h1>${demoMark}
<div class="meta"><div><span>订单号</span>${html(model.order?.orderNo)}</div><div><span>航线</span>${html(model.order?.route)}</div><div><span>船名/航次</span>${html(model.order?.vessel)}</div><div><span>柜型</span>${html(model.container?.name)}</div><div><span>方案</span>${html(plan.planId)}</div><div><span>RULE STATUS</span>${html(compliance.ruleStatus || compliance.status)} · ${html(compliance.score)} 分</div><div><span>HUMAN REVIEW</span>${html(compliance.humanReview || 'UNREVIEWED')}</div><div><span>WORKFLOW DECISION</span>${html(compliance.workflowDecision || 'READY')}</div></div>
<p class="source">DATA CLASSIFICATION ${html(model.provenance?.dataset)}；来源：订单 ${html(model.provenance?.order)}；货物 ${html(model.provenance?.cargo)}；方案 ${html(model.provenance?.plan)}；合规 ${html(model.provenance?.compliance)}</p>
<h2>方案摘要</h2><p>装入 ${html(plan.totalCargoCount)} / ${html(plan.totalCargoInput)} 件，未装 ${html(plan.unloadedCargo?.length || 0)} 件，SKU ${html(model.summary?.skuCount)} 个，目的港 ${html(model.summary?.destinationPortCount)} 个，空间利用率 ${html(number(plan.spaceUtilization))}%，货重 ${html(number(plan.totalWeight))} kg。</p>
<p>重心 X/Y/Z：${html(number(plan.cog?.x))} / ${html(number(plan.cog?.y))} / ${html(number(plan.cog?.z))} mm；横向/纵向偏移：${html(number(plan.cogOffset?.lateral))}% / ${html(number(plan.cogOffset?.longitudinal))}%。</p>
<h2>货物明细</h2><table><thead><tr><th>SKU</th><th>名称</th><th>数量</th><th>尺寸(mm)</th><th>单重(kg)</th><th>目的港</th></tr></thead><tbody>${cargoRows}</tbody></table>
<h2>合规检查</h2><table><thead><tr><th>维度</th><th>实际</th><th>结果</th><th>依据</th></tr></thead><tbody>${checkRows}</tbody></table>
<h2>逐件装载坐标</h2><table><thead><tr><th>货物ID</th><th>SKU</th><th>批次</th><th>Actor</th><th>目的港</th><th>港序</th><th>X</th><th>Y</th><th>Z</th></tr></thead><tbody>${placementRows}</tbody></table>
<h2>法规证据索引</h2><p>共 ${html(model.regulationEvidence?.length || 0)} 条，来源类型：本地法规摘编证据包。</p><table><thead><tr><th>规则</th><th>结果</th><th>摘编文档</th><th>页码</th><th>参考条款</th><th>依据摘编</th><th>触发原因</th></tr></thead><tbody>${evidenceRows}</tbody></table>
<h2>风险与建议</h2><ul>${risks}</ul><p>${html(compliance.advice)}</p>
<h2>规则、AI 解释与人工复核</h2><p>后端规则复核：${model.aiAudit ? `${html(model.aiAudit.score)} 分 · ${html(model.aiAudit.status)} · ${html(model.aiAudit.sourceLabel)}；AI 不改变数值或结论` : '未运行'}。</p><p>人工：${model.manualReview ? `${html(model.manualReview.reviewer)} · ${html(compliance.humanReview || model.manualReview.decision)} · ${html(model.manualReview.note || '无备注')}` : '尚未提交人工复核。'}</p><p>人工复核只推进 WORKFLOW DECISION，不改写 RULE STATUS。</p>
<p class="source">生成时间：${html(model.generatedAt)}。本报告记录当前会话与方案来源，不替代港口、承运人或监管机构最终审核。</p></body></html>`;
}

function buildSummary({ session, plan, cargo, container, regulationEvidence }) {
  const loadedCargo = plan?.loadedCargo || [];
  const unloadedCargo = plan?.unloadedCargo || [];
  const actorCounts = loadedCargo.reduce((counts, item) => {
    const key = item.handlingMethod === 'manual' ? 'manual' : 'forklift';
    counts[key] += 1;
    return counts;
  }, { manual: 0, forklift: 0 });
  return {
    orderNo: session.order?.orderNo,
    skuCount: cargo.length,
    totalInput: Number(plan?.totalCargoInput ?? cargo.reduce((sum, item) => sum + Number(item.quantity || 0), 0)),
    destinationPortCount: new Set(cargo.map((item) => item.destinationPort).filter(Boolean)).size,
    containerType: container?.typeId,
    loadedCount: Number(plan?.totalCargoCount ?? loadedCargo.length),
    unloadedCount: unloadedCargo.length,
    utilization: Number(plan?.spaceUtilization || 0),
    totalWeight: Number(plan?.totalWeight || 0),
    cog: clonePlain(plan?.cog),
    cogOffset: clonePlain(plan?.cogOffset),
    lifoCompliant: plan?.constraintMeta?.lifoCompliant !== false,
    algorithmId: plan?.ext_algorithmId || plan?.algorithmMeta?.algorithmId || null,
    evidenceCount: regulationEvidence.length,
    actorCounts
  };
}

function originalCargoId(cargoId, byId) {
  const exact = String(cargoId || '');
  if (byId.has(exact)) return exact;
  const stripped = exact.replace(/_\d+$/, '');
  return byId.has(stripped) ? stripped : stripped || exact;
}

export function buildReportFilename(orderNo, extension, dataClassification = '') {
  const withoutControlCharacters = Array.from(String(orderNo || '未命名订单'))
    .map((character) => character.charCodeAt(0) < 32 ? '_' : character)
    .join('');
  const safeOrder = withoutControlCharacters.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '-');
  const safeExtension = String(extension || 'json').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'json';
  const demo = String(dataClassification).toUpperCase() === 'DEMO_DATA' ? '-DEMO' : '';
  return `${PRODUCT_METADATA.shortName}${demo}-${safeOrder}.${safeExtension}`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function html(value) {
  return String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

function clonePlain(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

function clonePlan(plan) {
  return clonePlain(plan) || null;
}
