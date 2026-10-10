// Read-only geometry evidence. Never moves a placement or grants shipping approval.
export function placementSpaceEvidence(plan) {
  const cargo = plan.loadedCargo || plan.placements || [];
  const box = plan.containerInfo || plan.container || {};
  const L = Number(box.innerLength), W = Number(box.innerWidth), H = Number(box.innerHeight);
  if (!cargo.length || ![L,W,H].every(v => v > 0)) return { zones: [] };
  const zones = [];
  const minX = Math.min(...cargo.map(c => Number(c.x)));
  const mass = cargo.reduce((s,c) => s + Number(c.weight || 0),0);
  const cog = mass ? cargo.reduce((s,c) => s + (Number(c.x)+Number(c.l)/2)*Number(c.weight || 0),0)/mass : null;
  const offset = x => Math.abs(x-L/2)/(L/2)*100;
  const shifts = cargo.map(c => Number(c.algorithmMeta?.globalCompactionShiftX || 0)+Number(c.algorithmMeta?.v24GlobalBalanceShiftX || 0)+Number(c.algorithmMeta?.endGapCompactionShiftX || 0));
  const compact = plan.constraintMeta?.endGapCompaction;
  const wallRepair = plan.constraintMeta?.wallOrderRepair;
  if (minX >= 100) {
    const reordered = wallRepair?.accepted === true && Math.abs(Number(wallRepair.gapMm)-minX)<1;
    const traced = !reordered && shifts.every(s => Math.abs(s-minX)<1) && cog !== null && offset(cog-minX)>offset(cog);
    zones.push({ id:'SPACE-DEEP-END', classification:reordered ? 'BOUNDED_WALL_REORDER' : traced ? 'BALANCE_TRANSLATION' : 'UNRESOLVED_END_GAP',
      label:reordered ? '重排后剩余空区 · 待优化' : traced ? '载荷平衡调整区' : '深端空隙 · 待复核',
      boundsMm:{minX:0,maxX:minX,minY:0,maxY:H,minZ:0,maxZ:W},
      volumeM3:minX*W*H/1e9, gapMm:minX,
      reason:reordered ? `本版重新排列 ${wallRepair.movedWallCount} 道同港货墙，保留各墙内部的堆叠关系，并重新检查重量、支撑、港序和插入路径。后壁净距从 ${Number(wallRepair.previousGapMm).toFixed(1)} mm 减少到 ${minX.toFixed(1)} mm，容积利用率不变。当前纵向偏移 ${offset(cog).toFixed(3)}%；保持本版相对位置整体贴后壁将为 ${offset(cog-minX).toFixed(3)}%。这次有限范围重排仍未消除空区，不代表其他装载布局不可行。` : traced ? `${compact ? `本版已从 ${compact.previousDeepGapMm} mm 压实到 ${minX} mm。` : `当前布局因载荷平衡整体向门端移动 ${minX} mm。`}纵向偏移 ${offset(cog).toFixed(3)}%；保持相对位置整体贴深端将为 ${offset(cog-minX).toFixed(3)}%。${compact ? `余隙是本布局维持 ${compact.guidanceLimitPercent}% 指导上限所需的最小平移；总容积利用率不变。` : '这是当前布局的策略取舍。'}不是法规通道，也不证明所有重排方案均不可行。` : '当前方案坐标中存在该空隙，尚无足够约束证据证明必须保留。',
      currentOffsetPercent:cog === null ? null : offset(cog), flushOffsetPercent:cog === null ? null : offset(cog-minX),
      source:'active plan placements + algorithmMeta + mass-weighted centre of gravity' });
  }
  for (const c of cargo.filter(c => c.stackable === false)) {
    const b={minX:Number(c.x),maxX:Number(c.x)+Number(c.l),minY:Number(c.y)+Number(c.h),maxY:H,minZ:Number(c.z),maxZ:Number(c.z)+Number(c.w)};
    // Only show an exact, empty prism: a broad connected-region AABB is not empty space.
    if (b.maxY-b.minY<100 || cargo.some(o => o !== c && Number(o.x)<b.maxX && Number(o.x)+Number(o.l)>b.minX && Number(o.z)<b.maxZ && Number(o.z)+Number(o.w)>b.minZ && Number(o.y)<b.maxY && Number(o.y)+Number(o.h)>b.minY+.01)) continue;
    zones.push({id:`SPACE-NOSTACK-${c.cargoId}`, classification:'NON_STACKABLE_HEADSPACE',label:'不可堆叠 · 禁止上压',boundsMm:b,
      volumeM3:(b.maxX-b.minX)*(b.maxY-b.minY)*(b.maxZ-b.minZ)/1e9, linkedCargoIds:[c.cargoId],
      reason:`${c.name || c.cargoId} 明确设置为不可堆叠，顶部不能作为上层货物支撑面；不能仅凭外形能放入就标记为可回填。独立承载结构未提供，不假设其存在。`,source:'formal cargo.stackable=false; exact empty bounds'});
  }
  return {zones, plannedCount:cargo.length, volumeUtilizationPercent:cargo.reduce((s,c)=>s+Number(c.l)*Number(c.w)*Number(c.h),0)/(L*W*H)*100,
    note:'全量货物已规划不等于箱容100%填满；这里解释已证实的空间成因，其余余隙仍需单独复核。'};
}
