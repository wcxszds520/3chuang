import * as THREE from 'three';

const surfaces = new Map();

// Small, deterministic material tiles. Shared by every instance of a material;
// these are surface variation, never SKU colours or analytical data.
export function inspectionSurface(kind) {
  if (surfaces.has(kind)) return surfaces.get(kind);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(size, size);
  let seed = 1729;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = noise();
    const wood = kind === 'wood';
    const fiber = Math.sin(y * .87 + Math.sin(x * .022) * 3) * .5 + Math.sin(y * .18 + Math.sin(x * .014) * 2) * .5;
    const value = wood ? 220 + fiber * 19 + grain * 12
      : kind === 'paper' ? 231 + grain * 24
        : kind === 'film' ? 238 + Math.sin(y * .54 + Math.sin(x * .03)) * 11 + grain * 6
          : 237 + grain * 18;
    const offset = (y * size + x) * 4;
    pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = value;
    pixels.data[offset + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.userData.portcubeShared = true;
  const bump = texture.clone();
  bump.colorSpace = THREE.NoColorSpace;
  bump.userData.portcubeShared = true;
  bump.needsUpdate = true;
  const surface = { map: texture, bumpMap: bump, roughnessMap: bump };
  surfaces.set(kind, surface);
  return surface;
}

export function finishInspectionMaterial(source) {
  const material = source.clone();
  const name = material.name.toLowerCase();
  const wood = /wood|timber|pallet_deck/.test(name);
  const paper = /carton|kraft|cardboard/.test(name);
  const film = /wrap|film/.test(name);
  const metal = /metal|hardware|steel|ring/.test(name);
  if (wood || paper || film || metal) {
    const surface = inspectionSurface(wood ? 'wood' : paper ? 'paper' : film ? 'film' : 'metal');
    if (!material.map) material.map = surface.map;
    if (!material.roughnessMap) material.roughnessMap = surface.roughnessMap;
    if (!material.normalMap && !material.bumpMap) {
      material.bumpMap = surface.bumpMap;
      material.bumpScale = wood ? .007 : paper ? .0018 : .0008;
    }
  }
  if (wood) { material.roughness = .84; material.metalness = 0; }
  if (paper) { material.roughness = .94; material.metalness = 0; }
  if (film) {
    // Opaque layered polyethylene; no glass-like sorting through the entire load.
    material.transparent = false; material.opacity = 1; material.depthWrite = true;
    material.roughness = .38; material.metalness = 0;
  }
  if (/hardware/.test(name)) { material.roughness = .29; material.metalness = .86; }
  if (/rugged|case/.test(name) && !/hardware/.test(name)) { material.roughness = .48; material.metalness = .22; }
  material.envMapIntensity = .8;
  material.side = THREE.FrontSide;
  return material;
}
