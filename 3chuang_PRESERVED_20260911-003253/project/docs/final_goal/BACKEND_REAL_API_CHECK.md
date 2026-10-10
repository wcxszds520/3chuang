# 阶段 1：后端真实 API 联调检查

检查时间：2026-06-30  
后端地址：`http://127.0.0.1:3000/api`  
结果证据：`docs/final_goal/backend-api-results.json`  
联调脚本：`tools/final_goal_backend_check.mjs`  
原则：只记录接口结构、状态和摘要，不记录任何真实 API Key。

## 总结

| 项目 | 结果 |
|---|---:|
| 总检查项 | 20 |
| 真实接口通过 | 19 |
| 跳过 | 1 |
| 失败 | 0 |

阶段 1 结论：`PASS_WITH_EXTERNAL_BLOCKER`

后端核心链路已真实打通：健康检查、装箱方案生成、AI 合规同步检查、法规 RAG 列表/详情/搜索、VLM 状态、柜型列表、货物创建/查询/删除均返回成功。  
唯一未完成项是 `POST /api/vlm/recognize-cargo`：项目中没有真实货物照片，只有设计稿和界面截图，因此本轮按要求跳过，不使用截图冒充货物图。已在 `docs/final_goal/test-assets/README.md` 标明需要人工补充真实货物照片后复测。

## 运行环境

- 后端服务：`npm start`
- 监听端口：`3000`
- 数据库连接：启动日志显示连接成功。
- AI 合规模型：接口摘要显示 `deepseek-v4-flash`。
- VLM 模型：接口摘要显示 `Qwen/Qwen2-VL-72B-Instruct`。
- API Key：环境已配置，但本报告不输出任何值。

## 本阶段代码保护与小修

本阶段未改后端接口路径、未改装箱算法入口、未改 VLM 接口、未改 RAG 接口。

必要修复：

- `backend/test-env.js`：移除 API Key 前缀输出，只显示是否已配置。
- `backend/.env.example`：补齐变量名和空占位，不写入真实密钥。
- `backend/services/AIComplianceService.js`：兼容 `DEEPSEEK_API_KEY`、`SILICONFLOW_API_KEY`、`DEEPSEEK_MODEL`、`AI_TIMEOUT_MS`，并返回 `aiAdviceSource` / `aiAdviceError`，用于证明 AI 建议来源。
- `backend/services/AIComplianceService.js`：补充 LIFO 合规行，并修复本轮联调发现的 `lifoCompliant` 变量缺失问题。
- `backend/services/VLMCargoService.js`：兼容 `VLM_MODEL`、`SILICONFLOW_VLM_MODEL`、`VLM_TIMEOUT_MS`。

## 测试输入摘要

装箱和合规联调用同一批演示货物：

| SKU | 名称 | 件数 | 目的港 | 关键属性 |
|---|---:|---:|---|---|
| SKU-A01 | 空调外机 | 120 | Hamburg | 重货、可堆叠 |
| SKU-B12 | 配件箱 | 260 | Hamburg | 可堆叠 |
| SKU-C08 | 木托包装件 | 24 | Hamburg | 木包装 |
| SKU-D22 | 易碎面板 | 96 | Hamburg | 易碎 |
| SKU-E17 | 普通纸箱 | 364 | Hamburg | 普通纸箱 |

合计：10 SKU，221 件，目标柜型 `40HQ`。

## API 检查明细

