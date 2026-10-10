# INJECTION_REPORT.md — 资产考古与真实货代数据注入报告

## 1. 供体目录资产比对（全部 STRICTLY READ-ONLY，仅挖掘未修改）

| 供体目录 | 资产概况 | 真实货代价值 |
|---|---|---|
| `3chuang/`（当前项目） | 前序自迭代的宿主；`optimizer_sandbox/` 含上一轮最终方案 best_v7 / FINAL_OPTIMIZED_SOLUTION | **唯一代码基座来源** |
| `3chuang_PRESERVED_20260911-003253/` | `database/current-project-database.sql`（402MB 全库转储：cargo 0 行、**load_task 6 行、load_task_version 5 行、packing_case 5 行、packing_plan 262 行、container_type 3 行**）+ `browser/project-storage.json` + 完整项目快照 | ★★★ **真实货代数据主源**：用户经 UI 实际录入的装载任务（含 10 次修订的真实使用轨迹）与真实船公司参考柜型 |
| `3chuang_RECOVERED_20260911-003253/` | 完整项目副本 + **当前项目缺失的真实货代装箱子系统**：`services/CommercePackingService.js`、`packing/{OrientationConstraint, SourceBenchmarkSolver, SourceConstraintValidator, CommerceAudit, CommerceRepack, CargoSourceIdentity, PackingInputContract, CommerceColumnPacker, CommerceWallPacker, CommerceDoorReservePacker, ReplanService…}` + `shared/commerce{Business,Order,OrderV6,Packaging}.mjs`；其 `PackagingProfile.js` 比当前版本多 495 行差异（托盘/异形包装/朝向策略/搬运模式规范化） | ★★★ **真实货代录入预处理逻辑主源** |
| `3chuang_RECOVERY_RUN_20260911-003253/` | `historical-plan-REQ_*.json`（10 份 hybrid-v2.5 历史方案，212 件、纵向重心 9.999%、solveMs 22674）+ `historical-212-session-provenance.json` + 数据库溯源记录 | ★★ 历史方案参照（纵向重心 9.999% 基准线；经溯源确认其货物为 demo-dataset-a，非新增真实数据） |

## 2. 真实货代数据挖掘结果（数据来源与规模）

**主源**：`3chuang_PRESERVED_20260911-003253/database/current-project-database.sql` 的 `load_task` 表——用户通过产品 UI 真实录入的货代装载任务（含逐次修订版本），每个任务快照含 `rows`（录入行）与 `units`（单件展开，携带完整货代语义字段）：

| 任务 ID | 名称 | 修订 | 货物 | 业务特征 |
|---|---|---|---|---|
| `TASK_1c0adc0e…` | 新的装载任务 | rev1 | 14 件 PALLET-A 1200×1000×1300、260kg、不可堆叠、木托、叉车（TWO_WAY 孔） | 整托重货、单港 HAM、目的地服务窗口（HAM-CFS 拆箱点） |
| `TASK_e78dde2c…` | 多柜与追加客户 · 实测 | **rev10** | 14× PALLET-A（客户 F39）+ 2× PALLET-B 1000×900×1100、180kg（客户 44C） | **多客户追加装载**；真实历史方案为 2×20GP 分柜 9+7 |
| `TASK_77f97ed4…` | 平齐月台叉车 · 5件堆高验收 | rev3 | 5 件 1200×2000×500、禁旋转（rot=false）、maxStack=2 | 月台叉车验收、特殊朝向约束 |
| `TASK_b622c7f8…` | 原始212件 · 高密度约束案例 | rev1 | 212 件 10 SKU、三港卸货序（Hamburg/Rotterdam/Antwerp, seq1-3）、208kg 重货与 5kg 抛货混装 | 多港 LIFO 高密度基准（与 demo-dataset-a 同源，此处作为多港真实语义载体） |
| `TASK_e06b1e81…` | 单客户多柜示例 | rev1 | 14× PALLET-A | 单客户多柜 |
| `TASK_2545e564…` | 版本并发回归 · 测试资料 | rev3 | 2 件 TEST-CARTON | 回归测试（未纳入基准） |

