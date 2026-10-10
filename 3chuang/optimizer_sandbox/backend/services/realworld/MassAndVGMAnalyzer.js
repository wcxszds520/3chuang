'use strict';

const { activeRules } = require('./RuleRegistry');

const SUPPLEMENTARY_KEYS = Object.freeze(['packagingMassKg', 'palletMassKg', 'dunnageMassKg', 'securingMassKg']);

function analyzeMassAndVGM({ cargoList = [], placements = [], container = {}, massEvidence = {}, vgm = {}, caseContext = {} } = {}) {
  const cargoMassKg = placements.length > 0
    ? sum(placements, (item) => number(item.weight))
    : sum(cargoList, (item) => number(item.weight) * Math.max(1, Math.floor(number(item.quantity || 1))));
  const supplementary = Object.fromEntries(SUPPLEMENTARY_KEYS.map((key) => [key, optionalNumber(massEvidence[key])]));
  const missingSupplementary = SUPPLEMENTARY_KEYS.filter((key) => supplementary[key] === null);
  const knownSupplementaryMassKg = sum(Object.values(supplementary), (value) => number(value));
  const tareKg = optionalNumber(vgm.tareKg ?? container.tare);
  const calculatedGrossMassKg = tareKg === null ? null : round(cargoMassKg + knownSupplementaryMassKg + tareKg);
  const calculatedStatus = tareKg === null || missingSupplementary.length > 0 ? 'PARTIAL_ESTIMATE' : 'COMPLETE_ESTIMATE';

  const declaredVGMKg = optionalNumber(vgm.declaredVGMKg ?? vgm.declaredVGM);
  const method = normalizeMethod(vgm.method);
  const shipperDeclaration = Boolean(vgm.shipperDeclaration || vgm.signedDocumentReference);
  const verifiedEvidence = Boolean(vgm.verifiedEvidence || vgm.weighingCertificateReference);
  const vgmStatus = declaredVGMKg === null
    ? 'DATA_REQUIRED'
    : !method || !shipperDeclaration
      ? 'NOT_VERIFIED'
      : verifiedEvidence ? 'VERIFIED_EVIDENCE_RECORDED' : 'DECLARED_NOT_INDEPENDENTLY_VERIFIED';

  const maxGrossKg = optionalNumber(container.maxGross ?? vgm.maximumOperatingGrossMassKg);
  const maxGrossStatus = maxGrossKg === null || declaredVGMKg === null
    ? 'DATA_REQUIRED'
    : declaredVGMKg > maxGrossKg ? 'BLOCKED_MAX_GROSS_EXCEEDED' : 'WITHIN_RECORDED_MAX_GROSS';

  const measuredGrossMassKg = optionalNumber(vgm.measuredGrossMassKg);
  let chinaTolerance = { status: 'NOT_ASSESSED', reason: 'Certified measured gross mass is required; a calculation estimate is not measurement evidence.' };
  if (declaredVGMKg !== null && measuredGrossMassKg !== null) {
    const allowedDifferenceKg = Math.min(measuredGrossMassKg * 0.05, 1000);
    const differenceKg = Math.abs(declaredVGMKg - measuredGrossMassKg);
    chinaTolerance = {
      status: differenceKg <= allowedDifferenceKg + 0.001 ? 'WITHIN_ENFORCEMENT_TOLERANCE' : 'OUTSIDE_ENFORCEMENT_TOLERANCE',
      differenceKg: round(differenceKg), allowedDifferenceKg: round(allowedDifferenceKg), basis: 'min(5% of measured gross mass, 1000 kg)'
    };
  }

  const status = maxGrossStatus.startsWith('BLOCKED') ? 'BLOCKED'
    : vgmStatus === 'DATA_REQUIRED' || calculatedStatus === 'PARTIAL_ESTIMATE' ? 'DATA_REQUIRED'
      : vgmStatus === 'NOT_VERIFIED' || vgmStatus === 'DECLARED_NOT_INDEPENDENTLY_VERIFIED' ? 'CONDITIONAL'
        : chinaTolerance.status === 'OUTSIDE_ENFORCEMENT_TOLERANCE' ? 'BLOCKED' : 'READY_FOR_EXTERNAL_SUBMISSION';

  return {
    model: 'PORTCUBE_MASS_AND_VGM_V2_4', status,
    massLedger: {
      cargoMassKg: round(cargoMassKg), ...supplementary, knownSupplementaryMassKg: round(knownSupplementaryMassKg),
      tareKg, calculatedGrossMassKg, calculatedStatus,
      statement: 'Calculated gross mass is an engineering estimate and is not itself a SOLAS verified gross mass.'
    },
    vgm: { declaredVGMKg, method, shipperDeclaration, verifiedEvidence, status: vgmStatus },
    maximumOperatingGrossMass: { valueKg: maxGrossKg, status: maxGrossStatus },
    chinaEnforcementTolerance: chinaTolerance,
    missingInputs: [
      ...missingSupplementary,
      ...(tareKg === null ? ['tareKg'] : []),
      ...(declaredVGMKg === null ? ['declaredVGMKg'] : []),
      ...(!method ? ['vgmMethod'] : []),
      ...(!shipperDeclaration ? ['shipperDeclaration'] : [])
    ],
    rules: activeRules({ caseDate: caseContext.caseDate, scopes: ['VGM'] }).map(compactRule)
  };
}

function normalizeMethod(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
  return ['METHOD_1', 'METHOD_2'].includes(normalized) ? normalized : null;
}

function compactRule(entry) { return { id: entry.id, title: entry.title, level: entry.level, clause: entry.clause, sourceUrl: entry.sourceUrl }; }
function optionalNumber(value) { if (value === undefined || value === null || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : null; }
function sum(values, mapper) { return values.reduce((total, value) => total + mapper(value), 0); }
function round(value) { return Math.round(value * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = { analyzeMassAndVGM, SUPPLEMENTARY_KEYS };
