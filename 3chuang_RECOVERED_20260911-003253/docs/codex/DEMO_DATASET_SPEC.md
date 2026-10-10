# 第三阶段默认演示数据集

权威实现：`web-dashboard/src/domain/cargo/demoDataset.js`  
权威证据：`output/playwright/stage3/dataset/demo-dataset.json`、`demo-dataset-summary.json`

## 订单与规模

- Dataset ID：`yonggui-stage3-demo-v1`
- 订单：`NB2026-DEMO-01`
- 柜型：40HQ
- SKU：10
- 件数：221
- 总重：8,812 kg
- 总体积：64,524,720,000 mm³
- 港序：Hamburg 1 → Rotterdam 2 → Antwerp 3
- 批次：7
- 数据指纹：`c8e50f1c`
- 请求 SHA-256：`8cd16c3d791d282af8afdaf3d3ccb2ce6b1ac25c2be5c6787865a24fccc3873f`

## SKU 清单

| SKU | 名称 | 尺寸 mm | 单重 kg | 数量 | 港口/港序 | 批次 | actor | 主要属性 |
|---|---|---:|---:|---:|---|---|---|---|
| SKU-ACC-01 | 精密配件箱 | 650×560×520 | 12 | 60 | Hamburg/1 | BATCH-HAM-A | manual | accessory、stackable |
| SKU-CTN-02 | 整托零售箱组 | 650×780×650 | 35 | 24 | Hamburg/1 | BATCH-HAM-A | forklift | carton、heavy、stackable |
| SKU-FRG-03 | 易碎展示面板 | 650×1100×180 | 8 | 2 | Hamburg/1 | BATCH-HAM-B | manual | panel、fragile、nonstackable |
| SKU-MAN-04 | 厨房小家电 | 650×700×520 | 12 | 30 | Rotterdam/2 | BATCH-RTM-A | manual | carton、stackable |
| SKU-FLK-05 | 商用空调机组 | 650×780×650 | 53 | 36 | Rotterdam/2 | BATCH-RTM-B | forklift | equipment、heavy、stackable |
| SKU-NST-06 | 不可堆叠控制柜 | 650×780×620 | 124 | 3 | Rotterdam/2 | BATCH-RTM-B | forklift | equipment、heavy、nonstackable |
| SKU-WOD-07 | IPPC 木包装机件 | 650×780×850 | 23 | 18 | Antwerp/3 | BATCH-ANR-A | forklift | wooden、heavy、stackable |
| SKU-HVY-08 | 加固工业模块 | 650×780×850 | 208 | 18 | Antwerp/3 | BATCH-ANR-B | forklift | reinforced、heavy、stackable |
| SKU-PLT-09 | 托盘化备件 | 650×780×850 | 21 | 18 | Antwerp/3 | BATCH-ANR-B | forklift | pallet、wooden、heavy |
| SKU-SVC-10 | 售后备件小箱 | 300×780×650 | 5 | 12 | Antwerp/3 | BATCH-ANR-C | manual | carton、stackable |

## 业务覆盖

- 9 类属性覆盖：carton、forklift-handling、fragile、heavy、manual-handling、nonstackable、pallet、stackable、wooden。
- 人工作业 SKU：ACC、FRG、MAN、SVC，共 4 个。
- 叉车作业 SKU：CTN、FLK、NST、WOD、HVY、PLT，共 6 个。
- 每个 SKU 固定 `handlingMethod` 与 `handlingPolicy: fixed`；刷新、筛选和重算不随机改变 actor。
- 各 SKU 包含 `batchId`、`batchLabel`、`destinationPort`、`portSequence`、`riskNotes`、包装与堆叠字段。

## 确定性与恢复规则

- 默认 session schema 为 2，存储键 `yonggui.web.session.v2`。
- “恢复演示模板”只恢复本文件对应的唯一官方数据，不保留第二套旧默认数据。
- 损坏或不兼容的 localStorage 会返回同一官方模板，并显示显式恢复提示。
- `codex_stage3_dataset_gate.mjs` 连续三次向真实后端提交同一请求；核心坐标、利用率、COG、LIFO、actor 字段和数量守恒全部相同。
