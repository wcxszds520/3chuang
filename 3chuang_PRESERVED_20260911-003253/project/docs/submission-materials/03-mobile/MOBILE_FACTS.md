# 移动端事实 (MOBILE_FACTS)

> 生成时间：2026-07-11
> 小程序描述：甬柜易算 - 物流装箱算法小程序（[miniprogram/package.json:4](file:///d:/cixing/3chuang/miniprogram/package.json#L4)）
> 状态分级：VERIFIED / IMPLEMENTED_UNVERIFIED / PARTIAL / PLANNED / NOT_FOUND

---

## 1. 小程序基本信息

| 项 | 值 | 证据 |
|---|---|---|
| 技术形态 | **原生微信小程序**（非 Taro / 非 Uni-app） | [miniprogram/app.json](file:///d:/cixing/3chuang/miniprogram/app.json) |
| AppID | `wx3e4ac8267481ad58` | [miniprogram/project.config.json](file:///d:/cixing/3chuang/miniprogram/project.config.json) |
| 页面数 | 5 | app.json pages |
| 自定义组件数 | 9 | miniprogram/components/ |
| 测试 | 无（`test=echo error`） | package.json scripts |

## 2. 五页面矩阵

| 页面 | 路径 | 目标 | 核心功能 | 真实数据来源 | 完成状态 | 证据 | 缺口 |
|---|---|---|---|---|---|---|---|
| index | pages/index/ | 首页概览 | 港口看板 + 流程入口 + 拟真数据展示 | 硬编码 mockData（port-dashboard 组件） | VERIFIED | pages/index/ + port-dashboard 组件 | 首页用硬编码 mockData，非真实后端 |
| cargo-input | pages/cargo-input/ | 货物录入 | SKU 录入 + 计数器 + 表单 | session（store.js） | VERIFIED | pages/cargo-input/ + data-counter 组件 | 缺 CSV 导入、批量编辑 |
| container-select | pages/container-select/ | 柜型选择 | 柜型列表 + 推荐 | session | VERIFIED | pages/container-select/ | 柜型推荐简化 |
| packing-result | pages/packing-result/ | 装箱结果 | 3D 装柜可视化 + 装箱清单 | 后端 / 离线降级预录方案 | VERIFIED | pages/packing-result/（三版本） | 三版本共存 |
| export | pages/export/ | 报告导出 | **空壳页面** | - | PARTIAL | `Page({data:{},onLoad:function(){}})` | 无实际导出功能 |

### 2.1 export 空壳页面（PARTIAL）

证据：[miniprogram/pages/export/export.js](file:///d:/cixing/3chuang/miniprogram/pages/export/export.js)

```javascript
Page({
  data: {},
  onLoad: function () {}
})
```

- 无实际导出逻辑
- 无 UI 交互
- 状态：PARTIAL（占位页面）

## 3. packing-result 三版本

| 版本 | 用途 | 状态 | 证据 |
|---|---|---|---|
| v5.0.0-industrial | **生产版本** | VERIFIED | pages/packing-result/v5.0.0-industrial/ |
| v31.6-synchronized | 历史版本 | 历史归档 | pages/packing-result/v31.6-synchronized/ |
| v2.0-workstation | 历史版本 | 历史归档 | pages/packing-result/v2.0-workstation/ |

## 4. 九自定义组件

| 组件 | 职责 | 证据 |
|---|---|---|
| data-counter | 数量计数器 | components/data-counter/ |
| elegant-loading | 优雅加载动画 | components/elegant-loading/ |
| home-pie-chart | 首页饼图 | components/home-pie-chart/ |
| home-sparkline | 首页迷你折线 | components/home-sparkline/ |
| home-trend-chart | 首页趋势图 | components/home-trend-chart/ |
| loading-overlay | 加载遮罩 | components/loading-overlay/ |
| offline-banner | 离线横幅 | components/offline-banner/ |
| port-dashboard | 港口看板（**强制硬编码 mockData**） | components/port-dashboard/ |
| typewriter | 打字机效果 | components/typewriter/ |

### 4.1 port-dashboard 硬编码说明（VERIFIED）

- **强制硬编码 mockData**，注释明确"确保路演零故障"
- 不调用后端 API
- 证据：[miniprogram/components/port-dashboard/](file:///d:/cixing/3chuang/miniprogram/components/port-dashboard/)

## 5. 3D 渲染

| 版本 | 文件 | 背景色 | 用途 | 证据 |
|---|---|---|---|---|
| 深色版（默认） | ThreeRenderer.js | `0x1a1a1a` | **生产默认** | miniprogram/utils/ThreeRenderer.js |
| 白色版 | ThreeRenderer-v33.0-FINAL.js | `0xf5f5f7` | 历史版本 | miniprogram/utils/ThreeRenderer-v33.0-FINAL.js |

- 默认使用深色版（0x1a1a1a）
- 白色版为历史保留

## 6. 网络与离线降级

### 6.1 request.js

| 项 | 值 | 证据 |
|---|---|---|
| BASE_URL | `http://localhost:3000/api` | [miniprogram/utils/request.js](file:///d:/cixing/3chuang/miniprogram/utils/request.js) |
| 超时 | 60 秒 | request.js |
| 离线降级 | **仅对 `/packing/generate`** | request.js |

### 6.2 离线降级方案

| 项 | 值 | 证据 |
|---|---|---|
| 预录方案来源 | demo-precomputed-plans.js | [miniprogram/utils/demo-precomputed-plans.js](file:///d:/cixing/3chuang/miniprogram/utils/demo-precomputed-plans.js) |
| 触发条件 | 后端不可达时（仅 /packing/generate） | request.js |
| 其他端点 | 不降级，直接报错 | request.js |

## 7. 数据持久化

| 项 | 值 | 证据 |
|---|---|---|
| 存储 API | `wx.setStorageSync` | [miniprogram/utils/store.js](file:///d:/cixing/3chuang/miniprogram/utils/store.js) |
| 机制 | 同步持久化 | store.js |

## 8. 港口数据库

| 项 | 值 | 证据 |
|---|---|---|
| 港口数 | 46 个全球港口 | [miniprogram/utils/portDatabase.js](file:///d:/cixing/3chuang/miniprogram/utils/portDatabase.js) |

## 9. 设计令牌（双轨）

| 来源 | 主色 | 证据 |
|---|---|---|
| designTokens.js | `#007AFF` | [miniprogram/utils/designTokens.js](file:///d:/cixing/3chuang/miniprogram/utils/designTokens.js) |
| app.wxss `.btn-primary` | `#1976D2` | [miniprogram/app.wxss](file:///d:/cixing/3chuang/miniprogram/app.wxss) |

> ⚠️ **双轨问题**：designTokens.js 主色（#007AFF）与 app.wxss `.btn-primary`（#1976D2）不一致，存在视觉不统一风险。

## 10. 与 Web 功能对照矩阵

| 功能 | 小程序状态 | Web 对应 | 差异说明 |
|---|---|---|---|
| 首页概览 | VERIFIED（硬编码拟真数据） | DashboardPage（真实后端） | 小程序用 mockData，Web 用真实 API |
| 货物录入 | VERIFIED | CargoPage | 小程序缺 CSV 导入、批量编辑 |
| SKU 增删改查复制 | PARTIAL | CargoPage（全功能） | 小程序缺批量编辑 |
| CSV 导入导出 | NOT_FOUND | VERIFIED | 小程序无 CSV |
| 柜型选择 | VERIFIED | ContainerPage | - |
| 柜型推荐 | PARTIAL | VERIFIED | 小程序简化 |
| 后端装箱算法 | VERIFIED | VERIFIED | 共用同一后端 |
| 三维坐标方案 | VERIFIED | VERIFIED | 共用同一后端 |
| 3D 装柜作业（叉车） | VERIFIED | VERIFIED | - |
| 3D 装柜作业（人工） | NOT_FOUND | VERIFIED | 小程序缺人工 actor |
| 3D 视角切换 | VERIFIED | VERIFIED | - |
| 3D 队列筛选 | PARTIAL | VERIFIED（7 维） | 小程序缺 7 维筛选 |
| 3D 倍速 | VERIFIED（1/4/10/30） | VERIFIED（0.5/1/2/4） | 档位不一致 |
| 合规本地规则 | NOT_FOUND | VERIFIED | 小程序无合规模块 |
| AI 合规审核 | NOT_FOUND | VERIFIED | 小程序无 AI 审核 |
| 法规知识库 | NOT_FOUND | VERIFIED | 小程序无法规库 |
| 人工复核 | NOT_FOUND | VERIFIED | 小程序无人工复核 |
| VLM 货物识别 | NOT_FOUND | VERIFIED | 小程序无 VLM |
| 报告导出 HTML | NOT_FOUND | VERIFIED | 小程序 export 为空壳 |
| 报告导出 CSV | NOT_FOUND | VERIFIED | 小程序无 |
| 报告导出 JSON | NOT_FOUND | VERIFIED | 小程序无 |
| 报告导出 PDF | NOT_FOUND | PARTIAL | 均无后端 PDF |
| TTS 语音播报 | NOT_FOUND | NOT_FOUND | 均无前端 TTS |
| 港口动态 | VERIFIED（硬编码） | VERIFIED（后端 Mock） | 双方均为 Mock |
| 会话持久化 | VERIFIED（wx.setStorageSync） | VERIFIED（localStorage） | 存储机制不同 |
| 重心计算 | PARTIAL | VERIFIED | 小程序简化 |
| 重心偏移警告 | PARTIAL | VERIFIED | 小程序简化 |
| 碰撞检测 | PARTIAL | VERIFIED | 小程序简化 |
| 多目的港 LIFO | PARTIAL | VERIFIED | 小程序简化 |

## 11. 测试覆盖

| 项 | 值 | 证据 |
|---|---|---|
| 测试脚本 | `test=echo error` | [miniprogram/package.json](file:///d:/cixing/3chuang/miniprogram/package.json) |
| 单元测试 | **无** | - |
| E2E 测试 | **无** | - |

> 小程序无任何自动化测试，仅靠人工回归。

## 12. 申报材料中不得编造的内容

> ⚠️ 以下内容在代码中**无证据**，申报材料中**不得编造**：

| 项 | 状态 | 说明 |
|---|---|---|
| 小程序上线发布 | NOT_FOUND | 无发布记录证据 |
| 小程序真实用户数 | NOT_FOUND | 无用户数据 |
| export 页面功能 | PARTIAL | 仅为空壳页面 |
| 合规审核能力 | NOT_FOUND | 小程序无合规模块 |
| 法规知识库 | NOT_FOUND | 小程序无法规库 |
| 主色统一性 | PARTIAL | designTokens.js 与 app.wxss 双轨不一致 |

## 13. 路演零故障保证机制

| 机制 | 说明 | 证据 |
|---|---|---|
| port-dashboard 硬编码 mockData | 强制使用拟真数据，确保首页稳定 | components/port-dashboard/ |
| 离线降级预录方案 | demo-precomputed-plans.js 提供预录装箱方案 | utils/demo-precomputed-plans.js |
| 离线降级仅限 /packing/generate | 其他端点不降级，避免误导 | request.js |

## 14. 相关文档

- [02-web/WEB_FACTS.md](../02-web/WEB_FACTS.md) —— Web 端事实与 6 页面矩阵
- [04-backend/BACKEND_FACTS.md](../04-backend/BACKEND_FACTS.md) —— 后端事实与 41 端点
- [01-project-facts/FEATURE_STATUS_MATRIX.md](../01-project-facts/FEATURE_STATUS_MATRIX.md) —— 功能状态矩阵
- [01-project-facts/PROJECT_MASTER_FACTS.md](../01-project-facts/PROJECT_MASTER_FACTS.md) —— 项目主事实
