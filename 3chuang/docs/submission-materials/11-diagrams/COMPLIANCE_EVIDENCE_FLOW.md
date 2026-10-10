# 合规证据链流程图

> 生成时间：2026-07-11
> 文件用途：展示合规预审三层证据链（本地规则 → AI 建议 → 人工复核 → 最终结论）的完整流程。
> 说明：实线为已实现的证据链；虚线为目标态待补齐的法规 PDF 原文联动与联网检索稳定。

```mermaid
flowchart TD
    IN([装柜方案 + 货物属性]) --> L1[第一层：本地规则校验]

    subgraph LOCAL["本地规则层"]
        RED["7 红线校验<br/>重量/尺寸/危险品/堆码等"]
        REG["4 法规 JSON 17 sections<br/>TF-IDF RAG 检索"]
        RED --> HIT{命中红线?}
        REG --> HIT
    end

    L1 --> LOCAL
    HIT -- "命中" --> BLOCK[阻断：标记违规]
    HIT -- "未命中" --> L2[第二层：AI 建议]

    subgraph AIL["AI 建议层"]
        DS["DeepSeek<br/>合规建议生成"]
        TAV["Tavily<br/>联网法规检索"]
        DS --> ADV[AI 建议]
        TAV --> ADV
    end

    L2 --> AIL
    ADV --> L3[第三层：人工复核]

    subgraph HUMAN["人工复核层"]
        REVIEW[复核员审核<br/>确认/调整/退回]
    end

    L3 --> HUMAN
    REVIEW --> DEC{复核结论}
    DEC -- "通过" --> PASS[最终结论：PASS]
    DEC -- "调整" --> L1
    DEC -- "退回" --> BLOCK

    BLOCK --> FAIL[最终结论：FAIL / 需调整]

    REG -. "目标态：法规 PDF 原文联动" .-> REG
    TAV -. "目标态：稳定可用（依赖 TAVILY_API_KEY）" .-> TAV

    style PASS fill:#e8f5e9
    style FAIL fill:#ffebee
```

## 三层证据链说明

| 层级 | 模块 | 功能 | 当前态 | 目标态 |
|------|------|------|--------|--------|
| 第一层 | 7 红线校验 | 重量/尺寸/危险品/堆码阻断 | 已实现 | — |
| 第一层 | 4 法规 JSON 17 sections | 本地法规条文 | 已实现 | PDF 原文联动 |
| 第一层 | TF-IDF RAG | 法规检索匹配 | 已实现 | — |
| 第二层 | DeepSeek | 合规建议生成 | 已实现 | — |
| 第二层 | Tavily | 联网法规检索 | 依赖 API Key | 稳定可用 |
| 第三层 | 人工复核 | 确认/调整/退回 | 已实现 | — |

## 关键约束

- 三层证据链当前已实现，最终结论由人工复核确认。
- 演示订单 NB2026-DEMO-01 合规结论为 本地规则 WARNING / AI建议 PASS / 人工复核独立。
- 法规 PDF 原文联动为 NOT_FOUND，属目标态。
- 联网法规检索依赖 `TAVILY_API_KEY`，稳定性为目标态。
- 7 红线为硬阻断，命中即标记违规，不可跳过。
