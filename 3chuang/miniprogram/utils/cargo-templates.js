/**
 * 货物模板配置
 * 用于快速导入预设货物数据
 * 
 * 宁波港热门货型预设模板
 * 每个模板包含多种货物，展示算法的完整能力
 */

/**
 * 货物模板配置
 * 用于快速导入预设货物数据
 * 
 * 宁波港热门货型预设模板
 * 每个模板包含多种货物，展示算法的完整能力
 * 
 * 设计原则：
 * 1. 货物数量和尺寸适配20GP/40HQ柜型
 * 2. 包含重货、普通货、易碎品，展示完整算法能力
 * 3. 3个批次，符合LIFO规则
 * 4. 真实业务场景，符合宁波港实际出口货型
 */

// 模板1：小家电出口（经典场景）- 适配20GP/40HQ柜型
const appliancesTemplate = [
  // 批次1（最早到港，箱门端）
  {
    cargoId: 'template_fryer_001',
    name: '空气炸锅',
    length: 400,
    width: 350,
    height: 300,
    weight: 5,
    quantity: 25,  // 减少数量，适配20GP
    stackable: true,
    maxStackLayers: 4,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-04-15',
    portSequence: 1,
    cyClosing: '2026-04-10T18:00:00',
    customsDeclaration: 'NB202604001'
  },
  {
    cargoId: 'template_kettle_002',
    name: '电水壶',
    length: 300,
    width: 250,
    height: 250,
    weight: 2,
    quantity: 180,  // 减少数量
    stackable: true,
    maxStackLayers: 6,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-04-15',
    portSequence: 1,
    cyClosing: '2026-04-10T18:00:00',
    customsDeclaration: 'NB202604001'
  },
  {
    cargoId: 'template_mug_003',
    name: '马克杯',
    length: 250,
    width: 250,
    height: 150,
    weight: 0.5,
    quantity: 80,  // 减少数量
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: false,
    fragile: true,  // 易碎品
    eta: '2026-04-15',
    portSequence: 1,
    cyClosing: '2026-04-10T18:00:00',
    customsDeclaration: 'NB202604001'
  },
  // 批次2（中间到港）
  {
    cargoId: 'template_heater_004',
    name: '取暖器',
    length: 450,
    width: 350,
    height: 300,
    weight: 25,  // 重货
    quantity: 15,  // 减少数量
    stackable: true,
    maxStackLayers: 4,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-04-20',
    portSequence: 2,
    cyClosing: '2026-04-15T18:00:00',
    customsDeclaration: 'NB202604002'
  },
  {
    cargoId: 'template_cooker_005',
    name: '电饭煲',
    length: 400,
    width: 350,
    height: 300,
    weight: 4,
    quantity: 100,  // 减少数量
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-04-20',
    portSequence: 2,
    cyClosing: '2026-04-15T18:00:00',
    customsDeclaration: 'NB202604002'
  },
  {
    cargoId: 'template_bowl_006',
    name: '陶瓷碗',
    length: 350,
    width: 350,
    height: 200,
    weight: 1,
    quantity: 30,  // 减少数量
    stackable: true,
    maxStackLayers: 4,
    canInvert: false,
    canLayFlat: false,
    fragile: true,  // 易碎品
    eta: '2026-04-20',
    portSequence: 2,
    cyClosing: '2026-04-15T18:00:00',
    customsDeclaration: 'NB202604002'
  },
  // 批次3（最晚到港，最内侧）
  {
    cargoId: 'template_washer_007',
    name: '洗衣机',
    length: 500,
    width: 500,
    height: 700,  // 减小高度，适配20GP
    weight: 30,  // 重货
    quantity: 12,  // 减少数量
    stackable: true,
    maxStackLayers: 3,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-04-25',
    portSequence: 3,
    cyClosing: '2026-04-20T18:00:00',
    customsDeclaration: 'NB202604003'
  },
  {
    cargoId: 'template_fan_008',
    name: '电风扇',
    length: 450,
    width: 380,
    height: 320,
    weight: 3,
    quantity: 120,  // 减少数量
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-04-25',
    portSequence: 3,
    cyClosing: '2026-04-20T18:00:00',
    customsDeclaration: 'NB202604003'
  },
  {
    cargoId: 'template_glass_009',
    name: '玻璃杯',
    length: 300,
    width: 300,
    height: 200,
    weight: 1,
    quantity: 25,  // 减少数量
    stackable: true,
    maxStackLayers: 3,
    canInvert: false,
    canLayFlat: false,
    fragile: true,  // 易碎品
    eta: '2026-04-25',
    portSequence: 3,
    cyClosing: '2026-04-20T18:00:00',
    customsDeclaration: 'NB202604003'
  }
];

