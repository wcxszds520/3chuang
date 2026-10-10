import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, it, expect, afterAll } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createPrecisionGeometry, originalDimensionsM, precisionBatchKey, precisionOrientation, precisionVariant, placementAxisMap, componentLayout, PRECISION_VARIANTS } from './PrecisionCargoFactory.js';
import { bindWorkerRig, poseArticulatedWorker } from '../scene/articulatedActors.js';
import { calibrateContainerAsset } from '../assets/assetCoordinateAdapter.js';

const root = new URL('../../../', import.meta.url);
const evidence = { kind: 'CPU_GLTF_GEOMETRY_AND_RIG_TESTS_ONLY', generatedAt: new Date().toISOString(), cargo: [], actors: [], containers: [], original212: null };
const read = rel => readFileSync(new URL(rel, root));
const json = rel => JSON.parse(read(rel));
const variants = Object.values(PRECISION_VARIANTS).flat();
const cache = new Map();

// Use the production GLTFLoader and original binary mesh/skin/accessor bytes.
// Images are omitted only in this CPU test. No texture/visual QA is claimed.
async function asset(id) {
  if (cache.has(id)) return cache.get(id);
  const bytes = read(`public/assets/3d/precision-v3/${id}.glb`);
  const length = bytes.readUInt32LE(12), original = JSON.parse(bytes.subarray(20, 20 + length).toString());
  const data = structuredClone(original), binStart = 20 + length + 8;
  const bin = bytes.subarray(binStart, binStart + data.buffers[0].byteLength);
  const omitTextures = obj => { for (const k of Object.keys(obj)) { if (/texture$/i.test(k)) delete obj[k]; else if (obj[k] && typeof obj[k] === 'object') omitTextures(obj[k]); } };
  for (const m of data.materials || []) omitTextures(m);
  delete data.images; delete data.textures; delete data.samplers;
  data.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;
  if (!globalThis.ProgressEvent) globalThis.ProgressEvent = class { constructor(type, values) { this.type = type; Object.assign(this, values); } };
  const scene = (await new GLTFLoader().parseAsync(JSON.stringify(data), '')).scene;
  const result = { scene, original, sha256: createHash('sha256').update(bytes).digest('hex') };
  cache.set(id, result); return result;
}

function envelope(box, dimensions, label) {
  const halves = [dimensions[0] / 2, dimensions[2] / 2, dimensions[1] / 2];
  for (let i = 0; i < 3; i++) {
    expect(box.min.getComponent(i), `${label} min ${i}`).toBeGreaterThanOrEqual(-halves[i] - .00002);
    expect(box.max.getComponent(i), `${label} max ${i}`).toBeLessThanOrEqual(halves[i] + .00002);
  }
}

const disposeResult = result => { result.geometry.dispose(); result.materials.forEach(m => m.dispose()); };
afterAll(() => writeFileSync(new URL('../artifacts/post-blender/continuation-20260912/geometry-evidence.json', root), JSON.stringify(evidence, null, 2) + '\n'));

