'use strict';

const Solver = require('../HybridConstraintPackingSolverV25');
const PlanValidator = require('../packing/PlanValidator');
const { legalOrientations } = PlanValidator;
const { validateCargoOperation } = require('../packing/CanonicalOperationFeasibility');
const { REFERENCE_EQUIPMENT } = require('../realworld/EquipmentPlanningService');
const { id, clone, fail, reviseRows, compatibility, assertConservation, assertLocks } = require('./LoadTaskModel');

class MultiContainerPlanner {
  constructor({ solve, maximumContainers = 12 } = {}) {
    this.solve = solve || ((units, equipment, options) => new Solver().generatePackingPlan(units, equipment, options));
    this.maximumContainers = maximumContainers;
    this.validator = new PlanValidator();
  }

  async preview(task, options = {}) {
    if(options.rowChanges){
      const revised=reviseRows(task,options.rowChanges);
      for(const cab of revised.task.containers)if(revised.affected.includes(cab.containerId))cab.plan=await this.evaluate([],[],cab.equipment,revised.task);
      const candidates=await this.preview(revised.task,{...options,rowChanges:undefined});
      for(const candidate of candidates){
        candidate.impacts=[];
        for(const previous of task.containers){
          const current=candidate.task.containers.find(c=>c.containerId===previous.containerId),old=new Map(previous.plan.loadedCargo.map(p=>[p.cargoId,p]));
          const movedUnitIds=current.plan.loadedCargo.filter(p=>old.has(p.cargoId)&&['x','y','z','l','w','h','weight'].some(key=>old.get(p.cargoId)[key]!==p[key])).map(p=>p.cargoId);
          const addedUnitIds=current.plan.loadedCargo.filter(p=>!old.has(p.cargoId)).map(p=>p.cargoId),remaining=new Set(current.plan.loadedCargo.map(p=>p.cargoId));
          const removedUnitIds=previous.plan.loadedCargo.filter(p=>!remaining.has(p.cargoId)).map(p=>p.cargoId);
          if(revised.affected.includes(current.containerId)||movedUnitIds.length||addedUnitIds.length||removedUnitIds.length){current.planVersion=previous.planVersion+1;candidate.impacts.push({containerId:current.containerId,previousStatus:previous.status,previousPlanVersion:previous.planVersion,planVersion:current.planVersion,movedUnitIds,addedUnitIds,removedUnitIds});}
        }
        candidate.summary.movedUnits=candidate.impacts.reduce((sum,item)=>sum+item.movedUnitIds.length,0);
        assertLocks(task,candidate.task);assertConservation(candidate.task);
      }
      return candidates;
    }
    if (options.maximumContainers != null && (!Number.isInteger(Number(options.maximumContainers)) || Number(options.maximumContainers) < 1 || Number(options.maximumContainers) > 30)) fail('柜数上限必须是1到30的整数');
    const types = options.containerTypes || ['20GP', '40GP', '40HQ'];
    if (!Array.isArray(types) || !types.length || types.some(type => !REFERENCE_EQUIPMENT[type])) fail('只接受已登记的20GP、40GP和40HQ柜型');
    const combinations = [...new Set(types)].map(type => ({ key: type, label: `${type} 后续柜`, types: [type] }));
    if (types.includes('20GP') && types.includes('40HQ')) combinations.push({ key: '40HQ_20GP', label: '40HQ 主柜 + 20GP 尾柜', types: ['40HQ', '20GP'] });
    const candidates = [];
    // Each alternative keeps the existing fleet. Reuse an identical cabinet
    // calculation within this preview, without sharing results across versions.
    const solveCache = new Map();
    for (const combination of combinations) candidates.push(await this.allocate(task, combination, { ...options, solveCache }));
    candidates.sort((a, b) => a.summary.unassigned - b.summary.unassigned || a.summary.containers - b.summary.containers || a.summary.totalCapacityM3 - b.summary.totalCapacityM3);
    return candidates;
  }

