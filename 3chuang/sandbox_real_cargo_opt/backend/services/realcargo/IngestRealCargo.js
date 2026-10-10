'use strict';
/**
 * IngestRealCargo — 真实货代数据录入适配器（注入自 RECOVERED 供体预处理逻辑）
 *
 * 职责：
 *  1. 将 load_task 真实快照的 units（含 packagingProfile/cargoPhysicalProfile/
 *     orientationPolicy/forkEntry/woodPackagingClass 等货代语义）规范化为
 *     装箱引擎 cargoList 行契约；
 *  2. 朝向策略 → canRotate/canLayFlat 映射（复用供体 OrientationConstraint）；
 *  3. 客户/订单/批次语义透传（customerId/orderId/lotId/unloadSequence）；
 *  4. 构建真实货代基准测试 case（柜型取自真实船公司 REFERENCE_PROFILE）。
 *
 * 供体来源：3chuang_RECOVERED_20260911-003253/backend/services/packing/
 *   - PackagingProfile.js（normalizeCargoList，RECOVERED 版含托盘/异形包装规范化）
 *   - OrientationConstraint.js（resolveOrientationRules/resolveAllowedOrientations）
 */

const path = require('path');
const fs = require('fs');
const { normalizeCargoList, orientationsForPolicy } = require('../packing/PackagingProfile.realcargo');
const { resolveOrientationRules } = require('../packing/OrientationConstraint');

/** 朝向策略 → 引擎布尔契约（canRotate=绕垂直轴换向；canLayFlat=侧翻改变高度轴） */
function deriveOrientationBooleans(unit) {
  const policy = unit.orientationPolicy
    || (unit.packagingProfile && unit.packagingProfile.orientationPolicy)
    || null;
  let canRotate = unit.canRotate;
  let canLayFlat = unit.canLayFlat;
  try {
    if (policy) {
      const allowed = orientationsForPolicy(
        { length: Number(unit.length), width: Number(unit.width), height: Number(unit.height) },
        policy
      ) || [];
      const h0 = Number(unit.height);
      const l0 = Number(unit.length);
      const w0 = Number(unit.width);
      let hasYaw = false;
      let hasRoll = false;
      for (const o of allowed) {
        const ol = Number(o.length ?? o.l);
        const ow = Number(o.width ?? o.w);
        const oh = Number(o.height ?? o.h);
        if (Math.abs(oh - h0) <= 0.5 && !(Math.abs(ol - l0) <= 0.5 && Math.abs(ow - w0) <= 0.5)) hasYaw = true;
        if (Math.abs(oh - w0) <= 0.5 && Math.abs(ow - h0) <= 0.5) hasRoll = true;
      }
      if (canRotate === undefined) canRotate = hasYaw;
      if (canLayFlat === undefined) canLayFlat = hasRoll;
    }
  } catch (e) { /* 策略解析失败时保持原始布尔 */ }
  if (canRotate === undefined) canRotate = true;
  if (canLayFlat === undefined) canLayFlat = false;
  return { canRotate: canRotate === true, canLayFlat: canLayFlat === true };
}

