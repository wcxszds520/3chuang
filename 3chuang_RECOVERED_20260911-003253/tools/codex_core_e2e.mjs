import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/playwright/core-e2e');
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1672, height: 941 }, acceptDownloads: true });
const page = await context.newPage();
const evidence = [];
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const badResponses = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => request.failure()?.errorText !== 'net::ERR_ABORTED' && failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`));
page.on('response', (response) => response.status() >= 400 && badResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`));

const record = (name, data = {}) => evidence.push({ name, at: new Date().toISOString(), ...data });

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
  assert.equal(await page.getByLabel('按目的港筛选').locator('option').count(), 4);
  await page.getByLabel('按作业方式筛选').selectOption('manual');
  assert.ok(await page.locator('.cargo-table tbody tr').count() >= 2);
  await page.getByLabel('按作业方式筛选').selectOption('all');
  record('official-demo-loaded', { skuCount: 10, pieces: 221, ports: 3 });

  await page.getByRole('button', { name: '新增 SKU', exact: true }).click();
  const editor = page.locator('.drawer').filter({ hasText: '新增货物' });
  await editor.getByRole('button', { name: '重型设备', exact: true }).click();
  await editor.getByLabel(/货物名称/).fill('E2E 工业模块');
  await editor.getByLabel(/SKU 编码/).fill('E2E-H01');
  await editor.getByRole('button', { name: '保存到当前订单', exact: true }).click();
  await page.locator('.cargo-table tbody tr').filter({ hasText: 'E2E-H01' }).waitFor();
  assert.equal(await page.locator('.cargo-table tbody tr').count(), 11);
  let row = page.locator('.cargo-table tbody tr').filter({ hasText: 'E2E-H01' });
  await row.getByRole('button', { name: '编辑 E2E-H01' }).click();
  await page.locator('.drawer').getByLabel(/^数量/).fill('2');
  await page.locator('.drawer').getByRole('button', { name: '保存到当前订单', exact: true }).click();
  row = page.locator('.cargo-table tbody tr').filter({ hasText: 'E2E-H01' });
  await row.getByText('× 2 件').waitFor();
  await row.getByRole('button', { name: '复制 E2E-H01' }).click();
  await page.locator('.cargo-table tbody tr').filter({ hasText: 'E2E-H01-COPY' }).waitFor();
  const copyRow = page.locator('.cargo-table tbody tr').filter({ hasText: 'E2E-H01-COPY' });
  await copyRow.getByRole('button', { name: '删除 E2E-H01-COPY' }).click();
  await page.getByRole('dialog', { name: /删除 E2E-H01-COPY/ }).getByRole('button', { name: '确认删除', exact: true }).click();
  await copyRow.waitFor({ state: 'detached' });
  record('cargo-crud', { added: true, editedQuantity: 2, duplicatedAndDeleted: true });

  await page.getByRole('button', { name: 'CSV 导入', exact: true }).click();
  const csvDialog = page.getByRole('dialog', { name: 'CSV 校验预览' });
  const csv = [
    'name,sku,length,width,height,weight,quantity,destinationPort,batchId,handlingMethod',
    'CSV 有效箱,CSV-OK,500,400,300,10,3,Hamburg,BATCH-E2E,manual',
    'CSV 错误箱,CSV-BAD,0,400,300,10,1.5,Hamburg,BATCH-E2E,manual'
  ].join('\n');
  await csvDialog.locator('input[type="file"]').setInputFiles({ name: 'cargo-e2e.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await csvDialog.getByText('有效 1').waitFor();
  await csvDialog.getByText('错误 1').waitFor();
  await csvDialog.getByRole('button', { name: '确认导入 1 行', exact: true }).click();
  await page.locator('.cargo-table tbody tr').filter({ hasText: 'CSV-OK' }).waitFor();
  assert.equal(await page.locator('.cargo-table tbody tr').filter({ hasText: 'CSV-BAD' }).count(), 0);
  record('csv-validation-import', { valid: 1, invalid: 1 });

  await page.getByRole('button', { name: '拍照识别', exact: true }).click();
  const vlmDrawer = page.locator('.drawer').filter({ hasText: '拍照识别货物' });
  await vlmDrawer.getByText(/服务可用|服务不可用/).waitFor({ timeout: 10_000 });
  const vlmStatus = (await vlmDrawer.innerText()).includes('服务可用') ? 'available' : 'unavailable';
  await vlmDrawer.getByRole('button', { name: '关闭', exact: true }).click();
  record('vlm-truthful-status', { status: vlmStatus });

  await page.getByRole('button', { name: '恢复演示模板', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '恢复模板', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.cargo-table tbody tr').length === 10);
  record('official-demo-reset', { restoredSkuCount: 10 });

  await page.goto(`${baseUrl}/#/container`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.algorithm-select').count(), 0);
  assert.equal(await page.locator('[data-authoritative-algorithm="fast-block"]').count(), 1);
  await page.getByRole('button', { name: '生成真实方案', exact: true }).click();
  await page.getByText('后端真实方案', { exact: true }).first().waitFor({ timeout: 75_000 });
  await page.waitForTimeout(260);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('yonggui.web.session.v2')));
  assert.equal(stored.backendPlan.source, 'backend');
  assert.equal(stored.backendPlan.ext_algorithmId, 'fast-block');
  assert.equal(stored.backendPlan.totalCargoCount, 221);
  assert.equal(stored.backendPlan.unloadedCargo.length, 0);
  assert.equal(stored.backendPlan.constraintMeta.lifoCompliant, true);
  const projectionIds = await page.locator('[data-cargo-id]').evaluateAll((nodes) => nodes.map((node) => node.dataset.cargoId));
  for (const view of ['SKU 视图', '港序视图', '风险视图', '作业方式']) {
    await page.getByRole('button', { name: view, exact: true }).click();
    assert.deepEqual(await page.locator('[data-cargo-id]').evaluateAll((nodes) => nodes.map((node) => node.dataset.cargoId)), projectionIds);
  }
  record('backend-plan-and-projections', { planId: stored.backendPlan.planId, loaded: 221, unloaded: 0, utilization: stored.backendPlan.spaceUtilization });

  await page.goto(`${baseUrl}/#/twin`, { waitUntil: 'networkidle' });
  const canvas = page.locator('.twin-canvas');
  await canvas.waitFor();
  assert.equal(await canvas.getAttribute('data-total-count'), '221');
  assert.equal(await canvas.getAttribute('data-actor-type'), 'manual');
  assert.ok(Number(await canvas.getAttribute('data-worker-part-count')) > 15);
  assert.equal(await page.locator('.operation-filters').getAttribute('data-filter-dimensions'), '7');
  await page.locator('.jump-control input').fill('13');
  await page.locator('.jump-control button').click();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.actorType === 'forklift');
  record('three-dual-actor-and-filters', { manualDefault: true, forkliftAtIndex: 12, filterDimensions: 7 });

  await page.goto(`${baseUrl}/#/compliance`, { waitUntil: 'networkidle' });
  await page.locator('.regulation-workbench').waitFor();
  assert.equal(await page.locator('.evidence-rule-list [data-rule-id]').count(), 7);
  assert.equal(await page.locator('.pdf-evidence-highlight').count(), 1);
  assert.equal(await page.locator('.audit-stage--ai').getAttribute('data-ai-layer-status'), 'idle');
  await page.getByRole('button', { name: '人工复核', exact: true }).click();
  const reviewDialog = page.getByRole('dialog', { name: '人工复核结论' });
  await reviewDialog.locator('input').fill('E2E 复核员');
  await reviewDialog.locator('select').selectOption('approved-with-conditions');
  await reviewDialog.locator('textarea').fill('补充 VGM 回执与 IPPC 照片后放行。');
  await reviewDialog.getByRole('button', { name: '记录结论', exact: true }).click();
  await page.getByText('E2E 复核员', { exact: true }).waitFor();
  assert.equal(await page.locator('.evidence-layer--manual.active').count(), 1);
  record('compliance-pdf-and-manual', { evidence: 7, reviewer: 'E2E 复核员' });

  await page.goto(`${baseUrl}/#/report`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.report-page').getAttribute('data-loaded-count'), '221');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /JSON 完整数据/ }).click();
  const download = await downloadPromise;
  const savedPath = await download.path();
  const parsed = JSON.parse(await fs.readFile(savedPath, 'utf8'));
  assert.equal(parsed.order.orderNo, 'NB2026-DEMO-01');
  assert.equal(parsed.plan.source, 'backend');
  assert.equal(parsed.plan.loadedCargo.length, 221);
  assert.equal(parsed.plan.unloadedCargo.length, 0);
  assert.equal(parsed.regulationEvidence.length, 7);
  assert.equal(parsed.manualReview.reviewer, 'E2E 复核员');
  record('report-json-download', { bytes: (await fs.stat(savedPath)).size, evidence: parsed.regulationEvidence.length });

  for (const route of ['dashboard', 'cargo', 'container', 'twin', 'compliance', 'report']) {
    await page.goto(`${baseUrl}/#/${route}`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.side-nav__order > strong').textContent(), 'NB2026-DEMO-01');
    assert.ok((await page.locator('body').innerText()).includes('NB2026-DEMO-01'));
  }
  record('order-consistent-six-pages', { orderNo: 'NB2026-DEMO-01' });

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(badResponses, []);
  const result = { evidence, assertions: Object.fromEntries(evidence.map((item) => [item.name, true])), consoleErrors, pageErrors, failedRequests, badResponses };
  await fs.writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  record('failure', { message: error.message, stack: error.stack });
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
  const result = { evidence, consoleErrors, pageErrors, failedRequests, badResponses };
  await fs.writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}
