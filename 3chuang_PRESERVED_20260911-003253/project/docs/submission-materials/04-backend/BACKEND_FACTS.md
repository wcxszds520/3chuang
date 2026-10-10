# 后端事实 (BACKEND_FACTS)

> 生成时间：2026-07-11
> 后端包名：`ningbo-port-packing-backend`（[backend/package.json:2](file:///d:/cixing/3chuang/backend/package.json#L2)）
> 状态分级：VERIFIED / IMPLEMENTED_UNVERIFIED / PARTIAL / PLANNED / NOT_FOUND

---

## 1. 技术栈

| 类别 | 技术 | 版本 | 证据 |
|---|---|---|---|
| 运行时 | Node.js | - | [backend/package.json](file:///d:/cixing/3chuang/backend/package.json) |
| Web 框架 | Express | ^4.18.2 | package.json:26 |
| 数据库驱动 | MySQL2 | ^3.6.0 | package.json:27 |
| HTTP 客户端 | axios | ^1.13.5 | package.json:22 |
| WebSocket | ws | ^8.21.0 | package.json:29（仅客户端连火山 TTS，无服务端 WS） |
| UUID | uuid | ^9.0.1 | package.json:28 |
| 测试 | Jest | ^29.7.0 | package.json:35 |
| Lint | ESLint | ^8.57.0 | package.json:32 |

## 2. 服务基本信息

| 项 | 值 | 证据 |
|---|---|---|
| 监听端口 | 3000 | [backend/server.js](file:///d:/cixing/3chuang/backend/server.js) |
| API 前缀 | `/api` | [backend/routes/index.js:53-61](file:///d:/cixing/3chuang/backend/routes/index.js#L53) |
| 统一响应包络 | `{code, message, data, ts}` | res.success / res.error 中间件 |
| 路由模块数 | 9（cargo/container/packing/ai-packing/port/compliance/vlm/tts/dashboard） | routes/index.js |
| API 端点总数 | 41（40 注册 + 1 未注册历史） | 见 §3 |

## 3. 完整 API 清单（41 端点）

> 统一前缀 `/api`；除 `/api/port/updates` 直接返回数组外，其余均使用 `{code,message,data,ts}` 包络。

### 3.1 根与健康检查（2）

| # | 方法 | 路径 | 说明 | 证据 |
|---|---|---|---|---|
| 1 | GET | `/api/` | API 基本信息 | routes/index.js:28 |
| 2 | GET | `/api/health` | 健康检查 | routes/index.js:15 |

### 3.2 货物 cargo（6）

| # | 方法 | 路径 | 说明 | 证据 |
|---|---|---|---|---|
| 3 | POST | `/api/cargo/create` | 创建货物 | routes/cargo.js:32 |
| 4 | GET | `/api/cargo/list` | 货物列表 | routes/cargo.js:142 |
| 5 | PUT | `/api/cargo/update/:cargoId` | 更新货物 | routes/cargo.js:214 |
| 6 | DELETE | `/api/cargo/delete/:cargoId` | 删除单个货物 | routes/cargo.js:338 |
| 7 | DELETE | `/api/cargo/clear` | 清空货物 | routes/cargo.js:374 |
| 8 | POST | `/api/cargo/import-template` | 导入模板 | routes/cargo.js:420 |

### 3.3 柜型 container（1）

| # | 方法 | 路径 | 说明 | 证据 |
|---|---|---|---|---|
| 9 | GET | `/api/container/list` | 柜型列表 | routes/container.js:40 |

### 3.4 装箱 packing（5）

| # | 方法 | 路径 | 说明 | 证据 |
|---|---|---|---|---|
| 10 | POST | `/api/packing/generate` | 生成装箱方案（核心算法） | routes/packing.js:43 |
| 11 | POST | `/api/packing/compliance-check` | 异步合规检查 | routes/packing.js:379 |
| 12 | GET | `/api/packing/compliance-report/:taskId` | 查询合规任务结果 | routes/packing.js:453 |
| 13 | GET | `/api/packing/health/compliance` | 合规服务健康 | routes/packing.js:508 |
| 14 | POST | `/api/packing/compliance-check-sync` | 同步合规检查（前端 `runAiComplianceAudit`） | routes/packing.js:543 |

### 3.5 AI 装箱 ai-packing（11）

| # | 方法 | 路径 | 说明 | 证据 |
|---|---|---|---|---|
| 15 | POST | `/api/ai-packing/generate` | 生成方案（始终用 DemoFallbackService，demoMode:true） | routes/ai-packing.js:47 |
| 16 | POST | `/api/ai-packing/validate-compliance` | 合规校验 | routes/ai-packing.js:199 |
| 17 | POST | `/api/ai-packing/recognize-cargo` | 货物识别 | routes/ai-packing.js:266 |
| 18 | POST | `/api/ai-packing/generate-presentation` | 生成演示稿 | routes/ai-packing.js:295 |
| 19 | POST | `/api/ai-packing/compare` | 方案对比 | routes/ai-packing.js:356 |
| 20 | POST | `/api/ai-packing/recommend-container` | 柜型推荐（v37.1 起纯算法不调 AI） | routes/ai-packing.js:485 |
| 21 | POST | `/api/ai-packing/explain-result` | 结果解释 | routes/ai-packing.js:628 |
| 22 | POST | `/api/ai-packing/generate-strategy` | 策略生成 | routes/ai-packing.js:659 |
| 23 | GET | `/api/ai-packing/demo/preset-plan` | 预录方案 | routes/ai-packing.js:698 |
| 24 | GET | `/api/ai-packing/demo/preset-compliance` | 预录合规 | routes/ai-packing.js:716 |
| 25 | GET | `/api/ai-packing/demo/preset-presentation` | 预录演示 | routes/ai-packing.js:732 |

### 3.6 港口 port（1）

| # | 方法 | 路径 | 说明 | 证据 |
|---|---|---|---|---|
| 26 | GET | `/api/port/updates` | 港口动态（**直接返回数组，非统一包络**） | routes/port.js:16 |

### 3.7 合规 compliance（5）

| # | 方法 | 路径 | 说明 | 证据 |
|---|---|---|---|---|
| 27 | GET | `/api/compliance/regulations` | 法规列表（前端 `fetchRegulationList`） | routes/compliance.js:32 |
| 28 | GET | `/api/compliance/regulation/:docId` | 法规详情（前端 `fetchRegulationDetail`） | routes/compliance.js:55 |
| 29 | POST | `/api/compliance/search` | 本地法规检索 | routes/compliance.js:82 |
| 30 | POST | `/api/compliance/web-search` | 联网法规检索 | routes/compliance.js:120 |
| 31 | POST | `/api/compliance/hybrid-search` | 混合检索（前端 `searchRegulations`） | routes/compliance.js:146 |

### 3.8 视觉识别 vlm（2）

| # | 方法 | 路径 | 说明 | 证据 |
|---|---|---|---|---|
| 32 | POST | `/api/vlm/recognize-cargo` | VLM 货物识别 | routes/vlm.js:20 |
| 33 | GET | `/api/vlm/status` | VLM 服务状态 | routes/vlm.js:84 |

### 3.9 语音 tts（2）

| # | 方法 | 路径 | 说明 | 证据 |
|---|---|---|---|---|
| 34 | POST | `/api/tts/synthesize` | 语音合成 | routes/tts.js:24 |
| 35 | GET | `/api/tts/status` | TTS 服务状态 | routes/tts.js:84 |

### 3.10 看板 dashboard（6）

| # | 方法 | 路径 | 说明 | 证据 |
|---|---|---|---|---|
| 36 | GET | `/api/dashboard/summary` | 概览摘要 | routes/dashboard.js:41 |
| 37 | GET | `/api/dashboard/priority-task` | 优先任务 | routes/dashboard.js:107 |
| 38 | GET | `/api/dashboard/queues` | 队列状态 | routes/dashboard.js:193 |
| 39 | GET | `/api/dashboard/recent-tasks` | 最近任务 | routes/dashboard.js:242 |
| 40 | GET | `/api/dashboard/risks` | 风险列表 | routes/dashboard.js:289 |
| 41 | GET | `/api/dashboard/port-situation` | 港口态势 | routes/dashboard.js:331 |

### 3.11 未注册历史端点（1，NOT_FOUND 状态）

| # | 方法 | 路径 | 说明 | 证据 |
|---|---|---|---|---|
| — | POST | `/api/packing/generate`（v33.0-FINAL） | 历史版本装箱路由，**未在 index.js 注册** | routes/packing-v33.0-FINAL.js:18 |

> 该文件为历史遗留，未通过 `router.use` 挂载，运行时不可达。

## 4. 统一响应包络

```json
{
  "code": 0,
  "message": "成功",
  "data": { },
  "ts": 1720000000000
}
```

- 成功：`code=0`
- 失败：`code` 为错误码字符串，HTTP 状态码按 errorCodes 映射
- 例外：`/api/port/updates` 直接返回数组（非包络）

## 5. 错误码清单

证据：[backend/config/errorCodes.js](file:///d:/cixing/3chuang/backend/config/errorCodes.js)

| 错误码 | HTTP | 含义 |
|---|---|---|
| INVALID_INPUT | 400 | 输入校验失败 |
| UNKNOWN_FIELDS | 400 | 请求包含未知字段 |
| PAYLOAD_TOO_LARGE | 413 | 请求体超过大小限制 |
| OVERSIZE | 422 | 货物超限 |
| UNKNOWN_ALGORITHM | 422 | 非白名单算法 ID |
| SCHEMA_INVALID | 422 | JSON Schema 校验失败 |
| OUT_OF_SCOPE | 422 | AI 问答超出上下文范围 |
| TIMEOUT | 408 | 计算超时 |
| RATE_LIMITED | 429 | 超过调用频率限制 |
| BLOCKING | 503 | 回归用例失败，发布阻断 |
| PREVENTIVE_BLOCK | 503 | 回归用例未执行，预防性阻断 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| DATABASE_ERROR | 500 | 数据库操作失败 |
| AI_SERVICE_ERROR | 502 | AI 服务调用失败 |

> 用户事实记为 13 个，实际 errorCodes.js 定义 14 个（含 AI_SERVICE_ERROR）。核心错误码 INVALID_INPUT/OVERSIZE/UNKNOWN_ALGORITHM/TIMEOUT/BLOCKING 均已覆盖。

## 6. 数据库（4 张表）

证据：[backend/config/init.sql](file:///d:/cixing/3chuang/backend/config/init.sql)

| 表名 | 主键 | 说明 | 证据 |
|---|---|---|---|
| cargo | cargo_id VARCHAR(50) | 货物表 | init.sql:14 |
| container_type | type_id VARCHAR(20) | 柜型表 | init.sql:44 |
| packing_plan | plan_id VARCHAR(50) | 装箱方案表 | init.sql:65 |
| user | user_id VARCHAR(50) | 用户表 | init.sql:85 |

## 7. 服务层清单

| 服务 | 职责 | 证据 |
|---|---|---|
| AlgorithmOrchestrator | 装箱算法编排（FastBlock 等） | [backend/services/AlgorithmOrchestrator.js](file:///d:/cixing/3chuang/backend/services/AlgorithmOrchestrator.js) |
| AIComplianceService | AI 合规审核（v3.2，"引擎算物理，AI 判合规"） | [backend/services/AIComplianceService.js:6](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L6) |
| RegulationRAGService | 本地法规检索（TF-IDF 余弦相似度，零外部依赖） | [backend/services/RegulationRAGService.js](file:///d:/cixing/3chuang/backend/services/RegulationRAGService.js) |
| WebRAGService | 联网法规检索（Tavily，无 Key 返回 web_available=false） | [backend/services/WebRAGService.js](file:///d:/cixing/3chuang/backend/services/WebRAGService.js) |
| NingboPortComplianceChecker | 港口合规检查（JT/T 1187-2018 + GB 16994.4-2023） | [backend/services/NingboPortComplianceChecker.js](file:///d:/cixing/3chuang/backend/services/NingboPortComplianceChecker.js) |
| NingboPortSafetyEngine | 安全引擎 v25.0（横向≤5%/纵向≤10%/28000kg/重货压易碎） | [backend/services/NingboPortSafetyEngine.js](file:///d:/cixing/3chuang/backend/services/NingboPortSafetyEngine.js) |
| ComplianceTaskManager | 异步任务管理（crypto.randomUUID，30s 超时） | [backend/services/ComplianceTaskManager.js](file:///d:/cixing/3chuang/backend/services/ComplianceTaskManager.js) |
| PortUpdateService | 港口动态（硬编码 4 条模拟情报） | [backend/services/PortUpdateService.js](file:///d:/cixing/3chuang/backend/services/PortUpdateService.js) |
| DemoFallbackService | 演示降级（预设方案，shouldUseRoadshowMode 始终 false） | [backend/services/DemoFallbackService.js](file:///d:/cixing/3chuang/backend/services/DemoFallbackService.js) |
| VLMCargoService | VLM 货物识别（依赖 SiliconFlow Key） | [backend/services/VLMCargoService.js](file:///d:/cixing/3chuang/backend/services/VLMCargoService.js) |
| VolcTtsService | 火山引擎 TTS | [backend/services/VolcTtsService.js](file:///d:/cixing/3chuang/backend/services/VolcTtsService.js) |

## 8. Mock 与 Fallback 清单

| 来源 | 类型 | 说明 | 证据 |
|---|---|---|---|
| PortUpdateService | 硬编码 Mock | 4 条模拟港口情报 | PortUpdateService.js |
| DemoFallbackService | 预设方案 | `shouldUseRoadshowMode` 始终返回 false | DemoFallbackService.js |
| roadshow-perfect-plan.js | 硬编码 | 1350 件，87.3% 利用率 | backend/scripts 或 services |
| `/api/port/updates` | 直接返回数组 | 非统一包络 | routes/port.js:16 |
| `/api/ai-packing/generate` | 始终用 DemoFallbackService | demoMode:true | routes/ai-packing.js:47 |
| `/api/ai-packing/recommend-container` | v37.1 起纯算法 | 不调 AI | routes/ai-packing.js:485 |

## 9. Dashboard 严格不编造原则（VERIFIED）

| 字段 | 行为 | 证据 |
|---|---|---|
| orderTotal | 显式返回 `null` + reason | routes/dashboard.js |
| taskTotal | 显式返回 `null` + reason | routes/dashboard.js |
| reportTotal | 显式返回 `null` + reason | routes/dashboard.js |

> Dashboard 端点在无真实数据时**不编造数字**，显式返回 `null` 并附 `reason` 字段说明原因。

## 10. WebSocket 说明（VERIFIED）

- `ws` 依赖仅用于**客户端连接火山引擎 TTS 服务**
- 后端**无服务端 WebSocket**（不向前端推送 WS 消息）
- 证据：package.json:29（ws 依赖）、[backend/services/VolcTtsService.js](file:///d:/cixing/3chuang/backend/services/VolcTtsService.js)

## 11. AI 降级链与重试

| 项 | 值 | 证据 |
|---|---|---|
| callAIWithRetry 单次超时 | 5 秒 | AIComplianceService.js |
| 重试次数 | 2 次 | v3.2 |
| 无 API_KEY 降级 | 本地模板（`_buildLocalComplianceReport`） | AIComplianceService |
| API_ERROR 降级 | 物理数据增强降级 | v3.2 |
| PARSE_ERROR 降级 | 降级到本地规则结论 | AIComplianceService |

> 详见 [07-compliance-ai/COMPLIANCE_FACTS.md](../07-compliance-ai/COMPLIANCE_FACTS.md)

## 12. 合规模块关键事实

> 完整合规事实见 [07-compliance-ai/COMPLIANCE_FACTS.md](../07-compliance-ai/COMPLIANCE_FACTS.md)

- 架构："引擎算物理，AI 判合规"（AIComplianceService.js:6）
- 版本：v3.2.0（High Availability Upgrade）
- systemPrompt："宁波港 20 年资深理货长"（AIComplianceService.js:49）
- reportTable 6 维度（VGM/载重/重心/单证/危险品/混装）
- VGM 硬计算：相对误差≤5% 且绝对误差≤1吨（AIComplianceService.js:519-533）
- 法规库 4 份 JSON、17 sections
- 7 条红线（载重/重心/LIFO/单证/危险品/木包装/混装）
- AI 仅写建议文本，不判定 PASS/FAIL（v4.0 零幻觉架构）

## 13. 测试覆盖（VERIFIED）

| 测试文件 | 覆盖点 |
|---|---|
| backend/__tests__/unit/ai-recommend-container.test.js | AI 柜型推荐策略 |
| backend/__tests__/unit/ai-semantic-cache-offline.test.js | 语义缓存离线降级 |
| backend/__tests__/unit/ai-strategy-explain.test.js | AI 策略解释 |
