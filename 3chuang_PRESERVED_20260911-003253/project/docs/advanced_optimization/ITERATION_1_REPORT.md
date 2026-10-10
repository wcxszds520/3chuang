# Iteration 1 Report - Diagnose / Plan

生成时间：2026-06-30

## A. Diagnose 诊断

本轮先阅读了以下代码和证据：

- `backend/services/VLMCargoService.js`
- `backend/routes/vlm.js`
- `backend/services/RegulationRAGService.js`
- `backend/routes/compliance.js`
- `tools/final_product_real_api_check.mjs`
- `tools/final_product_playwright_e2e.mjs`
- `web-dashboard/src/api.js`
- `web-dashboard/src/vlmCargo.js`
- `web-dashboard/src/aiCompliance.js`
- `web-dashboard/src/App.jsx`
- `docs/final_product_integration/*`

当前真实基线保持：

- 订单：NB2026-DEMO-01
- 航线：宁波港 -> 汉堡港
- 柜型：40HQ
- 输入总件数：221
- 已装入：221
- 未装入：0 件
- 空间利用率：84.51%
- 合规：本地规则 WARNING / AI建议 PASS / 人工复核独立
- DeepSeek：deepseek-v4-flash
- VLM：Qwen/Qwen3-VL-32B-Instruct

## 当前主要问题

1. VLM 服务把“模型不可用/调用失败/返回空”统一成 `data:null` 和 `message='VLM unavailable, manual input required'`，语义过粗。
2. VLM 后端直连报告显示 `pallet_wood.jpg` 失败，但前端 E2E 报告又显示同一图片上传通过，口径矛盾。
3. VLM 只有单次调用，30s 超时后直接失败；对外部模型偶发慢响应缺少有限重试。
4. VLM JSON 解析只接受严格 JSON，模型如果返回 JSON 前后有解释文字会失败。
5. 前端 VLM 失败态没有显示后端真实失败原因，只能看到“识别失败，请手动填写”。
6. 本地 RAG 稳定，但没有独立的联网增强层；目前前端不能展示“联网参考不可用/已用本地法规库”。
7. `TAVILY_API_KEY` 当前未检测到，联网 RAG 不能假成功，必须可解释降级。
8. 3D 页面已经有低多边形叉车/工人/path 的基础实现，但缺少高级优化阶段的截图证据和专项报告。
9. 6 页视觉基线已有，但没有 advanced before/after contact sheet。
10. 最终材料需要把“真实边界”讲清楚：本地法规库是主证据，联网参考是增强；AI 解释不替代规则；VLM 失败不展示成功。

## Top 10 优化点

| 优先级 | 优化点 | 录屏影响 | 真实性风险 | 实现成本 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 1 | VLM 路由返回结构化失败原因与真实 attempt 记录 | 高 | 高 | 中 | 本轮必做 |
| 2 | VLM 服务增加最多 2 次重试与 45s 可配置超时 | 高 | 中 | 中 | 本轮必做 |
| 3 | VLM JSON 解析增加非编造式修复解析 | 高 | 中 | 中 | 本轮必做 |
| 4 | VLM 测试脚本改为每图 2 次后端直连并统一结论 | 高 | 高 | 中 | 本轮必做 |
| 5 | 前端 VLM 失败态显示真实错误摘要 | 中 | 高 | 低 | 本轮必做 |
| 6 | 新增 WebRAGService + hybrid-search 可解释降级 | 高 | 中 | 中 | 本轮做基础版 |
| 7 | 前端合规页区分本地证据、联网参考、AI 解释 | 高 | 中 | 中 | 本轮做基础版 |
| 8 | 报告导出增加联网参考字段但不夸大 | 中 | 中 | 中 | 第二步做 |
| 9 | 3D 截图 QA 与专项报告 | 高 | 低 | 中 | 先验证再微调 |
| 10 | advanced contact sheet 与最终录屏材料 | 中 | 低 | 中 | 验证后输出 |

## B. Plan 计划

本轮选择最有价值且最小风险的改动：

### 改动 1：VLM 稳定性与语义修复

