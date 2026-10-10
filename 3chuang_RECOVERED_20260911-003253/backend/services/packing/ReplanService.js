'use strict';

const crypto = require('crypto');
const PlanValidator = require('./PlanValidator');
const { normalizeCargoList } = require('./PackagingProfile');
const { normalizeContainer, calculatePlanMetrics } = require('./PlanMetrics');
const { buildSourceIndex, bindSource } = require('./CargoSourceIdentity');
const { resolveOrientationRules } = require('./OrientationConstraint');
const { construct } = require('./SourceBenchmarkSolver');
const { supportClosedSeed } = require('./CommerceRepack');
const { buildShipmentReadiness } = require('../realworld/ShipmentReadinessService');
const { REFERENCE_EQUIPMENT } = require('../realworld/EquipmentPlanningService');
const { evaluateInsertionPath } = require('./InsertionPathFeasibility');
const { assertInputFacts, assertBusinessCapabilities, assertActualContainerFacts } = require('./PackingInputContract');
const { evaluateCandidate } = require('../HybridConstraintPackingSolverV25');

const clone = value => structuredClone(value);
const axes = ['x', 'y', 'z'];
const shape = ['l', 'w', 'h'];
const same = (a, b, fields) => fields.every(k => Math.abs(Number(a[k]) - Number(b[k])) <= 0.001);
const orientation = p => p.orientationId || p.canonicalOrientation || p.orientation;
const fail = (message, code = 'REPLAN_INPUT_INVALID', details = null) => Object.assign(new Error(message), { code, details });
const inputFields = ['length','width','height','weight','quantity','stackable','maxStackLayers','maxSupportedWeight','maximumSupportedWeightKg','orientationConstraints','orientationPolicy','canRotate','canInvert','canLayFlat','portSequence','fragile','packagingType','cargoPhysicalProfile','incompatibleWith','handlingMethod','handlingPolicy','forkEntry'];
function fingerprint(c) { return JSON.stringify(inputFields.map(k => c?.[k] ?? null)); }

function diffPlans(previous, next, previousCargo = [], cargoList = []) {
  const before = new Map((previous.loadedCargo || []).map(p => [String(p.cargoId), p]));
  const after = new Map((next.loadedCargo || []).map(p => [String(p.cargoId), p]));
  const oldSources = buildSourceIndex(previousCargo);
  const newSources = buildSourceIndex(cargoList);
  const entries = [];
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const old = before.get(id), current = after.get(id);
    const from = old ? clone(old) : null, to = current ? clone(current) : null;
    const oldSource = old && bindSource(old, oldSources).source;
    const newSource = current && bindSource(current, newSources).source;
    const reasons = [];
    if (oldSource && newSource && fingerprint(oldSource) !== fingerprint(newSource)) reasons.push('CARGO_INPUT_CHANGED');
    let status;
    if (!old) { status = 'added'; reasons.push('NEWLY_LOADED'); }
    else if (!current) { status = 'removed'; reasons.push('REMOVED_OR_NOT_LOADED'); }
    else if (!same(old, current, axes)) { status = 'moved'; reasons.push('POSITION_CHANGED_AFTER_VALIDATION'); }
    else if (orientation(old) !== orientation(current)) { status = 'orientation_changed'; reasons.push('ORIENTATION_CHANGED'); }
    else if (!same(old, current, shape)) { status = 'resized'; reasons.push('ENVELOPE_CHANGED_IN_PLACE'); }
    else status = 'unchanged';
    entries.push({ cargoId: id, sourceCargoId: current?.sourceCargoId || old?.sourceCargoId || newSource?.cargoId || oldSource?.cargoId, status,
      orientationChanged: Boolean(old && current && orientation(old) !== orientation(current)),
      dimensionsChanged: Boolean(old && current && !same(old, current, shape)), reasons, from, to });
  }
  const counts = Object.fromEntries(['unchanged', 'moved', 'removed', 'added', 'orientation_changed', 'resized'].map(k => [k, entries.filter(e => e.status === k).length]));
  return { entries, counts, movedCount: counts.moved, retainedCount: counts.unchanged + counts.resized,
    dimensionsChangedCount: entries.filter(e => e.dimensionsChanged).length,
    countDefinition: 'EXCLUSIVE_PRIMARY_STATUS; DIMENSIONS_CHANGED_IS_AN_INDEPENDENT_FLAG', comparison: 'PHYSICAL_INSTANCE_ID_AND_MM' };
}

