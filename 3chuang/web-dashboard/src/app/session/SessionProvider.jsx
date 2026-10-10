import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { cargoFingerprint } from '../../domain/cargo/cargo.js';
import { generateLocalPreview } from '../../domain/container/localPreview.js';
import { getContainer } from '../../domain/container/catalog.js';
import { normalizePlanSource } from '../../domain/provenance/planSource.js';
import { buildActivePlanViewModel } from '../../domain/plan/activePlanViewModel.js';
import { loadSession, saveSession } from './sessionStorage.js';
import { SESSION_ACTIONS, sessionReducer } from './sessionReducer.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, dispatch] = useReducer(sessionReducer, undefined, () => loadSession());
  const container = useMemo(() => getContainer(session.selectedContainerType), [session.selectedContainerType]);
  const fingerprint = useMemo(
    () => cargoFingerprint(session.cargo, session.selectedContainerType),
    [session.cargo, session.selectedContainerType]
  );
  const localPreview = useMemo(
    () => generateLocalPreview(session.cargo, container),
    [session.cargo, container]
  );
  const backendPlanIsCurrent = Boolean(session.backendPlan && session.backendPlanFingerprint === fingerprint);
  const activePlan = backendPlanIsCurrent ? session.backendPlan : localPreview;
  const activePlanView = useMemo(
    () => buildActivePlanViewModel({ session, plan: activePlan, container }),
    [session, activePlan, container]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => saveSession(session), 120);
    return () => window.clearTimeout(timer);
  }, [session]);

  const setContainerType = useCallback((containerType) => dispatch({ type: SESSION_ACTIONS.SET_CONTAINER, containerType }), []);
  const setContainerMode = useCallback((mode) => dispatch({ type: SESSION_ACTIONS.SET_CONTAINER_MODE, mode }), []);
  const setActualContainer = useCallback((patch) => dispatch({ type: SESSION_ACTIONS.SET_ACTUAL_CONTAINER, patch }), []);
  const setCaseContext = useCallback((patch) => dispatch({ type: SESSION_ACTIONS.SET_CASE_CONTEXT, patch }), []);
  const setMassEvidence = useCallback((patch) => dispatch({ type: SESSION_ACTIONS.SET_MASS_EVIDENCE, patch }), []);
  const setVgmEvidence = useCallback((patch) => dispatch({ type: SESSION_ACTIONS.SET_VGM_EVIDENCE, patch }), []);
  const setSecuringInputs = useCallback((patch) => dispatch({ type: SESSION_ACTIONS.SET_SECURING_INPUTS, patch }), []);
  const addCargo = useCallback((cargo) => dispatch({ type: SESSION_ACTIONS.ADD_CARGO, cargo }), []);
  const updateCargo = useCallback((cargoId, patch) => dispatch({ type: SESSION_ACTIONS.UPDATE_CARGO, cargoId, patch }), []);
  const duplicateCargo = useCallback((cargoId, overrides = {}) => dispatch({ type: SESSION_ACTIONS.DUPLICATE_CARGO, cargoId, ...overrides }), []);
  const deleteCargo = useCallback((cargoId) => dispatch({ type: SESSION_ACTIONS.DELETE_CARGO, cargoId }), []);
  const importCargo = useCallback((cargo) => dispatch({ type: SESSION_ACTIONS.IMPORT_CARGO, cargo }), []);
  const bulkUpdateCargo = useCallback((cargoIds, patch) => dispatch({ type: SESSION_ACTIONS.BULK_UPDATE, cargoIds, patch }), []);
  const setVgmSubmitted = useCallback((value) => dispatch({ type: SESSION_ACTIONS.SET_VGM, value }), []);
  const setStrategy = useCallback((strategy) => dispatch({ type: SESSION_ACTIONS.SET_STRATEGY, strategy }), []);

  const value = useMemo(() => ({
    session,
    dispatch,
    container,
    fingerprint,
    localPreview,
    activePlan,
    activePlanView,
    planSource: normalizePlanSource(activePlan),
    planSourceCode: normalizePlanSource(activePlan),
    backendPlanIsCurrent,
    actions: {
      setContainerType,
      setContainerMode,
      setActualContainer,
      setCaseContext,
      setMassEvidence,
      setVgmEvidence,
      setSecuringInputs,
      addCargo,
      updateCargo,
      duplicateCargo,
      deleteCargo,
      importCargo,
      bulkUpdateCargo,
      setVgmSubmitted,
      setStrategy
    }
  }), [
    session,
    container,
    fingerprint,
    localPreview,
    activePlan,
    activePlanView,
    backendPlanIsCurrent,
    setContainerType,
    setContainerMode,
    setActualContainer,
    setCaseContext,
    setMassEvidence,
    setVgmEvidence,
    setSecuringInputs,
    addCargo,
    updateCargo,
    duplicateCargo,
    deleteCargo,
    importCargo,
    bulkUpdateCargo,
    setVgmSubmitted,
    setStrategy
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
