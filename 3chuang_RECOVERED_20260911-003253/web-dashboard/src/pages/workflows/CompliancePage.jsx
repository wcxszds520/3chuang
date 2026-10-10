import { nextDecision } from '../../domain/plan/nextDecision.js';
import { CURATED_ASSETS } from '../../domain/presentation/curatedAssets.js';
import { askPortcube } from '../../components/feedback/ContextAssistant.jsx';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, BoxSelect, CheckCircle2, ChevronRight, CircleAlert, ExternalLink, FileSearch, Scale, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { ROUTES } from '../../app/router.js';
import { Drawer, Dialog } from '../../components/feedback/Overlays.jsx';
import { StatusPill } from '../../components/common/Status.jsx';
import { readinessTone, ruleLevelLabel, zhEnum } from '../../domain/presentation/localization.js';
import { isBackendSolved } from '../../domain/provenance/planSource.js';
import { SESSION_ACTIONS } from '../../app/session/sessionReducer.js';
import { apiRequest, unwrapApiData } from '../../services/apiClient.js';
import { planningFingerprint } from '../../domain/plan/planRevision.js';

export default function CompliancePage({ navigate }) {
  const { session, activePlan, planSource, dispatch } = useSession();
  const readiness = activePlan.shipmentReadiness || activePlan.ext_shipmentReadiness || null;
  const [arrivalDomain,setArrivalDomain]=useState(null);
  const next=nextDecision(session,planSource);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [sourceReader, setSourceReader] = useState(null);
  const [handoffVersion, setHandoffVersion] = useState(0);
  const [vgmOpen,setVgmOpen]=useState(false);
  const openAction=e=>{
    if(e.id==='BOX-VGM'){setSelectedEvidence(null);setVgmOpen(true);return;}
    if(e.spaceEvidence){inspectInTwin(e);return;}
    navigate(e.id==='BOX-ACTUAL-UNIT'?ROUTES.strategy:ROUTES.cargo);
  };
  useEffect(()=>{const receive=()=>setHandoffVersion(v=>v+1);window.addEventListener('portcube:evidence-handoff',receive);return ()=>window.removeEventListener('portcube:evidence-handoff',receive);},[]);
  const actionable = useMemo(() => readiness?.actionableEvidence || [], [readiness?.actionableEvidence]);
  const passed = useMemo(() => readiness?.passedEvidence || [], [readiness?.passedEvidence]);
  const domains = useMemo(() => readiness?.domains || [], [readiness?.domains]);
  const responsibilityGroups = useMemo(() => groupByResponsibility(actionable), [actionable]);

  useEffect(() => {
    if (!readiness) return;
    const raw = window.sessionStorage.getItem('portcube.open-evidence');
    if (!raw) return;
    window.sessionStorage.removeItem('portcube.open-evidence');
    try {
      const target = JSON.parse(raw);
      const evidence = (readiness.evidence || [...actionable, ...passed]).find((item) => item.id === target.evidenceId);
      if (!evidence) return;
      setSelectedEvidence(evidence);
      if (target.openSource && evidence.ruleReferences?.length) setSourceReader({ evidence, rule: evidence.ruleReferences[0] });
    } catch {
      // Invalid transient hand-off must not block the readiness page.
    }
  }, [actionable, passed, readiness, handoffVersion]);

  useEffect(()=>{
    if(!readiness)return undefined;
    const raw=sessionStorage.getItem('portcube.readiness-domain');
    if(!raw)return undefined;
    sessionStorage.removeItem('portcube.readiness-domain');
    let domainId;try {domainId=JSON.parse(raw).domainId;}catch{return undefined;}
    if(!domains.some(domain=>domain.id===domainId))return undefined;
    setArrivalDomain(domainId);
    const target=document.getElementById(`readiness-domain-${domainId}`);
    target?.scrollIntoView({block:'center',behavior:'instant'});target?.focus({preventScroll:true});
    const passedPanel=document.querySelector('.readiness-passed');
    if(passed.some(item=>item.domain===domainId) && passedPanel)passedPanel.open=true;
    const timer=setTimeout(()=>setArrivalDomain(null),720);
    return ()=>clearTimeout(timer);
  },[readiness,domains,passed,handoffVersion]);

  const inspectInTwin = (evidence, rule = null) => {
    const target = twinTarget(evidence);
    window.sessionStorage.setItem('portcube.rule-to-space', JSON.stringify({ ...target, evidenceId: evidence.id, ruleId: rule?.id, ruleName: rule?.title || evidence.title }));
    setSourceReader(null);
    setSelectedEvidence(null);
    navigate(ROUTES.twin);
  };

  if (!readiness) return (
    <div className="page readiness-page readiness-page--empty">
      <header className="page-header"><div><span className="page-kicker">出运准备</span><h1>{session.planStatus === 'stale' ? '输入已变化，旧方案证据已失效' : '本票证据尚未生成'}</h1><p>出运准备绑定当前输入和正式方案版本。重量、重心、支撑与作业条件由后端规则校核。</p></div></header>
      <section className="empty-readiness"><img className="readiness-empty-image" src={CURATED_ASSETS.emptyPlanSheet} alt="待建立的装载计划图纸"/><CircleAlert size={28} /><h2>{session.planStatus === 'stale' ? '重规划后重新生成证据' : isBackendSolved(planSource) ? '当前后端方案缺少出运准备证据' : '先生成正式装载方案'}</h2><p>{session.planStatus === 'stale' ? '旧方案仍可用于版本对比，其检查结果不能用于当前货单。' : '容量预览只用于初筛，正式方案生成后才能检查出运准备。'}</p><button className="button button--primary" type="button" onClick={() => navigate(ROUTES.strategy)}>进入装载规划<ArrowRight size={17} /></button></section>
    </div>
  );

  return (
    <div className="page readiness-page" data-readiness-status={readiness.overallStatus} data-evidence-count={readiness.evidence.length}>
      <header className="page-header page-header--compact">
        <div><span className="page-kicker">本票出运准备 · {session.caseContext?.caseId || session.order.orderNo}</span><h1>出运准备</h1><p>先处理责任动作，再复核决策证据与外部未知状态；已通过项默认收起，不适用项隐藏。</p></div>
        <div className="readiness-overall"><span>当前决策</span><strong>{next.title}</strong><StatusPill status={readinessTone(readiness.overallStatus)}>{actionable.length} 项待处理</StatusPill></div>
      </header>

      <section className="readiness-context" aria-label="本票上下文解析">
        <span><small>本票</small><strong className="mono">{session.caseContext?.caseId || session.order.orderNo}</strong></span>
        <span><small>箱体</small><strong>{session.selectedContainerType} · {zhEnum(session.containerMode)}</strong></span>
        <span><small>{session.datasetId === 'worksite-42' ? '仓内出库顺序' : '港序'}</small><strong>{readiness.contextResolver?.resolvedFacts?.portSequences?.join(' → ') || '待补'}</strong></span>
        <span><small>危险货物</small><strong>{readiness.contextResolver?.resolvedFacts?.dangerousGoodsPresent ? '本票相关' : '本票未触发'}</strong></span>
        <span><small>实时受理</small><strong>{readiness.contextResolver?.resolvedFacts?.liveTerminalAcceptanceAvailable ? '可查询' : '无接口 · 需外部确认'}</strong></span>
      </section>

      <section className="readiness-domains" aria-label="五个业务域">
        {domains.map((domain, index) => <article className={`readiness-domain-card readiness-domain-card--${readinessTone(domain.status)}`} key={domain.id} id={`readiness-domain-${domain.id}`} tabIndex={-1} data-arriving={arrivalDomain===domain.id}>
          <span className="readiness-domain-card__index">0{index + 1}</span>
          <div><h2>{session.datasetId === 'worksite-42' && domain.id === 'PORT_OPERATION' ? '顺序与作业' : domain.label}</h2><p>{domain.pendingCount ? `${domain.pendingCount} 项需要责任动作` : domain.id==='PORT_OPERATION' ? '静态计划检查；现场作业另行确认' : '当前证据已就绪'}</p></div>
          <StatusPill status={readinessTone(domain.status)}>{zhEnum(domain.status)}</StatusPill>
        </article>)}
      </section>

      <section className="regulation-match-summary" aria-label="本票法规匹配依据">
        <div><span className="decision-label">规则匹配 · 事实与来源</span><h2>每条判断，都能回到本票事实</h2><p>规则引擎建立匹配与判断；AI 辅助解释适用原因。</p></div>
        <div>{actionable.filter(e=>e.ruleReferences?.length).slice(0,2).map(e=><article key={e.id}><span>{zhEnum(e.status)}</span><h3>{e.title}</h3><p>{e.summary}</p><small>{e.ruleReferences[0].sourceDocument} · {e.ruleReferences[0].clause}</small><footer><button type="button" onClick={()=>setSelectedEvidence(e)}>查看事实与责任 →</button><button type="button" onClick={()=>askPortcube('为什么这条规则适用于当前票？请结合触发事实、来源与责任动作解释。',{objectLabel:e.title,selectedEvidenceId:e.id})}>询问 AI</button></footer></article>)}</div>
      </section>

      <section className="readiness-action-board">
        <div className="section-heading"><div><span className="decision-label">待处理证据</span><h2>按责任方组织下一步动作</h2><p>仓库、货代、工程复核与外部确认分组呈现；状态不是简单 PASS/FAIL。</p></div><span className="action-count">{actionable.length} 项</span></div>
        <div className="readiness-domain-groups">{responsibilityGroups.map((group) => {
          if (!group.items.length) return null;
          return <section className="readiness-domain-group" key={group.id}><header><h3>{group.label}</h3><span>{group.items.length} 项</span></header><div>{group.items.map((evidence) => <EvidenceRow evidence={evidence} arriving={arrivalDomain===evidence.domain} key={evidence.id} onOpen={() => setSelectedEvidence(evidence)} />)}</div></section>;
        })}</div>
      </section>

      <details className="readiness-passed" data-passed-collapsed="true">
        <summary><CheckCircle2 size={17} /><span>已就绪证据</span><strong>{passed.length} 项</strong><small>{passed.map(item=>item.verdict?.summary||item.summary).filter(Boolean).slice(0,2).join('；') || '展开查看通过依据'}</small></summary>
        <div>{passed.map((evidence) => <EvidenceRow evidence={evidence} arriving={arrivalDomain===evidence.domain} key={evidence.id} onOpen={() => setSelectedEvidence(evidence)} />)}</div>
      </details>

      <p className="readiness-boundary"><ShieldCheck size={15} />本页是出运前装箱决策与资料准备，不是订舱、报关、码头操作系统或承运人受理结论。</p>

      <EvidenceDrawer
        evidence={selectedEvidence} suspended={Boolean(sourceReader)}
        onClose={() => setSelectedEvidence(null)}
        onRule={(rule) => setSourceReader({ rule, evidence: selectedEvidence })}
        onTwin={() => inspectInTwin(selectedEvidence)}
        onAction={()=>openAction(selectedEvidence)}
      />
      <SourceReader value={sourceReader} onClose={() => setSourceReader(null)} onTwin={() => inspectInTwin(sourceReader.evidence, sourceReader.rule)} />
      <VgmRecordDialog open={vgmOpen} onClose={()=>setVgmOpen(false)} session={session} plan={activePlan} dispatch={dispatch}/>
    </div>
  );
}

