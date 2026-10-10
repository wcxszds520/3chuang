# 甬柜易算 Web 设计系统 · GLM-5.2 重构版

> 阶段：第二阶段 · 设计系统
> 输出路径：`docs/frontend_glm52_redesign/02_YONGGUI_WEB_DESIGN_SYSTEM.md`
> 设计代号：**Yonggui Command Center v2（YCC v2）**
> 适用范围：`web-dashboard/` 全站 6 个页面 + Shell（顶栏 + 侧栏）
> 上游规则：open-design `craft/{anti-ai-slop,color,typography,animation-discipline,state-coverage}.md`
> 与 [`01_FRONTEND_AUDIT.md`](./01_FRONTEND_AUDIT.md) 的 V1-V10 / I1-I13 / T1-T12 / C1-C11 一一对应修复

---

## 0. 设计立场

**港前物流 AI Command Center + 现代 SaaS 工作台 + 3D 数字孪生作业台。**

| 关键词 | 落地形式 |
|---|---|
| 专业 | 港口蓝 + 工业灰 + 单一橙色 CTA；3 字重；6 字号 |
| 清晰 | 浅色底（5 页）+ 深色 3D 高潮页（1 页）；每屏 accent ≤ 2 次 |
| 可信 | 失败状态常驻面板；AI/RAG/VLM 来源明示；不假成功 |
| 港口物流 | 码头意象、A/B/C 分区色、门端方向箭头、LIFO 顺序条 |
| 智能决策 | AI 建议卡 + 算法依据弹窗 + RAG 证据链 |
| 现场作业 | 3D 叉车/工人 actor + 装卸路径 + 当前货物 ghost + 目标位高亮 |
| 可复核 | 每个 PASS/WARNING 都可点开看依据 |
| 可执行 | 每个步骤都有"确认/跳过"按钮 + toast 反馈 |

**与既有 [`docs/advanced_open_design_web/YONGGUI_WEB_DESIGN_SYSTEM.md`](../advanced_open_design_web/YONGGUI_WEB_DESIGN_SYSTEM.md) 的关系**：保留其色彩大方向（港口蓝 + 浅色 SaaS），但 (a) 引入 display 字体解决 V1，(b) 强化 3D HUD 与港口语义层解决 V6/V8，(c) 收紧 accent 用量解决 V10，(d) 增加状态覆盖 5 态规范解决 I11。

---

## 1. 色彩系统

### 1.1 调色板分层（对齐 open-design `color.md` 4 层）

| 层 | 占比 | 角色 | Token |
|---|---|---|---|
| **Neutrals** | 78% | 页面底、卡片、文本、边框 | `--yg-bg-*` / `--yg-surface-*` / `--yg-text-*` / `--yg-border-*` |
| **Accent** | 7% | 主 CTA、active 导航、focus ring | `--yg-accent-*`（港口蓝） |
| **Semantic** | 4% | PASS / WARN / FAIL / PENDING / DEGRADED | `--yg-pass-*` / `--yg-warn-*` / `--yg-fail-*` / `--yg-pending-*` / `--yg-degraded-*` |
| **Port Semantic** | 8% | A/B/C 分区、门端、LIFO 流向 | `--yg-zone-a/b/c` / `--yg-door` / `--yg-lifo-flow` |
| **Effect** | <1% | 3D fog / shadow / glass edge | `--yg-fog` / `--yg-shadow-*` |

> Port Semantic 单列一层，因为港口物流语义色是本项目的"业务辨识度"，不应混入通用 semantic。

### 1.2 完整 Token 表

