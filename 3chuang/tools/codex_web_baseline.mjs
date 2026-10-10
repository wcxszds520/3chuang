import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(process.cwd());
const BASE_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.join(ROOT, 'output', 'playwright', 'baseline');
const SCREEN_DIR = path.join(OUT_DIR, 'screenshots');
const DOWNLOAD_DIR = path.join(OUT_DIR, 'downloads');
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1672, height: 941 },
  { width: 1280, height: 720 }
];
const PAGES = [
  ['dashboard', '港前装柜智能工作台'],
  ['cargo', '货物录入与 SKU 管理'],
  ['container', '柜型推荐与装柜决策'],
  ['twin', '3D 作业孪生与装柜过程'],
  ['compliance', '合规预审与法规溯源'],
  ['report', '报告导出与成果中心']
];

await fs.mkdir(SCREEN_DIR, { recursive: true });
await fs.mkdir(DOWNLOAD_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const output = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  captures: [],
  interactions: [],
  consoleErrors: [],
  failedResponses: [],
  downloads: []
};

function rel(target) {
  return path.relative(ROOT, target).replaceAll('\\', '/');
}

async function recordInteraction(name, fn) {
  const item = { name, passed: false, details: null, error: null };
  try {
    item.details = await fn();
    item.passed = true;
  } catch (error) {
    item.error = error?.message || String(error);
  }
  output.interactions.push(item);
}

