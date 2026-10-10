'use strict';

const { buildShipmentReadiness } = require('../realworld/ShipmentReadinessService');
const { RULES } = require('../realworld/RuleRegistry');
const { fail } = require('./LoadTaskModel');
const { taskOperationContext } = require('./TaskOperationContext');

const SOURCE_BY_ID = new Map(RULES.map(rule => [rule.id, rule]));

function buildTaskContext(task, {containerId, unitId, rowId, preview, candidateId, historical = false, decisions = [], operation: operationInput} = {}) {
  const selected = task.containers.find(c => c.containerId === containerId) || task.containers[0];
  if (containerId && selected?.containerId !== containerId) fail('所选柜不属于当前任务版本', 'TASK_CONTEXT_STALE', 409);
  const selectedUnit = selected?.plan.loadedCargo.find(p => p.cargoId === unitId);
  if (unitId && !selectedUnit) fail('所选实物件不属于当前柜和版本', 'TASK_CONTEXT_STALE', 409);
  const selectedRow=task.rows.find(row=>row.rowId===rowId);
  if(rowId&&!selectedRow)fail('所选货物行不属于当前任务版本','TASK_CONTEXT_STALE',409);
  if(selectedRow&&selectedUnit&&selectedUnit.rowId!==selectedRow.rowId)fail('所选实物件不属于当前货物行','TASK_CONTEXT_STALE',409);
  const rowUnits=selectedRow?task.units.filter(unit=>unit.rowId===rowId):[];
  const rowAssigned=selectedRow?task.containers.flatMap(c=>c.plan.loadedCargo).filter(p=>p.rowId===rowId).length:0;
  const operation = taskOperationContext(operationInput, selected);
  const readiness = task.containers.map(container => {
    const units = container.plan.loadedCargo;
    const stored = task.evidenceByContainer?.[container.containerId];
    const stale = Boolean(stored && stored.planHash !== container.plan.placementHash);
    const recorded = stale ? {} : stored || {};
    const report = buildShipmentReadiness({plan:container.plan, placements:units, cargoList:units, container:container.equipment,
      containerMode:recorded.actualContainer?.containerNumber ? 'ACTUAL_CONTAINER' : 'REFERENCE_PROFILE', ...recorded,
      caseContext:{transportModel:task.transportModel, caseDate:task.orders[0]?.service.windowStart, jurisdictions:['INTERNATIONAL']}});
    for (const row of report.evidence) {
      // The task has no declared origin jurisdiction or named terminal yet.
      // Do not turn a demo service label into Chinese/Ningbo applicability.
      row.ruleReferences = row.ruleReferences.filter(ref => SOURCE_BY_ID.get(ref.id)?.jurisdiction === 'INTERNATIONAL');
      if (row.id === 'PORT-HANDLING') {
        const reference=recorded.handlingEvidence?.reference;
        row.status = reference?'REVIEW_REQUIRED':'EXTERNAL_CONFIRMATION_REQUIRED';
        row.summary = reference?'设备依据已记录，仍需责任方核对真实设备与现场工况':'搬运方法已规划；现场设备、叉孔和作业能力尚未提供确认记录';
        row.requiredAction = '由仓库主管核对设备载荷表、叉孔、月台及箱地板承载；参考预演不能作为现场放行。';
        row.completeness = reference?'RECORDED_PENDING_REVIEW':'MISSING_SITE_CAPABILITY';
        if(reference)row.detail=`已录入依据：${reference}。当前来源为本地操作员记录，系统未验真。`;
      }
      if (row.id === 'PORT-ACCESS' && task.transportModel === 'OCEAN_LCL') {
        row.title = '目的地拆箱与取出路径'; row.detail = '海运共同服务在目的地统一拆箱；本计算不表示在中途挂靠港打开拼箱。';
      }
    }
    const pending = report.evidence.filter(row => !['READY','NOT_APPLICABLE'].includes(row.status));
    return {containerId:container.containerId, label:container.label, planVersion:container.planVersion,
      placementHash:container.plan.placementHash, evidence:report.evidence, pendingCount:pending.length,
      recorded, staleRecord:stale?{planHash:stored.planHash,recordedAt:stored.recordedAt}:null};
  });
  const orderEvidence = task.orders.map(order => {
    const stored = task.evidenceByOrder?.[order.orderId] || {};
    return {orderId:order.orderId, customerId:order.customerId, customerName:task.customers.find(c => c.customerId === order.customerId)?.name,
      reference:order.reference, service:order.service, documents:stored,
      status:stored.packingListReference && stored.shipperDeclaration ? 'REVIEW_REQUIRED' : 'DATA_REQUIRED',
      requiredAction:'托运人补齐装箱清单及货物声明，由货代核对件数、重量、目的地和服务。'};
  });
  const selectedReadiness = readiness.find(r => r.containerId === selected?.containerId);
  const evidence = selectedReadiness?.evidence || [];
  const sourceIds = new Set(evidence.flatMap(row => row.ruleReferences.map(ref => ref.id)));
  const sources = [...sourceIds].map(id => {const rule = SOURCE_BY_ID.get(id); return {
    id, title:rule.title, authority:rule.authority, sourceDocument:rule.sourceDocument, sourceUrl:rule.sourceUrl, clause:rule.clause,
    verifiedAt:rule.verifiedAt, effectiveFrom:rule.effectiveFrom, contentType:'LOCAL_PROJECT_SUMMARY_AND_OFFICIAL_LOCATOR',
    liveRetrieved:false, applicability:'国际运输资料准备索引；目的地具体要求仍待责任方核对'};});
  const facts = [];
  const add = (id,label,value,unit) => {if (Number.isFinite(Number(value)) && value != null) facts.push({id,label,value:Number(value),unit});};
  add('task_total','任务实物件',task.units.length,'件');add('task_assigned','计划分配',task.units.length-task.unassigned.length,'件');
  add('task_unassigned','未分配',task.unassigned.length,'件');add('task_containers','柜数',task.containers.length,'柜');
  add('task_weight','任务总货重',task.units.reduce((sum,u) => sum+u.weight,0),'kg');
  add('task_pending','逐柜资料与复核待办',readiness.reduce((sum,r) => sum+r.pendingCount,0),'项');
  add('order_pending','待核对客户订单资料',orderEvidence.length,'票');
  if(selectedRow){add('row_quantity','当前货物行数量',rowUnits.length,'件');add('row_assigned','当前货物行已分配',rowAssigned,'件');add('row_unassigned','当前货物行未分配',rowUnits.length-rowAssigned,'件');for(const [field,label,unit] of [['length','输入长','mm'],['width','输入宽','mm'],['height','输入高','mm'],['weight','单件质量','kg']])add(`row_${field}`,`当前货物行${label}`,rowUnits[0]?.[field],unit);}
  if (operation) {
    add('replay_completed','页面回放完成（非实际装入）',operation.completedCount,'件');
    if (operation.activeUnit) for (const [field,label,unit] of [['l','长','mm'],['w','宽','mm'],['h','高','mm'],['weight','质量','kg']]) add(`replay_unit_${field}`,`当前搬运货物${label}`,operation.activeUnit[field],unit);
  }
  if (selected) {
    const p = selected.plan;
    add('cab_count','当前柜计划装入',p.loadedCargo.length,'件');add('cab_weight','当前柜货重',p.totalWeight,'kg');
    add('cab_utilization','当前柜容积利用率',p.spaceUtilization,'%');
    add('cog_longitudinal','纵向重心偏移（全内长）',p.metrics.cog.longitudinal,'%');add('cog_lateral','横向重心偏移（全内宽）',p.metrics.cog.lateral,'%');
    add('deep_gap','深端净空',p.loadedCargo.length ? Math.min(...p.loadedCargo.map(u=>u.x)) : null,'mm');
    add('unexplained_volume','旧网格未解释空隙',p.voidJustification?.unexplainedVoidVolume / 1e9,'m³');
    add('exact_internal','货面分段积分内部空隙',p.layoutQuality?.exactVoidGeometry?.internalVoidVolume / 1e9,'m³');
    add('exact_no_stack','分段积分禁压上空',p.layoutQuality?.exactVoidGeometry?.nonStackableHeadspaceVolume / 1e9,'m³');
    add('exact_other','分段积分其余内部空隙',p.layoutQuality?.exactVoidGeometry?.unexplainedVoidVolume / 1e9,'m³');
    add('locked_units','已记录装入并锁定',selected.lockedUnitIds.length,'件');
  }
  if (selectedUnit) for (const [field,label,unit] of [['l','选中货物长','mm'],['w','选中货物宽','mm'],['h','选中货物高','mm'],['weight','选中货物质量','kg']]) add(`unit_${field}`,label,selectedUnit[field],unit);
  const candidates = preview?.candidates.map((candidate,i) => {
    for (const [key,label,unit] of [['assigned','计划分配','件'],['unassigned','未分配','件'],['containers','柜数','柜'],['addedContainers','新增柜','柜'],['movedUnits','需移动原货','件']]) add(`candidate_${i}_${key}`,`${candidate.label} · ${label}`,candidate.summary[key],unit);
    return {candidateId:candidate.candidateId, label:candidate.label, summary:candidate.summary, impacts:candidate.impacts,
      rejected:candidate.rejected.map(r => ({reason:r.reason,containerId:r.containerId,typeId:r.typeId,count:r.unitIds.length}))};
  }) || [];
  for (const [i,decision] of decisions.entries()) for (const [j,choice] of decision.choices.entries()) {
    for (const [field,label,unit] of [['assigned','计划装入','件'],['unassigned','未分配','件'],['containers','柜数','柜'],['movedUnits','移动原货','件']]) add(`decision_${i}_${j}_${field}`,`${decision.actionLabel} · ${choice.label} · ${label}`,choice.summary[field],unit);
  }
  return {snapshotId:`${task.taskId}:${task.revision}:${preview?.previewId || (historical?'history':'saved')}:${candidateId || ''}:${selected?.containerId || ''}:${unitId || ''}${rowId?`:row:${rowId}`:''}${operation?`:operation:${operation.signature}`:''}`,
    taskId:task.taskId, revision:task.revision, stage:preview?'CANDIDATE_PREVIEW':historical?'HISTORICAL_READ_ONLY':'SAVED_TASK',
    name:task.name, transportModel:task.transportModel, selectedContainerId:selected?.containerId, selectedUnitId:selectedUnit?.cargoId,
    selectedRow:selectedRow?{rowId,name:selectedRow.name,customerId:selectedRow.customerId,customerName:task.customers.find(c=>c.customerId===selectedRow.customerId)?.name,orderId:selectedRow.orderId,orderReference:task.orders.find(o=>o.orderId===selectedRow.orderId)?.reference,packagingType:rowUnits[0]?.packagingType,handlingMethod:rowUnits[0]?.handlingMethod,stackable:rowUnits[0]?.stackable,maxStackLayers:rowUnits[0]?.maxStackLayers,planned:rowAssigned>0}:null,
    container:selected?.equipment.typeId, recommendation:{alternatives:['20GP','40GP','40HQ'].map(type=>({type}))},
    containers:task.containers.map(c => ({containerId:c.containerId,label:c.label,type:c.equipment.typeId,status:c.status,
      planVersion:c.planVersion,placementHash:c.plan.placementHash,plannedCount:c.plan.loadedCargo.length,lockedCount:c.lockedUnitIds.length,
      operationProfile:task.evidenceByContainer?.[c.containerId]?.planHash===c.plan.placementHash?task.evidenceByContainer[c.containerId].handlingEvidence?.profile||'STANDARD_JACK':'STANDARD_JACK',
      operationProfileScope:'参考设备预演，不代表现场确认',owners:[...new Set(c.plan.loadedCargo.map(p=>p.customerName))]})),
    selectedUnit:selectedUnit ? {unitId:selectedUnit.cargoId,name:selectedUnit.name,customerName:selectedUnit.customerName,orderReference:selectedUnit.orderReference,
      x:selectedUnit.x,y:selectedUnit.y,z:selectedUnit.z,l:selectedUnit.l,w:selectedUnit.w,h:selectedUnit.h,handlingMethod:selectedUnit.handlingMethod,
      stackable:selectedUnit.stackable,maxStackLayers:selectedUnit.maxStackLayers} : null,
    facts, readiness, orderEvidence, checks:evidence, evidence:sources, candidates, savedDecisions:decisions, operation,
    unassigned:task.unassigned.map(item => ({...item,name:task.units.find(u => u.unitId===item.unitId)?.name})),
    availableActions:['COMPARE_CONTAINERS','OPEN_APPEND','VIEW_SPACE','VIEW_READINESS','FOCUS_CONTAINER','FOCUS_UNIT'],
    dataBoundary:'后端保存的任务/候选版本；规划装入不等于实际装入；本地法规索引不是实时检索；无外部放行结论'};
}

