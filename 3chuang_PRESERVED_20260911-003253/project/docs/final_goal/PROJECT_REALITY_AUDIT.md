# 甬柜易算项目真实能力审查

生成时间：2026-06-30  
目标：判断当前项目距离“可录制比赛演示视频”的真实闭环还有哪些差距，并把 FIXABLE 项进入后续修复。

## 证据来源

- 设计文档：`DESIGN_TOKENS.md`、`COMPONENT_SPEC.md`、`IMPLEMENTATION_PLAN.md`
- 设计稿：`docs/design_refs/*.png`
- 二轮报告：`docs/design_reviews/ROUND2_VISUAL_GAP_REPORT.md`、`docs/design_reviews/ROUND2_FINAL_VISUAL_REPORT.md`
- 前端：`web-dashboard/src/App.jsx`、`web-dashboard/src/restore.css`
- 前端 API：`web-dashboard/src/api.js`、`web-dashboard/src/vlmCargo.js`、`web-dashboard/src/aiCompliance.js`、`web-dashboard/src/complianceRules.js`
- 后端：`backend/server.js`、`backend/routes/*.js`、`backend/services/*.js`
- 命令证据：
  - `cd web-dashboard && npm run build`：PASS
  - `GET http://127.0.0.1:3000/api/health`：PASS
  - `POST http://127.0.0.1:3000/api/packing/generate`：PASS，返回 `loadedCargo`、`containerInfo`、`cog`
  - `GET http://127.0.0.1:3000/api/compliance/regulations`：PASS，4 份法规、17 个段落
  - `GET http://127.0.0.1:3000/api/vlm/status`：PASS，VLM key configured

## 1. 当前前端页面清单

| 页面 | Hash | 当前状态 | 结论 |
| --- | --- | --- | --- |
| 工作台首页 | `#dashboard` | 视觉二轮已接近设计稿，核心跳转按钮存在 | FIXABLE |
| 货物录入 | `#cargo` | 三栏布局存在，表单真实可编辑，VLM file input 存在；但 SKU 表当前用静态 `DEMO_SKUS` 渲染 | FIXABLE |
| 柜型推荐 | `#container` | 40HQ 主卡、柜型对比、生成按钮存在；生成按钮调用 `handleRun` | FIXABLE |
| 3D 作业孪生 | `#twin` | Three.js canvas 真实渲染，播放/重置有真实状态；视角按钮和作业按钮无真实行为 | FIXABLE |
| 合规预审 | `#compliance` | AI 审计按钮调用真实接口；但矩阵、证据列表、复核按钮当前多为静态 UI | FIXABLE |
| 报告导出 | `#report` | 视觉已接近设计稿；报告/文件按钮当前无真实导出 | FIXABLE |

## 2. 当前后端接口清单

| 接口 | 文件 | 当前状态 | 分类 |
| --- | --- | --- | --- |
| `GET /api/health` | `backend/routes/index.js` | 已验证可用 | READY |
| `POST /api/packing/generate` | `backend/routes/packing.js` | 已验证可返回真实装箱方案 | READY |
| `POST /api/packing/compliance-check-sync` | `backend/routes/packing.js` | 真实接口存在，前端已封装；需 E2E 调用验证 | FIXABLE |
| `GET /api/compliance/regulations` | `backend/routes/compliance.js` | 已验证法规库可列出 | READY |
| `GET /api/compliance/regulation/:docId` | `backend/routes/compliance.js` | 真实接口存在，需前端按钮接入 | FIXABLE |
| `POST /api/compliance/search` | `backend/routes/compliance.js` | 真实轻量 RAG 检索存在 | READY |
| `POST /api/vlm/recognize-cargo` | `backend/routes/vlm.js` | 真实接口存在，依赖外部 VLM；前端已封装 | FIXABLE |
| `GET /api/vlm/status` | `backend/routes/vlm.js` | 已验证 available=true | READY |
| `GET /api/container/list` | `backend/routes/container.js` | 真实接口存在，依赖数据库 | READY |
| `POST /api/cargo/create` | `backend/routes/cargo.js` | 真实接口存在，依赖数据库；前端未接入 | OUT_OF_SCOPE |

## 3. 当前核心数据流

| 数据 | 当前来源 | 当前问题 | 分类 |
| --- | --- | --- | --- |
| `cargoList` | `SCENARIOS[0].cargoList` + 前端 `addCargo` | 表单新增会进入前端状态，但 SKU 表仍渲染静态 `DEMO_SKUS`，新增货物不可见 | FIXABLE |
| `selectedContainerType` | React state，默认 `40HQ` | 柜型按钮可改 state，但视觉选中写死 `40HQ` | FIXABLE |
| `plan / loadedCargo` | 初始 `generateFallbackPlan`，点击生成后 `runPackingScenario` | `api.js` 后端失败会静默返回本地 fallback，不符合“不伪装真实后端成功” | FIXABLE |
| `containerInfo` | 本地 `CONTAINERS` 或后端返回 | 3D 读取字段真实，结构保留 | READY |
| `cog` | 本地或后端 plan | Three.js 读取真实字段；页面展示固定 3.2% | FIXABLE |
| `compliance result` | 本地 `buildComplianceReport` + AI 接口成功替换 | 页面当前视觉矩阵硬编码 86/2 warning，未从规则结果派生 | FIXABLE |
| `regulation evidence` | 后端 `RegulationRAGService` | 右侧证据按钮未打开真实详情 | FIXABLE |
| `report export data` | 前端 report 视图静态拼接 | 无真实 HTML / CSV / JSON 下载，存在“可生成”但无动作 | FIXABLE |

