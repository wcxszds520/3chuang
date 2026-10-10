/**
 * NingboPortSafetyEngine - Maritime Safety Compliance Validator
 * Version: v25.0.0-zero-gap-steel-wall
 * 
 * 🚢 NINGBO PORT SAFETY COMPLIANCE (宁波港安全合规)
 * 
 * VALIDATION RULES:
 * ✅ CoG Lateral Offset (Z-axis): ≤5% of container width (~117mm for 2350mm width)
 * ✅ CoG Longitudinal Offset (X-axis): ≤10% of container length (~600mm for 6000mm length)
 * ✅ Weight Limit: 28000kg (100% warning, 105% critical)
 * ✅ Pressure Validation: Heavy cargo on fragile detection
 * 
 * COMPLIANCE STATUS:
 * - PASS: All checks passed, no warnings
 * - WARNING: Minor violations (advisory only)
 * - CRITICAL: Severe violations requiring immediate attention
 */

class NingboPortSafetyEngine {
  constructor() {
    this.name = 'NingboPortSafetyEngine';
    this.version = '25.0.0-zero-gap-steel-wall';
    
    // Ningbo Port CoG limits (宁波港重心限制)
    this.COG_LATERAL_LIMIT = 5.0;        // 5% of container width (Z-axis)
    this.COG_LONGITUDINAL_LIMIT = 10.0;  // 10% of container length (X-axis)
    this.COG_CRITICAL_LATERAL = 10.0;    // Critical threshold
    this.COG_CRITICAL_LONGITUDINAL = 15.0; // Critical threshold
    
    // Weight limits (载重限制)
    this.WEIGHT_WARNING_THRESHOLD = 100;  // 100% of maxWeight
    this.WEIGHT_CRITICAL_THRESHOLD = 105; // 105% of maxWeight
    
    // Pressure limits (压力限制)
    this.HEAVY_CARGO_THRESHOLD = 20;      // kg (≥20kg is heavy)
    this.PRESSURE_WARNING_THRESHOLD = 0.5; // kg/mm² (500 kg/m²)
  }

  /**
   * Main validation method - Comprehensive safety report
   * 
   * @param {Object} packingPlan - Packing plan with loadedCargo, cog, totalWeight
   * @param {Object} container - Container dimensions and maxWeight
   * @returns {Object} Comprehensive safety report
   */
  validatePackingPlan(packingPlan, container) {
    console.log('\n' + '='.repeat(80));
    console.log('🚢 [Ningbo Port Safety Engine] v25.0.0 - Maritime Compliance Check');
    console.log('='.repeat(80));
    
    const warnings = [];
    
    // Validate CoG offset
    const cogWarnings = this.validateCoG(packingPlan.cog, packingPlan.cogOffset, container);
    warnings.push(...cogWarnings);
    
    // Validate weight
    const weightWarnings = this.validateWeight(packingPlan.totalWeight, container.maxWeight);
    warnings.push(...weightWarnings);
    
    // Validate pressure (heavy on fragile)
    const pressureWarnings = this.validatePressure(packingPlan.loadedCargo);
    warnings.push(...pressureWarnings);
    
    // Determine overall compliance status
    const complianceStatus = this.determineComplianceStatus(warnings);
    
    // Calculate weight utilization
    const weightUtilization = (packingPlan.totalWeight / container.maxWeight * 100).toFixed(2);
    
    const safetyReport = {
      cog: packingPlan.cog,
      cogOffset: packingPlan.cogOffset,
      totalWeight: parseFloat(packingPlan.totalWeight.toFixed(2)),
      weightUtilization: parseFloat(weightUtilization),
      warnings: warnings,
      complianceStatus: complianceStatus
    };
    
    console.log(`\n📊 [Safety Report Summary]`);
    console.log(`   CoG: (${packingPlan.cog.x.toFixed(1)}, ${packingPlan.cog.y.toFixed(1)}, ${packingPlan.cog.z.toFixed(1)}) mm`);
    console.log(`   CoG Offset: Lateral ${packingPlan.cogOffset.lateral}% | Longitudinal ${packingPlan.cogOffset.longitudinal}%`);
    console.log(`   Weight: ${packingPlan.totalWeight.toFixed(2)} kg (${weightUtilization}%)`);
    console.log(`   Warnings: ${warnings.length}`);
    console.log(`   Compliance: ${complianceStatus}`);
    console.log('='.repeat(80) + '\n');
    
    return safetyReport;
  }

