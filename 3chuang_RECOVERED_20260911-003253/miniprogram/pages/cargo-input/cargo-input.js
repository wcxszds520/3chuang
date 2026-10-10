/**
 * 货物录入页面
 * 提供货物信息录入表单和列表管理
 */

import store from '../../utils/store.js';
import request from '../../utils/request.js';
import cargoTemplates from '../../utils/cargo-templates.js';
// v31.7: Import roadshow flagship templates
import roadshowTemplates from '../../data/cargo-templates.js';
// 动画工具 (Req 7.5, 7.6, 7.7, 8.2, 8.3)
import animations from '../../utils/animations.js';
// 离线降级：预录装箱方案生成 (Req 13.4)
import demoPrecomputedPlans from '../../data/demo-precomputed-plans.js';

/**
 * 演示数据预设集 (Req 13.1)
 * 基于真实出口包装规格（含外箱纸箱尺寸+重量）
 * 数据来源：慈溪/宁波小家电出口行业标准包装规格
 * 
 * 注意：所有尺寸为外箱（瓦楞纸箱）尺寸，重量为含包装毛重
 * 堆叠层数根据纸箱强度和货物重量确定
 */
const DEMO_PRESETS = [
  // ========== 方案 1: 慈溪小家电满柜（20GP 高密度）==========
  // 实测：700件 / 100% 装入 / 利用率 62.98% / 横向偏移 1.59% (远低于5%红线) / 17秒 ✅
  {
    id: 'preset-cixi-fullbox',
    name: '慈溪小家电满柜（20GP）',
    icon: '🏠',
    desc: '700件 | 4种SKU | 鹿特丹 | 100%装入·偏移1.59%',
    cargoList: [
      {
        name: '空气炸锅 5.5L',
        length: 420, width: 380, height: 340, weight: 6.2, quantity: 168,
        stackable: true, maxStackLayers: 4, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '鹿特丹', eta: '2026-06-20', cyClosing: '2026-06-15',
        customsDeclaration: 'NB202606-EU01'
      },
      {
        name: '电饭煲 5L',
        length: 380, width: 380, height: 320, weight: 5.8, quantity: 120,
        stackable: true, maxStackLayers: 4, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '鹿特丹', eta: '2026-06-20', cyClosing: '2026-06-15',
        customsDeclaration: 'NB202606-EU01'
      },
      {
        name: '电热水壶 1.7L',
        length: 280, width: 200, height: 320, weight: 1.8, quantity: 220,
        stackable: true, maxStackLayers: 6, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '鹿特丹', eta: '2026-06-20', cyClosing: '2026-06-15',
        customsDeclaration: 'NB202606-EU01'
      },
      {
        name: '手持挂烫机',
        length: 320, width: 150, height: 250, weight: 1.5, quantity: 192,
        stackable: true, maxStackLayers: 8, canInvert: false, canLayFlat: true, fragile: false,
        destinationPort: '鹿特丹', eta: '2026-06-20', cyClosing: '2026-06-15',
        customsDeclaration: 'NB202606-EU01'
      }
    ]
  },

  // ========== 方案 2: 多港口拼箱欧洲线（40GP LIFO 演示）==========
  // 实测：600件 / 100% 装入 / 利用率 39.44% / 偏移 3.51% / 21秒 ✅
  // 演示亮点：多目的港LIFO批次着色 + 100% 装入合规
  {
    id: 'preset-multiport-europe',
    name: '多港口拼箱欧洲线（40GP）',
    icon: '🚢',
    desc: '600件 | 5种SKU | 5港口LIFO | 100%装入·偏3.51%',
    cargoList: [
      {
        name: '电动牙刷套装',
        length: 250, width: 80, height: 220, weight: 0.45, quantity: 130,
        stackable: true, maxStackLayers: 10, canInvert: true, canLayFlat: true, fragile: false,
        destinationPort: '鹿特丹', eta: '2026-07-05', cyClosing: '2026-06-25',
        customsDeclaration: 'NB202607-MIX'
      },
      {
        name: '咖啡机半自动',
        length: 420, width: 320, height: 380, weight: 8.5, quantity: 150,
        stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: true,
        destinationPort: '安特卫普', eta: '2026-07-08', cyClosing: '2026-06-25',
        customsDeclaration: 'NB202607-MIX'
      },
      {
        name: '取暖器油汀',
        length: 680, width: 200, height: 650, weight: 12.5, quantity: 50,
        stackable: true, maxStackLayers: 2, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '汉堡', eta: '2026-07-10', cyClosing: '2026-06-25',
        customsDeclaration: 'NB202607-MIX'
      },
      {
        name: '落地扇 16寸',
        length: 520, width: 180, height: 680, weight: 6.8, quantity: 70,
        stackable: false, maxStackLayers: 1, canInvert: false, canLayFlat: true, fragile: false,
        destinationPort: '费利克斯托', eta: '2026-07-15', cyClosing: '2026-06-25',
        customsDeclaration: 'NB202607-MIX'
      },
      {
        name: '棉被压缩包',
        length: 600, width: 400, height: 200, weight: 3.5, quantity: 200,
        stackable: true, maxStackLayers: 8, canInvert: true, canLayFlat: true, fragile: false,
        destinationPort: '哥德堡', eta: '2026-07-18', cyClosing: '2026-06-25',
        customsDeclaration: 'NB202607-MIX'
      }
    ]
  },

  // ========== 方案 3: 汽配灯具出口（40HQ 重心控制+高货物演示）==========
  // 实测：750件 / 100% 装入 / 体积 39m³ / AI 推 40HQ（含 2500mm 高货架）/ 偏 ~2% ✅
  {
    id: 'preset-autoparts-mexico',
    name: '汽配灯具出口（40HQ）',
    icon: '🏭',
    desc: '750件 | 5种SKU | 目的港曼萨尼约 | 含高货架·40HQ专属',
    cargoList: [
      {
        name: '车灯展示货架',
        length: 1100, width: 600, height: 2500, weight: 35, quantity: 8,
        stackable: false, maxStackLayers: 1, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '曼萨尼约', eta: '2026-08-10', cyClosing: '2026-07-20',
        customsDeclaration: 'NB202608-AUTO'
      },
      {
        name: '车灯总成（大）',
        length: 600, width: 400, height: 350, weight: 4.5, quantity: 150,
        stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: true,
        destinationPort: '曼萨尼约', eta: '2026-08-10', cyClosing: '2026-07-20',
        customsDeclaration: 'NB202608-AUTO'
      },
      {
        name: '机油桶 4L',
        length: 250, width: 200, height: 280, weight: 4.0, quantity: 200,
        stackable: true, maxStackLayers: 4, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '曼萨尼约', eta: '2026-08-10', cyClosing: '2026-07-20',
        customsDeclaration: 'NB202608-AUTO'
      },
      {
        name: '空气滤芯',
        length: 350, width: 280, height: 80, weight: 0.8, quantity: 200,
        stackable: true, maxStackLayers: 8, canInvert: true, canLayFlat: true, fragile: false,
        destinationPort: '曼萨尼约', eta: '2026-08-10', cyClosing: '2026-07-20',
        customsDeclaration: 'NB202608-AUTO'
      },
      {
        name: '汽车电池',
        length: 280, width: 180, height: 220, weight: 15, quantity: 192,
        stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '曼萨尼约', eta: '2026-08-10', cyClosing: '2026-07-20',
        customsDeclaration: 'NB202608-AUTO'
      }
    ]
  },

  // ========== 方案 4: 玻璃易碎品专柜（40HQ 易碎品保护）==========
  // 实测：950件 / 100% 装入 / 体积 27m³ / AI 推 40HQ / 偏 ~3% / ≤50秒 ✅
  {
    id: 'preset-glass-dubai',
    name: '玻璃易碎品专柜（40HQ）',
    icon: '🥂',
    desc: '950件 | 5种SKU | 目的港迪拜 | 含高展柜·40HQ专属',
    cargoList: [
      {
        name: '展示用玻璃柜',
        length: 1100, width: 600, height: 2400, weight: 60, quantity: 6,
        stackable: false, maxStackLayers: 1, canInvert: false, canLayFlat: false, fragile: true,
        destinationPort: '迪拜', eta: '2026-08-15', cyClosing: '2026-07-25',
        customsDeclaration: 'NB202608-DXB'
      },
      {
        name: '红酒杯套装6只',
        length: 380, width: 280, height: 280, weight: 2.5, quantity: 220,
        stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: true,
        destinationPort: '迪拜', eta: '2026-08-15', cyClosing: '2026-07-25',
        customsDeclaration: 'NB202608-DXB'
      },
      {
        name: '陶瓷餐具套装',
        length: 450, width: 450, height: 200, weight: 6.0, quantity: 220,
        stackable: true, maxStackLayers: 4, canInvert: false, canLayFlat: true, fragile: true,
        destinationPort: '迪拜', eta: '2026-08-15', cyClosing: '2026-07-25',
        customsDeclaration: 'NB202608-DXB'
      },
      {
        name: '玻璃水壶',
        length: 200, width: 200, height: 280, weight: 1.5, quantity: 304,
        stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: true,
        destinationPort: '迪拜', eta: '2026-08-15', cyClosing: '2026-07-25',
        customsDeclaration: 'NB202608-DXB'
      },
      {
        name: '台灯',
        length: 350, width: 250, height: 400, weight: 2.5, quantity: 200,
        stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: true,
        destinationPort: '迪拜', eta: '2026-08-15', cyClosing: '2026-07-25',
        customsDeclaration: 'NB202608-DXB'
      }
    ]
  },

  // ========== 方案 5: 家具混装大件挑战（40GP 不规则形状）==========
  // 实测：600件 / 100% 装入 / 利用率 50.22% / 偏移 4.83% / 13秒 ✅
  {
    id: 'preset-furniture-sydney',
    name: '家具混装挑战（40GP）',
    icon: '🛋️',
    desc: '600件 | 5种SKU | 目的港悉尼 | 100%装入·偏4.83%',
    cargoList: [
      {
        name: '折叠沙发椅',
        length: 1100, width: 600, height: 700, weight: 28, quantity: 14,
        stackable: false, maxStackLayers: 1, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '悉尼', eta: '2026-08-25', cyClosing: '2026-08-05',
        customsDeclaration: 'NB202608-AUS'
      },
      {
        name: '茶几方桌',
        length: 800, width: 600, height: 400, weight: 18, quantity: 36,
        stackable: true, maxStackLayers: 2, canInvert: false, canLayFlat: true, fragile: false,
        destinationPort: '悉尼', eta: '2026-08-25', cyClosing: '2026-08-05',
        customsDeclaration: 'NB202608-AUS'
      },
      {
        name: '收纳箱（大）',
        length: 600, width: 400, height: 350, weight: 4.5, quantity: 100,
        stackable: true, maxStackLayers: 5, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '悉尼', eta: '2026-08-25', cyClosing: '2026-08-05',
        customsDeclaration: 'NB202608-AUS'
      },
      {
        name: '抱枕压缩包',
        length: 500, width: 500, height: 200, weight: 1.5, quantity: 200,
        stackable: true, maxStackLayers: 8, canInvert: true, canLayFlat: true, fragile: false,
        destinationPort: '悉尼', eta: '2026-08-25', cyClosing: '2026-08-05',
        customsDeclaration: 'NB202608-AUS'
      },
      {
        name: '装饰摆件',
        length: 350, width: 250, height: 300, weight: 2.0, quantity: 250,
        stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: true,
        destinationPort: '悉尼', eta: '2026-08-25', cyClosing: '2026-08-05',
        customsDeclaration: 'NB202608-AUS'
      }
    ]
  },

  // ========== 方案 6: 🌟 跨境电商旗舰满柜（40HQ 装满演示）==========
  // 设计目标：货物体积 52.0 m³ / 柜容积 76.3 m³ = 68% 体积比
  //          算法预期：100% 装入 + 利用率 ~68% + 偏移 ≤4%
  // 演示亮点：13 SKU × 4 港口 LIFO 分批 + 重/普通/易碎三级混装 + 视觉柜内充满
  // 注：3D 装柜物理极限 ~70-75%（NP-Hard），68% 体积比是 100% 装入的安全甜区
  {
    id: 'preset-flagship-fullbox',
    name: '🏆 跨境电商旗舰满柜（40HQ）',
    icon: '🏆',
    desc: '924件 | 13种SKU | 4港LIFO | 100%装入·利用率68%',
    cargoList: [
      // ─────────── 哥德堡（最远·最先装·最深处）大件骨架 ───────────
      {
        name: '折叠沙发椅',
        length: 1100, width: 600, height: 700, weight: 28, quantity: 10,
        stackable: false, maxStackLayers: 1, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '哥德堡', eta: '2026-09-15', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },
      {
        name: '餐桌方桌',
        length: 1200, width: 800, height: 400, weight: 22, quantity: 10,
        stackable: true, maxStackLayers: 2, canInvert: false, canLayFlat: true, fragile: false,
        destinationPort: '哥德堡', eta: '2026-09-15', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },
      {
        name: '茶几边桌',
        length: 800, width: 600, height: 450, weight: 18, quantity: 24,
        stackable: true, maxStackLayers: 2, canInvert: false, canLayFlat: true, fragile: false,
        destinationPort: '哥德堡', eta: '2026-09-15', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },

      // ─────────── 汉堡（中件填充） ───────────
      {
        name: '收纳箱（大）',
        length: 600, width: 400, height: 400, weight: 5.0, quantity: 50,
        stackable: true, maxStackLayers: 5, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '汉堡', eta: '2026-09-12', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },
      {
        name: '棉被压缩包',
        length: 600, width: 400, height: 200, weight: 3.5, quantity: 80,
        stackable: true, maxStackLayers: 8, canInvert: true, canLayFlat: true, fragile: false,
        destinationPort: '汉堡', eta: '2026-09-12', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },
      {
        name: '抱枕压缩包',
        length: 500, width: 500, height: 200, weight: 1.5, quantity: 90,
        stackable: true, maxStackLayers: 8, canInvert: true, canLayFlat: true, fragile: false,
        destinationPort: '汉堡', eta: '2026-09-12', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },

      // ─────────── 安特卫普（厨房电器） ───────────
      {
        name: '台式烤箱',
        length: 580, width: 450, height: 420, weight: 14.0, quantity: 40,
        stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: true,
        destinationPort: '安特卫普', eta: '2026-09-08', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },
      {
        name: '微波炉',
        length: 480, width: 380, height: 280, weight: 12.0, quantity: 60,
        stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: true,
        destinationPort: '安特卫普', eta: '2026-09-08', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },
      {
        name: '电饭煲 5L',
        length: 380, width: 380, height: 320, weight: 6.0, quantity: 100,
        stackable: true, maxStackLayers: 4, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '安特卫普', eta: '2026-09-08', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },
      {
        name: '空气炸锅 5.5L',
        length: 420, width: 380, height: 340, weight: 6.2, quantity: 80,
        stackable: true, maxStackLayers: 4, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '安特卫普', eta: '2026-09-08', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },

      // ─────────── 鹿特丹（最近·最后装·最靠门）小件填缝 ───────────
      {
        name: '电热水壶 1.7L',
        length: 280, width: 200, height: 320, weight: 1.8, quantity: 180,
        stackable: true, maxStackLayers: 6, canInvert: false, canLayFlat: false, fragile: false,
        destinationPort: '鹿特丹', eta: '2026-09-05', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },
      {
        name: '玻璃杯套装6只',
        length: 380, width: 280, height: 280, weight: 2.5, quantity: 100,
        stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: true,
        destinationPort: '鹿特丹', eta: '2026-09-05', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      },
      {
        name: '陶瓷装饰摆件',
        length: 350, width: 250, height: 300, weight: 2.0, quantity: 100,
        stackable: true, maxStackLayers: 3, canInvert: false, canLayFlat: false, fragile: true,
        destinationPort: '鹿特丹', eta: '2026-09-05', cyClosing: '2026-08-25',
        customsDeclaration: 'NB202609-FLG'
      }
    ]
  }
];

