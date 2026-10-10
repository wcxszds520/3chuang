# 截图与佐证材料规划

> 生成时间：2026-07-11
> 文件用途：按研究报告与 PPT 需要列出建议截图清单，覆盖 6 个页面 × 多状态的所有建议截图。
> 说明：所有截图建议基于仓库中已确认的页面与状态，目标态功能的截图需在功能实现后补拍。

---

## 一、截图总览

系统共 6 个核心页面：仪表盘（Dashboard）、货物录入（Cargo Input）、柜型推荐（Container Recommendation）、3D 装柜作业（Twin 3D）、合规预审（Compliance Review）、报告导出（Report Export）。每个页面建议覆盖多个状态截图。

---

## 二、截图清单表

| 编号 | 页面 | 状态/场景 | 分辨率建议 | 需突出位置 | 避免暴露信息 | 对应申报章节 | 文件命名 |
|------|------|-----------|------------|------------|--------------|--------------|----------|
| S01 | 仪表盘 | 空状态/初始 | 1920×1080 | 顶部导航、快捷入口 | 用户真实姓名 | 系统总览 | dashboard-init.png |
| S02 | 仪表盘 | 货物录入后返回 | 1920×1080 | SKU 数量、进度卡片 | — | 主链路演示 | dashboard-after-sku.png |
| S03 | 仪表盘 | 柜型选择后返回 | 1920×1080 | 推荐柜型卡片 | — | 智能决策 | dashboard-after-container.png |
| S04 | 仪表盘 | 3D 作业后返回 | 1920×1080 | 装柜进度、利用率 | — | 3D 可视化 | dashboard-after-twin.png |
| S05 | 仪表盘 | 合规后返回 | 1920×1080 | 合规结论 本地规则 WARNING / AI建议 PASS / 人工复核独立 | — | 合规预审 | dashboard-after-compliance.png |
| S06 | 仪表盘 | 报告后返回 | 1920×1080 | 报告状态、下载入口 | — | 报告导出 | dashboard-after-report.png |
| S07 | 仪表盘 | 风险后返回 | 1920×1080 | 风险提示 | — | 风险预警 | dashboard-after-risk.png |
| S08 | 货物录入 | 空表单 | 1920×1080 | 录入字段、批量导入按钮 | — | 货物管理 | cargo-empty.png |
| S09 | 货物录入 | 10 SKU 录入完成 | 1920×1080 | SKU 列表、件数 | — | 主链路演示 | cargo-10 SKU.png |
| S10 | 货物录入 | CSV 批量导入 | 1920×1080 | 导入按钮、导入结果 | — | 批量处理 | cargo-csv-import.png |
| S11 | 货物录入 | Qwen-VL 图像识别 | 1920×1080 | 上传图片、识别结果 | API Key | AI 能力 | cargo-vlm-recognize.png |
| S12 | 货物录入 | 校验错误提示 | 1920×1080 | 错误高亮字段 | — | 数据校验 | cargo-validation-error.png |
| S13 | 货物录入 | 目标态：8-12 SKU | 1920×1080 | SKU 列表扩充 | — | 目标态增强 | cargo-target-12sku.png |
| S14 | 柜型推荐 | 列表选择 | 1920×1080 | 20GP/40GP/40HQ 卡片 | — | 柜型决策 | container-list.png |
| S15 | 柜型推荐 | 推荐结果 40HQ | 1920×1080 | 推荐标签、利用率预估 | — | 智能推荐 | container-recommend-40hq.png |
| S16 | 柜型推荐 | 生成方案中 | 1920×1080 | 加载状态、算法名称 | — | 算法能力 | container-generating.png |
| S17 | 柜型推荐 | 方案生成完成 | 1920×1080 | 利用率 84.51%、件数 221/221 | — | 算法结果 | container-generated.png |
| S18 | 柜型推荐 | 目标态：LPE ≥70% | 1920×1080 | LayeredPackingEngine 利用率 | — | 目标态增强 | container-target-lpe70.png |
| S19 | 3D 装柜作业 | 总览视角 | 1920×1080 | 集装箱全景、118 部件 | — | 3D 可视化 | twin-overview.png |
| S20 | 3D 装柜作业 | 门端视角 | 1920×1080 | 开门状态 | — | 3D 视角 | twin-door.png |
| S21 | 3D 装柜作业 | 侧视视角 | 1920×1080 | 装柜层次 | — | 3D 视角 | twin-side.png |
| S22 | 3D 装柜作业 | 俯视视角 | 1920×1080 | 堆码布局 | — | 3D 视角 | twin-top.png |
| S23 | 3D 装柜作业 | 叉车作业动画 | 1920×1080 | 叉车 34 部件、取货轨迹 | — | 程序化构建 | twin-forklift-path.png |
| S24 | 3D 装柜作业 | 人工 actor 作业 | 1920×1080 | 人工 actor、搬运轨迹 | — | 人工装箱 | twin-worker-path.png |
| S25 | 3D 装柜作业 | 倍速 4× 播放 | 1920×1080 | 倍速控制条 | — | 作业效率 | twin-speed-4x.png |
| S26 | 3D 装柜作业 | 目标态：16× 倍速 | 1920×1080 | 倍速控制条 16× | — | 目标态增强 | twin-target-speed-16x.png |
| S27 | 3D 装柜作业 | 算法说明弹窗 | 1920×1080 | FastBlock/Orchestrator 说明 | — | 算法解释 | twin-algorithm-modal.png |
| S28 | 3D 装柜作业 | 目标态：连续三次全装入 | 1920×1080 | loaded=total, unloaded=0 | — | 目标态增强 | twin-target-full-load.png |
| S29 | 合规预审 | 初始/待审 | 1920×1080 | 审核入口 | — | 合规流程 | compliance-pending.png |
| S30 | 合规预审 | 7 红线校验结果 | 1920×1080 | 红线项列表、通过状态 | — | 红线校验 | compliance-redlines.png |
| S31 | 合规预审 | 法规 JSON 17 sections | 1920×1080 | 法规条文引用 | — | 法规知识库 | compliance-regulations.png |
| S32 | 合规预审 | 法规详情弹窗 | 1920×1080 | 法规条目、RAG 命中 | — | RAG 检索 | compliance-regulation-detail.png |
| S33 | 合规预审 | AI 建议（DeepSeek） | 1920×1080 | AI 建议文本 | API Key | AI 合规 | compliance-ai-advice.png |
| S34 | 合规预审 | 人工复核通过 | 1920×1080 | 本地规则 WARNING / AI建议 PASS / 人工复核独立 结论、复核签名 | — | 三层证据链 | compliance-pass.png |
| S35 | 合规预审 | 联网检索（Tavily） | 1920×1080 | 检索结果摘要 | API Key | 联网检索 | compliance-tavily-search.png |
| S36 | 合规预审 | 目标态：PDF 原文联动 | 1920×1080 | PDF 阅读器、页码定位 | — | 目标态增强 | compliance-target-pdf.png |
| S37 | 报告导出 | 报告模型预览 | 1920×1080 | 报告概览、订单号 | — | 报告生成 | report-preview.png |
| S38 | 报告导出 | HTML 下载 | 1920×1080 | 下载文件、浏览器打开 | — | HTML 报告 | report-html-download.png |
| S39 | 报告导出 | CSV 下载 | 1920×1080 | CSV 文件、Excel 打开 | — | CSV 报告 | report-csv-download.png |
| S40 | 报告导出 | JSON 下载 | 1920×1080 | JSON 文件、结构展示 | — | JSON 报告 | report-json-download.png |
| S41 | 报告导出 | 浏览器打印 | 1920×1080 | 打印预览 | — | 打印导出 | report-print-preview.png |
| S42 | 报告导出 | 导出后返回仪表盘 | 1920×1080 | 完成状态 | — | 流程闭环 | report-after-export-return.png |
| S43 | 报告导出 | 目标态：后端 PDF | 1920×1080 | PDF 文件下载 | — | 目标态增强 | report-target-backend-pdf.png |
| S44 | 报告导出 | 目标态：小程序 export | 1080×1920 | 小程序导出页面 | — | 目标态增强 | report-target-mp-export.png |
| S45 | 演示订单 | NB2026-DEMO-01 全流程 | 1920×1080 | 订单号、40HQ、221/221、84.51%、本地规则 WARNING / AI建议 PASS / 人工复核独立 | — | 演示验证 | demo-nb2026-full-flow.png |
| S46 | 小程序 | 方案查看页 | 1080×1920 | 方案列表 | — | 移动端 | mp-plan-view.png |
| S47 | 小程序 | 货物管理页 | 1080×1920 | 货物列表 | — | 移动端 | mp-cargo-manage.png |
| S48 | 小程序 | export 空壳页（当前态） | 1080×1920 | 空白页面 | — | 当前态佐证 | mp-export-empty.png |

