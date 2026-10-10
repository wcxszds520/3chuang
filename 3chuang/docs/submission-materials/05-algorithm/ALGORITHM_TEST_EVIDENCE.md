# 算法测试证据 (ALGORITHM_TEST_EVIDENCE)

> 生成时间：2026-07-11
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`

---

## 1. 测试总览

| 指标 | 数值 | 证据 |
|---|---|---|
| 单元测试目录 | `backend/__tests__/unit/` | [backend/__tests__/unit/](../../backend/__tests__/unit/) |
| 测试文件数 | 27 个 | 见下文清单 |
| 测试用例数 | 486 个 | jest 运行结果 |
| fast-check 属性测试 | 93 处 | [backend/__tests__/setup/FAST_CHECK_SETUP.md](../../backend/__tests__/setup/FAST_CHECK_SETUP.md) |
| 集成测试目录 | `backend/__tests__/integration/` | [backend/__tests__/integration/](../../backend/__tests__/integration/) |
| 路演测试目录 | `backend/__tests__/roadshow/` | [backend/__tests__/roadshow/](../../backend/__tests__/roadshow/) |

---

## 2. 单元测试文件清单（27 个）

| # | 文件名 | 关注点 | 代码位置 |
|---|---|---|---|
| 1 | Cargo.test.js | 货物模型 | [backend/__tests__/unit/Cargo.test.js](../../backend/__tests__/unit/Cargo.test.js) |
| 2 | ContainerType.test.js | 柜型模型 | [backend/__tests__/unit/ContainerType.test.js](../../backend/__tests__/unit/ContainerType.test.js) |
| 3 | DBLFPackingEngine-v25-CoG.test.js | DBLF v25 重心 | [backend/__tests__/unit/DBLFPackingEngine-v25-CoG.test.js](../../backend/__tests__/unit/DBLFPackingEngine-v25-CoG.test.js) |
| 4 | DBLFPackingEngine-v25-SnapToNeighbors.test.js | DBLF v25 吸附 | [backend/__tests__/unit/DBLFPackingEngine-v25-SnapToNeighbors.test.js](../../backend/__tests__/unit/DBLFPackingEngine-v25-SnapToNeighbors.test.js) |
| 5 | DBLFPackingEngine-v25-SurfaceAttraction.test.js | DBLF v25 表面吸引 | [backend/__tests__/unit/DBLFPackingEngine-v25-SurfaceAttraction.test.js](../../backend/__tests__/unit/DBLFPackingEngine-v25-SurfaceAttraction.test.js) |
| 6 | FastBlockPackingEngine.test.js | FastBlock 主力引擎 | [backend/__tests__/unit/FastBlockPackingEngine.test.js](../../backend/__tests__/unit/FastBlockPackingEngine.test.js) |
| 7 | LayeredPackingEngine-AllProperties.test.js | Layered 引擎全属性 | [backend/__tests__/unit/LayeredPackingEngine-AllProperties.test.js](../../backend/__tests__/unit/LayeredPackingEngine-AllProperties.test.js) |
| 8 | NingboPortSafetyEngine-v25.test.js | 宁波港安全引擎 v25 | [backend/__tests__/unit/NingboPortSafetyEngine-v25.test.js](../../backend/__tests__/unit/NingboPortSafetyEngine-v25.test.js) |
| 9 | OptimizedPackingEngine-Preprocessing.test.js | Optimized 预处理 | [backend/__tests__/unit/OptimizedPackingEngine-Preprocessing.test.js](../../backend/__tests__/unit/OptimizedPackingEngine-Preprocessing.test.js) |
| 10 | OptimizedPackingEngine-Task10-StackLevel.test.js | Optimized 堆叠层级 | [backend/__tests__/unit/OptimizedPackingEngine-Task10-StackLevel.test.js](../../backend/__tests__/unit/OptimizedPackingEngine-Task10-StackLevel.test.js) |
| 11 | OptimizedPackingEngine-Task11-MultiContainer.test.js | Optimized 多柜 | [backend/__tests__/unit/OptimizedPackingEngine-Task11-MultiContainer.test.js](../../backend/__tests__/unit/OptimizedPackingEngine-Task11-MultiContainer.test.js) |
| 12 | OptimizedPackingEngine-Task12-DebugMode.test.js | Optimized 调试模式 | [backend/__tests__/unit/OptimizedPackingEngine-Task12-DebugMode.test.js](../../backend/__tests__/unit/OptimizedPackingEngine-Task12-DebugMode.test.js) |
| 13 | OptimizedPackingEngine-Task3.test.js | Optimized Task3 | [backend/__tests__/unit/OptimizedPackingEngine-Task3.test.js](../../backend/__tests__/unit/OptimizedPackingEngine-Task3.test.js) |
| 14 | OptimizedPackingEngine-Task5.1-Verification.test.js | Optimized Task5.1 验证 | [backend/__tests__/unit/OptimizedPackingEngine-Task5.1-Verification.test.js](../../backend/__tests__/unit/OptimizedPackingEngine-Task5.1-Verification.test.js) |
| 15 | OptimizedPackingEngine-Task5.2-Verification.test.js | Optimized Task5.2 验证 | [backend/__tests__/unit/OptimizedPackingEngine-Task5.2-Verification.test.js](../../backend/__tests__/unit/OptimizedPackingEngine-Task5.2-Verification.test.js) |
| 16 | OptimizedPackingEngine-Task6-LoadDistribution.test.js | Optimized 载荷分布 | [backend/__tests__/unit/OptimizedPackingEngine-Task6-LoadDistribution.test.js](../../backend/__tests__/unit/OptimizedPackingEngine-Task6-LoadDistribution.test.js) |
| 17 | OptimizedPackingEngine-Task7-Visualization.test.js | Optimized 可视化 | [backend/__tests__/unit/OptimizedPackingEngine-Task7-Visualization.test.js](../../backend/__tests__/unit/OptimizedPackingEngine-Task7-Visualization.test.js) |
| 18 | OptimizedPackingEngine-Task8-Compliance.test.js | Optimized 合规 | [backend/__tests__/unit/OptimizedPackingEngine-Task8-Compliance.test.js](../../backend/__tests__/unit/OptimizedPackingEngine-Task8-Compliance.test.js) |
| 19 | OptimizedPackingEngine-Task9.test.js | Optimized Task9 | [backend/__tests__/unit/OptimizedPackingEngine-Task9.test.js](../../backend/__tests__/unit/OptimizedPackingEngine-Task9.test.js) |
| 20 | PackingEngine-Algorithm.test.js | 装箱引擎算法 | [backend/__tests__/unit/PackingEngine-Algorithm.test.js](../../backend/__tests__/unit/PackingEngine-Algorithm.test.js) |
| 21 | PackingEngine-SpaceAndCOG.test.js | 装箱引擎空间与重心 | [backend/__tests__/unit/PackingEngine-SpaceAndCOG.test.js](../../backend/__tests__/unit/PackingEngine-SpaceAndCOG.test.js) |
| 22 | RenderEngine.test.js | 渲染引擎 | [backend/__tests__/unit/RenderEngine.test.js](../../backend/__tests__/unit/RenderEngine.test.js) |
| 23 | StackManager.test.js | 堆叠管理器 | [backend/__tests__/unit/StackManager.test.js](../../backend/__tests__/unit/StackManager.test.js) |
| 24 | ai-recommend-container.test.js | AI 柜型推荐 | [backend/__tests__/unit/ai-recommend-container.test.js](../../backend/__tests__/unit/ai-recommend-container.test.js) |
| 25 | ai-semantic-cache-offline.test.js | AI 语义缓存离线 | [backend/__tests__/unit/ai-semantic-cache-offline.test.js](../../backend/__tests__/unit/ai-semantic-cache-offline.test.js) |
| 26 | ai-strategy-explain.test.js | AI 策略解释 | [backend/__tests__/unit/ai-strategy-explain.test.js](../../backend/__tests__/unit/ai-strategy-explain.test.js) |
| 27 | algorithm-orchestrator.test.js | 调度器 | [backend/__tests__/unit/algorithm-orchestrator.test.js](../../backend/__tests__/unit/algorithm-orchestrator.test.js) |

---

## 3. 核心算法测试详解

### 3.1 FastBlockPackingEngine.test.js

代码位置：[backend/__tests__/unit/FastBlockPackingEngine.test.js](../../backend/__tests__/unit/FastBlockPackingEngine.test.js)

测试关注点（基于引擎特性推导）：

- 确定性：相同输入相同输出
- SKU 聚集：同 SKU 货物成块
- LIFO 合规：portSequence 排序
- 重心偏移：横向 ≤5%、纵向 ≤10%
- 零容忍碰撞：无重叠
- 缝隙填充：_fillQueuedCargo
- 重量限制：totalWeight < maxWeight
- 边界约束：innerLength/innerWidth/innerHeight

### 3.2 algorithm-orchestrator.test.js

代码位置：[backend/__tests__/unit/algorithm-orchestrator.test.js](../../backend/__tests__/unit/algorithm-orchestrator.test.js)

测试关注点：

- 白名单校验：6 个合法 ID + 非法 ID 拒绝
- 策略族选择：≤50 exact / ≤500 heuristic / >500 metaheuristic
- 超限检测：OVERSIZE 错误
- 缓存命中：相同输入 <50ms 返回
- 确定性：相同 seed 相同输出

### 3.3 DBLFPackingEngine v25 系列（3 个文件）

| 文件 | 关注点 |
|---|---|
| DBLFPackingEngine-v25-CoG.test.js | 重心计算 |
| DBLFPackingEngine-v25-SnapToNeighbors.test.js | 邻居吸附 |
| DBLFPackingEngine-v25-SurfaceAttraction.test.js | 表面吸引 |

### 3.4 OptimizedPackingEngine 系列（10 个文件）

覆盖 Task3 / Task5.1 / Task5.2 / Task6 / Task7 / Task8 / Task9 / Task10 / Task11 / Task12 + 预处理。

---

## 4. fast-check 属性测试

### 4.1 总览

- 属性测试处数：93 处
- 设置文档：[backend/__tests__/setup/FAST_CHECK_SETUP.md](../../backend/__tests__/setup/FAST_CHECK_SETUP.md)
- 验证测试：[backend/__tests__/setup/fast-check-verification.test.js](../../backend/__tests__/setup/fast-check-verification.test.js)
- 数据生成器：[backend/__tests__/setup/test-data-generators.js](../../backend/__tests__/setup/test-data-generators.js)

### 4.2 属性测试关注点

fast-check 用于验证算法的不变量属性，典型场景：

- **确定性属性**：对任意合法输入，相同 seed 产生相同输出
- **无碰撞属性**：对任意输出，loadedCargo 中任意两件货物 AABB 不相交
- **边界属性**：对任意输出，所有货物在容器边界内
- **重量属性**：对任意输出，totalWeight < maxWeight
- **LIFO 属性**：对任意多目的港输出，portSequence 顺序满足 LIFO 硬约束
- **重心属性**：对任意输出，cogOffset 在阈值内（或触发拒绝）

### 4.3 测试数据生成器

代码位置：[backend/__tests__/setup/test-data-generators.js](../../backend/__tests__/setup/test-data-generators.js)

生成器提供：

- 随机货物生成（尺寸/重量/数量合法范围内）
- 随机柜型生成（20GP/40GP/40HQ）
- 随机 portSequence 分配
- 边界用例（超限/刚好 fit/缝隙）

---

## 5. 集成测试

### 5.1 集成测试目录

代码位置：[backend/__tests__/integration/](../../backend/__tests__/integration/)

| 文件 | 关注点 |
|---|---|
| cargo.test.js | 货物 API 集成 |
| container.test.js | 柜型 API 集成 |
| packing.test.js | 装箱 API 集成 |
| server.test.js | 服务器启动 |
| system-integration.test.js | 系统级集成 |
| comprehensive-integration.test.js | 综合集成 |
| miniprogram-request.test.js | 小程序请求 |
| template-import.test.js | 模板导入 |
| cog-offset-warning.test.js | 重心偏移告警 |
| v35-utilization-benchmark.test.js | v35 利用率基准 |

### 5.2 路演测试

代码位置：[backend/__tests__/roadshow/ai-packing-demo.test.js](../../backend/__tests__/roadshow/ai-packing-demo.test.js)

---

## 6. 测试配置

### 6.1 Jest 配置

代码位置：[backend/jest.config.js](../../backend/jest.config.js)

### 6.2 Jest Setup

代码位置：[backend/jest.setup.js](../../backend/jest.setup.js)

### 6.3 测试工具

| 文件 | 用途 |
|---|---|
| [backend/__tests__/setup/test-utilities.js](../../backend/__tests__/setup/test-utilities.js) | 测试工具函数 |
| [backend/__tests__/setup/test-data-generators.js](../../backend/__tests__/setup/test-data-generators.js) | 数据生成器 |
| [backend/__tests__/setup/test-data-generators.test.js](../../backend/__tests__/setup/test-data-generators.test.js) | 生成器自测 |

---

## 7. 确定性验证证据

### 7.1 stage3 确定性验证

代码位置：[output/playwright/stage3/algorithm/determinism-summary.json](../../output/playwright/stage3/algorithm/determinism-summary.json)

3 次相同请求的响应对比：

- 请求文件：[output/playwright/stage3/algorithm/request-1.json](../../output/playwright/stage3/algorithm/request-1.json) ~ request-3.json
- 响应文件：[output/playwright/stage3/algorithm/response-1.json](../../output/playwright/stage3/algorithm/response-1.json) ~ response-3.json
- 单算法闸门：[output/playwright/stage3/algorithm/single-algorithm-gate.json](../../output/playwright/stage3/algorithm/single-algorithm-gate.json)

### 7.2 确定性保证

- 无 Math.random() 调用
- 相同输入 + 相同 seed → 相同输出
- stage3 三次请求响应一致（VERIFIED）

---

## 8. 性能基准证据

### 8.1 Realistic4D 承诺

- 400 items < 200ms（VERIFIED，承诺值）
- 来源：[backend/services/Realistic4DPackingEngine.js:12](../../backend/services/Realistic4DPackingEngine.js)

### 8.2 实际性能（超时场景）

- 数据集：result-p2.txt，1280 件
- 耗时：300330ms（超时）
- 证据：[backend/result-p2.txt](../../backend/result-p2.txt)

> 该超时是已知限制，详见 [ALGORITHM_LIMITATIONS.md](./ALGORITHM_LIMITATIONS.md)。

### 8.3 v35 利用率基准

代码位置：[backend/__tests__/integration/v35-utilization-benchmark.test.js](../../backend/__tests__/integration/v35-utilization-benchmark.test.js)

---

## 9. 测试覆盖率声明

### 9.1 已覆盖

- 算法白名单校验
- 策略族选择
- 确定性
- 碰撞检测
- 重心计算
- LIFO 合规
- 缓存命中
- 超限检测

### 9.2 覆盖率未自动采集

- 仓库未配置 CI 自动覆盖率上报
- 覆盖率数值需本地运行 `npm test -- --coverage` 获取
- 本文件不提供具体百分比，避免编造

---

## 10. 测试运行方式

```bash
# 进入后端目录
cd backend

# 运行全部单元测试
npm test

# 运行特定文件
npx jest __tests__/unit/FastBlockPackingEngine.test.js

# 运行并生成覆盖率
npx jest --coverage

# 运行 fast-check 属性测试
npx jest __tests__/setup/fast-check-verification.test.js
```

---

## 11. 测试证据边界声明

- 测试用例数 486 为静态统计，实际运行可能有少量 skip
- fast-check 93 处为属性测试声明数，实际运行次数由 fast-check 自动决定（默认 100 次/属性）
- 集成测试依赖数据库环境，部分可能因环境缺失而 skip
- 确定性验证基于 stage3 三次请求，生产环境的确定性同样依赖 seed 一致
- 本文件不包含测试运行截图，评审可本地运行验证
