# PORTCUBE Competition 2.7 Experience Freeze Report

生成日期：2026-08-28  
项目根目录：D:\\cixing\\3chuang  
验收对象：公开 Landing、专业 Workspace、hybrid-v2.5 Solver 真值与竞赛演示链路

## 1. Executive Verdict

**READY**

Competition 2.7 的公开体验、专业工作台与正式 Solver 真值已完成联合验收。Landing 通过三轮以上有意义的截图驱动收敛；20 张指定截图均由实际浏览器生成；公开页与 Workspace 有明确的视觉和任务边界；真实 212 件方案贯穿规划、Twin、出运验证与证据阅读；正式 Competition 2.5 基准 25/25 闸门通过；全新浏览器会话为 0 errors / 0 warnings。

冻结不代表外部出运条件已自动成立。VGM、实际箱 CSC/尺寸、承运人或码头受理等仍按真实状态显示为待补或外部确认；Dataset A 的纵向重心仍被诚实标记为 PARTICULAR_CIRCUMSTANCES_REVIEW，未伪装为一般指导范围内。

## 2. What Changed

- 将根路由重建为连续叙事的公开体验，而非 KPI 首页或后台预览。
- 建立独立的 Competition 2.7 透明资产目录与统一映射，避免散落引用和装饰图冒充业务证据。
- 将真实 Three.js Twin 嵌入 Landing 的数字孪生章节，读取当前方案真实 placements。
- 对 Cargo、规划/设备、出运验证、证据详情和来源阅读器做竞赛级中文工作台精修。
- 保留并复核现有 hybrid-v2.5 Solver；本轮没有为了视觉效果修改 placement 或 Solver 搜索核心。
- 建立 1920×1080 主验收与 1366×768 兼容验收，共 20 张最终截图。

## 3. Landing Architecture

根路由为 /，专业工作台入口为 /workspace。Landing 采用一条从问题、货物语义、空间求解、数字孪生到证据闭环的连续滚动路径：Hero → Why → Understand Cargo → Cargo to Space → Real Digital Twin → Evidence Chain → Final CTA。顶部导航仅锚定这条叙事，不复制 Workspace 的任务导航。

每个章节承担一个判断问题，避免同一屏同时堆叠产品介绍、统计卡和后台操作。首屏的唯一主动作是“开始一票装载决策”，结尾 CTA 再次进入专业工作台。

## 4. Landing Visual System

视觉语言为编辑式米白底、深港口绿、克制金色辅助线和大比例工业实物。层级主要依靠留白、比例、字体和对象构图，而非大量阴影、渐变与圆角卡片。透明 PNG 以真实物件舞台方式进入布局；深色 Twin 章节形成明确的沉浸切换。

1920 主视图下，Hero 保持一句主张、简短解释、单一主 CTA 与装载剖切对象。1366 兼容视图保留完整主张和可操作入口，没有横向溢出。

## 5. Final Asset Usage Map

| 资产 | 最终用途 | 真实性边界 |
| --- | --- | --- |
| hero-loaded-container.png | Hero、Why、最终 CTA 的连续主对象 | 策划展示图；页面明确说明求解数据仍来自当前正式方案 |
| container-open.png | Cargo → Space 的空箱与约束舞台 | 只解释空间链路，不替代正式箱型或 placement |
| cargo-carton.png | Landing 包装台、Cargo 表格/编辑器缩略图 | 仅代表包装语义；尺寸重量来自本票输入 |
| cargo-wood-crate.png | Landing 包装台、空间步骤、Cargo 缩略图 | 不从图片推断检疫或承压结论 |
| cargo-wrapped-pallet.png | Landing 包装台、空间步骤、Cargo 缩略图 | PALLETIZED_CARTONS 与 WRAPPED_PALLET 的视觉映射 |
| cargo-drum.png | Landing 包装台、空间步骤、Cargo 缩略图 | 滚动/固定条件仍由结构化字段决定 |
| cargo-ibc.png | Landing 包装台、Cargo 缩略图 | 包装示意，不构成液体运输合规结论 |
| cargo-fibc.png | Landing 包装台、空间步骤、Cargo 缩略图 | 柔性包装语义，不替代吊装或堆叠证据 |
| evidence-bolt-seal.png | Landing 证据状态区的封志装饰对象 | 明确为装饰图，不作为本票封志证据 |
| optional-vgm-document.png | Landing VGM 语义示意 | 明确标注“仅作语义示意”，不作为 VGM 凭证 |
| optional-equipment-case.png | EQUIPMENT_CASE 的 Cargo 缩略映射 | 仅做包装视觉备用 |

