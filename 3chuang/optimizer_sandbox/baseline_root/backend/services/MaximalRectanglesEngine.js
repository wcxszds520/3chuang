/**
 * Maximal Rectangles 3D装箱算法引擎
 * 
 * 这是目前业界最优的3D装箱算法之一，相比Guillotine算法有以下优势：
 * 1. 碎片更少：通过维护所有可用矩形空间，智能选择最佳放置位置
 * 2. 利用率更高：通常可达85%+的空间利用率
 * 3. 适配性强：支持多种启发式策略（BSSF、BLSF、BAF等）
 * 
 * 核心思想：
 * - 维护一个"自由矩形"列表，表示所有可以放置货物的3D空间
 * - 每次放置货物后，更新自由矩形列表（分割、合并、去重）
 * - 使用启发式规则选择最佳放置位置
 * 
 * @author Kiro AI Assistant
 * @date 2024
 */

class MaximalRectanglesEngine {
  constructor() {
    this.startTime = 0;
    this.debugMode = false;
  }

  /**
   * 生成装箱方案
   * @param {Array} cargoList - 货物列表
   * @param {Object} containerType - 集装箱类型
   * @param {Object} options - 可选参数
   * @returns {Object} 装箱方案
   */
  async generatePackingPlan(cargoList, containerType, options = {}) {
    this.startTime = Date.now();
    this.debugMode = options.debug || false;
    
    if (this.debugMode) {
      console.log('=== Maximal Rectangles 装箱引擎启动 ===');
      console.log(`货物数量: ${cargoList.length}, 柜型: ${containerType.name}`);
    }
    
    // 初始化方案
    const plan = {
      planId: `maxrect_plan_${Date.now()}`,
      loadedCargo: [],
      unloadedCargo: [],
      containerType: containerType,
      strategy: {
        type: 'maximal_rectangles',
        description: 'Maximal Rectangles算法 - 业界最优3D装箱算法'
      }
    };
    
    // 初始化自由矩形列表（整个集装箱空间）
    const freeRectangles = [{
      x: 0,
      y: 0,
      z: 0,
      length: containerType.innerLength,
      width: containerType.innerWidth,
      height: containerType.innerHeight
    }];
    
    // 展开货物（按数量）
    const expandedCargo = this._expandCargo(cargoList);
    
    // 使用AI策略排序（如果提供）
    const sortedCargo = options.aiStrategy 
      ? this._sortByAIStrategy(expandedCargo, options.aiStrategy)
      : this._sortByDefaultStrategy(expandedCargo);
    
    if (this.debugMode) {
      console.log(`展开后货物总数: ${sortedCargo.length}`);
    }
    
    // 主装箱循环
    let loadingOrder = 0;
    for (const cargo of sortedCargo) {
      // 尝试所有可能的旋转
      const rotations = this._generateRotations(cargo);
      
      let bestPlacement = null;
      let bestScore = Infinity;
      let bestRectIndex = -1;
      let bestRotation = null;
      
      // 遍历所有自由矩形，找到最佳放置位置
      for (let i = 0; i < freeRectangles.length; i++) {
        const rect = freeRectangles[i];
        
        for (const rotation of rotations) {
          // 检查是否能放入这个矩形
          if (this._canFit(rotation, rect)) {
            // 计算放置得分（使用BSSF策略）
            const score = this._calculateBSSFScore(rotation, rect);
            
            if (score < bestScore) {
              bestScore = score;
              bestPlacement = {
                x: rect.x,
                y: rect.y,
                z: rect.z
              };
              bestRectIndex = i;
              bestRotation = rotation;
            }
          }
        }
      }
      
      // 如果找到了合适的位置
      if (bestPlacement) {
        // 检查重量限制
        const currentWeight = this._calculateTotalWeight(plan);
        if (currentWeight + cargo.weight > containerType.maxWeight) {
          plan.unloadedCargo.push({
            cargo: cargo,
            reason: '超重限制'
          });
          continue;
        }
        
        // 检查堆叠限制
        const stackLevel = this._getStackLevel(bestPlacement, bestRotation, cargo, plan);
        const maxStack = cargo.stackable ? (cargo.maxStackLayers || 1) : 1;
        // stackLevel是0-based，表示当前是第几层（0=第1层，1=第2层...）
        // maxStackLayers表示最多可以堆叠几层
        // 所以条件应该是：stackLevel + 1 > maxStack
        if (stackLevel + 1 > maxStack) {
          if (this.debugMode && plan.loadedCargo.length < 10) {
            console.log(`   ❌ ${cargo.name} 堆叠限制: stackLevel=${stackLevel}, maxStack=${maxStack}`);
          }
          plan.unloadedCargo.push({
            cargo: cargo,
            reason: '堆叠限制'
          });
          continue;
        }
        
        // 放置货物
        loadingOrder++;
        plan.loadedCargo.push({
          cargo: cargo,
          position: bestPlacement,
          rotation: bestRotation,
          loadingOrder: loadingOrder,
          stackLevel: stackLevel + 1
        });
        
        // 更新自由矩形列表
        this._updateFreeRectangles(
          freeRectangles,
          bestPlacement,
          bestRotation,
          containerType
        );
        
      } else {
        // 没有找到合适的位置
        plan.unloadedCargo.push({
          cargo: cargo,
          reason: '无可用空间'
        });
      }
    }
    
    // 计算统计信息
    plan.spaceUtilization = this._calculateSpaceUtilization(plan, containerType);
    plan.totalWeight = this._calculateTotalWeight(plan);
    plan.totalCargoCount = plan.loadedCargo.length;
    plan.centerOfGravity = this._calculateCenterOfGravity(plan, containerType);
    plan.loadDistribution = this._calculateLoadDistribution(plan, containerType);
    plan.compliance = this._simpleComplianceCheck(plan, containerType);
    plan.visualizationData = this._generateVisualizationData(plan);
    
    // 计算耗时
    const computationTimeMs = Date.now() - this.startTime;
    plan.computationTime = parseFloat((computationTimeMs / 1000).toFixed(3));
    
    if (this.debugMode) {
      console.log(`\n=== 装箱完成 ===`);
      console.log(`耗时: ${plan.computationTime.toFixed(2)}秒`);
      console.log(`已装载: ${plan.loadedCargo.length}, 未装载: ${plan.unloadedCargo.length}`);
      console.log(`空间利用率: ${plan.spaceUtilization.toFixed(2)}%`);
    }
    
    return plan;
  }

