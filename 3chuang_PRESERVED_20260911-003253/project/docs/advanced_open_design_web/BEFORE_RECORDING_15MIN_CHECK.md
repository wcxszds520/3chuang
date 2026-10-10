# Before Recording 15min Check

## 服务

- 启动后端。
- 启动前端：`cd web-dashboard && npm run preview -- --port 4174`。
- 打开 `http://127.0.0.1:4174/#dashboard`。

## 构建

- 执行：`cd web-dashboard && npm run build`
- 结果必须 PASS。

## 外部服务

- VLM 真实上传一张货物图片。
- DeepSeek 合规审计真实点击一次。
- RAG 法规详情真实打开一次。

## 页面

- 工作台：221/221、84.51%、本地规则 WARNING / AI建议 PASS / 人工复核独立。
- 货物页：VLM 上传区、AI 属性体检可见。
- 柜型页：40HQ 推荐解释可打开。
- 3D 页：canvas 非空，四个视角可切换。
- 合规页：合规矩阵、法规证据、人工复核状态一致。
- 报告页：预览报告可打开，JSON 可下载。

## 不要点击

- 未配置密钥时，不要现场点击实时 VLM 或 AI 深度审计。
- 不要展示 PDF/ZIP/XLSX 假下载。

结论检查：全部通过后再录屏。
