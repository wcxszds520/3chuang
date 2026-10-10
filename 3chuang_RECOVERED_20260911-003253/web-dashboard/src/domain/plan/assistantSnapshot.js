import { placementSpaceEvidence } from './placementSpaceEvidence.js';
import { getPlanSourceLabel, normalizePlanSource } from '../provenance/planSource.js';
import { DECISION_CONTAINER_TYPES, getContainer, containerVolume } from '../container/catalog.js';
import { generateLocalPreview } from '../container/localPreview.js';

export function buildAssistantSnapshot({ session, plan, page, extra = {}, at = new Date().toISOString() }) {
  const space = placementSpaceEvidence(plan);
  const readiness = plan.shipmentReadiness || plan.ext_shipmentReadiness;
  const evidence = (readiness?.evidence || []).map(e => ({
    id:e.id,title:e.title,status:e.status,summary:e.summary,
    currentValue:e.currentValue,calculation:e.calculation,responsibility:e.responsibility,action:e.requiredAction,
    ruleReferences:(e.ruleReferences || []).map(r=>({id:r.id,sourceDocument:r.sourceDocument,clause:r.clause,
      materialKind:'PROJECT_RULE_SUMMARY',sourceUrl:r.sourceUrl,verifiedAt:r.verifiedAt || null}))
  }));
  const facts=[];
  const add=(id,label,value,unit,definition,sourceField)=>{
    if (value !== null && value !== undefined && Number.isFinite(Number(value))) facts.push({id,label,value:Number(value),unit,definition,sourceField});
  };
  add('planned_count','计划装入',plan.loadedCargo?.length,'件','正式或预览布局中的货物数量，不代表现场已装','loadedCargo.length');
  add('input_count','订单数量',session.cargo?.reduce((n,c)=>n+Number(c.quantity || 0),0),'件','订单录入数量','session.cargo.quantity');
  add('input_weight','订单货物总重',session.cargo?.reduce((n,c)=>n+Number(c.quantity || 0)*Number(c.weight || 0),0),'kg','运输单元总重，不含箱体自重；不是VGM','session.cargo.weight*quantity');
  add('volume_utilization','体积利用率',space.volumeUtilizationPercent,'%','货物求解包络体积之和 / 箱体内腔容积','sum(loadedCargo.l*w*h)/containerInfo.volume');
  add('deep_gap','深端净距',space.zones.find(z=>z.id==='SPACE-DEEP-END')?.gapMm ?? (plan.loadedCargo?.length ? Math.min(...plan.loadedCargo.map(c=>c.x)) : null),'mm','深端内壁到首件货物的实际间距','min(loadedCargo.x)');
  add('unexplained_volume','未解释空间估算',plan.voidJustification?.unexplainedVoidVolume == null ? null : plan.voidJustification.unexplainedVoidVolume/1e9,'m³','网格及横截面分析的未解释余隙，非可用容量；与体积利用率分开','voidJustification.unexplainedVoidVolume');
  add('longitudinal_offset','纵向重心偏移',plan.cogOffset?.longitudinal,'%','货重加权重心距箱长中心 / 半箱长','cogOffset.longitudinal');
  const comparisons=(session.cargo?.length?DECISION_CONTAINER_TYPES:[]).map(type=>{
    const candidate=getContainer(type),preview=generateLocalPreview(session.cargo,candidate);
    const formal=type===session.selectedContainerType && normalizePlanSource(plan)==='BACKEND_SOLVED';
    const loaded=formal?plan.loadedCargo.length:preview.totalCargoCount;
    const input=preview.totalCargoInput;
    add(`container_${type}_loaded`,`${type}${formal?'正式计划':'初筛'}装入`,loaded,'件','同票货物的柜型比较；未正式求解的柜型只属预览',formal?'loadedCargo.length':'generateLocalPreview');
    add(`container_${type}_volume`,`${type}参考内腔容积`,containerVolume(candidate)/1e9,'m³','参考内尺寸计算的容积，不是运价或可补货容量','container.innerLength*innerWidth*innerHeight');
    return {type,loaded,input,unloaded:input-loaded,volumeM3:containerVolume(candidate)/1e9,source:formal?'BACKEND_SOLVED':'LOCAL_PREVIEW',doorWidth:candidate.doorWidth,doorHeight:candidate.doorHeight,maxWeight:candidate.maxWeight};
  });
  const preferred=[...comparisons].sort((a,b)=>a.unloaded-b.unloaded || a.volumeM3-b.volumeM3)[0];
  const selectedCargo=plan.loadedCargo?.find(c=>c.cargoId===extra.selectedCargo?.cargoId);
  const selectedEvidence=evidence.find(e=>e.id===extra.selectedEvidenceId);
  const selectedVoid=[...(plan.voidJustification?.zones || []),...space.zones].find(z=>z.id===extra.selectedVoid?.id);
  const selectedObject=selectedCargo ? {kind:'cargo',id:selectedCargo.cargoId,label:selectedCargo.name,
    dimensions:{l:selectedCargo.l,w:selectedCargo.w,h:selectedCargo.h},position:{x:selectedCargo.x,y:selectedCargo.y,z:selectedCargo.z},
    placementReason:selectedCargo.placementReason?.statement,
    candidateEvidence:{source:selectedCargo.candidateTrace?.accepted?.source || null,seedPosition:selectedCargo.candidateTrace?.accepted?.position || null,
      finalPosition:{x:selectedCargo.x,y:selectedCargo.y,z:selectedCargo.z},postprocessing:selectedCargo.algorithmMeta,
      rejectedRecordCount:selectedCargo.candidateTrace?.rejected?.length || 0,
      limitation:'只记录选中来源和初始位置；统一分量值不是可比较的搜索评分。没有逐候选拒绝记录时，不能证明所有其他位置不可行。初始坐标经过整体平移，以finalPosition为当前真值。'},
    handlingMethod:selectedCargo.handlingMethod,stackable:selectedCargo.stackable,supportRatio:selectedCargo.supportRatio}
    : selectedEvidence ? {kind:'evidence',id:selectedEvidence.id,label:selectedEvidence.title}
      : selectedVoid ? {kind:'space',...selectedVoid} : null;
  const data={schemaVersion:1,caseId:session.caseContext?.caseId || session.order.orderNo,page,
    planId:plan.planId || null,version:plan.constraintMeta?.solverRevision || plan.metrics?.solverVersion || 'preview',
    placementHash:plan.placementHash || null,sourceKind:normalizePlanSource(plan),sourceLabel:getPlanSourceLabel(plan),
    container:session.selectedContainerType,inputFingerprint:plan.inputFingerprint || null,
    selectedObject, facts,evidence,readiness:readiness?.overallStatus || null,
    recommendation:{type:preferred?.type,method:'按未装件数升序，再按柜内容积升序；无运价输入，不能宣称最便宜',reason:'装入数量相同时，较小柜内容积是当前选择依据；是否已经正式求解仅说明证据强度，不是优先推荐该柜型的原因。',alternatives:comparisons},placementSpaceEvidence:space,
    cargoSummary:(session.cargo || []).map(c=>({name:c.name,sku:c.sku,quantity:c.quantity,weightKg:c.weight,packaging:c.packagingType,handling:c.handlingMethod,dimensionsMm:[c.length,c.width,c.height],portSequence:c.portSequence})),
    outstandingActions:evidence.filter(e=>!['READY','PASS','NOT_APPLICABLE'].includes(e.status)).map(e=>({id:e.id,title:e.title,status:e.status,owner:e.responsibility,action:e.action})),
    dataTimestamp:plan.timestamp || null,
    boundaries:{actualLoadingConfirmed:false,liveRegulatoryRetrieval:false,sourceMaterialKind:'PROJECT_RULE_SUMMARY',
      geometryMeaning:'边界、碰撞、支撑和堆码检查；不等于运输系固，也不等于仅检查重心。',
      sourceMeaning:'现有条款定位和项目摘要，不是本轮抓取的法规原文；查看官方链接核对全文。'},
    allowedActions:['compare_containers','open_evidence',...(selectedCargo?['locate_cargo']:[]),...(selectedVoid?['locate_space']:[])]};
  let hash=2166136261;
  for(const ch of JSON.stringify(data)){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return {...data,snapshotId:`ctx-${(hash>>>0).toString(16)}`,capturedAt:at};
}

export function formatFact(fact) {
  return `${fact.value.toLocaleString('zh-CN',{maximumFractionDigits:fact.unit==='件'?0:fact.unit==='m³'?3:2})} ${fact.unit}`;
}
