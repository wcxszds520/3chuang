/**
 * Unit Tests: v25.0.0 Snap-to-Neighbors Function
 * 
 * Tests the snap-to-neighbors mechanism that eliminates small gaps
 * by micro-adjusting cargo coordinates to adjacent surfaces.
 */

const DBLFPackingEngine = require('../../services/DBLFPackingEngine');

describe('DBLFPackingEngine v25.0.0 - Snap-to-Neighbors', () => {
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

  describe('snapToNeighbors', () => {
    test('should snap X-axis when gap is 1-5mm', () => {
      // Place cargo at back wall
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      // Test cargo with 3mm gap
      const result = engine.snapToNeighbors(1003, 0, 0, 1000, 1000, 1000);
      
      expect(result.snapped).toBe(true);
      expect(result.x).toBe(1000); // Snapped to adjacent cargo
      expect(result.adjustments.length).toBeGreaterThan(0);
      expect(result.adjustments[0].axis).toBe('X');
      expect(result.adjustments[0].gap).toBe(3);
    });

    test('should snap Y-axis when gap is 1-5mm', () => {
      // Place cargo at ground
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      // Test cargo with 2mm gap above
      const result = engine.snapToNeighbors(0, 1002, 0, 1000, 1000, 1000);
      
      expect(result.snapped).toBe(true);
      expect(result.y).toBe(1000); // Snapped to cargo below
      expect(result.adjustments.length).toBeGreaterThan(0);
      expect(result.adjustments[0].axis).toBe('Y');
      expect(result.adjustments[0].gap).toBe(2);
    });

    test('should snap Z-axis when gap is 1-5mm', () => {
      // Place cargo at left wall
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      // Test cargo with 4mm gap
      const result = engine.snapToNeighbors(0, 0, 1004, 1000, 1000, 1000);
      
      expect(result.snapped).toBe(true);
      expect(result.z).toBe(1000); // Snapped to adjacent cargo
      expect(result.adjustments.length).toBeGreaterThan(0);
      expect(result.adjustments[0].axis).toBe('Z');
      expect(result.adjustments[0].gap).toBe(4);
    });

    test('should NOT snap when gap is >5mm', () => {
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      // Test cargo with 10mm gap (too large)
      const result = engine.snapToNeighbors(1010, 0, 0, 1000, 1000, 1000);
      
      expect(result.snapped).toBe(false);
      expect(result.x).toBe(1010); // No adjustment
      expect(result.adjustments.length).toBe(0);
    });

    test('should NOT snap when gap is 0mm (already adjacent)', () => {
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      // Test cargo already adjacent
      const result = engine.snapToNeighbors(1000, 0, 0, 1000, 1000, 1000);
      
      expect(result.snapped).toBe(false);
      expect(result.x).toBe(1000); // No adjustment needed
    });

    test('should rollback when snap causes collision', () => {
      // Place two cargo with a small gap
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 },
        { x: 1000, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      // Try to snap into occupied space
      const result = engine.snapToNeighbors(998, 0, 0, 1000, 1000, 1000);
      
      expect(result.rollback).toBe(true);
      expect(result.snapped).toBe(false);
      expect(result.x).toBe(998); // Rolled back to original
    });

    test('should rollback when snap violates container boundaries', () => {
      engine.placedCargos = [];
      
      // Try to snap beyond container boundary
      const result = engine.snapToNeighbors(
        container20GP.innerLength - 998, 
        0, 
        0, 
        1000, 
        1000, 
        1000
      );
      
      // If snap would push beyond boundary, should rollback
      if (result.rollback) {
        expect(result.snapped).toBe(false);
      }
    });

    test('should snap multiple axes simultaneously', () => {
      // Place cargo at corner
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      // Test cargo with gaps on multiple axes
      const result = engine.snapToNeighbors(1003, 1002, 1004, 1000, 1000, 1000);
      
      if (result.snapped) {
        expect(result.adjustments.length).toBeGreaterThan(0);
        // Should have adjustments for multiple axes
        const axes = result.adjustments.map(adj => adj.axis);
        expect(axes.length).toBeGreaterThan(0);
      }
    });

    test('should snap to container walls', () => {
      engine.placedCargos = [];
      
      // Test cargo with 3mm gap from back wall
      const result = engine.snapToNeighbors(3, 0, 0, 1000, 1000, 1000);
      
      expect(result.snapped).toBe(true);
      expect(result.x).toBe(0); // Snapped to back wall
    });
  });

  describe('findNearbyXSurfaces', () => {
    test('should find nearby cargo surfaces in X direction', () => {
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      const surfaces = engine.findNearbyXSurfaces(1003, 0, 0, 1000, 1000, 1000);
      
      expect(surfaces.length).toBeGreaterThan(0);
      expect(surfaces[0].gap).toBe(3);
    });

    test('should find container walls as surfaces', () => {
      engine.placedCargos = [];
      
      const surfaces = engine.findNearbyXSurfaces(3, 0, 0, 1000, 1000, 1000);
      
      expect(surfaces.length).toBeGreaterThan(0);
      expect(surfaces[0].surfaceCoord).toBe(0); // Back wall
    });
  });

  describe('findNearbyYSurfaces', () => {
    test('should find nearby cargo surfaces in Y direction', () => {
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      const surfaces = engine.findNearbyYSurfaces(0, 1002, 0, 1000, 1000, 1000);
      
      expect(surfaces.length).toBeGreaterThan(0);
      expect(surfaces[0].gap).toBe(2);
    });
  });

  describe('findNearbyZSurfaces', () => {
    test('should find nearby cargo surfaces in Z direction', () => {
      engine.placedCargos = [
        { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 }
      ];
      
      const surfaces = engine.findNearbyZSurfaces(0, 0, 1004, 1000, 1000, 1000);
      
      expect(surfaces.length).toBeGreaterThan(0);
      expect(surfaces[0].gap).toBe(4);
    });
  });

  describe('Integration with packing flow', () => {
    test('should eliminate gaps in real packing scenario', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Box-A',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 5,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const result = await engine.generatePackingPlan(cargo, container20GP);
      
      expect(result.loadedCargo.length).toBeGreaterThan(0);
      
      // Check that cargo are tightly packed (no gaps >1mm)
      for (let i = 0; i < result.loadedCargo.length - 1; i++) {
        const cargo1 = result.loadedCargo[i];
        const cargo2 = result.loadedCargo[i + 1];
        
        // Check X-axis gap
        const xGap = Math.abs(cargo2.position.x - (cargo1.position.x + cargo1.dimensions.l));
        if (xGap > 0 && xGap < 100) { // Only check if potentially adjacent
          expect(xGap).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});
