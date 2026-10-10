import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Database, LoaderCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Dialog } from '../feedback/Overlays.jsx';
import {
  booleanLabel,
  datasetGroupLabel,
  externalClassificationLabel,
  externalFieldLabel,
  externalItemDisplayName,
  externalSourceName,
  externalStatusLabel,
  externalUnknownLabels,
  orientationDisplay,
  solverReadinessLabel,
  sourceAdvisory
} from '../../domain/cargo/externalDatasetDisplay.js';
import { DEFAULT_FREIGHT_PROFILE_ID, FREIGHT_BUSINESS_PROFILES } from '../../domain/cargo/externalBusinessContext.js';
import {externalCapabilities,sourceContainers,businessSimulationCapabilities} from '../../../../shared/externalCapabilities.mjs';
import { shouldShowFreightContext } from '../../domain/cargo/cargoTablePresentation.js';
import { createCargoPresentationProfile } from '../../domain/cargo/externalCargoPresentation.js';
import { resolveExternalVisualAsset } from '../../domain/presentation/curatedAssets.js';

function value(input, suffix = '', compact = false) {
  return input == null ? (compact ? '—' : '来源未提供') : `${Number(input).toLocaleString()}${suffix}`;
}

function pendingDescription(source) {
  if (source === 'atlas_copco') return '已确认论文与 Input50.csv 线索，但未获得真实数据文件；未根据论文统计生成实例。';
  if (source === 'beantech') return '已确认大学来源与历史数据站点，但未获得 117 个真实实例文件；未重建或伪造实例。';
  return '来源已确认，真实数据文件尚未取得。';
}

function itemConstraintSummary(item) {
  const details = [orientationDisplay(item.orientationConstraints)];
  if (item.stackingGroup != null) details.push(`堆叠分组：${item.stackingGroup}（当前仅验证同组）`);
  if (item.alwaysOnTop === true) details.push('必须位于上层');
  if (item.alwaysOnBottom === true) details.push('必须位于底层');
  if (item.loadBearingUnit) details.push(`按原始竖直轴承压：${item.loadBearingUnit}`);
  if (item.geometryAsset) details.push(`三维几何模型：${item.geometryAsset}`);
  return details.filter(Boolean).join('；');
}

function technicalValue(input) {
  if (input === true || input === false) return booleanLabel(input);
  if (input == null || input === '') return '来源未提供';
  if (Array.isArray(input)) return input.map(technicalValue).join('、');
  if (typeof input === 'object') return Object.entries(input).map(([key, value]) => `${externalFieldLabel(key)}：${technicalValue(value)}`).join('；');
  return String(input);
}

