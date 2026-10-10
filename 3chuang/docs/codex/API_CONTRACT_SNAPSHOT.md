# API 与数据契约快照

更新时间：2026-07-12。结论来自当前源码、真实 HTTP 请求和回读测试。

## 装箱主契约

### `POST /api/packing/generate`

当前请求：

```json
{
  "containerType": "40HQ",
  "cargoList": [
    {
      "cargoId": "stage3_acc_01",
      "sku": "SKU-ACC-01",
      "name": "精密配件箱",
      "length": 650,
      "width": 560,
      "height": 520,
      "weight": 12,
      "quantity": 60,
      "destinationPort": "Hamburg",
      "portSequence": 1,
      "batchId": "BATCH-HAM-A",
      "handlingMethod": "manual",
      "handlingPolicy": "fixed"
    }
  ],
  "options": { "algorithmId": "fast-block" }
}
```

契约规则：

- 前端 `packingApi.js` 总是写入 `options.algorithmId = fast-block`，忽略调用方、URL 或 localStorage 中的其他值。
- 后端 `routes/packing.js` 再次覆盖为 `fast-block`，直接 API 调用也不能切换权威算法。
- 为保护旧调用方，后端仍接受 `{cargoIds: [...]}`，从 `cargo` 表解析后进入同一 Fast Block 路径；响应仍为当前扁平契约。
- 缺少货物返回 400；旧 ID 全部不存在返回 404；柜型不存在返回 404；算法/尺寸约束失败返回显式业务错误。

成功响应关键结构：

```text
code, message, ts
data.planId
data.containerInfo.{typeId,name,innerLength,innerWidth,innerHeight,maxWeight}
data.loadedCargo[].{loadingIndex,cargoId,name,sku,x,y,z,l,w,h,weight,
  packagingType,fragile,batchId,batchLabel,destinationPort,eta,portSequence,
  handlingMethod,handlingPolicy,heavy,wooden,riskNotes,source,algorithmMeta}
data.unloadedCargo[]
data.spaceUtilization, totalWeight, totalCargoCount
data.cog, data.cogOffset
data.metrics, data.constraintMeta, data.warnings
data.compliance
data.ext_algorithmId = fast-block
data.ext_aiExplanation, data.ext_recommendation
```

- 坐标单位为 mm；X＝箱长/深度，Y＝高度，Z＝箱宽。
- `loadedCargo` 为逐件扁平数组，不使用旧 `position/dimensions/properties` 嵌套。
- `planId` 与 `packing_plan.plan_id` 相同，真实响应可追溯到持久化记录。
- 标准柜型在数据库不可用时有同语义本地 fallback；不会伪造货物方案。

最终实测：3 次 200；每次 221 loaded、0 unloaded、84.51018309907437%、8,812 kg、`ext_algorithmId=fast-block`；核心指纹完全相同。证据：`output/playwright/stage3/algorithm/determinism-summary.json`。

## 合规契约

| 能力 | 入口 | 行为 |
|---|---|---|
| 异步合规 | `POST /api/packing/compliance-check` | 返回 202、taskId、pollUrl；本地规则不被覆盖 |
| 异步查询 | `GET /api/packing/compliance-report/:taskId` | processing/completed/failed 明确状态 |
| 同步审计 | `POST /api/packing/compliance-check-sync` | 返回后端 AI 解释；失败由前端保留本地规则/PDF 并允许重试 |
| 合规健康 | `GET /api/packing/health/compliance` | 最终实测 200、healthy、memory cache |
| 法规详情 | 前端 compliance service 对应后端法规入口 | 空响应/网络失败不影响本地 PDF 证据 |

四个来源必须独立：

1. 本地确定性规则；
2. 本地法规 PDF 证据；
3. 后端 AI 审计解释；
4. 当前设备上的人工复核记录。

最终 gate 证明：本地 WARNING、AI idle/loading/error/ready、人工 unreviewed/approved-with-conditions/rejected 均不互相覆盖。

## VLM 与业务读取

- 货物拍照识别通过后端 VLM 路由；前端只在成功解析后填充草稿，失败不修改原表单。
- 工作台数据、当前订单、3D、合规和报告均来自同一个 session；没有六页各自的静态订单副本。
- API 层统一通过 `apiClient` 处理 JSON、timeout、HTTP/业务错误；失败不返回 PASS。

## 报告与下载契约

报告不是后端占位链接，由当前 session 构建并实际下载：

- HTML：完整预览、装柜摘要、221 条坐标、法规证据索引、AI/人工层；42,284 B。
- CSV：每个 placement 一行，221 行、27 列，包含 SKU、批次、港口、港序、Actor、X/Y/Z、尺寸、重量和风险；61,606 B。
- JSON：schemaVersion 2，包含 session、后端 plan、合规四层、7 条证据和 3 个文档索引；292,731 B。
- 三种格式的 placement 指纹均为 `25c45c3328cf4a2be3ab769e663016b07cc8e9c9ba5e9270b9c297151cb5c4ca`。

证据：`output/playwright/stage3/report/export-consistency.json` 与同目录三个下载文件。

## 兼容与禁止事项

- 不更改现有 API 路径、认证和成功 envelope。
- 新字段以扁平兼容扩展方式加入；旧 `cargoIds` 请求有真实集成测试。
- 页面不呈现算法 selector，不接受 query/localStorage 算法注入。
- 本地预演明确标注为本地确定性预演，只在尚无后端方案时辅助决策；不冒充后端结果。
- AI、联网法规、本地规则和人工结论不得互相覆盖或冒充。
