/**
 * Dashboard 聚合统计路由 (只读)
 *
 * 设计原则:
 * 1. 所有指标基于真实业务表 (cargo / packing_plan / container_type) 聚合
 * 2. 无数据时返回 0 / null / 空数组, 绝不写死或编造
 * 3. 不修改核心装箱算法, 不伪造订单/任务/报告
 * 4. 当前项目无订单表/任务表/报告表/3D作业单表, 这些指标返回真实基础数据 + null
 *
 * 数据溯源:
 * - 货物总数/SKU/件数/已录入: cargo 表 COUNT/SUM
 * - 柜型: container_type 表
 * - 装箱方案: packing_plan 表 (plan_data JSON 含完整算法结果)
 * - 合规状态: packing_plan.compliance_status + plan_data.complianceReport
 * - 订单/任务/报告/3D作业单: 当前项目无对应表, 返回 null + reason
 * - 港口态势: 外部接口未接入, 返回 { available: false }
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/dashboard/summary
 * 全局任务概览 - 基于真实 cargo + packing_plan 表聚合
 *
 * 返回字段:
 * - cargoTotal: cargo 表行数 (已录入 SKU 种类数)
 * - cargoQtyTotal: cargo 表 SUM(quantity) (已录入总件数)
 * - packingPlanTotal: packing_plan 表行数 (已生成装箱方案数)
 * - compliancePassedCount: compliance_status='passed' 的方案数
 * - complianceWarningCount: compliance_status='warning' 的方案数
 * - complianceFailedCount: compliance_status='failed' 的方案数
 * - containerTypeCount: container_type 表行数
 * - orderTotal: null (无订单表)
 * - taskTotal: null (无任务表)
 * - reportTotal: null (无报告表)
 * - twinTaskTotal: null (无 3D 作业单表)
 * - dataSource: 字段说明 (哪些真实, 哪些未接入)
 */
router.get('/summary', async (req, res) => {
  try {
    const queries = await Promise.all([
      db.query('SELECT COUNT(*) AS cnt FROM cargo').catch(() => [[{ cnt: 0 }]]),
      db.query('SELECT COALESCE(SUM(quantity), 0) AS qty FROM cargo').catch(() => [[{ qty: 0 }]]),
      db.query('SELECT COUNT(*) AS cnt FROM packing_plan').catch(() => [[{ cnt: 0 }]]),
      db.query("SELECT COUNT(*) AS cnt FROM packing_plan WHERE compliance_status = 'passed'").catch(() => [[{ cnt: 0 }]]),
      db.query("SELECT COUNT(*) AS cnt FROM packing_plan WHERE compliance_status = 'warning'").catch(() => [[{ cnt: 0 }]]),
      db.query("SELECT COUNT(*) AS cnt FROM packing_plan WHERE compliance_status = 'failed'").catch(() => [[{ cnt: 0 }]]),
      db.query('SELECT COUNT(*) AS cnt FROM container_type').catch(() => [[{ cnt: 0 }]])
    ]);

    const [
      cargoRows, qtyRows, planRows, passedRows, warningRows, failedRows, containerRows
    ] = queries.map((q) => q[0][0]);

    res.success({
      cargoTotal: Number(cargoRows.cnt || 0),
      cargoQtyTotal: Number(qtyRows.qty || 0),
      packingPlanTotal: Number(planRows.cnt || 0),
      compliancePassedCount: Number(passedRows.cnt || 0),
      complianceWarningCount: Number(warningRows.cnt || 0),
      complianceFailedCount: Number(failedRows.cnt || 0),
      containerTypeCount: Number(containerRows.cnt || 0),
      // 以下业务表当前项目不存在, 显式返回 null 不编造
      orderTotal: null,
      taskTotal: null,
      reportTotal: null,
      twinTaskTotal: null,
      dataSource: {
        cargoTotal: 'cargo 表 COUNT(*)',
        cargoQtyTotal: 'cargo 表 SUM(quantity)',
        packingPlanTotal: 'packing_plan 表 COUNT(*)',
        compliancePassedCount: "packing_plan WHERE compliance_status='passed'",
        complianceWarningCount: "packing_plan WHERE compliance_status='warning'",
        complianceFailedCount: "packing_plan WHERE compliance_status='failed'",
        containerTypeCount: 'container_type 表 COUNT(*)',
        orderTotal: 'null - 当前项目无订单表',
        taskTotal: 'null - 当前项目无任务表',
        reportTotal: 'null - 当前项目无报告归档表',
        twinTaskTotal: 'null - 当前项目无 3D 作业单表'
      }
    }, 'Dashboard 全局概览');
  } catch (err) {
    console.error('[dashboard/summary] error:', err.message);
    res.error(`Dashboard 概览聚合失败: ${err.message}`, 500);
  }
});

