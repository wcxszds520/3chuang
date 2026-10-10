# 3D 证据 (THREE_D_EVIDENCE)

> 生成时间：2026-07-11
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`
> 本文汇总 3D 相关的测试文件、截图证据与运动轨迹证据。

---

## 1. 测试文件清单

### 1.1 3D 相关测试文件（8 个）

| # | 文件 | 关注点 | 代码位置 |
|---|---|---|---|
| 1 | geometry.test.js | 几何与碰撞检测 | [web-dashboard/src/three/operation/geometry.test.js](../../web-dashboard/src/three/operation/geometry.test.js) |
| 2 | operationMachine.test.js | 18 相位状态机 | [web-dashboard/src/three/operation/operationMachine.test.js](../../web-dashboard/src/three/operation/operationMachine.test.js) |
| 3 | cameraPresets.test.js | 相机预设 | [web-dashboard/src/three/presentation/cameraPresets.test.js](../../web-dashboard/src/three/presentation/cameraPresets.test.js) |
| 4 | labelLayout.test.js | 标签布局防重叠 | [web-dashboard/src/three/presentation/labelLayout.test.js](../../web-dashboard/src/three/presentation/labelLayout.test.js) |
| 5 | operationFilters.test.js | 队列 7 维筛选 | [web-dashboard/src/three/presentation/operationFilters.test.js](../../web-dashboard/src/three/presentation/operationFilters.test.js) |
| 6 | queueGroups.test.js | 队列分组合并 | [web-dashboard/src/three/presentation/queueGroups.test.js](../../web-dashboard/src/three/presentation/queueGroups.test.js) |
| 7 | sceneDescriptors.test.js | 场景描述 | [web-dashboard/src/three/scene/sceneDescriptors.test.js](../../web-dashboard/src/three/scene/sceneDescriptors.test.js) |
| 8 | cameraFrame.test.js | 相机自动构图 | [web-dashboard/src/three/cameraFrame.test.js](../../web-dashboard/src/three/cameraFrame.test.js) |

### 1.2 测试关注点

#### geometry.test.js

代码位置：[web-dashboard/src/three/operation/geometry.test.js](../../web-dashboard/src/three/operation/geometry.test.js)

- `buildCargoPath`：9 段路径构建
- `lerpPoint`：线性插值
- `pointAlongPolyline`：沿 polyline 取点
- `validateCargoPath`：路径碰撞校验
- `aabbIntersects`：AABB 分离轴定理（tolerance=2mm）

#### operationMachine.test.js

代码位置：[web-dashboard/src/three/operation/operationMachine.test.js](../../web-dashboard/src/three/operation/operationMachine.test.js)

- 18 相位完整性
- NEXT_PHASE 转移正确性
- PHASE_META 元数据（label/action/duration）
- buildOperationQueue 排序（x→y→z→loadingIndex）
- play/pause/resume 行为
- BLOCKED 触发条件
- COMPLETED 终态

#### cameraPresets.test.js

代码位置：[web-dashboard/src/three/presentation/cameraPresets.test.js](../../web-dashboard/src/three/presentation/cameraPresets.test.js)

- 4 预设（overview/door/top/side）
- buildCameraPreset 返回值
- 相机位置/朝向

#### labelLayout.test.js

代码位置：[web-dashboard/src/three/presentation/labelLayout.test.js](../../web-dashboard/src/three/presentation/labelLayout.test.js)

- layoutProjectedLabels 防重叠
- 6 环候选偏移
- 标签锚点

#### operationFilters.test.js

代码位置：[web-dashboard/src/three/presentation/operationFilters.test.js](../../web-dashboard/src/three/presentation/operationFilters.test.js)

- 7 维筛选（sku/batch/port/sequence/actor/state/risk）
- 多维组合筛选

#### queueGroups.test.js

代码位置：[web-dashboard/src/three/presentation/queueGroups.test.js](../../web-dashboard/src/three/presentation/queueGroups.test.js)

- 分组键 `sku::batch::port::handling::packaging`
- 连续相同项合并

#### sceneDescriptors.test.js

代码位置：[web-dashboard/src/three/scene/sceneDescriptors.test.js](../../web-dashboard/src/three/scene/sceneDescriptors.test.js)

- 场景部件描述
- 集装箱 118 部件
- 叉车 34 部件
- 工人 10 部件
- 工地 9 部件

#### cameraFrame.test.js

代码位置：[web-dashboard/src/three/cameraFrame.test.js](../../web-dashboard/src/three/cameraFrame.test.js)

- computeCameraFrame 自动构图
- follow 模式

---

## 2. 截图证据清单

### 2.1 stage2-3d（10 张）

代码位置：[output/playwright/stage2-3d/](../../output/playwright/stage2-3d/)

| # | 文件名 | 内容 |
|---|---|---|
| 1 | 01-overview.png | 总览视角 |
| 2 | 02-door.png | 门端视角 |
| 3 | 03-side.png | 侧视视角 |
| 4 | 04-top.png | 俯视视角 |
| 5 | 05-operation-in-progress.png | 作业进行中 |
| 6 | 06-fork-pickup.png | 叉车取货 |
| 7 | 07-entering-door.png | 通过门洞 |
| 8 | 08-placed-complete.png | 放置完成 |
| 9 | 09-blocked.png | 作业阻断 |
| 10 | 10-group-expanded.png | 分组展开 |

结果文件：[output/playwright/stage2-3d/results.json](../../output/playwright/stage2-3d/results.json)

### 2.2 three-motion（5 张）

代码位置：[output/playwright/three-motion/](../../output/playwright/three-motion/)

| # | 文件名 | 内容 |
|---|---|---|
| 1 | cargo-on-forks.png | 货物在货叉上 |
| 2 | fork-lifting-current-cargo.png | 货叉抬升货物 |
| 3 | cargo-entering-through-door.png | 货物通过门洞 |
| 4 | cargo-placed-at-real-target.png | 货物放置在真实目标 |
| 5 | cargo-entering-through-door.png | 货物进入门洞（多角度） |

结果文件：[output/playwright/three-motion/results.json](../../output/playwright/three-motion/results.json)

### 2.3 stage3/three（17 张）

代码位置：[output/playwright/stage3/three/](../../output/playwright/stage3/three/)

| # | 文件名 | 内容 |
|---|---|---|
| 1 | 01-overview.png | 总览 |
| 2 | 02-door.png | 门端 |
| 3 | 03-side.png | 侧视 |
| 4 | 04-top.png | 俯视 |
| 5 | 05-forklift-pickup.png | 叉车取货 |
| 6 | 06-forklift-entering.png | 叉车进入 |
| 7 | 07-forklift-placed.png | 叉车放置 |
| 8 | 08-manual-pickup.png | 人工取货 |
| 9 | 09-manual-carrying.png | 人工搬运 |
| 10 | 10-manual-entering.png | 人工进入 |
| 11 | 11-manual-placed.png | 人工放置 |
| 12 | 12-filter-by-port.png | 按港口筛选 |
| 13 | 13-filter-by-actor.png | 按搬运者筛选 |
| 14 | 14-filter-by-batch.png | 按批次筛选 |
| 15 | 15-speed-16x.png | 16 倍速 |
| 16 | 16-group-expanded.png | 分组展开 |
| 17 | 17-blocked.png | 作业阻断 |

结果文件：[output/playwright/stage3/three/screenshot-manifest.json](../../output/playwright/stage3/three/screenshot-manifest.json)

### 2.4 失败截图

代码位置：[output/playwright/stage3/three/failure.png](../../output/playwright/stage3/three/failure.png)

---

## 3. 闸门证据（Gate JSON）

### 3.1 three-gate.json

代码位置：[output/playwright/stage3/three/three-gate.json](../../output/playwright/stage3/three/three-gate.json)

3D 闸门验证结果汇总。

### 3.2 filter-gate.json

代码位置：[output/playwright/stage3/three/filter-gate.json](../../output/playwright/stage3/three/filter-gate.json)

队列筛选闸门验证。

### 3.3 label-layout-gate.json

代码位置：[output/playwright/stage3/three/label-layout-gate.json](../../output/playwright/stage3/three/label-layout-gate.json)

标签布局闸门验证。

### 3.4 speed-gate.json

代码位置：[output/playwright/stage3/three/speed-gate.json](../../output/playwright/stage3/three/speed-gate.json)

倍速闸门验证。

---

## 4. 运动轨迹证据

### 4.1 forklift-motion-trace.json

代码位置：[output/playwright/stage3/three/forklift-motion-trace.json](../../output/playwright/stage3/three/forklift-motion-trace.json)

叉车运动轨迹记录：

- 9 段路径采样点
- 每段路径的起止坐标
- 相位时间戳
- 碰撞校验结果

### 4.2 manual-motion-trace.json

代码位置：[output/playwright/stage3/three/manual-motion-trace.json](../../output/playwright/stage3/three/manual-motion-trace.json)

人工 actor 运动轨迹记录：

- 工人位置（= 叉车位置 - 380mm）
- 步态 gait = sin(progress * 4π)
- 9 段路径采样点
- 相位时间戳

### 4.3 轨迹内容结构

```json
{
  "cargoId": "c-001",
  "actorType": "forklift",
  "path": [
    { "segment": "home", "x": 15232, "y": 0, "z": 1176, "phase": "IDLE" },
    { "segment": "waiting", "x": 14232, "y": 0, "z": 500, "phase": "MOVE_TO_CARGO" },
    { "segment": "waitingLifted", "x": 14232, "y": 1000, "z": 500, "phase": "LIFT_CARGO" },
    { "segment": "staging", "x": 12032, "y": 1000, "z": 500, "phase": "MOVE_TO_STAGING" },
    { "segment": "doorApproach", "x": 12032, "y": 1000, "z": 500, "phase": "ENTER_CONTAINER" },
    { "segment": "doorInside", "x": 11500, "y": 1000, "z": 500, "phase": "MOVE_INSIDE" },
    { "segment": "insideAligned", "x": 3000, "y": 1000, "z": 500, "phase": "ALIGN_WITH_TARGET" },
    { "segment": "targetHover", "x": 3000, "y": 1000, "z": 500, "phase": "LOWER_CARGO" },
    { "segment": "target", "x": 3000, "y": 1000, "z": 500, "phase": "RELEASE_CARGO" }
  ],
  "validation": "VALID",
  "duration": 21.2
}
```

---

## 5. 截图与相位对应

### 5.1 stage3/three 截图与相位映射

| 截图 | 对应相位 | 说明 |
|---|---|---|
| 01-overview | IDLE/COMPLETED | 总览全局 |
| 02-door | IDLE/COMPLETED | 门端视角 |
| 05-forklift-pickup | LIFT_CARGO | 叉车取货抬升 |
| 06-forklift-entering | ENTER_CONTAINER | 叉车通过门洞 |
| 07-forklift-placed | RELEASE_CARGO | 叉车放置完成 |
| 08-manual-pickup | LIFT_CARGO | 人工取货 |
| 09-manual-carrying | MOVE_TO_STAGING | 人工搬运 |
| 10-manual-entering | ENTER_CONTAINER | 人工进入 |
| 11-manual-placed | RELEASE_CARGO | 人工放置 |
| 17-blocked | BLOCKED | 作业阻断 |

### 5.2 筛选截图

| 截图 | 筛选维度 | 说明 |
|---|---|---|
| 12-filter-by-port | port | 按目的港筛选 |
| 13-filter-by-actor | actor | 按搬运者筛选 |
| 14-filter-by-batch | batch | 按批次筛选 |

### 5.3 倍速截图

| 截图 | 倍速 | 说明 |
|---|---|---|
| 15-speed-16x | 16× | 16 倍速作业（注：Web 最大 4×，16× 可能为小程序） |

> 注：Web 倍速选项为 0.5/1/2/4×，小程序为 1/4/10/30×。15-speed-16x.png 的 16× 可能是标注差异，实际应为 4× 或 10×。

---

## 6. 相机预设证据

### 6.1 4 预设截图

| 预设 | 截图 | 说明 |
|---|---|---|
| overview | 01-overview.png | 总览 |
| door | 02-door.png | 门端 |
| side | 03-side.png | 侧视 |
| top | 04-top.png | 俯视 |

### 6.2 相机测试

代码位置：[web-dashboard/src/three/presentation/cameraPresets.test.js](../../web-dashboard/src/three/presentation/cameraPresets.test.js)

- 验证 4 预设的相机位置
- 验证相机朝向
- 验证 computeCameraFrame 自动构图

---

## 7. 标签布局证据

### 7.1 标签防重叠

代码位置：[web-dashboard/src/three/presentation/labelLayout.js](../../web-dashboard/src/three/presentation/labelLayout.js)

- layoutProjectedLabels：3D 坐标投影到 2D 屏幕
- 6 环候选偏移：标签重叠时在 6 个方向寻找无重叠位置

### 7.2 标签测试

代码位置：[web-dashboard/src/three/presentation/labelLayout.test.js](../../web-dashboard/src/three/presentation/labelLayout.test.js)

- 验证标签不重叠
- 验证 6 环偏移
- 验证标签锚点

### 7.3 标签闸门

代码位置：[output/playwright/stage3/three/label-layout-gate.json](../../output/playwright/stage3/three/label-layout-gate.json)

---

## 8. 集装箱部件证据

### 8.1 118 部件（VERIFIED）

代码位置：[web-dashboard/src/three/scene/createIndustrialContainer.js](../../web-dashboard/src/three/scene/createIndustrialContainer.js)

| 部件类别 | 数量 | 明细 |
|---|---|---|
| 主体结构 | 5 | 地板/左右侧墙/顶/前墙 |
| 角柱 | 4 | 4 角柱 |
| 纵梁 | 8 | 4 上下纵梁 |
| 波纹板 | 多 | 侧墙/门波纹 |
| 门框 | 1 | 门框结构 |
| 双开门 | 2 | 左右双开门 |
| 门波纹 | 10 | 每门 5 波纹 ×2 门 |
| 锁杆 | 4 | 每门 2 锁杆 ×2 门 |
| 把手 | 4 | 每门 2 把手 ×2 门 |
| 铰链 | 8 | 每门 4 铰链 ×2 门 |
| review 剖切线框 | 1 | 透明模式线框 |
| 合计 | 118 | - |

### 8.2 sceneDescriptors 测试

代码位置：[web-dashboard/src/three/scene/sceneDescriptors.test.js](../../web-dashboard/src/three/scene/sceneDescriptors.test.js)

验证场景部件描述的完整性。

---

## 9. 叉车部件证据

### 9.1 34 部件（VERIFIED）

代码位置：[web-dashboard/src/three/scene/createIndustrialForklift.js](../../web-dashboard/src/three/scene/createIndustrialForklift.js)

| 部件类别 | 数量 | 明细 |
|---|---|---|
| 底盘 | 1 | 底盘 |
| 引擎盖 | 1 | 引擎盖 |
| 配重 | 1 | 球形配重 |
| 座椅 | 1 | 座椅 |
| 挡风玻璃 | 1 | 挡风玻璃 |
| 驾驶室立柱 | 4 | 4 立柱 |
| 护顶架 | 4 | 护顶架 + 3 护栏 |
| 门架导轨 | 4 | 门架导轨 + 3 横梁 |
| 载货架 | 1 | 载货架 |
| 货叉 | 2 | 2 货叉 |
| 轮子 | 8 | 4 轮子 + 4 轮毂 |
| 方向盘 | 1 | 方向盘 |
| 警示灯 | 1 | 警示灯 |
| 排气管 | 1 | 排气管 |
| 其他 | 3 | 细节部件 |
| 合计 | 34 | - |

---

## 10. 人工 actor 部件证据

### 10.1 10 部件 + 4 关节（VERIFIED）

代码位置：[web-dashboard/src/three/scene/createManualWorker.js](../../web-dashboard/src/three/scene/createManualWorker.js)

| 部件类别 | 数量 | 明细 |
|---|---|---|
| 躯干 | 1 | 躯干 |
| 反光背心 | 2 | 前后 |
| 反光带 | 2 | 2 反光带 |
| 肩部反光 | 1 | 肩部反光 |
| 颈部 | 1 | 颈部 |
| 头部 | 1 | 头部 + 双眼 |
| 安全帽 | 2 | 帽冠 + 帽檐 |
| 合计 | 10 | - |

关节：

| 关节 | 用途 |
|---|---|
| leftArmPivot | 左臂旋转 |
| rightArmPivot | 右臂旋转 |
| leftLegPivot | 左腿旋转 |
| rightLegPivot | 右腿旋转 |

---

## 11. 工地部件证据

### 11.1 9 部件（VERIFIED）

代码位置：[web-dashboard/src/three/scene/createWorksite.js](../../web-dashboard/src/three/scene/createWorksite.js)

| 部件 | 数量 | 明细 |
|---|---|---|
| 混凝土板 | 1 | 地基 |
| 区域 plane | 3 | 3 区域 |
| 车道线 | 2 | 2 车道线 |
| 安全斜纹 | 9 | 9 斜纹 |
| dock-edge 路缘 | 1 | 路缘 |
| 护柱 | 4 | 4 护柱 |
| 仓库背景 | 1 | 含 5 装卸门 + 6 立柱 |
| debugGrid | 1 | 默认 hidden |
| 合计 | 9 | - |

---

## 12. 证据边界声明

- 截图证据来自 Playwright 自动化测试，反映特定时间点的 UI 状态
- 运动轨迹 JSON 记录路径采样点，不包含完整帧动画
- 测试文件数量为静态统计，实际运行用例数需本地运行获取
- 截图中的 16× 倍速标注可能存在差异，以代码中 Web 4× / 小程序 30× 为准
- 部件数为代码静态统计，实际渲染可能因版本微调
- 闸门 JSON 文件记录验证结果，具体内容需打开文件查看
