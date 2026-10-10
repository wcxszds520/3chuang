PORTCUBE Competition 2.8 最终验收报告  
生成日期：2026-08-29  
项目根目录：D:\\cixing\\3chuang  
验收范围：公开 Landing、专业 Workspace、hybrid-v2.5 求解真值、数字孪生、出运证据与竞赛演示链路

## Executive Verdict

**READY — PORTCUBE_COMPETITION_2_8_VISUAL_EXPERIENCE_FREEZE**

Competition 2.8 已达到视觉与体验冻结条件。公开页完成冷蓝工业品牌重构，专业工作台形成货物、规划、孪生、出运准备的闭环；正式 Dataset A 三策略均为 212/212、零硬约束违例、零作业阻断、完整卸载通过；22 张指定浏览器截图、A–F 性能采样、浏览器控制台、前端全套测试及相关后端测试均有可复核结果。

冻结不等于自动出运放行。纵向重心 8.266% 仍为 PARTICULAR_CIRCUMSTANCES_REVIEW，VOID-I-001 仍是 2.08 m³ 的“未解释剩余空间”，VGM、实际箱体资料及承运人/码头确认仍需责任方补齐；这些边界均在界面中保留，没有用绿色状态掩盖。

## Why 2.7 Visual Freeze Was Reopened

2.7 已建立完整公开叙事与真实 Twin，但视觉仍混有米白编辑风、旧蓝色 SaaS 工作台和多套密度规则；规划页也容易把三种目标误读为三套不同摆位。2.8 因此重开视觉冻结：统一为冷蓝工业系统，提升实物资产尺度、空间推演可读性、工作台信息层级，并明确呈现“三策略真实收敛”而不是制造差异。

本轮同时补上 2.7 没有机器可读 FPS/Web Vitals 产物、超大正式会话刷新持久化成本以及 VOID 根因证据不足的审计缺口。

## Final Brand System

最终系统使用冷白画布、深海军蓝文字、明亮品牌蓝、工程青与深色 Twin 舞台：主背景 `#f7f9fb`，柔和背景 `#eef3f7`，主墨色 `#10263a`，强墨色 `#0a1f32`，品牌蓝 `#0a6ff2`，深品牌色 `#0b416d`，工程青 `#167a85`，Twin 底色 `#101a23`。状态金色只服务复核、待补和路径提示，不承担装饰性大面积铺色。

品牌标识、页头、章节编号、细分隔线和工业对象共享同一尺度逻辑；Landing 与 Workspace 保持角色区分，但不再像两个产品。

## Final Typography Scale

公开页以大标题、窄行宽和强留白建立五秒定位；章节标题在桌面宽屏保持 56–76 px 的视觉级别，正文集中在 14–18 px，微型算法与证据标识使用等宽数字。Workspace 则收紧为 8–18 px 的高密度工程层级，关键状态、212/212 和 CoG 数字获得更高权重。

1366 px 下标题、品牌与导航通过 `clamp()` 和不换行约束保持完整，没有依靠缩放整页或隐藏核心数据。

## Landing Architecture

根路由 `/` 是一条连续的公开叙事：Hero → Why → Cargo Stage → Cargo→Space → Landing Twin → Evidence Chain → Final CTA。每章只回答一个问题，并通过章节进度和对象转场建立因果链；专业操作仍留在 `/workspace`。

## Hero Changes

Hero 以“装箱前先把结果看清”为唯一定位，右侧大比例装载剖切箱直接展示系统处理的对象，底部只保留空间、平衡、卸货与出运准备四类能力。主 CTA 进入一票规划，次动作观看演示；没有 KPI 墙或无来源的效率承诺。

## Why Changes

Why 章节改为“很多问题，在柜门关上以后才被发现”的问题剖面。空间可装、重心偏载、下一港卸货和资料欠缺以四个工程问句围绕箱体展开，下方对照传统流程与 PORTCUBE 的发现时点，强调提前暴露风险而非单纯装满。

## Cargo Stage Changes

货物章节把纸箱、木箱、缠膜托盘、钢桶、IBC、FIBC 等策划透明资产放入单一主舞台，左侧类型轨切换时同步展示包装语义、搬运边界和结构化求解字段。图片只承担视觉识别，不从像素推断尺寸、重量、可堆叠或合规结论。

