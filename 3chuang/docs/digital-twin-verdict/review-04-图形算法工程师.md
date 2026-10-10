# 诊断报告 04 · 图形算法工程师

> 执行日期：2026-09-18　｜　代理身份：高级图形与 3D 管线算法工程师
> 输入：`web-dashboard/src/three/` 全目录、`package.json`、`assetManifest.js`、`asset-contract.json`、GLB 二进制实测
> **本报告包含对 00 号全局诊断的一处关键纠正。**

---

## 1. 一句话结论

**瓶颈在 CPU 侧的 draw-call 提交，根因是重资产 GLB 未做静态网格合并（集装箱 GLB 210 个网格零合并、工人 GLB 84 网格 ×2 实例零合并）；而放置货物早已走 `InstancedMesh` + 程序化几何，并非全局诊断所估的"42×107=4494"来源——真正缺的是"改代码即可解决的批处理闸门"与"改资产才能解决的压缩/预算闸门"。**

### 纠正：全局诊断的 5,300 draw call 是错的

已逐行核对 `TwinScene.jsx`：
- `:434 initializePlacedBatches(runtime)` → `:1591` → `:1308 new THREE.InstancedMesh(createTypedCargoGeometry(appearance.key), material, count)` → **放置货物是实例化 + 程序化几何**
- `:553-570` 加载 GLB kit 后调用 `applyCargoKitGeometries(runtime, scene)` 再 `disposeObject(scene)` → **GLB 只作为几何来源，不逐件渲染**
- `loadPackagingAsset()`（真正逐件渲染 107 网格纸箱）只在 `TaskOverviewScene.jsx:66` 与 `PackagingModelViewer.jsx:53` 使用

**修正后的真实构成：**

| 场景对象 | 网格数 | 是否批处理 | draw call |
|---|---:|---|---:|
| 集装箱（`:475`） | 210 | ❌ 未批处理 | **210** |
| 工人（`:518` 司机 + `:533` 站立，实例化两次） | 84 ×2 | ❌ 未批处理 | **168** |
| 地牛（`:467` 长款 + 短款） | 50 ×2 | ❌ 未批处理 | **100** |
| 叉车（`:510`） | 453 | ✅ `batchStaticAsset` | ~20 |
| 放置货物 | — | ✅ 分桶实例化 | ~15 |
| 等待区货物 | — | ✅ | ~10 |
| 标签 / Sprite | — | — | ~15 |
| 环境 / 线框 / 叠加 | — | — | ~40 |
| **合计** | | | **≈ 580** |

关键事实：`batchStaticAsset()`（`:637`）写得完整，**但只有叉车调用了它**。集装箱、工人、地牛三处漏调 → 478 个白送的 draw call。

## 2. Baseline 指标清单 + 采样代码

**必须实测**（`renderer.info` 已设 `autoReset=false`，`:217` 手动 reset）：`render.calls`（CPU 提交量）、`render.triangles`（GPU 顶点负载）、`memory.geometries` / `textures`、`programs.length`；辅助 `scene.traverseVisible` 数可见 Mesh 与命名关节存活。

**采样三状态**：画质 `low`/`standard`/`high` × "静态完成图 / 叉车运动+工人行走 / 剖切叠加"，各取 60 帧中位数。

```js
// runtime = mount.__inspection（DEV 下已挂载，:459）
function sampleBaseline(runtime, tag) {
  const info = runtime.renderer.info;
  let meshUnits = 0;
  runtime.scene.traverseVisible(o => { if (o.isMesh || o.isInstancedMesh) meshUnits += o.isInstancedMesh ? o.count : 1; });
  const joints = ['forklift_carriage','fork_l','fork_r','wheel_fl','worker_left_arm_pivot','door_left_pivot']
    .map(n => [n, Boolean(runtime.scene.getObjectByName(n))]);
  return { tag, tier: runtime.mount.dataset.qualityTier,
    drawCalls: info.render.calls, triangles: info.render.triangles,
    geometries: info.memory.geometries, textures: info.memory.textures,
    programs: info.programs.length, meshUnits, joints };
}
['low','standard','high'].forEach(q => {
  applyQuality(runtime, q);
  requestAnimationFrame(() => console.table([sampleBaseline(runtime, q)]));
});
```

