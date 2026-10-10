/**
 * 甬柜易算 - 路演级旗舰货物模板
 * Roadshow-Grade Flagship Cargo Templates
 * 
 * 宁波港实战验证模板 - 四大金牌场景
 * Battle-Tested Templates from Ningbo Port - 4 Gold Scenarios
 * 
 * v32.0: Synced with backend test-gold-standard.js
 */

// 场景A：慈溪家电高密度挑战 (282件货物，>82%利用率目标)
const cixiAppliancesHighDensity = [
  // 批次3：北仑港 (最晚到港，最内侧) - 12x Industrial Crate
  {
    cargoId: 'gold_crate_001',
    name: '工业木箱',
    length: 1200,
    width: 1000,
    height: 1200,
    weight: 120,
    quantity: 12,
    stackable: false,
    maxStackLayers: 1,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    packagingType: 'wooden',
    eta: '2026-03-20',
    portSequence: 3,
    cyClosing: '2026-03-15T18:00:00',
    customsDeclaration: 'NB202603003',
    sku: 'Industrial_Crate',
    batchId: 'batch_3'
  },
  
  // 批次2：慈溪港 (中间到港) - 40x Air Fryer
  {
    cargoId: 'gold_fryer_002',
    name: '空气炸锅',
    length: 600,
    width: 400,
    height: 500,
    weight: 15,
    quantity: 40,
    stackable: true,
    maxStackLayers: 4,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    packagingType: 'carton',
    eta: '2026-03-15',
    portSequence: 2,
    cyClosing: '2026-03-10T18:00:00',
    customsDeclaration: 'NB202603002',
    sku: 'Air_Fryer',
    batchId: 'batch_2'
  },
  
  // 批次1：宁波港 (最早到港，箱门端) - 80x Kettle
  {
    cargoId: 'gold_kettle_003',
    name: '电水壶',
    length: 300,
    width: 300,
    height: 250,
    weight: 5,
    quantity: 80,
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    packagingType: 'carton',
    eta: '2026-03-10',
    portSequence: 1,
    cyClosing: '2026-03-05T18:00:00',
    customsDeclaration: 'NB202603001',
    sku: 'Kettle',
    batchId: 'batch_1'
  },
  
  // 批次1：宁波港 (最早到港，箱门端) - 150x Mug (易碎)
  {
    cargoId: 'gold_mug_004',
    name: '马克杯',
    length: 200,
    width: 150,
    height: 150,
    weight: 0.5,
    quantity: 150,
    stackable: true,
    maxStackLayers: 3,
    canInvert: false,
    canLayFlat: false,
    fragile: true,
    packagingType: 'carton',
    eta: '2026-03-10',
    portSequence: 1,
    cyClosing: '2026-03-05T18:00:00',
    customsDeclaration: 'NB202603001',
    sku: 'Mug',
    batchId: 'batch_1'
  }
];

// 场景B：北仑汽配安全平衡 (508件货物，<3%横向偏移目标)
const beilunAutoPartsSafetyBalance = [
  // 批次3：舟山港 (最晚到港，最内侧) - 8x Heavy Steel Mold (800kg)
  {
    cargoId: 'gold_mold_001',
    name: '钢制模具',
    length: 2000,
    width: 1200,
    height: 1000,
    weight: 800,
    quantity: 8,
    stackable: false,
    maxStackLayers: 1,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    packagingType: 'wooden',
    eta: '2026-03-22',
    portSequence: 3,
    cyClosing: '2026-03-17T18:00:00',
    customsDeclaration: 'NB202603012',
    sku: 'Steel_Mold',
    batchId: 'batch_3'
  },
  
  // 批次2：北仑港 (中间到港) - 100x Shock Absorber
  {
    cargoId: 'gold_shock_002',
    name: '减震器',
    length: 800,
    width: 400,
    height: 400,
    weight: 25,
    quantity: 100,
    stackable: true,
    maxStackLayers: 4,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    packagingType: 'carton',
    eta: '2026-03-17',
    portSequence: 2,
    cyClosing: '2026-03-12T18:00:00',
    customsDeclaration: 'NB202603011',
    sku: 'Shock_Absorber',
    batchId: 'batch_2'
  },
  
  // 批次1：宁波港 (最早到港，箱门端) - 400x Interior Trim
  {
    cargoId: 'gold_trim_003',
    name: '内饰件',
    length: 400,
    width: 300,
    height: 200,
    weight: 1,
    quantity: 400,
    stackable: true,
    maxStackLayers: 6,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    packagingType: 'carton',
    eta: '2026-03-12',
    portSequence: 1,
    cyClosing: '2026-03-07T18:00:00',
    customsDeclaration: 'NB202603010',
    sku: 'Interior_Trim',
    batchId: 'batch_1'
  }
];

