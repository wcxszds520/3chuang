# 功能状态矩阵 (FEATURE_STATUS_MATRIX)

> 生成时间：2026-07-11
> 状态：VERIFIED（已验证）/ IMPLEMENTED_UNVERIFIED（已实现未验证）/ PARTIAL（部分实现）/ PLANNED（规划中）/ NOT_FOUND（未找到）

---

## 1. 主链路功能矩阵

| 功能 | Web | 移动端 | 后端 | 数据库 | 测试 | 状态 | 证据 | 缺口 |
|---|---|---|---|---|---|---|---|---|
| 货物录入 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | CargoPage.jsx / cargo.js / cargo 表 / cargo.test.js | - |
| SKU 管理（增删改查复制） | VERIFIED | PARTIAL | VERIFIED | VERIFIED | VERIFIED | VERIFIED | CargoPage 18 个 state / cargo.js CRUD | 小程序缺批量编辑 |
| CSV 导入导出 | VERIFIED | NOT_FOUND | NOT_FOUND | NOT_FOUND | VERIFIED | VERIFIED | csvImport.js / csvImport.test.js | 后端无 CSV 解析 |
| 柜型选择 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | ContainerPage / container.js / container_type 表 | - |
| 柜型推荐 | VERIFIED | PARTIAL | VERIFIED | NOT_FOUND | VERIFIED | VERIFIED | ContainerPage.recommendContainer / ai-packing.js /recommend-container | 后端不入库 |
| 后端装箱算法 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | packing.js / AlgorithmOrchestrator / FastBlock / packing_plan 表 / packing.test.js | - |
| 三维坐标方案 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | loadedCargo{x,y,z,l,h,w} / geometry.test.js | - |
| 3D 装柜作业（叉车） | VERIFIED | VERIFIED | NOT_FOUND | NOT_FOUND | VERIFIED | VERIFIED | TwinScene.jsx / operationMachine.js / ThreeRenderer.js | - |
| 3D 装柜作业（人工） | VERIFIED | NOT_FOUND | NOT_FOUND | NOT_FOUND | VERIFIED | VERIFIED | createManualWorker.js / operationMachine actorType=manual | 小程序缺人工 actor |
| 3D 视角切换 | VERIFIED | VERIFIED | NOT_FOUND | NOT_FOUND | VERIFIED | VERIFIED | cameraPresets.js 4 预设 | - |
| 3D 队列筛选 | VERIFIED | PARTIAL | NOT_FOUND | NOT_FOUND | VERIFIED | VERIFIED | operationFilters.js 7 维 | 小程序缺 7 维筛选 |
| 3D 倍速 | VERIFIED | VERIFIED | NOT_FOUND | NOT_FOUND | VERIFIED | VERIFIED | Web 0.5/1/2/4× / 小程序 1/4/10/30 | 倍速档位不一致 |
| 合规本地规则 | VERIFIED | NOT_FOUND | VERIFIED | NOT_FOUND | VERIFIED | VERIFIED | evaluate.js / AIComplianceService._buildLocalComplianceReport | - |
| AI 合规审核 | VERIFIED | NOT_FOUND | VERIFIED | NOT_FOUND | VERIFIED | IMPLEMENTED_UNVERIFIED | complianceApi.js / AIComplianceService v3.2 | 依赖 AI_API_KEY |
| 法规知识库 | VERIFIED | NOT_FOUND | VERIFIED | NOT_FOUND | VERIFIED | VERIFIED | complianceApi / RegulationRAGService / 4 JSON | - |
| 法规检索（本地） | VERIFIED | NOT_FOUND | VERIFIED | NOT_FOUND | VERIFIED | VERIFIED | RegulationRAGService TF-IDF | - |
| 法规检索（联网） | VERIFIED | NOT_FOUND | VERIFIED | NOT_FOUND | NOT_FOUND | IMPLEMENTED_UNVERIFIED | WebRAGService / Tavily | 依赖 TAVILY_API_KEY |
| 人工复核 | VERIFIED | NOT_FOUND | NOT_FOUND | NOT_FOUND | VERIFIED | VERIFIED | CompliancePage manualForm / MANUAL_REVIEW action | - |
| VLM 货物识别 | VERIFIED | NOT_FOUND | VERIFIED | NOT_FOUND | VERIFIED | IMPLEMENTED_UNVERIFIED | vlmApi.js / vlm.js / VLMCargoService | 依赖 SiliconFlow Key |
| 报告导出 HTML | VERIFIED | NOT_FOUND | NOT_FOUND | NOT_FOUND | VERIFIED | VERIFIED | reportBuilders.buildReportHtml | - |
| 报告导出 CSV | VERIFIED | NOT_FOUND | NOT_FOUND | NOT_FOUND | VERIFIED | VERIFIED | reportBuilders.buildCargoCsv | - |
| 报告导出 JSON | VERIFIED | NOT_FOUND | NOT_FOUND | NOT_FOUND | VERIFIED | VERIFIED | reportBuilders.serializeReportJson | - |
| 报告导出 PDF | VERIFIED | NOT_FOUND | NOT_FOUND | NOT_FOUND | NOT_FOUND | PARTIAL | printHtmlReport（浏览器打印） | 非后端 PDF |
| TTS 语音播报 | NOT_FOUND | NOT_FOUND | VERIFIED | NOT_FOUND | NOT_FOUND | IMPLEMENTED_UNVERIFIED | tts.js / VolcTtsService | 依赖火山引擎 Key |
| 港口动态 | VERIFIED | VERIFIED | PARTIAL | NOT_FOUND | NOT_FOUND | PARTIAL | dashboardApi / port.js / PortUpdateService（Mock） | 后端返回硬编码 Mock |
| Dashboard 概览 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | DashboardPage / dashboard.js 6 端点 | - |
| 多目的港 LIFO | VERIFIED | PARTIAL | VERIFIED | VERIFIED | VERIFIED | VERIFIED | demoDataset 3 港 / FastBlock._checkLIFOHardConstraint | - |
| 重心计算 | VERIFIED | PARTIAL | VERIFIED | VERIFIED | VERIFIED | VERIFIED | cog/cogOffset / _calculateCoG | - |
| 重心偏移警告 | VERIFIED | PARTIAL | VERIFIED | NOT_FOUND | VERIFIED | VERIFIED | NingboPortSafetyEngine 横向≤5% 纵向≤10% | - |
| 碰撞检测 | VERIFIED | PARTIAL | VERIFIED | NOT_FOUND | VERIFIED | VERIFIED | geometry.js AABB / Realistic4D placeCargoWithCollisionCheck | - |
| 会话持久化 | VERIFIED | VERIFIED | NOT_FOUND | NOT_FOUND | VERIFIED | VERIFIED | sessionStorage.js localStorage / store.js wx.setStorageSync | - |

