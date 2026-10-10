/**
 * 3D Gap Diagnostic Tool
 * 
 * Purpose: Diagnose why user sees gaps in 3D rendering despite zero-gap algorithm
 */

const Realistic4DPackingEngine = require('../services/Realistic4DPackingEngine');

async function runDiagnostic() {
  console.log('🔬 3D Gap Diagnostic Tool\n');
  console.log('=' .repeat(80));

  // Test container: 20GP
  const container = {
    typeId: '20GP',
    innerLength: 5898,
    innerWidth: 2352,
    innerHeight: 2393
  };

  // Test cargo: 3 batches
  const testCargo = [
    // Batch 1: Port 3 (后卸)
    { id: 'B1-1', length: 1200, width: 1000, height: 1000, weight: 500, portSequence: 3, cargoType: 'A' },
    { id: 'B1-2', length: 1200, width: 1000, height: 1000, weight: 500, portSequence: 3, cargoType: 'A' },
    
    // Batch 2: Port 2 (中卸)
    { id: 'B2-1', length: 1200, width: 1000, height: 1000, weight: 500, portSequence: 2, cargoType: 'B' },
    { id: 'B2-2', length: 1200, width: 1000, height: 1000, weight: 500, portSequence: 2, cargoType: 'B' },
    
    // Batch 3: Port 1 (先卸)
    { id: 'B3-1', length: 1200, width: 1000, height: 1000, weight: 500, portSequence: 1, cargoType: 'C' },
    { id: 'B3-2', length: 1200, width: 1000, height: 1000, weight: 500, portSequence: 1, cargoType: 'C' }
  ];

  console.log('\n📦 Test Configuration:');
  console.log(`   Container: ${container.typeId} (${container.innerLength}×${container.innerWidth}×${container.innerHeight}mm)`);
  console.log(`   Cargo: 6 items in 3 batches`);

  // Run packing
  const engine = new Realistic4DPackingEngine({ debugMode: false });
  const result = await engine.generatePackingPlan(testCargo, container);

  console.log('\n✅ Packing Complete');
  console.log(`   Utilization: ${result.spaceUtilization.toFixed(2)}%`);
  console.log(`   Placed: ${result.loadedCargo.length}/${testCargo.length} items`);

  // Analyze 3D rendering positions
  console.log('\n🎨 3D Rendering Analysis:');
  console.log('=' .repeat(80));
  console.log('\nFrontend receives these coordinates (already inverted for LIFO):');

  // Group by port sequence
  const batches = {
    1: result.loadedCargo.filter(p => p.portSequence === 1),
    2: result.loadedCargo.filter(p => p.portSequence === 2),
    3: result.loadedCargo.filter(p => p.portSequence === 3)
  };

  for (const [port, items] of Object.entries(batches).sort((a, b) => b[0] - a[0])) {
    if (items.length === 0) continue;
    
    console.log(`\n📦 Batch ${port} (Port ${port}):`);
    
    items.forEach(item => {
      // Calculate 3D mesh center position (what ThreeJS renders)
      const meshCenterX = item.x + item.l / 2;
      const meshCenterY = item.y + item.h / 2;
      const meshCenterZ = item.z + item.w / 2;
      
      // Calculate 3D mesh boundaries
      const meshMinX = item.x;
      const meshMaxX = item.x + item.l;
      
      console.log(`   ${item.cargoId}:`);
      console.log(`      Frontend coords: X=${item.x}, Y=${item.y}, Z=${item.z}, L=${item.l}, H=${item.h}, W=${item.w}`);
      console.log(`      3D mesh center: (${meshCenterX}, ${meshCenterY}, ${meshCenterZ})`);
      console.log(`      3D mesh X range: ${meshMinX} → ${meshMaxX}`);
    });
  }

  // Check gaps in 3D space
  console.log('\n📏 3D Space Gap Analysis:');
  console.log('=' .repeat(80));

  const boundaries = {};
  for (const [port, items] of Object.entries(batches)) {
    if (items.length === 0) continue;
    
    const minX = Math.min(...items.map(p => p.x));
    const maxX = Math.max(...items.map(p => p.x + p.l));
    
    boundaries[port] = { minX, maxX };
  }

  // Check gaps
  let hasGaps = false;

  if (boundaries[3] && boundaries[2]) {
    const gap = boundaries[2].minX - boundaries[3].maxX;
    console.log(`\nGap between Batch 3 (Port 3) and Batch 2 (Port 2):`);
    console.log(`   Batch 3 maxX: ${boundaries[3].maxX}`);
    console.log(`   Batch 2 minX: ${boundaries[2].minX}`);
    console.log(`   Gap: ${gap} mm ${gap === 0 ? '✅' : '❌'}`);
    if (gap !== 0) hasGaps = true;
  }

  if (boundaries[2] && boundaries[1]) {
    const gap = boundaries[1].minX - boundaries[2].maxX;
    console.log(`\nGap between Batch 2 (Port 2) and Batch 1 (Port 1):`);
    console.log(`   Batch 2 maxX: ${boundaries[2].maxX}`);
    console.log(`   Batch 1 minX: ${boundaries[1].minX}`);
    console.log(`   Gap: ${gap} mm ${gap === 0 ? '✅' : '❌'}`);
    if (gap !== 0) hasGaps = true;
  }

  // Conclusion
  console.log('\n' + '=' .repeat(80));
  if (hasGaps) {
    console.log('❌ GAPS DETECTED in frontend coordinates!');
    console.log('   This explains why user sees gaps in 3D rendering.');
    console.log('   The issue is in the coordinate inversion logic.');
  } else {
    console.log('✅ NO GAPS in frontend coordinates!');
    console.log('   The algorithm is working correctly.');
    console.log('   If user still sees gaps, the issue might be:');
    console.log('   1. Browser cache (user needs to clear cache)');
    console.log('   2. Old backend version running');
    console.log('   3. Frontend rendering precision issue');
  }
  console.log('=' .repeat(80));
}

runDiagnostic().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
