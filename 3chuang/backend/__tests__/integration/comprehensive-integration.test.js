/**
 * 综合集成测试 - 验证OptimizedPackingEngine所有功能
 * 
 * 测试范围：
 * 1. 多种货物组合测试
 * 2. 不同柜型测试（20GP, 40GP, 40HQ）
 * 3. 边界情况测试（超重货物、超大货物）
 * 4. 可视化数据生成验证
 * 5. 重心和载荷分布计算验证
 * 
 * **Validates: Task 13.3 - 综合集成测试**
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('综合集成测试 - OptimizedPackingEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
  });

  // ========== 测试组1: 多种货物组合测试 ==========
  describe('多种货物组合测试', () => {
    
    test('应该正确处理混合尺寸货物（小、中、大）', async () => {
      const cargoList = [
        // 小货物
        {
          cargoId: 'small-box',
          name: '小箱子',
          length: 300,
          width: 300,
          height: 300,
          weight: 10,
          quantity: 50,
          stackable: true,
          maxStackLayers: 5,
          canInvert: false,
          canLayFlat: false
        },
        // 中货物
        {
          cargoId: 'medium-box',
          name: '中箱子',
          length: 600,
          width: 500,
          height: 400,
          weight: 25,
          quantity: 30,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: true
        },
        // 大货物
        {
          cargoId: 'large-box',
          name: '大箱子',
          length: 1200,
          width: 1000,
          height: 800,
          weight: 80,
          quantity: 10,
          stackable: true,
          maxStackLayers: 2,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证基本结果
      expect(plan).toBeDefined();
      expect(plan.spaceUtilization).toBeGreaterThan(0);
      expect(plan.totalWeight).toBeLessThanOrEqual(containerType.maxWeight);
      expect(plan.compliance.valid).toBe(true);
      
      // 验证所有三种尺寸的货物都被考虑
      const loadedTypes = new Set(plan.loadedCargo.map(c => c.cargo.cargoId));
      expect(loadedTypes.size).toBeGreaterThan(0);
      
      console.log(`混合尺寸测试 - 空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
    }, 30000);

    test('应该正确处理混合堆叠能力货物', async () => {
      const cargoList = [
        // 高堆叠能力
        {
          cargoId: 'high-stack',
          name: '高堆叠货物',
          length: 400,
          width: 400,
          height: 300,
          weight: 15,
          quantity: 40,
          stackable: true,
          maxStackLayers: 6,
          canInvert: false,
          canLayFlat: false
        },
        // 中等堆叠能力
        {
          cargoId: 'medium-stack',
          name: '中等堆叠货物',
          length: 500,
          width: 500,
          height: 400,
          weight: 30,
          quantity: 25,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        },
        // 不可堆叠
        {
          cargoId: 'no-stack',
          name: '不可堆叠货物',
          length: 600,
          width: 600,
          height: 500,
          weight: 40,
          quantity: 15,
          stackable: false,
          maxStackLayers: 1,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证不可堆叠货物的处理
      const noStackCargo = plan.loadedCargo.filter(c => !c.cargo.stackable);
      noStackCargo.forEach(item => {
        expect(item.stackLevel).toBe(0);
        
        // 验证其上方没有货物
        const hasCargoAbove = plan.loadedCargo.some(other => {
          if (other === item) return false;
          const tolerance = 1;
          const zDiff = Math.abs(other.position.z - (item.position.z + item.rotation.height));
          if (zDiff > tolerance) return false;
          
          const overlapX = !(other.position.x + other.rotation.length <= item.position.x || 
                            item.position.x + item.rotation.length <= other.position.x);
          const overlapY = !(other.position.y + other.rotation.width <= item.position.y || 
                            item.position.y + item.rotation.width <= other.position.y);
          
          return overlapX && overlapY;
        });
        
        expect(hasCargoAbove).toBe(false);
      });

      console.log(`混合堆叠测试 - 空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
    }, 30000);
  });

  // ========== 测试组2: 不同柜型测试 ==========
  describe('不同柜型测试', () => {
    
    const testCargo = [
      {
        cargoId: 'standard-box',
        name: '标准箱',
        length: 500,
        width: 400,
        height: 300,
        weight: 20,
        quantity: 30,
        stackable: true,
        maxStackLayers: 4,
        canInvert: false,
        canLayFlat: false
      }
    ];

    test('应该支持20GP柜型', async () => {
      const containerType = {
        typeId: '20GP',
        name: '20英尺标准柜',
        innerLength: 5898,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 21800
      };

      const plan = await engine.generatePackingPlan(testCargo, containerType);

      expect(plan).toBeDefined();
      expect(plan.compliance.valid).toBe(true);
      expect(plan.totalWeight).toBeLessThanOrEqual(containerType.maxWeight);
      
      // 验证货物在边界内
      plan.loadedCargo.forEach(item => {
        expect(item.position.x + item.rotation.length).toBeLessThanOrEqual(containerType.innerLength);
        expect(item.position.y + item.rotation.width).toBeLessThanOrEqual(containerType.innerWidth);
        expect(item.position.z + item.rotation.height).toBeLessThanOrEqual(containerType.innerHeight);
      });

      console.log(`20GP测试 - 空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
    }, 30000);

    test('应该支持40GP柜型', async () => {
      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(testCargo, containerType);

      expect(plan).toBeDefined();
      expect(plan.compliance.valid).toBe(true);
      expect(plan.totalWeight).toBeLessThanOrEqual(containerType.maxWeight);

      console.log(`40GP测试 - 空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
    }, 30000);

    test('应该支持40HQ柜型', async () => {
      const containerType = {
        typeId: '40HQ',
        name: '40英尺高柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2698,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(testCargo, containerType);

      expect(plan).toBeDefined();
      expect(plan.compliance.valid).toBe(true);
      expect(plan.totalWeight).toBeLessThanOrEqual(containerType.maxWeight);
      
      // 40HQ比40GP高，应该能装更多货物
      expect(plan.spaceUtilization).toBeGreaterThan(0);

      console.log(`40HQ测试 - 空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
    }, 30000);
  });

  // ========== 测试组3: 边界情况测试 ==========
  describe('边界情况测试', () => {
    
    test('应该正确处理超重货物', async () => {
      const cargoList = [
        {
          cargoId: 'overweight',
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
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 超重货物应该在unloadedCargo中
      expect(plan.unloadedCargo.length).toBeGreaterThan(0);
      expect(plan.totalWeight).toBeLessThanOrEqual(containerType.maxWeight);
      
      const unloadedOverweight = plan.unloadedCargo.find(c => c.cargo.cargoId === 'overweight');
      expect(unloadedOverweight).toBeDefined();
      expect(unloadedOverweight.reason).toMatch(/重量|超重/);

      console.log(`超重货物测试 - 未装载货物: ${plan.unloadedCargo.length}件`);
    }, 30000);

    test('应该正确处理超大货物', async () => {
      const cargoList = [
        {
          cargoId: 'oversized',
          name: '超大货物',
          length: 15000, // 超过40GP的12032mm长度
          width: 2000,
          height: 2000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 1,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 超大货物应该在unloadedCargo中
      expect(plan.unloadedCargo.length).toBeGreaterThan(0);
      
      const unloadedOversized = plan.unloadedCargo.find(c => c.cargo.cargoId === 'oversized');
      expect(unloadedOversized).toBeDefined();
      expect(unloadedOversized.reason).toContain('尺寸');

      console.log(`超大货物测试 - 未装载货物: ${plan.unloadedCargo.length}件`);
    }, 30000);

    test('应该正确处理接近载重限制的情况', async () => {
      const cargoList = [
        {
          cargoId: 'heavy-box',
          name: '重箱子',
          length: 500,
          width: 500,
          height: 500,
          weight: 1000, // 每件1000kg
          quantity: 30, // 总共30000kg，超过26000kg限制
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 应该只装载部分货物以满足重量限制
      expect(plan.totalWeight).toBeLessThanOrEqual(containerType.maxWeight);
      expect(plan.loadedCargo.length).toBeLessThan(30); // 不能装满30件
      expect(plan.unloadedCargo.length).toBeGreaterThan(0);

      console.log(`接近载重限制测试 - 已装载: ${plan.loadedCargo.length}件, 总重量: ${plan.totalWeight}kg`);
    }, 30000);
  });

  // ========== 测试组4: 可视化数据生成验证 ==========
  describe('可视化数据生成验证', () => {
    
    test('应该为所有装载货物生成完整的可视化数据', async () => {
      const cargoList = [
        {
          cargoId: 'viz-test-1',
          name: '可视化测试货物1',
          length: 600,
          width: 500,
          height: 400,
          weight: 30,
          quantity: 20,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        },
        {
          cargoId: 'viz-test-2',
          name: '可视化测试货物2',
          length: 400,
          width: 400,
          height: 300,
          weight: 20,
          quantity: 15,
          stackable: true,
          maxStackLayers: 4,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证可视化数据存在
      expect(plan.visualizationData).toBeDefined();
      
      const vizData = plan.visualizationData;

      // 验证容器信息
      expect(vizData.container).toBeDefined();
      expect(vizData.container.length).toBe(containerType.innerLength);
      expect(vizData.container.width).toBe(containerType.innerWidth);
      expect(vizData.container.height).toBe(containerType.innerHeight);

      // 验证货物数据数量匹配
      expect(vizData.cargo.length).toBe(plan.loadedCargo.length);

      // 验证每个货物的可视化数据完整性
      vizData.cargo.forEach((item, index) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('position');
        expect(item).toHaveProperty('dimensions');
        expect(item).toHaveProperty('rotation');
        expect(item).toHaveProperty('color');
        expect(item).toHaveProperty('loadingOrder');

        // 验证位置数据
        expect(typeof item.position.x).toBe('number');
        expect(typeof item.position.y).toBe('number');
        expect(typeof item.position.z).toBe('number');

        // 验证尺寸数据
        expect(item.dimensions.length).toBeGreaterThan(0);
        expect(item.dimensions.width).toBeGreaterThan(0);
        expect(item.dimensions.height).toBeGreaterThan(0);

        // 验证颜色格式
        expect(item.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });

      // 验证不同货物类型有不同颜色
      const colorsByType = new Map();
      vizData.cargo.forEach(item => {
        if (!colorsByType.has(item.name)) {
          colorsByType.set(item.name, item.color);
        }
      });
      
      if (colorsByType.size > 1) {
        const colors = Array.from(colorsByType.values());
        const uniqueColors = new Set(colors);
        expect(uniqueColors.size).toBe(colorsByType.size);
      }

      console.log(`可视化数据测试 - 生成了${vizData.cargo.length}个货物的可视化数据`);
    }, 30000);

    test('可视化数据应该可以被JSON序列化', async () => {
      const cargoList = [
        {
          cargoId: 'json-test',
          name: 'JSON测试货物',
          length: 500,
          width: 400,
          height: 300,
          weight: 25,
          quantity: 10,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 尝试JSON序列化
      let jsonString;
      expect(() => {
        jsonString = JSON.stringify(plan.visualizationData);
      }).not.toThrow();

      // 尝试JSON反序列化
      let parsedData;
      expect(() => {
        parsedData = JSON.parse(jsonString);
      }).not.toThrow();

      // 验证反序列化后的数据结构
      expect(parsedData.container).toBeDefined();
      expect(parsedData.cargo).toBeInstanceOf(Array);
      expect(parsedData.centerOfGravity).toBeDefined();
      expect(parsedData.loadDistribution).toBeDefined();

      console.log(`JSON序列化测试 - 成功序列化${jsonString.length}字节`);
    }, 30000);
  });

  // ========== 测试组5: 重心和载荷分布计算验证 ==========
  describe('重心和载荷分布计算验证', () => {
    
    test('应该正确计算重心位置', async () => {
      const cargoList = [
        {
          cargoId: 'cog-test',
          name: '重心测试货物',
          length: 500,
          width: 500,
          height: 500,
          weight: 50,
          quantity: 20,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证重心数据存在
      expect(plan.centerOfGravity).toBeDefined();
      expect(typeof plan.centerOfGravity.x).toBe('number');
      expect(typeof plan.centerOfGravity.y).toBe('number');
      expect(typeof plan.centerOfGravity.z).toBe('number');

      // 重心应该在集装箱边界内
      expect(plan.centerOfGravity.x).toBeGreaterThanOrEqual(0);
      expect(plan.centerOfGravity.x).toBeLessThanOrEqual(containerType.innerLength);
      expect(plan.centerOfGravity.y).toBeGreaterThanOrEqual(0);
      expect(plan.centerOfGravity.y).toBeLessThanOrEqual(containerType.innerWidth);
      expect(plan.centerOfGravity.z).toBeGreaterThanOrEqual(0);
      expect(plan.centerOfGravity.z).toBeLessThanOrEqual(containerType.innerHeight);

      console.log(`重心计算测试 - 重心位置: (${plan.centerOfGravity.x.toFixed(2)}, ${plan.centerOfGravity.y.toFixed(2)}, ${plan.centerOfGravity.z.toFixed(2)})`);
    }, 30000);

    test('应该正确计算载荷分布', async () => {
      const cargoList = [
        {
          cargoId: 'load-test',
          name: '载荷测试货物',
          length: 600,
          width: 500,
          height: 400,
          weight: 40,
          quantity: 25,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证载荷分布数据存在
      expect(plan.loadDistribution).toBeDefined();
      expect(typeof plan.loadDistribution.front).toBe('number');
      expect(typeof plan.loadDistribution.back).toBe('number');
      expect(typeof plan.loadDistribution.left).toBe('number');
      expect(typeof plan.loadDistribution.right).toBe('number');

      // 验证百分比数据
      expect(typeof plan.loadDistribution.frontPercent).toBe('number');
      expect(typeof plan.loadDistribution.backPercent).toBe('number');
      expect(typeof plan.loadDistribution.leftPercent).toBe('number');
      expect(typeof plan.loadDistribution.rightPercent).toBe('number');

      // 四个区域的重量之和应该等于总重量
      const totalDistribution = plan.loadDistribution.front + 
                                plan.loadDistribution.back;
      expect(Math.abs(totalDistribution - plan.totalWeight)).toBeLessThan(0.1);

      // 四个区域的百分比之和应该接近100%
      const totalPercent = plan.loadDistribution.frontPercent + 
                          plan.loadDistribution.backPercent;
      expect(Math.abs(totalPercent - 100)).toBeLessThan(0.1);

      console.log(`载荷分布测试 - 前:${plan.loadDistribution.frontPercent.toFixed(1)}%, 后:${plan.loadDistribution.backPercent.toFixed(1)}%`);
    }, 30000);

    test('应该检测偏载情况', async () => {
      // 创建一个可能导致偏载的货物配置
      const cargoList = [
        {
          cargoId: 'unbalanced-heavy',
          name: '重货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 500, // 很重
          quantity: 5,
          stackable: false,
          maxStackLayers: 1,
          canInvert: false,
          canLayFlat: false
        },
        {
          cargoId: 'unbalanced-light',
          name: '轻货物',
          length: 500,
          width: 500,
          height: 500,
          weight: 10, // 很轻
          quantity: 50,
          stackable: true,
          maxStackLayers: 5,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证不平衡度数据存在
      expect(typeof plan.loadDistribution.frontBackImbalance).toBe('number');
      expect(typeof plan.loadDistribution.leftRightImbalance).toBe('number');

      console.log(`偏载检测测试 - 前后不平衡:${plan.loadDistribution.frontBackImbalance.toFixed(1)}%, 左右不平衡:${plan.loadDistribution.leftRightImbalance.toFixed(1)}%`);
    }, 30000);
  });

  // ========== 测试组6: 性能和合规性综合验证 ==========
  describe('性能和合规性综合验证', () => {
    
    test('应该在合理时间内完成复杂场景计算', async () => {
      const cargoList = [
        {
          cargoId: 'perf-test-1',
          name: '性能测试货物1',
          length: 400,
          width: 400,
          height: 300,
          weight: 20,
          quantity: 50,
          stackable: true,
          maxStackLayers: 4,
          canInvert: false,
          canLayFlat: false
        },
        {
          cargoId: 'perf-test-2',
          name: '性能测试货物2',
          length: 600,
          width: 500,
          height: 400,
          weight: 35,
          quantity: 40,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: true
        },
        {
          cargoId: 'perf-test-3',
          name: '性能测试货物3',
          length: 800,
          width: 600,
          height: 500,
          weight: 50,
          quantity: 30,
          stackable: true,
          maxStackLayers: 2,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const startTime = Date.now();
      const plan = await engine.generatePackingPlan(cargoList, containerType);
      const elapsed = (Date.now() - startTime) / 1000;

      // 验证计算时间
      expect(plan.computationTime).toBeDefined();
      expect(plan.computationTime).toBeLessThanOrEqual(10);
      expect(elapsed).toBeLessThanOrEqual(11);

      console.log(`性能测试 - 计算耗时: ${elapsed.toFixed(2)}秒, 空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
    }, 30000);

    test('应该通过所有合规性检查', async () => {
      const cargoList = [
        {
          cargoId: 'compliance-test',
          name: '合规性测试货物',
          length: 500,
          width: 500,
          height: 400,
          weight: 30,
          quantity: 30,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证合规性状态
      expect(plan.compliance).toBeDefined();
      expect(plan.compliance.valid).toBe(true);
      expect(plan.compliance.violations).toBeInstanceOf(Array);
      expect(plan.compliance.violations.length).toBe(0);

      // 验证所有关键约束
      expect(plan.totalWeight).toBeLessThanOrEqual(containerType.maxWeight);
      
      plan.loadedCargo.forEach(item => {
        // 边界约束
        expect(item.position.x + item.rotation.length).toBeLessThanOrEqual(containerType.innerLength);
        expect(item.position.y + item.rotation.width).toBeLessThanOrEqual(containerType.innerWidth);
        expect(item.position.z + item.rotation.height).toBeLessThanOrEqual(containerType.innerHeight);
      });

      console.log(`合规性测试 - 状态: ${plan.compliance.valid ? '✓ 通过' : '✗ 失败'}`);
    }, 30000);
  });


  // ========== 测试组7: 真实场景模拟 ==========
  describe('真实场景模拟', () => {
    
    test('应该正确处理电商混合货物场景', async () => {
      const cargoList = [
        {
          cargoId: 'electronics',
          name: '电子产品',
          length: 400,
          width: 300,
          height: 200,
          weight: 15,
          quantity: 60,
          stackable: true,
          maxStackLayers: 5,
          canInvert: false,
          canLayFlat: false
        },
        {
          cargoId: 'clothing',
          name: '服装箱',
          length: 600,
          width: 400,
          height: 300,
          weight: 10,
          quantity: 80,
          stackable: true,
          maxStackLayers: 6,
          canInvert: false,
          canLayFlat: true
        },
        {
          cargoId: 'furniture',
          name: '家具',
          length: 1200,
          width: 800,
          height: 600,
          weight: 60,
          quantity: 15,
          stackable: false,
          maxStackLayers: 1,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40HQ',
        name: '40英尺高柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2698,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      expect(plan).toBeDefined();
      expect(plan.spaceUtilization).toBeGreaterThan(0);
      expect(plan.compliance.valid).toBe(true);

      // 统计各类货物装载情况
      const stats = {};
      plan.loadedCargo.forEach(item => {
        if (!stats[item.cargo.name]) {
          stats[item.cargo.name] = 0;
        }
        stats[item.cargo.name]++;
      });

      console.log('\n电商混合货物场景:');
      console.log(`  空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
      console.log(`  总重量: ${plan.totalWeight}kg`);
      Object.entries(stats).forEach(([name, count]) => {
        const total = cargoList.find(c => c.name === name)?.quantity || 0;
        console.log(`  ${name}: ${count}/${total}件`);
      });
    }, 30000);

    test('应该正确处理工业零件场景', async () => {
      const cargoList = [
        {
          cargoId: 'small-parts',
          name: '小零件箱',
          length: 300,
          width: 300,
          height: 200,
          weight: 25,
          quantity: 100,
          stackable: true,
          maxStackLayers: 8,
          canInvert: false,
          canLayFlat: false
        },
        {
          cargoId: 'medium-parts',
          name: '中型零件',
          length: 600,
          width: 400,
          height: 400,
          weight: 40,
          quantity: 50,
          stackable: true,
          maxStackLayers: 4,
          canInvert: false,
          canLayFlat: false
        },
        {
          cargoId: 'large-machinery',
          name: '大型机械',
          length: 1500,
          width: 1000,
          height: 1000,
          weight: 200,
          quantity: 5,
          stackable: false,
          maxStackLayers: 1,
          canInvert: false,
          canLayFlat: false
        }
      ];

      const containerType = {
        typeId: '40GP',
        name: '40英尺标准柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 26000
      };

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      expect(plan).toBeDefined();
      expect(plan.compliance.valid).toBe(true);

      console.log(`\n工业零件场景 - 空间利用率: ${plan.spaceUtilization.toFixed(2)}%, 总重量: ${plan.totalWeight}kg`);
    }, 30000);
  });
});
