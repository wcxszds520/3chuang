# VLM Stability And UI Report

## 1. 本轮范围

本轮遵守“不读取 `.env`、不泄露 API Key”的限制，因此未重新发起外部硅基流动 VLM 请求。检查重点是 Web 端 VLM UI 是否保持真实能力语义：可上传、可识别中、成功后填表、失败时显示真实失败且不展示假成功。

## 2. 当前实现结论

- 前端封装：`web-dashboard/src/vlmCargo.js`
- 调用端点：`/api/vlm/recognize-cargo`
- 状态：`idle / recognizing / done / failed`
- 上传入口：货物录入页右侧 “VLM 拍照录货”
- 自动填表：识别成功后写入左侧货物表单字段
- 失败策略：显示“真实 VLM 识别失败”，保留手动录入，不填假结果

## 3. UI 质量

| 检查项 | 结果 |
|---|---|
| 上传按钮可见 | PASS |
| 识别中 loading | PASS |
| 识别成功结果卡 | PASS |
| 失败不伪造成功 | PASS |
| 可重试入口 | PASS |
| 与表单关联 | PASS |
| 首屏信息密度 | READY_WITH_NOTES |

## 4. 仍需人工复测

录屏前 15 分钟需要在有真实 `SILICONFLOW_API_KEY` 的环境里上传真实货物图片，确认模型为 `Qwen/Qwen3-VL-32B-Instruct`，并检查返回字段是否能填入表单。

结论：VLM UI 可进入录屏预演；真实外部模型调用需人工带密钥复测。
