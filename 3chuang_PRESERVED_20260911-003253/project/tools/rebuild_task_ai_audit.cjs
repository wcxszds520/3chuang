const fs=require('node:fs');const assert=require('node:assert/strict');
const root='http://127.0.0.1:3000/api/load-tasks';
async function request(url,body){const response=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const json=await response.json();if(!response.ok)throw Error(json.message);return json.data;}
(async()=>{
  const tasks=await request(root);const item=tasks.find(t=>t.name==='多柜与追加客户 · 实测');assert(item);
  const task=await request(root+'/'+item.taskId);const container=task.containers[1];
  const questions=['为什么选择当前柜型？','能否拼入另一个客户？','当前柜的空位还能补货吗？','还有哪些资料和法规需要核对？','当前选中货物应怎样搬运？','请实际重新比较20GP、40GP和40HQ候选，保留当前两个柜，生成预览但不要应用。'];
  const results=[];
  for(const question of questions){
    const started=Date.now();
    try{
      const answer=await request(root+'/'+item.taskId+'/assistant',{baseRevision:task.revision,containerId:container.containerId,
        ...(question.includes('选中货物')?{unitId:container.plan.loadedCargo[0].cargoId}:{}),question});
      assert.equal(answer.source,'live-model');assert.equal(answer.context.taskId,task.taskId);assert.equal(answer.context.revision,task.revision);
      if(question.includes('实际重新比较'))assert(answer.trace.some(t=>t.tool==='compare_container_options'));
      results.push({question,elapsedMs:Date.now()-started,pass:true,answer});
      console.log(JSON.stringify({question,elapsedMs:Date.now()-started,source:answer.source,tools:answer.trace.map(t=>t.tool),conclusion:answer.conclusion}));
    }catch(error){results.push({question,pass:false,error:error.message});console.log(JSON.stringify({question,error:error.message}));}
    fs.writeFileSync('artifacts/rebuild/task-ai-audit.json',JSON.stringify({taskId:task.taskId,baseRevision:task.revision,results},null,2));
  }
  const fresh=await request(root+'/'+item.taskId);assert.equal(fresh.revision,task.revision);
  assert(results.every(r=>r.pass),'Some model cases failed; inspect the saved results');
})().catch(e=>{console.error(e);process.exitCode=1;});
