'use strict';
/**
 * test_pipeline_e2e.js — LLM 柜型推荐 × 3D 装箱引擎 分步联动与全场景验证
 *
 * 流水线：[真实货物录入/预处理] → [原生 LLM/规则柜型推荐 + 地面面积 Adapter] →
 *         [3D 装箱引擎按推荐柜型排布] → [独立物理双闸门验证]
 *
 * Test A：业务真实闭环（货不动动柜型 —— 商业降本）
 * Test B：极限高压压榨（柜不动增货物 —— 空间极限）
 * Reverse：智能补货与满柜测算（反向塞货 + LIFO/重沉底保持验证）
 */

const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

const SANDBOX = __dirname; // 本脚本位于沙盒根：sandbox_real_cargo_opt/
const AlgorithmOrchestrator = require(path.join(SANDBOX, 'backend/services/AlgorithmOrchestrator'));
const PlanValidator = require(path.join(SANDBOX, 'backend/services/packing/PlanValidator'));
const { buildRealBenchmarkCases, consolidateRows } = require(path.join(SANDBOX, 'backend/services/realcargo/IngestRealCargo'));
const { ContainerRecommender, CATALOG } = require(path.join(SANDBOX, 'backend/services/realcargo/ContainerRecommender'));
const { checkPhysical, checkOrientation, checkLifo } = require('./harness/independent_check');

const NOOP_CACHE = { get: async () => null, set: async () => {} };
const SEED = 42;
const TIMEOUT_MS = 30000;
const CARTON = { length: 400, width: 300, height: 300, weight: 15, name: '标准补货纸箱', sku: 'TOPUP-CARTON' };

function cloneRows(rows) {
  return rows.map((r) => ({ ...r }));
}

function scaleRows(rows, factor) {
  // 真实倍数扩增：直接放大 quantity 字段（SKU 语义不变，保持行结构）
  return rows.map((r) => ({ ...r, quantity: Math.max(1, Math.round(Number(r.quantity || 1) * factor)) }));
}

/** 构建真实 20GP 高密度凑整单（Test A 的 ≥80% 演示）：从多港 212 中按体积贪心选取 ~90% 20GP 容积 */
function buildDense20GPCase(allCases) {
  const multi = allCases.find((c) => c.id === 'REAL-MULTIPORT-212');
  const target = 29.9; // m³，20GP 容积 33.2 的 ~90%
  const picked = [];
  let acc = 0;
  // 按 SKU 轮转选取保持混装多样性，优先小件（更容易凑满）
  const bySku = new Map();
  for (const u of multi.cargoList) {
    if (!bySku.has(u.sku)) bySku.set(u.sku, []);
    bySku.get(u.sku).push(u);
  }
  const pools = [...bySku.values()].map((arr) => arr.sort((a, b) => (a.length * a.width * a.height) - (b.length * b.width * b.height)));
  let progress = true;
  while (acc < target && progress) {
    progress = false;
    for (const pool of pools) {
      const u = pool.shift();
      if (!u) continue;
      const v = (u.length * u.width * u.height) / 1e9;
      if (acc + v > target + 0.35) { pool.unshift(u); continue; } // 允许小幅超出
      picked.push(u);
      acc += v;
      progress = true;
      if (acc >= target) break;
    }
  }
  return {
    id: 'REAL-DENSE-20GP',
    label: '真实货代凑整单 · 多 SKU 混装至 20GP ~90% 容积（LLM 小柜推荐场景）',
    container: { ...CATALOG['20GP'] },
    cargoList: picked,
    realSource: 'REAL-MULTIPORT-212 子集（同一真实录入任务的货物）'
  };
}

/** Test B3：多任务真实拼箱 LCL（4 个真实任务合并不超过一个 40HQ） */
function buildLCLCase(allCases, idsOverride) {
  const ids = idsOverride || ['REAL-MULTICUST-16', 'REAL-DOCK-5-20GP', 'REAL-MULTIPORT-212'];
  const merged = [];
  let unitIndex = 0;
  for (const id of ids) {
    const c = allCases.find((x) => x.id === id);
    for (const u of c.cargoList) {
      merged.push({ ...u, cargoId: `LCL_${unitIndex++}_${u.cargoId || u.sku}` });
    }
  }
  return {
    id: 'REAL-LCL-MERGE-40HQ',
    label: '真实多任务拼箱 LCL · 托盘任务×3 + 多港任务 合并单 40HQ（多港多客户混装）',
    container: { ...CATALOG['40HQ'] },
    cargoList: merged,
    realSource: 'TASK_1c0adc0e + TASK_e78dde2c + TASK_77f97ed4 + TASK_b622c7f8'
  };
}

