**PORTCUBE Competition 2.4 · Real-World Product Final Report**  
**裁定快照：2026-08-24 · 项目根目录：`D:\cixing\3chuang` · 数据分级：`DEMO_DATA`**

# 1 Executive Verdict

最终发布结论为 **`READY_WITH_LIMITATIONS`**。

本轮已经完成真正可运行的 2.4 产品升级：正式求解器标识为 `hybrid-v2.4`，主比赛数据集 A 保持 212/212，数据集 B 修复为真实的 69/69，并把纵向重心偏移从 V2.3 的 14.061% 降到 0.000%；48 个固定合成案例、64 个挑战案例、20 个 tiny exact-oracle 案例、24 个多港案例和 11 个准入规则案例全部通过本轮门禁。前端 105/105 测试通过，生产构建通过，真实后端浏览器流程完成四轮检查并输出 16 张最终截图。

但本报告不发布 `PORTCUBE_COMPETITION_2_4_FINAL_FREEZE` 作为仓库级最终状态。原因不是 2.4 门禁失败，而是全量后端遗留测试仍为 41/67 套件、628/693 测试通过：26 个套件和 65 个测试失败，包含已删除旧模块引用、旧坐标契约、旧引擎属性断言、测试数据库及开放句柄等历史问题。基准 JSON 内的 `decision=PORTCUBE_COMPETITION_2_4_FINAL_FREEZE` 只代表该脚本定义的 2.4 专项门禁全绿，不等于整个仓库满足发布冻结条件。

业务边界同样明确：产品提供工程与单证预审，不保证承运人、航次、船舶、海关、港口或码头接受；缺失 VGM、CSC、系固或外部接受证据时，只能返回 `DATA_REQUIRED` 或 `EXTERNAL_CONFIRMATION_REQUIRED`，不得伪造通过。

# 2 Final Product Positioning

PORTCUBE 2.4 的最终定位是：**面向集装箱装载决策的可解释工程工作台**。它不再只是“把箱子画进集装箱”的 3D 演示，而是把一票货从 Case 上下文、设备初选、确定性装箱、物理验证、多港卸货重放、载荷与系固预审，一直串到规则来源和外部准入缺口。

产品的核心承诺分为三层：

| 层次 | 能可靠给出的结论 | 明确不声称的结论 |
|---|---|---|
| 计算事实 | 几何、碰撞、装载数量、重量、重心、支撑、装卸路径、港序重放 | 全局最优证明、连续体动力学结论 |
| 工程预审 | CTU 指导区间、集中载荷触发、系固输入完整性、CSC/VGM 文档缺口 | 认证 VGM、认证 CSC 检验、认证系固计算 |
| 运营准备 | Case、航线、码头、证据矩阵和待办 | 承运人/航次/码头/海关最终接受 |

因此演示的主线不再是“算法分数”，而是“这票货为什么推荐这个方案、现在能否继续、还缺什么证据、风险落在箱内哪里”。

# 3 Current Architecture

当前架构由五条可追溯链路组成：

1. **Case 状态层**：Web `SESSION_SCHEMA_VERSION=6` 保存订单、数据集、货物、参考/实际箱模式、`CaseContext`、VGM/质量证据、运输与系固输入、后端方案和准入快照。
2. **求解层**：`AlgorithmOrchestrator` 按策略调用正式的 `HybridConstraintPackingSolverV24`；V2.4 组合 V2.3 与 V2.1 的候选族并进行安全优先的确定性择优。
3. **验证层**：`PlanValidator`、稳定性、布局质量、几何系固、现实载荷分布、完整港序卸货重放共同形成统一证据。
4. **现实准入层**：设备、VGM、CSC、集中载荷、运输系固、危险品、木包装、码头/航次外部确认由 `AdmissionPrecheckEngine` 聚合。
5. **呈现层**：Overview、Cargo、Planning、Twin、Admission 共用同一 Case；Twin 直接显示重心、分段载荷、港序、阻挡与系固证据，规则可以跳转到对应空间视图。

后端的 `/api/packing/generate` 在数据库不可用时仍可使用官方来源标注的参考箱型执行演示求解，但“实际箱准入”始终要求用户提供具体箱号、尺寸、CSC 和最大总重证据。持久化层增加 `context_snapshot` 与 `admission_snapshot`，使计划、Case 和准入结论不再脱节。

# 4 Solver V2.4 Architecture

V2.4 不是用新名称包裹旧结果，而是在 V2.3 物理核心上增加了一个有界、确定性的候选组合与安全优先排序器。单次求解最多评估八个候选，当前核心候选为：

| 候选 | 来源核心 | 处理 |
|---|---|---|
| `V23_BASE` | `hybrid-v2.3` | 保留 V2.3 物理布局 |
| `V23_GLOBAL_BALANCE` | `hybrid-v2.3` | 在合法平移区间内执行全局重心居中 |
| `V21_BASE_ASSISTED` | `hybrid-v2.1` | 保留 V2.1 布局，并对符合边界的 derived manual 转为可追溯 `team_manual` |
| `V21_GLOBAL_BALANCE_ASSISTED` | `hybrid-v2.1` | 协同人工假设与合法全局重心平移 |

择优是词典序而非混合成一个难以解释的总分，顺序为：硬约束违规、标准操作阻挡、全港访问阻挡、未来港翻箱、卸后失稳、初始稳定性、LIFO/插入、装载件数、装载体积、CTU 重心指导区间、几何系固状态、策略目标，最后才用 placement hash 与候选 ID 破平局。运行时间不参与候选排序。

输出同时记录 `officialSolver=hybrid-v2.4`、`solverVersion=2.4`、实际被选物理核心、候选摘要、选择顺序、密度区间、完整卸货状态、卸后稳定性和人工处理假设。这样既保留 V2.3 在数据集 A 上的能力，也允许 V2.1 候选修复 V2.3 在稀疏数据上的系统性偏置。

# 5 Dataset B CoG Root Cause

数据集 B 在 V2.3 中并不是“装不下”：三个策略都能装入 69 件，硬约束为 0，LIFO 通过。真正问题是三个策略最终收敛到同一个稀疏布局，横向偏移约 1.22%，纵向偏移 14.06%，均被标为 `OUTSIDE_GUIDANCE`。

根因有两部分。第一，数据集 B 的货物总体相对箱体较稀疏，V2.3 的层/截面候选更关注门侧起装、局部紧凑与操作顺序，剩余空间集中在一端，质量包络没有围绕箱体纵向中心展开。第二，SPACE/BALANCE/OPERATION 虽有不同目标，但候选族不足，局部压实后的三条路径落入同一放置哈希，策略标签变化却没有提供真正不同的物理选择。

所以 2.4 没有把 14.06% 隐藏成“安全分数”，也没有扩大阈值，而是承认这是稀疏布局的候选覆盖问题，并将“载荷分布指导区间”提升到紧凑度之前。

# 6 CoG Repair

修复采用 **合法刚体平移 + 候选组合**，不改变货物之间的相对位置、不穿越箱壁、不改变堆叠关系，也不绕过操作验证。`centerPlan` 先计算整批货物边界与质量重心，再求 X/Z 方向允许的平移区间，将重心向箱体中心移动并把实际 shift 记录在 `constraintMeta.translation`。

修复后数据集 B 的 SPACE 方案选中 `V21_GLOBAL_BALANCE_ASSISTED`：69/69、硬违规 0、操作阻挡 0、完整卸货通过、翻箱 0、卸后稳定通过，横向与纵向重心偏移均为 0.000%，状态为 `WITHIN_GENERAL_GUIDANCE`。placement hash 为 `22333144d52bb271`，重复运行一致。

