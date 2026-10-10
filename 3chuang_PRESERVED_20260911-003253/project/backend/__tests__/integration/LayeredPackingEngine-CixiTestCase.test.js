/**
 * Integration Test: LayeredPackingEngine - Cixi Test Case
 * 
 * Feature: layered-packing-70-percent-optimization
 * 
 * This test validates the complete optimization of LayeredPackingEngine
 * for the Cixi appliances test case (200 air fryers + 100 heaters + 80 fans).
 * 
 * Success Criteria:
 * - Space utilization ≥70%
 * - Loading rate = 100% for all item types
 * - Computation time <10 seconds
 * - Compatibility with existing test script
 * 
 * Validates: Requirements 5.1, 5.2, 7.3
 */

const Cargo = require('../../models/Cargo');
const ContainerType = require('../../models/ContainerType');
const LayeredPackingEngine = require('../../services/LayeredPackingEngine');

describe('LayeredPackingEngine - Cixi Test Case Integration', () => {
  let containerType;
  let cargoList;
  
  beforeEach(() => {
    // Setup 40HQ container (high cube container)
    containerType = new ContainerType({
      typeId: '40HQ',
      name: '40HQ高柜集装箱',
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2698,
      maxWeight: 26680
    });
    
    // Setup Cixi appliances cargo
    cargoList = [
      new Cargo({
        cargoId: 'air_fryer_001',
        name: '空气炸锅',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200,
        stackable: true,
        maxStackLayers: 4,
        canInvert: false,
        canLayFlat: false
      }),
      new Cargo({
        cargoId: 'heater_001',
        name: '取暖器',
        length: 500,
        width: 400,
        height: 600,
        weight: 8,
        quantity: 100,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false
      }),
      new Cargo({
        cargoId: 'fan_001',
        name: '电风扇',
        length: 400,
        width: 400,
        height: 1200,
        weight: 6,
        quantity: 80,
        stackable: false,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: true
      })
    ];
  });
  
  /**
   * Example 2: Cixi 70% Utilization Target
   * Validates: Requirement 5.1
   */
  test('Example 2: Should achieve ≥70% space utilization for Cixi test case', async () => {
    const engine = new LayeredPackingEngine();
    const plan = await engine.generatePackingPlan(cargoList, containerType);
    
    // Log results for debugging
    console.log('\n=== Cixi Test Case Results ===');
    console.log(`Space Utilization: ${plan.spaceUtilization.toFixed(2)}%`);
    console.log(`Total Weight: ${plan.totalWeight.toFixed(2)}kg / ${containerType.maxWeight}kg`);
    console.log(`Loaded Items: ${plan.loadedCargo.length}`);
    console.log(`Unloaded Items: ${plan.unloadedCargo.length}`);
    console.log(`Computation Time: ${plan.computationTime.toFixed(3)}s`);
    
    // Count by type
    const countByType = {};
    plan.loadedCargo.forEach(loaded => {
      const name = loaded.cargo.name;
      countByType[name] = (countByType[name] || 0) + 1;
    });
    
    console.log('\n=== Loading Rate by Type ===');
    console.log(`Air Fryers: ${countByType['空气炸锅'] || 0}/200 (${((countByType['空气炸锅'] || 0) / 200 * 100).toFixed(1)}%)`);
    console.log(`Heaters: ${countByType['取暖器'] || 0}/100 (${((countByType['取暖器'] || 0) / 100 * 100).toFixed(1)}%)`);
    console.log(`Fans: ${countByType['电风扇'] || 0}/80 (${((countByType['电风扇'] || 0) / 80 * 100).toFixed(1)}%)`);
    
    // Validate space utilization ≥70%
    expect(plan.spaceUtilization).toBeGreaterThanOrEqual(70);
  });
  
  /**
   * Example 3: Cixi 100% Loading Rate
   * Validates: Requirement 5.2
   */
  test('Example 3: Should achieve 100% loading rate for all item types', async () => {
    const engine = new LayeredPackingEngine();
    const plan = await engine.generatePackingPlan(cargoList, containerType);
    
    // Count loaded items by type
    const loadedByType = {
      '空气炸锅': 0,
      '取暖器': 0,
      '电风扇': 0
    };
    
    plan.loadedCargo.forEach(loaded => {
      const name = loaded.cargo.name;
      if (loadedByType.hasOwnProperty(name)) {
        loadedByType[name]++;
      }
    });
    
    // Expected quantities
    const expectedQuantities = {
      '空气炸锅': 200,
      '取暖器': 100,
      '电风扇': 80
    };
    
    // Validate 100% loading rate for each type
    expect(loadedByType['空气炸锅']).toBe(expectedQuantities['空气炸锅']);
    expect(loadedByType['取暖器']).toBe(expectedQuantities['取暖器']);
    expect(loadedByType['电风扇']).toBe(expectedQuantities['电风扇']);
    
    // Validate total count
    const totalLoaded = Object.values(loadedByType).reduce((sum, count) => sum + count, 0);
    const totalExpected = Object.values(expectedQuantities).reduce((sum, count) => sum + count, 0);
    expect(totalLoaded).toBe(totalExpected);
    expect(totalLoaded).toBe(380);
    
    // Validate no unloaded items
    expect(plan.unloadedCargo.length).toBe(0);
  });
  
  /**
   * Validates: Requirement 5.3
   */
  test('Should complete computation within 10 seconds', async () => {
    const engine = new LayeredPackingEngine();
    const startTime = Date.now();
    
    const plan = await engine.generatePackingPlan(cargoList, containerType);
    
    const endTime = Date.now();
    const computationTime = (endTime - startTime) / 1000;
    
    console.log(`\nComputation Time: ${computationTime.toFixed(3)}s`);
    
    // Validate computation time <10 seconds
    expect(computationTime).toBeLessThan(10);
    
    // Also check the plan's reported computation time
    expect(plan.computationTime).toBeLessThan(10);
  });
  
  /**
   * Validates: Requirement 5.4
   */
  test('Should respect weight constraints', async () => {
    const engine = new LayeredPackingEngine();
    const plan = await engine.generatePackingPlan(cargoList, containerType);
    
    // Calculate total weight
    const totalWeight = plan.loadedCargo.reduce((sum, loaded) => {
      return sum + loaded.cargo.weight;
    }, 0);
    
    console.log(`\nTotal Weight: ${totalWeight}kg / ${containerType.maxWeight}kg`);
    
    // Validate weight constraint
    expect(totalWeight).toBeLessThanOrEqual(containerType.maxWeight);
    expect(plan.totalWeight).toBeLessThanOrEqual(containerType.maxWeight);
  });
  
  /**
   * Validates: Requirement 5.5
   */
  test('Should respect stacking constraints', async () => {
    const engine = new LayeredPackingEngine();
    const plan = await engine.generatePackingPlan(cargoList, containerType);
    
    // Group items by position (x, y) to check stacking
    const stacksByPosition = {};
    
    plan.loadedCargo.forEach(loaded => {
      const key = `${loaded.position.x},${loaded.position.y}`;
      if (!stacksByPosition[key]) {
        stacksByPosition[key] = [];
      }
      stacksByPosition[key].push(loaded);
    });
    
    // Check each stack
    let maxStackViolations = 0;
    
    Object.entries(stacksByPosition).forEach(([position, stack]) => {
      // Group by cargo type within this stack
      const typeStacks = {};
      stack.forEach(item => {
        const name = item.cargo.name;
        if (!typeStacks[name]) {
          typeStacks[name] = [];
        }
        typeStacks[name].push(item);
      });
      
      // Check each type's stack limit
      Object.entries(typeStacks).forEach(([name, items]) => {
        const maxStackLayers = items[0].cargo.maxStackLayers;
        if (items.length > maxStackLayers) {
          maxStackViolations++;
          console.log(`Stack violation at ${position}: ${name} has ${items.length} layers (max: ${maxStackLayers})`);
        }
      });
    });
    
    expect(maxStackViolations).toBe(0);
  });
  
  /**
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4
   */
  test('Should generate complete 3D visualization data', async () => {
    const engine = new LayeredPackingEngine();
    const plan = await engine.generatePackingPlan(cargoList, containerType);
    
    // Validate visualization data exists
    expect(plan.visualizationData).toBeDefined();
    
    // Validate container data
    expect(plan.visualizationData.container).toBeDefined();
    expect(plan.visualizationData.container.length).toBe(containerType.innerLength);
    expect(plan.visualizationData.container.width).toBe(containerType.innerWidth);
    expect(plan.visualizationData.container.height).toBe(containerType.innerHeight);
    
    // Validate cargo data
    expect(plan.visualizationData.cargo).toBeDefined();
    expect(Array.isArray(plan.visualizationData.cargo)).toBe(true);
    expect(plan.visualizationData.cargo.length).toBe(plan.loadedCargo.length);
    
    // Validate each cargo item has position and dimension data
    plan.visualizationData.cargo.forEach((item, index) => {
      // Position data (x, y, z)
      expect(item.position).toBeDefined();
      expect(typeof item.position.x).toBe('number');
      expect(typeof item.position.y).toBe('number');
      expect(typeof item.position.z).toBe('number');
      
      // Dimension data (length, width, height)
      expect(item.dimensions).toBeDefined();
      expect(typeof item.dimensions.length).toBe('number');
      expect(typeof item.dimensions.width).toBe('number');
      expect(typeof item.dimensions.height).toBe('number');
      
      // Validate dimensions are positive
      expect(item.dimensions.length).toBeGreaterThan(0);
      expect(item.dimensions.width).toBeGreaterThan(0);
      expect(item.dimensions.height).toBeGreaterThan(0);
    });
    
    // Validate summary statistics
    expect(plan.visualizationData.spaceUtilization).toBeDefined();
    expect(typeof plan.visualizationData.spaceUtilization).toBe('number');
    expect(plan.visualizationData.totalWeight).toBeDefined();
    expect(typeof plan.visualizationData.totalWeight).toBe('number');
    
    // Validate center of gravity
    expect(plan.visualizationData.centerOfGravity).toBeDefined();
    expect(typeof plan.visualizationData.centerOfGravity.x).toBe('number');
    expect(typeof plan.visualizationData.centerOfGravity.y).toBe('number');
    expect(typeof plan.visualizationData.centerOfGravity.z).toBe('number');
    
    // Validate load distribution
    expect(plan.visualizationData.loadDistribution).toBeDefined();
    expect(typeof plan.visualizationData.loadDistribution.frontPercent).toBe('number');
    expect(typeof plan.visualizationData.loadDistribution.backPercent).toBe('number');
    expect(typeof plan.visualizationData.loadDistribution.leftPercent).toBe('number');
    expect(typeof plan.visualizationData.loadDistribution.rightPercent).toBe('number');
  });
  
  /**
   * Validates: Requirement 6.5
   */
  test('Should generate valid JSON visualization data', async () => {
    const engine = new LayeredPackingEngine();
    const plan = await engine.generatePackingPlan(cargoList, containerType);
    
    // Validate JSON serialization
    let jsonString;
    expect(() => {
      jsonString = JSON.stringify(plan.visualizationData);
    }).not.toThrow();
    
    // Validate JSON parsing
    let parsedData;
    expect(() => {
      parsedData = JSON.parse(jsonString);
    }).not.toThrow();
    
    // Validate structure after round-trip
    expect(parsedData.container).toBeDefined();
    expect(parsedData.cargo).toBeDefined();
    expect(Array.isArray(parsedData.cargo)).toBe(true);
    expect(parsedData.centerOfGravity).toBeDefined();
    expect(parsedData.loadDistribution).toBeDefined();
  });
  
  /**
   * Example 5: Test Script Compatibility
   * Validates: Requirement 7.3
   */
  test('Example 5: Should be compatible with existing test script', async () => {
    // This test verifies that the engine can be invoked the same way
    // as in backend/scripts/test-layered-packing.js
    
    const engine = new LayeredPackingEngine();
    
    // Call generatePackingPlan with same parameters as test script
    let plan;
    expect(async () => {
      plan = await engine.generatePackingPlan(cargoList, containerType);
    }).not.toThrow();
    
    // Validate return structure matches expected format
    expect(plan).toBeDefined();
    expect(plan.loadedCargo).toBeDefined();
    expect(Array.isArray(plan.loadedCargo)).toBe(true);
    expect(plan.unloadedCargo).toBeDefined();
    expect(Array.isArray(plan.unloadedCargo)).toBe(true);
    expect(typeof plan.spaceUtilization).toBe('number');
    expect(typeof plan.totalWeight).toBe('number');
    expect(plan.visualizationData).toBeDefined();
    expect(plan.compliance).toBeDefined();
    expect(plan.centerOfGravity).toBeDefined();
    expect(plan.loadDistribution).toBeDefined();
    expect(typeof plan.computationTime).toBe('number');
  });
  
  /**
   * Validates: Requirements 7.1, 7.2, 7.5
   */
  test('Should maintain API compatibility', async () => {
    const engine = new LayeredPackingEngine();
    
    // Test input format compatibility
    expect(() => {
      engine.generatePackingPlan(cargoList, containerType);
    }).not.toThrow();
    
    const plan = await engine.generatePackingPlan(cargoList, containerType);
    
    // Test output structure compatibility
    expect(plan).toHaveProperty('loadedCargo');
    expect(plan).toHaveProperty('unloadedCargo');
    expect(plan).toHaveProperty('spaceUtilization');
    expect(plan).toHaveProperty('totalWeight');
    expect(plan).toHaveProperty('visualizationData');
    expect(plan).toHaveProperty('compliance');
    expect(plan).toHaveProperty('centerOfGravity');
    expect(plan).toHaveProperty('loadDistribution');
    expect(plan).toHaveProperty('computationTime');
    
    // Validate types
    expect(Array.isArray(plan.loadedCargo)).toBe(true);
    expect(Array.isArray(plan.unloadedCargo)).toBe(true);
    expect(typeof plan.spaceUtilization).toBe('number');
    expect(typeof plan.totalWeight).toBe('number');
    expect(typeof plan.visualizationData).toBe('object');
    expect(typeof plan.compliance).toBe('object');
    expect(typeof plan.centerOfGravity).toBe('object');
    expect(typeof plan.loadDistribution).toBe('object');
    expect(typeof plan.computationTime).toBe('number');
  });
  
  /**
   * Validates: Requirement 8.3
   */
  test('Should produce deterministic results', async () => {
    const engine1 = new LayeredPackingEngine();
    const engine2 = new LayeredPackingEngine();
    
    // Run packing twice with same input
    const plan1 = await engine1.generatePackingPlan(cargoList, containerType);
    const plan2 = await engine2.generatePackingPlan(cargoList, containerType);
    
    // Validate same number of items loaded
    expect(plan1.loadedCargo.length).toBe(plan2.loadedCargo.length);
    expect(plan1.unloadedCargo.length).toBe(plan2.unloadedCargo.length);
    
    // Validate same space utilization
    expect(plan1.spaceUtilization).toBe(plan2.spaceUtilization);
    
    // Validate same total weight
    expect(plan1.totalWeight).toBe(plan2.totalWeight);
    
    // Validate same item positions (check first 10 items)
    const itemsToCheck = Math.min(10, plan1.loadedCargo.length);
    for (let i = 0; i < itemsToCheck; i++) {
      expect(plan1.loadedCargo[i].position.x).toBe(plan2.loadedCargo[i].position.x);
      expect(plan1.loadedCargo[i].position.y).toBe(plan2.loadedCargo[i].position.y);
      expect(plan1.loadedCargo[i].position.z).toBe(plan2.loadedCargo[i].position.z);
      expect(plan1.loadedCargo[i].rotation.length).toBe(plan2.loadedCargo[i].rotation.length);
      expect(plan1.loadedCargo[i].rotation.width).toBe(plan2.loadedCargo[i].rotation.width);
      expect(plan1.loadedCargo[i].rotation.height).toBe(plan2.loadedCargo[i].rotation.height);
    }
  });
  
  /**
   * Comprehensive integration test combining all requirements
   */
  test('Comprehensive: Should meet all optimization targets', async () => {
    const engine = new LayeredPackingEngine();
    const plan = await engine.generatePackingPlan(cargoList, containerType);
    
    // Count by type
    const loadedByType = {
      '空气炸锅': 0,
      '取暖器': 0,
      '电风扇': 0
    };
    
    plan.loadedCargo.forEach(loaded => {
      const name = loaded.cargo.name;
      if (loadedByType.hasOwnProperty(name)) {
        loadedByType[name]++;
      }
    });
    
    console.log('\n=== Comprehensive Test Results ===');
    console.log(`Space Utilization: ${plan.spaceUtilization.toFixed(2)}% (target: ≥70%)`);
    console.log(`Loading Rate: ${(plan.loadedCargo.length / 380 * 100).toFixed(1)}% (target: 100%)`);
    console.log(`Computation Time: ${plan.computationTime.toFixed(3)}s (target: <10s)`);
    console.log(`Total Weight: ${plan.totalWeight.toFixed(2)}kg / ${containerType.maxWeight}kg`);
    console.log('\nLoaded by Type:');
    console.log(`  Air Fryers: ${loadedByType['空气炸锅']}/200`);
    console.log(`  Heaters: ${loadedByType['取暖器']}/100`);
    console.log(`  Fans: ${loadedByType['电风扇']}/80`);
    
    // All critical requirements
    expect(plan.spaceUtilization).toBeGreaterThanOrEqual(70); // Requirement 5.1
    expect(loadedByType['空气炸锅']).toBe(200); // Requirement 5.2
    expect(loadedByType['取暖器']).toBe(100); // Requirement 5.2
    expect(loadedByType['电风扇']).toBe(80); // Requirement 5.2
    expect(plan.computationTime).toBeLessThan(10); // Requirement 5.3
    expect(plan.totalWeight).toBeLessThanOrEqual(containerType.maxWeight); // Requirement 5.4
    expect(plan.unloadedCargo.length).toBe(0); // All items loaded
    
    // Output completeness
    expect(plan.visualizationData).toBeDefined();
    expect(plan.compliance).toBeDefined();
    expect(plan.centerOfGravity).toBeDefined();
    expect(plan.loadDistribution).toBeDefined();
    
    console.log('\n✅ All optimization targets met!');
  });
});