function VgmRecordDialog({open,onClose,session,plan,dispatch}) {
  const [draft,setDraft]=useState({});const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{if(open){setDraft({...session.vgm});setError('');}},[open,session.vgm]);
  const save=async()=>{
    if(!(Number(draft.declaredVGMKg)>0) || !['METHOD_1','METHOD_2'].includes(draft.method)){setError('请填写大于零的核实总重，并选择核实方法。');return;}
    setBusy(true);setError('');
    const vgm={...draft,declaredVGMKg:Number(draft.declaredVGMKg),recordedAt:new Date().toISOString()};
    const evaluate=async p=>unwrapApiData(await apiRequest('/api/packing/shipment-readiness',{method:'POST',body:JSON.stringify({
      placements:p.loadedCargo,container:p.containerInfo,validator:p.validator,layoutQuality:p.layoutQuality,
      voidJustification:p.voidJustification,loadDistribution:p.loadDistribution,portAccessibility:p.portAccessibility,
      securing:p.securing || p.ext_securing,packagingModel:p.packagingModel,cargoList:session.cargo,
      caseContext:session.caseContext,containerMode:session.containerMode,actualContainer:session.actualContainer,
      transport:session.transport,securingInputs:session.securingInputs,massEvidence:session.massEvidence,vgm
    })}));
    try {
      const readiness=await evaluate(plan);
      const strategyReadiness=Object.fromEntries(await Promise.all(Object.entries(session.strategyPlans || {}).map(async([key,p])=>[key,p.planId===plan.planId?readiness:await evaluate(p)])));
      dispatch({type:SESSION_ACTIONS.READINESS_UPDATE,basePlanId:plan.planId,baseFingerprint:planningFingerprint(session),vgm,readiness,strategyReadiness});onClose();
    }catch(e){setError(`资料未保存：${e.message}。请重试，原方案与证据仍保持原值。`);}
    finally{setBusy(false);}
  };
  return <Dialog open={open} onClose={()=>{if(!busy)onClose();}} title="本票 VGM 资料" description="记录已有称重与声明凭证，保存后由后端重新检查资料状态。" footer={<><button className="button button--secondary" type="button" onClick={onClose} disabled={busy}>取消</button><button className="button button--primary" type="button" onClick={save} disabled={busy}>{busy?'正在更新证据…':'保存并更新证据'}</button></>}>
    <div className="vgm-record-form">
      <label>核实总重（kg）<input type="number" min="0.001" step="0.001" value={draft.declaredVGMKg || ''} onChange={e=>setDraft({...draft,declaredVGMKg:e.target.value})}/></label>
      <label>核实方法<select value={draft.method || ''} onChange={e=>setDraft({...draft,method:e.target.value})}><option value="">请选择</option><option value="METHOD_1">方法 1 · 整箱称重</option><option value="METHOD_2">方法 2 · 按认可方法汇总</option></select></label>
      <label>称重凭证编号<input value={draft.weighingCertificateReference || ''} onChange={e=>setDraft({...draft,weighingCertificateReference:e.target.value})} placeholder="填写现有凭证编号，可暂缺"/></label>
      <label>托运人声明凭证<input value={draft.signedDocumentReference || ''} onChange={e=>setDraft({...draft,signedDocumentReference:e.target.value})} placeholder="填写已签署声明的凭证编号"/></label>
      <label className="vgm-record-check"><input type="checkbox" checked={Boolean(draft.shipperDeclaration)} onChange={e=>setDraft({...draft,shipperDeclaration:e.target.checked})}/>已取得托运人声明</label>
      <p>未提供的声明或凭证保持待补。此操作仅记录本票资料，不向承运人或码头发送申报。</p>
      {error && <p role="alert" className="text-danger">{error}</p>}
    </div>
  </Dialog>;
}

