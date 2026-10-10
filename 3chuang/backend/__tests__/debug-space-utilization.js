/**
 * 调试空间利用率问题
 * 检查20GP柜型装载慈溪小家电的实际情况
 */

const Cargo = require('../models/Cargo');
const ContainerType = require('../models/ContainerType');
const OptimizedPackingEngine = require('../services/OptimizedPackingEngine');

async function debugSpaceUtilization() {
  console.log('=== 调试空间利用率 ===\n');
  
  // 40HQ柜型（更大容量）
  const container = new ContainerType({
    typeId: '40HQ',
    name: '40尺高柜',
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2698,
    maxWeight: 26000
  });
  
  console.log('柜型信息:');
  console.log(`- 尺寸: ${container.innerLength} × ${container.innerWidth} × ${container.innerHeight} mm`);
  console.log(`- 体积: ${(container.getVolume() / 1000000000).toFixed(2)} 立方米`);
  console.log(`- 载重: ${container.maxWeight} kg\n`);
  
  // 慈溪小家电货物
  const cargoList = [
    new Cargo({
      cargoId: 'cargo_1',
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
    }),
    new Cargo({
      cargoId: 'cargo_2',
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
    }),
    new Cargo({
      cargoId: 'cargo_3',
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
    })
  ];
  
  // 计算货物总体积和总重量
  const totalCargoVolume = cargoList.reduce((sum, cargo) => {
    return sum + cargo.getVolume() * cargo.quantity;
  }, 0);
  
  const totalCargoWeight = cargoList.reduce((sum, cargo) => {
    return sum + cargo.weight * cargo.quantity;
  }, 0);
  
  console.log('货物信息:');
  cargoList.forEach(cargo => {
    const singleVolume = cargo.getVolume() / 1000000;
    const totalVolume = singleVolume * cargo.quantity;
    console.log(`- ${cargo.name}: ${cargo.length}×${cargo.width}×${cargo.height}mm, ${cargo.weight}kg, ${cargo.quantity}件`);
    console.log(`  单件体积: ${singleVolume.toFixed(3)}m³, 总体积: ${totalVolume.toFixed(3)}m³`);
  });
  
  console.log(`\n货物总计:`);
  console.log(`- 总件数: ${cargoList.reduce((sum, c) => sum + c.quantity, 0)} 件`);
  console.log(`- 总体积: ${(totalCargoVolume / 1000000000).toFixed(2)} 立方米`);
  console.log(`- 总重量: ${totalCargoWeight} kg`);
  console.log(`- 理论体积占比: ${(totalCargoVolume / container.getVolume() * 100).toFixed(2)}%`);
  
  // 判断是否超出柜型容量
  if (totalCargoVolume > container.getVolume()) {
    console.log(`\n⚠️  警告: 货物总体积超出柜型容量 ${((totalCargoVolume - container.getVolume()) / 1000000000).toFixed(2)}m³`);
    console.log(`建议: 使用40GP或40HQ柜型`);
  }
  
  if (totalCargoWeight > container.maxWeight) {
    console.log(`\n⚠️  警告: 货物总重量超出柜型载重 ${(totalCargoWeight - container.maxWeight).toFixed(2)}kg`);
  }
  
  // 运行装箱算法
  console.log('\n=== 开始装箱 ===\n');
  const engine = new OptimizedPackingEngine();
  const plan = await engine.generatePackingPlan(cargoList, container);
  
  console.log('装箱结果:');
  console.log(`- 已装载: ${plan.loadedCargo.length} 件`);
  console.log(`- 未装载: ${plan.unloadedCargo.length} 件`);
  
  // 计算实际装载体积
  const loadedVolume = plan.loadedCargo.reduce((sum, item) => {
    return sum + item.cargo.length * item.cargo.width * item.cargo.height;
  }, 0);
  
  const loadedWeight = plan.loadedCargo.reduce((sum, item) => {
    return sum + item.cargo.weight;
  }, 0);
  
  console.log(`- 装载体积: ${(loadedVolume / 1000000000).toFixed(2)} 立方米`);
  console.log(`- 装载重量: ${loadedWeight.toFixed(2)} kg`);
  console.log(`- 空间利用率: ${(loadedVolume / container.getVolume() * 100).toFixed(2)}%`);
  
  // 按货物类型统计
  console.log('\n按货物类型统计:');
  const stats = {};
  plan.loadedCargo.forEach(item => {
    if (!stats[item.cargo.name]) {
      stats[item.cargo.name] = 0;
    }
    stats[item.cargo.name]++;
  });
  
  Object.keys(stats).forEach(name => {
    const original = cargoList.find(c => c.name === name).quantity;
    console.log(`- ${name}: ${stats[name]}/${original} 件 (${(stats[name]/original*100).toFixed(1)}%)`);
  });
  
  // 未装载原因统计
  if (plan.unloadedCargo.length > 0) {
    console.log('\n未装载原因:');
    const reasons = {};
    plan.unloadedCargo.forEach(item => {
      if (!reasons[item.reason]) {
        reasons[item.reason] = 0;
      }
      reasons[item.reason]++;
    });
    
    Object.keys(reasons).forEach(reason => {
      console.log(`- ${reason}: ${reasons[reason]} 件`);
    });
  }
}

// 运行调试
debugSpaceUtilization().catch(console.error);
