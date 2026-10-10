# 甬柜易算 Web 前端审计 · GLM-5.2 重构基线

> 阶段：第一阶段 · 只读审计
> 输出路径：`docs/frontend_glm52_redesign/01_FRONTEND_AUDIT.md`
> 审计范围：`d:\cixing\3chuang\web-dashboard\`（Web 前端） + `d:\cixing\3chuang\backend\`（API 边界对齐） + `d:\cixing\open-design\`（设计参考）
> 审计方式：纯只读。**未修改任何代码。**

---

## 1. 当前前端技术栈

| 维度 | 现状 |
|---|---|
| 框架 | React 18.3 (`react@^18.3.1`, `react-dom@^18.3.1`) |
| 构建 | Vite 5.4 (`vite@^5.4.19`, `@vitejs/plugin-react@^4.3.4`) |
| 3D | Three.js 0.179（`three@^0.179.0`，原生 ESM，无 R3F） |
| 图标 | `lucide-react@^0.468.0`（按需具名导入，未走 barrel） |
| 路由 | 无 router 库。**Hash 路由 + `activeModule` state + `&&` 条件渲染**（`App.jsx:73-77`, `359-371`, `678-797`） |
| 状态 | 全部 `useState` / `useMemo` / `useRef`，无 Redux/Zustand/Jotai |
| 样式 | 两份原生 CSS：[`App.css`](file:///d:/cixing/3chuang/web-dashboard/src/App.css) (~47KB) + [`restore.css`](file:///d:/cixing/3chuang/web-dashboard/src/restore.css) (~46KB)。无 Tailwind / CSS-in-JS / 现代设计 token 体系 |
| 字体 | `Inter, "Microsoft YaHei", "PingFang SC", system-ui` — 通用栈，无 display 字体 |
| 包大小告警 | `chunkSizeWarningLimit: 900`；`react` 与 `three` 已 `manualChunks` 拆包 |
| 部署代理 | Vite dev proxy `/api → http://127.0.0.1:3000`（后端 Express） |

**单文件体量：[`App.jsx`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx) 3680 行 / 160KB**，是后续重构的最大单点风险。

### 模块清单（`App.jsx:63-70`）

| id | 标签 | 副标题 | 图标 |
|---|---|---|---|
| `dashboard` | 工作台 | 订单 / 风险 / 建议 | `Gauge` |
| `cargo` | 货物录入 | SKU / 属性 / VLM | `ClipboardList` |
| `container` | 柜型推荐 | 算柜 / 成本 / 约束 | `Container` |
| `twin` | 3D 作业孪生 | 装载 / 路径 / HUD | `Layers3` |
| `compliance` | 合规预审 | RAG / 证据 / 复核 | `ShieldCheck` |
| `report` | 报告导出 | 成果 / 文件 / 留痕 | `FileText` |

---

## 2. 页面清单（含组件入口与行号）

| 页面 | 渲染组件 | 行号 | 关键依赖 |
|---|---|---|---|
| 工作台首页 | `DashboardModule` | [`841-953`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L841-L953) | `DEMO`/`DEMO_SUMMARY.dashboard`/`DEMO_RISK_ITEMS`/`plan`/`compliance` |
| 货物录入 / VLM | `CargoModule` | [`1629-1830`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1629-L1830) | `cargoList`/`cargoForm`/`vlmState`/`vlmCargo.js` |
| 柜型推荐 | `ContainerModule` | [`1832-2034`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1832-L2034) | `plan`/`buildContainerRecommendations`/`compliance` |
| 3D 作业孪生 | `TwinModule` + `PackingScene` | [`2036-2321`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2036-L2321) / [`2823-2921`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2823-L2921) | `plan`/`rawPlan`/`progress`/`visualMode`/`viewPreset` |
| 合规预审 / RAG | `ComplianceModule` + `RegulationModal` | [`2540-2763`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2540-L2763) / [`2766-2821`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2766-L2821) | `compliance`/`aiAuditState`/`hybridRag`/`aiCompliance.js` |
| 报告导出 | `ReportModule` | [`1039-1264`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1039-L1264) | `plan`/`compliance`/`buildReportHtml`/`buildEvidenceCsv`/`buildExportJson` |

**Shell 组件**：`App`（316-802，root 状态 + hash 路由 + 顶栏 + 侧栏）、`PageHeader`（804-815）、`OrderSummaryBar`（817-839）。

**已定义但未挂载**（dead code，重构时应清理或归位）：`MissionDeck` (1570-1614)、`MetricStrip` (1616-1627)、`TypewriterText` (2336-2365)、`AgentPipeline` (2409-2449)、`SavingsPanel` (2489-2538)、`RadarItem` (3344-3352)。