// 场景C (原有)：慈溪家电满载方案 (587件货物，85%利用率)
const cixiAppliancesFullLoad = [
  // 批次1：宁波港 (最早到港，箱门端)
  {
    cargoId: 'roadshow_fridge_001',
    name: '小型冷柜',
    length: 600,
    width: 550,
    height: 850,
    weight: 45,
    quantity: 80,
    stackable: true,
    maxStackLayers: 2,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-10',
    portSequence: 1,
    cyClosing: '2026-03-05T18:00:00',
    customsDeclaration: 'NB202603001'
  },
  {
    cargoId: 'roadshow_fryer_002',
    name: '空气炸锅',
    length: 400,
    width: 350,
    height: 300,
    weight: 5,
    quantity: 150,
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-10',
    portSequence: 1,
    cyClosing: '2026-03-05T18:00:00',
    customsDeclaration: 'NB202603001'
  },
  {
    cargoId: 'roadshow_kettle_003',
    name: '电水壶',
    length: 300,
    width: 250,
    height: 250,
    weight: 2,
    quantity: 120,
    stackable: true,
    maxStackLayers: 6,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-10',
    portSequence: 1,
    cyClosing: '2026-03-05T18:00:00',
    customsDeclaration: 'NB202603001'
  },
  {
    cargoId: 'roadshow_mug_004',
    name: '马克杯',
    length: 250,
    width: 250,
    height: 150,
    weight: 0.5,
    quantity: 80,
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: false,
    fragile: true,
    eta: '2026-03-10',
    portSequence: 1,
    cyClosing: '2026-03-05T18:00:00',
    customsDeclaration: 'NB202603001'
  },
  
  // 批次2：慈溪港 (中间到港)
  {
    cargoId: 'roadshow_heater_005',
    name: '取暖器',
    length: 450,
    width: 350,
    height: 300,
    weight: 25,
    quantity: 50,
    stackable: true,
    maxStackLayers: 4,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-15',
    portSequence: 2,
    cyClosing: '2026-03-10T18:00:00',
    customsDeclaration: 'NB202603002'
  },
  {
    cargoId: 'roadshow_cooker_006',
    name: '电饭煲',
    length: 400,
    width: 350,
    height: 300,
    weight: 4,
    quantity: 70,
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-15',
    portSequence: 2,
    cyClosing: '2026-03-10T18:00:00',
    customsDeclaration: 'NB202603002'
  },
  
  // 批次3：北仑港 (最晚到港，最内侧)
  {
    cargoId: 'roadshow_washer_007',
    name: '洗衣机',
    length: 500,
    width: 500,
    height: 700,
    weight: 30,
    quantity: 37,
    stackable: true,
    maxStackLayers: 3,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-20',
    portSequence: 3,
    cyClosing: '2026-03-15T18:00:00',
    customsDeclaration: 'NB202603003'
  }
];