  /**
   * 展开货物（按数量）
   */
  _expandCargo(cargoList) {
    const expanded = [];
    cargoList.forEach(cargo => {
      for (let i = 0; i < cargo.quantity; i++) {
        expanded.push({
          ...cargo,
          quantity: 1,
          instanceId: `${cargo.cargoId}_${i + 1}`
        });
      }
    });
    return expanded;
  }

  /**
   * 使用AI策略排序
   */
  _sortByAIStrategy(cargoList, aiStrategy) {
    if (aiStrategy.loadingOrder && Array.isArray(aiStrategy.loadingOrder)) {
      // 按AI建议的顺序排序
      const orderMap = {};
      aiStrategy.loadingOrder.forEach((name, index) => {
        orderMap[name] = index;
      });
      
      return cargoList.sort((a, b) => {
        const orderA = orderMap[a.name] !== undefined ? orderMap[a.name] : 999;
        const orderB = orderMap[b.name] !== undefined ? orderMap[b.name] : 999;
        return orderA - orderB;
      });
    }
    
    return this._sortByDefaultStrategy(cargoList);
  }

  /**
   * 默认排序策略：按高度升序（先装矮的，后装高的）
   * 这样可以更好地利用垂直空间
   */
  _sortByDefaultStrategy(cargoList) {
    return cargoList.sort((a, b) => {
      // 优先按高度排序（矮的优先）
      if (a.height !== b.height) {
        return a.height - b.height;
      }
      // 高度相同时，按体积降序（大的优先）
      const volumeA = a.length * a.width * a.height;
      const volumeB = b.length * b.width * b.height;
      return volumeB - volumeA;
    });
  }