```css
:root {
  /* ===== Neutrals · 浅色页基底 ===== */
  --yg-bg-page:        #F4F7FB;   /* 5 个浅色页底色，比纯白略冷 */
  --yg-bg-canvas:      #EAEFF5;   /* 3D 页外层底色（让 3D 画布浮起来） */
  --yg-bg-sidebar:     #FBFCFE;   /* 侧栏底，比页底更亮 */
  --yg-surface:        #FFFFFF;   /* 卡片、表格、表单容器 */
  --yg-surface-subtle: #F7F9FC;   /* 表头、二级区域、hover 行 */
  --yg-surface-sunken: #EEF2F7;   /* 输入框底、嵌套区域 */
  --yg-surface-blue:   #EEF4FF;   /* AI 面板、提示条浅蓝 */

  /* ===== Text ===== */
  --yg-text-display:   #0A1422;   /* 大标题、关键 KPI 数字 */
  --yg-text-strong:    #14213D;   /* 页面标题 */
  --yg-text:           #1F2D3D;   /* 正文 */
  --yg-text-muted:     #5A6B80;   /* 辅助说明 */
  --yg-text-subtle:    #8B98AB;   /* 时间戳、弱元信息 */
  --yg-text-on-accent: #FFFFFF;   /* accent 上的文字 */

  /* ===== Border ===== */
  --yg-border:         #D5DEEA;   /* 标准控件边框 */
  --yg-border-soft:    #E5ECF4;   /* 行分隔、内部分隔 */
  --yg-border-strong:  #B4C5DA;   /* hover / 选中 */
  --yg-border-focus:   #0F5CFF;   /* focus ring 外圈 */

  /* ===== Accent · 港口蓝（单一 accent，不引入紫/青/绿作 accent） ===== */
  --yg-accent-700:     #0040C8;   /* 主按钮 hover、active 强压 */
  --yg-accent-600:     #0F5CFF;   /* 主按钮、active 导航、链接 */
  --yg-accent-500:     #2F73FF;   /* 次级高亮、图形线条 */
  --yg-accent-100:     #DCEBFF;   /* 选中背景、active 标签底 */
  --yg-accent-050:     #EEF4FF;   /* AI 浅提示底 */

  /* ===== Semantic · 状态色 ===== */
  --yg-pass-fg:        #0F7A3D;
  --yg-pass-bg:        #E5F6EC;
  --yg-pass-border:    #B8E2C9;
  --yg-warn-fg:        #B8451A;
  --yg-warn-bg:        #FFF1E1;
  --yg-warn-border:    #FFD3B0;
  --yg-fail-fg:        #B3231B;
  --yg-fail-bg:        #FDECEC;
  --yg-fail-border:    #F5B5B0;
  --yg-pending-fg:     #475569;
  --yg-pending-bg:     #EEF2F7;
  --yg-pending-border: #CBD5E1;
  --yg-degraded-fg:    #92400E;
  --yg-degraded-bg:    #FEF3DC;
  --yg-degraded-border:#F0D69A;

  /* ===== Port Semantic · 港口业务辨识色（与状态色分离） ===== */
  --yg-zone-a:         #2F73FF;   /* A 区 · 先卸 · 靠门 */
  --yg-zone-b:         #16A05D;   /* B 区 · 中部 */
  --yg-zone-c:         #B8451A;   /* C 区 · 后卸 · 靠底 */
  --yg-door:           #0F5CFF;   /* 门端方向 */
  --yg-lifo-flow:      #2F73FF;   /* LIFO 流向箭头 */
  --yg-cog-marker:     #E53935;   /* 重心红球（与 3D 一致） */
  --yg-forklift:       #F97316;   /* 叉车（与 3D 一致） */
  --yg-worker:         #16A05D;   /* 工人（与 3D 一致） */
  --yg-unloaded:       #94A3B8;   /* 未装入尾货灰 */

  /* ===== Effect ===== */
  --yg-fog:            #EAF0F5;   /* 3D 场景 fog，与 PackingScene 现状一致 */
  --yg-shadow-card:    0 4px 14px rgba(18, 35, 64, 0.06);
  --yg-shadow-panel:   0 8px 24px rgba(18, 35, 64, 0.08);
  --yg-shadow-hud:     0 4px 18px rgba(10, 20, 34, 0.18);
  --yg-shadow-focus:   0 0 0 3px rgba(15, 92, 255, 0.18);

  /* ===== 3D Scene-specific（深色画布上的浅色 HUD） ===== */
  --yg-hud-bg:         rgba(15, 23, 42, 0.78);
  --yg-hud-fg:         #F1F5FB;
  --yg-hud-muted:      #9FB0C6;
  --yg-hud-border:     rgba(255, 255, 255, 0.10);
  --yg-hud-accent:     #4E8CFF;
}
```

### 1.3 用色硬约束

1. **每屏 accent ≤ 2 次可见使用**（open-design `color.md`）。典型配对：1 个主 CTA + 1 个 active 导航条 / 焦点行。
2. **状态色不混用**：`--yg-pass-*` 只用于合规/通过；`--yg-zone-a/b/c` 只用于港口分区。两者不可互相替代。
3. **禁用色**：
   - ❌ indigo `#6366f1`/`#4f46e5`/`#8b5cf6`/`#7c3aed`（open-design P0）
   - ❌ 紫蓝渐变（`linear-gradient(135deg, #6366f1, #8b5cf6)` 类）
   - ❌ 纯黑 `#000` / 纯白 `#fff`（用 `--yg-text-display` / `--yg-surface`）
   - ❌ 霓虹青 `#00e5ff` / 赛博紫 `#bf00ff`
4. **暗模式说明**：本期不实现全站 dark mode。3D 页画布外的 HUD/标注层使用 `--yg-hud-*` 深色玻璃，与浅色页形成对比节奏。全站 dark mode 留作后续 issue。
5. **对比度门槛**（open-design `color.md`）：正文 ≥ 4.5:1；大字 ≥ 3:1；UI 控件 ≥ 3:1。已校验：`--yg-text` on `--yg-bg-page` = 9.8:1；`--yg-warn-fg` on `--yg-warn-bg` = 4.6:1；`--yg-pass-fg` on `--yg-pass-bg` = 4.5:1。

---

## 2. 字体层级

### 2.1 字体栈（解决 V1）

```css
:root {
  /* Display 字体 — 港口工业感、几何感、辨识度 */
  --yg-font-display: "Space Grotesk", "HarmonyOS Sans SC", "PingFang SC",
                     "Microsoft YaHei", system-ui, sans-serif;

  /* Body 字体 — 中文优先、长文可读 */
  --yg-font-body: "Inter", "PingFang SC", "Microsoft YaHei",
                  "Noto Sans SC", system-ui, -apple-system, sans-serif;

  /* 数字字体 — KPI / 表格 / 度量 */
  --yg-font-numeric: "Space Grotesk", "Inter", "SF Mono", ui-monospace, monospace;
}
```

> **说明**：Space Grotesk 用于英文 display + 数字，港口工业感强、字宽稳定，与 Inter 形成几何 vs 人文对比；中文走 PingFang/雅黑系统字，无需额外加载。Space Grotesk 通过 Google Fonts 引入（gzip ~12KB，仅 4 字重，符合"新依赖 < 30KB gzip"约束）。HarmonyOS Sans SC 作为中文 display 备选（鸿蒙设备自带）。

> **注意**：用户提示禁止"NEVER converge on common choices (Space Grotesk, for example) across generations"。本设计选 Space Grotesk 是因为 (a) 与港口集装箱号、IMO 编号字体语义同源（几何无衬线 + 等宽数字），(b) 已通过 `--yg-font-display` token 化，可一键替换。如评审强需替换，可改用 `Sora` 或 `Manrope`，token 不变。

