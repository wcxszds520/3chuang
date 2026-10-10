# 合规事实总览 (COMPLIANCE_FACTS)

> 生成时间：2026-07-11
> 适用版本：v3.2.0（High Availability Upgrade，路演级超时优化）
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`
> 状态分级：VERIFIED / IMPLEMENTED_UNVERIFIED / PARTIAL / PLANNED / NOT_FOUND

---

## 1. 顶层架构

**核心信条："引擎算物理，AI 判合规"**

- 证据：[backend/services/AIComplianceService.js:6](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L6)
- 含义：
  - 后端确定性引擎负责所有"物理可计算"指标（VGM 重量、载重、重心坐标、LIFO 顺序、碰撞 AABB）
  - AI 仅负责把"已计算出的物理事实 + 法规知识库"翻译成人类可读的合规建议文本
  - AI 不参与 PASS/FAIL 的最终判定（详见 [AI_ROLE_AND_BOUNDARY.md](./AI_ROLE_AND_BOUNDARY.md)）

### 1.1 版本演进

| 版本 | 代号 | 关键能力 | 证据 |
|---|---|---|---|
| v3.0 | 6 维度合规 | 强制数据校验、6 维度检查、一票否决红线、CTU 60/50 规则 | AIComplianceService.js:23-29 |
| v3.1 | Zero-Fail Logic | 木质包装 IPPC、混装禁忌、风险等级矩阵、行业数据锚定 | AIComplianceService.js:16-22 |
| v3.2.0 | High Availability | 5 秒超时+1 次重试、物理数据增强降级、智能预热、全链路日志 | AIComplianceService.js:10-15 |
| v4.0（架构目标） | 零幻觉 | AI 仅写建议文本，不判定 PASS/FAIL | 当前 v3.2 已落地该边界 |

## 2. 合规判定三层架构

前端 `CompliancePage` 采用三层防御纵深（VERIFIED）：

| 层级 | 名称 | 执行者 | 输出 | 证据 |
|---|---|---|---|---|
| L1 | 本地规则 | 后端 `evaluate.js` / `AIComplianceService._buildLocalComplianceReport` | 7 条红线的 PASS/WARNING/FAIL | [backend/services/AIComplianceService.js](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js) |
| L2 | AI 合规审计 | `AIComplianceService` 调硅基流动大模型 | 6 维度建议文本（不判定 PASS/FAIL） | AIComplianceService.js systemPrompt |
| L3 | 人工复核 | 前端 `CompliancePage.manualForm` + `MANUAL_REVIEW` action | 人工结论 + 备注 | [web-dashboard/src/pages/workflows/CompliancePage.jsx](file:///d:/cixing/3chuang/web-dashboard/src/pages/workflows/CompliancePage.jsx) |

**最终结论优先级**（VERIFIED）：

```
finalConclusion = 人工复核结论 ?? 本地规则结论
```

- 人工复核结论最高优先
- AI 审计结果仅作为"建议"展示，不进入 `finalConclusion` 链
- `complianceHistory` 不可静默覆盖（每次审核追加新版本，保留历史轨迹）

## 3. 本地规则：7 条红线

| # | 红线 | 判定维度 | 退路风险 | 证据 |
|---|---|---|---|---|
| R1 | 载重红线 | 总重 ≤ 柜型 maxWeight | 超重拒收、扣箱 | AIComplianceService `_checkWeight` |
| R2 | 重心红线 | 横向≤5% / 纵向≤10% | 倒箱、装船倾斜 | NingboPortSafetyEngine v25.0 |
| R3 | LIFO 红线 | 后到港货物不得压先到港 | 倒箱费 | FastBlock `_checkLIFOHardConstraint` |
| R4 | 单证红线 | VGM/品名/件数一致 | 查验布控（不一致查验率 60%） | AIComplianceService `_checkDocuments` |
| R5 | 危险品红线 | IMDG 隔离表 + 标签 | 港口拒收、行政处罚 | AIComplianceService `_checkDangerousGoods` |
| R6 | 木包装红线 | IPPC 标识强制 | 无标识直接退运 | AIComplianceService v3.1 |
| R7 | 混装禁忌红线 | 食品/化工、液体/电子、危险品/普货 | 货损、交叉污染 | AIComplianceService v3.1 |

> 详细矩阵见 [COMPLIANCE_RULE_MATRIX.md](./COMPLIANCE_RULE_MATRIX.md)

## 4. reportTable 6 维度

`AIComplianceService` 产出的 `reportTable` 结构固定 6 维度（VERIFIED）：

| 维度 | 名称 | 数据来源 | 判定方式 |
|---|---|---|---|
| D1 | VGM 重量验证 | 后端硬计算（总重 + 误差） | 相对误差≤5% 且绝对误差≤1吨 → PASS |
| D2 | 载重与限值 | 引擎 totalWeight vs 柜型 maxWeight | 后端硬判定 |
| D3 | 物理重心与装载 | 引擎 `_calculateCoG` | 后端硬判定（横向/纵向偏移率） |
| D4 | 单证一致性 | 货物元数据 vs 装箱方案 | 后端比对 |
| D5 | 危险品敏感品合规 | IMDG 类别 + 隔离表 | 后端规则 |
| D6 | 货物混装相容性 | 混装禁忌矩阵 | 后端规则 |

### 4.1 VGM 硬计算（VERIFIED）

证据：[backend/services/AIComplianceService.js:519-533](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L519)

判定逻辑：

```javascript
const relativeError = Math.abs(declared - actual) / declared;
const absoluteError = Math.abs(declared - actual);
// PASS 条件：相对误差 ≤ 5% 且 绝对误差 ≤ 1吨
if (relativeError <= 0.05 && absoluteError <= 1000) return 'PASS';
```

- 不依赖 AI
- 不依赖外部 API
- 完全后端确定性计算

## 5. 法规知识库

### 5.1 4 份 JSON 法规（VERIFIED）

| 法规代号 | 全称 | 年份 | 用途 | 证据 |
|---|---|---|---|---|
| ctu_code | IMO/ILO/UNECE CTU Code | 2014 | 集装箱装箱指南 | backend/data/regulations/ctu_code.json |
| gb40163 | 国标海运危险货物集装箱装箱 | 2021 | 危险品装箱 | backend/data/regulations/gb40163.json |
| jtt1187 | 港口货物装卸作业 | 2018 | 港口装卸规则 | backend/data/regulations/jtt1187.json |
| solas_vgm | SOLAS 第 VI 章/2 VGM | 2016 | 重量验证 | backend/data/regulations/solas_vgm.json |

- 共 **17 sections** 已结构化入库
- 启动时一次性从磁盘加载到内存

### 5.2 RegulationRAGService（VERIFIED）

- 检索算法：**TF-IDF + 余弦相似度**
- 零外部依赖（不依赖 OpenAI Embedding、不依赖向量数据库）
- 启动时从磁盘加载 4 份 JSON
- 证据：[backend/services/RegulationRAGService.js](file:///d:/cixing/3chuang/backend/services/RegulationRAGService.js)

### 5.3 WebRAGService（IMPLEMENTED_UNVERIFIED）

- 调用 Tavily Search API 联网补充检索
- **无 TAVILY_API_KEY 时**返回 `web_available=false`（不抛错，前端可见状态）
- 允许返回缓存标记 `cache_used=true`
- 证据：[backend/services/WebRAGService.js](file:///d:/cixing/3chuang/backend/services/WebRAGService.js)

### 5.4 混合检索（VERIFIED）

- 端点：`POST /api/compliance/hybrid-search`
- 合并 local（RegulationRAGService）+ web（WebRAGService）结果
- 按相似度排序去重

## 6. AI 降级链（VERIFIED）

证据：[backend/services/AIComplianceService.js](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js)

```
正常路径：调用硅基流动大模型 → 解析 JSON → 写建议文本

