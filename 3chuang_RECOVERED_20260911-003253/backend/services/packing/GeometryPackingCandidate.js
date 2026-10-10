'use strict';
// Versioned SPACE STUDY only. No DB dependency, no change to source solver rules.
const {construct,placement}=require('./SourceBenchmarkSolver');
const {validateSourcePlan,supportContacts}=require('./SourceConstraintValidator');
const {unionArea}=require('./PlanValidator');
const {resolveOrientationRules}=require('./OrientationConstraint');
const {exactVoidMetrics}=require('./ExactLayoutMetrics');
const clone=x=>structuredClone(x);
function geometryTask(input){
 const task=clone(input);
 task.rules={...task.rules,payload:false,pressure:false,stacking:false,layeredStacks:null,supportRatio:1};
 task.cargoList=task.cargoList.map(s=>({...s,stackable:true,fragile:false,maxStackLayers:null,alwaysOnTop:false,alwaysOnBottom:false}));
 return task;
}
function rank(c){
 const p=c.placements;const ext=p.length?Math.max(...p.map(a=>a.x+a.l))*Math.max(...p.map(a=>a.y+a.h))*Math.max(...p.map(a=>a.z+a.w)):0;
 return [-c.loadedVolumeMm3,-p.length,ext,Math.max(0,...p.map(a=>a.x+a.l))];
}
function better(a,b){if(!b)return true;const x=rank(a),y=rank(b);for(let i=0;i<x.length;i++){if(Math.abs(x[i]-y[i])>1e-5)return x[i]<y[i];}return false;}
function seedForRegion(plan,task,axis,cut){
 let keep=plan.placements.filter(p=>p[axis]<cut).map(clone);
 // Remove upper pieces losing any support after the cut, until closure.
 for(let previous=-1;previous!==keep.length;){previous=keep.length;keep=keep.filter(p=>p.y<.001||unionArea(supportContacts(p,keep))/(p.l*p.w)>=1-1e-9);}
 const counts=new Map();
 return keep.sort((a,b)=>a.y-b.y||a.x-b.x||a.z-b.z).map(p=>{
  const s=task.cargoList.find(s=>s.cargoId===p.sourceCargoId),o=resolveOrientationRules(s).orientations.flatMap(o=>o.semanticVariants).find(o=>o.id===p.orientationId&&o.l===p.l&&o.w===p.w&&o.h===p.h);
  const i=(counts.get(s.cargoId)||0)+1;counts.set(s.cargoId,i);
  return {...placement(s,o,i,p),loadingIndex:counts.size};
 });
}
function solveGeometryCandidate(input,{timeLimitMs=20000,incumbent=null}={}){
 if(input.capabilities?.canSolve!==true)throw new Error('Unsupported or incomplete source task');
 if(!input.cargoList?.length||input.cargoList.some(s=>!Number.isInteger(s.quantity)||s.quantity<1))throw new Error('Invalid source quantities');
 const unchanged=JSON.stringify(input),task=geometryTask(input),start=Date.now(),deadline=start+timeLimitMs,candidates=[];let best;
 if(incumbent){
  const placements=clone(incumbent.loadedCargo||incumbent.placements),unloadedCargo=clone(incumbent.unloadedCargo||[]);
  const validator=validateSourcePlan({placements,unloadedCargo,...task});
  if(validator.valid)best={placements,unloadedCargo,validator,loadedVolumeMm3:placements.reduce((s,p)=>s+p.l*p.w*p.h,0),stats:{policy:'retained-incumbent'}};
 }
 const policies=['block-volume','block-wall','volume','wall','footprint','layer','best-fit','tall','strength','floor'];
 const accept=c=>{candidates.push({policy:c.stats.policy,loaded:c.placements.length,volumeM3:c.loadedVolumeMm3/1e9,valid:c.validator.valid,elapsedMs:c.stats.elapsedMs,repair:c.stats.repair||null});if(c.validator.valid&&better(c,best))best=c;};
 for(let i=0;i<policies.length;i++){const left=deadline-Date.now();if(left<1)break;accept(construct(task,policies[i],Date.now()+Math.max(1,Math.floor(left/(policies.length-i+8))),{maximumSpaces:3000}));}
 if(!best)throw new Error('No valid geometry candidate');
 // Explore different first blocks rather than committing to one greedy start.
 const starts=[...task.cargoList].sort((a,b)=>b.length*b.width*b.height-a.length*a.width*a.height).slice(0,8);
 for(const s of starts)for(const o of resolveOrientationRules(s).orientations.flatMap(o=>o.semanticVariants).slice(0,3)){
  const left=deadline-Date.now();if(left<30)break;
  if(o.l>task.container.innerLength||o.w>task.container.innerWidth||o.h>task.container.innerHeight)continue;
  const first=placement(s,o,1,{x:0,y:0,z:0});
  const c=construct(task,'block-volume',Date.now()+Math.min(450,left),{maximumSpaces:3000,seed:[first]});c.stats.repair={firstSource:s.cargoId,orientation:o.id};accept(c);
 }
 for(const axis of ['x','z','y'])for(const fraction of [.5,.75])for(const policy of ['block-volume','best-fit']){
  const left=deadline-Date.now();if(left<20)break;
  const extent=Math.max(...best.placements.map(p=>p[axis]+p[{x:'l',y:'h',z:'w'}[axis]]));
  const seed=seedForRegion(best,task,axis,extent*fraction);
  const c=construct(task,policy,Date.now()+Math.min(1500,left),{maximumSpaces:3000,seed});c.stats.repair={axis,fraction,retained:seed.length};accept(c);
 }
 const originalValidation=validateSourcePlan({placements:best.placements,unloadedCargo:best.unloadedCargo,...input});
 // Restore original declared packaging fields on output; the study profile stays explicit.
 for(const p of [...best.placements,...best.unloadedCargo]){
  const s=input.cargoList.find(s=>s.cargoId===p.sourceCargoId);
  for(const k of ['stackable','maxStackLayers','packagingType','fragile'])if(Object.hasOwn(s,k))p[k]=s[k];
 }
 if(JSON.stringify(input)!==unchanged)throw new Error('Input mutated');
 return {...best,exactVoid:exactVoidMetrics(best.placements,input.container),originalValidation,study:{version:'geometry-v1',purpose:'SPACE_STUDY',shippingReady:false,officialBenchmarkResult:false,relaxed:['payload','pressure','stacking-policy','source-layer-rules','cog','axle-load','securing','unload-order'],retained:['source-dimensions','source-quantity','source-orientation','bounds','no-overlap','full-footprint-support'],elapsedMs:Date.now()-start,candidates,optimalityProven:false}};
}
module.exports={geometryTask,solveGeometryCandidate,seedForRegion};
