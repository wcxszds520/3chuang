# 第三阶段最终验收

最终状态：COMPLETE  
验收时间：2026-07-12（Asia/Shanghai）  
分支：`codex/sol`  
HEAD：`ef47171694c44feb086d4875a95732f79ed229f9`

## 最终业务基线

- 唯一默认数据：`yonggui-stage3-demo-v1`，订单 `NB2026-DEMO-01`，10 SKU、221 件、8,812 kg、3 个目的港、7 个批次、9 类业务属性。
- 作业指定：4 个 SKU 人工搬运、6 个 SKU 叉车搬运；处理方式为确定性 `fixed`，不随机分配 actor。
- 唯一权威入口：`POST /api/packing/generate`；前端与后端路由均强制 `fast-block`，页面无算法选择器。
- 最终三次真实后端请求：`REQ_1783801607597`、`REQ_1783801617461`、`REQ_1783801625460`。
- 三次结果相同：221/221 装入、unloaded 0、利用率 84.51018309907437%、总重 8,812 kg、LIFO 通过、横向重心偏移 0%、纵向偏移 7.739612206758673%。
- 三次核心指纹：`2b2481ace9f3eddb2a4551a8559c7a8c34b77297b0541ac45b032330f8f1a035`。
- 数据集与三次响应证据：`output/playwright/stage3/dataset/demo-dataset-summary.json`、`output/playwright/stage3/algorithm/determinism-summary.json`、`request-1..3.json`、`response-1..3.json`。

## 最终命令矩阵

以下均在最终源码上执行。所有预期模拟 4xx/5xx 都由脚本单独列入 expected/simulated errors；未处理应用错误均为 0。

| 命令 | 退出码 | 数量与结果 | 证据 |
|---|---:|---|---|
| `cd web-dashboard && npm run lint` | 0 | ESLint 0 warning | 命令输出；`eslint src --max-warnings 0` |
| `cd web-dashboard && npm test` | 0 | 23 files、79 tests 全过 | Vitest 最终输出 |
| `cd web-dashboard && npm run build` | 0 | Vite 1632 modules；构建完成 | `dist/`；最终构建输出 |
| `cd backend && npx eslint server.js routes/packing.js __tests__/integration/packing.test.js --max-warnings 0` | 0 | 本轮后端修改 0 warning | 定向 ESLint 输出 |
| `cd backend && npm test -- --runTestsByPath __tests__/unit/FastBlockPackingEngine.test.js __tests__/integration/packing.test.js` | 0 | 2 suites、13 tests 全过 | Fast Block 6 项＋真实路由/兼容/持久化 7 项 |
| `node tools/codex_stage3_dataset_gate.mjs` | 0 | 3/3 真实请求、3/3 全装入、所有 dataset/determinism 断言通过 | `output/playwright/stage3/algorithm/determinism-summary.json` |
| `node tools/codex_stage3_algorithm_gate.mjs` | 0 | 8 类断言通过 | `output/playwright/stage3/algorithm/single-algorithm-gate.json` |
| `node tools/codex_stage3_three_gate.mjs` | 0 | 10 类断言；人工 155 帧、叉车 156 帧；17 张截图 | `output/playwright/stage3/three/three-gate.json` |
| `node tools/codex_stage3_compliance_gate.mjs` | 0 | 8 类断言；3 PDF、5 条联动抽验、7 个合规状态 | `output/playwright/stage3/compliance/evidence-linkage-gate.json` |
| `node tools/codex_stage3_report_gate.mjs` | 0 | 5 类断言；HTML/CSV/JSON 均下载并回读 | `output/playwright/stage3/report/export-consistency.json` |
| `node tools/codex_core_e2e.mjs` | 0 | 10/10 核心业务证据点 | `output/playwright/core-e2e/results.json` |
| `node tools/codex_three_motion_e2e.mjs` | 0 | 10/10 3D 回归断言 | `output/playwright/three-motion/results.json` |
| `node tools/codex_ui_states_e2e.mjs` | 0 | 15/15 主动失败场景明确且可恢复 | `output/playwright/ui-states/results.json` |
| `node tools/codex_final_visual.mjs` | 0 | 3 视口 × 6 页＝18 张；9 类视觉断言 | `output/playwright/final/results.json` |
| `python tools/build_stage3_contact_sheets.py` | 0 | 17 张 3D、6 张合规、18 张响应式、12 张错误态组成 4 张联系表 | `output/playwright/stage3/visual-audit/contact-sheet-manifest.json` |
| `node tools/recover_stage3_packing_plans.cjs --apply` | 0 | 从首次清表 binlog 事务恢复 20/20 历史方案 | `output/playwright/stage3/database-recovery.json` |
| `node tools/codex_stage3_evidence_audit.mjs` | 0 | 15 个证据包全部为 true；无旧数据/旧文档残留 | `output/playwright/stage3/final-evidence-audit.json` |

