'use strict';
// Small fixed source matrix. No input rewriting and no expected placements.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {buildExternalTask}=require('../services/external/ExternalTaskRuntime');
const {solveSourceBenchmark}=require('../services/packing/SourceBenchmarkSolver');
const {validateSourcePlan}=require('../services/packing/SourceConstraintValidator');
const root=path.resolve(__dirname,'../..');
const MATRIX=[
 ['orlib_thpack','thpack1-1','simple-geometry'],['orlib_thpack','thpack1-2','higher-fill'],['orlib_thpack','thpack3-1','diverse-directions'],
 ['orlib_wtpack','wtpack1-1','historical-43-of-112'],['orlib_wtpack','wtpack1-2','pressure-sensitive'],['orlib_wtpack','wtpack3-1','diverse-directions'],
 ['ortec_alonso_2019','ortec-inst3d31','real-111-and-group-1'],
 ['renault_esicup_2015','instancesA-ARG_BUR_STK_container','free-orientation'],['renault_esicup_2015','instancesA-NSA_BUR_STK_container','lengthwise-widthwise']
];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function run(output){
 const out=path.resolve(output),allowed=path.join(root,'artifacts/pre-blender');if(!out.startsWith(allowed+path.sep))throw Error('Evidence output boundary');fs.mkdirSync(out,{recursive:true});
 const rows=[],unloaded=[];
 for(const [source,instanceId,role] of MATRIX){
  const file=path.join(root,'data/external/normalized',source,'instances.json'),before=sha(file),task=await buildExternalTask({source,instanceId});
  const fast=solveSourceBenchmark(task,{quality:'fast',timeLimitMs:10000}),quality=solveSourceBenchmark(task,{quality:'quality',timeLimitMs:30000});
  const validation=validateSourcePlan({placements:quality.placements,cargoList:task.cargoList,unloadedCargo:quality.unloadedCargo,container:task.container,rules:task.rules});
  const binVolume=task.container.innerLength*task.container.innerWidth*task.container.innerHeight,inputVolume=task.cargoList.reduce((s,c)=>s+c.length*c.width*c.height*c.quantity,0);
  const row={source,instanceId,role,inputFingerprint:task.factsFingerprint,normalizedFileSha256:before,inputFileUnchanged:sha(file)===before,capabilities:task.capabilities,container:task.container,
   inputCount:task.cargoList.reduce((s,c)=>s+c.quantity,0),loaded:quality.placements.length,unloaded:quality.unloadedCargo.length,totalWeightKg:validation.totalWeight,
   cargoVolumeRatio:inputVolume/binVolume,volumeUtilization:quality.loadedVolumeMm3/binVolume,packingEfficiency:quality.loadedVolumeMm3/inputVolume,residualSpaceQuality:quality.exactVoid,unloadedPotentialM3:(inputVolume-quality.loadedVolumeMm3)/1e9,
   validation:{valid:validation.valid,hardViolations:validation.hardViolationCount,checks:validation.checks,pressureViolations:validation.violations.filter(v=>v.code==='LOAD_BEARING_LIMIT').length},
   fast:{loaded:fast.placements.length,volumeUtilization:fast.loadedVolumeMm3/binVolume,solveMs:fast.search.elapsedMs},quality:{solveMs:quality.search.elapsedMs,policy:quality.search.selectedPolicy,states:quality.search.candidates.reduce((s,c)=>s+c.generated,0)},
   qualityVolumeGainMm3:quality.loadedVolumeMm3-fast.loadedVolumeMm3,knownBestSolutionGap:null,unloadedDiagnostics:quality.unloadedDiagnostics,searchStatus:quality.search.candidates.some(c=>c.timedOut)?'SEARCH_BUDGET_EXHAUSTED':'BOUNDED_PORTFOLIO_COMPLETED_NOT_OPTIMALITY_PROOF'};
  if(!row.validation.valid||!row.inputFileUnchanged||row.loaded+row.unloaded!==row.inputCount)throw Error('Matrix hard gate failed: '+instanceId);
  rows.push(row);unloaded.push({source,instanceId,items:quality.unloadedCargo});
  fs.writeFileSync(path.join(out,`${instanceId}.json`),JSON.stringify({task,fast,quality},null,2));
  fs.writeFileSync(path.join(out,'benchmark-results.json'),JSON.stringify({matrix:MATRIX,results:rows},null,2));fs.writeFileSync(path.join(out,'unloaded-reasons.json'),JSON.stringify(unloaded,null,2));
  console.log(JSON.stringify({instanceId,loaded:row.loaded,total:row.inputCount,utilizationPercent:row.volumeUtilization*100,fast:row.fast.loaded,valid:true,solveMs:row.quality.solveMs}));
 }
 return rows;
}
if(require.main===module)run(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={MATRIX,run};
