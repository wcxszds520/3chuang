# Web 端事实 (WEB_FACTS)

> 生成时间：2026-07-11
> Web 包名：`ningbo-port-digital-twin-web`（[web-dashboard/package.json:2](file:///d:/cixing/3chuang/web-dashboard/package.json#L2)）
> 状态分级：VERIFIED / IMPLEMENTED_UNVERIFIED / PARTIAL / PLANNED / NOT_FOUND

---

## 1. 技术栈

| 类别 | 技术 | 版本 | 证据 |
|---|---|---|---|
| 框架 | React | ^18.3.1 | [web-dashboard/package.json:15](file:///d:/cixing/3chuang/web-dashboard/package.json#L15) |
| 构建工具 | Vite | ^5.4.19 | package.json:26 |
| 3D 引擎 | Three.js | ^0.179.0 | package.json:17 |
| 图标 | lucide-react | ^0.468.0 | package.json:18 |
| 模块系统 | ES Module | - | package.json:5 |
| 测试 | Vitest | 2.1.9 | package.json:27 |
| Lint | ESLint | 8.57.1 | package.json:22 |
| 路由 | 自研 hash 路由 | - | [src/app/router.js](file:///d:/cixing/3chuang/web-dashboard/src/app/router.js)（useHashRouter） |

## 2. 六页面矩阵

| 页面 | 路由 | 目标 | 核心功能 | 真实数据来源 | API | 组件 | 状态 | 证据 | 缺口 |
|---|---|---|---|---|---|---|---|---|---|
| DashboardPage | /dashboard | 流程概览与风险监控 | 流程进度/风险卡片/待办/历史方案 | session + fetchDashboardSnapshot | dashboardApi（6 端点） | DashboardPage.jsx | VERIFIED | DashboardPage.jsx + dashboardApi.js + 6 后端端点 | orderTotal/taskTotal/reportTotal 无真实数据时返回 null |
| CargoPage | /cargo | 货物 SKU 全生命周期 | SKU 增删改查复制 + CSV 导入导出 + VLM 识别 | session.cargo | packingApi / vlmApi | CargoPage.jsx（18 state） | VERIFIED | CargoPage.jsx + csvImport.js + vlmApi.js | E2E 覆盖页面交互 |
| ContainerPage | /container | 柜型选择与方案生成 | 柜型推荐 + 真实装箱方案生成 | session + generatePackingPlan | packingApi（AUTHORITATIVE_ALGORITHM_ID='fast-block'） | ContainerPage.jsx | VERIFIED | ContainerPage.jsx + packingApi.js + /api/packing/generate | - |
| TwinPage | /twin | 3D 装柜作业复核 | 3D 可视化 + 叉车/人工作业动画 + 视角切换 + 队列筛选 + 倍速 | activePlan（真实坐标） | - | TwinScene.jsx + scene/(5) + operation/(2) + presentation/(4) | VERIFIED | TwinPage.jsx + TwinScene.jsx + operationMachine.js | WebGL 场景未在 vitest 测试 |
| CompliancePage | /compliance | 三层合规审核 | 本地规则 + AI 审计 + 人工复核 + 证据 Drawer | activePlan + session + AI/RAG | complianceApi（4 端点） | CompliancePage.jsx + manualForm | VERIFIED | CompliancePage.jsx + complianceApi.js + 4 后端端点 | AI 契约依赖外部 Key |
| ReportPage | /report | 报告导出 | 4 章节 + 4 格式导出（HTML/CSV/JSON/PDF） | session + activePlan | downloads | ReportPage.jsx + reportBuilders.js | VERIFIED | ReportPage.jsx + reportBuilders.js + downloads.js | 无后端报告存储；PDF 为浏览器打印 |

## 3. 状态管理

| 项 | 值 | 证据 |
|---|---|---|
| 方案 | useReducer + localStorage | [src/domain/session/](file:///d:/cixing/3chuang/web-dashboard/src/domain/session/) |
| 存储 Key | `yonggui.web.session.v2` | sessionStorage.js |
| Schema 版本 | 2 | SESSION_SCHEMA_VERSION=2 |
| Actions 数 | 16 | SESSION_ACTIONS |
| invalidateComputed | 货物/柜型变更时清空 backendPlan/AI/人工证据 | session reducer |

### 3.1 关键不变量

- 货物或柜型变更 → `invalidateComputed` 清空 `backendPlan` / AI 证据 / 人工证据（防止脏数据复用）
- `complianceHistory` 不可静默覆盖（追加模式）
- `finalConclusion` 优先级：人工 → 本地规则

## 4. API 客户端

| 客户端 | 职责 | 关键常量 | 证据 |
|---|---|---|---|
| apiClient | 统一 fetch 封装 + AbortController 超时 | - | [src/api/apiClient.js](file:///d:/cixing/3chuang/web-dashboard/src/api/apiClient.js) |
| packingApi | 装箱相关 | `AUTHORITATIVE_ALGORITHM_ID='fast-block'` | [src/api/packingApi.js](file:///d:/cixing/3chuang/web-dashboard/src/api/packingApi.js) |
| complianceApi | 合规相关（4 函数） | - | [src/api/complianceApi.js](file:///d:/cixing/3chuang/web-dashboard/src/api/complianceApi.js) |
| dashboardApi | 看板相关 | - | [src/api/dashboardApi.js](file:///d:/cixing/3chuang/web-dashboard/src/api/dashboardApi.js) |
| vlmApi | VLM 货物识别 | - | [src/api/vlmApi.js](file:///d:/cixing/3chuang/web-dashboard/src/api/vlmApi.js) |
| downloads | 报告下载 | - | [src/api/downloads.js](file:///d:/cixing/3chuang/web-dashboard/src/api/downloads.js) |

### 4.1 合规 API 函数

| 函数 | 方法 + 路径 | 用途 |
|---|---|---|
| runAiComplianceAudit | POST /api/packing/compliance-check-sync | 同步触发 AI 合规审核 |
| fetchRegulationList | GET /api/compliance/regulations | 法规列表 |
| fetchRegulationDetail | GET /api/compliance/regulation/:docId | 法规详情 |
| searchRegulations | POST /api/compliance/hybrid-search | 混合检索 |

## 5. 3D 模块

| 模块 | 文件数 | 职责 | 证据 |
|---|---|---|---|
| TwinScene.jsx | 1 | 3D 场景入口 | [src/three/TwinScene.jsx](file:///d:/cixing/3chuang/web-dashboard/src/three/TwinScene.jsx) |
| scene/ | 5 | 场景构建（相机/灯光/几何/材质/渲染循环） | src/three/scene/ |
| operation/ | 2 | 作业状态机（operationMachine.js 18 相位 + actor） | src/three/operation/ |
| presentation/ | 4 | 演示视角/动画 | src/three/presentation/ |

### 5.1 作业状态机

- 18 相位作业状态机
- 支持 actorType：`forklift`（叉车）/ `manual`（人工）
- 证据：[src/three/operation/operationMachine.js](file:///d:/cixing/3chuang/web-dashboard/src/three/operation/operationMachine.js)

### 5.2 视角与筛选

- 4 个相机预设（cameraPresets.js：总览/门端/侧视/俯视）
- 7 维队列筛选（operationFilters.js）
- 倍速：0.5 / 1 / 2 / 4×

## 6. 设计令牌

| 令牌 | 值 | 用途 |
|---|---|---|
| --ink | #18231f | 主文字色 |
| --green | #246a56 | 主品牌色 |
| --orange | #b95832 | 强调/警示色 |
| --radius | 10px | 圆角基准 |

## 7. 域模型

| 域 | 文件数 | 职责 |
|---|---|---|
| cargo | 7 | 货物域模型 |
| compliance | 1 | 合规域模型 |
| container | 2 | 柜型域模型 |
| presentation | 2 | 演示域模型 |
| report | 1 | 报告域模型 |
| session | 1 | 会话域模型 |

## 8. 演示数据

| 项 | 值 | 证据 |
|---|---|---|
| 数据集 | demoDataset.js | [src/.../demoDataset.js](file:///d:/cixing/3chuang/web-dashboard/src/) |
| SKU 数 | 10 | demoDataset.js |
| 港序 | 3（宁波→汉堡→鹿特丹→安特卫普） | demoDataset.js |
| 订单号 | NB2026-DEMO-01 | demoDataset.js |

## 9. CSV 导入

| 项 | 值 | 证据 |
|---|---|---|
| 表头映射 | 中英文 23 字段 | csvImport.js |
| 测试 | csvImport.test.js | VERIFIED |

## 10. UI 组件

| 组件 | 职责 | 证据 |
|---|---|---|
| FeedbackProvider | toast 通知 | src/components/ |
| Overlays | Dialog / Drawer / ConfirmDialog（焦点陷阱） | src/components/ |

## 11. 报告导出

| 格式 | 构建函数 | 证据 |
|---|---|---|
| HTML | buildReportHtml | [src/domain/report/reportBuilders.js](file:///d:/cixing/3chuang/web-dashboard/src/domain/report/reportBuilders.js) |
| CSV | buildCargoCsv | reportBuilders.js |
| JSON | serializeReportJson | reportBuilders.js |
| PDF | printHtmlReport（浏览器打印，非后端 PDF） | reportBuilders.js |

## 12. 测试（VERIFIED）

| 项 | 值 | 证据 |
|---|---|---|
| 测试框架 | Vitest（node 环境） | package.json:27 |
| 测试文件数 | 21 | web-dashboard/src/**/*.test.js |
| 用例数 | 90 | - |

## 13. 与后端/移动端的差异

| 项 | Web | 移动端 | 差异 |
|---|---|---|---|
| CSV 导入导出 | VERIFIED | NOT_FOUND | 小程序无 CSV |
| 3D 作业（人工） | VERIFIED | NOT_FOUND | 小程序缺人工 actor |
| 3D 队列筛选 | 7 维 | PARTIAL | 小程序缺 7 维筛选 |
| 3D 倍速 | 0.5/1/2/4× | 1/4/10/30 | 档位不一致 |
| 柜型推荐 | VERIFIED | PARTIAL | 小程序简化 |
| 重心偏移警告 | VERIFIED | PARTIAL | 小程序简化 |
| 碰撞检测 | VERIFIED | PARTIAL | 小程序简化 |
| 会话持久化 | localStorage | wx.setStorageSync | 存储机制不同 |

## 14. 申报材料中不得编造的内容

> ⚠️ 以下内容在代码中**无证据**，申报材料中**不得编造**：

| 项 | 状态 | 说明 |
|---|---|---|
| 真实企业部署量 | NOT_FOUND | 无生产部署证据 |
| WebGL 场景自动化测试 | NOT_FOUND | vitest 不覆盖 WebGL |
| 后端报告存储 | NOT_FOUND | 报告仅前端导出 |
| AI 合规生产准确率 | NOT_FOUND | 依赖外部 Key，无生产统计 |

## 15. 相关文档

- [04-backend/BACKEND_FACTS.md](../04-backend/BACKEND_FACTS.md) —— 后端事实与 41 端点
- [07-compliance-ai/COMPLIANCE_FACTS.md](../07-compliance-ai/COMPLIANCE_FACTS.md) —— 合规事实总览
- [01-project-facts/FEATURE_STATUS_MATRIX.md](../01-project-facts/FEATURE_STATUS_MATRIX.md) —— 功能状态矩阵
