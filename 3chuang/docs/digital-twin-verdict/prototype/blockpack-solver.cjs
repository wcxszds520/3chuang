'use strict';
/* PORTCUBE 算法原型 v3：Maximal Spaces + 全尺寸候选回退 + 多起点重启
 * 修正 v2 两个问题：
 *   (1) 候选块只有大块，无法回退到单件 → 加入 cnt=1 与全尺寸梯度
 *   (2) guillotine 三向分割浪费空间 → 改用 Maximal Spaces（六向切分 + 支配剪枝）
 */
const BASE = 'D:/cixing/3chuang/backend';

function groupSku(list) {
  return list.map(t => ({
    sku: t.skuId || t.name, name: t.name,
    l: Number(t.length), w: Number(t.width), h: Number(t.height),
    weight: Number(t.weight) || 0,
    maxLayers: t.stackable === false ? 1 : (Number(t.maxStackLayers) || 1),
    canRotate: t.canRotate !== false,
    portSequence: Number(t.portSequence) || 1,
    qty: Number(t.quantity) || 1
  }));
}

// 候选块：保证梯度覆盖（大块优先，但必须有越来越小的回退）
function buildCandidates(groups, container, opt = {}) {
  const cap = opt.maxItemsPerBlock || 64;
  const out = [];
  for (const g of groups) {
    const all = [];
    const orients = g.canRotate ? [[g.l, g.w], [g.w, g.l]] : [[g.l, g.w]];
    for (let oi = 0; oi < orients.length; oi++) {
      const [L, W] = orients[oi];
      for (let nz = 1; nz <= Math.min(g.maxLayers, cap); nz++) {
        for (let nx = 1; nx <= 12; nx++) {
          for (let ny = 1; ny <= 12; ny++) {
            const cnt = nx * ny * nz;
            if (cnt > cap || cnt > g.qty) continue;
            const bL = nx * L, bW = ny * W, bH = nz * g.h;
            if (bL > container.innerLength || bW > container.innerWidth || bH > container.innerHeight) continue;
            all.push({ oi, nx, ny, nz, cnt, bL, bW, bH, vol: bL * bW * bH });
          }
        }
      }
    }
    // 按"件数降序"保留大块，同时强制保留小尺寸梯度（cnt 1,2,3,4,6,8,12,16,24,32）
    all.sort((a, b) => b.cnt - a.cnt || b.vol - a.vol);
    const picked = []; const seen = new Set();
    const push = (c) => { const k = `${c.bL}x${c.bW}x${c.bH}`; if (!seen.has(k)) { seen.add(k); picked.push(c); } };
    let big = 0;
    for (const c of all) { if (big >= 6) break; push(c); big++; }
    const targets = [1, 2, 4, 8, 16, 32];
    for (const t of targets) {
      const c = all.find(x => x.cnt <= t && x.cnt >= Math.max(1, t / 2) && !seen.has(`${x.bL}x${x.bW}x${x.bH}`));
      if (c) push(c);
    }
    const single = all.find(x => x.cnt === 1);
    if (single) push(single);
    out.push({ g, cands: picked });
  }
  return out;
}

// Maximal Spaces 更新：S 减去 B → 最多 6 个残块，再剪掉被支配的
function splitSpace(s, b) {
  const res = [];
  const ax0 = s.x, ay0 = s.y, az0 = s.z;
  const ax1 = s.x + s.L, ay1 = s.y + s.H, az1 = s.z + s.W;
  const bx0 = b.x, by0 = b.y, bz0 = b.z;
  const bx1 = b.x + b.l, by1 = b.y + b.h, bz1 = b.z + b.w;
  if (bx0 > ax0) res.push({ x: ax0, y: ay0, z: az0, L: bx0 - ax0, H: s.H, W: s.W });
  if (bx1 < ax1) res.push({ x: bx1, y: ay0, z: az0, L: ax1 - bx1, H: s.H, W: s.W });
  if (by0 > ay0) res.push({ x: ax0, y: ay0, z: az0, L: s.L, H: by0 - ay0, W: s.W });
  if (by1 < ay1) res.push({ x: ax0, y: by1, z: az0, L: s.L, H: ay1 - by1, W: s.W });
  if (bz0 > az0) res.push({ x: ax0, y: ay0, z: az0, L: s.L, H: s.H, W: bz0 - az0 });
  if (bz1 < az1) res.push({ x: ax0, y: ay0, z: bz1, L: s.L, H: s.H, W: az1 - bz1 });
  return res;
}
function contains(a, b) { // a 包含 b ?
  return a.x <= b.x && a.y <= b.y && a.z <= b.z &&
    a.x + a.L >= b.x + b.L && a.y + a.H >= b.y + b.H && a.z + a.W >= b.z + b.W;
}
function prune(spaces, maxKeep) {
  // 去掉体积为 0 的和被支配的
  let list = spaces.filter(s => s.L > 0 && s.H > 0 && s.W > 0);
  list.sort((a, b) => (b.L * b.H * b.W) - (a.L * a.H * a.W));
  const kept = [];
  for (const s of list) {
    let dominated = false;
    for (const k of kept) { if (contains(k, s)) { dominated = true; break; } }
    if (!dominated) kept.push(s);
  }
  return kept.length > maxKeep ? kept.slice(0, maxKeep) : kept;
}

