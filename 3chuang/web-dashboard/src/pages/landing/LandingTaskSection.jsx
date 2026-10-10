import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {apiRequest,unwrapApiData} from '../../services/apiClient.js';
import {buildVisualizationContext} from '../../three/analytics/visualizationModes.js';
import {ROUTES} from '../../app/router.js';
import './landingTaskSection.css';

const Overview=lazy(()=>import('../../three/TaskOverviewScene.jsx'));
export function useLandingTask(){
  const [state,setState]=useState({task:null,error:''});
  useEffect(()=>{
    const controller=new AbortController(),id=localStorage.getItem('portcube.loadTaskId');
    if(!id)return;
    apiRequest(`/api/load-tasks/${id}`,{signal:controller.signal}).then(unwrapApiData).then(task=>setState({task,error:''})).catch(e=>{if(!controller.signal.aborted)setState({task:null,error:e.message});});
    return()=>controller.abort();
  },[]);
  return state;
}
export function openLandingTask(navigate,task,entry={}){
  if(task)localStorage.setItem('portcube.loadTaskId',task.taskId);
  sessionStorage.setItem('portcube.task-entry',JSON.stringify(entry));
  navigate(ROUTES.tasks);
}
export default function LandingTaskSection({task,error,navigate}){
  const host=useRef(null),[near,setNear]=useState(false),[sceneError,setSceneError]=useState('');
  const colors=useMemo(()=>buildVisualizationContext(task?.units||[]).ownerColors,[task]);
  useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setNear(true);observer.disconnect();}},{rootMargin:'350px'});if(host.current)observer.observe(host.current);return()=>observer.disconnect();},[]);
  return <section className="pc-section pc-task-section" id="consolidation" ref={host}><div className="pc-grid">
    <header className="pc-task-heading"><div><span className="pc-index">多客户 · 多柜协同</span><h2>每位客户的货，<br/>都有清楚的去向。</h2><p>保留逐件身份与客户归属，比较真实柜型组合。追加一票货物后，先看哪些柜会变化，再确认新的分配。</p></div><button className="pc-button pc-button--primary" onClick={()=>openLandingTask(navigate,task)}>进入拼柜工作台 →</button></header>
    {task?<><div className="pc-task-summary"><strong>{task.name} · v{task.revision}</strong><span>{task.customers.length} 位客户</span><span>{task.orders.length} 票订单</span><span>{task.containers.length} 柜</span><span>{task.units.length-task.unassigned.length}/{task.units.length} 件已规划</span></div>
      <div className="pc-task-stage">{sceneError?<p role="alert">三维场景未能载入：{sceneError}</p>:task.containers.length&&near?<Suspense fallback={<p>正在载入真实柜位…</p>}><Overview containers={task.containers} ownerColors={colors} ownerMode onError={setSceneError} onFocus={containerId=>openLandingTask(navigate,task,{containerId})}/></Suspense>:<p>{task.containers.length?'滚动接近后载入可操作柜位':'这票任务尚未分柜，进入工作台比较方案。'}</p>}</div>
      <div className="pc-task-owners">{task.customers.map(c=><span key={c.customerId}><i style={{background:colors[c.customerId]}}/>{c.name} · {task.units.filter(u=>u.customerId===c.customerId).length} 件</span>)}</div>
    </>:<p className="pc-task-empty">{error?'当前任务暂未载入，可在工作台重试。':'从客户、订单和货物清单开始，建立第一票装载任务。'}</p>}
    <div className="pc-task-steps"><p><b>01 · 比较</b>逐柜校验尺寸、重量、支撑与服务相容性。</p><p><b>02 · 确认</b>显示新增柜、移动件与未分配件，确认后保存版本。</p><p><b>03 · 执行</b>锁定已记录装入的位置，按柜整理责任资料。</p></div>
  </div></section>;
}
