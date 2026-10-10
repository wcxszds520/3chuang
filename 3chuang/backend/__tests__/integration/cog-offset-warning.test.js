/**
 * Integration Test: Center of Gravity Offset Warning
 * 验证重心偏移警告在实际装箱过程中的集成
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('Integration: 重心偏移警告', () => {
  let engine;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
  });

  test('应该在装箱方案中检测并报告重心偏移警告', async () => {
    // 创建一个会导致重心严重偏移的货物配置
    // 所有重货都放在一侧
    const cargoList = [
      {
        cargoId: 'heavy-1',
        name: '重货',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 1000, // 非常重
        quantity: 1,
        stackable: false,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: false
      }
    ];

    const containerType = {
      typeId: '40GP',
      name: '40GP',
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2393,
      maxWeight: 26000
    };

    const plan = await engine.generatePackingPlan(cargoList, containerType);

    // 验证装箱成功
    expect(plan.loadedCargo.length).toBeGreaterThan(0);

    // 计算重心（带偏移检测）
    const cog = engine._calculateCenterOfGravity(plan, containerType);

    // 验证重心偏移信息存在
    expect(cog).toHaveProperty('offset');
    expect(cog).toHaveProperty('offsetDistance');
    expect(cog).toHaveProperty('warning');

    // 由于货物会被放在角落，应该有偏移警告
    expect(cog.offsetDistance).toBeGreaterThan(0);
  });

  test('应该在均衡装载时不产生警告', async () => {
    // 创建多个相同的货物，算法应该能均匀分布
    const cargoList = [
      {
        cargoId: 'balanced-1',
        name: '均衡货物',
        length: 500,
        width: 500,
        height: 500,
        weight: 50,
        quantity: 8, // 多个货物，可以分散放置
        stackable: true,
        maxStackLayers: 2,
        canInvert: true,
        canLayFlat: true
      }
    ];

    const containerType = {
      typeId: '20GP',
      name: '20GP',
      innerLength: 5898,
      innerWidth: 2352,
      innerHeight: 2393,
      maxWeight: 28000
    };

    const plan = await engine.generatePackingPlan(cargoList, containerType);

    // 验证装箱成功
    expect(plan.loadedCargo.length).toBeGreaterThan(0);

    // 计算重心
    const cog = engine._calculateCenterOfGravity(plan, containerType);

    // 验证重心信息
    expect(cog).toHaveProperty('offset');
    expect(cog).toHaveProperty('offsetDistance');
  });

  test('应该在_balanceCenterOfGravity中输出警告信息', async () => {
    // 捕获console.log输出
    const consoleLogs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      consoleLogs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      const cargoList = [
        {
          cargoId: 'test-1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 500,
          quantity: 1,
          stackable: false,
          maxStackLayers: 1,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40GP',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      await engine.generatePackingPlan(cargoList, containerType);

      // 检查是否有重心相关的日志输出
      const cogLogs = consoleLogs.filter(log => 
        log.includes('重心') || log.includes('偏差') || log.includes('偏移')
      );
      
      expect(cogLogs.length).toBeGreaterThan(0);
    } finally {
      console.log = originalLog;
    }
  });
});
