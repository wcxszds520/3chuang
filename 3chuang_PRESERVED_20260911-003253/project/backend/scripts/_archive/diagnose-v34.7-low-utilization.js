/**
 * v34.7 Low Utilization Diagnostic
 * 
 * Investigates why only 40/400 items are being placed
 */

const Realistic4DPackingEngine = require('../services/Realistic4DPackingEngine');

console.log('================================================================================');
console.log('🔍 v34.7 Low Utilization Diagnostic');
console.log('================================================================================\n');

// Test container: 40HQ
const container = {
  typeId: '40HQ',
  innerLength: 12032,
  innerWidth: 2352,
  innerHeight: 2698
};

// Start with a small test: 10 items
const testCargo = [];

for (let i = 0; i < 10; i++) {
  testCargo.push({
    id: `TEST-${i+1}`,
    length: 1200,
    width: 1000,
    height: 1000,
    weight: 500,
    portSequence: 1,
    cargoType: 'A'
  });
}

console.log(`📦 Test Configuration:`);
console.log(`   Container: ${container.typeId} (${container.innerLength}×${container.innerWidth}×${container.innerHeight}mm)`);
console.log(`   Container volume: ${(container.innerLength * container.innerWidth * container.innerHeight / 1e9).toFixed(2)}m³`);
console.log(`   Total cargo: ${testCargo.length} items`);
console.log(`   Cargo dimensions: 1200×1000×1000mm`);
console.log(`   Cargo volume per item: ${(1200 * 1000 * 1000 / 1e9).toFixed(2)}m³`);
console.log(`   Total cargo volume: ${(testCargo.length * 1200 * 1000 * 1000 / 1e9).toFixed(2)}m³`);

async function runDiagnostic() {
  console.log('\n⏱️  Starting diagnostic...\n');
  
  const engine = new Realistic4DPackingEngine({ debugMode: true });
  const result = await engine.generatePackingPlan(testCargo, container);
  
  console.log('\n✅ Packing Complete\n');
  console.log(`📊 Results:`);
  console.log(`   Placed: ${result.loadedCargo.length}/${testCargo.length} items`);
  console.log(`   Utilization: ${result.spaceUtilization.toFixed(2)}%`);
  
  // Analyze placement
  if (result.loadedCargo.length > 0) {
    console.log('\n📍 Placement Analysis:');
    
    // Convert to internal coordinates
    const internalCargo = result.loadedCargo.map(item => ({
      ...item,
      internalX: container.innerLength - (item.x + item.l),
      internalXEnd: container.innerLength - item.x
    }));
    
    // Find X range
    const minX = Math.min(...internalCargo.map(p => p.internalX));
    const maxX = Math.max(...internalCargo.map(p => p.internalXEnd));
    
    console.log(`   X Range: ${minX} → ${maxX} mm (span: ${maxX - minX}mm)`);
    
    // Find Y range
    const minY = Math.min(...result.loadedCargo.map(p => p.y));
    const maxY = Math.max(...result.loadedCargo.map(p => p.y + p.h));
    
    console.log(`   Y Range: ${minY} → ${maxY} mm (span: ${maxY - minY}mm)`);
    
    // Find Z range
    const minZ = Math.min(...result.loadedCargo.map(p => p.z));
    const maxZ = Math.max(...result.loadedCargo.map(p => p.z + p.w));
    
    console.log(`   Z Range: ${minZ} → ${maxZ} mm (span: ${maxZ - minZ}mm)`);
    
    // Calculate theoretical capacity
    const xCapacity = Math.floor(container.innerLength / 1200);
    const yCapacity = Math.floor(container.innerHeight / 1000);
    const zCapacity = Math.floor(container.innerWidth / 1000);
    
    console.log('\n📐 Theoretical Capacity:');
    console.log(`   X-axis: ${xCapacity} items (${container.innerLength} / 1200)`);
    console.log(`   Y-axis: ${yCapacity} layers (${container.innerHeight} / 1000)`);
    console.log(`   Z-axis: ${zCapacity} items (${container.innerWidth} / 1000)`);
    console.log(`   Total: ${xCapacity * yCapacity * zCapacity} items`);
    
    // Check if we're hitting height limit
    if (maxY >= container.innerHeight - 1000) {
      console.log('\n⚠️  HEIGHT LIMIT REACHED');
      console.log(`   Current max Y: ${maxY}mm`);
      console.log(`   Container height: ${container.innerHeight}mm`);
      console.log(`   Remaining height: ${container.innerHeight - maxY}mm`);
    }
    
    // Check if we're hitting width limit
    if (maxZ >= container.innerWidth - 1000) {
      console.log('\n⚠️  WIDTH LIMIT REACHED');
      console.log(`   Current max Z: ${maxZ}mm`);
      console.log(`   Container width: ${container.innerWidth}mm`);
      console.log(`   Remaining width: ${container.innerWidth - maxZ}mm`);
    }
    
    // Check if we're hitting length limit
    if (maxX >= container.innerLength - 1200) {
      console.log('\n⚠️  LENGTH LIMIT REACHED');
      console.log(`   Current max X: ${maxX}mm`);
      console.log(`   Container length: ${container.innerLength}mm`);
      console.log(`   Remaining length: ${container.innerLength - maxX}mm`);
    }
  }
  
  // Analyze unloaded cargo
  if (result.unloadedCargo.length > 0) {
    console.log('\n❌ Unloaded Cargo Analysis:');
    console.log(`   Count: ${result.unloadedCargo.length} items`);
    console.log(`   Reason: Insufficient space (collision or boundary violation)`);
    
    // Possible reasons:
    console.log('\n🔍 Possible Reasons:');
    console.log('   1. Collision detection too strict');
    console.log('   2. Support check too strict (100% support required)');
    console.log('   3. Vertical batch constraint blocking placement');
    console.log('   4. Volume overflow protection triggered');
    console.log('   5. Candidate generation not covering all valid positions');
  }
  
  console.log('\n' + '=' .repeat(80));
}

runDiagnostic().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
