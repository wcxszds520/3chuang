import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/playwright/stage2-3d');
await fs.mkdir(outputDir, { recursive: true });
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

const captures = [];
const canvas = page.locator('.twin-canvas');

try {
  await page.goto(`${baseUrl}/#/container`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('yonggui.web.session.v1'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '生成真实方案', exact: true }).click();
  await page.getByText('后端真实方案', { exact: true }).first().waitFor({ timeout: 75000 });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('yonggui.web.session.v1') || '{}').backendPlan?.source === 'backend');
  const originalSessionRaw = await page.evaluate(() => localStorage.getItem('yonggui.web.session.v1'));
  const originalSession = JSON.parse(originalSessionRaw);

  await openTwin();
  await capture('01-overview', '.viewer-stage', { expectedPhase: 'IDLE' });

  await advanceFromReset(2);
  await page.getByRole('button', { name: '门端', exact: true }).click();
  await page.waitForTimeout(350);
  await capture('02-door', '.viewer-stage', { doorsOpen: true });
  await page.getByRole('button', { name: '侧视', exact: true }).click();
  await page.waitForTimeout(350);
  await capture('03-side', '.viewer-stage', { doorsOpen: true });
  await page.getByRole('button', { name: '俯视', exact: true }).click();
  await page.waitForTimeout(350);
  await capture('04-top', '.viewer-stage', { doorsOpen: true });

  await advanceFromReset(0);
  await page.getByRole('button', { name: '总览', exact: true }).click();
  await page.getByRole('button', { name: '0.5×', exact: true }).click();
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.phase === 'MOVE_TO_CARGO', null, { timeout: 7000 });
  await page.waitForTimeout(280);
  await capture('05-operation-in-progress', '.viewer-stage', { expectedPhase: 'MOVE_TO_CARGO' });

  await advanceFromReset(5);
  await capture('06-fork-pickup', '.viewer-stage', { expectedPhase: 'LIFT_CARGO' });

  await advanceFromReset(9);
  await page.getByRole('button', { name: '门端', exact: true }).click();
  await page.waitForTimeout(350);
  await capture('07-entering-door', '.viewer-stage', { expectedPhase: 'MOVE_INSIDE', doorsOpen: true });

  await advanceFromReset(13);
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.phase === 'REVERSE_OUT' && document.querySelector('.twin-canvas')?.dataset.completedCount === '1');
  await page.getByRole('button', { name: '剖切复核', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.sceneMode === 'review');
  await capture('08-placed-complete', '.viewer-stage', { expectedMode: 'review', completed: 1 });

  await page.evaluate((raw) => {
    const session = JSON.parse(raw);
    const plan = session.backendPlan;
    const source = plan.loadedCargo[0];
    plan.loadedCargo = [{
      ...source,
      cargoId: 'stage2-blocked-wide-cargo',
      sku: 'BLOCKED-WIDE',
      name: '门洞超宽验证件',
      w: Number(plan.containerInfo.innerWidth) + 420,
      z: 0
    }];
    plan.totalCargoCount = 1;
    plan.totalCargoInput = 1;
    plan.unloadedCargo = [];
    session.backendPlan = plan;
    localStorage.setItem('yonggui.web.session.v1', JSON.stringify(session));
  }, originalSessionRaw);
  await page.reload({ waitUntil: 'networkidle' });
  await canvas.waitFor();
  await advanceFromReset(8);
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.phase === 'BLOCKED');
  await page.locator('.blocked-overlay').waitFor();
  await capture('09-blocked', '.viewer-stage', { expectedPhase: 'BLOCKED' });

  await page.evaluate((raw) => localStorage.setItem('yonggui.web.session.v1', raw), originalSessionRaw);
  await page.reload({ waitUntil: 'networkidle' });
  await canvas.waitFor();
  const groupedQueue = page.locator('.step-queue');
  assert.equal(await groupedQueue.getAttribute('data-order-valid'), 'true');
  const futureGroup = page.locator('.queue-group').nth(1);
  await futureGroup.getByRole('button', { name: /展开/ }).click();
  assert.ok(await futureGroup.locator('[data-queue-index]').count() > 0);
  await capture('10-group-expanded', '.twin-workspace', { groupExpanded: true });

  assert.equal(captures.length, 10);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(badResponses, []);
  const result = {
    captures,
    count: captures.length,
    plan: {
      planId: originalSession.backendPlan.planId,
      loaded: originalSession.backendPlan.loadedCargo.length,
      unloaded: originalSession.backendPlan.unloadedCargo.length,
      target: originalSession.backendPlan.loadedCargo[0]
        ? {
            cargoId: originalSession.backendPlan.loadedCargo[0].cargoId,
            x: originalSession.backendPlan.loadedCargo[0].x,
            y: originalSession.backendPlan.loadedCargo[0].y,
            z: originalSession.backendPlan.loadedCargo[0].z
          }
        : null
    },
    consoleErrors,
    pageErrors,
    failedRequests,
    badResponses
  };
  await fs.writeFile(path.join(outputDir, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}

async function openTwin() {
  await page.goto(`${baseUrl}/#/twin`, { waitUntil: 'networkidle' });
  await canvas.waitFor();
  await page.waitForFunction(() => {
    const element = document.querySelector('.twin-canvas');
    return element?.dataset.sceneMode === 'operation' && element.dataset.labelOverlapCount === '0';
  });
}

async function advanceFromReset(steps) {
  await page.getByRole('button', { name: '重置作业' }).click();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.phase === 'IDLE');
  for (let step = 0; step < steps; step += 1) await page.getByRole('button', { name: '下一步' }).click();
  await page.waitForTimeout(80);
}

