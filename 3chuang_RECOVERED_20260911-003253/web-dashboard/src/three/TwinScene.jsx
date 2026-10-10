import { exactAssetMode, industrialAssetMode, loadExactCargoAsset, exactCargoGeometry } from './cargo/ExactCargoAssets.js';
import { createAlgorithmDiagnostics } from './AlgorithmDiagnostics.js';
import { FINAL_VISUAL_PROFILE, configureAssetSampling } from './visual/visualProfile.js';
import { initializeHeroDirection, applyHeroDirection, updateHeroPresentation } from './visual/heroDirection.js';
import { heroCameraPreset } from './visual/heroCameras.js';
import { applyCargoOpacity } from './visual/cargoOpacity.js';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { classifyCargoAppearance } from '../domain/cargo/appearance.js';
import { stagingPresentation, groundAtXZ } from './operation/stagingLayout.js';
import { placementSpaceEvidence } from '../domain/plan/placementSpaceEvidence.js';
import { cargoVisualDescriptor } from './cargo/CargoVisualFactory.js';
import { createPrecisionGeometry, originalDimensionsM, precisionBatchKey, precisionOrientation, precisionVariant } from './cargo/PrecisionCargoFactory.js';
import { createHighQualitySourceContainer, createSourceWoodFloor, createHeroGroundMarks } from './scene/HighQualitySourceContainer.js';
import { buildDeterministicSpaceCells, buildVisualizationContext, VISUALIZATION_MODES, visualizationColor } from './analytics/visualizationModes.js';
import { buildCameraPreset, computeCameraFrame, resolveCameraPresetName } from './presentation/cameraPresets.js';
import { layoutProjectedLabels } from './presentation/labelLayout.js';
import { createIndustrialContainer } from './scene/createIndustrialContainer.js';
import { createIndustrialForklift } from './scene/createIndustrialForklift.js';
import { createManualWorker } from './scene/createManualWorker.js';
import { bindWorkerRig, poseArticulatedWorker, cargoHandTargets, groundVehicle } from './scene/articulatedActors.js';
import { createWorksite } from './scene/createWorksite.js';
import { cargoPatternTexture, cargoSurfaceTextures, getMaterialProps } from './scene/visualAssets.js';
import { heroAssetRegistry } from './assets/AssetRegistry.js';
import { assetKeyForContainer } from './assets/assetManifest.js';
import { batchStaticSubtree } from './scene/staticBatching.js';
import { supportContactPatches } from './scene/supportInspection.js';
import { calibrateContainerAsset, findNamedNode } from './assets/assetCoordinateAdapter.js';

export { computeCameraFrame } from './presentation/cameraPresets.js';

const MM = 0.001;
// Optional solver acceptance overlay; it never changes cargo transforms.
const EMPTY_DEBUG_LAYERS = Object.freeze({});

export function TwinScene({ machine, view = 'overview', mode = 'operation', presentationMode = 'inspection', labelMode = 'simple', visualizationMode = 'normal', sceneProfile = 'workspace', unloadState = null, isolate = null, focusCargoId = '', focusVoidZoneId = '', evidenceOverlay = [], postProcessing = true, quality = 'standard', followRevision = 0, panelOpen = false, visibleQueueIndices = [], activeFilterCount = 0, layers, debugLayers = EMPTY_DEBUG_LAYERS, onSnapshot, onError, onHover, onSelect, onVoidSelect, onFocus, onPerformance }) {
  const mountRef = useRef(null);
  const runtimeRef = useRef(null);
  const [sceneLabels, setSceneLabels] = useState([]);
  const viewRef = useRef(view);
  const modeRef = useRef(mode);
  const layersRef = useRef(layers);
  const debugLayersRef = useRef(debugLayers);
  const labelModeRef = useRef(labelMode);
  const focusVoidZoneRef = useRef(focusVoidZoneId);
  const visibleQueueSignature = visibleQueueIndices.join(',');
  const evidenceSignature = JSON.stringify(evidenceOverlay);
  const unloadSignature = JSON.stringify(unloadState);
  const filterRef = useRef({ indices: visibleQueueIndices, count: activeFilterCount });
  const callbackRef = useRef({ onHover, onSelect, onVoidSelect, onFocus, onPerformance, onError });
  callbackRef.current = { onHover, onSelect, onVoidSelect, onFocus, onPerformance, onError };
  const analyticsRef = useRef({ visualizationMode, sceneProfile, unloadState, isolate, evidenceOverlay, postProcessing, quality, panelOpen, presentationMode });
  analyticsRef.current = { visualizationMode, sceneProfile, unloadState, isolate, evidenceOverlay, postProcessing, quality, panelOpen, presentationMode };
  focusVoidZoneRef.current = focusVoidZoneId;
  filterRef.current = {
    indices: visibleQueueSignature ? visibleQueueSignature.split(',').map(Number) : [],
    count: Number(activeFilterCount || 0)
  };

  useEffect(() => {
    viewRef.current = view;
    if (runtimeRef.current) {runtimeRef.current.followSuspended=false;applyCameraView(runtimeRef.current, view);}
  }, [view,followRevision]);

  useEffect(()=>{
    const runtime=runtimeRef.current;if(!runtime)return;
    runtime.presentationMode=presentationMode;
    applyLayerVisibility(runtime,layersRef.current);applySceneMode(runtime,modeRef.current,debugLayersRef.current);
    applyHeroDirection(runtime);
    if(presentationMode==='inspection'&&runtime.selectedItem)focusCargo(runtime,runtime.selectedItem);
    else applyCameraView(runtime,viewRef.current);
  },[presentationMode]);

  useEffect(() => {
    modeRef.current = mode;
    if (runtimeRef.current) {
      applySceneMode(runtimeRef.current, mode, debugLayersRef.current);
      applyCameraView(runtimeRef.current, viewRef.current);
    }
  }, [mode]);

  useEffect(() => {
    layersRef.current = layers;
    if (runtimeRef.current) applyLayerVisibility(runtimeRef.current, layers);
  }, [layers]);

  useEffect(() => {
    debugLayersRef.current = debugLayers;
    if (runtimeRef.current) applySceneMode(runtimeRef.current, modeRef.current, debugLayers);
  }, [debugLayers]);

  useEffect(() => {
    labelModeRef.current = labelMode;
    if (runtimeRef.current) runtimeRef.current.labelMode = labelMode;
  }, [labelMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const nextVisualizationMode = VISUALIZATION_MODES.includes(visualizationMode) ? visualizationMode : 'normal';
    startVisualizationTransition(runtime, nextVisualizationMode);
    runtime.isolate = isolate;
    runtime.postProcessingEnabled = Boolean(postProcessing);
    runtime.placedCount = -1;
    runtime.labelSignature = '__RESET__';
    runtime.setSceneLabels([]);
    if (runtime.visualizationMode !== 'space') {
      runtime.selectedVoidZone = null;
      updateSelectionMarker(runtime);
    }
    if (!runtime.analysisTransition) updateAnalysisVisibility(runtime);
    if(isolate&&runtime.selectedItem)focusCargo(runtime,runtime.selectedItem);
    else applyCameraView(runtime, viewRef.current);
  }, [visualizationMode, isolate, postProcessing]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.panelOpen = Boolean(panelOpen);
    runtime.labelSignature = '__PANEL_SAFE_AREA_CHANGED__';
    applyCameraView(runtime, viewRef.current);
  }, [panelOpen]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const nextUnload = analyticsRef.current.unloadState;
    const stepChanged = nextUnload?.currentId !== runtime.unloadState?.currentId || nextUnload?.index !== runtime.unloadState?.index;
    if (stepChanged || !runtime.unloadState) runtime.unloadMotionElapsedMs = 0;
    runtime.unloadState = nextUnload?.active ? nextUnload : null;
    runtime.unloadMotionStartedAt = performance.now();
    runtime.unloadMotionDurationMs = unloadMotionDuration(Number(runtime.unloadState?.speed || 1));
    runtime.placedCount = -1;
    runtime.mount.dataset.unloadActive = String(Boolean(runtime.unloadState));
  }, [unloadSignature]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    applyQuality(runtime, quality);
  }, [quality]);

  useEffect(() => {
    const filter = filterRef.current;
    if (runtimeRef.current) applyQueueFilter(runtimeRef.current, filter.indices, filter.count);
  }, [visibleQueueSignature, activeFilterCount]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (!focusCargoId) {
      if (!focusVoidZoneRef.current) {
        const hadSelection = Boolean(runtime.selectedItem || runtime.selectedVoidZone);
        runtime.selectedItem = null;
        runtime.selectedVoidZone = null;
        updateSelectionMarker(runtime);
        if (hadSelection) applyCameraView(runtime, viewRef.current);
      }
      return;
    }
    const item = runtime.machine.queue.find((cargo) => cargo.cargoId === focusCargoId);
    if (item) focusCargo(runtime, item);
  }, [focusCargoId]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (!focusVoidZoneId) {
      if (runtime.selectedVoidZone) { runtime.selectedVoidZone = null; updateSelectionMarker(runtime); applyCameraView(runtime, viewRef.current); }
      return;
    }
    const zone = runtime.voidZonesById?.get(focusVoidZoneId);
    if (zone) focusVoidZone(runtime, zone);
  }, [focusVoidZoneId]);

  useEffect(() => {
    if (runtimeRef.current) syncEvidenceOverlay(runtimeRef.current, evidenceOverlay);
  }, [evidenceOverlay, evidenceSignature]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let runtime;
    try {
      const filter = filterRef.current;
      runtime = createRuntime(mount, machine, modeRef.current, debugLayersRef.current, labelModeRef.current, filter.indices, filter.count, setSceneLabels, callbackRef, analyticsRef.current);
      runtimeRef.current = runtime;
      applyLayerVisibility(runtime, layersRef.current);
      applyCameraView(runtime, viewRef.current);
      const initialVoidZone = runtime.voidZonesById?.get(focusVoidZoneRef.current)
        || (analyticsRef.current.sceneProfile === 'landing' && analyticsRef.current.visualizationMode === 'space'
          ? runtime.voidZonesById?.get('VOID-I-001') || [...runtime.voidZonesById.values()].find((zone) => zone.classification === 'UNEXPLAINED_VOID')
          : null);
      if (initialVoidZone) {
        runtime.selectedVoidZone = initialVoidZone;
        updateSelectionMarker(runtime);
      }
      startEntranceTween(runtime);
    } catch (error) {
      onError?.(error);
      return undefined;
    }

    let animationFrame = 0;
    let disposed = false;
    let previousTime = performance.now();
    let lastUiUpdate = 0;
    let lastPhase = '';
    const render = (time) => {
      if (disposed) return;
      // Keep every rendered frame on the continuous path even when the browser drops frames.
      // Playback may take a little longer under load, but actors never skip an unrendered path segment.
      const delta = Math.min(0.05, Math.max(0, (time - previousTime) / 1000));
      previousTime = time;
      const snapshot = machine.tick(delta);
      updateRuntime(runtime, snapshot, delta);
      updateVisualizationTransition(runtime);
      updateAnalysisTransition(runtime);
      updateCameraTween(runtime);
      runtime.controls.update();
      updateCargoLOD(runtime,time);
      updateHeroPresentation(runtime);
      if (!runtime.contextLost) {
        runtime.renderer.info.reset();
        if (runtime.postProcessingEnabled && runtime.quality !== 'low') runtime.composer.render();
        else runtime.renderer.render(runtime.scene, runtime.camera);
      }
      updatePerformance(runtime, time);
      if (snapshot.phase !== lastPhase || time - lastUiUpdate > 100) {
        lastPhase = snapshot.phase;
        lastUiUpdate = time;
        updateScreenLabels(runtime, snapshot);
        onSnapshot?.(snapshot);
      }
      animationFrame = window.requestAnimationFrame(render);
    };
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      runtime.disposed = true;
      window.cancelAnimationFrame(animationFrame);
      runtime.resizeObserver.disconnect();
      runtime.controls.dispose();
      runtime.removeInteractions?.();
      runtime.removeContextHandlers?.();
      runtime.composer.dispose();
      runtime.environmentTexture?.dispose();
      runtime.skyTexture?.dispose();
      runtime.heroBackground?.dispose();
      for(const batch of runtime.placedBatches.values())for(const level of Object.values(batch.lod||{})){
        level.geometry.dispose();
        for(const material of level.materials){for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}
      }
      disposeObject(runtime.scene);
      runtime.renderer.dispose();
      runtime.renderer.forceContextLoss?.();
      runtime.renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, [machine, onSnapshot, onError]);

  return <div className="twin-canvas" ref={mountRef} role="img" aria-label="真实装箱作业三维场景">
    <div className="scene-label-layer" aria-hidden="true">
      {sceneLabels.filter((label) => label.kind !== 'void' || visualizationMode === 'space').map((label) => <div className={`scene-label scene-label--${label.kind}`} key={label.id} style={{ left: label.x, top: label.y, width: label.width }}><strong>{label.text}</strong><span>{label.detail}</span></div>)}
    </div>
  </div>;
}

function createRuntime(mount, machine, mode, debugLayers, labelMode, visibleQueueIndices, activeFilterCount, setSceneLabels, callbackRef, analytics = {}) {
  const container = machine.container;
  const length = Number(container.innerLength || 1) * MM;
  const width = Number(container.innerWidth || 1) * MM;
  const height = Number(container.innerHeight || 1) * MM;
  const scene = new THREE.Scene();
  const skyTexture = null;
  scene.background = new THREE.Color(FINAL_VISUAL_PROFILE.background);
  scene.environmentIntensity = FINAL_VISUAL_PROFILE.environmentIntensity;
  scene.fog = new THREE.Fog('#444749', 18, 48);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // EffectComposer contains multiple render passes. Disable per-pass resets so
  // renderer.info represents the whole frame; the animation loop resets once.
  renderer.info.autoReset = false;
  const initialQuality = normalizeQuality(analytics.quality);
  renderer.setPixelRatio(pixelRatioFor(initialQuality));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = FINAL_VISUAL_PROFILE.toneMapping;
  renderer.toneMappingExposure = FINAL_VISUAL_PROFILE.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The completed-plan hero is static. Render its shadow atlas once, then only
  // invalidate while actors or placement transitions are actually moving.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.appendChild(renderer.domElement);

  // 面光源（顶光）需要 LTC 查找表；不初始化则 RectAreaLight 不发光。
  RectAreaLightUniformsLib.init();

  const environmentTexture = buildEnvironment(renderer, scene);

  const composer = new EffectComposer(renderer);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.rotateSpeed=.45;
  controls.zoomSpeed=.7;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.2;
  controls.maxDistance = 38;
  controls.maxPolarAngle = Math.PI * 0.48;

  const hemi=new THREE.HemisphereLight('#eee9df', '#252321', 0.32);scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff1df', 3.2);
  key.position.set(-3, 10, 5);
  key.castShadow = true;
  const initialShadowSize = shadowSizeFor(initialQuality);
  key.shadow.mapSize.set(initialShadowSize, initialShadowSize);
  key.shadow.camera.left = -11; key.shadow.camera.right = 11; key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.00012;
  key.shadow.normalBias = 0.008;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#d8e3ef', 0.7);
  fill.position.set(8, 4, 7);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#f1f4ff', 2.1);
  rim.position.set(2, 6, -6);
  scene.add(rim);
  const overhead = new THREE.RectAreaLight('#fffaf1', 2.5, Math.max(8, length * 0.72), 3.8);
  overhead.position.set(0, height + 4.6, 0);
  overhead.rotation.x = -Math.PI / 2;
  scene.add(overhead);

  const worksite = createWorksite(scene, { length, width, height });
  const sceneProfile = analytics.sceneProfile === 'landing' ? 'landing' : 'workspace';
  if (sceneProfile === 'landing') {
    worksite.backdrop.visible = false;
    worksite.zoneMeshes.forEach((mesh) => { mesh.visible = false; });
  }

  const groups = {
    container: new THREE.Group(),
    zones: new THREE.Group(),
    labels: new THREE.Group(),
    placed: new THREE.Group(),
    waiting: new THREE.Group(),
    path: new THREE.Group(),
    target: new THREE.Group(),
    selection: new THREE.Group(),
    evidence: new THREE.Group(),
    analysis: new THREE.Group(),
    space: new THREE.Group(),
    layoutVoid: new THREE.Group(),
    layoutReserve: new THREE.Group(),
    layoutLowFill: new THREE.Group(),
    layoutSecuring: new THREE.Group(),
    voidZones: new THREE.Group(),
    explainedSpace: new THREE.Group(),
    riskObjects: new THREE.Group(),
    actors: new THREE.Group()
  };
  Object.values(groups).forEach((group) => scene.add(group));
  const containerFallback = new THREE.Group();
  containerFallback.name = 'procedural-container-fallback';
  groups.container.add(containerFallback);
  const externalPresentation=container.presentationVersion==='external-hero-v1';
  if(externalPresentation){key.shadow.normalBias=.002;key.shadow.bias=-.0002;}
  if(externalPresentation)createHeroGroundMarks(worksite.group,{length,width,height});
  const standardKey=externalPresentation?assetKeyForContainer(container.standardType):null;
  const parametricSource=externalPresentation&&!standardKey;
  const containerModel = parametricSource?createHighQualitySourceContainer(containerFallback,{length,width,height}):createIndustrialContainer(containerFallback, { length, width, height });
  const doors = containerModel.doors;
  createZoneLabels(groups.labels, { length, width, height });
  const forklift = createIndustrialForklift();
  groups.actors.add(forklift.group);
  const worker = createManualWorker();
  groups.actors.add(worker.group);
  const palletJack = new THREE.Group();
  groups.actors.add(palletJack);

  const runtime = {
    commerce:machine.queue.some(c=>['commerce-v4','commerce-v6'].includes(c.visualProfile?.version)),
    mount,
    machine,
    scene,
    camera,
    renderer,
    composer,
    gtaoPass: null,
    environmentTexture,
    skyTexture,
    controls,
    groups,
    doors,
    containerModel,
    externalPresentation,
    parametricSource,
    ...(parametricSource?{heroContainer:containerFallback}:{}),
    forklift,
    worker,
    palletJack,
    worksite,
    mode: mode === 'review' ? 'review' : 'operation',
    debugLayers,
    labelMode: ['simple', 'detail', 'debug'].includes(labelMode) ? labelMode : 'simple',
    setSceneLabels,
    callbackRef,
    labelSignature: '',
    visibleQueueIndices: new Set(visibleQueueIndices),
    activeFilterCount: Number(activeFilterCount || 0),
    dimensions: { length, width, height },
    sceneProfile,
    unloadState: analytics.unloadState?.active ? analytics.unloadState : null,
    visualizationMode: VISUALIZATION_MODES.includes(analytics.visualizationMode) ? analytics.visualizationMode : 'normal',
    panelOpen: Boolean(analytics.panelOpen),
    isolate: analytics.isolate || null,
    postProcessingEnabled: analytics.postProcessing !== false,
    quality: initialQuality,
    keyLight: key,
    directionLights:{key,fill,rim,overhead,hemi},
    presentationMode:analytics.presentationMode==='hero'?'hero':'inspection',
    analyticsContext: buildVisualizationContext(machine.queue, container),
    placedBatches: new Map(),
    placedCount: -1,
    spawnAnims: [],
    visualizationTransition: null,
    analysisTransition: null,
    analysisFactors: { analysis: 0, space: 0, voidZones: 0 },
    labelPositions: new Map(),
    currentObject: null,
    currentCargoKey: null,
    waitingIndex: -1,
    pathIndex: -1,
    previousForkPosition: null,
    selectedItem: null,
    hoveredItem: null,
    selectedVoidZone: null,
    voidZonesById: new Map(),
    outlineMaterials: [],
    contextLost: false,
    lastSnapshot: machine.getSnapshot(),
    performance: { frames: 0, startedAt: performance.now(), lastReportAt: performance.now() },
    actorCameraActive: false,
    cameraTween: null,
    cameraInitialized: false,
    unloadMotionStartedAt: performance.now(),
    unloadMotionDurationMs: unloadMotionDuration(Number(analytics.unloadState?.speed || 1)),
    unloadCurrentPlacement: null,
    unloadPathPoints: null,
    stagingLabelAnchor: null
  };

  initializeHeroDirection(runtime);
  buildComposer(runtime);
  runtime.algorithmDiagnostics = createAlgorithmDiagnostics(machine.plan, container);
  scene.add(runtime.algorithmDiagnostics);
  applySceneMode(runtime, runtime.mode, debugLayers);
  initializePlacedBatches(runtime);
  initializeWaitingBatches(runtime);
  createAnalysisOverlays(runtime);
  createLayoutDebugOverlays(runtime);
  syncEvidenceOverlay(runtime, analytics.evidenceOverlay || []);
  hydrateHeroAssets(runtime, { containerFallback });
  installPicking(runtime);
  installContextRecovery(runtime);
  applyQueueFilter(runtime, visibleQueueIndices, activeFilterCount);
  mount.dataset.qualityTier = initialQuality;
  applyHeroDirection(runtime);

  const resize = () => {
    const widthPx = Math.max(320, mount.clientWidth);
    const heightPx = Math.max(320, mount.clientHeight);
    renderer.setSize(widthPx, heightPx, false);
    composer.setSize(widthPx, heightPx);
    camera.aspect = widthPx / heightPx;
    camera.updateProjectionMatrix();
    updateOutlineResolution(runtime);
  };
  const resizeObserver = new ResizeObserver(() => {
    resize();
    applyCameraView(runtime, viewRefSafe(runtime), { immediate: !runtime.cameraInitialized });
  });
  runtime.resizeObserver = resizeObserver;
  if (import.meta.env.DEV) mount.__inspection = runtime;
  resizeObserver.observe(mount);
  resize();
  return runtime;
}

