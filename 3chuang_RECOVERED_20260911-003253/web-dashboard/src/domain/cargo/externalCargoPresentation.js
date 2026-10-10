export const SEMANTIC_ORIGINS = Object.freeze({
  SOURCE_FACT: 'SOURCE_FACT',
  SOURCE_STRUCTURAL: 'SOURCE_STRUCTURAL',
  PORTCUBE_OPERATION_PROFILE: 'PORTCUBE_OPERATION_PROFILE'
});

const RENAULT_MATERIALS = Object.freeze({
  CARDBOARD: { cargoForm: '纸质包装', packageClass: 'PAPERBOARD_PACKAGING', packageLabel: '纸质包装', visualFamily: 'SOURCE_CARTON', assetKey: 'cargo_carton' },
  WOOD: { cargoForm: '木质包装', packageClass: 'WOOD_PACKAGING', packageLabel: '木质包装', visualFamily: 'SOURCE_WOOD_CRATE', assetKey: 'cargo_crate' },
  WOODEN: { cargoForm: '木质包装', packageClass: 'WOOD_PACKAGING', packageLabel: '木质包装', visualFamily: 'SOURCE_WOOD_CRATE', assetKey: 'cargo_crate' },
  METAL: { cargoForm: '设备运输箱', packageClass: 'METAL_PACKAGING', packageLabel: '金属包装', visualFamily: 'SOURCE_METAL_CASE', assetKey: 'cargo_equipment_case' },
  PLASTIC: { cargoForm: '箱装货物', packageClass: 'PLASTIC_PACKAGING', packageLabel: '塑料包装', visualFamily: 'SOURCE_PLASTIC_BOX', assetKey: null }
});

const VISUAL_LABELS = Object.freeze({
  SOURCE_CARTON: '来源纸质包装外观',
  SOURCE_WOOD_CRATE: '来源木质包装外观',
  SOURCE_METAL_CASE: '来源金属运输箱外观',
  SOURCE_PLASTIC_BOX: '来源塑料包装外观',
  SOURCE_MESH: '来源异形网格',
  SMALL_INDUSTRIAL_UNIT: '小型工业货物',
  STANDARD_INDUSTRIAL_UNIT: '标准工业货物',
  HEAVY_INDUSTRIAL_UNIT: '重型工业货物',
  LONG_INDUSTRIAL_UNIT: '长条工业货物',
  GENERIC_BOX_LIGHT: '轻型通用箱件',
  GENERIC_BOX_STANDARD: '标准通用箱件',
  GENERIC_BOX_REINFORCED: '加固通用箱件',
  GENERIC_BOX_HEAVY: '重型通用箱件',
  GENERIC_REINFORCED_BOX: '加固承压箱件',
  GENERIC_HEAVY_TRANSPORT_BOX: '重型承压运输箱件',
  GENERIC_INDUSTRIAL_UNIT: '通用工业货物'
});

