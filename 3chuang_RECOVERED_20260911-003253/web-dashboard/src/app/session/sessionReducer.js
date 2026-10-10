import { createCargoId, normalizeCargo } from '../../domain/cargo/cargo.js';
import { createInitialSession } from '../../domain/session/initialSession.js';
import { createPlanRevision, immutableSnapshot, planningFingerprint } from '../../domain/plan/planRevision.js';

export const SESSION_ACTIONS = Object.freeze({
  SET_CONTAINER: 'session/set-container',
  SET_CONTAINER_MODE: 'session/set-container-mode',
  SET_ACTUAL_CONTAINER: 'session/set-actual-container',
  SET_CASE_CONTEXT: 'session/set-case-context',
  SET_MASS_EVIDENCE: 'session/set-mass-evidence',
  SET_VGM_EVIDENCE: 'session/set-vgm-evidence',
  READINESS_UPDATE: 'session/readiness-update',
  SET_SECURING_INPUTS: 'session/set-securing-inputs',
  CONFIGURE_PACKAGING:'session/configure-packaging',
  ADD_CARGO: 'session/add-cargo',
  UPDATE_CARGO: 'session/update-cargo',
  DUPLICATE_CARGO: 'session/duplicate-cargo',
  DELETE_CARGO: 'session/delete-cargo',
  IMPORT_CARGO: 'session/import-cargo',
  BULK_UPDATE: 'session/bulk-update',
  SET_VGM: 'session/set-vgm',
  PLAN_REQUEST: 'session/plan-request',
  PLAN_SUCCESS: 'session/plan-success',
  PLAN_FAILURE: 'session/plan-failure',
  SET_STRATEGY: 'session/set-strategy',
  STRATEGY_PLANS_SUCCESS: 'session/strategy-plans-success',
  TWIN_REVIEWED: 'session/twin-reviewed',
  RECORD_TWIN_OBSERVATION: 'session/record-twin-observation',
  CASE_SYNC_SUCCESS: 'session/case-sync-success',
  CASE_SYNC_FAILURE: 'session/case-sync-failure',
  CASE_RESTORE: 'session/case-restore',
  AI_REQUEST: 'session/ai-request',
  AI_SUCCESS: 'session/ai-success',
  AI_FAILURE: 'session/ai-failure',
  MANUAL_REVIEW: 'session/manual-review',
  RESET: 'session/reset'
});

function nowIso(action) {
  return action?.at || new Date().toISOString();
}

function invalidateComputed(state, action, patch) {
  const stalePlan = state.backendPlan || state.stalePlan || null;
  return {
    ...state,
    ...patch,
    planHistory: archiveCurrentPlan(state, action),
    backendPlan: null,
    backendPlanFingerprint: null,
    stalePlan,
    staleReason: action.reason || '货物、箱体或约束已变更，上一版方案不再适用于当前输入。',
    invalidatedAt: nowIso(action),
    pendingPlanRequest: null,
    latestPlanDiff: null,
    executionStatus: { ...state.executionStatus, solve: 'NOT_RUN', validation: 'NOT_RUN', businessReadiness: 'NOT_VERIFIED' },
    strategyPlans: {},
    planStatus: stalePlan ? 'stale' : 'preview',
    planError: null,
    aiAudit: null,
    aiAuditStatus: 'idle',
    aiAuditError: null,
    manualReview: null,
    twinReviewedAt: null,
    packingCase: state.packingCase ? { ...state.packingCase, status: 'DRAFT', packingPlanId: null, updatedAt: nowIso(action) } : null,
    lastSavedAt: nowIso(action),
    dataSource: {
      ...state.dataSource,
      plan: 'LOCAL_PREVIEW',
      compliance: '确定性规则'
    }
  };
}

function archiveCurrentPlan(state, action) {
  const history = state.planHistory || [];
  const plan = state.backendPlan;
  if (!plan?.planId || history.some(entry => entry.plan.planId === plan.planId)) return history;
  return [...history, immutableSnapshot({ plan, fingerprint: state.backendPlanFingerprint, cargoSnapshot: state.cargo,
    archivedAt: nowIso(action), caseId: state.packingCase?.caseId || state.order?.orderNo,
    containerType: state.selectedContainerType })];
}

function acceptsPlanResponse(state, action) {
  const request = state.pendingPlanRequest;
  return Boolean(request && action.requestId === request.requestId && action.fingerprint === request.fingerprint
    && request.fingerprint === planningFingerprint(state));
}

