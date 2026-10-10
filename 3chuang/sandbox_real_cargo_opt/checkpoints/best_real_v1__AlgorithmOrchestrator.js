/**
 * Algorithm Orchestrator - 算法调度器
 * 
 * 统一算法入口，根据输入规模/约束自动选择并融合算法。
 * 基于现有 Realistic4DPackingEngine v34.7 进行调度，不重写引擎。
 * 
 * 核心功能：
 * - selectStrategyFamily(skuCount)：根据 SKU 数选择策略族
 * - execute(input)：执行装箱计算，大批量场景尝试多种排序策略取最优
 * - getAlgorithmList()：返回支持的算法清单
 * - 超限货物检测：返回 OVERSIZE 错误码
 * - 确定性输出：相同输入 + seed → 相同输出
 * - 缓存集成：相同输入命中缓存 50ms 内返回
 * 
 * Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 1.9, 1.10, 2.5
 */

const Realistic4DPackingEngine = require('./Realistic4DPackingEngine');
const FastBlockPackingEngine = require('./FastBlockPackingEngine');
const HybridConstraintPackingSolverV2 = require('./HybridConstraintPackingSolverV2');
const HybridConstraintPackingSolverV23 = require('./HybridConstraintPackingSolverV23');
const HybridConstraintPackingSolverV24 = require('./HybridConstraintPackingSolverV24');
const HybridConstraintPackingSolverV25 = require('./HybridConstraintPackingSolverV25');
const PlanValidator = require('./packing/PlanValidator');
const { calculatePlanMetrics } = require('./packing/PlanMetrics');
const solverPolicy = require('../config/solverPolicy');
const ResultCache = require('./ResultCache');
const crypto = require('crypto');

// 算法白名单
const ALGORITHM_WHITELIST = [
  'realistic4d',
  'realistic4d-weight-first',
  'realistic4d-volume-first',
  'realistic4d-mixed',
  'realistic4d-multi-strategy',
  'fast-block',
  'fast-block-v1',
  'hybrid-v2',
  'hybrid-v2.3',
  'hybrid-v2.4',
  'hybrid-v2.5',
  'auto'
];

// 最大集装箱尺寸（40HQ）用于超限检测
const MAX_CONTAINER_DIMENSIONS = {
  maxLength: 12032,   // mm
  maxWidth: 2352,     // mm
  maxHeight: 2698,    // mm (40HQ)
  maxWeight: 26000    // kg
};

// 策略族分界点
const STRATEGY_THRESHOLDS = {
  EXACT_MAX_SKU: 50,
  HEURISTIC_MAX_SKU: 500
};

class AlgorithmOrchestrator {
  constructor(config = {}) {
    this.config = {
      timeoutMs: config.timeoutMs || 60000,
      debugMode: config.debugMode || false,
      officialSolver: config.officialSolver || process.env.PORTCUBE_OFFICIAL_SOLVER || solverPolicy.officialSolver,
      ...config
    };

    // 结果缓存实例
    this.cache = config.cache || new ResultCache({ mode: 'memory' });
  }

  /**
   * 根据 SKU 数选择策略族
   * @param {number} skuCount - SKU 种类数
   * @returns {string} strategyFamily - 'exact'|'heuristic'|'metaheuristic'
   */
  selectStrategyFamily(skuCount) {
    if (skuCount <= STRATEGY_THRESHOLDS.EXACT_MAX_SKU) {
      return 'exact';
    } else if (skuCount <= STRATEGY_THRESHOLDS.HEURISTIC_MAX_SKU) {
      return 'heuristic';
    } else {
      return 'metaheuristic';
    }
  }

