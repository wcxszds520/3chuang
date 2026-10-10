/**
 * Unit Tests for Test Utilities
 * 
 * Verifies that test utility functions work correctly before using them
 * in property-based tests.
 * 
 * Spec: 3d-space-splitting-algorithm-implementation
 * Task: 2.3 Create test utilities and helpers
 */

const {
  checkCollision,
  noCollisions,
  isWithinBoundaries,
  allWithinBoundaries,
  calculateSpaceUtilization,
  verifySpaceUtilization,
  validateCoordinateSystem,
  isCoordinateSystemValid,
  validatePackingResult
} = require('./test-utilities');

describe('Test Utilities - Collision Detection', () => {
  describe('checkCollision', () => {
    test('detects no collision when boxes are separated on X-axis', () => {
      const box1 = { x: 0, y: 0, z: 0, l: 100, h: 100, w: 100 };
      const box2 = { x: 100, y: 0, z: 0, l: 100, h: 100, w: 100 };
      expect(checkCollision(box1, box2)).toBe(false);
    });

    test('detects no collision when boxes are separated on Y-axis', () => {
      const box1 = { x: 0, y: 0, z: 0, l: 100, h: 100, w: 100 };
      const box2 = { x: 0, y: 100, z: 0, l: 100, h: 100, w: 100 };
      expect(checkCollision(box1, box2)).toBe(false);
    });

    test('detects no collision when boxes are separated on Z-axis', () => {
      const box1 = { x: 0, y: 0, z: 0, l: 100, h: 100, w: 100 };
      const box2 = { x: 0, y: 0, z: 100, l: 100, h: 100, w: 100 };
      expect(checkCollision(box1, box2)).toBe(false);
    });

    test('detects collision when boxes overlap', () => {
      const box1 = { x: 0, y: 0, z: 0, l: 100, h: 100, w: 100 };
      const box2 = { x: 50, y: 50, z: 50, l: 100, h: 100, w: 100 };
      expect(checkCollision(box1, box2)).toBe(true);
    });

    test('detects collision when one box is inside another', () => {
      const box1 = { x: 0, y: 0, z: 0, l: 200, h: 200, w: 200 };
      const box2 = { x: 50, y: 50, z: 50, l: 50, h: 50, w: 50 };
      expect(checkCollision(box1, box2)).toBe(true);
    });

    test('detects no collision when boxes touch but do not overlap', () => {
      const box1 = { x: 0, y: 0, z: 0, l: 100, h: 100, w: 100 };
      const box2 = { x: 100, y: 0, z: 0, l: 100, h: 100, w: 100 };
      expect(checkCollision(box1, box2)).toBe(false);
    });
  });

  describe('noCollisions', () => {
    test('returns true for empty cargo list', () => {
      expect(noCollisions([])).toBe(true);
    });

    test('returns true for single cargo item', () => {
      const cargo = [
        { position: { x: 0, y: 0, z: 0 }, dimensions: { l: 100, h: 100, w: 100 } }
      ];
      expect(noCollisions(cargo)).toBe(true);
    });

    test('returns true when cargo items do not collide', () => {
      const cargo = [
        { position: { x: 0, y: 0, z: 0 }, dimensions: { l: 100, h: 100, w: 100 } },
        { position: { x: 100, y: 0, z: 0 }, dimensions: { l: 100, h: 100, w: 100 } },
        { position: { x: 0, y: 100, z: 0 }, dimensions: { l: 100, h: 100, w: 100 } }
      ];
      expect(noCollisions(cargo)).toBe(true);
    });

    test('returns false when cargo items collide', () => {
      const cargo = [
        { position: { x: 0, y: 0, z: 0 }, dimensions: { l: 100, h: 100, w: 100 } },
        { position: { x: 50, y: 50, z: 50 }, dimensions: { l: 100, h: 100, w: 100 } }
      ];
      expect(noCollisions(cargo)).toBe(false);
    });
  });
});

