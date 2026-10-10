# 甬柜易算最终演示 E2E 验收记录

时间：2026-06-30  
前端：`http://127.0.0.1:5173/`  
后端：`http://127.0.0.1:3000/`  
视口：`1672 x 941`

## 构建结果

- `cd web-dashboard && npm run build`
- 结果：通过
- 产物：`dist/index.html`、`dist/assets/index-Wv4J20nI.js`、`dist/assets/index-NP1TFrv6.css`

## API 真实连通性

- `GET /api/health`：通过，HTTP 200
- `POST /api/packing/generate`：通过，前端点击“生成装柜方案”后进入 `#twin`
- `GET /api/compliance/regulations`：通过，返回 4 个法规文档、17 个章节
- `GET /api/vlm/status`：通过，前端保留真实 VLM 入口，未用静态成功结果伪装识别

## 自动化验收结果

自动化记录：`docs/final_goal/e2e-results.json`

通过项：

1. 工作台首页加载成功
2. 货物录入页加载成功
3. CSV 导入后新增 `SKU-T99`
4. VLM 初始态显示等待上传图片，不展示假识别成功
5. 柜型推荐页加载成功
6. 40HQ 推荐解释弹窗可打开
7. 点击生成装柜方案后调用后端并跳转 3D 页面
8. 3D 作业孪生页加载成功
9. 3D 视角切换可用
10. 算法依据弹窗可打开
11. 作业步骤确认产生真实状态提示
12. 合规预审页加载成功
13. 页面出现 `IPPC` 且未出现 `PPC` 错字
14. RAG 法规依据弹窗可打开
15. 人工复核按钮可将 2 项 WARNING 标记为已复核
16. 报告导出页加载成功
17. HTML 报告预览弹窗可打开
18. JSON 文件下载可触发
19. 报告页无 `PPC` 错字
20. 报告页无假 `PDF / ZIP / XLSX` 下载文案

## 截图产物

- `docs/final_goal/screenshots/dashboard-final.png`
- `docs/final_goal/screenshots/cargo-final.png`
- `docs/final_goal/screenshots/container-final.png`
- `docs/final_goal/screenshots/twin-final.png`
- `docs/final_goal/screenshots/compliance-final.png`
- `docs/final_goal/screenshots/report-final.png`

## 观察到的非应用警告

Headless Chromium 在截图 3D WebGL 页面时输出了软件渲染与 `ReadPixels` 性能警告。该警告来自 Playwright headless 环境的 WebGL 渲染路径：

- 无 React 运行时错误
- 无页面 `pageerror`
- 无 4xx / 5xx 失败响应
- 不影响真实浏览器中的页面操作

## 验收结论

最终演示链路可进入人工验收。核心演示路径已经从“静态视觉还原”提升为“可点击、可复核、可导出的真实前端演示”。
