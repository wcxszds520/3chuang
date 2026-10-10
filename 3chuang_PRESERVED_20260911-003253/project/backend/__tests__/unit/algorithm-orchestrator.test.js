/**
 * Unit Tests for AlgorithmOrchestrator
 * 
 * Tests: selectStrategyFamily, execute, getAlgorithmList,
 * oversize detection, deterministic output, cache integration
 */

const AlgorithmOrchestrator = require('../../services/AlgorithmOrchestrator');

// Mock database to avoid real DB calls in Realistic4DPackingEngine
jest.mock('../../config/database', () => ({
  query: jest.fn()
}));

describe('AlgorithmOrchestrator', () => {
  let orchestrator;

  // Standard test container (20GP)
  const container20GP = {
    id: 1,
    innerLength: 5898,
    innerWidth: 2352,
    innerHeight: 2393,
    maxWeight: 21770
  };

  // Standard test cargo
  const smallCargoList = [
    { cargoId: 'C1', name: '洗衣机', length: 600, width: 600, height: 850, weight: 45, quantity: 5, sku: 'washer', portSequence: 1 },
    { cargoId: 'C2', name: '冰箱', length: 700, width: 700, height: 1800, weight: 80, quantity: 3, sku: 'fridge', portSequence: 1 },
    { cargoId: 'C3', name: '微波炉', length: 500, width: 400, height: 300, weight: 15, quantity: 10, sku: 'microwave', portSequence: 1 }
  ];

  beforeEach(() => {
    orchestrator = new AlgorithmOrchestrator({ debugMode: false });
  });

  describe('selectStrategyFamily', () => {
    test('n <= 50 returns exact', () => {
      expect(orchestrator.selectStrategyFamily(1)).toBe('exact');
      expect(orchestrator.selectStrategyFamily(25)).toBe('exact');
      expect(orchestrator.selectStrategyFamily(50)).toBe('exact');
    });

    test('50 < n <= 500 returns heuristic', () => {
      expect(orchestrator.selectStrategyFamily(51)).toBe('heuristic');
      expect(orchestrator.selectStrategyFamily(200)).toBe('heuristic');
      expect(orchestrator.selectStrategyFamily(500)).toBe('heuristic');
    });

    test('n > 500 returns metaheuristic', () => {
      expect(orchestrator.selectStrategyFamily(501)).toBe('metaheuristic');
      expect(orchestrator.selectStrategyFamily(1000)).toBe('metaheuristic');
    });
  });

  describe('getAlgorithmList', () => {
    test('returns at least 5 algorithms', () => {
      const list = orchestrator.getAlgorithmList();
      expect(list.length).toBeGreaterThanOrEqual(5);
    });

    test('each algorithm has id, name, family', () => {
      const list = orchestrator.getAlgorithmList();
      for (const algo of list) {
        expect(algo).toHaveProperty('id');
        expect(algo).toHaveProperty('name');
        expect(algo).toHaveProperty('family');
        expect(typeof algo.id).toBe('string');
        expect(typeof algo.name).toBe('string');
        expect(typeof algo.family).toBe('string');
      }
    });

    test('algorithm families include exact, heuristic, metaheuristic', () => {
      const list = orchestrator.getAlgorithmList();
      const families = new Set(list.map(a => a.family));
      expect(families.has('exact')).toBe(true);
      expect(families.has('heuristic')).toBe(true);
      expect(families.has('metaheuristic')).toBe(true);
    });
  });

  describe('execute - UNKNOWN_ALGORITHM', () => {
    test('rejects unknown algorithm ID', async () => {
      const result = await orchestrator.execute({
        cargoList: smallCargoList,
        container: container20GP,
        options: { algorithmId: 'nonexistent-algo' }
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('UNKNOWN_ALGORITHM');
    });

    test('accepts whitelisted algorithm ID', async () => {
      const result = await orchestrator.execute({
        cargoList: smallCargoList,
        container: container20GP,
        options: { algorithmId: 'realistic4d' }
      });

      expect(result.success).toBe(true);
    });
  });

  describe('execute - OVERSIZE detection', () => {
    test('detects cargo exceeding container length', async () => {
      const oversizeCargo = [
        { cargoId: 'BIG1', name: '超长货物', length: 13000, width: 1000, height: 1000, weight: 100, quantity: 1, sku: 'big', portSequence: 1 }
      ];

      const result = await orchestrator.execute({
        cargoList: oversizeCargo,
        container: container20GP
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('OVERSIZE');
      expect(result.error.oversizeItems.length).toBe(1);
      expect(result.error.oversizeItems[0].oversizeDimensions.length).toBeGreaterThan(0);
    });

    test('detects cargo exceeding container weight', async () => {
      const heavyCargo = [
        { cargoId: 'HEAVY1', name: '超重货物', length: 1000, width: 1000, height: 1000, weight: 30000, quantity: 1, sku: 'heavy', portSequence: 1 }
      ];

      const result = await orchestrator.execute({
        cargoList: heavyCargo,
        container: container20GP
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('OVERSIZE');
      expect(result.error.oversizeItems[0].oversizeDimensions.some(d => d.dimension === 'weight')).toBe(true);
    });

    test('allows cargo within limits', async () => {
      const result = await orchestrator.execute({
        cargoList: smallCargoList,
        container: container20GP
      });

      expect(result.success).toBe(true);
    });
  });

  describe('execute - complete metrics', () => {
    test('returns all required metrics', async () => {
      const result = await orchestrator.execute({
        cargoList: smallCargoList,
        container: container20GP
      });

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(typeof result.metrics.space_utilization).toBe('number');
      expect(typeof result.metrics.weight_balance_score).toBe('number');
      expect(typeof result.metrics.stability_score).toBe('number');
      expect(typeof result.metrics.collision_count).toBe('number');
      expect(typeof result.metrics.elapsed_ms).toBe('number');
      expect(typeof result.metrics.algorithm_id).toBe('string');
    });

    test('collision_count is always 0', async () => {
      const result = await orchestrator.execute({
        cargoList: smallCargoList,
        container: container20GP
      });

      expect(result.metrics.collision_count).toBe(0);
    });

    test('weight_balance_score is between 0 and 1', async () => {
      const result = await orchestrator.execute({
        cargoList: smallCargoList,
        container: container20GP
      });

      expect(result.metrics.weight_balance_score).toBeGreaterThanOrEqual(0);
      expect(result.metrics.weight_balance_score).toBeLessThanOrEqual(1);
    });

    test('stability_score is between 0 and 1', async () => {
      const result = await orchestrator.execute({
        cargoList: smallCargoList,
        container: container20GP
      });

      expect(result.metrics.stability_score).toBeGreaterThanOrEqual(0);
      expect(result.metrics.stability_score).toBeLessThanOrEqual(1);
    });
  });

  describe('execute - deterministic output', () => {
    test('same input + same seed produces same output', async () => {
      const input = {
        cargoList: smallCargoList,
        container: container20GP,
        options: { seed: 42, algorithmId: 'realistic4d' }
      };

      // Clear cache between runs to ensure actual computation
      const orchestrator1 = new AlgorithmOrchestrator({ debugMode: false });
      const orchestrator2 = new AlgorithmOrchestrator({ debugMode: false });

      const result1 = await orchestrator1.execute(input);
      const result2 = await orchestrator2.execute(input);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Compare loaded cargo (excluding elapsed_ms which varies)
      expect(result1.loadedCargo.length).toBe(result2.loadedCargo.length);
      expect(result1.metrics.space_utilization).toBe(result2.metrics.space_utilization);

      // Deep compare loaded cargo positions
      for (let i = 0; i < result1.loadedCargo.length; i++) {
        expect(result1.loadedCargo[i].x).toBe(result2.loadedCargo[i].x);
        expect(result1.loadedCargo[i].y).toBe(result2.loadedCargo[i].y);
        expect(result1.loadedCargo[i].z).toBe(result2.loadedCargo[i].z);
      }
    });
  });

  describe('execute - cache integration', () => {
    test('second call with same input returns cached result', async () => {
      const input = {
        cargoList: smallCargoList,
        container: container20GP,
        options: { algorithmId: 'realistic4d' }
      };

      const result1 = await orchestrator.execute(input);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBe(false);

      const startTime = Date.now();
      const result2 = await orchestrator.execute(input);
      const cacheTime = Date.now() - startTime;

      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      // Cache should return within 50ms
      expect(cacheTime).toBeLessThan(50);
    });
  });

  describe('execute - multi-strategy for large SKU count', () => {
    test('uses multi-strategy for > 50 SKUs', async () => {
      // Generate cargo with > 50 SKUs
      const largeSKUCargo = [];
      for (let i = 0; i < 55; i++) {
        largeSKUCargo.push({
          cargoId: `CARGO_${i}`,
          name: `货物_${i}`,
          length: 300 + (i % 5) * 100,
          width: 300 + (i % 3) * 100,
          height: 300 + (i % 4) * 100,
          weight: 10 + (i % 10) * 5,
          quantity: 1,
          sku: `SKU_${i}`,
          portSequence: 1
        });
      }

      const result = await orchestrator.execute({
        cargoList: largeSKUCargo,
        container: container20GP
      });

      expect(result.success).toBe(true);
      expect(result.metrics.strategy_family).toBe('heuristic');
    });
  });

  describe('execute - SKU stats (mixed cargo)', () => {
    test('returns correct SKU statistics', async () => {
      const result = await orchestrator.execute({
        cargoList: smallCargoList,
        container: container20GP,
        options: { mixedSku: true }
      });

      expect(result.success).toBe(true);
      expect(result.skuStats).toBeDefined();

      // Check that total = loaded + unloaded for each SKU
      for (const [sku, stats] of Object.entries(result.skuStats)) {
        expect(stats.total).toBe(stats.loaded + stats.unloaded);
      }
    });
  });
});
