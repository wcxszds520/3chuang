/**
 * Test Utilities and Helpers for Property-Based Testing
 * 
 * This module provides utility functions for validating algorithm correctness
 * in property-based tests for the 3D Space Splitting Algorithm implementation.
 * 
 * Spec: 3d-space-splitting-algorithm-implementation
 * Task: 2.3 Create test utilities and helpers
 * Requirements: 20.6, 20.7, 20.8, 20.9, 20.10
 */

/**
 * AABB (Axis-Aligned Bounding Box) Collision Detection
 * 
 * Checks if two 3D boxes overlap in space using the separating axis theorem.
 * Two boxes collide if they overlap on ALL three axes (X, Y, Z).
 * 
 * Algorithm:
 * - For each axis, check if the boxes are separated
 * - If separated on ANY axis, no collision
 * - If NOT separated on ALL axes, collision detected
 * 
 * @param {Object} box1 - First box with position and dimensions
 * @param {number} box1.x - X-coordinate (Length axis)
 * @param {number} box1.y - Y-coordinate (Height axis)
 * @param {number} box1.z - Z-coordinate (Width axis)
 * @param {number} box1.l - Length dimension (X-axis extent)
 * @param {number} box1.h - Height dimension (Y-axis extent)
 * @param {number} box1.w - Width dimension (Z-axis extent)
 * @param {Object} box2 - Second box with same structure as box1
 * @returns {boolean} True if boxes collide (overlap), false otherwise
 * 
 * Validates: Requirements 20.6, 20.9 (Collision detection)
 * 
 * @example
 * // Non-overlapping boxes
 * checkCollision(
 *   { x: 0, y: 0, z: 0, l: 100, h: 100, w: 100 },
 *   { x: 100, y: 0, z: 0, l: 100, h: 100, w: 100 }
 * ); // Returns false (boxes touch but don't overlap)
 * 
 * @example
 * // Overlapping boxes
 * checkCollision(
 *   { x: 0, y: 0, z: 0, l: 100, h: 100, w: 100 },
 *   { x: 50, y: 50, z: 50, l: 100, h: 100, w: 100 }
 * ); // Returns true (boxes overlap)
 */
function checkCollision(box1, box2) {
  // Check for separation on X-axis (Length)
  // Boxes are separated if one ends before the other starts
  const separatedX = (box1.x + box1.l <= box2.x) || (box2.x + box2.l <= box1.x);
  
  // Check for separation on Y-axis (Height)
  const separatedY = (box1.y + box1.h <= box2.y) || (box2.y + box2.h <= box1.y);
  
  // Check for separation on Z-axis (Width)
  const separatedZ = (box1.z + box1.w <= box2.z) || (box2.z + box2.w <= box1.z);
  
  // Collision occurs if NOT separated on ALL axes
  // If separated on ANY axis, no collision
  return !(separatedX || separatedY || separatedZ);
}

/**
 * Check if all loaded cargo items have no collisions
 * 
 * Validates that no two cargo items overlap in 3D space by checking
 * all pairs of loaded cargo using AABB collision detection.
 * 
 * @param {Array<Object>} loadedCargo - Array of loaded cargo items
 * @returns {boolean} True if no collisions detected, false if any collision found
 * 
 * Validates: Requirements 20.6, 20.9 (No cargo collisions)
 * 
 * @example
 * const loadedCargo = [
 *   { position: { x: 0, y: 0, z: 0 }, dimensions: { l: 100, h: 100, w: 100 } },
 *   { position: { x: 100, y: 0, z: 0 }, dimensions: { l: 100, h: 100, w: 100 } }
 * ];
 * noCollisions(loadedCargo); // Returns true
 */
