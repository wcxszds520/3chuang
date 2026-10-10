# 算法伪代码 (ALGORITHM_PSEUDOCODE)

> 生成时间：2026-07-11
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`
> 本文用伪代码描述 FastBlockPackingEngine 与 Realistic4DPackingEngine 的核心逻辑，便于评审理解。

---

## 1. FastBlockPackingEngine 伪代码

### 1.1 主流程

```
FUNCTION generatePackingPlan(cargoList, container)
    // 初始化
    container = normalizeContainer(container)
    containerVolume = container.innerLength * container.innerWidth * container.innerHeight
    loadedCargo = []
    unloadedCargo = []
    loadingIndex = 0
    loadedWeight = 0
    dynamicBalanceRejections = 0

    // 1. 货物排序：portSequence 升序 → volume 降序 → weight 降序
    sortedCargo = sort(cargoList, by=[
        portSequence ASC,
        volume DESC,
        weight DESC
    ])

    // 2. 按 SKU 分组聚块
    skuBlocks = groupBySku(sortedCargo)

    // 3. 逐块处理
    FOR EACH block IN skuBlocks
        placed = tryPlaceBlock(block, container)
        IF NOT placed
            // 缝隙填充尝试
            filled = fillQueuedCargo(block, container)
            IF NOT filled
                unloadedCargo.append(block.cargoes)
            END IF
        END IF
    END FOR

    // 4. 计算汇总指标
    spaceUtilization = totalLoadedVolume / containerVolume * 100
    totalWeight = loadedWeight
    cog = calculateCoG(loadedCargo)
    cogOffset = calculateCoGOffset(cog, container)
    metrics = {
        algorithm: 'fast-block',
        elapsedMs: now() - startTime,
        totalVolume: totalLoadedVolume,
        dynamicBalanceRejections: dynamicBalanceRejections
    }
    constraintMeta = {
        sixDimensionalConstraints: ['lifo','cog','sku-clustering','stacking-safety','reachability','vgm'],
        lifoCompliant: true,
        fillPolicy: 'block-first',
        topFillPolicy: 'manual-reach',
        securingPolicy: 'friction-only',
        doorSide: 'high-x',
        deepestSide: 'low-x'
    }

    RETURN {
        loadedCargo,
        unloadedCargo,
        spaceUtilization,
        totalWeight,
        totalCargoCount: loadedCargo.length,
        cog,
        cogOffset,
        metrics,
        constraintMeta,
        warnings: []
    }
END FUNCTION
```

代码位置：[backend/services/FastBlockPackingEngine.js:36](../../backend/services/FastBlockPackingEngine.js)

### 1.2 块放置逻辑

```
FUNCTION tryPlaceBlock(block, container)
    // 1. 构建切片位置
    slicePositions = buildSlicePositions(container, block)

    FOR EACH sliceX IN slicePositions
        // 2. 选择朝向
        orientations = chooseOrientation(block, container)
        validOrientations = filterByCanInvertCanLayFlat(orientations, block)

        FOR EACH orient IN validOrientations
            candidate = { x: sliceX, y: 0, z: 0, orientation: orient }

            // 3. 零容忍碰撞检测
            IF placeCargoWithCollisionCheck(candidate, loadedCargo) == COLLISION
                dynamicBalanceRejections++
                CONTINUE
            END IF

            // 4. 重心校验
            cog = calculateCoG(loadedCargo + [candidate])
            offset = calculateCoGOffset(cog, container)
            IF offset.lateralPercent > 5 OR offset.longitudinalPercent > 10
                dynamicBalanceRejections++
                CONTINUE
            END IF

            // 5. LIFO 硬约束校验
            IF NOT checkLIFOHardConstraint(candidate, loadedCargo)
                CONTINUE
            END IF

            // 6. 重量校验
            IF loadedWeight + block.weight >= container.maxWeight
                RETURN FALSE  // 移入 unloadedCargo
            END IF

            // 7. 放置
            placeCargo(candidate)
            loadedWeight += block.weight
            RETURN TRUE
        END FOR
    END FOR

    RETURN FALSE
