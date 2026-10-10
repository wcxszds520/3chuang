# 提交材料总索引

> 生成时间：2026-07-11
> 文件用途：作为甬柜易算比赛提交材料的最终总索引，包含已生成文件列表、用途、报告映射、事实/目标态分类、后续操作建议。

---

## 一、已生成文件列表

### 1. 图表类（11-diagrams）

| 序号 | 文件路径 | 用途 |
|------|----------|------|
| 1 | 11-diagrams/SYSTEM_ARCHITECTURE.md | 总体系统架构图（Web/小程序/后端/数据库/AI/法规库） |
| 2 | 11-diagrams/CLIENT_BACKEND_AI_RELATION.md | Web、移动端、后端和 AI 关系图 |
| 3 | 11-diagrams/BUSINESS_FLOW.md | 业务流程图（货物录入→报告导出） |
| 4 | 11-diagrams/ALGORITHM_FLOW.md | 装箱算法流程图（输入→排序→切片→填充→重心→LIFO→输出） |
| 5 | 11-diagrams/DATA_FLOW.md | 数据流图（session→API→service→DB→响应→3D/合规/报告） |
| 6 | 11-diagrams/THREE_D_STATE_MACHINE.md | 3D 作业状态机图（18 相位） |
| 7 | 11-diagrams/COMPLIANCE_EVIDENCE_FLOW.md | 合规证据链流程图（三层→最终结论） |
| 8 | 11-diagrams/REPORT_GENERATION_FLOW.md | 报告生成流程图（session→buildReportModel→HTML/CSV/JSON/打印） |
| 9 | 11-diagrams/USER_ROLE_FLOW.md | 用户角色与使用流程图（中小卖家/货代/仓库工人） |
| 10 | 11-diagrams/TECH_ROADMAP.md | 项目技术路线图（当前态已实现模块） |
| 11 | 11-diagrams/CURRENT_TARGET_ROADMAP.md | 当前态与目标态路线图（实线=已实现，虚线=目标态） |
| 12 | 11-diagrams/DEPLOYMENT_ARCHITECTURE.md | 部署架构图（5173→3000→3306→外部 AI API） |
| 13 | 11-diagrams/DIAGRAM_IMAGE_PROMPTS.md | 逐图独立 AI 图像生成提示词 |

### 2. 证据类（12-evidence）

| 序号 | 文件路径 | 用途 |
|------|----------|------|
| 14 | 12-evidence/SCREENSHOT_EVIDENCE_PLAN.md | 截图与佐证材料规划（6 页面×多状态） |
| 15 | 12-evidence/EVIDENCE_PACKAGE_INDEX.md | 证据包索引（源码/测试/API/DB/截图/导出/日志/文档/图表） |

### 3. 目标态类（13-target-state）

| 序号 | 文件路径 | 用途 |
|------|----------|------|
| 16 | 13-target-state/TARGET_STATE_SPEC.md | 目标态规格（比赛提交最终形态） |
| 17 | 13-target-state/IMPLEMENTATION_BACKLOG.md | 实施待办清单（P0/P1/P2） |
| 18 | 13-target-state/SUBMISSION_READINESS_GAPS.md | 提交就绪差距分析（无证据表述） |
| 19 | 13-target-state/CLAIMS_TO_UNLOCK.md | 宣传表述解锁清单（8 条待解锁） |

### 4. 最终索引类（14-final-index）

| 序号 | 文件路径 | 用途 |
|------|----------|------|
| 20 | 14-final-index/SUBMISSION_MATERIALS_INDEX.md | 本文件（最终总索引） |
| 21 | 14-final-index/FINAL_PROJECT_FACT_CHECK.md | 最终事实核查 |

---

## 二、报告映射

### 2.1 研究报告

