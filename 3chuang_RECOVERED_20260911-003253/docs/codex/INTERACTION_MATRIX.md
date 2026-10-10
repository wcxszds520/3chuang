# 产品交互矩阵

更新时间：2026-07-12。每一项均有单元测试、E2E 行为或截图证据，不以“按钮存在”代替功能验证。

## 六页主流程

| 页面 | 操作 | 真实结果 | 失败/恢复 | 验收证据 |
|---|---|---|---|---|
| 工作台 | 查看当前订单 | 显示 `NB2026-DEMO-01`、10 SKU/221 件、当前后端方案、活动和下一步 | 无方案时显示待生成，不填静态结果 | core `official-demo-loaded`；18 viewport captures |
| 工作台 | 进入下一环节 | 路由切换且滚动回顶部；同一 session 保留 | 页面切换不遗留 overlay | core `order-consistent-six-pages`；visual `overlayCleared` |
| 货物 | 使用/恢复演示模板 | 恢复唯一 10 SKU 官方模板并自动保存 | 损坏 session 显式恢复并提示 | UI `corruptSession`；dataset gate |
| 货物 | 新增/编辑/复制/删除 | 修改真实 session cargo，删除有确认，复制生成唯一 ID | 字段错误定位；关闭后焦点/遮罩恢复 | core `cargo-crud` |
| 货物 | 搜索和五类筛选 | 搜索名称/SKU/港口；港口、港序、作业、属性、批次组合过滤 | 无匹配显示空状态；重置恢复 | core＋final visual |
| 货物 | 批量修改 | 对选中 SKU 应用真实字段修改 | 未选中时禁用或明确原因 | 页面行为测试 |
| 货物 | CSV 导出/导入 | 导出当前 10 SKU；导入前逐行校验并只提交有效行 | 无效行列出原因；不吞错 | core `csv-validation-import` |
| 货物 | 拍照识别 | 后端 VLM 成功后填入草稿 | VLM 失败保留原表单，抽屉可关闭 | core `vlm-truthful-status`；UI `vlmUnavailable` |
| 柜型 | 生成/重算方案 | POST 真实 `/api/packing/generate`；button pending 防重复 | 500/timeout 显示错误和重试，保留本地预演/上一后端方案 | algorithm gate；UI `packing500/packingTimeout` |
| 柜型 | 查看权威算法 | 只读 “Fast Block多约束三维装箱引擎”，无 selector | URL/localStorage 注入仍请求 fast-block | `single-algorithm-gate.json` |
| 柜型 | 切换方案投影 | SKU/港序/风险/作业四种视觉投影 | 不修改坐标、顺序或后端 plan 指纹 | algorithm `projectionViewsPreservePlanFingerprint` |
| 柜型 | 查看尾货 | 当前为 0，显示“全部装入” | 非 0 时打开真实明细，不伪造 | dataset/algorithm gate |
| 3D | 播放/暂停/继续/重置 | machine 沿真实 loadedCargo 连续推进；暂停坐标稳定；重置回 IDLE | 阻断时保持原坐标并给出跳过/返回入口 | stage3 three `pauseEvidence`；UI blocked states |
| 3D | 上一步/下一步/跳件 | 根据真实 machine index 重建场景 | 非法输入受限，不重排队列 | motion E2E |
| 3D | 0.5–16× | 0.5/1/2/4/8/16 全部可选，高倍速仍经过关键状态 | 不使用 teleport | `speed-gate.json`、motion traces |
| 3D | 五个相机视角 | 总览、门端、俯视、侧视、跟随按包围盒适配 | 主体不翻转/裁切 | 17 screenshots；camera tests |
| 3D | 七类筛选 | SKU/批次/港口/港序/actor/状态/风险只改变可见性 | 0 结果显式空态；重置 221；machine 不变 | `filter-gate.json`；UI `threeFilterNoResult` |
| 3D | 分组队列 | 221 条 machine 呈现为 10 组，默认只渲染 12 条 item rows | 展开/跳组保持原 index | three gate `queueEvidence` |
| 3D | 标签模式 | simple 默认≤3 且 overlap 0；detail/debug 可切换 | 标签来自世界坐标投影 | `label-layout-gate.json` |
| 合规 | 浏览 PDF | 左侧实际渲染 3 份×4 页 PDF，支持翻页、缩略图和打开文件 | 页图 404 显示错误并可重试 | compliance gate；UI `pdfMissing` |
| 合规 | 点击规则 | 右侧规则联动正确 PDF、页码、高亮、摘录与理由 | 远端详情为空不影响本地证据 | `evidence-linkage-gate.json`；UI `emptyRegulationDetail` |
| 合规 | 运行 AI 审计 | 显示 loading→ready，AI 解释独立追加历史 | 500 显示 error/重试，本地 WARNING 和 PDF 保留 | compliance states；UI `ai500` |
| 合规 | 人工复核 | 记录复核人、时间、结论、说明；最终来源变为人工 | 不覆盖 AI 历史或法规原文 | compliance `manualConditional/manualRejected` |
| 报告 | 预览 | 使用当前 10 SKU、221/0、COG、合规、证据和人工记录 | 无 plan 时明确待生成 | report gate |
| 报告 | 下载 HTML/CSV/JSON | 生成真实 Blob 文件并回读内容 | builder 失败显示错误；恢复后可真实下载 | report gate；UI `downloadBuildFailure` |
| 报告 | 打印 | 调用浏览器打印/另存 PDF | 不标为后端 PDF 下载 | final visual |

## 统一反馈规则

- Toast：成功/错误 3–5 秒自动消失，可手动关闭。
- Modal/Drawer：关闭按钮、Esc、合理遮罩关闭；关闭后 focus 返回；切页无残留 overlay。
- Async button：pending 时禁用，失败后恢复；重复点击不产生并发方案。
- Error/Empty：错误原因与可恢复动作同屏；无数据不显示伪 PASS。
- Confirm：删除必须确认；取消不改变 session。
- 表格：操作列在 1920、1672、1280 三视口可见，表格自身横向滚动，不扩大 body。

## 主动失败矩阵

`codex_ui_states_e2e.mjs` 主动执行并断言以下 15 项：

1. packing 500；2. packing timeout；3. AI 500；4. PDF 页缺失/重试；5. 法规详情为空；6. VLM unavailable；7. 下载构建失败/恢复；8. session 损坏；9. 3D 无后端方案；10. 3D 筛选无结果/重置；11. 人工缺必要属性；12. 叉车货物不能过门；13. 人工货物超安全边界；14. 浏览器刷新；15. 离开并返回 3D。

全部场景：`noCrash=true`、`noFalseSuccess=true`、`recoverable=true`、`explicit=true`。证据：`output/playwright/ui-states/results.json`。
