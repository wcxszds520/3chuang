/**
 * Task 7: 3D可视化数据生成测试
 * 
 * 测试目标：
 * - 7.1: generateVisualizationData()生成可视化数据
 * - 7.2: _assignCargoColors()为货物分配颜色
 * 
 * 验证需求：6.1, 6.2, 6.3, 6.4, 6.5
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('Task 7: 3D可视化数据生成', () => {
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

  describe('7.2: _assignCargoColors()为货物分配颜色', () => {
    test('空货物列表应返回空映射', () => {
      const colorMap = engine._assignCargoColors([]);
      expect(colorMap).toEqual({});
    });

    test('单个货物类型应分配一个颜色', () => {
      const loadedCargo = [
        {
          cargo: { cargoId: 'cargo1', name: '空气炸锅' },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 300, width: 300, height: 350 }
        }
      ];

      const colorMap = engine._assignCargoColors(loadedCargo);
      
      expect(Object.keys(colorMap)).toHaveLength(1);
      expect(colorMap['cargo1']).toBeDefined();
      expect(colorMap['cargo1']).toMatch(/^#[0-9A-F]{6}$/i); // 验证是十六进制颜色
    });

    test('多个相同货物类型应分配相同颜色', () => {
      const loadedCargo = [
        {
          cargo: { cargoId: 'cargo1', name: '空气炸锅' },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 300, width: 300, height: 350 }
        },
        {
          cargo: { cargoId: 'cargo1', name: '空气炸锅' },
          position: { x: 300, y: 0, z: 0 },
          rotation: { length: 300, width: 300, height: 350 }
        }
      ];

      const colorMap = engine._assignCargoColors(loadedCargo);
      
      expect(Object.keys(colorMap)).toHaveLength(1);
      expect(colorMap['cargo1']).toBeDefined();
    });

    test('不同货物类型应分配不同颜色', () => {
      const loadedCargo = [
        {
          cargo: { cargoId: 'cargo1', name: '空气炸锅' },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 300, width: 300, height: 350 }
        },
        {
          cargo: { cargoId: 'cargo2', name: '取暖器' },
          position: { x: 300, y: 0, z: 0 },
          rotation: { length: 500, width: 400, height: 600 }
        },
        {
          cargo: { cargoId: 'cargo3', name: '电风扇' },
          position: { x: 800, y: 0, z: 0 },
          rotation: { length: 400, width: 400, height: 1200 }
        }
      ];

      const colorMap = engine._assignCargoColors(loadedCargo);
      
      expect(Object.keys(colorMap)).toHaveLength(3);
      expect(colorMap['cargo1']).toBeDefined();
      expect(colorMap['cargo2']).toBeDefined();
      expect(colorMap['cargo3']).toBeDefined();
      
      // 验证颜色不同
      expect(colorMap['cargo1']).not.toBe(colorMap['cargo2']);
      expect(colorMap['cargo2']).not.toBe(colorMap['cargo3']);
      expect(colorMap['cargo1']).not.toBe(colorMap['cargo3']);
    });

    test('超过20种货物类型应循环使用颜色调色板', () => {
      const loadedCargo = [];
      for (let i = 1; i <= 25; i++) {
        loadedCargo.push({
          cargo: { cargoId: `cargo${i}`, name: `货物${i}` },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 100, width: 100, height: 100 }
        });
      }

      const colorMap = engine._assignCargoColors(loadedCargo);
      
      expect(Object.keys(colorMap)).toHaveLength(25);
      // 验证所有颜色都已分配
      for (let i = 1; i <= 25; i++) {
        expect(colorMap[`cargo${i}`]).toBeDefined();
        expect(colorMap[`cargo${i}`]).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });
  });

  describe('7.1: generateVisualizationData()生成可视化数据', () => {
    test('空方案应返回空cargo数组', () => {
      const plan = {
        loadedCargo: [],
        containerType: containerType,
        centerOfGravity: { x: 0, y: 0, z: 0 },
        loadDistribution: {
          front: 0, back: 0, left: 0, right: 0,
          frontPercent: 0, backPercent: 0, leftPercent: 0, rightPercent: 0,
          frontBackImbalance: 0, leftRightImbalance: 0
        }
      };

      const vizData = engine.generateVisualizationData(plan);

      expect(vizData).toHaveProperty('container');
      expect(vizData).toHaveProperty('cargo');
      expect(vizData).toHaveProperty('centerOfGravity');
      expect(vizData).toHaveProperty('loadDistribution');
      
      expect(vizData.container).toEqual({
        length: 12032,
        width: 2352,
        height: 2393
      });
      expect(vizData.cargo).toEqual([]);
    });

    test('单个货物应生成完整的可视化数据', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { 
              cargoId: 'cargo1', 
              name: '空气炸锅',
              weight: 5
            },
            position: { x: 100, y: 200, z: 0 },
            rotation: { 
              length: 300, 
              width: 300, 
              height: 350,
              rotation: { x: 0, y: 0, z: 0 }
            },
            loadingOrder: 1
          }
        ],
        containerType: containerType,
        centerOfGravity: { x: 250, y: 350, z: 175 },
        loadDistribution: {
          front: 0, back: 5, left: 5, right: 0,
          frontPercent: 0, backPercent: 100, leftPercent: 100, rightPercent: 0,
          frontBackImbalance: 100, leftRightImbalance: 100
        }
      };

      const vizData = engine.generateVisualizationData(plan);

      // 验证container
      expect(vizData.container).toEqual({
        length: 12032,
        width: 2352,
        height: 2393
      });

      // 验证cargo数组
      expect(vizData.cargo).toHaveLength(1);
      const cargo = vizData.cargo[0];
      
      expect(cargo).toHaveProperty('id', 'cargo1');
      expect(cargo).toHaveProperty('name', '空气炸锅');
      expect(cargo).toHaveProperty('position');
      expect(cargo.position).toEqual({ x: 100, y: 200, z: 0 });
      expect(cargo).toHaveProperty('dimensions');
      expect(cargo.dimensions).toEqual({ length: 300, width: 300, height: 350 });
      expect(cargo).toHaveProperty('rotation');
      expect(cargo.rotation).toEqual({ x: 0, y: 0, z: 0 });
      expect(cargo).toHaveProperty('color');
      expect(cargo.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(cargo).toHaveProperty('loadingOrder', 1);

      // 验证centerOfGravity
      expect(vizData.centerOfGravity).toEqual({ x: 250, y: 350, z: 175 });

      // 验证loadDistribution
      expect(vizData.loadDistribution).toBeDefined();
    });

    test('多个货物应生成完整的可视化数据数组', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { cargoId: 'cargo1', name: '空气炸锅', weight: 5 },
            position: { x: 0, y: 0, z: 0 },
            rotation: { 
              length: 300, width: 300, height: 350,
              rotation: { x: 0, y: 0, z: 0 }
            },
            loadingOrder: 1
          },
          {
            cargo: { cargoId: 'cargo2', name: '取暖器', weight: 8 },
            position: { x: 300, y: 0, z: 0 },
            rotation: { 
              length: 500, width: 400, height: 600,
              rotation: { x: 0, y: 0, z: 0 }
            },
            loadingOrder: 2
          },
          {
            cargo: { cargoId: 'cargo3', name: '电风扇', weight: 6 },
            position: { x: 800, y: 0, z: 0 },
            rotation: { 
              length: 400, width: 400, height: 1200,
              rotation: { x: 0, y: 0, z: 90 }
            },
            loadingOrder: 3
          }
        ],
        containerType: containerType
      };

      const vizData = engine.generateVisualizationData(plan);

      // 验证cargo数组长度
      expect(vizData.cargo).toHaveLength(3);

      // 验证每个货物都有必需的字段
      vizData.cargo.forEach((cargo, index) => {
        expect(cargo).toHaveProperty('id');
        expect(cargo).toHaveProperty('name');
        expect(cargo).toHaveProperty('position');
        expect(cargo).toHaveProperty('dimensions');
        expect(cargo).toHaveProperty('rotation');
        expect(cargo).toHaveProperty('color');
        expect(cargo).toHaveProperty('loadingOrder', index + 1);
      });

      // 验证不同货物有不同颜色
      expect(vizData.cargo[0].color).not.toBe(vizData.cargo[1].color);
      expect(vizData.cargo[1].color).not.toBe(vizData.cargo[2].color);
      expect(vizData.cargo[0].color).not.toBe(vizData.cargo[2].color);
    });

    test('可视化数据应该可以JSON序列化', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { cargoId: 'cargo1', name: '空气炸锅', weight: 5 },
            position: { x: 0, y: 0, z: 0 },
            rotation: { 
              length: 300, width: 300, height: 350,
              rotation: { x: 0, y: 0, z: 0 }
            },
            loadingOrder: 1
          }
        ],
        containerType: containerType,
        centerOfGravity: { x: 150, y: 150, z: 175 },
        loadDistribution: {
          front: 0, back: 5, left: 5, right: 0,
          frontPercent: 0, backPercent: 100, leftPercent: 100, rightPercent: 0,
          frontBackImbalance: 100, leftRightImbalance: 100
        }
      };

      const vizData = engine.generateVisualizationData(plan);

      // 验证可以序列化和反序列化
      expect(() => {
        const json = JSON.stringify(vizData);
        const parsed = JSON.parse(json);
        expect(parsed).toEqual(vizData);
      }).not.toThrow();
    });

    test('应该使用标准3D坐标系统（X=长度，Y=宽度，Z=高度）', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { cargoId: 'cargo1', name: '测试货物', weight: 10 },
            position: { x: 1000, y: 500, z: 300 },
            rotation: { 
              length: 400, width: 300, height: 200,
              rotation: { x: 0, y: 0, z: 0 }
            },
            loadingOrder: 1
          }
        ],
        containerType: containerType
      };

      const vizData = engine.generateVisualizationData(plan);

      // 验证坐标系统
      const cargo = vizData.cargo[0];
      expect(cargo.position.x).toBe(1000); // X轴 = 长度方向
      expect(cargo.position.y).toBe(500);  // Y轴 = 宽度方向
      expect(cargo.position.z).toBe(300);  // Z轴 = 高度方向
      
      expect(cargo.dimensions.length).toBe(400);  // 长度
      expect(cargo.dimensions.width).toBe(300);   // 宽度
      expect(cargo.dimensions.height).toBe(200);  // 高度
    });

    test('如果plan中没有centerOfGravity，应该自动计算', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { cargoId: 'cargo1', name: '空气炸锅', weight: 5 },
            position: { x: 0, y: 0, z: 0 },
            rotation: { 
              length: 300, width: 300, height: 350,
              rotation: { x: 0, y: 0, z: 0 }
            },
            loadingOrder: 1
          }
        ],
        containerType: containerType
        // 注意：没有centerOfGravity字段
      };

      const vizData = engine.generateVisualizationData(plan);

      // 验证centerOfGravity已被计算
      expect(vizData.centerOfGravity).toBeDefined();
      expect(vizData.centerOfGravity).toHaveProperty('x');
      expect(vizData.centerOfGravity).toHaveProperty('y');
      expect(vizData.centerOfGravity).toHaveProperty('z');
    });

    test('如果plan中没有loadDistribution，应该自动计算', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { cargoId: 'cargo1', name: '空气炸锅', weight: 5 },
            position: { x: 0, y: 0, z: 0 },
            rotation: { 
              length: 300, width: 300, height: 350,
              rotation: { x: 0, y: 0, z: 0 }
            },
            loadingOrder: 1
          }
        ],
        containerType: containerType
        // 注意：没有loadDistribution字段
      };

      const vizData = engine.generateVisualizationData(plan);

      // 验证loadDistribution已被计算
      expect(vizData.loadDistribution).toBeDefined();
      expect(vizData.loadDistribution).toHaveProperty('front');
      expect(vizData.loadDistribution).toHaveProperty('back');
      expect(vizData.loadDistribution).toHaveProperty('left');
      expect(vizData.loadDistribution).toHaveProperty('right');
    });
  });

  describe('集成测试：完整装箱方案的可视化', () => {
    test('慈溪小家电测试用例应生成完整可视化数据', async () => {
      // 定义货物
      const cargoList = [
        {
          cargoId: 'airfryer',
          name: '空气炸锅',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 10, // 减少数量以加快测试
          stackable: true,
          maxStackLayers: 4,
          canInvert: false,
          canLayFlat: false
        },
        {
          cargoId: 'heater',
          name: '取暖器',
          length: 500,
          width: 400,
          height: 600,
          weight: 8,
          quantity: 5,
          stackable: true,
          maxStackLayers: 3,
          canInvert: false,
          canLayFlat: false
        },
        {
          cargoId: 'fan',
          name: '电风扇',
          length: 400,
          width: 400,
          height: 1200,
          weight: 6,
          quantity: 3,
          stackable: false,
          maxStackLayers: 1,
          canInvert: false,
          canLayFlat: false
        }
      ];

      // 生成装箱方案
      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 生成可视化数据
      const vizData = engine.generateVisualizationData(plan);

      // 验证基本结构
      expect(vizData).toHaveProperty('container');
      expect(vizData).toHaveProperty('cargo');
      expect(vizData).toHaveProperty('centerOfGravity');
      expect(vizData).toHaveProperty('loadDistribution');

      // 验证container
      expect(vizData.container.length).toBe(12032);
      expect(vizData.container.width).toBe(2352);
      expect(vizData.container.height).toBe(2393);

      // 验证cargo数组
      expect(vizData.cargo.length).toBeGreaterThan(0);
      expect(vizData.cargo.length).toBe(plan.loadedCargo.length);

      // 验证每个货物的数据完整性
      vizData.cargo.forEach(cargo => {
        expect(cargo).toHaveProperty('id');
        expect(cargo).toHaveProperty('name');
        expect(cargo).toHaveProperty('position');
        expect(cargo).toHaveProperty('dimensions');
        expect(cargo).toHaveProperty('rotation');
        expect(cargo).toHaveProperty('color');
        expect(cargo).toHaveProperty('loadingOrder');
        
        // 验证颜色格式
        expect(cargo.color).toMatch(/^#[0-9A-F]{6}$/i);
      });

      // 验证JSON序列化
      expect(() => JSON.stringify(vizData)).not.toThrow();
    });
  });
});