function EvidenceRow({ evidence, onOpen, arriving }) {
  return <button className="readiness-evidence-row" data-arriving={arriving} type="button" onClick={onOpen} data-evidence-id={evidence.id}>
    <StatusPill status={readinessTone(evidence.status)}>{zhEnum(evidence.status)}</StatusPill>
    <div className="readiness-evidence-row__content"><strong>{evidence.title}</strong><p>{evidence.id === 'LOAD-DISTRIBUTION' ? `${zhEnum(evidence.currentValue?.class)}；横向 ${evidence.currentValue?.lateralPercent ?? '待补'}% / 纵向 ${evidence.currentValue?.longitudinalPercent ?? '待补'}%` : evidence.summary}</p><EvidenceVisual evidence={evidence} /></div>
    <span className="readiness-owner"><UserRoundCheck size={14} />{evidence.responsibility || '责任待分配'}</span>
    <ChevronRight size={17} />
  </button>;
}

function EvidenceVisual({ evidence }) {
  if (evidence.id === 'BOX-PAYLOAD') {
    const current = Number(evidence.currentValue || 0); const limit = Number(evidence.limit || 0); const rate = limit > 0 ? Math.min(100, current / limit * 100) : 0;
    return <div className="evidence-weight-gauge" aria-label="货重线性量表"><i style={{ width: `${rate}%` }} /><span>{current.toLocaleString()} kg</span><b>{limit ? `${limit.toLocaleString()} kg` : '待补上限'}</b></div>;
  }
  if (evidence.id === 'LOAD-DISTRIBUTION') {
    if (![evidence.currentValue?.lateralPercent,evidence.currentValue?.longitudinalPercent].every(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)))) return <p>载荷分布尚未验证</p>;
    const segments = evidence.currentValue?.longitudinalSegments || [];
    const max = Math.max(1, ...segments.map((entry) => Number(entry.massKg || 0)));
    const offset = Math.max(Math.abs(Number(evidence.currentValue?.lateralPercent || 0)), Math.abs(Number(evidence.currentValue?.longitudinalPercent || 0)));
    return <><div className="evidence-cog-scale" aria-label={`重心偏移 ${offset.toFixed(2)}%，指导刻度 0、5、10`}><span>0</span><span>5</span><span>10%</span><i style={{ left: `${Math.min(100, offset / 10 * 100)}%` }}><b>{offset.toFixed(2)}%</b></i></div><div className="evidence-load-plan" aria-label="纵向载荷分区">{segments.map((segment) => <i key={segment.index} style={{ height: `${Math.max(8, Number(segment.massKg || 0) / max * 100)}%` }}><small>{segment.index}</small></i>)}</div></>;
  }
  if (evidence.id === 'PORT-ACCESS') {
    return <div className="evidence-unload-timeline">{(evidence.currentValue?.calls || []).map((call) => <span key={call.portSequence}><b>{call.portCode || `第 ${call.portSequence} 港`}</b><small>卸 {call.removedCount || 0} · {zhEnum(call.postUnloadStability?.status, '稳定')}</small></span>)}</div>;
  }
  if (evidence.id === 'SPACE-STACKING') return <div className="evidence-weakest"><Scale size={14} /><span>上层 {evidence.currentValue?.stackedCount || 0} 件 · 派生承载 {evidence.currentValue?.derivedCapacityCount || 0} 件</span></div>;
  if (evidence.id === 'CONDITION-SECURING') return <div className="evidence-weakest"><ShieldCheck size={14} /><span>{zhEnum(evidence.currentValue?.geometricStatus)} · 能力参数{evidence.currentValue?.recordedInputs ? '已记录部分' : '待补'}</span></div>;
  return null;
}

