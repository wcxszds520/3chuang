# PORTCUBE Master Rebuild

状态：**COMPLETE_WITH_EXTERNAL_BLOCKERS**。当前核心演示、算法对照与主链契约已完成；真实数据库、真实 AI 和现场设备/出运资料尚未验收。此状态不表示历史全仓库测试全部通过。

权威目录：`D:\cixing\3chuang_RECOVERED_20260911-003253`。本次实施开始于 2026-09-22，最终本机验收于 2026-09-26 完成。详细证据见本文和两份专项报告。

## 产品与架构

PORTCUBE 面向装箱计划员、仓内作业人员和出运复核人员：从货物事实形成可追溯装载方案，检查几何与作业边界，在输入变化后重规划，并显示尚需人工补充的证据。它不提供港口实时接入、工业认证或无人叉车控制。

数据链：货物定义与约束 → 规范化输入 → 来源能力匹配 → 候选求解 → 独立校核 → 业务排序 → 正式方案与不可变版本 → 三维检查、作业模拟与出运证据。

| 边界 | 当前实现 |
|---|---|
| Cargo / Preview / Placement | 定义尺寸与可用方向属于货物；预览读取实际预览方向；正式位置必须携带求解产生的方向元数据 |
| SOURCE / COMMERCE / 业务模拟 | 来源规则不支持组合时明确拒绝；COMMERCE 保留真实旋转、订单约束与固定货物；业务模拟走正式本地求解 |
| Session / Plan | 完整输入指纹、请求身份与过期状态；旧响应不能覆盖新输入，旧方案不能继续作为当前正式方案 |
| Revision / Diff | 保留方案快照与前序身份，按物理实例比较保留、移动、旋转、增减与原位尺寸变化 |
| Geometry / Asset | 求解运输包络决定尺寸，GLB 只负责表现；资产更换不能改变装载事实 |
| Plan / Simulation / Observation | 计划位置、动画状态、人工记录分离；观察记录绑定货物、方案、来源、记录人与时间 |

## 主要改造

1. 修复未求解 Twin 的方向边界；Preview 可查看但不能冒充正式作业方案。
2. 货物、柜体、方向和证据变化会使方案过期，清除当前正式视图；迟到响应受请求身份和指纹双重约束。
3. 新增 `/api/packing/replan`。优先原位复核，再做保留支撑闭合种子的局部修复，完整方案不能形成时回到正式求解；固定货物位置与插入路径必须保留合法性。
4. 局部重规划复用正式候选评价：几何、支撑、重心、作业通道、卸载回放和必要业务门禁均重新计算。旧风险与支撑证据不继承。
5. 修复原始缺失重量、分数件数、实箱铭牌载重与门洞的跨层传递。完整重规划先附版本链，再只插入一次数据库。
6. 旧同步合规接口按请求的 `planId` 保存报告，不能写入“最近一条方案”。数据库拒绝保存时保留可检查的计算结果，但明确 `FAILED`。
7. 旧 `/ai-packing/generate` 不再无条件返回预设“完美方案”，改用正式求解链；策略对照实际运行本地方案且明确 `aiUsed:false`。三个预设成功结果入口返回 `410 PRESET_RESULT_RETIRED`。
8. 出运准备缺失初始/卸后分析、空洞分析、堆码证据、搬运方式时为 `DATA_REQUIRED`；已知违规仍优先阻断。
9. AI 合规结论改由确定性证据引擎产生；模型只能补充说明。无配置/离线解释按当前事实生成，明确 `LOCAL_RULES / aiUsed:false`，缓存绑定位置、版本、箱体与验证结果。
10. Cargo、包装规范化、列构造保留显式 0 kg 顶载荷；构造与最终验证沿接触图检查整垛累计承重。修正实际货物边界上的空洞积分，并保持既有阈值。

算法研究、原始实验、生产选择与未支持约束见 [ALGORITHM_BENCHMARK.md](ALGORITHM_BENCHMARK.md)。实际演示路径、浏览器截图、状态恢复与性能见 [DEMO_AND_QA.md](DEMO_AND_QA.md)。

## 三维与作业

Twin 默认为检查视角；问题定位、选中检查、支撑区域、透明/切面/隔离、版本旧位置 ghost 与新位置实体共用正式位置数据。作业采用连续 AABB 扫掠，检查货物、设备包络、门洞、已装物体、人工通道与设备退出；支撑面积按接触矩形并集计算，避免重复累计。

