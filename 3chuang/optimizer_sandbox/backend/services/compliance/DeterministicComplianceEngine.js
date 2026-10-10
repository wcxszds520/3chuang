'use strict';

const policy = require('../../config/compliancePolicy');

const RESULTS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARNING: 'WARNING',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
});

class DeterministicComplianceEngine {
  evaluate(plan = {}) {
    const cargo = Array.isArray(plan.loadedCargo) ? plan.loadedCargo : [];
    const container = plan.containerInfo || {};
    const typeId = container.typeId || container.name || plan.containerType || 'UNKNOWN';
    const totalWeight = finite(plan.totalWeight, cargo.reduce((sum, item) => sum + finite(item.weight), 0));
    const maxPayload = finite(container.maxWeight, finite(plan.maxWeight));
    const lateralOffset = finite(plan.cogOffset?.lateral);
    const longitudinalOffset = finite(plan.cogOffset?.longitudinal);
    const declaredVGM = finite(plan.declaredVGM);
    const containerPolicy = policy.containers[typeId] || null;
    const grossWeight = totalWeight + finite(containerPolicy?.tareWeight);
    const rows = [
      this._vgmRow({ declaredVGM, grossWeight, containerPolicy }),
      this._payloadRow({ totalWeight, maxPayload }),
      this._cogRow({ lateralOffset, longitudinalOffset }),
      this._lifoRow(plan),
      this._stackingRow(cargo),
      this._dangerousRow(cargo),
      this._woodRow(cargo),
      this._documentRow(plan)
    ];

    const failCount = rows.filter((row) => row.result === RESULTS.FAIL).length;
    const warningCount = rows.filter((row) => row.result === RESULTS.WARNING).length;
    const reviewCount = rows.filter((row) => row.result === RESULTS.REVIEW_REQUIRED).length;
    const status = failCount ? RESULTS.FAIL : warningCount || reviewCount ? RESULTS.WARNING : RESULTS.PASS;
    const score = Math.max(0, 100
      - failCount * policy.score.failPenalty
      - warningCount * policy.score.warningPenalty
      - reviewCount * policy.score.reviewPenalty);

    return {
      engine: 'DeterministicComplianceEngine',
      source: 'deterministic-rules',
      sourceLabel: '确定性规则引擎',
      status,
      score,
      reportTable: rows,
      issues: rows.filter((row) => ![RESULTS.PASS, RESULTS.NOT_APPLICABLE].includes(row.result))
        .map((row) => ({ key: row.key, result: row.result, actual: row.actual })),
      summary: {
        containerType: typeId,
        actualWeight: totalWeight,
        maxPayload,
        grossWeight,
        declaredVGM,
        lateralOffset,
        longitudinalOffset,
        totalCargoCount: cargo.length,
        lifoCompliant: plan.constraintMeta?.lifoCompliant ?? null
      }
    };
  }

  _vgmRow({ declaredVGM, grossWeight, containerPolicy }) {
    if (!containerPolicy) return row('vgm', 'VGM重量验证', '需有已知柜型皮重及申报 VGM', '柜型皮重规则未知，无法核验', RESULTS.REVIEW_REQUIRED);
    if (!(declaredVGM > 0)) return row('vgm', 'VGM重量验证', '相对误差≤5% 且绝对误差≤1吨', `未申报；计算毛重 ${round(grossWeight)} kg`, RESULTS.FAIL);
    const absoluteError = Math.abs(grossWeight - declaredVGM);
    const relativeError = declaredVGM > 0 ? absoluteError / declaredVGM * 100 : Infinity;
    const pass = relativeError <= policy.vgm.relativeTolerancePercent && absoluteError <= policy.vgm.absoluteToleranceKg;
    return row('vgm', 'VGM重量验证', '相对误差≤5% 且绝对误差≤1吨', `申报 ${round(declaredVGM)} kg；计算 ${round(grossWeight)} kg；误差 ${relativeError.toFixed(1)}% / ${round(absoluteError)} kg`, pass ? RESULTS.PASS : RESULTS.FAIL);
  }

  _payloadRow({ totalWeight, maxPayload }) {
    if (!(maxPayload > 0)) return row('payload', '累计有效载荷', '累计货重不得超过柜型 max payload', `累计货重 ${round(totalWeight)} kg；max payload 缺失`, RESULTS.REVIEW_REQUIRED);
    return row('payload', '累计有效载荷', `累计货重 ≤ ${round(maxPayload)} kg`, `${round(totalWeight)} kg`, totalWeight <= maxPayload ? RESULTS.PASS : RESULTS.FAIL);
  }

  _cogRow({ lateralOffset, longitudinalOffset }) {
    const pass = Math.abs(lateralOffset) <= policy.cog.lateralWarningPercent
      && Math.abs(longitudinalOffset) <= policy.cog.longitudinalWarningPercent;
    return row('cog', '物理重心与装载', `横向≤${policy.cog.lateralWarningPercent}% 纵向≤${policy.cog.longitudinalWarningPercent}%`, `横${lateralOffset.toFixed(2)}% 纵${longitudinalOffset.toFixed(2)}%`, pass ? RESULTS.PASS : RESULTS.WARNING, { lateralOffset, longitudinalOffset });
  }

