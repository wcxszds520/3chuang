'use strict';
/**
 * IngestionValidator — 工作台货物录入防呆校验中间件（UAT 补丁）
 *
 * 定位：API 层拦截适配器（不触碰装箱引擎内部）。
 * 职责：
 *  1. 硬校验：返回 HTTP 400 + 精确字段错误（field 级定位），绝不放行会导致
 *     引擎崩溃/未定义行为的脏数据（重量 0/负数、尺寸超限、非数、缺 ID 等）；
 *  2. 软修正：缺失 stackable/canRotate/canLayFlat 时按 packagingType
 *     （木架/托盘/纸箱…）赋安全默认值（AI 模糊修正的确定性等价实现）；
 *  3. 规范化提示：normalizationNotes 记录所有自动修正，供前端回显。
 *
 * 默认值语义来源：项目 PackagingProfile（木托 → wooden/heavy、PALLETIZED_CARTONS
 * → 不可堆叠托盘、fragile → 禁顶）、FastBlock _mapCargoType（≥20kg → heavy）。
 */

const DIM_LIMITS = { min: 1, max: 20000 }; // mm，单边物理上限（超长件如风叶 99999 拦截）
const WEIGHT_LIMITS = { min: 0.01, max: 30000 }; // kg，单件上限（超过直接 400，等价整柜超载前置拦截）
const PACKAGING_DEFAULTS = {
  PALLETIZED_CARTONS: { stackable: false, canRotate: true, canLayFlat: false, wooden: true, handling: 'forklift' },
  WOOD_CRATE: { stackable: true, canRotate: true, canLayFlat: false, wooden: true, handling: 'forklift' },
  CARTON: { stackable: true, canRotate: true, canLayFlat: false, wooden: false, handling: 'manual' },
  DRUM: { stackable: false, canRotate: true, canLayFlat: false, wooden: false, handling: 'forklift' },
  FIBC_BAG: { stackable: false, canRotate: true, canLayFlat: false, wooden: false, handling: 'forklift' },
  EQUIPMENT_CASE: { stackable: false, canRotate: true, canLayFlat: false, wooden: true, handling: 'forklift' },
  WRAPPED_PALLET: { stackable: false, canRotate: true, canLayFlat: false, wooden: true, handling: 'forklift' }
};
const CANON = (v) => String(v || '').trim().toUpperCase().replace(/[\s\-/]+/g, '_');

/**
 * @returns {{ ok: boolean, status: number, errors: Array<{field,index,message,received}>,
 *             cargoList: Array, normalizationNotes: Array<string> }}
 */