function revisionPatch(state, plan, action) {
  const revisions = state.planRevisions || [];
  const previous = revisions.findLast(revision => revision.planId === (state.backendPlan || state.stalePlan)?.planId)
    || (state.planHistory || []).at(-1);
  const revision = createPlanRevision({ session: state, plan, fingerprint: action.fingerprint, at: nowIso(action), previous });
  return { planRevisions: [...revisions, revision], latestPlanDiff: revision.diff, stalePlan: null, staleReason: null, invalidatedAt: null, pendingPlanRequest: null };
}

export function sessionReducer(state, action) {
  switch (action.type) {
    case SESSION_ACTIONS.CASE_RESTORE:
      return action.session;
    case SESSION_ACTIONS.SET_CONTAINER:
      if (!action.containerType || action.containerType === state.selectedContainerType) return state;
      return invalidateComputed(state, action, { selectedContainerType: action.containerType });

    case SESSION_ACTIONS.SET_CONTAINER_MODE: {
      const containerMode = String(action.mode || '').toUpperCase();
      if (!['REFERENCE_PROFILE', 'ACTUAL_CONTAINER'].includes(containerMode) || containerMode === state.containerMode) return state;
      return invalidateComputed(state, action, { containerMode });
    }

    case SESSION_ACTIONS.SET_ACTUAL_CONTAINER:
      return invalidateComputed(state, action, { actualContainer: { ...(state.actualContainer || {}), ...(action.patch || {}) } });

    case SESSION_ACTIONS.SET_CASE_CONTEXT:
      return invalidateComputed(state, action, { caseContext: { ...state.caseContext, ...(action.patch || {}) } });

    case SESSION_ACTIONS.SET_MASS_EVIDENCE:
      return { ...invalidateComputed(state, action, { massEvidence: { ...state.massEvidence, ...(action.patch || {}) } }) };

    case SESSION_ACTIONS.READINESS_UPDATE: {
      if(state.backendPlan?.planId!==action.basePlanId || state.backendPlanFingerprint !== planningFingerprint(state))return state;
      if (action.baseFingerprint !== state.backendPlanFingerprint) return state;
      const withReadiness=(plan,readiness)=>plan && readiness?{...plan,shipmentReadiness:readiness,ext_shipmentReadiness:readiness}:plan;
      return {...state,vgm:action.vgm,backendPlanFingerprint:planningFingerprint({...state,vgm:action.vgm}),
        backendPlan:withReadiness(state.backendPlan,action.readiness),
        strategyPlans:Object.fromEntries(Object.entries(state.strategyPlans || {}).map(([key,plan])=>[key,withReadiness(plan,action.strategyReadiness?.[key])])),
        lastSavedAt:nowIso(action),aiAudit:null,aiAuditStatus:'idle',manualReview:null};
    }
    case SESSION_ACTIONS.SET_VGM_EVIDENCE: {
      const vgm = { ...state.vgm, ...(action.patch || {}) };
      return {
        ...invalidateComputed(state, action, { vgm }), vgmSubmitted: Boolean(vgm.declaredVGMKg && vgm.method && vgm.shipperDeclaration),
        aiAudit: null, aiAuditStatus: 'idle', aiAuditError: null, manualReview: null, lastSavedAt: nowIso(action)
      };
    }

    case SESSION_ACTIONS.SET_SECURING_INPUTS:
      return invalidateComputed(state, action, { securingInputs: { ...state.securingInputs, ...(action.patch || {}) } });

    case SESSION_ACTIONS.ADD_CARGO: {
      const cargo = normalizeCargo({ ...action.cargo, cargoId: action.cargo?.cargoId || createCargoId('cargo') });
      return invalidateComputed(state, action, { cargo: [...state.cargo, cargo] });
    }

    case SESSION_ACTIONS.UPDATE_CARGO: {
      const exists = state.cargo.some((cargo) => cargo.cargoId === action.cargoId);
      if (!exists) return state;
      const cargo = state.cargo.map((item) => (
        item.cargoId === action.cargoId
          ? normalizeCargo({ ...item, ...action.patch, cargoId: item.cargoId })
          : item
      ));
      return invalidateComputed(state, action, { cargo });
    }

    case SESSION_ACTIONS.DUPLICATE_CARGO: {
      const source = state.cargo.find((cargo) => cargo.cargoId === action.cargoId);
      if (!source) return state;
      const copy = normalizeCargo({
        ...source,
        cargoId: action.newCargoId || createCargoId('cargo'),
        sku: action.sku || `${source.sku}-COPY`,
        name: action.name || `${source.name}（副本）`
      });
      const index = state.cargo.indexOf(source);
      const cargo = [...state.cargo.slice(0, index + 1), copy, ...state.cargo.slice(index + 1)];
      return invalidateComputed(state, action, { cargo });
    }

    case SESSION_ACTIONS.DELETE_CARGO: {
      if (!state.cargo.some((cargo) => cargo.cargoId === action.cargoId)) return state;
      return invalidateComputed(state, action, { cargo: state.cargo.filter((cargo) => cargo.cargoId !== action.cargoId) });
    }

    case SESSION_ACTIONS.CONFIGURE_PACKAGING:
      return invalidateComputed(state,action,{cargo:action.cargo});
    case SESSION_ACTIONS.IMPORT_CARGO: {
      const imported = (action.cargo || []).map((cargo) => normalizeCargo({
        ...cargo,
        cargoId: cargo.cargoId || createCargoId('csv')
      }));
      if (!imported.length) return state;
      return invalidateComputed(state, action, { cargo: [...state.cargo, ...imported] });
    }

    case SESSION_ACTIONS.BULK_UPDATE: {
      const selected = new Set(action.cargoIds || []);
      if (!selected.size) return state;
      const cargo = state.cargo.map((item) => (
        selected.has(item.cargoId)
          ? normalizeCargo({ ...item, ...action.patch, cargoId: item.cargoId })
          : item
      ));
      return invalidateComputed(state, action, { cargo });
    }

    case SESSION_ACTIONS.SET_VGM:
      return {
        ...invalidateComputed(state, action, {}),
        vgmSubmitted: Boolean(action.value),
        vgm: { ...state.vgm, shipperDeclaration: Boolean(action.value) },
        aiAudit: null,
        aiAuditStatus: 'idle',
        aiAuditError: null,
        manualReview: null,
        twinReviewedAt: null,
        lastSavedAt: nowIso(action),
        dataSource: { ...state.dataSource, compliance: '确定性规则（VGM 状态已更新）' }
      };

    case SESSION_ACTIONS.PLAN_REQUEST:
      if (!action.requestId || action.fingerprint !== planningFingerprint(state)) return state;
      return { ...state, planStatus: 'loading', planError: null,
        pendingPlanRequest: { requestId: action.requestId, fingerprint: action.fingerprint } };

    case SESSION_ACTIONS.PLAN_SUCCESS:
      if (!acceptsPlanResponse(state, action)) return state;
      return {
        ...state,
        ...revisionPatch(state, action.plan, action),
        recoveryNotice:null,
        planHistory: archiveCurrentPlan(state, action),
        backendPlan: action.plan,
        backendPlanFingerprint: action.fingerprint,
        planStatus: 'ready',
        planError: null,
        aiAudit: null,
        aiAuditStatus: 'idle',
        aiAuditError: null,
        manualReview: null,
        lastSavedAt: nowIso(action),
        dataSource: { ...state.dataSource, plan: 'BACKEND_SOLVED', compliance: '确定性规则' }
      };

    case SESSION_ACTIONS.PLAN_FAILURE:
      if (!acceptsPlanResponse(state, action)) return state;
      return { ...state, pendingPlanRequest: null, planStatus: 'error', planError: action.error || '装箱方案生成失败' };

    case SESSION_ACTIONS.SET_STRATEGY: {
      const strategy = String(action.strategy || '').toUpperCase();
      if (!['SPACE', 'BALANCE', 'OPERATION'].includes(strategy) || strategy === state.selectedStrategy || state.planStatus === 'loading') return state;
      const plan = state.strategyPlans?.[strategy] || state.backendPlan;
      return {
        ...state,
        selectedStrategy: strategy,
        backendPlan: plan,
        planStatus: plan ? 'ready' : state.planStatus,
        twinReviewedAt: null,
        aiAudit: null,
        aiAuditStatus: 'idle',
        manualReview: null,
        lastSavedAt: nowIso(action)
      };
    }

    case SESSION_ACTIONS.STRATEGY_PLANS_SUCCESS: {
      if (!acceptsPlanResponse(state, action)) return state;
      const selectedStrategy = String(action.selectedStrategy || state.selectedStrategy || 'SPACE').toUpperCase();
      const strategyPlans = { ...(action.plans || {}) };
      const backendPlan = strategyPlans[selectedStrategy] || Object.values(strategyPlans)[0] || null;
      return {
        ...state,
        ...(backendPlan ? revisionPatch(state, backendPlan, action) : { pendingPlanRequest: null }),
        recoveryNotice:null,
        planHistory: archiveCurrentPlan(state, action),
        selectedStrategy,
        strategyPlans,
        backendPlan,
        executionStatus: {...state.executionStatus,...(backendPlan?.executionStatus||{})},
        backendPlanFingerprint: action.fingerprint,
        planStatus: backendPlan ? 'ready' : 'error',
        planError: backendPlan ? null : '策略方案生成失败',
        aiAudit: null,
        aiAuditStatus: 'idle',
        aiAuditError: null,
        manualReview: null,
        twinReviewedAt: null,
        lastSavedAt: nowIso(action),
        dataSource: { ...state.dataSource, plan: 'BACKEND_SOLVED', compliance: '确定性规则' }
      };
    }

    case SESSION_ACTIONS.TWIN_REVIEWED:
      if (!state.backendPlan || state.twinReviewedAt) return state;
      return { ...state, twinReviewedAt: nowIso(action), lastSavedAt: nowIso(action) };

    case SESSION_ACTIONS.RECORD_TWIN_OBSERVATION:
      if (!action.observation?.cargoId || !action.observation?.source || !action.observation?.status) return state;
      return { ...state, twinObservations: [...(state.twinObservations || []), immutableSnapshot({ ...action.observation, at: action.observation.at || nowIso(action) })], lastSavedAt: nowIso(action) };

    case SESSION_ACTIONS.CASE_SYNC_SUCCESS:
      if (action.basePlanId && state.backendPlan?.planId !== action.basePlanId) return state;
      return {
        ...state,
        packingCase: action.packingCase,
        executionStatus: {...state.executionStatus, ...(action.packingCase.contextSnapshot?.executionStatus || {}), persistence:'SAVED'},
        caseSyncError: null,
        lastSavedAt: nowIso(action)
      };

    case SESSION_ACTIONS.CASE_SYNC_FAILURE:
      if (action.basePlanId && state.backendPlan?.planId !== action.basePlanId) return state;
      return { ...state, executionStatus:{...state.executionStatus,persistence:'FAILED'}, caseSyncError: action.error || '装箱任务同步失败' };

    case SESSION_ACTIONS.AI_REQUEST:
      if (state.aiAuditStatus === 'loading') return state;
      return { ...state, aiAuditStatus: 'loading', aiAuditError: null };

    case SESSION_ACTIONS.AI_SUCCESS: {
      const at = nowIso(action);
      const audit = { ...action.audit, completedAt: action.audit?.completedAt || at };
      return {
        ...state,
        aiAudit: audit,
        aiAuditStatus: 'ready',
        aiAuditError: null,
        manualReview: null,
        complianceHistory: [...state.complianceHistory, {
          id: action.historyId || `ai_${at}`,
          type: 'ai-audit',
          at,
          status: audit.status,
          score: audit.score,
          source: audit.source || 'backend-deterministic-with-ai-explanation'
        }],
        lastSavedAt: at,
        dataSource: { ...state.dataSource, compliance: '本地规则 + 后端确定性复核 + AI 解释' }
      };
    }

    case SESSION_ACTIONS.AI_FAILURE:
      return {
        ...state,
        aiAuditStatus: 'error',
        aiAuditError: action.error || 'AI 审计失败',
        aiAudit: null,
        manualReview: null
      };

    case SESSION_ACTIONS.MANUAL_REVIEW: {
      const at = nowIso(action);
      const review = { ...action.review, reviewedAt: action.review?.reviewedAt || at };
      return {
        ...state,
        manualReview: review,
        complianceHistory: [...state.complianceHistory, {
          id: action.historyId || `manual_${at}`,
          type: 'manual-review',
          at,
          reviewer: review.reviewer,
          decision: review.decision,
          note: review.note || '',
          basedOnAiStatus: state.aiAudit?.status || null,
          basedOnAiScore: state.aiAudit?.score ?? null
        }],
        lastSavedAt: at,
        dataSource: { ...state.dataSource, compliance: '规则 + AI 解释 + 人工复核结论' }
      };
    }

    case SESSION_ACTIONS.RESET:
      return action.session || createInitialSession();

    default:
      return state;
  }
}
