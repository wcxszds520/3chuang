# 甬柜易算 Web 前端与 3D 作业孪生高级视觉重构报告

> 阶段：第三阶段页面重构总结  
> 模型：GLM-5.2  
> 日期：2026-07-02  
> 范围：`web-dashboard/src/App.jsx` + `designTokens.css` + `index.html`  
> 红线遵守：未重写装箱算法、未改数据库结构、未泄露 API Key、未读取 .env、未用静态截图替代真实 3D、未破坏真实 API 链路

---

## 1. 重构总览

本轮重构聚焦"假成功消除 + 真实数据绑定 + 视觉层级澄清"，把 6 个页面从"DEMO 静态展示"升级为"真实装柜决策工作台"。所有 KPI、HUD、步骤队列、风险列表、合规分均改为从 `plan` / `compliance` 真实派生，未审计时不展示 本地规则 WARNING / AI建议 PASS / 人工复核独立。

### 1.1 已完成文件改动

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `web-dashboard/src/designTokens.css` | 新增 | YCC v2 设计 token：60+ CSS 变量、`.yg-*` 组件类、prefers-reduced-motion、:fullscreen HUD 缩放 |
| `web-dashboard/index.html` | 修改 | Space Grotesk 字体加载、标题更新 |
| `web-dashboard/src/main.jsx` | 修改 | `designTokens.css` 引入顺序在 App.css 之前 |
| `web-dashboard/src/App.jsx` | 修改 | 12+ 处假成功修复 + 6 页真实数据绑定 |

### 1.2 假成功修复清单（核心）

| 编号 | 位置 | 修复前（假成功） | 修复后（真实派生） |
|---|---|---|---|
| I1 | `ReportModule` reviewed | `isCompliancePassed \|\| DEMO.complianceStatus==='PASS' \|\| size>=2` (短路恒真) | `isCompliancePassed(compliance) && reviewedWarnings.has('manual-review')` |
| I1b | `ComplianceModule` reviewed | 同上短路 | 同上真实判定 |
| I3 | `buildOperationalComplianceRows` | 硬编码 6× PASS | 从 `compliance.rows` 优先派生，回退 `plan.cogOffset`/`constraintMeta` |
| I4 | `DEMO_AI_SUGGESTIONS` 行2 | 硬编码 "DeepSeek V4 Flash 已完成审计，本地规则 WARNING / AI建议 PASS / 人工复核独立" | `buildAiSuggestions(plan, compliance)` 动态生成，未审计显示 pending |
| I5/I10 | `DashboardModule` processSteps + metric-strip | DEMO.utilization / loadedPieces / cog / "合规已通过 本地规则 WARNING / AI建议 PASS / 人工复核独立" | 从 `plan.spaceUtilization` / `plan.loadedCargo.length` / `plan.cogOffset` / `compliance.status` 派生 |
| I6/T8 | `TwinModule` step-queue-r2 | 5 行硬编码 SKU-A01/B12/C08/D22/E17 | 从 `plan.loadedCargo` 按 SKU 聚合，标记已完成/进行中/待执行 |
| I8 | `buildReportHtml` KPI | DEMO.loadedPieces/pieces/utilization/cog/complianceScore | `plan.loadedCargo.length` / `plan.totalCargoInput` / `plan.spaceUtilization` / `plan.cogOffset` / `compliance.score` |
| I9 | `ContainerModule` comparisonRows | 40HQ 硬编码 PASS | 仅对真实生成方案的柜型显示真实合规，其余"待评估" |
| T1 | `TwinModule` scene-hud | 硬编码 42% / SKU-C08 / 叉车推入 / PASS | 绑定 `progress` / `currentItem` / `currentCraft` / `compliance` |
| T11 | `TwinModule` layer-groups 按钮 | 无 onClick | 接入 `visualMode` / `setVisualMode`，点击聚焦/取消 |
| C1 | `ComplianceModule` score-card | DEMO.complianceScore=100 / PASS | `compliance.score` / `compliance.status`，未审计显示 pending |
| C2 | `ComplianceModule` risk-status-list | 4× 硬编码 PASS | `buildOperationalComplianceRows(reviewedWarnings, plan, compliance)` 真实派生 |

### 1.3 OrderSummaryBar 真实化

| 模块 | 修复前 | 修复后 |
|---|---|---|
| Dashboard | `items={DEMO_SUMMARY.dashboard}` 强制 DEMO 值 | 移除 items，使用 OrderSummaryBar 默认从 plan/compliance 派生 |
| Twin | `compliance={{ score: DEMO.complianceScore, status: DEMO.complianceStatus }}` | `compliance={compliance}` 真实 prop |
| Compliance | 同上 fake compliance | `compliance={compliance}` 真实 prop |
| Container | 同上 fake compliance | `compliance={compliance}` 真实 prop，新增 plan/compliance prop 传递 |

---

## 2. 各页重构要点