describe('Test Utilities - Boundary Checking', () => {
  const container = {
    innerLength: 12032,
    innerHeight: 2698,
    innerWidth: 2352
  };

  describe('isWithinBoundaries', () => {
    test('returns true when cargo is within boundaries', () => {
      const cargo = {
        position: { x: 0, y: 0, z: 0 },
        dimensions: { l: 1000, h: 1000, w: 1000 }
      };
      expect(isWithinBoundaries(cargo, container)).toBe(true);
    });

    test('returns false when cargo exceeds X boundary', () => {
      const cargo = {
        position: { x: 12000, y: 0, z: 0 },
        dimensions: { l: 100, h: 100, w: 100 }
      };
      expect(isWithinBoundaries(cargo, container)).toBe(false);
    });

    test('returns false when cargo exceeds Y boundary', () => {
      const cargo = {
        position: { x: 0, y: 2600, z: 0 },
        dimensions: { l: 100, h: 100, w: 100 }
      };
      expect(isWithinBoundaries(cargo, container)).toBe(false);
    });

    test('returns false when cargo exceeds Z boundary', () => {
      const cargo = {
        position: { x: 0, y: 0, z: 2300 },
        dimensions: { l: 100, h: 100, w: 100 }
      };
      expect(isWithinBoundaries(cargo, container)).toBe(false);
    });

    test('returns false when cargo has negative X coordinate', () => {
      const cargo = {
        position: { x: -10, y: 0, z: 0 },
        dimensions: { l: 100, h: 100, w: 100 }
      };
      expect(isWithinBoundaries(cargo, container)).toBe(false);
    });

    test('returns false when cargo has negative Y coordinate', () => {
      const cargo = {
        position: { x: 0, y: -10, z: 0 },
        dimensions: { l: 100, h: 100, w: 100 }
      };
      expect(isWithinBoundaries(cargo, container)).toBe(false);
    });

    test('returns false when cargo has negative Z coordinate', () => {
      const cargo = {
        position: { x: 0, y: 0, z: -10 },
        dimensions: { l: 100, h: 100, w: 100 }
      };
      expect(isWithinBoundaries(cargo, container)).toBe(false);
    });

    test('returns true when cargo exactly fits container', () => {
      const cargo = {
        position: { x: 0, y: 0, z: 0 },
        dimensions: { l: 12032, h: 2698, w: 2352 }
      };
      expect(isWithinBoundaries(cargo, container)).toBe(true);
    });
  });

  describe('allWithinBoundaries', () => {
    test('returns true for empty cargo list', () => {
      expect(allWithinBoundaries([], container)).toBe(true);
    });

    test('returns true when all cargo within boundaries', () => {
      const cargo = [
        { position: { x: 0, y: 0, z: 0 }, dimensions: { l: 1000, h: 1000, w: 1000 } },
        { position: { x: 1000, y: 0, z: 0 }, dimensions: { l: 1000, h: 1000, w: 1000 } }
      ];
      expect(allWithinBoundaries(cargo, container)).toBe(true);
    });

    test('returns false when any cargo exceeds boundaries', () => {
      const cargo = [
        { position: { x: 0, y: 0, z: 0 }, dimensions: { l: 1000, h: 1000, w: 1000 } },
        { position: { x: 12000, y: 0, z: 0 }, dimensions: { l: 100, h: 100, w: 100 } }
      ];
      expect(allWithinBoundaries(cargo, container)).toBe(false);
    });
  });
});

describe('Test Utilities - Space Utilization', () => {
  const container = {
    innerLength: 2000,
    innerHeight: 2000,
    innerWidth: 2000
  };

  describe('calculateSpaceUtilization', () => {
    test('returns 0 for empty cargo list', () => {
      expect(calculateSpaceUtilization([], container)).toBe(0);
    });

    test('calculates correct utilization for single cargo', () => {
      const cargo = [
        { dimensions: { l: 1000, h: 1000, w: 1000 } } // 1,000,000,000 cubic mm
      ];
      // Container volume: 2000 * 2000 * 2000 = 8,000,000,000 cubic mm
      // Utilization: (1,000,000,000 / 8,000,000,000) * 100 = 12.5%
      expect(calculateSpaceUtilization(cargo, container)).toBe(12.5);
    });

    test('calculates correct utilization for multiple cargo', () => {
      const cargo = [
        { dimensions: { l: 1000, h: 1000, w: 1000 } }, // 1,000,000,000
        { dimensions: { l: 500, h: 500, w: 500 } }     // 125,000,000
      ];
      // Total: 1,125,000,000
      // Utilization: (1,125,000,000 / 8,000,000,000) * 100 = 14.0625%
      expect(calculateSpaceUtilization(cargo, container)).toBe(14.0625);
    });

    test('calculates 100% utilization when cargo fills container', () => {
      const cargo = [
        { dimensions: { l: 2000, h: 2000, w: 2000 } }
      ];
      expect(calculateSpaceUtilization(cargo, container)).toBe(100);
    });
  });

  describe('verifySpaceUtilization', () => {
    test('returns true when utilization matches expected', () => {
      const cargo = [
        { dimensions: { l: 1000, h: 1000, w: 1000 } }
      ];
      expect(verifySpaceUtilization(cargo, container, 12.5, 0.01)).toBe(true);
    });

    test('returns false when utilization does not match expected', () => {
      const cargo = [
        { dimensions: { l: 1000, h: 1000, w: 1000 } }
      ];
      expect(verifySpaceUtilization(cargo, container, 15.0, 0.01)).toBe(false);
    });

    test('returns true when utilization within tolerance', () => {
      const cargo = [
        { dimensions: { l: 1000, h: 1000, w: 1000 } }
      ];
      expect(verifySpaceUtilization(cargo, container, 12.51, 0.1)).toBe(true);
    });
  });
});

