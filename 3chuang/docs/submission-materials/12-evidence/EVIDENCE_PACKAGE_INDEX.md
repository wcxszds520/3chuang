# 证据包索引

> 生成时间：2026-07-11
> 文件用途：分类索引所有证据材料，覆盖源代码、测试、API、数据库、截图、导出文件、运行日志、文档、图表。
> 说明：本索引基于仓库中已确认存在的目录与文件结构整理，目标态证据待功能实现后补充。

---

## 一、源代码（按模块）

| 模块 | 路径 | 说明 | 当前态 |
|------|------|------|--------|
| Web 前端 | 项目根/web 或前端工程 | React18 + Vite + Three.js | 已实现 |
| 后端服务 | 项目根/backend 或 server | Node + Express + MySQL | 已实现 |
| 装箱算法 | 后端工程内 algorithms 目录 | FastBlock / Realistic4D v34.7 / Orchestrator / LPE | 已实现 |
| 合规模块 | 后端工程内 compliance 目录 | 三层证据链 / 7 红线 / RAG | 已实现 |
| 法规 JSON | 后端工程内 regulations 目录 | 4 法规 17 sections | 已实现 |
| 微信小程序 | 项目根/miniprogram 或小程序工程 | 微信原生框架 | 部分实现 |
| AI 服务集成 | 后端工程内 ai 或 services 目录 | DeepSeek/Qwen-VL/TTS/Tavily | 已实现 |

> 注：具体源码路径需在最终提交时按实际工程结构核对填充。

---

## 二、测试

| 测试类型 | 数量 | 说明 | 当前态 |
|----------|------|------|--------|
| 后端测试 | 811+ | 单元+集成测试 | 已实现 |
| Web 测试 | 90+ | 前端组件测试 | 已实现 |
| E2E 测试 | 多套 | Playwright 端到端 | 已实现 |
| VLM 稳定性测试 | 多轮 | 视觉语言模型稳定性 | 已实现 |
| RAG 检索测试 | 多轮 | 法规检索命中 | 已实现 |

### 测试证据文件

| 文件 | 路径 | 说明 |
|------|------|------|
| 后端 API 测试结果 | docs/final_goal/backend-api-results.json | 后端真实 API 测试 |
| E2E 测试结果 | docs/final_goal/e2e-results.json | Playwright E2E |
| 后端 API 快照 | docs/final_product_integration/backend-real-api-results.json | 后端 API 结果 |
| Playwright E2E | docs/final_product_integration/playwright-e2e-results.json | E2E 结果 |
| VLM 稳定性 | docs/advanced_optimization/vlm-tests/vlm-stability-results.json | VLM 测试 |
| RAG 检查 | docs/advanced_optimization/rag-check-results.json | RAG 检索检查 |

---

## 三、API（端点清单 + 响应样本）

### 端点清单

| 端点 | 方法 | 功能 | 当前态 |
|------|------|------|--------|
| /cargo | GET/POST | 货物 CRUD | 已实现 |
| /container | GET | 柜型列表 | 已实现 |
| /packing | POST | 装箱方案生成 | 已实现 |
| /compliance | POST | 合规预审 | 已实现 |
| /report | GET | 报告数据 | 已实现 |
| /ai/explain | POST | AI 解释（DeepSeek） | 已实现 |
| /ai/vlm | POST | 图像识别（Qwen-VL） | 已实现 |
| /ai/tts | POST | 语音播报（火山 TTS） | 已实现 |
| /ai/regulation-search | POST | 联网法规检索（Tavily） | 依赖 API Key |
| /report/pdf | GET | 后端 PDF 导出 | 目标态 |

### 响应样本

| 样本 | 路径 | 说明 |
|------|------|------|
| API 契约快照 | docs/codex/API_CONTRACT_SNAPSHOT.md | API 契约文档 |
| 演示数据 JSON | docs/advanced_open_design_web/downloads/甬柜易算演示数据-NB2026-DEMO-01.json | 演示订单数据 |
| 演示数据 JSON | docs/final_product_integration/downloads/甬柜易算演示数据-NB2026-DEMO-01.json | 演示订单数据副本 |

---

## 四、数据库（建表脚本 + 迁移）

| 项目 | 说明 | 当前态 |
|------|------|--------|
| MySQL 4 表 | cargo / container_type / packing_plan / user | 已实现 |
| 建表脚本 | 后端工程内 SQL 或 migration 目录 | 需最终核对路径 |
| 迁移脚本 | 后端工程内 migration 目录 | 需最终核对路径 |

> 注：建表脚本与迁移文件具体路径需在后端工程目录中确认。

---

## 五、截图（按页面和状态）

### 截图目录

| 目录 | 路径 | 说明 |
|------|------|------|
| 高级设计截图 | docs/advanced_open_design_web/screenshots/ | 3D/前后对比/交互弹窗 |
| 高级优化截图 | docs/advanced_optimization/screenshots/ | 6 页面 before/after |
| 设计审计截图 | docs/design_audit_current/ | 6 页面 1280/1672 双分辨率 |
| 产品重设计截图 | docs/design_reviews/product-redesign/screenshots/ | 6 页面双分辨率 |
| 最终目标截图 | docs/final_goal/screenshots/ | 6 页面 final 状态 |
| 最终集成截图 | docs/final_product_integration/screenshots/ | 全流程 final 状态 |
| GLM52 重设计截图 | docs/frontend_glm52_redesign/screenshots/ | 6 页面 before/after v1/v2 |

