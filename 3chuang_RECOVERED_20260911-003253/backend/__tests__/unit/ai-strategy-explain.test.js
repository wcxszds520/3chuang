/**
 * AI策略建议与结果解释 - 单元测试
 * 
 * 测试 AIPackingService 的 generateStrategy() 和 explainResult() 方法
 */

const AIPackingService = require('../../services/AIPackingService');

// Mock axios to avoid real API calls
jest.mock('axios');
const axios = require('axios');

describe('AIPackingService - generateStrategy', () => {
  let service;

  beforeEach(() => {
    service = new AIPackingService();
    jest.clearAllMocks();
  });

  const mockCargoList = [
    { name: '空气炸锅', length: 400, width: 350, height: 300, weight: 5, quantity: 20, stackable: true, maxStackLayers: 4 },
    { name: '取暖器', length: 600, width: 400, height: 500, weight: 8, quantity: 10, stackable: true, maxStackLayers: 3 }
  ];

  const mockContainer = {
    typeId: '20GP',
    name: '20尺标准柜',
    innerLength: 5898,
    innerWidth: 2352,
    innerHeight: 2393,
    maxWeight: 26000
  };

  test('should return AI strategy when API succeeds', async () => {
    service.apiKey = 'test-key';
    axios.post.mockResolvedValue({
      data: {
        choices: [{
          message: {
            content: '{"strategy":"重量优先+体积填充","sortSuggestion":"重货先装底部","reasoning":"重货打底保证稳定","expectedUtilization":"70-85%"}'
          }
        }]
      }
    });

    const result = await service.generateStrategy(mockCargoList, mockContainer);

    expect(result.fallback).toBe(false);
    expect(result.strategy).toBeDefined();
    expect(result.algorithmId).toBeDefined();
    expect(result.sortStrategy).toBeDefined();
    expect(result.reason).toBeDefined();
    expect(result.sortSuggestion).toBeDefined();
    expect(result.reasoning).toBeDefined();
    expect(result.expectedUtilization).toBeDefined();
  });

  test('should fallback to local strategy when API fails', async () => {
    service.apiKey = 'test-key';
    axios.post.mockRejectedValue(new Error('Network error'));

    const result = await service.generateStrategy(mockCargoList, mockContainer);

    expect(result.fallback).toBe(true);
    expect(result.strategy).toBeDefined();
    expect(result.sortSuggestion).toBeDefined();
    expect(result.reasoning).toBeDefined();
    expect(result.strategy.length).toBeGreaterThan(0);
  });

  test('should fallback when API key is not configured', async () => {
    delete process.env.AI_API_KEY;
    service.apiKey = '';

    const result = await service.generateStrategy(mockCargoList, mockContainer);

    expect(result.fallback).toBe(true);
    expect(result.strategy).toBeDefined();
  });

  test('local fallback detects heavy cargo scenario', async () => {
    service.apiKey = '';
    // Heavy cargo with high volume ratio to trigger the heavy+high-volume branch
    const heavyCargo = [
      { name: '重型设备', length: 2000, width: 1500, height: 1200, weight: 200, quantity: 10, stackable: true, maxStackLayers: 2 }
    ];

    const result = await service.generateStrategy(heavyCargo, mockContainer);

    expect(result.fallback).toBe(true);
    // Should detect heavy cargo with high volume
    expect(result.strategy).toContain('重量');
  });

  test('local fallback detects non-stackable scenario', async () => {
    service.apiKey = '';
    const nonStackable = [
      { name: '电风扇', length: 400, width: 400, height: 500, weight: 3, quantity: 10, stackable: false }
    ];

    const result = await service.generateStrategy(nonStackable, mockContainer);

    expect(result.fallback).toBe(true);
    expect(result.strategy).toContain('堆叠');
  });

  test('local fallback includes algorithmId', async () => {
    service.apiKey = '';
    const result = await service.generateStrategy(mockCargoList, mockContainer);

    expect(result.fallback).toBe(true);
    expect(result.algorithmId).toBeDefined();
    expect(result.algorithmId).toMatch(/^realistic4d/);
    expect(result.sortStrategy).toBeDefined();
    expect(result.reason).toBeDefined();
  });

  test('should timeout after 8 seconds and fallback', async () => {
    service.apiKey = 'test-key';
    // Simulate a slow API that takes longer than 8 seconds
    axios.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 9000)));

    const startTime = Date.now();
    const result = await service.generateStrategy(mockCargoList, mockContainer);
    const elapsed = Date.now() - startTime;

    expect(result.fallback).toBe(true);
    // Should timeout around 8 seconds, not wait for the full 9 seconds
    expect(elapsed).toBeLessThan(8500);
  }, 10000);
});

