import ForkInterfaceFields from './ForkInterfaceFields.jsx';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Boxes,
  Camera,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Filter,
  Info,
  Layers,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  WandSparkles,
  Weight
} from 'lucide-react';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { SESSION_ACTIONS } from '../../app/session/sessionReducer.js';
import { ConfirmDialog, Dialog, Drawer, InlineLoading } from '../../components/feedback/Overlays.jsx';
import { useFeedback } from '../../components/feedback/FeedbackProvider.jsx';
import { EmptyState, SourceNote, StatusPill } from '../../components/common/Status.jsx';
import { cargoDataCompleteness, cargoTotals, createCargoId, normalizeCargo, PACKAGING_TYPES, validateCargo } from '../../domain/cargo/cargo.js';
import { CARGO_TEMPLATES, cargoFromTemplate } from '../../domain/cargo/templates.js';
import { buildInputCargoCsv, previewCargoCsv } from '../../domain/cargo/csvImport.js';
import { SCENARIO_TEMPLATES, cargoFromScenario, summarizeScenario } from '../../domain/cargo/scenarioTemplates.js';
import { createInitialSession } from '../../domain/session/initialSession.js';
import { checkVlmStatus, recognizeCargoImage } from '../../services/vlmApi.js';
import { downloadTextFile } from '../../services/downloads.js';
import { displayPort, PAGE_COPY } from '../../domain/presentation/productCopy.js';
import { PRODUCT_METADATA } from '../../domain/presentation/productMetadata.js';
import { curatedCargoAsset } from '../../domain/presentation/curatedAssets.js';
import { classifyCargoAppearance } from '../../domain/cargo/appearance.js';

const LazyPackagingModelViewer = lazy(() => import('../../three/PackagingModelViewer.jsx'));

const ATTRIBUTE_FILTERS = [
  ['all', '全部'], ['risk', '有风险'], ['fragile', '易碎'], ['heavy', '重货'], ['wooden', '木包装'], ['nonstackable', '不可堆叠']
];
const DEFAULT_FILTERS = Object.freeze({ port: 'all', sequence: 'all', handling: 'all', attribute: 'all', batch: 'all' });

