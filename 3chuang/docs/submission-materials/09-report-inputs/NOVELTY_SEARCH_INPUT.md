# 查新报告参考资料 (NOVELTY_SEARCH_INPUT)

> 生成时间：2026-07-11
> 用途：甬柜易算项目科技查新报告撰写的参考素材
> 事实基准：PROJECT_MASTER_FACTS.md（2026-07-11 调查基线，分支 codex/sol）
> 撰写原则：所有创新点与查新点必须有代码证据支撑，不得虚构外部文献，不得使用宣传语

---

## 1. 项目标准名称

- 中文标准名称：甬柜易算 [已验证]
- 英文/技术名称：Ningbo Port Intelligent 3D Packing System [已验证]
- 项目定位：面向宁波港出口中小卖家的港前装柜智能决策系统 [已验证]
- 项目边界：港前（Pre-Port）装柜决策，非港口 TOS、非码头作业系统、非运输路线规划、非报关单证系统 [已验证]

---

## 2. 项目真实能力边界

### 可以查新的能力 [已验证]
1. 确定性装箱算法（FastBlock 块优先 + Realistic4D v34.7）生成三维坐标方案
2. 六类业务约束协同机制（LIFO/重心/SKU聚集/堆叠安全/搬运可达/VGM）的装箱约束体系
3. 18 相位状态机驱动的 3D 装柜作业过程可视化（真实坐标驱动，程序化构建）
4. "引擎算物理、AI 判合规"的零幻觉合规架构（AI 仅写建议，不判定结论）
5. 基于 TF-IDF 余弦相似度的本地法规 RAG 检索（零外部依赖）
6. VGM 后端硬计算（相对误差≤5% 且绝对误差≤1 吨）
7. 三层合规证据链（本地规则→AI建议→人工复核，不可静默覆盖）
8. 多目的港 LIFO 卸货顺序硬约束
9. HTML/CSV/JSON 报告浏览器本地导出
10. Web + 后端 + 微信小程序三端覆盖

### 不能查新的能力（未完成/不存在）[已验证]
1. 工业级数字孪生（无实时数据回传、无双向控制）[已验证]
2. 物理仿真（3D 是作业过程可视化，非物理仿真）[已验证]
3. 后端 PDF 生成（当前仅浏览器打印）[已验证]
4. 实时联网法规检索（依赖 TAVILY_API_KEY，无 Key 时不可用）[已验证]
5. AI 全自动装箱（AI 仅写建议，算法是确定性的）[已验证]
6. Fast Block多约束三维装箱引擎（实际是六类业务约束协同机制清单，非加权评分算法）[已验证]
7. 企业落地/部署量/营收（NOT_FOUND）[已验证]

---

## 3. 建议查新目的

**查新目的**：查证"面向宁波港出口中小卖家的港前装柜智能决策系统"所采用的以下技术方案在国内外公开文献与专利中是否已有相同或类似实现：

1. 基于块优先（FastBlock）的确定性三维装箱算法在六类业务约束协同机制下的应用
2. "引擎算物理、AI 判合规"的零幻觉合规审核架构
3. 18 相位状态机与真实坐标驱动的 3D 装柜作业过程可视化
4. 基于 TF-IDF 余弦相似度的本地法规 RAG 检索在港口合规场景的应用
5. 三层合规证据链（本地规则→AI建议→人工复核）的不可静默覆盖机制
6. 多目的港 LIFO 卸货顺序硬约束的装箱算法实现

[已验证]

---

## 4. 建议创新要点（5-6 个，基于代码证据）

### 创新要点 1：Fast Block多约束三维装箱引擎的六类业务约束协同机制确定性输出 [已验证]
- 代码证据：[backend/services/FastBlockPackingEngine.js:613] `sixDimensionalConstraints`
- 技术实质：在 LIFO 卸货顺序、动态重心、同 SKU 聚集、堆叠与重不压轻安全、叉车/人工搬运可达性、VGM 总重合规六个维度硬约束下，通过块优先（Block-Priority）策略确定性生成三维装箱方案
- 创新性：六个约束维度以硬约束形式（非加权评分）集成在块优先装箱算法中，保证相同输入相同输出
- 边界：是六类业务约束协同机制清单，非"Fast Block多约束三维装箱引擎"

