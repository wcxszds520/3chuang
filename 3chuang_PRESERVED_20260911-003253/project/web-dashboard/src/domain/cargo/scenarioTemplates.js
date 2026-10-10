import { createCargoId } from './cargo.js';
import { INITIAL_CARGO, INITIAL_ORDER } from './initialDataset.js';
import { WORKSITE_DEMO } from './worksiteDemo.js';

const HAMBURG = Object.freeze({ destinationPort: 'Hamburg', eta: '2026-07-18', portSequence: 1, dangerous: false, canRotate: true, canInvert: false });
const ROTTERDAM = Object.freeze({ destinationPort: 'Rotterdam', eta: '2026-07-20', portSequence: 2, dangerous: false, canRotate: true, canInvert: false });
const ANTWERP = Object.freeze({ destinationPort: 'Antwerp', eta: '2026-07-22', portSequence: 3, dangerous: false, canRotate: true, canInvert: false });

function item(name, sku, l, w, h, weight, qty, extra = {}) {
  return {
    name, sku, length: l, width: w, height: h, weight, quantity: qty,
    packagingType: extra.packagingType || 'carton',
    stackable: extra.stackable !== undefined ? extra.stackable : true,
    maxStackLayers: extra.maxStackLayers || 5,
    canLayFlat: extra.canLayFlat !== undefined ? extra.canLayFlat : true,
    fragile: extra.fragile || false,
    heavy: extra.heavy || weight >= 20,
    wooden: extra.wooden || false,
    canRotate: extra.canRotate !== undefined ? extra.canRotate : true,
    canInvert: extra.canInvert || false,
    dangerous: extra.dangerous || false,
    riskNotes: extra.riskNotes || [],
    ...extra
  };
}

