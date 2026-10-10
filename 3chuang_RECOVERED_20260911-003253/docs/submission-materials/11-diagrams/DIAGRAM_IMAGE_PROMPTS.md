# 图像生成提示词（逐图独立）

> 生成时间：2026-07-11
> 文件用途：为后续 AI 图像生成工具提供逐图独立的提示词，每个提示词不依赖上下文即可理解。
> 约束：所有提示词仅涉及仓库中已确认的模块，目标态功能必须用虚线或"目标态"标记，不得新增虚构技术。

---

## 通用要求（适用于全部 12 张图）

- 比例：16:9 横版（架构/流程/路线图类）或 A4 竖版（状态机/证据链类），各图单独标注。
- 语言：中文标题与中文模块名。
- 风格：扁平化技术示意图，配色克制，模块用圆角矩形，数据库用圆柱体，外部服务用云形。
- 色彩语义：绿色 = 已实现；橙色 = 目标态；红色 = 阻断/异常；蓝色 = 客户端；紫色 = AI 服务。
- 箭头：实线 = 已实现链路；虚线 = 目标态链路。
- 安全区域：四周留 8% 边距，标题区上方留 5% 空白，便于后期叠加文字与 Logo。
- 禁止：不得新增仓库中不存在的模块、技术栈、服务名。

---

## 1. 系统总体架构图（SYSTEM_ARCHITECTURE）

- 比例：16:9 横版
- 中文标题：甬柜易算 系统总体架构图
- 模块名称（必须全部出现）：
  - 客户端层：Web 前端（React18 + Vite + Three.js，端口 5173）、微信小程序（原生框架，export 页面标记"目标态"）
  - 后端服务层：Express API（端口 3000）、业务 Service 层、装箱算法层（FastBlock / Realistic4D v34.7 / AlgorithmOrchestrator）、LayeredPackingEngine（利用率 39.06%，目标态 ≥70%）
  - 数据层：MySQL 4 表（cargo / container_type / packing_plan / user，端口 3306）
  - AI 服务群：DeepSeek、Qwen-VL、Tavily（目标态稳定可用）、火山 TTS
  - 法规知识库：4 法规 JSON 17 sections、TF-IDF RAG、法规 PDF 原文联动（目标态）
  - 报告生成：浏览器本地 HTML/CSV/JSON、后端 PDF 导出（目标态）
- 箭头关系：Web/小程序 → Express API → Service → 算法/DB/AI/RAG/报告；RAG → 法规 JSON；RAG 虚线 → PDF；Service 虚线 → 后端 PDF
- 禁止：不得出现 Docker、Kubernetes、Nginx、Redis 等仓库未确认组件

---

## 2. Web、移动端、后端和 AI 关系图（CLIENT_BACKEND_AI_RELATION）

- 比例：16:9 横版
- 中文标题：客户端·后端·AI 服务关系图
- 模块名称：Web 前端、微信小程序、Express REST 网关（端口 3000）、业务编排 Service、DeepSeek、Qwen-VL、Tavily（目标态稳定）、火山 TTS
- 箭头关系：Web/小程序 → REST 网关 → Service；Service → 四类 AI 服务；AI 服务虚线回写 Service；Service → Web（方案/合规/报告）；Service 虚线 → 小程序 export（目标态）
- 禁止：不得出现 GraphQL、gRPC、消息队列等未确认技术

---

## 3. 业务流程图（BUSINESS_FLOW）

- 比例：A4 竖版
- 中文标题：甬柜易算 业务主链路流程图
- 节点（顺序）：用户登录 → 货物录入 → SKU 管理（10 SKU，目标态 8-12）→ 柜型选择 → 后端装箱算法（FastBlock/Orchestrator）→ 3D 坐标方案 → 3D 装柜作业（18 相位/118 部件/34 部件/actor）→ 合规预审（三层/7 红线/4 JSON 17 sections）→ AI 解释（DeepSeek）→ 人工复核 → 报告导出（HTML/CSV/JSON）
- 目标态虚线标注：8-12 SKU、≥3 港 2 批次、LPE ≥70%、16× 倍速、连续三次全装入、PDF 联动、联网检索稳定、后端 PDF、小程序 export
- 禁止：不得新增支付、物流追踪、海关申报等未确认环节

---

## 4. 装箱算法流程图（ALGORITHM_FLOW）

- 比例：16:9 横版
- 中文标题：装箱算法处理流程图
- 节点：输入（SKU + 柜型）→ 解析属性 → 排序 → AlgorithmOrchestrator 调度 → 分支（FastBlock 块优先 / Realistic4D v34.7 / LayeredPackingEngine 39.06%）→ 块切片 → 空间填充 → 重心校验 → LIFO 校验 → 生成 3D 坐标 → 输出（坐标序列+利用率+重心+LIFO 报告）
- 目标态虚线：LPE ≥70%、连续三次全装入
- 禁止：不得出现遗传算法、强化学习等未确认算法

---

## 5. 数据流图（DATA_FLOW）

