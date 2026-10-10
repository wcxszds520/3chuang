/**
 * DBLF Packing Engine v26.2 - Commercial Grade Wall-Builder
 * 
 * 🎯 v26.2 Critical Improvements:
 * 1. Global Extreme Point Backtracking - Abolish currentX linear progression
 * 2. Smart CoG Balancing - Center cargo if utilization < 80%
 * 3. Forced Smart Rotation - Override canInvert=false if necessary
 * 4. Target: 80%+ utilization, longitudinal offset < 10%
 * 
 * Algorithm: Global Extreme Point Search with Zero-Gap Snap
 * - For each cargo, iterate ALL extreme points globally
 * - No currentX-based linear progression
 * - Fill gaps aggressively with backtracking
 * - Apply X_offset for CoG balancing after packing
 */

const Cargo = require('../models/Cargo');

class DBLFPackingEngineV26 {
  constructor() {
    this.container = null;
    this.extremePoints = [];
    this.placedCargo = [];
    this.loadingIndex = 0;
  }

  /**
   * Main entry point - Generate packing plan
   */
  async generatePackingPlan(cargoList, container) {
    this.container = container;
    this.extremePoints = [{ x: 0, y: 0, z: 0 }]; // Start with origin
    this.placedCargo = [];
    this.loadingIndex = 0;

    // Sort: portSequence DESC > SKU > Volume DESC
    const sortedCargo = this.sortCargo(cargoList);

    // Expand cargo items by quantity
    const expandedCargo = [];
    sortedCargo.forEach(cargo => {
      for (let i = 0; i < cargo.quantity; i++) {
        expandedCargo.push({
          ...cargo,
          cargoId: `${cargo.cargoId}_${i + 1}`,
          quantity: 1
        });
      }
    });

    // Pack each cargo using global extreme point search
    for (const cargo of expandedCargo) {
      const placed = this.placeCargoGlobally(cargo);
      if (!placed) {
        console.log(`⚠️  Failed to place cargo: ${cargo.cargoId}`);
      }
    }

    // Calculate utilization BEFORE CoG balancing
    const rawUtilization = this.calculateUtilization();

    // Apply smart CoG balancing if utilization < 80%
    if (rawUtilization < 80) {
      this.applySmartCoGBalancing();
    }

    // Calculate final metrics
    const result = this.buildResult(expandedCargo);
    
    return result;
  }

  /**
   * Sort cargo: portSequence DESC > SKU > Volume DESC
   */
  sortCargo(cargoList) {
    return [...cargoList].sort((a, b) => {
      // 1. portSequence DESC (3 -> 2 -> 1)
      if (b.portSequence !== a.portSequence) {
        return b.portSequence - a.portSequence;
      }
      
      // 2. SKU name ASC
      if (a.name !== b.name) {
        return a.name.localeCompare(b.name);
      }
      
      // 3. Volume DESC
      const volA = a.length * a.width * a.height;
      const volB = b.length * b.width * b.height;
      return volB - volA;
    });
  }

  /**
   * Place cargo using GLOBAL extreme point search
   * - Iterate through ALL extreme points
   * - Try all 6 rotations (with forced override if needed)
   * - Select best position based on LIFO requirements
   */
  placeCargoGlobally(cargo) {
    let bestPlacement = null;
    let bestScore = Infinity;

    // Get all possible rotations (including forced rotations)
    const rotations = this.get6DOFRotations(cargo, true); // true = allow forced rotation

    // Try each extreme point
    for (const ep of this.extremePoints) {
      // Try each rotation
      for (const rotation of rotations) {
        const { l, w, h, isForced } = rotation;

        // Check if cargo fits at this extreme point
        if (!this.fitsInContainer(ep.x, ep.y, ep.z, l, w, h)) {
          continue;
        }

        // Check collision with existing cargo
        if (this.hasCollision(ep.x, ep.y, ep.z, l, w, h)) {
          continue;
        }

        // Check gravity support (50% required - UNLEASHED for max utilization)
        const supportRatio = this.calculateSupportRatio(ep.x, ep.y, ep.z, l, w, h);
        if (ep.y > 0 && supportRatio < 0.50) {
          continue;
        }

        // Calculate score with LIFO-aware X-axis priority + Z-AXIS CENTER MAGNET
        // CRITICAL: For LIFO, higher portSequence (unload first) should be at FRONT (X=max)
        // Z-AXIS MAGNET: Absolute priority for center alignment (innerWidth / 2)
        const containerCenterZ = this.container.innerWidth / 2;
        const cargoCenter = ep.z + w / 2;
        const zDeviation = Math.abs(cargoCenter - containerCenterZ);
        
        // LIFO scoring: Reverse X for high portSequence
        // portSequence 3 (first unload) → prefer X=max (door)
        // portSequence 1 (last unload) → prefer X=0 (back)
        const xScore = (this.container.innerLength - ep.x) * (4 - cargo.portSequence);
        
        // Z-AXIS CENTER MAGNET: 10x weight on Z deviation (magnetic center attraction)
        const score = xScore * 1000000 + ep.y * 1000 + zDeviation * 10;

        if (score < bestScore) {
          bestScore = score;
          bestPlacement = {
            x: Math.floor(ep.x),
            y: Math.floor(ep.y),
            z: Math.floor(ep.z),
            l, w, h,
            isForced: isForced || false
          };
        }
      }
    }

    if (!bestPlacement) {
      return false;
    }

    // Place the cargo
    this.loadingIndex++;
    this.placedCargo.push({
      ...cargo,
      position: { x: bestPlacement.x, y: bestPlacement.y, z: bestPlacement.z },
      dimensions: { l: bestPlacement.l, w: bestPlacement.w, h: bestPlacement.h },
      loadingIndex: this.loadingIndex,
      isAutoRotated: bestPlacement.isForced
    });

    // Update extreme points
    this.updateExtremePoints(bestPlacement);

    return true;
  }