export const SCENARIO_TEMPLATES = Object.freeze([
  WORKSITE_DEMO,
  Object.freeze({
    id: 'competition-a',
    label: '原始212件 · 高密度约束案例',
    description: '212 件高密度约束案例，保留用于装箱与港序复核；部分高位货物和叉孔条件尚不支持现场作业回放。',
    orderNo: INITIAL_ORDER.orderNo,
    containerType: '40HQ',
    preserveCargoIds: true,
    dataClassification: 'DEMO_DATA',
    route: ['Ningbo', 'Hamburg', 'Rotterdam', 'Antwerp'],
    items: Object.freeze(INITIAL_CARGO.map((cargo) => Object.freeze({ ...cargo, source: 'demo-dataset-a', dataClassification: 'DEMO_DATA' })))
  }),
  Object.freeze({
    id: 'competition-b',
    label: 'Dataset B · 69 件复杂混装',
    description: '与后端 DATASET-B-MIXED-69 基准同源：69 件、7 SKU，覆盖重货、易碎、不可堆叠、保持直立与三港 LIFO。',
    orderNo: 'DATASET-B-MIXED-69',
    dataClassification: 'DEMO_DATA',
    route: ['Ningbo', 'Hamburg', 'Rotterdam', 'Antwerp'],
    items: Object.freeze([
      { ...HAMBURG, ...item('立式钢琴', 'DATASET-B-PIANO', 1500, 600, 1200, 250, 2, { packagingType: 'protected', handlingMethod: 'forklift', heavy: true, fragile: true, stackable: false, maxStackLayers: 1, canLayFlat: false, riskNotes: ['易碎', '不可堆叠', '保持直立'] }) },
      { ...HAMBURG, ...item('水晶吊灯', 'DATASET-B-CHANDELIER', 800, 800, 1000, 45, 3, { packagingType: 'protected', handlingMethod: 'forklift', fragile: true, stackable: false, maxStackLayers: 1, canLayFlat: false, riskNotes: ['易碎', '顶部禁压'] }) },
      { ...HAMBURG, ...item('油画框', 'DATASET-B-PAINTING', 1200, 100, 900, 15, 8, { packagingType: 'protected', handlingMethod: 'manual', fragile: true, stackable: false, maxStackLayers: 1, canLayFlat: true, riskNotes: ['易碎', '不可倒置'] }) },
      { ...ROTTERDAM, ...item('真皮沙发', 'DATASET-B-SOFA', 2000, 900, 800, 120, 2, { packagingType: 'equipment', handlingMethod: 'forklift', heavy: true, stackable: false, maxStackLayers: 1, canLayFlat: false, riskNotes: ['不可堆叠'] }) },
      { ...ROTTERDAM, ...item('实木衣柜', 'DATASET-B-WARDROBE', 1800, 600, 2000, 180, 2, { packagingType: 'wooden', handlingMethod: 'forklift', wooden: true, heavy: true, stackable: false, maxStackLayers: 1, canLayFlat: false, riskNotes: ['保持直立', 'IPPC 标识待核'] }) },
      { ...ROTTERDAM, ...item('乳胶床垫', 'DATASET-B-MATTRESS', 2000, 1800, 300, 50, 2, { packagingType: 'protected', handlingMethod: 'forklift', heavy: true, maxStackLayers: 3, canLayFlat: true, riskNotes: ['防潮'] }) },
      { ...ANTWERP, ...item('搬家纸箱', 'DATASET-B-CARTON', 600, 400, 400, 20, 50, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 5 }) }
    ])
  }),
  Object.freeze({
    id: 'competition-c',
    label: 'Dataset C · 异常输入',
    description: '故意包含零尺寸、零重量和零数量；用于验证数据编辑器阻止无效数据进入求解。',
    orderNo: 'DEMO-C-INVALID',
    dataClassification: 'DEMO_DATA',
    route: ['Ningbo', 'Hamburg'],
    items: Object.freeze([
      { ...HAMBURG, ...item('零宽度异常箱', 'DEMO-C-WIDTH-0', 600, 0, 500, 12, 4), width: 0 },
      { ...HAMBURG, ...item('重量缺失异常箱', 'DEMO-C-WEIGHT-0', 600, 500, 500, 0, 3), weight: 0 },
      { ...HAMBURG, ...item('数量异常箱', 'DEMO-C-QTY-0', 600, 500, 500, 10, 0), quantity: 0 }
    ])
  }),
  Object.freeze({
    id: 'household-appliances',
    label: '小家电出口',
    description: '空气炸锅、电水壶、取暖器等小家电出口欧洲，整箱优化包装，多港口卸货',
    orderNo: 'NB2026-HA-01',
    dataClassification: 'DEMO_DATA',
    route: ['Ningbo', 'Hamburg', 'Rotterdam', 'Antwerp'],
    items: Object.freeze([
      { ...HAMBURG, ...item('空气炸锅', 'SKU-HA-001', 400, 392, 440, 5.2, 144, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...HAMBURG, ...item('电水壶', 'SKU-HA-002', 260, 392, 440, 1.5, 216, { packagingType: 'accessory', handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...HAMBURG, ...item('马克杯(礼盒装)', 'SKU-HA-003', 90, 392, 440, 3.5, 432, { packagingType: 'fragile', fragile: true, handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...ROTTERDAM, ...item('取暖器', 'SKU-HA-004', 500, 392, 440, 4.8, 108, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...ROTTERDAM, ...item('电饭煲', 'SKU-HA-005', 340, 392, 440, 3.6, 144, { packagingType: 'wooden', wooden: true, handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...ROTTERDAM, ...item('陶瓷碗(套装)', 'SKU-HA-006', 220, 392, 440, 4.4, 144, { packagingType: 'fragile', fragile: true, handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...ANTWERP, ...item('洗衣机', 'SKU-HA-007', 600, 580, 850, 35, 16, { packagingType: 'equipment', heavy: true, handlingMethod: 'forklift', maxStackLayers: 2, canLayFlat: false, riskNotes: ['叉车作业'] }) },
      { ...ANTWERP, ...item('电风扇', 'SKU-HA-008', 300, 392, 440, 3.2, 144, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...ANTWERP, ...item('玻璃杯(礼盒)', 'SKU-HA-009', 160, 392, 440, 3.6, 24, { packagingType: 'fragile', fragile: true, handlingMethod: 'manual', maxStackLayers: 6, riskNotes: ['易碎', '轻放'] }) }
    ])
  }),
  Object.freeze({
    id: 'household-goods',
    label: '家居用品',
    description: '折叠椅、台灯、茶几等家居用品出口，整箱优化包装，含木包装件',
    orderNo: 'NB2026-FU-01',
    dataClassification: 'DEMO_DATA',
    route: ['Ningbo', 'Hamburg', 'Rotterdam'],
    items: Object.freeze([
      { ...HAMBURG, ...item('折叠椅', 'SKU-FU-001', 80, 392, 440, 3.5, 1440, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...HAMBURG, ...item('台灯', 'SKU-FU-002', 200, 392, 440, 2.4, 216, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...HAMBURG, ...item('小茶几', 'SKU-FU-003', 120, 588, 440, 5.5, 216, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...ROTTERDAM, ...item('靠垫', 'SKU-FU-004', 150, 392, 440, 0.8, 1080, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...ROTTERDAM, ...item('陶瓷花瓶', 'SKU-FU-005', 250, 392, 440, 5.0, 36, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6, riskNotes: ['轻放'] }) },
      { ...ROTTERDAM, ...item('书架', 'SKU-FU-006', 300, 784, 850, 12, 12, { packagingType: 'wooden', wooden: true, heavy: true, handlingMethod: 'forklift', maxStackLayers: 2, canLayFlat: false, riskNotes: ['IPPC 标识待复核', '叉车作业'] }) },
      { ...ROTTERDAM, ...item('装饰镜', 'SKU-FU-007', 60, 392, 440, 2.0, 36, { packagingType: 'panel', fragile: true, handlingMethod: 'manual', maxStackLayers: 6, riskNotes: ['易碎', '禁止重压'] }) }
    ])
  }),
  Object.freeze({
    id: 'electronics',
    label: '电子产品',
    description: '笔记本电脑、显示器、服务器等电子产品出口欧洲，整箱优化包装',
    orderNo: 'NB2026-EL-01',
    dataClassification: 'DEMO_DATA',
    route: ['Ningbo', 'Hamburg', 'Rotterdam', 'Antwerp'],
    items: Object.freeze([
      { ...HAMBURG, ...item('笔记本电脑', 'SKU-EL-001', 50, 392, 440, 2.8, 1440, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6, riskNotes: ['防潮'] }) },
      { ...HAMBURG, ...item('机械键盘', 'SKU-EL-002', 40, 392, 440, 0.9, 1728, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...HAMBURG, ...item('显示器', 'SKU-EL-003', 120, 588, 440, 5.5, 288, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...ROTTERDAM, ...item('打印机', 'SKU-EL-004', 250, 392, 440, 8.2, 288, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6 }) },
      { ...ROTTERDAM, ...item('服务器主机', 'SKU-EL-005', 450, 588, 440, 22, 24, { packagingType: 'equipment', heavy: true, handlingMethod: 'forklift', maxStackLayers: 2, canLayFlat: false, riskNotes: ['叉车作业', '防静电'] }) },
      { ...ANTWERP, ...item('路由器', 'SKU-EL-006', 60, 392, 440, 0.6, 1440, { packagingType: 'carton', handlingMethod: 'manual', maxStackLayers: 6 }) }
    ])
  })
]);

export function getScenarioTemplate(id) {
  return SCENARIO_TEMPLATES.find((s) => s.id === id);
}

export function cargoFromScenario(scenarioId) {
  const scenario = getScenarioTemplate(scenarioId);
  if (!scenario) return [];
  return scenario.items.map((item) => ({
    ...item,
    cargoId: scenario.preserveCargoIds && item.cargoId ? item.cargoId : createCargoId('cargo'),
    source: 'demo-scenario-template',
    dataClassification: 'DEMO_DATA'
  }));
}

export function summarizeScenario(scenarioId) {
  const scenario = getScenarioTemplate(scenarioId);
  if (!scenario) return null;
  const totalPieces = scenario.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalWeight = scenario.items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
  const ports = [...new Set(scenario.items.map((item) => item.destinationPort))];
  const manualSkus = scenario.items.filter((item) => item.handlingMethod === 'manual');
  const forkliftSkus = scenario.items.filter((item) => item.handlingMethod === 'forklift');
  return {
    orderNo: scenario.orderNo,
    label: scenario.label,
    description: scenario.description,
    skuCount: scenario.items.length,
    totalPieces,
    totalWeight: Math.round(totalWeight),
    destinationPortCount: ports.length,
    manualCount: manualSkus.length,
    forkliftCount: forkliftSkus.length
  };
}