---

## 3. Three.js 3D 代码入口

入口：[`PackingScene`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2823-L2921) — 由 `TwinModule` 第 2136 行挂载。

### 3.1 场景生命周期（`PackingScene`）

- `THREE.Scene`：浅色港口背景 `#EAF0F5` + Fog `18→34`
- `PerspectiveCamera` 38° FOV，初始位 `(10.8, 6.2, 9.8)`，目标 `(0.2, 0.85, 0)`
- `WebGLRenderer`：抗锯齿、阴影、ACESFilmic tone mapping、exposure 1.12、像素比上限 1.35
- 灯光：`HemisphereLight(白/灰 0.85)` + `DirectionalLight(白 1.8)` 主光 + `DirectionalLight(#1456A0 0.45)` 港口蓝补光（替代原霓虹青 rim，注释 2859）
- `OrbitControls`：damping，距离 5–23
- `requestAnimationFrame` 循环：动画化门机小车 x 位移与 gate pulse 透明度
- `ResizeObserver` 自适应
- 清理：`cancelAnimationFrame` + `controls.dispose` + `renderer.dispose` + `disposeGroup(baseGroup)` + removeChild（合格）

### 3.2 港口环境（`buildPortBase` 2923-2970）

码头板、水面、船体+甲板、16 箱堆场、2 座门座起重机（`createGantryCrane` 2972-2982）、橙色 trolley、5 条车道线、蓝色 gate-pulse、门亭+红箱。

### 3.3 装柜渲染（`renderPlan` 2984-3050）

- 集装箱线框（`EdgesGeometry(BoxGeometry)` + `LineSegments`）
- 半透明地板
- 门框（`makeDoorFrame` 3052-3066）
- 叉车路径（`makeForkliftPath` 3068-3079）
- A/B/C 批次分区着色（`makeBatchZones` 3081-3103，受 `visualMode==='batch'` 影响）
- 货物 InstancedMesh（按颜色分组，加线框轮廓 `#3d4a55`）
- 当前装卸 ghost（`addLoadingGhost` 3105-3140）+ 3 点路径线
- 工艺决策（`decideCraft` 3143-3157）→ `makeForkliftActor`(3161) / `makeWorkerActor`(3203)
- 重心红球（`makeCogMarker` 3249-3264）

### 3.4 视图预设（`useEffect` 2905-2918）

| 预设 | 摄像机位 |
|---|---|
| 总览 | `(10.8, 6.2, 9.8)` |
| 门端 | `(8.4, 2.8, 0)` |
| 俯视 | `(0.1, 11.5, 0.1)` |
| 侧视 | `(0, 4.2, 10)` |

**结论**：3D 渲染链路真实存在、可交互、可清理；这是项目最硬的资产之一，**禁止用图片/视频替代**。

---

## 4. 当前视觉问题

