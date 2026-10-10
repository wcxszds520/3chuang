import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, BookOpen, Box, BoxSelect, FileCheck2,
  MoveRight, Waypoints
} from 'lucide-react';
import PlacementCutaway from '../../components/common/PlacementCutaway.jsx';
import { ROUTES } from '../../app/router.js';
import AppHeader from '../../components/layout/AppHeader.jsx';
import { buildActivePlanViewModel, formatPlanMetric } from '../../domain/plan/activePlanViewModel.js';
import { CURATED_ASSETS, curatedCargoAsset, LANDING_PACKAGING } from '../../domain/presentation/curatedAssets.js';
import { zhEnum } from '../../domain/presentation/localization.js';
import { normalizePlanSource, PLAN_SOURCE_CODES, isBackendSolved } from '../../domain/provenance/planSource.js';
import { createLandingScrollDriver } from './scrollDriver.js';

const LazyLandingTwinShowcase = lazy(() => import('../../three/LandingExperience.jsx')
  .then(({ LandingTwinShowcase }) => ({ default: LandingTwinShowcase })));

const SPACE_STEPS = [
  ['01', '货物实体', '真实尺寸、重量、包装与运输属性成为求解输入。'],
  ['02', '约束包络', '朝向、堆叠、支撑、门洞、承重与港序圈出可行边界。'],
  ['03', '候选证据', '当前记录包含选中来源和初始位置，但没有完整搜索评分与逐候选拒绝记录；无法证明其他位置都不可行。'],
  ['04', '最终落位', '当前落位已写入正式方案，整体平移前后的坐标分别记录。'],
  ['05', '进入验证', '正式坐标继续进入空间、平衡、风险、港序与出运证据复核。']
];

const SPACE_VERIFY = ['空间', '平衡', '风险', '港序', '出运证据'];

// 坐标语义必须跟随真实方案来源：正式求解 / 本地预览 / 演示 / 未知，文案不 hardcode。
const SOLUTION_WORDING = {
  [PLAN_SOURCE_CODES.BACKEND_SOLVED]: { coordinate: '正式坐标', origin: '来自当前正式方案', step4: '当前落位已写入正式方案，整体平移前后的坐标分别记录。', step5: '正式坐标继续进入空间、平衡、风险、港序与出运证据复核。' },
  [PLAN_SOURCE_CODES.LOCAL_PREVIEW]: { coordinate: '预览坐标', origin: '本地预览（非正式求解）', step4: '选中的真实坐标进入当前预览方案，不为画面重排。', step5: '预览坐标继续进入空间、平衡、风险、港序与出运证据复核。' },
  [PLAN_SOURCE_CODES.OFFLINE_DEMO]: { coordinate: '演示坐标', origin: '离线演示数据', step4: '选中的坐标来自演示数据，仅用于说明求解过程。', step5: '演示坐标继续进入空间、平衡、风险、港序与出运证据复核。' },
  [PLAN_SOURCE_CODES.UNKNOWN]: { coordinate: '当前坐标', origin: '方案来源未确认', step4: '选中的坐标进入当前方案，不为画面重排。', step5: '当前坐标继续进入空间、平衡、风险、港序与出运证据复核。' }
};

const PACKAGING_LABEL = {
  CARTON: '纸箱', WOOD_CRATE: '木箱', PALLETIZED_CARTONS: '托盘纸箱',
  WRAPPED_PALLET: '缠膜托盘', EQUIPMENT_CASE: '设备箱', DRUM: '钢桶', FIBC_BAG: '吨袋'
};

const TWIN_MODES = [
  ['normal', '标准视图', '确认货物、箱体与真实落位关系'],
  ['space', '空间解释', '查看可用空间、空洞与约束边界'],
  ['balance', '重心平衡', '检查载荷分布与重心偏移'],
  ['unload', '卸载验证', '沿门端与港序复核作业可达性']
];

