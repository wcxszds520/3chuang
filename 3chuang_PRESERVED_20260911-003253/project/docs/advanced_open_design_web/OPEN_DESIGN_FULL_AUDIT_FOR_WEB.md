# Open Design Full Audit For Yonggui Web

审计对象：`D:\cixing\open-design`  
审计方式：只读文件系统审计，未运行 Open Design 服务、插件、脚本或示例工程。  
用途：为“甬柜易算”Web 端高级设计与真实能力体验优化提炼可迁移的设计方法、组件纪律、截图 QA 和交付规范。

## 1. 总体判断

Open Design 对甬柜易算最有价值的不是某个现成视觉模板，而是一套“设计系统合同 + 可运行 artifact + 状态覆盖 + 截图 QA + 交付报告”的工作流。甬柜易算 Web 端应吸收这种方法，把视觉、真实接口状态、失败态、导出物和录屏路径纳入同一套可复核规范。

不建议直接套用 Open Design 的暗色营销、赛博、PPT、视频、海报或强品牌模板。甬柜易算面向中小卖家、货代配载员、仓库人员和港前审核人员，核心不是炫技，而是长时间可读、操作路径明确、真实结果可信。

## 2. 顶层目录审计

| 目录 / 文件 | 审计结论 | 对甬柜易算 Web 的价值 |
|---|---|---|
| `README.md` | 定义 Open Design 为本地优先的设计工作台，强调 design system、artifact、preview、export、agent workflow。 | 可借“从 brief 到设计系统到预览和导出”的闭环，不借营销文案。 |
| `QUICKSTART.md` | 说明运行、环境、Docker、web/daemon 模式。 | 可借启动检查、预览地址、复测步骤的报告结构。 |
| `AGENTS.md` | 目录边界、模块责任、E2E、数据目录、命令边界很清楚。 | 可借“目录边界与不越权修改”方法，约束本轮不改算法、不改 Three 数据结构。 |
| `CONTEXT.md` | 术语表清晰区分 Project、Artifact、Live Artifact、Manifest。 | 可借术语严谨性，把甬柜易算区分为订单、装柜方案、法规证据、报告包。 |
| `CLAUDE.md` | 极简入口。 | 无直接视觉价值。 |
| `design-systems/` | 包含大量品牌或风格系统，如 `ant`、`enterprise`、`simple`、`shadcn`、`dashboard`、`linear-app`、`shopify` 等。 | 只选浅色企业后台、数据密度和极简组件语法；排除暗色、营销、高奢和强品牌。 |
| `design-templates/` | 有 dashboard、live-dashboard、flowai-live-dashboard-template、web-prototype、report 等 artifact 模板。 | 可借 dashboard 的壳层结构、KPI、表格、状态、导出交互，但不能使用 seeded mock 伪装真实数据。 |
| `templates/` | 通用模板资源。 | 可参考 artifact 骨架，但不直接搬。 |
| `skills/` | 覆盖 frontend、design-review、screenshot、threejs、figma、ppt、doc、web artifacts 等技能。 | 可借设计审查、截图、前端实现、Three.js 设计纪律。PPT/海报技能不用于 Web。 |
| `plugins/` | 插件市场和设计系统插件。 | 可借“插件能力声明”写法，帮助我们记录 VLM/RAG/AI 可用状态。 |
| `prompt-templates/` | 提示词模板集合。 | 可借 structured brief，不复制品牌提示词。 |
| `assets/` | 设备框、媒体、图像等资源。 | 本轮不搬素材；可借截图 contact sheet 组织方式。 |
| `data/` | 预览 manifest、contributors、events。 | 可借 manifest 数据组织，但不引入 Open Design 数据。 |
| `story/` | 产品故事与案例。 | 可借叙事层次，不借营销稿。 |
| `specs/` | 当前路线图和能力规范。 | 可借“spec 先行、分阶段落地”。 |
| `tools/` | dev/pack/serve/release 工具。 | 可借工具化报告和测试思路，不运行。 |
| `apps/` | web/daemon/desktop/packaged。 | 可借 web 与 daemon 分层思想，不迁移代码。 |
| `packages/` | contracts、sidecar、platform 等。 | 可借“共享合同优先”理念，甬柜易算应保持 API schema 稳定。 |
| `figma-plugin/` | Figma 插件和 IR。 | 可借交付规格文档，不强行写 Figma 文件。 |
| `docs/` | 架构、测试、截图、schema、发布指南。 | 可借 QA 目录结构和截图证据组织。 |
| `e2e/` | Playwright UI 测试和视觉测试。 | 可借端到端按钮覆盖、截图路径、失败报告结构。 |
| `scripts/` | 发布、检查、自动化脚本。 | 可借非破坏性脚本风格。 |
| `craft/` | 可访问性、状态覆盖、颜色、动效、表单、反 AI 味等规则。 | 对本项目最关键，尤其状态覆盖、表单验证、动效克制、可访问性。 |
| `clipper/` | 浏览器采集插件。 | 本轮不使用。 |
| `charts/` | 图表相关资源。 | 可借轻量 SVG / DOM 图表思想，避免重图表库。 |
| `deploy/` | Docker、云部署。 | 本轮不做云部署。 |
| `mocks/` | mock CLI 和 golden traces。 | 本项目明确禁止 fake success；只能借“golden trace 验证”思想，不能借 mock 结果。 |
| `.claude/` / `.claude-plugin/` | 代理和插件配置资源。 | 本轮不修改、不运行。 |