describe('physical cargo components exported by Blender', () => {
  for (const variant of variants) it(`${variant}: original and resized envelopes remain valid`, async () => {
    const { scene, original, sha256 } = await asset(variant);
    const audit = json(`../assets-src/blender/portcube_precision_v3/${variant}-audit.json`);
    for (const name of ['ROOT', 'VISUAL_BODY', 'FIXED_COMPONENTS']) expect(scene.getObjectByName(name), name).toBeTruthy();
    const cases = [audit.baseDimensionsM, audit.baseDimensionsM.map((v, i) => v * [1.5, .8, 1.3][i])];
    const bounds = [];
    for (const dims of cases) {
      const result = createPrecisionGeometry(scene, dims);
      envelope(result.geometry.boundingBox, dims, `${variant} ${dims}`);
      const p = result.geometry.getAttribute('position');
      expect([...p.array].every(Number.isFinite)).toBe(true);
      bounds.push({ dimensionsM: dims, min: result.geometry.boundingBox.min.toArray(), max: result.geometry.boundingBox.max.toArray() });
      disposeResult(result);
    }
    evidence.cargo.push({ variant, sha256, sourceMeshes: original.meshes.length, rootContract: true, bounds });
  });

  it('preserves original 212 source bytes, placements, count and real envelope dimensions', async () => {
    const baseline = json('../artifacts/post-blender/run-20260912-hero-v1/baseline.json');
    const rel = 'artifacts/algo-repair/original-212-input.json';
    const expectedHash = baseline.preserved.find(v => v.path === rel).sha256;
    const actualHash = createHash('sha256').update(read(`../${rel}`)).digest('hex');
    expect(actualHash).toBe(expectedHash);
    const plan = json('../artifacts/algo-repair/new-plan.json');
    const before = JSON.stringify(plan), batches = new Map();
    expect(plan.loadedCargo).toHaveLength(212);
    for (const item of plan.loadedCargo) {
      const key = precisionBatchKey(item), dims = originalDimensionsM(item);
      const source = item.cargoPhysicalProfile.dimensions;
      expect(dims).toEqual([source.lengthMm, source.widthMm, source.heightMm].map(v => v / 1000));
      if (!batches.has(key)) {
        const { scene } = await asset(precisionVariant(item));
        const result = createPrecisionGeometry(scene, dims); envelope(result.geometry.boundingBox, dims, key);
        batches.set(key, { result, count: 0 });
      }
      const batch = batches.get(key); batch.count++;
      const box = batch.result.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(precisionOrientation(item)));
      envelope(box, [item.l / 1000, item.w / 1000, item.h / 1000], item.cargoId);
    }
    expect(JSON.stringify(plan)).toBe(before);
    expect(plan.loadedCargo.reduce((sum, v) => sum + v.weight, 0)).toBe(8623);
    evidence.original212 = { sha256: actualHash, inputFingerprintUnchanged: true, loadedCount: 212, payloadKg: 8623, placementMutation: false, batches: [...batches].map(([key, v]) => ({ key, count: v.count })) };
    for (const { result } of batches.values()) disposeResult(result);
  });

  it('rotates six axis permutations with determinant +1 and preserves labelled vertical axes', () => {
    const source = { L: .8, W: .5, H: .3 }, index = { L: 0, W: 2, H: 1 };
    for (const id of ['LWH', 'LHW', 'WLH', 'WHL', 'HLW', 'HWL']) {
      const item = { orientationId: id, l: source[id[0]] * 1000, w: source[id[1]] * 1000, h: source[id[2]] * 1000 };
      const q = precisionOrientation(item), matrix = new THREE.Matrix4().makeRotationFromQuaternion(q);
      expect(matrix.determinant()).toBeCloseTo(1, 8);
      expect(originalDimensionsM(item)).toEqual([.8, .5, .3]);
      const map = placementAxisMap(item);
      const up = new THREE.Vector3().setComponent(index[map.containerY], map.containerY === 'W' ? -1 : 1).applyQuaternion(q);
      expect(up.distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-8);
    }
    expect(placementAxisMap({ orientation: 'YXZ' })).toEqual({ containerX: 'W', containerY: 'H', containerZ: 'L' });
    expect(() => placementAxisMap({})).toThrow();
    expect(() => originalDimensionsM({ orientation: 'XYZ', l: 500, w: 800, h: 300, cargoPhysicalProfile: { dimensions: { lengthMm: 800, widthMm: 500, heightMm: 300 } } })).toThrow();
  });

  it('keeps fixed tape and pallet base dimensions while panel spans and board counts adapt', async () => {
    const carton = (await asset('carton')).scene;
    let tapes = 0;
    carton.traverse(n => {
      if (!n.isMesh || !/tape/.test(n.name)) return;
      const a = componentLayout(n.userData, [.6, .4, .4])[0], b = componentLayout(n.userData, [1.2, .8, .8])[0];
      n.userData.pc_span.forEach((span, i) => { if (!span) expect(a.size[i]).toBeCloseTo(b.size[i], 8); }); tapes++;
    });
    expect(tapes).toBeGreaterThan(0);
    const pallet = (await asset('palletized')).scene.getObjectByName('PALLET_BASE');
    const baseHeights = [];
    for (const dims of [[1.2, .8, 1.15], [.65, .78, .85]]) {
      let min = Infinity, max = -Infinity;
      pallet.traverse(n => { if (!n.isMesh) return; for (const row of componentLayout(n.userData, dims)) { min = Math.min(min, row.center[2] - row.size[2] / 2); max = Math.max(max, row.center[2] + row.size[2] / 2); } });
      baseHeights.push(max - min);
    }
    expect(baseHeights[0]).toBeCloseTo(.144, 5); expect(baseHeights[1]).toBeCloseTo(baseHeights[0], 8);
    const repeated = [];
    (await asset('crate')).scene.traverse(n => { if (n.isMesh && n.userData.pc_repeat_axis !== undefined && n.userData.pc_replica === 0) repeated.push(n.userData); });
    expect(repeated.length).toBeGreaterThan(0);
    for (const m of repeated) expect(componentLayout(m, [2, 1.6, 1.6]).length).toBeGreaterThanOrEqual(componentLayout(m, [1, .8, .8]).length);
  });
});

