'use strict';
const {resolveOrientationRules}=require('./OrientationConstraint');
const {validateSourcePlan,mechanics,overlap,supportContacts}=require('./SourceConstraintValidator');
const {unionArea}=require('./PlanValidator');
const {exactVoidMetrics,rearWallMetrics}=require('./ExactLayoutMetrics');
const {fitsDoor,evaluateInsertionPath}=require('./InsertionPathFeasibility');
const EPS=0.001;
const volume=p=>p.l*p.w*p.h;
const contains=(a,b)=>b.x>=a.x-EPS&&b.y>=a.y-EPS&&b.z>=a.z-EPS&&b.x+b.l<=a.x+a.l+EPS&&b.y+b.h<=a.y+a.h+EPS&&b.z+b.w<=a.z+a.w+EPS;
const compare=(a,b)=>{for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>1e-8)return a[i]-b[i];return 0;};

// Maximal empty rectangles in 3D are split at actual placed faces. There is no
// dataset-specific coordinate, synthetic lane, translation or mass default.
function subtractSpaces(spaces,p,limit=1800){
  const next=[];
  for(const s of spaces){
    if(!overlap(s,p)){next.push(s);continue;}
    if(p.x>s.x+EPS)next.push({...s,l:p.x-s.x});
    if(p.x+p.l<s.x+s.l-EPS)next.push({...s,x:p.x+p.l,l:s.x+s.l-p.x-p.l});
    if(p.y>s.y+EPS)next.push({...s,h:p.y-s.y});
    if(p.y+p.h<s.y+s.h-EPS)next.push({...s,y:p.y+p.h,h:s.y+s.h-p.y-p.h});
    if(p.z>s.z+EPS)next.push({...s,w:p.z-s.z});
    if(p.z+p.w<s.z+s.w-EPS)next.push({...s,z:p.z+p.w,w:s.z+s.w-p.z-p.w});
  }
  const unique=[...new Map(next.filter(s=>s.l>EPS&&s.w>EPS&&s.h>EPS).map(s=>[[s.x,s.y,s.z,s.l,s.w,s.h].join(':'),s])).values()].sort((a,b)=>volume(b)-volume(a));
  const kept=[];
  for(const s of unique)if(!kept.some(a=>contains(a,s)))kept.push(s);
  return {spaces:kept.slice(0,limit),truncated:kept.length>limit};
}
function placement(source,orientation,index,point){
  return {cargoId:`${source.cargoId}__piece_${String(index).padStart(5,'0')}`,sourceCargoId:source.cargoId,sku:source.sku,name:source.name,
    x:point.x,y:point.y,z:point.z,l:orientation.l,w:orientation.w,h:orientation.h,weight:source.weight,quantity:1,
    orientation:orientation.legacyLabel,orientationId:orientation.id,canonicalOrientation:orientation.id,axisMap:{...orientation.axisMap},uprightOriginalAxis:orientation.uprightOriginalAxis,
    orientationConstraints:source.orientationConstraints,stackable:source.stackable,maxStackLayers:source.maxStackLayers,packagingType:source.packagingType,
    portSequence:null,destinationPort:null,batchId:null,handlingMethod:null,sourceItemId:source.externalMetadata?.externalItemId,
    sourcePhysicalItemId:source.externalMetadata?.sourceFields?.itemCodes?.[index-1]??null,
    loadingIndex:0,color:'#3b82f6',type:'BOX',algorithmMeta:{candidateSource:'SOURCE_MAXIMAL_SPACE_PORTFOLIO',orientation:orientation.legacyLabel}};
}
function score(p,s,source,policy,bin){
  const v=volume(p),fit=Math.min(s.l-p.l,s.w-p.w),pressure=source.loadBearing?.[{L:'lengthUpright',W:'widthUpright',H:'heightUpright'}[p.uprightOriginalAxis]]??0;
  const compact=[(p.x+p.l)/bin.innerLength,p.y/bin.innerHeight,p.z/bin.innerWidth];
  if(policy==='volume')return [-v,...compact,fit];
  if(policy==='footprint')return [-p.l*p.w,p.y,p.x,p.z,-v];
  if(policy==='wall')return [p.x+p.l,p.x,p.y,fit,-v,p.z];
  if(policy==='layer')return [p.y,p.h,-v,p.x,p.z];
  if(policy==='strength')return [p.y,-pressure,-p.l*p.w,p.x,p.z];
  if(policy==='best-fit')return [fit,p.x+p.l,p.y,-v,p.z];
  if(policy==='tall')return [-p.h,p.x+p.l,p.y,-p.l*p.w,p.z];
  return [p.y,p.x+p.l,-v,p.z];
}
function construct(task,policy,deadline,options={}){
  const {container,rules,cargoList}=task;
  const placements=(options.seed||task.lockedPlacements||[]).map(p=>({...p}));
  const occupiedIds=new Set(placements.map(p=>p.cargoId));
  const groups=cargoList.map(s=>{const placed=placements.filter(p=>p.sourceCargoId===s.cargoId).length;const pendingIndices=Array.from({length:s.quantity},(_,i)=>i+1).filter(i=>!occupiedIds.has(`${s.cargoId}__piece_${String(i).padStart(5,'0')}`));return {source:s,remaining:s.quantity-placed,placed,pendingIndices,orientations:resolveOrientationRules(s).orientations.flatMap(o=>o.semanticVariants)};});
  let spaces=[{x:0,y:0,z:0,l:container.innerLength,w:container.innerWidth,h:container.innerHeight}],mass=rules.weightKnown?placements.reduce((s,p)=>s+p.weight,0):0,spaceTruncated=false;
  for(const p of placements)spaces=subtractSpaces(spaces,p,options.maximumSpaces).spaces;
  const sources=new Map(),rejections={},stats={policy,generated:0,mechanicalChecks:0,placed:0,elapsedMs:0,timedOut:false,spaceTruncated:false};
  for(const p of placements)sources.set(p.cargoId,cargoList.find(s=>s.cargoId===p.sourceCargoId));
  const begin=Date.now();
  while(Date.now()<deadline){
    let candidates=[];
    for(const g of groups){if(!g.remaining)continue;
      if(rules.payload&&mass+g.source.weight>container.maxWeight+EPS){rejections.PAYLOAD_LIMIT=(rejections.PAYLOAD_LIMIT||0)+1;continue;}
      for(const o of g.orientations)for(const space of spaces)for(const s of [space,...(space.w>o.w+EPS?[{...space,z:space.z+space.w-o.w,w:o.w}]:[])]){
        if(!fitsDoor(o,container))continue;
        if(o.l>s.l+EPS||o.w>s.w+EPS||o.h>s.h+EPS)continue;
        const p=placement(g.source,o,g.pendingIndices[0],s);stats.generated++;
        if(s.y>EPS){
          if(rules.stacking&&g.source.alwaysOnBottom===true)continue;
          const links=supportContacts(p,placements);
          if(unionArea(links)/(p.l*p.w)+1e-9<rules.supportRatio){rejections.SUPPORT_FAILURE=(rejections.SUPPORT_FAILURE||0)+1;continue;}
        }
        if(policy.startsWith('block-')){
          let ymax=Math.min(Math.floor((s.h+EPS)/o.h),g.remaining);
          if(g.source.stackable===false||rules.stacking&&g.source.alwaysOnTop===true)ymax=1;
          if(Number.isInteger(g.source.maxStackLayers))ymax=Math.min(ymax,g.source.maxStackLayers);
          if(rules.pressure&&g.source.weight>0){const capacity=g.source.loadBearing?.[{L:'lengthUpright',W:'widthUpright',H:'heightUpright'}[o.uprightOriginalAxis]];ymax=Math.min(ymax,1+Math.floor((capacity+1e-9)*(o.l*o.w/100)/g.source.weight));}
          const xmax=Math.min(Math.floor((s.l+EPS)/o.l),g.remaining),zmax=Math.min(Math.floor((s.w+EPS)/o.w),g.remaining);
          for(const nx of [...new Set([1,xmax])])for(const nz of [...new Set([1,zmax,Math.min(zmax,Math.floor(g.remaining/nx))])])for(const ny of [...new Set([1,Math.min(ymax,Math.floor(g.remaining/(nx*nz)))])]){
            const count=nx*ny*nz;if(count<1||count>g.remaining||ny<1)continue;
            if(rules.payload&&mass+count*g.source.weight>container.maxWeight+EPS)continue;
            const block={...p,l:nx*o.l,w:nz*o.w,h:ny*o.h};
            const blockScore=policy==='block-wall'?[block.x+block.l,-volume(block),block.y,block.z]:[-volume(block),block.y,block.x+block.l,block.z];
            candidates.push({p:block,g,orientation:o,grid:{nx,ny,nz},score:blockScore});
          }
        }else candidates.push({p,g,score:score(p,s,g.source,policy,container)});
      }
    }
    // Optional business extension; source benchmark requests keep their original ordering.
    if(options.scoreCandidates)options.scoreCandidates(candidates,placements);
    candidates.sort((a,b)=>compare(a.score,b.score));
    let accepted=null;
    const seen=new Set();
    for(const c of candidates){
      if(Date.now()>=deadline)break;
      const key=[c.p.sourceCargoId,c.p.x,c.p.y,c.p.z,c.p.l,c.p.w,c.p.h,c.p.orientationId].join(':');if(seen.has(key))continue;seen.add(key);
      if(placements.some(p=>overlap(p,c.p)))continue;
      const batch=[];
      if(c.grid){for(let iy=0;iy<c.grid.ny;iy++)for(let ix=0;ix<c.grid.nx;ix++)for(let iz=0;iz<c.grid.nz;iz++)batch.push(placement(c.g.source,c.orientation,c.g.pendingIndices[batch.length],{x:c.p.x+ix*c.orientation.l,y:c.p.y+iy*c.orientation.h,z:c.p.z+iz*c.orientation.w}));}
      else batch.push(c.p);
      // A retained layout can be rearranged in the plan; physically locked
      // units are already present and must not obstruct a new insertion.
      if(batch.some(item=>!evaluateInsertionPath(item,task.lockedPlacements||[],container).feasible))continue;
      if(options.acceptBatch&&!options.acceptBatch(batch,placements))continue;
      for(const item of batch)sources.set(item.cargoId,c.g.source);
      const check=mechanics([...placements,...batch],sources,rules);stats.mechanicalChecks++;
      if(check.violations.length){for(const item of batch)sources.delete(item.cargoId);for(const v of check.violations)rejections[v.code]=(rejections[v.code]||0)+1;continue;}
      c.batch=batch;
      accepted=c;break;
    }
    if(!accepted)break;
    const {p,g,batch}=accepted;for(const item of batch){item.loadingIndex=placements.length+1;placements.push(item);}g.placed+=batch.length;g.remaining-=batch.length;g.pendingIndices.splice(0,batch.length);if(rules.weightKnown)mass+=g.source.weight*batch.length;
    const split=subtractSpaces(spaces,p,options.maximumSpaces);spaces=split.spaces;spaceTruncated ||=split.truncated;
    if(!groups.some(g=>g.remaining))break;
  }
  stats.placed=placements.length;stats.elapsedMs=Date.now()-begin;stats.timedOut=Date.now()>=deadline;stats.spaceTruncated=spaceTruncated;
  const freeVolume=container.innerLength*container.innerWidth*container.innerHeight-placements.reduce((sum,p)=>sum+volume(p),0);
  const unloadedCargo=groups.flatMap(g=>Array.from({length:g.remaining},(_,i)=>{
    const reason=!g.orientations.some(o=>o.l<=container.innerLength+EPS&&o.w<=container.innerWidth+EPS&&o.h<=container.innerHeight+EPS)?'ITEM_TOO_LARGE'
      :rules.payload&&mass+g.source.weight>container.maxWeight+EPS?'PAYLOAD_LIMIT'
        :g.source.length*g.source.width*g.source.height>freeVolume+EPS?'NO_SPACE_REMAINING':stats.timedOut?'SEARCH_BUDGET_EXHAUSTED':'NO_FEASIBLE_CANDIDATE_FOUND';
    return {...placement(g.source,g.orientations[0],g.pendingIndices[i],{x:0,y:0,z:0}),x:undefined,y:undefined,z:undefined,reason,reasonEvidence:{proof:['NO_FEASIBLE_CANDIDATE_FOUND','SEARCH_BUDGET_EXHAUSTED'].includes(reason)?'BOUNDED_SEARCH_NOT_IMPOSSIBILITY':'DIMENSION_OR_CAPACITY_BOUND',remainingFreeVolumeMm3:freeVolume,observedCandidateRejections:rejections,searchTimedOut:stats.timedOut,spaceSetTruncated:spaceTruncated}};
  }));
  const validator=validateSourcePlan({placements,cargoList,unloadedCargo,container,rules,lockedPlacements:task.lockedPlacements});
  return {placements,unloadedCargo,validator,loadedVolumeMm3:placements.reduce((s,p)=>s+volume(p),0),stats,rejections};
}
function solveSourceBenchmark(task,{quality='quality',timeLimitMs=30000,maximumSpaces=1800}={}){
  if(!task.capabilities?.canSolve)throw Object.assign(new Error('Source capability does not permit solving'),{code:'SOURCE_NOT_SOLVABLE',details:task.capabilities});
  if(task.rules?.lifo)throw Object.assign(new Error('Source benchmark does not implement business port-order policy; use COMMERCE or Native'),{code:'SOURCE_BUSINESS_RULE_UNSUPPORTED'});
  const begin=Date.now(),policies=quality==='fast'?['volume','wall']:['volume','wall','block-volume','block-wall','footprint','layer','strength','best-fit','tall','floor'];
  const candidates=[];let best=null;
  for(let i=0;i<policies.length;i++){
    const available=begin+timeLimitMs-Date.now();if(available<=0)break;
    const budget=Math.max(1,Math.floor(available/(policies.length-i)));
    const candidate=construct(task,policies[i],Date.now()+budget,{maximumSpaces});candidates.push(candidate);
    if(candidate.validator.valid&&(!best||candidate.loadedVolumeMm3>best.loadedVolumeMm3+1||candidate.loadedVolumeMm3===best.loadedVolumeMm3&&candidate.placements.length>best.placements.length))best=candidate;
    if(best?.unloadedCargo.length===0)break;
  }
  // Reconstruct a suffix of the current incumbent. Improvements become the next
  // incumbent, so A -> B -> C is possible instead of comparing only to A.
  if(quality!=='fast'&&best?.unloadedCargo.length){
    for(const fraction of [0.5,0.75,0.9])for(const policy of ['volume','block-volume','strength','best-fit']){
      const available=begin+timeLimitMs-Date.now();if(available<50||!best.unloadedCargo.length)break;
      const lockIds=new Set((task.lockedPlacements||[]).map(p=>p.cargoId));
      const seed=[...(task.lockedPlacements||[]),...best.placements.slice(0,Math.floor(best.placements.length*fraction)).filter(p=>!lockIds.has(p.cargoId))];
      const candidate=construct(task,policy,Date.now()+Math.min(available,2000),{maximumSpaces,seed});candidate.stats.reconstruction={retained:seed.length,fromVolumeMm3:best.loadedVolumeMm3};candidates.push(candidate);
      if(candidate.validator.valid&&(candidate.loadedVolumeMm3>best.loadedVolumeMm3+1||candidate.loadedVolumeMm3===best.loadedVolumeMm3&&candidate.placements.length>best.placements.length))best=candidate;
    }
  }
  if(!best)throw Object.assign(new Error('No independently valid source candidate'),{code:'NO_HARD_FEASIBLE_PLAN',details:candidates.map(c=>c.validator)});
  const diagnosticStart=Date.now(),unloadedDiagnostics=diagnoseUnloaded(best,task,Math.min(3000,timeLimitMs/4));
  const exactVoid=exactVoidMetrics(best.placements,task.container),rearWall=rearWallMetrics(best.placements,task.container);
  if(Math.abs(exactVoid.conservationErrorMm3||0)>1)throw Object.assign(new Error('Exact void conservation failed'),{code:'EXACT_VOID_INVALID'});
  return {...best,unloadedDiagnostics,exactVoid,rearWall,search:{mode:quality,elapsedMs:Date.now()-begin,budgetMs:timeLimitMs,diagnosticMs:Date.now()-diagnosticStart,selectedPolicy:best.stats.policy,candidates:candidates.map(c=>({policy:c.stats.policy,loaded:c.placements.length,volumeMm3:c.loadedVolumeMm3,valid:c.validator.valid,...c.stats})),algorithm:'SOURCE_MAXIMAL_SPACE_PORTFOLIO',ranking:['HARD_VALID','LOADED_VOLUME','LOADED_COUNT'],impossibilityClaim:false}};
}
function diagnoseUnloaded(plan,task,budgetMs){
  const bySource=new Map(),deadline=Date.now()+budgetMs,sources=new Map(plan.placements.map(p=>[p.cargoId,task.cargoList.find(c=>c.cargoId===p.sourceCargoId)]));
  let spaces=[{x:0,y:0,z:0,l:task.container.innerLength,w:task.container.innerWidth,h:task.container.innerHeight}];
  for(const p of plan.placements)spaces=subtractSpaces(spaces,p,5000).spaces;
  for(const unloaded of plan.unloadedCargo){
    if(bySource.has(unloaded.sourceCargoId))continue;
    const source=task.cargoList.find(c=>c.cargoId===unloaded.sourceCargoId),diagnostic={sourceCargoId:source.cargoId,testedPositions:0,geometricFits:0,feasiblePositions:0,rejections:{},truncated:false,proof:'FINAL_MAXIMAL_SPACE_CANDIDATES_ONLY'};
    for(const o of resolveOrientationRules(source).orientations.flatMap(o=>o.semanticVariants))for(const s of spaces){
      if(Date.now()>deadline){diagnostic.truncated=true;break;}
      if(o.l>s.l+EPS||o.w>s.w+EPS||o.h>s.h+EPS)continue;diagnostic.geometricFits++;
      const p={...placement(source,o,1,s),cargoId:unloaded.cargoId};sources.set(p.cargoId,source);diagnostic.testedPositions++;
      const check=mechanics([...plan.placements,p],sources,task.rules);sources.delete(p.cargoId);
      if(task.rules.payload&&plan.validator.totalWeight+p.weight>task.container.maxWeight+EPS)check.violations.push({code:'PAYLOAD_LIMIT'});
      if(!check.violations.length)diagnostic.feasiblePositions++;
      for(const code of new Set(check.violations.map(v=>v.code)))diagnostic.rejections[code]=(diagnostic.rejections[code]||0)+1;
    }
    diagnostic.primaryRejectedConstraint=Object.entries(diagnostic.rejections).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
    bySource.set(source.cargoId,diagnostic);
  }
  for(const p of plan.unloadedCargo)p.reasonEvidence={...p.reasonEvidence,sourceDiagnostic:bySource.get(p.sourceCargoId)};
  return [...bySource.values()];
}
module.exports={solveSourceBenchmark,construct,subtractSpaces,placement};
