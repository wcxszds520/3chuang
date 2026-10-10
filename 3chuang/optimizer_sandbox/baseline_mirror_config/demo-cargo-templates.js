/**
 * 比赛演示模式 - 5 套基准数据集
 * Demo Mode - 5 Benchmark Datasets
 * 
 * 覆盖：小批量 / 中批量 / 大批量 / 混装 / 慈溪家电
 * Requirements: 13.1
 */

module.exports = {
  // ========================================
  // 数据集 1：小批量（≤50 件，简单场景）
  // ========================================
  smallBatch: {
    name: '小批量基准',
    description: '30件货 | 2种SKU | 简单堆叠场景',
    cargoList: [
      {
        name: '标准纸箱A',
        length: 600,
        width: 400,
        height: 400,
        weight: 20,
        quantity: 20,
        stackable: true,
        maxStackLayers: 4,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: '2026-04-10',
        portSequence: 1,
        cyClosing: '2026-04-05T18:00:00',
        customsDeclaration: 'NB202604-S01'
      },
      {
        name: '标准纸箱B',
        length: 500,
        width: 350,
        height: 300,
        weight: 15,
        quantity: 10,
        stackable: true,
        maxStackLayers: 5,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: '2026-04-10',
        portSequence: 1,
        cyClosing: '2026-04-05T18:00:00',
        customsDeclaration: 'NB202604-S01'
      }
    ]
  },

  // ========================================
  // 数据集 2：中批量（100-300 件，多SKU）
  // ========================================
  mediumBatch: {
    name: '中批量基准',
    description: '270件货 | 3种SKU | 欧基线3批次',
    cargoList: [
      {
        name: '空气炸锅',
        length: 400,
        width: 350,
        height: 300,
        weight: 5.5,
        quantity: 100,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: '2026-04-15',
        portSequence: 3,
        cyClosing: '2026-04-10T18:00:00',
        customsDeclaration: 'NB202604001'
      },
      {
        name: '取暖器',
        length: 500,
        width: 400,
        height: 350,
        weight: 8.0,
        quantity: 80,
        stackable: true,
        maxStackLayers: 2,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: '2026-04-20',
        portSequence: 2,
        cyClosing: '2026-04-13T18:00:00',
        customsDeclaration: 'NB202604001'
      },
      {
        name: '电风扇',
        length: 450,
        width: 380,
        height: 320,
        weight: 6.5,
        quantity: 90,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: false,
        eta: '2026-04-25',
        portSequence: 4,
        cyClosing: '2026-04-20T18:00:00',
        customsDeclaration: 'NB202604001'
      }
    ]
  },

  // ========================================
  // 数据集 3：大批量（>500 件，高密度）
  // ========================================
  largeBatch: {
    name: '大批量基准',
    description: '600件货 | 5种SKU | 3港口LIFO高密度',
    cargoList: [
      {
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
      {
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
      {
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
    ]
  },

  // ========================================
  // 数据集 4：混装（重货+轻货+易碎品，约束复杂）
  // ========================================
  mixedCargo: {
    name: '混装基准',
    description: '69件货 | 7种SKU | 重货+易碎品硬约束',
    cargoList: [
      {
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
      {
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
      {
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
    ]
  },

  // ========================================
  // 数据集 5：慈溪家电（宁波本地特色，高利用率目标）
  // ========================================
  cixiAppliances: {
    name: '慈溪家电基准',
    description: '587件货 | 7种SKU | 慈溪小家电满载方案',
    cargoList: [
      {
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
      {
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
      {
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
    ]
  },

  /**
   * 获取所有基准数据集列表
   * @returns {Array} 数据集列表
   */
  getAllBenchmarks: function() {
    return [
      { id: 'smallBatch', ...this.smallBatch },
      { id: 'mediumBatch', ...this.mediumBatch },
      { id: 'largeBatch', ...this.largeBatch },
      { id: 'mixedCargo', ...this.mixedCargo },
      { id: 'cixiAppliances', ...this.cixiAppliances }
    ];
  },

  /**
   * 根据 ID 获取数据集
   * @param {string} id - 数据集 ID
   * @returns {Object|null} 数据集对象
   */
  getById: function(id) {
    return this[id] || null;
  }
};