## 失败与修复记录

最终 PASS 不是通过隐藏失败得到的：

1. 后端旧集成套件首次运行 exit 1：旧 `cargoIds` 契约 7 项失败，且 `.env` 覆盖 Jest 的 `NODE_ENV=test` 后误绑 3000。修复为同时兼容 `cargoList`/`cargoIds`、保持扁平响应、测试态不启动监听端口。
2. 第二次后端运行 exit 1：12/13，通过项已恢复；唯一失败为 MySQL `DECIMAL` 返回字符串。断言显式数值化。
3. 第三次后端运行 exit 1：12/13；唯一失败为 MySQL JSON 列已解码却被二次 `JSON.parse`。断言兼容字符串和对象。
4. 旧集成测试原有无条件 `DELETE FROM packing_plan`。首次运行删除了 20 条本地历史方案；最终测试改为只登记并清理自身 plan ID。通过 MySQL row binlog `000114`、位置 `114251330..118810050` 解析并恢复 20/20 行；读回 20 个原 ID。当前数据库 23 行＝20 条恢复历史＋3 条最终正式方案，测试规模 15 件的方案为 0。
5. 唯一算法门禁首次 exit 1：页面根节点与尾货卡重复 `data-unloaded-count`，不是重复请求。尾货卡改为 `data-tail-unloaded-count` 后原命令通过。
6. 后端定向 ESLint 首次 exit 1：0 error、1 个未使用 `db` 导入 warning。删除死导入后 0 warning。

## 40 项硬门槛逐条审计

