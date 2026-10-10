/**
 * 慈溪小家电测试用例 - 90%空间利用率验证
 * 
 * 测试目标：验证OptimizedPackingEngine在慈溪小家电场景下达到90%+空间利用率
 * 
 * 测试场景：
 * - 柜型：40GP（12032×2352×2393mm，26000kg）
 * - 货物1：空气炸锅（300×300×350mm，5kg，200件，可堆叠4层）
 * - 货物2：取暖器（500×400×600mm，8kg，100件，可堆叠3层）
 * - 货物3：电风扇（400×400×1200mm，6kg，80件，不可堆叠）
 * 
 * 验收标准：
 * - 空间利用率 ≥ 90%
 * - 所有堆叠约束得到遵守
 * - 总重量 ≤ 26000kg
 * - 所有合规性校验通过
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('慈溪小家电测试用例 - 90%空间利用率验证', () => {
  let engine;
  let containerType;
  let cargoList;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();

    // 定义40GP柜型
    containerType = {
      typeId: '40GP',
      name: '40英尺标准柜',
      innerLength: 12032,  // mm
      innerWidth: 2352,    // mm
      innerHeight: 2393,   // mm
      maxWeight: 26000     // kg
    };

    // 定义三种货物
    cargoList = [
      // 空气炸锅：300×300×350mm，5kg，200件，可堆叠4层
      {
        cargoId: 'air-fryer-001',
        name: '空气炸锅',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200,
        stackable: true,
        maxStackLayers: 4,
        canInvert: false,
        canLayFlat: false
      },
      // 取暖器：500×400×600mm，8kg，100件，可堆叠3层
      {
        cargoId: 'heater-001',
        name: '取暖器',
        length: 500,
        width: 400,
        height: 600,
        weight: 8,
        quantity: 100,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false
      },
      // 电风扇：400×400×1200mm，6kg，80件，不可堆叠
      {
        cargoId: 'fan-001',
        name: '电风扇',
        length: 400,
        width: 400,
        height: 1200,
        weight: 6,
        quantity: 80,
        stackable: false,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: false
      }
    ];
  });

  // ========== 测试场景1: 验证空间利用率达到90% ==========
  test('应该达到90%以上的空间利用率', async () => {
    const plan = await engine.generatePackingPlan(cargoList, containerType);

    console.log('\n========== 慈溪小家电测试用例结果 ==========');
    console.log(`空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
    console.log(`总重量: ${plan.totalWeight}kg / ${containerType.maxWeight}kg`);
    console.log(`已装载货物: ${plan.totalCargoCount}件`);
    console.log(`计算耗时: ${plan.computationTime.toFixed(2)}秒`);
    
    // 按货物类型统计
    const stats = {};
    plan.loadedCargo.forEach(item => {
      if (!stats[item.cargo.name]) {
        stats[item.cargo.name] = 0;
      }
      stats[item.cargo.name]++;
    });
    
    console.log('\n货物装载统计:');
    Object.entries(stats).forEach(([name, count]) => {
      const total = cargoList.find(c => c.name === name)?.quantity || 0;
      console.log(`  ${name}: ${count}/${total}件 (${(count/total*100).toFixed(1)}%)`);
    });
    
    console.log('\n重心位置:');
    console.log(`  X: ${plan.centerOfGravity.x.toFixed(2)}mm (中心: ${containerType.innerLength/2}mm)`);
    console.log(`  Y: ${plan.centerOfGravity.y.toFixed(2)}mm (中心: ${containerType.innerWidth/2}mm)`);
    console.log(`  Z: ${plan.centerOfGravity.z.toFixed(2)}mm`);
    
    console.log('\n载荷分布:');
    console.log(`  前部: ${plan.loadDistribution.frontPercent.toFixed(1)}%`);
    console.log(`  后部: ${plan.loadDistribution.backPercent.toFixed(1)}%`);
    console.log(`  左侧: ${plan.loadDistribution.leftPercent.toFixed(1)}%`);
    console.log(`  右侧: ${plan.loadDistribution.rightPercent.toFixed(1)}%`);
    console.log(`  前后不平衡度: ${plan.loadDistribution.frontBackImbalance.toFixed(1)}%`);
    console.log(`  左右不平衡度: ${plan.loadDistribution.leftRightImbalance.toFixed(1)}%`);
    
    console.log('\n合规性校验:');
    console.log(`  状态: ${plan.compliance.valid ? '✓ 通过' : '✗ 失败'}`);
    if (plan.compliance.violations.length > 0) {
      console.log('  违规项:');
      plan.compliance.violations.forEach(v => console.log(`    - ${v}`));
    }
    console.log('==========================================\n');

    // 验证空间利用率 ≥ 90%
    expect(plan.spaceUtilization).toBeGreaterThanOrEqual(90);
  }, 30000);

  // ========== 测试场景2: 验证堆叠约束遵守 ==========
  test('应该遵守所有货物的堆叠约束', async () => {
    const plan = await engine.generatePackingPlan(cargoList, containerType);

    // 验证每个货物的堆叠层数
    plan.loadedCargo.forEach(item => {
      const cargo = item.cargo;
      const stackLevel = item.stackLevel;

      // 验证堆叠层级信息存在
      expect(stackLevel).toBeDefined();
      expect(typeof stackLevel).toBe('number');
      expect(stackLevel).toBeGreaterThanOrEqual(0);

      // 验证不可堆叠货物
      if (!cargo.stackable) {
        // 不可堆叠货物应该在底层（stackLevel = 0）
        expect(stackLevel).toBe(0);
        
        // 验证其上方没有其他货物
        const hasCargoAbove = plan.loadedCargo.some(other => {
          if (other === item) return false;
          
          const tolerance = 1;
          const zDiff = Math.abs(other.position.z - (item.position.z + item.rotation.height));
          if (zDiff > tolerance) return false;
          
          // 检查XY平面重叠
          const overlapX = !(other.position.x + other.rotation.length <= item.position.x || 
                            item.position.x + item.rotation.length <= other.position.x);
          const overlapY = !(other.position.y + other.rotation.width <= item.position.y || 
                            item.position.y + item.rotation.width <= other.position.y);
          
          return overlapX && overlapY;
        });
        
        expect(hasCargoAbove).toBe(false);
      }
    });

    // 验证可堆叠货物的层数限制
    const stackGroups = new Map();
    
    plan.loadedCargo.forEach(item => {
      if (!item.cargo.stackable) return;
      
      // 查找下方货物
      const below = plan.loadedCargo.filter(other => {
        if (other === item) return false;
        
        const tolerance = 1;
        const zDiff = Math.abs(item.position.z - (other.position.z + other.rotation.height));
        if (zDiff > tolerance) return false;
        
        const overlapX = !(item.position.x + item.rotation.length <= other.position.x || 
                          other.position.x + other.rotation.length <= item.position.x);
        const overlapY = !(item.position.y + item.rotation.width <= other.position.y || 
                          other.position.y + other.rotation.width <= item.position.y);
        
        return overlapX && overlapY;
      });
      
      // 计算堆叠层数
      if (below.length > 0) {
        below.forEach(b => {
          const key = `${b.position.x},${b.position.y},${b.position.z}`;
          if (!stackGroups.has(key)) {
            stackGroups.set(key, []);
          }
          stackGroups.get(key).push(item);
        });
      }
    });
    
    // 验证每个堆叠组的层数
    stackGroups.forEach((items, key) => {
      items.forEach(item => {
        const maxLayers = item.cargo.maxStackLayers;
        const actualLayers = item.stackLevel + 1;
        expect(actualLayers).toBeLessThanOrEqual(maxLayers);
      });
    });

    expect(plan.compliance.valid).toBe(true);
  }, 30000);

  // ========== 测试场景3: 验证总重量限制 ==========
  test('应该遵守26000kg的载重限制', async () => {
    const plan = await engine.generatePackingPlan(cargoList, containerType);

    // 验证总重量不超过限制
    expect(plan.totalWeight).toBeLessThanOrEqual(containerType.maxWeight);

    // 手动计算总重量验证
    const calculatedWeight = plan.loadedCargo.reduce((sum, item) => {
      return sum + item.cargo.weight;
    }, 0);

    expect(Math.abs(plan.totalWeight - calculatedWeight)).toBeLessThan(0.01);
  }, 30000);

  // ========== 测试场景4: 验证边界约束 ==========
  test('应该确保所有货物在集装箱边界内', async () => {
    const plan = await engine.generatePackingPlan(cargoList, containerType);

    plan.loadedCargo.forEach(item => {
      const pos = item.position;
      const rot = item.rotation;

      // 验证X方向边界
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.x + rot.length).toBeLessThanOrEqual(containerType.innerLength);

      // 验证Y方向边界
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.y + rot.width).toBeLessThanOrEqual(containerType.innerWidth);

      // 验证Z方向边界
      expect(pos.z).toBeGreaterThanOrEqual(0);
      expect(pos.z + rot.height).toBeLessThanOrEqual(containerType.innerHeight);
    });

    expect(plan.compliance.valid).toBe(true);
  }, 30000);

  // ========== 测试场景5: 验证货物无重叠 ==========
  test('应该确保所有货物之间无重叠', async () => {
    const plan = await engine.generatePackingPlan(cargoList, containerType);

    // 检查每对货物是否重叠
    for (let i = 0; i < plan.loadedCargo.length; i++) {
      for (let j = i + 1; j < plan.loadedCargo.length; j++) {
        const item1 = plan.loadedCargo[i];
        const item2 = plan.loadedCargo[j];

        const pos1 = item1.position;
        const rot1 = item1.rotation;
        const pos2 = item2.position;
        const rot2 = item2.rotation;

        // 检查X方向重叠
        const overlapX = !(pos1.x + rot1.length <= pos2.x || pos2.x + rot2.length <= pos1.x);
        // 检查Y方向重叠
        const overlapY = !(pos1.y + rot1.width <= pos2.y || pos2.y + rot2.width <= pos1.y);
        // 检查Z方向重叠
        const overlapZ = !(pos1.z + rot1.height <= pos2.z || pos2.z + rot2.height <= pos1.z);

        // 三个方向都重叠才算真正重叠
        const isOverlapping = overlapX && overlapY && overlapZ;

        expect(isOverlapping).toBe(false);
      }
    }

    expect(plan.compliance.valid).toBe(true);
  }, 30000);

  // ========== 测试场景6: 验证合规性校验通过 ==========
  test('应该通过所有合规性校验', async () => {
    const plan = await engine.generatePackingPlan(cargoList, containerType);

    // 验证合规性状态
    expect(plan.compliance).toBeDefined();
    expect(plan.compliance.valid).toBe(true);
    expect(Array.isArray(plan.compliance.violations)).toBe(true);
    expect(plan.compliance.violations.length).toBe(0);

    // 验证关键指标
    expect(plan.spaceUtilization).toBeGreaterThanOrEqual(90);
    expect(plan.totalWeight).toBeLessThanOrEqual(containerType.maxWeight);
    expect(plan.totalCargoCount).toBeGreaterThan(0);
  }, 30000);

  // ========== 测试场景7: 验证3D可视化数据生成 ==========
  test('应该生成完整的3D可视化数据', async () => {
    const plan = await engine.generatePackingPlan(cargoList, containerType);

    // 验证可视化数据存在
    expect(plan.visualizationData).toBeDefined();

    const vizData = plan.visualizationData;

    // 验证容器信息
    expect(vizData.container).toBeDefined();
    expect(vizData.container.length).toBe(containerType.innerLength);
    expect(vizData.container.width).toBe(containerType.innerWidth);
    expect(vizData.container.height).toBe(containerType.innerHeight);

    // 验证货物数据
    expect(Array.isArray(vizData.cargo)).toBe(true);
    expect(vizData.cargo.length).toBe(plan.loadedCargo.length);

    // 验证每个货物的可视化数据
    vizData.cargo.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('position');
      expect(item).toHaveProperty('dimensions');
      expect(item).toHaveProperty('rotation');
      expect(item).toHaveProperty('color');
      expect(item).toHaveProperty('loadingOrder');

      // 验证位置坐标
      expect(item.position).toHaveProperty('x');
      expect(item.position).toHaveProperty('y');
      expect(item.position).toHaveProperty('z');

      // 验证尺寸
      expect(item.dimensions).toHaveProperty('length');
      expect(item.dimensions).toHaveProperty('width');
      expect(item.dimensions).toHaveProperty('height');

      // 验证旋转角度
      expect(item.rotation).toHaveProperty('x');
      expect(item.rotation).toHaveProperty('y');
      expect(item.rotation).toHaveProperty('z');

      // 验证颜色格式
      expect(typeof item.color).toBe('string');
      expect(item.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    // 验证重心数据
    expect(vizData.centerOfGravity).toBeDefined();
    expect(vizData.centerOfGravity).toHaveProperty('x');
    expect(vizData.centerOfGravity).toHaveProperty('y');
    expect(vizData.centerOfGravity).toHaveProperty('z');

    // 验证载荷分布数据
    expect(vizData.loadDistribution).toBeDefined();
    expect(vizData.loadDistribution).toHaveProperty('front');
    expect(vizData.loadDistribution).toHaveProperty('back');
    expect(vizData.loadDistribution).toHaveProperty('left');
    expect(vizData.loadDistribution).toHaveProperty('right');
  }, 30000);

  // ========== 测试场景8: 验证不同货物类型的颜色区分 ==========
  test('应该为不同类型的货物分配不同颜色', async () => {
    const plan = await engine.generatePackingPlan(cargoList, containerType);

    const vizData = plan.visualizationData;
    const colorsByType = new Map();

    // 收集每种货物类型的颜色
    vizData.cargo.forEach(item => {
      if (!colorsByType.has(item.name)) {
        colorsByType.set(item.name, new Set());
      }
      colorsByType.get(item.name).add(item.color);
    });

    // 验证有多种货物类型
    expect(colorsByType.size).toBeGreaterThan(1);

    // 验证不同类型使用不同颜色
    const allColors = Array.from(colorsByType.values()).map(set => Array.from(set)[0]);
    const uniqueColors = new Set(allColors);
    expect(uniqueColors.size).toBe(colorsByType.size);
  }, 30000);

  // ========== 测试场景9: 验证计算性能 ==========
  test('应该在10秒内完成计算', async () => {
    const startTime = Date.now();
    const plan = await engine.generatePackingPlan(cargoList, containerType);
    const endTime = Date.now();

    const actualTime = (endTime - startTime) / 1000;

    console.log(`实际计算耗时: ${actualTime.toFixed(2)}秒`);
    console.log(`方案报告耗时: ${plan.computationTime.toFixed(2)}秒`);

    // 验证计算时间
    expect(plan.computationTime).toBeLessThanOrEqual(10);
    expect(actualTime).toBeLessThanOrEqual(11); // 允许1秒误差
  }, 30000);
});
