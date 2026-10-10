/**
 * Task 5.1 Verification Test
 * 验证_calculateCenterOfGravity()方法的正确性
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('OptimizedPackingEngine - Task 5.1: _calculateCenterOfGravity()', () => {
  let engine;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
  });

  test('应该返回{x:0, y:0, z:0}当没有货物时', () => {
    const plan = { loadedCargo: [] };
    const cog = engine._calculateCenterOfGravity(plan);
    
    expect(cog.x).toBe(0);
    expect(cog.y).toBe(0);
    expect(cog.z).toBe(0);
    expect(cog.offset).toBeNull();
    expect(cog.warning).toBeNull();
  });

  test('应该正确计算单个货物的重心（位于货物中心）', () => {
    const plan = {
      loadedCargo: [{
        cargo: { weight: 10 },
        position: { x: 0, y: 0, z: 0 },
        rotation: { length: 100, width: 100, height: 100 }
      }]
    };
    
    const cog = engine._calculateCenterOfGravity(plan);
    
    // 重心应该在货物中心：(0+100/2, 0+100/2, 0+100/2) = (50, 50, 50)
    expect(cog.x).toBe(50);
    expect(cog.y).toBe(50);
    expect(cog.z).toBe(50);
  });

  test('应该使用加权平均公式计算多个货物的重心', () => {
    const plan = {
      loadedCargo: [
        {
          cargo: { weight: 10 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 100, width: 100, height: 100 }
        },
        {
          cargo: { weight: 20 },
          position: { x: 200, y: 0, z: 0 },
          rotation: { length: 100, width: 100, height: 100 }
        }
      ]
    };
    
    const cog = engine._calculateCenterOfGravity(plan);
    
    // 货物1中心: (50, 50, 50), 重量10
    // 货物2中心: (250, 50, 50), 重量20
    // 加权平均X: (10*50 + 20*250) / (10+20) = (500 + 5000) / 30 = 5500/30 = 183.33...
    expect(cog.x).toBeCloseTo(183.33, 2);
    expect(cog.y).toBe(50);
    expect(cog.z).toBe(50);
  });

  test('应该正确处理不同尺寸和位置的货物', () => {
    const plan = {
      loadedCargo: [
        {
          cargo: { weight: 5 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 300, width: 300, height: 350 }
        },
        {
          cargo: { weight: 8 },
          position: { x: 300, y: 0, z: 0 },
          rotation: { length: 500, width: 400, height: 600 }
        },
        {
          cargo: { weight: 6 },
          position: { x: 0, y: 300, z: 0 },
          rotation: { length: 400, width: 400, height: 1200 }
        }
      ]
    };
    
    const cog = engine._calculateCenterOfGravity(plan);
    
    // 货物1中心: (150, 150, 175), 重量5
    // 货物2中心: (550, 200, 300), 重量8
    // 货物3中心: (200, 500, 600), 重量6
    // 总重量: 19
    
    const expectedX = (5*150 + 8*550 + 6*200) / 19;
    const expectedY = (5*150 + 8*200 + 6*500) / 19;
    const expectedZ = (5*175 + 8*300 + 6*600) / 19;
    
    expect(cog.x).toBeCloseTo(expectedX, 2);
    expect(cog.y).toBeCloseTo(expectedY, 2);
    expect(cog.z).toBeCloseTo(expectedZ, 2);
  });

  test('应该返回包含x、y、z三个坐标分量的对象', () => {
    const plan = {
      loadedCargo: [{
        cargo: { weight: 10 },
        position: { x: 100, y: 200, z: 300 },
        rotation: { length: 50, width: 60, height: 70 }
      }]
    };
    
    const cog = engine._calculateCenterOfGravity(plan);
    
    expect(cog).toHaveProperty('x');
    expect(cog).toHaveProperty('y');
    expect(cog).toHaveProperty('z');
    expect(typeof cog.x).toBe('number');
    expect(typeof cog.y).toBe('number');
    expect(typeof cog.z).toBe('number');
  });
});
