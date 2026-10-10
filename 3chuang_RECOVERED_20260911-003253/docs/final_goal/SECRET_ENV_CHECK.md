# 阶段 0：密钥与环境检查

检查时间：2026-06-30  
范围：`backend`、`web-dashboard`、`docs/final_goal`、`.kiro` 设计资料  
原则：不输出、不记录、不提交任何真实 API Key。

## 结论

- `backend/.env` 存在。
- `backend/.env` 已被 `backend/.gitignore` 忽略。
- `backend/.env.example` 存在，并已补齐本轮联调需要的变量名；未写入真实密钥。
- 后端通过 `dotenv` 读取环境变量。
- 前端未直接暴露 VLM / DeepSeek / SiliconFlow key。
- 发现 1 处日志泄露风险：`backend/test-env.js` 曾打印 `AI_API_KEY` 前缀；已修复为只显示“已配置/未配置”。
- 仓库扫描未发现 `sk-...` 形态的真实 token。
- 用户目标附件中包含真实 API Key 文本；本轮没有复制到仓库或报告。建议在最终录屏前轮换该密钥。

## 需要的环境变量

后端当前优先沿用既有变量名，并兼容本轮建议变量名：

| 变量名 | 用途 | 当前配置情况 | 备注 |
|---|---|---:|---|
| `SILICONFLOW_API_KEY` | SiliconFlow / Qwen VLM / SiliconFlow DeepSeek 模型 | 已配置于 `backend/.env` | 不输出值 |
| `AI_API_KEY` | 既有 AI Key 变量 | 已配置于 `backend/.env` | 后端优先读取 |
| `AI_API_ENDPOINT` | OpenAI-compatible endpoint | 已配置于 `backend/.env` | 不输出值 |
| `AI_MODEL` | AI 合规模型 | 已配置于 `backend/.env` | 不输出值 |
| `VLM_MODEL` | VLM 视觉模型 | 未在 `backend/.env` 配置 | 代码有默认值 |
| `SILICONFLOW_VLM_MODEL` | VLM 视觉模型别名 | 未在 `backend/.env` 配置 | 本轮新增兼容 |
| `DEEPSEEK_API_KEY` | DeepSeek key 别名 | 未在 `backend/.env` 配置 | 本轮新增兼容 |
| `DEEPSEEK_MODEL` | DeepSeek 模型别名 | 未在 `backend/.env` 配置 | 本轮新增兼容 |
| `AI_TIMEOUT_MS` | AI 合规调用超时 | 未在 `backend/.env` 配置 | 本轮新增兼容，默认 15000ms |
| `VLM_TIMEOUT_MS` | VLM 调用超时 | 未在 `backend/.env` 配置 | 本轮新增兼容，默认 20000ms |

## 代码读取情况

- `backend/server.js`：`require('dotenv').config({ override: true })`
- `backend/services/AIComplianceService.js`：
  - 读取 `AI_API_KEY`
  - 兼容 `DEEPSEEK_API_KEY`
  - 兼容 `SILICONFLOW_API_KEY`
  - 读取 `AI_MODEL`
  - 兼容 `DEEPSEEK_MODEL`
  - 读取 `AI_TIMEOUT_MS`
- `backend/services/VLMCargoService.js`：
  - 读取 `AI_API_KEY`
  - 读取 `SILICONFLOW_API_KEY`
  - 读取 `VLM_MODEL`
  - 兼容 `SILICONFLOW_VLM_MODEL`
  - 读取 `VLM_TIMEOUT_MS`

## git ignore 检查

命令证据：

```text
backend/.gitignore:5:.env backend/.env
```

结论：`backend/.env` 已被 ignore。

## 泄露风险扫描

扫描方式：

- 使用 `rg` 搜索 `sk-...` 形态 token。
- 搜索 `SILICONFLOW_API_KEY=` / `DEEPSEEK_API_KEY=` 等赋值。
- 输出只记录文件路径和风险，不记录匹配内容。

扫描结果：

- 未发现真实 `sk-...` token。
- `backend/.env.example` 仅为变量名/空值或占位说明。
- `.kiro/specs/ai-compliance-timeout-optimization/design.md` 仅为占位说明。
- `backend/test-env.js` 的 key 前缀输出风险已修复。

## 是否需要轮换密钥

建议轮换。原因不是仓库泄露，而是用户目标附件中直接包含了真实 API Key 文本。为比赛录屏和后续提交安全，建议在联调完成后重新生成密钥，并只写入 `backend/.env` 或部署环境变量。

## 阶段 0 状态

`PASS_WITH_ROTATION_RECOMMENDED`

项目内未发现真实密钥落盘到源码或报告；但由于目标附件出现过真实 key，建议轮换。
