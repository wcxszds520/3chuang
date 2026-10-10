'use strict';

const { buildEquipmentDecision, REFERENCE_EQUIPMENT } = require('./EquipmentPlanningService');
const { analyzeMassAndVGM } = require('./MassAndVGMAnalyzer');
const { evaluateCSC } = require('./CSCPrecheck');
const { analyzeLoadDistribution } = require('./LoadDistributionAnalyzer');
const { analyzeTransportSecuring } = require('./TransportSecuringAnalyzer');
const { validatePortAccessibility } = require('./PortAccessibilityValidator');
const { resolveRules, activeRules } = require('./RuleRegistry');

function evaluateAdmission(input = {}) {
  const caseContext = normalizeCaseContext(input.caseContext);
  const mode = input.actualContainer ? 'ACTUAL_CONTAINER' : String(input.containerMode || 'REFERENCE_PROFILE').toUpperCase();
  const reference = REFERENCE_EQUIPMENT[input.container?.typeId || input.containerType || '40GP'];
  const container = mode === 'ACTUAL_CONTAINER' ? { ...reference, ...input.container, ...input.actualContainer } : { ...reference, ...input.container };
  const selectedType = input.container?.typeId || input.containerType || null;
  const equipment = buildEquipmentDecision({
    cargoList: input.cargoList,
    caseContext,
    actualContainer: mode === 'ACTUAL_CONTAINER' ? input.actualContainer : null,
    selectedType
  });
  const massAndVGM = analyzeMassAndVGM({ cargoList: input.cargoList, placements: input.placements, container, massEvidence: input.massEvidence, vgm: input.vgm, caseContext });
  const csc = evaluateCSC({ mode, actualContainer: input.actualContainer, caseContext });
  const loadDistribution = input.loadDistribution || analyzeLoadDistribution({ placements: input.placements || [], container, operatorEnvelope: input.operatorEnvelope, caseContext });
  const transportSecuring = analyzeTransportSecuring({ placements: input.placements || [], transport: input.transport, securingInputs: input.securingInputs, caseContext });
  const portAccessibility = input.portAccessibility || validatePortAccessibility({ placements: input.placements || [], container, route: caseContext.route, caseContext });
  const cargoDomains = evaluateCargoDomains(input.cargoList || [], input, caseContext);
  const external = evaluateExternalAcceptance(caseContext);
  const domains = {
    equipment: domain(equipment.recommendationStatus === 'NO_STANDARD_DRY_REFERENCE_ELIGIBLE'
      || mode === 'ACTUAL_CONTAINER' && equipment.actual?.status === 'INELIGIBLE'
      || mode !== 'ACTUAL_CONTAINER' && equipment.selectedReference
        && ['INELIGIBLE'].includes(equipment.selectedReference.geometryStatus)
      || mode !== 'ACTUAL_CONTAINER' && equipment.selectedReference
        && ['INELIGIBLE'].includes(equipment.selectedReference.payloadStatus)
      || mode !== 'ACTUAL_CONTAINER' && equipment.selectedReference
        && ['INELIGIBLE'].includes(equipment.selectedReference.volumeStatus)
      || mode !== 'ACTUAL_CONTAINER' && equipment.selectedReference
        && ['INELIGIBLE'].includes(equipment.selectedReference.serviceStatus)
      ? 'BLOCKED' : 'CONDITIONAL', equipment),
    massAndVGM: domain(massAndVGM.status, massAndVGM), csc: domain(csc.decision, csc),
    loadDistribution: domain(loadDistribution.status, loadDistribution), transportSecuring: domain(transportSecuring.decision, transportSecuring),
    portAccessibility: domain(portAccessibility.status, portAccessibility),
    dangerousGoods: domain(cargoDomains.dangerousGoods.status, cargoDomains.dangerousGoods),
    woodPackaging: domain(cargoDomains.woodPackaging.status, cargoDomains.woodPackaging),
    terminalAndVoyage: domain(external.status, external)
  };
  const overallStatus = admissionStatus(Object.values(domains).map((entry) => entry.normalizedStatus));
  const rules = resolveRules({ caseDate: caseContext.caseDate });
  return {
    model: 'PORTCUBE_REAL_WORLD_ADMISSION_PRECHECK_V2_4', caseContext, containerMode: mode,
    overallStatus, decision: overallStatus === 'BLOCKED' ? 'DO_NOT_RELEASE' : overallStatus === 'DATA_REQUIRED' ? 'COLLECT_EVIDENCE' : 'EXTERNAL_CONFIRMATION_REQUIRED',
    domains, ruleRegistry: { caseDate: caseContext.caseDate, entries: rules, activeRuleIds: rules.filter((entry) => entry.resolvedStatus === 'ACTIVE').map((entry) => entry.id) },
    disclaimer: 'PORTCUBE provides an engineering and documentary precheck. It does not represent carrier, vessel, customs, port or terminal acceptance.'
  };
}

