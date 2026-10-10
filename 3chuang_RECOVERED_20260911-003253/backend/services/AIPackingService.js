/**
 * AI装箱服务 - 提供4项AI赋能核心功能
 * 
 * 功能列表：
 * 1. AI动态调优装箱算法引擎
 * 2. 宁波港进港规则AI智能合规校验
 * 3. 货物属性AI智能识别与适配
 * 4. 装箱方案AI智能讲解
 * 5. AI推荐箱型
 * 6. AI结果解释
 * 
 * AI模型：DeepSeek V3 / 通义千问（国内免费API）
 * 
 * 语义缓存：相同 cargo hash 命中时直接返回（Requirements: 4.4）
 * 离线降级：Demo_Mode 断网时使用预录响应（Requirements: 4.7, 13.4）
 */

const axios = require('axios');
const crypto = require('crypto');
const { DeterministicComplianceEngine } = require('./compliance/DeterministicComplianceEngine');

class AIPackingService {
  constructor() {
    // AI API配置（优先使用DeepSeek V3）
    this.apiKey = process.env.AI_API_KEY || '';
    this.apiEndpoint = process.env.AI_API_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions';
    this.model = process.env.AI_MODEL || 'deepseek-chat';
    
    // 本地规划参考阈值（不代表港口许可）
    this.ningboPortRules = {
      maxWeightDeviation: 10, // 前后重心偏差≤10%柜长
      maxWidthDeviation: 5,   // 左右重心偏差≤5%柜宽
      overweightThreshold: 1.0, // 超重阈值（倍数）
      stackingRiskFactors: ['高度差异大', '重量分布不均', '底部支撑不足']
    };

    // ===== 语义缓存配置 (Requirement 4.4) =====
    // Map<cargoHash, { result, timestamp }>
    this._semanticCache = new Map();
    // 缓存 TTL：10 分钟
    this._cacheTTL = 10 * 60 * 1000;
    // 最大缓存条目数
    this._maxCacheSize = 100;

    // ===== 离线模式配置 (Requirement 4.7, 13.4) =====
    this._demoMode = process.env.DEMO_MODE === 'true' || false;
    this._offlineMode = false;
  }

  // ==================== 语义缓存方法 ====================

  /**
   * 计算货物列表的语义 hash
   * 将 cargo list 按 cargoId 排序后 JSON.stringify，再 MD5 hash
   * @param {Array} cargoList - 货物清单
   * @returns {string} MD5 hash
   */
  computeCargoHash(cargoList) {
    if (!cargoList || cargoList.length === 0) return 'empty';
    
    // 按 cargoId（或 name 作为 fallback）排序，确保相同货物列表产生相同 hash
    const sorted = [...cargoList].sort((a, b) => {
      const idA = a.cargoId || a.name || '';
      const idB = b.cargoId || b.name || '';
      return idA.localeCompare(idB);
    });

    return this._factHash(sorted);
  }

  _factHash(value) {
    const canonical = item => Array.isArray(item) ? item.map(canonical)
      : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
    return crypto.createHash('md5').update(JSON.stringify(canonical(value))).digest('hex');
  }

  _cacheKey(kind, facts) {
    return `${kind}:${this._factHash({ facts, model: this.model, endpoint: this.apiEndpoint,
      configured: Boolean(this.apiKey), offline: this._offlineMode, demo: this._demoMode, version: 2 })}`;
  }

  _local(result) { return { ...result, source: 'LOCAL_RULES', aiUsed: false, fallback: true }; }

  /**
   * 从语义缓存获取结果
   * @param {string} cacheKey - 缓存 key（格式: type:hash）
   * @returns {Object|null} 缓存结果或 null
   */
  _getCached(cacheKey) {
    const entry = this._semanticCache.get(cacheKey);
    if (!entry) return null;

    // 检查 TTL
    if (Date.now() - entry.timestamp > this._cacheTTL) {
      this._semanticCache.delete(cacheKey);
      return null;
    }

    return structuredClone(entry.result);
  }

  /**
   * 写入语义缓存
   * @param {string} cacheKey - 缓存 key
   * @param {Object} result - 缓存结果
   */
  _setCache(cacheKey, result) {
    // 超过最大条目数时清理最旧的
    if (this._semanticCache.size >= this._maxCacheSize) {
      const firstKey = this._semanticCache.keys().next().value;
      this._semanticCache.delete(firstKey);
    }

    this._semanticCache.set(cacheKey, {
      result: structuredClone(result),
      timestamp: Date.now()
    });
  }

  /**
   * 清除所有语义缓存
   */
  clearCache() {
    this._semanticCache.clear();
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} { size, maxSize, ttlMs }
   */
  getCacheStats() {
    return {
      size: this._semanticCache.size,
      maxSize: this._maxCacheSize,
      ttlMs: this._cacheTTL
    };
  }

  // ==================== 离线模式方法 ====================

  /**
   * 设置离线模式
   * @param {boolean} enabled
   */
  setOfflineMode(enabled) {
    this._offlineMode = !!enabled;
    console.log(`AI离线模式: ${this._offlineMode ? '已开启' : '已关闭'}`);
  }

  /**
   * 设置 Demo 模式
   * @param {boolean} enabled
   */
  setDemoMode(enabled) {
    this._demoMode = !!enabled;
    console.log(`AI Demo模式: ${this._demoMode ? '已开启' : '已关闭'}`);
  }

  /**
   * 检测是否应使用离线模式
   * @returns {boolean}
   */
  _shouldUseOffline() {
    return this._offlineMode || this._demoMode;
  }

  /**
   * AI赋能功能1：AI动态调优装箱算法引擎
   * 
   * 输入：货物列表、柜型参数
   * 输出：AI优化后的装箱优先级策略（JSON格式）
   */
  async optimizePackingStrategy(cargoList, containerType) {
    console.log('AI调优：开始分析货物特征...');

    
    // 分析货物特征
    const cargoAnalysis = this._analyzeCargoCharacteristics(cargoList, containerType);
    
    // 构建AI提示词
    const prompt = this._buildOptimizationPrompt(cargoAnalysis, containerType);
    
    try {
      // 调用AI API
      const aiResponse = await this._callAI(prompt);
      
      // 解析AI返回的策略
      const strategy = this._parseOptimizationStrategy(aiResponse);
      
      console.log('AI调优：策略生成成功');
      return strategy;
    } catch (error) {
      console.error('AI调优失败，使用默认策略:', error.message);
      // 降级：返回基于规则的默认策略
      return this._getDefaultStrategy(cargoList);
    }
  }

