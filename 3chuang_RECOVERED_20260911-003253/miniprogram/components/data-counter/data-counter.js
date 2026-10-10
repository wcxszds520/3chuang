/**
 * 数据跳动组件 (Data Counter)
 * 
 * 数值变化时执行 ≥ 300ms 的插值动画（easeOutCubic）
 * 从 0 平滑跳动到目标值，视觉效果类似仪表盘数据刷新
 * 
 * Requirements: 7.4 - 数据跳动组件
 * 
 * Props:
 *   value {Number} - 目标数值
 *   duration {Number} - 动画时长（ms），默认 800（≥ 300ms 满足 Req 7.4）
 *   suffix {String} - 后缀文字（如 '%', 'kg', '件'）
 *   decimals {Number} - 小数位数，默认 0
 *   prefix {String} - 前缀文字
 */
Component({
  properties: {
    value: {
      type: Number,
      value: 0,
      observer: function(newVal, oldVal) {
        // 当值变化时触发动画
        if (newVal !== oldVal) {
          this.animateTo(oldVal || 0, newVal);
        }
      }
    },
    duration: {
      type: Number,
      value: 800
    },
    suffix: {
      type: String,
      value: ''
    },
    prefix: {
      type: String,
      value: ''
    },
    decimals: {
      type: Number,
      value: 0
    }
  },

  data: {
    displayValue: '0'
  },

  lifetimes: {
    attached: function() {
      // 组件挂载时，如果已有初始值则触发动画
      if (this.properties.value !== 0) {
        // 延迟一帧启动，确保页面渲染完成
        setTimeout(() => {
          this.animateTo(0, this.properties.value);
        }, 100);
      }
    },
    detached: function() {
      // 清理定时器
      this.stopAnimation();
    }
  },

  methods: {
    /**
     * 从 startVal 动画到 endVal
     * 使用 easeOutCubic 缓动函数，视觉上先快后慢
     */
    animateTo: function(startVal, endVal) {
      this.stopAnimation();

      const duration = Math.max(this.properties.duration, 300); // 确保 ≥ 300ms
      const decimals = this.properties.decimals;
      const startTime = Date.now();

      const tick = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // easeOutCubic: 先快后慢，视觉效果更自然
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        const currentValue = startVal + (endVal - startVal) * easedProgress;
        const formatted = this.formatValue(currentValue, decimals);

        this.setData({ displayValue: formatted });

        if (progress < 1) {
          this._rafId = setTimeout(tick, 16); // ~60fps
        } else {
          // 确保最终值精确
          this.setData({ displayValue: this.formatValue(endVal, decimals) });
        }
      };

      tick();
    },

    /**
     * 格式化数值
     */
    formatValue: function(value, decimals) {
      if (decimals > 0) {
        return value.toFixed(decimals);
      }
      return Math.round(value).toString();
    },

    /**
     * 停止当前动画
     */
    stopAnimation: function() {
      if (this._rafId) {
        clearTimeout(this._rafId);
        this._rafId = null;
      }
    }
  }
});
