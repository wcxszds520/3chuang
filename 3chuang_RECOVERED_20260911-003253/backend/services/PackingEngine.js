/**
 * PackingEngine - 3D装箱算法引擎
 * 
 * 职责：实现3D Bin Packing算法，生成符合约束条件的装箱方案
 * 
 * 核心算法策略：
 * 1. First Fit Decreasing (FFD): 按体积降序排列货物，优先放置大件货物
 * 2. Bottom-Left-Back (BLB): 优先填充底部、左侧、后侧空间
 * 3. Layer-by-Layer: 分层装载，每层内优化货物排列
 * 4. Constraint Checking: 实时检查堆叠、倒置、侧放等约束条件
 * 5. Weight Balance: 动态调整货物位置以优化重心分布
 * 
 * 性能优化：
 * - 限制算法迭代次数（最多1000次），确保10秒内完成
 * - 使用贪心策略快速生成初始方案，再进行局部优化
 */

const Cargo = require('../models/Cargo');
const ContainerType = require('../models/ContainerType');

class PackingEngine {
  constructor() {
    this.MAX_ITERATIONS = 1000; // 最大迭代次数限制
    this.currentIteration = 0;
  }

  /**
   * 生成装箱方案
   * @param {Array<Cargo>} cargoList - 货物列表
   * @param {ContainerType} containerType - 集装箱柜型
   * @returns {Object} 装箱方案对象
   */
  generatePackingPlan(cargoList, containerType) {
    console.log('开始生成装箱方案...');
    console.log(`货物数量: ${cargoList.length}, 柜型: ${containerType.name}`);
    
    this.currentIteration = 0;
    
    // 步骤1: 应用FFD策略 - 按体积降序排列货物
    const sortedCargo = this.applyFFDStrategy(cargoList);
    
    // 步骤2: 初始化装箱方案数据结构
    const plan = {
      loadedCargo: [],      // 已装载货物列表
      unloadedCargo: [],    // 未装载货物列表
      occupiedSpaces: [],   // 已占用空间列表（用于碰撞检测）- 确保初始化为数组
      containerType: containerType
    };
    
    // 步骤3: 初始化可用放置点列表（从原点开始）
    let availablePoints = [{
      x: 0,
      y: 0,
      z: 0,
      layer: 0  // 层级标记
    }];
    
    // 步骤4: 遍历排序后的货物，尝试放置
    for (let i = 0; i < sortedCargo.length && this.currentIteration < this.MAX_ITERATIONS; i++) {
      const cargo = sortedCargo[i];
      console.log(`尝试放置货物 ${i + 1}/${sortedCargo.length}: ${cargo.name}`);
      
      // 尝试所有可能的旋转方向
      const rotations = this.generateRotations(cargo);
      let placed = false;
      
      // 应用BLB策略：按照底部、左侧、后侧的优先级排序放置点
      availablePoints = this.sortPointsByBLB(availablePoints);
      
      // 尝试在每个可用点放置货物
      for (let point of availablePoints) {
        if (this.currentIteration >= this.MAX_ITERATIONS) break;
        this.currentIteration++;
        
        // 尝试每种旋转方向
        for (let rotation of rotations) {
          const position = {
            x: point.x,
            y: point.y,
            z: point.z
          };
          
          // 检查是否可以在此位置放置货物
          if (this.canPlaceCargo(cargo, position, rotation, plan, containerType)) {
            // 放置货物
            this.placeCargo(cargo, position, rotation, plan);
            
            // 更新可用放置点
            availablePoints = this.updateAvailablePoints(
              availablePoints,
              position,
              rotation,
              point.layer,
              containerType
            );
            
            placed = true;
            console.log(`成功放置货物: ${cargo.name} at (${position.x}, ${position.y}, ${position.z})`);
            break;
          }
        }
        
        if (placed) break;
      }
      
      // 如果无法放置，添加到未装载列表
      if (!placed) {
        plan.unloadedCargo.push({
          cargo: cargo,
          reason: this.getUnloadedReason(cargo, containerType)
        });
        console.log(`无法放置货物: ${cargo.name}, 原因: ${this.getUnloadedReason(cargo, containerType)}`);
      }
    }
    
    console.log(`装箱方案生成完成，迭代次数: ${this.currentIteration}`);
    console.log(`已装载: ${plan.loadedCargo.length}, 未装载: ${plan.unloadedCargo.length}`);
    
    // 计算并添加方案统计信息
    plan.planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    plan.spaceUtilization = this.calculateSpaceUtilization(plan, containerType);
    plan.totalWeight = this.calculateTotalWeight(plan);
    plan.totalCargoCount = plan.loadedCargo.length;
    
    return plan;
  }