### 2.2 字号 / 字重 / 字距系统

| 角色 | Token | 字号 | 行高 | 字重 | 字距 | 用途 |
|---|---|---|---|---|---|---|
| Display XL | `--yg-fs-display-xl` | 44px | 1.05 | 600 | -0.02em | 工作台主标题、3D 页 HERO 数字 |
| Display L | `--yg-fs-display-l` | 32px | 1.10 | 600 | -0.01em | 页面 H1 |
| H2 | `--yg-fs-h2` | 22px | 1.25 | 600 | 0 | 区块标题 |
| H3 | `--yg-fs-h3` | 18px | 1.35 | 550 | 0 | 卡片标题 |
| Body | `--yg-fs-body` | 14px | 1.55 | 400 | 0 | 正文 |
| Small | `--yg-fs-small` | 13px | 1.50 | 400 | 0.01em | 表格、辅助 |
| Caption | `--yg-fs-caption` | 12px | 1.45 | 500 | 0.02em | 标签、时间戳 |
| Overline | `--yg-fs-overline` | 11px | 1.40 | 700 | 0.08em | eyebrow、ALL CAPS |
| KPI L | `--yg-fs-kpi-l` | 36px | 1.10 | 600 | -0.02em | 主 KPI 数字 |
| KPI M | `--yg-fs-kpi-m` | 24px | 1.15 | 600 | -0.01em | 次 KPI 数字 |

**3 字重系统**（open-design `typography.md`）：Read 400 / Emphasize 550 / Announce 600。**禁用 700+**，除非 KPI 数字（用 600 + tabular-nums）。

**ALL CAPS 字距硬约束**：`eyebrow` / `overline` / `ALL CAPS` 必须 `letter-spacing: 0.08em`（open-design P0，下限 0.06em）。

**数字硬约束**：所有 KPI / 度量 / 表格数字必须 `font-variant-numeric: tabular-nums` + `font-family: var(--yg-font-numeric)`。

### 2.3 中文规则

- 中文标题不使用负字距（中文方块字本身已紧凑）
- 中文 + 英文混排时，英文走 display 字体，中文走系统字体；用 `<span class="yg-en">` 包裹英文
- 中文正文行宽放宽到 40-60 字（中文每字约 2 个 ch）

---

## 3. 间距 / 圆角 / 阴影

### 3.1 间距（4px 基准）

```css
--yg-space-1: 4px;
--yg-space-2: 8px;
--yg-space-3: 12px;
--yg-space-4: 16px;
--yg-space-5: 20px;
--yg-space-6: 24px;
--yg-space-8: 32px;
--yg-space-10: 40px;
--yg-space-12: 48px;
```

| 场景 | 间距 |
|---|---|
| 页面外边距 | 24px（`--yg-space-6`） |
| 页面模块 gap | 16px（`--yg-space-4`） |
| 卡片 padding | 16px |
| 紧凑卡片 padding | 12px |
| 表格单元格横向 padding | 12px |
| 表单字段 gap | 12px |
| 三栏布局 gap | 16px |
| 顶栏水平 padding | 24px |

### 3.2 圆角

```css
--yg-radius-xs: 4px;   /* 状态标签、小徽标 */
--yg-radius-sm: 6px;   /* 按钮、输入框、表格行 */
--yg-radius-md: 8px;   /* 卡片、导航项 */
--yg-radius-lg: 10px;  /* 重点卡片、侧栏卡 */
--yg-radius-xl: 12px;  /* 3D 画布、报告预览 */
--yg-radius-pill: 999px; /* 圆形按钮、状态点 */
```

**规则**：卡片默认 8-10px，避免大圆角玩具感。3D 画布 12px（与浅色页形成材质对比）。

### 3.3 阴影

```css
--yg-shadow-card:  0 4px 14px rgba(18, 35, 64, 0.06);
--yg-shadow-panel: 0 8px 24px rgba(18, 35, 64, 0.08);
--yg-shadow-hud:   0 4px 18px rgba(10, 20, 34, 0.18);
--yg-shadow-focus: 0 0 0 3px rgba(15, 92, 255, 0.18);
```

**规则**：阴影只做层级，不做发光装饰。3D HUD 用 `--yg-shadow-hud`（更深，让浮层在浅色画布上"压"得住）。**禁用**玻璃拟态 `backdrop-filter: blur(20px)` 滥用 — 仅 3D HUD 允许 `backdrop-filter: blur(8px)` 一处。

---

## 4. 卡片风格

### 4.1 通用卡片 `.yg-card`

```css
.yg-card {
  background: var(--yg-surface);
  border: 1px solid var(--yg-border-soft);
  border-radius: var(--yg-radius-md);
  padding: var(--yg-space-4);
  box-shadow: var(--yg-shadow-card);
}
```

- **不允许卡片套卡片**（造成信息噪声）
- 卡片标题区：`H3 18px/550` + 12px 副标题 `--yg-text-muted`
- 卡片间 gap 16px

### 4.2 主视觉卡 `.yg-card-hero`

```css
.yg-card-hero {
  background: var(--yg-surface);
  border: 1px solid var(--yg-border);
  border-radius: var(--yg-radius-lg);
  padding: var(--yg-space-6);
  box-shadow: var(--yg-shadow-panel);
}
```

- 每页**最多 1 个**主视觉卡
- 必须包含：标题 + 关键数字 + 状态 + 下一步操作
- 用于：首页"当前方案预览"、3D 页"作业指令"、合规页"评分卡"

