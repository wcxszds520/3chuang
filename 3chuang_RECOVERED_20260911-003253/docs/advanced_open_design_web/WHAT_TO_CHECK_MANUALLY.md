# What To Check Manually

录屏前请人工检查以下事项。

## 1. 外部服务

- VLM 是否配置真实 `SILICONFLOW_API_KEY`。
- VLM 模型是否为 `Qwen/Qwen3-VL-32B-Instruct`。
- DeepSeek 是否配置真实 `DEEPSEEK_API_KEY`。
- DeepSeek 模型是否为 `deepseek-v4-flash`。
- 联网 RAG / Tavily 若要展示，确认服务可用；不可用时只讲本地法规证据库。

## 2. 后端

- 后端健康检查可用。
- `/api/packing/generate` 返回真实装箱结果。
- `/api/packing/compliance-check-sync` 返回真实 AI 合规结果。
- `/api/compliance/regulation/:docId` 可打开法规详情。

## 3. 前端

- 工作台数据和报告页数据一致。
- 柜型推荐、3D、合规、报告均显示 221/221、84.51%、本地规则 WARNING / AI建议 PASS / 人工复核独立。
- VLM 上传失败时不显示成功。
- AI 审计失败时不显示成功。
- RAG 失败时不写实时联网检索成功。
- 报告下载的 JSON 内容和页面一致。

## 4. 录屏风险

- 不要点击未配置密钥的外部实时调用，除非已提前复测。
- 不要讲“下载 PDF/ZIP/XLSX”，当前真实下载为 HTML/CSV/JSON/JSON smoke。
- 不要把 PPT 红金风或大屏风混入 Web 演示。
