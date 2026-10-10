/**
 * PackingPlan 装箱方案数据模型类
 * 
 * 职责：
 * - 管理装箱方案的完整数据结构
 * - 输出每个货物的三维坐标、旋转角度、装载顺序
 * - 计算和输出空间利用率、总装载重量、货物总数量
 * - 管理未装载货物列表，标注无法装载的原因
 * 
 * 使用场景：
 * - 装箱算法引擎生成方案后创建PackingPlan实例
 * - 前端3D渲染引擎读取方案数据进行可视化
 * - 合规校验引擎基于方案数据进行校验
 * - PDF导出服务读取方案数据生成报告
 */

class PackingPlan {
  /**
   * 构造函数
   * @param {Object} options - 装箱方案配置对象
   * @param {string} options.planId - 方案唯一标识ID
   * @param {Object} options.containerType - 集装箱柜型对象（ContainerType实例）
   * @param {Array} options.loadedCargo - 已装载货物列表，默认为空数组
   * @param {Array} options.unloadedCargo - 未装载货物列表，默认为空数组
   * @param {number} options.spaceUtilization - 空间利用率（百分比），默认为0
   * @param {number} options.totalWeight - 总装载重量（千克），默认为0
   * @param {number} options.totalCargoCount - 货物总数量，默认为0
   * @param {Object} options.complianceReport - 合规校验报告对象，默认为null
   */
  constructor({
    planId,
    containerType,
    loadedCargo = [],
    unloadedCargo = [],
    spaceUtilization = 0,
    totalWeight = 0,
    totalCargoCount = 0,
    complianceReport = null
  }) {
    this.planId = planId;
    this.containerType = containerType;
    this.loadedCargo = loadedCargo;
    this.unloadedCargo = unloadedCargo;
    this.spaceUtilization = spaceUtilization;
    this.totalWeight = totalWeight;
    this.totalCargoCount = totalCargoCount;
    this.complianceReport = complianceReport;
  }

  /**
   * 添加已装载货物
   * @param {Object} cargo - 货物对象（Cargo实例）
   * @param {Object} position - 货物在集装箱中的三维坐标位置
   * @param {number} position.x - X轴坐标（毫米），从集装箱后端开始
   * @param {number} position.y - Y轴坐标（毫米），从集装箱左侧开始
   * @param {number} position.z - Z轴坐标（毫米），从集装箱底部开始
   * @param {Object} rotation - 货物的旋转角度
   * @param {number} rotation.x - 绕X轴旋转角度（度）
   * @param {number} rotation.y - 绕Y轴旋转角度（度）
   * @param {number} rotation.z - 绕Z轴旋转角度（度）
   * @param {number} loadingOrder - 装载顺序编号，从1开始
   */
  addLoadedCargo(cargo, position, rotation, loadingOrder) {
    this.loadedCargo.push({
      cargo,
      position,
      rotation,
      loadingOrder
    });
  }

  /**
   * 添加未装载货物
   * @param {Object} cargo - 货物对象（Cargo实例）
   * @param {string} reason - 无法装载的原因
   *   可选值：
   *   - 'oversized': 货物尺寸超出柜型限制
   *   - 'overweight': 货物重量超出柜型载重限制
   *   - 'insufficient_space': 柜内剩余空间不足
   * @param {string} details - 详细说明（可选）
   */
  addUnloadedCargo(cargo, reason, details = '') {
    // 将原因代码转换为中文描述
    const reasonMap = {
      'oversized': '超尺寸',
      'overweight': '超重',
      'insufficient_space': '空间不足'
    };

    this.unloadedCargo.push({
      cargo,
      reason: reasonMap[reason] || reason,
      reasonCode: reason,
      details
    });
  }

  /**
   * 计算空间利用率
   * @param {number} containerVolume - 集装箱总容积（立方毫米）
   * @returns {number} 空间利用率（百分比，保留2位小数）
   */
  calculateSpaceUtilization(containerVolume) {
    // 计算所有已装载货物的总体积
    const usedVolume = this.loadedCargo.reduce((sum, item) => {
      // 兼容三种情况：
      // 1. item.cargo 是 Cargo 实例（有 getVolume 方法）
      // 2. item.cargo 是普通对象（需要手动计算）
      // 3. item 本身就是货物对象（预设方案格式）
      let cargoVolume;
      
      // 情况3：预设方案格式，货物属性直接在 item 中
      if (item.length && item.width && item.height && !item.cargo) {
        // 使用 rotation 的尺寸（如果有），否则使用原始尺寸
        if (item.rotation && item.rotation.length) {
          cargoVolume = item.rotation.length * item.rotation.width * item.rotation.height;
        } else {
          cargoVolume = item.length * item.width * item.height;
        }
      }
      // 情况1和2：标准格式，货物在 item.cargo 中
      else if (item.cargo) {
        if (typeof item.cargo.getVolume === 'function') {
          cargoVolume = item.cargo.getVolume();
        } else {
          // 使用 rotation 的尺寸（已旋转后的实际尺寸）
          const rotation = item.rotation || item.cargo;
          cargoVolume = rotation.length * rotation.width * rotation.height;
        }
      } else {
        console.warn('无法计算货物体积，跳过该项:', item);
        return sum;
      }
      
      return sum + cargoVolume;
    }, 0);

    // 计算空间利用率百分比
    this.spaceUtilization = containerVolume > 0 
      ? parseFloat(((usedVolume / containerVolume) * 100).toFixed(2))
      : 0;

    return this.spaceUtilization;
  }