async function runEngine(orchestrator, cargoList, container, algorithmId) {
  const t0 = performance.now();
  const result = await Promise.race([
    orchestrator.execute({ cargoList: cloneRows(cargoList), container: { ...container }, options: { algorithmId, seed: SEED } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('CASE_TIMEOUT')), TIMEOUT_MS))
  ]);
  const wallMs = performance.now() - t0;
  return { result, wallMs };
}

function evaluate(result, cargoList, container, wallMs) {
  const placements = result.loadedCargo || [];
  const containerVolume = (container.innerLength * container.innerWidth * container.innerHeight) / 1e9;
  const loadedVolume = placements.reduce((s, p) => s + (p.l || 0) * (p.w || 0) * (p.h || 0), 0) / 1e9;
  const totalInput = cargoList.reduce((s, c) => s + Math.max(1, Number(c.quantity || 1)), 0);
  const inputVolume = cargoList.reduce((s, c) => s + (c.length || 0) * (c.width || 0) * (c.height || 0) * Math.max(1, Number(c.quantity || 1)), 0) / 1e9;

  const { violations: phys } = checkPhysical(placements, container);
  const orientV = checkOrientation(placements, cargoList);
  const lifoV = checkLifo(placements);
  const violations = [...phys, ...orientV, ...lifoV];
  let validatorHard = -1;
  let validator = null;
  try {
    validator = new PlanValidator().validate({ placements, cargoList, container });
    validatorHard = validator.hardViolationCount || 0;
  } catch (e) { /* gate 失败时独立检查器兜底 */ }

  return {
    loaded: placements.length,
    totalInput,
    loadRate: totalInput ? Math.round((placements.length / totalInput) * 1000) / 1000 : 0,
    utilization: Math.round((loadedVolume / containerVolume) * 10000) / 100,
    inputRatio: Math.round((inputVolume / containerVolume) * 10000) / 100,
    loadedVolumeM3: Math.round(loadedVolume * 100) / 100,
    containerVolumeM3: Math.round(containerVolume * 100) / 100,
    wallMs: Math.round(wallMs * 100) / 100,
    violations,
    violationCodes: [...new Set(violations.map((v) => v.code))],
    validatorHard,
    validatorStatus: validator ? validator.status : 'SKIPPED',
    unloaded: (result.unloadedCargo || []).length,
    totalWeight: Math.round(placements.reduce((s, p) => s + Number(p.weight || 0), 0)),
    cog: result.cogOffset ? { lateral: result.cogOffset.lateral, longitudinal: result.cogOffset.longitudinal } : null,
    placements
  };
}

/** 剩余残空间提取：高度图 + 最大空腔包围盒（Maximal Empty Space）+ 剩余载重 */
function extractResidual(placements, container) {
  const step = 100; // mm
  const cols = Math.floor(container.innerLength / step);
  const rowsN = Math.floor(container.innerWidth / step);
  const height = new Float64Array(cols * rowsN);
  for (const p of placements) {
    const c0 = Math.max(0, Math.floor(p.x / step));
    const c1 = Math.min(cols - 1, Math.floor((p.x + p.l - 0.01) / step));
    const r0 = Math.max(0, Math.floor(p.z / step));
    const r1 = Math.min(rowsN - 1, Math.floor((p.z + p.w - 0.01) / step));
    for (let cc = c0; cc <= c1; cc++) {
      for (let rr = r0; rr <= r1; rr++) {
        const top = p.y + p.h;
        if (top > height[rr * cols + cc]) height[rr * cols + cc] = top;
      }
    }
  }
  // 最大空腔：逐列(x)直方图 → 最大矩形（宽=Σz 步长，高=列内最小净高）
  let best = { volume: 0, x0: 0, x1: 0, z0: 0, z1: 0, clearHeight: 0 };
  for (let c0 = 0; c0 < cols; c0++) {
    const minH = new Float64Array(rowsN).fill(container.innerHeight);
    for (let c1 = c0; c1 < cols; c1++) {
      for (let r = 0; r < rowsN; r++) {
        const h = height[r * cols + c1];
        if (h < minH[r]) minH[r] = h;
      }
      // 最大矩形（高度直方图）
      const stack = [];
      for (let r = 0; r <= rowsN; r++) {
        const h = r === rowsN ? 0 : minH[r];
        let start = r;
        while (stack.length && stack[stack.length - 1].h >= h) {
          const { idx, hh } = stack.pop();
          const area = (r - idx) * step * hh;
          if (area > best.volume) {
            best = { volume: area, x0: c0 * step, x1: (c1 + 1) * step, z0: idx * step, z1: r * step, clearHeight: hh };
          }
          start = idx;
        }
        stack.push({ idx: start, h });
      }
    }
  }
  const totalFreeVolume = (() => {
    let free = 0;
    for (let cc = 0; cc < cols; cc++) {
      for (let rr = 0; rr < rowsN; rr++) {
        free += (container.innerHeight - height[rr * cols + cc]) * step * step;
      }
    }
    return free;
  })();
  const loadedWeight = placements.reduce((s, p) => s + Number(p.weight || 0), 0);
  return {
    maximalEmptySpace: {
      x: [Math.round(best.x0), Math.round(best.x1)],
      z: [Math.round(best.z0), Math.round(best.z1)],
      clearHeight: Math.round(best.clearHeight),
      volumeM3: Math.round(best.volume / 1e9 * 1000) / 1000
    },
    totalFreeVolumeM3: Math.round(totalFreeVolume / 1e9 * 100) / 100,
    remainingPayloadKg: Math.round((container.maxWeight || 0) - loadedWeight)
  };
}

