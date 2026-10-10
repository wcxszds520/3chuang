const fs = require('fs');

const result = JSON.parse(fs.readFileSync('test-result.json', 'utf8'));
const data = result.data;

console.log('\n' + '='.repeat(80));
console.log('🔍 v33.0 后端健康体检 - 测试结果分析');
console.log('='.repeat(80));

console.log('\n📊 核心指标:');
console.log(`   装载数量: ${data.loadedCargo.length} / 50`);
console.log(`   未装载数量: ${data.unloadedCargo.length}`);
console.log(`   空间利用率: ${data.spaceUtilization.toFixed(2)}%`);
console.log(`   总重量: ${data.totalWeight} kg`);

console.log('\n✅ 验收点 1: 字段扁平化');
const firstCargo = data.loadedCargo[0];
const hasNestedObjects = firstCargo.position || firstCargo.dimensions;
console.log(`   结构: ${hasNestedObjects ? '❌ 有嵌套对象' : '✅ 完全扁平'}`);
console.log(`   字段: x=${firstCargo.x}, y=${firstCargo.y}, z=${firstCargo.z}`);
console.log(`         l=${firstCargo.l}, h=${firstCargo.h}, w=${firstCargo.w}`);

console.log('\n✅ 验收点 2: 颜色代码');
console.log(`   格式: ${firstCargo.color}`);
console.log(`   状态: ${firstCargo.color.startsWith('#') ? '✅ 十六进制' : '❌ 格式错误'}`);

console.log('\n❌ 验收点 3: 空间利用率');
console.log(`   返回值: ${data.spaceUtilization.toFixed(2)}%`);
console.log(`   预期范围: 70%-90%`);
console.log(`   状态: ${data.spaceUtilization >= 70 && data.spaceUtilization <= 90 ? '✅ 达标' : '❌ 不达标'}`);

console.log('\n🔍 Y 坐标分布 (验证堆叠):');
const yGroups = {};
data.loadedCargo.forEach(cargo => {
  yGroups[cargo.y] = (yGroups[cargo.y] || 0) + 1;
});
Object.keys(yGroups).sort((a, b) => Number(a) - Number(b)).forEach(y => {
  console.log(`   Y=${y}mm: ${yGroups[y]} 件`);
});

console.log('\n🎯 关键发现:');
const maxY = Math.max(...data.loadedCargo.map(c => c.y));
const hasStacking = maxY > 0;
console.log(`   1. 货物是否堆叠: ${hasStacking ? '✅ 是 (最高Y=' + maxY + 'mm)' : '❌ 否 (全部在地面)'}`);

const maxX = Math.max(...data.loadedCargo.map(c => c.x));
const containerLength = data.containerInfo.innerLength;
const remainingX = containerLength - (maxX + 870);
console.log(`   2. X方向剩余空间: ${remainingX}mm (${remainingX >= 870 ? '✅ 可再装1列' : '❌ 不足'}`);

const maxZ = Math.max(...data.loadedCargo.map(c => c.z));
const containerWidth = data.containerInfo.innerWidth;
const remainingZ = containerWidth - (maxZ + 600);
console.log(`   3. Z方向剩余空间: ${remainingZ}mm (${remainingZ >= 600 ? '✅ 可再装1排' : '❌ 不足'}`);

const containerHeight = data.containerInfo.innerHeight;
const remainingY = containerHeight - (maxY + 600);
console.log(`   4. Y方向剩余空间: ${remainingY}mm (${remainingY >= 600 ? '✅ 可再装1层' : '❌ 不足'}`);

console.log('\n📐 理论计算:');
const xSlots = Math.floor(containerLength / 870);
const ySlots = Math.floor(containerHeight / 600);
const zSlots = Math.floor(containerWidth / 600);
const theoreticalMax = xSlots * ySlots * zSlots;
console.log(`   X方向: ${containerLength} / 870 = ${xSlots} 列`);
console.log(`   Y方向: ${containerHeight} / 600 = ${ySlots} 层`);
console.log(`   Z方向: ${containerWidth} / 600 = ${zSlots} 排`);
console.log(`   理论最大: ${xSlots} × ${ySlots} × ${zSlots} = ${theoreticalMax} 件`);
console.log(`   实际装载: ${data.loadedCargo.length} 件`);
console.log(`   装载效率: ${((data.loadedCargo.length / theoreticalMax) * 100).toFixed(2)}%`);

console.log('\n🚨 问题诊断:');
if (data.spaceUtilization < 70) {
  console.log('   ❌ 利用率严重不足 (< 70%)');
  if (data.loadedCargo.length === 50 && theoreticalMax > 50) {
    console.log('   ❌ 装载数量达到输入上限，但容器还有空间');
    console.log('   💡 建议: 增加输入数量到 ' + theoreticalMax + ' 件进行测试');
  }
  if (hasStacking) {
    console.log('   ✅ 堆叠功能正常 (货物能够向上堆叠)');
  } else {
    console.log('   ❌ 堆叠功能异常 (所有货物都在地面)');
  }
}

console.log('\n' + '='.repeat(80));
console.log('✅ 测试完成');
console.log('='.repeat(80) + '\n');