| # | 状态 | 实际证据 |
|---:|---|---|
| 1 | PASS | 10 SKU；`demo-dataset-summary.json` |
| 2 | PASS | Hamburg、Rotterdam、Antwerp，共 3 港 |
| 3 | PASS | 7 个批次 |
| 4 | PASS | carton/forklift/fragile/heavy/manual/nonstackable/pallet/stackable/wooden，共 9 类 |
| 5 | PASS | 4 个 manual SKU |
| 6 | PASS | 6 个 forklift SKU |
| 7 | PASS | 三次真实 `/api/packing/generate` 均 200、221/221 |
| 8 | PASS | 三次 unloaded 均为 0 |
| 9 | PASS | 方案来自后端响应；请求/响应原件和三次稳定核心指纹可回读，前端无结果常量 |
| 10 | PASS | `.algorithm-select` 数量 0；`single-algorithm-gate.json` |
| 11 | PASS | 页面固定 “Fast Block多约束三维装箱引擎”；前端 request builder 与后端路由均强制 `fast-block` |
| 12 | PASS | SKU/港序/风险/作业四视图的 canonical plan 与 cargo ID 顺序不变 |
| 13 | PASS | 34-part 叉车、货叉升降/伸缩、绑定/释放/倒车完整状态链 |
| 14 | PASS | 20-part 低多边形工人、连续步态和搬运姿态 |
| 15 | PASS | worker mesh、关节、手脚与 cargo bind 同时存在；非漂浮货物或文字代理 |
| 16 | PASS | 人工/叉车 155/156 帧；最大相邻 actor 位移 673.83/658.85 mm；无跨阶段跳跃 |
| 17 | PASS | 0.5×、1×、2×、4×、8×、16× 均可用 |
| 18 | PASS | 高倍速仍覆盖 13 个 machine states 与 9 个 actor stages |
| 19 | PASS | SKU、批次、港口、港序、actor、状态、风险，共 7 类筛选 |
| 20 | PASS | 组合筛选 221→39→0→221，machine/plan 指纹不变 |
| 21 | PASS | 221 项呈现为 10 组；默认仅 12 个 item rows |
| 22 | PASS | simple 默认；检查 8 个状态，最多 3 标签，重叠 0 |
| 23 | PASS | 左侧实际渲染 `%PDF-1.4` 多页 PDF，可翻页/缩略图导航/打开文件 |
| 24 | PASS | 5 条规则抽验均联动正确文档、页码、1 个高亮、摘录和来源 |
| 25 | PASS | SOLAS VGM、CTU Code、IPPC/ISPM 15 三类资料，各 4 页 |
| 26 | PASS | 本地规则、法规证据、后端 AI、人工复核使用独立字段/卡片/历史，不相互覆盖 |
| 27 | PASS | 报告与 10 SKU、221/0、84.5102%、8,812 kg、COG、7 证据一致 |
| 28 | PASS | HTML 42,284 B；CSV 61,606 B/221 行/27 列；JSON 292,731 B/schema 2，均回读 |
| 29 | PASS | 1920×1080、1672×941、1280×720 共 18 张；四张联系表已用 `view_image` 实际检查 |
| 30 | PASS | 15 个主动错误场景均有明确反馈与恢复路径，无假成功 |
| 31 | PASS | 最终前端 lint exit 0；后端定向 lint exit 0 |
| 32 | PASS | 前端 79/79；后端定向 13/13 |
| 33 | PASS | Vite build exit 0，1632 modules |
| 34 | PASS | core E2E 10/10 |
| 35 | PASS | stage3 3D 10/10＋既有 motion 10/10 |
| 36 | PASS | compliance gate 8/8，3 PDF/5 联动/7 状态 |
| 37 | PASS | 各成功门禁 pageErrors、unexpected console/response/request errors 均为空 |
| 38 | PASS | 本文、执行状态、数据规格、API、交互、3D、总验收、限制及 JSON/PNG/PDF 证据完整 |
| 39 | PASS | 未执行 reset、clean、commit、push；最终 HEAD 与基线同为 `ef471716…` |
| 40 | PASS | 本文保留所有初始失败、数据库测试事故、恢复过程和下述限制 |

## 截图实际检查

- 机器可读检查：`output/playwright/stage3/visual-audit/visual-inspection.json`，verdict `PASS`。
- 3D 联系表：`output/playwright/stage3/visual-audit/three-contact-sheet.jpg`（17 张）。
- 合规联系表：`output/playwright/stage3/visual-audit/compliance-contact-sheet.jpg`（6 张）。
- 响应式联系表：`output/playwright/stage3/visual-audit/responsive-contact-sheet.jpg`（18 张）。
- 错误态联系表：`output/playwright/stage3/visual-audit/negative-contact-sheet.jpg`（12 张可截图错误态；其余 3 个场景由 JSON 行为证据覆盖）。
- 抽查原图：人工搬运、叉车进箱、作业阻断、VGM 高亮、人工复核、1280px 货物/3D/合规均实际打开检查。

## Git 结论

- `git status --porcelain` 最终为 85 个顶层状态项：50 tracked deletion、13 tracked modification、22 untracked 顶层路径。
- 第三阶段开始前已有 81 个状态项，且整个 `web-dashboard/`、`docs/`、`tools/`、`output/` 已是 untracked；因此 Git 无法逐行区分此前用户工作与本轮 Web 文件。所有既有删除均保留，未 reset/clean/checkout。
- 未提交、未暂存、未推送；HEAD 未改变。

## 尚存限制

- 三份法规 PDF 是明确标注的本地结构化演示资料包，用于证明真实 PDF 浏览与证据联动，不冒充 IMO/IPPC 官方签发文本，也不构成法律意见。
- 后端 AI/VLM 的实时结果依赖本地配置的外部服务可用性；失败时产品会保留本地规则与 PDF 证据并允许重试。
- 3D 使用程序化低多边形工人与叉车，不是高精度 glTF；验收目标是作业语义、路径、门洞和连续性。
- 既有工作树在目标开始前已经高度脏且包含 50 个 tracked 删除；未擅自恢复或提交这些用户状态。
