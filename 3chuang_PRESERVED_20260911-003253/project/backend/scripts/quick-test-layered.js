/**
 * 快速测试LayeredPackingEngine的性能
 */

const LayeredPackingEngine = require('../services/LayeredPackingEngine');
const Cargo = require('../models/Cargo');
const ContainerType = require('../models/ContainerType');

async function quickTest() {
  console.log('=== 快速测试 LayeredPackingEngine ===\n');
  
  // 少量货物测试
  const cargoList = [
    new Cargo({
      cargoId: 'cargo_001',
      name: '汽车空气滤芯',
      length: 450,
      width: 350,
      height: 250,
      weight: 10,
      quantity: 100,  // 只测试100件
      stackable: true,
      maxStackLayers: 6,
      canInvert: false,
      canLayFlat: false
    }),
    new Cargo({
      cargoId: 'cargo_002',
      name: '汽车雨刮器',
      length: 800,
      width: 200,
      height: 150,
      weight: 6,
      quantity: 80,
      stackable: true,
      maxStackLayers: 6,
      canInvert: false,
      canLayFlat: false
    }),
    new Cargo({
      cargoId: 'cargo_003',
      name: '汽车LED车灯总成',
      length: 600,
      width: 400,
      height: 350,
      weight: 15,
      quantity: 50,
      stackable: true,
      maxStackLayers: 3,
      canInvert: false,
      canLayFlat: false
    })
  ];
  
  const containerType = new ContainerType({
    typeId: '20GP',
    name: '20英尺标准柜',
    innerLength: 5898,
    innerWidth: 2352,
    innerHeight: 2393,
    maxWeight: 28000,
    description: '20英尺标准集装箱'
  });
  
  console.log('📋 货物: 230件\n');
  console.log('🚀 开始装箱...\n');
  
  const startTime = Date.now();
  const engine = new LayeredPackingEngine();
  const plan = await engine.generatePackingPlan(cargoList, containerType);
  const elapsed = (Date.now() - startTime) / 1000;
  
  console.log('\n=== 结果 ===');
  console.log(`✅ 已装载: ${plan.loadedCargo.length}件`);
  console.log(`❌ 未装载: ${plan.unloadedCargo.length}件`);
  console.log(`📊 空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
  console.log(`⏱️  耗时: ${elapsed.toFixed(3)}秒`);
  
  if (elapsed > 5) {
    console.log('\n⚠️  警告：耗时超过5秒，不适合处理大量货物！');
  }
}

quickTest()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
  });
