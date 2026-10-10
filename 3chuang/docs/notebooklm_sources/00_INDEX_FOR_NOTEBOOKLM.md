# 00_INDEX_FOR_NOTEBOOKLM

本文用途：作为 NotebookLM 上传前的总索引，说明每个 Markdown 文件的用途、推荐上传顺序、优先级和生成 PPT 后的人工检查方式。

## 文件用途索引

| 文件 | 用途 |
|---|---|
| `01_PROJECT_OVERVIEW.md` | 项目总览，让 NotebookLM 理解项目是什么 |
| `02_PRESENTATION_STORYLINE.md` | 13 页 PPT 主线结构，直接指导生成演示文稿 |
| `03_FACTS_AND_BOUNDARIES.md` | 真实数据与能力边界，防止乱编和夸大 |
| `04_PRODUCT_PAGES_AND_SCREENSHOTS.md` | 产品截图索引，说明每张截图适合放在哪页 |
| `05_TECH_ARCHITECTURE.md` | 技术架构说明，帮助生成技术页 |
| `06_AI_VLM_RAG_3D_EXPLANATION.md` | 四个亮点解释：VLM、RAG、DeepSeek、Three.js |
| `07_PPT_STYLE_AND_DESIGN_REQUIREMENTS.md` | PPT 视觉风格与设计要求 |
| `08_SPEAKER_SCRIPT_5_MIN.md` | 5 分钟讲稿 |
| `09_JUDGE_QA.md` | 评委问答准备 |
| `10_NOTEBOOKLM_UPLOAD_GUIDE.md` | 上传指南和自定义提示词 |
| `MISSING_FILES.md` | 缺失资料和敏感文件跳过说明 |

## 推荐上传优先级

### 第一优先级

- `01_PROJECT_OVERVIEW.md`
- `02_PRESENTATION_STORYLINE.md`
- `03_FACTS_AND_BOUNDARIES.md`
- `04_PRODUCT_PAGES_AND_SCREENSHOTS.md`
- `07_PPT_STYLE_AND_DESIGN_REQUIREMENTS.md`

### 第二优先级

- `05_TECH_ARCHITECTURE.md`
- `06_AI_VLM_RAG_3D_EXPLANATION.md`
- `08_SPEAKER_SCRIPT_5_MIN.md`
- `09_JUDGE_QA.md`

### 第三优先级

- `10_NOTEBOOKLM_UPLOAD_GUIDE.md`
- `00_INDEX_FOR_NOTEBOOKLM.md`
- `MISSING_FILES.md`

## 如果只能上传部分文件

如果 NotebookLM 只能上传 5 个文件，上传第一优先级的 5 个文件即可。如果还能上传 2 个，补充 `05_TECH_ARCHITECTURE.md` 和 `06_AI_VLM_RAG_3D_EXPLANATION.md`。如果要生成讲稿和答辩问答，再上传 `08_SPEAKER_SCRIPT_5_MIN.md` 和 `09_JUDGE_QA.md`。

## 推荐自定义演示文稿提示词

```text
请基于上传来源，为“甬柜易算”生成 13 页、16:9、适合中国国赛/创赛线上答辩的 PPT。目标不是验收报告，而是国赛作品叙事。页面结构必须遵守：封面、痛点、风险、方案闭环、工作台、VLM 录入、柜型推荐、3D 作业孪生、AI 与规则分工、合规预审与 RAG、真实联调证据、应用价值、收束页。每页一个核心观点、一个主视觉、少量关键点。风格为现代物流 SaaS + 港口数字孪生，清晰、稳重、专业、有科技感。不要廉价模板，不要每页几何卡片堆，不要文字爆炸。必须遵守真实口径：NB2026-DEMO-01、宁波港到汉堡港、40HQ、输入 221、已装入 221、未装入 0 件、空间利用率 84.51%、总重量 8,812 kg、合规 本地规则 WARNING / AI建议 PASS / 人工复核独立、VLM Qwen/Qwen3-VL-32B-Instruct、DeepSeek deepseek-v4-flash、RAG 为本地法规证据库。不要写任何过期演示数字，不要把 AI 建议写成最终结论，也不要写实时联网国标检索、完全自动化、替代人工、全球首创或零风险。第 8 页必须是视觉高潮，第 10 页必须体现合规体检 + 检查矩阵 + 证据链，第 11 页必须是真实链路时间线。
```

## 推荐选择

如果 NotebookLM 让选择生成类型，建议先选择“详细演示文档”，检查事实和结构后，再生成“演示用幻灯片”。如果时间很紧，可以直接选择“演示用幻灯片”，但必须人工复核真实数据和禁用表述。

## 生成 PPT 后如何人工检查

1. 检查是否严格为 13 页。
2. 检查是否有封面、痛点、风险、闭环、工作台、VLM、柜型推荐、3D、AI 分工、合规、真实链路、价值、收束。
3. 检查数字是否为 221、221、0、84.51%、8,812 kg、本地规则 WARNING / AI建议 PASS / 人工复核独立。
4. 检查是否出现禁用表述。
5. 检查第 8 页是否是视觉高潮，不是小截图卡片。
6. 检查第 10 页是否有合规体检、检查矩阵、证据链。
7. 检查第 11 页是否是真实链路时间线。
8. 检查是否把 VLM、RAG、AI 的边界讲清楚。
9. 检查每页是否一个核心观点，不要文字过多。
10. 检查产品截图是否清晰，必要时替换为局部放大截图。
