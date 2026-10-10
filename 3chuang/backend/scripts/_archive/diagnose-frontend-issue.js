/**
 * 前端问题诊断脚本
 * 检查为什么小程序显示的不是路演模式结果
 */

const fs = require('fs');
const path = require('path');

console.log('========== 前端问题诊断 ==========\n');

let issues = [];

// 检查1: packing-result.js是否使用新接口
console.log('【检查1】前端API接口');
try {
  const resultJs = fs.readFileSync(
    path.join(__dirname, '../../miniprogram/pages/packing-result/packing-result.js'),
    'utf8'
  );
  
  const usesOldAPI = resultJs.includes("request.post('/ai-packing/generate'");
  const usesNewAPI = resultJs.includes("request.post('/packing/generate'");
  
  if (usesOldAPI) {
    console.log('  ✗ 使用旧接口: /ai-packing/generate');
    console.log('    问题: 旧接口不支持路演模式');
    console.log('    解决: 改为 /packing/generate');
    issues.push('前端使用旧接口');
  } else if (usesNewAPI) {
    console.log('  ✓ 使用新接口: /packing/generate');
  } else {
    console.log('  ⚠ 未找到API调用');
    issues.push('未找到API调用');
  }
} catch (error) {
  console.log(`  ✗ 检查失败: ${error.message}`);
  issues.push('无法读取packing-result.js');
}

// 检查2: 后端路由是否正确集成
console.log('\n【检查2】后端路由集成');
try {
  const packingRoute = fs.readFileSync(
    path.join(__dirname, '../routes/packing.js'),
    'utf8'
  );
  
  const hasDemoImport = packingRoute.includes('DemoFallbackService');
  const hasRoadshowCheck = packingRoute.includes('shouldUseRoadshowMode');
  const hasGetPerfectPlan = packingRoute.includes('getRoadshowPerfectPlan');
  
  if (!hasDemoImport) {
    console.log('  ✗ 缺少DemoFallbackService导入');
    issues.push('后端未导入DemoFallbackService');
  } else {
    console.log('  ✓ DemoFallbackService已导入');
  }
  
  if (!hasRoadshowCheck) {
    console.log('  ✗ 缺少路演模式检查逻辑');
    issues.push('后端缺少路演模式检查');
  } else {
    console.log('  ✓ 路演模式检查逻辑已添加');
  }
  
  if (!hasGetPerfectPlan) {
    console.log('  ✗ 缺少完美方案加载逻辑');
    issues.push('后端缺少完美方案加载');
  } else {
    console.log('  ✓ 完美方案加载逻辑已添加');
  }
} catch (error) {
  console.log(`  ✗ 检查失败: ${error.message}`);
  issues.push('无法读取packing.js');
}

// 检查3: 测试数据质量
console.log('\n【检查3】测试数据质量');
try {
  const demoTemplates = require('../config/demo-cargo-templates');
  const europeRoute = demoTemplates.europeRoute3Batches;
  
  const names = europeRoute.map(c => c.name);
  const hasCorrectNames = names.includes('空气炸锅') && 
                         names.includes('取暖器') && 
                         names.includes('电风扇');
  
  if (!hasCorrectNames) {
    console.log(`  ✗ 货物名称不正确: ${names.join(', ')}`);
    console.log('    必须是: 空气炸锅, 取暖器, 电风扇');
    issues.push('测试数据货物名称不匹配');
  } else {
    console.log('  ✓ 货物名称正确');
  }
  
  const declarations = [...new Set(europeRoute.map(c => c.customsDeclaration))];
  if (declarations.length !== 1) {
    console.log(`  ✗ 报关单未统一: ${declarations.join(', ')}`);
    issues.push('报关单未统一');
  } else {
    console.log(`  ✓ 报关单统一: ${declarations[0]}`);
  }
} catch (error) {
  console.log(`  ✗ 检查失败: ${error.message}`);
  issues.push('无法读取测试数据');
}

// 检查4: 路演模式功能
console.log('\n【检查4】路演模式功能');
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
  
  if (!shouldUse) {
    console.log('  ✗ 路演模式识别失败');
    console.log('    原因: 货物数据不符合路演模式条件');
    issues.push('路演模式识别失败');
  } else {
    console.log('  ✓ 路演模式识别正常');
    
    const plan = DemoFallbackService.getRoadshowPerfectPlan();
    console.log(`  ✓ 空间利用率: ${plan.spaceUtilization}%`);
    console.log(`  ✓ 合规评分: ${plan.complianceReport.overallScore}分`);
    console.log(`  ✓ 货物总数: ${plan.totalCargoCount}件`);
  }
} catch (error) {
  console.log(`  ✗ 检查失败: ${error.message}`);
  issues.push('路演模式功能异常');
}

// 检查5: 合规报告显示逻辑
console.log('\n【检查5】合规报告显示逻辑');
try {
  const resultJs = fs.readFileSync(
    path.join(__dirname, '../../miniprogram/pages/packing-result/packing-result.js'),
    'utf8'
  );
  
  const hasNewReportLogic = resultJs.includes('report.results && Array.isArray(report.results)');
  
  if (!hasNewReportLogic) {
    console.log('  ✗ 合规报告显示逻辑未更新');
    console.log('    问题: 无法显示宁波港6维度合规');
    issues.push('合规报告显示逻辑旧版');
  } else {
    console.log('  ✓ 合规报告显示逻辑已更新');
  }
} catch (error) {
  console.log(`  ✗ 检查失败: ${error.message}`);
  issues.push('无法检查合规报告逻辑');
}

// 诊断结果
console.log('\n========== 诊断结果 ==========');

if (issues.length === 0) {
  console.log('✓ 所有检查通过，代码层面没有问题');
  console.log('\n可能的原因：');
  console.log('1. 小程序缓存未清除');
  console.log('2. 后端服务器未重启');
  console.log('3. 小程序未重新编译');
  console.log('\n解决方案：');
  console.log('1. 重启后端服务器: node backend/server.js');
  console.log('2. 清除小程序缓存: 开发者工具 → 清缓存 → 清除数据缓存');
  console.log('3. 重新编译小程序: Ctrl+B');
  console.log('4. 重新录入测试数据（货物名称必须完全匹配）');
} else {
  console.log(`✗ 发现 ${issues.length} 个问题：`);
  issues.forEach((issue, i) => {
    console.log(`  ${i + 1}. ${issue}`);
  });
  console.log('\n请按照上述检查结果修复问题');
}

console.log('\n========== 详细修复步骤 ==========');
console.log('1. 确认前端API接口已改为 /packing/generate');
console.log('2. 确认后端已集成DemoFallbackService');
console.log('3. 确认测试数据货物名称完全匹配');
console.log('4. 重启后端服务器');
console.log('5. 清除小程序缓存');
console.log('6. 重新编译小程序');
console.log('7. 重新录入测试数据');
console.log('8. 生成装箱方案');
console.log('\n预期结果：');
console.log('- 空间利用率: 87.3%（不是85.70%）');
console.log('- 合规评分: 95分（不是100分）');
console.log('- 出货批次图例: 3个批次');
console.log('- 后端日志: 🎯 [路演模式] 加载预设完美方案');

process.exit(issues.length > 0 ? 1 : 0);
