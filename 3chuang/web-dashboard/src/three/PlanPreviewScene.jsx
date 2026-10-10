import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer, EffectPass, RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import { classifyCargoAppearance } from '../domain/cargo/appearance.js';
import { createIndustrialContainer } from './scene/createIndustrialContainer.js';
import { cargoPatternTexture, getMaterialProps, makeSkyGradientTexture } from './scene/visualAssets.js';
import { computeCameraFrame } from './presentation/cameraPresets.js';

const MM = 0.001;

// 静态 3D 装载预览：真实 placement 坐标 + 实例化货物 + 自动环绕运镜。
// 供首页大屏与柜型决策页嵌入；不含作业回放，只呈现最终装载结果。
export function PlanPreviewScene({ plan, autoRotate = true, onError }) {
  const mountRef = useRef(null);
  const planRef = useRef(plan);
  planRef.current = plan;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let renderer;
    try {
      renderer = createPreview(mount, planRef.current, autoRotate);
    } catch (error) {
      onError?.(error);
      return undefined;
    }
    let disposed = false;
    let frame = 0;
    let previous = performance.now();
    const render = (time) => {
      if (disposed) return;
      const delta = Math.min(0.05, Math.max(0, (time - previous) / 1000));
      previous = time;
      if (!renderer.contextLost) {
        if (renderer.intro.t < 1) {
          renderer.intro.t = Math.min(1, renderer.intro.t + delta / 1.3);
          const eased = 1 - Math.pow(1 - renderer.intro.t, 3);
          renderer.camera.position.lerpVectors(renderer.intro.start, renderer.intro.end, eased);
        }
        renderer.controls.update(delta);
        renderer.composer.render();
      }
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      renderer.dispose();
    };
  }, [plan, autoRotate, onError]);

  return <div className="preview-3d" ref={mountRef} role="img" aria-label="装载方案三维预览" />;
}

