# 算法流程文档 (ALGORITHM_FLOW)

> 生成时间：2026-07-11
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`

---

## 1. 端到端生产链路流程

### 1.1 Mermaid 流程图（可编辑源代码）

```mermaid
flowchart TD
    A[Web 仪表盘 CargoPage] --> B[buildPackingRequest]
    B --> C[apiRequest POST /api/packing/generate]
    C --> D{algorithmId == 'fast-block'?}
    D -->|是| E[AlgorithmOrchestrator.execute]
    D -->|否| F{algorithmId 在白名单?}
    F -->|否| G[返回 UNKNOWN_ALGORITHM 错误]
    F -->|是| H[选择对应引擎]
    E --> I[selectStrategyFamily skuCount]
    I --> J{skuCount <= 50?}
    J -->|是| K[exact 精确策略]
    J -->|否| L{skuCount <= 500?}
    L -->|是| M[heuristic 启发式]
    L -->|否| N[metaheuristic 元启发式]
    K --> O[FastBlockPackingEngine.generatePackingPlan]
    M --> O
    N --> O
    H --> P[Realistic4DPackingEngine.generatePackingPlan]
    O --> Q[构建 loadedCargo / unloadedCargo]
    P --> Q
    Q --> R[计算 spaceUtilization / cog / cogOffset]
    R --> S[填充 metrics / constraintMeta / warnings]
    S --> T[ResultCache 写入 5min TTL]
    T --> U[返回 JSON 响应]
    U --> V[Web 仪表盘 TwinPage 渲染 3D]
```

### 1.2 关键代码位置

| 步骤 | 代码位置 |
|---|---|
| 前端请求构造 | [web-dashboard/src/services/packingApi.js:7](../../web-dashboard/src/services/packingApi.js) |
| 后端路由入口 | [backend/routes/packing.js](../../backend/routes/packing.js) |
| 白名单校验 | [backend/services/AlgorithmOrchestrator.js:91-99](../../backend/services/AlgorithmOrchestrator.js) |
| 策略族选择 | [backend/services/AlgorithmOrchestrator.js:64-72](../../backend/services/AlgorithmOrchestrator.js) |
| FastBlock 主流程 | [backend/services/FastBlockPackingEngine.js:36](../../backend/services/FastBlockPackingEngine.js) |
| Realistic4D 主流程 | [backend/services/Realistic4DPackingEngine.js](../../backend/services/Realistic4DPackingEngine.js) |
| 缓存写入 | [backend/services/ResultCache.js](../../backend/services/ResultCache.js) |

---

## 2. FastBlockPackingEngine 内部流程

### 2.1 Mermaid 流程图

```mermaid
flowchart TD
    Start([generatePackingPlan 入口]) --> Init[初始化容器/体积/装载状态]
    Init --> Sort[货物排序 portSequence升序→volume降序→weight降序]
    Sort --> GroupBySku[按 SKU 分组聚块]
    GroupBySku --> LoopStart{还有未处理 SKU 块?}
    LoopStart -->|是| Slice[_buildSlicePositions 生成切片位置]
    Slice --> Orient[_chooseOrientation 选择朝向]
    Orient --> CheckOrient{canInvert/canLayFlat 允许?}
    CheckOrient -->|不允许| FilterOrient[过滤不合法朝向]
    CheckOrient -->|允许| KeepOrient[保留全部朝向]
    FilterOrient --> Candidate[生成候选点]
    KeepOrient --> Candidate
    Candidate --> Collision{零容忍碰撞检测}
    Collision -->|碰撞| RejectCand[拒绝候选 dynamicBalanceRejections++]
    RejectCand --> Slice
    Collision -->|无碰撞| CoG[_calculateCoG 计算重心]
    CoG --> CoGOffset[_calculateCoGOffset 偏移百分比]
    CoGOffset --> CoGCheck{横向<=5% 且 纵向<=10%?}
    CoGCheck -->|否| RejectCand
    CoGCheck -->|是| LIFO[_checkLIFOHardConstraint LIFO 校验]
    LIFO --> LIFOCheck{earlier.minX+1 >= later.maxX?}
    LIFOCheck -->|否| RejectCand
    LIFOCheck -->|是| Place[放置货物 更新 loadedCargo]
    Place --> Weight{totalWeight < maxWeight?}
    Weight -->|否| Unload[移入 unloadedCargo]
    Weight -->|是| FillGap[_fillQueuedCargo 缝隙填充]
    FillGap --> LoopStart
    LoopStart -->|否| Build[构建输出结构]
    Unload --> Build
    Build --> Return([返回结果])
