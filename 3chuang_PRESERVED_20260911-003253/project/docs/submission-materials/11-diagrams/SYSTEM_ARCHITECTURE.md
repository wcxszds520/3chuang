# 系统总体架构图

> 生成时间：2026-07-11
> 文件用途：展示甬柜易算系统总体分层架构，覆盖 Web 前端、微信小程序、后端服务、MySQL 数据库、AI 服务群、法规知识库六大组成。
> 说明：实线框为仓库中已确认的模块；虚线框标注"目标态"为比赛提交前希望完成但当前尚未实现的能力。

```mermaid
flowchart TB
    subgraph CLIENT["客户端层"]
        WEB["Web 前端<br/>React18 + Vite + Three.js<br/>端口 5173"]
        MP["微信小程序<br/>微信原生框架<br/>含 export 页面（目标态）"]
    end

    subgraph BACKEND["后端服务层"]
        API["Express API 服务<br/>端口 3000<br/>REST 接口"]
        SVC["业务 Service 层<br/>装箱/合规/报告"]
        ALGO["装箱算法层<br/>FastBlock / Realistic4D v34.7<br/>AlgorithmOrchestrator 调度器"]
        LPE["LayeredPackingEngine<br/>利用率 39.06%（目标态 ≥70%）"]
    end

    subgraph DATA["数据层"]
        DB[("MySQL 4 表<br/>cargo / container_type<br/>packing_plan / user<br/>端口 3306")]
    end

    subgraph AI["AI 服务群"]
        DS["DeepSeek<br/>合规文本生成/AI解释"]
        QVL["Qwen-VL<br/>货物图像识别"]
        TAV["Tavily<br/>联网法规检索<br/>依赖 TAVILY_API_KEY（目标态稳定可用）"]
        TTS["火山 TTS<br/>语音播报"]
    end

    subgraph REG["法规知识库"]
        JSON["4 法规 JSON<br/>17 sections"]
        RAG["TF-IDF RAG 检索"]
        PDF["法规 PDF 原文联动<br/>（目标态）"]
    end

    subgraph REPORT["报告生成"]
        LOCAL["浏览器本地生成<br/>HTML / CSV / JSON"]
        SVR["后端 PDF 导出<br/>（目标态）"]
    end

    WEB --> API
    MP --> API
    API --> SVC
    SVC --> ALGO
    SVC --> LPE
    SVC --> DB
    ALGO --> DB
    SVC --> DS
    SVC --> QVL
    SVC --> TAV
    SVC --> TTS
    SVC --> RAG
    RAG --> JSON
    RAG -.-> PDF
    SVC --> LOCAL
    SVC -.-> SVR

    LPE -. 目标态提升 .-> LPE
    MP -. 目标态实现 export 页面 .-> MP
```

## 模块说明

| 分层 | 模块 | 当前态 | 备注 |
|------|------|--------|------|
| 客户端 | Web 前端 | 已实现 | React18 + Vite + Three.js |
| 客户端 | 微信小程序 | 部分实现 | export 页面为空壳（目标态） |
| 后端 | Express API | 已实现 | 端口 3000 |
| 后端 | 装箱算法 | 已实现 | FastBlock 主力 + Realistic4D v34.7 |
| 后端 | LayeredPackingEngine | 已实现 | 利用率 39.06%，目标态 ≥70% |
| 数据 | MySQL | 已实现 | 4 表，端口 3306 |
| AI | DeepSeek / Qwen-VL / 火山TTS | 已实现 | Tavily 依赖 API Key |
| 法规 | 4 法规 JSON + RAG | 已实现 | PDF 原文联动为目标态 |
| 报告 | 浏览器本地生成 | 已实现 | 后端 PDF 导出为目标态 |
