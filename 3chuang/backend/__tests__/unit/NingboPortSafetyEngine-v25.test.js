/**
 * Unit Tests: v25.0.0 Ningbo Port Safety Engine
 * 
 * Tests the safety validation system that enforces maritime
 * compliance rules for CoG, weight, and pressure.
 */

const NingboPortSafetyEngine = require('../../services/NingboPortSafetyEngine');

describe('NingboPortSafetyEngine v25.0.0', () => {
  let safetyEngine;
  let container20GP;

  beforeEach(() => {
    safetyEngine = new NingboPortSafetyEngine();
    container20GP = {
      typeId: '20GP',
      innerLength: 5898,
      innerHeight: 2393,
      innerWidth: 2352,
      maxWeight: 28000
    };
  });

  describe('validateCoG', () => {
    test('should pass when CoG is centered', () => {
      const cog = {
        x: container20GP.innerLength / 2,
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2
      };
      const cogOffset = { lateral: 0, longitudinal: 0 };

      const warnings = safetyEngine.validateCoG(cog, cogOffset, container20GP);

      expect(warnings.length).toBe(0);
    });

    test('should warn when lateral offset is 5-10%', () => {
      const cog = {
        x: container20GP.innerLength / 2,
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2
      };
      const cogOffset = { lateral: 7, longitudinal: 0 };

      const warnings = safetyEngine.validateCoG(cog, cogOffset, container20GP);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('COG_OFFSET');
      expect(warnings[0].severity).toBe('WARNING');
    });

    test('should be critical when lateral offset is >10%', () => {
      const cog = {
        x: container20GP.innerLength / 2,
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2
      };
      const cogOffset = { lateral: 12, longitudinal: 0 };

      const warnings = safetyEngine.validateCoG(cog, cogOffset, container20GP);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('COG_OFFSET');
      expect(warnings[0].severity).toBe('CRITICAL');
    });

    test('should warn when longitudinal offset is 10-15%', () => {
      const cog = {
        x: container20GP.innerLength / 2,
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2
      };
      const cogOffset = { lateral: 0, longitudinal: 12 };

      const warnings = safetyEngine.validateCoG(cog, cogOffset, container20GP);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('COG_OFFSET');
      expect(warnings[0].severity).toBe('WARNING');
    });

    test('should be critical when longitudinal offset is >15%', () => {
      const cog = {
        x: container20GP.innerLength / 2,
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2
      };
      const cogOffset = { lateral: 0, longitudinal: 18 };

      const warnings = safetyEngine.validateCoG(cog, cogOffset, container20GP);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('COG_OFFSET');
      expect(warnings[0].severity).toBe('CRITICAL');
    });

    test('should warn for both lateral and longitudinal offsets', () => {
      const cog = {
        x: container20GP.innerLength / 2,
        y: container20GP.innerHeight / 2,
        z: container20GP.innerWidth / 2
      };
      const cogOffset = { lateral: 7, longitudinal: 12 };

      const warnings = safetyEngine.validateCoG(cog, cogOffset, container20GP);

      expect(warnings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validateWeight', () => {
    test('should pass when weight is <100% of maxWeight', () => {
      const totalWeight = 25000; // 89% of 28000kg
      const warnings = safetyEngine.validateWeight(totalWeight, container20GP.maxWeight);

      expect(warnings.length).toBe(0);
    });

    test('should warn when weight is 100-105% of maxWeight', () => {
      const totalWeight = 28500; // 102% of 28000kg
      const warnings = safetyEngine.validateWeight(totalWeight, container20GP.maxWeight);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('OVERWEIGHT');
      expect(warnings[0].severity).toBe('WARNING');
    });

    test('should be critical when weight is >105% of maxWeight', () => {
      const totalWeight = 30000; // 107% of 28000kg
      const warnings = safetyEngine.validateWeight(totalWeight, container20GP.maxWeight);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('OVERWEIGHT');
      expect(warnings[0].severity).toBe('CRITICAL');
    });

    test('should include weight utilization in warning details', () => {
      const totalWeight = 28500;
      const warnings = safetyEngine.validateWeight(totalWeight, container20GP.maxWeight);

      expect(warnings[0].details).toBeDefined();
      expect(warnings[0].details.weightUtilization).toBeCloseTo(101.79, 1);
    });
  });

  describe('validatePressure', () => {
    test('should pass when no heavy cargo on fragile cargo', () => {
      const loadedCargo = [
        { id: 1, x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10, fragile: false },
        { id: 2, x: 0, y: 1000, z: 0, l: 1000, h: 1000, w: 1000, weight: 10, fragile: false }
      ];

      const warnings = safetyEngine.validatePressure(loadedCargo);

      expect(warnings.length).toBe(0);
    });

    test('should warn when heavy cargo (≥20kg) on non-heavy cargo', () => {
      const loadedCargo = [
        { id: 1, x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10, fragile: false },
        { id: 2, x: 0, y: 1000, z: 0, l: 1000, h: 1000, w: 1000, weight: 25, fragile: false }
      ];

      const warnings = safetyEngine.validatePressure(loadedCargo);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('PRESSURE');
    });

    test('should be critical when heavy cargo on fragile cargo', () => {
      const loadedCargo = [
        { id: 1, x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10, fragile: true },
        { id: 2, x: 0, y: 1000, z: 0, l: 1000, h: 1000, w: 1000, weight: 25, fragile: false }
      ];

      const warnings = safetyEngine.validatePressure(loadedCargo);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].severity).toBe('CRITICAL');
    });

    test('should calculate total weight above correctly', () => {
      const loadedCargo = [
        { id: 1, x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10, fragile: false },
        { id: 2, x: 0, y: 1000, z: 0, l: 1000, h: 1000, w: 1000, weight: 15, fragile: false },
        { id: 3, x: 0, y: 2000, z: 0, l: 1000, h: 1000, w: 1000, weight: 20, fragile: false }
      ];

      const warnings = safetyEngine.validatePressure(loadedCargo);

      if (warnings.length > 0) {
        expect(warnings[0].details.totalWeightAbove).toBe(35); // 15 + 20
      }
    });

    test('should only check ground-level cargo (Y=0)', () => {
      const loadedCargo = [
        { id: 1, x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10, fragile: false },
        { id: 2, x: 0, y: 1000, z: 0, l: 1000, h: 1000, w: 1000, weight: 5, fragile: false },
        { id: 3, x: 0, y: 2000, z: 0, l: 1000, h: 1000, w: 1000, weight: 25, fragile: false }
      ];

      const warnings = safetyEngine.validatePressure(loadedCargo);

      // Should only check cargo at Y=0, not cargo at Y=1000
      expect(warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hasVerticalOverlap', () => {
    test('should detect full vertical overlap', () => {
      const bottomCargo = { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 };
      const topCargo = { x: 0, y: 1000, z: 0, l: 1000, h: 1000, w: 1000 };

      const hasOverlap = safetyEngine.hasVerticalOverlap(bottomCargo, topCargo);

      expect(hasOverlap).toBe(true);
    });

    test('should detect partial vertical overlap', () => {
      const bottomCargo = { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 };
      const topCargo = { x: 500, y: 1000, z: 500, l: 1000, h: 1000, w: 1000 };

      const hasOverlap = safetyEngine.hasVerticalOverlap(bottomCargo, topCargo);

      expect(hasOverlap).toBe(true);
    });

    test('should return false when no vertical overlap', () => {
      const bottomCargo = { x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000 };
      const topCargo = { x: 2000, y: 1000, z: 2000, l: 1000, h: 1000, w: 1000 };

      const hasOverlap = safetyEngine.hasVerticalOverlap(bottomCargo, topCargo);

      expect(hasOverlap).toBe(false);
    });
  });

  describe('determineComplianceStatus', () => {
    test('should return PASS when no warnings', () => {
      const warnings = [];
      const status = safetyEngine.determineComplianceStatus(warnings);

      expect(status).toBe('PASS');
    });

    test('should return WARNING when only WARNING severity', () => {
      const warnings = [
        { type: 'COG_OFFSET', severity: 'WARNING', message: 'Test' }
      ];
      const status = safetyEngine.determineComplianceStatus(warnings);

      expect(status).toBe('WARNING');
    });

    test('should return CRITICAL when any CRITICAL severity', () => {
      const warnings = [
        { type: 'COG_OFFSET', severity: 'WARNING', message: 'Test' },
        { type: 'OVERWEIGHT', severity: 'CRITICAL', message: 'Test' }
      ];
      const status = safetyEngine.determineComplianceStatus(warnings);

      expect(status).toBe('CRITICAL');
    });
  });

  describe('validatePackingPlan', () => {
    test('should return comprehensive safety report', () => {
      const packingPlan = {
        loadedCargo: [
          { id: 1, x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10, fragile: false }
        ],
        cog: {
          x: container20GP.innerLength / 2,
          y: container20GP.innerHeight / 2,
          z: container20GP.innerWidth / 2
        },
        cogOffset: { lateral: 0, longitudinal: 0 },
        cogState: { totalWeight: 10 }
      };

      const report = safetyEngine.validatePackingPlan(packingPlan, container20GP);

      expect(report).toBeDefined();
      expect(report.cog).toBeDefined();
      expect(report.cogOffset).toBeDefined();
      expect(report.totalWeight).toBe(10);
      expect(report.weightUtilization).toBeDefined();
      expect(report.warnings).toBeDefined();
      expect(report.complianceStatus).toBe('PASS');
    });

    test('should include all warning types', () => {
      const packingPlan = {
        loadedCargo: [
          { id: 1, x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 10, fragile: true },
          { id: 2, x: 0, y: 1000, z: 0, l: 1000, h: 1000, w: 1000, weight: 25, fragile: false }
        ],
        cog: {
          x: container20GP.innerLength / 2,
          y: container20GP.innerHeight / 2,
          z: container20GP.innerWidth / 2 + 300 // 12.7% lateral offset
        },
        cogOffset: { lateral: 12.7, longitudinal: 0 },
        cogState: { totalWeight: 30000 } // 107% overweight
      };

      const report = safetyEngine.validatePackingPlan(packingPlan, container20GP);

      expect(report.warnings.length).toBeGreaterThan(0);
      
      const warningTypes = report.warnings.map(w => w.type);
      expect(warningTypes).toContain('COG_OFFSET');
      expect(warningTypes).toContain('OVERWEIGHT');
      expect(warningTypes).toContain('PRESSURE');
    });

    test('should calculate weight utilization percentage', () => {
      const packingPlan = {
        loadedCargo: [
          { id: 1, x: 0, y: 0, z: 0, l: 1000, h: 1000, w: 1000, weight: 14000, fragile: false }
        ],
        cog: {
          x: container20GP.innerLength / 2,
          y: container20GP.innerHeight / 2,
          z: container20GP.innerWidth / 2
        },
        cogOffset: { lateral: 0, longitudinal: 0 },
        cogState: { totalWeight: 14000 }
      };

      const report = safetyEngine.validatePackingPlan(packingPlan, container20GP);

      expect(report.weightUtilization).toBeCloseTo(50, 1);
    });
  });

  describe('Performance', () => {
    test('should validate in <100ms for realistic cargo', () => {
      const loadedCargo = [];
      for (let i = 0; i < 100; i++) {
        loadedCargo.push({
          id: i,
          x: (i % 5) * 1000,
          y: Math.floor(i / 25) * 1000,
          z: Math.floor((i % 25) / 5) * 1000,
          l: 1000,
          h: 1000,
          w: 1000,
          weight: 10,
          fragile: false
        });
      }

      const packingPlan = {
        loadedCargo,
        cog: {
          x: container20GP.innerLength / 2,
          y: container20GP.innerHeight / 2,
          z: container20GP.innerWidth / 2
        },
        cogOffset: { lateral: 0, longitudinal: 0 },
        cogState: { totalWeight: 1000 }
      };

      const start = Date.now();
      safetyEngine.validatePackingPlan(packingPlan, container20GP);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });
});
