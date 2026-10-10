/**
 * 自定义 Loading 组件
 * 替代微信默认 loading，提供科技风脉冲光环
 * 进度条仅显示调用方提供的真实进度
 * 
 * Requirements: 7.6, 8.2, 8.3
 * 
 * 使用方式：
 * <loading-overlay visible="{{isLoading}}" text="正在处理..." 
 *   show-progress="{{showProgress}}" progress="{{progress}}" 
 *   progress-text="{{progressText}}" />
 */

Component({
  properties: {
    // 是否显示
    visible: {
      type: Boolean,
      value: false,
      observer: function(newVal) {
        if (newVal) {
          this._startProgressTimer();
        } else {
          this._clearProgressTimer();
        }
      }
    },
    // 加载文字
    text: {
      type: String,
      value: ''
    },
    // 是否显示进度条（外部控制）
    showProgress: {
      type: Boolean,
      value: false
    },
    // 进度值 0-100（外部控制）
    progress: {
      type: Number,
      value: 0
    },
    // 进度文字
    progressText: {
      type: String,
      value: ''
    },
    // 默认关闭模拟进度；百分比必须来自真实任务状态
    autoProgress: {
      type: Boolean,
      value: false
    }
  },

  data: {
    _autoShowProgress: false
  },

  lifetimes: {
    detached: function() {
      this._clearProgressTimer();
    }
  },

  methods: {
    /**
     * 启动进度计时器
     * 超过 2000ms 自动显示进度动画
     */
    _startProgressTimer: function() {
      if (!this.properties.autoProgress) return;
      
      this._progressStartTime = Date.now();
      this._progressTimer = setTimeout(() => {
        // 超过 2000ms，自动显示进度
        if (this.properties.visible && !this.properties.showProgress) {
          this.setData({ _autoShowProgress: true });
          this._startSimulatedProgress();
        }
      }, 2000);
    },

    /**
     * 清除进度计时器
     */
    _clearProgressTimer: function() {
      if (this._progressTimer) {
        clearTimeout(this._progressTimer);
        this._progressTimer = null;
      }
      if (this._simulatedTimer) {
        clearInterval(this._simulatedTimer);
        this._simulatedTimer = null;
      }
      this.setData({ _autoShowProgress: false });
    },

    /**
     * 模拟进度（非线性增长，永远不到100%）
     */
    _startSimulatedProgress: function() {
      let simulatedProgress = 10;
      
      this.triggerEvent('progressstart');
      
      this._simulatedTimer = setInterval(() => {
        if (!this.properties.visible) {
          this._clearProgressTimer();
          return;
        }
        
        // 非线性增长：越接近100越慢
        const remaining = 95 - simulatedProgress;
        const increment = Math.max(0.5, remaining * 0.08);
        simulatedProgress = Math.min(95, simulatedProgress + increment);
        
        this.triggerEvent('progressupdate', { progress: Math.round(simulatedProgress) });
      }, 500);
    }
  }
});
