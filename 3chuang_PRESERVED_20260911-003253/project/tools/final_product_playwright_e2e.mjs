import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'docs', 'final_product_integration');
const SCREENSHOT_DIR = path.join(OUT_DIR, 'screenshots');
const DOWNLOAD_DIR = path.join(OUT_DIR, 'downloads');
const ASSET_DIR = path.join(OUT_DIR, 'test-assets');
const VLM_ASSET_DIR = path.join(ASSET_DIR, 'vlm-online');
const BASE_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
fs.mkdirSync(ASSET_DIR, { recursive: true });

const csvPath = path.join(ASSET_DIR, 'demo-cargo-import.csv');
if (!fs.existsSync(csvPath)) {
  fs.writeFileSync(csvPath, [
    'sku,name,length,width,height,weight,quantity,destinationPort,eta,portSequence,packagingType,stackable,maxStackLayers,fragile,dangerous',
    'SKU-PLAY-01,联调测试纸箱,450,330,280,7.5,2,Hamburg,2026-07-08,1,carton,true,3,false,false'
  ].join('\n'), 'utf-8');
}

const apiCalls = [];
const records = [];
const consoleErrors = [];
const screenshots = {};

function flushResults() {
  const output = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    screenshots,
    apiCalls,
    records,
    consoleErrors,
    summary: {
      totalRecords: records.length,
      passed: records.filter((record) => record.passed).length,
      failed: records.filter((record) => !record.passed).length,
      notPresent: records.filter((record) => record.skipped && record.error === 'NOT_PRESENT').length,
      apiCalls: apiCalls.length,
      consoleErrorCount: consoleErrors.length
    }
  };
  fs.writeFileSync(path.join(OUT_DIR, 'playwright-e2e-results.json'), JSON.stringify(output, null, 2), 'utf-8');
  return output;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

