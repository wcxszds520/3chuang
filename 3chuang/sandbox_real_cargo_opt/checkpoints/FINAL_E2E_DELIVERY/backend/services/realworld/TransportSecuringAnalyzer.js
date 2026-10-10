'use strict';

const { activeRules } = require('./RuleRegistry');

const ACCELERATION_PROFILES = Object.freeze({
  ROAD: Object.freeze({ longitudinalForward: 0.8, longitudinalRear: 0.5, transverse: 0.5, vertical: 1.0 }),
  RAIL: Object.freeze({ longitudinalForward: 0.5, longitudinalRear: 0.5, longitudinalShock: 1.0, transverse: 0.5, vertical: 1.0, verticalShock: 0.7 }),
  SEA_A: Object.freeze({ longitudinalForward: 0.3, longitudinalRear: 0.3, transverse: 0.5, vertical: 1.0 }),
  SEA_B: Object.freeze({ longitudinalForward: 0.3, longitudinalRear: 0.3, transverse: 0.7, vertical: 1.0 }),
  SEA_C: Object.freeze({ longitudinalForward: 0.4, longitudinalRear: 0.4, transverse: 0.8, vertical: 1.0 })
});

function analyzeTransportSecuring({ placements = [], transport = {}, securingInputs = {}, caseContext = {} } = {}) {
  const profileId = resolveProfile(transport);
  const profile = ACCELERATION_PROFILES[profileId];
  const massKg = sum(placements, (item) => number(item.weight));
  const friction = optionalNumber(securingInputs.frictionCoefficient);
  const blocking = normalizeDirectionalCapacity(securingInputs.blockingCapacityDaN);
  const lashings = Array.isArray(securingInputs.lashings) ? securingInputs.lashings : [];
  const missing = [];
  if (friction === null) missing.push('frictionCoefficient');
  if (!securingInputs.blockingCapacityDaN) missing.push('blockingCapacityDaN');
  if (lashings.length === 0) missing.push('lashings');
  for (const [index, lashing] of lashings.entries()) {
    if (optionalNumber(lashing.lashingCapacityDaN) === null) missing.push(`lashings[${index}].lashingCapacityDaN`);
    if (optionalNumber(lashing.angleDegrees) === null) missing.push(`lashings[${index}].angleDegrees`);
  }
  const directions = {
    forward: profile.longitudinalForward,
    rear: profile.longitudinalRear,
    left: profile.transverse,
    right: profile.transverse
  };
  const checks = Object.entries(directions).map(([direction, coefficient]) => {
    const demandDaN = massKg * coefficient;
    const frictionResistanceDaN = friction === null ? null : massKg * Math.max(0, friction) * profile.vertical;
    const blockingResistanceDaN = blocking[direction];
    const lashingResistanceDaN = lashings.reduce((total, lashing) => {
      const capacity = number(lashing.lashingCapacityDaN);
      const angle = number(lashing.angleDegrees) * Math.PI / 180;
      const directionFactor = lashing.directions?.includes(direction) ? Math.max(0, Math.cos(angle)) : 0;
      return total + capacity * directionFactor;
    }, 0);
    const resistanceDaN = frictionResistanceDaN === null ? null : frictionResistanceDaN + blockingResistanceDaN + lashingResistanceDaN;
    return {
      direction, coefficient, demandDaN: round(demandDaN), frictionResistanceDaN: nullableRound(frictionResistanceDaN),
      blockingResistanceDaN: round(blockingResistanceDaN), lashingResistanceDaN: round(lashingResistanceDaN),
      resistanceDaN: nullableRound(resistanceDaN), status: resistanceDaN === null ? 'DATA_REQUIRED' : resistanceDaN + 0.001 >= demandDaN ? 'CALCULATION_PASS' : 'CALCULATION_FAIL'
    };
  });
  const status = missing.length > 0 ? 'SECURING_UNRESOLVED'
    : checks.some((entry) => entry.status === 'CALCULATION_FAIL') ? 'SECURING_INADEQUATE'
      : 'CALCULATION_PASS_REQUIRES_EXTERNAL_CONFIRMATION';
  return {
    model: 'PORTCUBE_TRANSPORT_SECURING_V2_4', status, profileId, accelerationProfile: profile, massKg: round(massKg), checks,
    missingInputs: [...new Set(missing)],
    decision: status === 'SECURING_INADEQUATE' ? 'BLOCKED' : status === 'SECURING_UNRESOLVED' ? 'DATA_REQUIRED' : 'EXTERNAL_CONFIRMATION_REQUIRED',
    rules: activeRules({ caseDate: caseContext.caseDate, scopes: ['TRANSPORT_SECURING'] }).map(compactRule),
    limitations: ['Rigid-body screening only', 'No material deformation or certified lashing-point verification', 'Recorded values require competent-person confirmation']
  };
}

function resolveProfile(transport) {
  const mode = String(transport.mode || 'SEA').toUpperCase();
  if (mode === 'ROAD') return 'ROAD';
  if (mode === 'RAIL') return 'RAIL';
  const area = String(transport.seaArea || 'B').toUpperCase();
  return ['A', 'B', 'C'].includes(area) ? `SEA_${area}` : 'SEA_B';
}

function normalizeDirectionalCapacity(value) {
  if (typeof value === 'number') return { forward: value, rear: value, left: value, right: value };
  return { forward: number(value?.forward), rear: number(value?.rear), left: number(value?.left), right: number(value?.right) };
}

function compactRule(entry) { return { id: entry.id, title: entry.title, level: entry.level, clause: entry.clause, sourceUrl: entry.sourceUrl }; }
function optionalNumber(value) { if (value === undefined || value === null || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : null; }
function nullableRound(value) { return value === null ? null : round(value); }
function sum(values, mapper) { return values.reduce((total, value) => total + mapper(value), 0); }
function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = { ACCELERATION_PROFILES, analyzeTransportSecuring, resolveProfile };