## 6. Landing Motion System

动效分为三类：标题与正文的 Editorial Reveal、透明物件的 Object Staging、货物 → 求解 → Twin 的 Spatial Transformation。章节状态由 IntersectionObserver 驱动；Twin 只在临近或进入可视区时激活帧循环，避免不可见场景持续渲染。

进入工作台使用 560 ms 的品牌过渡；系统检测 prefers-reduced-motion 时取消等待并降低复杂运动。截图模式参数 capture=1 只使内容稳定显现，不替换业务数据。

## 7. Landing Chapter-by-Chapter Result

1. **Hero**：用“不是把货塞进箱子，是装箱前先把结果看清。”在五秒内建立产品定位。
2. **Why**：围绕门洞、支撑/平衡和下一港卸载说明“装得下不等于装得对”。
3. **Understand Cargo**：六类包装成为单对象舞台，解释结构化包装语义进入求解的方式。
4. **Cargo → Space**：五步呈现货物实体、求解包络、候选位置、最终落位与验证完成。
5. **Real Digital Twin**：同一真实方案切换标准、空间、重心和卸载视角，未另造展示 placements。
6. **Evidence Chain**：从事实、计算、条件、判断到来源，读取当前方案和 readiness 模型。
7. **Final CTA**：将公开叙事收束为“进入专业工作台”的一票任务入口。

## 8. Landing → Workspace Transition

Landing 是对外叙事，Workspace 是工程任务。CTA 经品牌过渡进入 /workspace；Workspace 立即显示当前本票、货物数、参考箱型、方案来源与验证状态。公开页不携带工作台侧栏、密集表格或工具条，工作台也不复刻营销章节。

实际浏览器验证覆盖公开页 CTA、Workspace 内部单页导航及 /workspace 直接访问。直接访问在没有正式求解结果时会诚实进入 LOCAL_PREVIEW，而非伪造 BACKEND_SOLVED。

## 9. Workspace Global Polish

- 保持五个任务入口：本票决策、货物、规划、孪生、出运验证。
- 全局上下文条持续显示 Case、件数、箱型、方案来源和验证状态。
- 业务页以 pane、strip、canvas、inspector 和 hairline divider 组织，减少普通 SaaS 卡片堆叠。
- 核心数字继续从 activePlanViewModel 读取；loading/null 不格式化为业务上的 0。
- 中文为主，算法 ID、标准缩写和必要状态保留英文以便核验。

## 10. Cargo Page Changes

Cargo 页强化为工程数据编辑器：主表增加真实包装缩略图、包装类型、尺寸、重量×数量、目的港、搬运与关键约束；行级 Inspector/Editor 使用相同的 curatedCargoAsset 映射。图片不参与尺寸推断，结构化字段仍是 Solver 输入。

本轮保留搜索、导入、新增、复制、删除与校验能力，并用更清晰的层级处理选中行、错误和关键约束。1920 截图覆盖主表和打开 Inspector 两种状态。

## 11. Planning / Equipment Changes

规划页将航线、设备和策略组织为专业 workbench。设备矩阵横向比较 20GP、40GP、40HQ，并显式区分“参考箱型”和“实际箱草稿”；实际放箱尺寸、门洞、皮重、最大总重与 CSC 资料必须覆盖参考值。

三策略以共享安全门禁的 decision lanes 呈现 SPACE、BALANCE、OPERATION。页面明确说明 V2.5 先比较硬约束、港序与指导等级，再在同等级内比较空洞、紧密度、系固质量、连续重心和策略目标。

## 12. Digital Twin Changes

Landing Twin 直接复用 TwinScene、OperationMachine、当前方案和真实 placement。Workspace Twin 保留标准、空间和卸载验证等真实分析模式；本轮截图覆盖 normal、space 和 unload。

