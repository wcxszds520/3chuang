import { useState } from 'react';

const LABELS = { unchanged: '位置保留', moved: '位置移动', removed: '不再装入', added: '新增装入', orientation_changed: '方向改变' };
const coordinates = item => item ? `${item.x ?? '—'} / ${item.y ?? '—'} / ${item.z ?? '—'} mm` : '—';

export function PlanDiff({ diff, onSelect }) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  if (!diff?.entries) return null;
  const visible = showUnchanged ? diff.entries : diff.entries.filter(item => item.status !== 'unchanged' || item.resized);
  return <section className="plan-diff" aria-label="新旧方案逐件对照" data-testid="plan-diff">
    <header><div><span className="decision-label">变更复核</span><h2>本次重规划改变了什么</h2><p>按货物身份核对位置和方向；每一项都可追溯到前后方案。</p></div><span className="plan-diff__identity">{diff.previousPlanId} → {diff.planId}</span></header>
    <div className="plan-diff__counts">{Object.entries(LABELS).map(([key, label]) => <div key={key} data-diff-status={key}><strong>{diff.counts?.[key] ?? 0}</strong><span>{label}</span></div>)}</div>
    {diff.counts?.resized > 0 && <p>{diff.counts.resized} 件运输外形尺寸发生变化，可能与移动或方向变化重叠。</p>}
    <details><summary>查看逐件变化与原因 · {visible.length} 件</summary><label className="plan-diff__filter"><input type="checkbox" checked={showUnchanged} onChange={event => setShowUnchanged(event.target.checked)} />同时显示保留原位的货物</label>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>货物</th><th>变化</th><th>旧位置 x / y / z</th><th>新位置 x / y / z</th><th>原因</th></tr></thead><tbody>{visible.map(entry => <tr key={entry.cargoId}><td>{onSelect ? <button className="button button--quiet button--small" type="button" onClick={() => onSelect(entry)}>{entry.name}</button> : entry.name}<small>{entry.cargoId}</small></td><td>{LABELS[entry.status]}{entry.orientationChanged && entry.moved ? ' · 同时移动' : ''}</td><td>{coordinates(entry.before)}</td><td>{coordinates(entry.after)}</td><td>{entry.reason}</td></tr>)}</tbody></table></div>
      {!visible.length && <p>所有已装货物的位置与方向均保持不变。</p>}
    </details>
  </section>;
}

export function PlanStateNotice({ session, onReplan }) {
  if (!session.stalePlan) return null;
  return <section className="plan-stale-notice" role="status" data-testid="plan-stale-notice"><div><strong>原方案已失效，需要重新规划</strong><p>{session.staleReason || '输入已变更。'} 原版货位和证据保留用于对照，出运结论等待重新计算。</p><small>原方案 {session.stalePlan.planId}</small></div>{onReplan && <button type="button" className="button button--primary" disabled={session.planStatus === 'loading'} onClick={onReplan}>{session.planStatus === 'loading' ? '正在重新规划…' : '保留可用货位，重新规划'}</button>}</section>;
}
