import { askPortcube } from '../../components/feedback/ContextAssistant.jsx';
import { useMemo, useRef, useState } from 'react';
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
import { AUTHORITATIVE_ALGORITHM_ID, generatePackingPlan } from '../../services/packingApi.js';
import { PAGE_COPY } from '../../domain/presentation/productCopy.js';
import { getPlanSourceLabel, isBackendSolved } from '../../domain/provenance/planSource.js';
import { buildPackingCasePayload, savePackingCase } from '../../services/caseApi.js';
import { buildActivePlanViewModel, formatPlanMetric } from '../../domain/plan/activePlanViewModel.js';
import { recommendStrategy } from '../../domain/plan/strategyRecommendation.js';
import { zhEnum } from '../../domain/presentation/localization.js';
import { useContainerThumbnails } from '../../three/LandingExperience.jsx';
import { PlanVersions } from '../../components/common/PlanVersions.jsx';

const STRATEGIES = Object.freeze([
  { id: 'SPACE', label: '空间', objective: '紧凑布局 · 连续余量', metric: 'compactness' },
  { id: 'BALANCE', label: '平衡', objective: '降低横向 / 纵向重心偏移', metric: 'balance' },
  { id: 'OPERATION', label: '作业', objective: '减少切换、分组与插入距离', metric: 'operation' }
]);

