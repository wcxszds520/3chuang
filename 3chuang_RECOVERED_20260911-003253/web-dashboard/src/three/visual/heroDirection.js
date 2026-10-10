import * as THREE from 'three';
import { FINAL_VISUAL_PROFILE } from './visualProfile.js';
import { applyCargoOpacity, rememberCargoOpacity } from './cargoOpacity.js';

// Presentation-only look. The source GLBs and all placement transforms stay intact.
export const HERO_LOOK = Object.freeze({
  toneMapping:THREE.ACESFilmicToneMapping, exposure:1,
  background:['#071015','#122126','#091216'],
  container:{paint:'#173d36',wall:'#294d45',rail:'#152f2c',floor:'#574331'},
  environment:.28, cargoEnvironment:.4, containerEnvironment:.62, actorEnvironment:.55
});
const originals=new WeakMap();
function remember(m){if(!originals.has(m))originals.set(m,{color:m.color?.clone(),roughness:m.roughness,metalness:m.metalness,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,envMapIntensity:m.envMapIntensity});return originals.get(m);}
function restore(m){const s=remember(m);if(s.color)m.color.copy(s.color);for(const k of ['roughness','metalness','opacity','transparent','depthWrite','envMapIntensity'])if(s[k]!==undefined)m[k]=s[k];}
const eachMaterial=(root,fn)=>{const seen=new Set();root?.traverse(n=>{if(!n.isMesh)return;for(const m of Array.isArray(n.material)?n.material:[n.material])if(m&&!seen.has(m)){seen.add(m);fn(m,n);}});};