function noCollisions(loadedCargo) {
  if (!loadedCargo || loadedCargo.length === 0) {
    return true; // No cargo means no collisions
  }
  
  // Check all pairs of cargo items
  for (let i = 0; i < loadedCargo.length; i++) {
    for (let j = i + 1; j < loadedCargo.length; j++) {
      const cargo1 = loadedCargo[i];
      const cargo2 = loadedCargo[j];
      
      // Convert cargo format to box format for collision detection
      const box1 = {
        x: cargo1.position.x,
        y: cargo1.position.y,
        z: cargo1.position.z,
        l: cargo1.dimensions.l,
        h: cargo1.dimensions.h,
        w: cargo1.dimensions.w
      };
      
      const box2 = {
        x: cargo2.position.x,
        y: cargo2.position.y,
        z: cargo2.position.z,
        l: cargo2.dimensions.l,
        h: cargo2.dimensions.h,
        w: cargo2.dimensions.w
      };
      
      if (checkCollision(box1, box2)) {
        return false; // Collision detected
      }
    }
  }
  
  return true; // No collisions found
}

/**
 * Container Boundary Checking Utility
 * 
 * Verifies that a cargo item is entirely within container boundaries.
 * Checks both minimum boundaries (x, y, z >= 0) and maximum boundaries
 * (x+l <= innerLength, y+h <= innerHeight, z+w <= innerWidth).
 * 
 * @param {Object} cargo - Cargo item with position and dimensions
 * @param {Object} cargo.position - Position coordinates
 * @param {number} cargo.position.x - X-coordinate (Length axis)
 * @param {number} cargo.position.y - Y-coordinate (Height axis)
 * @param {number} cargo.position.z - Z-coordinate (Width axis)
 * @param {Object} cargo.dimensions - Cargo dimensions
 * @param {number} cargo.dimensions.l - Length dimension
 * @param {number} cargo.dimensions.h - Height dimension
 * @param {number} cargo.dimensions.w - Width dimension
 * @param {Object} container - Container specifications
 * @param {number} container.innerLength - Container inner length (X-axis max)
 * @param {number} container.innerHeight - Container inner height (Y-axis max)
 * @param {number} container.innerWidth - Container inner width (Z-axis max)
 * @returns {boolean} True if cargo is within boundaries, false otherwise
 * 
 * Validates: Requirements 20.7, 20.10 (Container boundary enforcement)
 * 
 * @example
 * const cargo = {
 *   position: { x: 0, y: 0, z: 0 },
 *   dimensions: { l: 1000, h: 1000, w: 1000 }
 * };
 * const container = {
 *   innerLength: 12032,
 *   innerHeight: 2698,
 *   innerWidth: 2352
 * };
 * isWithinBoundaries(cargo, container); // Returns true
 */
function isWithinBoundaries(cargo, container) {
  const { x, y, z } = cargo.position;
  const { l, h, w } = cargo.dimensions;
  
  // Check minimum boundaries (cargo must start at or after origin)
  if (x < 0 || y < 0 || z < 0) {
    return false;
  }
  
  // Check maximum boundaries (cargo must end at or before container limits)
  if (x + l > container.innerLength) {
    return false;
  }
  
  if (y + h > container.innerHeight) {
    return false;
  }
  
  if (z + w > container.innerWidth) {
    return false;
  }
  
  return true;
}

/**
 * Check if all loaded cargo items are within container boundaries
 * 
 * Validates that every cargo item in the loaded cargo array is entirely
 * within the container boundaries.
 * 
 * @param {Array<Object>} loadedCargo - Array of loaded cargo items
 * @param {Object} container - Container specifications
 * @returns {boolean} True if all cargo within boundaries, false otherwise
 * 
 * Validates: Requirements 20.7, 20.10 (Container boundary enforcement)
 * 
 * @example
 * const loadedCargo = [
 *   { position: { x: 0, y: 0, z: 0 }, dimensions: { l: 1000, h: 1000, w: 1000 } }
 * ];
 * const container = { innerLength: 12032, innerHeight: 2698, innerWidth: 2352 };
 * allWithinBoundaries(loadedCargo, container); // Returns true
 */
function allWithinBoundaries(loadedCargo, container) {
  if (!loadedCargo || loadedCargo.length === 0) {
    return true; // No cargo means all within boundaries
  }
  
  return loadedCargo.every(cargo => isWithinBoundaries(cargo, container));
}

