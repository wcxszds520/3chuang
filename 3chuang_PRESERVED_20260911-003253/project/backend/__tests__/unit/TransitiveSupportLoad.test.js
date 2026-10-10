const PlanValidator = require('../../services/packing/PlanValidator');

const container = { innerLength: 6000, innerWidth: 2400, innerHeight: 2700, maxWeight: 20000 };
const box = (cargoId, y, weight, overrides = {}) => ({ cargoId, x: 0, y, z: 0, l: 1000, w: 1000, h: 400, weight, stackable: true, maxStackLayers: 8, portSequence: 1, ...overrides });

test('middle packages transmit upper mass to the base', () => {
  const result = new PlanValidator().validate({ container, placements: [box('base', 0, 100, { maximumSupportedWeightKg: 25 }), box('middle', 400, 20), box('top', 800, 20)] });
  expect(result.supportLoads.base).toBe(40);
  expect(result.violations).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CARRYING', cargoIds: ['base'], evidence: expect.objectContaining({ load: 40, capacity: 25 }) })]));
});

test('load is divided by real contact area and remains conserved across two supports', () => {
  const placements = [box('left', 0, 100, { w: 400 }), box('right', 0, 100, { z: 400, w: 600 }), box('bridge', 400, 20), box('top', 800, 30)];
  const result = new PlanValidator().validate({ container, placements });
  expect(result.supportLoads.left).toBe(20);
  expect(result.supportLoads.right).toBe(30);
});

test('a weak base cannot evade its layer limit through a stronger middle package', () => {
  const result = new PlanValidator().validate({ container, placements: [box('base', 0, 100, { maxStackLayers: 2 }), box('middle', 400, 20), box('top', 800, 20)] });
  expect(result.violations).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MAX_STACK', cargoIds: ['base'] })]));
});
