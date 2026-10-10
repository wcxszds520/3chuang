'use strict';

const { analyzeLayoutQuality } = require('./LayoutQualityAnalyzer');
const { normalizeContainer } = require('./PlanMetrics');

const VOID_CLASSES = Object.freeze([
  'USABLE_RESERVE',
  'PORT_ACCESS',
  'SECURING_SPACE',
  'DOOR_CLEARANCE',
  'STRUCTURAL_CLEARANCE',
  'NON_STACKABLE_HEADSPACE',
  'UNASSESSED_RESERVE',
  'GEOMETRIC_RESIDUAL',
  'UNEXPLAINED_VOID'
]);

const LABELS = Object.freeze({
  USABLE_RESERVE: '可用预留',
  PORT_ACCESS: '港序作业通道',
  SECURING_SPACE: '系固作业区',
  DOOR_CLEARANCE: '门区净空',
  STRUCTURAL_CLEARANCE: '结构净空',
  NON_STACKABLE_HEADSPACE: '不可堆叠货物上方空间',
  UNASSESSED_RESERVE: '外部连通余隙 · 用途未核实',
  GEOMETRIC_RESIDUAL: '几何余隙',
  UNEXPLAINED_VOID: '未解释剩余空间'
});

/**
 * Every material void receives an explicit reason. Only UNEXPLAINED_VOID is a
 * layout defect; reserve and operational clearances are never advertised as
 * utilization improvements.
 */
function analyzeVoidJustification({ placements = [], cargoList = [], container: containerInput = {}, layoutQuality = null, route = [], securing = null, policy = {} } = {}) {
  const container = normalizeContainer(containerInput);
  const layout = layoutQuality || analyzeLayoutQuality({ placements, cargoList, container });
  const minimumReportedVolume = positive(policy.minimumReportedVolume, 1_000_000);
  const minimumLargeVolume = positive(policy.minimumLargeVolume, 25_000_000);
  const internal = layout.voidRegions?.internal || [];
  const reserve = layout.voidRegions?.reserve || [];
  const portCount = new Set([
    ...route.map((entry) => number(entry.portSequence || entry.sequence)),
    ...placements.map((entry) => number(entry.portSequence || 1))
  ].filter((entry) => entry > 0)).size;
  const zones = [];

  for (const [index, region] of internal.entries()) {
    if (number(region.volume) < minimumReportedVolume) continue;
    const classification = classifyInternal(region, { container, portCount, securing });
    const zone = buildZone({
      id: `VOID-I-${String(index + 1).padStart(3, '0')}`,
      region,
      classification,
      placements,
      cargoList,
      container,
      minimumLargeVolume
    });
    zones.push(...partitionNoStackHeadspace(zone, placements));
  }
  for (const [index, region] of reserve.entries()) {
    if (number(region.volume) < minimumReportedVolume) continue;
    // Connectivity to the door does not prove this whole (often non-convex)
    // component is a required port corridor or usable additional cargo space.
    const classification = 'UNASSESSED_RESERVE';
    zones.push(buildZone({
      id: `VOID-R-${String(index + 1).padStart(3, '0')}`,
      region,
      classification,
      placements,
      cargoList,
      container,
      minimumLargeVolume
    }));
  }

  const representedInternalVolume = internal.reduce((sum, region) => sum + number(region.volume), 0);
  const fragmentedRemainder = Math.max(0, number(layout.internalVoidVolume) - representedInternalVolume);
  if (fragmentedRemainder >= minimumReportedVolume) {
    zones.push({
      id: 'VOID-X-CROSS-SECTION',
      classification: 'UNEXPLAINED_VOID',
      label: LABELS.UNEXPLAINED_VOID,
      volume: fragmentedRemainder,
      volumeM3: round(fragmentedRemainder / 1e9),
      isLarge: fragmentedRemainder >= minimumLargeVolume,
      dimensions: null,
      boundsMm: layout.bounds || null,
      linkedCargoIds: [],
      refillPotential: 'CROSS_SECTION_LOCAL_REPAIR_CANDIDATE',
      securingNeed: null,
      reason: '横截面填充谷值无法由连通网格中的作业预留或结构净空解释。',
      dataClassification: 'DETERMINISTIC_GEOMETRIC_ANALYSIS'
    });
  }

  zones.sort((left, right) => number(right.volume) - number(left.volume) || left.id.localeCompare(right.id));
  const byClass = Object.fromEntries(VOID_CLASSES.map((classification) => [classification, summarizeClass(zones, classification)]));
  const unexplained = zones.filter((zone) => zone.classification === 'UNEXPLAINED_VOID');
  const largeZones = zones.filter((zone) => zone.isLarge);
  const allLargeVoidsJustified = largeZones.every((zone) => !['UNEXPLAINED_VOID', 'UNASSESSED_RESERVE'].includes(zone.classification));
  return {
    model: 'PORTCUBE_VOID_JUSTIFICATION_V2_5',
    exactGeometry: layout.exactVoidGeometry || null,
    dataClassification: 'PROJECT_GEOMETRIC_ANALYSIS',
    policy: { minimumReportedVolume, minimumLargeVolume, doorSide: 'HIGH_X' },
    allLargeVoidsJustified,
    largeVoidCount: largeZones.length,
    zoneCount: zones.length,
    zones,
    byClass,
    explainedVoidVolume: zones.filter((zone) => !['UNEXPLAINED_VOID', 'UNASSESSED_RESERVE'].includes(zone.classification)).reduce((sum, zone) => sum + number(zone.volume), 0),
    unassessedReserveVolume: byClass.UNASSESSED_RESERVE.volume,
    analysisRevision: '2.5.1-constraint-headspace',
    unexplainedVoidVolume: unexplained.reduce((sum, zone) => sum + number(zone.volume), 0),
    unexplainedVoidRatio: safeDivide(unexplained.reduce((sum, zone) => sum + number(zone.volume), 0), container.innerLength * container.innerWidth * container.innerHeight),
    maxUnexplainedGapMm: unexplained.reduce((max, zone) => Math.max(max, zoneGap(zone)), number(layout.maxInteriorGap)),
    largestUnexplainedZone: unexplained[0] || null,
    repairCandidateCargoIds: unique(unexplained.flatMap((zone) => zone.linkedCargoIds)).slice(0, 30),
    verdict: unexplained.length === 0 ? 'ALL_MATERIAL_VOIDS_EXPLAINED' : 'UNEXPLAINED_LAYOUT_VOID_PRESENT'
  };
}

