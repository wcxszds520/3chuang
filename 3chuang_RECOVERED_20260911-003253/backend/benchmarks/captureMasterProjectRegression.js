'use strict';
const fs=require('fs');
const path=require('path');
const Solver=require('../services/HybridConstraintPackingSolverV25');
const {buildProjectBenchmarkCases}=require('./projectBenchmarkCases');
(async()=>{
  const root=path.resolve(__dirname,'../../artifacts/master-rebuild-20260922/algorithm',process.argv[2]||'final-20260926');
  fs.mkdirSync(root,{recursive:true});
  const summary=[];
  for(const task of (await buildProjectBenchmarkCases()).slice(0,2)){
    const start=performance.now();
    const result=await new Solver().generatePackingPlan(task.cargoList,task.container,{strategy:'OPERATION'});
    const count=task.cargoList.reduce((sum,c)=>sum+c.quantity,0);
    const file=`project-${count}.json`;
    fs.writeFileSync(path.join(root,file),JSON.stringify({input:task,plan:result},null,2));
    summary.push({inputCount:count,loadedCount:result.loadedCargo.length,elapsedMs:performance.now()-start,
      candidate:result.candidateId,placementHash:result.placementHash,hardConstraintsPass:result.hardConstraintsPass,
      hardViolationCount:result.validator.hardViolationCount,blockedOperations:result.operationFeasibility.blockedCount,
      portStatus:result.portAccessibility.status,postUnloadStabilityPass:result.portAccessibility.postUnloadStabilityPass,
      internalVoidMm3:result.layoutQuality.internalVoidVolume,exactInternalVoidMm3:result.metrics.exactVoid.internalVoidMm3,
      cog:result.metrics.cog,translation:result.constraintMeta.translation,artifact:file});
  }
  fs.writeFileSync(path.join(root,'project-regression-summary.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
