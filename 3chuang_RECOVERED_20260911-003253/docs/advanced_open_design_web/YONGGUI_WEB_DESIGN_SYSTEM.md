# Yonggui Web Design System

## 1. 定位

设计系统名称：Yonggui Light Logistics AI Workspace  
适用范围：`web-dashboard` 前端页面、真实能力联调截图、报告导出页体验。  
设计基调：浅色物流 SaaS、可复核 AI 工作台、浅色工业 CAD 数字孪生。

## 2. 色彩系统

### 主色

| Token | 值 | 用途 |
|---|---|---|
| `--yg-primary-700` | `#004DE6` | 主按钮 hover、关键高亮。 |
| `--yg-primary-600` | `#0F5CFF` | 主按钮、导航 active、链接强调。 |
| `--yg-primary-500` | `#2F73FF` | 次级高亮、图形线条。 |
| `--yg-primary-100` | `#EAF2FF` | 浅蓝提示条、选中背景。 |
| `--yg-primary-050` | `#F4F8FF` | AI 面板和轻提示背景。 |

### 背景和表面

| Token | 值 | 用途 |
|---|---|---|
| `--yg-bg-page` | `#F5F8FC` | 页面背景。 |
| `--yg-bg-sidebar` | `#F6FAFF` | 左侧导航背景。 |
| `--yg-surface` | `#FFFFFF` | 卡片、表格、表单容器。 |
| `--yg-surface-subtle` | `#F8FAFD` | 表格表头、二级区域。 |
| `--yg-surface-blue` | `#F2F7FF` | AI、下一步提示、浅蓝横条。 |

### 文本

| Token | 值 | 用途 |
|---|---|---|
| `--yg-text-strong` | `#0B1220` | 页面标题、关键数字。 |
| `--yg-text` | `#172033` | 正文。 |
| `--yg-text-muted` | `#5F6E85` | 辅助说明。 |
| `--yg-text-subtle` | `#8A98AD` | 表格备注、时间、弱化元信息。 |

### 边框

| Token | 值 | 用途 |
|---|---|---|
| `--yg-border` | `#DDE6F2` | 标准卡片和控件边框。 |
| `--yg-border-soft` | `#E8EEF6` | 分隔线、表格行线。 |
| `--yg-border-strong` | `#BFD0E7` | hover、选中边界。 |

### 状态色

| 状态 | 文本 | 背景 | 用途 |
|---|---|---|---|
| PASS | `#16A05D` | `#E7F8EE` | 通过、可导出、已完成。 |
| WARNING | `#F97316` | `#FFF1E6` | 预警、需复核、外部服务不可用。 |
| FAIL | `#E53935` | `#FEECEC` | 严重风险、接口失败、不可继续。 |
| PENDING | `#64748B` | `#F1F5F9` | 待执行、备选、未开始。 |
| DEGRADED | `#B45309` | `#FFF7ED` | AI/RAG/VLM 降级但主流程仍可看。 |

## 3. 字体系统

字体栈：

```css
font-family: Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

字号：

| 角色 | 尺寸 | 行高 | 字重 |
|---|---:|---:|---:|
| 页面标题 | 24px | 32px | 800 |
| 区块标题 | 18px | 26px | 700 |
| 卡片标题 | 16px | 24px | 700 |
| 正文 | 14px | 22px | 400 / 500 |
| 表格正文 | 13px | 20px | 400 |
| 标签 / overline | 12px | 16px | 700 |
| 数字 KPI | 28-36px | 1.1 | 800 |

规则：

- 主标题中文为主，英文 eyebrow 只能作为小标签。
- 不使用负字距。
- 表格和按钮文字不得压缩到不可读。
- 数字使用 `font-variant-numeric: tabular-nums`。

## 4. 间距系统

基础间距：4px  
常用间距：4 / 8 / 12 / 16 / 20 / 24 / 32

| 场景 | 间距 |
|---|---:|
| 页面外边距 | 24px |
| 页面模块 gap | 16px |
| 卡片 padding | 16px |
| 紧凑卡片 padding | 12px |
| 表格单元格横向 padding | 12px |
| 表单字段 gap | 10-12px |
| 三栏布局 gap | 16px |
| 顶部栏水平 padding | 24px |

## 5. 圆角系统

| Token | 值 | 用途 |
|---|---:|---|
| `--radius-sm` | 6px | 标签、小按钮、表格徽标。 |
| `--radius-md` | 8px | 输入框、导航项、普通卡片。 |
| `--radius-lg` | 10px | 重点卡片、侧栏卡。 |
| `--radius-xl` | 12px | 3D 画布、报告预览。 |

规则：卡片圆角默认 8-10px，避免大圆角玩具感。

## 6. 阴影系统

| Token | 值 | 用途 |
|---|---|---|
| `--yg-shadow-card` | `0 4px 14px rgba(18, 35, 64, 0.06)` | 普通卡片。 |
| `--yg-shadow-panel` | `0 8px 24px rgba(18, 35, 64, 0.08)` | 主视觉卡、弹窗。 |
| `--yg-shadow-focus` | `0 0 0 3px rgba(15, 92, 255, 0.16)` | focus-visible。 |

规则：阴影只做层级，不做玻璃拟态或发光装饰。

## 7. 卡片规范

普通卡片：

- 背景 `#FFFFFF`
- 边框 `1px solid var(--yg-border-soft)`
- 圆角 8-10px
- padding 16px
- 阴影 `--yg-shadow-card`

