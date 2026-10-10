import { cargoFingerprint, cargoTotals } from '../cargo/cargo.js';
import { containerVolume } from './catalog.js';
import { getPlanSourceLabel, PLAN_SOURCE_CODES } from '../provenance/planSource.js';

const COLORS = Object.freeze([
  '#3b6fa0', '#2d8a5e', '#c2760f', '#6b4d8c', '#9e3e3e',
  '#2d8a8a', '#b8920a', '#c45a3e', '#3e4d8a', '#2a6b3f',
  '#8c3e7a', '#4a6e8a', '#6b7a2a', '#7a2e4e', '#5a6b4a'
]);

export function generateLocalPreview(cargoList = [], container) {
  const startedAt = Date.now();
  if (!container) {
    return emptyPreview('missing-container', cargoList, container);
  }

  const groups = cargoList
    .map((cargo, index) => ({
      cargo,
      index,
      quantity: Math.max(1, Number(cargo.quantity || 1)),
      volume: Number(cargo.length || 0) * Number(cargo.width || 0) * Number(cargo.height || 0),
      sku: cargo.sku || cargo.name || `SKU-${index + 1}`
    }))
    .sort((a, b) => {
      const portDelta = Number(a.cargo.portSequence || 1) - Number(b.cargo.portSequence || 1);
      if (portDelta !== 0) return portDelta;
      if (b.volume !== a.volume) return b.volume - a.volume;
      return Number(b.cargo.weight || 0) - Number(a.cargo.weight || 0);
    });

  const loadedCargo = [];
  const unloadedCargo = [];
  let cursorFromDeepEnd = 0;
  let loadingIndex = 0;
  const partialFloorSlices=[];

  for (const group of groups) {
    const orientation = chooseOrientation(group, container);
    if (!orientation) {
      appendUnloaded(unloadedCargo, group, group.quantity, 'OVERSIZE_OR_UNSUPPORTED_ORIENTATION');
      continue;
    }
    const positions = buildSlicePositions(orientation, group.cargo, container);
    if (!positions.length) {
      appendUnloaded(unloadedCargo, group, group.quantity, 'NO_CROSS_SECTION_CAPACITY');
      continue;
    }

    let remaining = group.quantity;
    // Reuse unoccupied floor lanes in an equal-depth, same-port slice.
    // Separate SKUs need not consume separate full-width container walls.
    for(const slice of partialFloorSlices){
      if(slice.port!==Number(group.cargo.portSequence||1) || slice.l!==orientation.l)continue;
      for(const position of positions.filter(p=>p.y===0)){
        if(!remaining)break;
        const x=container.innerLength-slice.cursor-orientation.l;
        const overlap=loadedCargo.some(c=>c.x<x+orientation.l && c.x+c.l>x && c.y<orientation.h && c.z<position.z+orientation.w && c.z+c.w>position.z);
        if(overlap)continue;
        loadedCargo.push(makeLoadedItem(group,orientation,position,slice.cursor,container,++loadingIndex));remaining--;
      }
    }
    while (remaining > 0) {
      if (cursorFromDeepEnd + orientation.l > container.innerLength) {
        appendUnloaded(unloadedCargo, group, remaining, 'INSUFFICIENT_LENGTH');
        break;
      }
      for (const position of positions) {
        if (remaining <= 0) break;
        loadingIndex += 1;
        loadedCargo.push(makeLoadedItem(group, orientation, position, cursorFromDeepEnd, container, loadingIndex));
        remaining -= 1;
      }
      partialFloorSlices.push({cursor:cursorFromDeepEnd,l:orientation.l,port:Number(group.cargo.portSequence||1)});
      cursorFromDeepEnd += orientation.l;
    }
  }

  centerAlongLength(loadedCargo, container);
  const total = cargoTotals(cargoList);
  const loadedVolume = loadedCargo.reduce((sum, item) => sum + item.l * item.w * item.h, 0);
  const totalWeight = loadedCargo.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const cog = calculateCog(loadedCargo, totalWeight);
  const cogOffset = calculateCogOffset(cog, container);
  const fingerprint = cargoFingerprint(cargoList, container.typeId);

  return {
    planId: `LOCAL_${fingerprint}`,
    source: 'local-preview',
    sourceCode: PLAN_SOURCE_CODES.LOCAL_PREVIEW,
    sourceLabel: getPlanSourceLabel(PLAN_SOURCE_CODES.LOCAL_PREVIEW),
    containerInfo: { ...container },
    loadedCargo,
    unloadedCargo,
    totalCargoInput: total.pieces,
    totalCargoCount: loadedCargo.length,
    totalWeight,
    spaceUtilization: containerVolume(container) > 0 ? Math.min(100, (loadedVolume / containerVolume(container)) * 100) : 0,
    cog,
    cogOffset,
    metrics: {
      algorithm_id: 'local-block-preview',
      strategy_family: 'deterministic-preview',
      strategy_used: 'local-block-preview',
      elapsed_ms: Date.now() - startedAt,
      collision_count: 0,
      overflow_count: 0
    },
    constraintMeta: {
      cogNormalization: 'CARGO_COG_FULL_INNER_SPAN_V1',
      lifoCompliant: validateLifo(loadedCargo),
      doorSide: 'higher x coordinate',
      deepestSide: 'lower x coordinate',
      previewOnly: true,
      fillPolicy: 'no-gap-fill-in-preview'
    },
    warnings: unloadedCargo.length
      ? [{ type: 'LOCAL_PREVIEW_PARTIAL', message: `${unloadedCargo.length} 件未装入` }]
      : [],
    inputFingerprint: fingerprint,
    timestamp: new Date().toISOString()
  };
}

