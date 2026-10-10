import { useEffect, useState } from 'react';
import { getPackingCase, listPackingCases } from '../../services/caseApi.js';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { SESSION_ACTIONS } from '../../app/session/sessionReducer.js';

export default function SavedCasePicker(){
  const {session,dispatch}=useSession();
  const [cases,setCases]=useState([]),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();listPackingCases({signal:controller.signal}).then(setCases).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[]);
  const open=async()=>{setBusy(true);setError('');try{const packingCase=await getPackingCase(selected);dispatch({type:SESSION_ACTIONS.OPEN_SAVED_CASE,packingCase});}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <section className="saved-case-picker" aria-label="已保存单柜案例"><div><strong>打开已保存案例</strong><small>读取原始货物、正式布局与资料；当前布局保留在本地方案历史中。</small></div><select aria-label="选择已保存案例" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">选择案例</option>{cases.map(item=><option key={item.caseId} value={item.caseId}>{item.caseId} · {item.containerType}{item.caseId===session.order.orderNo?' · 当前':''}</option>)}</select><button className="button button--secondary button--small" disabled={busy||!selected} onClick={open}>{busy?'正在读取…':'打开案例'}</button>{error&&<p role="alert">{error}</p>}</section>;
}