---

## 三、截图规范

1. **分辨率**：Web 端统一 1920×1080，小程序端 1080×1920，3D 截图可适当提高至 2560×1440。
2. **浏览器**：建议 Chrome 最新版，关闭书签栏，缩放 100%。
3. **数据**：统一使用演示订单 NB2026-DEMO-01，40HQ，221/221 件，84.51%，本地规则 WARNING / AI建议 PASS / 人工复核独立。
4. **脱敏**：不得暴露 API Key、用户真实姓名、真实企业信息；Tavily/DeepSeek 截图需遮盖 Key。
5. **命名**：全部小写英文+连字符，格式 `页面-状态.png`，目标态截图加 `-target` 前缀或后缀。
6. **存储**：统一存放于 `docs/submission-materials/12-evidence/screenshots/` 目录。

---

## 四、按申报章节映射

| 申报章节 | 建议截图编号 | 用途 |
|----------|--------------|------|
| 系统总览 | S01-S07 | 仪表盘全状态 |
| 货物管理 | S08-S13 | 录入与识别 |
| 智能决策 | S14-S18 | 柜型与算法 |
| 3D 可视化 | S19-S28 | 装柜作业全视角 |
| 合规预审 | S29-S36 | 三层证据链 |
| 报告导出 | S37-S44 | 多格式输出 |
| 演示验证 | S45 | 全流程闭环 |
| 移动端 | S46-S48 | 小程序能力 |