  /**
   * 🆕 AI深度策略分析（新增功能）
   * 
   * 根据货物和集装箱特征，让AI进行深度分析并生成详细的装箱策略
   * 包括：货物排序、分组、分层、空间分配等
   * 
   * @param {Array} cargoList - 货物列表
   * @param {Object} containerType - 集装箱类型
   * @returns {Object} 详细的装箱策略
   */
  async analyzePackingStrategy(cargoList, containerType) {
    console.log('🤖 AI深度分析：开始分析货物和集装箱...');
    
    // 1. 详细分析货物特征
    const detailedAnalysis = this._buildDetailedCargoAnalysis(cargoList, containerType);
    
    // 2. 构建深度分析提示词
    const prompt = this._buildDeepAnalysisPrompt(detailedAnalysis, cargoList, containerType);
    
    try {
      // 3. 调用AI进行深度分析
      const aiResponse = await this._callAI(prompt, 3000); // 增加token限制
      
      // 4. 解析AI策略
      const strategy = this._parseDeepStrategy(aiResponse);
      
      console.log('🤖 AI深度分析：策略生成成功');
      console.log('   - 装载顺序:', strategy.loadingOrder);
      console.log('   - 分层策略:', strategy.layerStrategy);
      console.log('   - 预期利用率:', strategy.expectedUtilization);
      
      return strategy;
    } catch (error) {
      console.error('🤖 AI深度分析失败:', error.message);
      // 降级：使用智能规则策略
      return this._getIntelligentFallbackStrategy(cargoList, containerType);
    }
  }

  /**
   * AI赋能功能2：宁波港进港规则AI智能合规校验
   * 
   * 输入：装箱方案数据
   * 输出：AI合规校验报告（JSON格式）
   */
  async validateCompliance(plan, containerType) {
    // The model may explain evidence; it has no authority over the verdict.
    const metrics = this._calculateComplianceMetrics(plan, containerType);
    const deterministic = new DeterministicComplianceEngine().evaluate({ ...plan,
      containerInfo: containerType, loadedCargo: metrics.placements,
      totalWeight: metrics.massKnown ? metrics.totalWeight : null,
      cogOffset: metrics.geometryKnown && metrics.massKnown ? {
        lateral: metrics.leftRightDeviation, longitudinal: metrics.frontBackDeviation
      } : {} });
    const report = {
      ...deterministic, metrics, complianceLevel: deterministic.status === 'FAIL' ? 'fail' : 'warning',
      overallScore: deterministic.score, risks: deterministic.issues,
      summary: deterministic.status === 'FAIL' ? '确定性检查发现阻断项' : '规划检查完成；出运证据仍需复核',
      source: 'LOCAL_RULES', aiUsed: false, authority: 'DETERMINISTIC_RULES', fallback: true
    };
    try {
      const response = await this._callAI(`仅解释以下确定性报告，不得改变状态、评分或证据。返回JSON {"explanation":"中文说明"}。${JSON.stringify(report)}`);
      const parsed = JSON.parse(response);
      if (typeof parsed.explanation === 'string' && parsed.explanation.trim()) {
        report.aiExplanation = { text: parsed.explanation.slice(0, 1000), authority: 'EXPLANATION_ONLY', model: this.model };
        report.aiUsed = true;
        report.fallback = false;
      }
    } catch { /* Local evidence remains authoritative when the provider is unavailable. */ }
    return report;
  }


  /**
   * AI赋能功能3：货物属性AI智能识别与适配
   * 
   * 输入：货物名称、尺寸、重量
   * 输出：AI识别的货物属性（JSON格式）
   */
  async recognizeCargoAttributes(cargoName, dimensions, weight) {
    console.log(`AI识别：分析货物 "${cargoName}"...`);
    
    // 检查是否为宁波港高频货型（仍需人工核对）
    const knownAttributes = this._getKnownCargoAttributes(cargoName);
    if (knownAttributes) {
      console.log('AI识别：匹配到高频货型，使用预设属性');
      return knownAttributes;
    }
    
    // 构建AI提示词
    const prompt = this._buildRecognitionPrompt(cargoName, dimensions, weight);
    
    try {
      // 调用AI API
      const aiResponse = await this._callAI(prompt);
      
      // 解析AI返回的属性
      const attributes = this._parseCargoAttributes(aiResponse);
      
      console.log('AI识别：属性识别成功');
      return attributes;
    } catch (error) {
      console.error('AI识别失败，使用默认属性:', error.message);
      // 降级：返回保守的默认属性
      return this._getDefaultCargoAttributes();
    }
  }

  /**
   * AI赋能功能4：装箱方案AI智能讲解（路演专属）
   * 
   * 输入：装箱方案数据、合规校验报告
   * 输出：1分钟以内的口语化讲解话术（纯文本）
   */
  async generatePresentation(plan, containerType, complianceReport) {
    console.log('AI讲解：生成路演话术...');
    
    // 提取关键指标
    const highlights = this._extractHighlights(plan, containerType, complianceReport);
    
    // 构建AI提示词
    const prompt = this._buildPresentationPrompt(highlights);
    
    try {
      // 调用AI API
      const aiResponse = await this._callAI(prompt);
      
      // 提取讲解话术
      const presentation = this._extractPresentation(aiResponse);
      
      console.log('AI讲解：话术生成成功');
      return presentation;
    } catch (error) {
      console.error('AI讲解失败，使用模板话术:', error.message);
      // 降级：返回基于模板的话术
      return this._getTemplatePresentation(highlights);
    }
  }