/**
 * Space Utilization Verification Utility
 * 
 * Calculates and verifies space utilization percentage.
 * Space utilization = (total cargo volume / container volume) × 100
 * 
 * Uses actual rotation dimensions (not original cargo dimensions) for accuracy.
 * 
 * @param {Array<Object>} loadedCargo - Array of loaded cargo items
 * @param {Object} container - Container specifications
 * @returns {number} Space utilization percentage (0-100)
 * 
 * Validates: Requirements 20.8 (Space utilization calculation accuracy)
 * 
 * @example
 * const loadedCargo = [
 *   { dimensions: { l: 1000, h: 1000, w: 1000 } }, // 1,000,000 cubic mm
 *   { dimensions: { l: 500, h: 500, w: 500 } }     // 125,000 cubic mm
 * ];
 * const container = {
 *   innerLength: 2000,
 *   innerHeight: 2000,
 *   innerWidth: 2000  // 8,000,000 cubic mm
 * };
 * calculateSpaceUtilization(loadedCargo, container);
 * // Returns 14.0625 ((1,125,000 / 8,000,000) × 100)
 */
function calculateSpaceUtilization(loadedCargo, container) {
  if (!loadedCargo || loadedCargo.length === 0) {
    return 0; // No cargo means 0% utilization
  }
  
  // Calculate total cargo volume using rotation dimensions
  const totalCargoVolume = loadedCargo.reduce((sum, cargo) => {
    const volume = cargo.dimensions.l * cargo.dimensions.h * cargo.dimensions.w;
    return sum + volume;
  }, 0);
  
  // Calculate container volume
  const containerVolume = container.innerLength * container.innerHeight * container.innerWidth;
  
  // Calculate utilization percentage
  const utilization = (totalCargoVolume / containerVolume) * 100;
  
  return utilization;
}

/**
 * Verify space utilization calculation matches expected value
 * 
 * Compares calculated utilization with expected value within a tolerance.
 * 
 * @param {Array<Object>} loadedCargo - Array of loaded cargo items
 * @param {Object} container - Container specifications
 * @param {number} expectedUtilization - Expected utilization percentage
 * @param {number} tolerance - Acceptable difference (default: 0.01%)
 * @returns {boolean} True if utilization matches expected within tolerance
 * 
 * Validates: Requirements 20.8 (Space utilization calculation accuracy)
 * 
 * @example
 * verifySpaceUtilization(loadedCargo, container, 75.5, 0.1);
 * // Returns true if calculated utilization is between 75.4% and 75.6%
 */
function verifySpaceUtilization(loadedCargo, container, expectedUtilization, tolerance = 0.01) {
  const actualUtilization = calculateSpaceUtilization(loadedCargo, container);
  const difference = Math.abs(actualUtilization - expectedUtilization);
  return difference <= tolerance;
}

/**
 * Coordinate System Validation Utility
 * 
 * Validates that the unified coordinate system is correctly applied:
 * - X-axis represents Length (0 to innerLength)
 * - Y-axis represents Height (0 to innerHeight)
 * - Z-axis represents Width (0 to innerWidth)
 * - Height values are never added to Z-axis coordinates
 * 
 * @param {Array<Object>} loadedCargo - Array of loaded cargo items
 * @param {Object} container - Container specifications
 * @returns {Object} Validation result with isValid flag and errors array
 * 
 * Validates: Requirements 20.1 (Coordinate system correctness)
 * 
 * @example
 * const result = validateCoordinateSystem(loadedCargo, container);
 * if (!result.isValid) {
 *   console.error('Coordinate system errors:', result.errors);
 * }
 */
