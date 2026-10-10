/**
 * 诊断脚本 - 检查装箱API返回的货物类型数据
 */

const Cargo = require('../models/Cargo');
const ContainerType = require('../models/ContainerType');
const SimplePackingEngine = require('../services/SimplePackingEngine');
const PackingPlan = require('../models/PackingPlan');

async function diagnose() {
  console.log('=== 诊断装箱API返回数据 ===\n');
  
  // 创建测试货物
  const cargoList = [
    new Cargo({
      cargoId: 'C001',
      name: '空气炸锅',
      length: 300,
      width: 300,
      height: 350,
      weight: 5,
      quantity: 10,  // 减少数量便于查看
      fragile: true,
      eta: new Date('2026-04-15'),
      portSequence: 1
    }),
    new Cargo({
      cargoId: 'C002',
      name: '取暖器',
      length: 500,
      width: 400,
      height: 600,
      weight: 25,
      quantity: 10,
      fragile: false,
      eta: new Date('2026-04-20'),
      portSequence: 2
    })
  ];
  
  // 创建40HQ柜型
  const containerType = new ContainerType({
    name: '40HQ',
    code: '40HQ',
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2698,
    maxWeight: 26000
  });
  
  // 生成装箱方案
  const engine = new SimplePackingEngine();
  const rawPlan = await engine.generatePackingPlan(cargoList, containerType);
  
  // 创建PackingPlan对象
  const packingPlan = new PackingPlan({
    planId: 'test_plan',
    containerType: containerType,
    loadedCargo: rawPlan.loadedCargo,
    unloadedCargo: rawPlan.unloadedCargo
  });
  
  // 转换为JSON（模拟API返回）
  const apiResponse = packingPlan.toJSON();
  
  console.log('=== API返回的数据结构 ===\n');
  console.log('loadedCargo数量:', apiResponse.loadedCargo.length);
  console.log('\n前3个货物的完整数据:\n');
  
  for (let i = 0; i < Math.min(3, apiResponse.loadedCargo.length); i++) {
    const item = apiResponse.loadedCargo[i];
    console.log(`货物${i + 1}:`, {
      name: item.name,
      weight: item.weight,
      fragile: item.fragile,
      cargoType: item.cargoType,
      position: item.position,
      eta: item.eta,
      portSequence: item.portSequence
    });
    console.log('');
  }
  
  // 检查是否所有货物都有cargoType和fragile字段
  const missingCargoType = apiResponse.loadedCargo.filter(item => !item.cargoType);
  const missingFragile = apiResponse.loadedCargo.filter(item => item.fragile === undefined);
  
  console.log('=== 数据完整性检查 ===');
  console.log(`缺少cargoType字段的货物: ${missingCargoType.length}个`);
  console.log(`缺少fragile字段的货物: ${missingFragile.length}个`);
  
  if (missingCargoType.length > 0) {
    console.log('\n⚠️ 警告：部分货物缺少cargoType字段！');
  }
  
  if (missingFragile.length > 0) {
    console.log('\n⚠️ 警告：部分货物缺少fragile字段！');
  }
  
  if (missingCargoType.length === 0 && missingFragile.length === 0) {
    console.log('\n✓ 所有货物都包含完整的类型信息');
  }
  
  console.log('\n诊断完成！');
}

diagnose().catch(err => {
  console.error('诊断失败:', err);
  process.exit(1);
});