function hydrateHeroAssets(runtime, { containerFallback }) {
  heroAssetRegistry.instantiate('palletJack', {parent:runtime.palletJack,onReady:({scene})=>{
    scene.rotation.y=Math.PI;
    calibrateRuntimeAssetMaterials(scene, 'actor', runtime.renderer);
    runtime.jackAsset=scene;
    runtime.jackWheels=[];scene.traverse(node=>{if(/^jack_wheel_\d+$/.test(node.name))runtime.jackWheels.push(node);});
    runtime.mount.dataset.palletJackAssetSource='glb-articulated';
    applyHeroDirection(runtime);
  }});
  const originalContainerKey = assetKeyForContainer(runtime.externalPresentation?(runtime.machine.container?.standardType||runtime.machine.container?.typeId):runtime.machine.container?.typeId);
  const source5870 = exactAssetMode() && [runtime.dimensions.length,runtime.dimensions.width,runtime.dimensions.height].every((v,i)=>Math.abs(v-[5.870,2.330,2.200][i])<.00001);
  const reviewAssets=new URLSearchParams(window.location.search).get('assets')==='commerce-v6';
  const containerKey = reviewAssets&&originalContainerKey==='container40hq'?'review_container40hq':(industrialAssetMode()||runtime.commerce)&&originalContainerKey==='container40hq'?'industrial_container40hq':source5870 ? 'rebuild_source5870' : exactAssetMode() && originalContainerKey==='container40hq' ? 'rebuild_container40hq' : originalContainerKey;
  // Source bins have their own real dimensions. The existing procedural shell
  // follows that envelope; substituting an unscaled 40HQ GLB is misleading.
  if(containerKey)heroAssetRegistry.instantiate(containerKey, {
    parent: runtime.groups.container,
    onReady: ({ scene }) => {
      if (runtime.disposed) return;
      scene.visible = false;
      if (!source5870) calibrateContainerAsset(scene, runtime.externalPresentation?(runtime.machine.container?.standardType||runtime.machine.container?.typeId):runtime.machine.container?.typeId, runtime.dimensions);
      scene.visible = true;
      calibrateRuntimeAssetMaterials(scene, 'container', runtime.renderer);
      if(runtime.externalPresentation&&!exactAssetMode()){scene.traverse(n=>{if(n.isMesh&&/floor/i.test(n.name)){n.visible=false;n.userData.portcubeOriginalVisible=false;}});createSourceWoodFloor(scene,runtime.dimensions);}
      const leftPivot = findNamedNode(scene, 'door_left_pivot', 'left_door_pivot');
      const rightPivot = findNamedNode(scene, 'door_right_pivot', 'right_door_pivot');
      if (leftPivot && rightPivot) runtime.doors = { leftPivot, rightPivot };
      const batches = [findNamedNode(scene,'floor'),leftPivot,rightPivot].filter(Boolean)
        .map((root,index)=>batchStaticSubtree(root,index===0?'floor-static':'door-static'));
      runtime.mount.dataset.containerBatches = JSON.stringify(batches);
      containerFallback.visible = false;
      runtime.heroContainer = scene;
      applyHeroContainerMode(runtime, runtime.mode === 'review');
      runtime.mount.dataset.containerAssetSource = 'glb';
      runtime.mount.dataset.containerHeroMeshCount = String(countMeshes(scene));
      applyHeroDirection(runtime);
      invalidateShadows(runtime);
    },
    fallback: () => { runtime.mount.dataset.containerAssetSource = 'procedural-fallback'; }
  });
  else runtime.mount.dataset.containerAssetSource=runtime.parametricSource?'HIGH_QUALITY_PARAMETRIC_SOURCE_CONTAINER':'source-envelope-procedural';

  const forkliftFallback = [...runtime.forklift.group.children];
  heroAssetRegistry.instantiate('forkliftStandard', {
    parent: runtime.forklift.group,
    onReady: ({ scene }) => {
      if (runtime.disposed) return;
      scene.rotation.y = Math.PI;
      runtime.forklift.astra = true;
      runtime.forklift.soleOffset = 0;
      calibrateRuntimeAssetMaterials(scene, 'actor', runtime.renderer);
      forkliftFallback.forEach((child) => { child.visible = false; });
      runtime.forklift.carriage = findNamedNode(scene, 'forklift_carriage', 'carriage') || runtime.forklift.carriage;
      runtime.forklift.mast = findNamedNode(scene, 'forklift_mast');
      runtime.forklift.steeringWheel = findNamedNode(scene, 'steering_wheel');
      runtime.forklift.forks = ['fork_l', 'fork_r'].map((name) => findNamedNode(scene, name)).filter(Boolean);
      runtime.forklift.wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((name) => findNamedNode(scene, name)).filter(Boolean);
      runtime.forklift.carriageHome = runtime.forklift.carriage.position.y;
      runtime.forklift.forks.forEach((fork) => { fork.userData.homeX = fork.position.x; });
      runtime.forklift.assetScale = scene.scale.clone();
      batchStaticAsset(scene, 'forklift-static', [runtime.forklift.mast, runtime.forklift.steeringWheel, runtime.forklift.carriage, ...runtime.forklift.forks, ...runtime.forklift.wheels]);
      runtime.mount.dataset.forkliftAssetSource = 'glb';
      applyHeroDirection(runtime);
      invalidateShadows(runtime);
    },
    fallback: () => { runtime.mount.dataset.forkliftAssetSource = 'procedural-fallback'; }
  });

  const workerFallback = [...runtime.worker.group.children];
  heroAssetRegistry.instantiate('workerA', {
    parent: runtime.worker.group,
    onReady: ({ scene }) => {
      if (runtime.disposed) return;
      scene.rotation.y = Math.PI;
      runtime.worker.standingAsset = scene;
      calibrateRuntimeAssetMaterials(scene, 'actor', runtime.renderer);
      runtime.worker.rig = bindWorkerRig(scene);
      workerFallback.forEach((child) => { child.visible = false; });
      runtime.worker.leftArmPivot = findNamedNode(scene, 'worker_left_arm_pivot') || runtime.worker.leftArmPivot;
      runtime.worker.rightArmPivot = findNamedNode(scene, 'worker_right_arm_pivot') || runtime.worker.rightArmPivot;
      runtime.worker.leftLegPivot = findNamedNode(scene, 'worker_left_leg_pivot') || runtime.worker.leftLegPivot;
      runtime.worker.rightLegPivot = findNamedNode(scene, 'worker_right_leg_pivot') || runtime.worker.rightLegPivot;
      runtime.worker.soleOffset = 0;
      runtime.mount.dataset.workerAssetSource = runtime.worker.rig ? 'glb-articulated' : 'glb';
      applyHeroDirection(runtime);
      invalidateShadows(runtime);
    },
    fallback: () => { runtime.mount.dataset.workerAssetSource = 'procedural-fallback'; }
  });

  // One articulated person serves every phase; no swapped static pose meshes.
  const variants = exactAssetMode() ? [...runtime.placedBatches.keys()] : [...new Set([...runtime.placedBatches].map(([key,b])=>/^cv[46]_/.test(key)?key:b.variant))];
  runtime.mount.dataset.cargoAssetSource = 'precision-loading';
  Promise.all(variants.map(async variant => {
    if(exactAssetMode()||/^cv[46]_/.test(variant)){const scene=await loadExactCargoAsset(variant);calibrateRuntimeAssetMaterials(scene,'cargo',runtime.renderer);return [variant,scene];}
    const family = variant.startsWith('carton') ? 'carton' : variant.startsWith('crate') ? 'crate' : variant.startsWith('equipment_case') ? 'equipment_case' : null;
    const qualityPreview = new URLSearchParams(window.location.search).get('assets') === 'quality-v1';
    const key = qualityPreview && family ? 'quality_'+family : `${runtime.externalPresentation?'external':'precision'}_${variant}`;
    const scene = (await heroAssetRegistry.load(key)).scene;
    calibrateRuntimeAssetMaterials(scene, 'cargo', runtime.renderer);
    return [variant, scene];
  })).then(entries => {
    if (runtime.disposed) return;
    applyPrecisionGeometries(runtime, new Map(entries));
    runtime.mount.dataset.cargoAssetSource = runtime.commerce?(reviewAssets?'commerce-v6':'commerce-v4'):industrialAssetMode()?'industrial-v3':exactAssetMode() ? 'exact-size-v2' : new URLSearchParams(window.location.search).get('assets') === 'quality-v1' ? 'quality-v1-sample' : runtime.externalPresentation?'external-hero-v1':'precision-v3';
    if(reviewAssets&&runtime.commerce)installCargoLODs(runtime,variants);
    applyHeroDirection(runtime);
    runtime.currentCargoKey = null;
    rebuildWaiting(runtime);
    invalidateShadows(runtime);
  }).catch(error => { runtime.mount.dataset.cargoAssetSource = 'procedural-fallback'; runtime.mount.dataset.assetWarning = error.message; console.warn('Cargo detail assets unavailable; retained exact-envelope procedural view:', error); });
}

function invalidateShadows(runtime) {
  if (!runtime.disposed && runtime.renderer?.shadowMap) runtime.renderer.shadowMap.needsUpdate = true;
}

function calibrateRuntimeAssetMaterials(root, kind, renderer) {
  configureAssetSampling(root, kind, renderer);
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      const name = String(material.name || '').toLowerCase();
      // Preserve the authored PBR response. Configure sampling and encoding only;
      // colour/data texture roles follow glTF, without procedural map substitution.
      if (kind === 'environment') {
        const isFloor = name.includes('concrete') || name.includes('floor');
        material.color?.set(isFloor ? '#1d2b36' : '#243441');
        material.transparent = true;
        material.opacity = isFloor ? 0.34 : 0.2;
        material.depthWrite = false;
        material.roughness = Math.max(0.76, Number(material.roughness || 0));
        if ('emissiveIntensity' in material) material.emissiveIntensity = Math.min(Number(material.emissiveIntensity || 0), 0.22);
      }
      material.needsUpdate = true;
    }
  });
}

function _curateInspectionBay(root) {
  const hiddenNames = new Set([
    'loading_bay_frame.003', 'loading_bay_frame.004',
    'overhead_light.003', 'overhead_light.004',
    'v21_baylabel_4', 'v21_baylabel_5',
    'v21_status_4', 'v21_status_5',
    'v21_guidance_branch_3', 'v21_guidance_branch_4', 'v21_guidance_spine',
    'v21_scan_label', 'v21_scan_plinth'
  ]);
  root.traverse((object) => {
    const name = String(object.name || '').toLowerCase();
    if (hiddenNames.has(name)
      || /guidance|status|baylabel|scan_label|scan_plinth/.test(name)
      || /^v21_zone_(back|front|left|right)_[45]$/.test(name)
      || /^v21_hazard_[lr]_[2-7]$/.test(name)) object.visible = false;
  });
}

function batchStaticAsset(root, label, movingRoots = []) {
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert();
  const groups = new Map();
  root.traverse((object) => {
    if (object === root || !object.isMesh || object.isSkinnedMesh || !isEffectivelyVisible(object, root)) return;
    for (let cursor = object; cursor && cursor !== root; cursor = cursor.parent) if (movingRoots.includes(cursor)) return;
    if (Array.isArray(object.material) || object.morphTargetInfluences?.length) return;
    const cloned = object.geometry.clone();
    const geometry = cloned.index ? cloned.toNonIndexed() : cloned;
    if (geometry !== cloned) cloned.dispose();
    for (const attribute of Object.keys(geometry.attributes)) {
      if (!['position', 'normal', 'uv'].includes(attribute)) geometry.deleteAttribute(attribute);
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse, object.matrixWorld));
    const signature = Object.keys(geometry.attributes).sort().join(',');
    const key = `${String(object.material.name || object.material.uuid).toLowerCase()}:${signature}`;
    if (!groups.has(key)) groups.set(key, { material: object.material, geometries: [], originals: [], castShadow: false, receiveShadow: false });
    const group = groups.get(key);
    group.geometries.push(geometry);
    group.originals.push(object);
    group.castShadow ||= object.castShadow;
    group.receiveShadow ||= object.receiveShadow;
  });

  let batches = 0;
  for (const group of groups.values()) {
    if (group.geometries.length < 2) {
      group.geometries.forEach((geometry) => geometry.dispose());
      continue;
    }
    const merged = mergeGeometries(group.geometries, false);
    group.geometries.forEach((geometry) => geometry.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, group.material);
    mesh.name = `${label}-batch-${batches + 1}`;
    mesh.castShadow = group.castShadow;
    mesh.receiveShadow = group.receiveShadow;
    group.originals.forEach((object) => object.parent?.remove(object));
    root.add(mesh);
    batches += 1;
  }
  root.updateMatrixWorld(true);
  return batches;
}

function isEffectivelyVisible(object, root) {
  for (let cursor = object; cursor; cursor = cursor.parent) {
    if (!cursor.visible) return false;
    if (cursor === root) break;
  }
  return true;
}

function applyPrecisionGeometries(runtime, prototypes) {
  for (const [key, batch] of runtime.placedBatches) {
    const item=runtime.machine.queue.find(i=>precisionBatchKey(i)===key);
    const result = (exactAssetMode()||/^cv[46]_/.test(key)) ? exactCargoGeometry(prototypes.get(key),batch.originalDimensions) : createPrecisionGeometry(prototypes.get(batch.variant), batch.originalDimensions,item?.presentationProfile);
    batch.mesh.geometry.dispose();
    batchMaterials(batch).forEach(material => material.dispose());
    batch.mesh.geometry = result.geometry;
    batch.mesh.material = result.materials;
    batch.physical = true; batch.precision = true; batch.mesh.visible = true;
    const waiting = runtime.waitingBatches?.get(key);
    if (waiting) {
      waiting.mesh.geometry.dispose(); batchMaterials(waiting).forEach(material => material.dispose());
      waiting.mesh.geometry = result.geometry.clone();
      waiting.mesh.material = result.materials.map(material => material.clone());
      waiting.physical = true; waiting.precision = true; waiting.mesh.visible = true;
    }
    batch.mesh.computeBoundingBox(); batch.mesh.computeBoundingSphere();
  }
  runtime.placedCount = -1;
}

function batchMaterials(batch) {
  return Array.isArray(batch.mesh.material) ? batch.mesh.material : [batch.mesh.material];
}

async function installCargoLODs(runtime,variants){
 try{
  await Promise.all(variants.filter(key=>/^cv[46]_/.test(key)).map(async key=>{
   const model=await loadExactCargoAsset(key,'low');
   if(runtime.disposed)return;
   calibrateRuntimeAssetMaterials(model,'cargo',runtime.renderer);
   const batch=runtime.placedBatches.get(key);if(!batch)return;
   batch.lod={high:{geometry:batch.mesh.geometry,materials:batchMaterials(batch)},low:exactCargoGeometry(model,batch.originalDimensions)};
   batch.lodLevel='high';
  }));
  runtime.mount.dataset.lodReady='true';
  runtime.lodLastUpdate=0;
 }catch(error){runtime.mount.dataset.lodReady='failed';console.error('Cargo LOD:',error);}
}
function updateCargoLOD(runtime,time){
 if(runtime.disposed||time-(runtime.lodLastUpdate||0)<250)return;
 runtime.lodLastUpdate=time;
 const matrix=new THREE.Matrix4(),point=new THREE.Vector3();let high=0,low=0;
 for(const batch of runtime.placedBatches.values()){
  if(!batch.lod||!batch.mesh.count)continue;
  let distance=Infinity;
  for(let i=0;i<batch.mesh.count;i++){batch.mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);batch.mesh.localToWorld(point);distance=Math.min(distance,point.distanceTo(runtime.camera.position));}
  const screenPixels=Math.max(...batch.originalDimensions)*runtime.mount.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(runtime.camera.fov/2))*Math.max(.1,distance));
  // Hysteresis keeps a camera near the threshold from flickering between meshes.
  const level=screenPixels>(batch.lodLevel==='high'?145:185)?'high':'low';
  if(level!==batch.lodLevel){batch.mesh.geometry=batch.lod[level].geometry;batch.mesh.material=batch.lod[level].materials;batch.lodLevel=level;batch.mesh.computeBoundingBox();batch.mesh.computeBoundingSphere();invalidateShadows(runtime);}
  if(level==='high')high+=batch.mesh.count;else low+=batch.mesh.count;
 }
 runtime.mount.dataset.cargoLodCounts=JSON.stringify({high,low});
}

function syncEvidenceOverlay(runtime, entries = []) {
  const group = runtime.groups.evidence;
  if (!group) return;
  while (group.children.length) {
    const child = group.children.pop();
    disposeObject(child);
  }
  const { length, width } = runtime.dimensions;
  for (const entry of entries) {
    const item = entry?.cargo;
    const position = entry?.position;
    if (!item || !position) continue;
    const object = createCargoObject(item, {
      ghost: true,
      wireframe: entry.wireframe === true,
      opacity: Number(entry.opacity ?? 0.22),
      color: entry.color || '#e07a35',
      edgeColor: entry.edgeColor || entry.color || '#e07a35',
      showMarker: false
    });
    object.position.set(
      Number(position.x || 0) * MM - length / 2,
      Number(position.y || 0) * MM,
      Number(position.z || 0) * MM - width / 2
    );
    object.userData.evidenceKind = entry.kind || 'candidate';
    group.add(object);
  }
  runtime.mount.dataset.evidenceOverlayCount = String(group.children.length);
}

// 画质档位：流畅（直渲染）/ 标准（SMAA）/ 极致（GTAO+SMAA+高分辨率+高清阴影）。
// postProcessing=false 保持旧语义：完全绕过后处理链直接渲染。
function normalizeQuality(value) {
  return ['low', 'standard', 'high'].includes(value) ? value : 'standard';
}

function pixelRatioFor(quality) {
  const dpr = window.devicePixelRatio || 1;
  if(industrialAssetMode() && quality!=='low') return Math.min(dpr,1.25);
  if(exactAssetMode() && quality!=='low') return Math.min(dpr*1.5,2);
  if (quality === 'high') return Math.min(dpr, 2);
  if (quality === 'low') return 1;
  return Math.min(dpr, 1.5);
}

function shadowSizeFor(quality) {
  if (quality === 'high') return 2048;
  if (quality === 'low') return 512;
  return 2048;
}

function gtaoEnabled(runtime) {
  return runtime.quality !== 'low' && runtime.postProcessingEnabled;
}

