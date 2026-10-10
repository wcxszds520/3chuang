import * as THREE from 'three';

export function addBox(parent, options) {
  const geometry = options.geometry || new THREE.BoxGeometry(...options.size);
  const mesh = new THREE.Mesh(geometry, options.material);
  configureObject(mesh, options);
  parent.add(mesh);
  return mesh;
}

export function addCylinder(parent, options) {
  const geometry = options.geometry || new THREE.CylinderGeometry(
    options.radiusTop ?? options.radius,
    options.radiusBottom ?? options.radius,
    options.height,
    options.segments || 16
  );
  const mesh = new THREE.Mesh(geometry, options.material);
  configureObject(mesh, options);
  parent.add(mesh);
  return mesh;
}

export function addPlane(parent, options) {
  const geometry = options.geometry || new THREE.PlaneGeometry(...options.size);
  const mesh = new THREE.Mesh(geometry, options.material);
  configureObject(mesh, options);
  parent.add(mesh);
  return mesh;
}

export function addInstancedBoxes(parent, options) {
  const geometry = options.geometry || new THREE.BoxGeometry(...options.size);
  const instances = options.transforms || [];
  const mesh = new THREE.InstancedMesh(geometry, options.material, instances.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  instances.forEach((transform, index) => {
    position.fromArray(transform.position || [0, 0, 0]);
    rotation.setFromEuler(new THREE.Euler(...(transform.rotation || [0, 0, 0])));
    scale.fromArray(transform.scale || [1, 1, 1]);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = options.name || '';
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  parent.add(mesh);
  return mesh;
}

export function addEdges(parent, options) {
  const lines = new THREE.LineSegments(
    new THREE.EdgesGeometry(options.geometry),
    options.material
  );
  configureObject(lines, options);
  parent.add(lines);
  return lines;
}

export function countRenderableParts(root) {
  let count = 0;
  root.traverse((object) => {
    if (object.isMesh || object.isLine || object.isLineSegments) count += object.isInstancedMesh ? object.count : 1;
  });
  return count;
}

function configureObject(object, options) {
  if (options.name) object.name = options.name;
  if (options.position) object.position.fromArray(options.position);
  if (options.rotation) object.rotation.set(...options.rotation);
  if (options.scale) object.scale.fromArray(options.scale);
  object.castShadow = options.castShadow !== false;
  object.receiveShadow = options.receiveShadow !== false;
}