END FUNCTION
```

### 1.3 切片位置生成

```
FUNCTION buildSlicePositions(container, block)
    positions = []
    remainingLength = container.innerLength

    // 按截面容量生成切片
    WHILE remainingLength > 0
        sliceCapacity = computeCrossSectionCapacity(
            container.innerWidth,
            container.innerHeight,
            block.footprint
        )
        IF sliceCapacity == 0
            // NO_CROSS_SECTION_CAPACITY
            BREAK
        END IF

        sliceLength = min(block.totalLength / sliceCapacity, remainingLength)
        positions.append(currentX)
        currentX += sliceLength
        remainingLength -= sliceLength
    END WHILE

    IF remainingLength < block.minLength
        // INSUFFICIENT_LENGTH
        markBlockAsUnloadable(block)
    END IF

    RETURN positions
END FUNCTION
```

### 1.4 朝向选择

```
FUNCTION chooseOrientation(block, container)
    candidates = [
        { l: block.length, w: block.width, h: block.height },   // 原始
        { l: block.width,  w: block.length, h: block.height },  // 旋转 90°
        { l: block.length, w: block.height, h: block.width },   // 平放（若 canLayFlat）
        { l: block.height, w: block.width, h: block.length },   // 倒置（若 canInvert）
        { l: block.width,  w: block.height, h: block.length },
        { l: block.height, w: block.length, h: block.width }
    ]

    valid = []
    FOR EACH orient IN candidates
        IF orient.l > container.innerLength THEN CONTINUE
        IF orient.w > container.innerWidth THEN CONTINUE
        IF orient.h > container.innerHeight THEN CONTINUE

        IF NOT block.canLayFlat AND isLayFlat(orient) THEN CONTINUE
        IF NOT block.canInvert AND isInverted(orient) THEN CONTINUE

        valid.append(orient)
    END FOR

    // 按砖墙评分排序（X 轴最小化优先）
    RETURN sortByBrickWallScore(valid, container)
END FUNCTION
```

### 1.5 缝隙填充

```
FUNCTION fillQueuedCargo(block, container)
    queue = block.remainingCargoes

    FOR EACH cargo IN queue
        placed = FALSE
        FOR EACH gap IN findGaps(loadedCargo, container)
            IF cargoFitsInGap(cargo, gap)
                candidate = alignCargoToGap(cargo, gap)
                IF placeCargoWithCollisionCheck(candidate, loadedCargo) == NO_COLLISION
                    cog = calculateCoG(loadedCargo + [candidate])
                    offset = calculateCoGOffset(cog, container)
                    IF offset.lateralPercent <= 5 AND offset.longitudinalPercent <= 10
                        IF checkLIFOHardConstraint(candidate, loadedCargo)
                            placeCargo(candidate)
                            placed = TRUE
                            BREAK
                        END IF
                    END IF
                END IF
            END IF
        END FOR

        IF NOT placed
            unloadedCargo.append(cargo)
        END IF
    END FOR

    RETURN TRUE
END FUNCTION
```

### 1.6 LIFO 硬约束校验

```
FUNCTION checkLIFOHardConstraint(candidate, loadedCargo)
    candidatePort = candidate.portSequence

    FOR EACH placed IN loadedCargo
        IF placed.portSequence > candidatePort
            // candidate 是先卸货（earlier），placed 是后卸货（later）
            // 要求: candidate.minX + 1 >= placed.maxX
            IF candidate.minX + 1 < placed.maxX
                RETURN FALSE
            END IF
        ELSE IF placed.portSequence < candidatePort
            // placed 是先卸货（earlier），candidate 是后卸货（later）
            // 要求: placed.minX + 1 >= candidate.maxX
            IF placed.minX + 1 < candidate.maxX
                RETURN FALSE
            END IF
        END IF
    END FOR

    RETURN TRUE
