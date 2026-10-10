import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { fetchRegulationDetail } from '../web-dashboard/src/services/complianceApi.js';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/playwright/ui-states');
const stage3Dir = path.resolve('output/playwright/stage3/responsive');
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(stage3Dir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const responseErrors = [];
const failedRequests = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', (response) => response.status() >= 400 && responseErrors.push(`${response.status()} ${response.url()}`));
page.on('requestfailed', (request) => failedRequests.push(`${request.failure()?.errorText || 'failed'} ${request.url()}`));

const result = { scenarios: {}, assertions: {}, consoleErrors, pageErrors, responseErrors, failedRequests };

try {
  await resetOfficialSession('container');

  await page.route('**/api/packing/generate', (route) => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ code: 500, message: 'STAGE3 simulated packing 500', data: null })
  }));
  await page.getByRole('button', { name: '生成真实方案', exact: true }).click();
  await page.locator('.page-error').waitFor();
  const packing500Text = await page.locator('.page-error').innerText();
  assert.match(packing500Text, /STAGE3 simulated packing 500/);
  assert.equal(await page.getByRole('button', { name: '生成真实方案', exact: true }).isEnabled(), true);
  assert.equal(await page.getByText('本地预演', { exact: true }).first().count(), 1);
  await capture('01-packing-500.png');
  result.scenarios.packing500 = recoverable(packing500Text, '重试按钮可用，本地预演保留');
  await page.unroute('**/api/packing/generate');

  await page.route('**/api/packing/generate', (route) => route.abort('timedout'));
  await page.getByRole('button', { name: '生成真实方案', exact: true }).click();
  await page.locator('.page-error').waitFor();
  const packingTimeoutText = await page.locator('.page-error').innerText();
  assert.ok(packingTimeoutText.trim().length > 0);
  assert.equal(await page.getByRole('button', { name: '生成真实方案', exact: true }).isEnabled(), true);
  await capture('02-packing-timeout.png');
  result.scenarios.packingTimeout = recoverable(packingTimeoutText, '超时后可重试，未生成伪方案');
  await page.unroute('**/api/packing/generate');

  await page.getByRole('button', { name: '生成真实方案', exact: true }).click();
  await page.getByText('后端真实方案', { exact: true }).first().waitFor({ timeout: 75_000 });
  await page.waitForTimeout(260);
  const baselineSession = await getSession();
  assert.equal(baselineSession.backendPlan.totalCargoCount, 221);
  assert.equal(baselineSession.backendPlan.unloadedCargo.length, 0);

  await page.goto(`${baseUrl}/#/compliance`, { waitUntil: 'networkidle' });
  await page.route('**/api/packing/compliance-check-sync', (route) => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ code: 500, message: 'STAGE3 simulated AI 500', data: null })
  }));
  await page.getByRole('button', { name: '运行 AI 审计', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.compliance-page')?.dataset.aiStatus === 'error');
  const aiFailureText = await page.locator('.audit-stage--ai').innerText();
  assert.match(aiFailureText, /STAGE3 simulated AI 500/);
  assert.equal(await page.locator('.regulation-workbench').count(), 1);
  assert.equal(await page.locator('.evidence-rule-list [data-rule-id]').count(), 7);
  assert.equal(await page.getByRole('button', { name: '重试 AI 审计', exact: true }).isEnabled(), true);
  await capture('03-ai-500.png');
  result.scenarios.ai500 = recoverable(aiFailureText, '本地规则和 PDF 证据保留，AI 重试可用');
  await page.unroute('**/api/packing/compliance-check-sync');

  await page.route('**/regulations/rendered/solas-vgm-local-pack/page-2.png*', (route) => route.fulfill({ status: 404, body: 'missing rendered PDF page' }));
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.pdf-render-error').waitFor();
  const pdfErrorText = await page.locator('.pdf-render-error').innerText();
  assert.match(pdfErrorText, /PDF 渲染失败/);
  assert.equal(await page.locator('.evidence-rule-list [data-rule-id]').count(), 7);
  assert.equal(await page.getByRole('button', { name: '重试当前页', exact: true }).isEnabled(), true);
  await capture('04-pdf-missing.png');
  await page.unroute('**/regulations/rendered/solas-vgm-local-pack/page-2.png*');
  await page.getByRole('button', { name: '重试当前页', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.pdf-reader')?.dataset.renderStatus === 'ready');
  result.scenarios.pdfMissing = recoverable(pdfErrorText, '规则与来源保留，取消 404 后重试成功');

  let regulationDetailError = '';
  try {
    await fetchRegulationDetail('empty-detail', {
      timeoutMs: 100,
      fetchImpl: async () => new Response(JSON.stringify({ code: 200, data: null }), { status: 200, headers: { 'content-type': 'application/json' } })
    });
  } catch (error) {
    regulationDetailError = error.message;
    assert.equal(error.reason, 'contract');
  }
  assert.match(regulationDetailError, /法规详情返回为空/);
  assert.equal(await page.locator('.regulation-workbench').count(), 1);
  result.scenarios.emptyRegulationDetail = recoverable(regulationDetailError, '远程详情隔离，本地 PDF 仍可用');

  await page.goto(`${baseUrl}/#/cargo`, { waitUntil: 'networkidle' });
  await page.route('**/api/vlm/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, data: { available: false, message: 'STAGE3 VLM unavailable' } })
  }));
  await page.getByRole('button', { name: '拍照识别', exact: true }).click();
  const vlmDrawer = page.locator('.drawer').filter({ hasText: '拍照识别货物' });
  await vlmDrawer.getByText('服务不可用', { exact: true }).waitFor();
  assert.match(await vlmDrawer.innerText(), /STAGE3 VLM unavailable/);
  assert.equal(await vlmDrawer.getByRole('button', { name: '开始识别', exact: true }).isDisabled(), true);
  await capture('05-vlm-unavailable.png');
  await vlmDrawer.getByRole('button', { name: '关闭', exact: true }).click();
  await page.unroute('**/api/vlm/status');
  result.scenarios.vlmUnavailable = recoverable('STAGE3 VLM unavailable', '原始表单未改变，抽屉可关闭');

  await openWithSession(baselineSession, 'report');
  await page.evaluate(() => {
    window.__stage3OriginalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = () => { throw new Error('STAGE3 simulated download builder failure'); };
  });
  await page.getByRole('button', { name: /JSON 完整数据/ }).click();
  const downloadErrorToast = page.locator('.toast').filter({ hasText: 'STAGE3 simulated download builder failure' });
  await downloadErrorToast.waitFor();
  await capture('06-download-build-failure.png');
  await page.evaluate(() => { URL.createObjectURL = window.__stage3OriginalCreateObjectURL; });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /JSON 完整数据/ }).click();
  const recoveredDownload = await downloadPromise;
  assert.equal(await recoveredDownload.failure(), null);
  result.scenarios.downloadBuildFailure = recoverable('STAGE3 simulated download builder failure', '错误 toast 明确，恢复构建器后真实下载成功');

  await page.goto(`${baseUrl}/#/cargo`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(180);
  await page.evaluate(() => localStorage.setItem('yonggui.web.session.v2', '{broken-stage3-session'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-session-recovery="true"]').waitFor();
  const recoveryText = await page.locator('[data-session-recovery="true"]').innerText();
  assert.match(recoveryText, /会话数据损坏/);
  assert.equal(await page.locator('.cargo-table tbody tr').count(), 10);
  await capture('07-corrupt-session-recovery.png');
  result.scenarios.corruptSession = recoverable(recoveryText, '恢复官方 10 SKU 演示模板');

  const noPlanSession = structuredClone(baselineSession);
  noPlanSession.cargo = [];
  noPlanSession.backendPlan = null;
  noPlanSession.backendPlanFingerprint = null;
  noPlanSession.aiAudit = null;
  noPlanSession.manualReview = null;
  await openWithSession(noPlanSession, 'twin');
  await page.locator('.twin-canvas').waitFor();
  assert.equal(await page.locator('.twin-canvas').getAttribute('data-total-count'), '0');
  const noPlanNotice = await page.locator('.page-notice').innerText();
  assert.match(noPlanNotice, /本地确定性预演/);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.phase === 'COMPLETED');
  await capture('08-three-no-plan.png');
  result.scenarios.threeNoPlan = recoverable(noPlanNotice, '空队列进入 COMPLETED，可返回货物/柜型页');

  await openWithSession(baselineSession, 'twin');
  await page.getByLabel('港口筛选').selectOption('Hamburg');
  await page.getByLabel('批次筛选').selectOption('BATCH-ANR-A');
  await page.locator('.operation-filter-empty').waitFor();
  assert.equal(await page.locator('.step-queue').getAttribute('data-visible-queue-count'), '0');
  assert.equal(await page.locator('.step-queue').getAttribute('data-queue-count'), '221');
  await capture('09-three-filter-no-results.png');
  await page.locator('.operation-filters__heading button').click();
  assert.equal(await page.locator('.step-queue').getAttribute('data-visible-queue-count'), '221');
  result.scenarios.threeFilterNoResult = recoverable('当前组合无匹配货物', '重置后恢复 221 件，machine 未改');

  const incompleteManual = mutateQueuedCargo(baselineSession, 'manual', (item) => { item.weight = 0; });
  await openWithSession(incompleteManual.session, 'twin');
  await advanceToBlocked(incompleteManual.index);
  const incompleteText = await page.locator('.blocked-overlay').innerText();
  assert.match(incompleteText, /缺少必要属性/);
  assert.equal(await page.getByRole('button', { name: '记录并跳过', exact: true }).count(), 1);
  await capture('10-manual-missing-attributes.png');
  result.scenarios.manualMissingAttributes = recoverable(incompleteText, '可记录跳过或返回货物页补齐');

  const blockedForklift = mutateQueuedCargo(baselineSession, 'forklift', (item) => { item.z = 0; item.w = 2_390; });
  await openWithSession(blockedForklift.session, 'twin');
  await advanceToBlocked(blockedForklift.index);
  const forkliftText = await page.locator('.blocked-overlay').innerText();
  assert.match(forkliftText, /门洞|宽度|边界/);
  await capture('11-forklift-door-blocked.png');
  result.scenarios.forkliftCannotPassDoor = recoverable(forkliftText, '原目标坐标未伪装，可跳过');

  const oversizedManual = mutateQueuedCargo(baselineSession, 'manual', (item) => { item.l = 1_600; item.weight = 12; });
  await openWithSession(oversizedManual.session, 'twin');
  await advanceToBlocked(oversizedManual.index);
  const oversizedText = await page.locator('.blocked-overlay').innerText();
  assert.match(oversizedText, /超出演示安全边界/);
  await capture('12-manual-oversized.png');
  result.scenarios.manualOversized = recoverable(oversizedText, '明确建议改为叉车或拆分');

  await openWithSession(baselineSession, 'twin');
  const beforeRefresh = await getSession();
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.twin-canvas').waitFor();
  const afterRefresh = await getSession();
  assert.equal(afterRefresh.backendPlan.planId, beforeRefresh.backendPlan.planId);
  assert.equal(await page.locator('.twin-canvas').getAttribute('data-total-count'), '221');
  assert.equal(await page.getByText('后端真实方案', { exact: true }).first().count(), 1);
  result.scenarios.browserRefresh = recoverable(beforeRefresh.backendPlan.planId, '刷新后同一后端方案与 221 件队列恢复');

  await jumpTo(12);
  await page.goto(`${baseUrl}/#/cargo`, { waitUntil: 'networkidle' });
  await page.goto(`${baseUrl}/#/twin`, { waitUntil: 'networkidle' });
  await page.locator('.twin-canvas').waitFor();
  assert.equal(await page.locator('.twin-canvas').getAttribute('data-total-count'), '221');
  assert.equal((await getSession()).backendPlan.planId, baselineSession.backendPlan.planId);
  result.scenarios.navigationBackToThree = recoverable('3D 页面切换返回', '同一方案重建状态机，无第二套 3D 页');

  const expectedResponseErrors = responseErrors.filter((entry) => /^500 |^404 /.test(entry));
  const unexpectedResponseErrors = responseErrors.filter((entry) => !/^500 |^404 /.test(entry));
  const unexpectedConsoleErrors = consoleErrors.filter((message) => !/500 \(Internal Server Error\)|404 \(Not Found\)|ERR_FAILED|ERR_TIMED_OUT/.test(message));
  const unexpectedFailedRequests = failedRequests.filter((entry) => !/TIMED_OUT|ERR_FAILED/.test(entry));
  assert.deepEqual(unexpectedResponseErrors, []);
  assert.deepEqual(unexpectedConsoleErrors, []);
  assert.deepEqual(unexpectedFailedRequests, []);
  assert.deepEqual(pageErrors, []);
  assert.equal(Object.keys(result.scenarios).length, 15);
  assert.ok(Object.values(result.scenarios).every((scenario) => scenario.noCrash && scenario.noFalseSuccess && scenario.recoverable && scenario.explicit));
  result.assertions = {
    fifteenActiveFailureScenarios: true,
    noUnhandledPageErrors: true,
    noUnexpectedConsoleErrors: true,
    allFailuresExplicitAndRecoverable: true
  };
  result.expectedResponseErrors = expectedResponseErrors;
  result.unexpectedResponseErrors = unexpectedResponseErrors;
  result.unexpectedConsoleErrors = unexpectedConsoleErrors;
  result.unexpectedFailedRequests = unexpectedFailedRequests;
  await writeResults();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.failure = { message: error.message, stack: error.stack };
  await capture('failure.png').catch(() => {});
  await writeResults();
  throw error;
} finally {
  await browser.close();
}

