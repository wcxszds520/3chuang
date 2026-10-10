import { cargoFingerprint, cargoTotals } from './cargo.js';

export const INITIAL_DATASET_ID = 'portcube-initial-v1';

export const INITIAL_ORDER = Object.freeze({
  orderNo: 'NB2026-0824-001',
  originPort: '宁波港',
  destinationPort: '汉堡港 / 鹿特丹港 / 安特卫普港',
  route: '宁波港 → 汉堡港 → 鹿特丹港 → 安特卫普港',
  vessel: 'UNKNOWN',
  source: 'demo-data',
  dataClassification: 'DEMO_DATA'
});

const BASE = Object.freeze({
  canRotate: true,
  canLayFlat: false,
  canInvert: false,
  dangerous: false,
  handlingPolicy: 'fixed',
  source: 'demo-dataset-a',
  dataClassification: 'DEMO_DATA'
});

export const INITIAL_CARGO = Object.freeze([
  cargo({
    cargoId: 'stage3_acc_01', name: '精密配件箱', sku: 'SKU-ACC-01',
    length: 650, width: 560, height: 520, weight: 12, quantity: 60,
    destinationPort: 'Hamburg', eta: '2026-09-18', portSequence: 1,
    batchId: 'BATCH-HAM-A', batchLabel: '汉堡港 · 配件批次 A',
    packagingType: 'accessory', stackable: true, maxStackLayers: 5,
    fragile: false, heavy: false, wooden: false, handlingMethod: 'manual',
    riskNotes: ['人工轻搬', '按箱码齐']
  }),
  cargo({
    cargoId: 'stage3_ctn_02', name: '整托零售箱组', sku: 'SKU-CTN-02',
    length: 650, width: 780, height: 650, weight: 35, quantity: 24,
    destinationPort: 'Hamburg', eta: '2026-09-18', portSequence: 1,
    batchId: 'BATCH-HAM-A', batchLabel: '汉堡港 · 零售批次 A',
    packagingType: 'carton', stackable: true, maxStackLayers: 4,
    fragile: false, heavy: true, wooden: false, handlingMethod: 'forklift',
    riskNotes: ['整组叉车搬运', '保持托盘完整']
  }),
  cargo({
    cargoId: 'stage3_frg_03', name: '易碎展示面板', sku: 'SKU-FRG-03',
    length: 650, width: 1100, height: 180, weight: 8, quantity: 2,
    destinationPort: 'Hamburg', eta: '2026-09-18', portSequence: 1,
    batchId: 'BATCH-HAM-B', batchLabel: '汉堡港 · 易碎批次 B',
    packagingType: 'panel', stackable: false, maxStackLayers: 1,
    fragile: true, heavy: false, wooden: false, handlingMethod: 'manual',
    riskNotes: ['禁止重压', '双人轻放']
  }),
  cargo({
    cargoId: 'stage3_man_04', name: '厨房小家电', sku: 'SKU-MAN-04',
    length: 650, width: 700, height: 520, weight: 12, quantity: 30,
    destinationPort: 'Rotterdam', eta: '2026-09-21', portSequence: 2,
    batchId: 'BATCH-RTM-A', batchLabel: '鹿特丹港 · 小家电批次 A',
    packagingType: 'carton', stackable: true, maxStackLayers: 5,
    fragile: false, heavy: false, wooden: false, handlingMethod: 'manual',
    riskNotes: ['人工搬运', '防潮']
  }),
  cargo({
    cargoId: 'stage3_flk_05', name: '商用空调机组', sku: 'SKU-FLK-05',
    length: 650, width: 780, height: 650, weight: 53, quantity: 36,
    destinationPort: 'Rotterdam', eta: '2026-09-21', portSequence: 2,
    batchId: 'BATCH-RTM-B', batchLabel: '鹿特丹港 · 设备批次 B',
    packagingType: 'equipment', stackable: true, maxStackLayers: 4,
    fragile: false, heavy: true, wooden: false, handlingMethod: 'forklift',
    riskNotes: ['叉车搬运', '保持朝向']
  }),
  cargo({
    cargoId: 'stage3_nst_06', name: '不可堆叠控制柜', sku: 'SKU-NST-06',
    length: 650, width: 780, height: 620, weight: 124, quantity: 3,
    destinationPort: 'Rotterdam', eta: '2026-09-21', portSequence: 2,
    batchId: 'BATCH-RTM-B', batchLabel: '鹿特丹港 · 控制柜批次 B',
    packagingType: 'equipment', stackable: false, maxStackLayers: 1,
    fragile: false, heavy: true, wooden: false, handlingMethod: 'forklift',
    riskNotes: ['顶部禁压', '加固绑扎']
  }),
  cargo({
    cargoId: 'stage3_wod_07', name: 'IPPC 木包装机件', sku: 'SKU-WOD-07',
    length: 650, width: 780, height: 850, weight: 23, quantity: 18,
    destinationPort: 'Antwerp', eta: '2026-09-24', portSequence: 3,
    batchId: 'BATCH-ANR-A', batchLabel: '安特卫普港 · 木包装批次 A',
    packagingType: 'wooden', stackable: true, maxStackLayers: 3,
    fragile: false, heavy: true, wooden: true, handlingMethod: 'forklift',
    riskNotes: ['IPPC 标识复核', '叉车搬运']
  }),
  cargo({
    cargoId: 'stage3_hvy_08', name: '加固工业模块', sku: 'SKU-HVY-08',
    length: 650, width: 780, height: 850, weight: 208, quantity: 18,
    destinationPort: 'Antwerp', eta: '2026-09-24', portSequence: 3,
    batchId: 'BATCH-ANR-B', batchLabel: '安特卫普港 · 重货批次 B',
    packagingType: 'reinforced', stackable: true, maxStackLayers: 3,
    fragile: false, heavy: true, wooden: false, handlingMethod: 'forklift',
    riskNotes: ['重货置底', '检查地板承重']
  }),
  cargo({
    cargoId: 'stage3_plt_09', name: '托盘化备件', sku: 'SKU-PLT-09',
    length: 650, width: 780, height: 850, weight: 21, quantity: 9,
    destinationPort: 'Antwerp', eta: '2026-09-24', portSequence: 3,
    batchId: 'BATCH-ANR-B', batchLabel: '安特卫普港 · 托盘批次 B',
    packagingType: 'pallet', stackable: true, maxStackLayers: 3,
    fragile: false, heavy: true, wooden: false, handlingMethod: 'forklift',
    riskNotes: ['托盘整体搬运', '保持缠膜']
  }),
  cargo({
    cargoId: 'stage3_svc_10', name: '售后备件小箱', sku: 'SKU-SVC-10',
    length: 300, width: 780, height: 650, weight: 5, quantity: 12,
    destinationPort: 'Antwerp', eta: '2026-09-24', portSequence: 3,
    batchId: 'BATCH-ANR-C', batchLabel: '安特卫普港 · 售后批次 C',
    packagingType: 'carton', stackable: true, maxStackLayers: 4,
    fragile: false, heavy: false, wooden: false, handlingMethod: 'manual',
    riskNotes: ['人工补装', '便于末端清点']
  })
]);

