// Landing solver 章节分阶段截图：滚动到每个 data-space-step 触发位并截取 sticky 舞台。
// 用法: node tools/landing_solver_shot.mjs <outPrefix> [width height] [url]
import { chromium } from 'playwright';

const prefix = process.argv[2] || 'tmp/landing-solver';
const width = Number(process.argv[3] || 1600);
const height = Number(process.argv[4] || 900);
const url = process.argv[5] || 'http://127.0.0.1:5173/';

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2600);

const steps = await page.$$eval('[data-space-step]', (nodes) => nodes.map((n) => n.dataset.spaceStep));
console.log('space steps found:', steps.join(','));

for (const step of steps) {
  await page.evaluate((s) => {
    document.querySelector(`[data-space-step="${s}"]`)?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, step);
  await page.waitForTimeout(1100);
  const active = await page.$eval('.pc-space-stage', (el) => el.getAttribute('data-space-active'));
  // locator.screenshot 会再次滚动触发 observer；改用 page.screenshot + clip 保持当前状态。
  const box = await page.locator('.pc-space-stage').boundingBox();
  await page.screenshot({ path: `${prefix}-stage${step}.png`, clip: box, timeout: 20000 });
  console.log(`stage ${step} -> data-space-active=${active} saved`);
}
await page.close();
await browser.close();
