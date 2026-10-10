/**
 * 模板导入功能集成测试
 * 
 * 测试目标：验证 POST /api/cargo/import-template 接口的功能
 * 测试场景：
 * 1. 成功导入"慈溪小家电"模板
 * 2. 成功导入"宁波文具"模板
 * 3. 成功导入"宁波汽配"模板
 * 4. 处理无效的模板名称
 * 5. 处理缺少模板名称参数
 */

const request = require('supertest');
const { app } = require('../../server');
const db = require('../../config/database');

describe('POST /api/cargo/import-template - 模板导入接口测试', () => {
  // 每个测试前清空货物表
  beforeEach(async () => {
    await db.query('DELETE FROM cargo');
  });

  // 所有测试完成后清空货物表
  afterAll(async () => {
    await db.query('DELETE FROM cargo');
    await db.end();
  });

  /**
   * 测试场景1：成功导入"慈溪小家电"模板
   * 
   * 验收标准：
   * - 返回状态码 200
   * - 返回的货物列表包含3种货物（空气炸锅、取暖器、电风扇）
   * - 每个货物都有唯一的 cargoId
   * - 货物数据与模板定义一致
   */
  test('应该成功导入"慈溪小家电"模板', async () => {
    const response = await request(app)
      .post('/api/cargo/import-template')
      .send({ templateName: '慈溪小家电' })
      .expect(200);

    // 验证响应结构
    expect(response.body.code).toBe(200);
    expect(response.body.message).toContain('导入成功');
    expect(response.body.data).toHaveProperty('cargoList');
    expect(response.body.data).toHaveProperty('templateName', '慈溪小家电');
    expect(response.body.data).toHaveProperty('count', 3);

    // 验证货物列表
    const { cargoList } = response.body.data;
    expect(cargoList).toHaveLength(3);

    // 验证每个货物都有 cargoId
    cargoList.forEach(cargo => {
      expect(cargo.cargoId).toMatch(/^cargo_/);
    });

    // 验证货物名称
    const cargoNames = cargoList.map(c => c.name);
    expect(cargoNames).toContain('空气炸锅');
    expect(cargoNames).toContain('取暖器');
    expect(cargoNames).toContain('电风扇');

    // 验证空气炸锅的数据
    const airFryer = cargoList.find(c => c.name === '空气炸锅');
    expect(airFryer.length).toBe(300);
    expect(airFryer.width).toBe(300);
    expect(airFryer.height).toBe(350);
    expect(airFryer.weight).toBe(5);
    expect(airFryer.quantity).toBe(200);
    expect(airFryer.stackable).toBe(true);
    expect(airFryer.maxStackLayers).toBe(4);
    expect(airFryer.canInvert).toBe(false);
    expect(airFryer.canLayFlat).toBe(false);
  });

  /**
   * 测试场景2：成功导入"宁波文具"模板
   */
  test('应该成功导入"宁波文具"模板', async () => {
    const response = await request(app)
      .post('/api/cargo/import-template')
      .send({ templateName: '宁波文具' })
      .expect(200);

    expect(response.body.code).toBe(200);
    expect(response.body.data.count).toBe(3);

    const { cargoList } = response.body.data;
    const cargoNames = cargoList.map(c => c.name);
    expect(cargoNames).toContain('中性笔（纸箱装）');
    expect(cargoNames).toContain('笔记本（纸箱装）');
    expect(cargoNames).toContain('文具套装（礼盒装）');
  });

  /**
   * 测试场景3：成功导入"宁波汽配"模板
   */
  test('应该成功导入"宁波汽配"模板', async () => {
    const response = await request(app)
      .post('/api/cargo/import-template')
      .send({ templateName: '宁波汽配' })
      .expect(200);

    expect(response.body.code).toBe(200);
    expect(response.body.data.count).toBe(3);

    const { cargoList } = response.body.data;
    const cargoNames = cargoList.map(c => c.name);
    expect(cargoNames).toContain('汽车空气滤芯（纸箱装）');
    expect(cargoNames).toContain('汽车雨刮器（纸箱装）');
    expect(cargoNames).toContain('汽车LED车灯总成（泡沫箱装）');
  });

  /**
   * 测试场景4：处理无效的模板名称
   * 
   * 验收标准：
   * - 返回状态码 400
   * - 返回错误信息提示无效的模板名称
   */
  test('应该拒绝无效的模板名称', async () => {
    const response = await request(app)
      .post('/api/cargo/import-template')
      .send({ templateName: '不存在的模板' })
      .expect(400);

    expect(response.body.code).toBe(400);
    expect(response.body.message).toContain('无效的模板名称');
  });

  /**
   * 测试场景5：处理缺少模板名称参数
   * 
   * 验收标准：
   * - 返回状态码 400
   * - 返回错误信息提示缺少模板名称
   */
  test('应该拒绝缺少模板名称的请求', async () => {
    const response = await request(app)
      .post('/api/cargo/import-template')
      .send({})
      .expect(400);

    expect(response.body.code).toBe(400);
    expect(response.body.message).toContain('缺少模板名称');
  });

  /**
   * 测试场景6：验证货物已保存到数据库
   * 
   * 验收标准：
   * - 导入模板后，可以通过 /api/cargo/list 查询到导入的货物
   * - 数据库中的货物数据与模板定义一致
   */
  test('应该将导入的货物保存到数据库', async () => {
    // 导入模板
    await request(app)
      .post('/api/cargo/import-template')
      .send({ templateName: '慈溪小家电' })
      .expect(200);

    // 查询货物列表
    const response = await request(app)
      .get('/api/cargo/list')
      .expect(200);

    expect(response.body.code).toBe(200);
    expect(response.body.data.cargoList).toHaveLength(3);

    // 验证数据库中的货物名称
    const cargoNames = response.body.data.cargoList.map(c => c.name);
    expect(cargoNames).toContain('空气炸锅');
    expect(cargoNames).toContain('取暖器');
    expect(cargoNames).toContain('电风扇');
  });

  /**
   * 测试场景7：验证批量导入性能
   * 
   * 验收标准：
   * - 导入模板应在合理时间内完成（< 2秒）
   */
  test('应该在合理时间内完成模板导入', async () => {
    const startTime = Date.now();

    await request(app)
      .post('/api/cargo/import-template')
      .send({ templateName: '慈溪小家电' })
      .expect(200);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 验证导入时间小于2秒
    expect(duration).toBeLessThan(2000);
  });
});
