import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs', 'advanced_open_design_web');
const screenshotDir = path.join(outDir, 'screenshots');
const downloadDir = path.join(outDir, 'downloads');
const baseUrl = process.env.YG_WEB_URL || 'http://127.0.0.1:4174/';

async function record(results, pageName, action, fn) {
  const item = { page: pageName, action, passed: false, error: '' };
  try {
    await fn();
    item.passed = true;
  } catch (error) {
    item.error = error.message || String(error);
  }
  results.push(item);
}

async function main() {
  await fs.mkdir(downloadDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1672, height: 941 },
    acceptDownloads: true
  });
  const page = await context.newPage();
  const results = [];

  await record(results, '工作台', '页面加载', async () => {
    await page.goto(`${baseUrl}#dashboard`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: '港前装柜智能工作台' }).waitFor({ timeout: 10000 });
  });

  await record(results, '工作台', '维护 SKU 导航', async () => {
    await page.getByRole('button', { name: /维护 SKU/ }).click();
    await page.waitForURL(/#cargo/, { timeout: 10000 });
    await page.getByRole('heading', { name: '货物录入与 SKU 管理' }).waitFor({ timeout: 10000 });
  });

  await record(results, '货物录入', '进入柜型推荐', async () => {
    await page.getByRole('button', { name: /^继续$/ }).click();
    await page.waitForURL(/#container/, { timeout: 10000 });
    await page.getByRole('heading', { name: '柜型推荐与装柜决策' }).waitFor({ timeout: 10000 });
  });

  await record(results, '柜型推荐', '查看推荐解释弹窗', async () => {
    await page.getByRole('button', { name: '查看推荐解释' }).click();
    await page.getByRole('heading', { name: '40HQ 推荐解释' }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: '知道了' }).click();
  });

  await record(results, '3D 作业孪生', '视角切换与算法依据', async () => {
    await page.goto(`${baseUrl}#twin`, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 30000 });
    for (const label of ['总览', '门端', '俯视', '侧视']) {
      await page.getByRole('button', { name: label }).first().click();
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: '查看算法依据' }).first().click();
    await page.getByRole('heading', { name: '第 26 步算法依据' }).waitFor({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDir, 'interaction-algorithm-modal.png'), fullPage: false });
    await page.getByRole('button', { name: '关闭' }).last().click();
  });

  await record(results, '合规预审', '查看法规证据弹窗', async () => {
    await page.goto(`${baseUrl}#compliance`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /SOLAS VGM 要求/ }).click();
    await page.getByRole('heading', { name: /SOLAS VGM 要求/ }).waitFor({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDir, 'interaction-regulation-modal.png'), fullPage: false });
    await page.getByRole('button', { name: '关闭' }).last().click();
  });

  await record(results, '报告导出', '预览报告并下载 JSON', async () => {
    await page.goto(`${baseUrl}#report`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '预览报告' }).click();
    await page.getByRole('heading', { name: '甬柜易算装柜与合规报告预览' }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: '关闭' }).last().click();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.getByRole('button', { name: /下载全量 JSON/ }).first().click()
    ]);
    await download.saveAs(path.join(downloadDir, '甬柜易算演示数据-NB2026-DEMO-01.json'));
  });

  await fs.writeFile(
    path.join(outDir, 'frontend-interaction-results.json'),
    `${JSON.stringify({ baseUrl, results }, null, 2)}\n`,
    'utf8'
  );
  await context.close();
  await browser.close();
  console.log(JSON.stringify({ baseUrl, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
