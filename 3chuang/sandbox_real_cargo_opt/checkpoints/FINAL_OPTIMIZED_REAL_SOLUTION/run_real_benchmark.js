'use strict';
/**
 * run_real_benchmark.js — 真实货代数据基准 harness（底座 = FINAL_OPTIMIZED_SOLUTION）
 *
 * 指标（独立重算）：
 *  - loadedCount / totalInput（真实件数装载率）
 *  - aggregateUtil（Σ装载体积 / Σ柜容 ×100）
 *  - violations（独立检查器：重叠/越界/支撑/易碎/不可堆叠/传递层高/重压轻/姿态/LIFO/承载）
 *  - validatorHard（项目 PlanValidator）
 *  - avgMs / maxMs（30s 单 case 超时保护）
 */

const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

const SANDBOX_ROOT = path.resolve(__dirname, '..');
const CASE_TIMEOUT_MS = 30000;

const AlgorithmOrchestrator = require(path.join(SANDBOX_ROOT, 'backend/services/AlgorithmOrchestrator'));
const PlanValidator = require(path.join(SANDBOX_ROOT, 'backend/services/packing/PlanValidator'));
const { buildRealBenchmarkCases } = require(path.join(SANDBOX_ROOT, 'backend/services/realcargo/IngestRealCargo'));
const { checkPhysical, checkOrientation, checkLifo } = require('./independent_check');

const NOOP_CACHE = { get: async () => null, set: async () => {} };

function parseArgs(argv) {
  const args = { algorithms: 'realistic4d-multi-strategy', out: null, seed: 42, quiet: false, timeoutMs: CASE_TIMEOUT_MS };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--algorithms') args.algorithms = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--seed') args.seed = Number(argv[++i]);
    else if (a === '--timeout') args.timeoutMs = Number(argv[++i]);
    else if (a === '--quiet') args.quiet = true;
  }
  return args;
}