- 比例：16:9 横版
- 中文标题：系统数据流图
- 模块：前端 session → REST 端点（/cargo /container /packing /compliance /report）→ Service → MySQL（4 表）→ 装箱算法 → AI 服务（DeepSeek/Qwen-VL/TTS/Tavily）→ 响应 → 3D 装柜作业 / 合规预审 / 报告导出
- 目标态虚线：后端 PDF 导出、小程序 export 数据、Tavily 稳定可用
- 禁止：不得出现 Kafka、ElasticSearch、Redis 等未确认中间件

---

## 6. 3D 作业状态机图（THREE_D_STATE_MACHINE）

- 比例：A4 竖版
- 中文标题：3D 装柜作业 18 相位状态机
- 状态（全部）：IDLE → INIT_SCENE → LOAD_CONTAINER（118 部件）→ LOAD_FORKLIFT（34 部件）→ LOAD_WORKER（actor）→ OPENING_DOORS → POSITIONING → PICKING → TRANSPORTING → PLACING → STACKING → NEXT_ITEM → CLOSING_DOORS → FINAL_CHECK → COMPLETED；分支：PAUSED、BLOCKED
- 目标态标注：16× 倍速（当前 4×）、连续三次 loaded=total unloaded=0
- 禁止：不得新增未确认的状态相位

---

## 7. 合规证据链流程图（COMPLIANCE_EVIDENCE_FLOW）

- 比例：A4 竖版
- 中文标题：合规预审三层证据链流程图
- 节点：装柜方案+货物属性 → 第一层本地规则（7 红线 + 4 法规 JSON 17 sections + TF-IDF RAG）→ 命中红线？→ 阻断 / 第二层 AI 建议（DeepSeek + Tavily）→ 第三层人工复核 → 通过=PASS / 退回=FAIL
- 目标态虚线：法规 PDF 原文联动、Tavily 稳定可用
- 禁止：不得出现区块链存证、电子签章等未确认能力

---

## 8. 报告生成流程图（REPORT_GENERATION_FLOW）

- 比例：16:9 横版
- 中文标题：报告生成流程图
- 节点：前端 session → buildReportModel → 报告数据模型 → 分支（HTML / CSV / JSON / 浏览器打印）→ 下载文件
- 目标态虚线：后端 PDF 导出、小程序 export 页面
- 禁止：不得出现 Word、Excel 服务端生成等未确认能力

---

## 9. 用户角色与使用流程图（USER_ROLE_FLOW）

- 比例：16:9 横版
- 中文标题：用户角色与使用流程图
- 角色：中小卖家（宁波外贸）、货代（操作员）、仓库工人（现场作业）
- 功能触达：货物录入、柜型选择、3D 方案查看、合规预审、AI 解释、人工复核、报告导出、3D 作业指引
- 目标态虚线：小程序 export（卖家）、后端 PDF（货代）、16× 倍速（工人）
- 禁止：不得新增海关员、船公司等未确认角色

---

## 10. 项目技术路线图（TECH_ROADMAP）

- 比例：16:9 横版
- 中文标题：甬柜易算 技术路线图（当前态已实现）
- 分区：前端层（React18/Vite/Three.js/18 相位/118+34 部件/buildReportModel/7 维筛选）、后端层（Express 3000/MySQL 4 表/FastBlock/Realistic4D v34.7/Orchestrator/LPE）、合规层（三层/7 红线/4 JSON/RAG）、AI 服务（DeepSeek/Qwen-VL/TTS/Tavily）、小程序（原生/方案查看）、测试（811+/90+/E2E）、演示（NB2026-DEMO-01）
- 约束：本图仅含已实现模块，不出现目标态
- 禁止：不得出现未确认的云服务或框架

---

## 11. 当前态与目标态路线图（CURRENT_TARGET_ROADMAP）

- 比例：16:9 横版
- 中文标题：当前态与目标态对照路线图
- 左侧当前态（绿色实线）：10 SKU、3 港 1 批次、221/221 件、4× 倍速、7 维筛选、PDF 联动 NOT_FOUND、小程序 export 空壳、仅浏览器打印、依赖 API Key、LPE 39.06%、三套主色
- 右侧目标态（橙色虚线）：8-12 SKU、≥3 港 2 批次、连续三次全装入、16× 倍速、7 类筛选增强、PDF 原文联动、export 实现、后端 PDF、稳定可用、LPE ≥70%、主色统一
- 箭头：当前态虚线指向对应目标态
- 禁止：不得新增当前态与目标态之外的能力项

---

## 12. 部署架构图（DEPLOYMENT_ARCHITECTURE）

- 比例：16:9 横版
- 中文标题：甬柜易算 部署架构图
- 模块：浏览器（Web Vite 5173）、微信客户端（小程序）、应用服务器（Express 3000）、数据库服务器（MySQL 3306）、外部 AI 服务（DeepSeek/Qwen-VL/Tavily/火山 TTS）、浏览器本地（下载/打印）
- 端口标注：5173、3000、3306
- 目标态虚线：PDF 生成服务、小程序 export
- 禁止：不得出现 Nginx、Docker、CDN、负载均衡等未确认部署组件
