import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/playwright/final');
const stage3Dir = path.resolve('output/playwright/stage3/responsive');
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(stage3Dir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1672, height: 941 } });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const badResponses = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => request.failure()?.errorText !== 'net::ERR_ABORTED' && failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`));
page.on('response', (response) => response.status() >= 400 && badResponses.push(`${response.status()} ${response.url()}`));

const viewports = [
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 1672, height: 941, name: '1672x941' },
  { width: 1280, height: 720, name: '1280x720' }
];
const states = [
  { key: 'dashboard', route: 'dashboard', heading: '当前订单' },
  { key: 'cargo', route: 'cargo', heading: '货物清单与 SKU 管理' },
  { key: 'container', route: 'container', heading: '柜型选择与装柜方案' },
  { key: 'twin', route: 'twin', heading: '3D 装柜作业' },
  { key: 'compliance', route: 'compliance', heading: '法规原文与证据联动工作台' },
  { key: 'report', route: 'report', heading: '报告预览与交付' }
];
const captures = [];
const result = { captures, viewports, states: states.map(({ key, route }) => ({ key, route })), modalAudit: {}, consoleErrors, pageErrors, failedRequests, badResponses };

try {
  await loadOfficialBackendPlan();
  await seedReviewState();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const state of states) {
      await page.goto(`${baseUrl}/#/${state.route}`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: state.heading, exact: true }).waitFor();
      if (state.route === 'twin') {
        await page.locator('.twin-canvas').waitFor();
        await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.labelOverlapCount === '0');
      }
      if (state.route === 'compliance') {
        await page.locator('.pdf-reader__viewport img').evaluate((image) => image.complete && image.naturalWidth > 0
          ? true
          : new Promise((resolve) => image.addEventListener('load', resolve, { once: true })));
      }
      await page.waitForTimeout(state.route === 'twin' ? 350 : 120);
      const metrics = await page.evaluate(visualMetrics, state.route);
      assert.equal(metrics.heading, state.heading);
      assert.ok(metrics.bodyScrollWidth <= metrics.viewportWidth, `${viewport.name} ${state.key} body 水平溢出 ${metrics.bodyScrollWidth}/${metrics.viewportWidth}`);
      assert.ok(metrics.appRight <= metrics.viewportWidth + 1 && metrics.appLeft >= -1, `${viewport.name} ${state.key} 主区域越界`);
      assert.equal(metrics.overlayCount, 0, `${viewport.name} ${state.key} 残留遮罩`);
      assert.equal(metrics.mainActionVisible, true, `${viewport.name} ${state.key} 主操作不可见`);
      assert.equal(metrics.clippedPrimaryControls.length, 0, `${viewport.name} ${state.key} 主控件文字无展开方式: ${metrics.clippedPrimaryControls.join(',')}`);

      if (state.route === 'dashboard') {
        assert.equal(metrics.orderNoVisible, true);
        assert.equal(metrics.orderActivityVisible, true);
      }
      if (state.route === 'cargo') {
        assert.equal(metrics.tableScrollContainer, true);
        assert.equal(metrics.cargoActionColumnVisible, true, `${viewport.name} 货物操作列不可见`);
        assert.equal(metrics.cargoRows, 10);
      }
      if (state.route === 'container') {
        assert.equal(metrics.authoritativeAlgorithm, true);
        assert.equal(metrics.algorithmSelectCount, 0);
        assert.equal(metrics.loadedCount, '221');
        assert.equal(metrics.unloadedCount, '0');
      }
      if (state.route === 'twin') {
        assert.equal(metrics.canvasCount, 1);
        assert.equal(metrics.operationControlsVisible, true, `${viewport.name} 3D 播放控件不可见`);
        assert.equal(metrics.operationPanelUsable, true, `${viewport.name} 3D 右侧作业面板不可用`);
        assert.equal(metrics.actorType, 'manual');
        assert.ok(metrics.workerPartCount > 15);
        assert.ok(metrics.forkliftPartCount > 20);
        assert.equal(metrics.labelOverlapCount, '0');
        assert.equal(metrics.speed16Visible, true);
      }
      if (state.route === 'compliance') {
        assert.equal(metrics.pdfNatural, true);
        assert.equal(metrics.pdfControlsOperable, true);
        assert.equal(metrics.evidencePanelUsable, true);
        assert.equal(metrics.evidenceCount, '7');
        assert.equal(metrics.highlightCount, 1);
      }
      if (state.route === 'report') {
        assert.equal(metrics.reportPaper, 'a4');
        assert.equal(metrics.reportChapterCount, 4);
        assert.equal(metrics.deliveryPanelUsable, true);
        assert.equal(metrics.reportLoaded, '221');
        assert.equal(metrics.reportUnloaded, '0');
      }

      if (state.route === 'compliance') await page.locator('.regulation-workbench').scrollIntoViewIfNeeded();
      else await page.evaluate(() => window.scrollTo(0, 0));
      const filename = `${viewport.name}-${state.key}.png`;
      const target = path.join(outputDir, filename);
      await page.screenshot({ path: target, fullPage: false });
      const stats = await fs.stat(target);
      assert.ok(stats.size > 35_000, `${filename} 文件过小`);
      captures.push({ viewport: viewport.name, route: state.key, filename, bytes: stats.size, ...metrics });
    }
  }

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${baseUrl}/#/cargo`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '模板说明', exact: true }).click();
  const dialogAudit = await overlayAudit('.dialog');
  assert.equal(dialogAudit.withinViewport, true);
  await page.getByRole('dialog').getByRole('button', { name: '了解', exact: true }).click();
  await page.locator('.overlay').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '新增 SKU', exact: true }).click();
  const drawerAudit = await overlayAudit('.drawer');
  assert.equal(drawerAudit.withinViewport, true);
  await page.locator('.drawer .overlay__header').getByRole('button', { name: '关闭抽屉' }).click();
  await page.locator('.drawer').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.overlay').count(), 0);
  result.modalAudit = { dialog: dialogAudit, drawer: drawerAudit, overlayCleared: true };

  assert.equal(captures.length, 18);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(badResponses, []);
  const session = await getSession();
  result.plan = {
    planId: session.backendPlan.planId,
    source: session.backendPlan.source,
    loaded: session.backendPlan.totalCargoCount,
    unloaded: session.backendPlan.unloadedCargo.length,
    utilization: session.backendPlan.spaceUtilization,
    orderNo: session.order.orderNo,
    skuCount: session.cargo.length
  };
  result.assertions = {
    eighteenRealViewportScreenshots: true,
    noHorizontalOverflow: true,
    primaryActionsVisible: true,
    cargoStickyActionsVisible: true,
    threeControlsAndPanelUsable: true,
    pdfAndEvidenceUsableAt1280: true,
    modalAndDrawerWithinViewport: true,
    noResidualOverlay: true,
    noUnhandledErrors: true
  };
  const text = `${JSON.stringify(result, null, 2)}\n`;
  await fs.writeFile(path.join(outputDir, 'results.json'), text);
  await fs.writeFile(path.join(stage3Dir, 'responsive-gate.json'), text);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.failure = { message: error.message, stack: error.stack };
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
  const text = `${JSON.stringify(result, null, 2)}\n`;
  await fs.writeFile(path.join(outputDir, 'results.json'), text);
  await fs.writeFile(path.join(stage3Dir, 'responsive-gate.json'), text);
  throw error;
} finally {
  await browser.close();
}