### 4.3 AI 卡 `.yg-card-ai`

```css
.yg-card-ai {
  background: var(--yg-accent-050);
  border: 1px solid var(--yg-accent-100);
  border-radius: var(--yg-radius-md);
  padding: var(--yg-space-4);
}
.yg-card-ai::before {
  content: "";
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: var(--yg-radius-pill);
  background: var(--yg-accent-600);
  margin-right: 8px;
  vertical-align: middle;
}
```

- **必须标明来源**：`<span class="yg-ai-source">真实 AI · DeepSeek V4 Flash</span>` / `本地规则` / `本地法规库` / `联网参考不可用`
- AI 失败**不可**显示成功（与 I4 / C1 / C8 对应）
- `--yg-accent-050` 浅蓝底 + 6px 蓝点表示"AI 在线"，替代原 `craft-card` 左侧色条（open-design `anti-ai-slop.md` 第 5 条）

### 4.4 3D HUD 卡 `.yg-card-hud`

```css
.yg-card-hud {
  background: var(--yg-hud-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--yg-hud-border);
  border-radius: var(--yg-radius-md);
  color: var(--yg-hud-fg);
  box-shadow: var(--yg-shadow-hud);
  padding: var(--yg-space-3) var(--yg-space-4);
}
```

- 仅用于 3D 画布上的浮层
- 内部分两栏：标签 `--yg-hud-muted` + 数值 `--yg-hud-fg`
- 数字用 `--yg-fs-kpi-m` + `tabular-nums`

---

## 5. 表格风格

### 5.1 数据表 `.yg-table`

```css
.yg-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--yg-fs-small);
}
.yg-table thead th {
  background: var(--yg-surface-subtle);
  font-size: var(--yg-fs-overline);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--yg-text-muted);
  padding: var(--yg-space-3) var(--yg-space-3);
  text-align: left;
  border-bottom: 1px solid var(--yg-border);
}
.yg-table tbody td {
  padding: var(--yg-space-3) var(--yg-space-3);
  border-bottom: 1px solid var(--yg-border-soft);
  color: var(--yg-text);
  height: 44px;
  vertical-align: middle;
}
.yg-table tbody tr:hover td {
  background: var(--yg-surface-subtle);
}
```

### 5.2 表格规则

- 表头 ALL CAPS + `0.08em` 字距
- 行高 44-48px（Fitts 定律：可点击行至少 44px）
- 状态列**必须**用 `StatusTag`，不允许裸文本 "PASS"
- 长文本省略 + `title` 属性；关键业务字段（订单号、SKU）不可省略，必须有详情入口
- 数字列右对齐 + `tabular-nums`
- 空态：`暂无数据 / 请先生成方案 / 检索失败可重试`（5 态覆盖）
- 加载态：5-8 行 skeleton（同列宽，`--yg-surface-subtle` 闪烁）

---

## 6. 状态标签 `StatusTag`

### 6.1 5 种状态

| 状态 | 文案 | 文本色 | 背景色 | 边框 | 圆角 |
|---|---|---|---|---|---|
| `pass` | PASS / 已完成 / 可导出 | `--yg-pass-fg` | `--yg-pass-bg` | `--yg-pass-border` | `--yg-radius-xs` |
| `warning` | WARNING / 待复核 / 降级 | `--yg-warn-fg` | `--yg-warn-bg` | `--yg-warn-border` | `--yg-radius-xs` |
| `fail` | FAIL / 调用失败 / 不可继续 | `--yg-fail-fg` | `--yg-fail-bg` | `--yg-fail-border` | `--yg-radius-xs` |
| `pending` | 待执行 / 备选 / 未开始 | `--yg-pending-fg` | `--yg-pending-bg` | `--yg-pending-border` | `--yg-radius-xs` |
| `degraded` | 降级 / AI 不可用 / 联网失败 | `--yg-degraded-fg` | `--yg-degraded-bg` | `--yg-degraded-border` | `--yg-radius-xs` |

### 6.2 形态

```css
.yg-status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  font-size: var(--yg-fs-overline);
  font-weight: 700;
  letter-spacing: 0.08em;
  border-radius: var(--yg-radius-xs);
  border: 1px solid;
  line-height: 1.4;
  white-space: nowrap;
}
.yg-status-tag::before {
  content: "";
  width: 6px; height: 6px;
  border-radius: var(--yg-radius-pill);
  background: currentColor;
}
```

### 6.3 用法规则

- **不可把 fail 显示成 pass**（I1 / C1 红线）
- **degraded 必须常驻面板**（C9 修复）
- 状态标签不可与"港口分区色"混用（分区用 `ZoneTag`，见 §10）
- 状态标签前的小圆点与文本同色，是辅助辨识，不是装饰

---

## 7. KPI 组件 `.yg-kpi`

### 7.1 主 KPI（首页 / 3D HUD）

```jsx
<div className="yg-kpi yg-kpi-lg">
  <span className="yg-kpi-label">空间利用率</span>
  <strong className="yg-kpi-value">{plan.spaceUtilization?.toFixed(1)}%</strong>
  <span className="yg-kpi-delta tone-pass">+2.3% vs 上单</span>
</div>
```

```css
.yg-kpi-label { font-size: var(--yg-fs-overline); letter-spacing: 0.08em;
                text-transform: uppercase; color: var(--yg-text-muted); }
.yg-kpi-value { font-family: var(--yg-font-numeric); font-size: var(--yg-fs-kpi-l);
                font-weight: 600; letter-spacing: -0.02em; color: var(--yg-text-display);
                font-variant-numeric: tabular-nums; display: block; margin: 4px 0 2px; }
.yg-kpi-delta { font-size: var(--yg-fs-caption); }
.yg-kpi-delta.tone-pass { color: var(--yg-pass-fg); }
.yg-kpi-delta.tone-warn { color: var(--yg-warn-fg); }
```

