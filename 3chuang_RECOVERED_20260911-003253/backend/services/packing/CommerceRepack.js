'use strict';
const {construct,placement}=require('./SourceBenchmarkSolver');
const {validateSourcePlan}=require('./SourceConstraintValidator');
const {resolveOrientationRules}=require('./OrientationConstraint');
const {pairAllowed,supports,auditCommerce,cluster}=require('./CommerceAudit');
const key=c=>JSON.stringify([c.customerId||'',c.orderId||c.cargoId]);
const volume=p=>p.l*p.w*p.h;

// Retained positions must form a support-closed set. Removing a lower box also
// reopens every dependent upper box; a locked box is never silently displaced.
function supportClosedSeed(placements,removeIds,locks=[]){
 const removed=new Set(removeIds);let changed=true;
 while(changed){changed=false;for(const p of placements)if(!removed.has(p.cargoId)&&placements.some(q=>removed.has(q.cargoId)&&supports(q,p))){removed.add(p.cargoId);changed=true;}}
 if(locks.some(p=>removed.has(p.cargoId)))return null;
 return placements.filter(p=>!removed.has(p.cargoId));
}
function accept(context,decorate){return (batch,old)=>{
 const added=batch.map(decorate),placed=old.map(decorate);
 return added.every(p=>!(context.door?.widthMm&&p.w>context.door.widthMm)&&!(context.door?.heightMm&&p.h>context.door.heightMm)&&placed.every(q=>pairAllowed(p,q,context.lifo!==false)));
};}
function repair(task,context,decorate,seed,deadline,policy='wall'){
 return construct(task,'block-wall',deadline,{maximumSpaces:2400,seed,acceptBatch:accept(context,decorate),scoreCandidates:(cs,ps)=>{
  const active=new Set(ps.map(p=>key(decorate(p)))),near=new Map();for(const p of ps)near.set(cluster(decorate(p)),p);
  for(const c of cs){const s=c.g.source,p=c.p,n=near.get(cluster(s));const distance=n?Math.hypot(p.x-n.x,p.z-n.z,p.y-n.y):0;
   // Wall thickness and unused transverse width are evaluated together; no
   // fixed SKU lanes or scenario-specific coordinates are reserved.
   const front=p.x+p.l,remainingWidth=task.container.innerWidth-p.z-p.w;
   const wall=[front,remainingWidth,-volume(p),p.y,distance];
   c.score=policy==='order'?[-Number(s.portSequence),s.required===true?0:1,-(s.shipmentPriority||0),active.has(key(s))?0:1,...wall]:[-Number(s.portSequence),...wall];
  }
 }});
}
function enforceWholeOrders(candidate,task,original,context,decorate){
 let ps=candidate.placements.map(decorate),removedOrders=new Set();
 for(let pass=0;pass<=original.length;pass++){
  const totals=new Map(),counts=new Map();for(const c of original)totals.set(key(c),(totals.get(key(c))||0)+c.quantity);
  for(const p of ps)counts.set(key(p),(counts.get(key(p))||0)+1);
  const partial=new Set(original.filter(c=>c.allowPartialShipment===false&&counts.get(key(c))>0&&counts.get(key(c))<totals.get(key(c))).map(key));
  if(!partial.size)break;
  for(const k of partial)removedOrders.add(k);
  const next=supportClosedSeed(ps,ps.filter(p=>partial.has(key(p))).map(p=>p.cargoId),context.lockedPlacements);
  if(!next)return null;ps=next;
 }
 const placedIds=new Set(ps.map(p=>p.cargoId)),unloaded=[];
 for(const c of task.cargoList){const orientation=resolveOrientationRules(c).orientations[0].semanticVariants[0];for(let i=1;i<=c.quantity;i++){
  const p=decorate(placement(c,orientation,i,{x:0,y:0,z:0}));if(!placedIds.has(p.cargoId)){delete p.x;delete p.y;delete p.z;p.reason=removedOrders.has(key(c))?'WHOLE_ORDER_DEFERRED':'NO_FEASIBLE_CANDIDATE_FOUND';p.reasonEvidence={proof:'BOUNDED_SEARCH_NOT_IMPOSSIBILITY'};unloaded.push(p);}
 }}
 const result={...candidate,placements:ps,unloadedCargo:unloaded,loadedVolumeMm3:ps.reduce((s,p)=>s+volume(p),0)};
 result.validator=validateSourcePlan({...task,placements:ps,unloadedCargo:unloaded});
 result.audit=auditCommerce(ps,original,context);return result;
}
module.exports={supportClosedSeed,repair,enforceWholeOrders};