## 3. 瓶颈定位判断

**结论：CPU 提交瓶颈，非 GPU 着色瓶颈。** 推导：
- GPU 三角面 ≈ 278k（集装箱 147k + 叉车 114k + 工人 17k×2）；在 30fps / 33.3ms 预算内**完全可承受**
- draw call ≈ 580，CPU 端每次状态切换/提交在集显上约 0.2–0.5ms 级；478 个冗余调用是纯浪费
- **所以治本是降 draw call（批处理），不是降三角面**

**GTAO(16 samples)+SMAA+pixelRatio 2 能否 30fps？** 4K 面板 pixelRatio=2 等效 5120×2880，GTAO `resolutionScale=1`（high，`:886`）+16 采样是全屏多 pass，与场景复杂度无关，集显上约 3–6ms；叠加 SMAA（全分辨率）+ OutputPass，总后处理约 6–10ms。33.3ms 下余量够，但 **high 档 AO 应降到 `resolutionScale 0.5`、pixelRatio 封顶 1.5**。

**`shadowMap.autoUpdate=false` 是掩盖还是优化？** 是**掩盖**。`invalidateShadows` 只在离散事件触发（`:574`），而 `updateRuntime` 每帧驱动叉车/工人运动——平滑运动时阴影图不刷新，关节与货叉投影会滞后抖动。正确做法：仅在"有物体位移的那一帧"置 `needsUpdate = true`。

## 4. 资产预算合同表（写入 CI）

目标：**整场景 ≤ 800 draw call**。先定预算，再反推资产规格。

| 资产类 | 三角面上限 | 网格数上限 | 材质上限 | 贴图 | 体积上限 | 推导依据 |
|---|---:|---:|---:|---|---:|---|
| 货物 cargo | 1,500 | 3（合并后） | 3 | ≤1024 KTX2 | 300 KB | 同型实例化，单桶 1 call；1,500 面 × ~20 桶 = 30k 面可控 |
| 集装箱 container | 5,000 | ≤17 | 17 | ≤1024 KTX2 | 1.5 MB | 仅 1 实例，210 网格 → 每材质 1 批 = 17；147k 面经 decimate 到 5k 仍保形 |
| 叉车 forklift | 8,000 | ≤20（活动件 7 不可合并） | 6 | ≤1024 KTX2 | 1.5 MB | carriage + 2 叉 + 4 轮 = 7 受关节驱动不可合并，其余合并到 ≤13 |
| 工人 worker | 6,000 | ≤10（枢轴除外） | 7 | ≤1024 KTX2 | 800 KB | 5 个枢轴 Group 不可合并，其余合并到 ≤5；×2 实例 |
| 环境 / 地坪 | 4,000 | ≤8 | ≤6 | ≤1024 KTX2 | 1 MB | 一次性 hero，无动画 |
| UI 叠加层 | — | — | — | — | — | ≤60 call（Sprite 单计） |

**预算分配（800）**：货物 30 / 集装箱 17 / 叉车 20 / 工人 14 / 环境 8 / 叠加 60 / 余量 651。
**降级策略**：CI 失败 → 自动 `gltfpack -si` 简化 → 仍超则降 LOD0。

## 5. 资产管线设计

```
Blender headless CLI (build_assets.py)
   │ 程序化节点 (Noise/Roughness/ColorRamp/Bump) 不导出 glTF → 必须烘焙
   ▼
[烘焙] bake Normal / AO / Roughness 到 UV
   ▼
[gltfpack] 合并静态网格 + 保留命名节点 + KTX2 贴图 + meshopt 几何压缩
   ▼
[CI 闸门] glb-inspect 统计 vs 预算合同 + 命名节点存活检查 → 超限 fail
   ▼
运行时 (three 0.179)
```