修复没有伪装其他候选：BALANCE 与 OPERATION 仍选择 V2.3 物理核心，偏移 1.215% / 14.061%，仍如实标记 `OUTSIDE_GUIDANCE`。推荐器因此将重心指导门禁放在布局紧凑性之前，推荐 SPACE，而不是选择内部空隙较少却明显偏载的候选。

# 7 Dense / Sparse Strategy

V2.4 按货物总体积与箱体内部体积的比值标记 `DENSE`、`MEDIUM` 或 `SPARSE`，用于解释候选行为，而不是作为放松硬约束的开关。比值大于等于 0.65 为 DENSE，0.35–0.65 为 MEDIUM，低于 0.35 为 SPARSE。

密集问题优先保留 V2.3 的截面/层构造、稳定性与紧凑性优势；稀疏问题则必须给全局居中和辅助处理候选机会，避免门侧贪心造成重心偏移。所有密度区间仍执行完全相同的边界、碰撞、承载、支撑、操作、港序和卸后稳定门禁。

`FloorExtremePointCandidate` 作为有界补充候选，覆盖层式搜索容易遗漏的地板极点组合。tiny oracle 测试证明它能恢复一个层候选错过、但符合项目操作约束的四件布局；它不是无界穷举，也不改变正式求解器的确定性预算。

# 8 Equipment Planning Model

Planning 页面现在先做设备决策，而不是直接展示三张策略卡。参考矩阵覆盖 20GP、40GP、40HQ，并分别检查：内部几何、门洞、参考载重、总体积筛查、干箱服务适配、危险品条件和温控需求。

| 箱型 | ISO 参考码 | 内尺寸 mm | 门洞 mm | 皮重 kg | 最大总重 kg | 参考载荷 kg |
|---|---|---:|---:|---:|---:|---:|
| 20GP | 22G1 | 5898×2352×2393 | 2340×2280 | 2180 | 30480 | 28300 |
| 40GP | 42G1 | 12032×2352×2393 | 2340×2280 | 3630 | 32500 | 28870 |
| 40HQ | 45G1 | 12032×2352×2698 | 2340×2585 | 3810 | 32500 | 28690 |

推荐规则在满足筛查条件的箱型中先选容量较小者，返回 `recommendedType`；用户当前选择则独立保存在 `selectedType`，不能把“选择了 40HQ”误写成“系统证明 40HQ 最优”。危险品只得到条件性服务状态，温控货物会明确指出干箱不合格。

# 9 Reference vs Actual Container

系统严格分开 `REFERENCE_PROFILE` 与 `ACTUAL_CONTAINER`。

参考模式用于规划：尺寸和质量来自带来源的承运人设备资料，只能回答“按参考轮廓是否具备技术筛查资格”。它不能建立某一放箱单位的箱号、CSC 铭牌、检验有效期、真实皮重或码头接受状态。

实际箱模式用于准入预审：要求箱号、内长宽高、门宽门高、皮重、最大总重，并验证 ISO 6346 风格的格式和校验位。实际值覆盖参考值；字段不全时状态为 `DATA_REQUIRED`，几何或载荷不满足时为 `INELIGIBLE`，满足时也只是 `TECHNICALLY_ELIGIBLE`，运营接受仍为 `EXTERNAL_CONFIRMATION_REQUIRED`。

前端实际箱编辑采用本地 draft；只有点击 Apply 才改变 Case 和使现有后端方案过期，避免用户仅打开表单或修改未提交字段就丢失 `BACKEND_SOLVED` 证据。

# 10 Container Fields and Source

实际箱字段及证据语义如下：

| 字段 | 用途 | 推荐来源 | 缺失行为 |
|---|---|---|---|
| `containerNumber` | 单位身份和校验位 | 放箱单/箱体标识 | `DATA_REQUIRED` |
| `innerLength/Width/Height` | 实际几何边界 | 箱主/承运人单位资料或实测记录 | 不允许以参考值伪装实际值 |
| `doorWidth/Height` | 进出门洞 | 单位资料或实测记录 | 门洞资格未知 |
| `tare` | 质量台账/VGM Method 2 | CSC plate/箱体标识 | 总重估算不完整 |
| `maxGross` | 最大运营总重门禁 | CSC safety approval plate | 不得给出最大总重通过 |
| `cscPlateReference` | 铭牌证据索引 | 照片/文档系统 | CSC 预审缺证据 |
| `acepSchemeReference` 或 `nextExaminationDate` | 定期检验状态 | 箱主/CSC 记录 | CSC 预审缺证据 |

参考资料记录 authority、URL、分类和验证日期。UI 中始终显示 Reference/Actual 标签和来源，不允许用隐藏的默认值把来源差异抹平。

# 11 CSC Model

`CSCPrecheck` 以 IMO CSC 为法律来源索引。参考箱模式直接返回 `NOT_APPLICABLE_TO_REFERENCE_PROFILE` / `DATA_REQUIRED`，因为型号资料不能证明被放出的实际集装箱具有有效安全批准牌和检验状态。

实际箱模式检查：箱号格式与校验位、CSC plate 证据、铭牌最大运营总重，以及 ACEP scheme reference 或下一检验日期。若下一检验日期早于 Case 日期且没有 ACEP，返回 `BLOCKED_EXAMINATION_EXPIRED`；信息完整时返回 `DOCUMENTARY_PRECHECK_COMPLETE`，外层决策仍为 `EXTERNAL_CONFIRMATION_REQUIRED`。

模型只做结构化文档预检，不验证图片真伪、不替代现场箱况检查，也不声称获得箱主、承运人或码头确认。

# 12 VGM Model

VGM 模型把“计算总重估算”“托运人申报”和“已记录核验证据”分成三件事。支持 SOLAS Method 1 / Method 2 标识，要求 `declaredVGMKg`、方法和托运人声明；`verifiedEvidence` 或称重证书引用只表示系统记录到证据，并不由 PORTCUBE 自行认证。

中国执法差异只在同时提供申报 VGM 与经认证的实测总重时计算，允许差异为 `min(实测总重×5%, 1000kg)`。如果只有内部计算值，状态保持 `NOT_ASSESSED`，不会把计算值冒充测量证据。

申报 VGM 超过记录的最大运营总重时直接阻断；缺少方法、声明或补充质量时返回 `DATA_REQUIRED`/`CONDITIONAL`。UI 通过 Admission Matrix 和 Inspector 展示缺项及规则来源。

# 13 Gross Mass Model

质量台账为：货物质量 + 包装质量 + 托盘质量 + 垫料质量 + 系固材料质量 + 箱体皮重。货物质量优先取已装 placements；尚未求解时由 SKU 单件重量乘数量计算。

补充质量的任何一项未知，`calculatedStatus` 即为 `PARTIAL_ESTIMATE`；全部已知且有皮重时才是 `COMPLETE_ESTIMATE`。即便完整，字段名称仍为 `calculatedGrossMassKg`，并带固定声明：“工程估算本身不是 SOLAS verified gross mass”。

这一设计阻止了常见的现实错误：把装箱算法求出的 cargo weight 加参考皮重后直接显示绿色 VGM PASS。

# 14 Load Distribution Model

载荷分布模型从真实 placements 和箱体几何计算三维重心、横/纵偏移百分比、六段纵向质量和三段横向质量。判定区间来自 CTU Code 工程指导：最大偏移不超过 5% 为 `WITHIN_GENERAL_GUIDANCE`；超过 5% 且不超过 10% 为 `PARTICULAR_CIRCUMSTANCES_REVIEW`；超过 10% 为 `OUTSIDE_GUIDANCE`。

