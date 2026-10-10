import CommercePanel from '../../components/cargo/CommercePanel.jsx';
import CommerceDecisionSummary from '../../components/cargo/CommerceDecisionSummary.jsx';
import { askPortcube } from '../../components/feedback/ContextAssistant.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CircleAlert, Cpu, GitCompareArrows, RefreshCw, ShieldCheck, Weight } from 'lucide-react';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { SESSION_ACTIONS } from '../../app/session/sessionReducer.js';
import { ROUTES } from '../../app/router.js';
import { useFeedback } from '../../components/feedback/FeedbackProvider.jsx';
import { Dialog, InlineLoading } from '../../components/feedback/Overlays.jsx';
import { SourceNote, StatusPill } from '../../components/common/Status.jsx';
import { CONTAINER_CATALOG, DECISION_CONTAINER_TYPES, containerVolume, getContainer } from '../../domain/container/catalog.js';
import { generateLocalPreview } from '../../domain/container/localPreview.js';
import { cargoTotals, validateCargo } from '../../domain/cargo/cargo.js';
import { AUTHORITATIVE_ALGORITHM_ID, generatePackingPlan, replanPackingPlan } from '../../services/packingApi.js';
import { PAGE_COPY } from '../../domain/presentation/productCopy.js';
import { getPlanSourceLabel, isBackendSolved } from '../../domain/provenance/planSource.js';
import { buildPackingCasePayload, savePackingCase } from '../../services/caseApi.js';
import { buildActivePlanViewModel, formatPlanMetric } from '../../domain/plan/activePlanViewModel.js';
import { recommendStrategy } from '../../domain/plan/strategyRecommendation.js';
import { zhEnum } from '../../domain/presentation/localization.js';
import { useContainerThumbnails } from '../../three/LandingExperience.jsx';
import { PlanVersions } from '../../components/common/PlanVersions.jsx';
import { PlanDiff, PlanStateNotice } from '../../components/common/PlanDiff.jsx';

const STRATEGIES = Object.freeze([
  { id: 'SPACE', label: '空间', objective: '紧凑布局 · 连续余量', metric: 'compactness' },
  { id: 'BALANCE', label: '平衡', objective: '降低横向 / 纵向重心偏移', metric: 'balance' },
  { id: 'OPERATION', label: '作业', objective: '减少切换、分组与插入距离', metric: 'operation' }
]);