/**
 * GET /api/dashboard/priority-task
 * 当前重点任务 - 从真实 packing_plan 取最近一条
 *
 * 选择规则 (不写死订单号):
 * 1. 优先 compliance_status='warning' 的最近一条 (待复核)
 * 2. 否则取最近一条 packing_plan
 * 3. 无数据返回 null
 *
 * 返回字段全部从 plan_data JSON 解析, 不编造:
 * - planId, containerType, spaceUtilization, totalWeight, totalCargoCount
 * - loadedCount, unloadedCount (从 plan_data.loadedCargo/unloadedCargo 长度)
 * - cogOffset (从 plan_data.cogOffset)
 * - complianceStatus, complianceScore (从 plan_data.complianceReport)
 * - createdAt
 * - 航线/订单号: 当前 packing_plan 表无此字段, 返回 null (不编造)
 */
router.get('/priority-task', async (req, res) => {
  try {
    // 1. 优先取 warning 状态的方案
    let rows = await db.query(
      "SELECT plan_id, container_type, space_utilization, total_weight, total_cargo_count, plan_data, compliance_status, risk_level, created_at FROM packing_plan WHERE compliance_status = 'warning' ORDER BY created_at DESC LIMIT 1"
    ).catch(() => [[]]);

    // 2. 无 warning 则取最近一条
    if (!rows[0] || rows[0].length === 0) {
      rows = await db.query(
        'SELECT plan_id, container_type, space_utilization, total_weight, total_cargo_count, plan_data, compliance_status, risk_level, created_at FROM packing_plan ORDER BY created_at DESC LIMIT 1'
      ).catch(() => [[]]);
    }

    if (!rows[0] || rows[0].length === 0) {
      return res.success(null, '暂无重点任务 - 请先完成货物录入并生成装箱方案');
    }

    const r = rows[0][0];
    let planData = {};
    try {
      planData = typeof r.plan_data === 'string' ? JSON.parse(r.plan_data) : (r.plan_data || {});
    } catch (e) {
      planData = {};
    }

    const loadedCargo = Array.isArray(planData.loadedCargo) ? planData.loadedCargo : [];
    const unloadedCargo = Array.isArray(planData.unloadedCargo) ? planData.unloadedCargo : [];
    const cogOffset = planData.cogOffset || { lateral: 0, longitudinal: 0 };
    const complianceReport = planData.complianceReport || {};

    res.success({
      planId: r.plan_id,
      containerType: r.container_type,
      spaceUtilization: Number(r.space_utilization || 0),
      totalWeight: Number(r.total_weight || 0),
      totalCargoCount: Number(r.total_cargo_count || 0),
      loadedCount: loadedCargo.length,
      unloadedCount: unloadedCargo.length,
      cogOffset: {
        lateral: Number(cogOffset.lateral || 0),
        longitudinal: Number(cogOffset.longitudinal || 0)
      },
      complianceStatus: r.compliance_status || (complianceReport.status || 'unknown'),
      complianceScore: Number(complianceReport.score || 0),
      riskLevel: r.risk_level || null,
      createdAt: r.created_at,
      // 以下字段 packing_plan 表无对应列, 显式返回 null 不编造
      orderNo: null,
      originPort: null,
      destinationPort: null,
      skuCount: null,
      totalQty: null,
      loadedQty: null,
      unloadedQty: null,
      loadWeightRate: null,
      reviewStatus: null,
      updatedAt: r.created_at,
      dataSource: {
        planId: 'packing_plan.plan_id',
        containerType: 'packing_plan.container_type',
        spaceUtilization: 'packing_plan.space_utilization',
        totalWeight: 'packing_plan.total_weight',
        totalCargoCount: 'packing_plan.total_cargo_count',
        loadedCount: 'plan_data.loadedCargo.length',
        unloadedCount: 'plan_data.unloadedCargo.length',
        cogOffset: 'plan_data.cogOffset',
        complianceStatus: 'packing_plan.compliance_status',
        complianceScore: 'plan_data.complianceReport.score',
        orderNo: 'null - packing_plan 表无订单号字段',
        originPort: 'null - packing_plan 表无起运港字段',
        destinationPort: 'null - packing_plan 表无目的港字段'
      }
    }, '重点任务获取成功');
  } catch (err) {
    console.error('[dashboard/priority-task] error:', err.message);
    res.error(`重点任务获取失败: ${err.message}`, 500);
  }
});

/**
 * GET /api/dashboard/queues
 * 系统队列状态 - 基于真实 packing_plan.compliance_status 聚合
 *
 * 当前项目无任务表/3D作业单表/报告表, 这些队列返回真实基础数 + null
 */