这是工程指导状态，不是法律合格证。它进入 V2.4 候选词典序，是为了不让“更紧凑但明显偏载”的方案压过平衡方案。Twin 的 Load Distribution 模式把分段质量、重心十字线和指导带叠加到同一空间视图，既能看到数值，也能看到偏载发生在哪里。

# 15 Concentrated Load

每件货物按 `mass / loaded footprint` 计算平均足迹压力。当前项目触发条件为：单件质量达到记录 payload 的 25%，或货物被显式标记 `concentratedLoad=true`。这个 25% 是项目筛查策略，不是冒充某个箱主的通用额定值。

若触发而没有箱主/承运人给出的具体地板压力包络，状态为 `ENGINEERING_REVIEW_REQUIRED`；有带来源的 `maximumFloorPressureKgM2` 后才与每个足迹比较。超出记录包络为 `OUTSIDE_OPERATOR_ENVELOPE`，否则为 `WITHIN_RECORDED_OPERATOR_ENVELOPE`。

系统没有把参考箱型的最大载荷除以地板面积当作可用的点载荷极限，因为那不能替代实际结构与运营人限制。

# 16 Transport Stability

初始稳定性由支撑面积、支撑边界/裕度、堆叠承载、细长比、侧向约束和风险注释共同评估。验证结果按货物回写到 placement，使 Twin 能定位不稳定货物，而不是只给全局红灯。

V2.4 在候选选择时先比较初始稳定性违规，再比较策略目标；多港重放还会在每次卸完一个港后对剩余货重新运行同一稳定性分析。测试门禁要求初始硬约束为 0，并要求所有港后的 `invalidCount=0`。

这仍是刚体、离散支撑模型；没有模拟海况时域响应、材料变形、包装压溃或车辆悬挂，因此不能称为完整物理动力仿真。

# 17 Securing Model

系统区分两类系固信息。求解后的 `SecuringAnalyzer` 根据几何空隙与邻接关系指出是否存在需要进一步约束的空间；现实准入的 `TransportSecuringAnalyzer` 则采用 CTU road/rail/sea acceleration profile，计算前、后、左、右方向的需求与摩擦、blocking、lashing 抵抗。

输入包括运输方式/海区、摩擦系数、各方向 blocking capacity，以及每条 lashing 的 LC、角度与作用方向。任何关键输入缺失时返回 `SECURING_UNRESOLVED` / `DATA_REQUIRED`；计算不足时为 `SECURING_INADEQUATE` / `BLOCKED`；计算通过也只返回 `CALCULATION_PASS_REQUIRES_EXTERNAL_CONFIRMATION`。

Twin 的 Securing 模式显示空隙、约束方向与缺失数据，不生成虚假的拉带数量或认证结论。

# 18 Port Sequence

Case 默认路线为 HAM → RTM → ANR，货物通过 `portSequence` 绑定卸货港。坐标契约中 X 为箱长方向、Y 为竖直、Z 为箱宽；门位于较高 X 一侧。相同港的货物可以在该港内部重排卸货顺序，但不能静默移动未来港货物。

求解器在布局后按标准操作可行序列重新编号 `loadingIndex`，并同时验证 LIFO 与门洞插入。路线和 Case 日期都进入后端请求与持久化快照，避免前端显示一条路线、后端按另一条隐式路线计算。

# 19 Port Accessibility

`PortAccessibilityValidator` 对每一个港次逐件尝试卸货。每次尝试都检查门洞/通道操作约束以及目标货物是否仍支撑其他货物；失败时记录 reason、blocker ID 与其中属于未来港的 blocker ID。

状态只可能由证据得出：存在阻挡为 `PORT_ACCESS_BLOCKED`；卸后失稳为 `POST_UNLOAD_STABILITY_INVALID`；存在未来港翻箱为 `REHANDLE_REQUIRED`；所有港完整卸完且稳定才是 `FULL_UNLOAD_PASS`。

结果包含逐港 before/scheduled/removed/blocked/after、实际卸货序列、翻箱货物集合，以及卸后重心和稳定性。Twin 的 Port / Unload 模式可按港查看这条证据链。

# 20 Full Unload Simulation

完整卸货不是只检查第一票货，也不是用 SKU 顺序近似。每个港通过迭代选择当前可操作的目标货物；只要本港还有可卸货物就继续，直到清空本港或没有进展。若没有进展，保留最新阻挡证据并停止后续乐观模拟。

2.4 基准要求 `FULL_UNLOAD_PASS`、blocked=0、rehandle=0。数据集 A、数据集 B、48 固定、64 挑战、20 tiny 和 24 多港案例都满足该条件。多港专门语料的 24/24 全部通过，说明此门禁不是只在单港示例上成立。

# 21 Post-unload Stability

每个港完全卸完后，系统对剩余货物重新计算稳定性和载荷分布。空箱明确返回 `EMPTY_CTU`；非空则保留新的状态、违规、警告与重心区间。候选排序将所有港后 invalidCount 的总和置于初始紧凑性之前。

基准结果中 48/48 固定、64/64 挑战、20/20 tiny、24/24 多港案例均 `postUnloadStabilityPass=true`。这避免了“满箱时稳定、卸完第一港后上层悬空”却仍显示绿灯的产品缺陷。

# 22 Rule Registry

`RuleRegistry` 是带日期和来源的证据索引，不是静态法规文案页面。每条 Rule 包含 ID、标题、authority、jurisdiction、scope、level、effectiveFrom/effectiveTo、status、sourceDocument、sourceUrl、clause、evaluator、requiredInputs、verifiedAt 与可视化语义。

截至 2026-08-24 的快照包含 17 条规则/资料记录：SOLAS VGM、CSC、IMDG 42-24、四条 CTU 主题、CTU 修订草案、ISPM 15、中国 VGM/船载危险品/港口危险品/木包装/未来海关令、BIC 类型码、承运人设备参考和 NBSCT 公共流程快照。

`GET /api/packing/rules?caseDate=...` 返回按 Case 日期解析的状态；Inspector 展示适用域、层级、条款、所需输入和执行器，Source Reader 保留官方原始链接。

# 23 Rule Hierarchy

规则层级不是一列同色标签：

1. `LEGAL_REQUIREMENT`：国际公约/强制规则或适用的中国法规；缺证据可能导致 `DATA_REQUIRED` 或 `BLOCKED`。
2. `PORT_TERMINAL_CONSTRAINT`：公开流程或实际运营条件；没有实时接受证据时不得推断接受。
3. `ENGINEERING_GUIDANCE`：CTU Code 的重心、集中载荷、加速度与系固指导；输出指导区间或工程复核，不冒充法律认证。
4. `PROJECT_POLICY`：如同港可重排、禁止未来港翻箱、derived team-manual 边界；必须显式标注且可追溯。
5. `REFERENCE_DATA`：BIC 类型码和设备尺寸资料；只能支撑规划，不支撑具体单位验收。

当不同层级同时作用时，法律和硬安全阻断优先；工程/项目策略不能把缺失的外部证明补成 PASS。

# 24 Effective Date Model

规则按 `caseDate` 解析，而不是按代码部署时间。若显式状态是 `DRAFT`、`UNKNOWN` 或 `SUPERSEDED`，保持该状态；否则 Case 日期早于 `effectiveFrom` 为 `FUTURE`，晚于 `effectiveTo` 为 `SUPERSEDED`，其余为 `ACTIVE`。

