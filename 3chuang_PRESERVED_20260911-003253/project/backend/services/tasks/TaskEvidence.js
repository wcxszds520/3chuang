'use strict';
const {clone,fail}=require('./LoadTaskModel');

const fields = {container:['declaredVGMKg','method','shipperDeclaration','containerNumber','cscPlateReference','maxGross','treatmentMark','exemptionBasis','handlingReference','handlingProfile','levelDockConfirmed','bridgeCapacityKg','floorAxleCapacityKg','securingReference'],order:['packingListReference','shipperDeclaration']};
function recordTaskEvidence(task,input) {
  const scope=input.scope; const values=input.values;
  if(!fields[scope]||!values||typeof values!=='object'||Array.isArray(values))fail('资料类型或字段无效');
  if(Object.keys(values).some(key=>!fields[scope].includes(key)))fail('资料含不支持的字段');
  const cleaned={};
  for(const key of fields[scope]) {
    const value=values[key];
    if(value==null||value==='')continue;
    if(['declaredVGMKg','maxGross','bridgeCapacityKg','floorAxleCapacityKg'].includes(key)) {
      if(!Number.isFinite(Number(value))||Number(value)<=0)fail('重量必须为正数，单位kg');
      cleaned[key]=Number(value);
    } else {
      if(typeof value!=='string'||value.length>500)fail('资料字段须为不超过500字的文字');
      cleaned[key]=value.trim();
    }
  }
  if(cleaned.method&&!['METHOD_1','METHOD_2'].includes(cleaned.method))fail('请选择VGM核实方法');
  if(cleaned.handlingProfile&&!['STANDARD_JACK','SHORT_JACK','COMPACT_FORKLIFT'].includes(cleaned.handlingProfile))fail('参考作业设备配置无效');
  const next=clone(task); const recordedAt=new Date().toISOString();
  if(scope==='container') {
    const container=next.containers.find(c=>c.containerId===input.objectId);if(!container)fail('柜不存在');
    next.evidenceByContainer={...next.evidenceByContainer,[input.objectId]:{
      source:'LOCAL_OPERATOR_DOCUMENT_RECORD',recordedAt,planHash:container.plan.placementHash,planVersion:container.planVersion,
      vgm:{declaredVGMKg:cleaned.declaredVGMKg,method:cleaned.method,shipperDeclaration:cleaned.shipperDeclaration},
      actualContainer:{containerNumber:cleaned.containerNumber,cscPlateReference:cleaned.cscPlateReference,maxGross:cleaned.maxGross},
      woodPackagingEvidence:{treatmentMark:cleaned.treatmentMark,exemptionBasis:cleaned.exemptionBasis},
      handlingEvidence:{reference:cleaned.handlingReference,profile:cleaned.handlingProfile||'STANDARD_JACK',profileSource:'REFERENCE_EQUIPMENT_PREVIEW',site:{levelDockConfirmed:cleaned.levelDockConfirmed==='true',bridgeCapacityKg:cleaned.bridgeCapacityKg,floorAxleCapacityKg:cleaned.floorAxleCapacityKg}},securingInputs:{reference:cleaned.securingReference}
    }};
  } else {
    if(!next.orders.some(o=>o.orderId===input.objectId))fail('订单不存在');
    next.evidenceByOrder={...next.evidenceByOrder,[input.objectId]:{...cleaned,source:'LOCAL_OPERATOR_DOCUMENT_RECORD',recordedAt}};
  }
  return next;
}
module.exports={recordTaskEvidence};
