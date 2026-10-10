/**
 * 宁波港出货时间驱动装柜引擎
 * 核心业务规则：装柜顺序 = 卸货顺序的反向 = 出货到港时间的反向
 */

class ShippingTimePackingEngine {
  // 三种工作模式
  static MODE_SMART_ETA = 'smart_eta';           // 智能ETA模式（默认）
  static MODE_CY_CLOSING = 'cy_closing';         // 截关时间优先模式
  static MODE_CUSTOM = 'custom';                 // 自定义模式

  /**
   * 计算卸货顺序
   * 规则：按目的港挂靠顺序升序，同港口按ETA升序
   * @param {Array} cargoList - 货物列表
   * @returns {Array} 带unloadingOrder的货物列表
   */
  calculateUnloadingOrder(cargoList) {
    console.log('[ShippingTime] 开始计算卸货顺序...');
    
    // 过滤出有ETA和portSequence的货物
    const validCargo = cargoList.filter(cargo => cargo.eta && cargo.portSequence);
    
    if (validCargo.length === 0) {
      console.warn('[ShippingTime] 没有货物包含ETA和portSequence，使用原始顺序');
      return cargoList.map((cargo, index) => ({
        ...cargo,
        unloadingOrder: index + 1
      }));
    }
    
    // 排序：先按portSequence升序，再按eta升序
    const sorted = [...validCargo].sort((a, b) => {
      // 先比较portSequence
      if (a.portSequence !== b.portSequence) {
        return a.portSequence - b.portSequence;
      }
      // portSequence相同，比较eta
      const etaA = new Date(a.eta).getTime();
      const etaB = new Date(a.eta).getTime();
      return etaA - etaB;
    });
    
    // 分配unloadingOrder（1, 2, 3, ...）
    const result = sorted.map((cargo, index) => ({
      ...cargo,
      unloadingOrder: index + 1
    }));
    
    console.log(`[ShippingTime] 卸货顺序计算完成，共${result.length}个货物`);
    console.log('[ShippingTime] 前3个卸货顺序:', result.slice(0, 3).map(c => ({
      name: c.name,
      eta: c.eta,
      portSequence: c.portSequence,
      unloadingOrder: c.unloadingOrder
    })));
    
    return result;
  }

  /**
   * 生成装柜顺序（核心算法）
   * 规则：装柜顺序 = maxUnloadingOrder - unloadingOrder + 1
   * @param {Array} cargoList - 带unloadingOrder的货物列表
   * @returns {Array} 带packingOrder的货物列表，按packingOrder升序排列
   */
  generatePackingOrder(cargoList) {
    console.log('[ShippingTime] 开始生成装柜顺序...');
    
    // 找到最大的unloadingOrder
    const maxUnloadingOrder = Math.max(...cargoList.map(c => c.unloadingOrder || 0));
    
    // 计算packingOrder（反向）
    const result = cargoList.map(cargo => ({
      ...cargo,
      packingOrder: maxUnloadingOrder - (cargo.unloadingOrder || 0) + 1
    }));
    
    // 按packingOrder升序排序（先装的在前）
    result.sort((a, b) => a.packingOrder - b.packingOrder);
    
    console.log(`[ShippingTime] 装柜顺序生成完成`);
    console.log('[ShippingTime] 前3个装柜顺序:', result.slice(0, 3).map(c => ({
      name: c.name,
      eta: c.eta,
      unloadingOrder: c.unloadingOrder,
      packingOrder: c.packingOrder
    })));
    
    return result;
  }

  /**
   * CY_Closing优先模式排序
   * @param {Array} cargoList - 货物列表
   * @returns {Array} 按cyClosing排序的货物列表
   */
  sortByCYClosing(cargoList) {
    console.log('[ShippingTime] 使用CY_Closing优先模式...');
    
    const withClosing = cargoList.filter(c => c.cyClosing);
    const withoutClosing = cargoList.filter(c => !c.cyClosing);
    
    // 有截关时间的按截关时间升序
    withClosing.sort((a, b) => {
      const timeA = new Date(a.cyClosing).getTime();
      const timeB = new Date(b.cyClosing).getTime();
      return timeA - timeB;
    });
    
    // 无截关时间的放最后
    return [...withClosing, ...withoutClosing];
  }

  /**
   * 检测冲突（重货压轻货等）
   * @param {Array} sortedCargo - 已排序的货物列表
   * @returns {Array} 冲突列表
   */
  detectConflicts(sortedCargo) {
    console.log('[ShippingTime] 检测装柜冲突...');
    
    const conflicts = [];
    
    // 检测重货压轻货问题
    for (let i = 0; i < sortedCargo.length - 1; i++) {
      const current = sortedCargo[i];
      const next = sortedCargo[i + 1];
      
      // 如果后装的货物比先装的重1.5倍以上，可能有问题
      if (next.weight > current.weight * 1.5) {
        conflicts.push({
          type: 'heavy_on_light',
          cargo1: current.name,
          cargo2: next.name,
          description: `${next.name}(${next.weight}kg)比${current.name}(${current.weight}kg)重很多，可能需要调整`,
          suggestion: `建议将${next.name}放在底层，或使用加固措施`
        });
      }
    }
    
    console.log(`[ShippingTime] 检测到${conflicts.length}个潜在冲突`);
    return conflicts;
  }

  /**
   * 主入口：生成完整的装柜方案
   * @param {Array} cargoList - 原始货物列表
   * @param {string} mode - 工作模式
   * @returns {Object} 包含排序后货物和冲突信息
   */
  generateShippingTimePlan(cargoList, mode = ShippingTimePackingEngine.MODE_SMART_ETA) {
    console.log(`[ShippingTime] 开始生成装柜方案，模式: ${mode}`);
    
    let sortedCargo;
    
    switch (mode) {
      case ShippingTimePackingEngine.MODE_CY_CLOSING:
        sortedCargo = this.sortByCYClosing(cargoList);
        break;
        
      case ShippingTimePackingEngine.MODE_SMART_ETA:
      default:
        // 1. 计算卸货顺序
        const withUnloadingOrder = this.calculateUnloadingOrder(cargoList);
        // 2. 生成装柜顺序
        sortedCargo = this.generatePackingOrder(withUnloadingOrder);
        break;
    }
    
    // 3. 检测冲突
    const conflicts = this.detectConflicts(sortedCargo);
    
    return {
      sortedCargo,
      conflicts,
      mode
    };
  }
}

module.exports = ShippingTimePackingEngine;
