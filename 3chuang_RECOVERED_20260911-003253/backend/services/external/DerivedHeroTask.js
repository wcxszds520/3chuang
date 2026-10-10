'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function applyDerivedHeroTask(task,id){
 const registry=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../data/external/derived/external-hero-v1/registry.json')));
 if(id!==registry.derivedDemoId||task.source!==registry.source||task.instanceId!==registry.instanceId)throw Object.assign(new Error('Unknown derived demo'),{code:'UNKNOWN_DERIVED_DEMO'});
 const cargoList=registry.rows.map(row=>{
  const c=task.cargoList.find(c=>c.sku===row.sourceCargoId);
  if(!c||c.quantity!==row.originalQuantity||!Number.isInteger(row.selectedQuantity)||row.selectedQuantity<1||row.selectedQuantity>c.quantity||JSON.stringify([c.length,c.width,c.height])!==JSON.stringify(row.originalDimensionsMm)||c.weight!==row.originalWeightKg||JSON.stringify(c.orientationConstraints)!==JSON.stringify(row.orientationConstraints))throw Object.assign(new Error('Derived source reference no longer matches immutable source'),{code:'DERIVED_SOURCE_MISMATCH'});
  return {...c,quantity:row.selectedQuantity};
 });
 const container={...registry.container};
 return {...task,cargoList,container,containers:[container],derivedTaskId:id,taskType:registry.taskType,derivation:registry,capabilities:{...task.capabilities,benchmarkMode:'DERIVED_SINGLE_CONTAINER_DEMO',fullSourceProblem:false},factsFingerprint:crypto.createHash('sha256').update(JSON.stringify({cargoList,container,rules:task.rules})).digest('hex')};
}
module.exports={applyDerivedHeroTask};