router.get('/queues', async (req, res) => {
  try {
    const [planRows] = await db.query(
      "SELECT compliance_status, risk_level, COUNT(*) AS cnt FROM packing_plan GROUP BY compliance_status, risk_level"
    ).catch(() => [[]]);

    const stats = { passed: 0, warning: 0, failed: 0, green: 0, yellow: 0, red: 0 };
    (planRows || []).forEach((r) => {
      const cs = r.compliance_status;
      const rl = r.risk_level;
      if (cs === 'passed') stats.passed += Number(r.cnt);
      if (cs === 'warning') stats.warning += Number(r.cnt);
      if (cs === 'failed') stats.failed += Number(r.cnt);
      if (rl === 'green') stats.green += Number(r.cnt);
      if (rl === 'yellow') stats.yellow += Number(r.cnt);
      if (rl === 'red') stats.red += Number(r.cnt);
    });

    res.success({
      // 合规风险队列 - 真实数据
      complianceReviewQueue: {
        pending: stats.warning,
        highRisk: stats.red,
        midRisk: stats.yellow,
        lowRisk: stats.green,
        total: stats.passed + stats.warning + stats.failed
      },
      // 以下队列当前项目无对应业务表, 返回 null
      aiDecisionQueue: null,
      twinTaskQueue: null,
      reportExportQueue: null,
      dataSource: {
        complianceReviewQueue: "packing_plan GROUP BY compliance_status, risk_level",
        aiDecisionQueue: 'null - 当前项目无 AI 决策任务表',
        twinTaskQueue: 'null - 当前项目无 3D 作业单表',
        reportExportQueue: 'null - 当前项目无报告导出表'
      }
    }, '系统队列状态');
  } catch (err) {
    console.error('[dashboard/queues] error:', err.message);
    res.error(`系统队列获取失败: ${err.message}`, 500);
  }
});

/**
 * GET /api/dashboard/recent-tasks
 * 历史任务列表 - 从真实 packing_plan 取最近 N 条
 * 不编造订单, 只展示真实已生成方案
 */
router.get('/recent-tasks', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const [rows] = await db.query(
      'SELECT plan_id, container_type, space_utilization, total_weight, total_cargo_count, plan_data, compliance_status, risk_level, created_at FROM packing_plan ORDER BY created_at DESC LIMIT ?',
      [limit]
    ).catch(() => [[]]);

    const tasks = (rows || []).map((r) => {
      let planData = {};
      try {
        planData = typeof r.plan_data === 'string' ? JSON.parse(r.plan_data) : (r.plan_data || {});
      } catch (e) {
        planData = {};
      }
      const complianceReport = planData.complianceReport || {};
      return {
        planId: r.plan_id,
        containerType: r.container_type,
        spaceUtilization: Number(r.space_utilization || 0),
        totalWeight: Number(r.total_weight || 0),
        totalCargoCount: Number(r.total_cargo_count || 0),
        loadedCount: Array.isArray(planData.loadedCargo) ? planData.loadedCargo.length : 0,
        unloadedCount: Array.isArray(planData.unloadedCargo) ? planData.unloadedCargo.length : 0,
        complianceStatus: r.compliance_status,
        complianceScore: Number(complianceReport.score || 0),
        riskLevel: r.risk_level,
        createdAt: r.created_at,
        // packing_plan 表无以下字段, 返回 null
        orderNo: null,
        route: null,
        originPort: null,
        destinationPort: null
      };
    });

    res.success(tasks, tasks.length ? `获取 ${tasks.length} 条历史任务` : '暂无历史任务');
  } catch (err) {
    console.error('[dashboard/recent-tasks] error:', err.message);
    res.error(`历史任务获取失败: ${err.message}`, 500);
  }
});

/**
 * GET /api/dashboard/risks
 * 风险事项 - 从真实 packing_plan 中 compliance_status != 'passed' 的方案提取
 */
router.get('/risks', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT plan_id, container_type, space_utilization, plan_data, compliance_status, risk_level, created_at FROM packing_plan WHERE compliance_status != 'passed' ORDER BY created_at DESC LIMIT 20"
    ).catch(() => [[]]);

    const risks = (rows || []).map((r) => {
      let planData = {};
      try {
        planData = typeof r.plan_data === 'string' ? JSON.parse(r.plan_data) : (r.plan_data || {});
      } catch (e) {
        planData = {};
      }
      const complianceReport = planData.complianceReport || {};
      const riskList = Array.isArray(complianceReport.risks) ? complianceReport.risks : [];
      const cogOffset = planData.cogOffset || {};

      return {
        planId: r.plan_id,
        containerType: r.container_type,
        complianceStatus: r.compliance_status,
        riskLevel: r.risk_level,
        complianceScore: Number(complianceReport.score || 0),
        cogOffsetLateral: Number(cogOffset.lateral || 0),
        cogOffsetLongitudinal: Number(cogOffset.longitudinal || 0),
        riskDetails: riskList,
        createdAt: r.created_at
      };
    });

    res.success(risks, risks.length ? `获取 ${risks.length} 条风险事项` : '暂无风险告警');
  } catch (err) {
    console.error('[dashboard/risks] error:', err.message);
    res.error(`风险事项获取失败: ${err.message}`, 500);
  }
});

/**
 * GET /api/dashboard/port-situation
 * 宁波港态势 - 外部接口未接入, 返回 available:false
 * 不返回假天气/船期/拥堵数据
 */
router.get('/port-situation', async (req, res) => {
  res.success({
    available: false,
    reason: '外部接口未接入',
    integrable: [
      'TOS 码头作业系统',
      '堆场系统',
      '船期系统',
      '气象接口'
    ],
    dataSource: '当前项目未接入 TOS/堆场/船期/气象等外部接口, 不展示具体数据'
  }, '宁波港态势 - 外部接口未接入');
});

module.exports = router;
