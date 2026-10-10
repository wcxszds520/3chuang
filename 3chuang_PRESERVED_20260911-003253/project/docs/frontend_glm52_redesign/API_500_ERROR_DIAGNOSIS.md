# API 500 错误诊断报告

> 模型：GLM-5.2 · 日期：2026-07-02 · 环境：Vite dev server (127.0.0.1:5173) 无后端

## 1. 错误清单

Playwright 捕获 8 个 HTTP 500 错误，来自 4 个不同 API 端点：

| # | 请求 URL | 状态码 | 触发页面 | 触发时机 | 调用次数 |
|---|---|---|---|---|---|
| 1 | `/api/tts/status` | 500 | 全局（App 加载） | App 挂载时检查 TTS 可用性 | 1 |
| 2 | `/api/vlm/status` | 500 | 全局（App 加载） | App 挂载时检查 VLM 可用性 | 2 |
| 3 | `/api/compliance/hybrid-search` | 500 | 合规页（ComplianceModule） | ComplianceModule 挂载时查询混合 RAG | 4 |
| 4 | `/api/packing/compliance-check-sync` | 500 | 合规页（AI 审计按钮） | 用户点击"AI 深度审计" | 1 |

## 2. 接口返回与前端影响

### 2.1 `/api/tts/status` (500)

- **接口用途**：检查火山引擎 TTS 语音合成是否可用
- **接口返回**：500 Internal Server Error（后端未启动）
- **前端影响**：TTS 功能标记为不可用，语音播报按钮禁用，不影响主流程
- **前端处理**：`fetchTtsStatus` 捕获异常，设置 `ttsAvailable = false`，不假造可用
- **是否假成功**：否 ✅

### 2.2 `/api/vlm/status` (500)

- **接口用途**：检查 VLM 视觉货物识别服务是否可用
- **接口返回**：500 Internal Server Error
- **前端影响**：VLM 上传区域显示"VLM 服务不可用"，上传按钮禁用
- **前端处理**：`checkVlmStatus` 捕获异常，设置 `vlmAvailable = false`，不假造可用
- **是否假成功**：否 ✅

### 2.3 `/api/compliance/hybrid-search` (500)

- **接口用途**：混合 RAG 法规检索（本地法规库 + 联网参考）
- **接口返回**：500 Internal Server Error
- **前端影响**：RAG 面板"联网参考"区块显示"不可用"，提示"联网参考不可用，已使用本地法规库"
- **前端处理**：`searchHybridRegulations` 的 `.catch()` 设置 `hybridRag.state = 'failed'`，`web_available = false`，`web_error = 'FRONTEND_HYBRID_RAG_FAILED'`
- **V2 改进**：RAG 面板重构为 4 状态区块，"联网参考"独立显示，失败时明确文案"联网参考不可用，已使用本地法规库"
- **是否假成功**：否 ✅（V1 已正确处理，V2 进一步明确显示）

### 2.4 `/api/packing/compliance-check-sync` (500)

- **接口用途**：DeepSeek AI 合规深度审计
- **接口返回**：500 Internal Server Error
- **前端影响**：AI 审计按钮恢复可点击，审计状态设为失败/降级
- **前端处理**：`runAiComplianceAudit` 捕获异常，返回降级描述文本，不假造 PASS
- **是否假成功**：否 ✅

## 3. 错误分类

| 类别 | 端点 | 原因 | 前端降级 |
|---|---|---|---|
| 外部 AI 服务 | `/api/packing/compliance-check-sync` | DeepSeek 后端未启动 | 显示"审计失败/降级" |
| 联网 RAG 服务 | `/api/compliance/hybrid-search` | RAG 后端未启动 | 显示"联网参考不可用" |
| VLM 服务 | `/api/vlm/status` | VLM 后端未启动 | 显示"VLM 不可用" |
| TTS 服务 | `/api/tts/status` | TTS 后端未启动 | 显示"TTS 不可用" |

## 4. 假成功检查

| 端点 | 失败时前端显示 | 假成功？ |
|---|---|---|
| TTS status | TTS 不可用，语音按钮禁用 | 否 |
| VLM status | VLM 不可用，上传禁用 | 否 |
| Hybrid RAG | "联网参考不可用，已使用本地法规库" | 否 |
| AI Compliance | "审计失败/降级"，不显示 PASS | 否 |

## 5. 结论

8 个 500 错误全部为后端服务未启动导致（前端独立运行模式）。4 个端点的前端降级处理均正确，无假成功。联网 RAG / AI / VLM / TTS 外部服务失败时，前端真实显示"不可用/待复核"，不伪造成功状态。

V2 改进：ComplianceModule RAG 面板重构为 4 状态区块后，"联网参考不可用"的显示更加明确，与"本地法规库可用"清晰区分。