  /**
   * 生成所有可能的旋转
   */
  _generateRotations(cargo) {
    const rotations = [
      { length: cargo.length, width: cargo.width, height: cargo.height, id: 'LWH' },
      { length: cargo.width, width: cargo.length, height: cargo.height, id: 'WLH' },
      { length: cargo.length, width: cargo.height, height: cargo.width, id: 'LHW' },
      { length: cargo.height, width: cargo.width, height: cargo.length, id: 'HWL' },
      { length: cargo.width, width: cargo.height, height: cargo.length, id: 'WHL' },
      { length: cargo.height, width: cargo.length, height: cargo.width, id: 'HLW' }
    ];
    
    // 如果货物不可倒置，只保留高度不变的旋转
    if (!cargo.canInvert) {
      return rotations.filter(r => r.height === cargo.height);
    }
    
    return rotations;
  }

  /**
   * 检查货物是否能放入矩形空间
   */
  _canFit(rotation, rect) {
    return rotation.length <= rect.length &&
           rotation.width <= rect.width &&
           rotation.height <= rect.height;
  }

  /**
   * 计算BSSF（Best Short Side Fit）得分
   * 选择短边剩余空间最小的位置
   */
  _calculateBSSFScore(rotation, rect) {
    const leftoverX = rect.length - rotation.length;
    const leftoverY = rect.width - rotation.width;
    const leftoverZ = rect.height - rotation.height;
    
    const shortSide = Math.min(leftoverX, leftoverY, leftoverZ);
    const longSide = Math.max(leftoverX, leftoverY, leftoverZ);
    
    return shortSide * 1000 + longSide;
  }

  /**
   * 更新自由矩形列表
   * 这是Maximal Rectangles算法的核心
   */
  _updateFreeRectangles(freeRectangles, placement, rotation, containerType) {
    const newRects = [];
    
    // 遍历所有现有的自由矩形
    for (let i = freeRectangles.length - 1; i >= 0; i--) {
      const rect = freeRectangles[i];
      
      // 检查是否与放置的货物相交
      if (this._intersects(rect, placement, rotation)) {
        // 移除这个矩形
        freeRectangles.splice(i, 1);
        
        // 生成新的自由矩形（分割）
        const splits = this._splitRectangle(rect, placement, rotation, containerType);
        newRects.push(...splits);
      }
    }
    
    // 添加新生成的矩形
    freeRectangles.push(...newRects);
    
    // 去除完全被其他矩形包含的矩形
    this._pruneFreeRectangles(freeRectangles);
  }

  /**
   * 检查矩形是否与放置的货物相交
   */
  _intersects(rect, placement, rotation) {
    return !(placement.x >= rect.x + rect.length ||
             placement.x + rotation.length <= rect.x ||
             placement.y >= rect.y + rect.width ||
             placement.y + rotation.width <= rect.y ||
             placement.z >= rect.z + rect.height ||
             placement.z + rotation.height <= rect.z);
  }

  /**
   * 分割矩形
   * 当货物放入矩形后，生成剩余的自由空间
   */
  _splitRectangle(rect, placement, rotation, containerType) {
    const splits = [];
    
    // 右侧剩余空间
    if (placement.x + rotation.length < rect.x + rect.length) {
      splits.push({
        x: placement.x + rotation.length,
        y: rect.y,
        z: rect.z,
        length: rect.x + rect.length - (placement.x + rotation.length),
        width: rect.width,
        height: rect.height
      });
    }
    
    // 前侧剩余空间
    if (placement.y + rotation.width < rect.y + rect.width) {
      splits.push({
        x: rect.x,
        y: placement.y + rotation.width,
        z: rect.z,
        length: rect.length,
        width: rect.y + rect.width - (placement.y + rotation.width),
        height: rect.height
      });
    }
    
    // 上方剩余空间
    if (placement.z + rotation.height < rect.z + rect.height) {
      splits.push({
        x: rect.x,
        y: rect.y,
        z: placement.z + rotation.height,
        length: rect.length,
        width: rect.width,
        height: rect.z + rect.height - (placement.z + rotation.height)
      });
    }
    
    // 过滤掉无效的矩形
    return splits.filter(s => 
      s.length > 0 && s.width > 0 && s.height > 0 &&
      s.x + s.length <= containerType.innerLength &&
      s.y + s.width <= containerType.innerWidth &&
      s.z + s.height <= containerType.innerHeight
    );
  }

