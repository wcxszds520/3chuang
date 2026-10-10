'use strict';

const { resolveAllowedOrientations, externalConstraintOf, normalizeOrientationBoundary } = require('./OrientationConstraint');

const PACKAGING_TYPES = Object.freeze([
  'CARTON',
  'WOOD_CRATE',
  'PALLETIZED_CARTONS',
  'WRAPPED_PALLET',
  'EQUIPMENT_CASE',
  'DRUM',
  'FIBC_BAG',
  'GENERIC','HONEYCOMB_CASE','WOOD_FRAME','PLASTIC_TOTE','IBC','REEL','CUSTOM'
]);

const TYPE_DEFAULTS = Object.freeze({
  CARTON: Object.freeze({ material: 'CORRUGATED_FIBREBOARD', transportUnit: 'LOOSE_UNIT', visualAssetKey: 'cargo_carton', wooden: false }),
  WOOD_CRATE: Object.freeze({ material: 'SOLID_WOOD_OR_PLYWOOD', transportUnit: 'CRATE', visualAssetKey: 'cargo_crate', wooden: true }),
  PALLETIZED_CARTONS: Object.freeze({ material: 'CORRUGATED_FIBREBOARD_ON_PALLET', transportUnit: 'PALLET', visualAssetKey: 'cargo_palletized', wooden: true }),
  WRAPPED_PALLET: Object.freeze({ material: 'STRETCH_FILM_ON_PALLET', transportUnit: 'PALLET', visualAssetKey: 'cargo_wrapped', wooden: true }),
  EQUIPMENT_CASE: Object.freeze({ material: 'ENGINEERED_CASE', transportUnit: 'CASE', visualAssetKey: 'cargo_equipment_case', wooden: true }),
  DRUM: Object.freeze({ material: 'STEEL_OR_POLYMER', transportUnit: 'DRUM', visualAssetKey: 'cargo_drum', wooden: false }),
  FIBC_BAG: Object.freeze({ material: 'WOVEN_POLYPROPYLENE', transportUnit: 'FLEXIBLE_BAG', visualAssetKey: 'cargo_fibc', wooden: false }),
  GENERIC: Object.freeze({ material: 'UNSPECIFIED', transportUnit: 'UNIT', visualAssetKey: 'cargo_generic', wooden: false })
});

/**
 * CargoPhysicalProfile is the V2.5 single source used by the solver, readiness
 * evidence and CargoVisualFactory. Visual meshes never change this envelope.
 */
