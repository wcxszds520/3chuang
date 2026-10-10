'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

describe('HybridConstraintPackingSolverV24 project regression', () => {
  jest.setTimeout(30000);

  test('preserves Dataset A and repairs sparse multiport Dataset B deterministically', () => {
    const backendRoot = path.resolve(__dirname, '../..');
    const script = `(async()=>{const {buildProjectBenchmarkCases}=require('./benchmarks/projectBenchmarkCases');const V24=require('./services/HybridConstraintPackingSolverV24');const cases=await buildProjectBenchmarkCases();const out=[];for(const d of cases){const a=await new V24().generatePackingPlan(d.cargoList,d.container,{strategy:'SPACE'});const b=await new V24().generatePackingPlan(d.cargoList,d.container,{strategy:'SPACE'});out.push({id:d.id,loaded:a.loadedCargo.length,hard:a.validator.hardViolationCount,op:a.operationFeasibility.blockedCount,port:a.portAccessibility.status,post:a.portAccessibility.postUnloadStabilityPass,cog:a.loadDistribution.centreOfGravity,hash:a.placementHash,repeat:b.placementHash,candidate:a.candidateId,assists:a.handlingAssumptions.length});}process.stdout.write(JSON.stringify(out));})().catch(e=>{console.error(e.stack);process.exit(1)});`;
    const result = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: backendRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
    const datasetA = result.find((entry) => entry.id === 'DATASET-A-212');
    const datasetB = result.find((entry) => entry.id === 'DATASET-B-MIXED-69');
    for (const row of result) {
      expect(row.hard).toBe(0);
      expect(row.op).toBe(0);
      expect(row.port).toBe('FULL_UNLOAD_PASS');
      expect(row.post).toBe(true);
      expect(row.hash).toBe(row.repeat);
    }
    expect(datasetA.loaded).toBe(212);
    expect(datasetA.candidate).toBe('V23_BASE');
    expect(datasetB.loaded).toBe(69);
    expect(datasetB.cog.guidanceStatus).toBe('WITHIN_GENERAL_GUIDANCE');
    expect(datasetB.candidate).toBe('V21_GLOBAL_BALANCE_ASSISTED');
    expect(datasetB.assists).toBe(6);
  });
});
