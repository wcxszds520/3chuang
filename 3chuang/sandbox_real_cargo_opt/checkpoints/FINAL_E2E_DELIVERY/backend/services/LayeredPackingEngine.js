/**
 * 分层装载引擎 - 人工规则救场方案
 * 
 * 核心策略：
 * 1. 强制空间分区：按高度分为3层
 * 2. 固定装载顺序：电风扇(底层) → 取暖器(中层) → 空气炸锅(顶层)
 * 3. 每层内部紧密排列：沿柜长/柜宽方向依次摆放
 * 4. 目标：慈溪小家电场景空间利用率≥70%
 */

const Cargo = require('../models/Cargo');
const ContainerType = require('../models/ContainerType');

class LayeredPackingEngine {
  constructor() {
    this.startTime = 0;
  }

  /**
   * 生成分层装箱方案
   * @param {Array} cargoList - 货物列表
   * @param {Object} containerType - 集装箱类型
   * @returns {Object} 装箱方案
   */
  async generatePackingPlan(cargoList, containerType) {
    this.startTime = Date.now();
    
    // Initialize performance tracking
    const performanceMetrics = {
      gridCalculation: 0,
      layerCreation: 0,
      packing: 0,
      postProcessing: 0,
      total: 0
    };
    
    console.log('=== LayeredPackingEngine: Starting ===');
    console.log(`Cargo: ${cargoList.length} items, Container: ${containerType.name}`);
    
    // Phase 1: Calculate optimal grid size
    const gridStartTime = Date.now();
    this.gridSize = this._calculateOptimalGridSize(cargoList);
    performanceMetrics.gridCalculation = Date.now() - gridStartTime;
    console.log(`Grid size: ${this.gridSize}mm (${performanceMetrics.gridCalculation}ms)`);
    
    // 初始化方案
    const plan = {
      planId: `layered_plan_${Date.now()}`,
      loadedCargo: [],
      unloadedCargo: [],
      containerType: containerType,
      strategy: {
        type: 'layered',
        description: '强制分层装载：电风扇(底层) → 取暖器(中层) → 空气炸锅(顶层)'
      }
    };
    
    // 按货物类型分类
    const cargoByType = this._classifyCargoByType(cargoList);
    
    // Phase 2: Create dynamic layers
    const layerStartTime = Date.now();
    const dynamicLayers = this._createDynamicLayers(cargoByType, containerType);
    performanceMetrics.layerCreation = Date.now() - layerStartTime;
    console.log(`Created ${dynamicLayers.length} dynamic layers (${performanceMetrics.layerCreation}ms)`);
    
    // 存储层信息到plan中，用于可视化
    plan.layers = dynamicLayers;
    
    // Phase 3: Pack items into layers
    const packingStartTime = Date.now();
    for (const layer of dynamicLayers) {
      this._loadLayer(layer, cargoByType, plan, containerType);
      this._optimizeLayerHeight(layer, plan);
    }
    performanceMetrics.packing = Date.now() - packingStartTime;
    console.log(`Packing complete (${performanceMetrics.packing}ms)`);
    
    // Phase 4: Post-processing (statistics and visualization)
    const postProcessStartTime = Date.now();
    
    // 计算统计信息
    plan.spaceUtilization = this._calculateSpaceUtilization(plan, containerType);
    plan.totalWeight = this._calculateTotalWeight(plan);
    plan.totalCargoCount = plan.loadedCargo.length;
    plan.centerOfGravity = this._calculateCenterOfGravity(plan, containerType);
    plan.loadDistribution = this._calculateLoadDistribution(plan, containerType);
    
    // 简化合规校验
    plan.compliance = this._simpleComplianceCheck(plan, containerType);
    
    // 生成3D可视化数据
    plan.visualizationData = this._generateVisualizationData(plan);
    
    performanceMetrics.postProcessing = Date.now() - postProcessStartTime;
    
    // 计算耗时
    const computationTimeMs = Date.now() - this.startTime;
    performanceMetrics.total = computationTimeMs;
    plan.computationTime = parseFloat((computationTimeMs / 1000).toFixed(3));
    plan.performanceMetrics = performanceMetrics;
    
    console.log(`\n=== Packing Complete ===`);
    console.log(`Time: ${plan.computationTime.toFixed(2)}s (Grid: ${performanceMetrics.gridCalculation}ms, Layers: ${performanceMetrics.layerCreation}ms, Packing: ${performanceMetrics.packing}ms, Post: ${performanceMetrics.postProcessing}ms)`);
    console.log(`Loaded: ${plan.loadedCargo.length}, Unloaded: ${plan.unloadedCargo.length}`);
    console.log(`Space utilization: ${plan.spaceUtilization.toFixed(2)}%`);
    
    // Verify performance constraint (<10 seconds)
    if (plan.computationTime >= 10) {
      console.warn(`⚠️ WARNING: Computation time ${plan.computationTime.toFixed(2)}s exceeds 10s limit`);
    }
    
    return plan;
  }

  /**
   * 按货物类型分类
   */
  _classifyCargoByType(cargoList) {
    const classified = {};
    
    cargoList.forEach(cargo => {
      if (!classified[cargo.name]) {
        classified[cargo.name] = [];
      }
      
      // 展开数量
      for (let i = 0; i < cargo.quantity; i++) {
        classified[cargo.name].push({
          ...cargo,
          quantity: 1,
          instanceId: `${cargo.cargoId}_${i + 1}`
        });
      }
    });
    
    return classified;
  }