function applyQuality(runtime, quality) {
  runtime.quality = normalizeQuality(quality);
  runtime.renderer.setPixelRatio(pixelRatioFor(runtime.quality));
  const size = shadowSizeFor(runtime.quality);
  if (runtime.keyLight.shadow.mapSize.x !== size) {
    runtime.keyLight.shadow.mapSize.set(size, size);
    runtime.keyLight.shadow.map?.dispose();
    runtime.keyLight.shadow.map = null;
  }
  buildComposer(runtime);
  const widthPx = Math.max(320, runtime.mount.clientWidth);
  const heightPx = Math.max(320, runtime.mount.clientHeight);
  runtime.renderer.setSize(widthPx, heightPx, false);
  runtime.composer.setSize(widthPx, heightPx);
  runtime.camera.aspect = widthPx / heightPx;
  runtime.camera.updateProjectionMatrix();
  updateOutlineResolution(runtime);
  runtime.mount.dataset.qualityTier = runtime.quality;
}

// 环境贴图（RoomEnvironment → PMREM），供 PBR 材质反射/环境光。
function buildEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const texture = pmrem.fromScene(roomEnvironment, 0.04).texture;
  scene.environment = texture;
  roomEnvironment.dispose();
  pmrem.dispose();
  return texture;
}

// Screen-space AO only sees physical surfaces. In particular, LineSegments2 is
// an instanced quad mesh, not Line2: overriding its material makes a solid card.
class InspectionAOPass extends GTAOPass {
  setSize(width, height) {
    const scale = this.resolutionScale ?? 1;
    super.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  }
  _overrideVisibility() {
    super._overrideVisibility();
    this.scene.traverseVisible((object) => {
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      if (object.isLineSegments2 || object.isSprite || materials.some((material) => material.isMeshBasicMaterial || material.depthWrite === false)) {
        object.visible = false;
        this._visibilityCache.push(object);
      }
    });
  }
}

// RenderPass → contact AO → SMAA → OutputPass; dimensions are in meters.
function buildComposer(runtime) {
  const { renderer, scene, camera, composer, dimensions } = runtime;
  const { length, width, height } = dimensions;
  for (const pass of [...composer.passes]) {
    composer.removePass(pass);
    pass.dispose?.();
  }
  composer.addPass(new RenderPass(scene, camera));
  const detailedCargo=exactAssetMode()||runtime.commerce;
  if(detailedCargo){composer.renderTarget1.samples=4;composer.renderTarget2.samples=4;}
  runtime.gtaoPass = null;

  if (gtaoEnabled(runtime)) {
    const high = runtime.quality === 'high';
    const gtao = new InspectionAOPass(scene, camera, Math.max(1, runtime.mount.clientWidth), Math.max(1, runtime.mount.clientHeight));
    // AO is a broad contact cue; keep geometry/SMAA sharp at full resolution.
    gtao.resolutionScale = exactAssetMode() ? 1 : high ? 1 : .65;
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = high ? 0.62 : 0.38;
    gtao.updateGtaoMaterial({ radius: high ? 0.48 : 0.34, distanceExponent: 1, thickness: high ? 1 : 0.82, scale: 1, samples: high ? 16 : 8, distanceFallOff: 1, screenSpaceRadius: false });
    if(detailedCargo){gtao.blendIntensity=.42;gtao.updateGtaoMaterial({radius:.055,samples:16,thickness:.20});}
    gtao.setSceneClipBox(new THREE.Box3(
      new THREE.Vector3(-length / 2 - 1, -0.2, -width / 2 - 1.2),
      new THREE.Vector3(length / 2 + 6.6, Math.max(height + 0.5, 3.4), width / 2 + 1.2)
    ));
    composer.addPass(gtao);
    runtime.gtaoPass = gtao;
  }

  const pixelRatio = renderer.getPixelRatio();
  const smaa = new SMAAPass(Math.max(1, runtime.mount.clientWidth * pixelRatio), Math.max(1, runtime.mount.clientHeight * pixelRatio));
  composer.addPass(smaa);
  composer.addPass(new OutputPass());
  composer.setSize(Math.max(320, runtime.mount.clientWidth), Math.max(320, runtime.mount.clientHeight));
}

// WebGL 上下文丢失/恢复：丢失时阻断默认行为以便恢复；恢复后重建环境贴图与后处理链，
// 失败则通过 onError 降级为可刷新界面，绝不白屏。
function installContextRecovery(runtime) {
  const canvas = runtime.renderer.domElement;
  const onLost = (event) => {
    event.preventDefault();
    runtime.contextLost = true;
    runtime.mount.dataset.contextLost = 'true';
  };
  const onRestored = () => {
    try {
      runtime.environmentTexture?.dispose();
      runtime.environmentTexture = buildEnvironment(runtime.renderer, runtime.scene);
      buildComposer(runtime);
      runtime.contextLost = false;
      runtime.mount.dataset.contextLost = 'recovered';
    } catch (error) {
      runtime.callbackRef.current?.onError?.(error);
    }
  };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);
  runtime.removeContextHandlers = () => {
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
  };
}

function updateOutlineResolution(runtime) {
  const dpr = runtime.renderer.getPixelRatio();
  const w = Math.max(1, runtime.mount.clientWidth * dpr);
  const h = Math.max(1, runtime.mount.clientHeight * dpr);
  for (const material of runtime.outlineMaterials) material.resolution.set(w, h);
  for (const material of runtime.pathOutlineMaterials || []) material.resolution.set(w, h);
  runtime.riskOutlineMaterial?.resolution.set(w, h);
}

function createZoneLabels(labelParent, { length, width, height }) {
  labelParent.add(makeLabelSprite('货物等待区', { x: length / 2 + 4.4, y: 0.22, z: -width / 2 - 0.72 }, '#5c3b25'));
  labelParent.add(makeLabelSprite('门前对准区', { x: length / 2 + 1.15, y: 0.22, z: -width / 2 - 0.5 }, '#6e5417'));
  labelParent.add(makeLabelSprite('高 X 门端', { x: length / 2 + 0.15, y: Math.min(2.55, height - 0.12), z: 0 }, '#943f29'));
}

function createCargoObject(item, options = {}) {
  const group = new THREE.Group();
  const l = Math.max(0.03, Number(item.l || item.length || 1) * MM);
  const h = Math.max(0.03, Number(item.h || item.height || 1) * MM);
  const w = Math.max(0.03, Number(item.w || item.width || 1) * MM);
  if (options.visualBatch?.physical && !options.ghost) {
    const batch = options.visualBatch;
    const body = new THREE.Mesh(batch.mesh.geometry.clone(), batchMaterials(batch).map(m => m.clone()));
    body.scale.set(batch.precision ? 1 : l, batch.precision ? 1 : h, batch.precision ? 1 : w);
    if (batch.precision) precisionOrientation(item, body.quaternion);
    body.position.set(l / 2, h / 2, w / 2);
    body.castShadow = true; body.receiveShadow = true; group.add(body);
    group.userData.item = item;
    return group;
  }
  const visual = cargoVisualDescriptor(item);
  const appearance = visual.appearance;
  const baseColor = options.color || (options.ghost ? '#2ba6a1' : appearance.color);
  const typeProps = getMaterialProps(appearance.key);
  // 受光材质：默认关闭自发光，让光照/阴影真实呈现；仅“当前作业件”保留低强度高亮。
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    map: options.ghost || options.wireframe ? null : cargoPatternTexture(appearance.pattern),
    emissive: options.current ? '#c2541f' : '#000000',
    emissiveIntensity: options.current ? 0.34 : 0,
    roughness: typeProps.roughness,
    metalness: typeProps.metalness,
    transparent: Boolean(options.opacity && options.opacity < 1),
    opacity: options.opacity ?? 1,
    wireframe: Boolean(options.wireframe),
    depthWrite: !options.ghost
  });
  const cornerRadius = Math.min(visual.primitive === 'soft-bag' ? 0.085 : 0.028, l * 0.12, h * 0.12, w * 0.12);
  const geometry = visual.primitive === 'drum'
    ? new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, false)
    : new RoundedBoxGeometry(l, h, w, 2, cornerRadius);
  if (visual.primitive === 'drum') geometry.scale(l, h, w);
  const body = new THREE.Mesh(geometry, material);
  body.position.set(l / 2, h / 2, w / 2);
  body.castShadow = !options.ghost; body.receiveShadow = true; group.add(body);
  if (!options.wireframe) {
    const edgeColor = options.edgeColor || (options.current ? '#f07a2d' : appearance.accent);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry, 38), new THREE.LineBasicMaterial({ color: edgeColor, transparent: Boolean(options.opacity), opacity: options.ghost ? 0.95 : options.opacity ?? 0.82 }));
    edges.position.copy(body.position); group.add(edges);
    if (options.showMarker !== false) addCargoDetail(group, appearance, { l, h, w });
  }
  group.userData.item = item;
  return group;
}

function addCargoDetail(group, appearance, { l, h, w }) {
  const mkMat = (color, rough, metal, emi) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: emi || '#000', emissiveIntensity: emi ? 0.3 : 0 });

  if (appearance.key === 'crate') {
    // 木箱：表面木条板 + 角铁加固
    const plankMat = mkMat('#5e3e25', 0.9, 0.02);
    for (let i = 0; i < 5; i++) {
      const y = h * (i + 0.5) / 5;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.025, h * 0.14, w * 0.94), plankMat);
      plank.position.set(l + 0.014, y, w / 2); group.add(plank);
    }
    // 角铁
    const ironMat = mkMat('#3a3a3a', 0.3, 0.8);
    for (const [px, py] of [[0,0],[0,h],[l,0],[l,h]]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), ironMat);
      cap.position.set(px, py, 0); group.add(cap);
      const cap2 = cap.clone(); cap2.position.z = w; group.add(cap2);
    }
  } else if (appearance.key === 'equipment_case') {
    // 设备：散热栅格 + 控制面板 + 顶部吊环
    const darkMat = mkMat('#1a1a1a', 0.3, 0.6);
    for (let i = 0; i < 4; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(l * 0.55, 0.018, 0.012), darkMat);
      vent.position.set(l / 2, h * (0.28 + i * 0.13), w + 0.008); group.add(vent);
    }
    const panelMat = mkMat('#222', 0.2, 0.7);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.018, h * 0.22, w * 0.38), panelMat);
    panel.position.set(l + 0.012, h * 0.32, w / 2); group.add(panel);
    // 指示灯
    const ledMat = mkMat('#2ecc40', 0.2, 0.1, '#1a5a1a');
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), ledMat);
    led.position.set(l + 0.022, h * 0.42, w * 0.38); group.add(led);
    // 吊环
    const boltMat = mkMat('#555', 0.3, 0.8);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.045, 8), boltMat);
    bolt.rotation.z = Math.PI / 2; bolt.position.set(l / 2, h + 0.025, w / 2); group.add(bolt);
  } else if (appearance.key === 'wrapped') {
    // 易碎品：红色十字标 + 顶部警告条
    const redMat = mkMat('#c0392b', 0.35, 0.05, '#3a1010');
    const barH = Math.min(h * 0.55, 0.25);
    const barW = Math.min(w * 0.55, 0.25);
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.016, barH, barW * 0.18), redMat);
    bar1.position.set(l + 0.01, h * 0.5, w / 2); group.add(bar1);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.016, barH * 0.18, barW), redMat);
    bar2.position.set(l + 0.01, h * 0.5, w / 2); group.add(bar2);
    // 顶部红色警告带
    const warnMat = mkMat('#e74c3c', 0.3, 0.05, '#5a1810');
    const band = new THREE.Mesh(new THREE.BoxGeometry(l * 0.82, 0.028, w * 0.82), warnMat);
    band.position.set(l / 2, h + 0.016, w / 2); group.add(band);
  } else if (appearance.key === 'drum') {
    const ringMat = mkMat('#2f4147', 0.28, 0.72);
    for (const y of [h * 0.12, h * 0.5, h * 0.88]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(l, w) * 0.49, Math.min(l, w) * 0.025, 6, 20), ringMat);
      ring.rotation.x = Math.PI / 2; ring.position.set(l / 2, y, w / 2); group.add(ring);
    }
  } else if (appearance.key === 'fibc') {
    const loopMat = mkMat('#817b6c', 0.82, 0.02);
    for (const x of [l * 0.22, l * 0.78]) for (const z of [w * 0.22, w * 0.78]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(Math.min(l, w) * 0.1, 0.012, 5, 12, Math.PI), loopMat);
      loop.rotation.x = Math.PI / 2; loop.position.set(x, h + 0.02, z); group.add(loop);
    }
  } else if (appearance.key === 'palletized') {
    // 重货：钢带捆扎 + 角护铁
    const strapMat = mkMat('#2a2a2a', 0.25, 0.85);
    for (let i = 1; i <= 2; i++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(l * 0.99, 0.028, w * 0.99), strapMat);
      band.position.set(l / 2, h * i / 3, w / 2); group.add(band);
    }
    for (let i = 1; i <= 2; i++) {
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.028, h * 0.99, w * 0.99), strapMat);
      b1.position.set(l * i / 3, h / 2, w / 2); group.add(b1);
    }
    // 角护
    const cornerMat = mkMat('#444', 0.2, 0.8);
    for (const [px, pz] of [[0,0],[0,w],[l,0],[l,w]]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.15, 0.04), cornerMat);
      cap.position.set(px, h * 0.075, pz); group.add(cap);
    }
  } else if (appearance.key === 'generic') {
    // 不可堆叠：顶部锥形标记
    const coneMat = mkMat('#e67e22', 0.4, 0.05, '#5a3010');
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.min(l, w) * 0.28, h * 0.18, 6), coneMat);
    cone.position.set(l / 2, h + h * 0.09, w / 2); group.add(cone);
    // 底部托盘
    const palletMat = mkMat('#6b4e30', 0.88, 0.02);
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(l * 1.05, 0.04, w * 1.05), palletMat);
    pallet.position.set(l / 2, -0.02, w / 2); group.add(pallet);
  } else if (appearance.key === 'carton') {
    // 配件箱：正面网格纹
    const gridMat = mkMat(appearance.accent, 0.5, 0.15);
    for (let i = 1; i < 4; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.014, h * 0.85, 0.018), gridMat);
      line.position.set(l + 0.01, h / 2, w * i / 4); group.add(line);
    }
    for (let i = 1; i < 3; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.018, w * 0.85), gridMat);
      line.position.set(l + 0.01, h * i / 3, w / 2); group.add(line);
    }
  } else {
    // 纸箱：封箱胶带 + 侧边接缝
    const tapeMat = mkMat('#9b7842', 0.88, 0.02);
    const topTape = new THREE.Mesh(new THREE.BoxGeometry(l * 0.72, 0.014, w * 0.1), tapeMat);
    topTape.position.set(l / 2, h + 0.008, w / 2); group.add(topTape);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.008, h * 0.92, 0.016), tapeMat);
    seam.position.set(l / 2, h / 2, w + 0.004); group.add(seam);
    // 底部封箱带
    const bottomTape = new THREE.Mesh(new THREE.BoxGeometry(l * 0.72, 0.014, w * 0.1), tapeMat);
    bottomTape.position.set(l / 2, 0.008, w / 2); group.add(bottomTape);
  }
}