## Cargo→Space Changes

Cargo→Space 采用大幅开门集装箱和分步推演，将货物实体、包装约束、候选空间、落位与验证组织成可读过程。步骤状态固定为确定的静态类和 `data-space-active`，解决了滚动交界处舞台短暂消失的问题。

## Landing Twin Changes

Landing Twin 变为深色冷蓝沉浸段，显示正式 212 件方案及标准、空间、平衡、卸货四个入口。它读取当前正式 plan placements，而不是为官网另造一套视觉摆位；标题、状态和统计在深色场景中均保持白色或高对比蓝灰。

## Evidence Chain Changes

证据章节以装载、重心、港序、出运资料四类卡片和右侧证据源面板形成从事实到责任动作的闭环。正式结果显示 212/212、8.266%/0.096% CoG、FULL_UNLOAD_PASS、0 倒箱及外部待补状态；封志和 VGM 图片仍明确只是语义辅助，不冒充本票凭证。

## Final CTA Changes

Final CTA 以冷蓝箱体、路径线和“带着可解释结果进入执行”收束叙事，仅保留进入专业工作台的主动作。页脚继承品牌与任务导航，避免重新堆叠营销模块。

## Workspace Global Changes

Workspace 统一为冷白工程画布、深蓝侧栏语义和精细分隔线；导航固定为本票决策、货物、规划、孪生、出运准备。上下文条持续显示本票号、212 件、40HQ、方案来源和验证状态。品牌名在 1366 px 下强制不换行，所有巡检路由在 1440 px 下均无横向溢出。

## Cargo Workspace Changes

Cargo 页升级为密集工程表格与编辑 Inspector：包装缩略图、尺寸、重量×数量、目的港、搬运方式和关键约束在同一行可核验；打开 Inspector 后提供大图、结构化字段、包装配置和来源。新增、复制、删除、导入与校验能力保留。

## Planning Equipment Changes

规划设备区并排比较 20GP、40GP、40HQ，正式建议计数为 117/36/0，并明确区分参考箱型与实际箱资料。门洞、内尺寸、皮重、最大总重和 CSC 等实际资料优先于参考值，缺失时不得假装已经确认。

## Strategy Convergence Logic

SPACE、BALANCE、OPERATION 先共享硬约束、稳定、作业、港序与完整卸载门禁，再比较各自目标。正式三策略 placement hash 全部为 `095db720bcd6b519`，因此界面以一套布局、三种解释呈现，并显示 `THREE_OBJECTIVE_CONVERGENCE TRUE`；没有为了视觉差异篡改坐标。

正式会话使用无损压缩：共享计划字段、相同 placement 和重复 packingCase plan 只存一次，加载时完整还原。存储从约 533,332 降至 193,937 字符，解压负载从约 8.62 百万降至 2.38 百万字符；新增回归测试验证策略特有 candidate trace 和审计字段不丢失。

## Digital Twin Art Changes

Twin 由通用浅蓝预览改为冷蓝港口作业空间：箱体钢材、地面网格、边界线、货物形态和状态叠层形成统一工业画面。正式摆位仍由 Solver 坐标驱动，策划 PNG/GLB 只作为包装外观映射。

## Twin Lighting / Materials / Camera

环境光、主光、轮廓光与材质粗糙度重新平衡，暗场保持箱体结构可见且不漂白货物。标准、空间、平衡、卸货分别使用稳定的相机预设；相机切换带有短缓动，截图模式固定代表状态，未出现抖动或黑屏。

## Space Mode Changes

Space 模式显示已占空间、可解释预留区和未解释区域，并把 VOID-I-001 的位置、2.08 m³ 体积及 `UNEXPLAINED_VOID` 状态带入读数。界面不再将所有空白笼统称为浪费空间，也不把无法证明的根因写成布局缺陷。

## Balance Mode Changes

Balance 模式显示横向 0.096%、纵向 8.266% 的真实 CoG 偏移、重心点与指导状态。纵向值明确标记“需要工程复核”及 PARTICULAR_CIRCUMSTANCES_REVIEW；Balance challenger 三轮无有意义改善后停止，没有晋升等价方案。