async function readTaskContext(service, taskId, input = {}) {
  const current = await service.get(taskId);
  if (Number(input.baseRevision) !== current.revision) fail('任务版本已更新，请刷新后提问', 'TASK_VERSION_CONFLICT', 409);
  let task = current; let preview;
  if (input.previewId) {
    const [rows] = await service.db.query('SELECT snapshot FROM load_task_preview WHERE preview_id=? AND task_id=?',[input.previewId,taskId]);
    if (!rows[0]) fail('候选不存在','TASK_PREVIEW_NOT_FOUND',404);
    preview = typeof rows[0].snapshot === 'string' ? JSON.parse(rows[0].snapshot) : rows[0].snapshot;
    if (preview.baseRevision !== current.revision) fail('候选基于旧任务版本，请重新计算','TASK_VERSION_CONFLICT',409);
    task = preview.candidates.find(c=>c.candidateId===input.candidateId)?.task;
    if (!task) fail('候选不属于本次预览');
  } else if (input.revision != null) task = await service.get(taskId,input.revision);
  const [history] = await service.db.query('SELECT revision, action FROM load_task_version WHERE task_id=? AND revision<=? ORDER BY revision DESC LIMIT 10',[taskId,task.revision]);
  const decisions=[]; const decode=value=>typeof value==='string'?JSON.parse(value):value;
  for (const entry of history) {
    const action=decode(entry.action);
    if(!action.previewId)continue;
    const [saved]=await service.db.query("SELECT JSON_EXTRACT(snapshot,'$.candidates[*].summary') AS summaries, JSON_EXTRACT(snapshot,'$.candidates[*].label') AS labels, JSON_EXTRACT(snapshot,'$.candidates[*].candidateId') AS ids FROM load_task_preview WHERE preview_id=? AND task_id=?",[action.previewId,taskId]);
    if(!saved[0])continue;
    const ids=decode(saved[0].ids), labels=decode(saved[0].labels), summaries=decode(saved[0].summaries);
    decisions.push({revision:entry.revision,actionLabel:action.type==='APPEND_AND_APPLY'?'追加客户时的已确认比较':'已确认柜型比较',
      selectedLabel:action.label,selectionOrigin:'USER_CONFIRMED',choices:ids.map((id,i)=>({label:labels[i],summary:summaries[i],selected:id===action.candidateId}))});
    if(decisions.length===3)break;
  }
  return buildTaskContext(task,{...input,preview,decisions,historical:input.revision!=null});
}

module.exports = {buildTaskContext,readTaskContext};
