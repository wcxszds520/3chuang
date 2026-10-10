import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as TwinSceneModule from './TwinScene.jsx';

describe('TwinScene camera framing', () => {
  it('keeps the complete container, waiting zone, and forklift inside a narrow overview viewport', () => {
    expect(typeof TwinSceneModule.computeCameraFrame).toBe('function');

    const bounds = new THREE.Box3(
      new THREE.Vector3(-6.2, -0.1, -2),
      new THREE.Vector3(12, 3.05, 2)
    );
    const direction = new THREE.Vector3(0.34, 0.44, 1);
    const up = new THREE.Vector3(0, 1, 0);
    const frame = TwinSceneModule.computeCameraFrame({
      bounds,
      direction,
      up,
      verticalFov: THREE.MathUtils.degToRad(42),
      aspect: 1.9,
      margin: 0.86
    });

    const camera = new THREE.PerspectiveCamera(42, 1.9, frame.near, frame.far);
    camera.position.copy(frame.position);
    camera.up.copy(up);
    camera.lookAt(frame.target);
    camera.updateMatrixWorld(true);

    for (const corner of boxCorners(bounds)) {
      const projected = corner.clone().project(camera);
      expect(Math.abs(projected.x)).toBeLessThanOrEqual(0.8601);
      expect(Math.abs(projected.y)).toBeLessThanOrEqual(0.8601);
      expect(projected.z).toBeGreaterThanOrEqual(-1);
      expect(projected.z).toBeLessThanOrEqual(1);
    }
  });
});

function boxCorners(bounds) {
  const { min, max } = bounds;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ];
}
