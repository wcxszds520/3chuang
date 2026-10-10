const {test}=require('node:test'),assert=require('node:assert/strict');
const {mechanics}=require('../services/packing/SourceConstraintValidator');
test('a wide floor base supports four real small cartons per layer',()=>{
 const {walls}=require('../services/packing/CommerceWallPacker');
 const cargoList=[{cargoId:'base',sku:'base',quantity:1,length:1000,width:1000,height:400,weight:30,alwaysOnBottom:true,stackable:true,maxStackLayers:3,maxSupportedWeight:100},
  {cargoId:'carton',sku:'carton',quantity:8,length:500,width:500,height:300,weight:5,stackable:true,maxStackLayers:2}];
 const task={cargoList,container:{innerLength:1000,innerWidth:1000,innerHeight:1000,maxWeight:1000},rules:{supportRatio:1,stacking:true,weightKnown:true,payload:true,declaredTopLoad:true}};
 const p=walls(task,{},Date.now()+2000,x=>x);
 assert.equal(p.validator.valid,true);assert.equal(p.placements.length,9);assert.equal(p.loadedVolumeMm3,1e9);
 assert.equal(p.placements.filter(c=>c.y===400).length,4);assert.equal(p.placements.filter(c=>c.y===700).length,4);
});
test('soft packaging rejects a rigid upper package while matching SKU stacks remain possible',()=>{
 const lower={cargoId:'soft',sku:'TEXTILE',weight:10,x:0,y:0,z:0,l:400,w:400,h:400,stackingCompatibility:'SAME_SKU'};
 const upper={cargoId:'top',sku:'METAL',weight:5,x:0,y:400,z:0,l:400,w:400,h:400};
 const rules={supportRatio:1,stacking:true,declaredTopLoad:true,weightKnown:true};
 assert(mechanics([lower,upper],new Map(),rules).violations.some(v=>v.code==='STACKING_FORBIDDEN'));
 assert.equal(mechanics([lower,{...upper,sku:'TEXTILE'}],new Map(),rules).violations.length,0);
});
test('splittable orders prefer more required volume over finishing one small order',async()=>{
 const {rankCommerceCandidate}=await import('../../shared/commerceBusiness.mjs');
 const order=(expectedVolumeMm3,loadedVolumeMm3)=>({required:true,allowPartialShipment:true,priority:1,missing:expectedVolumeMm3-loadedVolumeMm3,expectedVolumeMm3,loadedVolumeMm3});
 const rank=orders=>rankCommerceCandidate({validator:{valid:true},audit:{valid:true,extraClusterCount:0},loadedVolumeMm3:orders.reduce((s,o)=>s+o.loadedVolumeMm3,0)},{orders,splitViolations:[],requiredMissing:orders.reduce((s,o)=>s+o.missing,0)});
 const a=rank([order(10,5),order(100,90)]),b=rank([order(10,10),order(100,20)]),i=a.findIndex((n,i)=>n!==b[i]);assert(a[i]<b[i]);
});
test('door reservation retains quantity and produces a valid ordered extraction',()=>{
 const {doorReserve}=require('../services/packing/CommerceDoorReservePacker'),{auditCommerce}=require('../services/packing/CommerceAudit');
 const planAt='2026-09-16T12:00:00+08:00';
 const rows=[1,2,3].map(g=>({cargoId:'G'+g,sku:'G'+g,quantity:3,length:400,width:400,height:400,weight:10,portSequence:g,unloadSequence:g,arrivedAt:planAt,stackable:true,maxStackLayers:2}));
 const task={cargoList:rows,container:{innerLength:2000,innerWidth:800,innerHeight:800,maxWeight:1000},rules:{supportRatio:1,stacking:true,weightKnown:true,payload:true}};
 const p=doorReserve(task,{planAt,lifo:true},Date.now()+1000,x=>({...x,arrivedAt:planAt,unloadSequence:rows.find(c=>c.cargoId===x.sourceCargoId).unloadSequence}));
 assert.equal(p.validator.valid,true);assert.equal(p.placements.length+p.unloadedCargo.length,9);assert.equal(auditCommerce(p.placements,rows,{planAt,lifo:true}).valid,true);
});
