# What Changed

## 代码

- `web-dashboard/src/aiCompliance.js`
  - 兼容 DeepSeek / 后端合规返回中的 `overallStatus`、`complianceStatus`。
  - 从 reportTable 衍生状态，避免真实 PASS 被前端误判成 WARNING。

- `web-dashboard/src/App.jsx`
  - 新增 `isCompliancePassed`。
  - 报告页和合规页 reviewed 口径统一为 本地规则 WARNING / AI建议 PASS / 人工复核独立。
  - RAG 混合检索失败文案改为真实降级说明。
  - 3D 默认相机和视角 target 优化。
  - 算法依据弹窗当前作业单元统一为 SKU-C08。

- `web-dashboard/src/restore.css`
  - 货物页表单、VLM 卡密度优化。
  - 合规 100 分圆环改为绿色 PASS 语义。
  - 3D HUD、约束条高度压缩，减少画布遮挡。

## 工具

- 新增 `tools/advanced_open_design_web_qa.mjs`
  - 六页 after 截图
  - 3D 多视角截图
  - before/after/contact sheet 生成

- 新增 `tools/advanced_open_design_web_interaction_check.mjs`
  - 核心导航、弹窗、3D、法规证据、报告预览、JSON 下载 smoke。

## 文档

新增高级 Web 优化交付文档，集中在 `docs/advanced_open_design_web/`。
