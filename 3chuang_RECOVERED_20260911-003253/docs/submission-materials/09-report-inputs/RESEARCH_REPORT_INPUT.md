# 研究报告参考资料底稿 (RESEARCH_REPORT_INPUT)

> 生成时间：2026-07-11
> 用途：甬柜易算项目研究报告撰写的素材底稿（非最终报告）。每条标注 [已验证] / [待确认] / [目标态]
> 事实基准：PROJECT_MASTER_FACTS.md（2026-07-11 调查基线，分支 codex/sol）
> 撰写原则：内部代码事实标注 [已验证]；需申报人决定或外部补充标注 [待确认]；目标态功能标注 [目标态]

---

## 1. 项目题目

**甬柜易算：基于确定性算法与三维作业可视化的港前装柜智能决策系统**

- 中文标准名称：甬柜易算 [已验证]
- 英文/技术名称：Ningbo Port Intelligent 3D Packing System [已验证]
- 项目代号（内部）：3chuang / yonggui / yonggui-yisuan [已验证]
- 后端包名：`ningbo-port-packing-backend` [已验证]
- Web 包名：`ningbo-port-digital-twin-web` [已验证]
- 微信 AppID：`wx3e4ac8267481ad58` [已验证]

---

## 2. 摘要素材（3-5 个候选段落）

### 段落 A（技术导向，约 220 字）[已验证]

甬柜易算是一个面向宁波港出口中小卖家的港前装柜智能决策系统，覆盖"货物录入→SKU管理→柜型推荐→装箱算法→三维作业可视化→合规预审→报告导出"的完整闭环。系统采用 React18 + Vite5 + Three.js0.179 构建 Web 端，Node.js + Express + MySQL 构建后端，原生微信小程序 + threejs-miniprogram 构建移动端。核心装箱能力由 Fast Block多约束三维装箱引擎与 Realistic4D v34.7 引擎提供，由 AlgorithmOrchestrator 调度器统一调度，遵循 LIFO 卸货顺序、动态重心、同 SKU 聚集、堆叠安全、搬运可达性、VGM 合规六个维度的硬约束。在演示订单 NB2026-DEMO-01（宁波→汉堡→鹿特丹→安特卫普，40HQ）上实现 221 件输入、221 件装入、84.51% 空间利用率、8,812 kg 装入总重、合规 本地规则 WARNING / AI建议 PASS / 人工复核独立 的真实结果。

### 段落 B（业务导向，约 200 字）[已验证]

针对宁波港出口中小卖家人工经验装柜导致的倒箱费、退港、查验布控等风险，本项目构建了"确定性算法算物理、AI 判合规"的双层架构。装箱物理决策由 Fast Block多约束三维装箱引擎确定性生成（相同输入相同输出），合规审核由本地规则引擎判定 PASS/FAIL、DeepSeek V4 Flash 仅撰写建议文本（零幻觉架构），并保留人工复核环节。3D 作业过程通过 18 相位状态机与真实坐标驱动，程序化构建 118 部件集装箱、34 部件叉车与 4 关节人工 actor，配合 AABB 碰撞检测为仓库工人提供装柜蓝图。系统支持 HTML/CSV/JSON 三种报告格式浏览器本地导出。

### 段落 C（创新导向，约 230 字）[已验证]

本项目的创新点包括：（1）Fast Block多约束三维装箱引擎在六个硬约束维度下确定性输出；（2）"引擎算物理、AI 判合规"的零幻觉合规架构，AI 仅写建议不判定结论；（3）18 相位作业状态机与真实坐标驱动的 3D 装柜过程可视化，区分叉车与人工两种作业 actor；（4）基于 TF-IDF 余弦相似度的本地法规 RAG 检索（CTU Code / GB 40163-2021 / JT/T 1187-2018 / SOLAS VGM 共 17 sections），零外部依赖；（5）VGM 后端硬计算（相对误差≤5% 且绝对误差≤1 吨）的合规闭环；（6）三层合规证据链（本地规则→AI建议→人工复核，不可静默覆盖）。后端累计 811 个测试（54 文件），Web 端 21 个测试文件 90 个用例。

### 段落 D（精简版，约 120 字）[已验证]

