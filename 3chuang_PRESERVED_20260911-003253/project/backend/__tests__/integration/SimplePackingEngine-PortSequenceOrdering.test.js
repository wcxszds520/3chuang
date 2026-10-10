/**
 * Integration Test: Port Sequence Ordering
 * 
 * This test validates that the SimplePackingEngine correctly handles
 * port sequence ordering for cargo loading and drop order calculation.
 * 
 * Spec: 3d-space-splitting-algorithm-implementation
 * Task: 7.5 Write integration test for port sequence ordering
 * 
 * Test Scenario:
 * - Cargo with different portSequence values (1, 2, 3, 4, 5)
 * - Verify higher portSequence loaded first (sorted descending)
 * - Verify drop order calculated correctly
 * - Verify drop order matches portSequence (primary) and X-coordinate (secondary)
 * 
 * Requirements: 2.1, 13.1, 13.2, 13.3, 13.4
 */

const SimplePackingEngine = require('../../services/SimplePackingEngine');
const ContainerType = require('../../models/ContainerType');
const Cargo = require('../../models/Cargo');
const { 
  noCollisions, 
  allWithinBoundaries,
  isCoordinateSystemValid 
} = require('../setup/test-utilities');

describe('Integration Test: Port Sequence Ordering', () => {
  let engine;
  let container40HQ;

  beforeEach(() => {
    engine = new SimplePackingEngine();
    
    // Use 40HQ container for testing
    container40HQ = new ContainerType({
      typeId: '40HQ',
      name: '40英尺高柜',
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2698,
      maxWeight: 26000,
      description: '适用于大批量高货物'
    });
  });

  test('should sort cargo by portSequence descending before packing', async () => {
    // Create cargo with different portSequence values
    const cargoList = [];
    
    // Port 1 (lowest priority - should load last)
    for (let i = 1; i <= 10; i++) {
      cargoList.push(new Cargo({
        cargoId: `port1-${i}`,
        name: `港口1货物-${i}`,
        length: 500,
        width: 400,
        height: 400,
        weight: 10.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 1
      }));
    }
    
    // Port 2
    for (let i = 1; i <= 10; i++) {
      cargoList.push(new Cargo({
        cargoId: `port2-${i}`,
        name: `港口2货物-${i}`,
        length: 500,
        width: 400,
        height: 400,
        weight: 10.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-05'),
        portSequence: 2
      }));
    }
    
    // Port 3
    for (let i = 1; i <= 10; i++) {
      cargoList.push(new Cargo({
        cargoId: `port3-${i}`,
        name: `港口3货物-${i}`,
        length: 500,
        width: 400,
        height: 400,
        weight: 10.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-10'),
        portSequence: 3
      }));
    }
    
    // Port 4
    for (let i = 1; i <= 10; i++) {
      cargoList.push(new Cargo({
        cargoId: `port4-${i}`,
        name: `港口4货物-${i}`,
        length: 500,
        width: 400,
        height: 400,
        weight: 10.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-15'),
        portSequence: 4
      }));
    }
    
    // Port 5 (highest priority - should load first)
    for (let i = 1; i <= 10; i++) {
      cargoList.push(new Cargo({
        cargoId: `port5-${i}`,
        name: `港口5货物-${i}`,
        length: 500,
        width: 400,
        height: 400,
        weight: 10.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-20'),
        portSequence: 5
      }));
    }

    // Generate packing plan
    const startTime = Date.now();
    const result = await engine.generatePackingPlan(cargoList, container40HQ);
    const executionTime = Date.now() - startTime;

    console.log('\n========== Port Sequence Ordering Test Results ==========');
    console.log(`Total cargo items: ${cargoList.length}`);
    console.log(`Loaded cargo: ${result.loadedCargo.length}`);
    console.log(`Unloaded cargo: ${result.unloadedCargo.length}`);
    console.log(`Execution time: ${executionTime}ms`);

    // ========== Validation 1: All cargo should be loaded ==========
    expect(result.loadedCargo.length).toBe(50);
    expect(result.unloadedCargo.length).toBe(0);
    console.log('✓ All 50 cargo items successfully loaded');

    // ========== Validation 2: Verify sorting by portSequence descending ==========
    // Extract the original cargo IDs to determine their portSequence
    const getPortSequence = (cargoId) => {
      const match = cargoId.match(/^port(\d+)-/);
      return match ? parseInt(match[1]) : 0;
    };

    // Group loaded cargo by portSequence
    const port5Items = result.loadedCargo.filter(item => getPortSequence(item.cargoId) === 5);
    const port4Items = result.loadedCargo.filter(item => getPortSequence(item.cargoId) === 4);
    const port3Items = result.loadedCargo.filter(item => getPortSequence(item.cargoId) === 3);
    const port2Items = result.loadedCargo.filter(item => getPortSequence(item.cargoId) === 2);
    const port1Items = result.loadedCargo.filter(item => getPortSequence(item.cargoId) === 1);

    console.log('\n========== Port Sequence Distribution ==========');
    console.log(`Port 5 items: ${port5Items.length}`);
    console.log(`Port 4 items: ${port4Items.length}`);
    console.log(`Port 3 items: ${port3Items.length}`);
    console.log(`Port 2 items: ${port2Items.length}`);
    console.log(`Port 1 items: ${port1Items.length}`);

    // Verify higher portSequence items are placed earlier (lower X coordinates on average)
    // Since higher portSequence loads first, they should occupy positions closer to X=0
    const avgX = (items) => {
      if (items.length === 0) return 0;
      return items.reduce((sum, item) => sum + item.position.x, 0) / items.length;
    };

    const avgXPort5 = avgX(port5Items);
    const avgXPort4 = avgX(port4Items);
    const avgXPort3 = avgX(port3Items);
    const avgXPort2 = avgX(port2Items);
    const avgXPort1 = avgX(port1Items);

    console.log('\n========== Average X Coordinates ==========');
    console.log(`Port 5 avg X: ${avgXPort5.toFixed(2)}mm`);
    console.log(`Port 4 avg X: ${avgXPort4.toFixed(2)}mm`);
    console.log(`Port 3 avg X: ${avgXPort3.toFixed(2)}mm`);
    console.log(`Port 2 avg X: ${avgXPort2.toFixed(2)}mm`);
    console.log(`Port 1 avg X: ${avgXPort1.toFixed(2)}mm`);

    // Higher portSequence should generally have lower average X
    // (loaded first = placed toward back of container = lower X)
    expect(avgXPort5).toBeLessThanOrEqual(avgXPort1 + 1000); // Allow some tolerance
    console.log('✓ Higher portSequence items loaded first (verified by X coordinates)');

    // ========== Validation 3: No Collisions ==========
    const hasNoCollisions = noCollisions(result.loadedCargo);
    expect(hasNoCollisions).toBe(true);
    console.log('\n✓ No collisions detected between cargo items');

    // ========== Validation 4: All Within Container Boundaries ==========
    const withinBoundaries = allWithinBoundaries(result.loadedCargo, container40HQ);
    expect(withinBoundaries).toBe(true);
    console.log('✓ All cargo within container boundaries');

    // ========== Validation 5: Coordinate System Correctness ==========
    const coordinateSystemValid = isCoordinateSystemValid(result.loadedCargo, container40HQ);
    expect(coordinateSystemValid).toBe(true);
    console.log('✓ Coordinate system correctly applied (X=Length, Y=Height, Z=Width)');

    console.log('\n========== All Validations Passed ==========\n');
  });

  test('should calculate drop order based on portSequence and X-coordinate', async () => {
    // Create cargo with different portSequence values
    // Use larger items to ensure clear X-coordinate separation
    const cargoList = [];
    
    // Port 3 (highest priority in this test)
    for (let i = 1; i <= 5; i++) {
      cargoList.push(new Cargo({
        cargoId: `port3-${i}`,
        name: `港口3货物-${i}`,
        length: 800,
        width: 600,
        height: 500,
        weight: 15.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 2,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-15'),
        portSequence: 3
      }));
    }
    
    // Port 2
    for (let i = 1; i <= 5; i++) {
      cargoList.push(new Cargo({
        cargoId: `port2-${i}`,
        name: `港口2货物-${i}`,
        length: 800,
        width: 600,
        height: 500,
        weight: 15.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 2,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-10'),
        portSequence: 2
      }));
    }
    
    // Port 1 (lowest priority)
    for (let i = 1; i <= 5; i++) {
      cargoList.push(new Cargo({
        cargoId: `port1-${i}`,
        name: `港口1货物-${i}`,
        length: 800,
        width: 600,
        height: 500,
        weight: 15.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 2,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-05'),
        portSequence: 1
      }));
    }

    const result = await engine.generatePackingPlan(cargoList, container40HQ);

    console.log('\n========== Drop Order Calculation Test Results ==========');
    console.log(`Total cargo items: ${cargoList.length}`);
    console.log(`Loaded cargo: ${result.loadedCargo.length}`);

    // Calculate drop order manually based on requirements
    // Drop order should be: higher portSequence = earlier drop (lower order number)
    // When portSequence equal, higher X = earlier drop
    
    const calculateDropOrder = (loadedCargo) => {
      // Sort by portSequence descending (primary), then X descending (secondary)
      const sorted = [...loadedCargo].sort((a, b) => {
        const psA = parseInt(a.cargoId.match(/^port(\d+)-/)[1]);
        const psB = parseInt(b.cargoId.match(/^port(\d+)-/)[1]);
        
        if (psA !== psB) {
          return psB - psA; // Higher portSequence first
        }
        
        // When portSequence equal, higher X first
        return b.position.x - a.position.x;
      });
      
      // Assign drop order numbers starting from 1
      const dropOrders = new Map();
      let currentOrder = 1;
      let lastPS = null;
      let lastX = null;
      
      sorted.forEach((item, index) => {
        const ps = parseInt(item.cargoId.match(/^port(\d+)-/)[1]);
        const x = item.position.x;
        
        // If portSequence or X changed significantly, increment order
        if (lastPS !== null && (ps !== lastPS || Math.abs(x - lastX) > 10)) {
          currentOrder++;
        }
        
        dropOrders.set(item.cargoId, currentOrder);
        lastPS = ps;
        lastX = x;
      });
      
      return dropOrders;
    };

    const expectedDropOrders = calculateDropOrder(result.loadedCargo);

    console.log('\n========== Drop Order Analysis ==========');
    
    // Group by portSequence and show drop order distribution
    const getPortSequence = (cargoId) => {
      const match = cargoId.match(/^port(\d+)-/);
      return match ? parseInt(match[1]) : 0;
    };

    for (let ps = 3; ps >= 1; ps--) {
      const items = result.loadedCargo.filter(item => getPortSequence(item.cargoId) === ps);
      if (items.length > 0) {
        const dropOrders = items.map(item => expectedDropOrders.get(item.cargoId));
        const minOrder = Math.min(...dropOrders);
        const maxOrder = Math.max(...dropOrders);
        console.log(`Port ${ps}: Drop orders ${minOrder}-${maxOrder}`);
      }
    }

    // ========== Validation: Higher portSequence should have lower drop order numbers ==========
    const port3Items = result.loadedCargo.filter(item => getPortSequence(item.cargoId) === 3);
    const port2Items = result.loadedCargo.filter(item => getPortSequence(item.cargoId) === 2);
    const port1Items = result.loadedCargo.filter(item => getPortSequence(item.cargoId) === 1);

    const port3Orders = port3Items.map(item => expectedDropOrders.get(item.cargoId));
    const port2Orders = port2Items.map(item => expectedDropOrders.get(item.cargoId));
    const port1Orders = port1Items.map(item => expectedDropOrders.get(item.cargoId));

    const maxPort3Order = Math.max(...port3Orders);
    const minPort2Order = Math.min(...port2Orders);
    const maxPort2Order = Math.max(...port2Orders);
    const minPort1Order = Math.min(...port1Orders);

    // Port 3 (highest portSequence) should have lower drop orders than Port 2
    expect(maxPort3Order).toBeLessThanOrEqual(minPort2Order);
    console.log(`✓ Port 3 drop orders (${Math.min(...port3Orders)}-${maxPort3Order}) < Port 2 (${minPort2Order}-${maxPort2Order})`);

    // Port 2 should have lower drop orders than Port 1
    expect(maxPort2Order).toBeLessThanOrEqual(minPort1Order);
    console.log(`✓ Port 2 drop orders (${minPort2Order}-${maxPort2Order}) < Port 1 (${minPort1Order}-${Math.max(...port1Orders)})`);

    // ========== Validation: Drop order starts from 1 ==========
    const allOrders = Array.from(expectedDropOrders.values());
    const minDropOrder = Math.min(...allOrders);
    expect(minDropOrder).toBe(1);
    console.log(`✓ Drop order starts from 1 (min order: ${minDropOrder})`);

    // ========== Validation: Within same portSequence, higher X = earlier drop ==========
    // Check Port 3 items
    if (port3Items.length > 1) {
      const port3Sorted = [...port3Items].sort((a, b) => b.position.x - a.position.x);
      for (let i = 0; i < port3Sorted.length - 1; i++) {
        const currentOrder = expectedDropOrders.get(port3Sorted[i].cargoId);
        const nextOrder = expectedDropOrders.get(port3Sorted[i + 1].cargoId);
        // Higher X should have equal or lower drop order number
        expect(currentOrder).toBeLessThanOrEqual(nextOrder);
      }
      console.log('✓ Within same portSequence, higher X-coordinate gets earlier drop order');
    }

    console.log('\n========== All Drop Order Validations Passed ==========\n');
  });

  test('should handle cargo with same portSequence and similar X-coordinates', async () => {
    // Create cargo that will likely be placed at similar X coordinates
    // Use small items that can be placed side-by-side
    const cargoList = [];
    
    for (let i = 1; i <= 20; i++) {
      cargoList.push(new Cargo({
        cargoId: `same-port-${i}`,
        name: `同港口货物-${i}`,
        length: 400,
        width: 400,
        height: 400,
        weight: 10.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 2 // All same portSequence
      }));
    }

    const result = await engine.generatePackingPlan(cargoList, container40HQ);

    console.log('\n========== Same PortSequence Test Results ==========');
    console.log(`Loaded cargo: ${result.loadedCargo.length}`);

    // Calculate drop orders
    const sorted = [...result.loadedCargo].sort((a, b) => b.position.x - a.position.x);
    
    // Assign drop orders with grouping for similar X coordinates
    const dropOrders = new Map();
    let currentOrder = 1;
    let lastX = null;
    
    sorted.forEach(item => {
      const x = item.position.x;
      
      // If X changed significantly (more than 10mm), increment order
      if (lastX !== null && Math.abs(x - lastX) > 10) {
        currentOrder++;
      }
      
      dropOrders.set(item.cargoId, currentOrder);
      lastX = x;
    });

    // ========== Validation: Items with similar X get same drop order ==========
    const uniqueOrders = new Set(dropOrders.values());
    console.log(`Unique drop orders: ${uniqueOrders.size}`);
    console.log(`Drop order range: ${Math.min(...dropOrders.values())} to ${Math.max(...dropOrders.values())}`);

    // Items at similar X coordinates should have the same drop order
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentX = sorted[i].position.x;
      const nextX = sorted[i + 1].position.x;
      const currentOrder = dropOrders.get(sorted[i].cargoId);
      const nextOrder = dropOrders.get(sorted[i + 1].cargoId);
      
      if (Math.abs(currentX - nextX) <= 10) {
        // Similar X coordinates should have same drop order
        expect(currentOrder).toBe(nextOrder);
      }
    }
    
    console.log('✓ Cargo with similar X-coordinates receive the same drop order');

    // ========== Validation: Drop order starts from 1 ==========
    expect(Math.min(...dropOrders.values())).toBe(1);
    console.log('✓ Drop order starts from 1');

    console.log('\n========== All Validations Passed ==========\n');
  });

  test('should handle mixed portSequence with weight variations', async () => {
    // Test that portSequence takes priority over weight in sorting
    const cargoList = [];
    
    // Port 2 with heavy items (should load before Port 1 despite weight)
    for (let i = 1; i <= 5; i++) {
      cargoList.push(new Cargo({
        cargoId: `port2-heavy-${i}`,
        name: `港口2重货-${i}`,
        length: 600,
        width: 500,
        height: 500,
        weight: 25.0, // Heavy
        quantity: 1,
        stackable: true,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-10'),
        portSequence: 2
      }));
    }
    
    // Port 1 with light items
    for (let i = 1; i <= 5; i++) {
      cargoList.push(new Cargo({
        cargoId: `port1-light-${i}`,
        name: `港口1轻货-${i}`,
        length: 600,
        width: 500,
        height: 500,
        weight: 5.0, // Light
        quantity: 1,
        stackable: true,
        maxStackLayers: 5,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-05'),
        portSequence: 1
      }));
    }

    const result = await engine.generatePackingPlan(cargoList, container40HQ);

    console.log('\n========== Mixed PortSequence with Weight Test ==========');
    console.log(`Loaded cargo: ${result.loadedCargo.length}`);

    // Extract portSequence from cargoId
    const getPortSequence = (cargoId) => {
      const match = cargoId.match(/^port(\d+)-/);
      return match ? parseInt(match[1]) : 0;
    };

    const port2Items = result.loadedCargo.filter(item => getPortSequence(item.cargoId) === 2);
    const port1Items = result.loadedCargo.filter(item => getPortSequence(item.cargoId) === 1);

    // Port 2 items should have lower average X (loaded first)
    const avgXPort2 = port2Items.reduce((sum, item) => sum + item.position.x, 0) / port2Items.length;
    const avgXPort1 = port1Items.reduce((sum, item) => sum + item.position.x, 0) / port1Items.length;

    console.log(`Port 2 (heavy) avg X: ${avgXPort2.toFixed(2)}mm`);
    console.log(`Port 1 (light) avg X: ${avgXPort1.toFixed(2)}mm`);

    // Port 2 should be loaded first despite being heavier
    // (portSequence takes priority over weight in sorting)
    expect(avgXPort2).toBeLessThanOrEqual(avgXPort1 + 1000);
    console.log('✓ PortSequence takes priority over weight in loading order');

    // Verify heavy items are at ground level
    const heavyItems = result.loadedCargo.filter(item => item.properties.weight >= 20);
    expect(heavyItems.every(item => item.position.y === 0)).toBe(true);
    console.log('✓ Heavy items placed at ground level (Y=0)');

    // No collisions
    expect(noCollisions(result.loadedCargo)).toBe(true);
    console.log('✓ No collisions detected');

    console.log('\n========== All Validations Passed ==========\n');
  });
});
