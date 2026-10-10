const ASSET_ROOT = '/assets/competition-2.7';
const REDESIGN_ROOT = '/assets/redesign-2026';

export const CURATED_ASSETS = Object.freeze({
  heroLoadedContainer: `${REDESIGN_ROOT}/a1-hero-container.webp`,
  whyAnalysis: `${REDESIGN_ROOT}/a2-why-annotated.webp`,
  workbenchPoster: `${REDESIGN_ROOT}/a4-poster-stage.webp`,
  copilotBackdrop: `${REDESIGN_ROOT}/a5-copilot-port-night.webp`,
  finalHarbor: `${REDESIGN_ROOT}/a7-final-dusk-port.webp`,
  emptyContainer: `${REDESIGN_ROOT}/a8-empty-container.webp`,
  emptyPlanSheet: `${REDESIGN_ROOT}/a8-blank-plan-sheet.webp`,
  openContainer: `${ASSET_ROOT}/container-open.webp`,
  carton: `${ASSET_ROOT}/cargo-carton.webp`,
  woodCrate: `${ASSET_ROOT}/cargo-wood-crate.webp`,
  wrappedPallet: `${ASSET_ROOT}/cargo-wrapped-pallet.webp`,
  drum: `${ASSET_ROOT}/cargo-drum.webp`,
  ibc: `${ASSET_ROOT}/cargo-ibc.webp`,
  fibc: `${ASSET_ROOT}/cargo-fibc.webp`,
  boltSeal: `${REDESIGN_ROOT}/a6-bolt-seal.webp`,
  vgmDocument: `${ASSET_ROOT}/optional-vgm-document.webp`,
  equipmentCase: `${ASSET_ROOT}/optional-equipment-case.webp`
});

const PACKAGING_ASSET = Object.freeze({
  CARTON: CURATED_ASSETS.carton,
  WOOD_CRATE: CURATED_ASSETS.woodCrate,
  PALLETIZED_CARTONS: CURATED_ASSETS.wrappedPallet,
  WRAPPED_PALLET: CURATED_ASSETS.wrappedPallet,
  EQUIPMENT_CASE: CURATED_ASSETS.equipmentCase,
  DRUM: CURATED_ASSETS.drum,
  FIBC_BAG: CURATED_ASSETS.fibc,
  GENERIC: CURATED_ASSETS.carton
});

export function curatedCargoAsset(packagingType) {
  return PACKAGING_ASSET[String(packagingType || '').toUpperCase()] || CURATED_ASSETS.carton;
}

const PRESENTATION_ASSET = Object.freeze({
  cargo_carton: CURATED_ASSETS.carton,
  cargo_crate: CURATED_ASSETS.woodCrate,
  cargo_equipment_case: CURATED_ASSETS.equipmentCase
});