| 报告章节 | 建议引用文件 |
|----------|--------------|
| 系统架构 | SYSTEM_ARCHITECTURE.md、DEPLOYMENT_ARCHITECTURE.md |
| 技术方案 | TECH_ROADMAP.md、CLIENT_BACKEND_AI_RELATION.md |
| 业务流程 | BUSINESS_FLOW.md、USER_ROLE_FLOW.md |
| 算法设计 | ALGORITHM_FLOW.md |
| 3D 可视化 | THREE_D_STATE_MACHINE.md |
| 合规设计 | COMPLIANCE_EVIDENCE_FLOW.md |
| 数据流 | DATA_FLOW.md |
| 报告生成 | REPORT_GENERATION_FLOW.md |
| 目标与差距 | TARGET_STATE_SPEC.md、SUBMISSION_READINESS_GAPS.md |
| 事实核查 | FINAL_PROJECT_FACT_CHECK.md |

### 2.2 查新报告

| 查新点 | 建议引用文件 |
|--------|--------------|
| 三层合规证据链 | COMPLIANCE_EVIDENCE_FLOW.md |
| 18 相位状态机 | THREE_D_STATE_MACHINE.md |
| Fast Block多约束三维装箱引擎 | ALGORITHM_FLOW.md |
| 程序化构建 118+34 部件 | THREE_D_STATE_MACHINE.md、TECH_ROADMAP.md |
| TF-IDF RAG 法规检索 | COMPLIANCE_EVIDENCE_FLOW.md |
| 事实核查 | FINAL_PROJECT_FACT_CHECK.md |

### 2.3 报名表

| 填写项 | 建议引用文件 |
|--------|--------------|
| 项目简介 | SYSTEM_ARCHITECTURE.md、BUSINESS_FLOW.md |
| 技术栈 | TECH_ROADMAP.md、DEPLOYMENT_ARCHITECTURE.md |
| 核心功能 | BUSINESS_FLOW.md、USER_ROLE_FLOW.md |
| 创新点 | COMPLIANCE_EVIDENCE_FLOW.md、THREE_D_STATE_MACHINE.md |
| 目标态 | TARGET_STATE_SPEC.md |

### 2.4 PPT

| 页面 | 建议引用文件 |
|------|--------------|
| 架构图 | SYSTEM_ARCHITECTURE.md |
| 业务流程 | BUSINESS_FLOW.md |
| 算法流程 | ALGORITHM_FLOW.md |
| 3D 状态机 | THREE_D_STATE_MACHINE.md |
| 合规证据链 | COMPLIANCE_EVIDENCE_FLOW.md |
| 路线图 | CURRENT_TARGET_ROADMAP.md |
| 演示截图 | SCREENSHOT_EVIDENCE_PLAN.md |

---

## 三、当前事实文件 vs 目标态文件

### 3.1 当前事实文件（可直接引用）

| 文件 | 性质 |
|------|------|
| SYSTEM_ARCHITECTURE.md | 当前态+目标态标注 |
| CLIENT_BACKEND_AI_RELATION.md | 当前态+目标态标注 |
| BUSINESS_FLOW.md | 当前态+目标态标注 |
| ALGORITHM_FLOW.md | 当前态+目标态标注 |
| DATA_FLOW.md | 当前态+目标态标注 |
| THREE_D_STATE_MACHINE.md | 当前态+目标态标注 |
| COMPLIANCE_EVIDENCE_FLOW.md | 当前态+目标态标注 |
| REPORT_GENERATION_FLOW.md | 当前态+目标态标注 |
| USER_ROLE_FLOW.md | 当前态+目标态标注 |
| TECH_ROADMAP.md | 纯当前态 |
| DEPLOYMENT_ARCHITECTURE.md | 当前态+目标态标注 |
| EVIDENCE_PACKAGE_INDEX.md | 当前态证据 |
| SCREENSHOT_EVIDENCE_PLAN.md | 当前态+目标态截图规划 |
| FINAL_PROJECT_FACT_CHECK.md | 事实核查（含目标态） |

### 3.2 目标态文件（规划性质）

| 文件 | 性质 |
|------|------|
| CURRENT_TARGET_ROADMAP.md | 当前态→目标态对照 |
| TARGET_STATE_SPEC.md | 纯目标态规格 |
| IMPLEMENTATION_BACKLOG.md | 目标态实施待办 |
| SUBMISSION_READINESS_GAPS.md | 目标态差距分析 |
| CLAIMS_TO_UNLOCK.md | 目标态宣传解锁 |

