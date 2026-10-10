/**
 * API请求工具类
 * 封装微信小程序的网络请求，提供统一的接口调用方式
 * 支持loading提示、错误处理、请求拦截、离线降级等功能
 * 
 * 离线降级策略 (Req 13.4):
 * - 请求失败时自动检测网络状态
 * - 网络断开时设置全局离线标志
 * - 对 /packing/generate 端点使用 store.precomputedPlan 作为降级数据
 * - 确保手动演示流程在断网时仍可走通
 */

const { getApiBaseUrl } = require('../config/environment');

/**
 * 离线降级：尝试从 store 获取预录数据
 * 仅对 /packing/generate 端点提供降级支持
 * @param {string} url - 请求路径
 * @returns {Object|null} - 降级数据或 null
 */
function getOfflineFallbackData(url) {
  // 仅对装箱生成接口提供离线降级
  if (url === '/packing/generate') {
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.store) {
        const precomputedPlan = app.globalData.store.getState('precomputedPlan');
        if (precomputedPlan) {
          console.log('[Request] 离线降级：使用预录装箱方案');
          return {
            ...precomputedPlan,
            fallback: true,
            offlineMode: true
          };
        }
      }
    } catch (e) {
      console.warn('[Request] 获取离线降级数据失败:', e);
    }
  }
  return null;
}

/**
 * 检测网络状态并更新全局离线标志
 * 在请求失败时调用，自动判断是否为网络断开
 */
function detectNetworkAndSetOffline() {
  wx.getNetworkType({
    success: (res) => {
      if (res.networkType === 'none') {
        const app = getApp();
        if (app) {
          app.globalData.isOffline = true;
          console.log('[Request] 网络断开，已切换到离线模式');
        }
      }
    }
  });
}

/**
 * 发起HTTP请求
 * @param {Object} options - 请求配置对象
 * @param {string} options.url - 请求路径（相对路径，会自动拼接BASE_URL）
 * @param {string} options.method - 请求方法（GET/POST/PUT/DELETE）
 * @param {Object} options.data - 请求参数
 * @param {boolean} options.showLoading - 是否显示loading提示，默认true
 * @param {string} options.loadingText - loading提示文本，默认"加载中..."
 * @param {boolean} options.showError - 是否显示错误提示，默认true
 * @returns {Promise} - 返回Promise对象
 */
function request(options) {
  // 获取全局app实例，检查是否处于离线模式
  const app = getApp();
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return Promise.reject({
      code: 'API_BASE_URL_NOT_CONFIGURED',
      message: '当前小程序环境尚未配置后端 API 地址'
    });
  }
  
  // 如果处于离线模式，尝试使用本地预录数据降级
  if (app && app.globalData.isOffline) {
    const fallbackData = getOfflineFallbackData(options.url);
    if (fallbackData) {
      // 有降级数据，直接返回
      return Promise.resolve(fallbackData);
    }
    // 无降级数据，返回离线错误
    return Promise.reject({
      code: -1,
      message: '当前处于离线模式，请检查网络连接',
      isOffline: true
    });
  }

  // 默认配置
  const defaultOptions = {
    showLoading: true,
    loadingText: '加载中...',
    showError: true,
    method: 'GET',
    header: {
      'Content-Type': 'application/json'
    }
  };

  // 合并配置
  const config = Object.assign({}, defaultOptions, options);

  // 显示loading提示
  if (config.showLoading) {
    wx.showLoading({
      title: config.loadingText,
      mask: true
    });
  }

  // 返回Promise对象
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl + config.url,
      method: config.method,
      data: config.data,
      header: config.header,
      timeout: 60000, // 60秒超时 (v34.4: 增加超时时间以支持大批量装载)
      success: (res) => {
        // 隐藏loading
        if (config.showLoading) {
          wx.hideLoading();
        }

        // 网络恢复：如果之前是离线状态，现在请求成功了，清除离线标志
        if (app && app.globalData.isOffline) {
          app.globalData.isOffline = false;
          console.log('[Request] 网络已恢复，退出离线模式');
        }

        // 检查HTTP状态码 (支持200和202)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 检查业务状态码 (支持200和202)
          if (res.data.code >= 200 && res.data.code < 300) {
            // 请求成功，返回数据
            resolve(res.data.data);
          } else {
            // 业务错误
            const errorMsg = res.data.message || '请求失败';
            console.error('业务错误:', errorMsg);
            
            if (config.showError) {
              wx.showToast({
                title: errorMsg,
                icon: 'none',
                duration: 2000
              });
            }
            
            reject({
              code: res.data.code,
              message: errorMsg
            });
          }
        } else {
          // HTTP错误
          const errorMsg = `服务器错误 (${res.statusCode})`;
          console.error('HTTP错误:', errorMsg);
          
          if (config.showError) {
            wx.showToast({
              title: errorMsg,
              icon: 'none',
              duration: 2000
            });
          }
          
          reject({
            code: res.statusCode,
            message: errorMsg
          });
        }
      },
      fail: (error) => {
        // 隐藏loading
        if (config.showLoading) {
          wx.hideLoading();
        }

        // 网络错误：检测网络状态并设置离线标志
        detectNetworkAndSetOffline();

        // 尝试离线降级：如果有预录数据，使用降级数据
        const fallbackData = getOfflineFallbackData(config.url);
        if (fallbackData) {
          console.log('[Request] 请求失败，使用离线降级数据');
          if (config.showError) {
            wx.showToast({
              title: '已切换到离线模式',
              icon: 'none',
              duration: 2000
            });
          }
          resolve(fallbackData);
          return;
        }

        // 无降级数据，正常报错
        const errorMsg = error.errMsg || '网络请求失败';
        console.error('网络错误:', errorMsg);
        
        if (config.showError) {
          wx.showToast({
            title: '网络请求失败，请检查网络连接',
            icon: 'none',
            duration: 2000
          });
        }
        
        reject({
          code: -1,
          message: errorMsg,
          isOffline: true
        });
      }
    });
  });
}

/**
 * GET请求
 * @param {string} url - 请求路径
 * @param {Object} data - 请求参数
 * @param {Object} options - 其他配置
 * @returns {Promise}
 */
function get(url, data = {}, options = {}) {
  return request({
    url,
    method: 'GET',
    data,
    ...options
  });
}

/**
 * POST请求
 * @param {string} url - 请求路径
 * @param {Object} data - 请求参数
 * @param {Object} options - 其他配置
 * @returns {Promise}
 */
function post(url, data = {}, options = {}) {
  return request({
    url,
    method: 'POST',
    data,
    ...options
  });
}

/**
 * PUT请求
 * @param {string} url - 请求路径
 * @param {Object} data - 请求参数
 * @param {Object} options - 其他配置
 * @returns {Promise}
 */
function put(url, data = {}, options = {}) {
  return request({
    url,
    method: 'PUT',
    data,
    ...options
  });
}

/**
 * DELETE请求
 * @param {string} url - 请求路径
 * @param {Object} data - 请求参数
 * @param {Object} options - 其他配置
 * @returns {Promise}
 */
function del(url, data = {}, options = {}) {
  return request({
    url,
    method: 'DELETE',
    data,
    ...options
  });
}

module.exports = {
  request,
  get,
  post,
  put,
  del
};
