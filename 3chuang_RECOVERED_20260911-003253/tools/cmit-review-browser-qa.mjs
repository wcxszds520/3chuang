import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { stableSerialize } from '../web-dashboard/src/domain/plan/planRevision.js';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = process.cwd(), evidenceDir = path.join(root, 'artifacts/cmit-20260926'), shots = path.join(root, 'output/playwright/cmit-20260926');
await fs.mkdir(shots, { recursive: true });
const report = { startedAt: new Date().toISOString(), channel: 'Headed Chromium; fresh isolated browser storage; real local API', checks: [], errors: [], consoleErrors: [], screenshots: [] };
const browser = await chromium.launch({ headless: false }); report.browser = browser.version();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await context.newPage(); page.setDefaultTimeout(30000);
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
const check = (name, detail) => { report.checks.push({ name, detail, status: 'PASS' }); console.log('PASS', name); };
const visitReview = async () => { await page.goto('http://127.0.0.1:14173/review'); await page.getByRole('heading', { name: '先操作，再判断' }).waitFor(); };
const session = () => page.evaluate(async () => (await import('/src/app/session/sessionStorage.js')).loadSession());
const waitPlan = async () => { for (let i = 0; i < 120; i++) { const value = await session(); if (value.backendPlan) return value; if (value.planError) throw new Error(value.planError); await page.waitForTimeout(500); } throw new Error('No formal plan'); };
const screenshot = async name => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true }); report.screenshots.push(`${name}.png`); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); };
const download = async name => {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出当前验证快照', exact: true }).click();
  const result = await pending; const file = path.join(evidenceDir, `${name}.json`); await result.saveAs(file);
  const value = JSON.parse(await fs.readFile(file, 'utf8')); const { integrity, ...payload } = value;
  assert.equal(createHash('sha256').update(stableSerialize(payload)).digest('hex'), integrity.payloadSha256);
  await page.getByRole('button', { name: '导出当前验证快照', exact: true }).waitFor();
  return value;
};
try {
  await page.goto('http://127.0.0.1:14173/');
  await page.getByRole('button', { name: '作品导览与验证', exact: true }).click(); await page.waitForURL('**/review');
  await page.getByRole('heading', { name: '后端关键合同测试' }).waitFor();
  await fs.writeFile(path.join(evidenceDir, 'review-snapshot.txt'), await page.locator('body').innerText());
  await screenshot('review-desktop');
  const preview = await download('export-preview'); assert.equal(preview.state, 'PREVIEW'); assert.equal(preview.currentPlan, null);
  check('landing entry and preview export', { inputPieces: preview.inputs.cargo.reduce((sum, item) => sum + item.quantity, 0) });
  for (const anchor of await page.getByRole('link', { name: '下载记录' }).all()) {
    const href = await anchor.getAttribute('href'); const response = await context.request.get(`http://127.0.0.1:14173${href}`); assert.equal(response.status(), 200); assert.ok((await response.json()).provenance.sourceSha256);
  }
  check('four historical records readable with source digests', 4);
  await page.getByRole('button', { name: '进入规划', exact: true }).click();
  await page.getByRole('button', { name: '生成推荐方案', exact: true }).click(); const initial = await waitPlan();
  await page.waitForTimeout(500); await visitReview();
  const current = await download('export-current'); assert.equal(current.state, 'CURRENT'); assert.equal(current.currentPlan.planId, initial.backendPlan.planId); assert.equal(current.currentPlan.loadedCargo.length, 42); assert.ok(current.currentRevisionId);
  check('formal export bound to current plan and revision', { planId: current.currentPlan.planId, persistence: current.currentPlan.executionStatus.persistence });
  await page.getByRole('button', { name: '验证变更', exact: true }).click();
  await page.getByRole('button', { name: '演示变更：木箱宽度 +100 mm', exact: true }).click(); await page.getByTestId('plan-stale-notice').waitFor(); await page.waitForTimeout(500);
  await visitReview(); const stale = await download('export-stale'); assert.equal(stale.state, 'STALE'); assert.equal(stale.currentPlan, null); assert.equal(stale.stalePlanId, current.currentPlan.planId); assert.notEqual(stale.currentInputSha256, current.currentInputSha256); assert.equal(stale.comparison, null);
  await screenshot('review-stale'); check('real dimension edit invalidates exported current evidence', stale.stalePlanId);
  await page.getByRole('button', { name: '进入规划', exact: true }).click();
  await page.getByRole('button', { name: '保留可用货位，重新规划', exact: true }).click(); await waitPlan(); await page.waitForTimeout(500);
  await visitReview(); const replanned = await download('export-replanned'); assert.equal(replanned.state, 'CURRENT'); assert.notEqual(replanned.currentPlan.planId, current.currentPlan.planId); assert.equal(replanned.revisions.length, 2); assert.equal(replanned.comparison.previousPlanId, current.currentPlan.planId); assert.equal(replanned.currentPlan.loadedCargo.length, 42);
  await screenshot('review-replanned'); check('actual replan and parent diff survive reload', replanned.comparison.counts);
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => scrollTo(0, 0)); await screenshot('review-mobile'); check('390px responsive page without horizontal overflow', true);
  await page.route('**/api/capabilities', route => route.abort('connectionfailed'));
  const offline = await download('export-capability-unavailable'); assert.equal(offline.runtime.service, 'UNAVAILABLE'); assert.equal(offline.runtime.database, 'UNKNOWN'); assert.equal(offline.runtime.aiCallVerified, false);
  check('unavailable capability probe does not prevent snapshot or fabricate connectivity', 'Synthetic request failure, real current session retained');
  await page.unroute('**/api/capabilities');
  assert.equal(report.errors.length, 0);
  report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack; console.error(error); process.exitCode = 1; }
finally { report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(evidenceDir, 'browser-qa.json'), JSON.stringify(report, null, 2)); await browser.close(); }