## 4. 当前按钮清单与行为审查

### 全局导航

| 按钮 | 当前行为 | 分类 |
| --- | --- | --- |
| 工作台 / 货物录入 / 柜型推荐 / 3D 作业孪生 / 合规预审 / 报告导出 | `navigateModule(module.id)`，hash 同步 | READY |
| 顶部通知 / 设置 / 用户 | 可点击但无反馈 | FIXABLE |

### 工作台

| 按钮 | 当前行为 | 分类 |
| --- | --- | --- |
| 维护 SKU | 跳转 `#cargo` | READY |
| 继续合规复核 | 跳转 `#compliance` | READY |
| 查看 3D 作业孪生 | 跳转 `#twin` | READY |
| 预览装柜报告 / 导出证据清单 | 跳转 `#report`，无真实预览/导出动作 | FIXABLE |
| 法规证据卡 | 当前无 `onClick` | FIXABLE |

### 货物录入

| 按钮 | 当前行为 | 分类 |
| --- | --- | --- |
| 导入 Excel | 无 `onClick` | FIXABLE |
| 添加到订单 | 修改前端 `cargoList` | READY，但表格未显示新增项 |
| SKU 表“复核” | 无 `onClick` | FIXABLE |
| VLM 拍照识别 | 打开文件选择，调用真实 VLM 封装 | READY / EXTERNAL_BLOCKER：依赖外部模型可用性 |
| 重试识别 | 重置 VLM 状态 | READY |
| 继续 | 跳转 `#container` | READY |

### 柜型推荐

| 按钮 | 当前行为 | 分类 |
| --- | --- | --- |
| 顶部生成装柜方案 | 调用 `handleRun` | FIXABLE：失败会静默 fallback |
| 20GP / 40GP / 40HQ | 修改 `selectedContainerType`，但选中样式写死 40HQ | FIXABLE |
| 查看推荐解释 | 当前不存在 | FIXABLE |
| 右侧生成 | 调用 `handleRun` | FIXABLE：同上 |

### 3D 作业孪生

| 按钮 | 当前行为 | 分类 |
| --- | --- | --- |
| 播放 / 暂停 | `setAutoPlay`，真实推进 `progress` | READY |
| 重置 | `setProgress(0)` | READY |
| 总览 / 门端 / 俯视 / 侧视 | 无真实相机/状态行为 | FIXABLE |
| 全屏 | 无真实行为 | FIXABLE |
| 确认完成 | 无真实行为 | FIXABLE |
| 跳过此步 | 无真实行为 | FIXABLE |
| 查看算法依据 | 无真实弹窗 | FIXABLE |
| 进入合规预审 | 当前页面没有明确按钮 | FIXABLE |

### 合规预审

| 按钮 | 当前行为 | 分类 |
| --- | --- | --- |
| AI 深度审计 | 调用 `runAiComplianceAudit` | READY / EXTERNAL_BLOCKER：依赖外部 AI 成功，但失败有真实降级状态 |
| 完成复核并导出 | 直接跳转报告页，不检查复核状态 | FIXABLE |
| 标记当前项已复核 | 无真实行为 | FIXABLE |
| RAG 证据列表 | 无真实详情参数，不能打开法规详情 | FIXABLE |
| 进入报告导出 | 跳转 `#report` | READY，但状态未由复核行为驱动 |

### 报告导出

| 按钮 | 当前行为 | 分类 |
| --- | --- | --- |
| 返回复核 | 跳转 `#compliance` | READY |
| 生成导出包 | 无真实行为 | FIXABLE |
| 预览 PDF | 无真实行为；且项目无 PDF 后端 | FIXABLE：应改为“预览报告”并打开真实 HTML 预览 |
| 全屏查看 | 无真实行为 | FIXABLE |
| 文件表“预览” | 无真实行为 | FIXABLE |
| 确认可生成 | 无真实行为 | FIXABLE |

## 5. 页面视觉接近设计稿程度

| 页面 | 当前结论 |
| --- | --- |
| 工作台 | 二轮达到可验收基线；仍需真实按钮和风险详情弹窗 |
| 货物录入 | 视觉接近；需要让表格和状态来自真实前端状态 |
| 柜型推荐 | 视觉接近；需要真实选中态、推荐解释弹窗和生成失败反馈 |
| 3D 作业孪生 | 真实渲染存在；需要减少“静态 HUD”感，让视角/依据/步骤按钮真实 |
| 合规预审 | 视觉接近；但矩阵和证据链应从规则/证据数据派生 |
| 报告导出 | 视觉接近；最大缺口是真实导出能力 |

