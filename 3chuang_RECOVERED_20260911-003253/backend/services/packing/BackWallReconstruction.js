'use strict';
const { depthWalls } = require('./WallOrderRepair');
const { calculateCoG } = require('./PlanMetrics');
const { exactVoidMetrics, rearWallMetrics } = require('./ExactLayoutMetrics');
const policy = require('../../config/packingPolicy');
const EPS=.001;
const n=p=>Number(p||0);
const round=p=>Math.round(p*1000)/1000;

// The components are actual vertical contact components, including bridges
// with multiple supporters. No SKU or batch equivalence is assumed.
function supportComponents(items) {
  const parents=items.map((_,i)=>i);
  const root=i=>parents[i]===i?i:(parents[i]=root(parents[i]));
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++) {
    const a=items[i],b=items[j];
    if((Math.abs(a.y+a.h-b.y)<=EPS||Math.abs(b.y+b.h-a.y)<=EPS)
      && Math.min(a.x+a.l,b.x+b.l)>Math.max(a.x,b.x)+EPS
      && Math.min(a.z+a.w,b.z+b.w)>Math.max(a.z,b.z)+EPS) parents[root(j)]=root(i);
  }
  const groups=new Map();items.forEach((item,i)=>{const k=root(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(item);});
  return [...groups.values()].map(items=>{
    const minX=Math.min(...items.map(p=>p.x)),minZ=Math.min(...items.map(p=>p.z)),minY=Math.min(...items.map(p=>p.y));
    const depth=round(Math.max(...items.map(p=>p.x+p.l))-minX),width=round(Math.max(...items.map(p=>p.z+p.w))-minZ);
    const type=items.map(p=>[p.x-minX,p.y,p.z-minZ,p.l,p.w,p.h,p.weight,p.portSequence,p.stackable,p.maximumSupportedWeightKg,p.maxStackLayers,p.handlingMethod,p.packagingType].join(':')).sort().join('/');
    return {items,minX,minY,minZ,depth,width,type,port:items[0].portSequence,mass:items.reduce((s,p)=>s+p.weight,0),key:items.map(p=>p.cargoId).sort().join('|')};
  });
}
function anchoredWalls(items, sortMass=false) {
  const walls=depthWalls(items);let cursor=0;const result=[];
  for(let i=0;i<walls.length;) {
    const run=[walls[i]];let next=i+1;
    while(sortMass&&walls[i].ports.size===1&&next<walls.length&&walls[next].ports.size===1&&[...walls[next].ports][0]===[...walls[i].ports][0])run.push(walls[next++]);
    if(sortMass)run.sort((a,b)=>a.weight/(a.end-a.start)-b.weight/(b.end-b.start)||a.start-b.start);
    for(const wall of run){for(const p of wall.items)result.push({...p,x:round(cursor+p.x-wall.start)});cursor=round(cursor+wall.end-wall.start);}
    i=next;
  }
  return result;
}