END FUNCTION
```

### 1.7 重心计算

```
FUNCTION calculateCoG(cargoes)
    totalWeight = SUM(cargo.weight FOR cargo IN cargoes)
    IF totalWeight == 0
        RETURN { x: 0, y: 0, z: 0 }
    END IF

    RETURN {
        x: SUM(cargo.x * cargo.weight) / totalWeight,
        y: SUM(cargo.y * cargo.weight) / totalWeight,
        z: SUM(cargo.z * cargo.weight) / totalWeight
    }
END FUNCTION

FUNCTION calculateCoGOffset(cog, container)
    halfWidth = container.innerWidth / 2
    halfLength = container.innerLength / 2

    RETURN {
        lateralPercent: ABS(cog.z - halfWidth) / halfWidth * 100,
        longitudinalPercent: ABS(cog.x - halfLength) / halfLength * 100
    }
END FUNCTION
```

---

## 2. Realistic4DPackingEngine 伪代码

### 2.1 主流程

```
FUNCTION generatePackingPlan(cargoList, container)
    // 初始化
    container = normalizeContainer(container)
    placedCargo = []
    loadingIndex = 0
    gridStep = 40  // v33.0: 40mm 网格
    heightMap = initHeightMap(container, gridStep)
    dynamicBalanceRejections = 0

    // 货物排序
    sortedCargo = sort(cargoList, by=[
        portSequence ASC,
        volume DESC,
        weight DESC
    ])

    // 逐件放置
    FOR EACH cargo IN sortedCargo
        placed = FALSE
        FOR EACH copy IN 1..cargo.quantity
            result = tryPlaceCargo(cargo, container, heightMap, placedCargo)
            IF result.success
                placedCargo.append(result.placement)
                updateHeightMap(heightMap, result.placement)
                placed = TRUE
            ELSE
                unloadedCargo.append(cargo)
                placed = FALSE
                BREAK
            END IF
        END FOR
    END FOR

    // 构建输出
    loadedCargo = expandToLoadedCargoContract(placedCargo)
    spaceUtilization = computeUtilization(placedCargo, container)
    cog = calculateCoG(loadedCargo)
    cogOffset = calculateCoGOffset(cog, container)

    RETURN {
        loadedCargo,
        unloadedCargo,
        spaceUtilization,
        totalWeight,
        totalCargoCount: loadedCargo.length,
        cog,
        cogOffset,
        metrics: {
            algorithm: 'realistic4d-multi-strategy',
            elapsedMs: now() - startTime,
            totalVolume,
            dynamicBalanceRejections
        },
        constraintMeta: { ... },
        warnings: []
    }
END FUNCTION
```

代码位置：[backend/services/Realistic4DPackingEngine.js](../../backend/services/Realistic4DPackingEngine.js)

### 2.2 候选点生成（精确边注入）

```
FUNCTION generateCandidates(cargo, container, heightMap, placedCargo)
    candidates = []

    // 1. 注入物理边（v34.6 精确边候选）
    edges = []

    // 地面边
    edges.append({ x: 0, y: 0, z: 0 })
    edges.append({ x: 0, y: 0, z: container.innerWidth - cargo.width })

    // 已放置货物的顶面边和侧面边
    FOR EACH placed IN placedCargo
        // 顶面边
        edges.append({ x: placed.x, y: placed.y + placed.h, z: placed.z })
        edges.append({ x: placed.x, y: placed.y + placed.h, z: placed.z + placed.w - cargo.width })
        // 侧面边
        edges.append({ x: placed.x + placed.l, y: placed.y, z: placed.z })
        edges.append({ x: placed.x + placed.l, y: placed.y, z: placed.z + placed.w - cargo.width })
    END FOR

    // 2. 过滤越界候选
    FOR EACH edge IN edges
        IF edge.x + cargo.l <= container.innerLength AND
           edge.y + cargo.h <= container.innerHeight AND
           edge.z + cargo.w <= container.innerWidth AND
           edge.x >= 0 AND edge.y >= 0 AND edge.z >= 0
            candidates.append(edge)
        END IF
    END FOR

    RETURN deduplicate(candidates)
