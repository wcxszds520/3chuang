/**
 * 3D userData 问题诊断脚本
 * 
 * 问题：updateVisibility 显示 "0 visible, 0 hidden"
 * 原因：edgesMesh 没有 userData，导致筛选逻辑跳过所有对象
 */

console.log('='.repeat(80));
console.log('3D USERDATA 问题诊断');
console.log('='.repeat(80));

console.log('\n【问题描述】');
console.log('- 日志显示: [ThreeRenderer] Visibility updated: 0 visible, 0 hidden');
console.log('- 批次筛选和货物类型筛选都没有反应');
console.log('- 3D 场景中所有货物始终可见');

console.log('\n【根本原因】');
console.log('1. renderIndustrialCargo() 为每个货物创建两个对象:');
console.log('   - mesh (BoxGeometry) - 有 userData');
console.log('   - edgesMesh (LineSegments) - 没有 userData ❌');
console.log('');
console.log('2. updateVisibility() 遍历 cargoGroup.children:');
console.log('   - 检查条件: child.userData && child.userData.cargoId');
console.log('   - edgesMesh 没有 userData，条件为 false');
console.log('   - 所有 edgesMesh 被跳过，导致计数为 0');

console.log('\n【修复方案】');
console.log('✅ 1. 为 edgesMesh 添加完整的 userData');
console.log('✅ 2. 添加 isEdge: true 标记区分边线和主体');
console.log('✅ 3. 确保 cargoId 有默认值 (cargo_${index})');
console.log('✅ 4. 添加门口红色标识线');

console.log('\n【修复后的代码结构】');
console.log(`
mesh.userData = {
  cargoId: cargo.cargoId || \`cargo_\${index}\`,
  loadingIndex: loadingIndex || index,
  color: color,
  type: cargo.type || 'normal',
  batchKey: cargo.batchKey || 'default'
};

edgesMesh.userData = {
  cargoId: cargo.cargoId || \`cargo_\${index}\`,
  loadingIndex: loadingIndex || index,
  color: color,
  type: cargo.type || 'normal',
  batchKey: cargo.batchKey || 'default',
  isEdge: true  // 标记为边线
};
`);

console.log('\n【预期效果】');
console.log('1. 批次筛选正常工作');
console.log('   - 取消勾选 batch_1 → 隐藏该批次的所有货物');
console.log('   - 日志显示正确的 visible/hidden 计数');
console.log('');
console.log('2. 货物类型筛选正常工作');
console.log('   - 点击"重货" → 只显示重货');
console.log('   - 点击"易碎品" → 只显示易碎品');
console.log('');
console.log('3. 门口红色标识');
console.log('   - 在 x=0 平面显示红色矩形框');
console.log('   - 清晰标识集装箱开门位置');

console.log('\n【验证步骤】');
console.log('1. 重新编译小程序 (npm run build)');
console.log('2. 在微信开发者工具中刷新');
console.log('3. 生成装箱方案');
console.log('4. 测试批次筛选 - 观察日志和3D场景');
console.log('5. 测试货物类型筛选 - 观察日志和3D场景');
console.log('6. 检查是否有红色门口标识');

console.log('\n【调试日志关键点】');
console.log('修复前:');
console.log('  [ThreeRenderer] Visibility updated: 0 visible, 0 hidden');
console.log('');
console.log('修复后 (预期):');
console.log('  [ThreeRenderer] Visibility updated: 196 visible, 391 hidden');
console.log('  (数字会根据实际筛选条件变化)');

console.log('\n' + '='.repeat(80));
console.log('诊断完成');
console.log('='.repeat(80));
