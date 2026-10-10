import * as THREE from 'three';
import { addBox, addCylinder, countRenderableParts } from './sharedResources.js';

export const MANUAL_WORKER_STRUCTURE_PARTS = Object.freeze([
  'head',
  'hard-hat',
  'torso',
  'safety-vest',
  'left-arm',
  'right-arm',
  'hands',
  'left-leg',
  'right-leg',
  'boots'
]);

export function createManualWorker() {
  const group = new THREE.Group();
  group.name = 'manual-dock-worker';

  const skin = new THREE.MeshStandardMaterial({ color: '#b97850', roughness: 0.78, metalness: 0.01 });
  const navy = new THREE.MeshStandardMaterial({ color: '#263b4b', roughness: 0.76, metalness: 0.03 });
  const vest = new THREE.MeshStandardMaterial({ color: '#e6a72c', roughness: 0.64, metalness: 0.02 });
  const reflective = new THREE.MeshStandardMaterial({ color: '#d9e5cd', emissive: '#68715e', emissiveIntensity: 0.18, roughness: 0.42 });
  const helmet = new THREE.MeshStandardMaterial({ color: '#f1c84b', roughness: 0.46, metalness: 0.08 });
  const boot = new THREE.MeshStandardMaterial({ color: '#202725', roughness: 0.9, metalness: 0.02 });
  const eye = new THREE.MeshStandardMaterial({ color: '#17201e', roughness: 0.75 });

  addBox(group, { name: 'worker-torso', size: [0.32, 0.6, 0.42], position: [0, 1.18, 0], material: navy });
  addBox(group, { name: 'worker-vest-front', size: [0.335, 0.48, 0.43], position: [-0.006, 1.2, 0], material: vest });
  addBox(group, { name: 'worker-reflective-band-high', size: [0.35, 0.055, 0.445], position: [-0.012, 1.29, 0], material: reflective });
  addBox(group, { name: 'worker-reflective-band-low', size: [0.35, 0.055, 0.445], position: [-0.012, 1.09, 0], material: reflective });
  addBox(group, { name: 'worker-vest-shoulder-left', size: [0.345, 0.22, 0.045], position: [-0.014, 1.39, -0.205], material: reflective });
  addBox(group, { name: 'worker-vest-shoulder-right', size: [0.345, 0.22, 0.045], position: [-0.014, 1.39, 0.205], material: reflective });

  const neck = addCylinder(group, { name: 'worker-neck', radius: 0.075, height: 0.12, segments: 10, position: [0, 1.55, 0], material: skin });
  neck.castShadow = true;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.165, 1), skin);
  head.name = 'worker-head';
  head.position.set(0, 1.76, 0);
  head.scale.set(0.9, 1.08, 0.94);
  head.castShadow = true;
  group.add(head);
  for (const z of [-0.062, 0.062]) addBox(group, { name: 'worker-eye', size: [0.025, 0.026, 0.035], position: [-0.145, 1.79, z], material: eye });
  addCylinder(group, { name: 'worker-hard-hat-crown', radiusTop: 0.12, radiusBottom: 0.18, height: 0.16, segments: 12, position: [0, 1.94, 0], material: helmet });
  addBox(group, { name: 'worker-hard-hat-brim', size: [0.4, 0.035, 0.38], position: [-0.035, 1.875, 0], material: helmet });

  const leftArmPivot = createLimbPivot(group, 'worker-left-arm', [0, 1.45, -0.29]);
  const rightArmPivot = createLimbPivot(group, 'worker-right-arm', [0, 1.45, 0.29]);
  addCylinder(leftArmPivot, { name: 'worker-left-arm', radius: 0.065, height: 0.55, segments: 10, position: [0, -0.265, 0], material: navy });
  addCylinder(rightArmPivot, { name: 'worker-right-arm', radius: 0.065, height: 0.55, segments: 10, position: [0, -0.265, 0], material: navy });
  addCylinder(leftArmPivot, { name: 'worker-left-hand', radius: 0.072, height: 0.12, segments: 10, position: [0, -0.585, 0], material: skin });
  addCylinder(rightArmPivot, { name: 'worker-right-hand', radius: 0.072, height: 0.12, segments: 10, position: [0, -0.585, 0], material: skin });

  const leftLegPivot = createLimbPivot(group, 'worker-left-leg', [0, 0.9, -0.115]);
  const rightLegPivot = createLimbPivot(group, 'worker-right-leg', [0, 0.9, 0.115]);
  addCylinder(leftLegPivot, { name: 'worker-left-leg', radius: 0.09, height: 0.66, segments: 10, position: [0, -0.31, 0], material: navy });
  addCylinder(rightLegPivot, { name: 'worker-right-leg', radius: 0.09, height: 0.66, segments: 10, position: [0, -0.31, 0], material: navy });
  addBox(leftLegPivot, { name: 'worker-left-boot', size: [0.27, 0.14, 0.18], position: [-0.07, -0.69, 0], material: boot });
  addBox(rightLegPivot, { name: 'worker-right-boot', size: [0.27, 0.14, 0.18], position: [-0.07, -0.69, 0], material: boot });

  return {
    group,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    descriptor: {
      structureParts: MANUAL_WORKER_STRUCTURE_PARTS,
      partCount: countRenderableParts(group),
      articulatedLimbCount: 4,
      actorType: 'manual'
    }
  };
}

function createLimbPivot(parent, name, position) {
  const pivot = new THREE.Group();
  pivot.name = `${name}-pivot`;
  pivot.position.fromArray(position);
  parent.add(pivot);
  return pivot;
}

