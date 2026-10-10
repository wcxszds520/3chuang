import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const manifestPromises=new Map();
export const industrialAssetMode=()=>new URLSearchParams(window.location.search).get('assets')==='industrial-v3';
export const exactAssetMode=()=>industrialAssetMode()||new URLSearchParams(window.location.search).get('assets')==='rebuild-v2';
export function exactManifest(requested){const version=requested||(industrialAssetMode()?'industrial-v3':'rebuild-v2');if(!manifestPromises.has(version))manifestPromises.set(version,fetch('/assets/3d/'+version+'/manifest.json').then(r=>{if(!r.ok)throw Error('缺少规格模型索引');return r.json();}));return manifestPromises.get(version);}
export function exactGeometryKey(key){return key.split(':').slice(0,4).join(':');}
export function findExactSpec(manifest,key){const row=manifest.assets.find(a=>a.key===key)||manifest.assets.find(a=>exactGeometryKey(a.key)===exactGeometryKey(key));if(!row)throw Error('该真实规格尚无重建模型：'+key);return row;}
export async function loadExactCargoAsset(key,level){
 const commerce=/^cv[46]_/.test(key),lookup=commerce?key.slice(4):key,query=new URLSearchParams(window.location.search),version=key.startsWith('cv6_')?'commerce-v6':'commerce-v4';
 let manifest=await exactManifest(commerce?version:undefined);
 if(commerce&&!manifest.assets.some(a=>a.key===lookup)){manifestPromises.delete(version);manifest=await exactManifest(version);}
 let row=findExactSpec(manifest,lookup);
 // Versioned visual review changes only the displayed asset with an identical
 // dimensional key; cargo facts, saved plans and production defaults stay intact.
 if(commerce&&query.get('assets')==='commerce-v6'){
  const review=await exactManifest('commerce-v6');row=review.assets.find(a=>a.key===row.key)||row;
 }
 const lod=level ? level==='low' : commerce?query.get('lod')==='1':industrialAssetMode()&&query.get('lod')!=='0';
 const {scene}=await new GLTFLoader().loadAsync(lod&&row.lodUrl?(row.runtimeLodUrl||row.lodUrl):(row.runtimeUrl||row.url));scene.userData.exactSpec=row;return scene;
}
export function exactCargoGeometry(prototype,dimensions){
 const spec=prototype.userData.exactSpec;if(!spec||spec.dimensionsM.some((v,i)=>Math.abs(v-dimensions[i])>1e-7))throw Error('模型规格与货物尺寸不匹配');
 prototype.updateMatrixWorld(true);const parts=[],materials=[];
 prototype.traverse(n=>{if(!n.isMesh)return;let g=n.geometry.clone();if(g.index){const old=g;g=old.toNonIndexed();old.dispose();}g.applyMatrix4(n.matrixWorld);for(const a of Object.keys(g.attributes))if(!['position','normal','uv'].includes(a))g.deleteAttribute(a);if(!g.getAttribute('uv'))g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));const m=n.material.clone();m.userData={...m.userData,rebuild_v2:true,precisionDetailRole:/label/i.test(n.name)?'label':'structure'};m.envMapIntensity=.45;materials.push(m);parts.push(g);});
 const geometry=mergeGeometries(parts,true);parts.forEach(p=>p.dispose());if(spec.origin==='floor-center')geometry.translate(0,-dimensions[2]/2,0);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const size=geometry.boundingBox.getSize(new THREE.Vector3()),expected=[dimensions[0],dimensions[2],dimensions[1]];
 if(size.toArray().some((v,i)=>v>expected[i]+.0001))throw Error('Blender 模型超出真实外形尺寸');
 return {geometry,materials,dimensions,contract:'exact-size-v2'};
}
