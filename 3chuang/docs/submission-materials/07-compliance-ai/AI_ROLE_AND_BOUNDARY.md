# AI 角色与边界 (AI_ROLE_AND_BOUNDARY)

> 生成时间：2026-07-11
> 适用版本：v3.2.0 → v4.0 零幻觉架构目标
> 核心原则：**AI 仅写建议文本，不判定 PASS/FAIL**
> 证据基线：[backend/services/AIComplianceService.js:6,49](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L6)

---

## 1. AI 在系统中的角色定位

### 1.1 角色设定（VERIFIED）

证据：[backend/services/AIComplianceService.js:49](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L49)

- **角色**："宁波港 20 年资深理货长"
- **任务**：基于后端已计算出的 reportTable 6 维度物理事实，写出人类可读的合规建议文本
- **能力边界**：仅文本生成，无判定权、无决策权、无回写权

### 1.2 顶层架构信条

> "引擎算物理，AI 判合规"
>
> —— [backend/services/AIComplianceService.js:6](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L6)

这里的"判合规"指的是**写出合规建议文本**，而非**给出 PASS/FAIL 结论**。PASS/FAIL 由本地规则引擎与人工复核产出。

## 2. AI 做什么 / 不做什么

### 2.1 ✅ AI 做的事

| 能力 | 说明 | 证据 |
|---|---|---|
| 生成 6 维度建议文本 | 把 reportTable 物理事实翻译成理货长口吻的解释 | AIComplianceService systemPrompt |
| 引用法规条款 | 在建议文本中引用 ctu_code/gb40163/jtt1187/solas_vgm | RegulationRAGService 检索结果注入 prompt |
| 量化退路风险 | 引用行业数据锚定（查验率 60%、倒箱费 800-2000 元） | v3.1 行业数据锚定 |
| 给出操作建议 | 如"建议将重货下移、轻货上移以修正重心" | systemPrompt 指令 |
| 联网补充检索 | 通过 WebRAGService 调 Tavily 获取最新法规动态 | WebRAGService |

### 2.2 ❌ AI 不做的事

| 禁止项 | 原因 | 替代方案 |
|---|---|---|
| **判定 PASS/FAIL** | 架构边界，避免幻觉导致误判 | 本地规则引擎 + 人工复核 |
| **修改物理指标** | 物理指标由后端引擎确定性计算 | 引擎独占 |
| **覆盖本地规则结论** | 本地规则是确定性事实 | `finalConclusion` 优先人工→本地规则 |
| **静默覆盖 complianceHistory** | 历史轨迹必须保留 | 每次审核追加新版本 |
| **法规 PDF 原文联动** | NOT_FOUND，无 PDF 解析层 | 仅引用 JSON 结构化条款 |
| **法规页码高亮** | NOT_FOUND，无 PDF 渲染层 | 仅引用 section 编号 |
| **柜型推荐决策** | v37.1 起纯算法不调 AI | AlgorithmOrchestrator |

## 3. AI 边界架构图（Mermaid）

