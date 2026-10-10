# PORTCUBE 数字孪生四代理会审手册

> ⛔ **重要（2026-09-18 更新）**
>
> 本目录的 `09` / `10` 号文件包含**两处已作废的错误结论**，请先读 **`11-更正与核实-对批评的逐条回应.md`**：
> 1. **`10` 号的「20/60/20 重量分段规则」原文不存在**，是我从二手来源渲染出来的错误规则（CTU Code Annex 7 §3.1.4 原文为 "as a rule of thumb ... can be taken as"，是 ±5% 的经验换算，不是硬要求）。
> 2. **`09` 号的基线测量用错了工作目录** —— 权威副本是 `D:\cixing\3chuang_RECOVERED_20260911-003253`（Sep 11-12），我全程在 `D:\cixing\3chuang`（Sep 10）上测；且"原型击败正式算法"因约束不同条件而不成立。
>
> **阅读顺序：先 `11`（更正），再 `08`（算法诊断），再 `00`（总诊断），最后其余。**

本目录包含 **1 份全局诊断 + 4 套代理提示词**，用于从四个不同专业视角同时剖析本项目（智港立方 / PORTCUBE）的 3D 数字孪生效果问题。

## 文件清单

| 文件 | 内容 | 回答什么问题 |
|---|---|---|
| `00-全局诊断与结论.md` | 基于实测证据的总体诊断与决策表 | 瓶颈在哪？要不要换技术/换建模？Tripo 该不该用？ |
| `05-实测验证与总导演结论.md` | **真实启动项目 + Playwright 探针实测**，对四份报告逐条判定，并给出最终修改方案 | 四份报告到底对不对？接下来改什么？ |
| `evidence/` | 8 张运行时实测截图 + `measurements.json` | 一手证据，可自行比对 |
| `agent-01-CMIT竞赛评委.md` | 竞赛评委视角 | 这套东西能拿几分？会被问什么？ |
| `agent-02-视觉特效总监.md` | 实时渲染 / VFX 视角 | 画面为什么假？不换资产怎么救？ |
| `agent-03-货代物流总设计师.md` | 业务甲方视角 | 现场能用吗？哪里自相矛盾？ |
| `agent-04-图形算法工程师.md` | 图形管线 / 算法视角 | 预算怎么定？管线怎么改？要不要升级？ |

> ⚠️ **阅读顺序建议**：先读 `05`（一手实测与最终决策），再回头看 `00` 与四份报告。因为 `00` 与四份报告的若干数字已被实测修正。

## 已经跑过一遍的评审结果（2026-09-18）

四套提示词已实际以子代理方式各执行一轮，报告存档：

| 文件 | 总分 / 结论 | 最重要的一条 |
|---|---|---|
| `review-01-CMIT评委.md` | **68/100**，二等奖稳妥；修 3D 后约 73 可冲一等奖 | 3D 呈现直接损失约 5 分；给了 10 个答辩杀手问题 |
| `review-02-视觉特效总监.md` | 画面"假"是**光照问题**，非预算问题 | 改 5 个数字即可救回：`HemisphereLight 0.32→1.15`、`environmentIntensity 0.48→1.0`、`exposure 1.04→0.96`、`Fog(18,48)→(34,90)`、近壁 `opacity 0.27→1.0` |
| `review-03-货代总设计师.md` | 今天不敢上生产，改完原则性错误可给试用期 | `cargo.js:97` 的 `heavy = weight >= 20` 是**规则定义错误**（21kg 不该叫重货）；叉车 ↔ 叉孔缺一致性校验 |
| `review-04-图形算法工程师.md` | **纠正了主诊断的 draw call 估算** | `batchStaticAsset()` 写好了却只用在叉车上；补调集装箱/工人/地牛 → 478 draw call 白送 |

### ⚠️ 主诊断的一处已修正错误

`00-全局诊断与结论.md` 初版按"42 件 × 107 网格 = 4,494"推算，得出 **≈5,300 draw call**。经逐行核对源码，这个数字**是错的**：

- `TwinScene.jsx:434 → :1591 → :1308`：放置货物走 `InstancedMesh` + 程序化几何（`createTypedCargoGeometry`）
- `:553-570`：GLB kit 加载后 `applyCargoKitGeometries` 取几何，随即 `disposeObject(scene)` —— **GLB 只是几何来源，不逐件渲染**
- 真正逐件加载 107 网格纸箱的是 `TaskOverviewScene.jsx:66` 与 `PackagingModelViewer.jsx:53`

**修正后：单帧约 580 draw call**，其中 **478 个（集装箱 210 + 工人 84×2 + 地牛 50×2）纯属漏调 `batchStaticAsset()`**。文档已就地更正。