## 2. Web 页面功能矩阵

| 页面 | 路由 | 核心功能 | 真实数据来源 | 状态 | 已有证据 | 缺失证据 |
|---|---|---|---|---|---|---|
| DashboardPage | /dashboard | 流程进度/风险/待办/历史方案 | session + fetchDashboardSnapshot | VERIFIED | DashboardPage.jsx + dashboardApi.js + 6 后端端点 | - |
| CargoPage | /cargo | SKU 全生命周期 + CSV + VLM | session.cargo | VERIFIED | CargoPage.jsx + 18 state + csvImport.js + vlmApi.js | E2E 覆盖页面交互 |
| ContainerPage | /container | 柜型选择 + 真实方案生成 | session + generatePackingPlan | VERIFIED | ContainerPage.jsx + packingApi.js + /api/packing/generate | - |
| TwinPage | /twin | 3D 作业过程复核 | activePlan（真实坐标） | VERIFIED | TwinPage.jsx + TwinScene.jsx + operationMachine.js | WebGL 场景未在 vitest 测试 |
| CompliancePage | /compliance | 三层合规 + 证据 Drawer | activePlan + session + AI/RAG | VERIFIED | CompliancePage.jsx + complianceApi.js + 4 后端端点 | AI 契约依赖外部 Key |
| ReportPage | /report | 4 章节 + 4 格式导出 | session + activePlan | VERIFIED | ReportPage.jsx + reportBuilders.js + downloads.js | 无后端报告存储 |

## 3. 移动端功能矩阵

