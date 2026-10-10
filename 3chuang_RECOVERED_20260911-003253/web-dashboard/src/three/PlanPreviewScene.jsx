import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BloomEffect, EffectComposer, EffectPass, NormalPass, RenderPass, SMAAEffect, SSAOEffect, VignetteEffect } from 'postprocessing';
import { classifyCargoAppearance } from '../domain/cargo/appearance.js';
import { createIndustrialContainer } from './scene/createIndustrialContainer.js';
import { cargoSurfaceTextures, CARGO_STAGE_COLORS, contactShadowTexture, stageFloorTexture, getMaterialProps, makeSkyGradientTexture } from './scene/visualAssets.js';
import { computeCameraFrame } from './presentation/cameraPresets.js';

const MM = 0.001;

// 静态 3D 装载预览：真实 placement 坐标 + 实例化货物 + 自动环绕运镜。
// 供首页大屏与柜型决策页嵌入；不含作业回放，只呈现最终装载结果。
export function PlanPreviewScene({ plan, autoRotate = true, onError, ariaLabel = '装载方案三维预览' }) {
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
    const entranceStarted=previous;
    const render = (time) => {
      if (disposed) return;
      const frameMs = Math.max(0, time - previous);
      const delta = Math.min(0.05, frameMs / 1000);
      previous = time;
      if (!renderer.contextLost) {
        if (renderer.intro.t < 1) {
          renderer.intro.t = Math.min(1, (time-entranceStarted)/1800);
          const t = renderer.intro.t;
          if (t < 1 / 3) {
            const u = t * 3, eased = u * u * (3 - 2 * u);
            renderer.camera.position.lerpVectors(renderer.intro.start, renderer.intro.mid, eased);
          } else renderer.camera.position.lerpVectors(renderer.intro.mid, renderer.intro.end, 1 - Math.pow(1 - (t - 1 / 3) * 1.5, 3));
        }
        renderer.restorePointerOffset();
        renderer.controls.update(delta);
        renderer.applyPointerOffset(delta);
        renderer.composer.render();
        renderer.checkAoCost(frameMs);
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

  return <div className="preview-3d" ref={mountRef} role="img" aria-label={ariaLabel} tabIndex={-1} />;
}

function createPreview(mount, plan, autoRotate) {
  const container = plan?.containerInfo || {};
  const length = Number(container.innerLength || 12030) * MM;
  const width = Number(container.innerWidth || 2350) * MM;
  const height = Number(container.innerHeight || 2690) * MM;

  const scene = new THREE.Scene();
  const skyTexture = makeSkyGradientTexture({ variant: 'stage' });
  scene.background = skyTexture;
  scene.fog = new THREE.FogExp2('#0C1219', 0.028);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 120);
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.appendChild(renderer.domElement);

  RectAreaLightUniformsLib.init();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const environmentTexture = pmrem.fromScene(roomEnvironment, 0.04).texture;
  scene.environment = environmentTexture;
  scene.environmentIntensity = 0.5;
  roomEnvironment.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#eee9df', '#1c222b', 0.3));
  const key = new THREE.DirectionalLight('#FFF1DE', 3.0);
  key.position.set(10, 14, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -14; key.shadow.camera.right = 14;
  key.shadow.camera.top = 11; key.shadow.camera.bottom = -11;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#A8C4DE', 0.5);
  fill.position.set(-10, 5, -8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#7FB4E8', 2.2);
  rim.position.set(-4,8,-10);scene.add(rim);
  const softbox = new THREE.RectAreaLight('#fffaf1',2.0,length*.7,3.8);
  softbox.position.set(0,height+4.6,0);softbox.lookAt(0,0,0);scene.add(softbox);

  // 简洁展台地面（柔和阴影承接，不抢主体）
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(length * 2, 64),
    new THREE.MeshStandardMaterial({ map: stageFloorTexture(), roughness: 0.55, metalness: 0.1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  scene.add(ground);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(length * 1.3, width * 2.2), new THREE.MeshBasicMaterial({map:contactShadowTexture(),transparent:true,depthWrite:false}));
  contact.name = 'preview-contact-shadow';
  contact.rotation.x = -Math.PI / 2; contact.position.y = -0.005;
  scene.add(contact);

  const containerGroup = new THREE.Group();
  scene.add(containerGroup);
  const containerModel = createIndustrialContainer(containerGroup, { length, width, height, variant: 'stage' });
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
  camera.position.set(length * 0.78, height * 1.35, width * 3.1);
  controls.update();

  // Neutral renderer with optional AO, Bloom, SMAA and vignette.
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const capture = new URLSearchParams(window.location.search).get('capture') === '1';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const software=debug && /SwiftShader|llvmpipe/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
  let ao = null, normalPass = null, slowFrames = 0;
  if (!capture && !software) {
    ({ normalPass, ao } = buildAoPass(scene,camera));
    composer.addPass(normalPass);
    composer.addPass(ao);
  }
  mount.dataset.ao = ao ? 'enabled' : capture ? 'capture-off' : 'software-off';
  composer.addPass(new EffectPass(camera,
    new BloomEffect({mipmapBlur:true,luminanceThreshold:.85,intensity:.35}),
    new SMAAEffect(),
    new VignetteEffect({ offset: 0.25, darkness: 0.32 })
  ));

  // Two-stage 1.8s entrance; reduced-motion and capture start at the final frame.
  const introEnd = camera.position.clone();
  const introStart = new THREE.Vector3(length * .9,height * .5,width * .6);
  const introMid = new THREE.Vector3(length * .7,height * .65,width * 2.2);
  const intro = { t: capture || reduced.matches ? 1 : 0, start:introStart,mid:introMid,end:introEnd };
  camera.position.copy(intro.t === 1 ? introEnd : introStart);
  controls.autoRotate = Boolean(autoRotate) && !capture && !reduced.matches;

  const pointer = { active:false,played:false,target:0,current:0,applied:0 };
  const axis = new THREE.Vector3(0,1,0);
  const restorePointerOffset = () => {
    if (!pointer.applied) return;
    camera.position.sub(controls.target).applyAxisAngle(axis,-pointer.applied).add(controls.target);
    pointer.applied=0;
  };
  const onPointerEnter = () => { if (!pointer.played && intro.t===1 && !capture && !reduced.matches && matchMedia('(pointer:fine)').matches) pointer.active=true; };
  const onPointerMove = event => {if(pointer.active) pointer.target=THREE.MathUtils.clamp((event.offsetX / renderer.domElement.clientWidth-.5)*2,-1,1)*THREE.MathUtils.degToRad(8);};
  const onPointerLeave = () => {if(pointer.active)pointer.played=true;pointer.active=false;pointer.target=0;};
  const onMotion = () => {controls.autoRotate=Boolean(autoRotate)&&!capture&&!reduced.matches;if(reduced.matches){restorePointerOffset();pointer.current=pointer.target=0;pointer.active=false;intro.t=1;camera.position.copy(intro.end);}};
  renderer.domElement.addEventListener('pointerenter',onPointerEnter);
  renderer.domElement.addEventListener('pointermove',onPointerMove);
  renderer.domElement.addEventListener('pointerleave',onPointerLeave);
  reduced.addEventListener('change',onMotion);

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
    const frame=computeCameraFrame({bounds:new THREE.Box3(new THREE.Vector3(-length/2-.2,-.1,-width/2-.2),new THREE.Vector3(length/2+.5,height+.1,width/2+.2)),direction:new THREE.Vector3(.55,.27,1),up:new THREE.Vector3(0,1,0),target:controls.target,verticalFov:THREE.MathUtils.degToRad(camera.fov),aspect:camera.aspect,margin:.87});
    introEnd.copy(frame.position);
    if (intro.t === 1) camera.position.copy(frame.position);
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(mount);
  renderer.setSize(Math.max(240, mount.clientWidth), Math.max(240, mount.clientHeight), false);
  composer.setSize(Math.max(240, mount.clientWidth), Math.max(240, mount.clientHeight));
  camera.aspect = Math.max(240, mount.clientWidth) / Math.max(240, mount.clientHeight);
  camera.updateProjectionMatrix();

  return {
    scene, camera, renderer, controls, composer,
    intro,
    restorePointerOffset,
    applyPointerOffset(delta) {
      if(intro.t<1 || reduced.matches || capture)return;
      pointer.current=THREE.MathUtils.lerp(pointer.current,pointer.target,Math.min(1,delta/.12));
      pointer.applied=pointer.current;
      camera.position.sub(controls.target).applyAxisAngle(axis,pointer.current).add(controls.target);camera.lookAt(controls.target);
    },
    checkAoCost(ms) {
      if(!ao)return;
      slowFrames=ms>24?slowFrames+1:0;
      if(slowFrames>=60){composer.removePass(ao);composer.removePass(normalPass);ao.dispose();normalPass.dispose();ao=null;normalPass=null;mount.dataset.ao='performance-off';}
    },
    get contextLost() { return contextLost; },
    dispose() {
      resizeObserver.disconnect();
      reduced.removeEventListener('change',onMotion);
      renderer.domElement.removeEventListener('pointerenter',onPointerEnter);
      renderer.domElement.removeEventListener('pointermove',onPointerMove);
      renderer.domElement.removeEventListener('pointerleave',onPointerLeave);
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

// R2 compatibility factory: keep the documented SSAO fallback in one place.
function buildAoPass(scene,camera) {
  const normalPass = new NormalPass(scene,camera,{resolutionScale:.5});
  const effect = new SSAOEffect(camera,normalPass.texture,{worldDistanceThreshold:24,worldDistanceFalloff:4,worldProximityThreshold:.6,worldProximityFalloff:.3,luminanceInfluence:.6,radius:.12,intensity:1.6,resolutionScale:.5});
  return { normalPass, ao:new EffectPass(camera,effect) };
}

// 实例化货物：按 外观×颜色 分批，白底材质 × 程序化纹理 × 逐实例颜色。
function buildCargoInstances(parent, items, { length, width }) {
  const batches = new Map();
  for (const item of items) {
    const appearance = classifyCargoAppearance(item);
    const color = CARGO_STAGE_COLORS[appearance.key] || appearance.color;
    const key = `${appearance.key}:${color}`;
    if (!batches.has(key)) batches.set(key, { appearance, color, items: [] });
    batches.get(key).items.push(item);
  }
  const boxGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.02);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  for (const { appearance, color, items: batchItems } of batches.values()) {
    const typeProps = getMaterialProps(appearance.key);
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      ...cargoSurfaceTextures(appearance.key === 'drum' ? 'rings' : appearance.pattern, { variant: 'stage' }),
      bumpScale: typeProps.bumpScale,
      roughness: typeProps.roughness,
      metalness: typeProps.metalness
    });
    const geometry = appearance.key === 'drum' ? new THREE.CylinderGeometry(.5,.5,1,24) : appearance.key === 'fibc' ? new RoundedBoxGeometry(1,1,1,3,.12) : boxGeometry;
    const mesh = new THREE.InstancedMesh(geometry, material, batchItems.length);
    mesh.name = `preview-cargo-${appearance.key}`;
    const pallet = ['palletized','wrapped'].includes(appearance.key) ? new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color:CARGO_STAGE_COLORS.crate,...cargoSurfaceTextures('slats',{variant:'stage'}),roughness:.92,bumpScale:.024}),batchItems.length*3) : null;
    if (pallet) {pallet.name='preview-pallet-bearers';pallet.castShadow=pallet.receiveShadow=true;parent.add(pallet);}
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    batchItems.forEach((item, index) => {
      const l = Math.max(0.02, Number(item.l || item.length || 1) * MM);
      const h = Math.max(0.02, Number(item.h || item.height || 1) * MM);
      const w = Math.max(0.02, Number(item.w || item.width || 1) * MM);
      matrix.compose(
        new THREE.Vector3(Number(item.x || 0) * MM - length / 2 + l / 2, Number(item.y || 0) * MM + h / 2 + (pallet ? .14 : 0), Number(item.z || 0) * MM - width / 2 + w / 2),
        quaternion,
        new THREE.Vector3(appearance.key === 'drum' ? Math.max(l,w) : l, h, appearance.key === 'drum' ? Math.max(l,w) : w)
      );
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, new THREE.Color(color));
      if (pallet) for (let foot=0;foot<3;foot++) {
        matrix.compose(new THREE.Vector3(Number(item.x||0)*MM-length/2+l/2,Number(item.y||0)*MM+.07,Number(item.z||0)*MM-width/2+w*(foot+.5)/3),quaternion,new THREE.Vector3(l*.92,.14,w*.08));
        pallet.setMatrixAt(index*3+foot,matrix);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (pallet) pallet.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    parent.add(mesh);
  }
}
