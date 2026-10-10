// Shared by the browser and API. Dataset names belong in adapters/contracts,
// never in coordinate construction or solver scoring.
export const CAPABILITY_VERSION='SOURCE_CAPABILITY_R2_1';
// The native business engine does not yet combine these source industrial
// mechanics with port/handling rules. Never advertise that combination as valid.
export function businessSimulationCapabilities(source) {
  const industrial=['orlib_wtpack','ortec_alonso_2019','renault_esicup_2015'].includes(source);
  return {solverMode:'PORTCUBE_BUSINESS_SIMULATION',benchmarkMode:'BUSINESS_SIMULATION',
    canSolve:!industrial,blockingReasons:industrial?['COMBINED_SOURCE_AND_BUSINESS_RULES_UNSUPPORTED']:[],
    sourceIndustrialRules:industrial?'SOURCE_BENCHMARK_ONLY':'NOT_APPLICABLE',officialBenchmarkResult:false};
}
const definitions={
  orlib_thpack:{objective:'MAX_LOADED_VOLUME',weight:'NOT_PROVIDED',loadBearing:'NOT_APPLICABLE',stackingGroup:'NOT_APPLICABLE',topBottom:'NOT_APPLICABLE',officialChecker:'NOT_AVAILABLE',sourceScope:'SINGLE_CONTAINER_GEOMETRY'},
  orlib_wtpack:{objective:'MAX_LOADED_VOLUME',weight:'SOURCE_FACT',loadBearing:'ORIENTATION_PRESSURE_KG_CM2',stackingGroup:'NOT_APPLICABLE',topBottom:'NOT_APPLICABLE',officialChecker:'NOT_AVAILABLE',sourceScope:'SINGLE_CONTAINER_PRESSURE'},
  ortec_alonso_2019:{objective:'MAX_LOADED_VOLUME',weight:'SOURCE_FACT',loadBearing:'NOT_PROVIDED',stackingGroup:'SAME_GROUP_CONFIRMED_CROSS_GROUP_UNSUPPORTED',topBottom:'DIRECT_SUPPORT_GRAPH',officialChecker:'NOT_AVAILABLE',sourceScope:'SINGLE_TRUCK_PRODUCT_RULE_SUBSET'},
  renault_esicup_2015:{objective:'MAX_LOADED_VOLUME',weight:'SOURCE_FACT',loadBearing:'STACK_DENSITY_AND_BOTTOM_LOAD',stackingGroup:'METAL_NONMETAL_SEPARATION',topBottom:'NONINCREASING_LAYER_WEIGHT',officialChecker:'EXPORT_REQUIRED',sourceScope:'SINGLE_BIN_SINGLE_ITEM_LAYER_SUBSET'},
  esicup_irregular:{objective:'SOURCE_DEFINED',weight:'NOT_PROVIDED',loadBearing:'UNSUPPORTED',stackingGroup:'UNSUPPORTED',topBottom:'UNSUPPORTED',officialChecker:'NOT_AVAILABLE',sourceScope:'SOURCE_MESH_PRESERVATION'}
};
export function sourceContainers(source,instance) {
  let list=[];
  if(source==='renault_esicup_2015')list=(instance.containers||[]).map(c=>({sourceType:String(c['bin type']),innerLength:c['length (mm)'],innerWidth:c['width (mm)'],innerHeight:c['height (mm)'],maxWeight:c['maximal weight (kg)'],sourceFacts:c}));
  if(source==='ortec_alonso_2019')list=(instance.trucks||[]).map(c=>({sourceType:String(c[0]),innerLength:c[2],innerWidth:c[1],innerHeight:c[3],maxWeight:c[4],sourceFacts:c}));
  if(source==='orlib_thpack' && instance.container?.originalUnit==='cm') {
    const c=instance.container;list=[{sourceType:instance.id,innerLength:c.lengthOriginal*10,innerWidth:c.widthOriginal*10,innerHeight:c.heightOriginal*10,maxWeight:null,sourceFacts:c}];
  }
  if(source==='orlib_wtpack') {
    const c=instance.container;
    if(['length','width','height'].every(k=>c?.[k]?.originalUnit==='cm'))list=[{sourceType:instance.id,innerLength:c.length.originalValue*10,innerWidth:c.width.originalValue*10,innerHeight:c.height.originalValue*10,maxWeight:null,sourceFacts:c}];
  }
  return list.map((c,index)=>({...c,typeId:sourceContainerId({source,instanceId:instance.id,index,...c}),source,instanceId:instance.id,index,name:`${source} · ${c.sourceType}`,mode:'SOURCE_BENCHMARK',dimensionUnit:'mm',weightUnit:'kg',capacityM3:c.innerLength*c.innerWidth*c.innerHeight/1e9}));
}
function sourceContainerId(value) {
  const input=JSON.stringify(value);let a=2166136261,b=0x9e3779b9;
  for(let i=0;i<input.length;i++){a=Math.imul(a^input.charCodeAt(i),16777619);b=Math.imul(b^input.charCodeAt(i),2246822519);}
  return `SRC_${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
export function externalCapabilities(source,instance) {
  const base=definitions[source];
  const reasons=[];
  if(!base)reasons.push('UNSUPPORTED_SOURCE');
  if(source==='esicup_irregular')reasons.push('SOURCE_MESH_BROWSE_ONLY');
  if(source==='orlib_thpack'&&!/^thpack[1-7]$/.test(instance.family||''))reasons.push('UNSUPPORTED_SOURCE_FORMAT_OR_UNIT');
  const geometry=Boolean(instance.items?.length)&&(instance.items||[]).every(c=>[c.lengthMm,c.widthMm,c.heightMm].every(x=>Number.isFinite(x)&&x>0)&&Number.isInteger(c.quantity)&&c.quantity>0);
  if(!geometry)reasons.push('INCOMPLETE_GEOMETRY');
  if(base?.weight==='SOURCE_FACT'&&!(instance.items||[]).every(c=>Number.isFinite(c.weightKg)&&c.weightKg>=0))reasons.push('INCOMPLETE_SOURCE_MASS');
  if(base?.loadBearing==='ORIENTATION_PRESSURE_KG_CM2'&&!(instance.items||[]).every(c=>c.loadBearingUnit==='kg/cm²'&&['lengthUpright','widthUpright','heightUpright'].every(k=>Number.isFinite(c.loadBearing?.[k])&&c.loadBearing[k]>=0)))reasons.push('INCOMPLETE_SOURCE_PRESSURE');
  // Capability screening uses only the normalized source declarations. The R1
  // semantic resolver remains authoritative for constructing/validating tuples.
  if((instance.items||[]).some(c=>c.orientationConstraints?.mappingStatus==='UNSUPPORTED'||(source==='ortec_alonso_2019'&&!['x','y','z'].every(k=>c.orientationConstraints?.[k]===true))))reasons.push('UNSUPPORTED_SOURCE_ORIENTATION');
  if(!sourceContainers(source,instance).length)reasons.push('SOURCE_CONTAINER_UNAVAILABLE');
  return {...base,version:CAPABILITY_VERSION,source,instanceId:instance.id,geometry:geometry?'BOX_GEOMETRY':'UNSUPPORTED',orientation:'R1_SEMANTIC_TUPLE',originalContainer:'SOURCE_ONLY',meshGeometry:source==='esicup_irregular'?'PRESERVED_BROWSE_ONLY':'NOT_APPLICABLE',solverMode:'SOURCE_BENCHMARK',benchmarkMode:source==='orlib_thpack'?'GEOMETRY_ONLY_BENCHMARK':'SOURCE_CONSTRAINT_BENCHMARK',canSolve:reasons.length===0,blockingReasons:reasons,fullSourceProblem:['orlib_thpack','orlib_wtpack'].includes(source),supportModel:'FULL_BASE_CONTACT_UNION',businessReadiness:'NOT_APPLICABLE',unsupported:source==='ortec_alonso_2019'?['CROSS_GROUP_ORDER','NON_111_ORIENTATION','LAYER_PALLET_COMPOSITION','TRUCK_ROUTING','AXLE_LOAD','DELIVERY_SCHEDULING']:source==='renault_esicup_2015'?['MULTI_ITEM_LAYER_CONSTRUCTION','FULL_INSTANCE_CHECKER_PENDING']:[]};
}