## 四代理分工（为什么不重叠）

```
                    ┌──────────────────────────────┐
                    │   01 CMIT 评委（全局）        │
                    │   这项目值不值得给奖？         │
                    │   输出：评分 + 杀手问题        │
                    └──────────────┬───────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
┌───────▼────────┐        ┌────────▼────────┐        ┌────────▼────────┐
│ 02 视觉特效总监 │        │ 03 货代总设计师  │        │ 04 图形算法工程师│
│ 画面可信度      │        │ 业务真实性       │        │ 工程可实现性     │
│ 输出：光照/材质/│        │ 输出：矛盾表/    │        │ 输出：预算合同/  │
│ 构图/档位方案   │        │ 责任字段/ROI清单 │        │ 管线/路线图      │
└────────────────┘        └─────────────────┘        └─────────────────┘
```

- **01 回答"值多少分"** —— 拉高视角，管方向
- **02 回答"好不好看"** —— 管感知质量
- **03 回答"对不对"** —— 管业务正确性
- **04 回答"能不能做"** —— 管工程可行性

02 和 04 是**同一个问题的两面**：02 说"要好看需要什么"，04 说"实时能负担多少"，两者的差集就是你需要做的技术取舍。

## 推荐执行顺序

### 第一轮：单点突袭（各跑一次）

1. 先跑 **04 图形算法工程师** —— 拿到预算合同和瓶颈定位，这是所有讨论的基准线
2. 再跑 **02 视觉特效总监** —— 拿到"不换资产"的画面抢救清单
3. 再跑 **03 货代总设计师** —— 拿到业务矛盾表
4. 最后跑 **01 CMIT 评委** —— 拿到评分和杀手问题

> 顺序很重要：先有技术事实（04），再谈画面（02）和业务（03），最后让评委打分，这样评委的评分才有依据。

### 第二轮：交叉质证

把 02 和 04 的输出**互相投喂**：
- 把 02 的"光照方案"给 04，问："这些改动在 5,300 draw call 下还有意义吗？还是应该先修资产？"
- 把 04 的"预算合同"给 02，问："按这个预算重做资产，画面会损失多少？有没有更省的替代方案？"

把 03 的"业务矛盾表"给 01，问："这些矛盾会让我损失多少分？"

### 第三轮：收敛

用 01 的"保守版 / 激进版路径"作为最终决策依据，与 `00-全局诊断与结论.md` 的 P0/P1/P2 路线合并，输出一份**唯一的执行清单**。

## 投喂材料清单（建议直接复制）

### 投喂给所有代理

```
docs/digital-twin-verdict/00-全局诊断与结论.md
docs/product-realism/BLACKBOX_2026-09-10.md
```

### 投喂给 01（评委）

```
output/playwright/commercial-05-after-standard.png     ← 最佳画面（9/8）
docs/design_reviews/round2-stage-4-twin-3d.png         ← 最差画面（6/29，用于制造对比）
output/playwright/commercial-18-space-1366.png
output/playwright/commercial-22-hero-1366.png
```

### 投喂给 02（视觉）

```
web-dashboard/src/three/TwinScene.jsx                  ← 主战场
web-dashboard/src/three/scene/                         ← sharedResources / createIndustrialContainer / createWorksite / visualAssets
web-dashboard/src/three/cargo/CargoVisualFactory.js
web-dashboard/src/three/PlanPreviewScene.jsx
web-dashboard/src/three/LandingExperience.jsx
输出截图（同上）
```

### 投喂给 03（货代）

```
docs/product-realism/BLACKBOX_2026-09-10.md            ← 里面已列出多个业务矛盾
web-dashboard/src/domain/cargo/                        ← 货物域模型与模板
web-dashboard/src/domain/container/catalog.js
web-dashboard/src/domain/compliance/                   ← 合规判定逻辑
output/playwright/commercial-14-ai-regulation-1366.png
```

### 投喂给 04（算法）

```
web-dashboard/src/three/                               ← 全目录
web-dashboard/package.json
assets-src/blender/rebuild_v3/build_assets.py
assets-src/blender/rebuild_v3/asset-contract.json
web-dashboard/src/three/assets/assetManifest.js
docs/digital-twin-verdict/00-全局诊断与结论.md          ← 内含 GLB 实测数据表
```

## 关键实测数据（所有代理共享的事实基础）

以下数据通过 **GLB 二进制解析**取得，非估算，可作为四份分析的共同基准：