function updateRuntime(runtime, snapshot, delta) {
  runtime.groups.explainedSpace.visible=runtime.mode==='review' && !runtime.unloadState?.active;
  runtime.lastSnapshot = snapshot;
  if (runtime.stagingLabels) runtime.stagingLabels.visible = runtime.mode === 'operation' && snapshot.phase !== 'COMPLETED' && viewRefSafe(runtime)!=='follow';
  // 演员触底偏移：程序化/GLB 资产的脚底/轮底相对 group 原点的偏差（懒计算一次）。
  if (runtime.worker.soleOffset == null) runtime.worker.soleOffset = computeSoleOffset(runtime.worker.group);
  if (runtime.forklift.soleOffset == null) runtime.forklift.soleOffset = computeSoleOffset(runtime.forklift.group);
  runtime.mount.dataset.phase = snapshot.phase;
  const unloadActive = Boolean(runtime.unloadState?.active);
  const effectiveDoorProgress = unloadActive ? 1 : Number(snapshot.doorProgress || 0);
  runtime.mount.dataset.doorProgress = effectiveDoorProgress.toFixed(4);
  runtime.mount.dataset.currentIndex = String(snapshot.currentIndex);
  runtime.mount.dataset.completedCount = String(snapshot.completedCount);
  runtime.mount.dataset.totalCount = String(snapshot.total);
  runtime.mount.dataset.speed = String(snapshot.speed);
  runtime.mount.dataset.currentCargo = snapshot.currentCargo?.cargoId || '';
  runtime.mount.dataset.actorType = snapshot.actorType || 'forklift';
  runtime.mount.dataset.actorStage = snapshot.actorStage || 'idle';
  runtime.mount.dataset.forkliftPosition = pointDataset(snapshot.forklift.position);
  runtime.mount.dataset.cargoPosition = snapshot.cargoPose ? pointDataset(snapshot.cargoPose.position) : '';
  runtime.mount.dataset.forkHeight = Number(snapshot.forklift.forkHeight || 0).toFixed(2);
  runtime.mount.dataset.forkExtension = Number(snapshot.forklift.forkExtension || 0).toFixed(4);
  runtime.mount.dataset.workerPosition = pointDataset(snapshot.worker?.position);
  runtime.mount.dataset.workerCarryPose = String(Boolean(snapshot.worker?.carryPose));
  runtime.mount.dataset.actorPosition = pointDataset(snapshot.actorType === 'manual' ? snapshot.worker?.position : snapshot.forklift.position);
  runtime.mount.dataset.targetPosition = snapshot.currentCargo ? pointDataset(snapshot.currentCargo) : '';
  runtime.mount.dataset.isCarrying = String(Boolean(snapshot.attached));
  runtime.mount.dataset.enteredDoor = String(Boolean(snapshot.cargoPose && Number(snapshot.cargoPose.position.x) < Number(runtime.machine.container.innerLength || 0)));
  runtime.mount.dataset.released = String(snapshot.phase === 'RELEASE_CARGO' && !snapshot.attached || ['REVERSE_OUT', 'RETURN_FOR_NEXT', 'COMPLETED'].includes(snapshot.phase));
  runtime.mount.dataset.doorCount = '2';
  runtime.mount.dataset.doorEnd = 'high-x';
  runtime.mount.dataset.placedRendering = 'instanced';
  runtime.mount.dataset.placedInstances = String(snapshot.placedCargo.length);
  const { length, width } = runtime.dimensions;
  const toWorld = (position) => new THREE.Vector3(position.x * MM - length / 2, position.y * MM, position.z * MM - width / 2);
  const doorAngle = THREE.MathUtils.degToRad(102) * effectiveDoorProgress;
  // Authored GLBs and source assemblies have opposite closed hinge axes.
  const authoredDoorAxes = runtime.heroContainer && !runtime.parametricSource;
  runtime.doors.leftPivot.rotation.y = authoredDoorAxes ? -doorAngle : doorAngle;
  runtime.doors.rightPivot.rotation.y = authoredDoorAxes ? doorAngle : -doorAngle;
  runtime.doors.leftPivot.visible = !unloadActive;
  runtime.doors.rightPivot.visible = !unloadActive;
  if (runtime.lastDoorProgress !== effectiveDoorProgress || runtime.lastUnloadActive !== unloadActive) invalidateShadows(runtime);
  runtime.lastDoorProgress = effectiveDoorProgress;
  runtime.lastUnloadActive = unloadActive;

  const placedIds = new Set(snapshot.placedCargo.map((item) => item.cargoId));
  const placementSignature=snapshot.placedCargo.map(c=>`${c.cargoId}:${c.x},${c.y},${c.z},${c.displayYaw || 0}`).join('|');
  if (runtime.placedCount !== snapshot.placedCargo.length || runtime.placementSignature!==placementSignature) {
    updatePlacedBatches(runtime, snapshot.placedCargo);
    runtime.placementSignature=placementSignature;
    // Released cargo is already at its final transform. No independent spawn clock.
  }
  updateSpawnAnimations(runtime);
  updateUnloadMotion(runtime, delta);

  const currentKey = snapshot.currentCargo?.cargoId || null;
  if (currentKey !== runtime.currentCargoKey) {
    if (runtime.currentObject) { runtime.groups.actors.remove(runtime.currentObject); disposeObject(runtime.currentObject); }
    runtime.currentObject = snapshot.currentCargo ? createCargoObject(snapshot.currentCargo, { current: true, visualBatch: runtime.placedBatches.get(precisionBatchKey(snapshot.currentCargo)) }) : null;
    if (runtime.currentObject) runtime.groups.actors.add(runtime.currentObject);
    runtime.currentCargoKey = currentKey;
    rebuildPath(runtime, snapshot);
    rebuildTarget(runtime, snapshot);
    applyQueueFilter(runtime, [...runtime.visibleQueueIndices], runtime.activeFilterCount);
  }
  if (runtime.currentObject && snapshot.cargoPose) {
    runtime.currentObject.position.copy(toWorld(snapshot.cargoPose.position));
    const yaw=Number(snapshot.cargoPose.yaw || 0),c=snapshot.currentCargo;
    runtime.currentObject.rotation.y=yaw;
    const centre=new THREE.Vector3(c.l*MM/2,0,c.w*MM/2);
    runtime.currentObject.position.add(centre.clone().sub(centre.clone().applyAxisAngle(new THREE.Vector3(0,1,0),yaw)));
    runtime.currentObject.visible = !placedIds.has(currentKey);
  }
  const waitingKey=`${snapshot.currentIndex}:${snapshot.completedCount}:${snapshot.inProgress}`;
  if (runtime.waitingIndex !== waitingKey) {
    runtime.waitingIndex = waitingKey;
    rebuildWaiting(runtime);
  }

  const forkWorld = toWorld(snapshot.forklift.position);

  runtime.forklift.group.position.copy(forkWorld);
  runtime.forklift.group.position.y += runtime.forklift.soleOffset || 0;
  runtime.forklift.group.rotation.y = snapshot.forklift.yaw;
  runtime.forklift.carriage.position.y = (runtime.forklift.carriageHome ?? .18) + Number(snapshot.forklift.forkHeight || 0) * MM / (runtime.forklift.assetScale?.y || 1);
  runtime.forklift.forks.forEach((fork) => { fork.position.x = (fork.userData.homeX ?? -.43) - Number(snapshot.forklift.forkExtension || 0) * .35 / (runtime.forklift.assetScale?.x || 1); });
  if (runtime.forklift.astra && snapshot.cargoPose && snapshot.actorType === 'forklift') {
    runtime.forklift.carriage.position.y = (runtime.forklift.carriageHome ?? .143) + ((snapshot.forklift.forkSurface ?? snapshot.cargoPose.position.y+85) - snapshot.forklift.position.y)*MM - .143;
  }
  runtime.forklift.wheels.forEach((wheel) => { wheel.rotation.z = -Number(snapshot.forklift.distanceM||0) / (wheel.name.includes('_f') ? .29 : .235); });
  const previousYaw=runtime.lastForkYaw ?? snapshot.forklift.yaw;
  const yawDelta=Math.atan2(Math.sin(snapshot.forklift.yaw-previousYaw),Math.cos(snapshot.forklift.yaw-previousYaw));
  if(snapshot.playing)runtime.forkSteer=THREE.MathUtils.clamp(yawDelta/Math.max(.02,delta)*.2,-.5,.5);
  runtime.lastForkYaw=snapshot.forklift.yaw;
  for(const name of ['wheel_rl_steering','wheel_rr_steering']){const node=runtime.forklift.group.getObjectByName(name);if(node)node.rotation.y=runtime.forkSteer || 0;}
  const actorActive = !unloadActive && runtime.mode === 'operation' && snapshot.phase !== 'COMPLETED';
  const parked = !actorActive && !unloadActive && runtime.sceneProfile === 'workspace' && ['overview', 'hero-door'].includes(viewRefSafe(runtime)) && ['normal', 'port'].includes(runtime.visualizationMode);
  runtime.forklift.group.visible = parked || (actorActive && snapshot.actorType !== 'manual');
  if (parked) {
    runtime.forklift.group.position.set(runtime.dimensions.length / 2 + 1.9, -.22 + (runtime.forklift.soleOffset || 0), runtime.dimensions.width / 2 + 1.15);
    runtime.forklift.group.rotation.y = .08;
    runtime.forklift.carriage.position.y = runtime.forklift.carriageHome ?? .18;
  }
  if (runtime.parkedActorVisible !== parked) { runtime.parkedActorVisible = parked; invalidateShadows(runtime); }
  runtime.mount.dataset.actorDisplay = actorActive ? snapshot.actorType : parked ? 'parked-forklift' : 'none';
  if (!actorActive && runtime.currentObject) runtime.currentObject.visible = false;

  if (runtime.worker.pushAsset) runtime.worker.pushAsset.visible = false;
  if (snapshot.worker) {
    const workerWorld = toWorld(snapshot.worker.position);
    runtime.worker.group.position.copy(workerWorld);
    runtime.worker.group.position.y += runtime.worker.soleOffset || 0;
    runtime.worker.group.rotation.y = snapshot.worker.yaw;
    applyWorkerPose(runtime.worker, snapshot.worker);
    if (runtime.worker.standingAsset && runtime.worker.carryAsset) {
      runtime.worker.standingAsset.visible = !snapshot.worker.carryPose;
      runtime.worker.carryAsset.visible = Boolean(snapshot.worker.carryPose);
    }
  }
  runtime.worker.group.visible = actorActive && snapshot.actorType === 'manual';
  runtime.palletJack.visible=Boolean(actorActive && snapshot.jack?.visible);
  if(runtime.palletJack.visible){
    runtime.palletJack.position.copy(toWorld(snapshot.jack.position));
    runtime.palletJack.rotation.y=snapshot.jack.yaw;
    const lift=runtime.jackAsset?.getObjectByName('jack_lift');
    if(lift){lift.userData.homeY ??= lift.position.y;lift.position.y=lift.userData.homeY+Number(snapshot.jack.lift||0)*MM;}
    const handle=runtime.jackAsset?.getObjectByName('jack_handle');
    if(handle){handle.userData.restRotation ??= handle.rotation.clone();const pumping=snapshot.phase==='JACK_LIFT'?Math.sin(snapshot.phaseProgress*Math.PI*4)*.08:0;handle.rotation.z=handle.userData.restRotation.z+pumping;}
    for(const wheel of runtime.jackWheels||[])wheel.rotation.z=-Number(snapshot.jack.distanceM||0)/.035;
    groundVehicle(runtime.palletJack,runtime.jackWheels,point=>groundAtXZ((point.x+length/2)/MM,(point.z+width/2)/MM,runtime.machine.container)*MM);
  }
  runtime.worker.group.visible=actorActive && (snapshot.actorType==='manual'||Boolean(snapshot.worker?.visible));
  runtime.mount.dataset.internalHandling=snapshot.jack?.visible?'floor-pallet-jack-demonstration':'';
  if(runtime.worker.rig && runtime.worker.group.visible){
    const hands=runtime.palletJack.visible && runtime.jackAsset
      ? ['jack_grip_left','jack_grip_right'].map(name=>runtime.jackAsset.getObjectByName(name)?.getWorldPosition(new THREE.Vector3())).filter(Boolean)
      : snapshot.currentCargo && snapshot.cargoPose && (snapshot.attached || ['pickup','place','release'].includes(snapshot.actorStage))
        ? cargoHandTargets(snapshot.currentCargo,toWorld(snapshot.cargoPose.position),runtime.worker.group.rotation.y) : null;
    poseArticulatedWorker(runtime.worker.rig,{pose:snapshot.worker,handTargets:hands?.length===2?hands:null,
      moving:['move','carry','enter','exit','return'].includes(snapshot.actorStage),
      distanceM:snapshot.worker?.distanceM ?? Number(snapshot.worker?.gait || 0)*.25,
      groundAt:point=>groundAtXZ((point.x+length/2)/MM,(point.z+width/2)/MM,runtime.machine.container)*MM});
  }
  if (actorActive || runtime.spawnAnims.length > 0) invalidateShadows(runtime);
  runtime.groups.actors.visible = actorActive || parked;
  runtime.groups.path.visible = unloadActive || actorActive;
  runtime.groups.target.visible = actorActive;
  runtime.groups.riskObjects.visible = runtime.visualizationMode === 'risk' && !runtime.selectedItem && !unloadActive;
  if (runtime.actorCameraActive !== actorActive) {
    runtime.actorCameraActive = actorActive;
    if (!['follow', 'presentation'].includes(viewRefSafe(runtime))) applyCameraView(runtime, viewRefSafe(runtime));
  }

  if (viewRefSafe(runtime) === 'follow' && !runtime.followSuspended && snapshot.currentCargo) {
    const manual=snapshot.actorType==='manual',jack=snapshot.activeEquipment==='pallet-jack';
    const actorPosition=manual?snapshot.worker.position:jack?snapshot.jack.position:snapshot.forklift.position;
    const centre=toWorld(actorPosition);
    const size=manual?new THREE.Vector3(1.1,1.9,1.1):jack?new THREE.Vector3(3.4,1.9,1.6):new THREE.Vector3(3.6,2.7,1.8);
    const bounds=new THREE.Box3(centre.clone().add(new THREE.Vector3(-size.x/2,0,-size.z/2)),centre.clone().add(new THREE.Vector3(size.x/2,size.y,size.z/2)));
    if(snapshot.cargoPose && (snapshot.attached || ['pickup','place','release'].includes(snapshot.actorStage))){
      const min=toWorld(snapshot.cargoPose.position),c=snapshot.currentCargo;
      bounds.union(new THREE.Box3(min,min.clone().add(new THREE.Vector3(c.l,c.h,c.w).multiplyScalar(MM))));
    }
    bounds.expandByScalar(.35);
    const target=bounds.getCenter(new THREE.Vector3());
    runtime.camera.up.set(0,1,0);
    runtime.controls.target.lerp(target, Math.min(1, delta * 3));
    const reserved=runtime.panelOpen?screenLabelInsets(runtime).right:0;
    if(reserved>20)runtime.camera.setViewOffset(runtime.mount.clientWidth,runtime.mount.clientHeight,reserved/2,0,runtime.mount.clientWidth,runtime.mount.clientHeight);
    else runtime.camera.clearViewOffset();
    const frame=computeCameraFrame({bounds,target,direction:new THREE.Vector3(.75,.4,1),up:new THREE.Vector3(0,1,0),verticalFov:THREE.MathUtils.degToRad(38),aspect:Math.max(1,runtime.mount.clientWidth-reserved)/runtime.mount.clientHeight,margin:.76});
    runtime.camera.fov=38;runtime.camera.updateProjectionMatrix();
    runtime.camera.position.lerp(frame.position, Math.min(1, delta * 2.2));
  }
}

// 待装池：真实剩余货物的确定性排队（队列顺序 → 槽位），实例化渲染全部剩余件，
// 真实 l/w/h、贴地、按 handlingClass 分区。回放推进时池面随之消耗。
function initializeWaitingBatches(runtime) {
  runtime.waitingBatches = new Map();
  const capacities = new Map();
  for (const item of runtime.machine.queue) {
    const appearance = classifyCargoAppearance(item);
    const key = precisionBatchKey(item);
    if (!capacities.has(key)) capacities.set(key, { appearance, count: 0 });
    capacities.get(key).count += 1;
  }
  for (const [key, { appearance, count }] of capacities) {
    const typeProps = getMaterialProps(appearance.key);
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: cargoPatternTexture(appearance.pattern),
      roughness: typeProps.roughness,
      metalness: typeProps.metalness
    });
    material.name = `PORTCUBE waiting ${appearance.key}`;
    const mesh = new THREE.InstancedMesh(createTypedCargoGeometry(appearance.key), material, count);
    mesh.name = `waiting-${key}`;
    mesh.visible = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    runtime.groups.waiting.add(mesh);
    runtime.waitingBatches.set(key, { mesh, appearance, capacity: count, next: 0 });
  }
}

function rebuildWaiting(runtime) {
  if (!runtime.waitingBatches) return;
  if(runtime.machine.direction==='unload'){
    for(const batch of runtime.waitingBatches.values())batch.mesh.count=0;
    if(runtime.stagingLabels)runtime.stagingLabels.visible=false;
    return;
  }
  const { length, width } = runtime.dimensions;
  const machine = runtime.machine;
  const current = Number(machine.currentIndex || 0);
  const state=stagingPresentation(machine.queue,machine.getSnapshot(),machine.container);
  const entries=[...state.representatives];
  if(state.next!==null)entries.push({index:state.next,slot:machine.stagingSlots.get(state.next)});
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const color = new THREE.Color();
  const highlight = new THREE.Color();
  for (const batch of runtime.waitingBatches.values()) batch.next = 0;
  for (const {index,slot} of entries) {
    const cargo = machine.queue[index];
    if (!slot || !cargo) continue;
    const appearance = classifyCargoAppearance(cargo);
    const batch = runtime.waitingBatches.get(precisionBatchKey(cargo));
    if (!batch || batch.next >= batch.capacity) continue;
    const l = Math.max(0.001, Number(cargo.l || 0) * MM);
    const h = Math.max(0.001, Number(cargo.h || 0) * MM);
    const w = Math.max(0.001, Number(cargo.w || 0) * MM);
    const visible = !runtime.activeFilterCount || runtime.visibleQueueIndices.has(index);
    position.set(Number(slot.x) * MM - length / 2 + l / 2, Number(slot.y) * MM + h / 2, Number(slot.z) * MM - width / 2 + w / 2);
    scale.set(visible ? l : 0.0001, visible ? h : 0.0001, visible ? w : 0.0001);
    quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),cargo.handlingMethod==='manual'?0:Math.PI/2);
    if (batch.precision) { scale.setScalar(visible ? 1 : 0); precisionOrientation(cargo, quaternion); }
    matrix.compose(position, quaternion, scale);
    batch.mesh.setMatrixAt(batch.next, matrix);
    color.set(batch.physical ? '#ffffff' : appearance.color);
    if (!batch.physical && index === current + 1) {
      highlight.set('#ffffff');
      color.lerp(highlight, 0.32);
    }
    batch.mesh.setColorAt(batch.next, color);
    batch.next += 1;
  }
  for (const batch of runtime.waitingBatches.values()) {
    batch.mesh.count = batch.next;
    batch.mesh.instanceMatrix.needsUpdate = true;
    if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
    if (batch.next > 0) {
      batch.mesh.computeBoundingSphere();
      batch.mesh.computeBoundingBox();
    } else {
      batch.mesh.boundingSphere = null;
      batch.mesh.boundingBox = null;
    }
  }
  runtime.mount.dataset.waitingSceneCount = String([...runtime.waitingBatches.values()].reduce((sum, b) => sum + b.next, 0));
  runtime.mount.dataset.waitingActualCount = String(state.waiting);
  if (runtime.stagingLabels) { runtime.groups.waiting.remove(runtime.stagingLabels); disposeObject(runtime.stagingLabels); }
  runtime.stagingLabels = new THREE.Group();
  for (const group of state.groups) {
    const first=state.representatives.find(entry=>group.indices.includes(entry.index));
    if(!first)continue;
    const slot=first.slot;
    const appearance = classifyCargoAppearance(machine.queue[first.index]);
    const label=makeLabelSprite(appearance.label+' · 余 '+group.indices.length+' 件（代表）',{x:slot.x*MM-length/2+.6,y:-.15,z:slot.z*MM-width/2-.45},'#344c58',{scale:[2.5,.42,1]});
    runtime.stagingLabels.add(label);
  }
  runtime.stagingLabels.visible = runtime.mode === 'operation' && machine.phase !== 'COMPLETED';
  runtime.groups.waiting.add(runtime.stagingLabels);
  const next = machine.queue[state.next];
  if(next && machine.phase !== 'COMPLETED') {
    const slot = machine.stagingSlots.get(state.next);
    const marker = makeBoxOutline(Number(next.l)*MM,Number(next.h)*MM,Number(next.w)*MM,'#a8c4d3',1.5);
    marker.material.resolution.set(runtime.mount.clientWidth, runtime.mount.clientHeight);
    marker.position.set((slot.x+Number(next.l)/2)*MM-length/2,(slot.y+Number(next.h)/2)*MM,(slot.z+Number(next.w)/2)*MM-width/2);
    runtime.stagingLabels.add(marker);
  }
}

// 演员 group 可见网格的最低点相对原点的偏移（使脚底/轮底贴到 y=0 支撑面）。
function computeSoleOffset(group) {
  group.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  let found = false;
  group.traverse((node) => {
    if (!node.isMesh || node.visible === false) return;
    if (!node.geometry) return;
    node.geometry.computeBoundingBox();
    part.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);
    box.union(part);
    found = true;
  });
  if (!found || box.isEmpty()) return 0;
  return -(box.min.y - group.position.y);
}

function applyQueueFilter(runtime, visibleQueueIndices, activeFilterCount) {
  runtime.visibleQueueIndices = new Set(visibleQueueIndices || []);
  runtime.activeFilterCount = Number(activeFilterCount || 0);
  const currentIndex = Number(runtime.lastSnapshot?.currentIndex || 0);
  const currentMatches = !runtime.activeFilterCount || runtime.visibleQueueIndices.has(currentIndex);
  rebuildWaiting(runtime);
  setObjectOpacity(runtime.currentObject, currentMatches ? 1 : 0.18);
  setObjectOpacity(runtime.groups.target, currentMatches ? 1 : 0.22);
  setObjectOpacity(runtime.forklift.group, currentMatches ? 1 : 0.2);
  setObjectOpacity(runtime.worker.group, currentMatches ? 1 : 0.2);
  runtime.mount.dataset.filterActiveCount = String(runtime.activeFilterCount);
  runtime.mount.dataset.filterVisibleQueueCount = String(runtime.visibleQueueIndices.size);
  runtime.mount.dataset.filterSceneMode = runtime.activeFilterCount ? (currentMatches ? 'highlight-matches' : 'dim-current') : 'all';
}

function setObjectOpacity(object, opacity) {
  object?.traverse?.((child) => {
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    materials.forEach((material) => {
      if (material.userData.stage3BaseOpacity == null) material.userData.stage3BaseOpacity = material.opacity;
      const baseOpacity = Number(material.userData.stage3BaseOpacity);
      material.transparent = baseOpacity < 1 || opacity < 1;
      material.opacity = baseOpacity * opacity;
      material.needsUpdate = true;
    });
  });
}

function rebuildPath(runtime, snapshot) {
  clearGroup(runtime.groups.path);
  const path = snapshot.path;
  if (!path) return;
  const points = [path.home, path.waiting, path.waitingLifted, path.staging, path.doorApproach, path.doorInside, path.insideAligned, path.targetHover, path.target]
    .map((position) => domainVector(position, runtime.dimensions).add(new THREE.Vector3(0, 0.035, 0)));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineDashedMaterial({ color: '#178da3', dashSize: 0.23, gapSize: 0.12, linewidth: 2 });
  const line = new THREE.Line(geometry, material); line.computeLineDistances(); runtime.groups.path.add(line);
  const entryGeometry = new THREE.BufferGeometry().setFromPoints(path.entry.map((position) => domainVector(position, runtime.dimensions).add(new THREE.Vector3(0, 0.055, 0))));
  const entryLine = new THREE.Line(entryGeometry, new THREE.LineBasicMaterial({ color: '#35b7bf', linewidth: 2 })); runtime.groups.path.add(entryLine);
}

