import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {presentationPlan,NEUTRAL_VARIANTS} from '../../../../shared/heroPresentation.mjs';
import {createPrecisionGeometry,originalDimensionsM,precisionOrientation} from './PrecisionCargoFactory.js';

// CPU test of the actual exported binary meshes. Texture decoding is omitted;
// Chrome screenshots independently cover material appearance.
const cache=new Map();
async function loadAsset(variant){
 const id=variant.startsWith('neutral_')?'neutral_panel_standard':variant;
 if(cache.has(id))return cache.get(id);
 const bytes=readFileSync(new URL(`../../../public/assets/3d/external-hero-v1/${id}.glb`,import.meta.url));
 const size=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+size).toString());
 const omit=obj=>{for(const key of Object.keys(obj)){if(/texture$/i.test(key))delete obj[key];else if(obj[key]&&typeof obj[key]==='object')omit(obj[key]);}};
 for(const mat of data.materials||[])omit(mat);
 delete data.images;delete data.textures;delete data.samplers;
 data.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size,28+size+data.buffers[0].byteLength).toString('base64');
 if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class {constructor(type,values){this.type=type;Object.assign(this,values);}};
 const scene=(await new GLTFLoader().parseAsync(JSON.stringify(data),'')).scene;cache.set(id,scene);return scene;
}
function within(box,dimensions){
 const half=[dimensions[0]/2,dimensions[2]/2,dimensions[1]/2];
 for(let axis=0;axis<3;axis++){
  expect(box.min.getComponent(axis)).toBeGreaterThanOrEqual(-half[axis]-.00002);
  expect(box.max.getComponent(axis)).toBeLessThanOrEqual(half[axis]+.00002);
 }
}
it('keeps every saved Hero placement envelope intact with new frames and braces',async()=>{
 const saved=JSON.parse(readFileSync(new URL('../../../../artifacts/external-hero/evidence/hero-created-solved.json',import.meta.url)));
 const immutable=JSON.stringify(saved.backendPlan),plan=presentationPlan(saved.backendPlan,saved.cargo,{enabled:true});
 for(const p of plan.loadedCargo){
  const result=createPrecisionGeometry(await loadAsset(p.presentationProfile.structuralVariant),originalDimensionsM(p),p.presentationProfile);
  const box=result.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(precisionOrientation(p)));
  within(box,[p.l/1000,p.w/1000,p.h/1000]);
  expect([...result.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
  result.geometry.dispose();result.materials.forEach(m=>m.dispose());
 }
 expect(JSON.stringify(saved.backendPlan)).toBe(immutable);
},30000);
it('keeps neutral structural profiles within both normal and thin test envelopes',async()=>{
 for(const variant of NEUTRAL_VARIANTS)for(const dims of [[1.2,.8,.65],[1.6,.42,.18]]){
  const profile={version:'external-hero-v1',presentationFamily:'NEUTRAL_INDUSTRIAL_PACKAGE',structuralVariant:variant,colorVariant:'#82918a'};
  const result=createPrecisionGeometry(await loadAsset(variant),dims,profile);within(result.geometry.boundingBox,dims);
  result.geometry.dispose();result.materials.forEach(m=>m.dispose());
 }
},30000);