### 创新要点 2："引擎算物理、AI 判合规"的零幻觉合规架构 [已验证]
- 代码证据：[backend/services/AIComplianceService.js:6] `"引擎算物理，AI 判合规"`
- 技术实质：装箱物理决策由确定性算法生成，合规审核由本地规则引擎判定 PASS/FAIL，AI（DeepSeek V4 Flash）仅撰写建议文本，不判定结论
- 创新性：从架构上杜绝 AI 在合规判定中的幻觉风险，AI 不可覆盖本地规则结论
- 边界：AI 失败时本地模板降级，不伪造 AI 结论

### 创新要点 3：18 相位状态机与真实坐标驱动的 3D 装柜作业过程可视化 [已验证]
- 代码证据：[web-dashboard/src/three/operation/operationMachine.js]、[web-dashboard/src/three/TwinScene.jsx]
- 技术实质：18 相位状态机（IDLE→OPENING_DOORS→...→COMPLETED/PAUSED/BLOCKED），程序化构建 118 部件集装箱+34 部件叉车+4 关节人工 actor，真实坐标驱动，AABB 碰撞检测 tolerance=2mm
- 创新性：区分叉车与人工两种作业 actor，9 段路径（home→waiting→...→target），4 相机预设+follow 模式
- 边界：是作业过程可视化，非物理仿真、非工业数字孪生

