'use strict';

// PORTCUBE placement fields are (l, w, h) on container axes (X, Z, Y).
const DEFINITIONS = Object.freeze([
  definition('LWH', 'L', 'H', 'W'),
  definition('WLH', 'W', 'H', 'L'),
  definition('LHW', 'L', 'W', 'H'),
  definition('WHL', 'W', 'L', 'H'),
  definition('HLW', 'H', 'W', 'L'),
  definition('HWL', 'H', 'L', 'W')
]);

function definition(id, containerX, containerY, containerZ) {
  return Object.freeze({
    id,
    axisMap: Object.freeze({ containerX, containerY, containerZ }),
    uprightOriginalAxis: containerY
  });
}


const FLAG_FAMILIES = [['lengthVertical', 'widthVertical', 'heightVertical'], ['x', 'y', 'z']];
// mappingStatus is an existing adapter annotation, never a permission.
const RULE_KEYS = new Set(['mode', 'containerAxisAlignment', 'mappingStatus', ...FLAG_FAMILIES.flat()]);

function resolveAllowedOrientations(cargo = {}) {
  return resolveOrientationRules(cargo).orientations;
}

// Pure canonical boundary. Invalid/unsupported/empty permissions NEVER use legacy flags.
function resolveOrientationRules(cargo = {}) {
  const sources = [];
  const errors = [];
  const fail = (status, path, message, relatedPath) => ({ status, orientations: [], sources,
    constraint: null, errors: [...errors, { path, message, ...(relatedPath ? { relatedPath } : {}) }] });
  const dimensions = dimensionsOf(cargo);
  for (const [key, profileKey] of [['length','lengthMm'],['width','widthMm'],['height','heightMm']]) {
    if (cargo[key] !== undefined && (typeof cargo[key] !== 'number' || !Number.isFinite(cargo[key]) || cargo[key] <= 0)) return fail('INVALID', key, 'Explicit dimension must be a finite positive number in mm');
    const profileValue = cargo.cargoPhysicalProfile?.dimensions?.[profileKey];
    if (cargo[key] !== undefined && profileValue !== undefined && cargo[key] !== profileValue) return fail('INVALID', key, 'Dimension conflicts with physical profile', 'cargoPhysicalProfile.dimensions.' + profileKey);
  }
  for (const [key, value] of Object.entries(dimensions)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fail('INVALID', key, 'Dimension must be a finite positive number in mm');
  }
  const families = new Map();
  const merged = {};
  for (const [path, value] of constraintCopies(cargo)) {
    if (value === undefined || value === null) continue;
    if (typeof value !== 'object' || Array.isArray(value)) return fail('INVALID', path, 'Expected a direction rule object');
    if (!Object.keys(value).length) continue; // legacy placeholder; declaration checked below
    sources.push(path);
    if (Object.keys(value).some(key => !RULE_KEYS.has(key))) return fail('UNSUPPORTED', path, 'Unknown orientation semantics');
    const records = [];
    if (Object.hasOwn(value, 'mode') || Object.hasOwn(value, 'containerAxisAlignment')) {
      if (Object.hasOwn(value, 'mode') && Object.hasOwn(value, 'containerAxisAlignment')) return fail('INVALID', path, 'FREE and fixed alignment are mutually exclusive');
      const key = Object.hasOwn(value, 'mode') ? 'mode' : 'containerAxisAlignment';
      if (typeof value[key] !== 'string' || !value[key].trim()) return fail('INVALID', path + '.' + key, 'Expected a nonempty mode');
      const token = value[key].trim().toUpperCase();
      if (!(key === 'mode' ? ['FREE'] : ['LENGTHWISE', 'WIDTHWISE']).includes(token)) return fail('UNSUPPORTED', path + '.' + key, 'Unrecognized orientation mode');
      records.push(['horizontal', { [key]: token }]);
    }
    for (const keys of FLAG_FAMILIES) {
      if (!keys.some(key => Object.hasOwn(value, key))) continue;
      for (const key of keys) if (typeof value[key] !== 'boolean') return fail('INVALID', path + '.' + key, 'All three canonical indicators must be boolean');
      records.push([keys[0], Object.fromEntries(keys.map(key => [key, value[key]]))]);
    }
    if (!records.length) return fail('UNSUPPORTED', path, 'No supported direction family');
    for (const [family, rule] of records) {
      const previous = families.get(family);
      if (previous && JSON.stringify(previous.rule) !== JSON.stringify(rule)) return fail('INVALID', path, 'Conflicting copies of ' + family, previous.path);
      families.set(family, { rule, path }); Object.assign(merged, rule);
    }
  }
  const externalDeclared = cargo.source === 'external-dataset-copy' || cargo.orientationRulesDeclared === true;
  if (!families.size && externalDeclared) return fail('INVALID', 'orientationConstraints', 'Declared external rules are missing or empty');
  const policy = String(cargo.orientationPolicy || cargo.cargoPhysicalProfile?.orientationPolicy || '').toUpperCase();
  const derived = cargo.orientationPolicySource === 'DERIVED_EXTERNAL'
    || (cargo.source === 'external-dataset-copy' && cargo.orientationPolicySource !== 'BUSINESS_HARD');
  if ((!families.size || !derived) && ['FIXED_ORIENTATION','UPRIGHT_ONLY'].includes(policy) && cargo.canLayFlat === true) {
    return fail('INVALID', 'canLayFlat', 'Contradicts fixed/upright orientationPolicy', 'orientationPolicy');
  }
  let definitions = families.size ? [...DEFINITIONS] : legacyDefinitions(cargo);
  for (const [family, { rule, path }] of families) {
    if (family === 'x') {
      // Official readme names source X/Y/Z, but does not establish partial-rotation
      // composition in PORTCUBE's X/Y(vertical)/Z frame. Only full freedom is verified.
      if (!rule.x || !rule.y || !rule.z) return fail('UNSUPPORTED', path, 'ORTEC non-111 source-axis rotation semantics are not verified');
    } else if (family === 'lengthVertical') {
      const enabled = { L: rule.lengthVertical, W: rule.widthVertical, H: rule.heightVertical };
      definitions = definitions.filter(d => enabled[d.uprightOriginalAxis]);
    } else {
      definitions = definitions.filter(d => {
        if (d.uprightOriginalAxis !== 'H') return false;
        if (rule.mode === 'FREE') return true;
        const size = materialize(d, dimensions, 'RENAULT');
        // Official Item.java: deltaX >= deltaY is LENGTHWISE, including squares.
        return rule.containerAxisAlignment === 'LENGTHWISE' ? size.l >= size.w : size.l < size.w;
      });
    }
  }
  // Source-derived UI flags are explanatory only. Independently supplied business
  // policy/flags remain restrictions and are intersected with external permission.
  if (families.size && !derived && (policy || cargo.canRotate === false || cargo.canLayFlat === false)) {
    const business = new Set(legacyDefinitions(cargo).map(d => d.id));
    definitions = definitions.filter(d => business.has(d.id));
  }
  const status = !families.size ? 'ABSENT' : definitions.length ? 'VALID' : 'UNSATISFIABLE';
  return { status, orientations: deduplicateGeometry(definitions.map(d => materialize(d, dimensions, families.size ? 'SOURCE_DIRECTION_RULES' : 'LEGACY_POLICY_FLAGS'))),
    sources, constraint: families.size ? merged : null,
    errors: definitions.length ? [] : [{ path: sources.join(', '), message: 'No orientation satisfies all direction permissions' }] };
}