**具体命令与参数理由**：
```bash
npm i -g gltfpack
# 集装箱：-kn 保留门枢轴节点名；-km 保留材质名（calibrateRuntimeAssetMaterials 靠正则匹配 paint/metal/wood/floor）
gltfpack -i container_40hq.glb -o container_40hq.opt.glb -cc -tc -si 0.5 -kn -km
# 叉车：-kn 必须保留 forklift_carriage / fork_l / fork_r / wheel_fl..，否则 :504-506 找节点失配 → 货叉不动
gltfpack -i forklift_articulated.glb -o forklift.opt.glb -cc -tc -kn -km
# 工人：-kn 保留 worker_*_pivot，否则 bindWorkerRig 返回 null → 工人不摆臂
gltfpack -i worker_articulated.glb -o worker.opt.glb -cc -tc -kn -km
# 货物：-si 0.4 把 20k → ~8k，合并到 ≤3 网格
gltfpack -i cargo_carton.glb -o cargo_carton.opt.glb -cc -tc -si 0.4 -kn -km
```
**烘焙策略**：Blender 程序化节点不导出 glTF，必须 bake Normal / AO / Roughness；金属度走顶点色或常量。KTX2 用 `-tc`（内部调 basisu/toktx），`UASTC` 保质量 / `ETC1S` 更小。

**收益量化（必须区分传输体积与运行时成本）**：
- **传输体积**：container 8,010 KB → 几何 7.65 MB 经 meshopt 约 2.0 MB + 6 张 PNG(1.4 MB) → KTX2 约 0.4 MB ≈ **2.4 MB（↓70%）**；forklift 6,719 → ~1.9 MB（↓72%）；cargo 2,027 → ~0.7 MB（↓65%）
- **运行时成本（解码后三角面 / draw call）不被 `-cc` / `-tc` 改变**——meshopt 只降传输，不降解码顶点。运行时降成本只能靠 `-si` 简化、批处理、LOD
- 叉车 453 网格经 `-kn -km` 合并静态后 ≈ 20 网格（活动 7 + 静态合并 13）

**CI 闸门伪代码**：
```js
const stats = inspectGLB(file);              // 复用 tools/glb-inspect.js
const contract = JSON.parse(fs.readFileSync('asset-budget.json'));
for (const k of ['tris','meshes','materials','bytes'])
  if (stats[k] > contract[assetClass][k]) fail(`${file}: ${k} ${stats[k]} > ${contract[k]}`);
if (!keepsNamedNodes(file, REQUIRED_PIVOTS[assetClass])) fail('命名关节节点缺失');
```

## 6. 实例化与批处理方案

1. `InstancedMesh`（`sharedResources.addInstancedBoxes` 已实现）是货物的**正确答案**：同型同尺寸 1 次提交渲染 N 件。**它不能解决**：不同尺寸/材质、需独立拾取高亮的件（当前作业件/风险件/目标件）。
2. **混合分组**：分组键 = `(外观类型, l, h, w, 材质)` → 同键进 `InstancedMesh`；需交互的用独立 `Mesh`（`:1165 createCargoObject` 已支持）。
3. **draw call 计算**：放置货物已是实例化，主孪生这部分 ≈ 桶数（~15），**已最优**；若退回 GLB 逐件（TaskOverview 路径）则 42×107 = 4,494 → 实例化后 ~15，**降 299 倍**。主孪生真正可降的是 GLB 批处理（580 → ~120）。
4. **拾取**：`Raycaster` 对 `InstancedMesh` 返回 `instanceId`；高亮只需改该实例 `instanceColor`（`:1366` 已有 `instanceColor.needsUpdate`），无需拆独立 Mesh。相交语义靠 `batchKey → cargoId` 映射表维护。
5. **`EXT_mesh_gpu_instancing`（`-mi`）vs 运行时 `InstancedMesh`**：`-mi` 把实例写进 GLB，加载即用但**失去运行时按帧改矩阵的灵活性**（本项目货物位置每帧由求解器驱动）。结论：**运行时 `InstancedMesh` 更合适**；`-mi` 仅适合完全静态装饰。

