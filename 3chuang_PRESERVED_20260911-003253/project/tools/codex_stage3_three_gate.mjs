import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { OperationMachine } from '../web-dashboard/src/three/operation/operationMachine.js';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/playwright/stage3/three');
const screenshotNames = [
  '01-overview.png',
  '02-door.png',
  '03-side.png',
  '04-top.png',
  '05-forklift-pickup.png',
  '06-forklift-entering.png',
  '07-forklift-placed.png',
  '08-manual-pickup.png',
  '09-manual-carrying.png',
  '10-manual-entering.png',
  '11-manual-placed.png',
  '12-filter-by-port.png',
  '13-filter-by-actor.png',
  '14-filter-by-batch.png',
  '15-speed-16x.png',
  '16-group-expanded.png',
  '17-blocked.png'
];

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1672, height: 941 } });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const responseErrors = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', (response) => response.status() >= 400 && responseErrors.push(`${response.status()} ${response.url()}`));

const gate = {
  assertions: {},
  plan: {},
  actorEvidence: {},
  queueEvidence: {},
  screenshotNames,
  consoleErrors,
  pageErrors,
  responseErrors
};

try {
  await loadOfficialBackendPlan(page);
  const canvas = page.locator('.twin-canvas');
  await canvas.waitFor();
  await page.waitForFunction(() => Number(document.querySelector('.twin-canvas')?.dataset.totalCount) === 221);
  const session = await getSession(page);
  const originalSession = structuredClone(session);
  const planFingerprint = fingerprintPlan(session.backendPlan);
  const manualIndex = session.backendPlan.loadedCargo
    .map((item, sourceIndex) => ({ ...item, sourceIndex }))
    .sort(operationOrder)
    .findIndex((item) => item.handlingMethod === 'manual');
  const forkliftIndex = session.backendPlan.loadedCargo
    .map((item, sourceIndex) => ({ ...item, sourceIndex }))
    .sort(operationOrder)
    .findIndex((item) => item.handlingMethod === 'forklift');
  assert.equal(manualIndex, 0);
  assert.ok(forkliftIndex >= 0);
  gate.plan = {
    planId: session.backendPlan.planId,
    planFingerprint,
    total: session.backendPlan.loadedCargo.length,
    manualIndex,
    forkliftIndex
  };

  const sceneContract = await canvas.evaluate((node) => ({ ...node.dataset }));
  assert.ok(Number(sceneContract.workerPartCount) > 15);
  assert.ok(Number(sceneContract.forkliftPartCount) > 20);
  assert.equal(sceneContract.doorCount, '2');
  assert.equal(sceneContract.doorEnd, 'high-x');
  gate.assertions.recognizableManualAndForkliftModels = true;

  const manualTrace = await captureBrowserMotionTrace(page, manualIndex, 'manual', 8);
  const forkliftTrace = await captureBrowserMotionTrace(page, forkliftIndex, 'forklift', 8);
  await writeJson('manual-motion-trace.json', manualTrace);
  await writeJson('forklift-motion-trace.json', forkliftTrace);
  validateMotionTrace(manualTrace, 'manual');
  validateMotionTrace(forkliftTrace, 'forklift');
  gate.actorEvidence = {
    manual: summarizeMotion(manualTrace),
    forklift: summarizeMotion(forkliftTrace)
  };
  gate.assertions.completeManualFlow = true;
  gate.assertions.completeForkliftFlow = true;
  gate.assertions.browserMotionIsContinuous = true;

  const pauseEvidence = await verifyPauseAndReset(page, manualIndex);
  assert.equal(pauseEvidence.pauseStable, true);
  assert.equal(pauseEvidence.resetCorrect, true);
  gate.assertions.pauseResumeAndReset = true;

  const sortedQueue = session.backendPlan.loadedCargo
    .map((item, sourceIndex) => ({ ...item, sourceIndex }))
    .sort(operationOrder);
  const speedGate = buildSpeedGate(session.backendPlan.containerInfo, sortedQueue[forkliftIndex]);
  for (const speed of [0.5, 1, 4, 8, 16]) {
    assert.equal(await page.getByRole('button', { name: `${speed}×`, exact: true }).count(), 1);
    const entry = speedGate.speeds[String(speed)];
    assert.equal(entry.selectable, true);
    assert.equal(entry.teleportDetected, false);
    assert.equal(entry.pauseStable, true);
    for (const phase of ['INSERT_FORKS', 'ALIGN_WITH_DOOR', 'ENTER_CONTAINER', 'MOVE_INSIDE', 'LOWER_CARGO', 'RETURN_FOR_NEXT']) {
      assert.ok(entry.states.includes(phase), `${speed}× 未经历 ${phase}`);
    }
  }
  await writeJson('speed-gate.json', speedGate);
  gate.assertions.speedRangeAndSemanticStates = true;

  const labelGate = await verifyLabelsAndCaptureViews(page, manualIndex, forkliftIndex);
  await writeJson('label-layout-gate.json', labelGate);
  gate.assertions.simpleLabelsDefaultAndOverlapFree = true;

  await captureActorScreenshots(page, manualIndex, forkliftIndex);
  const filterGate = await verifyFiltersAndCapture(page, planFingerprint);
  await writeJson('filter-gate.json', filterGate);
  gate.assertions.sevenFiltersPreserveMachineAndPlan = true;

  await captureSpeedAndGroupScreenshots(page, forkliftIndex);
  const blockedEvidence = await captureBlockedScreenshot(page, originalSession);
  assert.equal(blockedEvidence.phase, 'BLOCKED');
  assert.ok(blockedEvidence.reason.length > 0);
  gate.assertions.blockedStateIsVisible = true;

  const manifest = [];
  for (const name of screenshotNames) {
    const filePath = path.join(outputDir, name);
    const stats = await fs.stat(filePath);
    assert.ok(stats.size > 40_000, `${name} 截图文件过小`);
    manifest.push({ name, bytes: stats.size, path: filePath });
  }
  await writeJson('screenshot-manifest.json', { screenshots: manifest, inspected: false });
  gate.assertions.allSeventeenScreenshotsExist = true;
  gate.queueEvidence = await readQueueEvidence(page).catch(() => ({ restoredAfterBlockedMutation: false }));
  gate.pauseEvidence = pauseEvidence;
  gate.labelEvidence = labelGate.summary;
  gate.filterEvidence = filterGate.summary;
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(responseErrors, []);
  await writeJson('three-gate.json', gate);
  console.log(JSON.stringify(gate, null, 2));
} catch (error) {
  gate.failure = { message: error.message, stack: error.stack };
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
  await writeJson('three-gate.json', gate);
  throw error;
} finally {
  await browser.close();
}

