export function groupEquivalentCandidates(candidates=[], existingContainers=[]) {
  const existing=new Set(existingContainers.map(c=>c.containerId));
  const groups=new Map();
  for(const candidate of candidates) {
    const signature=JSON.stringify({
      containers:candidate.task.containers.map(c=>JSON.stringify({
        identity:existing.has(c.containerId)?c.containerId:null,type:c.equipment.typeId,status:c.status,
        locked:[...c.lockedUnitIds].sort(),
        placements:c.plan.loadedCargo.map(p=>[p.cargoId,p.x,p.y,p.z,p.l,p.w,p.h]).sort((a,b)=>a[0].localeCompare(b[0]))
      })).sort(),
      unassigned:candidate.task.unassigned.map(u=>u.unitId).sort(),moved:candidate.summary.movedUnits
    });
    if(!groups.has(signature)) {
      const types=new Map();
      for(const c of candidate.task.containers)types.set(c.equipment.typeId,(types.get(c.equipment.typeId)||0)+1);
      groups.set(signature,{...candidate,actualLabel:[...types].map(([type,count])=>`${count} × ${type}`).join(' + ')||'无可用柜方案',members:[]});
    }
    groups.get(signature).members.push(candidate);
  }
  return [...groups.values()];
}

export function candidateRejections(group) {
  return [...new Map((group?.members||[]).flatMap(c=>c.rejected||[]).map(row=>[
    JSON.stringify([row.containerId,row.typeId,row.unitIds,row.reason]),row
  ])).values()];
}