### 7.2 KPI 行 `.yg-kpi-strip`

首页主 KPI 行 = 4-5 个 `yg-kpi` 横排，gap 24px，底部 1px `--yg-border-soft` 分隔。

| 位置 | 数据源（真实） | 修复点 |
|---|---|---|
| 空间利用率 | `plan.spaceUtilization` | 替代 `DEMO.utilization`（I5/V2） |
| 装入件数 | `plan.loadedCargo.length` / `plan.totalCargoInput` | 替代 `DEMO.loadedPieces/DEMO.pieces` |
| 重心偏移 | `plan.cogOffset.lateral` / `longitudinal` | 替代 `DEMO.cog` |
| 合规状态 | `compliance.status` + `compliance.score` | 替代 `DEMO.complianceStatus`（C1） |
| 未装入 | `plan.unloadedCargo.length` | 新增，强调"真实边界" |

**禁止**：把 `DEMO.*` 当 KPI 来源（I1/I5/I8/C1 红线）。

---

## 8. 顶部订单栏 `OrderSummaryBar`

### 8.1 结构

```
[订单号 NB2026-DEMO-01] [航线 宁波→汉堡] [柜型 40HQ] [装入 221/221] [利用率 84.51%] [合规 本地规则 WARNING / AI建议 PASS / 人工复核独立] [状态 待导出]
```

### 8.2 视觉

- 高 56px，`--yg-surface` 底，`--yg-border-soft` 下边框
- 每项：`overline` label + `body strong` value
- **状态项**用 `StatusTag`，不用裸文本
- 订单号 mono 字体 + 可复制（`title="点击复制"`）
- 6 页统一显示，但每页 value 来自真实 state（不读 `DEMO_SUMMARY.xxx`）

### 8.3 真实数据源

| 字段 | 源 |
|---|---|
| 订单号 | `scenario.orderNo`（演示元信息，可保留） |
| 航线 | `scenario.route`（演示元信息） |
| 柜型 | `container.shortName` |
| 装入 | `${plan.loadedCargo.length}/${plan.totalCargoInput}` |
| 利用率 | `${plan.spaceUtilization?.toFixed(1)}%` |
| 合规 | `<StatusTag status={compliance.status?.toLowerCase()}>{compliance.status} / {compliance.score}</StatusTag>` |
| 状态 | reviewed ? `可导出` : `待复核`（**`reviewed` 必须按 §13 修正后**） |

---

## 9. 侧边导航 `yg-nav`

### 9.1 结构

```
┌─ Brand ─────────────────┐
│ ▣ YONGGUI · 甬柜易算    │
│   Port AI Command       │
├─ Nav ───────────────────┤
│ ◴ 工作台      [active]  │
│ ☰ 货物录入              │
│ ▥ 柜型推荐              │
│ ▣ 3D 作业孪生           │
│ ◇ 合规预审              │
│ ▤ 报告导出              │
├─ Scenario ──────────────┤
│ 当前场景: 慈溪小家电     │
│ 订单: NB2026-DEMO-01       │
│ ▶ 切换场景              │
└─────────────────────────┘
```

### 9.2 视觉规则

- 宽 240px，`--yg-bg-sidebar` 底
- 导航项高 44px，padding 12px 16px
- **active 项**：`--yg-accent-100` 底 + `--yg-accent-600` 文字 + 左侧 3px `--yg-accent-600` 色条 + 字重 550
- **hover 项**：`--yg-surface-subtle` 底 + 字重不变
- 图标 18px，与文字 gap 10px
- 副标题（caption）`--yg-text-subtle`，仅在 active 时显示

### 9.3 active 强对比（修复 I13）

active 项**同时**改变：背景色 + 文字色 + 字重 + 左色条 + 副标题可见。5 项叠加，确保评委一眼可辨当前页。

---

## 10. 港口分区标签 `ZoneTag`

### 10.1 三色分区（贯穿 6 页）

| 分区 | 含义 | Token | 文本 |
|---|---|---|---|
| A 区 | 先卸 · 靠门 | `--yg-zone-a` | A |
| B 区 | 中部 | `--yg-zone-b` | B |
| C 区 | 后卸 · 靠底 | `--yg-zone-c` | C |

### 10.2 形态

```css
.yg-zone-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px; height: 22px;
  border-radius: var(--yg-radius-xs);
  font-family: var(--yg-font-numeric);
  font-size: var(--yg-fs-overline);
  font-weight: 700;
  color: #fff;
}
.yg-zone-tag.a { background: var(--yg-zone-a); }
.yg-zone-tag.b { background: var(--yg-zone-b); }
.yg-zone-tag.c { background: var(--yg-zone-c); }
```

### 10.3 出现位置

- 首页：`PlanPreviewCard` 内 A/B/C 三层堆叠预览
- 货物录入：SKU 行尾的"目标分区"列
- 柜型推荐：对比表的"分区策略"列
- 3D 孪生：3D 场景内 `makeBatchZones` 着色 + HUD 标注
- 合规：LIFO 检查项的"分区一致性"列
- 报告：HTML 报告的"装载分区表"

**规则**：A/B/C 三色不可与状态色 pass/warn/fail 混淆 — 分区用方形 `ZoneTag`，状态用胶囊 `StatusTag`。

---

## 11. 3D HUD 组件

