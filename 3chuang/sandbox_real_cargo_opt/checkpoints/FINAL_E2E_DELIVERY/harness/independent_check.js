'use strict';
/**
 * independent_check.js — 独立物理可行性检查器（零容忍）
 *
 * 不信任引擎自报指标，直接从 loadedCargo 布局重新推导：
 *  1. BOUNDS        越界
 *  2. OVERLAP       两两 AABB 重叠（体积 > 1mm^3 视为干涉）
 *  3. SUPPORT       支撑率 < packingPolicy.supportRatioMin
 *  4. FRAGILE_TOP   易碎品承载
 *  5. NONSTACK_TOP  不可堆叠品承载
 *  6. MAX_STACK     超过 maxStackLayers
 *  7. HEAVY_ON_LIGHT 重压轻（倍率阈值）
 *  8. PAYLOAD       超过集装箱 maxWeight
 *  9. ROTATION      姿态限制违反（canRotate/canLayFlat）
 * 10. LIFO          港序/后进先出批次区间违规
 */

const packingPolicy = require('../backend/config/packingPolicy');

const TOL = packingPolicy.collisionToleranceMm; // 0.5mm
const CONTACT = packingPolicy.contactToleranceMm; // 2mm

function overlapVolume(a, b) {
  const dx = Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const dz = Math.min(a.z + a.w, b.z + b.w) - Math.max(a.z, b.z);
  return (dx > 0 && dy > 0 && dz > 0) ? dx * dy * dz : 0;
}

function overlapLen(a0, a1, b0, b1) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

