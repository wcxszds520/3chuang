import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { classifyCargoAppearance } from '../../domain/cargo/appearance.js';
import { FINAL_VISUAL_PROFILE } from '../visual/visualProfile.js';
import { rememberCargoOpacity } from '../visual/cargoOpacity.js';

export const PRECISION_FAMILIES = Object.freeze(['carton', 'crate', 'equipment_case', 'generic', 'palletized', 'wrapped']);
export const PRECISION_VARIANTS = Object.freeze({
  carton: ['carton', 'carton_reinforced', 'carton_long_flat', 'carton_strapped'],
  crate: ['crate', 'crate_reinforced', 'crate_heavy_skid'],
  equipment_case: ['equipment_case', 'equipment_case_reinforced'],
  generic: ['generic', 'generic_long_flat'],
  palletized: ['palletized', 'palletized_industrial'],
  wrapped: ['wrapped']
});
const AXES = ['L', 'W', 'H'];

export function placementAxisMap(item) {
  const isPreview = item.algorithmMeta?.source === 'local-preview';
  const explicit = isPreview ? null : item.axisMap;
  if (explicit && new Set([explicit.containerX, explicit.containerY, explicit.containerZ]).size === 3
    && [explicit.containerX, explicit.containerY, explicit.containerZ].every(a => AXES.includes(a))) return explicit;
  // Preview decisions carry a separate, render-only orientation. Never infer
  // a formal placement orientation from its dimensions or from a default pose.
  const preview = isPreview
    ? item.algorithmMeta.orientation : '';
  const id = String(isPreview ? preview : item.orientationId || item.orientation || '').toUpperCase();
  // Legacy XYZ describes original L/W/H in placement l/w/h order.
  const code = /^[XYZ]{3}$/.test(id) ? [...id].map(a => ({ X: 'L', Y: 'W', Z: 'H' })[a]).join('') : id;
  if (!/^[LWH]{3}$/.test(code) || new Set(code).size !== 3) throw new Error('货物缺少可验证的方向元数据');
  return { containerX: code[0], containerY: code[2], containerZ: code[1] };
}

export function originalDimensionsM(item) {
  const map = placementAxisMap(item);
  const result = {};
  for (const [key, dimension] of [['containerX', item.l ?? item.length], ['containerY', item.h ?? item.height], ['containerZ', item.w ?? item.width]]) {
    result[map[key]] = Number(dimension) / 1000;
  }
  const values = AXES.map(a => result[a]);
  if (!values.every(v => Number.isFinite(v) && v > 0)) throw new Error('货物视觉尺寸无效');
  const source = item.cargoPhysicalProfile?.dimensions;
  if (source) {
    const expected = [source.lengthMm, source.widthMm, source.heightMm].map(Number);
    if (expected.every(v => Number.isFinite(v) && v > 0) && expected.some((v, i) => Math.abs(v / 1000 - values[i]) > 1e-6)) {
      throw new Error('货物方向元数据与原始物理尺寸不一致');
    }
  }
  return values;
}

/** Derived visual choice only. A reinforced/skidded variant requires an explicit
 * visual configuration; geometry may select the long/flat shape of its family. */
export function precisionVariant(item) {
  if(['commerce-v4','commerce-v6'].includes(item.visualProfile?.version))return (item.visualProfile.version==='commerce-v6'?'cv6_':'cv4_')+item.visualProfile.assetId;
  if(item.visualProfile?.version==='industrial-v3')return item.visualProfile.assetId;
  if(item.presentationProfile?.version==='external-hero-v1')return item.presentationProfile.structuralVariant;
  const family = classifyCargoAppearance(item).key;
  const variants = PRECISION_VARIANTS[family];
  if (!variants) throw new Error(`${family} 暂无高精度资产`);
  const requested = item.visualProfile?.structureVariant;
  if (requested) {
    if (!variants.includes(requested)) throw new Error('结构变体与包装类别不一致');
    return requested;
  }
  const [l, w, h] = originalDimensionsM(item);
  return ['carton', 'generic'].includes(family) && h < Math.max(l, w) * .30 ? `${family}_long_flat` : family;
}

export function precisionBatchKey(item) {
  return `${precisionVariant(item)}:${originalDimensionsM(item).map(v => v.toFixed(6)).join(':')}${item.presentationProfile?.version==='external-hero-v1'?':'+item.presentationProfile.colorVariant:''}`;
}