function emptyPreview(reason, cargoList, container) {
  return {
    planId: `LOCAL_${reason}`,
    source: 'local-preview',
    sourceCode: PLAN_SOURCE_CODES.LOCAL_PREVIEW,
    sourceLabel: getPlanSourceLabel(PLAN_SOURCE_CODES.LOCAL_PREVIEW),
    containerInfo: container || null,
    loadedCargo: [],
    unloadedCargo: [],
    totalCargoInput: cargoTotals(cargoList).pieces,
    totalCargoCount: 0,
    totalWeight: 0,
    spaceUtilization: 0,
    cog: { x: 0, y: 0, z: 0 },
    cogOffset: { lateral: 0, longitudinal: 0, direction: 'center' },
    metrics: { algorithm_id: 'local-block-preview', elapsed_ms: 0 },
    constraintMeta: { lifoCompliant: true, doorSide: 'higher x coordinate', previewOnly: true },
    warnings: [{ type: 'PREVIEW_UNAVAILABLE', message: reason }],
    inputFingerprint: cargoFingerprint(cargoList, container?.typeId || '')
  };
}

function chooseOrientation(group, container) {
  let best = null;
  for (const candidate of orientationCandidates(group.cargo)) {
    if (candidate.l > container.innerLength || candidate.w > container.innerWidth || candidate.h > container.innerHeight) continue;
    const positions = buildSlicePositions(candidate, group.cargo, container);
    if (!positions.length) continue;
    const slices = Math.ceil(group.quantity / positions.length);
    const requiredLength = slices * candidate.l;
    const crossFill = (positions.length * candidate.w * candidate.h) / (container.innerWidth * container.innerHeight);
    const score = requiredLength - crossFill * 100;
    if (!best || score < best.score) best = { ...candidate, score };
  }
  return best;
}

