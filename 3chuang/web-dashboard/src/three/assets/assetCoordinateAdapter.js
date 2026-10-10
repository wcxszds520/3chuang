import * as THREE from 'three';

// Blender source uses X=container length, Y=width, Z=height. Blender's glTF
// exporter converts Z-up to Three.js Y-up, producing X=length, Y=height,
// Z=-width. All runtime fitting is centralized here.
export const ASSET_AXES = Object.freeze({ length: 'x', height: 'y', width: 'z', unit: 'meter' });

const AUTHORED_CONTAINER_INTERIORS = Object.freeze({
  '20GP': Object.freeze({ length: 5.898, height: 2.393, width: 2.352 }),
  '40GP': Object.freeze({ length: 12.032, height: 2.393, width: 2.352 }),
  '40HQ': Object.freeze({ length: 12.032, height: 2.698, width: 2.352 })
});

// Container files are authored around the packing origin: the inner floor is
// y=0 and the inner volume is centred on X/Z. Scale from the authored interior
// contract instead of the outer steel shell so solver millimetres stay exact.
export function calibrateContainerAsset(object, typeId, envelope) {
  const authored = AUTHORED_CONTAINER_INTERIORS[String(typeId).toUpperCase()] || envelope;
  object.scale.multiply(new THREE.Vector3(
    safeScale(envelope.length, authored.length),
    safeScale(envelope.height, authored.height),
    safeScale(envelope.width, authored.width)
  ));
  object.position.set(0, 0, 0);
  object.updateWorldMatrix(true, true);
  return object;
}

export function fitAssetToEnvelope(object, envelope, { uniform = false } = {}) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const sx = safeScale(envelope.length, size.x);
  const sy = safeScale(envelope.height, size.y);
  const sz = safeScale(envelope.width, size.z);
  const scale = uniform ? Math.min(sx, sy, sz) : null;
  object.scale.multiply(new THREE.Vector3(scale ?? sx, scale ?? sy, scale ?? sz));
  object.updateWorldMatrix(true, true);
  const fitted = new THREE.Box3().setFromObject(object);
  const center = fitted.getCenter(new THREE.Vector3());
  object.position.add(new THREE.Vector3(-center.x, -fitted.min.y, -center.z));
  object.updateWorldMatrix(true, true);
  return object;
}

export function findNamedNode(object, ...names) {
  const wanted = new Set(names.map((name) => String(name).toLowerCase()));
  let found = null;
  object.traverse((node) => {
    if (!found && wanted.has(String(node.name).toLowerCase())) found = node;
  });
  return found;
}

function safeScale(target, actual) {
  const next = Number(target) / Number(actual);
  return Number.isFinite(next) && next > 0 ? next : 1;
}