function EvidenceDrawer({ evidence, onClose, onRule, onTwin, onAction, suspended }) {
  const isLoadDistribution = evidence?.id === 'LOAD-DISTRIBUTION';
  const guidanceStatus = evidence?.currentValue?.class || evidence?.status;
  return <Drawer suspended={suspended} open={Boolean(evidence)} onClose={onClose} title={evidence?.title || '决策证据'} description={evidence ? `${evidence.domainLabel} · ${zhEnum(evidence.status)}` : ''} size="evidence" footer={evidence && <><button className="button button--secondary" type="button" onClick={onClose}>关闭</button>{evidence.spaceEvidence && <button className="button button--primary" type="button" onClick={onTwin}><BoxSelect size={16} />在数字孪生中定位</button>}</>}>
    {evidence && <div className="evidence-drawer-content" data-evidence-drawer={evidence.id}>
      {isLoadDistribution ? <section className="evidence-business-hierarchy">
        <div className="evidence-business-judgement"><span>业务判断</span><strong>{zhEnum(guidanceStatus)}</strong></div>
        <div className="evidence-business-classification"><span>完整性</span><strong>{zhEnum(evidence.completeness)}</strong></div>
        <div className="evidence-business-classification"><span>适用规则</span><strong>{zhEnum(evidence.comparison)}</strong><small>按当前项目记录的指导区间判断；不代替运输系固设计。</small></div>
      </section> : <section className="evidence-drawer-summary"><StatusPill status={readinessTone(evidence.status)}>{zhEnum(evidence.status)}</StatusPill></section>}
      <section className="evidence-drawer-summary"><p>{evidence.detail}</p></section>
      <EvidenceVisual evidence={evidence} />
      <EvidenceFacts evidence={evidence} />
      {evidence.requiredAction && <section className="evidence-required-action"><CircleAlert size={17} /><div><strong>需要动作</strong><p>{evidence.requiredAction}</p></div></section>}
      {evidence.requiredAction && <button className="button button--primary" type="button" onClick={onAction}>{evidence.id==='BOX-VGM'?'补录 VGM 资料':evidence.id==='BOX-ACTUAL-UNIT'?'绑定实际箱资料':evidence.spaceEvidence?'进入三维复核':'查看货物与约束'}<ArrowRight size={16}/></button>}
      <details className="evidence-inputs"><summary>技术输入追溯</summary>{evidence.inputReferences.map((input) => <code key={input}>{input}</code>)}</details>
      <section className="evidence-rules"><h3>规则 / 指导 / 参考</h3>{evidence.ruleReferences.length ? evidence.ruleReferences.map((rule) => <button type="button" onClick={() => onRule(rule)} key={rule.id}><BookOpen size={15} /><span><strong>{rule.title}</strong><small>{ruleLevelLabel(rule.level)} · {rule.clause}</small></span><ChevronRight size={15} /></button>) : <p>本项为项目几何/流程证据，没有伪造法规引用。</p>}</section>
      <details className="evidence-raw-json"><summary>技术原始数据（JSON）</summary><pre>{JSON.stringify(evidence, null, 2)}</pre></details>
    </div>}
  </Drawer>;
}

