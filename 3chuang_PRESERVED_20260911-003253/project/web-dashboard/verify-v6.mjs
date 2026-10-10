import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5173/#dashboard', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000); // 等 3D 加载
await page.screenshot({ path: 'd:/cixing/3chuang/web-dashboard/dashboard-v6-hero.png' });

// 自检 V6
const audit = await page.evaluate(() => {
  const ws = document.querySelector('.workspace');
  const focus = ws?.querySelector('.yg-focus-v6');
  const canvas3d = ws?.querySelector('.yg-focus-3d canvas');
  const overlay = ws?.querySelector('.yg-3d-overlay');
  const scoreVal = ws?.querySelector('.yg-focus-score .yg-score-value');
  return {
    hasFocusV6: !!focus,
    has3dCanvas: !!canvas3d,
    canvasW: canvas3d?.width || 0,
    canvasH: canvas3d?.height || 0,
    has3dOverlay: !!overlay,
    overlayText: overlay?.textContent?.replace(/\s+/g,' ').trim().slice(0,40),
    scoreFontSize: scoreVal ? getComputedStyle(scoreVal).fontSize : null,
    scoreText: scoreVal?.textContent?.replace(/\s+/g,' ').trim().slice(0,20),
    hasPipeline: !!ws?.querySelector('.yg-pipeline'),
    hasVerdict: !!ws?.querySelector('.yg-verdict'),
    surfaceCount: ws?.querySelectorAll('.surface').length || 0,
    dataConsistency: /444\/864/.test(ws?.textContent || ''),
    noDemoLeak: !/72\.5%|661\/864|DEMO\./.test(ws?.textContent || ''),
    headerNoLeak: !/DEMO\.orderNo|DEMO\.route/.test(document.body.innerHTML),
  };
});
console.log(JSON.stringify({ audit }, null, 2));

// 滚动后截图
await page.evaluate(() => document.querySelector('.workspace')?.scrollTo({ top: 500 }));
await page.waitForTimeout(800);
await page.screenshot({ path: 'd:/cixing/3chuang/web-dashboard/dashboard-v6-mid.png' });

await browser.close();
