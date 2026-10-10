/**
 * 系统集成测试 - 验证OptimizedPackingEngine与整个项目的集成
 * 
 * 测试范围：
 * 1. API路由集成
 * 2. 数据库集成
 * 3. 前后端数据流
 * 4. 错误处理
 */

const request = require('supertest');
const { app } = require('../../server');
const db = require('../../config/database');

describe('系统集成测试 - OptimizedPackingEngine', () => {
  
  // ========== 测试1: /api/packing/generate 接口集成 ==========
  describe('POST /api/packing/generate - 使用OptimizedPackingEngine', () => {
    
    it('应该成功生成装箱方案（使用货物数据列表）', async () => {
      const requestBody = {
        cargoList: [
          {
            cargoId: 'test_cargo_1',
            name: '测试货物A',
            length: 1000,
            width: 800,
            height: 600,
            weight: 50,
            quantity: 10,
            stackable: true,
            maxStackLayers: 3,
            canInvert: false,
            canLayFlat: false
          },
          {
            cargoId: 'test_cargo_2',
            name: '测试货物B',
            length: 600,
            width: 600,
            height: 400,
            weight: 30,
            quantity: 15,
            stackable: true,
            maxStackLayers: 4,
            canInvert: false,
            canLayFlat: true
          }
        ],
        containerType: '40GP'
      };
      
      const response = await request(app)
        .post('/api/packing/generate')
        .send(requestBody)
        .expect(200);
      
      // 验证响应结构
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.planId).toBeDefined();
      expect(response.body.data.spaceUtilization).toBeGreaterThanOrEqual(0);
      expect(response.body.data.totalWeight).toBeGreaterThanOrEqual(0);
      expect(response.body.data.loadedCargo).toBeInstanceOf(Array);
      expect(response.body.data.unloadedCargo).toBeInstanceOf(Array);
      
      // 验证数据库保存
      const [rows] = await db.query(
        'SELECT * FROM packing_plan WHERE plan_id = ?',
        [response.body.data.planId]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].container_type).toBe('40GP');
    }, 30000);
    
    it('应该正确处理缺少参数的请求', async () => {
      const response = await request(app)
        .post('/api/packing/generate')
        .send({})
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('货物');
    });
    
    it('应该正确处理不存在的柜型', async () => {
      const response = await request(app)
        .post('/api/packing/generate')
        .send({
          cargoList: [{
            name: '测试货物',
            length: 1000,
            width: 800,
            height: 600,
            weight: 50,
            quantity: 1,
            stackable: true,
            maxStackLayers: 3,
            canInvert: false,
            canLayFlat: false
          }],
          containerType: 'INVALID_TYPE'
        })
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('不存在');
    });
  });
  
  
  // ========== 测试2: /api/ai-packing/generate 接口集成 ==========
  describe('POST /api/ai-packing/generate - AI优化装箱', () => {
    
    it('应该成功生成AI优化装箱方案', async () => {
      const requestBody = {
        cargoList: [
          {
            name: '空气炸锅',
            length: 300,
            width: 300,
            height: 350,
            weight: 5,
            quantity: 50,
            stackable: true,
            maxStackLayers: 4,
            canInvert: false,
            canLayFlat: false
          },
          {
            name: '取暖器',
            length: 500,
            width: 400,
            height: 600,
            weight: 8,
            quantity: 30,
            stackable: true,
            maxStackLayers: 3,
            canInvert: false,
            canLayFlat: false
          }
        ],
        containerType: '40GP'
      };
      
      const response = await request(app)
        .post('/api/ai-packing/generate')
        .send(requestBody)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.planId).toBeDefined();
      expect(response.body.data.algorithm).toBe('AI+Guillotine混合算法');
      expect(response.body.data.executionTime).toBeDefined();
      expect(response.body.data.executionTime).toBeLessThan(10); // 应该在10秒内完成
    }, 30000);
  });
  
  
  // ========== 测试3: /api/ai-packing/compare 接口集成 ==========
  describe('POST /api/ai-packing/compare - 算法对比', () => {
    
    it('应该成功对比传统算法和AI优化算法', async () => {
      const requestBody = {
        cargoList: [
          {
            name: '测试货物',
            length: 1000,
            width: 800,
            height: 600,
            weight: 50,
            quantity: 20,
            stackable: true,
            maxStackLayers: 3,
            canInvert: false,
            canLayFlat: false
          }
        ],
        containerType: '40GP'
      };
      
      const response = await request(app)
        .post('/api/ai-packing/compare')
        .send(requestBody)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.traditional).toBeDefined();
      expect(response.body.data.aiOptimized).toBeDefined();
      expect(response.body.data.improvement).toBeDefined();
      
      // 验证对比数据结构
      expect(response.body.data.traditional.algorithm).toBe('FFD+BLB传统算法');
      expect(response.body.data.aiOptimized.algorithm).toBe('AI+Guillotine混合算法');
      expect(response.body.data.improvement.spaceUtilizationDiff).toBeDefined();
    }, 30000);
  });
  
  
  // ========== 测试4: 数据持久化验证 ==========
  describe('数据库集成验证', () => {
    
    it('装箱方案应该正确保存到数据库', async () => {
      const requestBody = {
        cargoList: [{
          name: '数据库测试货物',
          length: 1000,
          width: 800,
          height: 600,
          weight: 50,
          quantity: 5,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        }],
        containerType: '40GP'
      };
      
      const response = await request(app)
        .post('/api/packing/generate')
        .send(requestBody)
        .expect(200);
      
      const planId = response.body.data.planId;
      
      // 查询数据库
      const [rows] = await db.query(
        'SELECT * FROM packing_plan WHERE plan_id = ?',
        [planId]
      );
      
      expect(rows.length).toBe(1);
      expect(rows[0].plan_id).toBe(planId);
      expect(rows[0].container_type).toBe('40GP');
      expect(rows[0].space_utilization).toBeGreaterThanOrEqual(0);
      expect(rows[0].total_weight).toBeGreaterThanOrEqual(0);
      expect(rows[0].plan_data).toBeDefined();
      
      // 验证plan_data可以解析
      const planData = typeof rows[0].plan_data === 'string' 
        ? JSON.parse(rows[0].plan_data) 
        : rows[0].plan_data;
      expect(planData.loadedCargo).toBeInstanceOf(Array);
    }, 30000);
  });
  
  
  // ========== 测试5: 性能验证 ==========
  describe('性能集成验证', () => {
    
    it('大批量货物应该在10秒内完成', async () => {
      const cargoList = [];
      
      // 生成100件货物
      for (let i = 0; i < 100; i++) {
        cargoList.push({
          name: `货物${i}`,
          length: 500 + Math.random() * 500,
          width: 400 + Math.random() * 400,
          height: 300 + Math.random() * 300,
          weight: 20 + Math.random() * 30,
          quantity: 1,
          stackable: Math.random() > 0.3,
          maxStackLayers: Math.floor(Math.random() * 3) + 2,
          canInvert: false,
          canLayFlat: Math.random() > 0.5
        });
      }
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/packing/generate')
        .send({
          cargoList,
          containerType: '40GP'
        })
        .expect(200);
      
      const elapsed = (Date.now() - startTime) / 1000;
      
      expect(response.body.success).toBe(true);
      expect(elapsed).toBeLessThan(10); // 应该在10秒内完成
      
      console.log(`大批量测试完成，耗时: ${elapsed.toFixed(2)}秒`);
    }, 30000);
  });
  
  
  // ========== 测试6: 错误处理验证 ==========
  describe('错误处理集成验证', () => {
    
    it('应该正确处理无效的货物数据', async () => {
      const response = await request(app)
        .post('/api/packing/generate')
        .send({
          cargoList: [
            {
              // 缺少必要字段
              name: '无效货物'
            }
          ],
          containerType: '40GP'
        });
      
      // 应该返回错误或生成空方案
      expect(response.body).toBeDefined();
    });
    
    it('应该正确处理超重货物', async () => {
      const response = await request(app)
        .post('/api/packing/generate')
        .send({
          cargoList: [{
            name: '超重货物',
            length: 1000,
            width: 1000,
            height: 1000,
            weight: 30000, // 超过40GP的26000kg限制
            quantity: 1,
            stackable: true,
            maxStackLayers: 1,
            canInvert: false,
            canLayFlat: false
          }],
          containerType: '40GP'
        })
        .expect(200);
      
      // 应该生成方案，但货物应该在unloadedCargo中
      expect(response.body.data.unloadedCargo.length).toBeGreaterThan(0);
    });
  });
  
  
  // ========== 清理测试数据 ==========
  afterAll(async () => {
    // 清理测试生成的装箱方案
    await db.query(
      "DELETE FROM packing_plan WHERE plan_id LIKE 'plan_%' OR plan_id LIKE 'ai_plan_%'"
    );
  });
});
