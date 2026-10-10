import { useMemo, useState } from 'react';
import { BookOpen, BoxSelect, ExternalLink, FileSearch } from 'lucide-react';
import { StatusPill } from '../common/Status.jsx';

const SCOPE_ORDER = ['GLOBAL', 'CHINA', 'PORT', 'TERMINAL', 'CARRIER', 'DESTINATION', 'CARGO'];

export function RegulationWorkbench({ admission = null, plan = {}, evidence = [], aiAudit = null, onInspectSpace }) {
  const rows = useMemo(() => buildAdmissionRows(admission, plan), [admission, plan]);
  const [selectedKey, setSelectedKey] = useState(() => rows[0]?.key || 'equipment');
  const [scope, setScope] = useState('GLOBAL');
  const [sourceOpen, setSourceOpen] = useState(false);
  const selected = rows.find((row) => row.key === selectedKey) || rows[0];
  const rules = admission?.ruleRegistry?.entries || [];
  const filteredRows = scope === 'GLOBAL' ? rows : rows.filter((row) => row.scopes.includes(scope));
  const compactRule = selected?.rules?.[0];
  const sourceRule = rules.find((rule) => rule.id === compactRule?.id)
    || rules.find((rule) => rule.scope === selected?.ruleScope)
    || compactRule
    || null;
  if (!selected) return null;

  const selectRow = (row) => {
    setSelectedKey(row.key);
    setSourceOpen(false);
  };

  return <section className="admission-workbench" id="regulation-evidence-workbench" data-admission-status={admission?.overallStatus || 'DATA_REQUIRED'} aria-label="Admission decision workbench">
    <div className="admission-workbench__heading">
      <div><span>ADMISSION DECISION</span><h2>{admission?.overallStatus || 'DATA REQUIRED'}</h2><p>状态、原因与证据分层呈现；没有把参考数据或公开流程包装成承运人 / 码头接收。</p></div>
      <div><StatusPill status={statusTone(admission?.overallStatus)}>{admission?.decision || 'COLLECT EVIDENCE'}</StatusPill><small>Rule snapshot · {admission?.caseContext?.caseDate || '2026-08-24'}</small></div>
    </div>

    <div className="admission-workbench__layout">
      <aside className="rule-scope-rail" aria-label="Rule scope rail">
        <span>RULE SCOPE</span>
        {SCOPE_ORDER.map((item) => {
          const scoped = item === 'GLOBAL' ? rows : rows.filter((row) => row.scopes.includes(item));
          const attention = scoped.filter((row) => row.tone !== 'ready' && row.tone !== 'neutral').length;
          return <button type="button" className={scope === item ? 'active' : ''} onClick={() => setScope(item)} key={item}><strong>{item}</strong><small>{scoped.length} applicable</small>{attention > 0 && <em>{attention}</em>}</button>;
        })}
      </aside>

      <section className="admission-matrix-pane">
        <div className="admission-matrix__head"><span>DOMAIN</span><span>STATUS</span><span>RULE BASIS</span><span>EVIDENCE / CURRENT</span><span>ACTION</span></div>
        <div className="admission-matrix" role="table">{filteredRows.map((row) => <button type="button" role="row" className={`admission-row ${selected.key === row.key ? 'active' : ''}`} onClick={() => selectRow(row)} key={row.key}>
          <strong role="cell">{row.label}<small>{row.key.toUpperCase()}</small></strong>
          <span role="cell"><StatusPill status={row.tone}>{row.status}</StatusPill></span>
          <span role="cell">{row.basis}</span>
          <span role="cell">{row.current}</span>
          <span role="cell" className="admission-row__action">{row.action} →</span>
        </button>)}</div>
      </section>

      <aside className="rule-inspector" data-selected-domain={selected.key}>
        <header><div><span>CONTEXTUAL RULE INSPECTOR</span><h2>{selected.label}</h2></div><StatusPill status={selected.tone}>{selected.status}</StatusPill></header>
        <dl>
          <InspectorRow label="WHY APPLICABLE" value={selected.why} />
          <InspectorRow label="RULE LEVEL" value={sourceRule?.level || selected.level} />
          <InspectorRow label="AUTHORITY" value={sourceRule?.authority || selected.authority} />
          <InspectorRow label="EFFECTIVE" value={sourceRule?.effectiveFrom ? `${sourceRule.effectiveFrom} · ${sourceRule.resolvedStatus || sourceRule.status}` : 'PROJECT POLICY / CASE INPUT'} />
          <InspectorRow label="CURRENT INPUT" value={selected.current} />
          <InspectorRow label="EVALUATION" value={selected.evaluation} />
          <InspectorRow label="RESULT" value={selected.status} />
          <InspectorRow label="SOURCE CLAUSE" value={sourceRule?.clause || selected.basis} />
          <InspectorRow label="REQUIRED ACTION" value={selected.action} />
        </dl>
        <div className="rule-inspector__actions">
          {sourceRule && <button className="button button--secondary button--small" type="button" onClick={() => setSourceOpen((value) => !value)}><FileSearch size={15} />{sourceOpen ? 'Close source' : 'Open source'}</button>}
          {onInspectSpace && selected.spatial && <button className="button button--secondary button--small" type="button" onClick={() => onInspectSpace({ ruleId: selected.key, ruleName: selected.label })}><BoxSelect size={15} />View in Twin</button>}
        </div>
        {sourceOpen && <SourceReader rule={sourceRule} fallbackEvidence={evidence.find((item) => item.ruleId === selected.key)} />}
        <details className="rule-ai-explanation"><summary>Plain-language explanation</summary><p>{aiAudit?.advice || `${selected.label} 当前为 ${selected.status}。${selected.action}。AI 未运行时，这段文字仅复述确定性结果，不生成新结论。`}</p></details>
      </aside>
    </div>
  </section>;
}