- 影响页面：货物录入页 VLM 拍照录货。
- 影响接口：`POST /api/vlm/recognize-cargo`、`GET /api/vlm/status`。
- 具体做法：
  - 服务层增加 `recognizeCargoWithAttempts` 或等价逻辑，最多 2 次真实调用。
  - 超时默认从 `VLM_TIMEOUT_MS` 读取，建议 `.env.example` 写 `45000` 空占位说明，不写密钥。
  - JSON 解析支持从文本中提取第一个 JSON 对象；解析失败仍失败，不编造字段。
  - 路由失败时返回 `data:null` 但附带 `errorCode`、`attempts`、`model`，前端可展示真实失败。
- 风险：外部 VLM 调用耗时增加；通过最多 2 次、45s 上限控制。
- 验收方式：至少 1 张图片连续 2 次后端成功，至少 1 张前端上传成功；失败图片不展示成功。
- 回滚方式：还原 `VLMCargoService.js`、`routes/vlm.js`、`vlmCargo.js`、`App.jsx` VLM 相关小改动。

### 改动 2：VLM 专项测试脚本

- 影响页面：无直接页面影响。
- 影响接口：真实调用 `/api/vlm/recognize-cargo`。
- 具体做法：
  - 新增或扩展 advanced VLM 测试脚本，写入 `docs/advanced_optimization/vlm-tests/`。
  - 每张图后端直接调用 2 次，记录耗时、字段完整度、失败原因和推荐等级。
  - 输出 `VLM_STABILITY_REPAIR_REPORT.md`。
- 风险：需要真实外部服务，可能因 key/额度/网络失败。
- 验收方式：报告不再出现 2/5、4/5 的矛盾口径。
- 回滚方式：删除 advanced 测试脚本和报告，不影响产品逻辑。

### 改动 3：联网 RAG 可解释增强基础版

- 影响页面：合规预审页、报告导出页。
- 影响接口：新增 `POST /api/compliance/web-search`、`POST /api/compliance/hybrid-search`。
- 具体做法：
  - 新增 `backend/services/WebRAGService.js`，不改坏 `RegulationRAGService.js`。
  - 若 `TAVILY_API_KEY` 不存在，返回 `web_available=false` 和真实原因。
  - 本地 RAG 结果永远独立返回，联网失败不影响本地检索。
  - 前端展示“本地法规证据库”和“联网参考”分层。
- 风险：当前没有检测到 Tavily key，联网部分可能只能进入可解释降级。
- 验收方式：本地 RAG 9/9 继续通过；联网不可用时不显示联网成功。
- 回滚方式：移除新增 WebRAGService 和新增路由，不影响本地 RAG。

### 改动 4：3D 与 UI 截图证据

- 影响页面：3D 作业孪生、6 个主页面。
- 影响接口：无。
- 具体做法：
  - 保持现有 Three.js 数据结构。
  - 捕获 before / after 截图和 contact sheet。
  - 若截图显示叉车/工人/路径不明显，再做局部视觉强化。
- 风险：截图和 WebGL 性能警告需要区分真实错误与浏览器性能提示。
- 验收方式：canvas 非空，叉车/工人/路径/目标位可见，视角切换可用。
- 回滚方式：还原 `App.jsx`/CSS 局部视觉改动。

## C. Implement 状态

- 当前阶段：尚未开始代码改动。
- 下一步：先做 VLM 服务和路由最小修复。

## D. Test 计划

本轮完成实现后执行：

1. `cd web-dashboard && npm run build`
2. 启动后端并运行真实 API 检查。
3. 运行 advanced VLM 2 次/图专项测试。
4. 运行本地 RAG + hybrid-search 检查。
5. 运行 Playwright 截图和 E2E。
6. 输出 before / after contact sheet。

## E. Visual QA 计划

- 页面截图：dashboard、cargo、container、twin、compliance、report。
- 重点检查：真实数据条、VLM 状态卡、RAG 分层、3D 作业现场感、报告下载边界。

## F. 初始自评分

| 项目 | 分数 | 说明 |
| --- | ---: | --- |
| VLM 稳定性 | 7.2 | 可用但报告矛盾、重试不足 |
| RAG 可信度 | 7.8 | 本地 RAG 稳定，联网增强未实现 |
| 3D 现场感 | 8.4 | 已有叉车/工人基础，但需截图确认与 polish |
| UI 高级感 | 8.2 | 浅色物流 SaaS 已成型，advanced 证据不足 |
| 数据一致性 | 9.4 | 221/221、84.51%、本地规则 WARNING / AI建议 PASS / 人工复核独立 已统一 |
| 录屏稳定性 | 8.5 | 主链路通过，VLM 图选择需稳定 |
| 真实性风险 | 8.3 | 失败不假成功，但 VLM 失败语义需更清晰 |
| 性能 | 8.3 | WebGL 有 readPixels warning，不是阻断 |
| 评委理解度 | 8.1 | 3D 和 RAG 叙事还可更清楚 |
| 整体完成度 | 8.3 | 可录屏，仍可高级优化 |

