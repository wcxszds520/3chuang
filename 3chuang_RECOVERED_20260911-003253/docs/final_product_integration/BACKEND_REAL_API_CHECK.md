# 后端真实 API 全量检查

生成时间：2026-06-30T18:09:22.870Z

## 总结

- 真实接口测试：27/27 通过。
- 装箱接口：已装入 221，未装入 0 件，空间利用率 84.51%，总重量 8,812 kg。
- DeepSeek 合规：本地规则 WARNING / AI建议 PASS / 人工复核独立，模型 `deepseek-v4-flash`，`aiAdviceSource=ai`。
- Qwen3 VLM：5/5 张真实图片通过，录屏推荐使用 `pallet_wood.jpg`。
- RAG：9 个关键词全部命中本地法规证据库。
- 外部阻断：无。

## 核心接口

| 接口 | 结果 | 摘要 |
| --- | --- | --- |
| GET /api/health | PASS | 服务可达 |
| GET /api/container/list | PASS | 返回 20GP / 40GP / 40HQ |
| POST /api/packing/generate | PASS | 221/221，84.51%，source=backend |
| POST /api/packing/compliance-check-sync | PASS | 本地规则 WARNING / AI建议 PASS / 人工复核独立，deepseek-v4-flash，AI=ai |
| GET/POST /api/compliance/* | PASS | 法规列表、详情、搜索均通过 |
| GET /api/vlm/status | PASS | Qwen/Qwen3-VL-32B-Instruct |
| POST /api/vlm/recognize-cargo | PASS | 5/5 张通过；失败时不会显示成功 |
| POST/GET/DELETE /api/cargo/* | PASS | 创建、列表、删除均为真实接口 |

## 失败但不阻断项

| 项目 | 状态 | 说明 |
| --- | --- | --- |
