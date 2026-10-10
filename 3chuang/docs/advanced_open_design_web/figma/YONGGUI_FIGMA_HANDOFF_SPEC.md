# Yonggui Figma Handoff Spec

本轮未直接写入 Figma 文件，原因是任务重点在真实 Web 前端与截图 QA，且当前代码已形成可运行视觉基线。以下为可交给设计师或后续 Figma 同步的结构化 handoff。

## 1. Frame 建议

- 甬柜易算 / Dashboard / 1672x941
- 甬柜易算 / Cargo Input / 1672x941
- 甬柜易算 / Container Recommendation / 1672x941
- 甬柜易算 / 3D Twin / 1672x941
- 甬柜易算 / Compliance Review / 1672x941
- 甬柜易算 / Report Export / 1672x941

## 2. Tokens

使用 `docs/advanced_open_design_web/YONGGUI_WEB_DESIGN_SYSTEM.md` 中的颜色、字号、间距、圆角、阴影。

## 3. Components

- AppShell
- Sidebar
- TopBar
- PageHeader
- OrderSummaryBar
- MetricCard
- StatusTag
- RiskBadge
- DataTable
- FormPanel
- AiSuggestionPanel
- PlanPreviewCard
- ThreeTwinViewer
- ComplianceMatrix
- EvidenceCard
- ReportPreview
- ExportFileTable

## 4. 截图参考

以 `docs/advanced_open_design_web/screenshots/after-contact-sheet.png` 为整体视觉索引，各页面 after 图作为 Figma 重建参考。

结论：可进入 Figma 组件化复刻，但不建议在未完成真实能力复测前做大规模视觉重构。
