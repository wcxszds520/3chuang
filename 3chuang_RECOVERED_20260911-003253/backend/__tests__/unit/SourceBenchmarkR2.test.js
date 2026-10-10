'use strict';
const {solveSourceBenchmark,placement}=require('../../services/packing/SourceBenchmarkSolver');
const {validateSourcePlan}=require('../../services/packing/SourceConstraintValidator');
const {resolveOrientationRules}=require('../../services/packing/OrientationConstraint');
const {compareSubmittedFacts}=require('../../services/external/SourcePlanService');
const box=(id,l,w,h,weight=1,extra={})=>({cargoId:id,sku:id,length:l,width:w,height:h,weight,quantity:1,orientationConstraints:{lengthVertical:false,widthVertical:false,heightVertical:true},...extra});
const bin={innerLength:1000,innerWidth:1000,innerHeight:1000,maxWeight:null};
const rules={supportRatio:1,weightKnown:true,pressure:false,stacking:false,payload:false};
const at=(s,x,y,z=0,id='LWH',index=1)=>placement(s,resolveOrientationRules(s).orientations.flatMap(o=>o.semanticVariants).find(o=>o.id===id),index,{x,y,z});
const check=(cargoList,placements,opts={})=>validateSourcePlan({cargoList,placements,unloadedCargo:[],container:bin,rules:{...rules,...opts}});
describe('Source benchmark R2 independent constraints',()=>{
  test('manual tiling proof: 2 × 5 × 2 identical boxes exactly fill container; ordinary solver constructs all 20',()=>{
    const task={container:bin,cargoList:[box('tiling',500,200,500,null,{quantity:20})],rules:{...rules,weightKnown:false},capabilities:{canSolve:true}};
    const p=solveSourceBenchmark(task,{timeLimitMs:2000});
    expect(p.validator.valid).toBe(true);expect(p.placements).toHaveLength(20);expect(p.loadedVolumeMm3).toBe(1000**3);expect(p.validator.totalWeight).toBeNull();
  });
  test('compound support actual 50 + 50 under 100; every kg reaches floor once',()=>{
    const a=box('a',500,1000,100,10),b=box('b',500,1000,100,10),c=box('c',1000,1000,100,100);
    const p=[at(a,0,0),at(b,500,0),at(c,0,100)];const v=check([a,b,c],p);
    expect(v.valid).toBe(true);expect(v.mechanical.floorReactionKg).toBeCloseTo(120,10);
    expect(v.mechanical.reports.find(r=>r.cargoId===p[0].cargoId).carriedKg).toBeCloseTo(50,10);
  });
  test('contact hole is not filled by a convex hull or bounding rectangle',()=>{
    const a=box('a',400,1000,100),b=box('b',400,1000,100),c=box('c',1000,1000,100);
    const v=check([a,b,c],[at(a,0,0),at(b,600,0),at(c,0,100)]);
    expect(v.violations.some(v=>v.code==='SUPPORT_FAILURE')).toBe(true);
  });
  test('square geometry retains different original-upright strength',()=>{
    const capacity={lengthUpright:0.1,widthUpright:0.1,heightUpright:0.00005};
    const a=box('a',500,500,500,1,{orientationConstraints:{lengthVertical:true,widthVertical:true,heightVertical:true},loadBearing:capacity,loadBearingUnit:'kg/cm²'});
    const b=box('b',500,500,100,1,{loadBearing:capacity,loadBearingUnit:'kg/cm²'});
    expect(check([a,b],[at(a,0,0),at(b,0,500)],{pressure:true}).violations.some(v=>v.code==='LOAD_BEARING_LIMIT')).toBe(true);
    expect(check([a,b],[at(a,0,0,0,'HWL'),at(b,0,500)],{pressure:true}).valid).toBe(true);
  });
  test('load patch does not spread onto empty width through an intermediate carton',()=>{
    const bearing={lengthUpright:1,widthUpright:1,heightUpright:0.001};
    const lower=box('lower',1000,1000,100,1,{loadBearing:bearing,loadBearingUnit:'kg/cm²'}),middle=box('middle',1000,1000,100,1,{loadBearing:{...bearing,heightUpright:1},loadBearingUnit:'kg/cm²'}),top=box('top',100,100,100,1,{loadBearing:bearing,loadBearingUnit:'kg/cm²'});
    const v=check([lower,middle,top],[at(lower,0,0),at(middle,0,100),at(top,0,200)],{pressure:true});
    expect(v.mechanical.reports.find(r=>r.cargoId==='lower__piece_00001').peakKgPerCm2).toBeCloseTo(0.0101,10);
    expect(v.violations.some(v=>v.code==='LOAD_BEARING_LIMIT')).toBe(true);
  });
  test('source top/bottom, stack limits and unsupported cross-group relation fail closed',()=>{
    const a=box('a',100,100,100,1,{alwaysOnTop:true,stackingGroup:1,maxStackLayers:1}),b=box('b',100,100,100,1,{alwaysOnBottom:true,stackingGroup:2});
    const codes=check([a,b],[at(a,0,0),at(b,0,100)],{stacking:true}).violations.map(v=>v.code);
    expect(codes).toEqual(expect.arrayContaining(['TOP_BOTTOM_CONSTRAINT','SOURCE_RULE_UNSUPPORTED','STACK_LIMIT']));
  });
  test('source facts cannot be edited through the source benchmark API',()=>{
    const c=box('immutable',100,100,100,null);const task={cargoList:[c]};
    expect(()=>compareSubmittedFacts([c],task)).not.toThrow();
    expect(()=>compareSubmittedFacts([{...c,weight:0}],task)).toThrow(/事实/);
    expect(()=>compareSubmittedFacts([{...c,quantity:2}],task)).toThrow(/事实/);
  });
  test('validator independently rejects overlap, bounds, orientation and missing physical quantity',()=>{
    const a=box('a',100,200,300,1,{quantity:2}),b=box('b',100,100,100,1);
    const p=[at(a,0,0),at(b,50,0)];p[0].x=-1;p[1].canonicalOrientation='BAD';
    const codes=check([a,b],p).violations.map(v=>v.code);
    expect(codes).toEqual(expect.arrayContaining(['OUT_OF_BOUNDS','COLLISION','ORIENTATION_RESTRICTED','QUANTITY_CONSERVATION']));
  });
  test('payload cannot be waived by unknown source capacity on other tasks',()=>{
    const a=box('a',100,100,100,100);
    const v=validateSourcePlan({cargoList:[a],placements:[at(a,0,0)],unloadedCargo:[],container:{...bin,maxWeight:50},rules:{...rules,payload:true}});
    expect(v.valid).toBe(false);expect(v.checks.payload).toBe('FAIL');
  });
  test('source pressure rejects construction before an invalid stack can become a final plan',()=>{
    const c=box('pressure',1000,1000,400,10,{quantity:2,loadBearing:{lengthUpright:0,widthUpright:0,heightUpright:0},loadBearingUnit:'kg/cm²'});
    const result=solveSourceBenchmark({container:bin,cargoList:[c],rules:{...rules,pressure:true},capabilities:{canSolve:true}},{timeLimitMs:1000});
    expect(result.placements).toHaveLength(1);expect(result.validator.valid).toBe(true);
    expect(result.unloadedCargo).toHaveLength(1);
    expect(result.unloadedDiagnostics[0].rejections.LOAD_BEARING_LIMIT).toBeGreaterThan(0);
  });
  test('Renault single-item layers enforce source material, weight order, density and bottom load',()=>{
    const a=box('a',1000,1000,100,1000,{externalMetadata:{sourceFields:{'Package material':'WOOD'}}}),b=box('b',1000,1000,100,1100,{externalMetadata:{sourceFields:{'Package material':'METAL'}}});
    const opts={layeredStacks:{maxNonMetalDensityKgM2:2000,maxWeightAboveBottomKg:750}};
    expect(check([a,b],[at(a,0,0),at(b,0,100)],opts).violations.map(v=>v.code)).toEqual(expect.arrayContaining(['LAYER_WEIGHT_ORDER','STACK_MATERIAL_CONFLICT','STACK_DENSITY_LIMIT','STACK_BOTTOM_BEARING_LIMIT']));
    const light={...b,weight:100,externalMetadata:a.externalMetadata};
    expect(check([a,light],[at(a,0,0),at(light,0,100)],opts).valid).toBe(true);
  });
});
