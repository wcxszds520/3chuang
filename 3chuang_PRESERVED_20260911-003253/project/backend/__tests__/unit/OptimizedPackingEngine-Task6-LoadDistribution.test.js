/**
 * Task 6: 基于实际位置的偏载计算测试
 * 
 * 测试目标：
 * - 6.1: _calculateLoadDistribution()计算区域重量分布
 * - 6.2: 偏载警告检测
 * 
 * 验证需求：4.1, 4.2, 4.3, 4.4, 4.5
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('Task 6: 基于实际位置的偏载计算', () => {
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

  describe('6.1: _calculateLoadDistribution()计算区域重量分布', () => {
    test('空方案应返回零值', () => {
      const plan = { loadedCargo: [] };
      const distribution = engine._calculateLoadDistribution(plan, containerType);

      expect(distribution).toEqual({
        front: 0,
        back: 0,
        left: 0,
        right: 0,
        frontPercent: 0,
        backPercent: 0,
        leftPercent: 0,
        rightPercent: 0,
        frontBackImbalance: 0,
        leftRightImbalance: 0,
        warning: null
      });
    });

    test('单个货物在后部左侧', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { weight: 100 },
            position: { x: 1000, y: 500, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000 }
          }
        ]
      };

      const distribution = engine._calculateLoadDistribution(plan, containerType);

      // 货物中心点: x=1500 (< 6016中心线), y=1000 (< 1176中心线)
      // 应该在后部左侧
      expect(distribution.back).toBe(100);
      expect(distribution.front).toBe(0);
      expect(distribution.left).toBe(100);
      expect(distribution.right).toBe(0);
      expect(distribution.backPercent).toBe(100);
      expect(distribution.frontPercent).toBe(0);
      expect(distribution.leftPercent).toBe(100);
      expect(distribution.rightPercent).toBe(0);
    });

    test('单个货物在前部右侧', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { weight: 200 },
            position: { x: 10000, y: 1500, z: 0 },
            rotation: { length: 1000, width: 500, height: 1000 }
          }
        ]
      };

      const distribution = engine._calculateLoadDistribution(plan, containerType);

      // 货物中心点: x=10500 (> 6016中心线), y=1750 (> 1176中心线)
      // 应该在前部右侧
      expect(distribution.front).toBe(200);
      expect(distribution.back).toBe(0);
      expect(distribution.right).toBe(200);
      expect(distribution.left).toBe(0);
      expect(distribution.frontPercent).toBe(100);
      expect(distribution.backPercent).toBe(0);
      expect(distribution.rightPercent).toBe(100);
      expect(distribution.leftPercent).toBe(0);
    });

    test('均匀分布的货物', () => {
      const plan = {
        loadedCargo: [
          // 后部左侧
          {
            cargo: { weight: 100 },
            position: { x: 1000, y: 500, z: 0 },
            rotation: { length: 1000, width: 500, height: 1000 }
          },
          // 前部左侧
          {
            cargo: { weight: 100 },
            position: { x: 10000, y: 500, z: 0 },
            rotation: { length: 1000, width: 500, height: 1000 }
          },
          // 后部右侧
          {
            cargo: { weight: 100 },
            position: { x: 1000, y: 1500, z: 0 },
            rotation: { length: 1000, width: 500, height: 1000 }
          },
          // 前部右侧
          {
            cargo: { weight: 100 },
            position: { x: 10000, y: 1500, z: 0 },
            rotation: { length: 1000, width: 500, height: 1000 }
          }
        ]
      };

      const distribution = engine._calculateLoadDistribution(plan, containerType);

      // 完全均匀分布
      expect(distribution.front).toBe(200);
      expect(distribution.back).toBe(200);
      expect(distribution.left).toBe(200);
      expect(distribution.right).toBe(200);
      expect(distribution.frontPercent).toBe(50);
      expect(distribution.backPercent).toBe(50);
      expect(distribution.leftPercent).toBe(50);
      expect(distribution.rightPercent).toBe(50);
      expect(distribution.frontBackImbalance).toBe(0);
      expect(distribution.leftRightImbalance).toBe(0);
      expect(distribution.warning).toBeNull();
    });

    test('计算不平衡度', () => {
      const plan = {
        loadedCargo: [
          // 后部：300kg
          {
            cargo: { weight: 300 },
            position: { x: 1000, y: 1000, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000 }
          },
          // 前部：100kg
          {
            cargo: { weight: 100 },
            position: { x: 10000, y: 1000, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000 }
          }
        ]
      };

      const distribution = engine._calculateLoadDistribution(plan, containerType);

      expect(distribution.back).toBe(300);
      expect(distribution.front).toBe(100);
      expect(distribution.backPercent).toBe(75);
      expect(distribution.frontPercent).toBe(25);
      
      // 不平衡度 = |300-100| / 400 * 100 = 50%
      expect(distribution.frontBackImbalance).toBe(50);
    });

    test('百分比总和应为100%', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { weight: 150 },
            position: { x: 1000, y: 500, z: 0 },
            rotation: { length: 1000, width: 500, height: 1000 }
          },
          {
            cargo: { weight: 250 },
            position: { x: 10000, y: 1500, z: 0 },
            rotation: { length: 1000, width: 500, height: 1000 }
          }
        ]
      };

      const distribution = engine._calculateLoadDistribution(plan, containerType);

      // 前后百分比之和应为100%
      expect(distribution.frontPercent + distribution.backPercent).toBeCloseTo(100, 1);
      
      // 左右百分比之和应为100%
      expect(distribution.leftPercent + distribution.rightPercent).toBeCloseTo(100, 1);
    });
  });

  describe('6.2: 偏载警告检测', () => {
    test('前后偏载超过10%应触发警告', () => {
      const plan = {
        loadedCargo: [
          // 后部：600kg
          {
            cargo: { weight: 600 },
            position: { x: 1000, y: 1000, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000 }
          },
          // 前部：400kg
          {
            cargo: { weight: 400 },
            position: { x: 10000, y: 1000, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000 }
          }
        ]
      };

      const distribution = engine._calculateLoadDistribution(plan, containerType);

      // 不平衡度 = |600-400| / 1000 * 100 = 20%
      expect(distribution.frontBackImbalance).toBe(20);
      expect(distribution.warning).toContain('前后偏载');
      expect(distribution.warning).toContain('后部');
    });

    test('左右偏载超过10%应触发警告', () => {
      const plan = {
        loadedCargo: [
          // 左侧：300kg (y中心点 = 500 + 250 = 750 < 1176)
          {
            cargo: { weight: 300 },
            position: { x: 6000, y: 500, z: 0 },
            rotation: { length: 1000, width: 500, height: 1000 }
          },
          // 右侧：700kg (y中心点 = 1500 + 250 = 1750 > 1176)
          {
            cargo: { weight: 700 },
            position: { x: 6000, y: 1500, z: 0 },
            rotation: { length: 1000, width: 500, height: 1000 }
          }
        ]
      };

      const distribution = engine._calculateLoadDistribution(plan, containerType);

      // 不平衡度 = |300-700| / 1000 * 100 = 40%
      expect(distribution.leftRightImbalance).toBe(40);
      expect(distribution.warning).toContain('左右偏载');
      expect(distribution.warning).toContain('右侧');
    });

    test('前后和左右同时偏载应显示两个警告', () => {
      const plan = {
        loadedCargo: [
          // 后部左侧：100kg
          {
            cargo: { weight: 100 },
            position: { x: 1000, y: 500, z: 0 },
            rotation: { length: 1000, width: 500, height: 1000 }
          },
          // 前部右侧：900kg
          {
            cargo: { weight: 900 },
            position: { x: 10000, y: 1500, z: 0 },
            rotation: { length: 1000, width: 500, height: 1000 }
          }
        ]
      };

      const distribution = engine._calculateLoadDistribution(plan, containerType);

      expect(distribution.frontBackImbalance).toBe(80);
      expect(distribution.leftRightImbalance).toBe(80);
      expect(distribution.warning).toContain('前后偏载');
      expect(distribution.warning).toContain('左右偏载');
      expect(distribution.warning).toContain('；');
    });

    test('偏载恰好10%不应触发警告', () => {
      const plan = {
        loadedCargo: [
          // 后部左侧：275kg
          {
            cargo: { weight: 275 },
            position: { x: 1000, y: 500, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000 }
          },
          // 前部左侧：225kg
          {
            cargo: { weight: 225 },
            position: { x: 10000, y: 500, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000 }
          },
          // 后部右侧：275kg
          {
            cargo: { weight: 275 },
            position: { x: 1000, y: 1500, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000 }
          },
          // 前部右侧：225kg
          {
            cargo: { weight: 225 },
            position: { x: 10000, y: 1500, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000 }
          }
        ]
      };

      const distribution = engine._calculateLoadDistribution(plan, containerType);

      // 前后不平衡度 = |450-550| / 1000 * 100 = 10%
      expect(distribution.frontBackImbalance).toBe(10);
      // 左右不平衡度 = |500-500| / 1000 * 100 = 0%
      expect(distribution.leftRightImbalance).toBe(0);
      // 恰好10%不应触发警告
      expect(distribution.warning).toBeNull();
    });

    test('偏载略超过10%应触发警告', () => {
      const plan = {
        loadedCargo: [
          // 后部：551kg
          {
            cargo: { weight: 551 },
            position: { x: 1000, y: 1000, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000 }
          },
          // 前部：449kg
          {
            cargo: { weight: 449 },
            position: { x: 10000, y: 1000, z: 0 },
            rotation: { length: 1000, width: 1000, height: 1000 }
          }
        ]
      };

      const distribution = engine._calculateLoadDistribution(plan, containerType);

      // 不平衡度 = |551-449| / 1000 * 100 = 10.2%
      expect(distribution.frontBackImbalance).toBeCloseTo(10.2, 1);
      expect(distribution.warning).toContain('前后偏载');
    });
  });

  describe('集成测试：完整装箱方案中的偏载计算', () => {
    test('generatePackingPlan应包含loadDistribution', async () => {
      const cargoList = [
        {
          cargoId: 'C1',
          name: '货物1',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 500,
          quantity: 2,
          stackable: true,
          maxStackLayers: 2
        }
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      expect(plan.loadDistribution).toBeDefined();
      expect(plan.loadDistribution).toHaveProperty('front');
      expect(plan.loadDistribution).toHaveProperty('back');
      expect(plan.loadDistribution).toHaveProperty('left');
      expect(plan.loadDistribution).toHaveProperty('right');
      expect(plan.loadDistribution).toHaveProperty('frontPercent');
      expect(plan.loadDistribution).toHaveProperty('backPercent');
      expect(plan.loadDistribution).toHaveProperty('leftPercent');
      expect(plan.loadDistribution).toHaveProperty('rightPercent');
      expect(plan.loadDistribution).toHaveProperty('frontBackImbalance');
      expect(plan.loadDistribution).toHaveProperty('leftRightImbalance');
      expect(plan.loadDistribution).toHaveProperty('warning');
    });

    test('多种货物的偏载计算', async () => {
      const cargoList = [
        {
          cargoId: 'C1',
          name: '重货',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 1000,
          quantity: 5,
          stackable: true,
          maxStackLayers: 2
        },
        {
          cargoId: 'C2',
          name: '轻货',
          length: 500,
          width: 500,
          height: 500,
          weight: 100,
          quantity: 10,
          stackable: true,
          maxStackLayers: 3
        }
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      const dist = plan.loadDistribution;
      
      // 验证重量总和
      const totalWeight = dist.front + dist.back;
      expect(totalWeight).toBeGreaterThan(0);
      
      // 验证百分比总和
      expect(dist.frontPercent + dist.backPercent).toBeCloseTo(100, 1);
      expect(dist.leftPercent + dist.rightPercent).toBeCloseTo(100, 1);
      
      // 验证不平衡度计算
      const expectedFBImbalance = Math.abs(dist.front - dist.back) / totalWeight * 100;
      expect(dist.frontBackImbalance).toBeCloseTo(expectedFBImbalance, 1);
      
      const expectedLRImbalance = Math.abs(dist.left - dist.right) / totalWeight * 100;
      expect(dist.leftRightImbalance).toBeCloseTo(expectedLRImbalance, 1);
    });
  });
});