甬柜易算面向宁波港出口中小卖家，提供港前装柜智能决策。系统由 Web（React18+Three.js）、后端（Node.js+Express+MySQL）、微信小程序三端构成，核心为 Fast Block多约束三维装箱引擎（六类业务约束协同机制、确定性输出）与"引擎算物理、AI 判合规"的零幻觉合规架构。演示订单实现 221/221 件装入、84.51% 利用率、本地规则 WARNING / AI建议 PASS / 人工复核独立 合规。

### 段落 E（待外部数据补全）[待确认]

> 本段落需补充宁波港出口中小卖家规模、装柜行业痛点量化数据、倒箱费/退港经济损失等行业外部数据。这些数据需通过 Deep Research 调查，不得从仓库代码推断。

---

## 3. 关键词

### 中文关键词 [已验证]
甬柜易算、港前装柜、装箱算法、FastBlock 块优先、三维装箱可视化、LIFO 卸货顺序、VGM 合规、合规预审、零幻觉架构、TF-IDF 法规检索、Three.js、微信小程序、宁波港、集装箱装载、确定性算法

### 英文关键词 [已验证]
Yonggui Yisuan、Pre-Port Packing、3D Bin Packing、FastBlock、Three-Dimensional Packing Visualization、LIFO Unloading Order、VGM Compliance、Compliance Pre-Audit、Zero-Hallucination Architecture、TF-IDF Regulation RAG、Three.js、WeChat Mini Program、Ningbo Port、Container Loading、Deterministic Algorithm

---

## 4. 项目背景中的内部事实

> 注：以下为代码与仓库可证明的内部事实，非外部行业数据。外部行业数据需 Deep Research（见第 28 节）。

- 项目定位为港前（Pre-Port）装柜决策系统，非港口内作业调度、非 TOS、非报关单证系统 [已验证]
- 后端内置 3 套货型模板：慈溪小家电、宁波文具、宁波汽配（[backend/config/templates.js]）[已验证]
- AI 合规服务 systemPrompt 设定"宁波港 20 年资深理货长"角色（[backend/services/AIComplianceService.js:49]）[已验证]
- 3D 作业坐标系：x=长度，y=高度，z=宽度；门端在 x=innerLength（高 X 端）[已验证]
- 法规库覆盖 4 份法规 JSON：CTU Code、GB 40163-2021、JT/T 1187-2018、SOLAS VGM，共 17 sections [已验证]
- 28 个 Kiro spec 驱动开发，其中 8 个 100% 完成 [已验证]
- 项目已有两版 12 页 PPT（ppt-master 生成）[已验证]
- 当前仓库无企业落地、部署量、营业收入证据 [已验证]

---

## 5. 用户痛点

> 基于 [backend/config/templates.js] 3 套货型模板与代码逻辑推断 [已验证]

1. 中小卖家人工经验装柜，缺乏科学装箱方案，导致空间利用率低 [已验证]
2. 多目的港卸货顺序混乱（演示订单含汉堡→鹿特丹→安特卫普 3 港），人工难以保证 LIFO 卸货顺序 [已验证]
3. VGM（Verified Gross Mass）总重申报误差风险，可能被海关查验布控 [已验证]
4. 重心偏移超限（横向>5%、纵向>10%）导致运输安全隐患（NingboPortSafetyEngine 实现）[已验证]
5. 重不压轻堆叠事故、易碎品损坏（fragile/maxStackLayers/checkStackingConstraints 实现）[已验证]
6. 木包装 IPPC 标识、危险品 UN38.3/MSDS/IMDG 资质、混装禁忌（食品/化工、液体/电子、危险品/普货）人工难以全面核查 [已验证]
7. 倒箱费、退港损失（具体金额需外部 Deep Research）[待确认]

---

## 6. 需求分析

### 功能性需求 [已验证]
- 货物 SKU 全生命周期管理（增删改查复制、CSV 导入导出、VLM 图片识别）
- 柜型选择与推荐（20GP/40GP/40HQ，纯算法推荐，v37.1 起不调 AI）
- 后端确定性装箱算法生成三维坐标方案
- 3D 装柜作业过程可视化（叉车+人工 actor，18 相位状态机）
- 三层合规预审（本地规则+AI建议+人工复核）
- HTML/CSV/JSON 报告浏览器本地导出
- 多端覆盖（Web 6 页面 + 微信小程序 5 页面）