function classifyInternal(region, { container, portCount, securing }) {
  const dims = region.dimensions || {};
  const smallest = Math.min(number(dims.l), number(dims.w), number(dims.h));
  const doorDepth = Math.max(0, container.innerLength - number(region.boundsMm?.minX));
  if (region.touchesDoor && doorDepth <= 600 && number(dims.h) <= 500) return 'DOOR_CLEARANCE';
  if (region.touchesDoor && portCount > 1) return 'PORT_ACCESS';
  if (region.touchesTop && number(dims.h) <= 250) return 'STRUCTURAL_CLEARANCE';
  if (region.canFitCargo !== true) return 'GEOMETRIC_RESIDUAL';
  if (smallest <= 180 && securing?.status === 'SECURING_REQUIRED') return 'SECURING_SPACE';
  return 'UNEXPLAINED_VOID';
}

function buildZone({ id, region, classification, placements, cargoList, container, minimumLargeVolume }) {
  const linkedCargoIds = adjacentCargoIds(region, placements, 180);
  const fitting = fittingCargoIds(region, cargoList).slice(0, 8);
  return {
    id,
    classification,
    label: LABELS[classification],
    volume: number(region.volume),
    volumeM3: round(number(region.volume) / 1e9),
    isLarge: number(region.volume) >= minimumLargeVolume,
    dimensions: region.dimensions || null,
    boundsMm: region.boundsMm || null,
    touchesDoor: region.touchesDoor === true,
    touchesTop: region.touchesTop === true,
    linkedCargoIds,
    refillPotential: classification === 'UNEXPLAINED_VOID'
      ? (fitting.length > 0 ? { status: 'BOUNDING_BOX_FIT_ONLY', cargoIds: fitting, limitation: '仅比较外接包络；未验证支撑、禁压、港序和搬运路径，不代表可以回填。' } : { status: 'NO_CURRENT_CARGO_FITS' })
      : { status: 'NOT_TARGETED', reason: classification },
    securingNeed: classification === 'SECURING_SPACE' ? '保留用于挡木、填充或系固布置；能力值仍需现场参数。' : null,
    reason: reasonFor(classification, { portCount: new Set(placements.map((item) => number(item.portSequence || 1))).size, container }),
    dataClassification: 'DETERMINISTIC_GEOMETRIC_ANALYSIS'
  };
}

function adjacentCargoIds(region, placements, tolerance) {
  const bounds = region.boundsMm;
  if (!bounds) return [];
  return unique(placements.filter((item) => {
    const itemBounds = {
      minX: number(item.x), maxX: number(item.x) + number(item.l),
      minY: number(item.y), maxY: number(item.y) + number(item.h),
      minZ: number(item.z), maxZ: number(item.z) + number(item.w)
    };
    return distanceBetweenBoxes(bounds, itemBounds) <= tolerance;
  }).map((item) => item.cargoId)).slice(0, 30);
}

function fittingCargoIds(region, cargoList) {
  const dimensions = region.dimensions || {};
  return cargoList.filter((cargo) => {
    const variants = cargo.cargoPhysicalProfile?.solverEnvelope?.allowedOrientations || [
      { l: number(cargo.length), w: number(cargo.width), h: number(cargo.height) },
      { l: number(cargo.width), w: number(cargo.length), h: number(cargo.height) }
    ];
    return variants.some((variant) => number(variant.l) <= number(dimensions.l) + 0.001
      && number(variant.w) <= number(dimensions.w) + 0.001
      && number(variant.h) <= number(dimensions.h) + 0.001);
  }).map((cargo) => cargo.cargoId || cargo.id || cargo.sku).filter(Boolean);
}