function validateCoordinateSystem(loadedCargo, container) {
  const errors = [];
  
  if (!loadedCargo || loadedCargo.length === 0) {
    return { isValid: true, errors: [] };
  }
  
  loadedCargo.forEach((cargo, index) => {
    const { x, y, z } = cargo.position;
    const { l, h, w } = cargo.dimensions;
    
    // Validate X-axis (Length)
    if (x < 0 || x > container.innerLength) {
      errors.push({
        cargoIndex: index,
        cargoId: cargo.cargoId,
        error: 'X-coordinate out of range',
        value: x,
        range: `[0, ${container.innerLength}]`
      });
    }
    
    if (x + l > container.innerLength) {
      errors.push({
        cargoIndex: index,
        cargoId: cargo.cargoId,
        error: 'X + Length exceeds container innerLength',
        value: x + l,
        max: container.innerLength
      });
    }
    
    // Validate Y-axis (Height)
    if (y < 0 || y > container.innerHeight) {
      errors.push({
        cargoIndex: index,
        cargoId: cargo.cargoId,
        error: 'Y-coordinate out of range',
        value: y,
        range: `[0, ${container.innerHeight}]`
      });
    }
    
    if (y + h > container.innerHeight) {
      errors.push({
        cargoIndex: index,
        cargoId: cargo.cargoId,
        error: 'Y + Height exceeds container innerHeight',
        value: y + h,
        max: container.innerHeight
      });
    }
    
    // Validate Z-axis (Width)
    if (z < 0 || z > container.innerWidth) {
      errors.push({
        cargoIndex: index,
        cargoId: cargo.cargoId,
        error: 'Z-coordinate out of range',
        value: z,
        range: `[0, ${container.innerWidth}]`
      });
    }
    
    if (z + w > container.innerWidth) {
      errors.push({
        cargoIndex: index,
        cargoId: cargo.cargoId,
        error: 'Z + Width exceeds container innerWidth',
        value: z + w,
        max: container.innerWidth
      });
    }
    
    // Validate dimensions are positive
    if (l <= 0 || h <= 0 || w <= 0) {
      errors.push({
        cargoIndex: index,
        cargoId: cargo.cargoId,
        error: 'Dimensions must be positive',
        dimensions: { l, h, w }
      });
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if coordinate system is correctly applied
 * 
 * Simple boolean check for coordinate system validity.
 * 
 * @param {Array<Object>} loadedCargo - Array of loaded cargo items
 * @param {Object} container - Container specifications
 * @returns {boolean} True if coordinate system is valid, false otherwise
 * 
 * Validates: Requirements 20.1 (Coordinate system correctness)
 */
function isCoordinateSystemValid(loadedCargo, container) {
  const result = validateCoordinateSystem(loadedCargo, container);
  return result.isValid;
}

/**
 * Comprehensive validation of packing result
 * 
 * Runs all validation checks and returns a comprehensive report.
 * 
 * @param {Object} packingResult - Complete packing result
 * @param {Array<Object>} packingResult.loadedCargo - Loaded cargo items
 * @param {Object} packingResult.containerType - Container specifications
 * @returns {Object} Validation report with all checks
 * 
 * @example
 * const report = validatePackingResult(packingResult);
 * if (!report.isValid) {
 *   console.error('Validation failed:', report);
 * }
 */
function validatePackingResult(packingResult) {
  const { loadedCargo, containerType } = packingResult;
  
  const noCollisionsCheck = noCollisions(loadedCargo);
  const allWithinBoundariesCheck = allWithinBoundaries(loadedCargo, containerType);
  const coordinateSystemCheck = validateCoordinateSystem(loadedCargo, containerType);
  const utilization = calculateSpaceUtilization(loadedCargo, containerType);
  
  return {
    isValid: noCollisionsCheck && allWithinBoundariesCheck && coordinateSystemCheck.isValid,
    checks: {
      noCollisions: noCollisionsCheck,
      allWithinBoundaries: allWithinBoundariesCheck,
      coordinateSystem: coordinateSystemCheck,
      spaceUtilization: utilization
    }
  };
}

// Export all utilities
module.exports = {
  // Collision detection utilities
  checkCollision,
  noCollisions,
  
  // Boundary checking utilities
  isWithinBoundaries,
  allWithinBoundaries,
  
  // Space utilization utilities
  calculateSpaceUtilization,
  verifySpaceUtilization,
  
  // Coordinate system validation utilities
  validateCoordinateSystem,
  isCoordinateSystemValid,
  
  // Comprehensive validation
  validatePackingResult
};