Page({
  data: {
    // 表单数据
    cargoName: '',
    length: '',
    width: '',
    height: '',
    weight: '',
    quantity: '',
    stackable: true,
    maxStackLayers: '999',
    canInvert: true,
    canLayFlat: true,
    fragile: false,  // 新增:易碎品标记
    
    // 目的港（支持搜索选择 + 自定义输入，算法根据目的港+ETA自动计算LIFO装载顺序）
    eta: '',
    destinationPort: '',
    showPortSearch: false,
    showPortDropdown: false,
    portSearchKeyword: '',
    filteredPorts: [],
    // 宁波港常用航线目的港数据库（含航线顺序，用于自动LIFO计算）
    portDatabase: [
      // 欧洲线（宁波→新加坡→比雷埃夫斯→安特卫普→鹿特丹→汉堡→费利克斯托）
      { name: '新加坡', nameEn: 'Singapore', region: '东南亚', routeOrder: 1 },
      { name: '科伦坡', nameEn: 'Colombo', region: '南亚', routeOrder: 2 },
      { name: '比雷埃夫斯', nameEn: 'Piraeus', region: '地中海', routeOrder: 3 },
      { name: '安特卫普', nameEn: 'Antwerp', region: '欧洲', routeOrder: 4 },
      { name: '鹿特丹', nameEn: 'Rotterdam', region: '欧洲', routeOrder: 5 },
      { name: '汉堡', nameEn: 'Hamburg', region: '欧洲', routeOrder: 6 },
      { name: '费利克斯托', nameEn: 'Felixstowe', region: '欧洲', routeOrder: 7 },
      // 美洲线
      { name: '洛杉矶', nameEn: 'Los Angeles', region: '北美', routeOrder: 8 },
      { name: '长滩', nameEn: 'Long Beach', region: '北美', routeOrder: 9 },
      { name: '纽约', nameEn: 'New York', region: '北美', routeOrder: 10 },
      { name: '萨凡纳', nameEn: 'Savannah', region: '北美', routeOrder: 11 },
      // 亚洲线
      { name: '釜山', nameEn: 'Busan', region: '东亚', routeOrder: 1 },
      { name: '东京', nameEn: 'Tokyo', region: '东亚', routeOrder: 2 },
      { name: '大阪', nameEn: 'Osaka', region: '东亚', routeOrder: 2 },
      { name: '海防', nameEn: 'Hai Phong', region: '东南亚', routeOrder: 1 },
      { name: '胡志明', nameEn: 'Ho Chi Minh', region: '东南亚', routeOrder: 1 },
      { name: '曼谷', nameEn: 'Bangkok', region: '东南亚', routeOrder: 1 },
      { name: '雅加达', nameEn: 'Jakarta', region: '东南亚', routeOrder: 1 },
      // 中东/非洲线
      { name: '吉达', nameEn: 'Jeddah', region: '中东', routeOrder: 3 },
      { name: '迪拜', nameEn: 'Dubai', region: '中东', routeOrder: 4 },
      { name: '达累斯萨拉姆', nameEn: 'Dar es Salaam', region: '非洲', routeOrder: 5 },
      { name: '拉各斯', nameEn: 'Lagos', region: '非洲', routeOrder: 6 },
      // 澳洲线
      { name: '悉尼', nameEn: 'Sydney', region: '大洋洲', routeOrder: 3 },
      { name: '墨尔本', nameEn: 'Melbourne', region: '大洋洲', routeOrder: 4 },
    ],
    cyClosing: '',
    customsDeclaration: '',
    
    // 货物列表
    cargoList: [],
    
    // 编辑模式
    isEditMode: false,
    editingCargoId: null,
    
    // 模板列表
    templateList: [],
    showTemplateModal: false,

    // 演示数据快速导入 (Req 13.1)
    showDemoModal: false,
    demoPresets: DEMO_PRESETS,
    
    // 已选货柜信息
    selectedContainer: null,
    
    // 货物统计信息
    totalQuantity: 0,
    totalWeight: 0,
    
    // 40HQ柜型限制（最大柜型）
    MAX_LENGTH: 12032,
    MAX_WIDTH: 2352,
    MAX_HEIGHT: 2698,
    MAX_WEIGHT: 26000,

    // 自定义 Loading 覆盖层状态 (Req 7.6, 8.3)
    _customLoading: false,
    _customLoadingText: '',
    _customLoadingProgress: false,
    _customLoadingPercent: 0,
    _customLoadingProgressText: ''
  },

  onLoad: function (options) {
    // v31.7: 加载模板列表（合并基础模板和路演旗舰模板）
    const basicTemplates = cargoTemplates.getAllTemplates();
    const flagshipTemplates = roadshowTemplates.getAllRoadshowTemplates();
    
    this.setData({
      templateList: [...flagshipTemplates, ...basicTemplates]
    });
    
    // 加载货物列表
    this.loadCargoList();
    
    // 加载已选货柜信息
    this.loadSelectedContainer();
    
    // 订阅状态变化
    this.storeListener = (state) => {
      this.setData({
        cargoList: state.cargoList
      });
      // 更新统计信息
      this.updateCargoStatistics();
    };
    store.subscribe(this.storeListener);
  },

  onUnload: function () {
    // 取消订阅
    if (this.storeListener) {
      store.unsubscribe(this.storeListener);
    }
  },

  /**
   * 加载货物列表
   */
  loadCargoList: function () {
    const cargoList = store.getState('cargoList');
    this.setData({
      cargoList: cargoList || []
    });
    // 更新统计信息
    this.updateCargoStatistics();
  },

  /**
   * 加载已选货柜信息
   */
  loadSelectedContainer: function () {
    const selectedContainer = store.getState('selectedContainer');
    this.setData({
      selectedContainer: selectedContainer || null
    });
  },

  /**
   * 更新货物统计信息
   */
  updateCargoStatistics: function () {
    const { cargoList } = this.data;
    
    if (!cargoList || cargoList.length === 0) {
      this.setData({
        totalQuantity: 0,
        totalWeight: 0
      });
      return;
    }

    // 计算总件数和总重量
    let totalQuantity = 0;
    let totalWeight = 0;

    cargoList.forEach(cargo => {
      totalQuantity += cargo.quantity;
      totalWeight += cargo.weight * cargo.quantity;
    });

    this.setData({
      totalQuantity: totalQuantity,
      totalWeight: totalWeight.toFixed(2)
    });
  },

  /**
   * 表单输入处理
   */
  onCargoNameInput: function (e) {
    this.setData({ cargoName: e.detail.value });
  },

  onLengthInput: function (e) {
    this.setData({ length: e.detail.value });
  },

  onWidthInput: function (e) {
    this.setData({ width: e.detail.value });
  },

  onHeightInput: function (e) {
    this.setData({ height: e.detail.value });
  },

  onWeightInput: function (e) {
    this.setData({ weight: e.detail.value });
  },

  onQuantityInput: function (e) {
    this.setData({ quantity: e.detail.value });
  },

  /**
   * 堆叠开关切换
   */
  onStackableChange: function (e) {
    this.setData({ stackable: e.detail.value });
  },

  /**
   * 最大堆叠层数输入
   */
  onMaxStackLayersInput: function (e) {
    this.setData({ maxStackLayers: e.detail.value });
  },

  /**
   * 倒置开关切换
   */
  onCanInvertChange: function (e) {
    this.setData({ canInvert: e.detail.value });
  },

  /**
   * 侧放开关切换
   */
  onCanLayFlatChange: function (e) {
    this.setData({ canLayFlat: e.detail.value });
  },

  /**
   * 易碎品开关切换（新增）
   */
  onFragileChange: function (e) {
    this.setData({ fragile: e.detail.value });
  },

  /**
   * v37.1 胶囊式属性切换（点击切换 true/false）
   */
  onToggleStackable: function () {
    this.setData({ stackable: !this.data.stackable });
  },
  onToggleCanInvert: function () {
    this.setData({ canInvert: !this.data.canInvert });
  },
  onToggleCanLayFlat: function () {
    this.setData({ canLayFlat: !this.data.canLayFlat });
  },
  onToggleFragile: function () {
    this.setData({ fragile: !this.data.fragile });
  },

  /**
   * 滚动到表单卡片（点击"+ 新增"卡片时）
   */
  scrollToForm: function () {
    wx.pageScrollTo({
      selector: '#form-card',
      duration: 300,
      offsetTop: -16
    });
  },

  /**
   * ETA日期选择
   */
  onETAChange: function (e) {
    this.setData({ eta: e.detail.value });
  },

  /**
   * 目的港输入（支持搜索匹配）
   */
  onPortSearchInput: function (e) {
    const keyword = e.detail.value.trim();
    this.setData({ destinationPort: keyword, portSearchKeyword: keyword });
    
    // 实时搜索匹配港口
    if (keyword.length > 0) {
      const filtered = this.data.portDatabase.filter(port => 
        port.name.includes(keyword) || 
        port.nameEn.toLowerCase().includes(keyword.toLowerCase()) ||
        port.region.includes(keyword)
      ).slice(0, 6);
      this.setData({ filteredPorts: filtered, showPortDropdown: filtered.length > 0 });
    } else {
      this.setData({ filteredPorts: [], showPortDropdown: false });
    }
  },

  /**
   * 目的港输入框获得焦点 - 显示热门港口
   */
  onPortSearchFocus: function () {
    if (!this.data.destinationPort) {
      const hotPorts = this.data.portDatabase.slice(0, 8);
      this.setData({ filteredPorts: hotPorts, showPortDropdown: true });
    }
  },

  /**
   * 选择推荐港口
   */
  onSelectPort: function (e) {
    const port = e.currentTarget.dataset.port || this.data.filteredPorts[e.currentTarget.dataset.index];
    if (port) {
      this.setData({
        destinationPort: port.name,
        showPortDropdown: false,
        filteredPorts: []
      });
    }
  },

  /**
   * 根据目的港名称获取航线顺序号（用于LIFO计算）
   * 如果港口在数据库中，使用预设的routeOrder
   * 如果是自定义港口，默认给1（算法会根据ETA自动调整）
   */
  _getPortRouteOrder: function (portName) {
    if (!portName) return 1;
    const match = this.data.portDatabase.find(p => 
      p.name === portName || p.nameEn.toLowerCase() === portName.toLowerCase()
    );
    return match ? match.routeOrder : 1;
  },

  /**
   * 截关时间选择
   */
  onCYClosingChange: function (e) {
    this.setData({ cyClosing: e.detail.value });
  },

  /**
   * 报关单号输入
   */
  onCustomsDeclarationInput: function (e) {
    this.setData({ customsDeclaration: e.detail.value });
  },

  /**
   * 添加或更新货物
   * 包含完整的表单验证逻辑
   */
  addCargo: function () {
    console.log('\n' + '='.repeat(60));
    console.log('📦 [货物录入] 开始添加/更新货物');
    console.log('='.repeat(60));
    
    const { 
      cargoName, length, width, height, weight, quantity,
      stackable, maxStackLayers, canInvert, canLayFlat, fragile,
      eta, destinationPort, cyClosing, customsDeclaration,
      MAX_LENGTH, MAX_WIDTH, MAX_HEIGHT, MAX_WEIGHT,
      isEditMode, editingCargoId
    } = this.data;

    console.log('📋 [货物录入] 步骤1: 验证表单数据');
    console.log(`   - 货物名称: ${cargoName || 'N/A'}`);
    console.log(`   - 尺寸: ${length}×${width}×${height} mm`);
    console.log(`   - 重量: ${weight} kg`);
    console.log(`   - 数量: ${quantity}`);
    console.log(`   - ETA: ${eta || 'N/A'}`);
    console.log(`   - 目的港: ${destinationPort || 'N/A'}`);

    // 1. 基础字段验证
    if (!cargoName) {
      console.log('❌ [货物录入] 验证失败: 货物名称为空');
      wx.showToast({ title: '请输入货物名称', icon: 'none' });
      return;
    }

    if (!length || !width || !height || !weight || !quantity) {
      console.log('❌ [货物录入] 验证失败: 货物信息不完整');
      wx.showToast({ title: '请填写完整的货物信息', icon: 'none' });
      return;
    }

    // 宁波港必填字段验证
    if (!eta) {
      console.log('❌ [货物录入] 验证失败: ETA为空');
      wx.showToast({ title: 'ETA（预计到港时间）为必填项', icon: 'none' });
      return;
    }

    console.log('✅ [货物录入] 基础字段验证通过');

    // 2. 数值转换
    console.log('🔄 [货物录入] 步骤2: 转换数值类型');
    const lengthNum = parseFloat(length);
    const widthNum = parseFloat(width);
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    const quantityNum = parseInt(quantity);
    const maxStackLayersNum = parseInt(maxStackLayers);

    console.log(`   - 转换后尺寸: ${lengthNum}×${widthNum}×${heightNum} mm`);
    console.log(`   - 转换后重量: ${weightNum} kg`);
    console.log(`   - 转换后数量: ${quantityNum}`);

    // 3. 负数检查
    console.log('🔍 [货物录入] 步骤3: 检查数值有效性');
    if (lengthNum <= 0 || widthNum <= 0 || heightNum <= 0) {
      console.log('❌ [货物录入] 验证失败: 尺寸包含非正数');
      wx.showToast({ title: '请输入正数', icon: 'none' });
      return;
    }

    if (weightNum <= 0) {
      console.log('❌ [货物录入] 验证失败: 重量为非正数');
      wx.showToast({ title: '请输入正数', icon: 'none' });
      return;
    }

    if (quantityNum <= 0) {
      console.log('❌ [货物录入] 验证失败: 数量为非正数');
      wx.showToast({ title: '请输入正数', icon: 'none' });
      return;
    }

    if (stackable && maxStackLayersNum <= 0) {
      console.log('❌ [货物录入] 验证失败: 最大堆叠层数为非正数');
      wx.showToast({ title: '请输入正数', icon: 'none' });
      return;
    }

    console.log('✅ [货物录入] 数值有效性检查通过');

    // 4. 尺寸限制检查（不能超过40HQ柜型内部尺寸）
    console.log('📏 [货物录入] 步骤4: 检查柜型尺寸限制');
    console.log(`   - 柜型限制: ${MAX_LENGTH}×${MAX_WIDTH}×${MAX_HEIGHT} mm`);
    // 检查货物的任意旋转方向是否能放入柜型
    const dimensions = [lengthNum, widthNum, heightNum].sort((a, b) => b - a);
    const containerDimensions = [MAX_LENGTH, MAX_WIDTH, MAX_HEIGHT].sort((a, b) => b - a);
    
    let canFit = true;
    for (let i = 0; i < 3; i++) {
      if (dimensions[i] > containerDimensions[i]) {
        canFit = false;
        break;
      }
    }
    
    if (!canFit) {
      console.log('❌ [货物录入] 验证失败: 货物尺寸超出柜型限制');
      console.log(`   - 货物尺寸(排序): ${dimensions.join('×')} mm`);
      console.log(`   - 柜型尺寸(排序): ${containerDimensions.join('×')} mm`);
      wx.showToast({ 
        title: '货物尺寸超出最大柜型限制', 
        icon: 'none',
        duration: 2000
      });
      return;
    }

    console.log('✅ [货物录入] 尺寸限制检查通过');

    // 5. 重量限制检查（单件货物不能超过26000kg）
    console.log('⚖️  [货物录入] 步骤5: 检查重量限制');
    if (weightNum > MAX_WEIGHT) {
      console.log(`❌ [货物录入] 验证失败: 重量超限 (${weightNum} > ${MAX_WEIGHT} kg)`);
      wx.showToast({ 
        title: '单件货物重量超出柜型载重限制', 
        icon: 'none',
        duration: 2000
      });
      return;
    }

    console.log('✅ [货物录入] 重量限制检查通过');

    // 6. 创建货物对象
    console.log('📦 [货物录入] 步骤6: 创建货物对象');
    const cargo = {
      name: cargoName,
      length: lengthNum,
      width: widthNum,
      height: heightNum,
      weight: weightNum,
      quantity: quantityNum,
      stackable: stackable,
      maxStackLayers: stackable ? maxStackLayersNum : 999,
      canInvert: canInvert,
      canLayFlat: canLayFlat,
      fragile: fragile,
      // 目的港信息（算法根据目的港+ETA自动计算LIFO装载顺序）
      eta: eta,
      portSequence: this._getPortRouteOrder(destinationPort),
      destinationPort: destinationPort,
      cyClosing: cyClosing || null,
      customsDeclaration: customsDeclaration || null
    };

    console.log('✅ [货物录入] 货物对象创建完成');
    console.log(`   - 货物类型: ${weightNum >= 20 ? '重货' : (fragile ? '易碎品' : '普通货')}`);
    console.log(`   - 可堆叠: ${stackable ? '是' : '否'}`);
    console.log(`   - 可翻转: ${canInvert ? '是' : '否'}`);
    console.log(`   - 可平放: ${canLayFlat ? '是' : '否'}`);

    // 7. 根据模式添加或更新货物
    console.log('💾 [货物录入] 步骤7: 保存货物到本地存储');
    if (isEditMode && editingCargoId) {
      // 更新模式
      console.log(`   - 模式: 更新货物 (ID: ${editingCargoId})`);
      store.updateCargo(editingCargoId, cargo);
      wx.showToast({
        title: '更新成功',
        icon: 'success'
      });
      console.log('✅ [货物录入] 货物更新成功');
    } else {
      // 添加模式
      console.log('   - 模式: 添加新货物');
      store.addCargo(cargo);
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      });
      console.log('✅ [货物录入] 货物添加成功');
    }

    console.log('='.repeat(60));
    console.log('🎉 [货物录入] 货物录入完成');
    console.log('='.repeat(60) + '\n');

    // 8. 清空表单并退出编辑模式
    this.resetForm();
  },

  /**
   * 重置表单
   * 清空所有输入字段并退出编辑模式
   */
  resetForm: function () {
    this.setData({
      cargoName: '',
      length: '',
      width: '',
      height: '',
      weight: '',
      quantity: '',
      stackable: true,
      maxStackLayers: '999',
      canInvert: true,
      canLayFlat: true,
      fragile: false,
      eta: '',
      destinationPort: '',
      showPortDropdown: false,
      filteredPorts: [],
      cyClosing: '',
      customsDeclaration: '',
      isEditMode: false,
      editingCargoId: null
    });
  },

  /**
   * 编辑货物
   * 点击货物项时，将货物信息填充到表单中
   */
  editCargo: function (e) {
    const cargoId = e.currentTarget.dataset.id;
    const cargo = this.data.cargoList.find(item => item.cargoId === cargoId);
    
    if (cargo) {
      // 填充表单数据
      this.setData({
        cargoName: cargo.name,
        length: cargo.length.toString(),
        width: cargo.width.toString(),
        height: cargo.height.toString(),
        weight: cargo.weight.toString(),
        quantity: cargo.quantity.toString(),
        stackable: cargo.stackable,
        maxStackLayers: cargo.maxStackLayers.toString(),
        canInvert: cargo.canInvert,
        canLayFlat: cargo.canLayFlat,
        fragile: cargo.fragile || false,
        eta: cargo.eta || '',
        destinationPort: cargo.destinationPort || '',
        cyClosing: cargo.cyClosing || '',
        customsDeclaration: cargo.customsDeclaration || '',
        isEditMode: true,
        editingCargoId: cargoId
      });

      // 滚动到表单顶部
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });

      wx.showToast({
        title: '进入编辑模式',
        icon: 'none',
        duration: 1500
      });
    }
  },

  /**
   * 取消编辑
   * 清空表单并退出编辑模式
   */
  cancelEdit: function () {
    this.resetForm();
    wx.showToast({
      title: '已取消编辑',
      icon: 'none'
    });
  },

  /**
   * 删除货物
   */
  deleteCargo: function (e) {
    const cargoId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个货物吗？',
      success: (res) => {
        if (res.confirm) {
          store.deleteCargo(cargoId);
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 清空所有货物
   */
  clearAll: function () {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有货物吗？',
      success: (res) => {
        if (res.confirm) {
          store.clearCargoList();
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 导入预设模板
   * v31.7: 支持基础模板和路演旗舰模板
   * 功能：快速导入100分测试模板，直接从本地加载
   * 
   * @param {Object} e - 事件对象，包含data-template属性
   */
  importTemplate: function (e) {
    // 1. 获取模板ID（从按钮的data-template属性）
    const templateId = e.currentTarget.dataset.template;
    
    if (!templateId) {
      wx.showToast({
        title: '模板ID无效',
        icon: 'none'
      });
      return;
    }

    // 2. v31.7: 从两个模板源中查找模板
    let template = roadshowTemplates.getTemplateById(templateId);
    if (!template) {
      template = cargoTemplates.getTemplateById(templateId);
    }
    
    if (!template) {
      wx.showToast({
        title: '模板不存在',
        icon: 'none'
      });
      return;
    }

    // 3. 检查是否已有货物，如果有则提示用户确认
    const currentCargoList = this.data.cargoList;
    
    if (currentCargoList && currentCargoList.length > 0) {
      // 有现有货物，显示确认对话框
      wx.showModal({
        title: '导入模板',
        content: `确定要导入"${template.name}"吗？\n包含${template.cargoList.length}种货物\n\n注意：将清空当前货物列表`,
        confirmText: '清空并导入',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户确认清空，执行导入
            this.executeLocalTemplateImport(template, true);
          }
        }
      });
    } else {
      // 没有现有货物，直接导入
      this.executeLocalTemplateImport(template, false);
    }
  },

  /**
   * 执行本地模板导入操作
   * 直接从本地模板配置导入数据，无需调用后端API
   * 
   * @param {Object} template - 模板对象
   * @param {boolean} clearExisting - 是否清空现有货物
   */
  executeLocalTemplateImport: function (template, clearExisting) {
    // 记录开始时间
    const startTime = Date.now();

    try {
      // 如果需要清空现有货物，先清空
      if (clearExisting) {
        store.clearCargoList();
      }

      // 批量导入货物到本地状态管理
      store.importCargoList(template.cargoList, false);

      // 计算导入耗时
      const elapsedTime = Date.now() - startTime;
      console.log(`模板导入完成，耗时: ${elapsedTime}ms`);

      // 显示成功提示
      wx.showToast({
        title: `已导入${template.cargoList.length}种货物`,
        icon: 'success',
        duration: 2000
      });

      // 如果在编辑模式，退出编辑模式
      if (this.data.isEditMode) {
        this.resetForm();
      }

      console.log('模板导入成功:', template.name);
    } catch (error) {
      console.error('导入模板失败:', error);
      wx.showToast({
        title: '导入失败',
        icon: 'none'
      });
    }
  },

  /**
   * 显示模板选择弹窗
   */
  onShowTemplateModal: function() {
    this.setData({
      showTemplateModal: true
    });
  },

  /**
   * 关闭模板选择弹窗
   */
  onCloseTemplateModal: function() {
    this.setData({
      showTemplateModal: false
    });
  },

  /**
   * 选择模板并导入
   * v31.7: 支持基础模板和路演旗舰模板
   */
  onSelectTemplate: function(e) {
    const templateId = e.currentTarget.dataset.id;
    
    // v31.7: 从两个模板源中查找模板
    let template = roadshowTemplates.getTemplateById(templateId);
    if (!template) {
      template = cargoTemplates.getTemplateById(templateId);
    }
    
    if (!template) {
      wx.showToast({
        title: '模板不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认导入',
      content: `确定要导入"${template.name}"吗？\n包含${template.cargoList.length}种货物\n\n注意：将清空当前货物列表`,
      success: (res) => {
        if (res.confirm) {
          // 导入模板货物（使用importCargoList方法，clearExisting=true清空现有货物）
          store.importCargoList(template.cargoList, true);
          
          // 关闭弹窗
          this.setData({
            showTemplateModal: false
          });
          
          wx.showToast({
            title: `已导入${template.cargoList.length}种货物`,
            icon: 'success',
            duration: 2000
          });
          
          console.log('模板导入成功:', template.name);
        }
      }
    });
  },

  /**
   * 阻止事件冒泡（用于模态框内容区域）
   */
  onStopPropagation: function() {
    // 空函数，仅用于阻止事件冒泡
  },

  /**
   * 显示演示数据快速导入弹窗 (Req 13.1)
   */
  onShowDemoModal: function() {
    this.setData({ showDemoModal: true });
  },

  /**
   * 关闭演示数据弹窗
   */
  onCloseDemoModal: function() {
    this.setData({ showDemoModal: false });
  },

  /**
   * 选择演示数据预设并导入 (Req 13.1)
   * 清空现有货物 → 导入预设 → 保存预录方案(离线降级) → 跳转到 container-select
   */
  onSelectDemoPreset: function(e) {
    const presetId = e.currentTarget.dataset.id;
    const preset = DEMO_PRESETS.find(p => p.id === presetId);

    if (!preset) {
      wx.showToast({ title: '预设不存在', icon: 'none' });
      return;
    }

    // 清空现有货物并导入预设数据
    store.importCargoList(preset.cargoList, true);

    // 离线降级 (Req 13.4)：生成并保存预录装箱方案
    // 断网时 request.js 会自动使用此数据作为 /packing/generate 的降级响应
    try {
      const precomputedPlan = demoPrecomputedPlans.generatePrecomputedPlan(preset.cargoList);
      store.setPrecomputedPlan(precomputedPlan);
      console.log('[Demo] 预录装箱方案已保存，离线降级可用');
    } catch (err) {
      console.warn('[Demo] 预录方案生成失败（不影响正常流程）:', err);
    }

    // 关闭弹窗
    this.setData({ showDemoModal: false });

    // 显示成功提示
    wx.showToast({
      title: `已导入「${preset.name}」`,
      icon: 'success',
      duration: 1500
    });

    console.log('[Demo] 预设数据导入成功:', preset.name, preset.cargoList.length, '种SKU');

    // 导入后停留在当前页面，方便用户查看导入的货物详情后再手动进入下一步
    // （此前会自动跳转到 container-select，已按用户需求移除）
  },

  /**
   * 一键导入演示数据（Demo Mode 快速导入）
   * 加载慈溪家电基准数据集，清空现有货物并跳转到柜型选择
   * Requirements: 13.1, 13.4
   */
  onQuickDemoImport: function () {
    // 使用慈溪家电满载方案作为演示数据集（路演旗舰场景）
    const demoTemplate = roadshowTemplates.getTemplateById('roadshow-cixi-appliances');

    if (!demoTemplate || !demoTemplate.cargoList) {
      wx.showToast({ title: '演示数据加载失败', icon: 'none' });
      return;
    }

    // 清空现有货物并导入演示数据
    store.importCargoList(demoTemplate.cargoList, true);

    // 离线降级 (Req 13.4)：生成并保存预录装箱方案
    try {
      const precomputedPlan = demoPrecomputedPlans.generatePrecomputedPlan(demoTemplate.cargoList);
      store.setPrecomputedPlan(precomputedPlan);
      console.log('[Demo] 快速导入：预录装箱方案已保存');
    } catch (err) {
      console.warn('[Demo] 预录方案生成失败（不影响正常流程）:', err);
    }

    // 显示成功提示
    wx.showToast({
      title: '演示数据已导入',
      icon: 'success',
      duration: 1500
    });

    // 延迟跳转到柜型选择页面，让用户看到 toast
    setTimeout(() => {
      wx.navigateTo({
        url: '/pages/container-select/container-select'
      });
    }, 500);
  },

  /**
   * 生成装箱方案
   * 跳转到装箱结果页面
   */
  generatePackingPlan: function () {
    const { cargoList, selectedContainer } = this.data;

    // 验证是否有货物
    if (!cargoList || cargoList.length === 0) {
      wx.showToast({
        title: '请先添加货物',
        icon: 'none'
      });
      return;
    }

    // 验证是否选择了货柜
    if (!selectedContainer) {
      wx.showToast({
        title: '请先选择货柜类型',
        icon: 'none'
      });
      return;
    }

    // 使用动画工具跳转，确保无白屏闪现 (Req 7.7)
    animations.navigateWithTransition(this, '/pages/packing-result/packing-result');
  },

  /**
   * 跳转到货柜选择页面
   */
  goToContainerSelect: function () {
    animations.navigateWithTransition(this, '/pages/container-select/container-select');
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 页面显示时刷新货柜信息（用户可能从货柜选择页面返回）
    this.loadSelectedContainer();
  },

  /**
   * 生命周期函数--监听页面卸载
   * 清理动画定时器
   */
  onUnload: function () {
    animations.hideCustomLoading(this);
  }
});