async function capturePage(page, pageId, title, viewport) {
  await page.goto(`${BASE_URL}#${pageId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: title, exact: true }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(pageId === 'twin' ? 1800 : 700);
  const state = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const buttons = Array.from(document.querySelectorAll('button')).filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    const tables = Array.from(document.querySelectorAll('.data-table, table')).map((table) => ({
      className: table.className,
      clientWidth: table.clientWidth,
      scrollWidth: table.scrollWidth,
      overflowX: getComputedStyle(table).overflowX
    }));
    const canvas = document.querySelector('canvas');
    return {
      document: {
        clientWidth: root.clientWidth,
        scrollWidth: Math.max(root.scrollWidth, body?.scrollWidth || 0),
        clientHeight: root.clientHeight,
        scrollHeight: Math.max(root.scrollHeight, body?.scrollHeight || 0)
      },
      visibleButtons: buttons.map((button) => (button.innerText || button.getAttribute('aria-label') || button.title || '').trim()).filter(Boolean),
      disabledButtons: buttons.filter((button) => button.disabled).map((button) => (button.innerText || button.title || '').trim()),
      tables,
      canvas: canvas ? {
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight
      } : null,
      overlayCount: document.querySelectorAll('.regulation-modal-overlay, .yg-reg-overlay, [role="dialog"]').length,
      textHead: (body?.innerText || '').slice(0, 1200)
    };
  });
  const filename = `${viewport.width}x${viewport.height}-${pageId}.png`;
  const target = path.join(SCREEN_DIR, filename);
  await page.screenshot({ path: target, fullPage: false });
  output.captures.push({ page: pageId, viewport, screenshot: rel(target), state });
}

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') {
      output.consoleErrors.push({ viewport, page: page.url(), type: 'console', text: message.text().slice(0, 1000) });
    }
  });
  page.on('pageerror', (error) => {
    output.consoleErrors.push({ viewport, page: page.url(), type: 'pageerror', text: String(error?.message || error).slice(0, 1000) });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      output.failedResponses.push({ viewport, page: page.url(), status: response.status(), url: response.url() });
    }
  });

  for (const [pageId, title] of PAGES) {
    await capturePage(page, pageId, title, viewport);
  }

  if (viewport.width === 1672) {
    await page.goto(`${BASE_URL}#dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    await recordInteraction('工作台通知 Toast 不应永久残留', async () => {
      await page.locator('button[title="通知"]').click();
      const toast = page.locator('.yg-toast').first();
      await toast.waitFor({ timeout: 5000 });
      const initialText = await toast.innerText();
      await page.waitForTimeout(5200);
      return { initialText, remainedAfter5200ms: await toast.count() > 0 && await toast.isVisible().catch(() => false) };
    });

    await recordInteraction('导航后遮罩清理', async () => {
      await page.goto(`${BASE_URL}#container`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '查看推荐解释' }).click();
      const openCount = await page.locator('.regulation-modal-overlay').count();
      await page.getByRole('button', { name: '知道了' }).click();
      await page.goto(`${BASE_URL}#cargo`, { waitUntil: 'domcontentloaded' });
      const closedCount = await page.locator('.regulation-modal-overlay, .yg-reg-overlay').count();
      return { openCount, overlayCountAfterNavigation: closedCount };
    });

    await recordInteraction('CSV 导入更新当前前端会话', async () => {
      const csv = [
        'sku,name,length,width,height,weight,quantity,destinationPort,eta,portSequence,packagingType,stackable,maxStackLayers,fragile,dangerous',
        'BASELINE-CSV-01,基线校验纸箱,450,330,280,7.5,2,Hamburg,2026-07-08,1,carton,true,3,false,false'
      ].join('\n');
      const before = await page.locator('.sku-panel .data-row:not(.data-head)').count();
      await page.locator('input[type="file"][accept*="csv"]').setInputFiles({
        name: 'baseline.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csv, 'utf8')
      });
      await page.waitForTimeout(300);
      const after = await page.locator('.sku-panel .data-row:not(.data-head)').count();
      return { before, after, imported: after === before + 1 };
    });

    await recordInteraction('3D 播放、暂停、重置与四视角', async () => {
      await page.goto(`${BASE_URL}#twin`, { waitUntil: 'domcontentloaded' });
      await page.locator('canvas').first().waitFor({ timeout: 15000 });
      const slider = page.locator('input[type="range"]').first();
      const before = Number(await slider.inputValue());
      await page.getByRole('button', { name: '播放', exact: true }).first().click();
      await page.waitForTimeout(700);
      const playing = Number(await slider.inputValue());
      await page.getByRole('button', { name: '暂停', exact: true }).first().click();
      await page.waitForTimeout(500);
      const pausedA = Number(await slider.inputValue());
      await page.waitForTimeout(500);
      const pausedB = Number(await slider.inputValue());
      const views = {};
      for (const view of ['总览', '门端', '俯视', '侧视']) {
        await page.getByRole('button', { name: view, exact: true }).first().click();
        await page.waitForTimeout(300);
        const target = path.join(SCREEN_DIR, `1672x941-twin-${view}.png`);
        await page.screenshot({ path: target, fullPage: false });
        views[view] = rel(target);
      }
      await page.getByTitle('重置').click();
      const reset = Number(await slider.inputValue());
      return { before, playing, pausedA, pausedB, pauseStable: pausedA === pausedB, reset, views };
    });

    await recordInteraction('3D 算法依据弹窗关闭', async () => {
      await page.getByRole('button', { name: '查看算法依据' }).click();
      const before = await page.locator('.regulation-modal-overlay').count();
      await page.getByRole('button', { name: '关闭', exact: true }).last().click();
      const after = await page.locator('.regulation-modal-overlay').count();
      return { before, after };
    });

    await recordInteraction('法规证据抽屉打开关闭', async () => {
      await page.goto(`${BASE_URL}#compliance`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /SOLAS VGM 要求/ }).click();
      await page.locator('.yg-reg-drawer').waitFor({ timeout: 15000 });
      const before = await page.locator('.yg-reg-drawer').count();
      await page.locator('.yg-reg-close').click();
      const after = await page.locator('.yg-reg-drawer').count();
      return { before, after };
    });

    await recordInteraction('报告预览关闭与 JSON 下载', async () => {
      await page.goto(`${BASE_URL}#report`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '预览报告', exact: true }).click();
      await page.locator('.report-preview-modal').waitFor({ timeout: 10000 });
      await page.locator('.report-preview-modal .regulation-close').click();
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        page.getByRole('button', { name: /下载全量 JSON/ }).first().click()
      ]);
      const target = path.join(DOWNLOAD_DIR, download.suggestedFilename());
      await download.saveAs(target);
      const content = await fs.readFile(target, 'utf8');
      const parsed = JSON.parse(content);
      output.downloads.push({ path: rel(target), bytes: Buffer.byteLength(content), orderNo: parsed.orderNo });
      return { modalClosed: await page.locator('.report-preview-modal').count() === 0, bytes: Buffer.byteLength(content), orderNo: parsed.orderNo };
    });
  }

  await context.close();
}

await browser.close();
await fs.writeFile(path.join(OUT_DIR, 'baseline-results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');

const summary = {
  captures: output.captures.length,
  interactions: output.interactions.length,
  interactionFailures: output.interactions.filter((item) => !item.passed).length,
  consoleErrors: output.consoleErrors.length,
  failedResponses: output.failedResponses.length,
  downloads: output.downloads.length,
  result: rel(path.join(OUT_DIR, 'baseline-results.json'))
};
console.log(JSON.stringify(summary, null, 2));