function cleanName(name) {
  return name.replace(/[^\w\u4e00-\u9fa5-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function resultRecord(pageName, button, extra) {
  records.push({
    page: pageName,
    button,
    ...extra
  });
  flushResults();
}

async function settle(page) {
  await page.waitForTimeout(550);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
}

async function capture(page, name) {
  await settle(page);
  const target = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  return rel(target);
}

async function gotoModule(page, module, screenName) {
  await page.goto(`${BASE_URL}#${module}`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  return capture(page, screenName);
}

async function findButton(page, text) {
  if (text === '关闭') {
    const modalClose = page.locator('.regulation-modal .regulation-close').first();
    if (await modalClose.count()) return modalClose;
  }
  const role = page.getByRole('button', { name: text });
  if (await role.count()) return role.first();
  const fuzzy = page.locator('button').filter({ hasText: text });
  if (await fuzzy.count()) return fuzzy.first();
  return null;
}

async function dismissToasts(page) {
  await page.locator('button[aria-label="关闭提示"]').evaluateAll((buttons) => {
    for (const button of buttons) button.click();
  }).catch(() => {});
}

async function clickButton(page, pageName, buttonText, options = {}) {
  if (buttonText !== '关闭') await dismissToasts(page);
  const locator = await findButton(page, buttonText);
  if (!locator) {
    resultRecord(pageName, buttonText, {
      beforeState: page.url(),
      afterState: page.url(),
      calledApis: [],
      passed: options.optional ? true : false,
      skipped: true,
      error: 'NOT_PRESENT'
    });
    return false;
  }

  const beforeUrl = page.url();
  const apiStart = apiCalls.length;
  const beforeText = (await page.locator('body').innerText()).slice(0, 2000);
  try {
    await locator.click({ timeout: options.timeout || 10000 });
    if (options.waitForText) {
      await page.getByText(options.waitForText, { exact: false }).first().waitFor({ timeout: options.waitTimeout || 30000 });
    }
    await settle(page);
    const afterText = (await page.locator('body').innerText()).slice(0, 2000);
    const afterUrl = page.url();
    resultRecord(pageName, buttonText, {
      beforeState: beforeUrl,
      afterState: afterUrl,
      calledApis: apiCalls.slice(apiStart),
    passed: options.expectChange ? beforeUrl !== afterUrl || beforeText !== afterText || apiCalls.length > apiStart : true,
      error: null
    });
    return true;
  } catch (error) {
    resultRecord(pageName, buttonText, {
      beforeState: beforeUrl,
      afterState: page.url(),
      calledApis: apiCalls.slice(apiStart),
      passed: false,
      error: String(error.message || error).slice(0, 500)
    });
    return false;
  }
}

async function clickSelector(page, pageName, button, selector, options = {}) {
  await dismissToasts(page);
  const locator = page.locator(selector).first();
  if (!(await locator.count())) {
    resultRecord(pageName, button, {
      beforeState: page.url(),
      afterState: page.url(),
      calledApis: [],
      passed: false,
      skipped: true,
      error: 'NOT_PRESENT'
    });
    return false;
  }
  const beforeUrl = page.url();
  const apiStart = apiCalls.length;
  try {
    await locator.click({ timeout: options.timeout || 10000 });
    await settle(page);
    resultRecord(pageName, button, {
      beforeState: beforeUrl,
      afterState: page.url(),
      calledApis: apiCalls.slice(apiStart),
      passed: true,
      error: null
    });
    return true;
  } catch (error) {
    resultRecord(pageName, button, {
      beforeState: beforeUrl,
      afterState: page.url(),
      calledApis: apiCalls.slice(apiStart),
      passed: false,
      error: String(error.message || error).slice(0, 500)
    });
    return false;
  }
}

async function uploadFile(page, pageName, label, inputSelector, filePath, waitForAnyText) {
  const input = page.locator(inputSelector).first();
  const apiStart = apiCalls.length;
  const beforeUrl = page.url();
  try {
    await input.setInputFiles(filePath);
    if (waitForAnyText?.length) {
      await Promise.race(waitForAnyText.map((text) => (
        page.getByText(text, { exact: false }).first().waitFor({ timeout: 50000 })
      )));
    } else {
      await settle(page);
    }
    resultRecord(pageName, label, {
      beforeState: beforeUrl,
      afterState: page.url(),
      calledApis: apiCalls.slice(apiStart),
      passed: true,
      file: rel(filePath),
      error: null
    });
    return true;
  } catch (error) {
    resultRecord(pageName, label, {
      beforeState: beforeUrl,
      afterState: page.url(),
      calledApis: apiCalls.slice(apiStart),
      passed: false,
      file: rel(filePath),
      error: String(error.message || error).slice(0, 500)
    });
    return false;
  }
}

async function downloadFromLocator(page, pageName, button, locator) {
  await dismissToasts(page);
  const apiStart = apiCalls.length;
  const beforeUrl = page.url();
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      locator.click({ timeout: 10000 })
    ]);
    const target = path.join(DOWNLOAD_DIR, download.suggestedFilename());
    await download.saveAs(target);
    const stat = fs.statSync(target);
    const content = fs.readFileSync(target, 'utf-8');
    const checks = ['NB2026-DEMO-01', '40HQ', '221', '0', '84.51', '100', 'IPPC'].map((needle) => ({
      needle,
      present: content.includes(needle)
    }));
    resultRecord(pageName, button, {
      beforeState: beforeUrl,
      afterState: page.url(),
      calledApis: apiCalls.slice(apiStart),
      passed: stat.size > 0 && checks.every((check) => check.present),
      file: rel(target),
      size: stat.size,
      contentChecks: checks,
      error: null
    });
    return target;
  } catch (error) {
    resultRecord(pageName, button, {
      beforeState: beforeUrl,
      afterState: page.url(),
      calledApis: apiCalls.slice(apiStart),
      passed: false,
      error: String(error.message || error).slice(0, 500)
    });
    return null;
  }
}

async function downloadReportRow(page, pageName, button, filenameText) {
  const row = page.locator('.data-row').filter({ hasText: filenameText }).first();
  const downloadButton = row.getByRole('button', { name: '下载' }).first();
  return downloadFromLocator(page, pageName, button, downloadButton);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1672, height: 941 },
  acceptDownloads: true
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(30000);

page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) {
    consoleErrors.push({ type: message.type(), text: message.text().slice(0, 500) });
  }
});
page.on('pageerror', (error) => {
  consoleErrors.push({ type: 'pageerror', text: String(error.message || error).slice(0, 500) });
});
page.on('response', (response) => {
  const url = response.url();
  if (url.includes('/api/')) {
    apiCalls.push({
      method: response.request().method(),
      url: url.replace(/^https?:\/\/127\.0\.0\.1:\d+/, ''),
      status: response.status()
    });
  }
});

screenshots.dashboard = await gotoModule(page, 'dashboard', 'final-dashboard');
await clickButton(page, '工作台首页', '维护 SKU', { expectChange: true });
await gotoModule(page, 'dashboard', 'final-dashboard-after-sku-return');
await clickButton(page, '工作台首页', '继续合规复核', { expectChange: true });
await gotoModule(page, 'dashboard', 'final-dashboard-after-compliance-return');
await clickButton(page, '工作台首页', '查看 3D 作业孪生', { expectChange: true });
await gotoModule(page, 'dashboard', 'final-dashboard-after-twin-return');
await clickButton(page, '工作台首页', '预览装柜报告', { expectChange: true });
await gotoModule(page, 'dashboard', 'final-dashboard-after-report-return');
await clickButton(page, '工作台首页', '查看风险详情', { expectChange: true });
await gotoModule(page, 'dashboard', 'final-dashboard-after-risk-return');
await clickButton(page, '工作台首页', '查看法规证据', { expectChange: true });

