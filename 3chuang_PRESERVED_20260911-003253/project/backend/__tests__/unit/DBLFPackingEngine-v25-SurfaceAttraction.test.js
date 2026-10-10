/**
 * Unit Tests: v25.0.0 Surface Attraction Mechanism
 * 
 * Tests the surface attraction scoring system that prioritizes
 * placement points with maximum surface contact to eliminate gaps.
 */

const DBLFPackingEngine = require('../../services/DBLFPackingEngine');

describe('DBLFPackingEngine v25.0.0 - Surface Attraction', () => {
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
  });

  describe('calculateSurfaceAttractionScore', () => {
    const rotation = { length: 1000, height: 1000, width: 1000 };
    const cargo = { name: 'TestBox', weight: 10 };

    test('should score 3 for corner placement (back wall + left wall + ground)', () => {
      const point = { x: 0, y: 0, z: 0 };
      const score = engine.calculateSurfaceAttractionScore(point, rotation, cargo);
      expect(score).toBe(3);
    });

    test('should score 2 for edge placement (back wall + ground)', () => {
      const point = { x: 0, y: 0, z: 1000 };
      const score = engine.calculateSurfaceAttractionScore(point, rotation, cargo);
      expect(score).toBe(2);
    });

    test('should score 1 for center placement (ground only)', () => {
      const point = { x: 1000, y: 0, z: 1000 };
      const score = engine.calculateSurfaceAttractionScore(point, rotation, cargo);
      expect(score).toBe(1);
    });

    test('should score 3 for elevated corner with full support below', () => {
      // Place cargo below to provide support
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      const point = { x: 0, y: 1000, z: 0 };
      const score = engine.calculateSurfaceAttractionScore(point, rotation, cargo);
      expect(score).toBe(3); // back wall + left wall + bottom support
    });

    test('should score for front wall adjacency', () => {
      const point = { x: container20GP.innerLength - 1000, y: 0, z: 0 };
      const score = engine.calculateSurfaceAttractionScore(point, rotation, cargo);
      expect(score).toBeGreaterThanOrEqual(3); // front wall + left wall + ground
    });

    test('should score for right wall adjacency', () => {
      const point = { x: 0, y: 0, z: container20GP.innerWidth - 1000 };
      const score = engine.calculateSurfaceAttractionScore(point, rotation, cargo);
      expect(score).toBeGreaterThanOrEqual(3); // back wall + right wall + ground
    });

    test('should score for top adjacency when cargo above', () => {
      // Place cargo at ground level
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      // Place cargo above
      engine.placedCargos.push(
        { x: 0, y: 2000, z: 0, l: 1000, h: 1000, w: 1000 }
      );
      
      // Test point between them
      const point = { x: 0, y: 1000, z: 0 };
      const score = engine.calculateSurfaceAttractionScore(point, rotation, cargo);
      expect(score).toBeGreaterThanOrEqual(3);
    });
  });

  describe('hasFullSupport', () => {
    test('should return true when 100% supported', () => {
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      const hasSupport = engine.hasFullSupport(0, 1000, 0, 1000, 1000, 0.95);
      expect(hasSupport).toBe(true);
    });

    test('should return true when ≥95% supported', () => {
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 950 }
      ];
      
      const hasSupport = engine.hasFullSupport(0, 1000, 0, 1000, 1000, 0.95);
      expect(hasSupport).toBe(true);
    });

    test('should return false when <95% supported', () => {
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 900 }
      ];
      
      const hasSupport = engine.hasFullSupport(0, 1000, 0, 1000, 1000, 0.95);
      expect(hasSupport).toBe(false);
    });

    test('should return false when no cargo below', () => {
      engine.placedCargos = [];
      
      const hasSupport = engine.hasFullSupport(0, 1000, 0, 1000, 1000, 0.95);
      expect(hasSupport).toBe(false);
    });
  });

  describe('hasAdjacentSurface', () => {
    test('should detect adjacent cargo on back face', () => {
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      const hasAdjacent = engine.hasAdjacentSurface(1000, 0, 0, 1000, 1000, 'back', 0.95);
      expect(hasAdjacent).toBe(true);
    });

    test('should detect adjacent cargo on left face', () => {
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      const hasAdjacent = engine.hasAdjacentSurface(0, 0, 1000, 1000, 1000, 'left', 0.95);
      expect(hasAdjacent).toBe(true);
    });

    test('should return false when no adjacent cargo', () => {
      engine.placedCargos = [];
      
      const hasAdjacent = engine.hasAdjacentSurface(1000, 0, 0, 1000, 1000, 'back', 0.95);
      expect(hasAdjacent).toBe(false);
    });
  });

  describe('Integration with packing flow', () => {
    test('should prioritize corner placement over center placement', async () => {
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
      
      expect(result.loadedCargo.length).toBeGreaterThan(0);
      
      // First cargo should be at corner (0,0,0)
      const firstCargo = result.loadedCargo[0];
      expect(firstCargo.position.x).toBe(0);
      expect(firstCargo.position.y).toBe(0);
      expect(firstCargo.position.z).toBe(0);
    });
  });
});
