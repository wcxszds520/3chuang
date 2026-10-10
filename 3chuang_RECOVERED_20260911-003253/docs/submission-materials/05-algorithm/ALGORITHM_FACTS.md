# 算法事实总览 (ALGORITHM_FACTS)

> 生成时间：2026-07-11
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`
> 状态分级：VERIFIED（已核实）/ IMPLEMENTED_UNVERIFIED（已实现未核实）/ PARTIAL（部分实现）/ PLANNED（计划中）/ NOT_FOUND（未发现）

---

## 1. 算法名称与定位

| 维度 | 内容 | 证据 |
|---|---|---|
| 生产主力算法 | FastBlockPackingEngine（块优先装箱，确定性） | [backend/services/FastBlockPackingEngine.js:10](../../backend/services/FastBlockPackingEngine.js) |
| 备用算法 | Realistic4DPackingEngine v34.7-Interlocking | [backend/services/Realistic4DPackingEngine.js:1](../../backend/services/Realistic4DPackingEngine.js) |
| 调度器 | AlgorithmOrchestrator（根据 SKU 数选择策略族） | [backend/services/AlgorithmOrchestrator.js:47](../../backend/services/AlgorithmOrchestrator.js) |
| 前端唯一算法标识 | `AUTHORITATIVE_ALGORITHM_ID = 'fast-block'` | [web-dashboard/src/services/packingApi.js:5](../../web-dashboard/src/services/packingApi.js) |
| 默认算法（后端） | `realistic4d-multi-strategy` | [backend/services/AlgorithmOrchestrator.js:91](../../backend/services/AlgorithmOrchestrator.js) |

> 说明：前端 Web 仪表盘的 `packingApi.js` 仅向 `/api/packing/generate` 提交 `algorithmId: 'fast-block'`，因此生产链路的实际执行算法是 FastBlockPackingEngine。后端 `AlgorithmOrchestrator.execute` 在未指定 `algorithmId` 时默认走 `realistic4d-multi-strategy`，但该默认值在生产链路中不会被命中（前端始终显式传 `fast-block`）。

---

## 2. 算法白名单

算法白名单共 6 个 ID（VERIFIED）：

| # | 算法 ID | 所属引擎 | 用途 |
|---|---|---|---|
| 1 | `realistic4d` | Realistic4DPackingEngine | 基础版本 |
| 2 | `realistic4d-weight-first` | Realistic4DPackingEngine | 重量优先排序 |
| 3 | `realistic4d-volume-first` | Realistic4DPackingEngine | 体积优先排序 |
| 4 | `realistic4d-mixed` | Realistic4DPackingEngine | 混合排序 |
| 5 | `realistic4d-multi-strategy` | Realistic4DPackingEngine | 多策略择优（默认） |
| 6 | `fast-block` | FastBlockPackingEngine | 块优先快速装箱（生产主力） |

代码位置：[backend/services/AlgorithmOrchestrator.js:24-31](../../backend/services/AlgorithmOrchestrator.js)

```js
const ALGORITHM_WHITELIST = [
  'realistic4d',
  'realistic4d-weight-first',
  'realistic4d-volume-first',
  'realistic4d-mixed',
  'realistic4d-multi-strategy',
  'fast-block'
];
```

任何不在白名单内的 `algorithmId` 都会被 `AlgorithmOrchestrator.execute` 拒绝并返回 `UNKNOWN_ALGORITHM` 错误。

---

## 3. 版本演进

| 版本 | 引擎 | 关键特性 | 证据 |
|---|---|---|---|
| v25 | DBLFPackingEngine | 双层堆叠 + 重心约束 | [backend/services/DBLFPackingEngine-v26.2.js](../../backend/services/DBLFPackingEngine-v26.2.js) |
| v33.0-FINAL | Realistic4DPackingEngine | 40mm 网格步长（300 items < 200ms） | [backend/services/Realistic4DPackingEngine.js:26](../../backend/services/Realistic4DPackingEngine.js) |
| v34.3 | Realistic4DPackingEngine | 砖墙评分（强制 X 轴紧凑） | Realistic4DPackingEngine.js 头注释 |
| v34.6 | Realistic4DPackingEngine | 精确边候选（O(N) 零缝隙） | Realistic4DPackingEngine.js 头注释 |
| v34.7-Interlocking | Realistic4DPackingEngine | Z-Lane 局部屏障（类俄罗斯方块互锁） | Realistic4DPackingEngine.js 头注释 |
| 当前生产 | FastBlockPackingEngine | 块优先装箱（确定性、大规模路演） | [backend/services/FastBlockPackingEngine.js:10](../../backend/services/FastBlockPackingEngine.js) |

### Realistic4DPackingEngine v34.7 八大核心保证

来源：[backend/services/Realistic4DPackingEngine.js:4-12](../../backend/services/Realistic4DPackingEngine.js)

1. Y 轴地面优先（Y=0 first，绝对重力轴）
2. LIFO 逻辑（Port 1 先卸靠门端高 X，Port 3 后卸靠柜尾低 X）
3. Z-Lane 局部屏障（按候选点单独计算屏障，允许互锁）
4. 精确边候选（注入物理边实现 O(N) 零缝隙装箱）
5. 砖墙评分（激进 X 轴最小化，强制紧凑）
6. SKU 磁吸（同色块奖励 50000，封顶 5000）
7. 零容忍碰撞（100% 物理溢出保护）
8. 性能承诺（400 items < 200ms）

---

## 4. 调度策略族

`AlgorithmOrchestrator.selectStrategyFamily(skuCount)` 根据 SKU 种类数选择策略族（VERIFIED）：

| SKU 数 | 策略族 | 含义 |
|---|---|---|
| ≤ 50 | `exact` | 精确策略 |
| ≤ 500 | `heuristic` | 启发式策略 |
| > 500 | `metaheuristic` | 元启发式策略 |

代码位置：[backend/services/AlgorithmOrchestrator.js:64-72](../../backend/services/AlgorithmOrchestrator.js)

阈值常量：[backend/services/AlgorithmOrchestrator.js:42-45](../../backend/services/AlgorithmOrchestrator.js)

```js
const STRATEGY_THRESHOLDS = {
  EXACT_MAX_SKU: 50,
  HEURISTIC_MAX_SKU: 500
};
```

---

## 5. 六类业务约束协同机制澄清（重要）

> **"Fast Block多约束三维装箱引擎"不存在**。`constraintMeta.sixDimensionalConstraints` 是一个约束清单字段，不是一个独立算法，也不是六个维度的加权求和。

六个维度是六类装箱约束（VERIFIED）：

| # | 维度 | 含义 | 实现位置 |
|---|---|---|---|
| 1 | LIFO 卸货顺序 | 按 portSequence 排序，先卸货靠门端高 X | Realistic4DPackingEngine `_checkLIFOHardConstraint` |
| 2 | 动态重心 | 横向/纵向重心偏移百分比限制 | Realistic4DPackingEngine `_calculateCoGOffset` |
| 3 | 同 SKU 聚集 | 同 SKU 货物聚集成块（磁吸） | Realistic4DPackingEngine SKU 磁吸评分 |
| 4 | 堆叠与重不压轻安全 | stackable/maxStackLayers/重不压轻 | Realistic4DPackingEngine `_chooseOrientation` |
| 5 | 叉车人工搬运可达性 | 门洞范围、叉车路径、人工可达 | operationMachine + geometry.validateCargoPath |
| 6 | VGM 总重合规 | totalWeight < maxWeight（SOLAS VGM） | Realistic4DPackingEngine 边界约束 |

`constraintMeta` 输出结构（VERIFIED）：

```json
{
  "sixDimensionalConstraints": ["lifo", "cog", "sku-clustering", "stacking-safety", "reachability", "vgm"],
  "lifoCompliant": true,
  "fillPolicy": "block-first",
  "topFillPolicy": "manual-reach",
  "securingPolicy": "friction-only",
  "doorSide": "high-x",
  "deepestSide": "low-x"
}
```

---

## 6. 坐标系（锁定）

来源：[backend/services/Realistic4DPackingEngine.js:14-18](../../backend/services/Realistic4DPackingEngine.js) 与 [backend/services/FastBlockPackingEngine.js](../../backend/services/FastBlockPackingEngine.js)

| 轴 | 含义 | 范围 | 说明 |
|---|---|---|---|
| X | 长度 | 0 → innerLength | 门端在高 X（X=innerLength），柜尾在低 X（X=0） |
| Y | 高度 | 0 → innerHeight | 地面 Y=0（重力轴），顶部 Y=innerHeight |
| Z | 宽度 | 0 → innerWidth | 左侧 Z=0，右侧 Z=innerWidth |

- 单位：毫米（mm）
- 渲染层乘 0.001 转米（Three.js 场景）

> 注意：Realistic4DPackingEngine 头注释中写有"柜门(X=0)"，但生产链路（FastBlock + 前端 3D）统一采用"门端在高 X"。以本文件为准。

---

## 7. 柜型规格

| 柜型 | innerLength (mm) | innerWidth (mm) | innerHeight (mm) | maxWeight (kg) |
|---|---|---|---|---|
| 20GP | 5898 | 2352 | 2393 | 28000 |
| 40GP | 12032 | 2352 | 2393 | 26000 |
| 40HQ | 12032 | 2352 | 2698 | 26000 |

超限检测常量：[backend/services/AlgorithmOrchestrator.js:34-39](../../backend/services/AlgorithmOrchestrator.js)

```js
const MAX_CONTAINER_DIMENSIONS = {
  maxLength: 12032,   // mm
  maxWidth: 2352,     // mm
  maxHeight: 2698,    // mm (40HQ)
  maxWeight: 26000    // kg
};
```

---

## 8. 关键排序与候选点

### 8.1 货物排序

排序键（VERIFIED）：`portSequence` 升序 → `volume` 降序 → `weight` 降序

- 先按目的港顺序（LIFO 卸货）
- 同港内体积大的优先
- 同体积重量大的优先

### 8.2 候选点生成

- Fast Block多约束三维装箱引擎：`_buildSlicePositions`，按截面容量生成切片位置
- Realistic4D：精确边候选（v34.6），注入物理边实现零缝隙

### 8.3 旋转规则

`_chooseOrientation`（VERIFIED）：

- 考虑 `canInvert`（允许倒置）
- 考虑 `canLayFlat`（允许平放）
- 默认尝试 6 种朝向，按砖墙评分择优

### 8.4 碰撞检测

- 零容忍（VERIFIED）：Realistic4D `placeCargoWithCollisionCheck` 任何重叠即拒绝
- 边界约束：innerLength / innerWidth / innerHeight / maxWeight
- 重量限制：`totalWeight < maxWeight`

---

## 9. 重心计算

### 9.1 重心坐标

`_calculateCoG`（VERIFIED）：按重量加权平均

```
cog.x = Σ(cargo.x * cargo.weight) / Σ(cargo.weight)
cog.y = Σ(cargo.y * cargo.weight) / Σ(cargo.weight)
cog.z = Σ(cargo.z * cargo.weight) / Σ(cargo.weight)
```

### 9.2 重心偏移百分比

`_calculateCoGOffset`（VERIFIED）：

- 横向百分比 = `|cog.z - width/2| / (width/2) * 100`
- 纵向百分比 = `|cog.x - length/2| / (length/2) * 100`

FastBlock 默认阈值：[backend/services/FastBlockPackingEngine.js:14-15](../../backend/services/FastBlockPackingEngine.js)

```js
lateralLimitPercent: 5,
finalLongitudinalLimitPercent: 10,
```

超出阈值会触发 `dynamicBalanceRejections` 计数，并拒绝该候选点。

---

## 10. SKU 连续性与缝隙利用

### 10.1 SKU 连续性

同 SKU 聚集成块（VERIFIED）：FastBlock 将同 SKU 货物打包成一个块，统一放置；Realistic4D 通过磁吸评分（50000 奖励，封顶 5000）鼓励聚集。

### 10.2 接触面规则

- 底部必须接触地面（Y=0）或下层货物顶面
- 不允许悬空

### 10.3 缝隙利用

`_fillQueuedCargo`（VERIFIED）：同港批次填充，将剩余小件货物填入主块之间的缝隙。

### 10.4 多目的港 LIFO

- 按 `portSequence` 排序
- 先卸货（小 portSequence）靠门端高 X
- 后卸货（大 portSequence）靠柜尾低 X

### 10.5 LIFO 硬约束校验

`_checkLIFOHardConstraint`（VERIFIED）：

```
earlier portSequence 的 minX + 1 必须 >= later portSequence 的 maxX
```

即先卸货物的最里侧（低 X 端）必须不比后卸货物的最外侧（高 X 端）更靠门。

---

## 11. 货物属性判定

| 属性 | 判定规则 | 证据 |
|---|---|---|
| 易碎 | `fragile === true` | 货物字段 |
| 重货 | `weight >= 20`（kg） | FastBlock 阈值 |
| 木包装 | `packagingType` 含 `wood` 或 `pallet` | 字符串匹配 |
| 不可堆叠 | `stackable === false` | 货物字段 |

---

## 12. 失败处理

| 错误码 | 含义 | 触发场景 |
|---|---|---|
| `OVERSIZE_OR_UNSUPPORTED_ORIENTATION` | 超限或不支持的朝向 | 货物尺寸超过柜内尺寸 |
| `NO_CROSS_SECTION_CAPACITY` | 截面无容量 | 当前切片无法容纳货物 |
| `INSUFFICIENT_LENGTH` | 长度不足 | 剩余 X 长度不足以放置货物 |
| `UNKNOWN_ALGORITHM` | 未知算法 | algorithmId 不在白名单 |

---

## 13. 性能与缓存

### 13.1 复杂度

| 算法 | 复杂度 | 说明 |
|---|---|---|
| FastBlock | O(n) 切片填充 | 线性扫描，无回溯 |
| Realistic4D | 较高 | 精确边候选 + 砖墙评分 |

### 13.2 随机性

- **无随机性**（VERIFIED）：确定性算法，相同输入 + 相同 seed → 相同输出
- `options.seed` 仅用于多策略择优时的内部排序稳定性

### 13.3 缓存

`ResultCache`（VERIFIED）：

- 模式：memory
- TTL：5 分钟
- 命中缓存时 50ms 内返回
- 代码位置：[backend/services/ResultCache.js](../../backend/services/ResultCache.js)

### 13.4 性能数据

| 场景 | 数据 | 状态 |
|---|---|---|
| Realistic4D 承诺 | 400 items < 200ms | VERIFIED（承诺值） |
| 实际 result-p2.txt | 1280 件耗时 300330ms（超时） | VERIFIED（实际值，超时） |

证据：[backend/result-p2.txt](../../backend/result-p2.txt)

---

## 14. 生产链路（端到端）

```
[Web 仪表盘 CargoPage]
  → buildPackingRequest({ containerType, cargoList })
  → apiRequest('/api/packing/generate', { algorithmId: 'fast-block', ... })
  → [后端 routes/packing.js]
  → AlgorithmOrchestrator.execute({ cargoList, container, options })
  → 白名单校验（fast-block 通过）
  → selectStrategyFamily(skuCount)
  → FastBlockPackingEngine.generatePackingPlan(cargoList, container)
  → 返回 loadedCargo / unloadedCargo / spaceUtilization / cog / metrics / constraintMeta
  → ResultCache 写入（5 分钟 TTL）
  → [Web 仪表盘 TwinPage] 渲染 3D 作业过程
