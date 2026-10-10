import * as THREE from 'three';
import { heroAssetRegistry } from '../assets/AssetRegistry.js';
import { cargoKitDescriptor, PRIMARY_PACKAGING_ASSETS } from './CargoVisualFactory.js';

export async function loadPackagingAsset(appearanceKey) {
  const primary = PRIMARY_PACKAGING_ASSETS[appearanceKey];
  if (primary) return heroAssetRegistry.clone(primary);
  const asset = await heroAssetRegistry.clone('cargoKit');
  const descriptor = cargoKitDescriptor(appearanceKey);
  const scene = new THREE.Group();
  asset.scene.updateMatrixWorld(true);
  const meshes = [];
  asset.scene.traverse(node => {
    if (!node.isMesh) return;
    let matches = false;
    for (let parent = node; parent && parent !== asset.scene; parent = parent.parent) {
      const name = parent.name.toLowerCase();
      if (descriptor.assetNames.includes(name) || descriptor.assetPrefixes.some(prefix => name.startsWith(prefix))) matches = true;
    }
    if (matches) meshes.push(node);
    else { node.geometry.dispose(); for (const material of [node.material].flat()) material.dispose(); }
  });
  for (const node of meshes) scene.attach(node);
  if (!meshes.length) throw new Error('包装模型尚未提供');
  return { ...asset, scene };
}