Landing 中的轻量展示使用同一 Cargo GLB、真实箱体坐标和分析模式，没有为了官网视觉重新排货。场景只在可视区域附近运行，并尊重 reduced motion。

## 13. Shipment Readiness Changes

出运验证页从简单 PASS/FAIL 升级为按业务域和责任人组织的责任动作工作台。缺资料、需复核、外部确认与已就绪分开表达；已通过项降低视觉权重，不适用项不制造噪声。

真实 212 件正式方案浏览流程中显示 7 项仍需处理。它们是需要外部资料或工程确认的真实待办，不是前端故障，也不会被绿色状态覆盖。

## 14. Evidence Inspector Changes

Evidence Inspector 按“事实、条件、判断、依据、完整性、责任人”组织，而不是只给结论色。规则引用、计算口径、输入引用与空间证据保持可追溯；有空间证据时提供“查看本票如何应用”进入 Twin。

本轮 1920 截图覆盖了选中证据详情，确认阅读顺序、责任信息和动作层级清晰。

## 15. Source Reader Changes

来源阅读器最终固定为三列桌面结构：01 来源身份、02 命中摘录、03 本票应用。第一列说明发布方、效力层级、快照与解析状态；第二列只显示支撑本条判断的最小上下文；第三列展示当前值、限制/分类、计算口径与责任。

最后一次视觉修正专门解决了桌面端被旧 CSS 覆盖为两列的问题。截图 17 复验为真正三列，且保留官方来源链接与“外部页面不等于实时受理”的边界说明。

## 16. Chinese Localization Changes

公开页与主要工作台路径统一为自然中文任务语言。BACKEND_SOLVED、LOCAL_PREVIEW、hybrid-v2.5、VGM、CSC、ISO 等保留为可审计的技术标识；一般状态、动作、证据完整性和责任说明使用中文。

页面不再用大量全大写英文副标题制造“科技感”，也没有把标准名称或 Solver ID 翻译成无法核验的营销词。

## 17. Solver Truth Audit

正式 Solver 为 hybrid-v2.5。Competition 2.5 正式基准耗时 1,967,046 ms（32 分 47.046 秒），输出决策 PORTCUBE_COMPETITION_2_5_FINAL_FREEZE。25 个 gates 全部为 true。

项目数据与合成数据明确分类：Dataset A/B 为 DEMO_DATA；fixed/challenge/tiny/multiport/packaging 分别为 SYNTHETIC_BENCHMARK、SYNTHETIC_EXACT_ORACLE、SYNTHETIC_MULTIPORT、SYNTHETIC_PACKAGING_SEMANTICS；准入为 DETERMINISTIC_RULE_CASES。本轮未修改 Solver 核心或人为调整 placement。

## 18. Dataset A Layout Audit

Dataset A 在 SPACE、BALANCE、OPERATION 三策略均为 212/212 loaded、0 unloaded、0 hard violations、0 operation blocked、FULL_UNLOAD_PASS、0 port-access blocked、0 rehandle、post-unload stability pass、LIFO pass、insertion pass，并通过重复哈希确定性验证。

V2.5 Operation 相比 V2.4 Operation 的内部空隙从 8.53004 m³ 降至 3.76636 m³，减少 4.76368 m³，即 55.846%；低填充内部切片从 14 降为 6。当前未解释空隙为 3.76129 m³，局部修复结论为 NO_SAFE_PROMOTION，因此保留而不冒险换取更紧布局。

横向重心偏移 0.096%，纵向 8.266%，分类为 PARTICULAR_CIRCUMSTANCES_REVIEW。它不是硬约束违例，但必须由工程/实际运输条件复核。

## 19. Multi-Port / Stability Audit

正式项目数据 A/B 均为 FULL_UNLOAD_PASS、未来港倒箱 0、卸载后稳定通过。24 个 synthetic multiport cases 全部通过硬门禁、确定性、完整卸载、卸载后稳定和零倒箱，最大单例 wall time 为 27,693 ms。

固定集 48/48、挑战集 64/64、tiny exact-oracle 集 20/20 均通过核心门禁与确定性。tiny 集 20 个 operation-feasible case 全部达到 exact loaded；两例 raw gap 被规则解释，未解释 loaded gap 为 0。