function createTypedCargoGeometry(appearanceKey) {
  // 圆角箱体（真实纸箱/木箱边缘非锋利直角）；非索引化以便与细节件合并。
  const base = appearanceKey === 'drum'
    ? new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, false)
    : new RoundedBoxGeometry(1, 1, 1, 2, appearanceKey === 'fibc' ? 0.12 : 0.045);
  const parts = [base];

  switch (appearanceKey) {
    case 'crate':
    case 'wooden':
      for (let i = 0; i < 3; i++) {
        const plank = new THREE.BoxGeometry(0.03, 0.15, 0.92);
        plank.translate(0.52, -0.3 + i * 0.3, 0);
        parts.push(plank);
      }
      for (const [px, pz] of [[-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5]]) {
        const cap = new THREE.BoxGeometry(0.06, 0.06, 0.06);
        cap.translate(px, 0, pz);
        parts.push(cap);
      }
      break;

    case 'equipment_case':
    case 'equipment': {
      const ring = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8);
      ring.rotateX(Math.PI / 2);
      ring.translate(0, 0.53, 0);
      parts.push(ring);
      const panel = new THREE.BoxGeometry(0.02, 0.25, 0.4);
      panel.translate(0.52, -0.1, 0);
      parts.push(panel);
      for (let i = 0; i < 3; i++) {
        const vent = new THREE.BoxGeometry(0.5, 0.02, 0.014);
        vent.translate(0, -0.2 + i * 0.18, 0.52);
        parts.push(vent);
      }
      break;
    }

    case 'wrapped':
    case 'fragile': {
      const bar1 = new THREE.BoxGeometry(0.016, 0.5, 0.1);
      bar1.translate(0.52, 0, 0);
      parts.push(bar1);
      const bar2 = new THREE.BoxGeometry(0.016, 0.1, 0.5);
      bar2.translate(0.52, 0, 0);
      parts.push(bar2);
      const band = new THREE.BoxGeometry(0.82, 0.04, 0.82);
      band.translate(0, 0.52, 0);
      parts.push(band);
      break;
    }

    case 'heavy':
      for (let i = 0; i < 2; i++) {
        const strap = new THREE.BoxGeometry(1.02, 0.035, 1.02);
        strap.translate(0, -0.15 + i * 0.3, 0);
        parts.push(strap);
      }
      for (let i = 0; i < 2; i++) {
        const b = new THREE.BoxGeometry(0.035, 1.02, 1.02);
        b.translate(-0.15 + i * 0.3, 0, 0);
        parts.push(b);
      }
      break;

    case 'accessory':
      for (let i = 1; i < 4; i++) {
        const line = new THREE.BoxGeometry(0.02, 0.8, 0.02);
        line.translate(0.52, 0, -0.5 + i * 0.25);
        parts.push(line);
      }
      for (let i = 1; i < 3; i++) {
        const line = new THREE.BoxGeometry(0.02, 0.02, 0.8);
        line.translate(0.52, -0.5 + i * 0.33, 0);
        parts.push(line);
      }
      break;

    case 'palletized':
    case 'nonstackable': {
      const cone = new THREE.ConeGeometry(0.22, 0.15, 6);
      cone.translate(0, 0.58, 0);
      parts.push(cone);
      const pallet = new THREE.BoxGeometry(1.05, 0.04, 1.05);
      pallet.translate(0, -0.52, 0);
      parts.push(pallet);
      break;
    }

    case 'drum': {
      for (const y of [-0.34, 0, 0.34]) {
        const ring = new THREE.TorusGeometry(0.49, 0.035, 6, 20);
        ring.rotateX(Math.PI / 2);
        ring.translate(0, y, 0);
        parts.push(ring);
      }
      break;
    }

    case 'fibc': {
      for (const x of [-0.32, 0.32]) for (const z of [-0.32, 0.32]) {
        const loop = new THREE.TorusGeometry(0.12, 0.025, 5, 12, Math.PI);
        loop.rotateX(Math.PI / 2);
        loop.translate(x, 0.54, z);
        parts.push(loop);
      }
      break;
    }

    default: {
      const tape = new THREE.BoxGeometry(0.72, 0.018, 0.1);
      tape.translate(0, 0.51, 0);
      parts.push(tape);
      const bottomTape = new THREE.BoxGeometry(0.72, 0.018, 0.1);
      bottomTape.translate(0, -0.51, 0);
      parts.push(bottomTape);
      const seam = new THREE.BoxGeometry(0.01, 0.9, 0.02);
      seam.translate(0, 0, 0.52);
      parts.push(seam);
      break;
    }
  }

  // RoundedBoxGeometry 为非索引几何；统一非索引化后再合并。
  const normalized = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const merged = mergeGeometries(normalized, false);
  if (!merged) return base;
  parts.forEach((p) => p.dispose());
  normalized.forEach((p) => p.dispose());
  return merged;
}

function initializePlacedBatches(runtime) {
  const capacities = new Map();
  for (const item of runtime.machine.queue) {
    const appearance = classifyCargoAppearance(item);
    const colorKey = appearance.color;
    const batchKey = precisionBatchKey(item);
    if (!capacities.has(batchKey)) {
      capacities.set(batchKey, { appearance, variant: precisionVariant(item), originalDimensions: originalDimensionsM(item), color: colorKey, count: 0 });
    }
    capacities.get(batchKey).count += 1;
  }
  for (const [batchKey, { appearance, variant, originalDimensions, color, count }] of capacities) {
    const typeProps = getMaterialProps(appearance.key);
    const surface = cargoSurfaceTextures(appearance.pattern);
    // PBR maps remain active in every mode. Per-instance colour is only a
    // category colour or an analysis tint, never a replacement flat material.
    const material = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: surface.map,
      roughnessMap: surface.roughnessMap,
      bumpMap: surface.bumpMap,
      bumpScale: typeProps.bumpScale,
      emissive: '#000000',
      emissiveIntensity: 0,
      roughness: typeProps.roughness,
      metalness: typeProps.metalness,
      clearcoat: typeProps.clearcoat || 0,
      clearcoatRoughness: typeProps.clearcoat ? 0.24 : 0
    });
    material.name = `PORTCUBE cargo ${appearance.key}`;
    const geometry = createTypedCargoGeometry(appearance.key);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = `placed-${batchKey}`;
    mesh.visible = false;
    mesh.userData.batchKey = batchKey;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    runtime.groups.placed.add(mesh);
    runtime.placedBatches.set(batchKey, { mesh, appearance, variant, originalDimensions, color, capacity: count, next: 0, items: [] });
  }
}

function updatePlacedBatches(runtime, placedCargo) {
  for (const batch of runtime.placedBatches.values()) { batch.next = 0; batch.items = []; batch.desiredColors = []; }
  runtime.unloadCurrentPlacement = null;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const { length, width } = runtime.dimensions;
  const placements = new Map();
  const unload = runtime.unloadState?.active ? runtime.unloadState : null;
  const removedOrder = unload?.removedIds || [];
  const removedIds = new Set(removedOrder);
  const stagedIds = removedOrder.slice(-6);
  for (const item of placedCargo) {
    const batchKey = precisionBatchKey(item);
    const batch = runtime.placedBatches.get(batchKey);
    if (!batch || batch.next >= batch.capacity) continue;
    const l = Math.max(0.001, Number(item.l || 0) * MM);
    const h = Math.max(0.001, Number(item.h || 0) * MM);
    const w = Math.max(0.001, Number(item.w || 0) * MM);
    position.set(Number(item.x || 0) * MM - length / 2 + l / 2, Number(item.y || 0) * MM + h / 2, Number(item.z || 0) * MM - width / 2 + w / 2);
    let visible = itemMatchesIsolate(item, runtime.isolate);
    if(runtime.machine.plan.presentationOnly?.wallIds)visible=visible&&runtime.machine.plan.presentationOnly.wallIds.includes(item.cargoId);
    if (unload && removedIds.has(item.cargoId)) {
      const stagedIndex = stagedIds.indexOf(item.cargoId);
      visible = visible && stagedIndex >= 0;
      if (stagedIndex >= 0) position.set(length / 2 + 1.8 + (stagedIndex % 3) * 0.72, h * 0.34, -width * 0.78 + Math.floor(stagedIndex / 3) * 0.78);
      scale.set(visible ? l * 0.58 : 0, visible ? h * 0.58 : 0, visible ? w * 0.58 : 0);
    } else if (unload && item.cargoId === unload.currentId) {
      scale.set(visible ? l : 0, visible ? h : 0, visible ? w : 0);
    } else {
      scale.set(visible ? l : 0, visible ? h : 0, visible ? w : 0);
    }
    rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),Number(item.displayYaw || 0));
    if (batch.precision) {
      scale.setScalar(visible ? (unload && removedIds.has(item.cargoId) ? .58 : 1) : 0);
      precisionOrientation(item, rotation);
    }
    matrix.compose(position, rotation, scale);
    batch.mesh.setMatrixAt(batch.next, matrix);
    placements.set(item, { batch, index: batch.next, position: position.clone(), scale: scale.clone() });
    if (unload && item.cargoId === unload.currentId) {
      runtime.unloadCurrentPlacement = { batch, index: batch.next, position: position.clone(), scale: scale.clone(), item };
    }
    const visualColor = unload
      ? removedIds.has(item.cargoId) ? '#536574'
        : item.cargoId === unload.currentId ? '#f0a33a'
          : item.cargoId === unload.nextId ? '#4db5b8'
            : '#263947'
      : visualizationColor(item, runtime.visualizationMode, runtime.analyticsContext, batch.color);
    const surfaceColor=tintedCargoColor(batch.physical ? '#ffffff' : batch.color, visualColor, runtime.visualizationMode, Boolean(unload));
    if(exactAssetMode() && runtime.visualizationMode==='normal' && !unload){
      // Small stable presentation variation makes adjacent real pieces readable.
      // This never changes packaging facts, dimensions, or placements.
      const hash=[...String(item.cargoId)].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
      surfaceColor.multiplyScalar([.76,.88,1,1.07][hash%4]);
    }
    batch.desiredColors.push(surfaceColor);
    batch.items[batch.next] = item;
    batch.next += 1;
  }
  runtime.lastPlacements = placements;
  for (const batch of runtime.placedBatches.values()) {
    if (!batch.physical) batch.mesh.material.color.set('#ffffff');
    const spaceMode = runtime.visualizationMode === 'space';
    const targetOpacity = spaceMode ? 0.86 : 1;
    const transition = runtime.visualizationTransition;
    if (transition) {
      const fromColors = [];
      for (let index = 0; index < batch.next; index += 1) {
        const color = new THREE.Color(batch.color);
        if (batch.mesh.instanceColor && index < batch.mesh.count) batch.mesh.getColorAt(index, color);
        fromColors.push(color);
      }
      transition.records.set(batch.mesh.uuid, {
        batch,
        fromColors,
        targetColors: batch.desiredColors.map((color) => color.clone()),
        fromOpacity: batch.visualOpacity ?? 1,
        targetOpacity
      });
    } else {
      for (let index = 0; index < batch.next; index += 1) batch.mesh.setColorAt(index, batch.desiredColors[index]);
      batch.visualOpacity = targetOpacity;
      batchMaterials(batch).forEach((material) => applyCargoOpacity(material, targetOpacity));
    }
    batchMaterials(batch).forEach((material) => { material.needsUpdate = true; });
    batch.mesh.count = batch.next;
    batch.mesh.instanceMatrix.needsUpdate = true;
    if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
    // InstancedMesh caches its raycast bounds. Timeline reconstruction can grow
    // a mesh from count=0, so refresh bounds after matrices/count change.
    if (batch.next > 0) {
      batch.mesh.computeBoundingSphere();
      batch.mesh.computeBoundingBox();
    } else {
      batch.mesh.boundingSphere = null;
      batch.mesh.boundingBox = null;
    }
  }
  runtime.placedCount = placedCargo.length;
  runtime.mount.dataset.visualizationMode = runtime.visualizationMode;
  runtime.mount.dataset.isolateMode = runtime.isolate?.type || 'none';
  runtime.mount.dataset.unloadCurrentCargo = unload?.currentId || '';
  runtime.mount.dataset.unloadRemovedCount = String(removedOrder.length);
  runtime.mount.dataset.unloadRemainingCount = String(unload?.remaining ?? placedCargo.length);
  invalidateShadows(runtime);
  if (unload) rebuildUnloadPath(runtime, placedCargo.find((item) => item.cargoId === unload.currentId));
}

function tintedCargoColor(baseValue, overlayValue, mode, unload) {
  const base = new THREE.Color(baseValue);
  if (mode === 'normal' && !unload) return base;
  const overlay = new THREE.Color(overlayValue);
  const blend = unload ? 0.40 : ({ weight: 0.48, port: 0.48, space: 0.12, balance: 0.24, risk: 0.52 })[mode] ?? 0.42;
  return base.lerp(overlay, blend);
}

function startVisualizationTransition(runtime, nextMode) {
  if (runtime.visualizationMode === nextMode) return;
  runtime.visualizationMode = nextMode;
  runtime.visualizationTransition = {
    startedAt: performance.now(),
    durationMs: nextMode === 'normal' ? 360 : 420,
    records: new Map()
  };
  startAnalysisTransition(runtime);
}

function updateVisualizationTransition(runtime) {
  const transition = runtime.visualizationTransition;
  if (!transition || !transition.records.size) return;
  const raw = THREE.MathUtils.clamp((performance.now() - transition.startedAt) / transition.durationMs, 0, 1);
  const t = raw * raw * (3 - 2 * raw);
  const mixed = new THREE.Color();
  for (const record of transition.records.values()) {
    const { batch, fromColors, targetColors, fromOpacity, targetOpacity } = record;
    for (let index = 0; index < batch.next; index += 1) {
      mixed.copy(fromColors[index] || targetColors[index]).lerp(targetColors[index], t);
      batch.mesh.setColorAt(index, mixed);
    }
    batch.visualOpacity = THREE.MathUtils.lerp(fromOpacity, targetOpacity, t);
    batchMaterials(batch).forEach((material) => applyCargoOpacity(material, batch.visualOpacity));
    batchMaterials(batch).forEach((material) => { material.needsUpdate = true; });
    if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
  }
  runtime.mount.dataset.visualizationTransitionProgress = t.toFixed(3);
  if (raw < 1) return;
  for (const record of transition.records.values()) {
    record.batch.visualOpacity = record.targetOpacity;
    batchMaterials(record.batch).forEach((material) => applyCargoOpacity(material, record.targetOpacity));
  }
  runtime.visualizationTransition = null;
}

function rebuildUnloadPath(runtime, currentCargo) {
  clearGroup(runtime.groups.path);
  runtime.pathOutlineMaterials = [];
  runtime.unloadCurrentOutline = null;
  runtime.unloadPathPoints = null;
  runtime.stagingLabelAnchor = null;
  if (!currentCargo) return;
  const { length, width } = runtime.dimensions;
  const l = Number(currentCargo.l || 0) * MM;
  const h = Number(currentCargo.h || 0) * MM;
  const w = Number(currentCargo.w || 0) * MM;
  const cargoY = Math.max(h / 2, 0.14);
  const start = new THREE.Vector3(Number(currentCargo.x || 0) * MM - length / 2 + l / 2, cargoY, Number(currentCargo.z || 0) * MM - width / 2 + w / 2);
  const points = [
    start,
    new THREE.Vector3(length / 2 - 0.55, cargoY, start.z * 0.35),
    new THREE.Vector3(length / 2 + 0.75, cargoY, 0),
    new THREE.Vector3(length / 2 + 1.75, cargoY, -width * 0.62)
  ];
  runtime.unloadPathPoints = points;
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const path = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 44, 0.012, 7, false),
    new THREE.MeshBasicMaterial({ color: '#c4b38a', transparent: true, opacity: 0.68, depthWrite: false, toneMapped: false })
  );
  path.renderOrder = 14;
  runtime.groups.path.add(path);

  const arrowGeometry = new THREE.ConeGeometry(0.06, 0.18, 4);
  const arrowMaterial = new THREE.MeshBasicMaterial({ color: '#e1d1aa', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
  for (const t of [0.4, 0.7, 0.9]) {
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.copy(curve.getPointAt(t));
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(t).normalize());
    arrow.renderOrder = 15;
    runtime.groups.path.add(arrow);
  }

  const stagingCenter = points.at(-1).clone();
  stagingCenter.x = length / 2 + 2.55;
  stagingCenter.y = 0.012;
  const stagingPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.65, Math.max(1.45, width * 0.82)),
    new THREE.MeshBasicMaterial({ color: '#a6956e', transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
  );
  stagingPlane.position.copy(stagingCenter);
  stagingPlane.rotation.x = -Math.PI / 2;
  runtime.groups.path.add(stagingPlane);
  const stagingOutline = makeBoxOutline(2.65, 0.025, Math.max(1.45, width * 0.82), '#b6a47a', 1);
  stagingOutline.position.copy(stagingCenter);
  runtime.pathOutlineMaterials.push(stagingOutline.material);
  runtime.groups.path.add(stagingOutline);
  runtime.stagingLabelAnchor = new THREE.Vector3(stagingCenter.x - 0.45, 0.16, stagingCenter.z);
  for (const [item, color, current] of [[currentCargo, '#e8b35c', true], [runtime.machine.queue.find((cargo) => cargo.cargoId === runtime.unloadState?.nextId), '#65aeb1', false]]) {
    if (!item) continue;
    const outline = makeBoxOutline(Number(item.l) * MM * 1.014, Number(item.h) * MM * 1.014, Number(item.w) * MM * 1.014, color, 2);
    outline.position.copy(domainVector({ x: Number(item.x) + Number(item.l) / 2, y: Number(item.y) + Number(item.h) / 2, z: Number(item.z) + Number(item.w) / 2 }, runtime.dimensions));
    runtime.groups.path.add(outline);
    runtime.pathOutlineMaterials.push(outline.material);
    if (current) runtime.unloadCurrentOutline = outline;
  }
  updateOutlineResolution(runtime);
}

function unloadMotionDuration(speed) {
  const value = Math.max(0.5, Number(speed || 1));
  if (value >= 8) return 180;
  if (value >= 4) return 230;
  if (value >= 2) return 380;
  if (value >= 1) return 680;
  return 960;
}

function updateUnloadMotion(runtime, delta) {
  if(runtime.unloadState?.sequenceOnly){runtime.mount.dataset.unloadTweenProgress='not-animated';return;}
  const placement = runtime.unloadCurrentPlacement;
  const points = runtime.unloadPathPoints;
  if (!runtime.unloadState?.active || !placement || !points?.length) return;
  if (runtime.unloadState.playing) runtime.unloadMotionElapsedMs = Number(runtime.unloadMotionElapsedMs || 0) + delta * 1000;
  const elapsed = Number(runtime.unloadMotionElapsedMs || 0);
  const raw = Math.min(1, Math.max(0, elapsed / Math.max(1, runtime.unloadMotionDurationMs || 850)));
  const t = raw * raw * (3 - 2 * raw);
  const position = pointAlongPath(points, t);
  runtime.unloadCurrentOutline?.position.copy(position);
  const matrix = new THREE.Matrix4();
  matrix.compose(position, IDENTITY_QUATERNION, placement.scale);
  placement.batch.mesh.setMatrixAt(placement.index, matrix);
  placement.batch.mesh.instanceMatrix.needsUpdate = true;
  if (runtime.unloadState.playing && raw < 1) invalidateShadows(runtime);
  runtime.mount.dataset.unloadTweenProgress = t.toFixed(3);
}

function pointAlongPath(points, progress) {
  const distances = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const distance = points[index - 1].distanceTo(points[index]);
    distances.push(distance);
    total += distance;
  }
  let remaining = progress * total;
  for (let index = 0; index < distances.length; index += 1) {
    if (remaining <= distances[index] || index === distances.length - 1) {
      return points[index].clone().lerp(points[index + 1], Math.min(1, remaining / Math.max(0.001, distances[index])));
    }
    remaining -= distances[index];
  }
  return points.at(-1).clone();
}

// Natural placement settles through a short clearance descent. Dimensions never
// scale or overshoot, so cargo continues to read as rigid industrial mass.
export function queueSpawnAnimations(runtime, placedCargo, previousPlaced) {
  runtime.spawnAnims = [];
  if (previousPlaced < 0) return;
  const added = placedCargo.length - previousPlaced;
  if (added <= 0 || added > 3) return;
  const now = performance.now();
  for (const item of placedCargo.slice(previousPlaced)) {
    const record = runtime.lastPlacements?.get(item);
    if (record) runtime.spawnAnims.push({ ...record, quaternion: IDENTITY_QUATERNION, startedAt: now });
  }
}

const IDENTITY_QUATERNION = new THREE.Quaternion();