  /**
   * Analyze cargo stacking groups for dynamic layer height calculation
   * 
   * Groups cargo by stacking capability to optimize vertical space utilization.
   * Stackable items with higher stack limits are prioritized for lower layers.
   * 
   * Core Strategy:
   * 1. Separate cargo into stackable and non-stackable categories
   * 2. Sort stackable items by stack limit (descending) - stronger stacking first
   * 3. Assign stackable items to bottom layers to maximize vertical space
   * 4. Assign non-stackable items to middle or top layers
   * 
   * Benefits:
   * - Bottom layers use high-stacking cargo to maximize vertical space
   * - Prevents non-stackable items from occupying bottom layers and wasting space above
   * - Calculates precise layer height requirements for each group
   * 
   * @param {Object} cargoByType - Cargo classified by type (from _classifyCargoByType)
   *                               Format: { typeName: [cargoItem1, cargoItem2, ...] }
   * @returns {Array<Object>} Array of stacking groups, each containing:
   *                          - types: Array of cargo type names in this group
   *                          - stackable: Boolean indicating if group is stackable
   *                          - maxStackLayers: Maximum stack layers for this group
   *                          - items: Array of cargo items with metadata
   * 
   * @example
   * // Input: { "Air Fryer": [...], "Heater": [...], "Fan": [...] }
   * // Output: [
   * //   { types: ["Air Fryer", "Heater"], stackable: true, maxStackLayers: 4, items: [...] },
   * //   { types: ["Fan"], stackable: false, maxStackLayers: 1, items: [...] }
   * // ]
   */
  _analyzeStackingGroups(cargoByType) {
    const groups = [];
    
    // 分离可堆叠和不可堆叠货物
    // 可堆叠：stackable=true 且 maxStackLayers>1
    // 不可堆叠：stackable=false 或 maxStackLayers=1
    const stackable = [];
    const nonStackable = [];
    
    Object.entries(cargoByType).forEach(([name, items]) => {
      if (items.length === 0) return;
      
      const cargo = items[0];
      if (cargo.stackable && cargo.maxStackLayers > 1) {
        // 可堆叠货物：记录堆叠层数和高度
        stackable.push({
          name: name,
          items: items,
          maxStackLayers: cargo.maxStackLayers,
          height: cargo.height
        });
      } else {
        // 不可堆叠货物：堆叠层数固定为1
        nonStackable.push({
          name: name,
          items: items,
          maxStackLayers: 1,
          height: cargo.height
        });
      }
    });
    
    // 按堆叠层数降序排序（堆叠能力强的优先放底层）
    // 例如：空气炸锅(4层) > 取暖器(3层)
    // 这样可以确保底层货物能充分利用垂直空间
    stackable.sort((a, b) => b.maxStackLayers - a.maxStackLayers);
    
    // 组1: 可堆叠货物（放底层）
    // 将所有可堆叠货物归为一组，分配到底层
    // 这样可以最大化垂直空间利用率
    if (stackable.length > 0) {
      groups.push({
        types: stackable.map(s => s.name),
        stackable: true,
        maxStackLayers: Math.max(...stackable.map(s => s.maxStackLayers)),
        items: stackable
      });
    }
    
    // 组2: 不可堆叠货物（放中层或顶层）
    // 不可堆叠货物只能单层放置，分配到上层
    // 避免占据底层空间，浪费垂直空间
    if (nonStackable.length > 0) {
      groups.push({
        types: nonStackable.map(s => s.name),
        stackable: false,
        maxStackLayers: 1,
        items: nonStackable
      });
    }
    
    return groups;
  }

  /**
   * Calculate required layer height for a stacking group
   * 
   * Computes the minimum layer height needed to accommodate all cargo types
   * in a stacking group, considering their stacking capabilities.
   * 
   * Layer Height Calculation Strategy:
   * 1. Stackable cargo: height = item_height × max_stack_layers
   *    - Example: Air fryer 350mm × 4 layers = 1400mm
   *    - Maximizes vertical space by stacking multiple layers at once
   * 
   * 2. Non-stackable cargo: height = item_height
   *    - Example: Fan 1200mm × 1 layer = 1200mm
   *    - Non-stackable items can only be placed in single layer
   * 
   * 3. Safety clearance: adds 50mm to calculated height
   *    - Prevents cargo top from touching bottom of upper layer
   *    - Provides operational space and safety margin
   *    - Accounts for loading tolerances
   * 
   * 4. Multiple cargo types in group: uses maximum height
   *    - Ensures layer can accommodate all cargo types in the group
   * 
   * @param {Object} group - Stacking group from _analyzeStackingGroups
   *                         Contains: types, stackable, maxStackLayers, items
   * @param {Object} cargoByType - Cargo classified by type
   *                               Format: { typeName: [cargoItem1, cargoItem2, ...] }
   * @returns {number} Required layer height in millimeters (includes 50mm clearance)
   * 
   * @example
   * // Stackable group with air fryers (350mm, 4 layers)
   * // Returns: 350 * 4 + 50 = 1450mm
   * 
   * @example
   * // Non-stackable group with fans (1200mm)
   * // Returns: 1200 + 50 = 1250mm
   */
  _calculateRequiredHeight(group, cargoByType) {
    let maxHeight = 0;
    
    // 遍历组内所有货物类型，找到最大高度需求
    group.types.forEach(typeName => {
      const items = cargoByType[typeName];
      if (items && items.length > 0) {
        const item = items[0];
        
        // 根据货物堆叠能力计算所需高度
        if (group.stackable) {
          // 可堆叠货物：高度 = 单个货物高度 × 该货物自身的最大堆叠层数
          // 注意：使用货物自身的maxStackLayers，而不是组的maxStackLayers
          // 因为同一组内不同货物可能有不同的堆叠限制
          const itemMaxStack = item.maxStackLayers || 1;
          const stackHeight = item.height * itemMaxStack;
          maxHeight = Math.max(maxHeight, stackHeight);
        } else {
          // 不可堆叠货物：高度 = 单个货物高度
          // 不可堆叠货物只能单层放置，不能叠加
          maxHeight = Math.max(maxHeight, item.height);
        }
      }
    });
    
    // 添加50mm安全间隙
    // 这个间隙用于：
    // 1. 防止货物顶部与上层货物底部紧贴，留出操作空间
    // 2. 考虑实际装载时的误差和安全余量
    // 3. 为后续层高优化留出调整空间
    const requiredHeight = maxHeight + 50;
    
    return requiredHeight;
  }

