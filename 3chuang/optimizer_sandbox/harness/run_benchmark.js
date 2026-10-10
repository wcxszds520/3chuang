'use strict';
/**
 * run_benchmark.js — 沙盒基准测试 harness
 *
 * 测试集 = 项目给定货物录入数据（DATASET-A-212 / DATASET-B-MIXED-69）
 *        + 确定性挑战语料（physicalPackingChallengeCases 子集/全集）
 *        + 固定合成语料（solverBenchmarkCases 子集/全集）
 *
 * 指标（全部独立重算，不信任引擎自报值）：
 *  - aggregateUtil  = Σ loadedVolume / Σ containerVolume × 100
 *  - meanUtil       = 各 case 利用率均值
 *  - avgMs / maxMs  = 每 case 求解耗时（wall clock）
 *  - violations     = 独立检查器违规总数（BOUNDS/OVERLAP/SUPPORT/.../LIFO）
 *  - validatorHard  = 项目 PlanValidator 硬违规数（参考门禁）
 *
 * 用法:
 *   node harness/run_benchmark.js --algorithms realistic4d-multi-strategy --suite core --out r.json
 */

const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

// --root 可指向基线镜像（原版代码），默认沙盒根
let ROOT_ARG = null;
{
  const i = process.argv.indexOf('--root');
  if (i > 0) { ROOT_ARG = path.resolve(process.argv[i + 1]); process.argv.splice(i, 2); }
}
const SANDBOX_ROOT = ROOT_ARG || path.resolve(__dirname, '..');
const CASE_TIMEOUT_MS = 30000; // 铁律：单次运行超时保护

const AlgorithmOrchestrator = require(path.join(SANDBOX_ROOT, 'backend/services/AlgorithmOrchestrator'));
const PlanValidator = require(path.join(SANDBOX_ROOT, 'backend/services/packing/PlanValidator'));
const { buildProjectBenchmarkCases } = require(path.join(SANDBOX_ROOT, 'backend/benchmarks/projectBenchmarkCases'));
const { buildPhysicalPackingChallengeCases } = require(path.join(SANDBOX_ROOT, 'backend/benchmarks/physicalPackingChallengeCases'));
const { buildSyntheticBenchmarkCases } = require(path.join(SANDBOX_ROOT, 'backend/benchmarks/solverBenchmarkCases'));
const { checkPhysical, checkOrientation, checkLifo } = require('./independent_check');

const NOOP_CACHE = { get: async () => null, set: async () => {} };

function parseArgs(argv) {
  const args = { algorithms: 'realistic4d-multi-strategy', suite: 'core', out: null, seed: 42, quiet: false, timeoutMs: CASE_TIMEOUT_MS };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--algorithms') args.algorithms = argv[++i];
    else if (a === '--suite') args.suite = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--seed') args.seed = Number(argv[++i]);
    else if (a === '--timeout') args.timeoutMs = Number(argv[++i]);
    else if (a === '--quiet') args.quiet = true;
  }
  return args;
}

async function buildSuite(suite) {
  const cases = [];
  const projectCases = await buildProjectBenchmarkCases();
  cases.push(...projectCases);

  if (suite !== 'datasets-only') {
    const challenge = buildPhysicalPackingChallengeCases(suite === 'full' ? 64 : 64);
    const step = suite === 'full' ? 1 : 4;
    for (let i = 0; i < challenge.length; i += step) cases.push(challenge[i]);

    const fixed = buildSyntheticBenchmarkCases(suite === 'full' ? 48 : 48);
    const fstep = suite === 'full' ? 1 : 6;
    for (let i = 0; i < fixed.length; i += fstep) cases.push(fixed[i]);
  }
  return cases;
}

