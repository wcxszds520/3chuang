export const REQUIRED_CARGO_FIELDS = Object.freeze([
  'name',
  'sku',
  'length',
  'width',
  'height',
  'weight',
  'quantity',
  'destinationPort'
]);

const POSITIVE_FIELDS = Object.freeze(['length', 'width', 'height', 'weight', 'quantity']);

export const PACKAGING_TYPES = Object.freeze([
  ['CARTON', '纸箱'],
  ['WOOD_CRATE', '木箱'],
  ['PALLETIZED_CARTONS', '托盘纸箱'],
  ['WRAPPED_PALLET', '缠绕膜托盘'],
  ['EQUIPMENT_CASE', '设备包装箱'],
  ['DRUM', '桶装'],
  ['FIBC_BAG', '柔性集装袋'],
  ['GENERIC', '通用包装']
]);

const PACKAGING_DEFAULTS = Object.freeze({
  CARTON: { material: '瓦楞纸板', transportUnit: '散件', assetKey: 'cargo_carton', wooden: false },
  WOOD_CRATE: { material: '实木或胶合板', transportUnit: '箱件', assetKey: 'cargo_crate', wooden: true },
  PALLETIZED_CARTONS: { material: '纸箱 + 托盘', transportUnit: '托盘', assetKey: 'cargo_palletized', wooden: true },
  WRAPPED_PALLET: { material: '缠绕膜 + 托盘', transportUnit: '托盘', assetKey: 'cargo_wrapped', wooden: true },
  EQUIPMENT_CASE: { material: '工程包装箱', transportUnit: '箱件', assetKey: 'cargo_equipment_case', wooden: true },
  DRUM: { material: '钢或聚合物', transportUnit: '桶', assetKey: 'cargo_drum', wooden: false },
  FIBC_BAG: { material: '编织聚丙烯', transportUnit: '柔性袋', assetKey: 'cargo_fibc', wooden: false },
  GENERIC: { material: '待确认', transportUnit: '单件', assetKey: 'cargo_generic', wooden: false }
});