| 功能 | 小程序状态 | Web 对应 | 差异 |
|---|---|---|---|
| 首页 | VERIFIED（硬编码拟真数据） | DashboardPage（真实后端） | 小程序用 mockData |
| 货物录入 | VERIFIED | CargoPage | 小程序缺 CSV/批量编辑 |
| 柜型选择 | VERIFIED | ContainerPage | 小程序有 aiScoreMap |
| 装箱结果 | VERIFIED | ContainerPage+TwinPage | 小程序 3D 深色背景 |
| 3D 查看 | VERIFIED（深色版 ThreeRenderer） | TwinScene.jsx | 小程序缺人工 actor/7 维筛选 |
| 合规查看 | PARTIAL | CompliancePage | 小程序缺三层架构 |
| 报告导出 | NOT_FOUND（export 空壳） | ReportPage | 小程序未实现导出 |
| 离线降级 | VERIFIED（precomputedPlan） | NOT_FOUND | 仅小程序有离线降级 |
| 港口动态 | VERIFIED（硬编码 mock） | DashboardPage | 小程序 port-dashboard 强制 mock |

## 4. 后端 API 功能矩阵

| 模块 | 端点数 | VERIFIED | IMPLEMENTED_UNVERIFIED | PARTIAL | NOT_FOUND |
|---|---|---|---|---|---|
| 系统 | 2 | 2 | 0 | 0 | 0 |
| 货物 | 6 | 6 | 0 | 0 | 0 |
| 柜型 | 1 | 1 | 0 | 0 | 0 |
| 装箱 | 5 | 5 | 0 | 0 | 0 |
| AI 装箱 | 11 | 4 | 6 | 1 | 0 |
| 港口 | 1 | 0 | 0 | 1 | 0 |
| 法规 | 5 | 4 | 1 | 0 | 0 |
| VLM | 2 | 1 | 1 | 0 | 0 |
| TTS | 2 | 1 | 1 | 0 | 0 |
| Dashboard | 6 | 6 | 0 | 0 | 0 |
| 未注册 | 1 | 0 | 0 | 0 | 1 |
| **合计** | **42** | **30** | **9** | **2** | **1** |

## 5. 测试覆盖矩阵

| 测试类型 | 文件数 | 用例数 | 状态 | 证据 |
|---|---|---|---|---|
| 后端单元测试 | 27 | 486 | VERIFIED | backend/__tests__/unit/ |
| 后端集成测试 | 22 | 251 | VERIFIED | backend/__tests__/integration/ |
| 后端路演测试 | 1 | 5 | VERIFIED | backend/__tests__/roadshow/ |
| 后端 setup 测试 | 4 | 69 | VERIFIED | backend/__tests__/setup/ |
| Web 单元测试 | 21 | 90 | VERIFIED | web-dashboard/src/**/*.test.js |
| Playwright E2E | 多套 | - | VERIFIED | tools/codex_*.mjs / output/playwright/ |
| fast-check 属性测试 | 5 文件 | 93 处 | VERIFIED | backend/__tests__/setup/ |
| 小程序测试 | 0 | 0 | NOT_FOUND | miniprogram/package.json test=echo error |
| 性能测试 | - | - | PARTIAL | backend/result-p2.txt（300330ms 超时） |

## 6. 算法功能矩阵

| 算法能力 | 状态 | 证据 |
|---|---|---|
| 确定性输出（相同输入相同结果） | VERIFIED | AlgorithmOrchestrator + seed |
| LIFO 多目的港 | VERIFIED | FastBlock._checkLIFOHardConstraint |
| 重心计算 | VERIFIED | _calculateCoG / calculateCoGOffset |
| 重心偏移警告 | VERIFIED | NingboPortSafetyEngine ≤5%/≤10% |
| 碰撞检测 | VERIFIED | Realistic4D placeCargoWithCollisionCheck |
| 旋转规则 | VERIFIED | getRotations / _chooseOrientation |
| 堆叠约束 | VERIFIED | maxStackLayers / checkStackingConstraints |
| 不可堆叠 | VERIFIED | stackable=false |
| 易碎品 | VERIFIED | fragile=true |
| 重货 | VERIFIED | heavy = weight>=20 |
| 木包装 | VERIFIED | wooden / packagingType=wooden/pallet |
| 未装货物原因 | VERIFIED | OVERSIZE / NO_CROSS_SECTION_CAPACITY / INSUFFICIENT_LENGTH |
| 缓存 | VERIFIED | ResultCache 5 分钟 TTL |
| 超限检测 | VERIFIED | _checkOversizeCargo → OVERSIZE 错误码 |
| 多策略融合 | VERIFIED | _executeMultiStrategy |
| 算法白名单 | VERIFIED | 6 个算法 ID |
| Fast Block多约束三维装箱引擎 | NOT_FOUND | 实际是 sixDimensionalConstraints 约束清单 |
| 90%+ 利用率 | PARTIAL | 慈溪家电 Layered 实际 39.06% 未达标 |

