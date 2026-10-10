import { useMemo } from 'react';
import { ArrowRight, Boxes, CircleAlert, Container, Gauge, Package, Route, Scale, ShieldCheck, Weight } from 'lucide-react';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { ROUTES } from '../../app/router.js';
import { StatusPill } from '../../components/common/Status.jsx';
import { cargoTotals, PACKAGING_TYPES } from '../../domain/cargo/cargo.js';
import { formatPlanMetric } from '../../domain/plan/activePlanViewModel.js';
import { getPlanSourceLabel, isBackendSolved } from '../../domain/provenance/planSource.js';
import { readinessTone, zhEnum } from '../../domain/presentation/localization.js';
import TaskOverviewScene from '../../three/TaskOverviewScene.jsx';
import SavedCasePicker from './SavedCasePicker.jsx';

export default function DashboardPage({ navigate }) {
  const { session, container, activePlan, activePlanView, planSource } = useSession();
  const cabinets=useMemo(()=>[{containerId:session.order.orderNo,label:'当前柜',equipment:activePlan.containerInfo||container,plan:activePlan}],[session.order.orderNo,activePlan,container]);
  const totals = useMemo(() => cargoTotals(session.cargo), [session.cargo]);
  const readiness = activePlan.shipmentReadiness || activePlan.ext_shipmentReadiness || null;
  const packagingMix = useMemo(() => summarizePackaging(session.cargo), [session.cargo]);
  const next = nextDecision(session, planSource);
  const voidM3 = activePlanView.unexplainedVoidVolume == null ? null : activePlanView.unexplainedVoidVolume / 1e9;
  const distribution = activePlan.loadDistribution || activePlan.ext_loadDistribution;
  const loadedRatio = activePlanView.loadedCount === null || activePlanView.inputCount === null
    ? '待正式求解'
    : `${activePlanView.loadedCount}/${activePlanView.inputCount} 件`;

  return (
    <div className="page dashboard-page shipment-brief">
      <SavedCasePicker />
      <header className="page-header page-header--compact brief-header">
        <div><span className="page-kicker">本票决策简报 · {session.order.orderNo}</span><h1>{session.order.route}</h1><p>从货物物理画像到装载方案、数字孪生和出运准备，按当前方案来源区分容量预览、正式求解和待补资料。</p></div>
        <StatusPill status={isBackendSolved(planSource) ? 'ready' : 'preview'}>{zhEnum(activePlanView.status, getPlanSourceLabel(activePlan))}</StatusPill>
      </header>

      <section className="brief-hero" aria-label="本票装载决策">
        <div className="brief-hero__scene">
          <TaskOverviewScene containers={cabinets} onFocus={()=>navigate(ROUTES.twin)} />
          <div className="brief-scene-caption"><span><Container size={14} />{session.selectedContainerType} · {zhEnum(session.containerMode)}</span><span><Package size={14} />{loadedRatio}</span><span><Gauge size={14} />利用率 {formatPlanMetric(activePlanView.utilization, { decimals: 1, suffix: '%' })}</span></div>
        </div>

        <aside className="brief-decision">
          <span className="decision-label">当前决策</span>
          <h2>{next.title}</h2>
          <p>{next.description}</p>
          <dl className="brief-decision__facts">
            <div><dt><Route size={14} />航线与港序</dt><dd>{(session.caseContext?.route || []).map((port) => port.portCode).join(' → ')}</dd></div>
            <div><dt><Boxes size={14} />货物与包装</dt><dd>{session.cargo.length} SKU · {totals.pieces} 件<br /><small>{packagingMix}</small></dd></div>
            <div><dt><Scale size={14} />载荷指导等级</dt><dd>{zhEnum(distribution?.centreOfGravity?.guidanceStatus, '待求解')}</dd></div>
            <div><dt><Gauge size={14} />未解释剩余空间</dt><dd>{voidM3 == null ? '待求解' : `${voidM3.toFixed(2)} m³`}<br /><small>{voidM3 == null ? '生成正式方案后计算' : '根因未决，不代表可再放货容量'}</small></dd></div>
          </dl>
          <div className="brief-risk"><CircleAlert size={17} /><span>{primaryAction(readiness, activePlanView)}</span></div>
          <button className="button button--primary button--full brief-primary-action" type="button" onClick={() => navigate(next.route)}>{next.label}<ArrowRight size={18} /></button>
        </aside>
      </section>

      <section className="brief-kpis" aria-label="方案关键指标">
        <BriefKpi icon={Package} label="装入数量" value={loadedRatio} />
        <BriefKpi icon={Weight} label="方案货重" value={activePlanView.totalWeight == null ? '待求解' : `${Math.round(activePlanView.totalWeight).toLocaleString()} kg`} />
        <BriefKpi icon={Scale} label="纵向重心" value={formatPlanMetric(activePlanView.longitudinalCog, { decimals: 2, suffix: '%' })} />
        <BriefKpi icon={ShieldCheck} label="逐港卸载" value={zhEnum(activePlan.portAccessibility?.status || activePlan.ext_portAccessibility?.status, '待求解')} />
      </section>

      <section className="readiness-rail" aria-label="五个出运准备业务域">
        <div className="readiness-rail__heading"><div><span className="decision-label">出运准备轨道</span><h2>只突出需要动作的证据</h2></div><span>{readiness ? `${readiness.actionableEvidence?.length || 0} 项待处理` : '生成正式方案后形成证据'}</span></div>
        <div className="readiness-rail__domains">{domainRows(readiness).map((domain, index) => <article key={domain.id} className={`readiness-domain readiness-domain--${readinessTone(domain.status)}`}><span>0{index + 1}</span><div><strong>{domain.label}</strong><small>{domain.pendingCount ? `${domain.pendingCount} 项需动作` : domain.status === 'READY' ? '本项已就绪' : '待生成证据'}</small></div><StatusPill status={readinessTone(domain.status)}>{zhEnum(domain.status)}</StatusPill></article>)}</div>
      </section>
    </div>
  );
}

