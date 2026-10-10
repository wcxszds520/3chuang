# PORTCUBE Competition 2.9 Final Report

审计日期：2026-08-29  
项目：智港立方 PORTCUBE  
验收范围：Landing、Workspace、正式求解真值、数字孪生、证据链、响应式、性能与竞赛演示材料

## 1 Executive Verdict

Competition 2.9 已完成 P0/P1/P2/P3 范围内的视觉、交互与架构收口。正式 Dataset A 仍由 `hybrid-v2.5` 生成，三策略均为 212/212 且 placement hash 保持 `095db720bcd6b519`；没有为视觉演示修改 placements。25 个要求状态均已在 Codex in-app Browser 中完成真实交互、截图和逐张视觉复核。

最终结论为 **READY_WITH_LIMITATIONS**，而不是最终冻结：当前 in-app Browser 不产生 LCP/FCP 性能条目，并在面板遮挡后将 rAF 限制到约 1 Hz，因此 2.9 的 LCP 与 FPS 硬门槛无法被有效证明；同时浏览器面板导出的 PNG 为受面板边界限制的 raster，而非文件名所指的原生 1920×1080/1366×768。所有可验证的功能、真值、构建、前端测试、专项后端测试和视觉检查均通过。

## 2 What Was Wrong in 2.8

2.8 的主要问题不是求解真值，而是表达与首屏架构：Landing 首屏同步恢复正式大会话，主应用 bundle 945.42 kB，LCP 为 5784 ms；Cargo→Space 缺少足够清晰的候选—选择—验证因果；Landing Twin 更像局部演示而不是完整章节；证据链的事实、指导、判断和来源层次不够明确；Planning 设备对比不在同一视觉尺度；Unload 的镜头、环境和步骤叙事不够聚焦。

## 3 Scope Freeze Matrix

| 优先级 | 范围 | 状态 |
| --- | --- | --- |
| P0 | Landing Twin、Landing Evidence、Workspace Twin Unload | 完成 |
| P1 | Planning Equipment、Cargo→Space、性能架构 | 完成；性能实测受浏览器环境限制 |
| P2 | Why、1366 响应式 | 完成 |
| P3 | Workspace 细节与交互抛光 | 完成 |
| 冻结边界 | solver placements、Dataset A 真值 | 未修改 |

## 4 Final Brand System

品牌系统统一为冷蓝工业底色、暖白信息面、深墨绿色决策态和琥珀色提醒态。Landing 保持叙事感，Workspace 保持操作密度；两者共享字阶、圆角、描边、状态芯片和证据用语，因此呈现为同一产品的两个工作层级。

## 5 Hero Final State

Hero 以“装箱前先把结果看清”为单一主张，使用真实装载剖切集装箱资产作为主视觉。首屏不再挂载 SessionProvider、正式会话恢复或 Three.js；Workspace、Landing Experience 与 Three.js 均路由级/可视区级延迟加载。首屏 CTA 与演示入口保持清晰，品牌与对象在 1366 下仍完整。

## 6 Why Redesign

Why 章节以“柜门关上以后才被发现”统一四个问题：装不下、偏载、下一港卸货、出运资料。问题—后果—提前发现的链路取代了泛功能卡片，使用户先理解风险，再进入算法与 Twin。

## 7 Cargo Stage Result

Cargo Stage 以纸箱、木箱、缠膜托盘、IBC、钢桶、FIBC 等真实透明资产构成包装类型舞台。当前对象、包装语义、约束与后续空间判断共用一个焦点区，避免把货物仅表现成无差别色块。

## 8 Cargo→Space Algorithm Visualization

Cargo→Space 现在显式展示输入货物、空箱、候选位置、已选位置和验证结果。木箱在第二阶段保持可见，空间候选与验证芯片不会因 CSS specificity 被误隐藏。该动画解释算法过程，但不生成或替换正式 placements。

## 9 Landing Twin Full-Section Architecture

Landing Twin 成为完整沉浸章节，而非一个窄卡片。章节直接读取正式 212-placement plan，提供标准、空间、平衡与卸货入口，并将模式说明、关键读数和三维对象置于一个连续暗色场景中。Three.js 仅在章节接近可视区时加载。

## 10 Landing Evidence Visualization

Evidence 采用四级责任链：事实 → 计算/指导 → 当前判断 → 来源。重量、重心、港序与资料动作分别标注已校验、工程复核、内部推演或外部确认边界；纵向 CoG 文案由正式数据动态生成，不再硬编码 8.266%。

## 11 Final CTA

结尾 CTA 收束为“带着已验证的方案进入工作台”，不重复 Hero。主按钮进入正式规划，次级说明保留当前票、责任与待补动作语境。

## 12 Planning Equipment Redesign

