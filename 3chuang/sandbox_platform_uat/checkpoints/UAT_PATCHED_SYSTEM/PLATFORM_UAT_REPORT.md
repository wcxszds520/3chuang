# PLATFORM_UAT_REPORT.md — 前台业务层系统集成 UAT 报告

- **沙盒**：`sandbox_platform_uat/`（唯一写入区；原项目与各历史沙盒只读未动）
- **被测系统**：前台业务层（货物录入工作台 API、法规/合规闸门、数字孪生 3D 渲染接口）+ 底层装箱引擎 best_real_v1（提取自 `sandbox_real_cargo_opt/checkpoints/FINAL_E2E_DELIVERY/`，md5 校验后镜像）
- **测试方式**：`run_uat_suites.js` 起本地契约服务（`uat_server.js`，出入参与原项目 `/api/packing/generate` 完全一致）→ 真实 HTTP 调用 → 断言采集（原始数据 `results/uat_results.json`、样例 `results/digital_twin_sample.json`）

## 一、总体结果：**25/25 通过（100%）**

| 套件 | 维度 | 通过 | 亮点 |
|---|---|---|---|
| A 录入防呆 | Robust Ingestion | **10/10** | 全部脏输入 400 化且字段级定位；包装类型自动赋安全默认值；零 500 |
| B 法规红线 | Compliance Gates | **4/4** | 35t→20GP 与 28t→40HQ 均被 `MAX_PAYLOAD_EXCEEDED` 前置拦截；COG 偏载告警结构清晰；危险品声明透传 |
| C 数字孪生 | Digital Twin API | **7/7** | stepSequence 严格递增；支撑者先于被支撑者（由下到上）；先装门侧批次（LIFO 装载序）；坐标零穿模；rotationMatrixY 旋转标识 |
| D 并发降级 | Concurrency & Fallback | **4/4** | 50 并发无 OOM（46→126MB 稳定）；服务耗时 P95 **400ms**；LLM 挂起 **≤2s 静默降级**、熔断后续调用 <50ms |

## 二、发现的系统漏洞与修复（全部为中间件/适配器补丁，引擎零改动）

| # | 漏洞（UAT 实测复现） | 严重度 | 修复补丁 | 验证 |
|---|---|---|---|---|
| V1 | **录入校验缺失**：重量 0、长度 99999、负尺寸、非数重量等脏数据直达引擎（无字段级 400），重量 0 会污染重心与承载计算 | 高 | `middleware/IngestionValidator.js`：硬校验（weight>0、尺寸 1–20000mm、数量≥1 整数、身份必填）→ 400 + `{field,index,message,received}` 精确定位；**软修正**：缺 stackable/canRotate/canLayFlat 按 packagingType（木架/托盘/纸箱…）赋安全默认值（易碎强制不可堆叠），normalizationNotes 回显 | A1–A10 全过 |
| V2 | **整票载重红线缺失**：原生超载检查为「单行×数量」口径，100 行×350kg=35t 入 20GP 通过校验并**静默欠装**（仅 FAST_BLOCK_PARTIAL 警告，不说明超载） | 高 | `uat_server.js` 中间件 3：整票载重 vs 柜型 payload 前置拦截 → 400 `MAX_PAYLOAD_EXCEEDED`（含超出公斤数与 VGM+SOLAS 规则标注） | B1/B1b 全过 |
| V3 | **引擎输出对前端不友好**：无 stepSequence 语义、无旋转标识、无坐标系声明——码头工人/Three.js 无法直接消费 | 中 | `middleware/DigitalTwinSerializer.js`：`PORTCUBE_DIGITAL_TWIN_V1` 结构（containerFrame 坐标系/单位/门端声明 + stepByStep + rotationMatrixY 3×3 + 渲染必需字段） | C1–C7 全过 |
| V4 | **CPU 密集计算阻塞事件循环**：50 并发中 10 个重型订单（212 件）串行占核，P95 1825ms | 中 | `uat_worker.js` + `uat_worker_pool.js`：worker_threads 池（6 worker）承接计算，主线程只做校验/序列化 → 服务耗时 P95 **400ms** | D1/D2 全过 |
| V5 | **LLM 挂起阻塞 15s**：原生 `_callAI` axios 超时 15s，LLM 端点挂起时选柜最长阻塞 15s（产品要求 ≤2s 降级） | 中 | `middleware/RecommendationBreaker.js`：2s 竞速熔断（1 次超时即 open，60s 冷却半开），降级复用原生阈值规则 + 地面面积可行性核验 | D3/D4 全过（首调用 ~2s 降级、后续 <50ms） |
| V6 | **危险品隔离缺口（如实记录，未在本轮修复）**：`dangerous` 字段可透传但 generate 链路无互斥品类隔离逻辑 | 中 | 建议：接入项目原生 `NingboPortComplianceChecker`（合规后检）作为 generate 的后置闸门；本轮以声明透传 + B3 断言记录现状 | B3 通过（按现状口径） |