### 非功能性需求 [已验证]
- 确定性输出：相同输入相同结果（AlgorithmOrchestrator + seed）
- 零幻觉合规：AI 仅写建议，不判定 PASS/FAIL
- 降级容错：所有 AI 服务失败时有本地降级，不伪造成功
- AABB 碰撞检测，tolerance=2mm
- InstancedMesh 批量渲染优化性能

---

## 7. 目标用户

| 用户 | 使用场景 | 证据状态 |
|---|---|---|
| 宁波港出口中小卖家 | 录入SKU→选柜→生成装柜方案→合规预审→导出装柜图纸给仓库 | [已验证]（templates.js 3 套货型模板） |
| 货代/理货长 | 复核装柜方案、VGM 验证、合规审核 | [已验证]（AIComplianceService systemPrompt 设定"宁波港 20 年资深理货长"角色） |
| 仓库工人/叉车工 | 依据 3D 作业蓝图按序装柜 | [已验证]（operationMachine.js 18 相位作业状态机） |

---

## 8. 典型场景（NB2026-DEMO-01）

- 订单号：NB2026-DEMO-01（final_product_integration 复测时为 NB2026-DEMO-01，申报材料统一使用 NB2026-DEMO-01）[已验证]
- 航线：宁波→汉堡→鹿特丹→安特卫普（3 个目的港，需 LIFO 卸货顺序）[已验证]
- 柜型：40HQ（12032×2352×2698mm，限重 26000kg）[已验证]
- 输入：221 件 / 10 SKU [已验证]
- 装入：221 件 [已验证]
- 未装：0 件 [已验证]
- 空间利用率：84.51% [已验证]
- 装入总重：8,812 kg（注意：221 件输入总重 8,812 kg，需明确区分）[已验证]
- 合规：本地规则 WARNING / AI建议 PASS / 人工复核独立 [已验证]
- 证据：[docs/final_product_integration/REAL_DATA_CONSISTENCY_REPORT.md]、[output/playwright/core-e2e/results.json] [已验证]

> 最终唯一口径：221/221 件已规划装入、0 件未装、84.51%、8,812 kg；本地规则 WARNING、AI建议 PASS、人工复核独立。

---

## 9. 总体方案

主链路（VERIFIED）：
```
货物录入 → SKU 管理 → 柜型选择/推荐 → 后端装箱算法 → 三维坐标方案 → 3D 装柜作业 → 合规预审 → AI 解释 → 人工复核 → 报告导出
```
[已验证]

核心设计思想：
- "引擎算物理，AI 判合规"——装箱物理决策由确定性算法生成，合规审核由本地规则判定、AI 仅写建议 [已验证]
- 三层合规证据链：本地规则→AI建议→人工复核，不可静默覆盖 [已验证]
- 真实坐标驱动 3D 可视化，非物理仿真、非工业数字孪生 [已验证]

---

## 10. 系统架构

### 三端架构 [已验证]
- Web 端：React18 + Vite5 + Three.js0.179，自研 hash 路由 + useReducer + localStorage 状态管理 [已验证]
- 后端：Node.js + Express + MySQL2，端口 3000，API 前缀 /api，41 个端点（40 已注册+1 未注册历史）[已验证]
- 移动端：原生微信小程序 + threejs-miniprogram 0.0.8，基础库≥2.30.0，5 页面（export 空壳）[已验证]

### AI 服务层 [已验证]
- DeepSeek V4 Flash（硅基流动）：合规建议文本撰写 [已验证]
- Qwen3-VL-32B-Instruct（硅基流动）：货物图片识别 [已验证]
- seed-tts-2.0（火山引擎豆包）：语音合成 [已验证]
- Tavily Search：联网法规检索（无 Key 时返回 web_available=false）[已验证]

> 所有 AI 服务均有本地降级机制，无 API Key 或调用失败时不伪造成功 [已验证]

---

## 11. Web 端（6 页面）

| 页面 | 路由 | 核心功能 | 状态 |
|---|---|---|---|
| DashboardPage | /dashboard | 流程进度/风险/待办/历史方案 | [已验证] |
| CargoPage | /cargo | SKU 全生命周期 + CSV + VLM | [已验证] |
| ContainerPage | /container | 柜型选择 + 真实方案生成 | [已验证] |
| TwinPage | /twin | 3D 作业过程复核 | [已验证] |
| CompliancePage | /compliance | 三层合规 + 证据 Drawer | [已验证] |
| ReportPage | /report | 4 章节 + 4 格式导出 | [已验证] |