/** 真实 unit → 引擎 cargo 行（保留货代业务语义字段） */
function normalizeRealUnit(unit, index) {
  const profile = unit.packagingProfile || {};
  const physical = unit.cargoPhysicalProfile || {};
  const orient = deriveOrientationBooleans(unit);
  const row = {
    cargoId: unit.unitId || unit.cargoId || `${unit.sku || 'REAL'}_${index + 1}`,
    unitIds: [unit.unitId || unit.cargoId].filter(Boolean),
    sku: unit.sku,
    name: unit.name,
    length: Number(unit.length),
    width: Number(unit.width),
    height: Number(unit.height),
    weight: Number(unit.weight || 0),
    quantity: 1,
    portSequence: Number(unit.portSequence || 1),
    destinationPort: unit.destinationPort || (unit.service && unit.service.destination) || null,
    eta: unit.eta || (unit.service && unit.service.windowStart) || null,
    stackable: unit.stackable !== undefined ? unit.stackable !== false
      : (profile.stackable !== undefined ? profile.stackable !== false : true),
    maxStackLayers: Number(unit.maxStackLayers ?? profile.maxStackLayers ?? 1),
    fragile: unit.fragile === true || profile.fragile === true,
    dangerous: unit.dangerous === true || (unit.dangerousGoodsContext && unit.dangerousGoodsContext !== 'NOT_DECLARED'),
    wooden: unit.wooden === true || profile.wooden === true || (unit.woodPackagingClass && unit.woodPackagingClass !== 'NO_WOOD'),
    packagingType: unit.packagingType || profile.type || null,
    handlingMethod: unit.handlingMethod || profile.handlingMode || (Number(unit.weight || 0) >= 20 ? 'forklift' : 'manual'),
    canRotate: orient.canRotate,
    canLayFlat: orient.canLayFlat,
    canInvert: unit.canInvert === true,
    // 货代业务语义透传
    customerId: unit.customerId || null,
    customerName: unit.customerName || null,
    orderId: unit.orderId || null,
    lotId: unit.lotId || null,
    unloadSequence: unit.unloadSequence || unit.portSequence || null,
    forkEntry: unit.forkEntry || profile.forkEntry || null,
    transportUnit: profile.transportUnit || null,
    source: unit.source || 'REAL_FORWARDER_LOAD_TASK'
  };
  // 物理画像补充（maximumSupportedWeight 等）
  if (unit.maximumSupportedWeightKg != null) row.maximumSupportedWeightKg = Number(unit.maximumSupportedWeightKg);
  if (physical.stackable != null && row.stackable === true) row.stackable = physical.stackable !== false;
  return normalizeCargoList([row])[0];
}

/** 数据集目录解析（位置容忍：沙盒布局与归档布局均可） */
function datasetDir(explicit) {
  const candidates = [
    explicit,
    path.join(__dirname, '../../../data/real_forwarder_dataset'),
    path.join(__dirname, '../../data_real_forwarder_dataset'),
    path.join(__dirname, '../../../data_real_forwarder_dataset'),
    path.join(__dirname, '../../data/real_forwarder_dataset')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'real_task_1c0adc0e_rev1.json'))) return c;
  }
  return candidates[1] || candidates[0];
}

/** 真实任务快照 → 引擎 cargoList */
function ingestTask(taskFile) {
  const abs = path.isAbsolute(taskFile) ? taskFile : path.join(datasetDir(), taskFile);
  const task = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const units = task.units || [];
  const cargoList = units.map((u, i) => normalizeRealUnit(u, i));
  return { task, cargoList };
}

/** 真实船公司参考柜型（来自任务快照 plan.containerInfo，Maersk CARRIER_REFERENCE） */
function containerOf(task, fallback) {
  const ci = task.containers && task.containers[0] && task.containers[0].plan && task.containers[0].plan.containerInfo;
  if (ci && ci.innerLength && ci.innerWidth && ci.innerHeight) {
    return {
      typeId: ci.typeId || ci.name || 'REAL',
      innerLength: Number(ci.innerLength),
      innerWidth: Number(ci.innerWidth),
      innerHeight: Number(ci.innerHeight),
      maxWeight: Number(ci.maxWeight || ci.payload || 0),
      doorWidth: ci.doorWidth || null,
      doorHeight: ci.doorHeight || null,
      isoTypeCode: ci.isoTypeCode || null,
      source: 'CARRIER_REFERENCE'
    };
  }
  return fallback;
}

const STANDARD = {
  '20GP': { typeId: '20GP', innerLength: 5898, innerWidth: 2352, innerHeight: 2393, maxWeight: 28300 },
  '40HQ': { typeId: '40HQ', innerLength: 12032, innerWidth: 2352, innerHeight: 2698, maxWeight: 28690 }
};