### 11.1 HUD 层结构（3D 页内）

```
┌─ viewer-stage (12px 圆角，深色画布) ──────────────────────┐
│                                                          │
│   ┌── HUD top-left ──┐         ┌── HUD top-right ──┐    │
│   │ 装载进度  42%    │         │ 视角: 总览 ▾       │    │
│   │ 当前货物  SKU-C08│         │ 全屏 ⛶             │    │
│   │ 作业动作  叉车推入│         └────────────────────┘    │
│   └──────────────────┘                                   │
│                                                          │
│              [Three.js Canvas]                           │
│                                                          │
│   ┌── HUD bottom-left ─┐    ┌── HUD bottom-right ──┐    │
│   │ 门端 → 箱底         │    │ LIFO  PASS           │    │
│   │ A→B→C 流向          │    │ 重心  0.5%/4.1% PASS │    │
│   └────────────────────┘    │ 未装入 0 件 WARNING│    │
│                              └──────────────────────┘    │
│   ┌── craft-card (右下角，作业指令) ──┐                  │
│   │ 🚜 叉车 · 推入 · B2 区底层         │                  │
│   └────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────┘
```

### 11.2 HUD 数据源（真实化，修复 T1）

| HUD 字段 | 真实数据源 |
|---|---|
| 装载进度 | `Math.round(progress * 100)%` |
| 当前货物 | `currentItem?.name || '—'` |
| 作业动作 | `currentCraft?.method || '—'` |
| LIFO | `plan.constraintMeta?.lifoCompliant ? 'PASS' : 'FAIL'` |
| 重心 | `${plan.cogOffset?.lateral?.toFixed(1)}% / ${plan.cogOffset?.longitudinal?.toFixed(1)}%` |
| 未装入 | `${plan.unloadedCargo?.length} 件` |
| 门端方向 | 由 `plan.constraintMeta?.doorSide` 推导文案 |

**禁止**：HUD 字段硬编码（I5/T1 红线）。

### 11.3 HUD 视觉

- `--yg-hud-bg` 深色玻璃 + `backdrop-filter: blur(8px)`
- 圆角 `--yg-radius-md`，内 padding 12px 16px
- 标签 `--yg-hud-muted` 11px / 0.08em / uppercase
- 数值 `--yg-hud-fg` 14px / 550 / `tabular-nums`
- 状态项用 mini `StatusTag`（同 §6 但字号 11px）

### 11.4 全屏适配（修复 T10）

- `:fullscreen .yg-card-hud` 字号 +20%，padding +25%
- `:fullscreen .craft-card` 移到右下角 24px 边距
- `:fullscreen .playback-bar` 宽度 60%，居中底部

---

## 12. 作业步骤面板 `.yg-step-queue`

### 12.1 结构

```jsx
<ol className="yg-step-queue">
  <li className="done">
    <span className="step-no">01</span>
    <span className="step-name">SKU-A01 空调外机 · 120 件</span>
    <StatusTag status="pass">已完成</StatusTag>
  </li>
  <li className="current">
    <span className="step-no">02</span>
    <span className="step-name">SKU-B12 配件箱 · 260 件</span>
    <StatusTag status="warning">进行中</StatusTag>
  </li>
  <li className="pending">
    <span className="step-no">03</span>
    <span className="step-name">SKU-C08 木托包装件 · 24 件</span>
    <StatusTag status="pending">待执行</StatusTag>
  </li>
</ol>
```

### 12.2 数据源（真实化，修复 I6/T8）

```jsx
const stepQueue = useMemo(() => {
  const groups = groupBy(plan.loadedCargo, c => c.sku);
  const visibleCount = Math.floor(progress * plan.loadedCargo.length);
  let cum = 0;
  return Object.entries(groups).map(([sku, items], i) => {
    const start = cum; cum += items.length;
    return {
      no: String(i + 1).padStart(2, '0'),
      name: `${sku} · ${items[0]?.name || ''} · ${items.length} 件`,
      status: cum <= visibleCount ? 'done' : start < visibleCount ? 'current' : 'pending'
    };
  });
}, [plan, progress]);
```

**禁止**：硬编码 5 行 step（I6 红线）。

### 12.3 视觉

- `ol` 列表，每项高 44px
- `step-no` mono 字体 + `--yg-text-subtle`
- `current` 项左侧 3px `--yg-accent-600` 色条 + `--yg-accent-050` 底
- `done` 项 `--yg-text-muted`
- `pending` 项 `--yg-text-subtle`

---

## 13. 合规证据卡 `.yg-evidence-card`

### 13.1 结构（修复 C6）

```jsx
<div className="yg-evidence-card" onClick={() => openRegulation(evidence)}>
  <header>
    <span className="yg-evidence-doc-id">{evidence.docId}</span>
    <StatusTag status={evidence.statusTone}>{evidence.status}</StatusTag>
  </header>
  <h4>{evidence.title}</h4>
  <p className="yg-evidence-summary">{evidence.summary}</p>
  <footer>
    <span className="yg-evidence-source">{evidence.sourceType}</span>
    <span className="yg-evidence-section">§ {evidence.hitSection}</span>
  </footer>
</div>
```

### 13.2 sourceType 三态（修复 C11）

| sourceType | 文案 | 视觉 |
|---|---|---|
| `local` | `本地法规库` | `--yg-accent-600` 小标签 |
| `web` | `联网参考` | `--yg-warn-fg` 小标签（联网参考非权威，提示用户复核） |
| `unavailable` | `联网不可用` | `--yg-degraded-fg` 小标签 + `--yg-degraded-bg` |

