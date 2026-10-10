# 项目技术路线图（当前态已实现模块）

> 生成时间：2026-07-11
> 文件用途：展示甬柜易算当前已实现的技术模块与能力分布，作为比赛提交的当前态基线。
> 说明：本图仅包含仓库中已确认实现的模块，不包含目标态。

```mermaid
flowchart TD
    subgraph FRONTEND["前端层（已实现）"]
        FE1["React18 + Vite<br/>Web 前端框架"]
        FE2["Three.js<br/>3D 装柜作业渲染"]
        FE3["18 相位状态机<br/>IDLE→...→COMPLETED/PAUSED/BLOCKED"]
        FE4["程序化构建<br/>集装箱 118 部件 + 叉车 34 部件 + 人工 actor"]
        FE5["报告模型 buildReportModel<br/>HTML/CSV/JSON 本地生成"]
        FE6["7 维筛选<br/>货物筛选（当前已有）"]
    end

    subgraph BACKEND["后端层（已实现）"]
        BE1["Node + Express<br/>端口 3000 REST API"]
        BE2["MySQL 4 表<br/>cargo/container_type/packing_plan/user"]
        BE3["装箱算法<br/>FastBlock 块优先（生产主力）"]
        BE4["Realistic4D v34.7<br/>四维装柜算法"]
        BE5["AlgorithmOrchestrator<br/>算法调度器"]
        BE6["LayeredPackingEngine<br/>分层装柜（利用率 39.06%）"]
    end

    subgraph COMPLIANCE["合规层（已实现）"]
        C1["三层证据链<br/>本地规则+AI建议+人工复核"]
        C2["7 红线校验"]
        C3["4 法规 JSON 17 sections"]
        C4["TF-IDF RAG 检索"]
    end

    subgraph AI["AI 服务（已实现）"]
        A1["DeepSeek<br/>AI 解释/合规建议"]
        A2["Qwen-VL<br/>货物图像识别"]
        A3["火山 TTS<br/>语音播报"]
        A4["Tavily<br/>联网法规检索（依赖 API Key）"]
    end

    subgraph MP["小程序（已实现）"]
        M1["微信原生框架"]
        M2["方案查看/货物管理"]
    end

    subgraph TEST["测试（已实现）"]
        T1["后端测试 811+"]
        T2["Web 测试 90+"]
        T3["E2E 多套"]
    end

    subgraph DEMO["演示（已实现）"]
        D1["订单 NB2026-DEMO-01"]
        D2["40HQ / 221件全部规划装入 / 84.51% / LIFO通过"]
    end

    FE1 --> FE2 --> FE3
    FE2 --> FE4
    FE1 --> FE5
    FE1 --> FE6
    BE1 --> BE2
    BE1 --> BE3
    BE3 --> BE5
    BE4 --> BE5
    BE6 --> BE5
    BE1 --> C1
    C1 --> C2
    C1 --> C3
    C1 --> C4
    BE1 --> A1
    BE1 --> A2
    BE1 --> A3
    BE1 --> A4

    style FRONTEND fill:#e3f2fd
    style BACKEND fill:#e8f5e9
    style COMPLIANCE fill:#fff3e0
    style AI fill:#f3e5f5
    style TEST fill:#fce4ec
```

## 已实现模块清单

| 层级 | 模块 | 技术栈/参数 | 状态 |
|------|------|-------------|------|
| 前端 | Web 框架 | React18 + Vite | 已实现 |
| 前端 | 3D 渲染 | Three.js | 已实现 |
| 前端 | 状态机 | 18 相位 | 已实现 |
| 前端 | 程序化构建 | 118+34 部件 + actor | 已实现 |
| 前端 | 报告模型 | buildReportModel | 已实现 |
| 后端 | API | Express 3000 | 已实现 |
| 后端 | 数据库 | MySQL 4 表 | 已实现 |
| 后端 | 算法 | FastBlock + Realistic4D + Orchestrator + LPE | 已实现 |
| 合规 | 证据链 | 三层 + 7 红线 + 4 JSON + RAG | 已实现 |
| AI | 服务群 | DeepSeek + Qwen-VL + TTS + Tavily | 已实现 |
| 小程序 | 基础 | 微信原生 + 方案查看 | 已实现 |
| 测试 | 覆盖 | 后端 811+ / Web 90+ / E2E | 已实现 |
| 演示 | 订单 | NB2026-DEMO-01 | 已实现 |
