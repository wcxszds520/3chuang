import { isBackendSolved } from '../provenance/planSource.js';

export function buildOrderActivity({ session, plan, planSource }) {
  const entries = [];
  if (session.cargo?.length) {
    entries.push({
      key: 'cargo-ready',
      label: '货物资料已完成',
      detail: `${session.cargo.length} 个 SKU 已进入当前订单`,
      at: session.lastSavedAt || session.order?.createdAt,
      source: 'current-session'
    });
  }
  if (isBackendSolved(planSource) && plan?.planId) {
    entries.push({
      key: 'backend-plan',
      label: '装柜方案已生成',
      detail: `${plan.totalCargoCount || 0}/${plan.totalCargoInput || 0} 件已排入 ${plan.containerInfo?.typeId || '当前柜型'}`,
      at: plan.timestamp || session.lastSavedAt,
      source: 'backend-plan',
      planId: plan.planId
    });
  }
  if (session.aiAudit) {
    entries.push({
      key: 'ai-audit',
      label: '后端规则复核已完成',
      detail: `${session.aiAudit.score ?? '—'} 分 · ${session.aiAudit.status || '已返回规则结论'} · AI 仅解释`,
      at: session.aiAudit.completedAt || session.lastSavedAt,
      source: 'backend-deterministic-with-ai-explanation'
    });
  }
  if (session.manualReview) {
    entries.push({
      key: 'manual-review',
      label: '人工复核已记录',
      detail: `${session.manualReview.reviewer} · ${decisionLabel(session.manualReview.decision)}`,
      at: session.manualReview.reviewedAt || session.lastSavedAt,
      source: 'manual-review'
    });
  }
  return entries;
}

export function buildOrderTodos({ session, plan, planSource, localCompliance }) {
  const todos = [];
  if (!session.cargo?.length) {
    todos.push({ key: 'cargo', label: '补充货物资料', detail: '当前订单尚无 SKU。', source: 'current-session', tone: 'warning' });
    return todos;
  }
  if (!isBackendSolved(planSource)) {
    todos.push({ key: 'plan', label: '生成正式装柜方案', detail: '当前仍为柜型对比方案。', source: 'current-session', tone: 'action' });
  } else {
    const unloaded = Math.max(
      Number(plan?.unloadedCargo?.length || 0),
      Number(plan?.totalCargoInput || 0) - Number(plan?.totalCargoCount || 0)
    );
    if (unloaded > 0) todos.push({ key: 'unloaded', label: `处理 ${unloaded} 件未装货物`, detail: '复核拆单、柜型或作业约束。', source: 'backend-plan', tone: 'warning', count: unloaded });
  }
  if ((localCompliance?.risks || []).some((risk) => /IPPC|ISPM\s*15/i.test(String(risk)))) {
    todos.push({ key: 'ippc', label: '补齐木包装 IPPC 证据', detail: '上传或确认木包装标识照片。', source: 'local-rules', tone: 'warning' });
  }
  if (isBackendSolved(planSource) && !session.aiAudit) todos.push({ key: 'ai', label: '运行后端合规复核', detail: '执行确定性规则，AI 仅补充解释。', source: 'current-session', tone: 'action' });
  if (isBackendSolved(planSource) && !session.manualReview) todos.push({ key: 'manual', label: '完成人工复核', detail: '记录复核人、结论与备注。', source: 'current-session', tone: 'action' });
  if (!todos.length) todos.push({ key: 'ready', label: '当前流程已齐备', detail: '可进入报告预览与交付。', source: 'current-session', tone: 'success' });
  return todos;
}

function decisionLabel(decision) {
  return ({ approved: '通过', 'approved-with-conditions': '有条件通过', rejected: '退回整改' })[decision] || '待复核';
}
