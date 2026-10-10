const {test}=require('node:test');
const assert=require('node:assert/strict');
const {supportClosedSeed}=require('../services/packing/CommerceRepack');
const {solveCommerce}=require('../services/CommercePackingService');
const {construct,placement}=require('../services/packing/SourceBenchmarkSolver');
const {resolveOrientationRules}=require('../services/packing/OrientationConstraint');
test('repacking fills missing physical IDs instead of duplicating a retained later piece',()=>{
 const source={cargoId:'A',sku:'A',length:400,width:300,height:300,quantity:3,weight:5,stackable:false};
 const o=resolveOrientationRules(source).orientations[0].semanticVariants[0];
 const seed=placement(source,o,3,{x:0,y:0,z:0});
 const p=construct({cargoList:[source],container:{innerLength:2000,innerWidth:1000,innerHeight:1000,maxWeight:1000},rules:{supportRatio:1,stacking:true,weightKnown:true,payload:true}},'block-wall',Date.now()+1000,{seed:[seed]});
 assert.equal(p.validator.valid,true);assert.equal(p.placements.length,3);assert.equal(new Set(p.placements.map(x=>x.cargoId)).size,3);assert.equal(p.placements[0].cargoId,seed.cargoId);
});
test('local reconstruction removes dependent stacks but cannot displace a locked item',()=>{
 const p=[{cargoId:'a',x:0,y:0,z:0,l:400,w:400,h:400},{cargoId:'b',x:0,y:400,z:0,l:400,w:400,h:400},{cargoId:'c',x:400,y:0,z:0,l:400,w:400,h:400}];
 assert.deepEqual(supportClosedSeed(p,['a']).map(c=>c.cargoId),['c']);
 assert.equal(supportClosedSeed(p,['a'],[p[1]]),null);
});
test('an indivisible oversized order is deferred while another seller can load',async()=>{
 const arrivedAt='2026-09-16T09:00:00+08:00';
 const base={width:400,height:400,weight:5,quantity:1,arrivedAt,stackable:false,unloadSequence:1,required:true,allowPartialShipment:false,orderId:'SAME-ID'};
 const cargoList=[{...base,cargoId:'small',sku:'small',customerId:'A',length:400},{...base,cargoId:'large',sku:'large',customerId:'A',length:14000},{...base,cargoId:'other',sku:'other',customerId:'B',length:400}];
 const p=await solveCommerce({containerType:'20GP',cargoList,timeLimitMs:1000,caseContext:{commerce:{enabled:true,lifo:true,planAt:arrivedAt}}});
 assert.deepEqual(p.loadedCargo.map(c=>c.sourceCargoId),['other']);
 assert.equal(p.commerce.fulfillment.splitViolations.length,0);assert.equal(p.totalCargoInput,3);assert.equal(p.validator.valid,true);
});
