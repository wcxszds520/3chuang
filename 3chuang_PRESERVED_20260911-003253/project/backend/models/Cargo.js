/**
 * Cargo 货物数据模型类
 * 
 * 用途：
 * - 封装货物的基本属性（名称、尺寸、重量、数量、摆放限制等）
 * - 提供货物体积和重量的计算方法
 * - 提供货物数据有效性验证方法
 * 
 * 设计说明：
 * - 尺寸单位：毫米（mm）
 * - 重量单位：千克（kg）
 * - 支持堆叠限制、倒置限制、侧放限制等约束条件
 */

class Cargo {
  /**
   * 构造函数 - 创建货物对象
   * 
   * @param {Object} params - 货物参数对象
   * @param {string} params.cargoId - 货物唯一标识ID
   * @param {string} params.name - 货物名称
   * @param {number} params.length - 长度（毫米）
   * @param {number} params.width - 宽度（毫米）
   * @param {number} params.height - 高度（毫米）
   * @param {number} params.weight - 单件重量（千克）
   * @param {number} params.quantity - 数量
   * @param {boolean} [params.stackable=true] - 是否可堆叠
   * @param {number} [params.maxStackLayers=999] - 最大堆叠层数
   * @param {boolean} [params.canRotate=true] - 是否允许绕竖直轴旋转
   * @param {boolean} [params.canInvert=false] - 是否可倒置
   * @param {boolean} [params.canLayFlat=false] - 是否可侧放
   * @param {boolean} [params.fragile=false] - 是否易碎品（新增）
   * @param {Date} [params.eta] - 预计到港时间（必填）
   * @param {number} [params.portSequence] - 目的港挂靠顺序（1-5，必填）
   * @param {Date} [params.cyClosing] - 截关时间（可选）
   * @param {string} [params.customsDeclaration] - 报关单号（可选）
   */
  constructor({
    cargoId,
    name,
    length,
    width,
    height,
    weight,
    quantity,
    stackable = true,
    maxStackLayers = 999,
    canRotate = true,
    canInvert = false,
    canLayFlat = false,
    fragile = false,
    dangerous = false,
    eta,
    portSequence,
    cyClosing,
    customsDeclaration,
    destinationPort,           // v37.1: 目的港（用于批次标签显示）
    // NEW: Realistic 4D Packing Engine fields
    packagingType = 'wooden',  // 'carton' | 'wooden' | 'pallet' (default: wooden for backward compatibility)
    sku,                       // SKU identifier (default: cargoId if not provided)
    batchId,                   // Batch identifier (default: 'batch_' + portSequence if not provided)
    batchLabel,
    handlingMethod,
    handlingPolicy = 'derived',
    heavy,
    wooden,
    riskNotes = [],
    source,
    cargoPhysicalProfile = null,
    packagingProfile = null,
    handlingMode = null,
    orientationPolicy = null,
    maxSupportedWeight = null,
    maximumSupportedWeightKg = null,
    forkEntry = null,
    woodPackagingClass = null,
    dangerousGoodsContext = null,
    visualProfile = null,
    renderColor                // Hex color for 3D rendering (assigned during input parsing)
  }) {
    this.cargoId = cargoId;
    this.name = name;
    this.length = length;  // 毫米
    this.width = width;    // 毫米
    this.height = height;  // 毫米
    this.weight = weight;  // 千克
    this.quantity = quantity;
    this.stackable = stackable;
    this.maxStackLayers = maxStackLayers;
    this.canRotate = canRotate;
    this.canInvert = canInvert;
    this.canLayFlat = canLayFlat;
    this.fragile = fragile;  // 易碎品标记（新增）
    this.dangerous = dangerous;
    
    // 宁波港出货时间驱动字段
    this.eta = eta;                              // 预计到港时间（必填）
    this.portSequence = portSequence;            // 目的港挂靠顺序（1-5，必填）
    this.cyClosing = cyClosing;                  // 截关时间（可选）
    this.customsDeclaration = customsDeclaration; // 报关单号（可选）
    this.destinationPort = destinationPort;      // v37.1: 目的港
    
    // NEW: Realistic 4D Packing Engine fields
    this.packagingType = packagingType;          // 包装类型（默认wooden以保持向后兼容）
    this.sku = sku || cargoId;                   // SKU标识（默认使用cargoId）
    this.batchId = batchId || `batch_${portSequence}`; // 批次标识（默认使用portSequence）
    this.batchLabel = batchLabel || this.batchId;
    this.handlingMethod = handlingMethod || (weight >= 20 ? 'forklift' : 'manual');
    this.handlingPolicy = handlingPolicy;
    this.heavy = heavy === true || weight >= 20;
    this.wooden = wooden === true || /wood|pallet|木/i.test(packagingType);
    this.riskNotes = Array.isArray(riskNotes) ? riskNotes.map(String) : [];
    this.source = source || null;
    this.cargoPhysicalProfile = cargoPhysicalProfile;
    this.packagingProfile = packagingProfile;
    this.handlingMode = handlingMode || (this.handlingMethod || '').toUpperCase();
    this.orientationPolicy = orientationPolicy;
    this.maxSupportedWeight = Number(maximumSupportedWeightKg || maxSupportedWeight) > 0
      ? Number(maximumSupportedWeightKg || maxSupportedWeight) : null;
    this.maximumSupportedWeightKg = this.maxSupportedWeight;
    this.forkEntry = forkEntry;
    this.woodPackagingClass = woodPackagingClass;
    this.dangerousGoodsContext = dangerousGoodsContext;
    this.visualProfile = visualProfile;
    this.renderColor = renderColor;              // 3D渲染颜色（由输入解析器分配）
  }