export function createCargoPresentationProfile(item = {}) {
  const source = String(item.externalSource || '');
  const physical = physicalFacts(item);
  const rawMaterial = item.sourceFields?.['Package material'] || item.sourceFields?.packageMaterial || (source.includes('Renault') && item.packagingType === 'CARTON' ? 'CARDBOARD' : source.includes('Renault') && item.packagingType === 'WOOD_CRATE' ? 'WOOD' : '');
  const explicitMaterial = String(rawMaterial).trim().toUpperCase();
  const explicit = RENAULT_MATERIALS[explicitMaterial];
  let profile;

  if (explicit) {
    profile = { ...explicit, semanticOrigin: SEMANTIC_ORIGINS.SOURCE_FACT, sourceMaterial: explicitMaterial };
  } else if (item.geometryType === 'MESH' || source.includes('Irregular')) {
    profile = { cargoForm: '异形货物', packageClass: 'SOURCE_GEOMETRY', packageLabel: '异形货物', visualFamily: 'SOURCE_MESH', assetKey: null, semanticOrigin: SEMANTIC_ORIGINS.SOURCE_STRUCTURAL, sourceMaterial: null };
  } else if (source.includes('WTPACK')) {
    profile = { cargoForm: '承压箱装货物', packageClass: 'BOX_MATERIAL_UNKNOWN', packageLabel: '承压箱装货物', visualFamily: wtpackVisual(physical), assetKey: null, semanticOrigin: SEMANTIC_ORIGINS.SOURCE_STRUCTURAL, sourceMaterial: null };
  } else if (source.includes('THPACK')) {
    profile = { cargoForm: '箱装货物', packageClass: 'BOX_MATERIAL_UNKNOWN', packageLabel: '箱装货物', visualFamily: thpackVisual(physical), assetKey: null, semanticOrigin: SEMANTIC_ORIGINS.SOURCE_STRUCTURAL, sourceMaterial: null };
  } else if (source.startsWith('ORTEC')) {
    profile = { cargoForm: '规则工业货物单元', packageClass: 'INDUSTRIAL_UNIT_MATERIAL_UNKNOWN', packageLabel: '规则工业货物单元', visualFamily: ortecVisual(physical), assetKey: null, semanticOrigin: SEMANTIC_ORIGINS.PORTCUBE_OPERATION_PROFILE, sourceMaterial: null };
  } else {
    profile = { cargoForm: '工业货物单元', packageClass: 'MATERIAL_UNKNOWN', packageLabel: '工业货物单元', visualFamily: 'GENERIC_INDUSTRIAL_UNIT', assetKey: null, semanticOrigin: SEMANTIC_ORIGINS.PORTCUBE_OPERATION_PROFILE, sourceMaterial: null };
  }

  return {
    schemaVersion: '1.0',
    displayName: item.name || `工业货物 ${item.externalItemId || ''}`.trim(),
    ...profile,
    visualLabel: VISUAL_LABELS[profile.visualFamily] || '通用工业货物',
    sizeClass: sizeClass(physical),
    massClass: massClass(physical.weightKg),
    physicalBasis: physical,
    constraintSummary: createConstraintSummary(item)
  };
}

