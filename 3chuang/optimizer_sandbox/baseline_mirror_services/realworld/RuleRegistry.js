'use strict';

/**
 * Competition 2.5 rule / guidance / reference registry.
 *
 * This is a dated evidence index, not a substitute for carrier, terminal or
 * competent-authority acceptance. Evaluators consume only ACTIVE entries.
 */
const RULES = Object.freeze([
  rule({
    id: 'SOLAS-VI-2-VGM', title: 'SOLAS verified gross mass before loading', authority: 'IMO',
    jurisdiction: 'INTERNATIONAL', scope: 'VGM', level: 'LEGAL_REQUIREMENT', effectiveFrom: '2016-07-01',
    sourceDocument: 'SOLAS chapter VI regulation 2 / MSC.1-Circ.1475',
    sourceUrl: 'https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx',
    clause: 'SOLAS VI/2; MSC.1/Circ.1475', evaluator: 'MassAndVGMAnalyzer',
    requiredInputs: ['verifiedGrossMass', 'verificationMethod', 'shipperDeclaration']
  }),
  rule({
    id: 'IMO-CSC-1972', title: 'Container safety approval plate and examination', authority: 'IMO',
    jurisdiction: 'INTERNATIONAL', scope: 'CSC', level: 'LEGAL_REQUIREMENT', effectiveFrom: '1977-09-06',
    sourceDocument: 'International Convention for Safe Containers (CSC), 1972',
    sourceUrl: 'https://www.imo.org/en/about/conventions/pages/international-convention-for-safe-containers-%28csc%29.aspx',
    clause: 'Annex I approval, plate and examination regime', evaluator: 'CSCPrecheck',
    requiredInputs: ['actualContainerNumber', 'cscPlateReference', 'maximumOperatingGrossMass', 'examinationEvidence']
  }),
  rule({
    id: 'IMDG-42-24', title: 'IMDG Code Amendment 42-24', authority: 'IMO', jurisdiction: 'INTERNATIONAL',
    scope: 'DANGEROUS_GOODS', level: 'LEGAL_REQUIREMENT', effectiveFrom: '2026-01-01',
    sourceDocument: 'IMDG Code 2024 Edition (Amendment 42-24)',
    sourceUrl: 'https://www.imo.org/en/publications/pages/imdg%20code.aspx',
    clause: 'Mandatory application date published by IMO', evaluator: 'DangerousGoodsPrecheck',
    requiredInputs: ['dangerousGoodsDeclaration', 'classification', 'packingCertificate']
  }),
  rule({
    id: 'CTU-2014-PACKING-COG', title: 'CTU Code packing and centre-of-gravity guidance', authority: 'UNECE/ILO/IMO',
    jurisdiction: 'INTERNATIONAL', scope: 'LOAD_DISTRIBUTION', level: 'ENGINEERING_GUIDANCE', effectiveFrom: '2014-11-03',
    sourceDocument: 'IMO/ILO/UNECE Code of Practice for Packing of Cargo Transport Units (CTU Code), 2014',
    sourceUrl: 'https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102046/3%2BPrinciples%2Bof%2Bpacking',
    clause: 'Annex 7, section 3; general ±5%, particular circumstances up to ±10%', evaluator: 'LoadDistributionAnalyzer',
    requiredInputs: ['itemMass', 'placementGeometry', 'containerGeometry']
  }),
  rule({
    id: 'CTU-2014-CONCENTRATED-LOAD', title: 'Concentrated floor load requires CTU operator consultation', authority: 'UNECE/ILO/IMO',
    jurisdiction: 'INTERNATIONAL', scope: 'CONCENTRATED_LOAD', level: 'ENGINEERING_GUIDANCE', effectiveFrom: '2014-11-03',
    sourceDocument: 'CTU Code Annex 7 Appendix 4',
    sourceUrl: 'https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102061/Appendix%2B4.%2BSpecific%2Bpacking%2Band%2Bsecuring%2Bcalculations',
    clause: 'Specific packing and securing calculations', evaluator: 'LoadDistributionAnalyzer',
    requiredInputs: ['itemMass', 'loadedFootprint', 'operatorFloorLimit']
  }),
  rule({
    id: 'CTU-2014-TRANSPORT-ACCELERATION', title: 'CTU transport acceleration coefficients', authority: 'UNECE/ILO/IMO',
    jurisdiction: 'INTERNATIONAL', scope: 'TRANSPORT_SECURING', level: 'ENGINEERING_GUIDANCE', effectiveFrom: '2014-11-03',
    sourceDocument: 'CTU Code Chapter 5',
    sourceUrl: 'https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23101848/Chapter%2B5.%2BGeneral%2Btransport%2Bconditions',
    clause: 'Tables 2–4 road, rail and sea acceleration coefficients', evaluator: 'TransportSecuringAnalyzer',
    requiredInputs: ['transportMode', 'routeSeaArea', 'frictionCoefficient', 'blockingCapacity', 'lashingCapacity']
  }),
  rule({
    id: 'CTU-2014-SECURING', title: 'Cargo securing in CTUs', authority: 'UNECE/ILO/IMO', jurisdiction: 'INTERNATIONAL',
    scope: 'TRANSPORT_SECURING', level: 'ENGINEERING_GUIDANCE', effectiveFrom: '2014-11-03',
    sourceDocument: 'CTU Code Annex 7 section 4',
    sourceUrl: 'https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102048/4%2BSecuring%2Bof%2Bcargo%2Bin%2BCTUs',
    clause: 'Blocking, bracing, friction and lashing principles', evaluator: 'TransportSecuringAnalyzer',
    requiredInputs: ['frictionCoefficient', 'lashingStrength', 'lashingAngle', 'blockingCapacity']
  }),
  rule({
    id: 'CTU-REVISION-2025-DRAFT', title: 'CTU Code revision work programme', authority: 'UNECE', jurisdiction: 'INTERNATIONAL',
    scope: 'ALL', level: 'ENGINEERING_GUIDANCE', effectiveFrom: '2025-01-01', status: 'DRAFT',
    sourceDocument: 'UNECE Group of Experts on CTU Code revision working documents',
    sourceUrl: 'https://unece.org/info/events/event/406814', clause: 'Draft revision activity; not operative text', evaluator: null,
    requiredInputs: []
  }),
  rule({
    id: 'ISPM-15-2018', title: 'Regulation of wood packaging material in international trade', authority: 'IPPC',
    jurisdiction: 'INTERNATIONAL', scope: 'WOOD_PACKAGING', level: 'LEGAL_REQUIREMENT', effectiveFrom: '2018-04-01',
    sourceDocument: 'ISPM 15 (2018)',
    sourceUrl: 'https://www.ippc.int/en/core-activities/standards-setting/ispms/',
    clause: 'Raw wood packaging/dunnage; processed wood and wood 6 mm or less excluded', evaluator: 'WoodPackagingPrecheck',
    requiredInputs: ['woodPackagingType', 'treatmentMark']
  }),
  rule({
    id: 'CN-SHIP-SAFETY-2022-VGM', title: 'China ship safety supervision VGM requirements', authority: 'PRC Ministry of Transport',
    jurisdiction: 'CHINA', scope: 'VGM', level: 'LEGAL_REQUIREMENT', effectiveFrom: '2022-09-26',
    sourceDocument: 'Rules on Supervision and Administration of Ship Safety (2022 amendment)',
    sourceUrl: 'https://xxgk.mot.gov.cn/2020/jigou/fgs/202209/t20220928_3687057.html',
    clause: 'Articles 47 and 55; Methods 1/2, max gross and enforcement tolerance', evaluator: 'MassAndVGMAnalyzer',
    requiredInputs: ['verifiedGrossMass', 'verificationMethod', 'shipperDeclaration', 'maximumOperatingGrossMass']
  }),
  rule({
    id: 'CN-SHIP-DG-2024-14', title: 'China ship-carried dangerous goods safety rules', authority: 'PRC Ministry of Transport',
    jurisdiction: 'CHINA', scope: 'DANGEROUS_GOODS', level: 'LEGAL_REQUIREMENT', effectiveFrom: '2025-03-01',
    sourceDocument: 'Ministry of Transport Order 2024 No. 14',
    sourceUrl: 'https://xxgk.mot.gov.cn/2020/jigou/fgs/202501/t20250120_4162806.html',
    clause: 'Packaged dangerous goods comply with IMDG; required documents/certificate', evaluator: 'DangerousGoodsPrecheck',
    requiredInputs: ['dangerousGoodsDeclaration', 'classification', 'packingCertificate']
  }),
  rule({
    id: 'CN-PORT-DG-2023-8', title: 'China port dangerous goods safety rules', authority: 'PRC Ministry of Transport',
    jurisdiction: 'CHINA', scope: 'DANGEROUS_GOODS', level: 'LEGAL_REQUIREMENT', effectiveFrom: '2023-08-03',
    sourceDocument: 'Port Dangerous Goods Safety Administration Rules (2023 amendment)',
    sourceUrl: 'https://xxgk.mot.gov.cn/2020/jigou/fgs/202308/t20230818_3892676.html',
    clause: 'Port dangerous-goods declaration and operational controls', evaluator: 'DangerousGoodsPrecheck',
    requiredInputs: ['terminalDeclaration', 'dangerousGoodsApproval']
  }),
  rule({
    id: 'CN-WPM-DECREE-69-2018', title: 'China inbound wood packaging quarantine measures', authority: 'GACC/AQSIQ',
    jurisdiction: 'CHINA', scope: 'WOOD_PACKAGING', level: 'LEGAL_REQUIREMENT', effectiveFrom: '2018-04-28', effectiveTo: '2026-10-31',
    sourceDocument: 'Measures for Quarantine Supervision and Administration of Wood Packaging of Inbound Goods, Decree 69 (2018 revision)',
    sourceUrl: 'https://www.beijing.gov.cn/gate/big5/www.beijing.gov.cn/zhengce/zhengcefagui/qtwj/202307/t20230720_3177163.html',
    clause: 'Treatment/mark for regulated raw wood; processed wood and wood 6 mm or less excluded', evaluator: 'WoodPackagingPrecheck',
    requiredInputs: ['woodPackagingType', 'treatmentMark']
  }),
  rule({
    id: 'CN-GACC-ORDER-283-2026', title: 'GACC Order 283 amendment for inbound wood packaging', authority: 'GACC',
    jurisdiction: 'CHINA', scope: 'WOOD_PACKAGING', level: 'LEGAL_REQUIREMENT', effectiveFrom: '2026-11-01', status: 'FUTURE',
    sourceDocument: 'GACC Order 283',
    sourceUrl: 'https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202607/t20260728_537894.html',
    clause: 'Effective 1 November 2026; must not override the active rule before that date', evaluator: 'WoodPackagingPrecheck',
    requiredInputs: ['woodPackagingType', 'treatmentMark']
  }),
  rule({
    id: 'BIC-ISO-6346-TYPE-CODE', title: 'ISO 6346 size/type code reference', authority: 'BIC', jurisdiction: 'INTERNATIONAL',
    scope: 'EQUIPMENT', level: 'REFERENCE_DATA', effectiveFrom: '1995-01-01',
    sourceDocument: 'BIC ISO 6346 size and type code database', sourceUrl: 'https://www.bic-code.org/size-type-code/',
    clause: '22G1, 42G1 and 45G1 dry-container designations', evaluator: 'EquipmentPlanningService',
    requiredInputs: ['equipmentType']
  }),
  rule({
    id: 'MAERSK-DRY-EQUIPMENT-REFERENCE', title: 'Dry equipment dimensional reference', authority: 'Maersk', jurisdiction: 'CARRIER_REFERENCE',
    scope: 'EQUIPMENT', level: 'REFERENCE_DATA', effectiveFrom: '2024-01-01',
    sourceDocument: 'Maersk dry cargo equipment flyer',
    sourceUrl: 'https://www.maersk.com/~/media_sc9/maersk/local-information/files/europe/greece/import/equipment-flyer.pdf',
    clause: 'Nominal internal dimensions, door opening, tare, payload and max gross', evaluator: 'EquipmentPlanningService',
    requiredInputs: ['equipmentType']
  }),
  rule({
    id: 'NBSCT-OPERATION-SNAPSHOT', title: 'NBSCT gate-in process and reweigh service snapshot', authority: 'Ningbo-Zhoushan Port NBSCT',
    jurisdiction: 'NINGBO_TERMINAL', scope: 'TERMINAL_ADMISSION', level: 'PORT_TERMINAL_CONSTRAINT', effectiveFrom: '2024-01-01', status: 'UNKNOWN',
    sourceDocument: 'NBSCT public service process and FAQ pages',
    sourceUrl: 'https://www.nbport.com.cn/nbsct/mtfwzy/ywlc/',
    clause: 'Published normal/reefer/DG gate-in flow; public information is not live acceptance', evaluator: 'TerminalAdmissionPrecheck',
    requiredInputs: ['carrierBooking', 'voyageAcceptance', 'terminalAcceptance']
  })
]);

