const fs=require('fs');
const assert=require('assert/strict');
const base='http://127.0.0.1:3000/api/load-tasks';
async function get(path=''){const response=await fetch(base+path);const data=await response.json();assert(response.ok,data.message);return data.data;}
(async()=>{
  const list=await get();const item=list.find(t=>t.name==='多柜与追加客户 · 实测');assert(item,'GUI-created task missing');
  const task=await get('/'+item.taskId);const history=await get('/'+item.taskId+'/history');
  const first=await get('/'+item.taskId+'?revision=1');assert.equal(first.containers.length,0);assert.equal(first.units.length,14);
  const ids=task.containers.flatMap(c=>c.plan.loadedCargo.map(p=>p.cargoId)).concat(task.unassigned.map(u=>u.unitId));
  assert.equal(new Set(ids).size,task.units.length);assert.equal(ids.length,task.units.length);
  const response=await fetch(base+'/'+item.taskId+'/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseRevision:0,containerId:task.containers[0].containerId,status:'CONFIRMED'})});
  assert.equal(response.status,409);const rejection=await response.json();assert.equal(rejection.errorCode,'TASK_VERSION_CONFLICT');
  const latest=await get('/'+item.taskId);assert.equal(latest.revision,task.revision);
  const planned=await get('/'+item.taskId+'?revision=3');
  assert.deepEqual(task.units,planned.units);
  for(const cabinet of task.containers){
    const original=planned.containers.find(c=>c.containerId===cabinet.containerId);assert(original);
    assert.deepEqual(cabinet.plan,original.plan);
    assert(cabinet.lockedUnitIds.every(id=>cabinet.plan.loadedCargo.some(p=>p.cargoId===id)));
  }
  const result={taskId:item.taskId,revision:task.revision,total:task.units.length,assigned:ids.length-task.unassigned.length,unassigned:task.unassigned.length,containers:task.containers.length,
    history:history.map(h=>h.revision),initialSnapshotPreserved:true,quantityAndIdentityConserved:true,geometryUnchangedSinceV3:true,
    states:task.containers.map(c=>({label:c.label,status:c.status,locked:c.lockedUnitIds.length,hash:c.plan.placementHash})),staleWriteStatus:response.status,staleWriteRejectedWithoutMutation:true};
  fs.writeFileSync('artifacts/rebuild/task-api-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
