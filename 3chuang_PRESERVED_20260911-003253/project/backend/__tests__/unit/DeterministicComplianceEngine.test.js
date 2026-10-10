'use strict';

const { DeterministicComplianceEngine } = require('../../services/compliance/DeterministicComplianceEngine');

describe('DeterministicComplianceEngine', () => {
  const engine = new DeterministicComplianceEngine();
  const base = {
    containerInfo: { typeId: '20GP', maxWeight: 28000 },
    totalWeight: 1000,
    declaredVGM: 3300,
    cogOffset: { lateral: 1.2, longitudinal: 2.4 },
    constraintMeta: { lifoCompliant: true },
    documentEvidence: [{ kind: 'manifest' }],
    loadedCargo: [{ cargoId: 'A', x: 0, y: 0, z: 0, l: 100, w: 100, h: 100, weight: 1000, dangerous: false, stackable: true }]
  };

  it('preserves raw center-of-gravity metrics and does not clamp them into a pass', () => {
    const report = engine.evaluate({ ...base, cogOffset: { lateral: 11.278, longitudinal: 12.5 } });
    const cog = report.reportTable.find((row) => row.key === 'cog');
    expect(cog.evidence).toMatchObject({ lateralOffset: 11.278, longitudinalOffset: 12.5 });
    expect(cog.actual).toContain('11.28%');
    expect(cog.result).toBe('WARNING');
  });

  it('fails cumulative payload overflow using the actual aggregate weight', () => {
    const report = engine.evaluate({ ...base, totalWeight: 28001 });
    expect(report.reportTable.find((row) => row.key === 'payload').result).toBe('FAIL');
    expect(report.status).toBe('FAIL');
  });

  it('does not produce a fixed pass when required semantics or evidence are absent', () => {
    const report = engine.evaluate({ ...base, loadedCargo: [{ ...base.loadedCargo[0], dangerous: undefined }], documentEvidence: undefined });
    expect(report.reportTable.find((row) => row.key === 'dangerous').result).toBe('REVIEW_REQUIRED');
    expect(report.reportTable.find((row) => row.key === 'documents').result).toBe('REVIEW_REQUIRED');
  });

  it('detects cargo placed above fragile or non-stackable support', () => {
    const lower = { cargoId: 'LOW', x: 0, y: 0, z: 0, l: 100, w: 100, h: 100, weight: 10, dangerous: false, fragile: true, stackable: false };
    const upper = { cargoId: 'UP', x: 0, y: 100, z: 0, l: 100, w: 100, h: 100, weight: 20, dangerous: false, stackable: true };
    const report = engine.evaluate({ ...base, loadedCargo: [lower, upper] });
    expect(report.reportTable.find((row) => row.key === 'stacking').result).toBe('FAIL');
  });
});