主视觉卡：

- 可用更强标题和 12px 圆角。
- 内部必须有明确标题、关键数字、状态、下一步操作。
- 不允许卡片套卡片造成信息噪声。

AI 卡片：

- 背景可用 `--yg-primary-050` 或白底加浅蓝 header。
- 必须标明来源：真实 AI、规则检查、本地法规库、联网参考不可用等。
- AI 失败不可显示成功。

## 8. 按钮规范

主按钮：

- 高度 38-40px。
- 背景 `--yg-primary-600`。
- 白色文字，图标 16-18px。
- hover 使用 `--yg-primary-700`。
- disabled 透明度 0.55，禁止点击。

次按钮：

- 白底、蓝色或深灰文字、浅边框。
- 用于预览、查看依据、返回、切换。

危险按钮：

- 只用于删除或严重操作。
- 不在演示主路径中滥用红色。

按钮行为要求：

- 可点击按钮必须有真实状态变化、真实接口调用、下载、导航、弹窗或 toast 反馈。
- 不能实现的能力必须禁用或移除。
- 下载按钮不得声称 PDF/ZIP/XLSX，除非真实生成对应文件。

## 9. 表格规范

- 表头背景 `--yg-surface-subtle`。
- 表头 12px / 700 / muted。
- 行高 44-48px。
- 单元格 13px / 20px。
- 行分隔 `1px solid var(--yg-border-soft)`。
- 状态列必须使用 `StatusTag`。
- 长文本省略，但关键业务字段不能只显示省略号，应有 title 或详情入口。
- 表格空态应说明“暂无数据 / 请先生成方案 / 检索失败可重试”。

## 10. 表单规范

- label 12-13px，位于输入框上方。
- 输入框高 38px，边框 `--yg-border`，圆角 8px。
- focus 使用港口蓝 focus ring。
- 校验失败显示行内错误，不清空用户输入。
- VLM 自动填表字段应保留人工复核入口。
- 分组：基础信息、尺寸与重量、业务属性、风险属性。

## 11. 状态标签规范

| 组件 | 文案 | 颜色 |
|---|---|---|
| `StatusTag pass` | PASS / 已完成 / 可导出 | 绿色 |
| `StatusTag warning` | WARNING / 待复核 / 降级 | 橙色 |
| `StatusTag fail` | FAIL / 调用失败 / 不可继续 | 红色 |
| `StatusTag pending` | 待执行 / 备选 / 未开始 | 灰色 |

规则：

- 全站不使用 PPC，必须写 IPPC。
- 风险不能只靠颜色表达。
- DeepSeek / VLM / RAG 外部失败使用 WARNING/DEGRADED，不写 PASS。

## 12. 左侧导航规范

- 宽度 224px。
- 背景 `--yg-bg-sidebar`。
- 品牌区高度 52px。
- 导航项高度 54px，图标 18px，标题 14px，说明 12px。
- active 使用港口蓝背景和白字。
- 不增加无关页面。

## 13. 顶部栏规范

- 高度 64px。
- 左侧只放当前订单、航线、柜型和真实装箱摘要。
- 右侧只放通知、设置、用户。
- 禁止堆随机演示按钮。
- 顶部显示值必须和真实结果一致。

## 14. 3D 作业孪生规范

- 背景浅蓝灰 `#EAF0F5`。
- 集装箱用浅色线框、细网格、低饱和货物色。
- 当前货物高亮，风险货物橙色描边。
- 叉车路径使用港口蓝或橙色，人工路径使用低饱和绿色。
- HUD 放在画布内边缘，不遮挡主体。
- 视角切换：总览、门端、俯视、侧视。
- 禁止 Bloom、God Rays、粒子雨、重后处理。
- 禁止改 `plan.loadedCargo`、`containerInfo`、`cog` 结构。

## 15. 报告导出规范

- 允许真实生成：HTML、CSV、JSON。
- PDF 使用“打印 / 另存为 PDF”文案，不写“下载 PDF”。
- 禁止展示没有真实生成的 ZIP/XLSX/PDF 下载。
- 下载文件内容必须包含订单、柜型、装入/未装入、利用率、合规分、IPPC、RAG 证据、AI 合规摘要。
- 页面值和下载文件必须一致。
