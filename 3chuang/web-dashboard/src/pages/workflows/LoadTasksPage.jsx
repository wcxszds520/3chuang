import ForkInterfaceFields from './ForkInterfaceFields.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, ChevronLeft, ChevronRight, Play, Pause, RotateCcw, Download } from 'lucide-react';
import { apiRequest, unwrapApiData } from '../../services/apiClient.js';
import { downloadTextFile } from '../../services/downloads.js';
import { PACKAGING_TYPES, canonicalPackagingType } from '../../domain/cargo/cargo.js';
import { previewCargoCsv, buildInputCargoCsv } from '../../domain/cargo/csvImport.js';
import { SCENARIO_TEMPLATES } from '../../domain/cargo/scenarioTemplates.js';
import { groupEquivalentCandidates, candidateRejections } from '../../domain/tasks/candidateComparison.js';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { ROUTES } from '../../app/router.js';
import { buildVisualizationContext } from '../../three/analytics/visualizationModes.js';
import TaskOverviewScene from '../../three/TaskOverviewScene.jsx';
import { TaskCargoPanel, TaskDecisionSummary, TaskReadinessPanel } from './TaskBusinessPanels.jsx';
import { TwinScene } from '../../three/TwinScene.jsx';
import { OperationMachine } from '../../three/operation/operationMachine.js';
import { UnloadMachine } from '../../three/operation/unloadMachine.js';
import TaskAssistantPanel from './TaskAssistantPanel.jsx';
import './loadTasks.css';

const STATUS = { DRAFT:'可重排草案', CONFIRMED:'已确认 · 未执行', LOADED_LOCKED:'已记录装入 · 位置锁定', SEALED:'已封柜' };
const containerStatus = cab => cab.status==='LOADED_LOCKED' ? `已记录 ${cab.lockedUnitIds.length}/${cab.plan.loadedCargo.length} 件 · 记录件锁定` : STATUS[cab.status];
const service = { serviceId:'DEMO-NB-HAM', destination:'HAM', strippingPoint:'HAM-CFS', windowStart:'2026-09-15', windowEnd:'2026-09-22' };
const baseRow = { name:'标准设备托盘', sku:'PALLET-A', length:1200, width:1000, height:1300, weight:260, quantity:14,
  packagingType:'PALLETIZED_CARTONS', stackable:false, maxStackLayers:1, canRotate:true, canLayFlat:false, handlingMethod:'forklift', destinationPort:'HAM', portSequence:1 };
const request = async (path = '', body, signal) => unwrapApiData(await apiRequest(`/api/load-tasks${path}`, body ? { method:'POST', body:JSON.stringify(body), signal } : {signal}, { timeoutMs:310000 }));
const pieces = rows => rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
const copy = value => JSON.parse(JSON.stringify(value));

