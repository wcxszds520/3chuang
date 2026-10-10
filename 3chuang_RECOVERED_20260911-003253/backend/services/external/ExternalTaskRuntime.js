'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {pathToFileURL}=require('url');
const {resolveOrientationRules}=require('../packing/OrientationConstraint');
const root=path.resolve(__dirname,'../../..');
const sources=['renault_esicup_2015','orlib_thpack','orlib_wtpack','ortec_alonso_2019','esicup_irregular'];
const cache=new Map();
function loadDataset(source){
  if(!sources.includes(source))throw runtimeError('UNSUPPORTED_SOURCE','未注册的外部数据源');
  if(!cache.has(source))cache.set(source,JSON.parse(fs.readFileSync(path.join(root,'data/external/normalized',source,'instances.json'))));
  return cache.get(source);
}
function cargoFromSource(item){
  const clean=v=>String(v).replace(/[^a-z0-9]/gi,'_');
  return {cargoId:`ext_${clean(item.externalSource)}_${clean(item.externalInstance)}_${clean(item.externalItemId)}`,sku:String(item.externalItemId),name:item.name,
    length:item.lengthMm,width:item.widthMm,height:item.heightMm,weight:item.weightKg,quantity:item.quantity,
    orientationConstraints:item.orientationConstraints,orientationPolicySource:'DERIVED_EXTERNAL',source:'external-dataset-copy',
    packagingType:item.packagingType,stackable:typeof item.stackability==='boolean'?item.stackability:null,maxStackLayers:item.maxStackLayers,
    loadBearing:item.loadBearing,loadBearingUnit:item.loadBearingUnit,stackingGroup:item.stackingGroup,alwaysOnTop:item.alwaysOnTop,alwaysOnBottom:item.alwaysOnBottom,
    externalMetadata:item,portSequence:null,destinationPort:null,batchId:null,handlingMethod:null};
}
async function buildExternalTask({source,instanceId,sourceContainerIndex=0,derivedDemoId}={}) {
  const dataset=loadDataset(source),instance=dataset.instances.find(i=>i.id===instanceId);
  if(!instance)throw runtimeError('UNKNOWN_BENCHMARK_INSTANCE','来源实例不存在');
  const contract=await import(pathToFileURL(path.join(root,'shared/externalCapabilities.mjs')).href);
  const capabilities=contract.externalCapabilities(source,instance),containers=contract.sourceContainers(source,instance);
  if(!Number.isInteger(sourceContainerIndex)||sourceContainerIndex<0||sourceContainerIndex>=containers.length) {
    if(capabilities.canSolve)throw runtimeError('INVALID_SOURCE_CONTAINER','所选来源箱体不存在');
  }
  const cargoList=instance.items.map(cargoFromSource);
  if(capabilities.canSolve)for(const cargo of cargoList){const r=resolveOrientationRules(cargo);if(r.status!=='VALID'){capabilities.canSolve=false;capabilities.blockingReasons.push(`ORIENTATION_${r.status}`);}}
  const container=containers[sourceContainerIndex]||null;
  let layeredStacks=null;
  if(source==='renault_esicup_2015'){
    const base=path.join(root,'data/external/raw',source),file=path.resolve(base,instance.rawPath,'parameters.txt');
    if(!file.startsWith(base+path.sep))throw runtimeError('INVALID_SOURCE_PATH','来源路径越界');
    const parameters=Object.fromEntries(fs.readFileSync(file,'utf8').trim().split(/\r?\n/).map(line=>{const [key,value]=line.split('=');return [key.trim(),Number(value)];}));
    layeredStacks={model:'SINGLE_ITEM_LAYERS_EQUAL_FOOTPRINT',maxNonMetalDensityKgM2:parameters.maximum_density_allowed_kg,maxWeightAboveBottomKg:parameters.maximum_weigth_above_item_kg,parameters};
  }
  const factsFingerprint=crypto.createHash('sha256').update(JSON.stringify({source,instanceId,cargo:instance.items,container,layeredStacks})).digest('hex');
  const task={source,instanceId,instance,dataset:{source,displayName:dataset.displayName,dataClassification:dataset.dataClassification},cargoList,container,containers,capabilities,factsFingerprint,
    rules:{supportRatio:1,pressure:capabilities.loadBearing==='ORIENTATION_PRESSURE_KG_CM2',stacking:source==='ortec_alonso_2019',layeredStacks,payload:Number.isFinite(container?.maxWeight),weightKnown:cargoList.every(c=>Number.isFinite(c.weight)),business:false}};
  return derivedDemoId?require('./DerivedHeroTask').applyDerivedHeroTask(task,derivedDemoId):task;
}
function runtimeError(code,message){return Object.assign(new Error(message),{code});}
module.exports={buildExternalTask,loadDataset,cargoFromSource,runtimeError,sources};