function orientationCandidates(cargo) {
  const values = [
    { l: cargo.length, w: cargo.width, h: cargo.height, label: 'XYZ' }
  ];
  if (cargo.canRotate !== false) {
    values.push({ l: cargo.width, w: cargo.length, h: cargo.height, label: 'YXZ' });
  }
  if (cargo.canLayFlat) {
    values.push({ l: cargo.length, w: cargo.height, h: cargo.width, label: 'XZY' });
    if (cargo.canRotate !== false) {
      values.push(
        { l: cargo.width, w: cargo.height, h: cargo.length, label: 'YZX' },
        { l: cargo.height, w: cargo.length, h: cargo.width, label: 'ZXY' },
        { l: cargo.height, w: cargo.width, h: cargo.length, label: 'ZYX' }
      );
    }
  }
  const seen = new Set();
  return values.filter((item) => {
    if (item.l <= 0 || item.w <= 0 || item.h <= 0) return false;
    const key = `${item.l}-${item.w}-${item.h}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSlicePositions(dims, cargo, container) {
  const widthCount = Math.floor(container.innerWidth / dims.w);
  let heightCount = Math.floor(container.innerHeight / dims.h);
  if (!cargo.stackable || cargo.fragile) heightCount = 1;
  else heightCount = Math.min(heightCount, Math.max(1, Number(cargo.maxStackLayers || 1)));
  if (widthCount <= 0 || heightCount <= 0) return [];

  const startZ = (container.innerWidth - widthCount * dims.w) / 2;
  const zPositions = Array.from({ length: widthCount }, (_, index) => startZ + index * dims.w);
  const center = container.innerWidth / 2;
  zPositions.sort((a, b) => Math.abs(a + dims.w / 2 - center) - Math.abs(b + dims.w / 2 - center));
  const positions = [];
  for (let layer = 0; layer < heightCount; layer += 1) {
    for (const z of zPositions) positions.push({ y: layer * dims.h, z });
  }
  return positions;
}

function makeLoadedItem(group, dims, position, cursorFromDeepEnd, container, loadingIndex) {
  const cargo = group.cargo;
  return {
    ...cargo,
    quantity:1,
    loadingIndex,
    cargoId: `${cargo.cargoId}_${loadingIndex}`,
    name: cargo.name,
    sku: group.sku,
    x: container.innerLength - (cursorFromDeepEnd + dims.l),
    y: position.y,
    z: position.z,
    l: dims.l,
    h: dims.h,
    w: dims.w,
    color: COLORS[group.index % COLORS.length],
    type: cargo.fragile ? 'fragile' : cargo.heavy ? 'heavy' : 'normal',
    packagingType: cargo.packagingType,
    handlingMethod: cargo.handlingMethod || 'forklift',
    weight: cargo.weight,
    fragile: cargo.fragile,
    heavy: cargo.heavy,
    wooden: cargo.wooden,
    dangerous: cargo.dangerous,
    stackable: cargo.stackable,
    maxStackLayers: cargo.maxStackLayers,
    batchId: `batch_${cargo.portSequence || 1}`,
    batchKey: `batch_${cargo.portSequence || 1}`,
    batchLabel: cargo.destinationPort ? `${cargo.destinationPort}${cargo.eta ? ` · ${cargo.eta}` : ''}` : `批次 ${cargo.portSequence || 1}`,
    destinationPort: cargo.destinationPort,
    eta: cargo.eta,
    portSequence: cargo.portSequence || 1,
    algorithmMeta: {
      source: 'local-preview',
      orientation: dims.label,
      blockPacked: true,
      handlingMode: cargo.handlingMethod
    }
  };
}

function appendUnloaded(target, group, quantity, reason) {
  for (let index = 0; index < quantity; index += 1) {
    target.push({ ...group.cargo, cargoId: `${group.cargo.cargoId}_unloaded_${index + 1}`, quantity: 1, reason });
  }
}

function centerAlongLength(loadedCargo, container) {
  if (!loadedCargo.length) return;
  const minX = Math.min(...loadedCargo.map((item) => item.x));
  const maxX = Math.max(...loadedCargo.map((item) => item.x + item.l));
  const used = maxX - minX;
  if (used >= container.innerLength - 1) return;
  const delta = (container.innerLength - used) / 2 - minX;
  for (const item of loadedCargo) {
    item.x += delta;
    item.algorithmMeta = { ...item.algorithmMeta, longitudinalCentered: true, securingRequired: 'dunnage-or-lashing' };
  }
}

function calculateCog(items, totalWeight) {
  if (!items.length || totalWeight <= 0) return { x: 0, y: 0, z: 0 };
  const moment = items.reduce((sum, item) => {
    sum.x += (item.x + item.l / 2) * item.weight;
    sum.y += (item.y + item.h / 2) * item.weight;
    sum.z += (item.z + item.w / 2) * item.weight;
    return sum;
  }, { x: 0, y: 0, z: 0 });
  return { x: moment.x / totalWeight, y: moment.y / totalWeight, z: moment.z / totalWeight };
}

function calculateCogOffset(cog, container) {
  if (!cog || (cog.x === 0 && cog.y === 0 && cog.z === 0)) return { lateral: 0, longitudinal: 0, direction: 'center' };
  const lateralRaw = ((cog.z - container.innerWidth / 2) / container.innerWidth) * 100;
  const longitudinalRaw = ((cog.x - container.innerLength / 2) / container.innerLength) * 100;
  return { lateral: Math.abs(lateralRaw), longitudinal: Math.abs(longitudinalRaw), direction: lateralRaw >= 0 ? 'right' : 'left' };
}

function validateLifo(items) {
  const batches = new Map();
  for (const item of items) {
    const sequence = Number(item.portSequence || 1);
    const current = batches.get(sequence) || { minX: Infinity, maxX: -Infinity };
    current.minX = Math.min(current.minX, item.x);
    current.maxX = Math.max(current.maxX, item.x + item.l);
    batches.set(sequence, current);
  }
  const sequences = [...batches.keys()].sort((a, b) => a - b);
  for (let first = 0; first < sequences.length; first += 1) {
    for (let second = first + 1; second < sequences.length; second += 1) {
      if (batches.get(sequences[first]).minX + 1 < batches.get(sequences[second]).maxX) return false;
    }
  }
  return true;
}
