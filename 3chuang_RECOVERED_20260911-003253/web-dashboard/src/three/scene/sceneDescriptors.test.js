import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONTAINER_STRUCTURE_PARTS, createIndustrialContainer } from './createIndustrialContainer.js';
import { FORKLIFT_STRUCTURE_PARTS, createIndustrialForklift } from './createIndustrialForklift.js';
import { MANUAL_WORKER_STRUCTURE_PARTS, createManualWorker } from './createManualWorker.js';
import { WORKSITE_STRUCTURE_PARTS, createWorksite } from './createWorksite.js';

describe('industrial scene descriptors', () => {
  it('builds a complete high-X double-door container contract', () => {
    expect(CONTAINER_STRUCTURE_PARTS).toEqual(expect.arrayContaining([
      'floor', 'side-walls', 'roof', 'front-wall', 'corner-posts', 'door-frame',
      'threshold', 'left-door', 'right-door', 'lock-rods', 'handles', 'corrugation'
    ]));
    const parent = new THREE.Group();
    const runtime = createIndustrialContainer(parent, { length: 12.03, width: 2.35, height: 2.69 });

    expect(runtime.doors.leftPivot).toBeInstanceOf(THREE.Group);
    expect(runtime.doors.rightPivot).toBeInstanceOf(THREE.Group);
    expect(runtime.descriptor).toMatchObject({ doorCount: 2, doorEnd: 'high-x' });
    expect(runtime.descriptor.partCount).toBeGreaterThan(30);
    expect(runtime.shellMaterials.opaque.transparent).toBe(false);
    expect(runtime.reviewCutaway.visible).toBe(false);
  });

  it('builds a forklift with the existing animation handles and richer structure', () => {
    expect(FORKLIFT_STRUCTURE_PARTS).toEqual(expect.arrayContaining([
      'counterweight', 'cab', 'mast', 'fork-carriage', 'forks', 'wheels',
      'hubs', 'steering', 'warning-light'
    ]));
    const runtime = createIndustrialForklift();

    expect(runtime.group).toBeInstanceOf(THREE.Group);
    expect(runtime.carriage).toBeInstanceOf(THREE.Group);
    expect(runtime.forks).toHaveLength(2);
    expect(runtime.wheels).toHaveLength(4);
    expect(runtime.descriptor.partCount).toBeGreaterThan(20);
  });

  it('builds a recognizable low-poly manual worker with articulated limbs', () => {
    expect(MANUAL_WORKER_STRUCTURE_PARTS).toEqual(expect.arrayContaining([
      'head', 'torso', 'left-arm', 'right-arm', 'left-leg', 'right-leg', 'hands', 'boots'
    ]));
    const runtime = createManualWorker();

    expect(runtime.group).toBeInstanceOf(THREE.Group);
    expect(runtime.leftArmPivot).toBeInstanceOf(THREE.Group);
    expect(runtime.rightArmPivot).toBeInstanceOf(THREE.Group);
    expect(runtime.leftLegPivot).toBeInstanceOf(THREE.Group);
    expect(runtime.rightLegPivot).toBeInstanceOf(THREE.Group);
    expect(runtime.descriptor.partCount).toBeGreaterThan(15);
    expect(runtime.descriptor.articulatedLimbCount).toBe(4);
  });

  it('builds a finite marked worksite with its debug grid off by default', () => {
    expect(WORKSITE_STRUCTURE_PARTS).toEqual(expect.arrayContaining([
      'concrete-slab', 'loading-lane', 'waiting-bay', 'staging-zone', 'safety-markings', 'dock-edge'
    ]));
    const scene = new THREE.Scene();
    const runtime = createWorksite(scene, { length: 12.03, width: 2.35, height: 2.69 });

    expect(runtime.group).toBeInstanceOf(THREE.Group);
    expect(runtime.debugGrid.visible).toBe(false);
    expect(runtime.descriptor.finite).toBe(true);
    expect(runtime.descriptor.partCount).toBeGreaterThan(10);
  });
});