---

## 四、需要 Deep Research 的文件

| 文件 | 需 Deep Research 内容 |
|------|----------------------|
| TARGET_STATE_SPEC.md | 行业对标（同类系统利用率/倍速指标） |
| FINAL_PROJECT_FACT_CHECK.md | 专利与论文查新、行业背景数据 |
| CLAIMS_TO_UNLOCK.md | 同类产品能力对标（PDF 联动/联网检索） |
| TECH_ROADMAP.md | 技术栈选型对比论证 |

---

## 五、需要 GPT Work 排版的文件

| 文件 | 排版需求 |
|------|----------|
| 11-diagrams/*.md（12 个） | Mermaid 图渲染+图文排版 |
| SYSTEM_ARCHITECTURE.md | 架构图精美化 |
| BUSINESS_FLOW.md | 流程图精美化 |
| THREE_D_STATE_MACHINE.md | 状态机图精美化 |
| COMPLIANCE_EVIDENCE_FLOW.md | 证据链图精美化 |
| CURRENT_TARGET_ROADMAP.md | 路线图精美化 |
| SCREENSHOT_EVIDENCE_PLAN.md | 截图表格排版 |
| EVIDENCE_PACKAGE_INDEX.md | 索引表格排版 |
| FINAL_PROJECT_FACT_CHECK.md | 事实核查表格排版 |

---

## 六、需要本人或指导老师确认的文件

| 文件 | 需确认内容 |
|------|------------|
| FINAL_PROJECT_FACT_CHECK.md | 人员/经费/专利/论文信息 |
| TARGET_STATE_SPEC.md | 目标态可行性确认 |
| IMPLEMENTATION_BACKLOG.md | 任务优先级与工作量确认 |
| CLAIMS_TO_UNLOCK.md | 宣传表述措辞确认 |
| SUBMISSION_READINESS_GAPS.md | 差距降级措辞确认 |
| EVIDENCE_PACKAGE_INDEX.md | 源码路径确认 |

---

## 七、最优后续操作顺序

### 第一步：事实确认（0.5 天）
1. 阅读本索引与 FINAL_PROJECT_FACT_CHECK.md
2. 确认人员/经费/专利/论文信息
3. 确认目标态可行性与优先级

### 第二步：图表渲染（0.5 天）
4. 用 GPT Work 或 Mermaid 渲染工具渲染 12 个图源文件
5. 按 DIAGRAM_IMAGE_PROMPTS.md 生成 AI 图像（可选）

### 第三步：P0 任务开发（3-5 天）
6. 按 IMPLEMENTATION_BACKLOG.md 执行 P0 任务
7. 扩充数据集→全装入验证→后端 PDF→小程序 export→主色统一

### 第四步：截图补拍（1 天）
8. 按 SCREENSHOT_EVIDENCE_PLAN.md 补拍 S01-S48
9. 统一存放至 12-evidence/screenshots/

### 第五步：报告撰写（2-3 天）
10. 按报告映射引用对应文件
11. 目标态表述按 CLAIMS_TO_UNLOCK.md 与 SUBMISSION_READINESS_GAPS.md 降级措辞
12. 研究报告→查新报告→报名表→PPT 顺序撰写

### 第六步：最终核查（0.5 天）
13. 按 FINAL_PROJECT_FACT_CHECK.md 逐条核查
14. 确认所有"已完成"表述有代码+测试+截图三重证据
15. 确认所有"规划中"表述已标注

---

## 八、文件版本与维护

- 所有文件生成时间：2026-07-11
- 维护原则：目标态功能实现后，需同步更新对应图源文件（虚线改实线）、TARGET_STATE_SPEC.md（勾选验收项）、CLAIMS_TO_UNLOCK.md（解锁状态）、FINAL_PROJECT_FACT_CHECK.md（事实分类调整）。
- 不得在未实现前将目标态表述改为"已完成"。
