const fs=require('fs');
const assert=require('assert/strict');
const {appendRows,clone,assertConservation,assertLocks}=require('../backend/services/tasks/LoadTaskModel');
const {MultiContainerPlanner}=require('../backend/services/tasks/MultiContainerPlanner');
const base=JSON.parse(fs.readFileSync('artifacts/rebuild/multi-container-probe.json')).base[0].task;
const service=base.orders[0].service;
const row={name:'追加实物件',sku:'SAME-SKU',length:1000,width:900,height:1100,weight:180,quantity:2,packagingType:'PALLETIZED_CARTONS',stackable:false,maxStackLayers:1,canRotate:true,handlingMethod:'forklift'};
const input={customerName:'乙',orderReference:'B',service,rows:[row]};
(async()=>{
  const planner=new MultiContainerPlanner();const reports=[];
  const locked=clone(base);for(const c of locked.containers){c.status='LOADED_LOCKED';c.lockedUnitIds=c.plan.loadedCargo.map(p=>p.cargoId);}
  let task=appendRows(locked,input);let [candidate]=await planner.preview(task,{containerTypes:['20GP'],maximumContainers:2});
  assertLocks(locked,candidate.task);assertConservation(candidate.task);assert.equal(candidate.summary.total,16);
  reports.push({case:'LOCKED_POSITIONS',pass:true,summary:candidate.summary,unassigned:candidate.task.unassigned});console.log('LOCKED_POSITIONS_PASS',candidate.summary);
  const sealed=clone(locked);for(const c of sealed.containers)c.status='SEALED';
  task=appendRows(sealed,input);[candidate]=await planner.preview(task,{containerTypes:['20GP'],maximumContainers:3});
  assertLocks(sealed,candidate.task);assertConservation(candidate.task);assert.equal(candidate.summary.assigned,16);assert.equal(candidate.summary.containers,3);
  reports.push({case:'SEALED_USES_NEW_CABINET',pass:true,summary:candidate.summary});console.log('SEALED_PASS');
  task=appendRows(base,{...input,service:{...service,serviceId:'OTHER-SERVICE',destination:'RTM',strippingPoint:'RTM-CFS'}});
  [candidate]=await planner.preview(task,{containerTypes:['20GP']});assertConservation(candidate.task);assert.equal(candidate.summary.assigned,16);assert.equal(candidate.summary.containers,3);
  assert(candidate.rejected.some(r=>r.reason.includes('运输服务不同')));
  reports.push({case:'INCOMPATIBLE_SERVICE_NEW_CABINET',pass:true,summary:candidate.summary});console.log('INCOMPATIBLE_SERVICE_PASS');
  task=appendRows(sealed,{...input,rows:[row,{...row,name:'超出门洞和柜长',length:20000,width:4000,height:5000,quantity:1}]});
  [candidate]=await planner.preview(task,{containerTypes:['20GP'],maximumContainers:4});assertConservation(candidate.task);assert.equal(candidate.summary.total,17);assert.equal(candidate.summary.assigned,16);assert.equal(candidate.summary.unassigned,1);
  reports.push({case:'PARTIAL_APPEND_NO_LOST_UNIT',pass:true,summary:candidate.summary,unassigned:candidate.task.unassigned});console.log('PARTIAL_PASS');
  fs.writeFileSync('artifacts/rebuild/task-constraint-audit.json',JSON.stringify(reports,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
