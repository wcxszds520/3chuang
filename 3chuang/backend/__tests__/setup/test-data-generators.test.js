/**
 * Verification Tests for Test Data Generators
 * 
 * This test suite verifies that all fast-check arbitraries generate valid data
 * that conforms to the expected constraints and business rules.
 * 
 * Spec: 3d-space-splitting-algorithm-implementation
 * Task: 2.2 Create test data generators (arbitraries)
 * Requirements: 20.1
 */

const fc = require('fast-check');
const {
  cargoArbitrary,
  cargoWithWeightArbitrary,
  heavyCargoArbitrary,
  lightCargoArbitrary,
  fragileCargoArbitrary,
  cargoWithRotationArbitrary,
  cargoWithPortSequenceArbitrary,
  cargoListArbitrary,
  mixedCargoListArbitrary,
  containerArbitrary,
  specificContainerArbitrary,
  container40HQArbitrary,
  container20GPArbitrary,
  container40GPArbitrary,
  customContainerArbitrary,
  STANDARD_CONTAINERS
} = require('./test-data-generators');

describe('Test Data Generators Verification', () => {
  describe('Cargo Generators', () => {
    test('cargoArbitrary generates valid cargo with correct dimensions', () => {
      fc.assert(
        fc.property(cargoArbitrary(), (cargo) => {
          // Verify dimensions are within expected range (100-2000mm)
          expect(cargo.length).toBeGreaterThanOrEqual(100);
          expect(cargo.length).toBeLessThanOrEqual(2000);
          expect(cargo.width).toBeGreaterThanOrEqual(100);
          expect(cargo.width).toBeLessThanOrEqual(2000);
          expect(cargo.height).toBeGreaterThanOrEqual(100);
          expect(cargo.height).toBeLessThanOrEqual(2000);
          
          // Verify weight is within expected range (1-100kg)
          expect(cargo.weight).toBeGreaterThanOrEqual(1);
          expect(cargo.weight).toBeLessThanOrEqual(100);
          
          // Verify quantity is within expected range (1-10)
          expect(cargo.quantity).toBeGreaterThanOrEqual(1);
          expect(cargo.quantity).toBeLessThanOrEqual(10);
          
          // Verify portSequence is within expected range (1-5)
          expect(cargo.portSequence).toBeGreaterThanOrEqual(1);
          expect(cargo.portSequence).toBeLessThanOrEqual(5);
          
          // Verify boolean flags are boolean
          expect(typeof cargo.fragile).toBe('boolean');
          expect(typeof cargo.canInvert).toBe('boolean');
          expect(typeof cargo.canLayFlat).toBe('boolean');
          
          // Verify required fields exist
          expect(cargo.cargoId).toBeDefined();
          expect(cargo.name).toBeDefined();
          expect(cargo.eta).toBeInstanceOf(Date);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    test('heavyCargoArbitrary generates cargo with weight >= 20kg', () => {
      fc.assert(
        fc.property(heavyCargoArbitrary(), (cargo) => {
          expect(cargo.weight).toBeGreaterThanOrEqual(20);
          expect(cargo.weight).toBeLessThanOrEqual(100);
          expect(cargo.isHeavy()).toBe(true);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    test('lightCargoArbitrary generates cargo with weight < 20kg', () => {
      fc.assert(
        fc.property(lightCargoArbitrary(), (cargo) => {
          expect(cargo.weight).toBeGreaterThanOrEqual(1);
          expect(cargo.weight).toBeLessThan(20);
          expect(cargo.isHeavy()).toBe(false);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    test('fragileCargoArbitrary generates fragile cargo', () => {
      fc.assert(
        fc.property(fragileCargoArbitrary(), (cargo) => {
          expect(cargo.fragile).toBe(true);
          expect(cargo.isFragile()).toBe(true);
          expect(cargo.getCargoType()).toBe('fragile');
          return true;
        }),
        { numRuns: 100 }
      );
    });

    test('cargoWithRotationArbitrary respects rotation constraints', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          (canInvert, canLayFlat) => {
            const cargo = fc.sample(cargoWithRotationArbitrary(canInvert, canLayFlat), 1)[0];
            expect(cargo.canInvert).toBe(canInvert);
            expect(cargo.canLayFlat).toBe(canLayFlat);
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('cargoWithPortSequenceArbitrary generates cargo with specific port sequence', () => {
      const portSequence = 5;
      fc.assert(
        fc.property(cargoWithPortSequenceArbitrary(portSequence), (cargo) => {
          expect(cargo.portSequence).toBe(portSequence);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    test('cargoWithWeightArbitrary generates cargo within specified weight range', () => {
      const minWeight = 10;
      const maxWeight = 30;
      fc.assert(
        fc.property(cargoWithWeightArbitrary(minWeight, maxWeight), (cargo) => {
          expect(cargo.weight).toBeGreaterThanOrEqual(minWeight);
          expect(cargo.weight).toBeLessThanOrEqual(maxWeight);
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Cargo List Generators', () => {
    test('cargoListArbitrary generates lists within specified length range', () => {
      const minLength = 5;
      const maxLength = 20;
      fc.assert(
        fc.property(cargoListArbitrary(minLength, maxLength), (cargoList) => {
          expect(cargoList.length).toBeGreaterThanOrEqual(minLength);
          expect(cargoList.length).toBeLessThanOrEqual(maxLength);
          
          // Verify all items are valid cargo
          cargoList.forEach(cargo => {
            expect(cargo.cargoId).toBeDefined();
            expect(cargo.length).toBeGreaterThan(0);
            expect(cargo.weight).toBeGreaterThan(0);
          });
          
          return true;
        }),
        { numRuns: 50 }
      );
    });

    test('mixedCargoListArbitrary generates correct mix of cargo types', () => {
      const heavyCount = 10;
      const fragileCount = 15;
      const normalCount = 25;
      
      fc.assert(
        fc.property(
          mixedCargoListArbitrary(heavyCount, fragileCount, normalCount),
          (cargoList) => {
            expect(cargoList.length).toBe(heavyCount + fragileCount + normalCount);
            
            // Count cargo types
            const fragile = cargoList.filter(c => c.isFragile()).length;
            
            // Note: The fragileCount parameter ensures at least that many fragile items,
            // but some heavy or normal cargo might also randomly be fragile
            expect(fragile).toBeGreaterThanOrEqual(fragileCount);
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    test('cargoListArbitrary with default parameters generates 1-50 items', () => {
      fc.assert(
        fc.property(cargoListArbitrary(), (cargoList) => {
          expect(cargoList.length).toBeGreaterThanOrEqual(1);
          expect(cargoList.length).toBeLessThanOrEqual(50);
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Container Generators', () => {
    test('containerArbitrary generates standard container types', () => {
      fc.assert(
        fc.property(containerArbitrary(), (container) => {
          // Verify it's one of the standard types
          const validTypes = ['20GP', '40GP', '40HQ'];
          expect(validTypes).toContain(container.typeId);
          
          // Verify dimensions match standard specifications
          const spec = STANDARD_CONTAINERS[container.typeId];
          expect(container.innerLength).toBe(spec.innerLength);
          expect(container.innerWidth).toBe(spec.innerWidth);
          expect(container.innerHeight).toBe(spec.innerHeight);
          expect(container.maxWeight).toBe(spec.maxWeight);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    test('container40HQArbitrary generates 40HQ container', () => {
      fc.assert(
        fc.property(container40HQArbitrary(), (container) => {
          expect(container.typeId).toBe('40HQ');
          expect(container.innerLength).toBe(12032);
          expect(container.innerWidth).toBe(2352);
          expect(container.innerHeight).toBe(2698);
          expect(container.maxWeight).toBe(26000);
          return true;
        }),
        { numRuns: 50 }
      );
    });

    test('container20GPArbitrary generates 20GP container', () => {
      fc.assert(
        fc.property(container20GPArbitrary(), (container) => {
          expect(container.typeId).toBe('20GP');
          expect(container.innerLength).toBe(5898);
          expect(container.innerWidth).toBe(2352);
          expect(container.innerHeight).toBe(2393);
          expect(container.maxWeight).toBe(21800);
          return true;
        }),
        { numRuns: 50 }
      );
    });

    test('container40GPArbitrary generates 40GP container', () => {
      fc.assert(
        fc.property(container40GPArbitrary(), (container) => {
          expect(container.typeId).toBe('40GP');
          expect(container.innerLength).toBe(12032);
          expect(container.innerWidth).toBe(2352);
          expect(container.innerHeight).toBe(2393);
          expect(container.maxWeight).toBe(26500);
          return true;
        }),
        { numRuns: 50 }
      );
    });

    test('specificContainerArbitrary generates specified container type', () => {
      const types = ['20GP', '40GP', '40HQ'];
      
      types.forEach(typeName => {
        fc.assert(
          fc.property(specificContainerArbitrary(typeName), (container) => {
            expect(container.typeId).toBe(typeName);
            
            const spec = STANDARD_CONTAINERS[typeName];
            expect(container.innerLength).toBe(spec.innerLength);
            expect(container.innerWidth).toBe(spec.innerWidth);
            expect(container.innerHeight).toBe(spec.innerHeight);
            
            return true;
          }),
          { numRuns: 20 }
        );
      });
    });

    test('specificContainerArbitrary throws error for invalid type', () => {
      expect(() => {
        specificContainerArbitrary('INVALID');
      }).toThrow('Unknown container type: INVALID');
    });

    test('customContainerArbitrary generates containers with valid dimensions', () => {
      fc.assert(
        fc.property(customContainerArbitrary(), (container) => {
          // Verify dimensions are within expected ranges
          expect(container.innerLength).toBeGreaterThanOrEqual(3000);
          expect(container.innerLength).toBeLessThanOrEqual(15000);
          expect(container.innerWidth).toBeGreaterThanOrEqual(2000);
          expect(container.innerWidth).toBeLessThanOrEqual(3000);
          expect(container.innerHeight).toBeGreaterThanOrEqual(2000);
          expect(container.innerHeight).toBeLessThanOrEqual(3000);
          expect(container.maxWeight).toBeGreaterThanOrEqual(15000);
          expect(container.maxWeight).toBeLessThanOrEqual(30000);
          
          // Verify required fields exist
          expect(container.typeId).toBeDefined();
          expect(container.name).toBeDefined();
          
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Integration Tests', () => {
    test('generated cargo can be validated successfully', () => {
      fc.assert(
        fc.property(cargoArbitrary(), (cargo) => {
          // Should not throw validation error
          expect(() => cargo.validate()).not.toThrow();
          return true;
        }),
        { numRuns: 100 }
      );
    });

    test('generated cargo has valid volume calculation', () => {
      fc.assert(
        fc.property(cargoArbitrary(), (cargo) => {
          const volume = cargo.getVolume();
          expect(volume).toBe(cargo.length * cargo.width * cargo.height);
          expect(volume).toBeGreaterThan(0);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    test('generated container has valid volume calculation', () => {
      fc.assert(
        fc.property(containerArbitrary(), (container) => {
          const volume = container.getVolume();
          expect(volume).toBe(container.innerLength * container.innerWidth * container.innerHeight);
          expect(volume).toBeGreaterThan(0);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    test('cargo type classification works correctly', () => {
      fc.assert(
        fc.property(cargoArbitrary(), (cargo) => {
          const type = cargo.getCargoType();
          
          if (cargo.isFragile()) {
            expect(type).toBe('fragile');
          } else if (cargo.isHeavy()) {
            expect(type).toBe('heavy');
          } else {
            expect(type).toBe('normal');
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    test('cargoListArbitrary can generate empty lists when minLength is 0', () => {
      fc.assert(
        fc.property(cargoListArbitrary(0, 5), (cargoList) => {
          expect(cargoList.length).toBeGreaterThanOrEqual(0);
          expect(cargoList.length).toBeLessThanOrEqual(5);
          return true;
        }),
        { numRuns: 50 }
      );
    });

    test('cargoListArbitrary can generate single-item lists', () => {
      fc.assert(
        fc.property(cargoListArbitrary(1, 1), (cargoList) => {
          expect(cargoList.length).toBe(1);
          return true;
        }),
        { numRuns: 50 }
      );
    });

    test('cargo with quantity 1 does not need expansion', () => {
      fc.assert(
        fc.property(cargoArbitrary(), (cargo) => {
          if (cargo.quantity === 1) {
            expect(cargo.getTotalVolume()).toBe(cargo.getVolume());
            expect(cargo.getTotalWeight()).toBe(cargo.weight);
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