// 场景B：北仑重型汽配方案 (310件货物，1.5% CoG偏移稳定性)
const beilunHeavyAutoParts = [
  // 批次1：宁波港 (最早到港)
  {
    cargoId: 'roadshow_steel_mold_001',
    name: '钢制模具',
    length: 1200,
    width: 800,
    height: 600,
    weight: 1200,
    quantity: 8,
    stackable: false,
    maxStackLayers: 1,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-12',
    portSequence: 1,
    cyClosing: '2026-03-07T18:00:00',
    customsDeclaration: 'NB202603010'
  },
  {
    cargoId: 'roadshow_engine_block_002',
    name: '发动机缸体',
    length: 800,
    width: 600,
    height: 500,
    weight: 180,
    quantity: 25,
    stackable: true,
    maxStackLayers: 2,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-12',
    portSequence: 1,
    cyClosing: '2026-03-07T18:00:00',
    customsDeclaration: 'NB202603010'
  },
  {
    cargoId: 'roadshow_brake_disc_003',
    name: '刹车盘',
    length: 400,
    width: 400,
    height: 100,
    weight: 15,
    quantity: 120,
    stackable: true,
    maxStackLayers: 10,
    canInvert: false,
    canLayFlat: true,
    fragile: false,
    eta: '2026-03-12',
    portSequence: 1,
    cyClosing: '2026-03-07T18:00:00',
    customsDeclaration: 'NB202603010'
  },
  
  // 批次2：北仑港 (中间到港)
  {
    cargoId: 'roadshow_transmission_004',
    name: '变速箱',
    length: 700,
    width: 500,
    height: 450,
    weight: 90,
    quantity: 40,
    stackable: true,
    maxStackLayers: 2,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-17',
    portSequence: 2,
    cyClosing: '2026-03-12T18:00:00',
    customsDeclaration: 'NB202603011'
  },
  {
    cargoId: 'roadshow_axle_005',
    name: '车轴',
    length: 1500,
    width: 200,
    height: 200,
    weight: 50,
    quantity: 60,
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: true,
    fragile: false,
    eta: '2026-03-17',
    portSequence: 2,
    cyClosing: '2026-03-12T18:00:00',
    customsDeclaration: 'NB202603011'
  },
  
  // 批次3：舟山港 (最晚到港)
  {
    cargoId: 'roadshow_wheel_006',
    name: '轮毂',
    length: 500,
    width: 500,
    height: 250,
    weight: 20,
    quantity: 57,
    stackable: true,
    maxStackLayers: 6,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-22',
    portSequence: 3,
    cyClosing: '2026-03-17T18:00:00',
    customsDeclaration: 'NB202603012'
  }
];

// 场景C：多站点LIFO方案 (600件货物，3个港口顺序，绝对物理隔离)
const multiPortLIFOPlan = [
  // 批次1：宁波港 (最早到港，箱门端)
  {
    cargoId: 'roadshow_textile_001',
    name: '纺织品箱',
    length: 600,
    width: 400,
    height: 400,
    weight: 15,
    quantity: 180,
    stackable: true,
    maxStackLayers: 4,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-08',
    portSequence: 1,
    cyClosing: '2026-03-03T18:00:00',
    customsDeclaration: 'NB202603020'
  },
  {
    cargoId: 'roadshow_shoes_002',
    name: '鞋盒',
    length: 350,
    width: 250,
    height: 150,
    weight: 2,
    quantity: 200,
    stackable: true,
    maxStackLayers: 8,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-08',
    portSequence: 1,
    cyClosing: '2026-03-03T18:00:00',
    customsDeclaration: 'NB202603020'
  },
  
  // 批次2：慈溪港 (中间到港)
  {
    cargoId: 'roadshow_plastic_003',
    name: '塑料制品',
    length: 500,
    width: 400,
    height: 300,
    weight: 8,
    quantity: 120,
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-13',
    portSequence: 2,
    cyClosing: '2026-03-08T18:00:00',
    customsDeclaration: 'NB202603021'
  },
  {
    cargoId: 'roadshow_toy_004',
    name: '玩具箱',
    length: 400,
    width: 300,
    height: 250,
    weight: 5,
    quantity: 80,
    stackable: true,
    maxStackLayers: 6,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-13',
    portSequence: 2,
    cyClosing: '2026-03-08T18:00:00',
    customsDeclaration: 'NB202603021'
  },
  
  // 批次3：北仑港 (最晚到港，最内侧)
  {
    cargoId: 'roadshow_hardware_005',
    name: '五金工具',
    length: 450,
    width: 350,
    height: 280,
    weight: 12,
    quantity: 20,
    stackable: true,
    maxStackLayers: 4,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-18',
    portSequence: 3,
    cyClosing: '2026-03-13T18:00:00',
    customsDeclaration: 'NB202603022'
  }
];

