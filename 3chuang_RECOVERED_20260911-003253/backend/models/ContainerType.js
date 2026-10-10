/**
 * ContainerType 集装箱柜型数据模型类
 * 
 * 用途：
 * - 封装集装箱柜型的基本属性（柜型ID、名称、内部尺寸、额定载重、描述）
 * - 提供集装箱容积计算方法
 * - 提供货物尺寸适配性检查方法
 * 
 * 设计说明：
 * - 尺寸单位：毫米（mm）
 * - 重量单位：千克（kg）
 * - 支持宁波港标准柜型：20GP、40GP、40HQ
 */

class ContainerType {
  /**
   * 构造函数 - 创建集装箱柜型对象
   * 
   * @param {Object} params - 柜型参数对象
   * @param {string} params.typeId - 柜型ID（如：20GP、40GP、40HQ）
   * @param {string} params.name - 柜型名称（如：20英尺标准柜）
   * @param {number} params.innerLength - 内部长度（毫米）
   * @param {number} params.innerWidth - 内部宽度（毫米）
   * @param {number} params.innerHeight - 内部高度（毫米）
   * @param {number} params.maxWeight - 额定载重（千克）
   * @param {string} [params.description=''] - 适用场景描述
   */
  constructor({
    typeId,
    name,
    innerLength,
    innerWidth,
    innerHeight,
    maxWeight,
    description = ''
  }) {
    this.typeId = typeId;
    this.name = name;
    this.innerLength = innerLength;  // 毫米
    this.innerWidth = innerWidth;    // 毫米
    this.innerHeight = innerHeight;  // 毫米
    this.maxWeight = maxWeight;      // 千克
    this.description = description;
  }

  /**
   * 计算集装箱容积
   * 
   * 用途：计算集装箱的内部容积，用于空间利用率计算
   * 
   * @returns {number} 集装箱容积（立方毫米）
   * 
   * 示例：
   * 40HQ柜型尺寸 12032×2352×2698mm
   * 容积 = 12032 × 2352 × 2698 = 76,363,407,360 立方毫米
   */
  getVolume() {
    return this.innerLength * this.innerWidth * this.innerHeight;
  }

  /**
   * 检查货物是否超出柜型尺寸
   * 
   * 用途：验证货物尺寸是否可以装入该柜型，考虑货物可旋转摆放的情况
   * 
   * 算法说明：
   * 1. 将货物的三个尺寸（长、宽、高）从大到小排序
   * 2. 将柜型的三个尺寸（长、宽、高）从大到小排序
   * 3. 逐一比较对应位置的尺寸
   * 4. 如果货物的任一尺寸大于柜型对应位置的尺寸，则无法装入
   * 
   * 这种方法可以处理货物旋转摆放的情况，例如：
   * - 货物尺寸 300×400×500mm 可以装入柜型 600×500×400mm
   * - 因为排序后：货物 [500,400,300] vs 柜型 [600,500,400]
   * - 每个位置都满足：500≤600, 400≤500, 300≤400
   * 
   * @param {Object} cargo - 货物对象，需包含 length、width、height 属性
   * @returns {boolean} 如果货物可以装入该柜型返回 true，否则返回 false
   * 
   * 示例：
   * 货物尺寸 300×300×350mm，柜型 40HQ (12032×2352×2698mm)
   * 货物排序后 [350,300,300]，柜型排序后 [12032,2698,2352]
   * 350≤12032, 300≤2698, 300≤2352，返回 true
   */
  canFitCargo(cargo) {
    // 将货物的三个尺寸从大到小排序
    const cargoDimensions = [cargo.length, cargo.width, cargo.height].sort((a, b) => b - a);
    
    // 将柜型的三个尺寸从大到小排序
    const containerDimensions = [this.innerLength, this.innerWidth, this.innerHeight].sort((a, b) => b - a);
    
    // 逐一比较对应位置的尺寸
    for (let i = 0; i < 3; i++) {
      if (cargoDimensions[i] > containerDimensions[i]) {
        // 货物的某个尺寸超出柜型对应位置的尺寸，无法装入
        return false;
      }
    }
    
    // 所有尺寸都满足要求，可以装入
    return true;
  }
}

// 导出 ContainerType 类，供其他模块使用
module.exports = ContainerType;
