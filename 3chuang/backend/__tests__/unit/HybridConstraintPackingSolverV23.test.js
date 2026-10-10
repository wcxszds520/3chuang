'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

describe('Hybrid Constraint Packing Solver V2.3', () => {
  jest.setTimeout(30_000);

  test('clears Dataset A physical-packing promotion gates without identifier exceptions', async () => {
    const backendRoot = path.resolve(__dirname, '../..');
    const script = `(async()=>{const {buildProjectBenchmarkCases}=require('./benchmarks/projectBenchmarkCases');const V2=require('./services/HybridConstraintPackingSolverV2');const V23=require('./services/HybridConstraintPackingSolverV23');const {analyzeLayoutQuality}=require('./services/packing/LayoutQualityAnalyzer');const d=(await buildProjectBenchmarkCases())[0];const b=await new V2().generatePackingPlan(d.cargoList,d.container,{strategy:'SPACE'});const bq=analyzeLayoutQuality({placements:b.loadedCargo,cargoList:d.cargoList,container:d.container});const r=await new V23().generatePackingPlan(d.cargoList,d.container,{strategy:'SPACE'});process.stdout.write(JSON.stringify({loaded:r.loadedCargo.length,unloaded:r.unloadedCargo.length,validator:r.validator,stability:r.metrics.stability,operation:r.operationFeasibility,layout:r.layoutQuality,cog:r.metrics.cog,metrics:{algorithm:r.metrics.algorithm,solverVersion:r.metrics.solverVersion,selectedCandidateAlgorithm:r.metrics.selectedCandidateAlgorithm},baseline:bq}));})().catch(e=>{process.stderr.write(e.stack);process.exit(1)});`;
    const result = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: backendRoot, encoding: 'utf8', timeout: 25_000 }));

    expect(result.loaded).toBe(212);
    expect(result.unloaded).toBe(0);
    expect(result.validator).toMatchObject({ valid: true, hardViolationCount: 0 });
    expect(result.validator.checks).toMatchObject({ lifo: true, insertion: true, stability: true });
    expect(result.stability.invalidCount).toBe(0);
    expect(result.operation).toMatchObject({ operationPathPass: true, blockedCount: 0 });
    expect(result.layout.internalVoidVolume).toBeLessThanOrEqual(result.baseline.internalVoidVolume * 0.70);
    expect(result.layout.lowFillInteriorSliceCount).toBeLessThanOrEqual(Math.floor(result.baseline.lowFillInteriorSliceCount * 0.50));
    expect(result.layout.largestContiguousReserve).toBeGreaterThanOrEqual(result.baseline.largestContiguousReserve);
    expect(result.cog.withinPolicy).toBe(true);
    expect(result.metrics).toMatchObject({ algorithm: 'hybrid-v2.3', solverVersion: '2.3', selectedCandidateAlgorithm: 'hybrid-v2.3' });

    const implementation = fs.readFileSync(path.resolve(__dirname, '../../services/packing/CrossSectionLayerBuilder.js'), 'utf8');
    expect(implementation).not.toMatch(/stage3_|NB2026-0713-001|SKU-(?:ACC|CTN|FRG|MAN|FLK|NST|WOD|HVY|PLT|SVC)/);
  });
});
