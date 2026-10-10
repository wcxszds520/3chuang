// 截取本轮修改过的页面：Landing 首页（含求解章节五阶段）+ 数字孪生页（复核视图 + 作业回放）。
// 输出到 outputs/screenshots-2026-09-06/。用法: node tools/capture_modified_pages.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'outputs/screenshots-2026-09-06';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:5173';

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

// ---------- Landing ----------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2600);
await page.screenshot({ path: `${OUT}/landing-01-hero.png` });
console.log('landing hero saved');

// 求解章节五阶段（真实滚动触发）
const steps = await page.$$eval('[data-space-step]', (nodes) => nodes.map((n) => n.dataset.spaceStep));
for (const step of steps) {
  await page.evaluate((s) => {
    document.querySelector(`[data-space-step="${s}"]`)?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, step);
  await page.waitForTimeout(1100);
  const box = await page.locator('.pc-space-stage').boundingBox();
  await page.screenshot({ path: `${OUT}/landing-solver-stage${step}.png`, clip: box });
  console.log(`solver stage ${step} saved`);
}

// 整页（capture 模式强制展开所有 reveal 状态 + 孪生区立即渲染）
await page.goto(`${BASE}/?capture=1`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(4200);
await page.screenshot({ path: `${OUT}/landing-full.png`, fullPage: true });
console.log('landing full saved');

// ---------- 数字孪生页 ----------
await page.goto(`${BASE}/#/workspace/twin`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForSelector('.twin-canvas canvas, canvas', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(5200);
await page.screenshot({ path: `${OUT}/twin-01-review.png` });
console.log('twin review saved');

// 开始装载作业回放（Reality Pass 重构的 waiting pool / worker / forklift）
await page.click('.operation-play', { timeout: 8000 }).catch((e) => console.log('play click failed:', e.message));
await page.waitForTimeout(2600);
await page.screenshot({ path: `${OUT}/twin-02-operation-early.png` });
console.log('twin operation early saved');

// 加速到 4×，推进到中段（人工搬运 / 叉车作业可见）
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('.speed-control button')];
  buttons.find((b) => b.textContent.trim() === '4×')?.click();
});
await page.waitForTimeout(6500);
await page.screenshot({ path: `${OUT}/twin-03-operation-mid.png` });
const phase = await page.evaluate(() => document.querySelector('.operation-panel, .twin-page')?.textContent?.slice(0, 0) || '');
await page.waitForTimeout(6500);
await page.screenshot({ path: `${OUT}/twin-04-operation-late.png` });
console.log('twin operation mid/late saved', phase);

console.log('pageerrors:', errors.length ? errors.join('\n') : 'NONE');
await browser.close();
