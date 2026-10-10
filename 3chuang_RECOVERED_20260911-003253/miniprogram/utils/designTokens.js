/**
 * Design Token 系统
 * 全局设计令牌：颜色、间距、圆角、字号、阴影、动效曲线
 * 
 * 设计语言：白色极简 + 科技蓝强调
 * 参考：Apple HIG / Vision Pro / 数字孪生大屏
 * 
 * Requirements: 7.1 - 全局 Design Token，禁止魔法值
 * Requirements: 7.2 - 主色 H 值 200-220（科技蓝）
 */

const designTokens = {
  // ============================================================
  // 颜色系统 (Color System)
  // 主色 H=211 (科技蓝 #007AFF)，满足 Req 7.2 H 值 200-220
  // ============================================================
  colors: {
    // 主色 (Primary)
    primary: '#007AFF',
    primaryLight: '#4DA2FF',
    primaryDark: '#0056CC',
    primaryAlpha10: 'rgba(0, 122, 255, 0.10)',
    primaryAlpha20: 'rgba(0, 122, 255, 0.20)',
    primaryAlpha50: 'rgba(0, 122, 255, 0.50)',

    // 背景色 (Background)
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F5F5F7',
    bgTertiary: '#E8E8ED',
    bgElevated: '#FFFFFF',

    // 表面色 (Surface) - 卡片、容器
    surfaceCard: '#FFFFFF',
    surfaceOverlay: 'rgba(255, 255, 255, 0.85)',

    // 文字色 (Text)
    textPrimary: '#1D1D1F',
    textSecondary: '#6E6E73',
    textTertiary: '#AEAEB2',
    textInverse: '#FFFFFF',
    textLink: '#007AFF',

    // 语义色 (Semantic)
    success: '#34C759',
    successLight: '#E8F9ED',
    warning: '#FF9500',
    warningLight: '#FFF4E5',
    danger: '#FF3B30',
    dangerLight: '#FFEBEA',
    info: '#5AC8FA',
    infoLight: '#E8F7FE',

    // 边框色 (Border)
    border: '#E5E5EA',
    borderLight: '#F2F2F7',
    borderFocus: '#007AFF',

    // 阴影色 (Shadow)
    shadowLight: 'rgba(0, 0, 0, 0.04)',
    shadowMedium: 'rgba(0, 0, 0, 0.08)',
    shadowHeavy: 'rgba(0, 0, 0, 0.12)',

    // 3D 场景色 (Three.js)
    sceneBg: '#F5F5F7',
    sceneContainerEdge: '#CCCCCC',
    sceneContainerFrame: '#333333',
  },

  // ============================================================
  // 间距系统 (Spacing) - 基于 4px 网格，单位 rpx
  // ============================================================
  spacing: {
    xs: '8rpx',     // 4px
    sm: '16rpx',    // 8px
    md: '24rpx',    // 12px
    lg: '32rpx',    // 16px
    xl: '48rpx',    // 24px
    xxl: '64rpx',   // 32px
    xxxl: '96rpx',  // 48px
  },

  // ============================================================
  // 圆角系统 (Border Radius)
  // ============================================================
  radius: {
    xs: '4rpx',
    sm: '8rpx',
    md: '12rpx',
    lg: '16rpx',
    xl: '24rpx',
    xxl: '32rpx',
    full: '9999rpx',  // 胶囊形
  },

  // ============================================================
  // 字号系统 (Typography)
  // ============================================================
  fontSize: {
    xs: '22rpx',    // 11px - 辅助说明
    sm: '24rpx',    // 12px - 标签
    md: '28rpx',    // 14px - 正文
    lg: '32rpx',    // 16px - 副标题
    xl: '36rpx',    // 18px - 标题
    xxl: '44rpx',   // 22px - 大标题
    xxxl: '56rpx',  // 28px - 数据展示
    display: '72rpx', // 36px - 超大数据
  },

  // 字重
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // 行高
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // ============================================================
  // 阴影系统 (Elevation / Shadow)
  // ============================================================
  shadow: {
    sm: '0 2rpx 8rpx rgba(0, 0, 0, 0.04)',
    md: '0 4rpx 16rpx rgba(0, 0, 0, 0.08)',
    lg: '0 8rpx 32rpx rgba(0, 0, 0, 0.12)',
    xl: '0 16rpx 48rpx rgba(0, 0, 0, 0.16)',
    // 卡片悬浮阴影
    card: '0 4rpx 20rpx rgba(0, 0, 0, 0.06)',
    // 按钮阴影
    button: '0 4rpx 12rpx rgba(0, 122, 255, 0.20)',
  },

  // ============================================================
  // 动效系统 (Animation / Motion)
  // ============================================================
  motion: {
    // 动效曲线 (Easing)
    easing: {
      // 标准曲线 - 大多数过渡使用
      standard: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
      // 进入曲线 - 元素进入视图
      enter: 'cubic-bezier(0.0, 0.0, 0.2, 1.0)',
      // 退出曲线 - 元素离开视图
      exit: 'cubic-bezier(0.4, 0.0, 1.0, 1.0)',
      // 弹性曲线 - 按钮反馈、数据跳动
      bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1.0)',
      // 强调曲线 - 重要动画
      emphasis: 'cubic-bezier(0.4, 0.0, 0.0, 1.0)',
      // 3D 装载落地曲线 (easeOutBack)
      easeOutBack: 'cubic-bezier(0.34, 1.56, 0.64, 1.0)',
    },

    // 动效时长 (Duration)
    duration: {
      instant: 100,    // ms - 即时反馈
      fast: 200,       // ms - 按钮反馈
      normal: 300,     // ms - 标准过渡
      slow: 400,       // ms - 页面进入
      slower: 600,     // ms - 复杂动画
      loading: 800,    // ms - 装载动画单件
    },

    // 页面过渡
    pageTransition: {
      duration: 400,   // ms - ≤ 400ms 满足 Req 7.7
      translateY: '40rpx', // 上滑距离
    },

    // 数据跳动
    dataCounter: {
      duration: 300,   // ms - ≥ 300ms 满足 Req 7.4
    },
  },

  // ============================================================
  // 毛玻璃效果 (Glassmorphism)
  // ============================================================
  glass: {
    blur: '24px',  // backdrop-filter blur ≥ 12px 满足 Req 7.3
    background: 'rgba(255, 255, 255, 0.72)',
    border: '1rpx solid rgba(255, 255, 255, 0.18)',
  },

  // ============================================================
  // 布局常量 (Layout)
  // ============================================================
  layout: {
    maxWidth: '750rpx',
    headerHeight: '88rpx',
    tabBarHeight: '100rpx',
    safeAreaBottom: '68rpx',
  },
};

module.exports = designTokens;
