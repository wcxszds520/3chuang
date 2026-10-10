# 算法输入输出规格 (ALGORITHM_INPUT_OUTPUT)

> 生成时间：2026-07-11
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`
> 本文详细规格化 FastBlockPackingEngine 的输入与输出结构。

---

## 1. 输入结构

### 1.1 顶层结构

```
{
  cargoList: Cargo[],
  container: Container,
  options: Options
}
```

### 1.2 Cargo 字段表

| 字段 | 类型 | 单位 | 必填 | 说明 |
|---|---|---|---|---|
| `name` | string | - | 是 | 货物名称 |
| `length` | number | mm | 是 | 货物长度 |
| `width` | number | mm | 是 | 货物宽度 |
| `height` | number | mm | 是 | 货物高度 |
| `weight` | number | kg | 是 | 单件重量 |
| `quantity` | number | 件 | 是 | 数量 |
| `stackable` | boolean | - | 否 | 是否可堆叠（默认 true） |
| `maxStackLayers` | number | 层 | 否 | 最大堆叠层数（默认 1） |
| `canInvert` | boolean | - | 否 | 是否允许倒置 |
| `canLayFlat` | boolean | - | 否 | 是否允许平放 |
| `fragile` | boolean | - | 否 | 是否易碎 |
| `eta` | string/date | - | 否 | 预计到港时间 |
| `portSequence` | number | - | 否 | 目的港顺序（LIFO 排序用） |
| `cyClosing` | string/date | - | 否 | CY 截关时间 |
| `customsDeclaration` | string | - | 否 | 报关单号 |
| `sku` | string | - | 否 | SKU 编码（聚集用） |
| `batchId` | string | - | 否 | 批次 ID |
| `packagingType` | string | - | 否 | 包装类型（含 wood/pallet 判定为木包装） |

### 1.3 Container 字段表

| 字段 | 类型 | 单位 | 必填 | 说明 |
|---|---|---|---|---|
| `innerLength` | number | mm | 是 | 集装箱内部长度 |
| `innerWidth` | number | mm | 是 | 集装箱内部宽度 |
| `innerHeight` | number | mm | 是 | 集装箱内部高度 |
| `maxWeight` | number | kg | 是 | 最大载重 |

### 1.4 柜型规格（VERIFIED）

| 柜型 | innerLength (mm) | innerWidth (mm) | innerHeight (mm) | maxWeight (kg) |
|---|---|---|---|---|
| 20GP | 5898 | 2352 | 2393 | 28000 |
| 40GP | 12032 | 2352 | 2393 | 26000 |
| 40HQ | 12032 | 2352 | 2698 | 26000 |

### 1.5 Options 字段表

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `algorithmId` | string | `'realistic4d-multi-strategy'` | 算法 ID（必须在白名单内） |
| `seed` | number | - | 随机种子（确定性，相同 seed 相同输出） |
| `mixedSku` | boolean | false | 是否多规格混装 |
| `timeoutMs` | number | 60000 | 超时毫秒数 |

### 1.6 算法白名单

```
realistic4d
realistic4d-weight-first
realistic4d-volume-first
realistic4d-mixed
realistic4d-multi-strategy
fast-block
```

代码位置：[backend/services/AlgorithmOrchestrator.js:24-31](../../backend/services/AlgorithmOrchestrator.js)

### 1.7 输入示例

```json
{
  "cargoList": [
    {
      "name": "电风扇",
      "length": 480,
      "width": 380,
      "height": 320,
      "weight": 6.5,
      "quantity": 80,
      "stackable": true,
      "maxStackLayers": 3,
      "canInvert": false,
      "canLayFlat": false,
      "fragile": true,
      "eta": "2026-07-15",
      "portSequence": 1,
      "cyClosing": "2026-07-14T18:00:00",
      "customsDeclaration": "NB2026-DEMO-01",
      "sku": "FAN-001",
      "batchId": "B20260711-01",
      "packagingType": "carton"
    }
  ],
  "container": {
    "innerLength": 12032,
    "innerWidth": 2352,
    "innerHeight": 2698,
    "maxWeight": 26000
  },
  "options": {
    "algorithmId": "fast-block",
    "seed": 42
  }
}
```

---

## 2. 输出结构

### 2.1 顶层结构

```
{
  loadedCargo: LoadedCargo[],
  unloadedCargo: UnloadedCargo[],
  spaceUtilization: number,
  totalWeight: number,
  totalCargoCount: number,
  cog: { x, y, z },
  cogOffset: { lateralPercent, longitudinalPercent },
  metrics: Metrics,
  constraintMeta: ConstraintMeta,
  warnings: string[]
}
```

### 2.2 LoadedCargo 字段表

| 字段 | 类型 | 单位 | 说明 |
|---|---|---|---|
| `loadingIndex` | number | - | 装载顺序索引（0 起） |
| `name` | string | - | 货物名称 |
| `cargoId` | string | - | 货物唯一 ID |
| `x` | number | mm | X 坐标（长度方向，门端高 X） |
| `y` | number | mm | Y 坐标（高度方向，地面=0） |
| `z` | number | mm | Z 坐标（宽度方向） |
| `l` | number | mm | 放置后长度（含旋转） |
| `h` | number | mm | 放置后高度（含旋转） |
| `w` | number | mm | 放置后宽度（含旋转） |
| `color` | string | - | 渲染颜色（hex） |
| `type` | string | - | 货物类型 |
| `packagingType` | string | - | 包装类型 |
| `weight` | number | kg | 单件重量 |
| `fragile` | boolean | - | 是否易碎 |
| `batchId` | string | - | 批次 ID |
| `batchKey` | string | - | 批次键（内部聚合用） |
| `batchLabel` | string | - | 批次显示标签 |
| `destinationPort` | string | - | 目的港 |
| `eta` | string/date | - | 预计到港时间 |
| `portSequence` | number | - | 目的港顺序 |
| `sku` | string | - | SKU 编码 |
| `handlingMethod` | string | - | 搬运方式（manual/forklift） |
| `handlingPolicy` | string | - | 搬运策略 |
| `heavy` | boolean | - | 是否重货（weight>=20） |
| `wooden` | boolean | - | 是否木包装 |
| `riskNotes` | string | - | 风险提示 |
| `source` | string | - | 来源标记 |

### 2.3 UnloadedCargo 字段表

结构与 Cargo 输入一致，附加：

| 字段 | 类型 | 说明 |
|---|---|---|
| `unloadReason` | string | 未装载原因（OVERSIZE_OR_UNSUPPORTED_ORIENTATION / NO_CROSS_SECTION_CAPACITY / INSUFFICIENT_LENGTH / WEIGHT_EXCEEDED） |

### 2.4 cog（重心）

| 字段 | 类型 | 单位 | 说明 |
|---|---|---|---|
| `x` | number | mm | 重心 X 坐标（加权平均） |
| `y` | number | mm | 重心 Y 坐标（加权平均） |
| `z` | number | mm | 重心 Z 坐标（加权平均） |

计算方式（VERIFIED）：

```
cog.x = Σ(cargo.x * cargo.weight) / Σ(cargo.weight)
cog.y = Σ(cargo.y * cargo.weight) / Σ(cargo.weight)
cog.z = Σ(cargo.z * cargo.weight) / Σ(cargo.weight)
```

### 2.5 cogOffset（重心偏移百分比）

| 字段 | 类型 | 单位 | 说明 |
|---|---|---|---|
| `lateralPercent` | number | % | 横向偏移百分比 |
| `longitudinalPercent` | number | % | 纵向偏移百分比 |

计算方式（VERIFIED）：

```
横向百分比 = |cog.z - width/2| / (width/2) * 100
纵向百分比 = |cog.x - length/2| / (length/2) * 100
```

默认阈值：横向 ≤ 5%，纵向 ≤ 10%

代码位置：[backend/services/FastBlockPackingEngine.js:14-15](../../backend/services/FastBlockPackingEngine.js)

### 2.6 Metrics 字段表

| 字段 | 类型 | 单位 | 说明 |
|---|---|---|---|
| `algorithm` | string | - | 执行算法名（如 'fast-block'） |
| `elapsedMs` | number | ms | 算法耗时 |
| `totalVolume` | number | mm³ | 已装载总体积 |
| `dynamicBalanceRejections` | number | 次 | 动态重心拒绝次数 |

### 2.7 ConstraintMeta 字段表

| 字段 | 类型 | 说明 |
|---|---|---|
| `sixDimensionalConstraints` | string[] | 六类业务约束协同机制清单（见下） |
| `lifoCompliant` | boolean | LIFO 是否合规 |
| `fillPolicy` | string | 填充策略（block-first） |
| `topFillPolicy` | string | 顶部填充策略（manual-reach） |
| `securingPolicy` | string | 固定策略（friction-only） |
| `doorSide` | string | 门端方向（high-x） |
| `deepestSide` | string | 最深处方向（low-x） |

#### sixDimensionalConstraints 六个维度（VERIFIED）

| # | 维度标识 | 含义 |
|---|---|---|
| 1 | `lifo` | LIFO 卸货顺序 |
| 2 | `cog` | 动态重心 |
| 3 | `sku-clustering` | 同 SKU 聚集 |
| 4 | `stacking-safety` | 堆叠与重不压轻安全 |
| 5 | `reachability` | 叉车人工搬运可达性 |
| 6 | `vgm` | VGM 总重合规 |

> **重要**：`sixDimensionalConstraints` 是约束清单，不是"Fast Block多约束三维装箱引擎"。不存在六个维度的加权求和。

### 2.8 warnings 字段

`warnings` 是字符串数组，包含算法执行过程中的警告信息，例如：

- 重心偏移接近阈值
- 部分货物未装载
- 缓存命中
- 超时风险

---

## 3. 输出示例

```json
{
  "loadedCargo": [
    {
      "loadingIndex": 0,
      "name": "电风扇",
      "cargoId": "c-001",
      "x": 11552,
      "y": 0,
      "z": 0,
      "l": 480,
      "h": 320,
      "w": 380,
      "color": "#5B8DEF",
      "type": "appliances",
      "packagingType": "carton",
      "weight": 6.5,
      "fragile": true,
      "batchId": "B20260711-01",
      "batchKey": "FAN-001::B20260711-01",
      "batchLabel": "FAN-001 / B20260711-01",
      "destinationPort": "Ningbo",
      "eta": "2026-07-15",
      "portSequence": 1,
      "sku": "FAN-001",
      "handlingMethod": "forklift",
      "handlingPolicy": "standard",
      "heavy": false,
      "wooden": false,
      "riskNotes": "易碎，勿压",
      "source": "fast-block"
    }
  ],
  "unloadedCargo": [],
  "spaceUtilization": 84.51,
  "totalWeight": 520.0,
  "totalCargoCount": 80,
  "cog": {
    "x": 6016,
    "y": 1349,
    "z": 1176
  },
  "cogOffset": {
    "lateralPercent": 0.0,
    "longitudinalPercent": 0.0
  },
  "metrics": {
    "algorithm": "fast-block",
    "elapsedMs": 187,
    "totalVolume": 46694400000,
    "dynamicBalanceRejections": 3
  },
  "constraintMeta": {
    "sixDimensionalConstraints": ["lifo","cog","sku-clustering","stacking-safety","reachability","vgm"],
    "lifoCompliant": true,
    "fillPolicy": "block-first",
    "topFillPolicy": "manual-reach",
    "securingPolicy": "friction-only",
    "doorSide": "high-x",
    "deepestSide": "low-x"
  },
  "warnings": []
}
```

---

## 4. 错误响应结构

### 4.1 未知算法

```json
{
  "success": false,
  "error": {
    "code": "UNKNOWN_ALGORITHM",
    "message": "算法 ID \"xxx\" 不在白名单内",
    "allowedAlgorithms": [
      "realistic4d",
      "realistic4d-weight-first",
      "realistic4d-volume-first",
      "realistic4d-mixed",
      "realistic4d-multi-strategy",
      "fast-block"
    ]
  }
}
```

### 4.2 超限

```json
{
  "success": false,
  "error": {
    "code": "OVERSIZE_OR_UNSUPPORTED_ORIENTATION",
    "message": "货物尺寸超过集装箱内部尺寸",
    "cargoId": "c-001",
    "containerMax": { "length": 12032, "width": 2352, "height": 2698 }
  }
}
```

### 4.3 未装载原因（unloadedCargo 内）

| 错误码 | 含义 |
|---|---|
| `OVERSIZE_OR_UNSUPPORTED_ORIENTATION` | 超限或不支持的朝向 |
| `NO_CROSS_SECTION_CAPACITY` | 截面无容量 |
| `INSUFFICIENT_LENGTH` | 剩余长度不足 |
| `WEIGHT_EXCEEDED` | 重量超限 |

---

## 5. 坐标系规格（VERIFIED）

| 轴 | 含义 | 范围 | 说明 |
|---|---|---|---|
| X | 长度 | 0 → innerLength | 门端在高 X（X=innerLength），柜尾在低 X（X=0） |
| Y | 高度 | 0 → innerHeight | 地面 Y=0（重力轴），顶部 Y=innerHeight |
| Z | 宽度 | 0 → innerWidth | 左侧 Z=0，右侧 Z=innerWidth |

- 单位：毫米（mm）
- 渲染层乘 0.001 转米（Three.js 场景）

---

## 6. 字段推导规则

### 6.1 heavy（重货）

```
heavy = (weight >= 20)
```

### 6.2 wooden（木包装）

```
wooden = (packagingType.includes('wood') OR packagingType.includes('pallet'))
```

### 6.3 handlingMethod（搬运方式）

```
handlingMethod = cargo.handlingMethod OR inferFromWeight(weight)
// 重货默认 forklift，轻货默认 manual
```

### 6.4 color（渲染颜色）

从 FastBlock 调色板循环分配（VERIFIED）：

```js
this.palette = [
  '#5B8DEF', '#00C2A8', '#F2994A', '#EB5757', '#9B51E0',
  '#2D9CDB', '#27AE60', '#F2C94C', '#56CCF2', '#BB6BD9'
];
```

代码位置：[backend/services/FastBlockPackingEngine.js:22-33](../../backend/services/FastBlockPackingEngine.js)

---

## 7. 前端字段映射

前端 `packingApi.js` 构造请求时映射的字段（VERIFIED）：

代码位置：[web-dashboard/src/services/packingApi.js:7](../../web-dashboard/src/services/packingApi.js)

```js
export function buildPackingRequest({ containerType, cargoList }) {
  return {
    containerType,
    cargoList: cargoList.map((cargo) => ({
      cargoId: cargo.cargoId,
      name: cargo.name,
      sku: cargo.sku,
      length: Number(cargo.length),
      width: Number(cargo.width),
      height: Number(cargo.height),
      weight: Number(cargo.weight),
      quantity: Number(cargo.quantity),
      stackable: cargo.stackable !== false,
      maxStackLayers: Number(cargo.maxStackLayers || 1),
      // ... 其他字段
    })),
    options: {
      algorithmId: AUTHORITATIVE_ALGORITHM_ID  // 'fast-block'
    }
  };
}
```

`AUTHORITATIVE_ALGORITHM_ID = 'fast-block'`（VERIFIED）

代码位置：[web-dashboard/src/services/packingApi.js:5](../../web-dashboard/src/services/packingApi.js)

---

## 8. 规格边界声明

- 本规格基于 FastBlockPackingEngine 的当前实现，后续版本可能扩展字段
- `unloadedCargo` 的 `unloadReason` 字段为推导字段，真实实现可能用不同字段名
- `handlingMethod` 的推导规则可能在真实代码中更复杂
- 字段表中的"必填"是算法层面的要求，前端可能不传所有字段（由后端补默认值）
