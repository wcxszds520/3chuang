const { analyzeExactVoidGeometry } = require('../../services/packing/ExactVoidGeometry');
const box = (id, x, y, z, l, h, w, extra = {}) => ({ cargoId: id, x, y, z, l, h, w, ...extra });

test('actual package faces give translation-invariant empty volume and count a full interior gap', () => {
  const items = [box('a', 0, 0, 0, 500, 1000, 1000), box('b', 1000, 0, 0, 500, 1000, 1000)];
  const first = analyzeExactVoidGeometry(items);
  const translated = analyzeExactVoidGeometry(items.map(item => ({ ...item, x: item.x + 37.695, z: item.z + 12 })));
  expect(first.internalVoidVolume).toBe(500000000);
  expect(translated.internalVoidVolume).toBeCloseTo(first.internalVoidVolume, 3);
});

test('no-stack classification measures only the empty column above that package in a nonrectangular void', () => {
  const items = [box('short', 0, 0, 0, 500, 200, 400, { stackable: false }), box('tall', 0, 0, 400, 500, 1000, 600), box('far', 500, 0, 0, 500, 500, 1000)];
  const result = analyzeExactVoidGeometry(items);
  expect(result.internalVoidVolume).toBe(160000000);
  expect(result.nonStackableHeadspaceVolume).toBe(160000000);
  expect(result.unexplainedVoidVolume).toBe(0);
});

test('classification never counts actual occupied cargo as headspace', () => {
  const result = analyzeExactVoidGeometry([box('base', 0, 0, 0, 500, 200, 400, { stackable: false }), box('illegal-above', 0, 200, 0, 500, 800, 400), box('tall', 0, 0, 400, 500, 1000, 600)]);
  expect(result.internalVoidVolume).toBe(0);
  expect(result.nonStackableHeadspaceVolume).toBe(0);
});
