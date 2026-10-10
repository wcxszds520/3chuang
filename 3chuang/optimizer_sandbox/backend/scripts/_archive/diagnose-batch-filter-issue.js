/**
 * Diagnostic Script: Batch Filter Issue
 * 
 * Purpose: Verify that batchId is properly preserved through the full stack
 * 
 * Expected Behavior:
 * 1. Backend API returns loadedCargo with batchId field
 * 2. Frontend stores batchKey in cargo objects
 * 3. ThreeRenderer stores batch in userData
 * 4. updateVisibility checks userData.batchKey (BUG!)
 */

const axios = require('axios');

async function diagnoseBatchFilterIssue() {
  console.log('\n=== BATCH FILTER DIAGNOSTIC ===\n');
  
  // Test cargo with multiple batches
  const testCargo = [
    {
      name: '洗衣机A',
      sku: 'WM-001',
      length: 60,
      width: 60,
      height: 85,
      weight: 70,
      quantity: 5,
      packagingType: 'appliance',
      batchId: 'batch_001',
      portSequence: 1
    },
    {
      name: '冰箱B',
      sku: 'RF-002',
      length: 70,
      width: 70,
      height: 180,
      weight: 90,
      quantity: 3,
      packagingType: 'appliance',
      batchId: 'batch_002',
      portSequence: 2
    },
    {
      name: '微波炉C',
      sku: 'MW-003',
      length: 50,
      width: 40,
      height: 30,
      weight: 15,
      quantity: 10,
      packagingType: 'carton',
      batchId: 'batch_003',
      portSequence: 3
    }
  ];
  
  console.log('Step 1: Sending cargo with batchId to API...');
  console.log('Input cargo batches:', testCargo.map(c => ({ name: c.name, batchId: c.batchId })));
  
  const response = await axios.post('http://localhost:3000/api/packing/generate', {
    cargoList: testCargo,
    containerType: '40HQ'
  });
  
  const data = response.data.data;
  
  console.log('\nStep 2: Checking API response...');
  console.log(`Total loaded cargo: ${data.loadedCargo.length}`);
  
  // Check if batchId is preserved
  const batchIdCheck = data.loadedCargo.every(item => item.batchId);
  console.log(`✓ All cargo have batchId: ${batchIdCheck ? 'YES' : 'NO'}`);
  
  if (!batchIdCheck) {
    console.error('❌ CRITICAL: Some cargo missing batchId!');
    const missingBatch = data.loadedCargo.filter(item => !item.batchId);
    console.error('Missing batchId count:', missingBatch.length);
    console.error('Sample:', missingBatch.slice(0, 3));
  }
  
  // Check batch distribution
  const batchDistribution = {};
  data.loadedCargo.forEach(item => {
    const batch = item.batchId || 'MISSING';
    batchDistribution[batch] = (batchDistribution[batch] || 0) + 1;
  });
  
  console.log('\nStep 3: Batch distribution in response:');
  Object.entries(batchDistribution).forEach(([batch, count]) => {
    console.log(`  ${batch}: ${count} items`);
  });
  
  // Check if batchKey is also present (frontend compatibility)
  const batchKeyCheck = data.loadedCargo.every(item => item.batchKey);
  console.log(`\n✓ All cargo have batchKey: ${batchKeyCheck ? 'YES' : 'NO'}`);
  
  // Simulate frontend processing
  console.log('\nStep 4: Simulating frontend batch mapping...');
  const batchMap = {};
  data.loadedCargo.forEach(item => {
    const batchKey = item.batchKey || item.batchId || 'default';
    if (!batchMap[batchKey]) {
      batchMap[batchKey] = {
        batchKey: batchKey,
        label: `批次 ${batchKey}`,
        count: 0
      };
    }
    batchMap[batchKey].count++;
  });
  
  console.log('Frontend batch mapping:');
  Object.values(batchMap).forEach(batch => {
    console.log(`  ${batch.label}: ${batch.count} items`);
  });
  
  // Simulate ThreeRenderer userData
  console.log('\nStep 5: Simulating ThreeRenderer userData...');
  const sampleCargo = data.loadedCargo[0];
  const simulatedUserData = {
    cargoId: sampleCargo.cargoId,
    name: sampleCargo.name,
    sku: sampleCargo.sku,
    batch: sampleCargo.batchKey || sampleCargo.batchId,  // This is what renderIndustrialCargo does
    type: sampleCargo.type
  };
  
  console.log('Sample userData:', simulatedUserData);
  
  // Simulate updateVisibility check
  console.log('\nStep 6: Simulating updateVisibility filter...');
  const activeBatches = ['batch_001', 'batch_002'];  // User selected these
  
  // BUG: updateVisibility checks userData.batchKey, but userData has .batch
  const buggyCheck = activeBatches.includes(simulatedUserData.batchKey);
  const correctCheck = activeBatches.includes(simulatedUserData.batch);
  
  console.log(`Buggy check (userData.batchKey): ${buggyCheck ? 'VISIBLE' : 'HIDDEN'}`);
  console.log(`Correct check (userData.batch): ${correctCheck ? 'VISIBLE' : 'HIDDEN'}`);
  
  if (buggyCheck !== correctCheck) {
    console.error('\n❌ BUG CONFIRMED: userData.batchKey is undefined!');
    console.error('   updateVisibility should check userData.batch instead');
  } else {
    console.log('\n✓ No bug detected in this scenario');
  }
  
  console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
  
  // Summary
  console.log('SUMMARY:');
  console.log('1. Backend preserves batchId:', batchIdCheck ? '✓' : '❌');
  console.log('2. Backend provides batchKey:', batchKeyCheck ? '✓' : '❌');
  console.log('3. Frontend mapping works:', Object.keys(batchMap).length > 0 ? '✓' : '❌');
  console.log('4. ThreeRenderer userData.batch:', simulatedUserData.batch ? '✓' : '❌');
  console.log('5. updateVisibility bug:', buggyCheck !== correctCheck ? '❌ CONFIRMED' : '✓');
  
  process.exit(0);
}

diagnoseBatchFilterIssue().catch(error => {
  console.error('Diagnostic failed:', error);
  process.exit(1);
});
