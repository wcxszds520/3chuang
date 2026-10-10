import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/playwright/stage3/report');
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1672, height: 941 }, acceptDownloads: true });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const responseErrors = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', (response) => response.status() >= 400 && responseErrors.push(`${response.status()} ${response.url()}`));

const result = {
  assertions: {},
  expected: {},
  ui: {},
  html: {},
  csv: {},
  json: {},
  files: {},
  consoleErrors,
  pageErrors,
  responseErrors
};

try {
  await loadOfficialBackendPlan(page);
  await seedComplianceLayers(page);
  const session = await getSession(page);
  const plan = session.backendPlan;
  const expected = {
    orderNo: 'NB2026-DEMO-01',
    skuCount: 10,
    totalInput: 221,
    destinationPortCount: 3,
    containerType: '40HQ',
    loadedCount: 221,
    unloadedCount: 0,
    utilization: Number(plan.spaceUtilization),
    totalWeight: Number(plan.totalWeight),
    cog: plan.cog,
    cogOffset: plan.cogOffset,
    lifoCompliant: true,
    algorithmId: 'fast-block',
    evidenceCount: 7,
    aiStatus: 'PASS',
    aiScore: 96,
    manualDecision: 'approved-with-conditions',
    manualReviewer: 'stage3-report-reviewer',
    planId: plan.planId,
    placementFingerprint: fingerprintPlacements(plan.loadedCargo)
  };
  result.expected = expected;

  await page.goto(`${baseUrl}/#/report`, { waitUntil: 'networkidle' });
  await page.locator('.report-page').waitFor();
  result.ui = await page.locator('.report-page').evaluate((node) => ({ ...node.dataset }));
  assert.deepEqual({
    orderNo: result.ui.orderNo,
    skuCount: Number(result.ui.skuCount),
    totalInput: Number(result.ui.totalInput),
    portCount: Number(result.ui.portCount),
    containerType: result.ui.containerType,
    loadedCount: Number(result.ui.loadedCount),
    unloadedCount: Number(result.ui.unloadedCount),
    evidenceCount: Number(result.ui.evidenceCount)
  }, {
    orderNo: expected.orderNo,
    skuCount: expected.skuCount,
    totalInput: expected.totalInput,
    portCount: expected.destinationPortCount,
    containerType: expected.containerType,
    loadedCount: expected.loadedCount,
    unloadedCount: expected.unloadedCount,
    evidenceCount: expected.evidenceCount
  });
  assert.match(await page.locator('.report-sheet').innerText(), /221\/221 件/);
  assert.match(await page.locator('.delivery-integrity').innerText(), /10 个 SKU \/ 221 件已装 \/ 0 件未装/);
  result.assertions.reportUiUsesCurrentBackendPlan = true;

  const htmlPath = path.join(outputDir, 'stage3-report.html');
  const csvPath = path.join(outputDir, 'stage3-cargo.csv');
  const jsonPath = path.join(outputDir, 'stage3-report.json');
  await download(page, page.getByRole('button', { name: '下载 HTML 报告', exact: true }), htmlPath);
  await download(page, page.getByRole('button', { name: /CSV 逐件坐标明细/ }), csvPath);
  await download(page, page.getByRole('button', { name: /JSON 完整数据/ }), jsonPath);

  const [html, csvText, jsonText] = await Promise.all([
    fs.readFile(htmlPath, 'utf8'),
    fs.readFile(csvPath, 'utf8'),
    fs.readFile(jsonPath, 'utf8')
  ]);
  const json = JSON.parse(jsonText);
  const csvRows = parseCsv(csvText.replace(/^\uFEFF/, ''));
  const csvHeader = csvRows[0];
  const csvRecords = csvRows.slice(1).map((row) => Object.fromEntries(csvHeader.map((header, index) => [header, row[index]])));

  for (const value of [expected.orderNo, expected.planId, '装入 221 / 221 件', '未装 0 件', 'SKU 10 个', '目的港 3 个', '法规证据索引', '本地结构化证据包', expected.manualReviewer, '96 分 · PASS']) {
    assert.ok(html.includes(value), `HTML 缺少 ${value}`);
  }
  for (const cargo of session.cargo) assert.ok(html.includes(cargo.sku), `HTML 缺少 ${cargo.sku}`);
  assert.ok(html.includes(Number(expected.utilization).toFixed(2)));
  assert.ok(html.includes(Number(expected.cog.x).toFixed(2)));
  assert.ok(html.includes(Number(expected.cogOffset.longitudinal).toFixed(2)));
  result.html = {
    bytes: Buffer.byteLength(html),
    orderNo: html.includes(expected.orderNo),
    planId: html.includes(expected.planId),
    skuCountReferenced: session.cargo.filter((cargo) => html.includes(cargo.sku)).length,
    evidenceIndex: html.includes('法规证据索引'),
    aiStatus: html.includes('96 分 · PASS'),
    manualReviewer: html.includes(expected.manualReviewer)
  };
  result.assertions.htmlContentRereadMatches = true;

  assert.deepEqual(csvHeader, [
    '订单号', '方案编号', '记录状态', '货物ID', '原货物ID', '货物名称', 'SKU', '批次ID', '批次名称',
    '目的港', '港序', '作业方式', 'Actor', '目标X(mm)', '目标Y(mm)', '目标Z(mm)', '长(mm)', '宽(mm)', '高(mm)',
    '单重(kg)', '包装类型', '易碎', '重货', '木包装', '风险备注', '未装原因', '数据来源'
  ]);
  assert.equal(csvRecords.length, expected.loadedCount);
  assert.ok(csvRecords.every((record) => record['订单号'] === expected.orderNo && record['方案编号'] === expected.planId && record['记录状态'] === '已装'));
  assert.ok(csvRecords.every((record) => ['目标X(mm)', '目标Y(mm)', '目标Z(mm)'].every((key) => Number.isFinite(Number(record[key])))));
  assert.equal(new Set(csvRecords.map((record) => record.SKU)).size, expected.skuCount);
  assert.equal(new Set(csvRecords.map((record) => record['目的港'])).size, expected.destinationPortCount);
  assert.ok(csvRecords.every((record) => record['批次ID'] && record['作业方式'] && record.Actor));
  assert.deepEqual(new Set(csvRecords.map((record) => record.Actor)), new Set(['manual-worker', 'forklift']));
  const csvPlacementFingerprint = fingerprintPlacements(csvRecords.map((record) => ({
    cargoId: record['货物ID'],
    sku: record.SKU,
    batchId: record['批次ID'],
    handlingMethod: record['作业方式'],
    destinationPort: record['目的港'],
    portSequence: Number(record['港序']),
    x: Number(record['目标X(mm)']),
    y: Number(record['目标Y(mm)']),
    z: Number(record['目标Z(mm)']),
    l: Number(record['长(mm)']),
    w: Number(record['宽(mm)']),
    h: Number(record['高(mm)'])
  })));
  assert.equal(csvPlacementFingerprint, expected.placementFingerprint);
  result.csv = {
    bytes: Buffer.byteLength(csvText),
    rows: csvRecords.length,
    columns: csvHeader.length,
    skuCount: new Set(csvRecords.map((record) => record.SKU)).size,
    portCount: new Set(csvRecords.map((record) => record['目的港'])).size,
    actors: [...new Set(csvRecords.map((record) => record.Actor))],
    placementFingerprint: csvPlacementFingerprint
  };
  result.assertions.csvCoordinatesBatchActorRereadMatch = true;

  assert.equal(json.schemaVersion, 2);
  assert.deepEqual(json.summary, {
    orderNo: expected.orderNo,
    skuCount: expected.skuCount,
    totalInput: expected.totalInput,
    destinationPortCount: expected.destinationPortCount,
    containerType: expected.containerType,
    loadedCount: expected.loadedCount,
    unloadedCount: expected.unloadedCount,
    utilization: expected.utilization,
    totalWeight: expected.totalWeight,
    cog: expected.cog,
    cogOffset: expected.cogOffset,
    lifoCompliant: expected.lifoCompliant,
    algorithmId: expected.algorithmId,
    evidenceCount: expected.evidenceCount,
    actorCounts: countActors(plan.loadedCargo)
  });
  assert.equal(json.order.orderNo, expected.orderNo);
  assert.equal(json.cargo.length, expected.skuCount);
  assert.equal(json.plan.loadedCargo.length, expected.loadedCount);
  assert.equal(json.plan.unloadedCargo.length, expected.unloadedCount);
  assert.equal(fingerprintPlacements(json.plan.loadedCargo), expected.placementFingerprint);
  assert.equal(json.regulationEvidence.length, expected.evidenceCount);
  assert.equal(new Set(json.regulationEvidence.map((item) => item.documentId)).size, 3);
  assert.ok(json.regulationEvidence.every((item) => item.documentId && item.documentTitle && item.sourceType === 'local-regulation-pack' && item.pageNumber && item.snippet && item.ruleName && item.ruleResult && item.hitReason));
  assert.equal(json.compliance.localStatus, 'WARNING');
  assert.equal(json.compliance.aiStatus, expected.aiStatus);
  assert.equal(json.compliance.manualStatus, expected.manualDecision);
  assert.equal(json.aiAudit.status, expected.aiStatus);
  assert.equal(json.aiAudit.score, expected.aiScore);
  assert.equal(json.manualReview.decision, expected.manualDecision);
  assert.equal(json.manualReview.reviewer, expected.manualReviewer);
  result.json = {
    bytes: Buffer.byteLength(jsonText),
    schemaVersion: json.schemaVersion,
    summary: json.summary,
    placementFingerprint: fingerprintPlacements(json.plan.loadedCargo),
    evidenceCount: json.regulationEvidence.length,
    evidenceDocuments: new Set(json.regulationEvidence.map((item) => item.documentId)).size,
    localStatus: json.compliance.localStatus,
    aiStatus: json.aiAudit.status,
    manualDecision: json.manualReview.decision
  };
  result.assertions.jsonPlanComplianceEvidenceRereadMatch = true;

  result.files = {
    html: { path: htmlPath, bytes: (await fs.stat(htmlPath)).size },
    csv: { path: csvPath, bytes: (await fs.stat(csvPath)).size },
    json: { path: jsonPath, bytes: (await fs.stat(jsonPath)).size }
  };
  await page.screenshot({ path: path.join(outputDir, 'report-page.png'), fullPage: true });
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(responseErrors, []);
  result.assertions.allThreeExportsAreContentConsistent = true;
  await fs.writeFile(path.join(outputDir, 'export-consistency.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.failure = { message: error.message, stack: error.stack };
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(outputDir, 'export-consistency.json'), `${JSON.stringify(result, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}

async function loadOfficialBackendPlan(targetPage) {
  await targetPage.goto(`${baseUrl}/#/cargo`, { waitUntil: 'networkidle' });
  await targetPage.evaluate(() => {
    localStorage.removeItem('yonggui.web.session.v1');
    localStorage.removeItem('yonggui.web.session.v2');
  });
  await targetPage.reload({ waitUntil: 'networkidle' });
  await targetPage.goto(`${baseUrl}/#/container`, { waitUntil: 'networkidle' });
  await targetPage.getByRole('button', { name: '生成真实方案', exact: true }).click();
  await targetPage.getByText('后端真实方案', { exact: true }).first().waitFor({ timeout: 75_000 });
}

async function seedComplianceLayers(targetPage) {
  await targetPage.waitForTimeout(220);
  await targetPage.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('yonggui.web.session.v2'));
    const at = '2026-07-11T12:00:00.000Z';
    const rows = ['vgm', 'weight', 'lifo', 'cog', 'stacking', 'documents', 'completeness'].map((key) => ({
      key,
      dimension: key,
      standard: '本地确定性规则',
      actual: `AI 解释 ${key}`,
      result: 'PASS',
      sourceRef: '后端 AI 审计解释'
    }));
    session.aiAudit = {
      status: 'PASS',
      score: 96,
      rows,
      advice: 'AI 解释已完成，不覆盖本地规则。',
      risks: [],
      source: 'backend-ai',
      sourceLabel: '后端 AI 审计解释',
      completedAt: at
    };
    session.aiAuditStatus = 'ready';
    session.aiAuditError = null;
    session.manualReview = {
      reviewer: 'stage3-report-reviewer',
      decision: 'approved-with-conditions',
      note: '补齐 VGM 回执与 IPPC 标识照片后放行。',
      reviewedAt: '2026-07-11T12:05:00.000Z'
    };
    session.complianceHistory = [
      { id: 'ai-stage3', type: 'ai-audit', at, status: 'PASS', score: 96, source: 'backend-ai' },
      { id: 'manual-stage3', type: 'manual-review', at: session.manualReview.reviewedAt, ...session.manualReview }
    ];
    localStorage.setItem('yonggui.web.session.v2', JSON.stringify(session));
  });
  await targetPage.reload({ waitUntil: 'networkidle' });
  const seeded = await targetPage.evaluate(() => JSON.parse(localStorage.getItem('yonggui.web.session.v2')));
  assert.equal(seeded.aiAudit?.status, 'PASS');
  assert.equal(seeded.manualReview?.decision, 'approved-with-conditions');
}

async function download(targetPage, button, targetPath) {
  const downloadPromise = targetPage.waitForEvent('download');
  await button.click();
  const artifact = await downloadPromise;
  await artifact.saveAs(targetPath);
  const failure = await artifact.failure();
  assert.equal(failure, null);
  const stats = await fs.stat(targetPath);
  assert.ok(stats.size > 100);
}

async function getSession(targetPage) {
  return targetPage.evaluate(() => JSON.parse(localStorage.getItem('yonggui.web.session.v2')));
}

function fingerprintPlacements(items = []) {
  const canonical = items.map((item) => ({
    cargoId: item.cargoId,
    sku: item.sku,
    batchId: item.batchId,
    handlingMethod: item.handlingMethod,
    destinationPort: item.destinationPort,
    portSequence: Number(item.portSequence),
    x: Number(item.x),
    y: Number(item.y),
    z: Number(item.z),
    l: Number(item.l),
    w: Number(item.w),
    h: Number(item.h)
  }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function countActors(items = []) {
  return items.reduce((counts, item) => {
    counts[item.handlingMethod === 'manual' ? 'manual' : 'forklift'] += 1;
    return counts;
  }, { manual: 0, forklift: 0 });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\r' && text[index + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      index += 1;
    } else cell += character;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
