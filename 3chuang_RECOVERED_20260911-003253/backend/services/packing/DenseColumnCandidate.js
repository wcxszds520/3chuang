'use strict';
// Isolated geometry research candidate. Never writes source facts or saved plans.
const {resolveOrientationRules}=require('./OrientationConstraint');
const {construct,placement,subtractSpaces}=require('./SourceBenchmarkSolver');
const {validateSourcePlan}=require('./SourceConstraintValidator');
const {geometryTask}=require('./GeometryPackingCandidate');
const {exactVoidMetrics}=require('./ExactLayoutMetrics');
const volume=p=>p.l*p.w*p.h;
function columnOptions(task,remaining){
 const orientations=task.cargoList.map(s=>resolveOrientationRules(s).orientations.flatMap(x=>x.semanticVariants));
 const all=[];
 for(let i=0;i<remaining.length;i++)if(remaining[i])for(const o of orientations[i]){
  if(o.h>task.container.innerHeight)continue;
  const initial={items:[{i,o,y:0}],counts:remaining.map((_,j)=>+(i===j)),h:o.h,l:o.l,w:o.w,volume:volume(o),top:o};
  let level=[initial];all.push(initial);
  for(let depth=0;depth<6;depth++){
   const next=[];
   for(const stack of level)for(let j=0;j<remaining.length;j++)if(stack.counts[j]<remaining[j])for(const upper of orientations[j]){
    if(upper.l>stack.top.l+.001||upper.w>stack.top.w+.001||stack.h+upper.h>task.container.innerHeight+.001)continue;
    const counts=[...stack.counts];counts[j]++;
    next.push({...stack,items:[...stack.items,{i:j,o:upper,y:stack.h}],counts,h:stack.h+upper.h,volume:stack.volume+volume(upper),top:upper});
   }
   next.sort((a,b)=>b.volume-a.volume||b.h-a.h);
   level=[...new Map(next.map(x=>[x.counts.join(',')+':'+x.top.l+':'+x.top.w,x])).values()].slice(0,8);
   all.push(...level);if(!level.length)break;
  }
 }
 return all;
}
function denseColumns(task,{beamWidth=24,maxRounds=48,potential=.85}={}){
 const {innerLength:L,innerWidth:W,innerHeight:H}=task.container;
 let beam=[{remaining:task.cargoList.map(s=>s.quantity),columns:[],spaces:[{x:0,y:0,z:0,l:L,w:W,h:H}],volume:0,area:0}],best=beam[0],expanded=0;
 for(let round=0;round<maxRounds&&beam.length;round++){
  const next=[];
  for(const state of beam){
   const options=columnOptions(task,state.remaining);let children=[];
   for(const col of options)for(const space of state.spaces){
    if(col.l>space.l+.001||col.w>space.w+.001)continue;
    for(const z of [...new Set([space.z,space.z+space.w-col.w])]){
     const b={x:space.x,y:0,z,l:col.l,w:col.w,h:H},remaining=state.remaining.map((v,i)=>v-col.counts[i]);
     const c={remaining,columns:[...state.columns,{...col,x:b.x,z}],spaces:subtractSpaces(state.spaces,b,120).spaces,volume:state.volume+col.volume,area:state.area+col.l*col.w};
     c.score=c.volume+(L*W-c.area)*H*potential;children.push(c);expanded++;
    }
   }
   children.sort((a,b)=>b.score-a.score||b.volume-a.volume);
   children=children.slice(0,16);next.push(...children);
   for(const c of children)if(c.volume>best.volume)best=c;
  }
  next.sort((a,b)=>b.score-a.score||b.volume-a.volume);
  const unique=new Map();for(const c of next){const key=c.remaining.join(',')+'|'+c.spaces.map(s=>[s.x,s.z,s.l,s.w].join(',')).sort().join(';');if(!unique.has(key))unique.set(key,c);if(unique.size>=beamWidth)break;}
  beam=[...unique.values()];
 }
 const counts=task.cargoList.map(()=>0),placements=[];
 for(const col of best.columns)for(const piece of col.items){const p=placement(task.cargoList[piece.i],piece.o,++counts[piece.i],{x:col.x,y:piece.y,z:col.z});p.loadingIndex=placements.length+1;placements.push(p);}
 return {placements,volume:best.volume,columns:best.columns.length,expanded};
}
function directRefill(task,seed){
 const candidates=['block-volume','best-fit','layer'].map(policy=>construct(task,policy,Date.now()+3000,{maximumSpaces:4000,seed}));
 return candidates.filter(c=>c.validator.valid).sort((a,b)=>b.loadedVolumeMm3-a.loadedVolumeMm3)[0];
}
function solveDenseCandidate(input,{incumbent,beamWidth=24}={}){
 if(input.capabilities?.canSolve!==true)throw Error('Unsupported source');
 const before=JSON.stringify(input),task=geometryTask(input),runs=[];
 let best=incumbent?directRefill(task,structuredClone(incumbent.loadedCargo||incumbent.placements)):null;
 for(const potential of [.65,.85,1]){
  const column=denseColumns(task,{potential,beamWidth});const candidate=directRefill(task,column.placements);
  runs.push({potential,columnCount:column.columns,expanded:column.expanded,loaded:candidate?.placements.length,volume:candidate?.loadedVolumeMm3,valid:candidate?.validator.valid});
  if(candidate&&(!best||candidate.loadedVolumeMm3>best.loadedVolumeMm3))best=candidate;
 }
 if(!best)throw Error('No valid dense candidate');
 const originalValidation=validateSourcePlan({placements:best.placements,unloadedCargo:best.unloadedCargo,...input});
 for(const p of [...best.placements,...best.unloadedCargo]){const s=input.cargoList.find(s=>s.cargoId===p.sourceCargoId);for(const k of ['stackable','maxStackLayers','packagingType','fragile'])if(Object.hasOwn(s,k))p[k]=s[k];}
 if(JSON.stringify(input)!==before)throw Error('Input changed');
 return {...best,exactVoid:exactVoidMetrics(best.placements,input.container),originalValidation,study:{version:'dense-column-v2',purpose:'SPACE_STUDY',shippingReady:false,optimalityProven:false,officialBenchmarkResult:false,runs,relaxed:['pressure','cog','axle','payload','source-stack-policy','unload-order','securing'],retained:['dimensions','quantity','orientation','bounds','no-overlap','full-support']}};
}
module.exports={denseColumns,solveDenseCandidate,directRefill,columnOptions};