```mermaid
flowchart TB
    subgraph 引擎层["引擎层（确定性，后端独占）"]
        A1[VGM 硬计算<br/>相对误差≤5% 且绝对误差≤1吨]
        A2[载重判定<br/>totalWeight ≤ maxWeight]
        A3[重心物理计算<br/>横向≤5% 纵向≤10%]
        A4[LIFO 硬约束<br/>FastBlock]
        A5[碰撞 AABB]
        A6[reportTable 6 维度<br/>物理事实产出]
        A1 --> A6
        A2 --> A6
        A3 --> A6
        A4 --> A6
        A5 --> A6
    end

    subgraph 规则层["规则层（本地，确定性）"]
        B1[7 条红线<br/>载重/重心/LIFO/单证/危险品/木包装/混装]
        B2[一票否决<br/>任意 FAIL 则整体 FAIL]
        B3[本地结论 PASS/WARNING/FAIL]
        B1 --> B2 --> B3
    end

    subgraph AI层["AI 层（仅建议文本，无判定权）"]
        C1[systemPrompt<br/>宁波港 20 年资深理货长]
        C2[读取 reportTable 6 维度物理事实]
        C3[读取 RegulationRAGService 检索结果]
        C4[生成建议文本<br/>引用法规 + 量化风险 + 操作建议]
        C1 --> C4
        C2 --> C4
        C3 --> C4
    end

    subgraph 人工层["人工层（最高优先）"]
        D1[CompliancePage manualForm]
        D2[人工结论 + 备注]
        D1 --> D2
    end

    A6 --> C2
    A6 --> B1
    C4 -.建议展示.-> E1[前端展示]
    B3 --> E2[finalConclusion<br/>= 人工 ?? 本地]
    D2 --> E2
    E2 --> E1

    style AI层 fill:#fff7e6,stroke:#b95832,stroke-width:2px
    style 引擎层 fill:#e6f7ff,stroke:#246a56,stroke-width:2px
    style 规则层 fill:#e6fffb,stroke:#246a56,stroke-width:2px
    style 人工层 fill:#f9f0ff,stroke:#722ed1,stroke-width:2px
```

> 上图为可编辑 Mermaid 源码，复制到任何支持 Mermaid 的编辑器即可渲染。

## 4. AI 降级链（VERIFIED）

当 AI 不可用时，系统按以下顺序降级，**永不阻塞主流程**：

```mermaid
flowchart LR
    Start([合规审核触发]) --> CheckKey{有 API_KEY?}
    CheckKey -- 否 --> D1[本地模板降级<br/>_buildLocalComplianceReport]
    CheckKey -- 是 --> CallAI[callAIWithRetry<br/>5秒超时+2次重试]
    CallAI --> CallResult{调用结果}
    CallResult -- 成功 --> Parse{JSON 解析}
    CallResult -- API_ERROR/超时 --> D2[物理数据增强降级<br/>基于载重/重心/混装物理指标]
    Parse -- 成功 --> OK[正常建议文本]
    Parse -- 失败 PARSE_ERROR --> D3[降级到本地规则结论]
    D1 --> Final[finalConclusion<br/>= 人工 ?? 本地]
    D2 --> Final
    D3 --> Final
    OK --> Final

    style D1 fill:#fff7e6,stroke:#b95832
    style D2 fill:#fff7e6,stroke:#b95832
    style D3 fill:#fff7e6,stroke:#b95832
    style OK fill:#e6f7ff,stroke:#246a56
```

### 4.1 降级触发条件表

| 触发条件 | 降级路径 | 输出 | 证据 |
|---|---|---|---|
| 无 `AI_API_KEY` | 本地模板降级 | `_buildLocalComplianceReport` 结果 | AIComplianceService |
| `API_ERROR` / 超时 | 物理数据增强降级 | 基于载重/重心/混装物理指标的判定 | v3.2 High Availability |
| `PARSE_ERROR` | 降级到本地规则 | 本地规则结论 | AIComplianceService |

### 4.2 调用与重试参数

| 参数 | 值 | 证据 |
|---|---|---|
| 单次超时 | 5 秒 | `callAIWithRetry` |
| 重试次数 | 2 次 | v3.2 |
| 总耗时上限 | ≤ 10 秒 | v3.2 文档 |
| 智能预热 | `onReady` 后台静默加载 | v3.2 |
| 全链路日志 | 超时/重试/降级 可追溯 | v3.2 |

## 5. AI 与三层架构的关系

```mermaid
flowchart TB
    subgraph L1["L1 本地规则（确定性）"]
        L1a[7 条红线]
        L1b[PASS/WARNING/FAIL]
        L1a --> L1b
    end

    subgraph L2["L2 AI 合规审计（仅建议）"]
        L2a[读取 reportTable]
        L2b[生成建议文本]
        L2c[不判定 PASS/FAIL]
        L2a --> L2b --> L2c
    end

    subgraph L3["L3 人工复核（最高优先）"]
        L3a[CompliancePage manualForm]
        L3b[人工结论]
        L3a --> L3b
    end

    Final[finalConclusion<br/>= 人工 ?? 本地]
    L1b --> Final
    L3b --> Final
    L2b -.建议展示,不进入结论链.-> Show[前端建议 Drawer]

    style L1 fill:#e6fffb,stroke:#246a56
    style L2 fill:#fff7e6,stroke:#b95832
    style L3 fill:#f9f0ff,stroke:#722ed1
```

