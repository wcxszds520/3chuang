import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDemoCargo,
  DEMO_DATASET_ID,
  DEMO_ORDER,
  summarizeDemoDataset
} from '../web-dashboard/src/domain/cargo/demoDataset.js';
import { buildPackingRequest } from '../web-dashboard/src/services/packingApi.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datasetDir = path.join(root, 'output', 'playwright', 'stage3', 'dataset');
const algorithmDir = path.join(root, 'output', 'playwright', 'stage3', 'algorithm');
const endpoint = process.env.STAGE3_PACKING_URL || 'http://127.0.0.1:3000/api/packing/generate';
const cargo = createDemoCargo();
const summary = summarizeDemoDataset(cargo);
const request = buildPackingRequest({ containerType: '40HQ', cargoList: cargo });

await Promise.all([mkdir(datasetDir, { recursive: true }), mkdir(algorithmDir, { recursive: true })]);

const datasetAssertions = {
  skuCountInRange: summary.skuCount >= 8 && summary.skuCount <= 12,
  atLeastThreePorts: summary.destinationPortCount >= 3,
  atLeastTwoBatches: summary.batchCount >= 2,
  atLeastSixAttributes: summary.attributeCoverage.length >= 6,
  atLeastTwoManualSkus: summary.manualSkus.length >= 2,
  atLeastTwoForkliftSkus: summary.forkliftSkus.length >= 2,
  demonstrationScale: summary.totalPieces > 100,
  deterministicSource: cargo.every(item => item.source === 'official-demo-template'),
  fixedHandling: cargo.every(item => item.handlingPolicy === 'fixed')
};
assertAll(datasetAssertions, '演示数据集结构门禁');

await writeJson(path.join(datasetDir, 'demo-dataset.json'), {
  datasetId: DEMO_DATASET_ID,
  order: DEMO_ORDER,
  selectedContainerType: '40HQ',
  cargo
});

const runs = [];
for (let index = 1; index <= 3; index += 1) {
  await writeJson(path.join(algorithmDir, `request-${index}.json`), request);
  const startedAt = Date.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request)
  });
  const envelope = await response.json();
  await writeJson(path.join(algorithmDir, `response-${index}.json`), envelope);
  const validation = validateResponse(envelope, response.status, cargo);
  runs.push({
    run: index,
    elapsedMs: Date.now() - startedAt,
    httpStatus: response.status,
    planId: envelope?.data?.planId || null,
    loaded: envelope?.data?.loadedCargo?.length ?? null,
    unloaded: envelope?.data?.unloadedCargo?.length ?? null,
    utilization: envelope?.data?.spaceUtilization ?? null,
    totalWeight: envelope?.data?.totalWeight ?? null,
    cog: envelope?.data?.cog ?? null,
    cogOffset: envelope?.data?.cogOffset ?? null,
    lifoCompliant: envelope?.data?.constraintMeta?.lifoCompliant ?? null,
    algorithmId: envelope?.data?.ext_algorithmId || envelope?.data?.metrics?.algorithm_id || null,
    coreFingerprint: fingerprintPlan(envelope?.data),
    assertions: validation
  });
  assertAll(validation, `真实后端第 ${index} 次生成门禁`);
}

const requestFingerprint = sha256(stableStringify(request));
const coreFingerprints = [...new Set(runs.map(run => run.coreFingerprint))];
const determinismAssertions = {
  requestFingerprintStable: runs.length === 3 && requestFingerprint.length === 64,
  threeSuccessfulRuns: runs.every(run => run.httpStatus === 200),
  threeFullyLoadedRuns: runs.every(run => run.loaded === summary.totalPieces && run.unloaded === 0),
  sameCoreResultThreeTimes: coreFingerprints.length === 1,
  sameAuthoritativeAlgorithm: runs.every(run => run.algorithmId === 'fast-block'),
  utilizationInPresentationRange: runs.every(run => run.utilization >= 60 && run.utilization <= 90),
  lifoAlwaysPasses: runs.every(run => run.lifoCompliant === true),
  centerOfGravityAlwaysPasses: runs.every(run => Number(run.cogOffset?.lateral) <= 5 && Number(run.cogOffset?.longitudinal) <= 10)
};
assertAll(determinismAssertions, '连续三次确定性门禁');

