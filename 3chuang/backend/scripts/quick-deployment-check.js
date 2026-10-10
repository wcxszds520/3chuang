/**
 * 快速部署检查脚本
 * 验证核心功能是否正常工作
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n========================================', 'cyan');
  log('  甬柜易算 - 快速部署检查', 'cyan');
  log('========================================\n', 'cyan');

  let allPassed = true;

  // 1. 健康检查
  try {
    log('✓ 测试: 服务器健康检查...', 'cyan');
    await axios.get(`${BASE_URL}/health`);
    log('✅ 通过: 服务器健康检查\n', 'green');
  } catch (error) {
    log('❌ 失败: 服务器健康检查\n', 'red');
    allPassed = false;
  }

  // 2. 柜型列表
  try {
    log('✓ 测试: 获取柜型列表...', 'cyan');
    const res = await axios.get(`${BASE_URL}/container/list`);
    const containers = res.data.data.containerTypes;
    log(`✅ 通过: 找到 ${containers.length} 种柜型\n`, 'green');
  } catch (error) {
    log('❌ 失败: 获取柜型列表\n', 'red');
    allPassed = false;
  }

  // 3. 装箱计算
  try {
    log('✓ 测试: 装箱计算...', 'cyan');
    const res = await axios.post(`${BASE_URL}/packing/generate`, {
      containerType: '20GP',
      cargoList: [
        {
          name: '测试货物',
          length: 600,
          width: 400,
          height: 300,
          weight: 20,
          quantity: 10,
          cargoType: 'carton'
        }
      ]
    });
    const result = res.data.data;
    log(`✅ 通过: 利用率 ${result.spaceUtilization.toFixed(2)}%, 已放置 ${result.loadedCargo.length} 件\n`, 'green');
  } catch (error) {
    log(`❌ 失败: 装箱计算 - ${error.message}\n`, 'red');
    allPassed = false;
  }

  // 4. 批次装箱
  try {
    log('✓ 测试: 批次装箱...', 'cyan');
    const res = await axios.post(`${BASE_URL}/packing/generate`, {
      containerType: '40HQ',
      cargoList: [
        {
          name: '批次1',
          length: 800,
          width: 600,
          height: 400,
          weight: 50,
          quantity: 5,
          cargoType: 'carton',
          batchNumber: 1,
          portSequence: 1,
          shippingTime: '2026-03-10'
        },
        {
          name: '批次2',
          length: 700,
          width: 500,
          height: 350,
          weight: 40,
          quantity: 5,
          cargoType: 'carton',
          batchNumber: 2,
          portSequence: 2,
          shippingTime: '2026-03-15'
        }
      ]
    });
    const result = res.data.data;
    const batch1 = result.loadedCargo.filter(c => c.portSequence === 1).length;
    const batch2 = result.loadedCargo.filter(c => c.portSequence === 2).length;
    log(`✅ 通过: 批次1=${batch1}件, 批次2=${batch2}件\n`, 'green');
  } catch (error) {
    log(`❌ 失败: 批次装箱 - ${error.message}\n`, 'red');
    allPassed = false;
  }

  log('========================================', 'cyan');
  if (allPassed) {
    log('🎉 所有测试通过！系统已就绪。', 'green');
  } else {
    log('⚠️  部分测试失败，请检查日志。', 'red');
  }
  log('========================================\n', 'cyan');

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  log(`\n❌ 检查过程出错: ${error.message}\n`, 'red');
  process.exit(1);
});
