/**
 * 装箱方案生成API集成测试
 * 
 * 测试目标：验证POST /api/packing/generate接口的功能
 * 
 * 测试场景：
 * 1. 正常场景：成功生成装箱方案
 * 2. 异常场景：缺少必需参数
 * 3. 兼容场景：旧 cargoIds 请求仍可用
 * 4. 异常场景：货物或柜型不存在
 */

const request = require('supertest');
const { app } = require('../../server');
const db = require('../../config/database');

describe('POST /api/packing/generate - 装箱方案生成接口', () => {
  let testCargoIds = [];
  const testPlanIds = [];

  // 在所有测试前：创建测试货物数据
  beforeAll(async () => {
    // 清空测试数据
    await db.query('DELETE FROM cargo WHERE name LIKE "测试货物%"');

    // 创建测试货物1：小型货物
    const cargo1Query = `
      INSERT INTO cargo (cargo_id, name, length, width, height, weight, quantity, 
                        stackable, max_stack_layers, can_invert, can_lay_flat)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const cargo1Id = `test_cargo_${Date.now()}_1`;
    await db.query(cargo1Query, [
      cargo1Id, '测试货物1', 300, 300, 350, 5, 10,
      true, 3, false, false
    ]);
    testCargoIds.push(cargo1Id);

    // 创建测试货物2：中型货物
    const cargo2Id = `test_cargo_${Date.now()}_2`;
    await db.query(cargo1Query, [
      cargo2Id, '测试货物2', 500, 400, 600, 8, 5,
      true, 2, false, false
    ]);
    testCargoIds.push(cargo2Id);

    console.log('测试货物创建完成:', testCargoIds);
  });

  // 在所有测试后：清理测试数据
  afterAll(async () => {
    if (testPlanIds.length > 0) {
      const placeholders = testPlanIds.map(() => '?').join(', ');
      await db.query(`DELETE FROM packing_plan WHERE plan_id IN (${placeholders})`, testPlanIds);
    }
    await db.query('DELETE FROM cargo WHERE cargo_id LIKE "test_cargo_%"');
    await db.end();
  });

  // ========== 测试场景1: 兼容旧 cargoIds 请求并返回当前扁平契约 ==========
  test('应该兼容 cargoIds 并生成扁平装箱方案', async () => {
    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoIds: testCargoIds,
        containerType: '40HQ'
      })
      .expect(200);
    testPlanIds.push(response.body.data.planId);

    // 验证响应格式
    expect(response.body).toHaveProperty('code', 200);
    expect(response.body).toHaveProperty('message', 'Packing plan generated successfully');
    expect(response.body).toHaveProperty('data');

    // 验证装箱方案数据结构
    const plan = response.body.data;
    expect(plan).toHaveProperty('planId');
    expect(plan).toHaveProperty('containerInfo');
    expect(plan).toHaveProperty('spaceUtilization');
    expect(plan).toHaveProperty('totalWeight');
    expect(plan).toHaveProperty('totalCargoCount');
    expect(plan).toHaveProperty('loadedCargo');
    expect(plan).toHaveProperty('unloadedCargo');

    // 验证柜型信息
    expect(plan.containerInfo.typeId).toBe('40HQ');
    expect(plan.ext_algorithmId).toBe('hybrid-v2.5');
    expect(plan.validator.status).toBe('VALID');

    // 验证装箱方案统计数据
    expect(plan.spaceUtilization).toBeGreaterThanOrEqual(0);
    expect(plan.spaceUtilization).toBeLessThanOrEqual(100);
    expect(plan.totalWeight).toBeGreaterThan(0);
    expect(plan.totalCargoCount).toBeGreaterThan(0);

    // 验证已装载货物列表
    expect(Array.isArray(plan.loadedCargo)).toBe(true);
    if (plan.loadedCargo.length > 0) {
      const firstCargo = plan.loadedCargo[0];
      expect(firstCargo).toHaveProperty('cargoId');
      expect(firstCargo).toHaveProperty('name');
      expect(firstCargo).toHaveProperty('x');
      expect(firstCargo).toHaveProperty('y');
      expect(firstCargo).toHaveProperty('z');
      expect(firstCargo).toHaveProperty('l');
      expect(firstCargo).toHaveProperty('w');
      expect(firstCargo).toHaveProperty('h');
      expect(firstCargo).toHaveProperty('loadingIndex');
    }

    // 验证未装载货物列表
    expect(Array.isArray(plan.unloadedCargo)).toBe(true);

    console.log('装箱方案生成成功:');
    console.log(`  - 方案ID: ${plan.planId}`);
    console.log(`  - 空间利用率: ${plan.spaceUtilization}%`);
    console.log(`  - 总重量: ${plan.totalWeight}kg`);
    console.log(`  - 已装载: ${plan.loadedCargo.length}件`);
    console.log(`  - 未装载: ${plan.unloadedCargo.length}件`);
  }, 30000); // 设置30秒超时，因为装箱算法可能需要较长时间

  // ========== 测试场景2: 异常场景 - 缺少货物ID列表 ==========
  test('应该拒绝缺少货物ID列表的请求', async () => {
    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        containerType: '40HQ'
      })
      .expect(400);

    expect(response.body).toHaveProperty('code', 400);
    expect(response.body.message).toContain('Cargo list or cargo ID list');
  });

  // ========== 测试场景3: 异常场景 - 货物ID列表为空数组 ==========
  test('应该拒绝空的货物ID列表', async () => {
    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoIds: [],
        containerType: '40HQ'
      })
      .expect(400);

    expect(response.body).toHaveProperty('code', 400);
    expect(response.body.message).toContain('Cargo list or cargo ID list');
  });

  // ========== 测试场景4: 异常场景 - 缺少柜型ID ==========
  test('应该拒绝缺少柜型ID的请求', async () => {
    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoIds: testCargoIds
      })
      .expect(400);

    expect(response.body).toHaveProperty('code', 400);
    expect(response.body.message).toContain('Container type');
  });

  // ========== 测试场景5: 异常场景 - 货物不存在 ==========
  test('应该处理不存在的货物ID', async () => {
    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoIds: ['nonexistent_cargo_id'],
        containerType: '40HQ'
      })
      .expect(404);

    expect(response.body).toHaveProperty('code', 404);
    expect(response.body.message).toContain('No cargo found');
  });

  // ========== 测试场景6: 异常场景 - 柜型不存在 ==========
  test('应该处理不存在的柜型ID', async () => {
    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoIds: testCargoIds,
        containerType: 'INVALID_TYPE'
      })
      .expect(404);

    expect(response.body).toHaveProperty('code', 404);
    expect(response.body.message).toContain('not found');
  });

  // ========== 测试场景7: 验证方案保存到数据库 ==========
  test('应该将装箱方案保存到数据库', async () => {
    const response = await request(app)
      .post('/api/packing/generate')
      .send({
        cargoIds: testCargoIds,
        containerType: '40HQ'
      })
      .expect(200);

    const planId = response.body.data.planId;
    testPlanIds.push(planId);

    // 从数据库查询方案
    const [rows] = await db.query(
      'SELECT * FROM packing_plan WHERE plan_id = ?',
      [planId]
    );

    expect(rows.length).toBe(1);
    expect(rows[0].plan_id).toBe(planId);
    expect(rows[0].container_type).toBe('40HQ');
    expect(Number(rows[0].space_utilization)).toBeGreaterThanOrEqual(0);
    expect(Number(rows[0].total_weight)).toBeGreaterThan(0);
    expect(rows[0].total_cargo_count).toBeGreaterThan(0);

    // 验证plan_data字段包含完整的JSON数据
    const planData = typeof rows[0].plan_data === 'string'
      ? JSON.parse(rows[0].plan_data)
      : rows[0].plan_data;
    expect(planData).toHaveProperty('planId');
    expect(planData).toHaveProperty('loadedCargo');
    expect(planData).toHaveProperty('unloadedCargo');
  }, 30000);
});
