import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { planningFingerprint } from '../../domain/plan/planRevision.js';
import { generateLocalPreview } from '../../domain/container/localPreview.js';
import { getContainer } from '../../domain/container/catalog.js';
import { normalizePlanSource } from '../../domain/provenance/planSource.js';
import { buildActivePlanViewModel } from '../../domain/plan/activePlanViewModel.js';
import { loadSession, saveSession } from './sessionStorage.js';
import { SESSION_ACTIONS, sessionReducer } from './sessionReducer.js';
import {getPackingCase} from '../../services/caseApi.js';
import {sessionFromPackingCase} from '../../domain/session/taskPersistence.js';

// Vite can refresh the provider before its consumers. Preserve context identity
// across that boundary so a live workspace never falls outside its provider.
const SessionContext = import.meta.hot?.data.sessionContext || createContext(null);
if (import.meta.hot) import.meta.hot.data.sessionContext = SessionContext;

export function SessionProvider({ children }) {
  const [session, dispatch] = useReducer(sessionReducer, undefined, () => loadSession());
  const [restoreState,setRestoreState]=useState(()=>new URLSearchParams(window.location.search).get('case')?'LOADING':null);
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('case');
    if(!id)return undefined;
    const controller=new AbortController();
    getPackingCase(id,{signal:controller.signal})
      .then(record=>{if(!controller.signal.aborted){dispatch({type:SESSION_ACTIONS.CASE_RESTORE,session:sessionFromPackingCase(record)});setRestoreState(null);}})
      .catch(error=>{if(!controller.signal.aborted){dispatch({type:SESSION_ACTIONS.CASE_SYNC_FAILURE,error:error.message});setRestoreState(error.message);}});
    return ()=>controller.abort();
  },[]);
  const container = useMemo(() => session.solverMode==='SOURCE_BENCHMARK' ? session.sourceContainer : getContainer(session.selectedContainerType), [session.selectedContainerType,session.solverMode,session.sourceContainer]);
  const fingerprint = useMemo(
    () => planningFingerprint(session),
    [session]
  );
  const localPreview = useMemo(
    () => session.solverMode==='SOURCE_BENCHMARK'?{containerInfo:container,loadedCargo:[],unloadedCargo:[],totalCargoCount:0,totalCargoInput:session.cargo.reduce((s,c)=>s+c.quantity,0),totalWeight:null,cog:null,cogOffset:null,spaceUtilization:0,source:'local-preview',sourceCode:'LOCAL_PREVIEW',solverMode:'SOURCE_BENCHMARK',executionStatus:session.executionStatus}:generateLocalPreview(session.cargo, container),
    [session.cargo, container,session.solverMode,session.executionStatus]
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
    stalePlan: session.stalePlan || (session.backendPlan && !backendPlanIsCurrent ? session.backendPlan : null),
    latestPlanDiff: session.latestPlanDiff || null,
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

  // A requested case must never display another task's cached formal plan.
  return <SessionContext.Provider value={value}>{restoreState?<section role={restoreState==='LOADING'?'status':'alert'}><h1>{restoreState==='LOADING'?'正在读取指定任务':'指定任务读取失败'}</h1><p>{restoreState==='LOADING'?'正在核对任务与已保存方案身份。':restoreState}</p><button type="button" onClick={()=>window.location.reload()}>重新读取</button></section>:children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
