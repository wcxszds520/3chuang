# 3D 状态机详细文档 (THREE_D_STATE_MACHINE)

> 生成时间：2026-07-11
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`
> 代码位置：[web-dashboard/src/three/operation/operationMachine.js](../../web-dashboard/src/three/operation/operationMachine.js)

---

## 1. 状态机概览

| 维度 | 数据 |
|---|---|
| 相位数 | 18 个 |
| 转移表 | NEXT_PHASE |
| 元数据 | PHASE_META（label / action / duration） |
| 起始相位 | IDLE |
| 终止相位 | COMPLETED / BLOCKED / PAUSED |
| 代码位置 | [web-dashboard/src/three/operation/operationMachine.js:3-59](../../web-dashboard/src/three/operation/operationMachine.js) |

---

## 2. 18 相位详细列表

### 2.1 OPERATION_PHASES 常量

代码位置：[web-dashboard/src/three/operation/operationMachine.js:3-22](../../web-dashboard/src/three/operation/operationMachine.js)

```js
export const OPERATION_PHASES = Object.freeze([
  'IDLE',
  'OPENING_DOORS',
  'MOVE_TO_CARGO',
  'ALIGN_FOR_PICKUP',
  'INSERT_FORKS',
  'LIFT_CARGO',
  'MOVE_TO_STAGING',
  'ALIGN_WITH_DOOR',
  'ENTER_CONTAINER',
  'MOVE_INSIDE',
  'ALIGN_WITH_TARGET',
  'LOWER_CARGO',
  'RELEASE_CARGO',
  'REVERSE_OUT',
  'RETURN_FOR_NEXT',
  'PAUSED',
  'BLOCKED',
  'COMPLETED'
]);
```

### 2.2 PHASE_META 元数据

代码位置：[web-dashboard/src/three/operation/operationMachine.js:24-43](../../web-dashboard/src/three/operation/operationMachine.js)

| # | 相位 | label | action | duration (s) |
|---|---|---|---|---|
| 1 | IDLE | 待机 | 门关闭，等待开始作业 | Infinity |
| 2 | OPENING_DOORS | 打开箱门 | 打开集装箱门端的左右箱门 | 1.5 |
| 3 | MOVE_TO_CARGO | 驶向货物 | 叉车沿通道驶向等待区货物 | 1.7 |
| 4 | ALIGN_FOR_PICKUP | 取货对准 | 对准货物中心与叉孔方向 | 0.65 |
| 5 | INSERT_FORKS | 插入货叉 | 货叉水平插入货物底部 | 0.7 |
| 6 | LIFT_CARGO | 抬升货物 | 货叉按目标层高连续抬升 | 0.9 |
| 7 | MOVE_TO_STAGING | 移至门外 | 货物随货叉移动到门前对准区 | 2.1 |
| 8 | ALIGN_WITH_DOOR | 对准门洞 | 按真实目标 Z 坐标对准门洞 | 0.7 |
| 9 | ENTER_CONTAINER | 通过门洞 | 仅通过集装箱后门进入箱内 | 1.45 |
| 10 | MOVE_INSIDE | 箱内行进 | 沿已验证路径驶向真实目标位置 | 3.8 |
| 11 | ALIGN_WITH_TARGET | 目标对准 | 对齐装箱算法返回的目标坐标 | 0.65 |
| 12 | LOWER_CARGO | 落货 | 货叉下降，货物落到目标层 | 0.85 |
| 13 | RELEASE_CARGO | 释放货物 | 抽出货叉并固定货物完成状态 | 0.65 |
| 14 | REVERSE_OUT | 倒车出箱 | 叉车沿进入路径反向驶出 | 4.0 |
| 15 | RETURN_FOR_NEXT | 返回等待区 | 返回通道并准备下一件货物 | 1.55 |
| 16 | PAUSED | 已暂停 | 所有门、叉车和货物坐标保持不变 | Infinity |
| 17 | BLOCKED | 作业阻断 | 路径或目标不合法，未移动真实目标 | Infinity |
| 18 | COMPLETED | 作业完成 | 所有可执行货物已完成放置 | Infinity |

---

## 3. 相位转移表 NEXT_PHASE

代码位置：[web-dashboard/src/three/operation/operationMachine.js:45-59](../../web-dashboard/src/three/operation/operationMachine.js)

```js
const NEXT_PHASE = Object.freeze({
  OPENING_DOORS: 'MOVE_TO_CARGO',
  MOVE_TO_CARGO: 'ALIGN_FOR_PICKUP',
  ALIGN_FOR_PICKUP: 'INSERT_FORKS',
  INSERT_FORKS: 'LIFT_CARGO',
  LIFT_CARGO: 'MOVE_TO_STAGING',
  MOVE_TO_STAGING: 'ALIGN_WITH_DOOR',
  ALIGN_WITH_DOOR: 'ENTER_CONTAINER',
  ENTER_CONTAINER: 'MOVE_INSIDE',
  MOVE_INSIDE: 'ALIGN_WITH_TARGET',
  ALIGN_WITH_TARGET: 'LOWER_CARGO',
  LOWER_CARGO: 'RELEASE_CARGO',
  RELEASE_CARGO: 'REVERSE_OUT',
  REVERSE_OUT: 'RETURN_FOR_NEXT'
});
```

### 3.1 转移链

```
OPENING_DOORS
  → MOVE_TO_CARGO
  → ALIGN_FOR_PICKUP
  → INSERT_FORKS
  → LIFT_CARGO
  → MOVE_TO_STAGING
  → ALIGN_WITH_DOOR
  → ENTER_CONTAINER
  → MOVE_INSIDE
  → ALIGN_WITH_TARGET
  → LOWER_CARGO
  → RELEASE_CARGO
  → REVERSE_OUT
  → RETURN_FOR_NEXT
  → (下一件货物) MOVE_TO_CARGO 或 COMPLETED
