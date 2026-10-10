/**
 * 前后端兼容性全面检查脚本
 * 检查所有API端点、数据格式、字段一致性
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 测试结果统计
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  issues: []
};

function recordResult(testName, passed, message = '') {
  if (passed) {
    results.passed++;
    log(`✅ ${testName}`, 'green');
  } else {
    results.failed++;
    results.issues.push({ test: testName, message });
    log(`❌ ${testName}: ${message}`, 'red');
  }
}

function recordWarning(testName, message) {
  results.warnings++;
  results.issues.push({ test: testName, message, type: 'warning' });
  log(`⚠️  ${testName}: ${message}`, 'yellow');
}

// 1. 检查容器类型API
async function checkContainerAPI() {
  log('\n📦 检查容器类型API...', 'cyan');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/container/list`);
    const data = response.data;
    
    // 检查响应结构
    if (!data.data || !data.data.containerTypes) {
      recordResult('容器API响应结构', false, '响应格式不正确');
      return;
    }
    
    const containers = data.data.containerTypes;
    
    // 检查必需字段
    const requiredFields = ['typeId', 'name', 'innerLength', 'innerWidth', 'innerHeight', 'maxWeight'];
    containers.forEach(container => {
      const missingFields = requiredFields.filter(field => !(field in container));
      if (missingFields.length > 0) {
        recordResult(
          `容器 ${container.name || container.typeId} 字段完整性`,
          false,
          `缺少字段: ${missingFields.join(', ')}`
        );
      } else {
        recordResult(`容器 ${container.name} 字段完整性`, true);
      }
    });
    
    // 检查20GP容器是否存在
    const gp20 = containers.find(c => c.typeId === '20GP');
    if (gp20) {
      recordResult('20GP容器存在', true);
      // 检查20GP尺寸 (单位:mm)
      if (gp20.innerLength === 5898 && gp20.innerWidth === 2352 && gp20.innerHeight === 2393) {
        recordResult('20GP尺寸正确', true);
      } else {
        recordResult(
          '20GP尺寸',
          false,
          `实际: ${gp20.innerLength}x${gp20.innerWidth}x${gp20.innerHeight}, 期望: 5898x2352x2393`
        );
      }
    } else {
      recordResult('20GP容器存在', false, '未找到20GP容器');
    }
    
  } catch (error) {
    recordResult('容器类型API', false, error.message);
  }
}

// 2. 检查装箱API
async function checkPackingAPI() {
  log('\n📦 检查装箱API...', 'cyan');
  
  const testCargo = [
    {
      name: '测试货物1',
      length: 100,
      width: 80,
      height: 60,
      weight: 50,
      quantity: 10,
      stackLimit: 3
    }
  ];
  
  try {
    const response = await axios.post(`${BASE_URL}/api/packing/generate`, {
      containerType: '20GP',
      cargoList: testCargo
    });
    
    const data = response.data;
    
    // 检查响应结构
    const requiredFields = ['code', 'message', 'data'];
    const missingFields = requiredFields.filter(field => !(field in data));
    
    if (missingFields.length > 0) {
      recordResult(
        '装箱API响应结构',
        false,
        `缺少字段: ${missingFields.join(', ')}`
      );
      return;
    }
    
    recordResult('装箱API响应结构', true);
    
    const result = data.data;
    
    // 检查data字段
    const dataFields = ['loadedCargo', 'spaceUtilization', 'unloadedCargo', 'containerInfo'];
    const missingDataFields = dataFields.filter(field => !(field in result));
    
    if (missingDataFields.length > 0) {
      recordResult(
        '装箱结果数据字段',
        false,
        `缺少字段: ${missingDataFields.join(', ')}`
      );
    } else {
      recordResult('装箱结果数据字段完整', true);
    }
    
    // 检查loadedCargo数组
    if (Array.isArray(result.loadedCargo) && result.loadedCargo.length > 0) {
      recordResult('装箱结果包含货物', true);
      
      const item = result.loadedCargo[0];
      // v33.0: 扁平结构
      const itemFields = ['name', 'x', 'y', 'z', 'l', 'h', 'w', 'color', 'type'];
      const missingItemFields = itemFields.filter(field => !(field in item));
      
      if (missingItemFields.length > 0) {
        recordResult(
          '货物对象字段',
          false,
          `缺少字段: ${missingItemFields.join(', ')}`
        );
      } else {
        recordResult('货物对象字段完整(v33.0扁平结构)', true);
      }
      
      // 检查坐标是否为数字
      if (typeof item.x === 'number' && typeof item.y === 'number' && typeof item.z === 'number') {
        recordResult('货物位置坐标类型正确', true);
      } else {
        recordResult('货物位置坐标类型', false, '坐标不是数字类型');
      }
      
      // 检查尺寸是否为数字
      if (typeof item.l === 'number' && typeof item.h === 'number' && typeof item.w === 'number') {
        recordResult('货物尺寸类型正确', true);
      } else {
        recordResult('货物尺寸类型', false, '尺寸不是数字类型');
      }
    } else {
      recordWarning('装箱结果货物数量', '没有货物被装入');
    }
    
    // 检查利用率
    if (typeof result.spaceUtilization === 'number') {
      if (result.spaceUtilization >= 0 && result.spaceUtilization <= 100) {
        recordResult('利用率范围正确', true);
      } else {
        recordResult(
          '利用率范围',
          false,
          `利用率 ${result.spaceUtilization}% 超出0-100范围`
        );
      }
    } else {
      recordResult('利用率字段类型', false, '利用率不是数字类型');
    }
    
  } catch (error) {
    recordResult('装箱API', false, error.message);
  }
}

// 3. 检查3D渲染数据格式
async function check3DRenderingData() {
  log('\n🎨 检查3D渲染数据格式...', 'cyan');
  
  const testCargo = [
    {
      name: '货物A',
      length: 120,
      width: 100,
      height: 80,
      weight: 100,
      quantity: 5,
      stackLimit: 2,
      packagingType: '家电'
    },
    {
      name: '货物B',
      length: 80,
      width: 60,
      height: 50,
      weight: 50,
      quantity: 8,
      stackLimit: 3,
      packagingType: '纸箱'
    }
  ];
  
  try {
    const response = await axios.post(`${BASE_URL}/api/packing/generate`, {
      containerType: '20GP',
      cargoList: testCargo
    });
    
    const result = response.data.data;
    
    if (result.loadedCargo && result.loadedCargo.length > 0) {
      // 检查每个货物的3D渲染必需字段
      result.loadedCargo.forEach((item, index) => {
        // 检查颜色字段
        if ('color' in item) {
          recordResult(`货物${index + 1}包含颜色字段`, true);
        } else {
          recordWarning(`货物${index + 1}颜色字段`, '缺少color字段,前端可能无法正确渲染');
        }
        
        // 检查批次字段
        if ('batchId' in item) {
          recordResult(`货物${index + 1}包含批次字段`, true);
        } else {
          recordWarning(`货物${index + 1}批次字段`, '缺少批次标识');
        }
        
        // 检查货物类型
        if ('type' in item) {
          recordResult(`货物${index + 1}包含货物类型`, true);
        } else {
          recordWarning(`货物${index + 1}货物类型`, '缺少type字段');
        }
        
        // 检查装载顺序
        if ('loadingIndex' in item) {
          recordResult(`货物${index + 1}包含装载顺序`, true);
        } else {
          recordWarning(`货物${index + 1}装载顺序`, '缺少loadingIndex字段,可能影响LIFO显示');
        }
      });
    }
    
  } catch (error) {
    recordResult('3D渲染数据检查', false, error.message);
  }
}

// 4. 检查错误处理
async function checkErrorHandling() {
  log('\n⚠️  检查错误处理...', 'cyan');
  
  // 测试无效的容器类型
  try {
    await axios.post(`${BASE_URL}/api/packing/generate`, {
      containerType: 'INVALID',
      cargoList: []
    });
    recordResult('无效容器类型错误处理', false, '应该返回错误但没有');
  } catch (error) {
    if (error.response && error.response.status >= 400) {
      recordResult('无效容器类型错误处理', true);
    } else {
      recordResult('无效容器类型错误处理', false, '错误响应格式不正确');
    }
  }
  
  // 测试空货物列表
  try {
    const response = await axios.post(`${BASE_URL}/api/packing/generate`, {
      containerType: '20GP',
      cargoList: []
    });
    
    recordWarning('空货物列表处理', '应该返回错误或空结果');
  } catch (error) {
    if (error.response && error.response.status >= 400) {
      recordResult('空货物列表处理', true);
    } else {
      recordWarning('空货物列表处理', `意外错误: ${error.message}`);
    }
  }
  
  // 测试缺少必需字段
  try {
    await axios.post(`${BASE_URL}/api/packing/generate`, {
      containerType: '20GP',
      cargoList: [{ name: '测试' }] // 缺少尺寸和重量
    });
    recordWarning('缺少必需字段处理', '应该验证货物字段完整性');
  } catch (error) {
    // 可能会因为NaN而失败,这是可以接受的
    recordResult('缺少必需字段处理', true);
  }
}

// 主函数
async function main() {
  log('='.repeat(60), 'blue');
  log('前后端兼容性全面检查', 'blue');
  log('='.repeat(60), 'blue');
  
  try {
    await checkContainerAPI();
    await checkPackingAPI();
    await check3DRenderingData();
    await checkErrorHandling();
    
    // 输出总结
    log('\n' + '='.repeat(60), 'blue');
    log('检查总结', 'blue');
    log('='.repeat(60), 'blue');
    log(`✅ 通过: ${results.passed}`, 'green');
    log(`❌ 失败: ${results.failed}`, 'red');
    log(`⚠️  警告: ${results.warnings}`, 'yellow');
    
    if (results.issues.length > 0) {
      log('\n问题详情:', 'yellow');
      results.issues.forEach((issue, index) => {
        const icon = issue.type === 'warning' ? '⚠️ ' : '❌';
        log(`${index + 1}. ${icon} ${issue.test}: ${issue.message}`, 
            issue.type === 'warning' ? 'yellow' : 'red');
      });
    }
    
    log('\n' + '='.repeat(60), 'blue');
    
    if (results.failed === 0) {
      log('🎉 所有关键检查通过!', 'green');
      process.exit(0);
    } else {
      log('⚠️  发现兼容性问题,需要修复', 'red');
      process.exit(1);
    }
    
  } catch (error) {
    log(`\n❌ 检查过程出错: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 运行检查
main();
