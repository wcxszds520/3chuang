export const CARGO_APPEARANCES = Object.freeze({
  carton: Object.freeze({ key: 'carton', packagingType: 'CARTON', label: '纸箱', color: '#a9794e', accent: '#5f432b', pattern: 'bands' }),
  crate: Object.freeze({ key: 'crate', packagingType: 'WOOD_CRATE', label: '木箱', color: '#866b4c', accent: '#493722', pattern: 'slats' }),
  palletized: Object.freeze({ key: 'palletized', packagingType: 'PALLETIZED_CARTONS', label: '托盘纸箱', color: '#9a8062', accent: '#58452f', pattern: 'grid' }),
  wrapped: Object.freeze({ key: 'wrapped', packagingType: 'WRAPPED_PALLET', label: '缠绕膜托盘', color: '#a9b2ad', accent: '#5c6964', pattern: 'wrap' }),
  equipment_case: Object.freeze({ key: 'equipment_case', packagingType: 'EQUIPMENT_CASE', label: '设备包装箱', color: '#6f7772', accent: '#343c38', pattern: 'vents' }),
  drum: Object.freeze({ key: 'drum', packagingType: 'DRUM', label: '桶装', color: '#667b82', accent: '#31474f', pattern: 'rings' }),
  fibc: Object.freeze({ key: 'fibc', packagingType: 'FIBC_BAG', label: '柔性集装袋', color: '#c0b9a6', accent: '#6d6656', pattern: 'woven' }),
  textile_bale: Object.freeze({ key: 'textile_bale', packagingType: 'TEXTILE_BALE', label: '压缩家纺包', color: '#8eaaa8', accent: '#38414a', pattern: 'woven' }),
  generic: Object.freeze({ key: 'generic', packagingType: 'GENERIC', label: '通用包装', color: '#888d88', accent: '#4b504c', pattern: 'grid' })
});

const TYPE_TO_APPEARANCE = Object.freeze({
  CARTON: 'carton',
  WOOD_CRATE: 'crate',
  PALLETIZED_CARTONS: 'palletized',
  WRAPPED_PALLET: 'wrapped',
  EQUIPMENT_CASE: 'equipment_case',
  DRUM: 'drum',
  FIBC_BAG: 'fibc',
  TEXTILE_BALE: 'textile_bale',
  GENERIC: 'generic'
});

const LEGACY_TO_TYPE = Object.freeze({
  carton: 'CARTON', accessory: 'CARTON', panel: 'CARTON', protected: 'CARTON',
  wooden: 'WOOD_CRATE', wood: 'WOOD_CRATE', reinforced: 'WOOD_CRATE', crate: 'WOOD_CRATE',
  pallet: 'PALLETIZED_CARTONS', wrapped: 'WRAPPED_PALLET',
  equipment: 'EQUIPMENT_CASE', machine: 'EQUIPMENT_CASE',
  drum: 'DRUM', barrel: 'DRUM', fibc: 'FIBC_BAG', generic: 'GENERIC'
});

export function classifyCargoAppearance(cargo = {}) {
  const explicitType = cargo.packagingType || cargo.packagingProfile?.type;
  const raw = String(explicitType || (cargo.wooden === true ? 'WOOD_CRATE' : 'GENERIC'));
  const upper = raw.toUpperCase();
  const canonical = TYPE_TO_APPEARANCE[upper]
    ? upper
    : LEGACY_TO_TYPE[raw.toLowerCase()] || inferType(`${raw} ${cargo.name || ''}`);
  return CARGO_APPEARANCES[TYPE_TO_APPEARANCE[canonical] || 'generic'];
}

export function cargoAppearanceLegend(cargoList = []) {
  const map = new Map();
  for (const cargo of cargoList) {
    const appearance = classifyCargoAppearance(cargo);
    map.set(appearance.key, appearance);
  }
  return [...map.values()];
}

function inferType(text) {
  const value = String(text).toLowerCase();
  if (/fibc|吨袋|集装袋/.test(value)) return 'FIBC_BAG';
  if (/drum|barrel|桶/.test(value)) return 'DRUM';
  if (/wrap|膜|缠绕/.test(value)) return 'WRAPPED_PALLET';
  if (/pallet|托盘/.test(value)) return 'PALLETIZED_CARTONS';
  if (/equipment|machine|设备|机箱/.test(value)) return 'EQUIPMENT_CASE';
  if (/wood|crate|木/.test(value)) return 'WOOD_CRATE';
  if (/carton|box|纸箱|配件|面板/.test(value)) return 'CARTON';
  return 'GENERIC';
}
