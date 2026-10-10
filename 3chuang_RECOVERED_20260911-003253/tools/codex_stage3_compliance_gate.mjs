import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/playwright/stage3/compliance');
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1672, height: 941 } });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const responseErrors = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', (response) => response.status() >= 400 && responseErrors.push(`${response.status()} ${response.url()}`));

const result = {
  assertions: {},
  pdfDocuments: [],
  linkage: [],
  states: {},
  screenshots: [],
  consoleErrors,
  pageErrors,
  responseErrors
};

try {
  await loadOfficialBackendPlan(page);
  await page.goto(`${baseUrl}/#/compliance`, { waitUntil: 'networkidle' });
  await page.locator('.regulation-workbench').waitFor();
  await waitForPdfImage(page);

  assert.equal(await page.locator('.compliance-page').getAttribute('data-evidence-count'), '7');
  assert.equal(await page.locator('.regulation-workbench').getAttribute('data-source-type'), 'local-regulation-pack');
  assert.equal(await page.locator('.evidence-rule-list [data-rule-id]').count(), 7);
  assert.equal(await page.locator('.audit-stage--ai').getAttribute('data-ai-layer-status'), 'idle');
  assert.equal(await page.locator('.audit-stage--manual').getAttribute('data-manual-layer-status'), 'unreviewed');
  assert.equal(await page.locator('.compliance-conclusion').getAttribute('data-conclusion-source'), 'local-rules');
  assert.equal(await page.getByText('AI 未运行，因此不显示 AI PASS。必须先有当前订单的后端真实装箱方案。', { exact: true }).count(), 1);
  result.assertions.localAiEvidenceManualAreDistinct = true;

  const documents = [
    { id: 'solas-vgm-local-pack', path: '/regulations/solas-vgm-local-pack.pdf', subject: 'VGM' },
    { id: 'ctu-code-local-pack', path: '/regulations/ctu-code-local-pack.pdf', subject: 'CTU' },
    { id: 'ippc-ispm15-local-pack', path: '/regulations/ippc-ispm15-local-pack.pdf', subject: 'IPPC' }
  ];
  for (const document of documents) {
    const response = await context.request.get(`${baseUrl}${document.path}`);
    const body = await response.body();
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'] || '', /application\/pdf/);
    assert.equal(body.subarray(0, 4).toString('ascii'), '%PDF');
    assert.ok(body.length > 10_000);
    result.pdfDocuments.push({
      ...document,
      status: response.status(),
      contentType: response.headers()['content-type'],
      header: body.subarray(0, 8).toString('ascii'),
      bytes: body.length,
      pageCount: 4
    });
  }
  result.assertions.threeRealMultiPagePdfs = true;

  const linkageCases = [
    { ruleId: 'vgm', expectedDocument: 'solas-vgm-local-pack', expectedPage: 2 },
    { ruleId: 'weight', expectedDocument: 'solas-vgm-local-pack', expectedPage: 3 },
    { ruleId: 'cog', expectedDocument: 'ctu-code-local-pack', expectedPage: 2 },
    { ruleId: 'stacking', expectedDocument: 'ctu-code-local-pack', expectedPage: 3 },
    { ruleId: 'documents', expectedDocument: 'ippc-ispm15-local-pack', expectedPage: 2 }
  ];
  for (const testCase of linkageCases) {
    const record = await selectRuleAndRead(page, testCase);
    assert.equal(record.passed, true, `${testCase.ruleId} 证据联动失败`);
    result.linkage.push(record);
  }
  result.assertions.fiveRuleDocumentPageHighlightLinks = true;

  await selectRuleAndRead(page, linkageCases[0]);
  const beforePage = await readPdfState(page);
  await page.getByRole('button', { name: 'PDF 下一页', exact: true }).click();
  await waitForPdfImage(page);
  const afterPage = await readPdfState(page);
  assert.equal(beforePage.page, 2);
  assert.equal(afterPage.page, 3);
  assert.notEqual(afterPage.imageSrc, beforePage.imageSrc);
  assert.equal(afterPage.highlightCount, 0);
  await selectRuleAndRead(page, linkageCases[0]);
  result.assertions.realPageNavigationChangesRenderedPage = true;

  await capture(page, '01-vgm-evidence.png');
  await selectRuleAndRead(page, linkageCases[2]);
  await capture(page, '02-ctu-evidence.png');
  await selectRuleAndRead(page, linkageCases[4]);
  await capture(page, '03-ippc-evidence.png');
  await selectRuleAndRead(page, linkageCases[3]);
  await capture(page, '04-rule-highlight.png');

  result.states.localOnly = await readLayerState(page);
  assert.equal(result.states.localOnly.ai, 'idle');
  assert.equal(result.states.localOnly.manual, 'unreviewed');
  await capture(page, 'state-01-local-only.png');

  await page.route('**/api/packing/compliance-check-sync', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ code: 500, message: 'STAGE3 simulated AI audit failure', data: null })
    });
  });
  await page.getByRole('button', { name: '运行 AI 审计', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.compliance-page')?.dataset.aiStatus === 'loading');
  result.states.aiLoading = await readLayerState(page);
  assert.equal(result.states.aiLoading.local, result.states.localOnly.local);
  assert.equal(result.states.aiLoading.evidenceCount, 7);
  await capture(page, 'state-02-ai-loading.png');
  await page.waitForFunction(() => document.querySelector('.compliance-page')?.dataset.aiStatus === 'error');
  result.states.aiFailure = await readLayerState(page);
  assert.equal(result.states.aiFailure.local, result.states.localOnly.local);
  assert.equal(result.states.aiFailure.evidenceCount, 7);
  assert.equal(await page.locator('.pdf-reader__viewport img').count(), 1);
  assert.equal(await page.getByRole('button', { name: '重试 AI 审计', exact: true }).isEnabled(), true);
  await capture(page, 'state-03-ai-failure.png');
  await page.unroute('**/api/packing/compliance-check-sync');
  result.assertions.aiFailurePreservesLocalRulesAndEvidence = true;

  await page.route('**/api/packing/compliance-check-sync', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(aiSuccessPayload())
  }));
  await page.getByRole('button', { name: '重试 AI 审计', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.compliance-page')?.dataset.aiStatus === 'ready');
  result.states.aiSuccess = await readLayerState(page);
  assert.equal(result.states.aiSuccess.local, result.states.localOnly.local);
  assert.equal(result.states.aiSuccess.conclusionSource, 'local-rules');
  assert.equal(await page.locator('.audit-stage--ai .status-pill').filter({ hasText: 'PASS' }).count(), 1);
  assert.equal(await page.locator('.evidence-layer--ai.active').count(), 1);
  await selectRuleAndRead(page, linkageCases[0]);
  await capture(page, '05-ai-explanation.png');
  await capture(page, 'state-04-ai-success.png');
  result.states.unreviewed = await readLayerState(page);
  assert.equal(result.states.unreviewed.manual, 'unreviewed');
  await capture(page, 'state-05-unreviewed.png');
  result.assertions.aiPassDoesNotOverrideLocalWarning = true;

  const originalSnippet = await page.locator('.selected-evidence blockquote').innerText();
  await page.getByRole('button', { name: '填写复核结论', exact: true }).click();
  await fillManualReview(page, 'stage3-reviewer', 'approved-with-conditions', '补齐 VGM 申报回执与 IPPC 标识照片后放行。');
  result.states.manualConditional = await readLayerState(page);
  assert.equal(result.states.manualConditional.manual, 'approved-with-conditions');
  assert.equal(result.states.manualConditional.conclusionSource, 'manual-review');
  assert.equal(await page.locator('.selected-evidence blockquote').innerText(), originalSnippet);
  await capture(page, '06-manual-review.png');
  await capture(page, 'state-06-manual-conditional.png');

  await page.getByRole('button', { name: '追加复核', exact: true }).click();
  await fillManualReview(page, 'stage3-reviewer', 'rejected', '退回整改：VGM 回执与木包装证据未齐全。');
  result.states.manualRejected = await readLayerState(page);
  assert.equal(result.states.manualRejected.manual, 'rejected');
  assert.equal(result.states.manualRejected.conclusionSource, 'manual-review');
  assert.equal(await page.locator('.selected-evidence blockquote').innerText(), originalSnippet);
  await capture(page, 'state-07-manual-rejected.png');
  result.assertions.manualReviewNeverOverwritesRegulationExcerpt = true;

  await page.unroute('**/api/packing/compliance-check-sync');
  const expectedResponseErrors = responseErrors.filter((entry) => entry.startsWith('500 '));
  const unexpectedResponseErrors = responseErrors.filter((entry) => !entry.startsWith('500 '));
  const unexpectedConsoleErrors = consoleErrors.filter((entry) => !/500 \(Internal Server Error\)/.test(entry));
  result.simulatedErrors = expectedResponseErrors;
  result.unexpectedResponseErrors = unexpectedResponseErrors;
  result.unexpectedConsoleErrors = unexpectedConsoleErrors;
  assert.equal(expectedResponseErrors.length, 1);
  assert.deepEqual(unexpectedResponseErrors, []);
  assert.deepEqual(unexpectedConsoleErrors, []);
  assert.deepEqual(pageErrors, []);
  result.assertions.allComplianceStatesTruthful = true;

  await fs.writeFile(path.join(outputDir, 'evidence-linkage-gate.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.failure = { message: error.message, stack: error.stack };
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(outputDir, 'evidence-linkage-gate.json'), `${JSON.stringify(result, null, 2)}\n`);
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

async function selectRuleAndRead(targetPage, testCase) {
  await targetPage.locator(`.evidence-rule-list [data-rule-id="${testCase.ruleId}"]`).click();
  await targetPage.waitForFunction(({ documentId, pageNumber, ruleId }) => {
    const reader = document.querySelector('.pdf-reader');
    return reader?.dataset.documentId === documentId
      && Number(reader?.dataset.currentPage) === pageNumber
      && reader?.dataset.highlightRule === ruleId;
  }, { documentId: testCase.expectedDocument, pageNumber: testCase.expectedPage, ruleId: testCase.ruleId });
  await waitForPdfImage(targetPage);
  const reader = targetPage.locator('.pdf-reader');
  const actualDocument = await reader.getAttribute('data-document-id');
  const actualPage = Number(await reader.getAttribute('data-current-page'));
  const highlightCount = await targetPage.locator(`.pdf-evidence-highlight[data-rule-id="${testCase.ruleId}"]`).count();
  const snippetVisible = await targetPage.locator(`.selected-evidence[data-selected-rule="${testCase.ruleId}"][data-snippet-visible="true"] blockquote`).isVisible();
  const sourceVisible = await targetPage.getByText('本地结构化证据包', { exact: true }).first().isVisible();
  const selectedRule = await targetPage.locator('.selected-evidence').getAttribute('data-selected-rule');
  return {
    ruleId: testCase.ruleId,
    expectedDocument: testCase.expectedDocument,
    actualDocument,
    expectedPage: testCase.expectedPage,
    actualPage,
    highlightCount,
    snippetVisible,
    sourceVisible,
    selectedRule,
    passed: actualDocument === testCase.expectedDocument
      && actualPage === testCase.expectedPage
      && highlightCount === 1
      && snippetVisible
      && sourceVisible
      && selectedRule === testCase.ruleId
  };
}

async function readPdfState(targetPage) {
  const reader = targetPage.locator('.pdf-reader');
  return {
    documentId: await reader.getAttribute('data-document-id'),
    page: Number(await reader.getAttribute('data-current-page')),
    highlightCount: await targetPage.locator('.pdf-evidence-highlight').count(),
    imageSrc: await targetPage.locator('.pdf-reader__viewport img').getAttribute('src')
  };
}

async function readLayerState(targetPage) {
  const pageNode = targetPage.locator('.compliance-page');
  return {
    local: await pageNode.getAttribute('data-local-status'),
    ai: await pageNode.getAttribute('data-ai-status'),
    manual: await pageNode.getAttribute('data-manual-status'),
    evidenceCount: Number(await pageNode.getAttribute('data-evidence-count')),
    conclusionSource: await targetPage.locator('.compliance-conclusion').getAttribute('data-conclusion-source'),
    selectedRule: await targetPage.locator('.selected-evidence').getAttribute('data-selected-rule'),
    pdfDocument: await targetPage.locator('.pdf-reader').getAttribute('data-document-id'),
    pdfPage: Number(await targetPage.locator('.pdf-reader').getAttribute('data-current-page')),
    highlightCount: await targetPage.locator('.pdf-evidence-highlight').count()
  };
}

async function fillManualReview(targetPage, reviewer, decision, note) {
  const dialog = targetPage.getByRole('dialog');
  await dialog.locator('input').fill(reviewer);
  await dialog.locator('select').selectOption(decision);
  await dialog.locator('textarea').fill(note);
  await dialog.getByRole('button', { name: '记录结论', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
}

async function waitForPdfImage(targetPage) {
  await targetPage.locator('.pdf-reader__viewport img').evaluate((image) => image.complete && image.naturalWidth > 0
    ? true
    : new Promise((resolve, reject) => {
      image.addEventListener('load', () => resolve(true), { once: true });
      image.addEventListener('error', () => reject(new Error(`PDF rendered page failed: ${image.src}`)), { once: true });
    }));
  const dimensions = await targetPage.locator('.pdf-reader__viewport img').evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight }));
  assert.ok(dimensions.width > 800 && dimensions.height > 1_100);
}

async function capture(targetPage, name) {
  const filePath = path.join(outputDir, name);
  await targetPage.screenshot({ path: filePath, fullPage: true });
  const stats = await fs.stat(filePath);
  assert.ok(stats.size > 50_000);
  result.screenshots.push({ name, path: filePath, bytes: stats.size });
}

function aiSuccessPayload() {
  const rows = [
    ['vgm', 'VGM 重量验证', '建议申报重量已计算', 'PASS'],
    ['weight', '载重与 MAX GROSS', '载重未超阈值', 'PASS'],
    ['lifo', 'LIFO 批次可达', '批次可达性通过', 'PASS'],
    ['cog', '动态重心', '重心偏移在演示阈值内', 'PASS'],
    ['stacking', '堆叠与承压', '未发现承压阻断', 'PASS'],
    ['documents', '木包装与 IPPC 证据', '建议补齐现场照片', 'PASS'],
    ['completeness', '装载完整性', '221 件全部装入', 'PASS']
  ];
  return {
    code: 200,
    message: 'STAGE3 simulated AI success',
    data: {
      complianceReport: {
        status: 'PASS',
        score: 96,
        advice: 'AI 解释层认为方案可进入人工复核；不覆盖本地 WARNING 或 PDF 原文。',
        reportTable: rows.map(([key, dimension, actual, ruleResult]) => ({
          key,
          dimension,
          standard: '以本地确定性规则与 PDF 证据为准',
          actual,
          result: ruleResult,
          sourceRef: '后端 AI 审计解释'
        })),
        rejection_risks: []
      }
    }
  };
}