async function loadOfficialBackendPlan() {
  await page.goto(`${baseUrl}/#/container`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.removeItem('yonggui.web.session.v1');
    localStorage.removeItem('yonggui.web.session.v2');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '生成真实方案', exact: true }).click();
  await page.getByText('后端真实方案', { exact: true }).first().waitFor({ timeout: 75_000 });
  await page.waitForTimeout(240);
}

async function seedReviewState() {
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('yonggui.web.session.v2'));
    session.aiAudit = {
      status: 'PASS', score: 96, rows: [], risks: [], advice: 'AI 解释已完成，不覆盖本地规则。',
      source: 'backend-ai', sourceLabel: '后端 AI 审计解释', completedAt: '2026-07-11T12:00:00.000Z'
    };
    session.aiAuditStatus = 'ready';
    session.manualReview = {
      reviewer: '王宁', decision: 'approved-with-conditions', note: '补齐 VGM 申报回执与 IPPC 标识照片后放行。', reviewedAt: '2026-07-11T12:05:00.000Z'
    };
    session.complianceHistory = [
      { id: 'ai-visual', type: 'ai-audit', at: session.aiAudit.completedAt, status: 'PASS', score: 96, source: 'backend-ai' },
      { id: 'manual-visual', type: 'manual-review', at: session.manualReview.reviewedAt, ...session.manualReview }
    ];
    localStorage.setItem('yonggui.web.session.v2', JSON.stringify(session));
  });
  await page.reload({ waitUntil: 'networkidle' });
}