### 5.1 关键不变量

1. **AI 输出不进入 `finalConclusion` 链** —— AI 仅展示，不决策
2. **`finalConclusion` 优先级**：人工复核结论 ?? 本地规则结论
3. **`complianceHistory` 不可静默覆盖** —— 每次审核追加新版本
4. **物理指标不可被 AI 修改** —— 引擎独占计算权

## 6. AI 与法规检索的关系

```mermaid
flowchart LR
    Q[合规查询] --> Local[RegulationRAGService<br/>TF-IDF 余弦相似度<br/>零外部依赖]
    Q --> Web[WebRAGService<br/>Tavily 搜索]
    Local --> Merge[hybrid-search<br/>合并去重排序]
    Web --> Merge
    Merge --> Prompt[注入 AI systemPrompt]
    Prompt --> AI[AI 生成建议文本<br/>引用法规条款]

    Web -.无 TAVILY_API_KEY.-> Unavailable[web_available=false<br/>不抛错]

    style Local fill:#e6f7ff,stroke:#246a56
    style Web fill:#fff7e6,stroke:#b95832
    style AI fill:#fff7e6,stroke:#b95832
```

- 法规检索结果**注入 AI prompt**，不直接进入 `finalConclusion`
- 即使 WebRAGService 不可用，本地 RegulationRAGService 仍可独立工作
- `cache_used=true` 标记允许 WebRAGService 返回缓存结果

## 7. v4.0 零幻觉架构目标

当前 v3.2 已落地以下 v4.0 边界：

| 边界 | v3.2 状态 | 证据 |
|---|---|---|
| AI 不判定 PASS/FAIL | ✅ 已落地 | `finalConclusion` 不含 AI 输出 |
| 物理指标引擎独占 | ✅ 已落地 | VGM/重心/LIFO 全部后端硬计算 |
| 法规引用可追溯 | ✅ 已落地 | RegulationRAGService 返回 docId+section |
| 降级链完整 | ✅ 已落地 | 3 级降级，永不阻塞 |
| 历史不可覆盖 | ✅ 已落地 | `complianceHistory` 追加模式 |

## 8. 测试覆盖（VERIFIED）

| 测试文件 | 覆盖点 | 证据 |
|---|---|---|
| backend/__tests__/unit/ai-recommend-container.test.js | AI 柜型推荐策略（v37.1 起纯算法） | [文件](file:///d:/cixing/3chuang/backend/__tests__/unit/ai-recommend-container.test.js) |
| backend/__tests__/unit/ai-semantic-cache-offline.test.js | 语义缓存离线降级 | [文件](file:///d:/cixing/3chuang/backend/__tests__/unit/ai-semantic-cache-offline.test.js) |
| backend/__tests__/unit/ai-strategy-explain.test.js | AI 策略解释 | [文件](file:///d:/cixing/3chuang/backend/__tests__/unit/ai-strategy-explain.test.js) |

## 9. 相关文档

- [COMPLIANCE_FACTS.md](./COMPLIANCE_FACTS.md) —— 合规事实总览
- [COMPLIANCE_RULE_MATRIX.md](./COMPLIANCE_RULE_MATRIX.md) —— 7 红线 × 6 维度矩阵
- [COMPLIANCE_EVIDENCE_FLOW.md](./COMPLIANCE_EVIDENCE_FLOW.md) —— 合规证据流
- [COMPLIANCE_LIMITATIONS.md](./COMPLIANCE_LIMITATIONS.md) —— 合规限制与边界声明