  async evaluate(placements, units, equipment, task) {
    const byId = new Map(units.map(u => [u.unitId, u]));
    const loadedCargo = placements.map(p => {
      const source = byId.get(p.unitId) || byId.get(p.sourceCargoId) || byId.get(p.cargoId) || byId.get(String(p.cargoId).replace(/_1$/, ''));
      if (!source) fail('求解器返回无法对应实物件的结果', 'TASK_IDENTITY', 500);
      return { ...p, ...clone(source), x: p.x, y: p.y, z: p.z, l: p.l, w: p.w, h: p.h,
        cargoId: source.unitId, sourceCargoId: source.unitId, quantity: 1, handlingMethod: p.handlingMethod || source.handlingMethod,
        loadingIndex: p.loadingIndex, stackLevel: p.stackLevel, orientation: p.orientation };
    });
    const plan = Solver.evaluateCandidate({ candidateId: id('PLAN'), sourceAlgorithm: 'hybrid-v2.6-multi-container', placements: loadedCargo,
      unloadedCargo: [], inheritedWarnings: [], inheritedConstraintMeta: {}, handlingAssumptions: [], translationRequested: false,
      sourceRuntimeMs: 0, generationPhase: 'TASK_CONTAINER_VALIDATION', runtimeTieBreakClass: 0, cargoList: units, container: equipment,
      strategy: 'SPACE', route: [], caseContext: { transportModel: task.transportModel }, validator: this.validator });
    const doorFailures = loadedCargo.filter(p => p.w > equipment.doorWidth - 60 || p.h > equipment.doorHeight - 40 || p.y + p.h > equipment.doorHeight - 35)
      .map(p => ({ cargoId: p.cargoId, code: 'ACTUAL_REFERENCE_DOOR_CLEARANCE', message: '规范水平插入路径超过当前参考门洞净空', doorWidth: equipment.doorWidth, doorHeight: equipment.doorHeight }));
    const geometryPass = plan.validator.valid && plan.operationFeasibility.operationPathPass && plan.portAccessibility.accessPass && plan.portAccessibility.postUnloadStabilityPass && !doorFailures.length;
    const balanced = !loadedCargo.length || (plan.metrics.cog.longitudinal <= 5.001 && plan.metrics.cog.lateral <= 5.001);
    return { ...plan, containerInfo: clone(equipment), totalCargoCount: loadedCargo.length, totalCargoInput: loadedCargo.length,
      sourceCode: 'BACKEND_SOLVED', source: 'BACKEND_SOLVED', solverVersion: '2.6.0-rebuild', planId: plan.candidateId,
      taskGate: { geometryPass, balanced, eligible: geometryPass && balanced, doorFailures, centreOfGravityPolicy: '全内长/宽5%项目选择门槛' },
      evidenceScope: '三维规划、支撑、门洞、质量矩及取放路径计算；现场设备和出运放行仍使用准备度证据流程' };
  }

  async solveGroup(units, equipment, task, cache) {
    if (!units.length) return null;
    const cacheKey = `${equipment.typeId}:${units.map(u => u.unitId).join('|')}`;
    if (cache?.has(cacheKey)) return clone(cache.get(cacheKey));
    // Keep the original row as the physical-profile source while passing every
    // stable instance ID explicitly. Expanding each unit as a new source row
    // creates artificial source partitions inside the legacy layer search.
    const rows = new Map();
    for (const unit of units) {
      if (!rows.has(unit.rowId)) rows.set(unit.rowId, { ...clone(unit), cargoId:unit.rowId, sourceCargoId:unit.rowId, unitId:undefined, unitIds:[], quantity:0 });
      const row = rows.get(unit.rowId); row.unitIds.push(unit.unitId); row.quantity += 1;
      if (row.cargoPhysicalProfile) row.cargoPhysicalProfile.quantity = row.quantity;
    }
    const result = await this.solve([...rows.values()], equipment, { strategy: 'SPACE', inputSource: 'TASK_UNIT_INPUT', caseContext: { transportModel: task.transportModel } });
    const plan = await this.evaluate(result.loadedCargo || [], units, equipment, task);
    cache?.set(cacheKey, clone(plan));
    return plan;
  }

  async insertFixed(container, units, task) {
    const equipment = container.equipment;
    const original = clone(container.plan.loadedCargo);
    const placed = [...original];
    const byId = new Map(task.units.map(u => [u.unitId, u]));
    for (const unit of units) {
      const currentUnits = placed.map(p => byId.get(p.cargoId));
      if (compatibility(currentUnits, unit, task.transportModel).length) continue;
      let accepted = null;
      for (const dims of legalOrientations(unit)) {
        const xs = new Set([0, equipment.innerLength - dims.l]);
        const ys = new Set([0]);
        const zs = new Set([0, equipment.innerWidth - dims.w, (equipment.innerWidth - dims.w) / 2]);
        for (const p of placed) { xs.add(p.x + p.l); xs.add(p.x - dims.l); ys.add(p.y + p.h); zs.add(p.z + p.w); zs.add(p.z - dims.w); }
        const points = [];
        for (const x of xs) for (const y of ys) for (const z of zs) {
          if (x >= 0 && y >= 0 && z >= 0 && x + dims.l <= equipment.innerLength && y + dims.h <= equipment.innerHeight && z + dims.w <= equipment.innerWidth) points.push({ x, y, z });
        }
        points.sort((a, b) => a.y - b.y || a.x - b.x || Math.abs(a.z + dims.w / 2 - equipment.innerWidth / 2) - Math.abs(b.z + dims.w / 2 - equipment.innerWidth / 2));
        for (const point of points) {
          const p = { ...clone(unit), ...point, ...dims, cargoId: unit.unitId };
          if (!validateCargoOperation(p, equipment, placed).feasible) continue;
          if (!this.validator.validate({ placements: [...placed, p], cargoList: [...currentUnits, unit], container: equipment }).valid) continue;
          if (p.w > equipment.doorWidth - 60 || p.y + p.h > equipment.doorHeight - 35) continue;
          accepted = p; break;
        }
        if (accepted) break;
      }
      if (accepted) placed.push(accepted);
    }
    // Adding a subset may upset mass balance. Back off additions, never move a
    // locked item or accept an invalid combined cabinet to inflate the count.
    while (placed.length > original.length) {
      const plan = await this.evaluate(placed, placed.map(p => byId.get(p.cargoId)), equipment, task);
      if (plan.taskGate.eligible) return plan;
      placed.pop();
    }
    return clone(container.plan);
  }

