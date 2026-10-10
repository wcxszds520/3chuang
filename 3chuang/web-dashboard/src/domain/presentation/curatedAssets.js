import { packagingThumbnail } from '../../three/cargo/CargoVisualFactory.js';
import { classifyCargoAppearance } from '../cargo/appearance.js';

const ASSET_ROOT = '/assets/competition-2.7';

export const CURATED_ASSETS = Object.freeze({
  heroLoadedContainer: `${ASSET_ROOT}/hero-loaded-container.webp`,
  openContainer: `${ASSET_ROOT}/container-open.webp`,
  carton: packagingThumbnail('carton'),
  woodCrate: packagingThumbnail('crate'),
  wrappedPallet: packagingThumbnail('wrapped'),
  drum: packagingThumbnail('drum'),
  ibc: `${ASSET_ROOT}/cargo-ibc.webp`,
  fibc: packagingThumbnail('fibc'),
  boltSeal: `${ASSET_ROOT}/evidence-bolt-seal.webp`,
  vgmDocument: `${ASSET_ROOT}/optional-vgm-document.webp`,
  equipmentCase: packagingThumbnail('equipment_case')
});

export function curatedCargoAsset(packagingType) {
  return packagingThumbnail(classifyCargoAppearance({packagingType}).key);
}

export const LANDING_PACKAGING = Object.freeze([
  { key: 'carton', appearanceKey:'carton', label: '纸箱', asset: CURATED_ASSETS.carton, eyebrow: '瓦楞纸板', detail: '尺寸、单件重量、朝向与允许层数决定堆叠方式。' },
  { key: 'wood-crate', appearanceKey:'crate', label: '木箱', asset: CURATED_ASSETS.woodCrate, eyebrow: '刚性木包装', detail: '检疫、承压与叉车接近共同决定可用位置。' },
  { key: 'wrapped-pallet', appearanceKey:'wrapped', label: '缠膜托盘', asset: CURATED_ASSETS.wrappedPallet, eyebrow: '成组运输单元', detail: '托盘外廓、叉孔与摩擦进入求解包络。' },
  { key: 'drum', appearanceKey:'drum', label: '钢桶', asset: CURATED_ASSETS.drum, eyebrow: '圆柱包装', detail: '滚动倾向、固定方式与承载面需要单独验证。' },
  { key: 'equipment-case', appearanceKey:'equipment_case', label: '设备箱', asset: CURATED_ASSETS.equipmentCase, eyebrow: '加固运输箱', detail: '底座、受力面和设备朝向决定叉取、支撑与系固方式。' },
  { key: 'fibc', appearanceKey:'fibc', label: '吨袋', asset: CURATED_ASSETS.fibc, eyebrow: '柔性散装容器', detail: '柔性外廓、吊装方式与允许堆叠层数需要逐项确认。' }
]);
