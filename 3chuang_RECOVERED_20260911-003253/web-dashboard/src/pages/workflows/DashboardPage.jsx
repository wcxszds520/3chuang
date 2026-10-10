import { nextDecision } from '../../domain/plan/nextDecision.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Boxes, CircleAlert, Container, Gauge, Package, Route, Scale, ShieldCheck, Weight } from 'lucide-react';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { ROUTES } from '../../app/router.js';
import { StatusPill } from '../../components/common/Status.jsx';
import { cargoTotals, PACKAGING_TYPES } from '../../domain/cargo/cargo.js';
import { formatPlanMetric } from '../../domain/plan/activePlanViewModel.js';
import { getPlanSourceLabel, isBackendSolved } from '../../domain/provenance/planSource.js';
import { readinessTone, zhEnum } from '../../domain/presentation/localization.js';
import { PlanPreviewScene } from '../../three/PlanPreviewScene.jsx';
import { PlanStateNotice } from '../../components/common/PlanDiff.jsx';
import { CURATED_ASSETS } from '../../domain/presentation/curatedAssets.js';

export default function DashboardPage({ navigate }) {
  const { session, activePlan, activePlanView, planSource } = useSession();
  const totals = useMemo(() => cargoTotals(session.cargo), [session.cargo]);
  const readiness = activePlanView.shipmentReadiness;
  const packagingMix = useMemo(() => summarizePackaging(session.cargo), [session.cargo]);
  const next = nextDecision(session, planSource);
  const decisionState = session.stalePlan ? 'stale' : !session.cargo.length || !isBackendSolved(planSource) ? 'pending' : session.twinReviewedAt ? 'reviewed' : 'solved';
  const [hinting,setHinting] = useState(false);
  const hintTimer = useRef(null);
  useEffect(() => () => clearTimeout(hintTimer.current), []);
  const hintAction = () => {
    if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches || sessionStorage.getItem('portcube.cta-hinted')) return;
    sessionStorage.setItem('portcube.cta-hinted','1');setHinting(true);
    hintTimer.current=setTimeout(()=>setHinting(false),600);
  };
  const openTwin = () => {
    sessionStorage.setItem('portcube.rule-to-space',JSON.stringify({visualizationMode:'normal',ruleName:'本票装载决策'}));
    navigate(ROUTES.twin);
  };
  const voidM3 = activePlanView.unexplainedVoidVolume == null ? null : activePlanView.unexplainedVoidVolume / 1e9;
  const distribution = activePlan.loadDistribution || activePlan.ext_loadDistribution;
  const loadedRatio = activePlanView.loadedCount === null || activePlanView.inputCount === null
    ? '待计算装载'
    : `${activePlanView.loadedCount}/${activePlanView.inputCount} 件`;

  return (
    <div className="page dashboard-page shipment-brief" data-decision-state={decisionState}>
      <header className="page-header page-header--compact brief-header">
        <div><span className="page-kicker">本票决策简报 · {session.order.orderNo}</span><h1>{session.order.route}</h1><p>本票货物、装载进度与出运待办。</p></div>
        <StatusPill status={isBackendSolved(planSource) ? 'ready' : 'preview'}>{zhEnum(activePlanView.status, getPlanSourceLabel(activePlan))}</StatusPill>
      </header>
      <PlanStateNotice session={session} onReplan={() => navigate(ROUTES.strategy)} />

      <section className="brief-hero" aria-label="本票装载决策">
        <div className="brief-hero__scene" onPointerEnter={hintAction} style={{'--stage-poster':`url("${CURATED_ASSETS.workbenchPoster}")`}}>
          <PlanPreviewScene plan={activePlan} autoRotate={false} ariaLabel={`装载方案三维预览：${session.selectedContainerType}，${loadedRatio}`} />
          <div className="brief-scene-chips">
            <div className={`brief-scene-chip brief-scene-chip--primary stage-glass${decisionState==='stale'?' is-stale':''}`}><small><Container size={14}/>{session.selectedContainerType} · {zhEnum(session.containerMode)}</small><strong>{decisionState==='pending'?'待计算':formatPlanMetric(activePlanView.utilization,{decimals:1,suffix:'%'})}</strong>{decisionState==='stale'&&<small>基于旧输入</small>}<small className="brief-scene-chip__mobile">{loadedRatio}</small></div>
            <div className="brief-scene-chip brief-scene-chip--secondary-a stage-glass"><small>装入数量</small><strong>{loadedRatio}</strong></div>
            <div className="brief-scene-chip brief-scene-chip--secondary-b stage-glass"><small>空间利用率</small><strong>{formatPlanMetric(activePlanView.utilization,{decimals:1,suffix:'%'})}</strong></div>
            <button type="button" className={`brief-scene-chip brief-scene-chip--action stage-glass${decisionState==='solved'?' is-active':''}`} onClick={openTwin}>打开三维复核 <ArrowRight size={16}/></button>
          </div>
        </div>

        <aside className="brief-decision">
          <span className="decision-label">当前决策</span>
          <DecisionTitle title={next.title}/>
          <p>{next.description}</p>
          <dl className="brief-decision__facts">
            <div><dt><Route size={14} />{session.caseContext?.unloadSequenceSemantics === 'DESTINATION_WAREHOUSE_GROUPS' ? '目的地仓内出库顺序' : '卸货分组顺序'}</dt><dd>{(session.caseContext?.route || []).map((port) => port.portCode).join(' → ')}</dd></div>
            <div><dt><Boxes size={14} />货物与包装</dt><dd>{new Set(session.cargo.map(c=>c.sku)).size} SKU · {totals.pieces} 件<br /><small>{packagingMix}</small></dd></div>
            <div><dt><Scale size={14} />载荷指导等级</dt><dd>{zhEnum(distribution?.centreOfGravity?.guidanceStatus, '—')}</dd></div>
            <div><dt><Gauge size={14} />未解释剩余空间</dt><dd>{voidM3 == null ? '—' : `${voidM3.toFixed(2)} m³`}<br /><small>{voidM3 == null ? '计算后查看' : '根因未决，不代表可再放货容量'}</small></dd></div>
          </dl>
          <div className="brief-risk" data-tone={decisionState==='pending'?'info':'warning'}><CircleAlert size={17} /><span>{primaryAction(readiness, activePlanView)}</span></div>
          <button className={`button button--primary button--full brief-primary-action${hinting?' is-hinting':''}`} aria-live="polite" type="button" onClick={() => navigate(next.route)}>{next.label}<ArrowRight size={18} /></button>
        </aside>
      </section>

      <section className={`brief-kpis${decisionState==='stale'?' is-stale':''}${decisionState==='pending'?' is-pending':''}`} aria-label="方案关键指标">
        <BriefKpi icon={Package} label="装入数量" value={decisionState==='pending'?'—':loadedRatio} />
        <BriefKpi icon={Weight} label="方案货重" value={decisionState==='pending' || activePlanView.totalWeight == null ? '—' : `${Math.round(activePlanView.totalWeight).toLocaleString()} kg`} />
        <BriefKpi icon={Scale} label="纵向重心" value={decisionState==='pending'?'—':formatPlanMetric(activePlanView.longitudinalCog, { decimals: 2, suffix: '%' })} />
        <BriefKpi icon={ShieldCheck} label="顺序可达性" value={decisionState==='pending'?'—':zhEnum(activePlan.portAccessibility?.status || activePlan.ext_portAccessibility?.status, '—')} />
      </section>

      <section className="readiness-rail" aria-label="五个出运准备业务域">
        <div className="readiness-rail__heading"><div><span className="decision-label">出运准备轨道</span><h2>只突出需要动作的证据</h2></div><span data-has-pending={Boolean(readiness?.actionableEvidence?.length)}>{readiness ? `${readiness.actionableEvidence?.length || 0} 项待处理` : '出运信息待补充'}</span></div>
        <div className="readiness-rail__domains">{domainRows(readiness).map((domain, index) => <button type="button" onClick={() => { sessionStorage.setItem('portcube.readiness-domain', JSON.stringify({domainId:domain.id})); navigate(ROUTES.evidence); }} key={domain.id} className={`readiness-domain readiness-domain--${readinessTone(domain.status)}`}><span>0{index + 1}</span><div><strong>{domain.label}</strong><small>{domain.pendingCount ? `${domain.pendingCount} 项需动作` : domain.status === 'READY' ? '本项已就绪' : '待生成证据'}</small></div><StatusPill status={readinessTone(domain.status)}>{zhEnum(domain.status)}</StatusPill></button>)}</div>
      </section>
    </div>
  );
}

