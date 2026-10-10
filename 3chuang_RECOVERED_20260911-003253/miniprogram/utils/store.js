/**
 * 全局状态管理工具
 * 管理货物列表、柜型选择、装箱方案等全局数据
 * 提供数据的增删改查和持久化功能
 */

/**
 * 状态管理类
 */
class Store {
  constructor() {
    // 初始化状态数据
    this.state = {
      // 货物列表
      cargoList: [],
      
      // 当前选中的柜型
      selectedContainer: null,
      
      // 装箱方案数据
      packingPlan: null,
      
      // 合规校验报告
      complianceReport: null,

      // Web / Backend 共享的当前装箱任务
      currentCase: null,
      
      // 是否处于路演模式
      isDemoMode: false,
      
      // 预设方案数据（用于离线模式和应急预案）
      precomputedPlan: null
    };

    // 监听器列表
    this.listeners = [];

    // 从本地存储加载数据
    this.loadFromStorage();
  }

  /**
   * 获取状态数据
   * @param {string} key - 状态键名，不传则返回整个state
   * @returns {*} - 状态值
   */
  getState(key) {
    if (key) {
      return this.state[key];
    }
    return this.state;
  }

  /**
   * 设置状态数据
   * @param {string|Object} key - 状态键名或状态对象
   * @param {*} value - 状态值
   */
  setState(key, value) {
    if (typeof key === 'object') {
      // 批量设置状态
      Object.assign(this.state, key);
    } else {
      // 单个设置状态
      this.state[key] = value;
    }

    // 保存到本地存储
    this.saveToStorage();

    // 通知监听器
    this.notify();
  }

  /**
   * 添加货物到列表
   * @param {Object} cargo - 货物对象
   */
  addCargo(cargo) {
    // 生成货物ID
    cargo.cargoId = 'cargo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // 添加到列表
    this.state.cargoList.push(cargo);
    
    // 保存并通知
    this.saveToStorage();
    this.notify();
  }

  /**
   * 更新货物信息
   * @param {string} cargoId - 货物ID
   * @param {Object} updates - 更新的字段
   */
  updateCargo(cargoId, updates) {
    const index = this.state.cargoList.findIndex(item => item.cargoId === cargoId);
    if (index !== -1) {
      Object.assign(this.state.cargoList[index], updates);
      this.saveToStorage();
      this.notify();
    }
  }

  /**
   * 删除货物
   * @param {string} cargoId - 货物ID
   */
  deleteCargo(cargoId) {
    const index = this.state.cargoList.findIndex(item => item.cargoId === cargoId);
    if (index !== -1) {
      this.state.cargoList.splice(index, 1);
      this.saveToStorage();
      this.notify();
    }
  }

  /**
   * 清空所有货物
   */
  clearCargoList() {
    this.state.cargoList = [];
    this.saveToStorage();
    this.notify();
  }

  /**
   * 批量导入货物
   * @param {Array} cargoList - 货物列表
   * @param {boolean} clearExisting - 是否清空现有货物，默认false
   */
  importCargoList(cargoList, clearExisting = false) {
    if (clearExisting) {
      this.state.cargoList = [];
    }

    cargoList.forEach(cargo => {
      // 生成货物ID
      cargo.cargoId = 'cargo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      this.state.cargoList.push(cargo);
    });

    this.saveToStorage();
    this.notify();
  }

  /**
   * 设置选中的柜型
   * @param {Object} container - 柜型对象
   */
  setSelectedContainer(container) {
    this.state.selectedContainer = container;
    this.saveToStorage();
    this.notify();
  }

  /**
   * 设置装箱方案
   * @param {Object} plan - 装箱方案对象
   */
  setPackingPlan(plan) {
    this.state.packingPlan = plan;
    this.saveToStorage();
    this.notify();
  }

  /**
   * 获取装箱方案
   * @returns {Object|null} - 装箱方案对象
   */
  getPackingPlan() {
    return this.state.packingPlan;
  }

  /**
   * 设置合规校验报告
   * @param {Object} report - 合规报告对象
   */
  setComplianceReport(report) {
    this.state.complianceReport = report;
    this.saveToStorage();
    this.notify();
  }

  setCurrentCase(packingCase) {
    this.state.currentCase = packingCase || null;
    this.saveToStorage();
    this.notify();
  }

  /**
   * 设置路演模式
   * @param {boolean} isDemoMode - 是否路演模式
   */
  setDemoMode(isDemoMode) {
    this.state.isDemoMode = isDemoMode;
    this.saveToStorage();
    this.notify();
  }

  /**
   * 设置预设方案
   * @param {Object} plan - 预设方案对象
   */
  setPrecomputedPlan(plan) {
    this.state.precomputedPlan = plan;
    this.saveToStorage();
    this.notify();
  }

  /**
   * 重置所有状态
   */
  reset() {
    this.state = {
      cargoList: [],
      selectedContainer: null,
      packingPlan: null,
      complianceReport: null,
      currentCase: null,
      isDemoMode: false,
      precomputedPlan: null
    };
    this.saveToStorage();
    this.notify();
  }

  /**
   * 添加状态变化监听器
   * @param {Function} listener - 监听器函数
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
    }
  }

  /**
   * 移除状态变化监听器
   * @param {Function} listener - 监听器函数
   */
  unsubscribe(listener) {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  notify() {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('监听器执行错误:', error);
      }
    });
  }

  /**
   * 保存状态到本地存储
   */
  saveToStorage() {
    try {
      wx.setStorageSync('app_state', this.state);
    } catch (error) {
      console.error('保存状态到本地存储失败:', error);
    }
  }

  /**
   * 从本地存储加载状态
   */
  loadFromStorage() {
    try {
      const savedState = wx.getStorageSync('app_state');
      if (savedState) {
        // 合并保存的状态到当前状态
        Object.assign(this.state, savedState);
        console.log('从本地存储加载状态成功');
      }
    } catch (error) {
      console.error('从本地存储加载状态失败:', error);
    }
  }

  /**
   * 清除本地存储
   */
  clearStorage() {
    try {
      wx.removeStorageSync('app_state');
      console.log('清除本地存储成功');
    } catch (error) {
      console.error('清除本地存储失败:', error);
    }
  }
}

// 创建全局store实例
const store = new Store();

// 导出store实例
export default store;
