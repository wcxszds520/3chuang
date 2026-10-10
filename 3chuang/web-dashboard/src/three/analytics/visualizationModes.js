export const VISUALIZATION_MODES = Object.freeze(['normal', 'owner', 'weight', 'port', 'space', 'balance', 'securing', 'risk']);

const PORT_PALETTE = Object.freeze(['#2f6f73', '#c27a2d', '#627f4d', '#7c628c', '#8c5353', '#476b8a']);

export function buildVisualizationContext(items = [], container = {}) {
  const weights = items.map((item) => Number(item.weight)).filter(Number.isFinite);
  const ports = [...new Set(items.map((item) => Number(item.portSequence || 1)))].sort((a, b) => a - b);
  return {
    weightMin: weights.length ? Math.min(...weights) : 0,
    weightMax: weights.length ? Math.max(...weights) : 0,
    portColors: Object.fromEntries(ports.map((port, index) => [port, PORT_PALETTE[index % PORT_PALETTE.length]])),
    ownerColors: Object.fromEntries([...new Set(items.map(item => item.customerId).filter(Boolean))].sort().map((owner, index) => [owner, PORT_PALETTE[index % PORT_PALETTE.length]])),
    balance: calculateBalance(items, container)
  };
}

export function visualizationColor(item, mode, context, fallback = '#6e827a') {
  if (mode === 'owner') return context.ownerColors?.[item.customerId] || fallback;
  if (mode === 'weight') return weightColor(Number(item.weight || 0), context.weightMin, context.weightMax);
  if (mode === 'port') return context.portColors[Number(item.portSequence || 1)] || fallback;
  if (mode === 'risk') return riskColor(item);
  if (mode === 'securing') return item.restraint?.left?.restrained || item.restraint?.right?.restrained ? '#3b7f68' : '#c28a32';
  if (mode === 'space') return '#71807a';
  // Normal mode represents real packaging categories, never arbitrary SKU palette colors.
  return fallback;
}

export function weightColor(weight, min, max) {
  const range = max - min;
  const t = range > 0 ? clamp((weight - min) / range, 0, 1) : 0.5;
  const hue = 198 - t * 166;
  const light = 46 + Math.abs(t - 0.5) * 5;
  return `hsl(${hue.toFixed(1)} 58% ${light.toFixed(1)}%)`;
}

export function riskColor(item) {
  const status = String(item.riskStatus || '').toUpperCase();
  if (status === 'INVALID') return '#a3262d';
  if (status === 'TALL_FREE_STACK') return '#bf4a27';
  if (status === 'STACK_COG_WARNING') return '#d06b2f';
  if (status === 'LOW_SUPPORT_MARGIN') return '#d3902f';
  if (status === 'LOW_RESTRAINT') return '#b6a13a';
  if (status === 'STABLE') return '#559aa0';
  if (item.dangerous === true) return '#a33d35';
  if (item.fragile === true || item.stackable === false) return '#c96b32';
  if (item.heavy === true || item.wooden === true) return '#a68132';
  return '#648f91';
}

export function calculateBalance(items = [], container = {}) {
  const totalWeight = items.reduce((sum, item) => sum + finite(item.weight), 0);
  const geometricCenter = {
    x: finite(container.innerLength) / 2,
    y: finite(container.innerHeight) / 2,
    z: finite(container.innerWidth) / 2
  };
  if (!(totalWeight > 0)) return { totalWeight: 0, geometricCenter, cargoCenter: { ...geometricCenter }, offset: { x: 0, z: 0, lateralPercent: 0, longitudinalPercent: 0 } };
  const cargoCenter = items.reduce((center, item) => {
    const weight = finite(item.weight);
    center.x += (finite(item.x) + finite(item.l, finite(item.length)) / 2) * weight;
    center.y += (finite(item.y) + finite(item.h, finite(item.height)) / 2) * weight;
    center.z += (finite(item.z) + finite(item.w, finite(item.width)) / 2) * weight;
    return center;
  }, { x: 0, y: 0, z: 0 });
  cargoCenter.x /= totalWeight; cargoCenter.y /= totalWeight; cargoCenter.z /= totalWeight;
  const offset = {
    x: cargoCenter.x - geometricCenter.x,
    z: cargoCenter.z - geometricCenter.z
  };
  offset.longitudinalPercent = geometricCenter.x ? offset.x / (geometricCenter.x * 2) * 100 : 0;
  offset.lateralPercent = geometricCenter.z ? offset.z / (geometricCenter.z * 2) * 100 : 0;
  return { totalWeight, geometricCenter, cargoCenter, offset };
}

export function buildDeterministicSpaceCells(items = [], container = {}, grid = { x: 16, y: 5, z: 5 }) {
  const length = finite(container.innerLength);
  const height = finite(container.innerHeight);
  const width = finite(container.innerWidth);
  if (!(length > 0 && height > 0 && width > 0)) return [];
  const size = { x: length / grid.x, y: height / grid.y, z: width / grid.z };
  const cells = [];
  for (let ix = 0; ix < grid.x; ix += 1) for (let iy = 0; iy < grid.y; iy += 1) for (let iz = 0; iz < grid.z; iz += 1) {
    const cell = { x: ix * size.x, y: iy * size.y, z: iz * size.z, l: size.x, h: size.y, w: size.z };
    if (!items.some((item) => boxesIntersect(cell, item))) cells.push(cell);
  }
  return cells;
}

function boxesIntersect(a, b) {
  return finite(a.x) < finite(b.x) + finite(b.l, finite(b.length))
    && finite(a.x) + finite(a.l, finite(a.length)) > finite(b.x)
    && finite(a.y) < finite(b.y) + finite(b.h, finite(b.height))
    && finite(a.y) + finite(a.h, finite(a.height)) > finite(b.y)
    && finite(a.z) < finite(b.z) + finite(b.w, finite(b.width))
    && finite(a.z) + finite(a.w, finite(a.width)) > finite(b.z);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
