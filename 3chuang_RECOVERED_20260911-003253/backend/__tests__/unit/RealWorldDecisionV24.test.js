'use strict';

const { resolveRules } = require('../../services/realworld/RuleRegistry');
const { buildEquipmentDecision, validateContainerNumber } = require('../../services/realworld/EquipmentPlanningService');
const { analyzeMassAndVGM } = require('../../services/realworld/MassAndVGMAnalyzer');
const { evaluateCSC } = require('../../services/realworld/CSCPrecheck');
const { analyzeLoadDistribution } = require('../../services/realworld/LoadDistributionAnalyzer');
const { analyzeTransportSecuring } = require('../../services/realworld/TransportSecuringAnalyzer');
const { validatePortAccessibility } = require('../../services/realworld/PortAccessibilityValidator');
const { evaluateAdmission } = require('../../services/realworld/AdmissionPrecheckEngine');

const container = { typeId: '40GP', innerLength: 12032, innerWidth: 2352, innerHeight: 2393, maxWeight: 28870, tare: 3630, maxGross: 32500 };

describe('Competition 2.4 real-world decision core', () => {
  test('resolves rule effective dates without activating draft or future text', () => {
    const august = resolveRules({ caseDate: '2026-08-24' });
    expect(august.find((rule) => rule.id === 'CN-WPM-DECREE-69-2018').resolvedStatus).toBe('ACTIVE');
    expect(august.find((rule) => rule.id === 'CN-GACC-ORDER-283-2026').resolvedStatus).toBe('FUTURE');
    expect(august.find((rule) => rule.id === 'CTU-REVISION-2025-DRAFT').resolvedStatus).toBe('DRAFT');
    const november = resolveRules({ caseDate: '2026-11-02' });
    expect(november.find((rule) => rule.id === 'CN-WPM-DECREE-69-2018').resolvedStatus).toBe('SUPERSEDED');
    expect(november.find((rule) => rule.id === 'CN-GACC-ORDER-283-2026').resolvedStatus).toBe('ACTIVE');
  });

  test('keeps reference equipment separate from actual-unit admission', () => {
    const cargoList = [{ cargoId: 'A', length: 1000, width: 800, height: 700, weight: 1200, quantity: 1 }];
    const reference = buildEquipmentDecision({ cargoList });
    expect(reference.mode).toBe('REFERENCE_PROFILE');
    expect(reference.recommendedType).toBe('20GP');
    expect(reference.operationalAcceptance).toBe('EXTERNAL_CONFIRMATION_REQUIRED');
    expect(validateContainerNumber('MSKU1234565').valid).toBe(true);
    const actual = buildEquipmentDecision({ cargoList, actualContainer: { containerNumber: 'MSKU1234565' } });
    expect(actual.actual.status).toBe('DATA_REQUIRED');
    expect(actual.actual.missingInputs).toContain('innerLength');
  });

  test('screens total volume and keeps the selected equipment distinct from the recommendation', () => {
    const cargoList = [{ cargoId: 'BULK', length: 1000, width: 1000, height: 1000, weight: 100, quantity: 40 }];
    const result = buildEquipmentDecision({ cargoList, selectedType: '40HQ' });
    expect(result.matrix.find((entry) => entry.typeId === '20GP').volumeStatus).toBe('INELIGIBLE');
    expect(result.recommendedType).toBe('40GP');
    expect(result.selectedType).toBe('40HQ');
    expect(result.selectedReference.typeId).toBe('40HQ');
  });

  test('never equates a calculated gross estimate with verified gross mass', () => {
    const result = analyzeMassAndVGM({
      placements: [{ weight: 1000 }], container,
      massEvidence: { packagingMassKg: 20, palletMassKg: 30, dunnageMassKg: 10, securingMassKg: 5 },
      vgm: { tareKg: 3630 }
    });
    expect(result.massLedger.calculatedGrossMassKg).toBe(4695);
    expect(result.vgm.status).toBe('DATA_REQUIRED');
    expect(result.massLedger.statement).toMatch(/not itself/i);
  });

  test('blocks declared VGM above recorded maximum gross', () => {
    const result = analyzeMassAndVGM({ placements: [{ weight: 28000 }], container, massEvidence: {
      packagingMassKg: 0, palletMassKg: 0, dunnageMassKg: 0, securingMassKg: 0
    }, vgm: { declaredVGMKg: 33000, method: 'METHOD_1', shipperDeclaration: true, verifiedEvidence: true } });
    expect(result.status).toBe('BLOCKED');
    expect(result.maximumOperatingGrossMass.status).toBe('BLOCKED_MAX_GROSS_EXCEEDED');
  });

  test('CSC reference mode is data-required, while dated actual evidence is prechecked', () => {
    expect(evaluateCSC({ mode: 'REFERENCE_PROFILE' }).decision).toBe('DATA_REQUIRED');
    const actual = evaluateCSC({ mode: 'ACTUAL_CONTAINER', caseContext: { caseDate: '2026-08-24' }, actualContainer: {
      containerNumber: 'MSKU1234565', cscPlateReference: 'CSC-PHOTO-01', maxGross: 32500, nextExaminationDate: '2027-02-01'
    } });
    expect(actual.status).toBe('DOCUMENTARY_PRECHECK_COMPLETE');
    expect(actual.decision).toBe('EXTERNAL_CONFIRMATION_REQUIRED');
  });

  test('load distribution exposes guidance bands, segments and missing operator envelope', () => {
    const placements = [{ cargoId: 'A', x: 0, y: 0, z: 0, l: 1000, h: 500, w: 500, weight: 1000 }];
    const result = analyzeLoadDistribution({ placements, container });
    expect(result.centreOfGravity.guidanceStatus).toBe('OUTSIDE_GUIDANCE');
    expect(result.segments.longitudinal).toHaveLength(6);
    expect(result.segments.transverse).toHaveLength(3);
    expect(result.concentratedLoad.specificEnvelopeStatus).toBe('SPECIFIC_ENVELOPE_NOT_AVAILABLE');
  });

  test('transport securing refuses to emit PASS without calculation inputs', () => {
    const result = analyzeTransportSecuring({ placements: [{ weight: 2000 }], transport: { mode: 'SEA', seaArea: 'B' } });
    expect(result.status).toBe('SECURING_UNRESOLVED');
    expect(result.decision).toBe('DATA_REQUIRED');
    expect(result.missingInputs).toEqual(expect.arrayContaining(['frictionCoefficient', 'blockingCapacityDaN', 'lashings']));
  });

  test('full-port replay finds a later-port corridor blocker', () => {
    const small = { innerLength: 1000, innerWidth: 500, innerHeight: 500, maxWeight: 5000 };
    const result = validatePortAccessibility({ container: small, placements: [
      { cargoId: 'EARLY', portSequence: 1, x: 0, y: 0, z: 50, l: 200, h: 200, w: 200, weight: 100, handlingMethod: 'forklift' },
      { cargoId: 'LATE', portSequence: 2, x: 400, y: 0, z: 50, l: 200, h: 200, w: 200, weight: 100, handlingMethod: 'forklift' }
    ] });
    expect(result.status).toBe('PORT_ACCESS_BLOCKED');
    expect(result.blockedCount).toBe(1);
    expect(result.rehandleCargoIds).toContain('LATE');
  });

  test('admission remains evidence-bound for a reference-profile demo', () => {
    const result = evaluateAdmission({ containerType: '40GP', cargoList: [], placements: [], caseContext: { caseDate: '2026-08-24' } });
    expect(result.domains.equipment.evidence.selectedType).toBe('40GP');
    expect(result.overallStatus).toBe('DATA_REQUIRED');
    expect(result.domains.csc.normalizedStatus).toBe('DATA_REQUIRED');
    expect(result.domains.terminalAndVoyage.normalizedStatus).toBe('CONDITIONAL');
    expect(result.disclaimer).toMatch(/does not represent/i);
  });
});
