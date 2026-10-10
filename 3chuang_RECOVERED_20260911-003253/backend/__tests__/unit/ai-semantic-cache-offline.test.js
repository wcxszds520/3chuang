/**
 * AI 语义缓存与离线降级测试
 * 
 * 验证 Requirements: 4.4, 4.7, 13.4
 * - 4.4: 相同业务输入命中语义缓存，100ms 内返回
 * - 4.7: Demo_Mode 离线模式使用预录响应
 * - 13.4: 断网时自动切换离线响应，返回 fallback = true
 */

const AIPackingService = require('../../services/AIPackingService');
const { inferDatasetType, getOfflineRecommendation, getOfflineExplanation, getOfflineStrategy } = require('../../config/ai-offline-responses');

describe('AIPackingService - 语义缓存', () => {
  let service;

  beforeEach(() => {
    service = new AIPackingService();
  });

  describe('computeCargoHash', () => {
    test('相同货物列表产生相同 hash', () => {
      const cargoList = [
        { name: '空气炸锅', length: 400, width: 350, height: 300, weight: 5.5, quantity: 100 },
        { name: '取暖器', length: 500, width: 400, height: 350, weight: 8, quantity: 80 }
      ];
      const hash1 = service.computeCargoHash(cargoList);
      const hash2 = service.computeCargoHash(cargoList);
      expect(hash1).toBe(hash2);
    });

    test('不同顺序的相同货物列表产生相同 hash（排序无关）', () => {
      const cargoList1 = [
        { name: '空气炸锅', length: 400, width: 350, height: 300, weight: 5.5, quantity: 100 },
        { name: '取暖器', length: 500, width: 400, height: 350, weight: 8, quantity: 80 }
      ];
      const cargoList2 = [
        { name: '取暖器', length: 500, width: 400, height: 350, weight: 8, quantity: 80 },
        { name: '空气炸锅', length: 400, width: 350, height: 300, weight: 5.5, quantity: 100 }
      ];
      expect(service.computeCargoHash(cargoList1)).toBe(service.computeCargoHash(cargoList2));
    });

    test('不同货物列表产生不同 hash', () => {
      const cargoList1 = [
        { name: '空气炸锅', length: 400, width: 350, height: 300, weight: 5.5, quantity: 100 }
      ];
      const cargoList2 = [
        { name: '取暖器', length: 500, width: 400, height: 350, weight: 8, quantity: 80 }
      ];
      expect(service.computeCargoHash(cargoList1)).not.toBe(service.computeCargoHash(cargoList2));
    });

    test('空列表返回 "empty"', () => {
      expect(service.computeCargoHash([])).toBe('empty');
      expect(service.computeCargoHash(null)).toBe('empty');
    });

    test('hash 为 32 位 MD5 hex 字符串', () => {
      const hash = service.computeCargoHash([{ name: 'test', length: 100, width: 100, height: 100, weight: 1, quantity: 1 }]);
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('缓存读写', () => {
    test('写入后可读取', () => {
      service._setCache('test:key', { data: 'hello' });
      expect(service._getCached('test:key')).toEqual({ data: 'hello' });
    });

    test('未写入时返回 null', () => {
      expect(service._getCached('nonexistent')).toBeNull();
    });

    test('TTL 过期后返回 null', () => {
      service._cacheTTL = 1; // 1ms TTL
      service._setCache('test:expire', { data: 'will expire' });
      
      // 等待过期
      const start = Date.now();
      while (Date.now() - start < 5) {} // busy wait 5ms
      
      expect(service._getCached('test:expire')).toBeNull();
    });

    test('超过最大条目数时清理最旧的', () => {
      service._maxCacheSize = 3;
      service._setCache('key1', { v: 1 });
      service._setCache('key2', { v: 2 });
      service._setCache('key3', { v: 3 });
      service._setCache('key4', { v: 4 }); // 应该清理 key1

      expect(service._getCached('key1')).toBeNull();
      expect(service._getCached('key2')).toEqual({ v: 2 });
      expect(service._getCached('key4')).toEqual({ v: 4 });
    });

    test('clearCache 清除所有缓存', () => {
      service._setCache('a', { v: 1 });
      service._setCache('b', { v: 2 });
      service.clearCache();
      expect(service.getCacheStats().size).toBe(0);
    });
  });

  describe('recommendContainers 缓存命中', () => {
    test('第二次调用命中缓存，100ms 内返回', async () => {
      service.setOfflineMode(true);
      const cargoList = [
        { name: '空气炸锅', length: 400, width: 350, height: 300, weight: 5.5, quantity: 100 }
      ];

      // 第一次调用（离线模式，写入缓存）
      await service.recommendContainers(cargoList);

      // 第二次调用（应命中缓存）
      const start = Date.now();
      const result = await service.recommendContainers(cargoList);
      const elapsed = Date.now() - start;

      expect(result.cacheHit).toBe(true);
      expect(elapsed).toBeLessThan(100);
    });
  });
});

describe('AIPackingService - 离线降级', () => {
  let service;

  beforeEach(() => {
    service = new AIPackingService();
  });

  describe('离线模式开关', () => {
    test('默认离线模式关闭', () => {
      expect(service._offlineMode).toBe(false);
    });

    test('setOfflineMode 可开启/关闭', () => {
      service.setOfflineMode(true);
      expect(service._offlineMode).toBe(true);
      service.setOfflineMode(false);
      expect(service._offlineMode).toBe(false);
    });

    test('setDemoMode 可开启/关闭', () => {
      service.setDemoMode(true);
      expect(service._demoMode).toBe(true);
      service.setDemoMode(false);
      expect(service._demoMode).toBe(false);
    });
  });

  describe('recommendContainers 离线模式', () => {
    test('离线模式返回当前事实的本地响应且 fallback=true', async () => {
      service.setOfflineMode(true);
      const cargoList = [
        { name: '空气炸锅', length: 400, width: 350, height: 300, weight: 5.5, quantity: 100 }
      ];

      const result = await service.recommendContainers(cargoList);

      expect(result.fallback).toBe(true);
      expect(result.source).toBe('LOCAL_RULES');
      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendations[0]).toHaveProperty('typeId');
      expect(result.recommendations[0]).toHaveProperty('score');
      expect(result.recommendations[0]).toHaveProperty('reason');
    });

    test('Demo 模式也触发离线响应', async () => {
      service.setDemoMode(true);
      const cargoList = [
        { name: '笔记本', length: 350, width: 280, height: 50, weight: 2.5, quantity: 10 }
      ];

      const result = await service.recommendContainers(cargoList);
      expect(result.fallback).toBe(true);
      expect(result.source).toBe('LOCAL_RULES');
    });
  });

  describe('explainResult 离线模式', () => {
    test('离线模式返回当前事实的本地解释且 fallback=true', async () => {
      service.setOfflineMode(true);
      const packingResult = {
        loadedCargo: [
          { cargo: { name: '空气炸锅', length: 400, width: 350, height: 300, weight: 5.5 }, position: { x: 0, y: 0, z: 0 }, rotation: { length: 400, width: 350, height: 300 } }
        ],
        unloadedCargo: [],
        spaceUtilization: 75
      };

      const result = await service.explainResult(packingResult);

      expect(result.fallback).toBe(true);
      expect(result.source).toBe('LOCAL_RULES');
      expect(result.explanation).toBeDefined();
      expect(result.explanation.length).toBeGreaterThan(0);
      expect(result.explanation.length).toBeLessThanOrEqual(200);
    });
  });

  describe('generateStrategy 离线模式', () => {
    test('离线模式返回当前事实的本地策略且 fallback=true', async () => {
      service.setOfflineMode(true);
      const cargoList = [
        { name: '空气炸锅', length: 400, width: 350, height: 300, weight: 5.5, quantity: 100 }
      ];
      const container = { typeId: '40HQ', name: '40尺高柜', innerLength: 12032, innerWidth: 2352, innerHeight: 2698, maxWeight: 26000 };

      const result = await service.generateStrategy(cargoList, container);

      expect(result.fallback).toBe(true);
      expect(result.source).toBe('LOCAL_RULES');
      expect(result.strategy).toBeDefined();
    });
  });

  describe('网络错误检测', () => {
    test('ECONNREFUSED 被识别为网络错误', () => {
      const error = new Error('connect ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      expect(service._isNetworkError(error)).toBe(true);
    });

    test('ENOTFOUND 被识别为网络错误', () => {
      const error = new Error('getaddrinfo ENOTFOUND');
      error.code = 'ENOTFOUND';
      expect(service._isNetworkError(error)).toBe(true);
    });

    test('ETIMEDOUT 被识别为网络错误', () => {
      const error = new Error('timeout');
      error.code = 'ETIMEDOUT';
      expect(service._isNetworkError(error)).toBe(true);
    });

    test('普通错误不被识别为网络错误', () => {
      const error = new Error('AI返回格式异常');
      expect(service._isNetworkError(error)).toBe(false);
    });

    test('null 不被识别为网络错误', () => {
      expect(service._isNetworkError(null)).toBe(false);
    });
  });
});

describe('ai-offline-responses 模块', () => {
  describe('inferDatasetType', () => {
    test('慈溪家电关键词识别', () => {
      expect(inferDatasetType([{ name: '空气炸锅', quantity: 100 }])).toBe('cixi-appliances');
      expect(inferDatasetType([{ name: '取暖器', quantity: 50 }])).toBe('cixi-appliances');
      expect(inferDatasetType([{ name: '电风扇', quantity: 30 }])).toBe('cixi-appliances');
    });

    test('小批量识别', () => {
      expect(inferDatasetType([{ name: '笔记本', quantity: 10 }])).toBe('small');
    });

    test('中批量识别', () => {
      expect(inferDatasetType([{ name: '笔记本', quantity: 50 }])).toBe('medium');
    });

    test('大批量识别', () => {
      expect(inferDatasetType([{ name: '笔记本', quantity: 200 }])).toBe('large');
    });

    test('混装识别（多SKU）', () => {
      expect(inferDatasetType([
        { name: 'A', quantity: 20 },
        { name: 'B', quantity: 20 },
        { name: 'C', quantity: 20 },
        { name: 'D', quantity: 20 }
      ])).toBe('mixed');
    });

    test('空列表返回 small', () => {
      expect(inferDatasetType([])).toBe('small');
      expect(inferDatasetType(null)).toBe('small');
    });
  });

  describe('getOfflineRecommendation', () => {
    test('返回包含 3 个推荐的数组', () => {
      const result = getOfflineRecommendation(null, [{ name: '笔记本', quantity: 50 }]);
      expect(result.recommendations).toHaveLength(3);
      expect(result.fallback).toBe(true);
      expect(result.source).toBe('offline_preset');
    });

    test('每个推荐包含必要字段', () => {
      const result = getOfflineRecommendation(null, [{ name: '笔记本', quantity: 50 }]);
      result.recommendations.forEach(rec => {
        expect(rec).toHaveProperty('typeId');
        expect(rec).toHaveProperty('name');
        expect(rec).toHaveProperty('score');
        expect(rec).toHaveProperty('reason');
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(100);
        expect(rec.reason.length).toBeLessThanOrEqual(80);
      });
    });
  });

  describe('getOfflineExplanation', () => {
    test('返回 ≤200 字解释', () => {
      const result = getOfflineExplanation(null, [{ name: '笔记本', quantity: 50 }]);
      expect(result.explanation).toBeDefined();
      expect(result.explanation.length).toBeLessThanOrEqual(200);
      expect(result.fallback).toBe(true);
    });
  });

  describe('getOfflineStrategy', () => {
    test('返回策略对象', () => {
      const result = getOfflineStrategy(null, [{ name: '笔记本', quantity: 50 }]);
      expect(result.strategy).toBeDefined();
      expect(result.algorithmId).toBeDefined();
      expect(result.sortStrategy).toBeDefined();
      expect(result.reason).toBeDefined();
      expect(result.fallback).toBe(true);
    });
  });
});