export default function ExternalDatasetBrowser({ open, onClose, onCreate }) {
  const [catalog, setCatalog] = useState(null);
  const [sourceId, setSourceId] = useState('');
  const [group, setGroup] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [instance, setInstance] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [businessOptions, setBusinessOptions] = useState({ profileId: DEFAULT_FREIGHT_PROFILE_ID, customerCount: 3, orderGroupCount: 3, unloadGroupCount: 3 });
  const [solverMode,setSolverMode]=useState('SOURCE_BENCHMARK');
  const [sourceContainerIndex,setSourceContainerIndex]=useState(0);

  useEffect(() => {
    if (!open || catalog) return;
    setStatus('loading');
    fetch('/data/external/catalog.json').then((response) => {
      if (!response.ok) throw new Error(`目录加载失败：HTTP ${response.status}`);
      return response.json();
    }).then((data) => {
      setCatalog(data);
      const first = data.datasets?.[0];
      setSourceId(first?.source || data.pending?.[0]?.source || '');
      setGroup(first?.instances?.[0]?.group || '');
      setStatus('ready');
    }).catch((reason) => { setError(reason.message); setStatus('error'); });
  }, [open, catalog]);

  const sources = useMemo(() => [...(catalog?.datasets || []), ...(catalog?.pending || [])], [catalog]);
  const dataset = useMemo(() => catalog?.datasets?.find((item) => item.source === sourceId), [catalog, sourceId]);
  const pending = useMemo(() => catalog?.pending?.find((item) => item.source === sourceId), [catalog, sourceId]);
  const groups = useMemo(() => [...new Set((dataset?.instances || []).map((item) => item.group))], [dataset]);
  const choices = useMemo(() => (dataset?.instances || []).filter((item) => item.group === group), [dataset, group]);
  const summary = choices.find((item) => item.id === instanceId) || choices[0];

  useEffect(() => {
    if (!dataset) { setGroup(''); setInstanceId(''); setInstance(null); return; }
    const nextGroup = groups.includes(group) ? group : groups[0] || '';
    if (nextGroup !== group) setGroup(nextGroup);
  }, [dataset, group, groups]);
  useEffect(() => {
    const nextId = choices.some((item) => item.id === instanceId) ? instanceId : choices[0]?.id || '';
    if (nextId !== instanceId) setInstanceId(nextId);
  }, [choices, instanceId]);
  useEffect(() => {
    if (!open || !summary?.instanceUrl) { setInstance(null); return; }
    let active = true;
    setStatus('loading-instance'); setError('');
    fetch(summary.instanceUrl).then((response) => {
      if (!response.ok) throw new Error(`实例加载失败：HTTP ${response.status}`);
      return response.json();
    }).then((data) => { if (active) { setInstance(data); setStatus('ready'); } }).catch((reason) => { if (active) { setError(reason.message); setStatus('error'); } });
    return () => { active = false; };
  }, [open, summary?.instanceUrl]);

  const factsComplete = Boolean(instance?.items?.length) && instance.items.every((item) => [item.lengthMm, item.widthMm, item.heightMm, item.weightKg].every((number) => Number(number) > 0));
  const restrictedThpack = dataset?.source === 'orlib_thpack' && ['thpack8', 'thpack9'].includes(summary?.group);
  const sourceContract=instance?externalCapabilities(dataset?.source,instance):null;
  const contract=solverMode==='SOURCE_BENCHMARK'?sourceContract:{...sourceContract,...businessSimulationCapabilities(dataset?.source)};
  const sourceBins=instance?sourceContainers(dataset?.source,instance):[];
  const solverReadiness = !contract?.canSolve?'BROWSE_ONLY':contract.fullSourceProblem?'FULLY_SUPPORTED':'PARTIALLY_SUPPORTED';
  // A test task is also useful when the public benchmark omits a solver-required
  // fact (THPACK has no item weights). Keep that task explicitly ineligible for
  // planning instead of preventing the source data from entering the workspace.
  const creatable = sourceContract?.canSolve===true;
  const advisory = sourceAdvisory(dataset?.source, summary?.group, instance);
  const unsupported = contract?.unsupported||[];
  const capabilities = Object.entries(contract||{}).filter(([key])=>['geometry','orientation','weight','loadBearing','stackingGroup','topBottom','originalContainer','meshGeometry'].includes(key)).map(([name,status])=>({name:`${name}: ${status}`,state:'recorded',symbol:status==='NOT_PROVIDED'?'—':'•',explanation:status}));
  const freightProfile = FREIGHT_BUSINESS_PROFILES.find((profile) => profile.id === businessOptions.profileId) || FREIGHT_BUSINESS_PROFILES[0];
  const selectSource = (source) => {
    setSourceId(source.source); setGroup(source.instances?.[0]?.group || ''); setInstanceId(''); setInstance(null); setError('');setSourceContainerIndex(0);
  };

  const footer = pending ? <button className="button button--secondary" type="button" onClick={onClose}>关闭</button> : <>
    <button className="button button--secondary" type="button" onClick={onClose}>关闭</button>
    <button className="button button--primary" type="button" data-testid="create-external-task" onClick={() => creatable && onCreate(dataset, instance, {...businessOptions,solverMode,sourceContainerIndex})} disabled={!creatable || status === 'loading-instance'}>创建独立数据测试任务</button>
  </>;

  return <Dialog open={open} onClose={onClose} title="外部数据集" description="选择可信来源，查看真实字段覆盖范围，并创建不修改源数据的独立测试任务。" size="xl" footer={footer}>
    <div className="external-browser" data-testid="external-dataset-browser">
      {status === 'loading' && <div className="external-browser__loading"><LoaderCircle className="spin" size={20} />正在加载数据目录…</div>}
      {error && <div className="inline-error"><TriangleAlert size={18} />{error}</div>}

      <nav className="external-source-list" aria-label="外部数据来源列表">
        {sources.map((source) => <button type="button" key={source.source} data-testid={`external-source-${source.source}`} className={source.source === sourceId ? 'is-active' : ''} onClick={() => selectSource(source)}>
          <span><strong>{externalSourceName(source.source, source.displayName)}</strong><small>{externalClassificationLabel(source.dataClassification)}</small></span>
          <span className="external-source-list__count">{source.instanceCount == null ? '数据待获取' : `${source.instanceCount.toLocaleString()} 个实例`}<ChevronRight size={16} /></span>
        </button>)}
      </nav>

      {pending && <section className="external-pending-detail" data-testid={`pending-source-${pending.source}`}>
        <div><Database size={22} /><span><strong>{externalSourceName(pending.source, pending.displayName)}</strong><small>{externalStatusLabel(pending.status)}</small></span></div>
        <p>{pendingDescription(pending.source)}</p>
        <div className="page-notice page-notice--warning"><TriangleAlert size={18} /><span>没有真实实例可供选择或创建任务。</span></div>
      </section>}

      {dataset && summary && <>
        <div className="external-browser__selectors">
          <label><span>数据集</span><select aria-label="外部数据集" value={group} onChange={(event) => { setGroup(event.target.value); setInstanceId(''); }}>{groups.map((item) => <option value={item} key={item}>{datasetGroupLabel(item)}</option>)}</select></label>
          <label><span>实例</span><select aria-label="外部数据实例" value={summary.id || ''} onChange={(event) => setInstanceId(event.target.value)}>{choices.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        </div>

        <section className="external-source-card"><div><Database size={22} /><span><strong>{externalSourceName(dataset.source, dataset.displayName)}</strong><small>{externalClassificationLabel(dataset.dataClassification)}</small></span></div><p>{advisory.text}</p></section>
        <div className="external-browser__selectors"><label><span>求解模式</span><select aria-label="求解模式" value={solverMode} onChange={e=>setSolverMode(e.target.value)}><option value="SOURCE_BENCHMARK">来源基准 · 使用源箱体与源约束</option><option value="PORTCUBE_BUSINESS_SIMULATION">业务模拟 · 使用 PORTCUBE 柜型</option></select></label>{solverMode==='SOURCE_BENCHMARK'&&<label><span>来源箱体</span><select aria-label="来源箱体" value={sourceContainerIndex} onChange={e=>setSourceContainerIndex(Number(e.target.value))}>{sourceBins.map((bin,index)=><option key={bin.typeId} value={index}>{bin.sourceType} · {bin.innerLength} × {bin.innerWidth} × {bin.innerHeight} mm</option>)}</select></label>}</div>

        {solverMode==='PORTCUBE_BUSINESS_SIMULATION'&&shouldShowFreightContext(solverReadiness) ? <section className="external-business-card" data-testid="external-business-context-step">
          <div className="external-business-card__heading"><span><small>运输任务</small><strong>{freightProfile.label}</strong></span><span className={`external-readiness external-readiness--${solverReadiness.toLowerCase()}`}>{solverReadinessLabel(solverReadiness)}</span></div>
          <dl><div><dt>起运地</dt><dd>{freightProfile.placeOfReceipt}</dd></div><div><dt>装货港</dt><dd>{freightProfile.portOfLoading.name}</dd></div><div><dt>卸货港</dt><dd>{freightProfile.portOfDischarge.name}</dd></div><div><dt>最终交付地</dt><dd>{freightProfile.placeOfDelivery}</dd></div></dl>
          <p>任务创建后，客户、订单、目的港、批次和卸货顺序将按产品类型稳定分组；货物尺寸、重量、数量、包装与约束不会改变。</p>
          <details><summary>高级设置</summary><div className="external-business-options">
            <label><span>客户数</span><select aria-label="客户数" value={businessOptions.customerCount} onChange={(event) => setBusinessOptions((current) => ({ ...current, customerCount: Number(event.target.value) }))}>{[2,3,4].map((count) => <option key={count} value={count}>{count} 个客户</option>)}</select></label>
            <label><span>订单分组</span><select aria-label="订单分组" value={businessOptions.orderGroupCount} onChange={(event) => setBusinessOptions((current) => ({ ...current, orderGroupCount: Number(event.target.value) }))}>{[2,3,4].map((count) => <option key={count} value={count}>{count} 个订单组</option>)}</select></label>
            <label><span>卸货组</span><select aria-label="卸货组" value={businessOptions.unloadGroupCount} onChange={(event) => setBusinessOptions((current) => ({ ...current, unloadGroupCount: Number(event.target.value) }))}>{[2,3,4].map((count) => <option key={count} value={count}>{count} 个卸货组</option>)}</select></label>
          </div></details>
        </section> : <section className="external-browse-only-card" data-testid="external-browse-only-context"><ShieldCheck size={20} /><div><strong>{creatable?'来源基准任务':'仅供数据与几何浏览'}</strong><p>{creatable?'保留源箱体与源约束；不添加客户、港序或作业属性。来源未提供的重量校核不执行。':'精确异形碰撞、单位或记录结构需先完成适配。'}</p></div></section>}

        <section className="external-summary-grid" aria-label="外部实例摘要">
          <span><small>实例数量</small><strong>{dataset.instanceCount.toLocaleString()}</strong></span>
          <span><small>货物类型</small><strong>{summary.itemTypeCount.toLocaleString()}</strong></span>
          <span><small>展开后实际件数</small><strong>{summary.pieces.toLocaleString()}</strong></span>
          <span><small>总重量</small><strong>{value(summary.totalWeightKg, ' kg')}</strong></span>
          <span><small>总体积</small><strong>{value(summary.totalVolumeM3?.toFixed(3), ' m³')}</strong></span>
          <span><small>字段完整度</small><strong>{summary.completeness}%</strong></span>
        </section>

        {contract?.blockingReasons?.length>0&&<p role="status">当前模式求解未启用：{contract.blockingReasons.join('、')}</p>}
        <section className="external-capability-list" aria-label="字段支持状态">
          {capabilities.map((capability) => <span key={capability.name} className={`external-capability external-capability--${capability.state}`} title={capability.explanation}><b>{capability.symbol}</b>{capability.name}</span>)}
        </section>
        <div className="external-capability-legend"><span>✓ 已支持</span><span>◐ 已记录，求解器暂未使用</span><span>— 来源未提供</span><span>! 需人工确认适配</span></div>
        <p className="external-missing"><strong>来源缺失字段：</strong>{summary.missingFields.length ? externalUnknownLabels(summary.missingFields).join('、') : '无'}</p>

        {instance && <div className="table-scroll external-preview"><table className="data-table data-table--compact"><thead><tr><th>产品编号</th><th>名称</th><th>尺寸</th><th>单件重量</th><th>件数</th><th>方向与特殊约束</th><th>来源缺失字段</th></tr></thead><tbody>{instance.items.slice(0, 5).map((item) => <tr key={item.externalItemId}><td className="mono">{item.externalItemId}</td><td><ExternalPreviewVisual item={item} /></td><td title={[item.lengthMm, item.widthMm, item.heightMm].some((number) => number == null) ? '来源未提供' : undefined}>{[item.lengthMm, item.widthMm, item.heightMm].every((number) => number != null) ? `${item.lengthMm} × ${item.widthMm} × ${item.heightMm} mm` : '—'}</td><td title={item.weightKg == null ? '来源未提供' : undefined}>{value(item.weightKg, ' kg', true)}</td><td>{item.quantity}</td><td>{itemConstraintSummary(item)}</td><td>{item.unknownFields?.length ? externalUnknownLabels(item.unknownFields).join('、') : '无'}</td></tr>)}</tbody></table><p>按货物类型展示前 {Math.min(5, instance.items.length)} 项；不会为数千件货物生成逐件页面节点。</p></div>}

        {instance?.items?.[0] && <details className="external-technical"><summary>来源详情与技术字段</summary><div><dl><div><dt>货物数据来源</dt><dd>{dataset.displayName}</dd></div><div><dt>原始实例</dt><dd>{instance.label}</dd></div><div><dt>原始文件</dt><dd>{instance.rawPath || '来源未提供'}</dd></div><div><dt>三维几何模型</dt><dd>{instance.items[0].geometryAsset || '来源未提供'}</dd></div>{solverMode==='PORTCUBE_BUSINESS_SIMULATION'&&shouldShowFreightContext(solverReadiness) ? <><div><dt>运输上下文来源</dt><dd>PORTCUBE 任务配置</dd></div><div><dt>公开航线参考</dt><dd><a href={freightProfile.routeReference.url} target="_blank" rel="noreferrer">{freightProfile.routeReference.publisher} · {freightProfile.routeReference.title}</a> · 检索于 {freightProfile.routeReference.retrievedAt}</dd></div></> : <div><dt>运输上下文</dt><dd>未建立 · 来源未提供业务运输条件</dd></div>}</dl><table className="data-table data-table--compact"><thead><tr><th>原字段</th><th>原始值</th></tr></thead><tbody>{Object.entries(instance.items[0].sourceFields || {}).slice(0, 14).map(([key, raw]) => <tr key={key}><td className="mono">{key}</td><td>{technicalValue(raw)}</td></tr>)}</tbody></table></div></details>}

        {unsupported.length > 0 && <div className="page-notice page-notice--warning" data-testid="external-unsupported-warning"><TriangleAlert size={18} /><span><strong>创建前提示：</strong>该数据包含当前求解器尚未完整使用的约束：{unsupported.join('、')}。任务仅用于数据与现有包络能力测试，不代表完整工业约束验证通过。</span></div>}
        {!creatable && instance && <div className="page-notice page-notice--warning" data-testid="external-task-disabled-reason"><ShieldCheck size={18} /><span>{restrictedThpack ? '数据可浏览 · 部分来源信息待确认。来源单位或部分原始记录结构尚待确认。' : '当前数据仅支持浏览，尚不能创建正式货运任务。'}</span></div>}
        {creatable && !factsComplete && instance && <div className="page-notice page-notice--warning" data-testid="external-task-missing-facts"><ShieldCheck size={18} /><span>重量未提供：来源几何模式可求解，重量、CoG 与载荷校核不执行。业务模拟需要真实重量。</span></div>}
      </>}
    </div>
  </Dialog>;
}

function ExternalPreviewVisual({ item }) {
  const profile = createCargoPresentationProfile(item);
  const visual = resolveExternalVisualAsset({ cargoPresentationProfile: profile, externalMetadata: { geometryAsset: item.geometryAsset } });
  const label = item.geometryType === 'MESH' ? 'MESH' : '外观';
  return <span className="external-preview-identity"><span className="external-preview-visual" data-visual-family={profile.visualFamily}>{visual.kind === 'image' ? <img src={visual.asset} alt="" data-visual-asset={visual.asset} /> : <span className={`external-cargo-glyph external-cargo-glyph--${profile.visualFamily.toLowerCase().replaceAll('_', '-')}`} data-visual-asset={visual.asset}><i /><b>{label}</b></span>}</span><span>{externalItemDisplayName(item)}{item.geometryAsset && <small>{item.geometryAsset}</small>}</span></span>;
}
