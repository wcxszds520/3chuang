# 前端核心按钮真实测试

生成时间：2026-06-30T18:09:22.870Z

## 结论

Playwright 最终结果：49/49 通过，失败 0。6 个按钮为 `NOT_PRESENT`，不进入视频，不保留可点击假动作。

| 页面 | 按钮 | 结果 | 接口数 | 文件 |
| --- | --- | --- | --- | --- |
| 工作台首页 | 维护 SKU | PASS | 0 | - |
| 工作台首页 | 继续合规复核 | PASS | 2 | - |
| 工作台首页 | 查看 3D 作业孪生 | PASS | 0 | - |
| 工作台首页 | 预览装柜报告 | PASS | 0 | - |
| 工作台首页 | 查看风险详情 | PASS | 2 | - |
| 工作台首页 | 查看法规证据 | PASS | 2 | - |
| 货物录入页 | 导入 CSV | PASS | 0 | docs/final_product_integration/test-assets/demo-cargo-import.csv |
| 货物录入页 | VLM 上传识别 | PASS | 1 | docs/final_product_integration/test-assets/vlm-online/pallet_wood.jpg |
| 货物录入页 | 重试识别 | NOT_PRESENT / 不进入视频 | 0 | - |
| 货物录入页 | 添加到订单 | PASS | 0 | - |
| 货物录入页 | AI 校验属性 | NOT_PRESENT / 不进入视频 | 0 | - |
| 货物录入页 | 重置为标准订单数据 | PASS | 0 | - |
| 货物录入页 | 继续 | PASS | 0 | - |
| 柜型推荐页 | 20GP | PASS | 0 | - |
| 柜型推荐页 | 40GP | PASS | 0 | - |
| 柜型推荐页 | 40HQ | PASS | 0 | - |
| 柜型推荐页 | 查看推荐解释 | PASS | 0 | - |
| 柜型推荐页 | 关闭 | PASS | 0 | - |
| 柜型推荐页 | 生成装柜方案 | PASS | 0 | - |
| 3D 作业孪生页 | 播放 | PASS | 1 | - |
| 3D 作业孪生页 | 暂停 | PASS | 0 | - |
| 3D 作业孪生页 | 重置 | PASS | 0 | - |
| 3D 作业孪生页 | 总览 | PASS | 0 | - |
| 3D 作业孪生页 | 门端 | PASS | 0 | - |
| 3D 作业孪生页 | 俯视 | PASS | 0 | - |
| 3D 作业孪生页 | 侧视 | PASS | 0 | - |
| 3D 作业孪生页 | 定位当前货物 | NOT_PRESENT / 不进入视频 | 0 | - |
| 3D 作业孪生页 | 确认完成 | PASS | 0 | - |
| 3D 作业孪生页 | 跳过此步 | PASS | 0 | - |
| 3D 作业孪生页 | 查看算法依据 | PASS | 0 | - |
| 3D 作业孪生页 | 关闭 | PASS | 0 | - |
| 3D 作业孪生页 | 进入合规预审 | PASS | 2 | - |
| 3D 作业孪生页 | 全屏 | PASS | 0 | - |
| 合规预审页 | AI 深度审计 | PASS | 0 | - |
| 合规预审页 | 标记当前项已复核 | PASS | 0 | - |
| 合规预审页 | 生成整改清单 | NOT_PRESENT / 不进入视频 | 0 | - |
| 合规预审页 | 完成复核并导出 | PASS | 1 | - |
| 合规预审页 | 返回 3D 作业孪生 | NOT_PRESENT / 不进入视频 | 0 | - |
| 合规预审页 | SOLAS VGM 要求 | PASS | 1 | - |
| 合规预审页 | 关闭 | PASS | 0 | - |
| 报告导出页 | 返回复核 | PASS | 2 | - |
| 报告导出页 | 预览报告 | PASS | 0 | - |
| 报告导出页 | 下载 HTML 报告 | PASS | 0 | docs/final_product_integration/downloads/甬柜易算装柜与合规报告-NB2026-DEMO-01.html |
| 报告导出页 | 关闭 | PASS | 0 | - |
| 报告导出页 | 下载 HTML | PASS | 0 | docs/final_product_integration/downloads/甬柜易算装柜与合规报告-NB2026-DEMO-01.html |
| 报告导出页 | 下载 CSV | PASS | 0 | docs/final_product_integration/downloads/法规证据清单-NB2026-DEMO-01.csv |
| 报告导出页 | 下载 JSON | PASS | 0 | docs/final_product_integration/downloads/甬柜易算演示数据-NB2026-DEMO-01.json |
| 报告导出页 | 全屏查看 | PASS | 0 | - |
| 报告导出页 | 更新导出设置 | NOT_PRESENT / 不进入视频 | 0 | - |
