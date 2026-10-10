/**
 * 测试OptimizedPackingEngine的货物预处理和排序功能
 * 对应任务 2: 实现货物预处理和排序策略
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');
const Cargo = require('../../models/Cargo');

describe('OptimizedPackingEngine - 货物预处理和排序', () => {
  let engine;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
  });

  describe('2.1 _sortCargoByStrategy() 多维度货物排序', () => {
    const testCargo = [
      new Cargo({
        cargoId: 'cargo1',
        name: '空气炸锅',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 3,
        stackable: true,
        maxStackLayers: 4,
        canInvert: false,
        canLayFlat: false
      }),
      new Cargo({
        cargoId: 'cargo2',
        name: '取暖器',
        length: 500,
        width: 400,
        height: 600,
        weight: 8,
        quantity: 2,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false
      }),
      new Cargo({
        cargoId: 'cargo3',
        name: '电风扇',
        length: 400,
        width: 400,
        height: 1200,
        weight: 6,
        quantity: 2,
        stackable: false,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: false
      })
    ];

    test('应该正确展开批量货物（quantity > 1）', () => {
      const strategy = { sortStrategy: 'volume_desc' };
      const sorted = engine._sortCargoByStrategy(testCargo, strategy);

      // 总数应该是所有货物数量之和: 3 + 2 + 2 = 7
      expect(sorted.length).toBe(7);

      // 每个货物的quantity应该是1
      sorted.forEach(cargo => {
        expect(cargo.quantity).toBe(1);
      });

      // 应该有正确的instanceId
      const cargo1Instances = sorted.filter(c => c.originalId === 'cargo1');
      expect(cargo1Instances.length).toBe(3);
      expect(cargo1Instances[0].instanceId).toBe('cargo1_1');
      expect(cargo1Instances[1].instanceId).toBe('cargo1_2');
      expect(cargo1Instances[2].instanceId).toBe('cargo1_3');
    });

    test('按体积降序排序 (volume_desc)', () => {
      const strategy = { sortStrategy: 'volume_desc' };
      const sorted = engine._sortCargoByStrategy(testCargo, strategy);

      // 验证按体积降序排列
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].getVolume()).toBeGreaterThanOrEqual(sorted[i + 1].getVolume());
      }
    });

    test('按重量降序排序 (weight_desc)', () => {
      const strategy = { sortStrategy: 'weight_desc' };
      const sorted = engine._sortCargoByStrategy(testCargo, strategy);

      // 验证按重量降序排列
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].weight).toBeGreaterThanOrEqual(sorted[i + 1].weight);
      }
    });

    test('按堆叠能力优先排序 (stacking_priority)', () => {
      const strategy = { sortStrategy: 'stacking_priority' };
      const sorted = engine._sortCargoByStrategy(testCargo, strategy);

      // 可堆叠的货物应该在前面
      const stackableCount = sorted.filter(c => c.stackable).length;
      const nonStackableCount = sorted.filter(c => !c.stackable).length;

      // 前面的货物应该都是可堆叠的
      for (let i = 0; i < stackableCount; i++) {
        expect(sorted[i].stackable).toBe(true);
      }

      // 后面的货物应该都是不可堆叠的
      for (let i = stackableCount; i < sorted.length; i++) {
        expect(sorted[i].stackable).toBe(false);
      }

      // 在可堆叠货物中，maxStackLayers高的应该在前面
      for (let i = 0; i < stackableCount - 1; i++) {
        if (sorted[i].stackable && sorted[i + 1].stackable) {
          expect(sorted[i].maxStackLayers).toBeGreaterThanOrEqual(sorted[i + 1].maxStackLayers);
        }
      }
    });

    test('综合评分排序 (composite_score)', () => {
      const strategy = { sortStrategy: 'composite_score' };
      const sorted = engine._sortCargoByStrategy(testCargo, strategy);

      // 验证按综合评分降序排列
      for (let i = 0; i < sorted.length - 1; i++) {
        const scoreA = engine._calculateCompositeScore(sorted[i]);
        const scoreB = engine._calculateCompositeScore(sorted[i + 1]);
        expect(scoreA).toBeGreaterThanOrEqual(scoreB);
      }
    });
  });

  describe('2.2 _generateRotations() 货物旋转方向生成', () => {
    test('应该为可旋转货物生成多个旋转方向', () => {
      const cargo = new Cargo({
        cargoId: 'cargo1',
        name: '测试货物',
        length: 100,
        width: 200,
        height: 300,
        weight: 5,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: true,
        canLayFlat: true
      });

      const strategy = { rotationPriority: 'height_min' };
      const rotations = engine._generateRotations(cargo, strategy);

      // 完全可旋转的货物应该有6个旋转方向
      expect(rotations.length).toBe(6);

      // 每个旋转应该有length, width, height和rotation属性
      rotations.forEach(rot => {
        expect(rot).toHaveProperty('length');
        expect(rot).toHaveProperty('width');
        expect(rot).toHaveProperty('height');
        expect(rot).toHaveProperty('rotation');
        expect(rot.rotation).toHaveProperty('x');
        expect(rot.rotation).toHaveProperty('y');
        expect(rot.rotation).toHaveProperty('z');
      });
    });

    test('应该遵守canInvert约束', () => {
      const cargo = new Cargo({
        cargoId: 'cargo1',
        name: '不可倒置货物',
        length: 100,
        width: 200,
        height: 300,
        weight: 5,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,  // 不可倒置
        canLayFlat: true
      });

      const strategy = { rotationPriority: 'height_min' };
      const rotations = engine._generateRotations(cargo, strategy);

      // 所有旋转的高度应该保持为原始高度
      rotations.forEach(rot => {
        expect(rot.height).toBe(cargo.height);
      });
    });

    test('应该遵守canLayFlat约束', () => {
      const cargo = new Cargo({
        cargoId: 'cargo1',
        name: '不可平放货物',
        length: 100,
        width: 200,
        height: 300,
        weight: 5,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: true,
        canLayFlat: false  // 不可平放
      });

      const strategy = { rotationPriority: 'height_min' };
      const rotations = engine._generateRotations(cargo, strategy);

      // 长度和宽度不应该等于原始高度（不能平放）
      rotations.forEach(rot => {
        expect(rot.length).not.toBe(cargo.height);
        expect(rot.width).not.toBe(cargo.height);
      });
    });

    test('应该为完全不可旋转的货物返回至少一个旋转', () => {
      const cargo = new Cargo({
        cargoId: 'cargo1',
        name: '不可旋转货物',
        length: 100,
        width: 200,
        height: 300,
        weight: 5,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false
      });

      const strategy = { rotationPriority: 'height_min' };
      const rotations = engine._generateRotations(cargo, strategy);

      // 至少应该有一个旋转（原始方向）
      expect(rotations.length).toBeGreaterThanOrEqual(1);
      expect(rotations[0].length).toBe(cargo.length);
      expect(rotations[0].width).toBe(cargo.width);
      expect(rotations[0].height).toBe(cargo.height);
    });
  });

  describe('2.3 _calculateCompositeScore() 综合评分计算', () => {
    test('应该为高堆叠能力货物给予更高评分', () => {
      const highStack = new Cargo({
        cargoId: 'cargo1',
        name: '高堆叠货物',
        length: 100,
        width: 100,
        height: 100,
        weight: 5,
        quantity: 1,
        stackable: true,
        maxStackLayers: 5,
        canInvert: false,
        canLayFlat: false
      });

      const lowStack = new Cargo({
        cargoId: 'cargo2',
        name: '低堆叠货物',
        length: 100,
        width: 100,
        height: 100,
        weight: 5,
        quantity: 1,
        stackable: true,
        maxStackLayers: 2,
        canInvert: false,
        canLayFlat: false
      });

      const scoreHigh = engine._calculateCompositeScore(highStack);
      const scoreLow = engine._calculateCompositeScore(lowStack);

      expect(scoreHigh).toBeGreaterThan(scoreLow);
    });

    test('应该综合考虑体积、重量和堆叠能力', () => {
      const cargo = new Cargo({
        cargoId: 'cargo1',
        name: '测试货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 10,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false
      });

      const score = engine._calculateCompositeScore(cargo);

      // 评分应该是一个正数
      expect(score).toBeGreaterThan(0);
      expect(typeof score).toBe('number');
      expect(isFinite(score)).toBe(true);
    });
  });
});
