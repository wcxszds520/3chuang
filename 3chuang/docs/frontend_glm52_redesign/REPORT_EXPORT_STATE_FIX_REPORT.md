# 报告页状态收敛报告

> 模型：GLM-5.2 · 日期：2026-07-02 · 范围：ReportModule + buildExportJson + buildReportHtml

## 1. 问题诊断

V1 报告页存在状态矛盾与导出能力不真实：

- 顶部 deliverable-status-list 6 项全部硬编码 `PASS`，但页面中部又提示 "待审计"
- 顶部显示 `100/100` 与主体 `本地规则 WARNING / AI建议 PASS / 人工复核独立` 矛盾
- HTML / CSV / JSON 三类导出按钮全部显示 "可下载"，但实际无 plan 时点击会失败
- 报告状态机不清晰：草稿/待复核/可导出/导出失败 4 态没有显式表达
- buildExportJson 仍引用 DEMO.* 硬编码（221/221/84.51%/0/cog）

用户要求报告页明确 4 个状态：草稿预览、待复核、可导出、导出失败。HTML/CSV/JSON 必须与真实功能一致。

## 2. 修复方案

### 2.1 报告状态机

引入 `reportState` 显式状态机，所有 UI 文案与按钮可用性由状态机派生：

| 状态 | 触发条件 | 顶部提示 | 导出按钮 | 文件表格 |
|---|---|---|---|---|
| `draft` | 无 plan | "草稿预览（无装柜方案）" | 全部禁用 | 全部 "不可用" |
| `pending` | 有 plan，未通过合规或未人工复核 | "待复核" | JSON 可下载，HTML/CSV 禁用 | HTML/CSV "待复核"，JSON "可下载" |
| `exportable` | 有 plan 且 compliance passed 且 reviewed | "可导出" | 全部可下载 | 全部 "可下载" |
| `failed` | 导出过程抛错 | "导出失败，请重试" | 全部可重试 | 显示失败标记 |

派生逻辑：

```jsx
const hasPlan = plan && plan.loadedCargo && plan.loadedCargo.length > 0;
const passed = isCompliancePassed(compliance);
const reportState = !hasPlan ? 'draft'
                  : (!passed || !reviewed) ? 'pending'
                  : 'exportable';
```

### 2.2 导出能力与真实功能对齐

| 文件类型 | V1 | V2（与真实功能一致） |
|---|---|---|
| HTML 报告 | 始终 "可下载" | `reportState === 'exportable'` 才可下载，否则 "待复核" |
| CSV 装箱清单 | 始终 "可下载" | `reportState === 'exportable'` 才可下载，否则 "待复核" |
| JSON 全量数据 | 始终 "可下载" | `hasPlan` 即可下载（JSON 始终包含已生成数据，供技术核验） |

**关键约束**：顶部 100/100 与中部 "待审计" 不能同时出现。`report-alert` 与 `summary-list` 全部改为模板字符串引用 `plan`/`compliance`。

### 2.3 ReportModule 全量真实化（10 处 DEMO 泄漏修复）

| 区域 | V1 DEMO 泄漏 | V2 真实派生 |
|---|---|---|
| `reportSummary` 顶栏 | DEMO.loadedPieces/pieces/utilization/complianceScore | plan/compliance 真实值 |
| `report-alert` | "221/221、84.51%、本地规则 WARNING / AI建议 PASS / 人工复核独立" 硬编码 | 模板字符串引用真实值 |
| `deliverable-status-list` | 6× 硬编码 PASS | `hasPlan`/`passed`/`reviewed` 条件 |
| `summary-list` | 8× DEMO.* | plan/compliance 真实值 |
| `report-paper` 主报告 | DEMO.* 全部 | plan/compliance 真实值 |
| `evidence-list` | "已匹配" 硬编码 | "本地法规库" |
| `check-list` | 5× 硬编码 PASS | `hasPlan`/`reviewed` 条件 |
| `timeline-list` | "DeepSeek V4 Flash 本地规则 WARNING / AI建议 PASS / 人工复核独立" | `passed` 条件文本 |
| `files DataTable` | 全部 "可下载" | `reportState` 条件：HTML/CSV 待复核，JSON 可下载 |
| `reportState` 状态机 | 无显式状态 | draft/pending/exportable/failed 四态 |

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

## 3. 当前演示态验证

当前演示场景：后端 500，前端独立模式，`plan` 已生成（221/221, 84.51%），`compliance` 本地规则 WARNING / AI建议 PASS / 人工复核独立，`reviewed=false`。

| 验证项 | V1 | V2 |
|---|---|---|
| 顶部状态 | 100/100 PASS | "待复核" |
| 顶部装入件数 | 221/221 | 221/221 |
| 顶部利用率 | 84.51% | 84.51% |
| deliverable-status-list | 6× PASS | 6× 条件（含 "待复核"） |
| files DataTable HTML | "可下载" | "待复核" |
| files DataTable CSV | "可下载" | "待复核" |
| files DataTable JSON | "可下载" | "可下载" |
| 报告状态 | 矛盾 | 一致：`pending` |

## 4. Playwright 验证

test-results-v2.json `reportTests`：

```json
"reportTests": {
  "preview": { "passed": true, "modalVisible": true },
  "download": {
    "jsonAll":   { "passed": true, "buttonExists": true },
    "fileTable": { "passed": true, "rows": 4, "disabledButtons": 2 }
  }
}
```

- `preview.passed: true` ✅ 草稿预览模态可打开
- `jsonAll.passed: true` ✅ JSON 全量导出按钮存在且可点击
- `fileTable.rows: 4` ✅ 4 行文件（HTML/CSV/JSON + 标题行）
- `fileTable.disabledButtons: 2` ✅ HTML/CSV 在 pending 态被禁用，JSON 可用

## 5. 结论

报告页已收敛为 4 个清晰状态（草稿预览/待复核/可导出/导出失败）。HTML/CSV/JSON 三类导出能力与真实功能一致：未复核时 HTML/CSV 明确禁用并显示 "待复核"，JSON 始终可用以供技术核验。顶部 100/100 与中部 "待审计" 的矛盾已彻底消除。所有 DEMO.* 硬编码已替换为 plan/compliance 真实派生。
