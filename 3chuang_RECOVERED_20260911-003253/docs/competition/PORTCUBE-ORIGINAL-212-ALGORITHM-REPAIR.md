# PORTCUBE 原始 212 件算法修复 · Batch 01

**PARTIAL。原 212 件专项已达到几何、CoG、卸载及同视角视觉目标；额外存量 69 件回归暴露了通用搜索不足，因此不能宣布整个 solver 修复完成。** 保留新候选供人工验收，本批到此停止。

工作目录：`D:\cixing\3chuang_RECOVERED_20260911-003253`。原主目录和恢复来源未修改；无 reset、clean、commit、push。初始 Git 已有大量恢复差异，见 `artifacts/algo-repair/git-status-before.txt`，不能把整份 Git diff 算作本批修改。修改前源码保存在 `source-before.zip`；接口补充备份为 `source-before-routes-packing.js`，路径和校验值见 `source-change-manifest.json`。

旧正式方案 `REQ_1789015704635 / 155f34bf236fc0c8` 保留。新正式接口候选为 `REQ_1789093943550 / 13bcef7385ac9712`。两者都对应 NB2026-0824-001、40HQ。

1. **667.695 mm 的根因。** 旧横截面构造原本从 X=0 开始，但把后卸的较重货组过度集中在深端。V23 `applyStrategyTranslation` 按 CoG 把全票向门端移动 700 mm；后续 `EndGapCompaction` 只回移 32.305 mm。墙序修复又把内部空洞不增作为限制，单对修复每次从原始状态复制，不能累计接受改善。真正限制旧相对排布的是 CoG；没有发现边界或港序要求必须留下整段 667 mm 后壁空区。

2. **坐标和 CoG 审计。** X 为纵向，X=0 是内腔有效深端；Y 为向上，Z 为柜宽。placement 是最小角点，旋转后的 l/h/w 分别进入 X/Y/Z。当前货物没有独立偏心资料，采用包络几何中心，独立按 `Σ[m(x+l/2)]/Σm` 计算。旧绝对坐标正确，但旧百分比除以半跨度：纵向 9.999985%、横向 0.095517%，不能直接当作 CTU 的完整跨度百分比。新定义为 `100 × |CoG−内腔中点| / 完整内腔跨度`。原物理限制保持不变：旧纵向 10%/横向 5% 半跨度，换算为新纵向 5%/横向 2.5% 全跨度；数值比较容差也减半。

| 独立质量矩结果 | 旧方案 | 新候选 |
|---|---:|---:|
| 纵向 CoG X，mm | 5414.400903 | 5738.930187 |
| 距柜长中点 6016 mm，带符号 | −601.599097 | −277.069813 |
| 纵向偏心／完整柜长 | 4.999992% | 2.302774% |
| 横向 CoG Z，mm | 1177.123275 | 1170.922185 |
| 距柜宽中点 1176 mm，带符号 | +1.123275 | −5.077815 |
| 横向偏心／完整柜宽 | 0.047758% | 0.215894% |
| 垂向 CoG Y，mm | 1224.592949 | 1224.592949 |

代码、独立审计、浏览器诊断的 X 和中点距离一致。实际打开“平衡”面板：旧页面纵向 10.000%、横向 0.096%，误归入“需要工程复核”；新页面纵向 2.303%、横向 0.216%，归入一般指导范围。旧／新首页横向摘要分别舍入为 0.1%／0.2%。完整文字已保存在浏览器验收证据中。

