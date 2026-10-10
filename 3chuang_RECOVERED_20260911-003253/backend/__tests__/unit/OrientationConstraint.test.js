const path = require('path');
const fs = require('fs');
const { resolveAllowedOrientations } = require('../../services/packing/OrientationConstraint');
const { validateOrientationConstraints } = require('../../services/packing/PlanValidator');
const FastBlockPackingEngine = require('../../services/FastBlockPackingEngine');
const demoTemplates = require('../../config/demo-cargo-templates');

const distinct = { cargoId: 'BOX', sku: 'BOX', length: 300, width: 200, height: 100, weight: 10, quantity: 1 };
const ids = (cargo) => resolveAllowedOrientations(cargo).map((entry) => entry.id);

describe('complete industrial orientation constraints', () => {
  test('preserves the exact legacy policy and flag dimension sets', () => {
    const original = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../artifacts/algo-repair/original-212-input.json'), 'utf8'));
    const cases = [
      { id: 'DATASET-A-212', cargoList: original.cargoList },
      { id: 'DATASET-B-MIXED-69', cargoList: demoTemplates.mixedCargo.cargoList }
    ];
    for (const benchmark of cases) {
      for (const cargo of benchmark.cargoList) {
        expect(dimensions(resolveAllowedOrientations(cargo))).toEqual(dimensions(oldOrientations(cargo)));
      }
    }
    expect(cases.find((entry) => entry.id === 'DATASET-A-212').cargoList).toHaveLength(10);
    expect(cases.find((entry) => entry.id === 'DATASET-B-MIXED-69').cargoList.reduce((sum, item) => sum + item.quantity, 0)).toBe(69);
  });

  test('maps Renault free and fixed horizontal axes according to checker C1', () => {
    expect(ids({ ...distinct, orientationConstraints: { mode: 'FREE' } })).toEqual(['LWH', 'WLH']);
    expect(ids({ ...distinct, orientationConstraints: { containerAxisAlignment: 'LENGTHWISE' } })).toEqual(['LWH']);
    expect(ids({ ...distinct, orientationConstraints: { containerAxisAlignment: 'WIDTHWISE' } })).toEqual(['WLH']);
  });

  test.each([
    ['height only', { lengthVertical: false, widthVertical: false, heightVertical: true }, ['LWH', 'WLH'], ['H']],
    ['width and height', { lengthVertical: false, widthVertical: true, heightVertical: true }, ['LWH', 'WLH', 'LHW', 'HLW'], ['H', 'W']],
    ['all', { lengthVertical: true, widthVertical: true, heightVertical: true }, ['LWH', 'WLH', 'LHW', 'WHL', 'HLW', 'HWL'], ['H', 'W', 'L']],
    ['length only', { lengthVertical: true, widthVertical: false, heightVertical: false }, ['WHL', 'HWL'], ['L']]
  ])('maps THPACK/WTPACK vertical matrix: %s', (_name, constraint, expectedIds, expectedUpright) => {
    const result = resolveAllowedOrientations({ ...distinct, orientationConstraints: constraint });
    expect(result.map((entry) => entry.id)).toEqual(expectedIds);
    expect([...new Set(result.map((entry) => entry.uprightOriginalAxis))]).toEqual(expectedUpright);
  });

  test('loads real WTPACK problem 1 first three SKUs without a forbidden upright axis', () => {
    const dataset = require(path.resolve(__dirname, '../../../data/external/normalized/orlib_wtpack/instances.json'));
    const items = dataset.instances.find((entry) => entry.id === 'wtpack1-1').items.slice(0, 3);
    expect(items).toHaveLength(3);
    for (const item of items) {
      const allowedAxes = new Set([
        ...(item.orientationConstraints.lengthVertical ? ['L'] : []),
        ...(item.orientationConstraints.widthVertical ? ['W'] : []),
        ...(item.orientationConstraints.heightVertical ? ['H'] : [])
      ]);
      const result = resolveAllowedOrientations({
        length: item.lengthMm, width: item.widthMm, height: item.heightMm,
        orientationConstraints: item.orientationConstraints
      });
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((entry) => allowedAxes.has(entry.uprightOriginalAxis))).toBe(true);
    }
  });

  test('maps the real ORTEC XYZ permission vector and keeps source exclusions out of candidates', () => {
    const dataset = require(path.resolve(__dirname, '../../../data/external/normalized/ortec_alonso_2019/instances.json'));
    const item = dataset.instances[0].items[0];
    expect(item.orientationConstraints).toEqual({ x: true, y: true, z: true });
    expect(ids({ ...distinct, orientationConstraints: item.orientationConstraints })).toHaveLength(6);
    const engine = new FastBlockPackingEngine();
    expect(engine._getOrientationCandidates({ ...distinct, orientationConstraints: { lengthVertical: false, widthVertical: false, heightVertical: true } })
      .map((entry) => entry.id)).toEqual(['LWH', 'WLH']);
  });

  test('validator independently rejects forbidden final dimensions and original-axis mapping', () => {
    const cargo = { ...distinct, orientationConstraints: { containerAxisAlignment: 'LENGTHWISE' } };
    expect(validateOrientationConstraints({ l: 300, w: 200, h: 100, orientationId: 'LWH', axisMap: { containerX: 'L', containerY: 'H', containerZ: 'W' } }, cargo).valid).toBe(true);
    expect(validateOrientationConstraints({ l: 200, w: 300, h: 100, orientationId: 'WLH', axisMap: { containerX: 'W', containerY: 'H', containerZ: 'L' } }, cargo)).toMatchObject({ valid: false, reason: 'DIMENSION_PERMUTATION_NOT_ALLOWED' });
    expect(validateOrientationConstraints({ l: 300, w: 200, h: 100, orientationId: 'WLH', axisMap: { containerX: 'W', containerY: 'H', containerZ: 'L' } }, cargo)).toMatchObject({ valid: false, reason: 'ORIGINAL_AXIS_MAPPING_NOT_ALLOWED' });
  });

  test('deduplicates cubes by geometry while retaining all legal axis identities', () => {
    const [cube] = resolveAllowedOrientations({ ...distinct, length: 100, width: 100, height: 100, orientationConstraints: { lengthVertical: true, widthVertical: true, heightVertical: true } });
    expect(cube.equivalentIds).toHaveLength(6);
    expect(cube.equivalentAxisMaps).toHaveLength(6);
    expect(cube.equivalentUprightOriginalAxes.sort()).toEqual(['H', 'L', 'W']);
  });
});

function dimensions(values) {
  return values.map((entry) => [entry.l, entry.w, entry.h]);
}

function oldOrientations(cargo) {
  const L = Number(cargo.length), W = Number(cargo.width), H = Number(cargo.height);
  const policy = String(cargo.orientationPolicy || cargo.cargoPhysicalProfile?.orientationPolicy || '').toUpperCase();
  const fixed = policy === 'FIXED_ORIENTATION' || policy === 'UPRIGHT_ONLY';
  const candidates = [{ l: L, w: W, h: H }];
  if (!fixed && cargo.canRotate !== false) candidates.push({ l: W, w: L, h: H });
  if (policy === 'FULL_ROTATION_ALLOWED' || cargo.canLayFlat === true) {
    candidates.push({ l: L, w: H, h: W });
    if (cargo.canRotate !== false) candidates.push({ l: W, w: H, h: L }, { l: H, w: L, h: W }, { l: H, w: W, h: L });
  }
  const seen = new Set();
  return candidates.filter((entry) => !seen.has(`${entry.l}:${entry.w}:${entry.h}`) && seen.add(`${entry.l}:${entry.w}:${entry.h}`));
}
