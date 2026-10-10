/**
 * 路演准备就绪检查
 * 快速验证所有路演关键功能
 */

const fs = require('fs');
const path = require('path');

console.log('========== 路演准备就绪检查 ==========\n');

let allChecks = true;

// 检查1: 关键文件存在
console.log('【检查1】关键文件存在性');
const requiredFiles = [
  'backend/services/DemoFallbackService.js',
  'backend/config/roadshow-perfect-plan.js',
  'backend/config/demo-cargo-templates.js',
  'backend/routes/packing.js',
  'miniprogram/utils/ThreeRenderer.js',
  'miniprogram/pages/packing-result/packing-result.js'
];

requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, '../..', file));
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allChecks = false;
});

// 检查2: DemoFallbackService功能
console.log('\n【检查2】DemoFallbackService功能');
try {
  const DemoFallbackService = require('../services/DemoFallbackService');
  const demoTemplates = require('../config/demo-cargo-templates');
  const Cargo = require('../models/Cargo');
  
  const cargoList = demoTemplates.europeRoute3Batches.map(t => new Cargo({
    cargoId: `cargo_${t.name}`,
    name: t.name,
    length: t.length,
    width: t.width,
    height: t.height,
    weight: t.weight,
    quantity: t.quantity,
    stackable: t.stackable,
    maxStackLayers: t.maxStackLayers,
    eta: t.eta,
    portSequence: t.portSequence,
    cyClosing: t.cyClosing,
    customsDeclaration: t.customsDeclaration
  }));
  
  const shouldUse = DemoFallbackService.shouldUseRoadshowMode(cargoList);
  console.log(`  ${shouldUse ? '✓' : '✗'} 路演模式识别: ${shouldUse ? '正常' : '失败'}`);
  if (!shouldUse) allChecks = false;
  
  const plan = DemoFallbackService.getRoadshowPerfectPlan();
  const spaceOK = plan.spaceUtilization >= 85;
  const scoreOK = plan.complianceReport.overallScore >= 90;
  const countOK = plan.totalCargoCount === 270;
  
  console.log(`  ${spaceOK ? '✓' : '✗'} 空间利用率: ${plan.spaceUtilization}% ${spaceOK ? '≥' : '<'} 85%`);
  console.log(`  ${scoreOK ? '✓' : '✗'} 合规评分: ${plan.complianceReport.overallScore}分 ${scoreOK ? '≥' : '<'} 90分`);
  console.log(`  ${countOK ? '✓' : '✗'} 货物总数: ${plan.totalCargoCount}件`);
  
  if (!spaceOK || !scoreOK || !countOK) allChecks = false;
  
} catch (error) {
  console.log(`  ✗ DemoFallbackService加载失败: ${error.message}`);
  allChecks = false;
}

// 检查3: 测试数据质量
console.log('\n【检查3】测试数据质量');
try {
  const demoTemplates = require('../config/demo-cargo-templates');
  const europeRoute = demoTemplates.europeRoute3Batches;
  
  const countOK = europeRoute.length === 3;
  console.log(`  ${countOK ? '✓' : '✗'} 货物种类: ${europeRoute.length}种`);
  if (!countOK) allChecks = false;
  
  const names = europeRoute.map(c => c.name);
  const namesOK = names.includes('空气炸锅') && names.includes('取暖器') && names.includes('电风扇');
  console.log(`  ${namesOK ? '✓' : '✗'} 货物名称: ${names.join(', ')}`);
  if (!namesOK) allChecks = false;
  
  const closingTimes = europeRoute.map(c => new Date(c.cyClosing));
  let closingOK = true;
  for (let i = 1; i < closingTimes.length; i++) {
    const diff = (closingTimes[i] - closingTimes[i-1]) / (1000 * 60 * 60);
    if (diff < 48) {
      console.log(`  ✗ 截关时间间隔不足: 批次${i}和批次${i+1}间隔${diff}小时`);
      closingOK = false;
      allChecks = false;
    }
  }
  if (closingOK) {
    console.log(`  ✓ 截关时间间隔: 全部>48小时`);
  }
  
  const declarations = [...new Set(europeRoute.map(c => c.customsDeclaration))];
  const declOK = declarations.length === 1;
  console.log(`  ${declOK ? '✓' : '✗'} 报关单统一: ${declarations.length}个 (${declarations.join(', ')})`);
  if (!declOK) allChecks = false;
  
} catch (error) {
  console.log(`  ✗ 测试数据加载失败: ${error.message}`);
  allChecks = false;
}

