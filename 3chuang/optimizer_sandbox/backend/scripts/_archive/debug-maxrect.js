/**
 * 调试 Maximal Rectangles 算法
 * 使用简单案例来定位问题
 */

const MaximalRectanglesEngine = require('../services/MaximalRectanglesEngine');
const Cargo = require('../models/Cargo');
const ContainerType = require('../models/ContainerType');

async function debugMaxRectangles() {
  console.log('=== 调试 Maximal Rectangles 算法 ===\n');
  
  // 简单案例：只有一种货物，可以堆叠3层
  const cargoList = [
    new Cargo({
      cargoId: 'cargo_001',
      name: '测试货物',
      length: 1000,
      width: 1000,
      height: 1000,
      weight: 10,
      quantity: 10,
      stackable: true,
      maxStackLayers: 3,
      canInvert: false,
      canLayFlat: false
    })
  ];
  
  // 小集装箱
  const containerType = new ContainerType({
    typeId: 'TEST',
    name: '测试柜',
    innerLength: 3000,
    innerWidth: 3000,
    innerHeight: 3000,
    maxWeight: 10000,
    description: '测试集装箱'
  });
  
  console.log('📦 集装箱: 3000×3000×3000mm');
  console.log('📋 货物: 1000×1000×1000mm, 10件, 可堆叠3层\n');
  console.log('预期结果: 应该能装载9件（3×3×1的底层 + 堆叠2层 = 9件）\n');
  
  const engine = new MaximalRectanglesEngine();
  const plan = await engine.generatePackingPlan(cargoList, containerType, { debug: true });
  
  console.log('\n=== 结果 ===');
  console.log(`已装载: ${plan.loadedCargo.length}件`);
  console.log(`未装载: ${plan.unloadedCargo.length}件`);
  console.log(`空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
  
  // 显示每件货物的位置和堆叠层数
  console.log('\n=== 装载详情 ===');
  plan.loadedCargo.forEach((loaded, index) => {
    const pos = loaded.position;
    const rot = loaded.rotation;
    console.log(`${index + 1}. 位置: (${pos.x}, ${pos.y}, ${pos.z}), 尺寸: ${rot.length}×${rot.width}×${rot.height}, 堆叠层: ${loaded.stackLevel}`);
  });
  
  if (plan.unloadedCargo.length > 0) {
    console.log('\n=== 未装载原因 ===');
    const reasonCount = {};
    plan.unloadedCargo.forEach(unloaded => {
      const reason = unloaded.reason || '未知';
      reasonCount[reason] = (reasonCount[reason] || 0) + 1;
    });
    Object.entries(reasonCount).forEach(([reason, count]) => {
      console.log(`${reason}: ${count}件`);
    });
  }
}

debugMaxRectangles()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('调试失败:', error);
    process.exit(1);
  });