  async allocate(task, combination, options) {
    const next = clone(task);
    const rejected = [];
    const byId = new Map(task.units.map(u => [u.unitId, u]));
    let pool = task.unassigned.map(item => byId.get(item.unitId));
    const equipmentOptions=[...next.containers.filter(c=>c.status!=='SEALED').map(c=>c.equipment),...combination.types.map(type=>REFERENCE_EQUIPMENT[type])];
    const impossible=[];
    pool=pool.filter(unit=>{
      const reasons=equipmentOptions.map(equipment=>({equipment,reason:unitEquipmentFailure(unit,equipment)}));
      if(reasons.some(item=>!item.reason))return true;
      const unique=[...new Map(reasons.map(item=>[item.reason,item])).values()];
      impossible.push({unit,reason:unique.map(item=>item.reason).join('；')});
      for(const item of unique)rejected.push({typeId:item.equipment.typeId,unitIds:[unit.unitId],reason:item.reason});
      return false;
    });
    const maxContainers = Math.min(30, Math.max(1, Number(options.maximumContainers) || this.maximumContainers));
    for (const container of [...next.containers].reverse()) {
      if (container.status === 'SEALED') {
        if (pool.length) rejected.push({ containerId: container.containerId, reason: '柜已封闭，禁止追加', unitIds: pool.map(u => u.unitId) });
        continue;
      }
      const oldUnits = container.plan.loadedCargo.map(p => byId.get(p.cargoId));
      const eligible = [];
      for (const unit of pool) {
        const reasons = compatibility([...oldUnits, ...eligible], unit, task.transportModel);
        if (reasons.length) rejected.push({ containerId: container.containerId, unitIds: [unit.unitId], reason: reasons.join('；') });
        else eligible.push(unit);
      }
      if (!eligible.length) continue;
      const plan = container.lockedUnitIds.length
        ? await this.insertFixed(container, eligible, task)
        : await this.solveGroup([...oldUnits, ...eligible], container.equipment, task, options.solveCache);
      const ids = new Set(plan?.loadedCargo.map(p => p.cargoId));
      if (plan?.taskGate?.eligible && oldUnits.every(unit => ids.has(unit.unitId))) {
        if (plan.placementHash !== container.plan.placementHash) { container.plan = plan; container.planVersion += 1; }
        pool = pool.filter(unit => !ids.has(unit.unitId));
      } else rejected.push({ containerId: container.containerId, unitIds: eligible.map(u => u.unitId), reason: '无法在保留已有货物的条件下通过空间、门洞、支撑、重心和卸货检查' });
    }
    let progress = true;
    while (pool.length && next.containers.length < maxContainers && progress) {
      progress = false;
      const attemptedGroups = new Set();
      // Distinct service groups get separate cabinets, with deterministic first
      // remaining order as the group anchor; no customer/SKU geometry branches.
      for (const anchor of [...pool]) {
        if (!pool.some(u => u.unitId === anchor.unitId)) continue;
        const group = [anchor];
        for (const u of pool) if (u !== anchor && !compatibility(group, u, task.transportModel).length) group.push(u);
        const signature = group.map(u => u.unitId).sort().join('|');
        if (attemptedGroups.has(signature)) continue;
        attemptedGroups.add(signature);
        const alternatives = [];
        for (const type of combination.types) {
          const equipment = clone(REFERENCE_EQUIPMENT[type]);
          const plan = await this.solveGroup(group, equipment, task, options.solveCache);
          if (plan?.taskGate.eligible && plan.loadedCargo.length) alternatives.push({ plan, equipment });
          else rejected.push({ typeId: type, unitIds: group.map(u => u.unitId), reason: failureReason(plan) });
        }
        alternatives.sort((a, b) => b.plan.loadedCargo.length - a.plan.loadedCargo.length || a.equipment.capacityM3 - b.equipment.capacityM3);
        const chosen = alternatives[0];
        if (!chosen) continue;
        const container = { containerId: id('CTU'), label: `柜 ${next.containers.length + 1}`, status: 'DRAFT', lockedUnitIds: [],
          equipment: chosen.equipment, equipmentConfiguration: { source: 'REFERENCE_PROFILE', handlingEvidence: null }, planVersion: 1, plan: chosen.plan };
        next.containers.push(container);
        const ids = new Set(chosen.plan.loadedCargo.map(p => p.cargoId));
        pool = pool.filter(unit => !ids.has(unit.unitId));
        progress = true;
        break;
      }
    }
    next.unassigned = pool.map(u => ({ unitId: u.unitId, customerId: u.customerId, orderId: u.orderId, rowId: u.rowId,
      reason: next.containers.length >= maxContainers ? `达到本次${maxContainers}柜规划上限` : '已尝试所选柜型，未找到通过三维和作业检查的分配；详见候选拒绝依据' }));
    next.unassigned.push(...impossible.map(({unit,reason})=>({unitId:unit.unitId,customerId:unit.customerId,orderId:unit.orderId,rowId:unit.rowId,code:'UNIT_EQUIPMENT_ENVELOPE',reason})));
    assertLocks(task, next);
    const summary = assertConservation(next);
    const impacts = [];
    for (const previous of task.containers) {
      const current = next.containers.find(c => c.containerId === previous.containerId);
      const oldById = new Map(previous.plan.loadedCargo.map(p => [p.cargoId, p]));
      const movedUnitIds = current.plan.loadedCargo.filter(p => oldById.has(p.cargoId) && ['x', 'y', 'z', 'l', 'w', 'h'].some(key => oldById.get(p.cargoId)[key] !== p[key])).map(p => p.cargoId);
      const addedUnitIds = current.plan.loadedCargo.filter(p => !oldById.has(p.cargoId)).map(p => p.cargoId);
      if (movedUnitIds.length || addedUnitIds.length) impacts.push({ containerId: current.containerId, previousStatus: previous.status, previousPlanVersion: previous.planVersion, planVersion: current.planVersion, movedUnitIds, addedUnitIds });
    }
    return { candidateId: id('CANDIDATE'), label: combination.label, combination: combination.key, task: next, impacts, rejected,
      summary: { ...summary, totalWeight: task.units.reduce((sum, unit) => sum + unit.weight, 0),
        totalCapacityM3: next.containers.reduce((sum, c) => sum + c.equipment.innerLength * c.equipment.innerWidth * c.equipment.innerHeight / 1e9, 0),
        addedContainers: next.containers.length - task.containers.length, movedUnits: impacts.reduce((sum, entry) => sum + entry.movedUnitIds.length, 0) },
      comparisonBasis: '逐柜三维求解与验证；未提供报价，不推算节省金额' };
  }
}

