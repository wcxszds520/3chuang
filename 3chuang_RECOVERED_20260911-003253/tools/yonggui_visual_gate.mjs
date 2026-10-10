import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(process.cwd());
const BASE_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.join(ROOT, 'docs', 'design_reviews', 'product-redesign');
const SCREEN_DIR = path.join(OUT_DIR, 'screenshots');

const PAGE_SPECS = {
  dashboard: { title: '港前装柜智能工作台', wait: 1200 },
  cargo: { title: '货物录入与 SKU 管理', wait: 1200 },
  container: { title: '柜型推荐与装柜决策', wait: 1200 },
  twin: { title: '3D 作业孪生与装柜过程', wait: 2600 },
  compliance: { title: '合规预审与法规溯源', wait: 1800 },
  report: { title: '报告导出与成果中心', wait: 1200 }
};

async function runCameraUnitGate() {
  const cameraModulePath = path.join(ROOT, 'web-dashboard', 'src', 'three', 'sceneCamera.js');
  try {
    const { getCameraPreset } = await import(pathToFileURL(cameraModulePath).href);
    const containerInfo = { innerLength: 12032, innerWidth: 2352, innerHeight: 2698 };
    const viewports = [{ width: 1000, height: 620 }, { width: 760, height: 620 }, { width: 640, height: 480 }];
    const presets = ['总览', '门端', '俯视', '侧视'];
    const results = [];
    for (const viewport of viewports) {
      for (const preset of presets) {
        const value = getCameraPreset(containerInfo, viewport, preset);
        const finite = [...value.position, ...value.target, ...(value.up || []), value.near, value.far].every(Number.isFinite);
        const distance = Math.hypot(
          value.position[0] - value.target[0],
          value.position[1] - value.target[1],
          value.position[2] - value.target[2]
        );
        results.push({ viewport, preset, finite, distance, value });
      }
    }
    const diagonal = Math.hypot(12.032, 2.352, 2.698);
    const commonTarget = results.every((item) => item.value.target.every((part, index) => Math.abs(part - results[0].value.target[index]) < 0.001));
    const passed = results.every((item) => (
      item.finite
      && Array.isArray(item.value.up)
      && item.value.up.length === 3
      && (item.preset !== '俯视' || Math.abs(item.value.up[2]) === 1)
      && item.distance > diagonal * 0.5
      && (item.preset !== '门端' || item.distance > diagonal * 0.85)
      && item.value.near > 0
      && item.value.far > item.value.near
    )) && commonTarget;
    console.log(`${passed ? 'PASS' : 'FAIL'} camera unit gate`);
    if (!passed) {
      console.log(JSON.stringify({ diagonal, commonTarget, results }, null, 2));
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(`FAIL camera unit gate: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv.includes('--unit=camera')) {
  await runCameraUnitGate();
  process.exit(process.exitCode || 0);
}

function selectedPages() {
  const arg = process.argv.find((item) => item.startsWith('--page='));
  if (!arg) return Object.keys(PAGE_SPECS);
  return arg
    .slice('--page='.length)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => PAGE_SPECS[item]);
}

function addCheck(record, name, passed, details = '') {
  record.checks.push({ name, passed, details });
  if (!passed) record.passed = false;
}

async function auditPage(page, pageId, viewport) {
  const spec = PAGE_SPECS[pageId];
  const record = {
    page: pageId,
    viewport: `${viewport.width}x${viewport.height}`,
    passed: true,
    checks: []
  };

  await page.goto(`${BASE_URL}#${pageId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(spec.wait);

  const state = await page.evaluate(async ({ expectedTitle, currentPage }) => {
    const text = document.body?.innerText || '';
    const heading = Array.from(document.querySelectorAll('h1,h2')).find((node) => node.textContent?.trim() === expectedTitle);
    const canvas = document.querySelector('canvas');
    const twinLayout = document.querySelector('.twin-layout.redesigned');
    const tableHeaders = Array.from(document.querySelectorAll('.data-head')).map((node) => node.textContent || '');
    const primaryButtons = Array.from(document.querySelectorAll('button')).filter((node) => {
      const styles = getComputedStyle(node);
      return styles.display !== 'none' && styles.visibility !== 'hidden' && node.getBoundingClientRect().width > 0;
    });
    const canvasPixels = canvas ? await new Promise((resolve) => {
      requestAnimationFrame(() => {
        try {
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          if (!gl) {
            resolve(null);
            return;
          }
          const samples = [];
          const pixel = new Uint8Array(4);
          for (let gy = 1; gy <= 8; gy += 1) {
            for (let gx = 1; gx <= 12; gx += 1) {
              const x = Math.min(canvas.width - 1, Math.floor((canvas.width * gx) / 13));
              const y = Math.min(canvas.height - 1, Math.floor((canvas.height * gy) / 9));
              gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
              samples.push(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
            }
          }
          const unique = new Set(samples);
          const colored = samples.filter((value) => value !== '0,0,0,0').length;
          resolve({ sampleCount: samples.length, uniqueColors: unique.size, coloredSamples: colored });
        } catch (error) {
          resolve({ error: String(error) });
        }
      });
    }) : null;

    return {
      titleVisible: Boolean(heading),
      text,
      canvas: canvas ? {
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight
      } : null,
      canvasPixels,
      twinColumns: twinLayout ? getComputedStyle(twinLayout).gridTemplateColumns : null,
      tableHeaders,
      skuTable: (() => {
        const table = document.querySelector('.sku-panel .data-table');
        if (!table) return null;
        return {
          overflowX: getComputedStyle(table).overflowX,
          clientWidth: table.clientWidth,
          scrollWidth: table.scrollWidth
        };
      })(),
      containerPreviewCanvas: Boolean(document.querySelector('.container-page .real-twin-preview canvas')),
      reportPreviewCanvas: Boolean(document.querySelector('.report-page .report-plan-snapshot canvas')),
      shellStyles: (() => {
        const sidebar = document.querySelector('.yg-sidebar');
        const workspace = document.querySelector('.yg-workspace');
        return {
          sidebarBackgroundImage: sidebar ? getComputedStyle(sidebar).backgroundImage : null,
          workspaceBackgroundImage: workspace ? getComputedStyle(workspace).backgroundImage : null
        };
      })(),
      visiblePrimaryButtonCount: primaryButtons.length,
      currentPage
    };
  }, { expectedTitle: spec.title, currentPage: pageId });

  addCheck(record, '主标题可见', state.titleVisible, spec.title);
  addCheck(record, '存在可操作控件', state.visiblePrimaryButtonCount > 0, `buttons=${state.visiblePrimaryButtonCount}`);
  addCheck(
    record,
    '壳层不使用装饰渐变或全局网格',
    Boolean(state.shellStyles && state.shellStyles.sidebarBackgroundImage === 'none' && state.shellStyles.workspaceBackgroundImage === 'none'),
    state.shellStyles ? JSON.stringify(state.shellStyles) : 'missing'
  );

  if (pageId === 'dashboard') {
    addCheck(record, '任务型首页标题', state.text.includes('港前装柜智能工作台'));
    addCheck(record, '四步业务流程', ['录货完成', '方案已生成', '合规', '可导出执行'].every((label) => state.text.includes(label)));
    addCheck(record, '当前方案与风险入口', state.text.includes('当前方案预览') && state.text.includes('风险摘要'));
    addCheck(record, '不暴露内部表名', !state.text.includes('packing_plan 表'));
    addCheck(record, '不展示系统运维标语', !state.text.includes('SYSTEM LIVE'));
  }

  if (pageId === 'cargo') {
    addCheck(record, '显示数据完整度', state.text.includes('数据完整度'));
    const staleRatio = [String(660 + 1), '/', String(800 + 64)].join('');
    const staleSkuSummary = ['142 SKU / ', String(800 + 64)].join('');
    addCheck(record, '不显示过期演示指标', !state.text.includes(staleRatio) && !state.text.includes(staleSkuSummary));
    addCheck(record, 'SKU 状态与操作列存在', state.text.includes('状态') && state.text.includes('操作'));
    addCheck(
      record,
      'SKU 表格可横向查看',
      Boolean(state.skuTable && ['auto', 'scroll'].includes(state.skuTable.overflowX)),
      state.skuTable ? JSON.stringify(state.skuTable) : 'missing'
    );
    addCheck(
      record,
      '桌面端状态与操作列一屏可见',
      Boolean(state.skuTable && state.skuTable.scrollWidth <= state.skuTable.clientWidth + 2),
      state.skuTable ? JSON.stringify(state.skuTable) : 'missing'
    );
  }

  if (pageId === 'container') {
    addCheck(record, '使用真实 3D 装柜预估', state.containerPreviewCanvas);
  }

  if (pageId === 'compliance') {
    addCheck(record, '规则 AI 人工三层清晰', ['确定性规则', 'AI 解释', '人工复核'].every((label) => state.text.includes(label)));
  }

  if (pageId === 'report') {
    addCheck(record, '报告预览包含真实方案缩略', state.reportPreviewCanvas);
    addCheck(record, '仅显示真实导出格式', ['HTML', 'CSV', 'JSON'].every((label) => state.text.includes(label)));
  }

  if (pageId === 'twin') {
    addCheck(record, 'Three canvas 存在', Boolean(state.canvas));
    addCheck(
      record,
      'Three canvas 非空尺寸',
      Boolean(state.canvas && state.canvas.width > 300 && state.canvas.height > 300),
      state.canvas ? JSON.stringify(state.canvas) : 'missing'
    );
    addCheck(
      record,
      'Three canvas 像素非空且具有场景层次',
      Boolean(state.canvasPixels && state.canvasPixels.coloredSamples > 40 && state.canvasPixels.uniqueColors > 6),
      state.canvasPixels ? JSON.stringify(state.canvasPixels) : 'missing'
    );
    if (viewport.width >= 1440) {
      const columns = String(state.twinColumns || '').trim().split(/\s+/).filter(Boolean);
      addCheck(record, '桌面端 3D 双栏', columns.length >= 2, state.twinColumns || 'missing');
    }
  }

  const filename = `${viewport.width}-${pageId}.png`;
  const screenshotPath = path.join(SCREEN_DIR, filename);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  record.screenshot = path.relative(ROOT, screenshotPath).replaceAll('\\', '/');

  if (pageId === 'twin') {
    record.viewScreenshots = {};
    let viewSwitchPassed = true;
    for (const view of ['门端', '俯视', '侧视', '总览']) {
      const button = page.getByRole('button', { name: view, exact: true });
      if (await button.count() !== 1) {
        viewSwitchPassed = false;
        continue;
      }
      await button.click();
      await page.waitForTimeout(320);
      const viewPath = path.join(SCREEN_DIR, `${viewport.width}-twin-${view}.png`);
      await page.screenshot({ path: viewPath, fullPage: true });
      if (fs.statSync(viewPath).size < 20000) viewSwitchPassed = false;
      record.viewScreenshots[view] = path.relative(ROOT, viewPath).replaceAll('\\', '/');
    }
    addCheck(record, '四个 3D 视角可切换并成像', viewSwitchPassed, JSON.stringify(record.viewScreenshots));

    const playButton = page.getByRole('button', { name: '播放', exact: true });
    const playCount = await playButton.count();
    let playbackPassed = playCount === 1;
    if (playbackPassed) {
      await playButton.click();
      await page.waitForTimeout(260);
      playbackPassed = await page.getByRole('button', { name: '暂停', exact: true }).count() === 1;
    }
    addCheck(record, '3D 播放状态可切换', playbackPassed, `playButtonCount=${playCount}`);
  }
  return record;
}

fs.mkdirSync(SCREEN_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

for (const viewport of [{ width: 1672, height: 941 }, { width: 1280, height: 720 }]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'light' });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  for (const pageId of selectedPages()) {
    results.push(await auditPage(page, pageId, viewport));
  }
  await context.close();
}

await browser.close();

const output = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  passed: results.every((item) => item.passed),
  results
};

fs.writeFileSync(path.join(OUT_DIR, 'visual-gate-results.json'), JSON.stringify(output, null, 2), 'utf-8');

for (const record of results) {
  const failures = record.checks.filter((check) => !check.passed);
  console.log(`${record.passed ? 'PASS' : 'FAIL'} ${record.viewport} ${record.page}`);
  failures.forEach((failure) => console.log(`  - ${failure.name}${failure.details ? `: ${failure.details}` : ''}`));
}

if (!output.passed) process.exitCode = 1;