这些检查是项目几何模型。它们不证明真实叉孔适配、坡道承载、摩擦、动态侧翻、驾驶轨迹、设备额定能力或现场安全已获得确认。动画仅为 `SIMULATED`；无现场记录时为 `UNKNOWN`。

实际审计 226 个 GLB（约 2.11 GB），按竞赛使用优先级分为 HERO 8、STANDARD 25、BACKGROUND 2、LEGACY 191。分级不是逐个模型获得视觉认证。本次没有为数量重做资产，也未调用 Blender 或 ImageGen。

集装箱静态几何按材质/可动部件合批：网格 268 → 68，三角形仍为 150,768；CPU 包络最大差约 `9.31e-10 m`，箱门转轴保留。该测量证明结构与包络保持，不能单独换算成 GPU FPS 提升。详见 `artifacts/master-rebuild-20260922/twin/container-batching.json`。

## 业务与界面

五页工作流保持“货物 → 规划 → Twin → 出运准备”，增加跨页过期提示、版本比较与问题定位。容量估算与后端正式方案在状态和操作上区分；页面显示数据库与 AI 的真实可用性。

演示货物为宁波出口至安特卫普的混合包装，A/B/C 表示目的地仓内出库组。航线停靠不解释为同一封箱在中间港逐件卸货。木箱宽度增加 100 mm 是明确的演示输入变更，不是声称已发生现场测量。

同一批货已经全部进入同一柜时，重新摆放不会改变其总体积利用率。方案比较说明重心、支撑、作业与重搬变化，不宣称虚假的利用率提升。

## 研究依据与取舍

