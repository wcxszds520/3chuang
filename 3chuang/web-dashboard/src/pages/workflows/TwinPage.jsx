import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { placementSpaceEvidence } from '../../domain/plan/placementSpaceEvidence.js';
import {
  Anchor,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Gauge,
  GitCompareArrows,
  History,
  Layers3,
  Package,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  SkipForward
} from 'lucide-react';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { formatPlanMetric } from '../../domain/plan/activePlanViewModel.js';
import { SESSION_ACTIONS } from '../../app/session/sessionReducer.js';
import { ROUTES } from '../../app/router.js';
import { useFeedback } from '../../components/feedback/FeedbackProvider.jsx';
import { StatusPill } from '../../components/common/Status.jsx';
import { cargoAppearanceLegend, classifyCargoAppearance } from '../../domain/cargo/appearance.js';
import { TwinScene } from '../../three/TwinScene.jsx';
import { OperationMachine } from '../../three/operation/operationMachine.js';
import { UnloadMachine, unloadOrder } from '../../three/operation/unloadMachine.js';
import {
  buildVisualizationContext,
  riskColor,
  weightColor
} from '../../three/analytics/visualizationModes.js';
import { groupOperationQueue } from '../../three/presentation/queueGroups.js';
import {
  buildOperationFilterOptions,
  createOperationFilters,
  filterOperationGroups
} from '../../three/presentation/operationFilters.js';
import { displayPort, PAGE_COPY } from '../../domain/presentation/productCopy.js';
import { zhEnum } from '../../domain/presentation/localization.js';
import { askPortcube } from '../../components/feedback/ContextAssistant.jsx';
import { getPlanSourceLabel, isBackendSolved } from '../../domain/provenance/planSource.js';
import { updatePackingCase } from '../../services/caseApi.js';

const VIEWS = [['overview', '总览'], ['door', '门侧'], ['side', '侧视'], ['top', '顶视'], ['section', '剖切'], ['follow', '跟随作业']];
const SPEEDS = [0.5, 1, 2, 4, 8];
const VISUAL_MODES = [['normal', '标准'], ['weight', '重量'], ['port', '港序'], ['space', '空间'], ['balance', '平衡'], ['risk', '风险']];
const QUALITY_TIERS = [
  ['low', '流畅', '流畅档 · 直渲染，低配演示机首选'],
  ['standard', '标准', '标准档 · 接触阴影与 SMAA 抗锯齿'],
  ['high', '极致', '极致档 · GTAO 环境光遮蔽 + 高分辨率渲染']
];

function twinDeepLink() {
  if (typeof window === 'undefined') return { analysis: 'normal', operation: null, unloadStep: 0, voidZoneId: null };
  const params = new URLSearchParams(window.location.search);
  const analysis = params.get('analysis');
  const voidZoneId = params.get('voidZone');
  return {
    analysis: voidZoneId ? 'space' : VISUAL_MODES.some(([key]) => key === analysis) ? analysis : 'normal',
    operation: params.get('operation') === 'unload' ? 'unload' : null,
    unloadStep: Math.max(0, Number(params.get('unloadStep') || (params.get('capture') === '1' ? 24 : 0))),
    voidZoneId
  };
}

