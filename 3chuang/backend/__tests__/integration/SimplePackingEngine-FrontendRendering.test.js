/**
 * Integration Test: Frontend Rendering Verification
 * 
 * This test validates that the packing result data structure is compatible
 * with ThreeRenderer.js frontend rendering requirements.
 * 
 * Spec: 3d-space-splitting-algorithm-implementation
 * Task: 7.7 Write integration test for frontend rendering
 * 
 * Test Scenario:
 * - Generate packing plan with SimplePackingEngine
 * - Verify data structure matches ThreeRenderer.js expectations
 * - Verify center-aligned positioning (x+l/2, y+h/2, z+w/2)
 * - Verify dual-dimension coloring (batch.color + properties.type)
 * - Verify no visual island gaps
 * 
 * Requirements: 16.1, 16.4, 16.5, 19.5
 */

const SimplePackingEngine = require('../../services/SimplePackingEngine');
const ContainerType = require('../../models/ContainerType');
const Cargo = require('../../models/Cargo');
const { 
  noCollisions, 
  allWithinBoundaries 
} = require('../setup/test-utilities');

describe('Integration Test: Frontend Rendering Verification', () => {
  let engine;
  let container40HQ;

  beforeEach(() => {
    engine = new SimplePackingEngine();
    
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

  test('should produce data structure compatible with ThreeRenderer.js', async () => {
    // Create test cargo with different types and batches
    const cargoList = [];
    
    // Batch 1: Heavy items (blue in ThreeRenderer)
    for (let i = 1; i <= 10; i++) {
      cargoList.push(new Cargo({
        cargoId: `heavy-${i}`,
        name: `重型货物-${i}`,
        length: 800,
        width: 600,
        height: 600,
        weight: 25.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 2,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 3
      }));
    }
    
    // Batch 2: Fragile items (gold in ThreeRenderer)
    for (let i = 1; i <= 10; i++) {
      cargoList.push(new Cargo({
        cargoId: `fragile-${i}`,
        name: `易碎品-${i}`,
        length: 700,
        width: 500,
        height: 500,
        weight: 10.0,
        quantity: 1,
        stackable: false,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: false,
        fragile: true,
        eta: new Date('2024-06-15'),
        portSequence: 2
      }));
    }
    
    // Batch 3: Normal items (gray in ThreeRenderer)
    for (let i = 1; i <= 20; i++) {
      cargoList.push(new Cargo({
        cargoId: `normal-${i}`,
        name: `普通货物-${i}`,
        length: 600,
        width: 500,
        height: 450,
        weight: 12.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 6,
        canInvert: true,
        canLayFlat: true,
        fragile: false,
        eta: new Date('2024-07-01'),
        portSequence: 1
      }));
    }

    const result = await engine.generatePackingPlan(cargoList, container40HQ);

    console.log('\n========== Frontend Rendering Verification ==========');
    console.log(`Total loaded cargo: ${result.loadedCargo.length}`);

    // ========== Validation 1: Required Data Structure ==========
    // ThreeRenderer.js expects each cargo item to have:
    // - x, y, z (position)
    // - l, h, w (dimensions)
    // - type (cargo type for base color)
    // - color (batch color for border)
    // - name, weight, fragile (metadata)
    
    result.loadedCargo.forEach((cargo, index) => {
      // Position properties
      expect(cargo.position).toBeDefined();
      expect(typeof cargo.position.x).toBe('number');
      expect(typeof cargo.position.y).toBe('number');
      expect(typeof cargo.position.z).toBe('number');
      
      // Dimension properties
      expect(cargo.dimensions).toBeDefined();
      expect(typeof cargo.dimensions.l).toBe('number');
      expect(typeof cargo.dimensions.h).toBe('number');
      expect(typeof cargo.dimensions.w).toBe('number');
      
      // Properties for rendering
      expect(cargo.properties).toBeDefined();
      expect(cargo.properties.type).toBeDefined();
      expect(['heavy', 'fragile', 'normal']).toContain(cargo.properties.type);
      
      // Batch information
      expect(cargo.batch).toBeDefined();
      expect(cargo.batch.color).toBeDefined();
      
      // Metadata
      expect(cargo.name).toBeDefined();
      expect(typeof cargo.properties.weight).toBe('number');
      expect(typeof cargo.properties.fragile).toBe('boolean');
    });
    
    console.log('✓ All cargo items have required data structure for ThreeRenderer.js');

    // ========== Validation 2: Center-Aligned Positioning ==========
    // ThreeRenderer.js uses center-aligned positioning:
    // mesh.position.set(cargo.x + cargo.l / 2, cargo.y + cargo.h / 2, cargo.z + cargo.w / 2)
    // 
    // This means the packing engine provides corner positions (x, y, z),
    // and the renderer calculates center positions for Three.js meshes.
    // We verify that corner positions are valid and allow center calculation.
    
    result.loadedCargo.forEach(cargo => {
      const centerX = cargo.position.x + cargo.dimensions.l / 2;
      const centerY = cargo.position.y + cargo.dimensions.h / 2;
      const centerZ = cargo.position.z + cargo.dimensions.w / 2;
      
      // Center positions should be within container bounds
      expect(centerX).toBeGreaterThan(0);
      expect(centerX).toBeLessThanOrEqual(container40HQ.innerLength);
      expect(centerY).toBeGreaterThan(0);
      expect(centerY).toBeLessThanOrEqual(container40HQ.innerHeight);
      expect(centerZ).toBeGreaterThan(0);
      expect(centerZ).toBeLessThanOrEqual(container40HQ.innerWidth);
    });
    
    console.log('✓ All cargo positions support center-aligned rendering');

    // ========== Validation 3: Dual-Dimension Coloring ==========
    // ThreeRenderer.js implements dual-dimension coloring:
    // 1. Base color from cargo type (heavy=blue, fragile=gold, normal=gray)
    // 2. Border color from batch.color (BoxHelper)
    // 
    // We verify that both dimensions are present in the data.
    
    const cargoTypes = new Set();
    const batchColors = new Set();
    
    result.loadedCargo.forEach(cargo => {
      cargoTypes.add(cargo.properties.type);
      if (cargo.batch && cargo.batch.color) {
        batchColors.add(cargo.batch.color);
      }
    });
    
    console.log(`\nCargo types found: ${Array.from(cargoTypes).join(', ')}`);
    console.log(`Batch colors found: ${batchColors.size} unique colors`);
    
    // Verify we have multiple cargo types (for base color variation)
    expect(cargoTypes.size).toBeGreaterThan(1);
    
    // Verify we have batch colors (for border color variation)
    expect(batchColors.size).toBeGreaterThan(0);
    
    console.log('✓ Dual-dimension coloring data present (type + batch.color)');

    // ========== Validation 4: No Visual Island Gaps ==========
    // Requirements 16.1 and 16.4 specify:
    // - No artificial spacing based on ETA or batch
    // - Gaps between adjacent cargo are 0mm or from space splitting geometry
    // 
    // We verify this by checking that cargo items are tightly packed
    // (no collisions but minimal gaps).
    
    // First, verify no collisions
    const hasNoCollisions = noCollisions(result.loadedCargo);
    expect(hasNoCollisions).toBe(true);
    console.log('\n✓ No collisions (tight packing without overlap)');
    
    // Check for adjacent cargo pairs and measure gaps
    let adjacentPairs = 0;
    let zeroGapPairs = 0;
    let smallGapPairs = 0;
    
    for (let i = 0; i < result.loadedCargo.length; i++) {
      for (let j = i + 1; j < result.loadedCargo.length; j++) {
        const cargo1 = result.loadedCargo[i];
        const cargo2 = result.loadedCargo[j];
        
        // Check if adjacent in X direction
        const xGap1 = cargo2.position.x - (cargo1.position.x + cargo1.dimensions.l);
        const xGap2 = cargo1.position.x - (cargo2.position.x + cargo2.dimensions.l);
        const xGap = Math.min(Math.abs(xGap1), Math.abs(xGap2));
        
        // Check if adjacent in Y direction
        const yGap1 = cargo2.position.y - (cargo1.position.y + cargo1.dimensions.h);
        const yGap2 = cargo1.position.y - (cargo2.position.y + cargo2.dimensions.h);
        const yGap = Math.min(Math.abs(yGap1), Math.abs(yGap2));
        
        // Check if adjacent in Z direction
        const zGap1 = cargo2.position.z - (cargo1.position.z + cargo1.dimensions.w);
        const zGap2 = cargo1.position.z - (cargo2.position.z + cargo2.dimensions.w);
        const zGap = Math.min(Math.abs(zGap1), Math.abs(zGap2));
        
        // If adjacent in at least one direction (gap < 10mm)
        if (xGap < 10 || yGap < 10 || zGap < 10) {
          adjacentPairs++;
          
          // Count zero-gap pairs (perfect contact)
          if (xGap < 1 || yGap < 1 || zGap < 1) {
            zeroGapPairs++;
          }
          
          // Count small-gap pairs (< 5mm, likely from space splitting)
          if (xGap < 5 || yGap < 5 || zGap < 5) {
            smallGapPairs++;
          }
        }
      }
    }
    
    console.log(`\nAdjacent cargo pairs: ${adjacentPairs}`);
    console.log(`Zero-gap pairs: ${zeroGapPairs} (${((zeroGapPairs/adjacentPairs)*100).toFixed(1)}%)`);
    console.log(`Small-gap pairs (<5mm): ${smallGapPairs} (${((smallGapPairs/adjacentPairs)*100).toFixed(1)}%)`);
    
    // Verify that most adjacent pairs have zero or small gaps
    // (indicating tight packing without artificial spacing)
    if (adjacentPairs > 0) {
      const tightPackingRatio = smallGapPairs / adjacentPairs;
      expect(tightPackingRatio).toBeGreaterThan(0.7); // At least 70% tight packing
      console.log('✓ No visual island gaps (tight packing verified)');
    }

    // ========== Validation 5: Coordinate System Consistency ==========
    // ThreeRenderer.js expects: X=Length, Y=Height, Z=Width
    // Verify all cargo positions follow this convention
    
    result.loadedCargo.forEach(cargo => {
      // X-axis: Length (0 to innerLength)
      expect(cargo.position.x).toBeGreaterThanOrEqual(0);
      expect(cargo.position.x + cargo.dimensions.l).toBeLessThanOrEqual(container40HQ.innerLength);
      
      // Y-axis: Height (0 to innerHeight)
      expect(cargo.position.y).toBeGreaterThanOrEqual(0);
      expect(cargo.position.y + cargo.dimensions.h).toBeLessThanOrEqual(container40HQ.innerHeight);
      
      // Z-axis: Width (0 to innerWidth)
      expect(cargo.position.z).toBeGreaterThanOrEqual(0);
      expect(cargo.position.z + cargo.dimensions.w).toBeLessThanOrEqual(container40HQ.innerWidth);
    });
    
    console.log('✓ Coordinate system consistent (X=Length, Y=Height, Z=Width)');

    // ========== Validation 6: Container Boundaries ==========
    const withinBoundaries = allWithinBoundaries(result.loadedCargo, container40HQ);
    expect(withinBoundaries).toBe(true);
    console.log('✓ All cargo within container boundaries');

    // ========== Validation 7: Batch Grouping for Visual Clarity ==========
    // Group cargo by batch color to verify visual organization
    const colorGroups = {};
    result.loadedCargo.forEach(cargo => {
      const color = cargo.batch.color || 'unknown';
      if (!colorGroups[color]) {
        colorGroups[color] = [];
      }
      colorGroups[color].push(cargo);
    });
    
    console.log(`\nColor groups: ${Object.keys(colorGroups).length}`);
    Object.keys(colorGroups).forEach(color => {
      console.log(`  ${color}: ${colorGroups[color].length} items`);
    });
    
    // Verify we have multiple color groups (visual variety)
    expect(Object.keys(colorGroups).length).toBeGreaterThan(1);
    
    console.log('✓ Batch coloring provides visual clarity');

    console.log('\n========== All Frontend Rendering Validations Passed ==========\n');
  }, 30000);

  test('should handle rendering data for empty container', async () => {
    // Edge case: no cargo loaded
    const cargoList = [];
    const result = await engine.generatePackingPlan(cargoList, container40HQ);

    expect(result.loadedCargo).toBeDefined();
    expect(result.loadedCargo.length).toBe(0);
    expect(Array.isArray(result.loadedCargo)).toBe(true);
    
    console.log('\n✓ Empty container handled correctly for rendering');
  });

  test('should handle rendering data for single cargo item', async () => {
    // Edge case: single cargo item
    const cargoList = [
      new Cargo({
        cargoId: 'single-1',
        name: '单个货物',
        length: 1000,
        width: 800,
        height: 600,
        weight: 15.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 5,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 1
      })
    ];

    const result = await engine.generatePackingPlan(cargoList, container40HQ);

    expect(result.loadedCargo.length).toBe(1);
    
    const cargo = result.loadedCargo[0];
    
    // Verify data structure
    expect(cargo.position).toBeDefined();
    expect(cargo.dimensions).toBeDefined();
    expect(cargo.properties).toBeDefined();
    expect(cargo.batch).toBeDefined();
    
    // Verify center-aligned positioning is possible
    const centerX = cargo.position.x + cargo.dimensions.l / 2;
    const centerY = cargo.position.y + cargo.dimensions.h / 2;
    const centerZ = cargo.position.z + cargo.dimensions.w / 2;
    
    expect(centerX).toBeGreaterThan(0);
    expect(centerY).toBeGreaterThan(0);
    expect(centerZ).toBeGreaterThan(0);
    
    console.log('\n✓ Single cargo item handled correctly for rendering');
  });

  test('should provide consistent rendering data across multiple runs', async () => {
    // Verify deterministic behavior for rendering
    const cargoList = [];
    
    for (let i = 1; i <= 20; i++) {
      cargoList.push(new Cargo({
        cargoId: `cargo-${i}`,
        name: `货物-${i}`,
        length: 600,
        width: 500,
        height: 400,
        weight: 10.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 5,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 1
      }));
    }

    // Run packing twice
    const result1 = await engine.generatePackingPlan(cargoList, container40HQ);
    const result2 = await engine.generatePackingPlan(cargoList, container40HQ);

    // Verify same number of items loaded
    expect(result1.loadedCargo.length).toBe(result2.loadedCargo.length);
    
    // Verify same positions (deterministic packing)
    for (let i = 0; i < result1.loadedCargo.length; i++) {
      const cargo1 = result1.loadedCargo[i];
      const cargo2 = result2.loadedCargo[i];
      
      expect(cargo1.position.x).toBe(cargo2.position.x);
      expect(cargo1.position.y).toBe(cargo2.position.y);
      expect(cargo1.position.z).toBe(cargo2.position.z);
      expect(cargo1.dimensions.l).toBe(cargo2.dimensions.l);
      expect(cargo1.dimensions.h).toBe(cargo2.dimensions.h);
      expect(cargo1.dimensions.w).toBe(cargo2.dimensions.w);
    }
    
    console.log('\n✓ Rendering data consistent across multiple runs (deterministic)');
  });
});