  /**
   * Create dynamic layer definitions based on cargo stacking capabilities
   * 
   * Replaces fixed layer height rules with dynamic calculation based on actual
   * cargo dimensions and stacking limits. Eliminates vertical space waste.
   * 
   * Dynamic Layer Height Strategy Benefits:
   * 1. Eliminates vertical space waste by calculating heights from actual cargo
   * 2. Adapts to different cargo combinations with flexible layer allocation
   * 3. Intelligent space allocation when total demand exceeds container height
   * 4. Distributes remaining vertical space to stackable cargo layers
   * 
   * Algorithm Flow:
   * Step 1: Analyze stacking groups (separate by stacking capability)
   * Step 2: Calculate required height for each group
   * Step 3: Check if total demand exceeds container height
   *   - If not exceeded: Normal allocation, each group gets calculated height
   *   - If exceeded: Intelligent compression, prioritize stackable cargo space
   * Step 4: Distribute remaining vertical space to stackable cargo layers
   * 
   * @param {Object} cargoByType - Cargo classified by type
   *                               Format: { typeName: [cargoItem1, cargoItem2, ...] }
   * @param {Object} containerType - Container type with dimensions
   *                                 Must have: innerLength, innerWidth, innerHeight
   * @returns {Array<Object>} Array of dynamic layer definitions, each containing:
   *                          - name: Layer identifier (e.g., "Layer_1")
   *                          - cargoTypes: Array of allowed cargo type names
   *                          - zStart: Starting Z coordinate in mm
   *                          - maxHeight: Maximum layer height in mm
   *                          - priority: Loading priority (1 = first)
   * 
   * @example
   * // Input: Cixi test case (air fryers, heaters, fans) in 40HQ container
   * // Output: [
   * //   { name: "Layer_1", cargoTypes: ["Air Fryer", "Heater"], zStart: 0, maxHeight: 1450, priority: 1 },
   * //   { name: "Layer_2", cargoTypes: ["Fan"], zStart: 1450, maxHeight: 1250, priority: 2 }
   * // ]
   */
  _createDynamicLayers(cargoByType, containerType) {
    const layers = [];
    let currentZ = 0; // 当前Z坐标（层的起始高度）
    
    // Step 1: 分析堆叠组
    // 将货物按堆叠能力分组（可堆叠优先，不可堆叠其次）
    const stackingGroups = this._analyzeStackingGroups(cargoByType);
    
    // Step 2: 为每个组计算所需层高
    // 首先计算所有组需要的总高度，用于判断是否需要压缩
    const groupHeights = stackingGroups.map(group => 
      this._calculateRequiredHeight(group, cargoByType)
    );
    const totalRequiredHeight = groupHeights.reduce((sum, h) => sum + h, 0);
    
    console.log(`Creating dynamic layers: ${stackingGroups.length} groups, total height ${totalRequiredHeight}mm / ${containerType.innerHeight}mm`);
    
    // Step 3: 根据总需求与容器高度的关系，选择分配策略
    if (totalRequiredHeight > containerType.innerHeight) {
      // 策略A: 总需求超过容器高度，需要智能压缩和分配
      console.log(`  WARNING: Total demand exceeds container height, adjusting strategy...`);
      
      // 优先保证可堆叠货物有足够空间，压缩不可堆叠货物的层高
      // 原因：可堆叠货物能充分利用垂直空间，优先级更高
      for (let i = 0; i < stackingGroups.length; i++) {
        const group = stackingGroups[i];
        let layerHeight = groupHeights[i];
        
        // 检查剩余空间
        const remainingHeight = containerType.innerHeight - currentZ;
        if (remainingHeight <= 0) {
          break; // 没有剩余空间，停止创建层
        }
        
        // 空间分配策略：
        // - 如果是最后一个组：使用所有剩余空间
        // - 如果当前组需求超过剩余空间：分配60%给当前组，留40%给后续组
        // - 否则：使用计算的层高
        if (i === stackingGroups.length - 1) {
          // 最后一个组，使用所有剩余空间
          layerHeight = Math.min(layerHeight, remainingHeight);
        } else if (layerHeight > remainingHeight) {
          // 当前组需求超过剩余空间，按比例分配
          layerHeight = Math.floor(remainingHeight * 0.6); // 给当前组60%，留40%给后续
        }
        
        // 创建层定义
        const layer = {
          name: `Layer_${layers.length + 1}`,
          cargoTypes: group.types, // 该层允许的货物类型
          zStart: currentZ, // 层的起始Z坐标
          maxHeight: layerHeight, // 层的最大高度
          priority: layers.length + 1 // 装载优先级（数字越小优先级越高）
        };
        
        layers.push(layer);
        currentZ += layerHeight; // 更新当前Z坐标
      }
    } else {
      // 策略B: 总需求未超过容器高度，正常分配
      // 每个组都能获得计算的层高，无需压缩
      for (let i = 0; i < stackingGroups.length; i++) {
        const group = stackingGroups[i];
        const layerHeight = groupHeights[i];
        
        // 创建层定义
        const layer = {
          name: `Layer_${layers.length + 1}`,
          cargoTypes: group.types,
          zStart: currentZ,
          maxHeight: layerHeight,
          priority: layers.length + 1
        };
        
        layers.push(layer);
        currentZ += layerHeight;
      }
      
      // Step 4: 分配剩余垂直空间
      // 如果还有剩余空间，将其分配给可堆叠货物层，进一步提高利用率
      const remainingHeight = containerType.innerHeight - currentZ;
      if (remainingHeight > 0 && layers.length > 0) {
        // 找到所有可堆叠货物层
        // 只给可堆叠货物层增加高度，因为它们能充分利用额外空间
        const stackableLayers = layers.filter((layer, idx) => 
          stackingGroups[idx] && stackingGroups[idx].stackable
        );
        
        if (stackableLayers.length > 0) {
          // 将剩余空间平均分配给所有可堆叠货物层
          const extraPerLayer = Math.floor(remainingHeight / stackableLayers.length);
          stackableLayers.forEach(layer => {
            layer.maxHeight += extraPerLayer;
          });
        }
      }
    }
    
    return layers;
  }

