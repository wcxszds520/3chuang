'use strict';

const fs = require('fs');
const path = require('path');
const HybridConstraintPackingSolverV24 = require('../services/HybridConstraintPackingSolverV24');
const HybridConstraintPackingSolverV25 = require('../services/HybridConstraintPackingSolverV25');
const { buildProjectBenchmarkCases } = require('./projectBenchmarkCases');
const { analyzeLayoutQuality } = require('../services/packing/LayoutQualityAnalyzer');
const { analyzeVoidJustification } = require('../services/packing/VoidJustificationAnalyzer');
const { analyzeSecuring } = require('../services/packing/SecuringAnalyzer');

const OUTPUT = path.resolve(__dirname, '../../artifacts/competition-2.5/dataset-a-visual-comparison.html');
const VIEWPORT = Object.freeze({ width: 740, height: 142, padding: 8 });
const PORT_COLORS = Object.freeze({ 1: '#55e0c0', 2: '#62a9ff', 3: '#d69a4b', 4: '#b88cff' });

async function main() {
  const cases = await buildProjectBenchmarkCases();
  const benchmarkCase = cases.find((entry) => entry.id === 'DATASET-A-212');
  if (!benchmarkCase) throw new Error('DATASET-A-212 not found');
  const context = { strategy: 'OPERATION', caseContext: { caseDate: '2026-08-24', route: routeFor(benchmarkCase.cargoList) } };
  const before = await new HybridConstraintPackingSolverV24().generatePackingPlan(benchmarkCase.cargoList, benchmarkCase.container, context);
  const after = await new HybridConstraintPackingSolverV25().generatePackingPlan(benchmarkCase.cargoList, benchmarkCase.container, context);
  const plans = [
    enrich('V2.4 · OPERATION', '回退基线', before, benchmarkCase),
    enrich('V2.5 · OPERATION', 'FINAL FREEZE', after, benchmarkCase)
  ];
  const reduction = percentReduction(plans[0].layout.internalVoidVolume, plans[1].layout.internalVoidVolume);
  fs.writeFileSync(OUTPUT, page(plans, benchmarkCase.container, reduction), 'utf8');
  process.stdout.write(`${OUTPUT}\n`);
}

function enrich(title, badge, result, benchmarkCase) {
  const placements = result.loadedCargo || [];
  const layout = analyzeLayoutQuality({ placements, container: benchmarkCase.container, cargoList: benchmarkCase.cargoList });
  const securing = analyzeSecuring({ placements, container: benchmarkCase.container, layoutQuality: layout });
  const voids = analyzeVoidJustification({
    placements,
    cargoList: benchmarkCase.cargoList,
    container: benchmarkCase.container,
    layoutQuality: layout,
    route: routeFor(benchmarkCase.cargoList),
    securing
  });
  return {
    title,
    badge,
    placements,
    layout,
    voids,
    candidate: result.candidateId || result.constraintMeta?.portfolio?.selectedCandidateId || '—',
    algorithm: result.sourceAlgorithm || result.metrics?.selectedCandidateAlgorithm || result._algorithmId || '—',
    longitudinalCog: number(result.loadDistribution?.centreOfGravity?.longitudinalOffsetPercent
      ?? result.metrics?.loadDistribution?.centreOfGravity?.longitudinalOffsetPercent)
  };
}