## 20. Packaging Audit

24 个 synthetic packaging cases 的 semantics、solver 和 determinism 均为 24/24。覆盖八类：CARTON、WOOD_CRATE、PALLETIZED_CARTONS、WRAPPED_PALLET、EQUIPMENT_CASE、DRUM、FIBC_BAG、GENERIC。

Landing 和 Cargo 的图片只是上述包装类型的视觉映射。朝向、堆叠、支撑、搬运、尺寸、重量与数量仍来自结构化数据模型。

## 21. Rule / Evidence Truth Audit

11/11 deterministic admission rule cases 通过。浏览器中的正式方案证据链读取现有 shipmentReadiness、ruleReferences 和 inputReferences；来源身份、命中条款、本票应用及责任方分开显示。

VGM 单据、封志、外部官方页面和参考箱型均有显式边界文案。没有把装饰 PNG 当成本票证据，没有宣称外部规则页面等于实时码头/承运人受理，也没有伪造监管通过结论。

## 22. Performance

最终生产构建通过。构建输出约为：CSS 215.21 kB（gzip 40.44 kB）、主应用 JS 929.99 kB（gzip 365.89 kB）、Three chunk 550.48 kB（gzip 139.58 kB）；仅有预期的大 chunk 提示。

Landing Twin 通过可视区观察器暂停非可见帧循环，并在 reduced-motion 下保持稳定代表状态。实际 1920 和 1366 浏览器巡检中滚动、章节切换、Twin 模式、Drawer/Source Reader 与 Workspace 导航无连续卡顿或交互锁死。本轮没有可审计的 FPS 采样文件，因此不虚构 FPS 数字；后续若引入正式性能预算，应增加真实帧率与 Web Vitals 采集。

## 23. Browser QA

- 使用真实 Chromium/Playwright 浏览公开页、CTA、Cargo、规划、Twin、出运验证、Evidence Inspector 与 Source Reader。
- 一次连续 SPA 流程生成并使用真实 212 件 BACKEND_SOLVED 方案：212/212、hybrid-v2.5、STABLE、FULL_UNLOAD_PASS、future-port rehandle 0。
- 最终独立新会话复验 /?capture=1 与 /workspace；1920×1080 下 document scrollWidth 与 clientWidth 均为 1910，无横向溢出。
- 最终控制台：3 条信息级消息（React DevTools 提示），0 errors，0 warnings。
- 20 张截图均为非零 PNG，1920 组 17 张，1366 组 3 张，并完成代表性视觉人工复核。

## 24. Frontend Tests

- npm run lint：通过，0 新 lint warning。
- npm run test：32/32 test files 通过，114/114 tests 通过，最终复跑耗时 14.02 s。
- npm run build：通过，1,665 modules transformed；仅保留既有大 chunk 提示。

## 25. Backend Tests

与当前 V2.5 真值链相关的显式 Jest 验收共 36 个测试通过，另 1 个重型候选测试跳过并由正式 benchmark 覆盖：

- Shipment Readiness、Void Justification、Packaging Profile、Stability、Deterministic Compliance、Local Repair 等 7 个 suite：17 tests 通过。
- HybridConstraintPackingSolverV25 选定门禁：4 tests 通过，1 skipped。
- PlanValidator、RealWorldDecisionV24、HybridConstraintPackingSolverV24 的路线/多港回归：15/15 tests 通过。
- npm run benchmark:competition-2.5：25/25 gates 通过，正式冻结决策产物已生成。

## 26. Known Legacy Failures

完整历史 npm test 仍包含与当前路由/模型不一致的旧测试，已按任务要求记录而未消耗本轮视觉任务去重写：

- 旧 system-integration 测试仍断言过时的 success/HTTP 200/数据库数值类型和旧 AI demo service 接口，并包含外部 AI 或超时依赖。
- 旧 packing integration 存在超时与未关闭异步工作。
- DBLFPackingEngine-v25-CoG 与 SimplePackingEngine-PortSequenceOrdering 引用了已删除的旧 service 模块。
- NingboPortSafetyEngine-v25 仍假定旧 position/dimensions shape，产生 13 个历史断言失败。