function EvidenceFacts({ evidence }) {
  if (evidence.id === 'LOAD-DISTRIBUTION') {
    const lateral = Number(evidence.currentValue?.lateralPercent || 0);
    const longitudinal = Number(evidence.currentValue?.longitudinalPercent || 0);
    const limit = evidence.limit || {};
    const guidanceStatus = evidence.currentValue?.class || evidence.status;
    return <dl className="evidence-facts evidence-chain evidence-facts--seven evidence-facts--business-first">
      <div><dt>01 · 事实</dt><dd>横向 {lateral.toFixed(3)}% · 纵向 {longitudinal.toFixed(3)}%</dd></div>
      <div><dt>02 · 计算</dt><dd>质量加权计算重心；偏移量除以对应箱体半长或半宽。</dd></div>
      <div><dt>03 · 规则 / 条件</dt><dd>一般指导 ±{Number(limit.generalGuidancePercent || 5)}%；特定情形复核至 ±{Number(limit.particularReviewPercent || 10)}%</dd></div>
      <div><dt>04 · 判断</dt><dd>{zhEnum(guidanceStatus)}</dd></div>
      <div><dt>05 · 责任</dt><dd>{evidence.responsibility || '责任待分配'}</dd></div>
      <div><dt>06 · 下一步动作</dt><dd>{evidence.requiredAction || '当前不需要新增责任动作。'}</dd></div>
      <div><dt>07 · 来源与完整性</dt><dd><span>当前装载方案的计算结果；输入字段与原始状态见技术信息。</span></dd></div>
    </dl>;
  }
  return <dl className="evidence-facts evidence-chain evidence-facts--seven">
    <div><dt>01 · 本票事实</dt><dd>{evidence.currentValue == null ? (evidence.status==='NOT_APPLICABLE'?'本票不适用':'尚未提供本项记录') : humanValue(evidence.currentValue)}</dd></div>
    <div><dt>02 · 判断口径</dt><dd>{calculationText(evidence)}</dd></div>
    <div><dt>03 · 条件</dt><dd>{limitText(evidence)}</dd></div>
    <div><dt>04 · 判断</dt><dd>{zhEnum(evidence.status)} · {evidence.summary}</dd></div>
    <div><dt>05 · 责任</dt><dd>{evidence.responsibility || '责任待分配'}</dd></div>
    <div><dt>06 · 下一步动作</dt><dd>{evidence.requiredAction || '当前不需要新增责任动作。'}</dd></div>
    <div><dt>07 · 资料状态</dt><dd>{zhEnum(evidence.status)}；具体输入及计算记录可在下方技术信息中追溯。</dd></div>
  </dl>;
}