function updateSpawnAnimations(runtime) {
  if (!runtime.spawnAnims.length) return;
  const now = performance.now();
  const matrix = new THREE.Matrix4();
  const touched = new Set();
  runtime.spawnAnims = runtime.spawnAnims.filter((anim) => {
    const t = Math.min(1, (now - anim.startedAt) / 360);
    const eased = 1 - Math.pow(1 - t, 3);
    const settledPosition = anim.position.clone();
    settledPosition.y += (1 - eased) * 0.1;
    matrix.compose(settledPosition, anim.quaternion, anim.scale);
    anim.batch.mesh.setMatrixAt(anim.index, matrix);
    touched.add(anim.batch);
    return t < 1;
  });
  touched.forEach((batch) => { batch.mesh.instanceMatrix.needsUpdate = true; });
}

// 入场运镜：从高远机位推近到预设取景，给演示一个"镜头落下"的开场。
function startEntranceTween(runtime) {
  const endPosition = runtime.camera.position.clone();
  const endTarget = runtime.controls.target.clone();
  const direction = endPosition.clone().sub(endTarget).normalize();
  const startPosition = endPosition.clone().add(direction.multiplyScalar(1.4)).add(new THREE.Vector3(0, .35, 0));
  runtime.camera.position.copy(startPosition);
  runtime.cameraTween = { elapsed: 0, duration: .42, startPosition, startTarget: endTarget.clone(), endPosition, endTarget };
}

function itemMatchesIsolate(item, isolate) {
  if (!isolate?.type) return true;
  if (isolate.type === 'cargo') return item.cargoId === isolate.value;
  if (isolate.type === 'sku') return item.sku === isolate.value;
  if (isolate.type === 'batch') return (item.batchId || item.batchKey) === isolate.value;
  if (isolate.type === 'port') return item.destinationPort === isolate.value;
  if (isolate.type === 'cargo-set') return Array.isArray(isolate.value) && isolate.value.includes(item.cargoId);
  return true;
}

function installPicking(runtime) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let press = null;
  let dragged = false;
  const onPointerDown = (event) => { press = { x: event.clientX, y: event.clientY }; dragged = false; };
  const onPointerUp = () => { press = null; };
  const onOrbitStart = () => { runtime.cameraTween = null; runtime.followSuspended=true; runtime.mount.dataset.followSuspended='true'; };

  const pick = (event) => {
    const rect = runtime.renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    raycaster.setFromCamera(pointer, runtime.camera);
    if (runtime.groups.voidZones.visible) {
      const voidHit = raycaster.intersectObjects(runtime.groups.voidZones.children, false)[0];
      if (voidHit?.object?.userData?.voidZone) return { kind: 'void', zone: voidHit.object.userData.voidZone };
    }
    const intersections = raycaster.intersectObjects([...runtime.placedBatches.values()].map((batch) => batch.mesh), false);
    for (const hit of intersections) {
      const batch = runtime.placedBatches.get(hit.object.userData.batchKey);
      const item = batch?.items?.[hit.instanceId];
      if (item && itemMatchesIsolate(item, runtime.isolate)) return { kind: 'cargo', item };
    }
    return null;
  };

  const onPointerMove = (event) => {
    if (press) {
      dragged ||= Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5;
      if (dragged) { runtime.renderer.domElement.style.cursor = 'grabbing'; return; }
    }
    const target = pick(event);
    const item = target?.kind === 'cargo' ? target.item : null;
    runtime.renderer.domElement.style.cursor = target ? 'pointer' : 'grab';
    if ((item?.cargoId || '') !== (runtime.hoveredItem?.cargoId || '')) {
      runtime.hoveredItem = item;
      updateSelectionMarker(runtime);
      runtime.callbackRef.current.onHover?.(item);
    }
  };
  const onPointerLeave = () => {
    runtime.hoveredItem = null;
    runtime.renderer.domElement.style.cursor = 'grab';
    updateSelectionMarker(runtime);
    runtime.callbackRef.current.onHover?.(null);
  };
  const onClick = (event) => {
    if (dragged) return;
    const target = pick(event);
    runtime.selectedItem = target?.kind === 'cargo' ? target.item : null;
    runtime.selectedVoidZone = target?.kind === 'void' ? target.zone : null;
    updateSelectionMarker(runtime);
    runtime.callbackRef.current.onSelect?.(runtime.selectedItem);
    runtime.callbackRef.current.onVoidSelect?.(runtime.selectedVoidZone);
  };
  const onDoubleClick = (event) => {
    if (dragged) return;
    const target = pick(event);
    if (!target) return;
    if (target.kind === 'void') {
      runtime.selectedVoidZone = target.zone;
      runtime.selectedItem = null;
      updateSelectionMarker(runtime);
      focusVoidZone(runtime, target.zone);
      runtime.callbackRef.current.onVoidSelect?.(target.zone);
      runtime.callbackRef.current.onSelect?.(null);
      return;
    }
    const item = target.item;
    runtime.selectedItem = item;
    runtime.selectedVoidZone = null;
    updateSelectionMarker(runtime);
    focusCargo(runtime, item);
    runtime.callbackRef.current.onFocus?.(item);
  };
  const canvas = runtime.renderer.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  runtime.controls.addEventListener('start', onOrbitStart);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('dblclick', onDoubleClick);
  runtime.removeInteractions = () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    runtime.controls.removeEventListener('start', onOrbitStart);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('dblclick', onDoubleClick);
  };
}

// 选中 / 悬停轮廓：用 LineSegments2 + LineMaterial（屏幕空间等宽，永不为 1px 隐形）。
// 三态可区分：hover 用青色细线、select 用琥珀色粗线。
function updateSelectionMarker(runtime) {
  clearGroup(runtime.groups.selection);
  runtime.outlineMaterials = [];
  for (const mesh of runtime.groups.voidZones.children) {
    const selected = mesh.userData?.voidZone?.id === runtime.selectedVoidZone?.id;
    if (mesh.material) mesh.material.opacity = selected ? 0.27 : Number(mesh.userData.baseOpacity || 0.09);
    const edge = mesh.children.find((child) => child.isLineSegments);
    if (edge?.material) edge.material.opacity = selected ? 0.98 : Math.min(0.72, Number(mesh.userData.baseOpacity || 0.09) * 5.8);
  }
  const draw = (item, color, linewidth) => {
    if (!item) return;
    const l = Math.max(0.001, Number(item.l || item.length || 0) * MM);
    const h = Math.max(0.001, Number(item.h || item.height || 0) * MM);
    const w = Math.max(0.001, Number(item.w || item.width || 0) * MM);
    const outline = makeBoxOutline(l * 1.03, h * 1.03, w * 1.03, color, linewidth);
    outline.position.copy(domainVector({ x: Number(item.x) + Number(item.l) / 2, y: Number(item.y) + Number(item.h) / 2, z: Number(item.z) + Number(item.w) / 2 }, runtime.dimensions));
    runtime.outlineMaterials.push(outline.material);
    runtime.groups.selection.add(outline);
  };
  const selected = runtime.selectedItem;
  const hovered = runtime.hoveredItem;
  if (hovered && hovered.cargoId !== selected?.cargoId) draw(hovered, '#1f8a80', 2);
  if (selected) draw(selected, '#f2a347', 3);
  if (selected && runtime.visualizationMode === 'risk') {
    const patches = supportContactPatches(selected,runtime.machine.plan?.loadedCargo || runtime.machine.queue);
    const footprint = [{...selected,source:'FOOTPRINT'},...patches];
    for(const patch of footprint){
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(Number(patch.l)*MM,Number(patch.w)*MM),new THREE.MeshBasicMaterial({color:patch.source==='FOOTPRINT'?'#bd613f':'#36a77d',transparent:true,opacity:patch.source==='FOOTPRINT'?.20:.62,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
      mesh.rotation.x=-Math.PI/2;
      mesh.position.copy(domainVector({x:Number(patch.x)+Number(patch.l)/2,y:Number(patch.y)+3,z:Number(patch.z)+Number(patch.w)/2},runtime.dimensions));
      mesh.renderOrder=16;runtime.groups.selection.add(mesh);
    }
    runtime.mount.dataset.supportContactCount=String(patches.length);
  }
  const voidZone = runtime.selectedVoidZone;
  if (voidZone?.boundsMm) {
    const bounds = voidZone.boundsMm;
    const l = Math.max(0.001, (Number(bounds.maxX) - Number(bounds.minX)) * MM);
    const h = Math.max(0.001, (Number(bounds.maxY) - Number(bounds.minY)) * MM);
    const w = Math.max(0.001, (Number(bounds.maxZ) - Number(bounds.minZ)) * MM);
    const outline = makeBoxOutline(l * 1.015, h * 1.015, w * 1.015, voidClassColor(voidZone.classification), 3);
    outline.material.depthTest = false;
    outline.position.copy(domainVector({ x: (Number(bounds.minX) + Number(bounds.maxX)) / 2, y: (Number(bounds.minY) + Number(bounds.maxY)) / 2, z: (Number(bounds.minZ) + Number(bounds.maxZ)) / 2 }, runtime.dimensions));
    runtime.outlineMaterials.push(outline.material);
    runtime.groups.selection.add(outline);
  }
  updateOutlineResolution(runtime);
}

function makeBoxOutline(l, h, w, color, linewidth) {
  const x = l / 2; const y = h / 2; const z = w / 2;
  const c = [
    [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z],
    [-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z]
  ];
  const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const positions = [];
  for (const [a, b] of edges) positions.push(c[a][0], c[a][1], c[a][2], c[b][0], c[b][1], c[b][2]);
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  const material = new LineMaterial({ color, linewidth, transparent: true, opacity: 0.96, depthTest: true, dashed: false });
  material.resolution.set(1, 1);
  const line = new LineSegments2(geometry, material);
  line.computeLineDistances();
  line.renderOrder = 15;
  return line;
}

function focusCargo(runtime, item) {
  const center = domainVector({ x: Number(item.x) + Number(item.l) / 2, y: Number(item.y) + Number(item.h) / 2, z: Number(item.z) + Number(item.w) / 2 }, runtime.dimensions);
  const radius = Math.max(Number(item.l), Number(item.w), Number(item.h)) * MM;
  const direction = runtime.camera.position.clone().sub(runtime.controls.target).normalize();
  const reservedRight = screenLabelInsets(runtime).right;
  runtime.camera.setViewOffset(runtime.mount.clientWidth, runtime.mount.clientHeight, reservedRight / 2, 0, runtime.mount.clientWidth, runtime.mount.clientHeight);
  runtime.camera.updateProjectionMatrix();
  runtime.cameraTween = {
    elapsed: 0,
    duration: 0.4,
    startPosition: runtime.camera.position.clone(),
    startTarget: runtime.controls.target.clone(),
    endPosition: center.clone().add(direction.multiplyScalar(Math.max(4.6, radius * 5.4))),
    endTarget: center
  };
}

function focusVoidZone(runtime, zone) {
  const bounds = zone?.boundsMm;
  if (!bounds) return;
  runtime.selectedVoidZone = zone;
  runtime.selectedItem = null;
  updateSelectionMarker(runtime);
  const center = domainVector({ x: (Number(bounds.minX) + Number(bounds.maxX)) / 2, y: (Number(bounds.minY) + Number(bounds.maxY)) / 2, z: (Number(bounds.minZ) + Number(bounds.maxZ)) / 2 }, runtime.dimensions);
  const direction = runtime.camera.position.clone().sub(runtime.controls.target).normalize();
  const halfSize = new THREE.Vector3(Number(bounds.maxX) - Number(bounds.minX), Number(bounds.maxY) - Number(bounds.minY), Number(bounds.maxZ) - Number(bounds.minZ)).multiplyScalar(MM * .5);
  const reservedRight = screenLabelInsets(runtime).right;
  runtime.camera.setViewOffset(runtime.mount.clientWidth, runtime.mount.clientHeight, reservedRight / 2, 0, runtime.mount.clientWidth, runtime.mount.clientHeight);
  runtime.camera.updateProjectionMatrix();
  const frame = computeCameraFrame({ bounds: new THREE.Box3(center.clone().sub(halfSize), center.clone().add(halfSize)), direction, up: runtime.camera.up, target: center, verticalFov: THREE.MathUtils.degToRad(runtime.camera.fov), aspect: Math.max(1, runtime.mount.clientWidth - reservedRight) / Math.max(1, runtime.mount.clientHeight), margin: .8 });
  runtime.cameraTween = {
    elapsed: 0,
    duration: 0.4,
    startPosition: runtime.camera.position.clone(),
    startTarget: runtime.controls.target.clone(),
    endPosition: center.clone().add(direction.multiplyScalar(Math.max(8, frame.position.distanceTo(center) * 1.2))),
    endTarget: center
  };
}

function updateCameraTween(runtime) {
  const tween = runtime.cameraTween;
  if (!tween) return;
  // Camera presentation timing is wall-clock based so the promised duration stays
  // truthful even when a heavy GLB frame is dropped. Starting a new tween still
  // samples the camera's current transform, preserving interruption continuity.
  tween.startedAt ??= performance.now();
  tween.elapsed = Math.min(tween.duration, Math.max(0, (performance.now() - tween.startedAt) / 1000));
  const raw = tween.duration ? tween.elapsed / tween.duration : 1;
  const eased = cubicBezierEase(raw, 0.4, 0, 0.2, 1);
  runtime.camera.position.lerpVectors(tween.startPosition, tween.endPosition, eased);
  runtime.controls.target.lerpVectors(tween.startTarget, tween.endTarget, eased);
  if (Number.isFinite(tween.startFov) && Number.isFinite(tween.endFov)) {
    runtime.camera.fov = THREE.MathUtils.lerp(tween.startFov, tween.endFov, eased);
    runtime.camera.updateProjectionMatrix();
  }
  if (tween.startUp && tween.endUp) runtime.camera.up.lerpVectors(tween.startUp, tween.endUp, eased).normalize();
  runtime.mount.dataset.cameraTweenProgress = raw.toFixed(3);
  runtime.mount.dataset.cameraPosition = runtime.camera.position.toArray().map((value) => value.toFixed(3)).join(',');
  if (raw >= 1) {
    const onComplete = tween.onComplete;
    runtime.cameraTween = null;
    onComplete?.();
  }
}

function cubicBezierEase(progress, x1, y1, x2, y2) {
  const sample = (t, a, b) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  const derivative = (t, a, b) => 3 * a * (1 - t) * (1 - 3 * t) + 3 * b * t * (2 - 3 * t) + 3 * t * t;
  let t = progress;
  for (let index = 0; index < 5; index += 1) {
    const slope = derivative(t, x1, x2);
    if (Math.abs(slope) < 0.0001) break;
    t = THREE.MathUtils.clamp(t - (sample(t, x1, x2) - progress) / slope, 0, 1);
  }
  return sample(t, y1, y2);
}

function createAnalysisOverlays(runtime) {
  const { balance } = runtime.analyticsContext;
  const center = domainVector(balance.geometricCenter, runtime.dimensions);
  const cargo = domainVector(balance.cargoCenter, runtime.dimensions);
  const { length, width } = runtime.dimensions;
  const neutral = new THREE.MeshBasicMaterial({ color: '#87a5b8', transparent: true, opacity: 0.88, depthTest: false, depthWrite: false, toneMapped: false });
  const accent = new THREE.MeshBasicMaterial({ color: '#efaa3b', transparent: true, opacity: 0.96, depthTest: false, depthWrite: false, toneMapped: false });

  const centerline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-length / 2, runtime.dimensions.height + 0.08, 0), new THREE.Vector3(length / 2, runtime.dimensions.height + 0.08, 0)]),
    new THREE.LineDashedMaterial({ color: '#a7bdca', dashSize: 0.24, gapSize: 0.13, transparent: true, opacity: 0.84, depthTest: false, toneMapped: false })
  );
  centerline.computeLineDistances();
  runtime.groups.analysis.add(centerline);

  const distribution = runtime.machine.plan?.loadDistribution || runtime.machine.plan?.ext_loadDistribution || runtime.machine.plan?.metrics?.loadDistribution;
  const segments = distribution?.segments?.longitudinal || [];
  const maxMass = Math.max(1, ...segments.map((segment) => Number(segment.massKg || 0)));
  for (let index = 0; index < 6; index += 1) {
    const mass = Number(segments[index]?.massKg || 0);
    const intensity = mass / maxMass;
    const segment = new THREE.Mesh(
      new THREE.PlaneGeometry(length / 6 - 0.06, width * 0.92),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#276f87').lerp(new THREE.Color('#df9b36'), intensity * 0.72),
        transparent: true,
        opacity: 0.08 + intensity * 0.16,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
      })
    );
    segment.rotation.x = -Math.PI / 2;
    segment.position.set(-length / 2 + (index + 0.5) * length / 6, runtime.dimensions.height + 0.045, 0);
    segment.renderOrder = 16;
    runtime.groups.analysis.add(segment);
  }
  for (let index = 0; index <= 6; index += 1) {
    const x = -length / 2 + index * length / 6;
    const boundary = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, runtime.dimensions.height + 0.085, -width / 2),
        new THREE.Vector3(x, runtime.dimensions.height + 0.085, width / 2)
      ]),
      new THREE.LineBasicMaterial({ color: index === 0 || index === 6 ? '#9eb4c1' : '#6da9b6', transparent: true, opacity: 0.72, depthTest: false, toneMapped: false })
    );
    boundary.renderOrder = 17;
    runtime.groups.analysis.add(boundary);
  }

  const centerRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 8, 32), neutral);
  centerRing.rotation.x = Math.PI / 2;
  centerRing.position.set(center.x, 0.06, center.z);
  runtime.groups.analysis.add(centerRing);
  const centerCross = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(center.x - 0.23, 0.065, center.z), new THREE.Vector3(center.x + 0.23, 0.065, center.z),
      new THREE.Vector3(center.x, 0.065, center.z - 0.23), new THREE.Vector3(center.x, 0.065, center.z + 0.23)
    ]),
    new THREE.LineBasicMaterial({ color: '#87a5b8', transparent: true, opacity: 0.92, depthTest: false, toneMapped: false })
  );
  runtime.groups.analysis.add(centerCross);
  const cargoRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 36), accent);
  cargoRing.rotation.x = Math.PI / 2;
  cargoRing.position.set(cargo.x, 0.072, cargo.z);
  runtime.groups.analysis.add(cargoRing);
  const cargoPin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.48, 12), accent);
  cargoPin.position.set(cargo.x, 0.27, cargo.z);
  runtime.groups.analysis.add(cargoPin);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(center.x, 0.08, center.z),
    new THREE.Vector3(cargo.x, 0.08, cargo.z)
  ]), new THREE.LineBasicMaterial({ color: '#efaa3b', transparent: true, opacity: 0.96, depthTest: false, toneMapped: false }));
  runtime.groups.analysis.add(line);
  const floorLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(center.x, 0.018, center.z),
    new THREE.Vector3(cargo.x, 0.018, cargo.z)
  ]), new THREE.LineDashedMaterial({ color: '#c98524', dashSize: 0.12, gapSize: 0.07, depthTest: false }));
  floorLine.computeLineDistances(); runtime.groups.analysis.add(floorLine);
  runtime.groups.analysis.add(makeLabelSprite('GEOMETRIC CENTER', new THREE.Vector3(center.x, 0.34, center.z), '#547286', { scale: [1.72, 0.38, 1] }));
  runtime.groups.analysis.add(makeLabelSprite(
    `CoG · LAT ${Math.abs(balance.offset.lateralPercent).toFixed(3)}% · LONG ${Math.abs(balance.offset.longitudinalPercent).toFixed(3)}%`,
    new THREE.Vector3(cargo.x, 0.68, cargo.z),
    '#9d641b',
    { scale: [3.4, 0.48, 1] }
  ));

  const cells = buildDeterministicSpaceCells(runtime.machine.queue, runtime.machine.container);
  if (cells.length) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: '#4b9bd6', transparent: true, opacity: 0.055, depthWrite: false, roughness: 0.65 });
    const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    cells.forEach((cell, index) => {
      const position = domainVector({ x: cell.x + cell.l / 2, y: cell.y + cell.h / 2, z: cell.z + cell.w / 2 }, runtime.dimensions);
      matrix.compose(position, quaternion, new THREE.Vector3(cell.l * MM * 0.92, cell.h * MM * 0.92, cell.w * MM * 0.92));
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    runtime.groups.space.add(mesh);
  }
  updateAnalysisVisibility(runtime);
}