function rectUnionArea(rects) {
  if (!rects.length) return 0;
  const xs = [...new Set(rects.flatMap(r => [r.x0, r.x1]))].sort((a, b) => a - b);
  const zs = [...new Set(rects.flatMap(r => [r.z0, r.z1]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cz = (zs[j] + zs[j + 1]) / 2;
      if (rects.some(r => cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1)) {
        area += (xs[i + 1] - xs[i]) * (zs[j + 1] - zs[j]);
      }
    }
  }
  return area;
}

/**
 * @returns {{violations: Array<{code:string,cargoId?:string,message:string}>, stats: Object}}
 */
function checkPhysical(placements, container) {
  const violations = [];
  const n = placements.length;

  // 1. BOUNDS
  for (const it of placements) {
    if (it.x < -TOL || it.y < -TOL || it.z < -TOL ||
        it.x + it.l > container.innerLength + TOL ||
        it.y + it.h > container.innerHeight + TOL ||
        it.z + it.w > container.innerWidth + TOL) {
      violations.push({ code: 'BOUNDS', cargoId: it.cargoId, message: `item out of container bounds` });
    }
  }

  // 2. OVERLAP (O(n^2) fine for <=1000 items)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = overlapVolume(placements[i], placements[j]);
      if (v > 1) { // > 1 mm^3
        violations.push({
          code: 'OVERLAP', cargoId: placements[i].cargoId,
          message: `intersects ${placements[j].cargoId} volume=${v.toFixed(1)}mm3`
        });
      }
    }
  }

  // 3-7. support graph rules
  const supportLoads = new Map();
  const levels = new Map();
  const layersThrough = new Map(); // [MUTATION iter3b] 传递层高（与 PlanValidator 同语义）
  const restingOn = new Map(); // cargoId -> 支撑它的上层货物列表
  const sorted = [...placements].sort((a, b) => a.y - b.y);
  for (const it of sorted) {
    const bottom = it.y;
    const supporters = [];
    if (bottom > CONTACT) {
      for (const low of placements) {
        if (low === it) continue;
        if (Math.abs(low.y + low.h - bottom) > CONTACT) continue;
        const ox = overlapLen(it.x, it.x + it.l, low.x, low.x + low.l);
        const oz = overlapLen(it.z, it.z + it.w, low.z, low.z + low.w);
        if (ox > 0 && oz > 0) supporters.push({ low, area: ox * oz });
      }
      const supportedArea = rectUnionArea(supporters.map(s => ({
        x0: Math.max(s.low.x, it.x), x1: Math.min(s.low.x + s.low.l, it.x + it.l),
        z0: Math.max(s.low.z, it.z), z1: Math.min(s.low.z + s.low.w, it.z + it.w)
      })));
      const bottomArea = it.l * it.w;
      const ratio = bottomArea > 0 ? supportedArea / bottomArea : 0;
      if (ratio + 1e-9 < packingPolicy.supportRatioMin) {
        violations.push({ code: 'SUPPORT', cargoId: it.cargoId, message: `support ratio ${(ratio * 100).toFixed(1)}% < ${(packingPolicy.supportRatioMin * 100).toFixed(0)}%` });
      }

      let level = 1;
      const totalSupportArea = supporters.reduce((s, x) => s + x.area, 0) || 1;
      for (const { low, area } of supporters) {
        if (low.fragile === true) violations.push({ code: 'FRAGILE_TOP', cargoId: it.cargoId, message: `rests on fragile ${low.cargoId}` });
        if (low.stackable === false) violations.push({ code: 'NONSTACK_TOP', cargoId: it.cargoId, message: `rests on non-stackable ${low.cargoId}` });
        const lowLevel = levels.get(low.cargoId) || 1;
        level = Math.max(level, lowLevel + 1);
        if (!restingOn.has(low.cargoId)) restingOn.set(low.cargoId, []);
        restingOn.get(low.cargoId).push(it);
        const upperWeight = Number(it.weight || 0);
        const lowerWeight = Number(low.weight || 0);
        const reinforced = low.wooden === true || /wood|pallet|reinforced/i.test(String(low.packagingType || ''));
        if (!reinforced && lowerWeight > 0 && upperWeight > lowerWeight * packingPolicy.heavyOnLightRatio + 1e-9) {
          violations.push({ code: 'HEAVY_ON_LIGHT', cargoId: it.cargoId, message: `${upperWeight}kg on ${lowerWeight}kg (${low.cargoId})` });
        }
        const share = upperWeight * (area / totalSupportArea);
        supportLoads.set(low.cargoId, (supportLoads.get(low.cargoId) || 0) + share);
      }
      levels.set(it.cargoId, level);
    } else {
      levels.set(it.cargoId, 1);
    }
  }
  // 传递层高：自顶向下 layersThrough(item) = 1 + max(layersThrough(上方))
  const topDown = [...placements].sort((a, b) => b.y - a.y);
  for (const it of topDown) {
    const above = restingOn.get(it.cargoId) || [];
    const maxAbove = above.reduce((m, a) => Math.max(m, layersThrough.get(a.cargoId) || 1), 0);
    const layers = 1 + maxAbove;
    layersThrough.set(it.cargoId, layers);
    const maxLayers = Math.max(1, Number(it.maxStackLayers || it.maxStack || 1));
    if (layers > maxLayers && above.length > 0) {
      violations.push({ code: 'MAX_STACK', cargoId: it.cargoId, message: `carried stack layers ${layers} > maxStackLayers ${maxLayers}` });
    }
  }
  // support load capacity: cumulative transferred load <= lower weight * multiplier
  for (const it of placements) {
    const carried = supportLoads.get(it.cargoId) || 0;
    if (carried <= 0) continue;
    const capacity = Math.max(Number(it.weight || 0), 1) * packingPolicy.supportLoadMultiplier;
    if (carried > capacity + 1e-6) {
      violations.push({ code: 'SUPPORT_LOAD', cargoId: it.cargoId, message: `carried load ${carried.toFixed(1)}kg > capacity ${capacity.toFixed(1)}kg` });
    }
  }

  // 8. PAYLOAD
  const totalWeight = placements.reduce((s, it) => s + Number(it.weight || 0), 0);
  if (container.maxWeight > 0 && totalWeight > container.maxWeight + 0.0001) {
    violations.push({ code: 'PAYLOAD', message: `total weight ${totalWeight.toFixed(1)} > maxWeight ${container.maxWeight}` });
  }

  return { violations, stats: { totalWeight } };
}