function materializePrevious(previousPlan, cargoList) {
  const index = buildSourceIndex(cargoList), assigned = new Map(), canonicalToOriginal = new Map();
  const retained = [], affected = [];
  for (const p of previousPlan.loadedCargo) {
    const s = bindSource(p, index).source;
    if (!s) { affected.push(p.cargoId); continue; }
    const n = (assigned.get(s.cargoId) || 0) + 1;
    assigned.set(s.cargoId, n);
    if (n > s.quantity) { affected.push(p.cargoId); continue; }
    const o = resolveOrientationRules(s).orientations.flatMap(x => x.semanticVariants).find(x => x.id === orientation(p));
    if (!o) { affected.push(p.cargoId); continue; }
    const canonicalId = `${s.cargoId}__piece_${String(n).padStart(5, '0')}`;
    canonicalToOriginal.set(canonicalId, p.cargoId);
    const item = { ...clone(s), cargoId: p.cargoId, sourceCargoId: s.cargoId, quantity: 1, loadingIndex: p.loadingIndex,
      x: p.x, y: p.y, z: p.z, l: o.l, w: o.w, h: o.h,
      orientationId: o.id, canonicalOrientation: o.id, orientation: o.legacyLabel, axisMap: { ...o.axisMap }, uprightOriginalAxis: o.uprightOriginalAxis };
    retained.push(item);
  }
  return { retained, affected, canonicalToOriginal };
}

function validate(placements, unloadedCargo, cargoList, container) {
  return new PlanValidator().validate({ placements, unloadedCargo, cargoList, container, requireOrientationMetadata: true });
}

async function makeLocalPlan(body, candidate, cargoList, container, elapsedMs) {
  const evaluated = evaluateCandidate({ candidateId: `local-${candidate.policy}`, sourceAlgorithm: 'native-local-repair',
    placements: clone(candidate.placements), unloadedCargo: candidate.unloadedCargo, cargoList, container,
    strategy: String(body.strategy || 'space').toUpperCase(), route: body.caseContext?.route || [],
    caseContext: body.caseContext || {}, validator: new PlanValidator() });
  // Geometry alone does not establish the production loading gate: changing
  // mass or handling can invalidate balance, equipment paths or later unloading.
  if (!evaluated.hardConstraintsPass) return null;
  candidate = { ...candidate, placements: evaluated.loadedCargo, validator: evaluated.validator };
  const loadedCargo = candidate.placements.map(p => {
    const stability = candidate.validator.stability?.cargo?.[p.cargoId] || {};
    return { ...p, supportRatio: stability.supportRatio ?? null, riskStatus: stability.riskStatus || 'NOT_PROVIDED',
      stackStability: stability.stackStability || null, placementReason: { source: 'REPLAN_INDEPENDENT_VALIDATION',
        summary: '当前位置通过当前输入的独立校核；不继承旧方案的支撑和风险证据' } };
  });
  const metrics = calculatePlanMetrics(loadedCargo, container, candidate.unloadedCargo.length, elapsedMs);
  const hash = crypto.createHash('sha256').update(JSON.stringify(loadedCargo)).digest('hex');
  const result = { planId: `REPLAN_${crypto.randomUUID()}`, source: 'backend', sourceCode: 'BACKEND_SOLVED',
    solverMode: body.solverMode || 'PORTCUBE_BUSINESS_SIMULATION', loadedCargo, unloadedCargo: candidate.unloadedCargo,
    containerInfo: { ...container, typeId: body.containerType, mode: String(body.containerMode || 'REFERENCE_PROFILE').toUpperCase() },
    totalCargoCount: loadedCargo.length, totalCargoInput: cargoList.reduce((s, c) => s + c.quantity, 0),
    totalWeight: loadedCargo.reduce((s, p) => s + p.weight, 0), spaceUtilization: metrics.spaceUtilization,
    metrics: evaluated.metrics, ext_metrics: evaluated.metrics, cog: metrics.cog, cogOffset: { lateral: metrics.cog.lateral, longitudinal: metrics.cog.longitudinal },
    layoutQuality: evaluated.layoutQuality, voidJustification: evaluated.voidJustification,
    securing: evaluated.securing, operationFeasibility: evaluated.operationFeasibility,
    portAccessibility: evaluated.portAccessibility, loadDistribution: evaluated.loadDistribution,
    ext_portAccessibility: evaluated.portAccessibility, ext_loadDistribution: evaluated.loadDistribution,
    validator: candidate.validator, hardConstraintsPass: true, placementHash: hash, ext_placementHash: hash,
    ext_algorithmId: 'native-local-repair', ext_strategyUsed: candidate.policy,
    constraintMeta: { solverRevision: 'master-local-repair-v1', geometryModel: 'RECTANGULAR_TRANSPORT_ENVELOPE', equipmentPathVerified: false },
    executionStatus: { solve: 'COMPLETED', validation: 'VALID', persistence: 'CLIENT_WORKSPACE', businessReadiness: 'NOT_VERIFIED' },
    timestamp: new Date().toISOString(), aiExplanation: null, ext_aiExplanation: null };
  result.spaceUtilization = loadedCargo.reduce((s, p) => s + p.l * p.w * p.h, 0) / (container.innerLength * container.innerWidth * container.innerHeight) * 100;
  result.shipmentReadiness = await buildShipmentReadiness({ ...body, cargoList, containerInfo: result.containerInfo, plan: result });
  return result;
}