function page(plans, container, reduction) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Dataset A · V2.4 / V2.5 placement truth</title>
  <style>
    *{box-sizing:border-box}html,body{width:1920px;height:1080px;margin:0;overflow:hidden}
    body{display:grid;grid-template-rows:84px 1fr 28px;gap:12px;padding:32px 48px;color:#eef5f7;background:
      radial-gradient(circle at 86% 4%,rgba(24,123,119,.24),transparent 31%),
      linear-gradient(rgba(73,105,120,.08) 1px,transparent 1px),
      linear-gradient(90deg,rgba(73,105,120,.08) 1px,transparent 1px),#07141b;
      background-size:auto,32px 32px,32px 32px,auto;font-family:"Segoe UI","Microsoft YaHei",sans-serif}
    header{display:flex;align-items:center;justify-content:space-between}
    header p{margin:0 0 8px;color:#56e5d0;font:800 13px/1.1 ui-monospace,monospace;letter-spacing:.18em}
    header h1{margin:0;font-size:34px;line-height:1.05;letter-spacing:-.025em}
    .delta{display:flex;align-items:center;gap:13px;padding:11px 16px;border:1px solid #286f70;border-radius:9px;background:#0a2429}
    .delta span{color:#8ca4ad;font-size:12px}.delta strong{color:#58ead4;font:800 27px/1 ui-monospace,monospace}
    main{display:grid;grid-template-columns:1fr 1fr;gap:24px;min-height:0}
    article{display:grid;grid-template-rows:84px 1fr;min-width:0;overflow:hidden;border:1px solid #29424c;border-radius:12px;background:rgba(8,27,35,.92)}
    article.after{border-color:#248c82;background:rgba(7,35,40,.94)}
    .plan-head{display:flex;align-items:center;justify-content:space-between;padding:15px 20px;border-bottom:1px solid #29424c}
    .plan-head h2{margin:0 0 5px;font-size:22px}.plan-head p{margin:0;color:#78909a;font:600 11px/1.2 ui-monospace,monospace}
    .metrics{display:flex;align-items:center;gap:16px}.metric{text-align:right}.metric span{display:block;color:#78909a;font-size:10px}.metric strong{font:800 16px/1.3 ui-monospace,monospace}
    .badge{padding:6px 9px;color:#a5b6bc;border:1px solid #42606a;border-radius:999px;font:700 9px/1 ui-monospace,monospace;letter-spacing:.08em}
    .after .badge{color:#59ead5;border-color:#248c82}.views{display:grid;grid-template-rows:repeat(4,1fr);min-height:0}
    .view{display:grid;grid-template-columns:100px 1fr;align-items:center;gap:10px;min-height:0;padding:8px 17px;border-bottom:1px solid #203943}
    .view:last-child{border-bottom:0}.view-label b{display:block;color:#dce8eb;font-size:13px}.view-label span{display:block;margin-top:4px;color:#6f8994;font-size:9px;line-height:1.35}
    svg{display:block;width:100%;height:100%;max-height:154px}.frame{fill:#0b1d25;stroke:#49626d;stroke-width:1.5}.grid{stroke:#16303a;stroke-width:1}
    .cargo{stroke:#07141b;stroke-width:.7;vector-effect:non-scaling-stroke}.void-unexplained{fill:rgba(248,110,76,.28);stroke:#ff8b68;stroke-width:2;stroke-dasharray:6 4}
    .void-corridor{fill:rgba(76,221,196,.035);stroke:#4ddbc4;stroke-width:1.5;stroke-dasharray:8 6}.void-securing{fill:rgba(222,169,70,.08);stroke:#dfa946;stroke-width:1.5;stroke-dasharray:5 4}
    footer{display:flex;align-items:center;justify-content:space-between;color:#80949c;font-size:10px}
    .legend{display:flex;gap:15px}.legend i{display:inline-block;width:9px;height:9px;margin-right:5px;border-radius:2px;vertical-align:-1px}
  </style>
</head>
<body>
  <header>
    <div><p>PORTCUBE COMPETITION 2.5 · SOLVER PLACEMENT TRUTH</p><h1>Dataset A · 同坐标侧视 / 顶视 / 门视 / 空隙解释</h1></div>
    <div class="delta"><span>内部空隙体积<br>确定性下降</span><strong>−${reduction.toFixed(2)}%</strong></div>
  </header>
  <main>
    ${plans.map((plan, index) => planCard(plan, container, index === 1)).join('')}
  </main>
  <footer>
    <div class="legend"><span><i style="background:${PORT_COLORS[1]}"></i>第 1 港</span><span><i style="background:${PORT_COLORS[2]}"></i>第 2 港</span><span><i style="background:${PORT_COLORS[3]}"></i>第 3 港</span><span><i style="background:#ff8b68"></i>未解释空隙</span><span><i style="border:1px dashed #4ddbc4"></i>港序作业通道</span></div>
    <span>真实 solver placements · x=箱长 · y=重力 · z=箱宽 · 两列使用完全相同投影比例</span>
  </footer>
</body>
</html>`;
}

function planCard(plan, container, after) {
  return `<article class="${after ? 'after' : ''}">
    <div class="plan-head">
      <div><h2>${plan.title}</h2><p>${escapeHtml(plan.candidate)} · ${escapeHtml(plan.algorithm)}</p></div>
      <div class="metrics">
        <div class="metric"><span>内部空隙</span><strong>${m3(plan.layout.internalVoidVolume)} m³</strong></div>
        <div class="metric"><span>横截面 P10</span><strong>${percent(plan.layout.crossSectionFillP10)}</strong></div>
        <div class="metric"><span>低填充切片</span><strong>${number(plan.layout.lowFillInteriorSliceCount)}</strong></div>
        <div class="metric"><span>纵向 CoG</span><strong>${number(plan.longitudinalCog).toFixed(2)}%</strong></div>
        <span class="badge">${plan.badge}</span>
      </div>
    </div>
    <div class="views">
      ${view('侧视', 'x / y', plan, container, 'side')}
      ${view('顶视', 'x / z', plan, container, 'top')}
      ${view('门视', 'z / y', plan, container, 'door')}
      ${view('空隙', '同侧视 · 当前 V2.5 分类器', plan, container, 'void')}
    </div>
  </article>`;
}

function view(title, subtitle, plan, container, mode) {
  return `<section class="view"><div class="view-label"><b>${title}</b><span>${subtitle}</span></div>${projection(plan, container, mode)}</section>`;
}

function projection(plan, container, mode) {
  const dimensions = axes(container, mode);
  const scale = Math.min(
    (VIEWPORT.width - VIEWPORT.padding * 2) / dimensions.a,
    (VIEWPORT.height - VIEWPORT.padding * 2) / dimensions.b
  );
  const originX = (VIEWPORT.width - dimensions.a * scale) / 2;
  const originY = (VIEWPORT.height - dimensions.b * scale) / 2;
  const transform = (x, y, width, height) => ({
    x: originX + x * scale,
    y: originY + (dimensions.b - y - height) * scale,
    width: Math.max(.7, width * scale),
    height: Math.max(.7, height * scale)
  });
  const grid = [];
  for (let x = 1000; x < dimensions.a; x += 1000) {
    const px = originX + x * scale;
    grid.push(`<line class="grid" x1="${px}" y1="${originY}" x2="${px}" y2="${originY + dimensions.b * scale}"/>`);
  }
  const zones = mode === 'void' ? (plan.voids.zones || []).map((zone) => zoneRect(zone, dimensions, transform)).filter(Boolean).join('') : '';
  const cargo = [...plan.placements].sort((left, right) => number(right.portSequence) - number(left.portSequence))
    .map((item) => cargoRect(item, mode, transform)).join('');
  return `<svg viewBox="0 0 ${VIEWPORT.width} ${VIEWPORT.height}" aria-label="${mode} projection">
    <rect class="frame" x="${originX}" y="${originY}" width="${dimensions.a * scale}" height="${dimensions.b * scale}" rx="2"/>
    ${grid.join('')}${zones}${cargo}
  </svg>`;
}

function axes(container, mode) {
  if (mode === 'top') return { a: number(container.innerLength), b: number(container.innerWidth), x: 'x', y: 'z', w: 'l', h: 'w' };
  if (mode === 'door') return { a: number(container.innerWidth), b: number(container.innerHeight), x: 'z', y: 'y', w: 'w', h: 'h' };
  return { a: number(container.innerLength), b: number(container.innerHeight), x: 'x', y: 'y', w: 'l', h: 'h' };
}

function cargoRect(item, mode, transform) {
  const map = mode === 'top'
    ? [number(item.x), number(item.z), number(item.l), number(item.w)]
    : mode === 'door'
      ? [number(item.z), number(item.y), number(item.w), number(item.h)]
      : [number(item.x), number(item.y), number(item.l), number(item.h)];
  const rect = transform(...map);
  const color = PORT_COLORS[number(item.portSequence)] || '#8aa4ad';
  const opacity = mode === 'void' ? .36 : .72;
  return `<rect class="cargo" x="${round(rect.x)}" y="${round(rect.y)}" width="${round(rect.width)}" height="${round(rect.height)}" rx=".7" fill="${color}" fill-opacity="${opacity}"/>`;
}

function zoneRect(zone, dimensions, transform) {
  const bounds = zone.boundsMm || {};
  let map;
  if (dimensions.y === 'z') map = [number(bounds.minX), number(bounds.minZ), number(bounds.maxX) - number(bounds.minX), number(bounds.maxZ) - number(bounds.minZ)];
  else if (dimensions.x === 'z') map = [number(bounds.minZ), number(bounds.minY), number(bounds.maxZ) - number(bounds.minZ), number(bounds.maxY) - number(bounds.minY)];
  else map = [number(bounds.minX), number(bounds.minY), number(bounds.maxX) - number(bounds.minX), number(bounds.maxY) - number(bounds.minY)];
  if (map[2] <= 0 || map[3] <= 0) return '';
  const rect = transform(...map);
  const className = zone.classification === 'UNEXPLAINED_VOID' ? 'void-unexplained'
    : ['PORT_ACCESS', 'PORT_ACCESS_CORRIDOR'].includes(zone.classification) ? 'void-corridor'
      : ['SECURING_SPACE', 'SECURING_ZONE'].includes(zone.classification) ? 'void-securing' : null;
  if (!className) return '';
  return `<rect class="${className}" x="${round(rect.x)}" y="${round(rect.y)}" width="${round(rect.width)}" height="${round(rect.height)}" rx="2"/>`;
}

function routeFor(cargoList) {
  return [...new Set(cargoList.map((item) => number(item.portSequence || 1)))].sort((a, b) => a - b)
    .map((portSequence) => ({ portSequence, portCode: `PORT-${portSequence}` }));
}

function percentReduction(before, after) { return before > 0 ? (before - after) / before * 100 : 0; }
function percent(value) { return `${(number(value) * 100).toFixed(2)}%`; }
function m3(value) { return (number(value) / 1e9).toFixed(3); }
function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }

if (require.main === module) main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

module.exports = { main, projection };
