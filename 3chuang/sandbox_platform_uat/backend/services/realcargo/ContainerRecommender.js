'use strict';
/**
 * ContainerRecommender — 柜型推荐 Adapter（包裹项目原生 LLM/规则推荐层）
 *
 * 原生层：AIPackingService.recommendContainers（LLM → 语义缓存 → 离线预录 → 规则降级）
 *   已知局限（本 Adapter 修正）：
 *   1. 规则降级仅用总体积/总重阈值（<25m³→20GP），无地面面积（Floor Area）约束——
 *      会把地板装不下的不可堆叠托盘推荐进 20GP；
 *   2. 未做逐柜型几何可行性核验（重量/体积/地板/门宽）。
 *
 * Adapter 职责：
 *   1. 透传调用原生推荐（记录 provenance：llm-attempted / rule-fallback / offline）；
 *   2. 对每个候选柜型做可行性核验（体积/载重/地板面积/门尺寸）；
 *   3. 原生推荐可行 → 采纳原生结果；不可行 → 按几何可行集合重选并给出理由；
 *   4. 输出体积利用率与地面利用率双指标（商业降本审计口径）。
 */

const AIPackingService = require('../AIPackingService');

// 标准箱型（与容器目录/真实船公司参考规格一致的净尺寸）
const CATALOG = {
  '20GP': { typeId: '20GP', name: '20尺标准柜', innerLength: 5898, innerWidth: 2352, innerHeight: 2393, maxWeight: 28300, doorWidth: 2340, doorHeight: 2280 },
  '40GP': { typeId: '40GP', name: '40尺标准柜', innerLength: 12032, innerWidth: 2352, innerHeight: 2393, maxWeight: 26000, doorWidth: 2340, doorHeight: 2280 },
  '40HQ': { typeId: '40HQ', name: '40尺高柜', innerLength: 12032, innerWidth: 2352, innerHeight: 2698, maxWeight: 26000, doorWidth: 2340, doorHeight: 2580 }
};
const TYPE_ORDER = ['20GP', '40GP', '40HQ'];

function analyzeFeasibility(cargoList, ct) {
  const floorArea = ct.innerLength * ct.innerWidth;
  const volume = ct.innerLength * ct.innerWidth * ct.innerHeight;
  let totalVolume = 0;
  let totalWeight = 0;
  let floorNeeded = 0; // 有效地板需求（可堆叠件按层数摊薄）
  let maxCrossSection = 0; // 最大单件迎门截面（宽×高，门宽校验用）
  let pieces = 0;
  for (const c of cargoList) {
    const qty = Math.max(1, Number(c.quantity || 1));
    const l = Number(c.length || 0);
    const w = Number(c.width || 0);
    const h = Number(c.height || 0);
    const weight = Number(c.weight || 0) * qty;
    totalVolume += (l * w * h * qty) / 1e9;
    totalWeight += weight;
    pieces += qty;
    const stackable = c.stackable !== false;
    const maxLayers = Math.max(1, Number(c.maxStackLayers || 1));
    const effectiveLayers = stackable ? Math.max(1, Math.min(maxLayers, Math.floor(ct.innerHeight / Math.max(1, h)))) : 1;
    floorNeeded += (l * w * qty) / effectiveLayers;
    maxCrossSection = Math.max(maxCrossSection, Math.min(w, ct.innerWidth) * Math.min(h, ct.innerHeight));
  }
  const volumeUtil = totalVolume / (volume / 1e9);
  const weightUtil = totalWeight / ct.maxWeight;
  const floorUtil = floorNeeded / floorArea;
  const reasons = [];
  let feasible = true;
  if (totalVolume > (volume / 1e9) * 0.995) { feasible = false; reasons.push(`总体积 ${totalVolume.toFixed(2)}m³ 超柜容`); }
  if (totalWeight > ct.maxWeight) { feasible = false; reasons.push(`总重 ${totalWeight.toFixed(0)}kg 超载重 ${ct.maxWeight}kg`); }
  if (floorNeeded > floorArea * 0.99) { feasible = false; reasons.push(`有效地板需求 ${(floorNeeded / 1e6).toFixed(2)}m² 超地板 ${(floorArea / 1e6).toFixed(2)}m²`); }
  return {
    typeId: ct.typeId,
    feasible,
    infeasibleReasons: reasons,
    volumeUtil: Math.round(volumeUtil * 1000) / 1000,
    weightUtil: Math.round(weightUtil * 1000) / 1000,
    floorUtil: Math.round(floorUtil * 1000) / 1000,
    totalVolume: Math.round(totalVolume * 100) / 100,
    totalWeight: Math.round(totalWeight),
    pieces,
    doorNote: maxCrossSection > ct.doorWidth * ct.doorHeight ? '单件截面接近门尺寸，需旋转入柜' : null
  };
}