function distanceBetweenBoxes(a, b) {
  const dx = Math.max(0, number(a.minX) - number(b.maxX), number(b.minX) - number(a.maxX));
  const dy = Math.max(0, number(a.minY) - number(b.maxY), number(b.minY) - number(a.maxY));
  const dz = Math.max(0, number(a.minZ) - number(b.maxZ), number(b.minZ) - number(a.maxZ));
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function reasonFor(classification, context) {
  return ({
    USABLE_RESERVE: '位于当前装载包络之外，作为未占用连续预留空间单独披露。',
    PORT_ACCESS: `门侧连续空间服务于 ${Math.max(2, context.portCount)} 港序提取路径，不计为未解释剩余空间。`,
    SECURING_SPACE: '窄带空间与当前几何系固需求相邻，保留为填充、挡固或绑扎操作区。',
    DOOR_CLEARANCE: '位于高 X 门侧的低矮净空，保留装卸工具与门区操作余量。',
    STRUCTURAL_CLEARANCE: '贴近箱顶的不可用薄层，按结构净空披露。',
    UNASSESSED_RESERVE: '与外部连通的未占用空间；连通区域的外接框不等于可用空箱，尚无证据将整区认定为港序通道、系固预留或可补货空间。',
    GEOMETRIC_RESIDUAL: '当前任何合法货物朝向均无法放入该连通余隙。',
    UNEXPLAINED_VOID: '网格或横截面识别的余隙；包络尺寸匹配不代表可放置，仍需支撑、禁压、港序与路径验证。'
  })[classification];
}

// Only partition rectangular empty components. A connected component's AABB
// can contain cargo: never paint or subtract that entire AABB as empty volume.
function partitionNoStackHeadspace(zone, placements) {
  if (zone.classification !== 'UNEXPLAINED_VOID' || !zone.boundsMm) return [zone];
  const b = zone.boundsMm;
  const volume = bounds => Math.max(0, bounds.maxX-bounds.minX) * Math.max(0, bounds.maxY-bounds.minY) * Math.max(0, bounds.maxZ-bounds.minZ);
  if (Math.abs(volume(b)-zone.volume) > 1) return [zone];
  const cuts = [];
  for (const item of placements.filter(c => c.stackable === false)) {
    const cut = { minX: Math.max(b.minX, number(item.x)), maxX: Math.min(b.maxX, number(item.x)+number(item.l)),
      minZ: Math.max(b.minZ, number(item.z)), maxZ: Math.min(b.maxZ, number(item.z)+number(item.w)),
      minY: Math.max(b.minY, number(item.y)+number(item.h)), maxY: b.maxY };
    if (volume(cut) <= 0) continue;
    const intersects = (a, c) => a.minX<c.maxX && a.maxX>c.minX && a.minY<c.maxY && a.maxY>c.minY && a.minZ<c.maxZ && a.maxZ>c.minZ;
    if (cuts.some(c=>intersects(c.boundsMm,cut)) || placements.some(c => intersects(cut, {
      minX:number(c.x),maxX:number(c.x)+number(c.l),minY:number(c.y),maxY:number(c.y)+number(c.h),minZ:number(c.z),maxZ:number(c.z)+number(c.w)
    }))) continue;
    cuts.push({ ...zone, id: `${zone.id}-NOSTACK-${item.cargoId}`, parentZoneId: zone.id,
      classification: 'NON_STACKABLE_HEADSPACE', label: LABELS.NON_STACKABLE_HEADSPACE,
      boundsMm: cut, dimensions: { l:cut.maxX-cut.minX,w:cut.maxZ-cut.minZ,h:cut.maxY-cut.minY },
      volume:volume(cut),volumeM3:round(volume(cut)/1e9),linkedCargoIds:[item.cargoId],
      refillPotential:{status:'REQUIRES_INDEPENDENT_SUPPORT',constraintField:'stackable',value:false},
      reason:`${item.cargoId} 的 stackable=false；该精确空柱位于其顶部。直接放置会触发禁压或无支撑，独立承载结构尚未提供。`
    });
  }
  if (!cuts.length) return [zone];
  const remaining = Math.max(0, zone.volume-cuts.reduce((sum,c)=>sum+c.volume,0));
  return [...cuts, ...(remaining > 0 ? [{...zone, volume:remaining,volumeM3:round(remaining/1e9),
    boundsAreEnvelopeOnly:true, reason:'已扣除可证明的不可堆叠顶部空间；剩余含网格边缘误差及未验证余隙，原外接框不是实心空区。'}] : [])];
}

function summarizeClass(zones, classification) {
  const selected = zones.filter((zone) => zone.classification === classification);
  return { classification, label: LABELS[classification], count: selected.length, volume: selected.reduce((sum, zone) => sum + number(zone.volume), 0) };
}

function zoneGap(zone) { return Math.max(number(zone.dimensions?.l), number(zone.dimensions?.w), number(zone.dimensions?.h)); }
function unique(values) { return [...new Set(values.map(String))]; }
function positive(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function safeDivide(left, right) { return right > 0 ? left / right : 0; }
function round(value) { return Math.round(number(value) * 1000) / 1000; }

module.exports = { VOID_CLASSES, LABELS, analyzeVoidJustification };
