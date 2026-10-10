/**
 * 离线模式横幅组件
 * 当系统处于离线模式时显示顶部提示横幅
 * Requirements: 13.4
 */
Component({
  properties: {
    // 是否显示横幅
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {
    isOffline: false
  },

  lifetimes: {
    attached() {
      this.checkOfflineStatus();
      // 定时检查离线状态（每 3 秒）
      this._timer = setInterval(() => {
        this.checkOfflineStatus();
      }, 3000);
    },

    detached() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }
  },

  methods: {
    /**
     * 检查当前离线状态
     */
    checkOfflineStatus() {
      const app = getApp();
      if (app && app.globalData) {
        const isOffline = !!app.globalData.isOffline;
        if (isOffline !== this.data.isOffline) {
          this.setData({ isOffline });
        }
      }
    }
  }
});