**真实柜型规格**（任务内 `plan.containerInfo`，`mode: REFERENCE_PROFILE`，`classification: CARRIER_REFERENCE`，来源为 Maersk 官方设备手册 PDF）：
- 20GP dry container（ISO 22G1）：5898×2352×2393mm，payload 28300kg，门宽 2340/门高 2280，容量 33.2m³
- 40HQ：12032×2352×2698mm，maxWeight 28690kg

**排除项说明**：`historical-plan-REQ_*.json` 与 `packing_case` 中 NB2026-0713-001/NB2026-0824-001 等经溯源（`historical-212-session-provenance.json`：`source: demo-dataset-a`）确认为演示数据的求解结果而非新增真实货单；`甬柜易算演示数据-NB2026-0418.json`（orderNo NB2026-DEMO-01）同为演示级。真正的「真实货代」资产是 **load_task 用户录入任务**（含 10 次修订的真实使用轨迹）。

## 3. 注入的货物录入预处理规则（逻辑融合）

从 RECOVERED 供体移植并融合进底座：

1. **`PackagingProfile.realcargo.js`**（供体 `PackagingProfile.js`，RECOVERED 增强版，+495 行差异）：
   - `normalizeCargoList()/normalizeCargoPhysicalProfile()`：规范化 `packagingType`（PALLETIZED_CARTONS 等货代包装类型目录）、`cargoPhysicalProfile`（物理画像：材质/运输单元/木托类别）、`palletJackCompatible`、`orientationPolicy`、`handlingMode`（按重量与包装类型推导叉车/人工）；
   - `orientationsForPolicy(dimensions, policy)`：按朝向策略枚举可用姿态。
2. **`OrientationConstraint.js`**（供体独有，231 行，自包含）：`resolveOrientationRules/resolveAllowedOrientations`——把真实 unit 的 `orientationPolicy`（如 HORIZONTAL_ROTATION_ONLY）与 `forkEntry` 轴约束解析为可用朝向集合。
3. **新增 `backend/services/realcargo/IngestRealCargo.js`**（本次自研适配器，融合上述供体逻辑）：
   - `normalizeRealUnit()`：真实 unit → 引擎 cargo 行契约；朝向策略 → `canRotate/canLayFlat` 布尔映射（供体姿态枚举推导）；`stackable/maxStackLayers` 从 unit→packagingProfile→cargoPhysicalProfile 三级回退解析；`fragile/wooden/dangerous` 按 unit+画像+木托类别合成；`customerId/customerName/orderId/lotId/unloadSequence/forkEntry/transportUnit` 业务语义透传；
   - `containerOf()`：优先采用任务内真实船公司 REFERENCE_PROFILE 柜型（含门尺寸/ISO 代码/payload），否则回退标准柜；
   - `buildRealBenchmarkCases()`：构建 4 个真实基准 case（PALLET-14-HAM→40HQ / MULTICUST-16→40HQ / DOCK-5→20GP 参考柜 / MULTIPORT-212→40HQ）。
4. **数据落盘**：`data/real_forwarder_dataset/`——6 个清洗后的任务快照 JSON + 4 张表的原始行 JSONL（load_task/packing_case/load_task_version/container_type）+ `container_type.rows.jsonl`（20GP/40GP/40HQ 官方规格）。

## 4. 底座保持声明

- 代码底座 = `optimizer_sandbox/checkpoints/FINAL_OPTIMIZED_SOLUTION/`（best_v7），已逐字节校验（md5 三核心文件与上轮沙盒 backend 完全一致）后镜像至 `sandbox_real_cargo_opt/backend/`。
- 注入仅**新增**预处理模块与适配器；底座引擎的装箱核心（列构建/槽位模板/平衡门禁/稳定性修复）原样继承，后续突变全部通过双验证器回归确认未退化（旧核心套件 20.371%/831/22.5ms 与上轮一致）。
