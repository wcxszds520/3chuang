# 合规限制与边界声明 (COMPLIANCE_LIMITATIONS)

> 生成时间：2026-07-11
> 适用版本：v3.2.0（High Availability Upgrade）
> 文档目的：明确列出合规模块**未实现的功能**、**架构边界**、**外部依赖**与**申报材料中不得编造的内容**
> 状态分级：VERIFIED / IMPLEMENTED_UNVERIFIED / PARTIAL / PLANNED / NOT_FOUND

---

## 1. 未实现功能（NOT_FOUND）

### 1.1 法规 PDF 原文联动

| 项 | 内容 |
|---|---|
| 状态 | NOT_FOUND |
| 描述 | 系统未实现法规 PDF 文件的解析、原文回链、原文展示 |
| 现状 | 法规库为 4 份 JSON 结构化数据，共 17 sections |
| 替代方案 | RegulationRAGService 返回 `docId + section` 引用，前端展示法规条款摘要 |
| 证据 | backend/data/regulations/*.json |

### 1.2 法规页码高亮

| 项 | 内容 |
|---|---|
| 状态 | NOT_FOUND |
| 描述 | 系统未实现法规 PDF 页码定位与高亮渲染 |
| 原因 | 无 PDF 渲染层 |
| 替代方案 | 仅引用 section 编号（如 `solas_vgm §2.1`） |

### 1.3 AI 判定 PASS/FAIL

| 项 | 内容 |
|---|---|
| 状态 | NOT_FOUND（架构边界，**主动不做**） |
| 描述 | AI 不得自行判定 PASS/FAIL |
| 原因 | v4.0 零幻觉架构目标，避免 AI 幻觉导致误判 |
| 替代方案 | PASS/FAIL 由本地规则引擎 + 人工复核产出 |
| 证据 | [AI_ROLE_AND_BOUNDARY.md §2.2](./AI_ROLE_AND_BOUNDARY.md) |

## 2. 架构边界声明

### 2.1 AI 边界（VERIFIED）

| 边界 | 说明 |
|---|---|
| 仅写建议文本 | AI 输出为人类可读的合规建议，不参与决策 |
| 不修改物理指标 | VGM/重心/LIFO 等物理指标由引擎独占计算 |
| 不覆盖本地结论 | `finalConclusion` 公式：`人工 ?? 本地`，AI 不在变量集中 |
| 不静默覆盖历史 | `complianceHistory` 采用追加模式 |

### 2.2 引擎边界（VERIFIED）

| 边界 | 说明 |
|---|---|
| 物理计算独占 | VGM、重心、LIFO、碰撞 AABB 全部后端确定性计算 |
| 不调 AI | v37.1 起 `/api/ai-packing/recommend-container` 纯算法不调 AI |
| 硬计算不可篡改 | 物理证据不可被 AI 或前端修改 |

### 2.3 法规库边界（VERIFIED）

| 边界 | 说明 |
|---|---|
| 仅 4 份 JSON | ctu_code / gb40163 / jtt1187 / solas_vgm |
| 共 17 sections | 结构化入库，启动时从磁盘加载 |
| 无 PDF 原文 | NOT_FOUND |
| 无实时更新 | 法规库为静态 JSON，需手动更新 |

## 3. 外部依赖（IMPLEMENTED_UNVERIFIED）

### 3.1 AI API Key 依赖

| 依赖项 | 状态 | 缺失时行为 |
|---|---|---|
| `AI_API_KEY`（硅基流动） | IMPLEMENTED_UNVERIFIED | 本地模板降级（`_buildLocalComplianceReport`） |
| `TAVILY_API_KEY`（Tavily 搜索） | IMPLEMENTED_UNVERIFIED | `web_available=false`，不抛错 |
| 火山引擎 TTS Key | IMPLEMENTED_UNVERIFIED | TTS 不可用 |
| SiliconFlow VLM Key | IMPLEMENTED_UNVERIFIED | VLM 货物识别不可用 |

### 3.2 降级保证

- **所有外部依赖缺失时，主流程不阻塞**
- 降级路径产出基于本地规则的 `finalConclusion`
- 降级事件写入全链路日志

### 3.3 路演级可用性

| 场景 | 保证 | 证据 |
|---|---|---|
| 无任何 API Key | 本地规则仍可完整产出结论 | v3.2 降级链 |
| AI 超时 | 5 秒超时 + 2 次重试，最多 10 秒 | `callAIWithRetry` |
| AI 解析失败 | 降级到本地规则结论 | v3.2 |
| Tavily 不可用 | 本地 RegulationRAGService 独立工作 | WebRAGService |

## 4. 数据准确性边界

### 4.1 VGM 计算（VERIFIED）

| 项 | 内容 |
|---|---|
| 判定规则 | 相对误差≤5% 且绝对误差≤1吨 |
| 计算方式 | 后端硬计算 |
| 证据 | [AIComplianceService.js:519-533](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L519) |
| 边界 | 仅验证申报重量与计算重量的偏差，不验证申报重量本身的真伪 |

### 4.2 重心计算（VERIFIED）

| 项 | 内容 |
|---|---|
| 横向阈值 | ≤ 5% |
| 纵向阈值 | ≤ 10% |
| 限重上限 | 28000 kg（NingboPortSafetyEngine v25.0） |
| 状态机 | PASS / WARNING / CRITICAL |
| 边界 | 基于理想化几何模型，不考虑货物内部密度不均 |

### 4.3 LIFO 约束（VERIFIED）

| 项 | 内容 |
|---|---|
| 判定方式 | FastBlock `_checkLIFOHardConstraint` 硬约束 |
| 数据来源 | demoDataset 3 港序（宁波→汉堡→鹿特丹→安特卫普） |
| 边界 | 仅验证装卸顺序，不优化路径 |

## 5. 法规检索边界

### 5.1 本地检索（VERIFIED）

| 项 | 内容 |
|---|---|
| 算法 | TF-IDF + 余弦相似度 |
| 依赖 | 零外部依赖（不依赖 OpenAI Embedding、不依赖向量数据库） |
| 数据 | 4 份 JSON，17 sections |
| 边界 | 检索精度受限于 TF-IDF 算法，无语义理解 |

### 5.2 联网检索（IMPLEMENTED_UNVERIFIED）

| 项 | 内容 |
|---|---|
| 服务 | WebRAGService 调 Tavily Search API |
| 缓存 | 允许 `cache_used=true` |
| 边界 | 依赖 TAVILY_API_KEY；无 Key 时 `web_available=false` |
| 风险 | 联网检索结果可能包含噪声，需用户自行判断 |

### 5.3 混合检索（VERIFIED）

| 项 | 内容 |
|---|---|
| 端点 | POST `/api/compliance/hybrid-search` |
| 合并策略 | local + web 结果按相似度排序去重 |
| 边界 | 混合检索结果仅用于 AI 建议文本，不进入 `finalConclusion` |

## 6. 申报材料中不得编造的内容

> ⚠️ 以下内容在代码中**无证据**，申报材料中**不得编造**：

| 项 | 状态 | 说明 |
|---|---|---|
| 真实企业落地案例 | NOT_FOUND | 无企业部署证据 |
| 法规 PDF 原文联动 | NOT_FOUND | 无 PDF 解析层 |
| 法规页码高亮 | NOT_FOUND | 无 PDF 渲染层 |
| AI 判定 PASS/FAIL | NOT_FOUND | 架构边界，主动不做 |
| 法规库实时更新 | NOT_FOUND | 法规库为静态 JSON |
| 港口实时动态数据 | PARTIAL | PortUpdateService 硬编码 4 条模拟情报 |
| AI 审核准确率统计 | NOT_FOUND | 无生产环境统计数据 |
| 法规库覆盖率 100% | NOT_FOUND | 仅 4 份法规，17 sections |
| 多语言法规支持 | NOT_FOUND | 仅中文/英文法规条款 |

## 7. 已知技术债务

### 7.1 法规库覆盖范围

- 当前仅 4 份法规（ctu_code / gb40163 / jtt1187 / solas_vgm）
- 未覆盖：IMDG Code 完整版、ISPM 15 完整版、各国港口地方法规
- 建议：后续按需扩充 JSON 法规库

### 7.2 AI 建议文本质量

- AI 建议文本质量依赖大模型能力
- 无生产环境质量评估指标
- 建议：建立人工抽检机制

### 7.3 法规检索精度

- TF-IDF 算法无语义理解能力
- 同义查询可能召回不准
- 建议：后续可引入轻量级 Embedding 模型

## 8. 测试覆盖边界（VERIFIED）

| 测试文件 | 覆盖点 | 未覆盖 |
|---|---|---|
| backend/__tests__/unit/ai-recommend-container.test.js | AI 柜型推荐策略 | - |
| backend/__tests__/unit/ai-semantic-cache-offline.test.js | 语义缓存离线降级 | - |
| backend/__tests__/unit/ai-strategy-explain.test.js | AI 策略解释 | - |

**未覆盖项**：

- AI 建议文本质量评估（无自动化测试）
- 法规检索召回率（无基准测试集）
- 端到端合规审核 E2E（依赖外部 API Key）

## 9. 合规结论的法律效力声明

> ⚠️ **重要声明**：
>
> 本系统产出的合规结论为**港前预审建议**，**不具备法律效力**。
>
> 1. `finalConclusion` 仅作为装柜决策参考
> 2. 正式合规审核应由港口理货长、海关、海事部门进行
> 3. 系统不承担因合规结论导致的任何法律责任
> 4. 用户应结合实际情况进行人工复核

## 10. 相关文档

- [COMPLIANCE_FACTS.md](./COMPLIANCE_FACTS.md) —— 合规事实总览
- [COMPLIANCE_RULE_MATRIX.md](./COMPLIANCE_RULE_MATRIX.md) —— 规则矩阵
- [AI_ROLE_AND_BOUNDARY.md](./AI_ROLE_AND_BOUNDARY.md) —— AI 角色与边界
- [COMPLIANCE_EVIDENCE_FLOW.md](./COMPLIANCE_EVIDENCE_FLOW.md) —— 合规证据流