async function overlayAudit(selector) {
  return page.locator(selector).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      withinViewport: rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1
    };
  });
}

async function getSession() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('yonggui.web.session.v2')));
}

function visualMetrics(route) {
  const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
  const intersectsViewport = (value) => Boolean(value && value.right > 0 && value.left < innerWidth && value.bottom > 0 && value.top < innerHeight && value.width > 0 && value.height > 0);
  const mainActionSelector = {
    dashboard: '.page-header',
    cargo: '.page-header .button--primary',
    container: '.page-header .button--primary',
    twin: '.operation-play',
    compliance: '.page-header .button--primary',
    report: '.page-header .button--primary'
  }[route];
  const mainAction = rect(mainActionSelector);
  const app = rect('.app-main');
  const actionColumn = rect('.cargo-table th:last-child');
  const operationControls = rect('.operation-controls');
  const operationPanel = rect('.operation-panel');
  const pdfControls = rect('.pdf-reader__controls');
  const evidencePanel = rect('.evidence-rule-panel');
  const deliveryPanel = rect('.delivery-panel');
  const primaryControls = [...document.querySelectorAll('.page-header button, .viewer-toolbar button, .operation-controls button, .pdf-reader__controls button, .delivery-option')];
  const clippedPrimaryControls = primaryControls.filter((node) => node.scrollWidth > node.clientWidth + 2 && !node.getAttribute('aria-label') && !node.getAttribute('title')).map((node) => node.textContent.trim().slice(0, 30));
  const canvas = document.querySelector('.twin-canvas');
  const report = document.querySelector('.report-page');
  return {
    heading: document.querySelector('.page-header h1')?.textContent || '',
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
    bodyScrollWidth: document.body.scrollWidth,
    appLeft: app?.left ?? 0,
    appRight: app?.right ?? innerWidth,
    overlayCount: document.querySelectorAll('.overlay').length,
    mainActionVisible: intersectsViewport(mainAction),
    clippedPrimaryControls,
    orderNoVisible: document.body.innerText.includes('NB2026-DEMO-01'),
    orderActivityVisible: Boolean(document.querySelector('.order-activity')),
    tableScrollContainer: getComputedStyle(document.querySelector('.table-scroll') || document.body).overflowX === 'auto',
    cargoActionColumnVisible: !actionColumn || intersectsViewport(actionColumn),
    cargoRows: document.querySelectorAll('.cargo-table tbody tr').length,
    authoritativeAlgorithm: Boolean(document.querySelector('[data-authoritative-algorithm="fast-block"]')),
    algorithmSelectCount: document.querySelectorAll('.algorithm-select').length,
    loadedCount: document.querySelector('.container-page')?.dataset.loadedCount || '',
    unloadedCount: document.querySelector('.container-page')?.dataset.unloadedCount || '',
    canvasCount: document.querySelectorAll('.twin-canvas canvas').length,
    operationControlsVisible: !operationControls || intersectsViewport(operationControls),
    operationPanelUsable: !operationPanel || operationPanel.width >= 250 && operationPanel.right <= innerWidth + 1,
    actorType: canvas?.dataset.actorType || '',
    workerPartCount: Number(canvas?.dataset.workerPartCount || 0),
    forkliftPartCount: Number(canvas?.dataset.forkliftPartCount || 0),
    labelOverlapCount: canvas?.dataset.labelOverlapCount || '',
    speed16Visible: [...document.querySelectorAll('.speed-control button')].some((button) => button.textContent.trim() === '16×' && intersectsViewport(button.getBoundingClientRect())),
    pdfNatural: Boolean(document.querySelector('.pdf-reader__viewport img')?.naturalWidth > 800),
    pdfControlsOperable: Boolean(pdfControls && pdfControls.width > 260 && pdfControls.right <= innerWidth + 1),
    evidencePanelUsable: Boolean(evidencePanel && evidencePanel.width >= 340 && evidencePanel.right <= innerWidth + 1),
    evidenceCount: document.querySelector('.compliance-page')?.dataset.evidenceCount || '',
    highlightCount: document.querySelectorAll('.pdf-evidence-highlight').length,
    reportPaper: document.querySelector('.report-sheet')?.dataset.paper || '',
    reportChapterCount: document.querySelectorAll('.report-chapters button').length,
    deliveryPanelUsable: !deliveryPanel || deliveryPanel.width >= 250 && deliveryPanel.right <= innerWidth + 1,
    reportLoaded: report?.dataset.loadedCount || '',
    reportUnloaded: report?.dataset.unloadedCount || ''
  };
}
