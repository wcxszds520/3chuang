/**
 * 柜型管理API集成测试
 * 测试目标：验证柜型查询接口的正确性
 */

const request = require('supertest');
const { app } = require('../../server');
const db = require('../../config/database');

describe('柜型管理API集成测试', () => {
  
  // 在所有测试前确保柜型数据存在
  beforeAll(async () => {
    // 删除现有数据
    await db.query('DELETE FROM container_type');
    
    // 插入标准柜型数据
    await db.query(`
      INSERT INTO container_type (type_id, name, inner_length, inner_width, inner_height, max_weight, description) VALUES
      ('20GP', '20英尺标准柜', 5898, 2352, 2393, 28000, '适用于小批量、高密度货物'),
      ('40GP', '40英尺标准柜', 12032, 2352, 2393, 26000, '适用于大批量、标准尺寸货物'),
      ('40HQ', '40英尺高柜', 12032, 2352, 2698, 26000, '适用于大批量、高度较高货物')
    `);
  });
  
  // 所有测试完成后关闭数据库连接
  afterAll(async () => {
    await db.end();
  });
  
  describe('GET /api/container/list - 查询柜型列表', () => {
    
    test('应该成功返回3种标准柜型数据', async () => {
      const response = await request(app)
        .get('/api/container/list')
        .expect(200);

      // 验证响应格式
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', '查询成功');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('containerTypes');

      // 验证返回的柜型数量
      const containerTypes = response.body.data.containerTypes;
      expect(containerTypes).toHaveLength(3);

      // 验证柜型数据结构
      containerTypes.forEach(container => {
        expect(container).toHaveProperty('typeId');
        expect(container).toHaveProperty('name');
        expect(container).toHaveProperty('innerLength');
        expect(container).toHaveProperty('innerWidth');
        expect(container).toHaveProperty('innerHeight');
        expect(container).toHaveProperty('maxWeight');
        expect(container).toHaveProperty('description');
      });
    });

    test('应该按照正确的顺序返回柜型（20GP、40GP、40HQ）', async () => {
      const response = await request(app)
        .get('/api/container/list')
        .expect(200);

      const containerTypes = response.body.data.containerTypes;
      
      // 验证柜型顺序
      expect(containerTypes[0].typeId).toBe('20GP');
      expect(containerTypes[1].typeId).toBe('40GP');
      expect(containerTypes[2].typeId).toBe('40HQ');
    });

    test('应该返回20GP柜型的正确参数', async () => {
      const response = await request(app)
        .get('/api/container/list')
        .expect(200);

      const gp20 = response.body.data.containerTypes.find(c => c.typeId === '20GP');
      
      // 验证20GP柜型参数（需求4.2）
      expect(gp20.name).toBe('20英尺标准柜');
      expect(gp20.innerLength).toBe(5898);
      expect(gp20.innerWidth).toBe(2352);
      expect(gp20.innerHeight).toBe(2393);
      expect(gp20.maxWeight).toBe(28000);
      expect(gp20.description).toBeTruthy();
    });

    test('应该返回40GP柜型的正确参数', async () => {
      const response = await request(app)
        .get('/api/container/list')
        .expect(200);

      const gp40 = response.body.data.containerTypes.find(c => c.typeId === '40GP');
      
      // 验证40GP柜型参数（需求4.3）
      expect(gp40.name).toBe('40英尺标准柜');
      expect(gp40.innerLength).toBe(12032);
      expect(gp40.innerWidth).toBe(2352);
      expect(gp40.innerHeight).toBe(2393);
      expect(gp40.maxWeight).toBe(26000);
      expect(gp40.description).toBeTruthy();
    });

    test('应该返回40HQ柜型的正确参数', async () => {
      const response = await request(app)
        .get('/api/container/list')
        .expect(200);

      const hq40 = response.body.data.containerTypes.find(c => c.typeId === '40HQ');
      
      // 验证40HQ柜型参数（需求4.4）
      expect(hq40.name).toBe('40英尺高柜');
      expect(hq40.innerLength).toBe(12032);
      expect(hq40.innerWidth).toBe(2352);
      expect(hq40.innerHeight).toBe(2698);
      expect(hq40.maxWeight).toBe(26000);
      expect(hq40.description).toBeTruthy();
    });

    test('所有柜型的尺寸和重量应该为正数', async () => {
      const response = await request(app)
        .get('/api/container/list')
        .expect(200);

      const containerTypes = response.body.data.containerTypes;
      
      containerTypes.forEach(container => {
        expect(container.innerLength).toBeGreaterThan(0);
        expect(container.innerWidth).toBeGreaterThan(0);
        expect(container.innerHeight).toBeGreaterThan(0);
        expect(container.maxWeight).toBeGreaterThan(0);
      });
    });

  });

});
