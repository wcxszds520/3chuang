import * as THREE from 'three';

// Selected by fixed-camera 40HQ comparisons. Shared with the asset review stage.
export const FINAL_VISUAL_PROFILE = Object.freeze({
  toneMapping: THREE.NeutralToneMapping,
  toneMappingName: 'NEUTRAL',
  exposure: 1,
  environmentIntensity: .48,
  background: '#444749',
  environment: Object.freeze({ cargo: .55, container: .92, actor: 1.02, environment: .38 })
});

export function configureAssetSampling(root, kind, renderer) {
  root.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const [slot, texture] of Object.entries(material)) {
        if (!texture?.isTexture) continue;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        texture.colorSpace = ['map', 'emissiveMap', 'specularColorMap', 'sheenColorMap'].includes(slot) ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.needsUpdate = true;
      }
      material.envMapIntensity = FINAL_VISUAL_PROFILE.environment[kind];
      material.needsUpdate = true;
    }
  });
}