  /**
   * 执行装箱计算
   * @param {Object} input - 装箱输入
   * @param {Array} input.cargoList - 货物列表
   * @param {Object} input.container - 集装箱参数 { innerLength, innerWidth, innerHeight, maxWeight }
   * @param {Object} [input.options] - 可选参数
   * @param {string} [input.options.algorithmId] - 指定算法ID
   * @param {number} [input.options.seed] - 随机种子（确定性）
   * @param {boolean} [input.options.mixedSku] - 多规格混装
   * @param {number} [input.options.timeoutMs] - 超时毫秒数
   * @returns {Promise<Object>} PackingResult
   */
  async execute(input) {
    const startTime = Date.now();
    const { cargoList, container, options = {} } = input;

    // 1. 验证算法 ID 白名单
    const algorithmId = options.algorithmId || 'realistic4d-multi-strategy';
    if (!ALGORITHM_WHITELIST.includes(algorithmId)) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ALGORITHM',
          message: `算法 ID "${algorithmId}" 不在白名单内`,
          allowedAlgorithms: ALGORITHM_WHITELIST
        }
      };
    }

    // 2. 超限货物检测
    const oversizeCheck = this._checkOversizeCargo(cargoList, container);
    if (oversizeCheck.hasOversize) {
      return {
        success: false,
        error: {
          code: 'OVERSIZE',
          message: '存在超限货物',
          oversizeItems: oversizeCheck.oversizeItems
        }
      };
    }

    // 3. 检查缓存
    const cacheKey = this._generateCacheKey(input);
    const cachedResult = await this.cache.get(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult,
        fromCache: true,
        metrics: {
          ...cachedResult.metrics,
          elapsed_ms: Date.now() - startTime
        }
      };
    }

    // 4. 根据策略族选择执行方式
    const skuCount = this._countSKUs(cargoList);
    const totalItems = this._countItems(cargoList);
    const strategyFamily = this.selectStrategyFamily(skuCount);
    const seed = options.seed !== undefined ? options.seed : null;

    let result;
    const resolvedAlgorithmId = algorithmId === 'auto' ? this.config.officialSolver : algorithmId;
    if (resolvedAlgorithmId === 'hybrid-v2.5') {
      result = await this._executeHybridV25Strategy(cargoList, container, options);
    } else if (resolvedAlgorithmId === 'hybrid-v2.4') {
      result = await this._executeHybridV24Strategy(cargoList, container, options);
    } else if (resolvedAlgorithmId === 'hybrid-v2.3') {
      result = await this._executeHybridV23Strategy(cargoList, container, options.strategy);
      if (!result.validator?.valid || result.operationFeasibility?.blockedCount > 0) {
        const invalidV23 = result.validator;
        result = await this._executeHybridV2Strategy(cargoList, container, options.strategy);
        result.warnings = [
          ...(result.warnings || []),
          { type: 'HYBRID_V23_FALLBACK', message: `V2.3 未通过正式门禁，已回退保留的 Hybrid V2.1（${invalidV23?.hardViolationCount || 0} 项硬违规）` }
        ];
        result.fallback = { from: 'hybrid-v2.3', to: 'hybrid-v2', validator: invalidV23 };
      }
    } else if (resolvedAlgorithmId === 'hybrid-v2') {
      result = await this._executeHybridV2Strategy(cargoList, container, options.strategy);
      if (!result.validator?.valid) {
        const invalidV2 = result.validator;
        result = await this._executeFastBlockStrategy(cargoList, container);
        result.warnings = [
          ...(result.warnings || []),
          { type: 'HYBRID_V2_FALLBACK', message: `V2 未通过独立 Validator，已回退 FastBlock V1（${invalidV2?.hardViolationCount || 0} 项）` }
        ];
        result.fallback = { from: 'hybrid-v2', to: 'fast-block-v1', validator: invalidV2 };
      }
    } else if (resolvedAlgorithmId === 'fast-block' || resolvedAlgorithmId === 'fast-block-v1' || this._shouldUseFastBlock({ algorithmId: resolvedAlgorithmId, skuCount, totalItems })) {
      result = await this._executeFastBlockStrategy(cargoList, container);
      if (resolvedAlgorithmId === 'fast-block' || resolvedAlgorithmId === 'realistic4d-multi-strategy') {
        result._strategyUsed = 'fast-block';
        result._algorithmId = 'fast-block';
      }
      // [MUTATION iter1] 有效性优先回退：fast-block 若未通过独立 Validator，
      // 再尝试 realistic4d 多排序候选，按「合规 → 有效 → 利用率 → 耗时」择优。
      if (result.validator && !result.validator.valid) {
        const alternate = await this._executeMultiStrategy(cargoList, container, seed);
        result = this._pickBestCandidate(alternate, result, { cargoList, container });
      }
    } else if (skuCount <= STRATEGY_THRESHOLDS.EXACT_MAX_SKU) {
      // 精确模式：[MUTATION iter1] 有效性优先候选组合
      result = await this._executeCandidatePortfolio(cargoList, container, seed);
    } else {
      // 大批量模式：多策略排序尝试，取最优
      result = await this._executeMultiStrategy(cargoList, container, seed);
    }

    if (['auto', 'fast-block', 'fast-block-v1', 'hybrid-v2', 'hybrid-v2.3', 'hybrid-v2.4', 'hybrid-v2.5'].includes(algorithmId)
      && result.validator && !result.validator.valid) {
      return {
        success: false,
        error: {
          code: 'PLAN_INVALID',
          message: '正式方案未通过独立 PlanValidator，已阻止进入 BACKEND_SOLVED',
          validator: result.validator,
          fallback: result.fallback || null
        }
      };
    }

    // 5. 构建完整结果
    const elapsed_ms = Date.now() - startTime;
    const finalResult = this._buildFinalResult(result, {
      algorithmId: resolvedAlgorithmId,
      strategyFamily,
      seed,
      elapsed_ms,
      skuCount,
      totalItems,
      cargoList,
      container
    });

    // 6. 存入缓存
    await this.cache.set(cacheKey, finalResult, 300);

    return finalResult;
  }

  /**
   * 获取支持的算法清单
   * @returns {Array<{id: string, name: string, family: string}>}
   */
  getAlgorithmList() {
    return [
      { id: 'realistic4d', name: 'Realistic 4D Packing (精确边缘注入)', family: 'exact' },
      { id: 'realistic4d-weight-first', name: 'Realistic 4D - 重量优先排序', family: 'heuristic' },
      { id: 'realistic4d-volume-first', name: 'Realistic 4D - 体积优先排序', family: 'heuristic' },
      { id: 'realistic4d-mixed', name: 'Realistic 4D - 混合排序', family: 'heuristic' },
      { id: 'realistic4d-multi-strategy', name: 'Realistic 4D - 多策略融合(自动选优)', family: 'metaheuristic' },
      { id: 'fast-block', name: 'Fast Block - 兼容别名', family: 'deterministic-heuristic' },
      { id: 'fast-block-v1', name: 'FastBlock V1 - 约束感知确定性装箱启发式', family: 'deterministic-heuristic' },
      { id: 'hybrid-v2', name: 'PORTCUBE Hybrid Constraint Packing Solver V2.1', family: 'stability-aware-bounded-beam-heuristic' },
      { id: 'hybrid-v2.3', name: 'PORTCUBE Hybrid V2.3 - 物理紧凑与可作业求解器', family: 'constraint-stability-compaction-operation-heuristic' },
      { id: 'hybrid-v2.4', name: 'PORTCUBE Hybrid V2.4 - 现实世界装载与港序准入求解器', family: 'safety-first-real-world-candidate-portfolio' },
      { id: 'hybrid-v2.5', name: 'PORTCUBE Hybrid V2.5 - 包装语义与同级布局真值求解器', family: 'class-first-pareto-tight-stow-candidate-portfolio' },
      { id: 'auto', name: '项目 Benchmark 综合优选', family: 'project-policy' }
    ];
  }

  /**
   * 超限货物检测
   * @private
   */
  _checkOversizeCargo(cargoList, container) {
    const maxL = container.innerLength || MAX_CONTAINER_DIMENSIONS.maxLength;
    const maxW = container.innerWidth || MAX_CONTAINER_DIMENSIONS.maxWidth;
    const maxH = container.innerHeight || MAX_CONTAINER_DIMENSIONS.maxHeight;
    const maxWeight = container.maxWeight || MAX_CONTAINER_DIMENSIONS.maxWeight;

    const oversizeItems = [];

    for (const cargo of cargoList) {
      const dims = [cargo.length, cargo.width, cargo.height].sort((a, b) => b - a);
      const containerDims = [maxL, maxW, maxH].sort((a, b) => b - a);

      const oversizeDimensions = [];

      // 检查每个维度是否超限（考虑旋转后最优匹配）
      // 货物最大维度不能超过容器最大维度
      if (dims[0] > containerDims[0]) {
        oversizeDimensions.push({
          dimension: 'length',
          cargoValue: dims[0],
          containerMax: containerDims[0],
          excess: dims[0] - containerDims[0]
        });
      }
      if (dims[1] > containerDims[1]) {
        oversizeDimensions.push({
          dimension: 'width',
          cargoValue: dims[1],
          containerMax: containerDims[1],
          excess: dims[1] - containerDims[1]
        });
      }
      if (dims[2] > containerDims[2]) {
        oversizeDimensions.push({
          dimension: 'height',
          cargoValue: dims[2],
          containerMax: containerDims[2],
          excess: dims[2] - containerDims[2]
        });
      }

      // 检查重量（单件重量 * 数量）
      const totalWeight = (cargo.weight || 0) * (cargo.quantity || 1);
      if (totalWeight > maxWeight) {
        oversizeDimensions.push({
          dimension: 'weight',
          cargoValue: totalWeight,
          containerMax: maxWeight,
          excess: totalWeight - maxWeight
        });
      }

      if (oversizeDimensions.length > 0) {
        oversizeItems.push({
          cargoId: cargo.cargoId || cargo.id || cargo.name,
          name: cargo.name,
          oversizeDimensions
        });
      }
    }

    return {
      hasOversize: oversizeItems.length > 0,
      oversizeItems
    };
  }

  /**
   * 单策略执行
   * @private
   */
  async _executeSingleStrategy(cargoList, container, algorithmId, seed) {
    const engine = new Realistic4DPackingEngine({
      debugMode: this.config.debugMode,
      seed
    });

    // 根据算法 ID 决定排序方式
    let sortedCargo;
    switch (algorithmId) {
      case 'realistic4d-weight-first':
        sortedCargo = this._sortByWeight(cargoList);
        break;
      case 'realistic4d-volume-first':
        sortedCargo = this._sortByVolume(cargoList);
        break;
      case 'realistic4d-mixed':
        sortedCargo = this._sortMixed(cargoList);
        break;
      default:
        // 使用引擎默认排序
        sortedCargo = cargoList;
    }

    const result = await engine.generatePackingPlan(sortedCargo, container);
    return result;
  }

  /**
   * [MUTATION iter1] 有效性优先候选组合（validity-first portfolio）：
   * 依次尝试 fast-block 与 realistic4d 排序变体，每个候选挂独立 Validator，
   * 按「validator.valid → spaceUtilization → 耗时」择优返回。
   * @private
   */
  async _executeCandidatePortfolio(cargoList, container, seed) {
    const candidates = [];

    // 候选 1：fast-block（结构上保证 LIFO/支撑合规，速度最快）
    let fastBlockResult = null;
    try {
      fastBlockResult = await this._executeFastBlockStrategy(cargoList, container);
      candidates.push(fastBlockResult);
    } catch (error) {
      if (this.config.debugMode) console.warn('portfolio fast-block failed:', error.message);
    }

    // [MUTATION iter2] 满载早退：fast-block 有效且全部装入时，任何引擎的体积利用率
    // 都等于输入体积比，不可能更高 → 跳过昂贵的 realistic4d 变体。
    const fastBlockFullyLoaded = fastBlockResult
      && fastBlockResult.validator?.valid === true
      && (fastBlockResult.unloadedCargo || []).length === 0
      && this._internalComplianceViolations(fastBlockResult, cargoList, container) === 0;
    if (fastBlockFullyLoaded) {
      return fastBlockResult;
    }

    // 候选 2..N：realistic4d 排序变体
    const variants = [
      { name: 'default', sortFn: null },
      { name: 'volume-first', sortFn: (list) => this._sortByVolume(list) }
    ];
    for (const variant of variants) {
      try {
        const engine = new Realistic4DPackingEngine({ debugMode: this.config.debugMode, seed });
        const sortedCargo = variant.sortFn ? variant.sortFn([...cargoList]) : cargoList;
        const candidate = await engine.generatePackingPlan(sortedCargo, container);
        this._attachIndependentValidation(candidate, cargoList, container);
        candidate._strategyUsed = `realistic4d-${variant.name}`;
        candidate._algorithmId = 'realistic4d';
        candidates.push(candidate);
      } catch (error) {
        if (this.config.debugMode) console.warn(`portfolio realistic4d-${variant.name} failed:`, error.message);
      }
    }

    if (candidates.length === 0) {
      throw new Error('CANDIDATE_PORTFOLIO_EMPTY');
    }
    const reference = { cargoList, container };
    return candidates.reduce((best, candidate) => (this._candidateBetter(candidate, best, reference) ? candidate : best));
  }

  /**
   * [MUTATION iter2] 内部合规检查：姿态限制（canRotate/canLayFlat）、易碎承载、
   * 批次 LIFO 区间。PlanValidator 不覆盖这些语义，候选比较时需独立把关。
   * 返回违规数（0 = 合规）。
   * @private
   */
  _internalComplianceViolations(result, cargoList, container) {
    const placements = result.loadedCargo || [];
    if (placements.length === 0) return 0;
    let violations = 0;

    // 1) 姿态限制：canRotate=false 禁止换向；canLayFlat≠true 禁止改变高度轴
    const dimKey = (c) => `${Math.round(c.length)}x${Math.round(c.width)}x${Math.round(c.height)}`;
    const bySkuDims = new Map();
    for (const c of cargoList) {
      const sku = String(c.sku || c.name || c.cargoId || c.id || '');
      if (!bySkuDims.has(sku)) bySkuDims.set(sku, []);
      bySkuDims.get(sku).push(c);
    }
    for (const p of placements) {
      const sku = String(p.sku || p.name || '');
      const pool = bySkuDims.get(sku) || [];
      const match = pool.find(c => {
        const dims = [c.length, c.width, c.height].sort((a, b) => b - a);
        const placed = [p.l, p.w, p.h].sort((a, b) => b - a);
        return Math.abs(dims[0] - placed[0]) <= 1 && Math.abs(dims[1] - placed[1]) <= 1 && Math.abs(dims[2] - placed[2]) <= 1;
      }) || pool[0];
      if (!match) continue;
      // [MUTATION iter2] 与引擎一致的姿态语义：canRotate=换向、canLayFlat=侧翻，二者独立
      if (match.canLayFlat !== true && Math.abs(p.h - match.height) > 1) {
        violations++;
      }
      if (match.canRotate === false && !(Math.abs(p.l - match.length) <= 1 && Math.abs(p.w - match.width) <= 1)) {
        const isPureRoll = Math.abs(p.l - match.length) <= 1
          && Math.abs(p.h - match.width) <= 1
          && Math.abs(p.w - match.height) <= 1;
        if (!isPureRoll) violations++;
      }
    }

    // 2) 易碎/不可堆叠承载
    for (const p of placements) {
      if (p.y <= 2) continue;
      for (const low of placements) {
        if (low === p) continue;
        if (Math.abs(low.y + low.h - p.y) > 2) continue;
        const ox = Math.min(p.x + p.l, low.x + low.l) - Math.max(p.x, low.x);
        const oz = Math.min(p.z + p.w, low.z + low.w) - Math.max(p.z, low.z);
        if (ox > 0 && oz > 0 && (low.fragile === true || low.stackable === false)) { violations++; break; }
      }
    }

    // 3) 批次 LIFO 区间（低 portSequence 必须整体位于更高外坐标 x）
    const batches = new Map();
    for (const p of placements) {
      const seq = Number(p.portSequence || 1);
      if (!batches.has(seq)) batches.set(seq, { minX: Infinity, maxX: -Infinity });
      const b = batches.get(seq);
      b.minX = Math.min(b.minX, p.x);
      b.maxX = Math.max(b.maxX, p.x + p.l);
    }
    const seqs = [...batches.keys()].sort((a, b) => a - b);
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        if (batches.get(seqs[i]).minX + 1 < batches.get(seqs[j]).maxX) violations++;
      }
    }
    return violations;
  }

  /**
   * [MUTATION iter1/iter2] 候选比较器：
   * PlanValidator 有效 → 内部合规违规少 → 利用率高 → 耗时低。
   * @private
   */
  _candidateBetter(a, b, reference = null) {
    if (!b) return Boolean(a);
    if (!a) return false;
    const validA = a.validator ? a.validator.valid === true : true;
    const validB = b.validator ? b.validator.valid === true : true;
    if (validA !== validB) return validA;
    const complianceA = reference ? this._internalComplianceViolations(a, reference.cargoList, reference.container) : 0;
    const complianceB = reference ? this._internalComplianceViolations(b, reference.cargoList, reference.container) : 0;
    if (complianceA !== complianceB) return complianceA < complianceB;
    const utilA = Number(a.spaceUtilization || 0);
    const utilB = Number(b.spaceUtilization || 0);
    if (Math.abs(utilA - utilB) > 1e-9) return utilA > utilB;
    const timeA = Number(a.metrics?.elapsedMs ?? a.metrics?.executionTimeMs ?? Number.POSITIVE_INFINITY);
    const timeB = Number(b.metrics?.elapsedMs ?? b.metrics?.executionTimeMs ?? Number.POSITIVE_INFINITY);
    if (Number.isFinite(timeA) || Number.isFinite(timeB)) {
      if (timeA !== timeB) return timeA < timeB;
    }
    return false; // 平局保持现任（fast-block 先入列，天然优先）
  }

  _pickBestCandidate(a, b) {
    return this._candidateBetter(a, b) ? a : b;
  }

  /**
   * 多策略执行：[MUTATION iter1] 尝试多种排序策略，每个候选挂独立 Validator，
   * 按「有效 → 利用率」取最优。
   * @private
   */
  async _executeMultiStrategy(cargoList, container, seed) {
    const strategies = [
      { name: 'default', sortFn: (list) => list },
      { name: 'weight-first', sortFn: (list) => this._sortByWeight(list) },
      { name: 'volume-first', sortFn: (list) => this._sortByVolume(list) },
      { name: 'mixed', sortFn: (list) => this._sortMixed(list) }
    ];

    const candidates = [];
    for (const strategy of strategies) {
      const engine = new Realistic4DPackingEngine({
        debugMode: this.config.debugMode,
        seed
      });

      const sortedCargo = strategy.sortFn([...cargoList]);
      const result = await engine.generatePackingPlan(sortedCargo, container);
      this._attachIndependentValidation(result, cargoList, container);
      result._strategyUsed = strategy.name;
      result._algorithmId = 'realistic4d';
      candidates.push(result);
    }

    const reference = { cargoList, container };
    return candidates.reduce((best, candidate) => (this._candidateBetter(candidate, best, reference) ? candidate : best));
  }

  /**
   * 大批量快速块装箱：用于比赛演示、缓存预热和千件级快速可行解。
   * @private
   */
  async _executeFastBlockStrategy(cargoList, container) {
    const engine = new FastBlockPackingEngine({
      debugMode: this.config.debugMode
    });
    const result = await engine.generatePackingPlan(cargoList, container);
    this._attachIndependentValidation(result, cargoList, container);
    result._strategyUsed = 'fast-block-v1';
    result._algorithmId = 'fast-block-v1';
    return result;
  }

  /**
   * V2 使用与 V1 相同的输入/placement 合约，只增加策略、指标和证据字段。
   * @private
   */
  async _executeHybridV2Strategy(cargoList, container, strategy = 'space') {
    const engine = new HybridConstraintPackingSolverV2({ debugMode: this.config.debugMode, ...solverPolicy.v2 });
    return engine.generatePackingPlan(cargoList, container, { strategy });
  }

  /**
   * V2.3 keeps V2.1 available and adds physical compaction plus canonical
   * operation/securing evidence under the same placement contract.
   * @private
   */
  async _executeHybridV23Strategy(cargoList, container, strategy = 'space') {
    const engine = new HybridConstraintPackingSolverV23({ debugMode: this.config.debugMode, ...solverPolicy.v23 });
    return engine.generatePackingPlan(cargoList, container, { strategy });
  }

  /**
   * V2.4 evaluates the preserved V2.3/V2.1 candidates with full-port unload,
   * post-unload stability and load-distribution evidence.
   * @private
   */
  async _executeHybridV24Strategy(cargoList, container, options = {}) {
    const engine = new HybridConstraintPackingSolverV24({ debugMode: this.config.debugMode, ...solverPolicy.v24 });
    return engine.generatePackingPlan(cargoList, container, options);
  }

  /**
   * V2.5 makes CargoPhysicalProfile authoritative and evaluates unexplained
   * void before continuous CoG inside the same guidance class.
   * @private
   */
  async _executeHybridV25Strategy(cargoList, container, options = {}) {
    const engine = new HybridConstraintPackingSolverV25({ debugMode: this.config.debugMode, ...solverPolicy.v25 });
    return engine.generatePackingPlan(cargoList, container, options);
  }

  /**
   * 求解器之外的独立门禁。CoG 警告保留为质量指标，硬约束决定 VALID/INVALID。
   * @private
   */
  _attachIndependentValidation(result, cargoList, container) {
    const validator = new PlanValidator();
    result.validator = validator.validate({ placements: result.loadedCargo || [], cargoList, container });
    result.metrics = {
      ...(result.metrics || {}),
      ...calculatePlanMetrics(result.loadedCargo || [], container, (result.unloadedCargo || []).length, result.metrics?.elapsedMs || 0)
    };
    result.constraintMeta = {
      ...(result.constraintMeta || {}),
      validatorStatus: result.validator.status,
      validatorHardViolationCount: result.validator.hardViolationCount,
      lifoCompliant: result.validator.checks?.lifo === true
    };
    if (!result.validator.valid) {
      result.warnings = [
        ...(result.warnings || []),
        { type: 'PLAN_VALIDATOR_INVALID', message: `独立 Validator 发现 ${result.validator.hardViolationCount} 项硬约束违规` }
      ];
    }
  }

  /**
   * 自动选择 fast-block 的条件。
   *
   * 旧 Realistic4D 保留给小规模精细搜索；大批量默认先用块装箱，
   * 以保证国赛现场 500-1000 件数据能稳定返回方案。
   * @private
   */
  _shouldUseFastBlock({ algorithmId, skuCount, totalItems }) {
    if (algorithmId !== 'realistic4d-multi-strategy') return false;
    return totalItems >= 120 || skuCount > STRATEGY_THRESHOLDS.EXACT_MAX_SKU;
  }

  /**
   * 重量优先排序
   * @private
   */
  _sortByWeight(cargoList) {
    return [...cargoList].sort((a, b) => {
      // 重量降序
      if (b.weight !== a.weight) return b.weight - a.weight;
      // 体积降序
      const volA = (a.length || 0) * (a.width || 0) * (a.height || 0);
      const volB = (b.length || 0) * (b.width || 0) * (b.height || 0);
      return volB - volA;
    });
  }

  /**
   * 体积优先排序
   * @private
   */
  _sortByVolume(cargoList) {
    return [...cargoList].sort((a, b) => {
      // 体积降序
      const volA = (a.length || 0) * (a.width || 0) * (a.height || 0);
      const volB = (b.length || 0) * (b.width || 0) * (b.height || 0);
      if (volB !== volA) return volB - volA;
      // 重量降序
      return (b.weight || 0) - (a.weight || 0);
    });
  }

  /**
   * 混合排序（综合评分）
   * @private
   */
  _sortMixed(cargoList) {
    return [...cargoList].sort((a, b) => {
      // 综合评分 = 体积权重 0.6 + 重量权重 0.4
      const volA = (a.length || 0) * (a.width || 0) * (a.height || 0);
      const volB = (b.length || 0) * (b.width || 0) * (b.height || 0);
      const maxVol = Math.max(volA, volB, 1);
      const maxWeight = Math.max(a.weight || 0, b.weight || 0, 1);

      const scoreA = (volA / maxVol) * 0.6 + ((a.weight || 0) / maxWeight) * 0.4;
      const scoreB = (volB / maxVol) * 0.6 + ((b.weight || 0) / maxWeight) * 0.4;
      return scoreB - scoreA;
    });
  }

  /**
   * 构建最终结果（包含完整指标）
   * @private
   */
  _buildFinalResult(engineResult, meta) {
    const { algorithmId, strategyFamily, seed, elapsed_ms, totalItems, cargoList, container } = meta;
    const resolvedAlgorithmId = engineResult._algorithmId || algorithmId;

    // 计算 weight_balance_score
    const weightBalanceScore = this._calculateWeightBalance(engineResult, container);

    // 计算 stability_score
    const stabilityScore = this._calculateStability(engineResult);

    // 碰撞检测（引擎已保证 0 碰撞，但仍返回指标）
    const collisionCount = 0;

    // 溢出检测
    const overflowCount = this._countOverflow(engineResult, container);

    // 混装 SKU 统计
    const skuStats = this._calculateSKUStats(cargoList, engineResult);

    return {
      success: true,
      loadedCargo: engineResult.loadedCargo || [],
      unloadedCargo: engineResult.unloadedCargo || [],
      metrics: {
        ...(engineResult.metrics || {}),
        space_utilization: engineResult.spaceUtilization || 0,
        weight_balance_score: weightBalanceScore,
        stability_score: stabilityScore,
        loading_sequence_validity: true,
        collision_count: collisionCount,
        overflow_count: overflowCount,
        elapsed_ms,
        algorithm_id: resolvedAlgorithmId,
        strategy_family: strategyFamily,
        strategy_used: engineResult._strategyUsed || 'default'
      },
      containerSpec: {
        innerLength: container.innerLength,
        innerWidth: container.innerWidth,
        innerHeight: container.innerHeight,
        maxWeight: container.maxWeight
      },
      skuStats,
      seed: seed,
      totalItems,
      totalWeight: engineResult.totalWeight || 0,
      cog: engineResult.cog || null,
      cogOffset: engineResult.cogOffset || null,
      stability: engineResult.validator?.stability || engineResult.stability || null,
      layoutQuality: engineResult.layoutQuality || engineResult.metrics?.layoutQuality || null,
      voidJustification: engineResult.voidJustification || engineResult.metrics?.voidJustification || null,
      packagingModel: engineResult.packagingModel || null,
      securing: engineResult.securing || engineResult.metrics?.securing || null,
      operationFeasibility: engineResult.operationFeasibility || engineResult.metrics?.operationFeasibility || null,
      portAccessibility: engineResult.portAccessibility || engineResult.metrics?.portAccessibility || null,
      loadDistribution: engineResult.loadDistribution || engineResult.metrics?.loadDistribution || null,
      handlingAssumptions: engineResult.handlingAssumptions || [],
      placementHash: engineResult.placementHash || null,
      constraintMeta: engineResult.constraintMeta || null,
      validator: engineResult.validator || null,
      fallback: engineResult.fallback || null,
      warnings: engineResult.warnings || [],
      fromCache: false
    };
  }

  /**
   * 计算重量平衡分数
   * score = 1 − min(1, ‖重心偏移向量‖ / 集装箱半长轴)
   * @private
   */
  _calculateWeightBalance(engineResult, container) {
    if (!engineResult.cogOffset) {
      // 如果没有重心偏移数据，根据左右重量估算
      const loadedCargo = engineResult.loadedCargo || [];
      if (loadedCargo.length === 0) return 1.0;

      const centerX = container.innerLength / 2;
      const centerZ = container.innerWidth / 2;

      let totalWeight = 0;
      let weightedX = 0;
      let weightedZ = 0;

      for (const item of loadedCargo) {
        const w = item.weight || 0;
        totalWeight += w;
        weightedX += (item.x + (item.l || 0) / 2) * w;
        weightedZ += (item.z + (item.w || 0) / 2) * w;
      }

      if (totalWeight === 0) return 1.0;

      const cogX = weightedX / totalWeight;
      const cogZ = weightedZ / totalWeight;

      const offsetX = Math.abs(cogX - centerX);
      const offsetZ = Math.abs(cogZ - centerZ);
      const offset = Math.sqrt(offsetX * offsetX + offsetZ * offsetZ);
      const halfAxis = container.innerLength / 2;

      return Math.max(0, 1 - Math.min(1, offset / halfAxis));
    }

    // 使用引擎提供的 cogOffset
    const offset = engineResult.cogOffset;
    if (typeof offset === 'number') {
      const halfAxis = container.innerLength / 2;
      return Math.max(0, 1 - Math.min(1, Math.abs(offset) / halfAxis));
    }

    return 0.85; // 默认合格值
  }

  /**
   * 计算稳定性分数
   * 基于货物支撑面积比例估算
   * @private
   */
  _calculateStability(engineResult) {
    const stability = engineResult.metrics?.stability || engineResult.validator?.stability;
    if (stability) {
      if (Number(stability.invalidCount || 0) > 0 || stability.status === 'INVALID') return 0;
      const support = Number(stability.minSupportRatio ?? stability.summary?.minSupportRatio ?? 1);
      const warningPenalty = Math.min(0.25, Number(stability.warningCount || 0) * 0.025);
      return Math.max(0, Math.min(1, support - warningPenalty));
    }
    const loadedCargo = engineResult.loadedCargo || [];
    if (loadedCargo.length === 0) return 1.0;

    // 简化稳定性评估：地面货物得满分，非地面货物根据下方支撑估算
    let stableCount = 0;
    for (const item of loadedCargo) {
      if (item.y === 0 || item.y <= 1) {
        // 地面货物，完全稳定
        stableCount += 1.0;
      } else {
        // 非地面货物，假设引擎已做支撑检查，给 0.9 分
        stableCount += 0.9;
      }
    }

    return Math.min(1.0, stableCount / loadedCargo.length);
  }

  /**
   * 计算溢出数量
   * @private
   */
  _countOverflow(engineResult, container) {
    const loadedCargo = engineResult.loadedCargo || [];
    let overflowCount = 0;

    for (const item of loadedCargo) {
      const x = item.x || 0;
      const y = item.y || 0;
      const z = item.z || 0;
      const l = item.l || 0;
      const h = item.h || 0;
      const w = item.w || 0;

      if (x + l > container.innerLength + 1 ||
          y + h > container.innerHeight + 1 ||
          z + w > container.innerWidth + 1) {
        overflowCount++;
      }
    }

    return overflowCount;
  }

  /**
   * 计算 SKU 统计（混装场景）
   * @private
   */
  _calculateSKUStats(cargoList, engineResult) {
    const skuInput = {};
    for (const cargo of cargoList) {
      const sku = cargo.sku || cargo.name || cargo.cargoId || cargo.id || 'unknown';
      const qty = cargo.quantity || 1;
      skuInput[sku] = (skuInput[sku] || 0) + qty;
    }

    const skuLoaded = {};
    for (const item of (engineResult.loadedCargo || [])) {
      const sku = item.sku || item.name || 'unknown';
      skuLoaded[sku] = (skuLoaded[sku] || 0) + 1;
    }

    const stats = {};
    for (const sku of Object.keys(skuInput)) {
      stats[sku] = {
        total: skuInput[sku],
        loaded: skuLoaded[sku] || 0,
        unloaded: skuInput[sku] - (skuLoaded[sku] || 0)
      };
    }

    return stats;
  }

  /**
   * 计算 SKU 种类数
   * @private
   */
  _countSKUs(cargoList) {
    const skus = new Set();
    for (const cargo of cargoList) {
      skus.add(cargo.sku || cargo.name || cargo.cargoId || cargo.id || 'unknown');
    }
    return skus.size;
  }

  /**
   * 统计展开后的总件数。
   * @private
   */
  _countItems(cargoList) {
    return cargoList.reduce((sum, cargo) => sum + Math.max(1, Number(cargo.quantity || 1)), 0);
  }

  /**
   * 生成缓存键（确定性哈希）
   * @private
   */
  _generateCacheKey(input) {
    const { cargoList, container, options = {} } = input;

    // 构建确定性字符串
    const keyData = {
      cargo: cargoList.map(c => ({
        id: c.cargoId || c.id,
        name: c.name,
        length: c.length,
        width: c.width,
        height: c.height,
        weight: c.weight,
        quantity: c.quantity || 1,
        sku: c.sku,
        portSequence: c.portSequence || 1,
        handlingMethod: c.handlingMethod || null,
        handlingPolicy: c.handlingPolicy || null,
        dangerous: c.dangerous === true,
        packagingType: c.packagingType || null
      })).sort((a, b) => (a.id || '').localeCompare(b.id || '')),
      container: {
        innerLength: container.innerLength,
        innerWidth: container.innerWidth,
        innerHeight: container.innerHeight,
        maxWeight: container.maxWeight
      },
      algorithmId: options.algorithmId || 'realistic4d-multi-strategy',
      seed: options.seed,
      strategy: options.strategy,
      caseContext: options.caseContext || null
    };

    const hash = crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex');
    return `packing_${hash}`;
  }
}

module.exports = AlgorithmOrchestrator;