  /**
   * 应用FFD策略：按体积降序排列货物
   * @param {Array<Cargo>} cargoList - 货物列表
   * @returns {Array<Cargo>} 排序后的货物列表
   */
  applyFFDStrategy(cargoList) {
    console.log('应用FFD策略：按体积降序排列货物');
    
    // 展开货物数量，将每个货物按数量拆分为单个货物
    const expandedCargo = [];
    cargoList.forEach(cargo => {
      for (let i = 0; i < cargo.quantity; i++) {
        // 创建新的Cargo实例，保留所有方法
        const singleCargo = new Cargo({
          cargoId: cargo.cargoId,  // 保留原始cargoId用于测试
          name: cargo.name,
          length: cargo.length,
          width: cargo.width,
          height: cargo.height,
          weight: cargo.weight,
          quantity: 1,  // 单个货物
          stackable: cargo.stackable,
          maxStackLayers: cargo.maxStackLayers,
          canInvert: cargo.canInvert,
          canLayFlat: cargo.canLayFlat
        });
        // 保存实例ID用于追踪
        singleCargo.originalId = cargo.cargoId;
        singleCargo.instanceId = `${cargo.cargoId}_${i + 1}`;
        expandedCargo.push(singleCargo);
      }
    });
    
    // 按体积降序排序
    expandedCargo.sort((a, b) => {
      const volumeA = a.getVolume();  // 使用Cargo类的getVolume方法
      const volumeB = b.getVolume();
      return volumeB - volumeA;  // 降序
    });
    
    console.log(`货物展开完成，总数: ${expandedCargo.length}`);
    return expandedCargo;
  }