export default function LandingPage({ navigate }) {
  const rootRef = useRef(null);
  const { session, activePlan, activePlanView } = useDeferredLandingData();
  const captureState = useMemo(() => landingCaptureState(), []);
  const [whyState, setWhyState] = useState(captureState.whyState);
  const [activeCargo, setActiveCargo] = useState(captureState.activeCargo);
  const [spaceStep, setSpaceStep] = useState(captureState.spaceStep);
  const [twinMode, setTwinMode] = useState(captureState.twinMode);
  const [leaving, setLeaving] = useState(false);
  const [chatPlayed,setChatPlayed] = useState(captureState.capture);
  const [cogReady,setCogReady] = useState(captureState.capture);
  const cargoIndicatorRef=useRef(null);
  const cogTrackRef=useRef(null);
  const [cogTrackWidth,setCogTrackWidth]=useState(0);
  useEffect(()=>{const el=cogTrackRef.current;if(!el)return undefined;const resize=()=>setCogTrackWidth(el.clientWidth);resize();const observer=new ResizeObserver(resize);observer.observe(el);return ()=>observer.disconnect();},[]);
  const evidenceFacts = useMemo(() => buildEvidenceFacts({
    session,
    activePlan,
    activePlanView,
    evidence: activePlanView.shipmentReadiness?.evidence || []
  }), [session, activePlan, activePlanView]);
  const evidenceByKey = useMemo(() => Object.fromEntries(evidenceFacts.map((item) => [item.key, item])), [evidenceFacts]);
  const selectedPlacement = useMemo(() => {
    const placement = activePlan?.loadedCargo?.find((item) => ['WOOD_CRATE', 'PALLETIZED_CARTONS', 'CARTON'].includes(String(item.packagingType || '').toUpperCase()))
      || activePlan?.loadedCargo?.[0];
    if (!placement) return null;
    const length = Number(activePlan?.containerInfo?.innerLength || 1);
    const height = Number(activePlan?.containerInfo?.innerHeight || 1);
    const u = Math.min(0.96, Math.max(0.02, Number(placement.x || 0) / length));
    const base = Math.min(0.9, Math.max(0, Number(placement.y || 0) / height));
    const sizeU = Math.min(0.2, Math.max(0.03, Number(placement.l || 0) / length));
    const sizeV = Math.min(0.85, Math.max(0.12, Number(placement.h || 0) / height));
    return { ...placement, u, base, sizeU, sizeV };
  }, [activePlan]);
  const solutionWording = SOLUTION_WORDING[normalizePlanSource(activePlan)] || SOLUTION_WORDING[PLAN_SOURCE_CODES.UNKNOWN];
  const spaceSteps = useMemo(() => SPACE_STEPS.map((step, index) => {
    if (index === 3) return [step[0], step[1], solutionWording.step4];
    if (index === 4) return [step[0], step[1], solutionWording.step5];
    return step;
  }), [solutionWording]);

  useEffect(() => {
    document.title = '智港立方 PORTCUBE · 装箱前先把结果看清';
    document.body.classList.add('landing-body');
    const root = rootRef.current;
    const capture = captureState.capture || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealNodes = root?.querySelectorAll('[data-reveal]') || [];
    if (capture) revealNodes.forEach((node) => node.classList.add('is-visible'));
    const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    if (!capture) revealNodes.forEach((node) => revealObserver.observe(node));

    const stepObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      if (entry.target.dataset.whyState !== undefined) setWhyState(Number(entry.target.dataset.whyState));
      if (entry.target.dataset.spaceStep !== undefined) setSpaceStep(Number(entry.target.dataset.spaceStep));
      if (entry.target.dataset.twinMode) setTwinMode(entry.target.dataset.twinMode);
    }), { threshold: 0.55, rootMargin: '-18% 0px -22% 0px' });
    if (!capture) root?.querySelectorAll('[data-why-state], [data-space-step], [data-twin-mode]:not([role=tab])').forEach((node) => stepObserver.observe(node));
    const driver=createLandingScrollDriver({root,capture:captureState.capture});
    const hero=root.querySelector('.pc-hero');
    const visual=root.querySelector('.pc-hero__visual');
    const cue=root.querySelector('.pc-scroll-cue');
    driver.register({el:hero,priority:'parallax',compute:(p,ctx)=>{visual.style.transform=`translateY(${ctx.reduced?0:p*-.15*ctx.viewportH}px)`;}});
    driver.register({el:hero,compute:(_p,ctx)=>{cue.style.opacity=ctx.reduced?'1':String(Math.max(0,1-ctx.scrollY/(ctx.viewportH*.08)));}});
    const register=(selector,container,compute,priority='progress',range)=>{
      root.querySelectorAll(selector).forEach(el=>driver.register({el:el.closest(container)||el,priority,range,compute:(p,ctx)=>compute(el,p,ctx)}));
    };
    register('.pc-hero__grid','.pc-hero',(el,p,ctx)=>{el.style.transform=`translateX(${ctx.reduced?0:p*40}px)`;},'parallax');
    register('.pc-callout','.pc-hero',(el,p,ctx)=>{el.style.transform=`translateY(${ctx.reduced?0:p*-.08*ctx.viewportH}px)`;},'parallax');
    register('.pc-note-progress','article',(el,p)=>{el.style.transform=`scaleY(${p})`;},'progress',[.25,.65]);
    register('.pc-why__object','.pc-why',(el,p,ctx)=>{el.style.setProperty('--why-scale',String(ctx.reduced?1:1+p*.04));},'parallax',[.15,.85]);
    register('.pc-cargo-stage__logic>span','.pc-cargo',(el,p,ctx)=>{const i=[...el.parentElement.querySelectorAll(':scope>span')].indexOf(el);el.style.opacity=ctx.reduced||p>=[.25,.45,.65][i]?'1':'.35';});
    register('.solver-step-nav__track-fill','.pc-space',(el,p)=>{el.style.transform=`scaleX(${p})`;});
    register('.pc-twin-world__readout','.pc-twin',(el,p,ctx)=>{el.style.transform=`translateY(${ctx.reduced?0:p*16}px)`;el.style.opacity=ctx.reduced?'1':String(1-p);},'progress',[.92,1]);
    register('.pc-twin-world__title','.pc-twin',(el,p,ctx)=>{el.style.transform=`translateY(${ctx.reduced?0:p*-.06*ctx.viewportH}px)`;},'parallax',[0,.5]);
    register('.pc-flow-link','.pc-verify',(el,p)=>{el.style.transform=`scaleX(${p})`;},'progress',[.2,.7]);
    register('.pc-copilot__bg','.pc-copilot',(el,p,ctx)=>{el.style.transform=`translateY(${ctx.reduced?0:p*-.08*ctx.viewportH}px)`;},'parallax');
    register('.pc-final__route i>b','.pc-final',(el,p)=>{const i=[...el.closest('.pc-final__route').querySelectorAll('i>b')].indexOf(el);el.style.transform=`scaleX(${Math.min(1,Math.max(0,p*3-i))})`;},'progress',[.1,.5]);
    register('.pc-final__inner>img','.pc-final',(el,p,ctx)=>{el.style.transform=`translateY(${ctx.reduced?0:p*-.1*ctx.viewportH}px)`;},'parallax');
    register('.pc-evidence-source img','.pc-verify',(el,p,ctx)=>{el.style.transform=`translateY(${ctx.reduced?0:p*-.1*ctx.viewportH}px)`;},'parallax');
    const once=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      if(entry.target.matches('.pc-chat'))setChatPlayed(true);
      if(entry.target.matches('.pc-evidence-guidance'))setCogReady(true);
      once.unobserve(entry.target);
    }),{threshold:.4});
    if(capture){setChatPlayed(true);setCogReady(true);}else root.querySelectorAll('.pc-chat,.pc-evidence-guidance').forEach(el=>once.observe(el));


    return () => {
      revealObserver.disconnect();
      stepObserver.disconnect();
      driver.destroy();
      once.disconnect();
      document.body.classList.remove('landing-body');
    };
  }, [captureState.capture]);

  useEffect(()=>{
    const rail=rootRef.current?.querySelector('.pc-cargo-stage__rail');
    const update=()=>{const active=rail?.querySelector('[aria-selected="true"]');if(active&&cargoIndicatorRef.current){cargoIndicatorRef.current.style.transform=`translateY(${active.offsetTop}px) scaleY(${active.offsetHeight})`;}};
    update();const observer=new ResizeObserver(update);if(rail)observer.observe(rail);return ()=>observer.disconnect();
  },[activeCargo]);
  const tabKey=(event,items,active,setActive)=>{
    const delta=['ArrowRight','ArrowDown'].includes(event.key)?1:['ArrowLeft','ArrowUp'].includes(event.key)?-1:0;
    if(!delta&&!['Home','End'].includes(event.key))return;
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(active+delta+items.length)%items.length;
    setActive(next);event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  const enterWorkspace = () => {
    if (leaving) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setLeaving(true);
    window.setTimeout(() => navigate(ROUTES.overview), reduced ? 0 : 560);
  };

  const openTwinEvidence = () => {
    window.sessionStorage.setItem('portcube.rule-to-space', JSON.stringify({
      visualizationMode: 'balance',
      evidenceId: 'LOAD-DISTRIBUTION',
      ruleName: '纵向重心指导区间'
    }));
    navigate(ROUTES.twin);
  };

  const openEvidenceSource = () => {
    window.sessionStorage.setItem('portcube.open-evidence', JSON.stringify({
      evidenceId: 'LOAD-DISTRIBUTION',
      openSource: true
    }));
    navigate(ROUTES.evidence);
  };

  return (
    <div className={`pc-landing ${leaving ? 'is-leaving' : ''}`} data-capture={captureState.capture} ref={rootRef}>
      <AppHeader route={ROUTES.landing} navigate={navigate} variant="marketing" />

      <main>
        <section className="pc-hero" id="top"><i className="pc-hero__grid" aria-hidden="true"/>
          <div className="pc-grid pc-hero__inner">
            <div className="pc-hero__copy" data-reveal>
              <span className="pc-eyebrow"><i />集装箱装载数字孪生与出运准备决策平台</span>
              <h1><span className="pc-hero__line-mask"><span className="pc-hero__line">装箱前，</span></span><em><span className="pc-hero__line-mask"><span className="pc-hero__line">先把装载结果</span></span><span className="pc-hero__line-mask"><span className="pc-hero__line">看清。</span></span></em></h1>
              <p>为货代、仓库与装载计划人员，把货物、箱型和约束放进同一份方案。先求解，再复核空间、作业与出运材料。</p>
              <div className="pc-hero__actions"><button className="pc-button pc-button--primary" type="button" onClick={enterWorkspace}>开始一票装载决策<ArrowRight size={18} /></button><button className="pc-button pc-button--ghost" type="button" onClick={() => navigate(ROUTES.review)}>作品导览与验证<BookOpen size={17} /></button></div>
              <div className="pc-capabilities"><span><Box size={17} /><b>理解货物</b><small>包装决定求解边界</small></span><span><Waypoints size={17} /><b>求解空间</b><small>约束进入候选布局</small></span><span><FileCheck2 size={17} /><b>验证出运</b><small>判断回到事实与证据</small></span></div>
            </div>
            <div className="pc-hero__visual" data-reveal>
              <div className="pc-hero__halo" />
              <img src={CURATED_ASSETS.heroLoadedContainer} fetchpriority="high" decoding="async" alt="一只剖切展示的已装载集装箱，内部包含纸箱、木箱、托盘、吨桶和设备箱" />
              <Callout className="pc-callout--cargo" index="01" title="货物实体" detail="包装与物理属性" />
              <Callout className="pc-callout--space" index="02" title="空间决策" detail="落位与支撑关系" />
              <Callout className="pc-callout--verify" index="03" title="出运准备" detail="重心、港序与证据" />
              <span className="pc-hero__asset-note">策划展示图 · 数据来源见当前方案标识</span>
            </div>
          </div>
          <a className="pc-scroll-cue" href="#why"><span>向下查看决策过程</span><i /></a>
        </section>

        <section className="pc-section pc-why" id="why">
          <div className="pc-grid pc-why__layout">
            <header className="pc-section__header" data-reveal><span className="pc-index">01 / WHY</span><h2>装得下，<br />还不等于<br />装得对。</h2><p>同一个箱体继续向前：柜容只是起点，真正的装载决策还要回答支撑、平衡与作业顺序。</p></header>
            <div className="pc-why__object" data-why-active={whyState} data-reveal><img key={whyState} src={CURATED_ASSETS.whyAnalysis} alt="集装箱门洞、支撑和重心区域的工程标注" /><span className="pc-object-axis pc-object-axis--door" /><span className="pc-object-axis pc-object-axis--support" /><span className="pc-object-axis pc-object-axis--port" /><i key={`sweep-${whyState}`} className="pc-why__sweep" aria-hidden="true"/><span className="pc-why__scan"><i /><b aria-live="polite">{['门洞与搬运路径', '支撑与整体平衡', '港序与卸载可达'][whyState]}</b></span></div>
            <div className="pc-why__notes" data-reveal>
              <EditorialNote image={CURATED_ASSETS.whyAnalysis} index="01" title="能通过门洞吗？" detail="尺寸成立不代表搬运路径成立。" state={0} active={whyState === 0} />
              <EditorialNote image={CURATED_ASSETS.whyAnalysis} index="02" title="放下以后稳吗？" detail="接触、支撑与整体重心必须一起复核。" state={1} active={whyState === 1} />
              <EditorialNote image={CURATED_ASSETS.whyAnalysis} index="03" title="下一港卸得出吗？" detail="未来港货物不能成为当前港的倒箱代价。" state={2} active={whyState === 2} />
            </div>
          </div>
        </section>

        <section className="pc-section pc-cargo" id="cargo">
          <div className="pc-grid">
            <header className="pc-section__header pc-section__header--wide" data-reveal><span className="pc-index">02 / UNDERSTAND CARGO</span><h2>每一种包装，<br />都有自己的装载方式。</h2><p>纸箱如何堆叠，木箱能否上压，设备从哪里进叉。把运输单元和搬运条件录清楚，装载规划才有可靠起点。</p></header>
            <div className="pc-cargo-stage" data-reveal>
              <div className="pc-cargo-stage__rail" role="tablist" aria-label="包装类型" onKeyDown={event=>tabKey(event,LANDING_PACKAGING,activeCargo,setActiveCargo)}>
                {LANDING_PACKAGING.map((item, index) => <button type="button" role="tab" id={`cargo-tab-${index}`} aria-controls="pc-cargo-focus" tabIndex={activeCargo===index?0:-1} aria-selected={activeCargo === index} className={activeCargo === index ? 'active' : ''} onClick={() => setActiveCargo(index)} key={item.key}><span>0{index + 1}</span><img src={item.asset} alt="" /><b>{item.label}</b></button>)}<i className="pc-cargo-rail__indicator" ref={cargoIndicatorRef} aria-hidden="true"/>
              </div>
              <div id="pc-cargo-focus" role="tabpanel" aria-labelledby={`cargo-tab-${activeCargo}`} className="pc-cargo-stage__focus" aria-live="polite" key={LANDING_PACKAGING[activeCargo].key}><span className="pc-cargo-stage__index">{String(activeCargo + 1).padStart(2, '0')} / 06</span><img src={LANDING_PACKAGING[activeCargo].asset} alt={`${LANDING_PACKAGING[activeCargo].label} 包装实物示意`} /></div>
              <div className="pc-cargo-stage__logic"><div className="pc-cargo-stage__explain"><small>{LANDING_PACKAGING[activeCargo].eyebrow}</small><h3>{LANDING_PACKAGING[activeCargo].label}</h3><p>{LANDING_PACKAGING[activeCargo].detail}</p></div><span><i>01</i><b>识别包装</b><small>运输单元与处理方式</small></span><MoveRight /><span><i>02</i><b>录入事实</b><small>尺寸、重量与数量</small></span><MoveRight /><span><i>03</i><b>形成包络</b><small>朝向、堆叠与支撑</small></span></div>
            </div>
          </div>
        </section>

        <section className="pc-section pc-space" id="workflow">
          <div className="pc-grid">
            <header className="pc-section__header" data-reveal><span className="pc-index">03 / CARGO → SPACE</span><h2>从一件货，<br />走到一个可复核的位置。</h2><p>一件货物不会被直接塞进箱子。系统先读取事实，再检查约束、形成候选位置，最终把真实坐标交给数字孪生继续复核。</p></header>
            <div className="solver-walkthrough">
              <nav className="solver-step-nav" aria-label="求解说明五步">{spaceSteps.map(([index,title],step)=><button key={index} type="button" aria-current={spaceStep===step?'step':undefined} onClick={()=>{setSpaceStep(step);rootRef.current?.querySelector(`[data-space-step="${step}"]`)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}}><i>{index}</i>{title}</button>)}<div className="solver-step-nav__track" aria-hidden="true"><i className="solver-step-nav__track-fill"/></div></nav>
              <div className="solver-walkthrough__body">
                <div className="solver-walkthrough__scene" data-space-active={spaceStep}><i key={spaceStep} className="solver-scene-pulse" aria-hidden="true"/>
                  <PlacementCutaway plan={activePlan} item={selectedPlacement}/>
                  {selectedPlacement && <div className="solver-object-facts"><img src={curatedCargoAsset(selectedPlacement.packagingType)} alt="包装外观示意"/><div><strong>{selectedPlacement.name || selectedPlacement.sku} · {PACKAGING_LABEL[selectedPlacement.packagingType] || '货物'}</strong><p>{selectedPlacement.l} × {selectedPlacement.w} × {selectedPlacement.h} mm · {selectedPlacement.weight} kg</p><small>{solutionWording.origin} · {activePlan?.placementHash || activePlan?.metrics?.placementHash || activePlan?.planId}</small></div></div>}
                  {selectedPlacement && <p className="solver-coordinate">{solutionWording.coordinate}：X {Number(selectedPlacement.x).toFixed(1)} · Y {selectedPlacement.y} · Z {selectedPlacement.z} mm</p>}
                </div>
                <div className="solver-walkthrough__steps">{spaceSteps.map(([index,title,detail],step)=><article key={index} data-space-step={step} className={spaceStep===step?'active':'is-dim'}><span>{index}</span><div><h3>{title}</h3><p>{detail}</p>{step===1 && selectedPlacement && <ul><li>{selectedPlacement.stackable===false?'禁止上压':`堆叠上限：${selectedPlacement.maxStackLayers || selectedPlacement.maxLayers || '未提供'} 层`}</li><li>{selectedPlacement.handlingMethod==='manual'?'人工搬运属性；作业能力需另行检查':'设备搬运属性；叉孔与设备能力需另行检查'}</li><li>目的港：{selectedPlacement.destinationPort || '未提供'} · 港序 {selectedPlacement.portSequence || '未提供'}</li></ul>}{step===2 && selectedPlacement?.candidateTrace?.accepted && <p>选中来源：{selectedPlacement.candidateTrace.accepted.source==='CROSS_SECTION_LAYER'?'横截面分层':selectedPlacement.candidateTrace.accepted.source} · 初始 X {selectedPlacement.candidateTrace.accepted.position?.x} mm，当前 X {selectedPlacement.x} mm。</p>}{step===2 && <small>不绘制未经验证的“可行候选”，也不编造评分。</small>}{step===4 && <div className="solver-object-actions">{SPACE_VERIFY.map((label,i)=><button key={label} type="button" onClick={()=>{window.sessionStorage.setItem('portcube.rule-to-space',JSON.stringify({cargoId:selectedPlacement?.cargoId,planId:activePlan?.planId,visualizationMode:['space','balance','risk','port','normal'][i]}));navigate(i===4?ROUTES.evidence:ROUTES.twin);}}>{label} →</button>)}</div>}</div></article>)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="pc-section pc-twin" id="twin">
          <div className="pc-twin-world" data-reveal>
            <DeferredLandingTwin plan={activePlan} mode={twinMode} capture={captureState.capture} />
            <header className="pc-twin-world__title"><span className="pc-index">04 / REAL DIGITAL TWIN</span><h2>让装载方案，<br />在作业前看得清。</h2><p>旋转查看货墙，追踪装卸顺序，定位难以触达的货位。当前订单与方案来源始终可追溯。</p></header>
            <div className="pc-twin-world__hud" role="tablist" aria-label="数字孪生展示模式" onKeyDown={event=>tabKey(event,TWIN_MODES,TWIN_MODES.findIndex(([id])=>id===twinMode),index=>setTwinMode(TWIN_MODES[index][0]))}>{TWIN_MODES.map(([id, title, detail], index) => <button type="button" role="tab" id={`twin-tab-${id}`} aria-controls="pc-twin-readout" tabIndex={twinMode===id?0:-1} aria-selected={twinMode === id} className={twinMode === id ? 'active' : ''} onClick={() => setTwinMode(id)} data-twin-mode={id} key={id}><i>0{index + 1}</i><span><b>{title}</b><small>{detail}</small></span></button>)}</div>
            <div id="pc-twin-readout" role="tabpanel" aria-labelledby={`twin-tab-${twinMode}`} className="pc-twin-world__readout" aria-live="polite" aria-atomic="false"><span>{isBackendSolved(activePlan) ? '正式方案' : '规划预览'} · {activePlanView.containerType || '—'}</span><strong>{TWIN_MODES.find(([id]) => id === twinMode)?.[1]}</strong><small>{activePlanView.isReady ? `${activePlanView.loadedCount}/${activePlanView.inputCount} 件 · ${activePlanView.sourceLabel}` : '正在读取当前方案'}</small></div>
          </div>
        </section>

        <section className="pc-section pc-copilot" id="copilot">
          <div className="pc-grid pc-copilot__grid">
            <header><span className="pc-index">PORTCUBE COPILOT</span><h2>每个决定，<br/>都能问清为什么。</h2><p>为什么选这个柜？这里能否补货？出运还缺什么？Copilot 结合当前订单、货位与证据解释，下一步直接回到业务现场。</p><button className="pc-button pc-button--primary" type="button" onClick={()=>{window.sessionStorage.setItem('portcube.assistant-question','为什么推荐当前柜型？本票还缺哪些出运资料？');navigate(ROUTES.overview);}}>带着本票问 AI<ArrowRight size={18}/></button></header>
            <div className="pc-copilot__brief"><img className="pc-copilot__bg" src={CURATED_ASSETS.copilotBackdrop} alt=""/><div className="pc-chat" data-chat-played={chatPlayed}><p className="pc-chat__msg--user">为什么选 {session.selectedContainerType || '这个柜型'}？本票还缺哪些出运资料？</p><span className="pc-chat__typing" aria-hidden="true">•••</span><div className="pc-chat__card"><span>当前本票事实 · {activePlanView.sourceLabel || '正在读取'}</span><strong>{activePlanView.containerType || '—'} <small>{activePlanView.loadedCount ?? '—'}/{activePlanView.inputCount ?? '—'} 件计划装入</small></strong><dl><div><dt>结论</dt><dd>解释当前选择与适用条件</dd></div><div><dt>依据</dt><dd>数量、重量、空间均绑定系统事实</dd></div><div><dt>影响</dt><dd>指出缺失资料和未知状态</dd></div><div><dt>下一步</dt><dd>打开证据、定位货位、补录资料</dd></div></dl></div><small>此处展示回答结构；实时解释在工作台生成。</small></div></div>
          </div>
        </section>

        <section className="pc-section pc-verify" id="readiness">
          <div className="pc-grid">
            <header className="pc-section__header pc-section__header--wide" data-reveal><span className="pc-index">05 / EVIDENCE CHAIN</span><h2>判断不是一个颜色，<br />而是一条能被复核的证据链。</h2><p>以下数字只读取当前方案与出运准备证据；没有资料就显示待补，不用装饰图替代本票凭证。</p></header>
            <div className="pc-evidence" data-reveal>
              <div className="pc-evidence-flow">
                <section className="pc-evidence-flow__facts"><span>01 / FACT</span><h3>本票事实</h3><dl><div><dt>装入</dt><dd>{evidenceByKey.fact?.value || '—'}</dd></div><div><dt>货重 / 柜型</dt><dd>{evidenceByKey.fact?.detail || '—'}</dd></div><div><dt>方案来源</dt><dd>{activePlanView.sourceLabel || '读取中'}</dd></div></dl></section>
                <i className="pc-flow-link" aria-hidden="true"/><section className="pc-evidence-flow__calculation"><span>02 / CALCULATION + GUIDANCE</span><div className="pc-evidence-flow__number"><strong>{evidenceByKey.calculation?.value || '—'}</strong><small>纵向重心偏移</small></div><p>{evidenceByKey.calculation?.detail}</p>
                  <div className="pc-evidence-guidance" ref={cogTrackRef} data-cog-ready={cogReady && activePlanView.longitudinalCog!=null} aria-label="纵向重心工程指导区间"><i className="pc-evidence-guidance__general" /><i className="pc-evidence-guidance__particular" /><span style={{ transform: `translateX(${cogTrackWidth*(cogReady&&activePlanView.longitudinalCog!=null?Math.min(.96,Math.max(.04,Number(activePlanView.longitudinalCog)/10*.92+.04)):.04)}px)` }}><b>{formatPlanMetric(activePlanView.longitudinalCog, { decimals: 3, suffix: '%' })}</b></span><em className="at-0">0</em><em className="at-5">5</em><em className="at-10">10</em><small className="label-general">一般指导</small><small className="label-particular">特定情形复核</small></div>
                </section>
                <i className="pc-flow-link" aria-hidden="true"/><section className="pc-evidence-flow__judgement"><span>03 / JUDGEMENT</span><h3>{activePlanView.longitudinalCog == null ? '等待方案计算' : Number(activePlanView.longitudinalCog) > 10 ? '超出指导区间' : Number(activePlanView.longitudinalCog) > 5 ? '特定情形需复核' : '位于一般指导区间'}</h3><p>{formatPlanMetric(activePlanView.longitudinalCog, { decimals: 3, suffix: '%' })} {activePlanView.longitudinalCog == null ? '尚无计算结果' : Number(activePlanView.longitudinalCog) > 10 ? '超出 10% 指导范围' : Number(activePlanView.longitudinalCog) > 5 ? '落入 5–10% 特定情形区间' : '位于 0–5% 一般指导区间'}；几何稳定不等于出运准备完成。</p><dl><div><dt>横向</dt><dd>{formatPlanMetric(activePlanView.lateralCog, { decimals: 3, suffix: '%' })}</dd></div><div><dt>责任</dt><dd>{evidenceByKey.responsibility?.value || '责任人复核'}</dd></div></dl></section>
              </div>
              <aside className="pc-evidence-source"><img src={CURATED_ASSETS.boltSeal} alt="集装箱封志语义图" /><div><span>04 / SOURCE SNAPSHOT</span><strong>CTU Code · Annex 7</strong><p>工程指导用于解释载荷分布；最终责任与具体运输条件仍需责任方复核。VGM {session.vgm?.verifiedEvidence ? '已记录本票核验证据' : '证据待补'}。</p></div><div className="pc-evidence__actions"><button type="button" onClick={openTwinEvidence}><BoxSelect size={16} />在孪生中定位</button><button type="button" onClick={openEvidenceSource}><BookOpen size={16} />打开来源阅读器</button></div></aside>
            </div>
          </div>
        </section>

        <section className="pc-final">
          <div className="pc-final__route"><span>货物</span><i><b/></i><span>空间</span><i><b/></i><span>孪生</span><i><b/></i><span>验证</span></div>
          <div className="pc-grid pc-final__inner" data-reveal><div><span className="pc-index">PORTCUBE PROFESSIONAL WORKSPACE</span><h2>现场开始之前，<br /><em>先把装载结果<br />做实。</em></h2><p>从一票真实货物开始，在专业工作台完成包装建模、柜型决策、求解复核与出运准备。</p><button type="button" className="pc-button pc-button--primary pc-button--pulse" onClick={enterWorkspace}>进入专业工作台<ArrowRight size={19} /></button></div><img src={CURATED_ASSETS.finalHarbor} alt="暮色港口中待出运的集装箱" /></div>
          <footer><span>智港立方 PORTCUBE</span><span>集装箱装载数字孪生与出运准备决策平台</span><a href="#top">返回顶部</a></footer>
        </section>
      </main>
      <div className="pc-route-transition" aria-hidden={!leaving}><CubeMark /><span>正在进入专业工作台</span></div>
    </div>
  );
}

function DeferredLandingTwin({ plan, mode, capture }) {
  const hostRef = useRef(null);
  const [near, setNear] = useState(capture);
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);media.addEventListener('change',update);return ()=>media.removeEventListener('change',update);},[]);
  useEffect(() => {
    if (near || !hostRef.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: '900px 0px' });
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [near]);
  return <div className="pc-twin-world__canvas" ref={hostRef}>{near
    ? <Suspense fallback={<div className="pc-landing-twin__loading"><span />正在载入数字孪生渲染器</div>}><LazyLandingTwinShowcase plan={plan} mode={reduced?'normal':mode} sceneProfile="landing" /></Suspense>
    : <div className="pc-landing-twin__loading"><span />滚动接近后载入真实方案场景</div>}</div>;
}

