/**
 * OptimizedPackingEngine - Task 9: 局部优化和性能监控
 * 
 * 测试目标：
 * - 9.1: _localOptimizationPhase() 局部优化
 * - 9.2: 性能监控和计算耗时记录
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');
const Cargo = require('../../models/Cargo');
const ContainerType = require('../../models/ContainerType');

describe('Task 9: 局部优化和性能监控', () => {
  let engine;
  let containerType;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
    
    // 40GP柜型
    containerType = new ContainerType({
      typeId: '40GP',
      name: '40GP',
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2393,
      maxWeight: 26000
    });
  });

  describe('9.1: _localOptimizationPhase() 局部优化', () => {
    test('应该尝试交换相邻货物位置', () => {
      // 创建一个简单的装箱方案
      const plan = {
        loadedCargo: [
          {
            cargo: new Cargo({
              cargoId: 'C1',
              name: '货物1',
              length: 1000,
              width: 1000,
              height: 1000,
              weight: 100,
              quantity: 1,
              stackable: true,
              maxStackLayers: 3
            }),
            position: { x: 0, y: 0, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000, rotation: { x: 0, y: 0, z: 0 } },
            loadingOrder: 1,
            stackLevel: 0
          },
          {
            cargo: new Cargo({
              cargoId: 'C2',
              name: '货物2',
              length: 1000,
              width: 1000,
              height: 1000,
              weight: 100,
              quantity: 1,
              stackable: true,
              maxStackLayers: 3
            }),
            position: { x: 1000, y: 0, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000, rotation: { x: 0, y: 0, z: 0 } },
            loadingOrder: 2,
            stackLevel: 0
          }
        ],
        unloadedCargo: [],
        occupiedSpaces: [
          { position: { x: 0, y: 0, z: 0 }, rotation: { length: 1000, width: 1000, height: 1000 } },
          { position: { x: 1000, y: 0, z: 0 }, rotation: { length: 1000, width: 1000, height: 1000 } }
        ],
        containerType: containerType
      };

      // 执行局部优化
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      engine._localOptimizationPhase(plan, containerType);
      consoleSpy.mockRestore();

      // 验证方案仍然有效
      expect(plan.loadedCargo).toHaveLength(2);
      expect(plan.occupiedSpaces).toHaveLength(2);
    });

    test('应该尝试调整货物旋转方向', () => {
      // 创建一个可以旋转的货物
      const plan = {
        loadedCargo: [
          {
            cargo: new Cargo({
              cargoId: 'C1',
              name: '货物1',
              length: 1000,
              width: 800,
              height: 600,
              weight: 100,
              quantity: 1,
              stackable: true,
              maxStackLayers: 3,
              canInvert: true,
              canLayFlat: true
            }),
            position: { x: 0, y: 0, z: 0 },
            rotation: { length: 1000, width: 800, height: 600, rotation: { x: 0, y: 0, z: 0 } },
            loadingOrder: 1,
            stackLevel: 0
          }
        ],
        unloadedCargo: [],
        occupiedSpaces: [
          { position: { x: 0, y: 0, z: 0 }, rotation: { length: 1000, width: 800, height: 600 } }
        ],
        containerType: containerType
      };

      // 执行局部优化
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      engine._localOptimizationPhase(plan, containerType);
      consoleSpy.mockRestore();

      // 验证方案仍然有效
      expect(plan.loadedCargo).toHaveLength(1);
      expect(plan.occupiedSpaces).toHaveLength(1);
    });

    test('应该记录初始和最终空间利用率', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: new Cargo({
              cargoId: 'C1',
              name: '货物1',
              length: 1000,
              width: 1000,
              height: 1000,
              weight: 100,
              quantity: 1,
              stackable: true,
              maxStackLayers: 3
            }),
            position: { x: 0, y: 0, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000, rotation: { x: 0, y: 0, z: 0 } },
            loadingOrder: 1,
            stackLevel: 0
          }
        ],
        unloadedCargo: [],
        occupiedSpaces: [
          { position: { x: 0, y: 0, z: 0 }, rotation: { length: 1000, width: 1000, height: 1000 } }
        ],
        containerType: containerType
      };

      // 捕获console.log输出
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      engine._localOptimizationPhase(plan, containerType);
      
      // 验证输出包含空间利用率信息
      const logCalls = consoleSpy.mock.calls.map(call => call[0]);
      expect(logCalls.some(log => log.includes('初始空间利用率'))).toBe(true);
      expect(logCalls.some(log => log.includes('最终空间利用率'))).toBe(true);
      expect(logCalls.some(log => log.includes('局部优化完成'))).toBe(true);
      
      consoleSpy.mockRestore();
    });
  });

  describe('9.2: 性能监控和计算耗时记录', () => {
    test('应该在返回的PackingPlan中包含computationTime', async () => {
      const cargoList = [
        new Cargo({
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3
        })
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证computationTime字段存在
      expect(plan).toHaveProperty('computationTime');
      expect(typeof plan.computationTime).toBe('number');
      expect(plan.computationTime).toBeGreaterThan(0);
    });

    test('computationTime应该以秒为单位', async () => {
      const cargoList = [
        new Cargo({
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3
        })
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证computationTime是合理的秒数（应该小于10秒）
      expect(plan.computationTime).toBeLessThan(10);
      expect(plan.computationTime).toBeGreaterThan(0);
    });

    test('当耗时超过8秒时应该记录性能警告', async () => {
      const cargoList = [
        new Cargo({
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3
        })
      ];

      // 捕获console.warn输出
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mock Date.now to simulate 9 seconds elapsed
      const realDateNow = Date.now.bind(global.Date);
      const startTime = realDateNow();
      let callCount = 0;
      
      jest.spyOn(global.Date, 'now').mockImplementation(() => {
        callCount++;
        // First call sets startTime, subsequent calls simulate 9 seconds later
        if (callCount === 1) {
          return startTime;
        }
        return startTime + 9000;
      });
      
      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证性能警告
      expect(plan.computationTime).toBeGreaterThan(8);
      expect(plan).toHaveProperty('performanceWarning');
      expect(plan.performanceWarning).toContain('性能警告');
      expect(plan.performanceWarning).toContain('超过8秒阈值');
      
      // 验证console.warn被调用
      expect(warnSpy).toHaveBeenCalled();
      const warnCalls = warnSpy.mock.calls.map(call => call[0]);
      expect(warnCalls.some(msg => msg.includes('性能警告'))).toBe(true);
      
      warnSpy.mockRestore();
      global.Date.now.mockRestore();
    });

    test('当耗时未超过8秒时不应该有性能警告', async () => {
      const cargoList = [
        new Cargo({
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3
        })
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证没有性能警告
      expect(plan.computationTime).toBeLessThan(8);
      expect(plan.performanceWarning).toBeUndefined();
    });

    test('应该在generatePackingPlan开始时记录startTime', async () => {
      const cargoList = [
        new Cargo({
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3
        })
      ];

      const beforeTime = Date.now();
      await engine.generatePackingPlan(cargoList, containerType);
      const afterTime = Date.now();

      // 验证startTime在合理范围内
      expect(engine.startTime).toBeGreaterThanOrEqual(beforeTime);
      expect(engine.startTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('集成测试：完整装箱流程', () => {
    test('慈溪小家电场景应包含性能监控信息', async () => {
      const cargoList = [
        new Cargo({
          cargoId: 'AIR_FRYER',
          name: '空气炸锅',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 10,
          stackable: true,
          maxStackLayers: 4
        }),
        new Cargo({
          cargoId: 'HEATER',
          name: '取暖器',
          length: 500,
          width: 400,
          height: 600,
          weight: 8,
          quantity: 5,
          stackable: true,
          maxStackLayers: 3
        })
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证性能监控字段
      expect(plan).toHaveProperty('computationTime');
      expect(plan.computationTime).toBeGreaterThan(0);
      expect(plan.computationTime).toBeLessThan(10);

      // 验证其他必要字段
      expect(plan).toHaveProperty('spaceUtilization');
      expect(plan).toHaveProperty('totalWeight');
      expect(plan).toHaveProperty('loadedCargo');
      expect(plan).toHaveProperty('centerOfGravity');
      expect(plan).toHaveProperty('loadDistribution');
    });
  });
});
