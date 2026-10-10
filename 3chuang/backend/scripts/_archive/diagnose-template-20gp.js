/**
 * 诊断小程序模板在20GP柜型下的装载问题
 * 
 * 问题：用户录入960件货物，只装载了625件
 * 原因：20GP柜型尺寸较小，需要优化区域划分和装载策略
 */

const SimplePackingEngine = require('../services/SimplePackingEngine');
const NingboPortComplianceChecker = require('../services/NingboPortComplianceChecker');

// 小程序"小家电出口"模板数据
const appliancesTemplate = [
  // 批次1（最早到港，箱门端）
  { name: '空气炸锅', length: 400, width: 350, height: 300, weight: 5, quantity: 30, stackable: true, maxStackLayers: 4, canInvert: false, canLayFlat: false, fragile: false, eta: '2026-04-15', portSequence: 1 },
  { name: '电水壶', length: 300, width: 250, height: 250, weight: 2, quantity: 350, stackable: true, maxStackLayers: 6, canInvert: false, canLayFlat: false, fragile: false, eta: '2026-04-15', portSequence: 1 },
  { name: '马克杯', length: 250, width: 250, height: 150, weight: 0.5, quantity: 120, stackable: true, maxStackLayers: 5, canInvert: false, canLayFlat: false, fragile: true, eta: '2026-04-15', portSequence: 1 },
  // 批次2（中间到港）
  { name: '取暖器', length: 500, width: 400, height: 350, weight: 25, quantity: 20, stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: false, eta: '2026-04-20', portSequence: 2 },
  { name: '电饭煲', length: 400, width: 350, height: 300, weight: 4, quantity: 150, stackable: true, maxStackLayers: 5, canInvert: false, canLayFlat: false, fragile: false, eta: '2026-04-20', portSequence: 2 },
  { name: '陶瓷碗', length: 350, width: 350, height: 200, weight: 1, quantity: 40, stackable: true, maxStackLayers: 4, canInvert: false, canLayFlat: false, fragile: true, eta: '2026-04-20', portSequence: 2 },
  // 批次3（最晚到港，最内侧）
  { name: '洗衣机', length: 600, width: 600, height: 850, weight: 30, quantity: 15, stackable: true, maxStackLayers: 2, canInvert: false, canLayFlat: false, fragile: false, eta: '2026-04-25', portSequence: 3 },
  { name: '电风扇', length: 450, width: 380, height: 320, weight: 3, quantity: 200, stackable: true, maxStackLayers: 5, canInvert: false, canLayFlat: false, fragile: false, eta: '2026-04-25', portSequence: 3 },
  { name: '玻璃杯', length: 300, width: 300, height: 200, weight: 1, quantity: 35, stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: true, eta: '2026-04-25', portSequence: 3 }
];

// 20GP柜型参数
const container20GP = {
  name: '20英尺标准柜',
  innerLength: 5898,  // mm
  innerWidth: 2352,   // mm
  innerHeight: 2393,  // mm
  maxWeight: 28000  // kg
};

console.log('=== 诊断小程序模板在20GP柜型下的装载问题 ===\n');

console.log('步骤1：检查货物数据');
const totalQuantity = appliancesTemplate.reduce((sum, cargo) => sum + cargo.quantity, 0);
const totalWeight = appliancesTemplate.reduce((sum, cargo) => sum + cargo.weight * cargo.quantity, 0);
console.log(`✓ 货物总数: ${totalQuantity}件`);
console.log(`✓ 货物总重: ${totalWeight}kg`);
console.log(`✓ 柜型: ${container20GP.name} (${container20GP.innerLength}×${container20GP.innerWidth}×${container20GP.innerHeight}mm, ${container20GP.maxWeight}kg)`);

// 按批次统计
const batch1 = appliancesTemplate.filter(c => c.portSequence === 1);
const batch2 = appliancesTemplate.filter(c => c.portSequence === 2);
const batch3 = appliancesTemplate.filter(c => c.portSequence === 3);

const batch1Qty = batch1.reduce((sum, c) => sum + c.quantity, 0);
const batch2Qty = batch2.reduce((sum, c) => sum + c.quantity, 0);
const batch3Qty = batch3.reduce((sum, c) => sum + c.quantity, 0);

console.log(`\n批次分布:`);
console.log(`  批次1（最早到港）: ${batch1Qty}件`);
console.log(`  批次2（中间到港）: ${batch2Qty}件`);
console.log(`  批次3（最晚到港）: ${batch3Qty}件`);

