'use strict';
const Orchestrator=require('../../services/AlgorithmOrchestrator');
const PlanValidator=require('../../services/packing/PlanValidator');
const {normalizeContainer}=require('../../services/packing/PlanMetrics');
const {evaluateInsertionPath}=require('../../services/packing/InsertionPathFeasibility');
const {resolveOrientationRules}=require('../../services/packing/OrientationConstraint');
const {placement}=require('../../services/packing/SourceBenchmarkSolver');
const adapter=require('../../services/external/PackingSolverAdapter');
const {box,bin,rules}=require('../../benchmarks/masterBenchmarkCases');
const at=(source,x,y,z=0,id='LWH',index=1)=>placement(source,resolveOrientationRules(source).orientations.flatMap(o=>o.semanticVariants).find(o=>o.id===id),index,{x,y,z});

describe('master rebuild solver trust boundaries',()=>{
  test('Cargo retains an explicit zero top-load limit through serialization',()=>{
    const Cargo=require('../../models/Cargo');
    const c=new Cargo({...box('zero',400,300,200),maximumSupportedWeightKg:0,maxSupportedWeight:100});
    expect(c.maximumSupportedWeightKg).toBe(0);
    expect(c.toJSON().maximumSupportedWeightKg).toBe(0);
    expect(require('../../services/packing/PackagingProfile').normalizeCargoList([c.toJSON()])[0].maximumSupportedWeightKg).toBe(0);
  });
  test.each(['HybridConstraintPackingSolverV25','FastBlockPackingEngine'])('%s constructs same-SKU columns inside the explicit top-load limit',async name=>{
    const Solver=require('../../services/'+name);
    const cargo=[box('bearing',600,600,400,20,{maximumSupportedWeightKg:10})];
    const result=await new Solver({supportRatioMin:1,searchQuality:'fast'}).generatePackingPlan(cargo,bin,{searchQuality:'fast'});
    const validation=new PlanValidator().validate({placements:result.loadedCargo,cargoList:cargo,container:bin,unloadedCargo:result.unloadedCargo});
    expect(result.loadedCargo).toHaveLength(16);
    expect(validation.violations.filter(v=>v.code==='CARRYING')).toEqual([]);
  });
  test('SOURCE rejects explicitly changed immutable bearing and stacking facts',()=>{
    const {compareSubmittedFacts}=require('../../services/external/SourcePlanService');
    const c=box('source',400,300,200,1,{loadBearing:{heightUpright:0.02},loadBearingUnit:'kg/cm²'});
    expect(()=>compareSubmittedFacts([{...c,stackable:false}],{cargoList:[c]})).toThrow(/物理事实/);
    expect(()=>compareSubmittedFacts([{...c,loadBearing:{heightUpright:1}}],{cargoList:[c]})).toThrow(/物理事实/);
  });
  test('COMMERCE carries the actual rotated decision through every placement field',async()=>{
    const {solveCommerce}=require('../../services/CommercePackingService');
    const cargo=box('rotate',600,500,400,1,{orientationPolicy:'',arrivedAt:'2026-09-22T00:00:00Z'});
    const result=await solveCommerce({cargoList:[cargo],actualContainer:{innerLength:500,innerWidth:600,innerHeight:400,maxWeight:100,doorWidth:600,doorHeight:400},
      timeLimitMs:1000,caseContext:{commerce:{planAt:'2026-09-22T01:00:00Z',lifo:false}}});
    expect(result.loadedCargo).toHaveLength(1);expect(result.loadedCargo[0].orientationId).toBe('WLH');
    expect(result.loadedCargo[0].axisMap).toEqual({containerX:'W',containerY:'H',containerZ:'L'});
    expect(result.loadedCargo[0].uprightOriginalAxis).toBe('H');expect(result.validator.valid).toBe(true);
  });
  test.each(['stackable','maxStackLayers','maximumSupportedWeightKg','fragile','incompatibleWith'])('cache invalidates changed %s',field=>{
    const engine=new Orchestrator();const input={cargoList:[box('a',400,300,200)],container:bin};
    const changed=structuredClone(input);changed.cargoList[0][field]=field==='incompatibleWith'?['b']:field==='stackable'?false:field==='fragile'?true:1;
    expect(engine._generateCacheKey(input)).not.toBe(engine._generateCacheKey(changed));
  });
  test('door and fixed-placement options are included in cache identity',()=>{
    const engine=new Orchestrator(),input={cargoList:[box('a',400,300,200)],container:bin};
    expect(engine._generateCacheKey(input)).not.toBe(engine._generateCacheKey({...input,container:{...bin,doorWidth:900}}));
    expect(engine._generateCacheKey(input)).not.toBe(engine._generateCacheKey({...input,options:{lockedPlacements:[{cargoId:'a',x:10}]}}));
  });
  test('quantity overload is not a single-item oversize',()=>{
    const engine=new Orchestrator();expect(engine._checkOversizeCargo([box('a',400,300,200,100,{weight:100})],bin).hasOversize).toBe(false);
    expect(engine._checkOversizeCargo([box('a',400,300,200,1,{weight:6000})],bin).hasOversize).toBe(true);
  });
  test('actual door aperture survives normalization and rejects inner-box-only fit',()=>{
    const container=normalizeContainer({...bin,doorWidth:800});const c=box('door',600,900,500,1,{canRotate:false,orientationPolicy:'FIXED_ORIENTATION'});
    const p=at(c,0,0);expect(evaluateInsertionPath(p,[],container).feasible).toBe(false);
    expect(new PlanValidator().validate({placements:[p],cargoList:[c],unloadedCargo:[],container}).violations.some(v=>v.code==='INSERTION_PATH')).toBe(true);
  });
  test('fixed cargo blocks a new insertion although final boxes do not intersect',()=>{
    const a=box('a',600,600,400),b=box('b',600,600,400);
    const locked=at(a,1200,0),candidate=at(b,0,0);
    expect(evaluateInsertionPath(candidate,[locked],bin).reasons.some(v=>v.code==='INSERTION_PATH_COLLISION')).toBe(true);
  });
  test('candidate cannot override original no-stack and top-load limits',()=>{
    const a=box('a',600,600,400,1,{stackable:false,maximumSupportedWeightKg:0}),b=box('b',600,600,400);
    const forged={...at(a,0,0),stackable:true,maximumSupportedWeightKg:10000};
    const v=new PlanValidator().validate({placements:[forged,at(b,0,400)],cargoList:[a,b],unloadedCargo:[],container:bin});
    expect(v.violations.map(v=>v.code)).toEqual(expect.arrayContaining(['STACK','CARRYING']));
  });
  test('external capability refuses pressure, fixed cargo and unverified source semantics',()=>{
    const task={cargoList:[box('a',400,300,200)],container:bin,rules};
    expect(adapter.assessCapability({...task,rules:{...rules,pressure:true}}).reasons).toContain('ORIENTATION_CONTACT_PRESSURE_UNSUPPORTED');
    expect(adapter.assessCapability({...task,lockedPlacements:[{}]}).supported).toBe(false);
    expect(adapter.assessCapability({...task,cargoList:[{...task.cargoList[0],orientationConstraints:{x:true,y:false,z:true}}]}).supported).toBe(false);
  });
  test.each(Object.entries(adapter.ROTATIONS))('certificate %s maps to canonical %s at the upstream rotation decision', (rotation,id)=>{
    const c=box('rotation',600,300,200,1,{canLayFlat:true,orientationPolicy:'FREE',maxStackLayers:1});
    const task={cargoList:[c],container:bin,rules};const input=adapter.buildInput(task);
    const o=resolveOrientationRules(c).orientations.flatMap(o=>o.semanticVariants).find(o=>o.id===id);
    const csv='TYPE,ID,COPIES,BIN,STACK,X,Y,Z,LX,LY,LZ,GROUP_ID,ROTATION\n'+`ITEM,0,1,0,0,0,0,0,${o.l},${o.w},${o.h},0,${rotation}`;
    const result=adapter.parseCertificate(csv,input,task);expect(result.validator.valid).toBe(true);expect(result.placements[0].orientationId).toBe(id);expect(result.placements[0].axisMap).toEqual(o.axisMap);
  });
  test('external certificate with false rotation is rejected rather than assigned a default',()=>{
    const c=box('a',600,300,200,1,{canRotate:false,orientationPolicy:'FIXED_ORIENTATION'}),task={cargoList:[c],container:bin,rules};
    expect(()=>adapter.parseCertificate('TYPE,ID,COPIES,BIN,STACK,X,Y,Z,LX,LY,LZ,GROUP_ID,ROTATION\nITEM,0,1,0,0,0,0,0,600,300,200,0,YXZ',adapter.buildInput(task),task)).toThrow(/rotation/);
  });
});