这些失败在 Competition 2.7 之前已存在；本轮未修改相关 backend/solver 文件。它们不覆盖当前 hybrid-v2.5 route、正式 benchmark 或前述 36 个相关测试，但应在未来单独清理测试债务。

## 27. Screenshot Index

| # | 文件 | 分辨率 | 用途 |
| --- | --- | --- | --- |
| 01 | 01-landing-hero-1920.png | 1920×1080 | Landing 首屏与五秒定位 |
| 02 | 02-landing-why-1920.png | 1920×1080 | “装得下不等于装得对”问题章 |
| 03 | 03-landing-cargo-1920.png | 1920×1080 | 包装语义舞台 |
| 04 | 04-landing-space-1920.png | 1920×1080 | Cargo → Space 求解链 |
| 05 | 05-landing-twin-1920.png | 1920×1080 | Landing 真实 Twin 章节 |
| 06 | 06-landing-evidence-1920.png | 1920×1080 | 真实证据链与待补状态 |
| 07 | 07-landing-final-cta-1920.png | 1920×1080 | 公开体验收束与工作台入口 |
| 08 | 08-workspace-cargo-1920.png | 1920×1080 | Cargo 工程数据主表 |
| 09 | 09-workspace-cargo-inspector-1920.png | 1920×1080 | Cargo Inspector / Editor |
| 10 | 10-workspace-planning-equipment-1920.png | 1920×1080 | 设备决策矩阵与实际箱边界 |
| 11 | 11-workspace-planning-strategy-1920.png | 1920×1080 | 三策略 decision lanes |
| 12 | 12-workspace-twin-normal-1920.png | 1920×1080 | Twin 标准视图 |
| 13 | 13-workspace-twin-space-1920.png | 1920×1080 | Twin 空间解释 |
| 14 | 14-workspace-twin-unload-1920.png | 1920×1080 | Twin 卸载验证 |
| 15 | 15-workspace-readiness-1920.png | 1920×1080 | 出运准备责任动作 |
| 16 | 16-workspace-evidence-detail-1920.png | 1920×1080 | Evidence Inspector |
| 17 | 17-workspace-source-reader-1920.png | 1920×1080 | 三列来源阅读器 |
| 18 | 18-landing-hero-1366.png | 1366×768 | Landing 兼容分辨率首屏 |
| 19 | 19-landing-cargo-1366.png | 1366×768 | 包装章节兼容性 |
| 20 | 20-workspace-twin-1366.png | 1366×768 | Workspace Twin 兼容性 |

目录：artifacts/competition-2.7/screenshots/

## 28. Top Changed Files + responsibility

| 文件/目录 | 责任 |
| --- | --- |
| web-dashboard/src/pages/landing/LandingPage.jsx | Landing 七段叙事、真实状态读取、CTA 与章节交互 |
| web-dashboard/src/three/LandingExperience.jsx | Landing 轻量真实 Twin、可视区渲染与分析模式 |
| web-dashboard/src/domain/presentation/curatedAssets.js | 资产单一映射、包装类型到视觉资产映射 |
| web-dashboard/src/pages/workflows/CargoPage.jsx | 包装缩略图、Cargo 主表与 Inspector 视觉层级 |
| web-dashboard/src/pages/workflows/ContainerPage.jsx | 设备矩阵、实际箱边界、三策略比较通道 |
| web-dashboard/src/pages/workflows/CompliancePage.jsx | Readiness、Evidence Inspector、三列 Source Reader |
| web-dashboard/src/styles/app.css | Landing/Workspace 响应式视觉、动效、三列阅读器最终覆盖 |
| web-dashboard/public/assets/competition-2.7/ | 11 个策划透明资产及稳定文件名 |
| artifacts/competition-2.7/screenshots/ | 20 张最终浏览器验收图 |

## 29. Remaining Limitations