(async () => {
  console.log('\n步骤2：执行装箱算法（20GP柜型）');
  try {
    const engine = new SimplePackingEngine();
    const result = await engine.generatePackingPlan(appliancesTemplate, container20GP);
  
  console.log(`\n装载结果:`);
  console.log(`  已装载: ${result.loadedCargo.length}件`);
  console.log(`  未装载: ${result.unloadedCargo.length}件`);
  console.log(`  空间利用率: ${result.spaceUtilization.toFixed(2)}%`);
  console.log(`  总重量: ${result.totalWeight}kg`);
  
  // 按批次统计已装载货物
  const loadedBatch1 = result.loadedCargo.filter(c => c.portSequence === 1).length;
  const loadedBatch2 = result.loadedCargo.filter(c => c.portSequence === 2).length;
  const loadedBatch3 = result.loadedCargo.filter(c => c.portSequence === 3).length;
  
  console.log(`\n已装载批次分布:`);
  console.log(`  批次1: ${loadedBatch1}/${batch1Qty}件 (${(loadedBatch1/batch1Qty*100).toFixed(1)}%)`);
  console.log(`  批次2: ${loadedBatch2}/${batch2Qty}件 (${(loadedBatch2/batch2Qty*100).toFixed(1)}%)`);
  console.log(`  批次3: ${loadedBatch3}/${batch3Qty}件 (${(loadedBatch3/batch3Qty*100).toFixed(1)}%)`);
  
  // 检查X轴分布
  console.log(`\n步骤3：检查X轴分布（是否强制铺满）`);
  const batch1Loaded = result.loadedCargo.filter(c => c.portSequence === 1);
  const batch2Loaded = result.loadedCargo.filter(c => c.portSequence === 2);
  const batch3Loaded = result.loadedCargo.filter(c => c.portSequence === 3);
  
  if (batch1Loaded.length > 0) {
    const batch1XMin = Math.min(...batch1Loaded.map(c => c.x));
    const batch1XMax = Math.max(...batch1Loaded.map(c => c.x + c.length));
    console.log(`  批次1 X轴范围: [${batch1XMin.toFixed(0)}, ${batch1XMax.toFixed(0)}]mm`);
  }
  
  if (batch2Loaded.length > 0) {
    const batch2XMin = Math.min(...batch2Loaded.map(c => c.x));
    const batch2XMax = Math.max(...batch2Loaded.map(c => c.x + c.length));
    console.log(`  批次2 X轴范围: [${batch2XMin.toFixed(0)}, ${batch2XMax.toFixed(0)}]mm`);
  }
  
  if (batch3Loaded.length > 0) {
    const batch3XMin = Math.min(...batch3Loaded.map(c => c.x));
    const batch3XMax = Math.max(...batch3Loaded.map(c => c.x + c.length));
    console.log(`  批次3 X轴范围: [${batch3XMin.toFixed(0)}, ${batch3XMax.toFixed(0)}]mm`);
  }
  
  // 生成合规报告
  console.log(`\n步骤4：生成合规报告`);
  const complianceReport = NingboPortComplianceChecker.generateReport(result, container20GP);
  
  console.log(`\n合规评分:`);
  console.log(`  综合评分: ${complianceReport.overallScore}分`);
  console.log(`  规则1（装柜顺序）: ${complianceReport.rule1.passed ? '✓' : '✗'} ${complianceReport.rule1.score}分`);
  console.log(`  规则2（偏载重心）: ${complianceReport.rule2.passed ? '✓' : '✗'} ${complianceReport.rule2.score}分`);
  console.log(`  规则3（总重堆叠）: ${complianceReport.rule3.passed ? '✓' : '✗'} ${complianceReport.rule3.score}分`);
  
  // 诊断结论
  console.log(`\n=== 诊断结论 ===`);
  if (result.loadedCargo.length < totalQuantity) {
    console.log(`❌ 致命问题：货物装载不全！`);
    console.log(`   录入${totalQuantity}件，只装载${result.loadedCargo.length}件，丢失${totalQuantity - result.loadedCargo.length}件`);
    console.log(`\n可能原因:`);
    console.log(`   1. 20GP柜型空间较小，固定三等分区域导致某些批次空间不足`);
    console.log(`   2. 算法提前终止装载，未充分利用剩余空间`);
    console.log(`   3. 货物尺寸较大（如洗衣机600×600×850mm），在小柜型中难以摆放`);
    console.log(`\n建议修复方案:`);
    console.log(`   1. 针对20GP柜型，按货物数量/重量动态分配X轴区域，而非固定三等分`);
    console.log(`   2. 优化装载终止逻辑，只要有空间就继续尝试装载`);
    console.log(`   3. 增加货物旋转尝试，提高空间利用率`);
  } else {
    console.log(`✓ 货物100%装载完成`);
  }
  
} catch (error) {
  console.error('装箱失败:', error.message);
  console.error(error.stack);
}

console.log('\n诊断完成！');
})();