  /**
   * 计算单件货物体积
   * 
   * 用途：计算单个货物的体积，用于空间利用率计算
   * 
   * @returns {number} 单件货物体积（立方毫米）
   * 
   * 示例：
   * 货物尺寸 300×300×350mm
   * 体积 = 300 × 300 × 350 = 31,500,000 立方毫米
   */
  getVolume() {
    return this.length * this.width * this.height;
  }

  /**
   * 计算所有货物的总体积
   * 
   * 用途：计算该货物的总体积（单件体积 × 数量），用于装箱方案计算
   * 
   * @returns {number} 总体积（立方毫米）
   * 
   * 示例：
   * 单件体积 31,500,000 立方毫米，数量 200 个
   * 总体积 = 31,500,000 × 200 = 6,300,000,000 立方毫米
   */
  getTotalVolume() {
    return this.getVolume() * this.quantity;
  }

  /**
   * 计算所有货物的总重量
   * 
   * 用途：计算该货物的总重量（单件重量 × 数量），用于载重校验
   * 
   * @returns {number} 总重量（千克）
   * 
   * 示例：
   * 单件重量 5kg，数量 200 个
   * 总重量 = 5 × 200 = 1000kg
   */
  getTotalWeight() {
    return this.weight * this.quantity;
  }

  /**
   * 判断是否为重货
   * 
   * 用途：判断货物是否为重货（单重≥20kg），用于堆叠规则和视觉标识
   * 
   * @returns {boolean} 是否为重货
   * 
   * 示例：
   * 取暖器 25kg → true（重货）
   * 空气炸锅 5kg → false（非重货）
   */
  isHeavy() {
    return this.weight >= 20;
  }

  /**
   * NEW: 判断是否为重货（Realistic 4D标准：>15kg）
   * 
   * 用途：用于包装强度验证和分区配平
   * 
   * @returns {boolean} 是否为重货（>15kg）
   */
  isHeavyCargo() {
    return this.weight > 15;
  }

  /**
   * NEW: 判断是否可以承载重货
   * 
   * 用途：用于包装强度验证
   * 
   * @returns {boolean} 是否可以承载重货
   */
  canSupportHeavyCargo() {
    return this.packagingType === 'wooden' || this.packagingType === 'pallet';
  }

  /**
   * NEW: 获取最大堆叠层数
   * 
   * 用途：用于包装强度验证
   * 
   * @returns {number} 最大堆叠层数（纸箱返回maxStackLayers，木箱/托盘返回Infinity）
   */
  getMaxStackLayers() {
    if (this.packagingType === 'carton') {
      return this.maxStackLayers || 3;
    }
    return Infinity; // 木箱和托盘无限制
  }

  /**
   * 判断是否为易碎品
   * 
   * 用途：判断货物是否为易碎品，用于堆叠规则和视觉标识
   * 
   * @returns {boolean} 是否为易碎品
   * 
   * 示例：
   * 空气炸锅（fragile=true）→ true（易碎品）
   * 取暖器（fragile=false）→ false（非易碎品）
   */
  isFragile() {
    return this.fragile === true;
  }

