import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs', 'advanced_open_design_web', 'screenshots');
const baseUrl = process.env.YG_WEB_URL || 'http://127.0.0.1:4174/';
const viewport = { width: 1672, height: 941 };

const pages = [
  ['dashboard', 'dashboard-after.png'],
  ['cargo', 'cargo-after.png'],
  ['container', 'container-after.png'],
  ['twin', 'twin-after.png'],
  ['compliance', 'compliance-after.png'],
  ['report', 'report-after.png']
];

async function waitForApp(page) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(900);
}

async function captureThreeViews(page) {
  await page.goto(`${baseUrl}#twin`, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(1200);

  const viewMap = [
    ['总览', '3d-overview.png'],
    ['门端', '3d-door.png'],
    ['俯视', '3d-top.png'],
    ['侧视', '3d-side.png']
  ];

  for (const [label, file] of viewMap) {
    await page.getByRole('button', { name: label }).first().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  }

  await page.getByRole('button', { name: '总览' }).first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, '3d-forklift-path.png'), fullPage: false });
  await page.screenshot({ path: path.join(outDir, '3d-worker-path.png'), fullPage: false });
  await page.screenshot({ path: path.join(outDir, '3d-target-highlight.png'), fullPage: false });

  await page.getByRole('button', { name: '查看算法依据' }).first().click();
  await page.waitForSelector('.regulation-modal', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '3d-algorithm-reason.png'), fullPage: false });
  await page.keyboard.press('Escape').catch(() => undefined);
}

async function imageHtml(title, items) {
  const cards = (await Promise.all(items.map(async ([label, file]) => {
    const image = await fs.readFile(path.join(outDir, file));
    const src = `data:image/png;base64,${image.toString('base64')}`;
    return `<figure><img src="${src}" alt="${label}"><figcaption>${label}</figcaption></figure>`;
  }))).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
      background: #f5f8fc;
      color: #0b1220;
    }
    h1 { margin: 0 0 18px; font-size: 26px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
    figure {
      margin: 0;
      padding: 10px;
      border: 1px solid #dde6f2;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 4px 14px rgba(18, 35, 64, 0.06);
    }
    img {
      width: 100%;
      aspect-ratio: 1672 / 941;
      object-fit: cover;
      object-position: top left;
      border: 1px solid #e8eef6;
      border-radius: 8px;
      display: block;
    }
    figcaption { margin-top: 8px; font-size: 13px; font-weight: 700; color: #172033; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <section class="grid">${cards}</section>
</body>
</html>`;
}

async function captureContactSheet(browser, title, items, outputFile) {
  const page = await browser.newPage({ viewport: { width: 1672, height: 1180 }, deviceScaleFactor: 1 });
  await page.setContent(await imageHtml(title, items), { waitUntil: 'load' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.screenshot({ path: path.join(outDir, outputFile), fullPage: true });
  await page.close();
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });

  for (const [hash, file] of pages) {
    await page.goto(`${baseUrl}#${hash}`, { waitUntil: 'networkidle' });
    await waitForApp(page);
    await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  }

  await captureThreeViews(page);
  await page.close();

  const beforeItems = pages.map(([hash]) => [hash, `${hash}-before.png`]);
  const afterItems = pages.map(([hash]) => [hash, `${hash}-after.png`]);
  const compareItems = pages.flatMap(([hash]) => [
    [`${hash} before`, `${hash}-before.png`],
    [`${hash} after`, `${hash}-after.png`]
  ]);

  await captureContactSheet(browser, 'Yonggui Web Before Screens', beforeItems, 'before-contact-sheet.png');
  await captureContactSheet(browser, 'Yonggui Web After Screens', afterItems, 'after-contact-sheet.png');
  await captureContactSheet(browser, 'Yonggui Web Before / After', compareItems, 'before-after-contact-sheet.png');

  await browser.close();

  const result = {
    baseUrl,
    viewport,
    pages: pages.map(([hash, file]) => ({ hash, file: path.join('docs/advanced_open_design_web/screenshots', file) })),
    three: [
      '3d-overview.png',
      '3d-door.png',
      '3d-top.png',
      '3d-side.png',
      '3d-forklift-path.png',
      '3d-worker-path.png',
      '3d-target-highlight.png',
      '3d-algorithm-reason.png'
    ].map((file) => path.join('docs/advanced_open_design_web/screenshots', file)),
    contactSheets: [
      'before-contact-sheet.png',
      'after-contact-sheet.png',
      'before-after-contact-sheet.png'
    ].map((file) => path.join('docs/advanced_open_design_web/screenshots', file))
  };

  await fs.writeFile(
    path.join(root, 'docs', 'advanced_open_design_web', 'visual-qa-results.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8'
  );
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
