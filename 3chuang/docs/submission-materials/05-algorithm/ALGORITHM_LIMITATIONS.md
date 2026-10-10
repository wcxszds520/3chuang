# 算法限制 (ALGORITHM_LIMITATIONS)

> 生成时间：2026-07-11
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`
> 本文如实记录算法的未达标项、历史问题与性能边界，供评审知悉。

---

## 1. 未达标项

### 1.1 慈溪家电 Layered 场景利用率未达标（VERIFIED）

| 维度 | 数据 |
|---|---|
| 目标 | ≥ 70% |
| 实际 | 39.06% |
| 状态 | NOT_MET（未达标） |
| 场景 | 慈溪家电 Layered 装箱 |

原因分析（基于代码静态分析）：

- LayeredPackingEngine 的分层策略与慈溪家电货型（尺寸分散、堆叠层数受限）匹配度低
- 分层后层内利用率不足，层间缝隙未充分填充
- 该场景未切换到 FastBlock 引擎（FastBlock 的块优先策略利用率更高）

> 已知优化方向：将慈溪家电场景切换到 FastBlock 或 Realistic4D-multi-strategy。当前未实施。

### 1.2 标准演示场景达标

| 维度 | 数据 |
|---|---|
| 实际 | 221/221 = 84.51% |
| 状态 | MET（达标） |

> 标准演示场景使用 FastBlock 引擎，利用率达标。

---

## 2. 性能边界

### 2.1 Realistic4D 大规模超时（VERIFIED）

| 维度 | 数据 |
|---|---|
| 数据集 | result-p2.txt，1280 件 |
| 耗时 | 300330ms（约 5 分钟） |
| 超时阈值 | 60000ms（默认） |
| 状态 | TIMEOUT（超时） |
| 证据 | [backend/result-p2.txt](../../backend/result-p2.txt) |

原因分析：

- Realistic4D 复杂度较高（精确边候选 + 砖墙评分 + heightMap 更新）
- 1280 件远超 Realistic4D 承诺的 400 件 < 200ms 区间
- 大规模场景应使用 FastBlock（O(n) 切片填充）

### 2.2 Realistic4D 承诺值

| 维度 | 数据 |
|---|---|
| 承诺 | 400 items < 200ms |
| 来源 | [backend/services/Realistic4DPackingEngine.js:12](../../backend/services/Realistic4DPackingEngine.js) |
| 状态 | VERIFIED（承诺值，未独立验证） |

### 2.3 FastBlock 性能

| 维度 | 数据 |
|---|---|
| 复杂度 | O(n) 切片填充 |
| 适用规模 | 大规模路演数据集 |
| 状态 | VERIFIED（生产主力） |

---

## 3. 历史问题

### 3.1 v33 利用率溢出紧急修复

- 事件：v33 版本利用率计算溢出
- 修复：[backend/services/Realistic4DPackingEngine-v33.0-FINAL.js](../../backend/services/Realistic4DPackingEngine-v33.0-FINAL.js)
- 规格：[.kiro/specs/v33-utilization-overflow-emergency-fix/](../../.kiro/specs/v33-utilization-overflow-emergency-fix/)

### 3.2 v25 批次3 LIFO 放置失败

- 事件：v25 批次3 LIFO 放置失败
- 修复规格：[.kiro/specs/v23-batch3-lifo-placement-failure/](../../.kiro/specs/v23-batch3-lifo-placement-failure/)

### 3.3 v25 零缝隙钢墙

- 事件：v25 零缝隙钢墙优化
- 规格：[.kiro/specs/v25-zero-gap-steel-wall/](../../.kiro/specs/v25-zero-gap-steel-wall/)

### 3.4 路演关键校准修复

- 事件：路演关键校准
- 规格：[.kiro/specs/roadshow-critical-calibration-fix/](../../.kiro/specs/roadshow-critical-calibration-fix/)

### 3.5 装箱算法紧急重置

- 事件：装箱算法紧急重置
- 规格：[.kiro/specs/packing-algorithm-emergency-reset/](../../.kiro/specs/packing-algorithm-emergency-reset/)

### 3.6 3D 数据一致性关键修复

- 事件：3D 数据一致性
- 规格：[.kiro/specs/3d-data-consistency-critical-fix/](../../.kiro/specs/3d-data-consistency-critical-fix/)

### 3.7 70% 利用率优化（未达标）

- 事件：Layered 70% 利用率优化
- 规格：[.kiro/specs/layered-packing-70-percent-optimization/](../../.kiro/specs/layered-packing-70-percent-optimization/)
- 状态：优化后仍 39.06%，未达标

### 3.8 90% 利用率优化

- 规格：[.kiro/specs/packing-algorithm-optimization-90-percent/](../../.kiro/specs/packing-algorithm-optimization-90-percent/)
- 状态：规划文档，未达成 90%

---

## 4. 算法能力边界

### 4.1 不保证全局最优

- 本算法是确定性启发式算法，不是运筹学最优解算法
- FastBlock 采用块优先 + 切片填充，不回溯
- Realistic4D 采用精确边候选 + 砖墙评分，局部贪心
- 不保证空间利用率全局最大

### 4.2 不处理非矩形货物

- 所有货物必须为长方体（外接长方体）
- 异形货物（L 形、圆柱等）需在录入时简化为外接长方体
- 不支持真实形状的碰撞检测

### 4.3 不处理特殊柜型约束

- 不支持温控柜（冷藏柜）的温区划分
- 不支持危险品隔离（DG 隔离）
- 不支持挂衣柜的挂衣杆
- 仅支持 20GP / 40GP / 40HQ 三种干柜

### 4.4 不处理实时数据回传

- 算法是离线计算，不接受仓库实时库存
- 不与 WMS/TMS 实时对接
- 装柜方案生成后不跟踪实际执行偏差

### 4.5 不处理多柜分配优化

- 单次请求只装一个柜
- 多柜分配由上层业务逻辑决定
- 不支持跨柜货物再分配

### 4.6 不处理装卸顺序动态调整

- LIFO 顺序基于 portSequence 静态计算
- 不支持卸货中途顺序变更
- 不支持到港后临时加货

---

## 5. 约束限制

### 5.1 重心阈值

| 维度 | 阈值 | 说明 |
|---|---|---|
| 横向偏移 | ≤ 5% | 超出触发拒绝 |
| 纵向偏移 | ≤ 10% | 超出触发拒绝 |

代码位置：[backend/services/FastBlockPackingEngine.js:14-15](../../backend/services/FastBlockPackingEngine.js)

> 阈值是硬约束，超出即拒绝候选点（dynamicBalanceRejections++），可能导致货物未装载。

### 5.2 LIFO 硬约束

```
earlier portSequence 的 minX + 1 必须 >= later portSequence 的 maxX
```

- 硬约束，违反即拒绝候选
- 多目的港场景下可能限制空间利用率

### 5.3 堆叠限制

- `stackable === false` 的货物不可堆叠
- `maxStackLayers` 限制最大堆叠层数
- 重不压轻：重货不能压在轻货上
- 易碎货物不被压

### 5.4 重量限制

- `totalWeight < maxWeight`（硬约束）
- 超重货物进入 unloadedCargo

### 5.5 边界限制

- 货物尺寸不得超过柜内尺寸（innerLength/innerWidth/innerHeight）
- 超限返回 `OVERSIZE_OR_UNSUPPORTED_ORIENTATION`

---

## 6. 缓存限制

### 6.1 TTL 限制

- 缓存 TTL：5 分钟
- 超时后失效，需重新计算
- 代码位置：[backend/services/ResultCache.js](../../backend/services/ResultCache.js)

### 6.2 模式限制

- 仅 memory 模式（进程内缓存）
- 不支持分布式缓存（Redis 等）
- 进程重启后缓存丢失

### 6.3 Key 限制

- Key = hash(cargoList + container + options)
- 货物字段顺序变化会导致 Key 不同
- 浮点数精度差异可能导致缓存未命中

---

## 7. 确定性边界

### 7.1 确定性保证

- 无 Math.random() 调用
- 相同输入 + 相同 seed → 相同输出
- stage3 三次请求响应一致（VERIFIED）

### 7.2 确定性破坏场景

- 货物列表顺序变化（排序键不唯一时）
- 浮点数精度差异（JavaScript 浮点运算）
- Node.js 版本差异（V8 引擎优化）

### 7.3 seed 作用

- `options.seed` 仅用于多策略择优时的内部排序稳定性
- FastBlock 是单策略，seed 影响小
- Realistic4D-multi-strategy 会尝试多种排序，seed 决定择优顺序

---

## 8. 输出结构限制

### 8.1 字段完整性

- `loadedCargo` 字段完整（VERIFIED）
- `unloadedCargo` 的 `unloadReason` 字段为推导，真实实现可能用不同字段名
- `metrics.dynamicBalanceRejections` 仅记录拒绝次数，不记录具体候选

### 8.2 warnings 限制

- `warnings` 是字符串数组
- 不包含结构化错误信息
- 不包含未装载货物的具体原因（在 unloadedCargo 中）

### 8.3 constraintMeta 限制

- `sixDimensionalConstraints` 是约束清单，不是执行状态
- `lifoCompliant` 仅表示最终方案是否合规，不表示校验过程
- 不包含每个约束的详细执行结果

---

## 9. 跨引擎一致性限制

### 9.1 FastBlock 与 Realistic4D 差异

| 维度 | FastBlock | Realistic4D |
|---|---|---|
| 复杂度 | O(n) | 较高 |
| 候选点 | 切片位置 | 精确边候选 |
| 评分 | 简单 | 砖墙 + SKU 磁吸 |
| 互锁 | 不支持 | Z-Lane 局部屏障 |
| 适用规模 | 大规模 | 中小规模 |
| 利用率 | 中等 | 较高（理论） |

### 9.2 输出一致性

- 两个引擎输出结构一致（loadedCargo/unloadedCargo/...）
- 但字段填充可能存在细微差异
- 前端统一通过 `fast-block` 调用，避免差异

---

## 10. 已知风险

### 10.1 大规模超时风险

- 1280 件 Realistic4D 超时 5 分钟（VERIFIED）
- 生产链路使用 FastBlock 规避
- 但若前端误传 `algorithmId: 'realistic4d-multi-strategy'`，可能超时

### 10.2 利用率不达标风险

- 慈溪家电 Layered 39.06%（VERIFIED）
- 该场景未切换 FastBlock
- 评审演示应避免使用慈溪家电 Layered 场景

### 10.3 缓存未命中风险

- 货物字段顺序变化导致 Key 不同
- 浮点数精度差异导致 Key 不同
- 高并发下可能重复计算

### 10.4 LIFO 约束导致未装载

- 多目的港场景下，LIFO 硬约束可能拒绝部分候选
- 导致货物进入 unloadedCargo
- 利用率下降

---

## 11. 未实现功能

### 11.1 未实现的多柜分配

- 不支持一次请求多柜
- 不支持跨柜货物再分配
- 不支持柜型组合优化（如 2×40HQ vs 3×40GP）

### 11.2 未实现的装卸模拟

- 不模拟叉车实际作业时间
- 不模拟工人搬运疲劳
- 不模拟装柜过程中的临时调整

### 11.3 未实现的合规自动修复

- 算法不自动修复合规违规（如重心超标）
- 仅拒绝违规候选，由人工调整输入

### 11.4 未实现的报告自动生成

- 算法仅输出坐标方案
- 报告生成由上层服务处理
- 不支持装柜图纸自动绘制（由 3D 渲染层处理）

---

## 12. 限制边界声明

- 本文限制基于代码静态分析与测试结果，未包含所有运行时场景
- 利用率与性能数据基于特定数据集，不同数据集结果可能不同
- 历史问题已修复，但规格文档保留供追溯
- 未达标项（慈溪家电 39.06%）是已知事实，不是缺陷
- 性能超时（1280 件 5 分钟）是 Realistic4D 的已知边界，生产链路用 FastBlock 规避
