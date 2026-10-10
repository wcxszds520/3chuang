# 仓库审计日志 (AUDIT_LOG)

> 本文件记录对"甬柜易算"项目进行仓库级调查的全过程。
> 调查日期：2026-07-11
> 调查原则：只读调查，不修改业务代码，不提交/推送仓库

---

## 一、仓库基础信息

| 项目 | 值 |
|------|-----|
| 仓库路径 | d:\cixing\3chuang |
| Git 提交数 | 1 (通过 .git/logs/HEAD 确认) |
| 当前分支 | main (通过 .git/HEAD 确认) |
| 调查方式 | 只读文件读取 + Grep/Glob 搜索 + 子代理并行调查 |
| 是否修改代码 | 否 |
| 是否提交/推送 | 否 |

---

## 二、调查步骤记录

### 步骤 1: 仓库基础调查

- 读取 .git/logs/HEAD 确认 Git 历史
- 读取 .git/config 确认远程仓库配置
- 读取 .git/HEAD 确认当前分支
- Glob 项目根目录结构
- 读取 web-dashboard/package.json 和 backend/package.json
- 识别技术栈：React 18 + Vite 5 + Three.js / Express 4 + MySQL2

### 步骤 2: Web 端调查

- Glob web-dashboard/src/**/*.jsx 确认页面组件
- 读取路由配置（自研 hash 路由）
- 读取状态管理（useReducer + localStorage）
- 读取 API 客户端 apiServices.js
- 识别 6 个主要页面：首页/货物录入/装箱方案/3D作业/合规预审/报告导出

### 步骤 3: 移动端调查

- 识别原生微信小程序（非 Taro/Uni-app）
- 读取 miniprogram/app.json 确认页面清单
- 读取小程序 AppID: wx3e4ac8267481ad58
- 识别 threejs-miniprogram 0.0.8
- 确认 export 页面为空壳

### 步骤 4: 后端调查

- 读取 backend/server.js 确认入口
- 读取 backend/routes/index.js 确认 9 个路由模块
- Grep 后端所有路由端点
- 识别 41 个 API 端点
- 读取数据库迁移脚本

### 步骤 5: 装箱算法调查

- 读取 FastBlockPackingEngine.js（关键发现：sixDimensionalConstraints 是约束清单非加权算法）
- 读取 AlgorithmOrchestrator.js（6 个算法白名单）
- 读取 Realistic4DPackingEngine.js（v34.7）
- Grep "六维|six.?dimension|加权" 在 47 个文件中搜索
- 确认算法入口、输入输出结构、坐标系

### 步骤 6: 3D 数字孪生调查

- 读取 operationMachine.js（18 相位状态机）
- 读取 geometry.js（AABB 碰撞检测、坐标系定义）
- 识别程序化构建：集装箱 118 部件 + 叉车 34 部件
- 识别坐标系：x=长度/y=高度/z=宽度，门端在高 X

### 步骤 7: 合规与 AI 服务调查

- 读取 AIComplianceService.js（v3.2，"引擎算物理AI判合规"架构）
- 读取 RegulationRAGService.js（4 份 JSON 法规，TF-IDF）
- 识别 7 条红线 + 6 维度 reportTable
- 确认 VGM 后端硬计算（≤5% 且≤1吨）
- 识别 AI 降级机制

### 步骤 8: 报告导出调查

- 读取 reportBuilders.js
- 确认 HTML/CSV/JSON 浏览器本地生成
- 确认无后端 PDF 生成

### 步骤 9: 测试调查

- Glob 后端测试文件：54 个文件
- Glob Web 测试文件：21 个文件
- 识别 fast-check 属性测试：93 处
- 识别 Playwright E2E 配置

### 步骤 10: 执行只读验证

- 运行 web-dashboard: npm run lint → PASS (exit 0)
- 运行 web-dashboard: npm test → 75/76 PASS (exit 1)
- 运行 web-dashboard: npm run build → PASS (exit 0)
- 运行 backend: npm run lint → PASS (exit 0, 66 warnings)
- 运行 backend: npm test → CRASHED (EADDRINUSE port 3000)

---

## 三、调查中识别的关键问题

### 3.1 事实矛盾

1. "Fast Block多约束三维装箱引擎" vs 实际代码中的 `sixDimensionalConstraints` 约束清单
2. 演示订单已统一为 221/221 件、0 件未装、84.51%、8,812 kg；合规状态保持分层呈现。
3. VLM 模型从 Qwen2-VL-72B 升级到 Qwen3-VL-32B，部分文档未更新
4. 主色存在三套不同定义
5. 倍速档位文档与代码不一致

### 3.2 证据不足

1. 后端测试因端口占用无法完整运行
2. 小程序 export 功能为空壳
3. 人工装箱 actor 仅有基本骨架
4. TTS 和 VLM 服务缺乏完整测试
5. 无部署脚本和 CI/CD 配置

### 3.3 安全隐患

1. 数据库密码硬编码在 migrate-add-fragile.js:18
2. .env 文件存在但未确认是否在 .gitignore 中

---

## 四、调查文件清单

本次调查共生成以下文件（位于 docs/submission-materials/）：

| 目录 | 文件数 | 用途 |
|------|--------|------|
| 00-audit | 1 (本文件) | 审计日志 |
| 01-project-facts | 5 | 核心事实库 |
| 02-web | 1 | Web 端事实 |
| 03-mobile | 1 | 移动端事实 |
| 04-backend | 1 | 后端事实 |
| 05-algorithm | 6 | 算法专项 |
| 06-three-d | 6 | 3D 专项 |
| 07-compliance-ai | 5 | 合规 AI 专项 |
| 08-testing | 1 | 验证结果 |
| 09-report-inputs | 3 | 报告参考资料 |
| 10-ppt-inputs | 1 | PPT 参考资料 |
| 11-diagrams | 13 | Mermaid 图源文件 |
| 12-evidence | 2 | 截图与证据计划 |
| 13-target-state | 4 | 目标态文档 |
| 14-final-index | 2 | 最终索引 |
| **合计** | **52** | |

---

## 五、调查结论

本次仓库级调查覆盖了用户要求的全部 12 个领域（Web/移动端/后端/算法/数据库/3D/合规/AI/报告导出/测试/文档/证据），建立了 52 个文件的统一事实库，严格按照 VERIFIED/IMPLEMENTED_UNVERIFIED/PARTIAL/PLANNED/NOT_FOUND/UNKNOWN 六级状态分类，未将任何未实现功能伪装为已完成。

关键发现：
1. 项目核心链路（货物录入→装箱算法→3D作业→合规预审→报告导出）已基本打通
2. "Fast Block多约束三维装箱引擎"需修正为"六类业务约束协同机制模型"
3. 演示订单数据已更新为 84.51%/本地规则 WARNING / AI建议 PASS / 人工复核独立
4. 后端测试存在环境依赖问题（端口占用）
5. 小程序和部分 AI 服务功能不完整