技术栈：React ^18.3.1、Vite ^5.4.19、Three.js ^0.179.0、Vitest 2.1.9、ESLint 8.57.1 [已验证]

---

## 12. 移动端（微信小程序 5 页面）

| 页面 | 状态 | 说明 |
|---|---|---|
| 首页 | [已验证] | 硬编码拟真数据（与 Web 真实后端有差异） |
| 货物录入 | [已验证] | 缺 CSV/批量编辑 |
| 柜型选择 | [已验证] | 有 aiScoreMap |
| 装箱结果/3D 查看 | [已验证] | 深色版 ThreeRenderer，缺人工 actor/7 维筛选 |
| 合规查看 | [待确认] | PARTIAL，缺三层架构 |
| 报告导出 | [目标态] | export 页面为空壳，未实现 |

技术栈：原生微信小程序 + threejs-miniprogram ^0.0.8 [已验证]
离线降级：仅小程序有 precomputedPlan 离线降级 [已验证]

---

## 13. 后端（41 API 端点）

- 入口：[backend/server.js]（端口 3000）[已验证]
- 路由聚合：[backend/routes/index.js] [已验证]
- 已注册路由模块：cargo / container / packing / ai-packing / port / compliance / vlm / tts / dashboard [已验证]
- 真实 API 端点数：41 个（含 1 个未注册历史 packing-v33.0-FINAL.js）[已验证]
- 端点分布：系统2/货物6/柜型1/装箱5/AI装箱11/港口1/法规5/VLM2/TTS2/Dashboard6 [已验证]
- 状态：30 VERIFIED / 9 IMPLEMENTED_UNVERIFIED / 2 PARTIAL / 1 NOT_FOUND [已验证]

---

## 14. 数据库（4 表）

- 类型：MySQL（mysql2 Promise 连接池）[已验证]
- 默认库名：`ningbo_port_packing` [已验证]
- 表：4 张 [已验证]
  - cargo：货物 SKU
  - container_type：柜型（初始 20GP/40GP/40HQ）
  - packing_plan：装箱方案
  - user：用户
- 字符集：utf8mb4_unicode_ci [已验证]
- 建表脚本：[backend/config/init.sql] [已验证]
- 迁移：add-fragile-field.sql（fragile 字段）、add-shipping-time-fields.sql（eta/port_sequence/cy_closing/customs_declaration）[已验证]
- 安全隐患：[backend/scripts/migrate-add-fragile.js:18] 硬编码数据库密码，不得提交公开仓库 [已验证]

---

## 15. 核心算法（FastBlock + Realistic4D + 六类业务约束协同机制）

### 算法清单 [已验证]
| 算法 ID | 引擎类 | 用途 | 状态 |
|---|---|---|---|
| fast-block | FastBlockPackingEngine | 大批量路演数据集，确定性块优先 | [已验证]（生产主力） |
| realistic4d | Realistic4DPackingEngine v34.7 | Y轴地面优先 + LIFO + Z-Lane 屏障 | [已验证] |
| realistic4d-multi-strategy | AlgorithmOrchestrator | 多策略融合取最优 | [已验证]（默认） |
| realistic4d-weight-first/volume-first/mixed | 排序变体 | 不同排序策略 | [待确认] |
| LayeredPackingEngine | 分层装载 | 慈溪家电救场 | [待确认]（目标≥70%，实际 39.06% 未达标） |

### 六类业务约束协同机制（非加权算法）[已验证]
> 代码中不存在"Fast Block多约束三维装箱引擎"。`sixDimensionalConstraints` 是六个约束维度的清单，不是加权评分算法。
1. LIFO 卸货顺序（LIFO unloading order）
2. 动态重心（dynamic center-of-gravity）
3. 同 SKU 聚集（same-SKU clustering）
4. 堆叠与重不压轻安全（stacking and heavy-on-light safety）
5. 叉车/人工搬运可达性（forklift/manual handling reachability）
6. VGM/总重合规（VGM/gross-weight compliance）

### 算法白名单 [已验证]
6 个算法 ID 白名单

