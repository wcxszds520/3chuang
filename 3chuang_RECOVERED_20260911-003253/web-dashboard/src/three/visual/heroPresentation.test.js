import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { HERO_VIEWS, heroCameraPreset } from './heroCameras.js';
import { computeCameraFrame } from '../presentation/cameraPresets.js';
import { applyCargoOpacity, rememberCargoOpacity } from './cargoOpacity.js';
import { updateHeroPresentation } from './heroDirection.js';

describe('presentation preserves physical surfaces and framing', () => {
  it('keeps authored film transparency through analysis fade and restore', () => {
    const film = new THREE.MeshStandardMaterial({ opacity: .12, transparent: true, depthWrite: false });
    rememberCargoOpacity(film);
    for (const factor of [1, .86, .4, 1]) {
      applyCargoOpacity(film, factor);
      expect(film.opacity).toBeCloseTo(.12 * factor, 8);
      expect(film.transparent).toBe(true);
      expect(film.depthWrite).toBe(false);
    }
  });

  it('restores opaque boxes without accumulating fades', () => {
    const box = new THREE.MeshStandardMaterial();
    for (const factor of [.3, .08, 1, .86, 1]) applyCargoOpacity(box, factor);
    expect(box.opacity).toBe(1);
    expect(box.transparent).toBe(false);
    expect(box.depthWrite).toBe(true);
  });

  it('reapplies distance labels after a rebuild, restores them for inspection and preserves transforms', () => {
    const label = new THREE.MeshStandardMaterial();
    const ramp = new THREE.Group(); ramp.name = 'dock-ramp-plate'; ramp.position.set(6, -.12, 0);
    const group = new THREE.Group(); group.add(ramp);
    const r = {
      presentationMode: 'hero', currentView: 'hero-far',
      camera: new THREE.PerspectiveCamera(), controls: { target: new THREE.Vector3() },
      worksite: { group, zoneMeshes: [new THREE.Group()], debugGrid: new THREE.Group() },
      groups: Object.fromEntries(['labels', 'path', 'target', 'evidence', 'explainedSpace', 'actors'].map(k => [k, new THREE.Group()])),
      heroLabelMaterials: [label]
    };
    const before = ramp.matrix.toArray();
    r.camera.position.set(0, 0, 17); updateHeroPresentation(r);
    expect(label.opacity).toBe(.08); expect(ramp.visible).toBe(false);
    applyCargoOpacity(label, 1); updateHeroPresentation(r);
    expect(label.opacity).toBe(.08);
    r.camera.position.z = 8; updateHeroPresentation(r); expect(label.opacity).toBe(.3);
    r.camera.position.z = 4; updateHeroPresentation(r); expect(label.opacity).toBe(1);
    r.presentationMode = 'inspection'; updateHeroPresentation(r);
    expect(label.opacity).toBe(1); expect(label.transparent).toBe(false); expect(ramp.visible).toBe(true);
    expect(ramp.matrix.toArray()).toEqual(before); expect(ramp.position.toArray()).toEqual([6, -.12, 0]);
  });

  it('frames all five intended regions across 20GP, 40GP, 40HQ and two viewport aspects', () => {
    for (const dimensions of [{length:5.898,width:2.352,height:2.393},{length:12.032,width:2.352,height:2.393},{length:12.032,width:2.352,height:2.698}]) {
      for (const [view] of HERO_VIEWS) for (const aspect of [1600/778, 1366/646]) {
        const p = heroCameraPreset(view, dimensions);
        const frame = computeCameraFrame({...p,verticalFov:THREE.MathUtils.degToRad(p.fov),aspect});
        const camera = new THREE.PerspectiveCamera(p.fov,aspect,frame.near,frame.far);
        camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld();
        for (const x of [p.bounds.min.x,p.bounds.max.x]) for (const y of [p.bounds.min.y,p.bounds.max.y]) for (const z of [p.bounds.min.z,p.bounds.max.z]) {
          const point = new THREE.Vector3(x,y,z).project(camera);
          expect(Math.abs(point.x)).toBeLessThanOrEqual(p.margin + 1e-7);
          expect(Math.abs(point.y)).toBeLessThanOrEqual(p.margin + 1e-7);
          expect(Math.abs(point.z)).toBeLessThan(1);
        }
      }
    }
  });
});
