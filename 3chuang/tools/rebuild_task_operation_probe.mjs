import {OperationMachine} from '../web-dashboard/src/three/operation/operationMachine.js';
import fs from 'node:fs';
const root='http://127.0.0.1:3000/api/load-tasks';
const list=await(await fetch(root)).json();const item=list.data.find(t=>t.name==='多柜与追加客户 · 实测');
const {data:task}=await(await fetch(root+'/'+item.taskId)).json();
const cab=task.containers[1];const operationProfile=process.argv.includes('--short')?'SHORT_JACK':task.evidenceByContainer?.[cab.containerId]?.handlingEvidence?.profile;
const machine=new OperationMachine({...cab.plan,containerInfo:{...cab.equipment,operationProfile}});
machine.play();const transitions=[];let last='';
for(let ticks=0;ticks<40000;ticks++){
  const s=machine.tick(.1);
  const key=s.currentIndex+':'+s.phase;if(key!==last){transitions.push({index:s.currentIndex,phase:s.phase,actor:s.actorType,stage:s.actorStage,reasons:s.blockedReasons});last=key;}
  if(['COMPLETED','BLOCKED'].includes(s.phase))break;
}
const snapshot=machine.getSnapshot();
const result={taskId:task.taskId,revision:task.revision,containerId:cab.containerId,placementHash:cab.plan.placementHash,operationProfile,transitions,
  phase:snapshot.phase,completed:snapshot.completedCount,reasons:snapshot.blockedReasons,current:snapshot.currentCargo};
fs.writeFileSync(`artifacts/rebuild/task-operation-probe${process.argv.includes('--short')?'-short':''}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({phase:result.phase,completed:result.completed,reasons:result.reasons,last:transitions.slice(-5)},null,2));
