import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/playwright/report-evidence');
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  acceptDownloads: true,
  deviceScaleFactor: 1
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const badResponses = [];
const captures = [];

page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => {
  if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`);
  }
});
page.on('response', (response) => {
  if (response.status() >= 400) badResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
});

async function capture(name, options = {}) {
  await page.waitForTimeout(options.wait ?? 350);
  const target = options.locator ? page.locator(options.locator) : page;
  const filename = `${name}.png`;
  await target.screenshot({ path: path.join(outputDir, filename), fullPage: false });
  const metrics = await page.evaluate(() => ({
    route: location.hash,
    title: document.querySelector('h1')?.textContent?.trim() || '',
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    overlays: document.querySelectorAll('.overlay').length,
    canvasCount: document.querySelectorAll('canvas').length
  }));
  captures.push({ name, filename, ...metrics });
}

async function goto(route) {
  await page.goto(`${baseUrl}/#/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(route === 'twin' ? 900 : 250);
}

try {
  await goto('dashboard');
  await page.evaluate(() => {
    localStorage.removeItem('yonggui.web.session.v1');
    localStorage.removeItem('yonggui.web.session.v2');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await capture('01-dashboard-initial');

  await goto('cargo');
  const skuRows = await page.locator('.cargo-table tbody tr').count();
  assert.ok(skuRows >= 5, `Expected at least five demo SKUs, found ${skuRows}`);
  await capture('02-cargo-demo-skus');

  await page.getByRole('button', { name: 'CSV 导入' }).click();
  await page.getByRole('dialog', { name: 'CSV 校验预览' }).waitFor();
  await capture('03-cargo-csv-dialog');
  await page.keyboard.press('Escape');
  await page.locator('.overlay').waitFor({ state: 'detached' });

  await goto('container');
  await capture('04-container-selection');
  await page.getByRole('button', { name: '生成真实方案', exact: true }).click();
  await Promise.race([
    page.getByText('后端真实方案', { exact: true }).first().waitFor({ timeout: 75000 }),
    page.locator('.page-error').waitFor({ timeout: 75000 }).then(async () => {
      throw new Error(`Backend plan generation failed: ${await page.locator('.page-error').innerText()}`);
    })
  ]);
  await capture('05-container-generated', { wait: 500 });

  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('yonggui.web.session.v2')));
  assert.ok(session?.backendPlan, 'No persisted backend plan in v2 session');
  const plan = session.backendPlan;

  await goto('twin');
  const canvas = page.locator('.twin-canvas');
  await canvas.waitFor();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.phase === 'IDLE');
  await capture('06-twin-overview');

  for (const [label, key] of [['门端', 'door'], ['侧视', 'side'], ['俯视', 'top']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await capture(`07-twin-${key}`, { locator: '.viewer-stage', wait: 280 });
  }
  await page.getByRole('button', { name: '总览', exact: true }).click();
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('.twin-canvas')?.dataset.doorProgress || 0) > 0.95, null, { timeout: 8000 });
  await capture('08-twin-doors-open', { locator: '.viewer-stage', wait: 150 });
  const pauseButton = page.getByRole('button', { name: '暂停', exact: true });
  if (await pauseButton.count()) await pauseButton.click();

  await goto('compliance');
  await capture('09-compliance-local-rules');
  await page.getByRole('button', { name: '查看证据' }).click();
  await page.getByRole('dialog', { name: '规则与法规证据' }).waitFor();
  await capture('10-compliance-evidence-drawer');
  await page.keyboard.press('Escape');
  await page.locator('.overlay').waitFor({ state: 'detached' });

  const aiStage = page.locator('.audit-stage').nth(1);
  const aiButton = aiStage.getByRole('button', { name: '运行 AI 审计' });
  let aiOutcome = 'not-run';
  if (await aiButton.count()) {
    await aiButton.click();
    aiOutcome = await Promise.race([
      aiStage.getByText(/AI 只提供解释与建议/).waitFor({ timeout: 40000 }).then(() => 'advice-or-fallback'),
      aiStage.getByText('AI 审计失败', { exact: true }).waitFor({ timeout: 40000 }).then(() => 'explicit-failure')
    ]).catch(() => 'timeout');
    await capture('11-compliance-ai-state');
  }

  await goto('report');
  await page.getByText('NB2026-DEMO-01', { exact: true }).first().waitFor();
  await capture('12-report-preview');
  const downloads = {};
  for (const [format, name] of [['html', 'HTML 完整报告'], ['csv', 'CSV 货物明细'], ['json', 'JSON 完整数据']]) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: new RegExp(name) }).click();
    const download = await downloadPromise;
    const savedPath = await download.path();
    const buffer = await fs.readFile(savedPath);
    downloads[format] = { filename: download.suggestedFilename(), bytes: buffer.length };
  }

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: /打印 \/ 另存为 PDF/ }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.setViewportSize({ width: 1280, height: 900 });
  await popup.screenshot({ path: path.join(outputDir, '13-report-print-document.png'), fullPage: true });
  captures.push({ name: '13-report-print-document', filename: '13-report-print-document.png', route: 'print-popup' });
  await popup.close();

  const result = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    skuRows,
    plan: {
      planId: plan.planId,
      source: plan.source,
      loaded: plan.loadedCargo?.length,
      unloaded: plan.unloadedCargo?.length,
      utilization: plan.spaceUtilization,
      totalWeight: plan.totalWeight,
      containerType: plan.containerInfo?.typeId
    },
    aiOutcome,
    downloads,
    captures,
    consoleErrors,
    pageErrors,
    failedRequests,
    badResponses
  };
  await fs.writeFile(path.join(outputDir, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(outputDir, 'failure.json'), JSON.stringify({
    at: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    consoleErrors,
    pageErrors,
    failedRequests,
    badResponses
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
