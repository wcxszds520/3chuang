import { useMemo, useState } from 'react';
import { buildProjectionItems, buildProjectionLegend } from './planProjectionModel.js';
import { getPlanSourceLabel } from '../../domain/provenance/planSource.js';

const VIEW_MODES = Object.freeze([
  ['sku', 'SKU 视图'],
  ['port', '港序视图'],
  ['risk', '风险视图'],
  ['handling', '作业方式']
]);

export function PlanProjection({ plan, className = '', compact = false, showLegend = true, interactive = false }) {
  const container = plan?.containerInfo;
  const cargo = useMemo(() => Array.isArray(plan?.loadedCargo) ? plan.loadedCargo : [], [plan?.loadedCargo]);
  const [viewMode, setViewMode] = useState('sku');
  const [hiddenGroups, setHiddenGroups] = useState(() => new Set());
  const [hoveredGroup, setHoveredGroup] = useState('');
  const items = useMemo(() => buildProjectionItems(cargo, viewMode), [cargo, viewMode]);
  const geometry = useMemo(() => container ? buildProjection(container, items) : null, [container, items]);
  const legend = useMemo(() => buildProjectionLegend(items), [items]);

  const selectView = (mode) => {
    setViewMode(mode);
    setHiddenGroups(new Set());
    setHoveredGroup('');
  };
  const toggleGroup = (key) => setHiddenGroups((current) => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  if (!geometry) return <div className={`plan-projection plan-projection--empty ${className}`}>暂无可显示的装箱方案</div>;
  return (
    <figure className={`plan-projection ${compact ? 'plan-projection--compact' : ''} ${className}`}>
      {interactive && <div className="projection-view-switch" aria-label="装箱图查看方式">{VIEW_MODES.map(([key, label]) => <button type="button" key={key} className={viewMode === key ? 'active' : ''} aria-pressed={viewMode === key} onClick={() => selectView(key)}>{label}</button>)}</div>}
      <svg viewBox="0 0 800 390" role="img" aria-label={`当前方案轴测投影，已装入 ${cargo.length} 件`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="floor-fill" x1="0" x2="1"><stop offset="0" stopColor="#d8dfda" /><stop offset="1" stopColor="#edf1ee" /></linearGradient>
        </defs>
        <polygon points={geometry.floor} fill="url(#floor-fill)" stroke="#8c9892" strokeWidth="1.5" />
        <polyline points={geometry.backFrame} fill="none" stroke="#53605a" strokeWidth="3" />
        {geometry.boxes.map((box) => (
          <g key={box.key} data-cargo-id={box.cargoId} data-projection-group={box.groupKey} className={hiddenGroups.has(box.groupKey) ? 'projection-box projection-box--hidden' : hoveredGroup && hoveredGroup !== box.groupKey ? 'projection-box projection-box--muted' : 'projection-box'}>
            <polygon points={box.side} fill={shade(box.color, -18)} stroke={box.accent} strokeWidth="0.7" />
            <polygon points={box.front} fill={box.color} stroke={box.accent} strokeWidth="0.7" />
            <polygon points={box.top} fill={shade(box.color, 18)} stroke={box.accent} strokeWidth="0.7" />
          </g>
        ))}
        <polyline points={geometry.topFrame} fill="none" stroke="#35413c" strokeWidth="3" />
        <line x1={geometry.doorA[0]} y1={geometry.doorA[1]} x2={geometry.doorB[0]} y2={geometry.doorB[1]} stroke="#bf6a39" strokeWidth="5" />
        <text x={geometry.doorLabel[0]} y={geometry.doorLabel[1]} className="projection-label">唯一门端</text>
      </svg>
      <figcaption>
        <span>{getPlanSourceLabel(plan)} · {container.typeId}</span>
        <span>已装 {cargo.length} 件 · 从后门作业</span>
      </figcaption>
      {showLegend && <div className="projection-legend" aria-label="货物外观图例">
        {legend.map((item) => interactive ? <button type="button" key={item.key} className={hiddenGroups.has(item.key) ? 'is-hidden' : ''} aria-pressed={!hiddenGroups.has(item.key)} onClick={() => toggleGroup(item.key)} onMouseEnter={() => setHoveredGroup(item.key)} onMouseLeave={() => setHoveredGroup('')}><i style={{ background: item.color }} /><span>{item.label}</span><small>{item.count}</small></button> : <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}
      </div>}
    </figure>
  );
}

function buildProjection(container, cargo) {
  const L = Number(container.innerLength || 1);
  const W = Number(container.innerWidth || 1);
  const H = Number(container.innerHeight || 1);
  const sx = 485 / L;
  const sz = 125 / W;
  const sy = 225 / H;
  const project = (x, y, z) => [118 + x * sx + z * sz, 337 - y * sy - z * sz * 0.48 - x * sx * 0.1];
  const p000 = project(0, 0, 0);
  const pL00 = project(L, 0, 0);
  const p00W = project(0, 0, W);
  const pL0W = project(L, 0, W);
  const p0H0 = project(0, H, 0);
  const pLH0 = project(L, H, 0);
  const p0HW = project(0, H, W);
  const pLHW = project(L, H, W);

  const sorted = [...cargo].sort((a, b) => (Number(a.x) + Number(a.z) + Number(a.y)) - (Number(b.x) + Number(b.z) + Number(b.y)));
  const boxes = sorted.map((item, index) => {
    const x0 = Number(item.x); const x1 = x0 + Number(item.l);
    const y0 = Number(item.y); const y1 = y0 + Number(item.h);
    const z0 = Number(item.z); const z1 = z0 + Number(item.w);
    const a = project(x0, y0, z0); const b = project(x1, y0, z0); const c = project(x1, y1, z0); const d = project(x0, y1, z0);
    const f = project(x1, y0, z1); const g = project(x1, y1, z1); const h = project(x0, y1, z1);
    return {
      key: `${item.cargoId || 'cargo'}_${item.loadingIndex || index}`,
      cargoId: item.cargoId,
      color: item.color,
      accent: item.accent,
      groupKey: item.groupKey,
      front: points(a, b, c, d),
      side: points(b, f, g, c),
      top: points(d, c, g, h)
    };
  });

  return {
    boxes,
    floor: points(p000, pL00, pL0W, p00W),
    backFrame: points(p000, p0H0, p0HW, p00W),
    topFrame: points(p0H0, pLH0, pLHW, p0HW, p0H0, p000, pL00, pLH0, pLHW, pL0W, pL00),
    doorA: pL00,
    doorB: pLH0,
    doorLabel: [pLH0[0] + 10, pLH0[1] - 9]
  };
}

function points(...values) {
  return values.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift) => Math.max(0, Math.min(255, (value >> shift & 255) + amount));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}