## 7. LOD 体系设计表

| 档 | 触发判据 | 三角面 | 材质/贴图 | 用途 |
|---|---|---|---|---|
| LOD0 近 | 屏幕覆盖率 >8% 或 当前聚焦作业件 | 全预算（容器 5k / 叉车 8k） | 全 PBR + KTX2 | 特写 |
| LOD1 中 | 覆盖率 2–8% | 预算 ×0.4 | PBR 无 AO 贴图 | 常规 |
| LOD2 远 | 覆盖率 <2% 或 顶视/总览相机 | 预算 ×0.15 | 顶点色近似 | 全场 |

- **判据不用纯距离**：用**屏幕覆盖率**（投影面积 / 视口面积）+ **相机模式**（顶视强制 LOD2）+ **聚焦件豁免**（当前作业件锁 LOD0）
- **语义一致性**：raycasting / 高亮绑定到 `batchKey` / `cargoId` 而**非具体 LOD 网格**；切换 LOD 时保留同一拾取代理，避免"选不中"
- **滞回**：进入 LOD1 阈值 8%、退回 LOD0 阈值 11%（3% 迟滞带），防边界抖动

## 8. three.js 升级评估

**是否升级：升，但作为独立分支（P1），不与资产改造同做**（否则无法归因）。

- **会破坏现有代码的变更**：(a) `EffectComposer` 在 r183 改名 `RenderPipeline`，旧 `EffectComposer`/`GTAOPass`/`SMAAPass`/`OutputPass` 引用需改 import；(b) TSL 默认化不影响自写 `MeshPhysicalMaterial`（用的是标准材质），但若未来自写 shader 走 WebGPU 需 TSL 重写；(c) **最易忽略的坑**：`postprocessing@6.39.4`（pmndrs）与 three 内置 composer **混用**——pmndrs 是独立库、依赖 three 内部，大版本跳跃极易断裂，需锁定兼容版本或统一到一侧
- **是否上 WebGPU：计划上，WebGL2 兜底。** 收益：r185 的 WebGPU skinning + instancing 可实例化蒙皮、Nanite 式 compute 光栅化兜底峰值。风险：KTX2 在 WebGPU 下 transcode 协商——**必须在 `renderer.init()` 之后调 `detectSupport`**，否则纹理变黑（`:842 buildEnvironment` 的 PMREM 也要在 init 后）
- **升级能否缓解 draw call？不能（否）。** r160 起 `InstancedMesh` 自动合批、r185 有 compute 光栅化，但**这些替代不了正确的资产预算与静态合并**——580 → 120 靠的是 `batchStaticAsset()`，与引擎版本无关。升级是"兜底峰值"，不是"解本"

## 9. Tripo 决策矩阵

| 资产类 | 用 Tripo？ | 理由 |
|---|---|---|
| 集装箱 20/40GP/HQ | **否，参数化** | 国际标准尺寸（内长 5.898 / 12.032 m）须与求解器几何严格一致；差 2 cm 即破坏装填校验（`:17 calibrateContainerAsset` 按内廓缩放） |
| 纸箱/托盘货/木箱 | **否，参数化 + 实例化** | 要实例化几十上百次，尺寸来自算法装填结果 |
| 叉车/工人 | **保留 Blender（关节）或 Tripo + 手动重建枢轴** | **致命点**：Tripo P2.0 输出是**单块合并网格 + 自动命名，不保留 `forklift_carriage` / `fork_l` / `worker_*_pivot` 层级枢轴**；而 `articulatedActors.js` / `bindWorkerRig` 全靠按名找节点驱动。若用 Tripo，必须回 Blender **手动重建枢轴层级并重绑**（人工成本高、易错） |
| IBC 桶/油桶/设备箱 | **可 Tripo** | 曲面件程序化性价比低；设面数上限导出，回 Blender 修破面 |
| 地坪/龙门吊/堆场 | **可 Tripo 或 HDRI + 程序化** | 一次性 hero |

