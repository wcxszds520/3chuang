# 合规规则矩阵 (COMPLIANCE_RULE_MATRIX)

> 生成时间：2026-07-11
> 适用版本：v3.2.0（High Availability Upgrade）
> 矩阵说明：7 条本地红线 × reportTable 6 维度的覆盖关系，以及每条红线的判定阈值、依据法规、退路风险
> 证据基线：[backend/services/AIComplianceService.js](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js)、[backend/services/NingboPortSafetyEngine.js](file:///d:/cixing/3chuang/backend/services/NingboPortSafetyEngine.js)

---

## 1. 7 条红线概览

| 红线编号 | 红线名称 | 触发后果 | 判定主体 | 法规依据 |
|---|---|---|---|---|
| R1 | 载重红线 | 超重拒收、扣箱 | 后端引擎硬判定 | SOLAS VI/2 VGM 2016 |
| R2 | 重心红线 | 倒箱、装船倾斜 | NingboPortSafetyEngine v25.0 | JT/T 1187-2018、GB 16994.4-2023 |
| R3 | LIFO 红线 | 倒箱费 | FastBlock 硬约束 | CTU Code 2014 |
| R4 | 单证红线 | 查验布控（不一致查验率 60%） | 后端规则 | SOLAS VI/2 VGM 2016 |
| R5 | 危险品红线 | 港口拒收、行政处罚 | 后端规则 | GB 40163-2021、IMDG Code |
| R6 | 木包装红线 | 无 IPPC 标识直接退运 | 后端规则 | ISPM 15、CTU Code 2014 |
| R7 | 混装禁忌红线 | 货损、交叉污染 | 后端规则 | GB 40163-2021、CTU Code 2014 |

## 2. reportTable 6 维度概览

| 维度编号 | 维度名称 | 数据来源 | 判定方式 |
|---|---|---|---|
| D1 | VGM 重量验证 | 后端硬计算 | 相对误差≤5% 且绝对误差≤1吨 |
| D2 | 载重与限值 | 引擎 totalWeight vs 柜型 maxWeight | 后端硬判定 |
| D3 | 物理重心与装载 | 引擎 `_calculateCoG` | 后端硬判定（横向/纵向偏移率） |
| D4 | 单证一致性 | 货物元数据 vs 装箱方案 | 后端比对 |
| D5 | 危险品敏感品合规 | IMDG 类别 + 隔离表 | 后端规则 |
| D6 | 货物混装相容性 | 混装禁忌矩阵 | 后端规则 |

## 3. 7 红线 × 6 维度 覆盖矩阵

> ✅ = 主判定维度　🔄 = 辅助参考维度　— = 不涉及

| 红线 \ 维度 | D1 VGM 重量 | D2 载重限值 | D3 物理重心 | D4 单证一致 | D5 危险品合规 | D6 混装相容性 |
|---|---|---|---|---|---|---|
| **R1 载重红线** | 🔄 | ✅ | — | — | — | — |
| **R2 重心红线** | — | — | ✅ | — | — | 🔄 |
| **R3 LIFO 红线** | — | — | 🔄 | — | — | ✅ |
| **R4 单证红线** | ✅ | — | — | ✅ | — | — |
| **R5 危险品红线** | — | — | — | 🔄 | ✅ | 🔄 |
| **R6 木包装红线** | — | — | — | ✅ | 🔄 | — |
| **R7 混装禁忌红线** | — | — | — | — | 🔄 | ✅ |

### 3.1 矩阵解读

- **R1 载重红线**：主判定在 D2（载重与限值），D1（VGM）作为重量交叉验证
- **R2 重心红线**：主判定在 D3（物理重心），D6（混装）作为配重分布参考
- **R3 LIFO 红线**：主判定在 D6（混装相容性中的顺序维度），D3 辅助验证重心偏移
- **R4 单证红线**：D1（VGM 申报重量）+ D4（单证一致性）双判定
- **R5 危险品红线**：主判定在 D5，D4/D6 辅助
- **R6 木包装红线**：主判定在 D4（单证中的 IPPC 标识字段），D5 辅助
- **R7 混装禁忌红线**：主判定在 D6，D5 辅助

## 4. 红线详细规则表

### R1 载重红线

| 项 | 内容 |
|---|---|
| 维度归属 | D2 载重与限值 |
| 判定公式 | `totalWeight ≤ container.maxWeight` |
| 阈值 | 40HQ 26000kg；NingboPortSafetyEngine v25.0 通用上限 28000kg |
| 判定主体 | 后端引擎硬判定（不依赖 AI） |
| 退路风险 | 超重拒收、扣箱、失信名单 |
| 法规依据 | SOLAS VI/2 VGM 2016（[solas_vgm.json](file:///d:/cixing/3chuang/backend/data/regulations/solas_vgm.json)） |
| 证据 | AIComplianceService `_checkWeight` |

### R2 重心红线

| 项 | 内容 |
|---|---|
| 维度归属 | D3 物理重心与装载 |
| 判定公式 | 横向偏移率 ≤ 5%，纵向偏移率 ≤ 10% |
| 计算入口 | `_calculateCoG` |
| 状态机 | PASS / WARNING / CRITICAL（NingboPortSafetyEngine v25.0） |
| 附加检测 | 重货压易碎检测 |
| 退路风险 | 倒箱、装船倾斜、集装箱变形 |
| 法规依据 | JT/T 1187-2018、GB 16994.4-2023 |
| 证据 | [NingboPortSafetyEngine.js](file:///d:/cixing/3chuang/backend/services/NingboPortSafetyEngine.js) |

### R3 LIFO 红线

| 项 | 内容 |
|---|---|
| 维度归属 | D6 货物混装相容性（顺序子维度） |
| 判定规则 | 后到港货物不得堆叠在先到港货物之上 |
| 判定方式 | FastBlock `_checkLIFOHardConstraint` 硬约束 |
| 数据来源 | demoDataset 3 港序（宁波→汉堡→鹿特丹→安特卫普） |
| 退路风险 | 倒箱费（行业平均 800-2000 元/箱） |
| 法规依据 | CTU Code 2014 |
| 证据 | FastBlock `_checkLIFOHardConstraint` |

### R4 单证红线

| 项 | 内容 |
|---|---|
| 维度归属 | D1 VGM 重量验证 + D4 单证一致性 |
| 判定内容 | VGM 申报重量、品名、件数三一致 |
| VGM 阈值 | 相对误差≤5% 且绝对误差≤1吨 |
| 退路风险 | 查验布控（不一致查验率 60%） |
| 法规依据 | SOLAS VI/2 VGM 2016 |
| 证据 | [AIComplianceService.js:519-533](file:///d:/cixing/3chuang/backend/services/AIComplianceService.js#L519) `_checkDocuments` |

### R5 危险品红线

| 项 | 内容 |
|---|---|
| 维度归属 | D5 危险品敏感品合规 |
| 判定内容 | IMDG 隔离表 + 危险品标签 + 限运品类 |
| 退路风险 | 港口拒收、行政处罚、刑事责任 |
| 法规依据 | GB 40163-2021、IMDG Code |
| 证据 | AIComplianceService `_checkDangerousGoods`、[gb40163.json](file:///d:/cixing/3chuang/backend/data/regulations/gb40163.json) |

### R6 木包装红线

| 项 | 内容 |
|---|---|
| 维度归属 | D4 单证一致性（IPPC 标识字段） |
| 判定规则 | 含木包装货物必须具备 IPPC 标识 |
| 触发后果 | 无标识直接退运 |
| 引入版本 | v3.1 Zero-Fail Logic |
| 法规依据 | ISPM 15、CTU Code 2014 |
| 证据 | AIComplianceService v3.1 |

### R7 混装禁忌红线

| 项 | 内容 |
|---|---|
| 维度归属 | D6 货物混装相容性 |
| 判定矩阵 | 食品/化工、液体/电子、危险品/普货 三类禁忌对 |
| 退路风险 | 货损、交叉污染、连座索赔 |
| 引入版本 | v3.1 Zero-Fail Logic |
| 法规依据 | GB 40163-2021、CTU Code 2014 |
| 证据 | AIComplianceService v3.1 |

## 5. 风险等级与一票否决

| 等级 | 含义 | 处置 |
|---|---|---|
| FAIL | 卡口拒收 | 一票否决，整体结论 FAIL |
| WARNING | 查验布控 | 高风险提示，可放行但需复核 |
| PASS | 合规通过 | 正常放行 |

**一票否决机制**（VERIFIED）：

- 任意维度出现 FAIL → 整体结论 FAIL
- WARNING 不一票否决，但进入 `complianceHistory` 供人工复核参考
- 证据：AIComplianceService v3.0

## 6. CTU 60/50 规则（集重分布）

| 项 | 内容 |
|---|---|
| 规则来源 | CTU Code 2014 |
| 用途 | 集重分布检查（防止局部过载） |
| 判定主体 | 后端引擎 |
| 证据 | AIComplianceService v3.0 |

## 7. 行业数据锚定

| 锚点 | 数值 | 用途 |
|---|---|---|
| 单证不一致查验率 | 60% | WARNING 级别风险提示 |
| 倒箱费区间 | 800-2000 元/箱 | LIFO 违规成本提示 |
| 退运成本 | 货值 30%+ | 木包装违规成本提示 |

> 上述数值为 v3.1 引入的"行业数据锚定"，用于在建议文本中给出量化的退路风险，不参与 PASS/FAIL 判定。

## 8. 法规库覆盖映射

| 红线 | ctu_code | gb40163 | jtt1187 | solas_vgm |
|---|---|---|---|---|
| R1 载重 | 🔄 | — | — | ✅ |
| R2 重心 | 🔄 | — | ✅ | — |
| R3 LIFO | ✅ | — | — | — |
| R4 单证 | — | — | — | ✅ |
| R5 危险品 | 🔄 | ✅ | — | — |
| R6 木包装 | ✅ | — | — | — |
| R7 混装 | ✅ | ✅ | — | — |

> 法规库共 4 份 JSON、17 sections，详见 [COMPLIANCE_FACTS.md §5](./COMPLIANCE_FACTS.md)