### 确定性输出 [已验证]
相同输入相同结果（AlgorithmOrchestrator + seed），ResultCache 5 分钟 TTL

---

## 16. AI 介入点（含边界）

| AI 能力 | 真实实现 | 边界 | 状态 |
|---|---|---|---|
| 合规审核 | DeepSeek V4 Flash 写建议文本 | 本地规则判 PASS/FAIL，AI 不判定 | [已验证] |
| 箱型推荐 | 纯算法决策（v37.1 起不调 AI） | - | [已验证] |
| 策略建议 | AI 生成，失败本地降级 | - | [待确认] |
| 结果解释 | AI 生成，失败本地降级 | - | [待确认] |
| 货物识别 | Qwen3-VL-32B 视觉模型 | 不可用时返回 null，前端手动录入 | [待确认] |
| 语音合成 | 火山引擎 seed-tts-2.0 | 不可用时前端降级 Web Speech | [待确认] |
| 联网法规检索 | Tavily Search | 无 Key 时返回 web_available=false | [待确认] |

> 禁止表述："AI 全自动装箱"、"AI 替代人工审核"、"实时联网国标检索"（无 Key 时不可用）[已验证]

---

## 17. 3D 作业（18 相位状态机，真实坐标驱动）

- 引擎：Three.js ^0.179.0（Web）+ threejs-miniprogram 0.0.8（小程序）[已验证]
- 场景：程序化构建（无 GLTF 模型加载）[已验证]
- 集装箱：118 可渲染部件（[createIndustrialContainer.js]）[已验证]
- 叉车：34 部件（[createIndustrialForklift.js]）[已验证]
- 人工 actor：可识别低多边形人形 + 4 关节四肢 [已验证]
- 状态机：18 相位（IDLE → OPENING_DOORS → ... → COMPLETED / PAUSED / BLOCKED）[已验证]
- 坐标系：x=长度，y=高度，z=宽度；门端在 x=innerLength [已验证]
- 路径：9 段（home→waiting→waitingLifted→staging→doorApproach→doorInside→insideAligned→targetHover→target）[已验证]
- 碰撞检测：AABB 分离轴定理，tolerance=2mm [已验证]
- 相机：4 预设（overview/door/top/side）+ follow 模式 [已验证]
- 性能：InstancedMesh 批量渲染已装货物 [已验证]
- 作业队列：按 x→y→z→loadingIndex 升序（深区优先、底层优先）[已验证]
- 倍速：0.5×/1×/2×/4×（Web），1/4/10/30（小程序）[已验证]

> 边界声明：这是真实坐标驱动的 3D 作业过程可视化，不是物理仿真，也不是工业级数字孪生（无实时数据回传、无双向控制）[已验证]

---

## 18. 合规预审（三层：本地规则+AI建议+人工复核）

- 架构："引擎算物理，AI 判合规"（[AIComplianceService.js:6]）[已验证]
- 本地规则：7 条红线 [已验证]
  1. 载重检查（totalWeight < maxWeight）
  2. 重心偏移（横向≤5% 纵向≤10%）
  3. LIFO 校验
  4. 单证一致性（hasConfirmedDocument）
  5. 危险品资质（UN38.3/MSDS/IMDG）
  6. 木包装 IPPC 标识
  7. 混装禁忌（食品/化工、液体/电子、危险品/普货）
- AI 角色：仅写建议文本，不判定 PASS/FAIL（v4.0 架构，零幻觉）[已验证]
- VGM：后端硬计算，相对误差≤5% 且绝对误差≤1 吨 [已验证]
- 法规库：4 份 JSON（CTU Code / GB 40163-2021 / JT/T 1187-2018 / SOLAS VGM），17 sections [已验证]
- RAG：RegulationRAGService TF-IDF 余弦相似度（零外部依赖）[已验证]
- Web RAG：WebRAGService 调 Tavily（无 Key 返回 web_available=false）[待确认]
- 降级：AI 失败时本地模板降级，不伪造 AI 结论 [已验证]
- 人工复核：MANUAL_REVIEW action 追加到 complianceHistory，不可静默覆盖 [已验证]
- 最终结论合并：finalConclusion 优先人工→本地规则 [已验证]

---

## 19. 报告交付（HTML/CSV/JSON）