  /**
   * Validate CoG offset against Ningbo Port limits
   * 
   * @param {Object} cog - Center of gravity coordinates { x, y, z }
   * @param {Object} cogOffset - CoG offsets { lateral, longitudinal }
   * @param {Object} container - Container dimensions
   * @returns {Array} Array of CoG warnings
   */
  validateCoG(cog, cogOffset, container) {
    const warnings = [];
    
    // Validate lateral offset (Z-axis)
    if (cogOffset.lateral > this.COG_CRITICAL_LATERAL) {
      warnings.push({
        type: 'COG_OFFSET',
        severity: 'CRITICAL',
        message: `重心横向偏移严重超标: ${cogOffset.lateral}% (限制: ${this.COG_LATERAL_LIMIT}%, 严重: ${this.COG_CRITICAL_LATERAL}%)`,
        details: {
          axis: 'lateral',
          offset: cogOffset.lateral,
          limit: this.COG_LATERAL_LIMIT,
          criticalThreshold: this.COG_CRITICAL_LATERAL,
          cogZ: cog.z,
          containerWidth: container.width
        }
      });
    } else if (cogOffset.lateral > this.COG_LATERAL_LIMIT) {
      warnings.push({
        type: 'COG_OFFSET',
        severity: 'WARNING',
        message: `重心横向偏移超标: ${cogOffset.lateral}% (限制: ${this.COG_LATERAL_LIMIT}%)`,
        details: {
          axis: 'lateral',
          offset: cogOffset.lateral,
          limit: this.COG_LATERAL_LIMIT,
          cogZ: cog.z,
          containerWidth: container.width
        }
      });
    }
    
    // Validate longitudinal offset (X-axis)
    if (cogOffset.longitudinal > this.COG_CRITICAL_LONGITUDINAL) {
      warnings.push({
        type: 'COG_OFFSET',
        severity: 'CRITICAL',
        message: `重心纵向偏移严重超标: ${cogOffset.longitudinal}% (限制: ${this.COG_LONGITUDINAL_LIMIT}%, 严重: ${this.COG_CRITICAL_LONGITUDINAL}%)`,
        details: {
          axis: 'longitudinal',
          offset: cogOffset.longitudinal,
          limit: this.COG_LONGITUDINAL_LIMIT,
          criticalThreshold: this.COG_CRITICAL_LONGITUDINAL,
          cogX: cog.x,
          containerLength: container.length
        }
      });
    } else if (cogOffset.longitudinal > this.COG_LONGITUDINAL_LIMIT) {
      warnings.push({
        type: 'COG_OFFSET',
        severity: 'WARNING',
        message: `重心纵向偏移超标: ${cogOffset.longitudinal}% (限制: ${this.COG_LONGITUDINAL_LIMIT}%)`,
        details: {
          axis: 'longitudinal',
          offset: cogOffset.longitudinal,
          limit: this.COG_LONGITUDINAL_LIMIT,
          cogX: cog.x,
          containerLength: container.length
        }
      });
    }
    
    return warnings;
  }

  /**
   * Validate total weight against container maxWeight
   * 
   * @param {Number} totalWeight - Total loaded weight in kg
   * @param {Number} maxWeight - Container max weight in kg
   * @returns {Array} Array of weight warnings
   */
  validateWeight(totalWeight, maxWeight) {
    const warnings = [];
    const utilization = (totalWeight / maxWeight * 100);
    
    if (utilization > this.WEIGHT_CRITICAL_THRESHOLD) {
      warnings.push({
        type: 'OVERWEIGHT',
        severity: 'CRITICAL',
        message: `严重超载: ${totalWeight.toFixed(2)} kg (${utilization.toFixed(2)}% of ${maxWeight} kg, 严重阈值: ${this.WEIGHT_CRITICAL_THRESHOLD}%)`,
        details: {
          totalWeight: totalWeight,
          maxWeight: maxWeight,
          utilization: parseFloat(utilization.toFixed(2)),
          overweight: totalWeight - maxWeight,
          criticalThreshold: this.WEIGHT_CRITICAL_THRESHOLD
        }
      });
    } else if (utilization > this.WEIGHT_WARNING_THRESHOLD) {
      warnings.push({
        type: 'OVERWEIGHT',
        severity: 'WARNING',
        message: `超载预警: ${totalWeight.toFixed(2)} kg (${utilization.toFixed(2)}% of ${maxWeight} kg, 限制: ${this.WEIGHT_WARNING_THRESHOLD}%)`,
        details: {
          totalWeight: totalWeight,
          maxWeight: maxWeight,
          utilization: parseFloat(utilization.toFixed(2)),
          overweight: totalWeight - maxWeight,
          warningThreshold: this.WEIGHT_WARNING_THRESHOLD
        }
      });
    }
    
    return warnings;
  }

