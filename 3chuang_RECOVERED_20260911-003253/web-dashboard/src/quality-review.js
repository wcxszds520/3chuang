import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {createPrecisionGeometry} from './three/cargo/PrecisionCargoFactory.js';
const stage=document.querySelector('#stage'),status=document.querySelector('#status'),familySelect=document.querySelector('#family');
const scene=new THREE.Scene();scene.background=new THREE.Color('#253039');scene.fog=new THREE.Fog('#253039',7,24);
const camera=new THREE.PerspectiveCamera(38,1,.01,60),renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.info.autoReset=false;stage.appendChild(renderer.domElement);
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
const key=new THREE.DirectionalLight('#fff0dc',3.2);key.position.set(-3,5,3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:20});key.shadow.bias=-.00012;key.shadow.normalBias=.008;scene.add(key);
const fill=new THREE.DirectionalLight('#d5e9ff',1.0);fill.position.set(4,3,-4);scene.add(fill,new THREE.HemisphereLight('#d3dde3','#32302b',.55));
const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:'#151c23',roughness:.88}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=.4;controls.maxDistance=14;
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const ao=new GTAOPass(scene,camera,1,1);ao.blendIntensity=.48;ao.updateGtaoMaterial({radius:.16,thickness:1,distanceExponent:1,scale:1,samples:16});composer.addPass(ao);composer.addPass(new OutputPass());
const loader=new GLTFLoader();let version='quality-v1',model,serial=0,frames=0,then=performance.now();
function resize(){const w=stage.clientWidth,h=stage.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);composer.setSize(w,h);ao.setSize(Math.round(w*.5),Math.round(h*.5))}new ResizeObserver(resize).observe(stage);
function reset(){const big=familySelect.value==='container_section',small=familySelect.value==='carton';controls.target.set(0,big?1.25:small?.20:.40,0);camera.position.set(big?4.8:small?.95:1.65,big?3.2:small?.70:1.12,big?4.8:small?1.15:1.85);controls.update()}
async function load(){const id=++serial,family=familySelect.value;status.textContent='加载中…';status.className='';document.querySelector('#heading').textContent=familySelect.selectedOptions[0].textContent;
 document.querySelectorAll('[data-version]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.version===(family==='container_section'?'quality-v1':version)));b.disabled=family==='container_section'&&b.dataset.version!=='quality-v1'});
 try{const effective=family==='container_section'?'quality-v1':version;const g=await loader.loadAsync('/assets/3d/'+effective+'/'+family+'.glb');if(id!==serial)return;
 if(model){scene.remove(model);model.traverse(n=>{n.geometry?.dispose();if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose()})}
 if(family==='container_section'){model=g.scene;const b=new THREE.Box3().setFromObject(model);model.position.y-=b.min.y;}else{const dim=family==='carton'?[.6,.4,.4]:[1,.8,.8];const result=createPrecisionGeometry(g.scene,dim);model=new THREE.Mesh(result.geometry,result.materials);model.position.y=dim[2]/2;}
 model.traverse(n=>{if(!n.isMesh)return;n.castShadow=n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material]){m.envMapIntensity=1;for(const x of Object.values(m))if(x?.isTexture)x.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}});scene.add(model);renderer.shadowMap.needsUpdate=true;reset();status.textContent=effective+' · '+(family==='container_section'?'柜体与五金局部':'尺寸与构件按真实比例');document.body.dataset.ready=family+':'+effective;
 }catch(e){status.textContent=e.message;status.className='error';console.error(e)}}
document.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>{version=b.dataset.version;load()});familySelect.onchange=load;document.querySelector('#reset').onclick=reset;document.querySelector('#rotate').onclick=e=>{controls.autoRotate=!controls.autoRotate;e.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate))};
renderer.setAnimationLoop(()=>{controls.update();renderer.info.reset();composer.render();frames++;const now=performance.now();if(now-then>1200){document.querySelector('#stats').textContent=Math.round(frames*1000/(now-then))+' FPS · '+renderer.info.render.triangles.toLocaleString()+' triangles';frames=0;then=now;}});resize();load();
