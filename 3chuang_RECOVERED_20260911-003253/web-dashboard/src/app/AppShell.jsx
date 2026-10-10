import ContextAssistant from '../components/feedback/ContextAssistant.jsx';
import RuntimeStatus from '../components/common/RuntimeStatus.jsx';
import { useEffect, useMemo } from 'react';
import AppHeader from '../components/layout/AppHeader.jsx';
import { CASE_NAV, matchNav } from './navigation.js';
import { useSession } from './session/SessionProvider.jsx';
import { ROUTES } from './router.js';
import { StatusPill } from '../components/common/Status.jsx';
import { isBackendSolved } from '../domain/provenance/planSource.js';
import { deriveWorkflowDecision } from '../domain/compliance/statusModel.js';
import { PRODUCT_METADATA } from '../domain/presentation/productMetadata.js';
import { readinessTone, zhEnum } from '../domain/presentation/localization.js';
import { externalTaskTitle, solverReadinessLabel } from '../domain/cargo/externalDatasetDisplay.js';

export function AppShell({ route, navigate, children }) {
  const { session, activePlanView, planSource } = useSession();
  const captureMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('capture') === '1';
  const current = useMemo(() => matchNav(CASE_NAV, route) || CASE_NAV[0], [route]);
  useEffect(() => { document.title = `${current.label} · ${PRODUCT_METADATA.name}`; }, [current]);
  return (
    <div className={`app-shell workspace-shell${route === ROUTES.twin ? ' workspace-shell--twin' : ''}${captureMode ? ' app-shell--capture' : ''}`}>
      <AppHeader route={route} navigate={navigate}
        assistant={<ContextAssistant route={route} pageLabel={current.label} navigate={navigate} />}
        contextSummary={<><span>当前本票</span><strong>{session.externalDataset ? externalTaskTitle(session.externalDataset) : session.packingCase?.caseId || session.order.orderNo}</strong><span>{session.cargo.reduce((sum, item) => sum + Number(item.quantity || 0), 0).toLocaleString()} 件 · {session.selectedContainerType}</span></>}
      />
      <main className="app-main workspace-main" id="main-content">
        <GlobalContextBar session={session} activePlanView={activePlanView} planSource={planSource} />
        <RuntimeStatus />
        {children}
      </main>
    </div>
  );
}

function GlobalContextBar({ session, activePlanView, planSource }) {
  const external = session.externalDataset;
  const sourceMode=session.solverMode==='SOURCE_BENCHMARK';
  const sourceStatus=activePlanView.plan?.executionStatus;
  const caseId = external ? externalTaskTitle(external) : session.packingCase?.caseId || session.order.orderNo;
  const cargoCount = session.cargo.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const readiness = isBackendSolved(planSource) ? (activePlanView.plan?.shipmentReadiness || activePlanView.plan?.ext_shipmentReadiness) : null;
  const readinessPending = readiness?.actionableEvidence?.length ?? null;
  const status = !session.cargo.length ? 'INPUT_REQUIRED' : !isBackendSolved(planSource) ? 'PREVIEW' : session.manualReview ? deriveWorkflowDecision(session.manualReview) : session.twinReviewedAt ? 'ANALYZED' : 'SOLVED';
  return (
    <section className="global-context workspace-context" aria-label="当前装箱任务上下文">
      <div className="global-context__identity"><span>{external ? '当前测试任务' : '当前本票'}</span><strong className={external ? '' : 'mono'}>{caseId}</strong>{session.dataClassification === 'DEMO_DATA' && <em>演示数据</em>}</div>
      <div className="global-context__meta"><span>{cargoCount.toLocaleString()} 件</span><i>·</i><span>{sourceMode ? `${session.sourceContainer?.sourceType || '来源箱体'} · 来源基准` : `${session.selectedContainerType} · ${zhEnum(session.containerMode)}`}</span><i>·</i><strong title={external ? session.order.orderNo : activePlanView.planId || '暂无方案'}>{external ? '数据任务' : activePlanView.sourceLabel}</strong>{isBackendSolved(planSource) && <span className="plan-identity" title={`方案 ${activePlanView.planId} · 摆放 ${activePlanView.plan.placementHash}`}>{activePlanView.plan.constraintMeta?.solverRevision || activePlanView.plan.metrics?.solverVersion || '2.5'} · {activePlanView.plan.placementHash?.slice(0,8)}</span>}<span className="data-completeness"><b>{isBackendSolved(planSource) ? '装载方案已生成' : external ? solverReadinessLabel(external.solverReadiness) : '等待计算'}</b><b>{sourceMode ? (sourceStatus?.validation==='VALID'?'来源校核通过 · 业务未校核':'来源校核待生成') : readinessPending === null ? '验证待生成' : readinessPending ? `${readinessPending} 项待处理` : '证据已就绪'}</b></span><StatusPill status={readiness ? readinessTone(readiness.overallStatus) : status}>{readiness ? zhEnum(readiness.overallStatus) : external ? '外部数据验证' : workflowStatusLabel(status)}</StatusPill></div>
    </section>
  );
}

export function workflowStatusLabel(status) {
  if (status === 'PREVIEW') return '本地预览';
  return zhEnum(status) === status ? '状态待确认' : zhEnum(status);
}