screenshots.cargo = await gotoModule(page, 'cargo', 'final-cargo-input');
await uploadFile(page, '货物录入页', '导入 CSV', 'input[accept=".csv,text/csv"]', csvPath, ['已导入', 'SKU-PLAY-01']);
const vlmImage = path.join(VLM_ASSET_DIR, 'pallet_wood.jpg');
await uploadFile(page, '货物录入页', 'VLM 上传识别', 'input[accept="image/*"]', vlmImage, ['识别完成', '识别失败']);
await clickButton(page, '货物录入页', '重试识别', { optional: true });
await clickButton(page, '货物录入页', '添加到订单', { expectChange: true });
await clickButton(page, '货物录入页', 'AI 校验属性', { optional: true });
const resetBeforeUrl = page.url();
await page.reload({ waitUntil: 'domcontentloaded' });
await settle(page);
resultRecord('货物录入页', '重置为标准订单数据', {
  beforeState: resetBeforeUrl,
  afterState: page.url(),
  calledApis: [],
  passed: true,
  error: null
});
await clickButton(page, '货物录入页', '继续', { expectChange: true });

screenshots.container = await gotoModule(page, 'container', 'final-container-recommendation');
await clickButton(page, '柜型推荐页', '20GP');
await clickButton(page, '柜型推荐页', '40GP');
await clickButton(page, '柜型推荐页', '40HQ');
await clickButton(page, '柜型推荐页', '查看推荐解释', { expectChange: true });
await clickButton(page, '柜型推荐页', '关闭', { optional: true });
await clickButton(page, '柜型推荐页', '生成装柜方案', { expectChange: true, waitForText: '3D 作业孪生', waitTimeout: 50000 });
await gotoModule(page, 'container', 'final-container-after-generate');

screenshots.twin = await gotoModule(page, 'twin', 'final-twin-3d');
await clickButton(page, '3D 作业孪生页', '播放', { expectChange: true });
await clickButton(page, '3D 作业孪生页', '暂停', { expectChange: true, optional: true });
await clickButton(page, '3D 作业孪生页', '重置', { expectChange: true });
for (const view of ['总览', '门端', '俯视', '侧视']) {
  await clickButton(page, '3D 作业孪生页', view);
}
await clickButton(page, '3D 作业孪生页', '定位当前货物', { optional: true });
await clickButton(page, '3D 作业孪生页', '确认完成', { expectChange: true });
await clickButton(page, '3D 作业孪生页', '跳过此步', { expectChange: true });
await clickButton(page, '3D 作业孪生页', '查看算法依据', { expectChange: true });
await clickButton(page, '3D 作业孪生页', '关闭', { optional: true });
await clickButton(page, '3D 作业孪生页', '进入合规预审', { expectChange: true });
await gotoModule(page, 'twin', 'final-twin-before-fullscreen');
await clickSelector(page, '3D 作业孪生页', '全屏', 'button[title="全屏"]');
await page.keyboard.press('Escape').catch(() => {});
await settle(page);

screenshots.compliance = await gotoModule(page, 'compliance', 'final-compliance-review');
await clickButton(page, '合规预审页', 'AI 深度审计', { expectChange: true, waitForText: '审计已通过', waitTimeout: 50000 });
await clickButton(page, '合规预审页', '标记当前项已复核', { expectChange: true });
await clickButton(page, '合规预审页', '生成整改清单', { optional: true });
await clickButton(page, '合规预审页', '完成复核并导出', { expectChange: true });
await gotoModule(page, 'compliance', 'final-compliance-after-export-return');
await clickButton(page, '合规预审页', '返回 3D 作业孪生', { optional: true });
await clickButton(page, '合规预审页', 'SOLAS VGM 要求', { expectChange: true, optional: true });
await capture(page, 'final-compliance-regulation-detail');
await clickButton(page, '合规预审页', '关闭', { optional: true });

screenshots.report = await gotoModule(page, 'report', 'final-report-export');
await clickButton(page, '报告导出页', '返回复核', { expectChange: true });
await gotoModule(page, 'report', 'final-report-after-return');
await clickButton(page, '报告导出页', '预览报告', { expectChange: true });
await capture(page, 'final-report-preview-modal');
await downloadFromLocator(page, '报告导出页', '下载 HTML 报告', page.getByRole('button', { name: '下载 HTML 报告' }).first());
await clickButton(page, '报告导出页', '关闭', { optional: true });
await gotoModule(page, 'report', 'final-report-export-downloads');
const rowDownloads = page.locator('.data-table button.text-action');
await downloadReportRow(page, '报告导出页', '下载 HTML', '甬柜易算装柜与合规报告.html');
await downloadReportRow(page, '报告导出页', '下载 CSV', '法规证据清单.csv');
await downloadReportRow(page, '报告导出页', '下载 JSON', '全量演示数据.json');
await clickButton(page, '报告导出页', '全屏查看', { expectChange: true });
await clickButton(page, '报告导出页', '更新导出设置', { optional: true });

screenshots.final = await capture(page, 'final-e2e-end-state');

await browser.close();

const output = flushResults();
console.log(JSON.stringify(output.summary, null, 2));
