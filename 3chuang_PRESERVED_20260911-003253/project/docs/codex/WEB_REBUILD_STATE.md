# Web 重建持久状态

更新时间：2026-07-12  
当前阶段：第三阶段实现、红队回归、视觉复核和 40 项硬门槛均已完成。  
最终证据入口：`docs/codex/STAGE3_ACCEPTANCE.md`

## 最终目标与结果

甬柜易算已切换为单一会话、六业务页的新 Web 树：工作台 → 货物/SKU → 柜型决策 → 3D 作业 → 合规/PDF → 报告交付。六页共享同一订单、cargo、backend plan、compliance 和 manual review，不再用页面静态数字拼接一致性。

## Git 状态

- 根目录：`D:\cixing\3chuang`
- 分支：`codex/sol`
- 基线与最终 HEAD：`ef47171694c44feb086d4875a95732f79ed229f9`
- 第三阶段基线已有 81 个顶层 status 项；最终 85 项（50 D、13 M、22 ??）。
- 未执行 reset、clean、commit、push；未恢复或覆盖既有删除/用户修改。
- `web-dashboard/`、`docs/`、`tools/`、`output/` 基线时整体 untracked，无法用 Git diff 精确归因其中每一行。

## 启动方式与入口

- 后端：`cd backend && npm start`，默认 `http://127.0.0.1:3000`；当前 PID 18184，健康接口 200。
- 前端：`cd web-dashboard && npm run dev`，当前 `http://127.0.0.1:5173`。
- 前端入口：`web-dashboard/src/main.jsx` → `app/Application.jsx` → router/AppShell/session/feedback providers。
- 后端入口：`backend/server.js` → `backend/routes/index.js` → packing/compliance/dashboard/VLM/TTS 等路由。

## 新前端架构

```text
web-dashboard/src/
  app/                  router、shell、session schema/reducer/storage
  components/           feedback、forms、workspace、visual projection
  domain/               cargo/demo/templates/CSV、container、compliance、report
  pages/workflows/      Dashboard/Cargo/Container/Twin/Compliance/Report
  services/             apiClient、packing/compliance/VLM services
  three/                actors、operation、scene、presentation、camera
  styles/               单一 token/reset/shell/app 样式体系
```

- 页面按 feature/workflow 分离；API 统一封装；session reducer 统一跨页状态。
- 一套 Toast/Modal/Drawer/Confirm/Loading/Empty/Error 系统。
- 旧 restore 样式不参与布局，没有两套页面或隐藏旧 3D/合规回退。

## 当前会话与必须保护的数据

- session schema 2，键 `yonggui.web.session.v2`。
- 唯一默认数据：`NB2026-DEMO-01`，10 SKU/221 件/3 港/7 批次/8,812 kg。
- 后端方案字段：planId、containerInfo、loadedCargo/unloadedCargo、spaceUtilization、totalWeight、cog/cogOffset、metrics/constraintMeta、ext_algorithmId。
- placement 坐标、尺寸、重量、SKU、港序、批次、actor 不得被视图或动画改写。
- 合规四层：本地规则、PDF 证据、后端 AI、人工复核；历史不可覆盖。

## 六页完成内容

1. **工作台**：当前订单主视觉、方案摘要、活动和明确下一步；无方案显示待生成。
2. **货物清单**：唯一官方模板、10 SKU 清单、搜索、港口/港序/作业/属性/批次筛选、批量、CRUD、CSV 导入/导出、VLM 草稿。
3. **柜型决策**：真实后端生成、唯一 Fast Block 标签、无算法选择器；SKU/港序/风险/作业四投影保持方案指纹；7 个核心指标和全部装入状态。
4. **3D 作业**：真实 loadedCargo machine；34-part 叉车、20-part 工人；门洞/边界/碰撞；0.5–16×；七维筛选；10 组队列；三标签模式。
5. **合规预审**：3 份×4 页真实 PDF，7 条规则联动文档/页码/高亮/摘录；本地、AI、人工状态和历史分离。
6. **报告交付**：当前方案预览；真实 HTML/CSV/JSON 下载；内容回读；浏览器打印不冒充 PDF 下载。

## 关键业务事实

- 权威接口：`POST /api/packing/generate`。
- 前后端均强制 `fast-block`；后端仍兼容旧 `cargoIds` 请求并返回当前扁平坐标契约。
- 三次最终方案 ID：`REQ_1783801607597`、`REQ_1783801617461`、`REQ_1783801625460`。
- 三次均 221 loaded、0 unloaded、84.51018309907437%、8,812 kg、LIFO true；核心 SHA-256 一致。
- 3D 人工/叉车轨迹 155/156 samples；标签 overlap 0；筛选 plan fingerprint preserved。
- 报告 CSV 221 行/27 列，HTML 42,284 B，JSON schema2 292,731 B。

## 主要修改文件

- 后端：`models/Cargo.js`、`services/FastBlockPackingEngine.js`、`services/AlgorithmOrchestrator.js`、`routes/packing.js`、`server.js`、Fast Block/packing tests。
- 数据/session：`domain/cargo/demoDataset.js`、`app/session/*`、cargo templates/CSV/appearance。
- 页面：六个 `pages/workflows/*Page.jsx` 和 `components/compliance/RegulationWorkbench.jsx`。
- 3D：`three/actors/createManualWorker.js`、`three/operation/*`、`three/scene/TwinScene.js`、presentation filters/groups/labels/camera。
- 合规/报告：`domain/compliance/regulationEvidence.js`、`domain/report/reportBuilders.js`、3 份 PDF 与 12 个 rendered pages。
- 验收：五个 stage3 gate、四个既有 E2E、PDF/contact sheet/recovery 工具与本目录文档。

## 删除状态

- 第三阶段没有用 reset/clean 批量删除文件。
- `git status` 中 50 个 tracked deletion 在第三阶段基线已存在，保留为用户/此前工作状态；未擅自恢复或进一步删除。
- 产品运行入口不引用旧页面、restore CSS、旧算法 selector 或第二套默认数据。

## 最终命令与结果

- Web lint：exit 0；unit：23 files/79 tests；build：1632 modules。
- Backend targeted lint：exit 0；2 suites/13 tests。
- Stage3 dataset/algorithm/three/compliance/report：全部 exit 0。
- Core/motion/UI/final visual：全部 exit 0。
- 截图实际检查：`output/playwright/stage3/visual-audit/visual-inspection.json` PASS。
- 数据库：旧测试改为 owned-ID cleanup；20 条历史方案从 binlog 20/20 恢复，最终 23 行且 0 条测试规模方案。

## 未解决问题与下一步

无第三阶段阻断项。仍需遵守 `STAGE3_LIMITATIONS.md` 中的产品边界：本地 PDF 不冒充官方文本、外部 AI/VLM 可能不可用、3D 为低多边形作业表达、工作树保持用户原有脏状态。
