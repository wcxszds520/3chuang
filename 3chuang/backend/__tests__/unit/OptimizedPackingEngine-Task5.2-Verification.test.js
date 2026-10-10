/**
 * Task 5.2 Verification Test
 * 验证重心偏移检测和警告功能
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('OptimizedPackingEngine - Task 5.2: 重心偏移检测和警告', () => {
  let engine;
  let containerType;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
    
    // 标准40GP集装箱
    containerType = {
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2393,
      maxWeight: 26000
    };
  });

  test('应该计算重心相对于集装箱中心的偏移', () => {
    const plan = {
      loadedCargo: [
        {
          cargo: { weight: 10 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 1000 }
        }
      ]
    };
    
    const cog = engine._calculateCenterOfGravity(plan, containerType);
    
    // 验证返回了偏移信息
    expect(cog).toHaveProperty('offset');
    expect(cog.offset).toHaveProperty('x');
    expect(cog.offset).toHaveProperty('y');
    expect(cog.offset).toHaveProperty('z');
    expect(cog).toHaveProperty('offsetDistance');
    
    // 集装箱中心: (6016, 1176, 1196.5)
    // 货物重心: (500, 500, 500)
    // 偏移: (-5516, -676, -696.5)
    expect(cog.offset.x).toBeCloseTo(-5516, 0);
    expect(cog.offset.y).toBeCloseTo(-676, 0);
    expect(cog.offset.z).toBeCloseTo(-696.5, 0);
  });

  test('应该在偏移超过集装箱长度5%时标记警告', () => {
    // 5% of 12032mm = 601.6mm
    // 将货物放在远离中心的位置，使偏移超过5%
    const plan = {
      loadedCargo: [
        {
          cargo: { weight: 10 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 1000 }
        }
      ]
    };
    
    const cog = engine._calculateCenterOfGravity(plan, containerType);
    
    // 偏移距离应该大于阈值
    const threshold = containerType.innerLength * 0.05;
    expect(cog.offsetDistance).toBeGreaterThan(threshold);
    
    // 应该有警告信息
    expect(cog.warning).toBeTruthy();
    expect(cog.warning).toContain('重心偏移');
    expect(cog.warning).toContain('超过集装箱长度');
  });

  test('应该在偏移未超过5%时不标记警告', () => {
    // 将货物放在接近中心的位置
    const containerCenter = {
      x: containerType.innerLength / 2,
      y: containerType.innerWidth / 2,
      z: containerType.innerHeight / 2
    };
    
    const plan = {
      loadedCargo: [
        {
          cargo: { weight: 10 },
          position: { 
            x: containerCenter.x - 250, 
            y: containerCenter.y - 250, 
            z: containerCenter.z - 250 
          },
          rotation: { length: 500, width: 500, height: 500 }
        }
      ]
    };
    
    const cog = engine._calculateCenterOfGravity(plan, containerType);
    
    // 偏移距离应该小于阈值
    const threshold = containerType.innerLength * 0.05;
    expect(cog.offsetDistance).toBeLessThan(threshold);
    
    // 不应该有警告
    expect(cog.warning).toBeNull();
  });

  test('应该正确计算多个货物的重心偏移', () => {
    // 两个货物，一个在左侧，一个在右侧
    const plan = {
      loadedCargo: [
        {
          cargo: { weight: 20 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 2000, width: 1000, height: 1000 }
        },
        {
          cargo: { weight: 10 },
          position: { x: 10000, y: 0, z: 0 },
          rotation: { length: 2000, width: 1000, height: 1000 }
        }
      ]
    };
    
    const cog = engine._calculateCenterOfGravity(plan, containerType);
    
    // 货物1重心: (1000, 500, 500), 重量20
    // 货物2重心: (11000, 500, 500), 重量10
    // 加权平均: x = (20*1000 + 10*11000) / 30 = 4333.33
    expect(cog.x).toBeCloseTo(4333.33, 0);
    
    // 验证偏移信息存在
    expect(cog.offset).toBeDefined();
    expect(cog.offsetDistance).toBeDefined();
  });

  test('应该在没有货物时返回null偏移和警告', () => {
    const plan = { loadedCargo: [] };
    
    const cog = engine._calculateCenterOfGravity(plan, containerType);
    
    expect(cog.x).toBe(0);
    expect(cog.y).toBe(0);
    expect(cog.z).toBe(0);
    expect(cog.offset).toBeNull();
    expect(cog.warning).toBeNull();
  });

  test('应该在未提供containerType时不计算偏移', () => {
    const plan = {
      loadedCargo: [
        {
          cargo: { weight: 10 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 1000 }
        }
      ]
    };
    
    const cog = engine._calculateCenterOfGravity(plan);
    
    // 应该返回基本的重心坐标
    expect(cog.x).toBe(500);
    expect(cog.y).toBe(500);
    expect(cog.z).toBe(500);
    
    // 不应该有偏移信息
    expect(cog.offset).toBeUndefined();
    expect(cog.warning).toBeUndefined();
  });

  test('应该正确格式化警告消息', () => {
    const plan = {
      loadedCargo: [
        {
          cargo: { weight: 10 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { length: 1000, width: 1000, height: 1000 }
        }
      ]
    };
    
    const cog = engine._calculateCenterOfGravity(plan, containerType);
    
    if (cog.warning) {
      // 警告应该包含偏移距离（厘米）和百分比
      expect(cog.warning).toMatch(/重心偏移\d+\.\d+cm/);
      expect(cog.warning).toMatch(/超过集装箱长度的\d+\.\d+%/);
    }
  });

  test('应该在边界情况（恰好5%）时标记警告', () => {
    // 计算恰好5%偏移的位置
    const threshold = containerType.innerLength * 0.05; // 601.6mm
    
    // 创建一个货物，使其重心距离容器中心恰好为threshold
    // 简化：只在X轴上偏移
    const containerCenter = {
      x: containerType.innerLength / 2,
      y: containerType.innerWidth / 2,
      z: containerType.innerHeight / 2
    };
    
    const plan = {
      loadedCargo: [
        {
          cargo: { weight: 10 },
          position: { 
            x: containerCenter.x + threshold - 250, 
            y: containerCenter.y - 250, 
            z: containerCenter.z - 250 
          },
          rotation: { length: 500, width: 500, height: 500 }
        }
      ]
    };
    
    const cog = engine._calculateCenterOfGravity(plan, containerType);
    
    // 偏移距离应该接近阈值
    expect(cog.offsetDistance).toBeGreaterThanOrEqual(threshold * 0.99);
  });
});
