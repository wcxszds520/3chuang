/**
 * 优雅 Loading 组件 (Elegant Loading)
 * 
 * 科技风旋转/脉冲光环，替代微信默认 loading
 * 长时间处理（> 2000ms）自动显示进度动画
 * 
 * Requirements: 7.6 - 优雅旋转/脉冲光环 Loading
 * Requirements: 8.2 - 提交按钮 200ms 内视觉反馈
 * Requirements: 8.3 - 长时间处理 > 2000ms 显示进度动画
 * 
 * 使用方式：
 * <elegant-loading show="{{isLoading}}" text="正在处理..." progress="{{realProgress}}" />
 */

Component({
  properties: {
    // 是否显示
    show: {
      type: Boolean,
      value: false,
      observer: function (newVal) {
        if (newVal) {
          this._onShow();
        } else {
          this._onHide();
        }
      }
    },
    // 加载提示文字
    text: {
      type: String,
      value: '加载中...'
    },
    // 进度值 0-100（外部控制，-1 表示不显示进度条）
    progress: {
      type: Number,
      value: -1
    },
    // 默认关闭自动进度；百分比必须由真实任务进度提供
    autoProgress: {
      type: Boolean,
      value: false
    },
    // 自动进度延迟时间(ms)
    autoProgressDelay: {
      type: Number,
      value: 2000
    }
  },

  data: {
    _showAutoProgress: false,
    _autoProgressValue: 0,
    _autoProgressText: ''
  },

  lifetimes: {
    detached: function () {
      this._clearTimers();
    }
  },

  methods: {
    /**
     * 显示时启动自动进度计时
     */
    _onShow: function () {
      if (!this.properties.autoProgress) return;
      if (this.properties.progress >= 0) return; // 外部控制进度时不启动自动进度

      this._autoTimer = setTimeout(() => {
        if (this.properties.show) {
          this.setData({ _showAutoProgress: true });
          this._startAutoProgress();
        }
      }, this.properties.autoProgressDelay);
    },

    /**
     * 隐藏时清理
     */
    _onHide: function () {
      this._clearTimers();
      this.setData({
        _showAutoProgress: false,
        _autoProgressValue: 0,
        _autoProgressText: ''
      });
    },

    /**
     * 清理所有定时器
     */
    _clearTimers: function () {
      if (this._autoTimer) {
        clearTimeout(this._autoTimer);
        this._autoTimer = null;
      }
      if (this._progressInterval) {
        clearInterval(this._progressInterval);
        this._progressInterval = null;
      }
    },

    /**
     * 模拟进度（非线性增长，永远不到 100%）
     */
    _startAutoProgress: function () {
      let progress = 5;
      const texts = [
        '正在分析数据...',
        '正在计算最优方案...',
        '正在优化空间利用率...',
        '正在验证稳定性...',
        '即将完成...'
      ];
      let textIndex = 0;

      this.setData({
        _autoProgressValue: progress,
        _autoProgressText: texts[0]
      });

      this._progressInterval = setInterval(() => {
        if (!this.properties.show) {
          this._clearTimers();
          return;
        }

        // 非线性增长：越接近 95% 越慢
        const remaining = 95 - progress;
        const increment = Math.max(0.5, remaining * 0.06);
        progress = Math.min(95, progress + increment);

        // 切换提示文字
        const newTextIndex = Math.min(texts.length - 1, Math.floor(progress / 20));
        if (newTextIndex !== textIndex) {
          textIndex = newTextIndex;
        }

        this.setData({
          _autoProgressValue: Math.round(progress),
          _autoProgressText: texts[textIndex]
        });
      }, 400);
    }
  }
});