// 场景D：跨国搬家方案 (钢琴+易碎品硬约束验证)
const internationalMovingPlan = [
  // 批次1：宁波港 (最早到港，箱门端)
  {
    cargoId: 'roadshow_piano_001',
    name: '立式钢琴',
    length: 1500,
    width: 600,
    height: 1200,
    weight: 250,
    quantity: 2,
    stackable: false,
    maxStackLayers: 1,
    canInvert: false,
    canLayFlat: false,
    fragile: true,
    eta: '2026-03-08',
    portSequence: 1,
    cyClosing: '2026-03-03T18:00:00',
    customsDeclaration: 'NB202603030'
  },
  {
    cargoId: 'roadshow_crystal_002',
    name: '水晶吊灯',
    length: 800,
    width: 800,
    height: 1000,
    weight: 45,
    quantity: 3,
    stackable: false,
    maxStackLayers: 1,
    canInvert: false,
    canLayFlat: false,
    fragile: true,
    eta: '2026-03-08',
    portSequence: 1,
    cyClosing: '2026-03-03T18:00:00',
    customsDeclaration: 'NB202603030'
  },
  {
    cargoId: 'roadshow_painting_003',
    name: '油画框',
    length: 1200,
    width: 100,
    height: 900,
    weight: 15,
    quantity: 8,
    stackable: false,
    maxStackLayers: 1,
    canInvert: false,
    canLayFlat: true,
    fragile: true,
    eta: '2026-03-08',
    portSequence: 1,
    cyClosing: '2026-03-03T18:00:00',
    customsDeclaration: 'NB202603030'
  },
  
  // 批次2：慈溪港 (中间到港)
  {
    cargoId: 'roadshow_sofa_004',
    name: '真皮沙发',
    length: 2000,
    width: 900,
    height: 800,
    weight: 120,
    quantity: 2,
    stackable: false,
    maxStackLayers: 1,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-13',
    portSequence: 2,
    cyClosing: '2026-03-08T18:00:00',
    customsDeclaration: 'NB202603031'
  },
  {
    cargoId: 'roadshow_wardrobe_005',
    name: '实木衣柜',
    length: 1800,
    width: 600,
    height: 2000,
    weight: 180,
    quantity: 2,
    stackable: false,
    maxStackLayers: 1,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-13',
    portSequence: 2,
    cyClosing: '2026-03-08T18:00:00',
    customsDeclaration: 'NB202603031'
  },
  {
    cargoId: 'roadshow_mattress_006',
    name: '乳胶床垫',
    length: 2000,
    width: 1800,
    height: 300,
    weight: 50,
    quantity: 2,
    stackable: true,
    maxStackLayers: 3,
    canInvert: false,
    canLayFlat: true,
    fragile: false,
    eta: '2026-03-13',
    portSequence: 2,
    cyClosing: '2026-03-08T18:00:00',
    customsDeclaration: 'NB202603031'
  },
  
  // 批次3：北仑港 (最晚到港，最内侧)
  {
    cargoId: 'roadshow_box_007',
    name: '搬家纸箱',
    length: 600,
    width: 400,
    height: 400,
    weight: 20,
    quantity: 50,
    stackable: true,
    maxStackLayers: 5,
    canInvert: false,
    canLayFlat: false,
    fragile: false,
    eta: '2026-03-18',
    portSequence: 3,
    cyClosing: '2026-03-13T18:00:00',
    customsDeclaration: 'NB202603032'
  }
];

