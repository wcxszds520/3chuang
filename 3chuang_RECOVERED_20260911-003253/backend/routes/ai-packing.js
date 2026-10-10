/**
 * Legacy URL compatibility for real local packing and optional AI explanations.
 * Formal geometry and compliance come from deterministic validators.
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ContainerType = require('../models/ContainerType');
const AIPackingService = require('../services/AIPackingService');

/**
 * POST /api/ai-packing/generate
 * 正式装箱兼容入口；利用率和耗时由本次真实计算决定。
 */
// Compatibility URL: the same normalized solver, independent validator and
// persistence contract as /packing/generate. AI is optional explanation only.
router.post('/generate', (req, res) => require('./packing').generatePacking(req, res));
/**
 * POST /api/ai-packing/validate-compliance
 * AI合规校验接口
 * 
 * 功能：对装箱方案进行宁波港2026年进港规则AI智能合规校验
 */
router.post('/validate-compliance', async (req, res) => {
  try {
    const { planId } = req.body;
    
    if (!planId) {
      return res.error('请提供方案ID', 400);
    }
    
    // 从数据库查询方案
    const planQuery = 'SELECT plan_data, container_type FROM packing_plan WHERE plan_id = ?';
    const [planRows] = await db.query(planQuery, [planId]);
    
    if (planRows.length === 0) {
      return res.error('方案不存在', 404);
    }
    
    // plan_data可能是字符串或对象，需要判断
    const planData = typeof planRows[0].plan_data === 'string' 
      ? JSON.parse(planRows[0].plan_data) 
      : planRows[0].plan_data;
    const containerType = planRows[0].container_type;
    
    // 查询柜型
    const containerQuery = 'SELECT * FROM container_type WHERE type_id = ?';
    const [containerRows] = await db.query(containerQuery, [containerType]);
    
    const containerTypeObj = new ContainerType({
      typeId: containerRows[0].type_id,
      name: containerRows[0].name,
      innerLength: containerRows[0].inner_length,
      innerWidth: containerRows[0].inner_width,
      innerHeight: containerRows[0].inner_height,
      maxWeight: containerRows[0].max_weight,
      description: containerRows[0].description
    });
    
    // 调用AI合规校验
    const aiService = new AIPackingService();
    const complianceReport = await aiService.validateCompliance(planData, containerTypeObj);
    
    // 更新数据库
    const updateQuery = `
      UPDATE packing_plan 
      SET compliance_status = ?, risk_level = ?
      WHERE plan_id = ?
    `;
    
    const riskLevel = complianceReport.complianceLevel === 'excellent' ? 'green' :
                     complianceReport.complianceLevel === 'good' ? 'green' :
                     complianceReport.complianceLevel === 'warning' ? 'yellow' : 'red';
    
    await db.query(updateQuery, [complianceReport.complianceLevel, riskLevel, planId]);
    
    res.success(complianceReport, 'AI合规校验完成');
    
  } catch (error) {
    console.error('AI合规校验失败:', error);
    res.error(`AI合规校验失败: ${error.message}`, 500);
  }
});

/**
 * POST /api/ai-packing/recognize-cargo
 * AI货物属性识别接口
 * 
 * 功能：根据货物名称、尺寸、重量，AI识别货物的装箱属性
 */
router.post('/recognize-cargo', async (req, res) => {
  try {
    const { name, length, width, height, weight } = req.body;
    
    if (!name || !length || !width || !height || !weight) {
      return res.error('请提供完整的货物信息', 400);
    }
    
    const aiService = new AIPackingService();
    const attributes = await aiService.recognizeCargoAttributes(
      name,
      { length, width, height },
      weight
    );
    
    res.success(attributes, 'AI货物属性识别完成');
    
  } catch (error) {
    console.error('AI货物识别失败:', error);
    res.error(`AI货物识别失败: ${error.message}`, 500);
  }
});

/**
 * POST /api/ai-packing/generate-presentation
 * AI路演讲解生成接口
 * 
 * 功能：为装箱方案生成1分钟以内的口语化路演讲解话术
 */
