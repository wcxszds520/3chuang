/**
 * Task 8.1: 合规性校验模块测试
 * 
 * 测试OptimizedPackingEngine的_validateCompliance()及其辅助方法
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('OptimizedPackingEngine - Task 8: 合规性校验模块', () => {
  let engine;
  let containerType;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
    
    // 标准40GP集装箱
    containerType = {
      typeId: '40GP',
      name: '40GP集装箱',
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2393,
      maxWeight: 26000
    };
  });

  describe('_checkTotalWeight() - 总重量校验', () => {
    test('应该通过总重量校验（未超载）', () => {
      const plan = {
        loadedCargo: [
          { cargo: { weight: 5000 } },
          { cargo: { weight: 8000 } },
          { cargo: { weight: 10000 } }
        ]
      };

      const violations = engine._checkTotalWeight(plan, containerType);
      expect(violations).toHaveLength(0);
    });

    test('应该检测到总重量超载', () => {
      const plan = {
        loadedCargo: [
          { cargo: { weight: 15000 } },
          { cargo: { weight: 12000 } }
        ]
      };

      const violations = engine._checkTotalWeight(plan, containerType);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('总重量超过集装箱最大载重');
      expect(violations[0]).toContain('27000.00kg');
      expect(violations[0]).toContain('26000kg');
    });

    test('应该处理边界情况（恰好等于最大载重）', () => {
      const plan = {
        loadedCargo: [
          { cargo: { weight: 26000 } }
        ]
      };

      const violations = engine._checkTotalWeight(plan, containerType);
      expect(violations).toHaveLength(0);
    });
  });

  describe('_checkBoundaries() - 边界约束校验', () => {
    test('应该通过边界校验（所有货物在边界内）', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { name: '货物A' },
            position: { x: 0, y: 0, z: 0 },
            loadingOrder: 1
          },
          {
            cargo: { name: '货物B' },
            position: { x: 1000, y: 1000, z: 1000 },
            loadingOrder: 2
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkBoundaries(plan, containerType);
      expect(violations).toHaveLength(0);
    });

    test('应该检测到X方向超出边界', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { name: '货物A' },
            position: { x: 12000, y: 0, z: 0 },
            loadingOrder: 1
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkBoundaries(plan, containerType);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain('X方向超出边界');
      expect(violations[0]).toContain('货物A');
    });

    test('应该检测到Y方向超出边界', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { name: '货物B' },
            position: { x: 0, y: 2300, z: 0 },
            loadingOrder: 1
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkBoundaries(plan, containerType);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain('Y方向超出边界');
    });

    test('应该检测到Z方向超出边界', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { name: '货物C' },
            position: { x: 0, y: 0, z: 2300 },
            loadingOrder: 1
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkBoundaries(plan, containerType);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain('Z方向超出边界');
    });

    test('应该检测到负坐标位置', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { name: '货物D' },
            position: { x: -10, y: 0, z: 0 },
            loadingOrder: 1
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkBoundaries(plan, containerType);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain('X方向超出边界');
    });
  });

  describe('_checkOverlaps() - 货物重叠校验', () => {
    test('应该通过重叠校验（无重叠）', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { name: '货物A' },
            position: { x: 0, y: 0, z: 0 },
            loadingOrder: 1
          },
          {
            cargo: { name: '货物B' },
            position: { x: 1000, y: 0, z: 0 },
            loadingOrder: 2
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkOverlaps(plan);
      expect(violations).toHaveLength(0);
    });

    test('应该检测到货物重叠', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { name: '货物A' },
            position: { x: 0, y: 0, z: 0 },
            loadingOrder: 1
          },
          {
            cargo: { name: '货物B' },
            position: { x: 100, y: 100, z: 100 },
            loadingOrder: 2
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkOverlaps(plan);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain('货物重叠');
      expect(violations[0]).toContain('货物A');
      expect(violations[0]).toContain('货物B');
    });

    test('应该通过边缘接触检测（不算重叠）', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { name: '货物A' },
            position: { x: 0, y: 0, z: 0 },
            loadingOrder: 1
          },
          {
            cargo: { name: '货物B' },
            position: { x: 500, y: 0, z: 0 },
            loadingOrder: 2
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkOverlaps(plan);
      expect(violations).toHaveLength(0);
    });
  });

  describe('_checkStackingConstraints() - 堆叠约束校验', () => {
    test('应该通过堆叠约束校验（合法堆叠）', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { 
              name: '货物A', 
              stackable: true, 
              maxStackLayers: 3,
              weight: 100
            },
            position: { x: 0, y: 0, z: 0 },
            loadingOrder: 1
          },
          {
            cargo: { 
              name: '货物B', 
              stackable: true, 
              maxStackLayers: 2,
              weight: 50
            },
            position: { x: 0, y: 0, z: 500 },
            loadingOrder: 2
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkStackingConstraints(plan);
      expect(violations).toHaveLength(0);
    });

    test('应该检测到不可堆叠货物上方有货物', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { 
              name: '货物A', 
              stackable: false,
              weight: 100
            },
            position: { x: 0, y: 0, z: 0 },
            loadingOrder: 1
          },
          {
            cargo: { 
              name: '货物B', 
              stackable: true, 
              maxStackLayers: 2,
              weight: 50
            },
            position: { x: 0, y: 0, z: 500 },
            loadingOrder: 2
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkStackingConstraints(plan);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain('不可堆叠');
      expect(violations[0]).toContain('货物A');
    });

    test('应该检测到堆叠层数超限', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { 
              name: '货物A', 
              stackable: true, 
              maxStackLayers: 1,
              weight: 100
            },
            position: { x: 0, y: 0, z: 0 },
            loadingOrder: 1
          },
          {
            cargo: { 
              name: '货物B', 
              stackable: true, 
              maxStackLayers: 2,
              weight: 50
            },
            position: { x: 0, y: 0, z: 500 },
            loadingOrder: 2
          },
          {
            cargo: { 
              name: '货物C', 
              stackable: true, 
              maxStackLayers: 2,
              weight: 50
            },
            position: { x: 0, y: 0, z: 1000 },
            loadingOrder: 3
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkStackingConstraints(plan);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.includes('堆叠层数超限'))).toBe(true);
    });

    test('应该检测到支撑面积不足', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { 
              name: '货物A', 
              stackable: true, 
              maxStackLayers: 3,
              weight: 100
            },
            position: { x: 0, y: 0, z: 0 },
            loadingOrder: 1
          },
          {
            cargo: { 
              name: '货物B', 
              stackable: true, 
              maxStackLayers: 2,
              weight: 50
            },
            position: { x: 400, y: 400, z: 500 },
            loadingOrder: 2
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkStackingConstraints(plan);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.includes('支撑面积不足'))).toBe(true);
    });

    test('应该检测到货物悬空', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { 
              name: '货物A', 
              stackable: true, 
              maxStackLayers: 3,
              weight: 100
            },
            position: { x: 0, y: 0, z: 1000 },
            loadingOrder: 1
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const violations = engine._checkStackingConstraints(plan);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain('悬空');
    });
  });

  describe('_validateCompliance() - 综合合规性校验', () => {
    test('应该通过所有合规性校验', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { 
              name: '货物A', 
              stackable: true, 
              maxStackLayers: 3,
              weight: 5000
            },
            position: { x: 0, y: 0, z: 0 },
            loadingOrder: 1
          },
          {
            cargo: { 
              name: '货物B', 
              stackable: true, 
              maxStackLayers: 2,
              weight: 3000
            },
            position: { x: 1000, y: 0, z: 0 },
            loadingOrder: 2
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const result = engine._validateCompliance(plan, containerType);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('应该检测到多个违规项', () => {
      const plan = {
        loadedCargo: [
          {
            cargo: { 
              name: '货物A', 
              stackable: false,
              weight: 15000
            },
            position: { x: 0, y: 0, z: 0 },
            loadingOrder: 1
          },
          {
            cargo: { 
              name: '货物B', 
              stackable: true, 
              maxStackLayers: 2,
              weight: 12000
            },
            position: { x: 0, y: 0, z: 500 },
            loadingOrder: 2
          },
          {
            cargo: { 
              name: '货物C', 
              stackable: true, 
              maxStackLayers: 2,
              weight: 5000
            },
            position: { x: 15000, y: 0, z: 0 },
            loadingOrder: 3
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } },
          { rotation: { length: 500, width: 500, height: 500 } }
        ]
      };

      const result = engine._validateCompliance(plan, containerType);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      
      // 应该检测到总重量超载
      expect(result.violations.some(v => v.includes('总重量超过'))).toBe(true);
      
      // 应该检测到边界超出
      expect(result.violations.some(v => v.includes('超出边界'))).toBe(true);
      
      // 应该检测到不可堆叠违规
      expect(result.violations.some(v => v.includes('不可堆叠'))).toBe(true);
    });

    test('应该返回正确的合规性对象结构', () => {
      const plan = {
        loadedCargo: [],
        occupiedSpaces: []
      };

      const result = engine._validateCompliance(plan, containerType);
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('violations');
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.violations)).toBe(true);
    });
  });

  describe('集成测试 - 真实场景', () => {
    test('慈溪小家电场景 - 合规装箱方案', () => {
      const plan = {
        loadedCargo: [
          // 空气炸锅 - 底层
          {
            cargo: { 
              name: '空气炸锅', 
              stackable: true, 
              maxStackLayers: 4,
              weight: 5
            },
            position: { x: 0, y: 0, z: 0 },
            loadingOrder: 1
          },
          // 空气炸锅 - 第二层
          {
            cargo: { 
              name: '空气炸锅', 
              stackable: true, 
              maxStackLayers: 4,
              weight: 5
            },
            position: { x: 0, y: 0, z: 350 },
            loadingOrder: 2
          },
          // 取暖器 - 底层
          {
            cargo: { 
              name: '取暖器', 
              stackable: true, 
              maxStackLayers: 3,
              weight: 8
            },
            position: { x: 1000, y: 0, z: 0 },
            loadingOrder: 3
          },
          // 电风扇 - 底层（不可堆叠）
          {
            cargo: { 
              name: '电风扇', 
              stackable: false,
              weight: 6
            },
            position: { x: 2000, y: 0, z: 0 },
            loadingOrder: 4
          }
        ],
        occupiedSpaces: [
          { rotation: { length: 300, width: 300, height: 350 } },
          { rotation: { length: 300, width: 300, height: 350 } },
          { rotation: { length: 500, width: 400, height: 600 } },
          { rotation: { length: 400, width: 400, height: 1200 } }
        ]
      };

      const result = engine._validateCompliance(plan, containerType);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});
