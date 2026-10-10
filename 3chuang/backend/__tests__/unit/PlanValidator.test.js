const PlanValidator = require('../../services/packing/PlanValidator');

const container = { typeId: 'TEST', innerLength: 2000, innerWidth: 1000, innerHeight: 1000, maxWeight: 1000 };
const cargoList = [
  { cargoId: 'A', sku: 'A', length: 500, width: 500, height: 500, weight: 20, quantity: 2, canRotate: false, stackable: true, maxStackLayers: 2, portSequence: 1 },
  { cargoId: 'B', sku: 'B', length: 500, width: 500, height: 500, weight: 30, quantity: 1, canRotate: false, stackable: true, maxStackLayers: 2, portSequence: 2 }
];

describe('PlanValidator', () => {
  test('independently validates a bounded collision-free LIFO plan', () => {
    const placements = [
      placement({ cargoId: 'B_1', sku: 'B', x: 0, portSequence: 2, weight: 30 }),
      placement({ cargoId: 'A_1', sku: 'A', x: 500, portSequence: 1, weight: 20 }),
      placement({ cargoId: 'A_2', sku: 'A', x: 1000, portSequence: 1, weight: 20 })
    ];
    const result = new PlanValidator().validate({ placements, cargoList, container });
    expect(result.status).toBe('VALID');
    expect(result.hardViolationCount).toBe(0);
    expect(result.checks).toMatchObject({ bounds: true, collision: true, payload: true, lifo: true, insertion: true });
  });

  test('reports bounds, collision and orientation as deterministic hard violations', () => {
    const placements = [
      placement({ cargoId: 'A_1', sku: 'A', x: 0, z: 0, portSequence: 1, l: 500, w: 500, h: 500 }),
      placement({ cargoId: 'B_1', sku: 'B', x: 250, z: 0, portSequence: 2, l: 700, w: 500, h: 500 }),
      placement({ cargoId: 'A_2', sku: 'A', x: 1800, z: 500, portSequence: 1, l: 500, w: 500, h: 500 })
    ];
    const result = new PlanValidator().validate({ placements, cargoList, container });
    const codes = new Set(result.violations.map((entry) => entry.code));
    expect(result.status).toBe('INVALID');
    expect(codes.has('OUT_OF_BOUNDS')).toBe(true);
    expect(codes.has('COLLISION')).toBe(true);
    expect(codes.has('ORIENTATION')).toBe(true);
  });

  test('uses access blocking rather than rigid destination x zones for LIFO', () => {
    const interleavedButAccessible = [
      placement({ cargoId: 'A_1', sku: 'A', x: 0, z: 0, portSequence: 1 }),
      placement({ cargoId: 'B_1', sku: 'B', x: 500, z: 500, portSequence: 2, weight: 30 })
    ];
    expect(new PlanValidator().validate({ placements: interleavedButAccessible, cargoList, container }).checks.lifo).toBe(true);

    const blocked = [
      placement({ cargoId: 'A_1', sku: 'A', x: 0, z: 0, portSequence: 1 }),
      placement({ cargoId: 'B_1', sku: 'B', x: 500, z: 0, portSequence: 2, weight: 30 })
    ];
    const result = new PlanValidator().validate({ placements: blocked, cargoList, container });
    expect(result.violations.some((entry) => entry.code === 'LIFO' && entry.evidence.relationship === 'DOOR_CORRIDOR_BLOCK')).toBe(true);
  });

  test('uses support union area and rejects fragile/non-stackable carrying', () => {
    const placements = [
      placement({ cargoId: 'A_1', sku: 'A', x: 0, y: 0, fragile: true }),
      placement({ cargoId: 'A_2', sku: 'A', x: 0, y: 500 })
    ];
    const result = new PlanValidator().validate({ placements, cargoList, container });
    expect(result.violations.some((entry) => entry.code === 'FRAGILE')).toBe(true);
  });
});

function placement(overrides = {}) {
  return {
    cargoId: 'A_1', sku: 'A', x: 0, y: 0, z: 0, l: 500, w: 500, h: 500,
    weight: 20, fragile: false, stackable: true, maxStackLayers: 2, portSequence: 1,
    ...overrides
  };
}
