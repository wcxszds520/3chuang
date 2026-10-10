const {buildTaskContext,readTaskContext}=require('../../services/tasks/TaskContext');
const {validateTaskAnswer}=require('../../services/tasks/TaskAssistant');
const {recordTaskEvidence}=require('../../services/tasks/TaskEvidence');
const {assertLocks}=require('../../services/tasks/LoadTaskModel');
const probe=require('../../../artifacts/rebuild/multi-container-probe.json');

const task=probe.append[0].task;
test('reference forklift site input binds to one plan without marking external evidence ready',()=>{
  const cab=task.containers[1],next=recordTaskEvidence(task,{scope:'container',objectId:cab.containerId,values:{handlingProfile:'COMPACT_FORKLIFT',levelDockConfirmed:'true',bridgeCapacityKg:'6000',floorAxleCapacityKg:'5000',handlingReference:'TEST ONLY synthetic reference, no site approval'}});
  const saved=next.evidenceByContainer[cab.containerId];
  expect(saved.planHash).toBe(cab.plan.placementHash);expect(saved.handlingEvidence.site).toEqual({levelDockConfirmed:true,bridgeCapacityKg:6000,floorAxleCapacityKg:5000});
  expect(buildTaskContext(next,{containerId:cab.containerId}).checks.find(c=>c.id==='PORT-HANDLING').status).not.toBe('READY');
  expect(()=>recordTaskEvidence(task,{scope:'container',objectId:cab.containerId,values:{floorAxleCapacityKg:'-1'}})).toThrow('正数');
});