export function createCargoId(prefix = 'cargo') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeCargo(input = {}) {
  const packagingType = canonicalPackagingType(input.packagingType || input.packagingProfile?.type);
  const packagingDefaults = PACKAGING_DEFAULTS[packagingType];
  const weight = Number(input.weight || 0);
  const portSequence = Math.max(1, Math.trunc(Number(input.portSequence || 1)));
  const stackable = input.stackable == null ? packagingType !== 'FIBC_BAG' : input.stackable !== false;
  const orientationPolicy = canonicalOrientationPolicy(input.orientationPolicy, input);
  const handlingMethod = String(input.handlingMethod || input.handlingMode || (weight >= 20 ? 'forklift' : 'manual')).toLowerCase();
  const maxSupportedWeight = nullablePositive(input.maximumSupportedWeightKg ?? input.maxSupportedWeight);
  const packagingProfile = {
    schemaVersion: '2.5',
    type: packagingType,
    material: String(input.packagingMaterial || input.packagingProfile?.material || packagingDefaults.material),
    transportUnit: String(input.transportUnit || input.packagingProfile?.transportUnit || packagingDefaults.transportUnit),
    handlingMode: handlingMethod.toUpperCase(),
    stackable,
    maxStackLayers: stackable ? Math.max(1, Math.trunc(Number(input.maxStackLayers || 1))) : 1,
    maximumSupportedWeightKg: maxSupportedWeight,
    fragile: input.fragile === true,
    forkEntry: String(input.forkEntry || input.packagingProfile?.forkEntry || defaultForkEntry(packagingType)),
    forkEntryAxis: input.forkEntryAxis ?? input.packagingProfile?.forkEntryAxis ?? null,
    palletJackCompatible: input.palletJackCompatible ?? input.packagingProfile?.palletJackCompatible ?? null,
    woodPackagingClass: String(input.woodPackagingClass || input.packagingProfile?.woodPackagingClass || defaultWoodClass(packagingType)),
    dangerousGoodsContext: String(input.dangerousGoodsContext || input.packagingProfile?.dangerousGoodsContext || (input.dangerous ? 'DECLARED_DANGEROUS_GOODS' : 'NOT_DECLARED')),
    orientationPolicy,
    confirmationStatus: input.packagingSuggestionSource === 'AI_SUGGESTION' && input.packagingConfirmed !== true
      ? 'USER_CONFIRMATION_REQUIRED' : input.packagingProfile?.confirmationStatus || 'USER_CONFIRMED',
    suggestionSource: input.packagingSuggestionSource || input.packagingProfile?.suggestionSource || null
  };
  const normalized = {
    cargoId: String(input.cargoId || createCargoId()),
    name: String(input.name || '').trim(),
    sku: String(input.sku || '').trim(),
    length: Number(input.length || 0),
    width: Number(input.width || 0),
    height: Number(input.height || 0),
    weight,
    quantity: Number(input.quantity || 0),
    destinationPort: String(input.destinationPort || '').trim(),
    eta: String(input.eta || ''),
    portSequence,
    batchId: String(input.batchId || `batch_${portSequence}`).trim(),
    batchLabel: String(input.batchLabel || `港序 ${portSequence} · 默认批次`).trim(),
    packagingType,
    packagingMaterial: packagingProfile.material,
    transportUnit: packagingProfile.transportUnit,
    packagingProfile,
    stackable,
    maxStackLayers: packagingProfile.maxStackLayers,
    maxSupportedWeight,
    maximumSupportedWeightKg: maxSupportedWeight,
    orientationPolicy,
    canRotate: !['FIXED_ORIENTATION', 'UPRIGHT_ONLY'].includes(orientationPolicy) && input.canRotate !== false,
    canLayFlat: orientationPolicy === 'FULL_ROTATION_ALLOWED',
    canInvert: false,
    fragile: input.fragile === true,
    heavy: input.heavy === true || weight >= 20,
    wooden: input.wooden === true || packagingDefaults.wooden,
    dangerous: input.dangerous === true,
    handlingMethod,
    handlingMode: handlingMethod.toUpperCase(),
    handlingPolicy: String(input.handlingPolicy || 'derived'),
    forkEntry: packagingProfile.forkEntry,
    forkEntryAxis: packagingProfile.forkEntryAxis,
    palletJackCompatible: packagingProfile.palletJackCompatible,
    woodPackagingClass: packagingProfile.woodPackagingClass,
    dangerousGoodsContext: packagingProfile.dangerousGoodsContext,
    packagingSuggestionSource: packagingProfile.suggestionSource,
    packagingConfirmed: packagingProfile.confirmationStatus !== 'USER_CONFIRMATION_REQUIRED',
    visualProfile: { assetKey: packagingDefaults.assetKey, materialFamily: packagingProfile.material, labelMode: 'CARGO_NAME' },
    source: String(input.source || 'manual-entry'),
    dataClassification: String(input.dataClassification || ''),
    riskNotes: Array.isArray(input.riskNotes) ? input.riskNotes.map(String) : []
  };
  normalized.cargoPhysicalProfile = {
    schemaVersion: '2.5',
    cargoName: normalized.name,
    quantity: normalized.quantity,
    dimensions: { lengthMm: normalized.length, widthMm: normalized.width, heightMm: normalized.height },
    massKg: normalized.weight,
    destination: normalized.destinationPort,
    portSequence,
    packagingType,
    packaging: packagingProfile,
    handlingMode: normalized.handlingMode,
    stackable,
    maxStackLayers: normalized.maxStackLayers,
    maximumSupportedWeightKg: maxSupportedWeight,
    fragile: normalized.fragile,
    orientationPolicy,
    forkEntry: normalized.forkEntry,
    woodPackagingClass: normalized.woodPackagingClass,
    dangerousGoodsContext: normalized.dangerousGoodsContext,
    visualProfile: normalized.visualProfile,
    solverEnvelope: {
      truthModel: 'AXIS_ALIGNED_PHYSICAL_ENVELOPE',
      dimensions: { lengthMm: normalized.length, widthMm: normalized.width, heightMm: normalized.height },
      stackable,
      maxStackLayers: normalized.maxStackLayers,
      maximumSupportedWeightKg: maxSupportedWeight,
      fragile: normalized.fragile
    }
  };
  return normalized;
}

export function canonicalPackagingType(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s\-/]+/g, '_');
  if (PACKAGING_TYPES.some(([type]) => type === normalized)) return normalized;
  if (/FIBC|BIG_BAG|BULK_BAG|吨袋|集装袋/.test(normalized)) return 'FIBC_BAG';
  if (/DRUM|BARREL|桶/.test(normalized)) return 'DRUM';
  if (/WRAP|FILM|缠绕/.test(normalized)) return 'WRAPPED_PALLET';
  if (/PALLET|托盘/.test(normalized)) return 'PALLETIZED_CARTONS';
  if (/EQUIPMENT|MACHINE|CASE|设备|机箱/.test(normalized)) return 'EQUIPMENT_CASE';
  if (/WOOD|CRATE|REINFORCED|木/.test(normalized)) return 'WOOD_CRATE';
  if (/CARTON|BOX|ACCESSORY|PANEL|PROTECTED|纸箱|配件|面板/.test(normalized)) return 'CARTON';
  return 'GENERIC';
}

function canonicalOrientationPolicy(value, input) {
  const normalized = String(value || '').toUpperCase();
  if (['FIXED_ORIENTATION', 'UPRIGHT_ONLY', 'HORIZONTAL_ROTATION_ONLY', 'FULL_ROTATION_ALLOWED'].includes(normalized)) return normalized;
  if (input.canLayFlat === true) return 'FULL_ROTATION_ALLOWED';
  if (input.canRotate === false) return 'FIXED_ORIENTATION';
  return 'HORIZONTAL_ROTATION_ONLY';
}