END FUNCTION
```

### 2.3 砖墙评分 + SKU 磁吸

```
FUNCTION scoreCandidate(candidate, cargo, placedCargo, container)
    score = 0

    // 1. 砖墙评分：X 轴最小化优先（v34.3）
    // 越靠近门端（高 X）越好（LIFO 先卸）
    score += (candidate.x / container.innerLength) * 10000

    // 2. 地面优先（Y=0）
    IF candidate.y == 0
        score += 5000
    ELSE
        // 底部接触下层货物顶面
        IF hasSupportBelow(candidate, placedCargo)
            score += 3000
        ELSE
            score -= 10000  // 悬空惩罚
        END IF
    END IF

    // 3. SKU 磁吸（同 SKU 聚集）
    sameSkuNeighbors = countSameSkuNeighbors(candidate, cargo.sku, placedCargo)
    score += min(sameSkuNeighbors * 50000, 5000)  // 封顶 5000

    // 4. Z-Lane 局部屏障（v34.7）
    // 允许类俄罗斯方块互锁
    zLaneBarrier = computeZLaneBarrier(candidate, placedCargo)
    score += zLaneBarrier * 1000

    // 5. 接触面评分
    contactArea = computeContactArea(candidate, placedCargo, container)
    score += contactArea / 100

    RETURN score
END FUNCTION
```

### 2.4 零容忍碰撞检测

```
FUNCTION placeCargoWithCollisionCheck(candidate, placedCargo)
    // AABB 分离轴定理
    FOR EACH placed IN placedCargo
        IF aabbIntersects(candidate, placed, tolerance=0)
            RETURN COLLISION  // 零容忍
        END IF
    END FOR

    // 边界检查
    IF candidate.x + candidate.l > container.innerLength + 0
        RETURN COLLISION
    END IF
    IF candidate.y + candidate.h > container.innerHeight + 0
        RETURN COLLISION
    END IF
    IF candidate.z + candidate.w > container.innerWidth + 0
        RETURN COLLISION
    END IF

    RETURN NO_COLLISION
END FUNCTION

FUNCTION aabbIntersects(a, b, tolerance)
    RETURN (a.x < b.x + b.l + tolerance AND
            a.x + a.l + tolerance > b.x AND
            a.y < b.y + b.h + tolerance AND
            a.y + a.h + tolerance > b.y AND
            a.z < b.z + b.w + tolerance AND
            a.z + a.w + tolerance > b.z)
END FUNCTION
```

### 2.5 Z-Lane 局部屏障（v34.7）

```
FUNCTION computeZLaneBarrier(candidate, placedCargo)
    // 按候选点单独计算屏障，允许互锁
    barrier = 0

    // 检查 Z 方向相邻货物
    leftNeighbor = findNeighborAtZ(candidate, placedCargo, zOffset=-candidate.w)
    rightNeighbor = findNeighborAtZ(candidate, placedCargo, zOffset=candidate.w)

    IF leftNeighbor != NULL
        // Z 方向对齐奖励
        IF abs(leftNeighbor.y - candidate.y) < 40  // 网格步长
            barrier += 1
        END IF
    END IF

    IF rightNeighbor != NULL
        IF abs(rightNeighbor.y - candidate.y) < 40
            barrier += 1
        END IF
    END IF

    RETURN barrier
