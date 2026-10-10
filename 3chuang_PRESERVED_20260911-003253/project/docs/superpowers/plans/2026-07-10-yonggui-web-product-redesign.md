# Yonggui Web Product Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将甬柜易算六页 Web 工作台和 Three.js 作业孪生重构为可录屏、可复核、响应稳定的 2026 现代浅色物流 AI 产品。

**Architecture:** 保留 `App.jsx` 的业务状态、API handler、`runPackingScenario` 和合规调用，逐页迁移纯表现层。先用 Playwright 建立视觉门禁，再修壳层与工作台，随后重构 3D 镜头和布局，最后收敛其余四页。Three.js 继续读取 `plan.loadedCargo`、`containerInfo`、`cog` 并保留 InstancedMesh。

**Tech Stack:** React 18、Vite 5、Three.js 0.179、Lucide React、Playwright、CSS。

## Global Constraints

- 不修改后端接口、装箱算法、`runPackingScenario`、VLM、DeepSeek 合规和 RAG 调用契约。
- 不修改 `plan.loadedCargo`、`containerInfo`、`cog` 数据结构，不移除 InstancedMesh。
- 不引入大型 UI 框架，不把参考稿作为背景，不使用红金、深色大屏、霓虹蓝紫或重后处理。
- 页面数据必须来自当前会话状态；本地预演、后端方案、AI 审计的来源必须显式可见。
- 每个任务完成后运行 `cd web-dashboard && npm run build`。
- 每页验收视口为 1672 × 941 和 1280 × 720。

---

### Task 1: 建立视觉门禁

**Files:**
- Create: `tools/yonggui_visual_gate.mjs`
- Create: `docs/design_reviews/product-redesign/`

**Interfaces:**
- Consumes: `FRONTEND_URL`，默认 `http://127.0.0.1:5173/`
- Produces: `docs/design_reviews/product-redesign/visual-gate-results.json` 与六页双视口截图

- [ ] **Step 1: 写失败门禁**

脚本必须断言：默认首页包含“港前装柜智能工作台”，不包含 `packing_plan 表`；六页主标题可见；3D 页存在非空 canvas；1672 宽度时 `.twin-layout` 为两列；1280 宽度时表格状态列和页面主操作可见。

- [ ] **Step 2: 运行并确认 RED**

Run: `node tools/yonggui_visual_gate.mjs`

Expected: FAIL，至少报告首页标题不符或包含内部数据库文案，证明测试能捕获当前回归。

- [ ] **Step 3: 保存失败证据**

保留 JSON 和截图，不修改断言来迁就当前实现。

### Task 2: 收敛 token 与壳层

**Files:**
- Modify: `web-dashboard/src/designTokens.css`
- Modify: `web-dashboard/src/main.jsx`
- Create: `web-dashboard/src/styles/product-shell.css`
- Modify: `web-dashboard/src/App.jsx`

**Interfaces:**
- Consumes: 现有 `.yg-shell`、`.yg-sidebar`、`.yg-topbar` DOM
- Produces: 稳定的 218px 侧栏、58px 顶栏和统一页面容器

- [ ] **Step 1: 修复 token**

删除无效的 `#eaef f5`、重复变量和所有负字距；统一卡片圆角 8px、按钮 6px、阴影和状态色。

- [ ] **Step 2: 引入最终壳层样式**

在 `main.jsx` 最后导入 `styles/product-shell.css`。样式只负责壳层、页面容器、标题、订单条和响应式，不定义业务页面内部组件。

- [ ] **Step 3: 标识数据来源**

顶部当前订单行新增紧凑来源标签，值只能是 `本地预演`、`后端方案` 或 `AI 审计`，来源由 `runState` 和 `aiAuditState` 派生。

- [ ] **Step 4: 验证**

Run: `cd web-dashboard && npm run build`

Expected: PASS；1672 与 1280 下侧栏、顶栏无重叠。

### Task 3: 恢复任务型工作台

**Files:**
- Modify: `web-dashboard/src/App.jsx`
- Create: `web-dashboard/src/styles/dashboard.css`
- Modify: `tools/yonggui_visual_gate.mjs`

**Interfaces:**
- Consumes: `scenario`、`plan`、`compliance`、`cargoList`、`container`、`aiSignals`
- Produces: 当前订单流程、指标、任务、建议、方案、风险和报告入口

