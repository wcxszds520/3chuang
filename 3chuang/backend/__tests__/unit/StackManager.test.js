/**
 * StackManager单元测试
 * 验证堆叠管理器的核心功能
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('StackManager', () => {
  let engine;
  let stackManager;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
    stackManager = engine.stackManager;
  });

  describe('findCargoBelow', () => {
    test('应该找到正下方的货物', () => {
      const placedCargo = [
        {
          cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 3 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 500 }
        }
      ];

      const position = { x: 0, y: 0, z: 500 };
      const rotation = { length: 800, width: 800, height: 400 };

      const below = stackManager.findCargoBelow(position, rotation, placedCargo);
      
      expect(below).toHaveLength(1);
      expect(below[0].cargo.cargoId).toBe('C1');
    });

    test('应该找到部分重叠的下方货物', () => {
      const placedCargo = [
        {
          cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 3 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 500 }
        }
      ];

      const position = { x: 500, y: 500, z: 500 };
      const rotation = { length: 800, width: 800, height: 400 };

      const below = stackManager.findCargoBelow(position, rotation, placedCargo);
      
      expect(below).toHaveLength(1);
    });

    test('不应该找到不接触的货物', () => {
      const placedCargo = [
        {
          cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 3 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 500 }
        }
      ];

      const position = { x: 0, y: 0, z: 600 };
      const rotation = { length: 800, width: 800, height: 400 };

      const below = stackManager.findCargoBelow(position, rotation, placedCargo);
      
      expect(below).toHaveLength(0);
    });
  });

  describe('calculateSupportArea', () => {
    test('应该计算完全重叠的支撑面积', () => {
      const below = [
        {
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 500 }
        }
      ];

      const position = { x: 100, y: 100, z: 500 };
      const rotation = { length: 500, width: 500, height: 400 };

      const area = stackManager.calculateSupportArea(position, rotation, below);
      
      expect(area).toBe(500 * 500); // 完全支撑
    });

    test('应该计算部分重叠的支撑面积', () => {
      const below = [
        {
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 500 }
        }
      ];

      const position = { x: 500, y: 500, z: 500 };
      const rotation = { length: 1000, width: 1000, height: 400 };

      const area = stackManager.calculateSupportArea(position, rotation, below);
      
      expect(area).toBe(500 * 500); // 部分重叠
    });

    test('应该累加多个下方货物的支撑面积', () => {
      const below = [
        {
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 500, width: 500, height: 500 }
        },
        {
          position: { x: 500, y: 0, z: 0 },
          rotation: { length: 500, width: 500, height: 500 }
        }
      ];

      const position = { x: 0, y: 0, z: 500 };
      const rotation = { length: 1000, width: 500, height: 400 };

      const area = stackManager.calculateSupportArea(position, rotation, below);
      
      expect(area).toBe(500 * 500 + 500 * 500); // 两个货物的支撑面积
    });
  });

  describe('canStack', () => {
    test('应该允许在地面上放置货物', () => {
      const cargo = { stackable: true, maxStackLayers: 3 };
      const position = { x: 0, y: 0, z: 0 };
      const rotation = { length: 1000, width: 1000, height: 500 };
      const placedCargo = [];

      const result = stackManager.canStack(cargo, position, rotation, placedCargo);
      
      expect(result).toBe(true);
    });

    test('不应该允许在空中放置货物', () => {
      const cargo = { stackable: true, maxStackLayers: 3 };
      const position = { x: 0, y: 0, z: 500 };
      const rotation = { length: 1000, width: 1000, height: 500 };
      const placedCargo = [];

      const result = stackManager.canStack(cargo, position, rotation, placedCargo);
      
      expect(result).toBe(false);
    });

    test('不应该允许在不可堆叠货物上放置', () => {
      const placedCargo = [
        {
          cargo: { cargoId: 'C1', stackable: false, maxStackLayers: 0 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 500 }
        }
      ];

      const cargo = { stackable: true, maxStackLayers: 3 };
      const position = { x: 0, y: 0, z: 500 };
      const rotation = { length: 800, width: 800, height: 400 };

      const result = stackManager.canStack(cargo, position, rotation, placedCargo);
      
      expect(result).toBe(false);
    });

    test('不应该允许超过最大堆叠层数', () => {
      const placedCargo = [
        {
          cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 1 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 500 }
        },
        {
          cargo: { cargoId: 'C2', stackable: true, maxStackLayers: 3 },
          position: { x: 0, y: 0, z: 500 },
          rotation: { length: 800, width: 800, height: 400 }
        }
      ];

      const cargo = { stackable: true, maxStackLayers: 3 };
      const position = { x: 0, y: 0, z: 900 };
      const rotation = { length: 600, width: 600, height: 300 };

      const result = stackManager.canStack(cargo, position, rotation, placedCargo);
      
      expect(result).toBe(false);
    });

    test('应该要求至少50%的支撑面积', () => {
      const placedCargo = [
        {
          cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 3 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 500, width: 500, height: 500 }
        }
      ];

      const cargo = { stackable: true, maxStackLayers: 3 };
      const position = { x: 0, y: 0, z: 500 };
      const rotation = { length: 1000, width: 1000, height: 400 };

      const result = stackManager.canStack(cargo, position, rotation, placedCargo);
      
      // 支撑面积 = 500*500 = 250,000
      // 货物面积 = 1000*1000 = 1,000,000
      // 支撑率 = 25% < 50%
      expect(result).toBe(false);
    });

    test('应该允许有足够支撑面积的堆叠', () => {
      const placedCargo = [
        {
          cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 3 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 500 }
        }
      ];

      const cargo = { stackable: true, maxStackLayers: 3 };
      const position = { x: 100, y: 100, z: 500 };
      const rotation = { length: 800, width: 800, height: 400 };

      const result = stackManager.canStack(cargo, position, rotation, placedCargo);
      
      // 支撑面积 = 800*800 = 640,000
      // 货物面积 = 800*800 = 640,000
      // 支撑率 = 100% >= 50%
      expect(result).toBe(true);
    });
  });

  describe('countLayers', () => {
    test('应该返回0当没有上方货物时', () => {
      const placed = {
        cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 3 },
        position: { x: 0, y: 0, z: 0 },
        rotation: { length: 1000, width: 1000, height: 500 }
      };
      const placedCargo = [placed];

      const layers = stackManager.countLayers(placed, placedCargo);
      
      expect(layers).toBe(0);
    });

    test('应该计算单层堆叠', () => {
      const placed1 = {
        cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 3 },
        position: { x: 0, y: 0, z: 0 },
        rotation: { length: 1000, width: 1000, height: 500 }
      };
      const placed2 = {
        cargo: { cargoId: 'C2', stackable: true, maxStackLayers: 3 },
        position: { x: 0, y: 0, z: 500 },
        rotation: { length: 800, width: 800, height: 400 }
      };
      const placedCargo = [placed1, placed2];

      const layers = stackManager.countLayers(placed1, placedCargo);
      
      expect(layers).toBe(1);
    });

    test('应该计算多层堆叠', () => {
      const placed1 = {
        cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 4 },
        position: { x: 0, y: 0, z: 0 },
        rotation: { length: 1000, width: 1000, height: 500 }
      };
      const placed2 = {
        cargo: { cargoId: 'C2', stackable: true, maxStackLayers: 4 },
        position: { x: 0, y: 0, z: 500 },
        rotation: { length: 800, width: 800, height: 400 }
      };
      const placed3 = {
        cargo: { cargoId: 'C3', stackable: true, maxStackLayers: 4 },
        position: { x: 0, y: 0, z: 900 },
        rotation: { length: 600, width: 600, height: 300 }
      };
      const placedCargo = [placed1, placed2, placed3];

      const layers = stackManager.countLayers(placed1, placedCargo);
      
      expect(layers).toBe(2);
    });
  });

  describe('findCargoAbove', () => {
    test('应该找到正上方的货物', () => {
      const placed1 = {
        cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 3 },
        position: { x: 0, y: 0, z: 0 },
        rotation: { length: 1000, width: 1000, height: 500 }
      };
      const placed2 = {
        cargo: { cargoId: 'C2', stackable: true, maxStackLayers: 3 },
        position: { x: 0, y: 0, z: 500 },
        rotation: { length: 800, width: 800, height: 400 }
      };
      const placedCargo = [placed1, placed2];

      const above = stackManager.findCargoAbove(placed1, placedCargo);
      
      expect(above).toHaveLength(1);
      expect(above[0].cargo.cargoId).toBe('C2');
    });

    test('不应该找到不接触的货物', () => {
      const placed1 = {
        cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 3 },
        position: { x: 0, y: 0, z: 0 },
        rotation: { length: 1000, width: 1000, height: 500 }
      };
      const placed2 = {
        cargo: { cargoId: 'C2', stackable: true, maxStackLayers: 3 },
        position: { x: 0, y: 0, z: 600 },
        rotation: { length: 800, width: 800, height: 400 }
      };
      const placedCargo = [placed1, placed2];

      const above = stackManager.findCargoAbove(placed1, placedCargo);
      
      expect(above).toHaveLength(0);
    });

    test('不应该返回自己', () => {
      const placed1 = {
        cargo: { cargoId: 'C1', stackable: true, maxStackLayers: 3 },
        position: { x: 0, y: 0, z: 0 },
        rotation: { length: 1000, width: 1000, height: 500 }
      };
      const placedCargo = [placed1];

      const above = stackManager.findCargoAbove(placed1, placedCargo);
      
      expect(above).toHaveLength(0);
    });
  });
});