/**
 * 姿态约束检查：需要 cargoList 原始尺寸对照。
 * 项目引擎（FastBlock/Realistic4D）一致的语义：
 *   canRotate   → 允许绕垂直轴换向（l/w 互换，h 不变）
 *   canLayFlat  → 允许侧翻（w/h 互换，即高度轴改变）
 * 二者相互独立：canRotate=false + canLayFlat=true 仍允许侧翻后的 XYZ/XZY。
 * 违规判定：
 *   canLayFlat≠true 且 h≠H            → ROTATION（侧翻未授权）
 *   canRotate=false 且 {l,w}≠{L,W} 序  → ROTATION（换向未授权）
 */
function checkOrientation(placements, cargoList) {
  const violations = [];
  const byUnit = new Map();
  for (const c of cargoList) {
    const baseId = String(c.cargoId || c.id || c.name || '');
    if (Array.isArray(c.unitIds)) {
      c.unitIds.forEach((uid) => byUnit.set(String(uid), { cargo: c }));
    }
    byUnit.set(baseId, { cargo: c });
  }
  for (const it of placements) {
    const key = String(it.unitId || it.cargoId || '');
    let entry = byUnit.get(key);
    if (!entry && it.sourceCargoId) entry = byUnit.get(String(it.sourceCargoId));
    if (!entry) {
      for (const [, v] of byUnit) {
        const c = v.cargo;
        if ((it.sku && c.sku === it.sku) || String(c.cargoId || '') === String(it.sourceCargoId || '')) { entry = v; break; }
      }
    }
    if (!entry) continue;
    const c = entry.cargo;
    const L = Number(c.length), W = Number(c.width), H = Number(c.height);
    const dims = [it.l, it.w, it.h].sort((a, b) => b - a);
    const orig = [L, W, H].sort((a, b) => b - a);
    // 维度集合必须一致（任何姿态都不改变三维大小）
    if (Math.abs(dims[0] - orig[0]) > 1 || Math.abs(dims[1] - orig[1]) > 1 || Math.abs(dims[2] - orig[2]) > 1) {
      violations.push({ code: 'DIM_MISMATCH', cargoId: it.cargoId, message: `placed dims ${dims} != cargo dims ${orig}` });
      continue;
    }
    if (c.canLayFlat !== true && Math.abs(it.h - H) > 1) {
      violations.push({ code: 'ROTATION', cargoId: it.cargoId, message: `canLayFlat=false but height axis changed (${it.h} vs ${H})` });
    }
    if (c.canRotate === false && !(Math.abs(it.l - L) <= 1 && Math.abs(it.w - W) <= 1)) {
      // 注意：若 canLayFlat=true 允许 (l,w,h)=(L,H,W)——l 保持 L，w/h 互换，不视为换向
      const isPureRoll = Math.abs(it.l - L) <= 1 && Math.abs(it.h - W) <= 1 && Math.abs(it.w - H) <= 1;
      if (!isPureRoll) {
        violations.push({ code: 'ROTATION', cargoId: it.cargoId, message: `canRotate=false but yaw orientation changed` });
      }
    }
  }
  return violations;
}

/**
 * LIFO/港序批次区间检查（与项目门禁同规则）：
 * portSequence 小的批次必须整体位于 portSequence 大的批次更深处（x 更小）。
 */
function checkLifo(placements) {
  const violations = [];
  const batches = new Map();
  for (const it of placements) {
    const seq = Number(it.portSequence || 1);
    if (!batches.has(seq)) batches.set(seq, { minX: Infinity, maxX: -Infinity });
    const b = batches.get(seq);
    b.minX = Math.min(b.minX, it.x);
    b.maxX = Math.max(b.maxX, it.x + it.l);
  }
  const seqs = [...batches.keys()].sort((a, b) => a - b);
  for (let i = 0; i < seqs.length; i++) {
    for (let j = i + 1; j < seqs.length; j++) {
      if (batches.get(seqs[i]).minX + 1 < batches.get(seqs[j]).maxX) {
        violations.push({ code: 'LIFO', message: `port ${seqs[j]} (earlier unload) extends into port ${seqs[i]} zone` });
      }
    }
  }
  return violations;
}

module.exports = { checkPhysical, checkOrientation, checkLifo, overlapVolume };