async function capture(name, scope, expected = {}) {
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.labelOverlapCount === '0');
  const metrics = await canvas.evaluate((element) => ({
    phase: element.dataset.phase,
    mode: element.dataset.sceneMode,
    shellOpaque: element.dataset.shellOpaque,
    roofOpacity: Number(element.dataset.roofOpacity),
    nearWallOpacity: Number(element.dataset.nearWallOpacity),
    doorOpaque: element.dataset.doorOpaque,
    debugGridVisible: element.dataset.debugGridVisible,
    labelOverlapCount: Number(element.dataset.labelOverlapCount),
    labelVisibleCount: Number(element.dataset.labelVisibleCount),
    containerPartCount: Number(element.dataset.containerPartCount),
    forkliftPartCount: Number(element.dataset.forkliftPartCount),
    doorProgress: Number(element.dataset.doorProgress),
    completedCount: Number(element.dataset.completedCount),
    currentIndex: Number(element.dataset.currentIndex)
  }));
  const expectedMode = expected.expectedMode || 'operation';
  assert.equal(metrics.mode, expectedMode);
  assert.equal(metrics.shellOpaque, 'false');
  assert.equal(metrics.doorOpaque, 'true');
  if (expectedMode === 'operation') {
    assert.ok(metrics.roofOpacity >= 0.15 && metrics.roofOpacity <= 0.2);
    assert.ok(metrics.nearWallOpacity >= 0.25 && metrics.nearWallOpacity <= 0.35);
  } else {
    assert.ok(Math.abs(metrics.roofOpacity - 0.16) < 0.001);
    assert.ok(Math.abs(metrics.nearWallOpacity - 0.16) < 0.001);
  }
  assert.equal(metrics.debugGridVisible, 'false');
  assert.equal(metrics.labelOverlapCount, 0);
  assert.ok(metrics.labelVisibleCount <= 3);
  assert.ok(metrics.containerPartCount > 30);
  assert.ok(metrics.forkliftPartCount > 20);
  assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
  if (expected.expectedPhase) assert.equal(metrics.phase, expected.expectedPhase);
  if (expected.doorsOpen) assert.equal(metrics.doorProgress, 1);
  if (expected.completed != null) assert.equal(metrics.completedCount, expected.completed);
  const filename = `${name}.png`;
  await page.locator(scope).screenshot({ path: path.join(outputDir, filename) });
  captures.push({ name, filename, ...metrics, ...expected });
}
