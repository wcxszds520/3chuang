# 甬柜易算 Web 重建最终验收

状态：COMPLETE  
最终复核：2026-07-12  
第三阶段 40 项逐条证据：`docs/codex/STAGE3_ACCEPTANCE.md`

## 实际交付

- 单一新 Web 应用架构与六个业务页面已经切换为运行入口。
- 唯一 10 SKU/221 件演示订单贯穿录入、后端装箱、3D、合规与报告。
- 真实 `/api/packing/generate` 连续三次稳定全装入；页面与后端均固定 Fast Block。
- 3D 包含真实叉车与人工搬运、唯一门端、门洞/边界/碰撞阻断、连续状态机、0.5–16×、七类筛选和分组队列。
- 合规页真实浏览 3 类多页 PDF，规则联动页码/高亮/摘录；本地规则、PDF、AI、人工独立。
- 报告真实生成并回读 HTML、CSV、JSON；不显示不存在的后端 PDF/ZIP/XLSX。
- 15 个主动失败场景、三视口、Modal/Drawer、错误/空状态和截图人工复核完成。

## 原目标 50 项完成条件审计

| 范围 | 状态 | 证据摘要 |
|---|---|---|
| 1–5 新架构、六页、旧页面/restore/双树清理 | PASS | `src/app`＋六个 workflow pages；入口只引用新树；无 restore/旧 3D/旧合规回退 |
| 6–10 信息密度、层级、卡片/英文/主按钮 | PASS | 18 张三视口页面截图实际检查；primary controls 无裁切 |
| 11–13 Toast/Modal/切页遮罩 | PASS | final visual modal/drawer in bounds、overlayCleared；统一 FeedbackProvider |
| 14–17 模板、CRUD、搜索筛选、CSV | PASS | core E2E cargo-crud/csv-validation；10 SKU 模板和五类货物筛选 |
| 18 六页订单一致 | PASS | core `order-consistent-six-pages`，订单均 `NB2026-DEMO-01` |
| 19 柜型来自真实方案 | PASS | 三次真实后端 221/0；algorithm gate |
| 20 3D 使用真实 loadedCargo | PASS | machineTotal 221、plan fingerprint 与后端 plan 对应 |
| 21–23 唯一门端、两扇门、开门动画 | PASS | reset doorCount 2、doorEnd high-x；17 张 3D 图 |
| 24–28 门洞/侧壁/顶板/前壁/已装碰撞 | PASS | geometry/operationMachine tests＋blocked scenarios |
| 29–32 叉车连续、货叉、绑定、释放 | PASS | 156 帧完整 13 状态；fork height/extension/carry/release |
| 33–35 暂停/继续/重置、速度、跳步 | PASS | pauseStable/resetCorrect；0.5–16×；motion E2E |
| 36 稳定货物外观 | PASS | appearance mapping tests 7；无随机颜色 |
| 37–38 合规三层与人工复核 | PASS | 实际为四层分离；manual conditional/rejected 历史 |
| 39 报告真实数据 | PASS | 10 SKU/221/0/84.5102%/COG/证据一致 |
| 40 下载真实文件 | PASS | HTML 42,284 B；CSV 61,606 B；JSON 292,731 B，均回读 |
| 41 build | PASS | Vite 1632 modules，exit 0 |
| 42 lint | PASS | 前端 lint 0 warning；后端本轮文件 lint 0 warning |
| 43 unit | PASS | Web 79/79；backend targeted 13/13 |
| 44 核心 E2E | PASS | core 10/10；motion 10/10；五套 stage3 gates 全过 |
| 45 三桌面视口 | PASS | 1920×1080、1672×941、1280×720 |
| 46 六页截图 | PASS | 3×6＝18 张 |
| 47 3D 四视角 | PASS | overview/door/side/top＋作业状态共 17 张 |
| 48 应用 JS 错误 | PASS | 成功门禁 pageErrors/unexpected errors 全部 0 |
| 49 Git 无关修改 | PASS | 未 reset/clean/checkout；基线用户状态保留；本轮不提交 |
| 50 最终证据文档 | PASS | 本文＋STAGE3_ACCEPTANCE＋JSON/PNG/PDF/下载文件 |