function unitEquipmentFailure(unit,equipment) {
  if(Number(unit.weight)>Number(equipment.maxWeight)) return `单件 ${unit.weight} kg 超过 ${equipment.typeId} 可用载荷 ${equipment.maxWeight} kg`;
  const fitting=legalOrientations(unit).filter(d=>d.l<=equipment.innerLength&&d.w<=equipment.innerWidth&&d.h<=equipment.innerHeight);
  if(!fitting.length)return `${unit.length} × ${unit.width} × ${unit.height} mm，在允许朝向下超出 ${equipment.typeId} 箱内 ${equipment.innerLength} × ${equipment.innerWidth} × ${equipment.innerHeight} mm`;
  if(!fitting.some(d=>d.w<=equipment.doorWidth-60&&d.h<=equipment.doorHeight-40))return `货物在允许朝向下无法通过 ${equipment.typeId} 门洞 ${equipment.doorWidth} × ${equipment.doorHeight} mm（另留宽向60 / 高向40 mm项目净距）`;
  return null;
}

function failureReason(plan) {
  if (!plan?.loadedCargo?.length) return '该柜型没有可放入的实物件';
  return [...(plan.validator?.violations || []).map(v => v.message), ...(plan.taskGate?.doorFailures || []).map(v => v.message),
    ...(!plan.taskGate?.balanced ? ['组合重心超出全内长/宽5%项目门槛'] : []),
    ...(!plan.operationFeasibility?.operationPathPass ? ['装载插入路径受阻'] : []),
    ...(!plan.portAccessibility?.accessPass ? ['卸货取出路径受阻'] : [])].filter(Boolean).join('；') || '三维或作业检查未通过';
}

module.exports = { MultiContainerPlanner };