function SourceReader({ value, onClose, onTwin }) {
  const rule = value?.rule; const evidence = value?.evidence;
  return <Dialog open={Boolean(value)} onClose={onClose} title="来源阅读器" description={rule ? `${ruleLevelLabel(rule.level)} · ${rule.authority}` : ''} size="source-reader" footer={value && <><button className="button button--secondary" type="button" onClick={onClose}>关闭</button>{evidence.spaceEvidence && <button className="button button--primary" type="button" onClick={onTwin}>查看本票如何应用<BoxSelect size={16} /></button>}</>}>
    {value && <div className="source-reader-grid" data-source-reader={rule.id}>
      <section className="source-reader-identity"><span>01 / 来源身份</span><h2>{rule.sourceDocument}</h2><dl><div><dt>发布方</dt><dd>{rule.authority}</dd></div><div><dt>效力层级</dt><dd>{ruleLevelLabel(rule.level)}</dd></div><div><dt>生效日期</dt><dd>{rule.effectiveFrom || (rule.id==='SOLAS-VI-2-VGM'?'2016-07-01':'当前引用未带日期')}</dd></div><div><dt>核对时间</dt><dd>{rule.id==='SOLAS-VI-2-VGM'?'2026-09-10 · IMO 说明页':rule.verifiedAt || '未提供逐条核对时间'}</dd></div></dl><a href={rule.sourceUrl} target="_blank" rel="noreferrer">打开官方来源<ExternalLink size={15} /></a><p>来源网页与本票受理结果分开。此处未接入实时法规检索。</p></section>
      <section className="source-reader-document"><span>02 / 条款定位与摘要</span><h2>{rule.clause}</h2><div className="source-reader-summary"><small>中文转述 · 不是原文摘录</small><strong>{rule.title}</strong><p>{rule.id==='SOLAS-VI-2-VGM'?'托运人应提供核实总重，并及时交给船长或其代表和码头代表，用于船舶积载计划。提供核实总重是装船前提，但不自动取得装船资格。':'本条已记录文档与条款定位，尚未提供经核对的原文或逐条中文摘要。请打开官方来源核对适用范围。'}</p></div><div className="source-reader-document__scope"><BookOpen size={16} /><span><strong>项目解释</strong><small>{evidence.detail}</small></span></div></section>
      <section className="source-reader-application"><span>03 / 本票应用</span><h2>{evidence.title}</h2><p>{evidence.summary}</p><dl><div><dt>当前记录</dt><dd>{evidence.currentValue==null?'尚未提供本项记录':humanValue(evidence.currentValue)}</dd></div><div><dt>所需条件</dt><dd>{limitText(evidence)}</dd></div><div><dt>判断口径</dt><dd>{calculationText(evidence)}</dd></div><div><dt>责任</dt><dd>{evidence.responsibility}</dd></div><div><dt>下一步</dt><dd>{evidence.requiredAction || '保留记录，按实际业务复核'}</dd></div></dl>{evidence.spaceEvidence && <button className="source-reader-trace" type="button" onClick={onTwin}><FileSearch size={16} />在孪生中定位<ArrowRight size={15} /></button>}<details><summary>技术字段</summary>{evidence.inputReferences.join('、')}</details></section>
    </div>}
  </Dialog>;
}

