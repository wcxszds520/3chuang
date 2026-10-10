# 甬柜易算 Web 前端重构人工复核清单

> 阶段：第五阶段自评  
> 模型：GLM-5.2  
> 日期：2026-07-02  
> 评分维度：8 项满分 100  
> 最终结论：**READY_WITH_NOTES**

---

## 1. 8 维度评分

| 维度 | 满分 | 得分 | 依据 |
|---|---|---|---|
| 视觉高级感 | 20 | 15 | designTokens.css 定义 YCC v2 token（港口蓝、Space Grotesk、HUD 玻璃、分区色），6 页视觉统一。未全量替换既有 .surface 类，部分页面仍混用旧样式，扣 5 分。 |
| 物流业务感 | 15 | 13 | 工作台 processSteps 4 步、metric-strip 5 项 KPI、3D 作业指令卡、合规矩阵均贴近港前装柜真实流程。recentTasks 表仍为 DEMO 静态历史订单，扣 2 分。 |
| 3D 作业孪生表现 | 20 | 16 | 保留真实 Three.js canvas（940×1146 非空），HUD/步骤队列/风险列表/图层按钮全部真实绑定。未做 T5 目标位 BoxHelper 高亮、T6 未装入可视化、T9 默认相机重定位，扣 4 分。 |
| 信息层级 | 15 | 13 | OrderSummaryBar 7 项统一、processStrip 步骤层级清晰、3D 侧栏 instruction-card → step-queue → layer-groups → risk-list 分层合理。部分页面卡片密度仍偏高，扣 2 分。 |
| 真实数据一致性 | 10 | 10 | Playwright 验证 OrderSummaryBar 显示 221/221、84.51%、本地规则 WARNING / AI建议 PASS / 人工复核独立，无硬编码 本地规则 WARNING / AI建议 PASS / 人工复核独立。buildReportHtml/buildOperationalComplianceRows/AiSuggestionPanel 全部从 plan/compliance 派生。满分。 |
| 交互可用性 | 10 | 9 | 按钮测试 2/2 通过，E2E 主路径 5/5 通过，图层按钮接入 visualMode。后端 500 时前端降级不崩溃。部分按钮（如"查看算法依据"弹窗）仍含静态解释文本，扣 1 分。 |
| 性能稳定性 | 5 | 5 | 构建零错误，Three.js 独立 chunk（gzip 120KB），主路径 5 页切换无崩溃。满分。 |
| 安全边界 | 5 | 5 | API Key 泄露检查 0 处，.env 未外泄，未读取/输出 .env。满分。 |
| **合计** | **100** | **86** | |

---

## 2. 最终结论

### **READY_WITH_NOTES**

**结论依据**：

- ✅ 假成功风险全部消除（I1/I3/I4/I5/I6/I8/I9/I10/T1/T8/T11/C1/C2），Playwright 数据一致性验证确认未审计时显示 WARNING 而非 本地规则 WARNING / AI建议 PASS / 人工复核独立。
- ✅ 3D 作业孪生保留真实 Three.js 渲染，HUD/步骤队列/图层按钮全部真实绑定。
- ✅ 构建、截图、按钮、E2E、安全 7 项测试全部通过。
- ⚠️ 未达 FRONTEND_ADVANCED_READY 的原因：
  1. 3D scene 内部增强（T5 目标位高亮、T6 未装入可视化、T9 默认相机）未做，3D 视觉高潮感尚有提升空间。
  2. designTokens.css 已定义但未在 6 页全量应用 `.yg-*` 类，部分页面仍混用旧 `.surface`/`.metric` 样式，视觉统一度未达满分。
  3. recentTasks 历史订单表仍为 DEMO 静态数据（非假成功，但非真实数据源）。

---

## 3. 人工复核清单

### 3.1 假成功消除（必检）

- [x] 工作台 metric-strip 合规状态：未审计时显示"待审计"/WARNING，不显示 本地规则 WARNING / AI建议 PASS / 人工复核独立
- [x] 工作台 processSteps 步骤3：合规未通过时显示"合规待复核"/warning，不显示"合规已通过"
- [x] 工作台 AiSuggestionPanel：未审计时"合规结论"显示 pending，不显示 PASS
- [x] 3D scene-hud：装载进度/当前货物/作业动作绑定真实 progress/currentItem
- [x] 3D step-queue：从 plan.loadedCargo 真实聚合，非硬编码 5 行
- [x] 3D twin-risk-list：合规/重心/LIFO 从真实 compliance/plan 派生
- [x] 合规分数卡：显示 compliance.score/status，未审计显示"待审计"
- [x] 合规 risk-status-list：从 buildOperationalComplianceRows 真实派生
- [x] 柜型推荐 comparisonRows：仅真实方案柜型显示真实合规，其余"待评估"
- [x] 报告 buildReportHtml：KPI 从 plan/compliance 派生
- [x] ReportModule/ComplianceModule reviewed：需 isCompliancePassed && manual-review，无 DEMO 短路

### 3.2 真实链路保留（必检）

- [x] Three.js PackingScene 组件未改，canvas 真实渲染
- [x] /api/packing/generate、/api/compliance/*、/api/vlm/* 接口调用未改
- [x] vlmCargo.js / aiCompliance.js / complianceRules.js / packingDemo.js 未改
- [x] 装箱算法未重写
- [x] 数据库结构未改

### 3.3 安全边界（必检）

- [x] API Key 泄露检查：0 处
- [x] .env 未读取/未输出
- [x] 无 Bearer token 硬编码
- [x] 无 VITE_*_KEY 变量名泄露

### 3.4 3D 真实性（必检）

- [x] 3D 页 canvas 非空（940×1146）
- [x] 未用静态截图替代 3D
- [x] 未引入重模型/重后处理
- [x] Three.js 数据结构（plan.loadedCargo/containerInfo/cog）未改

### 3.5 交互可用性（必检）

- [x] 6 页 hash 路由均可访问
- [x] 维护 SKU 按钮跳转 #cargo
- [x] 生成装柜方案按钮可点击
- [x] 图层筛选 8 按钮接入 visualMode，有 active 状态
- [x] 3D 播放/暂停/重置/进度条/全屏均可操作
- [x] 后端 500 时前端降级不崩溃

---

## 4. 后续建议（达到 FRONTEND_ADVANCED_READY 的路径）

| 优先级 | 建议 | 预期增益 |
|---|---|---|
| P1 | 3D scene 内部增强：目标位 BoxHelper 高亮、未装入货物侧边可视化、默认相机俯视 30° | 3D 维度 +3 分 |
| P2 | 6 页全量应用 `.yg-*` 设计 token 类，替换旧 `.surface`/`.metric` | 视觉高级感 +3 分 |
| P3 | recentTasks 改为从本地 localStorage 或后端历史接口读取 | 物流业务感 +2 分 |
| P4 | 算法依据弹窗解释文本从 plan.constraintMeta 真实派生 | 交互可用性 +1 分 |

完成 P1+P2 后可升级为 **FRONTEND_ADVANCED_READY**。
