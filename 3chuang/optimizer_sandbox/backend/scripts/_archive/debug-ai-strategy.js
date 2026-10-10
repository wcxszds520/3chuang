/**
 * AI辅助装箱策略调试脚本
 */

const Cargo = require('../models/Cargo');
const ContainerType = require('../models/ContainerType');
const OptimizedPackingEngine = require('../services/OptimizedPackingEngine');
const AIPackingService = require('../services/AIPackingService');

async function debugAIStrategy() {
  console.log('=== AI辅助装箱策略调试 ===\n');
  
  const containerType = new ContainerType({
    typeId: '40GP',
    name: '40GP标准集装箱',
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2393,
    maxWeight: 26680
  });
  
  const cargoList = [
    new Cargo({
      cargoId: 'air_fryer_001',
      name: '空气炸锅',
      length: 300,
      width: 300,
      height: 350,
      weight: 5,
      quantity: 20,
      stackable: true,
      maxStackLayers: 4,
      canInvert: false,
      canLayFlat: false
    }),
    new Cargo({
      cargoId: 'heater_001',
      name: '取暖器',
      length: 500,
      width: 400,
      height: 600,
      weight: 8,
      quantity: 10,
      stackable: true,
      maxStackLayers: 3,
      canInvert: false,
      canLayFlat: false
    }),
    new Cargo({
      cargoId: 'fan_001',
      name: '电风扇',
      length: 400,
      width: 400,
      height: 1200,
      weight: 6,
      quantity: 5,
      stackable: false,
      maxStackLayers: 1,
      canInvert: false,
      canLayFlat: true
    })
  ];
  
  console.log('📦 测试场景：');
  console.log(`   - 空气炸锅: 20件 (可堆叠4层)`);
  console.log(`   - 取暖器: 10件 (可堆叠3层)`);
  console.log(`   - 电风扇: 5件 (不可堆叠)\n`);
  
  // 调用AI分析
  const aiService = new AIPackingService();
  const aiStrategy = await aiService.analyzePackingStrategy(cargoList, containerType);
  
  console.log('🤖 AI策略:');
  console.log(`   - 装载顺序: ${aiStrategy.loadingOrder.join(' → ')}\n`);
  
  // 使用AI策略生成装箱方案
  const aiEngine = new OptimizedPackingEngine();
  const aiPlan = await aiEngine.generatePackingPlan(
    cargoList,
    containerType,
    { aiStrategy, debugMode: true }
  );
  
  console.log('\n--- 装箱结果 ---');
  console.log(`空间利用率: ${aiPlan.spaceUtilization.toFixed(2)}%`);
  console.log(`已装载: ${aiPlan.loadedCargo.length}件`);
  console.log(`未装载: ${aiPlan.unloadedCargo.length}件`);
  
  const countByType = {};
  aiPlan.loadedCargo.forEach(loaded => {
    const name = loaded.cargo.name;
    countByType[name] = (countByType[name] || 0) + 1;
  });
  
  console.log('\n装载详情:');
  console.log(`   - 空气炸锅: ${countByType['空气炸锅'] || 0}/20`);
  console.log(`   - 取暖器: ${countByType['取暖器'] || 0}/10`);
  console.log(`   - 电风扇: ${countByType['电风扇'] || 0}/5`);
}

debugAIStrategy()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('错误:', error);
    process.exit(1);
  });