```

### 3.2 特殊转移

| 当前相位 | 下一相位 | 触发条件 |
|---|---|---|
| IDLE | OPENING_DOORS | 用户点击开始 |
| RETURN_FOR_NEXT | MOVE_TO_CARGO | 队列还有货物 |
| RETURN_FOR_NEXT | COMPLETED | 队列已空 |
| 任意相位 | PAUSED | 用户点击暂停 |
| PAUSED | (原相位) | 用户点击恢复 |
| 任意运动相位 | BLOCKED | 路径校验失败 |

---

## 4. Mermaid 状态图（可编辑源代码）

```mermaid
stateDiagram-v2
    [*] --> IDLE: 初始化

    IDLE --> OPENING_DOORS: 用户点击开始

    OPENING_DOORS --> MOVE_TO_CARGO: 门打开完成(1.5s)
    MOVE_TO_CARGO --> ALIGN_FOR_PICKUP: 到达等待区(1.7s)
    ALIGN_FOR_PICKUP --> INSERT_FORKS: 对准完成(0.65s)
    INSERT_FORKS --> LIFT_CARGO: 货叉插入(0.7s)
    LIFT_CARGO --> MOVE_TO_STAGING: 抬升到目标层(0.9s)
    MOVE_TO_STAGING --> ALIGN_WITH_DOOR: 到达门前(2.1s)
    ALIGN_WITH_DOOR --> ENTER_CONTAINER: Z 坐标对准(0.7s)
    ENTER_CONTAINER --> MOVE_INSIDE: 通过门洞(1.45s)
    MOVE_INSIDE --> ALIGN_WITH_TARGET: 到达目标区域(3.8s)
    ALIGN_WITH_TARGET --> LOWER_CARGO: 坐标对齐(0.65s)
    LOWER_CARGO --> RELEASE_CARGO: 货物落地(0.85s)
    RELEASE_CARGO --> REVERSE_OUT: 货叉抽出(0.65s)
    REVERSE_OUT --> RETURN_FOR_NEXT: 倒车出箱(4.0s)

    RETURN_FOR_NEXT --> MOVE_TO_CARGO: 队列还有货物(1.55s)
    RETURN_FOR_NEXT --> COMPLETED: 队列已空

    COMPLETED --> [*]: 全部完成

    note right of IDLE: duration: Infinity
    note right of MOVE_INSIDE: duration: 3.8s 最长作业段
    note right of REVERSE_OUT: duration: 4.0s 倒车出箱
    note right of BLOCKED: 路径或目标不合法
    note right of PAUSED: 用户暂停，坐标保持

    state PauseResume {
        PAUSED --> IDLE: 恢复
    }
```

---

## 5. 作业队列 buildOperationQueue

代码位置：[web-dashboard/src/three/operation/operationMachine.js:61-67](../../web-dashboard/src/three/operation/operationMachine.js)

```js
export function buildOperationQueue(loadedCargo = []) {
  return loadedCargo.map((cargo, sourceIndex) => ({ ...cargo, sourceIndex }))
    .sort((a, b) => Number(a.x) - Number(b.x)
      || Number(a.y) - Number(b.y)
      || Number(a.z) - Number(b.z)
      || Number(a.loadingIndex || a.sourceIndex) - Number(b.loadingIndex || b.sourceIndex));
}
```

### 5.1 排序规则

```
按 x 升序 → y 升序 → z 升序 → loadingIndex 升序
```

- 深区优先（低 X 先装，柜尾在低 X）
- 底层优先（低 Y 先装，地面 Y=0）
- 同位置按 loadingIndex（算法返回的装载顺序）

### 5.2 队列示例

假设 loadedCargo 有 3 件货物：

| 货物 | x | y | z | loadingIndex |
|---|---|---|---|---|
| A | 1000 | 0 | 500 | 2 |
| B | 500 | 0 | 500 | 1 |
| C | 500 | 500 | 500 | 3 |

排序后：B → C → A

- B（x=500 最小）
- C（x=500 同，y=500 大于 B 的 y=0，后装）
- A（x=1000 最大，最后装）

---

## 6. OperationMachine 类

代码位置：[web-dashboard/src/three/operation/operationMachine.js:69](../../web-dashboard/src/three/operation/operationMachine.js)

### 6.1 构造函数

```js
export class OperationMachine {
  constructor(plan = {}) {
    this.plan = plan;
    this.container = plan.containerInfo || {};
    this.queue = buildOperationQueue(plan.loadedCargo || []);
    this.reset();
  }

