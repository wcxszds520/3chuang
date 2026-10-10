import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TwinScene } from './TwinScene.jsx';
import { OperationMachine } from './operation/operationMachine.js';
import { HERO_ASSET_MANIFEST, assetKeyForContainer } from './assets/assetManifest.js';

const FAMILY_MATCHERS = Object.freeze({
  carton: ['cargo_carton', 'v21_carton_'],
  crate: ['cargo_crate', 'v21_crate_', 'v25_crate_'],
  palletized: ['cargo_palletized', 'v25_palletized_'],
  wrapped: ['cargo_wrapped', 'v21_wrap_', 'v25_wrapped_'],
  equipment_case: ['cargo_equipment_case', 'cargo_equipment', 'v21_case_', 'v21_equipment_', 'v25_equipment_case_'],
  drum: ['cargo_drum', 'v25_drum_'],
  fibc: ['cargo_fibc', 'v25_fibc_'],
  generic: ['cargo_generic', 'v21_generic_', 'v25_generic_']
});

export function LandingHeroScene() {
  const hostRef = useRef(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false;
    let frame = 0;
    let visible = true;
    let pointerX = 0;
    let pointerY = 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 180);
    camera.position.set(14.5, 10.5, 12.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '40HQ 集装箱与真实包装资产三维产品视图');

    const ambient = new THREE.HemisphereLight(0xf7fbff, 0xb8c6d5, 3.5);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 5.2);
    key.position.set(5, 11, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x4cb9ff, 2.4);
    rim.position.set(-9, 5, -7);
    scene.add(rim);

    const stage = new THREE.Group();
    stage.rotation.y = -0.18;
    stage.rotation.x = 0.02;
    scene.add(stage);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(15, 64), new THREE.ShadowMaterial({ color: 0x38648c, opacity: 0.12 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.55;
    floor.receiveShadow = true;
    scene.add(floor);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(11, 64), new THREE.MeshBasicMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.62, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -1.54;
    scene.add(halo);

    const loader = new GLTFLoader();
    Promise.all([
      loader.loadAsync('/assets/3d/container-40hq.glb'),
      loader.loadAsync('/assets/3d/cargo-kit.glb')
    ]).then(([containerGltf, kitGltf]) => {
      if (disposed) return;
      const container = containerGltf.scene;
      container.traverse((object) => {
        const name = object.name.toLowerCase();
        if (['roof', 'side_left', 'front_wall'].includes(name)) object.visible = false;
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        object.material = Array.isArray(object.material) ? object.material.map(brightenMaterial) : brightenMaterial(object.material);
      });
      const leftDoor = container.getObjectByName('door_left_pivot_assembly') || container.getObjectByName('door_left_pivot');
      const rightDoor = container.getObjectByName('door_right_pivot_assembly') || container.getObjectByName('door_right_pivot');
      if (leftDoor) leftDoor.rotation.y = 1.48;
      if (rightDoor) rightDoor.rotation.y = -1.48;
      stage.add(container);

      const positions = [
        ['crate', -4.6, 0.18, -0.42, 0.78], ['palletized', -2.65, 0.05, 0.42, 0.7],
        ['equipment_case', -0.6, 0.16, -0.45, 0.76], ['wrapped', 1.35, 0.08, 0.38, 0.72],
        ['carton', 3.15, 0.02, -0.4, 0.7], ['drum', 4.55, 0.1, 0.45, 0.7]
      ];
      positions.forEach(([family, x, y, z, scale]) => {
        const object = extractFamily(kitGltf.scene, family);
        object.scale.setScalar(scale);
        object.position.set(x, y - 1.42, z);
        object.traverse((mesh) => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
        stage.add(object);
      });
      const bounds = new THREE.Box3().setFromObject(stage);
      const center = bounds.getCenter(new THREE.Vector3());
      stage.position.sub(center);
      stage.position.y -= 0.1;
    }).catch(() => { host.classList.add('landing-webgl--fallback'); });

    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '150px' });
    visibilityObserver.observe(host);
    const move = (event) => {
      const rect = host.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
    resize();
    const clock = new THREE.Clock();
    const animate = () => {
      if (disposed) return;
      frame = window.requestAnimationFrame(animate);
      if (!visible) return;
      const t = clock.getElapsedTime();
      const targetX = reduceMotion ? 14.5 : 14.5 + pointerX * 0.85;
      const targetY = reduceMotion ? 10.5 : 10.5 - pointerY * 0.45 + Math.sin(t * 0.35) * 0.1;
      camera.position.x += (targetX - camera.position.x) * 0.035;
      camera.position.y += (targetY - camera.position.y) * 0.035;
      camera.lookAt(0, -0.15, 0);
      if (!reduceMotion) stage.rotation.y += ((-0.18 + pointerX * 0.035) - stage.rotation.y) * 0.025;
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      visibilityObserver.disconnect();
      host.removeEventListener('pointermove', move);
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return <div className="landing-webgl" ref={hostRef}><span className="landing-webgl__fallback"><span /><i /><b>40HQ</b></span></div>;
}

export function LandingTwinShowcase({ plan, mode = 'normal', sceneProfile = 'landing' }) {
  const hostRef = useRef(null);
  const [visible, setVisible] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('capture') === '1');
  const [error, setError] = useState('');
  const machine = useMemo(() => {
    const instance = new OperationMachine(plan || {});
    instance.jumpToCompletedCount(instance.queue.length);
    return instance;
  }, [plan]);
  const unloadSequence = useMemo(() => {
    const access = plan?.portAccessibility || plan?.ext_portAccessibility || plan?.metrics?.portAccessibility;
    const explicit = access?.unloadOrder || (access?.calls || []).flatMap((call) => call.removedCargoIds || []);
    return explicit?.length ? explicit.map(String) : (plan?.loadedCargo || []).map((item) => String(item.cargoId));
  }, [plan]);
  const landingUnloadState = useMemo(() => {
    if (mode !== 'unload' || !unloadSequence.length) return null;
    const index = 0;
    return {
      active: true,
      playing: false,
      speed: 1,
      index,
      removedIds: unloadSequence.slice(0, index),
      currentId: unloadSequence[index] || null,
      nextId: unloadSequence[index + 1] || null,
      remaining: Math.max(0, unloadSequence.length - index)
    };
  }, [mode, unloadSequence]);
  const presentation = mode === 'space'
    ? { view: 'side', visualizationMode: 'space' }
    : mode === 'balance'
      ? { view: 'top', visualizationMode: 'balance' }
      : mode === 'unload'
        ? { view: 'unload', visualizationMode: 'port' }
        : { view: 'overview', visualizationMode: 'normal' };

  useEffect(() => {
    const node = hostRef.current;
    if (!node || visible) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '420px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return <div className="pc-landing-twin" ref={hostRef} data-twin-mode={mode}>
    {visible && plan?.containerInfo && <TwinScene
      machine={machine}
      view={presentation.view}
      mode="review"
      labelMode="off"
      visualizationMode={presentation.visualizationMode}
      sceneProfile={sceneProfile}
      unloadState={landingUnloadState}
      focusVoidZoneId={mode === 'space' ? 'VOID-I-001' : ''}
      postProcessing={mode === 'normal'}
      quality="standard"
      visibleQueueIndices={machine.queue.map((_, index) => index)}
      layers={{ container: true, zones: true, labels: false, placed: true, waiting: false, path: mode === 'unload', target: false }}
      debugLayers={{ grid: false, void: mode === 'space', reserve: false, lowFill: false, securing: false }}
      onError={(nextError) => setError(nextError?.message || String(nextError || '三维场景加载失败'))}
    />}
    {!visible && <div className="pc-landing-twin__loading"><span />正在准备真实方案场景</div>}
    {visible && !plan?.containerInfo && <div className="pc-landing-twin__loading">等待当前方案数据</div>}
    {error && <div className="pc-landing-twin__error">{error}</div>}
  </div>;
}

export function useCargoKitThumbnails(families) {
  const [images, setImages] = useState({});
  const familyKey = families.join('|');
  useEffect(() => {
    let cancelled = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(1.25);
    renderer.setSize(360, 236, false);
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const loader = new GLTFLoader();
    loader.loadAsync('/assets/3d/cargo-kit.glb').then((gltf) => {
      if (cancelled) return;
      const result = {};
      for (const family of families) {
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8ea8bf, 3.4));
        const light = new THREE.DirectionalLight(0xffffff, 4.5);
        light.position.set(4, 8, 6);
        scene.add(light);
        const object = extractFamily(gltf.scene, family);
        const modelGroup = new THREE.Group();
        modelGroup.add(object);
        scene.add(modelGroup);
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        modelGroup.position.copy(center).multiplyScalar(-1);
        const camera = new THREE.PerspectiveCamera(34, 360 / 236, 0.01, 100);
        const distance = Math.max(2.2, sphere.radius * 3.35);
        camera.position.set(distance * 0.9, distance * 0.7, distance);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        result[family] = renderer.domElement.toDataURL('image/png');
        scene.remove(object);
      }
      if (!cancelled) setImages(result);
    }).finally(() => renderer.dispose()).catch(() => {});
    return () => { cancelled = true; renderer.dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyKey]);
  return images;
}

export function useContainerThumbnails(typeIds) {
  const [images, setImages] = useState({});
  const typeKey = typeIds.join('|');
  useEffect(() => {
    let cancelled = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(1.5);
    renderer.setSize(720, 360, false);
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const loader = new GLTFLoader();
    Promise.all(typeIds.map((typeId) => loader.loadAsync(HERO_ASSET_MANIFEST[assetKeyForContainer(typeId)].url))).then((assets) => {
      if (cancelled) return;
      const result = {};
      assets.forEach((gltf, index) => {
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x7b827f, 1.35));
        const light = new THREE.DirectionalLight(0xfff2df, 3.2);
        light.position.set(6, 10, 8);
        scene.add(light);
        const object = gltf.scene.clone(true);
        object.traverse((mesh) => {
          const name = mesh.name.toLowerCase();
          if (name.includes('label_portcube') || name.includes('label_subtitle')) { mesh.visible = false; return; }
          if (!mesh.isMesh) return;
          if (typeIds[index] !== '40HQ' && name.startsWith('v21_door_') && /door_(left|right)_pivot$/.test(mesh.parent?.name || '')) mesh.position.sub(mesh.parent.position);
          const finish = (source) => {
            const material = source.clone();
            if (/paint|cutaway|teal/i.test(material.name)) { material.color.set('#496c75'); material.roughness = .5; material.metalness = .25; }
            return material;
          };
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(finish) : finish(mesh.material);
        });
        const modelGroup = new THREE.Group();
        modelGroup.add(object);
        scene.add(modelGroup);
        object.updateMatrixWorld(true);
        const box = new THREE.Box3();
        object.traverseVisible((mesh) => { if (mesh.isMesh) box.union(new THREE.Box3().setFromObject(mesh)); });
        const center = box.getCenter(new THREE.Vector3());
        modelGroup.position.copy(center).multiplyScalar(-1);
        const span = 7.8 * (typeIds[index] === '20GP' ? 26 / 37 : 1);
        const camera = new THREE.OrthographicCamera(-span, span, span / 2, -span / 2, 0.1, 100);
        camera.position.set(10, 8, 16);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        result[typeIds[index]] = renderer.domElement.toDataURL('image/png');
      });
      if (!cancelled) setImages(result);
    }).finally(() => renderer.dispose()).catch(() => {});
    return () => { cancelled = true; renderer.dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeKey]);
  return images;
}

function extractFamily(source, family) {
  source.updateMatrixWorld(true);
  const group = new THREE.Group();
  const matchers = FAMILY_MATCHERS[family] || FAMILY_MATCHERS.generic;
  source.traverse((object) => {
    if (!object.isMesh || !matches(object.name, matchers)) return;
    const clone = object.clone();
    clone.geometry = object.geometry;
    clone.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material?.clone();
    clone.applyMatrix4(object.matrixWorld);
    group.add(clone);
  });
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.children.forEach((child) => { child.position.sub(center); });
  return group;
}

function matches(name, matchers) {
  const normalized = String(name || '').toLowerCase();
  return matchers.some((matcher) => normalized === matcher || normalized.startsWith(matcher));
}

function brightenMaterial(material) {
  const clone = material?.clone?.() || material;
  if (!clone) return clone;
  const name = String(clone.name || '').toLowerCase();
  if (clone.color && /hardware|galvan|lock|rod|handle|casting/.test(name)) clone.color.lerp(new THREE.Color(0xa8bac7), 0.45);
  else if (clone.color && !/floor|wood/.test(name)) clone.color.lerp(new THREE.Color(0x0b6397), 0.72);
  clone.roughness = Math.min(0.72, clone.roughness ?? 0.65);
  clone.metalness = Math.min(0.35, clone.metalness ?? 0.18);
  return clone;
}

function disposeObject(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material?.dispose?.());
  });
}
