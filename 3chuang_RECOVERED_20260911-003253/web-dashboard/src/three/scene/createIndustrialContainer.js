import * as THREE from 'three';
import { addBox, addCylinder, addEdges, addInstancedBoxes, countRenderableParts } from './sharedResources.js';
import { containerSurfaceTextures } from './visualAssets.js';

export const CONTAINER_STRUCTURE_PARTS = Object.freeze([
  'floor',
  'side-walls',
  'roof',
  'front-wall',
  'corner-posts',
  'side-rails',
  'door-frame',
  'threshold',
  'left-door',
  'right-door',
  'hinges',
  'lock-rods',
  'handles',
  'corrugation',
  'brand-decal',
  'corner-castings',
  'door-gaskets',
  'forklift-pockets'
]);

export function createIndustrialContainer(parent, dimensions = {}) {
  const length = Math.max(1, Number(dimensions.length || 1));
  const width = Math.max(1, Number(dimensions.width || 1));
  const height = Math.max(1, Number(dimensions.height || 1));
  const opaque = new THREE.MeshStandardMaterial({ color: '#154f78', roughness: 0.66, metalness: 0.34, side: THREE.DoubleSide });
  const nearWall = new THREE.MeshStandardMaterial({ color: '#2871a0', roughness: 0.62, metalness: 0.28, transparent: true, opacity: 0.27, depthWrite: false, side: THREE.DoubleSide });
  const roof = new THREE.MeshStandardMaterial({ color: '#347ca9', roughness: 0.6, metalness: 0.26, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide });
  const review = new THREE.MeshStandardMaterial({ color: '#3e789a', roughness: 0.58, metalness: 0.28, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
  const frame = new THREE.MeshStandardMaterial({ color: '#0b2d47', roughness: 0.48, metalness: 0.52 });
  const floorMaterial = new THREE.MeshStandardMaterial({ color: '#625340', roughness: 0.9, metalness: 0.03 });
  const doorMaterial = new THREE.MeshStandardMaterial({ color: '#1c618d', roughness: 0.6, metalness: 0.36 });
  const ribMaterial = new THREE.MeshStandardMaterial({ color: '#11486f', roughness: 0.58, metalness: 0.42 });
  const nearRibMaterial = new THREE.MeshStandardMaterial({ color: '#236b98', roughness: 0.58, metalness: 0.34, transparent: true, opacity: 0.3, depthWrite: false });
  const roofRibMaterial = new THREE.MeshStandardMaterial({ color: '#347ea9', roughness: 0.58, metalness: 0.32, transparent: true, opacity: 0.18, depthWrite: false });
  const hardware = new THREE.MeshStandardMaterial({ color: '#bac1bd', roughness: 0.34, metalness: 0.82 });
  const darkHardware = new THREE.MeshStandardMaterial({ color: '#24322f', roughness: 0.42, metalness: 0.68 });
  const shellPanels = [];
  const stage = dimensions.variant === 'stage';
  if (stage) {
    for (const [material, color] of [[opaque, '#2E4756'], [doorMaterial, '#33566B'], [ribMaterial, '#2A4454']]) {
      Object.assign(material, containerSurfaceTextures(color), { metalness: .2, bumpScale: .6 });
      material.color.set('#ffffff'); // The albedo map already carries the specified base colour.
    }
    frame.color.set('#1B2B38'); frame.metalness = .2;
    floorMaterial.color.set('#4A3B2A');
    for (const [material, opacity] of [[nearWall,.10],[roof,.08],[review,.08],[nearRibMaterial,.10],[roofRibMaterial,.08]]) {
      material.color.set('#8FA3B4');
      Object.assign(material, {roughness:.4,metalness:.05,opacity,depthWrite:false});
    }
  }

  addBox(parent, { name: 'container-floor', size: [length, 0.12, width], position: [0, -0.06, 0], material: floorMaterial });
  shellPanels.push(
    addShellPanel(parent, { name: 'container-wall-left', size: [length, height, 0.075], position: [0, height / 2, -width / 2 - 0.0375], material: opaque }),
    addShellPanel(parent, { name: 'container-wall-right', size: [length, height, 0.075], position: [0, height / 2, width / 2 + 0.0375], material: nearWall }),
    addShellPanel(parent, { name: 'container-roof', size: [length, 0.075, width], position: [0, height + 0.0375, 0], material: roof }),
    addShellPanel(parent, { name: 'container-front-wall', size: [0.085, height, width], position: [-length / 2 - 0.0425, height / 2, 0], material: opaque })
  );

  // 品牌箱标贴花（真实集装箱箱标风格：运营商 + 箱号 + ISO 载重参数），贴远侧墙内面，透过半透明近墙可见。
  // Node 测试环境无 DOM（canvas 不可用），仅浏览器环境创建。
  if (typeof document !== 'undefined') {
    const decal = makeContainerDecal({ length, height });
    decal.position.set(-length * 0.16, height * 0.6, -width / 2 + 0.02);
    parent.add(decal);
  }

  const postGeometry = new THREE.BoxGeometry(0.13, height + 0.18, 0.13);
  for (const x of [-length / 2, length / 2]) {
    for (const z of [-width / 2, width / 2]) {
      addBox(parent, { name: 'container-corner-post', geometry: postGeometry, position: [x, height / 2, z], material: frame });
    }
  }
  const lengthRailGeometry = new THREE.BoxGeometry(length + 0.16, 0.11, 0.11);
  for (const y of [0, height]) for (const z of [-width / 2, width / 2]) {
    addBox(parent, { name: 'container-side-rail', geometry: lengthRailGeometry, position: [0, y, z], material: frame });
  }

  // ISO 1161 角件：8 个角位的铸钢连接块（真实集装箱签名细节），微凸出角柱。
  const castingGeometry = new THREE.BoxGeometry(0.2, 0.16, 0.22);
  for (const x of [-length / 2, length / 2]) for (const y of [0.02, height + 0.1]) for (const z of [-width / 2, width / 2]) {
    addBox(parent, { name: 'container-corner-casting', geometry: castingGeometry, position: [x, y, z], material: darkHardware });
  }
  // 底侧梁叉槽（叉车搬运位）：两根底梁各两个内凹暗色槽口。
  const pocketGeometry = new THREE.BoxGeometry(0.12, 0.1, 0.34);
  for (const x of [-length * 0.32, length * 0.32]) for (const z of [-width / 2 - 0.02, width / 2 + 0.02]) {
    addBox(parent, { name: 'container-forklift-pocket', geometry: pocketGeometry, position: [x, 0.03, z], material: darkHardware });
  }

  const wallRibGeometry = new THREE.BoxGeometry(0.045, height - 0.24, 0.045);
  const ribCount = Math.max(12, Math.floor(length / 0.48));
  const farWallRibs = [];
  const nearWallRibs = [];
  for (let index = 1; index < ribCount; index += 1) {
    const x = -length / 2 + index * length / ribCount;
    farWallRibs.push({ position: [x, height / 2, -width / 2 - 0.078] });
    nearWallRibs.push({ position: [x, height / 2, width / 2 + 0.078] });
  }
  addInstancedBoxes(parent, { name: 'container-side-corrugation-far', geometry: wallRibGeometry, material: ribMaterial, transforms: farWallRibs });
  addInstancedBoxes(parent, { name: 'container-side-corrugation-near', geometry: wallRibGeometry, material: nearRibMaterial, transforms: nearWallRibs });
  const roofRibGeometry = new THREE.BoxGeometry(0.045, 0.04, width - 0.18);
  addInstancedBoxes(parent, {
    name: 'container-roof-corrugation',
    geometry: roofRibGeometry,
    material: roofRibMaterial,
    transforms: Array.from({ length: ribCount - 1 }, (_, index) => ({ position: [-length / 2 + (index + 1) * length / ribCount, height + 0.078, 0] }))
  });

  const doorX = length / 2 + 0.065;
  addBox(parent, { name: 'door-frame-top', size: [0.14, 0.14, width + 0.2], position: [doorX, height + 0.02, 0], material: frame });
  addBox(parent, { name: 'door-threshold', size: [0.16, 0.13, width + 0.18], position: [doorX, 0.01, 0], material: frame });
  addBox(parent, { name: 'door-frame-left', size: [0.15, height, 0.15], position: [doorX, height / 2, -width / 2 - 0.025], material: frame });
  addBox(parent, { name: 'door-frame-right', size: [0.15, height, 0.15], position: [doorX, height / 2, width / 2 + 0.025], material: frame });

  const leftPivot = new THREE.Group();
  leftPivot.name = 'left-door-pivot';
  leftPivot.position.set(doorX + 0.02, 0, -width / 2);
  const rightPivot = new THREE.Group();
  rightPivot.name = 'right-door-pivot';
  rightPivot.position.set(doorX + 0.02, 0, width / 2);
  parent.add(leftPivot, rightPivot);
  const leftDoor = makeDoor(leftPivot, -1, { width, height, doorMaterial, frame, hardware, darkHardware });
  const rightDoor = makeDoor(rightPivot, 1, { width, height, doorMaterial, frame, hardware, darkHardware });

  const reviewCutaway = new THREE.Group();
  reviewCutaway.name = 'container-review-cutaway';
  reviewCutaway.visible = false;
  const outlineMaterial = new THREE.LineBasicMaterial({ color: stage ? '#7FB4E8' : '#63a9e8', transparent: true, opacity: 0.74 });
  addEdges(reviewCutaway, {
    name: 'container-review-outline',
    geometry: new THREE.BoxGeometry(length, height, width),
    position: [0, height / 2, 0],
    material: outlineMaterial,
    castShadow: false,
    receiveShadow: false
  });
  parent.add(reviewCutaway);

  const partCount = countRenderableParts(parent);
  return {
    doors: { leftPivot, rightPivot },
    shellMaterials: { opaque, review, operation: { farWall: opaque, nearWall, roof }, panels: shellPanels },
    reviewCutaway,
    doorPanels: [leftDoor.panel, rightDoor.panel],
    descriptor: {
      structureParts: CONTAINER_STRUCTURE_PARTS,
      partCount,
      doorCount: 2,
      doorEnd: 'high-x',
      corrugationCount: farWallRibs.length + nearWallRibs.length + ribCount - 1
    }
  };
}

function addShellPanel(parent, options) {
  const panel = addBox(parent, options);
  panel.userData.operationMaterial = options.material;
  return panel;
}

// 集装箱箱标：40HQ 真实 ISO 参数（MAX GROSS 30480 / TARE 3900 / PAYLOAD 26580 / CU.CAP 76.4）。
function makeContainerDecal({ length }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 512);
  ctx.fillStyle = 'rgba(238, 245, 241, 0.92)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 88px system-ui, "Microsoft YaHei", sans-serif';
  ctx.fillText('智港立方', 44, 118);
  ctx.font = '700 60px system-ui, sans-serif';
  ctx.fillText('PORTCUBE', 44, 192);
  ctx.font = '600 54px "Cascadia Mono", Consolas, monospace';
  ctx.fillText('PCBU 260713 1', 44, 268);
  ctx.font = '500 34px "Cascadia Mono", Consolas, monospace';
  const specs = [['MAX GROSS', '30480 KG'], ['TARE', '3900 KG'], ['PAYLOAD', '26580 KG'], ['CU.CAP', '76.4 M3']];
  specs.forEach(([label, value], index) => {
    ctx.fillText(`${label}  ${value}`, 44, 330 + index * 44);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const decalWidth = Math.min(Number(length) * 0.42, 5.4);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(decalWidth, decalWidth * 0.5),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  mesh.name = 'container-brand-decal';
  mesh.renderOrder = 2;
  return mesh;
}

function makeDoor(pivot, side, resources) {
  const { width, height, doorMaterial, frame, hardware, darkHardware } = resources;
  const half = width / 2 - 0.055;
  const panel = addBox(pivot, {
    name: side < 0 ? 'left-door-panel' : 'right-door-panel',
    size: [0.09, height - 0.14, half],
    position: [0, height / 2, side < 0 ? half / 2 : -half / 2],
    material: doorMaterial
  });
  const localSign = side < 0 ? 1 : -1;
  const doorRibGeometry = new THREE.BoxGeometry(0.028, height - 0.24, 0.035);
  for (let index = 1; index < 6; index += 1) {
    addBox(pivot, {
      name: 'door-corrugation',
      geometry: doorRibGeometry,
      position: [0.061, height / 2, localSign * half * index / 6],
      material: frame
    });
  }
  const rodGeometry = new THREE.CylinderGeometry(0.018, 0.018, height * 0.8, 12);
  for (const factor of [0.31, 0.69]) {
    const z = localSign * half * factor;
    addCylinder(pivot, { name: 'door-lock-rod', geometry: rodGeometry, position: [0.076, height / 2, z], material: hardware });
    addBox(pivot, { name: 'door-handle', size: [0.055, 0.055, half * 0.24], position: [0.105, height * 0.43, z + localSign * half * 0.06], material: darkHardware });
  }
  const hingeGeometry = new THREE.CylinderGeometry(0.038, 0.038, 0.16, 12);
  for (const y of [0.3, height * 0.38, height * 0.68, height - 0.3]) {
    addCylinder(pivot, { name: 'door-hinge', geometry: hingeGeometry, position: [0, y, 0], material: hardware });
  }
  // 门缝密封胶条：门板四周深色橡胶压边（真实箱门防水的签名细节）。
  const gasketCenterZ = side < 0 ? half / 2 : -half / 2;
  addBox(pivot, { name: 'door-gasket-top', size: [0.1, 0.05, half], position: [-0.01, height - 0.09, gasketCenterZ], material: darkHardware });
  addBox(pivot, { name: 'door-gasket-bottom', size: [0.1, 0.05, half], position: [-0.01, 0.09, gasketCenterZ], material: darkHardware });
  addBox(pivot, { name: 'door-gasket-side', size: [0.1, height - 0.14, 0.05], position: [-0.01, height / 2, localSign * (half - 0.02)], material: darkHardware });
  return { panel };
}
