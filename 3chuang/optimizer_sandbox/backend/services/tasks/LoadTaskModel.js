'use strict';

const { randomUUID } = require('crypto');
const { isDeepStrictEqual } = require('util');
const { normalizeCargoList } = require('../packing/PackagingProfile');

const id = prefix => `${prefix}_${randomUUID()}`;
const clone = value => JSON.parse(JSON.stringify(value));
function fail(message, code = 'TASK_VALIDATION', status = 400) {
  throw Object.assign(new Error(message), { code, status });
}
function required(value, field) {
  const result = String(value || '').trim();
  if (!result || result.length > 160) fail(`${field} 必须填写且不超过160字`);
  return result;
}
function serviceProfile(input = {}) {
  const result = {
    serviceId: required(input.serviceId, '运输服务'),
    destination: required(input.destination, '目的地'),
    strippingPoint: required(input.strippingPoint, '拆箱点'),
    windowStart: required(input.windowStart, '时窗开始'),
    windowEnd: required(input.windowEnd, '时窗结束')
  };
  if (!Number.isFinite(Date.parse(result.windowStart)) || !Number.isFinite(Date.parse(result.windowEnd)) || Date.parse(result.windowEnd) < Date.parse(result.windowStart)) fail('运输时窗无效');
  return result;
}

function appendRows(task, input = {}) {
  const next = clone(task);
  const customer = { customerId: input.customerId || id('CUSTOMER'), name: required(input.customerName, '客户名称') };
  const existingCustomer = next.customers.find(item => item.customerId === customer.customerId);
  if (existingCustomer && existingCustomer.name !== customer.name) fail('同一客户 ID 的名称不一致');
  if (!existingCustomer) next.customers.push(customer);
  const order = { orderId: id('ORDER'), customerId: customer.customerId, reference: required(input.orderReference, '订单号'), service: serviceProfile(input.service), source: input.source || 'USER_INPUT' };
  if (!Array.isArray(input.rows) || input.rows.length === 0) fail('至少录入一行货物');
  next.orders.push(order);
  for (const raw of input.rows) {
    for (const key of ['length', 'width', 'height', 'weight']) if (!Number.isFinite(Number(raw[key])) || Number(raw[key]) <= 0) fail(`货物 ${raw.name || ''} 的${({length:'长',width:'宽',height:'高',weight:'单件重量'})[key]}必须为正数，单位${key==='weight'?' kg':' mm'}，请修正该货物行`);
    if (!Number.isSafeInteger(Number(raw.quantity)) || Number(raw.quantity) <= 0) fail('数量必须是正整数');
    if (next.units.length + Number(raw.quantity) > 5000) fail('当前单任务上限为5000件，请拆分任务；未保存超限输入', 'TASK_SIZE_LIMIT', 413);
    const rowId = id('ROW');
    const row = { ...raw, rowId, customerId: customer.customerId, orderId: order.orderId, sourceCargoId: raw.cargoId || null, quantity: Number(raw.quantity) };
    next.rows.push(row);
    const mixPolicy = String(raw.mixPolicy || input.mixPolicy || 'ALLOW').toUpperCase();
    if (!['ALLOW', 'SAME_CUSTOMER', 'SEPARATE'].includes(mixPolicy)) fail('混装政策无效');
    for (let index = 1; index <= row.quantity; index++) {
      const unitId = `${rowId}:U${index}`;
      const base = normalizeCargoList([{ ...raw, cargoPhysicalProfile: undefined, packagingProfile: raw.packagingProfile, quantity: 1, cargoId: unitId,
        portSequence: next.transportModel === 'OCEAN_LCL' ? 1 : Number(raw.portSequence || 1),
        // ETA does not turn an ocean LCL task into a sequence of port openings.
        eta: next.transportModel === 'OCEAN_LCL' ? null : raw.eta
      }], { source: order.source })[0];
      const unit = { ...base, unitId, cargoId: unitId, sourceCargoId: unitId, rowId, unitIndex: index, quantity: 1,
        customerId: customer.customerId, customerName: customer.name, orderId: order.orderId, orderReference: order.reference,
        service: clone(order.service), mixPolicy, compatibilityGroup: raw.compatibilityGroup || 'GENERAL',
        incompatibleGroups: Array.isArray(raw.incompatibleGroups) ? raw.incompatibleGroups.map(String) : [], source: order.source };
      next.units.push(unit);
      next.unassigned.push({ unitId, reason: '尚未规划' });
    }
  }
  assertConservation(next);
  return next;
}

