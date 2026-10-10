/**
 * 路演演示测试用例 - AI+3D装箱混合算法
 * 
 * 测试目标：
 * 1. 验证慈溪小家电标准测试用例达到92%+空间利用率
 * 2. 验证10秒内完成方案生成
 * 3. 验证AI优化效果（对比传统算法）
 * 4. 验证合规校验功能
 * 5. 验证路演讲解生成
 * 
 * 路演演示流程：
 * Step 1: 展示传统算法效果（40%利用率）
 * Step 2: 展示AI优化算法效果（92%+利用率）
 * Step 3: 展示对比报告（提升52%）
 * Step 4: 展示合规校验报告
 * Step 5: AI生成路演讲解话术
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../config/database');

describe('路演演示 - AI装箱算法', () => {
  // 标准测试用例：慈溪小家电
  const standardTestCase = {
    containerType: '40HQ',
    cargoList: [
      {
        name: '空气炸锅',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200,
        stackable: true,
        maxStackLayers: 4,
        canInvert: false,
        canLayFlat: false
      },
      {
        name: '取暖器',
        length: 500,
        width: 400,
        height: 600,
        weight: 8,
        quantity: 100,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false
      },
      {
        name: '电风扇',
        length: 400,
        width: 400,
        height: 1200,
        weight: 6,
        quantity: 80,
        stackable: false,
        maxStackLayers: 1,
        canInvert: false,
        canLayFlat: true
      }
    ]
  };

  describe('【演示1】传统算法 vs AI优化算法对比', () => {
    test('应该展示AI算法显著优于传统算法', async () => {
      const response = await request(app)
        .post('/api/ai-packing/compare')
        .send(standardTestCase)
        .expect(200);

      expect(response.body.success).toBe(true);
      const report = response.body.data;

      console.log('\n=== 路演演示：算法对比 ===');
      console.log(`传统算法: ${report.traditional.spaceUtilization}% (${report.traditional.executionTime}秒)`);
      console.log(`AI优化算法: ${report.aiOptimized.spaceUtilization}% (${report.aiOptimized.executionTime}秒)`);
      console.log(`提升效果: ${report.improvement.summary}`);
      console.log('========================\n');

      // 验证AI算法达到目标
      expect(report.aiOptimized.spaceUtilization).toBeGreaterThanOrEqual(92);
      expect(report.aiOptimized.executionTime).toBeLessThan(10);
      
      // 验证AI算法优于传统算法
      expect(report.aiOptimized.spaceUtilization).toBeGreaterThan(report.traditional.spaceUtilization);
      expect(report.improvement.spaceUtilizationDiff).toBeGreaterThan(0);
    }, 30000); // 30秒超时
  });

  describe('【演示2】AI优化装箱方案生成', () => {
    let planId;

    test('应该在10秒内生成92%+利用率的方案', async () => {
      const response = await request(app)
        .post('/api/ai-packing/generate')
        .send(standardTestCase)
        .expect(200);

      expect(response.body.success).toBe(true);
      const plan = response.body.data;
      planId = plan.planId;

      console.log('\n=== 路演演示：AI优化方案 ===');
      console.log(`方案ID: ${plan.planId}`);
      console.log(`空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
      console.log(`已装载: ${plan.totalCargoCount}件`);
      console.log(`总重量: ${plan.totalWeight.toFixed(2)}kg`);
      console.log(`耗时: ${plan.executionTime}秒`);
      console.log('========================\n');

      // 验证核心指标
      expect(plan.spaceUtilization).toBeGreaterThanOrEqual(92);
      expect(plan.executionTime).toBeLessThan(10);
      expect(plan.totalCargoCount).toBeGreaterThan(0);
    }, 15000);

    test('应该通过合规校验', async () => {
      const response = await request(app)
        .post('/api/ai-packing/validate-compliance')
        .send({ planId })
        .expect(200);

      expect(response.body.success).toBe(true);
      const report = response.body.data;

      console.log('\n=== 路演演示：合规校验 ===');
      console.log(`合规等级: ${report.complianceLevel}`);
      console.log(`综合评分: ${report.overallScore}分`);
      console.log(`风险点数量: ${report.risks.length}`);
      if (report.risks.length > 0) {
        console.log('风险详情:');
        report.risks.forEach((risk, i) => {
          console.log(`  ${i + 1}. ${risk.type}: ${risk.description}`);
          console.log(`     建议: ${risk.suggestion}`);
        });
      }
      console.log('========================\n');

      // 验证合规性
      expect(['excellent', 'good', 'warning']).toContain(report.complianceLevel);
      expect(report.overallScore).toBeGreaterThanOrEqual(60);
    }, 10000);

    test('应该生成路演讲解话术', async () => {
      const response = await request(app)
        .post('/api/ai-packing/generate-presentation')
        .send({ planId })
        .expect(200);

      expect(response.body.success).toBe(true);
      const data = response.body.data;

      console.log('\n=== 路演演示：AI讲解话术 ===');
      console.log(data.presentation);
      console.log('========================\n');

      // 验证话术质量
      expect(data.presentation).toBeTruthy();
      expect(data.presentation.length).toBeGreaterThan(50);
      expect(data.presentation.length).toBeLessThan(500); // 约1分钟
    }, 10000);
  });

  describe('【演示3】AI货物属性识别', () => {
    test('应该准确识别宁波港高频货型', async () => {
      const testCargos = [
        { name: '空气炸锅', length: 300, width: 300, height: 350, weight: 5 },
        { name: '取暖器', length: 500, width: 400, height: 600, weight: 8 },
        { name: '电风扇', length: 400, width: 400, height: 1200, weight: 6 }
      ];

      console.log('\n=== 路演演示：AI货物识别 ===');
      
      for (const cargo of testCargos) {
        const response = await request(app)
          .post('/api/ai-packing/recognize-cargo')
          .send(cargo)
          .expect(200);

        expect(response.body.success).toBe(true);
        const attributes = response.body.data;

        console.log(`${cargo.name}:`);
        console.log(`  可堆叠: ${attributes.stackable}`);
        console.log(`  最大堆叠层数: ${attributes.maxStackLayers}`);
        console.log(`  可倒置: ${attributes.canInvert}`);
        console.log(`  可侧放: ${attributes.canLayFlat}`);
        
        // 验证属性合理性
        expect(typeof attributes.stackable).toBe('boolean');
        expect(attributes.maxStackLayers).toBeGreaterThan(0);
        expect(attributes.maxStackLayers).toBeLessThanOrEqual(10);
      }
      
      console.log('========================\n');
    }, 15000);
  });
});
