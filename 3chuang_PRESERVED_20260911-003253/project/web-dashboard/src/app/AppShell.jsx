import ContextAssistant from '../components/feedback/ContextAssistant.jsx';
import { useEffect, useMemo } from 'react';
import { Boxes, BoxSelect, ClipboardCheck, Container, LayoutDashboard, MoveUpRight } from 'lucide-react';
import { useSession } from './session/SessionProvider.jsx';
import { ROUTES } from './router.js';
import { StatusPill } from '../components/common/Status.jsx';
import { isBackendSolved } from '../domain/provenance/planSource.js';
import { deriveWorkflowDecision } from '../domain/compliance/statusModel.js';
import { PRODUCT_METADATA } from '../domain/presentation/productMetadata.js';
import { readinessTone, zhEnum } from '../domain/presentation/localization.js';
import '../pages/workflows/loadTasks.css';

const NAVIGATION = [
  { route: ROUTES.overview, label: '工作台', detail: '本票决策', icon: LayoutDashboard },
  { route: ROUTES.tasks, label: '装载任务', detail: '多柜与客户', icon: Container },
  { route: ROUTES.cargo, label: '货物', detail: '包装与约束', icon: Boxes },
  { route: ROUTES.strategy, label: '规划', detail: '柜型与策略', icon: Container },
  { route: ROUTES.twin, label: '孪生', detail: '空间与作业', icon: BoxSelect },
  { route: ROUTES.evidence, label: '出运准备', detail: '证据与责任', icon: ClipboardCheck }
];

export function AppShell({ route, navigate, children, taskMode, onWorkspaceChange }) {
  const { session, activePlanView, planSource } = useSession();
  const captureMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('capture') === '1';
  const current = useMemo(() => NAVIGATION.find((item) => item.route === route) || NAVIGATION[0], [route]);
  useEffect(() => { document.title = `${current.label} · ${PRODUCT_METADATA.name}`; }, [current]);
  return (
    <div className={`app-shell workspace-shell${taskMode ? ' workspace-shell--tasks' : route === ROUTES.twin ? ' workspace-shell--twin' : ''}${captureMode ? ' app-shell--capture' : ''}`}>
      <header className="workspace-header">
        <button className="workspace-brand-button" type="button" onClick={() => navigate(ROUTES.landing)} aria-label="返回 PORTCUBE 首页"><Brand /></button>
        <nav className="workspace-nav" aria-label="专业工作台导航">
          {NAVIGATION.map(({ route: target, label, detail, icon: Icon }) => (
            <button className={`workspace-nav__item ${route === target ? 'workspace-nav__item--active' : ''}`} type="button" key={target} onClick={() => navigate(target)} aria-current={route === target ? 'page' : undefined}>
              <Icon size={17} aria-hidden="true" /><span><strong>{label}</strong><small>{detail}</small></span>
            </button>
          ))}
        </nav>
        <select className="workspace-object-mode" aria-label="工作对象类型" value={taskMode?'task':'case'} onChange={e=>onWorkspaceChange(e.target.value)}><option value="task">多柜任务</option><option value="case">单柜案例</option></select>
        {taskMode ? <button className="workspace-exit" type="button" onClick={() => window.dispatchEvent(new Event('portcube:task-assistant'))}>智港 AI</button> : <ContextAssistant route={route} pageLabel={current.label} navigate={navigate} />}
        <button className="workspace-exit" type="button" onClick={() => navigate(ROUTES.landing)}>公开体验<MoveUpRight size={15} /></button>
      </header>
      <main className="app-main workspace-main" id="main-content">
        {!taskMode && <GlobalContextBar session={session} activePlanView={activePlanView} planSource={planSource} />}
        {children}
      </main>
    </div>
  );
}

function GlobalContextBar({ session, activePlanView, planSource }) {
  const caseId = session.packingCase?.caseId || session.order.orderNo;
  const cargoCount = session.cargo.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const readiness = session.backendPlan?.shipmentReadiness || session.backendPlan?.ext_shipmentReadiness;
  const readinessPending = readiness?.actionableEvidence?.length ?? null;
  const status = !session.cargo.length ? 'INPUT_REQUIRED' : !isBackendSolved(planSource) ? 'PREVIEW' : session.manualReview ? deriveWorkflowDecision(session.manualReview) : session.twinReviewedAt ? 'ANALYZED' : 'SOLVED';
  return (
    <section className="global-context workspace-context" aria-label="当前装箱任务上下文">
      <div className="global-context__identity"><span>当前本票</span><strong className="mono">{caseId}</strong>{session.dataClassification === 'DEMO_DATA' && <em>演示数据</em>}</div>
      <div className="global-context__meta"><span>{cargoCount.toLocaleString()} 件</span><i>·</i><span>{session.selectedContainerType} · {zhEnum(session.containerMode)}</span><i>·</i><strong title={activePlanView.planId || '未正式求解'}>{activePlanView.sourceLabel}</strong>{isBackendSolved(planSource) && <span className="plan-identity" title={`方案 ${activePlanView.planId} · 摆放 ${activePlanView.plan.placementHash}`}>{activePlanView.plan.constraintMeta?.solverRevision || activePlanView.plan.metrics?.solverVersion || '2.5'} · {activePlanView.plan.placementHash?.slice(0,8)}</span>}<span className="data-completeness"><b>{isBackendSolved(planSource) ? '方案已求解' : '等待正式求解'}</b><b>{readinessPending === null ? '验证待生成' : readinessPending ? `${readinessPending} 项待处理` : '证据已就绪'}</b></span><StatusPill status={readiness ? readinessTone(readiness.overallStatus) : status}>{readiness ? zhEnum(readiness.overallStatus) : zhEnum(status)}</StatusPill></div>
    </section>
  );
}

function Brand() {
  return <div className="brand brand--workspace"><span className="brand__mark"><BrandMark /></span><span><strong>{PRODUCT_METADATA.shortName}<em className="brand__en">PORTCUBE</em></strong><small>装载决策工作台</small></span></div>;
}

function BrandMark() {
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true"><path d="M12 2.7 20.1 7.3v9.4L12 21.3 3.9 16.7V7.3L12 2.7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(255,255,255,.12)" /><path d="M12 11.9 20.1 7.3M12 11.9 3.9 7.3M12 11.9v9.4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}