## Unload Mode Changes

Unload 模式按目的港和 LIFO 关系执行可播放推演，展示完整卸载、零未来港倒箱、零港序阻断和卸载后稳定通过。播放、暂停、重置与步骤状态均在真实 212 件方案上运行。

## Readiness Changes

出运准备从平铺清单改为仓库、货代、工程、外部责任方分组，待补、复核、外部确认和通过项具有不同优先级。页面既给出当前责任人和下一动作，也保留已通过证据，避免把“求解完成”误写成“可以直接出运”。

## Evidence Inspector Changes

Evidence Inspector 扩展为事实、输入、计算、条件、判断、来源、责任七层结构；可见当前值、计算口径、规则引用、证据完整性和必需动作。空间证据可跳转 Twin，原始 JSON 折叠显示，避免只给一个红绿结论。

## Source Reader Changes

来源阅读器固定为 25%/40%/35% 三列：来源身份、命中摘录、本票应用。每列分别说明发布方与快照、支撑本条判断的最小上下文、当前值/限制/计算/责任；外部官方页面与实时受理状态保持边界。

## Interaction Motion System

Landing 使用章节进入、对象换台、进度轨和轻量视差；Workspace 使用 160–300 ms 的状态与相机过渡。Twin 只在相关章节运行，`prefers-reduced-motion` 降低动画，`capture=1` 仅稳定画面而不替换数据。浏览器巡检未发现抽屉锁死、快速闪烁或模式切换冻结。

## Responsive Result

最终截图覆盖 1920×1080 的 18 个关键状态和 1366×768 的 4 个代表状态。额外 1440 px 巡检覆盖 Landing、Cargo、Planning、Twin、Readiness，五条路由的 `scrollWidth=1430`、`innerWidth=1440`；1366 下品牌、规划和 Twin 仍可操作且无核心内容截断。

## Algorithm Truth Audit

机器可读审计位于 `artifacts/competition-2.8/solver-truth-audit.json`。审计通过全新正式浏览器求解、持久化读回和独立 Balance challenger 复算交叉验证；Solver 为 hybrid-v2.5，视觉层没有修改 placements。SPACE/BALANCE/OPERATION 的强制门禁全部通过，三策略收敛为真。

## Balance Challenger Result

Balance challenger 最多执行 3 轮，实际执行 3 轮，检查 324 个合格交换对。最佳方案 CoG 仍为 8.266%，内部空隙仍为 3.76636 m³，没有任何百分点改善；结果 `promoted=false`，原因 `THREE_CONSECUTIVE_NO_MEANINGFUL_IMPROVEMENT`。保持原方案是证据支持的选择。

## Void-I-001 Root Cause Result

VOID-I-001 尺寸约 1300×2000×800 mm，体积 2.08 m³，几何上可容纳当前多类货物；但正式计划没有记录与该区域关联的候选拒绝链，区域内记录拒绝数为 0。结论只能是 `UNRESOLVED`，显示“未解释剩余空间”，不允许声称某个未经证明的单一根因。

## Official Dataset A Truth

Dataset A 被明确标记为 DEMO_DATA，40HQ，输入 212 件。三策略均为 212 loaded / 0 unloaded、0 hard violation、0 stability invalid、0 operation blocked、0 port blocked、0 future-port rehandle；FULL_UNLOAD_PASS、post-unload stability pass。placement hash 一致，横向 CoG 0.096%，纵向 8.266%。

## Performance Measurements

正式数据见 `artifacts/competition-2.8/performance.json`。环境为 Chrome 151、1920×1080、DPR 1、16 逻辑核、16 GiB、AMD Radeon/ANGLE D3D11，前台 headed 模式并关闭 Chromium 后台节流；每个场景用 requestAnimationFrame 连续采样 6 秒。

| 场景 | Median FPS | P10 FPS | >50 ms 帧 | LCP | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| A Landing Hero scroll | 82 | 44 | 3 | 5784 ms | 0 |
| B Landing Cargo switching | 69 | 53 | 7 | 5784 ms | 0.0024 |
| C Landing Twin active | 148 | 125 | 0 | 5784 ms | 0.0024 |
| D Workspace Twin Normal | 121 | 119 | 0 | 1204 ms | 0 |
| E Workspace Twin Space | 111 | 110 | 0 | 1204 ms | 0 |
| F Workspace Twin Unload | 72 | 68 | 0 | 1204 ms | 0.0004 |

