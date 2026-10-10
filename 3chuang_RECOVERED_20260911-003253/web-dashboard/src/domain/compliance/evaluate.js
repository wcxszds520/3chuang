import { normalizePlanSource } from '../provenance/planSource.js';

const SOURCES = Object.freeze({
  vgm: 'SOLAS VI/2 · VGM 申报',
  weight: 'CSC 铭牌 · MAX GROSS / 柜型载重',
  lifo: 'IMO CTU Code · 作业可达性',
  cog: 'IMO CTU Code · 重量分布',
  stacking: 'IMO CTU Code · 货物固定与承压',
  documents: 'ISPM 15 / IMDG · 木包装与危险品单证',
  completeness: '当前订单与装箱方案逐件核对'
});

export function evaluateLocalCompliance({ plan = {}, cargoList = [], container = {}, vgmSubmitted = false } = {}) {
  const loadedCargo = Array.isArray(plan.loadedCargo) ? plan.loadedCargo : [];
  const unloadedCargo = Array.isArray(plan.unloadedCargo) ? plan.unloadedCargo : [];
  const totalWeight = finite(plan.totalWeight);
  const tareWeight = finite(container.tareWeight);
  const suggestedVgm = Math.round(totalWeight + tareWeight);
  const maxGross = finite(container.maxGross);
  const payloadLimit = finite(container.maxWeight);
  const lateral = Math.abs(finite(plan.cogOffset?.lateral));
  const longitudinal = Math.abs(finite(plan.cogOffset?.longitudinal));
  const grossOk = maxGross <= 0 || suggestedVgm <= maxGross;
  const payloadOk = payloadLimit <= 0 || totalWeight <= payloadLimit;
  const lifoOk = plan.constraintMeta?.lifoCompliant !== false;
  const pressureRisks = findPressureRisks(loadedCargo);
  const wooden = cargoList.filter((cargo) => cargo.wooden || /wood|pallet|木/i.test(cargo.packagingType || ''));
  const dangerous = cargoList.filter((cargo) => cargo.dangerous);
  const woodMissing = wooden.filter((cargo) => !hasConfirmedDocument(cargo, /IPPC|ISPM\s*15/i));
  const dangerousMissing = dangerous.filter((cargo) => !hasConfirmedDocument(cargo, /MSDS|UN\s*38\.3|IMDG/i));
  const totalInput = Number(plan.totalCargoInput ?? cargoList.reduce((sum, cargo) => sum + finite(cargo.quantity), 0));
  const loadedCount = Number(plan.totalCargoCount ?? loadedCargo.length);

  const rows = [
    row('vgm', 'VGM 重量验证', '申报 VGM，并确认不超过集装箱 MAX GROSS。', vgmSubmitted ? `建议申报 ${suggestedVgm} kg` : '待提交 VGM', vgmSubmitted && grossOk ? 'PASS' : 'WARNING'),
    row('weight', '载重与 MAX GROSS', `货重 ≤ ${payloadLimit || '—'} kg；毛重 ≤ ${maxGross || '—'} kg。`, `货重 ${Math.round(totalWeight)} kg；毛重 ${suggestedVgm} kg`, grossOk && payloadOk ? 'PASS' : 'FAIL'),
    row('lifo', 'LIFO 批次可达', '先卸批次靠门，后卸批次靠箱内。', lifoOk ? '批次空间顺序通过' : '检测到批次反穿插', lifoOk ? 'PASS' : 'FAIL'),
    row('cog', '动态重心', '横向偏移 < 5%，纵向偏移 < 10%。', `横向 ${lateral.toFixed(2)}%；纵向 ${longitudinal.toFixed(2)}%`, lateral < 5 && longitudinal < 10 ? 'PASS' : 'WARNING'),
    row('stacking', '堆叠与承压', '不可堆叠/易碎货物上方不得承压。', pressureRisks.length ? `${pressureRisks.length} 件存在上方承压` : '未检测到不可堆叠或易碎货物承压', pressureRisks.length ? 'FAIL' : 'PASS'),
    row('documents', '木包装与危险品单证', '木包装需 IPPC/ISPM 15 证据；危险品需相应申报资料。', `${woodMissing.length} 项木包装证据待补；${dangerousMissing.length} 项危险品资料待补`, woodMissing.length || dangerousMissing.length ? 'WARNING' : 'PASS'),
    row('completeness', '装载完整性', '当前订单件数与装入/未装件逐件可追溯。', `输入 ${totalInput} 件；装入 ${loadedCount} 件；未装 ${unloadedCargo.length} 件`, unloadedCargo.length || loadedCount < totalInput ? 'WARNING' : 'PASS')
  ];

  const risks = [];
  if (!vgmSubmitted) risks.push('VGM 尚未提交，需在承运人截止时间前完成称重申报并留存回执。');
  if (!grossOk || !payloadOk) risks.push('重量超过柜型载重或 MAX GROSS，当前方案不得进入装运。');
  if (!lifoOk) risks.push('批次卸货顺序不满足 LIFO，可导致目的港倒箱。');
  if (lateral >= 5 || longitudinal >= 10) risks.push('重心偏移超过建议阈值，需调整重货位置后重新生成方案。');
  if (pressureRisks.length) risks.push('检测到不可堆叠或易碎货物承压，需重新装箱。');
  if (woodMissing.length) risks.push(`${woodMissing.length} 项木包装缺少已确认的 IPPC / ISPM 15 证据。`);
  if (dangerousMissing.length) risks.push(`${dangerousMissing.length} 项危险品缺少 MSDS、UN38.3 或 IMDG 申报证据。`);
  if (unloadedCargo.length || loadedCount < totalInput) risks.push(`${Math.max(unloadedCargo.length, totalInput - loadedCount)} 件未装入，需换柜、拆单或复算。`);

  const fails = rows.filter(({ result }) => result === 'FAIL').length;
  const warnings = rows.filter(({ result }) => result === 'WARNING').length;
  return {
    source: 'local-rules',
    sourceLabel: '确定性规则',
    status: fails ? 'FAIL' : warnings ? 'WARNING' : 'PASS',
    score: Math.max(0, 100 - fails * 22 - warnings * 7),
    rows,
    risks,
    suggestedVgm,
    tareWeight,
    maxGross,
    advice: buildAdvice({ fails, warnings, risks }),
    evidence: {
      planId: plan.planId || null,
      planSource: normalizePlanSource(plan),
      loadedCount,
      unloadedCount: unloadedCargo.length
    }
  };
}