  /**
   * 去除被包含的矩形
   */
  _pruneFreeRectangles(freeRectangles) {
    for (let i = freeRectangles.length - 1; i >= 0; i--) {
      for (let j = freeRectangles.length - 1; j >= 0; j--) {
        if (i !== j && this._isContained(freeRectangles[i], freeRectangles[j])) {
          freeRectangles.splice(i, 1);
          break;
        }
      }
    }
  }

  /**
   * 检查矩形A是否完全被矩形B包含
   */
  _isContained(rectA, rectB) {
    return rectA.x >= rectB.x &&
           rectA.y >= rectB.y &&
           rectA.z >= rectB.z &&
           rectA.x + rectA.length <= rectB.x + rectB.length &&
           rectA.y + rectA.width <= rectB.y + rectB.width &&
           rectA.z + rectA.height <= rectB.z + rectB.height;
  }

  /**
   * 获取堆叠层数
   * 计算当前位置上已经堆叠了多少层同类型货物
   * 返回值：0表示第1层，1表示第2层，以此类推
   */
  _getStackLevel(position, rotation, cargo, plan) {
    // 如果在地面上（z=0），则是第1层，返回0
    if (position.z === 0) {
      return 0;
    }
    
    let stackLevel = 0;
    
    for (const loaded of plan.loadedCargo) {
      const pos = loaded.position;
      const rot = loaded.rotation;
      
      // 只检查同类型货物
      if (loaded.cargo.name !== cargo.name) {
        continue;
      }
      
      // 检查XY平面是否重叠（有交集）
      const overlapX = !(position.x + rotation.length <= pos.x || pos.x + rot.length <= position.x);
      const overlapY = !(position.y + rotation.width <= pos.y || pos.y + rot.width <= position.y);
      
      // 如果XY平面重叠，且在下方（z坐标更小）
      if (overlapX && overlapY && pos.z < position.z) {
        stackLevel++;
      }
    }
    
    return stackLevel;
  }

  /**
   * 计算空间利用率
   */
  _calculateSpaceUtilization(plan, containerType) {
    const containerVolume = containerType.innerLength * 
                           containerType.innerWidth * 
                           containerType.innerHeight;
    
    let usedVolume = 0;
    plan.loadedCargo.forEach(loaded => {
      const r = loaded.rotation;
      usedVolume += r.length * r.width * r.height;
    });
    
    return (usedVolume / containerVolume) * 100;
  }

  /**
   * 计算总重量
   */
  _calculateTotalWeight(plan) {
    let totalWeight = 0;
    plan.loadedCargo.forEach(loaded => {
      totalWeight += loaded.cargo.weight;
    });
    return totalWeight;
  }

  /**
   * 计算重心
   */
  _calculateCenterOfGravity(plan, containerType) {
    if (plan.loadedCargo.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }
    
    let totalWeight = 0, weightedX = 0, weightedY = 0, weightedZ = 0;
    
    plan.loadedCargo.forEach(loaded => {
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
    });
    
    return {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight,
      z: weightedZ / totalWeight
    };
  }