function SourceReader({ rule, fallbackEvidence }) {
  return <section className="source-reader" data-source-reader="open">
    <header><BookOpen size={16} /><div><span>SOURCE READER</span><strong>{rule.title}</strong></div></header>
    <dl><InspectorRow label="DOCUMENT" value={rule.sourceDocument} /><InspectorRow label="CLAUSE" value={rule.clause} /><InspectorRow label="CLAIM LEVEL" value={rule.level} /><InspectorRow label="SNAPSHOT" value={`${rule.verifiedAt} · ${rule.resolvedStatus || rule.status}`} /></dl>
    {fallbackEvidence?.snippet && <blockquote>{fallbackEvidence.snippet}</blockquote>}
    <a href={rule.sourceUrl} target="_blank" rel="noreferrer">Open official source <ExternalLink size={13} /></a>
    <p>此视图是当前规则的上下文证据，不代表实时港区、船公司或监管机关批准。</p>
  </section>;
}

function InspectorRow({ label, value }) { return <div><dt>{label}</dt><dd>{String(value || 'DATA REQUIRED')}</dd></div>; }

function buildAdmissionRows(admission, plan) {
  const domains = admission?.domains || {};
  const validator = plan?.validator || {};
  const stability = plan?.stability || validator.stability || {};
  return [
    row('equipment', 'EQUIPMENT', domains.equipment, 'EQUIPMENT', ['GLOBAL', 'CARRIER'], 'Shipment uses an ISO freight container reference or released actual unit.', 'Confirm actual allocation and unit data.', false),
    row('csc', 'CSC', domains.csc, 'CSC', ['GLOBAL', 'CARRIER'], 'An actual freight container must carry valid approval and examination evidence.', 'Enter actual CSC plate and examination evidence.', false),
    row('massAndVGM', 'MASS / VGM', domains.massAndVGM, 'VGM', ['GLOBAL', 'CHINA', 'PORT'], 'International sea carriage activates SOLAS VGM and China implementation controls.', 'Complete mass ledger and shipper VGM evidence.', false),
    row('loadDistribution', 'LOAD DISTRIBUTION', domains.loadDistribution, 'LOAD_DISTRIBUTION', ['GLOBAL', 'CARGO'], 'Placed cargo mass produces longitudinal and transverse load distribution.', 'Review CoG band and operator-specific floor envelope.', true),
    {
      key: 'packingGeometry', label: 'PACKING GEOMETRY', status: validator.valid === true ? 'VALID' : validator.valid === false ? 'BLOCKED' : 'DATA REQUIRED',
      tone: validator.valid === true ? 'ready' : validator.valid === false ? 'FAIL' : 'warning', basis: 'PORTCUBE physical validator', current: validator.valid === true ? `${validator.totals?.placements || plan?.loadedCargo?.length || 0} placements · 0 hard violations` : `${validator.hardViolationCount ?? '—'} hard violations`,
      action: validator.valid === true ? 'Inspect placement evidence' : 'Generate or repair plan', why: 'A packing plan exists only when every placement stays within the declared geometry and hard constraints.', evaluation: validator.status || 'NO BACKEND PLAN', rules: [], scopes: ['CARGO'], ruleScope: 'PACKING_GEOMETRY', level: 'PROJECT_POLICY', authority: 'PORTCUBE', spatial: true
    },
    {
      key: 'stability', label: 'STABILITY', status: stability.status || 'DATA REQUIRED', tone: Number(stability.invalidCount || 0) > 0 ? 'FAIL' : stability.status ? 'ready' : 'warning', basis: 'Support polygon / stack CoG project policy', current: stability.status ? `${stability.invalidCount || 0} invalid · ${stability.warningCount || 0} warning` : 'No backend stability evidence', action: stability.status ? 'Inspect stacks in Twin' : 'Generate backend plan', why: 'Stacked cargo activates support, aggregate stack CoG and unrestrained slenderness checks.', evaluation: stability.model || 'NO BACKEND PLAN', rules: [], scopes: ['CARGO'], ruleScope: 'STABILITY', level: 'PROJECT_POLICY', authority: 'PORTCUBE', spatial: true
    },
    row('transportSecuring', 'SECURING', domains.transportSecuring, 'TRANSPORT_SECURING', ['GLOBAL', 'CARGO'], 'Road/rail/sea acceleration must be resisted by recorded friction, blocking and lashing.', 'Enter certified securing inputs or competent-person plan.', true),
    row('portAccessibility', 'PORT ACCESS', domains.portAccessibility, 'PORT_ACCESS', ['PORT', 'DESTINATION', 'CARGO'], 'Multiple destination ports require complete discharge replay without moving future-port cargo.', 'Review blocked/rehandle and post-unload stability evidence.', true),
    row('dangerousGoods', 'DANGEROUS GOODS', domains.dangerousGoods, 'DANGEROUS_GOODS', ['GLOBAL', 'CHINA', 'PORT', 'CARGO'], 'Dangerous-goods rules apply only when cargo facts mark DG.', 'Provide classification and packing certificate when applicable.', true),
    row('woodPackaging', 'WOOD PACKAGING', domains.woodPackaging, 'WOOD_PACKAGING', ['GLOBAL', 'CHINA', 'DESTINATION', 'CARGO'], 'Raw solid wood packaging activates ISPM 15; processed wood may be exempt.', 'Record material type and treatment mark evidence.', true),
    row('terminalAndVoyage', 'TERMINAL', domains.terminalAndVoyage, 'TERMINAL_ADMISSION', ['TERMINAL', 'CARRIER', 'PORT'], 'The demo nominates NBSCT, but public pages do not provide live acceptance.', 'Confirm booking, voyage and terminal acceptance externally.', false)
  ];
}