已查阅 [EasyCargo 手动调整](https://www.easycargo3d.com/en/journal/manual-load-plan-adjustments/)、[装载优先组](https://help.easycargo3d.com/article/96/determining-the-loading-order-through-priority-groups)、[CargoWiz 用户指南](https://www.softtruck.com/CargoWizUsersGuide/CargoWizUsersGuide.pdf)。手动调整、优先顺序和分步装载是已有行业能力；本次重点是输入变化、版本差异与证据失效的闭环，不宣称行业首创。

状态建模参考 [Eclipse Ditto Thing](https://eclipse.dev/ditto/basic-thing.html)，渲染批次取舍参考 [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)。继续使用现有 Three.js，未做无证据收益的引擎迁移。

## 数据保护与证据

实施前保存 Git 状态、HEAD、2,148 个源码哈希和源码压缩快照；重要文件另有 `before/` 逐文件备份。权威目录原有大量修改与删除，未执行 reset、clean、stash、自动提交或推送。历史 212 件正式数据和原始资产保留。

测试使用隔离数据库名称，Jest 增加测试库名称守卫。MySQL 当前返回 `ER_ACCESS_DENIED_ERROR`，不能宣称数据库持久化通过；浏览器本地恢复与数据库恢复是两种不同证据。AI 无配置时不能宣称真实服务已调用。没有创建假凭据或替代真实 MySQL 的伪成功服务。

基线后端全量执行 83 suites、990 tests：49 suites / 846 tests 通过，34 suites / 144 tests 失败。失败包含既有删除模块、旧接口假设、数据库认证、当前求解器回归和旧算法问题，不能把它们全部归为环境问题。逐项分类在 `artifacts/master-rebuild-20260922/backend-failure-classification.json`，最终相关回归另列，不能用局部通过代称全部 990 项通过。

## 验收记录

| 验证 | 最终结果 | 证据 |
|---|---|---|
| 当前后端契约 | 17 suites，446/446；按测试文件去重，保留每个参数化用例 | `final-verification.json` |
| 求解器/模型/缓存 | 331/331 | `algorithm/active-verified-tests.json` |
| 路由与重规划 | 31/31 | `route-replan-tests.json` |
| AI 权限与确定性证据 | 84/84，包含最新 readiness 15 项 | `ai-boundary-tests.json` |
| 前端全量 | 267/267 | `browser/frontend-final-tests.json` |
| 前端生产构建与静态检查 | Vite build PASS；176 文件 ESLint 0 errors / 0 warnings | `browser/frontend-final-build.log`、`browser/frontend-final-eslint.json` |
| 算法对照 | 15 案例 × 5 算法 × 2 次 = 150 次，0 进程 ERROR | `algorithm/final-frozen-20260926/` |
| 真实浏览器业务闭环 | 12/12，console/pageerror/HTTP 错误 0；保留 4 次导航探针取消 | `browser/browser-qa.json` |
| 连续作业 | 正常 UI 求解后 8× 播放 42/42；579 次状态迁移、6 个设备件完整周期，无跳步或阻断 | `browser/operation-browser-qa.json`、`browser/operation-cycle-proof.json` |
| 实际 HTTP 拒绝边界 | 3/3：承重候选仍因作业通道拒绝、缺实箱尺寸拒绝、预设成功接口 410 | `api/http-contract-summary.json` |
| 最新代码 API 演示 | 初始/重规划/重复均 42/42；40 原位、2 移动、1 件尺寸变化 | `api/summary.json` |

前三组后端是同一 446 项的拆分，不能重复相加。Twin 专项 45/45 与另外 5 个契约测试属于前端覆盖证据，不重复计为额外全量测试。路由数据库 mock 只证明调用契约，不能证明 MySQL 已提交。根线程与算法 ESLint 均 0 errors；AI/准备模块另保留 5 个未使用变量 warnings，不影响本次行为断言。

所有表内相对路径均位于 `artifacts/master-rebuild-20260922/`。历史全量 990 项未在收尾再次运行；已修当前失败通过上述对应套件复验。缺失旧模块及保留旧接口/旧算法测试仍在原处，没有删除或隐藏。旧 Optimized/Layered 方案已退出当前 AI URL 的正式生成与对比路径，历史源码仍保留用于追溯。

## 算法结果与性能

最终选择 **KEEP_NATIVE**，保留 Native / COMMERCE / SOURCE 分域边界。外部 PackingSolver 已真实执行，但卸货组、已固定货物和整套作业门禁尚未全部适配，所以保留为研究对照。

150 次共同口径中：Native 28 VALID / 2 UNSUPPORTED，FastBlock 同；SOURCE 27 VALID / 1 INVALID / 2 UNSUPPORTED；PackingSolver 26 VALID / 4 UNSUPPORTED；COMMERCE 30 VALID。这些是共同几何/约束口径，不代表生产放行。Native 30 次中仅 10 次过其额外业务门禁，且 4 次为空方案；报告逐项列出重心、作业等拒绝理由，不能宣传为全场景通过。主演示 42 件、历史 212 件、混合 69 件另有完整业务复验。

212 件保持历史布局 hash `13bcef7385ac9712`，0 硬违规、0 作业阻挡；内部空洞质量指标 3.94953 m³。69 件通过明确标记的边界内平衡候选，纵向偏移 4.3205%。不同空洞指标的定义在算法报告中区分。

最新本机 API 样本：初次求解约 2.27 s，重规划 1.44 s，重复求解 1.52 s。并发负载、缓存与案例会影响时延，不将三次样本当通用性能保证。AMD Radeon / ANGLE D3D11 暖场 10 秒：1600×900 中位 60.99 FPS、最低样本 35.71；1920×1080 中位 58.54、最低 46.77。冷加载/切换低帧也保存在原始记录；未宣称稳定最低 60 FPS。首次内部合法解时间、外部进程峰值内存未测。

## 演示入口与冻结建议

入口：[PORTCUBE](http://127.0.0.1:14173/)。停止服务后可在权威目录执行 `./Start-Master-Rebuild.ps1`；它检测现有端口且不会结束未知进程。启动脚本与文档均使用隔离数据库。

**建议冻结当前核心演示功能，进入竞赛材料制作和演示机复排。** 材料只能引用本轮有证据的能力。不得把本机浏览器恢复写成数据库恢复、把模型作业写成现场作业、把规则说明写成真实 AI 或工业认证。

仍需真实外部条件：数据库凭据及持久化验收；如要展示在线 AI 则需真实提供商配置；实际箱体牌照、VGM、系固与木质包装资料、承运人/码头确认。未验证完整卸货动画、现场叉车动力学、双物理屏幕和其他型号 GPU；没有全局最优或最少多柜证明。主流程可演示，不能据此自动批准实际出运。