async function runCase(orchestrator, benchmarkCase, algorithmId, seed, timeoutMs) {
  const container = { ...benchmarkCase.container };
  const cargoList = benchmarkCase.cargoList.map(c => ({ ...c }));
  const containerVolume = container.innerLength * container.innerWidth * container.innerHeight;

  const inputVolume = cargoList.reduce((s, c) => s + (c.length || 0) * (c.width || 0) * (c.height || 0) * Math.max(1, Number(c.quantity || 1)), 0);

  const started = performance.now();
  let result, timedOut = false;
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
      id: benchmarkCase.id, ok: false, wallMs, containerVolume,
      loadedCount: 0, loadedVolume: 0, utilization: 0, inputVolume,
      violations: [{ code: 'CASE_TIMEOUT', message: `solve exceeded ${timeoutMs}ms` }],
      validatorHard: -1
    };
  }

  const placements = result.loadedCargo || [];
  const loadedVolume = placements.reduce((s, p) => s + (p.l || 0) * (p.w || 0) * (p.h || 0), 0);
  const utilization = containerVolume > 0 ? (loadedVolume / containerVolume) * 100 : 0;

  // 独立物理检查（零容忍）
  const { violations: phys } = checkPhysical(placements, container);
  const orientViolations = checkOrientation(placements, cargoList);
  const lifoViolations = checkLifo(placements);
  const violations = [...phys, ...orientViolations, ...lifoViolations];

  // 项目自有 PlanValidator（参考门禁）
  let validatorHard = -1;
  try {
    const v = new PlanValidator().validate({ placements, cargoList, container });
    validatorHard = v.hardViolationCount || 0;
  } catch (e) {
    validatorHard = -1;
  }

  const engineUnloaded = (result.unloadedCargo || []).length;

  return {
    id: benchmarkCase.id,
    ok: true,
    wallMs: Math.round(wallMs * 100) / 100,
    containerVolume,
    loadedCount: placements.length,
    engineUnloadedCount: engineUnloaded,
    loadedVolume: Math.round(loadedVolume),
    utilization: Math.round(utilization * 1000) / 1000,
    inputVolume,
    inputRatio: Math.round((inputVolume / containerVolume) * 1000) / 1000,
    violations,
    validatorHard
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const algorithms = args.algorithms.split(',').map(s => s.trim()).filter(Boolean);
  const suite = await buildSuite(args.suite);

  const allResults = {};
  for (const algorithmId of algorithms) {
    const orchestrator = new AlgorithmOrchestrator({
      cache: NOOP_CACHE,
      timeoutMs: args.timeoutMs,
      debugMode: false
    });
    const rows = [];
    for (const benchmarkCase of suite) {
      let row;
      try {
        row = await runCase(orchestrator, benchmarkCase, algorithmId, args.seed, args.timeoutMs);
      } catch (err) {
        row = {
          id: benchmarkCase.id, ok: false, wallMs: 0,
          containerVolume: benchmarkCase.container.innerLength * benchmarkCase.container.innerWidth * benchmarkCase.container.innerHeight,
          loadedCount: 0, loadedVolume: 0, utilization: 0,
          inputVolume: 0,
          violations: [{ code: 'ENGINE_ERROR', message: String(err.message || err).slice(0, 300) }],
          validatorHard: -1
        };
      }
      if (!args.quiet) {
        const flag = row.violations.length > 0
          ? `VIOLATIONS(${[...new Set(row.violations.map(v => v.code))].join(',')})`
          : 'clean';
        process.stderr.write(`  [${algorithmId}] ${row.id}: util=${row.utilization.toFixed(2)}% ${row.wallMs.toFixed(0)}ms loaded=${row.loadedCount} ${flag}\n`);
      }
      rows.push(row);
    }

    const totalContainerVolume = rows.reduce((s, r) => s + r.containerVolume, 0);
    const totalLoadedVolume = rows.reduce((s, r) => s + r.loadedVolume, 0);
    const aggregateUtil = totalContainerVolume > 0 ? (totalLoadedVolume / totalContainerVolume) * 100 : 0;
    const meanUtil = rows.reduce((s, r) => s + r.utilization, 0) / rows.length;
    const avgMs = rows.reduce((s, r) => s + r.wallMs, 0) / rows.length;
    const maxMs = rows.reduce((m, r) => Math.max(m, r.wallMs), 0);
    const violationCount = rows.reduce((s, r) => s + r.violations.length, 0);
    const loadedCount = rows.reduce((s, r) => s + (r.loadedCount || 0), 0);

    allResults[algorithmId] = {
      algorithmId,
      caseCount: rows.length,
      aggregateUtil: Math.round(aggregateUtil * 1000) / 1000,
      meanUtil: Math.round(meanUtil * 1000) / 1000,
      avgMs: Math.round(avgMs * 100) / 100,
      maxMs: Math.round(maxMs * 100) / 100,
      violationCount,
      violationCodes: [...new Set(rows.flatMap(r => r.violations.map(v => v.code)))],
      validatorHardTotal: rows.reduce((s, r) => s + Math.max(0, r.validatorHard), 0),
      totalLoadedCount: loadedCount,
      rows
    };

    process.stderr.write(
      `[SUMMARY ${algorithmId}] aggregateUtil=${aggregateUtil.toFixed(3)}% meanUtil=${meanUtil.toFixed(3)}% ` +
      `avgMs=${avgMs.toFixed(1)} maxMs=${maxMs.toFixed(0)} violations=${violationCount} validatorHard=${allResults[algorithmId].validatorHardTotal} loaded=${loadedCount}\n`
    );
  }

  const payload = { generatedAt: new Date().toISOString(), suite: args.suite, seed: args.seed, results: allResults };
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), JSON.stringify(payload, null, 2), 'utf8');
  }
  // stdout = 单行机器可读汇总（供迭代脚本解析）
  for (const algorithmId of algorithms) {
    const r = allResults[algorithmId];
    process.stdout.write(`RESULT algo=${r.algorithmId} aggUtil=${r.aggregateUtil} meanUtil=${r.meanUtil} avgMs=${r.avgMs} maxMs=${r.maxMs} violations=${r.violationCount} validatorHard=${r.validatorHardTotal} loaded=${r.totalLoadedCount}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err.message}\n`);
  process.exit(1);
});