function normalizeCargoPhysicalProfile(raw = {}, { source = 'USER_INPUT' } = {}) {
  raw = normalizeOrientationBoundary(raw);
  const suppliedProfile = raw.cargoPhysicalProfile || {};
  const suppliedPackaging = raw.packagingProfile || suppliedProfile.packaging || {};
  const packagingType = canonicalPackagingType(
    suppliedPackaging.type || suppliedProfile.packagingType || raw.packagingType || raw.type
  );
  const defaults = TYPE_DEFAULTS[packagingType] || TYPE_DEFAULTS.GENERIC;
  const orientationPolicy = canonicalOrientationPolicy(
    suppliedProfile.orientationPolicy || suppliedPackaging.orientationPolicy || raw.orientationPolicy,
    raw
  );
  const orientationConstraints = externalConstraintOf(raw);
  const orientationPolicySource = raw.orientationPolicySource || (raw.source === 'external-dataset-copy' || (!raw.orientationPolicy && !suppliedProfile.orientationPolicy) ? 'DERIVED_EXTERNAL' : 'BUSINESS_HARD');
  const confirmed = suppliedPackaging.confirmed === true || suppliedPackaging.confirmationStatus === 'USER_CONFIRMED';
  const suggestionSource = suppliedPackaging.suggestionSource || (suppliedPackaging.aiSuggested === true ? 'AI_SUGGESTION' : null);
  const confirmationStatus = suggestionSource === 'AI_SUGGESTION' && !confirmed
    ? 'USER_CONFIRMATION_REQUIRED'
    : confirmed ? 'USER_CONFIRMED' : source === 'LEGACY_INPUT' ? 'LEGACY_MAPPED' : 'USER_SUPPLIED';
  const maximumSupportedWeightKg = nullablePositiveNumber(
    suppliedPackaging.maximumSupportedWeightKg
      ?? suppliedPackaging.maxSupportedWeight
      ?? suppliedProfile.maximumSupportedWeightKg
      ?? raw.maximumSupportedWeightKg
      ?? raw.maxSupportedWeight
  );
  const stackable = booleanValue(suppliedPackaging.stackable ?? suppliedProfile.stackable ?? raw.stackable, true);
  const maxStackLayers = stackable
    ? Math.max(1, integer(suppliedPackaging.maxStackLayers ?? suppliedProfile.maxStackLayers ?? raw.maxStackLayers, 3))
    : 1;
  const handlingMode = canonicalHandlingMode(
    suppliedPackaging.handlingMode || suppliedProfile.handlingMode || raw.handlingMode || raw.handlingMethod,
    Number(raw.weight || suppliedProfile.massKg || 0),
    packagingType
  );
  const dimensions = {
    lengthMm: positiveNumber(suppliedProfile.dimensions?.lengthMm ?? suppliedProfile.lengthMm ?? raw.length),
    widthMm: positiveNumber(suppliedProfile.dimensions?.widthMm ?? suppliedProfile.widthMm ?? raw.width),
    heightMm: positiveNumber(suppliedProfile.dimensions?.heightMm ?? suppliedProfile.heightMm ?? raw.height)
  };
  const visualProfile = {
    assetKey: suppliedProfile.visualProfile?.assetKey || suppliedPackaging.visualAssetKey || defaults.visualAssetKey,
    materialFamily: suppliedProfile.visualProfile?.materialFamily || suppliedPackaging.material || defaults.material,
    labelMode: suppliedProfile.visualProfile?.labelMode || 'CARGO_NAME',
    ...(raw.visualProfile || {}),
    ...(suppliedProfile.visualProfile || {})
  };
  const packagingProfile = {
    schemaVersion: '2.5',
    type: packagingType,
    material: suppliedPackaging.material || defaults.material,
    transportUnit: suppliedPackaging.transportUnit || defaults.transportUnit,
    handlingMode,
    stackable,
    maxStackLayers,
    maximumSupportedWeightKg,
    fragile: booleanValue(suppliedPackaging.fragile ?? suppliedProfile.fragile ?? raw.fragile, false),
    forkEntry: suppliedPackaging.forkEntry || suppliedProfile.forkEntry || raw.forkEntry || defaultForkEntry(packagingType),
    // Absence is not a new business declaration. Preserve explicit true/false.
    ...(Object.prototype.hasOwnProperty.call(suppliedPackaging, 'palletJackCompatible')
      ? { palletJackCompatible: suppliedPackaging.palletJackCompatible } : {}),
    woodPackagingClass: suppliedPackaging.woodPackagingClass || suppliedProfile.woodPackagingClass || raw.woodPackagingClass || defaultWoodClass(packagingType),
    dangerousGoodsContext: suppliedPackaging.dangerousGoodsContext || suppliedProfile.dangerousGoodsContext || raw.dangerousGoodsContext || (raw.dangerous === true ? 'DECLARED_DANGEROUS_GOODS' : 'NOT_DECLARED'),
    orientationPolicy,
    confirmationStatus,
    suggestionSource,
    dataClassification: suppliedPackaging.dataClassification || raw.dataClassification || 'CASE_INPUT'
  };
  const canRotate = orientationPolicy !== 'FIXED_ORIENTATION' && raw.canRotate !== false;
  const canLayFlat = orientationPolicy === 'FULL_ROTATION_ALLOWED';
  const allowedOrientations = resolveAllowedOrientations({
    ...raw,
    length: dimensions.lengthMm,
    width: dimensions.widthMm,
    height: dimensions.heightMm,
    orientationPolicy,
    orientationConstraints,
    ...(orientationConstraints ? { orientationPolicySource } : {}),
    canRotate,
    canLayFlat
  });
  const profile = {
    schemaVersion: '2.5',
    cargoName: suppliedProfile.cargoName || raw.name || raw.cargoName || '',
    quantity: Math.max(1, integer(suppliedProfile.quantity ?? raw.quantity, 1)),
    dimensions,
    massKg: positiveNumber(suppliedProfile.massKg ?? raw.weight),
    destination: suppliedProfile.destination || raw.destinationPort || null,
    portSequence: Math.max(1, integer(suppliedProfile.portSequence ?? raw.portSequence, 1)),
    packagingType,
    packaging: packagingProfile,
    handlingMode,
    stackable,
    maxStackLayers,
    maximumSupportedWeightKg,
    fragile: packagingProfile.fragile,
    orientationPolicy,
    orientationConstraints,
    ...(orientationConstraints ? { orientationPolicySource } : {}),
    forkEntry: packagingProfile.forkEntry,
    woodPackagingClass: packagingProfile.woodPackagingClass,
    dangerousGoodsContext: packagingProfile.dangerousGoodsContext,
    visualProfile,
    solverEnvelope: {
      truthModel: 'AXIS_ALIGNED_PHYSICAL_ENVELOPE',
      dimensions,
      allowedOrientations,
      orientationConstraints,
    ...(orientationConstraints ? { orientationPolicySource } : {}),
      stackable,
      maxStackLayers,
      maximumSupportedWeightKg,
      fragile: packagingProfile.fragile
    }
  };

  return {
    ...raw,
    name: profile.cargoName,
    length: dimensions.lengthMm,
    width: dimensions.widthMm,
    height: dimensions.heightMm,
    weight: profile.massKg,
    quantity: profile.quantity,
    destinationPort: profile.destination,
    portSequence: profile.portSequence,
    packagingType,
    packagingProfile,
    cargoPhysicalProfile: profile,
    handlingMode,
    handlingMethod: raw.handlingMethod || handlingMode.toLowerCase(),
    stackable,
    maxStackLayers,
    maxSupportedWeight: maximumSupportedWeightKg,
    maximumSupportedWeightKg,
    fragile: profile.fragile,
    orientationPolicy,
    orientationConstraints,
    ...(orientationConstraints ? { orientationPolicySource } : {}),
    forkEntry: profile.forkEntry,
    woodPackagingClass: profile.woodPackagingClass,
    dangerousGoodsContext: profile.dangerousGoodsContext,
    visualProfile,
    wooden: raw.wooden === true || defaults.wooden,
    canRotate,
    canLayFlat,
    canInvert: false
  };
}