function row(key, dimension, standard, actual, result) {
  return { key, dimension, standard, actual, result, sourceRef: SOURCES[key] };
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function hasConfirmedDocument(cargo, pattern) {
  return (cargo.riskNotes || []).some((note) => pattern.test(String(note)) && !/待|缺|未|需补/i.test(String(note)));
}

function findPressureRisks(items) {
  return items.filter((base) => {
    if (base.stackable !== false && !base.fragile) return false;
    const top = finite(base.y) + finite(base.h);
    return items.some((other) => other !== base
      && finite(other.y) >= top - 1
      && overlap1d(finite(base.x), finite(base.x) + finite(base.l), finite(other.x), finite(other.x) + finite(other.l))
      && overlap1d(finite(base.z), finite(base.z) + finite(base.w), finite(other.z), finite(other.z) + finite(other.w)));
  });
}

function overlap1d(a0, a1, b0, b1) {
  return a0 < b1 - 1 && a1 > b0 + 1;
}

function buildAdvice({ fails, warnings, risks }) {
  if (fails) return `当前存在 ${fails} 项阻断，先完成重量、顺序或承压整改，再进入人工复核。`;
  if (warnings) return `当前存在 ${warnings} 项待复核；${risks[0] || '补齐证据后可进入人工复核。'}`;
  return '当前规则检查通过，可继续 AI 解释与人工复核；最终以承运人和港口要求为准。';
}
