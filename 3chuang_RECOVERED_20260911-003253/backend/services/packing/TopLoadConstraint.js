'use strict';
// Prospective explicit top-load check. Final PlanValidator independently
// repeats the complete mechanics; this keeps the constructive search useful.
function explicitTopLoadsPass(placements,tolerance=0.001){
  const total=placements.reduce((s,p)=>s+Number(p.weight||0),0);
  if(!placements.some(p=>{const v=p.maximumSupportedWeightKg??p.maxSupportedWeight;return v!=null&&Number(v)<total;}))return true;
  const loads=new Map();
  for(const p of [...placements].sort((a,b)=>b.y-a.y)){
    const carried=loads.get(p)||0,cap=p.maximumSupportedWeightKg??p.maxSupportedWeight;
    if(cap!=null&&carried>Number(cap)+0.001)return false;
    if(p.y<=tolerance)continue;
    const links=placements.flatMap(q=>{
      if(q===p||Math.abs(q.y+q.h-p.y)>tolerance)return [];
      const area=Math.max(0,Math.min(q.x+q.l,p.x+p.l)-Math.max(q.x,p.x))*Math.max(0,Math.min(q.z+q.w,p.z+p.w)-Math.max(q.z,p.z));
      return area>0?[{q,area}]:[];
    });
    const area=links.reduce((s,l)=>s+l.area,0);
    for(const l of links)loads.set(l.q,(loads.get(l.q)||0)+(Number(p.weight||0)+carried)*l.area/area);
  }
  return true;
}
module.exports={explicitTopLoadsPass};
