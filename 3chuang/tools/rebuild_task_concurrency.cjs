const fs=require('node:fs');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:3000/api/load-tasks';
async function request(path,body){
  const response=await fetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  return {status:response.status,body:await response.json()};
}
(async()=>{
  const created=await request('',{name:'版本并发回归 · 测试资料',customerName:'回归测试客户',orderReference:'TEST-CAS',transportModel:'OCEAN_LCL',source:'DEMO_PRESET',
    service:{serviceId:'TEST-SERVICE',destination:'HAM',strippingPoint:'TEST-CFS',windowStart:'2026-09-15',windowEnd:'2026-09-22'},
    rows:[{name:'回归测试纸箱',sku:'TEST-CARTON',length:500,width:400,height:300,weight:8,quantity:1,packagingType:'CARTON',handlingMethod:'manual',stackable:true,maxStackLayers:2,canRotate:true}]});
  assert(created.status<300,JSON.stringify(created.body));
  const task=created.body.data;
  const writes=await Promise.all(['A','B'].map(label=>request('/'+task.taskId+'/evidence',{baseRevision:task.revision,scope:'order',objectId:task.orders[0].orderId,
    values:{packingListReference:`TEST-ONLY-CAS-${label}`,shipperDeclaration:'仅本地并发回归测试，非实际出运文件'}})));
  assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
  const saved=(await request('/'+task.taskId)).body.data;
  const historical=(await request('/'+task.taskId+'?revision=1')).body.data;
  assert.equal(saved.revision,2);assert.equal(saved.units.length,1);assert.equal(saved.unassigned.length,1);
  assert(!historical.evidenceByOrder);
  const winner=writes.find(r=>r.status===200).body.data.evidenceByOrder[task.orders[0].orderId];
  assert.deepEqual(saved.evidenceByOrder[task.orders[0].orderId],winner);
  const result={taskId:task.taskId,classification:'DEMO_PRESET_TEST_ONLY',statuses:writes.map(r=>r.status),revision:saved.revision,winnerReference:winner.packingListReference,historicalRevision:historical.revision,pass:true};
  fs.writeFileSync('artifacts/rebuild/task-concurrency-audit.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