// 模板2：家居用品（混合场景）
const furnitureTemplate = [
  // 批次1（最早到港）
  {
    cargoId: 'template_chair_001',
    name: '折叠椅',
    length: 800,
    width: 450,
    height: 100,
    weight: 8,
    quantity: 80,
    stackable: true,
    maxStackLayers: 10,
    canInvert: false,
    canLayFlat: true,
    fragile: false,
    eta: '2026-04-12',
    portSequence: 1,
    cyClosing: '2026-04-07T18:00:00',
    customsDeclaration: 'NB202604010'
  },
  {
    cargoId: 'template_lamp_002',
    name: '台灯',
    length: 350,
    width: 300,
    height: 450,
    weight: 3,
    quantity: 100,
    stackable: true,
    maxStackLayers: 4,
    canInvert: false,
    canLayFlat: false,
    fragile: true,  // 易碎品
    eta: '2026-04-12',
    portSequence: 1,
    cyClosing: '2026-04-07T18:00:00',
    customsDeclaration: 'NB202604010'
  },
  // 批次2（中间到港）
  {
    cargoId: 'template_table_003',
    name: '小茶几',
    length: 900,
    width: 600,
    height: 400,
    weight: 22,  // 重货
    quantity: 25,
    stackable: true,
    maxStackLayers: 2,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-04-18',
    portSequence: 2,
    cyClosing: '2026-04-13T18:00:00',
    customsDeclaration: 'NB202604011'
  },
  {
    cargoId: 'template_cushion_004',
    name: '靠垫',
    length: 500,
    width: 500,
    height: 200,
    weight: 1.5,
    quantity: 200,
    stackable: true,
    maxStackLayers: 8,
    canInvert: true,
    canLayFlat: true,
    fragile: false,
    eta: '2026-04-18',
    portSequence: 2,
    cyClosing: '2026-04-13T18:00:00',
    customsDeclaration: 'NB202604011'
  },
  {
    cargoId: 'template_vase_005',
    name: '陶瓷花瓶',
    length: 300,
    width: 300,
    height: 400,
    weight: 2,
    quantity: 60,
    stackable: true,
    maxStackLayers: 3,
    canInvert: false,
    canLayFlat: false,
    fragile: true,  // 易碎品
    eta: '2026-04-18',
    portSequence: 2,
    cyClosing: '2026-04-13T18:00:00',
    customsDeclaration: 'NB202604011'
  },
  // 批次3（最晚到港）
  {
    cargoId: 'template_bookshelf_006',
    name: '书架',
    length: 800,
    width: 350,
    height: 1200,
    weight: 28,  // 重货
    quantity: 18,
    stackable: false,
    maxStackLayers: 1,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-04-23',
    portSequence: 3,
    cyClosing: '2026-04-18T18:00:00',
    customsDeclaration: 'NB202604012'
  },
  {
    cargoId: 'template_mirror_007',
    name: '装饰镜',
    length: 600,
    width: 50,
    height: 800,
    weight: 5,
    quantity: 40,
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: true,
    fragile: true,  // 易碎品
    eta: '2026-04-23',
    portSequence: 3,
    cyClosing: '2026-04-18T18:00:00',
    customsDeclaration: 'NB202604012'
  }
];