function assertOrientationRules(cargo) {
  const result = resolveOrientationRules(cargo);
  if (!['ABSENT', 'VALID'].includes(result.status)) {
    const error = new Error('Orientation ' + result.status + ': ' + result.errors.map(e => e.path + ': ' + e.message).join('; '));
    error.code = 'ORIENTATION_' + result.status;
    error.details = { cargoId: cargo.cargoId || cargo.id || null, ...result };
    throw error;
  }
  return result;
}

function constraintCopies(cargo) {
  return [
    ['orientationConstraints', cargo.orientationConstraints],
    ['cargoPhysicalProfile.orientationConstraints', cargo.cargoPhysicalProfile?.orientationConstraints],
    ['cargoPhysicalProfile.solverEnvelope.orientationConstraints', cargo.cargoPhysicalProfile?.solverEnvelope?.orientationConstraints],
    ['externalMetadata.orientationConstraints', cargo.externalMetadata?.orientationConstraints]
  ];
}

// Explicit adapter whitelist. Invalid values are preserved so the pure resolver
// can report their actual field path; JSON cloning must not turn NaN into null.
function normalizeOrientationBoundary(cargo) {
  const normalized = structuredClone(cargo);
  const holders = [normalized, normalized.cargoPhysicalProfile, normalized.cargoPhysicalProfile?.solverEnvelope, normalized.externalMetadata];
  for (const holder of holders) {
    const rule = holder?.orientationConstraints;
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) continue;
    for (const key of FLAG_FAMILIES.flat()) {
      if (rule[key] === 0 || rule[key] === '0') rule[key] = false;
      else if (rule[key] === 1 || rule[key] === '1') rule[key] = true;
    }
  }
  return normalized;
}