function normalizeCargoList(cargoList = [], options = {}) {
  return cargoList.map((cargo) => normalizeCargoPhysicalProfile(cargo, options));
}

function canonicalPackagingType(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s\-/]+/g, '_');
  if (PACKAGING_TYPES.includes(normalized)) return normalized;
  if (/FIBC|BIG_BAG|BULK_BAG|吨袋|集装袋/.test(normalized)) return 'FIBC_BAG';
  if (/DRUM|BARREL|桶/.test(normalized)) return 'DRUM';
  if (/WRAP|FILM|缠绕/.test(normalized)) return 'WRAPPED_PALLET';
  if (/PALLET|托盘/.test(normalized)) return 'PALLETIZED_CARTONS';
  if (/EQUIPMENT|MACHINE|CASE|设备|机箱/.test(normalized)) return 'EQUIPMENT_CASE';
  if (/WOOD|CRATE|REINFORCED|木|板条/.test(normalized)) return 'WOOD_CRATE';
  if (/CARTON|BOX|ACCESSORY|PANEL|PROTECTED|纸箱|附件|板件/.test(normalized)) return 'CARTON';
  return 'GENERIC';
}

function canonicalOrientationPolicy(value, raw = {}) {
  const normalized = String(value || '').trim().toUpperCase();
  if (['FIXED_ORIENTATION', 'UPRIGHT_ONLY', 'HORIZONTAL_ROTATION_ONLY', 'FULL_ROTATION_ALLOWED'].includes(normalized)) return normalized;
  if (raw.canLayFlat === true) return 'FULL_ROTATION_ALLOWED';
  if (raw.canRotate === false) return 'FIXED_ORIENTATION';
  return 'HORIZONTAL_ROTATION_ONLY';
}

function canonicalHandlingMode(value, massKg, packagingType) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const aliases = { FORKLIFT: 'FORKLIFT', FORK_LIFT: 'FORKLIFT', MANUAL: 'MANUAL', TEAM_MANUAL: 'TEAM_MANUAL', CRANE: 'CRANE', HOIST: 'CRANE', PALLET_JACK: 'PALLET_JACK' };
  if (aliases[normalized]) return aliases[normalized];
  if (['PALLETIZED_CARTONS', 'WRAPPED_PALLET', 'EQUIPMENT_CASE'].includes(packagingType) || massKg >= 20) return 'FORKLIFT';
  return 'MANUAL';
}

function orientationsForPolicy(dimensions, policy) {
  const l = dimensions.lengthMm;
  const w = dimensions.widthMm;
  const h = dimensions.heightMm;
  const result = [{ l, w, h, label: 'XYZ' }];
  if (policy === 'HORIZONTAL_ROTATION_ONLY' || policy === 'FULL_ROTATION_ALLOWED') result.push({ l: w, w: l, h, label: 'YXZ' });
  if (policy === 'FULL_ROTATION_ALLOWED') result.push(
    { l, w: h, h: w, label: 'XZY' },
    { l: w, w: h, h: l, label: 'YZX' },
    { l: h, w: l, h: w, label: 'ZXY' },
    { l: h, w, h: l, label: 'ZYX' }
  );
  const seen = new Set();
  return result.filter((entry) => {
    const key = `${entry.l}:${entry.w}:${entry.h}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return entry.l > 0 && entry.w > 0 && entry.h > 0;
  });
}

function defaultForkEntry(type) {
  return ['PALLETIZED_CARTONS', 'WRAPPED_PALLET', 'EQUIPMENT_CASE'].includes(type) ? 'TWO_WAY' : 'NOT_APPLICABLE';
}

function defaultWoodClass(type) {
  if (type === 'WOOD_CRATE' || type === 'EQUIPMENT_CASE') return 'CONFIRM_SOLID_OR_PROCESSED_WOOD';
  if (type === 'PALLETIZED_CARTONS' || type === 'WRAPPED_PALLET') return 'PALLET_WOOD_STATUS_REQUIRED';
  return 'NOT_APPLICABLE';
}

function booleanValue(value, fallback) { return value === undefined || value === null ? fallback : value === true; }
function positiveNumber(value) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : 0; }
function nullablePositiveNumber(value) { const parsed = Number(value); return value != null && value !== '' && Number.isFinite(parsed) && parsed >= 0 ? parsed : null; }
function integer(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.floor(parsed) : fallback; }

module.exports = {
  PACKAGING_TYPES,
  TYPE_DEFAULTS,
  canonicalPackagingType,
  normalizeCargoPhysicalProfile,
  normalizeCargoList,
  orientationsForPolicy
};