持久化压缩后 Landing LCP 从 9684 ms 降至 5784 ms；首屏仍慢于 Workspace，A/B 的 P10 仍低于 60 FPS，因此保留为后续性能债务而不粉饰。

## Browser QA

真实 Chrome/Playwright 完整浏览 Landing 七章、Cargo 主表与 Inspector、规划设备与策略、Twin 四模式、Readiness、Evidence Inspector 和 Source Reader。最终性能会话控制台只有 React DevTools 信息，0 errors、0 warnings；没有横向溢出、相机冻结、抽屉锁死或快速闪烁。22 张 PNG 均已视觉复核并核对分辨率。

## Frontend Tests

`npm test -- --run`：32/32 test files、116/116 tests 通过。`npm run lint`：通过，0 warnings。`npm run build`：通过，1,667 modules transformed；输出 CSS 245.66 kB、React 140.93 kB、Three 550.48 kB、主应用 945.42 kB，只有大 chunk 提示。

## Relevant Backend Tests

最终相关本地 Jest 结果为 5 个 suite、10 个 tests 通过：HybridConstraintPackingSolverV25、LoadBalanceAwareLocalRepair、VoidJustificationAnalyzerV25、ShipmentReadinessServiceV25 与 shipment-readiness-v25 integration。重型 Solver suite 单独耗时约 1504 秒并通过所有 5 项；Void 用例在文案改为“未解释剩余空间”后同步契约并复跑通过。

旧 `backend/__tests__/integration/packing.test.js` 需要外部数据库和 AI 服务，本次运行出现 DB `ETIMEDOUT`、AI stream abort 与两个 30 秒超时；它不作为本地 V2.5 算法门禁，但作为环境依赖限制保留记录。

## Screenshot Index

| # | 文件 | 分辨率 | 验收状态 |
| --- | --- | --- | --- |
| 01 | 01-landing-hero-1920.png | 1920×1080 | Hero |
| 02 | 02-landing-why-1920.png | 1920×1080 | Why |
| 03 | 03-landing-cargo-1920.png | 1920×1080 | Cargo Stage |
| 04 | 04-landing-space-1920.png | 1920×1080 | Cargo→Space |
| 05 | 05-landing-twin-1920.png | 1920×1080 | Landing Twin |
| 06 | 06-landing-evidence-1920.png | 1920×1080 | Evidence Chain |
| 07 | 07-landing-final-cta-1920.png | 1920×1080 | Final CTA |
| 08 | 08-workspace-cargo-1920.png | 1920×1080 | Cargo table |
| 09 | 09-workspace-cargo-inspector-1920.png | 1920×1080 | Cargo Inspector |
| 10 | 10-workspace-planning-equipment-1920.png | 1920×1080 | Equipment |
| 11 | 11-workspace-planning-strategy-1920.png | 1920×1080 | Strategy convergence |
| 12 | 12-workspace-twin-normal-1920.png | 1920×1080 | Twin Normal |
| 13 | 13-workspace-twin-space-1920.png | 1920×1080 | Twin Space |
| 14 | 14-workspace-twin-balance-1920.png | 1920×1080 | Twin Balance |
| 15 | 15-workspace-twin-unload-1920.png | 1920×1080 | Twin Unload |
| 16 | 16-workspace-readiness-1920.png | 1920×1080 | Readiness |
| 17 | 17-workspace-evidence-detail-1920.png | 1920×1080 | Evidence detail |
| 18 | 18-workspace-source-reader-1920.png | 1920×1080 | Source Reader |
| 19 | 19-landing-hero-1366.png | 1366×768 | Responsive Hero |
| 20 | 20-landing-cargo-1366.png | 1366×768 | Responsive Cargo |
| 21 | 21-workspace-planning-1366.png | 1366×768 | Responsive Planning |
| 22 | 22-workspace-twin-1366.png | 1366×768 | Responsive Twin |

目录：`D:\\cixing\\3chuang\\artifacts\\competition-2.8\\screenshots`

## Changed Files and Responsibility