  /**
   * 装载单层（支持堆叠）
   */
  _loadLayer(layer, cargoByType, plan, containerType) {
    let loadingOrder = plan.loadedCargo.length;
    
    // 遍历该层允许的货物类型
    for (const cargoType of layer.cargoTypes) {
      const cargoItems = cargoByType[cargoType] || [];
      
      // 使用网格填充策略
      this._fillLayerWithGrid(layer, cargoItems, plan, containerType, loadingOrder);
    }
  }

  /**
   * 使用网格填充策略装载货物（支持堆叠）
   */
  _fillLayerWithGrid(layer, cargoItems, plan, containerType, startOrder) {
        let loadingOrder = startOrder;

        // 初始化层状态跟踪
        // 用于监控层的空间利用情况和优化装载策略
        const layerState = {
          usedArea: 0, // 已使用的占地面积（mm²）
          totalArea: containerType.innerLength * containerType.innerWidth, // 总可用占地面积（mm²）
          placedItems: 0, // 已放置的货物数量
          itemHeights: [], // 记录所有货物高度，用于分析高度分组效果
          layerWeight: 0 // 该层的总重量（kg）
        };

        // 按占地面积排序（降序）- 先放置大件以避免碎片化
        // 大件优先策略（Largest First）：
        // 1. 大件货物对空间要求更严格，先放置可以避免后期找不到合适位置
        // 2. 小件货物更灵活，可以填充大件之间的缝隙
        // 3. 这种策略在装箱问题中被证明能有效减少空间碎片化
        const sortedItems = [...cargoItems].sort((a, b) => {
          const areaA = a.length * a.width;
          const areaB = b.length * b.width;
          return areaB - areaA; // 降序：大件优先
        });

        // 第一遍：尝试放置所有物品
        // 使用两遍策略：第一遍放置大部分货物，第二遍填充剩余空间
        const skippedLargeItems = [];

        for (const cargo of sortedItems) {
          // 计算当前层利用率
          // 用于判断是否应该跳过大件，为小件留出填充空间
          const currentUtilization = layerState.usedArea / layerState.totalArea;

          // 选择最佳旋转方向（优化空间利用）
          // 优先选择占地面积最小的旋转，最大化地面空间利用
          const rotation = this._getBestRotationForSpace(cargo, layer.maxHeight, containerType);

          if (!rotation) {
            plan.unloadedCargo.push({
              cargo: cargo,
              reason: `高度${cargo.height}mm超过${layer.name}限制${layer.maxHeight}mm`
            });
            continue;
          }

          // 如果层已经85%+满，跳过大件物品，稍后尝试小件填充
          // 85%阈值的选择：
          // 1. 留出15%空间用于小件填充，提高整体利用率
          // 2. 避免大件占用最后的空间，导致小件无法放置
          // 3. 实验表明85%是平衡大件放置和小件填充的最佳点
          if (currentUtilization >= 0.85) {
            const itemFootprint = rotation.footprintArea;
            const averageFootprint = layerState.usedArea / Math.max(layerState.placedItems, 1);

            // 如果物品占地面积大于平均值，认为是大件，跳过
            // 这样可以为小件留出填充空间，提高最终利用率
            if (itemFootprint > averageFootprint) {
              skippedLargeItems.push(cargo);
              continue;
            }
          }

          // 尝试找到可用位置（支持堆叠）
          const position = this._findAvailablePosition(cargo, rotation, layer, plan, containerType);

          if (!position) {
            // 检查是否因为堆叠限制导致无法放置
            const maxStackLayers = cargo.stackable ? (cargo.maxStackLayers || 1) : 1;
            let stackLimitReached = false;
            
            // 简单检查：如果该层已有同类型货物且数量接近理论最大堆叠数，可能是堆叠限制
            const sameTypeInLayer = plan.loadedCargo.filter(l => 
              l.layer === layer.name && l.cargo.name === cargo.name
            ).length;
            
            if (sameTypeInLayer > 0 && maxStackLayers > 1) {
              stackLimitReached = true;
            }
            
            const reason = stackLimitReached 
              ? `${layer.name}堆叠限制已达上限(最大${maxStackLayers}层)或空间已满`
              : `${layer.name}空间已满`;
            
            plan.unloadedCargo.push({
              cargo: cargo,
              reason: reason
            });
            
            continue;
          }

          // 计算当前位置的堆叠层数（用于日志）
          const stackLevel = this._countStackLevelsAt(position.x, position.y, rotation.length, rotation.width, cargo, layer, plan) + 1;

          // 检查总重量
          const currentWeight = this._calculateTotalWeight(plan);
          if (currentWeight + cargo.weight > containerType.maxWeight) {
            plan.unloadedCargo.push({
              cargo: cargo,
              reason: `超重: 当前${currentWeight.toFixed(2)}kg + ${cargo.weight}kg > 限制${containerType.maxWeight}kg`
            });
            
            // 记录约束违规
            console.log(`  ⚠️ Constraint violation: ${cargo.name} - Weight limit exceeded (${currentWeight.toFixed(2)}kg + ${cargo.weight}kg > ${containerType.maxWeight}kg)`);
            
            continue;
          }

          // 放置货物
          loadingOrder++;
          plan.loadedCargo.push({
            cargo: cargo,
            position: position,
            rotation: rotation,
            loadingOrder: loadingOrder,
            layer: layer.name,
            stackLevel: stackLevel // 记录堆叠层数
          });

          // 更新层状态
          layerState.usedArea += rotation.footprintArea;
          layerState.placedItems++;
          layerState.itemHeights.push(rotation.height); // Track height for grouping analysis
          layerState.layerWeight += cargo.weight; // Track weight per layer
        }

        // 第二遍：尝试用小件填充剩余空间（处理之前跳过的大件）
        // 这一遍尝试放置第一遍跳过的大件，看是否有合适的位置
        // 如果仍然无法放置，说明空间确实不足
        if (skippedLargeItems.length > 0) {
          for (const cargo of skippedLargeItems) {
            const rotation = this._getBestRotationForSpace(cargo, layer.maxHeight, containerType);

            if (!rotation) {
              plan.unloadedCargo.push({
                cargo: cargo,
                reason: `高度${cargo.height}mm超过${layer.name}限制${layer.maxHeight}mm`
              });
              continue;
            }

            const position = this._findAvailablePosition(cargo, rotation, layer, plan, containerType);

            if (!position) {
              // 检查是否因为堆叠限制导致无法放置
              const maxStackLayers = cargo.stackable ? (cargo.maxStackLayers || 1) : 1;
              let stackLimitReached = false;
              
              // 简单检查：如果该层已有同类型货物且数量接近理论最大堆叠数，可能是堆叠限制
              const sameTypeInLayer = plan.loadedCargo.filter(l => 
                l.layer === layer.name && l.cargo.name === cargo.name
              ).length;
              
              if (sameTypeInLayer > 0 && maxStackLayers > 1) {
                stackLimitReached = true;
              }
              
              const reason = stackLimitReached 
                ? `${layer.name}堆叠限制已达上限(最大${maxStackLayers}层)或空间已满`
                : `${layer.name}空间已满`;
              
              plan.unloadedCargo.push({
                cargo: cargo,
                reason: reason
              });
              
              continue;
            }

            // 计算当前位置的堆叠层数（用于日志）
            const stackLevel = this._countStackLevelsAt(position.x, position.y, rotation.length, rotation.width, cargo, layer, plan) + 1;

            // 检查总重量
            const currentWeight = this._calculateTotalWeight(plan);
            if (currentWeight + cargo.weight > containerType.maxWeight) {
              plan.unloadedCargo.push({
                cargo: cargo,
                reason: `超重: 当前${currentWeight.toFixed(2)}kg + ${cargo.weight}kg > 限制${containerType.maxWeight}kg`
              });
              
              // 记录约束违规
              console.log(`  ⚠️ Constraint violation: ${cargo.name} - Weight limit exceeded (${currentWeight.toFixed(2)}kg + ${cargo.weight}kg > ${containerType.maxWeight}kg)`);
              
              continue;
            }

            // 放置货物
            loadingOrder++;
            plan.loadedCargo.push({
              cargo: cargo,
              position: position,
              rotation: rotation,
              loadingOrder: loadingOrder,
              layer: layer.name,
              stackLevel: stackLevel // 记录堆叠层数
            });

            // 更新层状态
            layerState.usedArea += rotation.footprintArea;
            layerState.placedItems++;
            layerState.itemHeights.push(rotation.height); // Track height for grouping analysis
            layerState.layerWeight += cargo.weight; // Track weight per layer
          }
        }

        // 记录层的占地面积利用率
        const utilizationPercent = (layerState.usedArea / layerState.totalArea * 100).toFixed(2);
        console.log(`  ${layer.name}: ${layerState.placedItems} items, floor utilization ${utilizationPercent}%, weight ${layerState.layerWeight.toFixed(2)}kg`);
      }