describe('Test Utilities - Coordinate System Validation', () => {
  const container = {
    innerLength: 12032,
    innerHeight: 2698,
    innerWidth: 2352
  };

  describe('validateCoordinateSystem', () => {
    test('returns valid for empty cargo list', () => {
      const result = validateCoordinateSystem([], container);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('returns valid when all cargo within coordinate system', () => {
      const cargo = [
        {
          cargoId: 'cargo1',
          position: { x: 0, y: 0, z: 0 },
          dimensions: { l: 1000, h: 1000, w: 1000 }
        }
      ];
      const result = validateCoordinateSystem(cargo, container);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('returns invalid when X-coordinate exceeds range', () => {
      const cargo = [
        {
          cargoId: 'cargo1',
          position: { x: 13000, y: 0, z: 0 },
          dimensions: { l: 100, h: 100, w: 100 }
        }
      ];
      const result = validateCoordinateSystem(cargo, container);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('returns invalid when Y-coordinate exceeds range', () => {
      const cargo = [
        {
          cargoId: 'cargo1',
          position: { x: 0, y: 3000, z: 0 },
          dimensions: { l: 100, h: 100, w: 100 }
        }
      ];
      const result = validateCoordinateSystem(cargo, container);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('returns invalid when Z-coordinate exceeds range', () => {
      const cargo = [
        {
          cargoId: 'cargo1',
          position: { x: 0, y: 0, z: 3000 },
          dimensions: { l: 100, h: 100, w: 100 }
        }
      ];
      const result = validateCoordinateSystem(cargo, container);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('returns invalid when dimensions are not positive', () => {
      const cargo = [
        {
          cargoId: 'cargo1',
          position: { x: 0, y: 0, z: 0 },
          dimensions: { l: 0, h: 100, w: 100 }
        }
      ];
      const result = validateCoordinateSystem(cargo, container);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('isCoordinateSystemValid', () => {
    test('returns true when coordinate system is valid', () => {
      const cargo = [
        {
          cargoId: 'cargo1',
          position: { x: 0, y: 0, z: 0 },
          dimensions: { l: 1000, h: 1000, w: 1000 }
        }
      ];
      expect(isCoordinateSystemValid(cargo, container)).toBe(true);
    });

    test('returns false when coordinate system is invalid', () => {
      const cargo = [
        {
          cargoId: 'cargo1',
          position: { x: 13000, y: 0, z: 0 },
          dimensions: { l: 100, h: 100, w: 100 }
        }
      ];
      expect(isCoordinateSystemValid(cargo, container)).toBe(false);
    });
  });
});

describe('Test Utilities - Comprehensive Validation', () => {
  const containerType = {
    innerLength: 12032,
    innerHeight: 2698,
    innerWidth: 2352
  };

  describe('validatePackingResult', () => {
    test('returns valid for correct packing result', () => {
      const packingResult = {
        loadedCargo: [
          {
            cargoId: 'cargo1',
            position: { x: 0, y: 0, z: 0 },
            dimensions: { l: 1000, h: 1000, w: 1000 }
          },
          {
            cargoId: 'cargo2',
            position: { x: 1000, y: 0, z: 0 },
            dimensions: { l: 1000, h: 1000, w: 1000 }
          }
        ],
        containerType
      };
      
      const report = validatePackingResult(packingResult);
      expect(report.isValid).toBe(true);
      expect(report.checks.noCollisions).toBe(true);
      expect(report.checks.allWithinBoundaries).toBe(true);
      expect(report.checks.coordinateSystem.isValid).toBe(true);
      expect(report.checks.spaceUtilization).toBeGreaterThan(0);
    });

    test('returns invalid when cargo collides', () => {
      const packingResult = {
        loadedCargo: [
          {
            cargoId: 'cargo1',
            position: { x: 0, y: 0, z: 0 },
            dimensions: { l: 1000, h: 1000, w: 1000 }
          },
          {
            cargoId: 'cargo2',
            position: { x: 500, y: 500, z: 500 },
            dimensions: { l: 1000, h: 1000, w: 1000 }
          }
        ],
        containerType
      };
      
      const report = validatePackingResult(packingResult);
      expect(report.isValid).toBe(false);
      expect(report.checks.noCollisions).toBe(false);
    });

    test('returns invalid when cargo exceeds boundaries', () => {
      const packingResult = {
        loadedCargo: [
          {
            cargoId: 'cargo1',
            position: { x: 12000, y: 0, z: 0 },
            dimensions: { l: 100, h: 100, w: 100 }
          }
        ],
        containerType
      };
      
      const report = validatePackingResult(packingResult);
      expect(report.isValid).toBe(false);
      expect(report.checks.allWithinBoundaries).toBe(false);
    });
  });
});