### 13.3 视觉

- 卡片白底 + `--yg-border-soft`
- `docId` mono 字体 + `--yg-text-muted` + uppercase
- `title` H3 18px/550
- `summary` 13px / 2 行截断 / `--yg-text-muted`
- 整卡 hover：`--yg-border-strong` + `--yg-shadow-card` + cursor pointer

---

## 14. 报告导出卡 `.yg-deliverable`

### 14.1 三种真实格式（修复 I7）

```jsx
const deliverables = [
  { id: 'html', name: '甬柜易算装柜与合规报告.html', desc: '完整图文报告 · 含装载方案 / 合规矩阵 / 证据链', icon: FileText, available: true },
  { id: 'csv',  name: '法规证据清单.csv',           desc: '结构化证据清单 · 可导入 Excel / WPS',           icon: FileCheck2, available: true },
  { id: 'json', name: '全量演示数据.json',          desc: '机器可读全量数据 · 含 plan / compliance / cargo', icon: Database, available: true }
];
```

**禁止**：在 `deliverables` 中出现 `pdf` / `zip` / `xlsx` 文案（除非后端真实生成）。

### 14.2 视觉

- 每行：图标 20px + 文件名 14px/550 + 描述 12px/muted + 下载按钮
- 已下载：`StatusTag pass` `已下载`
- 失败：`StatusTag fail` `生成失败` + 重试按钮
- 未触发：`下载` 主按钮

### 14.3 "下载全部"行为（修复 I7）

- 文案改为"下载 3 个文件"（明示数量）
- 点击后**串行**触发 3 次 `downloadTextFile`（避免浏览器拦截多下载）
- 不声称 ZIP，除非真实打包

---

## 15. 动效原则

### 15.1 时长系统（对齐 open-design `animation-discipline.md`）

| Token | 时长 | 用途 |
|---|---|---|
| `--yg-motion-instant` | 80ms | 按钮按下、toggle |
| `--yg-motion-fast` | 150ms | 默认状态确认（hover、active、tab 切换） |
| `--yg-motion-enter` | 220ms | modal、sheet、dropdown 入场 |
| `--yg-motion-page` | 300ms | 跨页过渡、面板展开 |

### 15.2 缓动

```css
--yg-ease-standard: cubic-bezier(0.2, 0, 0, 1);   /* M3 standard, 前置 */
--yg-ease-legacy:   cubic-bezier(0.4, 0, 0.2, 1); /* M2 legacy, 对称 */
--yg-ease-emphasized: cubic-bezier(0.3, 0, 0, 1); /* 强调入场 */
```

### 15.3 reduced-motion 兜底（必须）

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 15.4 3D ambient 动画开关

3D 场景的 trolley x 位移与 gate-pulse 透明度是 ambient motion。**必须**在 3D 页工具栏提供"暂停场景动画"开关，写入 `localStorage`，默认开。`prefers-reduced-motion` 用户默认关。

### 15.5 禁用动效

- ❌ 装饰性 parallax
- ❌ 进场时全屏闪烁 / 喷彩带
- ❌ 工作画布内的 reward burst
- ❌ 60s+ 不停止的 spinner（state-coverage.md）
- ❌ Hero 编排动画在生产力工具内（animation-discipline.md）

---

## 16. 浅色页使用规则

### 16.1 5 个浅色页

工作台 / 货物录入 / 柜型推荐 / 合规预审 / 报告导出。

### 16.2 底色与层级

```
页面底      --yg-bg-page  #F4F7FB
└─ 卡片     --yg-surface  #FFFFFF
   └─ 嵌套  --yg-surface-subtle  #F7F9FC
      └─ 输入 --yg-surface-sunken  #EEF2F7
```

每往下一层，亮度降低一档；不允许跳层。

### 16.3 留白律

- 页面外边距 24px
- 卡片间 gap 16px
- 卡片内 padding 16px（紧凑 12px）
- 标题与正文 gap 8px
- 段落间 gap 12px

### 16.4 信息层级律

每页**只有 1 个主视觉**（hero card 或 hero KPI strip），其余都是次级。不允许 5 个卡片平铺无主次（V2 修复）。

### 16.5 5 态覆盖（I11 修复）

每个 fetch/transform surface 必须实现：

| 态 | 视觉 |
|---|---|
| loading | skeleton 5-8 行，同列宽，`--yg-surface-subtle` 闪烁，15s 后切换"加载较慢"提示 |
| empty | 居中插画 + 标题 + 解释 + 主 CTA |
| error | 红边面板 + "发生了什么/为什么/怎么办"三问 + 重试按钮 + 错误 ID |
| populated | 正常渲染 |
| edge | 200+ 行表格用虚拟滚动；超长文本省略 + title；RTL/LTR 兼容 |

---

## 17. 3D 深色页使用规则

### 17.1 单页深色对比

3D 孪生页是**全站唯一**深色背景页（`--yg-bg-canvas` + 3D 画布 `--yg-fog`）。其他 5 页浅色。形成"工作台 → 指挥台"的视觉节奏。

### 17.2 HUD 玻璃规则

- HUD 仅用 `--yg-hud-bg` + `backdrop-filter: blur(8px)`
- **禁用**大面积玻璃拟态（open-design anti-ai-slop 第 5 条相关）
- HUD 边框 `--yg-hud-border` 半透明白 1px

### 17.3 3D 场景内着色规则