20GP、40GP、40HQ 被放入同一尺度、同一基线、同一环境的设备舞台。20GP 明显更短，40GP/40HQ 长度一致且高度差异可辨；40HQ 选择态与容量/约束信息同时显示。舞台增加裁切边界，放大资产不会溢出卡片。

## 13 Strategy Convergence State

SPACE、BALANCE、OPERATION 三策略均加载 212/212，hash 均为 `095db720bcd6b519`。硬约束、稳定性、作业、港序、重装卸均为 0，三策略收敛为 TRUE。界面明确说明“同一安全布局”，没有虚构策略差异。

## 14 Workspace Twin Art Direction

Workspace Twin 使用冷蓝舱体、暖色货物、暗色工业背景和高对比诊断叠层。相机、灯光、材质和环境服务于空间阅读，而不是装饰。正式 plan placements 是所有模式唯一几何来源。

## 15 Normal Mode

Normal 显示完整装载状态、舱体关系与正式 KPI，保持最少叠层，作为四模式的基准视图。

## 16 Space Mode

Space 在不移动货物的前提下显示剩余空间、区域与解释层。`VOID-I-001` 仍标为 2.08 m³、UNEXPLAINED/UNRESOLVED；3.76 m³ 仅作为全局未解释空间汇总，二者语义分离。

## 17 Balance Mode

Balance 显示整体重心与偏移。横向偏移 0.096%，纵向偏移 8.266%；状态保持 `PARTICULAR_CIRCUMSTANCES_REVIEW`，不把工程复核项粉饰成一般指导通过。

## 18 Unload Mode

Unload 使用独立相机预设、步骤面板、稳定性与重装卸读数。默认环境与区域叠层在卸货模式隐藏，主对象更大、更集中；完整卸货状态为 PASS，未来港重装卸为 0，卸货后稳定性通过。

## 19 Camera System

四模式采用稳定的预设相机与受控过渡。Unload 提高焦点与缩放，避免远景中对象过小；模式切换不会重建 placements 或改变几何真值。

## 20 Lighting System

主光、环境光与局部轮廓光减少高光爆点，并在深色场景中保持舱体边缘、木箱纹理、金属箱体和透明/半透明诊断层可辨。Unload 隐藏无关环境后，灯光继续聚焦作业对象。

## 21 Material Changes

舱体、木材、纸箱、金属、塑料和诊断层使用不同粗糙度、金属度与透明策略。颜色仍服从状态语义；透明层不遮挡当前正式货物。

## 22 Workspace UI Changes

Cargo Inspector、Planning、Twin、Readiness、Evidence Detail 与 Source Reader 共享抽屉、面板、状态芯片和上下文栏。关键读数优先于装饰；抽屉打开后仍保留列表或场景语境。

## 23 Interaction Motion System

Landing 使用章节进入、对象换台和轻量视差；Workspace 使用短时状态/相机过渡。`prefers-reduced-motion` 被保留，`capture=1` 只稳定画面，不替换数据。浏览器交互未见抽屉锁死、模式冻结或快速闪烁。

## 24 Responsive Result

1366 CSS viewport 下复核 Hero、Why、Cargo、Landing Twin、Planning 与 Workspace Twin：核心按钮、主对象、模式切换和真值读数均可操作，无关键横向溢出。Codex 浏览器面板实际导出为 1356×762；桌面目标导出为 1663/1673×1068/1074。该像素边界已写入视觉 QA，不以插值伪造原生分辨率。

## 25 Landing Performance Architecture

Landing 不再由 SessionProvider 包裹；正式会话和 Workspace 代码不进入根路由同步路径。Landing Experience 与 Three.js 延迟加载，图像使用 WebP，Hero 图预加载。生产构建入口 JS 为 66.23 kB（gzip 22.77 kB），LandingPage 为 24.58 kB（gzip 9.18 kB），Three.js 550.48 kB（gzip 139.58 kB）保持延迟 chunk。

## 26 Performance Before / After

| 指标 | 2.8 | 2.9 |
| --- | --- | --- |
| Landing LCP | 5784 ms | 无有效条目；不能宣称通过 |
| CLS | 0–0.0024 | 3 次冷启动均为 0 |
| Landing 内容就绪 | 未单列 | 中位 161.2 ms |
| 冷启动 load | 未单列 | 中位 155.5 ms |
| FPS | 前台基线 82/69/148/121/111/72 | in-app Browser 遮挡后约 1 Hz，样本被拒绝 |

2.9 的导航与内容就绪明显轻量，但内容就绪不是 LCP 的替代品；因此 LCP≤3000 ms 与各场景 FPS 门槛仍为未证明。

## 27 Bundle Before / After