export const EXTERNAL_VISUAL_ASSET_MAP = Object.freeze({
  SOURCE_CARTON: Object.freeze({ kind: 'image', asset: CURATED_ASSETS.carton, renderer: 'curated-image' }),
  SOURCE_WOOD_CRATE: Object.freeze({ kind: 'image', asset: CURATED_ASSETS.woodCrate, renderer: 'curated-image' }),
  SOURCE_METAL_CASE: Object.freeze({ kind: 'image', asset: CURATED_ASSETS.equipmentCase, renderer: 'curated-image' }),
  SOURCE_PLASTIC_BOX: Object.freeze({ kind: 'css-profile', asset: 'source-plastic-box', renderer: 'external-profile-glyph' }),
  SMALL_INDUSTRIAL_UNIT: Object.freeze({ kind: 'css-profile', asset: 'small-industrial-unit', renderer: 'external-profile-glyph' }),
  STANDARD_INDUSTRIAL_UNIT: Object.freeze({ kind: 'css-profile', asset: 'standard-industrial-unit', renderer: 'external-profile-glyph' }),
  HEAVY_INDUSTRIAL_UNIT: Object.freeze({ kind: 'css-profile', asset: 'heavy-industrial-unit', renderer: 'external-profile-glyph' }),
  LONG_INDUSTRIAL_UNIT: Object.freeze({ kind: 'css-profile', asset: 'long-industrial-unit', renderer: 'external-profile-glyph' }),
  GENERIC_BOX_LIGHT: Object.freeze({ kind: 'css-profile', asset: 'generic-box-light', renderer: 'external-profile-glyph' }),
  GENERIC_BOX_STANDARD: Object.freeze({ kind: 'css-profile', asset: 'generic-box-standard', renderer: 'external-profile-glyph' }),
  GENERIC_BOX_REINFORCED: Object.freeze({ kind: 'css-profile', asset: 'generic-box-reinforced', renderer: 'external-profile-glyph' }),
  GENERIC_BOX_HEAVY: Object.freeze({ kind: 'css-profile', asset: 'generic-box-heavy', renderer: 'external-profile-glyph' }),
  GENERIC_REINFORCED_BOX: Object.freeze({ kind: 'css-profile', asset: 'generic-reinforced-box', renderer: 'external-profile-glyph' }),
  GENERIC_HEAVY_TRANSPORT_BOX: Object.freeze({ kind: 'css-profile', asset: 'generic-heavy-transport-box', renderer: 'external-profile-glyph' }),
  SOURCE_MESH: Object.freeze({ kind: 'source-mesh', asset: 'geometryAsset', renderer: 'source-mesh-preview' }),
  GENERIC_INDUSTRIAL_UNIT: Object.freeze({ kind: 'css-profile', asset: 'generic-industrial-unit', renderer: 'external-profile-glyph' })
});

export function curatedCargoPresentationAsset(cargo = {}) {
  const key = cargo.cargoPresentationProfile?.assetKey || cargo.visualProfile?.assetKey;
  return PRESENTATION_ASSET[key] || null;
}

export function resolveExternalVisualAsset(cargo = {}) {
  const profile = cargo.cargoPresentationProfile || cargo.visualProfile || cargo.externalMetadata?.presentation || cargo;
  const visualFamily = profile?.visualFamily || 'GENERIC_INDUSTRIAL_UNIT';
  const mapping = EXTERNAL_VISUAL_ASSET_MAP[visualFamily] || EXTERNAL_VISUAL_ASSET_MAP.GENERIC_INDUSTRIAL_UNIT;
  return Object.freeze({
    visualFamily,
    ...mapping,
    asset: mapping.kind === 'source-mesh'
      ? cargo.externalMetadata?.geometryAsset || cargo.geometryAsset || mapping.asset
      : mapping.asset
  });
}

export const LANDING_PACKAGING = Object.freeze([
  { key: 'carton', label: '纸箱', asset: `${REDESIGN_ROOT}/a3-1-carton.webp`, eyebrow: '瓦楞纸板', detail: '规则来自尺寸、朝向与层数，而不是图片轮廓。' },
  { key: 'wood-crate', label: '木箱', asset: `${REDESIGN_ROOT}/a3-2-wood-crate.webp`, eyebrow: '刚性木包装', detail: '检疫、承压与叉车接近共同决定可用位置。' },
  { key: 'wrapped-pallet', label: '缠膜托盘', asset: `${REDESIGN_ROOT}/a3-3-wrapped-pallet.webp`, eyebrow: '成组运输单元', detail: '托盘外廓、叉孔与摩擦进入求解包络。' },
  { key: 'drum', label: '钢桶', asset: `${REDESIGN_ROOT}/a3-4-drums.webp`, eyebrow: '圆柱包装', detail: '滚动倾向、固定方式与承载面需要单独验证。' },
  { key: 'ibc', label: 'IBC 吨桶', asset: `${REDESIGN_ROOT}/a3-5-ibc-tote.webp`, eyebrow: '液体运输单元', detail: '用于解释包装语义；工作台仍以当前正式类型与真实录入参数求解。' },
  { key: 'fibc', label: 'FIBC 吨袋', asset: `${REDESIGN_ROOT}/a3-6-fibc-bag.webp`, eyebrow: '柔性散装容器', detail: '柔性外廓、吊装方式与不可随意堆叠是关键条件。' }
]);