END FUNCTION
```

### 2.6 HeightMap 更新

```
FUNCTION updateHeightMap(heightMap, placement)
    gridCols = heightMap.cols
    gridRows = heightMap.rows
    gridStep = heightMap.step

    startCol = floor(placement.x / gridStep)
    endCol = ceil((placement.x + placement.l) / gridStep)
    startRow = floor(placement.z / gridStep)
    endRow = ceil((placement.z + placement.w) / gridStep)

    topY = placement.y + placement.h

    FOR col = startCol TO endCol
        FOR row = startRow TO endRow
            IF col < gridCols AND row < gridRows
                heightMap[col][row] = max(heightMap[col][row], topY)
            END IF
        END FOR
    END FOR
END FUNCTION
```

---

## 3. AlgorithmOrchestrator 调度伪代码

```
FUNCTION execute(input)
    startTime = now()
    { cargoList, container, options } = input

    // 1. 算法 ID 校验
    algorithmId = options.algorithmId OR 'realistic4d-multi-strategy'
    IF algorithmId NOT IN ALGORITHM_WHITELIST
        RETURN { success: FALSE, error: { code: 'UNKNOWN_ALGORITHM', ... } }
    END IF

    // 2. 超限检测
    IF isOversize(cargoList, container)
        RETURN { success: FALSE, error: { code: 'OVERSIZE_OR_UNSUPPORTED_ORIENTATION', ... } }
    END IF

    // 3. 缓存查找
    cacheKey = hash(cargoList + container + options)
    cached = cache.get(cacheKey)
    IF cached != NULL
        RETURN { success: TRUE, data: cached, fromCache: TRUE }
    END IF

    // 4. 策略族选择
    skuCount = countDistinctSku(cargoList)
    strategyFamily = selectStrategyFamily(skuCount)
    // ≤50: exact | ≤500: heuristic | >500: metaheuristic

    // 5. 执行算法
    IF algorithmId == 'fast-block'
        engine = new FastBlockPackingEngine()
        result = engine.generatePackingPlan(cargoList, container)
    ELSE
        engine = new Realistic4DPackingEngine()
        result = engine.generatePackingPlan(cargoList, container, { algorithmId, ... })
    END IF

    // 6. 写入缓存
    cache.set(cacheKey, result, ttl=300000)  // 5 分钟

    RETURN { success: TRUE, data: result, fromCache: FALSE }
END FUNCTION

FUNCTION selectStrategyFamily(skuCount)
    IF skuCount <= 50
        RETURN 'exact'
    ELSE IF skuCount <= 500
        RETURN 'heuristic'
    ELSE
        RETURN 'metaheuristic'
    END IF
END FUNCTION
```

代码位置：[backend/services/AlgorithmOrchestrator.js:86](../../backend/services/AlgorithmOrchestrator.js)

---

## 4. 伪代码说明

### 4.1 与真实代码的差异

- 伪代码省略了错误处理、日志、性能埋点等工程细节
- 伪代码用结构化英文表达，真实代码为 JavaScript
- 伪代码的循环和条件为逻辑表达，不对应具体行号
- 评分权重数值为示意，真实实现可能微调

### 4.2 确定性保证

两个引擎均为确定性算法（VERIFIED）：

- 无随机数生成
- 无 Math.random() 调用
- 相同输入 + 相同 seed → 相同输出
- `options.seed` 仅用于多策略择优时的内部排序稳定性

### 4.3 复杂度对比

| 算法 | 复杂度 | 说明 |
|---|---|---|
| FastBlock | O(n) | 切片线性扫描，无回溯 |
| Realistic4D | O(n²) ~ O(n³) | 精确边候选 + 砖墙评分 + heightMap 更新 |

### 4.4 边界声明

- 伪代码不保证与真实代码逐行对应，仅供评审理解算法逻辑
- 真实实现以 [backend/services/FastBlockPackingEngine.js](../../backend/services/FastBlockPackingEngine.js) 和 [backend/services/Realistic4DPackingEngine.js](../../backend/services/Realistic4DPackingEngine.js) 为准
- 伪代码中的常量（如 50000、5000、5%、10%）来自代码或头注释，可能在版本迭代中调整