function orientationCacheIdentity(cargo) {
  const result = resolveOrientationRules(normalizeOrientationBoundary(cargo));
  return { version: 'ORIENTATION_R1_1', status: result.status,
    ids: result.orientations.flatMap(o => o.semanticVariants.map(v => v.id)).sort(),
    ...(result.errors.length ? { errors: result.errors } : {}) };
}

function legacyDefinitions(cargo) {
  const policy = String(cargo.orientationPolicy || cargo.cargoPhysicalProfile?.orientationPolicy || '').toUpperCase();
  const fixed = policy === 'FIXED_ORIENTATION' || policy === 'UPRIGHT_ONLY';
  const fullRotation = policy === 'FULL_ROTATION_ALLOWED';
  const ids = ['LWH'];
  if (!fixed && cargo.canRotate !== false) ids.push('WLH');
  if (fullRotation || cargo.canLayFlat === true) {
    ids.push('LHW');
    if (cargo.canRotate !== false) ids.push('WHL', 'HLW', 'HWL');
  }
  return byIds(ids);
}

function materialize(entry, dimensions, source) {
  const values = { L: dimensions.length, W: dimensions.width, H: dimensions.height };
  const l = values[entry.axisMap.containerX];
  const w = values[entry.axisMap.containerZ];
  const h = values[entry.axisMap.containerY];
  return {
    id: entry.id,
    // Keep the historical label as the candidate-sort compatibility surface.
    // `id` and `axisMap` are the authoritative new semantics.
    label: legacyLabel(entry.id),
    legacyLabel: legacyLabel(entry.id),
    l, w, h,
    x: l, y: h, z: w,
    size: { x: l, y: h, z: w },
    axisMap: { ...entry.axisMap },
    uprightOriginalAxis: entry.uprightOriginalAxis,
    source
  };
}

function deduplicateGeometry(orientations) {
  const bySize = new Map();
  for (const orientation of orientations) {
    if (!(orientation.l > 0 && orientation.w > 0 && orientation.h > 0)) continue;
    const key = `${orientation.l}:${orientation.w}:${orientation.h}`;
    const existing = bySize.get(key);
    if (!existing) {
      bySize.set(key, {
        ...orientation,
        semanticVariants: [{ ...orientation, axisMap: { ...orientation.axisMap } }],
        equivalentIds: [orientation.id],
        equivalentAxisMaps: [{ ...orientation.axisMap }],
        equivalentUprightOriginalAxes: [orientation.uprightOriginalAxis]
      });
    } else {
      existing.semanticVariants.push({ ...orientation, axisMap: { ...orientation.axisMap } });
      existing.equivalentIds.push(orientation.id);
      existing.equivalentAxisMaps.push({ ...orientation.axisMap });
      if (!existing.equivalentUprightOriginalAxes.includes(orientation.uprightOriginalAxis)) {
        existing.equivalentUprightOriginalAxes.push(orientation.uprightOriginalAxis);
      }
    }
  }
  return [...bySize.values()];
}


function externalConstraintOf(cargo) { return assertOrientationRules(cargo).constraint; }
function dimensionsOf(cargo) {
  const profile = cargo.cargoPhysicalProfile?.dimensions || {};
  return { length: profile.lengthMm ?? cargo.length, width: profile.widthMm ?? cargo.width, height: profile.heightMm ?? cargo.height };
}

function byIds(ids) {
  const wanted = new Set(ids);
  return DEFINITIONS.filter((entry) => wanted.has(entry.id));
}

function legacyLabel(id) {
  return ({ LWH: 'XYZ', WLH: 'YXZ', LHW: 'XZY', WHL: 'YZX', HLW: 'ZXY', HWL: 'ZYX' })[id];
}

module.exports = { ORIENTATION_DEFINITIONS: DEFINITIONS, resolveAllowedOrientations, resolveOrientationRules, assertOrientationRules, normalizeOrientationBoundary, orientationCacheIdentity, externalConstraintOf, legacyDefinitions };
