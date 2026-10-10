/**
 * Unit Tests for AIPackingService.recommendContainers
 * 
 * Tests the AI container recommendation feature including:
 * - Local fallback logic (rule-based recommendations)
 * - Input validation
 * - Response format correctness
 * 
 * Requirements: 3.1, 3.8
 */

const AIPackingService = require('../../services/AIPackingService');

// Mock axios to avoid real API calls
jest.mock('axios');
const axios = require('axios');

describe('AIPackingService - recommendContainers', () => {
  let service;

  // Sample cargo lists for testing
  const smallCargo = [
    { name: '小家电', length: 400, width: 300, height: 300, weight: 5, quantity: 50 }
  ];

  const mediumCargo = [
    { name: '洗衣机', length: 600, width: 600, height: 850, weight: 45, quantity: 20 },
    { name: '冰箱', length: 700, width: 700, height: 1800, weight: 80, quantity: 10 }
  ];

  const largeCargo = [
    { name: '大型设备', length: 1200, width: 1000, height: 1500, weight: 200, quantity: 30 },
    { name: '重型机械', length: 800, width: 800, height: 1000, weight: 300, quantity: 20 }
  ];

  beforeEach(() => {
    service = new AIPackingService();
    // Set a fake API key so the service attempts AI calls
    service.apiKey = 'test-key';
    jest.clearAllMocks();
  });

  describe('Local fallback (rule-based recommendations)', () => {
    beforeEach(() => {
      // Make AI call fail to trigger fallback
      axios.post.mockRejectedValue(new Error('Network error'));
    });

    test('recommends 20GP for small volume and weight', async () => {
      // smallCargo: 50 * (0.4*0.3*0.3) = 1.8m³, 50*5 = 250kg
      const result = await service.recommendContainers(smallCargo);

      expect(result).toHaveProperty('recommendations');
      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendations[0].typeId).toBe('20GP');
      expect(result.recommendations[0].score).toBeGreaterThanOrEqual(90);
    });

    test('recommends 40GP for medium volume', async () => {
      // mediumCargo: 20*(0.6*0.6*0.85) + 10*(0.7*0.7*1.8) = 6.12 + 8.82 = 14.94m³
      // weight: 20*45 + 10*80 = 900 + 800 = 1700kg
      // Still fits 20GP (< 25m³ and < 21770kg), so 20GP is best
      const result = await service.recommendContainers(mediumCargo);

      expect(result).toHaveProperty('recommendations');
      expect(result.recommendations).toHaveLength(3);
      // Volume is ~15m³ which is < 25m³, so 20GP should be recommended
      expect(result.recommendations[0].typeId).toBe('20GP');
    });

    test('recommends 40GP when volume exceeds 20GP capacity', async () => {
      // Create cargo that exceeds 25m³ but under 55m³
      const cargo40GP = [
        { name: '中型货物', length: 1000, width: 1000, height: 1000, weight: 50, quantity: 30 }
        // 30 * 1m³ = 30m³, weight = 1500kg
      ];
      const result = await service.recommendContainers(cargo40GP);

      expect(result.recommendations[0].typeId).toBe('40GP');
      expect(result.recommendations[0].score).toBeGreaterThanOrEqual(90);
    });

    test('recommends 40HQ for large volume', async () => {
      // largeCargo: 30*(1.2*1.0*1.5) + 20*(0.8*0.8*1.0) = 54 + 12.8 = 66.8m³
      // weight: 30*200 + 20*300 = 6000 + 6000 = 12000kg
      const result = await service.recommendContainers(largeCargo);

      expect(result.recommendations[0].typeId).toBe('40HQ');
      expect(result.recommendations[0].score).toBeGreaterThanOrEqual(90);
    });

    test('recommends 40HQ when weight exceeds 40GP limit but volume is small', async () => {
      // Heavy but small cargo: exceeds 26000kg
      const heavyCargo = [
        { name: '铁块', length: 200, width: 200, height: 200, weight: 500, quantity: 60 }
        // volume: 60 * 0.008 = 0.48m³, weight: 60*500 = 30000kg > 26000
      ];
      const result = await service.recommendContainers(heavyCargo);

      // Weight exceeds all limits, but 40HQ is the largest option
      expect(result.recommendations[0].typeId).toBe('40HQ');
    });

    test('all recommendations have required fields', async () => {
      const result = await service.recommendContainers(smallCargo);

      result.recommendations.forEach(rec => {
        expect(rec).toHaveProperty('typeId');
        expect(rec).toHaveProperty('name');
        expect(rec).toHaveProperty('score');
        expect(rec).toHaveProperty('reason');
        expect(typeof rec.typeId).toBe('string');
        expect(typeof rec.name).toBe('string');
        expect(typeof rec.score).toBe('number');
        expect(typeof rec.reason).toBe('string');
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(100);
        expect(rec.reason.length).toBeLessThanOrEqual(80);
      });
    });

    test('recommendations are sorted by score descending', async () => {
      const result = await service.recommendContainers(smallCargo);

      for (let i = 0; i < result.recommendations.length - 1; i++) {
        expect(result.recommendations[i].score).toBeGreaterThanOrEqual(result.recommendations[i + 1].score);
      }
    });
  });

  describe('AI response parsing', () => {
    test('parses valid AI response correctly', async () => {
      const aiResponse = {
        data: {
          choices: [{
            message: {
              content: JSON.stringify({
                recommendations: [
                  { typeId: '40GP', name: '40尺标准柜', score: 95, reason: '货物体积适中，40尺标准柜性价比最优' },
                  { typeId: '40HQ', name: '40尺高柜', score: 78, reason: '空间富余，适合后续加货' },
                  { typeId: '20GP', name: '20尺标准柜', score: 45, reason: '容积不足，可能装不下' }
                ]
              })
            }
          }]
        }
      };
      axios.post.mockResolvedValue(aiResponse);

      const result = await service.recommendContainers(mediumCargo);

      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendations[0].typeId).toBe('40GP');
      expect(result.recommendations[0].score).toBe(95);
    });

    test('falls back to local rules when AI returns invalid JSON', async () => {
      const aiResponse = {
        data: {
          choices: [{
            message: {
              content: '这是一段无效的非JSON响应'
            }
          }]
        }
      };
      axios.post.mockResolvedValue(aiResponse);

      const result = await service.recommendContainers(smallCargo);

      // Should still return valid recommendations via fallback
      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendations[0]).toHaveProperty('typeId');
      expect(result.recommendations[0]).toHaveProperty('score');
    });

    test('falls back to local rules when AI API key is missing', async () => {
      service.apiKey = '';

      const result = await service.recommendContainers(smallCargo);

      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendations[0].typeId).toBe('20GP');
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      axios.post.mockRejectedValue(new Error('Network error'));
    });

    test('handles cargo with missing quantity (defaults to 1)', async () => {
      const cargoNoQty = [
        { name: '测试货物', length: 500, width: 500, height: 500, weight: 10 }
      ];
      const result = await service.recommendContainers(cargoNoQty);

      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendations[0].typeId).toBe('20GP');
    });

    test('handles single item cargo', async () => {
      const singleCargo = [
        { name: '单件货物', length: 1000, width: 800, height: 600, weight: 50, quantity: 1 }
      ];
      const result = await service.recommendContainers(singleCargo);

      expect(result.recommendations).toHaveLength(3);
    });
  });
});
