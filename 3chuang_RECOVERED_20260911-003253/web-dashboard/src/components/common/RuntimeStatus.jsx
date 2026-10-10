import { useEffect, useState } from 'react';
import { apiRequest, unwrapApiData } from '../../services/apiClient.js';
import './runtimeStatus.css';

export default function RuntimeStatus() {
  const [state, setState] = useState(null);
  const [aiVerified, setAiVerified] = useState(false);
  useEffect(() => {
    const verified = () => setAiVerified(true);
    window.addEventListener('portcube:ai-call-verified', verified);
    return () => window.removeEventListener('portcube:ai-call-verified', verified);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/api/capabilities', { signal: controller.signal }, { timeoutMs: 4000 })
      .then(data => setState(unwrapApiData(data)))
      .catch(error => { if (!controller.signal.aborted) setState({ unavailable: error.reason || 'network' }); });
    return () => controller.abort();
  }, []);
  return <aside className="runtime-status" aria-label="运行能力状态" data-api-state={state?.unavailable ? 'unavailable' : state ? 'available' : 'checking'}>
    <span><i className={state?.unavailable ? 'runtime-status__warning' : ''} />{!state ? '正在连接求解服务' : state.unavailable ? '求解服务未连接' : '本机求解服务已连接'}</span>
    <span>{!state || state.unavailable ? '存储状态待核实' : state.database?.status === 'CONNECTED' ? '数据库已连接' : '数据库不可用 · 当前工作区保存在本机浏览器'}</span>
    <span>{!state || state.unavailable ? 'AI 状态待核实' : state.ai?.status === 'NOT_CONFIGURED' ? 'AI 未配置 · 可查看规则证据' : aiVerified ? 'AI 已配置 · 本次会话调用成功' : 'AI 已配置 · 调用待验证'}</span>
  </aside>;
}
