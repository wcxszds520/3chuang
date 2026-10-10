const BASE = Object.freeze({
  destinationPort: 'Hamburg',
  eta: '2026-07-18',
  portSequence: 1,
  dangerous: false,
  canRotate: true,
  canInvert: false,
  riskNotes: []
});

export const CARGO_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'air-conditioner',
    label: '空调外机',
    values: Object.freeze({ ...BASE, name: '空调外机', sku: 'SKU-TPL-EQP', length: 780, width: 360, height: 540, weight: 28.5, quantity: 1, packagingType: 'equipment', stackable: true, maxStackLayers: 3, canLayFlat: false, fragile: false, heavy: true, wooden: false, handlingMethod: 'forklift', riskNotes: ['保持设备朝向', '叉车作业'] })
  }),
  Object.freeze({
    id: 'accessory-carton',
    label: '标准配件箱',
    values: Object.freeze({ ...BASE, name: '标准配件箱', sku: 'SKU-TPL-ACC', length: 420, width: 300, height: 260, weight: 6.2, quantity: 12, packagingType: 'accessory', stackable: true, maxStackLayers: 6, canLayFlat: true, fragile: false, heavy: false, wooden: false, handlingMethod: 'manual' })
  }),
  Object.freeze({
    id: 'carton',
    label: '普通纸箱',
    values: Object.freeze({ ...BASE, name: '普通纸箱', sku: 'SKU-TPL-CTN', length: 500, width: 380, height: 320, weight: 9.5, quantity: 10, packagingType: 'carton', stackable: true, maxStackLayers: 5, canLayFlat: true, fragile: false, heavy: false, wooden: false, handlingMethod: 'manual' })
  }),
  Object.freeze({
    id: 'wood-pallet',
    label: '木托包装件',
    values: Object.freeze({ ...BASE, name: '木托包装件', sku: 'SKU-TPL-WOD', length: 900, width: 700, height: 650, weight: 42, quantity: 1, packagingType: 'wooden', stackable: true, maxStackLayers: 2, canLayFlat: false, fragile: false, heavy: true, wooden: true, handlingMethod: 'forklift', riskNotes: ['IPPC 标识待复核'] })
  }),
  Object.freeze({
    id: 'fragile-panel',
    label: '易碎面板',
    values: Object.freeze({ ...BASE, name: '易碎面板', sku: 'SKU-TPL-FRG', length: 600, width: 400, height: 180, weight: 3.8, quantity: 1, packagingType: 'panel', stackable: false, maxStackLayers: 1, canLayFlat: true, fragile: true, heavy: false, wooden: false, handlingMethod: 'manual', riskNotes: ['禁止重压', '轻放'] })
  }),
  Object.freeze({
    id: 'heavy-equipment',
    label: '重型设备',
    values: Object.freeze({ ...BASE, name: '重型设备', sku: 'SKU-TPL-HVY', length: 1100, width: 800, height: 980, weight: 180, quantity: 1, packagingType: 'reinforced', stackable: false, maxStackLayers: 1, canLayFlat: false, fragile: false, heavy: true, wooden: false, handlingMethod: 'forklift', riskNotes: ['复核地板承重', '加固底座'] })
  }),
  Object.freeze({
    id: 'air-fryer',
    label: '空气炸锅',
    values: Object.freeze({ ...BASE, name: '空气炸锅', sku: 'SKU-HA-001', length: 380, width: 320, height: 350, weight: 5.2, quantity: 1, packagingType: 'carton', stackable: true, maxStackLayers: 5, canLayFlat: false, fragile: false, heavy: false, wooden: false, handlingMethod: 'manual' })
  }),
  Object.freeze({
    id: 'electric-kettle',
    label: '电水壶',
    values: Object.freeze({ ...BASE, name: '电水壶', sku: 'SKU-HA-002', length: 220, width: 180, height: 260, weight: 1.5, quantity: 1, packagingType: 'carton', stackable: true, maxStackLayers: 6, canLayFlat: true, fragile: false, heavy: false, wooden: false, handlingMethod: 'manual' })
  }),
  Object.freeze({
    id: 'laptop',
    label: '笔记本电脑',
    values: Object.freeze({ ...BASE, name: '笔记本电脑', sku: 'SKU-EL-001', length: 360, width: 250, height: 50, weight: 2.8, quantity: 1, packagingType: 'carton', stackable: true, maxStackLayers: 8, canLayFlat: true, fragile: true, heavy: false, wooden: false, handlingMethod: 'manual', riskNotes: ['易碎', '防潮'] })
  }),
  Object.freeze({
    id: 'folding-chair',
    label: '折叠椅',
    values: Object.freeze({ ...BASE, name: '折叠椅', sku: 'SKU-FU-001', length: 450, width: 520, height: 80, weight: 3.5, quantity: 1, packagingType: 'carton', stackable: true, maxStackLayers: 10, canLayFlat: true, fragile: false, heavy: false, wooden: false, handlingMethod: 'manual' })
  }),
  Object.freeze({
    id: 'custom',
    label: '自定义货物',
    values: Object.freeze({ ...BASE, name: '', sku: '', length: 420, width: 320, height: 260, weight: 5, quantity: 1, packagingType: 'carton', stackable: true, maxStackLayers: 5, canLayFlat: true, fragile: false, heavy: false, wooden: false, handlingMethod: 'manual' })
  })
]);

export function getCargoTemplate(templateId) {
  return CARGO_TEMPLATES.find((template) => template.id === templateId) || CARGO_TEMPLATES.at(-1);
}

export function cargoFromTemplate(templateId, overrides = {}) {
  const template = getCargoTemplate(templateId);
  return {
    ...template.values,
    riskNotes: [...(template.values.riskNotes || [])],
    ...overrides
  };
}