function twinTarget(evidence) {
  const mode = evidence.spaceEvidence?.twinMode;
  return {
    visualizationMode: ({ SPACE_EXPLANATION: 'space', WEIGHT: 'weight', BALANCE: 'balance', RISK: 'risk', UNLOAD_SIMULATION: 'port' })[mode] || 'normal',
    cargoId: evidence.spaceEvidence?.cargoIds?.[0] || null,
    voidZoneId: evidence.spaceEvidence?.defectZoneIds?.[0] || evidence.spaceEvidence?.zoneIds?.[0] || null,
    unloadReplay: mode === 'UNLOAD_SIMULATION'
  };
}

function calculationText(evidence) {
  return ({'BOX-VGM':'核对核实总重、核实方法及托运人声明是否完整；记录完整不等于码头受理。',
    'BOX-ACTUAL-UNIT':'核对实际箱体信息、安全牌照及检查记录；参考箱型只用于规划。',
    'SPACE-VOID':'区分体积利用率、网格余隙与有约束依据的顶部空间；外接框不能证明可补货。',
    'SPACE-STACKING':'检查支撑面、禁压、层数和承载依据；派生承载参数需要责任方确认。',
    'CONDITION-SECURING':'检查摩擦、挡固和绑扎能力是否有有效记录；不把空字段认定为已提交。',
    'PORT-ACCESS':'按港序移除计划货物，再检查提取通道与剩余货垛支撑。'
  })[evidence.id] || '依据本票输入与现有规则判断；计算字段保留在技术原始数据中。';
}