function createLayoutDebugOverlays(runtime) {
  const plan = runtime.machine.plan || {};
  const spaceLabels = new Set();
  for (const zone of placementSpaceEvidence(plan).zones) {
    runtime.voidZonesById.set(zone.id, zone);
    const b = zone.boundsMm;
    addLayoutDebugBox(runtime.groups.explainedSpace, b, runtime.dimensions, '#5c9d94', .055);
    const point = domainVector({x:(b.minX+b.maxX)/2,y:b.maxY+130,z:(b.minZ+b.maxZ)/2},runtime.dimensions);
    if (!spaceLabels.has(zone.classification)) runtime.groups.explainedSpace.add(makeLabelSprite(zone.classification === 'BALANCE_TRANSLATION' ? `平衡调整 ${zone.gapMm} mm` : zone.label,point,'#326c64',{scale:[1.7,.37,1]}));
    spaceLabels.add(zone.classification);
  }
  const layout = plan.layoutQuality || plan.ext_layoutQuality || plan.metrics?.layoutQuality || {};
  const voidJustification = plan.voidJustification || plan.ext_voidJustification || plan.metrics?.voidJustification || {};
  const securing = plan.securing || plan.ext_securing || plan.metrics?.securing || {};
  const container = runtime.machine.container || {};
  const byId = new Map(runtime.machine.queue.map((item) => [item.cargoId, item]));
  const seenGaps = new Set();

  const authoritativeZones = (voidJustification.zones || []).filter((zone) => zone?.boundsMm);
  // One combined outline draw links the exact formal securing set to the cargo.
  const positions = [];
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(unitBox);
  const points = edges.attributes.position;
  for (const id of securing.requiredCargoIds || []) {
    const item = byId.get(id);
    if (!item) continue;
    const center = domainVector({ x: Number(item.x) + Number(item.l) / 2, y: Number(item.y) + Number(item.h) / 2, z: Number(item.z) + Number(item.w) / 2 }, runtime.dimensions);
    for (let i = 0; i < points.count; i += 1) positions.push(center.x + points.getX(i) * Number(item.l) * MM * 1.006, center.y + points.getY(i) * Number(item.h) * MM * 1.006, center.z + points.getZ(i) * Number(item.w) * MM * 1.006);
  }
  edges.dispose(); unitBox.dispose();
  if (positions.length) {
    const geometry = new LineSegmentsGeometry(); geometry.setPositions(positions);
    runtime.riskOutlineMaterial = new LineMaterial({ color: '#d8aa57', linewidth: 1.6, transparent: true, opacity: .88, depthTest: true });
    const line = new LineSegments2(geometry, runtime.riskOutlineMaterial);
    line.renderOrder = 14;
    runtime.groups.riskObjects.add(line);
    runtime.groups.riskObjects.visible = false;
    updateOutlineResolution(runtime);
  }
  for (const zone of authoritativeZones) {
    // Connected free cells can have an AABB enclosing cargo. Such an envelope
    // must remain a list entry, never a translucent solid advertised as a void.
    const b = zone.boundsMm;
    runtime.voidZonesById.set(zone.id, zone);
    if (runtime.machine.queue.some(c => Number(c.x)<b.maxX && Number(c.x)+Number(c.l)>b.minX && Number(c.y)<b.maxY && Number(c.y)+Number(c.h)>b.minY && Number(c.z)<b.maxZ && Number(c.z)+Number(c.w)>b.minZ)) continue;
    const mesh = addLayoutDebugBox(
      runtime.groups.voidZones,
      zone.boundsMm,
      runtime.dimensions,
      voidClassColor(zone.classification),
      zone.classification === 'UNEXPLAINED_VOID' ? 0.14 : 0.06
    );
    if (!mesh) continue;
    mesh.name = `void-zone-${zone.id}`;
    mesh.userData.voidZone = zone;
    runtime.voidZonesById.set(zone.id, zone);
  }
  runtime.mount.dataset.voidZoneCount = String(runtime.voidZonesById.size);

  for (const gap of authoritativeZones.length ? [] : layout.gapClassifications || []) {
    const key = `${gap.axis}:${[...(gap.cargoIds || [])].sort().join(':')}`;
    if (seenGaps.has(key)) continue;
    seenGaps.add(key);
    const [left, right] = (gap.cargoIds || []).map((cargoId) => byId.get(cargoId));
    const bounds = gapBounds(left, right, gap.axis);
    if (bounds) addLayoutDebugBox(runtime.groups.layoutVoid, bounds, runtime.dimensions, '#d69b35', 0.08);
  }

  const bounds = layout.bounds;
  if (bounds) {
    const reserveBands = [
      { minX: 0, maxX: Number(bounds.minX), minY: 0, maxY: Number(container.innerHeight), minZ: 0, maxZ: Number(container.innerWidth) },
      { minX: Number(bounds.maxX), maxX: Number(container.innerLength), minY: 0, maxY: Number(container.innerHeight), minZ: 0, maxZ: Number(container.innerWidth) },
      { minX: Number(bounds.minX), maxX: Number(bounds.maxX), minY: 0, maxY: Number(container.innerHeight), minZ: 0, maxZ: Number(bounds.minZ) },
      { minX: Number(bounds.minX), maxX: Number(bounds.maxX), minY: 0, maxY: Number(container.innerHeight), minZ: Number(bounds.maxZ), maxZ: Number(container.innerWidth) },
      { minX: Number(bounds.minX), maxX: Number(bounds.maxX), minY: Number(bounds.maxY), maxY: Number(container.innerHeight), minZ: Number(bounds.minZ), maxZ: Number(bounds.maxZ) }
    ];
    for (const band of reserveBands) if (debugBoundsVolume(band) > 1) addLayoutDebugBox(runtime.groups.layoutReserve, band, runtime.dimensions, '#2c86c5', 0.055);
  }

  const lowFillThreshold = Number(layout.policy?.lowFillThreshold ?? 0.65);
  for (const slice of layout.crossSectionReport || []) {
    if (!(Number(slice.occupiedArea) > 0) || Number(slice.fillRatio) >= lowFillThreshold) continue;
    const thickness = Math.max(12, Number(slice.sliceEnd) - Number(slice.sliceStart));
    addLayoutDebugBox(runtime.groups.layoutLowFill, {
      minX: Number(slice.slicePosition) - thickness / 2,
      maxX: Number(slice.slicePosition) + thickness / 2,
      minY: 0,
      maxY: Number(container.innerHeight),
      minZ: 0,
      maxZ: Number(container.innerWidth)
    }, runtime.dimensions, '#ed8b32', 0.08);
  }

  for (const zone of securing.zones || []) {
    const thickness = 24;
    const zoneBounds = zone.axis === 'x'
      ? { minX: Number(zone.position) - thickness / 2, maxX: Number(zone.position) + thickness / 2, minY: 0, maxY: Number(container.innerHeight), minZ: 0, maxZ: Number(container.innerWidth) }
      : { minX: 0, maxX: Number(container.innerLength), minY: 0, maxY: Number(container.innerHeight), minZ: Number(zone.position) - thickness / 2, maxZ: Number(zone.position) + thickness / 2 };
    addLayoutDebugBox(runtime.groups.layoutSecuring, zoneBounds, runtime.dimensions, '#e5bf3b', 0.16);
  }
  updateAnalysisVisibility(runtime);
}

function gapBounds(left, right, axis) {
  if (!left || !right) return null;
  const y0 = Math.max(Number(left.y), Number(right.y));
  const y1 = Math.min(Number(left.y) + Number(left.h), Number(right.y) + Number(right.h));
  if (axis === 'x') {
    const rear = Number(left.x) <= Number(right.x) ? left : right;
    const front = rear === left ? right : left;
    const z0 = Math.max(Number(left.z), Number(right.z));
    const z1 = Math.min(Number(left.z) + Number(left.w), Number(right.z) + Number(right.w));
    const x0 = Number(rear.x) + Number(rear.l); const x1 = Number(front.x);
    return x1 > x0 && y1 > y0 && z1 > z0 ? { minX: x0, maxX: x1, minY: y0, maxY: y1, minZ: z0, maxZ: z1 } : null;
  }
  const leftSide = Number(left.z) <= Number(right.z) ? left : right;
  const rightSide = leftSide === left ? right : left;
  const x0 = Math.max(Number(left.x), Number(right.x));
  const x1 = Math.min(Number(left.x) + Number(left.l), Number(right.x) + Number(right.l));
  const z0 = Number(leftSide.z) + Number(leftSide.w); const z1 = Number(rightSide.z);
  return x1 > x0 && y1 > y0 && z1 > z0 ? { minX: x0, maxX: x1, minY: y0, maxY: y1, minZ: z0, maxZ: z1 } : null;
}

function addLayoutDebugBox(group, bounds, dimensions, color, opacity) {
  const size = {
    x: Math.max(0, Number(bounds.maxX) - Number(bounds.minX)),
    y: Math.max(0, Number(bounds.maxY) - Number(bounds.minY)),
    z: Math.max(0, Number(bounds.maxZ) - Number(bounds.minZ))
  };
  if (!(size.x > 0 && size.y > 0 && size.z > 0)) return null;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * MM, size.y * MM, size.z * MM),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  );
  mesh.userData.baseOpacity = opacity;
  mesh.position.copy(domainVector({ x: Number(bounds.minX) + size.x / 2, y: Number(bounds.minY) + size.y / 2, z: Number(bounds.minZ) + size.z / 2 }, dimensions));
  mesh.renderOrder = 8;
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(0.72, opacity * 5.8), depthTest: true, toneMapped: false })
  );
  outline.renderOrder = 9;
  mesh.add(outline);
  group.add(mesh);
  return mesh;
}

function voidClassColor(classification) {
  return ({
    USABLE_RESERVE: '#2d91c8',
    RESERVE_SPACE: '#2d91c8',
    PORT_ACCESS: '#4d88cf',
    PORT_ACCESS_CORRIDOR: '#4d88cf',
    SECURING_SPACE: '#d0a343',
    SECURING_ZONE: '#d0a343',
    DOOR_CLEARANCE: '#7895aa',
    STRUCTURAL_CLEARANCE: '#748795',
    GEOMETRIC_RESIDUAL: '#7f89a7',
    UNEXPLAINED_VOID: '#d69b35'
  })[classification] || '#718899';
}

function debugBoundsVolume(bounds) {
  return Math.max(0, Number(bounds.maxX) - Number(bounds.minX))
    * Math.max(0, Number(bounds.maxY) - Number(bounds.minY))
    * Math.max(0, Number(bounds.maxZ) - Number(bounds.minZ));
}

function updateAnalysisVisibility(runtime) {
  const desired = desiredAnalysisFactors(runtime);
  for (const [key, factor] of Object.entries(desired)) {
    runtime.analysisFactors[key] = factor;
    runtime.groups[key].visible = factor > 0;
    setGroupVisualFactor(runtime.groups[key], factor);
  }
  updateLayoutDebugVisibility(runtime);
}

function desiredAnalysisFactors(runtime) {
  return {
    analysis: runtime.visualizationMode === 'balance' ? 1 : 0,
    space: runtime.visualizationMode === 'space' && runtime.voidZonesById.size === 0 ? 1 : 0,
    voidZones: runtime.visualizationMode === 'space' || Boolean(runtime.debugLayers?.void) ? 1 : 0
  };
}

function startAnalysisTransition(runtime) {
  const target = desiredAnalysisFactors(runtime);
  const from = { ...runtime.analysisFactors };
  runtime.analysisTransition = { startedAt: performance.now(), durationMs: 400, from, target };
  for (const key of Object.keys(target)) runtime.groups[key].visible = from[key] > 0 || target[key] > 0;
}

function updateAnalysisTransition(runtime) {
  const transition = runtime.analysisTransition;
  if (!transition) return;
  const raw = THREE.MathUtils.clamp((performance.now() - transition.startedAt) / transition.durationMs, 0, 1);
  const t = raw * raw * (3 - 2 * raw);
  for (const key of Object.keys(transition.target)) {
    const factor = THREE.MathUtils.lerp(transition.from[key] || 0, transition.target[key] || 0, t);
    runtime.analysisFactors[key] = factor;
    setGroupVisualFactor(runtime.groups[key], factor);
  }
  if (raw < 1) return;
  for (const [key, factor] of Object.entries(transition.target)) {
    runtime.analysisFactors[key] = factor;
    runtime.groups[key].visible = factor > 0;
  }
  runtime.analysisTransition = null;
}

function setGroupVisualFactor(group, factor) {
  group.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      if (material.userData.portcubeVisualBaseOpacity == null) material.userData.portcubeVisualBaseOpacity = Number(material.opacity ?? 1);
      material.transparent = true;
      material.opacity = Number(material.userData.portcubeVisualBaseOpacity) * factor;
      material.needsUpdate = true;
    }
  });
}

function updateLayoutDebugVisibility(runtime) {
  const debug = runtime.debugLayers || {};
  runtime.groups.layoutVoid.visible = Boolean(debug.void);
  runtime.groups.layoutReserve.visible = Boolean(debug.reserve);
  runtime.groups.layoutLowFill.visible = Boolean(debug.lowFill);
  runtime.groups.layoutSecuring.visible = Boolean(debug.securing);
  if (!runtime.analysisTransition) {
    const voidFactor = runtime.visualizationMode === 'space' || Boolean(debug.void) ? 1 : 0;
    runtime.analysisFactors.voidZones = voidFactor;
    runtime.groups.voidZones.visible = voidFactor > 0;
    setGroupVisualFactor(runtime.groups.voidZones, voidFactor);
  }
}

function updatePerformance(runtime, time) {
  const stats = runtime.performance;
  stats.frames += 1;
  if (time - stats.lastReportAt < 500) return;
  const seconds = (time - stats.startedAt) / 1000;
  const info = runtime.renderer.info;
  const report = {
    fps: seconds > 0 ? stats.frames / seconds : 0,
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    textures: info.memory.textures,
    geometries: info.memory.geometries,
    gpuMemoryApproxMb: estimateGpuMemoryMb(runtime),
    quality: runtime.quality,
    cargoCount: runtime.machine.queue.length,
    assetWarning: runtime.mount.dataset.assetWarning || '',
    mode: runtime.visualizationMode,
    operationPhase: runtime.lastSnapshot?.phase,
    sampledAt: Date.now()
  };
  runtime.mount.dataset.fps = report.fps.toFixed(1);
  runtime.mount.dataset.drawCalls = String(report.drawCalls);
  runtime.mount.dataset.triangles = String(report.triangles);
  const summary = recordPerformanceSample(report);
  runtime.mount.dataset.sampleCount = String(summary.sampleCount);
  runtime.mount.dataset.medianFps = String(summary.medianFps);
  runtime.mount.dataset.lowPercentileFps = String(summary.lowPercentileFps);
  runtime.mount.dataset.maxDrawCalls = String(summary.maxDrawCalls);
  runtime.mount.dataset.maxTriangles = String(summary.maxTriangles);
  runtime.mount.dataset.performanceMode = String(report.mode || 'normal');
  runtime.callbackRef.current.onPerformance?.(report);
  stats.frames = 0;
  stats.startedAt = time;
  stats.lastReportAt = time;
}

function recordPerformanceSample(report) {
  const existing = window.__PORTCUBE_TWIN_PERF__ || { samples: [] };
  const samples = [...(existing.samples || []), report].slice(-240);
  const foreground = samples.filter((sample) => sample.fps > 0).map((sample) => sample.fps).sort((left, right) => left - right);
  const summary = {
    sampleCount: foreground.length,
    medianFps: percentile(foreground, 0.5),
    lowPercentileFps: percentile(foreground, 0.1),
    maxDrawCalls: Math.max(0, ...samples.map((sample) => Number(sample.drawCalls || 0))),
    maxTriangles: Math.max(0, ...samples.map((sample) => Number(sample.triangles || 0))),
    latest: report
  };
  window.__PORTCUBE_TWIN_PERF__ = { samples, summary };
  try { window.sessionStorage.setItem('portcube.twin-performance', JSON.stringify(summary)); } catch { /* QA telemetry remains optional. */ }
  return summary;
}

function percentile(sortedValues, fraction) {
  if (!sortedValues.length) return 0;
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * fraction)));
  return Number(sortedValues[index].toFixed(2));
}

