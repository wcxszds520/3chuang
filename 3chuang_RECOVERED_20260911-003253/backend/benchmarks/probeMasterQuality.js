'use strict';
const fs=require('fs');const path=require('path');
const {buildProjectBenchmarkCases}=require('./projectBenchmarkCases');
const Builder=require('../services/packing/CrossSectionLayerBuilder');
const {normalizeCargoList}=require('../services/packing/PackagingProfile');
const {normalizeContainer}=require('../services/packing/PlanMetrics');
const {analyzeLayoutQuality}=require('../services/packing/LayoutQualityAnalyzer');
const {exactVoidMetrics}=require('../services/packing/ExactLayoutMetrics');
const Validator=require('../services/packing/PlanValidator');
const V=require('../services/HybridConstraintPackingSolverV25');
(async()=>{
 const [task,b]=await buildProjectBenchmarkCases(),cargo=normalizeCargoList(task.cargoList),container=normalizeContainer(task.container);
 const rows=[];
 const {generateBackWallCandidates}=require('../services/packing/BackWallReconstruction');
 for(const mode of ['VOID_FIRST','LOW_FILL_THEN_VOID'])for(const order of ['FILL_DESC','FILL_ASC','MASS_ASC']){
  const c=new Builder({columnCandidateMode:mode,layerOrderingModeByPort:{1:order,2:order,3:order}}).build(cargo,container,{strategy:'OPERATION'});
  const v=new Validator().validate({placements:c.placements,cargoList:cargo,unloadedCargo:c.unloaded,container,requireOrientationMetadata:true});
  const q=analyzeLayoutQuality({placements:c.placements,container,cargoList:cargo});
  rows.push({mode,order,loaded:c.placements.length,hard:v.hardViolationCount,cog:v.checks.cog,internal:q.internalVoidVolume,exact:exactVoidMetrics(c.placements,container)});
  if(order==='FILL_DESC') for(const [i,r] of generateBackWallCandidates({basePlacements:c.placements,container,beamWidth:40,searchDepth:12,maximumStates:30000,maximumResults:6}).entries()){
   const ev=V.evaluateCandidate({candidateId:mode+'-'+i,sourceAlgorithm:'probe',placements:r.placements,unloadedCargo:c.unloaded,cargoList:cargo,container,strategy:'OPERATION',route:[],caseContext:{},validator:new Validator()});
   rows.push({mode:mode+'-BEAM-'+i,order,loaded:ev.loadedCargo.length,hard:ev.validator.hardViolationCount,pass:ev.hardConstraintsPass,cog:ev.validator.checks.cog,internal:ev.layoutQuality.internalVoidVolume,exact:ev.metrics.exactVoid});
  }
 }
 const a=await new V().generatePackingPlan(task.cargoList,task.container,{strategy:'OPERATION'});
 const br=await new V().generatePackingPlan(b.cargoList,b.container,{strategy:'OPERATION'});
 const out=path.resolve(__dirname,'../../artifacts/master-rebuild-20260922/algorithm');
 fs.writeFileSync(path.join(out,'quality-probe.json'),JSON.stringify({rows,a,b:br},null,2));
 console.log(JSON.stringify({rows,a:{id:a.candidateId,internal:a.layoutQuality.internalVoidVolume,exact:a.metrics.exactVoid},b:{id:br.candidateId,hard:br.hardConstraintsPass,cog:br.metrics.cog}}));
})().catch(e=>{console.error(e);process.exitCode=1;});
