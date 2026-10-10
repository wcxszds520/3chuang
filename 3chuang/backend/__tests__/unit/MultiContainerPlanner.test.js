const { createTask, assertConservation } = require('../../services/tasks/LoadTaskModel');
const { MultiContainerPlanner } = require('../../services/tasks/MultiContainerPlanner');
const FastBlockPackingEngine = require('../../services/FastBlockPackingEngine');

test('changing an existing row produces actual revalidated placements, original impacts and immutable input',async()=>{
  const input=createTask({name:'行编辑回归',customerName:'甲',orderReference:'TEST-EDIT',service:{serviceId:'S',destination:'HAM',strippingPoint:'CFS',windowStart:'2026-09-15',windowEnd:'2026-09-22'},rows:[{name:'托盘',length:1000,width:900,height:1100,weight:180,quantity:2,packagingType:'PALLETIZED_CARTONS',stackable:false,maxStackLayers:1,canRotate:true,handlingMethod:'forklift'}]});
  const planner=new MultiContainerPlanner(),options={containerTypes:['20GP'],maximumContainers:1};
  const [first]=await planner.preview(input,options),before=JSON.stringify(first.task);
  first.task.evidenceByContainer={[first.task.containers[0].containerId]:{planHash:first.task.containers[0].plan.placementHash,handlingEvidence:{profile:'SHORT_JACK'}}};
  const [edited]=await planner.preview(first.task,{...options,rowChanges:[{rowId:input.rows[0].rowId,patch:{quantity:3,weight:200}}]});
  expect(edited.summary.assigned).toBe(3);expect(edited.task.containers).toHaveLength(1);
  expect(edited.task.containers[0].plan.taskGate.eligible).toBe(true);expect(edited.task.containers[0].planVersion).toBe(2);
  expect(edited.task.units.slice(0,2).map(u=>u.unitId)).toEqual(input.units.map(u=>u.unitId));
  expect(edited.impacts[0].addedUnitIds).toHaveLength(1);expect(edited.impacts[0].movedUnitIds).toHaveLength(2);
  expect(edited.task.evidenceByContainer[first.task.containers[0].containerId]).toBeUndefined();
  expect(first.task.rows[0].weight).toBe(180);expect(JSON.parse(before).containers).toEqual(first.task.containers);
},30000);

test('keeps an oversized unit unassigned with physical dimensions while actually solving the eligible subset', async()=>{
  const common={name:'托盘',length:1000,width:900,height:1100,weight:180,quantity:1,packagingType:'PALLETIZED_CARTONS',stackable:false,maxStackLayers:1,canRotate:true,handlingMethod:'forklift'};
  const task=createTask({name:'部分可装回归',customerName:'甲',orderReference:'TEST-PARTIAL',service:{serviceId:'S',destination:'HAM',strippingPoint:'CFS',windowStart:'2026-09-15',windowEnd:'2026-09-22'},rows:[common,{...common,name:'超尺寸',length:40000}]});
  const [candidate]=await new MultiContainerPlanner().preview(task,{containerTypes:['20GP'],maximumContainers:1});
  expect(candidate.summary.assigned).toBe(1);expect(candidate.summary.unassigned).toBe(1);
  expect(candidate.task.unassigned[0]).toMatchObject({unitId:task.units[1].unitId,code:'UNIT_EQUIPMENT_ENVELOPE',reason:expect.stringContaining('40000 × 900 × 1100 mm')});
  expect(candidate.task.unassigned[0].reason).toContain('5898 × 2352 × 2393 mm');
  expect(candidate.task.containers[0].plan.taskGate.eligible).toBe(true);
  expect(assertConservation(candidate.task).total).toBe(2);
},30000);

test('completes a mixed seven-unit tail cabinet with actual 3D and operation validation', async () => {
  const common={name:'托盘',sku:'SAME',length:1200,width:1000,height:1300,weight:260,quantity:5,packagingType:'PALLETIZED_CARTONS',stackable:false,maxStackLayers:1,canRotate:true,handlingMethod:'forklift'};
  const task=createTask({name:'尾柜求解回归',customerName:'甲',orderReference:'A',service:{serviceId:'S',destination:'HAM',strippingPoint:'CFS',windowStart:'2026-09-15',windowEnd:'2026-09-22'},
    rows:[common,{...common,name:'小托盘',length:1000,width:900,height:1100,weight:180,quantity:2}]});
  const [candidate]=await new MultiContainerPlanner().preview(task,{containerTypes:['20GP'],maximumContainers:1});
  expect(candidate.summary.assigned).toBe(7);expect(candidate.summary.unassigned).toBe(0);
  expect(candidate.task.containers[0].plan.taskGate.eligible).toBe(true);
  expect(candidate.task.containers[0].plan.portAccessibility.status).toBe('FULL_UNLOAD_PASS');
  expect(assertConservation(candidate.task).total).toBe(7);
},30000);

test('block fallback preserves explicit instance identity across rows and unloaded units', async () => {
  const common={sku:'SAME',length:1000,width:1000,height:1000,weight:100,quantity:3,stackable:false,canRotate:false,handlingMethod:'forklift'};
  const rows=[{...common,cargoId:'ROW_A',unitIds:['A:U2','A:U4','A:U7']},
    {...common,cargoId:'ROW_B',quantity:2,unitIds:['B:U1','B:U3']}];
  const result=await new FastBlockPackingEngine().generatePackingPlan(rows,{innerLength:3000,innerWidth:2100,innerHeight:2300,maxWeight:300});
  expect(result.loadedCargo.length).toBeGreaterThan(0);
  expect(result.unloadedCargo.length).toBeGreaterThan(0);
  const all=[...result.loadedCargo,...result.unloadedCargo];
  expect(all.map(p=>p.cargoId).sort()).toEqual(rows.flatMap(r=>r.unitIds).sort());
  for(const p of all) expect(p.sourceCargoId).toBe(p.cargoId.startsWith('A:')?'ROW_A':'ROW_B');
});
