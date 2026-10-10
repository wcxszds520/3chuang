import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../web-dashboard/node_modules/three/build/three.module.js';
import { fitPackagingPart } from '../web-dashboard/src/three/cargo/packagingGeometryFit.js';

const root = process.cwd();
const files = {
  carton:'rebuild-v3/cargo_carton.glb',
  wrapped:'rebuild-v3/cargo_wrapped.glb',
  fibc:'rebuild-v3/cargo_fibc.glb',
  crate:'rebuild-v3/cargo_crate.glb',
  equipment_case:'rebuild-v3/cargo_equipment_case.glb',
  palletized:'rebuild-v3/cargo_palletized.glb'
};
function readMeshes(file) {
  const b = fs.readFileSync(file), jsonLength = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20,20+jsonLength)), bin = b.subarray(28+jsonLength);
  const meshes=[];
  function visit(index, parent) {
    const node=j.nodes[index], local=node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(new THREE.Vector3().fromArray(node.translation||[0,0,0]),new THREE.Quaternion().fromArray(node.rotation||[0,0,0,1]),new THREE.Vector3().fromArray(node.scale||[1,1,1]));
    const world=parent.clone().multiply(local);
    for (const primitive of j.meshes?.[node.mesh]?.primitives || []) {
      const accessor=j.accessors[primitive.attributes.POSITION], view=j.bufferViews[accessor.bufferView];
      if (accessor.componentType!==5126) throw new Error('Unsupported position format');
      const vertices=new Float32Array(accessor.count*3), start=(view.byteOffset||0)+(accessor.byteOffset||0);
      for(let i=0;i<accessor.count;i++) for(let axis=0;axis<3;axis++) vertices[i*3+axis]=bin.readFloatLE(start+i*(view.byteStride||12)+axis*4);
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.applyMatrix4(world);geometry.computeBoundingBox();
      meshes.push({name:node.name||'',geometry});
    }
    for(const child of node.children||[]) visit(child,world);
  }
  for(const index of j.scenes[j.scene||0].nodes) visit(index,new THREE.Matrix4());
  return meshes;
}
const results=[];
for(const [family,file] of Object.entries(files)) {
  const meshes=readMeshes(path.join(root,'web-dashboard/public/assets/3d',file));
  const sourceBounds=new THREE.Box3(),labelBounds=new THREE.Box3();
  for(const part of meshes) { sourceBounds.union(part.geometry.boundingBox);if(/label|barcode|text_line/.test(part.name.toLowerCase()))labelBounds.union(part.geometry.boundingBox); }
  for(const [x,y,z] of [[.4,.25,.2],[1.2,1.6,1],[.78,.6,.59],[1.8,.5,.5]]) {
    const dimensions=new THREE.Vector3(x,y,z),bounds=new THREE.Box3();
    for(const part of meshes) {
      const geometry=fitPackagingPart(part.geometry.clone(),{sourceBounds,dimensions,name:part.name,family,labelBounds:family==='carton'?labelBounds:null});
      geometry.computeBoundingBox();bounds.union(geometry.boundingBox);geometry.dispose();
    }
    const excess=Math.max(...['x','y','z'].flatMap(axis=>[Math.abs(bounds.min[axis])-dimensions[axis]/2,Math.abs(bounds.max[axis])-dimensions[axis]/2]));
    results.push({family,dimensionsMeters:[x,y,z],boundsMeters:{min:bounds.min.toArray(),max:bounds.max.toArray()},maximumExcessMm:Math.max(0,excess*1000),pass:excess<.001});
  }
}
fs.writeFileSync(path.join(root,'artifacts/rebuild/asset-envelope-audit.json'),JSON.stringify({model:'PART_AWARE_METRE_FIT_V1',results},null,2));
console.log(JSON.stringify(results.map(({family,dimensionsMeters,maximumExcessMm,pass})=>({family,dimensionsMeters,maximumExcessMm,pass})),null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
