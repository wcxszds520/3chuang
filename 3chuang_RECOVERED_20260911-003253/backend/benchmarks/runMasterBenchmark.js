'use strict';
// A fresh Node worker per case/solver makes peak RSS and solver failures bounded.
const fs=require('fs');const path=require('path');const crypto=require('crypto');const {spawnSync}=require('child_process');
const {buildMasterCases}=require('./masterBenchmarkCases');
const {validateSourcePlan}=require('../services/packing/SourceConstraintValidator');
const PlanValidator=require('../services/packing/PlanValidator');
const {evaluateInsertionPath}=require('../services/packing/InsertionPathFeasibility');
const root=path.resolve(__dirname,'../..');const evidenceRoot=path.join(root,'artifacts/master-rebuild-20260922/algorithm');
const out=process.env.BENCH_OUTPUT_SUFFIX?path.join(evidenceRoot,process.env.BENCH_OUTPUT_SUFFIX):evidenceRoot;
const binary=path.join(evidenceRoot,'packingsolver/packingsolver-windows-x64/packingsolver_boxstacks.exe');
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');

function independentCheck(result,task){
  const placements=result.loadedCargo||result.placements||[],unloadedCargo=result.unloadedCargo||[];
  const source=validateSourcePlan({...task,placements,unloadedCargo});
  const native=new PlanValidator().validate({...task,placements,unloadedCargo,requireOrientationMetadata:true});
  const errors=[...source.violations];
  for(const v of native.violations)if(['LIFO','INSERTION_PATH','CARGO_COG_OUTSIDE_SUPPORT','STACK_COG_OUTSIDE_SUPPORT'].includes(v.code)&&(v.code!=='LIFO'||task.rules.lifo))errors.push(v);
  const inserted=[...(task.lockedPlacements||[])];
  const pending=placements.filter(p=>!inserted.some(q=>q.cargoId===p.cargoId)).sort((a,b)=>a.x-b.x||a.y-b.y||a.z-b.z);
  for(const p of pending){const check=evaluateInsertionPath(p,inserted,task.container);if(!check.feasible)errors.push(...check.reasons.map(r=>({...r,cargoIds:[p.cargoId,r.cargoId].filter(Boolean)})));inserted.push(p);}
  for(const lock of task.lockedPlacements||[]){const p=placements.find(p=>p.cargoId===lock.cargoId);if(!p||['x','y','z','l','w','h','orientationId'].some(k=>p[k]!==lock[k]))errors.push({code:'FIXED_PLACEMENT_MOVED',cargoIds:[lock.cargoId]});}
  return {valid:errors.length===0,errors,source,native};
}

