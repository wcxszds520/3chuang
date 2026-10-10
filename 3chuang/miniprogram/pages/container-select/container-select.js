/**
 * 柜型选择页面
 * 功能：显示宁波港标准柜型列表，支持用户选择柜型
 * 包含：20GP、40GP、40HQ三种标准柜型
 */

// 引入API请求工具
const request = require('../../utils/request.js');
// 引入全局状态管理
const store = require('../../utils/store.js').default;
// 引入动画工具 (Req 7.5, 7.6, 7.7, 8.2, 8.3)
const animations = require('../../utils/animations.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 柜型列表
    containerList: [],
    
    // 当前选中的柜型ID
    selectedContainerId: null,
    
    // 加载状态
    loading: true,
    
    // 错误信息
    errorMessage: '',

    // AI 推荐状态 (Req 3.1, 8.4)
    aiRecommendation: null,
    aiScoreMap: {},
    aiLoading: true,
    aiError: false,

    // 自定义 Loading 覆盖层状态 (Req 7.6, 8.3)
    _customLoading: false,
    _customLoadingText: '',
    _customLoadingProgress: false,
    _customLoadingPercent: 0,
    _customLoadingProgressText: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 从全局状态获取已选中的柜型
    const selectedContainer = store.getState('selectedContainer');
    if (selectedContainer) {
      this.setData({
        selectedContainerId: selectedContainer.typeId
      });
    }

    // 加载柜型列表
    this.loadContainerList();

    // 现场端不主动运行 AI 柜型推荐；柜型结论应来自 Web 已保存方案或用户明确选择。
    this.setData({ aiLoading: false, aiRecommendation: null });
  },

  /**
   * 加载柜型列表
   * 从后端API获取宁波港标准柜型数据
   */
  loadContainerList: function () {
    console.log('\n' + '='.repeat(60));
    console.log('📦 [柜型选择] 开始加载柜型列表');
    console.log('='.repeat(60));
    
    this.setData({
      loading: true,
      errorMessage: ''
    });

    console.log('🔄 [柜型选择] 步骤1: 请求后端API');
    console.log('   - 接口: GET /container/list');

    // 调用后端API获取柜型列表
    request.get('/container/list', {}, {
      showLoading: false,
      loadingText: '加载柜型数据...'
    })
      .then(data => {
        console.log('✅ [柜型选择] 步骤2: API响应成功');
        console.log(`   - 柜型数量: ${data.containerTypes?.length || 0}`);
        
        // 为每个柜型计算容积（立方米）
        console.log('🔄 [柜型选择] 步骤3: 计算柜型容积');
        const cargoList = store.getState('cargoList') || [];
        let cargoTotalVol = 0;
        cargoList.forEach(c => {
          cargoTotalVol += (c.length * c.width * c.height / 1e9) * (c.quantity || 1);
        });
        const containerTypes = (data.containerTypes || []).map(item => {
          // 计算容积：长×宽×高（毫米）/ 1000000000 = 立方米
          const volumeM3 = (item.innerLength * item.innerWidth * item.innerHeight / 1000000000).toFixed(2);
          // v37.1: 计算装载预演（理论装载率）
          const ratio = cargoTotalVol > 0 ? Math.min(100, (cargoTotalVol / parseFloat(volumeM3)) * 100) : 0;
          const loadPercent = Math.round(ratio);
          let loadTier = 'low';
          if (ratio >= 100) loadTier = 'overflow';
          else if (ratio >= 70) loadTier = 'high';
          else if (ratio >= 45) loadTier = 'mid';
          console.log(`   - ${item.name}: ${volumeM3} m³ (${item.innerLength}×${item.innerWidth}×${item.innerHeight} mm)，装载预演 ${loadPercent}%`);
          return {
            ...item,
            volumeM3: volumeM3,
            loadPercent,
            loadTier,
            loadBarWidth: Math.min(100, loadPercent)
          };
        });
        
        console.log('✅ [柜型选择] 容积计算完成');
        
        // 更新页面数据
        this.setData({
          containerList: containerTypes,
          loading: false
        });

        console.log('✅ [柜型选择] 页面数据更新完成');

        // 如果没有选中的柜型，默认选中第一个
        if (!this.data.selectedContainerId && containerTypes.length > 0) {
          console.log(`🎯 [柜型选择] 默认选中第一个柜型: ${containerTypes[0].name}`);
          this.selectContainer(containerTypes[0]);
        }

        console.log('='.repeat(60));
        console.log('🎉 [柜型选择] 柜型列表加载完成');
        console.log('='.repeat(60) + '\n');
      })
      .catch(error => {
        console.error('❌ [柜型选择] API请求失败:', error);
        console.error(`   - 错误信息: ${error.message}`);
        
        this.setData({
          loading: false,
          errorMessage: error.message || '加载柜型数据失败，请重试'
        });

        // 显示错误提示
        wx.showToast({
          title: '加载失败',
          icon: 'none',
          duration: 2000
        });

        console.log('='.repeat(60) + '\n');
      });
  },

  /**
   * 选择柜型
   * @param {Object} container - 柜型对象
   */
  selectContainer: function (container) {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 [柜型选择] 用户选择柜型');
    console.log('='.repeat(60));
    console.log(`   - 柜型: ${container.name}`);
    console.log(`   - 柜型ID: ${container.typeId}`);
    console.log(`   - 尺寸: ${container.innerLength}×${container.innerWidth}×${container.innerHeight} mm`);
    console.log(`   - 容积: ${container.volumeM3} m³`);
    console.log(`   - 最大载重: ${container.maxWeight} kg`);

    // 更新页面选中状态
    this.setData({
      selectedContainerId: container.typeId
    });

    console.log('✅ [柜型选择] 页面状态更新完成');

    // 保存到全局状态管理
    store.setSelectedContainer(container);

    console.log('✅ [柜型选择] 全局状态保存完成');
    console.log('='.repeat(60));
    console.log('🎉 [柜型选择] 柜型选择完成');
    console.log('='.repeat(60) + '\n');

    // 显示选择成功提示
    wx.showToast({
      title: `已选择${container.name}`,
      icon: 'success',
      duration: 1500
    });
  },

  /**
   * 处理柜型卡片点击事件
   * @param {Object} event - 事件对象
   */
  onContainerTap: function (event) {
    const index = event.currentTarget.dataset.index;
    const container = this.data.containerList[index];
    
    if (container) {
      this.selectContainer(container);
    }
  },

  /**
   * 确认选择并返回上一页
   */
  onConfirm: function () {
    if (!this.data.selectedContainerId) {
      wx.showToast({
        title: '请先选择柜型',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 返回上一页
    wx.navigateBack({
      delta: 1
    });
  },

  /**
   * 确认选择并进入装箱方案页面
   */
  onConfirmAndNext: function () {
    if (!this.data.selectedContainerId) {
      wx.showToast({
        title: '请先选择柜型',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 使用动画工具跳转，确保无白屏闪现 (Req 7.7)
    animations.navigateWithTransition(this, '/pages/packing-result/packing-result');
  },

  /**
   * 重新加载柜型列表
   */
  onRetry: function () {
    this.loadContainerList();
  },

  /**
   * 加载 AI 推荐箱型
   * 异步调用后端 AI 推荐接口，不阻塞主流程
   * Requirements: 3.1, 8.4
   */
  loadAIRecommendation: function () {
    const cargoList = store.getState('cargoList');

    // 如果没有货物数据，不请求 AI 推荐
    if (!cargoList || cargoList.length === 0) {
      this.setData({ aiLoading: false, aiRecommendation: null });
      return;
    }

    this.setData({ aiLoading: true, aiError: false });

    request.post('/ai-packing/recommend-container', { cargoList }, {
      showLoading: false,
      showError: false
    })
      .then(data => {
        // 取 Top 1 推荐
        const recommendations = data.recommendations || data;
        const recArray = Array.isArray(recommendations) ? recommendations : [];
        const top = recArray[0] || null;

        // v37.1: 构建 typeId → 推荐数据 map，用于在每张柜型卡上显示徽章
        const aiScoreMap = {};
        recArray.forEach(r => {
          if (r.typeId) {
            aiScoreMap[r.typeId] = {
              score: r.score || 0,
              reason: r.reason || ''
            };
          }
        });

        if (top) {
          this.setData({
            aiRecommendation: top,
            aiScoreMap,
            aiLoading: false
          });
          this._enrichContainerListWithAI();
          console.log('✅ [AI推荐] 获取成功:', top.name || top.typeId);
        } else {
          this.setData({ aiLoading: false, aiRecommendation: null });
        }
      })
      .catch(err => {
        // AI 失败时静默降级，不显示推荐卡片
        console.warn('⚠️ [AI推荐] 请求失败，静默降级:', err.message || err);
        this.setData({
          aiLoading: false,
          aiRecommendation: null,
          aiError: true
        });
      });
  },

  /**
   * v37.1: 把 AI 评分数据合并到 containerList，每张柜型卡都能显示自己的分数
   */
  _enrichContainerListWithAI: function () {
    const list = this.data.containerList || [];
    const scoreMap = this.data.aiScoreMap || {};
    const enriched = list.map(c => {
      const ai = scoreMap[c.typeId];
      return {
        ...c,
        aiScore: ai ? ai.score : null,
        aiReason: ai ? ai.reason : '',
        aiTier: ai ? this._getScoreTier(ai.score) : null
      };
    });
    this.setData({ containerList: enriched });
  },

  /**
   * 95+ 金 / 80-94 蓝 / 60-79 灰 / <60 红警告
   */
  _getScoreTier: function (score) {
    if (score >= 95) return 'gold';
    if (score >= 80) return 'blue';
    if (score >= 60) return 'gray';
    return 'warn';
  },

  /**
   * 用户点击 AI 推荐卡片，自动选中推荐的柜型
   */
  onAIRecommendTap: function () {
    const rec = this.data.aiRecommendation;
    if (!rec) return;

    // 在柜型列表中找到推荐的柜型并选中
    const targetId = rec.typeId || rec.containerId || rec.name;
    const container = this.data.containerList.find(
      c => c.typeId === targetId || c.name === targetId
    );

    if (container) {
      this.selectContainer(container);
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 页面显示时刷新选中状态
    const selectedContainer = store.getState('selectedContainer');
    if (selectedContainer) {
      this.setData({
        selectedContainerId: selectedContainer.typeId
      });
    }
  },

  /**
   * 生命周期函数--监听页面卸载
   * 清理动画定时器
   */
  onUnload: function () {
    animations.hideCustomLoading(this);
  }
});