export default function LoadTasksPage({route=ROUTES.tasks,navigate}) {
  const { session } = useSession();
  const [entry]=useState(()=>{try{const value=JSON.parse(sessionStorage.getItem('portcube.task-entry')||'{}');return value;}catch{return {};}});
  const [evidenceTarget,setEvidenceTarget]=useState(null);
  useEffect(()=>{sessionStorage.removeItem('portcube.task-entry');},[]);
  const [tasks, setTasks] = useState([]);
  const [task, setTask] = useState(null);
  const [historical, setHistorical] = useState(null);
  const [history, setHistory] = useState([]);
  const [preview, setPreview] = useState(null);
  const [candidateId, setCandidateId] = useState('');
  const [containerId, setContainerId] = useState(()=>entry.containerId||localStorage.getItem('portcube.loadContainerId')||'');
  const [allCabinets,setAllCabinets]=useState(!entry.containerId);
  const [operationActive,setOperationActive]=useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedRowId,setSelectedRowId]=useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [inspector, setInspector] = useState(entry.question?'assistant':'properties');
  const [view, setView] = useState('overview');
  const [mode, setMode] = useState('normal');
  const [direction, setDirection] = useState('load');
  const [, setSnapshot] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [types, setTypes] = useState(['20GP', '40GP', '40HQ']);
  const [maximumContainers, setMaximumContainers] = useState(12);
  const [record, setRecord] = useState(null);
  const previewRequest = useRef(null);
  useEffect(() => () => previewRequest.current?.abort(), []);
  useEffect(() => {const open=()=>setInspector('assistant');window.addEventListener('portcube:task-assistant',open);return()=>window.removeEventListener('portcube:task-assistant',open);},[]);
  const selectedCandidate = preview?.candidates.find(c => c.candidateId === candidateId);
  const candidateGroups=useMemo(()=>groupEquivalentCandidates(preview?.candidates,task?.containers),[preview,task?.containers]);
  const selectedGroup=candidateGroups.find(group=>group.members.some(member=>member.candidateId===candidateId));
  const visibleRejections=candidateRejections(selectedGroup);
  const shownTask = historical || selectedCandidate?.task || task;
  const ownerColors=useMemo(()=>buildVisualizationContext(shownTask?.units || []).ownerColors,[shownTask?.units]);
  const cargoRow=route===ROUTES.cargo ? shownTask?.rows.find(row=>row.rowId===selectedRowId)||shownTask?.rows[0] : undefined;
  const selected = shownTask?.containers.find(c => c.containerId === containerId) || shownTask?.containers[0];
  const unit = selected?.plan.loadedCargo.find(p => p.cargoId === selectedUnitId);
  const machine = useMemo(() => {
    if (!selected) return null;
    const recorded=shownTask.evidenceByContainer?.[selected.containerId];
    const operationProfile=recorded?.planHash===selected.plan.placementHash?recorded.handlingEvidence?.profile:undefined;
    const plan = { ...selected.plan, containerInfo:{...selected.equipment,operationProfile,operationSite:recorded?.planHash===selected.plan.placementHash?recorded.handlingEvidence?.site:undefined} };
    const instance = direction === 'unload' ? new UnloadMachine(plan) : new OperationMachine(plan);
    if (!operationActive && direction === 'load') instance.jumpToCompletedCount(instance.queue.length);
    return instance;
  }, [selected, direction, shownTask?.evidenceByContainer,operationActive]);
  useEffect(()=>{if(containerId)localStorage.setItem('portcube.loadContainerId',containerId);},[containerId]);
  useEffect(()=>{if(route===ROUTES.strategy)setInspector('candidates');else if(route===ROUTES.evidence)setInspector('evidence');else setInspector(route===ROUTES.tasks&&entry.question?'assistant':'properties');},[route,entry.question]);
  useEffect(()=>{if([ROUTES.cargo,ROUTES.overview,ROUTES.evidence].includes(route)||allCabinets){machine?.pause();setSnapshot(machine?.getSnapshot());}},[route,allCabinets,machine]);
  const snapshot = machine?.getSnapshot();
  const reviewOnly=snapshot?.phase==='COMPLETED' && machine.history?.length===0;
  const operation=machine ? {planHash:selected.plan.placementHash,direction,
    phase:reviewOnly?'REVIEW':snapshot.phase,step:direction==='unload'?machine.steps?.[machine.step]:machine.pausedPhase,
    playing:snapshot.playing,activeUnitId:reviewOnly?undefined:snapshot.currentCargo?.cargoId,
    completedUnitIds:reviewOnly?[]:machine.completedIndices.map(index=>machine.queue[index].cargoId),
    blockedCodes:snapshot.blockedReasons.map(reason=>reason.code)} : undefined;
  const readOnly = Boolean(preview || historical);
  const focusContainer=id=>{setContainerId(id);setAllCabinets(false);setSelectedUnitId('');};
  const selectCargoRow=rowId=>{setSelectedRowId(rowId);const cab=shownTask.containers.find(c=>c.plan.loadedCargo.some(p=>p.rowId===rowId));if(cab){focusContainer(cab.containerId);setSelectedUnitId(cab.plan.loadedCargo.find(p=>p.rowId===rowId).cargoId);}else setSelectedUnitId('');};
  const contextInput={baseRevision:task?.revision,revision:historical?.revision,previewId:preview?.previewId,candidateId:selectedCandidate?.candidateId};

  const run = async (label, fn) => {
    setBusy(label); setError('');
    try { return await fn(); } catch (e) { setError(e.message); return null; } finally { setBusy(''); }
  };
  const acceptTask = value => {
    setTask(value); setPreview(null); setHistorical(null); setSelectedUnitId('');setSelectedRowId('');
    const summary={taskId:value.taskId,name:value.name,revision:value.revision,updatedAt:value.updatedAt};
    setTasks(current=>current.some(item=>item.taskId===value.taskId)?current.map(item=>item.taskId===value.taskId?summary:item):[summary,...current]);
    localStorage.setItem('portcube.loadTaskId', value.taskId);
  };
  const refresh = async taskId => {
    const value = await request(`/${taskId}`); acceptTask(value);
    setHistory(await request(`/${taskId}/history`));
    setTasks(await request()); return value;
  };
  useEffect(() => {
    let active = true;
    request().then(values => { if (active) setTasks(values); }).catch(e => { if (active) setError(e.message); });
    const saved = localStorage.getItem('portcube.loadTaskId');
    if (saved) request(`/${saved}`).then(value => { if (active) {setTask(value);request(`/${saved}/history`).then(setHistory).catch(()=>{});} }).catch(e=> {if(active)setError(e.message);});
    return () => { active = false; };
  }, []);
  const openForm = append => {setError('');setForm({ append, name:'新的装载任务', customerName:append ? '' : '客户甲', orderReference:append ? '' : 'ORDER-A',
    service:copy(append ? task.orders[0].service : service), transportModel:append ? task.transportModel : 'OCEAN_LCL',
    rows:append ? [{...baseRow,quantity:2,length:1000,width:900,height:1100,weight:180,sku:'PALLET-B'}] : [copy(baseRow)], source:'USER_INPUT' });};
  const editRow=row=>{setError('');const order=task.orders.find(o=>o.orderId===row.orderId);setForm({edit:true,rowId:row.rowId,name:task.name,customerName:task.customers.find(c=>c.customerId===row.customerId).name,orderReference:order.reference,service:copy(order.service),transportModel:task.transportModel,rows:[copy(row)]});};
  const makePreview = async (append,rowChanges) => {
    previewRequest.current?.abort(); const controller = new AbortController(); previewRequest.current = controller;
    try {
      const value = await request(`/${task.taskId}/preview`, { baseRevision:task.revision, containerTypes:types, maximumContainers, ...(append ? {append} : {}),...(rowChanges?{rowChanges}:{}) }, controller.signal);
      if (controller.signal.aborted || previewRequest.current !== controller) return;
      setPreview(value); setCandidateId(value.candidates[0]?.candidateId || ''); setHistorical(null); setInspector('candidates');setForm(null);
      if(append||rowChanges){const first=value.candidates[0];const changed=first.task.containers.find(c=>!task.containers.some(previous=>previous.containerId===c.containerId))?.containerId || first.impacts[0]?.containerId;if(changed)focusContainer(changed);setSelectedUnitId('');}
    } finally { if (previewRequest.current === controller) previewRequest.current = null; }
  };
  const stateChange = async (status, unitIds = []) => {
    const value = await request(`/${task.taskId}/state`, {baseRevision:task.revision,containerId:selected.containerId,status,unitIds,note:record?.note?.trim() || '通过本地操作员记录界面提交'});
    acceptTask(value);setRecord(null);setHistory(await request(`/${task.taskId}/history`));
  };
  const exportManifest = () => {
    const lines = [['任务版本','柜','状态','客户','订单','货物行','实物件','货名','长mm','宽mm','高mm','重量kg','Xmm','Ymm','Zmm']];
    for (const c of shownTask.containers) for (const p of c.plan.loadedCargo) lines.push([shownTask.revision,c.label,STATUS[c.status],p.customerName,p.orderReference,p.rowId,p.cargoId,p.name,p.l,p.w,p.h,p.weight,p.x,p.y,p.z]);
    for (const item of shownTask.unassigned) { const u=shownTask.units.find(u=>u.unitId===item.unitId);lines.push([shownTask.revision,'未分配',item.reason,u.customerName,u.orderReference,u.rowId,u.unitId,u.name,u.length,u.width,u.height,u.weight,'','','']); }
    downloadTextFile({filename:`${task.name}-分柜清单.csv`, content:'\ufeff'+lines.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n'), mimeType:'text/csv;charset=utf-8'});
  };

  return <section className="load-tasks">
    <header className="load-task-header"><div><span>客户 / 订单 / 实物件</span><h1>{task?.name || '多柜装载任务'}</h1><p>{task ? `${task.transportModel==='OCEAN_LCL'?'海运共同服务 · 目的地统一拆箱':'多站点卸货演示'} · 当前版本 ${task.revision}` : '从实际货物创建任务，比较逐柜三维方案，再确认分配。'}</p></div>
      <div className="task-actions"><select aria-label="选择装载任务" value={task?.taskId || ''} disabled={!!busy} onChange={e=>run('读取任务',()=>refresh(e.target.value))}><option value="" disabled>打开已保存任务</option>{tasks.map(t=><option key={t.taskId} value={t.taskId}>{t.name} · v{t.revision}</option>)}</select>
        <button onClick={()=>openForm(false)} disabled={!!busy}><Plus size={15}/>新建任务</button>{task&&<button onClick={()=>run('刷新任务',()=>refresh(task.taskId))} disabled={!!busy}><RefreshCw size={15}/>刷新</button>}</div>
    </header>
    {error&&<div className="task-alert" role="alert">{error}</div>}{busy&&<div className="task-progress" role="status">{busy}…</div>}
    {task&&<><div className="task-commandbar"><div className="task-counts"><strong>{shownTask.units.length} 件</strong><span>已分配 {shownTask.units.length-shownTask.unassigned.length}</span><span>未分配 {shownTask.unassigned.length}</span><span>{shownTask.containers.length} 柜</span></div>
      <div className="task-actions">{['20GP','40GP','40HQ'].map(type=><label className="task-check" key={type}><input type="checkbox" checked={types.includes(type)} disabled={!!busy} onChange={e=>setTypes(e.target.checked?[...types,type]:types.filter(t=>t!==type))}/>{type}</label>)}
        <label className="task-limit">柜数上限<input type="number" min="1" max="30" value={maximumContainers} onChange={e=>setMaximumContainers(Number(e.target.value))}/></label>
        <button className="task-primary" disabled={!!busy||!types.length||!!historical} onClick={()=>run('逐柜求解并比较候选',()=>makePreview())}>比较方案</button>
        <button disabled={!!busy||!!historical} onClick={()=>openForm(true)}>追加客户</button><button onClick={exportManifest} title="包含客户归属和未分配实物件"><Download size={15}/>清单</button></div></div>
      {preview&&<div className="task-preview-banner"><strong>候选预览 · 基于版本 {preview.baseRevision}</strong><span>{preview.inputChange?.type==='ROW_EDIT'?`修改 ${preview.inputChange.changedRows} 行货物`:preview.inputChange ? `追加 ${preview.inputChange.customerName} 的 ${preview.inputChange.addedUnits} 件`:'现有任务重新规划'}，确认后保存新版本</span><button onClick={()=>setPreview(null)}>退出预览</button></div>}
      {historical&&<div className="task-preview-banner"><strong>历史版本 {historical.revision} · 只读</strong><button onClick={()=>setHistorical(null)}>返回当前版本</button></div>}
      <div className={`task-workspace ${collapsed?'task-workspace--collapsed':''}`}>
        <aside className="task-tree"><button className="task-tree-toggle" onClick={()=>setCollapsed(!collapsed)} aria-label={collapsed?'展开柜列表':'收起柜列表'}>{collapsed?<ChevronRight size={16}/>:<><ChevronLeft size={16}/>柜与客户</>}</button>
          {!collapsed&&<><div className="task-cab-list"><button className={allCabinets?'active':''} onClick={()=>{setAllCabinets(true);setSelectedUnitId('');setInspector('properties');}}>全部柜位 · {shownTask.containers.length} 柜</button>{shownTask.containers.map(c=><button key={c.containerId} className={!allCabinets&&selected?.containerId===c.containerId?'active':''} onClick={()=>focusContainer(c.containerId)}><strong>{c.label} <em>{c.equipment.typeId}</em></strong><small>{containerStatus(c)}</small><span>{c.plan.loadedCargo.length} 件 · {c.plan.spaceUtilization.toFixed(1)}%</span><div>{[...new Set(c.plan.loadedCargo.map(p=>p.customerName))].join(' / ')}</div></button>)}</div>
            <details open className="task-owners"><summary>客户与订单</summary>{shownTask.customers.map(owner=><div key={owner.customerId}><strong>{owner.name}</strong><span>{shownTask.units.filter(u=>u.customerId===owner.customerId).length} 件</span>{shownTask.orders.filter(o=>o.customerId===owner.customerId).map(order=><small key={order.orderId}>{order.reference} · {order.service.destination}</small>)}</div>)}</details>
            {!!shownTask.unassigned.length&&<details className="task-unassigned"><summary>未分配 {shownTask.unassigned.length} 件</summary>{shownTask.unassigned.map(item=>{const u=shownTask.units.find(u=>u.unitId===item.unitId);return <p key={item.unitId}><strong>{u.customerName} · {u.name} #{u.unitIndex}</strong><small>{item.reason}</small></p>;})}</details>}</>}
        </aside>
        <div className="task-canvas-column">
          {route===ROUTES.cargo?<TaskCargoPanel task={shownTask} readOnly={readOnly||!!busy} rowId={cargoRow?.rowId} onSelectRow={selectCargoRow} onEdit={editRow} onAppend={()=>openForm(true)}/>:route===ROUTES.evidence?<TaskReadinessPanel task={shownTask} input={contextInput} onContainer={id=>{focusContainer(id);setInspector('evidence');}} onEditEvidence={orderId=>{setEvidenceTarget({orderId,token:Date.now()});setInspector('evidence');}}/>:<>
          {route===ROUTES.overview&&<TaskDecisionSummary task={shownTask} onPlan={()=>navigate(ROUTES.strategy)} onEvidence={()=>navigate(ROUTES.evidence)}/>}
          <div className="task-canvas-toolbar"><div>{!allCabinets&&[['overview','总览'],['door','门侧'],['top','顶视'],['section','剖切'],...(operationActive?[['follow','跟随作业']]:[])].map(([key,label])=><button key={key} className={view===key?'active':''} onClick={()=>setView(key)}>{label}</button>)}{selected&&!allCabinets&&<button className={operationActive?'active':''} onClick={()=>{setOperationActive(!operationActive);setDirection('load');setView('overview');}}>{operationActive?'返回静态复核':'进入装卸'}</button>}{allCabinets&&<strong>全部柜位 · 实际三维分配</strong>}</div><select aria-label="三维分析模式" value={mode} onChange={e=>setMode(e.target.value)}><option value="normal">真实包装</option><option value="owner">客户归属</option>{!allCabinets&&<><option value="balance">重心分布</option><option value="space">空间余量</option></>}</select></div>
          {mode==='owner'&&<div className="task-owner-legend">{shownTask.customers.map(owner=><span key={owner.customerId}><i style={{background:ownerColors[owner.customerId]}}/>{owner.name}</span>)}</div>}
          <div className="task-scene">{allCabinets&&shownTask.containers.length?<TaskOverviewScene containers={shownTask.containers} ownerColors={ownerColors} ownerMode={mode==='owner'} onFocus={focusContainer} onError={setError}/>:machine?<TwinScene machine={machine} view={!operationActive&&view==='follow'?'overview':view} mode={operationActive?'operation':'review'} visualizationMode={mode} ownerColors={ownerColors} labelMode="none" focusCargoId={selectedUnitId} onSelect={cargo=>{setSelectedUnitId(cargo?.cargoId||'');setInspector('properties');}} onSnapshot={setSnapshot} onError={setError} />:<div className="task-empty"><strong>货物已按实物件建立</strong><p>选择柜型并比较方案，三维画布会展示每个柜的实际分配。</p></div>}</div>
          {!allCabinets&&operationActive&&!!snapshot?.blockedReasons?.length&&<div className="task-alert" role="alert">{snapshot.blockedReasons.map((reason,index)=><p key={index}>{reason.message || String(reason)}</p>)}</div>}
          {!allCabinets&&operationActive&&machine&&<div className="task-timeline"><div><button onClick={()=>{machine.reset();machine.play();setSnapshot(machine.getSnapshot());}}><RotateCcw size={15}/>从头播放</button><button onClick={()=>{if(machine.playing)machine.pause();else machine.play();setSnapshot(machine.getSnapshot());}}>{snapshot?.playing?<Pause size={15}/>:<Play size={15}/>} {snapshot?.playing?'暂停':'播放'}</button><select aria-label="装卸回放方向" value={direction} onChange={e=>setDirection(e.target.value)}><option value="load">装载</option><option value="unload">卸载</option></select><span>1×</span></div><span>{snapshot?.phaseLabel || '方案复核'} · {snapshot?.completedCount ?? 0}/{selected.plan.loadedCargo.length} 件</span></div>}
          </>}
        </div>
        <aside className="task-inspector"><div className="task-inspector-tabs">{[['properties','属性'],['candidates','候选'],['assistant','AI'],['evidence','资料'],['history','版本']].map(([key,label])=><button key={key} className={inspector===key?'active':''} onClick={()=>setInspector(key)}>{label}</button>)}</div>
          {inspector==='properties'&&<>{cargoRow?<><h2>当前货物行</h2><dl><dt>客户 / 订单</dt><dd>{shownTask.customers.find(c=>c.customerId===cargoRow.customerId)?.name}<br/>{shownTask.orders.find(o=>o.orderId===cargoRow.orderId)?.reference}</dd><dt>名称 / SKU</dt><dd>{cargoRow.name}<br/>{cargoRow.sku}</dd><dt>实物件分配</dt><dd>{shownTask.containers.map(c=>({label:c.label,count:c.plan.loadedCargo.filter(p=>p.rowId===cargoRow.rowId).length})).filter(c=>c.count).map(c=><p key={c.label}>{c.label} · {c.count} 件</p>)}未分配 {shownTask.unassigned.filter(item=>shownTask.units.find(u=>u.unitId===item.unitId)?.rowId===cargoRow.rowId).length} 件</dd></dl><p className="task-scope">AI 已绑定当前货物行。输入尺寸与数量保留在任务版本中。</p></>:allCabinets?<><h2>任务总览</h2><dl><dt>客户与订单</dt><dd>{shownTask.customers.length} 位客户 · {shownTask.orders.length} 票订单</dd><dt>分配状态</dt><dd>{shownTask.units.length-shownTask.unassigned.length}/{shownTask.units.length} 件已规划<br/>{shownTask.containers.length} 柜 · {shownTask.unassigned.length} 件未分配</dd><dt>执行记录</dt><dd>{shownTask.containers.reduce((sum,c)=>sum+c.lockedUnitIds.length,0)} 件有装入记录</dd></dl><p className="task-scope">点击画布中的柜位或左侧柜列表，查看该柜的几何、客户归属和责任资料。</p></>:selected?<><h2>{unit?unit.name:`${selected.label} · ${selected.equipment.typeId}`}</h2>{unit?<><dl><dt>客户 / 订单</dt><dd>{unit.customerName} / {unit.orderReference}</dd><dt>实物件 ID</dt><dd className="task-id">{unit.cargoId}</dd><dt>尺寸与质量</dt><dd>{unit.l} × {unit.w} × {unit.h} mm<br/>{unit.weight} kg</dd><dt>位置 X / Y / Z</dt><dd>{unit.x.toFixed(1)} / {unit.y.toFixed(1)} / {unit.z.toFixed(1)} mm</dd><dt>执行记录</dt><dd>{selected.lockedUnitIds.includes(unit.cargoId)?'已记录装入，坐标锁定':'未记录装入'}</dd></dl><button onClick={()=>setSelectedUnitId('')}>返回柜属性</button></>:<><dl><dt>状态</dt><dd>{containerStatus(selected)}</dd><dt>内部尺寸</dt><dd>{selected.equipment.innerLength} × {selected.equipment.innerWidth} × {selected.equipment.innerHeight} mm</dd><dt>计划装入</dt><dd>{selected.plan.loadedCargo.length} 件 · {selected.plan.totalWeight.toLocaleString()} kg</dd><dt>容积利用率</dt><dd>{selected.plan.spaceUtilization.toFixed(2)}%</dd><dt>重心偏移（全内长 / 宽）</dt><dd>{selected.plan.metrics.cog.longitudinal.toFixed(3)}% / {selected.plan.metrics.cog.lateral.toFixed(3)}%</dd><dt>三维与卸货计算</dt><dd>{selected.plan.taskGate?.eligible?'通过当前项目门槛':'查看计算依据'}</dd><dt>柜方案版本</dt><dd>v{selected.planVersion} · {selected.plan.placementHash}</dd></dl>
                <p className="task-scope">{selected.plan.evidenceScope}</p><div className="task-state-actions">{selected.status==='DRAFT'&&<button disabled={readOnly||!!busy} onClick={()=>run('确认柜方案',()=>stateChange('CONFIRMED'))}>确认此柜方案</button>}{selected.status==='CONFIRMED'&&<button disabled={readOnly||!!busy} onClick={()=>run('恢复可重排草案',()=>stateChange('DRAFT'))}>恢复草案</button>}{['CONFIRMED','LOADED_LOCKED'].includes(selected.status)&&<button disabled={readOnly||!!busy} onClick={()=>setRecord({unitIds:[],seal:false})}>记录已装入货物</button>}{selected.status==='LOADED_LOCKED'&&<button disabled={readOnly||!!busy} onClick={()=>setRecord({unitIds:[],seal:true})}>记录封柜</button>}</div></>}
              <details><summary>柜内实物件 · 点击定位</summary>{selected.plan.loadedCargo.map(p=><button className="task-unit" key={p.cargoId} onClick={()=>{setAllCabinets(false);setSelectedUnitId(p.cargoId);}}>{p.customerName} · {p.name} #{p.unitIndex}{selected.lockedUnitIds.includes(p.cargoId)?' · 已锁定':''}</button>)}</details>
              {!!selected.executionEvidence?.length&&<details><summary>操作记录与依据</summary>{selected.executionEvidence.slice().reverse().map(entry=><p key={entry.eventId}><strong>{STATUS[entry.status]}</strong><br/>{entry.note}<br/><small>{new Date(entry.at).toLocaleString('zh-CN')}</small></p>)}</details>}
              </>:<p className="task-scope">任务中的货物仍未分配。比较方案后可逐柜查看实际几何与客户归属。</p>}</>}
          {inspector==='candidates'&&<>{preview?<><p className="task-scope">{preview.candidates[0]?.comparisonBasis}</p>{candidateGroups.map(c=><button className={`task-candidate ${c.members.some(member=>member.candidateId===candidateId)?'active':''}`} key={c.candidateId} onClick={()=>{setCandidateId(c.candidateId);setContainerId('');}}><strong>{c.actualLabel}</strong><span>{c.summary.containers} 柜 · 已分配 {c.summary.assigned}/{c.summary.total}</span><small>新增 {c.summary.addedContainers} 柜 · 移动原有货物 {c.summary.movedUnits} 件</small><small>{c.members.length>1?`${c.members.length} 种求解策略得到相同布局`:c.label}</small></button>)}
              {selectedCandidate&&<><h3>应用影响</h3>{selectedCandidate.impacts.length?selectedCandidate.impacts.map(item=><p key={item.containerId}>柜方案 v{item.previousPlanVersion} → v{item.planVersion}<br/>追加 {item.addedUnitIds.length} 件 · 移动 / 规格变化 {item.movedUnitIds.length} 件{!!item.removedUnitIds?.length&&<> · 移出 {item.removedUnitIds.length} 件</>}</p>):<p>新建 {selectedCandidate.summary.addedContainers} 个柜方案。</p>}
                <button className="task-primary task-apply" disabled={!!busy} onClick={()=>run('确认并保存新版本',async()=>{const value=await request(`/${task.taskId}/apply`,{baseRevision:preview.baseRevision,previewId:preview.previewId,candidateId});acceptTask(value);setHistory(await request(`/${task.taskId}/history`));setTasks(await request());})}>确认应用此候选</button>
                {!!visibleRejections.length&&<details><summary>拒绝依据 · {visibleRejections.length} 组</summary>{visibleRejections.map((r,i)=><p key={i}><strong>{r.typeId || shownTask.containers.find(c=>c.containerId===r.containerId)?.label} · {r.unitIds.length} 件</strong><br/>{r.reason}</p>)}</details>}</>}</>:<p className="task-scope">先比较柜型组合，或追加客户生成候选。应用前会显示影响，过期版本会被拒绝。</p>}</>}
          {inspector==='history'&&<><h2>任务版本</h2>{history.map(entry=><button className="task-version" key={entry.revision} onClick={()=>run('读取历史版本',async()=>{setHistorical(await request(`/${task.taskId}?revision=${entry.revision}`));setContainerId('');setPreview(null);})}><strong>v{entry.revision}</strong><span>{({CREATE:'建立任务',APPLY_PLAN:'应用柜型方案',APPEND_AND_APPLY:'追加客户并应用',CONTAINER_STATE:'更新执行记录',EVIDENCE_RECORD:'补录责任资料',EDIT_ROWS_AND_APPLY:'修改货物并应用分配'})[entry.action.type] || entry.action.type}</span><small>{new Date(entry.createdAt).toLocaleString('zh-CN')}</small></button>)}</>}
          <TaskAssistantPanel initialQuestion={entry.question} editOrder={evidenceTarget} taskId={task.taskId} input={{baseRevision:task.revision,revision:historical?.revision,previewId:preview?.previewId,candidateId:selectedCandidate?.candidateId,containerId:selected?.containerId,rowId:cargoRow?.rowId,unitId:cargoRow&&unit?.rowId!==cargoRow.rowId?undefined:unit?.cargoId,maximumContainers,operation:inspector==='assistant'&&!allCabinets&&![ROUTES.cargo,ROUTES.evidence,ROUTES.overview].includes(route)?operation:undefined}} tab={inspector} hidden={!['assistant','evidence'].includes(inspector)} onPause={()=>{machine?.pause();setSnapshot(machine?.getSnapshot());}}
            onSaved={value=>{acceptTask(value);request(`/${task.taskId}/history`).then(setHistory).catch(e=>setError(e.message));request().then(setTasks).catch(e=>setError(e.message));}}
            onPreview={value=>{setPreview(value);setCandidateId(value.candidates[0]?.candidateId||'');setHistorical(null);}}
            onAction={action=>{
              if(action.type==='OPEN_APPEND')openForm(true);
              else if(action.type==='COMPARE_CONTAINERS')run('比较柜型候选',()=>makePreview());
              else if(action.type==='VIEW_SPACE'){setAllCabinets(false);setMode('space');navigate(ROUTES.twin);}
              else if(action.type==='VIEW_READINESS')setInspector('evidence');
              else if(action.type==='VIEW_CANDIDATES')setInspector('candidates');
              else if(action.type==='FOCUS_CONTAINER'){focusContainer(action.targetId);navigate(ROUTES.twin);}
              else if(action.type==='FOCUS_UNIT'){setAllCabinets(false);setSelectedUnitId(action.targetId);setInspector('properties');navigate(ROUTES.twin);}
            }}/>
        </aside>
      </div></>}
    {!task&&<div className="task-welcome"><strong>一票货，可以有多只柜、多个客户。</strong><p>货物数量展开成唯一实物件，柜型比较来自三维求解。草案、确认、已装入与封柜各自保存。</p><button className="task-primary" onClick={()=>openForm(false)}>创建装载任务</button></div>}
    {form&&<OrderForm value={form} setValue={setForm} session={session} busy={busy} error={error} onClose={()=>{previewRequest.current?.abort();setForm(null);}} onSubmit={()=>run(form.edit?'计算修改后的分配':form.append?'计算追加客户候选':'创建装载任务',async()=>{if(form.edit){await makePreview(null,[{rowId:form.rowId,patch:form.rows[0]}]);navigate(ROUTES.strategy);return;}if(form.append){await makePreview(form);navigate(ROUTES.strategy);return;}const value=await request('',form);acceptTask(value);setForm(null);setTasks(await request());setHistory(await request(`/${value.taskId}/history`));})}/>} 
    {record&&<div className="task-modal-backdrop"><section className="task-record" role="dialog" aria-modal="true" aria-label={record.seal?'记录封柜':'记录装入'}><h2>{record.seal?'记录此柜已封闭':'选择已装入的实物件'}</h2><p>这是操作员执行记录。三维回放不会自动生成实际装入记录。封柜后不能追加或移动货物。</p>{error&&<p role="alert" className="task-alert">{error}</p>}{!record.seal&&<><button onClick={()=>setRecord({...record,unitIds:selected.plan.loadedCargo.map(p=>p.cargoId)})}>选择此柜全部货物</button><div className="task-record-list">{selected.plan.loadedCargo.map(p=><label key={p.cargoId}><input type="checkbox" checked={record.unitIds.includes(p.cargoId)||selected.lockedUnitIds.includes(p.cargoId)} disabled={selected.lockedUnitIds.includes(p.cargoId)} onChange={e=>setRecord({...record,unitIds:e.target.checked?[...record.unitIds,p.cargoId]:record.unitIds.filter(id=>id!==p.cargoId)})}/>{p.customerName} · {p.name} #{p.unitIndex}</label>)}</div></>}<label className="task-record-note">记录依据 / 备注<input aria-label="执行记录依据" value={record.note||''} maxLength={500} placeholder="现场单号、责任记录或本次测试说明" onChange={e=>setRecord({...record,note:e.target.value})}/></label><footer><button onClick={()=>setRecord(null)}>取消</button><button className="task-primary" disabled={!!busy||(!record.seal&&!record.unitIds.length)} onClick={()=>run('保存执行记录',()=>stateChange(record.seal?'SEALED':'LOADED_LOCKED',record.unitIds))}>确认记录</button></footer></section></div>}
  </section>;
}

function OrderForm({value,setValue,session,busy,error,onClose,onSubmit}) {
  const [preset,setPreset]=useState('multi');
  const [csvError,setCsvError]=useState('');
  const update=(key,v)=>setValue({...value,[key]:v});
  const updateRow=(index,key,v)=>update('rows',value.rows.map((r,i)=>i===index?{...r,[key]:v,...(key==='packagingType'&&v==='FIBC_BAG'?{stackable:false,maxStackLayers:1}:{}),packagingProfile:undefined,cargoPhysicalProfile:undefined}:r));
  const choosePreset = key => {
    setPreset(key);
    if (key==='current') return setValue({...value,rows:copy(session.cargo),source:'USER_INPUT_COPY',name:`${session.order.orderNo} · 多柜副本`});
    if (['original','worksite'].includes(key)) {
      const selected = key==='original'?SCENARIO_TEMPLATES.find(s=>s.id==='competition-a'):SCENARIO_TEMPLATES[0];
      return setValue({...value,name:selected.label,orderReference:selected.orderNo,rows:copy(selected.items),transportModel:'MULTI_STOP_DEMO',source:'DEMO_PRESET'});
    }
    setValue({...value,name:key==='incompatible'?'不可拼柜反例':key==='compatible'?'追加客户拼柜示例':'单客户多柜示例',customerName:value.append?'客户乙':'客户甲',orderReference:value.append?'ORDER-B':'ORDER-A',
      service:{...service,...(value.append&&key==='incompatible'?{serviceId:'DEMO-NB-RTM',destination:'RTM',strippingPoint:'RTM-CFS'}:{})},transportModel:'OCEAN_LCL',
      rows:[{...baseRow,...(value.append?{quantity:2,length:1000,width:900,height:1100,weight:180,sku:'PALLET-B'}:{})}],source:'DEMO_PRESET'});
  };
  const readCsv=async file=>{if(!file)return;const parsed=previewCargoCsv(await file.text());if(parsed.fatalErrors.length||parsed.summary.invalid){setCsvError([...parsed.fatalErrors,`${parsed.summary.invalid} 行数据有误，请修正后导入`].join('；'));return;}setCsvError('');update('rows',parsed.rows.map(r=>r.cargo));};
  return <div className="task-modal-backdrop"><form className="task-order-form" role="dialog" aria-modal="true" aria-label={value.edit?'修改货物行':value.append?'追加客户货物':'新建装载任务'} onSubmit={e=>{e.preventDefault();onSubmit();}}><header><div><h2>{value.edit?'修改货物行':value.append?'追加客户货物':'新建装载任务'}</h2><p>{value.edit?'保留客户、订单和已有实物件身份；先预览重排与未分配影响，确认后保存新版本。':value.append?'先计算可装子集、影响与未分配明细，确认后写入当前任务。':'将新建独立任务；现有任务和原始单柜输入都会保留。'}</p></div><button type="button" onClick={onClose}>关闭</button></header>
    {!value.edit&&<div className="task-form-preset"><label>可编辑预设<select value={preset} onChange={e=>choosePreset(e.target.value)}><option value="multi">单客户多柜</option><option value="compatible">追加客户可拼柜</option><option value="incompatible">无法拼柜反例（追加时使用不同服务）</option>{!value.append&&<><option value="original">原始 212 件复杂案例</option><option value="worksite">42 件作业案例</option><option value="current">当前单柜货物的副本</option></>}</select></label><label className="task-file">导入 CSV<input type="file" accept=".csv,text/csv" onChange={e=>readCsv(e.target.files?.[0])}/></label><button type="button" onClick={()=>downloadTextFile({filename:'货物导入模板.csv',content:buildInputCargoCsv([baseRow]),mimeType:'text/csv;charset=utf-8'})}>CSV 模板</button></div>}
    {error&&<p role="alert" className="task-alert">{error}</p>}{csvError&&<p role="alert" className="task-alert">{csvError}</p>}{!value.edit&&<div className="task-form-fields">{!value.append&&<label>任务名称<input required value={value.name} onChange={e=>update('name',e.target.value)}/></label>}<label>客户名称<input required value={value.customerName} onChange={e=>update('customerName',e.target.value)}/></label><label>订单号<input required value={value.orderReference} onChange={e=>update('orderReference',e.target.value)}/></label><label>运输模式<select value={value.transportModel} disabled={value.append} onChange={e=>update('transportModel',e.target.value)}><option value="OCEAN_LCL">海运共同服务，目的地统一拆箱</option><option value="MULTI_STOP_DEMO">多站点卸货演示</option></select></label>
      {[['serviceId','运输服务'],['destination','目的地'],['strippingPoint','拆箱点'],['windowStart','时窗开始'],['windowEnd','时窗结束']].map(([key,label])=><label key={key}>{label}<input required type={key.startsWith('window')?'date':'text'} value={value.service[key]} onChange={e=>update('service',{...value.service,[key]:e.target.value})}/></label>)}<label>混装政策<select value={value.mixPolicy||'ALLOW'} onChange={e=>update('mixPolicy',e.target.value)}><option value="ALLOW">按服务与货物相容性混装</option><option value="SAME_CUSTOMER">仅同客户</option><option value="SEPARATE">此订单独立装柜</option></select></label></div>}
    <div className="task-row-table"><table><thead><tr>{['名称 / SKU','包装','长 / 宽 / 高 mm','单重 kg','数量','堆叠 / 朝向',''].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{value.rows.map((r,i)=><tr key={i}><td><input aria-label={`第${i+1}行名称`} required value={r.name} onChange={e=>updateRow(i,'name',e.target.value)}/><input aria-label={`第${i+1}行SKU`} value={r.sku||''} onChange={e=>updateRow(i,'sku',e.target.value)}/></td><td><select aria-label={`第${i+1}行包装`} value={canonicalPackagingType(r.packagingType)} onChange={e=>updateRow(i,'packagingType',e.target.value)}>{PACKAGING_TYPES.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></td><td className="task-dimensions">{['length','width','height'].map(key=><input key={key} aria-label={`第${i+1}行${{length:'长',width:'宽',height:'高'}[key]}`} type="number" min="1" step="any" required value={r[key]} onChange={e=>updateRow(i,key,Number(e.target.value))}/>)}</td><td><input aria-label={`第${i+1}行单重`} type="number" min=".001" step="any" required value={r.weight} onChange={e=>updateRow(i,'weight',Number(e.target.value))}/></td><td><input aria-label={`第${i+1}行数量`} type="number" min="1" step="1" required value={r.quantity} onChange={e=>updateRow(i,'quantity',Number(e.target.value))}/></td><td><label className="task-check"><input type="checkbox" checked={r.stackable!==false} onChange={e=>updateRow(i,'stackable',e.target.checked)}/>可堆叠</label><input aria-label={`第${i+1}行最大层数`} type="number" min="1" value={r.maxStackLayers||1} onChange={e=>updateRow(i,'maxStackLayers',Number(e.target.value))}/><label className="task-check"><input type="checkbox" checked={r.canRotate!==false} onChange={e=>updateRow(i,'canRotate',e.target.checked)}/>水平旋转</label><details><summary>更多约束</summary><ForkInterfaceFields value={r} onChange={(key,val)=>updateRow(i,key,val)}/><label className="task-check"><input type="checkbox" checked={r.fragile===true} onChange={e=>updateRow(i,'fragile',e.target.checked)}/>易碎禁压</label><label className="task-check"><input type="checkbox" checked={r.canLayFlat===true} onChange={e=>updateRow(i,'canLayFlat',e.target.checked)}/>允许平放</label><label>承重上限 kg<input type="number" min="0" value={r.maximumSupportedWeightKg??''} onChange={e=>updateRow(i,'maximumSupportedWeightKg',e.target.value?Number(e.target.value):null)}/></label><label>相容货类<input value={r.compatibilityGroup||'GENERAL'} onChange={e=>updateRow(i,'compatibilityGroup',e.target.value)}/></label><label>不相容货类（逗号分隔）<input value={(r.incompatibleGroups||[]).join(',')} onChange={e=>updateRow(i,'incompatibleGroups',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))}/></label><label>搬运方式<select value={r.handlingMethod||'forklift'} onChange={e=>updateRow(i,'handlingMethod',e.target.value)}><option value="manual">人工</option><option value="team_manual">双人</option><option value="forklift">叉车 / 地牛工艺</option></select></label></details></td><td><button type="button" disabled={value.rows.length===1} onClick={()=>update('rows',value.rows.filter((_,index)=>index!==i))}>移除</button></td></tr>)}</tbody></table></div>
    <footer>{!value.edit&&<button type="button" onClick={()=>update('rows',[...value.rows,{...baseRow,name:'新货物',sku:'',quantity:1}])}>增加货物行</button>}<span>{value.rows.length} 行 · {pieces(value.rows)} 件</span><button className="task-primary" disabled={!!busy} type="submit">{value.edit?'预览修改影响':value.append?'预览追加候选':'创建独立任务'}</button></footer>
  </form></div>;
}


