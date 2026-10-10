const { createTask, appendRows, reviseRows, compatibility, assertConservation, assertLocks, clone } = require('../../services/tasks/LoadTaskModel');
const PlanValidator = require('../../services/packing/PlanValidator');
const { normalizeCargoList } = require('../../services/packing/PackagingProfile');
const service = { serviceId:'S1', destination:'HAM', strippingPoint:'CFS-A', windowStart:'2026-09-10', windowEnd:'2026-09-15' };
const row = { name:'部件', sku:'SAME', length:400, width:300, height:200, weight:10, quantity:2, packagingType:'CARTON', stackable:false };
const create = () => createTask({name:'测试任务',customerName:'甲',orderReference:'A',service,rows:[row]});

test('row edits preserve surviving physical IDs, never reuse removed IDs, and validate quantities',()=>{
  const original=create(),rowId=original.rows[0].rowId;
  const shrunk=reviseRows(original,[{rowId,patch:{quantity:1,length:500}}]).task;
  expect(shrunk.units[0].unitId).toBe(original.units[0].unitId);expect(shrunk.units[0].length).toBe(500);
  const grown=reviseRows(shrunk,[{rowId,patch:{quantity:2}}]).task;
  expect(grown.units[1].unitId).not.toBe(original.units[1].unitId);expect(grown.units[1].unitIndex).toBe(3);
  expect(grown.units.every(unit=>unit.orderId===original.orders[0].orderId)).toBe(true);
  expect(assertConservation(grown).total).toBe(2);expect(original.rows[0].length).toBe(400);
  expect(()=>reviseRows(original,[{rowId,patch:{quantity:1.2}}])).toThrow('数量');
});
test('row edits cannot alter cargo in a cabinet with locked physical units',()=>{
  const task=create(),unit=task.units[0];task.containers=[{containerId:'C1',label:'柜1',status:'LOADED_LOCKED',lockedUnitIds:[unit.unitId],plan:{loadedCargo:[unit]}}];task.unassigned=task.unassigned.slice(1);
  expect(()=>reviseRows(task,[{rowId:unit.rowId,patch:{weight:25}}])).toThrow('已记录装入');
});
test('same SKU in different orders preserves independent dimensions, owner and stable quantity expansion', () => {
  const a = create();
  const b = appendRows(a,{customerName:'乙',orderReference:'B',service,rows:[{...row,length:800,quantity:1}]});
  expect(b.units.slice(0,2).map(u=>u.unitId)).toEqual(a.units.map(u=>u.unitId));
  expect(new Set(b.units.map(u=>u.unitId)).size).toBe(3);
  expect(b.units[2].length).toBe(800);expect(b.units[2].customerId).not.toBe(b.units[0].customerId);
  expect(assertConservation(b)).toEqual({total:3,assigned:0,unassigned:3,containers:0});
});
test('quantity validation rejects fractions, zero and dropped or duplicated units', () => {
  expect(()=>createTask({name:'x',customerName:'a',orderReference:'b',service,rows:[{...row,quantity:1.5}]})).toThrow('数量');
  const a = create();a.unassigned.pop();expect(()=>assertConservation(a)).toThrow('丢件');
  const b = create();b.unassigned.push(b.unassigned[0]);expect(()=>assertConservation(b)).toThrow('守恒');
});
test('ocean grouping checks destination, stripping point, common time window and customer policies', () => {
  const a=create().units[0];
  const b={...clone(a),customerId:'OTHER',service:{...service,windowStart:'2026-09-16',windowEnd:'2026-09-20',destination:'RTM'}};
  expect(compatibility([a],b,'OCEAN_LCL')).toEqual(expect.arrayContaining(['海运拼箱目的地不同','共同运输时窗无交集']));
  expect(compatibility([a],{...a,customerId:'OTHER',mixPolicy:'SAME_CUSTOMER'},'OCEAN_LCL')).toContain('客户要求禁止跨客户混装');
  expect(compatibility([a],{...a,service:{...service,strippingPoint:'CFS-B'}},'OCEAN_LCL')).toContain('目的地拆箱点不同');
});
test('locked placements cannot move and sealed cabinet cannot acquire extra data or placements', () => {
  const a=create();const u=a.units[0];
  a.containers=[{containerId:'C1',status:'LOADED_LOCKED',lockedUnitIds:[u.unitId],plan:{loadedCargo:[{...u,cargoId:u.unitId,x:0,y:0,z:0,l:400,w:300,h:200}]}}];
  a.unassigned=a.unassigned.filter(v=>v.unitId!==u.unitId);
  const b=clone(a);b.containers[0].plan.loadedCargo[0].x=1;expect(()=>assertLocks(a,b)).toThrow('不可变');
  a.containers[0].status='SEALED';const c=clone(a);c.containers[0].status='DRAFT';expect(()=>assertLocks(a,c)).toThrow('已封柜');
});
test('source matching prioritizes exact unit identity over repeated SKU', () => {
  const cargo=[{...row,cargoId:'UNIT-A',quantity:1},{...row,cargoId:'UNIT-B',length:800,quantity:1}];
  const result=new PlanValidator().validate({cargoList:cargo,container:{innerLength:5898,innerWidth:2352,innerHeight:2393,maxWeight:28000},placements:[{...cargo[0],sourceCargoId:'UNIT-A',x:2700,y:0,z:1000,l:400,w:300,h:200}]});
  expect(result.violations.some(v=>v.code==='ORIENTATION')).toBe(false);
});
test('FIBC model availability never grants stackability without an input instruction', () => {
  const [bag]=normalizeCargoList([{...row,stackable:undefined,packagingType:'FIBC_BAG'}]);
  expect(bag.stackable).toBe(false);expect(bag.maxStackLayers).toBe(1);
});