/** 反向补货推算：估算可塞入的补货纸箱件数（体积法 × 经验密实系数，含承载/层高校验） */
function estimateTopUp(residual, carton, container, placements) {
  const cartonVol = (carton.length * carton.width * carton.height) / 1e9;
  const byVolume = Math.floor(residual.totalFreeVolumeM3 / cartonVol * 0.72); // 72% 小件密实系数
  const mes = residual.maximalEmptySpace;
  const byMES = Math.floor(
    ((mes.x[1] - mes.x[0]) * (mes.z[1] - mes.z[0]) * mes.clearHeight) / (carton.length * carton.width * carton.height) * 0.85
  );
  const byPayload = Math.floor(residual.remainingPayloadKg / carton.weight);
  return { byVolume, byMaximalEmptySpace: byMES, byPayload, estimate: Math.max(0, Math.min(byPayload, Math.max(byMES, Math.floor(byVolume * 0.6)))) };
}

async function main() {
  const report = { generatedAt: new Date().toISOString(), seed: SEED, stages: {} };
  const orchestrator = new AlgorithmOrchestrator({ cache: NOOP_CACHE, timeoutMs: TIMEOUT_MS, debugMode: false });
  const recommender = new ContainerRecommender();
  const algorithmId = 'realistic4d-multi-strategy';

  const realCases = buildRealBenchmarkCases();
  const denseCase = buildDense20GPCase(realCases);
  const lclCase = buildLCLCase(realCases);

  // ============ Test A：业务真实闭环（货不动，动柜型） ============
  console.log('========== Test A：LLM/规则柜型推荐联动 ==========');
  const testA = [];
  for (const c of [...realCases, denseCase]) {
    const rec = await recommender.recommend(c.cargoList);
    const chosenContainer = rec.chosen.container;
    const { result, wallMs } = await runEngine(orchestrator, c.cargoList, chosenContainer, algorithmId);
    const ev = evaluate(result, c.cargoList, chosenContainer, wallMs);
    // 对照组：默认最大柜 40HQ
    const alt = await runEngine(orchestrator, c.cargoList, CATALOG['40HQ'], algorithmId);
    const evAlt = evaluate(alt.result, c.cargoList, CATALOG['40HQ'], alt.wallMs);
    delete evAlt.placements; delete ev.placements;
    testA.push({
      caseId: c.id,
      label: c.label,
      recommendation: {
        provenance: rec.provenance,
        nativeTop: rec.native.recommendations[0] || null,
        chosen: { typeId: rec.chosen.typeId, volumeUtil: rec.chosen.volumeUtil, floorUtil: rec.chosen.floorUtil, feasible: rec.chosen.feasible },
        overrideReason: rec.overrideReason,
        nativeFallback: rec.native.fallback
      },
      packed: ev,
      baseline40HQ: { utilization: evAlt.utilization, loaded: evAlt.loaded, totalInput: evAlt.totalInput, wallMs: evAlt.wallMs },
      violations0: ev.violations.length === 0 && ev.validatorHard === 0
    });
    console.log(`[A] ${c.id}: 推荐=${rec.chosen.typeId}(${rec.provenance}) util=${ev.utilization}% load=${ev.loaded}/${ev.totalInput} ${ev.wallMs.toFixed(0)}ms violations=${ev.violations.length}/PV=${ev.validatorHard} | 40HQ对照 util=${evAlt.utilization}%`);
  }
  report.stages.testA = testA;

  // ============ Test B：极限高压压榨（柜不动，增货物，统一 40HQ） ============
  console.log('========== Test B：40HQ 极限压测 ==========');
  const multi = realCases.find((c) => c.id === 'REAL-MULTIPORT-212');
  const testB = [];
  const bCases = [
    { id: 'B1-1.5x', label: '真实 SKU 1.5 倍扩增（整件复制）', rows: scaleRows(multi.cargoList, 1.5) },
    { id: 'B2-2.0x', label: '真实 SKU 2.0 倍饱和压榨', rows: scaleRows(multi.cargoList, 2.0) },
    { id: 'B3-LCL', label: '多任务真实拼箱 LCL（托盘任务×2 + 多港任务，3 任务合并）', rows: buildLCLCase(realCases).cargoList },
    { id: 'B3b-LCL-4task', label: '对照：4 任务全合并（含 14 件托盘任务，地板物理极限演示）', rows: buildLCLCase(realCases, ['REAL-PALLET-14-HAM', 'REAL-MULTICUST-16', 'REAL-DOCK-5-20GP', 'REAL-MULTIPORT-212']).cargoList }
  ];
  for (const b of bCases) {
    const { result, wallMs } = await runEngine(orchestrator, b.rows, CATALOG['40HQ'], algorithmId);
    const ev = evaluate(result, b.rows, CATALOG['40HQ'], wallMs);
    delete ev.placements;
    testB.push({ caseId: b.id, label: b.label, ...ev });
    console.log(`[B] ${b.id}: util=${ev.utilization}% load=${ev.loaded}/${ev.totalInput} vol=${ev.loadedVolumeM3}/${ev.containerVolumeM3}m³ ${ev.wallMs.toFixed(0)}ms violations=${ev.violations.length}/PV=${ev.validatorHard} codes=${ev.violationCodes.join(',')||'-'}`);
  }
  report.stages.testB = testB;

  // ============ Reverse：智能补货与满柜测算 ============
  console.log('========== Reverse Packing：剩余残空间 + 反向补货 ==========');
  const reverse = [];
  for (const c of [...realCases, denseCase]) {
    const rec = await recommender.recommend(c.cargoList);
    const chosenContainer = rec.chosen.container;
    const { result } = await runEngine(orchestrator, c.cargoList, chosenContainer, algorithmId);
    const placements = result.loadedCargo || [];
    if (!placements.length) continue;
    const residual = extractResidual(placements, chosenContainer);
    const est = estimateTopUp(residual, CARTON, chosenContainer, placements);
    if (est.estimate <= 0) {
      reverse.push({ caseId: c.id, container: rec.chosen.typeId, residual, estimate: est, verification: { skippable: true, reason: '无有效补货空间或载重' } });
      continue;
    }
    // 验证：原货物 + K 件补货纸箱重跑引擎
    const cartonRow = {
      ...CARTON, cargoId: 'TOPUP-CARTON', sku: CARTON.sku,
      quantity: est.estimate,
      stackable: true, maxStackLayers: Math.floor(chosenContainer.innerHeight / CARTON.height),
      portSequence: Math.max(...c.cargoList.map((x) => Number(x.portSequence || 1))),
      destinationPort: (c.cargoList.find((x) => x.destinationPort) || {}).destinationPort || null
    };
    const withTopUp = [...cloneRows(c.cargoList), cartonRow];
    const { result: res2 } = await runEngine(orchestrator, withTopUp, chosenContainer, algorithmId);
    const ev2 = evaluate(res2, withTopUp, chosenContainer, 0);
    const loadedCartons = ev2.loaded - ev2.totalInput + est.estimate; // 补货纸箱实载件数
    reverse.push({
      caseId: c.id,
      container: rec.chosen.typeId,
      residual,
      estimate: est,
      verification: {
        cartonsOffered: est.estimate,
        cartonsLoaded: Math.max(0, loadedCartons),
        totalLoaded: ev2.loaded,
        violations: ev2.violations.length,
        violationCodes: ev2.violationCodes,
        validatorHard: ev2.validatorHard,
        lifoIntact: !ev2.violationCodes.includes('LIFO'),
        heavyBottomIntact: !ev2.violationCodes.includes('HEAVY_ON_LIGHT')
      }
    });
    console.log(`[R] ${c.id}: 自由体积 ${residual.totalFreeVolumeM3}m³ 剩余载重 ${residual.remainingPayloadKg}kg → 估算可补 ${est.estimate} 件 → 实载 ${Math.max(0, loadedCartons)} 件, 违规 ${ev2.violations.length}, LIFO=${!ev2.violationCodes.includes('LIFO')}, 重沉底=${!ev2.violationCodes.includes('HEAVY_ON_LIGHT')}`);
  }
  report.stages.reversePacking = reverse;

  try { fs.mkdirSync(path.join(SANDBOX, 'results'), { recursive: true }); fs.writeFileSync(path.join(SANDBOX, 'results', 'staged_e2e_results.json'), JSON.stringify(report, null, 2), 'utf8'); } catch (e) { console.error('results write skipped:', e.message); }
  console.log('\nE2E results written to results/staged_e2e_results.json');
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