采用 [UNECE 发布的 CTU Code](https://unece.org/transport/intermodal-transport/imoilounece-code-practice-packing-cargo-transport-units-ctu-code)。[Annex 7 规划 §1.2](https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102042/1%2BPlanning%2Bof%2Bpacking) 区分紧密装载与通过阻挡、系固处理空隙的装载；[原则 §3.1.4](https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102046/3%2BPrinciples%2Bof%2Bpacking?src=sidebar) 的通常 ±5% 与特定情况下 ±10% 不能混用。[Appendix 4](https://wiki.unece.org/plugins/viewsource/viewpagesrc.action?pageId=23102061) 使用统一内端面距离的质量矩。0–50 mm 是本项目搜索目标，不是 CTU 法规阈值。

3. **原 212 输入未变。** `original-212-input.json` 逐件保留原 placement 和关联原始事实，原始 SKU 输入、柜型和 caseContext 的 SHA-256 为 `9c53a2a6b1ba9a6dc69a6921cfc7bb9eaa8bbdc084be75615b141685b2fa4d5b`。逐件 ID、尺寸、质量、朝向、港序、目的港、批次、堆叠、承载和 handling 等字段深比较一致；事实投影的前后 SHA-256 同为 `83e7bf150fa5b29e08b17607d197995f6fc32aa64e581b08973858f872bfdae2`。字段清单与文件 SHA 在 `metrics-before-after.json`。既有浏览器 loader 在前后都将缺省 `palletJackCompatible` 显示为 false；本批没有把它写回原始输入，也修正了后端新添缺省 false 的行为。

4. **实际深端货墙。** primary gap 定义为有底层货物宽度上的加权 P90，lane 边界全部来自真实底层货物侧面。新后壁是一组 12 件、2600 mm 高的实际货墙，覆盖柜宽 2340/2352 mm，不靠孤立小货取得零值。

| 深端指标，mm（覆盖率除外） | 旧方案 | 新候选 |
|---|---:|---:|
| deepEndPrimaryGap / P90 / P95 | 667.695 | 0 |
| lane minimum | 667.695 | 0 |
| lane 宽度加权 mean | 669.226 | 38.010 |
| lane maximum | 967.695 | 7450 |
| 后壁真实接触面积覆盖率 | 0% | 95.876% |
| 底层贴壁宽度覆盖率 | 0% | 99.490% |

各 lane：Z `[0,780]`、`[780,1560]`、`[1560,2340]` 均从旧 667.695 mm 变为 0；最后 `[2340,2352]` 的 **12 mm 窄条带**从 967.695 变为 7450 mm。该边缘余隙完整计入统计和几何空间，没有删除或改名。

5. **空洞的真实取舍。** 最终用货物实际面坐标分区，逐区计算竖向占用区间并集，非 voxel。分类互斥且总体积守恒误差小于 1 mm³。

| 精确几何余空，m³ | 旧方案 | 新候选 |
|---|---:|---:|
| 全宽连续深端空区 | 4.236989 | 0 |
| 门端几何可用空区 | 0.661888 | 4.898877 |
| 禁堆／易碎顶部余空 | 3.786978 | 3.786978 |
| 不规则内部空洞 | 0.004680 | 0.207480 |
| 普通顶部余空 | 4.693026 | 4.490226 |
| 侧向边缘余空 | 2.321683 | 2.321683 |

门端 clearance 104.305→772 mm。不规则内部空洞增加 0.202800 m³；含截面内部禁堆部分的 internalVoid 为 3.016260→3.168360 m³。总余空始终 15.705244 m³，体积利用率未变。未提供明确作业／绑扎净空几何，字段 0 表示“尚未划定”，不代表不需要净空。`SECURING_UNRESOLVED` 保留；本结果是 tight-stow-biased 候选，未虚构完整出运系固方案。

6. **重心改善来自重新排序。** 重心向柜长中点移动 324.529 mm；纵向偏心从约 5% 降至 2.303%，同时后壁归零。V25 正式链路不再调用全局平移；33 个实际承托组件、114 件货物参与 lane 重构，其他货墙按实际深度重新构造。入选路径累计接受四步重排。

| 搜索试验 | 件数 | 主货墙间隙 mm | 纵向偏心／全长 | 完整硬约束 |
|---|---:|---:|---:|---|
| A：旧算法，仅统一 CoG 口径并保持物理限值 | 212 | 667.695 | 4.999992% | 通过 |
| B：从后壁构造 | 212 | 0 | 10.549319% | CoG 不通过 |
| B：同港墙质量重排 | 212 | 0 | 9.370430% | CoG 不通过 |
| C：后壁构造＋累计局部搜索 | 212 | 0 | 7.499545% | CoG 不通过 |
| D：后壁构造＋墙／lane 重构 | 212 | 0 | 2.302774% | 通过 |

全约束通过的候选才可竞争：件数→primary gap→精确内部空洞→合法范围内 CoG→作业成本。探索状态允许暂时 CoG 不可行，以便经过中间状态；不会将这类状态提升为正式方案。详细候选及累计动作见 `search-candidates.json`。原 212 在 D 达标，不需要触发更大搜索。

7. **仍为 212/212、8623 kg。** cargoId 集合相同、无重复、无漏装。旧 hash 作为比较基线保留，新 hash 由新坐标自然计算。

8. **原 212 全部硬约束通过。** bounds、collision、orientation、payload、support、复合承托、传递承载、stack limit、不相容、handling/insertion、CoG 均通过。实际接触面积并集不包含洞，当前最小支撑率 1.0；接触凸包仅用于重心投影静态稳定判定。港序 `FULL_UNLOAD_PASS`、rehandle=0、post-unload stability=true、作业几何 blocked=0。检查仍限于项目既有物理和作业模型，不等同完整运输系固放行。

最小回归：`BackWallRepair`、`PlanValidator`、`StabilityAnalyzer` 共 **28/28**，含独立 CASE A/B/C；既有 V25 策略／tiny-case 四项也通过，未改旧测试期望。另行存量 69 件回归 **失败**：69/69、几何及卸载通过，但 CoG=12.066533%，扩大搜索仍未得到全部硬约束通过的候选。原始旧测试中要求 source 为 `hybrid-v2.3` 的复合断言未修改，也不计为通过。新增正式接口门禁经真实请求验证返回 `400 / NO_HARD_FEASIBLE_PLAN`，阻止不满足全部硬约束的候选保存为正式方案。

9. **空间关系确实改善。** 相同 Chrome、1600×900、40HQ、全部 212 件和相同 side/top/rear/door 预设截图，前后相机导出坐标一致（0.001 m 精度），见 `browser-verification.json`。前侧／后侧对照能看见真实货墙抵达内腔后壁、货组顺序改变、门端形成连续余空。仅增加默认关闭的算法诊断（后壁、lane、CoG、主要几何空洞）及深端相机预设；未变更货物显示坐标、美术或其他业务模块。

| 视角 | 修改前 | 修改后 |
|---|---|---|
| 侧视 | [before-side](../../artifacts/algo-repair/screenshots/before-side.png) | [after-side](../../artifacts/algo-repair/screenshots/after-side.png) |
| 顶视 | [before-top](../../artifacts/algo-repair/screenshots/before-top.png) | [after-top](../../artifacts/algo-repair/screenshots/after-top.png) |
| 深端 | [before-rear](../../artifacts/algo-repair/screenshots/before-rear.png) | [after-rear](../../artifacts/algo-repair/screenshots/after-rear.png) |
| 门侧 | [before-door](../../artifacts/algo-repair/screenshots/before-door.png) | [after-door](../../artifacts/algo-repair/screenshots/after-door.png) |

10. **尚未解决什么。** 原 212 主货墙已到有效后壁，不存在必须保留 667 mm 空区的硬约束证明。12 mm 边缘条带并未达到全部 lane 零间隙，也没有证明其数学上不可改善。额外 69 件回归的瓶颈是当前构造／邻域无法在港序和 CoG 同时受限时充分重排；这是“搜索未找到”，不是“数学不可能”。因此本批整体标记 PARTIAL，禁止把通用 solver 全量替换视为验收成功。

性能：原 212 旧求解 25.824 s，新 32.062 s（正式 API 端到端 36.023 s）。新阶段 B/C/D 为 9.090/6.604/16.367 s；C 搜索 746 状态，D 搜索 7765 状态，质量档 beam=20、depth=8，最多 18000 状态。fast 档为 10×4，门禁相同；不足时触发 40×12、最多 30000 状态的受控扩大。未测试 fast 档质量，不给出等效承诺。未建 benchmark 平台，未测 Lighthouse/FPS。

复核入口：恢复版 `http://127.0.0.1:14173/workspace/twin` 当前保存新候选；历史入口 `/_recovery-import-historical-212` 可恢复旧方案。全部结果在 `artifacts/algo-repair/`，`final-audit.cjs` 可重新计算对照；不要重跑只用于修改前捕获的 `capture-baseline.cjs`（已设禁止覆盖保护）。
