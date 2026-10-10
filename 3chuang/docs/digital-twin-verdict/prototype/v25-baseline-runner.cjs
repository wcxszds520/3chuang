'use strict';
const BASE = 'D:/cixing/3chuang/backend';

const templates = require(BASE + '/config/demo-cargo-templates.js');
const V25 = require(BASE + '/services/HybridConstraintPackingSolverV25');
const { calculatePlanMetrics } = require(BASE + '/services/packing/PlanMetrics');

const CONTAINERS = {
  '40HQ': { typeId: '40HQ', name: '40尺高柜', innerLength: 12032, innerWidth: 2352, innerHeight: 2698, maxWeight: 26480 },
  '20GP': { typeId: '20GP', name: '20尺标准柜', innerLength: 5898, innerWidth: 2352, innerHeight: 2393, maxWeight: 28180 },
  '40GP': { typeId: '40GP', name: '40尺标准柜', innerLength: 12032, innerWidth: 2352, innerHeight: 2393, maxWeight: 26730 }
};

// 把模板的 cargoList 展开成逐件（quantity → N 件）
function expand(list) {
  const out = [];
  let i = 0;
  const seens = new Map();
  for (const t of list) {
    const qty = Number(t.quantity || 1);
    for (let k = 0; k < qty; k++) {
      const base = t.skuId || t.name;
      const n = (seens.get(base) || 0) + 1; seens.set(base, n);
      out.push({
        id: `${base}-${n}`, skuId: t.skuId || base, name: t.name,
        length: t.length, width: t.width, height: t.height, weight: t.weight,
        stackable: t.stackable !== false, maxStackLayers: t.maxStackLayers || 1,
        canRotate: t.canRotate !== false, canLayFlat: t.canLayFlat === true,
        canInvert: t.canInvert === true, fragile: t.fragile === true,
        portSequence: t.portSequence ?? 1, eta: t.eta
      });
      i++;
    }
  }
  return out;
}

(async () => {
  const sets = Object.entries(templates).filter(([, v]) => v && v.cargoList);
  for (const [key, set] of sets) {
    for (const ctype of ['40HQ', '20GP']) {
      const cargo = expand(set.cargoList);
      const totalVol = cargo.reduce((s, c) => s + (c.length * c.width * c.height) / 1e9, 0);
      const totalW = cargo.reduce((s, c) => s + c.weight, 0);
      const container = CONTAINERS[ctype];
      const innerVol = (container.innerLength * container.innerWidth * container.innerHeight) / 1e9;
      const t0 = Date.now();
      let res;
      try {
        res = await new V25({ debugMode: false }).generatePackingPlan(cargo, container, { strategy: 'SPACE' });
      } catch (e) {
        console.log(`${key}/${ctype}: 求解异常 ${e.message}`);
        continue;
      }
      const ms = Date.now() - t0;
      const loaded = res.loadedCargo || res.placements || [];
      const unloaded = res.unloadedCargo || res.unplaced || [];
      const nLoaded = loaded.length;
      const loadedVol = loaded.reduce((s, p) => {
        const c = p.cargo || p; return s + ((c.length || c.l || 0) * (c.width || c.w || 0) * (c.height || c.h || 0)) / 1e9;
      }, 0);
      const utilLoaded = loadedVol / innerVol * 100;
      const cog = res.cogOffset || {};
      console.log(`${key.padEnd(16)} ${ctype}  件数 ${cargo.length}  重 ${Math.round(totalW)}kg`);
      console.log(`   货理论体积 ${totalVol.toFixed(2)} m³ / 箱容 ${innerVol.toFixed(2)} m³ → 理论占用 ${(totalVol / innerVol * 100).toFixed(2)}%`);
      console.log(`   装入 ${nLoaded}/${cargo.length} (${(nLoaded / cargo.length * 100).toFixed(1)}%)  实际占用箱容 ${utilLoaded.toFixed(2)}%`);
      console.log(`   报告利用率 ${res.metrics ? (res.metrics.space_utilization ?? res.metrics.spaceUtilization ?? 'n/a') : (res.spaceUtilization ?? 'n/a')}`);
      console.log(`   横向偏移 ${cog.lateral ?? 'n/a'}%  纵向偏移 ${cog.longitudinal ?? 'n/a'}%   耗时 ${ms}ms`);
      console.log('');
    }
  }
})().catch(e => { console.error('脚本异常:', e); process.exit(1); });
