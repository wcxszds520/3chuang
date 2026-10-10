# Before Recording Advanced 15min Check

1. 后端：`cd backend && npm start`，确认 `/api/health` PASS。
2. 前端：`cd web-dashboard && npm run dev`，确认 5173 可访问。
3. 环境：确认 `DEEPSEEK_MODEL=deepseek-v4-flash`、`SILICONFLOW_VLM_MODEL=Qwen/Qwen3-VL-32B-Instruct`。
4. VLM：运行 `node tools/advanced_vlm_stability_check.mjs`，优先使用最佳图片 `labeled_carton.jpg`。
5. RAG：运行 `node tools/advanced_rag_check.mjs`，确认本地 9/9、hybrid 9/9。
6. Build：`cd web-dashboard && npm run build`。
7. 3D：打开 `#twin`，确认 canvas 非空，叉车/工人/路径可见。
8. 合规：点击 AI 深度审计，确认 本地规则 WARNING / AI建议 PASS / 人工复核独立。
9. 报告：下载 HTML/CSV/JSON 任一文件，确认包含 NB2026-DEMO-01、221、0、84.51、100、IPPC。
10. 不要点击或讲解不存在的 PDF/ZIP 后端导出。
