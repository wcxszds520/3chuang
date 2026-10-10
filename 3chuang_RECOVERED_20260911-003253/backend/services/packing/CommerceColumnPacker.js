'use strict';
const {resolveOrientationRules}=require('./OrientationConstraint');
const {placement,subtractSpaces}=require('./SourceBenchmarkSolver');
const {mechanics,validateSourcePlan}=require('./SourceConstraintValidator');
const {pairAllowed}=require('./CommerceAudit');
const volume=p=>p.l*p.w*p.h;
const cmp=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
// Independent floor columns permit fast, exact mechanical checks. All coordinates
// come from current empty-space faces and source orientations, never a scenario.
function columns(task,context,policy,deadline,decorate){
 const {cargoList,container,rules}=task,placed=[],used=new Map(cargoList.map(c=>[c.cargoId,0]));
 let spaces=[{x:0,y:0,z:0,l:container.innerLength,w:container.innerWidth,h:container.innerHeight}],mass=0;
 const orientations=new Map(cargoList.map(c=>[c.cargoId,resolveOrientationRules(c).orientations.flatMap(o=>o.semanticVariants)]));
 const make=(c,o,n,pos)=>decorate(placement(c,o,n,pos));
 const rank=c=>Number(c.portSequence||1);
 const priority=new Map(cargoList.map((c,i)=>{let x=((Number(policy)||0)+1)*2654435761^(i+1)*1597334677;x=Math.imul(x^(x>>>16),2246822507);return [c.cargoId,(x>>>0)/4294967296];}));
 while(Date.now()<deadline){
  const candidates=[];
  for(const c of cargoList){const remaining=c.quantity-used.get(c.cargoId);if(!remaining)continue;
   for(const o of orientations.get(c.cargoId))for(const s of spaces){
    if(o.l>s.l||o.w>s.w||o.h>container.innerHeight)continue;
    if((context.door?.widthMm&&o.w>context.door.widthMm)||(context.door?.heightMm&&o.h>context.door.heightMm))continue;
    for(const baseCount of [...new Set([1,2,3,Math.min(remaining,Math.floor(container.innerHeight/o.h),c.maxStackLayers??Infinity)])]){
    const column=[],local=new Map(),sources=new Map();let y=0;
    const append=(source,ori)=>{
     const index=used.get(source.cargoId)+(local.get(source.cargoId)||0)+1;
     const p=make(source,ori,index,{x:s.x,y,z:s.z});
     if(y+ori.h>container.innerHeight||ori.l>o.l||ori.w>o.w)return false;
     if(context.lifo!==false&&placed.some(q=>!pairAllowed(p,q)))return false;
     sources.set(p.cargoId,source);const check=mechanics([...column,p],sources,rules);
     if(check.violations.length){sources.delete(p.cargoId);return false;}
     const total=mass+column.reduce((sum,p)=>sum+(p.weight||0),0)+(p.weight||0);
     if(rules.payload&&total>container.maxWeight)return false;
     column.push(p);local.set(source.cargoId,(local.get(source.cargoId)||0)+1);y+=ori.h;return true;
    };
    // Try a shorter homogeneous base too: the last layers can be another height.
    const max=Math.min(baseCount,remaining,Math.floor(container.innerHeight/o.h),c.maxStackLayers??Infinity);
    for(let n=0;n<max;n++){if(!append(c,o))break;}
    if(!column.length)continue;
    const tops=cargoList.filter(t=>t.cargoId!==c.cargoId&&rank(t)===rank(c)).sort((a,b)=>b.height-a.height);
    let progress=true;while(progress&&Date.now()<deadline){progress=false;for(const t of tops){if(used.get(t.cargoId)+(local.get(t.cargoId)||0)>=t.quantity)continue;for(const to of orientations.get(t.cargoId)){if(append(t,to)){progress=true;break;}}if(progress)break;}}
    const v=column.reduce((n,p)=>n+volume(p),0),front=s.x+o.l,fill=v/(o.l*o.w*container.innerHeight);
    let score=typeof policy==='number'?[-rank(c),priority.get(c.cargoId),front,-fill,-v]:policy==='dense'?[-rank(c),-fill,front,-v]:policy==='front'?[-rank(c),front,-fill,-v]:policy==='volume'?[-rank(c),-v,front,-fill]:[front,-fill,-rank(c),-v];
    candidates.push({column,local,block:{...column[0],l:o.l,w:o.w,h:container.innerHeight},score});
    }
   }
  }
  candidates.sort((a,b)=>cmp(a.score,b.score));const best=candidates[0];if(!best)break;
  for(const p of best.column){p.loadingIndex=placed.length+1;placed.push(p);mass+=p.weight||0;}
  for(const [id,n] of best.local)used.set(id,used.get(id)+n);
  spaces=subtractSpaces(spaces,best.block,600).spaces;
 }
 const unloadedCargo=cargoList.flatMap(c=>Array.from({length:c.quantity-used.get(c.cargoId)},(_,i)=>({...make(c,orientations.get(c.cargoId)[0],used.get(c.cargoId)+i+1,{x:0,y:0,z:0}),x:undefined,y:undefined,z:undefined,reason:'NO_FEASIBLE_CANDIDATE_FOUND',reasonEvidence:{proof:'BOUNDED_SEARCH_NOT_IMPOSSIBILITY'}})));
 const validator=validateSourcePlan({placements:placed,cargoList,unloadedCargo,container,rules});
 return {placements:placed,unloadedCargo,validator,loadedVolumeMm3:placed.reduce((s,p)=>s+volume(p),0),stats:{policy:'column-'+policy,timedOut:Date.now()>=deadline}};
}
module.exports={columns};