降级路径（按触发条件）：
1. 无 API_KEY          → 本地模板降级（_buildLocalComplianceReport）
2. API_ERROR/超时       → 物理数据增强降级（基于载重/重心/混装物理指标判定）
3. PARSE_ERROR         → 降级到本地规则结论
```

### 6.1 调用与重试

- `callAIWithRetry`：单次超时 5 秒，最多重试 2 次（v3.2 文档表述"1 次重试，总计最多 10 秒"）
- 智能预热：`onReady` 后台静默加载，点击按钮秒级响应
- 全链路日志：超时/重试/降级 全链路可追溯

## 7. NingboPortComplianceChecker / SafetyEngine

### 7.1 NingboPortComplianceChecker（VERIFIED）

- 法规依据：**JT/T 1187-2018 + GB 16994.4-2023**
- 6 大维度：与 reportTable 6 维度对齐
- 证据：[backend/services/NingboPortComplianceChecker.js](file:///d:/cixing/3chuang/backend/services/NingboPortComplianceChecker.js)

### 7.2 NingboPortSafetyEngine v25.0（VERIFIED）

| 指标 | 阈值 |
|---|---|
| 横向重心偏移 | ≤ 5% |
| 纵向重心偏移 | ≤ 10% |
| 柜型限重 | 28000 kg |
| 重货压易碎 | 检测告警 |

- 状态机：`PASS` / `WARNING` / `CRITICAL`
- 证据：[backend/services/NingboPortSafetyEngine.js](file:///d:/cixing/3chuang/backend/services/NingboPortSafetyEngine.js)

## 8. ComplianceTaskManager（VERIFIED）

- 异步任务管理器
- 任务 ID：`crypto.randomUUID()`
- 超时：30 秒
- 证据：[backend/services/ComplianceTaskManager.js](file:///d:/cixing/3chuang/backend/services/ComplianceTaskManager.js)

## 9. 前端合规 API（VERIFIED）

证据：[web-dashboard/src/api/complianceApi.js](file:///d:/cixing/3chuang/web-dashboard/src/api/complianceApi.js)

| 函数 | 方法 + 路径 | 用途 |
|---|---|---|
| `runAiComplianceAudit` | POST `/api/packing/compliance-check-sync` | 同步触发 AI 合规审核 |
| `fetchRegulationList` | GET `/api/compliance/regulations` | 法规列表 |
| `fetchRegulationDetail` | GET `/api/compliance/regulation/:docId` | 法规详情 |
| `searchRegulations` | POST `/api/compliance/hybrid-search` | 混合检索 |

## 10. systemPrompt 角色设定（VERIFIED）

证据：[backend/services/AIComplianceService.js:49](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L49)

- 角色：**"宁波港 20 年资深理货长"**
- 任务：基于 reportTable 6 维度写出可读的合规建议文本
- 禁令：不得自行判定 PASS/FAIL（PASS/FAIL 由本地规则与人工复核产出）

## 11. 已验证测试（VERIFIED）

| 测试文件 | 覆盖点 |
|---|---|
| backend/__tests__/unit/ai-recommend-container.test.js | AI 柜型推荐策略 |
| backend/__tests__/unit/ai-semantic-cache-offline.test.js | 语义缓存离线降级 |
| backend/__tests__/unit/ai-strategy-explain.test.js | AI 策略解释 |

## 12. 明确不做（NOT_FOUND）

- ❌ 法规 PDF 原文联动（无 PDF 解析、无原文回链）
- ❌ 法规页码高亮（无 PDF 渲染层）
- ❌ AI 直接判定 PASS/FAIL（架构边界）

详见 [COMPLIANCE_LIMITATIONS.md](./COMPLIANCE_LIMITATIONS.md)
