'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FastBlockPackingEngine = require('../../backend/services/FastBlockPackingEngine');
const PlanValidator = require('../../backend/services/packing/PlanValidator');
const { resolveAllowedOrientations } = require('../../backend/services/packing/OrientationConstraint');

const root = path.resolve(__dirname, '../..');
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const renault = read('data/external/normalized/renault_esicup_2015/instances.json');
const thpack = read('data/external/normalized/orlib_thpack/instances.json');
const wtpack = read('data/external/normalized/orlib_wtpack/instances.json');
const ortec = read('data/external/normalized/ortec_alonso_2019/instances.json');

function rows(dataset) {
  return dataset.instances.flatMap((instance) => instance.items.map((item) => ({ instanceId: instance.id, item })));
}

function cargoOf(row, source, index, overrides = {}) {
  const item = row.item;
  return {
    cargoId: `${source}-${row.instanceId}-${item.externalItemId}-${index}`,
    sku: String(item.externalItemId), name: item.name || `${source} item ${item.externalItemId}`,
    length: item.lengthMm, width: item.widthMm, height: item.heightMm,
    weight: Number.isFinite(item.weightKg) && item.weightKg > 0 ? item.weightKg : 1,
    quantity: 1, stackable: false, maxStackLayers: 1,
    orientationPolicy: null, canRotate: true, canLayFlat: false, canInvert: false,
    orientationConstraints: JSON.parse(JSON.stringify(item.orientationConstraints)),
    portSequence: 1, handlingMethod: 'forklift', source: 'external-orientation-directed-verification',
    ...overrides
  };
}

async function solveOne(cargo) {
  const allowed = resolveAllowedOrientations(cargo);
  const maxL = Math.max(...allowed.map((entry) => entry.l));
  const maxW = Math.max(...allowed.map((entry) => entry.w));
  const maxH = Math.max(...allowed.map((entry) => entry.h));
  const container = { innerLength: maxL + 100, innerWidth: maxW + 100, innerHeight: maxH + 100, maxWeight: Math.max(cargo.weight * 2, 10000) };
  const result = await new FastBlockPackingEngine().generatePackingPlan([cargo], container);
  const placement = result.loadedCargo[0] || null;
  const validation = placement ? new PlanValidator().validate({ placements: [placement], cargoList: [cargo], container }) : null;
  return {
    sourceOrientation: cargo.orientationConstraints,
    resolvedAllowedOrientations: allowed.map(compact),
    solverFinalOrientation: placement ? {
      id: placement.orientationId, legacyLabel: placement.orientation,
      size: { l: placement.l, w: placement.w, h: placement.h },
      axisMap: placement.axisMap, uprightOriginalAxis: placement.uprightOriginalAxis
    } : null,
    validator: validation ? { valid: validation.valid, orientation: validation.checks.orientation, violations: validation.violations.filter((entry) => entry.code === 'ORIENTATION') } : null
  };
}

function compact(entry) {
  return { id: entry.id, size: { l: entry.l, w: entry.w, h: entry.h }, axisMap: entry.axisMap, uprightOriginalAxis: entry.uprightOriginalAxis };
}

function oldCountForExternal(constraint) {
  if (constraint?.mode === 'FREE') return 6; // pre-Batch 03.1 projection was FULL_ROTATION_ALLOWED
  if (constraint?.containerAxisAlignment) return 2; // null policy + nullable flags fell through to horizontal rotation
  const vertical = constraint && ['lengthVertical', 'widthVertical', 'heightVertical'].every((key) => Object.hasOwn(constraint, key));
  const xyz = constraint && ['x', 'y', 'z'].every((key) => Object.hasOwn(constraint, key));
  if (vertical || xyz) {
    const values = vertical
      ? [constraint.lengthVertical, constraint.widthVertical, constraint.heightVertical]
      : [constraint.x, constraint.y, constraint.z];
    if (values.every(Boolean)) return 6;
    if (vertical && !values[0] && !values[1] && values[2]) return 2;
    if (xyz && !values[0] && !values[1] && values[2]) return 2;
    if (values.every((value) => !value)) return 1;
    return 2;
  }
  return 2;
}