export function createOperationalHandlingProfile(item = {}, presentation = createCargoPresentationProfile(item)) {
  const facts = presentation.physicalBasis || physicalFacts(item);
  const palletEvidence = item.palletAttached === true || /pallet|托盘/i.test(String(item.transportUnit || ''));
  const forkFact = item.forkEntry || null;
  const regular = item.geometryType !== 'MESH';
  const base = {
    schemaVersion: '1.0',
    semanticOrigin: SEMANTIC_ORIGINS.PORTCUBE_OPERATION_PROFILE,
    handlingBasis: { weightKg: facts.weightKg, longestEdgeMm: facts.longestEdgeMm, volumeM3: facts.volumeM3, cargoForm: presentation.cargoForm, palletEvidence, irregular: !regular },
    requiresSupportBase: palletEvidence ? true : null,
    forkInterfaceStatus: forkFact ? 'SOURCE_CONFIRMED' : 'UNKNOWN_REQUIRES_OPERATION_CONFIRMATION',
    forkEntry: forkFact,
    palletCompatibility: palletEvidence ? 'SOURCE_CONFIRMED' : 'UNKNOWN',
    palletJackCompatible: palletEvidence ? true : null
  };

  if (!regular && facts.weightKg == null) {
    return { ...base, primaryMethod: 'MECHANICAL_PENDING', preferredEquipment: null, requiresMechanicalAid: true, displayLabel: '机械搬运方式待实物参数确认', manualHandlingClass: 'NOT_ASSESSED', reasonCodes: ['IRREGULAR_GEOMETRY', 'MASS_NOT_PROVIDED'], interfaceNote: '吊点、叉取或托举接口需实物确认' };
  }
  if (palletEvidence) {
    return { ...base, primaryMethod: 'PALLET_JACK', preferredEquipment: 'PALLET_JACK', requiresMechanicalAid: true, displayLabel: '地牛优先', manualHandlingClass: 'NOT_RECOMMENDED', reasonCodes: ['SOURCE_PALLET_OR_COMPATIBLE_BASE'], interfaceNote: forkFact ? '使用来源确认的搬运接口' : '托盘底部通道需作业确认' };
  }
  const manualCandidate = facts.weightKg != null && facts.weightKg <= 12 && facts.longestEdgeMm <= 650 && facts.volumeM3 <= 0.12 && item.dangerous !== true;
  if (manualCandidate) {
    return { ...base, primaryMethod: 'MANUAL', preferredEquipment: null, requiresMechanicalAid: false, displayLabel: '人工优先', manualHandlingClass: 'LOW_RISK_SCREEN_CANDIDATE', reasonCodes: ['LOW_MASS', 'COMPACT_ENVELOPE', 'REGULAR_FORM'], interfaceNote: '仍需结合抓持、频次、距离与现场条件复核' };
  }
  if (facts.weightKg == null) {
    return { ...base, primaryMethod: 'MECHANICAL_PENDING', preferredEquipment: facts.longestEdgeMm >= 900 ? 'FORKLIFT' : null, requiresMechanicalAid: facts.longestEdgeMm >= 900 ? true : null, displayLabel: facts.longestEdgeMm >= 900 ? '机械搬运优先 · 重量待确认' : '搬运方式待重量确认', manualHandlingClass: 'NOT_ASSESSED', reasonCodes: ['MASS_NOT_PROVIDED', facts.longestEdgeMm >= 900 ? 'BULKY_ENVELOPE' : 'PHYSICAL_REVIEW_REQUIRED'].filter(Boolean), interfaceNote: '叉取/托举接口需作业确认' };
  }
  const forkliftPreferred = facts.weightKg >= 60 || facts.longestEdgeMm >= 1200 || facts.volumeM3 >= 0.7;
  return {
    ...base,
    primaryMethod: 'MECHANICAL_AID',
    preferredEquipment: forkliftPreferred ? 'FORKLIFT' : 'LIFT_ASSIST',
    requiresMechanicalAid: true,
    displayLabel: forkliftPreferred ? '叉车优先' : '机械辅助',
    manualHandlingClass: 'MECHANICAL_REVIEW_RECOMMENDED',
    reasonCodes: [facts.weightKg >= 60 ? 'HIGH_MASS' : null, facts.longestEdgeMm >= 1200 ? 'LONG_EDGE' : null, facts.volumeM3 >= 0.7 ? 'BULKY_ENVELOPE' : null, !forkliftPreferred ? 'MANUAL_SCREEN_NOT_MET' : null].filter(Boolean),
    interfaceNote: forkFact ? '使用来源确认的叉取接口' : '叉取/托举接口需作业确认'
  };
}