function BriefKpi({ icon: Icon, label, value }) {
  return <article><span><Icon size={14} />{label}</span><strong>{value}</strong></article>;
}

function nextDecision(session, planSource) {
  if (!session.cargo.length) return { route: ROUTES.cargo, label: '建立货物与包装画像', title: '先建立本票物理事实', description: '录入尺寸、重量、包装、堆码、朝向和装卸方式。' };
  if (!isBackendSolved(planSource)) return { route: ROUTES.strategy, label: '进入装载规划', title: '选择柜型，生成装载方案', description: '当前画面是容量预览。生成方案后，可复核每件货物的位置、余隙与出运资料。' };
  if (!session.twinReviewedAt) return { route: ROUTES.twin, label: '进入数字孪生复核', title: '方案已求解，检查空间与卸货推演', description: '用包装实物外观、空洞解释和逐港回放理解方案。' };
  return { route: ROUTES.evidence, label: '查看出运准备', title: '完成责任动作与外部确认', description: '只处理待补资料、责任人复核和外部未知状态；已通过项默认收起。' };
}

function primaryAction(readiness, view) {
  if (!readiness || !view.isReady) return '正式方案尚未生成；本地预览不能作为出运准备结论。';
  const first = readiness?.actionableEvidence?.[0];
  return first ? `${first.domainLabel}：${first.summary}` : '后端当前未返回待处理证据；仍需由外部责任方确认实际受理状态。';
}

function summarizePackaging(cargo) {
  const counts = cargo.reduce((map, item) => { map[item.packagingType] = (map[item.packagingType] || 0) + Number(item.quantity || 0); return map; }, {});
  return Object.entries(counts).slice(0, 3).map(([type, count]) => `${PACKAGING_TYPES.find(([value]) => value === type)?.[1] || type} ${count}`).join(' · ');
}

function domainRows(readiness) {
  if (readiness?.domains?.length) return readiness.domains;
  return ['箱体与重量', '空间与堆码', '载荷与稳定', '港序与作业', '出运条件'].map((label, index) => ({ id: String(index), label, status: 'DATA_REQUIRED', pendingCount: 0 }));
}