describe('AIPackingService - explainResult', () => {
  let service;

  beforeEach(() => {
    service = new AIPackingService();
    jest.clearAllMocks();
  });

  const mockPackingResult = {
    loadedCargo: new Array(15).fill({ name: '货物', position: { x: 0, y: 0, z: 0 } }),
    unloadedCargo: [{ name: '未装入货物' }],
    spaceUtilization: 78.5,
    totalWeight: 12500,
    algorithm: 'AI+智能优化算法'
  };

  test('should return AI explanation when API succeeds', async () => {
    service.apiKey = 'test-key';
    axios.post.mockResolvedValue({
      data: {
        choices: [{
          message: {
            content: '{"explanation":"本方案采用体积优先策略，利用率78.5%表现良好，1件未装入因空间限制。","highlights":["利用率78.5%","装入15件"],"risks":["1件未装入"]}'
          }
        }]
      }
    });

    const result = await service.explainResult(mockPackingResult);

    expect(result.fallback).toBe(false);
    expect(result.explanation).toBeDefined();
    expect(result.explanation.length).toBeLessThanOrEqual(200);
    expect(result.highlights).toBeInstanceOf(Array);
    expect(result.risks).toBeInstanceOf(Array);
  });

  test('should fallback to local template when API fails', async () => {
    service.apiKey = 'test-key';
    axios.post.mockRejectedValue(new Error('Timeout'));

    const result = await service.explainResult(mockPackingResult);

    expect(result.fallback).toBe(true);
    expect(result.explanation).toBeDefined();
    expect(result.explanation.length).toBeLessThanOrEqual(200);
    expect(result.explanation).toContain('78.5');
    expect(result.explanation).toContain('15');
  });

  test('local explanation includes risk when utilization is low', async () => {
    service.apiKey = '';
    const lowUtilResult = {
      loadedCargo: new Array(5).fill({}),
      unloadedCargo: [],
      spaceUtilization: 45.2,
      totalWeight: 3000,
      algorithm: '智能算法'
    };

    const result = await service.explainResult(lowUtilResult);

    expect(result.fallback).toBe(true);
    expect(result.risks).toContain('空间利用率偏低');
  });

  test('local explanation mentions unloaded cargo', async () => {
    service.apiKey = '';
    const partialResult = {
      loadedCargo: new Array(10).fill({}),
      unloadedCargo: new Array(3).fill({}),
      spaceUtilization: 72.0,
      totalWeight: 8000,
      algorithm: '分层装载'
    };

    const result = await service.explainResult(partialResult);

    expect(result.fallback).toBe(true);
    expect(result.explanation).toContain('3');
    expect(result.risks).toContain('3件货物未能装入');
  });

  test('handles empty packing result gracefully', async () => {
    service.apiKey = '';
    const emptyResult = {
      loadedCargo: [],
      unloadedCargo: [],
      spaceUtilization: 0,
      totalWeight: 0,
      algorithm: ''
    };

    const result = await service.explainResult(emptyResult);

    expect(result.fallback).toBe(true);
    expect(result.explanation).toBeDefined();
  });
});