  /**
   * 计算总装载重量
   * @returns {number} 总重量（千克，保留2位小数）
   */
  calculateTotalWeight() {
    // 累加所有已装载货物的重量
    const totalWeight = this.loadedCargo.reduce((sum, item) => {
      // 兼容两种格式：
      // 1. 标准格式：item.cargo.weight
      // 2. 预设方案格式：item.weight
      let weight;
      if (item.cargo && item.cargo.weight !== undefined) {
        weight = parseFloat(item.cargo.weight) || 0;
      } else if (item.weight !== undefined) {
        weight = parseFloat(item.weight) || 0;
      } else {
        console.warn('无法获取货物重量，跳过该项:', item);
        weight = 0;
      }
      return sum + weight;
    }, 0);

    this.totalWeight = parseFloat(totalWeight.toFixed(2));
    return this.totalWeight;
  }

  /**
   * 计算货物总数量
   * @returns {number} 货物总数量
   */
  calculateTotalCargoCount() {
    // 统计已装载货物的数量
    this.totalCargoCount = this.loadedCargo.length;
    return this.totalCargoCount;
  }

  /**
   * 计算货物重心位置
   * @returns {Object} 重心三维坐标
   *   - x: X轴重心位置（毫米）
   *   - y: Y轴重心位置（毫米）
   *   - z: Z轴重心位置（毫米）
   */
  calculateCenterOfGravity() {
    // 如果没有已装载货物，返回原点
    if (this.loadedCargo.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    let weightedZ = 0;

    // 遍历所有已装载货物，计算加权重心
    this.loadedCargo.forEach(item => {
      // 兼容两种格式
      const cargo = item.cargo || item;
      const position = item.position || { x: 0, y: 0, z: 0 };
      
      const cargoWeight = cargo.weight;
      
      // 计算货物中心点坐标（货物位置 + 货物尺寸的一半）
      const centerX = position.x + cargo.length / 2;
      const centerY = position.y + cargo.width / 2;
      const centerZ = position.z + cargo.height / 2;

      // 累加重量和加权坐标
      totalWeight += cargoWeight;
      weightedX += cargoWeight * centerX;
      weightedY += cargoWeight * centerY;
      weightedZ += cargoWeight * centerZ;
    });

    // 计算最终重心位置（加权平均）
    return {
      x: parseFloat((weightedX / totalWeight).toFixed(2)),
      y: parseFloat((weightedY / totalWeight).toFixed(2)),
      z: parseFloat((weightedZ / totalWeight).toFixed(2))
    };
  }

  /**
   * 转换为JSON格式数据
   * 用于API响应、数据库存储、前端展示
   * @returns {Object} JSON格式的装箱方案数据
   */
  toJSON() {
    return {
      planId: this.planId,
      containerType: {
        typeId: this.containerType.typeId,
        name: this.containerType.name,
        innerLength: this.containerType.innerLength,
        innerWidth: this.containerType.innerWidth,
        innerHeight: this.containerType.innerHeight,
        maxWeight: this.containerType.maxWeight
      },
      spaceUtilization: this.spaceUtilization,
      totalWeight: this.totalWeight,
      totalCargoCount: this.totalCargoCount,
      loadedCargo: this.loadedCargo.map((item, index) => {
        // 兼容两种格式：标准格式（item.cargo）和预设方案格式（item直接包含属性）
        const cargo = item.cargo || item;
        const position = item.position || { x: 0, y: 0, z: 0 };
        const rotation = item.rotation || { length: cargo.length, width: cargo.width, height: cargo.height, rotation: { x: 0, y: 0, z: 0 } };
        
        // 【关键修复】优先从item获取ETA等字段（SimplePackingEngine直接放在item上）
        const eta = item.eta || cargo.eta;
        const portSequence = item.portSequence || cargo.portSequence;
        const cyClosing = item.cyClosing || cargo.cyClosing;
        const customsDeclaration = item.customsDeclaration || cargo.customsDeclaration;
        const dropOrder = item.dropOrder || cargo.dropOrder || 2;
        
        // 调试：检查cargo对象（只打印前3个）
        if (index < 3) {
          console.log(`[PackingPlan.toJSON] 货物${index + 1}:`, {
            name: cargo.name,
            eta: eta,
            portSequence: portSequence,
            fromItem: !!item.eta,
            fromCargo: !!cargo.eta
          });
        }
        
        return {
          cargoId: cargo.cargoId,
          name: cargo.name || item.name,
          length: cargo.length,
          width: cargo.width,
          height: cargo.height,
          weight: cargo.weight,
          quantity: cargo.quantity || 1,
          stackable: cargo.stackable,
          maxStackLayers: cargo.maxStackLayers,
          fragile: cargo.fragile || false,  // 新增：易碎品标记
          cargoType: cargo.getCargoType ? cargo.getCargoType() : 'normal',  // 新增：货物类型
          // 宁波港出货时间字段（优先从item获取）
          eta: eta,
          portSequence: portSequence,
          cyClosing: cyClosing,
          customsDeclaration: customsDeclaration,
          // 位置和旋转信息
          position: position,
          rotation: rotation,
          loadingOrder: item.loadingOrder,
          stackLevel: item.stackLevel,
          dropOrder: dropOrder
        };
      }),
      unloadedCargo: this.unloadedCargo.map(item => ({
        cargoId: item.cargo.cargoId,
        name: item.cargo.name,
        length: item.cargo.length,
        width: item.cargo.width,
        height: item.cargo.height,
        weight: item.cargo.weight,
        reason: item.reason,
        reasonCode: item.reasonCode,
        details: item.details
      })),
      complianceReport: this.complianceReport
    };
  }

  /**
   * 从JSON数据创建PackingPlan实例
   * @param {Object} jsonData - JSON格式的装箱方案数据
   * @param {Object} ContainerTypeClass - ContainerType类引用
   * @param {Object} CargoClass - Cargo类引用
   * @returns {PackingPlan} PackingPlan实例
   */
  static fromJSON(jsonData, ContainerTypeClass, CargoClass) {
    // 重建ContainerType对象
    const containerType = new ContainerTypeClass(jsonData.containerType);

    // 重建已装载货物列表
    const loadedCargo = jsonData.loadedCargo.map(item => ({
      cargo: new CargoClass({
        cargoId: item.cargoId,
        name: item.name,
        length: item.length,
        width: item.width,
        height: item.height,
        weight: item.weight,
        quantity: 1 // 装箱方案中每个货物都是单件
      }),
      position: item.position,
      rotation: item.rotation,
      loadingOrder: item.loadingOrder
    }));

    // 重建未装载货物列表
    const unloadedCargo = jsonData.unloadedCargo.map(item => ({
      cargo: new CargoClass({
        cargoId: item.cargoId,
        name: item.name,
        length: item.length,
        width: item.width,
        height: item.height,
        weight: item.weight,
        quantity: 1
      }),
      reason: item.reason,
      reasonCode: item.reasonCode,
      details: item.details
    }));

    // 创建PackingPlan实例
    return new PackingPlan({
      planId: jsonData.planId,
      containerType,
      loadedCargo,
      unloadedCargo,
      spaceUtilization: jsonData.spaceUtilization,
      totalWeight: jsonData.totalWeight,
      totalCargoCount: jsonData.totalCargoCount,
      complianceReport: jsonData.complianceReport
    });
  }

  /**
   * 获取装箱方案摘要信息
   * @returns {Object} 方案摘要
   */
  getSummary() {
    return {
      planId: this.planId,
      containerType: this.containerType.name,
      spaceUtilization: `${this.spaceUtilization}%`,
      totalWeight: `${this.totalWeight}kg`,
      totalCargoCount: this.totalCargoCount,
      loadedCount: this.loadedCargo.length,
      unloadedCount: this.unloadedCargo.length,
      complianceStatus: this.complianceReport?.status || '未校验'
    };
  }

  /**
   * 验证装箱方案数据的完整性
   * @returns {Object} 验证结果
   *   - valid: 是否有效
   *   - errors: 错误信息数组
   */
  validate() {
    const errors = [];

    if (!this.planId) {
      errors.push('缺少方案ID');
    }

    if (!this.containerType) {
      errors.push('缺少柜型信息');
    }

    if (!Array.isArray(this.loadedCargo)) {
      errors.push('已装载货物列表格式错误');
    }

    if (!Array.isArray(this.unloadedCargo)) {
      errors.push('未装载货物列表格式错误');
    }

    // 验证已装载货物的数据完整性
    this.loadedCargo.forEach((item, index) => {
      if (!item.cargo) {
        errors.push(`已装载货物[${index}]缺少货物对象`);
      }
      if (!item.position || typeof item.position.x !== 'number') {
        errors.push(`已装载货物[${index}]缺少有效的位置坐标`);
      }
      if (!item.rotation) {
        errors.push(`已装载货物[${index}]缺少旋转角度`);
      }
      if (typeof item.loadingOrder !== 'number') {
        errors.push(`已装载货物[${index}]缺少装载顺序`);
      }
    });

    // 验证未装载货物的数据完整性
    this.unloadedCargo.forEach((item, index) => {
      if (!item.cargo) {
        errors.push(`未装载货物[${index}]缺少货物对象`);
      }
      if (!item.reason) {
        errors.push(`未装载货物[${index}]缺少无法装载的原因`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = PackingPlan;
