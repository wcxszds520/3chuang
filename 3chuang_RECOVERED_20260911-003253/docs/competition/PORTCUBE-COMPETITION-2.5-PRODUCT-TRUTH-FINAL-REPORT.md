> 智港立方 PORTCUBE · Competition 2.5 · Product Truth Final Report  
> 冻结日期：2026-08-26 · 工作区：D:\cixing\3chuang  
> 证据入口：[正式基准](../../artifacts/competition-2.5/competition-2.5-benchmark.json) · [测试汇总](../../artifacts/competition-2.5/test-results.json) · [前台 FPS](../../artifacts/competition-2.5/foreground-fps.json) · [截图目录](../../artifacts/competition-2.5/screenshots/)

# 1 Final Verdict

结论：**READY_WITH_LIMITATIONS**。

Competition 2.5 的当前正式产品路径已经达到竞赛冻结条件：hybrid-v2.5 正式基准的 25 个门禁全部通过，Dataset A 与 Dataset B 保护成立，8 类包装真正进入求解与 3D 语义，五页中文工作区、出运准备证据链、Rule → Twin、真实 Chrome 流程、1920/2560/1366 截图和前台 FPS 均有可复核证据。正式基准给出的机器判定为 **PORTCUBE_COMPETITION_2_5_FINAL_FREEZE**；本报告将竞赛构建冻结为 **PORTCUBE_COMPETITION_2_5_PRODUCT_FREEZE**。

“WITH_LIMITATIONS”不是降低竞赛结论，而是保持产品边界真实：PORTCUBE 没有实时承运人/码头/海关接口，不签发 VGM、CSC 或系固认证；Dataset A 仍有 3.76129 m³ 被模型标为未解释空隙；全仓后端遗留测试并未全部迁移到当前架构。这些限制均未被伪装成 PASS。

# 2 Final Product Pain Point

目标用户通常在装箱完成、称重或准备交港时才发现：货物放不下、包装语义没有进入装载约束、重心或支撑不合理、前港货被后港货挡住、空隙没有系固解释、VGM/CSC/包装证明仍缺失。问题发生得太晚，返工成本已经形成。

PORTCUBE 把这些判断前移到货物离开工厂之前：把货物与包装、箱型、约束装载、载荷分布、稳定性、多港卸货、系固输入和出运资料放进同一条可解释决策链，让用户在装箱前知道“怎么装、为什么这样装、还要处理什么”。

# 3 Product Boundary

PORTCUBE 做的是：装箱前数据准备、参考/实际集装箱选择、物理约束求解、方案比较、数字孪生解释、港序与卸货推演、稳定/系固预检、出运准备事项归集，以及从业务结论追溯到数据、规则和空间证据。

PORTCUBE 不做：订舱、报关、海关审批、港口 TOS、集卡调度、船舶配载、实时物流跟踪、完整 IMDG 商业数据库、官方进港放行、认证 VGM、认证 CSC 检验、认证系固工程或全局数学最优证明。无法由当前数据确定的事项必须显示“需外部确认”或“待补资料”，不能推断为失败或通过。

# 4 Target Users

- 出口制造企业的物流与出运人员。
- 仓库、装箱现场和包装负责人。
- 为企业制定装箱方案的货代操作人员。
- 缺少专职装箱工程师、但需要可复核方案的中小出口企业。

典型业务位置是：订单和基础路线已确定 → 货物准备 → PORTCUBE 装箱规划与出运预检 → 实际装箱/称重/货代/车队 → 重箱进入港口物流链。

# 5 Final Information Architecture

一级导航严格收敛为五页：

| 编号 | 中文工作区 | 核心问题 |
|---|---|---|
| 01 | 本票概览 | 这票货是什么、当前结论和下一步是什么？ |
| 02 | 货物与包装 | 货物物理语义与包装约束是否可求解？ |
| 03 | 装载规划 | 用什么箱、三种策略如何比较、推荐哪一套？ |
| 04 | 数字孪生 | 方案在空间里如何成立，风险和卸货如何解释？ |
| 05 | 出运准备 | 当前还差什么、谁处理、依据和原文在哪里？ |

旧英文路由继续作为兼容入口，但不会形成新的一级页面。Container、Rules、Evidence、Report 等能力都被放回所属任务上下文。

# 6 Chinese-first Changes

导航、页头、状态、分析模式、检查器、证据抽屉和业务动作均以中文为主；VGM、CSC、IMDG、IPPC、ISO、SKU、20GP/40GP/40HQ 等必要缩写保留。内部 canonical enum 不直接暴露给用户，例如 DATA_REQUIRED → 待补资料、FULL_UNLOAD_PASS → 全程卸货可行、PARTICULAR_CIRCUMSTANCES_REVIEW → 需专项复核。

实现由统一的本地化映射承接，而不是各页面散落翻译。开发/API 仍保留英文枚举，保证测试和数据契约稳定；呈现层只负责中文格式化。

# 7 UI Design Research

设计研究使用公开官方材料，仅吸收原则：

