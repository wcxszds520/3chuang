/**
 * ContainerType 单元测试
 * 
 * 测试目标：
 * - 验证 ContainerType 类的基本功能
 * - 验证 getVolume() 方法的正确性
 * - 验证 canFitCargo() 方法的正确性
 */

const ContainerType = require('../../models/ContainerType');

describe('ContainerType 数据模型测试', () => {
  
  describe('构造函数测试', () => {
    test('应该正确创建 40HQ 柜型对象', () => {
      const container = new ContainerType({
        typeId: '40HQ',
        name: '40英尺高柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2698,
        maxWeight: 26000,
        description: '适用于大批量、高度较高货物'
      });

      expect(container.typeId).toBe('40HQ');
      expect(container.name).toBe('40英尺高柜');
      expect(container.innerLength).toBe(12032);
      expect(container.innerWidth).toBe(2352);
      expect(container.innerHeight).toBe(2698);
      expect(container.maxWeight).toBe(26000);
      expect(container.description).toBe('适用于大批量、高度较高货物');
    });

    test('应该正确创建 20GP 柜型对象', () => {
      const container = new ContainerType({
        typeId: '20GP',
        name: '20英尺标准柜',
        innerLength: 5898,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 28000,
        description: '适用于小批量、高密度货物'
      });

      expect(container.typeId).toBe('20GP');
      expect(container.maxWeight).toBe(28000);
    });
  });

  describe('getVolume() 方法测试', () => {
    test('应该正确计算 40HQ 柜型容积', () => {
      const container = new ContainerType({
        typeId: '40HQ',
        name: '40英尺高柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2698,
        maxWeight: 26000
      });

      const volume = container.getVolume();
      const expectedVolume = 12032 * 2352 * 2698; // 76,363,407,360 立方毫米

      expect(volume).toBe(expectedVolume);
    });

    test('应该正确计算 20GP 柜型容积', () => {
      const container = new ContainerType({
        typeId: '20GP',
        name: '20英尺标准柜',
        innerLength: 5898,
        innerWidth: 2352,
        innerHeight: 2393,
        maxWeight: 28000
      });

      const volume = container.getVolume();
      const expectedVolume = 5898 * 2352 * 2393; // 33,186,129,216 立方毫米

      expect(volume).toBe(expectedVolume);
    });
  });

  describe('canFitCargo() 方法测试', () => {
    let container40HQ;

    beforeEach(() => {
      container40HQ = new ContainerType({
        typeId: '40HQ',
        name: '40英尺高柜',
        innerLength: 12032,
        innerWidth: 2352,
        innerHeight: 2698,
        maxWeight: 26000
      });
    });

    test('应该接受尺寸小于柜型的货物', () => {
      const cargo = {
        length: 300,
        width: 300,
        height: 350
      };

      expect(container40HQ.canFitCargo(cargo)).toBe(true);
    });

    test('应该接受尺寸等于柜型的货物', () => {
      const cargo = {
        length: 12032,
        width: 2352,
        height: 2698
      };

      expect(container40HQ.canFitCargo(cargo)).toBe(true);
    });

    test('应该拒绝长度超出柜型的货物', () => {
      const cargo = {
        length: 12033, // 超出 1mm
        width: 2352,
        height: 2698
      };

      expect(container40HQ.canFitCargo(cargo)).toBe(false);
    });

    test('应该拒绝宽度超出柜型的货物', () => {
      const cargo = {
        length: 12032,
        width: 2353, // 超出 1mm
        height: 2698
      };

      expect(container40HQ.canFitCargo(cargo)).toBe(false);
    });

    test('应该拒绝高度超出柜型的货物', () => {
      const cargo = {
        length: 12032,
        width: 2352,
        height: 2699 // 超出 1mm
      };

      expect(container40HQ.canFitCargo(cargo)).toBe(false);
    });

    test('应该正确处理货物旋转摆放的情况', () => {
      // 货物尺寸 300×400×500mm
      // 可以装入柜型 12032×2352×2698mm
      // 因为排序后：货物 [500,400,300] vs 柜型 [12032,2698,2352]
      const cargo = {
        length: 300,
        width: 400,
        height: 500
      };

      expect(container40HQ.canFitCargo(cargo)).toBe(true);
    });

    test('应该正确处理货物旋转后仍超出柜型的情况', () => {
      // 货物尺寸 13000×300×300mm
      // 无论如何旋转都无法装入柜型 12032×2352×2698mm
      // 因为排序后：货物 [13000,300,300] vs 柜型 [12032,2698,2352]
      // 13000 > 12032，超出最大尺寸
      const cargo = {
        length: 13000,
        width: 300,
        height: 300
      };

      expect(container40HQ.canFitCargo(cargo)).toBe(false);
    });

    test('应该正确处理边界情况 - 货物最大尺寸刚好等于柜型最小尺寸', () => {
      // 货物尺寸 2352×300×300mm
      // 排序后：货物 [2352,300,300] vs 柜型 [12032,2698,2352]
      // 2352 ≤ 12032, 300 ≤ 2698, 300 ≤ 2352，可以装入
      const cargo = {
        length: 2352,
        width: 300,
        height: 300
      };

      expect(container40HQ.canFitCargo(cargo)).toBe(true);
    });
  });
});
