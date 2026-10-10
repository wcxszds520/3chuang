# Final Advanced E2E Report

生成时间：2026-06-30T10:32:28.695Z

## 结论

`READY_WITH_NOTES`

核心录屏链路仍保持真实可运行：装箱、DeepSeek、Qwen3-VL、本地 RAG、公开网页缓存参考、3D 作业孪生、HTML/CSV/JSON 导出、按钮路径和截图 QA 均通过。注意项：当前未配置 `TAVILY_API_KEY`，联网参考使用本轮在线检索后生成的缓存快照，不声明为实时联网国标检索。

## 验证结果

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 前端 build | PASS | PASS - web-dashboard npm run build 成功 |
| 后端 API | 27/27 | docs/final_product_integration/backend-real-api-results.json |
| VLM 稳定性 | 5/5，稳定 4 张 | docs/advanced_optimization/VLM_STABILITY_REPAIR_REPORT.md |
| 本地 RAG | 9/9 | docs/advanced_optimization/WEB_RAG_ENHANCEMENT_REPORT.md |
| Hybrid RAG | 9/9，缓存参考 9 条查询 | docs/advanced_optimization/rag-check-results.json |
| DeepSeek V4 Flash | PASS | docs/final_product_integration/backend-real-api-results.json |
| 3D 截图 QA | PASS | docs/advanced_optimization/THREE_OPERATION_TWIN_ENHANCEMENT_REPORT.md |
| 前端按钮 E2E | 49/49 | docs/final_product_integration/playwright-e2e-results.json |
| 报告导出 | PASS | HTML / CSV / JSON 下载内容检查 |
| 数据一致性 | PASS | 221/221、84.51%、本地规则 WARNING / AI建议 PASS / 人工复核独立 |
| fake/mock/fallback 冒充成功 | 未发现 | 失败态明确显示失败或缓存状态 |
| 密钥泄露检查 | PASS | scoped scan 未发现疑似密钥模式 |

## 推荐录屏路径

1. 工作台：说明真实订单 NB2026-DEMO-01 和 221/221 结果。
2. 货物录入：上传 `labeled_carton.jpg`，展示 Qwen3-VL 结构化识别。
3. 柜型推荐：生成真实 40HQ 装箱方案。
4. 3D 作业孪生：播放步骤，切换总览/门端/俯视，打开算法依据。
5. 合规预审：点击 AI 深度审计，展示本地法规证据和公开网页缓存参考。
6. 报告导出：预览并下载 HTML/CSV/JSON。