function limitText(evidence) {
  if(evidence.limit==null) return evidence.status==='NOT_APPLICABLE'?'本票不适用此条件':evidence.requiredAction || '本项以资料及责任方确认判断，无数值限值';
  return `${humanValue(evidence.limit)}${typeof evidence.limit==='number' && evidence.unit ? ` ${evidence.unit}` : ''}`;
}

function humanValue(value) {
  if (value === null || value === undefined || value === '') return '未提供';
  if(typeof value==='boolean') return value?'已记录':'未确认';
  if (Array.isArray(value)) return value.length ? value.slice(0, 8).map((item) => humanValue(item)).join('；') : '无记录';
  if (typeof value !== 'object') return String(value);
  const labels = {
    longitudinalPercent: '纵向重心', lateralPercent: '横向重心', massKg: '质量', count: '数量',
    loadedCount: '装入', inputCount: '输入', blockedCount: '阻断', rehandleCount: '倒箱',
    status: '状态', portCode: '港口', portSequence: '港序', removedCount: '推演卸出', packingMaterialsKg:'包装辅料质量', securingMaterialsKg:'系固材料质量', tareKg:'箱皮重', verifiedGrossMassKg:'核实总重', method:'核实方法', submittedAt:'提交时间', confirmedAt:'确认时间', class:'指导等级', available:'是否提供', recorded:'是否记录'
  };
  const entries = Object.entries(value).filter(([key])=>labels[key]).slice(0, 10).map(([key, item]) => {
    if (item && typeof item === 'object') return `${labels[key] || key}：${Array.isArray(item) ? `${item.length} 项` : '见下级证据'}`;
    return `${labels[key] || key}：${zhEnum(item, item)}`;
  });
  return entries.length ? entries.join('；') : '已返回结构化记录；详见技术信息中的当前值。';
}

function groupByResponsibility(items) {
  const groups = [
    { id: 'warehouse', label: '仓库', matches: ['仓库', '装箱', '操作', '现场'], items: [] },
    { id: 'forwarder', label: '货代', matches: ['货代', '代理', '单证', '申报'], items: [] },
    { id: 'engineering', label: '工程复核', matches: ['工程', '技术', '胜任', '复核'], items: [] },
    { id: 'external', label: '外部确认', matches: [], items: [] }
  ];
  for (const item of items) {
    const text = `${item.responsibility || ''} ${item.requiredAction || ''}`;
    const target = groups.slice(0, 3).find((group) => group.matches.some((token) => text.includes(token))) || groups[3];
    target.items.push(item);
  }
  return groups;
}
