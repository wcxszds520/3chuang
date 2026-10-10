# UAT_PATCHED_SYSTEM — 前台业务层 UAT 补丁归档

全部补丁均为**中间件/接口适配器**形态（引擎内部零改动），供未来合并进生产 API 层。

## 补丁清单
| 文件 | 形态 | 修复的漏洞 |
|---|---|---|
| middleware/IngestionValidator.js | 请求前置校验中间件 | V1 录入校验缺失（脏数据字段级 400 + packagingType 安全默认值） |
| server_ref/uat_server.js（见 `MAX_PAYLOAD_EXCEEDED` 段） | 路由内前置闸门 | V2 整票载重红线缺失（VGM/轴荷前置拦截） |
| middleware/DigitalTwinSerializer.js | 响应序列化适配器 | V3 引擎输出对前端不友好（PORTCUBE_DIGITAL_TWIN_V1） |
| worker/uat_worker.js + worker/uat_worker_pool.js | worker_threads 计算池 | V4 CPU 密集计算阻塞事件循环（服务 P95 1825→400ms） |
| middleware/RecommendationBreaker.js | 熔断降级中间件 | V5 LLM 挂起阻塞 15s（2s 竞速熔断 + 规则降级 + 地面面积核验） |

## 合并指引
1. `IngestionValidator`：挂载于 `/api/packing/generate` 与 `/api/container/recommend` 的 body 校验位；
2. `MAX_PAYLOAD_EXCEEDED` 闸门：在容器解析后、引擎调用前；
3. `DigitalTwinSerializer`：成功响应的 `data.digitalTwin` 挂载点；
4. `UatWorkerPool`：替换路由内的同步 `orchestrator.execute`（worker 文件需与 backend 同级部署）；
5. `RecommendationBreaker`：包裹 `AIPackingService.recommendContainers` 调用（budgetMs=2000）。

## 遗留项
- V6 危险品互斥隔离：建议接入原生 `NingboPortComplianceChecker` 作为后置闸门；
- 饱和突发（50 并发含 10 个 212 件重型单）下端到端排队 P95 1382ms：建议多实例横向扩展（worker 池已解决单进程 CPU 串行）。