### 建议补充截图

按 `12-evidence/SCREENSHOT_EVIDENCE_PLAN.md` 清单补拍 S01-S48，统一存放于 `12-evidence/screenshots/`。

---

## 六、导出文件（HTML/CSV/JSON 样本）

| 文件 | 路径 | 说明 |
|------|------|------|
| HTML 报告 | docs/final_product_integration/downloads/甬柜易算装柜与合规报告-NB2026-DEMO-01.html | 演示订单报告 |
| 法规证据 CSV | docs/final_product_integration/downloads/法规证据清单-NB2026-DEMO-01.csv | 法规证据清单 |
| 演示数据 JSON | docs/final_product_integration/downloads/甬柜易算演示数据-NB2026-DEMO-01.json | 演示订单数据 |
| 货物导入 CSV | docs/final_product_integration/test-assets/demo-cargo-import.csv | 货物导入样本 |
| 货物导入 CSV | docs/final_goal/sample-cargo-import.csv | 货物导入样本 |

---

## 七、运行日志

| 日志 | 路径 | 说明 |
|------|------|------|
| 前端交互结果 | docs/advanced_open_design_web/frontend-interaction-results.json | 交互测试日志 |
| 视觉 QA 结果 | docs/advanced_open_design_web/visual-qa-results.json | 视觉 QA |
| 视觉 QA 结果 | docs/advanced_optimization/visual-qa-results.json | 视觉 QA |
| 视觉 QA 结果 | docs/frontend_glm52_redesign/screenshots/visual-ga-results.json | 视觉 QA |
| 数据一致性 | docs/frontend_glm52_redesign/screenshots/data-consistency-v2.json | 数据状态一致性 |
| 测试结果 | docs/frontend_glm52_redesign/screenshots/test-results-v2.json | 测试结果 |
| RAG 缓存 | docs/advanced_optimization/rag-cache/ | RAG 检索缓存 15 文件 |
| RAG 缓存来源 | docs/advanced_optimization/rag-cache/CACHE_SOURCES.md | 缓存来源说明 |
| VLM 在线资源 | docs/final_product_integration/test-assets/vlm-online/ | VLM 测试图片与标注 |
| VLM 在线来源 | docs/final_product_integration/test-assets/vlm-online/SOURCES.md | 来源说明 |

---

## 八、文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 项目事实 | docs/submission-materials/01-project-facts/ | 项目主事实/特征矩阵/矛盾点 |
| NotebookLM 源 | docs/notebooklm_sources/ | 10 篇 NotebookLM 上传文档 |
| Codex 文档 | docs/codex/ | API 契约/演示数据/验收/3D 规格 |
| 设计系统 | docs/advanced_open_design_web/YONGGUI_WEB_DESIGN_SYSTEM.md | Web 设计系统 |
| Figma 规范 | docs/advanced_open_design_web/figma/YONGGUI_FIGMA_HANDOFF_SPEC.md | Figma 交付规范 |
| Canva 规划 | docs/advanced_open_design_web/canva/CANVA_WEB_ASSET_PLAN.md | Canva 资产规划 |
| 最终验收 | docs/codex/FINAL_ACCEPTANCE.md | 最终验收文档 |
| 阶段3验收 | docs/codex/STAGE3_ACCEPTANCE.md | 阶段3验收 |
| 阶段3限制 | docs/codex/STAGE3_LIMITATIONS.md | 阶段3限制说明 |
| 提交材料 | docs/submission-materials/ | 本次生成的全部提交材料 |

---

## 九、图表

| 图表 | 路径 | 说明 |
|------|------|------|
| 12 个 Mermaid 图源 | docs/submission-materials/11-diagrams/*.md | 系统架构/流程/状态机等 |
| 图像生成提示词 | docs/submission-materials/11-diagrams/DIAGRAM_IMAGE_PROMPTS.md | 逐图 AI 生成提示词 |

---

## 十、待补充证据（目标态）

| 证据 | 关联目标态 | 说明 |
|------|------------|------|
| 8-12 SKU 截图 | 演示数据集扩充 | 需扩充后补拍 |
| 连续三次全装入日志 | 算法验证 | 需算法验证后导出 |
| 16× 倍速截图 | 3D 倍速增强 | 需扩展档位后截取 |
| 法规 PDF 联动截图 | PDF 原文联动 | 需实现后截取 |
| 小程序 export 截图 | export 页面 | 需实现后截取 |
| 后端 PDF 文件 | 后端 PDF 导出 | 需实现后导出 |
| Tavily 稳定性测试报告 | 联网检索稳定 | 需配置 Key 后测试 |
| LPE ≥70% 截图 | 利用率提升 | 需优化后截取 |
| 统一设计系统截图 | 主色统一 | 需对齐后截取 |