export function createConstraintSummary(item = {}) {
  const source = String(item.externalSource || '');
  const orientation = item.orientationConstraints || {};
  const entries = [];
  if (orientation.containerAxisAlignment === 'LENGTHWISE') entries.push('沿柜长固定 · 已记录');
  else if (orientation.containerAxisAlignment === 'WIDTHWISE') entries.push('沿柜宽固定 · 已记录');
  else if (orientation.mode === 'FREE') entries.push('自由摆放');
  else if (['x', 'y', 'z'].some((axis) => orientation[axis] === true)) {
    const axes = ['x', 'y', 'z'].filter((axis) => orientation[axis] === true).map((axis) => axis.toUpperCase());
    entries.push(`绕${axes.join('/')}轴可旋转`);
  } else if (['lengthVertical', 'widthVertical', 'heightVertical'].some((key) => orientation[key] === true)) {
    const labels = [['lengthVertical', '长度'], ['widthVertical', '宽度'], ['heightVertical', '高度']].filter(([key]) => orientation[key] === true).map(([, label]) => label);
    entries.push(`${labels.join('/')}可竖直`);
  }
  if (item.stackingGroup != null) entries.push(`堆叠组 ${item.stackingGroup}`);
  if (item.alwaysOnTop === true) entries.push('必须上层');
  if (item.alwaysOnBottom === true) entries.push('必须底层');
  if (item.loadBearing && item.loadBearingUnit) entries.push('朝向相关承压');
  if (item.geometryType === 'MESH') entries.push(`来源 ${item.sourceGeometryMetadata?.format || 'mesh'} 几何`);
  if (!entries.length) entries.push(source.includes('THPACK') || source.includes('WTPACK') ? '竖直方向按来源记录' : '无额外来源约束');
  return {
    semanticOrigin: SEMANTIC_ORIGINS.SOURCE_FACT,
    entries,
    primary: entries.slice(0, 2).join(' · '),
    secondary: entries.slice(2).join(' · '),
    loadBearingDetail: item.loadBearing && item.loadBearingUnit ? { ...item.loadBearing, unit: item.loadBearingUnit } : null
  };
}

function physicalFacts(item) {
  const dimensions = [item.lengthMm, item.widthMm, item.heightMm].map(Number);
  const valid = dimensions.every((value) => Number.isFinite(value) && value > 0);
  const sorted = valid ? [...dimensions].sort((a, b) => a - b) : [];
  return {
    lengthMm: valid ? dimensions[0] : null,
    widthMm: valid ? dimensions[1] : null,
    heightMm: valid ? dimensions[2] : null,
    weightKg: Number.isFinite(item.weightKg) ? item.weightKg : null,
    volumeM3: valid ? dimensions.reduce((value, dimension) => value * dimension, 1) / 1e9 : null,
    longestEdgeMm: valid ? sorted[2] : null,
    aspectRatio: valid && sorted[0] > 0 ? sorted[2] / sorted[0] : null
  };
}

function ortecVisual(facts) {
  if (facts.aspectRatio >= 3 || (facts.longestEdgeMm >= 1400 && facts.aspectRatio >= 2)) return 'LONG_INDUSTRIAL_UNIT';
  if (facts.weightKg >= 100 || facts.volumeM3 >= 0.7) return 'HEAVY_INDUSTRIAL_UNIT';
  if (facts.weightKg <= 12 && facts.longestEdgeMm <= 650 && facts.volumeM3 <= 0.12) return 'SMALL_INDUSTRIAL_UNIT';
  return 'STANDARD_INDUSTRIAL_UNIT';
}

function thpackVisual(facts) {
  if (facts.aspectRatio >= 3) return 'GENERIC_BOX_REINFORCED';
  if (facts.volumeM3 <= 0.15 && facts.longestEdgeMm <= 800) return 'GENERIC_BOX_LIGHT';
  if (facts.volumeM3 >= 0.75 || facts.longestEdgeMm >= 1500) return 'GENERIC_BOX_HEAVY';
  return 'GENERIC_BOX_STANDARD';
}

function wtpackVisual(facts) {
  return facts.weightKg >= 200 || facts.volumeM3 >= 0.6 ? 'GENERIC_HEAVY_TRANSPORT_BOX' : 'GENERIC_REINFORCED_BOX';
}

function sizeClass(facts) {
  if (facts.longestEdgeMm == null) return 'UNKNOWN';
  if (facts.longestEdgeMm <= 600 && facts.volumeM3 <= 0.12) return 'COMPACT';
  if (facts.longestEdgeMm >= 1400 || facts.volumeM3 >= 0.75) return 'OVERSIZE';
  return 'STANDARD';
}

function massClass(weightKg) {
  if (weightKg == null) return 'UNKNOWN';
  if (weightKg <= 12) return 'LIGHT';
  if (weightKg >= 100) return 'HEAVY';
  return 'STANDARD';
}
