# 项目矛盾与不一致清单 (PROJECT_CONTRADICTIONS)

> 生成时间：2026-07-11
> 用途：记录文档与代码、Web 与移动端、测试与宣传指标、旧版本与新版本之间的矛盾，供申报人决定统一口径

---

## 1. VLM 模型名称不一致

| 来源 | 模型名称 |
|---|---|
| [docs/final_goal/BACKEND_REAL_API_CHECK.md](file:///d:/cixing/3chuang/docs/final_goal/BACKEND_REAL_API_CHECK.md) | `Qwen/Qwen2-VL-72B-Instruct` |
| [docs/final_product_integration/BLOCKED_REAL_FUNCTION_REPORT.md](file:///d:/cixing/3chuang/docs/final_product_integration/BLOCKED_REAL_FUNCTION_REPORT.md) | `Qwen/Qwen3-VL-32B-Instruct` |
| [docs/notebooklm_sources/01_PROJECT_OVERVIEW.md](file:///d:/cixing/3chuang/docs/notebooklm_sources/01_PROJECT_OVERVIEW.md) | `Qwen/Qwen3-VL-32B-Instruct` |
| [output/runtime/backend.stdout.log](file:///d:/cixing/3chuang/output/runtime/backend.stdout.log) | `Qwen/Qwen3-VL-32B-Instruct` |

**统一口径**：以 `Qwen/Qwen3-VL-32B-Instruct` 为准（final_goal 文档为早期版本，已升级）。

## 2. 装箱数据口径（多版本冲突）

| 来源 | 装入/输入 | 利用率 | 合规 |
|---|---|---|---|
| [docs/final_product_integration/REAL_DATA_CONSISTENCY_REPORT.md](file:///d:/cixing/3chuang/docs/final_product_integration/REAL_DATA_CONSISTENCY_REPORT.md) | 221/221 | 84.51% | 本地规则 WARNING / AI建议 PASS / 人工复核独立 |
| [docs/frontend_glm52_redesign/DATA_STATE_CONSISTENCY_REPORT.md](file:///d:/cixing/3chuang/docs/frontend_glm52_redesign/DATA_STATE_CONSISTENCY_REPORT.md) | 顶栏 221/221 vs 主体 221/221 | 84.51% vs 84.51% | 本地规则 WARNING / AI建议 PASS / 人工复核独立 vs 本地规则 WARNING / AI建议 PASS / 人工复核独立 |
| [docs/design_reviews/CURRENT_PRODUCT_DESIGN_AUDIT_2026-07-10.md](file:///d:/cixing/3chuang/docs/design_reviews/CURRENT_PRODUCT_DESIGN_AUDIT_2026-07-10.md) | 221/221（首页 221/221） | 84.51% | 本地规则 WARNING / AI建议 PASS / 人工复核独立 |
| [backend/test-result.json](file:///d:/cixing/3chuang/backend/test-result.json) | 50 件冰箱/20GP | 47.17% | WARNING |
| [backend/result-p2.txt](file:///d:/cixing/3chuang/backend/result-p2.txt) | 1144/1280 | 73.74% | - |
| [backend/result-p5.txt](file:///d:/cixing/3chuang/backend/result-p5.txt) | 710/725 | 62.33% | 偏移 10.17% |

**统一口径**：标准演示订单 NB2026-DEMO-01 真实结果为 **221/221 件已规划装入、0 件未装、84.51%、8,812 kg、LIFO 通过**。合规状态按本地规则、AI建议和人工复核分层呈现，不合并成单一总分。

## 3. 合规分数冲突

| 来源 | 分数 |
|---|---|
| [docs/final_goal/BACKEND_REAL_API_CHECK.md](file:///d:/cixing/3chuang/docs/final_goal/BACKEND_REAL_API_CHECK.md) | 本地规则 WARNING / AI建议 PASS / 人工复核独立（真实接口） |
| [docs/final_product_integration/FINAL_REAL_FUNCTION_CHECKLIST.md](file:///d:/cixing/3chuang/docs/final_product_integration/FINAL_REAL_FUNCTION_CHECKLIST.md) | 本地规则 WARNING / AI建议 PASS / 人工复核独立 |
| [docs/frontend_glm52_redesign/DATA_STATE_CONSISTENCY_REPORT.md](file:///d:/cixing/3chuang/docs/frontend_glm52_redesign/DATA_STATE_CONSISTENCY_REPORT.md) | 本地规则 WARNING / AI建议 PASS / 人工复核独立（前端硬编码） |

**统一口径**：当前页面可同时展示 **本地规则 WARNING、AI建议 PASS、人工未复核**。三层来源与状态互不覆盖，最终状态以本地规则和人工结论为准。

## 4. 主色三套色系

| 来源 | 主色 |
|---|---|
| [miniprogram/utils/designTokens.js](file:///d:/cixing/3chuang/miniprogram/utils/designTokens.js) | `#007AFF`（科技蓝） |
| [miniprogram/app.json](file:///d:/cixing/3chuang/miniprogram/app.json) | `#1976D2`（Material Blue） |
| [miniprogram/app.wxss](file:///d:/cixing/3chuang/miniprogram/app.wxss) | `#1976D2`（.btn-primary） |
| [docs/frontend_glm52_redesign/02_YONGGUI_WEB_DESIGN_SYSTEM.md](file:///d:/cixing/3chuang/docs/frontend_glm52_redesign/02_YONGGUI_WEB_DESIGN_SYSTEM.md) | `#0F5CFF`（YCC v2） |
| [web-dashboard/src/styles/app.css](file:///d:/cixing/3chuang/web-dashboard/src/styles/app.css) | `#246a56`（墨绿，非蓝） |

**统一口径**：Web 端使用墨绿主色 `#246a56`（Yonggui Web Design System），小程序存在 `#007AFF` 与 `#1976D2` 双轨。**Web 与小程序视觉未统一**，需申报人决定是否在材料中回避"统一设计系统"表述。

## 5. 3D 场景背景色

| 来源 | 背景色 |
|---|---|
| [miniprogram/utils/ThreeRenderer.js](file:///d:/cixing/3chuang/miniprogram/utils/ThreeRenderer.js) | `0x1a1a1a`（深色科技风） |
| [miniprogram/utils/ThreeRenderer-v33.0-FINAL.js](file:///d:/cixing/3chuang/miniprogram/utils/ThreeRenderer-v33.0-FINAL.js) | `0xf5f5f7`（白色极简） |
| [web-dashboard/src/three/TwinScene.jsx](file:///d:/cixing/3chuang/web-dashboard/src/three/TwinScene.jsx) | `#c8cfcb`（浅灰） |

**统一口径**：三个 3D 实现背景色各异。Web 端为浅灰 `#c8cfcb`（当前生产版本）。小程序存在两个版本，packing-result.js 默认引入深色版 ThreeRenderer.js。

## 6. 下载文件大小

| 来源 | HTML | CSV | JSON |
|---|---|---|---|
| [docs/codex/API_CONTRACT_SNAPSHOT.md](file:///d:/cixing/3chuang/docs/codex/API_CONTRACT_SNAPSHOT.md) | 3910 B | 726 B | 680006 B |
| [docs/final_product_integration/REAL_DATA_CONSISTENCY_REPORT.md](file:///d:/cixing/3chuang/docs/final_product_integration/REAL_DATA_CONSISTENCY_REPORT.md) | 3635 B | 742 B | 4084 B |
| [docs/codex/FINAL_ACCEPTANCE.md](file:///d:/cixing/3chuang/docs/codex/FINAL_ACCEPTANCE.md) | 3910 B | 726 B | 680019 B |

**统一口径**：不同会话的 loadedCargo 数组大小不同导致 JSON 差异（4084 B 是精简版，680006 B 是完整 221 项）。申报材料中**不引用具体文件大小**，只说"支持 HTML/CSV/JSON 三种格式"。

## 7. 总重量口径

| 来源 | 重量 |
|---|---|
| [docs/notebooklm_sources/01_PROJECT_OVERVIEW.md](file:///d:/cixing/3chuang/docs/notebooklm_sources/01_PROJECT_OVERVIEW.md) | 8,812 kg |
| [docs/codex/STAGE3_EXECUTION_STATE.md](file:///d:/cixing/3chuang/docs/codex/STAGE3_EXECUTION_STATE.md) | 8,812 kg |

**统一口径**：8,812 kg 是 221 件装入重量；8,812 kg 是 221 件输入总重量。**申报材料中必须明确是"装入重量"还是"输入总重量"**。

## 8. 后端测试数量

| 来源 | 数量 |
|---|---|
| [docs/codex/FINAL_ACCEPTANCE.md](file:///d:/cixing/3chuang/docs/codex/FINAL_ACCEPTANCE.md) | 4 suites / 77 tests（非破坏性子集） |
| 实际 Grep 统计 | 811 个测试（54 文件） |

**统一口径**：全量后端测试 811 个（54 文件），但部分依赖数据库/AI Key 无法全部运行。**申报材料中可以说"后端 800+ 测试"**，但不得声称"全部通过"。

## 9. Web 测试数量

| 来源 | 数量 |
|---|---|
| [docs/codex/FINAL_ACCEPTANCE.md](file:///d:/cixing/3chuang/docs/codex/FINAL_ACCEPTANCE.md) | 19 files / 66 tests |
| 实际 LS 统计 | 21 files / 90 用例 |

**统一口径**：以 21 files / 90 用例为准（第二阶段验收后新增 2 文件）。

## 10. 3D 倍速档位

| 来源 | 档位 |
|---|---|
| Web [operationMachine.js](file:///d:/cixing/3chuang/web-dashboard/src/three/operation/operationMachine.js) | 0.5×/1×/2×/4× |
| 小程序 [packing-result.js](file:///d:/cixing/3chuang/miniprogram/pages/packing-result/packing-result.js) | 1/4/10/30 |
| [docs/codex/STAGE3_EXECUTION_STATE.md](file:///d:/cixing/3chuang/docs/codex/STAGE3_EXECUTION_STATE.md) | 当前最高 4×（需 16×） |

**统一口径**：Web 支持 0.5/1/2/4×，小程序支持 1/4/10/30。**两端倍速档位不一致**。目标态需 16×。

## 11. "Fast Block多约束三维装箱引擎"表述

| 来源 | 表述 |
|---|---|
| PPT 12 页（ppt-master/projects/yonggui_yisuan_guosai_*） | "Fast Block多约束三维装箱引擎" |
| [backend/services/FastBlockPackingEngine.js:613](file:///d:/cixing/3chuang/backend/services/FastBlockPackingEngine.js#L613) | `sixDimensionalConstraints`（约束清单） |
| [docs/codex/STAGE3_LIMITATIONS.md](file:///d:/cixing/3chuang/docs/codex/STAGE3_LIMITATIONS.md) | "源码证明的是 Fast Block 六类业务约束协同机制块装箱，非'六维加权'类" |

**统一口径**：**代码中不存在"Fast Block多约束三维装箱引擎"**。`sixDimensionalConstraints` 是六个约束维度的清单（LIFO/重心/SKU聚集/堆叠安全/搬运可达/VGM），不是加权评分算法。算法本身是 FastBlock 块优先装箱。**申报材料中统一使用"六类业务约束协同机制"或"Fast Block 块优先装箱算法"，禁用"六维加权"。**

## 12. App.jsx 架构状态

| 来源 | 状态 |
|---|---|
| [docs/design_reviews/CURRENT_PRODUCT_DESIGN_AUDIT_2026-07-10.md](file:///d:/cixing/3chuang/docs/design_reviews/CURRENT_PRODUCT_DESIGN_AUDIT_2026-07-10.md) | App.jsx 约 5426 行 |
| [fix_demo.ps1](file:///d:/cixing/3chuang/fix_demo.ps1) | 修改 web-dashboard/src/App.jsx |
| 实际 LS web-dashboard/src/ | 无 App.jsx，已拆分为 Application.jsx + 模块化结构 |

**统一口径**：Web 已于第二阶段重构为模块化结构（src/app/、src/domain/、src/pages/、src/services/、src/three/、src/styles/），App.jsx 已不存在。fix_demo.ps1 是针对旧版本的脚本，已失效。

## 13. 第三阶段状态

| 来源 | 状态 |
|---|---|
| [docs/codex/STAGE3_EXECUTION_STATE.md](file:///d:/cixing/3chuang/docs/codex/STAGE3_EXECUTION_STATE.md) | "执行中；基线已冻结，产品源码尚未开始第三阶段修改" |
| [docs/codex/STAGE3_ACCEPTANCE.md](file:///d:/cixing/3chuang/docs/codex/STAGE3_ACCEPTANCE.md) | "INCOMPLETE（基线阶段）" |
| [docs/codex/STAGE3_LIMITATIONS.md](file:///d:/cixing/3chuang/docs/codex/STAGE3_LIMITATIONS.md) | "执行中" |

**统一口径**：三个文档一致表明**第三阶段尚未开始实际开发**，仅完成基线冻结。目标态功能（8-12 SKU/3 港/2 批次/连续三次全装入/16× 倍速/7 类筛选/PDF 联动）**均未实现**。

## 14. 数据库密码硬编码

| 来源 | 问题 |
|---|---|
| [backend/scripts/migrate-add-fragile.js:18](file:///d:/cixing/3chuang/backend/scripts/migrate-add-fragile.js#L18) | `password: 'wcxszds520'`（明文） |

**统一口径**：存在安全隐患，违反项目安全约定。**不得提交到公开仓库，不得在材料中展示该文件**。

## 15. outputs/ vs output/ 目录

| 来源 | 状态 |
|---|---|
| [docs/notebooklm_sources/MISSING_FILES.md](file:///d:/cixing/3chuang/docs/notebooklm_sources/MISSING_FILES.md) | 提到 `outputs/ppt_director_master/` |
| 实际 LS | 根目录有 `output/`（单数）和 `outputs/`（复数，含 PPT 候选） |

**统一口径**：两个目录都存在。`output/` 存放 Playwright 测试结果，`outputs/` 存放 PPT 候选版本。`outputs/ppt_director_master/` NOT_FOUND。

## 16. 小程序 export 页面

| 来源 | 状态 |
|---|---|
| [miniprogram/app.json](file:///d:/cixing/3chuang/miniprogram/app.json) | 注册 export 页面 |
| [miniprogram/pages/export/export.js](file:///d:/cixing/3chuang/miniprogram/pages/export/export.js) | 空壳 `Page({ data: {}, onLoad: function () {} })` |

**统一口径**：小程序 export 页面**未实现**，仅有空壳。**不得声称小程序支持报告导出**。

## 17. 后端 /api/port/updates 响应格式

| 来源 | 格式 |
|---|---|
| [backend/routes/port.js](file:///d:/cixing/3chuang/backend/routes/port.js) | 直接返回数组 `res.status(200).json(updates)` |
| [backend/middleware/response.js](file:///d:/cixing/3chuang/backend/middleware/response.js) | 统一包络 `{code, message, data, ts}` |

**统一口径**：`/api/port/updates` 是唯一不符合统一包络的端点。**这是一个已知的不一致性**。

## 18. 演示订单号

| 来源 | 订单号 |
|---|---|
| [docs/final_product_integration/REAL_DATA_CONSISTENCY_REPORT.md](file:///d:/cixing/3chuang/docs/final_product_integration/REAL_DATA_CONSISTENCY_REPORT.md) | NB2026-DEMO-01 |
| [web-dashboard/src/domain/cargo/demoDataset.js](file:///d:/cixing/3chuang/web-dashboard/src/domain/cargo/demoDataset.js) | NB2026-DEMO-01 |
| [docs/codex/DEMO_DATASET_SPEC.md](file:///d:/cixing/3chuang/docs/codex/DEMO_DATASET_SPEC.md) | NB2026-DEMO-01（设计中） |

**统一口径**：两个订单号在不同上下文使用。NB2026-DEMO-01 是 final_product_integration 复测时的订单号，NB2026-DEMO-01 是 demoDataset.js 中的标准订单号。**申报材料中统一使用 NB2026-DEMO-01**。

---

> 需申报人决定的事项：
> 1. Web 与小程序主色不统一是否在材料中回避
> 2. 小程序 export 空壳是否在材料中提及
> 3. 后端 811 测试是否全部可运行（依赖数据库/AI Key）
> 4. 第三阶段目标态功能是否写入"后续规划"