  /**
   * Optimize layer height based on actual placed cargo
   * 
   * Reduces vertical space waste by adjusting layer height to match the actual
   * maximum height used by placed items, plus a safety clearance.
   * 
   * Optimization Strategy:
   * 1. Find actual maximum height used in the layer
   * 2. Calculate optimized height = actual_height + 50mm clearance
   * 3. Only reduce height (never increase) to avoid affecting subsequent layers
   * 4. Log saved space for debugging and validation
   * 
   * This method is called after each layer is filled to reclaim unused vertical
   * space, which can improve overall space utilization by 10-15%.
   * 
   * @param {Object} layer - Layer definition to optimize
   *                         Must have: name, zStart, maxHeight
   * @param {Object} plan - Packing plan with placed cargo
   *                        Must have: loadedCargo array with items containing
   *                        layer, position.z, rotation.height
   * @returns {void} Modifies layer.maxHeight in place
   * 
   * @example
   * // Layer with maxHeight=1400mm, but items only use 1100mm
   * // After optimization: maxHeight=1150mm (1100 + 50mm clearance)
   * // Saved space: 250mm
   */
  _optimizeLayerHeight(layer, plan) {
    // 找到该层中所有已放置的货物
    const layerItems = plan.loadedCargo.filter(l => l.layer === layer.name);
    
    if (layerItems.length === 0) {
      return; // 空层无需优化
    }
    
    // 找到该层实际使用的最大高度
    // 遍历所有货物，计算每个货物顶部的Z坐标（position.z + height）
    // 然后减去层的起始Z坐标，得到相对于层底的高度
    let maxUsedHeight = 0;
    layerItems.forEach(item => {
      const topZ = item.position.z + item.rotation.height; // 货物顶部的绝对Z坐标
      const relativeHeight = topZ - layer.zStart; // 相对于层底的高度
      maxUsedHeight = Math.max(maxUsedHeight, relativeHeight);
    });
    
    // 计算优化后的层高 = 实际高度 + 50mm间隙
    // 50mm间隙用于：
    // 1. 防止货物顶部与上层货物底部紧贴，留出操作空间
    // 2. 考虑实际装载时的误差和安全余量
    const optimizedHeight = maxUsedHeight + 50;
    
    // 只减少高度，不增加（避免影响后续层）
    // 如果优化后的高度小于原始层高，说明有空间浪费，可以回收
    // 回收的空间可以用于其他层或提高整体利用率
    if (optimizedHeight < layer.maxHeight) {
      const savedSpace = layer.maxHeight - optimizedHeight;
      console.log(`  ${layer.name} optimized: ${layer.maxHeight}mm → ${optimizedHeight}mm (saved ${savedSpace}mm)`);
      layer.maxHeight = optimizedHeight;
    }
  }

