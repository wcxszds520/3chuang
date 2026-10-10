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
const { assertOrientationRules, orientationCacheIdentity } = require('./packing/OrientationConstraint');

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
    const algorithmId = options.algorithmId || 'auto';
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

    try { for (const cargo of cargoList) assertOrientationRules(cargo); }
    catch (error) { return { success: false, error: { code: error.code, message: error.message, details: error.details } }; }

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
    let resolvedAlgorithmId = algorithmId === 'auto' ? this.config.officialSolver : algorithmId;
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
    } else if (skuCount <= STRATEGY_THRESHOLDS.EXACT_MAX_SKU) {
      // 精确模式：单策略执行
      result = await this._executeSingleStrategy(cargoList, container, algorithmId, seed);
    } else {
      // 大批量模式：多策略排序尝试，取最优
      result = await this._executeMultiStrategy(cargoList, container, seed);
    }

    // Final trust boundary applies to every algorithm, including fallbacks.
    result.validator = new PlanValidator().validate({ placements: result.loadedCargo || [], cargoList,
      unloadedCargo: result.unloadedCargo || [], container, requireOrientationMetadata: true });
    if (!result.validator.valid && resolvedAlgorithmId.startsWith('realistic4d')) {
      const rejected = result.validator;
      result = await this._executeHybridV25Strategy(cargoList, container, options);
      result.fallback = { from: resolvedAlgorithmId, to: 'hybrid-v2.5', reason: 'LEGACY_CANDIDATE_FAILED_INDEPENDENT_VALIDATION', validator: rejected };
      result.warnings = [...(result.warnings || []), { type: 'LEGACY_SOLVER_FALLBACK', message: '旧求解器候选未通过独立门禁，已使用正式 V2.5 重新求解。' }];
      resolvedAlgorithmId = 'hybrid-v2.5';
      result.validator = new PlanValidator().validate({ placements: result.loadedCargo || [], cargoList,
        unloadedCargo: result.unloadedCargo || [], container, requireOrientationMetadata: true });
    }
    if (!result.validator.valid) {
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

    // CoG, handling and full-unload gates are part of the repaired solver's
    // admission decision, even when the geometric validator alone is valid.
    if (resolvedAlgorithmId === 'hybrid-v2.5' && result.hardConstraintsPass === false) {
      return {
        success: false,
        error: {
          code: 'NO_HARD_FEASIBLE_PLAN',
          message: '受控搜索尚未找到满足全部硬约束的方案；候选未进入 BACKEND_SOLVED',
          bestCandidate: {
            placementHash: result.placementHash,
            loadedCount: result.loadedCargo.length,
            checks: result.validator.checks,
            cog: result.metrics.cog,
            rearWall: result.metrics.rearWall,
            operationBlockedCount: result.operationFeasibility.blockedCount,
            portStatus: result.portAccessibility.status
          }
        }
      };
    }

    // 5. 构建完整结果
    const elapsed_ms = Date.now() - startTime;
    const finalResult = this._buildFinalResult(result, {
      algorithmId: resolvedAlgorithmId,
      requestedAlgorithmId: algorithmId,
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

      // 单件超重才是 oversize；总量超载应让求解器返回未装件，不能提前拒绝整批。
      const totalWeight = cargo.weight || 0;
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
   * 多策略执行：尝试多种排序策略，取空间利用率最高的结果
   * @private
   */
  async _executeMultiStrategy(cargoList, container, seed) {
    const strategies = [
      { name: 'default', sortFn: (list) => list },
      { name: 'weight-first', sortFn: (list) => this._sortByWeight(list) },
      { name: 'volume-first', sortFn: (list) => this._sortByVolume(list) },
      { name: 'mixed', sortFn: (list) => this._sortMixed(list) }
    ];

    let bestResult = null;
    let bestUtilization = -1;

    for (const strategy of strategies) {
      const engine = new Realistic4DPackingEngine({
        debugMode: this.config.debugMode,
        seed
      });

      const sortedCargo = strategy.sortFn([...cargoList]);
      const result = await engine.generatePackingPlan(sortedCargo, container);

      if (result.spaceUtilization > bestUtilization) {
        bestUtilization = result.spaceUtilization;
        bestResult = result;
        bestResult._strategyUsed = strategy.name;
      }
    }

    return bestResult;
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
      candidatePortfolio: engineResult.constraintMeta?.portfolio || engineResult.candidatePortfolio || null,
      solverSelection: {
        requestedAlgorithm: meta.requestedAlgorithmId || algorithmId,
        selectedAlgorithm: resolvedAlgorithmId,
        validation: 'INDEPENDENT_PLAN_VALIDATOR',
        externalStatus: 'RESEARCH_ONLY_NOT_PROMOTED',
        explanation: engineResult.fallback ? '请求候选未通过门禁，保留候选通过独立验证后返回' : '所选求解器候选通过独立几何、方向、支撑与作业路径门禁',
        hardConstraintsPass: engineResult.hardConstraintsPass ?? engineResult.validator?.valid ?? null
      },
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

    // Hash every request fact and policy, not a selected subset. A forgotten
    // stack/door/handling field must never reuse a previously valid old plan.
    // Preserve cargo ordering because it can affect deterministic tie breaks.
    const keyData = {
      cargo: cargoList.map(c => {
        const normalized = structuredClone(c);
        for (const holder of [normalized, normalized.externalMetadata, normalized.cargoPhysicalProfile, normalized.cargoPhysicalProfile?.solverEnvelope]) {
          if (holder) delete holder.orientationConstraints;
        }
        if (normalized.externalMetadata && !Object.keys(normalized.externalMetadata).length) delete normalized.externalMetadata;
        if (normalized.cargoPhysicalProfile?.solverEnvelope && !Object.keys(normalized.cargoPhysicalProfile.solverEnvelope).length) delete normalized.cargoPhysicalProfile.solverEnvelope;
        if (normalized.cargoPhysicalProfile && !Object.keys(normalized.cargoPhysicalProfile).length) delete normalized.cargoPhysicalProfile;
        return {...normalized, orientation: orientationCacheIdentity(c)};
      }),
      container,
      options,
      solverConfig: this.config,
      solverPolicy
    };

    // cache itself may contain mutable state; it is not an algorithm setting.
    const settings = {...this.config};
    delete settings.cache;
    keyData.solverConfig = settings;
    const stable = value => Array.isArray(value) ? value.map(stable)
      : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])) : value;
    const hash = crypto.createHash('sha256').update(JSON.stringify(stable(keyData))).digest('hex');
    return `packing_contract_r2_${hash}`;
  }
}

module.exports = AlgorithmOrchestrator;
