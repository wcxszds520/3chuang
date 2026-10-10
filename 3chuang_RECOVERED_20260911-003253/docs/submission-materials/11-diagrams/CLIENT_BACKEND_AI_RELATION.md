# Web、移动端、后端和 AI 关系图

> 生成时间：2026-07-11
> 文件用途：明确 Web 前端、微信小程序、后端 Express 与四类 AI 服务之间的调用关系与数据走向。
> 说明：实线为已实现的调用链路；虚线为目标态待补齐的链路。

```mermaid
flowchart LR
    subgraph CLIENT["客户端"]
        WEB["Web 前端<br/>React18 + Vite + Three.js<br/>3D 装柜作业 / 合规预审 / 报告导出"]
        MP["微信小程序<br/>原生框架<br/>查看方案 / 货物管理<br/>export 页面（目标态）"]
    end

    subgraph BE["后端 Express（端口 3000）"]
        REST["REST API 网关"]
        SVCC["业务编排 Service"]
    end

    subgraph AISVC["AI 服务群"]
        DS["DeepSeek<br/>AI 解释 / 合规建议生成"]
        QVL["Qwen-VL<br/>货物图像识别"]
        TAV["Tavily<br/>联网法规检索<br/>（目标态：稳定可用）"]
        TTS["火山 TTS<br/>语音播报"]
    end

    WEB -- "HTTP REST / JSON" --> REST
    MP -- "HTTP REST / JSON" --> REST
    REST --> SVCC

    SVCC -- "生成提示词 / 解析返回" --> DS
    SVCC -- "上传图片 / 返回 SKU 属性" --> QVL
    SVCC -- "法规检索 query / 返回摘要" --> TAV
    SVCC -- "播报文本 / 返回音频流" --> TTS

    DS -. AI 解释回写 .-> SVCC
    QVL -. 识别结果回写 .-> SVCC
    TAV -. 法规摘要回写 .-> SVCC
    TTS -. 音频 URL 回写 .-> SVCC

    SVCC -- "装箱方案/合规结论/报告模型" --> WEB
    SVCC -- "方案查看/货物列表" --> MP
    SVCC -. "export 页面数据（目标态）" -.-> MP
```

## 调用关系说明

| 调用方 | 被调用方 | 数据内容 | 当前态 |
|--------|----------|----------|--------|
| Web 前端 | Express REST | 货物/方案/合规/报告请求 | 已实现 |
| 微信小程序 | Express REST | 方案查看/货物管理 | 已实现 |
| 微信小程序 export | Express | 报告导出数据 | 目标态 |
| 后端 Service | DeepSeek | AI 解释 / 合规建议 | 已实现 |
| 后端 Service | Qwen-VL | 货物图像识别 | 已实现 |
| 后端 Service | Tavily | 联网法规检索 | 依赖 API Key |
| 后端 Service | 火山 TTS | 语音播报 | 已实现 |

## 关键约束

- 所有 AI 调用经后端 Service 编排，前端不直连 AI 服务密钥。
- Tavily 联网法规检索当前依赖 `TAVILY_API_KEY`，稳定性为目标态。
- 小程序 export 页面当前为空壳，需在后端补齐导出端点后实现。