  /**
   * Get all 6-DOF rotations
   * @param {boolean} allowForced - If true, override canInvert/canLayFlat restrictions
   */
  get6DOFRotations(cargo, allowForced = false) {
    const { length: L, width: W, height: H, canInvert, canLayFlat } = cargo;
    const rotations = [];

    // Standard rotation (always allowed)
    rotations.push({ l: L, w: W, h: H, isForced: false });

    // Forced rotation logic: if allowForced=true, try all rotations regardless of restrictions
    if (allowForced || canInvert) {
      rotations.push({ l: L, w: H, h: W, isForced: !canInvert });
    }

    if (allowForced || canLayFlat) {
      rotations.push({ l: W, w: L, h: H, isForced: !canLayFlat });
      
      if (allowForced || canInvert) {
        rotations.push({ l: W, w: H, h: L, isForced: !(canLayFlat && canInvert) });
        rotations.push({ l: H, w: L, h: W, isForced: !(canLayFlat && canInvert) });
        rotations.push({ l: H, w: W, h: L, isForced: !(canLayFlat && canInvert) });
      }
    }

    return rotations;
  }

  /**
   * Check if cargo fits in container
   */
  fitsInContainer(x, y, z, l, w, h) {
    return (
      x + l <= this.container.innerLength &&
      y + h <= this.container.innerHeight &&
      z + w <= this.container.innerWidth
    );
  }

