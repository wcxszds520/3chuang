import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='artifacts/master-rebuild-20260922/browser';
const report=JSON.parse(await fs.readFile(`${dir}/operation-browser-qa.json`,'utf8'));
const required=['HANDOFF_LOWER','FORK_WITHDRAW','JACK_APPROACH','JACK_INSERT','JACK_LIFT','ENTER_CONTAINER','MOVE_INSIDE','ALIGN_WITH_TARGET','LOWER_CARGO','RELEASE_CARGO','REVERSE_OUT','RETURN_FOR_NEXT'];
const cycles=report.cargo.filter(c=>c.handlingMethod!=='manual').map(cargo=>{
 const frames=report.trace.filter(f=>f.cargoId===cargo.cargoId);
 const phases=frames.map(f=>f.phase).filter((p,i,a)=>i===0||p!==a[i-1]);
 let cursor=-1;for(const phase of required){cursor=phases.indexOf(phase,cursor+1);assert.ok(cursor>=0,`${cargo.cargoId}: missing ordered phase ${phase}`);}
 const end=report.trace.indexOf(frames.at(-1));const next=report.trace[end+1];
 assert.ok(next&&(next.index>frames.at(-1).index||next.phase==='COMPLETED'),`${cargo.cargoId}: no subsequent item or complete state after return`);
 const withdraw=frames.find(f=>f.phase==='FORK_WITHDRAW');const jack=frames.find(f=>f.phase==='JACK_APPROACH');
 assert.notEqual(withdraw.forkliftPosition,jack.forkliftPosition,`${cargo.cargoId}: forklift did not move away from handoff`);
 assert.equal(withdraw.cargoPosition,jack.cargoPosition,`${cargo.cargoId}: cargo moved with withdrawing forklift`);
 return {cargo,phases,startedAt:frames[0].at,returnedBefore:next.at,elapsedMs:next.at-frames[0].at,withdraw:{cargoFixedAt:withdraw.cargoPosition,forkliftStart:withdraw.forkliftPosition,forkliftEnd:jack.forkliftPosition},nextCargoId:next.cargoId,completedCountAfterReturn:next.completedCount};
});
assert.equal(report.status,'PASS');assert.equal(report.final.phase,'COMPLETED');assert.equal(report.final.completedCount,42);assert.ok(cycles.length>0);
const proof={status:'PASS',derivedFrom:'operation-browser-qa.json',rule:'Every equipment item must show all ordered phases, cargo fixed while forklift withdraws, and advancement only after RETURN_FOR_NEXT',cycles,completed:42,traceCount:report.trace.length,planId:report.planId,placementHash:report.placementHash};
await fs.writeFile(`${dir}/operation-cycle-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