function estimateGpuMemoryMb(runtime) {
  const geometries = new Set();
  const textures = new Set([runtime.environmentTexture].filter(Boolean));
  let bytes = 0;
  runtime.scene.traverse((object) => {
    if (object.geometry && !geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      for (const attribute of Object.values(object.geometry.attributes || {})) bytes += attribute?.array?.byteLength || 0;
      bytes += object.geometry.index?.array?.byteLength || 0;
    }
    bytes += object.instanceMatrix?.array?.byteLength || 0;
    bytes += object.instanceColor?.array?.byteLength || 0;
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const texture of textures) {
    const image = texture?.image;
    const width = Number(image?.width || image?.image?.width || 0);
    const height = Number(image?.height || image?.image?.height || 0);
    if (width > 0 && height > 0) bytes += width * height * 4 * 1.33;
  }
  if (runtime.postProcessingEnabled) {
    const width = runtime.renderer.domElement.width || 0;
    const height = runtime.renderer.domElement.height || 0;
    bytes += width * height * 4 * 5;
  }
  return bytes / (1024 * 1024);
}

function rebuildTarget(runtime, snapshot) {
  clearGroup(runtime.groups.target);
  if (!snapshot.currentCargo) return;
  const target = createCargoObject(snapshot.currentCargo, { ghost: true, opacity: 0.18, edgeColor: '#25b8b2', showMarker: false });
  setDomainPosition(target, snapshot.direction==='unload' && snapshot.deliveryTarget ? snapshot.deliveryTarget : snapshot.currentCargo, runtime.dimensions);
  runtime.groups.target.add(target);
}

function updateScreenLabels(runtime, snapshot) {
  if(runtime.mode==='operation' && viewRefSafe(runtime)==='follow'){
    if(runtime.labelSignature!=='__CONTACT_VIEW__'){runtime.setSceneLabels([]);runtime.labelSignature='__CONTACT_VIEW__';}
    return;
  }
  const { mount, camera, dimensions } = runtime;
  const width = Math.max(1, mount.clientWidth);
  const height = Math.max(1, mount.clientHeight);
  const item = snapshot.currentCargo;
  const labelMode = runtime.labelMode || 'simple';
  const candidates = [];
  const selectedVoid = runtime.selectedVoidZone;
  if (runtime.unloadState?.active && runtime.stagingLabelAnchor) {
    const stagedCount = Math.max(0, Number(runtime.unloadState.index || 0));
    candidates.push({
      id: 'staging-zone',
      kind: 'staging',
      text: 'STAGING ZONE',
      detail: stagedCount ? `已卸暂存 · 最近 ${Math.min(6, stagedCount)} 件缩略` : '暂存待命 · 0 件',
      width: 178,
      height: 44,
      priority: 8,
      world: runtime.stagingLabelAnchor.clone()
    });
  }
  if (runtime.visualizationMode === 'space' && selectedVoid?.boundsMm) {
    const bounds = selectedVoid.boundsMm;
    const volume = Number(selectedVoid.volumeM3 ?? Number(selectedVoid.volume || 0) / 1e9);
    candidates.push({
      id: `void-${selectedVoid.id}`,
      kind: 'void',
      text: `${selectedVoid.label || selectedVoid.id} · ${volume.toFixed(2)} m³`,
      detail: selectedVoid.classification === 'UNEXPLAINED_VOID' ? '未解释空间 · 点击证据定位' : selectedVoid.classification,
      width: 238,
      height: 52,
      priority: 7,
      world: domainVector({
        x: (Number(bounds.minX) + Number(bounds.maxX)) / 2,
        y: Number(bounds.maxY) + 180,
        z: (Number(bounds.minZ) + Number(bounds.maxZ)) / 2
      }, dimensions)
    });
  }
  if (item && !['IDLE', 'COMPLETED'].includes(snapshot.phase)) {
    const movingPosition = snapshot.cargoPose?.position || snapshot.path?.waiting || item;
    candidates.push({
      id: 'current-cargo',
      kind: 'cargo',
      text: item.sku || item.name || '当前货物',
      detail: labelMode === 'simple' ? (snapshot.actorType === 'manual' ? '人工搬运' : '叉车搬运') : `${item.name || '当前货物'} · ${item.batchId || '未分批'}`,
      width: 126,
      height: 40,
      priority: 3,
      world: domainVector({
        x: Number(movingPosition.x) + Number(item.l || 0) / 2,
        y: Number(movingPosition.y) + Number(item.h || 0) + 180,
        z: Number(movingPosition.z) + Number(item.w || 0) / 2
      }, dimensions)
    }, {
      id: 'target-position',
      kind: 'target',
      text: '目标位置',
      detail: `箱内深区 · 卸出顺序 ${item.portSequence || 1}`,
      width: 142,
      height: 40,
      priority: 2,
      world: domainVector({
        x: Number(item.x) + Number(item.l || 0) / 2,
        y: Number(item.y) + Number(item.h || 0) + 160,
        z: Number(item.z) + Number(item.w) / 2
      }, dimensions)
    });
    if (labelMode !== 'simple') candidates.push({
      id: 'queue-context',
      kind: 'queue',
      text: item.destinationPort || '未指定港口',
      detail: labelMode === 'debug'
        ? `#${snapshot.currentIndex + 1} · ${numberForLabel(item.x)}/${numberForLabel(item.y)}/${numberForLabel(item.z)} mm`
        : `${item.batchLabel || item.batchId || '未分批'} · 卸出顺序 ${item.portSequence || 1}`,
      width: 188,
      height: 42,
      priority: 1,
      world: domainVector({
        x: Number(item.x) + Number(item.l || 0) / 2,
        y: Number(item.y) + Number(item.h || 0) + 520,
        z: Number(item.z) + Number(item.w) / 2
      }, dimensions)
    });
  }
  const actorPosition = snapshot.actorType === 'manual' ? snapshot.worker?.position : snapshot.forklift.position;
  if (labelMode !== 'simple' || snapshot.phase === 'BLOCKED') candidates.push({
    id: 'operation-action',
    kind: 'action',
    text: snapshot.phase === 'BLOCKED' ? '阻断原因' : snapshot.phaseLabel,
    detail: snapshot.phase === 'BLOCKED'
      ? snapshot.blockedReasons.map((reason) => reason.message).join('；') || '路径或目标未通过校验'
      : labelMode === 'debug'
      ? `${snapshot.actorType} · ${snapshot.actorStage} · ${pointDataset(actorPosition)}`
      : snapshot.action,
    width: 184,
    height: 42,
    priority: 4,
    world: domainVector(actorPosition, dimensions).add(new THREE.Vector3(0, snapshot.actorType === 'manual' ? 2.05 : 1.72, 0))
  });

  const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
  const projected = candidates.flatMap((label) => {
    if (label.world.clone().sub(camera.position).dot(cameraDirection) <= 0) return [];
    const point = label.world.clone().project(camera);
    if (point.z < -1 || point.z > 1) return [];
    return [{
      ...label,
      x: (point.x * 0.5 + 0.5) * width,
      y: (-point.y * 0.5 + 0.5) * height
    }];
  });
  const safeInsets = screenLabelInsets(runtime);
  const labels = layoutProjectedLabels(projected, {
    width,
    height,
    gap: 8,
    edge: 14,
    insets: safeInsets
  }).filter((label) => !label.hidden).map((label) => {
    const previous = runtime.labelPositions.get(label.id);
    const next = previous
      ? { x: THREE.MathUtils.lerp(previous.x, label.x, 0.22), y: THREE.MathUtils.lerp(previous.y, label.y, 0.22) }
      : { x: label.x, y: label.y };
    next.x = THREE.MathUtils.clamp(next.x, safeInsets.left, width - safeInsets.right - label.width);
    next.y = THREE.MathUtils.clamp(next.y, safeInsets.top, height - safeInsets.bottom - label.height);
    runtime.labelPositions.set(label.id, next);
    return { ...label, ...next };
  });
  const visibleIds = new Set(labels.map((label) => label.id));
  for (const id of runtime.labelPositions.keys()) if (!visibleIds.has(id)) runtime.labelPositions.delete(id);
  const overlapCount = countLabelOverlaps(labels);
  mount.dataset.labelOverlapCount = String(overlapCount);
  mount.dataset.labelVisibleCount = String(labels.length);
  mount.dataset.labelMode = labelMode;
  const signature = labels.map((label) => `${label.id}:${Math.round(label.x)}:${Math.round(label.y)}:${label.text}:${label.detail}`).join('|');
  if (signature !== runtime.labelSignature) {
    runtime.labelSignature = signature;
    runtime.setSceneLabels(labels.map(({ world: _world, ...label }) => label));
  }
}

function screenLabelInsets(runtime) {
  const rect = runtime.mount.getBoundingClientRect();
  const scope = runtime.mount.closest('.twin-workspace') || runtime.mount.parentElement;
  const insets = { left: Math.max(16, 16 - rect.left), top: Math.max(74, 16 - rect.top), right: Math.max(16, rect.right - innerWidth + 16), bottom: Math.max(20, rect.bottom - innerHeight + 16) };
  if (!scope) return insets;
  for (const panel of scope.querySelectorAll('.operation-panel, .cargo-inspector, .void-inspector, .twin-analysis-overlay')) {
    const panelRect = panel.getBoundingClientRect();
    if (!panelRect.width || panelRect.bottom <= rect.top || panelRect.top >= rect.bottom) continue;
    if (panelRect.left > rect.left + rect.width * .5) insets.right = Math.max(insets.right, rect.right - panelRect.left + 14);
  }
  return insets;
}

function countLabelOverlaps(labels) {
  let count = 0;
  for (let left = 0; left < labels.length; left += 1) {
    for (let right = left + 1; right < labels.length; right += 1) {
      const a = labels[left]; const b = labels[right];
      if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) count += 1;
    }
  }
  return count;
}

function applyLayerVisibility(runtime, layers = {}) {
  runtime.currentLayers = layers;
  for (const key of Object.keys(runtime.groups)) {
    if (['actors', 'selection', 'analysis', 'space', 'layoutVoid', 'layoutReserve', 'layoutLowFill', 'layoutSecuring'].includes(key)) continue;
    runtime.groups[key].visible = layers[key] !== false;
  }
  updateAnalysisVisibility(runtime);
  runtime.worksite.zoneMeshes.forEach((mesh) => { mesh.visible = runtime.sceneProfile !== 'landing' && layers.zones !== false; });
}

function applySceneMode(runtime, mode, debugLayers = {}) {
  const review = mode === 'review';
  runtime.mode = review ? 'review' : 'operation';
  runtime.debugLayers = debugLayers;
  if (runtime.algorithmDiagnostics) runtime.algorithmDiagnostics.visible = Boolean(debugLayers.algorithm);
  runtime.containerModel.shellMaterials.panels.forEach((panel) => {
    panel.material = review ? runtime.containerModel.shellMaterials.review : panel.userData.operationMaterial;
  });
  runtime.containerModel.reviewCutaway.visible = review;
  runtime.groups.actors.visible = !review && !['IDLE', 'COMPLETED'].includes(runtime.lastSnapshot?.phase);
  applyHeroContainerMode(runtime, review);
  runtime.worksite.debugGrid.visible = Boolean(debugLayers.grid);
  updateLayoutDebugVisibility(runtime);
  runtime.mount.dataset.sceneMode = runtime.mode;
  runtime.mount.dataset.shellOpaque = 'false';
  runtime.mount.dataset.roofOpacity = String(review ? runtime.containerModel.shellMaterials.review.opacity : runtime.containerModel.shellMaterials.operation.roof.opacity);
  runtime.mount.dataset.nearWallOpacity = String(review ? runtime.containerModel.shellMaterials.review.opacity : runtime.containerModel.shellMaterials.operation.nearWall.opacity);
  runtime.mount.dataset.doorOpaque = 'true';
  runtime.mount.dataset.debugGridVisible = String(runtime.worksite.debugGrid.visible);
  runtime.mount.dataset.debugVoidVisible = String(Boolean(debugLayers.void));
  runtime.mount.dataset.debugReserveVisible = String(Boolean(debugLayers.reserve));
  runtime.mount.dataset.debugLowFillVisible = String(Boolean(debugLayers.lowFill));
  runtime.mount.dataset.debugSecuringVisible = String(Boolean(debugLayers.securing));
  runtime.mount.dataset.containerPartCount = String(runtime.containerModel.descriptor.partCount);
  runtime.mount.dataset.forkliftPartCount = String(runtime.forklift.descriptor.partCount);
  runtime.mount.dataset.workerPartCount = String(runtime.worker.descriptor.partCount);
}

function applyHeroContainerMode(runtime, review) {
  if (!runtime.heroContainer) return;
  const shellNames = new Set(['side_left', 'side_right', 'roof', 'front_wall']);
  runtime.heroContainer.traverse((object) => {
    if (!object.isMesh) return;
    const objectName = String(object.name).toLowerCase();
    const lineageName = [];
    for (let cursor = object; cursor; cursor = cursor.parent) lineageName.push(String(cursor.name || '').toLowerCase());
    const lineage = lineageName.join('/');
    // The near side, roof and legacy merged corrugation shell obscure the cargo
    // when alpha-blended against the bright inspection bay. A review cutaway is
    // therefore a real geometry cut, while operation mode restores the complete
    // maintained container silhouette.
    const cutawayPart = lineage.includes('side_left') || lineage.includes('near_top_rail')
      || (runtime.currentView==='follow' && (lineage.includes('side_right') || lineage.includes('upper_rail') || lineage.includes('top_rail')))
      || lineage.includes('roof')
      || (!lineage.includes('door_') && lineage.includes('container_static_assembly'))
      || objectName.includes('label_portcube')
      || objectName.includes('label_subtitle');
    if (object.userData.portcubeOriginalVisible == null) object.userData.portcubeOriginalVisible = object.visible;
    object.visible = review && (cutawayPart || runtime.currentView==='hero-rear' && lineage.includes('front_wall')) ? false : object.userData.portcubeOriginalVisible;
    if (!shellNames.has(objectName)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      if (material.userData.portcubeOriginalOpacity == null) {
        material.userData.portcubeOriginalOpacity = material.opacity;
        material.userData.portcubeOriginalTransparent = material.transparent;
        material.userData.portcubeOriginalDepthWrite = material.depthWrite;
      }
      material.opacity = 1;
      material.transparent = false;
      material.depthWrite = true;
      material.needsUpdate = true;
    }
  });
}

function countMeshes(object) {
  let count = 0;
  object.traverse((node) => { if (node.isMesh) count += 1; });
  return count;
}

function applyWorkerPose(worker, pose) {
  if(worker.rig)return;
  const gait = Number(pose.gait || 0);
  const armAngle = pose.carryPose ? -1.05 : pose.reachPose ? -0.62 : 0;
  worker.leftArmPivot.rotation.z = armAngle + (pose.carryPose || pose.reachPose ? 0 : gait * 0.48);
  worker.rightArmPivot.rotation.z = armAngle - (pose.carryPose || pose.reachPose ? 0 : gait * 0.48);
  worker.leftLegPivot.rotation.z = gait * 0.52;
  worker.rightLegPivot.rotation.z = -gait * 0.52;
}

function numberForLabel(value) {
  return Number(value || 0).toFixed(0);
}

function applyCameraView(runtime, view, { immediate = false } = {}) {
  runtime.currentView = view;
  if (runtime.heroContainer) applyHeroContainerMode(runtime, runtime.mode === 'review' || ['overview', 'section', 'top', 'follow'].includes(view));
  runtime.worksite.group.visible = true;
  runtime.worksite.backdrop.visible = false;
  runtime.worksite.zoneMeshes.forEach((mesh) => { mesh.visible = runtime.sceneProfile !== 'landing' && runtime.currentLayers?.zones !== false; });
  if (runtime.environmentScene) runtime.environmentScene.visible = !['door', 'unload'].includes(view);
  runtime.presentationSequence = null;
  if (view === 'follow') {runtime.cameraTween=null;runtime.camera.up.set(0,1,0);return;}
  if (view === 'presentation') {
    startPresentationCamera(runtime);
    return;
  }
  const { length, width, height } = runtime.dimensions;
  const presetName = resolveCameraPresetName(view, runtime.visualizationMode);
  const preset = view.startsWith('hero-') ? heroCameraPreset(view,{length,width,height}) : buildCameraPreset(presetName, { length, width, height, mode: runtime.actorCameraActive ? 'operation' : 'review', inspectionContext: runtime.sceneProfile !== 'landing', visualizationMode: runtime.visualizationMode });
  if(view.startsWith('hero-')&&runtime.machine.plan.presentationOnly?.wallIds){
    const ids=new Set(runtime.machine.plan.presentationOnly.wallIds),items=runtime.machine.queue.filter(i=>ids.has(i.cargoId));
    const x0=Math.min(...items.map(i=>i.x))*.001-length/2,x1=Math.max(...items.map(i=>i.x+i.l))*.001-length/2;
    const wallPreset=heroCameraPreset(view,{length:x1-x0,width,height});
    if(view!=='hero-door'){preset.bounds=wallPreset.bounds.translate(new THREE.Vector3((x0+x1)/2,0,0));preset.target=wallPreset.target.add(new THREE.Vector3((x0+x1)/2,0,0));}
  }
  const viewportWidth = runtime.mount.clientWidth;
  const viewportHeight = runtime.mount.clientHeight;
  const reservedRight = runtime.sceneProfile === 'workspace' && runtime.panelOpen ? screenLabelInsets(runtime).right : 0;
  if (reservedRight > 20) runtime.camera.setViewOffset(viewportWidth, viewportHeight, reservedRight / 2, 0, viewportWidth, viewportHeight);
  else runtime.camera.clearViewOffset();
  const frame = computeCameraFrame({
    ...preset,
    verticalFov: THREE.MathUtils.degToRad(preset.fov),
    aspect: Math.max(1, viewportWidth - reservedRight) / Math.max(1, viewportHeight)
  });
  if (runtime.sceneProfile === 'landing') {
    const landingOffset = length * (preset.name === 'UNLOAD_REVIEW' ? -0.035 : 0.1);
    frame.position.x -= landingOffset;
    frame.target.x -= landingOffset;
  }
  const landingScale = runtime.sceneProfile === 'landing'
    ? ({
      SPACE_REVIEW: 1.08,
      BALANCE_REVIEW: 1.12,
      UNLOAD_REVIEW: 0.95
    }[preset.name] ?? 1.12)
    : 1;
  const responsiveLandingScale = runtime.sceneProfile === 'landing' && runtime.mount.clientWidth <= 1400
    ? (preset.name === 'NORMAL_HERO' ? 0.91 : preset.name === 'BALANCE_REVIEW' ? 0.85 : 1)
    : 1;
  const finalScale = preset.cropScale * landingScale * responsiveLandingScale;
  const offset = frame.position.clone().sub(frame.target).multiplyScalar(finalScale);
  frame.position.copy(frame.target).add(offset);
  frame.near = Math.max(0.035, frame.near * finalScale);
  runtime.camera.near = frame.near;
  runtime.camera.far = frame.far;
  const firstFrame = !runtime.cameraInitialized;
  runtime.cameraInitialized = true;
  if (immediate || firstFrame) {
    runtime.camera.fov = preset.fov;
    runtime.camera.up.copy(preset.up);
    runtime.camera.position.copy(frame.position);
    runtime.controls.target.copy(frame.target);
    runtime.cameraTween = null;
  } else {
    runtime.cameraTween = {
      elapsed: 0,
      duration: preset.transitionDuration,
      startPosition: runtime.camera.position.clone(),
      startTarget: runtime.controls.target.clone(),
      endPosition: frame.position.clone(),
      endTarget: frame.target.clone(),
      startFov: runtime.camera.fov,
      endFov: preset.fov,
      startUp: runtime.camera.up.clone(),
      endUp: preset.up.clone()
    };
  }
  runtime.camera.updateProjectionMatrix();
  runtime.controls.update();
  runtime.mount.dataset.cameraView = view;
  runtime.mount.dataset.cameraPreset = preset.name;
  runtime.mount.dataset.cameraDistance = runtime.camera.position.distanceTo(frame.target).toFixed(3);
  runtime.mount.dataset.cameraPosition = runtime.camera.position.toArray().map((value) => value.toFixed(3)).join(',');
  runtime.mount.dataset.sceneDimensions = [length, width, height].map((value) => value.toFixed(3)).join(',');
}

function startPresentationCamera(runtime) {
  const { length, width, height } = runtime.dimensions;
  const presetNames = ['overview', 'door', 'side', 'overview'];
  const frames = presetNames.map((name) => {
    const preset = buildCameraPreset(name, { length, width, height, mode: runtime.mode || 'operation' });
    return computeCameraFrame({ ...preset, verticalFov: THREE.MathUtils.degToRad(runtime.camera.fov), aspect: runtime.camera.aspect || 1 });
  });
  frames.splice(3, 0, {
    position: new THREE.Vector3(length / 2 - 0.45, Math.max(1.25, height * 0.52), width * 0.18),
    target: new THREE.Vector3(-length * 0.2, Math.max(0.75, height * 0.38), 0),
    near: 0.04,
    far: 80
  });
  runtime.presentationSequence = { frames, index: 0 };
  advancePresentationCamera(runtime);
}

function advancePresentationCamera(runtime) {
  const tour = runtime.presentationSequence;
  if (!tour || runtime.currentView !== 'presentation' || tour.index >= tour.frames.length) {
    runtime.presentationSequence = null;
    return;
  }
  const frame = tour.frames[tour.index++];
  runtime.camera.near = frame.near;
  runtime.camera.far = frame.far;
  runtime.camera.updateProjectionMatrix();
  runtime.cameraTween = {
    elapsed: 0,
    duration: tour.index === 1 ? 0.9 : 1.35,
    startPosition: runtime.camera.position.clone(),
    startTarget: runtime.controls.target.clone(),
    endPosition: frame.position.clone(),
    endTarget: frame.target.clone(),
    onComplete: () => advancePresentationCamera(runtime)
  };
}

function makeLabelSprite(text, position, color, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 112;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(248,250,248,0.94)';
  roundRect(context, 4, 4, 504, 104, 18); context.fill();
  context.strokeStyle = color; context.lineWidth = 5; context.stroke();
  const fontSize = Math.max(18, Math.min(38, 780 / Math.max(12, String(text).length)));
  context.fillStyle = color; context.font = `650 ${fontSize}px system-ui, Microsoft YaHei, sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 256, 57);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const scale = options.scale || [2.55, 0.56, 1];
  const sprite = new THREE.Sprite(material); sprite.position.copy(position); sprite.scale.set(...scale); sprite.renderOrder = 20; return sprite;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath(); context.roundRect(x, y, width, height, radius);
}

function setDomainPosition(object, position, dimensions) {
  object.position.copy(domainVector(position, dimensions));
}
function domainVector(position, dimensions) {
  return new THREE.Vector3(Number(position.x || 0) * MM - dimensions.length / 2, Number(position.y || 0) * MM, Number(position.z || 0) * MM - dimensions.width / 2);
}
function pointDataset(position) {
  return [position?.x, position?.y, position?.z].map((value) => Number(value || 0).toFixed(2)).join(',');
}
function viewRefSafe(runtime) {
  return runtime.currentView || 'overview';
}
function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    disposeObject(child);
  }
}
function disposeObject(object) {
  object.traverse?.((child) => {
    // InstancedMesh owns GPU instance buffers in addition to its geometry.
    if (child.isInstancedMesh) child.dispose();
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    materials.forEach((material) => {
      for (const value of Object.values(material)) if (value?.isTexture && !value.userData?.portcubeShared) value.dispose();
      material.dispose?.();
    });
  });
}