## G. Decide 决策

- 当前总分约：8.25 / 10。
- 未达到 9.0，进入第 1 轮实现。
- 优先修复 VLM 与 RAG 真实性边界，再截图验证 3D/UI。


## Iteration 1 - Test / Screenshot / Score Update

### 实现结果

- VLM 服务、路由、前端失败态已修复。
- Web RAG 服务、缓存快照、hybrid-search 和前端合规页展示已实现。
- Playwright 截图 QA、advanced VLM/RAG 检查脚本已实现。

### 测试结果

- `npm run build`：PASS。
- `node tools/final_product_real_api_check.mjs`：27/27。
- `node tools/advanced_vlm_stability_check.mjs`：5/5，稳定 4。
- `node tools/advanced_rag_check.mjs`：本地 9/9，hybrid 9/9。
- `node tools/final_product_playwright_e2e.mjs`：49/49。
- 截图：docs/advanced_optimization/screenshots/advanced-contact-sheet.png。

### 更新后自评分

| 项目 | 分数 | 说明 |
| --- | ---: | --- |
| VLM 稳定性 | 9.1 | 5/5 至少一次成功，4 张连续两次稳定 |
| RAG 可信度 | 8.5 | 本地和缓存参考通过；无 Tavily 实时 key |
| 3D 现场感 | 9.0 | 多视角截图和算法弹窗完成 |
| UI 高级感 | 8.9 | 6 页截图和 contact sheet 完成 |
| 数据一致性 | 9.5 | 真实数据口径未变 |
| 录屏稳定性 | 9.0 | E2E 49/49 |
| 真实性风险 | 9.2 | 失败态和缓存边界更清楚 |
| 性能 | 8.7 | 未引入重后处理 |
| 评委理解度 | 9.0 | 3D/RAG/VLM 边界更清楚 |
| 整体完成度 | 9.0 | 可进入录屏，但保留 Tavily note |

### Decide

总分已达到约 9.0，但由于缺少 Tavily 实时 key，本轮停止迭代，最终结论保守为 `READY_WITH_NOTES`。


## Iteration 1 - Test / Screenshot / Score Update

### 实现结果

- VLM 服务、路由、前端失败态已修复。
- Web RAG 服务、缓存快照、hybrid-search 和前端合规页展示已实现。
- Playwright 截图 QA、advanced VLM/RAG 检查脚本已实现。

### 测试结果

- `npm run build`：PASS。
- `node tools/final_product_real_api_check.mjs`：27/27。
- `node tools/advanced_vlm_stability_check.mjs`：5/5，稳定 4。
- `node tools/advanced_rag_check.mjs`：本地 9/9，hybrid 9/9。
- `node tools/final_product_playwright_e2e.mjs`：49/49。
- 截图：docs/advanced_optimization/screenshots/advanced-contact-sheet.png。

### 更新后自评分

| 项目 | 分数 | 说明 |
| --- | ---: | --- |
| VLM 稳定性 | 9.1 | 5/5 至少一次成功，4 张连续两次稳定 |
| RAG 可信度 | 8.5 | 本地和缓存参考通过；无 Tavily 实时 key |
| 3D 现场感 | 9.0 | 多视角截图和算法弹窗完成 |
| UI 高级感 | 8.9 | 6 页截图和 contact sheet 完成 |
| 数据一致性 | 9.5 | 真实数据口径未变 |
| 录屏稳定性 | 9.0 | E2E 49/49 |
| 真实性风险 | 9.2 | 失败态和缓存边界更清楚 |
| 性能 | 8.7 | 未引入重后处理 |
| 评委理解度 | 9.0 | 3D/RAG/VLM 边界更清楚 |
| 整体完成度 | 9.0 | 可进入录屏，但保留 Tavily note |

### Decide

总分已达到约 9.0，但由于缺少 Tavily 实时 key，本轮停止迭代，最终结论保守为 `READY_WITH_NOTES`。