function createPreview(mount, plan, autoRotate) {
  const container = plan?.containerInfo || {};
  const length = Number(container.innerLength || 12030) * MM;
  const width = Number(container.innerWidth || 2350) * MM;
  const height = Number(container.innerHeight || 2690) * MM;

  const scene = new THREE.Scene();
  const skyTexture = makeSkyGradientTexture();
  scene.background = skyTexture;
  scene.fog = new THREE.Fog('#e9efec', 26, 54);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 120);
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.appendChild(renderer.domElement);

  RectAreaLightUniformsLib.init();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const environmentTexture = pmrem.fromScene(roomEnvironment, 0.04).texture;
  scene.environment = environmentTexture;
  roomEnvironment.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#f4f8f5', '#5e6a66', 1.25));
  const key = new THREE.DirectionalLight('#fff3dd', 2.05);
  key.position.set(10, 14, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -14; key.shadow.camera.right = 14;
  key.shadow.camera.top = 11; key.shadow.camera.bottom = -11;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#c4d8df', 1.05);
  fill.position.set(-10, 5, -8);
  scene.add(fill);

  // 简洁展台地面（柔和阴影承接，不抢主体）
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(16, length * 1.5), 48),
    new THREE.MeshStandardMaterial({ color: '#dde3df', roughness: 0.95, metalness: 0.01 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  scene.add(ground);
  // 极坐标展台网格（港口雷达感，低透明度不抢主体）
  const polarGrid = new THREE.PolarGridHelper(Math.max(13, length * 1.25), 12, 7, 48, '#b9c4be', '#c9d1cc');
  polarGrid.position.y = -0.11;
  polarGrid.material.transparent = true;
  polarGrid.material.opacity = 0.32;
  polarGrid.material.depthWrite = false;
  scene.add(polarGrid);

  const containerGroup = new THREE.Group();
  scene.add(containerGroup);
  const containerModel = createIndustrialContainer(containerGroup, { length, width, height });
  // 预览态：近墙与顶板透明，直接看到箱内货物
  containerModel.shellMaterials.panels.forEach((panel) => {
    if (panel.userData.operationMaterial === containerModel.shellMaterials.operation.nearWall
      || panel.userData.operationMaterial === containerModel.shellMaterials.operation.roof) {
      panel.material = containerModel.shellMaterials.review;
    }
  });

  const cargoRoot = new THREE.Group();
  scene.add(cargoRoot);
  buildCargoInstances(cargoRoot, plan?.loadedCargo || [], { length, width });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = Boolean(autoRotate);
  controls.autoRotateSpeed = 0.9;
  controls.minDistance = 4;
  controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, height * 0.42, 0);
  camera.position.set(length * 0.78, height * 1.75, width * 3.1);
  controls.update();

  // pmndrs postprocessing 链：RenderPass → SMAA + 柔和暗角 + ACES 色调映射（单 EffectPass 合成，性能优于多 Pass 链）。
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new EffectPass(camera,
    new SMAAEffect(),
    new VignetteEffect({ offset: 0.3, darkness: 0.36 }),
    new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
  ));

  // 入场运镜：从远高机位推近到最终取景（1.3s 三次缓出），与自动环绕叠加。
  const introEnd = camera.position.clone();
  const introStart = introEnd.clone().sub(controls.target).multiplyScalar(1.7).add(controls.target).add(new THREE.Vector3(0, 3.4, 0));
  camera.position.copy(introStart);

  let contextLost = false;
  const onLost = (event) => { event.preventDefault(); contextLost = true; };
  const onRestored = () => { contextLost = false; };
  renderer.domElement.addEventListener('webglcontextlost', onLost, false);
  renderer.domElement.addEventListener('webglcontextrestored', onRestored, false);

  const resizeObserver = new ResizeObserver(() => {
    const widthPx = Math.max(240, mount.clientWidth);
    const heightPx = Math.max(240, mount.clientHeight);
    renderer.setSize(widthPx, heightPx, false);
    composer.setSize(widthPx, heightPx);
    camera.aspect = widthPx / heightPx;
    const frame=computeCameraFrame({bounds:new THREE.Box3(new THREE.Vector3(-length/2-.2,-.1,-width/2-.2),new THREE.Vector3(length/2+.5,height+.1,width/2+.2)),direction:new THREE.Vector3(.55,.35,1),up:new THREE.Vector3(0,1,0),target:controls.target,verticalFov:THREE.MathUtils.degToRad(camera.fov),aspect:camera.aspect,margin:.87});
    introEnd.copy(frame.position);
    camera.position.copy(frame.position);
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(mount);
  renderer.setSize(Math.max(240, mount.clientWidth), Math.max(240, mount.clientHeight), false);
  composer.setSize(Math.max(240, mount.clientWidth), Math.max(240, mount.clientHeight));
  camera.aspect = Math.max(240, mount.clientWidth) / Math.max(240, mount.clientHeight);
  camera.updateProjectionMatrix();

  return {
    scene, camera, renderer, controls, composer,
    intro: { t: 0, start: introStart, end: introEnd },
    get contextLost() { return contextLost; },
    dispose() {
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
      controls.dispose();
      composer.dispose();
      environmentTexture.dispose();
      skyTexture.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        materials.forEach((material) => material.dispose?.());
      });
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    }
  };
}

// 实例化货物：按 外观×颜色 分批，白底材质 × 程序化纹理 × 逐实例颜色。
function buildCargoInstances(parent, items, { length, width }) {
  const batches = new Map();
  for (const item of items) {
    const appearance = classifyCargoAppearance(item);
    const color = appearance.color;
    const key = `${appearance.key}:${color}`;
    if (!batches.has(key)) batches.set(key, { appearance, color, items: [] });
    batches.get(key).items.push(item);
  }
  const boxGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.045);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  for (const { appearance, color, items: batchItems } of batches.values()) {
    const typeProps = getMaterialProps(appearance.key);
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: cargoPatternTexture(appearance.pattern),
      roughness: typeProps.roughness,
      metalness: typeProps.metalness
    });
    const mesh = new THREE.InstancedMesh(boxGeometry, material, batchItems.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    batchItems.forEach((item, index) => {
      const l = Math.max(0.02, Number(item.l || item.length || 1) * MM);
      const h = Math.max(0.02, Number(item.h || item.height || 1) * MM);
      const w = Math.max(0.02, Number(item.w || item.width || 1) * MM);
      matrix.compose(
        new THREE.Vector3(Number(item.x || 0) * MM - length / 2 + l / 2, Number(item.y || 0) * MM + h / 2, Number(item.z || 0) * MM - width / 2 + w / 2),
        quaternion,
        new THREE.Vector3(l, h, w)
      );
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, new THREE.Color(color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    parent.add(mesh);
  }
}
