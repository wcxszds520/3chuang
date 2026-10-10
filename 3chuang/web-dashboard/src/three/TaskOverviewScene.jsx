import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heroAssetRegistry } from './assets/AssetRegistry.js';
import { assetKeyForContainer } from './assets/assetManifest.js';
import { calibrateContainerAsset } from './assets/assetCoordinateAdapter.js';
import { loadPackagingAsset } from './cargo/loadPackagingAsset.js';
import { cargoVisualBatchKey, cargoVisualDimensions, fitPackagingPart } from './cargo/packagingGeometryFit.js';
import { classifyCargoAppearance } from '../domain/cargo/appearance.js';
import { computeCameraFrame } from './presentation/cameraPresets.js';

// A cabinet transform affects presentation only. Placements retain their own
// millimetre coordinate system; instances are shared across cabinet positions.
export default function TaskOverviewScene({containers,ownerColors={},ownerMode=false,onFocus,onError}){
  const host=useRef(null),callbacks=useRef({onFocus,onError}),runtime=useRef(null);
  callbacks.current={onFocus,onError};
  const [labels,setLabels]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const mount=host.current;
    let disposed=false,frame=0,tween=null,pointerStart=null,lastLabels='';
    const scene=new THREE.Scene();scene.background=new THREE.Color('#e1e8eb');
    const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
    mount.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','全部柜位三维总览，可旋转缩放并点击柜位');
    const camera=new THREE.PerspectiveCamera(38,1,.1,500),controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=3;controls.maxDistance=120;
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);
    scene.environment=environment.texture;room.dispose();pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff,0x8496a0,2));const light=new THREE.DirectionalLight(0xfff5e8,2.7);light.position.set(8,16,8);scene.add(light);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshStandardMaterial({color:'#d2dde1',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.13;scene.add(ground);
    const columns=Math.min(3,Math.max(1,Math.ceil(containers.length/3)));
    const maxLength=Math.max(6,...containers.map(c=>c.equipment.innerLength*.001));
    const entries=containers.map((cab,index)=>({cab,x:(index%columns)*(maxLength+3),z:Math.floor(index/columns)*5.8}));
    const bounds=new THREE.Box3();
    entries.forEach(({cab,x,z})=>{const e=cab.equipment;bounds.expandByPoint(new THREE.Vector3(x-e.innerLength*.0005,0,z-e.innerWidth*.0005));bounds.expandByPoint(new THREE.Vector3(x+e.innerLength*.0005,e.innerHeight*.001,z+e.innerWidth*.0005));});
    bounds.expandByScalar(.35);
    const fit=()=>{const size=mount.getBoundingClientRect();if(!size.width||!size.height)return;renderer.setSize(size.width,size.height);camera.aspect=size.width/size.height;camera.updateProjectionMatrix();if(!runtime.current?.touched){const framing=computeCameraFrame({bounds,direction:new THREE.Vector3(.55,.85,1),up:new THREE.Vector3(0,1,0),verticalFov:THREE.MathUtils.degToRad(camera.fov),aspect:camera.aspect,margin:.84});controls.target.copy(framing.target);camera.position.copy(framing.position);}controls.update();};
    const choose=containerId=>{
      const entry=entries.find(e=>e.cab.containerId===containerId);if(!entry)return;
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){callbacks.current.onFocus?.(containerId);return;}
      const target=new THREE.Vector3(entry.x,entry.cab.equipment.innerHeight*.0005,entry.z);
      const length=entry.cab.equipment.innerLength*.001;
      tween={start:performance.now(),from:camera.position.clone(),targetFrom:controls.target.clone(),target,to:target.clone().add(new THREE.Vector3(length*.7,length*.75,length*.85)),containerId};
    };
    runtime.current={choose,touched:false,batches:[]};
    const observer=new ResizeObserver(fit);observer.observe(mount);fit();
    controls.addEventListener('start',()=>{runtime.current.touched=true;tween=null;});
    const raycaster=new THREE.Raycaster();
    const down=e=>{pointerStart=[e.clientX,e.clientY];};
    const up=e=>{if(!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5)return;const box=mount.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1),camera);const hit=raycaster.intersectObjects(scene.children,true).find(h=>h.object.userData.containerId||h.object.userData.containerIds);if(hit)choose(hit.object.userData.containerId||hit.object.userData.containerIds[hit.instanceId]);};
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
    setLoading(true);
    const batches=new Map();
    const jobs=entries.map(async({cab,x,z})=>{
      const asset=await heroAssetRegistry.clone(assetKeyForContainer(cab.equipment.typeId));
      if(disposed){disposeTree(asset.scene);return;}
      const e=cab.equipment;calibrateContainerAsset(asset.scene,e.typeId,{length:e.innerLength*.001,width:e.innerWidth*.001,height:e.innerHeight*.001});
      asset.scene.traverse(node=>{node.userData.containerId=cab.containerId;const names=[];for(let parent=node;parent;parent=parent.parent)names.push(parent.name.toLowerCase());const lineage=names.join('/');if(lineage.includes('side_left')||lineage.includes('roof')||(!lineage.includes('door_')&&lineage.includes('container_static_assembly'))||/label_portcube|label_subtitle/.test(node.name.toLowerCase()))node.visible=false;});
      asset.scene.position.add(new THREE.Vector3(x,0,z));scene.add(asset.scene);
    });
    entries.forEach(({cab,x,z})=>cab.plan.loadedCargo.forEach(item=>{const key=cargoVisualBatchKey(item);if(!batches.has(key))batches.set(key,[]);batches.get(key).push({item,containerId:cab.containerId,position:new THREE.Vector3(x+(item.x+item.l/2-cab.equipment.innerLength/2)*.001,(item.y+item.h/2)*.001,z+(item.z+item.w/2-cab.equipment.innerWidth/2)*.001)});}));
    for(const rows of batches.values())jobs.push((async()=>{
      const sample=rows[0].item,family=classifyCargoAppearance(sample).key,asset=await loadPackagingAsset(family);
      if(disposed){disposeTree(asset.scene);return;}
      asset.scene.updateMatrixWorld(true);const sourceBounds=new THREE.Box3().setFromObject(asset.scene),labelBounds=new THREE.Box3();
      asset.scene.traverse(node=>{if(node.isMesh&&/label|barcode|text_line/.test(node.name.toLowerCase()))labelBounds.union(new THREE.Box3().setFromObject(node));});
      const groups=new Map();
      asset.scene.traverse(node=>{
        if(!node.isMesh)return;let geometry=node.geometry.clone();if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}geometry.applyMatrix4(node.matrixWorld);
        for(const attribute of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(attribute))geometry.deleteAttribute(attribute);
        if(!geometry.attributes.normal)geometry.computeVertexNormals();if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
        fitPackagingPart(geometry,{sourceBounds,dimensions:cargoVisualDimensions(sample),name:node.name,labelBounds:labelBounds.isEmpty()?undefined:labelBounds,family});
        const material=Array.isArray(node.material)?node.material[0]:node.material;
        if(!groups.has(material.uuid))groups.set(material.uuid,{material:material.clone(),parts:[]});groups.get(material.uuid).parts.push(geometry);
      });
      for(const {material,parts} of groups.values()){
        const geometry=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());if(!geometry){material.dispose();continue;}
        const mesh=new THREE.InstancedMesh(geometry,material,rows.length);mesh.userData.containerIds=rows.map(r=>r.containerId);
        rows.forEach((row,index)=>mesh.setMatrixAt(index,new THREE.Matrix4().makeTranslation(...row.position.toArray())));mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);runtime.current.batches.push({mesh,rows,original:material.color.clone()});
      }
      disposeTree(asset.scene);
    })());
    Promise.allSettled(jobs).then(results=>{if(disposed)return;const failed=results.find(r=>r.status==='rejected');if(failed)callbacks.current.onError?.(`总览资产加载失败：${failed.reason.message}`);mount.dataset.cabinetCount=String(containers.length);mount.dataset.placementCount=String(entries.reduce((sum,e)=>sum+e.cab.plan.loadedCargo.length,0));setLoading(false);});
    const render=time=>{if(disposed)return;if(tween){const t=Math.min(1,(time-tween.start)/450),ease=1-(1-t)**3;camera.position.lerpVectors(tween.from,tween.to,ease);controls.target.lerpVectors(tween.targetFrom,tween.target,ease);if(t===1){const id=tween.containerId;tween=null;callbacks.current.onFocus?.(id);}}controls.update();renderer.render(scene,camera);
      const box=mount.getBoundingClientRect();const projected=entries.map(({cab,x,z})=>{const point=new THREE.Vector3(x,cab.equipment.innerHeight*.001+.35,z).project(camera);return{id:cab.containerId,text:`${cab.label} · ${cab.equipment.typeId} · ${cab.plan.loadedCargo.length} 件`,x:Math.round((point.x+1)*box.width/2),y:Math.round((1-point.y)*box.height/2),visible:point.z<1&&Math.abs(point.x)<.9&&Math.abs(point.y)<.88};});const signature=JSON.stringify(projected);if(signature!==lastLabels){lastLabels=signature;setLabels(projected);}frame=requestAnimationFrame(render);};frame=requestAnimationFrame(render);
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();disposeTree(scene);environment.texture.dispose();renderer.dispose();renderer.domElement.remove();runtime.current=null;};
  },[containers]);
  useEffect(()=>{for(const {mesh,rows,original} of runtime.current?.batches || []){mesh.material.color.copy(ownerMode?new THREE.Color('white'):original);rows.forEach((row,index)=>mesh.setColorAt(index,new THREE.Color(ownerMode?ownerColors[row.item.customerId]||'#70858f':'white')));if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}},[ownerMode,ownerColors,loading]);
  return <div className="task-overview-scene"><div ref={host} className="task-overview-canvas"/>{labels.filter(l=>l.visible).map(label=><button className="task-world-label" key={label.id} style={{left:label.x,top:label.y}} onClick={()=>runtime.current?.choose(label.id)}>{label.text}</button>)}{loading&&<span className="task-scene-loading">正在加载逐柜实物模型…</span>}<span className="task-scene-hint">拖拽旋转 · 滚轮缩放 · 点击柜位聚焦</span></div>;
}

function disposeTree(root){const geometry=new Set(),material=new Set();root.traverse(node=>{if(node.geometry)geometry.add(node.geometry);for(const item of [node.material].flat())if(item)material.add(item);});geometry.forEach(item=>item.dispose());material.forEach(item=>item.dispose());}