class ContainerRecommender {
  constructor({ aiService } = {}) {
    this.ai = aiService || new AIPackingService();
  }

  /**
   * @returns {{ native: Object, analysis: Array, chosen: Object, provenance: string,
   *             overrideReason?: string, cargoSummary: Object }}
   */
  async recommend(cargoList, options = {}) {
    const types = options.catalog || CATALOG;
    // 1) 原生推荐层（LLM 未配 Key 时为项目设计的规则降级，确定性）
    let native = null;
    try {
      native = await this.ai.recommendContainers(cargoList);
    } catch (e) {
      native = { recommendations: [], fallback: true, nativeError: String(e.message || e) };
    }
    const nativeTop = (native.recommendations && native.recommendations[0]) || null;

    // 2) 逐柜型几何可行性核验（含地面面积约束）
    const analysis = TYPE_ORDER.map((t) => analyzeFeasibility(cargoList, types[t]));
    const feasible = analysis.filter((a) => a.feasible);

    // 3) 决策：最小可行柜（体积最小 → 利用率最高；与原生推荐一致则采纳原生）
    const sorted = [...feasible].sort((a, b) => {
      const orderDiff = TYPE_ORDER.indexOf(a.typeId) - TYPE_ORDER.indexOf(b.typeId);
      if (orderDiff !== 0) return orderDiff; // 20GP < 40GP < 40HQ（体积递增）
      return b.volumeUtil - a.volumeUtil;
    });
    const smallestFeasible = sorted[0] || null;
    const nativeFeasible = nativeTop ? analysis.find((a) => a.typeId === nativeTop.typeId && a.feasible) : null;

    let chosen = null;
    let provenance = '';
    let overrideReason = null;
    if (nativeTop && nativeFeasible && nativeTop.typeId === (smallestFeasible && smallestFeasible.typeId)) {
      chosen = smallestFeasible;
      provenance = native.fallback ? 'native-rule-fallback (floor-verified)' : 'native-llm (floor-verified)';
    } else if (nativeTop && nativeFeasible) {
      // 原生可行但非最小柜：采纳原生排序中的最优可行者（保守，尊重原生排序）
      chosen = nativeFeasible;
      provenance = native.fallback ? 'native-rule-fallback (floor-verified)' : 'native-llm (floor-verified)';
    } else if (smallestFeasible) {
      chosen = smallestFeasible;
      provenance = 'adapter-override (native recommendation geometrically infeasible)';
      overrideReason = nativeTop
        ? `原生推荐 ${nativeTop.typeId} 不可行：${(analysis.find((a) => a.typeId === nativeTop.typeId) || {}).infeasibleReasons?.join('；') || '几何不可行'}`
        : '原生层未给出可行推荐';
    } else {
      chosen = analysis.find((a) => a.typeId === '40HQ'); // 兜底最大柜
      provenance = 'adapter-fallback-40HQ';
      overrideReason = '无几何可行柜型（货物超限）';
    }

    const ct = types[chosen.typeId];
    return {
      native: {
        recommendations: native.recommendations || [],
        fallback: native.fallback === true,
        nativeError: native.nativeError || null,
        cacheHit: native.cacheHit === true
      },
      analysis,
      chosen: { ...chosen, container: ct },
      provenance,
      overrideReason,
      cargoSummary: {
        pieces: analysis[0] ? analysis[0].pieces : cargoList.reduce((s, c) => s + Math.max(1, Number(c.quantity || 1)), 0),
        totalVolumeM3: analysis[0] ? analysis[0].totalVolume : null,
        totalWeightKg: analysis[0] ? analysis[0].totalWeight : null
      }
    };
  }
}

module.exports = { ContainerRecommender, analyzeFeasibility, CATALOG };