  reset() {
    this.phase = 'IDLE';
    this.playing = false;
    this.pausedPhase = null;
    // ...
  }
}
```

### 6.2 关键方法（基于代码推导）

| 方法 | 用途 |
|---|---|
| `reset()` | 重置到 IDLE |
| `play()` | 开始播放（IDLE → OPENING_DOORS） |
| `pause()` | 暂停（当前相位 → PAUSED） |
| `resume()` | 恢复（PAUSED → 原相位） |
| `tick(deltaMs)` | 时间推进，触发相位转移 |
| `advance()` | 进入下一相位 |
| `block()` | 进入 BLOCKED |

---

## 7. 相位时长分析

### 7.1 单件货物作业时长

```
OPENING_DOORS(1.5) + MOVE_TO_CARGO(1.7) + ALIGN_FOR_PICKUP(0.65)
  + INSERT_FORKS(0.7) + LIFT_CARGO(0.9) + MOVE_TO_STAGING(2.1)
  + ALIGN_WITH_DOOR(0.7) + ENTER_CONTAINER(1.45) + MOVE_INSIDE(3.8)
  + ALIGN_WITH_TARGET(0.65) + LOWER_CARGO(0.85) + RELEASE_CARGO(0.65)
  + REVERSE_OUT(4.0) + RETURN_FOR_NEXT(1.55)
= 21.2 秒/件（1× 速度）
```

### 7.2 倍速下时长

| 倍速 | 单件时长 | 100 件总时长 |
|---|---|---|
| 0.5×（Web） | 42.4s | 70.7 分钟 |
| 1× | 21.2s | 35.3 分钟 |
| 2×（Web） | 10.6s | 17.7 分钟 |
| 4×（Web） | 5.3s | 8.8 分钟 |
| 10×（小程序） | 2.12s | 3.5 分钟 |
| 30×（小程序） | 0.71s | 1.2 分钟 |

> OPENING_DOORS 仅在首件发生一次，后续货物从 RETURN_FOR_NEXT → MOVE_TO_CARGO 开始。

### 7.3 特殊相位时长

| 相位 | duration | 说明 |
|---|---|---|
| IDLE | Infinity | 等待用户开始 |
| PAUSED | Infinity | 等待用户恢复 |
| BLOCKED | Infinity | 等待用户干预 |
| COMPLETED | Infinity | 终态 |

---

## 8. 相位与 actor 类型

### 8.1 actorType 决定

每件货物的 `actorType` 由 `cargo.handlingMethod` 决定（VERIFIED）：

| handlingMethod | actorType | 涉及相位 |
|---|---|---|
| manual | 人工 actor | 全部 14 个作业相位 |
| forklift | 叉车 | 全部 14 个作业相位 |

> 注意：无论 actorType 是 manual 还是 forklift，都走相同的 18 相位状态机。差异仅在渲染的 actor 模型不同。

### 8.2 workerPoseFromForklift

当 actorType 为 manual 但需要跟随叉车时：

- 工人位置 = 叉车位置 - 380mm（X 偏移）
- gait = sin(progress * 4π)（行走步态动画）

---

## 9. 相位与路径段映射

### 9.1 路径 9 段

| 段 | 名称 | 对应相位 |
|---|---|---|
| 1 | home | IDLE |
| 2 | waiting | MOVE_TO_CARGO |
| 3 | waitingLifted | LIFT_CARGO |
| 4 | staging | MOVE_TO_STAGING / ALIGN_WITH_DOOR |
| 5 | doorApproach | ENTER_CONTAINER |
| 6 | doorInside | ENTER_CONTAINER → MOVE_INSIDE |
| 7 | insideAligned | MOVE_INSIDE → ALIGN_WITH_TARGET |
| 8 | targetHover | LOWER_CARGO |
| 9 | target | RELEASE_CARGO |

### 9.2 路径校验

`validateCargoPath`（VERIFIED）：

- 采样 polyline（step=100mm）
- 逐点检查前壁/地板/顶板/侧壁/门框/已装货物碰撞
- 校验失败 → BLOCKED 相位

详见 [THREE_D_OPERATION_FLOW.md](./THREE_D_OPERATION_FLOW.md)。

---

## 10. 状态机测试

代码位置：[web-dashboard/src/three/operation/operationMachine.test.js](../../web-dashboard/src/three/operation/operationMachine.test.js)

### 10.1 测试关注点

- 18 相位完整性
- NEXT_PHASE 转移正确性
- PHASE_META 元数据完整性
- buildOperationQueue 排序正确性
- play/pause/resume 行为
- BLOCKED 触发条件
- COMPLETED 终态

---

## 11. 状态机边界声明

- 状态机是作业过程的可视化驱动，不是真实叉车控制器
- 相位时长是预设值，不反映真实作业时间
- BLOCKED 仅在路径校验失败时触发，不处理运行时异常
- PAUSED 保持坐标不变，但不保存中间进度（依赖前端状态）
- COMPLETED 后不可逆，需 reset() 重新开始
