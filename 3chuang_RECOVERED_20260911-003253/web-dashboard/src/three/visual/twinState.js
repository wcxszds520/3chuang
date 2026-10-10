// Desired placement, local simulation and reported observations are independent.
// A simulation cursor is intentionally not accepted by this observation API.
export function createTwinObservation({ cargoId, planId, status = 'OBSERVED', source, operator, note, measuredPosition, at = new Date().toISOString() }) {
  if (!cargoId || !planId) throw new Error('请先选中正式方案中的货物');
  if (!['OBSERVED', 'CONFIRMED'].includes(status)) throw new Error('无效的观察状态');
  if (!['MANUAL', 'MEASUREMENT'].includes(source)) throw new Error('请选择人工记录或测量输入来源');
  if (!operator?.trim() || !note?.trim()) throw new Error('请填写记录人和现场依据');
  if (!Number.isFinite(Date.parse(at))) throw new Error('无效的记录时间');
  let position = null;
  if (source === 'MEASUREMENT') {
    if (!measuredPosition || !['x', 'y', 'z'].every(key => measuredPosition[key] !== '' && measuredPosition[key] != null && Number.isFinite(Number(measuredPosition[key])) && Number(measuredPosition[key]) >= 0)) throw new Error('请填写非负的 X / Y / Z 实测坐标（mm）');
    position = Object.fromEntries(['x', 'y', 'z'].map(key => [key, Number(measuredPosition[key])]));
  }
  return { id: `OBS_${Date.parse(at)}_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`, cargoId, planId, status, source, operator: operator.trim(), note: note.trim(), measuredPosition: position, at };
}

export function latestObservation(observations, planId, cargoId) {
  return [...(observations || [])].reverse().find(item => item.planId === planId && item.cargoId === cargoId) || null;
}

export function revisionGhosts(diff) {
  return (diff?.entries || []).filter(entry => (entry.before || entry.from) && (entry.status !== 'unchanged' || entry.resized)).map(entry => ({
    kind: 'revision-before', cargo: entry.before || entry.from, position: entry.before || entry.from,
    color: entry.status === 'removed' ? '#b64c4c' : '#dc9c41', opacity: .17, wireframe: false,
    cargoId: entry.cargoId, reason: entry.reason
  }));
}

export function cargoIssues(plan) {
  return (plan.loadedCargo || []).flatMap(item => {
    const reasons = [];
    if (item.supportRatio != null && Number(item.supportRatio) < .8) reasons.push(`支撑率 ${(Number(item.supportRatio) * 100).toFixed(0)}%`);
    if (item.riskStatus && !['STABLE', 'NOT_PROVIDED', 'UNKNOWN'].includes(item.riskStatus)) reasons.push(item.riskStatus);
    return reasons.length ? [{ cargo: item, reasons }] : [];
  });
}