关键回归是中国海关总署第 283 号令：来源页面已公布，但生效日为 2026-11-01；本报告快照日 2026-08-24，因此它必须是 `FUTURE`，不能覆盖当前有效至 2026-10-31 的木包装措施。UNECE 的 CTU 修订工作同样保持 `DRAFT`，不参与 active evaluator。

Admission 规则测试包含 `FUTURE_RULE_NOT_ACTIVE` 和 `DRAFT_RULE_NOT_ACTIVE`，两者均通过。

# 25 Active Official Sources

以下为本轮实际核对并写入 Registry 的主要来源；访问与裁定快照为 2026-08-24：

| 主题 | 官方/一手来源 | 当前用途 |
|---|---|---|
| SOLAS VGM | [IMO VGM](https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx)、[MSC.1/Circ.1475](https://wwwcdn.imo.org/localresources/en/OurWork/Safety/Documents/MSC.1%20Circ.1475.pdf) | VGM 方法、申报与装船前证据 |
| CSC | [IMO CSC](https://www.imo.org/en/about/conventions/pages/international-convention-for-safe-containers-%28csc%29.aspx) | 安全批准牌与检验制度 |
| IMDG | [IMO IMDG Code](https://www.imo.org/en/publications/pages/imdg%20code.aspx) | Amendment 42-24 在 2026-01-01 强制应用 |
| CTU | [Packing/CoG](https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102046/3%2BPrinciples%2Bof%2Bpacking)、[集中载荷](https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102061/Appendix%2B4.%2BSpecific%2Bpacking%2Band%2Bsecuring%2Bcalculations)、[运输加速度](https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23101848/Chapter%2B5.%2BGeneral%2Btransport%2Bconditions)、[系固](https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102048/4%2BSecuring%2Bof%2Bcargo%2Bin%2BCTUs) | 工程指导 |
| CTU 修订 | [UNECE Group of Experts](https://unece.org/info/events/event/406814) | 仅作为 DRAFT 观察项 |
| 木包装 | [IPPC ISPMs](https://www.ippc.int/en/core-activities/standards-setting/ispms/)、[中国现行措施](https://www.beijing.gov.cn/gate/big5/www.beijing.gov.cn/zhengce/zhengcefagui/qtwj/202307/t20230720_3177163.html)、[未来第 283 号令](https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202607/t20260728_537894.html) | 处理标识、豁免与日期解析 |
| 中国 VGM/DG | [船舶安全 VGM](https://xxgk.mot.gov.cn/2020/jigou/fgs/202209/t20220928_3687057.html)、[船载危险品](https://xxgk.mot.gov.cn/2020/jigou/fgs/202501/t20250120_4162806.html)、[港口危险品](https://xxgk.mot.gov.cn/2020/jigou/fgs/202308/t20230818_3892676.html) | 中国场景文档预审 |
| 设备 | [BIC size/type code](https://www.bic-code.org/size-type-code/)、[Maersk dry equipment reference](https://www.maersk.com/~/media_sc9/maersk/local-information/files/europe/greece/import/equipment-flyer.pdf) | ISO 类型码与参考尺寸 |
| 宁波码头 | [宁波舟山港](https://www.nbport.com.cn/)、[NBSCT 业务流程](https://www.nbport.com.cn/nbsct/mtfwzy/ywlc/)、[NBSCT FAQ](https://www.nbport.com.cn/nbsct/mtfwzy/cjwt/) | 公共流程快照，非实时接受 |

# 26 Legal vs Guidance vs Project Policy

界面与 API 均展示 claim 类型。`LEGAL_REQUIREMENT` 表示该条目来自法律/强制框架，但 PORTCUBE 只做预审；`ENGINEERING_GUIDANCE` 表示技术指导区间；`PROJECT_POLICY` 表示为可重复计算定义的项目假设；`REFERENCE_DATA` 表示规划基准。

例如：SOLAS 要求 VGM 属于法律层，但 PORTCUBE 不能认证称重；CTU 的 ±5%/±10% 属于工程指导，不写成“违法/合法”；同港重排允许、未来港翻箱禁止属于项目策略；40HQ 的 12032×2352×2698 是参考设备数据，不是放出单位的实测值。

这种分层使 Rule Inspector 能解释“为什么是 DATA_REQUIRED”，也使评委看到系统没有用一个泛化的 Compliance PASS 掩盖不同强度的结论。

# 27 Port / Terminal Resolution

CaseContext 固定记录 origin、destination、terminal、carrier、voyage、booking reference、terminal acceptance reference 和 route。演示 Case 为 `NB2026-0824-001`，起运地 Ningbo, CN，码头 NBSCT；carrier 与 voyage 故意保持 `UNKNOWN`。

NBSCT 公共页面只被登记为 `NBSCT-OPERATION-SNAPSHOT`、状态 `UNKNOWN`、层级 `PORT_TERMINAL_CONSTRAINT`。它可以解释常规/冷藏/危险品进港流程和复磅服务入口，但不能证明某一订舱、航次或箱号已获接受。

因此即使设备、几何和文件预审完整，`terminalAndVoyage` 仍返回 `EXTERNAL_CONFIRMATION_REQUIRED`。系统当前没有 live terminal API，也没有承运人订舱接口。

# 28 Dangerous Goods

危险品域先从 cargo facts 中识别 `dangerous=true`。没有危险品时为 `NOT_APPLICABLE`；存在危险品而缺 classification 或 packing certificate 时为 `DATA_REQUIRED`；信息齐全时也只进入 `EXTERNAL_CONFIRMATION_REQUIRED`，等待承运人、主管机关和码头流程。

规则来源包含 IMO IMDG 42-24、中国船载危险品规则和港口危险品安全管理规则。当前实现没有商业版完整 IMDG 数据库，不自动推导 UN number、class、packing group、segregation table、limited quantity 或船舶积载类别；这些必须由可靠数据源或人工输入。

# 29 Wood Packaging / ISPM15

木包装域识别 raw/solid wood、木箱或显式 `wooden=true`。受管制木质包装缺 treatment mark 时返回 `DATA_REQUIRED`；记录标识后仅完成文档预审。胶合板、纤维板、薄木等加工材料可给出 `EXEMPTION_INDICATED_REVIEW`，仍保留人工复核语义。

国际层引用 ISPM 15；中国场景按 Case 日期在现行措施与未来第 283 号令之间解析。2.4 不提前激活未来文本，也不从货物名称猜测处理标识。

# 30 Admission Engine

`AdmissionPrecheckEngine` 聚合九个域：equipment、massAndVGM、CSC、loadDistribution、transportSecuring、portAccessibility、dangerousGoods、woodPackaging、terminalAndVoyage。每个域保留原始 evidence 和标准化状态。

总体聚合严格按严重性：任一 `BLOCKED` → `BLOCKED/DO_NOT_RELEASE`；否则有 `DATA_REQUIRED` → `DATA_REQUIRED/COLLECT_EVIDENCE`；否则有条件/外部确认 → `CONDITIONAL/EXTERNAL_CONFIRMATION_REQUIRED`；只有所有内部域就绪才可能 `PRECHECK_COMPLETE`，仍不替代外部接受。

API 为 `POST /api/packing/admission/precheck`；求解结果也携带 `ext_admission`，Case 持久化保存 admission snapshot。规则、证据、空间验证共享同一 Case 日期和路线。

# 31 Admission Status

UI 的 Admission Matrix 不再只有一个“合规/不合规”红框，而是显示每个域的状态、决定、缺失输入、规则与证据。状态语义如下：

| 状态 | 用户动作 |
|---|---|
| `BLOCKED` | 不放行；修正超重、过期 CSC、系固不足或其他硬问题 |
| `DATA_REQUIRED` | 收集缺失字段/证书/照片/参数后重跑 |
| `CONDITIONAL` | 内部预审有条件完成，仍需工程或外部确认 |
| `PRECHECK_COMPLETE` | 仅表示本系统定义的内部检查完整 |
| `EXTERNAL_CONFIRMATION_REQUIRED` | 联系承运人、航次、码头、海关或主管方确认 |

11 个确定性规则案例全部符合期望，包括 missing VGM、reference CSC、over max gross、DG 缺证、木包装标识缺失、系固缺输入、terminal external、future/draft rule inactive、actual CSC expired 与 actual complete still external。

# 32 UI Design References

本轮分别研究了 Linear、Figma UI3 与 Autodesk Fusion 的公开产品资料，吸收的是交互原则，不是品牌复制或产品接入。

| 参考 | 实际吸收 | 没有声称 |
|---|---|---|
| [Linear views/display options](https://linear.app/docs/custom-views) 与 [2026 UI refresh](https://linear.app/changelog/2026-03-12-ui-refresh) | 稳定侧栏、低噪声状态、可扫描表格、把筛选/详情放在同一工作上下文 | 没有连接 Linear，也没有照搬其组件或商标 |
| [Figma UI3 redesign](https://www.figma.com/blog/behind-our-redesign-ui3/) | “工作居中”的大画布、可收起/上下文面板、带背景和边界的明确控件、复杂能力的渐进披露 | 没有连接 Figma；“UI3”仅指研究的 Figma 第三代界面 |
| [Autodesk Fusion interface](https://help.autodesk.com/view/fusion360/ENU/?contextId=LP-STEPS-P13N-SNP-GS-OTH-CRD-1) 与 [Manufacture workflow](https://help.autodesk.com/view/fusion360/ENU/?guid=GUID-BEC5DEA9-AC3E-4FA8-998E-4AE8CD0D0B1E) | Browser/Canvas/Inspector 的专业工具结构、工作区切换、Setup→Operation→Simulate 的任务链 | 没有使用 Fusion 引擎、文件格式或 API |

最终视觉语言仍属于 PORTCUBE：深色工业 SaaS、青蓝状态、琥珀复核、红色阻断、空间证据与规则证据互相跳转。

# 33 Global UI

全局信息架构为 Overview、Cargo、Planning、Twin、Admission。顶部 Case strip 始终显示 Case ID、日期、起讫地、码头、数据集和后端状态；`BACKEND_SOLVED` 是必须来自真实 `/generate` 响应的状态，不用前端 mock 填充。

桌面大屏采用固定导航 + 工作区，1280/1366 下减少非必要文案、允许工具栏换行并保持 Twin 画布和关键 Inspector 可见。统一 status chip、数字等宽样式、来源标签、空态和缺证据 copy，避免同一状态在不同页面出现不同颜色或词义。

四轮视觉迭代重点不是增加装饰，而是提升决策层级、减少卡片堆砌、解决 1366 Twin 工具条遮挡，并让 Rule/Source/Space 成为连续链路。

# 34 Overview Before / After

升级前首页更像功能入口集合，算法结果与现实准入缺口并列但没有优先级。升级后首屏回答三个问题：推荐哪个方案、是否可以继续、阻止实际放行的证据是什么。

Decision header 显示 Case、数据来源和 `BACKEND_SOLVED`；核心 KPI 只保留装载件数、硬违规、完整卸货、重心指导状态和准入状态；下方以“Next actions”突出 VGM、CSC、系固、carrier/voyage 等缺项。这样三分钟演示可以从一屏建立产品定位，而不用先解释十几个算法指标。

# 35 Cargo

Cargo 页面保留 SKU 表、数量、尺寸、重量、堆叠/旋转/处理方式和港序，并让 Dataset A/B 场景切换更新 `datasetId`、order source、cargo source 和总件数。数据集 B 已从错误的 47 件前端样例修复为 7 个 SKU、69 件，与后端 benchmark fixture 一致。

批次筛选会先过滤空 batch ID，修复 React 重复/undefined key 警告。场景变更使现有方案显式过期，只有真实后端重新求解后才恢复 `BACKEND_SOLVED`。

# 36 Planning Before / After (why no longer 3 cards)

升级前 Planning 一打开就是 SPACE/BALANCE/OPERATION 三张卡，隐含“箱型已确定、三种策略同等可用”。现实流程恰好相反：先判断参考设备是否容纳，再确认实际单位，最后才在满足硬门禁的候选中选策略。

升级后页面顺序为 Equipment Decision Matrix → Actual Container Inspector → Strategy Portfolio。矩阵把 20GP/40GP/40HQ 的门洞、内尺寸、载重、体积和服务适配并列；实际箱表单与参考值明确分离；策略区展示候选来源核心、装载、重心、港序、稳定性、系固和 determinism。推荐器不再只看“空间利用率最高”。

# 37 Twin

Twin 保留可交互 3D 箱体、货物、相机预设和播放控制，并增加 Load Distribution、Port / Unload、Securing 三种工程模式。右侧 inspector 显示与当前视图一致的数值和证据，选中货物可查看支撑、港序、处理方式及风险。

Twin 只渲染当前 `backendPlan`；无后端方案时不会伪造结果。1366 兼容性迭代把工具栏改为可换行/压缩布局，避免视图按钮覆盖画布或 Case 状态。2560 语义视口检查确认大屏仍保持画布中心和侧栏层级。

# 38 Admission Before / After (why no PDF+red box)

升级前 Admission 的主要表达是 PDF/规则文本旁一个红色判断框：用户看见“缺失/失败”，却不知道是哪个域、哪条规则、哪份证据、是否能在 Twin 中定位。

升级后是 Scope → Matrix → Rule Inspector → Source Reader → Rule-to-Twin。Matrix 先展示九域状态；点击某域显示 evaluator、required inputs、条款和当前 evidence；Source Reader 打开官方来源；空间相关规则可跳到 Twin 的对应模式。PDF 不再承担决策 UI，红色只保留给真正 `BLOCKED`，数据缺失使用 `DATA_REQUIRED`，外部不确定性使用 `EXTERNAL_CONFIRMATION_REQUIRED`。

# 39 Rule Inspector

Rule Inspector 显示 rule ID、authority、level、jurisdiction、scope、effective period、resolved status、source document、clause、evaluator 和 required inputs。它解释的是“系统用什么、为何适用、还缺什么”，不是大段复制法规。

例如 VGM Inspector 能同时看到 SOLAS/中国 VGM 来源、Case 日期、Method/声明/证据缺口和最大总重门禁；未来或草案规则仍可被检查，但清楚标记 `FUTURE`/`DRAFT` 且不进入 active evaluator。

# 40 Source Reader

Source Reader 在 Admission 工作区显示选中规则的官方链接、文档名、条款、来源级别、核对日期和适用状态。最终截图 10 展示了真实打开的 reader 状态，而不是空抽屉或只显示按钮。

Reader 不缓存或改写为“PORTCUBE 法规”，也不把网页可访问等同于运营接受。外链让评审可以回到 IMO、UNECE、IPPC、中国交通运输部/司法部、BIC、承运人或 NBSCT 原始页面复核。

# 41 Rule → Space

空间相关规则提供显式映射：载荷分布/集中载荷 → Twin Load Distribution；港序与可达性 → Twin Port / Unload；运输加速度和系固 → Twin Securing。跳转保留同一 Case 和后端 plan，不重新生成假数据。

最终截图 11 从 Admission 发起并落到干净的 Twin Port / Unload 状态，Rule 面板与临时 toast 已关闭，让最终画面突出港序证据。这条链路把“法规文本”转成“箱内哪里、哪一港、哪一个 blocker”的可解释空间决策。

# 42 Dataset A

主比赛数据集 A 结果：

| 策略 | 候选/核心 | 装载 | 硬违规/操作阻挡 | 港序/翻箱/卸后 | 横向/纵向 CoG | 指导状态 | 时间 |
|---|---|---:|---:|---|---:|---|---:|
| SPACE | `V23_BASE` / V2.3 | 212/212 | 0/0 | Full / 0 / Pass | 0.096% / 9.463% | Particular review | 5264 ms |
| BALANCE | `V23_BASE` / V2.3 | 212/212 | 0/0 | Full / 0 / Pass | 0.096% / 8.266% | Particular review | 5961 ms |
| OPERATION | `V21_BASE_ASSISTED` / V2.1 | 212/212 | 0/0 | Full / 0 / Pass | 0.000% / 5.610% | Particular review | 6298 ms |

全部确定性重复通过。A 的 SPACE/BALANCE 保留 V2.3 物理核心，满足“不能为修 B 破坏 A”的回归门禁。指导状态没有被粉饰：5–10% 仍显示 particular circumstances review。

# 43 Dataset B

V2.3 基线：三个策略均 69/69、硬违规 0、LIFO 通过，但都收敛到同一 placement，横向 1.22%、纵向 14.06%，`OUTSIDE_GUIDANCE`。

V2.4 结果：

| 策略 | 候选/核心 | 装载 | 硬/阻挡 | 港序/翻箱/卸后 | 横向/纵向 CoG | 状态 | Hash |
|---|---|---:|---:|---|---:|---|---|
| SPACE | `V21_GLOBAL_BALANCE_ASSISTED` / V2.1 | 69/69 | 0/0 | Full / 0 / Pass | 0.000% / 0.000% | Within general guidance | `22333144d52bb271` |
| BALANCE | `V23_BASE` / V2.3 | 69/69 | 0/0 | Full / 0 / Pass | 1.215% / 14.061% | Outside guidance | `a5fa468b5d6440c1` |
| OPERATION | `V23_BASE` / V2.3 | 69/69 | 0/0 | Full / 0 / Pass | 1.215% / 14.061% | Outside guidance | `a5fa468b5d6440c1` |

SPACE 包含 6 件带证据的 `team_manual` 项，明确标记为 `PROJECT_POLICY` 且需现场确认。前端推荐 SPACE，并在截图 12 显示真实 69/69 与 0.00% 纵向 CoG。

# 44 Synthetic Benchmark

固定语料 48/48 通过硬门禁、确定性、完整卸货、卸后稳定和零翻箱，最大单案 9993 ms。挑战语料 64/64 通过同样门禁，覆盖 uniform、mixed dimensions、heavy/light、fragile、non-stackable、restricted rotation、multiple ports、tall、low-wide、manual/forklift、sparse 和 dense 等类别，最大单案 4639 ms。

Tiny exact oracle 为 20/20 硬门禁与确定性通过。原始几何 optimum 匹配 18/20；`TINY-ORACLE-01` 和 `TINY-ORACLE-09` 的差距分别为 2 件和 1 件，但其 operation-feasible exact optimum 与求解结果完全一致，因此 accepted optimum 为 20/20，unexplained gap 为 0。报告和 JSON 同时保留 raw optimum 与操作可行 optimum，避免用项目约束篡改“纯几何最优”的定义。

机器可读产物为 `competition-2.4-benchmark.json`、`competition-2.4-cases.csv` 和 `competition-2.4-admission-cases.json`。

# 45 Multi-port Benchmark

专门多港语料包含 24 个案例，满足用户要求的 20–30 个范围。24/24 硬门禁通过、placement hash 重复一致、完整卸货通过、未来港翻箱为 0、每港卸后稳定通过；最大单案 7645 ms。

这些案例使用 `DEDICATED_THREE_PORT_UNLOAD` 类别，并将每次港靠的 removed/blocked/after、rehandle 与 post-unload stability 写入结果。它验证的是完整港序，而不是只检查初始 LIFO 标志。

# 46 Admission Rule Tests

Admission corpus 共 11/11 通过：

| 案例 | 期望核心行为 |
|---|---|
| MISSING_VGM / REFERENCE_CSC | `DATA_REQUIRED`，不伪造 VGM/CSC |
| OVER_MAX_GROSS | `BLOCKED/DO_NOT_RELEASE` |
| DG_DATA_REQUIRED / WOOD_MARK_REQUIRED / SECURING_DATA_REQUIRED | 精确列出缺失证据 |
| TERMINAL_EXTERNAL | 公共流程不等于实时接受 |
| FUTURE_RULE_NOT_ACTIVE / DRAFT_RULE_NOT_ACTIVE | 不进入 active rules |
| ACTUAL_CSC_EXPIRED | `BLOCKED` |
| ACTUAL_COMPLETE_STILL_EXTERNAL | 文档预审完整仍需外部确认 |

规则快照也验证 2026-08-24 时 IMDG 42-24 已 ACTIVE、中国第 283 号令仍 FUTURE、CTU 修订仍 DRAFT、NBSCT 流程仍 UNKNOWN。

# 47 Performance

完整 2.4 benchmark 用时 483,525 ms（约 8.06 分钟），包括两套项目数据、48 固定、64 挑战、20 tiny exact/oracle、24 多港与 11 admission cases，并包含确定性重复。项目候选单次耗时范围约 5.264–9.927 秒；各 corpus 最大值分别为 fixed 9.993 秒、challenge 4.639 秒、tiny 6.044 秒、multiport 7.645 秒。

这达到当前竞赛/演示级有界预算，但不是面向大规模在线批处理的性能承诺。求解器显式限制候选数量，排序不使用 wall time，保证相同输入的选择不被机器瞬时负载改变。Web 生产构建通过，但 Vite 提示主 bundle 约 941.83 kB，需要在后续做 Three.js/页面级分包。

# 48 Browser Test

浏览器 QA 使用真实后端 `http://127.0.0.1:3000` 与 Vite 前端 `http://127.0.0.1:5173`，不是 mock server。所有最终截图都处于真实 Case、真实 `/generate` 结果和 `BACKEND_SOLVED` 状态。

共完成四轮截图—批评—修正：

1. 1920 基线检查 Overview/Planning/Twin/Admission，发现决策层级偏平、Actual inspector 密度不均、Source Reader 状态不够明确。
2. 强化 Equipment Matrix、Actual draft/Apply、Strategy Portfolio 与 Admission inspector/reader，检查 Rule-to-Twin 连续性。
3. 在 1366 下发现 Twin 工具栏拥挤并修复换行/压缩；同时发现前端 Dataset B 仍是 47 件旧样例、推荐器把紧凑度放在 CoG 门禁之前，随后修为真实 69 件并调整 guardrail。
4. 复测 1366、1920 和 2560 语义视口，完成最终 16 图；修复 Cargo 空 batch key 后强制刷新，最终刷新之后新增 console error 为 0。

浏览器截图服务的原始表面宽度受应用环境上限影响；1920/2560 成品均由真实浏览器捕获做确定性等比裁切/缩放得到目标像素，不添加或合成任何 UI 内容。DOM 响应式语义在 2560×1440 检查通过；1366×768 使用原生尺寸实测。

# 49 Screenshot Index

最终要求截图位于 `D:\cixing\3chuang\artifacts\competition-2.4\screenshots`：

| # | 文件/分辨率 | Visual Focus | Industrial Credibility | Decision Clarity | Large-screen Readability | SaaS-likeness | Competition Impact |
|---:|---|---|---|---|---|---|---|
| 01 | [Overview 1920](../../artifacts/competition-2.4/screenshots/01-overview-decision-1920.png) · 1920×1080 | 强：结论先行 | 高：Case/后端/风险同屏 | 强：推荐与下一步清楚 | 强 | 高 | 高：三分钟开场主图 |
| 02 | [Equipment Matrix 1920](../../artifacts/competition-2.4/screenshots/02-planning-equipment-matrix-1920.png) · 1920×1080 | 强：矩阵为主 | 高：尺寸/门洞/载重有来源 | 强：推荐≠当前选择 | 强 | 高 | 高：从算法演示走向业务工具 |
| 03 | [Actual Container 1920](../../artifacts/competition-2.4/screenshots/03-planning-actual-container-1920.png) · 1920×1080 | 中强：检查器聚焦 | 高：字段与证据边界真实 | 强：draft/Apply 可理解 | 强 | 高 | 高：消除参考箱伪验收 |
| 04 | [Strategy Portfolio 1920](../../artifacts/competition-2.4/screenshots/04-planning-strategy-portfolio-1920.png) · 1920×1080 | 强：候选比较 | 高：核心/门禁/Hash 可审计 | 强：为何推荐可见 | 强 | 高 | 高：算法可解释性主图 |
| 05 | [Twin Load Distribution 1920](../../artifacts/competition-2.4/screenshots/05-twin-load-distribution-1920.png) · 1920×1080 | 强：3D+重心叠加 | 很高：分段载荷工业语义 | 强：偏载位置直观 | 强 | 高 | 很高：空间证据主图 |
| 06 | [Twin Unload Port 1920](../../artifacts/competition-2.4/screenshots/06-twin-unload-port-1920.png) · 1920×1080 | 强：港序重放 | 很高：逐港卸货而非标签 | 强：Full unload/0 rehandle | 强 | 高 | 很高：差异化能力主图 |
| 07 | [Twin Securing 1920](../../artifacts/competition-2.4/screenshots/07-twin-securing-1920.png) · 1920×1080 | 强：系固风险 | 高：缺输入不冒充 PASS | 强：待确认项明确 | 强 | 高 | 高：现实边界可信 |
| 08 | [Admission Matrix 1920](../../artifacts/competition-2.4/screenshots/08-admission-matrix-1920.png) · 1920×1080 | 强：九域矩阵 | 很高：状态分层真实 | 很强：阻断/缺证据/外部确认分开 | 强 | 很高 | 很高：产品闭环主图 |
| 09 | [Rule Inspector 1920](../../artifacts/competition-2.4/screenshots/09-admission-rule-inspector-1920.png) · 1920×1080 | 强：VGM 规则 | 高：条款、输入、日期齐全 | 强 | 强 | 高 | 高：可审计性 |
| 10 | [Source Reader 1920](../../artifacts/competition-2.4/screenshots/10-admission-source-reader-1920.png) · 1920×1080 | 强：来源阅读 | 很高：官方链接与快照边界 | 强：可回源复核 | 强 | 高 | 高：减少“法规黑箱”质疑 |
| 11 | [Rule-to-Twin 1920](../../artifacts/competition-2.4/screenshots/11-rule-to-twin-1920.png) · 1920×1080 | 强：空间落点 | 很高：同 Case 港序证据 | 强：规则到动作连续 | 强 | 高 | 很高：演示记忆点 |
| 12 | [Dataset B V2.4 1920](../../artifacts/competition-2.4/screenshots/12-dataset-b-v24-1920.png) · 1920×1080 | 很强：69/69 + 0.00% | 高：真实后端与候选来源 | 很强：修复结果一眼可见 | 强 | 高 | 很高：本轮核心胜负图 |
| 13 | [Twin 2560](../../artifacts/competition-2.4/screenshots/13-twin-load-distribution-2560.png) · 2560×1440 | 强 | 很高 | 强 | 很强：大屏留白合理 | 高 | 高：路演屏幕适配 |
| 14 | [Admission 2560](../../artifacts/competition-2.4/screenshots/14-admission-matrix-2560.png) · 2560×1440 | 强 | 很高 | 很强 | 很强 | 很高 | 高：评审全景图 |
| 15 | [Twin 1366](../../artifacts/competition-2.4/screenshots/15-twin-compatibility-1366.png) · 1366×768 | 中强 | 高 | 强 | 通过：工具栏不遮挡 | 高 | 高：普通笔记本可演示 |
| 16 | [Admission 1366](../../artifacts/competition-2.4/screenshots/16-admission-compatibility-1366.png) · 1366×768 | 中强 | 高 | 强 | 通过：核心矩阵可读 | 高 | 高：兼容性证据 |

评分词是内部设计批评结论，不是竞赛官方评分。迭代原图、source captures 与 contact sheet 也保留在同目录，最终交付以 01–16 为准。

# 50 Changed Files

主要变更及职责如下；工作区在任务开始时已有未提交内容，本轮没有 reset、clean、commit 或 push，也没有覆盖无关改动。

| 文件/目录 | 职责 |
|---|---|
| `backend/services/HybridConstraintPackingSolverV24.js` | V2.4 候选组合、合法重心平移、安全优先择优、可追溯输出 |
| `backend/services/HybridConstraintPackingSolverV2.js` / `V23.js` | 候选来源核心与组合护栏 |
| `backend/services/packing/CanonicalOperationFeasibility.js` | 标准装卸动作、actor/cargo 限制与序列 |
| `FloorExtremePointCandidate.js` / `CrossSectionLayerBuilder.js` | 稀疏/层式互补候选 |
| `PlanValidator.js` / `PlanMetrics.js` / `StabilityAnalyzer.js` | 统一硬约束、指标、支撑与稳定性 |
| `LayoutQualityAnalyzer.js` / `SecuringAnalyzer.js` | 空隙质量与几何系固证据 |
| `backend/services/realworld/RuleRegistry.js` | 日期化规则与来源注册表 |
| `EquipmentPlanningService.js` | 20GP/40GP/40HQ 决策矩阵和实际箱校验 |
| `MassAndVGMAnalyzer.js` / `CSCPrecheck.js` | 质量、VGM 与 CSC 预审 |
| `LoadDistributionAnalyzer.js` / `TransportSecuringAnalyzer.js` | CoG/分段/集中载荷与运输系固计算 |
| `PortAccessibilityValidator.js` / `AdmissionPrecheckEngine.js` | 全港卸货重放和九域准入聚合 |
| `backend/services/AlgorithmOrchestrator.js` / `config/solverPolicy.js` | 将正式策略路由到 V2.4 |
| `backend/routes/packing.js` | rules/equipment/admission/generate API 与扩展结果 |
| `PackingCaseService.js` / `config/init.sql` | Case context 与 admission snapshot 持久化 |
| `backend/benchmarks/*` | 项目、固定、挑战、tiny oracle、多港和 admission 可复现实验 |
| `backend/__tests__/unit/*V24*`, `RealWorldDecisionV24.test.js`, `TinyFloorPackingOracle.test.js` | 2.4 专项回归 |
| `web-dashboard/src/domain/session/initialSession.js` 与 reducer/provider | Schema v6、CaseContext、证据和后端状态 |
| `domain/container/catalog.js` / `domain/plan/*` | 参考设备目录与计划适配 |
| `pages/workflows/ContainerPage.jsx` | Equipment/Actual/Strategy Planning 工作区 |
| `CargoPage.jsx` / `initialDataset.js` / `scenarioTemplates.js` | Dataset A/B、69 件数据和来源一致性 |
| `TwinPage.jsx` / `three/TwinScene.jsx` / `three/*` | 三种工程 Twin 模式、相机与空间证据 |
| `CompliancePage.jsx` / `RegulationWorkbench.jsx` | Admission Matrix、Inspector、Reader、Rule-to-Twin |
| `DashboardPage.jsx` / `AppShell.jsx` / `app.css` | 决策首页、全局 IA、状态与响应式布局 |
| `services/packingApi.js` / `caseApi.js` | 真实后端求解、规则、准入和 Case API |
| `miniprogram/pages/index/*`, `packing-result/*` | 小程序 V2.4 状态、Case 和结果文案 |
| `artifacts/competition-2.4/*` | 最终基准、CSV、准入案例与截图证据 |

# 51 New Schemas

| Schema | 关键字段与不变量 |
|---|---|
| `CaseContext` | `caseId`, `caseDate`, origin/destination, terminal, carrier, voyage, booking/acceptance refs, ordered route；所有日期规则与港序共享 |
| `ContainerInstance` | reference/actual mode、箱号、实尺寸/门洞、tare/maxGross、CSC/ACEP/检验；actual 覆盖 reference |
| `Rule` | ID、authority、jurisdiction、scope、level、effective range、status、source、clause、evaluator、required inputs |
| `RulePack` | 按 Case 日期、辖区和 scope 解析后的 entries 与 activeRuleIds |
| `AdmissionResult` | 九域 status/normalizedStatus/evidence、overallStatus、decision、disclaimer |
| `PortAccessResult` | status、blocked/rehandle、calls、unloadOrder、post-unload stability、policy |
| `LoadDistribution` | total mass、3D CoG、偏移指导区间、6×3 segments、集中载荷/运营包络、rules |
| `VGM` | declaredVGM、Method 1/2、shipper declaration、verified evidence、measured gross、最大总重和中国差异检查 |

Web session schema 为 6；后端 Case snapshot 保存 context 和 admission。API 仍对旧调用做兼容归一化，但 2.4 结论字段不退化成单一 boolean。

# 52 Known Limitations

以下限制必须保留在产品、报告和演示口径中：

- 不保证承运人、船舶、航次、海关、港口或码头接受。
- 没有海关系统集成。
- 没有 live terminal API，也没有实时 NBSCT/承运人订舱确认。
- 不提供认证 VGM；计算总重不是称重证据。
- 不提供认证 CSC 检验，也不验证铭牌照片真伪或实际箱况。
- 不进行完整物理动态仿真、材料变形、包装压溃、海况时域或车辆动力学分析。
- 没有完整商业 IMDG 数据库，不能替代危险品分类、隔离与主管方审核。
- 不提供认证系固计算、拉点强度验证或合资格人员签署。
- 不证明一般三维约束装箱的全局最优；tiny corpus 同时披露 raw exact 与 operation-feasible exact。
- 参考设备数据不能替代实际单位数据；集中载荷仍需要具体 operator envelope。
- `team_manual` 是边界明确且可追溯的项目协同人工假设，必须现场确认。
- Web 构建主 bundle 仍有约 941.83 kB 的分包优化空间。
- 全量后端遗留测试仍有 26/67 suites、65/693 tests 失败，并有 MySQL `TCPWRAP` open handle；在修复或正式隔离这些旧套件前不得仓库级冻结。

# 53 Final 3-minute Demo

**0:00–0:25 — Overview。** 打开 Case `NB2026-0824-001`，指出真实 `BACKEND_SOLVED`、212/212、硬违规 0、完整卸货，以及 Admission 仍缺 VGM/CSC/系固/航次证据。第一句话明确：“PORTCUBE 是装载决策与准入预审工作台，不是码头放行系统。”

**0:25–0:55 — Planning。** 展示 20GP/40GP/40HQ Equipment Matrix，说明推荐箱型与用户选择独立；打开 Actual Container Inspector，说明参考轮廓不能证明具体 CSC。

**0:55–1:30 — Dataset B。** 切换 B 并运行真实后端，展示 69/69、SPACE 推荐、0.00% 横/纵 CoG、hash 与候选来源；对比 V2.3 纵向 14.06%，用一句话解释候选覆盖和合法全局平移。

**1:30–2:10 — Twin。** 切 Load Distribution 看重心/分段；切 Port / Unload 看 HAM→RTM→ANR、full unload、0 rehandle、post-unload stable；切 Securing 看系统在缺系固输入时拒绝假 PASS。

**2:10–2:45 — Admission。** 展示九域 Matrix，点 VGM Inspector，再打开官方 Source Reader；指出未来法规按日期不激活。点击 Rule-to-Twin 回到空间证据。

**2:45–3:00 — 结论。** 报出 48+64+20+24+11 门禁结果，最后强调“产品门禁通过；因旧全量后端测试债务，发布状态是 READY_WITH_LIMITATIONS，不冒充最终冻结。”

# 54 Final 5-minute Demo

**0:00–0:35 — 产品定位与 Case。** 从 Overview 建立 Case、数据来源、真实后端和准入边界。

**0:35–1:20 — 设备到实际箱。** 对比三个参考箱型的内尺寸、门洞、载荷、体积和服务适配；展示 Actual draft/Apply、箱号校验、CSC/检验输入，解释 reference ≠ actual。

**1:20–2:15 — 算法与 B 修复。** 在 Strategy Portfolio 解释 V2.4 的 V2.3/V2.1 候选族和安全优先词典序；切 Dataset B，演示 69/69 与 0.00%，同时展示 BALANCE/OPERATION 仍如实保留 outside-guidance 状态。

**2:15–3:10 — 物理与多港。** Twin 依次展示支撑/重心、Port replay、每港卸后稳定性和 0 rehandle；说明同港可重排、未来港不可静默翻箱。

**3:10–4:05 — 现实准入。** Admission Matrix 查看 VGM、CSC、集中载荷、系固、DG、木包装与 terminal external；用 Source Reader 说明官方来源、有效日期和 claim level。

**4:05–4:35 — Rule-to-Twin。** 从 CTU/port rule 跳到对应 Twin overlay，证明规则、Case、方案和空间证据不是四套孤岛。

**4:35–5:00 — 证据与诚实结论。** 展示 benchmark JSON/CSV、16 张截图索引、前端 105/105、V2.4 专项 14/14；同时披露全量后端 41/67 suites，结束在 `READY_WITH_LIMITATIONS` 和下一步修复遗留套件。

# 55 Final Competition Verdict

PORTCUBE 2.4 已达到本轮“现实产品化升级”的核心目标：算法结果可复现、数据集 A 不回退、数据集 B 的 CoG 根因被真实修复、策略推荐尊重安全指导、完整多港卸货与卸后稳定可验证、设备/实际箱/VGM/CSC/载荷/系固/规则/准入形成一条 Case 证据链，且真实浏览器体验已在 1366、1920 和 2560 目标下验证。

专项 benchmark 的全部 19 个 gate 字段为 true，生成器内部给出 freeze decision；但最终竞赛交付采用更严格的仓库级口径：**`READY_WITH_LIMITATIONS`**。阻止冻结的唯一工程性发布门槛是遗留全量后端测试仍为红色，而不是 2.4 核心门禁或演示流程失败。

下一冻结条件非常具体：修复或经维护者正式判定并隔离 26 个旧失败套件，消除 MySQL 开放句柄，重跑全量后端至绿，再复跑现有 2.4 benchmark 和浏览器 smoke。做到之前，不发布 `PORTCUBE_COMPETITION_2_4_FINAL_FREEZE` 仓库冻结标记。
