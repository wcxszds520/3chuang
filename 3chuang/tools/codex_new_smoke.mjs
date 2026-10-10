import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('output/playwright/new-smoke');
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`));

await page.goto('http://127.0.0.1:5173/#/dashboard', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('yonggui.web.session.v1'));
await page.reload({ waitUntil: 'networkidle' });

const routes = ['dashboard', 'cargo', 'container', 'twin', 'compliance', 'report'];
const pages = [];
for (const route of routes) {
  await page.goto(`http://127.0.0.1:5173/#/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(route === 'twin' ? 2400 : 500);
  const metrics = await page.evaluate(() => {
    const main = document.querySelector('.app-main');
    const primary = document.querySelector('.page-header .button--primary');
    const rect = primary?.getBoundingClientRect();
    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: innerWidth,
      bodyHeight: document.body.scrollHeight,
      primaryVisible: Boolean(rect && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth),
      mainWidth: main?.getBoundingClientRect().width,
      canvasCount: document.querySelectorAll('canvas').length,
      overlays: document.querySelectorAll('.overlay').length
    };
  });
  await page.screenshot({ path: path.join(outputDir, `1280x720-${route}.png`), fullPage: false });
  pages.push({ route, ...metrics });
}

const result = { pages, consoleErrors, pageErrors, failedRequests };
await fs.writeFile(path.join(outputDir, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
