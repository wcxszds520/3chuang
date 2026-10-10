'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const Validator=require('../../services/packing/PlanValidator');
const Builder=require('../../services/packing/CrossSectionLayerBuilder');
const {calculateCoG}=require('../../services/packing/PlanMetrics');
const {rearWallMetrics,exactVoidMetrics}=require('../../services/packing/ExactLayoutMetrics');
const {generateWallCandidates,supportComponents}=require('../../services/packing/BackWallReconstruction');
const {validatePortAccessibility}=require('../../services/realworld/PortAccessibilityValidator');
const {analyzeOperationFeasibility}=require('../../services/packing/CanonicalOperationFeasibility');
const artifact=path.resolve(__dirname,'../../../artifacts/algo-repair');
const c={innerLength:2000,innerWidth:1000,innerHeight:1000,maxWeight:1000};
const box=(id,extra={})=>({cargoId:id,sku:id,x:0,y:0,z:0,l:500,w:500,h:400,weight:20,stackable:true,maxStackLayers:4,portSequence:1,handlingMethod:'manual',...extra});
const source=p=>({...p,length:p.l,width:p.w,height:p.h,quantity:1,canRotate:false});
const validate=(p,container=c)=>new Validator().validate({placements:p,cargoList:p.map(source),container});

test('CASE A identical boxes construct contiguous floor walls from the rear',()=>{
  const cargo=[{cargoId:'same',sku:'same',length:500,width:500,height:400,weight:20,quantity:8,canRotate:false,stackable:false,maxStackLayers:1,portSequence:1,handlingMethod:'manual'}];
  const built=new Builder().build(cargo,c,{strategy:'SPACE'});
  expect(built.placements).toHaveLength(8);expect(new Validator().validate({placements:built.placements,cargoList:cargo,container:c}).valid).toBe(true);
  expect(rearWallMetrics(built.placements,c)).toMatchObject({deepEndPrimaryGap:0,maximum:0});
  expect([...new Set(built.placements.map(p=>p.x))].sort((a,b)=>a-b)).toEqual([0,500,1000,1500]);
});
test('CASE B heavy/light balance is repaired cumulatively by wall order without translation',()=>{
  const p=[80,80,20,20].map((weight,i)=>box(`mix${i}`,{x:i*500,w:1000,weight,handlingMethod:'forklift'}));
  expect(calculateCoG(p,c).longitudinal).toBeGreaterThan(5);
  const found=generateWallCandidates(p,c).find(r=>calculateCoG(r.placements,c).longitudinal<=5);
  expect(found).toBeDefined();expect(validate(found.placements).valid).toBe(true);
  expect(rearWallMetrics(found.placements,c).maximum).toBe(0);
  expect(found.evidence.cumulativeMoves.length).toBeGreaterThan(1);
  expect(found.placements.map(p=>[p.cargoId,p.weight]).sort()).toEqual(p.map(p=>[p.cargoId,p.weight]).sort());
});
test('CASE C mixed-SKU small boxes construct compound support under one large top',()=>{
  const container={...c,innerLength:1000};
  const cargo=[source(box('left',{l:1000})),source(box('right',{l:1000})),source(box('bridge',{l:1000,w:1000,h:200,weight:10,stackable:false,maxStackLayers:1}))];
  const built=new Builder().build(cargo,container,{strategy:'SPACE'});
  expect(built.placements).toHaveLength(3);
  const top=built.placements.find(p=>p.sku==='bridge');expect(top.y).toBe(400);
  const v=new Validator().validate({placements:built.placements,cargoList:cargo,container});expect(v.valid).toBe(true);
  expect(v.stability.cargo[top.cargoId].supportRatio).toBe(1);
  expect(supportComponents(built.placements)).toHaveLength(1);
});
test('contact union excludes a hole even when its convex hull covers the upper box',()=>{
  const p=[box('a',{w:100}),box('b',{z:400,w:100}),box('top',{y:400,w:500,weight:10})];
  expect(validate(p).violations.some(v=>v.code==='SUPPORT')).toBe(true);
});
test('load-bearing includes transitive load and explicit zero capacity',()=>{
  const p=[box('a',{maximumSupportedWeightKg:25}),box('b',{y:400}),box('d',{y:800,h:100})];
  expect(validate(p).violations.some(v=>v.code==='CARRYING'&&v.evidence.load===40)).toBe(true);
  p[0].maximumSupportedWeightKg=0;expect(validate(p).checks.carrying).toBe(false);
});
test('continuous stack limit includes all descendants',()=>{
  const p=[box('a',{maxStackLayers:2}),box('b',{y:400}),box('d',{y:800,h:100})];
  expect(validate(p).checks.stack).toBe(false);
});
test.each([
  ['bounds',[box('a',{x:1800})],'bounds'],
  ['collision',[box('a'),box('b',{x:200})],'collision'],
  ['payload',[box('a',{weight:1001})],'payload'],
  ['fragile',[box('a',{fragile:true}),box('b',{y:400})],'fragile'],
  ['non-stackable',[box('a',{stackable:false}),box('b',{y:400})],'stack'],
  ['incompatible',[box('a',{incompatibleWith:['b']}),box('b',{x:500})],'incompatibleCargo'],
  ['duplicate ID',[box('a'),box('a',{x:500})],'identity'],
  ['port order',[box('a',{portSequence:1}),box('b',{x:500,portSequence:2})],'lifo']
])('%s rejects invalid placements',(_,p,check)=>expect(validate(p).checks[check]).toBe(false));
test('orientation is checked against the original envelope',()=>{
  const p=box('a',{l:400,w:500,h:500});
  expect(new Validator().validate({placements:[p],cargoList:[source(box('a'))],container:c}).checks.orientation).toBe(false);
});
test('rotated dimensions feed independent mass moments and full-span percentage',()=>{
  const p=[box('a',{x:100,l:400,w:700,weight:10}),box('b',{x:1000,l:600,z:100,weight:30})];
  const cog=calculateCoG(p,c);expect(cog.x).toBe((10*300+30*1300)/40);
  expect(cog.longitudinal).toBe(Math.abs(cog.x-1000)/2000*100);
  expect(cog.z).toBe((10*350+30*350)/40);
});
test('one isolated touching box cannot hide a deep-end gap across occupied lanes',()=>{
  const rear=rearWallMetrics([box('small',{w:20}),box('main',{x:600,z:20,w:980})],c);
  expect(rear.minimum).toBe(0);expect(rear.deepEndPrimaryGap).toBe(600);expect(rear.p95).toBe(600);expect(rear.mean).toBe(588);
});
test('exact geometric void conserves volume and separates rear, door, top prohibition and interior',()=>{
  const p=[box('a',{x:100,w:1000,stackable:false}),box('b',{x:700,w:1000})];
  const v=exactVoidMetrics(p,c);
  expect(v.volumesMm3.deepEndContinuousGap).toBe(100*1000*1000);
  expect(v.volumesMm3.doorEndUsableGap).toBe(800*1000*1000);
  expect(v.volumesMm3.nonStackableTopVoid).toBe(500*1000*600);
  expect(v.volumesMm3.irregularInternalVoid).toBe(100*1000*1000);
  expect(Math.abs(v.conservationErrorMm3)).toBeLessThan(1);
});
test('original 212 facts, independent constraints, exact geometry, unload and post-unload stability',()=>{
  const input=JSON.parse(fs.readFileSync(path.join(artifact,'original-212-input.json')));
  const p=JSON.parse(fs.readFileSync(path.join(artifact,'new-plan.json')));
  const hash=crypto.createHash('sha256').update(JSON.stringify({cargo:input.cargoList,container:input.container,caseContext:input.caseContext})).digest('hex');
  expect(hash).toBe(input.inputFingerprint);expect(p.loadedCargo).toHaveLength(212);
  expect(p.loadedCargo.reduce((s,p)=>s+p.weight,0)).toBe(8623);
  expect(p.loadedCargo.map(p=>p.cargoId).sort()).toEqual(input.units.map(u=>u.cargoId).sort());
  const fields=['l','w','h','weight','orientation','portSequence','destinationPort','batchId','stackable','maxStackLayers','maximumSupportedWeightKg','maxSupportedWeight','handlingMethod','handlingPolicy','fragile','canRotate','canLayFlat','forkEntry','packagingProfile','cargoPhysicalProfile'];
  for(const item of p.loadedCargo){const old=input.units.find(u=>u.cargoId===item.cargoId).originalPlacement;for(const key of fields)expect(item[key]).toEqual(old[key]);}
  const v=new Validator().validate({placements:p.loadedCargo,cargoList:input.cargoList,container:input.container});
  expect(v.valid).toBe(true);expect(v.checks.cog.withinPolicy).toBe(true);
  const port=validatePortAccessibility({placements:p.loadedCargo,container:input.container,route:input.caseContext.route,caseContext:input.caseContext});
  expect(port.status).toBe('FULL_UNLOAD_PASS');expect(port.postUnloadStabilityPass).toBe(true);
  expect(analyzeOperationFeasibility({placements:p.loadedCargo,container:input.container}).blockedCount).toBe(0);
  expect(rearWallMetrics(p.loadedCargo,input.container).deepEndPrimaryGap).toBeLessThanOrEqual(50);
  expect(Math.abs(exactVoidMetrics(p.loadedCargo,input.container).conservationErrorMm3)).toBeLessThan(1);
},30000);