```

### 2.2 关键步骤说明

| 步骤 | 方法 | 代码位置 |
|---|---|---|
| 初始化 | `generatePackingPlan` 开头 | [backend/services/FastBlockPackingEngine.js:36](../../backend/services/FastBlockPackingEngine.js) |
| 货物排序 | 内部 sort | FastBlockPackingEngine.js |
| 切片生成 | `_buildSlicePositions` | FastBlockPackingEngine.js |
| 朝向选择 | `_chooseOrientation` | FastBlockPackingEngine.js |
| 碰撞检测 | `placeCargoWithCollisionCheck`（Realistic4D）/ 零容忍检查（FastBlock） | Realistic4DPackingEngine.js |
| 重心计算 | `_calculateCoG` | Realistic4DPackingEngine.js |
| 重心偏移 | `_calculateCoGOffset` | Realistic4DPackingEngine.js |
| LIFO 校验 | `_checkLIFOHardConstraint` | Realistic4DPackingEngine.js |
| 缝隙填充 | `_fillQueuedCargo` | FastBlockPackingEngine.js |

---

## 3. Realistic4DPackingEngine 内部流程

### 3.1 Mermaid 流程图

```mermaid
flowchart TD
    Start([generatePackingPlan 入口]) --> Init[初始化 heightMap 网格 40mm]
    Init --> Sort[货物排序 portSequence→volume→weight]
    Sort --> LoopStart{还有未放置货物?}
    LoopStart -->|是| Cand[精确边候选 注入物理边]
    Cand --> ZLane[Z-Lane 局部屏障计算]
    ZLane --> Score[砖墙评分 + SKU 磁吸评分]
    Score --> Best[选择最佳候选点]
    Best --> Collision{placeCargoWithCollisionCheck}
    Collision -->|碰撞| Reject[拒绝候选]
    Reject --> LoopStart
    Collision -->|无碰撞| CoG[_calculateCoG 重心]
    CoG --> CoGOff[_calculateCoGOffset]
    CoGOff --> Dyn{动态重心通过?}
    Dyn -->|否| Reject
    Dyn -->|是| LIFO[_checkLIFOHardConstraint]
    LIFO --> LifoOk{LIFO 通过?}
    LifoOk -->|否| Reject
    LifoOk -->|是| Place[placeCargo 更新 placedCargo]
    Place --> Update[更新 heightMap]
    Update --> LoopStart
    LoopStart -->|否| Build[构建 loadedCargo/unloadedCargo]
    Build --> Meta[填充 constraintMeta]
    Meta --> Return([返回结果])
```

### 3.2 Realistic4D 评分机制

| 评分项 | 权重 | 说明 |
|---|---|---|
| 砖墙评分（X 轴最小化） | 高 | 激进压缩 X 方向，强制紧凑 |
| SKU 磁吸 | 50000（封顶 5000） | 同 SKU 聚集奖励 |
| 地面优先（Y=0） | 高 | 优先贴地放置 |
| 接触面 | 中 | 底部接触地面或下层顶面 |

---

## 4. 调度器策略选择流程

### 4.1 Mermaid 流程图

```mermaid
flowchart LR
    Input[输入 cargoList] --> Count[统计 skuCount]
    Count --> Check1{skuCount <= 50?}
    Check1 -->|是| Exact[exact 精确策略]
    Check1 -->|否| Check2{skuCount <= 500?}
    Check2 -->|是| Heuristic[heuristic 启发式]
    Check2 -->|否| Meta[metaheuristic 元启发式]
    Exact --> Engine[调用对应引擎]
    Heuristic --> Engine
    Meta --> Engine
```

代码位置：[backend/services/AlgorithmOrchestrator.js:64-72](../../backend/services/AlgorithmOrchestrator.js)

---

## 5. 缓存命中流程

### 5.1 Mermaid 流程图

```mermaid
flowchart TD
    Req[收到请求] --> Key[计算缓存 key = hash(cargoList + container + options)]
    Key --> Lookup{ResultCache 命中?}
    Lookup -->|是| Hit[直接返回缓存结果 <50ms]
    Lookup -->|否| Miss[执行算法]
    Miss --> Write[写入缓存 TTL=5min]
    Write --> Return[返回结果]
