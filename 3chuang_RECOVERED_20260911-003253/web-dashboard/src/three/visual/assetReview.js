import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { heroAssetRegistry } from '../assets/AssetRegistry.js';
import { createPrecisionGeometry, precisionOrientation, placementAxisMap } from '../cargo/PrecisionCargoFactory.js';
import { FINAL_VISUAL_PROFILE as profile, configureAssetSampling } from './visualProfile.js';

const assets = {
  carton: ['precision_carton', [.6,.4,.4]],
  carton_reinforced: ['precision_carton_reinforced', [.6,.4,.4]],
  crate: ['precision_crate', [1,.8,.8]],
  equipment_case: ['precision_equipment_case', [1,.8,.8]],
  palletized: ['precision_palletized', [1.2,.8,1.15]],
  crate_reinforced: ['precision_crate_reinforced', [1,.8,.8]],
  equipment_case_reinforced: ['precision_equipment_case_reinforced', [1,.8,.8]],
  palletized_industrial: ['precision_palletized_industrial', [1.2,.8,1.15]],
  wrapped: ['precision_wrapped', [1.2,.8,1.15]],
  'container-40hq': ['container40hq'], worker_articulated: ['workerA'],
  forklift_articulated: ['forkliftStandard'], pallet_jack_articulated: ['palletJack']
};
const stage = document.querySelector('#stage');
const scene = new THREE.Scene(); scene.background = new THREE.Color(profile.background);
scene.environmentIntensity = profile.environmentIntensity;
const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
renderer.setSize(800,600); renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=profile.toneMapping; renderer.toneMappingExposure=profile.exposure;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
const pmrem=new THREE.PMREMGenerator(renderer); const room=new RoomEnvironment();
scene.environment=pmrem.fromScene(room,.04).texture; room.dispose(); pmrem.dispose();
const camera=new THREE.PerspectiveCamera(35,4/3,.001,1000);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true;
scene.add(new THREE.HemisphereLight('#eee9df','#252321',.32));
const key=new THREE.DirectionalLight('#fff1df',3.2); key.castShadow=true; key.shadow.mapSize.set(2048,2048); scene.add(key,key.target);
const fill=new THREE.DirectionalLight('#d8e3ef',.7);scene.add(fill,fill.target);
const rim=new THREE.DirectionalLight('#f1f4ff',2.1);scene.add(rim,rim.target);
RectAreaLightUniformsLib.init();
const overhead=new THREE.RectAreaLight('#fffaf1',2.5,8,3.8);overhead.rotation.x=-Math.PI/2;scene.add(overhead);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#383b3d',roughness:.85}));
floor.rotation.x=-Math.PI/2; floor.receiveShadow=true;scene.add(floor);
let object, bounds, radius, center, selection='carton', distance='MEDIUM', orientation='LWH', fixture, sequence=0;