/** 构建真实货代基准测试 case 集 */
function buildRealBenchmarkCases(datasetDirOverride) {
  const dir = datasetDirOverride || datasetDir();
  const cases = [];

  // CASE 1: 单港整托 14 件（TASK_1c0adc0e）→ 40HQ（单 20GP 地板不足，真实选柜决策）
  const t1 = ingestTask('real_task_1c0adc0e_rev1.json');
  if (t1.cargoList.length) {
    cases.push({
      id: 'REAL-PALLET-14-HAM',
      label: '真实托盘任务 · 14 件设备托盘 260kg 不可堆叠 · HAM',
      container: STANDARD['40HQ'], // 真实选柜决策：14 件不可堆叠托盘地板 16.8m² > 20GP 13.87m² → 升 40HQ
      cargoList: t1.cargoList,
      realSource: 'TASK_1c0adc0e-54fd-407b-aa44-6e8453cf32d3 rev1'
    });
  }

  // CASE 2: 多客户追加装载 16 件（TASK_e78dde2c rev10）→ 40HQ 单柜
  const t6 = ingestTask('real_task_e78dde2c_rev10.json');
  if (t6.cargoList.length) {
    cases.push({
      id: 'REAL-MULTICUST-16',
      label: '真实多客户任务 · 14×PALLET-A(客户F39) + 2×PALLET-B(客户44C)',
      container: STANDARD['40HQ'], // 单柜容量测试（真实历史方案为 2x20GP 分柜 9+7）
      cargoList: t6.cargoList,
      realSource: 'TASK_e78dde2c-ac5a-49c8-8d5d-98ba4b7f5f2c rev10（真实历史方案：2×20GP 分柜 9+7）'
    });
  }

  // CASE 3: 月台叉车验收 5 件超高托盘（TASK_77f97ed4，rot=false）→ 20GP 参考柜
  const t3 = ingestTask('real_task_77f97ed4_rev3.json');
  if (t3.cargoList.length) {
    cases.push({
      id: 'REAL-DOCK-5-20GP',
      label: '真实月台叉车验收 · 5 件 1200x2000x500 禁旋转托盘',
      container: containerOf(t3.task, STANDARD['20GP']),
      cargoList: t3.cargoList,
      realSource: 'TASK_77f97ed4-c6bc-4cfb-ac2c-0601126ca792 rev3'
    });
  }

  // CASE 4: 多港高密度 212 件（TASK_b622c7f8，Hamburg/Rotterdam/Antwerp 三港 LIFO）→ 40HQ
  const t4 = ingestTask('real_task_b622c7f8_rev1.json');
  if (t4.cargoList.length) {
    cases.push({
      id: 'REAL-MULTIPORT-212',
      label: '真实多港任务 · 212 件 3 港卸货序（HAM/RTM/ANR）高密度约束',
      container: containerOf(t4.task, STANDARD['40HQ']),
      cargoList: t4.cargoList,
      realSource: 'TASK_b622c7f8-98a3-4186-8149-a558ca3ea176 rev1'
    });
  }

  return cases;
}

/**
 * [MUTATION e2e-C1] 同规格行合并（录入聚类预处理）：
 * 真实货代数据为逐单件行（qty=1）。放大约/拼箱合并后出现大量同规格行时，
 * 引擎 fill 路径按行扫描会组合爆炸（实测 424 单件行 43.9s + 传递层高违规），
 * 而等价的 qty=N 行形态为 56ms 全绿。合并键 = 业务语义完全一致
 * （sku/三维/重量/港序/堆叠/易碎/包装/目的地/客户/朝向）。
 */
function consolidateRows(cargoList) {
  const keyOf = (c) => JSON.stringify([
    c.sku, c.length, c.width, c.height, c.weight, c.portSequence, c.destinationPort,
    c.stackable !== false, Number(c.maxStackLayers || 1), c.fragile === true,
    c.packagingType || null, c.customerId || null, c.canRotate !== false, c.canLayFlat === true
  ]);
  const merged = new Map();
  const order = [];
  for (const c of cargoList) {
    const k = keyOf(c);
    if (!merged.has(k)) {
      const row = { ...c };
      row.unitIds = [...(c.unitIds || [c.cargoId].filter(Boolean))];
      row.quantity = Math.max(1, Number(c.quantity || 1));
      merged.set(k, row);
      order.push(row);
    } else {
      const row = merged.get(k);
      row.quantity += Math.max(1, Number(c.quantity || 1));
      if (c.unitIds) row.unitIds.push(...c.unitIds);
      else if (c.cargoId) row.unitIds.push(c.cargoId);
    }
  }
  return order;
}

module.exports = { normalizeRealUnit, ingestTask, buildRealBenchmarkCases, containerOf, deriveOrientationBooleans, consolidateRows };