  /**
   * AI赋能功能5：AI推荐箱型
   * 
   * 输入：货物清单
   * 输出：Top 3 箱型推荐（每个含 score 0-100 + reason ≤ 80 字）
   * 降级：AI 失败时根据货物总体积/总重量用简单规则推荐
   * 离线模式：断网时使用预录响应返回 fallback = true
   * 语义缓存：相同 cargo hash 命中时直接返回
   * 
   * @param {Array} cargoList - 货物清单
   * @returns {Object} { recommendations: [{ typeId, name, score, reason }], fallback?: boolean }
   */
  async recommendContainers(cargoList) {
    console.log('AI推荐箱型：开始分析货物清单...');

    // 计算语义 hash
    const cargoHash = this.computeCargoHash(cargoList);
    const cacheKey = this._cacheKey('recommend', cargoHash);

    // 1. 检查语义缓存
    const cached = this._getCached(cacheKey);
    if (cached) {
      console.log('AI推荐箱型：命中语义缓存');
      return { ...cached, cacheHit: true };
    }


    // 可用箱型定义
    const containerTypes = [
      { typeId: '20GP', name: '20尺标准柜', innerLength: 5898, innerWidth: 2352, innerHeight: 2393, maxWeight: 26000 },
      { typeId: '40GP', name: '40尺标准柜', innerLength: 12032, innerWidth: 2352, innerHeight: 2393, maxWeight: 26000 },
      { typeId: '40HQ', name: '40尺高柜', innerLength: 12032, innerWidth: 2352, innerHeight: 2698, maxWeight: 26000 }
    ];

    // 计算货物总体积和总重量
    const totalVolume = cargoList.reduce((sum, c) => {
      const l = c.length || 0;
      const w = c.width || 0;
      const h = c.height || 0;
      const qty = c.quantity || 1;
      return sum + (l * w * h * qty) / 1e9; // 转换为立方米
    }, 0);

    const totalWeight = cargoList.reduce((sum, c) => {
      const weight = c.weight || 0;
      const qty = c.quantity || 1;
      return sum + weight * qty;
    }, 0);

    // 构建AI提示词
    const prompt = this._buildContainerRecommendationPrompt(cargoList, totalVolume, totalWeight, containerTypes);

    try {
      // 调用AI API
      const aiResponse = await this._callAI(prompt, 1500);

      // 解析AI返回的推荐
      const recommendations = this._parseContainerRecommendations(aiResponse, containerTypes);

      if (recommendations && recommendations.length > 0) {
        console.log('AI推荐箱型：推荐生成成功');
        const result = { recommendations, source: 'AI_EXPLANATION', aiUsed: true, authority: 'ADVISORY_ONLY' };
        // 写入语义缓存
        this._setCache(cacheKey, result);
        return result;
      }

      // AI返回格式异常，降级
      throw new Error('AI返回格式异常');
    } catch (error) {
      console.error('AI推荐箱型失败，使用本地规则降级:', error.message);


      // 降级：基于规则推荐
      const recommendations = this._getLocalContainerRecommendations(totalVolume, totalWeight, containerTypes);
      const result = this._local({ recommendations, authority: 'CAPACITY_ESTIMATE_ONLY' });
      this._setCache(cacheKey, result);
      return result;
    }
  }

  /**
   * 构建箱型推荐提示词
   */
  _buildContainerRecommendationPrompt(cargoList, totalVolume, totalWeight, containerTypes) {
    const cargoSummary = cargoList.map(c => {
      const qty = c.quantity || 1;
      return `${c.name || '未知货物'}: ${c.length}×${c.width}×${c.height}mm, ${c.weight}kg/件, ${qty}件`;
    }).join('\n');

    const containerInfo = containerTypes.map(ct => {
      const vol = (ct.innerLength * ct.innerWidth * ct.innerHeight / 1e9).toFixed(2);
      return `${ct.typeId}(${ct.name}): 内部${ct.innerLength}×${ct.innerWidth}×${ct.innerHeight}mm, 容积${vol}m³, 最大载重${ct.maxWeight}kg`;
    }).join('\n');

    return `请为以下货物推荐最合适的集装箱型号。

货物清单：
${cargoSummary}

货物汇总：
- 总体积：${totalVolume.toFixed(2)}m³
- 总重量：${totalWeight.toFixed(2)}kg

可选箱型：
${containerInfo}

请返回Top 3推荐，按适合程度从高到低排序。每个推荐包含：
- typeId: 箱型ID（20GP/40GP/40HQ）
- name: 箱型名称
- score: 推荐分数（0-100，最推荐的≥90）
- reason: 推荐理由（≤80字中文）

返回JSON格式：
{"recommendations":[{"typeId":"...","name":"...","score":95,"reason":"..."},{"typeId":"...","name":"...","score":75,"reason":"..."},{"typeId":"...","name":"...","score":60,"reason":"..."}]}

仅返回JSON，不要其他文字。`;
  }