function packOnce(perGroups, container, rng, mode) {
  let spaces = [{ x: 0, y: 0, z: 0, L: container.innerLength, H: container.innerHeight, W: container.innerWidth }];
  const placements = [];
  const remain = new Map(perGroups.map(pg => [pg.g.sku, pg.g.qty]));
  let usedVol = 0, usedWeight = 0;

  const order = perGroups.map(pg => pg.g.sku);
  if (mode === 'port') order.sort((a, b) => {
    const ga = perGroups.find(p => p.g.sku === a).g, gb = perGroups.find(p => p.g.sku === b).g;
    return (gb.portSequence - ga.portSequence) || 0;
  });
  for (let i = order.length - 1; i > 0; i--) if (rng() < 0.35) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }

  const posCost = (s) => s.x * 1e7 + s.y * 1e5 + s.z;
  let guard = 0;
  while (guard++ < 30000) {
    if (!spaces.length) break;
    spaces.sort((a, b) => posCost(a) - posCost(b));
    let done = false;
    for (let si = 0; si < spaces.length && !done; si++) {
      const s = spaces[si];
      // 选该空间里能放下的、件数最多的块（按 groupOrder 遍历，天然带随机性）
      let pick = null;
      for (const sku of order) {
        const left = remain.get(sku); if (!(left > 0)) continue;
        const pg = perGroups.find(p => p.g.sku === sku);
        for (const c of pg.cands) {
          if (c.cnt > left) continue;
          if (c.bL > s.L || c.bH > s.H || c.bW > s.W) continue;
          if (usedWeight + c.cnt * pg.g.weight > container.maxWeight) continue;
          if (!pick || c.cnt > pick.c.cnt) pick = { g: pg.g, c };
          break;
        }
      }
      if (!pick) continue;
      const { g, c } = pick;
      const box = { x: s.x, y: s.y, z: s.z, l: c.bL, h: c.bH, w: c.bW };
      placements.push({ sku: g.sku, ...box, cnt: c.cnt, weight: c.cnt * g.weight, nx: c.nx, ny: c.ny, nz: c.nz, oi: c.oi });
      usedVol += c.bL * c.bH * c.bW; usedWeight += c.cnt * g.weight;
      remain.set(g.sku, remain.get(g.sku) - c.cnt);
      // 用最大空间法更新：所有包含该 box 的空间都切开
      const next = [];
      for (let i = 0; i < spaces.length; i++) {
        const sp = spaces[i];
        const overlaps = box.x < sp.x + sp.L && box.x + box.l > sp.x &&
          box.y < sp.y + sp.H && box.y + box.h > sp.y &&
          box.z < sp.z + sp.W && box.z + box.w > sp.z;
        if (!overlaps) { next.push(sp); continue; }
        next.push(...splitSpace(sp, box));
      }
      spaces = prune(next, 600);
      done = true;
    }
    if (!done) break;
  }
  const unplaced = new Map();
  for (const [sku, left] of remain) if (left > 0) unplaced.set(sku, left);
  return { placements, unplaced, usedVol, usedWeight };
}

function cogOf(placements, container) {
  let sw = 0, sx = 0, sy = 0, sz = 0;
  for (const p of placements) {
    const wt = p.weight || 1;
    sw += wt; sx += (p.x + p.l / 2) * wt; sy += (p.y + p.h / 2) * wt; sz += (p.z + p.w / 2) * wt;
  }
  if (!(sw > 0)) return { lateral: 0, longitudinal: 0, vertical: 0 };
  const cx = sx / sw, cy = sy / sw, cz = sz / sw;
  return {
    lateral: Math.abs(cz - container.innerWidth / 2) / container.innerWidth * 100,
    longitudinal: Math.abs(cx - container.innerLength / 2) / container.innerLength * 100,
    vertical: cy / container.innerHeight * 100
  };
}

function centerLoad(placements, container) {
  if (!placements.length) return placements;
  let sw = 0, sx = 0, sz = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of placements) {
    const wt = p.weight || 1; sw += wt;
    sx += (p.x + p.l / 2) * wt; sz += (p.z + p.w / 2) * wt;
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x + p.l);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z + p.w);
  }
  const wantX = container.innerLength / 2 - sx / sw;
  const wantZ = container.innerWidth / 2 - sz / sw;
  const shiftX = Math.max(-minX, Math.min(container.innerLength - maxX, wantX));
  const shiftZ = Math.max(-minZ, Math.min(container.innerWidth - maxZ, wantZ));
  return placements.map(p => ({ ...p, x: p.x + shiftX, z: p.z + shiftZ, rigidShift: { x: shiftX, z: shiftZ } }));
}