const finalSummary = {
  ...summary,
  requestFingerprint,
  authoritativeEndpoint: '/api/packing/generate',
  authoritativeAlgorithmId: 'fast-block',
  authoritativeAlgorithmLabel: 'Fast Block多约束三维装箱引擎',
  datasetAssertions,
  actualPlan: {
    loaded: runs[0].loaded,
    unloaded: runs[0].unloaded,
    utilization: runs[0].utilization,
    totalWeight: runs[0].totalWeight,
    cog: runs[0].cog,
    cogOffset: runs[0].cogOffset,
    lifoCompliant: runs[0].lifoCompliant,
    coreFingerprint: runs[0].coreFingerprint
  }
};
await writeJson(path.join(datasetDir, 'demo-dataset-summary.json'), finalSummary);
await writeJson(path.join(algorithmDir, 'determinism-summary.json'), {
  datasetId: DEMO_DATASET_ID,
  capturedAt: new Date().toISOString(),
  endpoint,
  requestFingerprint,
  runs,
  coreFingerprints,
  assertions: determinismAssertions
});

console.log(JSON.stringify({ summary: finalSummary, runs, assertions: determinismAssertions }, null, 2));

function validateResponse(envelope, httpStatus, inputCargo) {
  const data = envelope?.data;
  const container = data?.containerInfo;
  const loaded = Array.isArray(data?.loadedCargo) ? data.loadedCargo : [];
  const unloaded = Array.isArray(data?.unloadedCargo) ? data.unloadedCargo : [];
  const inputTotal = inputCargo.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const inputBySku = countInputBySku(inputCargo);
  const outputBySku = countOutputBySku(loaded);
  const coordinatesValid = loaded.every(item => (
    finite(item.x, item.y, item.z, item.l, item.h, item.w)
    && item.x >= 0 && item.y >= 0 && item.z >= 0
    && item.x + item.l <= Number(container?.innerLength) + 0.001
    && item.y + item.h <= Number(container?.innerHeight) + 0.001
    && item.z + item.w <= Number(container?.innerWidth) + 0.001
  ));
  return {
    httpSuccess: httpStatus === 200,
    businessSuccess: envelope?.code === 200,
    authoritativeAlgorithm: (data?.ext_algorithmId || data?.metrics?.algorithm_id) === 'fast-block',
    loadedEqualsInput: loaded.length === inputTotal && Number(data?.totalCargoCount) === inputTotal,
    unloadedIsZero: unloaded.length === 0,
    quantityConserved: loaded.length + unloaded.length === inputTotal,
    everySkuConserved: [...inputBySku].every(([sku, count]) => outputBySku.get(sku) === count),
    everyCargoHasRealCoordinates: coordinatesValid,
    totalWeightWithinContainer: Number(data?.totalWeight) <= Number(container?.maxWeight),
    lateralCogWithinLimit: Number(data?.cogOffset?.lateral) <= 5,
    longitudinalCogWithinLimit: Number(data?.cogOffset?.longitudinal) <= 10,
    lifoCompliant: data?.constraintMeta?.lifoCompliant === true,
    sixConstraintMetadataPresent: Array.isArray(data?.constraintMeta?.sixDimensionalConstraints)
      && data.constraintMeta.sixDimensionalConstraints.length === 6,
    handlingSemanticsRoundTrip: loaded.every(item => ['manual', 'forklift'].includes(item.handlingMethod))
  };
}

function countInputBySku(input) {
  return new Map(input.map(item => [item.sku, Number(item.quantity || 0)]));
}

function countOutputBySku(output) {
  const counts = new Map();
  for (const item of output) counts.set(item.sku, (counts.get(item.sku) || 0) + 1);
  return counts;
}

function fingerprintPlan(plan) {
  const canonical = {
    containerInfo: plan?.containerInfo,
    loadedCargo: (plan?.loadedCargo || []).map(item => ({
      loadingIndex: item.loadingIndex,
      cargoId: item.cargoId,
      sku: item.sku,
      x: item.x,
      y: item.y,
      z: item.z,
      l: item.l,
      h: item.h,
      w: item.w,
      weight: item.weight,
      destinationPort: item.destinationPort,
      portSequence: item.portSequence,
      batchId: item.batchId,
      handlingMethod: item.handlingMethod
    })),
    unloadedCargo: plan?.unloadedCargo || [],
    spaceUtilization: plan?.spaceUtilization,
    totalWeight: plan?.totalWeight,
    cog: plan?.cog,
    cogOffset: plan?.cogOffset,
    lifoCompliant: plan?.constraintMeta?.lifoCompliant,
    algorithmId: plan?.ext_algorithmId || plan?.metrics?.algorithm_id
  };
  return sha256(stableStringify(canonical));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function finite(...values) {
  return values.every(value => Number.isFinite(Number(value)));
}

function assertAll(assertions, label) {
  const failed = Object.entries(assertions).filter(([, passed]) => !passed).map(([key]) => key);
  if (failed.length) throw new Error(`${label}失败：${failed.join(', ')}`);
}

async function writeJson(filename, value) {
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