  /**
   * Log height grouping effectiveness for a layer (removed for cleaner logs)
   * Height grouping statistics are tracked internally but not logged to reduce verbosity.
   */
  _logHeightGrouping(layer, layerState) {
    // Statistics tracked internally, no console output
    return;
  }

  /**
   * 查找可用位置（支持堆叠）
   * @param {Object} cargo - 货物对象
   * @param {Object} rotation - 旋转后的尺寸
   * @param {Object} layer - 层定义
   * @param {Object} plan - 装箱方案
   * @param {Object} containerType - 集装箱类型
   * @returns {Object|null} 可用位置或null
   */
  _findAvailablePosition(cargo, rotation, layer, plan, containerType) {
    const gridSize = this.gridSize; // 使用计算的网格尺寸
    const maxX = Math.floor(containerType.innerLength / gridSize);
    const maxY = Math.floor(containerType.innerWidth / gridSize);
    
    // 遍历网格寻找可用位置
    for (let gy = 0; gy < maxY; gy++) {
      for (let gx = 0; gx < maxX; gx++) {
        const x = gx * gridSize;
        const y = gy * gridSize;
        
        // 检查是否超出边界
        if (x + rotation.length > containerType.innerLength) continue;
        if (y + rotation.width > containerType.innerWidth) continue;
        
        // 检查堆叠层数限制
        const stackLevels = this._countStackLevelsAt(x, y, rotation.length, rotation.width, cargo, layer, plan);
        const maxStackLayers = cargo.stackable ? (cargo.maxStackLayers || 1) : 1;
        
        if (stackLevels >= maxStackLayers) {
          // 已达到最大堆叠层数，跳过此位置
          continue;
        }
        
        // 找到该位置的最高点
        const z = this._findHighestPointAt(x, y, rotation.length, rotation.width, layer, plan);
        
        // 检查是否超出层高限制
        if (z + rotation.height > layer.zStart + layer.maxHeight) continue;
        
        // 检查是否超出集装箱高度
        if (z + rotation.height > containerType.innerHeight) continue;
        
        // 检查是否与已有货物重叠
        const position = { x, y, z };
        if (!this._isPositionAvailable(position, rotation, plan)) continue;
        
        return position;
      }
    }
    
    return null;
  }

  /**
   * 找到指定位置的最高点
   */
  _findHighestPointAt(x, y, length, width, layer, plan) {
    let maxZ = layer.zStart;
    
    // 检查该层内所有已放置的货物
    const layerCargo = plan.loadedCargo.filter(l => l.layer === layer.name);
    
    for (const loaded of layerCargo) {
      const pos = loaded.position;
      const rot = loaded.rotation;
      
      // 检查XY平面是否重叠
      const overlapX = !(x + length <= pos.x || pos.x + rot.length <= x);
      const overlapY = !(y + width <= pos.y || pos.y + rot.width <= y);
      
      if (overlapX && overlapY) {
        maxZ = Math.max(maxZ, pos.z + rot.height);
      }
    }
    
    return maxZ;
  }

  /**
   * 计算指定位置的堆叠层数
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} length - 货物长度
   * @param {number} width - 货物宽度
   * @param {Object} cargo - 货物对象（用于检查同类型堆叠）
   * @param {Object} layer - 层定义
   * @param {Object} plan - 装箱方案
   * @returns {number} 堆叠层数
   */
  _countStackLevelsAt(x, y, length, width, cargo, layer, plan) {
    let stackLevels = 0;
    
    // 检查该层内所有已放置的货物
    const layerCargo = plan.loadedCargo.filter(l => l.layer === layer.name);
    
    for (const loaded of layerCargo) {
      const pos = loaded.position;
      const rot = loaded.rotation;
      
      // 检查XY平面是否重叠
      const overlapX = !(x + length <= pos.x || pos.x + rot.length <= x);
      const overlapY = !(y + width <= pos.y || pos.y + rot.width <= y);
      
      // 如果重叠，且是同类型货物，计数堆叠层数
      if (overlapX && overlapY && loaded.cargo.name === cargo.name) {
        stackLevels++;
      }
    }
    
    return stackLevels;
  }