export function createHeroBackground(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d'),vertical=ctx.createLinearGradient(0,0,0,512);
  vertical.addColorStop(0,HERO_LOOK.background[0]);vertical.addColorStop(.57,HERO_LOOK.background[1]);vertical.addColorStop(1,HERO_LOOK.background[2]);
  ctx.fillStyle=vertical;ctx.fillRect(0,0,512,512);
  const glow=ctx.createRadialGradient(310,285,20,310,285,340);glow.addColorStop(0,'rgba(65,88,89,.1)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,512,512);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function initializeHeroDirection(runtime){
  runtime.heroBackground=createHeroBackground();runtime.inspectionBackground=runtime.scene.background;runtime.inspectionFog=runtime.scene.fog;
  const {length:l,height:h}=runtime.dimensions;
  const interior=new THREE.RectAreaLight('#f0e2c9',0,l*.7,1.1);interior.position.set(-l*.08,h+.8,.4);interior.rotation.x=-Math.PI/2;runtime.scene.add(interior);
  const door=new THREE.DirectionalLight('#cadcd7',0);door.position.set(l/2+2,h+2,-2);door.target.position.set(l/2-1,h*.5,0);runtime.scene.add(door,door.target);
  runtime.heroLights={interior,door};runtime.heroLabelMaterials=[];
}

export function applyHeroDirection(runtime){
  if(!runtime.heroBackground)return;
  const hero=runtime.presentationMode==='hero',l=runtime.dimensions.length,h=runtime.dimensions.height;
  runtime.scene.background=hero?runtime.heroBackground:runtime.inspectionBackground;
  runtime.scene.fog=hero?new THREE.Fog('#0b171b',24,72):runtime.inspectionFog;
  runtime.scene.environmentIntensity=hero?HERO_LOOK.environment:FINAL_VISUAL_PROFILE.environmentIntensity;
  runtime.renderer.toneMapping=hero?HERO_LOOK.toneMapping:FINAL_VISUAL_PROFILE.toneMapping;
  runtime.renderer.toneMappingExposure=hero?HERO_LOOK.exposure:FINAL_VISUAL_PROFILE.exposure;
  const lights=runtime.directionLights;
  lights.key.color.set(hero?'#fff0d9':'#fff1df');lights.key.intensity=hero?3.8:3.2;lights.key.position.set(...(hero?[-l*.25,h+5,4]:[-3,10,5]));
  lights.fill.color.set(hero?'#c5d9e0':'#d8e3ef');lights.fill.intensity=hero?.9:.7;
  lights.rim.color.set(hero?'#c1d6d2':'#f1f4ff');lights.rim.intensity=hero?3.3:2.1;
  lights.overhead.intensity=hero?1.4:2.5;
  lights.hemi.intensity=hero?.18:.32;
  runtime.heroLights.interior.intensity=hero?2.5:0;runtime.heroLights.door.intensity=hero?1.15:0;
  // Separate painted structural parts from wall/floor/hardware. Clone once by
  // source-material role so a wall look cannot leak into a shared frame material.
  if(runtime.heroContainer){
    const roles=new Map();
    runtime.heroContainer.traverse(n=>{if(!n.isMesh||n.userData.heroRoleAssigned)return;
      const name=n.name.toLowerCase(),role=/floor/.test(name)?'floor':/side_|front_wall|door_panel|corrugat/.test(name)?'wall':/rail|frame|post/.test(name)?'rail':'paint';
      const adapt=m=>{const key=m.uuid+':'+role;if(!roles.has(key)){const clone=m.clone();clone.userData={...m.userData,heroContainerRole:role};roles.set(key,clone);}return roles.get(key);};
      n.material=Array.isArray(n.material)?n.material.map(adapt):adapt(n.material);n.userData.heroRoleAssigned=true;
    });
    eachMaterial(runtime.heroContainer,m=>{restore(m);if(!hero)return;if(m.userData.rebuild_v2){m.envMapIntensity=.35;return;}const role=m.userData.heroContainerRole,name=m.name.toLowerCase();
      if(/coated_steel|paint|container.*green/.test(name)){m.color.set(HERO_LOOK.container[role]||HERO_LOOK.container.paint);m.roughness=Math.max(.48,m.roughness);}
      else if(role==='floor'&&m.color){m.color.multiplyScalar(.8);}
      m.envMapIntensity=HERO_LOOK.containerEnvironment;
    });
  }
  runtime.heroLabelMaterials=[];
  for(const b of runtime.placedBatches.values())eachMaterial(b.mesh,m=>{restore(m);if(m.userData.precisionDetailRole==='label'){runtime.heroLabelMaterials.push(m);return;}if(!hero)return;
    if(m.userData.rebuild_v2){m.envMapIntensity=.45;return;}
    if(m.userData.quality_v1){m.envMapIntensity=.85;return;}
    const name=m.name.toLowerCase();
    // Grade the warm fibre map towards neutral kraft while retaining its texture.
    if(!runtime.externalPresentation&&/kraft_board/.test(name))m.color.setRGB(1.55,1.85,2.25);
    if(/ash_wood/.test(name))m.color.multiplyScalar(1.08);
    if(!runtime.externalPresentation&&/coated_steel/.test(name))m.color.set('#657b78');
    m.envMapIntensity=HERO_LOOK.cargoEnvironment;
  });
  for(const root of [runtime.forklift.group,runtime.worker.group,runtime.palletJack])eachMaterial(root,m=>{restore(m);if(hero){if(/amber/.test(m.name))m.color.set('#987746');m.envMapIntensity=HERO_LOOK.actorEnvironment;}});
  eachMaterial(runtime.worksite.group,(m,n)=>{if(n.name!=='studio-floor')return;restore(m);if(hero){m.color.set('#03080b');m.roughness=.95;}});
  if(hero && new URLSearchParams(window.location.search).get('render')==='quality-v1'){
    // Sample-only studio calibration, independent of which asset version is used.
    runtime.scene.background=new THREE.Color('#18232b');runtime.scene.fog=new THREE.Fog('#18232b',28,70);
    runtime.scene.environmentIntensity=.5;runtime.renderer.toneMappingExposure=.95;
    lights.key.intensity=2.6;lights.fill.intensity=.65;lights.rim.intensity=1.4;lights.hemi.intensity=.25;
    lights.overhead.intensity=2;runtime.heroLights.interior.intensity=1.5;
    lights.key.shadow.normalBias=.002;lights.key.shadow.bias=-.00005;
    eachMaterial(runtime.worksite.group,(m,n)=>{if(n.name==='studio-floor'){m.color.set('#111923');m.roughness=.9;}});
  }
  if(hero && new URLSearchParams(window.location.search).get('render')==='rebuild-v2'){
    runtime.scene.background=new THREE.Color('#252d34');runtime.scene.fog=new THREE.Fog('#252d34',40,80);
    runtime.scene.environmentIntensity=.3;runtime.renderer.toneMappingExposure=1;
    lights.key.color.set('#fff9ef');lights.key.intensity=2.1;lights.key.position.set(-l*.28,h+5,5);
    lights.fill.color.set('#e9f0f7');lights.fill.intensity=.28;lights.rim.intensity=.55;lights.hemi.intensity=.3;
    lights.overhead.intensity=0;runtime.heroLights.interior.intensity=.3;runtime.heroLights.door.intensity=0;
    lights.key.shadow.normalBias=.016;lights.key.shadow.bias=-.00015;
    eachMaterial(runtime.worksite.group,(m,n)=>{if(n.name==='studio-floor'){m.color.set('#21272c');m.roughness=.95;}});
  }
  if(runtime.commerce||new URLSearchParams(window.location.search).get('render')==='industrial-v3'){
    runtime.scene.background=new THREE.Color('#c5ced0');runtime.scene.fog=new THREE.Fog('#c5ced0',55,100);
    runtime.scene.environmentIntensity=.75;runtime.renderer.toneMappingExposure=1;
    lights.key.color.set('#fff1dd');lights.key.intensity=3.1;lights.key.position.set(-3,7,5);
    lights.fill.color.set('#d9ebff');lights.fill.intensity=.7;lights.fill.position.set(5,3,-5);
    lights.rim.intensity=0;lights.hemi.intensity=.22;lights.overhead.intensity=0;
    runtime.heroLights.interior.intensity=0;runtime.heroLights.door.intensity=0;
    lights.key.shadow.normalBias=.002;lights.key.shadow.bias=-.000025;
    eachMaterial(runtime.worksite.group,(m,n)=>{if(n.name==='studio-floor'){m.color.set('#b6c0c1');m.roughness=.87;}});
    eachMaterial(runtime.heroContainer,m=>{if(m.userData.industrial_v3){restore(m);m.envMapIntensity=1;}});
    for(const batch of runtime.placedBatches.values())for(const m of Array.isArray(batch.mesh.material)?batch.mesh.material:[batch.mesh.material])if(m.userData.industrial_v3){restore(m);m.envMapIntensity=1;}
  }
  if(runtime.commerce){
    runtime.scene.background=new THREE.Color('#253039');runtime.scene.fog=new THREE.Fog('#253039',55,100);
    runtime.scene.environmentIntensity=.42;runtime.renderer.toneMappingExposure=1;
    lights.key.color.set('#fff7ed');lights.key.intensity=2.35;lights.key.position.set(-3,7,5);
    lights.fill.color.set('#e4edf5');lights.fill.intensity=.55;lights.rim.intensity=.45;lights.hemi.intensity=.18;
    lights.key.shadow.normalBias=.008;lights.key.shadow.bias=-.00008;
    eachMaterial(runtime.worksite.group,(m,n)=>{if(n.name==='studio-floor'){m.color.set('#283640');m.roughness=.92;}});
  }
  runtime.heroLabelLevel=null;updateHeroPresentation(runtime);
  runtime.renderer.shadowMap.needsUpdate=true;
  runtime.mount.dataset.presentationMode=hero?'hero':'inspection';
}

export function updateHeroPresentation(runtime){
  const hero=runtime.presentationMode==='hero';
  if(hero){
    runtime.worksite.zoneMeshes.forEach(n=>{n.visible=false;});runtime.worksite.debugGrid.visible=false;
    for(const key of ['labels','path','target','evidence','explainedSpace'])runtime.groups[key].visible=false;
    if(runtime.algorithmDiagnostics)runtime.algorithmDiagnostics.visible=false;
    // Actors keep their true operational transforms, but only the door camera
    // includes them in the presentation. Inspection restores normal visibility.
    runtime.groups.actors.visible=runtime.currentView==='hero-door';
  }
  runtime.worksite.group.traverse(n=>{if(n.name.startsWith('dock-ramp-'))n.visible=!hero||runtime.currentView==='hero-door';});
  const distance=runtime.camera.position.distanceTo(runtime.controls.target);
  const opacity=!hero?1:distance<6?1:distance<11?.3:.08;
  if(opacity!==runtime.heroLabelLevel || hero&&(runtime.heroLabelMaterials||[]).some(m=>m.opacity!==rememberCargoOpacity(m).opacity*opacity)){
    runtime.heroLabelLevel=opacity;
    for(const m of runtime.heroLabelMaterials||[])applyCargoOpacity(m,opacity);
  }
}
