import * as THREE from 'three';
import { addBox, addCylinder, countRenderableParts } from './sharedResources.js';

export const FORKLIFT_STRUCTURE_PARTS = Object.freeze([
  'chassis',
  'counterweight',
  'cab',
  'overhead-guard',
  'seat',
  'mast',
  'fork-carriage',
  'forks',
  'wheels',
  'hubs',
  'steering',
  'warning-light',
  'fork-shanks'
]);

export function createIndustrialForklift() {
  const group = new THREE.Group();
  group.name = 'industrial-forklift';
  const yellow = new THREE.MeshStandardMaterial({ color: '#e1a12e', roughness: 0.48, metalness: 0.28 });
  const yellowDark = new THREE.MeshStandardMaterial({ color: '#b86f20', roughness: 0.52, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#26322f', roughness: 0.55, metalness: 0.42 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#101514', roughness: 0.9, metalness: 0.02 });
  const hubMaterial = new THREE.MeshStandardMaterial({ color: '#717b76', roughness: 0.4, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: '#8fb7c1', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.58, side: THREE.DoubleSide });
  const red = new THREE.MeshStandardMaterial({ color: '#bc382f', emissive: '#6b100c', emissiveIntensity: 0.5, roughness: 0.35 });

  addBox(group, { name: 'forklift-chassis', size: [1.56, 0.28, 0.92], position: [0, 0.34, 0], material: yellowDark });
  addBox(group, { name: 'forklift-hood', size: [0.72, 0.56, 0.82], position: [0.38, 0.68, 0], material: yellow });
  const counterweight = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), yellowDark);
  counterweight.name = 'forklift-counterweight';
  counterweight.position.set(0.67, 0.58, 0);
  counterweight.scale.set(0.72, 0.75, 0.88);
  counterweight.castShadow = true;
  counterweight.receiveShadow = true;
  group.add(counterweight);

  addBox(group, { name: 'forklift-seat', size: [0.34, 0.42, 0.48], position: [0.08, 0.92, 0], rotation: [0, 0, -0.12], material: dark });
  addBox(group, { name: 'forklift-cab-windscreen', size: [0.035, 0.7, 0.72], position: [-0.22, 1.1, 0], rotation: [0, 0, -0.12], material: glass });
  const postGeometry = new THREE.BoxGeometry(0.065, 1.1, 0.065);
  for (const x of [-0.42, 0.4]) for (const z of [-0.43, 0.43]) {
    addBox(group, { name: 'forklift-cab-post', geometry: postGeometry, position: [x, 1.12, z], material: dark });
  }
  addBox(group, { name: 'forklift-overhead-guard', size: [0.98, 0.08, 0.98], position: [0, 1.68, 0], material: dark });
  for (const x of [-0.32, 0, 0.32]) addBox(group, { name: 'forklift-guard-slat', size: [0.055, 0.035, 0.9], position: [x, 1.725, 0], material: dark });

  const mastRailGeometry = new THREE.BoxGeometry(0.09, 1.72, 0.1);
  for (const z of [-0.36, 0.36]) addBox(group, { name: 'forklift-mast-rail', geometry: mastRailGeometry, position: [-0.7, 0.98, z], material: dark });
  for (const y of [0.28, 0.82, 1.42]) addBox(group, { name: 'forklift-mast-crossbar', size: [0.08, 0.08, 0.82], position: [-0.7, y, 0], material: dark });

  const carriage = new THREE.Group();
  carriage.name = 'forklift-carriage';
  carriage.position.set(-0.73, 0.18, 0);
  group.add(carriage);
  addBox(carriage, { name: 'forklift-backrest', size: [0.08, 0.75, 0.78], position: [-0.03, 0.38, 0], material: dark });
  for (const z of [-0.27, 0.27]) addBox(carriage, { name: 'forklift-backrest-slat', size: [0.065, 0.68, 0.04], position: [-0.075, 0.38, z], material: dark });
  const forkGeometry = new THREE.BoxGeometry(1.32, 0.06, 0.105);
  const forks = [-0.27, 0.27].map((z) => addBox(carriage, { name: 'forklift-fork', geometry: forkGeometry, position: [-0.62, 0, z], material: dark }));
  // L 形货叉立板（叉跟弯角，真实货叉的签名轮廓）
  const forkShankGeometry = new THREE.BoxGeometry(0.055, 0.26, 0.105);
  for (const z of [-0.27, 0.27]) addBox(carriage, { name: 'forklift-fork-shank', geometry: forkShankGeometry, position: [0.02, 0.13, z], material: dark });

  const wheelGeometry = new THREE.CylinderGeometry(0.27, 0.27, 0.18, 22);
  const hubGeometry = new THREE.CylinderGeometry(0.105, 0.105, 0.19, 18);
  const wheels = [];
  for (const [x, radiusScale] of [[-0.45, 1.08], [0.52, 0.88]]) {
    for (const z of [-0.5, 0.5]) {
      const wheel = new THREE.Mesh(wheelGeometry, rubber);
      wheel.name = 'forklift-wheel';
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.28 * radiusScale, z);
      wheel.scale.set(radiusScale, radiusScale, 1);
      wheel.castShadow = true;
      group.add(wheel);
      wheels.push(wheel);
      const hub = new THREE.Mesh(hubGeometry, hubMaterial);
      hub.name = 'forklift-wheel-hub';
      hub.rotation.x = Math.PI / 2;
      hub.position.set(x, 0.28 * radiusScale, z * 1.015);
      hub.castShadow = true;
      group.add(hub);
    }
  }

  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 8, 22), dark);
  steering.name = 'forklift-steering-wheel';
  steering.position.set(-0.1, 1.16, 0);
  steering.rotation.y = Math.PI / 2;
  steering.rotation.z = -0.25;
  group.add(steering);
  addCylinder(group, { name: 'forklift-warning-light', radius: 0.075, height: 0.13, position: [0.32, 1.79, 0], material: red });
  addCylinder(group, { name: 'forklift-exhaust', radius: 0.035, height: 0.7, position: [0.56, 1.1, -0.35], material: dark });

  return {
    group,
    carriage,
    forks,
    wheels,
    descriptor: {
      structureParts: FORKLIFT_STRUCTURE_PARTS,
      partCount: countRenderableParts(group),
      wheelCount: wheels.length,
      forkCount: forks.length
    }
  };
}
