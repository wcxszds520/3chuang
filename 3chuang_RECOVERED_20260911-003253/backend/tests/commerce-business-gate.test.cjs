const {test}=require('node:test');
const assert=require('node:assert/strict');
const {solveCommerce}=require('../services/CommercePackingService');
const {auditCommerce}=require('../services/packing/CommerceAudit');
const api=()=>import('../../shared/commerceBusiness.mjs');
const planAt='2026-09-16T12:00:00+08:00';
const item=(cargoId,patch={})=>({cargoId,sku:cargoId,name:'零售配件',length:400,width:300,height:300,quantity:1,weight:5,arrivedAt:planAt,stackable:false,unloadSequence:1,...patch});
const solve=cargoList=>solveCommerce({containerType:'20GP',cargoList,caseContext:{commerce:{enabled:true,lifo:true,planAt}},timeLimitMs:1000});

test('unknown arrivals stay outside, preserve quantity and are never marked passed',async()=>{
 const rows=[item('known'),item('unknown',{arrivedAt:null}),item('late',{arrivedAt:'2026-09-17T12:00:00+08:00'})];
 const frozen=JSON.stringify(rows),p=await solve(rows);
 assert.equal(p.loadedCargo.length,1);assert.equal(p.totalCargoInput,3);
 assert.deepEqual(p.unloadedCargo.map(c=>c.reason).sort(),['ARRIVAL_UNKNOWN','NOT_ARRIVED']);
 assert.equal(p.constraintMeta.arrivalPass,null);assert.equal(p.hardConstraintsPass,false);
 assert.equal(p.commerce.withheldCount,1);assert.equal(p.commerce.arrivalUnknownCount,1);
 assert.equal(JSON.stringify(rows),frozen);
});
test('a fully unknown order returns an empty, reviewable plan rather than inventing arrival',async()=>{
 const p=await solve([item('unknown',{arrivedAt:''})]);
 assert.equal(p.loadedCargo.length,0);assert.equal(p.unloadedCargo.length,1);assert.equal(p.spaceUtilization,0);
});
test('independent audit rejects unknown cargo already in a placement',()=>{
 const p={...item('x',{arrivedAt:null}),x:0,y:0,z:0,l:400,w:300,h:300};
 const a=auditCommerce([p],[],{planAt});assert.equal(a.valid,false);assert.equal(a.arrivalPass,false);
});
test('unknown arrivals cannot be laundered through locked placements',async()=>{
 const p=await solve([item('x')]);
 await assert.rejects(solveCommerce({containerType:'20GP',cargoList:[item('x',{arrivedAt:null})],caseContext:{commerce:{planAt,lockedPlacements:p.loadedCargo}},timeLimitMs:1000}),/已装/);
});
test('same order includes late rows and detects prohibited partial shipment',async()=>{
 const {assessOrderFulfillment}=await api();
 const rows=[item('a',{customerId:'C',orderId:'O',required:true,allowPartialShipment:false}),item('late',{customerId:'C',orderId:'O',required:true,allowPartialShipment:false,arrivedAt:null})];
 const f=assessOrderFulfillment(rows,[{sourceCargoId:'a'}]);
 assert.equal(f.orders.length,1);assert.equal(f.requiredMissing,1);assert.equal(f.policyPass,false);assert.equal(f.shipmentTaskSatisfied,false);
});
test('completing a required order beats loading a larger optional volume',async()=>{
 const {assessOrderFulfillment,rankCommerceCandidate}=await api();
 const rows=[item('required',{required:true}),item('optional',{required:false})];
 const c=volume=>({validator:{valid:true},audit:{valid:true,extraClusterCount:0},loadedVolumeMm3:volume});
 const a=rankCommerceCandidate(c(1),assessOrderFulfillment(rows,[{sourceCargoId:'required'}]));
 const b=rankCommerceCandidate(c(1000),assessOrderFulfillment(rows,[{sourceCargoId:'optional'}]));
 assert(a.find((v,i)=>v!==b[i]) < b[a.findIndex((v,i)=>v!==b[i])]);
});
test('policy conflicts fail before solving and seller order IDs remain isolated',async()=>{
 const {validateOrderPolicies,assessOrderFulfillment}=await api();
 assert.throws(()=>validateOrderPolicies([item('a',{customerId:'C',orderId:'O',allowPartialShipment:true}),item('b',{customerId:'C',orderId:'O',allowPartialShipment:false})]),/同一订单/);
 assert.throws(()=>validateOrderPolicies([item('a',{allowPartialShipment:false})]),/货主与订单号/);
 const f=assessOrderFulfillment([item('a',{customerId:'A',orderId:'O'}),item('b',{customerId:'B',orderId:'O'})],[]);assert.equal(f.orders.length,2);
});
test('solver publishes unfulfilled orders separately from geometry and marks packaging unverified',async()=>{
 const p=await solve([item('a',{customerId:'A',orderId:'O',required:true,allowPartialShipment:false}),item('late',{customerId:'A',orderId:'O',required:true,allowPartialShipment:false,arrivedAt:'2026-09-17T12:00:00+08:00'})]);
 assert.equal(p.validator.valid,true);assert.equal(p.constraintMeta.orderPolicyPass,true);
 assert.equal(p.loadedCargo.length,0);assert.equal(p.unloadedCargo.length,2);
 assert.equal(p.unloadedCargo.find(c=>c.sourceCargoId==='a').reason,'WHOLE_ORDER_DEFERRED');
 assert.equal(p.commerce.fulfillment.requiredMissing,2);assert.equal(p.commerce.decisionStatus,'ORDER_ACTION_REQUIRED');
 assert.equal(p.commerce.businessInputs.packaging.status,'NEEDS_CONFIRMATION');assert.equal(p.commerce.shippingReady,false);
 assert.equal(p.shipmentReadiness.evidence.find(e=>e.id==='COMMERCE-ORDER').status,'BLOCKED');
 assert.equal(p.shipmentReadiness.evidence.find(e=>e.id==='COMMERCE-PACKAGING').status,'DATA_REQUIRED');
 assert.equal(p.shipmentReadiness.evidence.find(e=>e.id==='PORT-ACCESS').status,'DATA_REQUIRED');
 assert(!p.shipmentReadiness.evidence.find(e=>e.id==='PORT-ACCESS').summary.includes('未来港'));
});
