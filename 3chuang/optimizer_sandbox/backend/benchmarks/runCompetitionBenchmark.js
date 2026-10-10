'use strict';

const { runBenchmark } = require('./runSolverBenchmark');
const { buildSyntheticBenchmarkCases } = require('./solverBenchmarkCases');
const { buildProjectBenchmarkCases } = require('./projectBenchmarkCases');

async function runCompetitionBenchmark({ syntheticCount = 48 } = {}) {
  const projectCases = await buildProjectBenchmarkCases();
  const datasetA = await runBenchmark({ cases: [projectCases[0]] });
  const datasetB = await runBenchmark({ cases: [projectCases[1]] });
  const synthetic = await runBenchmark({ cases: buildSyntheticBenchmarkCases(syntheticCount) });
  return {
    benchmarkId: 'PORTCUBE-COMPETITION-2.1',
    generatedAt: new Date().toISOString(),
    dataClassification: {
      datasetA: projectCases[0].dataClassification,
      datasetB: projectCases[1].dataClassification,
      synthetic: 'SYNTHETIC_BENCHMARK'
    },
    datasetA,
    datasetB,
    synthetic
  };
}

if (require.main === module) {
  runCompetitionBenchmark().then((report) => {
    process.stdout.write(`${JSON.stringify({
      benchmarkId: report.benchmarkId,
      generatedAt: report.generatedAt,
      dataClassification: report.dataClassification,
      datasetA: report.datasetA.summary,
      datasetB: report.datasetB.summary,
      synthetic: report.synthetic.summary
    }, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { runCompetitionBenchmark };