// 模板3：电子产品（高价值场景）
const electronicsTemplate = [
  // 批次1（最早到港）
  {
    cargoId: 'template_laptop_001',
    name: '笔记本电脑',
    length: 350,
    width: 280,
    height: 50,
    weight: 2.5,
    quantity: 150,
    stackable: true,
    maxStackLayers: 10,
    canInvert: false,
    canLayFlat: true,
    fragile: true,  // 易碎品
    eta: '2026-05-01',
    portSequence: 1,
    cyClosing: '2026-04-26T18:00:00',
    customsDeclaration: 'NB202605001'
  },
  {
    cargoId: 'template_keyboard_002',
    name: '机械键盘',
    length: 450,
    width: 150,
    height: 50,
    weight: 1.2,
    quantity: 200,
    stackable: true,
    maxStackLayers: 15,
    canInvert: false,
    canLayFlat: true,
    fragile: false,
    eta: '2026-05-01',
    portSequence: 1,
    cyClosing: '2026-04-26T18:00:00',
    customsDeclaration: 'NB202605001'
  },
  // 批次2（中间到港）
  {
    cargoId: 'template_monitor_003',
    name: '显示器',
    length: 600,
    width: 450,
    height: 100,
    weight: 8,
    quantity: 100,
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: false,
    fragile: true,  // 易碎品
    eta: '2026-05-05',
    portSequence: 2,
    cyClosing: '2026-04-30T18:00:00',
    customsDeclaration: 'NB202605002'
  },
  {
    cargoId: 'template_printer_004',
    name: '打印机',
    length: 500,
    width: 400,
    height: 350,
    weight: 12,
    quantity: 60,
    stackable: true,
    maxStackLayers: 3,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-05-05',
    portSequence: 2,
    cyClosing: '2026-04-30T18:00:00',
    customsDeclaration: 'NB202605002'
  },
  // 批次3（最晚到港）
  {
    cargoId: 'template_server_005',
    name: '服务器主机',
    length: 600,
    width: 500,
    height: 800,
    weight: 35,  // 重货
    quantity: 12,
    stackable: true,
    maxStackLayers: 2,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-05-10',
    portSequence: 3,
    cyClosing: '2026-05-05T18:00:00',
    customsDeclaration: 'NB202605003'
  },
  {
    cargoId: 'template_router_006',
    name: '路由器',
    length: 300,
    width: 200,
    height: 80,
    weight: 0.8,
    quantity: 300,
    stackable: true,
    maxStackLayers: 12,
    canInvert: false,
    canLayFlat: true,
    fragile: false,
    eta: '2026-05-10',
    portSequence: 3,
    cyClosing: '2026-05-05T18:00:00',
    customsDeclaration: 'NB202605003'
  }
];

// 导出模板
module.exports = {
  // 模板1：小家电出口（经典场景）
  'appliances': {
    name: '小家电出口',
    description: '9种货物 | 587件 | 3批次 | 含重货+易碎品 | 展示完整算法能力',
    route: '宁波港热门货型',
    cargoList: appliancesTemplate
  },
  
  // 模板2：家居用品（混合场景）
  'furniture': {
    name: '家居用品',
    description: '7种货物 | 3个批次 | 含不可堆叠+易碎品 | 复杂约束场景',
    route: '宁波港热门货型',
    cargoList: furnitureTemplate
  },
  
  // 模板3：电子产品（高价值场景）
  'electronics': {
    name: '电子产品',
    description: '6种货物 | 3个批次 | 高价值易碎品 | 精细化装载',
    route: '宁波港热门货型',
    cargoList: electronicsTemplate
  },
  
  // 获取所有模板列表
  getAllTemplates: function() {
    return [
      { id: 'appliances', ...this.appliances },
      { id: 'furniture', ...this.furniture },
      { id: 'electronics', ...this.electronics }
    ];
  },
  
  // 根据ID获取模板
  getTemplateById: function(id) {
    return this[id] || null;
  }
};
