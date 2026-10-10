'use strict';
const crypto=require('crypto');
const {buildExternalTask}=require('./ExternalTaskRuntime');
const {solveSourceBenchmark}=require('../packing/SourceBenchmarkSolver');

function compareSubmittedFacts(cargoList,task){
  if(cargoList===undefined)return;
  const keys=['cargoId','sku','length','width','height','weight','quantity','orientationConstraints'];
  const project=c=>Object.fromEntries(keys.map(k=>[k,c[k]??null]));
  const canonical=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(canonical):Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
  const serialize=list=>JSON.stringify(canonical(list.map(project).sort((a,b)=>a.cargoId.localeCompare(b.cargoId))));
  if(!Array.isArray(cargoList)||serialize(cargoList)!==serialize(task.cargoList))throw Object.assign(new Error('SOURCE_BENCHMARK 货物与不可变来源事实不一致；编辑货物请使用业务模拟模式'),{code:'SOURCE_FACT_MISMATCH'});
  const original=new Map(task.cargoList.map(c=>[c.cargoId,c]));
  for(const submitted of cargoList){
    const source=original.get(submitted.cargoId);
    // Optional fields may be omitted by older clients. When a source declares
    // a mechanical rule, an explicitly submitted different value is an edit,
    // not permission to silently discard that edit and return the old fixture.
    for(const key of ['stackable','maxStackLayers','loadBearing','loadBearingUnit','stackingGroup','alwaysOnTop','alwaysOnBottom']){
      if(source[key]!==undefined && submitted[key]!==undefined && JSON.stringify(canonical(source[key]))!==JSON.stringify(canonical(submitted[key])))
        throw Object.assign(new Error('SOURCE_BENCHMARK 来源物理事实不允许修改：'+key),{code:'SOURCE_FACT_MISMATCH'});
    }
  }
}
async function generateSourcePlan(body,db,{persist=true}={}){
  const task=await buildExternalTask(body.externalDataset||{});compareSubmittedFacts(body.cargoList,task);
  if(!task.capabilities.canSolve)throw Object.assign(new Error('该来源实例当前仅支持浏览'),{code:'SOURCE_NOT_SOLVABLE',details:task.capabilities});
  if(body.containerType&&body.containerType!==task.container.typeId)throw Object.assign(new Error('来源基准模式必须使用来源箱体'),{code:'SOURCE_CONTAINER_MISMATCH'});
  const result=solveSourceBenchmark(task,{quality:body.quality==='fast'?'fast':'quality',timeLimitMs:Math.min(60000,Math.max(1000,Number(body.timeLimitMs)||30000))});
  const planId=`REQ_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const placementHash=crypto.createHash('sha256').update(JSON.stringify(result.placements.map(p=>[p.cargoId,p.x,p.y,p.z,p.l,p.w,p.h,p.orientationId,p.axisMap]))).digest('hex').slice(0,16);
  const inputVolume=task.cargoList.reduce((sum,c)=>sum+c.length*c.width*c.height*c.quantity,0),binVolume=task.container.innerLength*task.container.innerWidth*task.container.innerHeight;
  const data={planId,requestId:planId,source:'backend',sourceCode:'BACKEND_SOLVED',solverMode:'SOURCE_BENCHMARK',benchmarkMode:task.capabilities.benchmarkMode,
    externalDataset:{source:task.source,instanceId:task.instanceId,sourceContainerIndex:task.container.index,...(task.derivedTaskId?{derivedDemoId:task.derivedTaskId,taskType:task.taskType,officialBenchmarkResult:false}:{})},datasetCapabilities:task.capabilities,sourceFactsFingerprint:task.factsFingerprint,
    containerInfo:task.container,loadedCargo:result.placements,unloadedCargo:result.unloadedCargo,totalCargoCount:result.placements.length,totalCargoInput:task.cargoList.reduce((s,c)=>s+c.quantity,0),totalWeight:result.validator.totalWeight,
    spaceUtilization:result.loadedVolumeMm3/binVolume*100,cog:null,cogOffset:null,validator:result.validator,placementHash,ext_placementHash:placementHash,
    ext_algorithmId:'source-portfolio-r2',ext_strategyUsed:result.search.selectedPolicy,search:result.search,unloadedDiagnostics:result.unloadedDiagnostics,
    layoutQuality:{internalVoidVolume:result.exactVoid.internalVoidMm3,exactVoid:result.exactVoid},
    metrics:{algorithm_id:'source-portfolio-r2',solverVersion:'R2',solveMs:result.search.elapsedMs,cargoVolumeRatio:inputVolume/binVolume,packingEfficiency:result.loadedVolumeMm3/inputVolume,
      residualSpaceM3:(binVolume-result.loadedVolumeMm3)/1e9,unloadedPotentialM3:(inputVolume-result.loadedVolumeMm3)/1e9,knownBestSolutionGap:null,exactVoid:result.exactVoid,rearWall:result.rearWall},
    constraintMeta:{solverRevision:'source-r2',translation:{mode:'SOURCE_CONSTRUCTION_NO_GLOBAL_TRANSLATION'}},
    executionStatus:{solve:'COMPLETED',validation:'VALID',persistence:'SAVED',benchmark:task.capabilities.fullSourceProblem?'SOURCE_CONSTRAINTS_VALID':'SOURCE_SUBSET_VALID',businessReadiness:'NOT_APPLICABLE'},
    compliance:{status:'NOT_APPLICABLE',message:'来源基准验证不构成业务出运批准'},stability:{status:'GEOMETRIC_SUPPORT_VALID'},shipmentReadiness:null};
  // Isolated reviews can run the same source solver without opening a database.
  // This option belongs to the host, never to an untrusted request body.
  if(!persist){data.executionStatus.persistence='NOT_REQUESTED';return data;}
  // Fail closed on an identity hash collision; never overwrite another container.
  const c=task.container;
  const [existing]=await db.query('SELECT * FROM container_type WHERE type_id = ?',[c.typeId]);
  if(existing.length){const row=existing[0];if(Number(row.inner_length)!==c.innerLength||Number(row.inner_width)!==c.innerWidth||Number(row.inner_height)!==c.innerHeight||(row.max_weight===null?null:Number(row.max_weight))!==c.maxWeight)throw Object.assign(new Error('来源箱体身份冲突'),{code:'SOURCE_CONTAINER_ID_COLLISION'});}
  else await db.query('INSERT INTO container_type (type_id,name,inner_length,inner_width,inner_height,max_weight,description) VALUES (?,?,?,?,?,?,?)',[c.typeId,c.name,c.innerLength,c.innerWidth,c.innerHeight,c.maxWeight,JSON.stringify({source:c.source,instanceId:c.instanceId,sourceFacts:c.sourceFacts})]);
  try {
    await db.query('INSERT INTO packing_plan (plan_id,container_type,space_utilization,total_weight,total_cargo_count,plan_data,compliance_status,risk_level,created_at) VALUES (?,?,?,?,?,?,?,?,NOW())',[planId,c.typeId,data.spaceUtilization,data.totalWeight,data.totalCargoCount,JSON.stringify(data),'not_applicable','unknown']);
  }catch(error){data.executionStatus.persistence='FAILED';data.persistenceError={code:error.code||'PLAN_SAVE_FAILED',message:'来源方案求解完成，但持久化失败'};}
  return data;
}
module.exports={generateSourcePlan,compareSubmittedFacts};