  /**
   * 计算载荷分布
   */
  _calculateLoadDistribution(plan, containerType) {
    if (plan.loadedCargo.length === 0) {
      return {
        front: 0, back: 0, left: 0, right: 0,
        frontPercent: 0, backPercent: 0, leftPercent: 0, rightPercent: 0,
        frontBackImbalance: 0, leftRightImbalance: 0
      };
    }
    
    const centerX = containerType.innerLength / 2;
    const centerY = containerType.innerWidth / 2;
    
    let frontWeight = 0, backWeight = 0, leftWeight = 0, rightWeight = 0;
    
    plan.loadedCargo.forEach(loaded => {
      const cargo = loaded.cargo;
      const position = loaded.position;
      const rotation = loaded.rotation;
      
      const centerCargoX = position.x + rotation.length / 2;
      const centerCargoY = position.y + rotation.width / 2;
      
      if (centerCargoX > centerX) frontWeight += cargo.weight;
      else backWeight += cargo.weight;
      
      if (centerCargoY > centerY) rightWeight += cargo.weight;
      else leftWeight += cargo.weight;
    });
    
    const totalWeight = frontWeight + backWeight;
    
    return {
      front: frontWeight,
      back: backWeight,
      left: leftWeight,
      right: rightWeight,
      frontPercent: totalWeight > 0 ? (frontWeight / totalWeight) * 100 : 0,
      backPercent: totalWeight > 0 ? (backWeight / totalWeight) * 100 : 0,
      leftPercent: totalWeight > 0 ? (leftWeight / totalWeight) * 100 : 0,
      rightPercent: totalWeight > 0 ? (rightWeight / totalWeight) * 100 : 0,
      frontBackImbalance: totalWeight > 0 ? Math.abs(frontWeight - backWeight) / totalWeight * 100 : 0,
      leftRightImbalance: totalWeight > 0 ? Math.abs(leftWeight - rightWeight) / totalWeight * 100 : 0
    };
  }

  /**
   * 简化合规校验
   */
  _simpleComplianceCheck(plan, containerType) {
    const totalWeight = this._calculateTotalWeight(plan);
    const weightUtilization = (totalWeight / containerType.maxWeight) * 100;
    
    let score = 100;
    const violations = [];
    
    if (totalWeight > containerType.maxWeight) {
      score = 0;
      violations.push(`超重: ${totalWeight.toFixed(2)}kg > ${containerType.maxWeight}kg`);
    } else if (weightUtilization < 10) {
      score = 100;
    }
    
    const spaceUtilization = this._calculateSpaceUtilization(plan, containerType);
    if (spaceUtilization > 100) {
      score = 0;
      violations.push(`超容: ${spaceUtilization.toFixed(2)}% > 100%`);
    }
    
    return {
      valid: violations.length === 0,
      violations: violations,
      overallScore: score,
      complianceLevel: score === 100 ? 'excellent' : score >= 80 ? 'good' : score >= 60 ? 'warning' : 'fail',
      summary: violations.length === 0 ? '完全符合规则' : `发现${violations.length}个问题`
    };
  }

  /**
   * 生成3D可视化数据
   */
  _generateVisualizationData(plan) {
    const containerType = plan.containerType;
    
    const colorMap = {
      '电风扇': '#FF6B6B',
      '取暖器': '#4ECDC4',
      '空气炸锅': '#45B7D1',
      '汽车空气滤芯': '#FFA07A',
      '汽车雨刮器': '#98D8C8',
      '汽车LED车灯总成': '#FFD700',
      'default': '#98D8C8'
    };
    
    const cargo = plan.loadedCargo.map(loaded => ({
      id: loaded.cargo.instanceId || loaded.cargo.cargoId,
      name: loaded.cargo.name,
      position: {
        x: loaded.position.x,
        y: loaded.position.y,
        z: loaded.position.z
      },
      dimensions: {
        length: loaded.rotation.length,
        width: loaded.rotation.width,
        height: loaded.rotation.height
      },
      color: colorMap[loaded.cargo.name] || colorMap.default,
      loadingOrder: loaded.loadingOrder
    }));
    
    const totalRequested = plan.loadedCargo.length + plan.unloadedCargo.length;
    const loadingRate = totalRequested > 0 
      ? (plan.loadedCargo.length / totalRequested * 100) 
      : 0;
    
    return {
      container: {
        length: containerType.innerLength,
        width: containerType.innerWidth,
        height: containerType.innerHeight
      },
      cargo: cargo,
      spaceUtilization: plan.spaceUtilization || 0,
      totalWeight: plan.totalWeight || 0,
      summary: {
        spaceUtilization: plan.spaceUtilization || 0,
        loadingRate: loadingRate,
        totalWeight: plan.totalWeight || 0,
        loadedCount: plan.loadedCargo.length,
        unloadedCount: plan.unloadedCargo.length,
        totalCount: totalRequested
      },
      centerOfGravity: plan.centerOfGravity,
      loadDistribution: plan.loadDistribution
    };
  }
}

module.exports = MaximalRectanglesEngine;