2.8 报告的主应用 bundle 为 945.42 kB。2.9 生产构建拆为 26 个资产：JS 1,678,828 bytes、CSS 266,621 bytes、总计 1,945,449 bytes；关键变化是初始入口只为 66.23 kB，而 Three.js、Workspace 与算法可视化均按路由/能力延迟加载。总资产不是首屏传输量，二者不混为一谈。

## 28 Solver Truth Reverification

专项权威测试覆盖 11 个 suite、35 个 test，全部通过，运行约 839 秒。覆盖 `HybridConstraintPackingSolverV25`、固定种子 benchmark、Floor Extreme Point、Shipment Readiness、Void Justification、Load Balance Repair、Real World Decision、Plan Validator、Stability、Packaging Profile 与 readiness integration。正式浏览器会话回读仍为 `hybrid-v2.5`、212/212、hash `095db720bcd6b519`。

## 29 CoG Truth

横向 CoG 0.096%，纵向 CoG 8.266%。纵向值保持 `PARTICULAR_CIRCUMSTANCES_REVIEW`；产品仅说明需要工程复核，不宣称满足一般指导。

## 30 VOID Truth

`VOID-I-001` 为 2.08 m³，分类 `UNEXPLAINED_VOID`，根因 `UNRESOLVED`。几何证明现有货物可以适配该区域，但没有与该区域绑定的候选拒绝链，因此不能推断成布局缺陷、港序预留或特定规则结果。

## 31 Readiness Truth Boundary

内部已验证边界包括装载数量、重量计算、硬约束、稳定性、港序模拟、完整卸货与资料结构。VGM、实际箱 CSC/尺寸、承运人/码头受理与最终签章属于外部证据，界面只标记待确认，不伪造完成状态。

## 32 Tests

前端 `npm test`：32 个文件、116 个测试全部通过。前端 `npm run lint`：0 warning/0 error。前端 `npm run build`：1668 modules，成功。后端专项权威套件：11 suites、35 tests 全部通过。后端全历史套件仍包含旧外部 AI/数据库超时、旧 API 字段断言、旧 demoService/StackManager 期望等非 2.9 回归，未作为 V2.5 本地算法门禁。

## 33 Browser QA

使用 Codex in-app Browser 真实走查 Landing 全章节、Cargo 表格与 Inspector、Planning 设备与策略、Twin Normal/Space/Balance/Unload、Readiness、Evidence Detail 和 Source Reader。共生成 25 个 PNG，逐张检查文字、裁切、溢出、状态差异与真值。应用流程未出现新的可见错误面、相机冻结、抽屉锁死或交互阻断。浏览器性能运行时限制独立记录在 `artifacts/competition-2.9/performance.json`。

## 34 Screenshot Index

| # | 文件 | 状态 |
| --- | --- | --- |
| 01 | 01-landing-hero-1920.png | PASS |
| 02 | 02-landing-why-1920.png | PASS |
| 03 | 03-landing-cargo-1920.png | PASS |
| 04 | 04-landing-cargo-to-space-1920.png | PASS |
| 05 | 05-landing-twin-standard-1920.png | PASS |
| 06 | 06-landing-twin-space-1920.png | PASS |
| 07 | 07-landing-evidence-1920.png | PASS |
| 08 | 08-landing-final-cta-1920.png | PASS |
| 09 | 09-workspace-cargo-1920.png | PASS |
| 10 | 10-workspace-cargo-inspector-1920.png | PASS |
| 11 | 11-workspace-planning-equipment-1920.png | PASS |
| 12 | 12-workspace-planning-strategy-1920.png | PASS |
| 13 | 13-workspace-twin-normal-1920.png | PASS |
| 14 | 14-workspace-twin-space-1920.png | PASS |
| 15 | 15-workspace-twin-balance-1920.png | PASS |
| 16 | 16-workspace-twin-unload-1920.png | PASS |
| 17 | 17-workspace-readiness-1920.png | PASS |
| 18 | 18-workspace-evidence-detail-1920.png | PASS |
| 19 | 19-workspace-source-reader-1920.png | PASS |
| 20 | 20-landing-hero-1366.png | PASS |
| 21 | 21-landing-why-1366.png | PASS |
| 22 | 22-landing-cargo-1366.png | PASS |
| 23 | 23-landing-twin-1366.png | PASS |
| 24 | 24-workspace-planning-1366.png | PASS |
| 25 | 25-workspace-twin-1366.png | PASS |

目录：`D:\cixing\3chuang\artifacts\competition-2.9\screenshots`

## 35 Changed Files

本工作树包含用户与前序 Competition 的已有修改；以下仅描述 2.9 主要责任边界，不宣称整个 dirty worktree 归属于本轮。