| 资产 | 字节 | 网格数 | 顶点 | 三角面 | 内嵌贴图 | 动画 | 蒙皮 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `rebuild-v3/cargo_carton.glb` | 2,076,144 | **107** | 37,956 | 20,508 | 2 (739 KB) | 0 | 0 |
| `rebuild-v3/container_40hq.glb` | 8,201,788 | **210** | 186,956 | 147,018 | 6 (1.4 MB) | 0 | 0 |
| `rebuild-v3/container_20gp.glb` | 6,517,876 | 209 | 139,969 | 107,500 | 6 (1.4 MB) | 0 | 0 |
| `rebuild-v3/forklift_articulated.glb` | 6,880,652 | **453** | 193,772 | 113,996 | 1 (264 KB) | **0** | **0** |
| `rebuild-v3/worker_articulated.glb` | 1,622,432 | 84 | 17,875 | 17,432 | 3 (899 KB) | **0** | **0** |
| `astra/portcube_cargo_carton_a.glb`（旧） | 32,344 | 1 | 786 | 388 | 0 | 0 | 0 |
| `astra/portcube_equipment_forklift_compact_a.glb`（旧） | 630,036 | 1 | 17,793 | 9,228 | 0 | 0 | 0 |

**两个反直觉的发现，务必让每个代理都知道：**

1. **旧资产（`astra`，9/6）在功能等价的前提下，体积是新资产（`rebuild-v3`，9/10）的 1/65，三角面是 1/53，网格数是 1/107。** `rebuild-v3` 是一次"细节最大化"改造，方向与实时 Web 相反。
2. **`forklift_articulated` 和 `worker_articulated` 名字叫 "articulated"，但 `animations = 0`、`skins = 0`** —— 没有烘焙动画、没有蒙皮。关节完全靠 three.js 侧按节点名驱动（`scene/articulatedActors.js`）。这直接影响 04 号代理的管线设计（`gltfpack` 必须加 `-kn` 保留命名节点）和 Tripo 评估结论（AI 生成资产若丢失命名枢轴，关节就废了）。

## 复现实测数据的方法

仓库内已放置解析脚本：

```bash
# 用 managed Node 运行
"C:/Users/Lenovo/.workbuddy/binaries/node/versions/22.22.2-3/node.exe" \
  .workbuddy/tmp/glb-inspect.js \
  web-dashboard/public/assets/3d/rebuild-v3/cargo_carton.glb \
  web-dashboard/public/assets/3d/rebuild-v3/container_40hq.glb \
  web-dashboard/public/assets/3d/rebuild-v3/forklift_articulated.glb
```

输出列：`file / sizeKB / mesh / prim / verts / tris / mat / texRefs / tex / anim / skin / binMB / imageData`

## 外部事实基准（2026-09-18 核验）

供四个代理引用，避免它们给出过时建议：

| 事实 | 内容 |
|---|---|
| three.js 最新版 | **r185**（2026-07-01）；r184 修 WebGPU render bundle 与压缩纹理释放 |
| WebGPU 覆盖 | Safari 26 已支持（2025-09），约 **95%** 浏览器覆盖；r171 起生产可用 |
| 后处理改名 | r183 起 `PostProcessing` → **`RenderPipeline`**，旧的 `EffectComposer` 式写法会静默失效 |
| 着色器 | **TSL 已成默认**，一次编写编译到 WGSL（WebGPU）与 GLSL（WebGL2） |
| r185 新能力 | **Nanite 式 compute 光栅化**、WebGPU skinning + instancing |
| r160 已有 | `InstancedMesh` 自动合批（draw call 降约 60%）、Draco v3（加载时间降约 40%） |
| 资产工具 | `gltfpack`（meshopt，`-cc -tc -kn -km -si`）优于纯 Draco；`gltf-transform` 分步更可控 |
| 压缩常识 | Draco/meshopt **只降传输体积，不降解码后三角面**；顶点工作量只能靠 LOD 解决 |
| KTX2 坑 | WebGPU 下必须在 `renderer.init()` 之后调用 `KTX2Loader.detectSupport()`，否则纹理变黑 |
| Blender MCP 边界 | 几何只有 `add_primitive`（7 种图元）；**导出会超时须走 CLI**；**程序化贴图不导出 glTF**（须烘焙）；导出会改写节点名 |
| Tripo P2.0 | 2026-09-01 发布，**原生四边面端到端生成**，最高 25,000 quad / 50,000 tri，**面数可控**，语义分件，人形自动绑骨，有 Blender/Unity/Unreal/Godot 插件 |
| AI 3D 现状 | 所有工具都做不到"生成即用"，仍需人工修破面/非流形边；**面数可控是 2026 新增能力，务必设上限导出** |
