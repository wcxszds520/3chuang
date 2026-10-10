/**
 * 调试装箱API响应数据结构
 */

const axios = require('axios');
const demoTemplates = require('../config/demo-cargo-templates');

async function debugResponse() {
  try {
    const cargoList = demoTemplates.europeRoute3Batches;
    
    const response = await axios.post('http://localhost:3000/api/packing/generate', {
      cargoList: cargoList,
      containerType: '40HQ'
    });
    
    const plan = response.data.data;
    
    console.log('=== 响应数据结构 ===\n');
    console.log('顶层字段:', Object.keys(plan));
    console.log('\nloadedCargo数量:', plan.loadedCargo.length);
    console.log('\n第1个loadedCargo结构:');
    console.log(JSON.stringify(plan.loadedCargo[0], null, 2));
    
  } catch (error) {
    console.error('错误:', error.message);
  }
}

debugResponse();
