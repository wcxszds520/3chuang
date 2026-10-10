/**
 * 后端服务集成测试
 * 测试目标：
 * 1. 后端服务启动和数据库连接
 * 2. 统一响应格式中间件
 * 
 * 对应需求：1.9, 1.10
 */

const request = require('supertest');
const { app, server } = require('../../server');
const db = require('../../config/database');

/**
 * 测试套件：后端服务基础功能
 */
describe('后端服务基础功能集成测试', () => {
  
  /**
   * 所有测试完成后关闭服务器和数据库连接
   */
  afterAll(async () => {
    // 关闭服务器
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
    
    // 关闭数据库连接池
    if (db && db.end) {
      await db.end();
    }
  });

  /**
   * 测试1：后端服务启动测试
   * 验收标准：WHEN 后端服务启动时，THE 后端服务 SHALL 成功连接MySQL数据库
   * 对应需求：1.5
   */
  describe('1. 后端服务启动测试', () => {
    
    test('Express应用应该成功初始化', () => {
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });

    test('健康检查接口应该返回正常状态', async () => {
      const response = await request(app)
        .get('/api/health');
      
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
    });
  });

  /**
   * 测试2：数据库连接测试
   * 验收标准：WHEN 后端服务启动时，THE 后端服务 SHALL 成功连接MySQL数据库
   * 对应需求：1.5, 1.10
   */
  describe('2. 数据库连接测试', () => {
    
    test('数据库连接应该正常工作', async () => {
      const response = await request(app)
        .get('/api/test/db');
      
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', '数据库连接正常');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('result', 2);
    });

    test('数据库应该能够执行查询操作', async () => {
      const [rows] = await db.query('SELECT 1 + 1 AS result');
      expect(rows).toBeDefined();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].result).toBe(2);
    });

    test('数据库应该能够查询container_type表', async () => {
      const [rows] = await db.query('SELECT * FROM container_type LIMIT 1');
      expect(rows).toBeDefined();
      expect(Array.isArray(rows)).toBe(true);
    });
  });

  /**
   * 测试3：统一响应格式中间件测试
   * 验收标准：THE 后端服务 SHALL 返回统一格式的JSON响应（包含code、message、data字段）
   * 对应需求：1.6
   */
  describe('3. 统一响应格式中间件测试', () => {
    
    test('成功响应应该包含code、message、data字段', async () => {
      const response = await request(app)
        .get('/api/health');
      
      // 验证响应格式
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      
      // 验证字段类型
      expect(typeof response.body.code).toBe('number');
      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.data).toBe('object');
    });

    test('成功响应的code应该为200', async () => {
      const response = await request(app)
        .get('/api/health');
      
      expect(response.body.code).toBe(200);
    });

    test('404错误响应应该包含统一格式', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);
      
      expect(response.body).toHaveProperty('code', 404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data', null);
    });
  });

  /**
   * 测试4：后端服务响应测试
   * 验收标准：WHEN 小程序前端调用后端接口时，THE 后端服务 SHALL 正常响应并返回数据
   * 对应需求：1.9
   */
  describe('4. 后端服务响应测试', () => {
    
    test('后端服务应该能够正常响应GET请求', async () => {
      const response = await request(app)
        .get('/api/health');
      
      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    test('后端服务应该在合理时间内响应（<2秒）', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health');
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // 验证响应时间小于2000毫秒
      expect(responseTime).toBeLessThan(2000);
    });
  });

  /**
   * 测试5：数据库增删改查操作测试
   * 验收标准：WHEN 执行数据库增删改查操作时，THE 后端服务 SHALL 正确执行且数据持久化成功
   * 对应需求：1.10
   */
  describe('5. 数据库增删改查操作测试', () => {
    
    // 测试用的货物ID
    let testCargoId = 'test_cargo_' + Date.now();

    test('数据库应该能够执行INSERT操作', async () => {
      const insertQuery = `
        INSERT INTO cargo (cargo_id, name, length, width, height, weight, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [testCargoId, '测试货物', 1000, 800, 600, 50, 10];
      
      const [result] = await db.query(insertQuery, values);
      
      expect(result).toBeDefined();
      expect(result.affectedRows).toBe(1);
    });

    test('数据库应该能够执行SELECT操作并查询到插入的数据', async () => {
      const selectQuery = 'SELECT * FROM cargo WHERE cargo_id = ?';
      const [rows] = await db.query(selectQuery, [testCargoId]);
      
      expect(rows).toBeDefined();
      expect(rows.length).toBe(1);
      expect(rows[0].cargo_id).toBe(testCargoId);
      expect(rows[0].name).toBe('测试货物');
      expect(rows[0].length).toBe(1000);
      expect(rows[0].width).toBe(800);
      expect(rows[0].height).toBe(600);
      expect(rows[0].weight).toBe('50.00'); // DECIMAL类型返回字符串
      expect(rows[0].quantity).toBe(10);
    });

    test('数据库应该能够执行UPDATE操作', async () => {
      const updateQuery = 'UPDATE cargo SET quantity = ? WHERE cargo_id = ?';
      const [result] = await db.query(updateQuery, [20, testCargoId]);
      
      expect(result).toBeDefined();
      expect(result.affectedRows).toBe(1);
      
      // 验证更新是否成功
      const [rows] = await db.query('SELECT quantity FROM cargo WHERE cargo_id = ?', [testCargoId]);
      expect(rows[0].quantity).toBe(20);
    });

    test('数据库应该能够执行DELETE操作', async () => {
      const deleteQuery = 'DELETE FROM cargo WHERE cargo_id = ?';
      const [result] = await db.query(deleteQuery, [testCargoId]);
      
      expect(result).toBeDefined();
      expect(result.affectedRows).toBe(1);
      
      // 验证删除是否成功
      const [rows] = await db.query('SELECT * FROM cargo WHERE cargo_id = ?', [testCargoId]);
      expect(rows.length).toBe(0);
    });

    test('数据库操作应该正确持久化数据', async () => {
      // 插入新数据
      const newCargoId = 'test_cargo_persist_' + Date.now();
      const insertQuery = `
        INSERT INTO cargo (cargo_id, name, length, width, height, weight, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      await db.query(insertQuery, [newCargoId, '持久化测试', 500, 400, 300, 25, 5]);
      
      // 重新查询验证数据已持久化
      const [rows] = await db.query('SELECT * FROM cargo WHERE cargo_id = ?', [newCargoId]);
      expect(rows.length).toBe(1);
      expect(rows[0].name).toBe('持久化测试');
      
      // 清理测试数据
      await db.query('DELETE FROM cargo WHERE cargo_id = ?', [newCargoId]);
    });
  });
});
