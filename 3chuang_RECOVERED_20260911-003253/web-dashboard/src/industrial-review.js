import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
const $=id=>document.getElementById(id),stage=$('stage');
const r=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});r.setPixelRatio(Math.min(devicePixelRatio,1.5));r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1;r.outputColorSpace=T.SRGBColorSpace;r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;stage.appendChild(r.domElement);
const scene=new T.Scene();scene.background=new T.Color('#c5ced0');const cam=new T.PerspectiveCamera(36,1,.01,150),orbit=new OrbitControls(cam,r.domElement);orbit.enableDamping=true;orbit.maxPolarAngle=Math.PI*.495;
const room=new RoomEnvironment(),pm=new T.PMREMGenerator(r);scene.environment=pm.fromScene(room,.04).texture;scene.environmentIntensity=.75;room.dispose();pm.dispose();
const key=new T.DirectionalLight('#fff1dd',3.1);key.position.set(-3,7,5);key.castShadow=true;key.shadow.mapSize.set(4096,4096);Object.assign(key.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.1,far:35});key.shadow.bias=-.000025;key.shadow.normalBias=.002;key.shadow.radius=3;scene.add(key);
const fill=new T.DirectionalLight('#d9ebff',.7);fill.position.set(5,3,-5);scene.add(fill,new T.HemisphereLight('#daeaff','#867964',.22));
const ground=new T.Mesh(new T.PlaneGeometry(2000,2000),new T.MeshStandardMaterial({color:'#b6c0c1',roughness:.87}));ground.rotation.x=-Math.PI/2;ground.position.y=-.13;ground.receiveShadow=true;scene.add(ground);
const composer=new EffectComposer(r);composer.renderTarget1.samples=4;composer.renderTarget2.samples=4;composer.addPass(new RenderPass(scene,cam));const ao=new GTAOPass(scene,cam,1,1);ao.blendIntensity=.6;ao.updateGtaoMaterial({radius:.16,samples:16,thickness:.3});composer.addPass(ao);composer.addPass(new OutputPass());
const loader=new GLTFLoader(),manifest=await fetch('/assets/3d/industrial-v3/manifest.json').then(r=>r.json()),oldManifest=await fetch('/assets/3d/rebuild-v2/manifest.json').then(r=>r.json());let group=new T.Group();scene.add(group);let serial=0,old=false,cut=true,currentDims=[1,1,1],last=performance.now(),frames=0;
function tune(obj){obj.traverse(n=>{if(!n.isMesh)return;n.castShadow=n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material]){m.envMapIntensity=1;for(const t of Object.values(m))if(t?.isTexture)t.anisotropy=Math.min(16,r.capabilities.getMaxAnisotropy());if(m.transparent)m.depthWrite=false;}});}
function framing(far=false){const [l,w,h]=currentDims,max=Math.max(l,w,h),line=$('asset').value==='lineup';orbit.target.set(0,h*.44,0);cam.position.set(max*(line?.12:l>5?.5:1.24)*(far?1.8:1),h*.55+max*(line?.2:l>5?.28:.67)*(far?1.8:1),max*(line?1.1:l>5?.95:1.7)*(far?1.8:1));orbit.update();}
function cutaway(){group.traverse(n=>{if(n.isMesh&&(/side_left|roof/.test(n.name)))n.visible=!cut;});}
async function load(){const revision=++serial;$('status').textContent='载入中…';$('error').textContent='';const name=$('asset').value;const names=name==='lineup'?['carton','crate','flightcase','wrapped','drum','ibc']:[name];const next=new T.Group();let xpos=0,shownTriangles=0;
 try{for(const id of names){const a=manifest.assets.find(a=>a.id===id);let url=a.url;let baseline;
 if(old){baseline=id==='container'?{url:'/assets/3d/rebuild-v2/container-40hq.glb',dimensionsM:a.dimensionsM}:oldManifest.assets.find(x=>x.family===({flightcase:'equipment_case',wrapped:'palletized'}[id]||id));if(baseline)url=baseline.url;}
 const gltf=await loader.loadAsync(url);const obj=gltf.scene;tune(obj);obj.traverse(n=>{if(n.isMesh)shownTriangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;});
 if(old&&baseline&&id!=='container'){const b=new T.Box3().setFromObject(obj),sz=b.getSize(new T.Vector3());obj.scale.set(a.dimensionsM[0]/sz.x,a.dimensionsM[2]/sz.y,a.dimensionsM[1]/sz.z);obj.updateMatrixWorld(true);const b2=new T.Box3().setFromObject(obj);obj.position.y=-b2.min.y;}
 if(name==='lineup'){obj.position.x=xpos+a.dimensionsM[0]/2;xpos+=a.dimensionsM[0]+.3;}next.add(obj);}
 if(revision!==serial)return;scene.remove(group);group=next;scene.add(group);if(name==='lineup')group.position.x=-(xpos-.3)/2;
 currentDims=name==='lineup'?[xpos,1,1.5]:manifest.assets.find(a=>a.id===name).dimensionsM;ground.position.y=name==='container'?-.13:-.002;cutaway();framing();
 const spec=manifest.assets.find(a=>a.id===name);$('title').textContent=spec?.title||'六类包装 · 各有结构';$('dim').textContent=spec?currentDims.map(x=>Math.round(x*1000)).join(' × ')+' mm':'';$('status').textContent=(old?'旧版按同尺寸对照；钢桶与 IBC 无旧版':'Blender MCP · 真实米制模型')+(spec?' · '+shownTriangles.toLocaleString()+' 三角面':'');document.body.dataset.ready=name;document.body.dataset.version=old?'v2':'v3';
 }catch(e){$('error').textContent=e.message;console.error(e);}}
$('hardware').onclick=()=>{if($('asset').value==='container'){orbit.target.set(6.06,2.65,1.15);cam.position.set(6.7,3.18,2.0);orbit.update();}else framing();};$('asset').onchange=load;$('near').onclick=()=>framing();$('far').onclick=()=>framing(true);$('cut').onclick=()=>{cut=!cut;$('cut').setAttribute('aria-pressed',cut);cutaway();};$('old').onclick=()=>{old=!old;$('old').setAttribute('aria-pressed',old);load();};$('rotate').onclick=()=>{orbit.autoRotate=!orbit.autoRotate;$('rotate').setAttribute('aria-pressed',orbit.autoRotate);};
function resize(){const w=stage.clientWidth,h=stage.clientHeight;r.setSize(w,h);composer.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix();}new ResizeObserver(resize).observe(stage);resize();r.setAnimationLoop(()=>{orbit.update();composer.render();frames++;if(performance.now()-last>1500){$('stats').textContent=Math.round(frames*1000/(performance.now()-last))+' FPS';frames=0;last=performance.now();}});load();
if(import.meta.hot)import.meta.hot.dispose(()=>{r.setAnimationLoop(null);orbit.dispose();composer.dispose();r.dispose();r.forceContextLoss();r.domElement.remove();});
