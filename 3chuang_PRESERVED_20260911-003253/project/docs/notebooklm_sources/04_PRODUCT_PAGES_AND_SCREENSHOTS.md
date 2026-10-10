# 04_PRODUCT_PAGES_AND_SCREENSHOTS

本文用途：建立产品截图索引，帮助 NotebookLM 在生成 PPT 时知道哪些图片用于哪一页、应如何标注、是否需要局部放大。

## 使用原则

产品截图应作为“真实系统证据”，不要直接拉伸变形，也不要把整页做成模糊截图背景。适合 PPT 的做法是：大截图展示整体，局部放大镜展示关键区域，旁边用 PPT 原生文本做标注。

## 关键截图索引

| 文件名 | 页面来源 | 展示内容 | 可用于 PPT 页 | 推荐标注点 | 是否需要局部放大 | 是否适合直接放进 PPT |
|---|---|---|---|---|---|---|
| `docs/final_product_integration/screenshots/final-dashboard.png` | 工作台首页 | 订单概览、核心指标、模块入口、报告入口 | 第 5 页工作台 | 当前订单、关键指标、下一步动作、报告入口 | 需要 | 适合，但建议占 60%-70% 并做放大镜 |
| `final-dashboard-after-sku-return.png` | 工作台返回态 | 从 SKU 维护返回后的工作台 | 第 5 页备用 | 流程回到工作台 | 可选 | 适合作为补充证据 |
| `final-dashboard-after-twin-return.png` | 工作台返回态 | 从 3D 页面返回后的工作台 | 第 11 页链路时间线 | 3D 后回到主流程 | 可选 | 适合小窗 |
| `final-dashboard-after-compliance-return.png` | 工作台返回态 | 从合规页面返回后的工作台 | 第 11 页 | 合规后回到工作台 | 可选 | 适合小窗 |
| `docs/final_product_integration/screenshots/final-cargo-input.png` | 货物录入页 | SKU、尺寸重量、包装属性、VLM 入口 | 第 6 页货物录入与 VLM | VLM 上传、待确认字段、人工录入 | 需要 | 适合，右侧截图应放大关键区域 |
| `docs/final_product_integration/screenshots/final-container-recommendation.png` | 柜型推荐页 | 柜型候选、推荐解释 | 第 7 页柜型推荐 | 推荐 40HQ、推荐理由 | 可选 | 适合小窗 |
| `docs/final_product_integration/screenshots/final-container-after-generate.png` | 装箱生成后 | 推荐后生成装箱结果 | 第 7 页、第 11 页 | 已生成方案、进入 3D | 需要 | 适合小窗或局部裁切 |
| `docs/final_product_integration/screenshots/final-twin-3d.png` | 3D 作业孪生 | Three.js 真实 3D、货物块、路径、操作区 | 第 8 页 3D 高潮 | 真实 3D 小窗、路径、目标位 | 需要 | 适合，但不要缩得过小 |
| `docs/final_product_integration/screenshots/final-twin-before-fullscreen.png` | 3D 全屏前 | 进入全屏/作业前状态 | 第 8 页备用 | 作业界面状态 | 可选 | 适合作为辅助小图 |
| `docs/final_product_integration/screenshots/final-compliance-review.png` | 合规预审页 | 合规体检、矩阵、证据、AI 审计 | 第 10 页合规 | 本地规则 WARNING / AI建议 PASS / 人工复核独立、检查项、复核入口 | 需要 | 适合，但不要整屏贴满 |
| `docs/final_product_integration/screenshots/final-compliance-regulation-detail.png` | 法规详情弹窗 | RAG 法规证据详情 | 第 10 页证据链 | 条款标题、来源、解释摘要 | 必须 | 适合做局部放大，不适合大面积文档截图 |
| `docs/final_product_integration/screenshots/final-report-export.png` | 报告导出页 | 导出入口、交付文件 | 第 11 页、第 12 页 | HTML/CSV/JSON、报告状态 | 需要 | 适合小窗 |
| `final-report-export-downloads.png` | 报告导出下载态 | 下载文件证据 | 第 11 页真实链路 | 已下载文件 | 可选 | 适合作证据小窗 |
| `final-report-preview-modal.png` | 报告预览弹窗 | HTML 报告预览 | 第 11 页、第 12 页 | 报告摘要、合规结论 | 需要 | 适合作为报告交付局部 |
| `docs/final_product_integration/screenshots/final-e2e-end-state.png` | E2E 终态 | 完整流程末端状态 | 第 11 页真实联调 | 链路已跑通、终态截图 | 需要 | 适合时间线终点 |