```

关键代码位置：

1. 前端请求构造：[web-dashboard/src/services/packingApi.js:7](../../web-dashboard/src/services/packingApi.js)
2. 后端路由：[backend/routes/packing.js](../../backend/routes/packing.js)
3. 调度器：[backend/services/AlgorithmOrchestrator.js:86](../../backend/services/AlgorithmOrchestrator.js)
4. 主力引擎：[backend/services/FastBlockPackingEngine.js:36](../../backend/services/FastBlockPackingEngine.js)
5. 缓存：[backend/services/ResultCache.js](../../backend/services/ResultCache.js)

---

## 15. 利用率基准

| 场景 | 目标 | 实际 | 状态 |
|---|---|---|---|
| 慈溪家电 Layered | ≥ 70% | 39.06% | NOT_MET（未达标） |
| 标准演示 | - | 221/221 = 84.51% | MET（达标） |

> 慈溪家电场景未达标是已知限制，详见 [ALGORITHM_LIMITATIONS.md](./ALGORITHM_LIMITATIONS.md)。

---

## 16. 测试覆盖

- 单元测试目录：`backend/__tests__/unit/`
- 文件数：27 个
- 用例数：486 个
- fast-check 属性测试：93 处

详见 [ALGORITHM_TEST_EVIDENCE.md](./ALGORITHM_TEST_EVIDENCE.md)。

---

## 17. 边界声明

- 本算法是确定性装箱算法，不是运筹学最优解算法
- 不保证全局最优，保证可行解 + 约束合规
- 不处理非矩形货物（异形货物需在录入时简化为外接长方体）
- 不处理温控柜、危险品隔离等特殊柜型约束
- 3D 作业过程可视化基于算法返回的坐标，不是物理仿真
