'use strict';

const { activeRules } = require('./RuleRegistry');

const REFERENCE_SOURCE_URL = 'https://www.maersk.com/~/media_sc9/maersk/local-information/files/europe/greece/import/equipment-flyer.pdf';

const REFERENCE_EQUIPMENT = Object.freeze({
  '20GP': profile('20GP', '22G1', 5898, 2352, 2393, 2340, 2280, 2180, 30480, 28300, 33.2),
  '40GP': profile('40GP', '42G1', 12032, 2352, 2393, 2340, 2280, 3630, 32500, 28870, 67.7),
  '40HQ': profile('40HQ', '45G1', 12032, 2352, 2698, 2340, 2585, 3810, 32500, 28690, 76.4)
});

function profile(typeId, isoTypeCode, innerLength, innerWidth, innerHeight, doorWidth, doorHeight, tare, maxGross, payload, capacityM3) {
  return Object.freeze({
    typeId, isoTypeCode, name: `${typeId} dry container`, mode: 'REFERENCE_PROFILE',
    innerLength, innerWidth, innerHeight, doorWidth, doorHeight, tare, maxGross, maxWeight: payload, payload, capacityM3,
    source: { authority: 'Maersk', url: REFERENCE_SOURCE_URL, classification: 'CARRIER_REFERENCE', verifiedAt: '2026-08-24' },
    limitation: 'Reference profile only. The released unit, CSC plate, carrier booking and terminal acceptance control.'
  });
}

function buildEquipmentDecision({ cargoList = [], caseContext = {}, actualContainer = null, selectedType = null, caseDate } = {}) {
  const expanded = expandCargo(cargoList);
  const totalMass = expanded.reduce((sum, item) => sum + number(item.weight), 0);
  const totalVolumeM3 = expanded.reduce((sum, item) => sum + number(item.length) * number(item.width) * number(item.height), 0) / 1e9;
  const hasDangerous = expanded.some((item) => item.dangerous === true);
  const requiresTemperature = expanded.some((item) => item.temperatureControlled === true || item.temperatureSetpoint != null);
  const matrix = Object.values(REFERENCE_EQUIPMENT).map((equipment) => evaluateReference(equipment, expanded, {
    totalMass, totalVolumeM3, hasDangerous, requiresTemperature, caseContext
  }));
  const eligible = matrix.filter((entry) => entry.geometryStatus === 'ELIGIBLE' && entry.payloadStatus === 'ELIGIBLE'
    && entry.volumeStatus === 'SCREENING_ELIGIBLE'
    && entry.serviceStatus !== 'INELIGIBLE');
  eligible.sort((a, b) => a.capacityM3 - b.capacityM3 || a.payload - b.payload || a.typeId.localeCompare(b.typeId));
  const actual = actualContainer ? evaluateActualContainer(actualContainer, expanded, { totalMass, totalVolumeM3 }) : null;
  const normalizedSelectedType = selectedType && REFERENCE_EQUIPMENT[selectedType] ? selectedType : null;
  const selectedReference = normalizedSelectedType ? matrix.find((entry) => entry.typeId === normalizedSelectedType) : null;
  return {
    model: 'PORTCUBE_EQUIPMENT_DECISION_MATRIX_V2_4', caseDate: caseDate || caseContext.caseDate || '2026-08-24',
    mode: actualContainer ? 'ACTUAL_CONTAINER' : 'REFERENCE_PROFILE', matrix,
    selectedType: normalizedSelectedType,
    selectedReference,
    recommendedType: eligible[0]?.typeId || null,
    recommendationStatus: eligible.length > 0 ? 'REFERENCE_ELIGIBLE' : 'NO_STANDARD_DRY_REFERENCE_ELIGIBLE',
    actual,
    operationalAcceptance: 'EXTERNAL_CONFIRMATION_REQUIRED',
    facts: { itemCount: expanded.length, totalCargoMassKg: totalMass, totalCargoVolumeM3: round(totalVolumeM3), hasDangerous, requiresTemperature },
    rules: activeRules({ caseDate: caseDate || caseContext.caseDate, scopes: ['EQUIPMENT'] }).map(compactRule),
    limitations: ['No carrier allocation check', 'No live terminal acceptance check', 'Actual unit dimensions and CSC plate override reference data']
  };
}

