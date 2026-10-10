'use strict';
/**
 * uat_server.js — 平台 API 层 Mock Controller（与真实项目 /api/packing 契约一致）
 *
 * 契约来源：原项目 backend/routes/packing.js
 *   POST /api/packing/generate  { cargoList, containerType, containerMode, actualContainer, options... }
 *     → 200 { code:0?, message, data: { ...plan, digitalTwin }, ts }（经 UAT 中间件补 digitalTwin）
 *     → 400/404 { code, message, data, ts }
 *   POST /api/container/recommend { cargoList } → 原生推荐 + 熔断降级中间件
 *   GET  /healthz
 *
 * 中间件链（全部为 UAT 补丁，不触碰引擎内部）：
 *   IngestionValidator（防呆/默认值）→ Orchestrator（best_real_v1 引擎）→
 *   DigitalTwinSerializer（前端渲染 JSON）→ 错误边界（500 捕获，禁止堆栈泄漏）
 */

const express = require('express');
const path = require('path');
const { validateIngestion } = require('./middleware/IngestionValidator');
const { serializeForDigitalTwin } = require('./middleware/DigitalTwinSerializer');
const { RecommendationBreaker } = require('./middleware/RecommendationBreaker');
const { UatWorkerPool } = require('./uat_worker_pool');
const USE_POOL = process.env.UAT_DISABLE_POOL !== '1';
const AlgorithmOrchestrator = require('./backend/services/AlgorithmOrchestrator');

const CONTAINER_CATALOG = {
  '20GP': { typeId: '20GP', innerLength: 5898, innerWidth: 2352, innerHeight: 2393, maxWeight: 28300 },
  '40GP': { typeId: '40GP', innerLength: 12032, innerWidth: 2352, innerHeight: 2393, maxWeight: 26000 },
  '40HQ': { typeId: '40HQ', innerLength: 12032, innerWidth: 2352, innerHeight: 2698, maxWeight: 26000 }
};

