/**
 * v34.0 Critical Issues Diagnosis
 * 
 * Issues to diagnose:
 * 1. Low utilization (284/587 cargo not placed)
 * 2. All cargo classified as "heavy"
 * 3. Zonal separation too restrictive
 */

const Realistic4DPackingEngine = require('../services/Realistic4DPackingEngine');
const Cargo = require('../models/Cargo');

async function diagnose() {
  console.log('\n🔍 v34.0 Critical Issues Diagnosis\n');
  console.log('='.repeat(80));
  
  // Create test cargo with mixed types
  const testCargo = [
    // Normal cargo (weight < 20, not fragile)
    new Cargo({
      cargoId: 'NORMAL_1',
      name: 'Normal Box 1',
      length: 1000,
      width: 800,
      height: 600,
      weight: 10,  // < 20kg
      quantity: 1,
      packagingType: 'cardboard',
      fragile: false,
      portSequence: 1,
      batchId: 'batch_1'
    }),
    
    // Heavy cargo (weight >= 20)
    new Cargo({
      cargoId: 'HEAVY_1',
      name: 'Heavy Box 1',
      length: 1000,
      width: 800,
      height: 600,
      weight: 25,  // >= 20kg
      quantity: 1,
      packagingType: 'wooden',
      fragile: false,
      portSequence: 1,
      batchId: 'batch_1'
    }),
    
    // Fragile cargo
    new Cargo({
      cargoId: 'FRAGILE_1',
      name: 'Fragile Box 1',
      length: 1000,
      width: 800,
      height: 600,
      weight: 15,
      quantity: 1,
      packagingType: 'glass',
      fragile: true,  // Fragile flag
      portSequence: 1,
      batchId: 'batch_1'
    }),
    
    // Batch 2 cargo
    new Cargo({
      cargoId: 'BATCH2_1',
      name: 'Batch 2 Normal',
      length: 1000,
      width: 800,
      height: 600,
      weight: 12,
      quantity: 1,
      packagingType: 'cardboard',
      fragile: false,
      portSequence: 2,
      batchId: 'batch_2'
    }),
    
    // Batch 3 cargo
    new Cargo({
      cargoId: 'BATCH3_1',
      name: 'Batch 3 Normal',
      length: 1000,
      width: 800,
      height: 600,
      weight: 8,
      quantity: 1,
      packagingType: 'cardboard',
      fragile: false,
      portSequence: 3,
      batchId: 'batch_3'
    })
  ];
  
  console.log('\n📦 Test Cargo Summary:');
  testCargo.forEach(cargo => {
    console.log(`  - ${cargo.cargoId}: weight=${cargo.weight}kg, fragile=${cargo.fragile}, portSeq=${cargo.portSequence}`);
  });
  
  // Test mapPackagingTypeToFrontend
  console.log('\n\n🔬 Testing mapPackagingTypeToFrontend:');
  console.log('-'.repeat(80));
  
  const engine = new Realistic4DPackingEngine({ debugMode: true });
  
  testCargo.forEach((cargo, index) => {
    const mappedType = engine.mapPackagingTypeToFrontend(
      cargo.packagingType,
      cargo.weight,
      cargo.fragile
    );
    
    console.log(`\n[${index + 1}] ${cargo.cargoId}:`);
    console.log(`    Input:  packagingType="${cargo.packagingType}", weight=${cargo.weight}, fragile=${cargo.fragile}`);
    console.log(`    Output: type="${mappedType}"`);
    console.log(`    Expected: ${getExpectedType(cargo)}`);
    console.log(`    Match: ${mappedType === getExpectedType(cargo) ? '✅' : '❌'}`);
  });
  
  // Test with 20GP container
  console.log('\n\n🚢 Testing Packing with 20GP Container:');
  console.log('-'.repeat(80));
  
  try {
    const result = await engine.generatePackingPlan(testCargo, '20GP');
    
    console.log(`\n📊 Packing Results:`);
    console.log(`  - Loaded: ${result.loadedCargo.length}/${testCargo.length}`);
    console.log(`  - Unloaded: ${result.unloadedCargo.length}`);
    console.log(`  - Utilization: ${result.spaceUtilization.toFixed(2)}%`);
    
    console.log(`\n📦 Loaded Cargo Types:`);
    const typeCounts = { heavy: 0, normal: 0, fragile: 0, unknown: 0 };
    result.loadedCargo.forEach(cargo => {
      typeCounts[cargo.type] = (typeCounts[cargo.type] || 0) + 1;
      console.log(`  - ${cargo.cargoId}: type="${cargo.type}" (weight=${cargo.weight}, fragile=${cargo.fragile})`);
    });
    
    console.log(`\n📈 Type Distribution:`);
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });
    
    console.log(`\n🗺️ Position Distribution by Batch:`);
    const batchPositions = {};
    result.loadedCargo.forEach(cargo => {
      const batch = cargo.portSequence || 1;
      if (!batchPositions[batch]) batchPositions[batch] = [];
      batchPositions[batch].push(cargo.x);
    });
    
    Object.entries(batchPositions).forEach(([batch, positions]) => {
      const avgX = positions.reduce((a, b) => a + b, 0) / positions.length;
      const minX = Math.min(...positions);
      const maxX = Math.max(...positions);
      console.log(`  - Batch ${batch}: avgX=${avgX.toFixed(0)}mm, range=[${minX.toFixed(0)}, ${maxX.toFixed(0)}]`);
    });
    
  } catch (error) {
    console.error(`\n❌ Packing Error: ${error.message}`);
    console.error(error.stack);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Diagnosis Complete\n');
}

function getExpectedType(cargo) {
  if (cargo.fragile === true) return 'fragile';
  if (cargo.weight >= 20) return 'heavy';
  return 'normal';
}

// Run diagnosis
diagnose().catch(console.error);