## 3. 设计系统库适配分析

### 3.1 推荐借鉴

| Open Design 风格 | 适配度 | 可借鉴内容 | 不能照搬 |
|---|---:|---|---|
| `ant` | 高 | 企业后台、数据密集、清晰表格、状态标签、低学习成本。 | 不引入 Ant Design 框架，不照搬默认蓝和组件形态。 |
| `enterprise` | 高 | 高对比、结构化布局、表单和数据块边界。 | 其深青主色和米色 surface 不适合作为主色，可只借布局纪律。 |
| `simple` | 高 | Inter、12/14/16/20/24/32 字级、4/8/12/16/24/32 间距、白底卡片。 | 避免过于普通，需要加入港口蓝和物流 CAD 语义。 |
| `shadcn` | 中高 | 克制组件、轻边框、少阴影、可组合 UI。 | 不使用纯黑主色，不引入大型 UI 框架。 |
| `dashboard` | 中 | 模块化网格、KPI、侧边栏、顶部栏、数据层级。 | 原系统是暗色 dashboard，不能借深色、玻璃面板和大屏感。 |

### 3.2 明确排除

| 风格 | 排除原因 |
|---|---|
| `linear-app` | 暗色、紫色科技感强，容易偏蓝紫 AI 模板或营销官网。 |
| `shopify` | 暗色剧场、巨大营销排版、霓虹绿，不适合长时间操作后台。 |
| `luxury` / `bugatti` / `ferrari` | 高奢品牌气质，与物流 SaaS 可信操作台冲突。 |
| `neon` / `futuristic` / `hud` | 容易变成深色大屏或赛博演示屏。 |
| `glassmorphism` / `cosmic` | 低可读、装饰过重，不适合审核表格。 |
| PPT / deck 类模板 | 只适合答辩展示，不适合 Web 产品界面。 |

## 4. 设计模板库适配分析

