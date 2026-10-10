# PORTCUBE 演示与验收

验收日期：2026-09-26。工作区：`D:\cixing\3chuang_RECOVERED_20260911-003253`。真实浏览器闭环 **12/12 PASS**，前端 **267/267 PASS**。这证明本机设计演示输入的工作流，不等于数据库持久化、真实 AI、现场作业或出运批准。

## 启动与复现

在 PowerShell 执行：

也可直接在权威目录运行 `./Start-Master-Rebuild.ps1`；该入口检测占用端口，不结束已有进程。

```powershell
Set-Location 'D:\cixing\3chuang_RECOVERED_20260911-003253'
& 'C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools/master-start.mjs
```

访问 [专业工作台](http://127.0.0.1:14173/workspace)。启动器使用前端 14173、API 13000，数据库限定为 `portcube_master_rebuild_20260922`；已有服务占用端口时先核对进程，勿再次重复启动。支持 `backend` / `web` 参数单独启动。Node 18 不是本轮验收运行时。

全流程回归命令：

```powershell
& 'C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools/master-browser-qa.mjs
```

脚本打开全新 Chromium 浏览器上下文，用真实鼠标、页面按钮与本地 API 操作，不注入正式方案；旧用户浏览器数据不被清空。会话读数等待产品 120 ms 自动保存防抖完成。

## 约 5 分钟演示路径

1. 从首页进入专业工作台，解释 DEMO-WORKSITE-42 是 42 件设计演示输入。A/B/C 是同一目的地仓内出库组；海运线路为宁波至安特卫普，不表示中途反复开同一封箱。
2. 查看货物约束，进入孪生预览：此时为 PREVIEW，正式作业回放和时间轴禁用。
3. 进入规划，生成推荐方案。三种目标都得到 42/42；本例三个布局哈希相同，页面说明策略收敛，不伪造不同布局。
4. 进入孪生，切换风险及顶视，以鼠标点选真实三维纸箱，查看尺寸、重量、交付/出库组和放置依据。检查器可滚动。
5. 回货物页点击“演示变更：木箱宽度 +100 mm”。木箱 1000 → 1100 mm，旧方案立刻失效。出运准备页只显示需要重规划，不能继续使用旧检查结论。
6. 进入规划点击“保留可用货位，重新规划”。先原位校核，再局部修复，最后必要时全量求解。当前案例原位出现越界，两个局部候选只能保留装入 41 件，全量得到 42 件；最终 40 件保持原位，2 件移动。
7. 查看逐件版本差异，再在孪生打开“新旧位置对比”。旧位半透明、新位实色，变更列表提供原因。
8. 关闭对比，重置作业、选择 8× 并播放。主闭环验收等待首件完成；另有独立补验正常求解后连续完成 42/42，包括 6 个叉车与地牛交接周期。SIMULATED 与现场 UNKNOWN 同时保留。不要把拖动到末尾当逐件验证。
9. 查看出运准备的责任动作，再刷新页面。当前计划 ID、布局哈希、木箱新尺寸及两次不可变版本均恢复。

## 实际浏览器证据

主证据：`artifacts/master-rebuild-20260922/browser/browser-qa.json`，运行结束于 2026-09-26 12:39:36（Asia/Shanghai）。另保留 `sep26-first-pass.json`，不覆盖先前成功记录。

| 验收项 | 实测 |
|---|---|
| 浏览器 | Playwright headed Chromium 151.0.7922.34，真实 WebGL |
| 初始 / 正式 / 重规划 | 42 件预览 → 42/42 正式 → 修改宽度 → 42/42 新方案 |
| 当前比较方案 | `REQ_1790397494341_815620d9`，哈希 `007a3f3e91df7b21` |
| 重规划方案 | `REQ_1790397528841_bd6a01ae`，哈希 `ff9996a7f6e43690` |
| 原位 / 局部 / 全量 | OUT_OF_BOUNDS → 两候选各 41/42 → FULL_REPLAN 42/42 |
| 真实三维点选 | 维修工具箱 WS-2-CTN，600 / 500 / 550 mm，8 kg |
| 作业回放 | 主闭环完成首件；独立补验连续完成 42/42、6 个完整设备周期，现场仍 UNKNOWN |
| 刷新 | 同 planId、同 hash、同 2 个版本、木箱 1100 mm |
| 浏览器错误 | pageerror 0，console error/warning 0，HTTP ≥400 响应 0 |
| 网络中止 | 4 次 `ERR_ABORTED`，均为能力/AI 可用性探针在导航或重挂载时取消，原始记录完整保留 |
| 布局 | 1600×900、1920×1080；所捕获页面无水平溢出 |

已人工查看页面截图：规划比较、三维点选、版本对比、回放与出运准备。三维模型、选中边框、检查器、状态来源与责任项均可见。总览的场景为整体构图，细部检查需切顶视/门侧并点选；本轮未进行用户视觉签收。

截图目录：`output/playwright/master-rebuild-20260922/`。

| 截图 | 内容 |
|---|---|
| `final-planning-solved-1600.png` | 真实三目标收敛与装载指标 |
| `final-twin-preview-1600.png` | PREVIEW 与禁用的正式回放 |
| `final-twin-inspected-1600.png` | 真实鼠标点选、交付/出库组、货物检查器 |
| `final-cargo-stale-1600.png` / `final-readiness-stale-1600.png` | 输入变更与旧证据失效 |
| `final-plan-diff-1600.png` / `final-twin-ghost-1600.png` | 不可变版本对照与三维旧位叠加 |
| `final-twin-replay-1600.png` | 完成 1 件、SIMULATED 与 UNKNOWN 分离 |
| `operation-first-equipment-completed-1600.png` | 第 13 件设备货落位、地牛退向门外，叉车已退出交接位 |
| `operation-continuous-final-1600.png` | 连续 42/42 完成，未跳步、未拖时间轴 |
| `final-twin-wide-1920.png` | 1920×1080 孪生全景 |
| `final-readiness-1920.png` / `final-planning-restored-1920.png` | 责任动作及刷新后恢复 |

## 设备交接与全量连续作业补验

2026-09-26 12:46:11—12:49:00，独立新浏览器经正常 UI 生成计划 `REQ_1790397977141_b27b4096`（布局 `007a3f3e91df7b21`），随后只点击重置、8×、播放。**42/42 连续完成**，无 BLOCKED、无跳过、无拖时间轴、无注入完成状态；console error / pageerror 为 0。现场状态始终 UNKNOWN。

通过只读 DOM MutationObserver 记录实际场景每次阶段/货物/完成数变化，共 **579 条状态记录**，包含货物 ID、设备类型、设备与货物位置、叉高/伸长、载货状态。3 件 180 kg 木箱和 3 件 220 kg 托盘共 **6 个设备周期**，逐件按顺序检查：

`HANDOFF_LOWER → FORK_WITHDRAW → JACK_APPROACH → JACK_INSERT → JACK_LIFT → ENTER_CONTAINER → MOVE_INSIDE → ALIGN_WITH_TARGET → LOWER_CARGO → RELEASE_CARGO → REVERSE_OUT → RETURN_FOR_NEXT`

不是仅凭放货时完成数加 1 判定结束：每件都还要出现退出、返回，再推进下一货物，最后一件必须进入 COMPLETED。独立证明脚本同时核对叉车抽离期间货物坐标固定、叉车坐标改变。例如首件 `worksite-3-CASE_1`，交接货物固定在 `(7698,-220,100)` mm，叉车从约 `(9691.57,-220,600)` 退到 `(16298,-220,-1500)` mm，随后地牛输送；该件完整周期约 6.68 秒（8×）。负 Y 是演示场地地面相对箱底高度，不是箱内负坐标货位。

原始记录 `browser/operation-browser-qa.json`；逐件证明 `browser/operation-cycle-proof.json`；运行输出 `browser/operation-run.log` / `operation-proof.log`，均位于 `artifacts/master-rebuild-20260922/`。完整补验与主闭环分开保存，未覆盖原有成功证据。复现：

```powershell
& 'C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools/master-operation-browser-qa.mjs
& 'C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools/master-operation-proof.mjs
```

## 实测性能与边界

CDP 报告实际渲染器 `ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11-32.0.21045.5002)`，WebGL/GPU compositing enabled，不是 SwiftShader 软件渲染。标准质量、42 件、normal 模式；场景加载后等待 2 秒，再采样 10 秒，每个视口得到 20 条应用内帧率样本。

| 视口 | 样本中位 FPS | 最低样本 FPS | Draw calls | 三角形 | GPU 内存估计 |
|---|---:|---:|---:|---:|---:|
| 1600×900 | 60.99 | 35.71 | 959 | 1,130,802 | 165.62 MB |
| 1920×1080 | 58.54 | 46.77 | 971 | 1,132,602 | 179.71 MB |

同机存在求解器基准测试并发负载；这不是独占机器、长期稳态或低配设备性能承诺。两个样本分别为初始计划和变更后计划，不能直接用其差值声称分辨率性能变化。内存数值来自纹理/几何估计，不能当作驱动实测显存。加载和场景切换的低帧样本也保存在 `perfBefore` / `perfAfter`，没有混进上述固定场景采样或从证据中删除。容器 268→68 mesh 合批另有资产证据，不能由此推算 FPS 增幅。

## 检查与明确未验证项

前端全量测试 267/267：`browser/frontend-final-tests.json`；全 `src` ESLint 0 错误、0 警告：`browser/frontend-final-eslint.json`；Vite production build 成功：`browser/frontend-final-build.log`。上述路径均位于 `artifacts/master-rebuild-20260922/` 下。全量 lint 发现三个既存未使用绑定，已只移除绑定/导入，保留容器屋顶创建调用。最后补齐两处三维作业标牌“卸出顺序”文案，不改布局、方向、碰撞或事实。

- 数据库返回访问拒绝，正式保存显示 FAILED；本轮刷新恢复证明本机浏览器存储，不证明 MySQL 重启后恢复、跨设备共享或数据库提交成功。
- AI 未配置；未宣称真实提供商调用成功。规则证据可以独立查看。
- 实際箱体牌照、VGM、运输系固、木质包装处理、承运人/码头受理共 5 项待处理，页面保留 DATA_REQUIRED / EXTERNAL_CONFIRMATION；没有填写虚假现场证据。
- 装载补验已连续完成 42 件及 6 个叉车/地牛周期；未进行 42 件全量卸货回放或现场叉车试验。连续包围盒扫描不是精确叉孔、坡道、车辆动力学或转向半径认证；作业空间为演示场地，叉车门外交接后由地牛进箱，不能解读为叉车直接进入箱内完成全部操作。
- Windows 原生 Computer Use 曾因无法可靠确定浏览器 URL 被阻断；已停止该渠道。这里的实测是独立、已知 localhost 的 Playwright Chromium，不冒称原生 GUI 验证。
- 完整后端历史测试仍有缺失旧模块与数据库权限等失败，详见主报告及算法报告；不能把本页浏览器通过扩展为全仓库通过。

本轮演示可以展示可追溯的输入变更、重规划与操作边界。正式比赛冻结前，应在演示机保留同一运行时与资源目录，并复跑本脚本；对数据库及真实 AI 的验收需在真实配置具备后另行完成。