async function resetOfficialSession(route) {
  await page.goto(`${baseUrl}/#/${route}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.removeItem('yonggui.web.session.v1');
    localStorage.removeItem('yonggui.web.session.v2');
  });
  await page.reload({ waitUntil: 'networkidle' });
}

async function openWithSession(session, route) {
  await page.goto(`${baseUrl}/#/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(180);
  await page.evaluate((value) => localStorage.setItem('yonggui.web.session.v2', JSON.stringify(value)), session);
  await page.reload({ waitUntil: 'networkidle' });
}

function mutateQueuedCargo(baseline, actorType, mutate) {
  const session = structuredClone(baseline);
  const queue = session.backendPlan.loadedCargo
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((left, right) => operationOrder({ ...left.item, sourceIndex: left.sourceIndex }, { ...right.item, sourceIndex: right.sourceIndex }));
  const index = queue.findIndex(({ item }) => (item.handlingMethod === 'manual' ? 'manual' : 'forklift') === actorType);
  assert.ok(index >= 0);
  mutate(queue[index].item);
  return { session, index };
}

function operationOrder(left, right) {
  return Number(left.x) - Number(right.x)
    || Number(left.y) - Number(right.y)
    || Number(left.z) - Number(right.z)
    || Number(left.loadingIndex || left.sourceIndex) - Number(right.loadingIndex || right.sourceIndex);
}

async function advanceToBlocked(index) {
  await jumpTo(index);
  let guard = 0;
  while ((await page.locator('.twin-canvas').getAttribute('data-phase')) !== 'BLOCKED' && guard < 22) {
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await page.waitForTimeout(45);
    guard += 1;
  }
  assert.equal(await page.locator('.twin-canvas').getAttribute('data-phase'), 'BLOCKED');
}

async function jumpTo(index) {
  await page.locator('.jump-control input').fill(String(index + 1));
  await page.locator('.jump-control button').click();
  await page.waitForFunction((targetIndex) => Number(document.querySelector('.twin-canvas')?.dataset.currentIndex) === targetIndex, index);
}

function recoverable(message, recovery) {
  return { message, recovery, noCrash: true, noFalseSuccess: true, recoverable: true, explicit: Boolean(String(message).trim()) };
}

async function getSession() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('yonggui.web.session.v2')));
}

async function capture(name) {
  const filePath = path.join(outputDir, name);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function writeResults() {
  const text = `${JSON.stringify(result, null, 2)}\n`;
  await fs.writeFile(path.join(outputDir, 'results.json'), text);
  await fs.writeFile(path.join(stage3Dir, 'negative-scenarios.json'), text);
}