function evaluateCargoDomains(cargoList, input, caseContext) {
  const dangerous = cargoList.filter((cargo) => cargo.dangerous === true);
  const dgEvidence = input.dangerousGoodsEvidence || {};
  const dangerousGoods = dangerous.length === 0 ? { status: 'NOT_APPLICABLE', cargoCount: 0 }
    : !dgEvidence.classification || !dgEvidence.packingCertificate ? {
      status: 'DATA_REQUIRED', cargoCount: dangerous.length, missingInputs: ['classification', 'packingCertificate'].filter((key) => !dgEvidence[key]),
      rules: activeRules({ caseDate: caseContext.caseDate, scopes: ['DANGEROUS_GOODS'] }).map(compactRule)
    } : { status: 'EXTERNAL_CONFIRMATION_REQUIRED', cargoCount: dangerous.length, evidence: dgEvidence };
  const regulatedWood = cargoList.filter((cargo) => cargo.wooden === true || /raw.?wood|solid.?wood|木箱|木质/i.test(String(cargo.packagingType || '')));
  const processedOnly = regulatedWood.length === 0 && cargoList.some((cargo) => /plywood|fiberboard|胶合板|薄木/i.test(String(cargo.packagingType || '')));
  const woodEvidence = input.woodPackagingEvidence || {};
  const woodPackaging = regulatedWood.length === 0 ? { status: processedOnly ? 'EXEMPTION_INDICATED_REVIEW' : 'NOT_APPLICABLE', cargoCount: 0 }
    : !woodEvidence.treatmentMark ? { status: 'DATA_REQUIRED', cargoCount: regulatedWood.length, missingInputs: ['treatmentMark'], rules: activeRules({ caseDate: caseContext.caseDate, scopes: ['WOOD_PACKAGING'] }).map(compactRule) }
      : { status: 'DOCUMENTARY_PRECHECK_COMPLETE', cargoCount: regulatedWood.length, treatmentMark: woodEvidence.treatmentMark };
  return { dangerousGoods, woodPackaging };
}

function evaluateExternalAcceptance(context) {
  const missing = [];
  if (!context.carrier || context.carrier === 'UNKNOWN') missing.push('carrier');
  if (!context.voyage || context.voyage === 'UNKNOWN') missing.push('voyage');
  if (!context.bookingReference) missing.push('bookingReference');
  if (!context.terminalAcceptanceReference) missing.push('terminalAcceptanceReference');
  return {
    status: missing.length > 0 ? 'EXTERNAL_CONFIRMATION_REQUIRED' : 'EXTERNAL_CONFIRMATION_REQUIRED', missingInputs: missing,
    terminal: context.terminal, sourceUrl: 'https://www.nbport.com.cn/nbsct/mtfwzy/ywlc/',
    statement: 'Published NBSCT process information is a source snapshot, not live acceptance.'
  };
}

function normalizeCaseContext(value = {}) {
  return {
    caseId: value.caseId || `CASE-${String(value.caseDate || '2026-08-24').replace(/-/g, '')}-DEMO`,
    caseDate: /^\d{4}-\d{2}-\d{2}$/.test(String(value.caseDate || '')) ? value.caseDate : '2026-08-24',
    origin: value.origin || 'Ningbo, CN', destination: value.destination || 'Rotterdam, NL',
    terminal: value.terminal || 'NBSCT', carrier: value.carrier || 'UNKNOWN', voyage: value.voyage || 'UNKNOWN',
    bookingReference: value.bookingReference || null, terminalAcceptanceReference: value.terminalAcceptanceReference || null,
    route: Array.isArray(value.route) && value.route.length > 0 ? value.route : [
      { portSequence: 1, portCode: 'HAM', name: 'Hamburg' }, { portSequence: 2, portCode: 'RTM', name: 'Rotterdam' }, { portSequence: 3, portCode: 'ANR', name: 'Antwerp' }
    ]
  };
}

function domain(status, evidence) { return { status, normalizedStatus: normalizeDomainStatus(status), evidence }; }
function normalizeDomainStatus(status) {
  const value = String(status || 'DATA_REQUIRED');
  if (/BLOCK|INVALID|INADEQUATE|OUTSIDE_OPERATOR/.test(value)) return 'BLOCKED';
  if (/DATA_REQUIRED|UNRESOLVED|NOT_APPLICABLE_TO_REFERENCE/.test(value)) return 'DATA_REQUIRED';
  if (/EXTERNAL|CONDITIONAL|REVIEW|PARTICULAR|REFERENCE_ELIGIBLE/.test(value)) return 'CONDITIONAL';
  return 'READY';
}
function admissionStatus(statuses) {
  if (statuses.includes('BLOCKED')) return 'BLOCKED';
  if (statuses.includes('DATA_REQUIRED')) return 'DATA_REQUIRED';
  if (statuses.includes('CONDITIONAL')) return 'CONDITIONAL';
  return 'PRECHECK_COMPLETE';
}
function compactRule(entry) { return { id: entry.id, title: entry.title, level: entry.level, sourceUrl: entry.sourceUrl }; }

module.exports = { evaluateAdmission, normalizeCaseContext, normalizeDomainStatus };