## 6. 当前前后端是否打通

结论：部分打通。

- `vite.config.js` 已配置 `/api -> http://127.0.0.1:3000` 代理。
- 后端在本机 3000 启动成功，数据库连接成功。
- `POST /api/packing/generate` 已验证真实可用。
- RAG 法规库接口已验证真实可用。
- VLM 状态接口已验证真实可用。
- 前端仍需要处理后端失败：禁止把后端失败静默包装成本地成功。

分类：FIXABLE。

## 7. 当前 3D 是否真实渲染

结论：READY。

- `PackingScene` 使用 Three.js 真实 canvas。
- 使用 `plan.loadedCargo`、`plan.containerInfo`、`plan.cog` 绘制集装箱、货物和重心。
- 已有播放条通过 `progress` 改变可见货物数量。

仍需修复：

- 视角切换按钮需要真实控制相机或前端状态。
- 查看算法依据需要真实弹窗。
- 当前作业确认/跳过需要真实改变前端步骤状态。

## 8. 当前合规是否真实基于规则或接口

结论：部分 READY，部分 FIXABLE。

- `buildComplianceReport` 是真实本地规则，属于 REAL_LOCAL_RULE。
- `runAiComplianceAudit` 调用真实 `/api/packing/compliance-check-sync`，失败显示降级状态，属于 REAL_BACKEND + EXTERNAL_BLOCKER 可能性。
- `RegulationRAGService` 是真实静态法规库 + TF-IDF 检索，属于 REAL_STATIC_LIBRARY。

问题：

- 当前合规页可视矩阵是硬编码演示矩阵，不直接使用 `compliance.rows`。
- 右侧 RAG 列表未传真实 evidence，不能打开法规详情。
- “标记当前项已复核”无状态变化。

分类：FIXABLE。

## 9. 当前报告导出是否真实可用

结论：NOT READY / FIXABLE。

当前报告页只是视觉展示：

- `生成导出包` 无行为。
- `预览 PDF` 无行为，且项目无真实 PDF 后端。
- 文件表操作无行为。
- 操作留痕是静态文本。

修复方向：

- 改“预览 PDF”为“预览报告”，打开真实 HTML 报告预览弹窗。
- 实现 HTML 报告下载。
- 实现 CSV 法规证据清单下载。
- 实现 JSON 全量数据下载。
- 若不能实现 zip，则移除或禁用“全量导出包/生成导出包/一键导出全部”，不得假成功。

## 10. 当前完整录屏路径能否跑通

结论：当前不能完整真实跑通，分类 FIXABLE。

可用部分：

1. 打开工作台。
2. 跳转货物录入。
3. 表单可编辑，添加会改变 `cargoList`。
4. 跳转柜型推荐。
5. 生成装柜方案能调用后端，但失败会静默 fallback。
6. 3D 真实渲染。
7. 跳转合规页。

不可用或不合格部分：

1. SKU 表不显示新增货物。
2. 导入 Excel/CSV 无行为。
3. 柜型推荐解释无弹窗。
4. 3D 视角/全屏/算法依据/步骤确认无行为。
5. 合规复核按钮无行为。
6. RAG 证据详情按钮无行为。
7. 报告预览和下载无真实能力。

## 11. 当前 BLOCKER

| 项 | 分类 | 说明 |
| --- | --- | --- |
| 外部 VLM 识别 | EXTERNAL_BLOCKER 可能 | 状态接口显示 key 已配置，但真实图片识别仍可能受模型额度/网络影响；失败时必须显示真实错误 |
| 外部 AI 深度审计 | EXTERNAL_BLOCKER 可能 | key 已配置，但调用可能受额度/网络影响；失败时显示真实降级，不显示成功 |
| PDF / XLSX / ZIP 后端导出 | OUT_OF_SCOPE | 项目当前无真实后端导出；本轮应实现 HTML / CSV / JSON 前端真实导出，PDF 通过浏览器打印 |

## 12. 后续必须修复的 FIXABLE 项

1. 禁止 `runPackingScenario` 失败时静默 fallback 为成功；失败应显示真实错误，保留已有方案但不宣称后端成功。
2. 货物录入表格必须显示当前 `cargoList`，新增货物后可见。
3. 导入按钮改为“导入 CSV”，实现真实 CSV 文件选择和解析。
4. VLM 静态识别结果卡只在真实识别成功后展示；不可用时展示真实错误/手动录入提示。
5. AI 属性体检改为基于当前 `cargoList` 的真实规则检查。
6. 柜型对比选中态绑定 `selectedContainerType`。
7. 查看推荐解释弹窗真实来自当前货物/柜型数据。
8. 3D 视角切换、全屏、算法依据、确认完成、跳过此步、进入合规预审真实可用。
9. 合规矩阵和证据列表从规则/法规库数据派生；证据按钮打开真实详情。
10. 标记当前项已复核真实改变复核状态，报告页状态由此驱动。
11. 报告页实现真实 HTML / CSV / JSON 预览与下载；移除或禁用无法真实实现的 zip/PDF 下载。

阶段 1 结论：进入修复阶段。