router.post('/generate-presentation', async (req, res) => {
  try {
    const { planId } = req.body;
    
    if (!planId) {
      return res.error('请提供方案ID', 400);
    }
    
    // 查询方案
    const planQuery = 'SELECT plan_data, container_type FROM packing_plan WHERE plan_id = ?';
    const [planRows] = await db.query(planQuery, [planId]);
    
    if (planRows.length === 0) {
      return res.error('方案不存在', 404);
    }
    
    // plan_data可能是字符串或对象，需要判断
    const planData = typeof planRows[0].plan_data === 'string' 
      ? JSON.parse(planRows[0].plan_data) 
      : planRows[0].plan_data;
    const containerType = planRows[0].container_type;
    
    // 查询柜型
    const containerQuery = 'SELECT * FROM container_type WHERE type_id = ?';
    const [containerRows] = await db.query(containerQuery, [containerType]);
    
    const containerTypeObj = new ContainerType({
      typeId: containerRows[0].type_id,
      name: containerRows[0].name,
      innerLength: containerRows[0].inner_length,
      innerWidth: containerRows[0].inner_width,
      innerHeight: containerRows[0].inner_height,
      maxWeight: containerRows[0].max_weight,
      description: containerRows[0].description
    });
    
    // 先进行合规校验
    const aiService = new AIPackingService();
    const complianceReport = await aiService.validateCompliance(planData, containerTypeObj);
    
    // 生成讲解话术
    const presentation = await aiService.generatePresentation(planData, containerTypeObj, complianceReport);
    
    res.success({
      presentation,
      complianceReport
    }, 'AI路演讲解生成完成');
    
  } catch (error) {
    console.error('AI讲解生成失败:', error);
    res.error(`AI讲解生成失败: ${error.message}`, 500);
  }
});


/**
 * POST /api/ai-packing/compare
 * 对比两个本地求解策略；不宣称 AI 改善几何结果。
 */
router.post('/compare', async (req, res) => {
  const candidates = [];
  for (const strategy of ['space', 'balance']) {
    let status = 200, payload;
    const capture = {
      status(value) { status = value; return this; },
      json(value) { payload = value; return this; },
      success(data, message) { payload = { code: 200, data, message }; return this; }
    };
    const started = performance.now();
    await require('./packing').generatePacking({ body: { ...req.body, strategy,
      options: { ...req.body.options, persist: false, includeAiExplanation: false } } }, capture);
    candidates.push({ strategy, status, elapsedMs: performance.now() - started,
      plan: status === 200 ? payload.data : null, error: status === 200 ? null : payload });
  }
  return res.success({ source: 'LOCAL_COMPUTATION', aiUsed: false, candidates,
    selectionPolicy: 'Compare independently validated plans; no promised utilization increase' }, '本地求解策略对照完成');
});
/**
 * POST /api/ai-packing/recommend-container
 * AI箱型推荐接口
 * 
 * 功能：根据货物清单，AI推荐Top 3最合适的集装箱型号
 * 降级：AI失败时使用本地规则推荐
 * 
 * 请求体：{ cargoList: [{ name, length, width, height, weight, quantity }] }
 * 响应：{ recommendations: [{ typeId, name, score, reason }] }
 */
