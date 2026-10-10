/**
 * 诊断空间利用率低的原因
 * 分析装箱算法的瓶颈
 */

const Cargo = require('../models/Cargo');
const ContainerType = require('../models/ContainerType');
const OptimizedPackingEngine = require('../services/OptimizedPackingEngine');

// 测试用例：慈溪小家电（你当前使用的货物）
const testCargo = [
  {
    name: '空气炸锅',
    length: 300,
    width: 300,
    height: 350,
    weight: 5,
    quantity: 2000,
    stackable: true,
    maxStackLayers: 4,
    canInvert: false,
    canLayFlat: false
  },
  {
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
  {
    name: '电风扇',
    length: 400,
    width: 400,
    height: 1200,
    weight: 6,
    quantity: 80,
    stackable: false,
    maxStackLayers: 1,
    canInvert: false,
    canLayFlat: true
  }
];

// 20GP柜型
const container20GP = {
  typeId: '20GP',
  name: '20英尺标准柜',
  innerLength: 5898,
  innerWidth: 2352,
  innerHeight: 2393,
  maxWeight: 28000
};

async function diagnose() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   诊断空间利用率低的原因              ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  // 转换货物数据
  const cargoList = testCargo.map(data => new Cargo({
    cargoId: `cargo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: data.name,
    length: data.length,
    width: data.width,
    height: data.height,
    weight: data.weight,
    quantity: data.quantity,
    stackable: Boolean(data.stackable),
    maxStackLayers: data.maxStackLayers || 3,
    canInvert: Boolean(data.canInvert),
    canLayFlat: Boolean(data.canLayFlat)
  }));
  
  const containerTypeObj = new ContainerType(container20GP);
  
  // 分析1: 货物和柜型基本信息
  console.log('【分析1】货物和柜型基本信息\n');
  
  const totalCargoVolume = cargoList.reduce((sum, cargo) => {
    return sum + (cargo.length * cargo.width * cargo.height * cargo.quantity);
  }, 0);
  
  const containerVolume = containerTypeObj.getVolume();
  
  console.log('柜型信息:');
  console.log(`  - 名称: ${containerTypeObj.name}`);
  console.log(`  - 尺寸: ${containerTypeObj.innerLength} x ${containerTypeObj.innerWidth} x ${containerTypeObj.innerHeight} mm`);
  console.log(`  - 容积: ${(containerVolume / 1000000000).toFixed(2)} 立方米`);
  console.log(`  - 最大载重: ${containerTypeObj.maxWeight} kg\n`);
  
  console.log('货物信息:');
  let totalWeight = 0;
  cargoList.forEach(cargo => {
    const volume = cargo.length * cargo.width * cargo.height;
    const totalVol = volume * cargo.quantity;
    totalWeight += cargo.weight * cargo.quantity;
    console.log(`  - ${cargo.name}:`);
    console.log(`    尺寸: ${cargo.length}x${cargo.width}x${cargo.height} mm`);
    console.log(`    单件体积: ${(volume / 1000000).toFixed(2)} L`);
    console.log(`    数量: ${cargo.quantity}件`);
    console.log(`    总体积: ${(totalVol / 1000000000).toFixed(2)} 立方米`);
    console.log(`    可堆叠: ${cargo.stackable ? '是' : '否'} (最大${cargo.maxStackLayers}层)`);
    console.log(`    可倒置: ${cargo.canInvert ? '是' : '否'}`);
    console.log(`    可平放: ${cargo.canLayFlat ? '是' : '否'}\n`);
  });
  
  console.log(`总货物体积: ${(totalCargoVolume / 1000000000).toFixed(2)} 立方米`);
  console.log(`总货物重量: ${totalWeight} kg`);
  console.log(`理论最大利用率: ${((totalCargoVolume / containerVolume) * 100).toFixed(2)}%`);
  console.log(`（注意：实际利用率会因为形状不规则、堆叠限制等因素降低）\n`);
  
  // 分析2: 运行装箱算法
  console.log('【分析2】运行装箱算法\n');
  
  const engine = new OptimizedPackingEngine();
  const startTime = Date.now();
  const result = await engine.generatePackingPlan(cargoList, containerTypeObj);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  const loadedVolume = result.loadedCargo.reduce((sum, loaded) => {
    const c = loaded.cargo;
    return sum + (c.length * c.width * c.height);
  }, 0);
  
  const actualUtilization = (loadedVolume / containerVolume * 100).toFixed(2);
  
  console.log(`装箱结果:`);
  console.log(`  - 已装载: ${result.loadedCargo.length}件`);
  console.log(`  - 未装载: ${result.unloadedCargo.length}件`);
  console.log(`  - 空间利用率: ${actualUtilization}%`);
  console.log(`  - 计算耗时: ${elapsed}秒\n`);
  
  // 分析3: 未装载货物分析
  console.log('【分析3】未装载货物分析\n');
  
  const unloadedByType = {};
  result.unloadedCargo.forEach(cargo => {
    if (!unloadedByType[cargo.name]) {
      unloadedByType[cargo.name] = 0;
    }
    unloadedByType[cargo.name]++;
  });
  
  console.log('未装载货物统计:');
  Object.entries(unloadedByType).forEach(([name, count]) => {
    const original = testCargo.find(c => c.name === name);
    const percentage = ((count / original.quantity) * 100).toFixed(1);
    console.log(`  - ${name}: ${count}/${original.quantity}件 (${percentage}%未装载)`);
  });
  console.log('');
  
  // 分析4: 装载货物分析
  console.log('【分析4】装载货物分析\n');
  
  const loadedByType = {};
  result.loadedCargo.forEach(loaded => {
    const name = loaded.cargo.name;
    if (!loadedByType[name]) {
      loadedByType[name] = 0;
    }
    loadedByType[name]++;
  });
  
  console.log('已装载货物统计:');
  Object.entries(loadedByType).forEach(([name, count]) => {
    const original = testCargo.find(c => c.name === name);
    const percentage = ((count / original.quantity) * 100).toFixed(1);
    console.log(`  - ${name}: ${count}/${original.quantity}件 (${percentage}%已装载)`);
  });
  console.log('');
  
  // 分析5: 空间浪费分析
  console.log('【分析5】空间浪费分析\n');
  
  const wastedVolume = containerVolume - loadedVolume;
  const wastedPercentage = (wastedVolume / containerVolume * 100).toFixed(2);
  
  console.log(`浪费空间: ${(wastedVolume / 1000000000).toFixed(2)} 立方米 (${wastedPercentage}%)`);
  console.log(`已使用空间: ${(loadedVolume / 1000000000).toFixed(2)} 立方米 (${actualUtilization}%)\n`);
  
  // 分析6: 可能的问题
  console.log('【分析6】可能的问题和原因\n');
  
  const problems = [];
  
  // 问题1: 货物总体积远大于柜型容积
  if (totalCargoVolume > containerVolume * 2) {
    problems.push({
      type: '货物总量过大',
      description: `货物总体积(${(totalCargoVolume / 1000000000).toFixed(2)}m³)是柜型容积(${(containerVolume / 1000000000).toFixed(2)}m³)的${(totalCargoVolume / containerVolume).toFixed(1)}倍`,
      impact: '即使完美装箱也无法装下所有货物',
      solution: '这是正常的，需要多个柜子或减少货物数量'
    });
  }
  
  // 问题2: 大件货物装载率低
  const fanLoaded = loadedByType['电风扇'] || 0;
  const fanTotal = testCargo.find(c => c.name === '电风扇').quantity;
  if (fanLoaded / fanTotal < 0.5) {
    problems.push({
      type: '大件货物装载率低',
      description: `电风扇(1200mm高)只装载了${fanLoaded}/${fanTotal}件`,
      impact: '高度1200mm的货物难以有效利用柜型高度(2393mm)',
      solution: '优化算法以更好地处理高度较大的货物，或允许平放'
    });
  }
  
  // 问题3: 堆叠限制
  const airFryerLoaded = loadedByType['空气炸锅'] || 0;
  const airFryerTotal = testCargo.find(c => c.name === '空气炸锅').quantity;
  if (airFryerLoaded / airFryerTotal < 0.1) {
    problems.push({
      type: '小件货物装载率极低',
      description: `空气炸锅只装载了${airFryerLoaded}/${airFryerTotal}件 (${((airFryerLoaded/airFryerTotal)*100).toFixed(1)}%)`,
      impact: '算法可能在处理大量小件货物时效率低下',
      solution: '优化Guillotine算法的空间分割策略，提高小件货物的装载效率'
    });
  }
  
  // 问题4: 空间利用率低于50%
  if (actualUtilization < 50) {
    problems.push({
      type: '空间利用率过低',
      description: `当前利用率${actualUtilization}%，远低于90%目标`,
      impact: '算法存在严重的空间浪费问题',
      solution: '需要重新设计装箱策略，可能的方向：\n      1. 改进Guillotine切割算法\n      2. 增加旋转尝试次数\n      3. 优化堆叠策略\n      4. 实现更智能的空间填充'
    });
  }
  
  if (problems.length > 0) {
    console.log('发现以下问题:\n');
    problems.forEach((problem, i) => {
      console.log(`问题${i + 1}: ${problem.type}`);
      console.log(`  描述: ${problem.description}`);
      console.log(`  影响: ${problem.impact}`);
      console.log(`  建议: ${problem.solution}\n`);
    });
  } else {
    console.log('未发现明显问题\n');
  }
  
  // 分析7: 算法改进建议
  console.log('【分析7】算法改进建议\n');
  
  console.log('优先级1 - 紧急改进:');
  console.log('  1. 优化Guillotine切割算法的空间分割策略');
  console.log('  2. 增加小件货物的装载优先级');
  console.log('  3. 改进堆叠层数计算逻辑\n');
  
  console.log('优先级2 - 重要改进:');
  console.log('  1. 实现更智能的旋转策略（尝试6种方向）');
  console.log('  2. 优化局部优化算法（交换、旋转）');
  console.log('  3. 实现多层装箱策略\n');
  
  console.log('优先级3 - 长期改进:');
  console.log('  1. 实现遗传算法或模拟退火算法');
  console.log('  2. 使用机器学习优化装箱策略');
  console.log('  3. 实现3D可视化辅助调试\n');
  
  console.log('========================================\n');
  
  // 总结
  console.log('【总结】\n');
  console.log(`当前空间利用率: ${actualUtilization}%`);
  console.log(`目标空间利用率: 90%+`);
  console.log(`差距: ${(90 - actualUtilization).toFixed(2)}%\n`);
  
  if (actualUtilization < 50) {
    console.log('⚠️  严重问题：空间利用率过低，需要立即优化算法');
    console.log('建议：创建新的spec系统化优化装箱算法');
  } else if (actualUtilization < 70) {
    console.log('⚠️  中等问题：空间利用率偏低，需要改进算法');
    console.log('建议：针对性优化Guillotine算法和堆叠策略');
  } else if (actualUtilization < 90) {
    console.log('✅ 接近目标：空间利用率良好，需要微调');
    console.log('建议：优化局部优化算法，提升最后10-20%');
  } else {
    console.log('✅ 达标：空间利用率已达到90%+目标');
  }
  
  console.log('\n');
}

diagnose().catch(error => {
  console.error('\n❌ 诊断失败:', error);
  console.error(error.stack);
});