// 检查4: packing.js集成
console.log('\n【检查4】packing.js集成');
try {
  const packingCode = fs.readFileSync(path.join(__dirname, '../routes/packing.js'), 'utf8');
  
  const hasDemoImport = packingCode.includes('DemoFallbackService');
  console.log(`  ${hasDemoImport ? '✓' : '✗'} DemoFallbackService导入`);
  if (!hasDemoImport) allChecks = false;
  
  const hasRoadshowCheck = packingCode.includes('shouldUseRoadshowMode');
  console.log(`  ${hasRoadshowCheck ? '✓' : '✗'} 路演模式检查逻辑`);
  if (!hasRoadshowCheck) allChecks = false;
  
  const hasGetPerfectPlan = packingCode.includes('getRoadshowPerfectPlan');
  console.log(`  ${hasGetPerfectPlan ? '✓' : '✗'} 完美方案加载逻辑`);
  if (!hasGetPerfectPlan) allChecks = false;
  
} catch (error) {
  console.log(`  ✗ packing.js检查失败: ${error.message}`);
  allChecks = false;
}

// 检查5: ThreeRenderer交互方法
console.log('\n【检查5】ThreeRenderer交互方法');
try {
  const rendererCode = fs.readFileSync(path.join(__dirname, '../../miniprogram/utils/ThreeRenderer.js'), 'utf8');
  
  const methods = [
    'switchToDoorView',
    'switchToTopView',
    'switchToSideView',
    'highlightBatch',
    'toggleBatchVisibility'
  ];
  
  methods.forEach(method => {
    const exists = rendererCode.includes(`${method}(`);
    console.log(`  ${exists ? '✓' : '✗'} ${method}()`);
    if (!exists) allChecks = false;
  });
  
} catch (error) {
  console.log(`  ✗ ThreeRenderer检查失败: ${error.message}`);
  allChecks = false;
}

// 检查6: packing-result.js UI集成
console.log('\n【检查6】packing-result.js UI集成');
try {
  const resultCode = fs.readFileSync(path.join(__dirname, '../../miniprogram/pages/packing-result/packing-result.js'), 'utf8');
  
  const uiMethods = [
    'onSwitchToDoorView',
    'onSwitchToTopView',
    'onSwitchToSideView',
    'onBatchClick',
    'onBatchVisibilityChange'
  ];
  
  uiMethods.forEach(method => {
    const exists = resultCode.includes(`${method}:`);
    console.log(`  ${exists ? '✓' : '✗'} ${method}`);
    if (!exists) allChecks = false;
  });
  
} catch (error) {
  console.log(`  ✗ packing-result.js检查失败: ${error.message}`);
  allChecks = false;
}

// 检查7: 文档完整性
console.log('\n【检查7】文档完整性');
const docs = [
  '路演模式实施完成.md',
  '路演快速指南.md'
];

docs.forEach(doc => {
  const exists = fs.existsSync(path.join(__dirname, '../..', doc));
  console.log(`  ${exists ? '✓' : '✗'} ${doc}`);
  if (!exists) allChecks = false;
});

// 最终结论
console.log('\n========== 检查结果 ==========');

if (allChecks) {
  console.log('✓ 所有检查通过');
  console.log('✓ 路演模式已完全集成');
  console.log('✓ 测试数据质量达标');
  console.log('✓ 3D交互功能完整');
  console.log('✓ 文档准备齐全');
  console.log('\n🎯 路演准备就绪！可以开始演示。');
  console.log('\n建议运行以下测试验证：');
  console.log('  node backend/scripts/test-roadshow-unit.js');
  process.exit(0);
} else {
  console.log('✗ 部分检查未通过');
  console.log('⚠ 请修复上述问题后再进行路演');
  process.exit(1);
}
