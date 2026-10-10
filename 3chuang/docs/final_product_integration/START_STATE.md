# 最终真实产品级联调启动状态

检查时间：2026-07-01  
工作目录：`D:\cixing\3chuang`

## 当前分支

`final-real-product-integration`

说明：已按本轮要求切换到安全分支。当前工作区存在大量既有未提交变更，本轮不回滚、不清理、不覆盖与本任务无关的改动。

## 当前未提交改动

启动时工作区已有未提交变更共 `76` 项：

| 类型 | 数量 |
|---|---:|
| Modified | 10 |
| Deleted | 50 |
| Untracked | 16 |

代表性现状：

- `backend/routes/vlm.js`、`backend/routes/compliance.js`、`backend/services/VLMCargoService.js`、`backend/services/RegulationRAGService.js` 等为当前工作区已有文件。
- `web-dashboard/`、`docs/`、`tools/` 当前包含大量未跟踪或既有改动。
- 多个历史文档、报告和测试文件处于删除状态。
- 本轮联调产物目录：`docs/final_product_integration/`。

## 启动命令

后端启动命令：

```powershell
cd D:\cixing\3chuang\backend
npm start
```

前端启动命令：

```powershell
cd D:\cixing\3chuang\web-dashboard
npm run dev
```

前端构建命令：

```powershell
cd D:\cixing\3chuang\web-dashboard
npm run build
```

截图/验收建议使用预览命令：

```powershell
cd D:\cixing\3chuang\web-dashboard
npm run preview -- --port 4174
```

## 访问地址

- 前端开发地址：`http://127.0.0.1:5173/`
- 前端预览地址：`http://127.0.0.1:4174/`
- 后端地址：`http://127.0.0.1:3000/api`
- 后端健康检查：`http://127.0.0.1:3000/api/health`

## 当前环境变量名

已检测到的相关变量名：

- `AI_API_KEY`
- `AI_API_ENDPOINT`
- `AI_MODEL`
- `DEEPSEEK_MODEL`
- `AI_TIMEOUT_MS`
- `SILICONFLOW_API_KEY`
- `SILICONFLOW_API_ENDPOINT`
- `SILICONFLOW_VLM_MODEL`
- `VLM_TIMEOUT_MS`
- `VLM_MAX_ATTEMPTS`

未配置的别名：

- `DEEPSEEK_API_KEY`
- `VLM_MODEL`

说明：当前项目沿用既有 `AI_API_KEY` 作为 DeepSeek 调用 key；不在任何报告中输出 key 值。VLM 已统一使用 `SILICONFLOW_VLM_MODEL`。

## 当前模型

- DeepSeek 模型：`deepseek-v4-flash`
- VLM 模型：`Qwen/Qwen3-VL-32B-Instruct`
- AI 超时：`30000ms`
- VLM 超时：`45000ms`
- VLM 最大尝试次数：`2`

## 当前已知问题

- 历史报告中曾记录真实装箱结果与设计稿指标不一致：真实接口可能返回已装入 `221`、未装入 `0`、空间利用率约 `84.51%`，而设计稿展示 `221` 件与 `84.51%`。
- 历史报告中曾记录真实 AI 合规结果与设计稿指标不一致：真实接口可能返回 `本地规则 WARNING / AI建议 PASS / 人工复核独立`，而设计稿展示 `本地规则 WARNING / AI建议 PASS / 人工复核独立`。
- `DEEPSEEK_API_KEY` 别名未配置，但既有 `AI_API_KEY` 已配置并用于 DeepSeek V4 Flash。
- 当前 `.env` 中 `VLM_TIMEOUT_MS` 为 `45000ms`，高于推荐的 `30000ms`；这不会造成假成功，但后续 VLM 报告需记录实际超时配置。
- 需要继续真实验证 Qwen3-VL-32B、DeepSeek V4 Flash、RAG、装箱、3D、报告导出和 E2E 全链路。
- 当前工作区已有大量历史改动，后续必须保持 diff 可控。

## 当前截图路径

- 截图目录：`docs/final_product_integration/screenshots/`
- VLM 图片目录：`docs/final_product_integration/test-assets/vlm-online/`
- 下载文件目录：`docs/final_product_integration/downloads/`

## Playwright 准备状态

- `npx` 已可用：`D:\nvm\nodejs\npx.cmd`
- 后续截图和 E2E 将使用 Playwright/浏览器脚本输出到 `docs/final_product_integration/screenshots/`。
