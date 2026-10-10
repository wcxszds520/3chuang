import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Batch a semantically homogeneous subtree; its root transform stays live.
 * Call only on floor or individual door pivots, never across cutaway sections.
 */
export function batchStaticSubtree(root, label) {
  if (!root) return { before:0, after:0 };
  root.updateWorldMatrix(true,true);
  const inverse = root.matrixWorld.clone().invert(), groups = new Map();
  let before = 0;
  root.traverse(node => {
    if (!node.isMesh || node.isSkinnedMesh || !node.visible || Array.isArray(node.material) || node.morphTargetInfluences?.length) return;
    for(let cursor=node.parent;cursor&&cursor!==root;cursor=cursor.parent)if(!cursor.visible)return;
    before++;
    const m = node.material;
    // Equality of the full material contract, excluding object identities.
    // Never call Material.toJSON here: it serializes texture images to canvases
    // for each board. Texture identity and uniform values are sufficient.
    const properties = ['name','type','opacity','transparent','alphaTest','alphaHash','side','depthTest','depthWrite','blending','blendSrc','blendDst','blendEquation','vertexColors','flatShading','roughness','metalness','emissiveIntensity','envMapIntensity','normalMapType','bumpScale','displacementScale','displacementBias','clearcoat','clearcoatRoughness','ior','transmission','thickness','attenuationDistance','sheen','sheenRoughness','specularIntensity','polygonOffset','polygonOffsetFactor','polygonOffsetUnits'];
    const contract = Object.fromEntries(properties.map(key=>[key,m[key]]));
    for(const [key,value] of Object.entries(m)) {
      if(value?.isTexture)contract[key]=value.uuid;
      else if(value?.isColor || value?.isVector2)contract[key]=value.toArray();
    }
    contract.userData=m.userData;
    const key = JSON.stringify(contract);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(node);
  });
  let removed = 0, added = 0;
  for (const nodes of groups.values()) {
    if(nodes.length < 2)continue;
    const geometries = nodes.map(node => {
      const clone = node.geometry.clone();
      const geometry = clone.index ? clone.toNonIndexed() : clone;
      if (clone !== geometry) clone.dispose();
      for(const name of Object.keys(geometry.attributes)) if(!['position','normal','uv'].includes(name)) geometry.deleteAttribute(name);
      if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
      if(!geometry.getAttribute('uv'))geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
      return geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
    });
    const merged = mergeGeometries(geometries,false); geometries.forEach(g=>g.dispose());
    if(!merged)continue;
    const mesh = new THREE.Mesh(merged,nodes[0].material.clone());
    mesh.name=`${label}-batch-${added}`;mesh.castShadow=nodes.some(n=>n.castShadow);mesh.receiveShadow=nodes.some(n=>n.receiveShadow);
    const oldGeometries=new Set(nodes.map(n=>n.geometry)), oldMaterials=new Set(nodes.map(n=>n.material));
    nodes.forEach(node=>node.removeFromParent());
    oldGeometries.forEach(g=>g.dispose()); oldMaterials.forEach(m=>m.dispose());
    root.add(mesh); removed+=nodes.length; added++;
  }
  root.updateWorldMatrix(true,true);
  return { before, after:before-removed+added };
}