## 六页变化

1. 工作台用当前订单、后端方案、活动和待办回答“发生了什么/下一步是什么”。
2. 货物页提供唯一官方模板、CRUD、复制、批量、搜索、组合筛选、CSV 与 VLM 草稿。
3. 柜型页移除算法选择器，只显示源码可证明的 Fast Block；四投影视图不改变方案。
4. 3D 页用双 actor 状态机表达真实装柜，支持视角、倍速、筛选、分组队列和阻断恢复。
5. 合规页以 PDF 工作台为主，规则→文档→页码→高亮可追溯，AI/人工独立记录。
6. 报告页以真实 A4 预览为主，只提供 HTML/CSV/JSON 和浏览器打印。

## 关键实现位置

- 应用/session：`web-dashboard/src/app/`。
- 六页：`web-dashboard/src/pages/workflows/`。
- 数据集：`web-dashboard/src/domain/cargo/demoDataset.js`。
- API 强制算法：`web-dashboard/src/services/packingApi.js`、`backend/routes/packing.js`。
- 后端算法：`backend/services/FastBlockPackingEngine.js`、`AlgorithmOrchestrator.js`。
- 门端/碰撞/状态机：`web-dashboard/src/three/operation/geometry.js`、`operationMachine.js`。
- 叉车/工人/场景：`web-dashboard/src/three/scene/TwinScene.js`、`three/actors/createManualWorker.js`。
- 货物外观：`web-dashboard/src/domain/cargo/appearance.js` 与 scene descriptors。
- 3D 筛选/队列/标签：`three/presentation/operationFilters.js`、`queueGroups.js`、`labelLayout.js`。
- 法规证据：`domain/compliance/regulationEvidence.js`、`components/compliance/RegulationWorkbench.jsx`、`public/regulations/`。
- 报告：`domain/report/reportBuilders.js`、`pages/workflows/ReportPage.jsx`。

## 最终测试与视觉结果

- Web：23 test files / 79 tests；lint exit 0；build exit 0。
- Backend：2 suites / 13 tests；本轮文件 ESLint exit 0。
- 三次计划：221/0、84.51018309907437%、8,812 kg、LIFO true、同 core SHA-256。
- 3D：人工 155、叉车 156 samples；标签 overlap 0；七维筛选指纹不变。
- 合规：3 PDF×4 页、7 条证据；5 条规则联动抽验全过。
- 报告：CSV 221 行/27 列，HTML/CSV/JSON placement SHA-256 一致。
- UI：15/15 主动失败可恢复；18/18 三视口截图；Modal 780×386、Drawer 680×720 均在 1280×720 内。
- 视觉检查记录：`output/playwright/stage3/visual-audit/visual-inspection.json`。

## 本地启动

```powershell
cd D:\cixing\3chuang\backend
npm start

cd D:\cixing\3chuang\web-dashboard
npm run dev
```

访问 `http://127.0.0.1:5173`。后端健康检查：`http://127.0.0.1:3000/api/packing/health/compliance`。

## 推荐演示流程

1. 工作台确认 `NB2026-DEMO-01`、10 SKU/221 件和三港路线。
2. 货物页组合筛选，展示 manual/forklift、批次、风险，导出 CSV 后恢复模板。
3. 柜型页生成真实方案，说明 221/221、84.51%、COG/LIFO 和唯一 Fast Block；切换四投影。
4. 3D 页分别跳到人工 index 0 与叉车 index 12，演示取货→过门→放置→退出；再切 16×、七维筛选和 blocked 状态。
5. 合规页依次点击 VGM、CTU、IPPC 规则，展示 PDF 页码/高亮，再运行 AI 并填写人工条件通过。
6. 报告页下载 HTML/CSV/JSON，使用第三阶段 report gate 的回读结果说明一致性。

## Git 与限制

- 分支 `codex/sol`；HEAD `ef471716…`；未 commit/push。
- 第三阶段基线脏工作树被保留；最终 85 个顶层状态项。
- 法规 PDF、外部 AI/VLM、低多边形 3D 和数据库测试恢复的完整边界见 `STAGE3_LIMITATIONS.md`。
