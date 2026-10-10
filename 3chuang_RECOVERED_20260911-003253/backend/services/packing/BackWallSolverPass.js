'use strict';
const CrossSectionLayerBuilder=require('./CrossSectionLayerBuilder');
const FloorExtremePointCandidate=require('./FloorExtremePointCandidate');
const { anchoredWalls,generateBackWallCandidates,generateWallCandidates }=require('./BackWallReconstruction');

async function solveBackWall({cargoList,container,options,config,evaluate,compare}) {
  const started=Date.now(),evaluated=[],seen=new Set(),phases=[];
  const firstPort=Math.min(...cargoList.map(c=>Number(c.portSequence||1)));
  function add(placements,unloadedCargo,id,evidence={}) {
    const key=JSON.stringify(placements.map(p=>[p.cargoId,p.x,p.y,p.z,p.l,p.w,p.h]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
    if(seen.has(key))return null;seen.add(key);
    placements=placements.map(p=>({...p,
      constructionSeedTrace:p.constructionSeedTrace||p.candidateTrace,
      candidateTrace:{accepted:{position:{x:p.x,y:p.y,z:p.z},orientation:p.orientation,source:id,status:'CANDIDATE'},rejected:[]},
      algorithmMeta:{...p.algorithmMeta,algorithm:'hybrid-v2.5',candidateSource:id,globalTranslationApplied:Boolean(evidence.translation)},
      placementReason:{strategy:options.strategy,candidateSource:id,statement:evidence.translation?'按真实质量矩计算边界内平衡平移；支撑、港序、作业与重心全部独立复验，箱端空隙仍需系固审查':'从有效深端构造；承托组件及货墙累计重排，完整方案通过独立约束复核后才可入选'}
    }));
    const result=evaluate({placements,unloadedCargo,candidateId:id,sourceAlgorithm:evidence.translation?'bounded-balance-translation-v1':'back-wall-constructive-v1',generationPhase:id,
      inheritedConstraintMeta:{backWallConstruction:evidence},translationRequested:false,sourceRuntimeMs:Date.now()-started});
    result.constraintMeta.backWallConstruction={...evidence,globalTranslationApplied:Boolean(evidence.translation)};
    evaluated.push(result);return result;
  }
  let phaseStart=Date.now();
  const built=new CrossSectionLayerBuilder({...config,columnCandidateModeByPort:{[firstPort]:'VOID_FIRST'},layerOrderingModeByPort:{[firstPort]:'FILL_DESC'}}).build(cargoList,container,{strategy:options.strategy});
  add(built.placements,built.unloaded,'B_BACK_WALL_CONSTRUCTION',{candidateSource:built.candidateSource,stages:built.stageReports});
  add(anchoredWalls(built.placements,true),built.unloaded,'B_WALL_MASS_ORDER');
  const floor=new FloorExtremePointCandidate({maximumInstances:9,beamWidth:512,maximumStarts:8}).build(cargoList,container);
  if(floor)add(floor.placements,floor.unloaded,'B_FLOOR_EXTREME_POINTS');
  phases.push({phase:'B',elapsedMs:Date.now()-phaseStart});
  const quality=options.searchQuality||config.searchQuality||'quality';
  // The permutation pass itself permits only adjacent walls with the same
  // unloading group. Mixed-route inputs can still benefit within each group.
  for(const [index,candidate] of generateWallCandidates(built.placements,container).entries())
    add(candidate.placements,built.unloaded,`C_WALL_${index}`,candidate.evidence);
  for(const [trial,mode,width,depth] of [['C','LOCAL',8,4],['D','LANE',quality==='fast'?10:20,quality==='fast'?4:8]]) {
    phaseStart=Date.now();
    const candidates=generateBackWallCandidates({basePlacements:built.placements,container,mode,beamWidth:width,searchDepth:depth,maximumResults:4});
    for(const [index,candidate] of candidates.entries())add(candidate.placements,built.unloaded,`${trial}_${mode}_${index}`,candidate.evidence);
    phases.push({phase:trial,elapsedMs:Date.now()-phaseStart,exploredStates:candidates[0]?.evidence.exploredStates||0});
  }
  let selected=[...evaluated].sort(compare)[0];
  if(!selected?.hardConstraintsPass||selected.metrics.rearWall.deepEndPrimaryGap>50||selected.unloadedCargo.length){
    phaseStart=Date.now();
    // One controlled expansion: alternative sorting/column policy plus a wider
    // cumulative neighbourhood. Still deterministic and bounded by state count.
    const expanded=new CrossSectionLayerBuilder({...config,maximumLayerVariants:5,columnCandidateMode:'VOID_FIRST'}).build(cargoList,container,{strategy:'BALANCE'});
    add(expanded.placements,expanded.unloaded,'EXPANDED_CONSTRUCTION');
    for(const [seedIndex,seed] of [built,expanded].entries()){
      const candidates=generateBackWallCandidates({basePlacements:seed.placements,container,beamWidth:40,searchDepth:12,maximumStates:30000,maximumResults:6});
      for(const [index,candidate] of candidates.entries())add(candidate.placements,seed.unloaded,`EXPANDED_${seedIndex}_${index}`,candidate.evidence);
    }
    phases.push({phase:'CONTROLLED_EXPANSION',elapsedMs:Date.now()-phaseStart});
    selected=[...evaluated].sort(compare)[0];
  }
  // A sparse order need not occupy the rear wall at the expense of a failed
  // mass-balance gate. Offer a real bounded translation as a separate candidate
  // only when current geometry is valid and CoG is the blocker. No input mass,
  // dimensions, support relation or old saved placement is changed in place.
  if(selected?.validator.valid && !selected.validator.checks.cog.withinPolicy && selected.loadedCargo.length && !(options.lockedPlacements?.length)){
    const ps=selected.loadedCargo,mass=ps.reduce((n,p)=>n+p.weight,0);
    if(mass>0){
      const cogX=ps.reduce((n,p)=>n+(p.x+p.l/2)*p.weight,0)/mass,cogZ=ps.reduce((n,p)=>n+(p.z+p.w/2)*p.weight,0)/mass;
      const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
      const shiftX=clamp(container.innerLength/2-cogX,-Math.min(...ps.map(p=>p.x)),container.innerLength-Math.max(...ps.map(p=>p.x+p.l)));
      const shiftZ=clamp(container.innerWidth/2-cogZ,-Math.min(...ps.map(p=>p.z)),container.innerWidth-Math.max(...ps.map(p=>p.z+p.w)));
      const translation={mode:'BOUNDED_BALANCE_TRANSLATION',shiftX,shiftZ,reason:'CURRENT_GEOMETRY_VALID_BUT_COG_GATE_FAILED'};
      add(ps.map(p=>({...p,x:p.x+shiftX,z:p.z+shiftZ})),selected.unloadedCargo,'BALANCE_TRANSLATION',{translation,sourceCandidateId:selected.candidateId});
      selected=[...evaluated].sort(compare)[0];
    }
  }
  selected.metrics.solveMs=Date.now()-started;selected.metrics.elapsedMs=selected.metrics.solveMs;
  for(const p of selected.loadedCargo)p.candidateTrace.accepted.status=selected.hardConstraintsPass?'SELECTED':'INFEASIBLE_DIAGNOSTIC';
  selected.metrics.algorithm='hybrid-v2.5';selected.metrics.solverVersion='2.5.3';
  selected.metrics.searchQuality=quality;
  selected._algorithmId='hybrid-v2.5';selected._strategyUsed=String(options.strategy||'SPACE').toLowerCase();
  selected.constraintMeta={...selected.constraintMeta,solverVersion:'2.5.3',solverRevision:'2.5.3-back-wall',officialSolver:'hybrid-v2.5',
    standardsProfile:'PORTCUBE project policy; CTU guidance is not an operational release',
    candidateSources:[...new Set(evaluated.map(p=>p.sourceAlgorithm))],selectedCandidateSource:selected.candidateId,
    positioning:['back-wall-anchored','support-component-reconstruction','cumulative-repacking'],
    coordinateContract:{lengthAxis:'x',gravityAxis:'y',widthAxis:'z',doorSide:'higher x coordinate',origin:'inner rear floor corner',placementAnchor:'minimum corner'},
    skuAndBatchSpatialBarriers:false,portAccessConstraint:'earlier-unload cargo must retain a higher-X extraction corridor',
    stabilityModel:selected.validator.stability.model,securingModel:selected.securing.model,operationModel:selected.operationFeasibility.model,
    geometricStabilityStatus:selected.validator.stability.status,securingStatus:selected.securing.status,
    actualOperationBlockedCount:selected.operationFeasibility.blockedCount,
    lifoCompliant:selected.validator.checks.lifo&&selected.portAccessibility.status==='FULL_UNLOAD_PASS',
    portAccessModel:selected.portAccessibility.model,handlingAssumptions:selected.handlingAssumptions,
    cargoTruthModel:'CARGO_PHYSICAL_PROFILE_AND_PACKAGING_PROFILE_V2_5',
    fullUnloadPass:selected.portAccessibility.status==='FULL_UNLOAD_PASS',postUnloadStabilityPass:selected.portAccessibility.postUnloadStabilityPass,
    portfolio:{selectedCandidateId:selected.candidateId,candidatesEvaluated:evaluated.length,phases,
      selectionOrder:['all hard constraints','loaded count','primary rear gap (width weighted P90)','exact irregular internal void','exact internal void','CoG','operation cost'],
      candidates:evaluated.map(p=>({candidateId:p.candidateId,placementHash:p.placementHash,hardConstraintsPass:p.hardConstraintsPass,
        cogConstraintPass:p.validator.checks.cog.withinPolicy,
        mandatoryGateViolationCount:p.mandatoryGateViolationCount,
        loadedCount:p.loadedCargo.length,hardViolationCount:p.validator.hardViolationCount,operationBlockedCount:p.operationFeasibility.blockedCount,
        portStatus:p.portAccessibility.status,postUnloadStabilityPass:p.portAccessibility.postUnloadStabilityPass,
        rearWall:p.metrics.rearWall,exactVoid:p.metrics.exactVoid,cog:p.metrics.cog,
        search:p.constraintMeta.backWallConstruction}))}};
  return selected;
}
module.exports={solveBackWall};
