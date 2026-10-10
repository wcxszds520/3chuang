import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { apiRequest, unwrapApiData } from '../../services/apiClient.js';
import { ROUTES } from '../../app/router.js';
import { buildAssistantSnapshot, formatFact } from '../../domain/plan/assistantSnapshot.js';

export function askPortcube(question, context = {}) {
  window.dispatchEvent(new CustomEvent('portcube:ask', {detail:{question, context}}));
}

export default function ContextAssistant({route, pageLabel, navigate}) {
  const {session, activePlan} = useSession();
  const [open,setOpen] = useState(false);
  const [question,setQuestion] = useState('');
  const [extra,setExtra] = useState({});
  const [answer,setAnswer] = useState(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [configured,setConfigured] = useState(null);
  const request = useRef(null);
  const input = useRef(null);
  const trigger = useRef(null);
  const context=useMemo(()=>buildAssistantSnapshot({session,plan:activePlan,page:pageLabel,extra}),[session,activePlan,pageLabel,extra]);
  const evidence=context.evidence;
  const latestContext=useRef(context.snapshotId);
  latestContext.current=context.snapshotId;
  const prompts = route === ROUTES.strategy ? ['为什么推荐当前柜型？','当前最大的装载限制是什么？']
    : route === ROUTES.evidence ? ['为什么现在不能直接判定可以出运？','VGM 还缺什么？']
      : route === ROUTES.twin ? ['深端净距与内部余隙能取消吗？','当前选中货物为什么放在这里？']
        : route === ROUTES.cargo ? ['包装与搬运约束还需确认什么？','修改货物后哪些方案需要重算？']
          : ['本票下一步应先处理什么？','几何稳定与运输系固有什么区别？'];
  useEffect(()=>{
    const controller=new AbortController();
    apiRequest('/api/context-assistant/availability',{signal:controller.signal}).then(p=>setConfigured(unwrapApiData(p).configured===true)).catch(()=>setConfigured(false));
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{
    const receive = e=>{request.current?.abort();setBusy(false);setExtra(e.detail.context || {});setQuestion(e.detail.question || '');setAnswer(null);setError('');setOpen(true);};
    window.addEventListener('portcube:ask',receive);
    return ()=>window.removeEventListener('portcube:ask',receive);
  },[]);
  useEffect(()=>{request.current?.abort();setBusy(false);setExtra({});setAnswer(null);setQuestion('');setError('');},[route,activePlan,session.caseContext,session.vgm,session.securingInputs]);
  useEffect(()=>{
    const value=window.sessionStorage.getItem('portcube.assistant-question');
    if(value){const timer=window.setTimeout(()=>{window.sessionStorage.removeItem('portcube.assistant-question');setQuestion(value);setOpen(true);},0);return()=>window.clearTimeout(timer);}
  },[route]);

  useEffect(()=>{
    window.dispatchEvent(new CustomEvent('portcube:assistant-visibility',{detail:{open}}));
    return ()=>window.dispatchEvent(new CustomEvent('portcube:assistant-visibility',{detail:{open:false}}));
  },[open]);
  useEffect(()=>{ if(open) input.current?.focus(); },[open]);
  useEffect(()=>()=>request.current?.abort(),[]);
  const close=()=>{setOpen(false);request.current?.abort();setBusy(false);trigger.current?.focus();};
  const send=async (value=question)=>{
    if(!value.trim() || busy) return;
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setBusy(true);setAnswer(null);setError('');setQuestion(value);
    try {
      const result=unwrapApiData(await apiRequest('/api/context-assistant/explain',{method:'POST',signal:controller.signal,body:JSON.stringify({question:value,context})},{timeoutMs:70000}));
      if(!controller.signal.aborted && request.current===controller && latestContext.current===context.snapshotId && result.snapshotId===context.snapshotId && result.source==='live-model') {
        setAnswer({...result,context});setConfigured(true);
        window.dispatchEvent(new Event('portcube:ai-call-verified'));
      }
    } catch(e) {if(!controller.signal.aborted) setError(/HTTP 5\d\d|Failed to fetch|网络/.test(e.message)?'暂时无法连接解释服务。当前事实卡仍可查看，请稍后重试。':e.message);}
    finally {if(request.current===controller)setBusy(false);}
  };
  const cancel=()=>{request.current?.abort();setBusy(false);setError('已取消生成，事实卡保持可用。');};
  const locate=()=>{
    const object=context.selectedObject;
    if(!object || !['cargo','space'].includes(object.kind))return;
    const target={planId:context.planId,cargoId:object.kind==='cargo'?object.id:null,voidZoneId:object.kind==='space'?object.id:null,visualizationMode:object.kind==='space'?'space':'normal'};
    window.sessionStorage.setItem('portcube.rule-to-space',JSON.stringify(target));
    window.dispatchEvent(new CustomEvent('portcube:locate-object',{detail:target}));
    close();navigate(ROUTES.twin);
  };
  return <>
    <button ref={trigger} className="workspace-ai-entry" type="button" aria-expanded={open} aria-controls="portcube-assistant" onClick={()=>open?close():setOpen(true)}><Sparkles size={16}/>智港 AI</button>
    {open && createPortal(<aside id="portcube-assistant" className="context-assistant" aria-label="智港 AI Copilot" onKeyDown={e=>{if(e.key==='Escape')close();}}>
      <header><div><Sparkles size={18}/><strong>智港 AI Copilot</strong><span>本票决策助理</span></div><button type="button" onClick={close} aria-label="关闭 AI 助理"><X size={19}/></button></header>
      <div className="context-assistant__context"><span>当前上下文 · {context.sourceLabel}</span><strong>{context.caseId} · {context.container}</strong><p>{pageLabel} · {context.outstandingActions.length} 项待复核{context.selectedObject ? ` · ${context.selectedObject.label || context.selectedObject.id}` : ''}</p><details><summary>方案 {context.placementHash?.slice(0,8) || '本地预览'} · {context.version}</summary><small>{context.planId || '尚暂无方案'}<br/>数据时间：{context.dataTimestamp || '预览快照'}<br/>快照时间：{new Date(context.capturedAt).toLocaleString('zh-CN')}</small></details></div>
      <div className="context-assistant__body" aria-live="polite">
        {context.selectedObject?.kind==='cargo' && <section className="assistant-facts"><h4>当前货物 · 方案坐标</h4><p>{context.selectedObject.dimensions.l} × {context.selectedObject.dimensions.w} × {context.selectedObject.dimensions.h} mm<br/>X {context.selectedObject.position.x} · Y {context.selectedObject.position.y} · Z {context.selectedObject.position.z} mm</p></section>}
        <section className="assistant-facts" aria-label="当前方案事实卡"><h4>本票事实 · 系统计算</h4><dl>{context.facts.slice(0,4).map(fact=><div key={fact.id}><dt>{fact.label}</dt><dd>{formatFact(fact)}</dd></div>)}</dl><details><summary>指标口径与来源</summary>{context.facts.map(fact=><p key={fact.id}><strong>{fact.label}：{formatFact(fact)}</strong><br/>{fact.definition}<small>{fact.sourceField}</small></p>)}</details></section>
        {configured===false && !busy && <p role="status">AI 服务当前不可用。事实与证据仍可查看；发送问题可重新尝试连接。</p>}
        {!answer && !busy && <><h3>把当前决策解释清楚</h3><p>结合本票事实回答，来源与责任动作始终可追溯。</p><div className="context-assistant__prompts">{prompts.map(p=><button type="button" key={p} onClick={()=>send(p)}>{p}</button>)}</div></>}
        {busy && <div className="assistant-waiting"><p role="status">正在解释并核对本票事实…</p><button type="button" onClick={cancel}>取消生成</button></div>}
        {error && <div className="context-assistant__error" role="alert"><strong>解释暂不可用</strong><p>{error}</p><button type="button" onClick={()=>send()}>重试当前问题</button></div>}
        {answer && <><span className="context-assistant__notice">AI 解释 · 方案 {answer.context.placementHash?.slice(0,8) || '预览'} · {new Date(answer.generatedAt).toLocaleTimeString('zh-CN')}</span><section><h4>结论</h4><h3>{answer.conclusion}</h3></section>{[['basis','依据'],['cautions','影响'],['nextSteps','下一步']].map(([key,label])=>answer[key]?.length>0 && <section key={key}><h4>{label}</h4><ul>{answer[key].map((line,i)=><li key={i}>{line}</li>)}</ul></section>)}
          {answer.sourceIds.length>0 && <section><h4>来源 · 本票证据</h4>{answer.sourceIds.map(id=><button className="context-assistant__source" type="button" key={id} onClick={()=>{window.sessionStorage.setItem('portcube.open-evidence',JSON.stringify({evidenceId:id}));window.dispatchEvent(new Event('portcube:evidence-handoff'));close();navigate(ROUTES.evidence);}}>{evidence.find(e=>e.id===id)?.title || id} →</button>)}</section>}
          <details><summary>生成信息</summary><small>{answer.model} · 实时模型输出</small></details>
        </>}
        <p className="assistant-source-boundary">引用为现有条款定位及项目摘要，未实时检索法规原文。几何检查、计划装入和现场出运确认分别判断。</p>
        {['cargo','space'].includes(context.selectedObject?.kind) && <button className="context-assistant__source" type="button" onClick={locate}>定位当前{context.selectedObject.kind==='cargo'?'货物':'空间'} →</button>}
        <div className="context-assistant__links"><button type="button" onClick={()=>{close();navigate(ROUTES.strategy);}}>查看柜型比较</button><button type="button" onClick={()=>{close();navigate(ROUTES.evidence);}}>打开证据链</button></div>
      </div>
      <form onSubmit={e=>{e.preventDefault();send();}}><label htmlFor="assistant-question">围绕当前本票提问</label><div><textarea id="assistant-question" ref={input} value={question} maxLength={1000} rows={2} onChange={e=>setQuestion(e.target.value)} placeholder="例如：这条规则为什么适用？"/><button type="submit" disabled={busy || !question.trim()} aria-label="发送问题"><ArrowUp size={18}/></button></div><small>AI 解释不改变正式方案、证据状态或责任人结论。</small></form>
    </aside>, document.body)}
  </>;
}

