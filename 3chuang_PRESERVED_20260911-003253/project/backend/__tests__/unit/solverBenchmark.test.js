const { buildSyntheticBenchmarkCases } = require('../../benchmarks/solverBenchmarkCases');
const { runBenchmark } = require('../../benchmarks/runSolverBenchmark');

describe('fixed-seed solver benchmark', () => {
  test('builds deterministic, explicitly classified benchmark cases', () => {
    const first = buildSyntheticBenchmarkCases(20);
    const second = buildSyntheticBenchmarkCases(20);
    expect(first).toEqual(second);
    expect(first).toHaveLength(20);
    expect(first.every((entry) => entry.dataClassification === 'SYNTHETIC_BENCHMARK')).toBe(true);
    expect(first.flatMap((entry) => entry.cargoList).every((cargo) => cargo.dataClassification === 'SYNTHETIC_BENCHMARK')).toBe(true);
    expect(new Set(buildSyntheticBenchmarkCases(48).map((entry) => entry.scenario)).size).toBe(12);
  });

  test('compares V1 and all V2 strategies with independent validation', async () => {
    const report = await runBenchmark({ cases: buildSyntheticBenchmarkCases(2) });
    expect(report.rows).toHaveLength(2);
    expect(report.summary.v1.loadedCount).toBeGreaterThan(0);
    for (const strategy of ['SPACE', 'BALANCE', 'OPERATION']) {
      expect(report.summary.v2[strategy].hardViolations).toBe(0);
      expect(report.summary.v2[strategy].stabilityViolations).toBe(0);
      for (const row of report.rows) {
        if (row.v1.hardViolations === 0) expect(row.v2[strategy].loadedCount).toBeGreaterThanOrEqual(row.v1.loadedCount);
      }
    }
    expect(['hybrid-v2', 'fast-block-v1']).toContain(report.summary.officialSolverRecommendation);
  }, 30000);
});