| 模板 | 可借鉴内容 | 甬柜易算落点 | 风险 |
|---|---|---|---|
| `dashboard` | 左侧导航、顶部栏、KPI 卡、主图表、近期事件表。 | 工作台首页、报告成果中心。 | 不能使用假数据或只画图不接真实接口。 |
| `live-dashboard` | live/stale/syncing 状态、刷新、表格、活动流、状态覆盖。 | VLM/RAG/DeepSeek/装箱调用状态。 | 其“fallback mock”原则不适用，本项目失败必须显式失败。 |
| `flowai-live-dashboard-template` | 多 tab、CSV export、可交互表格、导出行为。 | SKU 管理、报告导出、法规证据清单。 | 不能引入无关团队管理语义。 |
| `web-prototype` | 单页高保真 artifact 的结构化输出。 | 截图 QA 和页面还原。 | 不能把 Web 做成营销页。 |
| `data-report` / `finance-report` | 报告结构、摘要、证据链。 | HTML 报告、CSV 证据清单、JSON 全量数据。 | 不要套金融口吻或静态模板冒充真实 AI。 |

## 5. Craft 规则迁移

### 状态覆盖

Open Design 的 `craft/state-coverage.md` 要求 loading、empty、error、populated、edge 五态。甬柜易算必须迁移到：

- VLM：idle、recognizing、done、failed，失败显示真实错误，不自动填假结果。
- DeepSeek 合规：idle、running、done、degraded，失败保留本地规则但标明 AI 不可用。
- RAG：loading、done、failed，本地法规库和联网参考分开说明。
- 装箱生成：running、backend、error，本地孪生预演不能伪装成后端成功。
- 报告导出：可生成、已生成、下载失败、内容一致性检查。

### 可访问性

迁移重点：

- 所有 icon-only 按钮必须有 `title` 或 `aria-label`。
- 表单字段有可见 label。
- 交互按钮保持 38-44px 高度。
- 表格行高不低于 44px。
- 状态不能只靠颜色，必须包含 PASS / WARNING / FAIL 文本。
- Toast 不应替代核心错误信息，接口失败要在页面内留痕。

### 动效纪律

迁移重点：

- 3D 页面允许播放步骤、路径和高亮，但不允许 Bloom、God Rays、粒子雨。
- 页面切换和按钮 hover 使用 150-220ms 轻动效。
- 真实请求中的 loading 要可中断或有超时文案。
- 演示录屏中避免高频闪烁和会影响阅读的扫光。

### 反 AI 模板感

迁移重点：

- 少用泛化英文小标题，主标题中文为主。
- 业务文案写真实动作：复核、导出、查看依据、重试识别。
- 不出现“10x、智能无限、全链路赋能”等无证据营销语。
- AI 区域只展示解释、建议和失败状态，不替代确定性规则。

## 6. 对甬柜易算的最终迁移策略

1. 使用 `ant + simple + shadcn` 作为主骨架：浅色、轻边框、克制卡片、企业数据密度。
2. 借 `dashboard` 的模块化网格，但改成浅色物流 AI 工作台，不使用暗色大屏。
3. 借 `live-dashboard` 的状态纪律，但删除 fake fallback 思维：真实服务失败就展示失败。
4. 借 `craft` 的状态、可访问性、动效纪律，作为每次截图 QA 的检查清单。
5. 把 `report/export` 概念落实为真实 HTML / CSV / JSON 文件，不展示没有真实后端支撑的 PDF / ZIP / XLSX 假下载。
6. 3D 区域保持浅色工业 CAD 风，用真实 `plan.loadedCargo`、`containerInfo`、`cog` 渲染，不重写引擎。

## 7. 本轮设计 QA 门禁

- 页面是否使用同一套真实数据口径：输入 221、装入 221、未装入 0 件、利用率 84.51%、合规 本地规则 WARNING / AI建议 PASS / 人工复核独立。
- VLM / DeepSeek / RAG 失败是否显式失败。
- 按钮是否都有真实行为或明确禁用。
- 3D 是否非空、可切换视角、可播放、可打开算法依据。
- 报告下载内容是否和页面一致。
- 是否保留浅色物流 SaaS 风格，没有暗色大屏、红金 PPT 或营销官网倾向。
- 是否生成 before/after 截图和 contact sheet。