function createUatApp({ orchestrator, breaker, pool } = {}) {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  const orch = orchestrator || new AlgorithmOrchestrator({
    cache: { get: async () => null, set: async () => {} },
    timeoutMs: 30000,
    debugMode: false
  });
  const breakerInst = breaker || new RecommendationBreaker();
  const computePool = pool || (USE_POOL ? new UatWorkerPool({ size: Number(process.env.UAT_POOL_SIZE || 6) }) : null);

  app.get('/healthz', (req, res) => {
    res.json({ ok: true, engine: 'best_real_v1', ts: Date.now() });
  });

  // ===== 原生契约：POST /api/packing/generate =====
  app.post('/api/packing/generate', async (req, res, next) => {
    const requestId = `REQ_UAT_${Date.now()}`;
    try {
      const {
        cargoList: submittedCargoList,
        containerType: containerTypeId,
        solver: requestedSolver,
        options: requestOptions = {},
        containerMode = 'REFERENCE_PROFILE',
        actualContainer = null,
        vgm = {},
        dangerousGoodsEvidence = {}
      } = req.body || {};

      // ---- [UAT 中间件 1] 录入防呆（400 精确字段错误 + AI 模糊修正等价默认值） ----
      const gate = validateIngestion(submittedCargoList);
      if (!gate.ok) {
        return res.status(400).json({
          code: 'INGESTION_VALIDATION_FAILED',
          message: `货物录入校验失败：${gate.errors.length} 项`,
          data: { errors: gate.errors, normalizationNotes: gate.normalizationNotes },
          ts: Date.now()
        });
      }
      const cargoList = gate.cargoList;

      // ---- 柜型解析（与原契约一致：REFERENCE_PROFILE / actualContainer） ----
      let container;
      if (containerMode === 'ACTUAL' && actualContainer && actualContainer.innerLength) {
        container = {
          typeId: actualContainer.typeId || 'ACTUAL',
          innerLength: Number(actualContainer.innerLength),
          innerWidth: Number(actualContainer.innerWidth),
          innerHeight: Number(actualContainer.innerHeight),
          maxWeight: Number(actualContainer.maxWeight || actualContainer.payload || 0)
        };
      } else {
        container = CONTAINER_CATALOG[containerTypeId || '40HQ'];
        if (!container) {
          return res.status(400).json({ code: 'UNKNOWN_CONTAINER', message: `未知柜型 ${containerTypeId}`, data: { allowed: Object.keys(CONTAINER_CATALOG) }, ts: Date.now() });
        }
      }

      // ---- [UAT 中间件 3] 整票载重红线（VGM/轴荷前置拦截） ----
      const declaredTotal = cargoList.reduce((s2, c) => s2 + Number(c.weight || 0) * Math.max(1, Number(c.quantity || 1)), 0);
      if (container.maxWeight > 0 && declaredTotal > container.maxWeight) {
        return res.status(400).json({
          code: 'MAX_PAYLOAD_EXCEEDED',
          message: `整票载重 ${declaredTotal.toFixed(0)}kg 超过 ${container.typeId} 载荷 ${container.maxWeight}kg（超出 ${(declaredTotal - container.maxWeight).toFixed(0)}kg）`,
          data: { totalWeightKg: Math.round(declaredTotal), maxPayloadKg: container.maxWeight, overloadKg: Math.round(declaredTotal - container.maxWeight), rule: 'VGM+SOLAS 载荷红线' },
          ts: Date.now()
        });
      }

      // ---- 危险品声明透传（原生引擎不隔离，作为证据随结果返回） ----
      const hasDangerous = dangerousGoodsEvidence && Object.keys(dangerousGoodsEvidence).length > 0;

      // ---- 引擎（best_real_v1） ----
      // [UAT-FIX] 柜型对象必须克隆后传入：下游引擎/求解器可能改写共享的
      // CATALOG 对象字段，污染后续请求（实测导致 93/212 退化布局）。
      const execOptions = { algorithmId: requestedSolver || (requestOptions.algorithmId || 'realistic4d-multi-strategy'), seed: 42 };
      const containerArg = { ...container };
      const result = computePool
        ? await computePool.run(cargoList, containerArg, execOptions)
        : await orch.execute({ cargoList, container: containerArg, options: execOptions });

      if (!result.success) {
        // OVERSIZE / UNKNOWN_ALGORITHM / PLAN_INVALID：与原契约一致的 400 结构
        return res.status(400).json({
          code: result.error && result.error.code || 'INTERNAL_ERROR',
          message: result.error && result.error.message || 'Packing failed',
          data: result.error || null,
          ts: Date.now()
        });
      }

      // ---- [UAT 中间件 2] 数字孪生序列化 ----
      const digitalTwin = serializeForDigitalTwin(result, container);

      // ---- VGM 证据透传（超载时的警示结构） ----
      const warnings = [...(result.warnings || [])];
      const totalWeight = result.totalWeight || 0;
      if (vgm && vgm.declaredVgm && container.maxWeight > 0) {
        const vgmTotal = Number(vgm.declaredVgm) + 2200; // tare
        if (vgmTotal > 30480) {
          warnings.push({ type: 'VGM_EXCEEDED', message: `VGM ${vgmTotal}kg 超过 maxGross 30480kg` });
        }
      }

      return res.json({
        code: 0,
        message: 'Packing plan generated',
        data: {
          success: true,
          requestId,
          containerSpec: container,
          metrics: result.metrics,
          spaceUtilization: result.spaceUtilization,
          loadedCargo: result.loadedCargo,
          unloadedCargo: result.unloadedCargo,
          totalWeight,
          warnings,
          dangerousGoodsEvidence: hasDangerous ? dangerousGoodsEvidence : null,
          cog: result.cog,
          cogOffset: result.cogOffset,
          validator: result.validator,
          constraintMeta: result.constraintMeta,
          normalizationNotes: gate.normalizationNotes,
          digitalTwin
        },
        ts: Date.now()
      });
    } catch (error) {
      // 500 边界：记录但不泄漏堆栈（防呆最后防线）
      console.error(`[${requestId}] 500:`, error.message);
      return res.status(500).json({ code: 'INTERNAL_ERROR', message: '内部错误，请检查货物数据后重试', data: null, ts: Date.now() });
    }
  });

  // ===== 推荐：原生 LLM/规则层 + 熔断降级中间件 =====
  app.post('/api/container/recommend', async (req, res) => {
    const t0 = Date.now();
    try {
      const out = await breakerInst.recommend(req.body && req.body.cargoList || []);
      return res.json({ code: 0, message: 'recommendation ready', data: { ...out, elapsedMs: Date.now() - t0, breakerState: breakerInst.state, lastFallbackReason: breakerInst.lastFallbackReason }, ts: Date.now() });
    } catch (error) {
      return res.status(500).json({ code: 'INTERNAL_ERROR', message: String(error.message || error), data: null, ts: Date.now() });
    }
  });

  return app;
}

module.exports = { createUatApp, CONTAINER_CATALOG };

if (require.main === module) {
  const app = createUatApp();
  const port = Number(process.env.UAT_PORT || 3789);
  app.listen(port, () => console.log(`UAT server listening on :${port}`));
}
