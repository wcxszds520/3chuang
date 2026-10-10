'use strict';
const {placement}=require('./SourceBenchmarkSolver');
const {mechanics,validateSourcePlan}=require('./SourceConstraintValidator');
const {resolveOrientationRules}=require('./OrientationConstraint');
const v=p=>p.l*p.w*p.h;
// Joint transverse-wall search: choose several different floor columns together
// using their actual widths and available counts. No preallocated SKU lanes.
function walls(task,context,deadline,decorate,{anchorFirst=false}={}){
 const {cargoList,container,rules}=task,used=new Map(cargoList.map(c=>[c.cargoId,0])),ps=[];
 const orientations=new Map(cargoList.map(c=>[c.cargoId,resolveOrientationRules(c).orientations.flatMap(o=>o.semanticVariants)]));
 let x=0,mass=0;
 const groups=[...new Set(cargoList.map(c=>Number(c.portSequence||1)))].sort((a,b)=>b-a);
 for(const group of groups){
  const rows=cargoList.filter(c=>Number(c.portSequence||1)===group);
  while(x<container.innerLength&&Date.now()<deadline){
   const profiles=[];
   for(const c of rows)for(const o of orientations.get(c.cargoId)){
    if(o.l>container.innerLength-x||o.w>container.innerWidth||(context.door?.widthMm&&o.w>context.door.widthMm)||(context.door?.heightMm&&o.h>context.door.heightMm))continue;
    const count=Math.min(c.quantity-used.get(c.cargoId),Math.floor(container.innerHeight/o.h),c.stackable===false?1:c.maxStackLayers??Infinity);if(count<1)continue;
    for(const baseCount of [...new Set([count,Math.max(1,count-1),1])]){
     const column=[],counts=new Map(),sources=new Map();let h=0;
     const append=(s,a)=>{if(h+a.h>container.innerHeight||a.l>o.l||a.w>o.w||(counts.get(s.cargoId)||0)>=s.quantity-used.get(s.cargoId))return false;
      const p=placement(s,a,(counts.get(s.cargoId)||0)+1,{x:0,y:h,z:0});sources.set(p.cargoId,s);
      if(mechanics([...column.map(c=>c.p),p],sources,rules).violations.length){sources.delete(p.cargoId);return false;}
      column.push({p,source:s,orientation:a});counts.set(s.cargoId,(counts.get(s.cargoId)||0)+1);h+=a.h;return true;};
     for(let i=0;i<baseCount;i++)if(!append(c,o))break;
     if(!column.length)continue;
     for(let layer=0;layer<30&&Date.now()<deadline;layer++){
      const grids=[];
      for(const s of rows){
       if(s.alwaysOnBottom===true)continue;
       const remaining=s.quantity-used.get(s.cargoId)-(counts.get(s.cargoId)||0);
       for(const a of orientations.get(s.cargoId)){
        if(h+a.h>container.innerHeight)continue;
        const nxMax=Math.min(remaining,Math.floor(o.l/a.l),12),nzMax=Math.min(remaining,Math.floor(o.w/a.w),12);
        for(let nx=1;nx<=nxMax;nx++)for(let nz=1;nz<=nzMax;nz++)if(nx*nz<=remaining)grids.push({s,a,nx,nz,area:nx*nz*a.l*a.w});
       }
      }
      grids.sort((a,b)=>b.area-a.area||b.a.h-a.a.h);
      let added=false;
      for(const {s,a,nx,nz} of grids){
       const batch=[];for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
        const p=placement(s,a,(counts.get(s.cargoId)||0)+batch.length+1,{x:ix*a.l,y:h,z:iz*a.w});sources.set(p.cargoId,s);batch.push({p,source:s,orientation:a});
       }
       const check=mechanics([...column.map(c=>c.p),...batch.map(c=>c.p)],sources,rules);
       if(check.violations.length){for(const c of batch)sources.delete(c.p.cargoId);continue;}
       column.push(...batch);counts.set(s.cargoId,(counts.get(s.cargoId)||0)+batch.length);h+=a.h;added=true;break;
      }
      if(!added)break;
     }
     profiles.push({column,counts,l:o.l,w:o.w,anchorArea:c.alwaysOnBottom===true?o.l*o.w:0,volume:column.reduce((s,c)=>s+v(c.p),0),mass:column.reduce((s,c)=>s+(c.p.weight||0),0)});
    }
   }
   if(!profiles.length)break;
   let best=null;
   for(const depth of [...new Set(profiles.map(p=>p.l))]){
    let beam=[{width:0,volume:0,mass:0,anchorArea:0,counts:new Map(),columns:[]}];
    const eligible=profiles.filter(p=>p.l<=depth).sort((a,b)=>b.volume/b.w-a.volume/a.w);
    for(let step=0;step<30&&Date.now()<deadline;step++){
     const next=[];
     for(const state of beam)for(const p of eligible){
      if(state.width+p.w>container.innerWidth||rules.payload&&mass+state.mass+p.mass>container.maxWeight)continue;
      if([...p.counts].some(([id,n])=>used.get(id)+(state.counts.get(id)||0)+n>cargoList.find(c=>c.cargoId===id).quantity))continue;
      const counts=new Map(state.counts);for(const [id,n] of p.counts)counts.set(id,(counts.get(id)||0)+n);
      const candidate={width:state.width+p.w,volume:state.volume+p.volume,mass:state.mass+p.mass,anchorArea:state.anchorArea+p.anchorArea,counts,columns:[...state.columns,p],depth};
      // Floor-only bases must receive their compatible upper cartons before
      // homogeneous carton columns consume those fillers elsewhere.
      next.push(candidate);const anchored=anchorFirst&&candidate.anchorArea>0,priorAnchored=anchorFirst&&best?.anchorArea>0;if(!best||Number(anchored)>Number(priorAnchored)||anchored===priorAnchored&&candidate.volume/depth>best.volume/best.depth)best=candidate;
     }
     if(!next.length)break;
     const unique=new Map();for(const n of next){const k=JSON.stringify([...n.counts].sort())+':'+n.width;if(!unique.has(k)||n.volume>unique.get(k).volume)unique.set(k,n);}
     beam=[...unique.values()].sort((a,b)=>(anchorFirst?Number(b.anchorArea>0)-Number(a.anchorArea>0):0)||b.volume-a.volume).slice(0,24);
    }
   }
   if(!best)break;
   // Adjacent columns with the same bottom SKU form a continuous picking block.
   best.columns.sort((a,b)=>a.column[0].source.cargoId.localeCompare(b.column[0].source.cargoId));
   let z=0;for(const column of best.columns){for(const c of column.column){const id=c.source.cargoId,index=used.get(id)+1;const p=decorate(placement(c.source,c.orientation,index,{x:x+c.p.x,y:c.p.y,z:z+c.p.z}));p.loadingIndex=ps.length+1;ps.push(p);used.set(id,index);mass+=p.weight||0;}z+=column.w;}
   x+=Math.max(...best.columns.map(c=>c.l));
  }
 }
 const unloadedCargo=cargoList.flatMap(c=>Array.from({length:c.quantity-used.get(c.cargoId)},(_,i)=>{const p=decorate(placement(c,orientations.get(c.cargoId)[0],used.get(c.cargoId)+i+1,{x:0,y:0,z:0}));delete p.x;delete p.y;delete p.z;return {...p,reason:'NO_FEASIBLE_CANDIDATE_FOUND',reasonEvidence:{proof:'BOUNDED_WALL_SEARCH_NOT_IMPOSSIBILITY'}};}));
 return {placements:ps,unloadedCargo,validator:validateSourcePlan({...task,placements:ps,unloadedCargo}),loadedVolumeMm3:ps.reduce((s,p)=>s+v(p),0),stats:{policy:'joint-transverse-walls',timedOut:Date.now()>=deadline}};
}
module.exports={walls};
