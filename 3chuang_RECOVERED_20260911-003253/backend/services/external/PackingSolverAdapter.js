'use strict';

// Optional research adapter for the upstream MIT-licensed PackingSolver binary.
// Coordinates: upstream X/Y/Z = PORTCUBE X/Z/Y. Rotation is read from the
// certificate, never inferred from dimensions (which are ambiguous for cubes).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { resolveOrientationRules } = require('../packing/OrientationConstraint');
const { placement } = require('../packing/SourceBenchmarkSolver');
const { validateSourcePlan } = require('../packing/SourceConstraintValidator');

const ROTATIONS = Object.freeze({ XYZ:'LWH', YXZ:'WLH', ZYX:'HWL', YZX:'WHL', XZY:'LHW', ZXY:'HLW' });

function assessCapability(task) {
  const reasons = [];
  if (task.lockedPlacements?.length) reasons.push('FIXED_PLACEMENTS_UNSUPPORTED');
  if (task.rules?.pressure) reasons.push('ORIENTATION_CONTACT_PRESSURE_UNSUPPORTED');
  if (task.rules?.layeredStacks) reasons.push('SOURCE_LAYER_HIERARCHY_UNSUPPORTED');
  if (task.rules?.lifo) reasons.push('PORT_ORDER_NOT_MAPPED');
  for (const c of task.cargoList || []) {
    if (![c.length,c.width,c.height,c.quantity].every(Number.isInteger)) reasons.push('INTEGER_MM_AND_QUANTITY_REQUIRED');
    if (!resolveOrientationRules(c).orientations.length) reasons.push('ORIENTATION_UNSUPPORTED');
    if (c.alwaysOnTop || c.alwaysOnBottom || c.stackingGroup != null || c.stackLayerScope === 'SAME_SKU') reasons.push('SOURCE_STACK_RELATION_UNSUPPORTED');
    if (c.incompatibleWith?.length) reasons.push('INCOMPATIBILITY_UNSUPPORTED');
    if (!Number.isFinite(c.weight) || c.weight < 0) reasons.push('WEIGHT_NOT_PROVIDED');
  }
  return { supported:reasons.length === 0, reasons:[...new Set(reasons)], solver:'packingsolver-boxstacks',
    scope:'RECTANGULAR_EQUAL_FOOTPRINT_STACKS', productionPromoted:false };
}

function buildInput(task) {
  const capability = assessCapability(task);
  if (!capability.supported) throw Object.assign(new Error(capability.reasons.join(', ')), { code:'EXTERNAL_UNSUPPORTED', capability });
  const columns = ['X','Y','Z','COPIES','PROFIT','WEIGHT','MAXIMUM_STACKABILITY','MAXIMUM_WEIGHT_ABOVE','STACKABILITY_ID', ...Object.keys(ROTATIONS).map(k=>'ROTATION_'+k)];
  const skipped = [];
  const sources = [];
  const rows = [];
  const footprintGroups = new Map();
  for (const c of task.cargoList) {
    const allowed = resolveOrientationRules(c).orientations.flatMap(o=>o.semanticVariants)
      .filter(o => (!task.container.doorWidth || o.w <= task.container.doorWidth) && (!task.container.doorHeight || o.h <= task.container.doorHeight));
    if (!allowed.length) { skipped.push(c); continue; }
    sources.push(c);
    // Upstream boxstacks requires equal footprints in each compatibility
    // group. Keep different permitted footprint sets in separate groups; this
    // conservative adapter restriction is recorded, not a source cargo fact.
    const footprintKey=JSON.stringify([...new Set(allowed.map(o=>[o.l,o.w].join(':')))].sort());
    if(!footprintGroups.has(footprintKey))footprintGroups.set(footprintKey,footprintGroups.size);
    const topLimit = c.stackable === false || c.fragile === true ? 0 : c.maximumSupportedWeightKg ?? c.maxSupportedWeight ?? task.cargoList.reduce((n,x)=>n+x.weight*x.quantity,0);
    // No-stack must not prohibit the item from resting on another package.
    // MAXIMUM_WEIGHT_ABOVE=0 expresses that constraint for nonzero masses.
    if ((c.stackable === false || c.fragile === true) && task.cargoList.some(x=>x.weight === 0)) {
      throw Object.assign(new Error('Zero-mass top items require explicit no-stack support'), {code:'EXTERNAL_UNSUPPORTED'});
    }
    rows.push([c.length,c.width,c.height,c.quantity,c.length*c.width*c.height,c.weight,
      c.maxStackLayers ?? task.cargoList.reduce((n,x)=>n+x.quantity,0), topLimit,footprintGroups.get(footprintKey),
      ...Object.values(ROTATIONS).map(id=>Number(allowed.some(o=>o.id===id)))]);
  }
  // The total input mass is a nonbinding mathematical upper bound, not an
  // invented packaging rating. Upstream's CSV parser does not accept blanks.
  const itemRows = rows.map(row=>row.join(','));
  return { sources, skipped, items:columns.join(',')+'\n'+itemRows.join('\n')+'\n',
    bins:'X,Y,Z,COPIES'+(task.container.maxWeight!=null?',MAXIMUM_WEIGHT':'')+'\n'+[task.container.innerLength,task.container.innerWidth,task.container.innerHeight,1,...(task.container.maxWeight!=null?[task.container.maxWeight]:[])].join(',')+'\n',
    parameters:'NAME,VALUE\nobjective,knapsack\n' };
}

