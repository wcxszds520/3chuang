/**
 * 优化版3D装箱算法引擎 - AI+传统混合架构
 * 
 * 核心特性：
 * 1. 基于改进的Guillotine + Maximal Rectangles算法
 * 2. 集成AI动态策略调优
 * 3. 多阶段优化：初始解 → 局部搜索 → 重心平衡
 * 4. 目标：空间利用率≥92%，10秒内完成
 * 
 * 算法流程：
 * Step 1: AI分析货物特征，生成优化策略
 * Step 2: 按策略排序货物（FFD/重量优先/高度优先）
 * Step 3: Guillotine切割算法生成初始方案
 * Step 4: 局部优化（交换、旋转、重排）
 * Step 5: 重心平衡调整
 */

const Cargo = require('../models/Cargo');
const ContainerType = require('../models/ContainerType');
const AIPackingService = require('./AIPackingService');

/**
 * 空间管理器 - 使用Guillotine算法管理空闲空间
 */
class SpaceManager {
  constructor(containerType) {
    this.containerType = containerType;
    this.freeRectangles = [];
    this.occupiedSpaces = [];
  }

  /**
   * 初始化空闲空间列表
   */
  initialize() {
    this.freeRectangles = [{
      x: 0,
      y: 0,
      z: 0,
      length: this.containerType.innerLength,
      width: this.containerType.innerWidth,
      height: this.containerType.innerHeight,
      volume: this.containerType.innerLength * 
              this.containerType.innerWidth * 
              this.containerType.innerHeight
    }];
  }

  /**
   * 查找最佳匹配矩形
   * @param {Object} rotation - 旋转后的尺寸 {length, width, height}
   * @returns {Object|null} 最佳匹配的矩形，如果没有则返回null
   */
  findBestFit(rotation) {
    // 过滤出能放下货物的矩形
    const candidates = this.freeRectangles.filter(rect => 
      rect.length >= rotation.length &&
      rect.width >= rotation.width &&
      rect.height >= rotation.height
    );
    
    if (candidates.length === 0) {
      return null;
    }
    
    // 优先选择z=0的矩形（地面），然后按体积升序排序（最紧密匹配）
    const sorted = candidates.sort((a, b) => {
      // 优先级1：z=0的矩形优先
      if (a.z === 0 && b.z !== 0) return -1;
      if (a.z !== 0 && b.z === 0) return 1;
      
      // 优先级2：体积小的优先（紧密匹配）
      return a.volume - b.volume;
    });
    
    return sorted[0];
  }

  /**
   * Guillotine切割 - 分割空闲矩形
   * @param {Object} rect - 被占用的矩形
   * @param {Object} position - 放置位置 {x, y, z}
   * @param {Object} rotation - 旋转后的尺寸 {length, width, height}
   */
  split(rect, position, rotation) {
    // 移除原矩形
    this.freeRectangles = this.freeRectangles.filter(r => r !== rect);
    
    const newRects = [];
    
    // 右侧剩余空间
    if (position.x + rotation.length < rect.x + rect.length) {
      newRects.push({
        x: position.x + rotation.length,
        y: rect.y,
        z: rect.z,
        length: rect.x + rect.length - (position.x + rotation.length),
        width: rect.width,
        height: rect.height
      });
    }
    
    // 前侧剩余空间
    if (position.y + rotation.width < rect.y + rect.width) {
      newRects.push({
        x: rect.x,
        y: position.y + rotation.width,
        z: rect.z,
        length: rotation.length,
        width: rect.y + rect.width - (position.y + rotation.width),
        height: rect.height
      });
    }
    
    // 顶部剩余空间
    if (position.z + rotation.height < rect.z + rect.height) {
      newRects.push({
        x: rect.x,
        y: rect.y,
        z: position.z + rotation.height,
        length: rect.length,
        width: rect.width,
        height: rect.z + rect.height - (position.z + rotation.height)
      });
    }
    
    // 计算体积并添加
    newRects.forEach(r => {
      r.volume = r.length * r.width * r.height;
      this.freeRectangles.push(r);
    });
    
    // 按体积降序排序
    this.freeRectangles.sort((a, b) => b.volume - a.volume);
  }

  /**
   * 记录已占用空间
   * @param {Object} position - 放置位置 {x, y, z}
   * @param {Object} rotation - 旋转后的尺寸 {length, width, height}
   */
  occupy(position, rotation) {
    this.occupiedSpaces.push({ position, rotation });
  }
}

/**
 * 堆叠管理器 - 管理货物堆叠约束和支撑关系
 */
class StackManager {
  constructor() {
    this.stackGraph = new Map(); // 堆叠关系图
  }

  /**
   * 检查是否可以堆叠
   * @param {Object} cargo - 货物对象
   * @param {Object} position - 放置位置 {x, y, z}
   * @param {Object} rotation - 旋转后的尺寸 {length, width, height}
   * @param {Array} placedCargo - 已放置的货物列表
   * @returns {boolean} 是否可以堆叠
   */
  canStack(cargo, position, rotation, placedCargo) {
      // 如果在地面上（z=0），直接允许
      if (position.z === 0) {
        return true;
      }

      // 查找下方货物
      const below = this.findCargoBelow(position, rotation, placedCargo);

      // 必须有下方支撑
      if (below.length === 0) {
        return false;
      }

      // 检查下方货物是否可堆叠
      for (let b of below) {
        if (!b.cargo.stackable) {
          return false;
        }
      }

      // 检查支撑面积（降低到10%要求，大幅提高装载率）
      const supportArea = this.calculateSupportArea(position, rotation, below);
      const cargoArea = rotation.length * rotation.width;
      const supportRatio = supportArea / cargoArea;

      if (supportRatio < 0.1) {
        return false;
      }

      return true;
    }


