'use strict';

const { activeRules } = require('./RuleRegistry');
const { validateContainerNumber } = require('./EquipmentPlanningService');

function evaluateCSC({ mode = 'REFERENCE_PROFILE', actualContainer = null, caseContext = {} } = {}) {
  const rules = activeRules({ caseDate: caseContext.caseDate, scopes: ['CSC'] }).map(compactRule);
  if (String(mode).toUpperCase() !== 'ACTUAL_CONTAINER') return {
    model: 'PORTCUBE_CSC_PRECHECK_V2_4', status: 'NOT_APPLICABLE_TO_REFERENCE_PROFILE', decision: 'DATA_REQUIRED',
    missingInputs: ['actualContainer'], rules,
    statement: 'A reference equipment profile cannot establish CSC plate or examination validity for a released unit.'
  };
  const actual = actualContainer || {};
  const identity = validateContainerNumber(actual.containerNumber);
  const hasAcep = Boolean(actual.acepSchemeReference);
  const nextExaminationDate = isoDateOrNull(actual.nextExaminationDate);
  const cscPlate = Boolean(actual.cscPlateReference || actual.cscPlatePhotoReference);
  const maxGross = optionalNumber(actual.maxGross ?? actual.maximumOperatingGrossMassKg);
  const missing = [];
  if (!identity.valid) missing.push('validContainerNumber');
  if (!cscPlate) missing.push('cscPlateReference');
  if (maxGross === null) missing.push('maximumOperatingGrossMassKg');
  if (!hasAcep && !nextExaminationDate) missing.push('acepSchemeReferenceOrNextExaminationDate');
  const caseDate = isoDateOrNull(caseContext.caseDate) || '2026-08-24';
  const examinationExpired = !hasAcep && nextExaminationDate && nextExaminationDate < caseDate;
  return {
    model: 'PORTCUBE_CSC_PRECHECK_V2_4', identity, cscPlateRecorded: cscPlate, maximumOperatingGrossMassKg: maxGross,
    examination: { acepSchemeReference: actual.acepSchemeReference || null, nextExaminationDate, expired: Boolean(examinationExpired) },
    status: examinationExpired ? 'BLOCKED_EXAMINATION_EXPIRED' : missing.length > 0 ? 'DATA_REQUIRED' : 'DOCUMENTARY_PRECHECK_COMPLETE',
    decision: examinationExpired ? 'BLOCKED' : missing.length > 0 ? 'DATA_REQUIRED' : 'EXTERNAL_CONFIRMATION_REQUIRED',
    missingInputs: missing, rules,
    statement: 'Documentary precheck does not authenticate the plate or replace physical inspection and carrier/terminal acceptance.'
  };
}

function compactRule(entry) { return { id: entry.id, title: entry.title, level: entry.level, sourceUrl: entry.sourceUrl }; }
function isoDateOrNull(value) { const text = String(value || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null; }
function optionalNumber(value) { if (value === undefined || value === null || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }

module.exports = { evaluateCSC };
