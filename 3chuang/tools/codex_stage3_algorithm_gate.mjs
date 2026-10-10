import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/playwright/stage3/algorithm');
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1672, height: 941 } });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const unexpectedResponses = [];
page.on('console', message => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', error => pageErrors.push(error.message));
page.on('response', response => response.status() >= 400 && unexpectedResponses.push(`${response.status()} ${response.url()}`));

const result = { assertions: {}, requests: [], consoleErrors, pageErrors, unexpectedResponses };
try {
  await page.goto(`${baseUrl}/#/cargo`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.removeItem('yonggui.web.session.v1');
    localStorage.removeItem('yonggui.web.session.v2');
  });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.cargo-table tbody tr').count(), 10);
  assert.match(await page.locator('.cargo-summary-line').innerText(), /221/);
  assert.match(await page.locator('.cargo-summary-line').innerText(), /8,812/);
  result.assertions.defaultDatasetLoaded = true;

  await page.goto(`${baseUrl}/#/container`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.algorithm-select').count(), 0);
  assert.equal(await page.locator('.page-header select').count(), 0);
  assert.equal(await page.locator('[data-authoritative-algorithm="fast-block"]').count(), 1);
  assert.match(await page.locator('[data-authoritative-algorithm="fast-block"]').innerText(), /Fast Block多约束三维装箱引擎/);
  result.assertions.noAlgorithmSelector = true;
  result.assertions.singleSourceLabel = true;

  const firstRequestPromise = page.waitForRequest(request => request.url().includes('/api/packing/generate') && request.method() === 'POST');
  await page.getByRole('button', { name: '生成真实方案', exact: true }).click();
  const firstRequest = await firstRequestPromise;
  result.requests.push(firstRequest.postDataJSON());
  assert.equal(result.requests[0].options.algorithmId, 'fast-block');
  await page.getByText('后端真实方案', { exact: true }).first().waitFor({ timeout: 75000 });
  await page.waitForTimeout(300);

  const session = await getSession(page);
  assert.equal(session.order.orderNo, 'NB2026-DEMO-01');
  assert.equal(session.cargo.length, 10);
  assert.equal(session.backendPlan.totalCargoCount, 221);
  assert.equal(session.backendPlan.unloadedCargo.length, 0);
  assert.equal(session.backendPlan.ext_algorithmId, 'fast-block');
  assert.equal(session.backendPlan.constraintMeta.lifoCompliant, true);
  assert.equal(await page.locator('[data-unloaded-count="0"]').count(), 1);
  assert.match(await page.locator('[data-unloaded-count="0"]').innerText(), /全部装入/);
  result.assertions.realBackendPlan = true;
  result.assertions.fullyLoadedUi = true;

  const baselinePlan = canonicalPlan(session.backendPlan);
  const baselineCargoIds = await page.locator('[data-cargo-id]').evaluateAll(nodes => nodes.map(node => node.dataset.cargoId));
  for (const label of ['SKU 视图', '港序视图', '风险视图', '作业方式']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(120);
    const after = await getSession(page);
    assert.equal(canonicalPlan(after.backendPlan), baselinePlan, `${label} 改变了真实方案`);
    assert.deepEqual(await page.locator('[data-cargo-id]').evaluateAll(nodes => nodes.map(node => node.dataset.cargoId)), baselineCargoIds);
  }
  result.assertions.projectionViewsPreservePlanFingerprint = true;
  await page.screenshot({ path: path.join(outputDir, 'container-page.png'), fullPage: true });

  await page.evaluate(() => {
    const sessionValue = JSON.parse(localStorage.getItem('yonggui.web.session.v2'));
    sessionValue.algorithmId = 'realistic4d-multi-strategy';
    sessionValue.options = { algorithmId: 'realistic4d-multi-strategy' };
    localStorage.setItem('yonggui.web.session.v2', JSON.stringify(sessionValue));
  });
  await page.goto(`${baseUrl}/?algorithmId=realistic4d-multi-strategy#/container`, { waitUntil: 'networkidle' });
  const maliciousRequestPromise = page.waitForRequest(request => request.url().includes('/api/packing/generate') && request.method() === 'POST');
  await page.getByRole('button', { name: '重新计算', exact: true }).click();
  const maliciousRequest = await maliciousRequestPromise;
  result.requests.push(maliciousRequest.postDataJSON());
  assert.equal(result.requests[1].options.algorithmId, 'fast-block');
  await page.getByText('后端真实方案', { exact: true }).first().waitFor({ timeout: 75000 });
  result.assertions.urlAndStorageCannotChangeAlgorithm = true;

  await page.route('**/api/packing/generate', route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ code: 500, message: 'STAGE3 simulated packing failure', data: null })
  }));
  await page.getByRole('button', { name: '重新计算', exact: true }).click();
  await page.locator('.page-error').waitFor();
  assert.match(await page.locator('.page-error').innerText(), /STAGE3 simulated packing failure/);
  assert.equal(await page.getByText('后端真实方案', { exact: true }).first().count(), 1);
  assert.equal((await getSession(page)).backendPlan.source, 'backend');
  result.assertions.failureKeepsLastConfirmedBackendPlan = true;
  await page.unroute('**/api/packing/generate');

  result.plan = {
    planId: session.backendPlan.planId,
    loaded: session.backendPlan.totalCargoCount,
    unloaded: session.backendPlan.unloadedCargo.length,
    utilization: session.backendPlan.spaceUtilization,
    fingerprint: session.backendPlan.inputFingerprint,
    algorithmId: session.backendPlan.ext_algorithmId
  };
  result.simulatedErrors = unexpectedResponses.filter(entry => entry.startsWith('500 '));
  result.unexpectedResponses = unexpectedResponses.filter(entry => !entry.startsWith('500 '));
  result.unexpectedConsoleErrors = consoleErrors.filter(entry => !/500 \(Internal Server Error\)/.test(entry));
  assert.deepEqual(result.unexpectedResponses, []);
  assert.deepEqual(result.unexpectedConsoleErrors, []);
  assert.deepEqual(pageErrors, []);
  await fs.writeFile(path.join(outputDir, 'single-algorithm-gate.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.failure = { message: error.message, stack: error.stack };
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(outputDir, 'single-algorithm-gate.json'), `${JSON.stringify(result, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}

async function getSession(targetPage) {
  return targetPage.evaluate(() => JSON.parse(localStorage.getItem('yonggui.web.session.v2')));
}

function canonicalPlan(plan) {
  return JSON.stringify({
    containerInfo: plan.containerInfo,
    loadedCargo: plan.loadedCargo,
    unloadedCargo: plan.unloadedCargo,
    spaceUtilization: plan.spaceUtilization,
    totalWeight: plan.totalWeight,
    cog: plan.cog,
    cogOffset: plan.cogOffset,
    constraintMeta: plan.constraintMeta,
    inputFingerprint: plan.inputFingerprint,
    ext_algorithmId: plan.ext_algorithmId
  });
}