- 格式：HTML / CSV / JSON / 打印 PDF（浏览器本地生成）[已验证]
- 生成位置：[web-dashboard/src/domain/report/reportBuilders.js] [已验证]
- HTML：自包含样式表，HTML 转义 [已验证]
- CSV：17 列 UTF-8 BOM [已验证]
- JSON：含 provenance + schemaVersion [已验证]
- 打印：[web-dashboard/src/services/downloads.js:16-29]（window.open + print）[已验证]
- 后端 PDF：[目标态]（当前无后端 PDF 生成，不得声称后端 PDF 导出）

---

## 20. 测试数据

### 后端测试 [已验证]
- 811 个测试（54 文件）
- 单元测试 27 文件 486 用例
- 集成测试 22 文件 251 用例
- 路演测试 1 文件 5 用例
- setup 测试 4 文件 69 用例
- fast-check 属性测试 5 文件 93 处
- 注意：部分依赖数据库/AI Key，不得声称"全部通过"

### Web 测试 [已验证]
- 21 个测试文件，90 个用例

### E2E 测试 [已验证]
- Playwright 多套（tools/codex_*.mjs / output/playwright/）

### 小程序测试 [已验证]
- 0 测试（package.json test=echo error）

### 演示订单结果 [已验证]
- NB2026-DEMO-01：221/221 件、84.51%、8,812 kg、本地规则 WARNING / AI建议 PASS / 人工复核独立

---

## 21. 创新点候选（5-8 个，基于代码证据）

1. **Fast Block多约束三维装箱引擎的六类业务约束协同机制确定性输出**：在 LIFO/重心/SKU聚集/堆叠安全/搬运可达/VGM 六个维度硬约束下确定性生成装箱方案（相同输入相同输出）。[已验证]
2. **"引擎算物理、AI 判合规"的零幻觉合规架构**：本地规则引擎判定 PASS/FAIL，DeepSeek V4 Flash 仅撰写建议文本，不判定结论，从架构上杜绝 AI 幻觉。[已验证]
3. **18 相位作业状态机与真实坐标驱动的 3D 装柜过程可视化**：程序化构建 118 部件集装箱+34 部件叉车+4 关节人工 actor，区分叉车与人工两种作业 actor，AABB 碰撞检测 tolerance=2mm。[已验证]
4. **基于 TF-IDF 余弦相似度的本地法规 RAG 检索（零外部依赖）**：4 份法规 JSON 17 sections，RegulationRAGService 本地检索，无需联网即可工作。[已验证]
5. **VGM 后端硬计算的合规闭环**：相对误差≤5% 且绝对误差≤1 吨的 VGM 验证，与 7 红线本地规则联动。[已验证]
6. **三层合规证据链（本地规则→AI建议→人工复核，不可静默覆盖）**：MANUAL_REVIEW action 追加到 complianceHistory，最终结论优先人工→本地规则。[已验证]
7. **多目的港 LIFO 卸货顺序硬约束**：FastBlock._checkLIFOHardConstraint 实现多目的港（演示订单 3 港）卸货顺序保证。[已验证]
8. **多策略融合装箱调度器（AlgorithmOrchestrator）**：6 个算法 ID 白名单，realistic4d-multi-strategy 多策略融合取最优。[已验证]

---

## 22. 应用价值（基于代码可推断的，不编造）

1. 为宁波港出口中小卖家提供港前装柜科学决策，替代人工经验装柜 [已验证]
2. 确定性算法保证相同输入相同输出，方案可复现、可审计 [已验证]
3. 3D 作业可视化直接指导仓库工人按序装柜，降低沟通成本 [已验证]
4. 三层合规预审在装柜前识别 VGM、重心、LIFO、危险品等风险，降低退港/查验布控概率 [已验证]
5. HTML/CSV/JSON 报告浏览器本地导出，无需后端存储，适合中小卖家轻量化部署 [已验证]
6. 多端覆盖（Web+小程序），适应办公室决策与仓库现场作业两种场景 [已验证]

> 不能声称：企业落地数量、部署量、营收、市场份额 [已验证]（NOT_FOUND）

---

## 23. 当前不足