function rule(input) {
  const registryKind = input.level === 'REFERENCE_DATA' ? 'REFERENCE'
    : input.level === 'ENGINEERING_GUIDANCE' ? 'GUIDANCE' : 'RULE';
  return Object.freeze({
    version: '2.5', registryKind, sourceType: 'OFFICIAL_PRIMARY_SOURCE', verifiedAt: '2026-08-24',
    applicability: 'Resolved by case date, jurisdiction, route and cargo facts', visualization: 'RULE_TO_DOMAIN_AND_SPATIAL_EVIDENCE',
    effectiveTo: null, status: 'ACTIVE', ...input
  });
}

function resolveRules({ caseDate = '2026-08-24', jurisdictions = ['INTERNATIONAL', 'CHINA'], scopes = [] } = {}) {
  const asOf = isoDate(caseDate);
  const scopeSet = new Set(scopes.map(normalize));
  const jurisdictionSet = new Set(jurisdictions.map(normalize));
  return RULES.map((entry) => ({ ...entry, resolvedStatus: resolveStatus(entry, asOf) }))
    .filter((entry) => jurisdictionSet.has(normalize(entry.jurisdiction)) || ['CARRIER_REFERENCE', 'NINGBO_TERMINAL'].includes(entry.jurisdiction))
    .filter((entry) => scopeSet.size === 0 || entry.scope === 'ALL' || scopeSet.has(normalize(entry.scope)));
}

function activeRules(input = {}) {
  return resolveRules(input).filter((entry) => entry.resolvedStatus === 'ACTIVE');
}

function resolveStatus(entry, asOf) {
  if (entry.status === 'DRAFT' || entry.status === 'UNKNOWN' || entry.status === 'SUPERSEDED') return entry.status;
  if (entry.effectiveFrom && asOf < entry.effectiveFrom) return 'FUTURE';
  if (entry.effectiveTo && asOf > entry.effectiveTo) return 'SUPERSEDED';
  return 'ACTIVE';
}

function isoDate(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '2026-08-24';
}

function normalize(value) { return String(value || '').trim().toUpperCase(); }

module.exports = { RULES, resolveRules, activeRules, resolveStatus };
