// Input identity includes every planning/evidence input, not the solver's output.
// Canonical serialization avoids hash collisions and survives JSON persistence.
export function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(item => stableSerialize(item ?? null)).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}

export function planningInputSnapshot(session = {}) {
  const keys = ['cargo', 'selectedContainerType', 'containerMode', 'actualContainer', 'caseContext', 'massEvidence', 'vgm', 'transport', 'securingInputs', 'solverMode', 'externalDataset', 'sourceContainer', 'operatorEnvelope', 'dangerousGoodsEvidence', 'woodPackagingEvidence'];
  return Object.fromEntries(keys.map(key => [key, session[key] ?? null]));
}

export function planningFingerprint(session) {
  return `planning-v2:${stableSerialize(planningInputSnapshot(session))}`;
}

export function immutableSnapshot(value) {
  const copy = structuredClone(value);
  function freeze(item) {
    if (!item || typeof item !== 'object' || Object.isFrozen(item)) return item;
    Object.values(item).forEach(freeze);
    return Object.freeze(item);
  }
  return freeze(copy);
}

const numberChanged = (a, b) => a == null || b == null ? a !== b : Math.abs(Number(a) - Number(b)) > 0.001;
const sourceId = item => item.sourceCargoId || item.inputCargoId || item.cargoId;
const orientation = item => stableSerialize({ code: item.orientationId || item.orientationCode || item.orientation, axisMap: item.axisMap || item.orientationAxisMap });
const FIELD_LABELS = { length: '长度', width: '宽度', height: '高度', weight: '重量', quantity: '数量', stackable: '堆叠限制', maxStackLayers: '最大堆层', maxSupportedWeight: '承载上限', maximumSupportedWeightKg: '承载上限', orientationPolicy: '方向限制', orientationConstraints: '方向约束', handlingMethod: '搬运方式', cargoPhysicalProfile: '物理画像', packagingProfile: '包装画像', packagingType: '包装类型', destinationPort: '卸货组', portSequence: '卸货次序' };

export function diffPlans(before, after, { previousCargo = [], cargo = [] } = {}) {
  const oldPlacements = new Map((before?.loadedCargo || []).map(item => [item.cargoId, item]));
  const newPlacements = new Map((after?.loadedCargo || []).map(item => [item.cargoId, item]));
  const oldInputs = new Map(previousCargo.map(item => [item.cargoId, item]));
  const newInputs = new Map(cargo.map(item => [item.cargoId, item]));
  const counts = { unchanged: 0, moved: 0, removed: 0, added: 0, orientation_changed: 0, resized: 0 };
  const entries = [...new Set([...oldPlacements.keys(), ...newPlacements.keys()])].map(cargoId => {
    const old = oldPlacements.get(cargoId), next = newPlacements.get(cargoId);
    const moved = Boolean(old && next && ['x', 'y', 'z'].some(key => numberChanged(old[key], next[key])));
    const orientationChanged = Boolean(old && next && orientation(old) !== orientation(next));
    const resized = Boolean(old && next && [['l', 'length'], ['w', 'width'], ['h', 'height']].some(([key, fallback]) => numberChanged(old[key] ?? old[fallback], next[key] ?? next[fallback])));
    if (resized) counts.resized += 1;
    const status = !old ? 'added' : !next ? 'removed' : orientationChanged ? 'orientation_changed' : moved ? 'moved' : 'unchanged';
    counts[status] += 1;
    const oldInput = oldInputs.get(sourceId(old || next)), nextInput = newInputs.get(sourceId(next || old));
    const changedFields = oldInput && nextInput ? [...new Set([...Object.keys(oldInput), ...Object.keys(nextInput)])].filter(key => stableSerialize(oldInput[key]) !== stableSerialize(nextInput[key])) : [];
    const explanation = status === 'removed' ? (nextInput ? '新版没有为该件分配货位，请查看未装原因。' : '该件已从当前输入移除。')
      : status === 'added' ? '新版新增已装货位。'
        : status === 'unchanged' ? (resized ? '尺寸已改变，重新校核后保留原位置和方向。' : changedFields.length ? '输入已改变，重新校核后保留原位置和方向。' : '位置与方向保持不变。')
          : changedFields.length ? `该货物输入已改变（${[...new Set(changedFields.map(key => FIELD_LABELS[key] || '其他输入'))].join('、')}），新版调整货位。` : '为适应当前约束与其他货物变更，求解器调整了此件。';
    return { cargoId, name: next?.name || old?.name || cargoId, status, moved, resized, orientationChanged, changedFields, reason: explanation, before: old || null, after: next || null };
  });
  return { previousPlanId: before?.planId || null, planId: after?.planId || null, counts, entries };
}

export function createPlanRevision({ session, plan, fingerprint, at, previous = null }) {
  return immutableSnapshot({ revisionId: `${plan.planId || 'PLAN'}:R${(session.planRevisions?.length || 0) + 1}`, planId: plan.planId,
    parentRevisionId: previous?.revisionId || null, createdAt: at, inputFingerprint: fingerprint,
    inputSnapshot: planningInputSnapshot(session), cargoSnapshot: session.cargo, plan,
    diff: previous?.plan ? diffPlans(previous.plan, plan, { previousCargo: previous.cargoSnapshot, cargo: session.cargo }) : null });
}