function facts() {
  const materials=[];object?.traverse(n=>{if(!n.isMesh)return;for(const m of Array.isArray(n.material)?n.material:[n.material]){
    if(materials.some(v=>v.uuid===m.uuid))continue;
    materials.push({uuid:m.uuid,name:m.name,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,side:m.side,
      textures:Object.entries(m).filter(([,t])=>t?.isTexture).map(([slot,t])=>({slot,colorSpace:t.colorSpace,anisotropy:t.anisotropy,width:t.image?.width,height:t.image?.height}))});
  }});
  return {asset:selection,assetId:assets[selection][0],distance,fixture,orientation:fixture?.orientationId,axisMap:fixture?placementAxisMap(fixture):null,
    glbRootQuaternion:object?.quaternion.toArray(),camera:camera.position.toArray(),target:center?.toArray(),fov:35,clip:{near:camera.near,far:camera.far},
    bounds:bounds?{min:bounds.min.toArray(),max:bounds.max.toArray()}:null,profile,maxAnisotropy:renderer.capabilities.getMaxAnisotropy(),materials};
}
function frame() {
  if(!object)return;
  const d=radius/Math.sin(THREE.MathUtils.degToRad(17.5))*({NEAR:1.1,MEDIUM:1.6,FAR:2.6}[distance]);
  camera.position.copy(center).add(new THREE.Vector3(1,.65,1).normalize().multiplyScalar(d));
  controls.target.copy(center);camera.lookAt(center);controls.update();
  document.querySelectorAll('[data-distance]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.distance===distance)));
  const report=facts();document.querySelector('#facts').textContent=JSON.stringify({asset:selection,distance,fixture,axisMap:report.axisMap,glbRootQuaternion:report.glbRootQuaternion,profile},null,2);
}
async function show(id=selection,pose=orientation) {
  const revision=++sequence; selection=id;orientation=pose;
  document.querySelector('#facts').textContent='LOADING';
  const [assetId,dimensions]=assets[id];
  const loaded=await heroAssetRegistry.clone(assetId);if(revision!==sequence)return;
  if(object){scene.remove(object);object.traverse(n=>{n.geometry?.dispose();for(const m of (Array.isArray(n.material)?n.material:[n.material]).filter(Boolean))m.dispose();});}
  const kind=dimensions?'cargo':id.startsWith('container')?'container':'actor';
  configureAssetSampling(loaded.scene,kind,renderer);
  fixture=null;
  if(dimensions){
    const [l,w,h]=dimensions;
    fixture={cargoId:`VISUAL_FIXTURE_${id}`,orientationId:pose,l:(pose==='WLH'?w:l)*1000,w:(pose==='WLH'?l:w)*1000,h:h*1000,
      allowedOrientations:['LWH','WLH'],cargoPhysicalProfile:{dimensions:{lengthMm:l*1000,widthMm:w*1000,heightMm:h*1000}}};
    const bundle=createPrecisionGeometry(loaded.scene,dimensions);object=new THREE.Mesh(bundle.geometry,bundle.materials);object.quaternion.copy(precisionOrientation(fixture));
  }else object=loaded.scene;
  object.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});scene.add(object);
  bounds=new THREE.Box3().setFromObject(object);center=bounds.getCenter(new THREE.Vector3());radius=bounds.getSize(new THREE.Vector3()).length()/2;
  // Scale the depth range with the inspected asset; 1 mm / 1000 m loses
  // separation between real thin panel and label layers in the far view.
  camera.near=radius*.05;camera.far=radius*30;camera.updateProjectionMatrix();
  floor.position.y=bounds.min.y-.002;
  overhead.position.copy(center).add(new THREE.Vector3(0,radius*3,0));overhead.width=radius*6;overhead.height=radius*3;
  for(const [light,vector]of [[key,[-3,10,5]],[fill,[8,4,7]],[rim,[2,6,-6]]]){
    light.position.copy(center).add(new THREE.Vector3(...vector).normalize().multiplyScalar(radius*5));light.target.position.copy(center);
  }
  const sc=key.shadow.camera;sc.left=-radius*1.5;sc.right=radius*1.5;sc.top=radius*1.5;sc.bottom=-radius*1.5;sc.near=.001;sc.far=radius*12;sc.updateProjectionMatrix();
  key.shadow.bias=-.00012;key.shadow.normalBias=.001;
  document.querySelector('#orientation').disabled=!dimensions;frame();
  await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
  return facts();
}
for(const id of Object.keys(assets))document.querySelector('#asset').add(new Option(id,id));
document.querySelector('#asset').onchange=e=>show(e.target.value);
document.querySelector('#orientation').onchange=e=>show(selection,e.target.value);
document.querySelectorAll('[data-distance]').forEach(b=>b.onclick=()=>{distance=b.dataset.distance;frame();});
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
// Readback and deterministic reference framing for the development CDP surface.
window.assetReview={show,frame:(value)=>{distance=value;frame();return facts();},facts,shadowNormalBias:(value)=>{key.shadow.normalBias=value;}};
await show();