describe('actual exported rig and container contracts', () => {
  it('worker has exported skins, blend weights, clone-safe bones and reachable IK contacts', async () => {
    const { scene: originalScene, original, sha256 } = await asset('worker_articulated');
    expect(original.skins.length).toBeGreaterThan(0);
    const scene = cloneSkeleton(originalScene); scene.rotation.y = Math.PI;
    const meshes = []; scene.traverse(n => { if (n.isSkinnedMesh) meshes.push(n); });
    expect(meshes.length).toBeGreaterThan(50);
    let blended = 0;
    for (const mesh of meshes) {
      const w = mesh.geometry.getAttribute('skinWeight');
      for (let i = 0; i < w.count; i++) {
        const weights = [w.getX(i), w.getY(i), w.getZ(i), w.getW(i)];
        expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
        if (weights.filter(v => v > .001).length > 1) blended++;
      }
      expect(mesh.skeleton.bones.every(b => b.isBone)).toBe(true);
    }
    expect(blended).toBeGreaterThan(0);
    const rig = bindWorkerRig(scene); expect(rig.arms.every(Boolean) && rig.legs.every(Boolean)).toBe(true);
    const samples = meshes.map(mesh => { const p = mesh.geometry.getAttribute('position'); return { mesh, before: mesh.applyBoneTransform(0, new THREE.Vector3().fromBufferAttribute(p, 0)) }; });
    const hands = [new THREE.Vector3(-.28, 1.08, .28), new THREE.Vector3(-.28, 1.08, -.28)];
    poseArticulatedWorker(rig, { handTargets: hands, groundAt: () => 0, moving: false });
    const deformation = Math.max(...samples.map(({ mesh, before }) => mesh.applyBoneTransform(0, new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), 0)).distanceTo(before)));
    expect(deformation).toBeGreaterThan(.03);
    const errors = rig.arms.map((a, i) => a.tip.getWorldPosition(new THREE.Vector3()).distanceTo(hands[i]));
    errors.forEach(v => expect(v).toBeLessThan(.025));
    rig.legs.forEach(leg => expect(leg.tip.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(.1, 2));
    expect(scene.scale.toArray()).toEqual([1, 1, 1]);
    evidence.actors.push({ asset: 'worker_articulated', sha256, skinCount: original.skins.length, skinnedMeshes: meshes.length, blendedVertices: blended, handErrorM: errors, maxSampledSkinDeformationM: deformation });
  });

  it('forks, mast, wheel steering and jack handle move their own actual geometry', async () => {
    for (const [id, nodes] of [['forklift_articulated', ['fork_l', 'fork_r', 'forklift_mast', 'forklift_carriage', 'steering_wheel', 'wheel_fl', 'wheel_rl_steering']], ['pallet_jack_articulated', ['jack_handle', 'jack_lift']]]) {
      const { scene, sha256 } = await asset(id);
      const checks = [];
      for (const name of nodes) {
        const n = scene.getObjectByName(name); expect(n, name).toBeTruthy();
        const meshes = []; n.traverse(v => { if (v.isMesh) meshes.push(v); }); expect(meshes.length, name).toBeGreaterThan(0);
        scene.updateMatrixWorld(true);
        const p = meshes[0].getWorldPosition(new THREE.Vector3());
        n.position.x += .01; scene.updateMatrixWorld(true);
        expect(meshes[0].getWorldPosition(new THREE.Vector3()).distanceTo(p), name).toBeCloseTo(.01, 5);
        n.position.x -= .01; scene.updateMatrixWorld(true);
        checks.push({ name, descendantMeshes: meshes.length, respondsToTransform: true });
      }
      if (id.startsWith('forklift')) expect(scene.getObjectByName('forklift_carriage').parent.name).toBe('forklift_mast');
      evidence.actors.push({ asset: id, sha256, checks });
    }
  });

  for (const id of ['container-20gp', 'container-40gp', 'container-40hq']) it(`${id}: metre inner-envelope and hinged doors are exported`, async () => {
    const { scene, original, sha256 } = await asset(id);
    const pivots = ['door_left_pivot', 'door_right_pivot'].map(n => scene.getObjectByName(n));
    expect(pivots.every(p => p && p.children.length > 0)).toBe(true);
    const source = original.nodes.find(n => n.extras?.pc_inner_dimensions_m);
    expect(source).toBeTruthy();
    const expected = id.endsWith('20gp') ? [5.898, 2.352, 2.393] : [12.032, 2.352, id.endsWith('40hq') ? 2.698 : 2.393];
    expect(source.extras.pc_inner_dimensions_m).toEqual(expected);
    const envelopeM = { length: expected[0], width: expected[1], height: expected[2] };
    calibrateContainerAsset(scene, id.split('-')[1].toUpperCase(), envelopeM);
    expect(scene.scale.toArray()).toEqual([1, 1, 1]);
    expect(() => calibrateContainerAsset(scene, id.split('-')[1].toUpperCase(), { ...envelopeM, length: expected[0] * .9 })).toThrow();
    scene.updateMatrixWorld(true);
    // Independently inspect actual vertices, not only the root metadata label.
    const floor = new THREE.Box3().setFromObject(scene.getObjectByName('floor'));
    expect(floor.max.y).toBeCloseTo(0, 5);
    const interior = new THREE.Box3(new THREE.Vector3(-expected[0] / 2 + .0001, .0001, -expected[1] / 2 + .0001), new THREE.Vector3(expected[0] / 2 - .0001, expected[2] - .0001, expected[1] / 2 - .0001));
    let intruding = 0;
    scene.traverse(n => { if (!n.isMesh) return; const p = n.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) if (interior.containsPoint(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld))) intruding++; });
    expect(intruding).toBe(0);
    evidence.containers.push({ asset: id, sha256, innerDimensionsM: expected, hingedDoors: 2, floorSurfaceM: floor.max.y, intrudingVertices: intruding });
  });
});