### 页面 1：工作台首页
- processSteps 4 步状态从真实 plan/compliance 派生：未生成方案时步骤 2/3/4 显示 pending，合规未通过时步骤 3 显示 warning。
- metric-strip 5 项 KPI 全部真实：空间利用率、装入件数、重心偏移、合规状态、未装入尾货。
- AI 辅助建议改为 `buildAiSuggestions(plan, compliance)` 动态生成，未审计不展示 本地规则 WARNING / AI建议 PASS / 人工复核独立。
- 风险摘要改为 `buildOperationalComplianceRows(new Set(), plan, compliance)` 真实派生。
- EvidenceCard 状态根据 `passed` 动态显示 PASS/WARNING。

### 页面 2：货物录入 / VLM
- 该页主要交互（CSV 导入、手动录入、VLM 上传、识别结果、人工确认）此前已是真实链路，本轮未破坏。
- VLM 失败状态保持真实显示，未改为自动成功。

### 页面 3：柜型推荐
- 推荐柜型从 `plan.containerInfo` 真实读取，未生成方案时回退 selectedContainerType。
- comparisonRows 合规列：仅对真实生成方案的柜型显示真实合规状态，其余标记"待评估"。
- preview-kpis 合规状态从 `compliance` 真实派生，未审计显示"待审计"。
- AI 推荐理由 5 条全部改为根据 hasPlan/passed 动态生成。
- 推荐解释弹窗 KPI 改为真实 plan 值。

### 页面 4：3D 作业孪生（视觉高潮页）
- **保留真实 Three.js 渲染**（PackingScene 组件未改）。
- scene-hud 5 项全部绑定真实值：装载进度（progressPct）、当前货物（currentItemName）、作业动作（currentMethod）、LIFO（lifoPass）、重心（cogText）。
- constraint-hit-strip 4 项从 `plan.constraintMeta` 派生，FAIL/WARNING 真实显示。
- twin-annotations 当前货物/目标位绑定 currentItem。
- 当前作业指令卡（instruction-card-r2）全部绑定 stepNumber/currentItem/currentCraft/currentTarget。
- 步骤队列从 `plan.loadedCargo` 按 SKU 聚合，根据 visibleCount 标记已完成/进行中/待执行。
- 图层筛选 8 个按钮接入 `visualMode`/`setVisualMode`，点击聚焦/取消，有 active 状态。
- twin-risk-list 4 项从真实 compliance/cog/lifo 派生。
- 算法依据弹窗从真实 plan 派生。

### 页面 5：合规预审 / RAG
- 合规分数卡从 `compliance.score`/`compliance.status` 真实派生，tone 随 passed/warning/pending 变化。
- risk-status-list 从 `buildOperationalComplianceRows` 真实派生。
- 合规检查矩阵调用 `buildOperationalComplianceRows(reviewedWarnings, plan, compliance)` 传入 plan/compliance。
- 人工复核文案中 本地规则 WARNING / AI建议 PASS / 人工复核独立 改为 `PASS / ${realScore}`。
- RAG 检索区分本地法规库与联网参考，联网失败真实显示（未假造联网成功）。

### 页面 6：报告导出
- buildReportHtml KPI 全部从真实 plan/compliance 派生（已在上一轮完成）。
- reviewed 标记需 `isCompliancePassed(compliance) && reviewedWarnings.has('manual-review')`。
- 报告 HTML 中合规状态文本使用 `.pass`/`.fail` CSS 类着色。

---

## 3. 设计系统应用

- `designTokens.css` 定义 YCC v2 token：港口蓝 `#0F5CFF`、A/B/C 分区色、HUD 深色玻璃、Space Grotesk display + Inter body。
- `.yg-*` 前缀组件类与现有 `.surface`/`.primary-action` 共存，不破坏既有样式。
- `prefers-reduced-motion` 降级已内置。
- `:fullscreen` HUD 缩放已内置。

---

## 4. 未做 / 风险说明

| 项 | 说明 |
|---|---|
| 3D 增强（T5 目标位高亮、T6 未装入可视化、T9 默认相机） | 本轮聚焦假成功消除与真实数据绑定，3D scene 内部增强未做（避免破坏 Three.js 数据结构红线） |
| ZoneTag 组件 | 设计系统已定义 `.yg-zone-tag`，但未在 6 页全量替换（本轮优先级在假成功修复） |
| before 截图 | 因重构直接在工作树进行，before 截图未单独采集，视觉问题清单见 01_FRONTEND_AUDIT.md V1-V10 |
| 后端 500 错误 | 前端独立运行时后端 API 返回 500，属预期（前端降级显示"待审计"而非崩溃） |

---

## 5. 结论

本轮重构把 6 个页面从"DEMO 静态展示 + 假成功短路"升级为"真实 plan/compliance 驱动的装柜决策工作台"。所有假成功风险点（I1/I3/I4/I5/I6/I8/I9/I10/T1/T8/T11/C1/C2）均已修复并通过 Playwright 验证。3D 作业孪生页保留真实 Three.js 渲染，HUD/步骤队列/风险列表全部真实绑定。
