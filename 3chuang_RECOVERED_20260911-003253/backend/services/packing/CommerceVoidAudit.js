'use strict';
const {exactVoidMetrics}=require('./ExactLayoutMetrics');
const {subtractSpaces,placement}=require('./SourceBenchmarkSolver');
const {mechanics}=require('./SourceConstraintValidator');
const {resolveOrientationRules}=require('./OrientationConstraint');
const {pairAllowed}=require('./CommerceAudit');
function inspectVoids(plan,task,context,decorate,budgetMs=1500){
 const exact=exactVoidMetrics(plan.placements,task.container),deadline=Date.now()+budgetMs;
 let spaces=[{x:0,y:0,z:0,l:task.container.innerLength,w:task.container.innerWidth,h:task.container.innerHeight}];
 for(const p of plan.placements)spaces=subtractSpaces(spaces,p,2400).spaces;
 const sources=new Map(plan.placements.map(p=>[p.cargoId,task.cargoList.find(c=>c.cargoId===p.sourceCargoId)]));
 const sourceRows=[...new Set(plan.unloadedCargo.map(p=>p.sourceCargoId))].map(id=>task.cargoList.find(c=>c.cargoId===id)).filter(Boolean);
 const diagnostics=[];
 for(const s of sourceRows){
  const evidence={sourceCargoId:s.cargoId,sku:s.sku,testedPositions:0,geometricFits:0,feasiblePositions:[],rejections:{},truncated:false};
  outer:for(const o of resolveOrientationRules(s).orientations.flatMap(o=>o.semanticVariants))for(const space of spaces){
   if(Date.now()>=deadline){evidence.truncated=true;break outer;}
   if(o.l>space.l||o.w>space.w||o.h>space.h)continue;
   evidence.geometricFits++;const id=plan.unloadedCargo.find(p=>p.sourceCargoId===s.cargoId).cargoId;
   const p={...decorate(placement(s,o,1,space)),cargoId:id};sources.set(id,s);evidence.testedPositions++;
   const codes=new Set(mechanics([...plan.placements,p],sources,task.rules).violations.map(v=>v.code));sources.delete(id);
   if(plan.placements.some(q=>!pairAllowed(p,q,context.lifo!==false)))codes.add('LIFO_BLOCKED');
   if(context.door?.widthMm&&o.w>context.door.widthMm||context.door?.heightMm&&o.h>context.door.heightMm)codes.add('DOOR_APERTURE');
   if(task.rules.payload&&plan.placements.reduce((n,p)=>n+(p.weight||0),0)+s.weight>task.container.maxWeight)codes.add('PAYLOAD_LIMIT');
   if(!codes.size)evidence.feasiblePositions.push({x:p.x,y:p.y,z:p.z,l:p.l,w:p.w,h:p.h});
   for(const code of codes)evidence.rejections[code]=(evidence.rejections[code]||0)+1;
  }
  evidence.conclusion=evidence.feasiblePositions.length?'FEASIBLE_VOID_FOUND':evidence.truncated?'SEARCH_INCOMPLETE':evidence.geometricFits?'TESTED_POSITIONS_REJECTED':'NO_FIT_IN_RETAINED_MAXIMAL_SPACES';
  diagnostics.push(evidence);
 }
 return {unexplainedVoidVolume:exact.totalVoidMm3,zones:exact.majorVoidBoundingBoxes||exact.boxes||[],exact,diagnostics,
  scope:'EXACT_VOID_GEOMETRY_AND_BOUNDED_CANDIDATE_CHECK',impossibilityClaim:false,
  refillOpportunityCount:diagnostics.reduce((n,d)=>n+d.feasiblePositions.length,0)};
}
module.exports={inspectVoids};