### 创新要点 4：基于 TF-IDF 余弦相似度的本地法规 RAG 检索 [已验证]
- 代码证据：[backend/services/RegulationRAGService.js]、[backend/data/regulations/*.json]
- 技术实质：4 份法规 JSON（CTU Code / GB 40163-2021 / JT/T 1187-2018 / SOLAS VGM）共 17 sections，TF-IDF 余弦相似度本地检索，零外部依赖
- 创新性：无需联网即可在港口合规场景下检索法规条款，配合 7 红线本地规则联动
- 边界：联网检索（Tavily）依赖 Key，非实时联网

### 创新要点 5：VGM 后端硬计算与三层合规证据链 [已验证]
- 代码证据：[backend/services/AIComplianceService.js]、[web-dashboard/src/pages/workflows/CompliancePage.jsx]
- 技术实质：VGM 后端硬计算（相对误差≤5% 且绝对误差≤1 吨），三层合规证据链（本地规则→AI建议→人工复核），MANUAL_REVIEW action 追加到 complianceHistory 不可静默覆盖，finalConclusion 优先人工→本地规则
- 创新性：合规审核结果可审计、不可篡改，人工复核与 AI 建议并存
- 边界：AI 仅写建议，最终结论由本地规则与人工复核决定

### 创新要点 6：多目的港 LIFO 卸货顺序硬约束 [已验证]
- 代码证据：[backend/services/FastBlockPackingEngine.js] `_checkLIFOHardConstraint`
- 技术实质：针对多目的港（演示订单含汉堡→鹿特丹→安特卫普 3 港）卸货顺序，在装箱算法中以硬约束形式保证 LIFO（后装先卸）顺序
- 创新性：将多目的港卸货顺序作为装箱算法的硬约束，而非事后校验
- 边界：演示订单 3 港，目标态支持更多目的港

---

## 5. 建议查新点（技术实质，非宣传语）

| 查新点 | 技术实质 | 代码证据 |
|---|---|---|
| 1 | 块优先（FastBlock）三维装箱算法在六类业务约束协同机制下的确定性输出 | FastBlockPackingEngine.js:613 |
| 2 | 确定性算法生成物理方案 + AI 仅撰写合规建议的零幻觉架构 | AIComplianceService.js:6 |
| 3 | 18 相位状态机驱动的 3D 装柜作业过程可视化（真实坐标+程序化构建） | operationMachine.js / TwinScene.jsx |
| 4 | TF-IDF 余弦相似度本地法规 RAG 检索在港口合规场景的应用 | RegulationRAGService.js |
| 5 | VGM 后端硬计算 + 三层合规证据链不可静默覆盖机制 | AIComplianceService.js / CompliancePage.jsx |
| 6 | 多目的港 LIFO 卸货顺序作为装箱算法硬约束 | FastBlockPackingEngine._checkLIFOHardConstraint |

[已验证]

---

## 6. 中英文关键词

### 中文关键词（10-15 个）[已验证]
1. 港前装柜
2. 三维装箱
3. 块优先装箱算法
4. 确定性装箱
5. LIFO 卸货顺序
6. VGM 合规
7. 零幻觉合规架构
8. TF-IDF 法规检索
9. 三维作业可视化
10. 18 相位状态机
11. AABB 碰撞检测
12. 多目的港
13. 集装箱装载优化
14. 合规预审
15. 宁波港

### 英文关键词（10-15 个）[已验证]
1. Pre-Port Packing
2. 3D Bin Packing
3. Block-Priority Packing Algorithm
4. Deterministic Packing
5. LIFO Unloading Order
6. VGM Compliance
7. Zero-Hallucination Compliance Architecture
8. TF-IDF Regulation Retrieval
9. 3D Operation Visualization
10. 18-Phase State Machine
11. AABB Collision Detection
12. Multi-Port
13. Container Loading Optimization
14. Compliance Pre-Audit
15. Ningbo Port

---

## 7. 可检索技术实质

### 7.1 算法相关 [已验证]
- 块优先装箱（Block-Priority Packing）策略
- 确定性装箱算法（相同输入相同输出，AlgorithmOrchestrator + seed）
- 多策略融合调度（realistic4d-multi-strategy）
- Y 轴地面优先 + LIFO + Z-Lane 屏障（Realistic4D v34.7）
- 6 个算法 ID 白名单调度

### 7.2 约束相关 [已验证]
- LIFO 卸货顺序硬约束（_checkLIFOHardConstraint）
- 动态重心计算（_calculateCoG / calculateCoGOffset，横向≤5% 纵向≤10%）
- 同 SKU 聚集
- 堆叠与重不压轻安全（maxStackLayers / checkStackingConstraints / fragile / heavy）
- 叉车/人工搬运可达性
- VGM 总重合规（相对误差≤5% 且绝对误差≤1 吨）

### 7.3 3D 可视化相关 [已验证]
- 18 相位状态机（IDLE→OPENING_DOORS→...→COMPLETED/PAUSED/BLOCKED）
- 程序化构建（无 GLTF 模型加载），118 部件集装箱 + 34 部件叉车 + 4 关节人工 actor
- 真实坐标驱动（x=长度，y=高度，z=宽度）
- 9 段作业路径（home→waiting→waitingLifted→staging→doorApproach→doorInside→insideAligned→targetHover→target）
- AABB 分离轴定理碰撞检测（tolerance=2mm）
- 4 相机预设（overview/door/top/side）+ follow 模式
- InstancedMesh 批量渲染优化

### 7.4 合规相关 [已验证]
- "引擎算物理，AI 判合规"架构
- 7 条红线（载重/重心/LIFO/单证/危险品/木包装/混装禁忌）
- 4 份法规 JSON 17 sections（CTU Code / GB 40163-2021 / JT/T 1187-2018 / SOLAS VGM）
- TF-IDF 余弦相似度本地 RAG 检索（零外部依赖）
- 三层合规证据链（本地规则→AI建议→人工复核，不可静默覆盖）
- VGM 后端硬计算

---

## 8. 算法真实特点

### FastBlock 块优先 [已验证]
- 策略：块优先（Block-Priority），将货物组合为块后装载
- 用途：大批量路演数据集，生产主力
- 确定性：相同输入相同输出（AlgorithmOrchestrator + seed）
- 缓存：ResultCache 5 分钟 TTL
- 代码：[backend/services/FastBlockPackingEngine.js]

### 六类业务约束协同机制清单 [已验证]
> 重要：是六类业务约束协同机制清单，不是"Fast Block多约束三维装箱引擎"
1. LIFO 卸货顺序（LIFO unloading order）——硬约束，_checkLIFOHardConstraint
2. 动态重心（dynamic center-of-gravity）——_calculateCoG，横向≤5% 纵向≤10%
3. 同 SKU 聚集（same-SKU clustering）
4. 堆叠与重不压轻安全（stacking and heavy-on-light safety）——maxStackLayers / checkStackingConstraints
5. 叉车/人工搬运可达性（forklift/manual handling reachability）
6. VGM/总重合规（VGM/gross-weight compliance）——相对误差≤5% 且绝对误差≤1 吨

### LIFO 硬约束 [已验证]
- 实现：FastBlock._checkLIFOHardConstraint
- 场景：多目的港（演示订单 3 港：汉堡→鹿特丹→安特卫普）
- 特点：作为装箱算法硬约束，而非事后校验

### 确定性输出 [已验证]
- 机制：AlgorithmOrchestrator + seed
- 表现：相同输入相同结果
- 验证：[output/playwright/stage3/algorithm/determinism-summary.json]

### Realistic4D v34.7 [已验证]
- 特点：Y 轴地面优先 + LIFO + Z-Lane 屏障
- 多策略：realistic4d-multi-strategy 融合取最优（默认）
- 排序变体：weight-first / volume-first / mixed

---

## 9. 3D 真实特点

### 18 相位状态机 [已验证]
- 相位：IDLE → OPENING_DOORS → ... → COMPLETED / PAUSED / BLOCKED
- 代码：[web-dashboard/src/three/operation/operationMachine.js]
- 特点：覆盖叉车与人工两种作业 actor 的完整作业流程

### 程序化构建 [已验证]
- 无 GLTF 模型加载，全部程序化生成
- 集装箱：118 可渲染部件（[createIndustrialContainer.js]）
- 叉车：34 部件（[createIndustrialForklift.js]）
- 人工 actor：可识别低多边形人形 + 4 关节四肢

### 真实坐标驱动 [已验证]
- 坐标系：x=长度，y=高度，z=宽度
- 门端：x=innerLength（高 X 端）
- 货物坐标：loadedCargo{x,y,z,l,h,w}（真实装箱算法输出）
- 作业队列：按 x→y→z→loadingIndex 升序（深区优先、底层优先）

### AABB 碰撞检测 [已验证]
- 方法：分离轴定理
- 精度：tolerance=2mm
- 代码：[backend/services/geometry.js] / Realistic4D placeCargoWithCollisionCheck

### 其他 3D 特点 [已验证]
- 9 段作业路径（home→waiting→waitingLifted→staging→doorApproach→doorInside→insideAligned→targetHover→target）
- 4 相机预设（overview/door/top/side）+ follow 模式
- 7 维队列筛选
- InstancedMesh 批量渲染优化
- 倍速：0.5×/1×/2×/4×（Web），1/4/10/30（小程序）

---

## 10. 合规真实特点

### 引擎算物理 AI 判合规 [已验证]
- 架构：[backend/services/AIComplianceService.js:6] `"引擎算物理，AI 判合规"`
- 装箱物理决策：确定性算法生成
- 合规审核：本地规则引擎判定 PASS/FAIL
- AI 角色：DeepSeek V4 Flash 仅撰写建议文本，不判定结论（v4.0 架构）

### TF-IDF RAG [已验证]
- 服务：RegulationRAGService
- 方法：TF-IDF 余弦相似度
- 法规库：4 份 JSON（CTU Code / GB 40163-2021 / JT/T 1187-2018 / SOLAS VGM），17 sections
- 特点：零外部依赖，无需联网

### VGM 硬计算 [已验证]
- 实现：后端硬计算
- 精度：相对误差≤5% 且绝对误差≤1 吨
- 联动：与 7 红线本地规则联动

### 零幻觉架构 [已验证]
- AI 仅写建议，不判定 PASS/FAIL
- AI 失败时本地模板降级，不伪造 AI 结论
- 最终结论：finalConclusion 优先人工→本地规则
- 人工复核：MANUAL_REVIEW action 追加到 complianceHistory，不可静默覆盖

### 7 红线 [已验证]
1. 载重检查（totalWeight < maxWeight）
2. 重心偏移（横向≤5% 纵向≤10%）
3. LIFO 校验
4. 单证一致性（hasConfirmedDocument）
5. 危险品资质（UN38.3/MSDS/IMDG）
6. 木包装 IPPC 标识
7. 混装禁忌（食品/化工、液体/电子、危险品/普货）

---

## 11. 当前不能作为查新点的未完成功能

> 以下功能在代码中无证据或未完成，不得作为查新点 [已验证]

1. **工业级数字孪生**：无实时数据回传、无双向控制，3D 是作业过程可视化 [已验证]
2. **物理仿真**：3D 是真实坐标驱动的过程可视化，非物理仿真 [已验证]
3. **后端 PDF 生成**：当前仅支持浏览器打印 PDF，非后端 PDF 导出 [已验证]
4. **实时联网法规检索**：WebRAGService 调 Tavily 需 TAVILY_API_KEY，无 Key 时返回 web_available=false [已验证]
5. **AI 全自动装箱**：AI 仅写建议，装箱算法是确定性的 [已验证]
6. **Fast Block多约束三维装箱引擎**：代码中不存在，实际是六类业务约束协同机制清单 [已验证]
7. **企业落地/部署量/营收**：NOT_FOUND [已验证]
8. **小程序报告导出**：export 页面为空壳 [已验证]
9. **Layered 算法达标**：慈溪家电场景实际 39.06%，目标≥70% 未达标 [已验证]
10. **法规 PDF 原文联动与页码高亮**：NOT_FOUND [已验证]
11. **实时数据回传与双向控制**：NOT_FOUND [已验证]

---

## 12. 建议对比产品方向

> 以下为建议的对比产品方向，具体产品需查新机构检索 [待确认]

1. **3D 装柜软件**：如 LoadBuilder、Cube-IQ、MaxLoad 等三维装箱软件，对比其装箱算法、约束维度、3D 可视化能力 [待确认]
2. **港口合规系统**：如港口 VGM 申报系统、合规审核平台，对比其合规审核架构、法规库、AI 介入方式 [待确认]
3. **装箱算法工具**：如开源三维装箱算法库（3D-BPP 求解器），对比其算法策略、约束处理、确定性输出 [待确认]
4. **物流可视化平台**：如集装箱装载可视化工具，对比其 3D 作业过程、状态机、作业 actor 区分 [待确认]

---

## 13. 建议对比论文方向

> 以下为建议的对比论文方向，具体文献需查新机构检索，不得虚构 [待确认]

1. **三维装箱问题（3D-BPP, Three-Dimensional Bin Packing Problem）**：对比块优先、启发式、确定性算法等求解策略 [待确认]
2. **集装箱装载优化（Container Loading Optimization）**：对比约束维度（LIFO、重心、堆叠等）的处理方式 [待确认]
3. **港前合规审核（Pre-Port Compliance Audit）**：对比 VGM、CTU Code 等法规的自动化审核方法 [待确认]
4. **3D 装柜可视化（3D Packing Visualization）**：对比状态机、作业 actor、碰撞检测等可视化技术 [待确认]
5. **法规 RAG 检索（Regulation RAG Retrieval）**：对比 TF-IDF、余弦相似度等法规检索方法 [待确认]
6. **零幻觉 AI 合规架构**：对比 AI 在合规审核中的角色定位（建议 vs 判定）[待确认]

---

## 14. 建议对比专利方向

> 以下为建议的对比专利方向，具体专利需查新机构检索，不得虚构 [待确认]

1. **装箱算法相关专利**：块优先装箱、确定性装箱、多约束装箱算法 [待确认]
2. **3D 可视化相关专利**：3D 装柜可视化、作业状态机、程序化模型构建 [待确认]
3. **合规审核方法相关专利**：VGM 验证、法规 RAG 检索、零幻觉合规架构 [待确认]
4. **多目的港 LIFO 相关专利**：多目的港卸货顺序约束的装箱方法 [待确认]
5. **三层合规证据链相关专利**：本地规则+AI建议+人工复核的合规审核方法 [待确认]

---

## 15. 项目事实证据索引

| 事实 | 证据位置 | 状态 |
|---|---|---|
| Fast Block多约束三维装箱引擎 | [backend/services/FastBlockPackingEngine.js] | [已验证] |
| 六类业务约束协同机制清单 | [backend/services/FastBlockPackingEngine.js:613] `sixDimensionalConstraints` | [已验证] |
| LIFO 硬约束 | [backend/services/FastBlockPackingEngine.js] `_checkLIFOHardConstraint` | [已验证] |
| Realistic4D v34.7 | [backend/services/Realistic4DPackingEngine.js] | [已验证] |
| AlgorithmOrchestrator 调度器 | [backend/services/AlgorithmOrchestrator.js] | [已验证] |
| 6 算法 ID 白名单 | [backend/services/AlgorithmOrchestrator.js] | [已验证] |
| 确定性输出 | [output/playwright/stage3/algorithm/determinism-summary.json] | [已验证] |
| 18 相位状态机 | [web-dashboard/src/three/operation/operationMachine.js] | [已验证] |
| 118 部件集装箱 | [web-dashboard/src/three/scene/createIndustrialContainer.js] | [已验证] |
| 34 部件叉车 | [web-dashboard/src/three/scene/createIndustrialForklift.js] | [已验证] |
| 4 关节人工 actor | [web-dashboard/src/three/operation/createManualWorker.js] | [已验证] |
| AABB 碰撞检测 | [backend/services/geometry.js] / Realistic4D placeCargoWithCollisionCheck | [已验证] |
| 引擎算物理 AI 判合规 | [backend/services/AIComplianceService.js:6] | [已验证] |
| 7 红线本地规则 | [backend/services/AIComplianceService.js] `_buildLocalComplianceReport` | [已验证] |
| TF-IDF 法规 RAG | [backend/services/RegulationRAGService.js] | [已验证] |
| 4 法规 JSON 17 sections | [backend/data/regulations/*.json] | [已验证] |
| VGM 硬计算 | [backend/services/AIComplianceService.js]（相对误差≤5% 且≤1 吨） | [已验证] |
| 三层合规证据链 | [backend/services/AIComplianceService.js] / [web-dashboard/src/pages/workflows/CompliancePage.jsx] | [已验证] |
| 人工复核不可覆盖 | [web-dashboard/src/pages/workflows/CompliancePage.jsx] MANUAL_REVIEW action | [已验证] |
| 演示订单结果 | [docs/final_product_integration/REAL_DATA_CONSISTENCY_REPORT.md] | [已验证] |
| 后端 811 测试 | [backend/__tests__/]（54 文件） | [已验证] |
| Web 21 测试文件 90 用例 | [web-dashboard/src/**/*.test.js] | [已验证] |
| 4 数据库表 | [backend/config/init.sql]（cargo/container_type/packing_plan/user） | [已验证] |
| 41 API 端点 | [backend/routes/index.js] | [已验证] |
| 报告 HTML/CSV/JSON | [web-dashboard/src/domain/report/reportBuilders.js] | [已验证] |

---

## 16. 不得虚构外部文献

> 重要声明 [已验证]

1. 本参考资料中所有 [已验证] 内容均基于项目仓库代码与文档，可直接用于查新报告
2. 第 12-14 节的对比产品/论文/专利方向仅为建议方向，具体文献需查新机构检索，**不得虚构外部文献名称、作者、年份、期刊**
3. 外部行业数据（宁波港出口规模、行业规模、竞品市场占有率等）需 Deep Research 调查，不得编造
4. 查新报告应聚焦于项目代码可证明的技术实质，避免宣传语
5. 禁止使用以下表述：
   - ~~"Fast Block多约束三维装箱引擎"~~（实际是六类业务约束协同机制清单）
   - ~~"工业级数字孪生"~~（实际是 3D 作业过程可视化）
   - ~~"全球首创"~~（未经查新证实）
   - ~~"AI 全自动装箱"~~（AI 仅写建议）
   - ~~"实时联网国标检索"~~（依赖 Key）
   - ~~"零风险、完全自动化"~~（禁止表述）

---

> 本参考资料所有创新点与查新点均有代码证据支撑（见第 15 节证据索引）。查新机构检索外部文献时，应聚焦于第 5 节查新点的技术实质进行对比。