export default function CargoPage() {
  const { session, dispatch, actions } = useSession();
  const { notify } = useFeedback();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selected, setSelected] = useState(() => new Set());
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(() => toForm(cargoFromTemplate('air-conditioner')));
  const [formErrors, setFormErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState({ destinationPort: '', packagingType: '', stackable: '' });
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvFilename, setCsvFilename] = useState('');
  const [vlmOpen, setVlmOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const totals = useMemo(() => cargoTotals(session.cargo), [session.cargo]);
  const completeness = useMemo(() => cargoDataCompleteness(session.cargo), [session.cargo]);
  const invalidCount = useMemo(() => session.cargo.filter((cargo) => !validateCargo(cargo).valid).length, [session.cargo]);

  useEffect(() => {
    const ids = new Set(session.cargo.map((cargo) => cargo.cargoId));
    setSelected((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [session.cargo]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const filterOptions = useMemo(() => ({
    ports: [...new Set(session.cargo.map((cargo) => cargo.destinationPort))],
    sequences: [...new Set(session.cargo.map((cargo) => Number(cargo.portSequence || 1)))].sort((a, b) => a - b),
    batches: [...new Map(session.cargo
      .filter((cargo) => String(cargo.batchId || '').trim())
      .map((cargo) => [cargo.batchId, cargo.batchLabel || cargo.batchId])).entries()]
  }), [session.cargo]);
  const filtered = useMemo(() => session.cargo.filter((cargo) => {
    const text = `${cargo.name} ${cargo.sku} ${cargo.destinationPort} ${cargo.packagingType} ${cargo.batchId} ${cargo.batchLabel}`.toLowerCase();
    if (query && !text.includes(query.trim().toLowerCase())) return false;
    if (filters.port !== 'all' && cargo.destinationPort !== filters.port) return false;
    if (filters.sequence !== 'all' && String(cargo.portSequence) !== filters.sequence) return false;
    if (filters.handling !== 'all' && cargo.handlingMethod !== filters.handling) return false;
    if (filters.batch !== 'all' && cargo.batchId !== filters.batch) return false;
    if (filters.attribute === 'risk') return cargo.fragile || cargo.heavy || cargo.wooden || cargo.dangerous || cargo.stackable === false;
    if (filters.attribute === 'fragile') return cargo.fragile;
    if (filters.attribute === 'heavy') return cargo.heavy;
    if (filters.attribute === 'wooden') return cargo.wooden;
    if (filters.attribute === 'nonstackable') return cargo.stackable === false;
    return true;
  }), [session.cargo, query, filters]);
  const hasFilters = Boolean(query.trim()) || Object.values(filters).some((value) => value !== 'all');

  const openNew = (templateId = 'air-conditioner', overrides = {}) => {
    setForm(toForm(cargoFromTemplate(templateId, overrides)));
    setFormErrors({});
    setDirty(false);
    setEditor({ mode: 'new', cargoId: null });
  };
  const openEdit = (cargo) => {
    setForm(toForm(cargo));
    setFormErrors({});
    setDirty(false);
    setEditor({ mode: 'edit', cargoId: cargo.cargoId });
  };
  const requestCloseEditor = () => dirty ? setDiscardOpen(true) : setEditor(null);
  const updateForm = (field, value) => {
    setForm((current) => field === 'packagingType'
      ? { ...current, ...packagingDefaults(value), packagingType: value, packagingProfile: null, cargoPhysicalProfile: null, visualProfile: null }
      : { ...current, [field]: value });
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setDirty(true);
  };
  const selectTemplate = (templateId) => {
    setForm(toForm(cargoFromTemplate(templateId)));
    setFormErrors({});
    setDirty(true);
  };
  const saveCargo = async () => {
    if (saving) return;
    const rawErrors={};
    for(const [key,label] of [['name','货物名称'],['sku','SKU 编码'],['destinationPort','目的港']])if(!String(form[key]??'').trim())rawErrors[key]=`请填写${label}`;
    for(const key of ['length','width','height','weight','quantity'])if(!Number.isFinite(Number(form[key]))||Number(form[key])<=0)rawErrors[key]='请输入大于零的数值';
    if(Object.keys(rawErrors).length){setFormErrors(rawErrors);notify('请补齐标红的必填字段',{variant:'error'});return;}
    const result = validateCargo(fromForm(form, editor?.cargoId));
    if (!result.valid) {
      setFormErrors(result.errors);
      notify('请修正标红字段后再保存', { variant: 'error' });
      window.requestAnimationFrame(() => document.querySelector('[data-field-error="true"]')?.focus());
      return;
    }
    setSaving(true);
    await Promise.resolve();
    if (editor.mode === 'edit') actions.updateCargo(editor.cargoId, result.cargo);
    else actions.addCargo({ ...result.cargo, cargoId: createCargoId('cargo') });
    setSaving(false);
    setDirty(false);
    setEditor(null);
    notify(editor.mode === 'edit' ? 'SKU 已更新，原方案已失效' : 'SKU 已加入当前订单', { variant: 'success' });
  };

  const confirmDelete = () => {
    actions.deleteCargo(deleteTarget.cargoId);
    setDeleteTarget(null);
    notify('SKU 已删除，原方案已失效', { variant: 'success' });
  };
  const duplicate = (cargo) => {
    actions.duplicateCargo(cargo.cargoId, { newCargoId: createCargoId('cargo') });
    notify(`已复制 ${cargo.sku}`, { variant: 'success' });
  };
  const toggleAll = () => {
    const visibleIds = filtered.map((cargo) => cargo.cargoId);
    const allSelected = visibleIds.length && visibleIds.every((id) => selected.has(id));
    setSelected((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };
  const applyBulk = () => {
    const patch = {};
    if (bulk.destinationPort.trim()) patch.destinationPort = bulk.destinationPort.trim();
    if (bulk.packagingType) patch.packagingType = bulk.packagingType;
    if (bulk.stackable !== '') {
      patch.stackable = bulk.stackable === 'true';
      if (!patch.stackable) patch.maxStackLayers = 1;
    }
    if (!Object.keys(patch).length) {
      notify('请选择至少一个批量修改字段', { variant: 'warning' });
      return;
    }
    actions.bulkUpdateCargo([...selected], patch);
    setBulkOpen(false);
    setBulk({ destinationPort: '', packagingType: '', stackable: '' });
    notify(`已更新 ${selected.size} 个 SKU`, { variant: 'success' });
  };
  const readCsv = async (file) => {
    if (!file) return;
    setCsvFilename(file.name);
    try {
      setCsvPreview(previewCargoCsv(await file.text()));
    } catch (error) {
      setCsvPreview({ rows: [], fatalErrors: [error.message], summary: { total: 0, valid: 0, invalid: 0 } });
    }
  };
  const importValidRows = () => {
    const valid = (csvPreview?.rows || []).filter((row) => row.valid).map((row) => ({ ...row.cargo, cargoId: createCargoId('csv') }));
    if (!valid.length) {
      notify('没有可导入的有效行', { variant: 'error' });
      return;
    }
    actions.importCargo(valid);
    setCsvOpen(false);
    setCsvPreview(null);
    setCsvFilename('');
    notify(`已确认导入 ${valid.length} 行；错误行未写入`, { variant: 'success' });
  };
  const exportCurrentCargo = () => {
    const result = downloadTextFile({
      content: buildInputCargoCsv(session.cargo),
      filename: `${PRODUCT_METADATA.shortName}-${session.order.orderNo}-货物模板.csv`,
      mimeType: 'text/csv;charset=utf-8'
    });
    notify(`已导出 ${session.cargo.length} 个 SKU（${result.bytes} bytes）`, { variant: 'success' });
  };
  const applyScenario = (scenarioId) => {
    const scenario = SCENARIO_TEMPLATES.find((s) => s.id === scenarioId);
    if (!scenario) return;
    const scenarioSummary = summarizeScenario(scenarioId);
    const base = createInitialSession({ dataset:'legacy' });
    base.cargo = cargoFromScenario(scenarioId);
    base.datasetId = scenario.id;
    base.selectedContainerType = scenario.containerType || base.selectedContainerType;
    base.caseContext = { ...base.caseContext, caseId:scenario.orderNo };
    base.order = {
      ...base.order,
      orderNo: scenario.orderNo,
      route: scenario.route.join(' → '),
      source: 'demo-data',
      dataClassification: 'DEMO_DATA'
    };
    base.dataClassification = 'DEMO_DATA';
    base.dataSource = {
      ...base.dataSource,
      order: `DEMO DATA · ${scenario.label}`,
      cargo: `DEMO DATA · ${scenarioSummary.totalPieces} 件约束货物`
    };
    dispatch({ type: SESSION_ACTIONS.RESET, session: base });
    setQuery('');
    setFilters(DEFAULT_FILTERS);
    setSelected(new Set());
    setScenarioOpen(false);
    notify(`已应用「${scenario.label}」场景模板；请生成装箱方案`, { variant: 'success' });
  };
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => {
    setQuery('');
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="page cargo-page">
      <header className="page-header">
        <div><span className="page-kicker">货物 · 包装 · 约束</span><h1>{PAGE_COPY.cargo.title}</h1><p>{PAGE_COPY.cargo.subtitle}</p></div>
        <div className="page-header__actions"><button className="button button--secondary" type="button" onClick={() => setScenarioOpen(true)}><Layers size={17} />导入演示数据</button><button className="button button--secondary" type="button" onClick={() => setVlmOpen(true)}><Camera size={18} />图像辅助录入</button><button className="button button--primary" type="button" onClick={() => openNew()}><Plus size={18} />新增 SKU</button></div>
      </header>

      {session.recoveryNotice && <div className="page-notice page-notice--warning" data-session-recovery="true"><Info size={18} /><span>{session.recoveryNotice}</span></div>}

      <section className="cargo-summary-line">
        <div><Boxes size={17} /><strong>{session.cargo.length}</strong><span>SKU</span></div><div><Package size={17} /><strong>{totals.pieces}</strong><span>件货物</span></div><div><Weight size={17} /><strong>{Math.round(totals.weight).toLocaleString()}</strong><span>kg 货重</span></div><div><BadgeCheck size={17} /><strong className={invalidCount ? 'text-danger' : ''}>{invalidCount || completeness.percent}</strong><span>{invalidCount ? '条无效 SKU' : '% 必填完整度'}</span></div><SourceNote>{session.dataSource?.cargo || '当前订单'} · 已自动保存</SourceNote>
      </section>

      <section className="table-workspace packaging-workspace">
        <div className="table-toolbar">
          <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、SKU、目的港" aria-label="搜索货物" /></label>
          <div className="cargo-filter-grid" aria-label="货物筛选器"><Filter size={17} />
            <select value={filters.port} onChange={(event) => updateFilter('port', event.target.value)} aria-label="按目的港筛选"><option value="all">全部目的港</option>{filterOptions.ports.map((port) => <option value={port} key={port}>{displayPort(port)}</option>)}</select>
            <select value={filters.sequence} onChange={(event) => updateFilter('sequence', event.target.value)} aria-label="按港序筛选"><option value="all">全部港序</option>{filterOptions.sequences.map((sequence) => <option value={String(sequence)} key={sequence}>港序 {sequence}</option>)}</select>
            <select value={filters.handling} onChange={(event) => updateFilter('handling', event.target.value)} aria-label="按作业方式筛选"><option value="all">全部作业</option><option value="manual">人工装箱</option><option value="forklift">叉车装箱</option></select>
            <select value={filters.attribute} onChange={(event) => updateFilter('attribute', event.target.value)} aria-label="按风险属性筛选">{ATTRIBUTE_FILTERS.map(([value, label]) => <option value={value} key={value}>{value === 'all' ? '全部属性' : label}</option>)}</select>
            <select value={filters.batch} onChange={(event) => updateFilter('batch', event.target.value)} aria-label="按批次筛选"><option value="all">全部批次</option>{filterOptions.batches.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
          </div>
          {hasFilters && <button className="button button--quiet button--small" type="button" onClick={clearFilters}>清除筛选</button>}
          <span className="toolbar-spacer" />
          <button className="button button--secondary button--small" type="button" onClick={exportCurrentCargo}><Download size={16} />导出 CSV</button>
          <button className="button button--secondary button--small" type="button" onClick={() => setCsvOpen(true)}><FileSpreadsheet size={16} />CSV 导入</button>
          <button className="button button--secondary button--small" type="button" onClick={() => setBulkOpen(true)} disabled={!selected.size}>批量修改 {selected.size ? `(${selected.size})` : ''}</button>
        </div>

        {session.cargo.length === 0 ? <EmptyState icon={Upload} title="还没有货物" description="应用场景模板快速导入订单货物，或从单品模板新增。" action={<button className="button button--primary" type="button" onClick={() => setScenarioOpen(true)}>应用场景模板</button>} /> : filtered.length === 0 ? <EmptyState icon={Search} title="没有匹配结果" description="筛选只影响查看范围，不改变订单和真实装箱顺序。" action={<button className="button button--secondary" type="button" onClick={clearFilters}>清除全部筛选</button>} /> : (
          <div className="table-scroll"><table className="data-table cargo-table cargo-table--stage3"><thead><tr><th className="check-column"><input type="checkbox" aria-label="选择全部可见货物" checked={filtered.length > 0 && filtered.every((cargo) => selected.has(cargo.cargoId))} onChange={toggleAll} /></th><th>货物视觉 / 名称 / SKU</th><th>包装</th><th>尺寸 mm</th><th>重量 × 数量</th><th>目的港</th><th>搬运</th><th>关键约束</th><th className="action-column">操作</th></tr></thead><tbody>{filtered.map((cargo) => <CargoRow key={cargo.cargoId} cargo={cargo} thumbnail={curatedCargoAsset(cargo.packagingType)} checked={selected.has(cargo.cargoId)} onCheck={() => setSelected((current) => { const next = new Set(current); next.has(cargo.cargoId) ? next.delete(cargo.cargoId) : next.add(cargo.cargoId); return next; })} onEdit={() => openEdit(cargo)} onDuplicate={() => duplicate(cargo)} onDelete={() => setDeleteTarget(cargo)} />)}</tbody></table></div>
        )}
        <footer className="table-endcap"><span>共 <strong>{session.cargo.length}</strong> 个 SKU · 当前显示 <strong>{filtered.length}</strong> 个</span><span>{totals.pieces.toLocaleString()} 件 · 第 1 / 1 页</span></footer>
      </section>

      <Drawer open={Boolean(editor)} onClose={requestCloseEditor} title={editor?.mode === 'edit' ? `编辑 ${form.sku || 'SKU'}` : '新增货物'} description="保存后会更新统一会话，并使已有方案失效。" size="lg" closeOnBackdrop={false} footer={<><button className="button button--secondary" type="button" onClick={requestCloseEditor} disabled={saving}>取消</button><button className="button button--primary" type="button" onClick={saveCargo} disabled={saving}>{saving ? '保存中…' : '保存到当前订单'}</button></>}>
        {editor && <CargoEditor form={form} errors={formErrors} onChange={updateForm} onTemplate={selectTemplate} isNew={editor.mode === 'new'} thumbnail={curatedCargoAsset(form.packagingType)} />}
      </Drawer>
      <ConfirmDialog open={discardOpen} onClose={() => setDiscardOpen(false)} onConfirm={() => { setDirty(false); setDiscardOpen(false); setEditor(null); }} title="放弃未保存修改？" description="当前表单已有改动，关闭后不会写入订单。" consequence="已保存的货物、装箱方案和出运复核结果保持不变。" confirmLabel="放弃修改" />
      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title={`删除 ${deleteTarget?.sku || 'SKU'}？`} description="删除后可重新新增，但当前装箱与合规结果会失效。" confirmLabel="确认删除" />
      <Dialog open={scenarioOpen} onClose={() => setScenarioOpen(false)} title="导入演示数据集" description="所有内置数据均标记为 DEMO DATA；导入后可继续编辑和求解。" size="lg" footer={<button className="button button--secondary" type="button" onClick={() => setScenarioOpen(false)}>关闭</button>}>
        <div className="scenario-list">{SCENARIO_TEMPLATES.map((scenario) => { const summary = summarizeScenario(scenario.id); return (<button key={scenario.id} className="scenario-card" type="button" onClick={() => applyScenario(scenario.id)}><div className="scenario-card__header"><strong>{scenario.label}</strong><span className="scenario-card__sku">DEMO DATA · {summary.skuCount} SKU · {summary.totalPieces} 件</span></div><p className="scenario-card__desc">{scenario.description}</p><div className="scenario-card__meta"><span>演示编号 {scenario.orderNo}</span><span>航线 {scenario.route.join(' → ')}</span><span>{summary.totalWeight} kg</span></div></button>); })}</div>
      </Dialog>

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} title={`批量修改 ${selected.size} 个 SKU`} description="空白字段保持原值。" footer={<><button className="button button--secondary" type="button" onClick={() => setBulkOpen(false)}>取消</button><button className="button button--primary" type="button" onClick={applyBulk}>应用修改</button></>}>
        <div className="form-grid"><Field label="目的港"><input value={bulk.destinationPort} onChange={(event) => setBulk((current) => ({ ...current, destinationPort: event.target.value }))} placeholder="例如 Hamburg" /></Field><Field label="包装类型"><select value={bulk.packagingType} onChange={(event) => setBulk((current) => ({ ...current, packagingType: event.target.value }))}><option value="">保持原值</option>{PACKAGING_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="可堆叠"><select value={bulk.stackable} onChange={(event) => setBulk((current) => ({ ...current, stackable: event.target.value }))}><option value="">保持原值</option><option value="true">是</option><option value="false">否（最大层数同步为 1）</option></select></Field></div>
      </Dialog>

      <Dialog open={csvOpen} onClose={() => { setCsvOpen(false); setCsvPreview(null); }} title="CSV 校验预览" description="选择文件只做解析；点击确认后才导入有效行。" size="xl" footer={<><button className="button button--secondary" type="button" onClick={() => { setCsvOpen(false); setCsvPreview(null); }}>取消</button><button className="button button--primary" type="button" onClick={importValidRows} disabled={!csvPreview?.summary?.valid}>确认导入 {csvPreview?.summary?.valid || 0} 行</button></>}>
        <CsvPreview filename={csvFilename} preview={csvPreview} onFile={readCsv} />
      </Dialog>

      <VlmDrawer open={vlmOpen} onClose={() => setVlmOpen(false)} onUse={(result) => { setVlmOpen(false); openNew('custom', vlmToCargo(result)); }} notify={notify} />
    </div>
  );
}

function CargoRow({ cargo, thumbnail, checked, onCheck, onEdit, onDuplicate, onDelete }) {
  const validation = validateCargo(cargo);
  const validationMessage = Object.entries(validation.errors).map(([field, message]) => `${field}: ${message}`).join('；');
  const packagingLabel = PACKAGING_TYPES.find(([type]) => type === cargo.packagingType)?.[1] || cargo.packagingType;
  return <tr className={validation.valid ? '' : 'row-error'} data-valid={String(validation.valid)}><td className="check-column"><input type="checkbox" checked={checked} onChange={onCheck} aria-label={`选择 ${cargo.sku}`} /></td><td><div className="cargo-identity-cell"><span className="cargo-row-visual">{thumbnail ? <img src={thumbnail} alt="" /> : <Package size={20} />}</span><span><strong>{cargo.name}</strong><small className="cell-sub mono">{cargo.sku} · {cargo.dataClassification === 'DEMO_DATA' ? '演示数据' : '本票输入'}</small></span></div>{!validation.valid && <span className="validation-error">无效：{validationMessage}</span>}</td><td><strong>{packagingLabel}</strong><span className="cell-sub">{cargo.packagingMaterial} · {cargo.transportUnit}</span></td><td>{cargo.length} × {cargo.width} × {cargo.height}<span className="cell-sub">{orientationLabel(cargo.orientationPolicy)}</span></td><td><strong>{cargo.weight} kg</strong><span className="cell-sub">× {cargo.quantity} 件</span></td><td>{displayPort(cargo.destinationPort)}<span className="cell-sub">第 {cargo.portSequence} 港</span></td><td><span className={`handling-pill handling-pill--${cargo.handlingMethod}`}>{handlingLabel(cargo.handlingMethod)}</span><span className="cell-sub">叉孔 {forkLabel(cargo.forkEntry)}</span></td><td><strong>{cargo.stackable ? `最多 ${cargo.maxStackLayers} 层` : '禁止堆叠'}</strong><span className="cell-sub">{cargo.fragile ? '易碎 · ' : ''}{cargo.maxSupportedWeight ? `承载 ${cargo.maxSupportedWeight} kg` : '承载待确认 / 派生'}</span></td><td className="action-column"><div className="row-actions"><button className="icon-button icon-button--quiet tooltip-button" type="button" onClick={onEdit} aria-label={`编辑 ${cargo.sku}`} title="编辑" data-tooltip="编辑"><Pencil size={17} /></button><button className="icon-button icon-button--quiet tooltip-button" type="button" onClick={onDuplicate} aria-label={`复制 ${cargo.sku}`} title="复制" data-tooltip="复制"><Copy size={17} /></button><button className="icon-button icon-button--quiet icon-button--danger tooltip-button" type="button" onClick={onDelete} aria-label={`删除 ${cargo.sku}`} title="删除" data-tooltip="删除"><Trash2 size={17} /></button></div></td></tr>;
}

function CargoEditor({ form, errors, onChange, onTemplate, isNew }) {
  const palletLike = ['PALLETIZED_CARTONS', 'WRAPPED_PALLET', 'EQUIPMENT_CASE'].includes(form.packagingType);
  const woodRelevant = ['WOOD_CRATE', 'PALLETIZED_CARTONS', 'WRAPPED_PALLET', 'EQUIPMENT_CASE'].includes(form.packagingType);
  return <form className="cargo-editor" onSubmit={(event) => event.preventDefault()}>
    <section className="cargo-editor-preview"><div className="cargo-editor-preview__asset"><Suspense fallback={<span>加载包装模型…</span>}><LazyPackagingModelViewer appearanceKey={classifyCargoAppearance(form).key} label={classifyCargoAppearance(form).label} cargo={form} /></Suspense></div><div><span>包装结构 / 求解包络</span><h3>{PACKAGING_TYPES.find(([value]) => value === form.packagingType)?.[1] || '通用包装'}</h3><p>旋转查看包装结构。实际装载采用录入的尺寸、朝向、堆叠和搬运约束；样例模型不代替货物实测。</p><dl><div><dt>求解包络</dt><dd>{form.length || '—'} × {form.width || '—'} × {form.height || '—'} mm</dd></div><div><dt>搬运</dt><dd>{handlingLabel(form.handlingMethod)}</dd></div></dl></div></section>
    {isNew && <div className="template-picker"><span>预制模板</span><div>{CARGO_TEMPLATES.map((template) => <button type="button" key={template.id} onClick={() => onTemplate(template.id)}>{template.label}</button>)}</div></div>}
    <section className="form-section"><h3>基本信息</h3><div className="form-grid form-grid--2"><Field label="货物名称" required error={errors.name}><input value={form.name} onChange={(event) => onChange('name', event.target.value)} data-field-error={Boolean(errors.name)} /></Field><Field label="SKU 编码" required error={errors.sku}><input value={form.sku} onChange={(event) => onChange('sku', event.target.value)} data-field-error={Boolean(errors.sku)} /></Field><Field label="目的港" required error={errors.destinationPort}><input value={form.destinationPort} onChange={(event) => onChange('destinationPort', event.target.value)} data-field-error={Boolean(errors.destinationPort)} /></Field><Field label="预计到港 ETA"><input type="date" value={form.eta} onChange={(event) => onChange('eta', event.target.value)} /></Field><Field label="批次 ID"><input value={form.batchId || ''} onChange={(event) => onChange('batchId', event.target.value)} placeholder="例如 BATCH-HAM-A" /></Field><Field label="批次名称"><input value={form.batchLabel || ''} onChange={(event) => onChange('batchLabel', event.target.value)} placeholder="例如 汉堡港 · 配件批次 A" /></Field></div></section>
    <section className="form-section"><h3>尺寸与数量</h3><div className="form-grid form-grid--3"><Field label="长 (mm)" required error={errors.length || errors.dimensions}><input type="number" min="1" step="1" value={form.length} onChange={(event) => onChange('length', event.target.value)} data-field-error={Boolean(errors.length || errors.dimensions)} /></Field><Field label="宽 (mm)" required error={errors.width}><input type="number" min="1" step="1" value={form.width} onChange={(event) => onChange('width', event.target.value)} data-field-error={Boolean(errors.width)} /></Field><Field label="高 (mm)" required error={errors.height}><input type="number" min="1" step="1" value={form.height} onChange={(event) => onChange('height', event.target.value)} data-field-error={Boolean(errors.height)} /></Field><Field label="单件重量 (kg)" required error={errors.weight}><input type="number" min="0.01" step="0.01" value={form.weight} onChange={(event) => onChange('weight', event.target.value)} data-field-error={Boolean(errors.weight)} /></Field><Field label="数量" required error={errors.quantity}><input type="number" min="1" step="1" value={form.quantity} onChange={(event) => onChange('quantity', event.target.value)} data-field-error={Boolean(errors.quantity)} /></Field><Field label="卸货港序"><input type="number" min="1" step="1" value={form.portSequence} onChange={(event) => onChange('portSequence', event.target.value)} /></Field></div></section>
    <section className="form-section packaging-profile-editor"><div className="form-section__heading"><div><h3>包装画像</h3><p>这里的字段直接进入求解硬约束与 3D 包装外观；视觉网格不会反推尺寸。</p></div><StatusPill status={form.packagingSuggestionSource === 'AI_SUGGESTION' && !form.packagingConfirmed ? 'warning' : 'ready'}>{form.packagingSuggestionSource === 'AI_SUGGESTION' && !form.packagingConfirmed ? 'AI 建议 · 待确认' : '用户确认'}</StatusPill></div><div className="form-grid form-grid--2">
      <Field label="包装类型" error={errors.packagingType}><select value={form.packagingType} onChange={(event) => onChange('packagingType', event.target.value)} data-field-error={Boolean(errors.packagingType)}>{PACKAGING_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
      <Field label="包装材料"><input value={form.packagingMaterial || ''} onChange={(event) => onChange('packagingMaterial', event.target.value)} placeholder="例如 五层瓦楞纸板" /></Field>
      <Field label="运输单元"><input value={form.transportUnit || ''} onChange={(event) => onChange('transportUnit', event.target.value)} placeholder="例如 托盘 / 箱件" /></Field>
      <Field label="装卸方式"><select value={form.handlingMethod} onChange={(event) => onChange('handlingMethod', event.target.value)}><option value="manual">人工</option><option value="team_manual">协同人工</option><option value="forklift">叉车</option><option value="pallet_jack">托盘车</option><option value="crane">吊装</option></select></Field>
      <Field label="朝向策略"><select value={form.orientationPolicy} onChange={(event) => onChange('orientationPolicy', event.target.value)}><option value="FIXED_ORIENTATION">固定朝向</option><option value="UPRIGHT_ONLY">仅保持直立</option><option value="HORIZONTAL_ROTATION_ONLY">仅水平旋转</option><option value="FULL_ROTATION_ALLOWED">允许侧放旋转</option></select></Field>
      {palletLike && <ForkInterfaceFields value={form} onChange={onChange}/>}
      {woodRelevant && <Field label="木质包装类别"><select value={form.woodPackagingClass || 'CONFIRM_SOLID_OR_PROCESSED_WOOD'} onChange={(event) => onChange('woodPackagingClass', event.target.value)}><option value="CONFIRM_SOLID_OR_PROCESSED_WOOD">待确认实木 / 加工木</option><option value="REGULATED_SOLID_WOOD">受控实木</option><option value="PROCESSED_WOOD_EXEMPTION_CANDIDATE">加工木豁免候选</option><option value="PALLET_WOOD_STATUS_REQUIRED">托盘木材状态待补</option><option value="NOT_APPLICABLE">不适用</option></select></Field>}
      <Field label="最大堆叠层数" error={errors.maxStackLayers}><input type="number" min="1" step="1" value={form.maxStackLayers} disabled={!form.stackable} onChange={(event) => onChange('maxStackLayers', event.target.value)} data-field-error={Boolean(errors.maxStackLayers)} /></Field>
      {form.stackable && <Field label="最大承载重量 (kg)"><input type="number" min="0" step="1" value={form.maxSupportedWeight || ''} onChange={(event) => onChange('maxSupportedWeight', event.target.value)} placeholder="未知时留空，后端显示派生规则" /></Field>}
      <Field label="风险备注"><input value={form.riskNotes} onChange={(event) => onChange('riskNotes', event.target.value)} placeholder="用分号分隔，例如：轻放；IPPC 待复核" /></Field>
    </div><div className="check-grid">{[['stackable', '可堆叠'], ['fragile', '易碎'], ['dangerous', '危险品']].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(form[key])} onChange={(event) => { onChange(key, event.target.checked); if (key === 'stackable' && !event.target.checked) onChange('maxStackLayers', 1); }} />{label}</label>)}</div></section>
  </form>;
}

function Field({ label, required, error, children }) {
  return <label className={`form-field ${error ? 'form-field--error' : ''}`}><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{children}{error && <small role="alert">{error}</small>}</label>;
}

function CsvPreview({ filename, preview, onFile }) {
  return <div className="csv-preview"><label className="file-drop"><Upload size={24} /><strong>{filename || '选择 UTF-8 CSV 文件'}</strong><span>支持中英文列名；文件不会在确认前写入订单。</span><input type="file" accept=".csv,text/csv" onChange={(event) => onFile(event.target.files?.[0])} /></label>{preview && <>{preview.fatalErrors?.length ? <div className="inline-error">{preview.fatalErrors.join('；')}</div> : <><div className="csv-summary"><span>总行数 <strong>{preview.summary.total}</strong></span><span className="text-success">有效 <strong>{preview.summary.valid}</strong></span><span className="text-danger">错误 <strong>{preview.summary.invalid}</strong></span>{preview.ignoredHeaders?.length > 0 && <span>忽略列：{preview.ignoredHeaders.join('、')}</span>}</div><div className="table-scroll csv-table-wrap"><table className="data-table data-table--compact"><thead><tr><th>行</th><th>SKU</th><th>名称</th><th>尺寸</th><th>数量</th><th>校验</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.rowNumber} className={!row.valid ? 'row-error' : ''}><td>{row.rowNumber}</td><td>{row.cargo.sku || '—'}</td><td>{row.cargo.name || '—'}</td><td>{row.cargo.length}×{row.cargo.width}×{row.cargo.height}</td><td>{row.cargo.quantity}</td><td>{row.valid ? <span className="validation-ok"><Check size={15} />有效{row.warnings.length ? ` · ${row.warnings.join('、')}` : ''}</span> : <span className="validation-error">{Object.entries(row.errors).map(([field, message]) => `${field}: ${message}`).join('；')}</span>}</td></tr>)}</tbody></table></div></>}</>}</div>;
}

function VlmDrawer({ open, onClose, onUse, notify }) {
  const [service, setService] = useState({ status: 'idle', data: null });
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setService({ status: 'loading', data: null });
    checkVlmStatus({ timeoutMs: 8000 }).then((data) => setService({ status: 'ready', data })).catch((requestError) => setService({ status: 'error', data: { available: false, message: requestError.message } }));
    return () => controllerRef.current?.abort();
  }, [open]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const chooseFile = (next) => {
    if (!next) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setResult(null);
    setError('');
    setStatus('idle');
  };
  const recognize = async () => {
    if (!file || status === 'loading') return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('loading'); setError(''); setResult(null);
    try {
      const data = await recognizeCargoImage(file, { signal: controller.signal });
      setResult(data); setStatus('ready');
      notify('识别结果已返回，请人工确认后再写入', { variant: 'success' });
    } catch (requestError) {
      if (requestError.reason !== 'cancelled') {
        setError(requestError.message || '识别失败'); setStatus('error');
        notify('VLM 识别失败，原始图片已保留，可重试', { variant: 'error' });
      }
    }
  };
  const close = () => { controllerRef.current?.abort(); onClose(); };
  return <Drawer open={open} onClose={close} title="图像辅助录入" description="VLM 只提供候选属性；人工确认后才进入货物数据集。" size="lg" footer={<><button className="button button--secondary" type="button" onClick={close}>关闭</button>{result && <button className="button button--primary" type="button" onClick={() => onUse(result)}><WandSparkles size={17} />填入新增表单</button>}</>}>
    <div className="vlm-workspace"><div className="service-line">{service.status === 'loading' ? <InlineLoading label="检查 VLM 服务" /> : <><StatusPill status={service.data?.available ? 'ready' : 'warning'}>{service.data?.available ? '服务可用' : '服务不可用'}</StatusPill><span>{service.data?.model || service.data?.message || '模型状态未知'}</span></>}</div><label className="image-drop">{previewUrl ? <img src={previewUrl} alt="待识别货物原图" /> : <><Camera size={30} /><strong>选择货物照片</strong><span>失败后图片仍会保留，便于重试。</span></>}<input type="file" accept="image/*" onChange={(event) => chooseFile(event.target.files?.[0])} /></label><button className="button button--primary button--full" type="button" onClick={recognize} disabled={!file || status === 'loading' || service.data?.available === false}>{status === 'loading' ? <InlineLoading label="真实识别中" /> : '开始识别'}</button>{error && <div className="inline-error"><strong>识别失败</strong><span>{error}</span><button className="button button--secondary button--small" type="button" onClick={recognize}>重试</button></div>}{result && <div className="vlm-result"><h3>候选属性（待人工确认）</h3><dl>{[['name','名称'],['length','长 mm'],['width','宽 mm'],['height','高 mm'],['weight','重量 kg'],['packagingType','包装'],['confidence','置信度']].map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{String(result[key] ?? '未识别')}</dd></div>)}</dl><p>{result.rawDescription || '模型未返回描述。'}</p></div>}</div>
  </Drawer>;
}

function toForm(cargo) {
  const normalized = normalizeCargo({ cargoId: cargo.cargoId || 'form', ...cargo });
  return { ...normalized, riskNotes: (normalized.riskNotes || []).join('；') };
}
function fromForm(form, cargoId) {
  return { ...form, cargoId: cargoId || 'validation', packagingConfirmed: true, riskNotes: String(form.riskNotes || '').split(/[;；|]/).map((note) => note.trim()).filter(Boolean) };
}
function vlmToCargo(result) {
  return {
    name: result.name || '', length: result.length || 0, width: result.width || 0, height: result.height || 0,
    weight: result.weight || 0, packagingType: result.packagingType || 'GENERIC', packagingSuggestionSource: 'AI_SUGGESTION', packagingConfirmed: false, fragile: Boolean(result.fragile),
    dangerous: Boolean(result.dangerous), stackable: result.stackable !== false, heavy: Number(result.weight || 0) >= 20,
    riskNotes: [`VLM 候选，置信度 ${result.confidence ?? '未知'}，已进入人工确认`]
  };
}

function orientationLabel(value) { return ({ FIXED_ORIENTATION: '固定朝向', UPRIGHT_ONLY: '仅直立', HORIZONTAL_ROTATION_ONLY: '仅水平旋转', FULL_ROTATION_ALLOWED: '允许侧放' })[value] || '朝向待确认'; }
function handlingLabel(value) { return ({ manual: '人工', team_manual: '协同人工', forklift: '叉车', pallet_jack: '托盘车', crane: '吊装' })[value] || value || '待确认'; }
function forkLabel(value) { return ({ TWO_WAY: '双向', FOUR_WAY: '四向', ONE_WAY: '单向', NOT_APPLICABLE: '不适用' })[value] || '待确认'; }
function packagingDefaults(type) {
  return ({
    CARTON: { packagingMaterial: '瓦楞纸板', transportUnit: '散件', forkEntry: 'NOT_APPLICABLE', woodPackagingClass: 'NOT_APPLICABLE' },
    WOOD_CRATE: { packagingMaterial: '实木或胶合板', transportUnit: '箱件', forkEntry: 'NOT_APPLICABLE', woodPackagingClass: 'CONFIRM_SOLID_OR_PROCESSED_WOOD' },
    PALLETIZED_CARTONS: { packagingMaterial: '纸箱 + 托盘', transportUnit: '托盘', forkEntry: 'TWO_WAY', woodPackagingClass: 'PALLET_WOOD_STATUS_REQUIRED' },
    WRAPPED_PALLET: { packagingMaterial: '缠绕膜 + 托盘', transportUnit: '托盘', forkEntry: 'TWO_WAY', woodPackagingClass: 'PALLET_WOOD_STATUS_REQUIRED' },
    EQUIPMENT_CASE: { packagingMaterial: '工程包装箱', transportUnit: '箱件', forkEntry: 'TWO_WAY', woodPackagingClass: 'CONFIRM_SOLID_OR_PROCESSED_WOOD' },
    DRUM: { packagingMaterial: '钢或聚合物', transportUnit: '桶', forkEntry: 'NOT_APPLICABLE', woodPackagingClass: 'NOT_APPLICABLE' },
    FIBC_BAG: { packagingMaterial: '编织聚丙烯', transportUnit: '柔性袋', forkEntry: 'NOT_APPLICABLE', woodPackagingClass: 'NOT_APPLICABLE' },
    GENERIC: { packagingMaterial: '待确认', transportUnit: '单件', forkEntry: 'NOT_APPLICABLE', woodPackagingClass: 'NOT_APPLICABLE' }
  })[type] || {};
}