async function worker(caseId,solver,repeat){
  const task=(await buildMasterCases()).find(c=>c.id===caseId);const dir=path.join(out,'runs',caseId,solver+'-'+repeat);fs.mkdirSync(dir,{recursive:true});
  const begin=performance.now();let result;
  try{
    if(solver==='packingsolver')result=await require('../services/external/PackingSolverAdapter').solvePackingSolver(task,{binaryPath:binary,outputDir:dir,timeLimitMs:1500});
    else if(solver==='source')result=require('../services/packing/SourceBenchmarkSolver').solveSourceBenchmark({...task,capabilities:{canSolve:true}},{timeLimitMs:1500});
    else if(solver==='commerce'){
      const arrivedAt='2026-09-22T00:00:00Z';
      result=await require('../services/CommercePackingService').solveCommerce({cargoList:task.cargoList.map(c=>({...c,arrivedAt})),actualContainer:task.container,timeLimitMs:1500,
        caseContext:{commerce:{planAt:'2026-09-22T01:00:00Z',lifo:task.rules.lifo===true,lockedPlacements:task.lockedPlacements||[]}}});
    }else{
      if(task.lockedPlacements?.length)throw Object.assign(Error('Native engine has no fixed-placement seed contract'),{code:'UNSUPPORTED_FIXED_PLACEMENTS'});
      const Solver=solver==='native-v25'?require('../services/HybridConstraintPackingSolverV25'):require('../services/FastBlockPackingEngine');
      result=await new Solver({searchQuality:'fast',supportRatioMin:task.rules.supportRatio}).generatePackingPlan(task.cargoList,task.container,{strategy:'SPACE',searchQuality:'fast',inputSource:task.dataClassification});
    }
    const elapsedMs=performance.now()-begin,validation=independentCheck(result,task),placements=result.loadedCargo||result.placements||[];
    const record={caseId,solver,repeat,inputHash:digest(task),inputCount:task.cargoList.reduce((n,c)=>n+c.quantity,0),status:validation.valid?'VALID':'INVALID',
      loadedCount:placements.length,unloadedCount:(result.unloadedCargo||[]).reduce((n,c)=>n+(c.quantity||1),0),binsUsed:placements.length?1:0,
      utilizationPercent:placements.reduce((n,p)=>n+p.l*p.w*p.h,0)/(task.container.innerLength*task.container.innerWidth*task.container.innerHeight)*100,
      elapsedMs,firstValidatedPlanMs:null,returnedCandidateTimeMs:elapsedMs,independentValidationCompletedMs:performance.now()-begin,
      firstPlanTimingScope:'INTERNAL_FIRST_LEGAL_CANDIDATE_NOT_INSTRUMENTED',
      peakWorkerRssMiB:process.resourceUsage().maxRSS/1024,externalPeakRssMiB:null,externalMemoryScope:solver==='packingsolver'?'NOT_MEASURED_CHILD_PROCESS':null,
      hardViolationCount:validation.errors.length,violationCodes:[...new Set(validation.errors.map(e=>e.code))],
      stabilityStatus:validation.native.stability?.status||null,operationScope:'STRAIGHT_AABB_DOOR_INSERTION_WITH_SUPPORT_AND_OPTIONAL_LIFO_NOT_EQUIPMENT_PATH',
      supportContract:task.rules.supportRatio,productionDefaultSupportRatio:require('../config/packingPolicy').supportRatioMin,
      nativeDefaultValidatorStatus:validation.native.status,nativeProductionAdmission:result.hardConstraintsPass??null,layoutHash:digest(placements.map(p=>[p.cargoId,p.x,p.y,p.z,p.l,p.w,p.h,p.orientationId])),
      resultPath:path.relative(root,path.join(dir,'plan.json'))};
    fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(dir,'validation.json'),JSON.stringify(validation,null,2));return record;
  }catch(error){return {caseId,solver,repeat,inputHash:digest(task),status:/UNSUPPORTED/.test(error.code||'')?'UNSUPPORTED':'ERROR',code:error.code||null,message:error.message,elapsedMs:performance.now()-begin,peakWorkerRssMiB:process.resourceUsage().maxRSS/1024};}
}

async function main(){
  if(process.argv[2]==='--worker'){
    const row=await worker(process.argv[3],process.argv[4],Number(process.argv[5]));fs.writeFileSync(process.argv[6],JSON.stringify(row,null,2));return;
  }
  const cases=await buildMasterCases();const repeats=Number(process.env.BENCH_REPEATS||2);const selected=process.env.BENCH_CASES?.split(',');
  const solvers=(process.env.BENCH_SOLVERS||'native-v25,fast-block,source,packingsolver,commerce').split(',');const rows=[];
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'cases.json'),JSON.stringify(cases,null,2));
  for(const task of cases.filter(c=>!selected||selected.includes(c.id)))for(const solver of solvers)for(let repeat=1;repeat<=repeats;repeat++){
    const dir=path.join(out,'runs',task.id,solver+'-'+repeat);fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'row.json');
    const run=spawnSync(process.execPath,[__filename,'--worker',task.id,solver,String(repeat),file],{encoding:'utf8',timeout:30000,windowsHide:true,maxBuffer:8*1024*1024});
    fs.writeFileSync(path.join(dir,'worker.log'),(run.stdout||'')+'\n'+(run.stderr||''));
    const row=run.status===0&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{caseId:task.id,solver,repeat,status:'ERROR',message:run.error?.message||'Worker exit '+run.status};rows.push(row);
    console.log(task.id,solver,repeat,row.status,row.loadedCount??'',Math.round(row.elapsedMs||0));fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify({createdAt:new Date().toISOString(),platform:process.platform,node:process.version,repeats,rows},null,2));
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={independentCheck,worker};
