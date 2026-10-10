import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { heroAssetRegistry } from './assets/AssetRegistry.js';
import { loadPackagingAsset } from './cargo/loadPackagingAsset.js';
import { finishInspectionMaterial } from './scene/inspectionMaterials.js';
import { fitPackagingPart } from './cargo/packagingGeometryFit.js';
import './packagingModelViewer.css';

export default function PackagingModelViewer({ appearanceKey = 'carton', assetKey, label = '包装', className = '', cargo }) {
  const hostRef = useRef(null);
  const controlsRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const length=Number(cargo?.length),width=Number(cargo?.width),height=Number(cargo?.height);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false, frame = 0, visible = true;
    setStatus('loading');
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', `${label}三维模型，可拖拽旋转和滚轮缩放`);
    renderer.domElement.setAttribute('role', 'img');
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture;
    scene.environmentIntensity = .7;
    room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xf3f6ff, 0x89909a, 1.25));
    const key = new THREE.DirectionalLight(0xfff6e9, 2.5);
    key.position.set(3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -.0002; scene.add(key);
    const camera = new THREE.PerspectiveCamera(32, 1, .01, 100);
    camera.position.set(2, 1.6, 2.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.maxPolarAngle = Math.PI * .49;
    controlsRef.current = controls;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: '#344447', opacity: .19 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.003; floor.receiveShadow = true; scene.add(floor);
    const resize = () => { const { width, height } = host.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const visibility = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting !== false; }); visibility.observe(host);
    const disposeModel = root => root.traverse(node => { if (!node.isMesh) return; node.geometry?.dispose(); for (const material of [node.material].flat().filter(Boolean)) material.dispose(); });
    (assetKey ? heroAssetRegistry.clone(assetKey) : loadPackagingAsset(appearanceKey)).then(asset => {
      if (disposed) { disposeModel(asset.scene); return; }
      let model = asset.scene;
      if(!assetKey&&[length,width,height].every(value=>Number.isFinite(value)&&value>0)){
        model.updateMatrixWorld(true);const sourceBounds=new THREE.Box3().setFromObject(model),labelBounds=new THREE.Box3(),meshes=[];
        model.traverse(node=>{if(node.isMesh){meshes.push(node);if(/label|barcode|text_line/.test(node.name.toLowerCase()))labelBounds.union(new THREE.Box3().setFromObject(node));}});
        const fitted=new THREE.Group();
        for(const node of meshes){const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);fitPackagingPart(geometry,{sourceBounds,dimensions:new THREE.Vector3(length,height,width).multiplyScalar(.001),name:node.name,labelBounds:labelBounds.isEmpty()?undefined:labelBounds,family:appearanceKey});fitted.add(new THREE.Mesh(geometry,node.material));node.geometry.dispose();}
        model=fitted;host.dataset.cargoEnvelope=`${length}×${width}×${height}`;
      }
      model.traverse(node => {
        if (!node.isMesh) return;
        const original = [node.material].flat();
        node.material = Array.isArray(node.material) ? original.map(finishInspectionMaterial) : finishInspectionMaterial(node.material);
        original.forEach(material => material.dispose());
      });
      const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      model.position.add(new THREE.Vector3(-center.x, -box.min.y, -center.z));
      scene.add(model);
      const radius = Math.max(size.length() / 2, .2);
      const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.16;
      controls.target.set(0, size.y * .48, 0);
      camera.position.copy(controls.target).add(new THREE.Vector3(1.3, .85, 1.7).normalize().multiplyScalar(distance));
      controls.minDistance = radius * 1.4; controls.maxDistance = distance * 2.1; controls.update(); controls.saveState();
      key.position.set(radius * 3, radius * 5, radius * 4);
      key.shadow.camera.left = key.shadow.camera.bottom = -radius * 2;
      key.shadow.camera.right = key.shadow.camera.top = radius * 2;
      key.shadow.camera.updateProjectionMatrix();
      host.dataset.assetSource = asset.descriptor.url; setStatus('ready');
    }).catch(() => { if (!disposed) setStatus('error'); });
    const animate = () => { frame = requestAnimationFrame(animate); if (visible) { controls.update(); renderer.render(scene, camera); } }; animate();
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); visibility.disconnect(); controls.dispose(); controlsRef.current = null; disposeModel(scene); environment.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [appearanceKey, assetKey, label,length,width,height]);
  return <div className={`packaging-model-viewer ${className}`}>
    <div ref={hostRef} className="packaging-model-viewer__canvas" />
    {status !== 'ready' && <span className="packaging-model-viewer__status" role="status">{status === 'error' ? '模型暂未加载，请重新选择包装' : '正在加载三维模型…'}</span>}
    <div className="packaging-model-viewer__tools"><span>拖拽旋转 · 滚轮缩放</span><button type="button" onClick={() => controlsRef.current?.reset()} aria-label={`重置${label}模型视角`}>复位</button></div>
  </div>;
}