- [Linear 2026 UI Refresh](https://linear.app/changelog/2026-03-12-ui-refresh)：导航退后、页头一致、减少界面噪声、提高扫描效率。
- [Figma UI3 设计说明](https://www.figma.com/blog/behind-our-redesign-ui3/)：让工作对象成为舞台中心，采用上下文控件、渐进披露和可收起面板。
- [Autodesk Fusion 工作区说明](https://help.autodesk.com/view/fusion360/ENU/?contextId=LP-STEPS-P13N-SNP-GS-OTH-CRD-1)：以任务驱动工作区，Browser/Inspector/Canvas 互相联动，工具跟随当前对象。

PORTCUBE 没有复制品牌色、Logo、专属图标或像素布局。最终语言仍是自己的 Industrial Spatial Decision Workspace：安静、精准、空间化、工程可信。

# 8 Visual Design System

应用 Chrome 使用暖白和中性浅灰；3D 进入石墨色工业工作室；交互使用克制青蓝；关注项使用工业琥珀；阻断才使用受控红色。Normal 模式取消“SKU 彩虹”，真实纸箱、木材、膜、设备箱、钢/塑料桶和织物成为主要色彩。

布局采用 8px 派生网格，普通正文 14–16px，核心数字 20–30px，页标题 28–36px。页面主要由 Canvas、Workbench、Matrix、Rail、Inspector、Timeline、Drawer 和细分隔线组成，每页仅保留 1–2 层真正的 elevation。Quiet Rail 和紧凑上下文条把视觉主权交给当前任务。

# 9 Overview

“本票概览”从 KPI Dashboard 收敛为 Shipment Decision Brief。左侧为真实后端方案的轻量 Three.js Hero，40HQ 与货物占据主要视觉；右侧只保留推荐设备、装载件数、推荐方案、港序/倒货、装载验证、出运准备和单一下一步 CTA。

底部的出运准备轨迹代替卡片化工作流。核心数字来自 Active Plan View Model，同一 backendPlan 供 Overview、Planning、Twin 和 Readiness 使用；加载中显示占位而不是伪造 0。1920 与 1366 截图均证明首页在一屏内可读。

# 10 Cargo & Packaging

“货物与包装”是工程数据编辑器，不是 CRUD 后台。主表保持高密度；选中 SKU 才打开上下文 Inspector。顶部区分“装箱求解是否就绪”和“出运资料还缺什么”，不再用模糊的 100% 完整度。

Inspector 中的包装选择器提供纸箱、木箱、托盘化纸箱、膜包托盘、设备箱、桶装、吨袋和通用包装。不同包装只出现相关字段，例如木材类别/IPPC/叉车孔、托盘方向、桶装直立、堆叠层数和承载上限。包装改变会使旧方案失效，必须重新求解。

AI/图像辅助结果只能写入 AI_SUGGESTION + USER_CONFIRMATION_REQUIRED；用户确认前不会成为正式 Packaging Profile，也不会静默改变求解真值。

# 11 Packaging Domain Model

CargoPhysicalProfile 是单一物理语义源，包含货名、数量、尺寸、单件质量、目的港/港序、包装类型、搬运方式、堆叠性、最大层数、承载上限、易碎、朝向策略、叉车方向、木包装类别、危险品上下文、visualProfile 和 solverEnvelope。

PackagingProfile 记录类型、材质、transportUnit、handlingMode、stackable、maxStackLayers、maximumSupportedWeightKg、fragile、forkEntry、woodPackagingClass、dangerousGoodsContext、orientationPolicy、confirmationStatus 和数据分类。8 个正式类型为 CARTON、WOOD_CRATE、PALLETIZED_CARTONS、WRAPPED_PALLET、EQUIPMENT_CASE、DRUM、FIBC_BAG、GENERIC。

旧输入通过确定性映射进入 V2.5 schema；用户输入、AI 建议和 legacy 映射在 provenance 上可区分。

# 12 Cargo → Solver Mapping

Solver 只相信 solverEnvelope：真实轴对齐包络、允许朝向、堆叠属性、最大层数、承载上限和易碎约束。HORIZONTAL_ROTATION_ONLY 只允许平面旋转，FULL_ROTATION_ALLOWED 才生成六向候选；canInvert 固定为 false。非堆叠包装的 maxStackLayers 被收敛为 1。

托盘/膜包托盘/设备箱和达到重量阈值的货物默认进入叉车搬运；木箱/托盘类会触发木包装事实待确认；桶装可表达直立策略；承载上限和 fragile 参与支撑验证。FloorExtremePointCandidate、CrossSectionLayerBuilder、PlanValidator 和稳定性分析共同消费这些字段，填洞不能绕过包装硬约束。

# 13 Cargo → 3D Mapping

3D 和求解明确分层：Solver Envelope 决定碰撞、支撑、插入与 placement；Visual Mesh 只解释包装，绝不反向修改 placement。CargoVisualFactory 依据 packagingType、materialFamily、assetKey 和 visualProfile 选择资产族，并把真实求解包络作为缩放/对齐边界。

Normal 模式显示真实包装材质；港序、重量、空间、平衡和风险模式才覆盖数据颜色。SKU、朝向、易碎和目的港标识使用共享标签策略，避免每件货物独立纹理。

# 14 Blender MCP Work

本轮重点精修 cargo-kit，而不是为版本号重建 Container/Forklift。cargo-kit.blend 与导出的 cargo-kit.glb 包含 8 个包装族所需的 Carton、Wood Crate、Palletized、Wrapped Pallet、Equipment Case、Drum、FIBC 与 Generic 资产/前缀契约。

资产经过 Inspect → Modify → Viewport/Render → Critique → Refine 的多轮视觉检查，并由验证脚本复核节点、网格、边界与三角面。最终 cargo-kit.glb 为 92 meshes、92 nodes、14,600 triangles、944,656 bytes；全部资产验证结果 valid=true。Container 40HQ 为 69,522 tris，Forklift 为 69,936 tris，Inspection Bay 为 83,704 tris；详细证据见 [blender-asset-validation.json](../../artifacts/competition-2.5/blender-asset-validation.json)。

# 15 Planning

“装载规划”按 Route/Context → Equipment → Actual Container → Strategies → Recommended Plan 排列，回答“用什么箱、怎么装”。页面没有嵌入第二个大型 3D，而是把比较结果集中在一屏决策工作区，并把空间复核交给 Twin。

三策略以共享指标行组成 Strategy Comparison Lanes：装载数、未解释空隙、载荷分布等级、港序、倒货、稳定性、系固和作业成本横向对齐。推荐理由来自后端质量层级，不用毫秒级 runtime 冒充业务理由。

# 16 Equipment

20GP、40GP、40HQ 是 Reference Equipment Profile，不是三张营销卡。Equipment Decision Matrix 逐行比较货物尺寸、门洞、载重、体积余量、实际箱信息和当前适配；简洁比例化轮廓帮助识别长度与高柜差异。

Actual Container Inspector 分组输入身份、内部尺寸、门洞、tare、maximum operating gross mass、payload 和 CSC 信息。实际箱字段会覆盖参考模板并进入 Solver；只有参考箱型时，CSC 不会伪装成已核验。设备来源明确区分参考数据、实际集装箱和用户覆盖。

# 17 Solver V2.4 Regression Root Cause

Dataset A 的 V2.4 SPACE/BALANCE 保留 V2.3 紧密拓扑，internal void 为 3.76636e9 mm³；但 OPERATION 选择 V21_BASE_ASSISTED，internal void 回到 8.53004e9 mm³。

根因不是硬约束或港序失败，而是候选选择：V2.4 在相同载荷分布 guidance class 内，让连续 CoG 数值和策略成本压过布局质量。5.61% 与 8.266% 都属于 PARTICULAR_CIRCUMSTANCES_REVIEW，但前者仅因连续值较小就击败了明显更紧密的 V2.3 topology。

# 18 V2.5 Solver Fix

hybrid-v2.5 保留 V2.3/V2.4 物理核心，引入 guidance-class-first、同类 Pareto 布局选择，并把 FloorExtremePointCandidate 纳入生产候选族。Floor candidate 使用确定性 start/extreme point、合法朝向、操作可行性和可达到的平衡等级，补齐历史 tiny oracle 地板装载缺口。

排序严格遵循：Hard violation → loading block → future-port block → rehandle → post-unload stability → initial stability → mandatory equipment/mass → load distribution class → loaded count → unexplained void → tight-stow/cross-section → securing quality → strategy objective → continuous CoG → runtime。低层得分不能抵消高层安全事实。

# 19 CoG Class vs Continuous CoG

载荷分布先比较离散 class：WITHIN_GENERAL_GUIDANCE 优于 PARTICULAR_CIRCUMSTANCES_REVIEW，后者优于 OUTSIDE_GUIDANCE。只有 class 相同，才允许连续 CoG 参与 Pareto 与最终 tie-break。

这避免两个错误：一是为了紧密度跨级牺牲载荷分布；二是在同一级内为了 2–3 个百分点的连续差异选择碎片化布局。Dataset A 的最终 longitudinal CoG 为 8.266%、lateral 为 0.096%，仍如实显示“需专项复核”，没有被改写成 PASS。

# 20 Pareto Selection

同一安全等级候选比较 unexplainedVoidVolume、internalVoid、crossSectionP10、lowFillInteriorSlices、接触/支撑、系固区域、作业代价和 continuous CoG。明显整体劣势的布局不能仅靠某一个低层指标获胜。

确定性 placement hash 作为复跑证据，而不是选择目标。Dataset A 三策略最终落到相同 placement hash 095db720bcd6b519；界面可将其说明为策略收敛，而不是伪装成三个不同方案。

# 21 Tight Stow

普通纸箱、木箱、设备箱和托盘化货物优先提高面接触、层连续性和 cross-section fill，降低 fragmented internal void。V2.5 使用 CrossSection Layer、Floor Extreme Point、接触压实、global/stage translation 和受门禁约束的 local repair。

“紧密”不等于强制 100% 填满。Dataset A 约 79.43% 体积利用率决定剩余空间必然存在；正确目标是减少无意义碎片，并给较大剩余空间明确分类。

# 22 Void Justification

VoidJustificationAnalyzer 将空间分类为 RESERVE_SPACE、PORT_ACCESS_CORRIDOR、SECURING_ZONE、DOOR_CLEARANCE、STRUCTURAL_CLEARANCE、GEOMETRIC_RESIDUAL 或 UNEXPLAINED_VOID。Twin 的“空间解释”模式把这些类别转为用户语言；点击区域可查看体积、分类、保留原因、关联货物、可否重填和系固关系。

VoidDrivenLocalRepair 只针对未解释区域附近的有限货物重排，并在更高层门禁不恶化、未解释空隙确实下降时才 Promote。Dataset A 的 18 次局部试验没有找到安全提升，结果为 NO_SAFE_PROMOTION；系统保留现方案并公开剩余 3.76129 m³ 未解释空隙，而不是视觉隐藏。

# 23 Dataset A Before / After

| 指标 | V2.4 OPERATION | V2.5 推荐/OPERATION | 变化 |
|---|---:|---:|---:|
| 装载 | 212/212 | 212/212 | 保持 |
| 硬约束 / 作业阻断 | 0 / 0 | 0 / 0 | 保持 |
| 港口可达 / 倒货 | FULL / 0 | FULL / 0 | 保持 |
| 后续港稳定 | PASS | PASS | 保持 |
| internal void | 8.53004 m³ | 3.76636 m³ | -55.846% |
| unexplained void | 0（V2.4 旧分类不可直接等价） | 3.76129 m³ | 新模型显式披露 |
| cross-section P10 | 22.863% | 71.538% | +48.675 pp |
| 低填充内部切片 | 14 | 6 | -8 |
| longitudinal CoG | 5.61% | 8.266% | 同属专项复核级 |
| 直接 solver wall time | 4.507 s | 9.037 s | 质量换取时间 |

Before/After 的数值和 placement hash 来自 [comparison JSON](../../artifacts/competition-2.5/competition-2.5-dataset-a-before-after.json)。[对比图](../../artifacts/competition-2.5/screenshots/16-dataset-a-before-after.png) 重新求解两版真实 placements，并在完全相同的坐标比例下并排渲染侧视、顶视、门视和当前 V2.5 空隙分类，不是伪造应用状态。

# 24 Dataset B

Dataset B 三策略全部保持 69/69、hard 0、operation blocked 0、FULL_UNLOAD_PASS、rehandle 0、post-unload stability PASS。最终 lateral/longitudinal CoG 均为 0%，状态 WITHIN_GENERAL_GUIDANCE，placement hash 22333144d52bb271，三策略复跑确定。

V2.4 解决的 14.06% sparse/multi-port CoG 回归没有因 V2.5 tight-stow 策略而重新出现；local repair 在保持高层门禁的前提下成功 Promote。

# 25 Packaging Benchmark

包装语义基准包含 24 个确定性 case，覆盖 8 种正式类型，每类包含直立、平面旋转和非堆叠/受限组合。结果为 semantics 24/24、solver 24/24、determinism 24/24，所有 case 的 hard violation 与 operation block 均为 0。

每个结果记录 visualAssetKey、允许朝向数量、loadedCount 和 placementHash，证明包装不是只改变前端图标。证据见 [competition-2.5-packaging-cases.json](../../artifacts/competition-2.5/competition-2.5-packaging-cases.json)。

# 26 Port / Unload

PortAccessibilityValidator 按目的港顺序执行真实提取：寻找同港可行顺序、识别 future-port blocker、卸出当前港货物，再对剩余货物重算稳定性，直到空柜。同港内部换序不算倒货；必须先移动后续港货物才计 rehandle。

正式基准的 Dataset A、B、48 fixed、64 challenge、20 tiny 和 24 multi-port case 均保持 zero rehandle；24 个 multi-port case 全程卸货与卸后稳定门禁通过。Twin 卸货推演显示当前港、未来港、已卸数量、剩余数量、倒货和卸后稳定状态。

# 27 Stability

Geometric Stability 与 Transport Securing 被分开。前者计算支撑比例、支撑多边形、cargo/stack CoG、stack margin、slenderness、接触与方向约束；初始计划和每港卸货后都重新分析。

PlanValidator、StabilityAnalyzer 和 PortAccessibilityValidator 的职责相互独立：几何/朝向/碰撞和 LIFO 不被一枚“STABLE”徽章合并。Dataset A/B 均为 initial stability PASS、post-unload stability PASS、stability invalid 0。

# 28 Securing

SecuringAnalyzer 先识别外露面、边界空带、阻挡面和需要关注的自由空间；TransportSecuringAnalyzer 再根据运输方式、质量、CoG、摩擦、blocking capacity、lashing capacity/angle 等输入进行工程预检。

缺少摩擦或系固能力等关键输入时，结论是“系固条件待确认/待补数据”，不会自动 PASS。Twin Risk/空间模式可显示 securing zone 或 boundary；这仍不是认证系固计算。

# 29 Twin

数字孪生保持 80–90% 有效面积的绝对 Hero。工具收敛为中文“视图 / 分析 / 作业 / 解释”，包含总览、门侧、侧视、顶视、剖切；标准、重量、港序、空间、平衡、风险；装载回放、卸货推演；放置原因、方案对比、规则证据。

Normal 模式显示真实包装；Space 模式可点击空隙；Risk 显示几何/系固关注；Unload 逐港移除；Rule → Twin 通过 URL query 与上下文状态直接进入目标分析模式。默认不显示 debug HUD，性能 telemetry 仅作为 DOM/开发证据。高分辨率视口已放宽最大高度，在 2560×1440 下不再留下大块空白。

# 30 FPS

数据来自真实前台 Chrome、1920×1080、requestAnimationFrame 采样；后台标签页因 Chrome throttle 被排除。

| 场景 | Median FPS | P10 FPS | Draw calls | Triangles |
|---|---:|---:|---:|---:|
| 港序稳态 | 90.50 | 82.61 | 123 | 448,546 |
| 标准模式稳态 | 95.22 | 80.00 | 127 | 448,550 |
| 风险/系固复核稳态 | 89.98 | 85.05 | 123 | 448,546 |
| 卸货空闲 | 109.11 | 98.00 | — | — |
| 卸货运动中（4×，已卸 8 件） | 107.10 | 58.99 | 382 | 287,786 |

标准模式资产切换的瞬时峰值为 240 calls / 896,730 tris；稳态数值是主要口径。所有场景超过 Normal ≥60、复杂模式 ≥45 的门槛。原始记录见 [foreground-fps.json](../../artifacts/competition-2.5/foreground-fps.json)。

# 31 Shipment Readiness

“出运准备”取代 9-domain Admission Matrix，首屏只回答“这票货现在还差什么”。五个业务域为：箱体与重量、空间与堆码、载荷与稳定、港序与作业、出运条件。默认展开待处理、需复核和需外部确认；已通过折叠，不适用隐藏。

ShipmentReadinessService 使用同一 Case/Cargo/Packaging/Container/Plan/Validation 真值生成当前事项、已完成数和 overall decision。实时码头/承运人状态未知时，明确说明 PORTCUBE 不连接对应外部系统。

# 32 Why No 17-Rule Matrix

17 条 Registry 记录混合了法定要求、工程指导、参考数据、未来草案和未知码头上下文；把它们称作“17 条法规”会同时误导用户和评委。普通用户也不应先读 Rule Library 才知道该做什么。

新层级是：业务结论 → 当前数字与原因 → 判定依据 → 官方原文 → 空间证据。后台 Registry 可继续增长，但前端只呈现与当前 Case 真正相关、且能产生动作或解释的事项。

# 33 Context Resolver

Rule Resolver 使用 caseDate、国际/中国 jurisdiction、route/terminal、cargo facts、危险品/木包装事实和 scope 解析 applicability。ACTIVE 才进入 evaluator；FUTURE、DRAFT、SUPERSEDED、UNKNOWN 不会覆盖当前有效判断。

基准包含 11 个 admission/date case，全部通过，包括 missing VGM、over max gross、参考箱无实际 CSC、future/draft 不激活、actual CSC expired 和完整资料仍需外部确认。Case date 是硬输入，而不是 UI 标签。

# 34 Decision Evidence

DecisionEvidence 的核心字段为 id、domain、title、status、currentValue、limit/recommendedRange、unit、comparison、summary、detail、ruleReferences、inputReferences、calculation、dataCompleteness、spaceEvidence、requiredAction 和 responsibility。

前端只格式化和可视化，不重算重量、CoG、稳定性、港序、void 或 readiness。这样同一个判定可在概览、Twin、出运准备和证据抽屉中保持一致，并可回到后端计算/输入来源。

# 35 Weight Evidence Example

Dataset A 的货物质量为 8,623 kg；参考 40HQ tare 为 3,810 kg，因此当前估算总质量为 12,433 kg。参考设备最大营运总质量为 32,500 kg，估算余量为 20,067 kg。算术结论是“当前估算未超上限”。

但参考设备数据不等于实际箱 CSC 数据，估算总质量也不等于核验总质量（VGM）。没有真实实际箱、包装/垫料/系固质量闭合、称重/Method 2 证据和托运人申报时，VGM 仍显示待补资料。依据入口分别关联 SOLAS VI/2、MSC.1/Circ.1475 与当前有效中国规则，而非给出“合规通过”总括。

# 36 Load Distribution Evidence Example

Dataset A V2.5 当前 lateral CoG offset 为 0.096%，longitudinal 为 8.266%。当前 class 为 PARTICULAR_CIRCUMSTANCES_REVIEW：它没有越过 mandatory equipment/mass limit，但超出一般 ±5% 工程指导区间，因此结论必须是“需专项复核”，不是“平衡通过”。

Evidence 展示 Container Centre、Current CoG、推荐区域与 offset vector；点击可进入 Twin Balance/Space。规则层级显示为工程指导，输入来源显示 placement geometry、item mass 和 container geometry。

# 37 Rule Level

用户可见层级固定为：法定要求、工程指导、项目策略、码头条件、参考数据。BIC ISO type code 与 Maersk equipment flyer 是参考数据；CTU packing/CoG/securing 主要是工程指导；SOLAS VGM、CSC、适用的 IMDG/中国规章属于法定要求；公开码头流程快照不是实时放行。

未来或草案记录只在开发/规则详情中可见，不能作为当前业务阻断依据。每条 Registry 记录含 authority、jurisdiction、scope、effectiveFrom/effectiveTo、status、version、source、clause、requiredInputs 和 evaluator。

# 38 Responsibility

每个待处理事项明确责任方，而不是只显示颜色：VGM 通常由托运人/相关业务方完成并留存证据；实际箱与 CSC 信息来自设备提供方/现场；木包装证明由发货企业/包装责任方提供；装箱单或订舱资料由货代/业务代理处理；实时进箱/航次接受由码头或承运人外部系统确认。

Responsibility 只表达工作归属，不替代法律责任判断；具体合同和流程仍以实际业务关系为准。

# 39 Evidence Drawer

从每个业务事项的“判定依据”打开 420–520px 右侧 overlay，不挤压主工作区。抽屉只保留当前判定、当前值/阈值、规则性质、数据来源、计算说明、责任方和需要动作。

它是业务结论的第二层，不是全量规则浏览器；只有用户继续点击“查看官方原文”，才进入 Source Reader。

# 40 Source Reader

Source Reader 使用 split layout：左侧官方网页/PDF/本地摘录，右侧显示 authority、文件、条款、状态、有效日期、为什么适用、当前用于什么判断。条款用 soft amber 与左侧 marker 高亮，移除巨大红框式“证据”。

“查看本票如何应用”提供反向链：规则条件 → 当前设备/货物输入 → 当前值 → 比较 → 结果。外部链接仍以官方 primary source 为准，Reader 不把摘录当作完整法律意见。

# 41 Rule → Twin

空间相关证据具有明确映射：CoG/载荷分布 → Balance；港口可达 → Unload Replay/Port；堆码与稳定 → Risk；系固空间 → Space/Risk；木包装或危险品 → 相关货物 isolate。路由 query 保留 analysis/operation 目标，Twin 加载后自动聚焦相应上下文。

真实浏览器验证了从出运准备的规则/证据入口进入 Twin，目标模式、选中对象和中文 Inspector 正确，且控制台无应用错误。

# 42 Rule Registry Cleanup

后端正式名称是 Rule / Guidance / Reference Registry。当前快照包含 active legal rules、CTU guidance、BIC/Maersk reference、future/draft 条目和 NBSCT unknown operational snapshot；它们不再被同质化计数。

Registry 是带日期的证据索引，不是法务 CMS，也不替代承运人、码头或主管机关。普通页面隐藏 future/draft/reference 噪声，只有 resolver 选出的当前事项进入 Shipment Readiness。

# 43 Frontend Tests

最终复跑结果：

- npm test -- --run：32/32 test files、114/114 tests 通过，13.18 s。
- npm run lint：通过，0 warnings。
- npm run build：通过，1,662 modules，12.76 s。
- CargoVisualFactory、activePlanViewModel、strategyRecommendation、session、operation machine、3D geometry、presentation、API 与 compliance 相关测试均在通过集合内。

构建仍发出应用 chunk 903.75 kB 超过 900 kB 的警告，作为已知性能债记录，不伪装为无警告构建。

# 44 Backend Tests

当前正式路径通过：HybridConstraintPackingSolverV25、FloorExtremePointCandidate、PackagingProfileV25、ShipmentReadinessServiceV25、shipment-readiness-v25 integration、V2.4/V2.3 regression、TinyFloorPackingOracle、solverBenchmark，以及正式 Competition 2.5 benchmark。

正式基准耗时 676,651 ms，25/25 gates 通过：Dataset A/B、48 fixed、64 challenge、20 tiny、24 multi-port、24 packaging、11 admission/date 全部满足各自核心与确定性门禁。

全仓 npm test 的诚实结果并非全绿：72 suites 中 44 passed / 28 failed，704 tests 中 635 passed / 69 failed，运行 1,359.657 s，并有数据库 pool TCPWRAP 未自动关闭。失败集中在已删除 Simple/DBLF/旧 PackingEngine、退役 API/响应契约、只允许三类包装的旧断言、旧 mini-program BASE_URL、非隔离 live DB destructive test、旧 API timeout 和可生成重复 cargoId 的 property generator。按照原任务要求，这些被标记为 OBSOLETE/LEGACY 迁移债，没有为了“全绿”恢复废弃架构；完整分类见 [test-results.json](../../artifacts/competition-2.5/test-results.json)。

# 45 Browser QA

真实 backend 127.0.0.1:3000 与 Vite 127.0.0.1:5173 联调完成。验证流程覆盖：本票概览 → 货物与包装 → 包装编辑/方案失效 → 重新求解 → 装载规划 → 数字孪生 → 空间解释 → 卸货推演 → 出运准备 → 判定依据 → Source Reader → Rule → Twin。

真实 Chrome 与 Playwright 复核均记录 0 application console errors。1920×1080 为主审；2560×1440 Twin/Readiness 和 1366×768 Overview 均完成兼容截图。计算机控制工具在一次窗口恢复检查中因无法可靠确认 Windows 当前 URL 主动停止，但不影响已完成的真实 Chrome 流程、截图和性能证据。

# 46 Screenshot Index

| 文件 | 分辨率 | 目的 / 内部视觉复核 |
|---|---:|---|
| [01-overview-1920.png](../../artifacts/competition-2.5/screenshots/01-overview-1920.png) | 1920×1080 | 五秒决策摘要、Hero 与单一 CTA |
| [02-cargo-packaging-1920.png](../../artifacts/competition-2.5/screenshots/02-cargo-packaging-1920.png) | 1920×1080 | 高密度货物/包装工作区 |
| [03-cargo-packaging-inspector-1920.png](../../artifacts/competition-2.5/screenshots/03-cargo-packaging-inspector-1920.png) | 1920×1080 | 包装画像与用户确认 |
| [04-planning-equipment-1920.png](../../artifacts/competition-2.5/screenshots/04-planning-equipment-1920.png) | 1920×1080 | 设备决策矩阵 |
| [05-planning-strategies-1920.png](../../artifacts/competition-2.5/screenshots/05-planning-strategies-1920.png) | 1920×1080 | 三策略横向决策 lanes |
| [06-twin-normal-1920.png](../../artifacts/competition-2.5/screenshots/06-twin-normal-1920.png) | 1920×1080 | 标准包装与 Twin Hero |
| [07-twin-packaging-1920.png](../../artifacts/competition-2.5/screenshots/07-twin-packaging-1920.png) | 1920×1080 | 包装语义和货物 Inspector |
| [08-twin-void-explanation-1920.png](../../artifacts/competition-2.5/screenshots/08-twin-void-explanation-1920.png) | 1920×1080 | 空隙分类、区域说明 |
| [09-twin-unload-1920.png](../../artifacts/competition-2.5/screenshots/09-twin-unload-1920.png) | 1920×1080 | 逐港卸货与剩余稳定 |
| [10-readiness-overview-1920.png](../../artifacts/competition-2.5/screenshots/10-readiness-overview-1920.png) | 1920×1080 | 五业务域与真实待办 |
| [11-readiness-weight-evidence-1920.png](../../artifacts/competition-2.5/screenshots/11-readiness-weight-evidence-1920.png) | 1920×1080 | 质量刻度、VGM 边界 |
| [12-readiness-load-distribution-1920.png](../../artifacts/competition-2.5/screenshots/12-readiness-load-distribution-1920.png) | 1920×1080 | CoG 点、推荐区域与向量 |
| [13-evidence-drawer-1920.png](../../artifacts/competition-2.5/screenshots/13-evidence-drawer-1920.png) | 1920×1080 | 420–520px 证据抽屉 |
| [14-source-reader-1920.png](../../artifacts/competition-2.5/screenshots/14-source-reader-1920.png) | 1920×1080 | 官方原文与应用说明 |
| [15-rule-to-twin-1920.png](../../artifacts/competition-2.5/screenshots/15-rule-to-twin-1920.png) | 1920×1080 | 规则到空间的上下文连续性 |
| [16-dataset-a-before-after.png](../../artifacts/competition-2.5/screenshots/16-dataset-a-before-after.png) | 1920×1080 | 真实 placements 同比例侧/顶/门/空隙对比 |
| [17-twin-2560.png](../../artifacts/competition-2.5/screenshots/17-twin-2560.png) | 2560×1440 | Twin 大屏完整占位 |
| [18-readiness-2560.png](../../artifacts/competition-2.5/screenshots/18-readiness-2560.png) | 2560×1440 | Readiness 大屏密度 |
| [19-overview-1366.png](../../artifacts/competition-2.5/screenshots/19-overview-1366.png) | 1366×768 | 兼容演示 |

这些均使用真实计划/基准数据。第 16 张是从正式 JSON 生成的比较证据板，不是产品 UI mock；其它为实际应用浏览器截图。内部复核结论：主视觉焦点明确、投影字号可读、卡片墙感显著降低、Twin 工业可信度和竞赛冲击力达到冻结标准。

# 47 Changed Files

| 文件/目录 | 最终职责 |
|---|---|
| backend/services/HybridConstraintPackingSolverV25.js | V2.5 候选生成、门禁、class-first 与 Pareto 选择 |
| backend/services/packing/FloorExtremePointCandidate.js | 有界地板极值点候选与 tiny gap closure |
| backend/services/packing/PackagingProfile.js | CargoPhysicalProfile/PackagingProfile 规范化 |
| backend/services/packing/LayoutQualityAnalyzer.js | cross-section、void topology、contact 指标 |
| backend/services/packing/VoidJustificationAnalyzer.js | 空间分类与解释 |
| backend/services/packing/VoidDrivenLocalRepair.js | 安全门禁约束下的局部修复 |
| backend/services/packing/PlanValidator.js | 几何、朝向、支撑与 LIFO 验证 |
| backend/services/realworld/ShipmentReadinessService.js | 五业务域、DecisionEvidence 与动作 |
| backend/services/realworld/RuleRegistry.js | 带日期的规则/指导/参考索引 |
| backend/routes/packing.js | packaging normalize、generate、readiness/equipment/rule API |
| backend/models/Cargo.js | 持久层包装与物理字段 |
| web-dashboard/src/domain/plan/activePlanViewModel.js | 跨页面单一计划视图真值 |
| web-dashboard/src/domain/presentation/localization.js | 中文状态呈现 |
| web-dashboard/src/pages/workflows/DashboardPage.jsx | 本票概览 |
| web-dashboard/src/pages/workflows/CargoPage.jsx | 货物与包装编辑器 |
| web-dashboard/src/pages/workflows/ContainerPage.jsx | 装载规划与设备/策略矩阵 |
| web-dashboard/src/pages/workflows/TwinPage.jsx | Twin 工具、深链接与 Inspector |
| web-dashboard/src/pages/workflows/CompliancePage.jsx | 出运准备五业务域 |
| web-dashboard/src/three/TwinScene.jsx | 3D 模式、包装、空隙、卸货与 telemetry |
| web-dashboard/src/three/cargo/CargoVisualFactory.js | 包装类型到 GLB/primitive 映射 |
| assets-src/blender/cargo-kit.blend | 包装资产源 |
| web-dashboard/public/assets/3d/cargo-kit.glb | Web 运行时包装资产 |
| backend/benchmarks/runCompetition25Benchmark.js | 25 门正式冻结基准 |
| backend/benchmarks/renderDatasetAVisualComparison.js | Dataset A 两版真实 placements 同坐标对照渲染器 |
| artifacts/competition-2.5/ | 基准、测试、FPS、资产验证与截图证据 |

工作树在任务开始前已经包含未提交改动；本轮未 reset、clean、commit 或 push，也没有覆盖未知用户文件。

# 48 New Schemas

- CargoPhysicalProfile：货物尺寸/质量/港序/包装/搬运/堆叠/朝向/承载/视觉与 solverEnvelope 的总模型。
- PackagingProfile：8 类包装、材质、transportUnit、fork entry、wood class、DG context、confirmation provenance。
- SolverEnvelope：与视觉网格分离的真实几何和允许朝向。
- LayoutQuality / VoidJustification：cross-section、internal/unexplained void、分类区域、局部修复结果。
- DecisionEvidence / RuleEvidence：当前值、阈值、比较、规则、输入、计算、空间证据、动作和责任。
- ShipmentReadinessResult：五业务域、默认可操作事项、summary 与 overall decision。
- PortAccessResult：逐港提取、future blocker、same-port reorder、rehandle 与卸后稳定。
- Twin performance report：mode、operationPhase、sample count、median/P10、draw calls、triangles。

这些 schema 为 additive integration，没有拆成微服务，也没有让前端成为第二套计算引擎。

# 49 Performance

正式 direct benchmark 中 Dataset A 三策略约 8.872–9.578 s，Dataset B 约 7.054–7.355 s；完整 25 门基准包含确定性复跑和多语料验证，总耗时 676.651 s。浏览器中三策略经当前 API、验证/解释链路串行执行时，单策略端到端观察约 31.5–36.3 s，因此客户端 timeout 从 60 s 调整为 180 s；没有伪造百分比进度。

生产构建 gzip：CSS 26.86 kB、React 45.27 kB、Three 139.58 kB、应用主 chunk 356.36 kB；主 chunk 原始 903.75 kB 有警告。3D 稳态约 123–127 draw calls、448k tris；卸货运动场景 P10 58.99 FPS，满足竞赛机器现场门槛。

# 50 Known Limitations

1. 没有实时 carrier、terminal、customs 或 gate API；相应状态只能“需外部确认”。
2. Reference Profile 不是实际集装箱；CSC、actual dimensions、tare/max gross、VGM 仍需真实证据。
3. 不签发认证 VGM/CSC/系固结果；没有完整商业 IMDG 数据库、刚体动力学或全局最优证明。
4. Dataset A 虽将 internal void 降低 55.846%，仍有 3.76129 m³ 被 V2.5 标为 UNEXPLAINED_VOID；局部修复没有找到不牺牲高层门禁的更优方案。
5. Dataset A 直接求解约 9 s，浏览器端完整策略调用约 31.5–36.3 s；适合本地竞赛演示，但仍有 worker/off-thread、缓存和候选剪枝优化空间。
6. Web 应用主 chunk 903.75 kB 触发 Vite 警告，尚未完成路由/Three 功能按需拆分。
7. 全仓后端 Jest 仍有 28 个 legacy suites 失败和 DB TCPWRAP open handle；当前 V2.5/保护路径通过，但仓库不应宣称 CI-clean。
8. FPS 是单台机器、单次前台 Chrome 证据，不等同于跨 GPU 实验室基准。
9. 第 16 张 Before/After 为真实 benchmark 数据生成的报告板，不是实时交互页面。

# 51 3-minute Demo

- 0:00–0:25 本票概览：说明“装之前发现问题”，指出 40HQ、212/212、真实推荐方案和下一步。
- 0:25–0:50 货物与包装：打开一个 SKU，切换纸箱/木箱/托盘，强调 AI 只建议、用户确认后包装才进入求解；说明 envelope 与 mesh 分离。
- 0:50–1:20 装载规划：横看设备矩阵和三策略；指出推荐不是 runtime 决定，而是安全等级、装载、空隙和作业的分层比较。
- 1:20–2:05 数字孪生：Normal 看真实包装；Space 点击空隙；Port/Unload 展示 0 倒货和卸后稳定。
- 2:05–2:50 出运准备：打开质量和载荷分布，展示当前值、阈值、责任方、证据抽屉、官方原文和 Rule → Twin。
- 2:50–3:00 收束：PORTCUBE 在离厂前把装箱、稳定、港序和出运资料问题前移，但外部放行仍由真实业务系统确认。

# 52 5-minute Demo

- 0:00–0:35：用 Overview 建立用户、痛点和 pre-shipment 边界。
- 0:35–1:20：Cargo Inspector 展示 8 类包装、上下文字段、AI 待确认状态；修改包装后方案失效并重新求解。
- 1:20–2:05：Planning 比较 reference/actual container、门洞/载重/体积和 SPACE/BALANCE/OPERATION；说明同 placement 时显示收敛。
- 2:05–3:15：Twin 依次切换 Normal、Packaging、Space、Balance、Risk；点击未解释空隙并说明 3.76129 m³ 的诚实披露。
- 3:15–3:50：Unload Replay 走完整港序，展示 future-port blocker=0、rehandle=0、每港卸后稳定。
- 3:50–4:40：Shipment Readiness 从待处理事项进入 Weight Evidence、Load Distribution、Evidence Drawer、Source Reader，再通过 Rule → Twin 回到空间。
- 4:40–5:00：展示 Dataset A Before/After、Dataset B 保护、24/24 包装语义和真实前台 FPS；最后明确“不保证进港，只提供可追溯预检”。

# 53 Final Competition Assessment

Competition 2.5 已从“继续堆功能”收敛为一个有清晰业务边界的出口集装箱装载与出运准备工具。关键提升不是多一个页面，而是三条真值链闭合：

1. Packaging → CargoPhysicalProfile → Solver Envelope → Validator → 3D Visual Factory。
2. Candidate → 安全门禁 → CoG class → Pareto tight-stow → Void explanation。
3. Case/Plan → Shipment Readiness → Decision Evidence → Source Reader → Rule → Twin。

评委在五秒内可以看懂当前票、正式方案、空间证据和下一步；用户不再面对内部枚举或“17 条法规”；Twin 仍是视觉主角；重要数字可回溯；未知状态没有被涂成绿色。基于 25/25 正式门禁、当前路径测试、真实 Chrome 和证据截图，最终竞赛结论是：

**PORTCUBE_COMPETITION_2_5_PRODUCT_FREEZE**

生产化结论仍为 READY_WITH_LIMITATIONS，后续只应处理 critical bug、真实业务材料、性能拆分和 legacy test migration，不再扩张一级业务范围。