本工作树包含用户已有及前序 Competition 改动；下列为 2.8 的主要责任边界，不宣称覆盖全部 dirty files。

| 文件/目录 | 责任 |
| --- | --- |
| web-dashboard/src/pages/landing/LandingPage.jsx | Landing 七章、状态轨、资产舞台与 CTA |
| web-dashboard/src/styles/app.css | 冷蓝品牌系统、Workspace 层级、响应式与动效 |
| web-dashboard/src/app/AppShell.jsx | 工作台导航与当前本票上下文 |
| web-dashboard/src/pages/workflows/CargoPage.jsx | Cargo 表格、包装视觉与 Inspector |
| web-dashboard/src/pages/workflows/ContainerPage.jsx | 设备矩阵、三策略收敛与规划解释 |
| web-dashboard/src/pages/workflows/TwinPage.jsx | Twin 模式、读数与作业控件 |
| web-dashboard/src/pages/workflows/CompliancePage.jsx | Readiness、Evidence Inspector、Source Reader |
| web-dashboard/src/three/TwinScene.jsx 及 three/scene/ | 真实 placements、场景艺术、光照、材质与相机 |
| web-dashboard/src/app/session/sessionStorage.js | 正式三策略会话的无损压缩与还原 |
| backend/services/packing/VoidJustificationAnalyzer.js | “未解释剩余空间”真值和证据边界 |
| artifacts/competition-2.8/ | 性能、Solver 审计与 22 张浏览器证据图 |
| 本报告 | 最终验收、限制与冻结建议 |

## Remaining Limitations

1. Landing LCP 5784 ms，Hero/Cargo P10 为 44/53 FPS；正式会话恢复仍会同步解析约 238 万字符。
2. 生产主应用 bundle 945.42 kB，超过 900 kB 提示阈值，尚未做路由级拆包。
3. Dataset A 纵向 CoG 8.266% 需要工程复核，不能宣称处于一般指导范围。
4. VOID-I-001 根因为 UNRESOLVED；缺少候选拒绝链时不能推断成布局缺陷或港序预留。
5. VGM、实际箱 CSC/尺寸、承运人及码头受理属于外部证据和确认。
6. 旧 packing integration 依赖不可用的外部数据库/AI 服务；当前相关本地算法门禁已独立通过。

这些限制均已显式呈现，未发现阻止本地竞赛演示、否定正式求解真值或造成关键视觉/交互阻断的问题。

## 3-Minute Competition Demo Flow

1. **0:00–0:25**：Hero，用一句话说明“装箱前先把结果看清”。
2. **0:25–0:50**：Why，指出空间、偏载、下一港卸货和资料问题往往关门后才暴露。
3. **0:50–1:15**：Cargo Stage → Cargo→Space，说明包装语义如何进入候选与验证。
4. **1:15–1:40**：Planning，展示 40HQ 与 SPACE/BALANCE/OPERATION 同布局真实收敛。
5. **1:40–2:15**：Twin Normal → Space → Balance → Unload，讲 212/212、CoG 复核、VOID 未决和零倒箱完整卸货。
6. **2:15–2:45**：Readiness → Evidence Inspector → Source Reader，展示责任、来源、当前值与外部未知。
7. **2:45–3:00**：回到最终 CTA，以“结果可解释、证据可追溯、动作可执行”收束。

## Final Freeze Recommendation

视觉一致性、Landing/Workspace 体验、三策略真值、Dataset A 强制门禁、数字孪生四模式、责任证据链、22 张截图、性能产物、浏览器错误、前端测试和相关后端测试均通过材料级冻结要求。已知性能、CoG、VOID 与外部资料边界均有诚实披露，不构成当前视觉体验冻结的阻断。

**PORTCUBE_COMPETITION_2_8_VISUAL_EXPERIENCE_FREEZE**

冻结后仅接受可复现的关键业务错误、视觉阻断、真值/规则更新和比赛材料所需的有限调整；性能拆包与异步恢复作为明确的后续工程项，不继续重画已通过章节或制造虚假的策略差异。

=== START OF PORTCUBE 2.8 COMPLETE CONTEXT FOR CHATGPT ===

PROJECT_ROOT: D:\\cixing\\3chuang