function parseCertificate(csv, input, task) {
  const lines = csv.trim().split(/\r?\n/); const keys = lines.shift().split(',');
  const placements = []; const counts = new Map();
  for (const line of lines) {
    const fields = Object.fromEntries(line.split(',').map((v,i)=>[keys[i],v]));
    if (fields.TYPE !== 'ITEM') continue;
    if (Number(fields.COPIES) !== 1 || Number(fields.BIN) !== 0) throw Error('Unexpected multi-bin certificate');
    const source = input.sources[Number(fields.ID)];
    if (!source) throw Error('Unknown certificate item type');
    const orientationId = ROTATIONS[fields.ROTATION];
    const ori = resolveOrientationRules(source).orientations.flatMap(o=>o.semanticVariants).find(o=>o.id===orientationId);
    if (!ori || ori.l!==Number(fields.LX) || ori.w!==Number(fields.LY) || ori.h!==Number(fields.LZ)) throw Error('Certificate rotation and dimensions disagree with source permission');
    const index = (counts.get(source.cargoId)||0)+1; counts.set(source.cargoId,index);
    const p = placement(source,ori,index,{x:Number(fields.X),y:Number(fields.Z),z:Number(fields.Y)});
    Object.assign(p,{portSequence:source.portSequence,fragile:source.fragile,wooden:source.wooden,handlingMethod:source.handlingMethod,
      maxSupportedWeight:source.maxSupportedWeight,algorithmMeta:{candidateSource:'PACKINGSOLVER_BOXSTACKS',upstreamRotation:fields.ROTATION}});
    placements.push(p);
  }
  placements.sort((a,b)=>a.x-b.x||a.y-b.y||a.z-b.z);
  placements.forEach((p,i)=>{ p.loadingIndex=i+1; });
  const unloadedCargo = task.cargoList.flatMap(c=>Array.from({length:Math.max(0,c.quantity-(counts.get(c.cargoId)||0))},(_,i)=>({
    ...c, quantity:1, sourceCargoId:c.cargoId,cargoId:`${c.cargoId}__piece_${String((counts.get(c.cargoId)||0)+i+1).padStart(5,'0')}`,
    reason:input.skipped.includes(c)?'DOOR_OPENING_TOO_SMALL':'EXTERNAL_SEARCH_UNPLACED' })));
  const validator=validateSourcePlan({ ...task, placements, unloadedCargo });
  return { loadedCargo:placements, placements, unloadedCargo,validator,
    loadedVolumeMm3:placements.reduce((n,p)=>n+p.l*p.w*p.h,0),algorithm:'PACKINGSOLVER_BOXSTACKS' };
}

async function solvePackingSolver(task,{binaryPath=process.env.PORTCUBE_PACKINGSOLVER_BINARY,outputDir,timeLimitMs=2000}={}) {
  if (!binaryPath || !fs.existsSync(binaryPath)) throw Object.assign(new Error('PackingSolver binary is not configured'),{code:'EXTERNAL_UNAVAILABLE'});
  if (!outputDir) throw Error('Explicit isolated output directory is required');
  const input=buildInput(task); fs.mkdirSync(outputDir,{recursive:true});
  for (const name of ['items','bins','parameters']) fs.writeFileSync(path.join(outputDir,name+'.csv'),input[name]);
  const args=['--items',path.join(outputDir,'items.csv'),'--bins',path.join(outputDir,'bins.csv'),'--parameters',path.join(outputDir,'parameters.csv'),
    '--certificate',path.join(outputDir,'solution.csv'),'--output',path.join(outputDir,'output.json'),'--time-limit',String(timeLimitMs/1000)];
  const begin=performance.now();
  const execution=await new Promise((resolve,reject)=>{
    const child=spawn(binaryPath,args,{windowsHide:true,stdio:['ignore','pipe','pipe']}); let stdout='',stderr='',settled=false;
    const timeout=setTimeout(()=>{child.kill();reject(Object.assign(new Error('External solver exceeded wall-clock budget'),{code:'EXTERNAL_TIMEOUT'}));},timeLimitMs+10000);
    child.stdout.on('data',b=>{stdout+=b;}); child.stderr.on('data',b=>{stderr+=b;});
    child.on('error',e=>{clearTimeout(timeout);if(!settled){settled=true;reject(e);}});
    child.on('close',code=>{clearTimeout(timeout);if(!settled){settled=true;resolve({code,stdout,stderr});}});
  });
  fs.writeFileSync(path.join(outputDir,'execution.json'),JSON.stringify({...execution,args,elapsedMs:performance.now()-begin},null,2));
  if (execution.code!==0 || !fs.existsSync(path.join(outputDir,'solution.csv'))) throw Object.assign(new Error(execution.stderr || 'No external certificate'),{code:'EXTERNAL_FAILED'});
  const result=parseCertificate(fs.readFileSync(path.join(outputDir,'solution.csv'),'utf8'),input,task);
  return {...result,elapsedMs:performance.now()-begin,capability:assessCapability(task),upstream:JSON.parse(fs.readFileSync(path.join(outputDir,'output.json'),'utf8'))};
}

module.exports={ROTATIONS,assessCapability,buildInput,parseCertificate,solvePackingSolver};
