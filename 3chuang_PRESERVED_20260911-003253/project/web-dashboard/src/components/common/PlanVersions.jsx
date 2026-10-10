import { placementSpaceEvidence } from '../../domain/plan/placementSpaceEvidence.js';

export function PlanVersions({ plan, history = [] }) {
  if (!plan?.planId && !history.length) return null;
  const previous = [...history].reverse();
  const compact = plan?.constraintMeta?.endGapCompaction;
  const lane = plan?.constraintMeta?.laneStackRepacking;
  const comparison = lane?.comparison;
  const m3 = value => `${(Number(value || 0) / 1e9).toFixed(5)} m³`;
  const entries = [...(plan?.planId ? [{ plan, current: true }] : []), ...previous];
  const download = entry => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `PORTCUBE-${entry.plan.planId}.json`; anchor.click();
    URL.revokeObjectURL(url);
  };
  return <details className="plan-versions">
    <summary>方案版本与变更对照 <span>{plan?.placementHash || '当前为预览'}</span></summary>
    <div className="plan-versions__content">
      {comparison ? <section aria-label="同输入布局重排对照">
        <p>本轮对完整支撑货垛进行了 {lane.cumulativeMoves?.length || 0} 步累计重排。以下两列均按当前规则重评，货物尺寸、重量和数量未变。</p>
        <div className="table-scroll"><table><thead><tr><th>同口径指标</th><th>重排前</th><th>当前方案</th></tr></thead><tbody>
          <tr><td>深端净距</td><td>{comparison.previousGapMm.toFixed(3)} mm</td><td>{comparison.gapMm.toFixed(3)} mm</td></tr>
          <tr><td>内部空区 · 边界积分</td><td>{m3(comparison.oldExact.internalVoidVolume)}</td><td>{m3(comparison.nextExact.internalVoidVolume)}</td></tr>
          <tr><td>其中禁压货物上方</td><td>{m3(comparison.oldExact.nonStackableHeadspaceVolume)}</td><td>{m3(comparison.nextExact.nonStackableHeadspaceVolume)}</td></tr>
          <tr><td>其余内部空区</td><td>{m3(comparison.oldExact.unexplainedVoidVolume)}</td><td>{m3(comparison.nextExact.unexplainedVoidVolume)}</td></tr>
        </tbody></table></div>
        <p>按实际货物边界分段计算空区，禁压体积只扣除对应货物上方的真实空柱。分类和空间位置变化不计作新增装货容量；剩余深端空间仍需进一步优化及系固设计。</p>
        <details><summary>网格估算与精确几何的区别</summary><p>原网格法内部空区：{m3(comparison.voxelEstimates.oldInternal)} → {m3(comparison.voxelEstimates.newInternal)}。网格边缘取整及空区连通形状会影响估算和分类，完整原值仍保存在快照中。</p></details>
      </section> : compact && <p>深端 {compact.previousDeepGapMm} → {compact.deepGapMm} mm。{compact.limitation}</p>}
      <div className="table-scroll"><table><thead><tr><th>版本 / 来源</th><th>摆放哈希</th><th>深端净距</th><th>纵向偏移</th><th>件数</th><th>方案</th></tr></thead><tbody>{entries.map(entry => {
        const item=entry.plan;
        const gap=placementSpaceEvidence(item).zones.find(zone=>zone.id==='SPACE-DEEP-END')?.gapMm ?? 0;
        return <tr key={item.planId}><td>{entry.current?'当前':'已保留'} · {item.planId}<small>正式求解 · {item.constraintMeta?.solverRevision || item.metrics?.solverVersion || item.ext_algorithmId}</small></td><td className="mono">{item.placementHash}</td><td>{gap.toFixed(1)} mm</td><td>{Number(item.cogOffset?.longitudinal ?? item.metrics?.cog?.longitudinal).toFixed(3)}%<small>{item.constraintMeta?.cogNormalization === 'CARGO_COG_FULL_INNER_SPAN_V1' ? '全内长口径' : '旧版保存口径'}</small></td><td>{item.loadedCargo?.length} 件</td><td><button type="button" className="button button--secondary button--small" onClick={()=>download(entry)}>下载完整快照</button></td></tr>;
      })}</tbody></table></div>
      <p>历史方案保留原坐标和原分析口径；新版禁压空间分类的变化不表示增加了货物体积，也不构成现场出运确认。</p>
    </div>
  </details>;
}