LANDING_ROUTE: /；七章连续公开体验，capture=1 仅稳定画面，不替换业务数据。

WORKSPACE_ROUTE: /workspace；核心子路由 /workspace/cargo、/workspace/planning、/workspace/twin、/workspace/readiness。

BRAND_PALETTE: 冷白 #f7f9fb / #eef3f7；墨色 #10263a / #0a1f32；品牌蓝 #0a6ff2；深品牌色 #0b416d；工程青 #167a85；Twin #101a23。

LANDING_CHAPTERS: Hero → Why → Cargo Stage → Cargo→Space → Landing Twin → Evidence Chain → Final CTA。

ASSET_USAGE: 策划装载箱、开门空箱、纸箱、木箱、缠膜托盘、钢桶、IBC、FIBC 用于视觉解释；封志/VGM 只作语义辅助；图片不推断尺寸、重量、约束或合规结论。

WORKSPACE_IA: 本票决策、货物、规划、孪生、出运准备；同一 active plan 驱动设备、三策略、Twin、Readiness 和证据。

SOLVER_VERSION: hybrid-v2.5；视觉层不修改 placement。

DATASET_A_RESULT: DEMO_DATA / 40HQ / 212 input；三策略均 212/212、0 hard violation、0 stability invalid、0 operation/port blocked、0 rehandle、FULL_UNLOAD_PASS、post-unload stability pass。

STRATEGY_CONVERGENCE_RESULT: SPACE/BALANCE/OPERATION placement hash 均为 095db720bcd6b519；THREE_OBJECTIVE_CONVERGENCE TRUE；一套布局、三种解释。

BALANCE_CHALLENGER_RESULT: 3/3 trials、324 eligible pairs、CoG improvement 0；promoted=false；THREE_CONSECUTIVE_NO_MEANINGFUL_IMPROVEMENT。

VOID_ROOT_CAUSE_RESULT: VOID-I-001 为 2.08 m³ UNEXPLAINED_VOID；货物几何可放入但记录拒绝链为 0；root cause UNRESOLVED，不允许推断。

COG_STATUS: lateral 0.096%、longitudinal 8.266%；PARTICULAR_CIRCUMSTANCES_REVIEW；界面显示需要工程复核。

READINESS_STATUS: 求解门禁通过；仓库/货代/工程/外部责任动作分组；VGM、实际箱资料和承运人/码头确认不伪造完成。

THREEJS_STATE: Landing 与 Workspace 读取正式 placements；Normal/Space/Balance/Unload 四模式；冷蓝场景、稳定相机、完整卸货播放；无视觉重排。

PERFORMANCE_RESULT: Chrome 151 1920×1080；A–F median FPS 82/69/148/121/111/72，P10 44/53/125/119/110/68；Landing LCP 5784 ms，Workspace LCP 1204 ms；机器产物在 artifacts/competition-2.8/performance.json。

FRONTEND_TESTS: Vitest 32 files / 116 tests PASS；ESLint PASS；production build PASS（1,667 modules）；主应用 945.42 kB 大 chunk 提示保留。

BACKEND_TESTS: 相关本地 Jest 5 suites / 10 tests PASS；旧 packing integration 因外部 DB ETIMEDOUT、AI stream abort 和超时不作为本地算法门禁。

BROWSER_TESTS: 真实 headed Chrome 全流程通过；控制台 0 errors / 0 warnings（仅 React DevTools info）；1440 路由巡检无横向溢出；22 张截图完成视觉复核。

SCREENSHOT_PATHS: D:\\cixing\\3chuang\\artifacts\\competition-2.8\\screenshots\\01-landing-hero-1920.png … 22-workspace-twin-1366.png；共 22 张，18 张 1920×1080、4 张 1366×768。

KNOWN_LIMITATIONS: Landing LCP/P10、945.42 kB 主包、Dataset A CoG 工程复核、VOID-I-001 根因未决、VGM/实际箱/承运人外部证据、旧外部依赖 integration 环境失败。

FINAL_VERDICT: READY；PORTCUBE_COMPETITION_2_8_VISUAL_EXPERIENCE_FREEZE。

=== END OF PORTCUBE 2.8 COMPLETE CONTEXT FOR CHATGPT ===