## 三、数字孪生 JSON 数据结构样例

完整样例见 `results/digital_twin_sample.json`（REAL-MULTICUST-16 实测，16 步、31.2%）。结构摘要：

```json
{
  "schema": "PORTCUBE_DIGITAL_TWIN_V1",
  "containerFrame": {
    "axes": { "x": "length(0=deep end, innerLength=door)", "y": "height(0=floor, up)", "z": "width" },
    "units": "mm", "doorSide": "max-x", "gravityAxis": "y", "upVector": [0,1,0],
    "spec": { "typeId": "40HQ", "innerLength": 12032, "innerWidth": 2352, "innerHeight": 2698, "maxWeight": 26000 }
  },
  "summary": { "totalSteps": 16, "utilizationPct": 31.2, "totalWeightKg": 4360, "algorithm": "fast-block", "solveMs": 12 },
  "warnings": [],
  "unplaced": [],
  "stepByStep": [
    {
      "stepSequence": 1,
      "cargoId": "ROW_165c00af…:U1",
      "position": { "x": 10832, "y": 0, "z": 176 },
      "dimensions": { "l": 1200, "w": 1000, "h": 1300 },
      "weightKg": 260,
      "orientation": "XYZ",
      "rotation": { "yawDeg": 0, "rollDeg": 0, "rotationMatrixY": [1,0,0, 0,1,0, 0,0,1] },
      "color": "#5B8DEF", "type": "heavy", "stackLevel": 1,
      "batchId": "batch_1", "portSequence": 1, "destinationPort": "HAM",
      "handling": { "method": "forklift", "forkEntry": "TWO_WAY" }
    }
  ]
}
```

**前端契约要点**：① `stepSequence` 严格 1..N 且已验证「支撑者先于被支撑者」（逐帧回放不会悬空）；② 首件位于门端批次（LIFO 装载序：先装门侧、后装深端，与实际装箱作业一致）；③ `rotationMatrixY`（行主序 3×3）+ 欧拉角，前端零推断；④ `containerFrame` 声明坐标系/单位/门端，杜绝镜像误读；⑤ 逐件 `color/type/batchLabel/destinationPort/handling` 供业务染色与筛选。

## 四、通过率明细（断言级）

- **Suite A（10）**：重量 0/负尺寸/99999 超长/非数重量/数量 0/无标识/非数组 → 400 字段级定位；PALLETIZED_CARTONS 缺省自动赋不可堆叠+叉车；混合票脏行整票拦截并指明行号；**零 500**。
- **Suite B（4）**：35t→20GP、28t→40HQ 前置拦截（含超出公斤数）；偏载订单返回 COG 偏移告警（本轮构造实际触发 COG_OFFSET 结构，policy 内时为空属正确行为）；危险品声明透传（隔离为已知缺口 V6）。
- **Suite C（7）**：结构存在、stepSequence 递增、支撑序正确、门侧优先装载序、坐标零穿模、旋转标识（含非恒等实例）、渲染字段完备。
- **Suite D（4）**：50 并发全成功无 OOM（堆 46→126MB 平稳回落）；服务 P95 400ms / 客户端排队 P95 1382ms（饱和突发排队，建议生产多实例横向扩展）；LLM 挂起 2s 熔断降级 + 熔断后 <50ms。

## 五、结论

对接最强装箱引擎（best_real_v1）后，平台前台业务层在补齐 5 个中间件/适配器补丁后达到 **25/25（100%）** 的 UAT 通过率：防呆能力（脏数据字段级拦截 + 语义自动修正）、合规拦截（VGM/载荷前置红线 + COG 告警结构）、前端渲染友好度（PORTCUBE_DIGITAL_TWIN_V1 完整契约）与并发韧性（worker 池 + LLM 熔断降级）均达工业可用水平。遗留项：危险品互斥隔离（V6，建议接入原生合规后检）与饱和突发下的端到端排队（建议多实例横向扩展）。

补丁归档：`checkpoints/UAT_PATCHED_SYSTEM/`（含全部补丁源码、服务器参考接线与 README）。
