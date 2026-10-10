'use strict';
/**
 * RecommendationBreaker — LLM 选柜熔断降级中间件（UAT 补丁）
 *
 * 发现（UAT Suite D）：原生 AIPackingService._callAI 的 axios 超时为 15s——
 * LLM 端点挂起时，选柜请求最长阻塞 15s，超出「2s 内静默降级」的产品要求。
 *
 * 本中间件以 Adapter 形态包裹原生服务（不改动原生代码）：
 *  1. 每次 LLM 调用与 2s 定时器竞速；
 *  2. 超时/错误 → 熔断器置 open（连续 threshold 次），冷却 60s 内直接走本地规则降级；
 *  3. 规则降级复用原生 `_getLocalContainerRecommendations`（阈值规则，确定性），
 *     并叠加几何可行性核验（与 ContainerRecommender 同口径）。
 */

const AIPackingService = require('../backend/services/AIPackingService');
const { analyzeFeasibility, CATALOG } = require('../backend/services/realcargo/ContainerRecommender');

const FALLBACK_BUDGET_MS = 2000; // 产品要求：LLM 挂起 2s 内降级
const BREAKER_THRESHOLD = 1;     // 1 次超时即熔断（UAT 场景从紧）
const BREAKER_COOLDOWN_MS = 60000;

class RecommendationBreaker {
  constructor({ aiService, budgetMs = FALLBACK_BUDGET_MS } = {}) {
    this.ai = aiService || new AIPackingService();
    this.budgetMs = budgetMs;
    this.state = 'closed'; // closed | open
    this.openedAt = 0;
    this.timeouts = 0;
    this.lastFallbackReason = null;
  }

  _ruleFallback(cargoList) {
    // 与原生 _getLocalContainerRecommendations 同口径：体积/重量阈值 → 20GP/40GP/40HQ
    const totalVolume = cargoList.reduce((s, c) => s + ((c.length || 0) * (c.width || 0) * (c.height || 0) * Math.max(1, c.quantity || 1)) / 1e9, 0);
    const totalWeight = cargoList.reduce((s, c) => s + (c.weight || 0) * Math.max(1, c.quantity || 1), 0);
    const containerTypes = [
      { typeId: '20GP', name: '20尺标准柜', innerLength: 5898, innerWidth: 2352, innerHeight: 2393, maxWeight: 26000 },
      { typeId: '40GP', name: '40尺标准柜', innerLength: 12032, innerWidth: 2352, innerHeight: 2393, maxWeight: 26000 },
      { typeId: '40HQ', name: '40尺高柜', innerLength: 12032, innerWidth: 2352, innerHeight: 2698, maxWeight: 26000 }
    ];
    const analysis = containerTypes.map((ct) => ({ ...analyzeFeasibility(cargoList, { ...CATALOG[ct.typeId], maxWeight: ct.maxWeight }), name: ct.name }));
    let bestFit;
    if (totalVolume < 25 && totalWeight < 21770) bestFit = '20GP';
    else if (totalVolume < 55 && totalWeight < 26000) bestFit = '40GP';
    else bestFit = '40HQ';
    // 地面面积可行性核验：不可行顺延到下一档
    const rank = [bestFit, ...TYPE_ORDER_FALLBACK(bestFit)];
    let chosen = rank.find((t) => analysis.find((a) => a.typeId === t && a.feasible)) || '40HQ';
    const recommendations = analysis
      .sort((a, b) => (a.typeId === chosen ? -1 : b.typeId === chosen ? 1 : 0))
      .map((a) => ({
        typeId: a.typeId,
        name: a.name,
        score: a.typeId === chosen ? 92 : a.feasible ? 65 : 30,
        reason: a.feasible
          ? `体积 ${a.totalVolume}m³/载重 ${a.totalWeight}kg 可行，体积利用率 ${(a.volumeUtil * 100).toFixed(1)}%`
          : `不可行：${(a.infeasibleReasons || []).join('；') || '几何不可行'}`
      }));
    return { recommendations, fallback: true, breaker: true };
  }

  async recommend(cargoList) {
    const now = Date.now();
    if (this.state === 'open' && now - this.openedAt < BREAKER_COOLDOWN_MS) {
      this.lastFallbackReason = 'breaker-open';
      return this._ruleFallback(cargoList);
    }
    if (this.state === 'open') { this.state = 'closed'; this.timeouts = 0; } // 冷却结束，半开试探

    let timer = null;
    try {
      const native = await Promise.race([
        this.ai.recommendContainers(cargoList),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('LLM_BUDGET_EXCEEDED')), this.budgetMs);
        })
      ]);
      clearTimeout(timer);
      // 原生返回仍需几何核验（避免 LLM/规则给出不可行柜）
      const analysis = TYPE_ORDER.map((t) => analyzeFeasibility(cargoList, CATALOG[t]));
      const nativeTop = native.recommendations && native.recommendations[0];
      const topOk = nativeTop && analysis.find((a) => a.typeId === nativeTop.typeId && a.feasible);
      if (topOk) return { ...native, floorVerified: true };
      return { ...this._ruleFallback(cargoList), overrideReason: topOk ? null : `原生推荐 ${nativeTop ? nativeTop.typeId : '无'} 几何不可行` };
    } catch (error) {
      if (timer) clearTimeout(timer);
      this.timeouts++;
      if (error.message === 'LLM_BUDGET_EXCEEDED' || this.timeouts >= BREAKER_THRESHOLD) {
        this.state = 'open';
        this.openedAt = Date.now();
      }
      this.lastFallbackReason = String(error.message || error).slice(0, 120);
      return this._ruleFallback(cargoList);
    }
  }
}

function TYPE_ORDER_FALLBACK(best) {
  return best === '20GP' ? ['40GP', '40HQ'] : best === '40GP' ? ['20GP', '40HQ'] : ['40GP', '20GP'];
}

const TYPE_ORDER = ['20GP', '40GP', '40HQ'];

module.exports = { RecommendationBreaker, FALLBACK_BUDGET_MS };
