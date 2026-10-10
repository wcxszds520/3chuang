# 密钥与环境变量检查

检查时间：2026-07-01  
范围：`backend`、`web-dashboard`、`tools`、`docs/final_product_integration`  
原则：只记录变量名、是否配置和非敏感模型名，不输出任何真实 API Key。

## 结论

`PASS_WITH_NOTE`

- `backend/.env` 存在。
- `backend/.env` 被 `backend/.gitignore` 排除：`backend/.gitignore:5:.env`。
- `backend/.env.example` 存在。
- `AI_API_KEY` 已配置，当前承担 DeepSeek 调用 key。
- `DEEPSEEK_API_KEY` 别名未配置；本轮不复制或打印密钥。
- `AI_MODEL` 与 `DEEPSEEK_MODEL` 均为 `deepseek-v4-flash`。
- `SILICONFLOW_API_KEY` 已配置。
- `SILICONFLOW_VLM_MODEL` 为 `Qwen/Qwen3-VL-32B-Instruct`。
- `VLM_MODEL` 未配置；代码以 `SILICONFLOW_VLM_MODEL` 优先。
- `VLM_TIMEOUT_MS` 当前为 `45000`，与推荐 `30000` 不完全一致，但不会导致假成功。
- 后端日志仅显示 key 是否配置，不打印 key 内容。
- 前端未发现 key 暴露模式。
- 源码/文档扫描发现 2 个 `DB_PASSWORD=` 示例占位，均判断为 placeholder/test，不是真实密钥。

## 变量检查

| 变量名 | 当前状态 | 备注 |
|---|---|---|
| `AI_API_KEY` | 已配置 | 既有 DeepSeek 调用 key，不输出值。 |
| `DEEPSEEK_API_KEY` | 未配置 | 当前由 `AI_API_KEY` 承担，不复制密钥。 |
| `AI_MODEL` | `deepseek-v4-flash` | 沿用项目已有 DeepSeek V4 Flash 配置。 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | DeepSeek 模型别名已配置。 |
| `AI_TIMEOUT_MS` | `30000` | 符合本轮要求。 |
| `SILICONFLOW_API_KEY` | 已配置 | 用于 SiliconFlow VLM，不输出值。 |
| `SILICONFLOW_API_ENDPOINT` | 已配置 | `https://api.siliconflow.cn/v1/chat/completions`。 |
| `SILICONFLOW_VLM_MODEL` | `Qwen/Qwen3-VL-32B-Instruct` | 符合本轮 VLM 模型要求。 |
| `VLM_MODEL` | 未配置 | 不再作为主变量使用。 |
| `VLM_TIMEOUT_MS` | `45000` | 实际环境值；后续测试按真实配置记录。 |
| `VLM_MAX_ATTEMPTS` | `2` | 真实 VLM 最多尝试 2 次。 |

## `.env.example` 检查

- `SILICONFLOW_API_KEY`：空占位。
- `DEEPSEEK_API_KEY`：空占位。
- `TAVILY_API_KEY`：空占位。
- 其他非密钥变量包含数据库、本地端口、endpoint 和模型变量名。
- 未发现真实 API key 写入 `.env.example`。

## 代码读取与日志安全

- `backend/services/AIComplianceService.js`
  - 读取 `AI_API_KEY` / `DEEPSEEK_API_KEY` / `SILICONFLOW_API_KEY`。
  - 模型读取顺序包含 `AI_MODEL` 与 `DEEPSEEK_MODEL`。
  - 默认模型为 `deepseek-v4-flash`。
  - 超时读取 `AI_TIMEOUT_MS`，当前配置为 `30000ms`。
- `backend/services/VLMCargoService.js`
  - 只读取 `SILICONFLOW_API_KEY`，避免误把其他 AI key 当作 VLM 可用。
  - 模型读取 `SILICONFLOW_VLM_MODEL`。
  - 默认模型为 `Qwen/Qwen3-VL-32B-Instruct`。
  - 失败时返回真实错误，不返回固定识别成功。
- `backend/server.js`
  - 启动日志输出模型名，不输出 key。
- `web-dashboard`
  - 未发现 `import.meta.env.*KEY` 或前端 key 注入逻辑。

## 源码与文档扫描

扫描范围排除了 `backend/.env`、`node_modules`、`web-dashboard/dist`、二进制图片和导出产物。

| 文件 | 行 | 命中项 | 判断 |
|---|---:|---|---|
| `backend/README.md` | 47 | `DB_PASSWORD=` | 示例占位，不是真实密钥。 |
| `backend/__tests__/README.md` | 73 | `DB_PASSWORD=` | 测试占位，不是真实密钥。 |

未发现 `sk-...` 形态真实 key，未发现 Bearer token 泄露。若后续人工粘贴过真实 key 到其他未扫描附件，仍建议录屏前轮换密钥。

## 阶段 0 状态

`PASS_WITH_NOTE`

可以继续阶段 1/2。后续所有 AI / VLM / RAG 报告必须继续避免记录 key、请求头和完整敏感日志。
