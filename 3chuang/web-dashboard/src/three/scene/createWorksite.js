import * as THREE from 'three';
import { addBox, addPlane, countRenderableParts } from './sharedResources.js';

export const WORKSITE_STRUCTURE_PARTS = Object.freeze(['concrete-slab', 'staging-zone', 'safety-markings', 'debug-grid', 'loading-lane', 'waiting-bay', 'dock-edge', 'dock-ramp']);

// 径向接触阴影贴图。浏览器里用 canvas 光栅化；Node/Vitest 无 DOM，用同一组
// 渐变参数（r15→r64，alpha .45→.22→0）程序化生成像素——两种环境下场景图
// 部件完全一致，descriptor 不随运行环境失真。
function createContactShadowMap() {
  const size = 128;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 15, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0,0,0,.45)');
    gradient.addColorStop(.64, 'rgba(0,0,0,.22)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }
  const data = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const radius = Math.hypot(px + .5 - size / 2, py + .5 - size / 2);
      const t = Math.min(1, Math.max(0, (radius - 15) / (64 - 15)));
      const alpha = t <= .64 ? .45 + (.22 - .45) * (t / .64) : .22 * (1 - (t - .64) / .36);
      data[(py * size + px) * 4 + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

export function createWorksite(scene, dimensions = {}) {
  const length = Math.max(1, Number(dimensions.length || 1));
  const width = Math.max(1, Number(dimensions.width || 1));
  const group = new THREE.Group();
  group.name = 'operational-inspection-bay';
  scene.add(group);
  const floor = new THREE.MeshStandardMaterial({ color: '#71818b', roughness: .86, metalness: .03 });
  addPlane(group, { name: 'studio-floor', size: [180, 180], position: [0, Number(dimensions.yardLevel ?? -.22), 0], rotation: [-Math.PI / 2, 0, 0], material: floor, castShadow: false });
  if(dimensions.yardLevel===0){
    // A flush loading dock surrounds the container; it must not cover its
    // independently modelled timber floor at the same height.
    const shape=new THREE.Shape();shape.moveTo(-90,-90);shape.lineTo(90,-90);shape.lineTo(90,90);shape.lineTo(-90,90);shape.closePath();
    const hole=new THREE.Path();hole.moveTo(-length/2,-width/2);hole.lineTo(-length/2,width/2);hole.lineTo(length/2,width/2);hole.lineTo(length/2,-width/2);hole.closePath();shape.holes.push(hole);
    const ground=group.getObjectByName('studio-floor');ground.geometry.dispose();ground.geometry=new THREE.ShapeGeometry(shape);
  }
  // A contact lobe under the chassis complements the real directional shadow.
  const contact = new THREE.MeshBasicMaterial({ map: createContactShadowMap(), transparent: true, depthWrite: false, toneMapped: false });
  addPlane(group, { name: 'frame-contact-shadow', size: [length + 3, width + 2], position: [0, Number(dimensions.yardLevel ?? -.22)+.009, 0], rotation: [-Math.PI / 2, 0, 0], material: contact, castShadow: false });
  if(dimensions.yardLevel===0)group.getObjectByName('frame-contact-shadow').visible=false;
  const markings = new THREE.Group();
  markings.name = 'inspection-and-staging-markings';
  group.add(markings);
  const edge = width / 2 + .55;
  // One floor decal provides real metre spacing without a scene full of helpers.
  // The yard is a schematic reference, independent of formal container placements.
  // 贴花内容（刻度线/文字）只能在浏览器里光栅化；Node/Vitest 用透明占位纹理，
  // decal 网格始终实例化，场景 descriptor 的逻辑结构不随 DOM 是否存在而失真。
  const minX = -length / 2 - 1.2; const maxX = length / 2 + 5.2;
  const halfZ = Math.max(3.5, width / 2 + 2.2);
  let paintMap;
  if (typeof document !== 'undefined') {
    const paint = document.createElement('canvas');
    paint.width = 2048; paint.height = 1024;
    const pen = paint.getContext('2d');
    const sx = paint.width / (maxX - minX); const sz = paint.height / (halfZ * 2);
    const px = (x) => (x - minX) * sx; const pz = (z) => (z + halfZ) * sz;
    const line = (x1, z1, x2, z2, color = '#60737c', thickness = .018) => {
      pen.strokeStyle = color; pen.lineWidth = Math.max(1, thickness * sx);
      pen.beginPath(); pen.moveTo(px(x1), pz(z1)); pen.lineTo(px(x2), pz(z2)); pen.stroke();
    };
    const label = (text, x, z, size = .17, color = '#415a67') => {
      pen.fillStyle = color; pen.font = `500 ${size * sz}px Arial, sans-serif`;
      pen.fillText(text, px(x), pz(z));
    };
    // Inspection envelope and measured scale along the long side.
    pen.globalAlpha = .62;
    for (const z of [-edge, edge]) line(-length / 2 - .45, z, length / 2 + .35, z);
    line(-length / 2 - .45, -edge, -length / 2 - .45, edge);
    for (let metre = 0; metre <= Math.floor(length); metre += 1) {
      const x = -length / 2 + metre;
      line(x, edge, x, edge + (metre % 2 ? .12 : .22));
      if (metre % 2 === 0) label(String(metre), x - .07, edge + .43, .14);
    }
    label('m', length / 2 + .2, edge + .43, .14);
    label('01  装箱复核', -length / 2 + .1, edge + .92, .2);
    // Keep the door approach separate from the illustrative discharged cargo strip.
    const gate = length / 2;
    for (const z of [-width / 2 - .15, width / 2 + .15]) {
      pen.setLineDash([.22 * sx, .18 * sx]);
      line(gate + .5, z, gate + 4.7, z, '#a78038', .025);
      pen.setLineDash([]);
    }
    label('作业通道', gate + 1.5, .12, .22, '#96772f');
    label('02  暂存', gate + 1.2, -width / 2 - .65, .18, '#96772f');
    label('设备待命', gate + 2.35, width / 2 + 1.8, .15);
    pen.globalAlpha = .25;
    for (const x of [-length / 2 - .9, gate + 4.9]) line(x, -halfZ + .2, x, halfZ - .2, '#727c7e');
    paintMap = new THREE.CanvasTexture(paint);
    paintMap.colorSpace = THREE.SRGBColorSpace;
    paintMap.anisotropy = 4;
  } else {
    paintMap = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
    paintMap.needsUpdate = true;
  }
  const paintMaterial = new THREE.MeshStandardMaterial({ map: paintMap, transparent: true, depthWrite: false, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 });
  addPlane(markings, { name: 'inspection-floor-decal', size: [maxX - minX, halfZ * 2], position: [(minX + maxX) / 2, Number(dimensions.yardLevel ?? -.22)+.013, 0], rotation: [-Math.PI / 2, 0, 0], material: paintMaterial, castShadow: false });
  const steel = new THREE.MeshStandardMaterial({ color: '#454e50', roughness: .64, metalness: .42 });
  const safety = new THREE.MeshStandardMaterial({ color: '#9c8856', roughness: .75, metalness: .12 });
  // 门口钢制登车坡道：场院地面（-0.22）过渡到箱内地板（0），叉车/人工由此进箱。
  const rampRun = 1.5;
  const rampRise = -Number(dimensions.yardLevel ?? -.22);
  const rampSpan = Math.hypot(rampRun, rampRise);
  const rampAngle = Math.atan2(rampRise, rampRun);
  const rampSteel = new THREE.MeshStandardMaterial({ color: '#5a6467', roughness: .58, metalness: .55 });
  const ramp = addBox(group, {
    name: 'dock-ramp-plate',
    size: [rampSpan, 0.024, width * 0.9],
    position: [length / 2 + rampRun / 2 + 0.02, -rampRise / 2 - 0.012, 0],
    rotation: [0, 0, -rampAngle],
    material: rampSteel
  });
  ramp.receiveShadow = true;
  // 坡道两侧安全挡边
  for (const zSide of [-1, 1]) {
    addBox(group, {
      name: 'dock-ramp-curb',
      size: [rampSpan, 0.055, 0.05],
      position: [length / 2 + rampRun / 2 + 0.02, -rampRise / 2 + 0.015, zSide * (width * 0.45 - 0.025)],
      rotation: [0, 0, -rampAngle],
      material: safety
    });
  }
  for (const z of [-edge - .2, edge + .2]) {
    addBox(markings, { name: 'bay-end-protection', size: [.14, .58, .14], position: [-length / 2 - .72, .08, z], material: steel });
    addBox(markings, { name: 'bay-reflector', size: [.145, .075, .145], position: [-length / 2 - .72, .26, z], material: safety });
  }
  const backdrop = new THREE.Group();
  backdrop.visible = false;
  const debugGrid = new THREE.GridHelper(28, 28, '#687278', '#45494c');
  debugGrid.position.y = -.20;
  debugGrid.visible = false;
  group.add(debugGrid);
  return { group, debugGrid, zoneMeshes: [markings], backdrop, descriptor: {
    structureParts: WORKSITE_STRUCTURE_PARTS, partCount: countRenderableParts(group), finite: true, slabLength: 180, slabWidth: 180
  } };
}