function validateIngestion(cargoList) {
  const errors = [];
  const normalizationNotes = [];
  if (!Array.isArray(cargoList) || cargoList.length === 0) {
    return { ok: false, status: 400, errors: [{ field: 'cargoList', index: -1, message: '货物清单必须为非空数组', received: String(cargoList) }], cargoList: [], normalizationNotes };
  }
  if (cargoList.length > 2000) {
    errors.push({ field: 'cargoList', index: -1, message: '单柜最多 2000 个运输单元', received: cargoList.length });
  }
  const cleaned = [];
  cargoList.forEach((raw, index) => {
    if (raw === null || typeof raw !== 'object') {
      errors.push({ field: 'cargoList', index, message: '货物行必须是对象', received: String(raw) });
      return;
    }
    const c = { ...raw };

    // 身份
    if (!c.cargoId && !c.sku && !c.name) {
      errors.push({ field: 'cargoId|sku|name', index, message: '缺少货物标识（cargoId/sku/name 至少一项）', received: null });
      return;
    }
    if (!c.cargoId) { c.cargoId = c.sku || `ROW_${index + 1}`; normalizationNotes.push(`[行${index}] 缺 cargoId，自动补 ${c.cargoId}`); }

    // 尺寸：数字、有限、范围
    for (const dim of ['length', 'width', 'height']) {
      const v = Number(c[dim]);
      if (!Number.isFinite(v)) {
        errors.push({ field: dim, index, message: `${dim} 必须是有限数字`, received: String(c[dim]) });
        return;
      }
      if (v < DIM_LIMITS.min) {
        errors.push({ field: dim, index, message: `${dim}=${v} 低于物理下限 ${DIM_LIMITS.min}mm`, received: v });
        return;
      }
      if (v > DIM_LIMITS.max) {
        errors.push({ field: dim, index, message: `${dim}=${v}mm 超长（上限 ${DIM_LIMITS.max}mm，请拆分或选择散杂船）`, received: v });
        return;
      }
      c[dim] = v;
    }

    // 重量：0/负数/超限/非数全部拦截（防呆核心——重量 0 会污染重心与承载计算）
    const w = Number(c.weight);
    if (!Number.isFinite(w)) {
      errors.push({ field: 'weight', index, message: 'weight 必须是有限数字（0 也不可）', received: String(c.weight) });
      return;
    }
    if (w <= 0) {
      errors.push({ field: 'weight', index, message: `weight=${w} 非法：重量必须 > 0（重量 0 会破坏重心与承载计算）`, received: w });
      return;
    }
    if (w > WEIGHT_LIMITS.max) {
      errors.push({ field: 'weight', index, message: `weight=${w}kg 超过单件上限 ${WEIGHT_LIMITS.max}kg`, received: w });
      return;
    }
    c.weight = w;

    // 数量
    const q = Number(c.quantity === undefined ? 1 : c.quantity);
    if (!Number.isInteger(q) || q < 1) {
      errors.push({ field: 'quantity', index, message: 'quantity 必须为 ≥1 的整数', received: String(c.quantity) });
      return;
    }
    c.quantity = q;

    // 体积交叉校验（负体积/零体积在尺寸校验后不可能为负，仍防御）
    const vol = c.length * c.width * c.height;
    if (!(vol > 0)) {
      errors.push({ field: 'volume', index, message: `体积计算异常（${vol}）`, received: vol });
      return;
    }

    // 语义默认值（AI 模糊修正的确定性等价）：缺 stackable/canRotate/canLayFlat 时按包装类型赋安全值
    const pkgCanon = CANON(c.packagingType);
    const defaults = PACKAGING_DEFAULTS[pkgCanon] || PACKAGING_DEFAULTS.CARTON;
    if (c.stackable === undefined || c.stackable === null) {
      c.stackable = defaults.stackable;
      normalizationNotes.push(`[行${index}] 未填 stackable，按包装类型 ${c.packagingType || 'CARTON'} 自动赋 ${c.stackable}`);
    }
    if (c.canRotate === undefined || c.canRotate === null) {
      c.canRotate = defaults.canRotate;
      normalizationNotes.push(`[行${index}] 未填 canRotate，按包装类型自动赋 ${c.canRotate}`);
    }
    if (c.canLayFlat === undefined || c.canLayFlat === null) {
      c.canLayFlat = defaults.canLayFlat;
      normalizationNotes.push(`[行${index}] 未填 canLayFlat，按包装类型自动赋 ${c.canLayFlat}`);
    }
    c.stackable = c.stackable === true;
    c.canRotate = c.canRotate === true;
    c.canLayFlat = c.canLayFlat === true;
    if (c.wooden === undefined) c.wooden = defaults.wooden || /wood|pallet|木/i.test(String(c.packagingType || ''));
    if (!c.handlingMethod) c.handlingMethod = defaults.handling;
    if (c.fragile === true) { c.stackable = false; normalizationNotes.push(`[行${index}] 易碎品强制 stackable=false`); }
    if (c.portSequence === undefined || c.portSequence === null) { c.portSequence = 1; normalizationNotes.push(`[行${index}] 未填 portSequence，默认 1`); }

    cleaned.push(c);
  });

  return { ok: errors.length === 0, status: 400, errors, cargoList: cleaned, normalizationNotes };
}

module.exports = { validateIngestion, DIM_LIMITS, WEIGHT_LIMITS, PACKAGING_DEFAULTS };
