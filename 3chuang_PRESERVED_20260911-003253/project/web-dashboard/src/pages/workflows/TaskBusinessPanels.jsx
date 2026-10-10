import { useEffect, useMemo, useState } from 'react';
import { PACKAGING_TYPES } from '../../domain/cargo/cargo.js';
import { classifyCargoAppearance } from '../../domain/cargo/appearance.js';
import PackagingModelViewer from '../../three/PackagingModelViewer.jsx';
import { apiRequest, unwrapApiData } from '../../services/apiClient.js';

export function TaskCargoPanel({task,readOnly,onEdit,onAppend,rowId,onSelectRow}){
  const row=task.rows.find(r=>r.rowId===rowId)||task.rows[0];
  const locked=row&&task.containers.some(c=>(c.status==='SEALED'||c.lockedUnitIds.length)&&c.plan.loadedCargo.some(p=>p.rowId===row.rowId));
  const appearance=row?classifyCargoAppearance(row):null;
  return <div className="task-business-panel task-cargo-panel"><header><div><span>货物与包装</span><h2>{task.customers.length} 位客户 · {task.orders.length} 票订单</h2><p>选择货物行查看包装与约束，修改后先比较新分配。</p></div><button onClick={onAppend} disabled={readOnly}>追加客户货物</button></header>
    {row&&<section className="task-cargo-preview"><div className="task-cargo-model"><PackagingModelViewer appearanceKey={appearance.key} label={appearance.label} cargo={row}/></div><div><strong>{row.name}</strong><p>{PACKAGING_TYPES.find(([key])=>key===row.packagingType)?.[1]||appearance.label}</p><dl><dt>实际包络</dt><dd>{row.length} × {row.width} × {row.height} mm</dd><dt>单重 / 数量</dt><dd>{row.weight} kg · {row.quantity} 件</dd><dt>作业与堆叠</dt><dd>{row.handlingMethod==='manual'?'人工':row.handlingMethod==='team_manual'?'双人搬运':'叉车 / 地牛工艺'} · {row.stackable===false?'不可堆叠':`最多 ${row.maxStackLayers||1} 层`}</dd></dl><button className="task-primary" disabled={readOnly||locked} onClick={()=>onEdit(row)}>编辑这行货物</button>{locked&&<p className="task-scope">所在柜含已记录装入件，整行编辑已锁定；仍可追加独立货物。</p>}</div></section>}
    {task.orders.map(order=><section className="task-order-group" key={order.orderId}><h3>{task.customers.find(c=>c.customerId===order.customerId)?.name} <small>{order.reference} · {order.service.destination}</small></h3><table><thead><tr><th>名称 / 包装</th><th>长 × 宽 × 高 mm</th><th>单重 kg</th><th>件数</th><th>分柜</th></tr></thead><tbody>{task.rows.filter(r=>r.orderId===order.orderId).map(r=><tr className={r.rowId===row?.rowId?'active':''} key={r.rowId}><td><button onClick={()=>onSelectRow(r.rowId)}>{r.name}</button><small>{PACKAGING_TYPES.find(([key])=>key===r.packagingType)?.[1]||r.packagingType}</small></td><td>{r.length} × {r.width} × {r.height}</td><td>{r.weight}</td><td>{r.quantity}</td><td>{task.containers.map(c=>({label:c.label,count:c.plan.loadedCargo.filter(p=>p.rowId===r.rowId).length})).filter(c=>c.count).map(c=>`${c.label} ${c.count}件`).join(' / ')||'待分配'}</td></tr>)}</tbody></table></section>)}
  </div>;
}

export function TaskDecisionSummary({task,onPlan,onEvidence}){
  const assigned=task.units.length-task.unassigned.length,locked=task.containers.reduce((sum,c)=>sum+c.lockedUnitIds.length,0);
  return <section className="task-decision-summary"><div><span>当前可行动决策</span><h2>{task.unassigned.length?'为剩余货物比较柜型组合':'分配已保存，核对作业与出运资料'}</h2><p>{task.customers.length} 位客户 / {task.orders.length} 票订单 · {task.containers.length} 柜 · {assigned}/{task.units.length} 件已规划 · {locked} 件有操作记录</p></div><button className="task-primary" onClick={task.unassigned.length?onPlan:onEvidence}>{task.unassigned.length?'比较柜型与分配':'核对逐柜资料'}</button></section>;
}

export function TaskReadinessPanel({task,input,onContainer,onEditEvidence}){
  const [result,setResult]=useState(null),[error,setError]=useState('');
  const body=useMemo(()=>({baseRevision:input.baseRevision,revision:input.revision,previewId:input.previewId,candidateId:input.candidateId}),[input.baseRevision,input.revision,input.previewId,input.candidateId]);
  const key=JSON.stringify([task.taskId,body]);
  const context=result?.key===key?result.value:null;
  useEffect(()=>{const controller=new AbortController();setError('');apiRequest(`/api/load-tasks/${task.taskId}/context`,{method:'POST',body:JSON.stringify(body),signal:controller.signal}).then(unwrapApiData).then(value=>setResult({key,value})).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[task.taskId,key,body]);
  return <div className="task-business-panel task-readiness-panel"><header><div><span>出运准备</span><h2>逐柜事实与客户资料</h2><p>规划检查与现场确认分开记录；点击柜位在右侧查看条款和办理依据。</p></div></header>{error&&<p role="alert">{error}</p>}{!context?<p>正在读取当前版本的证据…</p>:<>
    {!context.readiness.length&&<p className="task-alert">当前尚未分柜，逐柜证据未生成。先比较柜型并保存分配。</p>}
    {context.readiness.map(cab=><article className="task-readiness-card" key={cab.containerId}><header><h3>{cab.label} · 方案 v{cab.planVersion}</h3><button onClick={()=>onContainer(cab.containerId)}>查看依据 / 补录资料</button></header><strong>{cab.pendingCount} 项需处理</strong>{cab.evidence.filter(e=>!['READY','NOT_APPLICABLE'].includes(e.status)).slice(0,3).map(e=><p key={e.id}><b>{e.title}</b><span>{e.summary}</span><small>{e.requiredAction}</small></p>)}<small>已通过项与完整官方来源见右侧资料检查器。</small></article>)}
    <h3>客户与订单资料</h3>{context.orderEvidence.map(order=><article className="task-readiness-card" key={order.orderId}><header><h3>{order.customerName} · {order.reference}</h3><span>{order.status==='DATA_REQUIRED'?'缺资料':'需责任方复核'}</span></header><p>{order.requiredAction}</p><dl><dt>装箱清单</dt><dd>{order.documents.packingListReference||'待托运人提供'}</dd><dt>货物声明</dt><dd>{order.documents.shipperDeclaration||'待托运人提供'}</dd></dl><button disabled={context.stage!=='SAVED_TASK'} onClick={()=>onEditEvidence(order.orderId)}>办理客户资料</button></article>)}
  </>}</div>;
}