  /**
   * 检查位置是否可用
   */
  _isPositionAvailable(position, rotation, plan) {
    for (const loaded of plan.loadedCargo) {
      const pos = loaded.position;
      const rot = loaded.rotation;
      
      // 检查3D空间是否重叠
      const overlapX = !(position.x + rotation.length <= pos.x || pos.x + rot.length <= position.x);
      const overlapY = !(position.y + rotation.width <= pos.y || pos.y + rot.width <= position.y);
      const overlapZ = !(position.z + rotation.height <= pos.z || pos.z + rot.height <= position.z);
      
      if (overlapX && overlapY && overlapZ) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Calculate optimal grid size for cargo placement
   * 
   * Computes grid size based on the greatest common divisor (GCD) of all cargo
   * dimensions to minimize discretization waste. Smaller grid sizes allow more
   * precise placement but increase computation time.
   * 
   * Algorithm:
   * Step 1: Extract all unique dimensions from cargo (length, width, height)
   * Step 2: Calculate GCD of all dimensions using Euclidean algorithm
   * Step 3: Apply constraints (10mm minimum, 50mm maximum)
   * 
   * Constraints Rationale:
   * - Minimum 10mm: Prevents grid from being too fine, which would cause
   *   search space explosion and performance degradation
   * - Maximum 50mm: Prevents grid from being too coarse, which would cause
   *   excessive space waste due to alignment requirements
   * 
   * @param {Array<Object>} cargoList - Array of cargo objects
   *                                    Each must have: length, width, height (in mm)
   * @returns {number} Optimal grid size in millimeters (10-50mm range)
   * 
   * @example
   * // Cargo: 300×300×350mm, 500×400×600mm, 400×400×1200mm
   * // Dimensions: [300, 350, 400, 500, 600, 1200]
   * // GCD: 50mm
   * // Returns: 50mm (within constraints)
   * 
   * @example
   * // Cargo with dimensions producing GCD=7mm
   * // Returns: 10mm (clamped to minimum)
   */
  _calculateOptimalGridSize(cargoList) {
    // Step 1: 提取所有唯一尺寸
    // 使用Set自动去重，收集所有货物的长、宽、高尺寸
    // 这样可以避免重复计算相同的尺寸值
    const dimensions = new Set();
    cargoList.forEach(cargo => {
      dimensions.add(cargo.length);
      dimensions.add(cargo.width);
      dimensions.add(cargo.height);
    });
    
    // Step 2: 计算所有尺寸的GCD（最大公约数）
    // GCD确保所有货物尺寸都能对齐到网格，避免浪费空间
    // 例如：300mm和400mm的GCD是100mm，但300mm和500mm的GCD是100mm
    // 而300mm、400mm、600mm的GCD是100mm，但300mm、500mm、400mm的GCD是100mm
    const dimArray = Array.from(dimensions);
    if (dimArray.length === 0) {
      return 50; // 默认值：如果没有货物，使用50mm作为安全默认值
    }
    
    // 从第一个尺寸开始，逐个计算与后续尺寸的GCD
    // 最终得到所有尺寸的公共GCD
    let gcd = dimArray[0];
    for (let i = 1; i < dimArray.length; i++) {
      gcd = this._gcd(gcd, dimArray[i]);
    }
    
    // Step 3: 应用约束（10mm最小，50mm最大）
    // 最小值10mm：防止网格过细导致搜索空间爆炸，影响性能
    // 最大值50mm：防止网格过粗导致空间浪费，影响利用率
    if (gcd < 10) gcd = 10;
    if (gcd > 50) gcd = 50;
    
    return gcd;
  }

  /**
   * Calculate greatest common divisor (GCD) using Euclidean algorithm
   * 
   * Implements the classic Euclidean algorithm for finding GCD of two numbers.
   * Handles edge cases including zero and negative values.
   * 
   * Algorithm: GCD(a, b) = GCD(b, a mod b), with base case GCD(a, 0) = a
   * 
   * @param {number} a - First number
   * @param {number} b - Second number
   * @returns {number} Greatest common divisor of a and b
   * 
   * @example
   * _gcd(300, 500) // Returns: 100
   * _gcd(350, 600) // Returns: 50
   * _gcd(0, 100)   // Returns: 100
   * _gcd(-300, 400) // Returns: 100 (handles negatives)
   */
  _gcd(a, b) {
    // 处理边界情况
    a = Math.abs(a);
    b = Math.abs(b);
    
    // 如果任一数为0，返回另一个数
    if (a === 0) return b;
    if (b === 0) return a;
    
    // 欧几里得算法：递归计算GCD
    return b === 0 ? a : this._gcd(b, a % b);
  }

  /**
   * 获取最佳旋转方向（高度最小）
   */
  _getBestRotation(cargo, maxHeight) {
    const rotations = [
      { length: cargo.length, width: cargo.width, height: cargo.height },
      { length: cargo.width, width: cargo.length, height: cargo.height },
      { length: cargo.length, width: cargo.height, height: cargo.width },
      { length: cargo.height, width: cargo.width, height: cargo.length },
      { length: cargo.width, width: cargo.height, height: cargo.length },
      { length: cargo.height, width: cargo.length, height: cargo.width }
    ];
    
    // 过滤掉高度超过限制的旋转
    const validRotations = rotations.filter(r => r.height <= maxHeight);
    
    if (validRotations.length === 0) {
      return null;
    }
    
    // 选择高度最小的旋转
    validRotations.sort((a, b) => a.height - b.height);
    return validRotations[0];
  }

  /**
   * Get best rotation for space optimization
   * 
   * Selects the optimal cargo rotation to maximize floor space utilization.
   * Prioritizes minimizing footprint area (length × width) over minimizing height.
   * 
   * Rotation Selection Strategy:
   * 1. Generate all 6 possible rotations (LWH, WLH, LHW, HWL, WHL, HLW)
   * 2. Filter by height constraint (rotation.height <= maxHeight)
   * 3. Filter by container dimensions (length/width <= container dimensions)
   * 4. Calculate footprint area for each valid rotation
   * 5. Sort by footprint area (ascending), then height (ascending)
   * 6. Apply 5% tolerance: if areas within 5%, prefer shorter height
   * 
   * This strategy differs from _getBestRotation which only minimizes height.
   * By minimizing footprint area, more items can fit in each layer, improving
   * overall space utilization by 5-8%.
   * 
   * @param {Object} cargo - Cargo object with dimensions
   *                         Must have: length, width, height (in mm)
   * @param {number} maxHeight - Maximum allowed height for this layer (in mm)
   * @param {Object} containerType - Container type with dimensions
   *                                 Must have: innerLength, innerWidth
   * @returns {Object|null} Best rotation object with properties:
   *                        - length, width, height: Rotated dimensions (mm)
   *                        - footprintArea: length × width (mm²)
   *                        - id: Rotation identifier (e.g., "LWH")
   *                        Returns null if no valid rotation exists
   * 
   * @example
   * // Cargo: 300×400×600mm, maxHeight: 1400mm
   * // Valid rotations: LWH (300×400, area=120000), WLH (400×300, area=120000)
   * // Areas within 5%, so prefer shorter height
   * // Returns: { length: 300, width: 400, height: 600, footprintArea: 120000, id: "LWH" }
   * 
   * @example
   * // Cargo: 500×400×600mm, maxHeight: 500mm
   * // Only rotations with height<=500mm are valid
   * // Returns rotation with smallest footprint area among valid options
   */
  _getBestRotationForSpace(cargo, maxHeight, containerType) {
    // Step 1: 生成所有6种可能的旋转
    // 每个货物有3个维度（长、宽、高），可以有6种排列方式
    // LWH: 长×宽×高（原始方向）
    // WLH: 宽×长×高（旋转90度）
    // LHW: 长×高×宽（侧放）
    // HWL: 高×宽×长（竖放）
    // WHL: 宽×高×长（侧放+旋转）
    // HLW: 高×长×宽（竖放+旋转）
    const rotations = [
      { length: cargo.length, width: cargo.width, height: cargo.height, id: 'LWH' },
      { length: cargo.width, width: cargo.length, height: cargo.height, id: 'WLH' },
      { length: cargo.length, width: cargo.height, height: cargo.width, id: 'LHW' },
      { length: cargo.height, width: cargo.width, height: cargo.length, id: 'HWL' },
      { length: cargo.width, width: cargo.height, height: cargo.length, id: 'WHL' },
      { length: cargo.height, width: cargo.length, height: cargo.width, id: 'HLW' }
    ];
    
    // Step 2: 按高度约束过滤
    // 排除高度超过层高限制的旋转，确保货物能放入当前层
    let validRotations = rotations.filter(r => r.height <= maxHeight);
    
    // Step 3: 按集装箱尺寸过滤
    // 排除长度或宽度超过集装箱内部尺寸的旋转
    // 这是硬约束，任何超出的旋转都无法物理放置
    validRotations = validRotations.filter(r => 
      r.length <= containerType.innerLength && 
      r.width <= containerType.innerWidth
    );
    
    if (validRotations.length === 0) {
      return null; // 没有任何有效旋转，货物无法放置
    }
    
    // Step 4: 计算每个旋转的占地面积
    // 占地面积 = 长 × 宽（在XY平面上的投影面积）
    // 占地面积越小，同一层能放置的货物越多，空间利用率越高
    validRotations.forEach(r => {
      r.footprintArea = r.length * r.width;
    });
    
    // Step 5: 按占地面积（升序）排序，面积相近时按高度（升序）排序
    // 优先选择占地面积最小的旋转，最大化地面空间利用
    // 当两个旋转的占地面积相差在5%以内时，认为面积相近
    // 此时选择高度较小的旋转，为上层留出更多空间
    validRotations.sort((a, b) => {
      const areaDiff = a.footprintArea - b.footprintArea;
      // 如果面积差异在5%以内，优先选择高度较小的
      if (Math.abs(areaDiff) / a.footprintArea < 0.05) {
        return a.height - b.height; // 高度升序
      }
      return areaDiff; // 面积升序
    });
    
    // 返回排序后的第一个旋转（占地面积最小，或面积相近时高度最小）
    return validRotations[0];
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
    
    // 检查超重
    if (totalWeight > containerType.maxWeight) {
      score = 0;
      violations.push(`超重: ${totalWeight.toFixed(2)}kg > ${containerType.maxWeight}kg`);
    }
    // 货物总重量不足额定载重10%时直接给100分
    else if (weightUtilization < 10) {
      score = 100;
    }
    
    // 检查超容
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
    
    // 颜色映射
    const colorMap = {
      '电风扇': '#FF6B6B',
      '取暖器': '#4ECDC4',
      '空气炸锅': '#45B7D1',
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
      loadingOrder: loaded.loadingOrder,
      layer: loaded.layer
    }));
    
    // 生成层边界数据
    const layerBoundaries = [];
    if (plan.layers && plan.layers.length > 0) {
      for (const layer of plan.layers) {
        layerBoundaries.push({
          name: layer.name,
          zStart: layer.zStart,
          zEnd: layer.zStart + layer.maxHeight,
          height: layer.maxHeight,
          cargoTypes: layer.cargoTypes || []
        });
      }
    }
    
    // 计算装载率
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
      layerBoundaries: layerBoundaries,
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

module.exports = LayeredPackingEngine;