router.post('/recommend-container', async (req, res) => {
  try {
    console.log('=== 集装箱推荐请求（纯算法决策）===');
    const { cargoList } = req.body;

    if (!cargoList || !Array.isArray(cargoList) || cargoList.length === 0) {
      return res.error('请提供货物清单（cargoList）', 400);
    }

    // 验证货物数据基本字段
    for (let i = 0; i < cargoList.length; i++) {
      const cargo = cargoList[i];
      if (!cargo.length || !cargo.width || !cargo.height || !cargo.weight) {
        return res.error(`货物 #${i + 1} 缺少必要字段（length/width/height/weight）`, 400);
      }
    }

    // v37.1: 完全用算法决策，不再调用 AI（AI 在多次测试中给出不一致甚至错误的推荐）
    // 决策依据：
    //   1) 真实可装容积 = 名义容积 × realUsableRatio
    //      ★ 关键：realUsableRatio 必须与装箱算法的实测物理极限一致（70%）
    //      之前设 0.80 导致 AI 把"理论 77%"判为"完美匹配"，但算法只能装 70% → 必然漏装
    //   2) 货物总体积 / (容积 × 0.70) > 1.0 → 该柜型溢出
    //   3) realUtil 甜区收窄到 50-75%（对应理论体积比 35-52%）
    //   4) 货物最大高度 > 2393 mm → 必须用 40HQ
    const containerSpecs = [
      { typeId: '20GP', name: '20尺标准柜', volume: 33.2, maxWeight: 21770, innerHeight: 2393, realUsableRatio: 0.70 },
      { typeId: '40GP', name: '40尺标准柜', volume: 67.7, maxWeight: 26000, innerHeight: 2393, realUsableRatio: 0.70 },
      { typeId: '40HQ', name: '40尺高柜', volume: 76.3, maxWeight: 26000, innerHeight: 2698, realUsableRatio: 0.70 }
    ];

    let totalVolume = 0;
    let totalWeight = 0;
    let maxCargoHeight = 0;
    for (const c of cargoList) {
      const qty = c.quantity || 1;
      totalVolume += (c.length * c.width * c.height / 1e9) * qty;
      totalWeight += (c.weight || 0) * qty;
      if (c.height > maxCargoHeight) maxCargoHeight = c.height;
    }

    const recommendations = containerSpecs.map(spec => {
      const usable = spec.volume * spec.realUsableRatio;
      const heightExceeds = maxCargoHeight > spec.innerHeight;
      const willOverflow = totalVolume > usable || totalWeight > spec.maxWeight || heightExceeds;

      if (willOverflow) {
        if (heightExceeds) {
          return {
            typeId: spec.typeId,
            name: spec.name,
            score: 20,
            reason: `⚠️ 货物最高 ${maxCargoHeight}mm，超过${spec.name}内高 ${spec.innerHeight}mm，无法装入`
          };
        }
        const overflowRatio = Math.max(
          totalVolume / Math.max(usable, 0.01) - 1,
          totalWeight / Math.max(spec.maxWeight, 0.01) - 1,
          0
        );
        const overflowPct = Math.min(99, Math.round(overflowRatio * 100));
        return {
          typeId: spec.typeId,
          name: spec.name,
          score: 30,
          reason: `⚠️ 容量不足，约 ${overflowPct}% 货物装不下，建议升级更大柜型`
        };
      }

      // 装得下 → 按真实装载率（货物体积 / 真实可装容积）打分
      // realUtil 越接近 1.0 越满，但需留 5-10% 安全冗余给算法搜索
      const realUtil = totalVolume / usable;
      const theoUtilPct = (totalVolume / spec.volume * 100).toFixed(0);
      let score;
      let reason;
      if (realUtil >= 0.95) {
        // 极限边缘，算法可能因 NP-Hard 搜索不到最优解而漏装 → 仅 80 分提示风险
        score = 80;
        reason = `理论装载率 ${theoUtilPct}%，柜型已接近极限，可能少量货物需拆分`;
      } else if (realUtil >= 0.75) {
        // 甜区：货物 / 真实可装 = 75-95%，算法 100% 装入概率最高
        score = 95;
        reason = `理论装载率 ${theoUtilPct}%，柜型与货物完美匹配，性价比最佳`;
      } else if (realUtil >= 0.55) {
        score = 85;
        reason = `理论装载率 ${theoUtilPct}%，柜型适配度高，留有适度缓冲`;
      } else if (realUtil >= 0.35) {
        score = 70;
        reason = `理论装载率 ${theoUtilPct}%，柜型偏大但能装下全部货物`;
      } else if (realUtil >= 0.2) {
        score = 55;
        reason = `理论装载率 ${theoUtilPct}%，柜型空间富余较多，运费偏高`;
      } else {
        score = 40;
        reason = `理论装载率 ${theoUtilPct}%，柜型过大严重浪费`;
      }

      return { typeId: spec.typeId, name: spec.name, score, reason, _rawUtil: realUtil };
    }).map((rec, idx, arr) => {
      // v37.7: 高柜自适应扣分
      // 仅当 40GP 也能 100% 装下时（≥85分），40HQ 才因"对矮货物高度浪费"扣 8 分
      // 否则 40HQ 是唯一可行 → 不扣分（避免误导用户选不能装的 40GP）
      if (rec.typeId === '40HQ') {
        const gp40 = arr.find(r => r.typeId === '40GP');
        const gp40Viable = gp40 && gp40.score >= 85;
        if (maxCargoHeight > 2393) {
          // 高货物必须用 40HQ
          rec.score = Math.min(99, rec.score + 8);
        } else if (gp40Viable) {
          // 矮货物且 40GP 也能装 → 40HQ 浪费高度
          rec.score = Math.max(40, rec.score - 8);
        }
        // gp40Viable=false 且无高货物 → 不调整（40HQ 是唯一选项）
      }
      delete rec._rawUtil;
      return rec;
    }).sort((a, b) => b.score - a.score);

    const result = {
      recommendations,
      summary: `共 ${cargoList.length} 种 SKU，总体积 ${totalVolume.toFixed(2)}m³，总重 ${totalWeight.toFixed(0)}kg`,
      fallback: false
    };

    console.log('集装箱推荐完成（算法）:', recommendations.map(r => `${r.typeId}(${r.score})`).join(', '));
    res.success(result, '柜型推荐完成');

  } catch (error) {
    console.error('柜型推荐失败:', error);
    res.error(`柜型推荐失败: ${error.message}`, 500);
  }
});