  /**
   * Validate pressure on bottom cargo (heavy on fragile detection)
   * 
   * @param {Array} loadedCargo - Array of loaded cargo items
   * @returns {Array} Array of pressure warnings
   */
  validatePressure(loadedCargo) {
    const warnings = [];
    
    // Find all ground-level cargo (Y=0)
    const groundCargo = loadedCargo.filter(item => item.position.y === 0);
    
    for (const bottomCargo of groundCargo) {
      // Find all cargo directly above this bottom cargo
      const cargoAbove = this.findCargoAbove(bottomCargo, loadedCargo);
      
      if (cargoAbove.length === 0) continue;
      
      // Calculate total weight above
      const totalWeightAbove = cargoAbove.reduce((sum, item) => sum + item.properties.weight, 0);
      
      // Check for heavy cargo on fragile
      const hasHeavyAbove = cargoAbove.some(item => item.properties.weight >= this.HEAVY_CARGO_THRESHOLD);
      
      if (bottomCargo.properties.fragile && hasHeavyAbove) {
        warnings.push({
          type: 'HEAVY_ON_FRAGILE',
          severity: 'CRITICAL',
          message: `重货压在易碎品上: ${bottomCargo.name} (底部) 承受 ${totalWeightAbove.toFixed(2)} kg`,
          details: {
            bottomCargoId: bottomCargo.cargoId,
            bottomCargoName: bottomCargo.name,
            bottomCargoWeight: bottomCargo.properties.weight,
            totalWeightAbove: totalWeightAbove,
            cargoAboveCount: cargoAbove.length,
            heavyCargoAbove: cargoAbove.filter(c => c.properties.weight >= this.HEAVY_CARGO_THRESHOLD).map(c => c.name)
          }
        });
      }
      
      // Calculate pressure per unit area
      const bottomArea = bottomCargo.dimensions.l * bottomCargo.dimensions.w; // mm²
      const pressure = totalWeightAbove / bottomArea; // kg/mm²
      
      if (pressure > this.PRESSURE_WARNING_THRESHOLD) {
        warnings.push({
          type: 'PRESSURE',
          severity: 'WARNING',
          message: `底部货物压力过大: ${bottomCargo.name} 承受 ${pressure.toFixed(4)} kg/mm² (阈值: ${this.PRESSURE_WARNING_THRESHOLD} kg/mm²)`,
          details: {
            bottomCargoId: bottomCargo.cargoId,
            bottomCargoName: bottomCargo.name,
            pressure: parseFloat(pressure.toFixed(4)),
            threshold: this.PRESSURE_WARNING_THRESHOLD,
            totalWeightAbove: totalWeightAbove,
            bottomArea: bottomArea
          }
        });
      }
    }
    
    return warnings;
  }

  /**
   * Find all cargo directly above a bottom cargo (vertical projection overlap)
   * 
   * @param {Object} bottomCargo - Bottom cargo item
   * @param {Array} loadedCargo - All loaded cargo
   * @returns {Array} Array of cargo items above
   */
  findCargoAbove(bottomCargo, loadedCargo) {
    const cargoAbove = [];
    
    for (const cargo of loadedCargo) {
      // Skip if same cargo or not above
      if (cargo.cargoId === bottomCargo.cargoId) continue;
      if (cargo.position.y <= bottomCargo.position.y) continue;
      
      // Check vertical projection overlap
      if (this.hasVerticalOverlap(bottomCargo, cargo)) {
        cargoAbove.push(cargo);
      }
    }
    
    return cargoAbove;
  }

  /**
   * Check if two cargo items have vertical projection overlap (X-Z plane)
   * 
   * @param {Object} cargoA - First cargo item
   * @param {Object} cargoB - Second cargo item
   * @returns {Boolean} True if vertical overlap exists
   */
  hasVerticalOverlap(cargoA, cargoB) {
    const aX1 = cargoA.position.x;
    const aX2 = cargoA.position.x + cargoA.dimensions.l;
    const aZ1 = cargoA.position.z;
    const aZ2 = cargoA.position.z + cargoA.dimensions.w;
    
    const bX1 = cargoB.position.x;
    const bX2 = cargoB.position.x + cargoB.dimensions.l;
    const bZ1 = cargoB.position.z;
    const bZ2 = cargoB.position.z + cargoB.dimensions.w;
    
    // Check X-axis overlap
    const xOverlap = !(aX2 <= bX1 || bX2 <= aX1);
    
    // Check Z-axis overlap
    const zOverlap = !(aZ2 <= bZ1 || bZ2 <= aZ1);
    
    return xOverlap && zOverlap;
  }

  /**
   * Determine overall compliance status based on warnings
   * 
   * @param {Array} warnings - Array of warning objects
   * @returns {String} Compliance status: "PASS" | "WARNING" | "CRITICAL"
   */
  determineComplianceStatus(warnings) {
    if (warnings.length === 0) {
      return 'PASS';
    }
    
    const hasCritical = warnings.some(w => w.severity === 'CRITICAL');
    if (hasCritical) {
      return 'CRITICAL';
    }
    
    return 'WARNING';
  }
}

module.exports = NingboPortSafetyEngine;