function createTask(input = {}) {
  const transportModel = input.transportModel || 'OCEAN_LCL';
  if (!['OCEAN_LCL', 'MULTI_STOP_DEMO'].includes(transportModel)) fail('运输模式无效');
  const task = { schemaVersion: 1, taskId: id('TASK'), name: required(input.name, '任务名称'), revision: 1, transportModel,
    customers: [], orders: [], rows: [], units: [], containers: [], unassigned: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  return appendRows(task, input);
}

function reviseRows(task, changes) {
  if(!Array.isArray(changes)||!changes.length) fail('请选择要修改的货物行');
  const next=clone(task),affected=new Set(),seen=new Set();
  const fields=['name','sku','length','width','height','weight','quantity','packagingType','stackable','maxStackLayers','canRotate','canLayFlat','canInvert','fragile','maximumSupportedWeightKg','handlingMethod','compatibilityGroup','incompatibleGroups','mixPolicy','forkEntry','forkEntryAxis','palletJackCompatible','packagingConfirmed'];
  for(const change of changes){
    const row=next.rows.find(r=>r.rowId===change.rowId);
    if(!row||seen.has(row.rowId))fail('货物行不存在或重复');seen.add(row.rowId);
    const rowUnits=next.units.filter(u=>u.rowId===row.rowId),ids=new Set(rowUnits.map(u=>u.unitId));
    for(const cab of next.containers)if(cab.plan.loadedCargo.some(p=>ids.has(p.cargoId))){
      if(cab.status==='SEALED'||cab.lockedUnitIds.length)fail(`${cab.label} 含已记录装入货物，此柜货物行不能修改；可追加独立货物行`, 'TASK_LOCKED',409);
      affected.add(cab.containerId);
    }
    const patch=Object.fromEntries(fields.filter(key=>Object.hasOwn(change.patch||{},key)).map(key=>[key,change.patch[key]]));
    const order=next.orders.find(o=>o.orderId===row.orderId),customer=next.customers.find(c=>c.customerId===row.customerId);
    const raw={...row,...patch,packagingProfile:undefined,cargoPhysicalProfile:undefined};
    const temporary=appendRows({...clone(next),rows:[],units:[],containers:[],unassigned:[],orders:[]},{customerId:customer.customerId,customerName:customer.name,orderReference:order.reference,service:order.service,source:order.source,rows:[raw]});
    let nextUnitIndex=Number(row.nextUnitIndex)||Math.max(...rowUnits.map(unit=>unit.unitIndex),0)+1;
    const units=temporary.units.map((unit,index)=>{const unitIndex=rowUnits[index]?.unitIndex||nextUnitIndex++;const unitId=`${row.rowId}:U${unitIndex}`;return {...unit,unitId,cargoId:unitId,sourceCargoId:unitId,unitIndex,rowId:row.rowId,orderId:row.orderId};});
    next.rows[next.rows.indexOf(row)]={...raw,quantity:units.length,nextUnitIndex};
    next.units=next.units.filter(u=>u.rowId!==row.rowId).concat(units);
    next.unassigned=next.unassigned.filter(item=>!ids.has(item.unitId));
  }
  if(next.units.length>5000)fail('当前单任务上限为5000件，请拆分任务','TASK_SIZE_LIMIT',413);
  // Every affected draft cabinet is solved afresh. Unaffected cabinets and
  // locked physical placements retain their complete original objects.
  for(const cab of next.containers)if(affected.has(cab.containerId)){cab.plan.loadedCargo=[];cab.status='DRAFT';if(next.evidenceByContainer)delete next.evidenceByContainer[cab.containerId];}
  const assigned=new Set(next.containers.flatMap(c=>c.plan.loadedCargo.map(p=>p.cargoId)));
  next.unassigned=next.units.filter(u=>!assigned.has(u.unitId)).map(u=>({unitId:u.unitId,reason:'货物修改后待重新分配'}));
  assertConservation(next);
  return {task:next,affected:[...affected]};
}

function compatibility(units, candidate, transportModel) {
  if (!units.length) return [];
  const reasons = new Set();
  for (const unit of units) {
    if (unit.service.serviceId !== candidate.service.serviceId) reasons.add('运输服务不同');
    if (transportModel === 'OCEAN_LCL') {
      if (unit.service.destination !== candidate.service.destination) reasons.add('海运拼箱目的地不同');
      if (unit.service.strippingPoint !== candidate.service.strippingPoint) reasons.add('目的地拆箱点不同');
    }
    if ((unit.mixPolicy === 'SEPARATE' || candidate.mixPolicy === 'SEPARATE') && unit.orderId !== candidate.orderId) reasons.add('订单要求独立装柜');
    if ((unit.mixPolicy === 'SAME_CUSTOMER' || candidate.mixPolicy === 'SAME_CUSTOMER') && unit.customerId !== candidate.customerId) reasons.add('客户要求禁止跨客户混装');
    if (unit.incompatibleGroups.includes(candidate.compatibilityGroup) || candidate.incompatibleGroups.includes(unit.compatibilityGroup)) reasons.add('包装或货类混装相容条件不满足');
    if (unit.dangerous === true || candidate.dangerous === true || unit.packagingProfile?.dangerousGoodsContext?.isDangerousGoods || candidate.packagingProfile?.dangerousGoodsContext?.isDangerousGoods) reasons.add('危险品混装须提供专门相容性方案');
  }
  const all = [...units, candidate];
  if (Math.max(...all.map(u => Date.parse(u.service.windowStart))) > Math.min(...all.map(u => Date.parse(u.service.windowEnd)))) reasons.add('共同运输时窗无交集');
  return [...reasons];
}

function assertConservation(task) {
  const units = new Map(task.units.map(unit => [unit.unitId, unit]));
  if (units.size !== task.units.length) fail('实物件 ID 重复', 'TASK_INVARIANT', 500);
  const seen = new Set();
  for (const container of task.containers) {
    for (const placement of container.plan.loadedCargo) {
      const unit = units.get(placement.cargoId);
      if (!unit || seen.has(unit.unitId)) fail('柜内分配包含未知件或重复件', 'TASK_INVARIANT', 500);
      if (placement.customerId !== unit.customerId || placement.orderId !== unit.orderId) fail('实物件归属丢失', 'TASK_INVARIANT', 500);
      seen.add(unit.unitId);
    }
    for (const locked of container.lockedUnitIds || []) if (!container.plan.loadedCargo.some(p => p.cargoId === locked)) fail('锁定件不在当前柜中', 'TASK_INVARIANT', 500);
  }
  for (const item of task.unassigned) {
    if (!units.has(item.unitId) || seen.has(item.unitId)) fail('未分配清单不守恒', 'TASK_INVARIANT', 500);
    seen.add(item.unitId);
  }
  if (seen.size !== units.size) fail('分配结果丢件', 'TASK_INVARIANT', 500);
  for (const row of task.rows) if (task.units.filter(unit => unit.rowId === row.rowId).length !== row.quantity) fail('行数量与实物件展开不一致', 'TASK_INVARIANT', 500);
  return { total: units.size, assigned: units.size - task.unassigned.length, unassigned: task.unassigned.length, containers: task.containers.length };
}

function assertLocks(before, after) {
  for (const previous of before.containers) {
    const current = after.containers.find(c => c.containerId === previous.containerId);
    if (!current) fail('不能删除已有柜', 'TASK_LOCKED', 409);
    if (previous.status === 'SEALED' && !isDeepStrictEqual(previous, current)) fail('已封柜不能重新打开或修改', 'TASK_LOCKED', 409);
    for (const unitId of previous.lockedUnitIds || []) {
      const a = previous.plan.loadedCargo.find(p => p.cargoId === unitId);
      const b = current.plan.loadedCargo.find(p => p.cargoId === unitId);
      if (!b || ['x', 'y', 'z', 'l', 'w', 'h'].some(key => a[key] !== b[key]) || !current.lockedUnitIds.includes(unitId)) fail('已实际装入的货物位置不可变', 'TASK_LOCKED', 409);
    }
  }
}

module.exports = { id, clone, fail, createTask, appendRows, reviseRows, compatibility, assertConservation, assertLocks };
