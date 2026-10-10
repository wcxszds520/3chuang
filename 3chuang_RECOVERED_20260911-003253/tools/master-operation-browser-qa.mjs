import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('output/playwright/master-rebuild-20260922');
const evidence=path.resolve('artifacts/master-rebuild-20260922/browser');
const report={startedAt:new Date().toISOString(),channel:'Fresh headed Chromium; real UI solve; reset then continuous 8x playback; no timeline/jump/skip',errors:[],console:[]};
const browser=await chromium.launch({headless:false});
const context=await browser.newContext({viewport:{width:1600,height:900}});const page=await context.newPage();page.setDefaultTimeout(60000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.console.push(m.text());});
const nav=async name=>{await page.getByRole('navigation',{name:'专业工作台导航'}).getByRole('button',{name}).click();};
try{
 await page.goto('http://127.0.0.1:14173/workspace/planning');await page.getByRole('button',{name:'生成推荐方案',exact:true}).click();
 let plan;for(let i=0;i<240;i++){const s=await page.evaluate(async()=> (await import('/src/app/session/sessionStorage.js')).loadSession());if(s.backendPlan){plan=s.backendPlan;break;}await page.waitForTimeout(500);}assert.equal(plan?.loadedCargo?.length,42);
 report.planId=plan.planId;report.placementHash=plan.placementHash;report.cargo=plan.loadedCargo.map(c=>({cargoId:c.cargoId,handlingMethod:c.handlingMethod,weight:c.weight}));
 await nav('孪生 空间与作业');await page.locator('[data-sample-count]').waitFor();await page.waitForTimeout(2500);
 await page.getByRole('button',{name:'重置作业',exact:true}).click();await page.getByRole('button',{name:'8×',exact:true}).click();
 await page.evaluate(()=>{const mount=document.querySelector('[data-phase]');if(!mount)throw new Error('Missing live scene phase telemetry');window.__operationAcceptance=[];let last='';const record=()=>{const d=mount.dataset;const key=[d.phase,d.currentCargo,d.completedCount].join('|');if(key===last)return;last=key;window.__operationAcceptance.push({at:Date.now(),phase:d.phase,cargoId:d.currentCargo,completedCount:Number(d.completedCount),index:Number(d.currentIndex),actorType:d.actorType,actorStage:d.actorStage,forkExtension:d.forkExtension,forkHeight:d.forkHeight,forkliftPosition:d.forkliftPosition,cargoPosition:d.cargoPosition,targetPosition:d.targetPosition,carrying:d.isCarrying,released:d.released});};new MutationObserver(record).observe(mount,{attributes:true});record();});
 await page.getByRole('button',{name:'播放',exact:true}).click();
 const deadline=Date.now()+600000;let lastCount=-1;let machineComplete=false;
 while(Date.now()<deadline){await page.waitForTimeout(1000);const frames=await page.evaluate(()=>window.__operationAcceptance);const current=frames.at(-1);if(current.completedCount!==lastCount){lastCount=current.completedCount;console.log('COMPLETED',lastCount,'CURRENT',current.cargoId,current.phase);}
  if(!machineComplete){const completedTargets=frames.filter((f,i)=>i&&f.completedCount>frames[i-1].completedCount).map((f,i,a)=>frames[frames.indexOf(f)-1]?.cargoId);const first=completedTargets.find(id=>report.cargo.find(c=>c.cargoId===id)?.handlingMethod!=='manual');if(first){machineComplete=true;report.firstEquipmentCompleted={cargo:report.cargo.find(c=>c.cargoId===first),phases:frames.filter(f=>f.cargoId===first),observedCompletedCount:current.completedCount};await page.screenshot({path:path.join(out,'operation-first-equipment-completed-1600.png')});console.log('EQUIPMENT COMPLETE',first);}}
  if(current.phase==='BLOCKED'){report.blockedText=await page.locator('.blocked-overlay').innerText();break;}if(current.phase==='COMPLETED'&&current.completedCount===42)break;
 }
 report.trace=await page.evaluate(()=>window.__operationAcceptance);report.final=report.trace.at(-1);report.state=await page.getByLabel('数字孪生状态来源').innerText();await page.screenshot({path:path.join(out,'operation-continuous-final-1600.png')});await fs.writeFile(path.join(evidence,'operation-final-dom.txt'),await page.locator('body').innerText());
 assert.ok(report.firstEquipmentCompleted,'No equipment-handled item completed in continuous playback');assert.equal(report.final.phase,'COMPLETED',report.blockedText||'Continuous playback did not finish');assert.equal(report.final.completedCount,42);assert.match(report.state,/UNKNOWN/);assert.equal(report.errors.length,0);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.message;report.trace=await page.evaluate(()=>window.__operationAcceptance||[]).catch(()=>[]);report.final=report.trace.at(-1);await page.screenshot({path:path.join(out,'operation-continuous-failure-1600.png')}).catch(()=>{});console.error(e.message);process.exitCode=1;
}finally{report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(evidence,'operation-browser-qa.json'),JSON.stringify(report,null,2));await browser.close();}