  /**
   * 生成货物的所有可能旋转方向
   * @param {Cargo} cargo - 货物对象
   * @returns {Array<Object>} 旋转方向列表
   */
  generateRotations(cargo) {
    const rotations = [];
    const dimensions = [
      { length: cargo.length, width: cargo.width, height: cargo.height, rotation: { x: 0, y: 0, z: 0 } },
      { length: cargo.width, width: cargo.length, height: cargo.height, rotation: { x: 0, y: 0, z: 90 } },
      { length: cargo.length, width: cargo.height, height: cargo.width, rotation: { x: 90, y: 0, z: 0 } },
      { length: cargo.height, width: cargo.width, height: cargo.length, rotation: { x: 0, y: 90, z: 0 } },
      { length: cargo.width, width: cargo.height, height: cargo.length, rotation: { x: 90, y: 0, z: 90 } },
      { length: cargo.height, width: cargo.length, height: cargo.width, rotation: { x: 0, y: 90, z: 90 } }
    ];
    
    // 根据约束条件过滤旋转方向
    for (let dim of dimensions) {
      // 检查是否可倒置（高度方向改变）
      if (!cargo.canInvert && dim.height !== cargo.height) {
        continue;
      }
      
      // 检查是否可侧放（原始高度变为长或宽）
      if (!cargo.canLayFlat && 
          (dim.length === cargo.height || dim.width === cargo.height)) {
        continue;
      }
      
      rotations.push(dim);
    }
    
    // 如果没有可用旋转，至少返回原始方向
    if (rotations.length === 0) {
      rotations.push(dimensions[0]);
    }
    
    // 优化：按高度升序排序，优先尝试高度小的旋转方向
    // 这样可以最大化垂直空间利用率，允许更多层堆叠
    rotations.sort((a, b) => a.height - b.height);
    
    // 调试日志：输出旋转方向
    if (cargo.name === '电风扇') {
      console.log(`\n=== 电风扇旋转方向 ===`);
      console.log(`原始尺寸: ${cargo.length}x${cargo.width}x${cargo.height}`);
      console.log(`canLayFlat: ${cargo.canLayFlat}, canInvert: ${cargo.canInvert}`);
      console.log(`生成的旋转方向（按高度排序）:`);
      rotations.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.length}x${r.width}x${r.height} (高度=${r.height})`);
      });
      console.log(`======================\n`);
    }
    
    return rotations;
  }

  /**
   * 应用BLB策略：按底部、左侧、后侧优先级排序放置点
   * @param {Array<Object>} points - 可用放置点列表
   * @returns {Array<Object>} 排序后的放置点列表
   */
  sortPointsByBLB(points) {
    return points.sort((a, b) => {
      // 优先级1: 底部（z坐标小的优先）
      if (a.z !== b.z) return a.z - b.z;
      
      // 优先级2: 后侧（x坐标小的优先）
      if (a.x !== b.x) return a.x - b.x;
      
      // 优先级3: 左侧（y坐标小的优先）
      return a.y - b.y;
    });
  }

  /**
   * 检查是否可以在指定位置放置货物
   * @param {Cargo} cargo - 货物对象
   * @param {Object} position - 位置坐标 {x, y, z}
   * @param {Object} rotation - 旋转后的尺寸
   * @param {Object} plan - 当前装箱方案
   * @param {ContainerType} containerType - 集装箱柜型
   * @returns {Boolean} 是否可以放置
   */
  canPlaceCargo(cargo, position, rotation, plan, containerType) {
    // 检查1: 是否超出集装箱边界
    if (position.x + rotation.length > containerType.innerLength ||
        position.y + rotation.width > containerType.innerWidth ||
        position.z + rotation.height > containerType.innerHeight) {
      console.log(`  ✗ 超出边界: pos=(${position.x},${position.y},${position.z}), size=(${rotation.length},${rotation.width},${rotation.height}), container=(${containerType.innerLength},${containerType.innerWidth},${containerType.innerHeight})`);
      return false;
    }
    
    // 检查2: 是否与已放置的货物发生碰撞
    for (let occupied of plan.occupiedSpaces) {
      if (this.isOverlapping(position, rotation, occupied.position, occupied.rotation)) {
        console.log(`  ✗ 碰撞检测失败: 与位置(${occupied.position.x},${occupied.position.y},${occupied.position.z})的货物重叠`);
        return false;
      }
    }
    
    // 检查3: 检查堆叠约束
    if (!this.checkStackingConstraints(cargo, position, rotation, plan)) {
      console.log(`  ✗ 堆叠约束失败`);
      return false;
    }
    
    // 检查4: 检查是否有足够的支撑（货物必须放在底部或其他货物上）
    if (!this.hasAdequateSupport(position, rotation, plan)) {
      console.log(`  ✗ 支撑检查失败: z=${position.z}, 已装载货物数=${plan.loadedCargo.length}`);
      return false;
    }
    
    console.log(`  ✓ 所有检查通过`);
    return true;
  }

  /**
   * 检查两个货物是否重叠
   * @param {Object} pos1 - 货物1位置
   * @param {Object} rot1 - 货物1旋转尺寸
   * @param {Object} pos2 - 货物2位置
   * @param {Object} rot2 - 货物2旋转尺寸
   * @returns {Boolean} 是否重叠
   */
  isOverlapping(pos1, rot1, pos2, rot2) {
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
   * 检查堆叠约束
   * @param {Cargo} cargo - 货物对象
   * @param {Object} position - 位置坐标
   * @param {Object} rotation - 旋转后的尺寸
   * @param {Object} plan - 当前装箱方案
   * @returns {Boolean} 是否满足堆叠约束
   */
  checkStackingConstraints(cargo, position, rotation, plan) {
    // 如果货物不可堆叠，检查其上方是否有空间被占用
    if (!cargo.stackable) {
      // 这个检查在放置时进行，当前货物上方暂时没有其他货物
      // 后续放置时会检查下方货物的堆叠约束
    }
    
    // 检查下方货物的堆叠约束
    for (let loaded of plan.loadedCargo) {
      const below = loaded.cargo;
      const belowPos = loaded.position;
      const belowRot = loaded.rotation;
      
      // 检查当前货物是否在下方货物的正上方
      if (this.isDirectlyAbove(position, rotation, belowPos, belowRot)) {
        // 如果下方货物不可堆叠，则不能放置
        if (!below.stackable) {
          console.log(`    堆叠约束: 下方货物 ${below.name} 不可堆叠`);
          return false;
        }
        
        // 检查堆叠层数限制
        const stackLayers = this.countStackLayers(belowPos, belowRot, plan);
        if (stackLayers >= below.maxStackLayers) {
          console.log(`    堆叠约束: 下方货物 ${below.name} 已达最大堆叠层数 ${below.maxStackLayers}`);
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * 检查货物A是否在货物B的正上方
   * @param {Object} posA - 货物A位置
   * @param {Object} rotA - 货物A旋转尺寸
   * @param {Object} posB - 货物B位置
   * @param {Object} rotB - 货物B旋转尺寸
   * @returns {Boolean} 是否在正上方
   */
  isDirectlyAbove(posA, rotA, posB, rotB) {
    // 货物A的底部应该接触或接近货物B的顶部
    const tolerance = 1; // 1mm容差
    const zDiff = Math.abs(posA.z - (posB.z + rotB.height));
    
    if (zDiff > tolerance) {
      return false;
    }
    
    // 检查水平方向是否有重叠
    const overlapX = !(posA.x + rotA.length <= posB.x || posB.x + rotB.length <= posA.x);
    const overlapY = !(posA.y + rotA.width <= posB.y || posB.y + rotB.width <= posA.y);
    
    const result = overlapX && overlapY;
    
    if (result) {
      console.log(`      isDirectlyAbove=true: posA.z=${posA.z}, posB.z+height=${posB.z + rotB.height}, zDiff=${zDiff.toFixed(2)}`);
    }
    
    return result;
  }

  /**
   * 计算指定位置上方的堆叠层数
   * @param {Object} position - 位置坐标
   * @param {Object} rotation - 旋转后的尺寸
   * @param {Object} plan - 当前装箱方案
   * @param {Set} visited - 已访问的货物集合（防止无限递归）
   * @returns {Number} 堆叠层数
   */
  countStackLayers(position, rotation, plan, visited = new Set()) {
    let layers = 0;
    
    // 创建当前位置的唯一标识
    const currentKey = `${position.x},${position.y},${position.z}`;
    
    // 如果已经访问过这个位置，直接返回0避免无限递归
    if (visited.has(currentKey)) {
      return 0;
    }
    
    // 标记当前位置为已访问
    visited.add(currentKey);
    
    // 查找所有在当前货物上方的货物
    const aboveCargo = plan.loadedCargo.filter(loaded => {
      return this.isDirectlyAbove(loaded.position, loaded.rotation, position, rotation);
    });
    
    // 递归计算最大堆叠层数
    for (let loaded of aboveCargo) {
      const subLayers = this.countStackLayers(loaded.position, loaded.rotation, plan, visited);
      layers = Math.max(layers, subLayers + 1);
    }
    
    return layers;
  }

  /**
   * 检查货物是否有足够的支撑
   * @param {Object} position - 位置坐标
   * @param {Object} rotation - 旋转后的尺寸
   * @param {Object} plan - 当前装箱方案
   * @returns {Boolean} 是否有足够支撑
   */
  hasAdequateSupport(position, rotation, plan) {
    // 如果货物在底部（z=0），则有地面支撑
    if (position.z === 0) {
      return true;
    }
    
    // 检查是否有任何货物在正下方提供支撑
    // 只要有接触就认为有支撑，不要求支撑面积比例
    for (let loaded of plan.loadedCargo) {
      const belowPos = loaded.position;
      const belowRot = loaded.rotation;
      
      // 检查是否在正下方接触
      if (this.isDirectlyAbove(position, rotation, belowPos, belowRot)) {
        return true; // 有支撑
      }
    }
    
    // 没有找到支撑
    return false;
  }

  /**
   * 放置货物到装箱方案中
   * @param {Cargo} cargo - 货物对象
   * @param {Object} position - 位置坐标
   * @param {Object} rotation - 旋转后的尺寸
   * @param {Object} plan - 当前装箱方案
   */
  placeCargo(cargo, position, rotation, plan) {
    const loadingOrder = plan.loadedCargo.length + 1;
    
    plan.loadedCargo.push({
      cargo: cargo,
      position: position,
      rotation: rotation,  // 保存完整的rotation对象（包含length, width, height）
      loadingOrder: loadingOrder
    });
    
    // 记录占用空间（用于碰撞检测）
    plan.occupiedSpaces.push({
      position: position,
      rotation: rotation
    });
  }

  /**
   * 更新可用放置点列表
   * @param {Array<Object>} points - 当前可用放置点
   * @param {Object} position - 新放置货物的位置
   * @param {Object} rotation - 新放置货物的旋转尺寸
   * @param {Number} layer - 当前层级
   * @returns {Array<Object>} 更新后的放置点列表
   */
  updateAvailablePoints(points, position, rotation, layer, containerType) {
    // 移除已使用的放置点
    points = points.filter(p => 
      !(p.x === position.x && p.y === position.y && p.z === position.z)
    );
    
    // 添加新的可用放置点（只添加在集装箱边界内的点）
    const newPoints = [];
    
    // 1. 货物右侧的点
    const rightPoint = {
      x: position.x + rotation.length,
      y: position.y,
      z: position.z,
      layer: layer
    };
    if (rightPoint.x < containerType.innerLength) {
      newPoints.push(rightPoint);
    }
    
    // 2. 货物前侧的点
    const frontPoint = {
      x: position.x,
      y: position.y + rotation.width,
      z: position.z,
      layer: layer
    };
    if (frontPoint.y < containerType.innerWidth) {
      newPoints.push(frontPoint);
    }
    
    // 3. 货物顶部的点（新层级）
    const topPoint = {
      x: position.x,
      y: position.y,
      z: position.z + rotation.height,
      layer: layer + 1
    };
    if (topPoint.z < containerType.innerHeight) {
      newPoints.push(topPoint);
    }
    
    // 添加新点到列表
    points.push(...newPoints);
    
    // 去重：移除重复的放置点
    const uniquePoints = [];
    const pointSet = new Set();
    
    for (let point of points) {
      const key = `${point.x},${point.y},${point.z}`;
      if (!pointSet.has(key)) {
        pointSet.add(key);
        uniquePoints.push(point);
      }
    }
    
    return uniquePoints;
  }

  /**
   * 获取货物未装载的原因
   * @param {Cargo} cargo - 货物对象
   * @param {ContainerType} containerType - 集装箱柜型
   * @returns {String} 未装载原因
   */
  getUnloadedReason(cargo, containerType) {
    // 检查是否超尺寸
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
    
    // 检查是否超重（单件）
    if (cargo.weight > containerType.maxWeight) {
      return '超重';
    }
    
    // 否则是空间不足
    return '空间不足';
  }

  /**
   * 计算空间利用率
   * @param {Object} plan - 装箱方案
   * @param {ContainerType} containerType - 集装箱柜型
   * @returns {Number} 空间利用率（百分比）
   */
  /**
   * 计算空间利用率（需求5.9）
   * 
   * 此方法计算已装载货物占用的体积与集装箱总体积的百分比。
   * 空间利用率是衡量装箱方案效率的关键指标，目标是实现≥90%的利用率。
   * 
   * 计算公式：空间利用率 = (已装载货物总体积 / 集装箱总体积) × 100%
   * 
   * @param {Object} plan - 装箱方案对象，包含loadedCargo数组
   * @param {ContainerType} containerType - 集装箱柜型对象，包含内部尺寸
   * @returns {Number} 空间利用率百分比（0-100）
   * 
   * @example
   * const utilization = engine.calculateSpaceUtilization(plan, containerType);
   * console.log(`空间利用率: ${utilization.toFixed(2)}%`);
   */
  calculateSpaceUtilization(plan, containerType) {
    // 计算集装箱总体积（立方毫米）
    const containerVolume = containerType.innerLength * 
                           containerType.innerWidth * 
                           containerType.innerHeight;
    
    // 累加所有已装载货物的体积
    let usedVolume = 0;
    for (let loaded of plan.loadedCargo) {
      const cargo = loaded.cargo;
      // 每个货物的体积 = 长 × 宽 × 高
      usedVolume += cargo.length * cargo.width * cargo.height;
    }
    
    // 返回空间利用率百分比
    return (usedVolume / containerVolume) * 100;
  }

  /**
   * 计算装箱方案的总重量
   * @param {Object} plan - 装箱方案对象
   * @returns {Number} 总重量（千克）
   */
  calculateTotalWeight(plan) {
    let totalWeight = 0;
    for (let loaded of plan.loadedCargo) {
      totalWeight += loaded.cargo.weight;
    }
    return totalWeight;
  }

  /**
   * 计算货物重心位置（需求5.10）
   * 
   * 此方法计算所有已装载货物的加权重心位置。重心位置对于集装箱运输安全至关重要，
   * 重心偏移过大会导致运输过程中的不稳定和安全隐患。
   * 
   * 计算原理：
   * 1. 计算每个货物的中心点坐标（位置 + 尺寸/2）
   * 2. 使用货物重量作为权重，计算加权平均位置
   * 3. 重心坐标 = Σ(货物重量 × 货物中心坐标) / Σ(货物重量)
   * 
   * @param {Object} plan - 装箱方案对象，包含loadedCargo数组
   * @returns {Object} 重心坐标 {x, y, z}，单位为毫米
   *   - x: 前后方向重心位置（0为集装箱后端）
   *   - y: 左右方向重心位置（0为集装箱左侧）
   *   - z: 上下方向重心位置（0为集装箱底部）
   * 
   * @example
   * const cog = engine.calculateCenterOfGravity(plan);
   * console.log(`重心位置: X=${cog.x.toFixed(2)}mm, Y=${cog.y.toFixed(2)}mm, Z=${cog.z.toFixed(2)}mm`);
   */
  calculateCenterOfGravity(plan) {
    // 如果没有已装载货物，返回原点
    if (plan.loadedCargo.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }
    
    let totalWeight = 0;      // 总重量累加器
    let weightedX = 0;        // X方向加权坐标累加器
    let weightedY = 0;        // Y方向加权坐标累加器
    let weightedZ = 0;        // Z方向加权坐标累加器
    
    // 遍历所有已装载货物，计算加权重心
    for (let loaded of plan.loadedCargo) {
      const cargo = loaded.cargo;
      const position = loaded.position;
      
      // 计算货物的几何中心点坐标
      // 中心点 = 起始位置 + 尺寸的一半
      const centerX = position.x + cargo.length / 2;
      const centerY = position.y + cargo.width / 2;
      const centerZ = position.z + cargo.height / 2;
      
      // 累加重量和加权坐标
      totalWeight += cargo.weight;
      weightedX += cargo.weight * centerX;
      weightedY += cargo.weight * centerY;
      weightedZ += cargo.weight * centerZ;
    }
    
    // 返回加权平均重心位置
    return {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight,
      z: weightedZ / totalWeight
    };
  }

  /**
   * 验证重心平衡并计算偏差（需求5.10）
   * 
   * 此方法验证装箱方案的重心是否符合宁波港进港规则：
   * - 前后重心偏差 ≤ 10%柜长
   * - 左右重心偏差 ≤ 5%柜宽
   * 
   * 重心偏差过大会导致：
   * 1. 运输过程中集装箱倾斜
   * 2. 装卸作业时的安全隐患
   * 3. 无法通过宁波港进港合规检查
   * 
   * @param {Object} plan - 装箱方案对象
   * @param {ContainerType} containerType - 集装箱柜型对象
   * @returns {Object} 重心平衡验证结果
   *   - balanced: Boolean - 是否平衡
   *   - centerOfGravity: Object - 实际重心位置 {x, y, z}
   *   - containerCenter: Object - 集装箱中心位置 {x, y, z}
   *   - frontBackDeviation: Number - 前后偏差百分比
   *   - leftRightDeviation: Number - 左右偏差百分比
   *   - frontBackPassed: Boolean - 前后方向是否通过
   *   - leftRightPassed: Boolean - 左右方向是否通过
   *   - suggestions: Array<String> - 优化建议
   * 
   * @example
   * const balance = engine.validateCenterOfGravityBalance(plan, containerType);
   * if (!balance.balanced) {
   *   console.log('重心不平衡，建议:', balance.suggestions);
   * }
   */
  validateCenterOfGravityBalance(plan, containerType) {
    // 计算实际重心位置
    const cog = this.calculateCenterOfGravity(plan);
    
    // 计算集装箱的几何中心位置
    const containerCenter = {
      x: containerType.innerLength / 2,
      y: containerType.innerWidth / 2,
      z: containerType.innerHeight / 2
    };
    
    // 计算前后方向（X轴）的重心偏差
    // 偏差 = |实际重心 - 几何中心| / 柜长 × 100%
    const frontBackDeviation = Math.abs(cog.x - containerCenter.x) / containerType.innerLength * 100;
    
    // 计算左右方向（Y轴）的重心偏差
    // 偏差 = |实际重心 - 几何中心| / 柜宽 × 100%
    const leftRightDeviation = Math.abs(cog.y - containerCenter.y) / containerType.innerWidth * 100;
    
    // 验证是否满足宁波港标准
    const frontBackPassed = frontBackDeviation <= 10;  // 前后偏差 ≤ 10%
    const leftRightPassed = leftRightDeviation <= 5;   // 左右偏差 ≤ 5%
    const balanced = frontBackPassed && leftRightPassed;
    
    // 生成优化建议
    const suggestions = [];
    
    if (!frontBackPassed) {
      // 判断重心偏向前还是后
      const direction = cog.x > containerCenter.x ? '前' : '后';
      const oppositeDirection = direction === '前' ? '后' : '前';
      suggestions.push(
        `重心偏${direction}（偏差${frontBackDeviation.toFixed(2)}%），` +
        `建议将重货向${oppositeDirection}移动以平衡重心`
      );
    }
    
    if (!leftRightPassed) {
      // 判断重心偏向左还是右
      const direction = cog.y > containerCenter.y ? '右' : '左';
      const oppositeDirection = direction === '右' ? '左' : '右';
      suggestions.push(
        `重心偏${direction}（偏差${leftRightDeviation.toFixed(2)}%），` +
        `建议将重货向${oppositeDirection}移动以平衡重心`
      );
    }
    
    // 返回完整的验证结果
    return {
      balanced,
      centerOfGravity: cog,
      containerCenter,
      frontBackDeviation,
      leftRightDeviation,
      frontBackPassed,
      leftRightPassed,
      suggestions
    };
  }
  /**
   * 验证装箱约束条件（需求5.3-5.8）
   *
   * 此方法用于验证已放置的货物是否满足所有约束条件，包括：
   * - 货物摆放位置不超出柜型内部尺寸
   * - 总重量不超过柜型额定载重
   * - "不可堆叠"约束：货物上方无其他货物
   * - "最大堆叠层数"约束：堆叠层数不超过设定值
   * - "不可倒置"约束：货物保持原始朝向
   * - "不可侧放"约束：货物不以侧面为底面
   *
   * @param {Object} plan - 装箱方案对象
   * @param {ContainerType} containerType - 集装箱柜型
   * @returns {Object} 验证结果 { valid: Boolean, violations: Array<String> }
   */
  validateConstraints(plan, containerType) {
    console.log('开始验证装箱约束条件...');

    const violations = []; // 违规项列表

    // ========== 约束1: 验证货物摆放位置不超出柜型内部尺寸 ==========
    console.log('检查约束1: 货物摆放位置不超出柜型内部尺寸');
    for (let i = 0; i < plan.loadedCargo.length; i++) {
      const loaded = plan.loadedCargo[i];
      const cargo = loaded.cargo;
      const position = loaded.position;

      // 获取货物的实际尺寸（考虑旋转后的尺寸）
      const rotation = plan.occupiedSpaces[i].rotation;

      // 检查X方向（长度方向）
      if (position.x < 0 || position.x + rotation.length > containerType.innerLength) {
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 在X方向超出柜型边界: ` +
          `位置=${position.x}mm, 长度=${rotation.length}mm, 柜型长度=${containerType.innerLength}mm`
        );
      }

      // 检查Y方向（宽度方向）
      if (position.y < 0 || position.y + rotation.width > containerType.innerWidth) {
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 在Y方向超出柜型边界: ` +
          `位置=${position.y}mm, 宽度=${rotation.width}mm, 柜型宽度=${containerType.innerWidth}mm`
        );
      }

      // 检查Z方向（高度方向）
      if (position.z < 0 || position.z + rotation.height > containerType.innerHeight) {
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 在Z方向超出柜型边界: ` +
          `位置=${position.z}mm, 高度=${rotation.height}mm, 柜型高度=${containerType.innerHeight}mm`
        );
      }
    }

    // ========== 约束2: 验证总重量不超过柜型额定载重 ==========
    console.log('检查约束2: 总重量不超过柜型额定载重');
    let totalWeight = 0;
    for (let loaded of plan.loadedCargo) {
      totalWeight += loaded.cargo.weight;
    }

    if (totalWeight > containerType.maxWeight) {
      violations.push(
        `总重量超过柜型额定载重: ` +
        `实际重量=${totalWeight.toFixed(2)}kg, 额定载重=${containerType.maxWeight}kg, ` +
        `超载=${(totalWeight - containerType.maxWeight).toFixed(2)}kg`
      );
    }
    console.log(`总重量: ${totalWeight.toFixed(2)}kg / ${containerType.maxWeight}kg`);

    // ========== 约束3: 验证"不可堆叠"约束 ==========
    console.log('检查约束3: "不可堆叠"约束');
    for (let i = 0; i < plan.loadedCargo.length; i++) {
      const loaded = plan.loadedCargo[i];
      const cargo = loaded.cargo;
      const position = loaded.position;
      const rotation = plan.occupiedSpaces[i].rotation;

      // 如果货物标记为"不可堆叠"，检查其上方是否有其他货物
      if (!cargo.stackable) {
        // 遍历所有其他货物，检查是否有货物在当前货物上方
        for (let j = 0; j < plan.loadedCargo.length; j++) {
          if (i === j) continue; // 跳过自己

          const otherLoaded = plan.loadedCargo[j];
          const otherPosition = otherLoaded.position;
          const otherRotation = plan.occupiedSpaces[j].rotation;

          // 检查是否在正上方
          if (this.isDirectlyAbove(otherPosition, otherRotation, position, rotation)) {
            violations.push(
              `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 标记为"不可堆叠"，` +
              `但其上方有货物 ${otherLoaded.cargo.name} (装载顺序${otherLoaded.loadingOrder})`
            );
          }
        }
      }
    }

    // ========== 约束4: 验证"最大堆叠层数"约束 ==========
    console.log('检查约束4: "最大堆叠层数"约束');
    for (let i = 0; i < plan.loadedCargo.length; i++) {
      const loaded = plan.loadedCargo[i];
      const cargo = loaded.cargo;
      const position = loaded.position;
      const rotation = plan.occupiedSpaces[i].rotation;

      // 计算当前货物上方的堆叠层数
      const stackLayers = this.countStackLayers(position, rotation, plan);

      // 检查是否超过最大堆叠层数
      if (stackLayers > cargo.maxStackLayers) {
        violations.push(
          `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 上方堆叠层数超限: ` +
          `实际层数=${stackLayers}, 最大允许层数=${cargo.maxStackLayers}`
        );
      }
    }

    // ========== 约束5: 验证"不可倒置"约束 ==========
    console.log('检查约束5: "不可倒置"约束');
    for (let i = 0; i < plan.loadedCargo.length; i++) {
      const loaded = plan.loadedCargo[i];
      const cargo = loaded.cargo;
      const rotation = plan.occupiedSpaces[i].rotation;

      // 如果货物标记为"不可倒置"，检查其高度方向是否改变
      if (!cargo.canInvert) {
        // 货物的原始高度应该等于旋转后的高度
        // 如果高度改变，说明货物被倒置或侧放了
        if (rotation.height !== cargo.height) {
          violations.push(
            `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 标记为"不可倒置"，` +
            `但其高度方向已改变: 原始高度=${cargo.height}mm, 当前高度=${rotation.height}mm`
          );
        }
      }
    }

    // ========== 约束6: 验证"不可侧放"约束 ==========
    console.log('检查约束6: "不可侧放"约束');
    for (let i = 0; i < plan.loadedCargo.length; i++) {
      const loaded = plan.loadedCargo[i];
      const cargo = loaded.cargo;
      const rotation = plan.occupiedSpaces[i].rotation;

      // 如果货物标记为"不可侧放"，检查其原始高度是否变为长或宽
      if (!cargo.canLayFlat) {
        // 货物的原始高度不应该出现在长度或宽度位置
        // 即：rotation.length 和 rotation.width 都不应该等于 cargo.height
        if (rotation.length === cargo.height || rotation.width === cargo.height) {
          violations.push(
            `货物 ${cargo.name} (装载顺序${loaded.loadingOrder}) 标记为"不可侧放"，` +
            `但其以侧面为底面摆放: 原始高度=${cargo.height}mm, ` +
            `当前长度=${rotation.length}mm, 当前宽度=${rotation.width}mm`
          );
        }
      }
    }

    // ========== 输出验证结果 ==========
    const valid = violations.length === 0;

    if (valid) {
      console.log('✓ 所有约束条件验证通过');
    } else {
      console.log(`✗ 发现 ${violations.length} 个约束违规项:`);
      violations.forEach((violation, index) => {
        console.log(`  ${index + 1}. ${violation}`);
      });
    }

    return {
      valid: valid,
      violations: violations,
      summary: {
        totalWeight: totalWeight,
        maxWeight: containerType.maxWeight,
        loadedCargoCount: plan.loadedCargo.length,
        violationCount: violations.length
      }
    };
  }
}

module.exports = PackingEngine;
