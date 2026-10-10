import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildCameraPreset, CAMERA_PRESET_NAMES, computeCameraFrame, resolveCameraPresetName } from './cameraPresets.js';

describe('buildCameraPreset', () => {
  it('exposes the eight semantic review presets used by the final art pass', () => {
    expect(CAMERA_PRESET_NAMES).toEqual([
      'NORMAL_HERO', 'DOOR_REVIEW', 'SIDE_REVIEW', 'TOP_REVIEW',
      'SECTION_REVIEW', 'SPACE_REVIEW', 'BALANCE_REVIEW', 'UNLOAD_REVIEW'
    ]);
    expect(resolveCameraPresetName('overview', 'normal')).toBe('NORMAL_HERO');
    expect(resolveCameraPresetName('side', 'space')).toBe('SIDE_REVIEW');
    expect(resolveCameraPresetName('top', 'space')).toBe('TOP_REVIEW');
    expect(resolveCameraPresetName('top', 'balance')).toBe('TOP_REVIEW');
    expect(resolveCameraPresetName('overview', 'space')).toBe('SPACE_REVIEW');
    expect(resolveCameraPresetName('unload', 'port')).toBe('UNLOAD_REVIEW');
    for (const name of CAMERA_PRESET_NAMES) {
      const preset = buildCameraPreset(name, { length: 12.03, width: 2.35, height: 2.69, mode: 'review' });
      expect(preset.name).toBe(name);
      // 当前美术定版：hero fov 34（更宽的 hero 构图），其余 ≥35。
      expect(preset.fov).toBeGreaterThanOrEqual(33);
      expect(preset.transitionDuration).toBeGreaterThanOrEqual(0.4);
      expect(preset.transitionDuration).toBeLessThanOrEqual(1.2);
    }
  });

  it('gives the four review views distinct compositions while keeping their bounds in frame', () => {
    const dimensions = { length: 12.03, width: 2.35, height: 2.69, mode: 'operation' };
    const views = ['overview', 'door', 'top', 'side', 'section'];
    const presets = views.map((view) => buildCameraPreset(view, dimensions));

    // 五个视图全部拥有独立构图（不共享目标/方向）。
    expect(new Set(presets.map((preset) => preset.target.toArray().map((value) => value.toFixed(3)).join(','))).size).toBe(5);
    expect(new Set(presets.map((preset) => preset.direction.toArray().map((value) => value.toFixed(3)).join(','))).size).toBe(5);

    for (const preset of presets) {
      const frame = computeCameraFrame({
        ...preset,
        verticalFov: THREE.MathUtils.degToRad(42),
        aspect: 1.72
      });
      const camera = new THREE.PerspectiveCamera(42, 1.72, frame.near, frame.far);
      camera.position.copy(frame.position);
      camera.up.copy(preset.up);
      camera.lookAt(frame.target);
      camera.updateMatrixWorld(true);

      for (const corner of boxCorners(preset.bounds)) {
        const projected = corner.clone().project(camera);
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(preset.margin + 0.0001);
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(preset.margin + 0.0001);
        expect(projected.z).toBeGreaterThanOrEqual(-1);
        expect(projected.z).toBeLessThanOrEqual(1);
      }
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