1. **小程序 export 页面空壳**：[miniprogram/pages/export/export.js] 仅为 `Page({ data: {}, onLoad: function () {} })`，未实现报告导出 [已验证]
2. **无后端 PDF 生成**：当前仅支持浏览器打印 PDF，非后端 PDF 导出 [已验证]
3. **联网法规检索依赖 Key**：WebRAGService 调 Tavily 需 TAVILY_API_KEY，无 Key 时返回 web_available=false [已验证]
4. **Layered 算法未达标**：慈溪家电场景 LayeredPackingEngine 实际 39.06%，目标≥70% 未达标 [已验证]
5. **AI 服务依赖外部 Key**：DeepSeek/Qwen3-VL/seed-tts 均依赖外部 API Key，无 Key 时降级 [已验证]
6. **Web 与小程序主色不统一**：Web 墨绿 #246a56，小程序 #007AFF/#1976D2 双轨 [已验证]
7. **Web 与小程序倍速不一致**：Web 0.5/1/2/4×，小程序 1/4/10/30 [已验证]
8. **小程序缺人工 actor/7 维筛选**：3D 能力弱于 Web [已验证]
9. **后端 811 测试部分依赖数据库/AI Key**：无法全部运行，不得声称"全部通过" [已验证]
10. **港口动态后端返回硬编码 Mock**：/api/port/updates 为 Mock 数据 [已验证]
11. **数据库密码硬编码安全隐患**：[backend/scripts/migrate-add-fragile.js:18] 明文密码 [已验证]

---

## 24. 后续规划（目标态功能）

1. 小程序 export 页面实现报告导出 [目标态]
2. 后端 PDF 生成 [目标态]
3. 联网法规检索 Key 配置与实时检索 [目标态]
4. Layered 算法达标（≥70% 利用率）[目标态]
5. 第三阶段目标态：8-12 SKU/3 港/2 批次/连续三次全装入/16× 倍速/7 类筛选/PDF 联动 [目标态]
6. 法规 PDF 原文联动与页码高亮 [目标态]
7. Web 与小程序视觉统一 [目标态]
8. 实时数据回传与双向控制（工业级数字孪生）[目标态]
9. 企业落地与部署量验证 [目标态]

---

## 25. 团队分工所需材料

> 以下字段需申报人手工填写 [待确认]

- 团队名称：[待填写]
- 团队成员姓名：[待填写]
- 成员学号/工号：[待填写]
- 成员分工（如：前端/后端/算法/3D/合规/测试/文档）：[待填写]
- 指导教师：[待填写]
- 团队负责人：[待填写]
- 联系电话：[待填写]
- 邮箱：[待填写]

---

## 26. 可用图片和截图（output/playwright/ 下清单）

### baseline 截图 [已验证]
- output/playwright/baseline/screenshots/1280x720-{cargo,compliance,container,dashboard,report,twin}.png
- output/playwright/baseline/screenshots/1672x941-{cargo,compliance,container,dashboard,report,twin-侧视/俯视/总览/门端}.png
- output/playwright/baseline/screenshots/1920x1080-{cargo,compliance,container,dashboard,report,twin}.png

### core-e2e 截图 [已验证]
- output/playwright/core-e2e/twin-closed.png
- output/playwright/core-e2e/twin-doors-open.png
- output/playwright/core-e2e/twin-view-{侧视,俯视,总览,门端}.png

### final 截图 [已验证]
- output/playwright/final/{1280x720,1672x941,1920x1080}-{cargo,compliance,container,dashboard,report,twin-operation/twin-review/twin}.png
- output/playwright/final/twin-{door,overview,side,top}-doors-open.png

### stage2-3d 截图（3D 作业过程）[已验证]
- output/playwright/stage2-3d/01-overview.png ~ 10-group-expanded.png（含 forklift-pickup/entering/placed、blocked 等）

### stage3/three 截图（3D 作业详图）[已验证]
- output/playwright/stage3/three/01-overview.png ~ 17-blocked.png（含叉车/人工 actor 各阶段、filter、speed、group 等）

### three-motion 截图（运动轨迹）[已验证]
- output/playwright/three-motion/{cargo-entering-through-door,cargo-on-forks,cargo-placed-at-real-target,fork-lifting-current-cargo}.png

### ui-states 截图（UI 状态）[已验证]
- output/playwright/ui-states/{cargo-editor-drawer,cargo-empty-state,compliance-evidence-drawer,csv-preview-dialog-empty,packing-api-error-retry,packing-loading-disabled}.png