## 高级优化截图

| 文件名 | 展示内容 | 推荐用途 |
|---|---|---|
| `docs/advanced_open_design_web/screenshots/dashboard-after.png` | 优化后工作台 | 若 final 截图不够清晰，可作为第 5 页备用 |
| `docs/advanced_open_design_web/screenshots/cargo-after.png` | 优化后货物录入页 | 第 6 页备用 |
| `docs/advanced_open_design_web/screenshots/container-after.png` | 优化后柜型推荐页 | 第 7 页备用 |
| `docs/advanced_open_design_web/screenshots/twin-after.png` | 优化后 3D 页面 | 第 8 页备用 |
| `docs/advanced_open_design_web/screenshots/compliance-after.png` | 优化后合规页 | 第 10 页备用 |
| `docs/advanced_open_design_web/screenshots/report-after.png` | 优化后报告页 | 第 11 页备用 |
| `docs/advanced_open_design_web/screenshots/3d-forklift-path.png` | 叉车路径 | 第 8 页重点素材 |
| `docs/advanced_open_design_web/screenshots/3d-worker-path.png` | 人工路径 | 第 8 页重点素材 |
| `docs/advanced_open_design_web/screenshots/3d-target-highlight.png` | 目标位高亮 | 第 8 页重点素材 |
| `docs/advanced_open_design_web/screenshots/3d-algorithm-reason.png` | 算法依据弹窗 | 第 8 页或第 9 页辅助证据 |

## PPT 导演稿产物

| 文件名 | 用途 | 说明 |
|---|---|---|
| `outputs/ppt_director_master/pilot_5_pages/pilot_page_02.png` | 痛点试稿 | 可参考风险传导链方向，但最终 PPT 应使用可编辑文本 |
| `pilot_page_05.png` | 工作台试稿 | 说明大截图方向可行，但完整稿应增加局部放大镜 |
| `pilot_page_08.png` | 3D 高潮试稿 | 可作为第 8 页视觉风格参考 |
| `pilot_page_10.png` | 合规试稿 | 可参考“截图 + 法规局部放大” |
| `pilot_page_11.png` | 真实链路试稿 | 可参考证据组织，但最终建议做时间线 |
| `outputs/ppt_director_master/final_13_pages/slides_png/slide_*.png` | 13 页终稿预览 | 可帮助 NotebookLM 理解最终叙事方向，但不要把它当作唯一素材来源 |

## 不适合直接大图放入 PPT 的情况

- 截图中文字过小：需要裁切或放大关键区域。
- 法规详情长文档：只放局部条款和来源，不放满屏文档。
- 工作台整屏截图：可以做大图，但必须配局部放大镜。
- 旧 PPT 预览图：只能参考结构，不能替代真实系统截图。

## 建议的截图使用方式

- 第 5 页：`final-dashboard.png` 做 60%-70% 大截图，局部放大订单/指标/报告入口。
- 第 6 页：仓库拍照场景 + `final-cargo-input.png`，强调 VLM 后人工确认。
- 第 7 页：40HQ 剖面图为主，`final-container-recommendation.png` 作为系统证据。
- 第 8 页：现场作业主视觉为主，`final-twin-3d.png` 或 3D 路径截图作为真实小窗。
- 第 10 页：`final-compliance-review.png` 做审计台，`final-compliance-regulation-detail.png` 做局部证据链。
- 第 11 页：`final-e2e-end-state.png`、报告导出、下载截图组成真实链路时间线。