export default function TwinPage({ navigate }) {
  const { session, activePlan, activePlanView, planSource, dispatch } = useSession();
  const placementSpace = useMemo(() => placementSpaceEvidence(activePlan), [activePlan]);
  const { notify } = useFeedback();
  const deepLink = useMemo(() => twinDeepLink(), []);
  const deepLinkedVoidZone = useMemo(() => {
    const model = activePlan.voidJustification || activePlan.ext_voidJustification || activePlan.metrics?.voidJustification;
    return deepLink.voidZoneId ? (model?.zones || []).find((zone) => zone.id === deepLink.voidZoneId) || null : null;
  }, [activePlan, deepLink.voidZoneId]);
  const machine = useMemo(() => {
    const instance = new OperationMachine(activePlan);
    // Review starts from the formal result; replay changes only the local machine.
    instance.jumpToCompletedCount(instance.queue.length);
    return instance;
  }, [activePlan]);
  const unloadSequence = useMemo(() => buildUnloadSequence(activePlan), [activePlan]);
  const unloadMachine = useMemo(() => new UnloadMachine(activePlan), [activePlan]);
  const [snapshot, setSnapshot] = useState(() => compact(machine.getSnapshot()));
  const [view, setView] = useState(deepLink.operation === 'unload' ? 'unload' : deepLink.voidZoneId ? 'side' : 'overview');
  // 装载回放自动进入"跟随作业"观察视图；用户一旦手动选视角就不再抢镜头。
  const autoFollowRef = useRef(false);
  const [mode, setMode] = useState('review');
  const [sceneError, setSceneError] = useState('');
  const [jumpValue, setJumpValue] = useState(1);
  const [layers, setLayers] = useState({ container: true, zones: true, labels: false, placed: true, waiting: true, path: true, target: true });
  const [debugLayers, setDebugLayers] = useState({ grid: false, void: Boolean(deepLink.voidZoneId), reserve: false, lowFill: false, securing: false });
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [filters, setFilters] = useState(() => createOperationFilters());
  const [visualizationMode, setVisualizationMode] = useState(deepLink.operation === 'unload' ? 'port' : deepLink.analysis);
  const [selectedCargo, setSelectedCargo] = useState(null);
  const [selectedVoidZone, setSelectedVoidZone] = useState(deepLinkedVoidZone);
  const [hoveredCargo, setHoveredCargo] = useState(null);
  const [isolate, setIsolate] = useState(null);
  const [quality, setQuality] = useState('standard');
  const [performance, setPerformance] = useState({ fps: 0, drawCalls: 0, triangles: 0, textures: 0, gpuMemoryApproxMb: null });
  const showDebugHud = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1', []);
  const [followRevision,setFollowRevision]=useState(0);
  const [assistantOpen,setAssistantOpen]=useState(false);
  const [locateRevision,setLocateRevision]=useState(0);
  useEffect(()=>{
    const visibility=e=>setAssistantOpen(Boolean(e.detail?.open));
    const locate=()=>setLocateRevision(v=>v+1);
    window.addEventListener('portcube:assistant-visibility',visibility);
    window.addEventListener('portcube:locate-object',locate);
    return()=>{window.removeEventListener('portcube:assistant-visibility',visibility);window.removeEventListener('portcube:locate-object',locate);};
  },[]);
  const [panelOpen, setPanelOpen] = useState(deepLink.operation === 'unload');
  const [unloadState, setUnloadState] = useState(() => createUnloadState(unloadSequence, deepLink.operation === 'unload', deepLink.unloadStep));
  const [evidenceMode, setEvidenceMode] = useState('none');
  const [replayStep, setReplayStep] = useState(0);
  const strategyIds = Object.keys(session.strategyPlans || {}).filter((id) => id !== session.selectedStrategy);
  const strategiesConverged = useMemo(() => {
    const plans = Object.values(session.strategyPlans || {}).filter(Boolean);
    return plans.length === 3 && plans.slice(1).every((plan) => samePlacementPlan(plans[0], plan));
  }, [session.strategyPlans]);
  const [diffAgainst, setDiffAgainst] = useState('BALANCE');
  const alternativeStrategy = strategyIds.includes(diffAgainst) ? diffAgainst : strategyIds[0];
  const alternativePlan = !strategiesConverged && alternativeStrategy ? session.strategyPlans?.[alternativeStrategy] : null;
  const evidenceOverlay = useMemo(() => {
    if (evidenceMode === 'replay' && selectedCargo) return buildReplayOverlay(selectedCargo, replayStep);
    if (evidenceMode === 'diff' && alternativePlan) return buildStrategyDiffOverlay(activePlan, alternativePlan);
    return [];
  }, [activePlan, alternativePlan, evidenceMode, replayStep, selectedCargo]);

  useEffect(() => {
    setSnapshot(compact(machine.getSnapshot()));
    setJumpValue(machine.queue.length);
  }, [machine]);

  // 自动跟随仅在"回放是我们切换的"期间生效：回放完成时礼貌地送回总览。
  useEffect(() => {
    if (snapshot.phase === 'COMPLETED' && autoFollowRef.current) {
      autoFollowRef.current = false;
      setView('overview');
    }
  }, [snapshot.phase]);

  useEffect(() => {
    if (!deepLinkedVoidZone) return;
    setSelectedVoidZone(deepLinkedVoidZone);
    setVisualizationMode('space');
    setDebugLayers((current) => ({ ...current, void: true }));
  }, [deepLinkedVoidZone]);

  useEffect(() => {
    setUnloadState((current) => createUnloadState(unloadSequence, current.active, Math.min(current.index, unloadSequence.length), current.speed));
  }, [unloadSequence]);

  const updateUnload = useCallback((next) => setUnloadState(current => current.active ? {
    ...current,index:next.completedCount,playing:next.playing,speed:next.speed,
    phase:next.phase,phaseLabel:next.phaseLabel,currentId:next.currentCargo?.cargoId,
    blockedReasons:next.blockedReasons,inProgress:next.inProgress
  } : current),[]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem('portcube.rule-to-space');
    if (!raw) return;
    window.sessionStorage.removeItem('portcube.rule-to-space');
    try {
      const target = JSON.parse(raw);
      if(target.planId && target.planId!==activePlan.planId){notify('该引用属于旧方案，请重新提问。',{variant:'warning'});return;}
      setMode('review');
      setVisualizationMode(VISUAL_MODES.some(([key]) => key === target.visualizationMode) ? target.visualizationMode : 'normal');
      if (target.visualizationMode === 'securing') setDebugLayers((current) => ({ ...current, securing: true }));
      if (target.unloadReplay) {
        setMode('review');
        setPanelOpen(true);
        setView('unload');
        setVisualizationMode('port');
        setUnloadState(createUnloadState(unloadSequence, true, 0));
      }
      if (target.cargoId) {
        const cargo = (activePlan.loadedCargo || []).find((item) => item.cargoId === target.cargoId);
        if (cargo) {
          setSelectedCargo(cargo);
          setIsolate({ type: 'cargo', value: cargo.cargoId });
          const containerLength = Number(activePlan.containerInfo?.innerLength || 0);
          setView(containerLength > 0 && Number(cargo.x || 0) > containerLength * 0.64 ? 'door' : 'side');
        }
      }
      if (target.voidZoneId) {
        const voidModel = activePlan.voidJustification || activePlan.ext_voidJustification || activePlan.metrics?.voidJustification;
        const zone = (voidModel?.zones || []).find((item) => item.id === target.voidZoneId);
        if (zone) {
          setSelectedVoidZone(zone);
          setSelectedCargo(null);
          setIsolate(zone.linkedCargoIds?.length ? { type: 'cargo-set', value: zone.linkedCargoIds } : null);
          setVisualizationMode('space');
          setDebugLayers((current) => ({ ...current, void: true }));
          setView('section');
        }
      }
      notify(`已定位 ${target.ruleName || target.ruleId || '规则'} 的方案空间`, { variant: 'info' });
    } catch {
      // Ignore an invalid transient hand-off and keep the Twin usable.
    }
  }, [activePlan, machine, notify, unloadSequence,locateRevision]);

  useEffect(() => {
    if (!window.sessionStorage.getItem('portcube.strategy-diff')) return;
    window.sessionStorage.removeItem('portcube.strategy-diff');
    if (!alternativePlan) return;
    setMode('review');
    setEvidenceMode('diff');
  }, [alternativePlan]);

  useEffect(() => {
    if (!isBackendSolved(planSource)) return undefined;
    dispatch({ type: SESSION_ACTIONS.TWIN_REVIEWED });
    const packingCase = session.packingCase;
    if (!packingCase?.caseId || ['ANALYZED', 'REVIEWED', 'DELIVERED'].includes(packingCase.status)) return undefined;
    const controller = new AbortController();
    updatePackingCase(packingCase.caseId, { status: 'ANALYZED' }, { signal: controller.signal })
      .then((updated) => dispatch({ type: SESSION_ACTIONS.CASE_SYNC_SUCCESS, packingCase: updated }))
      .catch((error) => {
        if (error.reason !== 'cancelled') dispatch({ type: SESSION_ACTIONS.CASE_SYNC_FAILURE, error: error.message });
      });
    return () => controller.abort();
  }, [dispatch, planSource, session.packingCase]);

  const update = useCallback((next) => setSnapshot(compact(next)), []);
  useEffect(()=>setJumpValue(snapshot.completedCount),[snapshot.completedCount]);
  const sceneFailure = useCallback((error) => setSceneError(error.message || 'WebGL 场景初始化失败'), []);
  const control = (method, ...args) => update(machine[method](...args));
  const playPause = () => {
    if (mode === 'review' || snapshot.phase === 'COMPLETED') { startLoadReplay(); return; }
    snapshot.playing ? control('pause') : control('play');
  };
  const jumpToIndex = (requestedIndex) => {
    setMode('operation');
    const index = Math.max(0, Math.min(machine.queue.length - 1, Number(requestedIndex) || 0));
    setJumpValue(index + 1);
    update(machine.jumpToCargo(index));
    notify(`已重建到第 ${index + 1} 件货物的起始状态`, { variant: 'info' });
  };
  const jump = () => {
    setMode('operation');
    const completedCount = Math.max(0, Math.min(machine.queue.length, Number(jumpValue) || 0));
    setJumpValue(completedCount);
    update(machine.jumpToCompletedCount(completedCount));
    notify(`已预置 ${completedCount} 件方案落位状态；不是已验证作业记录`, { variant: 'info' });
  };
  const skip = () => {
    const cargo = snapshot.currentCargo;
    update(machine.skipCurrent());
    notify(`已跳过 ${cargo?.sku || '当前货物'}，阻断原因保留在风险记录`, { variant: 'warning' });
  };

  const toggleReplay = () => {
    if (!selectedCargo) {
      notify('请先在 3D 场景中选择一件货物，再查看 Decision Replay', { variant: 'info' });
      return;
    }
    setReplayStep(0);
    if (evidenceMode !== 'replay') setMode('review');
    setEvidenceMode((currentMode) => currentMode === 'replay' ? 'none' : 'replay');
  };

  const toggleStrategyDiff = () => {
    if (evidenceMode !== 'diff') setMode('review');
    setEvidenceMode((currentMode) => currentMode === 'diff' ? 'none' : 'diff');
  };

  const startLoadReplay = () => {
    setUnloadState((currentState) => ({ ...currentState, active: false, playing: false }));
    setMode('operation');
    setPanelOpen(true);
    autoFollowRef.current = true;
    setView('follow'); setFollowRevision(v=>v+1);
    setVisualizationMode('normal');
    setSelectedCargo(null); setSelectedVoidZone(null); setIsolate(null);
    setDebugLayers((value) => ({ ...value, void: false }));
    machine.reset();
    update(machine.play());
  };

  const returnToReview = () => {
    autoFollowRef.current = false;
    setUnloadState((value) => ({ ...value, active: false, playing: false }));
    update(machine.jumpToCompletedCount(machine.queue.length));
    setMode('review'); setPanelOpen(false); setView('overview');
    setVisualizationMode('normal'); setSelectedCargo(null); setSelectedVoidZone(null); setIsolate(null);
    setDebugLayers((value) => ({ ...value, void: false }));
  };

  const selectAnalysis = (key) => {
    if (mode === 'operation' || unloadState.active) update(machine.jumpToCompletedCount(machine.queue.length));
    setMode('review'); setPanelOpen(false);
    setVisualizationMode(key); setSelectedCargo(null); setSelectedVoidZone(null); setIsolate(null);
    setUnloadState((value) => ({ ...value, active: false, playing: false }));
    setDebugLayers((value) => ({ ...value, void: false }));
    setView(['port', 'risk', 'weight'].includes(key) ? 'side' : 'overview');
  };

  const selectVoid = (zone) => {
    setSelectedVoidZone(zone); setSelectedCargo(null); setIsolate(null);
  };

  const startUnloadSimulation = () => {
    unloadMachine.reset();
    update(machine.jumpToCompletedCount(machine.queue.length));
    setSelectedCargo(null); setSelectedVoidZone(null); setIsolate(null);
    setDebugLayers((value) => ({ ...value, void: false }));
    setVisualizationMode('port');
    setMode('review');
    setPanelOpen(true);
    setView('follow');
    setUnloadState(createUnloadState(unloadSequence, true, 0));
  };

  const unloadControl = (action, value) => {
    const next=action==='toggle' ? unloadMachine.playing ? unloadMachine.pause() : unloadMachine.play()
      : action==='back' ? unloadMachine.stepBackward() : action==='forward' ? unloadMachine.stepForward()
      : action==='reset' ? unloadMachine.reset() : action==='seek' ? unloadMachine.seek(value) : unloadMachine.setSpeed(value);
    updateUnload(next);
  };

  const current = snapshot.currentCargo;
  const unloadCurrentId = unloadState.index>=unloadSequence.length ? null : unloadState.currentId || unloadSequence[unloadState.index] || null;
  const unloadCurrentCargo = unloadCurrentId ? (activePlan.loadedCargo || []).find((item) => item.cargoId === unloadCurrentId) : null;
  const unloadAccess = activePlan.portAccessibility || activePlan.ext_portAccessibility || activePlan.metrics?.portAccessibility;
  const unloadCall = (unloadAccess?.calls || []).find((call) => (call.removedCargoIds || []).includes(unloadCurrentId)) || null;
  const resolvedUnloadState = {
    ...unloadState,
    sequenceOnly:false,
    removedIds: unloadSequence.slice(0, unloadState.index),
    currentId: unloadCurrentId,
    nextId: unloadSequence[unloadState.index + 1] || null,
    remaining: Math.max(0, unloadSequence.length - unloadState.index)
  };
  const appearance = current ? classifyCargoAppearance(current) : null;
  const legend = cargoAppearanceLegend(activePlan.loadedCargo || []);
  const completedIndices = machine.completedIndices || [];
  const completedSet = new Set(completedIndices);
  const blockedIndex = snapshot.phase === 'BLOCKED' ? snapshot.currentIndex : -1;
  const allQueueGroups = groupOperationQueue(machine.queue, {
    currentIndex: snapshot.currentIndex,
    completedIndices,
    blockedIndex
  });
  const filterContext = { currentIndex: snapshot.currentIndex, completedIndices: completedSet, blockedIndex };
  const queueGroups = filterOperationGroups(allQueueGroups, filters, filterContext);
  const filterOptions = buildOperationFilterOptions(machine.queue);
  const visibleQueueCount = queueGroups.reduce((sum, group) => sum + group.items.length, 0);
  const visibleQueueIndices = queueGroups.flatMap((group) => group.items.map(({ index }) => index));
  const queueOrderValid = allQueueGroups.flatMap((group) => group.items.map(({ index }) => index)).every((index, position) => index === position)
    && allQueueGroups.reduce((sum, group) => sum + group.items.length, 0) === machine.queue.length;
  const activeFilterCount = Object.values(filters).filter((value) => value !== 'all').length;
  const progress = snapshot.total ? (snapshot.completedCount / snapshot.total) * 100 : 100;
  const blockedReason = snapshot.blockedReasons.map((reason) => reason.message).join('；') || '当前路径或目标位置未通过校验';
  const blockedObject = current ? `${current.name} · ${current.sku} · 第 ${snapshot.currentIndex + 1} 件` : '当前装柜作业步骤';
  const analysisReadout = visualizationReadout(visualizationMode, activePlan, selectedVoidZone);
  const tickStep = Math.max(1, Math.ceil(snapshot.total / 72));
  const timelineTicks = [];
  for (let index = 0; index < snapshot.total; index += tickStep) {
    timelineTicks.push({ index, done: completedSet.has(index), current: index === snapshot.currentIndex });
  }

  const toggleGroup = (key) => setExpandedGroups((currentGroups) => {
    const next = new Set(currentGroups);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const jumpToGroup = (group) => {
    const nextItem = group.items.find(({ index }) => !completedSet.has(index));
    jumpToIndex(nextItem?.index ?? group.firstIndex);
  };

  return (
    <div className="page twin-page">
      <header className="page-header page-header--compact">
        <div><span className="page-kicker">工业数字孪生 · {activePlan.containerInfo?.typeId}</span><h1>{PAGE_COPY.twin.title}</h1><p>{PAGE_COPY.twin.subtitle}</p></div>
        <div className="plan-identity"><StatusPill status={isBackendSolved(planSource) ? 'ready' : 'preview'}>{getPlanSourceLabel(activePlan)}</StatusPill>{activePlanView.algorithm && <StatusPill status="info">{activePlanView.algorithm}</StatusPill>}<details className="trace-details"><summary>追溯信息</summary><code>{activePlan.planId}</code></details></div>
      </header>

      <div className="twin-workspace">
        <section className="viewer-panel">
          <div className="viewer-toolbar">
            <div className="viewer-command-group">
              <span>视图</span>
              <div className="viewer-camera-switch" aria-label="相机视角">{VIEWS.map(([key, label]) => <button className={view === key ? 'active' : ''} type="button" key={key} onClick={() => { autoFollowRef.current = false; setSelectedCargo(null); setSelectedVoidZone(null); setIsolate(null); setView(key); setFollowRevision(v=>v+1); }}><Eye size={14} />{label}</button>)}</div>
            </div>
            <div className="viewer-command-group viewer-command-group--analyze">
              <span>分析</span>
              <div className="visualization-toolbar" aria-label="分析模式">{VISUAL_MODES.map(([key, label]) => <button type="button" className={visualizationMode === key ? 'active' : ''} aria-pressed={visualizationMode === key} onClick={() => selectAnalysis(key)} key={key}>{label}</button>)}</div>
            </div>
            <div className="viewer-command-group viewer-command-group--operation">
              <span>回放</span>
              <button type="button" onClick={startLoadReplay}><Play size={14} />装载回放</button>
              <button type="button" onClick={startUnloadSimulation}><SkipForward size={14} />卸货回放</button>
            </div>
            <div className="viewer-command-group viewer-command-group--explain">
              <span>证据</span>
              <button className={evidenceMode === 'replay' ? 'active' : ''} type="button" onClick={toggleReplay}><History size={14} />放置原因</button>
              <button className={evidenceMode === 'diff' ? 'active' : ''} type="button" disabled={!alternativePlan} title={strategiesConverged ? '三目标摆放哈希一致，无真实差异可比较' : undefined} onClick={toggleStrategyDiff}><GitCompareArrows size={14} />{strategiesConverged ? '三目标已收敛' : '方案对比'}</button>
              <button className={evidenceMode === 'rule' ? 'active' : ''} type="button" onClick={() => setEvidenceMode((currentMode) => currentMode === 'rule' ? 'none' : 'rule')}><ScanLine size={14} />规则证据</button>
            <button type="button" className="twin-ai-why" onClick={()=>askPortcube(selectedCargo ? '解释当前货物的放置依据与复核要点。' : selectedVoidZone ? '解释当前选中空间区域的证据与待复核事项；未解释区域不可推断根因，边界包络不代表整块可填空间。' : '解释当前孪生页面的空间、风险和作业复核要点。', {objectLabel:selectedCargo?.name || selectedVoidZone?.id,selectedCargo:selectedCargo ? {cargoId:selectedCargo.cargoId,dimensions:{l:selectedCargo.l,w:selectedCargo.w,h:selectedCargo.h},position:{x:selectedCargo.x,y:selectedCargo.y,z:selectedCargo.z},placementReason:selectedCargo.placementReason,handlingMethod:selectedCargo.handlingMethod} : null,selectedVoid:selectedVoidZone || null,view,visualizationMode})}>AI 解读</button>
            </div>
            <div className="viewer-utility-controls"><details className="quality-popover"><summary>{QUALITY_TIERS.find(([key]) => key === quality)?.[1] || '标准'}</summary><div className="quality-switch" role="group" aria-label="画质档位">{QUALITY_TIERS.map(([key, label, hint]) => <button className={quality === key ? 'active' : ''} type="button" aria-pressed={quality === key} title={hint} key={key} onClick={() => setQuality(key)}>{label}</button>)}</div></details><button className={panelOpen ? 'active' : ''} type="button" onClick={() => setPanelOpen((value) => !value)}>作业面板</button></div>
          </div>
          <div className="viewer-stage">
            <div className="viewer-hud">
              <div><span><Package size={12} />方案结果</span><strong>{activePlanView.loadedCount === null || activePlanView.inputCount === null ? '—' : `${activePlanView.loadedCount}/${activePlanView.inputCount} 件已规划装入`}</strong></div>
              <div><span><Play size={12} />{unloadState.active ? '已送达暂存' : mode === 'operation' ? '装载回放' : '复核状态'}</span><strong>{unloadState.active ? `${unloadState.index}/${unloadSequence.length} 件` : mode === 'operation' ? `${snapshot.completedCount}/${snapshot.total} 件` : `${isBackendSolved(planSource) ? '正式方案' : '本地预览'} · 静态复核`}</strong></div>
              <div><span><Gauge size={12} />{unloadState.active ? '卸货回放进度' : mode === 'operation' ? '回放完成度' : '体积利用率'}</span><strong>{unloadState.active ? `${(unloadState.index / Math.max(1, unloadSequence.length) * 100).toFixed(1)}%` : mode === 'operation' ? `${progress.toFixed(1)}%` : `${placementSpace.volumeUtilizationPercent.toFixed(2)}%`}</strong></div>
              <div><span><Anchor size={12} />LIFO / 重心</span><strong>{activePlanView.lifoCompliant === null ? '—' : lifoLabel(activePlanView.lifoCompliant)} · 横向 {formatPlanMetric(activePlanView.lateralCog, { decimals: 1, suffix: '%' })}</strong></div>
            </div>
            {visualizationMode !== 'normal' && !unloadState.active && <VisualizationLegend mode={visualizationMode} plan={activePlan} machine={machine} legend={legend} />}
            {visualizationMode === 'normal' && mode !== 'operation' && !unloadState.active && !selectedCargo && placementSpace.zones.length > 0 && <aside className="placement-space-note"><strong>为什么没有填满每一处？</strong><p>{placementSpace.plannedCount} 件已全量规划 · 体积利用率 {placementSpace.volumeUtilizationPercent.toFixed(2)}%</p>{placementSpace.zones.filter((z,i,a)=>a.findIndex(o=>o.classification===z.classification)===i).map(z=><details key={z.id}><summary>{z.label}{z.gapMm ? ` · ${z.gapMm} mm` : ''}</summary><p>{z.reason}</p></details>)}<small>标识来自当前坐标与包装约束。其他余隙仍需复核；不代表可直接出运。</small></aside>}
            {analysisReadout && !['space', 'risk', 'port'].includes(visualizationMode) && <div className="visualization-readout"><span>{analysisReadout.title}</span>{analysisReadout.lines.map((line) => <strong key={line}>{line}</strong>)}</div>}
            {visualizationMode === 'balance' && <LoadDistributionOverlay plan={activePlan} />}
            {visualizationMode === 'port' && !unloadState.active && <PortUnloadOverlay plan={activePlan} onStart={startUnloadSimulation} />}
            {visualizationMode === 'space' && !selectedVoidZone && !selectedCargo && <SpaceEvidenceOverlay plan={activePlan} onSelect={selectVoid} />}
            {visualizationMode === 'risk' && !selectedCargo && <SecuringOverlay plan={activePlan} isolated={isolate?.type === 'cargo-set'} onToggle={() => setIsolate((value) => value ? null : { type: 'cargo-set', value: securingOf(activePlan).requiredCargoIds || [] })} onOpen={() => navigate(ROUTES.evidence)} />}
            {mode === 'operation' && <div className="staging-truth-note">待装 {Math.max(0,snapshot.total-snapshot.completedCount-(snapshot.inProgress?1:0))} · 作业中 {snapshot.inProgress?1:0} · 已落位 {snapshot.completedCount} = {snapshot.total} 件 · 小池代表展示</div>}
            <div className="twin-scene-context"><span>{unloadState.active ? '卸货回放' : mode === 'operation' ? '装载回放' : '方案复核'}</span><small>{mode === 'operation' ? '示意作业区 · 代表数量随真实队列更新' : '示意作业区 · 米制参照 · 非现场测绘'}</small>{(mode === 'operation' || unloadState.active) && <button type="button" onClick={returnToReview}>返回完整方案</button>}</div>
            {sceneError ? <div className="scene-error"><CircleAlert size={28} /><h2>3D 场景无法启动</h2><p>{sceneError}</p><button className="button button--secondary" type="button" onClick={() => window.location.reload()}>刷新重试</button></div> : <TwinScene machine={unloadState.active ? unloadMachine : machine} followRevision={followRevision} view={view} mode={unloadState.active ? "operation" : mode} visualizationMode={visualizationMode} unloadState={null} isolate={isolate} focusCargoId={selectedCargo?.cargoId} focusVoidZoneId={selectedVoidZone?.id} evidenceOverlay={evidenceOverlay} postProcessing={quality !== 'low'} quality={quality} panelOpen={assistantOpen || panelOpen || Boolean(selectedCargo || selectedVoidZone) || ['space', 'risk', 'port', 'balance'].includes(visualizationMode)} visibleQueueIndices={visibleQueueIndices} activeFilterCount={activeFilterCount} layers={layers} debugLayers={debugLayers} onSnapshot={unloadState.active ? updateUnload : update} onError={sceneFailure} onHover={setHoveredCargo} onSelect={(cargo) => { setSelectedCargo(cargo); if (cargo) { setSelectedVoidZone(null); setIsolate(null); } }} onVoidSelect={(zone) => { if (zone) selectVoid(zone); else setSelectedVoidZone(null); }} onFocus={(item) => notify(`已聚焦 ${item.sku || item.cargoId}`, { variant: 'info' })} onPerformance={setPerformance} />}
            {hoveredCargo && !selectedCargo && <div className="cargo-hover-card"><strong>{hoveredCargo.sku || '未标识 SKU'}</strong><span>{hoveredCargo.cargoId}</span><span>{number(hoveredCargo.l)} × {number(hoveredCargo.w)} × {number(hoveredCargo.h)} mm · {number(hoveredCargo.weight)} kg</span></div>}
            {selectedCargo && <CargoInspector cargo={selectedCargo} plan={activePlan} isolate={isolate} onIsolate={setIsolate} onClose={() => { setSelectedCargo(null); setIsolate(null); }} />}
            {selectedVoidZone && <VoidInspector zone={selectedVoidZone} onRelated={() => setIsolate((value) => value ? null : { type: 'cargo-set', value: selectedVoidZone.linkedCargoIds || [] })} isolated={Boolean(isolate)} onClose={() => { setSelectedVoidZone(null); setIsolate(null); }} />}
            {evidenceMode === 'replay' && selectedCargo && <DecisionReplayPanel cargo={selectedCargo} step={replayStep} onStep={setReplayStep} />}
            {evidenceMode === 'diff' && alternativePlan && <StrategyDiffPanel currentId={session.selectedStrategy} alternativeId={alternativeStrategy} alternatives={strategyIds} onAlternative={setDiffAgainst} currentPlan={activePlan} alternativePlan={alternativePlan} />}
            {evidenceMode === 'rule' && <RuleEvidencePanel plan={activePlan} cargo={selectedCargo} zone={selectedVoidZone} onOpen={() => navigate(ROUTES.evidence)} />}
            {showDebugHud && <div className="render-stats" aria-label="渲染性能"><span>{performance.fps.toFixed(0)} FPS</span><span>{performance.drawCalls} 次绘制</span><span>{Math.round(performance.triangles).toLocaleString()} 三角面</span><span>{performance.textures} 纹理</span>{performance.gpuMemoryApproxMb != null && <span>约 {performance.gpuMemoryApproxMb.toFixed(1)} MB</span>}</div>}
            {snapshot.phase === 'BLOCKED' && <div className="blocked-overlay"><CircleAlert size={22} /><dl><div><dt>阻断原因</dt><dd>{blockedReason}</dd></div><div><dt>影响对象</dt><dd>{blockedObject}</dd></div><div><dt>处理建议</dt><dd>记录并跳过，或返回货物修改后重新生成方案。</dd></div></dl><div className="blocked-overlay__actions"><button className="button button--warning button--small" type="button" onClick={skip}>记录并跳过</button><button className="button button--secondary button--small" type="button" onClick={() => navigate(ROUTES.cargo)}>返回货物修改</button></div></div>}
          </div>
          {(mode==='operation' || unloadState.active) && <><div className="operation-controls">
            <button className="icon-button" type="button" onClick={() => { if (unloadState.active) unloadControl('back'); else { setMode('operation'); control('stepBackward'); } }} aria-label="上一步" title="上一步"><ChevronLeft size={20} /></button>
            <button className="button button--primary operation-play" type="button" onClick={() => unloadState.active ? unloadControl('toggle') : playPause()} disabled={unloadState.active ? unloadState.phase === "BLOCKED" : snapshot.phase === "BLOCKED"}>{(unloadState.active ? unloadState.playing : snapshot.playing) ? <><Pause size={19} />暂停</> : <><Play size={19} />{!unloadState.active && (mode === 'review' || snapshot.phase === 'COMPLETED') ? '开始回放' : '播放'}</>}</button>
            <button className="icon-button" type="button" onClick={() => { if (unloadState.active) unloadControl('forward'); else { setMode('operation'); control('stepForward'); } }} aria-label="下一步" title="下一步"><ChevronRight size={20} /></button>
            <button className="icon-button" type="button" onClick={() => { if (unloadState.active) unloadControl('reset'); else { setMode('operation'); control('reset'); } }} aria-label="重置作业" title="重置"><RotateCcw size={18} /></button>
            <div className="speed-control" aria-label="播放速度">{SPEEDS.map((speed) => <button className={(unloadState.active ? unloadState.speed : snapshot.speed) === speed ? 'active' : ''} type="button" key={speed} onClick={() => unloadState.active ? unloadControl('speed', speed) : control('setSpeed', speed)}>{speed}×</button>)}</div>
            {!unloadState.active && <div className="jump-control"><label>{mode === 'review' ? '回放起点' : '完成件数'} <input type="number" min="0" max={snapshot.total} value={jumpValue} onChange={(event) => setJumpValue(event.target.value)} /></label><button className="button button--secondary button--small" type="button" onClick={jump} disabled={!snapshot.total}>恢复</button></div>}
            {!unloadState.active && snapshot.phase === 'BLOCKED' && <button className="button button--warning button--small" type="button" onClick={skip}><SkipForward size={16} />跳过</button>}
          </div>
          <div className="packing-timeline">
            <span className="timeline-end">0</span>
            <div className="timeline-track">
              {!unloadState.active && <div className="timeline-ticks" aria-hidden="true">{timelineTicks.map((tick) => <i className={`timeline-tick ${tick.done ? 'timeline-tick--done' : ''} ${tick.current ? 'timeline-tick--current' : ''}`} style={{ left: `${(tick.index / Math.max(1, snapshot.total)) * 100}%` }} key={tick.index} />)}</div>}
              {!unloadState.active && blockedIndex >= 0 && <i className="timeline-marker timeline-marker--blocked" style={{ left: `${(blockedIndex / Math.max(1, snapshot.total)) * 100}%` }} title={`阻断点 · 第 ${blockedIndex + 1} 件`} />}
              <input aria-label={unloadState.active ? '卸货时间轴' : '装载时间轴'} type="range" min="0" max={unloadState.active ? unloadSequence.length : snapshot.total} value={unloadState.active ? unloadState.index : snapshot.completedCount} style={{ '--tl-fill': `${unloadState.active ? unloadState.index / Math.max(1, unloadSequence.length) * 100 : progress}%` }} onChange={(event) => { if (unloadState.active) unloadControl("seek", Number(event.target.value)); else { setMode('operation'); update(machine.jumpToCompletedCount(Number(event.target.value))); } }} />
            </div>
            <strong>{unloadState.active ? unloadState.index : snapshot.completedCount}</strong>
            <span className="timeline-end">{unloadState.active ? unloadSequence.length : snapshot.total}</span>
          </div></>}
        </section>

        {panelOpen && (unloadState.active ? <UnloadReviewPanel state={resolvedUnloadState} cargo={unloadCurrentCargo} call={unloadCall} total={unloadSequence.length} /> : <aside className="operation-panel">
          <section className="current-instruction">
            <span>当前作业指令</span><h2>{snapshot.phase === 'PAUSED' ? '作业已暂停，可继续或逐步复核' : snapshot.action}</h2>{current?.handlingMethod !== 'manual' && <p className="handling-boundary">叉车负责门区交接；地面托盘显示地牛落位示意。箱内设备与高位搬运方式仍需现场复核。</p>}
            {current ? <dl><div><dt>货物</dt><dd>{current.name} · {current.sku}</dd></div><div><dt>作业主体</dt><dd><span className={`actor-pill actor-pill--${current.handlingMethod === 'manual' ? 'manual' : 'forklift'}`}>{actorLabel(current.handlingMethod)}</span> · {current.batchId || '未分批'}</dd></div><div><dt>目标位置</dt><dd>{targetZone(current)} · {displayPort(current.destinationPort)} · 港序 {current.portSequence || 1}</dd></div><div><dt>朝向尺寸</dt><dd>{number(current.l)} × {number(current.w)} × {number(current.h)} mm</dd></div><div><dt>外观分类</dt><dd><i className="cargo-swatch" style={{ background: appearance.color }} />{appearance.label}</dd></div><div><dt>放置依据</dt><dd>{placementReasonSummary(current.placementReason)}</dd></div></dl> : <p>{snapshot.phase === 'COMPLETED' ? '回放游标已到末尾；跳过及预置对象仍需作业验证。' : '等待作业开始。'}</p>}
          </section>

          <section className="operation-filters" data-filter-dimensions="7" data-active-filter-count={activeFilterCount} data-visible-count={visibleQueueCount}>
            <div className="operation-filters__heading"><div><strong>队列筛选</strong><small>7 个维度仅改变可见队列，不改变真实执行顺序</small></div><button type="button" disabled={!activeFilterCount} onClick={() => setFilters(createOperationFilters())}>重置</button></div>
            <div className="operation-filter-grid">
              <FilterSelect label="SKU" value={filters.sku} options={filterOptions.sku} onChange={(value) => setFilters((currentFilters) => ({ ...currentFilters, sku: value }))} />
              <FilterSelect label="批次" value={filters.batch} options={filterOptions.batch} onChange={(value) => setFilters((currentFilters) => ({ ...currentFilters, batch: value }))} />
              <FilterSelect label="港口" value={filters.port} options={filterOptions.port} format={displayPort} onChange={(value) => setFilters((currentFilters) => ({ ...currentFilters, port: value }))} />
              <FilterSelect label="港序" value={filters.sequence} options={filterOptions.sequence} format={(value) => `第 ${value} 港`} onChange={(value) => setFilters((currentFilters) => ({ ...currentFilters, sequence: value }))} />
              <FilterSelect label="主体" value={filters.actor} options={filterOptions.actor} format={actorLabel} onChange={(value) => setFilters((currentFilters) => ({ ...currentFilters, actor: value }))} />
              <FilterSelect label="状态" value={filters.state} options={filterOptions.state} format={stateLabel} onChange={(value) => setFilters((currentFilters) => ({ ...currentFilters, state: value }))} />
              <FilterSelect label="风险" value={filters.risk} options={filterOptions.risk} format={riskLabel} onChange={(value) => setFilters((currentFilters) => ({ ...currentFilters, risk: value }))} />
            </div>
          </section>

          <section className="step-queue" data-order-valid={String(queueOrderValid)} data-group-count={queueGroups.length} data-queue-count={machine.queue.length} data-visible-queue-count={visibleQueueCount}>
            <div className="section-heading"><div><h2>作业批次</h2><p>{queueGroups.length} 组 · 可见 {visibleQueueCount}/{machine.queue.length} 件，原始队列索引保留</p></div></div>
            <div className="queue-groups">{queueGroups.map((group) => {
              const complete = group.completedCount === group.items.length;
              const expanded = group.isCurrent || group.isBlocked || expandedGroups.has(group.key);
              const jumpIndex = group.items.find(({ index }) => !completedSet.has(index))?.index ?? group.firstIndex;
              const visibleItems = expanded ? queueItemsForDisplay(group, snapshot.currentIndex, 12) : [];
              return <article className={`queue-group ${group.isCurrent ? 'queue-group--current' : ''} ${group.isBlocked ? 'queue-group--blocked' : ''} ${complete ? 'queue-group--complete' : ''}`} data-first-index={jumpIndex} key={group.key}>
                <div className="queue-group__summary">
                  <button type="button" aria-expanded={expanded} aria-label={`${expanded ? '收起' : '展开'} ${group.sku} 分组`} onClick={() => toggleGroup(group.key)}>
                    <span className="queue-group__status">{group.isBlocked ? '阻' : complete ? '✓' : group.isCurrent ? '作' : group.portSequence}</span>
                    <span><strong>{group.sku}</strong><small>{group.name} · {group.batchLabel}</small><small>{displayPort(group.destinationPort)} · 第 {group.portSequence} 港 · {actorLabel(group.handlingMethod)}</small><small>{group.targetZone} · {group.risk} · {group.completedCount}/{group.items.length}</small></span>
                    <span className="queue-group__chevron">{expanded ? '−' : '+'}</span>
                  </button>
                  <button className="queue-group__jump" data-jump-index={jumpIndex} type="button" onClick={() => jumpToGroup(group)}>跳到本组</button>
                </div>
                {expanded && <><ol className="queue-group__items">{visibleItems.map(({ item, index }) => <li className={index === snapshot.currentIndex ? 'active' : completedSet.has(index) ? 'done' : ''} data-queue-index={index} key={`${item.cargoId}-${index}`}><button type="button" aria-label={`跳到第 ${index + 1} 件 ${item.sku || item.name}`} onClick={() => jumpToIndex(index)}><span>{index + 1}</span><span><strong>{item.sku || item.name}</strong><small>{item.name} · {item.batchId || '未分批'} · {actorLabel(item.handlingMethod)}</small></span>{completedSet.has(index) && <StatusPill status="complete">已回放</StatusPill>}</button></li>)}</ol>{group.items.length > visibleItems.length && <p className="queue-group__window">显示当前附近 {visibleItems.length} 件，共 {group.items.length} 件</p>}</>}
              </article>;
            })}{!queueGroups.length && <div className="operation-filter-empty">当前组合无匹配货物；真实队列未被修改。</div>}</div>
          </section>

          <details className="operation-disclosure"><summary><Layers3 size={17} />图层与调试</summary><div className="layer-controls">{Object.entries({ container: '实体箱体与箱门', zones: '作业分区', labels: '场地辅助标签', placed: '已装货物', waiting: '等待区货物', path: '运动路径', target: '目标位置' }).map(([key, label]) => <label key={key}><input type="checkbox" checked={layers[key]} onChange={(event) => setLayers((currentLayers) => ({ ...currentLayers, [key]: event.target.checked }))} />{label}</label>)}{Object.entries({ grid: '调试网格', void: '未解释剩余空间', reserve: '受控预留', lowFill: '低填充切片', securing: '系固边界' }).map(([key, label]) => <label key={key}><input type="checkbox" checked={debugLayers[key]} onChange={(event) => setDebugLayers((currentLayers) => ({ ...currentLayers, [key]: event.target.checked }))} />{label}</label>)}</div><p className="debug-layer-note">布局调试层仅用于验收，默认隐藏；所有覆盖层来自后端 placements / metrics，不改变货物坐标。</p></details>
          <details className="operation-disclosure"><summary>算法与安全依据</summary><div className="algorithm-notes"><p>回放展示门区取货、交接与目标落位，用于逐步复核正式方案。</p><p>几何边界检查不等同于现场设备通行许可；箱内搬运、系固与人员作业仍需现场确认。</p><div className="appearance-legend">{legend.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div><details className="coordinate-disclosure"><summary>技术坐标</summary><p>门端 X = {activePlan.containerInfo?.innerLength} mm；当前目标 X/Y/Z = {number(current?.x)} / {number(current?.y)} / {number(current?.z)} mm。</p></details></div></details>
          {(snapshot.skipped.length > 0 || snapshot.blockedReasons.length > 0) && <section className="operation-risks"><h2>作业风险记录</h2><p>已跳过 {snapshot.skipped.length} 件；不会修改或伪装原装箱结果。</p></section>}
        </aside>)}
      </div>
    </div>
  );
}

function UnloadReviewPanel({ state, cargo, call, total }) {
  const complete = state.index >= total;
  const stabilityStatus = complete
    ? 'EMPTY_CTU'
    : call?.postUnloadStability?.status === 'EMPTY_CTU'
      ? '逐港复核'
      : call?.postUnloadStability?.status || '逐港复核';
  return <aside className="operation-panel operation-panel--unload" data-unload-step={state.index}>
    <header><span>卸货作业回放</span><h2>{complete ? '全部货物已回放送达暂存位' : state.phaseLabel || `当前港序 · ${displayPort(call?.portCode || cargo?.destinationPort)}`}</h2><p>按港序、同港逆装载顺序逐件取出，检查取货和人员通道；实际设备能力与现场作业仍需确认。</p></header>
    {state.blockedReasons?.length>0 && <div className="page-error"><strong>卸货暂停</strong><p>{state.blockedReasons.map(r=>r.message).join('；')}</p></div>}
    <div className="unload-review-progress"><i style={{ width: `${state.index / Math.max(1, total) * 100}%` }} /><span>{state.index} / {total}</span></div>
    <dl>
      <div><dt>当前货物</dt><dd>{cargo ? `${cargo.name || cargo.sku} · ${cargo.sku}` : '全部完成'}</dd></div>
      <div><dt>当前批次</dt><dd>{cargo?.batchId || cargo?.batchLabel || '—'}</dd></div>
      <div><dt>目标港口</dt><dd>{displayPort(call?.portCode || cargo?.destinationPort)}</dd></div>
      <div><dt>下一件</dt><dd>{state.nextId ? '按当前港序继续取下一件' : '无'}</dd></div>
      <div><dt>剩余</dt><dd>{state.remaining} 件</dd></div>
      <div><dt>本港静态倒箱证据</dt><dd>{call?.rehandleCount ?? '未提供'}</dd></div>
    </dl>
    <p className="handling-boundary">播放包含提取、运出、交接、落位和返回。拖动进度条会预置历史状态，不代表此前作业已逐件验证。</p>
    <div className="unload-review-legend"><span className="current">当前作业</span><span className="next">下一件</span><span className="future">待卸货物</span><span className="staged">已卸暂存</span></div>
    <footer><ShieldCheck size={17} /><span><b>{stabilityStatus === 'EMPTY_CTU' ? '计划箱内已空' : stabilityStatus === 'STABLE' ? '本港卸后稳定' : '逐港复核'}</b><small>读取本港卸完后的稳定性证据</small></span></footer>
  </aside>;
}

function buildUnloadSequence(plan = {}) {
  return unloadOrder(plan);
}

function createUnloadState(sequence, active = false, index = 0, speed = 1) {
  return {
    active,
    playing: false,
    speed: SPEEDS.includes(speed) ? speed : 1,
    index: Math.min(sequence.length, Math.max(0, Number(index) || 0))
  };
}

function SpaceEvidenceOverlay({ plan, onSelect }) {
  const observed = placementSpaceEvidence(plan);
  const model = plan.voidJustification || plan.ext_voidJustification || plan.metrics?.voidJustification;
  const zones = [...(model?.zones || [])].filter((zone) => zone.boundsMm).sort((a, b) => Number(b.classification === 'UNEXPLAINED_VOID') - Number(a.classification === 'UNEXPLAINED_VOID') || Number(b.volumeM3 || 0) - Number(a.volumeM3 || 0));
  const volumeOf = (zone) => Number(zone.volumeM3 ?? Number(zone.volume || 0) / 1e9);
  const unexplained = zones.filter((zone) => zone.classification === 'UNEXPLAINED_VOID');
  const total = unexplained.reduce((sum, zone) => sum + volumeOf(zone), 0);
  return <aside className="twin-analysis-overlay twin-analysis-overlay--space" data-analysis="formal-space">
    <span>空间复核 · 当前真实坐标</span><strong>空位有边界，也有约束</strong>
    <p>{observed.plannedCount} 件已规划 · 体积利用率 {observed.volumeUtilizationPercent?.toFixed(2)}%</p>
    <div className="space-evidence-list">{observed.zones.map(zone=><button type="button" key={zone.id} onClick={()=>onSelect(zone)}><span><b>{zone.label}</b><small>{zone.gapMm ? `${zone.gapMm} mm · 当前布局的平衡取舍` : '包装约束禁止上压'}</small></span><strong>{volumeOf(zone).toFixed(2)} m³ <ChevronRight size={14}/></strong></button>)}</div>
    <details><summary>原求解器 VOID 分析 · 待校核</summary><p>原报告 {total.toFixed(2)} m³ 未解释空间，包含粗网格与连通包络；不是整块可填货位，禁堆上方不能仅按尺寸判回填。</p><div className="space-evidence-list">{zones.map(zone=><button type="button" key={zone.id} onClick={()=>onSelect(zone)}>{zone.id} · {volumeOf(zone).toFixed(2)} m³</button>)}</div></details>
    <small>绿色范围为空的精确包络。平衡调整不是法规通道；其余余隙未被重新包装成必要预留。</small>
  </aside>;
}

function LoadDistributionOverlay({ plan }) {
  const distribution = plan.loadDistribution || plan.ext_loadDistribution || plan.metrics?.loadDistribution;
  if (!distribution) return <aside className="twin-analysis-overlay"><span>LOAD DISTRIBUTION</span><strong>DATA REQUIRED</strong><p>当前方案没有 2.4 载荷分布证据。</p></aside>;
  const longitudinal = Number(distribution.centreOfGravity?.longitudinalOffsetPercent || 0);
  const lateral = Number(distribution.centreOfGravity?.lateralOffsetPercent || 0);
  const geometric = plan.stability?.status || plan.validator?.stability?.status || (plan.validator?.checks?.stability === false ? 'FAIL' : 'PASS');
  const lifo = plan.constraintMeta?.lifoCompliant === false ? '需复核' : '通过';
  return <aside className="twin-analysis-overlay twin-analysis-overlay--distribution" data-analysis="load-distribution">
    <span>平衡复核 · 本票正式方案</span>
    <strong>{zhEnum(distribution.centreOfGravity?.guidanceStatus)}</strong>
    <dl className="balance-truth-list"><div><dt>几何稳定</dt><dd>{geometric === 'PASS' ? '通过' : zhEnum(geometric)}</dd></div><div><dt>港序 / LIFO</dt><dd>{lifo}</dd></div><div><dt>纵向重心</dt><dd>{longitudinal.toFixed(3)}% · {zhEnum(distribution.centreOfGravity?.guidanceStatus)}</dd></div><div><dt>横向重心</dt><dd>{lateral.toFixed(3)}%</dd></div></dl>
    <div className="mass-segment-bars">{(distribution.segments?.longitudinal || []).map((segment) => { const max = Math.max(...distribution.segments.longitudinal.map((item) => Number(item.massKg || 0)), 1); return <i key={segment.index} style={{ height: `${Math.max(8, Number(segment.massKg || 0) / max * 100)}%` }} title={`Segment ${segment.index}: ${segment.massKg} kg`}><small>{segment.index}</small></i>; })}</div>
    <small>一般指导 ±5%；特定情形至 ±10% 仍需要工程复核。具体地板载荷包络未提供时不会判定通过。</small>
  </aside>;
}

function PortUnloadOverlay({ plan, onStart }) {
  const access = plan.portAccessibility || plan.ext_portAccessibility || plan.metrics?.portAccessibility;
  return <aside className="twin-analysis-overlay twin-analysis-overlay--ports" data-analysis="port-unload">
    <span>港序证据 · 正式方案</span><strong>{access?.status || 'DATA REQUIRED'}</strong>
    <p>{access ? `${access.calls?.length || 0} 港 · 阻断 ${access.blockedCount || 0} 件 · 未来港倒箱 ${access.rehandleCount || 0} 件` : '当前方案没有完整港序证据。'}</p>
    <div className="port-call-strip">{(access?.calls || []).map((call) => <span key={call.portSequence}><b>{call.portCode}</b><small>{call.removedCount} out · post {call.postUnloadStability?.status}</small></span>)}</div>
    {access && <button type="button" onClick={onStart}>开始逐件卸货回放 →</button>}
  </aside>;
}

function SecuringOverlay({ plan, isolated, onToggle, onOpen }) {
  const admission = plan.admission || plan.ext_admission;
  const transport = admission?.domains?.transportSecuring?.evidence;
  const stability = plan.stability || plan.validator?.stability || plan.ext_stability || {};
  const securing = securingOf(plan);
  const requiredCargoCount = Array.isArray(securing.requiredCargoIds)
    ? securing.requiredCargoIds.length
    : Number.isFinite(Number(securing.securingRequiredCount)) ? Number(securing.securingRequiredCount) : null;
  const missingInputs = (transport?.missingInputs || []).map((input) => ({
    frictionCoefficient: '摩擦参数',
    blockingCapacityDaN: '阻挡能力',
    lashings: '系固信息'
  })[input] || input);
  return <aside className="twin-analysis-overlay twin-analysis-overlay--securing" data-analysis="securing">
    <span>RISK · 两层判定</span>
    <strong>几何稳定 ≠ 运输系固已确认</strong>
    <div className="securing-semantic-layers">
      <section className="securing-semantic-layer securing-semantic-layer--geometry"><span>几何稳定</span><b>{stability.invalidCount === 0 ? 'STABLE' : zhEnum(stability.status, stability.status || '待复核')}</b><small>INVALID {Number(stability.invalidCount || 0)} · WARNING {Number(stability.warningCount || 0)}</small></section>
      <section className="securing-semantic-layer securing-semantic-layer--transport"><span>运输系固</span><b>{securingLabel(transport?.status || securing.status)}</b><small>需复核货物 {requiredCargoCount ?? '—'} 件 · 边界面 {Number(securing.securingPlaneCount || 0)}</small></section>
    </div>
    <p>{missingInputs.length ? `待补：${missingInputs.join(' / ')}` : '仍需胜任人员与设备能力确认。'}</p>
    <p className="risk-object-hint">琥珀轮廓对应方案列出的待复核货物；点选箱体可查看本件证据。</p>
    <div className="analysis-actions"><button type="button" disabled={!securing.requiredCargoIds?.length} aria-pressed={isolated} onClick={onToggle}>{isolated ? '显示全部货物' : `仅看待复核 ${requiredCargoCount ?? '—'} 件`}</button><button type="button" onClick={onOpen}>出运准备 · 补齐证据 →</button></div>
    <small className="securing-technical-state">技术状态：{transport?.status || securing.status || 'SECURING_UNRESOLVED'}</small>
  </aside>;
}

function compact(snapshot) {
  return {
    phase: snapshot.phase,
    phaseLabel: snapshot.phaseLabel,
    action: snapshot.action,
    playing: snapshot.playing,
    speed: snapshot.speed,
    phaseProgress: snapshot.phaseProgress,
    currentIndex: snapshot.currentIndex,
    total: snapshot.total,
    completedCount: snapshot.completedCount,
    inProgress:snapshot.inProgress,
    attached:snapshot.attached,
    currentCargo: snapshot.currentCargo,
    doorProgress: snapshot.doorProgress,
    forklift: snapshot.forklift,
    worker: snapshot.worker,
    actorType: snapshot.actorType,
    actorStage: snapshot.actorStage,
    cargoPose: snapshot.cargoPose,
    blockedReasons: snapshot.blockedReasons,
    skipped: snapshot.skipped
  };
}

function queueItemsForDisplay(group, currentIndex, count) {
  if (group.items.length <= count) return group.items;
  const currentOffset = group.items.findIndex(({ index }) => index === currentIndex);
  const center = currentOffset >= 0 ? currentOffset : 0;
  const start = Math.max(0, Math.min(group.items.length - count, center - Math.floor(count / 2)));
  return group.items.slice(start, start + count);
}
function number(value) {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) ? parsed : parsed.toFixed(1);
}

function FilterSelect({ label, value, options, onChange, format = (item) => item }) {
  return <label><span>{label}</span><select aria-label={`${label}筛选`} value={value} onChange={(event) => onChange(event.target.value)}><option value="all">全部</option>{options.map((option) => <option value={option} key={option}>{format(option)}</option>)}</select></label>;
}

function actorLabel(value) {
  return value === 'manual' ? '人工装卸工' : value === 'team_manual' ? '协同人工（待现场确认）' : '叉车';
}

function stateLabel(value) {
  return ({ waiting: '待作业', current: '当前作业', completed: '回放完成', blocked: '已阻断' })[value] || value;
}

function riskLabel(value) {
  return ({ dangerous: '危险品', fragile: '易碎', heavy: '重货', nonstackable: '禁止堆叠', wooden: 'IPPC 木包装', normal: '常规' })[value] || value;
}

function targetZone(item) {
  const x = Number(item?.x || 0);
  if (x < 4000) return '箱内深区';
  if (x < 8500) return '箱内中区';
  return '箱内门区';
}

function replayEvents(cargo) {
  const trace = cargo?.candidateTrace;
  if (!trace) return [];
  return [...(trace.rejected || []).map((candidate) => ({ ...candidate, accepted: false })), trace.accepted && { ...trace.accepted, accepted: true }].filter(Boolean);
}

function buildReplayOverlay(cargo, requestedStep) {
  const events = replayEvents(cargo);
  if (!events.length) return [];
  const step = Math.max(0, Math.min(events.length - 1, Number(requestedStep) || 0));
  const event = events[step];
  if(!event.accepted)return [];
  return [{
    cargo,
    position: {x:cargo.x,y:cargo.y,z:cargo.z},
    kind: event.accepted ? 'accepted' : 'rejected',
    color: event.accepted ? '#28a977' : '#e0564a',
    opacity: event.accepted ? 0.16 : 0.28,
    wireframe: event.accepted
  }];
}

function buildStrategyDiffOverlay(currentPlan, alternativePlan) {
  const currentById = new Map((currentPlan.loadedCargo || []).map((cargo) => [cargo.cargoId, cargo]));
  return (alternativePlan.loadedCargo || []).flatMap((oldCargo) => {
    const current = currentById.get(oldCargo.cargoId);
    if (!current || !cargoMoved(current, oldCargo)) return [];
    return [{ cargo: current, position: oldCargo, kind: 'strategy-old-position', color: '#e48a34', opacity: 0.2, wireframe: true }];
  });
}

function cargoMoved(left, right, epsilon = 0.001) {
  return ['x', 'y', 'z'].some((axis) => Math.abs(Number(left?.[axis] || 0) - Number(right?.[axis] || 0)) > epsilon)
    || String(left?.orientation || '') !== String(right?.orientation || '');
}

function DecisionReplayPanel({ cargo, step, onStep }) {
  const events = replayEvents(cargo);
  if (!events.length) return <aside className="evidence-overlay-panel"><span>DECISION REPLAY</span><strong>该货物没有候选轨迹</strong><p>当前方案可能来自 V1 fallback；界面不会编造拒绝原因。</p></aside>;
  const safeStep = Math.max(0, Math.min(events.length - 1, Number(step) || 0));
  const event = events[safeStep];
  return <aside className="evidence-overlay-panel" data-evidence-mode="replay">
    <span>DECISION REPLAY · {safeStep + 1}/{events.length}</span>
    <strong>{event.accepted ? '已选候选来源' : '历史拒绝记录'} · {event.source==='CROSS_SECTION_LAYER'?'横截面分层':event.source || '来源未提供'}</strong>
    <p>{event.accepted ? `初始 X ${event.position?.x ?? '未提供'} mm，经后处理为当前 X ${cargo.x} mm。场景标出当前方案落位。` : `原始拒绝原因：${event.reason || '未提供'}。历史坐标未叠加到当前方案。`}</p>
    <p>当前记录不含可比较的完整搜索评分。没有拒绝记录，不能据此断言其他位置都不可行。</p>
    <div className="evidence-stepper"><button type="button" disabled={safeStep === 0} onClick={() => onStep(safeStep - 1)}><ChevronLeft size={15} />上一候选</button><input aria-label="Decision Replay step" type="range" min="0" max={events.length - 1} value={safeStep} onChange={(eventChange) => onStep(Number(eventChange.target.value))} /><button type="button" disabled={safeStep === events.length - 1} onClick={() => onStep(safeStep + 1)}>下一候选<ChevronRight size={15} /></button></div>
  </aside>;
}

function StrategyDiffPanel({ currentId, alternativeId, alternatives, onAlternative, currentPlan, alternativePlan }) {
  const currentById = new Map((currentPlan.loadedCargo || []).map((cargo) => [cargo.cargoId, cargo]));
  const moved = (alternativePlan.loadedCargo || []).filter((cargo) => currentById.has(cargo.cargoId) && cargoMoved(currentById.get(cargo.cargoId), cargo)).length;
  const added = (currentPlan.loadedCargo || []).filter((cargo) => !(alternativePlan.loadedCargo || []).some((other) => other.cargoId === cargo.cargoId)).length;
  const removed = (alternativePlan.loadedCargo || []).filter((cargo) => !currentById.has(cargo.cargoId)).length;
  const currentLayout = layoutOf(currentPlan);
  const alternativeLayout = layoutOf(alternativePlan);
  const currentSecuring = securingOf(currentPlan);
  const alternativeSecuring = securingOf(alternativePlan);
  const currentOperation = operationOf(currentPlan);
  const alternativeOperation = operationOf(alternativePlan);
  const metricRows = [
    ['BALANCE · 纵向 CoG', `${Number(alternativePlan.cogOffset?.longitudinal || 0).toFixed(2)}% → ${Number(currentPlan.cogOffset?.longitudinal || 0).toFixed(2)}%`],
    ['COMPACTNESS · Internal Void', `${volumeLabel(alternativeLayout.internalVoidVolume)} → ${volumeLabel(currentLayout.internalVoidVolume)}`],
    ['RESERVE · Largest', `${volumeLabel(alternativeLayout.largestContiguousReserve)} → ${volumeLabel(currentLayout.largestContiguousReserve)}`],
    ['SECURING · Status', `${securingLabel(alternativeSecuring.status)} → ${securingLabel(currentSecuring.status)}`],
    ['OPERATION · Blocked', `${Number(alternativeOperation.blockedCount || 0)} → ${Number(currentOperation.blockedCount || 0)}`],
    ['MOVED · Cargo', `${moved} 件`]
  ];
  return <aside className="evidence-overlay-panel" data-evidence-mode="diff">
    <span>STRATEGY DIFF · 稳定 Cargo ID</span>
    <strong>{alternativeId} ghost → {currentId} solid</strong>
    <p>移动 {moved} · 当前新增 {added} · 当前减少 {removed}。橙色线框为对比策略旧位置，实体为当前策略新位置。</p>
    <dl className="strategy-diff-metrics">{metricRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <label>对比策略<select value={alternativeId} onChange={(event) => onAlternative(event.target.value)}>{alternatives.map((id) => <option value={id} key={id}>{id}</option>)}</select></label>
  </aside>;
}

function CargoInspector({ cargo, plan, isolate, onIsolate, onClose }) {
  const geometricStability = stabilityOf(plan);
  const securing = securingOf(plan);
  const cargoRequiresSecuring = Array.isArray(securing.requiredCargoIds) && securing.requiredCargoIds.includes(cargo.cargoId);
  const securingRows = securing.status ? [
    ['方案系固状态', securingLabel(securing.status)],
    ['本件系固状态', cargoRequiresSecuring ? '需要挡固 / 支撑复核' : securing.required ? '未列为暴露边界货物' : '无需附加固定']
  ] : [];
  const appearance = classifyCargoAppearance(cargo);
  const packaging = cargo.packagingProfile || cargo.cargoPhysicalProfile?.packagingProfile || {};
  const rows = [
    ['货物编号', cargo.cargoId], ['SKU', cargo.sku], ['批次', cargo.batchLabel || cargo.batchId || cargo.batchKey],
    ['目的港', displayPort(cargo.destinationPort)], ['包装类型', appearance.label],
    ['求解包络（长 / 宽 / 高）', `${number(cargo.l)} / ${number(cargo.w)} / ${number(cargo.h)} mm`],
    ['单件重量', `${number(cargo.weight)} kg`], ['搬运方式', actorLabel(cargo.handlingMethod || packaging.handlingMethod)],
    ['叉孔方向', packaging.forkEntry || cargo.forkEntry ? zhEnum(packaging.forkEntry || cargo.forkEntry, packaging.forkEntry || cargo.forkEntry) : null],
    ['显式承载上限', finiteMetric(cargo.maximumSupportedWeightKg || cargo.maxSupportedWeight || packaging.maximumSupportedWeightKg, 'kg')],
    ['放置坐标 X / Y / Z', `${number(cargo.x)} / ${number(cargo.y)} / ${number(cargo.z)} mm`],
    ['朝向', cargo.orientation || cargo.algorithmMeta?.orientation], ['层级', cargo.stackLevel ?? cargo.layer], ['支撑率', cargo.supportRatio == null ? null : `${(Number(cargo.supportRatio) * 100).toFixed(1)}%`],
    ['方案几何稳定', zhEnum(geometricStability.status, geometricStability.status)],
    ['本件风险状态', riskLabel(cargo.riskStatus)],
    ['支撑裕度', finiteMetric(cargo.supportMargin, 'mm')],
    ['堆叠组合重心', stackCogLabel(cargo.stackStability)],
    ['堆叠总质量', finiteMetric(cargo.stackStability?.totalMass, 'kg')],
    ['堆叠支撑裕度', finiteMetric(cargo.stackStability?.supportMargin, 'mm')],
    ['左右约束', restraintLabel(cargo.restraint, ['left', 'right'])],
    ['前后约束', restraintLabel(cargo.restraint, ['rear', 'front'])],
    ['长宽细长比', slendernessLabel(cargo.slenderness)],
    ...securingRows,
    ['装载顺序', cargo.loadingIndex], ['港序', cargo.portSequence],
    ['货物标记', [cargo.dangerous && '危险品', cargo.fragile && '易碎', cargo.stackable === false && '不可堆叠', cargo.heavy && '重货'].filter(Boolean).join(' / ') || '未标记风险']
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  const choices = [['cargo', '仅此货物', cargo.cargoId], ['sku', '同 SKU', cargo.sku], ['batch', '同批次', cargo.batchId || cargo.batchKey], ['port', '同卸货港', cargo.destinationPort]].filter(([, , value]) => value);
  return <aside className="cargo-inspector"><header><div><span>货物检查器</span><strong>{cargo.name || cargo.sku}</strong></div><button type="button" aria-label="关闭货物检查器" onClick={onClose}>×</button></header><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl>{cargo.placementReason && <section className="placement-evidence"><span>为何放在这里 · 算法证据</span><p>{placementReasonSummary(cargo.placementReason)}</p>{cargo.placementReason.balanceInfluence && <small>平衡影响：{formatEvidenceValue(cargo.placementReason.balanceInfluence)}</small>}{cargo.placementReason.rejectedConstraintsBeforePlacement?.length > 0 && <details><summary>此前拒绝约束 {cargo.placementReason.rejectedConstraintsBeforePlacement.length} 条</summary><ul>{cargo.placementReason.rejectedConstraintsBeforePlacement.map((item, index) => <li key={`${item.code || 'constraint'}-${index}`}>{item.code || item.reason || formatEvidenceValue(item)}</li>)}</ul></details>}</section>}<div className="isolate-controls"><span>隔离查看</span>{choices.map(([type, label, value]) => <button type="button" className={isolate?.type === type ? 'active' : ''} onClick={() => onIsolate(isolate?.type === type ? null : { type, value })} key={type}>{label}</button>)}{isolate && <button type="button" onClick={() => onIsolate(null)}>显示全部</button>}</div></aside>;
}

function VoidInspector({ zone, onClose, onRelated, isolated }) {
  const bounds = zone.boundsMm || {};
  const linkedCargoIds = Array.isArray(zone.linkedCargoIds) ? zone.linkedCargoIds : [];
  const volumeM3 = Number(zone.volumeM3 ?? Number(zone.volume || 0) / 1e9);
  const refill = typeof zone.refillPotential === 'object'
    ? zone.refillPotential.status === 'CARGO_CAN_GEOMETRICALLY_FIT' ? `可尝试：${(zone.refillPotential.cargoIds || []).join('、')}` : '当前货物无法合法填入'
    : zhEnum(zone.refillPotential, zone.refillPotential || '未评估');
  const rows = [
    ['体积', `${volumeM3.toFixed(2)} m³`],
    ['X 范围', Number.isFinite(Number(bounds.minX)) ? `${number(bounds.minX)}–${number(bounds.maxX)} mm` : null],
    ['Y 范围', Number.isFinite(Number(bounds.minY)) ? `${number(bounds.minY)}–${number(bounds.maxY)} mm` : null],
    ['Z 范围', Number.isFinite(Number(bounds.minZ)) ? `${number(bounds.minZ)}–${number(bounds.maxZ)} mm` : null],
    ['关联对象', `${linkedCargoIds.length} 项`]
  ].filter(([, value]) => value !== null && value !== undefined);
  return <aside className="cargo-inspector void-inspector" data-void-zone-id={zone.id}><header><div><span>{zone.classification === 'UNEXPLAINED_VOID' ? '未解释剩余空间' : '正式空间证据'}</span><strong>{zone.id}</strong></div><button type="button" aria-label="关闭空洞检查器" onClick={onClose}>×</button></header><section className="void-inspector__status"><span>{zone.classification === 'UNEXPLAINED_VOID' ? '原因未决' : '证据分类'}</span><strong>{zone.classification}</strong></section><p className="void-inspector__reason">{zone.classification === 'UNEXPLAINED_VOID' ? '现有证据不足以确定根因；不推测港序、结构、门区或系固原因。' : zone.reason || '空间范围与分类读取自当前正式方案。'}</p><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl><div className="analysis-actions"><button type="button" disabled={!linkedCargoIds.length} aria-pressed={isolated} onClick={onRelated}>{isolated ? '恢复全部货物' : `仅看关联 ${linkedCargoIds.length} 件`}</button><button type="button" onClick={onClose}>返回空间证据</button></div><details className="void-linked-objects"><summary>查看关联对象 {linkedCargoIds.length} 项</summary><div><span>技术对象 ID / 内部追溯信息</span><dl><div><dt>回填潜力</dt><dd>{refill}</dd></div><div><dt>系固需要</dt><dd>{zone.securingNeed || '未触发'}</dd></div></dl>{linkedCargoIds.length ? <ul>{linkedCargoIds.map((id) => <li key={id}><code>{id}</code></li>)}</ul> : <p>当前没有直接关联对象。</p>}</div></details>{zone.classification === 'UNEXPLAINED_VOID' && <section className="void-defect-callout"><CircleAlert size={16} /><div><strong>根因未决</strong><p>该区域只标记为未解释剩余空间；候选拒绝链尚不足以支持业务根因结论。</p></div></section>}</aside>;
}

function RuleEvidencePanel({ plan, cargo, zone, onOpen }) {
  const readiness = plan.shipmentReadiness || plan.ext_shipmentReadiness;
  const all = readiness?.evidence || [...(readiness?.actionableEvidence || []), ...(readiness?.passedEvidence || [])];
  const relevant = all.filter((item) => {
    const space = item.spaceEvidence || {};
    if (cargo?.cargoId && (space.cargoIds || []).includes(cargo.cargoId)) return true;
    if (zone?.id && [...(space.zoneIds || []), ...(space.defectZoneIds || [])].includes(zone.id)) return true;
    return !cargo && !zone && (item.ruleReferences || []).length > 0;
  }).slice(0, 5);
  return <aside className="rule-evidence-panel"><span>规则证据</span><h2>{cargo ? `${cargo.sku || cargo.cargoId} 的关联证据` : zone ? `${zone.id} 的关联证据` : '本票规则与指导来源'}</h2>{relevant.length ? relevant.map((item) => <div key={item.id}><strong>{item.title}</strong><small>{zhEnum(item.status)} · {(item.ruleReferences || []).map((rule) => rule.title).join('、') || '项目几何证据'}</small></div>) : <p>当前选择没有单独规则引用；几何结论仍可在出运准备中追溯输入与计算。</p>}<button type="button" onClick={onOpen}>打开出运准备证据</button></aside>;
}

function lifoLabel(value) {
  if (value === true) return 'LIFO 通过';
  if (value === false) return 'LIFO 异常';
  return 'LIFO 未提供';
}

// 六模式统一图例：每个模式解释色阶语义，切换时以 key 重挂载触发入场动效。
function VisualizationLegend({ mode, plan, machine: _machine, legend }) {
  const loaded = plan.loadedCargo || [];
  let body = null;
  if (mode === 'normal') {
    body = legend.length
      ? legend.map((item) => <span className="legend-item" key={item.key}><i style={{ background: item.color }} />{item.label}</span>)
      : <span className="legend-note">当前方案无可分类货物</span>;
  } else if (mode === 'weight') {
    const weights = loaded.map((item) => Number(item.weight)).filter(Number.isFinite);
    if (!weights.length) return null;
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const mean = weights.reduce((sum, value) => sum + value, 0) / weights.length;
    const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => weightColor(min + (max - min) * t, min, max));
    body = <>
      <span className="legend-label">单件重量</span>
      <span className="legend-scale"><i style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} /></span>
      <span className="legend-note">{min.toFixed(1)} — {max.toFixed(1)} kg · 均值 {mean.toFixed(1)} kg · 越暖越重</span>
    </>;
  } else if (mode === 'port') {
    const context = buildVisualizationContext(loaded, plan.containerInfo || {});
    body = <>
      {Object.entries(context.portColors).map(([sequence, color]) => <span className="legend-item" key={sequence}><i style={{ background: color }} />第 {sequence} 港</span>)}
      <span className="legend-note">LIFO 后装先卸 · 港序越大越靠近箱门</span>
    </>;
  } else if (mode === 'space') {
    const model = plan.voidJustification || plan.ext_voidJustification || plan.metrics?.voidJustification;
    body = model?.zones?.length ? <><span className="legend-item"><i style={{ background: '#5c9d94' }} />约束与平衡空间</span><span className="legend-note">精确边界 · 原 VOID 包络另行校核</span></> : <><span className="legend-item"><i style={{ background: '#4ca5a0' }} />空闲体素</span><span className="legend-note">16×5×5 近似网格 · 非正式空洞证据</span></>;
  } else if (mode === 'balance') {
    body = <>
      <span className="legend-item"><i style={{ background: '#56635e' }} />几何中心</span>
      <span className="legend-item"><i style={{ background: '#e27b33' }} />货物重心</span>
      <span className="legend-note">横向偏移 {Number(plan.cogOffset?.lateral || 0).toFixed(2)}% · 纵向偏移 {Number(plan.cogOffset?.longitudinal || 0).toFixed(2)}%</span>
    </>;
  } else if (mode === 'risk') {
    body = <>
      <span className="legend-item"><i style={{ background: riskColor({ riskStatus: 'STABLE' }) }} />几何稳定 · STABLE</span>
      <span className="legend-item"><i className="legend-swatch--securing" />运输系固待复核</span>
      <span className="legend-item"><i style={{ background: riskColor({ riskStatus: 'LOW_RESTRAINT' }) }} />LOW RESTRAINT</span>
      <span className="legend-item"><i style={{ background: riskColor({ riskStatus: 'TALL_FREE_STACK' }) }} />TALL FREE STACK</span>
      <span className="legend-item"><i style={{ background: riskColor({ riskStatus: 'LOW_SUPPORT_MARGIN' }) }} />LOW SUPPORT MARGIN</span>
      <span className="legend-item"><i style={{ background: riskColor({ riskStatus: 'STACK_COG_WARNING' }) }} />STACK COG WARNING</span>
      <span className="legend-item"><i style={{ background: riskColor({ riskStatus: 'INVALID' }) }} />INVALID</span>
    </>;
  }
  if (!body) return null;
  return <div className="visualization-legend" data-mode={mode} key={mode}>{body}</div>;
}

function visualizationReadout(mode, plan, selectedVoidZone = null) {
  if (mode === 'weight') {
    const weights = (plan.loadedCargo || []).map((item) => Number(item.weight)).filter(Number.isFinite);
    return weights.length ? { title: 'WEIGHT · 动态范围', lines: [`${Math.min(...weights).toFixed(1)} — ${Math.max(...weights).toFixed(1)} kg / 件`] } : null;
  }
  if (mode === 'port') {
    const ports = new Set((plan.loadedCargo || []).map((item) => item.destinationPort || item.portSequence).filter(Boolean));
    return { title: 'PORT / LIFO · 真实卸货分组', lines: [`${ports.size} 个可识别目的港/港序`] };
  }
  if (mode === 'space') {
    const voidModel = plan.voidJustification || plan.ext_voidJustification || plan.metrics?.voidJustification || {};
    const selectedVolume = selectedVoidZone ? Number(selectedVoidZone.volumeM3 ?? Number(selectedVoidZone.volume || 0) / 1e9) : null;
    const totalVolume = Number(voidModel.unexplainedVoidVolume ?? 0) / (Number(voidModel.unexplainedVoidVolume ?? 0) > 1000 ? 1e9 : 1);
    return {
      title: 'SPACE · FORMAL VOID EVIDENCE',
      lines: [
        `Selected ${selectedVolume == null ? '—' : `${selectedVolume.toFixed(2)} m³`}`,
        `Total unexplained ${totalVolume.toFixed(2)} m³ · ROOT CAUSE UNRESOLVED`
      ]
    };
  }
  if (mode === 'balance') return { title: 'BALANCE · 真实重心', lines: [`横向偏移 ${Number(plan.cogOffset?.lateral || 0).toFixed(2)}%`, `纵向偏移 ${Number(plan.cogOffset?.longitudinal || 0).toFixed(2)}%`] };
  if (mode === 'securing') {
    const admission = plan.admission || plan.ext_admission;
    const transport = admission?.domains?.transportSecuring?.evidence;
    return { title: 'SECURING · 几何需求 / 运输能力分离', lines: [securingLabel(securingOf(plan).status), transport?.status || 'SECURING_UNRESOLVED'] };
  }
  if (mode === 'risk') {
    const stability = plan.stability || plan.validator?.stability || plan.ext_stability;
    const securing = securingOf(plan);
    const statuses = (plan.loadedCargo || []).reduce((counts, item) => {
      const status = item.riskStatus || 'NOT_PROVIDED';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    const lines = stability
      ? [`几何稳定 ${stability.status} · Invalid ${Number(stability.invalidCount || 0)} · Warning ${Number(stability.warningCount || 0)}`, `最小支撑裕度 ${metricText(stability.summary?.minSupportMargin, 'mm')} · Low restraint ${Number(statuses.LOW_RESTRAINT || 0)}`]
      : [`方案警告 ${(plan.warnings || []).length} 条`, '当前方案未提供 StabilityAnalyzer 数据'];
    const requiredCargoCount = Array.isArray(securing.requiredCargoIds) ? securing.requiredCargoIds.length : Number(securing.securingRequiredCount || 0);
    if (stability && securing.status) lines.splice(1, 0, `几何稳定 ≠ 运输系固已确认 · 需复核 ${requiredCargoCount} 件 / ${Number(securing.securingPlaneCount || 0)} 个边界面`);
    return {
      title: securing.status ? 'RISK · GEOMETRIC STABILITY / CARGO SECURING' : 'RISK · GEOMETRIC STABILITY',
      lines
    };
  }
  return null;
}

function finiteMetric(value, unit) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)} ${unit}` : null;
}

function layoutOf(plan = {}) { return plan.layoutQuality || plan.ext_layoutQuality || plan.metrics?.layoutQuality || {}; }
function securingOf(plan = {}) { return plan.securing || plan.ext_securing || plan.metrics?.securing || {}; }
function operationOf(plan = {}) { return plan.operationFeasibility || plan.ext_operationFeasibility || plan.metrics?.operationFeasibility || {}; }
function stabilityOf(plan = {}) { return plan.stability || plan.validator?.stability || plan.ext_stability || {}; }
function samePlacementPlan(left, right) {
  if (!left || !right) return false;
  if (left.placementHash && right.placementHash) return left.placementHash === right.placementHash;
  if ((left.loadedCargo || []).length !== (right.loadedCargo || []).length) return false;
  const otherById = new Map((right.loadedCargo || []).map((item) => [item.cargoId, item]));
  return (left.loadedCargo || []).every((item) => {
    const other = otherById.get(item.cargoId);
    return other && ['x', 'y', 'z', 'l', 'w', 'h'].every((key) => Math.abs(Number(item[key]) - Number(other[key])) < 0.001);
  });
}
function securingLabel(value) { return ({ SECURING_NOT_REQUIRED: '无需附加', SECURING_REQUIRED: '需固定方案', SECURING_UNRESOLVED: '需工程复核' })[value] || value || 'N/A'; }
function volumeLabel(value) { const numeric = Number(value); return Number.isFinite(numeric) ? `${(numeric / 1e9).toFixed(2)} m³` : 'N/A'; }

function metricText(value, unit) {
  return finiteMetric(value, unit) || 'N/A';
}

function stackCogLabel(stack) {
  if (!stack) return null;
  const values = [stack.cogX, stack.cogY, stack.cogZ].map(Number);
  return values.every(Number.isFinite) ? `${values.map((value) => value.toFixed(1)).join(' / ')} mm` : null;
}

function restraintLabel(restraint, directions) {
  if (!restraint) return null;
  const labels = directions.map((direction) => {
    const value = restraint[direction];
    if (!value) return null;
    const gap = Number(value.gap);
    const ratio = Number(value.contactRatio);
    return `${direction.toUpperCase()} ${value.status}${Number.isFinite(gap) ? ` · ${gap.toFixed(1)} mm` : ''}${Number.isFinite(ratio) ? ` · ${(ratio * 100).toFixed(0)}%` : ''}`;
  }).filter(Boolean);
  return labels.length ? labels.join(' | ') : null;
}

function slendernessLabel(slenderness) {
  if (!slenderness) return null;
  const length = Number(slenderness.length);
  const width = Number(slenderness.width);
  return Number.isFinite(length) && Number.isFinite(width) ? `${length.toFixed(2)} / ${width.toFixed(2)}` : null;
}

function placementReasonSummary(reason) {
  if (!reason) return '当前方案未提供放置依据';
  if (reason.statement) return reason.statement;
  const values = [
    reason.unloadingGroup != null && `卸货组 ${reason.unloadingGroup}`,
    reason.block && `空间块 ${reason.block}`,
    reason.layer != null && `层级 ${reason.layer}`,
    reason.orientation && `朝向 ${reason.orientation}`
  ].filter(Boolean);
  return values.join(' · ') || '当前依据缺少可读摘要，可展开原始数据复核';
}

function formatEvidenceValue(value) {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
