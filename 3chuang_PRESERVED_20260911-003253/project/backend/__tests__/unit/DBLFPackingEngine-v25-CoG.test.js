/**
 * Unit Tests: v25.0.0 Center of Gravity Calculation
 * 
 * Tests the incremental CoG calculation system that tracks
 * the weighted center point of all loaded cargo.
 */

const DBLFPackingEngine = require('../../services/DBLFPackingEngine');

describe('DBLFPackingEngine v25.0.0 - CoG Calculation', () => {
  let engine;
  let container20GP;

  beforeEach(() => {
    engine = new DBLFPackingEngine();
    container20GP = {
      typeId: '20GP',
      innerLength: 5898,
      innerHeight: 2393,
      innerWidth: 2352,
      maxWeight: 28000
    };
    
    // Initialize engine state
    engine.container = {
      length: container20GP.innerLength,
      height: container20GP.innerHeight,
      width: container20GP.innerWidth,
      maxWeight: container20GP.maxWeight
    };
    engine.placedCargos = [];
    engine.cogState = {
      totalWeight: 0,
      weightedSumX: 0,
      weightedSumY: 0,
      weightedSumZ: 0,
      cog: { x: 0, y: 0, z: 0 }
    };
  });

  describe('updateCoG', () => {
    test('should calculate CoG for single cargo', () => {
      const cargo = {
        x: 0,
        y: 0,
        z: 0,
        l: 1000,
        h: 1000,
        w: 1000,
        weight: 10
      };

      const cog = engine.updateCoG(cargo);

      // CoG should be at center of cargo
      expect(cog.x).toBe(500); // 0 + 1000/2
      expect(cog.y).toBe(500); // 0 + 1000/2
      expect(cog.z).toBe(500); // 0 + 1000/2
    });

    test('should calculate CoG for two equal-weight cargo', () => {
      const cargo1 = {
        x: 0,
        y: 0,
        z: 0,
        l: 1000,
        h: 1000,
        w: 1000,
        weight: 10
      };

      const cargo2 = {
        x: 1000,
        y: 0,
        z: 0,
        l: 1000,
        h: 1000,
        w: 1000,
        weight: 10
      };

      engine.updateCoG(cargo1);
      const cog = engine.updateCoG(cargo2);

      // CoG should be midpoint between two cargo centers
      expect(cog.x).toBe(1000); // (500*10 + 1500*10) / 20
      expect(cog.y).toBe(500);
      expect(cog.z).toBe(500);
    });

    test('should calculate CoG for two different-weight cargo', () => {
      const cargo1 = {
        x: 0,
        y: 0,
        z: 0,
        l: 1000,
        h: 1000,
        w: 1000,
        weight: 10
      };

      const cargo2 = {
        x: 2000,
        y: 0,
        z: 0,
        l: 1000,
        h: 1000,
        w: 1000,
        weight: 30
      };

      engine.updateCoG(cargo1);
      const cog = engine.updateCoG(cargo2);

      // CoG should be weighted toward heavier cargo
      // (500*10 + 2500*30) / 40 = 1875
      expect(cog.x).toBeCloseTo(1875, 1);
      expect(cog.y).toBe(500);
      expect(cog.z).toBe(500);
    });

    test('should update CoG incrementally', () => {
      const cargo1 = { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10 };
      const cargo2 = { x: 1000, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10 };
      const cargo3 = { x: 2000, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10 };

      const cog1 = engine.updateCoG(cargo1);
      expect(cog1.x).toBe(500);

      const cog2 = engine.updateCoG(cargo2);
      expect(cog2.x).toBe(1000);

      const cog3 = engine.updateCoG(cargo3);
      expect(cog3.x).toBe(1500); // (500*10 + 1500*10 + 2500*10) / 30
    });

    test('should maintain total weight correctly', () => {
      const cargo1 = { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10 };
      const cargo2 = { x: 1000, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 20 };

      engine.updateCoG(cargo1);
      expect(engine.cogState.totalWeight).toBe(10);

      engine.updateCoG(cargo2);
      expect(engine.cogState.totalWeight).toBe(30);
    });

    test('should handle vertical stacking', () => {
      const cargo1 = { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10 };
      const cargo2 = { x: 0, y: 1000, z: 0, l: 1000, h: 1000, w: 1000, weight: 10 };

      engine.updateCoG(cargo1);
      const cog = engine.updateCoG(cargo2);

      expect(cog.x).toBe(500);
      expect(cog.y).toBe(1000); // (500*10 + 1500*10) / 20
      expect(cog.z).toBe(500);
    });

    test('should handle 3D distribution', () => {
      const cargo1 = { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10 };
      const cargo2 = { x: 1000, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10 };
      const cargo3 = { x: 0, y: 0, z: 1000, l: 1000, h: 1000, w: 1000, weight: 10 };

      engine.updateCoG(cargo1);
      engine.updateCoG(cargo2);
      const cog = engine.updateCoG(cargo3);

      expect(cog.x).toBeCloseTo(666.67, 1); // (500*10 + 1500*10 + 500*10) / 30
      expect(cog.y).toBe(500);
      expect(cog.z).toBeCloseTo(666.67, 1); // (500*10 + 500*10 + 1500*10) / 30
    });
  });

  describe('calculateCoGOffset', () => {
    test('should calculate zero offset for centered CoG', () => {
      const cog = {
        x: container20GP.innerLength / 2,
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2
      };

      const offset = engine.calculateCoGOffset(cog, engine.container);

      expect(offset.lateral).toBeCloseTo(0, 2);
      expect(offset.longitudinal).toBeCloseTo(0, 2);
    });

    test('should calculate lateral offset (Z-axis)', () => {
      const cog = {
        x: container20GP.innerLength / 2,
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2 + 100 // 100mm offset
      };

      const offset = engine.calculateCoGOffset(cog, engine.container);

      const expectedLateral = (100 / container20GP.innerWidth) * 100;
      expect(offset.lateral).toBeCloseTo(expectedLateral, 2);
    });

    test('should calculate longitudinal offset (X-axis)', () => {
      const cog = {
        x: container20GP.innerLength / 2 + 200, // 200mm offset
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2
      };

      const offset = engine.calculateCoGOffset(cog, engine.container);

      const expectedLongitudinal = (200 / container20GP.innerLength) * 100;
      expect(offset.longitudinal).toBeCloseTo(expectedLongitudinal, 2);
    });

    test('should handle negative offsets', () => {
      const cog = {
        x: container20GP.innerLength / 2 - 150,
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2 - 80
      };

      const offset = engine.calculateCoGOffset(cog, engine.container);

      expect(offset.lateral).toBeGreaterThan(0); // Absolute value
      expect(offset.longitudinal).toBeGreaterThan(0); // Absolute value
    });

    test('should calculate 5% lateral offset correctly', () => {
      const lateralOffset = container20GP.innerWidth * 0.05;
      const cog = {
        x: container20GP.innerLength / 2,
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2 + lateralOffset
      };

      const offset = engine.calculateCoGOffset(cog, engine.container);

      expect(offset.lateral).toBeCloseTo(5, 1);
    });

    test('should calculate 10% longitudinal offset correctly', () => {
      const longitudinalOffset = container20GP.innerLength * 0.10;
      const cog = {
        x: container20GP.innerLength / 2 + longitudinalOffset,
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2
      };

      const offset = engine.calculateCoGOffset(cog, engine.container);

      expect(offset.longitudinal).toBeCloseTo(10, 1);
    });
  });

  describe('Integration with packing flow', () => {
    test('should include CoG in packing result', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Box-A',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 3,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const result = await engine.generatePackingPlan(cargo, container20GP);

      expect(result.cog).toBeDefined();
      expect(result.cog.x).toBeGreaterThan(0);
      expect(result.cog.y).toBeGreaterThan(0);
      expect(result.cog.z).toBeGreaterThan(0);
    });

    test('should include CoG offset in packing result', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Box-A',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 3,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const result = await engine.generatePackingPlan(cargo, container20GP);

      expect(result.cogOffset).toBeDefined();
      expect(result.cogOffset.lateral).toBeDefined();
      expect(result.cogOffset.longitudinal).toBeDefined();
    });

    test('should calculate CoG accurately for realistic cargo', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Heavy-Box',
          length: 1200,
          height: 1000,
          width: 800,
          weight: 50,
          quantity: 2,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        },
        {
          id: 2,
          name: 'Light-Box',
          length: 600,
          height: 500,
          width: 400,
          weight: 5,
          quantity: 4,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const result = await engine.generatePackingPlan(cargo, container20GP);

      // CoG should be weighted toward heavy cargo
      expect(result.cog).toBeDefined();
      expect(result.cogState.totalWeight).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('should calculate CoG incrementally in <1ms per cargo', () => {
      const cargo = { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10 };

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        engine.updateCoG(cargo);
      }
      const elapsed = Date.now() - start;

      const avgTime = elapsed / 1000;
      expect(avgTime).toBeLessThan(1); // <1ms per update
    });
  });
});
