import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { HERO_ASSET_MANIFEST } from './assetManifest.js';

export class AssetRegistry {
  constructor({ manifest = HERO_ASSET_MANIFEST, loader = new GLTFLoader() } = {}) {
    this.manifest = manifest;
    this.loader = loader;
    this.cache = new Map();
  }

  has(assetId) {
    return Boolean(this.manifest[assetId]);
  }

  load(assetId) {
    const descriptor = this.manifest[assetId];
    if (!descriptor) return Promise.reject(new Error(`Unknown hero asset: ${assetId}`));
    if (!this.cache.has(assetId)) {
      const pending = this.loader.loadAsync(descriptor.url)
        .then((gltf) => {
          // Registry textures are shared by all scene and instanced-material clones.
          gltf.scene.traverse((object) => {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials.filter(Boolean)) for (const value of Object.values(material)) {
              if (value?.isTexture) value.userData.portcubeShared = true;
            }
          });
          return { ...gltf, descriptor, assetId };
        })
        .catch((error) => {
          this.cache.delete(assetId);
          throw error;
        });
      this.cache.set(assetId, pending);
    }
    return this.cache.get(assetId);
  }

  async clone(assetId) {
    const asset = await this.load(assetId);
    const scene = cloneSkeleton(asset.scene);
    // Runtime clones own their resources so TwinScene can dispose safely.
    scene.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry = object.geometry?.clone();
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material?.clone();
      object.castShadow = true;
      object.receiveShadow = true;
    });
    return { ...asset, scene };
  }

  async instantiate(assetId, { parent, onReady, fallback } = {}) {
    try {
      const asset = await this.clone(assetId);
      parent?.add(asset.scene);
      onReady?.(asset);
      return { source: 'glb', ...asset };
    } catch (error) {
      fallback?.(error);
      return { source: 'procedural-fallback', assetId, error };
    }
  }

  dispose() {
    this.cache.clear();
  }
}

export const heroAssetRegistry = new AssetRegistry();