function BriefKpi({ icon: Icon, label, value }) {
  return <article><span><Icon size={14} />{label}</span><strong>{value}</strong></article>;
}

function DecisionTitle({title}) {
  const current=useRef(title);
  const [previous,setPrevious]=useState(null);
  useEffect(()=>{
    if(current.current===title)return undefined;
    setPrevious(current.current);current.current=title;
    const timer=setTimeout(()=>setPrevious(null),280);
    return ()=>clearTimeout(timer);
  },[title]);
  return <h2 className="decision-title" aria-live="polite">{previous&&<span className="decision-title__previous" aria-hidden="true">{previous}</span>}<span key={title} className="decision-title__current">{title}</span></h2>;
}


function primaryAction(readiness, view) {
  if (!view.isReady) return '计算装载后查看结果';
  if (!readiness) return '装载方案已生成，出运信息待补充';
  const first = readiness?.actionableEvidence?.[0];
  return first ? `${first.domainLabel}：${first.summary}` : '后端当前未返回待处理证据；仍需由外部责任方确认实际受理状态。';
}

function summarizePackaging(cargo) {
  const counts = cargo.reduce((map, item) => { map[item.packagingType] = (map[item.packagingType] || 0) + Number(item.quantity || 0); return map; }, {});
  return Object.entries(counts).slice(0, 3).map(([type, count]) => `${PACKAGING_TYPES.find(([value]) => value === type)?.[1] || (type === 'null' || type === 'undefined' ? '待确认' : type)} ${count}`).join(' · ');
}

function domainRows(readiness) {
  if (readiness?.domains?.length) return readiness.domains;
  return ['箱体与重量', '空间与堆码', '载荷与稳定', '港序与作业', '出运条件'].map((label, index) => ({ id: ['BOX_WEIGHT','SPACE_STACKING','LOAD_STABILITY','PORT_OPERATION','SHIPMENT_CONDITIONS'][index], label, status: 'DATA_REQUIRED', pendingCount: 0 }));
}
