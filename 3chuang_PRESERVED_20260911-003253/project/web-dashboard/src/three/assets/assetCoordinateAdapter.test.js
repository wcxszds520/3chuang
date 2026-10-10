import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ASSET_AXES, calibrateContainerAsset, findNamedNode, fitAssetToEnvelope } from './assetCoordinateAdapter.js';
import { HERO_ASSET_MANIFEST, assetKeyForContainer } from './assetManifest.js';

describe('hero asset coordinate contract', () => {
  it('maps every supported container to one GLB manifest entry', () => {
    expect(assetKeyForContainer('20GP')).toBe('container20gp');
    expect(assetKeyForContainer('40GP')).toBe('container40gp');
    expect(assetKeyForContainer('40HQ')).toBe('container40hq');
    expect(Object.values(HERO_ASSET_MANIFEST).every((entry) => entry.url.endsWith('.glb'))).toBe(true);
    expect(ASSET_AXES).toMatchObject({ length: 'x', height: 'y', width: 'z', unit: 'meter' });
  });

  it('fits a calibrated object to the runtime length-height-width envelope', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3));
    mesh.name = 'axis_calibration_mesh';
    root.add(mesh);
    fitAssetToEnvelope(root, { length: 12, height: 2.4, width: 2.7 });
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());

    expect(size.x).toBeCloseTo(12, 5);
    expect(size.y).toBeCloseTo(2.4, 5);
    expect(size.z).toBeCloseTo(2.7, 5);
    expect(findNamedNode(root, 'axis_calibration_mesh')).toBe(mesh);
  });

  it('calibrates a container from its authored inner dimensions without moving the packing origin', () => {
    const root = new THREE.Group();
    calibrateContainerAsset(root, '40HQ', { length: 12.032, height: 2.698, width: 2.352 });

    expect(root.position.toArray()).toEqual([0, 0, 0]);
    expect(root.scale.toArray()).toEqual([1, 1, 1]);
  });
});
