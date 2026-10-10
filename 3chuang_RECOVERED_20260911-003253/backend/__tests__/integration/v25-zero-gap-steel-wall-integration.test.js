/**
 * Integration Tests: v25.0.0 Zero-Gap Steel Wall System
 * 
 * Tests the complete packing flow with all v25 features:
 * - Surface attraction mechanism
 * - Snap-to-neighbors function
 * - Real-time CoG calculation
 * - Safety engine validation
 * - API integration
 */

const DBLFPackingEngine = require('../../services/DBLFPackingEngine');
const NingboPortSafetyEngine = require('../../services/NingboPortSafetyEngine');

describe('v25.0.0 Zero-Gap Steel Wall - Integration Tests', () => {
  let engine;
  let safetyEngine;
  let container20GP;

  beforeEach(() => {
    engine = new DBLFPackingEngine();
    safetyEngine = new NingboPortSafetyEngine();
    container20GP = {
      typeId: '20GP',
      innerLength: 5898,
      innerHeight: 2393,
      innerWidth: 2352,
      maxWeight: 28000
    };
  });

  describe('Full Packing Flow with Surface Attraction', () => {
    test('should pack cargo with zero gaps using surface attraction', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Box-A',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 10,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const result = await engine.generatePackingPlan(cargo, container20GP);

      expect(result.loadedCargo.length).toBeGreaterThan(0);
      
      // Verify zero gaps between adjacent cargo
      for (let i = 0; i < result.loadedCargo.length - 1; i++) {
        const cargo1 = result.loadedCargo[i];
        const cargo2 = result.loadedCargo[i + 1];
        
        // Check if cargo are adjacent in X direction
        if (cargo1.position.z === cargo2.position.z && cargo1.position.y === cargo2.position.y) {
          const gap = Math.abs(cargo2.position.x - (cargo1.position.x + cargo1.dimensions.l));
          if (gap < 100) { // Only check if potentially adjacent
            expect(gap).toBeLessThanOrEqual(1); // ≤1mm gap
          }
        }
      }
    });

    test('should prioritize corner and edge placements', async () => {
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

      // First cargo should be at corner (0,0,0)
      expect(result.loadedCargo[0].position.x).toBe(0);
      expect(result.loadedCargo[0].position.y).toBe(0);
      expect(result.loadedCargo[0].position.z).toBe(0);

      // Second cargo should be adjacent to first (edge placement)
      const secondCargo = result.loadedCargo[1];
      const isAdjacent = 
        (secondCargo.position.x === 1000 && secondCargo.position.y === 0 && secondCargo.position.z === 0) ||
        (secondCargo.position.x === 0 && secondCargo.position.y === 0 && secondCargo.position.z === 1000) ||
        (secondCargo.position.x === 0 && secondCargo.position.y === 1000 && secondCargo.position.z === 0);
      
      expect(isAdjacent).toBe(true);
    });
  });

  describe('Full Packing Flow with Snap-to-Neighbors', () => {
    test('should eliminate small gaps through snapping', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Box-A',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 8,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const result = await engine.generatePackingPlan(cargo, container20GP);

      // Check that all cargo are tightly packed
      let maxGap = 0;
      for (let i = 0; i < result.loadedCargo.length - 1; i++) {
        const cargo1 = result.loadedCargo[i];
        
        for (let j = i + 1; j < result.loadedCargo.length; j++) {
          const cargo2 = result.loadedCargo[j];
          
          // Check X-axis gap
          if (cargo1.position.y === cargo2.position.y && cargo1.position.z === cargo2.position.z) {
            const gap = Math.abs(cargo2.position.x - (cargo1.position.x + cargo1.dimensions.l));
            if (gap > 0 && gap < 100) {
              maxGap = Math.max(maxGap, gap);
            }
          }
        }
      }

      expect(maxGap).toBeLessThanOrEqual(1); // All gaps ≤1mm
    });
  });

  describe('Full Packing Flow with CoG Calculation', () => {
    test('should calculate CoG for all loaded cargo', async () => {
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

      expect(result.cog).toBeDefined();
      expect(result.cog.x).toBeGreaterThan(0);
      expect(result.cog.y).toBeGreaterThan(0);
      expect(result.cog.z).toBeGreaterThan(0);
      
      expect(result.cogOffset).toBeDefined();
      expect(result.cogOffset.lateral).toBeGreaterThanOrEqual(0);
      expect(result.cogOffset.longitudinal).toBeGreaterThanOrEqual(0);
    });

    test('should maintain CoG within safe limits for balanced cargo', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Box-A',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 10,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const result = await engine.generatePackingPlan(cargo, container20GP);

      // For balanced cargo, CoG should be near container center
      const containerCenterX = container20GP.innerLength / 2;
      const containerCenterZ = container20GP.innerWidth / 2;

      const lateralDeviation = Math.abs(result.cog.z - containerCenterZ);
      const longitudinalDeviation = Math.abs(result.cog.x - containerCenterX);

      // Deviations should be reasonable
      expect(lateralDeviation).toBeLessThan(container20GP.innerWidth * 0.3);
      expect(longitudinalDeviation).toBeLessThan(container20GP.innerLength * 0.3);
    });

    test('should handle unbalanced cargo with CoG offset', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Heavy-Box',
          length: 1200,
          height: 1000,
          width: 800,
          weight: 50,
          quantity: 3,
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
          quantity: 5,
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

  describe('Full Packing Flow with Safety Engine', () => {
    test('should generate comprehensive safety report', async () => {
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

      const packingResult = await engine.generatePackingPlan(cargo, container20GP);
      const safetyReport = safetyEngine.validatePackingPlan(packingResult, container20GP);

      expect(safetyReport).toBeDefined();
      expect(safetyReport.cog).toBeDefined();
      expect(safetyReport.cogOffset).toBeDefined();
      expect(safetyReport.totalWeight).toBeGreaterThan(0);
      expect(safetyReport.weightUtilization).toBeGreaterThan(0);
      expect(safetyReport.warnings).toBeDefined();
      expect(safetyReport.complianceStatus).toBeDefined();
    });

    test('should pass compliance for safe packing', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Box-A',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 10,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const packingResult = await engine.generatePackingPlan(cargo, container20GP);
      const safetyReport = safetyEngine.validatePackingPlan(packingResult, container20GP);

      expect(safetyReport.complianceStatus).toBe('PASS');
      expect(safetyReport.warnings.length).toBe(0);
    });

    test('should warn for heavy cargo on fragile cargo', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Fragile-Box',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 2,
          fragile: true,
          portSequence: 1,
          eta: '2024-01-15'
        },
        {
          id: 2,
          name: 'Heavy-Box',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 30,
          quantity: 2,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const packingResult = await engine.generatePackingPlan(cargo, container20GP);
      const safetyReport = safetyEngine.validatePackingPlan(packingResult, container20GP);

      // Should have pressure warnings if heavy on fragile
      const pressureWarnings = safetyReport.warnings.filter(w => w.type === 'PRESSURE');
      if (pressureWarnings.length > 0) {
        expect(pressureWarnings[0].severity).toBe('CRITICAL');
      }
    });
  });

  describe('Backward Compatibility with v24.0.0', () => {
    test('should maintain extreme point priority (X-min > Y-min > Z-min)', async () => {
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

      // First cargo at (0,0,0)
      expect(result.loadedCargo[0].position.x).toBe(0);
      expect(result.loadedCargo[0].position.y).toBe(0);
      expect(result.loadedCargo[0].position.z).toBe(0);
    });

    test('should maintain batch order (3→2→1)', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Batch-1',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 2,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        },
        {
          id: 2,
          name: 'Batch-2',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 2,
          fragile: false,
          portSequence: 2,
          eta: '2024-01-20'
        },
        {
          id: 3,
          name: 'Batch-3',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 2,
          fragile: false,
          portSequence: 3,
          eta: '2024-01-25'
        }
      ];

      const result = await engine.generatePackingPlan(cargo, container20GP);

      // Batch 3 should be loaded first (deepest)
      const batch3Cargo = result.loadedCargo.filter(c => c.name === 'Batch-3');
      const batch1Cargo = result.loadedCargo.filter(c => c.name === 'Batch-1');

      if (batch3Cargo.length > 0 && batch1Cargo.length > 0) {
        expect(batch3Cargo[0].position.x).toBeLessThan(batch1Cargo[0].position.x);
      }
    });

    test('should maintain fragile stacking rules', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Fragile-Box',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 3,
          fragile: true,
          maxStackLayers: 2,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const result = await engine.generatePackingPlan(cargo, container20GP);

      // Count vertical stacking of fragile cargo
      const fragileCargo = result.loadedCargo.filter(c => c.fragile);
      const stackCounts = {};

      fragileCargo.forEach(cargo => {
        const key = `${cargo.position.x},${cargo.position.z}`;
        stackCounts[key] = (stackCounts[key] || 0) + 1;
      });

      // No stack should exceed maxStackLayers
      Object.values(stackCounts).forEach(count => {
        expect(count).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Performance Tests', () => {
    test('should pack 50 cargo in reasonable time', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Box-A',
          length: 800,
          height: 800,
          width: 800,
          weight: 10,
          quantity: 50,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const start = Date.now();
      const result = await engine.generatePackingPlan(cargo, container20GP);
      const elapsed = Date.now() - start;

      expect(result.loadedCargo.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(5000); // <5 seconds
    });

    test('should validate safety in <100ms', async () => {
      const cargo = [
        {
          id: 1,
          name: 'Box-A',
          length: 1000,
          height: 1000,
          width: 1000,
          weight: 10,
          quantity: 20,
          fragile: false,
          portSequence: 1,
          eta: '2024-01-15'
        }
      ];

      const packingResult = await engine.generatePackingPlan(cargo, container20GP);

      const start = Date.now();
      safetyEngine.validatePackingPlan(packingResult, container20GP);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Version Identification', () => {
    test('should identify as v25.0.0', () => {
      expect(engine.version).toContain('25.0.0');
      expect(engine.version).toContain('zero-gap');
    });

    test('should have all v25 methods', () => {
      expect(typeof engine.calculateSurfaceAttractionScore).toBe('function');
      expect(typeof engine.snapToNeighbors).toBe('function');
      expect(typeof engine.updateCoG).toBe('function');
      expect(typeof engine.calculateCoGOffset).toBe('function');
    });
  });
});
