import { placementSpaceEvidence } from '../../domain/plan/placementSpaceEvidence.js';
import { formatPlanMetric } from '../../domain/plan/activePlanViewModel.js';

export function PlanVersions({ plan, history = [], revisions = [] }) {
  if (!plan?.planId && !history.length) return null;
  const previous = [...history].reverse();
  const compact = plan?.constraintMeta?.endGapCompaction;
  const entries = [...(plan?.planId ? [{ plan, current: true }] : []), ...previous.filter(entry => entry.plan.planId !== plan?.planId)];
  const download = entry => {
    const revision = revisions.findLast(item => item.planId === entry.plan.planId);
    const url = URL.createObjectURL(new Blob([JSON.stringify(revision || entry, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `PORTCUBE-${entry.plan.planId}.json`; anchor.click();
    URL.revokeObjectURL(url);
  };
  return <details className="plan-versions">
    <summary>方案版本与变更对照 <span>{plan?.placementHash || '当前为预览'}</span></summary>
    <div className="plan-versions__content">
      {compact && <p>深端 {compact.previousDeepGapMm} → {compact.deepGapMm} mm。{compact.limitation}</p>}
      <div className="table-scroll"><table><thead><tr><th>版本 / 来源</th><th>摆放哈希</th><th>深端净距</th><th>纵向偏移</th><th>件数</th><th>方案</th></tr></thead><tbody>{entries.map(entry => {
        const item=entry.plan;
        const gap=placementSpaceEvidence(item).zones.find(zone=>zone.id==='SPACE-DEEP-END')?.gapMm;
        return <tr key={item.planId}><td>{entry.current?'当前':'已保留'} · {item.planId}<small>计算装载 · {item.constraintMeta?.solverRevision || item.metrics?.solverVersion || item.ext_algorithmId}</small></td><td className="mono">{item.placementHash || '—'}</td><td>{formatPlanMetric(gap, { decimals: 1, suffix: ' mm' })}</td><td>{formatPlanMetric(item.cogOffset?.longitudinal ?? item.metrics?.cog?.longitudinal, { decimals: 3, suffix: '%' })}</td><td>{item.loadedCargo?.length ?? '—'} 件</td><td><button type="button" className="button button--secondary button--small" onClick={()=>download(entry)}>下载完整快照</button></td></tr>;
      })}</tbody></table></div>
      <p>历史方案保留原坐标和原分析口径；新版禁压空间分类的变化不表示增加了货物体积，也不构成现场出运确认。</p>
    </div>
  </details>;
}
