# 第三阶段限制与执行说明

这些限制未被包装成“未来优化”，也不影响 40 项第三阶段硬门槛的通过结论。

## 产品边界

1. 三份法规 PDF 是本地生成、明确标注的结构化演示资料包。它们是真实可下载、可翻页的 PDF 文件，用于验证文档/页码/高亮/摘录联动；不是 IMO、UNECE 或 IPPC 官方签发原文，也不构成法律意见。
2. 联网法规详情是二级参考层，可能受网络与远端接口影响；确定性规则和本地 PDF 证据不依赖它。
3. 后端 AI 审计与 VLM 识别依赖本机配置的外部服务。产品会如实显示 loading/error/ready，并在失败时保留本地规则、当前表单和重试入口。
4. 3D 工人与叉车使用程序化低多边形几何，不是高精度 glTF。当前质量目标是角色可辨识、动作语义、门洞路径、碰撞、连续性与性能。
5. 报告真实支持 HTML、CSV、JSON；浏览器“打印/另存 PDF”不冒充后端 PDF 下载。

## 工作树边界

- 第三阶段开始前已有 81 个 `git status --porcelain` 顶层状态项；最终为 85 项。
- `web-dashboard/`、`docs/`、`tools/`、`output/` 在基线时整体为 untracked，Git 无法对这些目录给出逐行的“本轮新增 vs 用户既有”归因。
- 最终仍有 50 个 tracked deletion、13 个 tracked modification、22 个 untracked 顶层路径。既有删除未恢复，既有修改未覆盖；未 reset、clean、commit、push。

## 数据库测试事故与恢复

- 在额外运行旧 `backend/__tests__/integration/packing.test.js` 时，发现其 `beforeAll` 含无条件 `DELETE FROM packing_plan`。首次运行已删除 20 条本地历史方案。
- 测试已修为仅登记并删除自身创建的 plan ID；最终 13/13 通过后，测试方案和 `test_cargo` 均为 0。
- MySQL row binlog 已启用。恢复脚本从 `LAPTOP-CIHAKPPT-bin.000114` 的精确事务位置 `114251330..118810050` 解析 20 行、10 列及 20 个有效 JSON，并在单一事务内恢复 20/20。
- 最终读回 23 行：20 条历史恢复方案＋3 条第三阶段正式方案；15 件测试规模方案为 0。证据：`output/playwright/stage3/database-recovery.json`。

## 验收证据边界

- 3D 连续性结论来自状态机纯逻辑测试与浏览器逐帧轨迹，不仅来自截图。
- 视觉结论来自 4 张最终联系表和 8 张原图抽查；检查记录为 `output/playwright/stage3/visual-audit/visual-inspection.json`。
- 失败态中的 500/404/timeout 是脚本主动注入的预期错误；成功门禁对 unexpected errors 单独断言为空。
