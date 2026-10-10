# 3D 装柜作业规范

更新时间：2026-07-12。实现使用真实后端 `loadedCargo` 坐标；3D 只派生作业路径和表现，不改写方案。

## 坐标与门端

- X：集装箱长度/深度，0 为封闭前壁，`innerLength` 为唯一门端（high-x）。
- Y：高度，0 为地板，`innerHeight` 为顶板。
- Z：宽度，0..`innerWidth`。
- 40HQ 内尺寸：12032×2352×2698 mm；可用门洞按门框裕量派生为 2292×2658 mm。
- 两扇可见门板只存在于 high-x 端，先连续打开再允许 cargo/actor 通过。
- 目标坐标直接来自 `loadedCargo[].x/y/z/l/w/h`；视觉视图、筛选和标签不修改坐标。

## 路径与约束

每件货物的派生路径包含：actor 起点 → 货物等待位 → 门外 staging → 门前对准 → 门洞通过点 → 箱内安全点 → 真实目标位 → 反向退出 → 返回。

进入前检查：

1. 货物朝向后的门洞宽/高；
2. 目标在箱内边界；
3. 路径不穿侧壁、顶板、封闭前壁；
4. 路径和目标不与已装货物非法相交；
5. 人工作业的必要尺寸/重量字段完整；
6. 人工单件不超过演示安全边界，否则建议叉车或拆分。

失败进入 `BLOCKED`，货物保持后端原目标，不通过缩放或改坐标伪装可行；UI 同屏显示原因、“记录并跳过”和返回修改入口。

## 状态机

权威实现：`web-dashboard/src/three/operation/operationMachine.js`。

```text
IDLE
→ OPEN_DOORS
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
→ NEXT_CARGO / COMPLETED
```

- manual 与 forklift 使用同一约束状态机，但 actor pose/速度/取货语义不同。
- 时间推进采用连续插值；scene delta 封顶 1/60 秒，16× 也不能跨过视觉关键阶段。
- 暂停不推进 machine 或场景坐标；继续从当前时间恢复；重置重建 IDLE；跳件重放到指定 machine index。
- 当前动画 cargo 使用独立 mesh；释放后转为 instanced placed cargo，避免双重显示。

## 叉车

权威场景实现：`web-dashboard/src/three/scene/TwinScene.js` 与叉车描述/创建模块。

- 34 个可辨识部件，包括车身、驾驶位、门架、货叉和车轮。
- 车身朝路径切线连续转向，车轮按移动距离转动。
- `INSERT_FORKS` 改变 fork extension；`LIFT/LOWER` 改变 fork height。
- pickup 后 cargo 绑定货叉；release 后解除并进入 placed rendering；`REVERSE_OUT` 经同一门洞退出。

## 人工作业

权威实现：`web-dashboard/src/three/actors/createManualWorker.js`。

- 20 个低多边形部件：头、躯干、双臂/前臂、双手、双腿/小腿、鞋等。
- 行走时四肢按连续相位摆动；接近/取货/搬运/放置/返回使用不同 pose。
- pickup 后货物绑定到双手前方的 carry anchor；不是只移动文字或让货物漂浮。
- 货物过门和释放使用与叉车相同的门洞/边界/碰撞规则。

## 速度、筛选、队列与标签

- 速度：0.5×、1×、2×、4×、8×、16×。
- 七类筛选：SKU、batch、destination port、port sequence、actor、state、risk。
- 筛选只改变可见队列/场景表达；`machine` 和 plan fingerprint 不变。实测 221→39→0→221。
- 221 条 machine 项按连续 SKU/批次/港口/actor 分成 10 组；默认只渲染 12 条 item rows，展开和跳组仍使用原 index。
- 标签模式：simple、detail、debug。simple 为默认，只突出当前货物、目标和当前阶段；实测 8 个状态最多 3 标签、重叠数 0。
- 标签来自 Three.js 世界坐标投影，不使用固定 CSS 坐标冒充对象跟随。

## 相机与构图

- 总览：容器、唯一门端、门外作业区、actor、当前货物和路径同屏。
- 门端、俯视、侧视：根据容器包围盒和 canvas aspect 计算距离。
- 跟随：目标保持 actor/cargo 作业区域，切换不翻转 up vector。
- 1920×1080、1672×941、1280×720 均完成截图检查；canvas、控制条和右侧作业面板可用。

## 测试与证据

- 单元：geometry 6、operationMachine 10、sceneDescriptors 4，以及 camera/filter/group/label/appearance 等测试；总计并入 Web 79 tests。
- 浏览器完整轨迹：人工 155 samples、叉车 156 samples；双方均覆盖 13 个 machine states 和 move/pickup/lift/carry/enter/place/release/exit/return 9 个 actor stages。
- 最大相邻 actor 位移：人工 673.83 mm、叉车 658.85 mm；最大 cargo 位移 606.72/572.53 mm。
- 暂停坐标稳定；重置后 doorProgress 0、index 0、completed 0、speed 1、label simple/3/overlap0。
- 主证据：`output/playwright/stage3/three/three-gate.json`、`manual-motion-trace.json`、`forklift-motion-trace.json`、`speed-gate.json`、`filter-gate.json`、`label-layout-gate.json`。
- 视觉证据：`output/playwright/stage3/three/01-overview.png` 至 `17-blocked.png` 及 `visual-audit/three-contact-sheet.jpg`。
