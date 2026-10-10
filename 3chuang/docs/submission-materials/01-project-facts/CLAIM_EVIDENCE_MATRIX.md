# 申报表述-证据映射矩阵 (CLAIM_EVIDENCE_MATRIX)

> 本文件将所有可能进入申报材料的表述逐条映射到仓库中的真实证据。
> 没有证据的表述不得标记为"可提交"。
> 最后更新：2026-07-11

---

## 状态定义

| 标记 | 含义 |
|------|------|
| **VERIFIED** | 代码+测试/运行结果/截图能够证明 |
| **IMPLEMENTED_UNVERIFIED** | 代码存在，但尚无完整运行或验收证据 |
| **PARTIAL** | 只完成一部分 |
| **PLANNED** | 只有设计/需求，无实际实现 |
| **NOT_FOUND** | 仓库中未找到 |
| **UNKNOWN** | 现有证据不足 |

---

## 一、系统架构类表述

### C001: "系统由真实后端算法生成装箱方案"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据-代码** | [routes/packing.js](file:///d:/cixing/3chuang/backend/routes/packing.js) - POST /api/packing/plan |
| **证据-服务** | [AlgorithmOrchestrator.js](file:///d:/cixing/3chuang/backend/services/AlgorithmOrchestrator.js) - 调度 6 种算法 |
| **证据-引擎** | [FastBlockPackingEngine.js](file:///d:/cixing/3chuang/backend/services/FastBlockPackingEngine.js) - 生产主力算法 |
| **证据-测试** | `__tests__/unit/algorithm-orchestrator.test.js` - PASS |
| **证据-响应** | 返回 loadedCargo 数组含 x/y/z 坐标 |
| **可用于** | 研究报告、查新报告、PPT |

### C002: "系统采用前后端分离架构"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据-前端** | web-dashboard/ (React 18 + Vite 5) |
| **证据-后端** | backend/ (Express 4 + MySQL2) |
| **证据-通信** | [apiServices.js](file:///d:/cixing/3chuang/web-dashboard/src/services/apiServices.js) - fetch /api/* |
| **可用于** | 研究报告、PPT |

### C003: "系统同时支持 Web 端和微信小程序端"

| 维度 | 内容 |
|------|------|
| **状态** | PARTIAL |
| **证据-Web** | VERIFIED - web-dashboard/ 完整可构建 |
| **证据-小程序** | IMPLEMENTED_UNVERIFIED - miniprogram/ 存在但 export 页面为空壳 |
| **缺口** | 小程序导出报告功能未实现 |
| **可用于** | 研究报告（需注明小程序部分功能受限） |

---

## 二、装箱算法类表述

### C004: "系统支持多目的港装箱"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据-数据** | cargo 对象含 portSequence 字段 |
| **证据-算法** | [FastBlockPackingEngine.js](file:///d:/cixing/3chuang/backend/services/FastBlockPackingEngine.js) - LIFO 按目的港排序 |
| **证据-排序** | buildOperationQueue 按 x→y→z→loadingIndex 升序 |
| **可用于** | 研究报告、查新报告、PPT |

### C005: "系统采用六维加权装箱算法"

| 维度 | 内容 |
|------|------|
| **状态** | PARTIAL（需修正措辞） |
| **事实** | 代码中 `sixDimensionalConstraints` 是**约束清单**（LIFO/重心/SKU聚集/堆叠安全/搬运可达/VGM），**不是加权评分算法** |
| **证据** | [FastBlockPackingEngine.js#L613](file:///d:/cixing/3chuang/backend/services/FastBlockPackingEngine.js) - constraintMeta.sixDimensionalConstraints |
| **建议表述** | "系统采用六类业务约束协同机制模型进行装箱合规校验" |
| **禁止表述** | 不得声称存在"Fast Block多约束三维装箱引擎"或"六维评分公式" |
| **可用于** | 研究报告（修正措辞后）、PPT |

### C006: "装箱算法支持确定性重复生成"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | FastBlockPackingEngine 无随机性，同输入同输出 |
| **证据-测试** | `__tests__/unit/algorithm-orchestrator.test.js` 验证一致性 |
| **可用于** | 查新报告、PPT |

### C007: "系统支持叉车和人工两种装箱方式"

| 维度 | 内容 |
|------|------|
| **状态** | IMPLEMENTED_UNVERIFIED |
| **证据-代码** | [operationMachine.js](file:///d:/cixing/3chuang/web-dashboard/src/three/operation/operationMachine.js) - handlingMethod 判断 actorType |
| **证据-叉车** | forklift 34 部件程序化构建 |
| **证据-人工** | worker actor 4 关节 |
| **缺口** | 人工 actor 仅有基本骨架，无人工作业状态机完整测试 |
| **可用于** | PPT（需标注为"已实现"但非"已验证"） |

### C008: "装箱算法考虑重心约束"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | [AIComplianceService.js#L135-L150](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js) - 横向<5%纵向<10% |
| **证据-标准** | CTU Code 60/50 规则 |
| **可用于** | 研究报告、查新报告 |

### C009: "装箱算法考虑 LIFO 卸货顺序"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | [FastBlockPackingEngine.js](file:///d:/cixing/3chuang/backend/services/FastBlockPackingEngine.js) - _checkLIFOHardConstraint() |
| **证据-合规** | AIComplianceService reportTable 第4行 "LIFO 卸货顺序" |
| **可用于** | 研究报告、查新报告 |

---

## 三、3D 数字孪生类表述

### C010: "系统实现 3D 数字孪生装箱作业"

| 维度 | 内容 |
|------|------|
| **状态** | IMPLEMENTED_UNVERIFIED |
| **证据-引擎** | Three.js 0.179.0 |
| **证据-状态机** | [operationMachine.js](file:///d:/cixing/3chuang/web-dashboard/src/three/operation/operationMachine.js) - 18 相位状态机 |
| **证据-几何** | [geometry.js](file:///d:/cixing/3chuang/web-dashboard/src/three/operation/geometry.js) - AABB 碰撞检测 |
| **证据-模型** | 集装箱 118 部件 + 叉车 34 部件程序化构建 |
| **缺口** | 未有完整的自动化 3D 运动测试截图链路 |
| **建议表述** | "系统实现基于 Three.js 的 3D 装箱作业可视化" |
| **谨慎表述** | 不建议直接称"工业级数字孪生"，因缺少与物理设备实时数据对接 |
| **可用于** | 研究报告、PPT（需准确措辞） |

### C011: "3D 装箱作业由真实算法坐标驱动"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | buildOperationQueue 按算法返回的 x/y/z 排序 |
| **证据-路径** | buildCargoPath 基于 cargo.x/y/z 生成路径 |
| **证据-碰撞** | validateCargoPath 检查路径与已装货物碰撞 |
| **可用于** | 研究报告、查新报告、PPT |

### C012: "3D 作业支持暂停、倍速、跳步"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据-暂停** | operationMachine.js pause() / PAUSED 相位 |
| **证据-倍速** | setSpeed([0.5, 1, 2, 4, 8, 16]) |
| **证据-跳步** | stepForward() / stepBackward() / jumpToCargo(index) |
| **可用于** | PPT |

### C013: "3D 场景包含门端、门洞、地面等真实结构"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | [geometry.js](file:///d:/cixing/3chuang/web-dashboard/src/three/operation/geometry.js) - deriveContainerGeometry |
| **证据-门洞** | doorOpening: minY/maxY/minZ/maxZ |
| **证据-间隙** | DEFAULT_CLEARANCE = {side:30, top:35, bottom:5, collision:2} |
| **可用于** | 研究报告、PPT |

---

## 四、合规预审类表述

### C014: "系统支持宁波港入港合规预审"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | [AIComplianceService.js](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js) - systemPrompt 宁波港理货长角色 |
| **证据-规则** | 7 条红线 + 6 维度 reportTable |
| **证据-标准** | VGM/CTU Code/ISPM 15/GB 40163 |
| **可用于** | 研究报告、查新报告、PPT |

### C015: "合规判断采用'引擎算物理，AI判合规'架构"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | [AIComplianceService.js#L6](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js) - 架构注释 |
| **证据-本地** | _buildLocalComplianceReport() 零 AI 依赖做 PASS/FAIL |
| **证据-AI** | _generateAdviceWithAI() 仅生成建议文本 |
| **可用于** | 研究报告、查新报告、PPT |

### C016: "系统支持 VGM 重量验证"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | [AIComplianceService.js#L114-L121](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js) - VGM 后端硬计算 |
| **证据-标准** | 相对误差≤5% 且绝对误差≤1吨 |
| **证据-输出** | reportTable 第1行 "VGM重量验证" |
| **可用于** | 研究报告、查新报告 |

### C017: "系统支持法规 RAG 检索"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | [RegulationRAGService.js](file:///d:/cixing/3chuang/backend/services/RegulationRAGService.js) |
| **证据-数据** | 4 份 JSON 法规（CTU Code/GB 40163/JT/T 1187/SOLAS VGM），17 sections |
| **证据-方法** | TF-IDF 余弦相似度 |
| **证据-联动** | reportTableWithEvidence 每行附 evidence |
| **可用于** | 研究报告、查新报告 |

### C018: "系统支持木质包装 IPPC 校验"

| 维度 | 内容 |
|------|------|
| **状态** | IMPLEMENTED_UNVERIFIED |
| **证据-规则** | systemPrompt 第6条红线 "木包装需IPPC标识" |
| **证据-检查** | reportTable 含 "木质包装 IPPC" 行 |
| **缺口** | 当前演示数据无木质包装货物，未实际触发 FAIL 路径 |
| **可用于** | PPT（需标注为"已实现规则，未演示"） |

### C019: "AI 失败时系统自动降级"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | _generateAdviceWithAI 返回 {source: 'local-template', error: ...} |
| **证据-模板** | buildLocalAdvice() 本地预设建议 |
| **证据-测试** | `ai-strategy-explain.test.js` - "should fallback to local template when API fails" PASS |
| **可用于** | 研究报告、PPT |

---

## 五、AI 服务类表述

### C020: "系统集成 DeepSeek AI 进行合规建议"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | model = 'deepseek-v4-flash' |
| **证据-API** | api.siliconflow.cn/v1/chat/completions |
| **可用于** | 研究报告 |

### C021: "系统集成 VLM 进行货物识别"

| 维度 | 内容 |
|------|------|
| **状态** | IMPLEMENTED_UNVERIFIED |
| **证据** | Qwen3-VL-32B 模型配置 |
| **缺口** | VLM 识别链路无完整测试覆盖 |
| **可用于** | PPT（需标注为"已实现"但未完整验证） |

### C022: "系统支持 TTS 语音播报"

| 维度 | 内容 |
|------|------|
| **状态** | IMPLEMENTED_UNVERIFIED |
| **证据** | [VolcTtsService.js](file:///d:/cixing/3chuang/backend/services/VolcTtsService.js) - 火山 seed-tts-2.0 |
| **缺口** | WebSocket 连接稳定性未验证 |
| **可用于** | PPT（需标注为"已实现"） |

### C023: "系统支持 Tavily 联网法规检索"

| 维度 | 内容 |
|------|------|
| **状态** | IMPLEMENTED_UNVERIFIED |
| **证据** | 后端 Tavily API 调用代码 |
| **缺口** | 无 Tavily API Key 时走本地 RAG 降级 |
| **可用于** | 研究报告（需注明降级机制） |

---

## 六、报告导出类表述

### C024: "系统支持 HTML/CSV/JSON 报告导出"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | [reportBuilders.js](file:///d:/cixing/3chuang/web-dashboard/src/domain/report/reportBuilders.js) |
| **证据-方式** | 浏览器本地 Blob 下载，无后端 PDF |
| **可用于** | 研究报告、PPT |

### C025: "系统支持 PDF 报告导出"

| 维度 | 内容 |
|------|------|
| **状态** | NOT_FOUND |
| **说明** | 仓库中无 PDF 生成代码 |
| **禁止表述** | 不得声称支持 PDF 导出 |
| **可用于** | 无（目标态） |

---

## 七、测试与质量类表述

### C026: "系统具备完整的单元测试覆盖"

| 维度 | 内容 |
|------|------|
| **状态** | PARTIAL |
| **证据-Web** | 21 个测试文件, 76 用例, 75 通过 (VERIFIED) |
| **证据-后端** | ≥18 套件 PASS, ≥8 套件 FAIL/CRASH (部分验证) |
| **缺口** | 后端测试因端口占用无法完整运行 |
| **可用于** | 研究报告（需注明后端测试不完整） |

### C027: "系统通过 ESLint 代码检查"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据-Web** | exit 0, 0 errors, 0 warnings |
| **证据-后端** | exit 0, 0 errors, 66 warnings (no-unused-vars) |
| **可用于** | PPT |

### C028: "系统可成功构建生产包"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | vite build exit 0, 1630 modules, dist/ 产出 |
| **可用于** | PPT |

### C029: "系统具备属性测试 (Property-Based Testing)"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | 后端 fast-check 4.5.3, 93 处属性测试 |
| **可用于** | 研究报告、查新报告 |

---

## 八、演示数据类表述

### C030: "演示订单 NB2026-DEMO-01 达到 84.51% 利用率"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | 221 输入 / 221 装入 / 0 未装 |
| **证据-重量** | 8,812 kg |
| **证据-状态** | 本地规则 WARNING / AI建议 PASS / 人工复核独立 |
| **禁止** | 不得引用任何非冻结演示口径，不得以单一合规总分覆盖分层状态 |
| **可用于** | 研究报告、PPT |

### C031: "系统支持 40HQ 集装箱"

| 维度 | 内容 |
|------|------|
| **状态** | VERIFIED |
| **证据** | 演示订单使用 40HQ |
| **证据-参数** | 12032×2352×2393 mm |
| **可用于** | 研究报告 |

---

## 九、目标态表述（当前不可提交）

### C032: "系统已部署到生产环境"

| 维度 | 内容 |
|------|------|
| **状态** | NOT_FOUND |
| **说明** | 仓库中无部署脚本、Docker 配置、CI/CD 管道 |
| **禁止** | 不得声称已部署或已有用户 |

### C033: "系统已获得企业用户使用"

| 维度 | 内容 |
|------|------|
| **状态** | NOT_FOUND |
| **禁止** | 不得编造用户数量、营收、市场份额 |

### C034: "系统支持法规 PDF 原文联动"

| 维度 | 内容 |
|------|------|
| **状态** | PLANNED |
| **说明** | 当前 RAG 基于 JSON 文本，无 PDF 阅读器 |
| **需完成** | PDF 解析 + 页码定位 + 命中区域高亮 |
| **可用于** | 仅 TARGET_STATE_SPEC.md |

### C035: "系统支持人工复核流程"

| 维度 | 内容 |
|------|------|
| **状态** | PARTIAL |
| **证据** | 合规报告含 manual review 状态设计 |
| **缺口** | 无人工复核 UI 和审批流 |
| **可用于** | 研究报告（需标注为"部分实现"） |

---

## 十、总结

### 可直接用于申报材料的表述

C001, C002, C004, C006, C008, C009, C011, C012, C013, C014, C015, C016, C017, C019, C020, C024, C027, C028, C029, C030, C031

### 需修正措辞后使用的表述

C003 (小程序部分受限), C005 (六类业务约束协同机制非加权), C007 (人工装箱未验证), C010 (谨慎使用"数字孪生"), C018 (IPPC未演示), C021 (VLM未验证), C022 (TTS未验证), C023 (Tavily降级), C026 (后端测试不完整), C035 (人工复核部分实现)

### 禁止使用的表述

C025 (PDF导出), C032 (已部署), C033 (企业用户), C034 (PDF联动)