| # | 问题 | 证据 | 影响 |
|---|---|---|---|
| V1 | **字体无差异化** — 纯 `Inter + 系统字体`，是 open-design `anti-ai-slop.md` 第 4 条明令的 AI-slop tell | [`App.css:4`](file:///d:/cixing/3chuang/web-dashboard/src/App.css#L4) | 评委一眼可辨"通用模板"，缺乏品牌识别 |
| V2 | **首页像普通 dashboard 卡片堆** — `dashboard-grid` 三列网格 + 5 个独立 surface，无信息主次 | [`App.jsx:888-950`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L888-L950) | 评委 5 秒看不出"装柜决策总控台"的定位 |
| V3 | **每页都像不同模板** — 工作台浅绿底网格、3D 浅蓝灰、报告白纸感，缺全局统一律动 | `App.css` + `restore.css` 80KB+ 样式 | 6 页跳转时视觉断裂，不像同一套 SaaS |
| V4 | **状态色与浅底冲突** — `pass` 绿色块在浅绿底色上对比度低；橙色主按钮 `#D17A2E` 与 warning 标签 `#F97316` 视觉打架 | [`App.css:194-198`](file:///d:/cixing/3chuang/web-dashboard/src/App.css#L194-L198) | 状态信息辨识慢 |
| V5 | **HUD/卡片信息密度不均** — `scene-hud`(2154-2160) 5 行 KPI 平铺无层级；`OrderSummaryBar` 每页塞满 | [`App.jsx:2154-2166`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2154-L2166) | 评委找不到"现在该看什么" |
| V6 | **缺乏指挥中心氛围** — 无港口意象、无作业流光、无数据流动线，"工作台"和"3D 孪生"像是两个不同产品 | 全站 | 与"港前物流 AI Command Center"定位不符 |
| V7 | **CSS token 缺位** — 仅 `:root` 写了 `color/background/font-family` 3 项；颜色散落 50+ hex | [`App.css:1-7`](file:///d:/cixing/3chuang/web-dashboard/src/App.css#L1-L7) | 改主题需全文搜替换，无法系统迭代 |
| V8 | **3D HUD 与 3D 画布割裂** — HUD 是绝对定位 `div` 浮层，与 Three.js 场景无视觉联动（无引导线、无摄像机视锥指示） | [`App.jsx:2137-2166`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2137-L2166) | 评委感觉"3D 是 3D，HUD 是 HUD"，不像指挥台 |
| V9 | **报告页像静态文档** — `report-paper` 是 A4 白纸感，与 SaaS 工作台反差过大 | [`App.jsx:1243-1261`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1243-L1261) | 评委感觉离开了产品，进入了"打印预览" |
| V10 | **状态色与 open-design 4 层调色板不符** — neutrals 占比不足 70%，accent 在每页超过 2 次 | open-design `craft/color.md` | 视觉杂乱，焦点涣散 |

---

## 5. 当前交互问题

| # | 问题 | 证据 | 影响 |
|---|---|---|---|
| I1 | **`reviewed` 永远为 true** — `isCompliancePassed(compliance) || DEMO.complianceStatus === 'PASS' || reviewedWarnings.size >= 2`，第二项是常量 `true` | [`App.jsx:1040`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1040), [`App.jsx:2542`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2542) | 报告"可导出"状态永远亮 PASS，即使真实 `compliance.status==='FAIL'` — **最大假成功风险** |
| I2 | **`markCurrentReviewDone` 一次点击满足条件** — 同时写入 2 个 reviewedWarnings，且 toast 文案断言"真实合规结果为 本地规则 WARNING / AI建议 PASS / 人工复核独立" | [`App.jsx:524-532`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L524-L532) | 评委若让 AI 审计失败后点这个按钮，UI 仍显示已复核 PASS — 与"不要把失败状态展示成成功"硬冲突 |
| I3 | **`buildOperationalComplianceRows` 6 行全 PASS 硬编码** — 不读 `plan`/`compliance`/`cargoList` | [`App.jsx:1449-1458`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1449-L1458) | 合规矩阵表与真实状态脱节 |
| I4 | **`DEMO_AI_SUGGESTIONS` 第 2 行硬编码"DeepSeek V4 Flash 已完成审计，当前方案为 本地规则 WARNING / AI建议 PASS / 人工复核独立"** — 不论 `aiAuditState` 是 idle/running/degraded | [`App.jsx:250-255`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L250-L255), [`App.jsx:955-982`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L955-L982) | AI 建议面板说谎，与 `handleAiAudit` 的诚实降级相互打架 |
| I5 | **3D HUD 数字硬编码** — `"42%"`, `"SKU-C08 木托包装件"`, `"叉车推入"`, `"PASS"`，不随 `progress`/`currentItem`/`compliance` 变化 | [`App.jsx:2154-2160`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2154-L2160) | 拖动 `playback-bar` 改 progress，HUD 数字纹丝不动 — 评委一眼看穿 |
| I6 | **Twin 步骤队列硬编码 5 行** — 不来自 `plan.loadedCargo` | [`App.jsx:2242-2254`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2242-L2254) | 与 3D 实际装卸顺序脱节 |
| I7 | **`handleDownloadAll` 只下 JSON** — 但文案叫"下载全部"，误导 | [`App.jsx:1058-1061`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1058-L1061) | 评委期待 ZIP，实际只有一个 JSON |
| I8 | **报告 HTML 头部 KPI 全用 `DEMO.*`** — 即使 `plan.loadedCargo.length` 是 0，报告仍印 `loadedPieces: 221` | [`App.jsx:1481-1531`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1481-L1531) | 导出件与现场数据不一致，与"数据一致性"硬约束冲突 |
| I9 | **`ContainerModule` 矩阵与风险列表全硬编码 PASS** — 不接收 `compliance` prop | [`App.jsx:1834-1837`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1834-L1837), [`App.jsx:1985-1988`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1985-L1988) | 柜型推荐页显示"已合规"与真实审计脱节 |
| I10 | **首页 `processSteps` 第 3 步硬编码"合规已通过 本地规则 WARNING / AI建议 PASS / 人工复核独立"** — 不论审计状态 | [`App.jsx:848-853`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L848-L853) | 进入首页即看到"合规已通过"，与未运行审计的现实冲突 |
| I11 | **无 loading skeleton / empty / error 五态覆盖** — 多数面板只渲染 populated 态 | open-design `craft/state-coverage.md` | 网络慢/失败时面板空白，无降级提示 |
| I12 | **`toast` 用 setTimeout 自动消失，无 hover 暂停** | `App` toast 状态机 | 违反 WCAG 2.2.1（暂停/停止/隐藏） |
| I13 | **顶栏与侧栏无 active 视觉强对比** — `yg-nav` active 仅靠左侧色条，无背景/字重对比 | `App.css` yg-nav 段 | 评委切页时反馈弱 |

---

## 6. 当前 3D 作业孪生问题

| # | 问题 | 证据 / 行号 | 影响 |
|---|---|---|---|
| T1 | **HUD 与 3D 数据脱钩** — 5 行 HUD 全部硬编码，不读 `progress`/`currentItem`/`plan.cogOffset`/`compliance` | [`App.jsx:2154-2160`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2154-L2160) | 评委拖动播放条 HUD 数字不变，瞬间穿帮 |
| T2 | **A/B/C 分区标注是 DOM 文字浮层** — 与 3D 场景内 `makeBatchZones` 着色无视觉关联 | [`App.jsx:2141-2143`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2141-L2143) vs [`App.jsx:3081-3103`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L3081-L3103) | "A 区/B 区/C 区"标在画布左上角，与画面里实际分区颜色对不上 |
| T3 | **门端方向无视觉标识** — 3D 有 `makeDoorFrame`，但 HUD/标注层无"门端/箱底"方向指示 | [`App.jsx:2138-2140`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2138-L2140) | 评委不知道哪头是门、哪头是底 |
| T4 | **叉车/工人 actor 静态** — `makeForkliftActor`/`makeWorkerActor` 在 `addLoadingGhost` 内生成，但不跟随 `t` 动画（除叉齿 y 振荡和工人手臂 `rotation.z` 振荡） | [`App.jsx:3161-3247`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L3161-L3247) | "叉车路径"实际是静态线 + 静态模型，不是"作业动画" |
| T5 | **目标位无高亮** — `twin-annotations` DOM 写"目标位 B2/底层"，但 3D 场景内 `currentItem` 目标位无 box outline / pulse | [`App.jsx:2139`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2139) | 评委看不到"这件货要放到哪里" |
| T6 | **未装入提示缺位** — `plan.unloadedCargo` 0 件在 3D 场景内无任何视觉表达（堆在场景外？灰显？） | `renderPlan` 不渲染 unloaded | 评委不知道"装不下的货在哪" |
| T7 | **风险货物描边弱** — `colorForCargo('risk')` 仅换色，无额外 outline / 标签 | [`App.jsx:3296-3311`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L3296-L3311) | 易碎/危险品不够显眼 |
| T8 | **作业步骤队列与算法依据弹窗脱节** — 队列硬编码 5 行；`decision-modal` 内部数字也用 `DEMO.*` | [`App.jsx:2242-2254`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2242-L2254), [`App.jsx:2298-2310`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2298-L2310) | "查看算法依据"打开后看到的不是当前 plan 的真实依据 |
| T9 | **默认视角偏俯** — 总览 `(10.8, 6.2, 9.8)` 角度偏俯，门端反而不在画面中心 | [`App.jsx:2837`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2837), [`App.jsx:2909`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2909) | 演示首屏看不到"门"这个最具识别度的元素 |
| T10 | **全屏后 HUD 不缩放** — `viewer-stage` 全屏后 `scene-hud` 仍按原尺寸贴在角落，画面占比小 | [`App.jsx:2124-2134`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2124-L2134) | 全屏演示时 HUD 看不清 |
| T11 | **图层筛选按钮无效果** — `layer-groups` 8 个 button 无 `onClick`，纯装饰 | [`App.jsx:2263-2272`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2263-L2272) | 评委点击无反应，"图层"功能是假的 |
| T12 | **voiceCaption 仅在 `voiceEnabled` 时显示，且无 TTS 引擎真实状态联动** | [`App.jsx:2071-2079`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2071-L2079) | "豆包语音"标签可能不准确（实际 TTS 引擎由 `/api/tts/status` 探测，但 `TwinModule` 不读该状态） |

---

## 7. 当前合规 / RAG 页面问题

| # | 问题 | 证据 / 行号 | 影响 |
|---|---|---|---|
| C1 | **评分卡硬编码 `DEMO.complianceScore=100` + `<StatusTag>pass>PASS`** — 不读 `compliance` prop | [`App.jsx:2625-2632`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2625-L2632) | 真实审计 FAIL 时仍显示 100 分 PASS — 假成功 |
| C2 | **风险列表 4 行硬编码 PASS** — 不读 `compliance.rows` | [`App.jsx:2634-2638`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2634-L2638) | 与真实风险脱节 |
| C3 | **`buildOperationalComplianceRows` 6 行硬编码 PASS** 喂入 `matrixRows` | [`App.jsx:1449-1458`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1449-L1458), [`App.jsx:2586-2592`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2586-L2592) | 合规矩阵表永远 PASS |
| C4 | **`reviewed` 永远 true**（同 I1）→ 报告入口永远放行 | [`App.jsx:2542`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2542) | 即使 AI 审计失败/degraded，"进入报告"按钮仍可点 |
| C5 | **`hybridRag` 区分本地/联网，但 UI 文案含糊** — 失败时显示 `FRONTEND_HYBRID_RAG_FAILED`，普通评委看不懂 | [`App.jsx:2554-2568`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2554-L2568), [`App.jsx:2718`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2718) | 联网失败应明示"联网参考不可用，已回退本地法规库"，不要技术 error code |
| C6 | **法规证据卡密密麻麻** — `RAG_EVIDENCE_ITEMS` 4 项平铺，无层级无摘要 | [`App.jsx:1406-1447`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L1406-L1447), [`App.jsx:2694-2702`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2694-L2702) | 评委看不懂"这 4 个法规跟当前方案什么关系" |
| C7 | **`PORT_CHECK_ITEMS` 8 项港口检查已定义但未渲染** | [`App.jsx:2324-2333`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2324-L2333) | 后端 `port_compliance_check` 的真实 8 项检查结果未在 UI 展示 |
| C8 | **AI 审计状态机不透出** — `aiAuditState: idle/running/done/degraded`，但 UI 无进度提示，只按钮文字变 | [`App.jsx:2602-2604`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2602-L2604) | 评委不知道审计在跑/已完成/降级 |
| C9 | **降级文案在 toast 闪现即消失** — `aiAuditReason` 不在面板常驻 | [`App.jsx:549-554`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L549-L554) | 评委错过 toast 就不知道审计降级了 |
| C10 | **人工复核按钮 toast 文案"无需记录虚构预警"** — 暗示虚构，但实际可能真有预警 | [`App.jsx:524-532`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L524-L532) | 文案误导，且按钮行为一次满足 `size>=2` 条件（同 I2） |
| C11 | **本地法规库 vs 联网参考无视觉分组** — `hybridRag.data.local_results` 与 `web_results` 同区平铺 | [`App.jsx:2718`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2718) 周边 | 评委分不清"哪条是本地库命中、哪条是联网参考" |

---

## 8. 哪些地方不能乱改（红线）

> 以下是基于"禁止条款 1/3/8/10/12/13/14/15"和真实 API 链路对项目红线的梳理。**重构方案必须保证以下不变。**

### 8.1 真实 API 端点（必须保留链路）

| 端点 | 前端封装 | 用途 | 禁止 |
|---|---|---|---|
| `POST /api/packing/generate` | [`api.js:runPackingScenario`](file:///d:/cixing/3chuang/web-dashboard/src/api.js) | 真实装箱算法 | 不可改成 mock |
| `POST /api/packing/compliance-check-sync` | [`aiCompliance.js:runAiComplianceAudit`](file:///d:/cixing/3chuang/web-dashboard/src/aiCompliance.js) | DeepSeek AI 合规审计 | 不可静默降级为 PASS |
| `GET /api/compliance/regulation/:docId` | `fetchRegulationDetail` | 法规详情 | 不可用静态 JSON 替代 |
| `GET /api/compliance/regulations` | `fetchRegulationList` | 法规列表 | 同上 |
| `POST /api/compliance/hybrid-search` | `searchHybridRegulations` | 本地+联网 RAG | 联网失败必须显式标注 |
| `POST /api/vlm/recognize-cargo` | `vlmCargo.js:recognizeCargoByImage` | VLM 拍照录货 | 失败不得显示成功 |
| `GET /api/vlm/status` | `checkVlmStatus` | VLM 健康探测 | 同上 |
| `GET /api/tts/status` | `App` 内 | 火山 TTS 健康探测 | 同上 |

### 8.2 真实数据流（不可切断）

- `handleRun` → `setPlan(backendResult)` → `plan.loadedCargo/unloadedCargo/cogOffset/spaceUtilization` 必须驱动 UI
- `handleAiAudit` → `setCompliance(aiReport)` → `compliance.rows/status/score/risks` 必须驱动 UI
- `handleVlmRecognize` → `setVlmState('done'|'failed')` → 必须真实反映 VLM 结果
- `searchHybridRegulations` → `hybridRag.data.local_results/web_results/source_summary.web_available` 三态必须真实呈现
- `localCompliance = buildComplianceReport(plan, cargoList, container, vgm)` — 本地规则基线，AI 失败时的可信兜底

### 8.3 装箱算法边界（禁止重写）

- `backend/services/*PackingEngine*.js` 全部不动
- `web-dashboard/src/packingDemo.js` 的 `generateFallbackPlan` / `normalizeApiResult` 不动
- 3D `renderPlan` 不重写装箱逻辑，只重写渲染层

### 8.4 数据库结构（禁止改）

- `backend/config/init.sql` / `migrations/*.sql` 不动
- `backend/models/*.js` 不动

### 8.5 安全边界

- 不读取、不输出 `.env` / `.env.example` 内 API Key
- 不在前端代码硬编码任何 API Key、Bearer Token、Secret
- 报告导出仅限 HTML / CSV / JSON 三种真实生成格式；**禁止**声称 PDF / XLSX / ZIP（除非真实生成）

### 8.6 3D 边界

- 保留 `THREE.WebGLRenderer` 真实渲染，禁止用 `<img>` / `<video>` / 静态截图替代
- 不引入重模型（GLTF loader 加载外部 .glb/.gltf 禁止）
- `OrbitControls` 交互必须保留

### 8.7 失败即失败（不可粉饰）

- `handleRun` 失败 → `runState='error'` + warning toast + `progress=0.62` 兜底（保留现状）
- `handleAiAudit` 失败 → `aiAuditState='degraded'` + `aiAuditReason` 文案（保留现状，但需常驻面板）
- `handleVlmRecognize` 失败 → `vlmState='failed'` + "不展示假成功"文案（保留现状）
- `searchHybridRegulations` 失败 → `web_available=false` + `web_error` 文案（保留现状，但需明示"联网不可用"）

---

## 9. open-design 参考提取

来源：`d:\cixing\open-design\craft\*.md`，与本项目相关的关键规则。

### 9.1 反 AI-slop 七宗罪（`anti-ai-slop.md`）

| 罪 | 本项目现状 | 重构必须 |
|---|---|---|
| 默认 Tailwind indigo 作 accent | 未使用 indigo，主色是港口蓝 `#1456A0` + 橙 `#D17A2E` | 保留非 indigo 主色 |
| 紫蓝渐变 hero | 无 | 禁止引入 |
| Emoji 当 feature icon | 无（用 lucide-react） | 保持 |
| Sans-serif 当 display 字体 | **违反** — Inter 当所有字体 | 必须引入 display 字体 |
| 圆角卡 + 左侧色条 accent | **违反** — `craft-card` 用 `borderLeftColor`（[App.jsx:2168](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx#L2168)） | 改为其他强调方式 |
| 虚构指标 | **违反** — "17 分钟"、"42%"、"本地规则 WARNING / AI建议 PASS / 人工复核独立" 等无来源 | 必须来自 `plan`/`compliance` 或标注"演示值" |
| 填充文案 | 无 | 保持 |

### 9.2 色彩 4 层调色板（`color.md`）

| 层 | 占比 | 本项目应做 |
|---|---|---|
| Neutrals | 70-90% | 港口灰白 + 浅蓝灰底 |
| Accent（一种） | 5-10% | 港口蓝 `#0F5CFF`（保留既有方向） |
| Semantic | 0-5% | PASS 绿 / WARNING 橙 / FAIL 红 / PENDING 灰 / DEGRADED 棕 |
| Effect | <1% | 仅 3D 场景内 fog / shadow |

**硬约束**：accent 每屏 ≤ 2 次可见使用。本项目当前每页 accent 滥用，必须收敛。

### 9.3 字体律（`typography.md`）

- 6-8 个字号；1.2-1.25 倍率
- ALL CAPS 必须 `letter-spacing: 0.06em-0.1em`
- 显示字号 ≥32px 必须 `letter-spacing: -0.01em ~ -0.02em`
- 3 字重系统：Read 400 / Emphasize 550 / Announce 600
- 最多 2 种字体（display + body）
- 行宽 50-75 字符

### 9.4 动效纪律（`animation-discipline.md`）

- 默认 150ms 状态确认反馈
- 200-300ms 入场（modal/sheet）
- 300-500ms 跨屏过渡
- 50-100ms 即时反馈（按钮按下）
- **必须** `@media (prefers-reduced-motion: reduce)` 兜底
- 工作画布内禁装饰性动画（3D 场景的 trolley/gate-pulse 是 ambient，需提供关闭开关）
- 60s+ spinner 必须停止并报错

### 9.5 状态覆盖 5 态（`state-coverage.md`）

每个 fetch/transform/accept data 的 surface 都必须有：loading / empty / error / populated / edge。本项目当前**只渲染 populated**，是最大缺陷之一。

---

## 10. 推荐设计方向

> 不重写装箱算法、不改 DB、不切技术栈。在 React 18 + Vite + Three.js 框架内，**以设计 token 化 + 信息层级重排 + 3D HUD 真实化 + 假成功清零**为主线升级。

### 10.1 总方向

**港前物流 AI Command Center + 现代 SaaS 工作台 + 3D 数字孪生作业台** 三层叠合：

- **底层**：浅色 SaaS 工作台（首页/录货/柜型/合规/报告）— 信息清晰、可复核、5 态覆盖
- **中层**：港口物流语义层 — 订单流、批次流、风险流、证据流，用视觉线连接 6 页
- **高潮层**：3D 作业指挥台 — 真实 Three.js 渲染 + 真实数据驱动 HUD + 叉车/工人/分区/门端/未装入完整呈现

### 10.2 设计原则（5 条）

1. **数据真实优先**：任何 PASS / 数字 / 状态必须来自 `plan`/`compliance`/`vlmState`/`hybridRag`。DEMO 常量只用于"演示订单元信息"（orderNo/route/vessel），不用于状态判定。
2. **失败即失败**：AI 审计失败、VLM 失败、RAG 联网失败必须常驻面板明示，不得用 toast 闪现即消失。
3. **港口语义贯穿**：A/B/C 分区、门端方向、LIFO 顺序、卸港批次在 6 页统一视觉语言（颜色 + 标签 + 图标）。
4. **3D 不可替代**：3D 页是高潮，HUD 必须读 `plan`/`progress`/`currentItem`，禁用图片替代。
5. **浅色为主、3D 深色对比**：5 个浅色页 + 1 个深色 3D 页，形成"工作台 → 指挥台"的视觉节奏。

### 10.3 视觉关键词

- **专业**：港口蓝 + 工业灰 + 单一橙色 accent（仅 CTA）
- **清晰**：3 字重 + 6 字号 + 强字距纪律
- **可信**：状态色克制（每屏 accent ≤ 2 次），失败状态常驻
- **港口物流**：码头、门机、集装箱线框、A/B/C 分区色、门端方向箭头
- **智能决策**：AI 建议卡 + 算法依据弹窗 + RAG 证据链
- **现场作业**：3D 叉车/工人 actor + 装卸路径 + 当前货物 ghost + 目标位高亮
- **可复核**：每个 PASS/WARNING 都可点开看依据
- **可执行**：每个步骤都有"确认完成/跳过"按钮 + toast 反馈

### 10.4 禁止风格（与用户输入一致）

- 普通后台管理系统 ❌
- 紫色 AI 渐变 ❌
- 过度玻璃拟态 ❌
- 赛博朋克大屏 ❌
- 花哨但看不清 ❌
- 每页卡片堆 ❌
- 每页 PPT 截图感 ❌
- 只换颜色不改层级 ❌

### 10.5 重构边界（明确不做）

- 不重写装箱算法（`packingDemo.js` / `backend/services/*`）
- 不改数据库结构（`backend/config/*.sql` / `models/*`）
- 不切技术栈（保留 React 18 + Vite + Three.js）
- 不引入重 3D 模型（GLTF loader）
- 不引入 router 库（保留 hash 路由）
- 不引入状态管理库（保留 useState/useMemo）
- 不引入 Tailwind / CSS-in-JS（保留原生 CSS，但 token 化）
- 不引入新依赖（除非设计强需要，且体积 < 30KB gzip）

### 10.6 优先级（与重构报告 03 评分维度对齐）

| 维度 | 分 | 重构重点 |
|---|---|---|
| 视觉高级感 | 20 | display 字体 + token 化 + 港口意象 + 浅/深节奏 |
| 物流业务感 | 15 | A/B/C 分区 + LIFO + 卸港批次 + 门端方向贯穿 6 页 |
| 3D 作业孪生表现 | 20 | HUD 真实化 + 目标位高亮 + 未装入可视化 + 默认视角调优 + 图层按钮接 true |
| 信息层级 | 15 | 每页 1 个主视觉 + 2-3 个次级 + 5 态覆盖 |
| 真实数据一致性 | 10 | 假成功清零（reviewed、HUD、矩阵、报告 KPI 全部接真实数据） |
| 交互可用性 | 10 | 图层按钮、下载全部、AI 审计状态机、人工复核行为修正 |
| 性能稳定性 | 5 | 保留 manualChunks；3D 不加模型；CSS 不加重型动画 |
| 安全边界 | 5 | 不泄露 API Key；不读 .env；不假 PDF/ZIP/XLSX |

---

## 11. 审计结论

### 11.1 当前定级

**NOT_READY**（视觉演示可用，但存在系统性假成功风险，不达"高级物流 AI SaaS + 港前装柜数字孪生工作台"标准）

### 11.2 主要扣分项

- 假成功风险（I1/I2/C1/C2/C3 + 报告 KPI 全 DEMO）：-15
- 3D HUD 与数据脱钩（T1/T8）：-10
- 字体无差异化（V1）：-5
- 6 页视觉不统一（V3）：-5
- 状态覆盖 5 态缺失（I11）：-5

### 11.3 重构可达目标

执行第二/三/四阶段后，预期可达 **FRONTEND_ADVANCED_READY** 或 **READY_WITH_NOTES**，具体取决于：

1. 假成功清零是否彻底（I1/I2/C1/C2/C3/I8/I9/I10）
2. 3D HUD 是否真实化（T1/T5/T6/T8/T11）
3. 设计 token 是否系统化（V7）
4. 6 页视觉是否统一（V3）
5. 截图 before/after 是否真实生成（第四阶段）

---

## 附录 A：文件清单与体量

| 文件 | 行 | KB | 重构策略 |
|---|---|---|---|
| [`App.jsx`](file:///d:/cixing/3chuang/web-dashboard/src/App.jsx) | 3680 | 160 | 拆分为 6 个页面组件 + 共享组件；保留 3D 与状态机 |
| [`App.css`](file:///d:/cixing/3chuang/web-dashboard/src/App.css) | ~1400 | 47 | token 化重写 |
| [`restore.css`](file:///d:/cixing/3chuang/web-dashboard/src/restore.css) | ~1400 | 46 | 合并到 token 化后的单 CSS |
| [`api.js`](file:///d:/cixing/3chuang/web-dashboard/src/api.js) | 48 | 1.9 | 不动 |
| [`vlmCargo.js`](file:///d:/cixing/3chuang/web-dashboard/src/vlmCargo.js) | 102 | 3.9 | 不动 |
| [`aiCompliance.js`](file:///d:/cixing/3chuang/web-dashboard/src/aiCompliance.js) | 288 | 10.5 | 不动 |
| [`complianceRules.js`](file:///d:/cixing/3chuang/web-dashboard/src/complianceRules.js) | 190 | 9.0 | 不动 |
| [`packingDemo.js`](file:///d:/cixing/3chuang/web-dashboard/src/packingDemo.js) | 330 | 11.2 | 不动 |
| [`demoScenarios.js`](file:///d:/cixing/3chuang/web-dashboard/src/demoScenarios.js) | 462 | 12.7 | 仅扩充，不改既有 |
| [`main.jsx`](file:///d:/cixing/3chuang/web-dashboard/src/main.jsx) | 11 | 0.3 | 不动 |
| [`index.html`](file:///d:/cixing/3chuang/web-dashboard/index.html) | 11 | 0.3 | 不动 |
| [`vite.config.js`](file:///d:/cixing/3chuang/web-dashboard/vite.config.js) | 27 | 0.6 | 不动 |
| [`package.json`](file:///d:/cixing/3chuang/web-dashboard/package.json) | 21 | 0.5 | 仅在需要新依赖时改 |

---

## 附录 B：open-design 可用参考清单

| 路径 | 用途 |
|---|---|
| `craft/anti-ai-slop.md` | 七宗罪自查清单 |
| `craft/color.md` | 4 层调色板 + accent ≤ 2/屏 |
| `craft/typography.md` | 字号/字距/字重纪律 |
| `craft/animation-discipline.md` | 150ms 默认 + reduced-motion 兜底 |
| `craft/state-coverage.md` | 5 态覆盖 + 表单 3 态 + 错误 3 问 |
| `craft/accessibility-baseline.md` | WCAG 2.2 基线 |
| `craft/laws-of-ux.md` | Fitts/Aesthetic-Usability/Hick 等可复用 |
| `craft/form-validation.md` | blur 校验 + dirty/valid/submitted 三态 |
| `design-systems/hud/USAGE.md` | HUD 设计参考（3D 页可借鉴） |
| `design-systems/ibm/USAGE.md` | 工业 / 数据密集表格参考 |

---

**审计完成。** 下一步进入第二阶段：生成 `02_YONGGUI_WEB_DESIGN_SYSTEM.md`。
