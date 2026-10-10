'use strict';
const crypto=require('crypto');
const {construct}=require('./packing/SourceBenchmarkSolver');
const {validateSourcePlan}=require('./packing/SourceConstraintValidator');
const {auditCommerce,pairAllowed,cluster}=require('./packing/CommerceAudit');
const {normalizeContainer,calculatePlanMetrics}=require('./packing/PlanMetrics');
const {resolveOrientationRules}=require('./packing/OrientationConstraint');
const {buildShipmentReadiness}=require('./realworld/ShipmentReadinessService');
const shared=()=>import('../../shared/commercePackaging.mjs');
async function solveCommerce(body={}){
 const {arrivalState,validateOrderPolicies,assessOrderFulfillment,rankCommerceCandidate,assessBusinessInputs}=await import('../../shared/commerceBusiness.mjs');
 const {configurePackaging,FREIGHT_RULES}=await shared();const context=structuredClone(body.caseContext?.commerce||{});
 const {CONTAINER_CATALOG}=await import('../../web-dashboard/src/domain/container/catalog.js');
 const profile=body.actualContainer||body.containerInfo||CONTAINER_CATALOG[body.containerType||'40HQ'];
 if(!profile)throw Error('未知箱型，请填写实际集装箱资料');
 const container=normalizeContainer(profile);
 if(![container.innerLength,container.innerWidth,container.innerHeight].every(v=>v>0))throw Error('集装箱净尺寸无效');
 context.door={widthMm:profile.doorWidth||context.door?.widthMm,heightMm:profile.doorHeight||context.door?.heightMm};
 if(!Number.isFinite(Date.parse(context.planAt)))throw Error('请选择当前到仓时点');
 let original=(body.cargoList||[]).map(c=>configurePackaging({...c,rawPortSequence:c.portSequence??null,portSequence:Number(c.unloadSequence||c.portSequence||1)}));
 if(!original.length||original.length>1000)throw Error('货单行数无效');
 if(original.reduce((s,c)=>s+Number(c.quantity),0)>2000)throw Error('当前单柜求解最多 2000 个运输单元');
 for(const c of original){
  if(!c.cargoId||!c.sku||![c.length,c.width,c.height,c.quantity].every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(c.quantity))throw Error('货物身份、数量或外尺寸无效');
  if(c.weight!==null&&c.weight!==undefined&&(!Number.isFinite(c.weight)||c.weight<0))throw Error('包装毛重无效');
  if(!resolveOrientationRules(c).orientations.length)throw Error('货物没有可用方向：'+c.sku);
 }
 if(new Set(original.map(c=>c.cargoId)).size!==original.length)throw Error('货物 ID 重复');
 const sourceTask=body.externalDataset?await require('./external/ExternalTaskRuntime').buildExternalTask(body.externalDataset):null;
 if(sourceTask){
  if(!sourceTask.capabilities?.canSolve)throw Error('此来源尚不支持完整约束求解');
  const sourceById=new Map(sourceTask.cargoList.map(c=>[c.cargoId,c]));
  if(original.length!==sourceById.size)throw Error('外部来源货单数量发生变化');
  for(const c of original){const s=sourceById.get(c.cargoId);if(!s||['length','width','height','quantity','weight'].some(k=>(c[k]??null)!==(s[k]??null)))throw Error('外部来源尺寸、数量或重量发生变化');delete c.stackLayerScope;Object.assign(c,{orientationConstraints:s.orientationConstraints,loadBearing:s.loadBearing,loadBearingUnit:s.loadBearingUnit,stackingGroup:s.stackingGroup,alwaysOnTop:s.alwaysOnTop,alwaysOnBottom:s.alwaysOnBottom});if(s.stackable!=null)c.stackable=s.stackable;if(s.maxStackLayers!=null)c.maxStackLayers=s.maxStackLayers;}
  Object.assign(container,sourceTask.container);
 }
 for(const c of original){if(c.arrivedAt&&!Number.isFinite(Date.parse(c.arrivedAt)))throw Error('到仓时间无效：'+c.sku);if(!Number.isInteger(c.portSequence)||c.portSequence<1)throw Error('卸货顺序应为正整数');}
 validateOrderPolicies(original);
 const businessInputs=assessBusinessInputs(original,context.planAt);
 const available=original.filter(c=>arrivalState(c,context.planAt)==='ARRIVED');
 const withheld=original.filter(c=>!available.includes(c));
 const byId=new Map(original.map(c=>[c.cargoId,c]));
 const decorate=p=>({...p,...Object.fromEntries(['customerId','customerName','orderId','lotId','arrivalBatchId','arrivedAt','expectedArrivalAt','unloadGroup','unloadSequence','required','allowPartialShipment','shipmentPriority','packagingEvidence','packagingConfig','visualProfile','handlingMethod','maxSupportedWeight','maximumSupportedWeightKg','stackLayerScope','forkEntry','destinationPort','batchId','batchLabel'].map(k=>[k,byId.get(p.sourceCargoId)?.[k]])),portSequence:byId.get(p.sourceCargoId)?.rawPortSequence,name:byId.get(p.sourceCargoId)?.name});
 const rules={...(sourceTask?.rules||{supportRatio:1,stacking:true,layeredStacks:null,weightKnown:original.every(c=>Number.isFinite(c.weight)),payload:original.every(c=>Number.isFinite(c.weight)),pressure:false}),declaredTopLoad:true};
 const task={cargoList:available,container,rules,capabilities:{canSolve:true}};
 const locks=(context.lockedPlacements||[]).map(p=>({...p}));
 task.lockedPlacements=locks;
 if(locks.length){const lockAudit=validateSourcePlan({...task,placements:locks});if(!lockAudit.valid)throw Error('已装位置与当前货物或几何约束不一致');for(const p of locks)if(!available.some(c=>c.cargoId===p.sourceCargoId))throw Error('已装货物不在当前到仓集合');}
 const {repair,supportClosedSeed,enforceWholeOrders}=require('./packing/CommerceRepack');
 let best;const runs=[];const budget=Math.max(1000,Math.min(60000,Number(body.timeLimitMs)||60000)),deadline=Date.now()+budget;
 for(const policy of ['block-tall','block-wall','block-volume','block-mixed','block-density']){
  const c=construct(task,policy,Math.min(deadline,Date.now()+budget*(policy==='block-tall'?.12:.065)),{maximumSpaces:2400,seed:locks,
   scoreCandidates:(candidates,placements)=>{const bounds=new Map();for(const p of placements){const s=byId.get(p.sourceCargoId);const k=cluster(s);if(!bounds.has(k))bounds.set(k,p);}for(const c of candidates){const s=c.g.source,near=bounds.get(cluster(s));const distance=near?Math.hypot(c.p.x-near.x,c.p.y-near.y,c.p.z-near.z)/1000:0;const v=c.p.l*c.p.w*c.p.h; const front=c.p.x+c.p.l; const section=c.p.w*c.p.h;
 c.score=policy==='block-tall'?[-Number(s.portSequence),-c.p.h,front,-v,distance]:policy==='block-wall'?[-Number(s.portSequence),front,-v,c.p.y,distance]:policy==='block-volume'?[-Number(s.portSequence),-v,front,c.p.y,distance]:policy==='block-mixed'?[front,-section,c.p.y,-Number(s.portSequence),distance]:[-(c.p.h/container.innerHeight),front,-v,-Number(s.portSequence),distance];}},
   acceptBatch:(batch,placed)=>{
    const all=batch.map(decorate),old=placed.map(decorate);
    if(all.some(p=>(context.door?.widthMm&&p.w>context.door.widthMm)||(context.door?.heightMm&&p.h>context.door.heightMm)))return false;
    for(const a of all)for(const b of old)if(!pairAllowed(a,b,context.lifo!==false))return false;
    return true;
   }});
  c.placements=c.placements.map(decorate);c.unloadedCargo=c.unloadedCargo.map(decorate);c.audit=auditCommerce(c.placements,original,context);
  const requiredMissing=c.unloadedCargo.filter(p=>byId.get(p.sourceCargoId).required!==false).length;
  runs.push({policy,loaded:c.placements.length,volumeM3:c.loadedVolumeMm3/1e9,requiredMissing,valid:c.validator.valid&&c.audit.valid,extraClusters:c.audit.extraClusterCount,timedOut:c.stats.timedOut});
  c.fulfillment=assessOrderFulfillment(original,c.placements);c.rank=rankCommerceCandidate(c,c.fulfillment);
  if(!best||compare(c.rank,best.rank)<0)best=c;
 }
 if(!locks.length)for(const policy of ['dense','front','volume','mixed']){
  const c=require('./packing/CommerceColumnPacker').columns(task,context,policy,Math.min(deadline-budget*.45,Date.now()+budget*.035),decorate);
  c.audit=auditCommerce(c.placements,original,context);const missing=c.unloadedCargo.filter(p=>byId.get(p.sourceCargoId).required!==false).length;
  c.fulfillment=assessOrderFulfillment(original,c.placements);c.rank=rankCommerceCandidate(c,c.fulfillment);
  runs.push({policy:c.stats.policy,loaded:c.placements.length,volumeM3:c.loadedVolumeMm3/1e9,valid:c.validator.valid&&c.audit.valid,extraClusters:c.audit.extraClusterCount,timedOut:c.stats.timedOut});
  if(!best||compare(c.rank,best.rank)<0)best=c;
 }
 // Reopen real voids above and beside columns; do not reserve their full height.
 if(best?.validator.valid&&best.unloadedCargo.length&&Date.now()<deadline){
  const c=construct(task,'block-wall',Math.min(deadline,Date.now()+budget*.1),{maximumSpaces:2400,seed:best.placements,
   scoreCandidates:cs=>{for(const c of cs)c.score=[c.p.x+c.p.l,-c.p.l*c.p.w*c.p.h,c.p.y];},
   acceptBatch:(batch,old)=>batch.map(decorate).every(p=>!(context.door?.widthMm&&p.w>context.door.widthMm)&&!(context.door?.heightMm&&p.h>context.door.heightMm)&&old.map(decorate).every(q=>pairAllowed(p,q,context.lifo!==false)))});
  c.placements=c.placements.map(decorate);c.unloadedCargo=c.unloadedCargo.map(decorate);c.audit=auditCommerce(c.placements,original,context);
  c.fulfillment=assessOrderFulfillment(original,c.placements);c.rank=rankCommerceCandidate(c,c.fulfillment);
  runs.push({policy:'void-refill',loaded:c.placements.length,volumeM3:c.loadedVolumeMm3/1e9,valid:c.validator.valid&&c.audit.valid,extraClusters:c.audit.extraClusterCount,timedOut:c.stats.timedOut});
  if(compare(c.rank,best.rank)<0)best=c;
 }
 // Whole-order candidates and support-closed local reconstruction compete
 // against the incumbent. Every candidate uses the same frozen input facts.
 const consider=c=>{if(!c)return;c.placements=c.placements.map(decorate);c.audit=auditCommerce(c.placements,original,context);c.fulfillment=assessOrderFulfillment(original,c.placements);c.rank=rankCommerceCandidate(c,c.fulfillment);runs.push({policy:c.stats.policy,loaded:c.placements.length,volumeM3:c.loadedVolumeMm3/1e9,valid:c.validator.valid&&c.audit.valid,extraClusters:c.audit.extraClusterCount,timedOut:c.stats.timedOut});if(!best||compare(c.rank,best.rank)<0)best=c;};
 if(!locks.length&&Date.now()<deadline){
  const wall=require('./packing/CommerceWallPacker').walls(task,context,Math.min(deadline,Date.now()+budget*.06),decorate);consider(wall);
  if(wall.validator.valid&&Date.now()<deadline)consider(repair(task,context,decorate,wall.placements,Math.min(deadline,Date.now()+budget*.06),'wall'));
 }
 if(Date.now()<deadline)consider(repair(task,context,decorate,locks,Math.min(deadline,Date.now()+budget*.08),'order'));
 if(!locks.length&&Date.now()<deadline)consider(require('./packing/CommerceDoorReservePacker').doorReserve(task,context,Math.min(deadline,Date.now()+budget*.12),decorate));
 for(const fraction of [.55,.75,.35]){
  if(Date.now()>=deadline||!best.unloadedCargo.length)break;
  const front=Math.max(0,...best.placements.map(p=>p.x+p.l)),lockIds=new Set(locks.map(p=>p.cargoId));
  const remove=best.placements.filter(p=>p.x>=front*fraction&&!lockIds.has(p.cargoId)).map(p=>p.cargoId);
  const seed=supportClosedSeed(best.placements,remove,locks);if(!seed)continue;
  const c=repair(task,context,decorate,seed,Math.min(deadline,Date.now()+budget*.08),fraction===.75?'order':'wall');c.stats.policy='local-wall-repack-'+fraction;consider(c);
 }
 // If an indivisible order cannot be completed, defer it together with any
 // dependent stacks. Retaining a locked partial order requires user resolution.
 if(best.fulfillment.splitViolations.length){
  const atomic=enforceWholeOrders(best,task,original,context,decorate);
  if(!atomic)throw Error('已装货物属于未齐套整单，请补齐该订单或明确解除已装锁定');
  atomic.stats={...atomic.stats,policy:'whole-order-enforced'};consider(atomic);
 }
 const notArrived=withheld.flatMap(c=>Array.from({length:c.quantity},(_,i)=>({...c,quantity:1,sourceCargoId:c.cargoId,cargoId:`${c.cargoId}__piece_${String(i+1).padStart(5,'0')}`,reason:c.arrivedAt?'NOT_ARRIVED':'ARRIVAL_UNKNOWN',unloadedReason:c.arrivedAt?'NOT_ARRIVED':'ARRIVAL_UNKNOWN'})));
 const unloaded=[...best.unloadedCargo,...notArrived];const total=original.reduce((s,c)=>s+c.quantity,0),hash=crypto.createHash('sha256').update(JSON.stringify(best.placements)).digest('hex');
 if(!best||!best.validator.valid||!best.audit.valid)throw Error('未找到满足约束的候选方案');
 const calculated=calculatePlanMetrics(best.placements,container,unloaded.length,budget-(deadline-Date.now()));
 const result={planId:'COMMERCE_'+hash.slice(0,16),source:'backend',sourceCode:'BACKEND_SOLVED',solverMode:'COMMERCE',ext_algorithmId:'commerce-v4',ext_strategyUsed:'mixed-packaging-portfolio',containerInfo:container,loadedCargo:best.placements,unloadedCargo:unloaded,totalCargoCount:best.placements.length,totalCargoInput:total,totalWeight:rules.weightKnown?best.placements.reduce((s,c)=>s+c.weight,0):null,spaceUtilization:best.loadedVolumeMm3/(container.innerLength*container.innerWidth*container.innerHeight)*100,validator:best.validator,businessAudit:best.audit,hardConstraintsPass:best.validator.valid&&best.audit.valid,placementHash:hash,metrics:{...calculated,loadedCount:best.placements.length,loadedVolumeM3:best.loadedVolumeMm3/1e9,extraClusterCount:best.audit.extraClusterCount},constraintMeta:{solverRevision:'commerce-v4',lifoCompliant:best.audit.lifoPass,arrivalPass:best.audit.arrivalPass,geometryModel:'RECTANGULAR_TRANSPORT_ENVELOPE',equipmentPathVerified:false},commerce:{planAt:context.planAt,withheldCount:notArrived.length,runs,ruleReferences:FREIGHT_RULES,shippingReady:false,remainingRequired:unloaded.filter(p=>p.required!==false).length},executionStatus:{persistence:'CLIENT_WORKSPACE',solver:'COMPLETED'}};
 result.commerce.arrivalUnknownCount=original.filter(c=>!c.arrivedAt).reduce((s,c)=>s+c.quantity,0);
 result.commerce.withheldCount=businessInputs.arrival.expectedCount;
 result.commerce.excludedFromPackingCount=notArrived.length;
 result.commerce.fulfillment=best.fulfillment;
 result.commerce.selection={selectedPolicy:best.stats.policy,candidatesEvaluated:runs.length,
  validCandidates:runs.filter(r=>r.valid).length,score:best.rank,
  ranking:['独立几何与业务硬约束','整单不得拆分','按已声明订单优先级完成必运任务','必运货物体积','总装入体积','必运未装件数','批次分散程度'],
  explanation:'按上述顺序逐项比较候选；同一批货全部装入同一柜后，重排不改变体积利用率。',
  externalStatus:'RESEARCH_ONLY_NOT_PROMOTED'};
 result.commerce.businessInputs=businessInputs;
 result.commerce.decisionStatus=!best.fulfillment.shipmentTaskSatisfied?'ORDER_ACTION_REQUIRED':businessInputs.arrival.unknownCount||businessInputs.packaging.unverifiedCargoIds.length?'DATA_REQUIRED':'LAYOUT_REVIEW';
 result.constraintMeta.arrivalPass=businessInputs.arrival.unknownCount?null:best.audit.arrivalPass;
 result.constraintMeta.orderPolicyPass=best.fulfillment.policyPass;
 result.constraintMeta.solverRevision='commerce-v6-local-repack';
 result.hardConstraintsPass=result.hardConstraintsPass&&best.fulfillment.policyPass&&businessInputs.arrival.unknownCount===0;
 result.portAccessibility={lifoCompliant:best.audit.lifoPass,blockedCargoIds:best.audit.violations.flatMap(v=>v.cargoIds),evaluationScope:'UNLOAD_GROUP_DOOR_CORRIDOR',equipmentPathVerified:false};
 result.cog=rules.weightKnown?calculated.cog:null;
 result.voidJustification=require('./packing/CommerceVoidAudit').inspectVoids(best,task,context,decorate);
 result.shipmentReadiness=await buildShipmentReadiness({...body,containerInfo:container,cargoList:original.map(c=>({...c,portSequence:c.rawPortSequence})),plan:result});
 return result;
}
function compare(a,b){for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;}
module.exports={solveCommerce};