function defaultForkEntry(type) { return ['PALLETIZED_CARTONS', 'WRAPPED_PALLET', 'EQUIPMENT_CASE'].includes(type) ? 'TWO_WAY' : 'NOT_APPLICABLE'; }
function defaultWoodClass(type) { return ['WOOD_CRATE', 'EQUIPMENT_CASE'].includes(type) ? 'CONFIRM_SOLID_OR_PROCESSED_WOOD' : ['PALLETIZED_CARTONS', 'WRAPPED_PALLET'].includes(type) ? 'PALLET_WOOD_STATUS_REQUIRED' : 'NOT_APPLICABLE'; }
function nullablePositive(value) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }

export function validateCargo(input = {}) {
  const cargo = normalizeCargo({ cargoId: input.cargoId || 'validation', ...input });
  const errors = {};
  const suppliedMaxStackLayers = Number(input.maxStackLayers ?? input.packagingProfile?.maxStackLayers ?? 1);
  for (const field of REQUIRED_CARGO_FIELDS) {
    if (cargo[field] === '' || cargo[field] == null) errors[field] = '必填';
  }
  for (const field of POSITIVE_FIELDS) {
    if (!Number.isFinite(cargo[field]) || cargo[field] <= 0) errors[field] = '必须大于 0';
  }
  if (!Number.isInteger(cargo.quantity)) errors.quantity = '必须为正整数';
  if (!Number.isInteger(cargo.maxStackLayers) || cargo.maxStackLayers < 1) {
    errors.maxStackLayers = '至少为 1 层';
  }
  if (input.stackable === false && suppliedMaxStackLayers !== 1) {
    errors.maxStackLayers = '不可堆叠货物只能为 1 层';
  }
  if (cargo.packagingProfile.confirmationStatus === 'USER_CONFIRMATION_REQUIRED') {
    errors.packagingType = 'AI 建议包装必须由用户确认';
  }
  if (cargo.length > 13556 || cargo.width > 2698 || cargo.height > 2698) {
    errors.dimensions = '尺寸可能超出当前支持柜型，请生成方案确认';
  }
  return { cargo, errors, valid: Object.keys(errors).length === 0 };
}

export function cargoTotals(cargoList = []) {
  return cargoList.reduce((totals, item) => {
    const quantity = Number(item.quantity || 0);
    totals.pieces += quantity;
    totals.weight += Number(item.weight || 0) * quantity;
    totals.volume += Number(item.length || 0) * Number(item.width || 0) * Number(item.height || 0) * quantity;
    return totals;
  }, { pieces: 0, weight: 0, volume: 0 });
}

export function cargoDataCompleteness(cargoList = []) {
  if (!cargoList.length) return { percent: 0, missing: 0, total: 0 };
  const total = cargoList.length * REQUIRED_CARGO_FIELDS.length;
  const missing = cargoList.reduce((sum, item) => (
    sum + REQUIRED_CARGO_FIELDS.filter((field) => item[field] === '' || item[field] == null).length
  ), 0);
  return { percent: Math.round(((total - missing) / total) * 100), missing, total };
}

export function cargoFingerprint(cargoList = [], containerType = '') {
  const serial = cargoList.map((cargo) => ({
    cargoId: cargo.cargoId,
    name: cargo.name,
    sku: cargo.sku,
    length: cargo.length,
    width: cargo.width,
    height: cargo.height,
    weight: cargo.weight,
    quantity: cargo.quantity,
    destinationPort: cargo.destinationPort,
    eta: cargo.eta,
    portSequence: cargo.portSequence,
    batchId: cargo.batchId,
    batchLabel: cargo.batchLabel,
    packagingType: cargo.packagingType,
    packagingMaterial: cargo.packagingMaterial,
    transportUnit: cargo.transportUnit,
    packagingProfile: cargo.packagingProfile,
    cargoPhysicalProfile: cargo.cargoPhysicalProfile,
    stackable: cargo.stackable,
    maxStackLayers: cargo.maxStackLayers,
    maxSupportedWeight: cargo.maxSupportedWeight,
    orientationPolicy: cargo.orientationPolicy,
    forkEntry: cargo.forkEntry,
    woodPackagingClass: cargo.woodPackagingClass,
    dangerousGoodsContext: cargo.dangerousGoodsContext,
    visualProfile: cargo.visualProfile,
    canRotate: cargo.canRotate,
    canLayFlat: cargo.canLayFlat,
    canInvert: cargo.canInvert,
    fragile: cargo.fragile,
    heavy: cargo.heavy,
    wooden: cargo.wooden,
    dangerous: cargo.dangerous,
    handlingMethod: cargo.handlingMethod,
    handlingPolicy: cargo.handlingPolicy,
    source: cargo.source,
    dataClassification: cargo.dataClassification,
    riskNotes: cargo.riskNotes
  }));
  const value = JSON.stringify({ containerType, cargo: serial });
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
