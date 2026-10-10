# PORTCUBE 外部数据字段匹配审计

审计基线：前端 `cargo.js`、会话 schema v7、后端 `Cargo`/`PackagingProfile`、`packing/generate` DTO、当前 solver 与 `PlanValidator`、外部 normalized schema。审计日期：2026-09-11。

## A. PORTCUBE 当前核心字段

- 标识：`cargoId`、`name`、`sku`、`source`、`dataClassification`
- 基础事实：`length/width/height`（mm）、`weight`（kg）、`quantity`
- 航程与批次：`destinationPort`、`eta`、`portSequence`、`batchId`、`batchLabel`
- 包装与作业：`packagingType`、`packagingMaterial`、`transportUnit`、`handlingMethod`、`forkEntry`、`palletJackCompatible`
- 求解约束：`stackable`、`maxStackLayers`、`maximumSupportedWeightKg`、`orientationPolicy`、`canRotate/canLayFlat/canInvert`、`fragile`、`dangerous`
- 分层模型：`packagingProfile`、`cargoPhysicalProfile`、`solverEnvelope`、`visualProfile`
- 无损外部承载：`externalMetadata`。后端求解 DTO 不读取该字段。

## B. 可直接映射字段

- Renault：产品编号→`sku`；mm 尺寸→`length/width/height`；kg 单重→`weight`；聚合件数→`quantity`。
- ORTEC：产品编号、mm 尺寸、kg 单重、需求数量可直接映射核心字段。
- THPACK/WTPACK：数量可直接映射；WTPACK kg 单重可直接映射。

## C. 需要转换映射字段

- Renault 包装材料映射为 PORTCUBE 包装枚举，同时保留原始材料值。空白朝向按官方格式映射为自由摆放。
- THPACK1-7、WTPACK 的 cm 尺寸乘 10 转为 mm；原值和原单位保留。
- ORTEC 与 OR-Library 的旋转/竖直面许可保留为完整 `orientationConstraints`；只有与现有四档策略完全等价时才生成求解投影。

## D. 建议未来扩展的核心字段

`alwaysOnTop`、`alwaysOnBottom`、`stackingGroup`、完整轴向旋转许可、容器轴向对齐、多柜定义、`geometryType/geometryAsset/boundingBox`。这些字段已记录和展示，但状态为 `CORE_EXTENSION_PENDING_SOLVER_SUPPORT`，不得宣称当前 solver 已使用。

## E. 只保留来源字段

ORTEC 的道路车辆轴距、双轴载荷、车辆结构、托盘/层研究结构，以及各数据集的 seed、问题编号、论文标识和原始记录编号，只进入 `sourceFields` 或 source context，不进入通用海运 Cargo 核心。

## F. 当前无法可靠解释或转换的字段

- WTPACK `kg/cm²` 为按朝向定义的承压能力，不能转换成总承重 kg，状态 `ADAPTER_REQUIRED`。
- THPACK8/9 未在 canonical 说明中给出可核实尺寸单位；THPACK9 另有三条七字段异常原始行。保留原值，状态 `ADAPTER_REQUIRED`。
- Renault `LENGTHWISE/WIDTHWISE` 相对容器轴向约束无法由现有 `orientationPolicy` 无损表达。

## G. 已记录但当前 solver 尚未使用的约束

ORTEC 堆叠兼容组、必须位于上/底层、完整 XYZ 旋转许可、交付日、层/托盘/道路车辆约束；Renault 多柜与轴向约束；WTPACK 面承压；ESICUP 精确 mesh 碰撞与原始坐标包围盒；THPACK 的完整竖直面许可及 THPACK9 多柜语义。

## 关键决定

1. ORTEC `delivery day` 保留为来源字段，不映射到 `destinationPort`、`portSequence` 或卸货顺序。
2. ORTEC layer 的“最大层数”属于层类型，不再伪装成单品 `maxStackLayers`；单品堆叠兼容性由 `stackingGroup` 原样保存。
3. 未提供的危险品、自带托盘、堆叠、搬运和港口状态保持 `null/UNKNOWN/NOT_PROVIDED`，不自动填 `false/0/PASS`。
4. 外部属性全部保留在 normalized `sourceFields`、source context 与任务副本 `externalMetadata` 中；没有删除字段。
5. 本批不修改 solver、validator、数据库或原 212 件输入。

机器可读逐字段矩阵见 `schema-mapping-audit.json`。