export function createInitialCargo() {
  return INITIAL_CARGO.map((item) => ({ ...item, riskNotes: [...item.riskNotes] }));
}

export function summarizeInitialDataset(cargoList = INITIAL_CARGO) {
  const totals = cargoTotals(cargoList);
  const attributes = new Set();
  for (const item of cargoList) {
    if (item.heavy) attributes.add('heavy');
    if (item.wooden) attributes.add('wooden');
    if (item.fragile) attributes.add('fragile');
    if (item.stackable) attributes.add('stackable');
    if (item.stackable === false) attributes.add('nonstackable');
    if (item.handlingMethod === 'manual') attributes.add('manual-handling');
    if (item.handlingMethod === 'forklift') attributes.add('forklift-handling');
    if (item.packagingType === 'pallet') attributes.add('pallet');
    if (item.packagingType === 'carton') attributes.add('carton');
  }
  return {
    datasetId: INITIAL_DATASET_ID,
    orderNo: INITIAL_ORDER.orderNo,
    skuCount: cargoList.length,
    totalPieces: totals.pieces,
    totalWeightKg: totals.weight,
    totalVolumeMm3: totals.volume,
    destinationPorts: [...new Set(cargoList.map((item) => item.destinationPort))],
    destinationPortCount: new Set(cargoList.map((item) => item.destinationPort)).size,
    portSequences: [...new Set(cargoList.map((item) => item.portSequence))].sort((a, b) => a - b),
    batches: [...new Set(cargoList.map((item) => item.batchId))],
    batchCount: new Set(cargoList.map((item) => item.batchId)).size,
    attributeCoverage: [...attributes].sort(),
    manualSkus: cargoList.filter((item) => item.handlingMethod === 'manual').map((item) => item.sku),
    forkliftSkus: cargoList.filter((item) => item.handlingMethod === 'forklift').map((item) => item.sku),
    fingerprint: cargoFingerprint(cargoList, '40HQ')
  };
}

function cargo(values) {
  return Object.freeze({ ...BASE, ...values, riskNotes: Object.freeze([...(values.riskNotes || [])]) });
}
