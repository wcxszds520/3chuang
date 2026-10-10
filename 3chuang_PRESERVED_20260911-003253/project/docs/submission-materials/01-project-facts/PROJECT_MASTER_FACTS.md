# 甬柜易算 项目主事实文件 (PROJECT_MASTER_FACTS)

> 生成时间：2026-07-11
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`（单 commit 仓库）
> 调查方式：只读代码核验 + 文档交叉核对 + Git 内部日志读取
> 状态分级：VERIFIED / IMPLEMENTED_UNVERIFIED / PARTIAL / PLANNED / NOT_FOUND

---

## 1. 项目标准名称

- **中文标准名称**：甬柜易算
- **英文/技术名称**：Ningbo Port Intelligent 3D Packing System
- **后端包名**：`ningbo-port-packing-backend`（[backend/package.json:2](file:///d:/cixing/3chuang/backend/package.json#L2)）
- **Web 包名**：`ningbo-port-digital-twin-web`（[web-dashboard/package.json:2](file:///d:/cixing/3chuang/web-dashboard/package.json#L2)）
- **小程序描述**：甬柜易算 - 物流装箱算法小程序（[miniprogram/package.json:4](file:///d:/cixing/3chuang/miniprogram/package.json#L4)）
- **微信 AppID**：`wx3e4ac8267481ad58`（[miniprogram/project.config.json](file:///d:/cixing/3chuang/miniprogram/project.config.json)）
- **项目代号（内部）**：3chuang / yonggui / yonggui-yisuan

## 2. 项目定位

**甬柜易算** 是一个面向宁波港出口中小卖家的港前装柜智能决策系统，覆盖"货物录入 → 柜型推荐 → 真实装箱算法 → 3D 装柜作业复核 → 港前合规预审 → 多格式报告交付"的完整闭环。

- 核心价值：用确定性装箱算法 + 本地合规规则替代人工经验装柜，降低倒箱费、退港、查验布控风险
- 业务定位：港前（Pre-Port）装柜决策，非港口内作业调度
- 不属于：港口 TOS、码头作业系统、运输路线规划、报关单证系统

## 3. 目标用户

| 用户 | 使用场景 | 证据 |
|---|---|---|
| 宁波港出口中小卖家 | 录入 SKU → 选柜 → 生成装柜方案 → 合规预审 → 导出装柜图纸给仓库 | [backend/config/templates.js](file:///d:/cixing/3chuang/backend/config/templates.js)（慈溪小家电/宁波文具/宁波汽配 3 套货型模板） |
| 货代/理货长 | 复核装柜方案、VGM 验证、合规审核 | [backend/services/AIComplianceService.js:49](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L49)（systemPrompt 设定"宁波港 20 年资深理货长"角色） |
| 仓库工人/叉车工 | 依据 3D 作业蓝图按序装柜 | [web-dashboard/src/three/operation/operationMachine.js](file:///d:/cixing/3chuang/web-dashboard/src/three/operation/operationMachine.js)（18 相位作业状态机） |

> 注意：当前仓库中不存在真实企业落地、部署量、营业收入、市场份额等证据（NOT_FOUND）。不得在申报材料中编造上述内容。

## 4. 使用场景

### 4.1 主链路（VERIFIED）

```
货物录入 → SKU 管理 → 柜型选择/推荐 → 后端装箱算法 → 三维坐标方案 → 3D 装柜作业 → 合规预审 → AI 解释 → 人工复核 → 报告导出
```

证据链：
1. 货物录入：[web-dashboard/src/pages/workflows/CargoPage.jsx](file:///d:/cixing/3chuang/web-dashboard/src/pages/workflows/CargoPage.jsx)
2. 柜型选择：[web-dashboard/src/pages/workflows/ContainerPage.jsx](file:///d:/cixing/3chuang/web-dashboard/src/pages/workflows/ContainerPage.jsx)
3. 后端算法：[backend/routes/packing.js:43-369](file:///d:/cixing/3chuang/backend/routes/packing.js#L43) → [backend/services/AlgorithmOrchestrator.js](file:///d:/cixing/3chuang/backend/services/AlgorithmOrchestrator.js)
4. 3D 作业：[web-dashboard/src/pages/workflows/TwinPage.jsx](file:///d:/cixing/3chuang/web-dashboard/src/pages/workflows/TwinPage.jsx) → [web-dashboard/src/three/TwinScene.jsx](file:///d:/cixing/3chuang/web-dashboard/src/three/TwinScene.jsx)
5. 合规预审：[web-dashboard/src/pages/workflows/CompliancePage.jsx](file:///d:/cixing/3chuang/web-dashboard/src/pages/workflows/CompliancePage.jsx) → [backend/services/AIComplianceService.js](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js)
6. 报告导出：[web-dashboard/src/pages/workflows/ReportPage.jsx](file:///d:/cixing/3chuang/web-dashboard/src/pages/workflows/ReportPage.jsx) → [web-dashboard/src/domain/report/reportBuilders.js](file:///d:/cixing/3chuang/web-dashboard/src/domain/report/reportBuilders.js)

### 4.2 典型演示订单（VERIFIED）

- 订单号：`NB2026-DEMO-01` 或 `NB2026-DEMO-01`
- 航线：宁波 → 汉堡 → 鹿特丹 → 安特卫普
- 柜型：40HQ（12032×2352×2698mm，限重 26000kg）
- 输入：221 件 / 10 SKU
- 装入：221 件
- 未装：0 件
- 空间利用率：84.51%
- 总重：8,812 kg
- 合规：本地规则 WARNING / AI建议 PASS / 人工复核独立
- 证据：[docs/final_product_integration/REAL_DATA_CONSISTENCY_REPORT.md](file:///d:/cixing/3chuang/docs/final_product_integration/REAL_DATA_CONSISTENCY_REPORT.md)、[output/playwright/core-e2e/results.json](file:///d:/cixing/3chuang/output/playwright/core-e2e/results.json)

## 5. 技术栈

### 5.1 Web 端（VERIFIED）

| 类别 | 技术 | 版本 | 证据 |
|---|---|---|---|
| 框架 | React | ^18.3.1 | [web-dashboard/package.json:15](file:///d:/cixing/3chuang/web-dashboard/package.json#L15) |
| 构建工具 | Vite | ^5.4.19 | [web-dashboard/package.json:26](file:///d:/cixing/3chuang/web-dashboard/package.json#L26) |
| 3D 引擎 | Three.js | ^0.179.0 | [web-dashboard/package.json:17](file:///d:/cixing/3chuang/web-dashboard/package.json#L17) |
| 图标 | lucide-react | ^0.468.0 | [web-dashboard/package.json:18](file:///d:/cixing/3chuang/web-dashboard/package.json#L18) |
| 模块系统 | ES Module | - | [web-dashboard/package.json:5](file:///d:/cixing/3chuang/web-dashboard/package.json#L5) |
| 测试 | Vitest | 2.1.9 | [web-dashboard/package.json:27](file:///d:/cixing/3chuang/web-dashboard/package.json#L27) |
| Lint | ESLint | 8.57.1 | [web-dashboard/package.json:22](file:///d:/cixing/3chuang/web-dashboard/package.json#L22) |
| 路由 | 自研 hash 路由 | - | [web-dashboard/src/app/router.js](file:///d:/cixing/3chuang/web-dashboard/src/app/router.js) |
| 状态管理 | useReducer + localStorage | - | [web-dashboard/src/app/session/SessionProvider.jsx](file:///d:/cixing/3chuang/web-dashboard/src/app/session/SessionProvider.jsx) |
| TypeScript | 未使用 | - | NOT_FOUND |
| UI 库 | 未使用第三方 | - | 自研组件 |

### 5.2 后端（VERIFIED）

| 类别 | 技术 | 版本 | 证据 |
|---|---|---|---|
| 运行时 | Node.js | - | [backend/package.json](file:///d:/cixing/3chuang/backend/package.json) |
| Web 框架 | Express | ^4.18.2 | [backend/package.json:25](file:///d:/cixing/3chuang/backend/package.json#L25) |
| 数据库驱动 | mysql2 | ^3.6.0 | [backend/package.json:27](file:///d:/cixing/3chuang/backend/package.json#L27) |
| HTTP 客户端 | axios | ^1.13.5 | [backend/package.json:22](file:///d:/cixing/3chuang/backend/package.json#L22) |
| WebSocket | ws | ^8.21.0 | [backend/package.json:29](file:///d:/cixing/3chuang/backend/package.json#L29)（仅作客户端连火山 TTS） |
| 测试 | Jest | ^29.7.0 | [backend/package.json:34](file:///d:/cixing/3chuang/backend/package.json#L34) |
| 属性测试 | fast-check | ^4.5.3 | [backend/package.json:33](file:///d:/cixing/3chuang/backend/package.json#L33) |
| HTTP 测试 | supertest | ^6.3.3 | [backend/package.json:36](file:///d:/cixing/3chuang/backend/package.json#L36) |
| Lint | ESLint | ^8.57.0 | [backend/package.json:32](file:///d:/cixing/3chuang/backend/package.json#L32) |

### 5.3 移动端（VERIFIED）

| 类别 | 技术 | 证据 |
|---|---|---|
| 平台 | 微信小程序（原生，非 Taro/Uni-app） | [miniprogram/app.json](file:///d:/cixing/3chuang/miniprogram/app.json) |
| 3D 引擎 | threejs-miniprogram ^0.0.8 | [miniprogram/package.json:7](file:///d:/cixing/3chuang/miniprogram/package.json#L7) |
| 基础库 | ≥ 2.30.0 | [miniprogram/app.js](file:///d:/cixing/3chuang/miniprogram/app.js) |
| iOS App | NOT_FOUND | 仓库中无 Xcode 工程 |
| Android App | NOT_FOUND | 仓库中无 Android Studio 工程 |
| H5 | NOT_FOUND | 无独立 H5 工程 |

### 5.4 外部 AI 服务（IMPLEMENTED_UNVERIFIED）

| 服务 | 提供方 | 用途 | 证据 |
|---|---|---|---|
| DeepSeek V4 Flash | 硅基流动 | 合规审核、策略建议、结果解释 | [backend/services/AIComplianceService.js:41](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L41) |
| Qwen3-VL-32B-Instruct | 硅基流动 | 货物图片识别 | [backend/services/VLMCargoService.js](file:///d:/cixing/3chuang/backend/services/VLMCargoService.js) |
| seed-tts-2.0 | 火山引擎豆包 | 语音合成 | [backend/services/VolcTtsService.js](file:///d:/cixing/3chuang/backend/services/VolcTtsService.js) |
| Tavily Search | Tavily | 联网法规检索 | [backend/services/WebRAGService.js](file:///d:/cixing/3chuang/backend/services/WebRAGService.js) |

> 所有 AI 服务均有本地降级机制，无 API Key 或调用失败时不伪造成功。

## 6. 客户端清单

| 客户端 | 形态 | 当前状态 | 入口 |
|---|---|---|---|
| Web Dashboard | React SPA | VERIFIED | [web-dashboard/src/main.jsx](file:///d:/cixing/3chuang/web-dashboard/src/main.jsx) |
| 微信小程序 | 原生小程序 | VERIFIED（5 页面，但 export 页面是空壳） | [miniprogram/app.js](file:///d:/cixing/3chuang/miniprogram/app.js) |
| Android App | - | NOT_FOUND | - |
| iOS App | - | NOT_FOUND | - |
| H5 | - | NOT_FOUND | - |

## 7. 后端

- 入口：[backend/server.js](file:///d:/cixing/3chuang/backend/server.js)（端口 3000）
- 路由聚合：[backend/routes/index.js](file:///d:/cixing/3chuang/backend/routes/index.js)
- API 前缀：`/api`
- 已注册路由模块：cargo / container / packing / ai-packing / port / compliance / vlm / tts / dashboard
- 未注册历史路由：`packing-v33.0-FINAL.js`（NOT_FOUND，文件存在但未挂载）
- 真实 API 端点数：41 个（含 1 个未注册）
- 详见：[04-backend/BACKEND_FACTS.md](../04-backend/BACKEND_FACTS.md)

## 8. 装箱算法

| 算法 ID | 引擎类 | 用途 | 状态 |
|---|---|---|---|
| `fast-block` | FastBlockPackingEngine | 大批量路演数据集，确定性块优先 | VERIFIED（生产主力） |
| `realistic4d` | Realistic4DPackingEngine v34.7 | Y 轴地面优先 + LIFO + Z-Lane 屏障 | VERIFIED |
| `realistic4d-multi-strategy` | AlgorithmOrchestrator | 多策略融合取最优 | VERIFIED（默认） |
| `realistic4d-weight-first` / `volume-first` / `mixed` | Realistic4DPackingEngine 排序变体 | 不同排序策略 | IMPLEMENTED_UNVERIFIED |
| DBLFPackingEngine v26.2 | 历史版本 | 极点回溯 + 重心平衡 | NOT_FOUND（未在生产路由调用，仅测试） |
| Realistic4DPackingEngine v33.0-FINAL | 历史版本 | 40mm 网格步长 | NOT_FOUND（未注册路由） |
| PackingEngine | 基础 FFD+BLB | 传统对比基线 | IMPLEMENTED_UNVERIFIED（仅 ai-packing/compare 调用） |
| LayeredPackingEngine | 分层装载 | 慈溪家电救场 | PARTIAL（目标 ≥70%，实际 39.06% 未达标） |
| MaximalRectanglesEngine | 最大矩形 | BSSF/BLSF/BAF 启发式 | IMPLEMENTED_UNVERIFIED |
| OptimizedPackingEngine | Guillotine + MaxRect + AI 调优 | 目标 92%+ | IMPLEMENTED_UNVERIFIED |
| ShippingTimePackingEngine | 出货时间驱动 | 多目的港 LIFO | IMPLEMENTED_UNVERIFIED |

### 关于"Fast Block多约束三维装箱引擎"的澄清（重要）

**代码中不存在"Fast Block多约束三维装箱引擎"。** 仓库中出现的 `sixDimensionalConstraints`（[backend/services/FastBlockPackingEngine.js:613](file:///d:/cixing/3chuang/backend/services/FastBlockPackingEngine.js#L613)）是 FastBlock 引擎在 `constraintMeta` 输出中列出的**六个约束维度清单**，不是加权评分算法。六个维度为：

1. LIFO unloading order（LIFO 卸货顺序）
2. dynamic center-of-gravity（动态重心）
3. same-SKU clustering（同 SKU 聚集）
4. stacking and heavy-on-light safety（堆叠与重不压轻安全）
5. forklift/manual handling reachability（叉车/人工搬运可达性）
6. VGM/gross-weight compliance（VGM/总重合规）

**正确表述**：系统使用 Fast Block多约束三维装箱引擎，在约束元数据中声明遵守上述六个维度的硬约束。**不得表述为"Fast Block多约束三维装箱引擎"或"六维评分算法"。**

详见：[05-algorithm/ALGORITHM_FACTS.md](../05-algorithm/ALGORITHM_FACTS.md)

## 9. 3D 数字孪生

- 引擎：Three.js ^0.179.0（Web）+ threejs-miniprogram 0.0.8（小程序）
- 场景：程序化构建（无 GLTF 模型加载）
- 集装箱：118 可渲染部件（[web-dashboard/src/three/scene/createIndustrialContainer.js](file:///d:/cixing/3chuang/web-dashboard/src/three/scene/createIndustrialContainer.js)）
- 叉车：34 部件（[web-dashboard/src/three/scene/createIndustrialForklift.js](file:///d:/cixing/3chuang/web-dashboard/src/three/scene/createIndustrialForklift.js)）
- 人工 actor：可识别低多边形人形 + 4 关节四肢
- 状态机：18 相位（IDLE → OPENING_DOORS → ... → COMPLETED / PAUSED / BLOCKED）
- 坐标系：x=长度，y=高度，z=宽度；门端在 x=innerLength（高 X 端）
- 路径：9 段（home → waiting → waitingLifted → staging → doorApproach → doorInside → insideAligned → targetHover → target）
- 碰撞检测：AABB 分离轴定理，tolerance=2mm
- 相机：4 预设（overview/door/top/side）+ follow 模式
- 性能：InstancedMesh 批量渲染已装货物
- 作业队列：按 x→y→z→loadingIndex 升序（深区优先、底层优先）
- 倍速：0.5×/1×/2×/4×（Web），1/4/10/30（小程序）

**边界声明**：这是**真实坐标驱动的 3D 作业过程可视化**，不是物理仿真，也不是工业级数字孪生（无实时数据回传、无双向控制）。不得表述为"工业数字孪生"或"物理仿真"。

详见：[06-three-d/THREE_D_FACTS.md](../06-three-d/THREE_D_FACTS.md)

## 10. 合规

- 架构："引擎算物理，AI 判合规"（[backend/services/AIComplianceService.js:6](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L6)）
- 本地规则：7 条红线（载重/重心/LIFO/单证/危险品/木包装/混装禁忌）
- AI 角色：仅写建议文本，不判定 PASS/FAIL（v4.0 架构，零幻觉）
- VGM：后端硬计算，相对误差 ≤5% 且绝对误差 ≤1 吨
- 法规库：4 份 JSON（CTU Code / GB 40163-2021 / JT/T 1187-2018 / SOLAS VGM），17 sections
- RAG：RegulationRAGService TF-IDF 余弦相似度（零外部依赖）
- Web RAG：WebRAGService 调 Tavily（无 Key 返回 web_available=false）
- 降级：AI 失败时本地模板降级，不伪造 AI 结论
- 人工复核：MANUAL_REVIEW action 追加到 complianceHistory，不可静默覆盖

详见：[07-compliance-ai/COMPLIANCE_FACTS.md](../07-compliance-ai/COMPLIANCE_FACTS.md)

## 11. AI 服务边界

| AI 能力 | 真实实现 | 边界 |
|---|---|---|
| 合规审核 | DeepSeek V4 Flash 写建议文本 | 本地规则判 PASS/FAIL，AI 不判定 |
| 箱型推荐 | 纯算法决策（v37.1 起不调 AI） | VERIFIED |
| 策略建议 | AI 生成，失败本地降级 | IMPLEMENTED_UNVERIFIED |
| 结果解释 | AI 生成，失败本地降级 | IMPLEMENTED_UNVERIFIED |
| 货物识别 | Qwen3-VL-32B 视觉模型 | 不可用时返回 null，前端手动录入 |
| 语音合成 | 火山引擎 seed-tts-2.0 | 不可用时前端降级 Web Speech |
| 联网法规检索 | Tavily Search | 无 Key 时返回 web_available=false |

**禁止表述**："AI 全自动装箱"、"AI 替代人工审核"、"实时联网国标检索"（无 Key 时不可用）。

## 12. 数据库

- 类型：MySQL（mysql2 Promise 连接池）
- 默认库名：`ningbo_port_packing`
- 表：4 张（cargo / container_type / packing_plan / user）
- 字符集：utf8mb4_unicode_ci
- 建表脚本：[backend/config/init.sql](file:///d:/cixing/3chuang/backend/config/init.sql)
- 迁移：add-fragile-field.sql（fragile 字段）、add-shipping-time-fields.sql（eta/port_sequence/cy_closing/customs_declaration）
- 初始柜型：20GP / 40GP / 40HQ
- 安全隐患：[backend/scripts/migrate-add-fragile.js:18](file:///d:/cixing/3chuang/backend/scripts/migrate-add-fragile.js#L18) 硬编码数据库密码（不得提交到公开仓库）

## 13. 报告导出

- 格式：HTML / CSV / JSON / 打印 PDF（浏览器本地生成）
- 生成位置：[web-dashboard/src/domain/report/reportBuilders.js](file:///d:/cixing/3chuang/web-dashboard/src/domain/report/reportBuilders.js)
- HTML：自包含样式表，HTML 转义
- CSV：17 列 UTF-8 BOM
- JSON：含 provenance + schemaVersion
- 打印：[web-dashboard/src/services/downloads.js:16-29](file:///d:/cixing/3chuang/web-dashboard/src/services/downloads.js#L16)（window.open + print）
- 后端 PDF：NOT_FOUND（无后端 PDF 生成，不得声称后端 PDF 导出）
- 演示订单导出大小：HTML 3635 bytes / CSV 742 bytes / JSON 4084 bytes

## 14. 当前完成度总览

| 维度 | 完成度 | 状态 |
|---|---|---|
| Web 端 6 页面 | 100% 代码完整 | VERIFIED |
| 后端 41 API 端点 | 40 个已注册，1 个未注册历史 | VERIFIED |
| 装箱算法 | FastBlock + Realistic4D 生产可用 | VERIFIED |
| 3D 作业可视化 | 18 相位状态机 + 真实坐标驱动 | VERIFIED |
| 合规预审 | 本地规则 + AI 建议 + 人工复核 | VERIFIED |
| 报告导出 | HTML/CSV/JSON/打印 | VERIFIED |
| 微信小程序 | 5 页面（export 空壳） | PARTIAL |
| 后端测试 | 811 个测试（54 文件） | VERIFIED |
| Web 测试 | 21 个测试文件，90 个用例 | VERIFIED |
| E2E 测试 | Playwright 多套 | VERIFIED |
| AI 服务 | 依赖外部 API Key，有降级 | IMPLEMENTED_UNVERIFIED |
| 数据库 | 4 表，MySQL 连接池 | VERIFIED |
| 真实企业落地 | - | NOT_FOUND |
| 部署量/营收 | - | NOT_FOUND |

## 15. 真实边界（重要）

### 可以声称的事实

1. 系统由真实后端算法（FastBlock/Realistic4D）生成装箱方案
2. 系统支持多目的港 LIFO 卸货顺序
3. 系统支持叉车和人工两种作业 actor 的 3D 可视化
4. 系统支持本地确定性规则 + AI 建议 + 人工复核三层合规
5. 系统支持 HTML/CSV/JSON 三种报告格式浏览器本地导出
6. 演示订单 NB2026-DEMO-01 真实装入 221/221 件，利用率 84.51%，合规 本地规则 WARNING / AI建议 PASS / 人工复核独立

### 不能声称的事实

1. ~~系统采用"Fast Block多约束三维装箱引擎"~~（实际是六类业务约束协同机制清单）
2. ~~系统是工业级数字孪生~~（实际是真实坐标驱动的 3D 作业可视化）
3. ~~系统支持后端 PDF 导出~~（实际是浏览器打印）
4. ~~系统支持实时联网国标检索~~（无 TAVILY_API_KEY 时不可用）
5. ~~AI 全自动装箱~~（AI 仅写建议，算法是确定性的）
6. 方案结果统一表述为：221/221 件已规划装入，空间利用率 84.51%。
7. 合规状态统一分层表述为：本地规则 WARNING、AI建议 PASS、人工复核独立。
8. ~~企业落地、部署量、营收~~（NOT_FOUND）
9. ~~全球首创、零风险、完全自动化~~（禁止表述）

## 16. 证据位置索引

| 证据类型 | 位置 |
|---|---|
| 源代码 | d:\cixing\3chuang\backend\ / d:\cixing\3chuang\web-dashboard\src\ / d:\cixing\3chuang\miniprogram\ |
| 测试 | backend/__tests__/ / web-dashboard/src/**/*.test.js |
| 截图 | output/playwright/ / docs/design_reviews/ / docs/final_product_integration/screenshots/ |
| 运行日志 | output/runtime/backend.stdout.log |
| API 响应样本 | output/playwright/stage3/algorithm/response-{1,2,3}.json |
| 演示数据 | backend/config/demo-cargo-templates.js / web-dashboard/src/domain/cargo/demoDataset.js |
| 法规数据 | backend/data/regulations/*.json |
| 设计规范 | docs/frontend_glm52_redesign/02_YONGGUI_WEB_DESIGN_SYSTEM.md |
| 3D 作业规范 | docs/codex/THREE_D_OPERATION_SPEC.md |
| 验收报告 | docs/codex/FINAL_ACCEPTANCE.md / docs/final_product_integration/ |
| Kiro 规格 | .kiro/specs/（28 个 spec） |
| PPT 项目 | ppt-master/projects/yonggui_yisuan_guosai_* |

---

> 本文件是所有申报材料的统一事实基准。任何与本文档矛盾的宣传表述都应以本文件为准，或显式标注为"目标态"。