## 7. 3D 功能矩阵

| 3D 能力 | Web | 小程序 | 状态 |
|---|---|---|---|
| 程序化集装箱模型 | VERIFIED（118 部件） | VERIFIED | VERIFIED |
| 程序化叉车模型 | VERIFIED（34 部件） | VERIFIED | VERIFIED |
| 人工 actor | VERIFIED（4 关节） | NOT_FOUND | PARTIAL |
| 18 相位状态机 | VERIFIED | PARTIAL | VERIFIED |
| 9 段路径 | VERIFIED | NOT_FOUND | VERIFIED |
| AABB 碰撞检测 | VERIFIED | NOT_FOUND | VERIFIED |
| 4 相机预设 | VERIFIED | VERIFIED | VERIFIED |
| follow 跟随 | VERIFIED | NOT_FOUND | VERIFIED |
| 7 维队列筛选 | VERIFIED | NOT_FOUND | VERIFIED |
| 队列分组 | VERIFIED | NOT_FOUND | VERIFIED |
| 标签防重叠 | VERIFIED | NOT_FOUND | VERIFIED |
| 剖切模式 | VERIFIED | NOT_FOUND | VERIFIED |
| InstancedMesh 优化 | VERIFIED | NOT_FOUND | VERIFIED |
| 倍速 0.5/1/2/4× | VERIFIED | NOT_FOUND（1/4/10/30） | PARTIAL |
| 门开闭动画 | VERIFIED | VERIFIED | VERIFIED |
| 货物外观分类 | VERIFIED（7 种） | VERIFIED | VERIFIED |
| 实时数据回传 | NOT_FOUND | NOT_FOUND | NOT_FOUND |
| 双向控制 | NOT_FOUND | NOT_FOUND | NOT_FOUND |
| 物理仿真 | NOT_FOUND | NOT_FOUND | NOT_FOUND |

## 8. 合规功能矩阵

| 合规能力 | 状态 | 证据 |
|---|---|---|
| VGM 验证 | VERIFIED | 后端硬计算 ≤5% 且 ≤1 吨 |
| 载重检查 | VERIFIED | totalWeight < maxWeight |
| 重心偏移 | VERIFIED | 横向 ≤5% 纵向 ≤10% |
| LIFO 校验 | VERIFIED | _checkLIFOHardConstraint |
| 单证一致性 | VERIFIED | hasConfirmedDocument |
| 危险品资质 | VERIFIED | UN38.3/MSDS/IMDG 检查 |
| 木包装 IPPC | VERIFIED | wooden → IPPC 标识检查 |
| 混装禁忌 | VERIFIED | 食品/化工、液体/电子、危险品/普货 |
| CTU 60/50 规则 | VERIFIED | CTU Code ctu_code.json |
| 法规 PDF 原文联动 | NOT_FOUND | 无 PDF 阅读器 |
| 法规页码高亮 | NOT_FOUND | 无页码定位 |
| 联网法规检索 | IMPLEMENTED_UNVERIFIED | 依赖 TAVILY_API_KEY |
| AI 审计历史 | VERIFIED | complianceHistory 不可静默覆盖 |
| 人工复核 | VERIFIED | MANUAL_REVIEW action |
| 最终结论合并 | VERIFIED | finalConclusion 优先人工→本地规则 |
| 零幻觉防护 | VERIFIED | AI 仅写建议，不判定 PASS/FAIL |