- [ ] **Step 1: 扩展失败断言**

断言首页存在“录货完成”“方案已生成”“合规”“可导出执行”“当前方案预览”“风险摘要”，且不存在 `/api/dashboard/`、`packing_plan 表`、`SYSTEM LIVE`。

- [ ] **Step 2: 运行并确认 RED**

Run: `node tools/yonggui_visual_gate.mjs --page dashboard`

Expected: FAIL，报告缺少任务型模块或存在内部系统文案。

- [ ] **Step 3: 切换首页实现**

用现有 `DashboardModule` 替代 `DashboardConsoleV9`，传入当前会话真实 props；删除首页对 `fetchAllDashboardData` 的用户界面依赖。后台聚合代码可暂留但不渲染。

- [ ] **Step 4: 精修布局**

1672 首屏按 `1.45fr / .8fr / .82fr` 布局；1280 改为主表 + 右侧决策栏的两列。消除最近任务表下方大块空白，使中间和右栏高度平衡。

- [ ] **Step 5: 验证 GREEN**

Run: `node tools/yonggui_visual_gate.mjs --page dashboard`

Expected: PASS。

Run: `cd web-dashboard && npm run build`

Expected: PASS。

### Task 4: 重构 3D 镜头与作业台

**Files:**
- Modify: `web-dashboard/src/App.jsx`
- Create: `web-dashboard/src/three/sceneCamera.js`
- Create: `web-dashboard/src/styles/twin.css`
- Modify: `tools/yonggui_visual_gate.mjs`

**Interfaces:**
- Consumes: `containerInfo.innerLength/innerWidth/innerHeight` 与 canvas 宽高
- Produces: `getCameraPreset(containerInfo, viewport, preset)` 返回 `{ position, target, near, far }`

- [ ] **Step 1: 写相机单元测试**

新增脚本内测试：40HQ 在 16:9、4:3 和窄屏画布下，计算结果必须为有限数，距离大于容器对角线的一半，且四个 preset 使用同一容器中心目标。

- [ ] **Step 2: 运行并确认 RED**

Run: `node tools/yonggui_visual_gate.mjs --unit camera`

Expected: FAIL，`sceneCamera.js` 不存在。

- [ ] **Step 3: 实现包围盒拟合相机**

使用容器米制尺寸、FOV 和 aspect 计算距离；总览包含门端作业区，门端/俯视/侧视用同一 target。不要读取或修改货物坐标。

- [ ] **Step 4: 接入 PackingScene**

替换固定相机倍数；每次 viewPreset 或容器变化时更新相机；保持 OrbitControls、InstancedMesh、动画循环和数据读取不变。

- [ ] **Step 5: 重排 3D 首屏**

1672 下 viewer 与作业栏两列，viewer 高度为 `calc(100vh - 270px)` 且限制在 620 到 690px；HUD 压缩到单行；约束条移到底部；右栏首屏完整显示作业指令、三按钮和前三个队列项。

- [ ] **Step 6: 校准场景层次**

集装箱主体约占画面宽度 70%；降低港区背景对比度；当前货物和风险货物使用橙色描边；场景标签改为 Three.js Sprite 或投影标签，删除与相机无关的固定 A/B/C CSS 标注。

- [ ] **Step 7: 验证 GREEN**

Run: `node tools/yonggui_visual_gate.mjs --page twin`

Expected: PASS，四视角截图均有非空 canvas，容器主体未被裁掉。

Run: `cd web-dashboard && npm run build`

Expected: PASS。

### Task 5: 收敛货物录入与柜型推荐

**Files:**
- Modify: `web-dashboard/src/App.jsx`
- Create: `web-dashboard/src/styles/cargo.css`
- Create: `web-dashboard/src/styles/container.css`
- Modify: `tools/yonggui_visual_gate.mjs`

**Interfaces:**
- Consumes: 现有货物表单、CSV、VLM、`containerRecommendations` 和 `handleRun`
- Produces: 稳定三栏/两栏布局和可见表格操作

- [ ] **Step 1: 写失败断言**

断言货物页表格的“状态”“操作”列可见；柜型页主卡显示真实 loaded/total、利用率和未装入件数；1280 下主按钮仍在首屏。

