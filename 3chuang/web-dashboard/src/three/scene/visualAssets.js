import * as THREE from 'three';

// 天幕渐变：浅色工业场景的背景纵深（顶部略冷、地平线略暖），替代平板纯色。
export function makeSkyGradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 512;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#d8e4e2');
  gradient.addColorStop(0.55, '#e9efec');
  gradient.addColorStop(1, '#eef0ea');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 4, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 货物程序化表面纹理：按 V2.5 包装外观生成近白灰度 pattern（缓存复用）。
// 实例化材质为白色基底，map × instanceColor 相乘后得到"带纹理的彩色箱子"。
const cargoPatternCache = new Map();
const cargoSurfaceCache = new Map();

function finishSharedTexture(texture, { color = false } = {}) {
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.userData.portcubeShared = true;
  return texture;
}

export function cargoPatternTexture(pattern) {
  const key = pattern || 'bands';
  if (cargoPatternCache.has(key)) return cargoPatternCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  const ink = 'rgba(58, 58, 58, 0.24)';
  const soft = 'rgba(58, 58, 58, 0.14)';
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  if (key === 'grid') {
    ctx.lineWidth = 5;
    for (let i = 1; i < 4; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
    }
  } else if (key === 'vents') {
    for (let row = 0; row < 5; row += 1) for (let col = 0; col < 6; col += 1) {
      ctx.fillStyle = soft;
      ctx.fillRect(26 + col * 36, 42 + row * 38, 22, 8);
    }
  } else if (key === 'slats') {
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = soft;
      ctx.fillRect(i * 44 + 34, 0, 10, 256);
    }
    ctx.fillStyle = ink;
    ctx.fillRect(0, 118, 256, 20);
  } else if (key === 'cross') {
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(28, 28); ctx.lineTo(228, 228); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(228, 28); ctx.lineTo(28, 228); ctx.stroke();
  } else if (key === 'chevrons') {
    ctx.lineWidth = 12;
    for (let i = 0; i < 3; i += 1) {
      const y = 60 + i * 70;
      ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(128, y + 34); ctx.lineTo(226, y); ctx.stroke();
    }
  } else if (key === 'top-clear') {
    ctx.lineWidth = 10;
    ctx.strokeRect(16, 16, 224, 224);
    ctx.beginPath(); ctx.moveTo(128, 190); ctx.lineTo(128, 66); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(88, 106); ctx.lineTo(128, 62); ctx.lineTo(168, 106); ctx.stroke();
  } else if (key === 'wrap') {
    ctx.lineWidth = 5;
    for (let y = 24; y < 256; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 12); ctx.stroke(); }
  } else if (key === 'rings') {
    ctx.lineWidth = 12;
    [38, 128, 218].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); });
  } else if (key === 'woven') {
    ctx.lineWidth = 3;
    for (let i = 0; i < 256; i += 18) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
  } else {
    // bands：纸箱封箱带（顶/底横带 + 中缝）
    ctx.fillStyle = soft;
    ctx.fillRect(0, 34, 256, 22);
    ctx.fillRect(0, 200, 256, 22);
    ctx.fillRect(118, 0, 20, 256);
  }
  // A restrained mottled base breaks the computer-perfect flat fill without
  // changing the packaging-category colour carried by the instance.
  for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 16) {
    const variation = ((x * 17 + y * 31 + key.length * 13) % 19) / 19;
    ctx.fillStyle = `rgba(38,45,48,${(0.012 + variation * 0.018).toFixed(3)})`;
    ctx.fillRect(x, y, 16, 16);
  }
  const texture = finishSharedTexture(new THREE.CanvasTexture(canvas), { color: true });
  cargoPatternCache.set(key, texture);
  return texture;
}

// Shared PBR surface maps. The colour texture communicates package identity;
// roughness and bump retain real material response when analysis tint is active.
export function cargoSurfaceTextures(pattern) {
  const key = pattern || 'bands';
  if (cargoSurfaceCache.has(key)) return cargoSurfaceCache.get(key);
  const roughnessCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  roughnessCanvas.width = bumpCanvas.width = 128;
  roughnessCanvas.height = bumpCanvas.height = 128;
  const roughness = roughnessCanvas.getContext('2d');
  const bump = bumpCanvas.getContext('2d');
  const fibrous = ['bands', 'slats', 'grid', 'woven'].includes(key);
  const glossy = ['wrap', 'rings', 'vents'].includes(key);
  for (let y = 0; y < 128; y += 4) for (let x = 0; x < 128; x += 4) {
    const hash = (x * 29 + y * 47 + key.length * 23) % 37;
    const grain = hash / 36;
    const roughValue = Math.round((glossy ? 112 : fibrous ? 205 : 174) + (grain - 0.5) * 34);
    const bumpValue = Math.round(116 + grain * 32);
    roughness.fillStyle = `rgb(${roughValue},${roughValue},${roughValue})`;
    roughness.fillRect(x, y, 4, 4);
    bump.fillStyle = `rgb(${bumpValue},${bumpValue},${bumpValue})`;
    bump.fillRect(x, y, 4, 4);
  }
  const surface = {
    map: cargoPatternTexture(key),
    roughnessMap: finishSharedTexture(new THREE.CanvasTexture(roughnessCanvas)),
    bumpMap: finishSharedTexture(new THREE.CanvasTexture(bumpCanvas))
  };
  cargoSurfaceCache.set(key, surface);
  return surface;
}

// V2.5 包装外观的 PBR 材质参数（粗糙度/金属度）。
export function getMaterialProps(appearanceKey) {
  switch (appearanceKey) {
    case 'crate':          return { roughness: 0.92, metalness: 0.02, bumpScale: 0.024 };
    case 'palletized':     return { roughness: 0.82, metalness: 0.03, bumpScale: 0.018 };
    case 'wrapped':        return { roughness: 0.34, metalness: 0.02, bumpScale: 0.008, clearcoat: 0.18 };
    case 'equipment_case': return { roughness: 0.38, metalness: 0.36, bumpScale: 0.01, clearcoat: 0.08 };
    case 'drum':           return { roughness: 0.32, metalness: 0.64, bumpScale: 0.008, clearcoat: 0.1 };
    case 'fibc':           return { roughness: 0.96, metalness: 0, bumpScale: 0.032 };
    case 'generic':        return { roughness: 0.74, metalness: 0.08, bumpScale: 0.016 };
    default:               return { roughness: 0.85, metalness: 0.03, bumpScale: 0.02 };
  }
}