// 导出模板
module.exports = {
  // 场景A：慈溪家电高密度挑战 (Gold Standard Test Suite)
  'gold-scenario-a-20gp-high-density': {
    name: '【场景A】慈溪家电高密度挑战',
    description: '282件货 | >82%利用率目标 | 工业木箱+炸锅+水壶+杯子 | 20GP旗舰测试',
    route: '宁波港→慈溪港→北仑港',
    cargoList: cixiAppliancesHighDensity,
    expectedUtilization: 82,
    expectedCogOffset: 3.0,
    containerType: '20GP',
    tags: ['路演', '高利用率', '家电', 'Gold Standard']
  },
  
  // 场景B：北仑汽配安全平衡 (Gold Standard Test Suite)
  'gold-scenario-b-40hq-safety-balance': {
    name: '【场景B】北仑汽配安全平衡',
    description: '508件货 | <3% CoG偏移目标 | 含800kg钢模 | 40HQ稳定性标杆',
    route: '宁波港→北仑港→舟山港',
    cargoList: beilunAutoPartsSafetyBalance,
    expectedUtilization: 75,
    expectedCogOffset: 3.0,
    containerType: '40HQ',
    tags: ['路演', '重货', '汽配', '稳定性', 'Gold Standard']
  },
  
  // 场景C (原有)：慈溪家电满载方案
  'roadshow-cixi-appliances': {
    name: '【场景C】慈溪家电满载方案',
    description: '587件货 | 85%利用率 | 冷柜+炸锅+水壶+杯子 | 路演旗舰',
    route: '宁波港→慈溪港→北仑港',
    cargoList: cixiAppliancesFullLoad,
    expectedUtilization: 85,
    expectedCogOffset: 3.2,
    tags: ['路演', '高利用率', '家电']
  },
  
  // 场景D (原有)：北仑重型汽配方案
  'roadshow-beilun-autoparts': {
    name: '【场景D】北仑重型汽配方案',
    description: '310件货 | 1.5% CoG偏移 | 含1.2吨钢模 | 稳定性标杆',
    route: '宁波港→北仑港→舟山港',
    cargoList: beilunHeavyAutoParts,
    expectedUtilization: 78,
    expectedCogOffset: 1.5,
    tags: ['路演', '重货', '汽配', '稳定性']
  },
  
  // 场景E (原有)：多站点LIFO方案
  'roadshow-multiport-lifo': {
    name: '【场景E】多站点LIFO方案',
    description: '600件货 | 3个港口 | 绝对物理隔离 | LIFO完美演示',
    route: '宁波港→慈溪港→北仑港',
    cargoList: multiPortLIFOPlan,
    expectedUtilization: 82,
    expectedCogOffset: 2.8,
    tags: ['路演', 'LIFO', '多站点']
  },
  
  // 场景F (原有)：跨国搬家方案
  'roadshow-international-moving': {
    name: '【场景F】跨国搬家方案',
    description: '69件货 | 钢琴+易碎品 | 硬约束验证 | 高端场景',
    route: '宁波港→慈溪港→北仑港',
    cargoList: internationalMovingPlan,
    expectedUtilization: 65,
    expectedCogOffset: 4.5,
    tags: ['路演', '易碎品', '硬约束', '高端']
  },
  
  // 获取所有路演模板列表
  getAllRoadshowTemplates: function() {
    return [
      { id: 'roadshow-cixi-appliances', ...this['roadshow-cixi-appliances'] },
      { id: 'roadshow-beilun-autoparts', ...this['roadshow-beilun-autoparts'] },
      { id: 'roadshow-multiport-lifo', ...this['roadshow-multiport-lifo'] },
      { id: 'roadshow-international-moving', ...this['roadshow-international-moving'] }
    ];
  },
  
  // 根据ID获取模板
  getTemplateById: function(id) {
    return this[id] || null;
  }
};