(async () => {
  const renaultRows = rows(renault);
  const sampleGroups = {
    free: renaultRows.filter((row) => row.item.orientationConstraints?.mode === 'FREE').slice(0, 3),
    lengthwise: renaultRows.filter((row) => row.item.orientationConstraints?.containerAxisAlignment === 'LENGTHWISE').slice(0, 3),
    widthwise: renaultRows.filter((row) => row.item.orientationConstraints?.containerAxisAlignment === 'WIDTHWISE').slice(0, 3)
  };
  const renaultEvidence = {};
  for (const [group, samples] of Object.entries(sampleGroups)) {
    renaultEvidence[group] = [];
    for (const [index, row] of samples.entries()) {
      renaultEvidence[group].push({ instanceId: row.instanceId, externalItemId: row.item.externalItemId, ...(await solveOne(cargoOf(row, 'renault', index))) });
    }
  }

  const thRows = rows(thpack);
  const matrix = [
    ['A_HEIGHT_ONLY', (c) => !c.lengthVertical && !c.widthVertical && c.heightVertical],
    ['B_WIDTH_HEIGHT', (c) => !c.lengthVertical && c.widthVertical && c.heightVertical],
    ['C_ALL', (c) => c.lengthVertical && c.widthVertical && c.heightVertical]
  ];
  const thpackEvidence = {};
  for (const [label, predicate] of matrix) {
    const row = thRows.find((entry) => entry.item.orientationConstraints && predicate(entry.item.orientationConstraints));
    thpackEvidence[label] = { instanceId: row.instanceId, externalItemId: row.item.externalItemId, sourceWeightStatus: 'NOT_PROVIDED_TEST_ONLY_MASS_1KG', ...(await solveOne(cargoOf(row, 'thpack', label))) };
  }
  const syntheticLength = { instanceId: 'directed-unit-only', item: { externalItemId: 'D', name: 'THPACK source semantics D', lengthMm: 300, widthMm: 200, heightMm: 100, weightKg: null, orientationConstraints: { lengthVertical: true, widthVertical: false, heightVertical: false } } };
  thpackEvidence.D_LENGTH_ONLY = { instanceId: syntheticLength.instanceId, externalItemId: 'D', sourceWeightStatus: 'DIRECTED_UNIT_NOT_BENCHMARK_MUTATION', ...(await solveOne(cargoOf(syntheticLength, 'thpack', 'D'))) };

  const wtRows = rows(wtpack).filter((row) => row.instanceId === 'wtpack1-1').slice(0, 3);
  const wtpackEvidence = [];
  for (const [index, row] of wtRows.entries()) wtpackEvidence.push({ instanceId: row.instanceId, externalItemId: row.item.externalItemId, ...(await solveOne(cargoOf(row, 'wtpack', index))) });

  const ortecRow = rows(ortec)[0];
  const ortecEvidence = { instanceId: ortecRow.instanceId, externalItemId: ortecRow.item.externalItemId, ...(await solveOne(cargoOf(ortecRow, 'ortec', 0))) };

  const candidateCounts = {
    Renault: Object.fromEntries(Object.entries(sampleGroups).map(([key, value]) => [key, {
      sampleConstraint: value[0]?.item.orientationConstraints || null,
      oldCount: value[0] ? oldCountForExternal(value[0].item.orientationConstraints) : null,
      newCount: value[0] ? resolveAllowedOrientations(cargoOf(value[0], 'renault-count', key)).length : null
    }])),
    THPACK: Object.fromEntries(Object.entries(thpackEvidence).map(([key, value]) => [key, { oldCount: oldCountForExternal(value.sourceOrientation), newCount: value.resolvedAllowedOrientations.length }])),
    WTPACK: wtpackEvidence.map((value) => ({ externalItemId: value.externalItemId, oldCount: oldCountForExternal(value.sourceOrientation), newCount: value.resolvedAllowedOrientations.length }))
  };

  const originalInputPath = path.join(root, 'artifacts/algo-repair/original-212-input.json');
  const originalPlanPath = path.join(root, 'artifacts/algo-repair/baseline-plan.json');
  const original = read('artifacts/algo-repair/original-212-input.json');
  const originalOrientationSets = original.cargoList.map((cargo) => ({ sku: cargo.sku, allowed: resolveAllowedOrientations(cargo).map((entry) => entry.id) }));
  const report = {
    generatedAt: new Date().toISOString(),
    coordinateConvention: { X: 'container length', Y: 'vertical height', Z: 'container width', canonicalIdOrder: 'final length/width/height = container X/Z/Y' },
    officialSemantics: {
      renault: { free: 'horizontal rotation only; original bottom remains bottom', lengthwise: 'checker deltaX >= deltaY', widthwise: 'checker deltaX < deltaY', evidence: ['competition.pdf Orientation constraints', 'format.pdf section 4.2', 'checker v1.4 javaCheckerESICUPPck/Item.java lines 26-59'] },
      thpack: '0/1 after each original dimension states whether that dimension may be vertical',
      wtpack: 'same vertical indicators; kg/cm2 load bearing intentionally not solved',
      ortec: 'independent X/Y/Z rotation permissions; stacking group/top/bottom intentionally not solved'
    },
    renault: renaultEvidence,
    thpack: thpackEvidence,
    wtpackProblem1FirstThreeSkus: wtpackEvidence,
    ortec: ortecEvidence,
    candidateCounts,
    original212: {
      inputFingerprint: original.inputFingerprint,
      inputSha256: sha256(originalInputPath),
      planSha256: sha256(originalPlanPath),
      skuCount: original.cargoList.length,
      pieces: original.cargoList.reduce((sum, cargo) => sum + Number(cargo.quantity || 0), 0),
      sampledOrientationSets: originalOrientationSets
    },
    officialChecker: { fullRun: false, reason: 'PORTCUBE does not emit Renault hierarchical bins/stacks/layers/rows/items output; Batch 03.1 used the bundled checker v1.4 source and its exact C1 behavior without restructuring the solver/export contract.' },
    excludedFeaturesModified: false
  };
  const output = path.join(root, 'artifacts/industrial-constraints/orientation-directed-validation.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, renaultSamples: Object.fromEntries(Object.entries(renaultEvidence).map(([k, v]) => [k, v.length])), thpackCases: Object.keys(thpackEvidence), wtpackSkus: wtpackEvidence.length, original212: report.original212, candidateCounts }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