  /**
   * 递归检查堆叠链中的所有货物是否满足maxStackLayers约束
   * @param {Object} placed - 已放置的货物对象
   * @param {Array} placedCargo - 已放置的货物列表
   * @param {Set} visited - 已访问的货物集合（防止循环）
   * @returns {boolean} 是否满足约束
   */
  _checkStackChain(placed, placedCargo, visited) {
    const key = `${placed.position.x},${placed.position.y},${placed.position.z}`;
    if (visited.has(key)) return true;
    visited.add(key);
    
    // 检查当前货物的堆叠层数
    const layers = this.countLayers(placed, placedCargo);
    if (layers >= placed.cargo.maxStackLayers) {
      return false;
    }
    
    // 递归检查下方货物
    const below = this.findCargoBelow(placed.position, placed.rotation, placedCargo);
    for (let b of below) {
      if (!this._checkStackChain(b, placedCargo, visited)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 查找下方货物
   * @param {Object} position - 放置位置 {x, y, z}
   * @param {Object} rotation - 旋转后的尺寸 {length, width, height}
   * @param {Array} placedCargo - 已放置的货物列表
   * @returns {Array} 下方货物列表
   */
  findCargoBelow(position, rotation, placedCargo) {
    const tolerance = 1; // 1mm容差
    const below = [];
    
    for (let placed of placedCargo) {
      const pPos = placed.position;
      const pRot = placed.rotation;
      
      // 检查Z方向接触
      const zDiff = Math.abs(position.z - (pPos.z + pRot.height));
      if (zDiff > tolerance) continue;
      
      // 检查XY平面重叠
      const overlapX = !(position.x + rotation.length <= pPos.x || 
                        pPos.x + pRot.length <= position.x);
      const overlapY = !(position.y + rotation.width <= pPos.y || 
                        pPos.y + pRot.width <= position.y);
      
      if (overlapX && overlapY) {
        below.push(placed);
      }
    }
    
    return below;
  }

  /**
   * 计算支撑面积
   * @param {Object} position - 放置位置 {x, y, z}
   * @param {Object} rotation - 旋转后的尺寸 {length, width, height}
   * @param {Array} below - 下方货物列表
   * @returns {number} 支撑面积（mm²）
   */
  calculateSupportArea(position, rotation, below) {
    let totalArea = 0;
    
    for (let b of below) {
      const pPos = b.position;
      const pRot = b.rotation;
      
      // 计算重叠矩形
      const overlapX1 = Math.max(position.x, pPos.x);
      const overlapX2 = Math.min(position.x + rotation.length, 
                                  pPos.x + pRot.length);
      const overlapY1 = Math.max(position.y, pPos.y);
      const overlapY2 = Math.min(position.y + rotation.width, 
                                  pPos.y + pRot.width);
      
      if (overlapX2 > overlapX1 && overlapY2 > overlapY1) {
        const area = (overlapX2 - overlapX1) * (overlapY2 - overlapY1);
        totalArea += area;
      }
    }
    
    return totalArea;
  }

  /**
   * 计算堆叠层数
   * @param {Object} placed - 已放置的货物对象
   * @param {Array} placedCargo - 已放置的货物列表
   * @returns {number} 堆叠层数（0表示没有上方货物）
   */
  countLayers(placed, placedCargo) {
    const above = this.findCargoAbove(placed, placedCargo);
    if (above.length === 0) return 0;
    
    let maxLayers = 0;
    for (let a of above) {
      const layers = this.countLayers(a, placedCargo);
      maxLayers = Math.max(maxLayers, layers + 1);
    }
    
    return maxLayers;
  }

  /**
   * 查找上方货物
   * @param {Object} placed - 已放置的货物对象
   * @param {Array} placedCargo - 已放置的货物列表
   * @returns {Array} 上方货物列表
   */
  findCargoAbove(placed, placedCargo) {
    const tolerance = 1; // 1mm容差
    const above = [];
    
    const position = placed.position;
    const rotation = placed.rotation;
    
    for (let other of placedCargo) {
      if (other === placed) continue;
      
      const oPos = other.position;
      const oRot = other.rotation;
      
      // 检查Z方向接触（other在placed上方）
      const zDiff = Math.abs(oPos.z - (position.z + rotation.height));
      if (zDiff > tolerance) continue;
      
      // 检查XY平面重叠
      const overlapX = !(oPos.x + oRot.length <= position.x || 
                        position.x + rotation.length <= oPos.x);
      const overlapY = !(oPos.y + oRot.width <= position.y || 
                        position.y + rotation.width <= oPos.y);
      
      if (overlapX && overlapY) {
        above.push(other);
      }
    }
    
    return above;
  }
}

class OptimizedPackingEngine {
  constructor() {
        this.MAX_ITERATIONS = 2000; // 增加迭代次数以提高质量
        this.MAX_TIME_MS = 9000; // 最大9秒（留1秒给AI）
        this.aiService = new AIPackingService();
        this.stackManager = new StackManager(); // 堆叠管理器
        this.spaceManager = null; // 空间管理器（每次装箱时初始化）
        this.startTime = 0;

        // 调试模式 - 需求 9.5
        this.debugMode = false;
        this.debugLogs = []; // 存储调试日志

        // 标准柜型参数 - 需求 10.1, 10.3
        this.STANDARD_CONTAINER_TYPES = {
          '20GP': {
            typeId: '20GP',
            name: '20GP标准集装箱',
            innerLength: 5898,  // mm
            innerWidth: 2352,   // mm
            innerHeight: 2393,  // mm
            maxWeight: 21800    // kg
          },
          '40GP': {
            typeId: '40GP',
            name: '40GP标准集装箱',
            innerLength: 12032, // mm
            innerWidth: 2352,   // mm
            innerHeight: 2393,  // mm
            maxWeight: 26680    // kg
          },
          '40HQ': {
            typeId: '40HQ',
            name: '40HQ高柜集装箱',
            innerLength: 12032, // mm
            innerWidth: 2352,   // mm
            innerHeight: 2698,  // mm
            maxWeight: 26680    // kg
          }
        };
      }


  /**
   * 验证自定义柜型参数的有效性 - 需求 10.2
   * @param {Object} containerType - 柜型参数对象
   * @returns {Object} 验证结果 {valid: boolean, errors: Array<string>}
   */
  validateContainerType(containerType) {
    const errors = [];
    
    // 检查必需字段
    if (!containerType) {
      errors.push('柜型参数不能为空');
      return { valid: false, errors };
    }
    
    // 检查innerLength
    if (typeof containerType.innerLength !== 'number' || containerType.innerLength <= 0) {
      errors.push('innerLength必须是正数（单位：毫米）');
    }
    
    // 检查innerWidth
    if (typeof containerType.innerWidth !== 'number' || containerType.innerWidth <= 0) {
      errors.push('innerWidth必须是正数（单位：毫米）');
    }
    
    // 检查innerHeight
    if (typeof containerType.innerHeight !== 'number' || containerType.innerHeight <= 0) {
      errors.push('innerHeight必须是正数（单位：毫米）');
    }
    
    // 检查maxWeight
    if (typeof containerType.maxWeight !== 'number' || containerType.maxWeight <= 0) {
      errors.push('maxWeight必须是正数（单位：千克）');
    }
    
    // 合理性检查：尺寸不应过大或过小
    if (containerType.innerLength && (containerType.innerLength < 1000 || containerType.innerLength > 20000)) {
      errors.push('innerLength应在1000-20000mm范围内');
    }
    
    if (containerType.innerWidth && (containerType.innerWidth < 1000 || containerType.innerWidth > 5000)) {
      errors.push('innerWidth应在1000-5000mm范围内');
    }
    
    if (containerType.innerHeight && (containerType.innerHeight < 1000 || containerType.innerHeight > 5000)) {
      errors.push('innerHeight应在1000-5000mm范围内');
    }
    
    if (containerType.maxWeight && (containerType.maxWeight < 1000 || containerType.maxWeight > 50000)) {
      errors.push('maxWeight应在1000-50000kg范围内');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 根据货物总体积和重量推荐合适的柜型 - 需求 10.4
   * @param {Array} cargoList - 货物列表
   * @returns {Object} 推荐的柜型对象
   */
  recommendContainerType(cargoList) {
    // 计算货物总体积和总重量
    let totalVolume = 0;
    let totalWeight = 0;
    
    for (const cargo of cargoList) {
      const cargoVolume = cargo.length * cargo.width * cargo.height;
      totalVolume += cargoVolume * cargo.quantity;
      totalWeight += cargo.weight * cargo.quantity;
    }
    
    console.log(`货物总体积: ${(totalVolume / 1000000).toFixed(2)}m³, 总重量: ${totalWeight.toFixed(2)}kg`);
    
    // 考虑装箱效率，实际需要的空间约为货物体积的1.3倍
    const requiredVolume = totalVolume * 1.3;
    
    // 按容积从小到大检查标准柜型
    const containerTypes = ['20GP', '40GP', '40HQ'];
    
    for (const typeId of containerTypes) {
      const containerType = this.STANDARD_CONTAINER_TYPES[typeId];
      const containerVolume = containerType.innerLength * 
                             containerType.innerWidth * 
                             containerType.innerHeight;
      
      // 检查体积和重量是否都满足
      if (containerVolume >= requiredVolume && containerType.maxWeight >= totalWeight) {
        console.log(`推荐柜型: ${containerType.name}`);
        return containerType;
      }
    }
    
    // 如果所有标准柜型都不满足，返回最大的柜型（40HQ）
    console.log('货物超出所有标准柜型容量，推荐使用40HQ');
    return this.STANDARD_CONTAINER_TYPES['40HQ'];
  }


  /**
   * 生成装箱方案（主入口）
   * @param {Array} cargoList - 货物列表
   * @param {Object} containerType - 柜型参数
   * @param {Object} options - 可选参数 { debugMode: boolean, aiStrategy: Object }
   */
  async generatePackingPlan(cargoList, containerType, options = {}) {
    // 设置调试模式 - 需求 9.5
    this.debugMode = options.debugMode || false;
    this.debugLogs = []; // 重置调试日志
    
    // 在generatePackingPlan()开始时记录startTime - 需求 5.1, 5.3, 5.4
    this.startTime = Date.now();
    
    this._logAlgorithmStep('算法启动', {
      cargoCount: cargoList.length,
      containerType: containerType.name,
      debugMode: this.debugMode,
      hasAIStrategy: !!options.aiStrategy
    });
    
    console.log('=== 优化版装箱引擎启动 ===');
    console.log(`货物数量: ${cargoList.length}, 柜型: ${containerType.name}`);
    if (this.debugMode) {
      console.log('🔍 调试模式已启用');
    }
    if (options.aiStrategy) {
      console.log('🤖 使用AI深度策略');
    }
    
    // 验证自定义柜型参数 - 需求 10.2
    this._logAlgorithmStep('柜型参数验证', { containerType: containerType.name });
    const validation = this.validateContainerType(containerType);
    if (!validation.valid) {
      this._addDebugLog('ERROR', 'VALIDATION', '柜型参数验证失败', { errors: validation.errors });
      const error = new Error(`柜型参数验证失败: ${validation.errors.join(', ')}`);
      error.validationErrors = validation.errors;
      throw error;
    }
    
    try {
      // Step 1: 获取装箱策略
      let strategy;
      if (options.skipAIStrategy) {
        // 跳过AI策略，使用默认策略（宁波港模式）
        strategy = this._getDefaultStrategy();
        this._addDebugLog('INFO', 'STRATEGY', '跳过AI策略，使用默认策略', { strategy });
        console.log('🚢 宁波港模式：跳过AI策略优化');
      } else if (options.aiStrategy) {
        // 使用传入的AI深度策略
        strategy = options.aiStrategy;
        this._addDebugLog('INFO', 'STRATEGY', '使用AI深度策略', { strategy });
        console.log('🤖 AI深度策略:', strategy);
      } else {
        // AI策略优化（异步，最多1秒）
        this._logAlgorithmStep('AI策略优化', { timeout: '1秒' });
        strategy = await Promise.race([
          this.aiService.optimizePackingStrategy(cargoList, containerType),
          this._timeout(1000, this._getDefaultStrategy())
        ]);
        this._addDebugLog('INFO', 'STRATEGY', 'AI策略获取成功', { strategy });
        console.log('AI策略:', strategy);
      }
      
      // Step 2: 按策略排序货物
      this._logAlgorithmStep('货物排序', { strategy: strategy.sortStrategy || 'custom' });
      
      // 如果设置了preserveOrder，保持输入顺序（宁波港出货时间驱动）
      let sortedCargo;
      if (options.preserveOrder) {
        console.log('🚢 宁波港模式：保持出货时间驱动的装柜顺序');
        sortedCargo = this._sortCargoByStrategy(cargoList, { sortStrategy: 'preserve_order' });
      } else {
        sortedCargo = this._sortCargoByStrategy(cargoList, strategy);
      }
      
      // Step 3: 初始化方案
      const plan = {
        loadedCargo: [],
        unloadedCargo: [],
        occupiedSpaces: [],
        containerType: containerType,
        strategy: strategy
      };
      
      // Step 4: Guillotine算法生成初始方案
      this._guillotinePackingPhase(sortedCargo, plan, containerType, strategy);
      
      // Step 5: 局部优化
      if (this._hasTime()) {
        this._logAlgorithmStep('局部优化阶段');
        this._localOptimizationPhase(plan, containerType);
      } else {
        this._logLimitingFactor('时间不足，跳过局部优化');
      }
      
      // Step 6: 重心平衡
      if (this._hasTime()) {
        this._logAlgorithmStep('重心平衡阶段');
        this._balanceCenterOfGravity(plan, containerType);
      } else {
        this._logLimitingFactor('时间不足，跳过重心平衡');
      }
      
      // Step 7: 计算统计信息
      this._logAlgorithmStep('计算统计信息');
      plan.planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      plan.spaceUtilization = this._calculateSpaceUtilization(plan, containerType);
      plan.totalWeight = this._calculateTotalWeight(plan);
      plan.totalCargoCount = plan.loadedCargo.length;
      plan.centerOfGravity = this._calculateCenterOfGravity(plan, containerType);
      plan.loadDistribution = this._calculateLoadDistribution(plan, containerType);
      
      // Step 8: 合规性校验 - 需求 8
      this._logAlgorithmStep('合规性校验');
      plan.compliance = this._validateCompliance(plan, containerType);
      
      // Step 9: 生成3D可视化数据 - 需求 6
      this._logAlgorithmStep('生成可视化数据');
      plan.visualizationData = this.generateVisualizationData(plan);
      
      // 在返回前计算computationTime - 需求 5.4
      const computationTimeMs = Date.now() - this.startTime;
      plan.computationTime = parseFloat((computationTimeMs / 1000).toFixed(3)); // 转换为秒，保留3位小数
      
      // 当耗时超过8秒时记录性能警告 - 需求 5.3
      if (plan.computationTime > 8) {
        const warningMsg = `⚠️  性能警告: 计算耗时${plan.computationTime.toFixed(2)}秒，超过8秒阈值`;
        console.warn(warningMsg);
        plan.performanceWarning = warningMsg;
        this._logLimitingFactor('性能警告：计算耗时超过8秒', { computationTime: plan.computationTime });
      }
      
      // 检查是否达到目标利用率 - 需求 9.3
      const targetUtilization = 90;
      if (plan.spaceUtilization < targetUtilization) {
        this._logLimitingFactor(`未达到目标空间利用率${targetUtilization}%`, {
          actualUtilization: plan.spaceUtilization,
          targetUtilization,
          loadedCount: plan.loadedCargo.length,
          unloadedCount: plan.unloadedCargo.length,
          totalWeight: plan.totalWeight,
          maxWeight: containerType.maxWeight
        });
      }
      
      this._logAlgorithmStep('算法完成', {
        spaceUtilization: plan.spaceUtilization,
        totalWeight: plan.totalWeight,
        loadedCount: plan.loadedCargo.length,
        unloadedCount: plan.unloadedCargo.length,
        computationTime: plan.computationTime
      });
      
      console.log(`=== 装箱完成 ===`);
      console.log(`耗时: ${plan.computationTime.toFixed(2)}秒`);
      console.log(`已装载: ${plan.loadedCargo.length}, 未装载: ${plan.unloadedCargo.length}`);
      console.log(`空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
      
      // 调试：检查第一个货物是否有ETA
      if (plan.loadedCargo.length > 0) {
        const firstCargo = plan.loadedCargo[0].cargo;
        console.log('[调试] 第1个货物字段:', {
          name: firstCargo.name,
          hasEta: !!firstCargo.eta,
          eta: firstCargo.eta,
          hasPortSequence: !!firstCargo.portSequence,
          portSequence: firstCargo.portSequence
        });
      }
      
      // 添加调试日志到返回结果 - 需求 9.5
      if (this.debugMode) {
        plan.debugLogs = this.debugLogs;
        plan.debugSummary = this._getDebugSummary();
        console.log('\n=== 调试日志摘要 ===');
        console.log(`总日志数: ${plan.debugSummary.totalLogs}`);
        console.log(`放置尝试: ${plan.debugSummary.placementAttempts} (成功: ${plan.debugSummary.placementSuccesses}, 失败: ${plan.debugSummary.placementFailures})`);
        console.log(`限制因素数: ${plan.debugSummary.limitingFactors.length}`);
      }
      return plan;
    } catch (error) {
      console.error('装箱引擎错误:', error);
      throw error;
    }
  }


  /**
   * Guillotine切割算法 - 核心装箱逻辑（重构版使用SpaceManager）
   */
  _guillotinePackingPhase(sortedCargo, plan, containerType, strategy) {
    console.log('Phase 1: Guillotine切割算法（使用SpaceManager）');
    this._logAlgorithmStep('Guillotine装箱阶段', { cargoCount: sortedCargo.length });
    
    // 初始化SpaceManager
    this.spaceManager = new SpaceManager(containerType);
    this.spaceManager.initialize();
    
    let loadingOrder = 0;
    let attemptedPositions = []; // 记录尝试的位置
    
    // 遍历排序后的货物列表
    for (let cargo of sortedCargo) {
      if (!this._hasTime()) {
        this._logLimitingFactor('时间不足，停止装箱', { 
          remainingCargo: sortedCargo.length - plan.loadedCargo.length 
        });
        break;
      }
      
      // 生成所有可能的旋转方向
      const rotations = this._generateRotations(cargo, strategy);
      attemptedPositions = []; // 重置尝试记录
      
      let placed = false;
      let failureReasons = [];
      
      // 对每个货物尝试所有旋转方向
      for (let rotation of rotations) {
        if (placed) break;
        
        // 使用SpaceManager.findBestFit()查找最佳位置
        const rect = this.spaceManager.findBestFit(rotation);
        
        if (!rect) {
          failureReasons.push('无可用空间匹配此旋转方向');
          continue;
        }
        
        const position = { x: rect.x, y: rect.y, z: rect.z };
        attemptedPositions.push({ position, rotation, rect });
        
        // 调用_canPlaceCargo()验证所有约束
        if (this._canPlaceCargo(cargo, position, rotation, plan, containerType)) {
          // 放置货物
          loadingOrder++;
          
          // 调用StackManager.countLayers()获取stackLevel
          const stackLevel = this._getStackLevel(position, rotation, plan);
          
          // 记录放置决策 - 需求 9.1
          this._logPlacementDecision(
            cargo, 
            position, 
            rotation, 
            true, 
            `最佳匹配空间 (体积: ${rect.volume.toFixed(0)}mm³, 层级: ${stackLevel})`
          );
          
          plan.loadedCargo.push({
            cargo: cargo,
            position: position,
            rotation: rotation,
            loadingOrder: loadingOrder,
            stackLevel: stackLevel
          });
          
          // 调用SpaceManager.split()更新空间
          this.spaceManager.split(rect, position, rotation);
          
          // 记录已占用空间
          this.spaceManager.occupy(position, rotation);
          plan.occupiedSpaces.push({
            position: position,
            rotation: rotation
          });
          
          placed = true;
        } else {
          failureReasons.push(`位置 (${position.x},${position.y},${position.z}) 约束检查失败`);
        }
      }
      
      // 如果无法放置，添加到未装载列表
      if (!placed) {
        const reason = this._getUnloadedReason(cargo, containerType);
        
        // 记录放置失败 - 需求 9.1
        this._logPlacementDecision(cargo, null, null, false, reason);
        
        // 记录尝试的位置 - 需求 9.2
        if (attemptedPositions.length > 0) {
          this._logPositionAttempts(
            cargo,
            attemptedPositions,
            null,
            `所有 ${attemptedPositions.length} 个位置都不满足约束条件`
          );
        }
        
        plan.unloadedCargo.push({
          cargo: cargo,
          reason: reason
        });
      }
    }
    
    this._logAlgorithmStep('Guillotine装箱完成', {
      loadedCount: plan.loadedCargo.length,
      unloadedCount: plan.unloadedCargo.length,
      freeRectanglesRemaining: this.spaceManager.freeRectangles.length
    });
  }

  /**
   * 获取货物的堆叠层级
   * @param {Object} position - 放置位置 {x, y, z}
   * @param {Object} rotation - 旋转后的尺寸 {length, width, height}
   * @param {Object} plan - 装箱方案
   * @returns {number} 堆叠层级（0=底层）
   */
  _getStackLevel(position, rotation, plan) {
    if (position.z === 0) return 0;
    
    // 查找下方货物
    const below = this.stackManager.findCargoBelow(position, rotation, plan.loadedCargo);
    
    if (below.length === 0) return 0;
    
    // 返回下方货物的最大层级 + 1
    let maxLevel = 0;
    for (let b of below) {
      maxLevel = Math.max(maxLevel, b.stackLevel + 1);
    }
    
    return maxLevel;
  }

  /**
   * 局部优化阶段 - 提升空间利用率
   * 需求: 1.2, 5.2
   * 
   * 尝试以下优化策略：
   * 1. 交换相邻货物位置
   * 2. 调整货物旋转方向
   * 3. 如果优化后空间利用率提升则保留
   */
  _localOptimizationPhase(plan, containerType) {
    console.log('Phase 2: 局部优化');
    
    // 记录初始空间利用率
    const initialUtilization = this._calculateSpaceUtilization(plan, containerType);
    console.log(`初始空间利用率: ${initialUtilization.toFixed(2)}%`);
    
    const maxAttempts = 50;
    let swapImprovements = 0;
    let rotationImprovements = 0;
    
    for (let i = 0; i < maxAttempts && this._hasTime(); i++) {
      if (plan.loadedCargo.length < 2) break;
      
      // 策略1: 尝试交换相邻货物位置
      const idx1 = Math.floor(Math.random() * plan.loadedCargo.length);
      const idx2 = Math.floor(Math.random() * plan.loadedCargo.length);
      
      if (idx1 !== idx2) {
        const beforeUtilization = this._calculateSpaceUtilization(plan, containerType);
        
        if (this._trySwapCargo(plan, idx1, idx2, containerType)) {
          const afterUtilization = this._calculateSpaceUtilization(plan, containerType);
          
          // 如果优化后空间利用率提升则保留
          if (afterUtilization > beforeUtilization) {
            swapImprovements++;
            this._addDebugLog('DEBUG', 'OPTIMIZATION', '交换货物成功提升利用率', {
              idx1, idx2,
              improvement: (afterUtilization - beforeUtilization).toFixed(4)
            });
          } else {
            // 否则回滚
            this._trySwapCargo(plan, idx1, idx2, containerType);
          }
        }
      }
      
      // 策略2: 尝试调整货物旋转方向
      if (this._hasTime() && plan.loadedCargo.length > 0) {
        const idx = Math.floor(Math.random() * plan.loadedCargo.length);
        const beforeUtilization = this._calculateSpaceUtilization(plan, containerType);
        
        if (this._tryRotateCargo(plan, idx, containerType)) {
          const afterUtilization = this._calculateSpaceUtilization(plan, containerType);
          
          // 如果优化后空间利用率提升则保留
          if (afterUtilization > beforeUtilization) {
            rotationImprovements++;
            this._addDebugLog('DEBUG', 'OPTIMIZATION', '旋转货物成功提升利用率', {
              idx,
              improvement: (afterUtilization - beforeUtilization).toFixed(4)
            });
          } else {
            // 否则回滚（尝试恢复原旋转）
            this._tryRotateCargo(plan, idx, containerType);
          }
        }
      }
    }
    
    // 记录最终空间利用率
    const finalUtilization = this._calculateSpaceUtilization(plan, containerType);
    const improvement = finalUtilization - initialUtilization;
    
    this._addDebugLog('INFO', 'OPTIMIZATION', '局部优化完成', {
      swapImprovements,
      rotationImprovements,
      initialUtilization: initialUtilization.toFixed(2),
      finalUtilization: finalUtilization.toFixed(2),
      improvement: improvement.toFixed(2)
    });
    
    console.log(`局部优化完成 - 交换改进: ${swapImprovements}次, 旋转改进: ${rotationImprovements}次`);
    console.log(`最终空间利用率: ${finalUtilization.toFixed(2)}% (提升: ${improvement.toFixed(2)}%)`);
  }

  /**
   * 尝试交换两个货物的位置
   */
  _trySwapCargo(plan, idx1, idx2, containerType) {
    const cargo1 = plan.loadedCargo[idx1];
    const cargo2 = plan.loadedCargo[idx2];
    
    // 保存原始状态
    const origPos1 = { ...cargo1.position };
    const origPos2 = { ...cargo2.position };
    const origRot1 = { ...cargo1.rotation };
    const origRot2 = { ...cargo2.rotation };
    
    // 尝试交换
    cargo1.position = origPos2;
    cargo2.position = origPos1;
    
    // 检查是否仍然有效
    const valid1 = this._isValidPlacement(cargo1.cargo, cargo1.position, cargo1.rotation, plan, containerType, idx1);
    const valid2 = this._isValidPlacement(cargo2.cargo, cargo2.position, cargo2.rotation, plan, containerType, idx2);
    
    if (valid1 && valid2) {
      // 交换成功
      plan.occupiedSpaces[idx1].position = cargo1.position;
      plan.occupiedSpaces[idx2].position = cargo2.position;
      return true;
    } else {
      // 恢复原状
      cargo1.position = origPos1;
      cargo2.position = origPos2;
      return false;
    }
  }

  /**
   * 尝试调整货物的旋转方向
   * @param {Object} plan - 装箱方案
   * @param {number} idx - 货物索引
   * @param {Object} containerType - 集装箱类型
   * @returns {boolean} 是否成功调整旋转
   */
  _tryRotateCargo(plan, idx, containerType) {
    const loaded = plan.loadedCargo[idx];
    const cargo = loaded.cargo;
    const position = loaded.position;
    
    // 保存原始旋转
    const origRotation = { ...loaded.rotation };
    
    // 生成所有可能的旋转方向
    const strategy = this._getDefaultStrategy();
    const rotations = this._generateRotations(cargo, strategy);
    
    // 尝试每个旋转方向（跳过当前旋转）
    for (let rotation of rotations) {
      // 跳过当前旋转
      if (rotation.length === origRotation.length &&
          rotation.width === origRotation.width &&
          rotation.height === origRotation.height) {
        continue;
      }
      
      // 尝试新旋转
      loaded.rotation = rotation;
      plan.occupiedSpaces[idx].rotation = rotation;
      
      // 检查是否仍然有效
      if (this._isValidPlacement(cargo, position, rotation, plan, containerType, idx)) {
        // 旋转成功
        return true;
      }
    }
    
    // 所有旋转都失败，恢复原状
    loaded.rotation = origRotation;
    plan.occupiedSpaces[idx].rotation = origRotation;
    return false;
  }

  /**
   * 重心平衡调整
   */
  _balanceCenterOfGravity(plan, containerType) {
    console.log('Phase 3: 重心平衡');
    
    const cog = this._calculateCenterOfGravity(plan, containerType);
    const containerCenter = {
      x: containerType.innerLength / 2,
      y: containerType.innerWidth / 2,
      z: containerType.innerHeight / 2
    };
    
    const xDeviation = Math.abs(cog.x - containerCenter.x) / containerType.innerLength * 100;
    const yDeviation = Math.abs(cog.y - containerCenter.y) / containerType.innerWidth * 100;
    
    console.log(`重心偏差 - X: ${xDeviation.toFixed(2)}%, Y: ${yDeviation.toFixed(2)}%`);
    
    // 输出重心偏移警告（如果有）
    if (cog.warning) {
      console.log(`⚠️  ${cog.warning}`);
    }
    
    // 如果偏差过大，尝试调整
    if (xDeviation > 10 || yDeviation > 5) {
      console.log('重心偏差过大，尝试调整...');
      // TODO: 实现重心调整逻辑（移动重货）
    }
  }


  /**
   * 按策略排序货物
   */
  _sortCargoByStrategy(cargoList, strategy) {
      // 展开货物数量（需求 7.2, 7.3, 7.4）
      const expandedCargo = [];
      cargoList.forEach(cargo => {
        for (let i = 0; i < cargo.quantity; i++) {
          const singleCargo = new Cargo({
            cargoId: cargo.cargoId,
            name: cargo.name,
            length: cargo.length,
            width: cargo.width,
            height: cargo.height,
            weight: cargo.weight,
            quantity: 1,
            stackable: cargo.stackable,
            maxStackLayers: cargo.maxStackLayers,
            canInvert: cargo.canInvert,
            canLayFlat: cargo.canLayFlat,
            // 宁波港出货时间字段
            eta: cargo.eta,
            portSequence: cargo.portSequence,
            cyClosing: cargo.cyClosing,
            customsDeclaration: cargo.customsDeclaration
          });
          singleCargo.originalId = cargo.cargoId;
          singleCargo.instanceId = `${cargo.cargoId}_${i + 1}`;
          singleCargo.dropOrder = cargo.dropOrder || 2;
          expandedCargo.push(singleCargo);
        }
      });

      // 🆕 如果策略包含AI的loadingOrder，使用AI排序
      if (strategy.loadingOrder && Array.isArray(strategy.loadingOrder) && strategy.loadingOrder.length > 0) {
        console.log('🤖 使用AI深度策略的loadingOrder进行排序');
        return this._sortByAILoadingOrder(expandedCargo, strategy.loadingOrder);
      }

      // 根据策略排序
      switch (strategy.sortStrategy) {
        case 'preserve_order':
          // 保持输入顺序（宁波港出货时间驱动模式）
          console.log('🚢 保持宁波港出货时间驱动顺序，不重新排序');
          // 不排序，保持原顺序
          break;
        case 'volume_desc':
          // 按体积降序排序
          expandedCargo.sort((a, b) => b.getVolume() - a.getVolume());
          break;
        case 'weight_desc':
          // 按重量降序排序
          expandedCargo.sort((a, b) => b.weight - a.weight);
          break;
        case 'stacking_priority':
        case 'stackable_first':
          // 按堆叠能力优先排序（maxStackLayers高的优先）- 需求 2.2
          expandedCargo.sort((a, b) => {
            // 首先按可堆叠性排序
            if (a.stackable !== b.stackable) {
              return b.stackable ? 1 : -1;
            }
            // 然后按最大堆叠层数降序
            if (a.maxStackLayers !== b.maxStackLayers) {
              return b.maxStackLayers - a.maxStackLayers;
            }
            // 最后按体积降序
            return b.getVolume() - a.getVolume();
          });
          break;
        case 'composite_score':
          // 综合评分排序策略 - 需求 5.2
          expandedCargo.sort((a, b) => {
            const scoreA = this._calculateCompositeScore(a);
            const scoreB = this._calculateCompositeScore(b);
            return scoreB - scoreA;
          });
          break;
        case 'height_asc':
          expandedCargo.sort((a, b) => a.height - b.height);
          break;
        default:
          // 默认按体积降序
          expandedCargo.sort((a, b) => b.getVolume() - a.getVolume());
      }

      console.log(`货物排序完成（策略: ${strategy.sortStrategy}），总数: ${expandedCargo.length}`);
      return expandedCargo;
    }

    /**
     * 🆕 按AI的loadingOrder排序货物
     * @param {Array} expandedCargo - 展开后的货物列表
     * @param {Array} loadingOrder - AI推荐的装载顺序（货物名称数组）
     * @returns {Array} 排序后的货物列表
     */
    _sortByAILoadingOrder(expandedCargo, loadingOrder) {
      // 创建名称到优先级的映射
      const priorityMap = {};
      loadingOrder.forEach((name, index) => {
        priorityMap[name] = index;
      });

      // 按AI的loadingOrder排序
      expandedCargo.sort((a, b) => {
        const priorityA = priorityMap[a.name] !== undefined ? priorityMap[a.name] : 9999;
        const priorityB = priorityMap[b.name] !== undefined ? priorityMap[b.name] : 9999;
        
        // 优先级数字越小越优先
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // 如果优先级相同，按体积降序
        return b.getVolume() - a.getVolume();
      });

      console.log(`🤖 AI排序完成，装载顺序: ${loadingOrder.join(' → ')}`);
      return expandedCargo;
    }

    /**
     * 计算货物的综合评分
     * 综合考虑体积、重量、堆叠能力等因素
     */
    _calculateCompositeScore(cargo) {
      const volume = cargo.getVolume();
      const weight = cargo.weight;
      const stackability = cargo.stackable ? cargo.maxStackLayers : 0;

      // 归一化因子（根据典型值调整）
      const volumeWeight = 0.4;
      const weightWeight = 0.3;
      const stackWeight = 0.3;

      // 综合评分 = 体积权重 * 体积 + 重量权重 * 重量 + 堆叠权重 * 堆叠层数
      const score = (volumeWeight * volume / 1000000) + // 体积转换为立方米
                    (weightWeight * weight) +
                    (stackWeight * stackability * 10); // 堆叠层数放大10倍以增加权重

      return score;
    }


  /**
   * 生成旋转方向（根据策略优化）
   */
  _generateRotations(cargo, strategy) {
    const rotations = [];
    const dimensions = [
      { length: cargo.length, width: cargo.width, height: cargo.height, rotation: { x: 0, y: 0, z: 0 } },
      { length: cargo.width, width: cargo.length, height: cargo.height, rotation: { x: 0, y: 0, z: 90 } },
      { length: cargo.length, width: cargo.height, height: cargo.width, rotation: { x: 90, y: 0, z: 0 } },
      { length: cargo.height, width: cargo.width, height: cargo.length, rotation: { x: 0, y: 90, z: 0 } },
      { length: cargo.width, width: cargo.height, height: cargo.length, rotation: { x: 90, y: 0, z: 90 } },
      { length: cargo.height, width: cargo.length, height: cargo.width, rotation: { x: 0, y: 90, z: 90 } }
    ];
    
    // 根据约束条件过滤
    for (let dim of dimensions) {
      if (!cargo.canInvert && dim.height !== cargo.height) continue;
      if (!cargo.canLayFlat && (dim.length === cargo.height || dim.width === cargo.height)) continue;
      rotations.push(dim);
    }
    
    if (rotations.length === 0) {
      rotations.push(dimensions[0]);
    }
    
    // 根据策略排序旋转
    switch (strategy.rotationPriority) {
      case 'height_min':
        rotations.sort((a, b) => a.height - b.height);
        break;
      case 'volume_max':
        rotations.sort((a, b) => (b.length * b.width * b.height) - (a.length * a.width * a.height));
        break;
      case 'stability_max':
        // 优先选择底面积大的
        rotations.sort((a, b) => (b.length * b.width) - (a.length * a.width));
        break;
      default:
        rotations.sort((a, b) => a.height - b.height);
    }
    
    return rotations;
  }


  /**
   * 检查是否可以放置货物（综合约束检查）
   * 需求: 8.1, 8.2, 8.3, 8.4
   */
  _canPlaceCargo(cargo, position, rotation, plan, containerType) {
    // 检查边界约束（不超出集装箱）- 需求 8.2
    if (position.x + rotation.length > containerType.innerLength ||
        position.y + rotation.width > containerType.innerWidth ||
        position.z + rotation.height > containerType.innerHeight) {
      return false;
    }
    
    // 检查碰撞检测（不与已放置货物重叠）- 需求 8.3
    for (let occupied of plan.occupiedSpaces) {
      if (this._isOverlapping(position, rotation, occupied.position, occupied.rotation)) {
        return false;
      }
    }
    
    // 检查总重量限制 - 需求 8.1
    const currentWeight = this._calculateTotalWeight(plan);
    if (currentWeight + cargo.weight > containerType.maxWeight) {
      return false;
    }
    
    // 调用StackManager.canStack()检查堆叠约束 - 需求 8.4
    if (!this.stackManager.canStack(cargo, position, rotation, plan.loadedCargo)) {
      return false;
    }
    
    return true;
  }

  /**
   * 检查有效放置（用于局部优化）
   */
  _isValidPlacement(cargo, position, rotation, plan, containerType, skipIndex) {
    // 检查边界
    if (position.x + rotation.length > containerType.innerLength ||
        position.y + rotation.width > containerType.innerWidth ||
        position.z + rotation.height > containerType.innerHeight) {
      return false;
    }
    
    // 检查碰撞（跳过自己）
    for (let i = 0; i < plan.occupiedSpaces.length; i++) {
      if (i === skipIndex) continue;
      const occupied = plan.occupiedSpaces[i];
      if (this._isOverlapping(position, rotation, occupied.position, occupied.rotation)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 检查两个货物是否重叠
   */
  _isOverlapping(pos1, rot1, pos2, rot2) {
    return !(
      pos1.x + rot1.length <= pos2.x ||
      pos2.x + rot2.length <= pos1.x ||
      pos1.y + rot1.width <= pos2.y ||
      pos2.y + rot2.width <= pos1.y ||
      pos1.z + rot1.height <= pos2.z ||
      pos2.z + rot2.height <= pos1.z
    );
  }

  /**
     * 计算空间利用率
     * 使用实际占用体积计算空间利用率百分比
     * @param {Object} plan - 装箱方案
     * @param {Object} containerType - 集装箱类型
     * @returns {number} 空间利用率百分比（保留两位小数）
     */
    _calculateSpaceUtilization(plan, containerType) {
      // 计算集装箱可用体积
      const containerVolume = containerType.innerLength * 
                             containerType.innerWidth * 
                             containerType.innerHeight;

      // 调用_calculateActualOccupiedVolume()获取实际占用体积
      const usedVolume = this._calculateActualOccupiedVolume(plan);

      // 计算百分比并保留两位小数
      const utilization = (usedVolume / containerVolume) * 100;
      return Math.round(utilization * 100) / 100;
    }

  /**
     * 计算实际占用体积
     * 遍历所有已放置货物，累加每个货物的旋转后体积
     * @param {Object} plan - 装箱方案
     * @returns {number} 总占用体积（mm³）
     */
    _calculateActualOccupiedVolume(plan) {
      let totalVolume = 0;

      for (let loaded of plan.loadedCargo) {
        // 使用旋转后的实际尺寸计算体积
        const rotation = loaded.rotation;
        const volume = rotation.length * rotation.width * rotation.height;
        totalVolume += volume;
      }

      return totalVolume;
    }

  /**
   * 计算总重量
   */
  _calculateTotalWeight(plan) {
    let totalWeight = 0;
    for (let loaded of plan.loadedCargo) {
      totalWeight += loaded.cargo.weight;
    }
    return totalWeight;
  }

  /**
   * 计算重心
   */
  /**
     * 计算重心（基于实际三维位置）
     * @param {Object} plan - 装箱方案
     * @param {Object} containerType - 集装箱类型（可选，用于计算偏移）
     * @returns {Object} 重心坐标 {x, y, z} 和偏移信息
     */
    _calculateCenterOfGravity(plan, containerType = null) {
      if (plan.loadedCargo.length === 0) {
        return { 
          x: 0, 
          y: 0, 
          z: 0,
          offset: null,
          warning: null
        };
      }

      let totalWeight = 0, weightedX = 0, weightedY = 0, weightedZ = 0;

      for (let loaded of plan.loadedCargo) {
        const cargo = loaded.cargo;
        const position = loaded.position;
        const rotation = loaded.rotation;

        const centerX = position.x + rotation.length / 2;
        const centerY = position.y + rotation.width / 2;
        const centerZ = position.z + rotation.height / 2;

        totalWeight += cargo.weight;
        weightedX += cargo.weight * centerX;
        weightedY += cargo.weight * centerY;
        weightedZ += cargo.weight * centerZ;
      }

      const cog = {
        x: weightedX / totalWeight,
        y: weightedY / totalWeight,
        z: weightedZ / totalWeight
      };

      // 如果提供了集装箱类型，计算偏移和警告
      if (containerType) {
        const containerCenter = {
          x: containerType.innerLength / 2,
          y: containerType.innerWidth / 2,
          z: containerType.innerHeight / 2
        };

        const offset = {
          x: cog.x - containerCenter.x,
          y: cog.y - containerCenter.y,
          z: cog.z - containerCenter.z
        };

        // 计算偏移距离
        const offsetDistance = Math.sqrt(
          offset.x * offset.x + 
          offset.y * offset.y + 
          offset.z * offset.z
        );

        // 检查是否超过集装箱长度的5%
        const threshold = containerType.innerLength * 0.05;

        cog.offset = offset;
        cog.offsetDistance = offsetDistance;

        if (offsetDistance > threshold) {
          cog.warning = `重心偏移${(offsetDistance / 10).toFixed(1)}cm，超过集装箱长度的${((offsetDistance / containerType.innerLength) * 100).toFixed(1)}%`;
        } else {
          cog.warning = null;
        }
      }

      return cog;
    }
    /**
     * 计算载荷分布（基于实际位置）
     * 将集装箱分为前后左右四个区域，计算每个区域的重量分布
     *
     * @param {Object} plan - 装箱方案
     * @param {Object} containerType - 集装箱类型
     * @returns {Object} LoadDistribution对象
     */
    _calculateLoadDistribution(plan, containerType) {
      if (plan.loadedCargo.length === 0) {
        return {
          front: 0,
          back: 0,
          left: 0,
          right: 0,
          frontPercent: 0,
          backPercent: 0,
          leftPercent: 0,
          rightPercent: 0,
          frontBackImbalance: 0,
          leftRightImbalance: 0,
          warning: null
        };
      }

      // 计算集装箱中心线
      const centerX = containerType.innerLength / 2;
      const centerY = containerType.innerWidth / 2;

      // 初始化四个区域的重量
      let frontWeight = 0;  // X > centerX (前部)
      let backWeight = 0;   // X <= centerX (后部)
      let leftWeight = 0;   // Y <= centerY (左侧)
      let rightWeight = 0;  // Y > centerY (右侧)

      // 遍历所有已放置货物
      for (let loaded of plan.loadedCargo) {
        const cargo = loaded.cargo;
        const position = loaded.position;
        const rotation = loaded.rotation;

        // 计算货物中心点
        const centerCargoX = position.x + rotation.length / 2;
        const centerCargoY = position.y + rotation.width / 2;

        // 根据中心点确定所属区域并累加重量
        // 前后方向（X轴）
        if (centerCargoX > centerX) {
          frontWeight += cargo.weight;
        } else {
          backWeight += cargo.weight;
        }

        // 左右方向（Y轴）
        if (centerCargoY > centerY) {
          rightWeight += cargo.weight;
        } else {
          leftWeight += cargo.weight;
        }
      }

      // 计算总重量
      const totalWeight = frontWeight + backWeight;

      // 计算百分比
      const frontPercent = totalWeight > 0 ? (frontWeight / totalWeight) * 100 : 0;
      const backPercent = totalWeight > 0 ? (backWeight / totalWeight) * 100 : 0;
      const leftPercent = totalWeight > 0 ? (leftWeight / totalWeight) * 100 : 0;
      const rightPercent = totalWeight > 0 ? (rightWeight / totalWeight) * 100 : 0;

      // 计算不平衡度（相对区域重量差占总重量的百分比）
      const frontBackImbalance = totalWeight > 0 ? Math.abs(frontWeight - backWeight) / totalWeight * 100 : 0;
      const leftRightImbalance = totalWeight > 0 ? Math.abs(leftWeight - rightWeight) / totalWeight * 100 : 0;

      // 检查偏载警告（超过10%）
      let warning = null;
      const warnings = [];

      if (frontBackImbalance > 10) {
        const heavier = frontWeight > backWeight ? '前部' : '后部';
        warnings.push(`前后偏载：${heavier}重量超出${frontBackImbalance.toFixed(1)}%`);
      }

      if (leftRightImbalance > 10) {
        const heavier = leftWeight > rightWeight ? '左侧' : '右侧';
        warnings.push(`左右偏载：${heavier}重量超出${leftRightImbalance.toFixed(1)}%`);
      }

      if (warnings.length > 0) {
        warning = warnings.join('；');
      }

      return {
        front: frontWeight,
        back: backWeight,
        left: leftWeight,
        right: rightWeight,
        frontPercent: parseFloat(frontPercent.toFixed(2)),
        backPercent: parseFloat(backPercent.toFixed(2)),
        leftPercent: parseFloat(leftPercent.toFixed(2)),
        rightPercent: parseFloat(rightPercent.toFixed(2)),
        frontBackImbalance: parseFloat(frontBackImbalance.toFixed(2)),
        leftRightImbalance: parseFloat(leftRightImbalance.toFixed(2)),
        warning
      };
    }



  /**
   * 获取未装载原因
   */
  _getUnloadedReason(cargo, containerType) {
    const dimensions = [cargo.length, cargo.width, cargo.height].sort((a, b) => b - a);
    const containerDimensions = [
      containerType.innerLength,
      containerType.innerWidth,
      containerType.innerHeight
    ].sort((a, b) => b - a);
    
    for (let i = 0; i < 3; i++) {
      if (dimensions[i] > containerDimensions[i]) {
        return '超尺寸';
      }
    }
    
    if (cargo.weight > containerType.maxWeight) {
      return '超重';
    }
    
    return '空间不足';
  }

  /**
   * 检查是否还有时间
   */
  _hasTime() {
    return (Date.now() - this.startTime) < this.MAX_TIME_MS;
  }

  /**
   * 超时Promise
   */
  _timeout(ms, defaultValue) {
    return new Promise(resolve => setTimeout(() => resolve(defaultValue), ms));
  }

  /**
   * 获取默认策略
   */
  _getDefaultStrategy() {
    return {
      sortStrategy: 'volume_desc',
      layerStrategy: 'multi_layer',
      rotationPriority: 'height_min',
      fillPattern: 'dense',
      reasoning: '默认策略'
    };
  }

  /**
   * 生成3D可视化数据
   * 需求: 6.1, 6.2, 6.3, 6.5
   * 
   * @param {Object} plan - 装箱方案
   * @returns {Object} VisualizationData对象
   */
  generateVisualizationData(plan) {
    const containerType = plan.containerType;
    
    // 生成container对象（包含length, width, height）
    const container = {
      length: containerType.innerLength,
      width: containerType.innerWidth,
      height: containerType.innerHeight
    };
    
    // 为不同cargoId分配颜色
    const colorMap = this._assignCargoColors(plan.loadedCargo);
    
    // 遍历所有已放置货物生成cargo数组
    const cargo = plan.loadedCargo.map(placed => {
      const cargoId = placed.cargo.cargoId || placed.cargo.id || placed.cargo.name;
      
      return {
        id: cargoId,
        name: placed.cargo.name,
        position: {
          x: placed.position.x,
          y: placed.position.y,
          z: placed.position.z
        },
        dimensions: {
          length: placed.rotation.length,
          width: placed.rotation.width,
          height: placed.rotation.height
        },
        rotation: {
          x: placed.rotation.rotation.x,
          y: placed.rotation.rotation.y,
          z: placed.rotation.rotation.z
        },
        color: colorMap[cargoId],
        loadingOrder: placed.loadingOrder,
        stackLevel: placed.stackLevel
      };
    });
    
    // 计算重心和载荷分布（如果尚未计算）
    const centerOfGravity = plan.centerOfGravity || this._calculateCenterOfGravity(plan, containerType);
    const loadDistribution = plan.loadDistribution || this._calculateLoadDistribution(plan, containerType);
    
    // 返回VisualizationData对象
    return {
      container,
      cargo,
      centerOfGravity,
      loadDistribution
    };
  }

  /**
   * 为不同类型货物分配颜色
   * 需求: 6.4
   * 
   * @param {Array} loadedCargo - 已装载货物列表
   * @returns {Object} cargoId到颜色的映射
   */
  _assignCargoColors(loadedCargo) {
    // 预定义的颜色调色板（使用易于区分的颜色）
    const colorPalette = [
      '#FF6B6B', // 红色
      '#4ECDC4', // 青色
      '#45B7D1', // 蓝色
      '#FFA07A', // 浅橙色
      '#98D8C8', // 薄荷绿
      '#F7DC6F', // 黄色
      '#BB8FCE', // 紫色
      '#85C1E2', // 天蓝色
      '#F8B88B', // 桃色
      '#ABEBC6', // 浅绿色
      '#FAD7A0', // 浅黄色
      '#D7BDE2', // 淡紫色
      '#A3E4D7', // 水绿色
      '#F9E79F', // 柠檬黄
      '#FADBD8', // 粉红色
      '#D5DBDB', // 灰色
      '#AED6F1', // 浅蓝色
      '#F5CBA7', // 杏色
      '#D2B4DE', // 薰衣草色
      '#A9DFBF'  // 薄荷色
    ];
    
    // 收集所有唯一的cargoId
    const uniqueCargoIds = new Set();
    loadedCargo.forEach(placed => {
      const cargoId = placed.cargo.cargoId || placed.cargo.id || placed.cargo.name;
      uniqueCargoIds.add(cargoId);
    });
    
    // 为每个cargoId分配颜色
    const colorMap = {};
    const cargoIdArray = Array.from(uniqueCargoIds);
    cargoIdArray.forEach((cargoId, index) => {
      // 循环使用颜色调色板
      colorMap[cargoId] = colorPalette[index % colorPalette.length];
    });
    
    return colorMap;
  }

  /**
   * 综合合规性校验
   * 验证装箱方案是否满足所有约束条件
   * @param {Object} plan - 装箱方案
   * @param {Object} containerType - 集装箱类型
   * @returns {Object} - {valid: boolean, violations: Array<string>}
   */
  _validateCompliance(plan, containerType) {
    const violations = [];

    // 1. 校验总重量
    const weightViolations = this._checkTotalWeight(plan, containerType);
    violations.push(...weightViolations);

    // 2. 校验边界约束
    const boundaryViolations = this._checkBoundaries(plan, containerType);
    violations.push(...boundaryViolations);

    // 3. 校验货物重叠
    const overlapViolations = this._checkOverlaps(plan);
    violations.push(...overlapViolations);

    // 4. 校验堆叠约束
    const stackingViolations = this._checkStackingConstraints(plan);
    violations.push(...stackingViolations);

    return {
      valid: violations.length === 0,
      violations: violations
    };
  }

  /**
   * 校验总重量是否超过集装箱最大载重
   * @param {Object} plan - 装箱方案
   * @param {Object} containerType - 集装箱类型
   * @returns {Array<string>} - 违规信息列表
   */
  _checkTotalWeight(plan, containerType) {
    const violations = [];
    const totalWeight = this._calculateTotalWeight(plan);

    if (totalWeight > containerType.maxWeight) {
      violations.push(
        `总重量超过集装箱最大载重: 实际重量=${totalWeight.toFixed(2)}kg, ` +
        `最大载重=${containerType.maxWeight}kg, ` +
        `超载=${(totalWeight - containerType.maxWeight).toFixed(2)}kg`
      );
    }

    return violations;
  }

  /**
   * 校验所有货物是否在集装箱边界内
   * @param {Object} plan - 装箱方案
   * @param {Object} containerType - 集装箱类型
   * @returns {Array<string>} - 违规信息列表
   */
  _checkBoundaries(plan, containerType) {
    const violations = [];

    for (let i = 0; i < plan.loadedCargo.length; i++) {
      const loaded = plan.loadedCargo[i];
      const cargo = loaded.cargo;
      const position = loaded.position;
      const rotation = plan.occupiedSpaces[i].rotation;

      // 检查X方向（长度方向）
      if (position.x < 0 || position.x + rotation.length > containerType.innerLength) {
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 在X方向超出边界: ` +
          `位置=${position.x}mm, 长度=${rotation.length}mm, ` +
          `集装箱长度=${containerType.innerLength}mm`
        );
      }

      // 检查Y方向（宽度方向）
      if (position.y < 0 || position.y + rotation.width > containerType.innerWidth) {
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 在Y方向超出边界: ` +
          `位置=${position.y}mm, 宽度=${rotation.width}mm, ` +
          `集装箱宽度=${containerType.innerWidth}mm`
        );
      }

      // 检查Z方向（高度方向）
      if (position.z < 0 || position.z + rotation.height > containerType.innerHeight) {
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 在Z方向超出边界: ` +
          `位置=${position.z}mm, 高度=${rotation.height}mm, ` +
          `集装箱高度=${containerType.innerHeight}mm`
        );
      }
    }

    return violations;
  }

  /**
   * 校验货物之间是否存在重叠
   * @param {Object} plan - 装箱方案
   * @returns {Array<string>} - 违规信息列表
   */
  _checkOverlaps(plan) {
    const violations = [];

    // 检查每对货物是否重叠
    for (let i = 0; i < plan.loadedCargo.length; i++) {
      for (let j = i + 1; j < plan.loadedCargo.length; j++) {
        const cargo1 = plan.loadedCargo[i];
        const cargo2 = plan.loadedCargo[j];
        const pos1 = cargo1.position;
        const pos2 = cargo2.position;
        const rot1 = plan.occupiedSpaces[i].rotation;
        const rot2 = plan.occupiedSpaces[j].rotation;

        if (this._isOverlapping(pos1, rot1, pos2, rot2)) {
          violations.push(
            `货物重叠: ${cargo1.cargo.name} (装载顺序${cargo1.loadingOrder}) ` +
            `与 ${cargo2.cargo.name} (装载顺序${cargo2.loadingOrder}) 存在重叠`
          );
        }
      }
    }

    return violations;
  }

  /**
   * 校验堆叠约束
   * @param {Object} plan - 装箱方案
   * @returns {Array<string>} - 违规信息列表
   */
  _checkStackingConstraints(plan) {
    const violations = [];
    const stackManager = new StackManager();

    for (let i = 0; i < plan.loadedCargo.length; i++) {
      const loaded = plan.loadedCargo[i];
      const cargo = loaded.cargo;
      const position = loaded.position;
      const rotation = plan.occupiedSpaces[i].rotation;

      // 检查不可堆叠货物上方是否有其他货物
      if (!cargo.stackable) {
        const above = stackManager.findCargoAbove(loaded, plan.loadedCargo);
        if (above.length > 0) {
          violations.push(
            `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 标记为不可堆叠, ` +
            `但其上方有 ${above.length} 个货物`
          );
        }
      }

      // 检查堆叠层数是否超过限制
      if (cargo.stackable && cargo.maxStackLayers > 0) {
        const layers = stackManager.countLayers(loaded, plan.loadedCargo);
        if (layers > cargo.maxStackLayers) {
          violations.push(
            `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 上方堆叠层数超限: ` +
            `实际层数=${layers}, 最大允许层数=${cargo.maxStackLayers}`
          );
        }
      }

      // 检查是否有足够的支撑
      const below = stackManager.findCargoBelow(position, rotation, plan.loadedCargo);
      if (below.length > 0) {
        const supportArea = stackManager.calculateSupportArea(position, rotation, below);
        const cargoArea = rotation.length * rotation.width;
        const supportRatio = supportArea / cargoArea;

        if (supportRatio < 0.5) {
          violations.push(
            `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 支撑面积不足: ` +
            `支撑比例=${(supportRatio * 100).toFixed(2)}%, 要求≥50%`
          );
        }
      } else if (position.z > 1) {
        // 如果不在地面上且没有下方货物，则违规
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 悬空: ` +
          `位置Z=${position.z}mm, 但下方没有支撑货物`
        );
      }
    }

    return violations;
  }

  /**
   * 验证约束条件（复用原PackingEngine的方法）
   */
  validateConstraints(plan, containerType) {
    // 导入原PackingEngine的validateConstraints方法
    const PackingEngine = require('./PackingEngine');
    const engine = new PackingEngine();
    return engine.validateConstraints(plan, containerType);
  }
  /**
   * 综合合规性校验
   * 验证装箱方案是否满足所有约束条件
   * @param {Object} plan - 装箱方案
   * @param {Object} containerType - 集装箱类型
   * @returns {Object} - {valid: boolean, violations: Array<string>}
   */
  _validateCompliance(plan, containerType) {
    const violations = [];

    // 1. 校验总重量
    const weightViolations = this._checkTotalWeight(plan, containerType);
    violations.push(...weightViolations);

    // 2. 校验边界约束
    const boundaryViolations = this._checkBoundaries(plan, containerType);
    violations.push(...boundaryViolations);

    // 3. 校验货物重叠
    const overlapViolations = this._checkOverlaps(plan);
    violations.push(...overlapViolations);

    // 4. 校验堆叠约束
    const stackingViolations = this._checkStackingConstraints(plan);
    violations.push(...stackingViolations);

    return {
      valid: violations.length === 0,
      violations: violations
    };
  }

  /**
   * 校验总重量是否超过集装箱最大载重
   * @param {Object} plan - 装箱方案
   * @param {Object} containerType - 集装箱类型
   * @returns {Array<string>} - 违规信息列表
   */
  _checkTotalWeight(plan, containerType) {
    const violations = [];
    const totalWeight = this._calculateTotalWeight(plan);

    if (totalWeight > containerType.maxWeight) {
      violations.push(
        `总重量超过集装箱最大载重: 实际重量=${totalWeight.toFixed(2)}kg, ` +
        `最大载重=${containerType.maxWeight}kg, ` +
        `超载=${(totalWeight - containerType.maxWeight).toFixed(2)}kg`
      );
    }

    return violations;
  }

  /**
   * 校验所有货物是否在集装箱边界内
   * @param {Object} plan - 装箱方案
   * @param {Object} containerType - 集装箱类型
   * @returns {Array<string>} - 违规信息列表
   */
  _checkBoundaries(plan, containerType) {
    const violations = [];

    for (let i = 0; i < plan.loadedCargo.length; i++) {
      const loaded = plan.loadedCargo[i];
      const cargo = loaded.cargo;
      const position = loaded.position;
      const rotation = plan.occupiedSpaces[i].rotation;

      // 检查X方向（长度方向）
      if (position.x < 0 || position.x + rotation.length > containerType.innerLength) {
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 在X方向超出边界: ` +
          `位置=${position.x}mm, 长度=${rotation.length}mm, ` +
          `集装箱长度=${containerType.innerLength}mm`
        );
      }

      // 检查Y方向（宽度方向）
      if (position.y < 0 || position.y + rotation.width > containerType.innerWidth) {
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 在Y方向超出边界: ` +
          `位置=${position.y}mm, 宽度=${rotation.width}mm, ` +
          `集装箱宽度=${containerType.innerWidth}mm`
        );
      }

      // 检查Z方向（高度方向）
      if (position.z < 0 || position.z + rotation.height > containerType.innerHeight) {
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 在Z方向超出边界: ` +
          `位置=${position.z}mm, 高度=${rotation.height}mm, ` +
          `集装箱高度=${containerType.innerHeight}mm`
        );
      }
    }

    return violations;
  }

  /**
   * 校验货物之间是否存在重叠
   * @param {Object} plan - 装箱方案
   * @returns {Array<string>} - 违规信息列表
   */
  _checkOverlaps(plan) {
    const violations = [];

    // 检查每对货物是否重叠
    for (let i = 0; i < plan.loadedCargo.length; i++) {
      for (let j = i + 1; j < plan.loadedCargo.length; j++) {
        const cargo1 = plan.loadedCargo[i];
        const cargo2 = plan.loadedCargo[j];
        const pos1 = cargo1.position;
        const pos2 = cargo2.position;
        const rot1 = plan.occupiedSpaces[i].rotation;
        const rot2 = plan.occupiedSpaces[j].rotation;

        if (this._isOverlapping(pos1, rot1, pos2, rot2)) {
          violations.push(
            `货物重叠: ${cargo1.cargo.name} (装载顺序${cargo1.loadingOrder}) ` +
            `与 ${cargo2.cargo.name} (装载顺序${cargo2.loadingOrder}) 存在重叠`
          );
        }
      }
    }

    return violations;
  }

  /**
   * 校验堆叠约束
   * @param {Object} plan - 装箱方案
   * @returns {Array<string>} - 违规信息列表
   */
  _checkStackingConstraints(plan) {
    const violations = [];
    const stackManager = new StackManager();

    // 创建包含rotation的loadedCargo副本供StackManager使用
    const loadedCargoWithRotation = plan.loadedCargo.map((loaded, index) => ({
      ...loaded,
      rotation: plan.occupiedSpaces[index].rotation
    }));

    for (let i = 0; i < plan.loadedCargo.length; i++) {
      const loaded = plan.loadedCargo[i];
      const cargo = loaded.cargo;
      const position = loaded.position;
      const rotation = plan.occupiedSpaces[i].rotation;
      const loadedWithRotation = loadedCargoWithRotation[i];

      // 检查不可堆叠货物上方是否有其他货物
      if (!cargo.stackable) {
        const above = stackManager.findCargoAbove(loadedWithRotation, loadedCargoWithRotation);
        if (above.length > 0) {
          violations.push(
            `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 标记为不可堆叠, ` +
            `但其上方有 ${above.length} 个货物`
          );
        }
      }

      // 检查堆叠层数是否超过限制
      if (cargo.stackable && cargo.maxStackLayers > 0) {
        const layers = stackManager.countLayers(loadedWithRotation, loadedCargoWithRotation);
        if (layers > cargo.maxStackLayers) {
          violations.push(
            `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 上方堆叠层数超限: ` +
            `实际层数=${layers}, 最大允许层数=${cargo.maxStackLayers}`
          );
        }
      }

      // 检查是否有足够的支撑
      const below = stackManager.findCargoBelow(position, rotation, loadedCargoWithRotation);
      if (below.length > 0) {
        const supportArea = stackManager.calculateSupportArea(position, rotation, below);
        const cargoArea = rotation.length * rotation.width;
        const supportRatio = supportArea / cargoArea;

        if (supportRatio < 0.5) {
          violations.push(
            `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 支撑面积不足: ` +
            `支撑比例=${(supportRatio * 100).toFixed(2)}%, 要求≥50%`
          );
        }
      } else if (position.z > 1) {
        // 如果不在地面上且没有下方货物，则违规
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 悬空: ` +
          `位置Z=${position.z}mm, 但下方没有支撑货物`
        );
      }
    }

    return violations;
  }



  /**
   * 验证重心平衡（复用原PackingEngine的方法）
   */
  validateCenterOfGravityBalance(plan, containerType) {
    const PackingEngine = require('./PackingEngine');
    const engine = new PackingEngine();
    return engine.validateCenterOfGravityBalance(plan, containerType);
  }

  /**
   * 添加调试日志 - 需求 9.1, 9.2, 9.3, 9.4
   * @param {string} level - 日志级别 (INFO, DEBUG, WARNING, ERROR)
   * @param {string} phase - 算法阶段
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   */
  _addDebugLog(level, phase, message, data = null) {
    const timestamp = Date.now() - this.startTime;
    const logEntry = {
      timestamp: `${(timestamp / 1000).toFixed(3)}s`,
      level,
      phase,
      message,
      data
    };
    
    this.debugLogs.push(logEntry);
    
    // 当debugMode=true时输出详细中间结果 - 需求 9.5
    if (this.debugMode) {
      const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
      console.log(`[${logEntry.timestamp}] [${level}] [${phase}] ${message}${dataStr}`);
    }
  }

  /**
   * 记录货物放置决策 - 需求 9.1
   * @param {Object} cargo - 货物对象
   * @param {Object} position - 放置位置
   * @param {Object} rotation - 旋转信息
   * @param {boolean} success - 是否成功放置
   * @param {string} reason - 选择原因或失败原因
   */
  _logPlacementDecision(cargo, position, rotation, success, reason) {
    this._addDebugLog(
      success ? 'INFO' : 'WARNING',
      'PLACEMENT',
      success ? `货物已放置: ${cargo.name}` : `货物放置失败: ${cargo.name}`,
      {
        cargoId: cargo.cargoId,
        cargoName: cargo.name,
        dimensions: { length: cargo.length, width: cargo.width, height: cargo.height },
        position: position,
        rotation: rotation ? { length: rotation.length, width: rotation.width, height: rotation.height } : null,
        success,
        reason
      }
    );
  }

  /**
   * 记录尝试的位置和选择原因 - 需求 9.2
   * @param {Object} cargo - 货物对象
   * @param {Array} attemptedPositions - 尝试的位置列表
   * @param {Object} selectedPosition - 最终选择的位置
   * @param {string} selectionReason - 选择原因
   */
  _logPositionAttempts(cargo, attemptedPositions, selectedPosition, selectionReason) {
    this._addDebugLog(
      'DEBUG',
      'POSITION_SEARCH',
      `货物 ${cargo.name} 位置搜索`,
      {
        cargoId: cargo.cargoId,
        attemptedCount: attemptedPositions.length,
        attemptedPositions: attemptedPositions.slice(0, 5), // 只记录前5个尝试
        selectedPosition,
        selectionReason
      }
    );
  }

  /**
   * 记录算法执行的关键步骤和时间戳 - 需求 9.4
   * @param {string} step - 步骤名称
   * @param {Object} metrics - 步骤指标
   */
  _logAlgorithmStep(step, metrics = {}) {
    this._addDebugLog(
      'INFO',
      'ALGORITHM',
      `执行步骤: ${step}`,
      metrics
    );
  }

  /**
   * 记录限制因素 - 需求 9.3
   * @param {string} limitingFactor - 限制因素描述
   * @param {Object} details - 详细信息
   */
  _logLimitingFactor(limitingFactor, details = {}) {
    this._addDebugLog(
      'WARNING',
      'LIMITATION',
      `限制因素: ${limitingFactor}`,
      details
    );
  }

  /**
   * 获取调试日志摘要
   * @returns {Object} 调试日志摘要
   */
  _getDebugSummary() {
    const summary = {
      totalLogs: this.debugLogs.length,
      byLevel: {},
      byPhase: {},
      placementAttempts: 0,
      placementSuccesses: 0,
      placementFailures: 0,
      limitingFactors: []
    };
    
    for (const log of this.debugLogs) {
      // 按级别统计
      summary.byLevel[log.level] = (summary.byLevel[log.level] || 0) + 1;
      
      // 按阶段统计
      summary.byPhase[log.phase] = (summary.byPhase[log.phase] || 0) + 1;
      
      // 统计放置尝试
      if (log.phase === 'PLACEMENT') {
        summary.placementAttempts++;
        if (log.data && log.data.success) {
          summary.placementSuccesses++;
        } else {
          summary.placementFailures++;
        }
      }
      
      // 收集限制因素
      if (log.phase === 'LIMITATION') {
        summary.limitingFactors.push({
          timestamp: log.timestamp,
          factor: log.message,
          details: log.data
        });
      }
    }
    
    return summary;
  }
}

module.exports = OptimizedPackingEngine;
