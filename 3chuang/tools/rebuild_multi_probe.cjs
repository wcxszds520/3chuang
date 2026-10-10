const fs = require('fs');
const { createTask, appendRows } = require('../backend/services/tasks/LoadTaskModel');
const { MultiContainerPlanner } = require('../backend/services/tasks/MultiContainerPlanner');
const service = { serviceId:'DEMO-NB-HAM', destination:'HAM', strippingPoint:'HAM-CFS', windowStart:'2026-09-15', windowEnd:'2026-09-22' };
const row = { name:'标准设备托盘', sku:'SAME-SKU', length:1200, width:1000, height:1300, weight:260, quantity:14, packagingType:'PALLETIZED_CARTONS', stackable:false, maxStackLayers:1, handlingMethod:'forklift', canRotate:true, forkEntry:{enabled:true} };
(async () => {
  const task = createTask({ name:'多柜回归', customerName:'客户甲', orderReference:'QA-A', service, rows:[row] });
  const planner = new MultiContainerPlanner();
  const a = await planner.preview(task, {containerTypes:['20GP']});
  console.log('BASE', JSON.stringify(a.map(c => ({summary:c.summary,rejections:c.rejected.map(r=>r.reason)}))));
  if (a[0].summary.unassigned || a[0].summary.containers < 2) throw new Error('Expected complete multi-container assignment');
  const appended = appendRows(a[0].task, { customerName:'客户乙', orderReference:'QA-B', service, rows:[{...row,length:1000,width:900,height:1100,weight:180,quantity:2}] });
  const b = await planner.preview(appended, {containerTypes:['20GP']});
  console.log('APPEND', JSON.stringify(b.map(c => ({summary:c.summary,impacts:c.impacts}))));
  fs.writeFileSync('artifacts/rebuild/multi-container-probe.json', JSON.stringify({base:a,append:b},null,2));
})().catch(error => {console.error(error);process.exitCode=1;});