export default function ContainerPage({ navigate }) {
  const { session, dispatch, activePlan, activePlanView, planSource, container, fingerprint, actions, stalePlan, latestPlanDiff } = useSession();
  const { notify } = useFeedback();
  const isSource=session.solverMode==='SOURCE_BENCHMARK';
  const isCommerce=Boolean(session.caseContext?.commerce?.enabled);
  const requestInFlight = useRef(false);
  const abortController = useRef(null);
  const liveIdentity = useRef(null);
  liveIdentity.current = `${session.sessionTaskId}:${fingerprint}`;
  useEffect(() => () => { abortController.current?.abort(); requestInFlight.current = false; }, [fingerprint, session.sessionTaskId]);
  const [unloadedOpen, setUnloadedOpen] = useState(false);
  const [completedStrategies, setCompletedStrategies] = useState(0);
  const [strategyRuns, setStrategyRuns] = useState({});
  const [equipmentInspectorMode, setEquipmentInspectorMode] = useState(session.containerMode);
  const [actualContainerDraft, setActualContainerDraft] = useState(() => ({ ...(session.actualContainer || {}) }));
  const alternatives = useMemo(() => (isSource?[]:DECISION_CONTAINER_TYPES).map((typeId) => {
    const candidate = getContainer(typeId);
    const preview=generateLocalPreview(session.cargo, candidate);
    if(isBackendSolved(planSource) && typeId===container.typeId)return {container:candidate,preview:{...preview,
      totalCargoCount:activePlanView.loadedCount ?? activePlan.loadedCargo?.length ?? 0,totalCargoInput:activePlanView.inputCount ?? activePlan.totalCargoInput ?? session.cargo.reduce((n,c)=>n+c.quantity,0),
      loadedCargo:activePlan.loadedCargo,unloadedCargo:activePlan.unloadedCargo || [],
      spaceUtilization:activePlan.spaceUtilization ?? activePlan.metrics?.volumeUtilization ?? preview.spaceUtilization,
      sourceLabel:'当前装载方案',sourceCode:'BACKEND_SOLVED'}};
    return { container: candidate, preview };
  }), [session.cargo,activePlan,activePlanView,planSource,container?.typeId,isSource]);
  const recommendation = useMemo(() => recommendContainer(alternatives), [alternatives]);
  const totals = useMemo(() => cargoTotals(session.cargo), [session.cargo]);
  const recommendedStrategy = useMemo(() => recommendStrategy(session.strategyPlans), [session.strategyPlans]);
  const isLoading = session.planStatus === 'loading';
  const invalidCargoCount = useMemo(() => session.datasetCapabilities?.canSolve===false?session.cargo.length:isSource?(session.datasetCapabilities?.canSolve?0:session.cargo.length):session.cargo.filter((cargo) => !validateCargo(cargo).valid).length, [session.cargo,isSource,session.datasetCapabilities]);
  const actualRequired = ['containerNumber', 'innerLength', 'innerWidth', 'innerHeight', 'doorWidth', 'doorHeight', 'tare', 'maxGross'];
  const actualMissing = session.containerMode === 'ACTUAL_CONTAINER' ? actualRequired.filter((key) => !session.actualContainer?.[key]) : [];
  const actualDraftMissing = actualRequired.filter((key) => !actualContainerDraft?.[key]);
  const containerThumbnails = useContainerThumbnails(DECISION_CONTAINER_TYPES);
  const solvedStrategies = Object.values(session.strategyPlans || {}).filter(Boolean);
  const strategyConverged = solvedStrategies.length === 3 && solvedStrategies.slice(1).every((plan) => samePlacementPlan(solvedStrategies[0], plan));

  const inspectEquipmentMode = (mode) => {
    setEquipmentInspectorMode(mode);
    if (mode === 'REFERENCE_PROFILE' && session.containerMode === 'ACTUAL_CONTAINER') actions.setContainerMode('REFERENCE_PROFILE');
  };

  const applyActualContainer = () => {
    if (actualDraftMissing.length > 0) return;
    actions.setActualContainer(actualContainerDraft);
    actions.setContainerMode('ACTUAL_CONTAINER');
  };

  const selectContainer = (typeId) => {
    if (isLoading || typeId === session.selectedContainerType) return;
    actions.setContainerType(typeId);
    notify(`已选择 ${typeId}，请重新计算装载方案`, { variant: 'info' });
  };

  const generate = async (mode = 'generate') => {
    if (requestInFlight.current || isLoading || !session.cargo.length || invalidCargoCount) return;
    if (actualMissing.length) {
      notify(`实箱模式仍缺 ${actualMissing.length} 项必要数据，请先补全信息`, { variant: 'warning' });
      return;
    }
    requestInFlight.current = true;
    const requestId = crypto.randomUUID();
    const identity = liveIdentity.current;
    const controller = new AbortController();
    abortController.current = controller;
    const stillCurrent = () => !controller.signal.aborted && liveIdentity.current === identity;
    const isReplan = mode === 'replan' && Boolean(stalePlan || session.backendPlan);
    const previousPlan = stalePlan || session.backendPlan;
    const previousRevision = [...(session.planRevisions || []), ...(session.planHistory || [])].findLast(entry => (entry.planId || entry.plan?.planId) === previousPlan?.planId);
    const requestedStrategies = isReplan || isSource || session.caseContext?.commerce?.enabled ? [STRATEGIES[0]] : STRATEGIES;
    setStrategyRuns(Object.fromEntries(requestedStrategies.map(({id})=>[id,'loading'])));
    setCompletedStrategies(0);
    dispatch({ type: SESSION_ACTIONS.PLAN_REQUEST, requestId, fingerprint });
    try {
      const plans = Object.fromEntries(await Promise.all(requestedStrategies.map(async ({ id }) => {
        const result = await (isReplan ? replanPackingPlan : generatePackingPlan)({
        containerType: session.selectedContainerType,
        cargoList: session.cargo,
        solver: AUTHORITATIVE_ALGORITHM_ID,
        strategy: id.toLowerCase(),
        includeAiExplanation: false,
        solverMode:session.solverMode,externalDataset:session.externalDataset,
        caseContext: session.caseContext,
        containerMode: session.containerMode,
        actualContainer: session.actualContainer,
        massEvidence: session.massEvidence,
        vgm: session.vgm,
        transport: session.transport,
        securingInputs: session.securingInputs,
        ...(isReplan ? { previousPlan, previousCargo: previousRevision?.cargoSnapshot || [], reason: session.staleReason || '用户请求重规划' } : {})
        }, { signal: controller.signal }).then(result=>{
          if(stillCurrent())setStrategyRuns(current=>({...current,[id]:'ready'}));
          return result;
        },error=>{
          if(stillCurrent())setStrategyRuns(current=>({...current,[id]:'error'}));
          throw error;
        });
        if (stillCurrent()) setCompletedStrategies(count => count + 1);
        return [id, result];
      })));
      if (!stillCurrent()) return;
      const selectedStrategy = recommendStrategy(plans) || session.selectedStrategy || 'SPACE';
      const plan = plans[selectedStrategy] || plans.SPACE;
      dispatch({ type: SESSION_ACTIONS.STRATEGY_PLANS_SUCCESS, plans, selectedStrategy, fingerprint, requestId });
      if(plan.executionStatus?.persistence==='NOT_REQUESTED'){notify('装载方案已生成，已保留在当前工作区', {variant:'success'});return;}
      if(session.caseContext?.commerce?.enabled){notify(plan.commerce?.decisionStatus==='ORDER_ACTION_REQUIRED'?'方案已更新，请检查未齐套订单':'装载方案已更新', {variant:plan.commerce?.decisionStatus==='ORDER_ACTION_REQUIRED'?'warning':'success'});return;}
      try {
        const packingCase = await savePackingCase(buildPackingCasePayload({ session, plan }), { signal: controller.signal });
        if (!stillCurrent()) return;
        dispatch({ type: SESSION_ACTIONS.CASE_SYNC_SUCCESS, packingCase, basePlanId: plan.planId });
        notify(`${isReplan ? '重规划新版本' : isSource ? '来源方案' : '三种策略方案'}已生成，并保存当前方案到任务 ${packingCase.caseId}`, { variant: 'success' });
      } catch (caseError) {
        if (!stillCurrent()) return;
        dispatch({ type: SESSION_ACTIONS.CASE_SYNC_FAILURE, error: caseError.message, basePlanId: plan.planId });
        notify('后端装载方案已生成，但跨端 Case 暂未保存；可重新计算后重试同步', { variant: 'warning', duration: 6000 });
      }
    } catch (error) {
      dispatch({ type: SESSION_ACTIONS.PLAN_FAILURE, error: controller.signal.aborted ? '计算已取消，请重新生成方案。' : error.message, requestId, fingerprint });
      if (!stillCurrent()) return;
      notify(error.message || '方案生成失败，可重试', { variant: 'error', duration: 5000 });
    } finally {
      if (abortController.current === controller) requestInFlight.current = false;
    }
  };

  const loaded = activePlanView.loadedCount;
  const input = activePlanView.inputCount;
  const unloaded = activePlanView.unloadedCount;
  const weightRate = activePlanView.weightRate;
  const reason = isSource?null:explainSelection(container, activePlan, alternatives);

  if(isSource)return <div className="page container-page" data-loaded-count={loaded??''} data-input-count={input??''} data-unloaded-count={unloaded??''}>
    <CommercePanel compact/>
      <header className="page-header"><div><h1>装载规划</h1><p>{session.externalDataset?.displayName} · {session.externalDataset?.instanceId}</p></div><div className="page-header__actions"><button className="button button--primary" type="button" onClick={generate} disabled={isLoading||invalidCargoCount>0}>{isLoading?'正在计算…':'计算装载'}</button><button className="button button--secondary" type="button" onClick={()=>navigate(ROUTES.twin)} disabled={!isBackendSolved(planSource)}>查看三维方案</button></div></header>
      {!!Object.keys(strategyRuns).length && <section className="strategy-progress" aria-label="各策略求解状态">{STRATEGIES.filter(({id})=>strategyRuns[id]).map(({id,label})=><article key={id} data-state={strategyRuns[id]}><strong>{label}</strong><StatusPill status={strategyRuns[id]==='ready'?'ready':strategyRuns[id]==='error'?'error':'info'}>{strategyRuns[id]==='ready'?'已返回':strategyRuns[id]==='error'?'失败':'求解中'}</StatusPill>{strategyRuns[id]==='error'&&<button type="button" className="button button--secondary button--small" disabled={isLoading} onClick={()=>generate(stalePlan?'replan':'generate')}>重新计算本轮</button>}</article>)}</section>}
    <PlanVersions plan={isBackendSolved(planSource)?activePlan:null} history={session.planHistory} revisions={session.planRevisions}/>
    <PlanStateNotice session={session} />
    <PlanDiff diff={latestPlanDiff} />
    <section className="card"><h2>{container?.sourceType||container?.standardType||container?.name||'来源箱体不可用'}</h2><p>{container?.innerLength} × {container?.innerWidth} × {container?.innerHeight} mm · 载重上限 {container?.maxWeight==null?'未提供':`${container.maxWeight} kg`}</p><p>按来源箱体与货物约束计算</p></section>
    {session.planError&&<p className="page-error">{session.planError}</p>}
    <section className="card"><dl className="key-metrics"><div><dt>装入 / 输入</dt><dd>{isBackendSolved(planSource)?`${loaded}/${input}`:`— / ${totals.pieces}`}</dd></div><div><dt>容积利用率</dt><dd>{isBackendSolved(planSource)?formatPlanMetric(activePlanView.utilization,{decimals:2,suffix:'%'}):'—'}</dd></div><div><dt>装入重量</dt><dd>{activePlanView.totalWeight==null?'未提供 / 未计算':`${activePlanView.totalWeight.toFixed(2)} kg`}</dd></div><div><dt>载荷分布</dt><dd>来源未提供校核条件</dd></div></dl>
    <details><summary>约束与计算记录</summary><dl>{Object.entries(activePlan.executionStatus||session.executionStatus||{}).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p>支撑按运输外形的接触区域计算；包装内部传力与实际搬运条件需要单独核对。</p></details></section>
    {isBackendSolved(planSource)&&<section className="card"><h2>待安排 · {unloaded} 件</h2><div className="table-scroll"><table className="data-table"><thead><tr><th>货物</th><th>数量</th><th>原因</th></tr></thead><tbody>{[...new Set((activePlan.unloadedCargo||[]).map(c=>c.sourceCargoId))].map(id=>{const rows=activePlan.unloadedCargo.filter(c=>c.sourceCargoId===id),source=session.cargo.find(c=>c.cargoId===id);return <tr key={id}><td>{source?.name||rows[0]?.name||id}<small>{source?.sku}</small></td><td>{rows.length}</td><td>当前搜索未找到合适货位</td></tr>;})}</tbody></table></div><details><summary>逐件诊断记录</summary><pre style={{whiteSpace:'pre-wrap',maxHeight:280,overflow:'auto'}}>{JSON.stringify(activePlan.unloadedDiagnostics||[],null,2)}</pre></details></section>}

  </div>;

  return (
    <div className="page container-page" data-loaded-count={loaded ?? ''} data-unloaded-count={unloaded ?? ''} data-input-count={input ?? ''}>
      <header className="page-header">
        <div><span className="page-kicker">航线 · 设备 · 方案</span><h1>{PAGE_COPY.container.title}</h1><p>先比较柜型能装多少，再核对实箱资料与限制条件，生成可复核方案。</p></div>
        <div className="page-header__actions"><div className="algorithm-badge" data-authoritative-algorithm={AUTHORITATIVE_ALGORITHM_ID}><Cpu size={18} /><span>装载计算</span><strong>{isCommerce ? '混装 · 订单 · 卸货顺序' : '空间 · 平衡 · 作业'}</strong></div><button className="button button--primary" type="button" onClick={generate} disabled={isLoading || !session.cargo.length || invalidCargoCount || actualMissing.length > 0}>{isLoading ? <InlineLoading label="正在比较方案" /> : <><RefreshCw size={18} />{isBackendSolved(planSource) ? '重新计算装载方案' : '生成推荐方案'}</>}</button></div>
      </header>

      <PlanVersions plan={isBackendSolved(planSource) ? activePlan : null} history={session.planHistory} revisions={session.planRevisions} />
      <PlanStateNotice session={session} onReplan={() => generate('replan')} />
      <PlanDiff diff={latestPlanDiff} />
      {isCommerce && <details className="card"><summary>货主、批次与订单检查</summary><CommercePanel compact/>{isBackendSolved(planSource) && <CommerceDecisionSummary plan={activePlan}/>}</details>}

      {isLoading && <div className="solver-progress" role="status" aria-live="polite"><InlineLoading label={`正在比较装载方案 · 已返回 ${completedStrategies}/${Object.keys(strategyRuns).length || 1}`} /><p>正在检查装入数量、支撑、港序和空间布局。{session.backendPlan ? '下方仍显示上一版方案；新结果返回后会更新。' : '下方容量数据是本地预览；计算完成后会更新。'}</p></div>}
      {!!Object.keys(strategyRuns).length && <section className="strategy-progress" aria-label="各策略求解状态">{STRATEGIES.filter(({id})=>strategyRuns[id]).map(({id,label})=><article key={id} data-state={strategyRuns[id]}><strong>{label}</strong><StatusPill status={strategyRuns[id]==='ready'?'ready':strategyRuns[id]==='error'?'error':'info'}>{strategyRuns[id]==='ready'?'已返回':strategyRuns[id]==='error'?'失败':'求解中'}</StatusPill>{strategyRuns[id]==='error'&&<button type="button" className="button button--secondary button--small" disabled={isLoading} onClick={()=>generate(stalePlan?'replan':'generate')}>重新计算本轮</button>}</article>)}</section>}

      {session.planStatus === 'error' && <div className="page-error"><CircleAlert size={20} /><div><strong>方案生成失败</strong><p>{session.planError}</p></div><button className="button button--secondary button--small" type="button" onClick={generate}>重试</button></div>}
      {invalidCargoCount > 0 && <div className="page-error"><CircleAlert size={20} /><div><strong>{invalidCargoCount} 条货物数据无效，请先补全信息</strong><p>返回货物数据集修正行内标注的尺寸、重量或数量后再生成方案。</p></div><button className="button button--secondary button--small" type="button" onClick={() => navigate(ROUTES.cargo)}>修正货物</button></div>}

      <section className="decision-recommendation decision-recommendation--copilot" aria-label="柜型决策卡">
        <div><span className="decision-label">柜型初筛 · 容量估算</span><h2>优先核算 {recommendation.typeId}</h2><p>容量估算用于选择待计算柜型；只对当前已计算柜型展示正式货位。备选柜型尚未经过完整约束校核，不能据此确认全部装入。</p>
          <dl className="decision-inputs"><div><dt>本票货物</dt><dd>{totals.pieces} 件 · {totals.weight==null?'重量未提供':`${totals.weight.toLocaleString()} kg`}</dd></div><div><dt>设备边界</dt><dd>{session.containerMode==='ACTUAL_CONTAINER'?'按已录实箱资料复核':'参考箱型；提箱后需核对净尺寸与门洞'}</dd></div></dl>
        </div>
        <div className="decision-recommendation__facts">{alternatives.map(({container:c,preview})=><span key={c.typeId}><strong>{c.typeId}{recommendation.typeId===c.typeId?' · 建议':' · 备选'}</strong><b>{preview.totalCargoCount}/{preview.totalCargoInput} 件</b><small>{preview.sourceCode==='BACKEND_SOLVED'?'正式求解':'容量估算 · 待求解'} · 利用率 {preview.spaceUtilization.toFixed(1)}%</small><small>未装 {Math.max(preview.unloadedCargo.length, preview.totalCargoInput-preview.totalCargoCount)} 件</small></span>)}</div>
        <div className="decision-recommendation__next"><strong>待确认</strong><p>{activePlan.shipmentReadiness?.actionableEvidence?.slice(0,2).map(e=>e.title).join('、') || 'VGM、实箱资料与实际作业条件'}</p><button className="button button--primary button--small" type="button" onClick={()=>isBackendSolved(planSource)?navigate(ROUTES.twin):generate()} disabled={isLoading||invalidCargoCount>0}>{isBackendSolved(planSource)?'查看三维与作业':'生成装载方案'}<ArrowRight size={15}/></button><button className="button button--secondary button--small" type="button" onClick={()=>askPortcube('为什么建议当前柜型？请比较其他柜型的装入数量、空间、重量和门洞限制，并说明待确认资料。')}>请 Copilot 解释决策</button><small>更换柜型后需重新计算；备选容量为初筛结果。</small></div>
      </section>

      {session.datasetCapabilities?.canSolve===false&&<p role="status">当前模式未接入完整约束：{session.datasetCapabilities.blockingReasons.join('、')}。请切换为来源基准任务。</p>}
      <ContainerVisualSelector alternatives={alternatives} selectedType={container.typeId} recommendation={recommendation} thumbnails={containerThumbnails} totals={totals} onSelect={selectContainer} disabled={isLoading} />

      <RouteEquipmentContext
        session={session}
        container={container}
        alternatives={alternatives}
        recommendation={recommendation}
        totals={totals}
        selectContainer={selectContainer}
        inspectorMode={equipmentInspectorMode}
        inspectEquipmentMode={inspectEquipmentMode}
        actualDraft={actualContainerDraft}
        setActualDraft={setActualContainerDraft}
        actualDraftMissing={actualDraftMissing}
        applyActualContainer={applyActualContainer}
      />

      <section className="strategy-lab strategy-lab--lanes" aria-label="三策略比较通道">
        <div className="strategy-lab__heading"><div><span className="decision-label">策略组合</span><h2>{isCommerce ? '混装方案与约束表现' : '比较空间、平衡与作业表现'}</h2><p>每种策略都先检查重量、支撑与港序，再比较空间余隙、载荷分布和搬运成本。</p></div><div className="strategy-lab__controls"><StatusPill status={Object.keys(session.strategyPlans || {}).length === 3 ? 'ready' : 'preview'}>{Object.keys(session.strategyPlans || {}).length === 3 ? '三套方案已生成' : isCommerce && isBackendSolved(planSource) ? '混装方案已生成' : '等待计算'}</StatusPill></div></div>
        <div className="strategy-policy-lane" aria-label="策略共同约束"><span><ShieldCheck size={14} />硬约束锁定</span><i />数量守恒 · 载荷 · 碰撞 · 支撑稳定 · 港序后进先出<span>软目标 → 空间 / 平衡 / 作业</span></div>
        {strategyConverged ? <ConvergedStrategyPlan activePlan={activePlan} activePlanView={activePlanView} strategies={STRATEGIES} selectedStrategy={session.selectedStrategy} onSelect={actions.setStrategy} /> : <div className="strategy-profiles strategy-decision-table">{STRATEGIES.map((strategy) => {
          const plan = session.strategyPlans?.[strategy.id];
          const planView = plan ? buildActivePlanViewModel({ session, plan, container: plan.containerInfo || container }) : null;
          const selected = session.selectedStrategy === strategy.id;
          const metrics = plan?.metrics;
          const recommended = recommendedStrategy === strategy.id;
          const outsidePolicy = metrics?.cog?.withinPolicy === false || plan?.loadDistribution?.centreOfGravity?.guidanceStatus === 'OUTSIDE_GUIDANCE';
          const converged = plan && Object.entries(session.strategyPlans || {}).some(([id, other]) => id !== strategy.id && samePlacementPlan(plan, other));
          return <button className={`strategy-profile strategy-lane ${selected ? 'strategy-profile--selected' : ''} ${recommended ? 'strategy-profile--recommended' : ''}`} type="button" key={strategy.id} onClick={() => actions.setStrategy(strategy.id)} disabled={!plan && Object.keys(session.strategyPlans || {}).length > 0}>
            <span className="strategy-profile__top"><i>{strategy.id.slice(0, 1)}</i><span><strong>{strategy.id}</strong><small>{isCommerce && strategy.id === 'SPACE' ? '混装推荐' : strategy.label+'优先'}</small></span><span className="strategy-profile__badges">{converged && <StatusPill status="neutral">多目标收敛</StatusPill>}{outsidePolicy && <StatusPill status="warning">超出指导范围</StatusPill>}{recommended && <StatusPill status="ready">推荐</StatusPill>}{selected && <StatusPill status="info">当前</StatusPill>}</span></span>
            <p>{isCommerce && strategy.id !== 'SPACE' ? '当前混装任务未单独计算此策略' : strategy.objective}</p>
            <dl>
              <div><dt>装入</dt><dd>{planView && planView.loadedCount !== null && planView.inputCount !== null ? `${planView.loadedCount}/${planView.inputCount}` : '—'}</dd></div>
              <div><dt>利用率</dt><dd>{formatPlanMetric(planView?.utilization, { decimals: 2, suffix: '%' })}</dd></div>
              <div><dt>纵向重心</dt><dd>{formatPlanMetric(planView?.longitudinalCog, { decimals: 2, suffix: '%' })}</dd></div>
              <div><dt>几何稳定</dt><dd>{planView?.geometricStability || '—'}</dd></div>
              <div><dt>连续余量</dt><dd>{formatVolume(planView?.largestContiguousReserve)}</dd></div>
              <div><dt>货物固定</dt><dd>{securingLabel(planView?.securingStatus)}</dd></div>
              <div><dt>作业计划</dt><dd>{operationLabel(planView)}</dd></div>
              <div><dt>指导等级</dt><dd>{zhEnum(plan?.loadDistribution?.centreOfGravity?.guidanceStatus, '—')}</dd></div>
              <div><dt>未解释剩余空间</dt><dd>{formatVolume(plan?.voidJustification?.unexplainedVoidVolume)}</dd></div>
              <div><dt>港序卸载</dt><dd>{zhEnum(plan?.portAccessibility?.status, '—')}</dd></div>
              <div><dt>未来港倒箱</dt><dd>{plan ? Number(plan.portAccessibility?.rehandleCount || 0) : '—'}</dd></div>
              <div><dt>作业成本</dt><dd>{metrics?.operation ? Number(metrics.operation.totalCost).toFixed(2) : '—'}</dd></div>
              <div><dt>计算耗时</dt><dd>{plan ? `${Number(metrics?.solveMs ?? metrics?.elapsed_ms ?? 0).toFixed(0)} ms` : '—'}</dd></div>
            </dl>
          </button>;
        })}</div>}
        {Object.keys(session.strategyPlans || {}).length === 3 && <div className={`strategy-compare-row ${strategyConverged ? 'strategy-compare-row--converged' : ''}`}>{strategyConverged ? <div className="strategy-diff-strip"><span><ShieldCheck size={16} /><strong>三目标得到同一约束通过布局</strong></span><span>摆放哈希一致 · 不展示虚假差异</span></div> : <StrategyComparison plans={session.strategyPlans} selectedStrategy={session.selectedStrategy} />} {!strategyConverged && <button className="button button--primary button--small" type="button" onClick={() => { window.sessionStorage.setItem('portcube.strategy-diff', 'open'); navigate(ROUTES.twin); }}>在孪生中比较<ArrowRight size={15} /></button>}</div>}
      </section>

      <div className="container-decision-layout">
        <section className="container-visual">
          <div className="section-heading"><div><h2>{container.name}</h2><SourceNote>{getPlanSourceLabel(activePlan)}</SourceNote></div><StatusPill status={isBackendSolved(planSource) ? 'ready' : 'preview'}>{getPlanSourceLabel(activePlan)}</StatusPill></div>
          <dl className="key-metrics key-metrics--seven">
            <div><dt>输入</dt><dd>{formatPlanMetric(input)}{input !== null && <small> 件</small>}</dd></div>
            <div><dt>装入</dt><dd>{formatPlanMetric(loaded)}{loaded !== null && <small> 件</small>}</dd></div>
            <div><dt>未装</dt><dd className={unloaded ? 'text-danger' : ''}>{formatPlanMetric(unloaded)}{unloaded !== null && <small> 件</small>}</dd></div>
            <div><dt>空间利用</dt><dd>{formatPlanMetric(activePlanView.utilization, { decimals: 1 })}{activePlanView.utilization !== null && <small>%</small>}</dd></div>
            <div><dt>重量负载</dt><dd>{formatPlanMetric(weightRate, { decimals: 1 })}{weightRate !== null && <small>%</small>}</dd></div>
            <div><dt>横向重心</dt><dd>{formatPlanMetric(activePlanView.lateralCog, { decimals: 1 })}{activePlanView.lateralCog !== null && <small>%</small>}</dd></div>
            <div><dt>纵向重心</dt><dd>{formatPlanMetric(activePlanView.longitudinalCog, { decimals: 1 })}{activePlanView.longitudinalCog !== null && <small>%</small>}</dd></div>
          </dl>
          <div className="plan-trace-line"><span><strong>港序 / LIFO</strong>{isBackendSolved(planSource) && activePlan.constraintMeta?.lifoCompliant === true ? '通过' : activePlan.constraintMeta?.lifoCompliant === false ? '需复核' : '未验证'}</span><span><strong>方案来源</strong>{getPlanSourceLabel(activePlan)}</span>{isBackendSolved(planSource) && <details className="trace-details"><summary>追溯信息</summary><code>{activePlan.planId}</code></details>}</div>
        </section>

        <aside className="container-rationale">
          <span className="decision-label">决策解释</span>
          <h2>{reason.title}</h2>
          <p>{reason.summary}</p>
          <ul className="constraint-list">{reason.constraints.map((item) => <li className={item.ok ? '' : 'constraint-list__warning'} key={item.text}>{item.ok ? <ShieldCheck size={17} /> : <CircleAlert size={17} />}{item.text}</li>)}</ul>
          <div className={`tail-cargo ${unloaded ? 'tail-cargo--warning' : 'tail-cargo--success'}`} data-tail-unloaded-count={unloaded}>
            <strong>{unloaded === null ? '尚未取得当前输入的正式方案' : unloaded ? `${unloaded} 件未装入` : '全部装入 · 未装 0 件'}</strong>
            <p>{unloaded === null ? '生成正式方案后，再展示装入数量、重心与约束校核结果。' : unloaded ? '按 SKU 与原因聚合复核，必要时调整柜型、数量或堆叠约束后重算。' : isBackendSolved(planSource) ? '本票所有货物均有计划货位，下一步检查装卸路径和出运资料。' : '本地初筛显示全部可装；计算后确认货位与约束。'}</p>
            {unloaded !== null && unloaded > 0 && <button className="button button--secondary button--small" type="button" onClick={() => setUnloadedOpen(true)}>查看聚合明细</button>}
          </div>
          {isBackendSolved(planSource) && <button className="button button--secondary button--full" type="button" onClick={() => navigate(ROUTES.twin)}>进入 3D 作业复核<ArrowRight size={17} /></button>}
        </aside>
      </div>

      <details className="container-compare legacy-preview-disclosure">
        <summary>展开本地容量预览（非设备准入结论）</summary>
        <div className="section-heading"><div><h2>20GP / 40GP / 40HQ</h2><p>容量估算用于比较柜型；货位以当前装载方案为准。</p></div><StatusPill status="preview">容量估算</StatusPill></div>
        <div className="container-options" role="list">{alternatives.map(({ container: candidate, preview }) => {
          const candidateUnloaded = Math.max(preview.unloadedCargo.length, preview.totalCargoInput - preview.totalCargoCount);
          const volumeRate = containerVolume(candidate) ? (totals.volume / containerVolume(candidate)) * 100 : 0;
          const payloadRate = candidate.maxWeight ? (totals.weight / candidate.maxWeight) * 100 : 0;
          const headroom = Math.max(0, containerVolume(candidate) - totals.volume) / 1e9;
          const selected = candidate.typeId === container.typeId;
          return <button className={`container-option ${selected ? 'container-option--selected' : ''}`} type="button" role="listitem" key={candidate.typeId} onClick={() => selectContainer(candidate.typeId)} disabled={isLoading}>
            <span className="container-option__top"><span><small>PREVIEW</small><strong>{candidate.typeId}</strong></span>{recommendation.typeId === candidate.typeId && <StatusPill status="ready">建议柜型</StatusPill>}</span>
            <span className="container-option__description">{candidate.useCase}</span>
            <span className="container-silhouette" aria-label={`预计空间利用 ${preview.spaceUtilization.toFixed(1)}%`}><i style={{ width: `${Math.min(100, Math.max(0, preview.spaceUtilization))}%` }} /></span>
            <dl><div><dt>预计装入</dt><dd className="kpi-num">{preview.totalCargoCount}/{preview.totalCargoInput}</dd></div><div><dt>未装</dt><dd className={candidateUnloaded ? 'text-danger' : ''}>{candidateUnloaded}</dd></div><div><dt>预计空间利用</dt><dd>{preview.spaceUtilization.toFixed(1)}%</dd></div><div><dt>订单体积 / 柜容</dt><dd>{volumeRate.toFixed(1)}%</dd></div><div><dt>订单重量 / 载荷</dt><dd className={payloadRate > 100 ? 'text-danger' : ''}>{payloadRate.toFixed(1)}%</dd></div><div><dt>理论容积余量</dt><dd>{headroom.toFixed(1)} m³</dd></div></dl>
          </button>;
        })}</div>
        <p className="compare-note"><Weight size={16} />对比未使用固定评分；推荐按“全部装入 → 最小合适柜型 → 重量余量”排序。实际装入与坐标只采用最近一次后端结果。</p>
      </details>

      <Dialog
        open={unloadedOpen}
        onClose={() => setUnloadedOpen(false)}
        title="未装货物"
        description={`当前方案共 ${unloaded ?? '—'} 件未装；以下内容直接来自${isBackendSolved(planSource) ? '后端求解结果' : '本地预览'}。`}
        size="lg"
        footer={<button className="button button--primary" type="button" onClick={() => setUnloadedOpen(false)}>关闭</button>}
      >
        <UnloadedCargoList items={activePlan.unloadedCargo} total={unloaded ?? 0} />
      </Dialog>
    </div>
  );
}

function ContainerVisualSelector({ alternatives, selectedType, recommendation, thumbnails, totals, onSelect, disabled }) {
  return <section className="container-visual-selector" aria-label="柜型可视化选择">
    <header><div><span className="decision-label">柜型比较</span><h2>比较柜长、柜高与装入数量</h2><p>只有标记“正式求解”的柜型已完成计算，其余均为容量估算。</p></div><StatusPill status="preview">参考箱型</StatusPill></header>
    <div className="container-compare-stage"><div className="container-compare-stage__axis"><span>20 ft</span><i /><span>40 ft</span><em>同长 · 高度不同</em></div>{alternatives.map(({ container: candidate, preview }) => {
      const remaining = Math.max(preview.unloadedCargo.length, preview.totalCargoInput - preview.totalCargoCount);
      const selected = candidate.typeId === selectedType;
      const recommended = recommendation.typeId === candidate.typeId;
      return <button className={`container-stage-model container-stage-model--${candidate.typeId.toLowerCase()} ${selected ? 'is-selected' : ''} ${preview.sourceCode === 'BACKEND_SOLVED' ? 'is-solved' : 'is-estimate'}`} data-selected={selected} key={candidate.typeId} type="button" onClick={() => onSelect(candidate.typeId)} disabled={disabled}>
        <span className="container-stage-model__identity"><small>{candidate.isoTypeCode}</small><strong>{candidate.typeId}</strong>{recommended && <em>建议</em>}</span>
        <span className="container-stage-model__visual"><span className={`container-model-wire container-model-wire--${candidate.typeId.toLowerCase()}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>{thumbnails[candidate.typeId] && <img src={thumbnails[candidate.typeId]} alt={`${candidate.typeId} 运行时 GLB 三维集装箱`} />}</span>
        <span className={`container-stage-model__result ${remaining ? 'is-partial' : 'is-full'}`}><b>{preview.totalCargoCount} / {preview.totalCargoInput}</b><small>{preview.sourceCode === 'BACKEND_SOLVED' ? (remaining ? `${remaining} 件未装` : '正式求解 · 全部装入') : '容量估算 · 待求解'} · 空间 {preview.spaceUtilization.toFixed(1)}%</small></span>
        <span className="container-stage-model__dimension">{(candidate.innerLength / 1000).toFixed(2)}m × {(candidate.innerHeight / 1000).toFixed(2)}m 高</span>
      </button>;
    })}</div>
    <footer><span>当前选择 <b>{selectedType}</b></span><span>订单 {totals.pieces} 件 · {totals.weight==null?"重量未提供":`${Math.round(totals.weight).toLocaleString()} kg`}</span><span>参考箱型仅用于规划；实际设备数据优先</span></footer>
  </section>;
}

function ConvergedStrategyPlan({ activePlan, activePlanView, strategies, selectedStrategy, onSelect }) {
  return <div className="converged-strategy">
    <section className="converged-strategy__main"><span className="decision-label">三种目标 · 同一摆放哈希</span><h3>三目标得到同一约束通过布局</h3><p>空间、平衡与作业三种目标得到相同货位，统一展示布局与指标；仍可分别查看各目标的评价。</p><FormalLayoutPreview plan={activePlan} /><dl><div><dt>装入</dt><dd>{activePlanView.loadedCount ?? '—'} / {activePlanView.inputCount ?? '—'}</dd></div><div><dt>纵向重心</dt><dd>{formatPlanMetric(activePlanView.longitudinalCog, { decimals: 3, suffix: '%' })}</dd></div><div><dt>未解释剩余空间</dt><dd>{formatVolume(activePlan?.voidJustification?.unexplainedVoidVolume)}</dd></div><div><dt>未来港倒箱</dt><dd>{Number(activePlan?.portAccessibility?.rehandleCount || 0)}</dd></div></dl></section>
    <div className="converged-strategy__objectives">{strategies.map((strategy) => <button type="button" className={selectedStrategy === strategy.id ? 'active' : ''} key={strategy.id} onClick={() => onSelect(strategy.id)}><span>{strategy.label}目标</span><strong>{strategy.objective}</strong><small>{selectedStrategy === strategy.id ? '当前解释通道' : '查看该目标评价'}</small></button>)}</div>
  </div>;
}

function FormalLayoutPreview({ plan = {} }) {
  const container = plan.containerInfo || {};
  const length = Math.max(1, Number(container.innerLength || 1));
  const width = Math.max(1, Number(container.innerWidth || 1));
  const placements = plan.loadedCargo || [];
  return <div className="formal-layout-preview" data-placement-count={placements.length} aria-label="装载方案俯视布局">
    <div className="formal-layout-preview__heading"><span>装载方案俯视 · {container.typeId || '40HQ'}</span><code>{plan.placementHash || 'PLACEMENT HASH PENDING'}</code></div>
    <div className="formal-layout-preview__deck">{placements.map((item, index) => <i
      key={item.cargoId || index}
      title={`${item.cargoId} · ${item.x}/${item.z} mm`}
      style={{
        left: `${Math.max(0, Number(item.x || 0)) / length * 100}%`,
        top: `${Math.max(0, Number(item.z || 0)) / width * 100}%`,
        width: `${Math.max(0.45, Number(item.l || 0) / length * 100)}%`,
        height: `${Math.max(2, Number(item.w || 0) / width * 100)}%`,
        '--layout-color': `hsl(${198 - (Number(item.portSequence || 1) - 1) * 26} 46% 43%)`
      }}
    />)}</div>
    <footer><span>DOOR / HIGH X →</span><span>{placements.length} placements · 坐标未改写</span></footer>
  </div>;
}

function RouteEquipmentContext({ session, container, alternatives, recommendation, totals, selectContainer, inspectorMode, inspectEquipmentMode, actualDraft, setActualDraft, actualDraftMissing, applyActualContainer }) {
  const route = session.caseContext?.route || [];
  const warehouseSequence = session.caseContext?.unloadSequenceSemantics === 'DESTINATION_WAREHOUSE_GROUPS';
  return <section className="planning-workbench" aria-label="航线与设备规划工作区">
    <div className="route-context-strip">
      <span className="decision-label">本票 / 航线 / 码头</span>
      <strong className="mono">{session.caseContext?.caseId || session.order.orderNo}</strong>
      <span>{session.caseContext?.caseDate || '待补日期'}</span>
      <span>宁波 · {session.caseContext?.terminal || '待补码头'}</span>
      <span className="route-context-strip__ports">{warehouseSequence ? '宁波 → 安特卫普；仓内出库' : '卸货顺序'} {route.map((port) => <i key={port.portCode}>→ {port.portCode}</i>)}</span>
      <span>承运人 {session.caseContext?.carrier === 'UNKNOWN' ? '待确认' : session.caseContext?.carrier} · 航次 {session.caseContext?.voyage === 'UNKNOWN' ? '待确认' : session.caseContext?.voyage}</span>
      <StatusPill status="warning">需外部确认</StatusPill>
    </div>
    <div className="equipment-workbench-grid">
      <section className="equipment-matrix-pane">
        <div className="pane-heading"><div><span>设备决策矩阵</span><h2>标准干货设备筛选</h2></div><small>参考资料 · 实际放箱与 CSC 铭牌优先</small></div>
        <div className="equipment-matrix" role="table" aria-label="设备决策矩阵">
          <div className="equipment-matrix__head" role="row"><span role="columnheader">决策依据</span>{alternatives.map(({ container: candidate }) => <button role="columnheader" className={candidate.typeId === container.typeId ? 'active' : ''} onClick={() => selectContainer(candidate.typeId)} type="button" key={candidate.typeId}><strong>{candidate.typeId}</strong><small>{candidate.isoTypeCode}</small>{recommendation.typeId === candidate.typeId && <em>建议</em>}<span className={`equipment-silhouette equipment-silhouette--${candidate.typeId.toLowerCase()}`} /></button>)}</div>
          <EquipmentRow label="几何筛选" alternatives={alternatives} value={({ preview }) => preview.unloadedCargo.length === 0 ? '初筛可装' : `${preview.unloadedCargo.length} 件未装`} />
          <EquipmentRow label="门洞" alternatives={alternatives} value={({ container: candidate }) => session.cargo.every((cargo) => doorFit(cargo, candidate)) ? '可通过' : '不可通过'} />
          <EquipmentRow label="可用载荷" alternatives={alternatives} value={({ container: candidate }) => totals.weight==null?"未提供":totals.weight <= candidate.maxWeight ? `余量 ${Math.round(candidate.maxWeight - totals.weight)} kg` : '已超出'} />
          <EquipmentRow label="总重资料" alternatives={alternatives} value={() => '待补包装/系固质量'} />
          <EquipmentRow label="容积余量" alternatives={alternatives} value={({ container: candidate }) => `${Math.max(0, (containerVolume(candidate) - totals.volume) / 1e9).toFixed(1)} m³`} />
          <EquipmentRow label="外部受理" alternatives={alternatives} value={() => '需外部确认'} />
        </div>
      </section>
      <aside className="equipment-inspector">
        <div className="pane-heading"><div><span>设备检查器</span><h2>{inspectorMode === 'ACTUAL_CONTAINER' ? '实际箱草稿' : `${container.typeId} 参考箱型`}</h2></div><StatusPill status={inspectorMode === 'ACTUAL_CONTAINER' ? 'warning' : 'preview'}>{inspectorMode === 'ACTUAL_CONTAINER' ? '尚未应用' : '参考资料'}</StatusPill></div>
        <div className="mode-switch" role="group" aria-label="箱体数据模式"><button type="button" className={inspectorMode === 'REFERENCE_PROFILE' ? 'active' : ''} onClick={() => inspectEquipmentMode('REFERENCE_PROFILE')}>参考箱型</button><button type="button" className={inspectorMode === 'ACTUAL_CONTAINER' ? 'active' : ''} onClick={() => inspectEquipmentMode('ACTUAL_CONTAINER')}>检查实际箱</button></div>
        {inspectorMode === 'REFERENCE_PROFILE' ? <>
          <dl className="equipment-inspector__facts">
            <div><dt>ISO 类型</dt><dd>{container.isoTypeCode}</dd></div><div><dt>内部长 / 宽 / 高</dt><dd>{container.innerLength} / {container.innerWidth} / {container.innerHeight} mm</dd></div>
            <div><dt>门洞宽 / 高</dt><dd>{container.doorWidth} / {container.doorHeight} mm</dd></div><div><dt>皮重</dt><dd>{container.tareWeight} kg</dd></div>
            <div><dt>最大总重</dt><dd>{container.maxGross} kg</dd></div><div><dt>可用载荷</dt><dd>{container.maxWeight} kg</dd></div>
            <div><dt>CSC</dt><dd>参考箱型不提供实箱 CSC 结论</dd></div><div><dt>资料来源</dt><dd>{container.source?.authority} · {container.source?.verifiedAt}</dd></div>
          </dl>
          <a className="source-link" href={container.source?.url} target="_blank" rel="noreferrer">打开官方设备参考资料 ↗</a>
          <p className="inspector-limitation">参考数据只用于规划。实际设备尺寸、门洞、皮重、最大总重与 CSC 资料必须由放箱实箱覆写。</p>
        </> : <>
          <div className="actual-container-form">
            <ActualField label="箱号" field="containerNumber" value={actualDraft.containerNumber} onChange={(patch) => setActualDraft((current) => ({ ...current, ...patch }))} />
            {['innerLength', 'innerWidth', 'innerHeight', 'doorWidth', 'doorHeight', 'tare', 'maxGross'].map((field) => <ActualField key={field} label={actualLabel(field)} field={field} value={actualDraft[field]} onChange={(patch) => setActualDraft((current) => ({ ...current, ...patch }))} numeric />)}
            <ActualField label="CSC 铭牌引用" field="cscPlateReference" value={actualDraft.cscPlateReference} onChange={(patch) => setActualDraft((current) => ({ ...current, ...patch }))} />
            <ActualField label="下次检验日期" field="nextExaminationDate" value={actualDraft.nextExaminationDate} onChange={(patch) => setActualDraft((current) => ({ ...current, ...patch }))} type="date" />
          </div>
          {!!actualDraftMissing.length && <ul className="actual-missing" role="alert" aria-label="实箱待补字段">{actualDraftMissing.map(field=><li key={field}>{actualLabel(field)}</li>)}</ul>}
          <p className={actualDraftMissing.length ? 'inspector-limitation inspector-limitation--warn' : 'inspector-limitation'}>{actualDraftMissing.length ? `数据待补 · 仍缺 ${actualDraftMissing.map(actualLabel).join('、')}` : '实箱核心尺寸已录入；应用后将清除参考柜方案并要求重新计算。'}</p>
          <button className="button button--primary button--full button--small" type="button" onClick={applyActualContainer} disabled={actualDraftMissing.length > 0}>应用实际箱数据</button>
          <p className="inspector-limitation">当前本票仍保持{session.containerMode === 'ACTUAL_CONTAINER' ? '实际箱模式' : '参考箱型模式'}；草稿不会伪装成 CSC 或外部接收结论。</p>
        </>}
      </aside>
    </div>
  </section>;
}

function EquipmentRow({ label, alternatives, value }) {
  return <div className="equipment-matrix__row" role="row"><strong role="rowheader">{label}</strong>{alternatives.map((entry) => { const text = value(entry); const tone = /超出|不可通过|未装/.test(text) ? 'bad' : /待补|外部确认/.test(text) ? 'pending' : 'good'; return <span role="cell" className={`matrix-value matrix-value--${tone}`} key={entry.container.typeId}>{text}</span>; })}</div>;
}

function ActualField({ label, field, value = '', onChange, numeric = false, type = 'text' }) {
  return <label><span>{label}</span><input type={type} inputMode={numeric ? 'numeric' : undefined} value={value ?? ''} onChange={(event) => onChange({ [field]: numeric ? event.target.value.replace(/[^0-9.]/g, '') : event.target.value })} placeholder="数据待补" /></label>;
}
function actualLabel(field) { return ({ containerNumber:'箱号', innerLength: '内部长度 mm', innerWidth: '内部宽度 mm', innerHeight: '内部高度 mm', doorWidth: '门洞宽度 mm', doorHeight: '门洞高度 mm', tare: '皮重 kg', maxGross: '最大总重 kg' })[field] || field; }
function doorFit(cargo, candidate) { const l = Number(cargo.length); const w = Number(cargo.width); const h = Number(cargo.height); const orientations = [[w, h], ...(cargo.canRotate === false ? [] : [[l, h]]), ...(cargo.canLayFlat ? [[h, w], [h, l], [w, l], [l, w]] : [])]; return orientations.some(([doorW, doorH]) => doorW <= candidate.doorWidth && doorH <= candidate.doorHeight); }

function StrategyComparison({ plans, selectedStrategy }) {
  const base = plans[selectedStrategy];
  const alternativeId = selectedStrategy === 'BALANCE' ? 'OPERATION' : 'BALANCE';
  const alternative = plans[alternativeId];
  if (!base || !alternative) return null;
  const moved = movedCargoCount(base.loadedCargo, alternative.loadedCargo);
  const baseLayout = layoutOf(base);
  const alternativeLayout = layoutOf(alternative);
  const baseSecuring = securingOf(base);
  const alternativeSecuring = securingOf(alternative);
  const baseOperation = operationOf(base);
  const alternativeOperation = operationOf(alternative);
  return <div className="strategy-diff-strip">
    <span><GitCompareArrows size={16} /><strong>方案比较</strong>{strategyLabel(selectedStrategy)} → {strategyLabel(alternativeId)}</span>
    <span><small>平衡 · 纵向重心</small>{Number(base.cogOffset?.longitudinal || 0).toFixed(2)}% → {Number(alternative.cogOffset?.longitudinal || 0).toFixed(2)}%</span>
    <span><small>紧密 · 内部空洞</small>{formatVolume(baseLayout.internalVoidVolume)} → {formatVolume(alternativeLayout.internalVoidVolume)}</span>
    <span><small>预留 · 最大连续区</small>{formatVolume(baseLayout.largestContiguousReserve)} → {formatVolume(alternativeLayout.largestContiguousReserve)}</span>
    <span><small>系固 · 状态</small>{securingLabel(baseSecuring.status)} → {securingLabel(alternativeSecuring.status)}</span>
    <span><small>作业 · 阻断</small>{Number(baseOperation.blockedCount || 0)} → {Number(alternativeOperation.blockedCount || 0)}</span>
    <span><small>摆放变化 · 货物</small>{moved} 件</span>
  </div>;
}

function samePlacementPlan(left, right) {
  if (!left || !right) return false;
  if (left.placementHash && right.placementHash) return left.placementHash === right.placementHash;
  if ((left.loadedCargo || []).length !== (right.loadedCargo || []).length) return false;
  const rightById = new Map((right.loadedCargo || []).map((item) => [item.cargoId, item]));
  return (left.loadedCargo || []).every((item) => {
    const other = rightById.get(item.cargoId);
    return other && ['x', 'y', 'z', 'l', 'w', 'h'].every((key) => Math.abs(Number(item[key]) - Number(other[key])) < 0.001);
  });
}

function layoutOf(plan = {}) { return plan.layoutQuality || plan.ext_layoutQuality || plan.metrics?.layoutQuality || {}; }
function securingOf(plan = {}) { return plan.securing || plan.ext_securing || plan.metrics?.securing || {}; }
function operationOf(plan = {}) { return plan.operationFeasibility || plan.ext_operationFeasibility || plan.metrics?.operationFeasibility || {}; }
function formatVolume(value) { const numeric = Number(value); return Number.isFinite(numeric) ? `${(numeric / 1e9).toFixed(2)} m³` : '—'; }
function securingLabel(value) { return ({ SECURING_NOT_REQUIRED: '无需附加', SECURING_REQUIRED: '需固定', SECURING_UNRESOLVED: '工程复核' })[value] || value || '—'; }
function strategyLabel(value) { return ({ SPACE: '空间', BALANCE: '平衡', OPERATION: '作业' })[value] || value; }
function operationLabel(view) { return view?.operationFeasible === null || view?.operationFeasible === undefined ? '—' : view.operationFeasible ? 'FEASIBLE · 0 BLOCKED' : `BLOCKED · ${Number(view.operationBlockedCount || 0)}`; }

function movedCargoCount(left = [], right = [], epsilon = 0.001) {
  const rightById = new Map(right.map((item) => [item.cargoId, item]));
  return left.reduce((count, item) => {
    const other = rightById.get(item.cargoId);
    if (!other) return count + 1;
    const moved = Math.abs(Number(item.x) - Number(other.x)) > epsilon
      || Math.abs(Number(item.y) - Number(other.y)) > epsilon
      || Math.abs(Number(item.z) - Number(other.z)) > epsilon
      || item.orientation !== other.orientation;
    return count + (moved ? 1 : 0);
  }, 0);
}

function UnloadedCargoList({ items = [], total = 0 }) {
  if (!items.length) {
    return <div className="unloaded-empty"><strong>{total ? `${total} 件未装` : '没有未装货物'}</strong><p>{total ? '当前方案只返回了未装数量，没有返回逐件明细。' : '当前方案的所有货物均已装入。'}</p></div>;
  }
  const groups = aggregateUnloaded(items);
  return <div className="unloaded-list">
    <div className="unloaded-list__head"><span>SKU 聚合</span><span>数量</span><span>主要原因</span></div>
    {groups.map((group) => <details className="unloaded-list__group" key={group.key}>
      <summary className="unloaded-list__row"><span><strong>{group.sku}</strong><small>{group.name}</small></span><span>{group.items.length} 件</span><span>{unloadedReason(group.reason)}</span></summary>
      <div className="unloaded-list__details">{group.items.slice(0, 12).map((item, index) => <span key={`${item.cargoId || group.key}-${index}`}>{item.cargoId || `${group.sku}-${index + 1}`} · 港序 {item.portSequence || '—'}</span>)}{group.items.length > 12 && <span>另有 {group.items.length - 12} 件，完整数据见 JSON 导出。</span>}</div>
    </details>)}
  </div>;
}

function aggregateUnloaded(items) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.sku || item.name || 'unknown'}::${item.reason || 'unknown'}`;
    if (!groups.has(key)) groups.set(key, { key, sku: item.sku || '未标识 SKU', name: item.name || '未命名货物', reason: item.reason, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
}

function unloadedReason(reason) {
  const labels = {
    OVERSIZE_OR_UNSUPPORTED_ORIENTATION: '尺寸或朝向不适配',
    NO_CROSS_SECTION_CAPACITY: '横截面空间不足',
    INSUFFICIENT_LENGTH: '柜内纵向空间不足'
  };
  return labels[reason] || reason || '方案未提供原因';
}

function recommendContainer(alternatives) {
  const ranked = [...alternatives].sort((a, b) => {
    const aUnloaded = Math.max(a.preview.unloadedCargo.length, a.preview.totalCargoInput - a.preview.totalCargoCount);
    const bUnloaded = Math.max(b.preview.unloadedCargo.length, b.preview.totalCargoInput - b.preview.totalCargoCount);
    if (aUnloaded !== bUnloaded) return aUnloaded - bUnloaded;
    return containerVolume(a.container) - containerVolume(b.container);
  });
  return ranked[0]?.container || CONTAINER_CATALOG['40HQ'];
}

function explainSelection(container, plan, alternatives) {
  const unloaded = Math.max(plan.unloadedCargo?.length || 0, Number(plan.totalCargoInput || 0) - Number(plan.totalCargoCount || 0));
  const weightRate = container.maxWeight ? (Number(plan.totalWeight || 0) / container.maxWeight) * 100 : 0;
  const selectedAlternative = alternatives.find((item) => item.container.typeId === container.typeId);
  const placementCount = Array.isArray(plan.loadedCargo) ? plan.loadedCargo.length : Number(plan.totalCargoCount || 0);
  const constraints = [
    { ok: placementCount === Number(plan.totalCargoCount || 0), text: `${placementCount} 件货物已分配货位` },
    { ok: weightRate <= 100, text: `货重负载率 ${weightRate.toFixed(1)}%，${weightRate <= 100 ? '未超过柜型载荷上限' : '超过柜型载荷上限'}` },
    { ok: Number.isFinite(plan.cogOffset?.lateral)&&Number.isFinite(plan.cogOffset?.longitudinal)&&plan.cogOffset.lateral<=5&&plan.cogOffset.longitudinal<=10, text: Number.isFinite(plan.cogOffset?.lateral)&&Number.isFinite(plan.cogOffset?.longitudinal)?`横向 / 纵向重心偏移 ${plan.cogOffset.lateral.toFixed(2)}% / ${plan.cogOffset.longitudinal.toFixed(2)}%`:'载荷分布尚待核对' },
    { ok: plan.validator?.checks?.stability === true, text: `堆叠稳定性：${plan.stability?.status || plan.validator?.stability?.status || '待核对'}` },
    { ok: plan.constraintMeta?.lifoCompliant === true, text: `卸货顺序：${plan.constraintMeta?.lifoCompliant === true ? '无跨组阻挡' : '待检查'}` }
  ];
  return {
    title: `当前方案 ${container.typeId}`,
    summary: isBackendSolved(plan)
      ? `装入 ${plan.totalCargoCount || 0} 件，${unloaded ? `剩余 ${unloaded} 件待安排。` : '本票货物全部装入。'}`
      : `容量估算 ${selectedAlternative?.preview.totalCargoCount || 0}/${selectedAlternative?.preview.totalCargoInput || 0} 件；尚未检查全部业务约束。生成正式方案后确认是否装入。`,
    constraints: isBackendSolved(plan) ? constraints : [{ ok: false, text: '容量估算未提供正式货位和约束通过证据' }]
  };
}