```

代码位置：[backend/services/ResultCache.js](../../backend/services/ResultCache.js)

---

## 6. LIFO 卸货顺序流程

### 6.1 Mermaid 流程图

```mermaid
flowchart TD
    Cargo[货物列表] --> PortSort[按 portSequence 升序排序]
    PortSort --> Assign[分配 X 坐标]
    Assign --> Port1[Port 1 先卸 → 高 X 门端]
    Assign --> Port2[Port 2 中卸 → 中段]
    Assign --> Port3[Port 3 后卸 → 低 X 柜尾]
    Port1 --> Check[_checkLIFOHardConstraint]
    Port2 --> Check
    Port3 --> Check
    Check --> Valid{earlier.minX+1 >= later.maxX?}
    Valid -->|是| OK[LIFO 合规]
    Valid -->|否| Fail[LIFO 违规 拒绝候选]
```

### 6.2 LIFO 校验逻辑

```
对任意两个 portSequence: earlier < later
要求: earlier 货物的 minX + 1 >= later 货物的 maxX
```

即先卸货物（earlier）的最里侧（低 X 端）必须不比后卸货物（later）的最外侧（高 X 端）更靠门。这样卸货时不会因后卸货物挡住先卸货物而需要倒箱。

代码位置：Realistic4DPackingEngine `_checkLIFOHardConstraint`

---

## 7. 重心校验流程

### 7.1 Mermaid 流程图

```mermaid
flowchart TD
    Place[候选放置位置] --> CoG[_calculateCoG 加权平均]
    CoG --> Off[_calculateCoGOffset]
    Off --> Lat{横向偏移 <= 5%?}
    Lat -->|否| Reject[拒绝 dynamicBalanceRejections++]
    Lat -->|是| Lon{纵向偏移 <= 10%?}
    Lon -->|否| Reject
    Lon -->|是| Accept[接受候选]
```

### 7.2 偏移百分比公式

```
横向百分比 = |cog.z - width/2| / (width/2) * 100
纵向百分比 = |cog.x - length/2| / (length/2) * 100
```

代码位置：[backend/services/FastBlockPackingEngine.js:14-15](../../backend/services/FastBlockPackingEngine.js)（阈值常量）

---

## 8. 失败处理流程

### 8.1 Mermaid 流程图

```mermaid
flowchart TD
    Try[尝试放置] --> Err{错误类型}
    Err -->|OVERSIZE_OR_UNSUPPORTED_ORIENTATION| O1[货物超限或朝向不支持]
    Err -->|NO_CROSS_SECTION_CAPACITY| O2[截面无容量]
    Err -->|INSUFFICIENT_LENGTH| O3[剩余长度不足]
    Err -->|UNKNOWN_ALGORITHM| O4[算法不在白名单]
    O1 --> Unload[移入 unloadedCargo]
    O2 --> NextSlice[尝试下一切片]
    O3 --> NextSlice
    O4 --> Resp[返回错误响应]
    NextSlice --> Continue[继续处理下一货物]
    Unload --> Continue
```

---

## 9. 多目的港排序流程

### 9.1 Mermaid 流程图

```mermaid
flowchart LR
    Input[货物列表] --> PSort[portSequence 升序]
    PSort --> VSort[同港内 volume 降序]
    VSort --> WSort[同体积 weight 降序]
    WSort --> Output[排序后列表]
```

排序键（VERIFIED）：`portSequence` 升序 → `volume` 降序 → `weight` 降序

---

## 10. 缝隙填充流程

### 10.1 Mermaid 流程图

```mermaid
flowchart TD
    Main[主块放置完成] --> Queue[剩余同港批次货物入队]
    Queue --> Gap{存在可用缝隙?}
    Gap -->|是| Fill[_fillQueuedCargo]
    Fill --> Fit{货物尺寸适合缝隙?}
    Fit -->|是| Place[填入缝隙]
    Fit -->|否| Next[尝试下一缝隙]
    Next --> Gap
    Gap -->|否| Done[填充结束]
    Place --> Done
```

代码位置：FastBlockPackingEngine `_fillQueuedCargo`

---

## 11. 流程边界声明

- 以上流程基于代码静态分析，未包含运行时分支的全部细节
- FastBlock 与 Realistic4D 在候选点生成、评分机制上存在差异，但输出结构一致
- 缓存层对算法流程透明，命中缓存时跳过算法执行
- 失败处理不会中断整个流程，未放置货物统一进入 `unloadedCargo`
