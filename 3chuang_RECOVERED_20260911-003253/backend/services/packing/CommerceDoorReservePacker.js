'use strict';
const {walls}=require('./CommerceWallPacker');
const {repair}=require('./CommerceRepack');
const {placement}=require('./SourceBenchmarkSolver');
const {resolveOrientationRules}=require('./OrientationConstraint');
const {validateSourcePlan}=require('./SourceConstraintValidator');
// Construct early handover groups at the door first, then reserve only their
// actual occupied length. Loading order remains back-to-door after construction.
function doorReserve(task,context,deadline,decorate){
 const groups=[...new Set(task.cargoList.map(c=>Number(c.portSequence||1)))].sort((a,b)=>a-b);
 let free=task.container.innerLength,placements=[],unloaded=[];
 for(const [index,group] of groups.entries()){
  const cargoList=task.cargoList.filter(c=>Number(c.portSequence||1)===group);
  if(free<=0||Date.now()>=deadline){for(const c of cargoList){const o=resolveOrientationRules(c).orientations[0].semanticVariants[0];for(let i=1;i<=c.quantity;i++){const p=decorate(placement(c,o,i,{x:0,y:0,z:0}));delete p.x;delete p.y;delete p.z;unloaded.push({...p,reason:'NO_FEASIBLE_CANDIDATE_FOUND'});}}continue;}
  const end=Date.now()+Math.max(1,(deadline-Date.now())/(groups.length-index));
  const local={...task,cargoList,container:{...task.container,innerLength:free}};
  let result=walls(local,context,Date.now()+(end-Date.now())*.6,decorate);
  if(result.validator.valid&&Date.now()<end){const filled=repair(local,context,decorate,result.placements,end,'wall');if(filled.validator.valid&&filled.loadedVolumeMm3>result.loadedVolumeMm3)result=filled;}
  const depth=Math.max(0,...result.placements.map(p=>p.x+p.l)),offset=free-depth;
  placements.push(...result.placements.map(p=>({...decorate(p),x:p.x+offset})));unloaded.push(...result.unloadedCargo.map(decorate));free=offset;
 }
 placements.sort((a,b)=>a.x-b.x||a.y-b.y||a.z-b.z);placements.forEach((p,i)=>p.loadingIndex=i+1);
 return {placements,unloadedCargo:unloaded,loadedVolumeMm3:placements.reduce((s,p)=>s+p.l*p.w*p.h,0),validator:validateSourcePlan({...task,placements,unloadedCargo:unloaded}),stats:{policy:'door-group-reservation',timedOut:Date.now()>=deadline}};
}
module.exports={doorReserve};
