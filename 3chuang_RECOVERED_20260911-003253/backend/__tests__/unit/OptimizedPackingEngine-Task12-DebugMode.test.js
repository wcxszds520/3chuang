/**
 * Task 12: 算法可追溯性（调试模式）测试
 * 
 * 测试目标：
 * - 验证调试日志记录功能（需求 9.1, 9.2, 9.3, 9.4）
 * - 验证调试模式开关（需求 9.5）
 */

const OptimizedPackingEngine = require('../../services/OptimizedPackingEngine');

describe('Task 12: 算法可追溯性（调试模式）', () => {
  let engine;

  beforeEach(() => {
    engine = new OptimizedPackingEngine();
  });

  describe('12.1 调试日志记录', () => {
    test('应该记录货物放置决策 - 需求 9.1', async () => {
      const cargoList = [
        {
          cargoId: 'C1',
          name: '测试货物1',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3,
          canInvert: true,
          canLayFlat: true
        }
      ];

      const containerType = engine.STANDARD_CONTAINER_TYPES['20GP'];

      const plan = await engine.generatePackingPlan(cargoList, containerType, { debugMode: true });

      // 验证调试日志存在
      expect(plan.debugLogs).toBeDefined();
      expect(Array.isArray(plan.debugLogs)).toBe(true);
      expect(plan.debugLogs.length).toBeGreaterThan(0);

      // 验证包含放置决策日志
      const placementLogs = plan.debugLogs.filter(log => log.phase === 'PLACEMENT');
      expect(placementLogs.length).toBeGreaterThan(0);

      // 验证放置日志包含必要信息
      const placementLog = placementLogs[0];
      expect(placementLog.timestamp).toBeDefined();
      expect(placementLog.level).toBeDefined();
      expect(placementLog.message).toBeDefined();
      expect(placementLog.data).toBeDefined();
      expect(placementLog.data.cargoId).toBeDefined();
      expect(placementLog.data.position).toBeDefined();
      expect(placementLog.data.success).toBeDefined();
      expect(placementLog.data.reason).toBeDefined();
    });

    test('应该记录尝试的位置和选择原因 - 需求 9.2', async () => {
      const cargoList = Array.from({ length: 10 }, (_, i) => ({
        cargoId: `C${i}`,
        name: `货物${i}`,
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1,
        stackable: true,
        maxStackLayers: 2,
        canInvert: true,
        canLayFlat: true
      }));

      const containerType = engine.STANDARD_CONTAINER_TYPES['20GP'];

      const plan = await engine.generatePackingPlan(cargoList, containerType, { debugMode: true });

      // 验证包含位置搜索日志
      const positionSearchLogs = plan.debugLogs.filter(log => log.phase === 'POSITION_SEARCH');
      
      // 如果货物无法放置，应该有位置搜索日志
      if (plan.unloadedCargo.length > 0) {
        expect(positionSearchLogs.length).toBeGreaterThan(0);
        
        const searchLog = positionSearchLogs[0];
        expect(searchLog.data.attemptedCount).toBeDefined();
        expect(searchLog.data.attemptedPositions).toBeDefined();
        expect(searchLog.data.selectionReason).toBeDefined();
      }
    });

    test('应该记录限制因素 - 需求 9.3', async () => {
      const cargoList = Array.from({ length: 100 }, (_, i) => ({
        cargoId: `C${i}`,
        name: `货物${i}`,
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: true,
        canLayFlat: true
      }));

      const containerType = engine.STANDARD_CONTAINER_TYPES['20GP'];

      const plan = await engine.generatePackingPlan(cargoList, containerType, { debugMode: true });

      // 验证包含限制因素日志
      const limitationLogs = plan.debugLogs.filter(log => log.phase === 'LIMITATION');
      
      // 应该记录未达到目标利用率的限制因素
      if (plan.spaceUtilization < 90) {
        expect(limitationLogs.length).toBeGreaterThan(0);
        
        const limitationLog = limitationLogs.find(log => 
          log.message.includes('未达到目标空间利用率')
        );
        expect(limitationLog).toBeDefined();
        expect(limitationLog.data.actualUtilization).toBeDefined();
        expect(limitationLog.data.targetUtilization).toBe(90);
      }
    });

    test('应该记录算法执行的关键步骤和时间戳 - 需求 9.4', async () => {
      const cargoList = [
        {
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3,
          canInvert: true,
          canLayFlat: true
        }
      ];

      const containerType = engine.STANDARD_CONTAINER_TYPES['20GP'];

      const plan = await engine.generatePackingPlan(cargoList, containerType, { debugMode: true });

      // 验证包含算法步骤日志
      const algorithmLogs = plan.debugLogs.filter(log => log.phase === 'ALGORITHM');
      expect(algorithmLogs.length).toBeGreaterThan(0);

      // 验证关键步骤
      const stepNames = algorithmLogs.map(log => log.message);
      expect(stepNames).toContain('执行步骤: 算法启动');
      expect(stepNames).toContain('执行步骤: 柜型参数验证');
      expect(stepNames).toContain('执行步骤: AI策略优化');
      expect(stepNames).toContain('执行步骤: 货物排序');
      expect(stepNames).toContain('执行步骤: Guillotine装箱阶段');
      expect(stepNames).toContain('执行步骤: 算法完成');

      // 验证时间戳格式
      algorithmLogs.forEach(log => {
        expect(log.timestamp).toMatch(/^\d+\.\d{3}s$/);
      });
    });
  });

  describe('12.2 调试模式开关', () => {
    test('当debugMode=false时不应包含调试日志 - 需求 9.5', async () => {
      const cargoList = [
        {
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3,
          canInvert: true,
          canLayFlat: true
        }
      ];

      const containerType = engine.STANDARD_CONTAINER_TYPES['20GP'];

      const plan = await engine.generatePackingPlan(cargoList, containerType, { debugMode: false });

      // 验证不包含调试日志
      expect(plan.debugLogs).toBeUndefined();
      expect(plan.debugSummary).toBeUndefined();
    });

    test('当debugMode=true时应包含调试日志和摘要 - 需求 9.5', async () => {
      const cargoList = [
        {
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3,
          canInvert: true,
          canLayFlat: true
        }
      ];

      const containerType = engine.STANDARD_CONTAINER_TYPES['20GP'];

      const plan = await engine.generatePackingPlan(cargoList, containerType, { debugMode: true });

      // 验证包含调试日志
      expect(plan.debugLogs).toBeDefined();
      expect(Array.isArray(plan.debugLogs)).toBe(true);
      expect(plan.debugLogs.length).toBeGreaterThan(0);

      // 验证包含调试摘要
      expect(plan.debugSummary).toBeDefined();
      expect(plan.debugSummary.totalLogs).toBe(plan.debugLogs.length);
      expect(plan.debugSummary.byLevel).toBeDefined();
      expect(plan.debugSummary.byPhase).toBeDefined();
      expect(plan.debugSummary.placementAttempts).toBeDefined();
      expect(plan.debugSummary.placementSuccesses).toBeDefined();
      expect(plan.debugSummary.placementFailures).toBeDefined();
      expect(plan.debugSummary.limitingFactors).toBeDefined();
    });

    test('默认情况下（不传options）应该不启用调试模式', async () => {
      const cargoList = [
        {
          cargoId: 'C1',
          name: '测试货物',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3,
          canInvert: true,
          canLayFlat: true
        }
      ];

      const containerType = engine.STANDARD_CONTAINER_TYPES['20GP'];

      const plan = await engine.generatePackingPlan(cargoList, containerType);

      // 验证不包含调试日志
      expect(plan.debugLogs).toBeUndefined();
      expect(plan.debugSummary).toBeUndefined();
    });

    test('调试摘要应该正确统计各类日志', async () => {
      const cargoList = [
        {
          cargoId: 'C1',
          name: '货物1',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3,
          canInvert: true,
          canLayFlat: true
        },
        {
          cargoId: 'C2',
          name: '货物2',
          length: 1000,
          width: 1000,
          height: 1000,
          weight: 100,
          quantity: 1,
          stackable: true,
          maxStackLayers: 3,
          canInvert: true,
          canLayFlat: true
        }
      ];

      const containerType = engine.STANDARD_CONTAINER_TYPES['20GP'];

      const plan = await engine.generatePackingPlan(cargoList, containerType, { debugMode: true });

      const summary = plan.debugSummary;

      // 验证统计数据
      expect(summary.totalLogs).toBeGreaterThan(0);
      
      // 验证按级别统计
      const totalByLevel = Object.values(summary.byLevel).reduce((sum, count) => sum + count, 0);
      expect(totalByLevel).toBe(summary.totalLogs);

      // 验证按阶段统计
      const totalByPhase = Object.values(summary.byPhase).reduce((sum, count) => sum + count, 0);
      expect(totalByPhase).toBe(summary.totalLogs);

      // 验证放置统计
      expect(summary.placementAttempts).toBe(summary.placementSuccesses + summary.placementFailures);
    });
  });

  describe('调试日志内容验证', () => {
    test('调试日志应该包含完整的货物信息', async () => {
      const cargoList = [
        {
          cargoId: 'TEST-001',
          name: '测试货物A',
          length: 1200,
          width: 800,
          height: 600,
          weight: 150,
          quantity: 1,
          stackable: true,
          maxStackLayers: 4,
          canInvert: true,
          canLayFlat: true
        }
      ];

      const containerType = engine.STANDARD_CONTAINER_TYPES['20GP'];

      const plan = await engine.generatePackingPlan(cargoList, containerType, { debugMode: true });

      const placementLogs = plan.debugLogs.filter(log => log.phase === 'PLACEMENT');
      expect(placementLogs.length).toBeGreaterThan(0);

      const log = placementLogs[0];
      expect(log.data.cargoId).toBe('TEST-001');
      expect(log.data.cargoName).toBe('测试货物A');
      expect(log.data.dimensions).toEqual({
        length: 1200,
        width: 800,
        height: 600
      });
    });

    test('调试日志应该记录优化过程', async () => {
      const cargoList = Array.from({ length: 5 }, (_, i) => ({
        cargoId: `C${i}`,
        name: `货物${i}`,
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 100,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        canInvert: true,
        canLayFlat: true
      }));

      const containerType = engine.STANDARD_CONTAINER_TYPES['20GP'];

      const plan = await engine.generatePackingPlan(cargoList, containerType, { debugMode: true });

      // 验证包含优化日志
      const optimizationLogs = plan.debugLogs.filter(log => log.phase === 'OPTIMIZATION');
      
      // 应该有局部优化完成的日志
      const completionLog = optimizationLogs.find(log => 
        log.message.includes('局部优化完成')
      );
      
      if (completionLog) {
        expect(completionLog.data.swapImprovements).toBeDefined();
        expect(completionLog.data.rotationImprovements).toBeDefined();
        expect(completionLog.data.initialUtilization).toBeDefined();
        expect(completionLog.data.finalUtilization).toBeDefined();
      }
    });
  });
});
