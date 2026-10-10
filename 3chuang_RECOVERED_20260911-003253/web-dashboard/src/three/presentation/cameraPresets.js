import * as THREE from 'three';

export const CAMERA_PRESET_NAMES = Object.freeze([
  'NORMAL_HERO',
  'DOOR_REVIEW',
  'SIDE_REVIEW',
  'REAR_REVIEW',
  'TOP_REVIEW',
  'SECTION_REVIEW',
  'SPACE_REVIEW',
  'BALANCE_REVIEW',
  'UNLOAD_REVIEW'
]);

const VIEW_TO_PRESET = Object.freeze({
  overview: 'NORMAL_HERO',
  door: 'DOOR_REVIEW',
  side: 'SIDE_REVIEW',
  rear: 'REAR_REVIEW',
  top: 'TOP_REVIEW',
  section: 'SECTION_REVIEW',
  unload: 'UNLOAD_REVIEW'
});

export function resolveCameraPresetName(view = 'overview', visualizationMode = 'normal') {
  if (view === 'unload') return 'UNLOAD_REVIEW';
  if (['door', 'side', 'rear', 'top', 'section'].includes(view)) return VIEW_TO_PRESET[view];
  if (visualizationMode === 'space') return 'SPACE_REVIEW';
  if (visualizationMode === 'balance') return 'BALANCE_REVIEW';
  return VIEW_TO_PRESET[view] || 'NORMAL_HERO';
}

export function buildCameraPreset(view = 'overview', dimensions = {}) {
  const length = Math.max(1, Number(dimensions.length || 1));
  const width = Math.max(1, Number(dimensions.width || 1));
  const height = Math.max(1, Number(dimensions.height || 1));
  const operation = dimensions.mode !== 'review';
  const requestedName = CAMERA_PRESET_NAMES.includes(view)
    ? view
    : resolveCameraPresetName(view, dimensions.visualizationMode);
  const containerBounds = new THREE.Box3(
    new THREE.Vector3(-length / 2 - 0.25, -0.1, -width / 2 - 0.24),
    new THREE.Vector3(length / 2 + 1.4, height + 0.26, width / 2 + 0.4)
  );
  const operationBounds = new THREE.Box3(
    new THREE.Vector3(-length / 2 - 0.4, -0.12, -width / 2 - 0.48),
    new THREE.Vector3(length / 2 + 7.0, Math.max(height + 0.3, 3), width / 2 + 4.8)
  );
  const inspectionBounds = new THREE.Box3(
    new THREE.Vector3(-length / 2 - .8, -.22, -width / 2 - .6),
    new THREE.Vector3(length / 2 + 4.4, height + .26, width / 2 + 1.7)
  );

  const presets = {
    NORMAL_HERO: {
      bounds: operation ? operationBounds : dimensions.inspectionContext === false ? containerBounds : inspectionBounds,
      direction: operation ? new THREE.Vector3(.2, .62, 1) : new THREE.Vector3(0.38, 0.42, 1),
      up: new THREE.Vector3(0, 1, 0),
      target: operation ? operationBounds.getCenter(new THREE.Vector3()) : new THREE.Vector3(length * 0.12, height * 0.4, .12),
      margin: operation ? 0.95 : 0.93,
      cropScale: operation ? .92 : 0.95,
      fov: 34,
      transitionDuration: 0.42
    },
    DOOR_REVIEW: {
      bounds: new THREE.Box3(
        new THREE.Vector3(length / 2 - 4.7, -0.1, -width / 2 - 0.38),
        new THREE.Vector3(length / 2 + (operation ? 5.6 : 0.8), Math.max(height + 0.25, 2.9), width / 2 + 0.38)
      ),
      direction: new THREE.Vector3(1, 0.18, 0.08),
      up: new THREE.Vector3(0, 1, 0),
      target: new THREE.Vector3(length / 2 - 1.8, height * 0.43, 0),
      margin: 0.96,
      cropScale: operation ? 1.04 : 1.05,
      fov: 37,
      transitionDuration: 0.42
    },
    SIDE_REVIEW: {
      bounds: operation ? operationBounds : containerBounds,
      direction: new THREE.Vector3(0.035, 0.24, 1),
      up: new THREE.Vector3(0, 1, 0),
      target: new THREE.Vector3(length * 0.02, height * 0.58, 0),
      margin: 0.96,
      cropScale: operation ? 1.08 : 1.18,
      fov: 36,
      transitionDuration: 0.42
    },
    TOP_REVIEW: {
      bounds: operation ? operationBounds : containerBounds,
      direction: new THREE.Vector3(0.035, 1, 0.025),
      up: new THREE.Vector3(0, 0, -1),
      target: new THREE.Vector3(length * 0.02, height * 0.08, 0),
      margin: 0.95,
      cropScale: operation ? 1.1 : 1.22,
      fov: 36,
      transitionDuration: 0.42
    },
    REAR_REVIEW: {
      bounds: containerBounds,
      direction: new THREE.Vector3(-0.75, 0.45, 1),
      up: new THREE.Vector3(0, 1, 0),
      target: new THREE.Vector3(-length * 0.12, height * 0.45, 0),
      margin: 0.96, cropScale: 1.08, fov: 36, transitionDuration: 0.42
    },
    SECTION_REVIEW: {
      bounds: containerBounds,
      direction: new THREE.Vector3(0.012, 0.055, 1),
      up: new THREE.Vector3(0, 1, 0),
      target: new THREE.Vector3(length * 0.02, height * 0.51, 0),
      margin: 0.95,
      cropScale: 1.18,
      fov: 35,
      transitionDuration: 0.42
    },
    SPACE_REVIEW: {
      bounds: containerBounds,
      direction: new THREE.Vector3(0.08, 0.3, 1),
      up: new THREE.Vector3(0, 1, 0),
      target: new THREE.Vector3(-length * 0.04, height * 0.58, 0),
      margin: 0.96,
      cropScale: 1.22,
      fov: 35,
      transitionDuration: 0.42
    },
    BALANCE_REVIEW: {
      bounds: containerBounds,
      direction: new THREE.Vector3(0.035, 1, 0.085),
      up: new THREE.Vector3(0, 0, -1),
      target: new THREE.Vector3(-length * 0.02, height * 0.05, 0),
      margin: 0.96,
      cropScale: 1.22,
      fov: 35,
      transitionDuration: 0.42
    },
    UNLOAD_REVIEW: {
      bounds: new THREE.Box3(
        new THREE.Vector3(-length / 2 - 0.2, -0.1, -width / 2 - 0.3),
        new THREE.Vector3(length / 2 + 3.8, Math.max(height + 0.28, 2.9), width / 2 + 1.3)
      ),
      direction: new THREE.Vector3(0.68, 0.28, 0.78),
      up: new THREE.Vector3(0, 1, 0),
      target: new THREE.Vector3(length * 0.16, height * 0.4, -width * 0.12),
      margin: 0.96,
      cropScale: 0.84,
      fov: 37,
      transitionDuration: 0.42
    }
  };
  return { name: requestedName, ...presets[requestedName] };
}

