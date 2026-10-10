import { normalizeCargo } from '../cargo/cargo.js';
import { createInitialCargo, INITIAL_DATASET_ID, INITIAL_ORDER } from '../cargo/initialDataset.js';
import { WORKSITE_DEMO } from '../cargo/worksiteDemo.js';

export const SESSION_SCHEMA_VERSION = 7;

function initialCargo() {
  return createInitialCargo().map(normalizeCargo);
}

export function createInitialSession({ dataset = 'worksite' } = {}) {
  const now = new Date().toISOString();
  const legacy = dataset === 'legacy';
  const cargo = legacy ? initialCargo() : WORKSITE_DEMO.items.map(normalizeCargo);
  const orderNo = legacy ? INITIAL_ORDER.orderNo : WORKSITE_DEMO.orderNo;
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    order: { ...INITIAL_ORDER, orderNo, createdAt: now },
    datasetId: legacy ? INITIAL_DATASET_ID : WORKSITE_DEMO.id,
    dataClassification: 'DEMO_DATA',
    cargo,
    selectedContainerType: legacy ? '40HQ' : WORKSITE_DEMO.containerType,
    containerMode: 'REFERENCE_PROFILE',
    actualContainer: null,
    caseContext: {
      caseId: orderNo,
      caseDate: '2026-08-24',
      origin: 'Ningbo, CN',
      destination: 'Antwerp, BE',
      terminal: 'NBSCT',
      carrier: 'UNKNOWN',
      voyage: 'UNKNOWN',
      bookingReference: null,
      terminalAcceptanceReference: null,
      route: [
        { portSequence: 1, portCode: 'HAM', name: 'Hamburg' },
        { portSequence: 2, portCode: 'RTM', name: 'Rotterdam' },
        { portSequence: 3, portCode: 'ANR', name: 'Antwerp' }
      ]
    },
    massEvidence: { packagingMassKg: null, palletMassKg: null, dunnageMassKg: null, securingMassKg: null },
    vgm: { declaredVGMKg: null, method: null, shipperDeclaration: false, verifiedEvidence: false, measuredGrossMassKg: null },
    transport: { mode: 'SEA', seaArea: 'B' },
    securingInputs: { frictionCoefficient: null, blockingCapacityDaN: null, lashings: [] },
    backendPlan: null,
    backendPlanFingerprint: null,
    selectedStrategy: 'SPACE',
    strategyPlans: {},
    planStatus: 'preview',
    planError: null,
    twinReviewedAt: null,
    packingCase: null,
    caseSyncError: null,
    aiAudit: null,
    aiAuditStatus: 'idle',
    aiAuditError: null,
    vgmSubmitted: false,
    manualReview: null,
    complianceHistory: [],
    lastSavedAt: now,
    dataSource: {
      order: legacy ? 'DEMO DATA · 212 件高密度案例' : 'DEMO DATA · 现场作业混合包装',
      cargo: `DEMO DATA · ${cargo.reduce((sum,c)=>sum+c.quantity,0)} 件约束货物`,
      plan: 'LOCAL_PREVIEW',
      compliance: '确定性规则'
    }
  };
}
