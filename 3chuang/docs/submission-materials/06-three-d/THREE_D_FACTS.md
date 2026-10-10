# 3D 事实总览 (THREE_D_FACTS)

> 生成时间：2026-07-11
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`
> 状态分级：VERIFIED（已核实）/ IMPLEMENTED_UNVERIFIED（已实现未核实）/ PARTIAL（部分实现）/ PLANNED（计划中）/ NOT_FOUND（未发现）

---

## 1. 引擎与平台

| 维度 | 内容 | 证据 |
|---|---|---|
| Web 引擎 | Three.js ^0.179.0 | [web-dashboard/package.json](../../web-dashboard/package.json) |
| 小程序引擎 | threejs-miniprogram 0.0.8 | [miniprogram/package.json](../../miniprogram/package.json) |
| 场景构建方式 | 程序化构建，无 GLTF 加载 | 见下文各 create* 文件 |
| 渲染单位 | Three.js 场景使用米（渲染时乘 0.001） | operationMachine.js |

> 关键：场景全部由代码程序化构建（geometry + mesh），不加载外部 GLTF/GLB 模型文件。

---

## 2. 场景结构

### 2.1 集装箱（createIndustrialContainer.js）

代码位置：[web-dashboard/src/three/scene/createIndustrialContainer.js](../../web-dashboard/src/three/scene/createIndustrialContainer.js)

| 维度 | 数据 |
|---|---|
| 可渲染部件数 | 118 个 |
| doorEnd | `'high-x'`（门端在高 X） |
| doorCount | 2（左右双开门） |
| 部件清单 | 地板 / 左右侧墙 / 顶 / 前墙 / 4 角柱 / 4 上下纵梁 / 波纹板 / 门框 / 左右双开门（每门含 5 门波纹 + 2 锁杆 + 2 把手 + 4 铰链）/ review 剖切线框 |

### 2.2 叉车（createIndustrialForklift.js）

代码位置：[web-dashboard/src/three/scene/createIndustrialForklift.js](../../web-dashboard/src/three/scene/createIndustrialForklift.js)

| 维度 | 数据 |
|---|---|
| 部件数 | 34 个 |
| 部件清单 | 底盘 / 引擎盖 / 球形配重 / 座椅 / 挡风玻璃 / 4 驾驶室立柱 / 护顶架 + 3 护栏 / 门架导轨 + 3 横梁 / 载货架 + 2 货叉 / 4 轮子 + 轮毂 / 方向盘 / 警示灯 / 排气管 |

### 2.3 人工 actor（createManualWorker.js）

代码位置：[web-dashboard/src/three/scene/createManualWorker.js](../../web-dashboard/src/three/scene/createManualWorker.js)

| 维度 | 数据 |
|---|---|
| 部件数 | 10 个 |
| 关节数 | 4 个（leftArmPivot / rightArmPivot / leftLegPivot / rightLegPivot） |
| 部件清单 | 躯干 / 反光背心前后 + 2 反光带 / 肩部反光 / 颈部 / 头部 + 双眼 / 安全帽冠 + 帽檐 |

### 2.4 工地（createWorksite.js）

代码位置：[web-dashboard/src/three/scene/createWorksite.js](../../web-dashboard/src/three/scene/createWorksite.js)

| 维度 | 数据 |
|---|---|
| 部件数 | 9 个 |
| 部件清单 | 混凝土板 / 3 区域 plane / 2 车道线 / 9 安全斜纹 / dock-edge 路缘 / 4 护柱 / 仓库背景（含 5 装卸门 + 6 立柱）/ debugGrid（默认 hidden） |

---

## 3. 状态机

### 3.1 概览

代码位置：[web-dashboard/src/three/operation/operationMachine.js](../../web-dashboard/src/three/operation/operationMachine.js)

| 维度 | 数据 |
|---|---|
| 相位数 | 18 个 |
| 转移表 | NEXT_PHASE |
| 元数据 | PHASE_META（每相位有 label/action/duration） |
| 作业队列 | buildOperationQueue（按 x→y→z→loadingIndex 升序） |

### 3.2 18 相位列表

| # | 相位 | label | duration (s) |
|---|---|---|---|
| 1 | IDLE | 待机 | Infinity |
| 2 | OPENING_DOORS | 打开箱门 | 1.5 |
| 3 | MOVE_TO_CARGO | 驶向货物 | 1.7 |
| 4 | ALIGN_FOR_PICKUP | 取货对准 | 0.65 |
| 5 | INSERT_FORKS | 插入货叉 | 0.7 |
| 6 | LIFT_CARGO | 抬升货物 | 0.9 |
| 7 | MOVE_TO_STAGING | 移至门外 | 2.1 |
| 8 | ALIGN_WITH_DOOR | 对准门洞 | 0.7 |
| 9 | ENTER_CONTAINER | 通过门洞 | 1.45 |
| 10 | MOVE_INSIDE | 箱内行进 | 3.8 |
| 11 | ALIGN_WITH_TARGET | 目标对准 | 0.65 |
| 12 | LOWER_CARGO | 落货 | 0.85 |
| 13 | RELEASE_CARGO | 释放货物 | 0.65 |
| 14 | REVERSE_OUT | 倒车出箱 | 4.0 |
| 15 | RETURN_FOR_NEXT | 返回等待区 | 1.55 |
| 16 | PAUSED | 已暂停 | Infinity |
| 17 | BLOCKED | 作业阻断 | Infinity |
| 18 | COMPLETED | 作业完成 | Infinity |

详见 [THREE_D_STATE_MACHINE.md](./THREE_D_STATE_MACHINE.md)。

---

## 4. 坐标系

### 4.1 坐标轴定义

| 轴 | 含义 | 范围 | 说明 |
|---|---|---|---|
| X | 长度 | 0 → innerLength | 门端 doorPlaneX = length（高 X 端） |
| Y | 高度 | 0 → innerHeight | 地面 Y=0（重力轴） |
| Z | 宽度 | 0 → innerWidth | 左侧 Z=0，右侧 Z=innerWidth |

- 单位：毫米（mm）
- 渲染乘 0.001 转米（Three.js 场景）

### 4.2 关键坐标

| 名称 | 值 | 说明 |
|---|---|---|
| doorPlaneX | length | 门端 X 坐标（高 X 端） |
| DEFAULT_CLEARANCE | {side:30, top:35, bottom:5, collision:2} mm | 默认间隙 |
| doorOpening | {minY:5, maxY:height-35, minZ:30, maxZ:width-30} | 门洞范围 |
| waitingZone | {minX:length+2200, maxX:length+6200} | 等待区 |

详见 [THREE_D_COORDINATE_SPEC.md](./THREE_D_COORDINATE_SPEC.md)。

---

## 5. 作业流程

### 5.1 作业队列

`buildOperationQueue`（VERIFIED）：

```
按 x → y → z → loadingIndex 升序排序
深区优先（低 X 先装）、底层优先（低 Y 先装）
```

代码位置：[web-dashboard/src/three/operation/operationMachine.js:61](../../web-dashboard/src/three/operation/operationMachine.js)

### 5.2 路径 9 段

| 段 | 名称 | 说明 |
|---|---|---|
| 1 | home | 叉车初始位置 |
| 2 | waiting | 等待区 |
| 3 | waitingLifted | 等待区抬升 |
| 4 | staging | 门前对准区 |
| 5 | doorApproach | 门洞接近 |
| 6 | doorInside | 门洞内侧 |
| 7 | insideAligned | 箱内对准 |
| 8 | targetHover | 目标悬停 |
| 9 | target | 目标位置 |

详见 [THREE_D_OPERATION_FLOW.md](./THREE_D_OPERATION_FLOW.md)。

---

## 6. 碰撞检测

### 6.1 AABB 分离轴定理

- 方法：aabbIntersects
- tolerance：2mm
- 代码位置：[web-dashboard/src/three/operation/geometry.js](../../web-dashboard/src/three/operation/geometry.js)

### 6.2 路径校验

`validateCargoPath`（VERIFIED）：

- 采样 polyline（step=100mm）
- 逐点检查碰撞对象：
  - 前壁
  - 地板
  - 顶板
  - 侧壁
  - 门框
  - 已装货物

---

## 7. 相机系统

### 7.1 相机预设

代码位置：[web-dashboard/src/three/presentation/cameraPresets.js](../../web-dashboard/src/three/presentation/cameraPresets.js)

| 预设 | 说明 |
|---|---|
| overview | 总览 |
| door | 门端 |
| top | 俯视 |
| side | 侧视 |

### 7.2 相机功能

- buildCameraPreset：4 预设
- computeCameraFrame：自动构图
- follow 模式：跟随叉车/货物

---

## 8. 标签系统

### 8.1 标签布局

代码位置：[web-dashboard/src/three/presentation/labelLayout.js](../../web-dashboard/src/three/presentation/labelLayout.js)

- layoutProjectedLabels：防重叠
- 6 环候选偏移：在标签周围 6 个方向寻找无重叠位置

---

## 9. 队列筛选与分组

### 9.1 队列筛选

代码位置：[web-dashboard/src/three/presentation/operationFilters.js](../../web-dashboard/src/three/presentation/operationFilters.js)

7 维筛选：

| # | 维度 | 说明 |
|---|---|---|
| 1 | sku | SKU 编码 |
| 2 | batch | 批次 |
| 3 | port | 目的港 |
| 4 | sequence | 顺序 |
| 5 | actor | 搬运者（manual/forklift） |
| 6 | state | 作业状态 |
| 7 | risk | 风险等级 |

### 9.2 队列分组

代码位置：[web-dashboard/src/three/presentation/queueGroups.js](../../web-dashboard/src/three/presentation/queueGroups.js)

- 分组键：`sku::batch::port::handling::packaging`
- 合并连续相同项

---

## 10. 倍速控制

| 平台 | 倍速选项 |
|---|---|
| Web | 0.5 / 1 / 2 / 4× |
| 小程序 | 1 / 4 / 10 / 30× |

---

## 11. 渲染优化

### 11.1 InstancedMesh

- 已装货物使用 InstancedMesh 批量渲染
- 减少 draw call

### 11.2 剖切模式

- review 模式切换 shell 材质为透明（opacity 0.16）
- 用于查看箱内货物布局

---

## 12. actor 类型决定

### 12.1 actorType 由 cargo.handlingMethod 决定

| handlingMethod | actorType |
|---|---|
| manual | 人工 actor（createManualWorker） |
| forklift | 叉车（createIndustrialForklift） |

### 12.2 workerPoseFromForklift

- 工人位置 = 叉车位置 - 380mm（X 偏移）
- gait = sin(progress * 4π)（行走步态）

---

## 13. 测试覆盖

### 13.1 3D 相关测试文件

| 文件 | 关注点 | 代码位置 |
|---|---|---|
| geometry.test.js | 几何与碰撞 | [web-dashboard/src/three/operation/geometry.test.js](../../web-dashboard/src/three/operation/geometry.test.js) |
| operationMachine.test.js | 状态机 | [web-dashboard/src/three/operation/operationMachine.test.js](../../web-dashboard/src/three/operation/operationMachine.test.js) |
| cameraPresets.test.js | 相机预设 | [web-dashboard/src/three/presentation/cameraPresets.test.js](../../web-dashboard/src/three/presentation/cameraPresets.test.js) |
| labelLayout.test.js | 标签布局 | [web-dashboard/src/three/presentation/labelLayout.test.js](../../web-dashboard/src/three/presentation/labelLayout.test.js) |
| operationFilters.test.js | 队列筛选 | [web-dashboard/src/three/presentation/operationFilters.test.js](../../web-dashboard/src/three/presentation/operationFilters.test.js) |
| queueGroups.test.js | 队列分组 | [web-dashboard/src/three/presentation/queueGroups.test.js](../../web-dashboard/src/three/presentation/queueGroups.test.js) |
| sceneDescriptors.test.js | 场景描述 | [web-dashboard/src/three/scene/sceneDescriptors.test.js](../../web-dashboard/src/three/scene/sceneDescriptors.test.js) |
| cameraFrame.test.js | 相机构图 | [web-dashboard/src/three/cameraFrame.test.js](../../web-dashboard/src/three/cameraFrame.test.js) |

### 13.2 截图证据

| 目录 | 截图数 | 代码位置 |
|---|---|---|
| stage2-3d | 10 张 | [output/playwright/stage2-3d/](../../output/playwright/stage2-3d/) |
| three-motion | 5 张 | [output/playwright/three-motion/](../../output/playwright/three-motion/) |
| stage3/three | 17 张 | [output/playwright/stage3/three/](../../output/playwright/stage3/three/) |

详见 [THREE_D_EVIDENCE.md](./THREE_D_EVIDENCE.md)。

---

## 14. 边界声明（重要）

> **3D 作业过程可视化是真实坐标驱动的，不是物理仿真，不是工业级数字孪生。**

- 无实时数据回传（不与仓库 WMS/TMS 实时对接）
- 无双向控制（3D 可视化不接受用户控制反馈到算法）
- 不是物理仿真（叉车运动按预设路径，不模拟物理力学）
- 不是工业级数字孪生（无 PLC/SCADA 集成）

详见 [THREE_D_LIMITATIONS.md](./THREE_D_LIMITATIONS.md)。

---

## 15. 关键文件索引

| 文件 | 用途 | 代码位置 |
|---|---|---|
| createIndustrialContainer.js | 集装箱 | [web-dashboard/src/three/scene/createIndustrialContainer.js](../../web-dashboard/src/three/scene/createIndustrialContainer.js) |
| createIndustrialForklift.js | 叉车 | [web-dashboard/src/three/scene/createIndustrialForklift.js](../../web-dashboard/src/three/scene/createIndustrialForklift.js) |
| createManualWorker.js | 人工 actor | [web-dashboard/src/three/scene/createManualWorker.js](../../web-dashboard/src/three/scene/createManualWorker.js) |
| createWorksite.js | 工地 | [web-dashboard/src/three/scene/createWorksite.js](../../web-dashboard/src/three/scene/createWorksite.js) |
| sharedResources.js | 共享资源 | [web-dashboard/src/three/scene/sharedResources.js](../../web-dashboard/src/three/scene/sharedResources.js) |
| operationMachine.js | 状态机 | [web-dashboard/src/three/operation/operationMachine.js](../../web-dashboard/src/three/operation/operationMachine.js) |
| geometry.js | 几何与碰撞 | [web-dashboard/src/three/operation/geometry.js](../../web-dashboard/src/three/operation/geometry.js) |
| cameraPresets.js | 相机预设 | [web-dashboard/src/three/presentation/cameraPresets.js](../../web-dashboard/src/three/presentation/cameraPresets.js) |
| labelLayout.js | 标签布局 | [web-dashboard/src/three/presentation/labelLayout.js](../../web-dashboard/src/three/presentation/labelLayout.js) |
| operationFilters.js | 队列筛选 | [web-dashboard/src/three/presentation/operationFilters.js](../../web-dashboard/src/three/presentation/operationFilters.js) |
| queueGroups.js | 队列分组 | [web-dashboard/src/three/presentation/queueGroups.js](../../web-dashboard/src/three/presentation/queueGroups.js) |

---

## 16. 小程序 3D 渲染

| 维度 | 内容 |
|---|---|
| 引擎 | threejs-miniprogram 0.0.8 |
| 渲染器 | [miniprogram/utils/ThreeRenderer.js](../../miniprogram/utils/ThreeRenderer.js) |
| v33.0-FINAL | [miniprogram/utils/ThreeRenderer-v33.0-FINAL.js](../../miniprogram/utils/ThreeRenderer-v33.0-FINAL.js) |
| 倍速 | 1 / 4 / 10 / 30× |
| 包 | [miniprogram/miniprogram_npm/threejs-miniprogram/](../../miniprogram/miniprogram_npm/threejs-miniprogram/) |

> 小程序与 Web 共享算法坐标，但渲染实现独立（受小程序平台限制）。