export default function ContainerPage({ navigate }) {
  const { session, dispatch, activePlan, activePlanView, planSource, container, fingerprint, actions } = useSession();
  const { notify } = useFeedback();
  const requestInFlight = useRef(false);
  const [unloadedOpen, setUnloadedOpen] = useState(false);
  const [completedStrategies, setCompletedStrategies] = useState(0);
  const [equipmentInspectorMode, setEquipmentInspectorMode] = useState(session.containerMode);
  const [actualContainerDraft, setActualContainerDraft] = useState(() => ({ ...(session.actualContainer || {}) }));
  const alternatives = useMemo(() => DECISION_CONTAINER_TYPES.map((typeId) => {
    const candidate = getContainer(typeId);
    const preview=generateLocalPreview(session.cargo, candidate);
    if(isBackendSolved(planSource) && typeId===container.typeId)return {container:candidate,preview:{...preview,
      totalCargoCount:activePlanView.loadedCount,totalCargoInput:activePlanView.inputCount,
      loadedCargo:activePlan.loadedCargo,unloadedCargo:activePlan.unloadedCargo || [],
      spaceUtilization:activePlan.spaceUtilization ?? activePlan.metrics?.volumeUtilization ?? preview.spaceUtilization,
      sourceLabel:'当前正式方案',sourceCode:'BACKEND_SOLVED'}};
    return { container: candidate, preview };
  }), [session.cargo,activePlan,activePlanView,planSource,container.typeId]);
  const recommendation = useMemo(() => recommendContainer(alternatives), [alternatives]);
  const totals = useMemo(() => cargoTotals(session.cargo), [session.cargo]);
  const recommendedStrategy = useMemo(() => recommendStrategy(session.strategyPlans), [session.strategyPlans]);
  const isLoading = session.planStatus === 'loading';
  const invalidCargoCount = useMemo(() => session.cargo.filter((cargo) => !validateCargo(cargo).valid).length, [session.cargo]);
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
    notify(`已选择 ${typeId}，请生成后端方案`, { variant: 'info' });
  };

  const generate = async () => {
    if (requestInFlight.current || isLoading || !session.cargo.length || invalidCargoCount) return;
    if (actualMissing.length) {
      notify(`实箱模式仍缺 ${actualMissing.length} 项必要数据，已阻止求解`, { variant: 'warning' });
      return;
    }
    requestInFlight.current = true;
    setCompletedStrategies(0);
    dispatch({ type: SESSION_ACTIONS.PLAN_REQUEST });
    try {
      const plans = Object.fromEntries(await Promise.all(STRATEGIES.map(async ({ id }) => {
        const result = await generatePackingPlan({
        containerType: session.selectedContainerType,
        cargoList: session.cargo,
        solver: AUTHORITATIVE_ALGORITHM_ID,
        strategy: id.toLowerCase(),
        includeAiExplanation: false,
        caseContext: session.caseContext,
        containerMode: session.containerMode,
        actualContainer: session.actualContainer,
        massEvidence: session.massEvidence,
        vgm: session.vgm,
        transport: session.transport,
        securingInputs: session.securingInputs
        });
        setCompletedStrategies(count => count + 1);
        return [id, result];
      })));
      const selectedStrategy = recommendStrategy(plans) || session.selectedStrategy || 'SPACE';
      const plan = plans[selectedStrategy] || plans.SPACE;
      dispatch({ type: SESSION_ACTIONS.STRATEGY_PLANS_SUCCESS, plans, selectedStrategy, fingerprint });
      try {
        const packingCase = await savePackingCase(buildPackingCasePayload({ session, plan }));
        dispatch({ type: SESSION_ACTIONS.CASE_SYNC_SUCCESS, packingCase });
        notify(`SPACE / BALANCE / OPERATION 三套后端方案已生成，并保存当前方案到 Case ${packingCase.caseId}`, { variant: 'success' });
      } catch (caseError) {
        dispatch({ type: SESSION_ACTIONS.CASE_SYNC_FAILURE, error: caseError.message });
        notify('后端求解方案已生成，但跨端 Case 暂未保存；可重新计算后重试同步', { variant: 'warning', duration: 6000 });
      }
    } catch (error) {
      dispatch({ type: SESSION_ACTIONS.PLAN_FAILURE, error: error.message });
      notify(error.message || '方案生成失败，可重试', { variant: 'error', duration: 5000 });
    } finally {
      requestInFlight.current = false;
    }
  };

  const loaded = activePlanView.loadedCount;
  const input = activePlanView.inputCount;
  const unloaded = activePlanView.unloadedCount;
  const weightRate = activePlanView.weightRate;
  const reason = explainSelection(container, activePlan, alternatives, recommendation);

  return (
    <div className="page container-page" data-loaded-count={loaded ?? ''} data-unloaded-count={unloaded ?? ''} data-input-count={input ?? ''}>
      <header className="page-header">
        <div><span className="page-kicker">航线 · 设备 · 方案</span><h1>{PAGE_COPY.container.title}</h1><p>先比较柜型能装多少，再核对实箱资料与限制条件，生成可复核方案。</p></div>
        <div className="page-header__actions"><div className="algorithm-badge" data-authoritative-algorithm={AUTHORITATIVE_ALGORITHM_ID}><Cpu size={18} /><span>装载计算</span><strong>空间 · 平衡 · 作业</strong></div><button className="button button--primary" type="button" onClick={generate} disabled={isLoading || !session.cargo.length || invalidCargoCount || actualMissing.length > 0}>{isLoading ? <InlineLoading label="正在比较方案" /> : <><RefreshCw size={18} />{isBackendSolved(planSource) ? '重新生成决策组合' : '生成推荐方案'}</>}</button></div>
      </header>

      <PlanVersions plan={isBackendSolved(planSource) ? activePlan : null} history={session.planHistory} />

      {isLoading && <div className="solver-progress" role="status" aria-live="polite"><InlineLoading label={`正在比较装载方案 · 已返回 ${completedStrategies}/${STRATEGIES.length}`} /><p>正在检查装入数量、支撑、港序和空间布局。{session.backendPlan ? '下方仍显示上一版方案；新结果返回后会更新。' : '下方容量数据是本地预览；正式结果返回后会更新。'}</p></div>}

      {session.planStatus === 'error' && <div className="page-error"><CircleAlert size={20} /><div><strong>方案生成失败</strong><p>{session.planError}</p></div><button className="button button--secondary button--small" type="button" onClick={generate}>重试</button></div>}
      {invalidCargoCount > 0 && <div className="page-error"><CircleAlert size={20} /><div><strong>{invalidCargoCount} 条货物数据无效，已阻止求解</strong><p>返回货物数据集修正行内标注的尺寸、重量或数量后再生成方案。</p></div><button className="button button--secondary button--small" type="button" onClick={() => navigate(ROUTES.cargo)}>修正货物</button></div>}

      <section className="decision-recommendation decision-recommendation--copilot" aria-label="柜型决策卡">
        <div><span className="decision-label">柜型决策 · 系统事实 / AI 解释</span><h2>建议采用 {recommendation.typeId}</h2><p>在当前对比中，优先选择未装件数最少、柜内容积较小的方案。运价尚未录入，未作费用判断。</p>
          <dl className="decision-inputs"><div><dt>本票货物</dt><dd>{totals.pieces} 件 · {totals.weight.toLocaleString()} kg</dd></div><div><dt>设备边界</dt><dd>{session.containerMode==='ACTUAL_CONTAINER'?'按已录实箱资料复核':'参考箱型；提箱后需核对净尺寸与门洞'}</dd></div></dl>
        </div>
        <div className="decision-recommendation__facts">{alternatives.map(({container:c,preview})=><span key={c.typeId}><strong>{c.typeId}{recommendation.typeId===c.typeId?' · 建议':' · 备选'}</strong><b>{preview.totalCargoCount}/{preview.totalCargoInput} 件</b><small>{preview.sourceCode==='BACKEND_SOLVED'?'正式计划':'本地初筛'} · 利用率 {preview.spaceUtilization.toFixed(1)}%</small><small>未装 {Math.max(preview.unloadedCargo.length, preview.totalCargoInput-preview.totalCargoCount)} 件</small></span>)}</div>
        <div className="decision-recommendation__next"><strong>待确认</strong><p>{activePlan.shipmentReadiness?.actionableEvidence?.slice(0,2).map(e=>e.title).join('、') || 'VGM、实箱资料与实际作业条件'}</p><button className="button button--primary button--small" type="button" onClick={()=>isBackendSolved(planSource)?navigate(ROUTES.twin):generate()} disabled={isLoading}>{isBackendSolved(planSource)?'查看三维与作业':'生成正式方案'}<ArrowRight size={15}/></button><button className="button button--secondary button--small" type="button" onClick={()=>askPortcube('为什么建议当前柜型？请比较其他柜型的装入数量、空间、重量和门洞限制，并说明待确认资料。')}>请 Copilot 解释决策</button><small>更换柜型后需重新求解；备选容量为初筛结果。</small></div>
      </section>

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
        <div className="strategy-lab__heading"><div><span className="decision-label">策略组合</span><h2>比较空间、平衡与作业表现</h2><p>每种策略都先检查重量、支撑与港序，再比较空间余隙、载荷分布和搬运成本。</p></div><div className="strategy-lab__controls"><StatusPill status={Object.keys(session.strategyPlans || {}).length === 3 ? 'ready' : 'preview'}>{Object.keys(session.strategyPlans || {}).length === 3 ? '三套方案已求解' : '等待求解'}</StatusPill></div></div>
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
            <span className="strategy-profile__top"><i>{strategy.id.slice(0, 1)}</i><span><strong>{strategy.id}</strong><small>{strategy.label}优先</small></span><span className="strategy-profile__badges">{converged && <StatusPill status="neutral">多目标收敛</StatusPill>}{outsidePolicy && <StatusPill status="warning">超出指导范围</StatusPill>}{recommended && <StatusPill status="ready">推荐</StatusPill>}{selected && <StatusPill status="info">当前</StatusPill>}</span></span>
            <p>{strategy.objective}</p>
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
              <div><dt>求解</dt><dd>{plan ? `${Number(metrics?.solveMs ?? metrics?.elapsed_ms ?? 0).toFixed(0)} ms` : '—'}</dd></div>
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
          <div className="plan-trace-line"><span><strong>港序 / LIFO</strong>{activePlan.constraintMeta?.lifoCompliant === false ? '需复核' : '通过'}</span><span><strong>方案来源</strong>{getPlanSourceLabel(activePlan)}</span>{isBackendSolved(planSource) && <details className="trace-details"><summary>追溯信息</summary><code>{activePlan.planId}</code></details>}</div>
        </section>

        <aside className="container-rationale">
          <span className="decision-label">决策解释</span>
          <h2>{reason.title}</h2>
          <p>{reason.summary}</p>
          <ul className="constraint-list">{reason.constraints.map((item) => <li className={item.ok ? '' : 'constraint-list__warning'} key={item.text}>{item.ok ? <ShieldCheck size={17} /> : <CircleAlert size={17} />}{item.text}</li>)}</ul>
          <div className={`tail-cargo ${unloaded ? 'tail-cargo--warning' : 'tail-cargo--success'}`} data-tail-unloaded-count={unloaded}>
            <strong>{unloaded === null ? '方案指标读取中' : unloaded ? `${unloaded} 件未装入` : '全部装入 · 未装 0 件'}</strong>
            <p>{unloaded === null ? '正式方案尚未 ready，指标保持空值以避免误报。' : unloaded ? '按 SKU 与原因聚合复核，必要时调整柜型、数量或堆叠约束后重算。' : isBackendSolved(planSource) ? '本票所有货物均有计划货位，下一步检查装卸路径和出运资料。' : '本地初筛显示全部可装；生成正式方案后确认货位与约束。'}</p>
            {unloaded !== null && unloaded > 0 && <button className="button button--secondary button--small" type="button" onClick={() => setUnloadedOpen(true)}>查看聚合明细</button>}
          </div>
          {isBackendSolved(planSource) && <button className="button button--secondary button--full" type="button" onClick={() => navigate(ROUTES.twin)}>进入 3D 作业复核<ArrowRight size={17} /></button>}
        </aside>
      </div>

      <details className="container-compare legacy-preview-disclosure">
        <summary>展开本地容量预览（非设备准入结论）</summary>
        <div className="section-heading"><div><h2>20GP / 40GP / 40HQ</h2><p>同一货物数据集的确定性本地预览；这里只用于策略比较，正式坐标以上方 SOLVED 方案为准。</p></div><StatusPill status="preview">LOCAL_PREVIEW</StatusPill></div>
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
            <dl><div><dt>预计装入</dt><dd>{preview.totalCargoCount}/{preview.totalCargoInput}</dd></div><div><dt>未装</dt><dd className={candidateUnloaded ? 'text-danger' : ''}>{candidateUnloaded}</dd></div><div><dt>预计空间利用</dt><dd>{preview.spaceUtilization.toFixed(1)}%</dd></div><div><dt>订单体积 / 柜容</dt><dd>{volumeRate.toFixed(1)}%</dd></div><div><dt>订单重量 / 载荷</dt><dd className={payloadRate > 100 ? 'text-danger' : ''}>{payloadRate.toFixed(1)}%</dd></div><div><dt>理论容积余量</dt><dd>{headroom.toFixed(1)} m³</dd></div></dl>
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
    <header><div><span className="decision-label">柜型初筛 / 同一比例舞台</span><h2>长度、柜高与本票装入结果，一眼比较</h2><p>按同一比例比较柜长与柜高，结合本票货量初筛。当前已求解柜型采用正式结果，备选采用本地初筛；实际门洞、铭牌与 CSC 仍需复核。</p></div><StatusPill status="preview">参考模型边界</StatusPill></header>
    <div className="container-compare-stage"><div className="container-compare-stage__axis"><span>20 ft</span><i /><span>40 ft</span><em>同长 · 高度不同</em></div>{alternatives.map(({ container: candidate, preview }) => {
      const remaining = Math.max(preview.unloadedCargo.length, preview.totalCargoInput - preview.totalCargoCount);
      const selected = candidate.typeId === selectedType;
      const recommended = recommendation.typeId === candidate.typeId;
      return <button className={`container-stage-model container-stage-model--${candidate.typeId.toLowerCase()} ${selected ? 'is-selected' : ''}`} data-selected={selected} key={candidate.typeId} type="button" onClick={() => onSelect(candidate.typeId)} disabled={disabled}>
        <span className="container-stage-model__identity"><small>{candidate.isoTypeCode}</small><strong>{candidate.typeId}</strong>{recommended && <em>建议</em>}</span>
        <span className="container-stage-model__visual"><span className={`container-model-wire container-model-wire--${candidate.typeId.toLowerCase()}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>{thumbnails[candidate.typeId] && <img src={thumbnails[candidate.typeId]} alt={`${candidate.typeId} 运行时 GLB 三维集装箱`} />}</span>
        <span className={`container-stage-model__result ${remaining ? 'is-partial' : 'is-full'}`}><b>{preview.totalCargoCount} / {preview.totalCargoInput}</b><small>{remaining ? `${remaining} 件未装` : '全部装入'} · 空间 {preview.spaceUtilization.toFixed(1)}%</small></span>
        <span className="container-stage-model__dimension">{(candidate.innerLength / 1000).toFixed(2)}m × {(candidate.innerHeight / 1000).toFixed(2)}m 高</span>
      </button>;
    })}</div>
    <footer><span>当前选择 <b>{selectedType}</b></span><span>订单 {totals.pieces} 件 · {Math.round(totals.weight).toLocaleString()} kg</span><span>参考箱型仅用于规划；实际设备数据优先</span></footer>
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
  return <div className="formal-layout-preview" data-placement-count={placements.length} aria-label="正式方案俯视布局">
    <div className="formal-layout-preview__heading"><span>正式方案俯视 · {container.typeId || '40HQ'}</span><code>{plan.placementHash || 'PLACEMENT HASH PENDING'}</code></div>
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
  return <section className="planning-workbench" aria-label="航线与设备规划工作区">
    <div className="route-context-strip">
      <span className="decision-label">本票 / 航线 / 码头</span>
      <strong className="mono">{session.caseContext?.caseId || session.order.orderNo}</strong>
      <span>{session.caseContext?.caseDate || '待补日期'}</span>
      <span>宁波 · {session.caseContext?.terminal || '待补码头'}</span>
      <span className="route-context-strip__ports">CN NGB {route.map((port) => <i key={port.portCode}>→ {port.portCode}</i>)}</span>
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
          <EquipmentRow label="可用载荷" alternatives={alternatives} value={({ container: candidate }) => totals.weight <= candidate.maxWeight ? `余量 ${Math.round(candidate.maxWeight - totals.weight)} kg` : '已超出'} />
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
          <p className={actualDraftMissing.length ? 'inspector-limitation inspector-limitation--warn' : 'inspector-limitation'}>{actualDraftMissing.length ? `数据待补 · 仍缺 ${actualDraftMissing.join('、')}` : '实箱核心尺寸已录入；应用后将清除参考柜方案并要求重新求解。'}</p>
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
function actualLabel(field) { return ({ innerLength: '内部长度 mm', innerWidth: '内部宽度 mm', innerHeight: '内部高度 mm', doorWidth: '门洞宽度 mm', doorHeight: '门洞高度 mm', tare: '皮重 kg', maxGross: '最大总重 kg' })[field] || field; }
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

function explainSelection(container, plan, alternatives, recommendation) {
  const unloaded = Math.max(plan.unloadedCargo?.length || 0, Number(plan.totalCargoInput || 0) - Number(plan.totalCargoCount || 0));
  const weightRate = container.maxWeight ? (Number(plan.totalWeight || 0) / container.maxWeight) * 100 : 0;
  const selectedAlternative = alternatives.find((item) => item.container.typeId === container.typeId);
  const recommended = recommendation.typeId === container.typeId;
  const placementCount = Array.isArray(plan.loadedCargo) ? plan.loadedCargo.length : Number(plan.totalCargoCount || 0);
  const constraints = [
    { ok: placementCount === Number(plan.totalCargoCount || 0), text: `方案返回 ${placementCount} 个 placements；装入计数 ${plan.totalCargoCount || 0} 件` },
    { ok: weightRate <= 100, text: `货重负载率 ${weightRate.toFixed(1)}%，${weightRate <= 100 ? '未超过柜型载荷上限' : '超过柜型载荷上限'}` },
    { ok: Number(plan.cogOffset?.lateral || 0) <= 5 && Number(plan.cogOffset?.longitudinal || 0) <= 10, text: `横向 / 纵向重心偏移 ${Number(plan.cogOffset?.lateral || 0).toFixed(2)}% / ${Number(plan.cogOffset?.longitudinal || 0).toFixed(2)}%` },
    { ok: plan.validator?.checks?.stability !== false, text: `无绑扎假设稳定性 ${plan.stability?.status || plan.validator?.stability?.status || '未提供'}；阈值标记为 PROJECT_POLICY` },
    { ok: plan.constraintMeta?.lifoCompliant !== false, text: `港序 / LIFO ${plan.constraintMeta?.lifoCompliant === false ? '未通过' : '通过'}；算法 ${plan.ext_algorithmId || plan.metrics?.algorithm_id || '待生成'}` }
  ];
  return {
    title: recommended ? `${isBackendSolved(plan) ? '后端求解方案' : '本地对比推荐'} ${container.typeId}` : `当前方案 ${container.typeId}`,
    summary: isBackendSolved(plan)
      ? `柜型对比装入 ${selectedAlternative?.preview.totalCargoCount || 0}/${selectedAlternative?.preview.totalCargoInput || 0} 件；后端求解方案装入 ${plan.totalCargoCount || 0} 件，${unloaded ? `未装 ${unloaded} 件。` : '无尾货。'} 指标与坐标均来自当前后端结果。`
      : `本地预览装入 ${selectedAlternative?.preview.totalCargoCount || 0}/${selectedAlternative?.preview.totalCargoInput || 0} 件，${unloaded ? `仍有 ${unloaded} 件需处理。` : '当前没有尾货。'} 该结果只用于柜型比较，点击生成后取得后端正式方案。`,
    constraints
  };
}