### 其他可用截图目录 [已验证]
- docs/advanced_open_design_web/screenshots/（3d-*、cargo/compliance/container/dashboard/report-before/after.png）
- docs/advanced_optimization/screenshots/after/（advanced-*）
- docs/design_reviews/product-redesign/screenshots/（1280-*/1672-*）
- docs/final_product_integration/screenshots/（final-*，含 e2e-end-state、report-export-downloads 等）

---

## 27. 推荐图表（Mermaid 图清单）

1. **系统架构图**（Web+后端+小程序+AI服务四层架构）[已验证]
2. **主链路流程图**（货物录入→...→报告导出 10 步）[已验证]
3. **装箱算法调度图**（AlgorithmOrchestrator→FastBlock/Realistic4D/多策略）[已验证]
4. **六类业务约束协同机制关系图**（LIFO/重心/SKU聚集/堆叠/搬运/VGM）[已验证]
5. **18 相位状态机图**（IDLE→OPENING_DOORS→...→COMPLETED/PAUSED/BLOCKED）[已验证]
6. **三层合规证据链图**（本地规则→AI建议→人工复核→finalConclusion）[已验证]
7. **3D 作业 9 段路径图**（home→waiting→...→target）[已验证]
8. **数据库 ER 图**（cargo/container_type/packing_plan/user 4 表）[已验证]
9. **AI 服务降级流程图**（DeepSeek/Qwen3-VL/seed-tts/Tavily 失败降级路径）[已验证]
10. **演示订单数据看板**（221输入/221装入/84.51%/8,812 kg/本地规则 WARNING / AI建议 PASS / 人工复核独立）[已验证]

---

## 28. 仍需 Deep Research 调查的外部事实

> 以下外部数据无法从仓库代码推断，必须通过 Deep Research 调查，不得编造 [待确认]

1. 宁波港出口中小卖家规模与数量 [待确认]
2. 宁波港出口集装箱吞吐量、40HQ 占比 [待确认]
3. 人工装柜导致的倒箱费、退港、查验布控经济损失数据 [待确认]
4. 港前装柜决策系统行业规模与市场容量 [待确认]
5. 竞品分析（3D 装柜软件、港口合规系统、装箱算法工具）[待确认]
6. 三维装箱问题（3D-BPP）学术研究现状与代表论文 [待确认]
7. 相关政策法规（SOLAS VGM、CTU Code、GB 40163-2021、JT/T 1187-2018 的最新修订）[待确认]
8. 宁波港出口主要货类结构（小家电/文具/汽配占比）[待确认]
9. 中小卖家装柜数字化转型政策支持 [待确认]
10. 装箱算法相关专利布局现状 [待确认]

---

## 29. 不能直接写入正式报告的未证实内容

> 以下内容在代码中无证据或与代码矛盾，禁止直接写入正式报告 [已验证]

1. ~~系统采用"Fast Block多约束三维装箱引擎"~~——实际是六类业务约束协同机制清单，非加权评分算法 [已验证]
2. ~~系统是工业级数字孪生~~——实际是真实坐标驱动的 3D 作业可视化，无实时回传/双向控制 [已验证]
3. ~~系统支持后端 PDF 导出~~——实际是浏览器打印 [已验证]
4. ~~系统支持实时联网国标检索~~——无 TAVILY_API_KEY 时不可用 [已验证]
5. ~~AI 全自动装箱~~——AI 仅写建议，算法是确定性的 [已验证]
6. 方案结果：221/221 件已规划装入、84.51% 利用率 [已验证]
7. 合规分层：本地规则 WARNING、AI建议 PASS、人工复核独立 [已验证]
8. ~~企业落地、部署量、营收~~——NOT_FOUND [已验证]
9. ~~全球首创、零风险、完全自动化~~——禁止表述 [已验证]
10. 输入与装入：221/221 件，未装 0 件 [已验证]
11. 输入总重与装入总重均为 8,812 kg [已验证]
12. ~~后端 811 测试全部通过~~——部分依赖数据库/AI Key，无法全部运行 [已验证]

---

> 本底稿所有 [已验证] 内容均基于 PROJECT_MASTER_FACTS.md（2026-07-11 调查基线）。撰写正式报告时，[待确认] 项需申报人决定，[目标态] 项需明确标注为规划中。外部数据必须经 Deep Research 调查后才能写入。