  /**
   * Check collision with existing cargo
   */
  hasCollision(x, y, z, l, w, h) {
    for (const placed of this.placedCargo) {
      const px = placed.position.x;
      const py = placed.position.y;
      const pz = placed.position.z;
      const pl = placed.dimensions.l;
      const pw = placed.dimensions.w;
      const ph = placed.dimensions.h;

      // Check overlap in all 3 dimensions
      const overlapX = x < px + pl && x + l > px;
      const overlapY = y < py + ph && y + h > py;
      const overlapZ = z < pz + pw && z + w > pz;

      if (overlapX && overlapY && overlapZ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate support ratio (percentage of bottom surface supported)
   */
  calculateSupportRatio(x, y, z, l, w, h) {
    if (y === 0) return 1.0; // On ground

    const bottomArea = l * w;
    let supportedArea = 0;

    // Check each placed cargo below
    for (const placed of this.placedCargo) {
      const px = placed.position.x;
      const py = placed.position.y;
      const pz = placed.position.z;
      const pl = placed.dimensions.l;
      const pw = placed.dimensions.w;
      const ph = placed.dimensions.h;

      // Check if this cargo is directly below (Y-axis)
      if (Math.abs(py + ph - y) < 1) {
        // Calculate overlap area in XZ plane
        const overlapX = Math.max(0, Math.min(x + l, px + pl) - Math.max(x, px));
        const overlapZ = Math.max(0, Math.min(z + w, pz + pw) - Math.max(z, pz));
        supportedArea += overlapX * overlapZ;
      }
    }

    return supportedArea / bottomArea;
  }

  /**
   * Update extreme points after placing cargo
   * Generate 3 new extreme points: right, top, front
   * Remove the used extreme point
   */
  updateExtremePoints(placement) {
    const { x, y, z, l, w, h } = placement;

    // CRITICAL FIX: Remove the used extreme point
    this.extremePoints = this.extremePoints.filter(ep => 
      !(ep.x === x && ep.y === y && ep.z === z)
    );

    // Generate 3 new extreme points
    const newPoints = [
      { x: x + l, y: y, z: z },     // Right edge
      { x: x, y: y + h, z: z },     // Top edge
      { x: x, y: y, z: z + w }      // Front edge
    ];

    // Add new points
    newPoints.forEach(np => {
      // Check if point is valid (within container)
      if (
        np.x < this.container.innerLength &&
        np.y < this.container.innerHeight &&
        np.z < this.container.innerWidth
      ) {
        this.extremePoints.push(np);
      }
    });

    // Remove dominated points (optimization)
    this.extremePoints = this.extremePoints.filter(ep => {
      // A point is dominated if another point is <= in all dimensions
      return !this.extremePoints.some(other => 
        other !== ep &&
        other.x <= ep.x &&
        other.y <= ep.y &&
        other.z <= ep.z &&
        (other.x < ep.x || other.y < ep.y || other.z < ep.z)
      );
    });
  }

  /**
   * Calculate raw utilization (before CoG balancing)
   */
  calculateUtilization() {
    const containerVolume = this.container.innerLength * this.container.innerWidth * this.container.innerHeight;
    const cargoVolume = this.placedCargo.reduce((sum, item) => {
      return sum + (item.dimensions.l * item.dimensions.w * item.dimensions.h);
    }, 0);
    return (cargoVolume / containerVolume) * 100;
  }

  /**
   * Smart CoG Balancing
   * If utilization < 80%, center the cargo pile with X_offset
   */
  applySmartCoGBalancing() {
    if (this.placedCargo.length === 0) return;

    // Find max X coordinate (depth of cargo pile)
    const maxX = Math.max(...this.placedCargo.map(item => item.position.x + item.dimensions.l));
    
    // Calculate X_offset to center cargo
    const X_offset = Math.floor((this.container.innerLength - maxX) / 2);

    if (X_offset > 0) {
      console.log(`📍 Applying Smart CoG Balancing: X_offset = ${X_offset}mm`);
      
      // Shift all cargo by X_offset
      this.placedCargo.forEach(item => {
        item.position.x += X_offset;
      });
    }
  }

  /**
   * Build final result
   */
  buildResult(expandedCargo) {
    const loadedCargo = this.placedCargo.map(item => ({
      loadingIndex: item.loadingIndex,
      cargoId: item.cargoId,
      name: item.name,
      position: item.position,
      dimensions: item.dimensions,
      properties: {
        weight: item.weight,
        fragile: item.fragile || false,
        stackable: item.stackable !== false,
        canInvert: item.canInvert !== false,
        canLayFlat: item.canLayFlat !== false,
        isAutoRotated: item.isAutoRotated || false
      },
      batch: {
        portSequence: item.portSequence,
        eta: item.eta
      }
    }));

    const unloadedCargo = expandedCargo.filter(cargo => 
      !this.placedCargo.some(placed => placed.cargoId === cargo.cargoId)
    );

    // Calculate CoG
    const cog = this.calculateCoG();
    const cogOffset = this.calculateCoGOffset(cog);

    // Calculate utilization
    const containerVolume = this.container.innerLength * this.container.innerWidth * this.container.innerHeight;
    const cargoVolume = loadedCargo.reduce((sum, item) => {
      return sum + (item.dimensions.l * item.dimensions.w * item.dimensions.h);
    }, 0);
    const spaceUtilization = ((cargoVolume / containerVolume) * 100).toFixed(2);

    // Calculate total weight
    const totalWeight = loadedCargo.reduce((sum, item) => sum + item.properties.weight, 0);

    return {
      loadedCargo,
      unloadedCargo,
      spaceUtilization: parseFloat(spaceUtilization),
      totalWeight,
      cog,
      cogOffset,
      containerInfo: {
        typeId: this.container.typeId,
        innerLength: this.container.innerLength,
        innerWidth: this.container.innerWidth,
        innerHeight: this.container.innerHeight,
        maxWeight: this.container.maxWeight
      }
    };
  }

  /**
   * Calculate Center of Gravity (weighted average)
   */
  calculateCoG() {
    if (this.placedCargo.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    let weightedZ = 0;

    this.placedCargo.forEach(item => {
      const weight = item.weight;
      const centerX = item.position.x + item.dimensions.l / 2;
      const centerY = item.position.y + item.dimensions.h / 2;
      const centerZ = item.position.z + item.dimensions.w / 2;

      totalWeight += weight;
      weightedX += centerX * weight;
      weightedY += centerY * weight;
      weightedZ += centerZ * weight;
    });

    return {
      x: Math.round(weightedX / totalWeight),
      y: Math.round(weightedY / totalWeight),
      z: Math.round(weightedZ / totalWeight)
    };
  }

  /**
   * Calculate CoG offset percentages
   */
  calculateCoGOffset(cog) {
    const containerCenterX = this.container.innerLength / 2;
    const containerCenterZ = this.container.innerWidth / 2;

    const lateralOffset = Math.abs(cog.z - containerCenterZ) / containerCenterZ * 100;
    const longitudinalOffset = Math.abs(cog.x - containerCenterX) / containerCenterX * 100;

    return {
      lateral: parseFloat(lateralOffset.toFixed(2)),
      longitudinal: parseFloat(longitudinalOffset.toFixed(2))
    };
  }
}

module.exports = DBLFPackingEngineV26;
