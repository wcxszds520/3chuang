'use strict';

const FastBlockPackingEngine = require('../services/FastBlockPackingEngine');
const HybridConstraintPackingSolverV2 = require('../services/HybridConstraintPackingSolverV2');
const PlanValidator = require('../services/packing/PlanValidator');
const { calculatePlanMetrics } = require('../services/packing/PlanMetrics');
const { buildSyntheticBenchmarkCases } = require('./solverBenchmarkCases');

async function runBenchmark({ cases = buildSyntheticBenchmarkCases(), strategies = ['SPACE', 'BALANCE', 'OPERATION'] } = {}) {
  const rows = [];
  for (const benchmarkCase of cases) {
    const v1Started = Date.now();
    const v1 = await new FastBlockPackingEngine().generatePackingPlan(benchmarkCase.cargoList, benchmarkCase.container);
    const v1Ms = Date.now() - v1Started;
    const validator = new PlanValidator();
    const v1Validation = validator.validate({ placements: v1.loadedCargo, cargoList: benchmarkCase.cargoList, container: benchmarkCase.container });
    const v1Metrics = calculatePlanMetrics(v1.loadedCargo, benchmarkCase.container, v1.unloadedCargo.length, v1Ms);
    v1Metrics.stability = compactStability(v1Validation.stability);
    v1Metrics.cog.withinPolicy = v1Validation.checks.cog.withinPolicy;
    v1Metrics.cog.recommendationStatus = v1Validation.checks.cog.withinPolicy ? 'WITHIN_RECOMMENDED_PROJECT_POLICY' : 'OUTSIDE_RECOMMENDED_PROJECT_POLICY';
    const variants = {};
    for (const strategy of strategies) {
      const result = await new HybridConstraintPackingSolverV2({ beamWidth: 4, lookaheadDepth: 2, candidateLimit: 10 })
        .generatePackingPlan(benchmarkCase.cargoList, benchmarkCase.container, { strategy });
      variants[strategy] = compactResult(result);
    }
    rows.push({
      id: benchmarkCase.id,
      seed: benchmarkCase.seed,
      dataClassification: benchmarkCase.dataClassification,
      v1: {
        loadedCount: v1Metrics.loadedCount,
        unloadedCount: v1Metrics.unloadedCount,
        validator: v1Validation.status,
        hardViolations: v1Validation.hardViolationCount,
        metrics: v1Metrics
      },
      v2: variants
    });
  }
  return { rows, summary: summarize(rows, strategies) };
}

function compactResult(result) {
  return {
    loadedCount: result.metrics.loadedCount,
    unloadedCount: result.metrics.unloadedCount,
    validator: result.validator.status,
    hardViolations: result.validator.hardViolationCount,
    stabilityViolations: number(result.metrics.stability?.invalidCount),
    metrics: result.metrics
  };
}

function compactStability(stability) {
  if (!stability) return null;
  return {
    status: stability.status,
    invalidCount: stability.invalidCount,
    warningCount: stability.warningCount,
    ...stability.summary,
    policy: stability.policy
  };
}

function summarize(rows, strategies) {
  const v1 = aggregate(rows.map((row) => row.v1));
  const v2 = Object.fromEntries(strategies.map((strategy) => [strategy, aggregate(rows.map((row) => row.v2[strategy]))]));
  const space = v2.SPACE;
  const loadedCountNotWorse = rows.every((row) => strategies.every((strategy) => row.v1.hardViolations > 0
    || row.v2[strategy].loadedCount >= row.v1.loadedCount));
  const cogGuardrailNotWorse = space.cogGuardrailFailures <= v1.cogGuardrailFailures;
  const loadedCountGain = space.loadedCount >= v1.loadedCount * 1.01;
  const reproducibleQualityGain = loadedCountGain
    || space.largestResidualVolumeAverage >= v1.largestResidualVolumeAverage * 1.1
    || v2.BALANCE.cogCompositeAverage <= v1.cogCompositeAverage * 0.9
    || v2.OPERATION.operationCostAverage <= v1.operationCostAverage * 0.9;
  const eligible = Object.values(v2).every((entry) => entry.hardViolations === 0 && entry.stabilityViolations === 0)
    && loadedCountNotWorse
    && space.solveMsAverage <= 5000
    && cogGuardrailNotWorse
    && reproducibleQualityGain;
  return {
    caseCount: rows.length,
    v1,
    v2,
    officialSolverRecommendation: eligible ? 'hybrid-v2.1' : 'fast-block-v1',
    decisionRule: {
      zeroHardViolations: Object.values(v2).every((entry) => entry.hardViolations === 0),
      zeroStabilityViolations: Object.values(v2).every((entry) => entry.stabilityViolations === 0),
      loadedCountNotWorse,
      defaultStrategyCogGuardrail: space.cogGuardrailFailures === 0,
      cogGuardrailNotWorse,
      interactiveRuntime: space.solveMsAverage <= 5000,
      loadedCountGain,
      reproducibleQualityGain
    }
  };
}

function aggregate(results) {
  const count = Math.max(results.length, 1);
  const sum = (selector) => results.reduce((total, result) => total + selector(result), 0);
  return {
    loadedCount: sum((result) => result.loadedCount),
    unloadedCount: sum((result) => result.unloadedCount),
    hardViolations: sum((result) => result.hardViolations),
    stabilityViolations: sum((result) => number(result.stabilityViolations ?? result.metrics.stability?.invalidCount)),
    validCases: results.filter((result) => result.validator === 'VALID').length,
    cogGuardrailFailures: results.filter((result) => result.metrics.cog?.withinPolicy === false).length,
    solveMsAverage: sum((result) => number(result.metrics.solveMs)) / count,
    volumeUtilizationAverage: sum((result) => number(result.metrics.volumeUtilization)) / count,
    cogCompositeAverage: sum((result) => number(result.metrics.cog?.lateral) * 0.65 + number(result.metrics.cog?.longitudinal) * 0.35) / count,
    boundingCompactnessAverage: sum((result) => number(result.metrics.compactness?.boundingCompactness)) / count,
    largestResidualVolumeAverage: sum((result) => number(result.metrics.compactness?.largestResidualVolume)) / count,
    operationCostAverage: sum((result) => number(result.metrics.operation?.totalCost)) / count
    ,minSupport: results.reduce((minimum, result) => Math.min(minimum, number(result.metrics.stability?.minSupportRatio ?? 1)), 1)
    ,minStabilityMargin: results.reduce((minimum, result) => Math.min(minimum, nullableNumber(result.metrics.stability?.minStackSupportMargin ?? result.metrics.stability?.minSupportMargin, Infinity)), Infinity)
    ,unrestrainedTallStacks: sum((result) => number(result.metrics.stability?.unrestrainedTallStacks))
    ,heightSmoothnessAverage: sum((result) => number(result.metrics.stability?.heightSmoothnessScore)) / count
    ,narrowVoidVolumeAverage: sum((result) => number(result.metrics.stability?.narrowVoidVolume)) / count
    ,enclosedVoidVolumeAverage: sum((result) => number(result.metrics.stability?.enclosedVoidVolume)) / count
  };
}

function nullableNumber(value, fallback) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

if (require.main === module) {
  runBenchmark().then((report) => {
    process.stdout.write(`${JSON.stringify(report.summary, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { runBenchmark, summarize };
