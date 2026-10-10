import { useEffect, useRef, useState } from 'react';
import { apiRequest, unwrapApiData } from '../../services/apiClient.js';

const STATE = {READY:'规划检查通过',DATA_REQUIRED:'缺资料',EXTERNAL_CONFIRMATION_REQUIRED:'待外部确认',REVIEW_REQUIRED:'需责任方复核',BLOCKED:'受阻',NOT_APPLICABLE:'不适用'};
const QUESTIONS = ['为什么选择当前柜型？','能否拼入另一个客户？','当前柜的空位还能补货吗？','还有哪些资料和法规需要核对？','当前货物应怎样搬运？'];
const call = async (taskId,path,body,signal) => unwrapApiData(await apiRequest(`/api/load-tasks/${taskId}/${path}`,{method:'POST',body:JSON.stringify(body),signal},{timeoutMs:310000}));

export default function TaskAssistantPanel({taskId,input,tab,hidden,onAction,onPreview,onSaved,onPause,initialQuestion,editOrder}) {
  const [storedContext,setContext]=useState(null);
  const [storedAnswer,setAnswer]=useState(null);
  const [question,setQuestion]=useState(initialQuestion||'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [editor,setEditor]=useState(null);
  const request=useRef(null);
  const openedEdit=useRef(null);
  const answerElement=useRef(null);
  const key=JSON.stringify(input);
  const context=storedContext?.key===key?storedContext.value:null;
  const answer=storedAnswer?.key===key?storedAnswer.value:null;
  const replaying=input.operation?.playing===true;
  useEffect(()=>{if(answer)answerElement.current?.scrollIntoView({block:'start',behavior:'smooth'});},[answer]);
  const activeKey=useRef(key); activeKey.current=key;
  useEffect(()=>{setError('');},[tab]);
  useEffect(()=>{
    const controller=new AbortController();
    request.current?.abort(); setBusy(false); setError('');setEditor(null);
    if(hidden || replaying)return;
    call(taskId,'context',JSON.parse(key),controller.signal).then(value=>{
      if(controller.signal.aborted)return;
      setContext({key,value});setAnswer(current=>current?.value.snapshotId===value.snapshotId?current:null);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>{controller.abort();request.current?.abort();};
  },[taskId,key,hidden,replaying]);
  const ask=async text=>{
    if(!text.trim() || replaying)return;
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setBusy(true);setError('');setAnswer(null);setQuestion(text);
    const askedKey=key;
    try {
      const result=await call(taskId,'assistant',{...input,question:text},controller.signal);
      if(controller.signal.aborted||activeKey.current!==askedKey)return;
      setContext({key:askedKey,value:result.context});setAnswer({key:askedKey,value:result});
      if(result.preview)onPreview(result.preview);
    } catch(e) {if(!controller.signal.aborted)setError(e.message);}
    finally {if(request.current===controller){request.current=null;setBusy(false);}}
  };
  useEffect(()=>{
    if(!editOrder||openedEdit.current===editOrder.token||!context||hidden||context.stage!=='SAVED_TASK')return;
    const order=context.orderEvidence.find(o=>o.orderId===editOrder.orderId);if(!order)return;
    setEditor({scope:'order',objectId:order.orderId,title:`${order.customerName} · ${order.reference}`,values:{packingListReference:order.documents.packingListReference||'',shipperDeclaration:order.documents.shipperDeclaration||''}});openedEdit.current=editOrder.token;
  },[editOrder,context,hidden]);
  const saveEvidence=async()=>{
    setBusy(true);setError('');
    try {const saved=await call(taskId,'evidence',{baseRevision:input.baseRevision,scope:editor.scope,objectId:editor.objectId,values:editor.values});setEditor(null);onSaved(saved);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="task-assistant" hidden={hidden}>
    <p className="task-scope">{context?`${context.name} · v${context.revision} · ${context.stage==='CANDIDATE_PREVIEW'?'候选预览':context.stage==='HISTORICAL_READ_ONLY'?'历史只读':'已保存任务'}`:replaying?'回放进行中；暂停后可解释当前步骤。':'读取任务事实…'}</p>
    {error&&<p role="alert" className="task-alert">{error}</p>}
    {tab==='assistant'&&<>
      <h2>智港 AI</h2><p className="task-scope">围绕当前柜、客户和版本解释；需要比较时调用实际求解，候选由你确认。</p>
      {replaying?<button onClick={onPause}>暂停回放并读取当前步骤</button>:context?.operation&&<p className="task-replay-context"><strong>{context.operation.direction==='unload'?'卸载':'装载'}预演 · {context.operation.phaseLabel}</strong><span>{context.operation.completedCount}/{context.operation.total} 件 · 非实际装入记录</span>{context.operation.activeUnit&&<span>{context.operation.activeUnit.customerName} · {context.operation.activeUnit.name}</span>}{context.operation.blockedReasons.map(reason=><span className="task-alert" key={reason.code}>{reason.message}</span>)}</p>}
      <details className="task-question-set" open={!answer}><summary>{answer?'换一个问题':'常用问题'}</summary><div className="task-ai-prompts">{QUESTIONS.map(q=><button key={q} disabled={busy||replaying} onClick={()=>ask(q)}>{q}</button>)}</div></details>
      <form className="task-ai-form" onSubmit={e=>{e.preventDefault();ask(question);}}><textarea aria-label="向任务AI提问" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1000} placeholder="解释当前对象，或要求比较柜型…"/><div><button className="task-primary" disabled={busy||replaying||!question.trim()}>发送</button>{busy&&<button type="button" onClick={()=>{request.current?.abort();setBusy(false);}}>停止</button>}</div></form>
      {busy&&<p role="status">正在读取任务事实并请求真实模型…</p>}
      {answer&&<article className="task-ai-answer" ref={answerElement}><small>真实模型 · {answer.model}</small><h3>{answer.conclusion}</h3>
        <div className="task-ai-actions">{answer.actions.map((action,i)=><button key={i} onClick={()=>onAction(action)}>{action.label}</button>)}</div>
        {answer.preview&&<button className="task-primary" onClick={()=>onAction({type:'VIEW_CANDIDATES'})}>查看候选与应用影响</button>}
        {answer.basis.slice(0,2).map((row,i)=><p key={i}>{row}</p>)}
        {!!answer.cautions.length&&<div className="task-ai-cautions"><p>{answer.cautions[0]}</p></div>}
        <details><summary>完整依据与下一步</summary>{answer.basis.slice(2).map((row,i)=><p key={i}>{row}</p>)}{answer.cautions.slice(1).map((row,i)=><p key={`c${i}`}>{row}</p>)}{answer.nextSteps.map((row,i)=><p key={`n${i}`}>{row}</p>)}</details>
        {!!answer.sources.length&&<details><summary>官方来源与项目解释 · {answer.sources.length}</summary>{answer.sources.map(source=><Source key={source.id} source={source}/>)}</details>}
        <details><summary>已执行的工具</summary>{answer.trace.map((item,i)=><p key={i}>{item.label}</p>)}</details>
      </article>}
      {context&&<details className="task-ai-facts"><summary>当前计算事实</summary>{context.facts.map(f=><p key={f.id}><span>{f.label}</span><strong>{f.value.toLocaleString('zh-CN',{maximumFractionDigits:3})} {f.unit}</strong></p>)}</details>}
    </>}
    {tab==='evidence'&&context&&<><h2>逐柜出运准备</h2><p className="task-scope">事实来自当前柜方案；地方要求、现场能力及外部受理不能由三维通过代替。</p>
      {context.readiness.map(cab=><details key={cab.containerId} open={cab.containerId===context.selectedContainerId}><summary>{cab.label} · {cab.pendingCount} 项待办 · 方案 v{cab.planVersion}</summary>
        {cab.staleRecord&&<p className="task-alert">方案已变化，旧资料保存在历史版本中；当前柜需重新确认资料。</p>}
        <button disabled={context.stage!=='SAVED_TASK'||busy} onClick={()=>setEditor(containerEditor(cab))}>录入此柜资料</button>
        {cab.evidence.map(row=><div className="task-evidence-row" key={row.id}><strong>{row.title}</strong><span className={`task-evidence-state task-evidence-state--${row.status}`}>{STATE[row.status]}</span><p>{row.summary}</p><small>{row.responsibility}</small>{row.requiredAction&&<p>{row.requiredAction}</p>}<details><summary>事实与来源</summary><p>{row.detail}</p>{row.ruleReferences.map(source=><Source source={source} key={source.id}/>)}</details></div>)}</details>)}
      <h3>客户订单资料</h3>{context.orderEvidence.map(order=><div className="task-evidence-row" key={order.orderId}><strong>{order.customerName} · {order.reference}</strong><span>{STATE[order.status]}</span><p>{order.requiredAction}</p><small>{order.service.destination} · {order.service.strippingPoint}</small><button disabled={context.stage!=='SAVED_TASK'||busy} onClick={()=>setEditor({scope:'order',objectId:order.orderId,title:`${order.customerName} · ${order.reference}`,values:{packingListReference:order.documents.packingListReference||'',shipperDeclaration:order.documents.shipperDeclaration||''}})}>补录订单资料</button></div>)}
    </>}
    {editor&&<div className="task-modal-backdrop"><form className="task-record task-evidence-form" role="dialog" aria-modal="true" aria-label="记录责任资料" onSubmit={e=>{e.preventDefault();saveEvidence();}}><h2>{editor.title}</h2><p>记录已有文件编号或责任方确认依据。空白表示未提供；记录不代表承运人受理，也不修改规划柜内尺寸。</p>{(editor.scope==='order'?ORDER_FIELDS:CONTAINER_FIELDS).map(([key,label])=><label key={key}>{label}{['method','handlingProfile','levelDockConfirmed'].includes(key)?<select value={editor.values[key]||''} onChange={e=>setEditor({...editor,values:{...editor.values,[key]:e.target.value}})}>{(key === 'levelDockConfirmed' ? [['','未确认'],['true','已确认桥板与箱地板平齐']] : key === 'method' ? [['','未提供'],['METHOD_1','方法一 · 整箱称重'],['METHOD_2','方法二 · 分项质量核实']] : [['STANDARD_JACK','标准地牛 · 1170 mm 叉长'],['SHORT_JACK','短叉地牛 · 800 mm 叉长'],['COMPACT_FORKLIFT','紧凑叉车 · 平齐月台 / 自由起升']]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>:<input type={['declaredVGMKg','maxGross','bridgeCapacityKg','floorAxleCapacityKg'].includes(key)?'number':'text'} min="0.001" step="any" maxLength={500} value={editor.values[key]||''} onChange={e=>setEditor({...editor,values:{...editor.values,[key]:e.target.value}})}/>}</label>)}<footer><button type="button" onClick={()=>setEditor(null)}>取消</button><button className="task-primary" disabled={busy}>保存资料版本</button></footer></form></div>}
  </div>;
}

const ORDER_FIELDS=[['packingListReference','装箱清单编号 / 文件依据'],['shipperDeclaration','托运人货物声明依据']];
const CONTAINER_FIELDS=[['declaredVGMKg','VGM 核实总重 kg'],['method','VGM 核实方法'],['shipperDeclaration','托运人 VGM 声明依据'],['containerNumber','实际箱号'],['cscPlateReference','CSC 牌照 / 检查依据'],['maxGross','实箱最大总重 kg'],['treatmentMark','木质包装处理标识'],['exemptionBasis','木包装豁免依据'],['handlingProfile','参考设备预演（不等于现场确认）'],['levelDockConfirmed','叉车工况 · 平齐月台'],['bridgeCapacityKg','桥板允许整车总质量 kg'],['floorAxleCapacityKg','箱地板允许轴载 kg'],['handlingReference','仓库设备与作业能力确认依据'],['securingReference','运输系固工程资料依据']];
function containerEditor(cab) {
  const r=cab.recorded;
  return {scope:'container',objectId:cab.containerId,title:`${cab.label} · 责任资料`,values:{...r.vgm,...r.actualContainer,...r.woodPackagingEvidence,...r.handlingEvidence?.site,levelDockConfirmed:r.handlingEvidence?.site?.levelDockConfirmed?'true':'',handlingProfile:r.handlingEvidence?.profile||'STANDARD_JACK',handlingReference:r.handlingEvidence?.reference||'',securingReference:r.securingInputs?.reference||''}};
}

function Source({source}) {
  return <details className="task-source"><summary>{source.authority} · {source.sourceDocument || source.title}</summary><p>来源定位：{source.clause}</p><p className="task-scope">此处为项目索引与解释，未实时抓取法规原文。{source.verifiedAt?`本地索引核对日 ${source.verifiedAt}`:''}</p><a href={source.sourceUrl} target="_blank" rel="noreferrer">打开官方来源</a></details>;
}