- [ ] **Step 2: 运行并确认 RED**

Run: `node tools/yonggui_visual_gate.mjs --page cargo,container`

Expected: 当前表格裁切或主内容超出首屏时 FAIL。

- [ ] **Step 3: 实现响应式布局与真实缩略**

1440 以上三栏，1100-1439 两栏；SKU 表格允许横向滚动但固定状态/操作可见；柜型预估从 `plan.loadedCargo` 生成轻量 canvas/Three 缩略，不使用固定示意块。

- [ ] **Step 4: 验证 GREEN 与 build**

Run: `node tools/yonggui_visual_gate.mjs --page cargo,container`

Run: `cd web-dashboard && npm run build`

Expected: 全部 PASS。

### Task 6: 收敛合规与报告

**Files:**
- Modify: `web-dashboard/src/App.jsx`
- Create: `web-dashboard/src/styles/compliance.css`
- Create: `web-dashboard/src/styles/report.css`
- Modify: `tools/yonggui_visual_gate.mjs`

**Interfaces:**
- Consumes: `compliance`、`aiAuditState`、`reviewedWarnings`、RAG 证据与真实下载函数
- Produces: 规则事实、AI 解释、人工结论三层审核台和真实交付中心

- [ ] **Step 1: 写失败断言**

断言合规页显示当前 AI 状态来源；报告页不出现无支撑的 PDF、ZIP、XLSX 下载；HTML、CSV、JSON 控件可见；页面数字与当前 plan/compliance 一致。

- [ ] **Step 2: 运行并确认 RED**

Run: `node tools/yonggui_visual_gate.mjs --page compliance,report`

- [ ] **Step 3: 精修信息层级**

合规页首屏保留评分、矩阵、RAG 和证据；整改与流程进入紧凑区域。报告页中间预览加入当前方案缩略和矩阵摘要，降低阻断横幅高度。

- [ ] **Step 4: 验证 GREEN 与 build**

Run: `node tools/yonggui_visual_gate.mjs --page compliance,report`

Run: `cd web-dashboard && npm run build`

Expected: 全部 PASS。

### Task 7: 清理旧视觉层并完成全量 QA

**Files:**
- Modify: `web-dashboard/src/App.css`
- Modify: `web-dashboard/src/restore.css`
- Modify: `web-dashboard/src/App.jsx`
- Modify: `docs/design_reviews/product-redesign/FINAL_PRODUCT_DESIGN_REPORT.md`

**Interfaces:**
- Consumes: 六页通过后的新样式文件
- Produces: 无重复旧页面规则的最终样式层和验收报告

- [ ] **Step 1: 删除死代码和重复页面样式**

删除未渲染的 `DashboardConsoleV9` 及对应 CSS；删除已迁移页面在 `restore.css` 中的重复定义。保留仍被业务组件使用的基础样式。

- [ ] **Step 2: 扫描禁止项**

Run: `rg -n "PPC|Bloom|God Rays|particle|red-gold|packing_plan 表|SYSTEM LIVE" web-dashboard/src`

Expected: 不出现 standalone `PPC`、重后处理、红金样式或用户界面内部表名。

- [ ] **Step 3: 全量视觉与交互验证**

Run: `node tools/yonggui_visual_gate.mjs`

Expected: 六页双视口、四个 3D 视角、核心按钮和 canvas 检查全部 PASS。

- [ ] **Step 4: 最终 build**

Run: `cd web-dashboard && npm run build`

Expected: PASS，无编译错误。

- [ ] **Step 5: 生成报告**

报告必须列出修改文件、build、截图、每页评分、3D 视角结果、真实数据来源、已知差距和是否可进入录屏。

## Plan Self-Review

- 设计规范的六页、壳层、响应式、动效、错误态和 3D 要求均有对应任务。
- 计划没有要求改后端接口、算法或 Three.js 数据结构。
- 所有行为修改均先有失败门禁，再执行实现和 build。
- 文件职责和 `getCameraPreset` 接口在使用前已定义。
- 未包含 `TBD`、`TODO` 或“稍后实现”占位。

自审结论：**计划可执行。优先顺序必须是 Task 1 → 2 → 3 → 4，之后再处理其余页面。**