  /**
   * 获取货物类型
   * 
   * 用途：获取货物类型，用于堆叠规则排序和3D视觉标识
   * 
   * 类型优先级：
   * 1. 易碎品（fragile=true）→ 'fragile'（优先级最高）
   * 2. 重货（weight≥20kg）→ 'heavy'
   * 3. 普通货 → 'normal'
   * 
   * @returns {string} 货物类型（'fragile'/'heavy'/'normal'）
   * 
   * 示例：
   * 空气炸锅（5kg，fragile=true）→ 'fragile'
   * 取暖器（25kg，fragile=false）→ 'heavy'
   * 电风扇（15kg，fragile=false）→ 'normal'
   */
  getCargoType() {
    if (this.isFragile()) return 'fragile';  // 易碎品优先级最高
    if (this.isHeavy()) return 'heavy';
    return 'normal';
  }

  /**
   * 获取所有允许的旋转方向（基于约束条件）
   * 
   * 用途：根据货物的canInvert和canLayFlat约束，返回所有允许的3D尺寸组合
   * 
   * 坐标系统（统一全栈）：
   * - X轴 = Length (长度/深度，集装箱最长边)
   * - Y轴 = Height (高度，垂直于地面)
   * - Z轴 = Width (宽度)
   * 
   * @returns {Array<Object>} 允许的旋转数组，每个对象包含 {x, y, z, rotation}
   * 
   * 示例：
   * 货物 300×300×350mm，canInvert=false, canLayFlat=false
   * 返回：[{x:300, y:350, z:300, rotation:{x:0,y:0,z:0}}]
   */
  getRotations() {
    const L = Number(this.length);
    const W = Number(this.width);
    const H = Number(this.height);
    const rotation = (x, y, z, orientation, description) => ({
      x, y, z, l: x, w: z, h: y, orientation, inverted: false,
      rotation: { orientation },
      description
    });
    const rotations = [rotation(L, H, W, 'XYZ', '标准摆放')];
    if (this.canRotate) rotations.push(rotation(W, H, L, 'YXZ', '水平旋转'));
    if (this.canLayFlat) {
      rotations.push(rotation(L, W, H, 'XZY', '侧放 XZY'));
      if (this.canRotate) rotations.push(
        rotation(W, L, H, 'YZX', '侧放 YZX'),
        rotation(H, W, L, 'ZXY', '侧放 ZXY'),
        rotation(H, L, W, 'ZYX', '侧放 ZYX')
      );
    }
    return rotations.filter((rotation, index, all) => all.findIndex((candidate) => candidate.x === rotation.x && candidate.y === rotation.y && candidate.z === rotation.z) === index);
  }

  /**
   * 转换为JSON对象
   * 
   * 用途：将Cargo对象转换为JSON格式，用于API响应和数据传输
   * 
   * @returns {Object} JSON对象，包含所有货物属性和计算字段
   */
  toJSON() {
    return {
      cargoId: this.cargoId,
      name: this.name,
      length: this.length,
      width: this.width,
      height: this.height,
      weight: this.weight,
      quantity: this.quantity,
      stackable: this.stackable,
      maxStackLayers: this.maxStackLayers,
      canRotate: this.canRotate,
      canInvert: this.canInvert,
      canLayFlat: this.canLayFlat,
      fragile: this.fragile,  // 易碎品标记
      dangerous: this.dangerous,
      eta: this.eta,
      portSequence: this.portSequence,
      cyClosing: this.cyClosing,
      customsDeclaration: this.customsDeclaration,
      // NEW: Realistic 4D fields
      packagingType: this.packagingType,
      sku: this.sku,
      batchId: this.batchId,
      batchLabel: this.batchLabel,
      handlingMethod: this.handlingMethod,
      handlingPolicy: this.handlingPolicy,
      heavy: this.heavy,
      wooden: this.wooden,
      riskNotes: [...this.riskNotes],
      source: this.source,
      cargoPhysicalProfile: this.cargoPhysicalProfile,
      packagingProfile: this.packagingProfile,
      handlingMode: this.handlingMode,
      orientationPolicy: this.orientationPolicy,
      maxSupportedWeight: this.maxSupportedWeight,
      maximumSupportedWeightKg: this.maximumSupportedWeightKg,
      forkEntry: this.forkEntry,
      woodPackagingClass: this.woodPackagingClass,
      dangerousGoodsContext: this.dangerousGoodsContext,
      visualProfile: this.visualProfile,
      renderColor: this.renderColor,
      // 计算字段
      cargoType: this.getCargoType(),  // 货物类型（'fragile'/'heavy'/'normal'）
      isHeavy: this.isHeavy(),         // 是否为重货
      isFragile: this.isFragile()      // 是否为易碎品
    };
  }

