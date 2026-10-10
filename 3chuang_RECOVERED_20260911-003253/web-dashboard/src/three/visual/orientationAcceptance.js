import { originalDimensionsM, placementAxisMap, precisionVariant } from '../cargo/PrecisionCargoFactory.js';

// Human-visible detail checks, recorded as ORIENTATION_<asset>_<pose>.png/json
// in artifacts/post-blender/runtime-convergence-20260912. This is a rendering
// certification, never permission for a solver to select an orientation.
const VERIFIED = Object.freeze({
  carton: ['LWH', 'WLH'], crate: ['LWH', 'WLH'],
  equipment_case: ['LWH', 'WLH'], palletized: ['LWH', 'WLH']
});

export function visualOrientationStatus(cargo) {
  if (cargo.algorithmMeta?.source === 'local-preview') return 'PREVIEW · 预览朝向，不是正式放置方向';
  try {
    originalDimensionsM(cargo);
    const map = placementAxisMap(cargo);
    const pose = [map.containerX, map.containerZ, map.containerY].join('');
    return VERIFIED[precisionVariant(cargo)]?.includes(pose)
      ? 'VISUAL_ORIENTATION_VERIFIED · 资产细节与轴映射已核验'
      : 'VISUAL_PENDING · 此资产或方向尚未逐图核验';
  } catch {
    return 'VISUAL_PENDING · 方向元数据与物理尺寸需复核';
  }
}
