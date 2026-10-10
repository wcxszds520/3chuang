import {
  Anchor,
  ArrowRight,
  BookOpen,
  Boxes,
  BoxSelect,
  ClipboardCheck,
  Container,
  Crosshair,
  FileOutput,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  Package,
  Play,
  ScanLine,
  ShieldCheck
} from 'lucide-react';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { ROUTES } from '../../app/router.js';
import { StatusPill } from '../../components/common/Status.jsx';
import { cargoTotals } from '../../domain/cargo/cargo.js';
import { getPlanSourceLabel, isBackendSolved } from '../../domain/provenance/planSource.js';
import { PlanPreviewScene } from '../../three/PlanPreviewScene.jsx';
import { useMemo } from 'react';

const FEATURES = Object.freeze([
  { icon: BoxSelect, title: '3D 作业数字孪生', text: '叉车/人工双主体按真实坐标回放装箱全程，时间轴逐件回溯。' },
  { icon: ScanLine, title: '六模式装载分析', text: '重量色阶、港口 LIFO、空间体素、重心偏移、风险分布一屏切换。' },
  { icon: ShieldCheck, title: '确定性合规审查', text: '规则引擎输出结论，AI 仅解释、人工可复核，三层证据独立保留。' },
  { icon: BookOpen, title: '法规证据联动', text: 'IMDG / CTU / SOLAS 摘编 PDF 页码定位，命中条款高亮对照。' },
  { icon: FileOutput, title: '一键报告交付', text: 'HTML / CSV / JSON 本地实时生成，逐件坐标与证据索引可归档。' },
  { icon: FileSpreadsheet, title: '真实数据接入', text: 'CSV 模板导入导出，货物清单即业务数据，演示集可整体替换。' }
]);

const TRUST = Object.freeze([
  { icon: Container, label: 'ISO 668 标准柜型', detail: '20GP / 40GP / 40HQ 真实内尺寸与载荷' },
  { icon: BookOpen, label: '真实法规摘编', detail: 'IMDG、CTU Code、SOLAS VGM 条款原文' },
  { icon: Crosshair, label: '毫米级坐标契约', detail: 'placement x/y/z/l/w/h 全链路一致' },
  { icon: Anchor, label: '港口作业语义', detail: '港序 LIFO、批次、装卸方式全程可溯' }
]);

export default function HomePage({ navigate }) {
  const { session, activePlan, container, planSource } = useSession();
  const totals = useMemo(() => cargoTotals(session.cargo), [session.cargo]);
  const utilization = Number(activePlan.spaceUtilization || 0);
  const lateral = Number(activePlan.cogOffset?.lateral || 0);

  return (
    <div className="page home-page">
      <section className="home-hero" aria-label="产品主视觉">
        <div className="home-hero__stage"><PlanPreviewScene plan={activePlan} /></div>
        <div className="home-hero__panel">
          <span className="home-hero__kicker">PORTCUBE DIGITAL TWIN PLATFORM</span>
          <h1>智港立方</h1>
          <p>集装箱装载数字孪生可视化平台。以毫米级 placement 坐标为唯一事实源，贯通方案求解、3D 作业回放、合规证据与交付报告。</p>
          <div className="home-hero__actions">
            <button className="button button--primary" type="button" onClick={() => navigate(ROUTES.dashboard)}><LayoutDashboard size={18} />进入工作台</button>
            <button className="button button--secondary" type="button" onClick={() => navigate(ROUTES.twin)}><Play size={17} />观看 3D 作业演示</button>
          </div>
          <div className="home-hero__source"><StatusPill status={isBackendSolved(planSource) ? 'ready' : 'preview'}>{getPlanSourceLabel(activePlan)}</StatusPill><span>{session.order.route}</span></div>
        </div>
        <div className="home-hero__stats" aria-label="当前方案关键指标">
          <span><Package size={14} />{activePlan.totalCargoCount}/{activePlan.totalCargoInput} 件装入</span>
          <span><Gauge size={14} />利用率 {utilization.toFixed(1)}%</span>
          <span><Boxes size={14} />{container.typeId}</span>
          <span><Anchor size={14} />重心偏移 {lateral.toFixed(1)}%</span>
        </div>
      </section>

      <section className="home-section" aria-label="核心功能">
        <div className="home-section__head"><span>CAPABILITIES</span><h2>从货物到交付，一条数据链</h2></div>
        <div className="home-features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article className="home-feature" key={title}>
              <span className="home-feature__icon"><Icon size={20} /></span>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section" aria-label="标准与数据背书">
        <div className="home-section__head"><span>STANDARDS & DATA</span><h2>真实标准背书，可换真实数据</h2></div>
        <div className="home-trust">
          {TRUST.map(({ icon: Icon, label, detail }) => (
            <div className="home-trust__item" key={label}><Icon size={18} /><div><strong>{label}</strong><small>{detail}</small></div></div>
          ))}
        </div>
        <div className="home-flow" aria-label="工作流">
          {[['货物录入', Boxes], ['柜型决策', Container], ['3D 作业', BoxSelect], ['合规预审', ClipboardCheck], ['报告交付', FileOutput]].map(([label, Icon], index) => (
            <span className="home-flow__step" key={label}><Icon size={15} />{label}{index < 4 && <ArrowRight size={13} aria-hidden="true" />}</span>
          ))}
        </div>
        <p className="home-footnote">当前会话：{session.order.orderNo} · {totals.pieces} 件货物 · {totals.weight==null?"重量未提供":`${Math.round(totals.weight).toLocaleString()} kg`} · {session.order.vessel}</p>
      </section>
    </div>
  );
}