  /**
   * 验证货物数据有效性
   * 
   * 用途：在保存货物数据前进行验证，确保数据符合业务规则
   * 
   * 验证规则：
   * 1. 正数检查：长度、宽度、高度、重量、数量必须为正数（需求 2.3）
   * 2. 尺寸限制：货物尺寸不能超出40HQ柜型内部尺寸（12032×2352×2698mm）（需求 2.4）
   * 3. 重量限制：单件货物重量不能超过26000kg（需求 2.5）
   * 
   * @throws {Error} 当数据不符合验证规则时抛出错误，包含中文错误信息
   * @returns {boolean} 验证通过返回 true
   * 
   * 错误信息示例：
   * - "请输入正数" - 当尺寸、重量或数量为负数或零时
   * - "货物尺寸超出最大柜型限制" - 当货物尺寸超出40HQ柜型时
   * - "单件货物重量超出柜型载重限制" - 当单件重量超过26000kg时
   */
  validate() {
    // 验证规则1：正数检查（需求 2.3）
    if (this.length <= 0 || this.width <= 0 || this.height <= 0) {
      throw new Error('请输入正数');
    }
    
    if (this.weight <= 0) {
      throw new Error('请输入正数');
    }
    
    if (this.quantity <= 0) {
      throw new Error('请输入正数');
    }

    // 验证规则2：尺寸限制检查（需求 2.4）
    // 40HQ柜型内部尺寸：12032×2352×2698mm
    const MAX_LENGTH = 12032;  // 最大长度（毫米）
    const MAX_WIDTH = 2352;    // 最大宽度（毫米）
    const MAX_HEIGHT = 2698;   // 最大高度（毫米）

    // 将货物的三个尺寸和柜型的三个尺寸分别排序，然后逐一比较
    // 这样可以处理货物旋转摆放的情况
    const cargoDimensions = [this.length, this.width, this.height].sort((a, b) => b - a);
    const containerDimensions = [MAX_LENGTH, MAX_WIDTH, MAX_HEIGHT].sort((a, b) => b - a);

    for (let i = 0; i < 3; i++) {
      if (cargoDimensions[i] > containerDimensions[i]) {
        throw new Error('货物尺寸超出最大柜型限制');
      }
    }

    // 验证规则3：重量限制检查（需求 2.5）
    // 40HQ柜型额定载重：26000kg
    const MAX_WEIGHT = 26000;  // 最大单件重量（千克）

    if (this.weight > MAX_WEIGHT) {
      throw new Error('单件货物重量超出柜型载重限制');
    }

    // 验证规则4：宁波港出货时间字段验证（新增）
    // ETA必填且必须是有效日期
    if (this.eta !== undefined && this.eta !== null) {
      if (!(this.eta instanceof Date) || isNaN(this.eta.getTime())) {
        throw new Error('ETA（预计到港时间）必须是有效日期');
      }
    }
    
    // Port_Sequence必填且在1-5范围内
    if (this.portSequence !== undefined && this.portSequence !== null) {
      if (!Number.isInteger(this.portSequence) || this.portSequence < 1 || this.portSequence > 5) {
        throw new Error('Port_Sequence（目的港挂靠顺序）必须在1-5范围内');
      }
    }
    
    // CY_Closing如果存在，必须是有效日期
    if (this.cyClosing !== undefined && this.cyClosing !== null) {
      if (!(this.cyClosing instanceof Date) || isNaN(this.cyClosing.getTime())) {
        throw new Error('CY_Closing（截关时间）必须是有效日期');
      }
    }

    // 验证规则5：Realistic 4D字段验证（新增）
    // packagingType必须是有效枚举值
    if (this.packagingType && ![
      'carton', 'wooden', 'pallet',
      'CARTON', 'WOOD_CRATE', 'PALLETIZED_CARTONS', 'WRAPPED_PALLET',
      'EQUIPMENT_CASE', 'DRUM', 'FIBC_BAG', 'GENERIC'
    ].includes(this.packagingType)) {
      throw new Error('packagingType 必须是 PORTCUBE 支持的包装类型');
    }
    
    // sku必须是非空字符串
    if (this.sku && typeof this.sku !== 'string') {
      throw new Error('sku必须是字符串');
    }
    
    // batchId必须是非空字符串
    if (this.batchId && typeof this.batchId !== 'string') {
      throw new Error('batchId必须是字符串');
    }

    // 所有验证通过
    return true;
  }
}

// 导出 Cargo 类，供其他模块使用
module.exports = Cargo;