function row(key, label, domain, ruleScope, scopes, why, fallbackAction, spatial) {
  const evidence = domain?.evidence || {};
  const status = domain?.status || domain?.normalizedStatus || 'DATA REQUIRED';
  const normalized = domain?.normalizedStatus || normalizeStatus(status);
  const rules = evidence.rules || [];
  return {
    key, label, status, tone: normalized === 'BLOCKED' ? 'FAIL' : normalized === 'READY' ? 'ready' : normalized === 'DATA_REQUIRED' ? 'warning' : 'info',
    basis: rules[0]?.id || evidence.model || ruleScope, current: describeEvidence(key, evidence), action: evidence.missingInputs?.length ? `Provide ${evidence.missingInputs.slice(0, 2).join(' + ')}` : fallbackAction,
    why, evaluation: evidence.model || status, rules, scopes, ruleScope, level: rules[0]?.level || 'PROJECT_POLICY', authority: rules[0]?.authority || 'PORTCUBE / EXTERNAL', spatial
  };
}

function describeEvidence(key, evidence) {
  if (key === 'massAndVGM') return `${evidence.massLedger?.calculatedGrossMassKg ?? '—'} kg estimate · VGM ${evidence.vgm?.status || 'DATA REQUIRED'}`;
  if (key === 'loadDistribution') return `${evidence.centreOfGravity?.longitudinalOffsetPercent ?? '—'}% longitudinal · ${evidence.centreOfGravity?.guidanceStatus || 'DATA REQUIRED'}`;
  if (key === 'portAccessibility') return `${evidence.blockedCount ?? '—'} blocked · ${evidence.rehandleCount ?? '—'} rehandle · ${evidence.status || 'DATA REQUIRED'}`;
  if (key === 'transportSecuring') return `${evidence.profileId || 'PROFILE REQUIRED'} · ${evidence.missingInputs?.length || 0} missing inputs`;
  if (key === 'equipment') return `${evidence.mode || 'REFERENCE_PROFILE'} · ${evidence.selectedType || evidence.recommendedType || 'NO SELECTION'}`;
  if (key === 'csc') return `${evidence.status || 'DATA REQUIRED'} · ${evidence.missingInputs?.length || 0} missing inputs`;
  if (key === 'terminalAndVoyage') return `${evidence.terminal || 'TERMINAL REQUIRED'} · public process only`;
  return `${evidence.cargoCount ?? 0} applicable cargo · ${evidence.status || 'see domain status'}`;
}

function normalizeStatus(value) { if (/BLOCK|INVALID|INADEQUATE/.test(value)) return 'BLOCKED'; if (/DATA|UNRESOLVED|NOT_APPLICABLE_TO_REFERENCE/.test(value)) return 'DATA_REQUIRED'; if (/PASS|VALID|COMPLETE|READY|NOT_APPLICABLE/.test(value)) return 'READY'; return 'CONDITIONAL'; }
function statusTone(value) { return value === 'BLOCKED' ? 'FAIL' : value === 'PRECHECK_COMPLETE' ? 'ready' : value === 'DATA_REQUIRED' ? 'warning' : 'info'; }
