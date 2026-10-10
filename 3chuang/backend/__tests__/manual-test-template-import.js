/**
 * 手动测试脚本 - 模板导入API
 * 
 * 用途：手动测试 POST /api/cargo/import-template 接口
 * 使用方法：
 * 1. 确保后端服务已启动（npm start）
 * 2. 运行此脚本：node __tests__/manual-test-template-import.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

/**
 * 测试导入"慈溪小家电"模板
 */
async function testImportCixiAppliances() {
  console.log('\n========== 测试1：导入"慈溪小家电"模板 ==========');
  
  try {
    const response = await axios.post(`${BASE_URL}/cargo/import-template`, {
      templateName: '慈溪小家电'
    });

    console.log('✅ 导入成功');
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    console.log(`导入了 ${response.data.data.count} 种货物`);
    
    // 显示导入的货物列表
    response.data.data.cargoList.forEach((cargo, index) => {
      console.log(`\n货物 ${index + 1}:`);
      console.log(`  名称: ${cargo.name}`);
      console.log(`  尺寸: ${cargo.length}×${cargo.width}×${cargo.height}mm`);
      console.log(`  重量: ${cargo.weight}kg`);
      console.log(`  数量: ${cargo.quantity}个`);
      console.log(`  货物ID: ${cargo.cargoId}`);
    });
  } catch (error) {
    console.error('❌ 导入失败:', error.response?.data || error.message);
  }
}

/**
 * 测试导入"宁波文具"模板
 */
async function testImportNingboStationery() {
  console.log('\n========== 测试2：导入"宁波文具"模板 ==========');
  
  try {
    const response = await axios.post(`${BASE_URL}/cargo/import-template`, {
      templateName: '宁波文具'
    });

    console.log('✅ 导入成功');
    console.log(`导入了 ${response.data.data.count} 种货物`);
    console.log('货物名称:', response.data.data.cargoList.map(c => c.name).join(', '));
  } catch (error) {
    console.error('❌ 导入失败:', error.response?.data || error.message);
  }
}

/**
 * 测试导入"宁波汽配"模板
 */
async function testImportNingboAutoParts() {
  console.log('\n========== 测试3：导入"宁波汽配"模板 ==========');
  
  try {
    const response = await axios.post(`${BASE_URL}/cargo/import-template`, {
      templateName: '宁波汽配'
    });

    console.log('✅ 导入成功');
    console.log(`导入了 ${response.data.data.count} 种货物`);
    console.log('货物名称:', response.data.data.cargoList.map(c => c.name).join(', '));
  } catch (error) {
    console.error('❌ 导入失败:', error.response?.data || error.message);
  }
}

/**
 * 测试无效的模板名称
 */
async function testInvalidTemplate() {
  console.log('\n========== 测试4：无效的模板名称 ==========');
  
  try {
    const response = await axios.post(`${BASE_URL}/cargo/import-template`, {
      templateName: '不存在的模板'
    });

    console.log('❌ 应该返回错误，但返回了成功');
  } catch (error) {
    console.log('✅ 正确返回错误:', error.response?.data?.message);
  }
}

/**
 * 测试缺少模板名称参数
 */
async function testMissingTemplateName() {
  console.log('\n========== 测试5：缺少模板名称参数 ==========');
  
  try {
    const response = await axios.post(`${BASE_URL}/cargo/import-template`, {});

    console.log('❌ 应该返回错误，但返回了成功');
  } catch (error) {
    console.log('✅ 正确返回错误:', error.response?.data?.message);
  }
}

/**
 * 查询导入的货物列表
 */
async function testListCargo() {
  console.log('\n========== 测试6：查询导入的货物列表 ==========');
  
  try {
    const response = await axios.get(`${BASE_URL}/cargo/list`);

    console.log('✅ 查询成功');
    console.log(`数据库中共有 ${response.data.data.cargoList.length} 种货物`);
    
    // 显示前5个货物
    const displayCount = Math.min(5, response.data.data.cargoList.length);
    console.log(`\n显示前 ${displayCount} 个货物:`);
    response.data.data.cargoList.slice(0, displayCount).forEach((cargo, index) => {
      console.log(`${index + 1}. ${cargo.name} (${cargo.quantity}个)`);
    });
  } catch (error) {
    console.error('❌ 查询失败:', error.response?.data || error.message);
  }
}

/**
 * 清空所有货物
 */
async function clearAllCargo() {
  console.log('\n========== 清空所有货物 ==========');
  
  try {
    const response = await axios.delete(`${BASE_URL}/cargo/clear`);

    console.log('✅ 清空成功');
    console.log(`删除了 ${response.data.data.deletedCount} 条记录`);
  } catch (error) {
    console.error('❌ 清空失败:', error.response?.data || error.message);
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('========================================');
  console.log('模板导入API手动测试');
  console.log('========================================');

  // 先清空数据库
  await clearAllCargo();

  // 执行测试
  await testImportCixiAppliances();
  await testImportNingboStationery();
  await testImportNingboAutoParts();
  await testInvalidTemplate();
  await testMissingTemplateName();
  await testListCargo();

  // 测试完成后清空数据库
  await clearAllCargo();

  console.log('\n========================================');
  console.log('所有测试完成！');
  console.log('========================================\n');
}

// 运行测试
runTests().catch(error => {
  console.error('测试执行失败:', error.message);
  process.exit(1);
});
