import {useState} from 'react';
import {useSession} from '../../app/session/SessionProvider.jsx';
import {SESSION_ACTIONS} from '../../app/session/sessionReducer.js';
import {createInitialSession} from '../../domain/session/initialSession.js';
import {normalizeCargo} from '../../domain/cargo/cargo.js';
import {COMMERCE_ORDER} from '../../../../shared/commerceOrder.mjs';
import {orderKey} from '../../../../shared/commerceBusiness.mjs';
import {PACKAGING_CATALOG,configurePackaging,FREIGHT_RULES} from '../../../../shared/commercePackaging.mjs';
import {apiRequest,unwrapApiData} from '../../services/apiClient.js';
import '../../styles/commerce.css';

export default function CommercePanel({compact=false}){
 const {session,dispatch,actions}=useSession();const [open,setOpen]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const enabled=session.caseContext?.commerce?.enabled;
 const times=[...new Set([...session.cargo.map(c=>c.arrivedAt).filter(Boolean),session.caseContext?.commerce?.planAt].filter(Boolean))].sort();
 const labels={carton:'常规箱',tall_carton:'高身箱',flat_carton:'扁平箱',long_carton:'长条箱'};
 const [businessOpen,setBusinessOpen]=useState(false);
 const updateBusiness=(id,patch)=>dispatch({type:SESSION_ACTIONS.CONFIGURE_PACKAGING,cargo:session.cargo.map(c=>c.cargoId===id?{...c,...patch}:c)});
 const orders=[...new Map(session.cargo.filter(c=>c.orderId&&c.customerId).map(c=>[orderKey(c),c])).values()];
 const updateOrder=(row,patch)=>dispatch({type:SESSION_ACTIONS.CONFIGURE_PACKAGING,cargo:session.cargo.map(c=>orderKey(c)===orderKey(row)?{...c,...patch}:c)});
 const enableBusiness=()=>actions.setCaseContext({commerce:{...session.caseContext?.commerce,enabled:true,lifo:true,planAt:new Date().toISOString(),unloadScope:'DESTINATION_WAREHOUSE_HANDOVER'}});const audit=session.backendPlan?.businessAudit;
 const [template,setTemplate]=useState('carton'),[dimensions,setDimensions]=useState('600,400,400'),[target,setTarget]=useState('');
 const applyOrder=()=>{
  const base=createInitialSession({dataset:'legacy'});base.cargo=COMMERCE_ORDER.items.map(normalizeCargo);base.order={...base.order,orderNo:COMMERCE_ORDER.orderNo,route:COMMERCE_ORDER.route.join(' → '),source:'configured-order'};
  base.selectedContainerType='40HQ';base.caseContext={...structuredClone(COMMERCE_ORDER.caseContext),caseDate:'2026-09-16',orderNo:COMMERCE_ORDER.orderNo,route:[{portSequence:1,portCode:'HAM',name:'汉堡'}]};base.datasetId=COMMERCE_ORDER.id;base.dataSource={...base.dataSource,order:'跨境集拼货单',cargo:'跨境集拼货单 · 16 SKU / 17 行'};
  base.planHistory=[...(session.planHistory||[]),...(session.backendPlan?[{plan:session.backendPlan,cargoSnapshot:session.cargo,archivedAt:new Date().toISOString()}]:[])];
  dispatch({type:SESSION_ACTIONS.RESET,session:base});
 };
 const prepare=async()=>{
  setError('');try{
   const configured=[];for(const [i,raw] of session.cargo.entries()){
    const c=configurePackaging(raw);setBusy(`生成包装 ${i+1}/${session.cargo.length}`);
    const asset=unwrapApiData(await apiRequest('/api/packing/packaging/build',{method:'POST',body:JSON.stringify({template:c.packagingConfig.template,dimensionsMm:[c.length,c.width,c.height],title:c.name})},{timeoutMs:200000}));
    configured.push({...c,visualProfile:{...c.visualProfile,version:asset.version||'commerce-v4',assetId:asset.id}});
   }
   dispatch({type:SESSION_ACTIONS.CONFIGURE_PACKAGING,cargo:configured});
  }catch(e){setError(e.message);}finally{setBusy('');}
 };
 const build=async()=>{
  setError('');setBusy('Blender 正在生成结构');try{
   const dims=dimensions.split(/[,，x×\s]+/).map(Number);
   const asset=unwrapApiData(await apiRequest('/api/packing/packaging/build',{method:'POST',body:JSON.stringify({template,dimensionsMm:dims})},{timeoutMs:200000}));
   const row=session.cargo.find(c=>c.cargoId===target);if(row){
    if([row.length,row.width,row.height].some((v,i)=>v!==dims[i]))throw Error('模型已登记。应用到此货物时，外尺寸必须一致。');
    updateBusiness(row.cargoId,{packagingType:PACKAGING_CATALOG.find(p=>p.templates.includes(template)).id,packagingConfig:{version:'commerce-v4',template,outerDimensionsMm:dims},visualProfile:{version:asset.version||'commerce-v4',assetId:asset.id}});
   }
   setBusy('');setOpen(false);
  }catch(e){setError(e.message);setBusy('');}
 };
 return <section className="commerce-panel" aria-label="集拼与包装配置">
  <div className="commerce-toolbar"><strong>集拼与包装</strong>{!compact&&<><button className="button button--secondary button--small" onClick={applyOrder}>载入跨境混装订单</button><button className="button button--secondary button--small" onClick={()=>setOpen(!open)}>包装库 · {PACKAGING_CATALOG.length} 类</button><button className="button button--secondary button--small" disabled={!!busy} onClick={prepare}>匹配货物包装</button><button className="button button--secondary button--small" onClick={()=>{if(!enabled)enableBusiness();setBusinessOpen(!businessOpen);}}>货主与到仓批次</button></>}
   {enabled&&<label>到仓时点 <select aria-label="到仓时点" value={session.caseContext.commerce.planAt} onChange={e=>actions.setCaseContext({commerce:{...session.caseContext.commerce,planAt:e.target.value}})}>{times.map(t=><option key={t} value={t}>{new Date(t).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</option>)}</select></label>}
   {enabled&&(session.backendPlan?.loadedCargo?.length||session.caseContext.commerce.lockedPlacements?.length)>0&&<label><input type="checkbox" aria-label="保留已规划货位" checked={Boolean(session.caseContext.commerce.lockedPlacements?.length)} onChange={e=>actions.setCaseContext({commerce:{...session.caseContext.commerce,lockedPlacements:e.target.checked?structuredClone(session.backendPlan.loadedCargo):[]}})}/>保留已规划货位</label>}
  </div>
  {enabled&&<div className="commerce-facts"><span>{new Set(session.cargo.map(c=>c.sku)).size} 个 SKU · {new Set(session.cargo.map(c=>c.customerId).filter(Boolean)).size} 家货主</span><span>按海外仓交接组卸货</span><span>已到仓 {session.cargo.filter(c=>c.arrivedAt&&Date.parse(c.arrivedAt)<=Date.parse(session.caseContext.commerce.planAt)).reduce((s,c)=>s+c.quantity,0)} 件</span>{audit&&<><span>卸货组 {audit.lifoPass?'无交叉阻挡':'存在阻挡'}</span><span>SKU 分散块 {audit.extraClusterCount}</span><span>卸货顺序 {audit.unloadEvents.length} 件</span></>}</div>}
  {businessOpen&&<div className="commerce-business"><table><thead><tr><th>货物</th><th>货主</th><th>订单号</th><th>库存批号</th><th>到仓批次</th><th>到仓时间</th><th>卸货顺序</th></tr></thead><tbody>{session.cargo.map(c=><tr key={c.cargoId}><td>{c.name}<small>{c.sku}</small></td>{['customerId','orderId','lotId','arrivalBatchId','arrivedAt'].map(k=><td key={k}><input aria-label={`${c.cargoId} ${k}`} value={c[k]||''} placeholder={k==='arrivedAt'?'2026-09-16T09:00:00+08:00':'未录入'} onChange={e=>updateBusiness(c.cargoId,{[k]:e.target.value})}/></td>)}<td><input aria-label={`${c.cargoId} 卸货顺序`} type="number" min="1" value={c.unloadSequence||c.portSequence||1} onChange={e=>updateBusiness(c.cargoId,{unloadSequence:Number(e.target.value),unloadGroup:'HANDOVER-'+e.target.value})}/></td></tr>)}</tbody></table><p>同货主、同 SKU、同库存批号聚集；到仓批次独立记录。到仓时间未录入的货物暂不装入。</p></div>}
  {businessOpen&&orders.length>0&&<details className="commerce-order-policies" open><summary>订单交付要求</summary><div className="table-scroll"><table className="data-table"><thead><tr><th>货主 / 订单</th><th>本次必运</th><th>拆单许可</th><th>优先级</th></tr></thead><tbody>{orders.map(c=><tr key={orderKey(c)}><td>{c.customerName||c.customerId} / {c.orderId}</td><td><select aria-label={`${c.customerId} ${c.orderId} 本次必运`} value={c.required==null?'':String(c.required)} onChange={e=>updateOrder(c,{required:e.target.value===''?undefined:e.target.value==='true'})}><option value="">待确认</option><option value="true">是</option><option value="false">否</option></select></td><td><select aria-label={`${c.customerId} ${c.orderId} 拆单许可`} value={c.allowPartialShipment==null?'':String(c.allowPartialShipment)} onChange={e=>updateOrder(c,{allowPartialShipment:e.target.value===''?undefined:e.target.value==='true'})}><option value="">待确认</option><option value="false">整单交付</option><option value="true">允许拆单</option></select></td><td><select aria-label={`${c.customerId} ${c.orderId} 优先级`} value={c.shipmentPriority??0} onChange={e=>updateOrder(c,{shipmentPriority:Number(e.target.value)})}>{[0,1,2,3,4,5,6,7,8,9].map(n=><option key={n} value={n}>{n===0?'普通':`${n} 级`}</option>)}</select></td></tr>)}</tbody></table></div><p>同一订单统一设定；优先级用于必运订单之间的取舍，数值越大越优先。到仓与库存批号独立记录。</p></details>}
  {busy&&<p role="status">{busy}</p>}{error&&<p role="alert">{error}</p>}
  {open&&<div className="commerce-library"><div className="commerce-catalog">{PACKAGING_CATALOG.map(p=><div key={p.id}><strong>{p.label}</strong><span>{p.templates.map(t=>labels[t]||p.label).join(' / ')}</span></div>)}</div><div className="commerce-toolbar"><label>结构 <select aria-label="包装结构" value={template} onChange={e=>setTemplate(e.target.value)}>{PACKAGING_CATALOG.flatMap(p=>p.templates.filter(t=>t!=='custom').map(t=><option key={t} value={t}>{labels[t]||p.label}</option>))}</select></label><label>外尺寸 mm <input aria-label="包装外尺寸" value={dimensions} onChange={e=>setDimensions(e.target.value)}/></label><label>应用货物 <select aria-label="应用包装的货物" value={target} onChange={e=>setTarget(e.target.value)}><option value="">仅登记模型</option>{session.cargo.map(c=><option value={c.cargoId} key={c.cargoId}>{c.name} · {c.sku}</option>)}</select></label><button className="button button--primary button--small" disabled={!!busy} onClick={build}>生成并保存包装</button></div><p>包装外尺寸用于装箱；承重、方向与搬运条件由货物资料管理。专用异形包装需登记独立模型与接触面。</p></div>}
  {enabled&&<details><summary>运输规则与计算范围</summary><div className="commerce-rules">{FREIGHT_RULES.map(r=><a key={r.id} href={r.url} target="_blank" rel="noreferrer">{r.title}</a>)}</div><p>当前核对包装外形、承托、卸货组及到仓时点。设备完整运动路径、实际箱号、订舱截止时间、VGM 和系固资料分别核对。</p></details>}
 </section>;
}
