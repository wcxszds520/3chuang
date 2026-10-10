/**
 * Integration Test: Insufficient Space Scenario
 * 
 * This test validates that the SimplePackingEngine correctly handles
 * scenarios where cargo volume exceeds container capacity.
 * 
 * Spec: 3d-space-splitting-algorithm-implementation
 * Task: 7.3 Write integration test for insufficient space scenario
 * 
 * Test Scenario:
 * - Cargo volume exceeds container volume
 * - Some cargo must be marked as unloaded
 * 
 * Validation Criteria:
 * - Some cargo marked as unloaded
 * - Loaded cargo has no collisions
 * - Unloaded cargo has reason 'insufficient_space'
 * - All loaded cargo within container boundaries
 * 
 * Requirements: 4.6, 10.5
 */

const SimplePackingEngine = require('../../services/SimplePackingEngine');
const ContainerType = require('../../models/ContainerType');
const Cargo = require('../../models/Cargo');
const { 
  noCollisions, 
  allWithinBoundaries, 
  calculateSpaceUtilization,
  isCoordinateSystemValid 
} = require('../setup/test-utilities');

describe('Integration Test: Insufficient Space Scenario', () => {
  let engine;
  let container20GP;

  beforeEach(() => {
    engine = new SimplePackingEngine();
    
    // Use 20GP container (smallest standard container) to make it easier to exceed capacity
    // Dimensions: 5898mm (L) x 2352mm (W) x 2393mm (H)
    // Volume: ~33.2 cubic meters
    container20GP = new ContainerType({
      typeId: '20GP',
      name: '20英尺标准柜',
      innerLength: 5898,
      innerWidth: 2352,
      innerHeight: 2393,
      maxWeight: 21700,
      description: '适用于普通货物'
    });
  });

  test('should mark some cargo as unloaded when volume exceeds container capacity', async () => {
    // Create cargo list that significantly exceeds container capacity
    // Container 20GP volume: 5898 x 2352 x 2393 = ~33,200,000 cubic mm
    // 
    // Strategy: Create 100 large items with total volume ~50,000,000 cubic mm
    // Each item: 800mm x 700mm x 900mm = 504,000 cubic mm
    // Total: 100 x 504,000 = 50,400,000 cubic mm (152% of container volume)
    
    const cargoList = [];
    const itemCount = 100;
    
    for (let i = 1; i <= itemCount; i++) {
      cargoList.push(new Cargo({
        cargoId: `large-${i}`,
        name: `大型货物-${i}`,
        length: 800,
        width: 700,
        height: 900,
        weight: 15.0, // < 20kg to avoid ground constraint
        quantity: 1,
        stackable: true,
        maxStackLayers: 5,
        canInvert: true,
        canLayFlat: true,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 1
      }));
    }

    // Calculate expected volumes
    const singleItemVolume = 800 * 700 * 900; // 504,000 cubic mm
    const totalCargoVolume = singleItemVolume * itemCount; // 50,400,000 cubic mm
    const containerVolume = container20GP.innerLength * container20GP.innerWidth * container20GP.innerHeight;
    const volumeRatio = totalCargoVolume / containerVolume;

    console.log('\n========== Insufficient Space Test Setup ==========');
    console.log(`Container volume: ${(containerVolume / 1000000).toFixed(2)} cubic meters`);
    console.log(`Total cargo volume: ${(totalCargoVolume / 1000000).toFixed(2)} cubic meters`);
    console.log(`Volume ratio: ${(volumeRatio * 100).toFixed(1)}% (cargo exceeds container by ${((volumeRatio - 1) * 100).toFixed(1)}%)`);

    // Generate packing plan
    const startTime = Date.now();
    const result = await engine.generatePackingPlan(cargoList, container20GP);
    const executionTime = Date.now() - startTime;

    // ========== Validation 1: Basic Result Structure ==========
    expect(result).toBeDefined();
    expect(result.loadedCargo).toBeDefined();
    expect(result.unloadedCargo).toBeDefined();
    expect(Array.isArray(result.loadedCargo)).toBe(true);
    expect(Array.isArray(result.unloadedCargo)).toBe(true);

    console.log('\n========== Insufficient Space Test Results ==========');
    console.log(`Total cargo items: ${cargoList.length}`);
    console.log(`Loaded cargo: ${result.loadedCargo.length}`);
    console.log(`Unloaded cargo: ${result.unloadedCargo.length}`);
    console.log(`Execution time: ${executionTime}ms`);

    // ========== Validation 2: Some Cargo Marked as Unloaded ==========
    // Since cargo volume exceeds container volume, some items MUST be unloaded
    expect(result.unloadedCargo.length).toBeGreaterThan(0);
    console.log(`\n✓ Some cargo marked as unloaded (${result.unloadedCargo.length} items)`);

    // ========== Validation 3: Unloaded Cargo Has Correct Reason ==========
    // All unloaded cargo should have reason 'insufficient_space'
    result.unloadedCargo.forEach((unloadedItem, index) => {
      expect(unloadedItem).toHaveProperty('cargo');
      expect(unloadedItem).toHaveProperty('reason');
      expect(unloadedItem.reason).toBe('insufficient_space');
    });
    console.log(`✓ All unloaded cargo has reason 'insufficient_space'`);

    // ========== Validation 4: Loaded Cargo Has No Collisions ==========
    const hasNoCollisions = noCollisions(result.loadedCargo);
    expect(hasNoCollisions).toBe(true);
    console.log(`✓ No collisions detected between loaded cargo items`);

    // ========== Validation 5: All Loaded Cargo Within Container Boundaries ==========
    const withinBoundaries = allWithinBoundaries(result.loadedCargo, container20GP);
    expect(withinBoundaries).toBe(true);
    console.log(`✓ All loaded cargo within container boundaries`);

    // ========== Validation 6: Coordinate System Correctness ==========
    const coordinateSystemValid = isCoordinateSystemValid(result.loadedCargo, container20GP);
    expect(coordinateSystemValid).toBe(true);
    console.log(`✓ Coordinate system correctly applied (X=Length, Y=Height, Z=Width)`);

    // ========== Validation 7: Space Utilization Analysis ==========
    const utilization = calculateSpaceUtilization(result.loadedCargo, container20GP);
    console.log(`\nSpace utilization: ${utilization.toFixed(2)}%`);
    
    // With insufficient space scenario, we expect high utilization (container is full)
    // The algorithm should pack as much as possible before running out of space
    expect(utilization).toBeGreaterThan(0);
    console.log(`✓ Container utilized: ${utilization.toFixed(2)}%`);

    // ========== Validation 8: Loaded vs Unloaded Ratio ==========
    const loadedRatio = result.loadedCargo.length / cargoList.length;
    const unloadedRatio = result.unloadedCargo.length / cargoList.length;
    
    console.log(`\n========== Load Distribution ==========`);
    console.log(`Loaded: ${result.loadedCargo.length} items (${(loadedRatio * 100).toFixed(1)}%)`);
    console.log(`Unloaded: ${result.unloadedCargo.length} items (${(unloadedRatio * 100).toFixed(1)}%)`);
    
    // Since cargo volume is 152% of container, we expect roughly 35-70% to be loaded
    // (accounting for packing inefficiency)
    expect(loadedRatio).toBeGreaterThan(0.3);
    expect(loadedRatio).toBeLessThan(0.8);
    console.log(`✓ Reasonable load distribution given volume constraints`);

    // ========== Validation 9: Unloaded Cargo Structure ==========
    // Verify unloaded cargo has proper structure
    result.unloadedCargo.forEach((unloadedItem, index) => {
      expect(unloadedItem.cargo).toBeDefined();
      expect(unloadedItem.cargo.cargoId).toBeDefined();
      expect(unloadedItem.cargo.name).toBeDefined();
      expect(unloadedItem.reason).toBe('insufficient_space');
    });
    console.log(`✓ Unloaded cargo has proper structure`);

    // ========== Validation 10: Performance Check ==========
    // 100 items should complete within 5 seconds (5000ms)
    expect(executionTime).toBeLessThan(5000);
    console.log(`\n✓ Performance: ${executionTime}ms (target: < 5000ms)`);

    console.log('\n========== All Validations Passed ==========\n');
  }, 30000); // 30 second timeout

  test('should handle edge case: single item too large for container', async () => {
    // Create a single cargo item that is too large to fit in the container
    // Container 20GP: 5898mm (L) x 2352mm (W) x 2393mm (H)
    // Create item: 6000mm x 2000mm x 2000mm (length exceeds container)
    
    const cargoList = [
      new Cargo({
        cargoId: 'oversized-1',
        name: '超大货物',
        length: 6000, // Exceeds container innerLength (5898mm)
        width: 2000,
        height: 2000,
        weight: 50.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 1
      })
    ];

    const result = await engine.generatePackingPlan(cargoList, container20GP);

    console.log('\n========== Oversized Item Test ==========');
    console.log(`Loaded: ${result.loadedCargo.length}`);
    console.log(`Unloaded: ${result.unloadedCargo.length}`);

    // Item should be unloaded
    expect(result.unloadedCargo.length).toBe(1);
    expect(result.unloadedCargo[0].reason).toBe('insufficient_space');
    expect(result.loadedCargo.length).toBe(0);
    
    console.log(`✓ Oversized item correctly marked as unloaded`);
  });

  test('should handle edge case: all items fit exactly', async () => {
    // Create cargo that fits exactly in the container (no unloaded items)
    // Container 20GP: 5898mm (L) x 2352mm (W) x 2393mm (H)
    // Create small items that fit comfortably
    
    const cargoList = [];
    const itemCount = 20; // Small number of small items
    
    for (let i = 1; i <= itemCount; i++) {
      cargoList.push(new Cargo({
        cargoId: `small-${i}`,
        name: `小型货物-${i}`,
        length: 500,
        width: 400,
        height: 400,
        weight: 10.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 10,
        canInvert: true,
        canLayFlat: true,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 1
      }));
    }

    const result = await engine.generatePackingPlan(cargoList, container20GP);

    console.log('\n========== All Items Fit Test ==========');
    console.log(`Loaded: ${result.loadedCargo.length}`);
    console.log(`Unloaded: ${result.unloadedCargo.length}`);

    // All items should be loaded
    expect(result.loadedCargo.length).toBe(itemCount);
    expect(result.unloadedCargo.length).toBe(0);
    
    // No collisions
    expect(noCollisions(result.loadedCargo)).toBe(true);
    
    // All within boundaries
    expect(allWithinBoundaries(result.loadedCargo, container20GP)).toBe(true);
    
    console.log(`✓ All items successfully loaded with no unloaded cargo`);
  });

  test('should handle mixed scenario: some fit, some do not', async () => {
    // Create a mix of items where some fit and some don't
    // Start with items that fit, then add items that exceed capacity
    
    const cargoList = [];
    
    // 30 medium items that should fit
    for (let i = 1; i <= 30; i++) {
      cargoList.push(new Cargo({
        cargoId: `medium-${i}`,
        name: `中型货物-${i}`,
        length: 600,
        width: 500,
        height: 500,
        weight: 12.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 5,
        canInvert: true,
        canLayFlat: true,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 2
      }));
    }
    
    // 50 large items that will exceed capacity
    for (let i = 1; i <= 50; i++) {
      cargoList.push(new Cargo({
        cargoId: `large-${i}`,
        name: `大型货物-${i}`,
        length: 900,
        width: 800,
        height: 800,
        weight: 18.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: true,
        canLayFlat: true,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 1
      }));
    }

    const result = await engine.generatePackingPlan(cargoList, container20GP);

    console.log('\n========== Mixed Scenario Test ==========');
    console.log(`Total items: ${cargoList.length}`);
    console.log(`Loaded: ${result.loadedCargo.length}`);
    console.log(`Unloaded: ${result.unloadedCargo.length}`);

    // Some items should be loaded, some unloaded
    expect(result.loadedCargo.length).toBeGreaterThan(0);
    expect(result.unloadedCargo.length).toBeGreaterThan(0);
    
    // All unloaded items have correct reason
    result.unloadedCargo.forEach(item => {
      expect(item.reason).toBe('insufficient_space');
    });
    
    // No collisions among loaded items
    expect(noCollisions(result.loadedCargo)).toBe(true);
    
    // All loaded items within boundaries
    expect(allWithinBoundaries(result.loadedCargo, container20GP)).toBe(true);
    
    const utilization = calculateSpaceUtilization(result.loadedCargo, container20GP);
    console.log(`Space utilization: ${utilization.toFixed(2)}%`);
    
    console.log(`✓ Mixed scenario handled correctly`);
  });

  test('should prioritize higher portSequence items when space is insufficient', async () => {
    // Create cargo with different portSequence values
    // When space runs out, lower priority items should be unloaded first
    
    const cargoList = [];
    
    // 20 high priority items (portSequence = 3)
    for (let i = 1; i <= 20; i++) {
      cargoList.push(new Cargo({
        cargoId: `priority-high-${i}`,
        name: `高优先级-${i}`,
        length: 700,
        width: 600,
        height: 600,
        weight: 15.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 5,
        canInvert: true,
        canLayFlat: true,
        fragile: false,
        eta: new Date('2024-05-01'),
        portSequence: 3 // High priority
      }));
    }
    
    // 40 medium priority items (portSequence = 2)
    for (let i = 1; i <= 40; i++) {
      cargoList.push(new Cargo({
        cargoId: `priority-medium-${i}`,
        name: `中优先级-${i}`,
        length: 700,
        width: 600,
        height: 600,
        weight: 15.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 5,
        canInvert: true,
        canLayFlat: true,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 2 // Medium priority
      }));
    }
    
    // 40 low priority items (portSequence = 1)
    for (let i = 1; i <= 40; i++) {
      cargoList.push(new Cargo({
        cargoId: `priority-low-${i}`,
        name: `低优先级-${i}`,
        length: 700,
        width: 600,
        height: 600,
        weight: 15.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 5,
        canInvert: true,
        canLayFlat: true,
        fragile: false,
        eta: new Date('2024-07-01'),
        portSequence: 1 // Low priority
      }));
    }

    const result = await engine.generatePackingPlan(cargoList, container20GP);

    console.log('\n========== Priority Test ==========');
    console.log(`Total items: ${cargoList.length}`);
    console.log(`Loaded: ${result.loadedCargo.length}`);
    console.log(`Unloaded: ${result.unloadedCargo.length}`);

    // Count loaded items by priority
    const highPriorityLoaded = result.loadedCargo.filter(item => 
      item.cargoId.startsWith('priority-high')
    ).length;
    
    const mediumPriorityLoaded = result.loadedCargo.filter(item => 
      item.cargoId.startsWith('priority-medium')
    ).length;
    
    const lowPriorityLoaded = result.loadedCargo.filter(item => 
      item.cargoId.startsWith('priority-low')
    ).length;

    console.log(`High priority loaded: ${highPriorityLoaded} / 20`);
    console.log(`Medium priority loaded: ${mediumPriorityLoaded} / 40`);
    console.log(`Low priority loaded: ${lowPriorityLoaded} / 40`);

    // High priority items should have higher load rate than low priority
    const highPriorityRate = highPriorityLoaded / 20;
    const lowPriorityRate = lowPriorityLoaded / 40;
    
    expect(highPriorityRate).toBeGreaterThanOrEqual(lowPriorityRate);
    
    // All unloaded items have correct reason
    result.unloadedCargo.forEach(item => {
      expect(item.reason).toBe('insufficient_space');
    });
    
    // No collisions
    expect(noCollisions(result.loadedCargo)).toBe(true);
    
    console.log(`✓ Higher priority items loaded preferentially`);
  });
});