/** A proper rotation, preserving the original upright axis, never a reflection.
 * Source Blender XYZ=LWH -> glTF XYZ=LH-W; solver/scene XYZ=LHW.
 * Axis permissions do not encode signed horizontal directions. Choose one
 * deterministic right-handed horizontal direction for each permutation.
 */
export function precisionOrientation(item, target = new THREE.Quaternion()) {
  const map = placementAxisMap(item), columns = { L: 0, H: 1, W: 2 };
  const rows = [map.containerX, map.containerY, map.containerZ];
  const a = new Array(9).fill(0);
  rows.forEach((axis, row) => { a[row * 3 + columns[axis]] = axis === 'W' ? -1 : 1; });
  const determinant = a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
  if (determinant < 0) for (let j = 6; j < 9; j++) a[j] *= -1;
  const matrix = new THREE.Matrix4().set(a[0], a[1], a[2], 0, a[3], a[4], a[5], 0, a[6], a[7], a[8], 0, 0, 0, 0, 1);
  return target.setFromRotationMatrix(matrix);
}

export function componentLayout(meta, dimensions) {
  const center = dimensions.map((d, i) => meta.pc_anchor[i] * d + meta.pc_offset[i]);
  const size = dimensions.map((d, i) => meta.pc_span[i] * d + meta.pc_size_offset[i]);
  if (!size.every(v => Number.isFinite(v) && v > 0)) throw new Error('货物尺寸不足以容纳所选结构构件');
  if (meta.pc_repeat_axis === undefined) return [{ center, size }];
  if (Number(meta.pc_replica) !== 0) return [];
  const axis = Number(meta.pc_repeat_axis), available = dimensions[axis] - 2 * meta.pc_repeat_inset;
  const count = Math.max(2, Math.ceil(Math.max(0, available) / meta.pc_repeat_pitch) + 1);
  return Array.from({ length: count }, (_, index) => {
    const repeated = [...center]; repeated[axis] = -available / 2 + available * index / (count - 1);
    return { center: repeated, size };
  });
}

// Extend a panel's middle span; retain its manufactured edge radius.
export function resizePartCoordinate(value, oldSize, newSize, radius) {
  if (Math.abs(oldSize - newSize) < 1e-8) return value;
  const edge = Math.min(radius, oldSize * .24, newSize * .24);
  const inner = oldSize / 2 - edge;
  if (Math.abs(value) >= inner) return Math.sign(value) * (newSize / 2 - (oldSize / 2 - Math.abs(value)));
  return value * (newSize / 2 - edge) / Math.max(inner, 1e-8);
}

/** Create physical metre geometry from authored components, not a unit box.
 * Every part carries its own dimension / anchor / repeat contract in GLB extras.
 * Geometry is cached by family and original envelope; orientation stays per item.
 */
