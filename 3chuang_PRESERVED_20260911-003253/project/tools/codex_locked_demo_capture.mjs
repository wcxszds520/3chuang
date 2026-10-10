import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createDemoCargo, DEMO_DATASET_ID, DEMO_ORDER } from '../web-dashboard/src/domain/cargo/demoDataset.js';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/playwright/locked-demo-evidence');
await fs.mkdir(outputDir, { recursive: true });

const cargo = createDemoCargo();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const captures = [];
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];

page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => {
  if (request.failure()?.errorText !== 'net::ERR_ABORTED') failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`);
});

async function goto(route) {
  await page.goto(`${baseUrl}/#/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(route === 'twin' ? 900 : 280);
}

async function shot(name, locator = null, wait = 250) {
  await page.waitForTimeout(wait);
  const target = locator ? page.locator(locator) : page;
  await target.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false });
  captures.push({ name, route: await page.evaluate(() => location.hash), h1: await page.locator('h1').first().innerText().catch(() => '') });
}

try {
  await goto('cargo');
  const initial = await page.evaluate(() => JSON.parse(localStorage.getItem('yonggui.web.session.v2')));
  assert.equal(initial?.schemaVersion, 2);
  const locked = {
    ...initial,
    order: {
      ...initial.order,
      ...DEMO_ORDER,
      source: 'locked-demo-evidence'
    },
    datasetId: DEMO_DATASET_ID,
    cargo,
    selectedContainerType: '40HQ',
    backendPlan: null,
    backendPlanFingerprint: null,
    planStatus: 'preview',
    planError: null,
    aiAudit: null,
    aiAuditStatus: 'idle',
    aiAuditError: null,
    manualReview: null,
    complianceHistory: [],
    dataSource: {
      order: '锁定演示订单',
      cargo: '10 SKU 唯一演示数据集',
      plan: '待后端真实计算',
      compliance: '本地确定性规则'
    }
  };
  await page.evaluate((session) => localStorage.setItem('yonggui.web.session.v2', JSON.stringify(session)), locked);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.cargo-table tbody tr').count(), 10);
  assert.ok((await page.locator('body').innerText()).includes('221'));
  await shot('01-locked-cargo-221');

  await goto('container');
  await page.getByRole('button', { name: '生成真实方案', exact: true }).click();
  await page.getByText('后端真实方案', { exact: true }).first().waitFor({ timeout: 75000 });
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('yonggui.web.session.v2')));
  const plan = session.backendPlan;
  assert.equal(plan.loadedCargo.length, 221);
  assert.equal(plan.unloadedCargo.length, 0);
  assert.ok(Math.abs(plan.spaceUtilization - 84.51) < 1e-8);
  await shot('02-locked-container-result', null, 500);

  await goto('dashboard');
  await shot('03-locked-dashboard-result');

  await goto('twin');
  await page.locator('.twin-canvas').waitFor();
  await shot('04-locked-twin-overview');
  for (const [label, key] of [['门端', 'door'], ['俯视', 'top'], ['侧视', 'side']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await shot(`05-locked-twin-${key}`, '.viewer-stage', 280);
  }
  await page.getByRole('button', { name: '总览', exact: true }).click();
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('.twin-canvas')?.dataset.doorProgress || 0) > 0.95, null, { timeout: 8000 });
  await shot('06-locked-twin-operation', '.viewer-stage', 180);
  const pause = page.getByRole('button', { name: '暂停', exact: true });
  if (await pause.count()) await pause.click();

  await goto('compliance');
  await shot('07-locked-compliance-local');
  await page.getByRole('button', { name: '查看证据' }).click();
  await page.getByRole('dialog', { name: '规则与法规证据' }).waitFor();
  await shot('08-locked-compliance-evidence');
  await page.keyboard.press('Escape');
  await page.locator('.overlay').waitFor({ state: 'detached' });

  const aiStage = page.locator('.audit-stage').nth(1);
  let aiOutcome = 'not-run';
  if (await aiStage.getByRole('button', { name: '运行 AI 审计' }).count()) {
    await aiStage.getByRole('button', { name: '运行 AI 审计' }).click();
    aiOutcome = await Promise.race([
      aiStage.getByText(/AI 只提供解释与建议/).waitFor({ timeout: 40000 }).then(() => 'advice-or-fallback'),
      aiStage.getByText('AI 审计失败', { exact: true }).waitFor({ timeout: 40000 }).then(() => 'explicit-failure')
    ]).catch(() => 'timeout');
    await shot('09-locked-compliance-ai');
  }

  await goto('report');
  await page.getByText('NB2026-DEMO-01', { exact: true }).first().waitFor();
  await shot('10-locked-report');

  const result = {
    capturedAt: new Date().toISOString(),
    dataset: { orderNo: 'NB2026-DEMO-01', skuCount: cargo.length, inputPieces: cargo.reduce((sum, item) => sum + item.quantity, 0) },
    plan: {
      planId: plan.planId,
      source: plan.source,
      loaded: plan.loadedCargo.length,
      unloaded: plan.unloadedCargo.length,
      utilization: plan.spaceUtilization,
      totalWeight: plan.totalWeight,
      container: plan.containerInfo.typeId
    },
    aiOutcome,
    captures,
    consoleErrors,
    pageErrors,
    failedRequests
  };
  await fs.writeFile(path.join(outputDir, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(outputDir, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
  throw error;
} finally {
  await browser.close();
}
