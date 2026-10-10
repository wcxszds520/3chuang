# 录屏前 15 分钟检查

1. 后端：`cd backend && npm start`，确认 3000 端口健康。
2. 前端：`cd web-dashboard && npm run dev -- --host 127.0.0.1`，打开 http://127.0.0.1:5173/。
3. 环境变量：确认 `DEEPSEEK_MODEL=deepseek-v4-flash`、`SILICONFLOW_VLM_MODEL=Qwen/Qwen3-VL-32B-Instruct`。
4. VLM：用 `pallet_wood.jpg` 试一次识别。
5. DeepSeek：在合规页点 AI 深度审计，确认 本地规则 WARNING / AI建议 PASS / 人工复核独立。
6. 装箱：在柜型推荐点生成装柜方案，确认 221/221、84.51%。
7. 3D：进入 3D 页确认 canvas 非空白，播放、视角切换可用。
8. RAG：在合规页打开 SOLAS VGM 要求。
9. 报告：下载 HTML / CSV / JSON 任一文件，确认包含 NB2026-DEMO-01、221、0、84.51、100、IPPC。
10. 不要展示 API Key，不打开 .env。
