/**
 * 货物管理API集成测试
 * 测试所有货物相关的API接口
 */

const request = require('supertest');
const { app } = require('../../server');
const db = require('../../config/database');

describe('货物管理API测试', () => {
  let testCargoId;

  // 每个测试前清空cargo表
  beforeEach(async () => {
    await db.query('DELETE FROM cargo');
  });

  // 所有测试完成后清理
  afterAll(async () => {
    await db.query('DELETE FROM cargo');
    await db.end();
  });

  describe('POST /api/cargo/create - 创建货物', () => {
    test('应该成功创建货物', async () => {
      const cargoData = {
        name: '空气炸锅',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false
      };

      const response = await request(app)
        .post('/api/cargo/create')
        .send(cargoData)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('货物创建成功');
      expect(response.body.data.cargoId).toBeDefined();
      expect(response.body.data.cargoId).toMatch(/^cargo_/);

      testCargoId = response.body.data.cargoId;
    });

    test('应该拒绝缺少必需参数的请求', async () => {
      const response = await request(app)
        .post('/api/cargo/create')
        .send({ name: '测试货物' });

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('缺少必需参数');
    });

    test('应该拒绝负数尺寸', async () => {
      const cargoData = {
        name: '测试货物',
        length: -100,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10
      };

      const response = await request(app)
        .post('/api/cargo/create')
        .send(cargoData);

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('货物尺寸必须为正数');
    });

    test('应该拒绝负数重量', async () => {
      const cargoData = {
        name: '测试货物',
        length: 300,
        width: 300,
        height: 350,
        weight: -5,
        quantity: 10
      };

      const response = await request(app)
        .post('/api/cargo/create')
        .send(cargoData);

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('货物重量必须为正数');
    });

    test('应该拒绝超出柜型尺寸限制的货物', async () => {
      const cargoData = {
        name: '超大货物',
        length: 15000, // 超过40HQ的12032mm
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10
      };

      const response = await request(app)
        .post('/api/cargo/create')
        .send(cargoData);

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('货物尺寸超出最大柜型限制（40HQ）');
    });

    test('应该拒绝超重的货物', async () => {
      const cargoData = {
        name: '超重货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 30000, // 超过26000kg限制
        quantity: 10
      };

      const response = await request(app)
        .post('/api/cargo/create')
        .send(cargoData);

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('单件货物重量超出柜型载重限制');
    });

    test('应该使用默认值创建货物', async () => {
      const cargoData = {
        name: '简单货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10
      };

      const response = await request(app)
        .post('/api/cargo/create')
        .send(cargoData)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.cargoId).toBeDefined();
    });
  });

  describe('GET /api/cargo/list - 查询货物列表', () => {
    beforeEach(async () => {
      // 创建测试数据
      await request(app)
        .post('/api/cargo/create')
        .send({
          name: '货物1',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 10
        });

      await request(app)
        .post('/api/cargo/create')
        .send({
          name: '货物2',
          length: 400,
          width: 400,
          height: 500,
          weight: 8,
          quantity: 20
        });
    });

    test('应该返回所有货物列表', async () => {
      const response = await request(app)
        .get('/api/cargo/list')
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('查询成功');
      expect(response.body.data.cargoList).toBeDefined();
      expect(response.body.data.cargoList.length).toBe(2);
      expect(response.body.data.cargoList[0].name).toBeDefined();
      expect(response.body.data.cargoList[0].cargoId).toBeDefined();
    });

    test('应该返回正确的字段格式', async () => {
      const response = await request(app)
        .get('/api/cargo/list')
        .expect(200);

      const cargo = response.body.data.cargoList[0];
      expect(cargo).toHaveProperty('cargoId');
      expect(cargo).toHaveProperty('name');
      expect(cargo).toHaveProperty('length');
      expect(cargo).toHaveProperty('width');
      expect(cargo).toHaveProperty('height');
      expect(cargo).toHaveProperty('weight');
      expect(cargo).toHaveProperty('quantity');
      expect(cargo).toHaveProperty('stackable');
      expect(cargo).toHaveProperty('maxStackLayers');
      expect(cargo).toHaveProperty('canInvert');
      expect(cargo).toHaveProperty('canLayFlat');
    });

    test('空列表应该返回空数组', async () => {
      await db.query('DELETE FROM cargo');

      const response = await request(app)
        .get('/api/cargo/list')
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.cargoList).toEqual([]);
    });
  });

  describe('PUT /api/cargo/update/:cargoId - 更新货物', () => {
    beforeEach(async () => {
      // 创建测试货物
      const response = await request(app)
        .post('/api/cargo/create')
        .send({
          name: '测试货物',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 10
        });

      testCargoId = response.body.data.cargoId;
    });

    test('应该成功更新货物数量', async () => {
      const response = await request(app)
        .put(`/api/cargo/update/${testCargoId}`)
        .send({ quantity: 250 })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('货物更新成功');

      // 验证更新结果
      const listResponse = await request(app).get('/api/cargo/list');
      const updatedCargo = listResponse.body.data.cargoList.find(c => c.cargoId === testCargoId);
      expect(updatedCargo.quantity).toBe(250);
    });

    test('应该成功更新多个字段', async () => {
      const response = await request(app)
        .put(`/api/cargo/update/${testCargoId}`)
        .send({
          name: '更新后的货物',
          quantity: 100,
          weight: 10
        })
        .expect(200);

      expect(response.body.code).toBe(200);

      // 验证更新结果
      const listResponse = await request(app).get('/api/cargo/list');
      const updatedCargo = listResponse.body.data.cargoList.find(c => c.cargoId === testCargoId);
      expect(updatedCargo.name).toBe('更新后的货物');
      expect(updatedCargo.quantity).toBe(100);
      expect(updatedCargo.weight).toBe(10);
    });

    test('应该拒绝更新不存在的货物', async () => {
      const response = await request(app)
        .put('/api/cargo/update/nonexistent_id')
        .send({ quantity: 100 });

      expect(response.body.code).toBe(404);
      expect(response.body.message).toBe('货物不存在');
    });

    test('应该拒绝更新为负数尺寸', async () => {
      const response = await request(app)
        .put(`/api/cargo/update/${testCargoId}`)
        .send({ length: -100 });

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('货物尺寸必须为正数');
    });

    test('应该拒绝更新为超出限制的重量', async () => {
      const response = await request(app)
        .put(`/api/cargo/update/${testCargoId}`)
        .send({ weight: 30000 });

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('单件货物重量超出柜型载重限制');
    });

    test('应该拒绝没有更新字段的请求', async () => {
      const response = await request(app)
        .put(`/api/cargo/update/${testCargoId}`)
        .send({});

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('没有提供要更新的字段');
    });
  });

  describe('DELETE /api/cargo/delete/:cargoId - 删除货物', () => {
    beforeEach(async () => {
      // 创建测试货物
      const response = await request(app)
        .post('/api/cargo/create')
        .send({
          name: '测试货物',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 10
        });

      testCargoId = response.body.data.cargoId;
    });

    test('应该成功删除货物', async () => {
      const response = await request(app)
        .delete(`/api/cargo/delete/${testCargoId}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('货物删除成功');

      // 验证货物已被删除
      const listResponse = await request(app).get('/api/cargo/list');
      const deletedCargo = listResponse.body.data.cargoList.find(c => c.cargoId === testCargoId);
      expect(deletedCargo).toBeUndefined();
    });

    test('应该拒绝删除不存在的货物', async () => {
      const response = await request(app)
        .delete('/api/cargo/delete/nonexistent_id');

      expect(response.body.code).toBe(404);
      expect(response.body.message).toBe('货物不存在');
    });
  });

  describe('DELETE /api/cargo/clear - 清空货物', () => {
    beforeEach(async () => {
      // 创建多个测试货物
      await request(app)
        .post('/api/cargo/create')
        .send({
          name: '货物1',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 10
        });

      await request(app)
        .post('/api/cargo/create')
        .send({
          name: '货物2',
          length: 400,
          width: 400,
          height: 500,
          weight: 8,
          quantity: 20
        });

      await request(app)
        .post('/api/cargo/create')
        .send({
          name: '货物3',
          length: 500,
          width: 500,
          height: 600,
          weight: 10,
          quantity: 30
        });
    });

    test('应该成功清空所有货物', async () => {
      const response = await request(app)
        .delete('/api/cargo/clear')
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('货物清空成功');
      expect(response.body.data.deletedCount).toBe(3);

      // 验证所有货物已被清空
      const listResponse = await request(app).get('/api/cargo/list');
      expect(listResponse.body.data.cargoList.length).toBe(0);
    });

    test('清空空列表应该返回0', async () => {
      // 先清空一次
      await request(app).delete('/api/cargo/clear');

      // 再次清空
      const response = await request(app)
        .delete('/api/cargo/clear')
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.deletedCount).toBe(0);
    });
  });

  describe('API集成测试 - 完整流程', () => {
    test('应该完成创建、查询、更新、删除的完整流程', async () => {
      // 1. 创建货物
      const createResponse = await request(app)
        .post('/api/cargo/create')
        .send({
          name: '集成测试货物',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 100
        });

      expect(createResponse.body.code).toBe(200);
      const cargoId = createResponse.body.data.cargoId;

      // 2. 查询货物列表
      const listResponse = await request(app).get('/api/cargo/list');
      expect(listResponse.body.data.cargoList.length).toBeGreaterThan(0);
      const cargo = listResponse.body.data.cargoList.find(c => c.cargoId === cargoId);
      expect(cargo.name).toBe('集成测试货物');

      // 3. 更新货物
      const updateResponse = await request(app)
        .put(`/api/cargo/update/${cargoId}`)
        .send({ quantity: 200 });
      expect(updateResponse.body.code).toBe(200);

      // 4. 验证更新
      const listResponse2 = await request(app).get('/api/cargo/list');
      const updatedCargo = listResponse2.body.data.cargoList.find(c => c.cargoId === cargoId);
      expect(updatedCargo.quantity).toBe(200);

      // 5. 删除货物
      const deleteResponse = await request(app).delete(`/api/cargo/delete/${cargoId}`);
      expect(deleteResponse.body.code).toBe(200);

      // 6. 验证删除
      const listResponse3 = await request(app).get('/api/cargo/list');
      const deletedCargo = listResponse3.body.data.cargoList.find(c => c.cargoId === cargoId);
      expect(deletedCargo).toBeUndefined();
    });
  });

  describe('POST /api/cargo/create - 边界条件测试', () => {
    test('应该接受最小有效值', async () => {
      const response = await request(app)
        .post('/api/cargo/create')
        .send({
          name: '最小货物',
          length: 1,
          width: 1,
          height: 1,
          weight: 0.1,
          quantity: 1
        })
        .expect(200);

      expect(response.body.code).toBe(200);
    });

    test('应该拒绝零值尺寸', async () => {
      const response = await request(app)
        .post('/api/cargo/create')
        .send({
          name: '零尺寸货物',
          length: 0,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 10
        });

      expect(response.body.code).toBe(400);
    });

    test('应该拒绝非数字类型的参数', async () => {
      const response = await request(app)
        .post('/api/cargo/create')
        .send({
          name: '测试货物',
          length: 'abc',
          width: 300,
          height: 350,
          weight: 5,
          quantity: 10
        });

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('尺寸、重量和数量必须为数字');
    });

    test('应该拒绝非整数数量', async () => {
      const response = await request(app)
        .post('/api/cargo/create')
        .send({
          name: '测试货物',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 10.5
        });

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('货物数量必须为正整数');
    });
  });

  describe('PUT /api/cargo/update/:cargoId - 边界条件测试', () => {
    let testCargoId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/cargo/create')
        .send({
          name: '测试货物',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 10
        });
      testCargoId = response.body.data.cargoId;
    });

    test('应该拒绝更新为零值', async () => {
      const response = await request(app)
        .put(`/api/cargo/update/${testCargoId}`)
        .send({ quantity: 0 });

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('货物数量必须为正整数');
    });

    test('应该拒绝更新为非整数数量', async () => {
      const response = await request(app)
        .put(`/api/cargo/update/${testCargoId}`)
        .send({ quantity: 10.5 });

      expect(response.body.code).toBe(400);
    });

    test('应该接受边界值更新（26000kg）', async () => {
      const response = await request(app)
        .put(`/api/cargo/update/${testCargoId}`)
        .send({ weight: 26000 })
        .expect(200);

      expect(response.body.code).toBe(200);
    });

    test('应该拒绝更新为超出尺寸限制', async () => {
      const response = await request(app)
        .put(`/api/cargo/update/${testCargoId}`)
        .send({ 
          length: 15000,
          width: 3000,
          height: 3000
        });

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('货物尺寸超出最大柜型限制（40HQ）');
    });

    test('应该忽略不允许的字段', async () => {
      const response = await request(app)
        .put(`/api/cargo/update/${testCargoId}`)
        .send({ 
          quantity: 100,
          invalidField: 'should be ignored'
        })
        .expect(200);

      expect(response.body.code).toBe(200);
    });
  });

  describe('POST /api/cargo/import-template - 模板导入测试', () => {
    test('应该成功导入慈溪小家电模板', async () => {
      const response = await request(app)
        .post('/api/cargo/import-template')
        .send({ templateName: '慈溪小家电' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.cargoList).toBeDefined();
      expect(response.body.data.cargoList.length).toBeGreaterThan(0);
      expect(response.body.data.templateName).toBe('慈溪小家电');
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    test('应该拒绝无效的模板名称', async () => {
      const response = await request(app)
        .post('/api/cargo/import-template')
        .send({ templateName: '不存在的模板' });

      expect(response.body.code).toBe(400);
      expect(response.body.message).toContain('无效的模板名称');
    });

    test('应该拒绝缺少模板名称参数', async () => {
      const response = await request(app)
        .post('/api/cargo/import-template')
        .send({});

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('缺少模板名称参数');
    });

    test('导入的货物应该有唯一的cargoId', async () => {
      const response = await request(app)
        .post('/api/cargo/import-template')
        .send({ templateName: '慈溪小家电' })
        .expect(200);

      const cargoIds = response.body.data.cargoList.map(c => c.cargoId);
      const uniqueIds = new Set(cargoIds);
      expect(uniqueIds.size).toBe(cargoIds.length);
    });

    test('导入的货物应该保存到数据库', async () => {
      const importResponse = await request(app)
        .post('/api/cargo/import-template')
        .send({ templateName: '慈溪小家电' });

      const importedCount = importResponse.body.data.count;

      // 查询数据库验证
      const listResponse = await request(app).get('/api/cargo/list');
      expect(listResponse.body.data.cargoList.length).toBe(importedCount);
    });
  });

  describe('异常场景测试', () => {
    test('应该处理数据库连接错误', async () => {
      // Note: This test would require mocking the database
      // For now, we just verify the API handles errors gracefully
      const response = await request(app)
        .delete('/api/cargo/delete/invalid_id_format');

      // Should return 404 or 500, not crash
      expect([404, 500]).toContain(response.body.code);
    });

    test('应该处理并发创建请求', async () => {
      const requests = Array(5).fill(null).map((_, i) => 
        request(app)
          .post('/api/cargo/create')
          .send({
            name: `并发货物${i}`,
            length: 300,
            width: 300,
            height: 350,
            weight: 5,
            quantity: 10
          })
      );

      const responses = await Promise.all(requests);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.body.code).toBe(200);
      });

      // All should have unique IDs
      const cargoIds = responses.map(r => r.body.data.cargoId);
      const uniqueIds = new Set(cargoIds);
      expect(uniqueIds.size).toBe(5);
    });

    test('应该处理大批量货物查询', async () => {
      // Create 20 cargo items
      const createPromises = Array(20).fill(null).map((_, i) =>
        request(app)
          .post('/api/cargo/create')
          .send({
            name: `批量货物${i}`,
            length: 300,
            width: 300,
            height: 350,
            weight: 5,
            quantity: 10
          })
      );

      await Promise.all(createPromises);

      // Query all
      const response = await request(app)
        .get('/api/cargo/list')
        .expect(200);

      expect(response.body.data.cargoList.length).toBe(20);
    });
  });

  describe('数据一致性测试', () => {
    test('更新后的数据应该立即在查询中反映', async () => {
      // Create
      const createResponse = await request(app)
        .post('/api/cargo/create')
        .send({
          name: '一致性测试货物',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 100
        });

      const cargoId = createResponse.body.data.cargoId;

      // Update
      await request(app)
        .put(`/api/cargo/update/${cargoId}`)
        .send({ quantity: 200, name: '更新后的名称' });

      // Query immediately
      const listResponse = await request(app).get('/api/cargo/list');
      const cargo = listResponse.body.data.cargoList.find(c => c.cargoId === cargoId);

      expect(cargo.quantity).toBe(200);
      expect(cargo.name).toBe('更新后的名称');
    });

    test('删除后的货物不应该出现在查询结果中', async () => {
      // Create
      const createResponse = await request(app)
        .post('/api/cargo/create')
        .send({
          name: '待删除货物',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 100
        });

      const cargoId = createResponse.body.data.cargoId;

      // Delete
      await request(app).delete(`/api/cargo/delete/${cargoId}`);

      // Query immediately
      const listResponse = await request(app).get('/api/cargo/list');
      const cargo = listResponse.body.data.cargoList.find(c => c.cargoId === cargoId);

      expect(cargo).toBeUndefined();
    });

    test('清空操作应该删除所有货物', async () => {
      // Create multiple items
      await request(app).post('/api/cargo/create').send({
        name: '货物1', length: 300, width: 300, height: 350, weight: 5, quantity: 10
      });
      await request(app).post('/api/cargo/create').send({
        name: '货物2', length: 400, width: 400, height: 450, weight: 8, quantity: 20
      });

      // Clear
      await request(app).delete('/api/cargo/clear');

      // Verify
      const listResponse = await request(app).get('/api/cargo/list');
      expect(listResponse.body.data.cargoList.length).toBe(0);
    });
  });
});
