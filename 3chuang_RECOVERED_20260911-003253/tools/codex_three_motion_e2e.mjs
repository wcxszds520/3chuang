import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/playwright/three-motion');
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1672, height: 941 } });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(`${baseUrl}/#/container`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.removeItem('yonggui.web.session.v1');
    localStorage.removeItem('yonggui.web.session.v2');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '生成真实方案', exact: true }).click();
  await page.getByText('后端真实方案', { exact: true }).first().waitFor({ timeout: 75_000 });
  await page.waitForTimeout(240);
  const target = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('yonggui.web.session.v2'));
    const queue = session.backendPlan.loadedCargo.map((item, sourceIndex) => ({ ...item, sourceIndex })).sort(operationOrder);
    return {
      planId: session.backendPlan.planId,
      total: queue.length,
      manualIndex: queue.findIndex((item) => item.handlingMethod === 'manual'),
      forkliftIndex: queue.findIndex((item) => item.handlingMethod === 'forklift'),
      firstTarget: { x: queue[0].x, y: queue[0].y, z: queue[0].z },
      firstCargoId: queue[0].cargoId
    };
    function operationOrder(left, right) {
      return Number(left.x) - Number(right.x) || Number(left.y) - Number(right.y) || Number(left.z) - Number(right.z) || Number(left.loadingIndex || left.sourceIndex) - Number(right.loadingIndex || right.sourceIndex);
    }
  });
  assert.equal(target.total, 221);
  assert.equal(target.manualIndex, 0);
  assert.ok(target.forkliftIndex > target.manualIndex);

  await page.goto(`${baseUrl}/#/twin`, { waitUntil: 'networkidle' });
  const canvas = page.locator('.twin-canvas');
  await canvas.waitFor();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.labelOverlapCount === '0');
  const scene = await canvas.evaluate((node) => ({ ...node.dataset }));
  assert.equal(scene.sceneMode, 'operation');
  assert.equal(scene.shellOpaque, 'false');
  assert.ok(Number(scene.roofOpacity) >= 0.15 && Number(scene.roofOpacity) <= 0.2);
  assert.ok(Number(scene.nearWallOpacity) >= 0.25 && Number(scene.nearWallOpacity) <= 0.35);
  assert.equal(scene.doorOpaque, 'true');
  assert.equal(scene.debugGridVisible, 'false');
  assert.equal(scene.doorCount, '2');
  assert.equal(scene.doorEnd, 'high-x');
  assert.ok(Number(scene.containerPartCount) > 30);
  assert.ok(Number(scene.forkliftPartCount) > 20);
  assert.ok(Number(scene.workerPartCount) > 15);
  assert.equal(scene.actorType, 'manual');
  assert.equal(scene.labelMode, 'simple');
  assert.equal(scene.labelOverlapCount, '0');
  assert.ok(Number(scene.labelVisibleCount) <= 3);
  assert.equal(await page.locator('.step-queue').getAttribute('data-order-valid'), 'true');
  assert.equal(await page.locator('.step-queue').getAttribute('data-queue-count'), '221');
  assert.ok(Number(await page.locator('.step-queue').getAttribute('data-group-count')) < 30);

  const beforeReview = await readState(canvas);
  await page.getByRole('button', { name: '剖切复核', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.sceneMode === 'review');
  assert.equal(await canvas.getAttribute('data-shell-opaque'), 'false');
  const inReview = await readState(canvas);
  assert.deepEqual({ index: inReview.index, cargoId: inReview.cargoId, placed: inReview.placed }, { index: beforeReview.index, cargoId: beforeReview.cargoId, placed: beforeReview.placed });
  await page.getByRole('button', { name: '作业模式', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.sceneMode === 'operation');

  await jumpTo(target.manualIndex);
  let state = await readState(canvas);
  assert.equal(state.actorType, 'manual');
  assert.equal(state.actorStage, 'move');
  assert.equal(state.cargoId, target.firstCargoId);
  assert.deepEqual(state.target, [Number(target.firstTarget.x), Number(target.firstTarget.y), Number(target.firstTarget.z)]);
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.phase === 'INSERT_FORKS');
  assert.equal(await canvas.getAttribute('data-actor-type'), 'manual');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.phase === 'LIFT_CARGO');
  assert.equal(await canvas.getAttribute('data-worker-carry-pose'), 'true');
  await page.screenshot({ path: path.join(outputDir, 'manual-lift.png'), fullPage: false });

  await jumpTo(target.forkliftIndex);
  state = await readState(canvas);
  assert.equal(state.actorType, 'forklift');
  assert.equal(state.actorStage, 'move');
  assert.equal(state.placed, target.forkliftIndex);
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.phase === 'INSERT_FORKS');
  await page.getByRole('button', { name: '4×', exact: true }).click();
  await page.evaluate(() => {
    window.__threeMotionSamples = [];
    window.__threeMotionSampling = true;
    const parsePoint = (value) => String(value || '').split(',').filter(Boolean).map(Number);
    const sample = () => {
      if (!window.__threeMotionSampling) return;
      const node = document.querySelector('.twin-canvas');
      if (node) window.__threeMotionSamples.push({
        phase: node.dataset.phase,
        actor: parsePoint(node.dataset.actorPosition),
        cargo: parsePoint(node.dataset.cargoPosition),
        forkExtension: Number(node.dataset.forkExtension)
      });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.locator('.operation-play').click();
  await page.waitForTimeout(650);
  const samples = await page.evaluate(() => {
    window.__threeMotionSampling = false;
    return window.__threeMotionSamples;
  });
  await page.locator('.operation-play').click();
  await page.waitForFunction(() => document.querySelector('.twin-canvas')?.dataset.phase === 'PAUSED');
  assert.ok(samples.length > 15);
  assert.ok(samples.some((sample) => sample.forkExtension > 0));
  assert.ok(maxAdjacent(samples.map((sample) => sample.actor)) < 1_000);
  const frozen = await readState(canvas);
  await page.waitForTimeout(260);
  const stillFrozen = await readState(canvas);
  assert.deepEqual({ actor: stillFrozen.actor, cargo: stillFrozen.cargo, placed: stillFrozen.placed }, { actor: frozen.actor, cargo: frozen.cargo, placed: frozen.placed });
  await page.screenshot({ path: path.join(outputDir, 'forklift-pickup-paused.png'), fullPage: false });

  for (const speed of ['0.5×', '1×', '4×', '8×', '16×']) assert.equal(await page.getByRole('button', { name: speed, exact: true }).count(), 1);
  assert.equal(await page.locator('.operation-filters').getAttribute('data-filter-dimensions'), '7');
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  const result = {
    assertions: {
      realBackendPlan221: true,
      industrialContainerAndDualActors: true,
      operationAndReviewModesPreserveState: true,
      simpleLabelsOverlapZero: true,
      groupedQueuePreservesMachineOrder: true,
      manualWorkerCarriesCargo: true,
      forkliftForksMoveContinuously: true,
      pauseCoordinatesStable: true,
      speedRange05To16: true,
      sevenFilterDimensions: true
    },
    plan: target,
    maxAdjacentActorMm: maxAdjacent(samples.map((sample) => sample.actor)),
    sampledPhases: [...new Set(samples.map((sample) => sample.phase))],
    consoleErrors,
    pageErrors
  };
  await fs.writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify({ failure: { message: error.message, stack: error.stack }, consoleErrors, pageErrors }, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}

async function jumpTo(index) {
  await page.locator('.jump-control input').fill(String(index + 1));
  await page.locator('.jump-control button').click();
  await page.waitForFunction((targetIndex) => Number(document.querySelector('.twin-canvas')?.dataset.currentIndex) === targetIndex, index);
  await page.waitForTimeout(45);
}

async function readState(canvas) {
  return canvas.evaluate((node) => {
    const parsePoint = (value) => String(value || '').split(',').filter(Boolean).map(Number);
    return {
      phase: node.dataset.phase,
      index: Number(node.dataset.currentIndex),
      cargoId: node.dataset.currentCargo,
      actorType: node.dataset.actorType,
      actorStage: node.dataset.actorStage,
      actor: parsePoint(node.dataset.actorPosition),
      cargo: parsePoint(node.dataset.cargoPosition),
      target: parsePoint(node.dataset.targetPosition),
      placed: Number(node.dataset.placedInstances),
      forkExtension: Number(node.dataset.forkExtension)
    };
  });
}

function maxAdjacent(points) {
  let maximum = 0;
  for (let index = 1; index < points.length; index += 1) maximum = Math.max(maximum, Math.hypot(...points[index].map((value, axis) => value - points[index - 1][axis])));
  return maximum;
}
