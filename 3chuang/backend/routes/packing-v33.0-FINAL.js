/**
 * Packing Route - v33.0 FINAL MASTER BUNDLE
 * 
 * 🎯 INTERFACE CONTRACT (LOCKED):
 * ✅ Flat structure: loadedCargo[].{x, y, z, l, h, w, color, type, loadingIndex}
 * ✅ Utilization = (loaded volume / container volume) * 100
 * ✅ Compliance badge: EXCELLENT only when lateral offset ≤ 5%
 * ✅ No nested objects (position, dimensions, properties)
 */

const express = require('express');
const router = express.Router();
const Cargo = require('../models/Cargo');
const ContainerType = require('../models/ContainerType');
const Realistic4DPackingEngine = require('../services/Realistic4DPackingEngine');
const db = require('../config/database');

router.post('/generate', async (req, res) => {
  const requestId = `REQ_${Date.now()}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 [${requestId}] Packing Request Started`);
  console.log(`${'='.repeat(80)}`);
  
  try {
    const { cargoList: cargoDataList, containerType: containerTypeId } = req.body;

    if (!cargoDataList || !Array.isArray(cargoDataList) || cargoDataList.length === 0) {
      return res.status(400).json({ 
        code: 400, 
        message: 'Cargo list is required and must be non-empty' 
      });
    }
    
    if (!containerTypeId) {
      return res.status(400).json({ 
        code: 400, 
        message: 'Container type is required' 
      });
    }

    // v33.0: Build cargo objects with strict validation
    const cargoList = cargoDataList.map(data => new Cargo({
      cargoId: data.cargoId || `cargo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name: String(data.name || ''),
      length: Number(data.length),
      width: Number(data.width),
      height: Number(data.height),
      weight: Number(data.weight),
      quantity: Number(data.quantity || 1),
      stackable: Boolean(data.stackable !== false),
      maxStackLayers: Number(data.maxStackLayers || 3),
      canInvert: Boolean(data.canInvert !== false),
      canLayFlat: Boolean(data.canLayFlat !== false),
      packagingType: String(data.packagingType || 'wooden'),
      fragile: Boolean(data.fragile || false),
      sku: String(data.sku || data.name || ''),
      portSequence: Number(data.portSequence || 1),
      batchId: String(data.batchId || `batch_${data.portSequence || 1}`),
      eta: data.eta || null
    }));

    // v33.0: Query container from database
    const [containerRows] = await db.query(
      `SELECT 
        type_id AS typeId,
        name,
        inner_length AS innerLength,
        inner_width AS innerWidth,
        inner_height AS innerHeight,
        max_weight AS maxWeight,
        description
      FROM container_type
      WHERE type_id = ?`,
      [containerTypeId]
    );
    
    if (!containerRows || containerRows.length === 0) {
      return res.status(404).json({ 
        code: 404, 
        message: `Container type ${containerTypeId} not found` 
      });
    }
    
    const containerData = containerRows[0];
    const container = new ContainerType(containerData);

    console.log(`🏗️ [${requestId}] Running Realistic4DPackingEngine v33.0`);
    console.log(`   Container: ${container.typeId} (${container.innerLength}×${container.innerWidth}×${container.innerHeight}mm)`);
    console.log(`   Cargo items: ${cargoList.length}`);
    
    const engine = new Realistic4DPackingEngine({ debugMode: false });
    const result = await engine.generatePackingPlan(cargoList, containerTypeId);

    console.log(`✅ [${requestId}] Packing complete`);
    console.log(`   - Loaded: ${result.loadedCargo.length}`);
    console.log(`   - Utilization: ${result.spaceUtilization.toFixed(2)}%`);
    console.log(`   - CoG lateral: ${result.cogOffset.lateral.toFixed(2)}%`);

    // v33.0: Verify utilization calculation
    const containerVolume = container.innerLength * container.innerWidth * container.innerHeight;
    const loadedVolume = result.loadedCargo.reduce((sum, item) => 
      sum + (item.l * item.w * item.h), 0
    );
    const verifiedUtilization = (loadedVolume / containerVolume) * 100;

    console.log(`🔍 [${requestId}] Verification:`);
    console.log(`   - Engine: ${result.spaceUtilization.toFixed(2)}%`);
    console.log(`   - Verified: ${verifiedUtilization.toFixed(2)}%`);
    console.log(`   - Match: ${Math.abs(result.spaceUtilization - verifiedUtilization) < 0.01 ? '✅' : '❌'}`);

    if (result.warnings?.length > 0) {
      console.log(`⚠️ [${requestId}] Warnings:`);
      result.warnings.forEach(w => console.log(`   - ${w.type}: ${w.message}`));
    }

    // v33.0: Compliance badge (≤5% lateral offset = EXCELLENT)
    const isCompliant = result.cogOffset.lateral <= 5.0;
    const complianceStatus = isCompliant ? 'EXCELLENT' : 'WARNING';
    
    // v33.0: Build response with FLAT structure
    const response = {
      code: 200,
      message: 'Packing plan generated successfully',
      data: {
        planId: requestId,
        containerInfo: {
          typeId: container.typeId,
          name: container.name,
          innerLength: container.innerLength,
          innerWidth: container.innerWidth,
          innerHeight: container.innerHeight,
          maxWeight: container.maxWeight
        },
        // v33.0: FLAT STRUCTURE - NO NESTED OBJECTS
        loadedCargo: result.loadedCargo.map(cargo => ({
          loadingIndex: cargo.loadingIndex,
          name: cargo.name,
          cargoId: cargo.cargoId,
          x: cargo.x,
          y: cargo.y,
          z: cargo.z,
          l: cargo.l,
          h: cargo.h,
          w: cargo.w,
          color: cargo.color,
          type: cargo.type,
          weight: cargo.weight,
          batchId: cargo.batchId,
          portSequence: cargo.portSequence,
          sku: cargo.sku
        })),
        unloadedCargo: result.unloadedCargo.map(cargo => ({
          name: cargo.name,
          cargoId: cargo.cargoId,
          length: cargo.length,
          width: cargo.width,
          height: cargo.height,
          weight: cargo.weight,
          quantity: cargo.quantity,
          reason: 'Insufficient space'
        })),
        // v33.0: Real utilization calculation
        spaceUtilization: Math.min(verifiedUtilization, 100),
        totalWeight: result.totalWeight,
        totalCargoCount: result.loadedCargo.length,
        cog: result.cog,
        cogOffset: result.cogOffset,
        metrics: result.metrics,
        warnings: result.warnings || [],
        // v33.0: Compliance badge (≤5% = EXCELLENT)
        compliance: {
          status: complianceStatus,
          badge: isCompliant ? '✅ EXCELLENT (≤5%)' : '⚠️ WARNING (>5%)',
          lateralOffset: result.cogOffset.lateral.toFixed(2),
          threshold: 5.0
        },
        timestamp: new Date().toISOString()
      }
    };

    console.log(`${'='.repeat(80)}`);
    console.log(`✅ [${requestId}] Response sent`);
    console.log(`${'='.repeat(80)}\n`);

    res.json(response);

  } catch (error) {
    console.error(`❌ [${requestId}] Error:`, error.message);
    console.error(error.stack);
    
    res.status(500).json({
      code: 500,
      message: 'Internal server error during packing calculation',
      error: error.message
    });
  }
});

module.exports = router;
