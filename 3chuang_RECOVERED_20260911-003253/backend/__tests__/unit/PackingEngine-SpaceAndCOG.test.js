/**
 * PackingEngine 空间利用率和重心计算测试
 * 
 * 测试目标：
 * - 验证 calculateSpaceUtilization() 方法的正确性
 * - 验证 calculateCenterOfGravity() 方法的正确性
 * - 验证 validateCenterOfGravityBalance() 方法的正确性
 * - 验证重心平衡优化逻辑
 */

const PackingEngine = require('../../services/PackingEngine');
const Cargo = require('../../models/Cargo');
const ContainerType = require('../../models/ContainerType');

describe('PackingEngine - 空间利用率和重心计算', () => {
  let engine;
  let containerType;

  beforeEach(() => {
    engine = new PackingEngine();
    
    // 使用40HQ柜型进行测试
    containerType = new ContainerType({
      typeId: '40HQ',
      name: '40英尺高柜',
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2698,
      maxWeight: 26000,
      description: '适用于大批量、高度较高货物'
    });
  });

  describe('calculateSpaceUtilization - 空间利用率计算', () => {
    test('应该正确计算空间利用率', () => {
      // 创建测试货物
      const cargo1 = new Cargo({
        cargoId: 'test1',
        name: '测试货物1',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1
      });

      const cargo2 = new Cargo({
        cargoId: 'test2',
        name: '测试货物2',
        length: 2000,
        width: 1000,
        height: 1000,
        weight: 200,
        quantity: 1
      });

      // 创建装箱方案
      const plan = {
        loadedCargo: [
          {
            cargo: cargo1,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          },
          {
            cargo: cargo2,
            position: { x: 1000, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ]
      };

      // 计算空间利用率
      const utilization = engine.calculateSpaceUtilization(plan, containerType);

      // 验证结果
      const containerVolume = 12032 * 2352 * 2698;
      const usedVolume = (1000 * 1000 * 1000) + (2000 * 1000 * 1000);
      const expectedUtilization = (usedVolume / containerVolume) * 100;

      expect(utilization).toBeCloseTo(expectedUtilization, 2);
      expect(utilization).toBeGreaterThan(0);
      expect(utilization).toBeLessThanOrEqual(100);
    });

    test('空装箱方案应该返回0%利用率', () => {
      const plan = {
        loadedCargo: []
      };

      const utilization = engine.calculateSpaceUtilization(plan, containerType);
      expect(utilization).toBe(0);
    });
  });

  describe('calculateCenterOfGravity - 重心位置计算', () => {
    test('应该正确计算单个货物的重心位置', () => {
      const cargo = new Cargo({
        cargoId: 'test1',
        name: '测试货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1
      });

      const plan = {
        loadedCargo: [
          {
            cargo: cargo,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ]
      };

      const cog = engine.calculateCenterOfGravity(plan);

      // 货物中心应该在 (500, 500, 500)
      expect(cog.x).toBe(500);
      expect(cog.y).toBe(500);
      expect(cog.z).toBe(500);
    });

    test('应该正确计算多个货物的加权重心', () => {
      // 创建两个不同重量的货物
      const cargo1 = new Cargo({
        cargoId: 'test1',
        name: '轻货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,  // 轻
        quantity: 1
      });

      const cargo2 = new Cargo({
        cargoId: 'test2',
        name: '重货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 300,  // 重
        quantity: 1
      });

      const plan = {
        loadedCargo: [
          {
            cargo: cargo1,
            position: { x: 0, y: 0, z: 0 },  // 左侧
            rotation: { x: 0, y: 0, z: 0 }
          },
          {
            cargo: cargo2,
            position: { x: 2000, y: 0, z: 0 },  // 右侧
            rotation: { x: 0, y: 0, z: 0 }
          }
        ]
      };

      const cog = engine.calculateCenterOfGravity(plan);

      // 重心应该偏向重货物
      // 轻货物中心: (500, 500, 500), 重量100
      // 重货物中心: (2500, 500, 500), 重量300
      // 加权X = (100*500 + 300*2500) / 400 = 2000
      expect(cog.x).toBe(2000);
      expect(cog.y).toBe(500);
      expect(cog.z).toBe(500);
    });

    test('空装箱方案应该返回原点重心', () => {
      const plan = {
        loadedCargo: []
      };

      const cog = engine.calculateCenterOfGravity(plan);
      expect(cog.x).toBe(0);
      expect(cog.y).toBe(0);
      expect(cog.z).toBe(0);
    });
  });

  describe('validateCenterOfGravityBalance - 重心平衡验证', () => {
    test('完美平衡的方案应该通过验证', () => {
      // 创建一个位于集装箱中心的货物
      const cargo = new Cargo({
        cargoId: 'test1',
        name: '中心货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1
      });

      const plan = {
        loadedCargo: [
          {
            cargo: cargo,
            // 放置在集装箱中心
            position: {
              x: containerType.innerLength / 2 - 500,
              y: containerType.innerWidth / 2 - 500,
              z: 0
            },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ]
      };

      const balance = engine.validateCenterOfGravityBalance(plan, containerType);

      expect(balance.balanced).toBe(true);
      expect(balance.frontBackPassed).toBe(true);
      expect(balance.leftRightPassed).toBe(true);
      expect(balance.frontBackDeviation).toBeLessThanOrEqual(10);
      expect(balance.leftRightDeviation).toBeLessThanOrEqual(5);
      expect(balance.suggestions).toHaveLength(0);
    });

    test('前后偏差超标应该生成优化建议', () => {
      const cargo = new Cargo({
        cargoId: 'test1',
        name: '前端货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1
      });

      const plan = {
        loadedCargo: [
          {
            cargo: cargo,
            // 放置在集装箱最前端
            position: { x: 0, y: containerType.innerWidth / 2 - 500, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ]
      };

      const balance = engine.validateCenterOfGravityBalance(plan, containerType);

      expect(balance.balanced).toBe(false);
      expect(balance.frontBackPassed).toBe(false);
      expect(balance.frontBackDeviation).toBeGreaterThan(10);
      expect(balance.suggestions.length).toBeGreaterThan(0);
      expect(balance.suggestions[0]).toContain('重心偏');
      expect(balance.suggestions[0]).toContain('建议将重货向');
    });

    test('左右偏差超标应该生成优化建议', () => {
      const cargo = new Cargo({
        cargoId: 'test1',
        name: '左侧货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1
      });

      const plan = {
        loadedCargo: [
          {
            cargo: cargo,
            // 放置在集装箱最左侧
            position: { x: containerType.innerLength / 2 - 500, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ]
      };

      const balance = engine.validateCenterOfGravityBalance(plan, containerType);

      expect(balance.balanced).toBe(false);
      expect(balance.leftRightPassed).toBe(false);
      expect(balance.leftRightDeviation).toBeGreaterThan(5);
      expect(balance.suggestions.length).toBeGreaterThan(0);
      expect(balance.suggestions[0]).toContain('重心偏');
      expect(balance.suggestions[0]).toContain('建议将重货向');
    });

    test('应该返回完整的验证结果对象', () => {
      const cargo = new Cargo({
        cargoId: 'test1',
        name: '测试货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1
      });

      const plan = {
        loadedCargo: [
          {
            cargo: cargo,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ]
      };

      const balance = engine.validateCenterOfGravityBalance(plan, containerType);

      // 验证返回对象包含所有必需字段
      expect(balance).toHaveProperty('balanced');
      expect(balance).toHaveProperty('centerOfGravity');
      expect(balance).toHaveProperty('containerCenter');
      expect(balance).toHaveProperty('frontBackDeviation');
      expect(balance).toHaveProperty('leftRightDeviation');
      expect(balance).toHaveProperty('frontBackPassed');
      expect(balance).toHaveProperty('leftRightPassed');
      expect(balance).toHaveProperty('suggestions');
      
      expect(balance.centerOfGravity).toHaveProperty('x');
      expect(balance.centerOfGravity).toHaveProperty('y');
      expect(balance.centerOfGravity).toHaveProperty('z');
      
      expect(balance.containerCenter).toHaveProperty('x');
      expect(balance.containerCenter).toHaveProperty('y');
      expect(balance.containerCenter).toHaveProperty('z');
    });
  });
});
