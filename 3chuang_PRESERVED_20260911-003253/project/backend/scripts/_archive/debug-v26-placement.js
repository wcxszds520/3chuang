/**
 * Debug v26.2 Placement Logic
 * Test with single cargo to understand why placement fails
 */

const DBLFPackingEngine = require('../services/DBLFPackingEngine-v26.2');
const Cargo = require('../models/Cargo');

const container20GP = {
  typeId: '20GP',
  name: '20GP标准柜',
  innerLength: 5898,
  innerWidth: 2352,
  innerHeight: 2393,
  maxWeight: 28000
};

// Two cargo test
const singleCargo = [
  new Cargo({ 
    cargoId: 'TEST1', 
    name: 'Test Box', 
    length: 1000, 
    width: 800, 
    height: 600, 
    weight: 50, 
    quantity: 2, // Test with 2 items
    portSequence: 1, 
    eta: '2024-03-01',
    canInvert: true,
    canLayFlat: true
  })
];

async function debugPlacement() {
  console.log('\n🔍 DEBUG: Single Cargo Placement Test');
  console.log('Container:', container20GP.name);
  console.log('Cargo:', singleCargo[0]);
  
  const engine = new DBLFPackingEngine();
  const result = await engine.generatePackingPlan(singleCargo, container20GP);
  
  console.log('\n📊 Result:');
  console.log('Loaded:', result.loadedCargo.length);
  console.log('Unloaded:', result.unloadedCargo.length);
  console.log('Utilization:', result.spaceUtilization + '%');
  
  if (result.loadedCargo.length > 0) {
    console.log('\n✅ Cargo placed successfully:');
    console.log(result.loadedCargo[0]);
  } else {
    console.log('\n❌ Cargo placement FAILED');
    console.log('Unloaded cargo:', result.unloadedCargo[0]);
  }
}

debugPlacement().catch(console.error);