export function createPrecisionGeometry(prototype, dimensions, presentationProfile) {
  let authoredQuality = false;
  prototype.traverse(n => { if (n.isMesh && (Array.isArray(n.material) ? n.material : [n.material]).some(m => m?.userData?.quality_v1)) authoredQuality = true; });
  if (authoredQuality) presentationProfile = undefined;
  const parts = [], materials = [], materialIndices = new Map();
  prototype.updateMatrixWorld(true);
  prototype.traverse(node => {
    if(presentationProfile && node.isMesh && node.userData.hero_diagonal){
      const [l,w,h]=dimensions,dx=l-.24,dy=h-.24,span=Math.hypot(dx,dy),sign=node.userData.hero_side;
      const geometry=new THREE.BoxGeometry(span,.085,.032).toNonIndexed();
      const braceUv=geometry.getAttribute('uv');for(let i=0;i<braceUv.count;i++)braceUv.setXY(i,braceUv.getY(i)*.1,braceUv.getX(i)*span*2.5);
      geometry.rotateZ(Math.atan2(dy,dx));geometry.translate(0,0,-sign*(w/2-.025));
      const material=node.material.clone();material.name='Hero_Wood058_brace';material.userData={...material.userData,precisionDetailRole:'structure'};
      material.color.set(presentationProfile.colorVariant);materials.push(material);parts.push({geometry,materialIndex:materials.length-1});
      const endSpan=Math.hypot(w-.24,dy),endGeometry=new THREE.BoxGeometry(.032,.085,endSpan).toNonIndexed();
      const endUv=endGeometry.getAttribute('uv');for(let i=0;i<endUv.count;i++)endUv.setXY(i,endUv.getX(i)*.1,endUv.getY(i)*endSpan*2.5);
      endGeometry.rotateX(-Math.atan2(dy,w-.24));endGeometry.translate(sign*(l/2-.025),0,0);parts.push({geometry:endGeometry,materialIndex:materials.length-1});return;
    }
    if (!node.isMesh || !node.userData.pc_family) return;
    const meta = node.userData;
    for (const layout of componentLayout(meta, dimensions)) {
      let geometry = node.geometry.clone();
      if (geometry.index) { const old = geometry; geometry = old.toNonIndexed(); old.dispose(); }
      geometry.applyMatrix4(node.matrixWorld);
      const position = geometry.getAttribute('position');
      const material = Array.isArray(node.material) ? node.material[0] : node.material;
      const uv = geometry.getAttribute('uv'), normal = geometry.getAttribute('normal');
      for (let i = 0; i < position.count; i++) {
        const original = [position.getX(i), -position.getZ(i), position.getY(i)];
        const next = original.map((v, axis) => layout.center[axis] + resizePartCoordinate(v - meta.pc_center[axis], meta.pc_size[axis], layout.size[axis], meta.pc_preserve));
        if (uv && normal && /ash_wood|kraft_board|Hero_Wood|Hero_Cardboard/.test(material.name)) {
          // Retain Blender's UV phase and grain orientation at the base size.
          // Add only the physical local span change, so repeating a board does
          // not move its texture and resizing does not stretch its fibre scale.
          const n = [Math.abs(normal.getX(i)), Math.abs(normal.getZ(i)), Math.abs(normal.getY(i))];
          const axes = [0, 1, 2].filter(a => a !== n.indexOf(Math.max(...n)));
          if(meta.quality_grain_axis !== undefined && axes.includes(meta.quality_grain_axis)) axes.sort((a,b)=>(meta.quality_grain_along_v?-1:1)*(a===meta.quality_grain_axis?-1:b===meta.quality_grain_axis?1:a-b));
          if(/Hero_/.test(material.name)&&axes.includes(meta.rescue_grain_axis))axes.sort((a,b)=>a===meta.rescue_grain_axis?-1:b===meta.rescue_grain_axis?1:a-b);
          const delta = axes.map(a => next[a] - layout.center[a] - (original[a] - meta.pc_center[a]));
          const textureScale=meta.quality_texels_per_m ?? (/Hero_/.test(material.name)?2.5:1.3);
          uv.setXY(i, uv.getX(i) + delta[0] * textureScale, uv.getY(i) + delta[1] * textureScale);
        }
        position.setXYZ(i, next[0], next[2], -next[1]);
      }
      for (const attribute of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(attribute)) geometry.deleteAttribute(attribute);
      if(presentationProfile&&uv&&/Hero_Wood/.test(material.name))for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getY(i),uv.getX(i));
      // Edge radii and cross-sections retain authored weighted/smooth normals.
      // Only the flat middle of a panel changes length.
      if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(position.count * 2), 2));
      const detailRole=/label|barcode|qr_code/i.test(node.name)?'label':'structure';
      const materialKey=material.uuid+':'+detailRole;
      if (!materialIndices.has(materialKey)) {
        const clone = material.clone(); clone.name = material.name;
        if (authoredQuality && /kraft_board/.test(clone.name)) clone.color.setRGB(.65,.70,.80);
        clone.userData={...clone.userData,precisionDetailRole:detailRole};
        if(presentationProfile&&detailRole==='structure'){
          clone.userData.externalHero=true;
          if(/Hero_Cardboard/.test(clone.name)){const tone=({'#aa8760':.92,'#a58967':1,'#b29673':1.05})[presentationProfile.colorVariant]||1;clone.color.setRGB(.85*tone,.82*tone,.76*tone);}
          else if(/kraft_tape/.test(clone.name)){clone.color.set('#937e65');clone.roughness=.95;clone.metalness=0;}
          else if(/Hero_Wood/.test(clone.name))clone.color.setRGB(.78,.76,.7);
          else if(/powder|coated_steel|Hero_neutral/.test(clone.name))clone.color.set(presentationProfile.colorVariant);
        }
        clone.envMapIntensity = FINAL_VISUAL_PROFILE.environment.cargo;
        if (clone.transparent) { clone.depthWrite = false; clone.side = THREE.DoubleSide; }
        rememberCargoOpacity(clone);
        materialIndices.set(materialKey, materials.length); materials.push(clone);
      }
      parts.push({ geometry, materialIndex: materialIndices.get(materialKey) });
    }
  });
  if(presentationProfile?.presentationFamily==='CARTON'){
    const [l,w,h]=dimensions;const material=new THREE.MeshStandardMaterial({name:'Hero_matte_fold_edge',color:'#796c5b',roughness:1,metalness:0});material.userData={precisionDetailRole:'structure',externalHero:true};const materialIndex=materials.length;materials.push(material);
    const add=(size,center)=>{const geometry=new THREE.BoxGeometry(...size).toNonIndexed();geometry.translate(...center);parts.push({geometry,materialIndex});};
    for(const y of [-1,1]){for(const z of [-1,1])add([l-.002,.008,.0016],[0,y*(h/2-.003),z*(w/2+.0002)]);for(const x of [-1,1])add([.0016,.008,w-.002],[x*(l/2+.0002),y*(h/2-.003),0]);}
  }
  if(presentationProfile&&['METAL_CASE','NEUTRAL_INDUSTRIAL_PACKAGE'].includes(presentationProfile.presentationFamily)){
    const [l,w,h]=dimensions,metal=presentationProfile.presentationFamily==='METAL_CASE',reinforced=/reinforced/.test(presentationProfile.structuralVariant),rail=metal?(reinforced?.045:.029):.02;
    const material=new THREE.MeshStandardMaterial({name:metal?'Hero_formed_edge_profile':'Hero_neutral_seam',color:metal?'#374b4c':'#505e59',roughness:metal?.42:.8,metalness:metal?.5:0});material.userData={precisionDetailRole:'structure',externalHero:true};const materialIndex=materials.length;materials.push(material);
    const part=(size,center)=>{const geometry=new THREE.BoxGeometry(...size).toNonIndexed();geometry.translate(...center);parts.push({geometry,materialIndex});};
    for(const x of [-1,1])for(const z of [-1,1])part([rail,h-.025,rail],[x*(l/2-rail/2),0,z*(w/2-rail/2)]);
    for(const y of [-1,1])for(const z of [-1,1])part([l-.025,rail,rail],[0,y*(h/2-rail/2),z*(w/2-rail/2)]);
    if(metal)for(const x of [-1,1])for(const y of [-1,1])part([rail,rail,w-.025],[x*(l/2-rail/2),y*(h/2-rail/2),0]);
    if(!metal&&/banded|reinforced/.test(presentationProfile.structuralVariant))for(const x of [-l*.25,l*.25]){for(const z of [-1,1])part([.035,h-.012,.009],[x,0,z*(w/2-.005)]);for(const y of [-1,1])part([.035,.009,w-.012],[x,y*(h/2-.005),0]);}
  }
  if (!parts.length) throw new Error('高精度货物资产缺少构件合同');
  parts.sort((a, b) => a.materialIndex - b.materialIndex);
  const geometry = mergeGeometries(parts.map(part => part.geometry), false);
  if (!geometry) throw new Error('高精度构件合并失败');
  let start = 0;
  for (const part of parts) {
    const count = part.geometry.getAttribute('position').count;
    const last = geometry.groups.at(-1);
    if (last?.materialIndex === part.materialIndex) last.count += count;
    else geometry.addGroup(start, count, part.materialIndex);
    start += count; part.geometry.dispose();
  }
  if(presentationProfile){
    // Asset surfaces sit 1.2 mm inside the unchanged solver envelope. This is a
    // visual manufacturing clearance, never a packing-space or fact reduction.
    const p=geometry.getAttribute('position'),half=[dimensions[0]/2,dimensions[2]/2,dimensions[1]/2];
    for(let i=0;i<p.count;i++){const xyz=[p.getX(i),p.getY(i),p.getZ(i)];for(let a=0;a<3;a++)if(Math.abs(xyz[a])>half[a]-.01)xyz[a]-=Math.sign(xyz[a])*.0012;p.setXYZ(i,...xyz);}
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, materials, dimensions, contract: 'component-affine-v1' };
}
