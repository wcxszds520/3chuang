'use strict';
const BASE = 'D:/cixing/3chuang/backend';
const templates = require(BASE + '/config/demo-cargo-templates.js');
const V25 = require(BASE + '/services/HybridConstraintPackingSolverV25');

function expand(list) {
  const out = []; const seens = new Map();
  for (const t of list) {
    const qty = Number(t.quantity || 1);
    for (let k = 0; k < qty; k++) {
      const base = t.skuId || t.name;
      const n = (seens.get(base) || 0) + 1; seens.set(base, n);
      out.push({ id: `${base}-${n}`, skuId: t.skuId || base, name: t.name,
        length: t.length, width: t.width, height: t.height, weight: t.weight,
        stackable: t.stackable !== false, maxStackLayers: t.maxStackLayers || 1,
        canRotate: t.canRotate !== false, canLayFlat: t.canLayFlat === true,
        canInvert: t.canInvert === true, fragile: t.fragile === true, portSequence: t.portSequence ?? 1 });
    }
  }
  return out;
}

const C = { typeId: '20GP', name: '20GP', innerLength: 5898, innerWidth: 2352, innerHeight: 2393, maxWeight: 28180 };
const C40 = { typeId: '40HQ', name: '40HQ', innerLength: 12032, innerWidth: 2352, innerHeight: 2698, maxWeight: 26480 };

(async () => {
  for (const [key, ctype] of [['smallBatch', C], ['mixedCargo', C], ['mixedCargo', C40]]) {
    const container = ctype;
    const cargo = expand(templates[key].cargoList);
    const res = await new V25({ debugMode: false }).generatePackingPlan(cargo, container, { strategy: 'SPACE' });
    const pl = res.loadedCargo || res.placements || [];
    let sw = 0, sx = 0, sz = 0;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    pl.forEach(p => {
      const c = p.cargo || p;
      const x = Number(p.x ?? c.x ?? 0), z = Number(p.z ?? c.z ?? 0);
      const l = Number(p.l ?? c.l ?? p.length ?? c.length ?? 0);
      const w = Number(p.w ?? c.w ?? p.width ?? c.width ?? 0);
      const wt = Number(c.weight ?? p.weight ?? 0) || 1;
      const cx = x + l / 2, cz = z + w / 2;
      sw += wt; sx += cx * wt; sz += cz * wt;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x + l);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z + w);
    });
    const cogX = sx / sw, cogZ = sz / sw;
    const offX = cogX - container.innerLength / 2;
    const offZ = cogZ - container.innerWidth / 2;
    const rep = res.cogOffset || {};
    console.log(`\n===== ${key} / ${container.typeId} =====`);
    console.log(`  装载件数        : ${pl.length}`);
    console.log(`  货物 x 范围     : ${minX.toFixed(0)} → ${maxX.toFixed(0)} mm   (箱长 ${container.innerLength})`);
    console.log(`  货物 z 范围     : ${minZ.toFixed(0)} → ${maxZ.toFixed(0)} mm   (箱宽 ${container.innerWidth})`);
    console.log(`  我独立算的 CoG  : x=${cogX.toFixed(1)}  z=${cogZ.toFixed(1)} mm`);
    console.log(`  我的偏移        : 横向 ${(Math.abs(offZ) / container.innerWidth * 100).toFixed(6)}%   纵向 ${(Math.abs(offX) / container.innerLength * 100).toFixed(6)}%`);
    console.log(`  系统报告 cogOffset: 横向 ${rep.lateral}%   纵向 ${rep.longitudinal}%`);
    console.log(`  一致？          : 横向 ${Math.abs((Math.abs(offZ) / container.innerWidth * 100) - Number(rep.lateral)) < 0.01 ? 'YES' : 'NO ← 不一致'}   纵向 ${Math.abs((Math.abs(offX) / container.innerLength * 100) - Number(rep.longitudinal)) < 0.01 ? 'YES' : 'NO ← 不一致'}`);
    if (res.cog) console.log(`  系统 cog 坐标   : x=${Number(res.cog.x).toFixed(1)} y=${Number(res.cog.y).toFixed(1)} z=${Number(res.cog.z).toFixed(1)}`);
  }
})().catch(e => { console.error('异常:', e); process.exit(1); });
