'use strict';

// Coordinates: inner rear floor corner (0,0,0); X length, Y height, Z width.
// Placements are minimum corners. All partitions use actual cargo faces, never voxels.
const EPS = 1e-6;
const unique = values => [...new Set(values)].sort((a,b)=>a-b);
const volume = b => b.l*b.w*b.h;
function rearWallMetrics(items, container, rear = 0) {
  const floor = items.filter(p=>Math.abs(p.y)<=0.001);
  const edges = unique(floor.flatMap(p=>[p.z,p.z+p.w]));
  const lanes=[];
  for(let i=0;i<edges.length-1;i++) {
    const z0=edges[i],z1=edges[i+1];
    const present=floor.filter(p=>p.z<z1-EPS && p.z+p.w>z0+EPS);
    if(!present.length) continue;
    const x=Math.min(...present.map(p=>p.x));
    const ids=present.filter(p=>Math.abs(p.x-x)<EPS).map(p=>p.cargoId).sort();
    const previous=lanes[lanes.length-1];
    if(previous && Math.abs(previous.offsetMm-(x-rear))<EPS && JSON.stringify(previous.cargoIds)===JSON.stringify(ids)) previous.toZMm=z1;
    else lanes.push({fromZMm:z0,toZMm:z1,offsetMm:x-rear,cargoIds:ids});
  }
  const occupiedWidth=lanes.reduce((sum,l)=>sum+l.toZMm-l.fromZMm,0);
  const sorted=[...lanes].sort((a,b)=>a.offsetMm-b.offsetMm);
  const quantile=q=>{let width=0;for(const l of sorted){width+=l.toZMm-l.fromZMm;if(width+EPS>=occupiedWidth*q)return l.offsetMm;}return null;};
  const contact=items.filter(p=>Math.abs(p.x-rear)<=EPS);
  const area=rectangleUnion(contact.map(p=>({a0:p.z,a1:p.z+p.w,b0:p.y,b1:p.y+p.h})));
  return {model:'WIDTH_WEIGHTED_FLOOR_LANE_P90_V1',effectiveRearWallMm:rear,
    deepEndPrimaryGap:quantile(.9), minimum:sorted[0]?.offsetMm??null,
    mean:occupiedWidth?lanes.reduce((s,l)=>s+l.offsetMm*(l.toZMm-l.fromZMm),0)/occupiedWidth:null,
    maximum:sorted.at(-1)?.offsetMm??null,p90:quantile(.9),p95:quantile(.95),
    occupiedWidthMm:occupiedWidth,unoccupiedWidthMm:container.innerWidth-occupiedWidth,
    rearLaneStartOffsets:lanes,rearWallContactCoverage:area/(container.innerWidth*container.innerHeight),
    floorWidthContactCoverage:occupiedWidth?lanes.filter(l=>l.offsetMm<=EPS).reduce((s,l)=>s+l.toZMm-l.fromZMm,0)/occupiedWidth:0};
}
function rectangleUnion(rects) {
  const edges=unique(rects.flatMap(r=>[r.a0,r.a1]));let area=0;
  for(let i=0;i<edges.length-1;i++) area+=(edges[i+1]-edges[i])*intervalUnion(rects.filter(r=>r.a0<edges[i+1]-EPS&&r.a1>edges[i]+EPS).map(r=>[r.b0,r.b1])).reduce((s,[a,b])=>s+b-a,0);
  return area;
}
function intervalUnion(intervals) {
  const result=[];
  for(const [a,b] of intervals.sort((a,b)=>a[0]-b[0])){const prev=result.at(-1);if(prev&&a<=prev[1]+EPS)prev[1]=Math.max(prev[1],b);else result.push([a,b]);}
  return result;
}
function exactVoidMetrics(items, c) {
  const totals={deepEndContinuousGap:0,doorEndUsableGap:0,nonStackableTopVoid:0,irregularInternalVoid:0,ordinaryOverhead:0,lateralPerimeterClearance:0,requiredHandlingSecuringClearance:0};
  const boxes=[];let internalNonStack=0;
  const add=(type,x,y,z,l,h,w)=>{if(l>EPS&&h>EPS&&w>EPS){const b={type,x,y,z,l,h,w};totals[type]+=volume(b);boxes.push(b);}};
  if(!items.length){add('doorEndUsableGap',0,0,0,c.innerLength,c.innerHeight,c.innerWidth);return {method:'EXACT_FACE_PARTITION_V1',volumesMm3:totals,boxes,internalVoidMm3:0,totalVoidMm3:c.innerLength*c.innerWidth*c.innerHeight};}
  const minX=Math.min(...items.map(p=>p.x)),maxX=Math.max(...items.map(p=>p.x+p.l));
  add('deepEndContinuousGap',0,0,0,minX,c.innerHeight,c.innerWidth);
  add('doorEndUsableGap',maxX,0,0,c.innerLength-maxX,c.innerHeight,c.innerWidth);
  const xs=unique(items.flatMap(p=>[p.x,p.x+p.l]));
  for(let i=0;i<xs.length-1;i++) {
    const x=xs[i],l=xs[i+1]-x,active=items.filter(p=>p.x<xs[i+1]-EPS&&p.x+p.l>x+EPS);
    if(!active.length){add('irregularInternalVoid',x,0,0,l,c.innerHeight,c.innerWidth);continue;}
    const height=Math.max(...active.map(p=>p.y+p.h));
    const minZ=Math.min(...active.map(p=>p.z)),maxZ=Math.max(...active.map(p=>p.z+p.w));
    const zs=unique([0,c.innerWidth,...active.flatMap(p=>[p.z,p.z+p.w])]);
    for(let j=0;j<zs.length-1;j++){
      const z=zs[j],w=zs[j+1]-z,at=active.filter(p=>p.z<zs[j+1]-EPS&&p.z+p.w>z+EPS);
      if(z<minZ-EPS||z>=maxZ-EPS){add('lateralPerimeterClearance',x,0,z,l,c.innerHeight,w);continue;}
      const intervals=intervalUnion(at.map(p=>[p.y,p.y+p.h]));let cursor=0;
      for(const [a,b] of intervals){add('irregularInternalVoid',x,cursor,z,l,a-cursor,w);cursor=b;}
      const top=at.filter(p=>Math.abs(p.y+p.h-cursor)<EPS);
      if(top.some(p=>p.stackable===false||p.fragile===true)){
        add('nonStackableTopVoid',x,cursor,z,l,c.innerHeight-cursor,w);
        internalNonStack+=l*w*Math.max(0,height-cursor);
      }else{
        add('irregularInternalVoid',x,cursor,z,l,height-cursor,w);
        add('ordinaryOverhead',x,height,z,l,c.innerHeight-height,w);
      }
    }
  }
  const totalVoid=Object.values(totals).reduce((s,v)=>s+v,0);
  const expected=c.innerLength*c.innerWidth*c.innerHeight-items.reduce((s,p)=>s+volume(p),0);
  return {method:'EXACT_FACE_PARTITION_V1',volumesMm3:totals,totalVoidMm3:totalVoid,
    internalVoidMm3:totals.irregularInternalVoid+internalNonStack,internalNonStackableMm3:internalNonStack,
    conservationErrorMm3:totalVoid-expected,handlingSecuringClearanceStatus:'NO_EXPLICIT_CLEARANCE_GEOMETRY_PROVIDED',
    deepEndClearanceMm:minX,doorEndClearanceMm:c.innerLength-maxX,
    majorVoidBoundingBoxes:boxes.sort((a,b)=>volume(b)-volume(a)).slice(0,16)};
}
module.exports={rearWallMetrics,exactVoidMetrics,rectangleUnion};
