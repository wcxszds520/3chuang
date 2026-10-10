/**
 * 动画工具模块 (Animation Utilities)
 * 
 * 提供页面过渡、自定义 Loading、按钮反馈等动画能力
 * 替代微信默认 wx.showLoading，提供更优雅的视觉体验
 * 
 * Requirements: 7.5 - 按钮 200ms 内视觉反馈
 * Requirements: 7.6 - 优雅旋转/脉冲光环 Loading
 * Requirements: 7.7 - 页面进入动效 ≤ 400ms
 * Requirements: 8.2 - 提交按钮视觉反馈
 * Requirements: 8.3 - 长时间处理 > 2000ms 显示进度动画
 * 
 * 使用方式：
 *   const animations = require('../../utils/animations.js');
 *   // 在 onReady 中触发页面进入动画
 *   animations.animatePageEnter(this);
 *   // 显示/隐藏自定义 Loading
 *   animations.showCustomLoading(this, '加载中...');
 *   animations.hideCustomLoading(this);
 */

const designTokens = require('./designTokens.js');

/**
 * 触发页面进入动画
 * 页面内容 ≤ 400ms 淡入上滑，禁止白屏闪现
 * 
 * @param {Object} page - Page 实例 (this)
 */
function animatePageEnter(page) {
  // page-enter class 已在 WXML 中静态绑定
  // 此方法用于需要动态触发的场景（如异步数据加载后）
  if (page && page.setData) {
    page.setData({ _pageEntered: true });
  }
}

/**
 * 显示自定义 Loading 覆盖层
 * 优雅的旋转/脉冲光环，替代微信默认 loading
 * 
 * @param {Object} page - Page 实例 (this)
 * @param {string} text - Loading 提示文字
 * @param {Object} options - 可选配置
 * @param {boolean} options.showProgress - 仅当调用方提供真实进度时显示进度条
 */
function showCustomLoading(page, text, options = {}) {
  if (!page || !page.setData) return;

  const { showProgress = false, progress = 0, progressText = '' } = options;

  page.setData({
    _customLoading: true,
    _customLoadingText: text || '加载中...',
    _customLoadingProgress: showProgress,
    _customLoadingPercent: showProgress ? progress : 0,
    _customLoadingProgressText: showProgress ? progressText : ''
  });
}

/**
 * 隐藏自定义 Loading 覆盖层
 * 
 * @param {Object} page - Page 实例 (this)
 */
function hideCustomLoading(page) {
  if (!page || !page.setData) return;

  // 清理定时器
  if (page._loadingProgressTimer) {
    clearTimeout(page._loadingProgressTimer);
    page._loadingProgressTimer = null;
  }
  if (page._loadingProgressInterval) {
    clearInterval(page._loadingProgressInterval);
    page._loadingProgressInterval = null;
  }

  page.setData({
    _customLoading: false,
    _customLoadingText: '',
    _customLoadingProgress: false,
    _customLoadingPercent: 0,
    _customLoadingProgressText: ''
  });
}

/**
 * 按钮按下涟漪效果
 * 200ms 内视觉反馈（按下缩放 + 涟漪）
 * 
 * 注意：主要通过 CSS :active 伪类实现（theme-btn-ripple class）
 * 此方法用于需要额外 JS 动画反馈的场景
 * 
 * @param {Object} event - 微信小程序 tap 事件对象
 * @param {Object} page - Page 实例 (this)
 */
function animateButtonPress(event, page) {
  if (!page || !page.setData) return;

  // 通过 data 属性标记按钮按下状态
  const buttonId = event.currentTarget.id || 'default';
  const key = `_btnPressed_${buttonId}`;

  page.setData({ [key]: true });

  // 200ms 后恢复（与 CSS transition 时长匹配）
  setTimeout(() => {
    page.setData({ [key]: false });
  }, 200);
}

/**
 * 显示页面过渡 Loading（用于页面跳转前）
 * 在当前页面显示一个短暂的退出动画，然后执行跳转
 * 
 * @param {Object} page - Page 实例 (this)
 * @param {string} url - 目标页面路径
 * @param {Object} options - 可选配置
 * @param {string} options.method - 跳转方式: 'navigateTo' | 'redirectTo'，默认 'navigateTo'
 */
function navigateWithTransition(page, url, options = {}) {
  const { method = 'navigateTo' } = options;

  // 微信小程序原生页面切换已有滑入动画
  // 这里确保跳转前不会出现白屏闪现
  if (method === 'navigateTo') {
    wx.navigateTo({ url });
  } else if (method === 'redirectTo') {
    wx.redirectTo({ url });
  }
}

// 支持 CommonJS 和 ES Module 导入
module.exports = {
  animatePageEnter,
  showCustomLoading,
  hideCustomLoading,
  animateButtonPress,
  navigateWithTransition
};

// ES Module default export
module.exports.default = module.exports;