| 文件/目录 | 2.9 责任 |
| --- | --- |
| web-dashboard/src/app/Application.jsx、router.js | Landing/Workspace 路由与延迟加载边界 |
| web-dashboard/src/pages/landing/LandingPage.jsx | Hero、Why、Cargo、Cargo→Space、Twin、Evidence、CTA |
| web-dashboard/src/styles/app.css | 2.9 视觉系统、共享尺度、响应式与模式样式 |
| web-dashboard/src/pages/workflows/ContainerPage.jsx | Planning Equipment 与策略收敛 |
| web-dashboard/src/pages/workflows/TwinPage.jsx | 四模式、Unload 面板与读数 |
| web-dashboard/src/three/TwinScene.jsx | 场景、环境可见性、模式层与相机应用 |
| web-dashboard/src/three/presentation/cameraPresets.js | Unload 等相机预设 |
| web-dashboard/index.html | Hero 预加载与 `?perf` 限定性能探针 |
| web-dashboard/public/assets/competition-2.7/ | WebP 工业视觉资产 |
| artifacts/competition-2.9/ | 25 张截图、性能与视觉 QA 产物 |
| 本报告 | 39 节最终审计与冻结决策 |

## 36 Remaining Limitations

1. Codex in-app Browser 不返回 LCP/FCP 条目；Landing LCP≤3000 ms 未证明。
2. 同一运行时在窗口遮挡后将 rAF 限制到约 1 Hz；2.9 Hero/Cargo/Twin/Workspace FPS 门槛未证明，历史 2.8 前台数据仅作参考。
3. 浏览器面板截图 raster 小于目标文件名所指的原生尺寸；未进行插值放大或伪造。
4. Dataset A 纵向 CoG 8.266% 需要工程复核。
5. `VOID-I-001` 根因仍为 UNRESOLVED。
6. VGM、实际箱、承运人和码头受理仍需外部证据。
7. 后端全历史套件包含与当前本地算法门禁无关的旧外部依赖/旧契约失败。

## 37 3-Minute Final Demo Flow

1. **0:00–0:25**：Hero，用一句话说明“装箱前先把结果看清”。
2. **0:25–0:45**：Why，指出四类问题为何必须在关门前暴露。
3. **0:45–1:10**：Cargo → Cargo→Space，演示包装语义进入候选、选择和验证。
4. **1:10–1:35**：Landing Twin，切换标准/空间/平衡并说明正式 212 placements 不变。
5. **1:35–2:00**：Planning，展示同尺度设备与三策略收敛。
6. **2:00–2:30**：Workspace Twin Unload，展示 0 rehandle、完整卸货与卸货后稳定。
7. **2:30–2:50**：Evidence/Source Reader，说明事实、指导、判断、来源和责任边界。
8. **2:50–3:00**：指出 CoG、VOID、外部证据与性能测量限制，给出 READY_WITH_LIMITATIONS。

## 38 Freeze Decision

最终视觉与功能内容已达到演示级收口，但性能和原生截图像素两个硬门槛没有可接受的 2.9 证据，因此不写入最终冻结标记。建议在可关闭 Chromium background/occlusion throttling、能输出原生 1920×1080 的前台浏览器环境中复跑三次 LCP/CLS 与七个 FPS 场景；全部通过后再转为最终冻结。

## 39 COMPLETE CONTEXT FOR CHATGPT

`PORTCUBE Competition 2.9` 当前状态为 `READY_WITH_LIMITATIONS`。正式数据：Dataset A / DEMO_DATA / 40HQ / hybrid-v2.5 / 212 of 212；SPACE、BALANCE、OPERATION placement hash 均为 `095db720bcd6b519`；hard/stability/operation/port/rehandle 均 0；full unload 与 post-unload stability 均 PASS；three-objective convergence TRUE。CoG：lateral 0.096%，longitudinal 8.266%，`PARTICULAR_CIRCUMSTANCES_REVIEW`。VOID-I-001：2.08 m³、UNEXPLAINED、UNRESOLVED；3.76 m³ 是全局未解释空间汇总。

Landing 已拆为 Hero → Why → Cargo → Cargo→Space → Landing Twin → Evidence → Final CTA；Workspace 已完成 Cargo Inspector、同尺度 Planning、四模式 Twin、Unload、Readiness、Evidence Detail、Source Reader。前端 116 tests、lint、build 全通过；专项后端 35 tests 全通过。25 张截图均逐张视觉 PASS，但由 Codex in-app Browser 导出的 raster 受面板边界限制。2.9 三次冷启动 median content-ready 161.2 ms、max CLS 0；LCP/FCP 无条目，rAF 遮挡后约 1 Hz，所以性能硬门槛未通过证据审计。机器产物：`artifacts/competition-2.9/performance.json` 与 `artifacts/competition-2.9/visual-qa.json`。Solver placements 禁止为视觉目的改动；下次只需在合格前台浏览器环境重跑性能与原生分辨率截图，再决定冻结。