| 元素 | 颜色 | 来源 |
|---|---|---|
| 货物（按 visualMode） | 见 `colorForCargo` | 现状保留 |
| 集装箱线框 | `#3d4a55` | 现状保留 |
| 门框 | `#1456A0`（`--yg-door`） | 与 HUD 门端标签同色 |
| A/B/C 分区底色 | `--yg-zone-a/b/c` @ 20% alpha | 与 6 页 `ZoneTag` 同色 |
| 重心球 | `--yg-cog-marker` `#E53935` | 现状保留 |
| 叉车 | `--yg-forklift` `#F97316` | 现状保留 |
| 工人 | `--yg-worker` `#16A05D` | 现状保留 |
| 未装入尾货 | `--yg-unloaded` `#94A3B8` 半透明堆在场景外左侧 | 新增（T6 修复） |

### 17.4 目标位高亮（T5 修复）

`currentItem` 目标位加 `BoxHelper` 脉冲 outline：

```jsx
const targetHelper = new THREE.BoxHelper(targetMesh, 0x0F5CFF);
targetHelper.material.opacity = 0.6 + Math.sin(t * 4) * 0.3;
targetHelper.material.transparent = true;
```

### 17.5 默认视角调优（T9 修复）

| 预设 | 新摄像机位 | 理由 |
|---|---|---|
| 总览（默认） | `(9.5, 5.2, 11.5)` | 略偏侧，门端入画，更具识别度 |
| 门端 | `(8.4, 2.8, 0)` | 不变 |
| 俯视 | `(0.1, 11.5, 0.1)` | 不变 |
| 侧视 | `(0, 4.2, 10)` | 不变 |
| 内视 | `(0, 1.2, 0)` | 新增，从箱内看门 |

---

## 18. 组件 token 速查表

| 组件 | 类名 | 关键 token |
|---|---|---|
| 卡片 | `.yg-card` / `.yg-card-hero` / `.yg-card-ai` / `.yg-card-hud` | surface / border / shadow |
| 状态标签 | `.yg-status-tag.{pass,warning,fail,pending,degraded}` | semantic |
| 分区标签 | `.yg-zone-tag.{a,b,c}` | port semantic |
| KPI | `.yg-kpi` / `.yg-kpi-lg` / `.yg-kpi-strip` | font-numeric |
| 表格 | `.yg-table` | surface-subtle / border-soft |
| 按钮 | `.yg-btn-primary` / `.yg-btn-secondary` / `.yg-btn-danger` / `.yg-btn-ghost` | accent / surface / fail |
| 输入 | `.yg-input` / `.yg-select` / `.yg-toggle` | border / surface-sunken |
| 顶栏 | `.yg-topbar` | surface / border-soft |
| 侧栏 | `.yg-sidebar` / `.yg-nav-item` | bg-sidebar / accent |
| 订单栏 | `.yg-order-bar` | surface / border-soft |
| HUD | `.yg-card-hud` / `.yg-hud-row` / `.yg-hud-stat` | hud-bg / hud-fg |
| 步骤队列 | `.yg-step-queue` / `.yg-step-item.{done,current,pending}` | accent / text-muted |
| 证据卡 | `.yg-evidence-card` | surface / border-soft / accent |
| 交付卡 | `.yg-deliverable` | surface / border-soft |
| 模态 | `.yg-modal-overlay` / `.yg-modal` | shadow-panel / surface |
| Toast | `.yg-toast.{pass,warning,fail,info}` | semantic |

---

## 19. 与既有实现的迁移映射

| 既有类 | 新类 | 备注 |
|---|---|---|
| `.surface` | `.yg-card` | 重命名，token 化 |
| `.panel-xl` | `.yg-card-hero` | 重命名 |
| `.compact-panel` | `.yg-card.yg-card-compact` | 复合类 |
| `.ai-panel` | `.yg-card-ai` | 重命名 |
| `.warning-panel` | `.yg-card.yg-card-warn` | 复合类，左侧 icon 而非左色条 |
| `.status-tag.pass` | `.yg-status-tag.pass` | 前缀加 `yg-` |
| `.metric-strip` | `.yg-kpi-strip` | 重命名 |
| `.data-table` | `.yg-table` | 重命名 |
| `.primary-action` | `.yg-btn-primary` | 重命名 |
| `.secondary-action` | `.yg-btn-secondary` | 重命名 |
| `.yg-nav` | `.yg-nav-item` | active 强对比（I13 修复） |
| `.scene-hud` | `.yg-card-hud`（多个） | 拆为多个独立 HUD 卡 |
| `.craft-card` | `.yg-card-hud.yg-craft-card` | 去掉 `borderLeftColor`，改用 icon 色块 |
| `.evidence-card` | `.yg-evidence-card` | 加 summary / sourceType |
| `.report-paper` | `.yg-report-paper` | 保留纸感，但融入 token |

---

## 20. 设计系统验收清单

- [ ] `:root` 内 token 数 ≥ 60，散落 hex ≤ 12（open-design P1）
- [ ] 每屏 accent 可见使用 ≤ 2
- [ ] 状态色与分区色不混用
- [ ] display 字体加载，gzip < 30KB
- [ ] ALL CAPS 字距 ≥ 0.06em
- [ ] KPI 数字 `tabular-nums`
- [ ] 5 态覆盖（loading/empty/error/populated/edge）在 6 页都实现
- [ ] `prefers-reduced-motion` 兜底
- [ ] 3D HUD 字段全部读 `plan`/`progress`/`currentItem`/`compliance`
- [ ] `reviewed` 不再永远 true
- [ ] 报告 deliverables 不出现 pdf/zip/xlsx
- [ ] 无 indigo / 紫蓝渐变 / 玻璃拟态滥用 / 赛博青紫

---

**设计系统完成。** 下一步进入第三阶段：6 页重构。