**面数控制**：Tripo 设 ≤50k tri 导出（P2.0 上限 25k quad = 50k tri），否则默认输出又是 10 万面。
**后处理**：AI 出初稿 → Blender 修非流形/破面 → 必要时 Retopology → UV 展开 → `gltfpack -kn -km -tc -cc`。

## 10. 三阶段改造路线图

**P0（1–2 天，改代码为主，零资产改动，ROI 最高）**
- 目标：主孪生 draw call 580 → **≤150**；帧时间降 30%+
- 改动：① 集装箱 `:475` onReady 后加 `batchStaticAsset(scene,'container-static',[doors.leftPivot, doors.rightPivot])`；工人 `:533` 后加（保留 `rig` 枢轴）；地牛 `:467` 后加；② 阴影改"仅运动帧 `needsUpdate=true`"；③ high 档 GTAO `resolutionScale` 0.5、pixelRatio 封顶 1.5
- 收益：集装箱 210→17、工人 168→14、地牛 100→10（共降 ~478 call，↓82%）
- 风险/回滚：批处理可能丢多材质网格（`:644` 跳过数组材质）——回滚即删该行；用 `mount.dataset.containerHeroMeshCount` 对比前后 mesh 数验证

**P1（3–7 天，改资产 + 加闸门）**
- 目标：传输体积 ↓65–72%；建立 CI 预算门；运行时三角面降 50%
- 改动：① 跑第 5 节 gltfpack 命令产出 `.opt.glb` 替换；② 写 `asset-budget.json` + `glb-inspect` CI 闸门；③ 三档 LOD；④ 集装箱 `-si` 简化到 5k
- 收益：container 8.0 → 2.4 MB、forklift 6.7 → 1.9 MB、cargo 2.0 → 0.7 MB；运行时 278k → ~140k 面
- 风险/回滚：`-si` 过度简化丢波纹细节 → 用 `-si 0.5` 而非 0.7；保留未压缩 GLB 副本回滚

**P2（1–2 周，引擎与 Tripo）**
- 目标：three 0.179 → r185、WebGPU 试点；Tripo 接入 hero 件 20%
- 改动：① 独立分支升级，统一后处理到一侧（弃 pmndrs 或弃内置，二选一）；② `WebGPURenderer` + WebGL2 兜底，KTX2 在 `init()` 后 `detectSupport`；③ Tripo 生成桶/环境件 → Blender 精修 → 接入 `assetManifest.js`
- 风险/回滚：WebGPU 纹理变黑 → 回退 `WebGLRenderer`；升级破坏 composer → 回退 r179 分支

---

## 追问链速答

1. **只改一行收益最大** → 集装箱加 `batchStaticAsset(scene,'container-static',[])`，单物体 210 → 17 call
2. **怎么证明瓶颈在 CPU** → 用第 2 节采样：若 `drawCalls` 高（≈580）而 `triangles` 相对低、帧时间随 call 数线性涨，即 CPU 提交瓶颈
3. **gltfpack 会合并节点名怎么办** → 用 `-kn` 保留命名节点，否则货叉不动
4. **压缩后文件小 90% 还是卡** → `-cc` / `-tc` 只降传输体积，**不降解码三角面 / draw call**，运行时成本靠批处理 / LOD / `-si`
5. **升 r185 + WebGPU 是否可不管预算** → 否，自动合批 / Nanite 是兜底，不替代预算
6. **Tripo 叉车怎么升货叉** → 它**不保留枢轴**，需回 Blender 手动建 `forklift_carriage` / `fork_l` 并绑骨骼
7. **集装箱 Tripo 差 2 cm** → `calibrateContainerAsset` 按内廓缩放会放大误差，破坏装填几何一致性与 SOLAS/VGM 校验，故必须参数化