test('cargo-row context binds the customer, original dimensions and allocation independently of cabinet totals',()=>{
  const row=task.rows[task.rows.length-1],unit=task.units.find(u=>u.rowId===row.rowId),cab=task.containers.find(c=>c.plan.loadedCargo.some(p=>p.rowId===row.rowId));
  const context=buildTaskContext(task,{containerId:cab.containerId,rowId:row.rowId});
  expect(context.selectedRow.customerName).toBe(unit.customerName);expect(context.selectedRow.orderId).toBe(row.orderId);
  expect(context.facts.find(f=>f.id==='row_length').value).toBe(unit.length);expect(context.facts.find(f=>f.id==='row_quantity').value).toBe(row.quantity);
  expect(context.snapshotId).toContain(`:row:${row.rowId}`);
  expect(()=>buildTaskContext(task,{rowId:'unknown'})).toThrow('货物行');
  const other=task.containers.flatMap(c=>c.plan.loadedCargo).find(p=>p.rowId!==row.rowId),otherCab=task.containers.find(c=>c.plan.loadedCargo.includes(other));
  expect(()=>buildTaskContext(task,{containerId:otherCab.containerId,unitId:other.cargoId,rowId:row.rowId})).toThrow('当前货物行');
});
test('task facts bind actual customer/container geometry and retain missing site evidence',()=>{
  const selected=task.containers[1];
  const context=buildTaskContext(task,{containerId:selected.containerId});
  expect(context.facts.find(f=>f.id==='task_total').value).toBe(16);
  expect(context.facts.find(f=>f.id==='task_weight').value).toBe(4000);
  expect(context.facts.find(f=>f.id==='cab_count').value).toBe(selected.plan.loadedCargo.length);
  expect(context.checks.find(e=>e.id==='BOX-VGM').status).toBe('DATA_REQUIRED');
  expect(context.checks.find(e=>e.id==='PORT-HANDLING').status).toBe('EXTERNAL_CONFIRMATION_REQUIRED');
  expect(context.evidence.every(e=>!e.id.startsWith('CN-')&&!e.id.startsWith('NINGBO'))).toBe(true);
  expect(context.checks.find(e=>e.id==='PORT-ACCESS').title).toContain('目的地');
  expect(context.facts.find(f=>f.id==='task_pending').value).toBeGreaterThan(0);
});
test('context rejects stale task revisions and cross-cabinet unit selection',async()=>{
  const service={get:async()=>({...task,revision:9})};
  await expect(readTaskContext(service,task.taskId,{baseRevision:8})).rejects.toMatchObject({code:'TASK_VERSION_CONFLICT'});
  expect(()=>buildTaskContext(task,{containerId:task.containers[0].containerId,unitId:'unrelated'})).toThrow('实物件');
});
test('replay context validates identity and geometry, retains blocking and never records execution',()=>{
  const container=task.containers[1], active=container.plan.loadedCargo[0];
  const operation={planHash:container.plan.placementHash,direction:'load',phase:'BLOCKED',completedUnitIds:[],activeUnitId:active.cargoId,blockedCodes:['JACK_ENVELOPE_EXCEEDED']};
  const context=buildTaskContext(task,{containerId:container.containerId,operation});
  expect(context.operation.source).toBe('CLIENT_REPLAY_SNAPSHOT');
  expect(context.operation.activeUnit.weight).toBe(active.weight);
  expect(context.operation.blockedReasons[0].code).toBe('JACK_ENVELOPE_EXCEEDED');
  expect(context.facts.find(f=>f.id==='replay_completed').value).toBe(0);
  expect(context.snapshotId).toContain(':operation:');
  const answer={conclusion:'当前回放因设备包络不匹配而阻断。',basis:[],cautions:[],nextSteps:[],sourceIds:[],actions:[]};
  expect(validateTaskAnswer(answer,context).valid).toBe(true);
  expect(validateTaskAnswer({...answer,conclusion:'搬运可以顺利完成。'},context).valid).toBe(false);
  for(const change of [{planHash:'OLD'},{activeUnitId:task.containers[0].plan.loadedCargo[0].cargoId},{completedUnitIds:['invented']},{completedUnitIds:[active.cargoId,active.cargoId]},{phase:'COMPLETED'},{phase:'constructor'},{blockedCodes:['APPROVED']},{blockedCodes:['toString']}]) {
    expect(()=>buildTaskContext(task,{containerId:container.containerId,operation:{...operation,...change}})).toThrow('回放快照');
  }
  expect(container.lockedUnitIds).toHaveLength(0);
  const unloading=buildTaskContext(task,{containerId:container.containerId,operation:{...operation,direction:'unload',phase:'UNLOADING',step:'JACK_LIFT',blockedCodes:[]}});
  expect(unloading.operation.phaseLabel).toBe('地牛放下交接');
  expect(validateTaskAnswer({...answer,conclusion:'回放尚未推进。'},unloading).valid).toBe(false);
});
test('assistant rejects invented values, missing-data approval, references and object mutations',()=>{
  const context=buildTaskContext(task);
  const answer={conclusion:'当前柜型仍需结合实际货物与出运资料复核。',basis:[{text:'已保存的逐柜方案可作为比较依据。',factIds:['task_total']}],cautions:[],nextSteps:[],sourceIds:[],actions:[{type:'VIEW_READINESS'}]};
  expect(validateTaskAnswer(answer,context).valid).toBe(true);
  expect(validateTaskAnswer({...answer,conclusion:'不能认为没有待办，也不代表可以直接出运。'},context).valid).toBe(true);
  expect(validateTaskAnswer({...answer,conclusion:'现场设备尚无确认记录。'},context).valid).toBe(true);
  expect(validateTaskAnswer({...answer,conclusion:'柜 2属于已保存任务。'},context).valid).toBe(true);
  expect(validateTaskAnswer({...answer,conclusion:'柜99属于已保存任务。'},context).valid).toBe(false);
  expect(validateTaskAnswer({...answer,conclusion:'几何空隙已解释，说明没有剩余可装体积。'},context).valid).toBe(false);
  for(const change of [{conclusion:'可以直接出运'},{conclusion:'已装入999件'},{sourceIds:['invented']},{actions:[{type:'APPLY_PLAN'}]},{actions:[{type:'FOCUS_CONTAINER',targetId:'invented'}]}]){
    expect(validateTaskAnswer({...answer,...change},context).valid).toBe(false);
  }
  const zero={...answer,conclusion:'旧网格未解释空隙为零不等于全局最优。'};
  const withZero={...context,facts:[...context.facts.filter(f=>f.id!=='unexplained_volume'),{id:'unexplained_volume',value:0}]};
  expect(validateTaskAnswer(zero,withZero).valid).toBe(true);
  expect(validateTaskAnswer(zero,{...withZero,facts:withZero.facts.map(f=>f.id==='unexplained_volume'?{...f,value:1}:f)}).valid).toBe(false);
});

test('evidence is versioned outside sealed geometry and becomes stale after a different plan',()=>{
  const before=JSON.parse(JSON.stringify(task));const cab=before.containers[0];
  cab.status='SEALED';cab.lockedUnitIds=cab.plan.loadedCargo.map(p=>p.cargoId);
  const next=recordTaskEvidence(before,{scope:'container',objectId:cab.containerId,values:{declaredVGMKg:5000,method:'METHOD_1',shipperDeclaration:'TEST-DOCUMENT',handlingReference:'WAREHOUSE-TEST'}});
  expect(()=>assertLocks(before,next)).not.toThrow();
  let context=buildTaskContext(next);
  expect(context.checks.find(e=>e.id==='BOX-VGM').status).toBe('READY');
  expect(before.evidenceByContainer).toBeUndefined();
  const revised=JSON.parse(JSON.stringify(next));revised.containers[0].plan.placementHash='DIFFERENT-PLAN';
  context=buildTaskContext(revised);
  expect(context.readiness[0].staleRecord).not.toBeNull();
  expect(context.checks.find(e=>e.id==='BOX-VGM').status).toBe('DATA_REQUIRED');
  expect(()=>recordTaskEvidence(before,{scope:'container',objectId:cab.containerId,values:{declaredVGMKg:-1}})).toThrow('正数');
  expect(()=>recordTaskEvidence(before,{scope:'container',objectId:cab.containerId,values:{approved:true}})).toThrow('不支持');
});
