/**
 * 快速AI测试脚本 - 一键测试AI功能
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function quickTest() {
  console.log('\n🚀 快速AI功能测试\n');
  
  // 测试1: AI货物识别
  console.log('【测试1】AI货物识别');
  try {
    const res1 = await axios.post(`${BASE_URL}/ai-packing/recognize-cargo`, {
      name: '空气炸锅',
      length: 300,
      width: 300,
      height: 350,
      weight: 5
    });
    console.log('✅ AI识别成功:', res1.data.data);
  } catch (e) {
    console.log('❌ 失败:', e.response?.data?.message || e.message);
  }
  
  console.log('\n【测试2】AI优化装箱');
  try {
    const res2 = await axios.post(`${BASE_URL}/ai-packing/generate`, {
      cargoList: [
        {
          name: '空气炸锅',
          length: 300,
          width: 300,
          height: 350,
          weight: 5,
          quantity: 100,
          stackable: true,
          maxStackLayers: 4,
          canInvert: false,
          canLayFlat: false
        }
      ],
      containerType: '40HQ'
    });
    console.log('✅ 装箱成功!');
    console.log(`   空间利用率: ${res2.data.data.spaceUtilization.toFixed(2)}%`);
    console.log(`   装载数量: ${res2.data.data.totalCargoCount}件`);
    console.log(`   方案ID: ${res2.data.data.planId}`);
  } catch (e) {
    console.log('❌ 失败:', e.response?.data?.message || e.message);
  }
  
  console.log('\n✅ 测试完成!\n');
}

quickTest();
