'use strict';
const EPS=.01;
const hit=(a,da,b,db)=>Math.min(a+da,b+db)-Math.max(a,b)>EPS;
const rank=p=>Number(p.unloadSequence||p.portSequence||1);
const cluster=p=>JSON.stringify([p.customerId||'',p.sku,p.lotId||'',p.unloadGroup||rank(p)]);
function blocks(target,other){return other.x>=target.x+target.l-EPS&&hit(target.y,target.h,other.y,other.h)&&hit(target.z,target.w,other.z,other.w);}
function supports(lower,upper){return Math.abs(lower.y+lower.h-upper.y)<EPS&&hit(lower.x,lower.l,upper.x,upper.l)&&hit(lower.z,lower.w,upper.z,upper.w);}
function pairAllowed(a,b,lifo=true){return !lifo||!((rank(a)<rank(b)&&(blocks(a,b)||supports(a,b)))||(rank(b)<rank(a)&&(blocks(b,a)||supports(b,a))));}
function auditCommerce(placements,cargoList,context={}){
 const violations=[],remaining=[...placements],events=[];const planTime=Date.parse(context.planAt);
 for(const p of placements){
  if(!p.arrivedAt)violations.push({code:'ARRIVAL_UNKNOWN',cargoIds:[p.cargoId]});
  if(p.arrivedAt&&(!Number.isFinite(Date.parse(p.arrivedAt))||Date.parse(p.arrivedAt)>planTime))violations.push({code:'NOT_ARRIVED',cargoIds:[p.cargoId]});
  const door=context.door||{};
  if((door.widthMm&&p.w>door.widthMm)||(door.heightMm&&p.h>door.heightMm))violations.push({code:'DOOR_APERTURE',cargoIds:[p.cargoId]});
 }
 for(let i=0;i<placements.length;i++)for(let j=i+1;j<placements.length;j++)if(!pairAllowed(placements[i],placements[j],context.lifo!==false))violations.push({code:'LIFO_BLOCKED',cargoIds:[placements[i].cargoId,placements[j].cargoId]});
 const ranks=context.lifo===false?[null]:[...new Set(placements.map(rank))].sort((a,b)=>a-b);
 for(const group of ranks){
  let pending=remaining.filter(p=>group===null||rank(p)===group);
  while(pending.length){
   const next=pending.filter(p=>!remaining.some(o=>o!==p&&(blocks(p,o)||supports(p,o)))).sort((a,b)=>b.y-a.y||b.x-a.x||a.cargoId.localeCompare(b.cargoId))[0];
   if(!next){violations.push({code:'UNLOAD_SEQUENCE_BLOCKED',cargoIds:pending.map(p=>p.cargoId)});break;}
   events.push({step:events.length+1,cargoId:next.cargoId,sourceCargoId:next.sourceCargoId,unloadGroup:next.unloadGroup,unloadSequence:rank(next),customerId:next.customerId,sku:next.sku});
   remaining.splice(remaining.indexOf(next),1);pending=pending.filter(p=>p!==next);
  }
 }
 const groups=new Map();for(const p of placements){const k=cluster(p);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
 const clusters=[...groups].map(([key,items])=>{
  let components=0;const unseen=new Set(items);
  const touching=(a,b)=>{const gap=(x,d,y,e)=>Math.max(0,Math.max(x,y)-Math.min(x+d,y+e));return Math.hypot(gap(a.x,a.l,b.x,b.l),gap(a.y,a.h,b.y,b.h),gap(a.z,a.w,b.z,b.w))<=25;};
  while(unseen.size){components++;const queue=[unseen.values().next().value];unseen.delete(queue[0]);while(queue.length){const p=queue.pop();for(const q of unseen)if(touching(p,q)){unseen.delete(q);queue.push(q);}}}
  return {key,sku:items[0].sku,customerId:items[0].customerId,count:items.length,components};
 });
 for(const lock of context.lockedPlacements||[]){const p=placements.find(p=>p.cargoId===lock.cargoId);if(!p||['x','y','z','l','w','h'].some(k=>Math.abs(p[k]-lock[k])>EPS)||['orientationId','canonicalOrientation','uprightOriginalAxis'].some(k=>lock[k]!=null&&p[k]!==lock[k]))violations.push({code:'LOCKED_CARGO_MOVED',cargoIds:[lock.cargoId]});}
 return {version:'commerce-v4',valid:!violations.length,violations,lifoPass:!violations.some(v=>/LIFO|UNLOAD/.test(v.code)),arrivalUnknownCount:placements.filter(p=>!p.arrivedAt).length,arrivalPass:!violations.some(v=>v.code==='NOT_ARRIVED'||v.code==='ARRIVAL_UNKNOWN'),lockedPass:!violations.some(v=>v.code==='LOCKED_CARGO_MOVED'),unloadEvents:events,clusters,extraClusterCount:clusters.reduce((s,c)=>s+c.components-1,0),rehandledCount:0,operationModel:'STRAIGHT_DOOR_EXTRACTION_WITH_SUPPORT_DEPENDENCIES',equipmentPathVerified:false};
}
module.exports={auditCommerce,pairAllowed,cluster,blocks,supports};