function solve(groups, container, opt = {}) {
  const restarts = opt.restarts || 60;
  const perGroups = buildCandidates(groups, container, opt);
  const innerVol = container.innerLength * container.innerWidth * container.innerHeight;
  let seed = opt.seed || 20260918;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const modes = ['base', 'port'];
  let best = null;
  for (let r = 0; r < restarts; r++) {
    const res = packOnce(perGroups, container, rng, modes[r % modes.length]);
    const util = res.usedVol / innerVol * 100;
    const cog = cogOf(res.placements, container);
    const placedCnt = res.placements.reduce((s, p) => s + p.cnt, 0);
    const penalty = (cog.longitudinal > 10 ? (cog.longitudinal - 10) * 0.9 : 0) + cog.lateral * 0.4;
    const score = util - penalty;
    if (!best || score > best.score) best = { score, util, cog, placedCnt, placements: res.placements, usedVol: res.usedVol, unplaced: res.unplaced };
  }
  // ---- 后处理：刚性平移使重心居中（受箱内空间约束，不改变相对布局）----
  const rawBest = best;
  let best2 = null;
  for (let r = 0; r < restarts; r++) {
    const res = packOnce(perGroups, container, rng, modes[r % modes.length]);
    const centered = centerLoad(res.placements, container);
    const util = res.usedVol / innerVol * 100;
    const cog = cogOf(centered, container);
    const placedCnt = centered.reduce((s, p) => s + p.cnt, 0);
    const penalty = (cog.longitudinal > 10 ? (cog.longitudinal - 10) * 0.9 : 0) + cog.lateral * 0.4;
    const score = util - penalty;
    if (!best2 || score > best2.score) best2 = { score, util, cog, placedCnt, placements: centered, usedVol: res.usedVol, unplaced: res.unplaced };
  }
  best = best2 || rawBest;
  return { best, innerVol };
}

const templates = require(BASE + '/config/demo-cargo-templates.js');
const CONTAINERS = {
  '40HQ': { innerLength: 12032, innerWidth: 2352, innerHeight: 2698, maxWeight: 26480 },
  '20GP': { innerLength: 5898, innerWidth: 2352, innerHeight: 2393, maxWeight: 28180 },
  '40GP': { innerLength: 12032, innerWidth: 2352, innerHeight: 2393, maxWeight: 26730 }
};
const which = process.argv[2] || 'largeBatch';
const ctype = process.argv[3] || '40HQ';
const groups = groupSku(templates[which].cargoList);
const container = CONTAINERS[ctype];
const N = groups.reduce((s, g) => s + g.qty, 0);
const totalVol = groups.reduce((s, g) => s + g.qty * g.l * g.w * g.h, 0) / 1e9;
const totalW = groups.reduce((s, g) => s + g.qty * g.weight, 0);
const innerVol = container.innerLength * container.innerWidth * container.innerHeight / 1e9;

console.log(`\n########## 原型算法 v3 (Maximal Spaces) · ${which} / ${ctype} ##########`);
console.log(`件数 ${N} | 总重 ${Math.round(totalW)} kg | 货物 ${totalVol.toFixed(2)} m³ | 箱容 ${innerVol.toFixed(2)} m³ | 理论占箱容 ${(totalVol / innerVol * 100).toFixed(2)}%`);

let last = null;
for (const restarts of [1, 20, 100]) {
  const t0 = Date.now();
  const r = solve(groups, container, { restarts, seed: 20260918 });
  const ms = Date.now() - t0; last = r;
  console.log(`\n--- restarts=${String(restarts).padEnd(3)} ---`);
  console.log(`  装入件数   : ${r.best.placedCnt}/${N} (${(r.best.placedCnt / N * 100).toFixed(1)}%)`);
  console.log(`  体积利用率 : ${r.best.util.toFixed(2)}%`);
  console.log(`  横向偏移   : ${r.best.cog.lateral.toFixed(4)}%   纵向偏移 : ${r.best.cog.longitudinal.toFixed(4)}%   重心高度比 : ${r.best.cog.vertical.toFixed(1)}%`);
  console.log(`  耗时       : ${ms} ms`);
}
console.log('\n--- 未装入清单（一等输出）---');
if (!last.best.unplaced.size) console.log('  无 —— 全部装入');
else {
  let uv = 0;
  for (const [sku, left] of last.best.unplaced) {
    const g = groups.find(x => x.sku === sku);
    uv += left * g.l * g.w * g.h / 1e9;
    console.log(`  ${sku}: 未装入 ${left} / ${g.qty}`);
  }
  console.log(`  未装入体积 ${uv.toFixed(2)} m³ → 需加订 ${Math.ceil((uv / innerVol) * 100 / 100 * 100) / 100} 个同型柜`);
}