  _lifoRow(plan) {
    const value = plan.constraintMeta?.lifoCompliant;
    if (typeof value !== 'boolean') return row('lifo', 'LIFO 卸货顺序', '卸货顺序不得形成阻挡', '方案未提供 LIFO 规则证据', RESULTS.REVIEW_REQUIRED);
    return row('lifo', 'LIFO 卸货顺序', '卸货顺序不得形成阻挡', value ? '算法证据未检测到阻挡' : '算法证据检测到阻挡', value ? RESULTS.PASS : RESULTS.FAIL);
  }

  _stackingRow(cargo) {
    const violations = [];
    for (const upper of cargo) {
      for (const lower of cargo) {
        if (upper === lower || !isSupportedBy(upper, lower)) continue;
        if (lower.fragile === true) violations.push(`${upper.cargoId || upper.sku} 位于易碎货物 ${lower.cargoId || lower.sku} 上方`);
        if (lower.stackable === false) violations.push(`${upper.cargoId || upper.sku} 位于不可堆叠货物 ${lower.cargoId || lower.sku} 上方`);
      }
    }
    return row('stacking', '基础堆叠约束', '易碎品和不可堆叠货物上方不得承载', violations.length ? violations.join('；') : '未检测到易碎/不可堆叠接触冲突', violations.length ? RESULTS.FAIL : RESULTS.PASS, { violations });
  }

  _dangerousRow(cargo) {
    const hasSemantic = cargo.some((item) => typeof item.dangerous === 'boolean');
    if (!hasSemantic) return row('dangerous', '危险品/敏感品合规', '危险属性与申报资料必须明确', '输入未提供 dangerous 字段', RESULTS.REVIEW_REQUIRED);
    const dangerous = cargo.filter((item) => item.dangerous === true);
    if (!dangerous.length) return row('dangerous', '危险品/敏感品合规', '危险属性与申报资料必须明确', '全部已装货物明确标记为非危险品', RESULTS.NOT_APPLICABLE);
    const missing = dangerous.filter((item) => !matchesNotes(item, /(MSDS|UN38\.3|IMDG|危险品申报)/i));
    return row('dangerous', '危险品/敏感品合规', '危险品需提供适用的申报/资质证据', missing.length ? `${missing.length} 件危险货物缺少可识别资料引用` : `${dangerous.length} 件危险货物均带有资料引用`, missing.length ? RESULTS.WARNING : RESULTS.PASS, { cargoIds: dangerous.map((item) => item.cargoId || item.sku) });
  }

  _woodRow(cargo) {
    const wooden = cargo.filter((item) => item.wooden === true || /wood/i.test(String(item.packagingType || '')));
    if (!wooden.length) return row('wood', '木质包装 IPPC', '木质包装需核验适用的 IPPC/ISPM 15 标识', '未检测到标记为木质包装的货物', RESULTS.NOT_APPLICABLE);
    const missing = wooden.filter((item) => !matchesNotes(item, /(IPPC|ISPM\s*15)/i));
    return row('wood', '木质包装 IPPC', '木质包装需核验适用的 IPPC/ISPM 15 标识', missing.length ? `${missing.length} 件木质包装缺少标识证据` : `${wooden.length} 件木质包装带有标识证据`, missing.length ? RESULTS.WARNING : RESULTS.PASS);
  }

  _documentRow(plan) {
    const evidence = Array.isArray(plan.documentEvidence) ? plan.documentEvidence : [];
    return row('documents', '单证一致性', '品名、件数、重量、体积应由单证证据核验', evidence.length ? `收到 ${evidence.length} 条结构化单证证据，需人工复核一致性` : '未提供结构化单证证据', RESULTS.REVIEW_REQUIRED);
  }
}

function row(key, dimension, standard, actual, result, evidence = null) {
  return { key, dimension, standard, actual, result, evidence, ruleSource: 'deterministic' };
}

function isSupportedBy(upper, lower) {
  const yContact = Math.abs(finite(upper.y) - (finite(lower.y) + finite(lower.h, finite(lower.height)))) <= 2;
  if (!yContact) return false;
  return overlap(finite(upper.x), finite(upper.l, finite(upper.length)), finite(lower.x), finite(lower.l, finite(lower.length))) > 0
    && overlap(finite(upper.z), finite(upper.w, finite(upper.width)), finite(lower.z), finite(lower.w, finite(lower.width))) > 0;
}

function overlap(a, sizeA, b, sizeB) {
  return Math.max(0, Math.min(a + sizeA, b + sizeB) - Math.max(a, b));
}

function matchesNotes(item, pattern) {
  const notes = Array.isArray(item.riskNotes) ? item.riskNotes.join(' ') : String(item.riskNotes || '');
  return pattern.test(notes);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value) {
  return Math.round(finite(value));
}

module.exports = { DeterministicComplianceEngine, RESULTS };