  /**
   * 解析AI箱型推荐结果
   */
  _parseContainerRecommendations(aiResponse, containerTypes) {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const recs = parsed.recommendations || parsed;

        if (!Array.isArray(recs) || recs.length === 0) {
          return null;
        }

        // 验证并规范化
        const validTypeIds = containerTypes.map(ct => ct.typeId);
        const validated = recs
          .filter(r => r.typeId && validTypeIds.includes(r.typeId))
          .map(r => ({
            typeId: r.typeId,
            name: r.name || containerTypes.find(ct => ct.typeId === r.typeId).name,
            score: Math.min(100, Math.max(0, parseInt(r.score) || 0)),
            reason: (r.reason || '').slice(0, 80)
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        return validated.length > 0 ? validated : null;
      }
      return null;
    } catch (error) {
      console.error('解析AI箱型推荐失败:', error.message);
      return null;
    }
  }

  /**
   * 本地规则降级：基于货物总体积/总重量推荐箱型
   */
  _getLocalContainerRecommendations(totalVolume, totalWeight, containerTypes) {
    // 各箱型有效容积（立方米）
    const capacities = {
      '20GP': { volume: 33.2, maxWeight: 21770, name: '20尺标准柜' },  // 实际可用约25m³
      '40GP': { volume: 67.7, maxWeight: 26000, name: '40尺标准柜' },  // 实际可用约55m³
      '40HQ': { volume: 76.3, maxWeight: 26000, name: '40尺高柜' }     // 实际可用约60m³
    };

    let bestFit;
    if (totalVolume < 25 && totalWeight < 21770) {
      bestFit = '20GP';
    } else if (totalVolume < 55 && totalWeight < 26000) {
      bestFit = '40GP';
    } else {
      bestFit = '40HQ';
    }

    // 构建推荐列表，最佳匹配得分最高
    const scoreMap = {
      '20GP': 50,
      '40GP': 50,
      '40HQ': 50
    };
    scoreMap[bestFit] = 92;

    // 次优选择
    if (bestFit === '20GP') {
      scoreMap['40GP'] = 65;
      scoreMap['40HQ'] = 45;
    } else if (bestFit === '40GP') {
      scoreMap['20GP'] = totalVolume < 25 ? 70 : 35;
      scoreMap['40HQ'] = 75;
    } else {
      scoreMap['40GP'] = totalVolume < 55 ? 72 : 55;
      scoreMap['20GP'] = 30;
    }

    const reasonMap = {
      '20GP': this._generateLocalReason('20GP', totalVolume, totalWeight, bestFit),
      '40GP': this._generateLocalReason('40GP', totalVolume, totalWeight, bestFit),
      '40HQ': this._generateLocalReason('40HQ', totalVolume, totalWeight, bestFit)
    };

    const recommendations = containerTypes.map(ct => ({
      typeId: ct.typeId,
      name: ct.name,
      score: scoreMap[ct.typeId],
      reason: reasonMap[ct.typeId]
    })).sort((a, b) => b.score - a.score);

    return recommendations;
  }

  /**
   * 生成本地推荐理由
   */
  _generateLocalReason(typeId, totalVolume, totalWeight, bestFit) {
    if (typeId === bestFit) {
      if (typeId === '20GP') {
        return `货物总体积${totalVolume.toFixed(1)}m³、总重${totalWeight.toFixed(0)}kg，20尺柜容量匹配度最高，经济性最优`;
      } else if (typeId === '40GP') {
        return `货物总体积${totalVolume.toFixed(1)}m³适合40尺柜，标准高度满足需求，性价比最优`;
      } else {
        return `货物体积较大需要40尺高柜，额外高度提供更多装载空间，避免超限`;
      }
    }

    if (typeId === '20GP') {
      if (totalVolume > 25) {
        return `20尺柜容积不足，货物总体积${totalVolume.toFixed(1)}m³超出有效容量，不建议选用`;
      }
      return `20尺柜可装下但空间紧凑，适合预算有限场景`;
    } else if (typeId === '40GP') {
      if (totalVolume < 25) {
        return `40尺柜空间富余较多，适合后续有加货需求的场景`;
      }
      return `40尺标准柜基本满足需求，高度略有限制`;
    } else {
      return `40尺高柜空间最大，适合高度较高或体积较大的货物组合`;
    }
  }

  /**
   * AI赋能功能6：AI策略建议
   * 
   * 在装箱生成前，根据货物清单和箱型给出排序/装载策略建议
   * 8秒内返回，失败降级到本地规则策略
   * 语义缓存：相同 cargo hash + container 命中时直接返回
   * 离线模式：断网时使用预录响应返回 fallback = true
   * 
   * @param {Array} cargoList - 货物清单
   * @param {Object} container - 集装箱信息 { typeId, name, innerLength, innerWidth, innerHeight, maxWeight }
   * @returns {Object} { algorithmId, sortStrategy, reason, strategy, reasoning, sortSuggestion, expectedUtilization, fallback }
   */
  async generateStrategy(cargoList, container) {
    console.log('AI策略建议：开始生成装箱策略...');
    const startTime = Date.now();

    // 计算语义 hash（含 container typeId）
    const cargoHash = this.computeCargoHash(cargoList);
    const cacheKey = this._cacheKey('strategy', { cargoHash, container });

    // 1. 检查语义缓存
    const cached = this._getCached(cacheKey);
    if (cached) {
      console.log('AI策略建议：命中语义缓存');
      return { ...cached, cacheHit: true };
    }


    // 计算货物汇总信息
    const totalVolume = cargoList.reduce((sum, c) => {
      const qty = c.quantity || 1;
      return sum + (c.length || 0) * (c.width || 0) * (c.height || 0) * qty;
    }, 0);
    const totalWeight = cargoList.reduce((sum, c) => {
      const qty = c.quantity || 1;
      return sum + (c.weight || 0) * qty;
    }, 0);
    const containerVolume = (container.innerLength || 0) * (container.innerWidth || 0) * (container.innerHeight || 0);

    const prompt = this._buildStrategyPrompt(cargoList, container, totalVolume, totalWeight, containerVolume);

    try {
      // 8秒超时保护（Requirements 3.2: 8秒内返回）
      const timeoutMs = 8000;
      const aiResponsePromise = this._callAI(prompt, 1500);
      let timeout;
      const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('AI策略建议超时(8s)')), timeoutMs);
      });
      let aiResponse;
      try { aiResponse = await Promise.race([aiResponsePromise, timeoutPromise]); }
      finally { clearTimeout(timeout); }

      const strategy = this._parseStrategyResponse(aiResponse);

      if (strategy) {
        console.log(`AI策略建议：生成成功 (${Date.now() - startTime}ms)`);
        const result = { ...strategy, fallback: false, source: 'AI_EXPLANATION', aiUsed: true, authority: 'ADVISORY_ONLY' };
        this._setCache(cacheKey, result);
        return result;
      }
      throw new Error('AI返回格式异常');
    } catch (error) {
      console.error('AI策略建议失败，使用本地降级:', error.message);


      const localResult = this._local(this._getLocalStrategySuggestion(cargoList, container, totalVolume, totalWeight, containerVolume));
      this._setCache(cacheKey, localResult);
      return localResult;
    }
  }

  /**
   * AI赋能功能7：装箱结果解释
   * 
   * 装箱方案生成后，给出 ≤ 200 字中文解释（为什么这样装、利用率分析、风险点）
   * 失败降级到本地模板解释
   * 语义缓存：相同 cargo hash 命中时直接返回
   * 离线模式：断网时使用预录响应返回 fallback = true
   * 
   * @param {Object} packingResult - 装箱结果 { loadedCargo, unloadedCargo, spaceUtilization, totalWeight, cogOffset, ... }
   * @returns {Object} { explanation, highlights, risks, fallback }
   */
  async explainResult(packingResult) {
    console.log('AI结果解释：开始生成解释...');

    const cacheKey = this._cacheKey('explain', packingResult);

    // 1. 检查语义缓存
    const cached = this._getCached(cacheKey);
    if (cached) {
      console.log('AI结果解释：命中语义缓存');
      return { ...cached, cacheHit: true };
    }


    const metrics = this._extractResultMetrics(packingResult);
    const prompt = this._buildExplainPrompt(metrics);

    try {
      const aiResponse = await this._callAI(prompt, 800);
      const explanation = this._parseExplainResponse(aiResponse, metrics);

      if (explanation) {
        console.log('AI结果解释：生成成功');
        const result = { ...explanation, risks: metrics.risks, fallback: false, source: 'AI_EXPLANATION', aiUsed: true, authority: 'EXPLANATION_ONLY' };
        this._setCache(cacheKey, result);
        return result;
      }
      throw new Error('AI返回格式异常');
    } catch (error) {
      console.error('AI结果解释失败，使用本地模板:', error.message);


      const localResult = this._local(this._getLocalExplanation(metrics));
      this._setCache(cacheKey, localResult);
      return localResult;
    }
  }

  /**
   * 构建策略建议提示词
   */
  _buildStrategyPrompt(cargoList, container, totalVolume, totalWeight, containerVolume) {
    const cargoSummary = cargoList.slice(0, 10).map(c => {
      const qty = c.quantity || 1;
      return `${c.name || '货物'}: ${c.length}×${c.width}×${c.height}mm, ${c.weight}kg, ${qty}件${c.stackable ? `, 可堆叠${c.maxStackLayers || 3}层` : ''}`;
    }).join('\n');

    const volumeRatio = containerVolume > 0 ? (totalVolume / containerVolume * 100).toFixed(1) : '0';

    return `请为以下装箱场景给出排序和装载策略建议。

集装箱：${container.name || container.typeId}（${container.innerLength}×${container.innerWidth}×${container.innerHeight}mm，载重${container.maxWeight}kg）

货物（共${cargoList.length}种）：
${cargoSummary}${cargoList.length > 10 ? `\n...等共${cargoList.length}种` : ''}

汇总：总体积占比${volumeRatio}%，总重量${totalWeight.toFixed(0)}kg

请返回JSON：
{"strategy":"策略名称","sortSuggestion":"排序建议（≤50字）","reasoning":"策略理由（≤100字）","expectedUtilization":"预期利用率如70-85%"}

仅返回JSON。`;
  }

  /**
   * 解析策略建议响应
   */
  _parseStrategyResponse(aiResponse) {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.strategy || parsed.sortSuggestion || parsed.reasoning) {
          // 根据策略名称映射 algorithmId
          const algorithmId = this._mapStrategyToAlgorithmId(parsed.strategy || parsed.sortStrategy);
          return {
            algorithmId,
            sortStrategy: (parsed.sortSuggestion || parsed.sortStrategy || '综合优化').slice(0, 50),
            reason: (parsed.reasoning || parsed.reason || '').slice(0, 100),
            strategy: (parsed.strategy || '综合优化').slice(0, 50),
            sortSuggestion: (parsed.sortSuggestion || '').slice(0, 50),
            reasoning: (parsed.reasoning || '').slice(0, 100),
            expectedUtilization: parsed.expectedUtilization || '65-80%'
          };
        }
      }
      return null;
    } catch (error) {
      console.error('解析AI策略建议失败:', error.message);
      return null;
    }
  }

  /**
   * 将策略名称映射到算法ID
   * @param {string} strategyName - 策略名称
   * @returns {string} algorithmId
   */
  _mapStrategyToAlgorithmId(strategyName) {
    if (!strategyName) return 'realistic4d';
    const name = strategyName.toLowerCase();
    if (name.includes('重量') || name.includes('weight')) return 'realistic4d_weight';
    if (name.includes('体积') || name.includes('volume')) return 'realistic4d_volume';
    if (name.includes('紧凑') || name.includes('dense') || name.includes('compact')) return 'realistic4d_dense';
    if (name.includes('堆叠') || name.includes('stack')) return 'realistic4d_stacking';
    if (name.includes('分层') || name.includes('layer')) return 'layered';
    return 'realistic4d';
  }

  /**
   * 本地降级策略建议
   */
  _getLocalStrategySuggestion(cargoList, container, totalVolume, totalWeight, containerVolume) {
    const volumeRatio = containerVolume > 0 ? totalVolume / containerVolume * 100 : 0;
    const hasHeavy = cargoList.some(c => (c.weight || 0) > 50);
    const hasNonStackable = cargoList.some(c => !c.stackable);

    let strategy, sortSuggestion, reasoning, algorithmId;

    if (hasHeavy && volumeRatio > 60) {
      strategy = '重量优先+体积填充';
      sortSuggestion = '重货先装底部，轻货填充上层空间';
      reasoning = '货物较重且体积占比高，重货打底保证重心稳定，轻货填充提升利用率';
      algorithmId = 'realistic4d_weight';
    } else if (hasNonStackable) {
      strategy = '堆叠优先+隔离放置';
      sortSuggestion = '可堆叠货物优先装载，不可堆叠货物最后放置';
      reasoning = '存在不可堆叠货物，优先利用可堆叠货物的垂直空间，避免浪费';
      algorithmId = 'realistic4d_stacking';
    } else if (volumeRatio > 80) {
      strategy = '紧凑填充';
      sortSuggestion = '按体积从大到小排序，优先放置大件';
      reasoning = '货物体积占比高，大件优先确保空间分配合理，小件填缝提升利用率';
      algorithmId = 'realistic4d_dense';
    } else {
      strategy = '体积优先+均衡分布';
      sortSuggestion = '按体积降序排列，兼顾重量均衡';
      reasoning = '标准场景采用体积优先策略，兼顾重心平衡与空间利用率';
      algorithmId = 'realistic4d_volume';
    }

    return {
      algorithmId,
      sortStrategy: sortSuggestion,
      reason: reasoning,
      strategy,
      sortSuggestion,
      reasoning,
      expectedUtilization: 'UNKNOWN',
      fallback: true
    };
  }

  /**
   * 提取装箱结果关键指标
   */
  _extractResultMetrics(packingResult) {
    const loadedCount = Array.isArray(packingResult.loadedCargo) ? packingResult.loadedCargo.length : 0;
    const unloadedCount = Array.isArray(packingResult.unloadedCargo) ? packingResult.unloadedCargo.length : 0;
    const spaceUtilization = packingResult.spaceUtilization || 0;
    const totalWeight = packingResult.totalWeight || 0;
    const cogOffset = packingResult.cogOffset ?? null;
    const algorithm = packingResult.algorithm || '智能优化算法';

    // Missing evidence is not a safety verdict.
    const risks = ['出运许可仍需依据当前方案的完整证据复核'];
    if (!packingResult.validator) risks.push('缺少当前方案约束验证证据');
    if (!packingResult.shipmentReadiness) risks.push('缺少出运条件证据');
    if (spaceUtilization < 60) {
      risks.push('空间利用率偏低');
    }
    if (unloadedCount > 0) {
      risks.push(`${unloadedCount}件货物未能装入`);
    }
    if (cogOffset && typeof cogOffset === 'number' && cogOffset > 10) {
      risks.push('重心偏移较大');
    }

    return {
      loadedCount,
      unloadedCount,
      spaceUtilization,
      totalWeight,
      cogOffset,
      algorithm,
      risks,
      totalCount: loadedCount + unloadedCount
    };
  }

  /**
   * 构建结果解释提示词
   */
  _buildExplainPrompt(metrics) {
    return `请用≤200字中文解释以下装箱结果，包含：为什么这样装、利用率分析、风险点。

装箱结果：
- 装入${metrics.loadedCount}件，未装入${metrics.unloadedCount}件
- 空间利用率：${metrics.spaceUtilization.toFixed ? metrics.spaceUtilization.toFixed(1) : metrics.spaceUtilization}%
- 总重量：${metrics.totalWeight}kg
- 算法：${metrics.algorithm}
${metrics.risks.length > 0 ? `- 风险：${metrics.risks.join('、')}` : '- 无明显风险'}

返回JSON：
{"explanation":"≤200字中文解释","highlights":["亮点1","亮点2"],"risks":["风险1"]}

仅返回JSON。`;
  }

  /**
   * 解析结果解释响应
   */
  _parseExplainResponse(aiResponse, metrics) {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.explanation) {
          return {
            explanation: parsed.explanation.slice(0, 200),
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 5) : [],
            risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : metrics.risks
          };
        }
      }
      return null;
    } catch (error) {
      console.error('解析AI结果解释失败:', error.message);
      return null;
    }
  }

  /**
   * 本地模板降级解释
   */
  _getLocalExplanation(metrics) {
    const utilLevel = metrics.spaceUtilization >= 80 ? '较高' :
                      metrics.spaceUtilization >= 60 ? '中等' : '偏低';

    let strategyDesc = '体积优先+重量均衡';
    if (metrics.algorithm.includes('重量')) {
      strategyDesc = '重量优先';
    } else if (metrics.algorithm.includes('分层') || metrics.algorithm.includes('Layered')) {
      strategyDesc = '分层装载';
    }

    const riskText = metrics.risks.length > 0
      ? `风险提示：${metrics.risks.join('；')}。`
      : '尚不能据此确认安全或出运许可。';

    const explanation = `本方案采用${strategyDesc}策略，空间利用率达到${typeof metrics.spaceUtilization === 'number' ? metrics.spaceUtilization.toFixed(1) : metrics.spaceUtilization}%（${utilLevel}），总重量${metrics.totalWeight}kg，共装入${metrics.loadedCount}件货物。${metrics.unloadedCount > 0 ? `有${metrics.unloadedCount}件未装入，原因以求解证据为准。` : ''}${riskText}`;

    const highlights = [];
    if (metrics.spaceUtilization >= 70) highlights.push(`空间利用率${typeof metrics.spaceUtilization === 'number' ? metrics.spaceUtilization.toFixed(1) : metrics.spaceUtilization}%`);
    if (metrics.loadedCount > 0) highlights.push(`成功装入${metrics.loadedCount}件`);


    return {
      explanation: explanation.slice(0, 200),
      highlights,
      risks: metrics.risks,
      fallback: true
    };
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 检测是否为网络错误
   * @param {Error} error
   * @returns {boolean}
   */
  _isNetworkError(error) {
    if (!error) return false;
    const networkCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNABORTED', 'ERR_NETWORK', 'ENETUNREACH'];
    if (error.code && networkCodes.includes(error.code)) return true;
    if (error.message && (
      error.message.includes('Network Error') ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    )) return true;
    return false;
  }

  /**
   * 调用AI API（DeepSeek V4 Flash - 极速响应）
   * 使用 OpenAI 兼容格式，response_format 强制 JSON 输出
   */
  async _callAI(prompt, maxTokens = 2000) {
    if (this._shouldUseOffline() || !this.apiKey) {
      throw new Error('AI API Key未配置');
    }

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: '你是宁波港3D装箱优化专家。你只返回JSON格式，不要返回任何其他文字、解释或markdown代码块。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.3,  // 低温度减少幻觉，输出更稳定
      response_format: { type: 'json_object' }  // 强制 JSON 输出（DeepSeek V4 支持）
    };

    const response = await axios.post(
      this.apiEndpoint,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15秒超时（DeepSeek V4 Flash 通常 2-5 秒响应）
      }
    );

    // DeepSeek V4 Flash 返回格式与 OpenAI 一致
    const content = response.data.choices[0].message.content;
    
    // 清理可能的 markdown 代码块包裹
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    
    return cleaned.trim();
  }

  /**
   * 分析货物特征
   */
  _analyzeCargoCharacteristics(cargoList, containerType) {
    const totalVolume = cargoList.reduce((sum, c) => 
      sum + c.length * c.width * c.height * c.quantity, 0);
    const containerVolume = containerType.innerLength * 
      containerType.innerWidth * containerType.innerHeight;
    
    return {
      skuCount: cargoList.length,
      totalItems: cargoList.reduce((sum, c) => sum + c.quantity, 0),
      totalVolume,
      containerVolume,
      volumeRatio: (totalVolume / containerVolume * 100).toFixed(2),
      hasNonStackable: cargoList.some(c => !c.stackable),
      hasLayFlatOnly: cargoList.some(c => c.canLayFlat && !c.canInvert),
      avgAspectRatio: this._calculateAvgAspectRatio(cargoList)
    };
  }


  _calculateAvgAspectRatio(cargoList) {
    const ratios = cargoList.map(c => {
      const dims = [c.length, c.width, c.height].sort((a, b) => b - a);
      return dims[0] / dims[2]; // 最长边/最短边
    });
    return (ratios.reduce((sum, r) => sum + r, 0) / ratios.length).toFixed(2);
  }

  /**
   * 构建优化策略提示词
   */
  _buildOptimizationPrompt(analysis, containerType) {
    return `请为以下装箱场景生成优化策略：

货物特征：
- SKU数量：${analysis.skuCount}
- 总件数：${analysis.totalItems}
- 货物总体积：${(analysis.totalVolume / 1000000).toFixed(2)}立方米
- 柜型体积：${(analysis.containerVolume / 1000000).toFixed(2)}立方米
- 体积占比：${analysis.volumeRatio}%
- 包含不可堆叠货物：${analysis.hasNonStackable ? '是' : '否'}
- 包含需侧放货物：${analysis.hasLayFlatOnly ? '是' : '否'}
- 平均长宽比：${analysis.avgAspectRatio}

请输出JSON格式的优化策略，包含：
1. sortStrategy: 排序策略（volume_desc/weight_desc/height_asc/custom）
2. layerStrategy: 分层策略（single_layer/multi_layer/mixed）
3. rotationPriority: 旋转优先级（height_min/volume_max/stability_max）
4. fillPattern: 填充模式（dense/balanced/layered）
5. reasoning: 策略理由（50字以内）

仅返回JSON，不要其他文字。`;
  }

  /**
   * 解析优化策略
   */
  _parseOptimizationStrategy(aiResponse) {
    try {
      // 提取JSON部分
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('无法解析AI响应');
    } catch (error) {
      console.error('解析AI策略失败:', error);
      return this._getDefaultStrategy();
    }
  }

  /**
   * 获取默认策略（降级方案）
   */
  _getDefaultStrategy(cargoList = []) {
    return {
      sortStrategy: 'volume_desc',
      layerStrategy: 'multi_layer',
      rotationPriority: 'height_min',
      fillPattern: 'dense',
      reasoning: '使用默认FFD+BLB策略'
    };
  }


  /**
   * 计算合规指标
   */
  _calculateComplianceMetrics(plan, containerType) {
    const known = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
    const placements = (Array.isArray(plan.loadedCargo) ? plan.loadedCargo : []).map(item => {
      if (!item.position) return { ...item };
      const c = item.cargo || item, r = item.rotation || {};
      return { ...c, cargoId: item.cargoId || c.cargoId, x: item.position.x, y: item.position.z,
        z: item.position.y, l: r.length ?? c.length, w: r.width ?? c.width, h: r.height ?? c.height };
    });
    const massKnown = placements.length > 0 && placements.every(c => known(c.weight) && Number(c.weight) >= 0);
    const geometryKnown = placements.length > 0 && placements.every(c => ['x','y','z','l','w','h'].every(k => known(c[k])))
      && ['innerLength','innerWidth','innerHeight'].every(k => known(containerType[k]) && Number(containerType[k]) > 0);
    const totalWeight = massKnown ? placements.reduce((sum,c) => sum + Number(c.weight), 0) : null;
    const cog = massKnown && geometryKnown && totalWeight > 0 ? {
      x: placements.reduce((v,c) => v + c.weight * (Number(c.x)+Number(c.l)/2), 0)/totalWeight,
      y: placements.reduce((v,c) => v + c.weight * (Number(c.y)+Number(c.h)/2), 0)/totalWeight,
      z: placements.reduce((v,c) => v + c.weight * (Number(c.z)+Number(c.w)/2), 0)/totalWeight
    } : null;
    return { placements, massKnown, geometryKnown, totalWeight, maxWeight: containerType.maxWeight, cog,
      frontBackDeviation: cog ? Math.abs(cog.x-containerType.innerLength/2)/containerType.innerLength*100 : null,
      leftRightDeviation: cog ? Math.abs(cog.z-containerType.innerWidth/2)/containerType.innerWidth*100 : null,
      loadedCount: placements.length, unloadedCount: plan.unloadedCargo?.length || 0 };
  }

  /**
   * 获取已知货物属性（宁波港高频货型）
   */
  _getKnownCargoAttributes(cargoName) {
    const knownCargos = {
      '空气炸锅': { stackable: true, maxStackLayers: 4, canInvert: false, canLayFlat: false },
      '取暖器': { stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false },
      '电风扇': { stackable: false, maxStackLayers: 1, canInvert: false, canLayFlat: true },
      '中性笔': { stackable: true, maxStackLayers: 8, canInvert: false, canLayFlat: true },
      '笔记本': { stackable: true, maxStackLayers: 6, canInvert: false, canLayFlat: true },
      '文具套装': { stackable: true, maxStackLayers: 10, canInvert: false, canLayFlat: true },
      '汽车空气滤芯': { stackable: true, maxStackLayers: 5, canInvert: false, canLayFlat: true },
      '汽车雨刮器': { stackable: true, maxStackLayers: 6, canInvert: false, canLayFlat: true },
      '汽车LED车灯总成': { stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false }
    };
    
    return knownCargos[cargoName] || null;
  }

  /**
   * 构建货物识别提示词
   */
  _buildRecognitionPrompt(cargoName, dimensions, weight) {
    return `请识别以下货物的装箱属性：

货物名称：${cargoName}
尺寸：${dimensions.length}x${dimensions.width}x${dimensions.height}mm
重量：${weight}kg

请输出JSON格式的属性，包含：
1. stackable: 是否可堆叠（boolean）
2. maxStackLayers: 最大堆叠层数（1-10）
3. canInvert: 是否可倒置（boolean）
4. canLayFlat: 是否可侧放（boolean）
5. reasoning: 判断理由（30字以内）

仅返回JSON，不要其他文字。`;
  }

  /**
   * 解析货物属性
   */
  _parseCargoAttributes(aiResponse) {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('无法解析AI响应');
    } catch (error) {
      console.error('解析AI属性失败:', error);
      return this._getDefaultCargoAttributes();
    }
  }

  /**
   * 获取默认货物属性（保守策略）
   */
  _getDefaultCargoAttributes() {
    return {
      stackable: true,
      maxStackLayers: 3,
      canInvert: false,
      canLayFlat: false,
      reasoning: '使用保守默认属性'
    };
  }


  /**
   * 提取路演亮点
   */
  _extractHighlights(plan, containerType, complianceReport) {
    const spaceUtilization = plan.spaceUtilization || 0;
    const totalWeight = plan.totalWeight || 0;
    const loadedCount = plan.loadedCargo.length;
    
    return {
      spaceUtilization: spaceUtilization.toFixed(2),
      totalWeight: totalWeight.toFixed(2),
      maxWeight: containerType.maxWeight,
      loadedCount,
      containerName: containerType.name,
      complianceLevel: complianceReport.complianceLevel,
      overallScore: complianceReport.overallScore,
      hasRisks: complianceReport.risks.length > 0,
      riskCount: complianceReport.risks.length
    };
  }

  /**
   * 构建讲解提示词
   */
  _buildPresentationPrompt(highlights) {
    return `请为三创赛路演生成装箱方案讲解话术：

方案亮点：
- 空间利用率：${highlights.spaceUtilization}%
- 装载重量：${highlights.totalWeight}kg / ${highlights.maxWeight}kg
- 装载件数：${highlights.loadedCount}件
- 柜型：${highlights.containerName}
- 合规等级：${highlights.complianceLevel}
- 综合评分：${highlights.overallScore}分
- 风险点：${highlights.riskCount}个

要求：
1. 口语化，适合现场演讲
2. 1分钟以内（约200字）
3. 突出亮点，简洁有力
4. 无专业术语，评委能听懂
5. 只解释已提供的事实，不推断安全、港口许可或处理耗时

仅返回话术文本，不要其他内容。`;
  }

  /**
   * 提取讲解话术
   */
  _extractPresentation(aiResponse) {
    // 移除可能的JSON包装
    let text = aiResponse.trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const json = JSON.parse(text);
        text = json.presentation || json.text || text;
      } catch (e) {
        // 不是JSON，直接使用原文
      }
    }
    return text;
  }

  /**
   * 获取模板话术（降级方案）
   */
  _getTemplatePresentation(highlights) {
    const templates = [
      `本地模板说明：当前方案装入${highlights.loadedCount}件货物，柜型${highlights.containerName}，空间利用率${highlights.spaceUtilization}%。`,
      `确定性检查等级为${highlights.complianceLevel}，需复核${highlights.riskCount}项风险或缺失证据。`,
      `实际装柜与出运仍需核对现场、单证和加固证据。`
    ];
    
    return templates.join('');
  }

  // ==================== 🆕 AI深度分析辅助方法 ====================

  /**
   * 构建详细的货物分析
   */
  _buildDetailedCargoAnalysis(cargoList, containerType) {
    const analysis = {
      container: {
        name: containerType.name,
        dimensions: {
          length: containerType.innerLength,
          width: containerType.innerWidth,
          height: containerType.innerHeight
        },
        volume: containerType.innerLength * containerType.innerWidth * containerType.innerHeight,
        maxWeight: containerType.maxWeight
      },
      cargo: {
        types: cargoList.length,
        totalItems: cargoList.reduce((sum, c) => sum + c.quantity, 0),
        totalVolume: 0,
        totalWeight: 0,
        stackableItems: [],
        nonStackableItems: [],
        heightDistribution: {}
      }
    };

    // 分析每种货物
    cargoList.forEach(cargo => {
      const volume = cargo.length * cargo.width * cargo.height * cargo.quantity;
      const weight = cargo.weight * cargo.quantity;
      
      analysis.cargo.totalVolume += volume;
      analysis.cargo.totalWeight += weight;
      
      // 分类可堆叠和不可堆叠
      if (cargo.stackable) {
        analysis.cargo.stackableItems.push({
          name: cargo.name,
          quantity: cargo.quantity,
          maxLayers: cargo.maxStackLayers,
          volume: cargo.length * cargo.width * cargo.height,
          height: cargo.height
        });
      } else {
        analysis.cargo.nonStackableItems.push({
          name: cargo.name,
          quantity: cargo.quantity,
          volume: cargo.length * cargo.width * cargo.height,
          height: cargo.height
        });
      }
      
      // 高度分布
      const heightKey = `${cargo.height}mm`;
      if (!analysis.cargo.heightDistribution[heightKey]) {
        analysis.cargo.heightDistribution[heightKey] = [];
      }
      analysis.cargo.heightDistribution[heightKey].push(cargo.name);
    });
    
    // 计算利用率
    analysis.volumeUtilization = (analysis.cargo.totalVolume / analysis.container.volume * 100).toFixed(2);
    analysis.weightUtilization = (analysis.cargo.totalWeight / analysis.container.maxWeight * 100).toFixed(2);
    
    return analysis;
  }

  /**
   * 构建深度分析提示词
   */
  _buildDeepAnalysisPrompt(analysis, cargoList, containerType) {
    // 构建货物详情
    const cargoDetails = cargoList.map((c, i) => {
      return `${i + 1}. ${c.name}
   - 尺寸: ${c.length}×${c.width}×${c.height}mm
   - 重量: ${c.weight}kg/件
   - 数量: ${c.quantity}件
   - 堆叠: ${c.stackable ? `可堆叠${c.maxStackLayers}层` : '不可堆叠'}
   - 单件体积: ${(c.length * c.width * c.height / 1000000).toFixed(3)}m³`;
    }).join('\n\n');

    return `你是3D装箱优化专家。请深度分析以下场景并给出最优装箱策略。

📦 集装箱信息：
- 类型: ${containerType.name}
- 内部尺寸: ${containerType.innerLength}×${containerType.innerWidth}×${containerType.innerHeight}mm
- 容积: ${(analysis.container.volume / 1000000000).toFixed(2)}m³
- 最大载重: ${containerType.maxWeight}kg

📊 货物概况：
- 货物种类: ${cargoList.length}种
- 总件数: ${analysis.cargo.totalItems}件
- 总体积: ${(analysis.cargo.totalVolume / 1000000000).toFixed(2)}m³ (${analysis.volumeUtilization}%容积)
- 总重量: ${analysis.cargo.totalWeight.toFixed(2)}kg (${analysis.weightUtilization}%载重)
- 可堆叠货物: ${analysis.cargo.stackableItems.length}种
- 不可堆叠货物: ${analysis.cargo.nonStackableItems.length}种

📋 货物详情：
${cargoDetails}

🎯 优化目标：
1. 最大化空间利用率（目标≥70%）
2. 充分利用可堆叠货物的堆叠能力
3. 合理安排不可堆叠货物的位置
4. 保持重心平衡

请分析并返回JSON格式的装箱策略：
{
  "sortStrategy": "排序策略名称",
  "loadingOrder": ["按优先级排序的货物名称数组"],
  "layerStrategy": "分层策略描述",
  "spaceAllocation": {
    "phase1": "第一阶段装什么（底层）",
    "phase2": "第二阶段装什么（中层）",
    "phase3": "第三阶段装什么（顶层）"
  },
  "stackingPlan": {
    "货物名称": "堆叠建议"
  },
  "reasoning": "策略核心思路（100字以内）",
  "expectedUtilization": "预期空间利用率范围（如60-75%）",
  "keyPoints": ["关键优化点1", "关键优化点2", "关键优化点3"]
}

⚠️ 重要提示：
- 可堆叠货物应优先装载，充分利用垂直空间
- 不可堆叠货物应最后装载或放在特定位置
- 高度差异大的货物要合理分配，避免空间浪费
- 必须严格遵守每种货物的堆叠层数限制

仅返回JSON，不要其他文字。`;
  }

  /**
   * 解析深度策略
   */
  _parseDeepStrategy(aiResponse) {
    try {
      // 提取JSON部分
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const strategy = JSON.parse(jsonMatch[0]);
        
        // 验证必要字段
        if (!strategy.loadingOrder || !Array.isArray(strategy.loadingOrder)) {
          throw new Error('loadingOrder字段缺失或格式错误');
        }
        
        return strategy;
      }
      throw new Error('无法从AI响应中提取JSON');
    } catch (error) {
      console.error('解析AI深度策略失败:', error.message);
      throw error;
    }
  }

  /**
   * 智能降级策略（基于规则的优化）
   */
  _getIntelligentFallbackStrategy(cargoList, containerType) {
    console.log('🔄 使用智能降级策略...');
    
    // 按堆叠能力排序
    const sortedByStacking = [...cargoList].sort((a, b) => {
      // 可堆叠的优先
      if (a.stackable && !b.stackable) return -1;
      if (!a.stackable && b.stackable) return 1;
      
      // 都可堆叠时，堆叠层数高的优先
      if (a.stackable && b.stackable) {
        return b.maxStackLayers - a.maxStackLayers;
      }
      
      // 都不可堆叠时，按体积排序
      const volA = a.length * a.width * a.height;
      const volB = b.length * b.width * b.height;
      return volB - volA;
    });
    
    const loadingOrder = sortedByStacking.map(c => c.name);
    
    return {
      sortStrategy: 'stacking_priority',
      loadingOrder,
      layerStrategy: 'stackable_first',
      spaceAllocation: {
        phase1: '可堆叠货物打底，充分利用底面积',
        phase2: '继续堆叠到最大层数',
        phase3: '剩余空间放置不可堆叠货物'
      },
      stackingPlan: this._buildStackingPlan(cargoList),
      reasoning: '优先装载可堆叠货物，充分利用垂直空间；不可堆叠货物最后填充剩余空间',
      expectedUtilization: '60-75%',
      keyPoints: [
        '可堆叠货物优先装载',
        '充分利用堆叠能力',
        '不可堆叠货物最后处理'
      ]
    };
  }

  /**
   * 构建堆叠计划
   */
  _buildStackingPlan(cargoList) {
    const plan = {};
    
    cargoList.forEach(cargo => {
      if (cargo.stackable) {
        plan[cargo.name] = `可堆叠${cargo.maxStackLayers}层，优先装载`;
      } else {
        plan[cargo.name] = '不可堆叠，最后填充';
      }
    });
    
    return plan;
  }
}

module.exports = AIPackingService;
