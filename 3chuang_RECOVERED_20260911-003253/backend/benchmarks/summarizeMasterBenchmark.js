'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
const folder=process.argv[2]||'final-verified-20260926';
const dir=path.join(root,'artifacts/master-rebuild-20260922/algorithm',folder);
const data=JSON.parse(fs.readFileSync(path.join(dir,'benchmark.json'),'utf8'));
const avg=a=>a.reduce((s,x)=>s+x,0)/Math.max(a.length,1);
const rounded=n=>Math.round(n*100)/100;
const solvers=['native-v25','fast-block','source','packingsolver','commerce'];
const summarize=rows=>{
  const valid=rows.filter(r=>r.status==='VALID'),times=valid.map(r=>r.elapsedMs),rss=valid.map(r=>r.peakWorkerRssMiB);
  return {runs:rows.length,status:rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),
    meanValidReturnedMs:rounded(avg(times)),stdValidReturnedMs:rounded(Math.sqrt(avg(times.map(t=>(t-avg(times))**2)))),
    minValidReturnedMs:rounded(Math.min(...times)),maxValidReturnedMs:rounded(Math.max(...times)),
    peakWorkerRssMiB:rounded(Math.max(...rss)),meanLoaded:rounded(avg(valid.map(r=>r.loadedCount))),
    nativeProductionAdmissionTrue:valid.filter(r=>r.nativeProductionAdmission===true).length};
};
const summary={createdAt:data.createdAt,platform:data.platform,node:data.node,
  machine:{cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,systemMemoryGiB:rounded(os.totalmem()/2**30),osRelease:os.release()},
  timingScope:'WALL_CLOCK_FROM_WORKER_SOLVE_ENTRY_TO_RETURN_INCLUDES_MODULE_IMPORT_EXCLUDES_INDEPENDENT_VALIDATION',
  memoryScope:'NODE_WORKER_PROCESS_RESOURCEUSAGE_MAXRSS_KIB_INCLUDING_NODE_AND_VALIDATION_NOT_EXTERNAL_CHILD',
  firstInternallyLegalCandidateTime:'UNMEASURED_NULL',externalChildPeakMemory:'UNMEASURED_NULL',
  solvers:Object.fromEntries(solvers.map(s=>[s,summarize(data.rows.filter(r=>r.solver===s))])),
  cases:[...new Set(data.rows.map(r=>r.caseId))].map(id=>({caseId:id,solvers:Object.fromEntries(solvers.map(s=>{
    const rows=data.rows.filter(r=>r.caseId===id&&r.solver===s),valid=rows.filter(r=>r.status==='VALID');
    return [s,{...summarize(rows),loadedCounts:rows.map(r=>r.loadedCount??null),utilization:valid.map(r=>rounded(r.utilizationPercent)),
      layoutHashes:[...new Set(rows.map(r=>r.layoutHash).filter(Boolean))],violationCodes:[...new Set(rows.flatMap(r=>r.violationCodes||[]))],errors:rows.filter(r=>r.status!=='VALID').map(r=>r.message||r.code||r.status)}];
  }))})),
  sourceHashes:Object.fromEntries(['backend/benchmarks/runMasterBenchmark.js','backend/benchmarks/masterBenchmarkCases.js','backend/services/HybridConstraintPackingSolverV25.js','backend/services/packing/BackWallSolverPass.js','backend/services/packing/LayoutQualityAnalyzer.js','backend/services/packing/PackagingProfile.js','backend/services/packing/CrossSectionLayerBuilder.js','backend/services/FastBlockPackingEngine.js','backend/services/external/PackingSolverAdapter.js','backend/services/packing/SourceConstraintValidator.js','backend/services/packing/PlanValidator.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]))};
for(const f of ['backend/models/Cargo.js','backend/services/packing/TopLoadConstraint.js','backend/services/AlgorithmOrchestrator.js'])summary.sourceHashes[f]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary.solvers,null,2));
