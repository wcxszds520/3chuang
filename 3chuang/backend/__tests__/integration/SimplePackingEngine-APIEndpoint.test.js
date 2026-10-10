/**
 * Integration Test: API Endpoint
 * 
 * This test validates that the POST /api/packing endpoint correctly
 * processes cargo lists and returns properly formatted responses
 * compatible with the frontend.
 * 
 * Spec: 3d-space-splitting-algorithm-implementation
 * Task: 7.6 Write integration test for API endpoint
 * 
 * Test Scenario:
 * - POST /api/packing with valid cargo list
 * - Verify response contains loadedCargo, unloadedCargo, spaceUtilization
 * - Verify response format compatible with frontend
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 19.1, 19.2, 19.3, 19.4, 19.5
 */

const request = require('supertest');
const express = require('express');
const db = require('../../config/database');
const packingRouter = require('../../routes/packing');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/packing', packingRouter);

describe('Integration Test: API Endpoint', () => {
  beforeAll(async () => {
    // Ensure database connection is ready
    await db.query('SELECT 1');
  });

  afterAll(async () => {
    // Close database connection
    await db.end();
  });

  test('should return 400 when cargo list is missing', async () => {
    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        containerType: '40HQ'
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(400);
    expect(response.body.message).toContain('货物数据');
  });

  test('should return 400 when cargo list is empty', async () => {
    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoList: [],
        containerType: '40HQ'
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(400);
    expect(response.body.message).toContain('货物数据');
  });

  test('should return 400 when container type is missing', async () => {
    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoList: [
          {
            name: '测试货物',
            length: 1000,
            width: 800,
            height: 600,
            weight: 50,
            quantity: 1
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(400);
    expect(response.body.message).toContain('柜型');
  });

  test('should return 404 when container type does not exist', async () => {
    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoList: [
          {
            name: '测试货物',
            length: 1000,
            width: 800,
            height: 600,
            weight: 50,
            quantity: 1
          }
        ],
        containerType: 'INVALID_TYPE'
      });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe(404);
    expect(response.body.message).toContain('柜型不存在');
  });

  test('should successfully generate packing plan with valid cargo list', async () => {
    // Create a realistic cargo list
    const cargoList = [
      {
        cargoId: 'cargo-001',
        name: '电器A',
        length: 1200,
        width: 800,
        height: 1000,
        weight: 45.5,
        quantity: 2,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: '2024-06-15',
        portSequence: 3
      },
      {
        cargoId: 'cargo-002',
        name: '易碎品B',
        length: 800,
        width: 600,
        height: 500,
        weight: 12.0,
        quantity: 3,
        stackable: false,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: false,
        fragile: true,
        eta: '2024-06-20',
        portSequence: 2
      },
      {
        cargoId: 'cargo-003',
        name: '普通货物C',
        length: 600,
        width: 400,
        height: 400,
        weight: 8.5,
        quantity: 5,
        stackable: true,
        maxStackLayers: 5,
        canInvert: true,
        canLayFlat: true,
        fragile: false,
        eta: '2024-07-01',
        portSequence: 1
      }
    ];

    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoList,
        containerType: '40HQ'
      });

    console.log('\n========== API Endpoint Test Results ==========');
    console.log(`Response status: ${response.status}`);
    console.log(`Response code: ${response.body.code}`);
    console.log(`Response message: ${response.body.message}`);

    // ========== Validation 1: Response Status and Structure ==========
    expect(response.status).toBe(200);
    expect(response.body.code).toBe(200);
    expect(response.body.message).toBe('装箱方案生成成功');
    expect(response.body.data).toBeDefined();

    const data = response.body.data;

    // ========== Validation 2: Required Fields Present (Requirement 14.1-14.5) ==========
    expect(data.planId).toBeDefined();
    expect(data.loadedCargo).toBeDefined();
    expect(data.unloadedCargo).toBeDefined();
    expect(data.spaceUtilization).toBeDefined();
    expect(data.totalWeight).toBeDefined();
    expect(data.totalCargoCount).toBeDefined();
    expect(data.containerType).toBeDefined();

    console.log(`\nPlan ID: ${data.planId}`);
    console.log(`Total cargo count: ${data.totalCargoCount}`);
    console.log(`Loaded cargo: ${data.loadedCargo.length}`);
    console.log(`Unloaded cargo: ${data.unloadedCargo.length}`);
    console.log(`Space utilization: ${data.spaceUtilization}%`);
    console.log(`Total weight: ${data.totalWeight}kg`);

    // ========== Validation 3: loadedCargo Array Structure (Requirement 19.1-19.5) ==========
    expect(Array.isArray(data.loadedCargo)).toBe(true);
    
    if (data.loadedCargo.length > 0) {
      const firstItem = data.loadedCargo[0];
      
      // Requirement 19.1: position.x, position.y, position.z properties
      expect(firstItem.position).toBeDefined();
      expect(typeof firstItem.position.x).toBe('number');
      expect(typeof firstItem.position.y).toBe('number');
      expect(typeof firstItem.position.z).toBe('number');
      
      // Requirement 19.2: rotation.length, rotation.height, rotation.width properties
      expect(firstItem.dimensions).toBeDefined();
      expect(typeof firstItem.dimensions.l).toBe('number');
      expect(typeof firstItem.dimensions.h).toBe('number');
      expect(typeof firstItem.dimensions.w).toBe('number');
      
      // Requirement 19.3: all original cargo properties preserved
      expect(firstItem.cargoId).toBeDefined();
      expect(firstItem.name).toBeDefined();
      expect(firstItem.properties).toBeDefined();
      expect(typeof firstItem.properties.weight).toBe('number');
      expect(typeof firstItem.properties.fragile).toBe('boolean');
      expect(firstItem.properties.type).toBeDefined();
      
      // Requirement 19.3: batch information (eta, color)
      expect(firstItem.batch).toBeDefined();
      expect(firstItem.batch.eta).toBeDefined();
      expect(firstItem.batch.color).toBeDefined();
      expect(firstItem.batch.color).toMatch(/^#[0-9A-F]{6}$/i);
      
      console.log('\n✓ Loaded cargo structure validated');
      console.log(`  Sample item: ${firstItem.name}`);
      console.log(`  Position: (${firstItem.position.x}, ${firstItem.position.y}, ${firstItem.position.z})`);
      console.log(`  Dimensions: ${firstItem.dimensions.l} x ${firstItem.dimensions.h} x ${firstItem.dimensions.w}`);
      console.log(`  Type: ${firstItem.properties.type}`);
      console.log(`  Batch color: ${firstItem.batch.color}`);
    }

    // ========== Validation 4: unloadedCargo Array Structure ==========
    expect(Array.isArray(data.unloadedCargo)).toBe(true);
    
    if (data.unloadedCargo.length > 0) {
      const firstUnloaded = data.unloadedCargo[0];
      expect(firstUnloaded.cargo).toBeDefined();
      expect(firstUnloaded.reason).toBeDefined();
      expect(firstUnloaded.reason).toBe('insufficient_space');
      
      console.log(`\n✓ Unloaded cargo structure validated`);
      console.log(`  Unloaded items: ${data.unloadedCargo.length}`);
      console.log(`  Reason: ${firstUnloaded.reason}`);
    }

    // ========== Validation 5: spaceUtilization Format ==========
    expect(typeof data.spaceUtilization).toBe('number');
    expect(data.spaceUtilization).toBeGreaterThanOrEqual(0);
    expect(data.spaceUtilization).toBeLessThanOrEqual(100);
    // Should be formatted to 2 decimal places
    expect(data.spaceUtilization.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
    
    console.log(`\n✓ Space utilization: ${data.spaceUtilization}% (valid range: 0-100)`);

    // ========== Validation 6: totalWeight Calculation ==========
    expect(typeof data.totalWeight).toBe('number');
    expect(data.totalWeight).toBeGreaterThan(0);
    
    // Verify totalWeight matches sum of loaded cargo weights
    const calculatedWeight = data.loadedCargo.reduce((sum, item) => 
      sum + item.properties.weight, 0
    );
    expect(Math.abs(data.totalWeight - calculatedWeight)).toBeLessThan(0.1);
    
    console.log(`✓ Total weight: ${data.totalWeight}kg (verified against loaded cargo)`);

    // ========== Validation 7: totalCargoCount Accuracy ==========
    expect(typeof data.totalCargoCount).toBe('number');
    expect(data.totalCargoCount).toBe(data.loadedCargo.length);
    
    console.log(`✓ Total cargo count: ${data.totalCargoCount} (matches loaded cargo array length)`);

    // ========== Validation 8: containerType Information ==========
    expect(data.containerType).toBeDefined();
    expect(data.containerType.typeId).toBe('40HQ');
    expect(data.containerType.name).toBeDefined();
    expect(typeof data.containerType.innerLength).toBe('number');
    expect(typeof data.containerType.innerWidth).toBe('number');
    expect(typeof data.containerType.innerHeight).toBe('number');
    expect(typeof data.containerType.maxWeight).toBe('number');
    
    console.log(`\n✓ Container type: ${data.containerType.name}`);
    console.log(`  Dimensions: ${data.containerType.innerLength} x ${data.containerType.innerWidth} x ${data.containerType.innerHeight} mm`);
    console.log(`  Max weight: ${data.containerType.maxWeight}kg`);

    // ========== Validation 9: Frontend Compatibility ==========
    // Verify the response format is directly consumable by ThreeRenderer.js
    // without transformation (Requirement 19.5)
    
    // Check that all loaded cargo items have the exact structure expected by frontend
    data.loadedCargo.forEach(item => {
      // Frontend expects: position.x, position.y, position.z
      expect(item.position.x).toBeDefined();
      expect(item.position.y).toBeDefined();
      expect(item.position.z).toBeDefined();
      
      // Frontend expects: dimensions.l, dimensions.h, dimensions.w
      expect(item.dimensions.l).toBeDefined();
      expect(item.dimensions.h).toBeDefined();
      expect(item.dimensions.w).toBeDefined();
      
      // Frontend expects: properties.type for base color
      expect(item.properties.type).toBeDefined();
      expect(['heavy', 'fragile', 'normal']).toContain(item.properties.type);
      
      // Frontend expects: batch.color for outline color
      expect(item.batch.color).toBeDefined();
      expect(item.batch.color).toMatch(/^#[0-9A-F]{6}$/i);
    });
    
    console.log(`\n✓ Frontend compatibility validated`);
    console.log(`  All ${data.loadedCargo.length} items have correct structure for ThreeRenderer.js`);

    // ========== Validation 10: Coordinate System Correctness ==========
    // Verify unified coordinate system: X=Length, Y=Height, Z=Width
    const container = data.containerType;
    
    data.loadedCargo.forEach(item => {
      // X-axis: Length (0 to innerLength)
      expect(item.position.x).toBeGreaterThanOrEqual(0);
      expect(item.position.x + item.dimensions.l).toBeLessThanOrEqual(container.innerLength);
      
      // Y-axis: Height (0 to innerHeight)
      expect(item.position.y).toBeGreaterThanOrEqual(0);
      expect(item.position.y + item.dimensions.h).toBeLessThanOrEqual(container.innerHeight);
      
      // Z-axis: Width (0 to innerWidth)
      expect(item.position.z).toBeGreaterThanOrEqual(0);
      expect(item.position.z + item.dimensions.w).toBeLessThanOrEqual(container.innerWidth);
    });
    
    console.log(`✓ Coordinate system validated (X=Length, Y=Height, Z=Width)`);

    // ========== Validation 11: Database Persistence ==========
    // Verify the plan was saved to database
    const [rows] = await db.query(
      'SELECT * FROM packing_plan WHERE plan_id = ?',
      [data.planId]
    );
    
    expect(rows.length).toBe(1);
    expect(rows[0].plan_id).toBe(data.planId);
    expect(rows[0].container_type).toBe('40HQ');
    expect(parseFloat(rows[0].space_utilization)).toBe(data.spaceUtilization);
    expect(parseFloat(rows[0].total_weight)).toBe(data.totalWeight);
    expect(rows[0].total_cargo_count).toBe(data.totalCargoCount);
    
    // plan_data might already be an object (depending on database driver)
    const savedPlanData = typeof rows[0].plan_data === 'string' 
      ? JSON.parse(rows[0].plan_data) 
      : rows[0].plan_data;
    expect(savedPlanData.planId).toBe(data.planId);
    expect(savedPlanData.loadedCargo.length).toBe(data.loadedCargo.length);
    
    console.log(`\n✓ Plan persisted to database`);
    console.log(`  Plan ID: ${rows[0].plan_id}`);
    console.log(`  Compliance status: ${rows[0].compliance_status}`);
    console.log(`  Risk level: ${rows[0].risk_level}`);

    console.log('\n========== All API Endpoint Validations Passed ==========\n');
  }, 30000); // 30 second timeout

  test('should handle cargo with quantity > 1 correctly', async () => {
    const cargoList = [
      {
        cargoId: 'cargo-multi',
        name: '批量货物',
        length: 500,
        width: 400,
        height: 300,
        weight: 10.0,
        quantity: 5, // Multiple items
        stackable: true,
        maxStackLayers: 3,
        canInvert: true,
        canLayFlat: false,
        fragile: false,
        eta: '2024-06-15',
        portSequence: 1
      }
    ];

    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoList,
        containerType: '20GP'
      });

    expect(response.status).toBe(200);
    const data = response.body.data;

    // Should expand quantity=5 into 5 individual items
    expect(data.loadedCargo.length).toBeGreaterThan(0);
    
    // Each expanded item should have unique cargoId
    const cargoIds = data.loadedCargo.map(item => item.cargoId);
    const uniqueIds = new Set(cargoIds);
    expect(uniqueIds.size).toBe(cargoIds.length);
    
    console.log(`\nQuantity expansion test: ${data.loadedCargo.length} items loaded from quantity=5`);
  });

  test('should handle heavy cargo constraint correctly', async () => {
    const cargoList = [
      {
        cargoId: 'heavy-001',
        name: '重型设备',
        length: 1500,
        width: 1200,
        height: 1000,
        weight: 250.0, // Heavy cargo (>= 20kg)
        quantity: 1,
        stackable: true,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: '2024-06-15',
        portSequence: 1
      }
    ];

    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoList,
        containerType: '40HQ'
      });

    expect(response.status).toBe(200);
    const data = response.body.data;

    // Heavy cargo must be placed at Y=0
    const heavyItems = data.loadedCargo.filter(item => 
      item.properties.weight >= 20 || item.properties.type === 'heavy'
    );
    
    heavyItems.forEach(item => {
      expect(item.position.y).toBe(0);
    });
    
    console.log(`\nHeavy cargo test: ${heavyItems.length} heavy items all placed at Y=0`);
  });

  test('should handle fragile cargo constraint correctly', async () => {
    const cargoList = [
      {
        cargoId: 'fragile-001',
        name: '玻璃制品',
        length: 800,
        width: 600,
        height: 400,
        weight: 15.0,
        quantity: 1,
        stackable: false,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: false,
        fragile: true, // Fragile cargo
        eta: '2024-06-15',
        portSequence: 1
      }
    ];

    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoList,
        containerType: '40HQ'
      });

    expect(response.status).toBe(200);
    const data = response.body.data;

    // Fragile items should be marked correctly
    const fragileItems = data.loadedCargo.filter(item => 
      item.properties.fragile === true || item.properties.type === 'fragile'
    );
    
    expect(fragileItems.length).toBeGreaterThan(0);
    fragileItems.forEach(item => {
      expect(item.properties.fragile).toBe(true);
    });
    
    console.log(`\nFragile cargo test: ${fragileItems.length} fragile items correctly marked`);
  });

  test('should return consistent batch colors for same ETA', async () => {
    const cargoList = [
      {
        cargoId: 'cargo-001',
        name: '货物A',
        length: 500,
        width: 400,
        height: 300,
        weight: 10.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: '2024-06-15',
        portSequence: 1
      },
      {
        cargoId: 'cargo-002',
        name: '货物B',
        length: 600,
        width: 500,
        height: 400,
        weight: 12.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: '2024-06-15', // Same ETA
        portSequence: 1
      },
      {
        cargoId: 'cargo-003',
        name: '货物C',
        length: 400,
        width: 300,
        height: 200,
        weight: 8.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: '2024-07-01', // Different ETA
        portSequence: 1
      }
    ];

    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoList,
        containerType: '20GP'
      });

    expect(response.status).toBe(200);
    const data = response.body.data;

    // Items with same ETA should have same batch color
    const items = data.loadedCargo;
    const eta1Items = items.filter(item => item.batch.eta.includes('2024-06-15'));
    const eta2Items = items.filter(item => item.batch.eta.includes('2024-07-01'));
    
    if (eta1Items.length > 1) {
      const color1 = eta1Items[0].batch.color;
      eta1Items.forEach(item => {
        expect(item.batch.color).toBe(color1);
      });
    }
    
    if (eta2Items.length > 0 && eta1Items.length > 0) {
      // Different ETAs should have different colors (most likely)
      // Note: There's a small chance of collision with 6 colors
      console.log(`\nBatch color test: ETA 2024-06-15 = ${eta1Items[0]?.batch.color}, ETA 2024-07-01 = ${eta2Items[0]?.batch.color}`);
    }
  });
});
