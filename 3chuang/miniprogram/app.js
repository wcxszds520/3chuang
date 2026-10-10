/**
 * 甬柜易算 - 微信小程序主入口文件
 * 负责小程序的全局配置和生命周期管理
 */

// 引入全局状态管理
import store from './utils/store.js';

App({
  /**
   * 小程序初始化完成时触发
   * 用于初始化全局数据和配置
   */
  onLaunch: function () {
    console.log('甬柜易算小程序启动');
    
    // 检查微信小程序基础库版本
    const systemInfo = wx.getSystemInfoSync();
    console.log('系统信息:', systemInfo);
    
    // 检查基础库版本是否满足要求（2.30.0+）
    const libVersion = systemInfo.SDKVersion;
    if (this.compareVersion(libVersion, '2.30.0') < 0) {
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，部分功能可能无法使用，请升级到最新微信版本。',
        showCancel: false
      });
    }
    
    // 初始化全局状态管理
    this.globalData.store = store;
    
    // 检查网络状态
    this.checkNetworkStatus();
  },

  /**
   * 小程序显示时触发
   */
  onShow: function () {
    console.log('小程序显示');
  },

  /**
   * 小程序隐藏时触发
   */
  onHide: function () {
    console.log('小程序隐藏');
  },

  /**
   * 小程序发生错误时触发
   */
  onError: function (error) {
    console.log('小程序错误:', error);
  },

  /**
   * 检查网络状态
   * 用于判断是否需要切换到离线模式
   */
  checkNetworkStatus: function () {
    wx.getNetworkType({
      success: (res) => {
        const networkType = res.networkType;
        console.log('网络类型:', networkType);
        
        if (networkType === 'none') {
          console.log('当前无网络连接，切换到离线模式');
          this.globalData.isOffline = true;
          wx.showToast({
            title: '已切换到离线模式',
            icon: 'none',
            duration: 2000
          });
        } else {
          this.globalData.isOffline = false;
        }
      }
    });

    // 监听网络状态变化
    wx.onNetworkStatusChange((res) => {
      console.log('网络状态变化:', res);
      if (!res.isConnected) {
        this.globalData.isOffline = true;
        wx.showToast({
          title: '网络已断开，切换到离线模式',
          icon: 'none',
          duration: 2000
        });
      } else {
        this.globalData.isOffline = false;
        wx.showToast({
          title: '网络已连接',
          icon: 'success',
          duration: 2000
        });
      }
    });
  },

  /**
   * 比较版本号
   * @param {string} v1 - 版本号1
   * @param {string} v2 - 版本号2
   * @returns {number} - 返回1表示v1>v2，返回-1表示v1<v2，返回0表示v1=v2
   */
  compareVersion: function (v1, v2) {
    const arr1 = v1.split('.');
    const arr2 = v2.split('.');
    const len = Math.max(arr1.length, arr2.length);

    for (let i = 0; i < len; i++) {
      const num1 = parseInt(arr1[i] || 0);
      const num2 = parseInt(arr2[i] || 0);
      if (num1 > num2) {
        return 1;
      } else if (num1 < num2) {
        return -1;
      }
    }
    return 0;
  },

  /**
   * 全局数据
   */
  globalData: {
    store: null,           // 全局状态管理实例
    isOffline: false,      // 是否处于离线模式
    userInfo: null         // 用户信息（MVP阶段可为空）
  }
});
