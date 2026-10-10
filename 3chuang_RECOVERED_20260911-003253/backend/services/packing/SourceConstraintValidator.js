'use strict';
const {validateOrientationConstraints,unionArea}=require('./PlanValidator');
const {buildSourceIndex,bindSource,validateSourceAccounting}=require('./CargoSourceIdentity');
const {fitsDoor,evaluateInsertionPath}=require('./InsertionPathFeasibility');
const EPS=0.001;
const rect=p=>({x0:p.x,x1:p.x+p.l,z0:p.z,z1:p.z+p.w});
const area=r=>Math.max(0,r.x1-r.x0)*Math.max(0,r.z1-r.z0);
function intersect(a,b){const r={x0:Math.max(a.x0,b.x0),x1:Math.min(a.x1,b.x1),z0:Math.max(a.z0,b.z0),z1:Math.min(a.z1,b.z1)};return area(r)>EPS?r:null;}
function overlap(a,b){return a.x<b.x+b.l-EPS&&a.x+a.l>b.x+EPS&&a.y<b.y+b.h-EPS&&a.y+a.h>b.y+EPS&&a.z<b.z+b.w-EPS&&a.z+a.w>b.z+EPS;}
function supportContacts(item,placements){return placements.flatMap(lower=>{if(lower===item||Math.abs(lower.y+lower.h-item.y)>EPS)return [];const r=intersect(rect(item),rect(lower));return r?[{...r,lower,area:area(r)}]:[];});}
function peakPressure(patches){
  if(!patches.length)return 0;
  const xs=[...new Set(patches.flatMap(r=>[r.x0,r.x1]))].sort((a,b)=>a-b),zs=[...new Set(patches.flatMap(r=>[r.z0,r.z1]))].sort((a,b)=>a-b);
  let peak=0;
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
    const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;
    peak=Math.max(peak,patches.reduce((s,r)=>s+(x>r.x0&&x<r.x1&&z>r.z0&&z<r.z1?r.kgPerMm2:0),0));
  }
  return peak*100;
}
// Local pressure propagates vertically through real contact patches. It is not
// smeared over a large bounding rectangle. Full support preserves force balance.
function mechanics(placements,sources,rules){
  const violations=[],incoming=new Map(),contacts=new Map(),reports=[],depths=new Map(),skuDepths=new Map();
  const add=(code,ids,evidence={})=>violations.push({code,cargoIds:ids,evidence});
  for(const p of placements){
    const s=sources.get(p.cargoId)||p,links=p.y<=EPS?[]:supportContacts(p,placements);contacts.set(p.cargoId,links);
    const ratio=p.y<=EPS?1:unionArea(links)/(p.l*p.w);
    if(ratio+1e-9<rules.supportRatio)add('SUPPORT_FAILURE',[p.cargoId],{ratio,required:rules.supportRatio});
    if(rules.stacking&&s.alwaysOnBottom===true&&p.y>EPS)add('TOP_BOTTOM_CONSTRAINT',[p.cargoId],{rule:'ALWAYS_ON_BOTTOM'});
    if(rules.layeredStacks&&p.y>EPS){
      if(links.length!==1||['x','z','l','w'].some(k=>Math.abs(p[k]-links[0]?.lower[k])>EPS))add('SOURCE_RULE_UNSUPPORTED',[p.cargoId],{rule:'LAYER_HIERARCHY_REQUIRES_EQUAL_FOOTPRINT_SINGLE_ITEM_COLUMN'});
    }
    for(const link of links){const lower=sources.get(link.lower.cargoId)||link.lower;
      if(lower.stackable===false||lower.fragile===true)add('STACKING_FORBIDDEN',[link.lower.cargoId,p.cargoId]);
      if(rules.declaredTopLoad&&lower.stackingCompatibility==='SAME_SKU'&&lower.sku!==s.sku)add('STACKING_FORBIDDEN',[link.lower.cargoId,p.cargoId],{rule:'ONLY_MATCHING_SOFT_PACKAGE'});
      if(rules.stacking&&lower.alwaysOnTop===true)add('TOP_BOTTOM_CONSTRAINT',[link.lower.cargoId,p.cargoId],{rule:'ALWAYS_ON_TOP'});
      if(rules.stacking&&lower.stackingGroup!=null&&s.stackingGroup!=null&&String(lower.stackingGroup)!==String(s.stackingGroup))add('SOURCE_RULE_UNSUPPORTED',[link.lower.cargoId,p.cargoId],{rule:'CROSS_GROUP_ORDER_NOT_VERIFIED'});
      if(rules.layeredStacks){
        if(p.weight>link.lower.weight+1e-9)add('LAYER_WEIGHT_ORDER',[link.lower.cargoId,p.cargoId]);
        if((s.externalMetadata?.sourceFields?.['Package material']==='METAL')!==(lower.externalMetadata?.sourceFields?.['Package material']==='METAL'))add('STACK_MATERIAL_CONFLICT',[link.lower.cargoId,p.cargoId]);
      }
    }
  }
  for(const p of [...placements].sort((a,b)=>b.y-a.y)){
    const s=sources.get(p.cargoId)||p,patches=incoming.get(p.cargoId)||[];
    const carried=patches.reduce((sum,r)=>sum+area(r)*r.kgPerMm2,0),peak=peakPressure(patches),layers=depths.get(p.cargoId)||1;
    const limit=s.maxStackLayers;
    const columnSkuDepths=new Map(skuDepths.get(p.cargoId)||[]);
    columnSkuDepths.set(s.sku,(columnSkuDepths.get(s.sku)||0)+1);
    const checkedLayers=rules.declaredTopLoad&&s.stackLayerScope==='SAME_SKU'?columnSkuDepths.get(s.sku):layers;
    if(Number.isInteger(limit)&&checkedLayers>limit)add('STACK_LIMIT',[p.cargoId],{layers:checkedLayers,limit,scope:s.stackLayerScope||'ALL_PACKAGES'});
    // Only enabled by the commerce adapter; benchmark source rules stay unchanged.
    const topLimit=s.maximumSupportedWeightKg??s.maxSupportedWeight;
    if(rules.declaredTopLoad && topLimit!=null){
      if(!rules.weightKnown)add('DATA_INCOMPLETE',[p.cargoId],{field:'weight required for declared top load'});
      else if(carried>topLimit+1e-9)add('DECLARED_TOP_LOAD',[p.cargoId],{carriedKg:carried,limitKg:topLimit});
    }
    const pressureKey={L:'lengthUpright',W:'widthUpright',H:'heightUpright'}[p.uprightOriginalAxis];
    const capacity=s.loadBearing?.[pressureKey];
    if(rules.pressure){
      if(s.loadBearingUnit!=='kg/cm²'||!Number.isFinite(capacity)||capacity<0)add('DATA_INCOMPLETE',[p.cargoId],{field:'orientation load bearing'});
      else if(peak>capacity+1e-9)add('LOAD_BEARING_LIMIT',[p.cargoId],{peakKgPerCm2:peak,capacityKgPerCm2:capacity,uprightOriginalAxis:p.uprightOriginalAxis});
    }
    if(rules.weightKnown && (!Number.isFinite(p.weight)||p.weight<0))add('DATA_INCOMPLETE',[p.cargoId],{field:'weight'});
    if(rules.layeredStacks&&p.y<=EPS&&s.externalMetadata?.sourceFields?.['Package material']!=='METAL'){
      const density=(carried+p.weight)/(p.l*p.w/1e6);
      if(density>rules.layeredStacks.maxNonMetalDensityKgM2+1e-9)add('STACK_DENSITY_LIMIT',[p.cargoId],{density,limit:rules.layeredStacks.maxNonMetalDensityKgM2});
      if(carried>rules.layeredStacks.maxWeightAboveBottomKg+1e-9)add('STACK_BOTTOM_BEARING_LIMIT',[p.cargoId],{carried,limit:rules.layeredStacks.maxWeightAboveBottomKg});
    }
    const outgoing=rules.weightKnown?[...patches,{...rect(p),kgPerMm2:p.weight/(p.l*p.w)}]:[];
    for(const link of contacts.get(p.cargoId)||[]){
      const list=incoming.get(link.lower.cargoId)||[];
      for(const patch of outgoing){const clipped=intersect(patch,link);if(clipped)list.push({...clipped,kgPerMm2:patch.kgPerMm2});}
      incoming.set(link.lower.cargoId,list);depths.set(link.lower.cargoId,Math.max(depths.get(link.lower.cargoId)||1,layers+1));
      const lowerDepths=skuDepths.get(link.lower.cargoId)||new Map();for(const [sku,count] of columnSkuDepths)lowerDepths.set(sku,Math.max(lowerDepths.get(sku)||0,count));skuDepths.set(link.lower.cargoId,lowerDepths);
    }
    reports.push({cargoId:p.cargoId,carriedKg:rules.weightKnown?carried:null,peakKgPerCm2:rules.pressure?peak:null,capacityKgPerCm2:rules.pressure?capacity:null,layers});
  }
  const floorReaction=rules.weightKnown?reports.filter(r=>placements.find(p=>p.cargoId===r.cargoId).y<=EPS).reduce((sum,r)=>sum+r.carriedKg+placements.find(p=>p.cargoId===r.cargoId).weight,0):null;
  return {violations,reports,floorReactionKg:floorReaction,model:'VERTICAL_CONTACT_PATCH_PRESSURE_KG_CM2',contactArea:'EXACT_RECTANGLE_UNION',gravityConversion:'NONE_KG_PER_CM2_SOURCE_CONVENTION'};
}
function validateSourcePlan({placements,cargoList,unloadedCargo,container,rules,lockedPlacements=[]}){
  const index=buildSourceIndex(cargoList),violations=validateSourceAccounting(placements,unloadedCargo,index),sources=new Map();
  for(const p of placements){const bound=bindSource(p,index);if(bound.source)sources.set(p.cargoId,bound.source);
    if(![p.x,p.y,p.z,p.l,p.w,p.h].every(Number.isFinite)||![p.l,p.w,p.h].every(v=>v>0)) {violations.push({code:'INVALID_GEOMETRY',cargoIds:[p.cargoId]});continue;}
    if(p.x<-EPS||p.y<-EPS||p.z<-EPS||p.x+p.l>container.innerLength+EPS||p.y+p.h>container.innerHeight+EPS||p.z+p.w>container.innerWidth+EPS)violations.push({code:'OUT_OF_BOUNDS',cargoIds:[p.cargoId]});
    if(!fitsDoor(p,container))violations.push({code:'DOOR_OPENING_TOO_SMALL',cargoIds:[p.cargoId]});
    if(bound.source){const orientation=validateOrientationConstraints(p,bound.source);if(!orientation.valid||!orientation.verified)violations.push({code:'ORIENTATION_RESTRICTED',cargoIds:[p.cargoId],evidence:orientation});
      if(p.weight!==bound.source.weight)violations.push({code:'INPUT_WEIGHT',cargoIds:[p.cargoId]});}
  }
  const sorted=[...placements].sort((a,b)=>a.x-b.x);
  for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length&&sorted[j].x<sorted[i].x+sorted[i].l-EPS;j++)if(overlap(sorted[i],sorted[j]))violations.push({code:'COLLISION',cargoIds:[sorted[i].cargoId,sorted[j].cargoId]});
  const mass=rules.weightKnown?placements.reduce((s,p)=>s+p.weight,0):null;
  if(rules.payload&&mass>container.maxWeight+EPS)violations.push({code:'PAYLOAD_LIMIT',cargoIds:[],evidence:{mass,maxWeight:container.maxWeight}});
  const mechanical=mechanics(placements,sources,rules);violations.push(...mechanical.violations);
  for(const lock of lockedPlacements){
    const actual=placements.find(p=>p.cargoId===lock.cargoId);
    if(!actual||['x','y','z','l','w','h','orientationId'].some(k=>actual[k]!==lock[k]))violations.push({code:'FIXED_PLACEMENT_MOVED',cargoIds:[lock.cargoId]});
  }
  if(lockedPlacements.length){
    const inserted=[...lockedPlacements],lockIds=new Set(lockedPlacements.map(p=>p.cargoId));
    for(const p of [...placements].filter(p=>!lockIds.has(p.cargoId)).sort((a,b)=>a.x-b.x||a.y-b.y||a.z-b.z)){
      const path=evaluateInsertionPath(p,inserted,container);if(!path.feasible)violations.push({code:'LOCKED_INSERTION_BLOCKED',cargoIds:[p.cargoId],evidence:path.reasons});inserted.push(p);
    }
  }
  if(rules.weightKnown&&Math.abs(mechanical.floorReactionKg-mass)>0.001)violations.push({code:'LOAD_PROPAGATION_CONSERVATION',cargoIds:[],evidence:{mass,floorReaction:mechanical.floorReactionKg}});
  return {status:violations.length?'INVALID':'VALID',valid:violations.length===0,violations,hardViolationCount:violations.length,mechanical,
    checks:{geometry:!violations.some(v=>['INVALID_GEOMETRY','OUT_OF_BOUNDS','COLLISION'].includes(v.code)),orientation:!violations.some(v=>v.code==='ORIENTATION_RESTRICTED'),support:!violations.some(v=>v.code==='SUPPORT_FAILURE'),payload:rules.payload?(violations.some(v=>v.code==='PAYLOAD_LIMIT')?'FAIL':'PASS'):'NOT_EVALUATED',cog:'NOT_EVALUATED_SOURCE_HAS_NO_COG_CONSTRAINT',loadBearing:rules.pressure?(violations.some(v=>['LOAD_BEARING_LIMIT','DATA_INCOMPLETE'].includes(v.code))?'FAIL':'PASS'):'NOT_EVALUATED',stacking:!violations.some(v=>['STACK_LIMIT','STACKING_FORBIDDEN','SOURCE_RULE_UNSUPPORTED','TOP_BOTTOM_CONSTRAINT'].includes(v.code)),sourceLayerRules:rules.layeredStacks?(!violations.some(v=>['LAYER_WEIGHT_ORDER','STACK_MATERIAL_CONFLICT','STACK_DENSITY_LIMIT','STACK_BOTTOM_BEARING_LIMIT','SOURCE_RULE_UNSUPPORTED'].includes(v.code))?'PASS':'FAIL'):'NOT_APPLICABLE',businessHandling:'NOT_APPLICABLE',portOrder:'NOT_APPLICABLE'},totalWeight:mass};
}
module.exports={validateSourcePlan,mechanics,supportContacts,overlap,rect,area,intersect,peakPressure};