async function runCase(orchestrator, benchmarkCase, algorithmId, seed, timeoutMs) {
  const container = { ...benchmarkCase.container };
  const cargoList = benchmarkCase.cargoList.map((c) => ({ ...c }));
  const containerVolume = container.innerLength * container.innerWidth * container.innerHeight;
  const totalInput = cargoList.reduce((s, c) => s + Math.max(1, Number(c.quantity || 1)), 0);
  const inputVolume = cargoList.reduce((s, c) => s + (c.length || 0) * (c.width || 0) * (c.height || 0) * Math.max(1, Number(c.quantity || 1)), 0);

  const started = performance.now();
  let result;
  let timedOut = false;
  try {
    result = await Promise.race([
      orchestrator.execute({ cargoList, container, options: { algorithmId, seed } }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('CASE_TIMEOUT')), timeoutMs))
    ]);
  } catch (err) {
    timedOut = err.message === 'CASE_TIMEOUT';
    if (!timedOut) throw err;
  }
  const wallMs = performance.now() - started;

  if (timedOut) {
    return {
      id: benchmarkCase.id, ok: false, wallMs, containerVolume, totalInput,
      loadedCount: 0, loadedVolume: 0, utilization: 0, inputVolume, loadRate: 0,
      violations: [{ code: 'CASE_TIMEOUT', message: `solve exceeded ${timeoutMs}ms` }],
      validatorHard: -1
    };
  }

  const placements = result.loadedCargo || [];
  const loadedVolume = placements.reduce((s, p) => s + (p.l || 0) * (p.w || 0) * (p.h || 0), 0);
  const utilization = containerVolume > 0 ? (loadedVolume / containerVolume) * 100 : 0;

  const { violations: phys } = checkPhysical(placements, container);
  const orientViolations = checkOrientation(placements, cargoList);
  const lifoViolations = checkLifo(placements);
  const violations = [...phys, ...orientViolations, ...lifoViolations];

  let validatorHard = -1;
  try {
    const v = new PlanValidator().validate({ placements, cargoList, container });
    validatorHard = v.hardViolationCount || 0;
  } catch (e) { validatorHard = -1; }

  return {
    id: benchmarkCase.id,
    ok: true,
    wallMs: Math.round(wallMs * 100) / 100,
    containerVolume,
    totalInput,
    loadedCount: placements.length,
    loadRate: totalInput > 0 ? Math.round((placements.length / totalInput) * 1000) / 1000 : 0,
    engineUnloadedCount: (result.unloadedCargo || []).length,
    loadedVolume: Math.round(loadedVolume),
    inputVolume,
    inputRatio: Math.round((inputVolume / containerVolume) * 1000) / 1000,
    utilization: Math.round(utilization * 1000) / 1000,
    violations,
    validatorHard,
    strategyUsed: result.metrics && result.metrics.strategy_used,
    cog: result.cog ? { lateral: result.cogOffset ? result.cogOffset.lateral : null, longitudinal: result.cogOffset ? result.cogOffset.longitudinal : null } : null
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const algorithms = args.algorithms.split(',').map((s) => s.trim()).filter(Boolean);
  const suite = buildRealBenchmarkCases();

  const allResults = {};
  for (const algorithmId of algorithms) {
    const orchestrator = new AlgorithmOrchestrator({ cache: NOOP_CACHE, timeoutMs: args.timeoutMs, debugMode: false });
    const rows = [];
    for (const benchmarkCase of suite) {
      let row;
      try {
        row = await runCase(orchestrator, benchmarkCase, algorithmId, args.seed, args.timeoutMs);
      } catch (err) {
        row = {
          id: benchmarkCase.id, ok: false, wallMs: 0, containerVolume: 0, totalInput: 0,
          loadedCount: 0, loadedVolume: 0, utilization: 0, inputVolume: 0, loadRate: 0,
          violations: [{ code: 'ENGINE_ERROR', message: String(err.message || err).slice(0, 300) }],
          validatorHard: -1
        };
      }
      if (!args.quiet) {
        const flag = row.violations.length > 0 ? `VIOLATIONS(${[...new Set(row.violations.map((v) => v.code))].join(',')})` : 'clean';
        process.stderr.write(`  [${algorithmId}] ${row.id}: util=${row.utilization.toFixed(2)}% load=${row.loadedCount}/${row.totalInput} ${row.wallMs.toFixed(0)}ms ${flag}\n`);
      }
      rows.push(row);
    }

    const totalContainerVolume = rows.reduce((s, r) => s + (r.containerVolume || 0), 0);
    const totalLoadedVolume = rows.reduce((s, r) => s + (r.loadedVolume || 0), 0);
    const totalInput = rows.reduce((s, r) => s + (r.totalInput || 0), 0);
    const totalLoaded = rows.reduce((s, r) => s + (r.loadedCount || 0), 0);
    const aggregateUtil = totalContainerVolume > 0 ? (totalLoadedVolume / totalContainerVolume) * 100 : 0;
    const avgMs = rows.reduce((s, r) => s + r.wallMs, 0) / rows.length;
    const maxMs = rows.reduce((m, r) => Math.max(m, r.wallMs), 0);
    const violationCount = rows.reduce((s, r) => s + r.violations.length, 0);

    allResults[algorithmId] = {
      algorithmId,
      caseCount: rows.length,
      aggregateUtil: Math.round(aggregateUtil * 1000) / 1000,
      totalInput,
      totalLoaded,
      loadRate: totalInput > 0 ? Math.round((totalLoaded / totalInput) * 1000) / 1000 : 0,
      avgMs: Math.round(avgMs * 100) / 100,
      maxMs: Math.round(maxMs * 100) / 100,
      violationCount,
      violationCodes: [...new Set(rows.flatMap((r) => r.violations.map((v) => v.code)))],
      validatorHardTotal: rows.reduce((s, r) => s + Math.max(0, r.validatorHard), 0),
      rows
    };

    process.stderr.write(`[REAL-SUMMARY ${algorithmId}] aggUtil=${aggregateUtil.toFixed(3)}% loaded=${totalLoaded}/${totalInput} avgMs=${avgMs.toFixed(1)} maxMs=${maxMs.toFixed(0)} violations=${violationCount} validatorHard=${allResults[algorithmId].validatorHardTotal}\n`);
  }

  const payload = { generatedAt: new Date().toISOString(), seed: args.seed, suite: 'real_forwarder', results: allResults };
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), JSON.stringify(payload, null, 2), 'utf8');
  }
  for (const algorithmId of algorithms) {
    const r = allResults[algorithmId];
    process.stdout.write(`REAL_RESULT algo=${r.algorithmId} aggUtil=${r.aggregateUtil} loaded=${r.totalLoaded}/${r.totalInput} loadRate=${r.loadRate} avgMs=${r.avgMs} maxMs=${r.maxMs} violations=${r.violationCount} validatorHard=${r.validatorHardTotal}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err.message}\n`);
  process.exit(1);
});