/**
 * POST /api/ai-packing/explain-result
 * AI装箱结果解释接口
 * 
 * 功能：对装箱结果生成 ≤ 200 字中文解释（为什么这样装、利用率分析、风险点）
 * 降级：AI失败时使用本地模板生成解释
 * 
 * 请求体：{ packingResult: { loadedCargo, unloadedCargo, spaceUtilization, totalWeight, ... } }
 * 响应：{ explanation, highlights, risks, fallback }
 */
router.post('/explain-result', async (req, res) => {
  try {
    console.log('=== AI结果解释请求 ===');
    const { packingResult } = req.body;

    if (!packingResult || typeof packingResult !== 'object') {
      return res.error('请提供装箱结果（packingResult）', 400);
    }

    const aiService = new AIPackingService();
    const result = await aiService.explainResult(packingResult);

    console.log('AI结果解释完成, fallback:', result.fallback);
    res.success(result, 'AI结果解释完成');

  } catch (error) {
    console.error('AI结果解释失败:', error);
    res.error(`AI结果解释失败: ${error.message}`, 500);
  }
});

/**
 * POST /api/ai-packing/generate-strategy
 * AI策略建议接口
 * 
 * 功能：装箱前根据货物和箱型生成排序/装载策略建议（8秒内返回）
 * 降级：AI失败时使用本地规则策略
 * 
 * 请求体：{ cargoList: [...], container: { typeId, name, innerLength, innerWidth, innerHeight, maxWeight } }
 * 响应：{ strategy, sortSuggestion, reasoning, expectedUtilization, fallback }
 */
router.post('/generate-strategy', async (req, res) => {
  try {
    console.log('=== AI策略建议请求 ===');
    const { cargoList, container } = req.body;

    if (!cargoList || !Array.isArray(cargoList) || cargoList.length === 0) {
      return res.error('请提供货物清单（cargoList）', 400);
    }

    if (!container || typeof container !== 'object') {
      return res.error('请提供集装箱信息（container）', 400);
    }

    const aiService = new AIPackingService();
    const result = await aiService.generateStrategy(cargoList, container);

    console.log('AI策略建议完成, fallback:', result.fallback);
    res.success(result, 'AI策略建议完成');

  } catch (error) {
    console.error('AI策略建议失败:', error);
    res.error(`AI策略建议失败: ${error.message}`, 500);
  }
});

module.exports = router;


// Legacy presets invented cargo totals and compliance. Preserve no live route
// that could promote those illustrative values into a computed result.
router.get(['/demo/preset-plan', '/demo/preset-compliance', '/demo/preset-presentation'], (req, res) => {
  res.status(410).json({ code: 'PRESET_RESULT_RETIRED', message: '预设成功结果已停用，请从真实货单生成方案', data: null });
});
