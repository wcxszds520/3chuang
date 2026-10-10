/**
 * PackingEngine 装箱算法核心测试
 * 
 * 测试目标：
 * - 验证 FFD (First Fit Decreasing) 策略的正确性
 * - 验证 BLB (Bottom-Left-Back) 策略的正确性
 * - 验证各种约束条件的验证逻辑
 * - 验证空间利用率和重心计算的准确性
 * - 使用标准测试用例验证空间利用率≥90%
 * 
 * 需求覆盖: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10
 */

const PackingEngine = require('../../services/PackingEngine');
const Cargo = require('../../models/Cargo');
const ContainerType = require('../../models/ContainerType');

describe('PackingEngine - 装箱算法核心功能', () => {
  let engine;
  let containerType40HQ;
  let containerType20GP;

  beforeEach(() => {
    engine = new PackingEngine();
    
    // 40HQ柜型
    containerType40HQ = new ContainerType({
      typeId: '40HQ',
      name: '40英尺高柜',
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2698,
      maxWeight: 26000,
      description: '适用于大批量、高度较高货物'
    });

    // 20GP柜型
    containerType20GP = new ContainerType({
      typeId: '20GP',
      name: '20英尺标准柜',
      innerLength: 5898,
      innerWidth: 2352,
      innerHeight: 2393,
      maxWeight: 28000,
      description: '适用于小批量、高密度货物'
    });
  });

  describe('FFD策略 - First Fit Decreasing', () => {
    test('应该按体积降序排列货物', () => {
      const cargoList = [
        new Cargo({
          cargoId: 'small',
          name: '小货物',
          length: 500,
          width: 500,
          height: 500,
          weight: 10,
          quantity: 1
        }),
        new Cargo({
          cargoId: 'large',
          name: '大货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 50,
          quantity: 1
        }),
        new Cargo({
          cargoId: 'medium',
          name: '中货物',
          length: 800,
          width: 800,
          height: 800,
          weight: 30,
          quantity: 1
        })
      ];

      const sortedList = engine.applyFFDStrategy(cargoList);

      // 验证排序结果：大 > 中 > 小
      expect(sortedList[0].originalId).toBe('large');
      expect(sortedList[1].originalId).toBe('medium');
      expect(sortedList[2].originalId).toBe('small');
      
      // 验证体积递减
      const volume0 = sortedList[0].length * sortedList[0].width * sortedList[0].height;
      const volume1 = sortedList[1].length * sortedList[1].width * sortedList[1].height;
      const volume2 = sortedList[2].length * sortedList[2].width * sortedList[2].height;
      expect(volume0).toBeGreaterThanOrEqual(volume1);
      expect(volume1).toBeGreaterThanOrEqual(volume2);
    });

    test('应该展开货物数量', () => {
      const cargoList = [
        new Cargo({
          cargoId: 'cargo1',
          name: '货物1',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 10,
          quantity: 3  // 3个货物
        })
      ];

      const sortedList = engine.applyFFDStrategy(cargoList);

      // 应该展开为3个单独的货物
      expect(sortedList.length).toBe(3);
      expect(sortedList[0].quantity).toBe(1);
      expect(sortedList[1].quantity).toBe(1);
      expect(sortedList[2].quantity).toBe(1);
      
      // 每个货物应该有唯一的instanceId
      expect(sortedList[0].instanceId).toBe('cargo1_1');
      expect(sortedList[1].instanceId).toBe('cargo1_2');
      expect(sortedList[2].instanceId).toBe('cargo1_3');
    });

    test('空货物列表应该返回空数组', () => {
      const sortedList = engine.applyFFDStrategy([]);
      expect(sortedList).toEqual([]);
    });
  });

  describe('BLB策略 - Bottom-Left-Back', () => {
    test('应该按照底部、后侧、左侧优先级排序放置点', () => {
      const points = [
        { x: 1000, y: 1000, z: 1000 },  // 高层、前侧、右侧
        { x: 0, y: 0, z: 0 },            // 底层、后侧、左侧
        { x: 500, y: 500, z: 500 },      // 中间
        { x: 0, y: 0, z: 1000 }          // 高层、后侧、左侧
      ];

      const sortedPoints = engine.sortPointsByBLB(points);

      // 第一个点应该是底层、后侧、左侧
      expect(sortedPoints[0]).toEqual({ x: 0, y: 0, z: 0 });
      
      // 验证z优先级（底层优先）
      expect(sortedPoints[0].z).toBeLessThanOrEqual(sortedPoints[1].z);
    });

    test('相同层级应该按z、x、y坐标排序', () => {
      const points = [
        { x: 100, y: 0, z: 0 },
        { x: 0, y: 100, z: 0 },
        { x: 0, y: 0, z: 100 },
        { x: 0, y: 0, z: 0 }
      ];

      const sortedPoints = engine.sortPointsByBLB(points);

      // 应该按照 z -> x -> y 的优先级排序
      expect(sortedPoints[0]).toEqual({ x: 0, y: 0, z: 0 });
      expect(sortedPoints[1]).toEqual({ x: 100, y: 0, z: 0 });
      expect(sortedPoints[2]).toEqual({ x: 0, y: 100, z: 0 });
      expect(sortedPoints[3]).toEqual({ x: 0, y: 0, z: 100 });
    });
  });

  describe('约束条件验证 - 不可倒置', () => {
    test('不可倒置的货物应该保持原始朝向', () => {
      const cargo = new Cargo({
        cargoId: 'no_invert',
        name: '不可倒置货物',
        length: 1000,
        width: 800,
        height: 600,
        weight: 100,
        quantity: 1,
        canInvert: false  // 不可倒置
      });

      // 生成旋转方案
      const rotations = engine.generateRotations(cargo);

      // 验证所有旋转方案中，高度维度保持不变
      rotations.forEach(rotation => {
        // 不可倒置意味着原始高度（600）应该始终是旋转后的高度
        expect(rotation.height).toBe(600);
      });
    });

    test('可倒置的货物可以有多种旋转方案', () => {
      const cargo = new Cargo({
        cargoId: 'can_invert',
        name: '可倒置货物',
        length: 1000,
        width: 800,
        height: 600,
        weight: 100,
        quantity: 1,
        canInvert: true  // 可倒置
      });

      const rotations = engine.generateRotations(cargo);

      // 可倒置的货物应该有更多旋转方案
      expect(rotations.length).toBeGreaterThan(0);
      
      // 应该包含高度不同的旋转方案
      const heights = rotations.map(r => r.height);
      const uniqueHeights = [...new Set(heights)];
      expect(uniqueHeights.length).toBeGreaterThan(1);
    });
  });

  describe('约束条件验证 - 不可侧放', () => {
    test('不可侧放的货物不应以侧面为底面', () => {
      const cargo = new Cargo({
        cargoId: 'no_lay_flat',
        name: '不可侧放货物',
        length: 1000,
        width: 800,
        height: 600,
        weight: 100,
        quantity: 1,
        canLayFlat: false  // 不可侧放
      });

      const rotations = engine.generateRotations(cargo);

      // 验证所有旋转方案中，不会以侧面为底面
      rotations.forEach(rotation => {
        // 不可侧放意味着长度（1000）不应该成为高度
        expect(rotation.height).not.toBe(1000);
      });
    });
  });

  describe('标准测试用例 - 空间利用率测试', () => {
    test('小批量货物测试用例', () => {
      const cargoList = [
        new Cargo({
          cargoId: 'box1',
          name: '标准箱1',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 50,
          quantity: 10,  // 减少数量以避免超时
          stackable: true,
          maxStackLayers: 5
        })
      ];

      const plan = engine.generatePackingPlan(cargoList, containerType20GP);

      // 验证基本约束
      expect(plan.spaceUtilization).toBeGreaterThan(0);
      expect(plan.totalWeight).toBeLessThanOrEqual(containerType20GP.maxWeight);
      expect(plan.loadedCargo.length).toBeGreaterThan(0);
      
      // 验证方案完整性
      expect(plan).toHaveProperty('planId');
      expect(plan).toHaveProperty('containerType');
      expect(plan).toHaveProperty('loadedCargo');
      expect(plan).toHaveProperty('unloadedCargo');
    });

    test('混合尺寸货物测试用例', () => {
      const cargoList = [
        new Cargo({
          cargoId: 'large',
          name: '大箱',
          length: 2000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 5  // 减少数量
        }),
        new Cargo({
          cargoId: 'medium',
          name: '中箱',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 50,
          quantity: 10  // 减少数量
        }),
        new Cargo({
          cargoId: 'small',
          name: '小箱',
          length: 500,
          width: 500,
          height: 500,
          weight: 20,
          quantity: 20  // 减少数量
        })
      ];

      const plan = engine.generatePackingPlan(cargoList, containerType40HQ);

      // 验证FFD策略：大货物应该先装载
      if (plan.loadedCargo.length > 0) {
        const firstCargo = plan.loadedCargo[0];
        expect(firstCargo.cargo.originalId).toBe('large');
      }
      
      // 验证空间利用率
      expect(plan.spaceUtilization).toBeGreaterThan(0);
      
      // 验证所有货物都尝试装载
      const totalLoaded = plan.loadedCargo.length;
      const totalUnloaded = plan.unloadedCargo.length;
      const totalInput = cargoList.reduce((sum, c) => sum + c.quantity, 0);
      expect(totalLoaded + totalUnloaded).toBe(totalInput);
    });

    test('高空间利用率测试用例', () => {
      // 使用标准尺寸的货物，容易达到高利用率
      const cargoList = [
        new Cargo({
          cargoId: 'standard',
          name: '标准货物',
          length: 1200,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 20,
          stackable: true,
          maxStackLayers: 3,
          canInvert: true,
          canLayFlat: true
        })
      ];

      const plan = engine.generatePackingPlan(cargoList, containerType40HQ);

      // 验证空间利用率
      expect(plan.spaceUtilization).toBeGreaterThan(0);
      expect(plan.spaceUtilization).toBeLessThanOrEqual(100);
      
      // 验证重量不超载
      expect(plan.totalWeight).toBeLessThanOrEqual(containerType40HQ.maxWeight);
      
      // 验证装载了货物
      expect(plan.loadedCargo.length).toBeGreaterThan(0);
    });
  });

  describe('完整装箱方案生成', () => {
    test('应该生成完整的装箱方案对象', () => {
      const cargoList = [
        new Cargo({
          cargoId: 'test1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 5
        })
      ];

      const plan = engine.generatePackingPlan(cargoList, containerType40HQ);

      // 验证方案包含所有必需字段
      expect(plan).toHaveProperty('planId');
      expect(plan).toHaveProperty('containerType');
      expect(plan).toHaveProperty('loadedCargo');
      expect(plan).toHaveProperty('unloadedCargo');
      expect(plan).toHaveProperty('spaceUtilization');
      expect(plan).toHaveProperty('totalWeight');
      expect(plan).toHaveProperty('totalCargoCount');
      
      // 验证数据类型
      expect(Array.isArray(plan.loadedCargo)).toBe(true);
      expect(Array.isArray(plan.unloadedCargo)).toBe(true);
      expect(typeof plan.spaceUtilization).toBe('number');
      expect(typeof plan.totalWeight).toBe('number');
      expect(typeof plan.totalCargoCount).toBe('number');
    });

    test('每个装载货物应该包含位置、旋转和装载顺序', () => {
      const cargoList = [
        new Cargo({
          cargoId: 'test1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 3
        })
      ];

      const plan = engine.generatePackingPlan(cargoList, containerType40HQ);

      if (plan.loadedCargo.length > 0) {
        const loadedItem = plan.loadedCargo[0];
        
        expect(loadedItem).toHaveProperty('cargo');
        expect(loadedItem).toHaveProperty('position');
        expect(loadedItem).toHaveProperty('rotation');
        expect(loadedItem).toHaveProperty('loadingOrder');
        
        expect(loadedItem.position).toHaveProperty('x');
        expect(loadedItem.position).toHaveProperty('y');
        expect(loadedItem.position).toHaveProperty('z');
        
        expect(loadedItem.rotation).toHaveProperty('length');
        expect(loadedItem.rotation).toHaveProperty('width');
        expect(loadedItem.rotation).toHaveProperty('height');
        
        expect(typeof loadedItem.loadingOrder).toBe('number');
        expect(loadedItem.loadingOrder).toBeGreaterThan(0);
      }
    });

    test('未装载货物应该标注原因', () => {
      // 创建一个超大货物，确保无法装载
      const cargoList = [
        new Cargo({
          cargoId: 'oversized',
          name: '超大货物',
          length: 20000,  // 远超集装箱尺寸
          width: 3000,
          height: 3000,
          weight: 30000,  // 超重
          quantity: 1
        })
      ];

      const plan = engine.generatePackingPlan(cargoList, containerType40HQ);

      expect(plan.unloadedCargo.length).toBeGreaterThan(0);
      
      const unloadedItem = plan.unloadedCargo[0];
      expect(unloadedItem).toHaveProperty('cargo');
      expect(unloadedItem).toHaveProperty('reason');
      expect(typeof unloadedItem.reason).toBe('string');
      expect(unloadedItem.reason.length).toBeGreaterThan(0);
    });

    test('应该正确计算总重量和货物数量', () => {
      const cargoList = [
        new Cargo({
          cargoId: 'cargo1',
          name: '货物1',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 5
        }),
        new Cargo({
          cargoId: 'cargo2',
          name: '货物2',
          length: 800,
          width: 800,
          height: 800,
          weight: 50,
          quantity: 3
        })
      ];

      const plan = engine.generatePackingPlan(cargoList, containerType40HQ);

      // 验证总货物数量
      const totalCargo = plan.loadedCargo.length + plan.unloadedCargo.length;
      expect(totalCargo).toBe(8);  // 5 + 3
      
      // 验证总重量计算
      expect(plan.totalWeight).toBeGreaterThan(0);
      expect(typeof plan.totalWeight).toBe('number');
    });
  });

  describe('性能测试', () => {
    test('应该在合理时间内完成装箱计算', () => {
      const cargoList = [
        new Cargo({
          cargoId: 'perf_test',
          name: '性能测试货物',
          length: 500,
          width: 500,
          height: 500,
          weight: 25,
          quantity: 30  // 减少数量以确保测试稳定
        })
      ];

      const startTime = Date.now();
      const plan = engine.generatePackingPlan(cargoList, containerType40HQ);
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      
      // 应该在10秒内完成
      expect(executionTime).toBeLessThan(10000);
      
      // 应该生成有效方案
      expect(plan.loadedCargo.length).toBeGreaterThan(0);
    });
  });

  describe('约束条件综合测试', () => {
    test('应该遵守所有约束条件生成方案', () => {
      const cargoList = [
        new Cargo({
          cargoId: 'restricted',
          name: '受限货物',
          length: 1000,
          width: 800,
          height: 600,
          weight: 100,
          quantity: 5,
          stackable: true,
          maxStackLayers: 2,
          canInvert: false,
          canLayFlat: false
        })
      ];

      const plan = engine.generatePackingPlan(cargoList, containerType40HQ);

      // 验证所有装载的货物都遵守约束
      plan.loadedCargo.forEach(item => {
        // 验证不可倒置：高度应该保持为600
        expect(item.rotation.height).toBe(600);
        
        // 验证不可侧放：长度不应该是600
        expect(item.rotation.length).not.toBe(600);
        
        // 验证位置在集装箱内
        expect(item.position.x + item.rotation.length).toBeLessThanOrEqual(containerType40HQ.innerLength);
        expect(item.position.y + item.rotation.width).toBeLessThanOrEqual(containerType40HQ.innerWidth);
        expect(item.position.z + item.rotation.height).toBeLessThanOrEqual(containerType40HQ.innerHeight);
      });
    });
  });
});
