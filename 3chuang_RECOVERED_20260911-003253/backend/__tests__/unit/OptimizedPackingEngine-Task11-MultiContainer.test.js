/**
 * Task 11: 多柜型支持测试
 * 
 * 测试内容：
 * - 11.1: 标准柜型参数（20GP, 40GP, 40HQ）
 * - 11.2: 自定义柜型参数接受和验证
 * - 11.3: 柜型推荐逻辑
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('Task 11: 多柜型支持', () => {
  let engine;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
  });

  describe('11.1: 标准柜型参数', () => {
    test('应该定义20GP标准柜型', () => {
      const container20GP = engine.STANDARD_CONTAINER_TYPES['20GP'];
      
      expect(container20GP).toBeDefined();
      expect(container20GP.typeId).toBe('20GP');
      expect(container20GP.name).toBe('20GP标准集装箱');
      expect(container20GP.innerLength).toBe(5898);
      expect(container20GP.innerWidth).toBe(2352);
      expect(container20GP.innerHeight).toBe(2393);
      expect(container20GP.maxWeight).toBe(21800);
    });

    test('应该定义40GP标准柜型', () => {
      const container40GP = engine.STANDARD_CONTAINER_TYPES['40GP'];
      
      expect(container40GP).toBeDefined();
      expect(container40GP.typeId).toBe('40GP');
      expect(container40GP.name).toBe('40GP标准集装箱');
      expect(container40GP.innerLength).toBe(12032);
      expect(container40GP.innerWidth).toBe(2352);
      expect(container40GP.innerHeight).toBe(2393);
      expect(container40GP.maxWeight).toBe(26680);
    });

    test('应该定义40HQ标准柜型', () => {
      const container40HQ = engine.STANDARD_CONTAINER_TYPES['40HQ'];
      
      expect(container40HQ).toBeDefined();
      expect(container40HQ.typeId).toBe('40HQ');
      expect(container40HQ.name).toBe('40HQ高柜集装箱');
      expect(container40HQ.innerLength).toBe(12032);
      expect(container40HQ.innerWidth).toBe(2352);
      expect(container40HQ.innerHeight).toBe(2698);
      expect(container40HQ.maxWeight).toBe(26680);
    });

    test('所有标准柜型应该包含必需字段', () => {
      const requiredFields = ['typeId', 'name', 'innerLength', 'innerWidth', 'innerHeight', 'maxWeight'];
      
      Object.values(engine.STANDARD_CONTAINER_TYPES).forEach(container => {
        requiredFields.forEach(field => {
          expect(container[field]).toBeDefined();
          if (field !== 'typeId' && field !== 'name') {
            expect(typeof container[field]).toBe('number');
            expect(container[field]).toBeGreaterThan(0);
          }
        });
      });
    });
  });

  describe('11.2: 自定义柜型参数验证', () => {
    test('应该接受有效的自定义柜型参数', () => {
      const customContainer = {
        typeId: 'CUSTOM',
        name: '自定义集装箱',
        innerLength: 10000,
        innerWidth: 2500,
        innerHeight: 2500,
        maxWeight: 25000
      };

      const result = engine.validateContainerType(customContainer);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('应该拒绝空的柜型参数', () => {
      const result = engine.validateContainerType(null);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('柜型参数不能为空');
    });

    test('应该拒绝缺少innerLength的柜型', () => {
      const invalidContainer = {
        innerWidth: 2500,
        innerHeight: 2500,
        maxWeight: 25000
      };

      const result = engine.validateContainerType(invalidContainer);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('innerLength'))).toBe(true);
    });

    test('应该拒绝负数的innerLength', () => {
      const invalidContainer = {
        innerLength: -1000,
        innerWidth: 2500,
        innerHeight: 2500,
        maxWeight: 25000
      };

      const result = engine.validateContainerType(invalidContainer);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('innerLength'))).toBe(true);
    });

    test('应该拒绝缺少innerWidth的柜型', () => {
      const invalidContainer = {
        innerLength: 10000,
        innerHeight: 2500,
        maxWeight: 25000
      };

      const result = engine.validateContainerType(invalidContainer);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('innerWidth'))).toBe(true);
    });

    test('应该拒绝缺少innerHeight的柜型', () => {
      const invalidContainer = {
        innerLength: 10000,
        innerWidth: 2500,
        maxWeight: 25000
      };

      const result = engine.validateContainerType(invalidContainer);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('innerHeight'))).toBe(true);
    });

    test('应该拒绝缺少maxWeight的柜型', () => {
      const invalidContainer = {
        innerLength: 10000,
        innerWidth: 2500,
        innerHeight: 2500
      };

      const result = engine.validateContainerType(invalidContainer);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maxWeight'))).toBe(true);
    });

    test('应该拒绝过小的尺寸', () => {
      const invalidContainer = {
        innerLength: 500,  // 太小
        innerWidth: 2500,
        innerHeight: 2500,
        maxWeight: 25000
      };

      const result = engine.validateContainerType(invalidContainer);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('innerLength'))).toBe(true);
    });

    test('应该拒绝过大的尺寸', () => {
      const invalidContainer = {
        innerLength: 25000,  // 太大
        innerWidth: 2500,
        innerHeight: 2500,
        maxWeight: 25000
      };

      const result = engine.validateContainerType(invalidContainer);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('innerLength'))).toBe(true);
    });

    test('应该在generatePackingPlan中验证柜型参数', async () => {
      const invalidContainer = {
        innerLength: -1000,
        innerWidth: 2500,
        innerHeight: 2500,
        maxWeight: 25000
      };

      const cargoList = [{
        cargoId: 'C1',
        name: '测试货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3
      }];

      await expect(engine.generatePackingPlan(cargoList, invalidContainer))
        .rejects.toThrow('柜型参数验证失败');
    });
  });

  describe('11.3: 柜型推荐逻辑', () => {
    test('应该为小批量货物推荐20GP', () => {
      const smallCargoList = [
        {
          cargoId: 'C1',
          name: '小货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 500,
          quantity: 10,
          stackable: true,
          maxStackLayers: 3
        }
      ];

      const recommended = engine.recommendContainerType(smallCargoList);
      
      expect(recommended.typeId).toBe('20GP');
    });

    test('应该为中等批量货物推荐40GP或40HQ', () => {
      const mediumCargoList = [
        {
          cargoId: 'C1',
          name: '中等货物',
          length: 1200,
          width: 1000,
          height: 1000,
          weight: 500,
          quantity: 50,
          stackable: true,
          maxStackLayers: 3
        }
      ];

      const recommended = engine.recommendContainerType(mediumCargoList);
      
      // 由于装箱效率系数，可能推荐40GP或40HQ
      expect(['40GP', '40HQ']).toContain(recommended.typeId);
    });

    test('应该为高货物推荐40HQ', () => {
      const tallCargoList = [
        {
          cargoId: 'C1',
          name: '高货物',
          length: 1200,
          width: 1000,
          height: 2000,  // 较高的货物
          weight: 500,
          quantity: 30,
          stackable: false,
          maxStackLayers: 1
        }
      ];

      const recommended = engine.recommendContainerType(tallCargoList);
      
      expect(recommended.typeId).toBe('40HQ');
    });

    test('应该考虑货物总重量', () => {
      const heavyCargoList = [
        {
          cargoId: 'C1',
          name: '重货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 2000,  // 重货物
          quantity: 12,  // 总重24000kg，超过20GP的21800kg
          stackable: true,
          maxStackLayers: 3
        }
      ];

      const recommended = engine.recommendContainerType(heavyCargoList);
      
      // 应该推荐40GP或40HQ（maxWeight: 26680kg）
      expect(['40GP', '40HQ']).toContain(recommended.typeId);
    });

    test('应该为超大货物返回40HQ', () => {
      const largeCargoList = [
        {
          cargoId: 'C1',
          name: '超大货物',
          length: 2000,
          width: 2000,
          height: 2000,
          weight: 1000,
          quantity: 100,  // 超出所有标准柜型
          stackable: true,
          maxStackLayers: 3
        }
      ];

      const recommended = engine.recommendContainerType(largeCargoList);
      
      expect(recommended.typeId).toBe('40HQ');
    });

    test('推荐的柜型应该包含所有必需字段', () => {
      const cargoList = [
        {
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 500,
          quantity: 10,
          stackable: true,
          maxStackLayers: 3
        }
      ];

      const recommended = engine.recommendContainerType(cargoList);
      
      expect(recommended.typeId).toBeDefined();
      expect(recommended.name).toBeDefined();
      expect(recommended.innerLength).toBeGreaterThan(0);
      expect(recommended.innerWidth).toBeGreaterThan(0);
      expect(recommended.innerHeight).toBeGreaterThan(0);
      expect(recommended.maxWeight).toBeGreaterThan(0);
    });

    test('应该考虑装箱效率系数', () => {
      // 创建一个货物列表，其总体积接近20GP的容量
      const container20GP = engine.STANDARD_CONTAINER_TYPES['20GP'];
      const container20GPVolume = container20GP.innerLength * 
                                  container20GP.innerWidth * 
                                  container20GP.innerHeight;
      
      // 货物总体积为20GP容量的80%（考虑1.3倍效率系数后会超过100%）
      const targetVolume = container20GPVolume * 0.8;
      const cargoVolume = 1000 * 1000 * 1000; // 1m³
      const quantity = Math.floor(targetVolume / cargoVolume);

      const cargoList = [
        {
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: quantity,
          stackable: true,
          maxStackLayers: 3
        }
      ];

      const recommended = engine.recommendContainerType(cargoList);
      
      // 由于效率系数，应该推荐更大的柜型
      expect(['40GP', '40HQ']).toContain(recommended.typeId);
    });
  });

  describe('集成测试：使用不同柜型生成装箱方案', () => {
    test('应该能使用20GP生成装箱方案', async () => {
      const container20GP = engine.STANDARD_CONTAINER_TYPES['20GP'];
      const cargoList = [
        {
          cargoId: 'C1',
          name: '小货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 500,
          quantity: 5,
          stackable: true,
          maxStackLayers: 3
        }
      ];

      const plan = await engine.generatePackingPlan(cargoList, container20GP);
      
      expect(plan).toBeDefined();
      expect(plan.containerType.typeId).toBe('20GP');
      expect(plan.loadedCargo.length).toBeGreaterThan(0);
    });

    test('应该能使用40GP生成装箱方案', async () => {
      const container40GP = engine.STANDARD_CONTAINER_TYPES['40GP'];
      const cargoList = [
        {
          cargoId: 'C1',
          name: '中等货物',
          length: 1200,
          width: 1000,
          height: 1000,
          weight: 500,
          quantity: 20,
          stackable: true,
          maxStackLayers: 3
        }
      ];

      const plan = await engine.generatePackingPlan(cargoList, container40GP);
      
      expect(plan).toBeDefined();
      expect(plan.containerType.typeId).toBe('40GP');
      expect(plan.loadedCargo.length).toBeGreaterThan(0);
    });

    test('应该能使用40HQ生成装箱方案', async () => {
      const container40HQ = engine.STANDARD_CONTAINER_TYPES['40HQ'];
      const cargoList = [
        {
          cargoId: 'C1',
          name: '高货物',
          length: 1200,
          width: 1000,
          height: 2000,
          weight: 500,
          quantity: 15,
          stackable: false,
          maxStackLayers: 1
        }
      ];

      const plan = await engine.generatePackingPlan(cargoList, container40HQ);
      
      expect(plan).toBeDefined();
      expect(plan.containerType.typeId).toBe('40HQ');
      expect(plan.loadedCargo.length).toBeGreaterThan(0);
    });

    test('应该能使用自定义柜型生成装箱方案', async () => {
      const customContainer = {
        typeId: 'CUSTOM',
        name: '自定义集装箱',
        innerLength: 10000,
        innerWidth: 2500,
        innerHeight: 2500,
        maxWeight: 25000
      };

      const cargoList = [
        {
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 500,
          quantity: 10,
          stackable: true,
          maxStackLayers: 3
        }
      ];

      const plan = await engine.generatePackingPlan(cargoList, customContainer);
      
      expect(plan).toBeDefined();
      expect(plan.containerType.typeId).toBe('CUSTOM');
      expect(plan.loadedCargo.length).toBeGreaterThan(0);
    });
  });
});