function evaluateReference(equipment, cargo, facts) {
  const failures = [];
  for (const item of cargo) {
    if (!fitsAnyOrientation(item, equipment)) failures.push({ code: 'INNER_GEOMETRY_EXCEEDED', cargoId: item.cargoId || item.id || item.name });
    if (!fitsDoorAnyOrientation(item, equipment)) failures.push({ code: 'DOOR_OPENING_EXCEEDED', cargoId: item.cargoId || item.id || item.name });
  }
  const payloadStatus = facts.totalMass <= equipment.payload ? 'ELIGIBLE' : 'INELIGIBLE';
  if (payloadStatus === 'INELIGIBLE') failures.push({ code: 'REFERENCE_PAYLOAD_EXCEEDED', totalMass: facts.totalMass, payload: equipment.payload });
  const volumeStatus = facts.totalVolumeM3 <= equipment.capacityM3 ? 'SCREENING_ELIGIBLE' : 'INELIGIBLE';
  if (volumeStatus === 'INELIGIBLE') failures.push({
    code: 'CARGO_VOLUME_EXCEEDS_REFERENCE_CAPACITY',
    totalCargoVolumeM3: round(facts.totalVolumeM3),
    referenceCapacityM3: equipment.capacityM3
  });
  let serviceStatus = 'ELIGIBLE';
  if (facts.requiresTemperature) {
    serviceStatus = 'INELIGIBLE';
    failures.push({ code: 'REEFER_REQUIRED', message: 'Dry equipment cannot satisfy a temperature-controlled requirement.' });
  } else if (facts.hasDangerous) {
    serviceStatus = 'CONDITIONAL';
    failures.push({ code: 'DG_BOOKING_AND_SEGREGATION_REQUIRED' });
  }
  const geometryStatus = failures.some((entry) => /GEOMETRY|DOOR/.test(entry.code)) ? 'INELIGIBLE' : 'ELIGIBLE';
  return { ...equipment, geometryStatus, payloadStatus, volumeStatus, serviceStatus, failures };
}

function evaluateActualContainer(actual, cargo, facts) {
  const required = ['containerNumber', 'innerLength', 'innerWidth', 'innerHeight', 'doorWidth', 'doorHeight', 'tare', 'maxGross'];
  const missing = required.filter((key) => actual[key] === undefined || actual[key] === null || actual[key] === '');
  const identity = validateContainerNumber(actual.containerNumber);
  if (!identity.valid && actual.containerNumber) missing.push('validContainerNumber');
  if (missing.length > 0) return {
    mode: 'ACTUAL_CONTAINER', status: 'DATA_REQUIRED', missingInputs: [...new Set(missing)], identity,
    statement: 'Actual-container admission cannot be inferred from a reference profile.'
  };
  const equipment = {
    ...actual, mode: 'ACTUAL_CONTAINER', maxWeight: number(actual.maxGross) - number(actual.tare), payload: number(actual.maxGross) - number(actual.tare)
  };
  const failures = cargo.flatMap((item) => {
    const result = [];
    if (!fitsAnyOrientation(item, equipment)) result.push({ code: 'ACTUAL_INNER_GEOMETRY_EXCEEDED', cargoId: item.cargoId });
    if (!fitsDoorAnyOrientation(item, equipment)) result.push({ code: 'ACTUAL_DOOR_OPENING_EXCEEDED', cargoId: item.cargoId });
    return result;
  });
  if (facts.totalMass > equipment.payload) failures.push({ code: 'ACTUAL_PAYLOAD_EXCEEDED', totalMass: facts.totalMass, payload: equipment.payload });
  return { ...equipment, identity, failures, status: failures.length === 0 ? 'TECHNICALLY_ELIGIBLE' : 'INELIGIBLE', operationalAcceptance: 'EXTERNAL_CONFIRMATION_REQUIRED' };
}

function validateContainerNumber(value) {
  const normalized = String(value || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(normalized)) return { valid: false, normalized, reason: 'FORMAT' };
  const alphabet = '0123456789A?BCDEFGHIJK?LMNOPQRSTU?VWXYZ';
  let sum = 0;
  for (let index = 0; index < 10; index++) {
    const char = normalized[index];
    const raw = /\d/.test(char) ? Number(char) : alphabet.indexOf(char);
    sum += raw * (2 ** index);
  }
  const calculated = (sum % 11) % 10;
  const supplied = Number(normalized[10]);
  return { valid: calculated === supplied, normalized, calculatedCheckDigit: calculated, suppliedCheckDigit: supplied, reason: calculated === supplied ? null : 'CHECK_DIGIT' };
}

function fitsAnyOrientation(item, equipment) {
  return orientations(item).some(([l, w, h]) => l <= number(equipment.innerLength) && w <= number(equipment.innerWidth) && h <= number(equipment.innerHeight));
}

function fitsDoorAnyOrientation(item, equipment) {
  return orientations(item).some(([, w, h]) => w <= number(equipment.doorWidth) && h <= number(equipment.doorHeight));
}

function orientations(item) {
  const l = number(item.length ?? item.l); const w = number(item.width ?? item.w); const h = number(item.height ?? item.h);
  const candidates = [[l, w, h]];
  if (item.canRotate !== false) candidates.push([w, l, h]);
  if (item.canLayFlat === true) candidates.push([l, h, w], [w, h, l], [h, l, w], [h, w, l]);
  return candidates;
}

function expandCargo(cargoList) {
  return cargoList.flatMap((cargo) => Array.from({ length: Math.max(1, Math.floor(number(cargo.quantity || 1))) }, (_, index) => ({
    ...cargo, cargoId: cargo.cargoId || cargo.id || `${cargo.name || 'cargo'}-${index + 1}`, quantity: 1
  })));
}

function compactRule(entry) { return { id: entry.id, title: entry.title, level: entry.level, status: entry.resolvedStatus, sourceUrl: entry.sourceUrl }; }
function round(value) { return Math.round(value * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = { REFERENCE_EQUIPMENT, buildEquipmentDecision, evaluateActualContainer, validateContainerNumber };
