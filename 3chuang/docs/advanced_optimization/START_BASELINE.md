# 甬柜易算 Advanced Real Demo Optimization - START BASELINE

生成时间：2026-06-30

## 当前分支

- 当前分支：`advanced-real-demo-optimization`
- 来源分支：`final-real-product-integration`
- 说明：当前工作树已有大量未提交改动，本轮在新分支上延续现状，不回滚既有改动。

## 当前未提交改动

`git status --short --branch` 显示当前工作树包含：

- 已修改：`backend/.env.example`、`backend/config/constants.js`、`backend/routes/index.js`、`backend/routes/packing.js`、`backend/services/AIComplianceService.js`、`backend/services/AlgorithmOrchestrator.js`、`backend/services/ResultCache.js`、`backend/test-env.js`、后端依赖文件等。
- 已新增/未跟踪：`web-dashboard/`、`tools/`、`docs/`、`backend/routes/compliance.js`、`backend/routes/vlm.js`、`backend/services/RegulationRAGService.js`、`backend/services/VLMCargoService.js`、`backend/services/FastBlockPackingEngine.js` 等。
- 已删除：一批早期说明文档、旧测试总结、小程序 README、旧项目材料等。
- 风险提示：diff 很大，后续只做小步可验证改动，避免扩大不可控变更面。

## 启动命令

前端：

```powershell
cd web-dashboard
npm run dev
```

前端生产构建：

```powershell
cd web-dashboard
npm run build
```

后端：

```powershell
cd backend
npm start
```

真实联调测试：

```powershell
node tools/final_product_real_api_check.mjs
node tools/final_product_playwright_e2e.mjs
```

## 当前 build 基线

- 命令：`cd web-dashboard && npm run build`
- 结果：PASS
- Vite 输出：1591 modules transformed，构建产物包含 `dist/index.html`、CSS、React chunk、业务 chunk、Three.js chunk。

## 当前真实数据口径

本轮必须保留以下真实接口口径：

| 字段 | 当前值 |
| --- | --- |
| 订单号 | NB2026-DEMO-01 |
| 航线 | 宁波港 -> 汉堡港 |
| 柜型 | 40HQ |
| 输入货物总件数 | 221 |
| 已装入 | 221 |
| 未装入 | 0 |
| 空间利用率 | 84.51% |
| 总重量 | 8,812 kg |
| 合规结果 | 本地规则 WARNING / AI建议 PASS / 人工复核独立 |
| DeepSeek 模型 | deepseek-v4-flash |
| VLM 模型 | Qwen/Qwen3-VL-32B-Instruct |
| RAG 状态 | 本地法规证据库 / RAG 检索 / AI 解释 |
| 报告导出 | HTML / CSV / JSON 真实前端导出 |

当前冻结口径不得因视觉或叙事而改写；本地规则、AI 建议与人工复核必须保持分层呈现。

## 当前环境变量名

进程/用户/机器环境检查：

- `DEEPSEEK_API_KEY`：已配置，已隐藏值。
- `DEEPSEEK_MODEL`：进程环境未配置；`backend/.env` 已配置为 `deepseek-v4-flash`。
- `AI_TIMEOUT_MS`：进程环境未配置；`backend/.env` 已配置为 `30000`。
- `SILICONFLOW_API_KEY`：进程环境未配置；密钥不得写入文档。
- `SILICONFLOW_VLM_MODEL`：进程环境未配置；`backend/.env` 已配置为 `Qwen/Qwen3-VL-32B-Instruct`。
- `VLM_TIMEOUT_MS`：进程环境未配置；`backend/.env` 已配置为 `30000`。
- `TAVILY_API_KEY`：未检测到。
- `WEB_RAG_ENABLED`：未检测到。

## 当前 VLM 状态

- 现有模型目标：`Qwen/Qwen3-VL-32B-Instruct`。
- 已有真实测试报告：VLM 可用但稳定性不足；5 张图里部分图片存在超时、空返回或报告口径不一致。
- 本轮重点：统一后端直连、前端上传、最终报告口径；增加有限重试、结构化 JSON 解析和清晰失败状态。

## 当前 RAG 状态

- 本地法规证据库已经可用于 VGM、SOLAS、CTU、LIFO、重心、IPPC、木包装、单证一致性、危险品等关键词。
- 当前不应宣称“实时联网国标检索”。
- 本轮目标是在不破坏本地 RAG 的基础上增加“联网参考 + 缓存快照 + 来源可信度”。
- 当前 `TAVILY_API_KEY` 未在进程/用户/机器环境检测到；若没有可用密钥，联网增强应进入可解释降级，不得假成功。

## 当前 3D 状态

- Three.js 页面已使用真实 `loadedCargo=221`、`unloadedCargo=0`、`containerInfo`、`cog` 数据。
- Canvas 已可渲染，播放、视角切换、算法依据已有基础。
- 本轮目标是增强低多边形叉车、工人、路径、目标位、步骤时间轴和作业 HUD。
- 不重写 Three.js 引擎，不改变 `plan.loadedCargo`、`containerInfo`、`cog` 数据结构。

## 当前前端视觉状态

- 已完成基础浅色物流 AI 工作台还原。
- 当前最大提升点：真实数据条更清楚、VLM 成功/失败状态更清楚、联网参考和本地法规证据分层、3D 页面现场执行感更强、报告页更适合录屏讲解。

## 当前录屏路径

推荐沿用既有真实全链路路径：

1. 工作台查看真实订单摘要。
2. 进入货物录入，上传最佳 VLM 测试图片。
3. 进入柜型推荐，生成真实装箱方案。
4. 进入 3D 作业孪生，播放作业步骤并查看算法依据。
5. 进入合规预审，查看本地法规证据、AI 解释和联网参考状态。
6. 进入报告导出，预览并下载 HTML / CSV / JSON。

## 当前最大风险

1. VLM 外部服务偶发超时或返回不稳定。
2. `TAVILY_API_KEY` 当前未检测到，联网 RAG 可能只能以“未启用/不可用”呈现。
3. 当前工作树已有大 diff，继续改动必须保持小步、可验证。
4. 3D 页面增强不能影响真实渲染性能和 E2E 稳定性。
5. 文档和截图不能泄露 API Key。

## 本轮优化目标

- 修复 VLM 稳定性与报告口径矛盾。
- 增强 RAG 证据链表达，明确本地证据、联网参考、AI 解释边界。
- 增强 3D 作业孪生现场感。
- 提升 6 个 Web 页面在录屏中的高级感与可读性。
- 输出 before / after 截图、contact sheet、评分和最终录屏材料。

## 本轮不做的事项

- 不改数据库结构。
- 不重写装箱算法。
- 不重写 Three.js 渲染引擎。
- 不引入大型 UI 框架。
- 不伪造 VLM、DeepSeek、RAG 或报告导出成功。
- 不把本地法规库说成实时联网官方检索。
- 不把真实数据口径改成旧设计稿指标。
