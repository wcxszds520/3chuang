/**
 * Task 3 测试：核心装箱算法
 * 测试 SpaceManager 和 _canPlaceCargo() 的集成
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');
const Cargo = require('../../models/Cargo');
const ContainerType = require('../../models/ContainerType');

describe('OptimizedPackingEngine - Task 3: 核心装箱算法', () => {
  let engine;
  let containerType;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
    
    // 创建一个标准40GP柜型
    containerType = new ContainerType({
      typeId: '40GP',
      name: '40英尺标准柜',
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2393,
      maxWeight: 26000
    });
  });

  describe('3.1 _guillotinePackingPhase() 使用 SpaceManager', () => {
    test('应该初始化 SpaceManager 并使用它进行装箱', async () => {
      const cargoList = [
        new Cargo({
          cargoId: 'cargo1',
          name: '货物1',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 3,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        })
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证 SpaceManager 被初始化
      expect(engine.spaceManager).toBeDefined();
      expect(engine.spaceManager.freeRectangles).toBeDefined();
      expect(engine.spaceManager.occupiedSpaces).toBeDefined();

      // 验证货物被成功装载
      expect(plan.loadedCargo.length).toBeGreaterThan(0);
      
      // 验证每个货物都有 loadingOrder 和 stackLevel
      plan.loadedCargo.forEach(loaded => {
        expect(loaded.loadingOrder).toBeDefined();
        expect(loaded.stackLevel).toBeDefined();
        expect(typeof loaded.stackLevel).toBe('number');
        expect(loaded.stackLevel).toBeGreaterThanOrEqual(0);
      });
    });

    test('应该记录正确的 stackLevel', async () => {
      const cargoList = [
        new Cargo({
          cargoId: 'cargo1',
          name: '可堆叠货物',
          length: 1000,
          width: 1000,
          height: 500,
          weight: 100,
          quantity: 4,
          stackable: true,
          maxStackLayers: 4,
          canInvert: false,
          canLayFlat: false
        })
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 应该至少有一些货物被堆叠
      const stackLevels = plan.loadedCargo.map(c => c.stackLevel);
      const maxStackLevel = Math.max(...stackLevels);
      
      // 验证有不同的堆叠层级
      expect(maxStackLevel).toBeGreaterThan(0);
      
      // 验证底层货物的 stackLevel 为 0
      const bottomCargo = plan.loadedCargo.filter(c => c.position.z === 0);
      bottomCargo.forEach(c => {
        expect(c.stackLevel).toBe(0);
      });
    });

    test('应该使用 SpaceManager.findBestFit() 查找最佳位置', async () => {
      const cargoList = [
        new Cargo({
          cargoId: 'cargo1',
          name: '小货物',
          length: 500,
          width: 500,
          height: 500,
          weight: 50,
          quantity: 2,
          stackable: false,
          maxStackLayers: 1,
          canInvert: false,
          canLayFlat: false
        })
      ];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证货物被放置在合理的位置
      expect(plan.loadedCargo.length).toBe(2);
      
      // 验证货物不重叠
      for (let i = 0; i < plan.loadedCargo.length; i++) {
        for (let j = i + 1; j < plan.loadedCargo.length; j++) {
          const c1 = plan.loadedCargo[i];
          const c2 = plan.loadedCargo[j];
          
          const overlap = !(
            c1.position.x + c1.rotation.length <= c2.position.x ||
            c2.position.x + c2.rotation.length <= c1.position.x ||
            c1.position.y + c1.rotation.width <= c2.position.y ||
            c2.position.y + c2.rotation.width <= c1.position.y ||
            c1.position.z + c1.rotation.height <= c2.position.z ||
            c2.position.z + c2.rotation.height <= c1.position.z
          );
          
          expect(overlap).toBe(false);
        }
      }
    });
  });

  describe('3.2 _canPlaceCargo() 综合约束检查', () => {
    test('应该检查边界约束（需求 8.2）', () => {
      const cargo = new Cargo({
        cargoId: 'cargo1',
        name: '货物1',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false
      });

      const plan = { loadedCargo: [], occupiedSpaces: [] };
      const rotation = { length: 1000, width: 1000, height: 1000 };

      // 测试超出边界的位置
      const invalidPosition = {
        x: containerType.innerLength - 500, // 超出长度
        y: 0,
        z: 0
      };

      const result = engine._canPlaceCargo(cargo, invalidPosition, rotation, plan, containerType);
      expect(result).toBe(false);

      // 测试有效位置
      const validPosition = { x: 0, y: 0, z: 0 };
      const result2 = engine._canPlaceCargo(cargo, validPosition, rotation, plan, containerType);
      expect(result2).toBe(true);
    });

    test('应该检查碰撞检测（需求 8.3）', () => {
      const cargo = new Cargo({
        cargoId: 'cargo1',
        name: '货物1',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false
      });

      const rotation = { length: 1000, width: 1000, height: 1000 };

      // 创建一个已有货物的方案
      const plan = {
        loadedCargo: [{
          cargo: cargo,
          position: { x: 0, y: 0, z: 0 },
          rotation: rotation,
          stackLevel: 0
        }],
        occupiedSpaces: [{
          position: { x: 0, y: 0, z: 0 },
          rotation: rotation
        }]
      };

      // 测试重叠位置
      const overlappingPosition = { x: 500, y: 500, z: 500 };
      const result = engine._canPlaceCargo(cargo, overlappingPosition, rotation, plan, containerType);
      expect(result).toBe(false);

      // 测试不重叠位置
      const nonOverlappingPosition = { x: 2000, y: 0, z: 0 };
      const result2 = engine._canPlaceCargo(cargo, nonOverlappingPosition, rotation, plan, containerType);
      expect(result2).toBe(true);
    });

    test('应该检查总重量限制（需求 8.1）', () => {
      const heavyCargo = new Cargo({
        cargoId: 'heavy',
        name: '重货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 20000,
        quantity: 1,
        stackable: true,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: false
      });

      const rotation = { length: 1000, width: 1000, height: 1000 };

      // 创建一个已经接近重量限制的方案
      const plan = {
        loadedCargo: [{
          cargo: heavyCargo,
          position: { x: 0, y: 0, z: 0 },
          rotation: rotation,
          stackLevel: 0
        }],
        occupiedSpaces: [{
          position: { x: 0, y: 0, z: 0 },
          rotation: rotation
        }]
      };

      // 尝试添加另一个重货物（总重量会超过限制）
      const position = { x: 2000, y: 0, z: 0 };
      const result = engine._canPlaceCargo(heavyCargo, position, rotation, plan, containerType);
      expect(result).toBe(false);
    });

    test('应该调用 StackManager.canStack() 检查堆叠约束（需求 8.4）', () => {
      const nonStackableCargo = new Cargo({
        cargoId: 'non_stackable',
        name: '不可堆叠货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1,
        stackable: false,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: false
      });

      const rotation = { length: 1000, width: 1000, height: 1000 };

      // 创建一个底层有不可堆叠货物的方案
      const plan = {
        loadedCargo: [{
          cargo: nonStackableCargo,
          position: { x: 0, y: 0, z: 0 },
          rotation: rotation,
          stackLevel: 0
        }],
        occupiedSpaces: [{
          position: { x: 0, y: 0, z: 0 },
          rotation: rotation
        }]
      };

      // 尝试在不可堆叠货物上方放置货物
      const abovePosition = { x: 0, y: 0, z: 1000 };
      const result = engine._canPlaceCargo(nonStackableCargo, abovePosition, rotation, plan, containerType);
      expect(result).toBe(false);
    });
  });
});