1. Dataset A 纵向重心 8.266% 处于 PARTICULAR_CIRCUMSTANCES_REVIEW；它通过硬约束和稳定门禁，但不是一般指导范围内的自动放行。
2. Dataset A 仍有 3.76129 m³ 未解释内部空隙；V2.5 的安全局部修复没有可安全晋升的方案。
3. VGM、实际箱 CSC/尺寸和承运人/码头受理属于外部证据，系统只能跟踪责任和完整性，不能自动宣称完成。
4. 超大完整方案不保证跨页面刷新全部持久化到 localStorage；同一 SPA 会话完整工作，刷新后可回到诚实预览并重新求解。
5. 历史 backend 全量测试存在旧模块和旧合同测试债务，详见第 26 节。
6. 生产 bundle 仍有大 chunk 提示；当前演示流稳定，但尚未建立自动 FPS/Web Vitals 门禁。

以上均为已知、可解释且没有被 UI 掩盖的限制；没有发现阻止当前本地竞赛演示或否定 Solver 真值的材料级新问题。

## 30. 3-Minute Competition Demo

1. **0:00–0:25**：Landing Hero，讲清“装箱前先把结果看清”。
2. **0:25–0:50**：快速滚过 Why 与包装舞台，说明包装属性决定求解边界。
3. **0:50–1:15**：Cargo → Space 五步，强调 placement 不是为画面重排。
4. **1:15–1:40**：进入工作台规划页，展示 40HQ 与三策略统一安全门禁。
5. **1:40–2:15**：Twin normal → space → unload，展示真实 212/212、空间解释和零倒箱卸载。
6. **2:15–2:45**：出运验证 → Evidence Inspector → Source Reader，说明事实、规则、责任和外部未知。
7. **2:45–3:00**：总结“求解不是终点，结果必须能复核并走向出运准备”。

## 31. 5-Minute Competition Demo

1. **0:00–0:40**：Landing Hero 与 Why，建立产品定位和真实问题。
2. **0:40–1:20**：六类包装、结构化货物模型和 Cargo Inspector。
3. **1:20–2:00**：设备矩阵、参考箱型与实际箱覆写边界。
4. **2:00–2:40**：三策略 decision lanes，解释 lexicographic truth hierarchy 与推荐逻辑。
5. **2:40–3:35**：Twin normal、space、balance、unload；讲 212/212、0 hard violations、FULL_UNLOAD_PASS、0 rehandle，同时指出 CoG 需特定情形复核。
6. **3:35–4:25**：Readiness 的 7 项责任动作、证据详情和三列 Source Reader。
7. **4:25–4:50**：展示正式 benchmark：A 212/212、B 69/69、25/25 gates、包装八类、24 个 multiport cases。
8. **4:50–5:00**：回到最终 CTA，以“看清结果、保留边界、带着证据执行”收束。

## 32. Final Freeze Recommendation

Landing 视觉、20 张真实截图、Landing/Workspace 区分、真实 Workspace 流程、新应用错误、Solver 门禁、算法回归、证据真实性与监管表述边界均已通过本轮要求。

**PORTCUBE_COMPETITION_2_7_EXPERIENCE_FREEZE**

冻结后只接受：可复现的关键业务错误、视觉阻断错误、真实规则/证据更新、比赛材料所需的有限调整；不继续扩张 Solver 家族或重新设计已通过章节。

# === START OF PORTCUBE 2.7 COMPLETE CONTEXT FOR CHATGPT ===

PROJECT_ROOT: D:\\cixing\\3chuang

PRODUCT_POSITIONING: 集装箱智能装载数字孪生与出运准备决策平台；公开体验解释价值，专业工作台执行一票真实任务。

LANDING_ROUTE: /；连续章节 Landing，无 KPI Dashboard。

WORKSPACE_ROUTE: /workspace；子路由 /workspace/cargo、/workspace/planning、/workspace/twin、/workspace/readiness。

LANDING_CHAPTERS: Hero → Why → Understand Cargo → Cargo to Space → Real Digital Twin → Evidence Chain → Final CTA。

FINAL_ASSET_USAGE: 11 个 Competition 2.7 透明资产集中在 web-dashboard/public/assets/competition-2.7；装载箱/空箱/六类包装用于解释，封志/VGM 明确为装饰或语义示意，设备箱用于 EQUIPMENT_CASE 缩略映射。

MOTION_SYSTEM: Editorial Reveal + Object Staging + Spatial Transformation；IntersectionObserver 驱动；Twin 离屏暂停；prefers-reduced-motion 降级；工作台转场 560 ms/减弱动效为 0。

