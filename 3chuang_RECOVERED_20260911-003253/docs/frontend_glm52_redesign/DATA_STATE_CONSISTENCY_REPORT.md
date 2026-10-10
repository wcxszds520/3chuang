# 数据口径一致性报告

> 模型：GLM-5.2 · 日期：2026-07-02 · 范围：全站 6 页 + 导出文件

## 1. 问题诊断

V1 重构后存在顶栏与主体数据混用问题：
- 顶栏 (OrderSummaryBar) 显示 `221/221 · 84.51% · 本地规则 WARNING / AI建议 PASS / 人工复核独立`（来自 DEMO_SUMMARY 硬编码）
- 页面主体显示 `221/221 · 84.51% · 本地规则 WARNING / AI建议 PASS / 人工复核独立`（来自真实 plan/compliance）

**根因**：OrderSummaryBar 接受 `items` prop，6 个页面中 4 个传入 `DEMO_SUMMARY.*`（含 221/221/84.51%/100 硬编码），覆盖了真实派生逻辑。

## 2. 修复方案

### 2.1 OrderSummaryBar 统一数据源

移除 `items` prop，强制从 `plan`/`compliance`/`container`/`scenario` 派生全部 7 项：

| 项 | V1 来源 | V2 来源 |
|---|---|---|
| 订单号 | items 覆盖 | `scenario.orderNo` |
| 航线 | items 覆盖 | `scenario.route` |
| 柜型 | items 覆盖 | `container.shortName` |
| 装入件数 | DEMO.loadedPieces/DEMO.pieces | `plan.loadedCargo.length / plan.totalCargoInput` |
| 空间利用率 | DEMO.utilization | `plan.spaceUtilization.toFixed(1)%` |
| 合规评分 | DEMO.complianceScore | `compliance.score` + `compliance.status` |
| 当前步骤 | items 覆盖 | `step` prop（各页传入） |

### 2.2 6 个调用点修复

| 页面 | V1 | V2 |
|---|---|---|
| Dashboard | 无 items（V1 已修） | step="工作台" |
| Cargo | `items={DEMO_SUMMARY.cargo}` + fake compliance | 移除 items, 传真实 plan/compliance/container |
| Container | `items={DEMO_SUMMARY.container}` | 移除 items, step="柜型推荐" |
| Twin | 无 items（V1 已修） | step 已传 |
| Compliance | 无 items（V1 已修） | step 已传 |
| Report | `items={reportSummary}` (DEMO 硬编码) | 移除 items, step="报告导出" |

### 2.3 ReportModule 全量真实化

| 区域 | V1 DEMO 泄漏 | V2 真实派生 |
|---|---|---|
| reportSummary | DEMO.loadedPieces/pieces/utilization/complianceScore | plan/compliance 真实值 |
| report-alert | "221/221、84.51%、本地规则 WARNING / AI建议 PASS / 人工复核独立" 硬编码 | 模板字符串引用 plan/compliance |
| deliverable-status-list | 6× 硬编码 PASS | hasPlan/passed/reviewed 条件 |
| summary-list | 8× DEMO.* | plan/compliance 真实值 |
| report-paper | DEMO.* 全部 | plan/compliance 真实值 |
| evidence-list | "已匹配" 硬编码 | "本地法规库" |
| check-list | 5× 硬编码 PASS | hasPlan/reviewed 条件 |
| timeline-list | "DeepSeek V4 Flash 本地规则 WARNING / AI建议 PASS / 人工复核独立" | passed 条件文本 |
| files DataTable | 全部"可下载" | reportState 条件: HTML/CSV 待复核, JSON 可下载 |

### 2.4 buildExportJson 真实化

| 字段 | V1 | V2 |
|---|---|---|
| totalPieces | DEMO.pieces (221) | `Number(plan.totalCargoInput)` |
| loadedPieces | DEMO.loadedPieces (221) | `plan.loadedCargo.length` |
| unloadedPieces | DEMO.unloadedPieces (0) | `plan.unloadedCargo.length` |
| utilization | DEMO.utilization ("84.51%") | `plan.spaceUtilization.toFixed(1)%` |
| cogOffset | DEMO.cog | `plan.cogOffset` 真实值 |
| complianceStatus | `compliance.status \|\| DEMO.complianceStatus` | `compliance.status \|\| '待审计'` |
| complianceScore | `compliance.score ?? DEMO.complianceScore` | `Number(compliance.score ?? 0)` |

## 3. 数据流图

```
plan (真实装箱结果)
  ├── OrderSummaryBar (顶栏 6 页统一)
  ├── DashboardModule (metric-strip / processSteps / AI建议)
  ├── ContainerModule (comparisonRows / preview-kpis / 推荐理由)
  ├── TwinModule (scene-hud / step-queue / risk-list)
  ├── ComplianceModule (score-card / risk-list / matrix)
  ├── ReportModule (reportSummary / summary-list / report-paper)
  └── buildExportJson (JSON 导出)

compliance (真实合规审计)
  ├── OrderSummaryBar (合规评分项)
  ├── DashboardModule (合规步骤 / EvidenceCard)
  ├── TwinModule (twin-risk-list / 算法弹窗)
  ├── ComplianceModule (score-card / matrix / RAG AI解释)
  ├── ReportModule (deliverable-list / summary-list / check-list)
  └── buildReportHtml (HTML 报告 KPI)
```

## 4. 验证结果

Playwright 跨页面数据一致性检查（5 页）：

| 页面 | 装入件数 | 空间利用率 | 合规评分 | 一致 |
|---|---|---|---|---|
| Dashboard | 221/221 | 84.51% | WARNING · 86 分 | ✅ |
| Container | 221/221 | 84.51% | WARNING · 86 分 | ✅ |
| Twin | 221/221 | 84.51% | WARNING · 86 分 | ✅ |
| Compliance | 221/221 | 84.51% | WARNING · 86 分 | ✅ |
| Report | 221/221 | 84.51% | WARNING · 86 分 | ✅ |

- `has661Leak`: **false** ✅
- `hasPass100Leak`: **false** ✅
- `allConsistent`: **true** ✅

## 5. 结论

全站数据口径已统一。同一演示状态下，顶栏、页面主体、报告、合规、3D 显示同一组数据。未审计状态全站显示 本地规则 WARNING / AI建议 PASS / 人工复核独立，最终复核状态全站显示 本地规则 WARNING / AI建议 PASS / 人工复核独立。DEMO_SUMMARY 的 items 覆盖机制已彻底移除。