function useDeferredLandingData() {
  const [data, setData] = useState(() => ({
    session: { selectedContainerType: null, vgm: {}, caseContext: {} },
    activePlan: null,
    activePlanView: {
      isReady: false, loadedCount: null, inputCount: null, totalWeight: null,
      containerType: null, sourceLabel: null, longitudinalCog: null, lateralCog: null,
      lifoCompliant: null, geometricStability: null, shipmentReadiness: null
    }
  }));
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let idleId = 0;
    const hydrate = async () => {
      try {
        const [{ loadSession }, { cargoFingerprint }, { getContainer }, { generateLocalPreview }] = await Promise.all([
          import('../../app/session/sessionStorage.js'),
          import('../../domain/cargo/cargo.js'),
          import('../../domain/container/catalog.js'),
          import('../../domain/container/localPreview.js')
        ]);
        if (cancelled) return;
        const session = loadSession();
        const container = getContainer(session.selectedContainerType);
        const fingerprint = cargoFingerprint(session.cargo, session.selectedContainerType);
        const activePlan = session.backendPlan && session.backendPlanFingerprint === fingerprint
          ? session.backendPlan
          : generateLocalPreview(session.cargo, container);
        const activePlanView = buildActivePlanViewModel({ session, plan: activePlan, container });
        if (!cancelled) setData({ session, activePlan, activePlanView });
      } catch {
        // Landing remains legible without inventing operational facts.
      }
    };
    const schedule = () => {
      const capture = landingCaptureState().capture;
      timer = window.setTimeout(() => {
        if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(hydrate, { timeout: 1800 });
        else hydrate();
      }, capture ? 60 : 1250);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', schedule);
      window.clearTimeout(timer);
      if (idleId && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
    };
  }, []);
  return data;
}