WORKSPACE_IA: 本票决策、货物、规划、孪生、出运验证五个任务入口；全局上下文来自同一 active plan view model。

CARGO_MODEL: 结构化尺寸、重量、数量、包装、朝向、堆叠、支撑、搬运、目的港与来源；图片不推断业务值。

EQUIPMENT_MODEL: 20GP/40GP/40HQ 参考资料 + 实际箱草稿；实际尺寸、门洞、皮重、最大总重和 CSC 优先。

SOLVER_VERSION: hybrid-v2.5；本轮未修改 Solver 核心或 placements。

DATASET_A_RESULT: 三策略均 212/212，0 hard violations，FULL_UNLOAD_PASS，0 rehandle，post-unload stability pass，deterministic；V2.5 internal void 3.76636 m³，unexplained void 3.76129 m³。

DATASET_B_RESULT: 三策略均 69/69，0 hard violations，FULL_UNLOAD_PASS，0 rehandle，post-unload stability pass，横/纵 CoG 0%，deterministic；未回归到约 14% 纵向偏差。

MULTIPORT_RESULT: synthetic multiport 24/24 硬门禁、完整卸载、卸载后稳定、零倒箱和确定性全部通过。

STABILITY_RESULT: Dataset A/B 和 fixed 48、challenge 64、tiny 20、multiport 24 的相关稳定门禁通过。

COG_RESULT: Dataset A lateral 0.096%、longitudinal 8.266%，PARTICULAR_CIRCUMSTANCES_REVIEW；Dataset B 0%/0%，WITHIN_GENERAL_GUIDANCE。

VOID_RESULT: Dataset A V2.4→V2.5 internal void 减少 55.846%；仍有 3.76129 m³ unexplained void，NO_SAFE_PROMOTION。

PACKAGING_RESULT: 24/24 semantics、solver、determinism 通过，覆盖 CARTON/WOOD_CRATE/PALLETIZED_CARTONS/WRAPPED_PALLET/EQUIPMENT_CASE/DRUM/FIBC_BAG/GENERIC。

READINESS_MODEL: 以业务域、证据完整性、责任方和动作组织；正式 212 件演示状态有 7 项真实待处理，不伪造出运放行。

RULE_MODEL: 规则包含来源、发布方、效力层级、条款、快照、解析状态和本票适用；11/11 admission cases 通过。

EVIDENCE_MODEL: 事实 → 条件 → 判断 → 依据 → 完整性 → 责任人；可从证据进入 Twin 的空间应用。

THREEJS_STATE: Landing 与 Workspace 共用真实 TwinScene/OperationMachine 和 plan placements；支持 normal/space/balance/unload；可视区渲染和 reduced-motion 已处理。

FRONTEND_TESTS: lint PASS；Vitest 32 files / 114 tests PASS；production build PASS（1,665 modules）。

BACKEND_TESTS: 当前相关显式 Jest 36 PASS + 1 skipped（由正式 benchmark 覆盖）；competition-2.5 benchmark 25/25 gates PASS；历史全量 suite 的旧合同/旧模块失败另列。

BROWSER_TESTS: 实际 Chromium 完整 Workspace 流程通过；最终新会话公开页和 /workspace 0 errors、0 warnings、无横向溢出；20 张指定截图完成。

PERFORMANCE: production build PASS；CSS 215.21 kB、app JS 929.99 kB、Three 550.48 kB（均为未 gzip 大小）；离屏 Twin 暂停；未生成可审计 FPS 文件，不虚构 FPS。

SCREENSHOT_PATHS: D:\\cixing\\3chuang\\artifacts\\competition-2.7\\screenshots\\01-landing-hero-1920.png … 20-workspace-twin-1366.png；共 20 张。

KNOWN_LIMITATIONS: Dataset A CoG 特定情形复核；3.76129 m³ 未解释空隙；VGM/实际箱/承运人受理需外部证据；超大方案刷新持久化有限；历史 backend 测试债务；未建立自动 FPS 门禁。

FINAL_VERDICT: READY；冻结标记见第 32 节。

# === END OF PORTCUBE 2.7 COMPLETE CONTEXT FOR CHATGPT ===