async function loadOfficialBackendPlan(targetPage) {
  await targetPage.goto(`${baseUrl}/#/cargo`, { waitUntil: 'networkidle' });
  await targetPage.evaluate(() => {
    localStorage.removeItem('yonggui.web.session.v1');
    localStorage.removeItem('yonggui.web.session.v2');
  });
  await targetPage.reload({ waitUntil: 'networkidle' });
  await targetPage.goto(`${baseUrl}/#/container`, { waitUntil: 'networkidle' });
  await targetPage.getByRole('button', { name: '生成真实方案', exact: true }).click();
  await targetPage.getByText('后端真实方案', { exact: true }).first().waitFor({ timeout: 75_000 });
  await targetPage.goto(`${baseUrl}/#/twin`, { waitUntil: 'networkidle' });
  await targetPage.getByText('后端真实方案', { exact: true }).first().waitFor();
}

async function captureBrowserMotionTrace(targetPage, index, actorType, speed) {
  await jumpTo(targetPage, index);
  await targetPage.getByRole('button', { name: `${speed}×`, exact: true }).click();
  await targetPage.evaluate(() => {
    window.__stage3MotionTrace = [];
    window.__stage3MotionTraceActive = true;
    window.__stage3MotionTraceStart = performance.now();
    const parsePoint = (value) => String(value || '').split(',').map(Number);
    const sample = (time) => {
      if (!window.__stage3MotionTraceActive) return;
      const node = document.querySelector('.twin-canvas');
      if (node) window.__stage3MotionTrace.push({
        timeMs: Number((time - window.__stage3MotionTraceStart).toFixed(2)),
        state: node.dataset.phase,
        actorType: node.dataset.actorType,
        actorStage: node.dataset.actorStage,
        currentIndex: Number(node.dataset.currentIndex),
        actorPosition: parsePoint(node.dataset.actorPosition),
        cargoPosition: parsePoint(node.dataset.cargoPosition),
        targetPosition: parsePoint(node.dataset.targetPosition),
        carrying: node.dataset.isCarrying === 'true',
        enteredDoor: node.dataset.enteredDoor === 'true',
        released: node.dataset.released === 'true'
      });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await targetPage.locator('.operation-play').click();
  await targetPage.waitForFunction((startIndex) => Number(document.querySelector('.twin-canvas')?.dataset.currentIndex) > startIndex, index, { timeout: 60_000 });
  const playButton = targetPage.locator('.operation-play');
  if ((await playButton.innerText()).includes('暂停')) await playButton.click();
  const samples = await targetPage.evaluate((startIndex) => {
    window.__stage3MotionTraceActive = false;
    return (window.__stage3MotionTrace || []).filter((sample) => sample.currentIndex === startIndex);
  }, index);
  assert.ok(samples.length > 20, `${actorType} 浏览器轨迹样本不足`);
  return {
    actorType,
    speed,
    source: 'browser-requestAnimationFrame',
    sampleInterval: 'one rendered animation frame',
    samples
  };
}

function validateMotionTrace(trace, actorType) {
  assert.ok(trace.samples.every((sample) => sample.actorType === actorType));
  const states = unique(trace.samples.map((sample) => sample.state));
  for (const phase of ['MOVE_TO_CARGO', 'INSERT_FORKS', 'LIFT_CARGO', 'MOVE_TO_STAGING', 'ALIGN_WITH_DOOR', 'ENTER_CONTAINER', 'MOVE_INSIDE', 'LOWER_CARGO', 'RELEASE_CARGO', 'REVERSE_OUT', 'RETURN_FOR_NEXT']) {
    assert.ok(states.includes(phase), `${actorType} 轨迹缺少 ${phase}`);
  }
  assert.ok(trace.samples.some((sample) => sample.carrying));
  assert.ok(trace.samples.some((sample) => sample.enteredDoor));
  assert.ok(trace.samples.some((sample) => sample.released));
  const maxActor = maxAdjacentDistance(trace.samples, 'actorPosition');
  const maxCargo = maxAdjacentDistance(trace.samples, 'cargoPosition');
  assert.ok(maxActor < 1_600, `${actorType} actor 相邻帧位移 ${maxActor}mm`);
  assert.ok(maxCargo < 1_600, `${actorType} cargo 相邻帧位移 ${maxCargo}mm`);
}

function summarizeMotion(trace) {
  return {
    actorType: trace.actorType,
    speed: trace.speed,
    samples: trace.samples.length,
    states: unique(trace.samples.map((sample) => sample.state)),
    actorStages: unique(trace.samples.map((sample) => sample.actorStage)),
    maxAdjacentActorMm: round(maxAdjacentDistance(trace.samples, 'actorPosition')),
    maxAdjacentCargoMm: round(maxAdjacentDistance(trace.samples, 'cargoPosition')),
    carried: trace.samples.some((sample) => sample.carrying),
    enteredDoor: trace.samples.some((sample) => sample.enteredDoor),
    released: trace.samples.some((sample) => sample.released)
  };
}

async function verifyPauseAndReset(targetPage, index) {
  await jumpTo(targetPage, index);
  await targetPage.getByRole('button', { name: '1×', exact: true }).click();
  await targetPage.locator('.operation-play').click();
  await targetPage.waitForTimeout(450);
  await targetPage.locator('.operation-play').click();
  const first = await readMotionDataset(targetPage);
  await targetPage.waitForTimeout(350);
  const second = await readMotionDataset(targetPage);
  const pauseStable = first.phase === 'PAUSED'
    && first.actorPosition === second.actorPosition
    && first.cargoPosition === second.cargoPosition;
  await targetPage.getByRole('button', { name: '重置作业', exact: true }).click();
  await targetPage.waitForTimeout(80);
  const reset = await readMotionDataset(targetPage);
  return {
    pauseStable,
    pausedActorPosition: first.actorPosition,
    pausedCargoPosition: first.cargoPosition,
    resetCorrect: reset.phase === 'IDLE' && Number(reset.doorProgress) === 0 && Number(reset.currentIndex) === 0,
    reset
  };
}

function buildSpeedGate(containerInfo, cargo) {
  const speeds = {};
  for (const speed of [0.5, 1, 4, 8, 16]) {
    const machine = new OperationMachine({ containerInfo, loadedCargo: [cargo] });
    machine.setSpeed(speed);
    machine.play();
    let elapsed = 0;
    let guard = 0;
    let previous = activeActorPoint(machine.getSnapshot());
    let maxAdjacent = 0;
    const states = [];
    while (machine.getSnapshot().phase !== 'COMPLETED' && guard < 30_000) {
      const snapshot = machine.tick(1 / 60);
      elapsed += 1 / 60;
      guard += 1;
      states.push(snapshot.phase);
      const point = activeActorPoint(snapshot);
      maxAdjacent = Math.max(maxAdjacent, pointDistance(previous, point));
      previous = point;
    }
    assert.ok(guard < 30_000, `${speed}× 未完成`);
    const pauseMachine = new OperationMachine({ containerInfo, loadedCargo: [cargo] });
    pauseMachine.setSpeed(speed);
    pauseMachine.play();
    for (let index = 0; index < 24; index += 1) pauseMachine.tick(1 / 60);
    const paused = pauseMachine.pause();
    const frozen = JSON.stringify({ actor: activeActorPoint(paused), cargo: paused.cargoPose?.position });
    pauseMachine.tick(10);
    const pauseStable = frozen === JSON.stringify({ actor: activeActorPoint(pauseMachine.getSnapshot()), cargo: pauseMachine.getSnapshot().cargoPose?.position });
    speeds[String(speed)] = {
      selectable: true,
      completionSeconds: round(elapsed),
      states: unique(states),
      maxAdjacentActorMm: round(maxAdjacent),
      teleportDetected: maxAdjacent >= 1_600,
      pauseStable
    };
  }
  return { sampleDeltaSeconds: 1 / 60, teleportThresholdMm: 1_600, speeds };
}

async function verifyLabelsAndCaptureViews(targetPage, manualIndex, forkliftIndex) {
  await resetFilters(targetPage);
  await jumpTo(targetPage, manualIndex);
  assert.ok(await targetPage.locator('[data-label-mode="simple"].active').count());
  const states = [];
  for (const [button, name, file] of [
    ['总览', 'overview', '01-overview.png'],
    ['门端', 'door', '02-door.png'],
    ['侧视', 'side', '03-side.png'],
    ['俯视', 'top', '04-top.png']
  ]) {
    await targetPage.getByRole('button', { name: button, exact: true }).click();
    await targetPage.waitForTimeout(140);
    states.push(await measureLabelLayout(targetPage, name));
    await targetPage.screenshot({ path: path.join(outputDir, file), fullPage: true });
  }
  await targetPage.getByRole('button', { name: '总览', exact: true }).click();
  await advanceToPhase(targetPage, manualIndex, 'INSERT_FORKS');
  states.push(await measureLabelLayout(targetPage, 'manual-pickup'));
  await advanceToPhase(targetPage, forkliftIndex, 'INSERT_FORKS');
  states.push(await measureLabelLayout(targetPage, 'forklift-pickup'));
  await advanceToPhase(targetPage, manualIndex, 'ENTER_CONTAINER');
  states.push(await measureLabelLayout(targetPage, 'entering'));
  await advanceToPhase(targetPage, manualIndex, 'RELEASE_CARGO');
  states.push(await measureLabelLayout(targetPage, 'placed'));
  for (const state of states) {
    assert.equal(state.mode, 'simple');
    assert.ok(state.visibleCount <= 3);
    assert.equal(state.datasetOverlapCount, 0);
    assert.equal(state.actualOverlapCount, 0);
    assert.equal(state.outOfBoundsCount, 0);
    assert.equal(state.exposesInternalCoordinate, false);
  }
  await targetPage.locator('[data-label-mode="detail"]').click();
  await targetPage.waitForTimeout(100);
  const detail = await measureLabelLayout(targetPage, 'detail');
  assert.equal(detail.mode, 'detail');
  assert.ok(detail.visibleCount <= 4);
  await targetPage.locator('[data-label-mode="debug"]').click();
  await targetPage.waitForTimeout(100);
  const debug = await measureLabelLayout(targetPage, 'debug');
  assert.equal(debug.mode, 'debug');
  assert.equal(debug.hasDebugCoordinates, true);
  await targetPage.locator('[data-label-mode="simple"]').click();
  return {
    states,
    detail,
    debug,
    summary: {
      checkedStates: states.length,
      maxSimpleLabels: Math.max(...states.map((state) => state.visibleCount)),
      maxOverlap: Math.max(...states.map((state) => state.actualOverlapCount)),
      modesAvailable: ['simple', 'detail', 'debug']
    }
  };
}

async function measureLabelLayout(targetPage, name) {
  return targetPage.evaluate((stateName) => {
    const canvas = document.querySelector('.twin-canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const labels = [...document.querySelectorAll('.scene-label')].map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, text: node.innerText };
    });
    let actualOverlapCount = 0;
    for (let left = 0; left < labels.length; left += 1) for (let right = left + 1; right < labels.length; right += 1) {
      const a = labels[left]; const b = labels[right];
      if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) actualOverlapCount += 1;
    }
    const outOfBoundsCount = labels.filter((label) => label.x < canvasRect.x - 1 || label.y < canvasRect.y - 1 || label.x + label.width > canvasRect.right + 1 || label.y + label.height > canvasRect.bottom + 1).length;
    const combinedText = labels.map((label) => label.text).join(' ');
    return {
      name: stateName,
      mode: canvas.dataset.labelMode,
      visibleCount: labels.length,
      datasetOverlapCount: Number(canvas.dataset.labelOverlapCount),
      actualOverlapCount,
      outOfBoundsCount,
      exposesInternalCoordinate: /high[- ]?x|loadedCargo|computePose|world coordinate/i.test(combinedText),
      hasDebugCoordinates: /manual|forklift/.test(combinedText) && /\d+\.\d{2},\d+\.\d{2},\d+\.\d{2}/.test(combinedText),
      labels
    };
  }, name);
}

async function captureActorScreenshots(targetPage, manualIndex, forkliftIndex) {
  await resetFilters(targetPage);
  await targetPage.getByRole('button', { name: '总览', exact: true }).click();
  for (const [index, actor, phase, file] of [
    [forkliftIndex, 'forklift', 'INSERT_FORKS', '05-forklift-pickup.png'],
    [forkliftIndex, 'forklift', 'ENTER_CONTAINER', '06-forklift-entering.png'],
    [forkliftIndex, 'forklift', 'RELEASE_CARGO', '07-forklift-placed.png'],
    [manualIndex, 'manual', 'INSERT_FORKS', '08-manual-pickup.png'],
    [manualIndex, 'manual', 'MOVE_TO_STAGING', '09-manual-carrying.png'],
    [manualIndex, 'manual', 'ENTER_CONTAINER', '10-manual-entering.png'],
    [manualIndex, 'manual', 'RELEASE_CARGO', '11-manual-placed.png']
  ]) {
    await advanceToPhase(targetPage, index, phase);
    const snapshot = await readMotionDataset(targetPage);
    assert.equal(snapshot.actorType, actor);
    assert.equal(snapshot.phase, phase);
    await targetPage.screenshot({ path: path.join(outputDir, file), fullPage: true });
  }
}

async function verifyFiltersAndCapture(targetPage, expectedFingerprint) {
  const filters = [
    { label: 'SKU筛选', value: 'SKU-ACC-01' },
    { label: '批次筛选', value: 'BATCH-RTM-B' },
    { label: '港口筛选', value: 'Rotterdam' },
    { label: '港序筛选', value: '2' },
    { label: '主体筛选', value: 'forklift' },
    { label: '状态筛选', value: 'current' },
    { label: '风险筛选', value: 'heavy' }
  ];
  await resetFilters(targetPage);
  const baseline = await readFilterState(targetPage, expectedFingerprint);
  assert.equal(baseline.machineTotal, 221);
  assert.equal(baseline.visibleCount, 221);
  assert.equal(baseline.filterDimensions, 7);
  assert.equal(baseline.orderValid, true);
  const singleConditions = [];
  for (const filter of filters) {
    await resetFilters(targetPage);
    await targetPage.getByLabel(filter.label).selectOption(filter.value);
    await targetPage.waitForTimeout(90);
    const state = await readFilterState(targetPage, expectedFingerprint);
    assert.ok(state.visibleCount > 0 && state.visibleCount < baseline.visibleCount, `${filter.label} 没有改变数量`);
    assert.equal(state.activeFilterCount, 1);
    assert.notEqual(state.sceneMode, 'all');
    assert.equal(state.planFingerprint, expectedFingerprint);
    assert.equal(state.orderValid, true);
    singleConditions.push({ filter, state });
  }

  await resetFilters(targetPage);
  await targetPage.getByLabel('批次筛选').selectOption('BATCH-RTM-B');
  await targetPage.getByLabel('主体筛选').selectOption('forklift');
  const combined = await readFilterState(targetPage, expectedFingerprint);
  assert.ok(combined.visibleCount > 0 && combined.visibleCount < baseline.visibleCount);
  assert.equal(combined.activeFilterCount, 2);

  await resetFilters(targetPage);
  await targetPage.getByLabel('港口筛选').selectOption('Hamburg');
  await targetPage.getByLabel('批次筛选').selectOption('BATCH-ANR-A');
  const noResult = await readFilterState(targetPage, expectedFingerprint);
  assert.equal(noResult.visibleCount, 0);
  assert.ok(await targetPage.locator('.operation-filter-empty').count());

  await resetFilters(targetPage);
  await targetPage.getByLabel('主体筛选').selectOption('forklift');
  const firstVisibleGroup = targetPage.locator('.queue-group').first();
  const expectedIndex = Number(await firstVisibleGroup.getAttribute('data-first-index'));
  await firstVisibleGroup.locator('.queue-group__jump').click();
  await targetPage.waitForFunction((index) => Number(document.querySelector('.twin-canvas')?.dataset.currentIndex) === index, expectedIndex);
  const filteredJump = await readFilterState(targetPage, expectedFingerprint);
  assert.equal(filteredJump.currentIndex, expectedIndex);

  await resetFilters(targetPage);
  await targetPage.getByLabel('港口筛选').selectOption('Rotterdam');
  await targetPage.screenshot({ path: path.join(outputDir, '12-filter-by-port.png'), fullPage: true });
  await resetFilters(targetPage);
  await targetPage.getByLabel('主体筛选').selectOption('forklift');
  await targetPage.screenshot({ path: path.join(outputDir, '13-filter-by-actor.png'), fullPage: true });
  await resetFilters(targetPage);
  await targetPage.getByLabel('批次筛选').selectOption('BATCH-RTM-B');
  await targetPage.screenshot({ path: path.join(outputDir, '14-filter-by-batch.png'), fullPage: true });
  await resetFilters(targetPage);
  const restored = await readFilterState(targetPage, expectedFingerprint);
  assert.equal(restored.visibleCount, baseline.visibleCount);
  assert.equal(restored.groupCount, baseline.groupCount);
  return {
    baseline,
    singleConditions,
    combined,
    noResult,
    filteredJump,
    restored,
    summary: {
      filterDimensions: filters.length,
      baselineVisible: baseline.visibleCount,
      combinedVisible: combined.visibleCount,
      noResultVisible: noResult.visibleCount,
      filteredJumpIndex: filteredJump.currentIndex,
      restoredVisible: restored.visibleCount,
      planFingerprintPreserved: [combined, noResult, filteredJump, restored, ...singleConditions.map((entry) => entry.state)].every((state) => state.planFingerprint === expectedFingerprint)
    }
  };
}

async function captureSpeedAndGroupScreenshots(targetPage, forkliftIndex) {
  await resetFilters(targetPage);
  await jumpTo(targetPage, forkliftIndex);
  await targetPage.getByRole('button', { name: '16×', exact: true }).click();
  await targetPage.locator('.operation-play').click();
  await targetPage.waitForTimeout(520);
  await targetPage.screenshot({ path: path.join(outputDir, '15-speed-16x.png'), fullPage: true });
  if ((await targetPage.locator('.operation-play').innerText()).includes('暂停')) await targetPage.locator('.operation-play').click();
  await resetFilters(targetPage);
  const collapsed = targetPage.locator('.queue-group button[aria-expanded="false"]').first();
  if (await collapsed.count()) await collapsed.click();
  await targetPage.screenshot({ path: path.join(outputDir, '16-group-expanded.png'), fullPage: true });
}

async function captureBlockedScreenshot(targetPage, originalSession) {
  await targetPage.evaluate((stored) => {
    const session = structuredClone(stored);
    const sorted = session.backendPlan.loadedCargo
      .map((item, sourceIndex) => ({ item, sourceIndex }))
      .sort((left, right) => Number(left.item.x) - Number(right.item.x)
        || Number(left.item.y) - Number(right.item.y)
        || Number(left.item.z) - Number(right.item.z)
        || Number(left.item.loadingIndex || left.sourceIndex) - Number(right.item.loadingIndex || right.sourceIndex));
    const first = sorted[0].item;
    first.z = 0;
    first.w = 2_390;
    localStorage.setItem('yonggui.web.session.v2', JSON.stringify(session));
  }, originalSession);
  await targetPage.reload({ waitUntil: 'networkidle' });
  await targetPage.locator('.twin-canvas').waitFor();
  await advanceToPhase(targetPage, 0, 'BLOCKED');
  const reason = await targetPage.locator('.blocked-overlay').innerText();
  await targetPage.screenshot({ path: path.join(outputDir, '17-blocked.png'), fullPage: true });
  return { phase: (await readMotionDataset(targetPage)).phase, reason };
}

async function readQueueEvidence(targetPage) {
  const section = targetPage.locator('.step-queue');
  return {
    orderValid: (await section.getAttribute('data-order-valid')) === 'true',
    machineTotal: Number(await section.getAttribute('data-queue-count')),
    groupCount: Number(await section.getAttribute('data-group-count')),
    visibleCount: Number(await section.getAttribute('data-visible-queue-count')),
    renderedItemRows: await targetPage.locator('.queue-group__items li').count(),
    restoredAfterBlockedMutation: false
  };
}

async function readFilterState(targetPage, expectedFingerprint) {
  const section = targetPage.locator('.step-queue');
  const filterSection = targetPage.locator('.operation-filters');
  const dataset = await targetPage.locator('.twin-canvas').evaluate((node) => ({ ...node.dataset }));
  const session = await getSession(targetPage);
  const planFingerprint = fingerprintPlan(session.backendPlan);
  assert.equal(planFingerprint, expectedFingerprint);
  return {
    groupCount: Number(await section.getAttribute('data-group-count')),
    visibleCount: Number(await section.getAttribute('data-visible-queue-count')),
    machineTotal: Number(await section.getAttribute('data-queue-count')),
    filterDimensions: Number(await filterSection.getAttribute('data-filter-dimensions')),
    activeFilterCount: Number(await filterSection.getAttribute('data-active-filter-count')),
    currentIndex: Number(dataset.currentIndex),
    sceneMode: dataset.filterSceneMode,
    sceneVisibleQueueCount: Number(dataset.filterVisibleQueueCount),
    waitingSceneCount: Number(dataset.waitingSceneCount),
    orderValid: (await section.getAttribute('data-order-valid')) === 'true',
    planFingerprint
  };
}

async function resetFilters(targetPage) {
  const reset = targetPage.locator('.operation-filters__heading button');
  if (await reset.isEnabled()) {
    await reset.click();
    await targetPage.waitForTimeout(60);
  }
}

async function advanceToPhase(targetPage, index, targetPhase) {
  await jumpTo(targetPage, index);
  let guard = 0;
  while ((await readMotionDataset(targetPage)).phase !== targetPhase && guard < 24) {
    await targetPage.getByRole('button', { name: '下一步', exact: true }).click();
    await targetPage.waitForTimeout(45);
    guard += 1;
  }
  const snapshot = await readMotionDataset(targetPage);
  assert.equal(snapshot.phase, targetPhase, `未能到达 ${targetPhase}`);
  return snapshot;
}

async function jumpTo(targetPage, index) {
  const jump = targetPage.locator('.jump-control');
  await jump.locator('input').fill(String(index + 1));
  await jump.locator('button').click();
  await targetPage.waitForFunction((targetIndex) => Number(document.querySelector('.twin-canvas')?.dataset.currentIndex) === targetIndex, index);
  await targetPage.waitForTimeout(55);
}

async function readMotionDataset(targetPage) {
  return targetPage.locator('.twin-canvas').evaluate((node) => ({ ...node.dataset }));
}

async function getSession(targetPage) {
  return targetPage.evaluate(() => JSON.parse(localStorage.getItem('yonggui.web.session.v2')));
}

function fingerprintPlan(plan) {
  const canonical = {
    containerInfo: plan.containerInfo,
    loadedCargo: plan.loadedCargo.map((item) => ({
      cargoId: item.cargoId,
      sku: item.sku,
      batchId: item.batchId,
      handlingMethod: item.handlingMethod,
      destinationPort: item.destinationPort,
      portSequence: item.portSequence,
      x: item.x,
      y: item.y,
      z: item.z,
      l: item.l,
      w: item.w,
      h: item.h
    })),
    unloadedCargo: plan.unloadedCargo,
    inputFingerprint: plan.inputFingerprint,
    algorithmId: plan.ext_algorithmId
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function operationOrder(left, right) {
  return Number(left.x) - Number(right.x)
    || Number(left.y) - Number(right.y)
    || Number(left.z) - Number(right.z)
    || Number(left.loadingIndex || left.sourceIndex) - Number(right.loadingIndex || right.sourceIndex);
}

function activeActorPoint(snapshot) {
  return snapshot.actorType === 'manual' ? snapshot.worker.position : snapshot.forklift.position;
}

function maxAdjacentDistance(samples, key) {
  let maximum = 0;
  for (let index = 1; index < samples.length; index += 1) maximum = Math.max(maximum, pointDistance(samples[index - 1][key], samples[index][key]));
  return maximum;
}

function pointDistance(left = [], right = []) {
  return Math.hypot(
    Number(left?.x ?? left?.[0] ?? 0) - Number(right?.x ?? right?.[0] ?? 0),
    Number(left?.y ?? left?.[1] ?? 0) - Number(right?.y ?? right?.[1] ?? 0),
    Number(left?.z ?? left?.[2] ?? 0) - Number(right?.z ?? right?.[2] ?? 0)
  );
}

function unique(values) {
  return [...new Set(values)];
}

function round(value) {
  return Number(Number(value).toFixed(3));
}

async function writeJson(name, value) {
  await fs.writeFile(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`);
}