| 接口 | 方法 | HTTP | 耗时 | 真实调用 | 关键返回字段 | 结论 | 对录屏影响 |
|---|---|---:|---:|---|---|---|---|
| `/health` | GET | 200 | 59ms | 是 | `status=ok`、`service=甬柜易算后端服务` | PASS | 可作为后端在线证据。 |
| `/packing/generate` | POST | 200 | 7972ms | 是 | `loadedCargoLength=221`、`unloadedCargoLength=0`、`containerInfo`、`cog`、`spaceUtilization=84.51%` | PASS | 当前唯一演示数据已与后端真实结果一致。 |
| `/packing/compliance-check-sync` | POST | 200 | 1715ms | 是 | `status=PASS`、`score=100`、`model=deepseek-v4-flash`、`aiAdviceSource=ai`、`reportRows=8` | PASS | 可证明 AI 合规建议走真实模型；报告行包含 VGM、LIFO、重心、IPPC、单证检查。 |
| `/compliance/regulations` | GET | 200 | 7ms | 是 | `count=4`、`totalSections=17`、`method=TF-IDF cosine similarity` | PASS | 可展示本地法规证据库，不应说成实时联网法规检索。 |
| `/compliance/regulation/ctu_code` | GET | 200 | 6ms | 是 | `title=CTU Code 货物运输单元装载实操规则`、`sectionCount=5` | PASS | 可用于 CTU 装载依据详情。 |
| `/compliance/regulation/gb40163` | GET | 200 | 5ms | 是 | `title=GB 40163-2021...`、`sectionCount=4` | PASS | 可用于单证/安全操作依据详情。 |
| `/compliance/regulation/jtt1187` | GET | 200 | 4ms | 是 | `title=JT/T 1187-2018...`、`sectionCount=4` | PASS | 可用于 IPPC / 木包装相关证据。 |
| `/compliance/regulation/solas_vgm` | GET | 200 | 3ms | 是 | `title=SOLAS 公约第VI章...VGM`、`sectionCount=4` | PASS | 可用于 VGM 依据详情。 |
| `/compliance/search` `VGM` | POST | 200 | 7ms | 是 | 命中 `solas_vgm` 3 条 | PASS | 可展示 VGM 证据搜索。 |
| `/compliance/search` `LIFO` | POST | 200 | 5ms | 是 | 命中 `ctu_code` 4.1 | PASS | 可展示卸货顺序依据。 |
| `/compliance/search` `IPPC` | POST | 200 | 3ms | 是 | 命中 `jtt1187` 6.1 木质包装 IPPC | PASS | 可展示木包装 IPPC 依据。 |
| `/compliance/search` `木包装` | POST | 200 | 4ms | 是 | 命中 `jtt1187`、`gb40163` | PASS | 可展示中文关键词检索。 |
| `/compliance/search` `单证一致性` | POST | 200 | 5ms | 是 | 命中 `gb40163` 6.1、5.2 | PASS | 可展示单证复核依据。 |
| `/compliance/search` `CTU` | POST | 200 | 4ms | 是 | 命中 `ctu_code` 3.2 | PASS | 可展示 CTU 规则检索。 |
| `/vlm/status` | GET | 200 | 4ms | 是 | `available=true`、`model=Qwen/Qwen2-VL-72B-Instruct` | PASS | 可证明 VLM 服务已配置。 |
| `/vlm/recognize-cargo` | POST | - | - | 否 | 缺真实货物图片 | SKIPPED | 不能录制“真实拍照识别”效果，直到补充真实货物照片。 |
| `/container/list` | GET | 200 | 7ms | 是 | `types=20GP,40GP,40HQ` | PASS | 柜型选择数据真实来自后端。 |
| `/cargo/create` | POST | 200 | 22ms | 是 | `hasCargoId=true` | PASS | 货物创建接口可用。 |
| `/cargo/list` | GET | 200 | 9ms | 是 | `count=2` | PASS | 货物列表接口可用。 |
| `/cargo/delete/:cargoId` | DELETE | 200 | 19ms | 是 | `message=货物删除成功` | PASS | 联调测试货物已清理。 |

## AI 合规检查结论

同步合规接口返回：

- `aiAdviceSource=ai`
- `aiAdviceError=null`
- `model=deepseek-v4-flash`
- `reportRows=8`
- `containsVGM=true`
- `containsLIFO=true`
- `containsCOG=true`
- `containsIPPC=true`
- `containsDocs=true`

这说明本轮接口返回中能够证明合规建议来自真实 AI 调用，并且 VGM、LIFO、重心、IPPC、单证一致性均进入报告摘要。注意：本轮真实输入下接口状态为 `PASS`、分数为 `100`，与前端高保真演示稿中的 `本地规则 WARNING / AI建议 PASS / 人工复核独立` 不一致。后续如果继续做真实业务验收，需要决定是让前端展示真实接口分数，还是清楚标注演示稿数据为固定演示样例。

## 装箱算法结果与录屏风险

真实 `/packing/generate` 返回：

- 已装入：221
- 未装入：0 件
- 空间利用率：84.51%
- 有 `containerInfo`
- 有 `cog` / `cogOffset`

因此后续录屏和 UI 联调不能把真实算法结果包装成“一次装入全部 221 件、利用率 84.51%”。如果需要展示设计稿里的 221 件和 84.51%，应明确为演示链路指标，或者调整输入数据/装箱约束后重新跑真实接口。

## RAG 法规接口结论

法规库返回 4 个文档、17 个章节，搜索方法为轻量 TF-IDF cosine similarity。关键词覆盖情况：

- `VGM`：命中 SOLAS VGM 文档。
- `LIFO`：命中 CTU Code 装载顺序与可达性。
- `IPPC`：命中 JT/T 1187 木质包装 IPPC。
- `木包装`：命中 JT/T 1187 和 GB 40163。
- `单证一致性`：命中 GB 40163 记录与单证。
- `CTU`：命中 CTU Code。

结论：RAG 检索链路可用于“法规证据溯源”演示，但应表述为本地法规证据库，不要表述为联网实时法规数据库。

## VLM 当前状态

`GET /api/vlm/status` 通过，模型可用。  
`POST /api/vlm/recognize-cargo` 未执行，原因是当前项目内未发现真实货物图片。设计稿、页面截图、模型列表截图都不能作为货物识别测试材料。

后续动作：

1. 将真实货物照片放入 `docs/final_goal/test-assets/`。
2. 重新运行 `node tools/final_goal_backend_check.mjs`。
3. 确认 `/api/vlm/recognize-cargo` 返回货物名称、包装类型、尺寸/重量线索、风险属性和置信度。

## 阶段 1 状态

`PASS_WITH_EXTERNAL_BLOCKER`

可进入下一阶段的前提：

- 若下一阶段不录制 VLM 真实识别，可继续。
- 若下一阶段必须展示 VLM 真实识别，需先补充真实货物照片并复测。
- 前端展示的 221 件 / 84.51% / 86 分等设计稿指标，与本轮真实后端结果不完全一致，后续必须作为重点对齐项处理。