function landingCaptureState() {
  if (typeof window === 'undefined') return { capture: false, whyState: 0, activeCargo: 0, spaceStep: 0, twinMode: 'normal' };
  const params = new URLSearchParams(window.location.search);
  const requestedTwin = params.get('landingTwin');
  return {
    capture: params.get('capture') === '1',
    whyState: Math.min(2, Math.max(0, Number(params.get('why') || 0))),
    activeCargo: Math.min(5, Math.max(0, Number(params.get('cargo') || 0))),
    spaceStep: params.get('capture') === '1' ? Math.min(4, Math.max(3, Number(params.get('spaceStep') || 4))) : 0,
    twinMode: TWIN_MODES.some(([id]) => id === requestedTwin) ? requestedTwin : 'normal'
  };
}

function buildEvidenceFacts({ session, activePlan, activePlanView, evidence }) {
  const weight = evidence.find((item) => item.id === 'BOX-PAYLOAD');
  const distribution = evidence.find((item) => item.id === 'LOAD-DISTRIBUTION');
  const port = evidence.find((item) => item.id === 'PORT-ACCESS');
  const rules = [...(weight?.ruleReferences || []), ...(distribution?.ruleReferences || []), ...(port?.ruleReferences || [])];
  const uniqueRules = new Set(rules.map((rule) => rule.id)).size;
  return [
    { key: 'fact', label: '事实', value: activePlanView.isReady ? `${activePlanView.loadedCount}/${activePlanView.inputCount} 件` : '待求解', detail: `${formatPlanMetric(activePlanView.totalWeight, { decimals: 0, suffix: ' kg' })} · ${activePlanView.containerType || session.selectedContainerType}` },
    { key: 'calculation', label: '计算', value: formatPlanMetric(activePlanView.longitudinalCog, { decimals: 3, suffix: '%' }), detail: `横向 ${formatPlanMetric(activePlanView.lateralCog, { decimals: 3, suffix: '%' })} · 由当前方案坐标与货物重量计算` },
    { key: 'rule', label: '规则', value: '一般 ±5%', detail: '特定情形可至 ±10%，但必须由工程责任人复核。' },
    { key: 'judgement', label: '判断', value: zhEnum(activePlan?.loadDistribution?.centreOfGravity?.guidanceStatus, '待验证'), detail: activePlanView.lifoCompliant === null ? '港序条件待验证' : `几何稳定 ${zhEnum(activePlanView.geometricStability, '待验证')} · 港序 ${activePlanView.lifoCompliant ? '通过' : '需复核'}` },
    { key: 'responsibility', label: '责任', value: !activePlanView.shipmentReadiness ? '待生成证据' : activePlanView.shipmentReadiness.actionableEvidence?.length ? '需要责任动作' : '当前证据无待办', detail: activePlanView.shipmentReadiness ? `${activePlanView.shipmentReadiness.actionableEvidence?.length || 0} 项由仓库、货代、工程或外部责任方处理` : '不把本地预览包装成出运结论' },
    { key: 'source', label: '来源', value: uniqueRules ? `${uniqueRules} 条命中规则` : '项目与本票输入', detail: activePlan?.planId ? `正式方案 ${activePlan.planId}` : '来源随正式方案生成' }
  ];
}

function EditorialNote({ image, index, title, detail, state, active }) { return <article className={active ? 'active' : ''} data-why-state={state}><i>{index}</i>{image&&<img className="pc-note-image" src={image} alt="" loading="lazy"/>}<b className="pc-note-progress" aria-hidden="true"/><div><h3>{title}</h3><p>{detail}</p></div></article>; }
function Callout({ className, index, title, detail }) { return <div className={`pc-callout ${className}`}><i>{index}</i><span><strong>{title}</strong><small>{detail}</small></span></div>; }
function CubeMark() { return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m16 3 11 6.5v13L16 29 5 22.5v-13L16 3Z" stroke="currentColor" strokeWidth="1.6"/><path d="m16 16 11-6.5M16 16 5 9.5M16 16v13" stroke="currentColor" strokeWidth="1.6"/><path d="m10 12.3 6-3.5 6 3.5-6 3.5-6-3.5Z" fill="currentColor" opacity=".16"/></svg>; }
