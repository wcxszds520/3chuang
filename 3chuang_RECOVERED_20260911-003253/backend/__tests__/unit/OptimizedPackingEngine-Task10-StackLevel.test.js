/**
 * Task 10.1 测试: 堆叠层级信息记录
 * 
 * 验证需求:
 * - 需求 2.5: 记录每个货物的堆叠层级信息
 * 
 * 测试目标:
 * 1. 验证底层货物的stackLevel为0
 * 2. 验证堆叠货物的stackLevel正确递增
 * 3. 验证所有已装载货物都包含stackLevel字段
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('OptimizedPackingEngine - Task 10: 堆叠层级信息记录', () => {
  let engine;
  let containerType;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
    
    // 标准40GP柜型
    containerType = {
      typeId: '40GP',
      name: '40GP',
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2393,
      maxWeight: 26000
    };
  });

  describe('Task 10.1: stackLevel字段记录', () => {
    test('应该为底层货物记录stackLevel=0', async () => {
      // 创建一个简单的货物，不可堆叠
      const cargoList = [
        {
          cargoId: 'box1',
          name: '箱子1',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: false,
          maxStackLayers: 1,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      expect(plan.loadedCargo.length).toBe(1);
      expect(plan.loadedCargo[0]).toHaveProperty('stackLevel');
      expect(plan.loadedCargo[0].stackLevel).toBe(0);
      expect(plan.loadedCargo[0].position.z).toBe(0);
    });

    test('应该为堆叠货物正确记录递增的stackLevel', async () => {
      // 创建可堆叠的货物
      const cargoList = [
        {
          cargoId: 'stackable1',
          name: '可堆叠箱1',
          length: 1000,
          width: 1000,
          height: 500,
          weight: 50,
          quantity: 4, // 4个相同货物，应该堆叠
          stackable: true,
          maxStackLayers: 4,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 应该装载所有4个货物
      expect(plan.loadedCargo.length).toBe(4);

      // 所有货物都应该有stackLevel字段
      plan.loadedCargo.forEach(placed => {
        expect(placed).toHaveProperty('stackLevel');
        expect(typeof placed.stackLevel).toBe('number');
        expect(placed.stackLevel).toBeGreaterThanOrEqual(0);
      });

      // 按stackLevel排序
      const sortedByLevel = [...plan.loadedCargo].sort((a, b) => a.stackLevel - b.stackLevel);

      // 验证层级递增
      for (let i = 0; i < sortedByLevel.length; i++) {
        expect(sortedByLevel[i].stackLevel).toBe(i);
      }

      // 验证底层货物在地面上
      const bottomCargo = sortedByLevel.filter(c => c.stackLevel === 0);
      bottomCargo.forEach(placed => {
        expect(placed.position.z).toBe(0);
      });

      // 验证上层货物的z坐标大于下层
      for (let i = 1; i < sortedByLevel.length; i++) {
        expect(sortedByLevel[i].position.z).toBeGreaterThan(sortedByLevel[i - 1].position.z);
      }
    });

    test('应该为混合堆叠场景正确记录stackLevel', async () => {
      // 创建混合场景：一些可堆叠，一些不可堆叠
      const cargoList = [
        {
          cargoId: 'base1',
          name: '底座箱',
          length: 2000,
          width: 1000,
          height: 500,
          weight: 100,
          quantity: 2,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        },
        {
          cargoId: 'top1',
          name: '顶部箱',
          length: 1000,
          width: 1000,
          height: 400,
          weight: 50,
          quantity: 2,
          stackable: true,
          maxStackLayers: 2,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 所有货物都应该有stackLevel字段
      plan.loadedCargo.forEach(placed => {
        expect(placed).toHaveProperty('stackLevel');
        expect(typeof placed.stackLevel).toBe('number');
        expect(placed.stackLevel).toBeGreaterThanOrEqual(0);
      });

      // 验证stackLevel与z坐标的关系
      const bottomLevel = plan.loadedCargo.filter(c => c.stackLevel === 0);
      bottomLevel.forEach(placed => {
        expect(placed.position.z).toBe(0);
      });

      // 验证非底层货物的z坐标大于0
      const upperLevels = plan.loadedCargo.filter(c => c.stackLevel > 0);
      upperLevels.forEach(placed => {
        expect(placed.position.z).toBeGreaterThan(0);
      });
    });

    test('应该在可视化数据中包含stackLevel信息', async () => {
      const cargoList = [
        {
          cargoId: 'vis1',
          name: '可视化测试箱',
          length: 1000,
          width: 1000,
          height: 500,
          weight: 50,
          quantity: 3,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);
      const visData = engine.generateVisualizationData(plan);

      // 验证可视化数据中的每个货物都有stackLevel
      expect(visData.cargo.length).toBeGreaterThan(0);
      visData.cargo.forEach(cargoVis => {
        expect(cargoVis).toHaveProperty('stackLevel');
        expect(typeof cargoVis.stackLevel).toBe('number');
        expect(cargoVis.stackLevel).toBeGreaterThanOrEqual(0);
      });
    });

    test('应该正确处理复杂堆叠场景的stackLevel', async () => {
      // 慈溪小家电测试用例的简化版
      const cargoList = [
        {
          cargoId: 'airfryer',
          name: '空气炸锅',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 10, // 减少数量以加快测试
          stackable: true,
          maxStackLayers: 4,
          canInvert: false,
          canLayFlat: false
        },
        {
          cargoId: 'heater',
          name: '取暖器',
          length: 500,
          width: 400,
          height: 600,
          weight: 8,
          quantity: 5,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证所有货物都有stackLevel
      expect(plan.loadedCargo.length).toBeGreaterThan(0);
      plan.loadedCargo.forEach(placed => {
        expect(placed).toHaveProperty('stackLevel');
        expect(typeof placed.stackLevel).toBe('number');
        expect(placed.stackLevel).toBeGreaterThanOrEqual(0);
      });

      // 验证stackLevel不超过maxStackLayers
      const airfryerCargo = plan.loadedCargo.filter(p => p.cargo.cargoId === 'airfryer');
      airfryerCargo.forEach(placed => {
        expect(placed.stackLevel).toBeLessThan(4); // maxStackLayers = 4, 所以层级应该是0-3
      });

      const heaterCargo = plan.loadedCargo.filter(p => p.cargo.cargoId === 'heater');
      heaterCargo.forEach(placed => {
        expect(placed.stackLevel).toBeLessThan(3); // maxStackLayers = 3, 所以层级应该是0-2
      });

      // 验证stackLevel与实际堆叠层数的一致性
      plan.loadedCargo.forEach(placed => {
        if (placed.stackLevel === 0) {
          expect(placed.position.z).toBe(0);
        } else {
          expect(placed.position.z).toBeGreaterThan(0);
        }
      });
    });
  });
});