export function computeCameraFrame({ bounds, direction, up, target: suppliedTarget, verticalFov, aspect, margin = 0.84 }) {
  const target = suppliedTarget?.clone?.() || bounds.getCenter(new THREE.Vector3());
  const viewDirection = direction.clone().normalize();
  const cameraRight = new THREE.Vector3().crossVectors(up, viewDirection).normalize();
  const cameraUp = new THREE.Vector3().crossVectors(viewDirection, cameraRight).normalize();
  const safeAspect = Math.max(0.1, Number(aspect) || 1);
  const safeMargin = THREE.MathUtils.clamp(Number(margin) || 0.84, 0.1, 0.98);
  const tanVertical = Math.tan(verticalFov / 2);
  const tanHorizontal = tanVertical * safeAspect;
  let distance = 0;

  for (const corner of boxCorners(bounds)) {
    const offset = corner.sub(target);
    const depthOffset = offset.dot(viewDirection);
    distance = Math.max(
      distance,
      Math.abs(offset.dot(cameraRight)) / (safeMargin * tanHorizontal) + depthOffset,
      Math.abs(offset.dot(cameraUp)) / (safeMargin * tanVertical) + depthOffset
    );
  }

  distance = Math.max(1, distance);
  return {
    target,
    position: target.clone().addScaledVector(viewDirection, distance),
    near: Math.max(0.05, distance / 180),
    far: Math.max(40, distance * 8)
  };
}

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