async function replan(body, solveFull) {
  const started = Date.now();
  const previous = body.previousPlan;
  if (!previous?.planId || previous.sourceCode !== 'BACKEND_SOLVED' || !Array.isArray(previous.loadedCargo)) throw fail('重规划需要一个正式求解版本；容量预览不能作为旧方案');
  if (!Array.isArray(body.cargoList) || !body.cargoList.length) throw fail('当前货单不能为空');
  if (body.solverMode === 'SOURCE_BENCHMARK') throw fail('来源基准输入不可改写；请建立独立业务场景后重规划', 'SOURCE_REPLAN_UNSUPPORTED');
  const commerce = body.solverMode === 'COMMERCE' || body.caseContext?.commerce?.enabled;
  assertInputFacts(body.cargoList, { allowUnknownWeight: commerce });
  if (!commerce) await assertBusinessCapabilities(body);
  const cargoList = normalizeCargoList(body.cargoList, { source: 'USER_INPUT' });
  if (cargoList.some(c => !c.cargoId || ![c.length,c.width,c.height,c.quantity].every(v => Number.isFinite(v) && v > 0) || !Number.isInteger(c.quantity))) throw fail('货物身份、尺寸和件数必须有效');
  if (new Set(cargoList.map(c => c.cargoId)).size !== cargoList.length) throw fail('货物 ID 重复');
  const previousCargo = body.previousCargo || [];
  const containerMode = String(body.containerMode || 'REFERENCE_PROFILE').toUpperCase();
  let selectedContainer = containerMode === 'ACTUAL_CONTAINER' ? body.actualContainer : REFERENCE_EQUIPMENT[body.containerType];
  if (containerMode === 'ACTUAL_CONTAINER') {
    assertActualContainerFacts(body.actualContainer);
    const gross = Number(body.actualContainer?.maxGross), tare = Number(body.actualContainer?.tare);
    selectedContainer = { ...body.actualContainer, maxWeight: gross - tare };
  }
  const container = normalizeContainer(selectedContainer || {});
  if (!Array.isArray(body.lockedCargoIds || [])) throw fail('固定货物应为实例 ID 数组');
  const locks = new Set(body.lockedCargoIds || []);
  if ([...locks].some(id => !previous.loadedCargo.some(p => p.cargoId === id))) throw fail('固定货物不属于旧方案', 'LOCKED_CARGO_CONFLICT');
  const attempts = [];
  let result = null, method;
  if (!commerce && selectedContainer && cargoList.every(c => Number.isFinite(c.weight) && c.weight >= 0)) {
    const state = materializePrevious(previous, cargoList);
    const initial = validate(state.retained, [], cargoList, container);
    attempts.push({ method: 'IN_PLACE_REVALIDATION', valid: initial.valid, violations: initial.violations.map(v => ({ code: v.code, cargoIds: v.cargoIds })) });
    if (initial.valid) {
      result = await makeLocalPlan(body, { placements: state.retained, unloadedCargo: [], validator: initial, policy: 'in-place-revalidation' }, cargoList, container, Date.now() - started);
      attempts[0].businessGatePass = Boolean(result);
      if (result) method = 'IN_PLACE_REVALIDATION';
    }
    if (!result) {
      const bad = new Set([...state.affected, ...initial.violations.flatMap(v => v.cargoIds || [])]);
      const lockPlacements = state.retained.filter(p => locks.has(p.cargoId));
      if (lockPlacements.length !== locks.size) throw fail('输入变更导致固定货物身份或朝向失效，请先处理固定货物', 'LOCKED_CARGO_CONFLICT');
      const seed = supportClosedSeed(state.retained, [...bad], lockPlacements);
      if (seed && seed.length) {
        const originalToCanonical = new Map([...state.canonicalToOriginal].map(([k,v]) => [v,k]));
        const canonicalSeed = seed.map(p => ({ ...p, cargoId: originalToCanonical.get(p.cargoId) }));
        const task = { cargoList, container, rules: { supportRatio: 1, stacking: true, weightKnown: true, payload: true, pressure: false, declaredTopLoad: true } };
        for (const policy of ['wall', 'volume']) {
          const c = construct(task, policy, Date.now() + Math.min(1500, Math.max(100, Number(body.localTimeLimitMs) || 1000)), { seed: canonicalSeed });
          const restore = p => {
            const s = cargoList.find(item => item.cargoId === p.sourceCargoId);
            return { ...clone(s), ...p, cargoId: state.canonicalToOriginal.get(p.cargoId) || p.cargoId,
              handlingMethod: s.handlingMethod, destinationPort: s.destinationPort, batchId: s.batchId,
              portSequence: s.portSequence || 1 };
          };
          c.placements = c.placements.map(restore); c.unloadedCargo = c.unloadedCargo.map(restore);
          c.validator = validate(c.placements, c.unloadedCargo, cargoList, container);
          attempts.push({ method: 'LOCAL_REPAIR', policy, preserved: seed.length, loaded: c.placements.length, valid: c.validator.valid,
            violations: c.validator.violations.map(v => ({ code: v.code, cargoIds: v.cargoIds })) });
          // A repair that leaves cargo out must compete with a complete solve.
          if (c.validator.valid && c.unloadedCargo.length === 0) {
            result = await makeLocalPlan(body, { ...c, policy }, cargoList, container, Date.now()-started);
            attempts.at(-1).businessGatePass = Boolean(result);
            if (result) { method = 'LOCAL_REPAIR'; break; }
          }
        }
      }
    }
  }
  if (!result) {
    const { previousPlan: _previousPlan, previousCargo: _previousCargo, lockedCargoIds: _lockedCargoIds, reason: _reason, ...request } = body;
    if (commerce && locks.size) request.caseContext = { ...request.caseContext, commerce: { ...request.caseContext.commerce,
      lockedPlacements: previous.loadedCargo.filter(p => locks.has(p.cargoId)) } };
    result = await solveFull(request);
    if (!result?.loadedCargo || result.sourceCode !== 'BACKEND_SOLVED') throw fail('完整重规划未返回正式方案', 'REPLAN_SOLVE_FAILED');
    method = 'FULL_REPLAN';
    attempts.push({ method, loaded: result.loadedCargo.length, valid: result.validator?.valid ?? result.hardConstraintsPass ?? null });
  }
  for (const id of locks) {
    const before = previous.loadedCargo.find(p => p.cargoId === id), after = result.loadedCargo.find(p => p.cargoId === id);
    if (!after || !same(before, after, axes) || orientation(before) !== orientation(after)) throw fail('未找到保留所有固定货物位置的合法方案；原方案保持不变', 'LOCKED_CARGO_CONFLICT', { cargoId: id });
  }
  if (locks.size) {
    // These units are already inside. Sorting them as future placements would
    // incorrectly permit a new unit to pass through an occupied door corridor.
    const inserted = result.loadedCargo.filter(p => locks.has(p.cargoId));
    const pending = result.loadedCargo.filter(p => !locks.has(p.cargoId)).sort((a,b) => a.x-b.x || a.y-b.y || a.z-b.z);
    for (const p of pending) {
      const check = evaluateInsertionPath(p, inserted, result.containerInfo);
      if (!check.feasible) throw fail('已固定货物阻挡新增装载路径，需要现场解锁或调整作业条件', 'LOCKED_CARGO_CONFLICT', { cargoId: p.cargoId, reasons: check.reasons });
      inserted.push(p);
    }
  }
  result = clone(result);
  const diff = diffPlans(previous, result, previousCargo, cargoList);
  result.replan = { method, reason: String(body.reason || '输入变化后重新校核'), previousPlanId: previous.planId,
    elapsedMs: Date.now()-started, attempts, diff, fixedCargoIds: [...locks],
    selection: method === 'FULL_REPLAN' ? '局部方案未完整通过校核，已扩大为完整求解' : '全部货物通过独立校核，优先保留已有位置' };
  result.revision = { revisionId: crypto.randomUUID(), previousPlanId: previous.planId, createdAt: new Date().toISOString(),
    inputHash: crypto.createHash('sha256').update(JSON.stringify(cargoList)).digest('hex'), method };
  return result;
}

module.exports = { replan, diffPlans, materializePrevious };
