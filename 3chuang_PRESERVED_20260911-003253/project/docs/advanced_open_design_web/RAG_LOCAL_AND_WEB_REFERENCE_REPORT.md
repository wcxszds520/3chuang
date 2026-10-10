# RAG Local And Web Reference Report

## 1. 本轮范围

本轮不读取 `.env`，未验证联网检索密钥。Web 页面检查重点是：法规证据是否可见、可点击、失败时是否说明真实原因、是否避免写成“实时联网国标检索”。

## 2. 当前页面表现

- 合规页右侧保留 4 条可点击法规证据：
  - SOLAS VGM 要求
  - CTU Code 装载规范
  - IPPC 木包装要求
  - 单证一致性规则
- 混合 RAG 区域明确写明：本地法规库为主，联网参考只做公开网页补充。
- 当混合检索接口不可用时，页面显示“混合检索接口暂不可用，页面保留可点击法规证据条目”，不伪装为联网成功。

## 3. Playwright 证据

交互 smoke 已通过“查看法规证据弹窗”：

- 结果文件：`docs/advanced_open_design_web/frontend-interaction-results.json`
- 截图：`docs/advanced_open_design_web/screenshots/interaction-regulation-modal.png`

## 4. 设计修复

本轮修复了 before 版本中的冲突：右侧证据列表显示“已匹配”，但混合 RAG KPI 显示本地/联网均为 0。现在改为“页面证据 4 / 联网参考 0 / 缓存未用”，并明确混合检索接口暂不可用。

## 5. 仍需人工复测

有真实 RAG / Tavily / Web 检索配置时，需要复测 `/api/compliance/hybrid-search` 是否返回联网参考。若没有联网能力，录屏文案只说“本地法规证据库 + RAG 检索”，不说“实时联网国标检索”。

结论：RAG 页面体验已适合演示；联网参考能力需人工带密钥复测。
