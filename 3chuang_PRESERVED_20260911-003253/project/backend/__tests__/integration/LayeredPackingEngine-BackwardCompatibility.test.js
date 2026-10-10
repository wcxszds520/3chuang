/**
 * LayeredPackingEngine Backward Compatibility Integration Tests
 * 
 * Feature: layered-packing-70-percent-optimization
 * Task: 9.4 Verify backward compatibility
 * 
 * Tests backward compatibility with:
 * 1. Backend routes API contract
 * 2. Input/output format compatibility
 * 3. Miniprogram integration expectations
 * 
 * Validates:
 * - Property 18: API Compatibility
 * - Requirement 7.1: Accept same input format
 * - Requirement 7.2: Return same output structure
 * - Requirement 7.5: Maintain existing API contract
 */

const LayeredPackingEngine = require('../../services/LayeredPackingEngine');
const Cargo = require('../../models/Cargo');
const ContainerType = require('../../models/ContainerType');

describe('LayeredPackingEngine - Backward Compatibility', () => {
  let engine;
  let testCargo;
  let container40HQ;

  beforeEach(() => {
    engine = new LayeredPackingEngine();

    // Standard 40HQ container matching database schema
    container40HQ = new ContainerType({
      typeId: '40HQ',
      name: '40英尺高柜',
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2698,
      maxWeight: 26680,
      description: '40英尺高柜集装箱'
    });

    // Test cargo matching database schema
    testCargo = [
      new Cargo({
        cargoId: 'test_cargo_1',
        name: '测试货物1',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false
      }),
      new Cargo({
        cargoId: 'test_cargo_2',
        name: '测试货物2',
        length: 500,
        width: 400,
        height: 600,
        weight: 8,
        quantity: 5,
        stackable: true,
        maxStackLayers: 2,
        canInvert: false,
        canLayFlat: false
      })
    ];
  });

  /**
   * Test 1: Input Format Compatibility (Requirement 7.1)
   * Verify LayeredPackingEngine accepts the same input format as current implementation
   */
  describe('1. Input Format Compatibility', () => {
    test('Should accept cargoList array and containerType object', async () => {
      // This is the standard input format used by backend routes
      expect(() => {
        engine.generatePackingPlan(testCargo, container40HQ);
      }).not.toThrow();
    });

    test('Should accept Cargo model instances', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan).toBeDefined();
      expect(plan.loadedCargo).toBeDefined();
    });

    test('Should accept ContainerType model instance', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan).toBeDefined();
      expect(plan.loadedCargo).toBeDefined();
    });

    test('Should handle cargo with all required fields', async () => {
      const cargo = new Cargo({
        cargoId: 'test_id',
        name: 'Test Item',
        length: 100,
        width: 100,
        height: 100,
        weight: 1,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false
      });

      const plan = await engine.generatePackingPlan([cargo], container40HQ);
      
      expect(plan).toBeDefined();
      expect(plan.loadedCargo).toBeDefined();
    });
  });

  /**
   * Test 2: Output Structure Compatibility (Requirement 7.2, Property 18)
   * Verify LayeredPackingEngine returns the same output structure
   */
  describe('2. Output Structure Compatibility', () => {
    test('Should return object with loadedCargo array', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan).toHaveProperty('loadedCargo');
      expect(Array.isArray(plan.loadedCargo)).toBe(true);
    });

    test('Should return object with unloadedCargo array', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan).toHaveProperty('unloadedCargo');
      expect(Array.isArray(plan.unloadedCargo)).toBe(true);
    });

    test('Should return object with spaceUtilization number', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan).toHaveProperty('spaceUtilization');
      expect(typeof plan.spaceUtilization).toBe('number');
      expect(plan.spaceUtilization).toBeGreaterThanOrEqual(0);
      expect(plan.spaceUtilization).toBeLessThanOrEqual(100);
    });

    test('Should return object with totalWeight number', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan).toHaveProperty('totalWeight');
      expect(typeof plan.totalWeight).toBe('number');
      expect(plan.totalWeight).toBeGreaterThanOrEqual(0);
    });

    test('Should return object with visualizationData', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan).toHaveProperty('visualizationData');
      expect(typeof plan.visualizationData).toBe('object');
    });

    test('Should return object with compliance data', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan).toHaveProperty('compliance');
      expect(typeof plan.compliance).toBe('object');
    });

    test('Should match expected output structure exactly', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      // Verify all required top-level properties exist
      const requiredProperties = [
        'loadedCargo',
        'unloadedCargo',
        'spaceUtilization',
        'totalWeight',
        'visualizationData',
        'compliance'
      ];

      requiredProperties.forEach(prop => {
        expect(plan).toHaveProperty(prop);
      });
    });
  });

  /**
   * Test 3: Loaded Cargo Item Structure
   * Verify each loaded cargo item has the expected structure
   */
  describe('3. Loaded Cargo Item Structure', () => {
    test('Each loaded cargo should have cargo reference', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      if (plan.loadedCargo.length > 0) {
        const item = plan.loadedCargo[0];
        expect(item).toHaveProperty('cargo');
        expect(typeof item.cargo).toBe('object');
      }
    });

    test('Each loaded cargo should have position coordinates', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      if (plan.loadedCargo.length > 0) {
        const item = plan.loadedCargo[0];
        expect(item).toHaveProperty('position');
        expect(item.position).toHaveProperty('x');
        expect(item.position).toHaveProperty('y');
        expect(item.position).toHaveProperty('z');
        expect(typeof item.position.x).toBe('number');
        expect(typeof item.position.y).toBe('number');
        expect(typeof item.position.z).toBe('number');
      }
    });

    test('Each loaded cargo should have rotation data', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      if (plan.loadedCargo.length > 0) {
        const item = plan.loadedCargo[0];
        expect(item).toHaveProperty('rotation');
        expect(typeof item.rotation).toBe('object');
        expect(item.rotation).toHaveProperty('length');
        expect(item.rotation).toHaveProperty('width');
        expect(item.rotation).toHaveProperty('height');
      }
    });

    test('Each loaded cargo should have loadingOrder', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      if (plan.loadedCargo.length > 0) {
        const item = plan.loadedCargo[0];
        expect(item).toHaveProperty('loadingOrder');
        expect(typeof item.loadingOrder).toBe('number');
        expect(item.loadingOrder).toBeGreaterThan(0);
      }
    });

    test('Each loaded cargo should have layer assignment', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      if (plan.loadedCargo.length > 0) {
        const item = plan.loadedCargo[0];
        expect(item).toHaveProperty('layer');
        expect(typeof item.layer).toBe('string');
      }
    });
  });

  /**
   * Test 4: Visualization Data Structure
   * Verify visualization data matches expected format for 3D rendering
   */
  describe('4. Visualization Data Structure', () => {
    test('Should include container dimensions', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan.visualizationData).toHaveProperty('container');
      expect(plan.visualizationData.container).toHaveProperty('length');
      expect(plan.visualizationData.container).toHaveProperty('width');
      expect(plan.visualizationData.container).toHaveProperty('height');
    });

    test('Should include cargo array with position and dimension data', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan.visualizationData).toHaveProperty('cargo');
      expect(Array.isArray(plan.visualizationData.cargo)).toBe(true);

      if (plan.visualizationData.cargo.length > 0) {
        const cargoItem = plan.visualizationData.cargo[0];
        expect(cargoItem).toHaveProperty('position');
        expect(cargoItem).toHaveProperty('dimensions');
        expect(cargoItem.position).toHaveProperty('x');
        expect(cargoItem.position).toHaveProperty('y');
        expect(cargoItem.position).toHaveProperty('z');
        expect(cargoItem.dimensions).toHaveProperty('length');
        expect(cargoItem.dimensions).toHaveProperty('width');
        expect(cargoItem.dimensions).toHaveProperty('height');
      }
    });

    test('Should include centerOfGravity data', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan.visualizationData).toHaveProperty('centerOfGravity');
      expect(plan.visualizationData.centerOfGravity).toHaveProperty('x');
      expect(plan.visualizationData.centerOfGravity).toHaveProperty('y');
      expect(plan.visualizationData.centerOfGravity).toHaveProperty('z');
    });

    test('Should include loadDistribution data', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      expect(plan.visualizationData).toHaveProperty('loadDistribution');
      expect(typeof plan.visualizationData.loadDistribution).toBe('object');
    });

    test('Should be JSON serializable', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      // Should not throw when serializing
      expect(() => {
        JSON.stringify(plan.visualizationData);
      }).not.toThrow();

      // Should be able to parse back
      const serialized = JSON.stringify(plan.visualizationData);
      const parsed = JSON.parse(serialized);
      
      expect(parsed).toHaveProperty('container');
      expect(parsed).toHaveProperty('cargo');
    });
  });

  /**
   * Test 5: Backend Route Integration Compatibility
   * Verify LayeredPackingEngine can be used as drop-in replacement in routes
   */
  describe('5. Backend Route Integration', () => {
    test('Should work with route input format (cargo array from database)', async () => {
      // Simulate cargo data from database query
      const dbCargo = testCargo.map(c => new Cargo({
        cargoId: c.cargoId,
        name: c.name,
        length: c.length,
        width: c.width,
        height: c.height,
        weight: c.weight,
        quantity: c.quantity,
        stackable: c.stackable,
        maxStackLayers: c.maxStackLayers,
        canInvert: c.canInvert,
        canLayFlat: c.canLayFlat
      }));

      const plan = await engine.generatePackingPlan(dbCargo, container40HQ);
      
      expect(plan).toBeDefined();
      expect(plan.loadedCargo).toBeDefined();
      expect(plan.spaceUtilization).toBeGreaterThanOrEqual(0);
    });

    test('Should work with route input format (cargo array from request body)', async () => {
      // Simulate cargo data from miniprogram request body
      const requestCargo = testCargo.map(c => new Cargo({
        cargoId: c.cargoId || `cargo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: c.name,
        length: c.length,
        width: c.width,
        height: c.height,
        weight: c.weight,
        quantity: c.quantity,
        stackable: Boolean(c.stackable),
        maxStackLayers: c.maxStackLayers || 3,
        canInvert: Boolean(c.canInvert),
        canLayFlat: Boolean(c.canLayFlat)
      }));

      const plan = await engine.generatePackingPlan(requestCargo, container40HQ);
      
      expect(plan).toBeDefined();
      expect(plan.loadedCargo).toBeDefined();
    });

    test('Should return data compatible with PackingPlan model', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      // Verify structure matches what PackingPlan.toJSON() expects
      expect(plan).toHaveProperty('loadedCargo');
      expect(plan).toHaveProperty('unloadedCargo');
      expect(plan).toHaveProperty('spaceUtilization');
      expect(plan).toHaveProperty('totalWeight');
      
      // Should be serializable for database storage
      expect(() => {
        JSON.stringify(plan);
      }).not.toThrow();
    });
  });

  /**
   * Test 6: Miniprogram Integration Compatibility
   * Verify output format matches miniprogram expectations
   */
  describe('6. Miniprogram Integration', () => {
    test('Should provide visualization data for 3D rendering', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      // Miniprogram expects visualizationData with specific structure
      expect(plan.visualizationData).toBeDefined();
      expect(plan.visualizationData.container).toBeDefined();
      expect(plan.visualizationData.cargo).toBeDefined();
      expect(Array.isArray(plan.visualizationData.cargo)).toBe(true);
    });

    test('Should provide summary statistics for display', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      // Miniprogram displays these statistics
      expect(plan.spaceUtilization).toBeDefined();
      expect(typeof plan.spaceUtilization).toBe('number');
      expect(plan.totalWeight).toBeDefined();
      expect(typeof plan.totalWeight).toBe('number');
    });

    test('Should provide loaded/unloaded cargo counts', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      // Miniprogram shows loading statistics
      expect(Array.isArray(plan.loadedCargo)).toBe(true);
      expect(Array.isArray(plan.unloadedCargo)).toBe(true);
      
      const loadedCount = plan.loadedCargo.length;
      const unloadedCount = plan.unloadedCargo.length;
      
      expect(loadedCount).toBeGreaterThanOrEqual(0);
      expect(unloadedCount).toBeGreaterThanOrEqual(0);
    });

    test('Should provide cargo colors for visualization', async () => {
      const plan = await engine.generatePackingPlan(testCargo, container40HQ);
      
      if (plan.visualizationData.cargo.length > 0) {
        const cargoItem = plan.visualizationData.cargo[0];
        // Color should be provided for 3D rendering
        expect(cargoItem).toHaveProperty('color');
      }
    });
  });

  /**
   * Test 7: Error Handling Compatibility
   * Verify error handling matches expected behavior
   */
  describe('7. Error Handling', () => {
    test('Should handle empty cargo list gracefully', async () => {
      const plan = await engine.generatePackingPlan([], container40HQ);
      
      expect(plan).toBeDefined();
      expect(plan.loadedCargo).toEqual([]);
      expect(plan.spaceUtilization).toBe(0);
    });

    test('Should handle cargo that exceeds container dimensions', async () => {
      const oversizedCargo = [
        new Cargo({
          cargoId: 'oversized',
          name: 'Oversized Item',
          length: 15000, // Exceeds container length
          width: 3000,   // Exceeds container width
          height: 3000,  // Exceeds container height
          weight: 1000,
          quantity: 1,
          stackable: false,
          maxStackLayers: 1,
          canInvert: false,
          canLayFlat: false
        })
      ];

      const plan = await engine.generatePackingPlan(oversizedCargo, container40HQ);
      
      expect(plan).toBeDefined();
      expect(plan.unloadedCargo.length).toBeGreaterThan(0);
    });

    test('Should handle cargo that exceeds weight limit', async () => {
      const heavyCargo = [
        new Cargo({
          cargoId: 'heavy',
          name: 'Heavy Item',
          length: 100,
          width: 100,
          height: 100,
          weight: 30000, // Exceeds container max weight
          quantity: 1,
          stackable: false,
          maxStackLayers: 1,
          canInvert: false,
          canLayFlat: false
        })
      ];

      const plan = await engine.generatePackingPlan(heavyCargo, container40HQ);
      
      expect(plan).toBeDefined();
      expect(plan.totalWeight).toBeLessThanOrEqual(container40HQ.maxWeight);
    });
  });

  /**
   * Test 8: Performance Compatibility
   * Verify performance meets route expectations
   */
  describe('8. Performance', () => {
    test('Should complete within reasonable time for typical cargo set', async () => {
      const startTime = Date.now();
      
      await engine.generatePackingPlan(testCargo, container40HQ);
      
      const endTime = Date.now();
      const executionTime = (endTime - startTime) / 1000;
      
      // Backend routes expect completion within 30 seconds
      expect(executionTime).toBeLessThan(30);
    }, 35000);

    test('Should return synchronously or as Promise', async () => {
      const result = engine.generatePackingPlan(testCargo, container40HQ);
      
      // Should be either a plan object or a Promise
      expect(result).toBeDefined();
      
      // If it's a Promise, it should resolve
      if (result instanceof Promise) {
        const plan = await result;
        expect(plan).toBeDefined();
        expect(plan.loadedCargo).toBeDefined();
      } else {
        // If synchronous, should have expected structure
        expect(result.loadedCargo).toBeDefined();
      }
    });
  });
});