function generateBackWallCandidates({basePlacements=[],container,beamWidth=20,searchDepth=8,maximumResults=10,mode='LANE',maximumStates=18000}={}) {
  const walls=depthWalls(basePlacements);
  const firstPort=Math.min(...basePlacements.map(p=>n(p.portSequence)||1));
  const depthCounts=new Map();for(const w of walls){const d=round(w.end-w.start);depthCounts.set(d,(depthCounts.get(d)||0)+w.items.length);}
  const depth=[...depthCounts].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const movable=walls.filter(w=>Math.abs(w.end-w.start-depth)<EPS&&w.items.every(p=>p.portSequence!==firstPort));
  const units=movable.flatMap(w=>supportComponents(w.items));
  if(!units.length||units.some(u=>u.minY>EPS||Math.abs(u.depth-depth)>EPS||new Set(u.items.map(p=>p.portSequence)).size!==1))return [];
  const retained=walls.filter(w=>!movable.includes(w));
  const prefix=retained.filter(w=>!w.items.every(p=>p.portSequence===firstPort));
  const suffix=retained.filter(w=>w.items.every(p=>p.portSequence===firstPort));
  const maxWidth=Math.max(...units.map(u=>u.width));
  const laneCount=Math.floor((container.innerWidth+EPS)/maxWidth);
  if(laneCount<2||laneCount>6||units.length>120)return [];
  const prefixDepth=prefix.reduce((s,w)=>s+w.end-w.start,0);
  let explored=0,seed=9349;
  const starts=[];
  const order=(a,b)=>b.port-a.port||a.mass-b.mass||a.key.localeCompare(b.key);
  function evaluate(lanes,history) {
    explored++;
    const sorted=lanes.map(lane=>[...lane].sort(order));
    // Lane coordinates derive from the widths of actual support components.
    // No fixed lane count, width or order-specific coordinates enter this pass.
    const widths=sorted.map(lane=>Math.max(0,...lane.map(u=>u.width)));
    const zs=[];let widthCursor=0;for(const width of widths){zs.push(widthCursor);widthCursor+=width;}
    if(widthCursor>container.innerWidth+EPS)return null;
    const result=[];let cursor=0;
    for(const wall of prefix){for(const p of wall.items)result.push({...p,x:round(cursor+p.x-wall.start)});cursor+=wall.end-wall.start;}
    sorted.forEach((lane,laneIndex)=>{
      let x=prefixDepth;
      for(const u of lane){const z=zs[laneIndex]+(laneIndex===0?widths[laneIndex]-u.width:0);
        for(const p of u.items)result.push({...p,x:round(x+p.x-u.minX),z:round(z+p.z-u.minZ)});
        x+=u.depth;
      }
    });
    cursor=prefixDepth+Math.max(...sorted.map(lane=>lane.reduce((s,u)=>s+u.depth,0)));
    for(const wall of suffix){for(const p of wall.items)result.push({...p,x:round(cursor+p.x-wall.start)});cursor+=wall.end-wall.start;}
    if(cursor>container.innerLength+EPS)return null;
    const cog=calculateCoG(result,container);
    const longitudinalExcess=Math.max(0,cog.longitudinal-policy.cog.longitudinalLimitPercent);
    const lateralExcess=Math.max(0,cog.lateral-policy.cog.lateralLimitPercent);
    const geometry=exactVoidMetrics(result,container);
    const rear=rearWallMetrics(result,container);
    const key=sorted.map(lane=>lane.map(u=>u.type).join(';')).join('|');
    return {lanes:sorted,placements:result,history,key,cog,rear,geometry,widths,zs,
      // Complete candidates crossing a hard CoG boundary are never selectable;
      // exploratory states retain their excess to allow cumulative repair.
      rank:[longitudinalExcess+lateralExcess>1e-7?1:0,longitudinalExcess+lateralExcess,rear.deepEndPrimaryGap,geometry.volumesMm3.irregularInternalVoid,geometry.internalVoidMm3,Math.max(cog.longitudinal,cog.lateral)]};
  }
  const rank=(a,b)=>{for(let i=0;i<a.rank.length;i++)if(Math.abs(a.rank[i]-b.rank[i])>1e-7)return a.rank[i]-b.rank[i];return a.key.localeCompare(b.key);};
  for(let start=0;start<beamWidth;start++){
    const shuffled=[...units].sort((a,b)=>a.key.localeCompare(b.key));
    if(start>0)for(let i=shuffled.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    const lanes=Array.from({length:laneCount},()=>[]);shuffled.forEach((u,i)=>lanes[i%laneCount].push(u));
    const state=evaluate(lanes,[]);if(state)starts.push(state);
  }
  let frontier=starts.sort(rank).slice(0,beamWidth);const archive=new Map(frontier.map(s=>[s.key,s]));
  for(let step=0;step<searchDepth&&explored<maximumStates;step++){
    const next=new Map(frontier.map(s=>[s.key,s]));
    for(const state of frontier)for(let a=0;a<laneCount;a++)for(let b=a+1;b<laneCount;b++){
      const seen=new Set();
      for(let ai=0;ai<state.lanes[a].length;ai++)for(let bi=0;bi<state.lanes[b].length;bi++){
        const left=state.lanes[a][ai],right=state.lanes[b][bi],pair=`${left.type}|${right.type}`;
        if(left.type===right.type||seen.has(pair)||(mode==='LOCAL'&&left.port!==right.port)||explored>=maximumStates)continue;
        seen.add(pair);const lanes=state.lanes.map(l=>[...l]);[lanes[a][ai],lanes[b][bi]]=[right,left];
        const candidate=evaluate(lanes,[...state.history,{step:step+1,left:left.key,right:right.key,fromLane:a,toLane:b}]);
        if(candidate&&(!next.has(candidate.key)||rank(candidate,next.get(candidate.key))<0))next.set(candidate.key,candidate);
      }
    }
    frontier=[...next.values()].sort(rank).slice(0,beamWidth);
    for(const s of frontier)archive.set(s.key,s);
  }
  return [...archive.values()].sort(rank).slice(0,maximumResults).map((s,index)=>({placements:s.placements,evidence:{
    model:'BACK_WALL_SUPPORT_COMPONENT_BEAM_V1',mode,candidateIndex:index,exploredStates:explored,beamWidth,searchDepth,
    laneWidths:s.widths,laneStartZ:s.zs,cumulativeMoves:s.history,scopeCargoCount:units.reduce((s,u)=>s+u.items.length,0),
    supportComponentCount:units.length,deepEndPrimaryGap:s.rear.deepEndPrimaryGap,cog:s.cog,exactVoid:s.geometry,
    globalTranslationApplied:false,proof:'BOUNDED_SEARCH_NOT_IMPOSSIBILITY_PROOF'}}));
}
function generateWallCandidates(items,container,{beamWidth=12,depth=5}={}) {
  const walls=depthWalls(items);if(walls.length<2)return [];
  let explored=0;
  const evaluate=(order,history)=>{
    explored++;let cursor=0;const placements=[];
    for(const index of order){const w=walls[index];for(const p of w.items)placements.push({...p,x:round(cursor+p.x-w.start)});cursor+=w.end-w.start;}
    const cog=calculateCoG(placements,container),voids=exactVoidMetrics(placements,container);
    return {order,history,placements,key:order.join(','),rank:[Math.max(0,cog.longitudinal-policy.cog.longitudinalLimitPercent)+Math.max(0,cog.lateral-policy.cog.lateralLimitPercent),voids.volumesMm3.irregularInternalVoid,Math.max(cog.longitudinal,cog.lateral)]};
  };
  const compare=(a,b)=>{for(let i=0;i<a.rank.length;i++)if(Math.abs(a.rank[i]-b.rank[i])>1e-7)return a.rank[i]-b.rank[i];return a.key.localeCompare(b.key);};
  let frontier=[evaluate(walls.map((_,i)=>i),[])];const archive=new Map();
  for(let step=0;step<depth;step++){
    const next=new Map(frontier.map(s=>[s.key,s]));
    for(const state of frontier)for(let i=0;i<walls.length-1;i++){
      const a=walls[state.order[i]],b=walls[state.order[i+1]];
      if(a.ports.size!==1||b.ports.size!==1||[...a.ports][0]!==[...b.ports][0])continue;
      const order=[...state.order];[order[i],order[i+1]]=[order[i+1],order[i]];
      const s=evaluate(order,[...state.history,{step:step+1,wallPositions:[i,i+1]}]);if(!next.has(s.key))next.set(s.key,s);
    }
    frontier=[...next.values()].sort(compare).slice(0,beamWidth);for(const s of frontier)archive.set(s.key,s);
  }
  return [...archive.values()].sort(compare).slice(0,4).map(s=>({placements:s.placements,evidence:{model:'CUMULATIVE_SAME_PORT_WALL_PERMUTATION',exploredStates:explored,cumulativeMoves:s.history,globalTranslationApplied:false}}));
}
module.exports={supportComponents,anchoredWalls,generateBackWallCandidates,generateWallCandidates};
