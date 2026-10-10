# PORTCUBE 算法选择与复现实验

更新：2026-09-26。正式结论：**KEEP_NATIVE**。保留正式 Native V2.5 与已有 COMMERCE 分域求解、独立验证及拒绝入场机制；PackingSolver 已实际运行，但当前只作研究对照，不参与正式推荐或重规划。这里的 Native 是现有实现族，不是声称一个启发式算法在所有实例上最优。

## 实际引入与来源

|实现|来源与许可证|本轮证据|
|---|---|---|
|PackingSolver boxstacks|[官方仓库](https://github.com/fontanf/packingsolver)、[官方模型文档](https://fontanf.github.io/packingsolver/boxstacks.html)，MIT|下载官方 Windows x64 release，执行真实二进制；保留 CSV 输入、原始证书、进程参数/退出码、JSON 输出和独立验证|
|LAFF|[skjolber 官方仓库](https://github.com/skjolber/3d-bin-container-packing)，Apache-2.0|阅读原始 LargestAreaFitFirstPackager.java 与许可证；**未执行**，不列入性能排名|
|EB-AFIT|[官方实现仓库](https://github.com/davidmchapman/3DContainerPacking)，MIT|阅读原始 EB_AFIT.cs 与许可证；**未执行**，不列入性能排名|

来源证据：`artifacts/master-rebuild-20260922/algorithm/research-provenance.json`。PackingSolver 获取时 release tag 是可变的 `latest`，对应 target `4a227d5efab88e42d1cfd1494f137e32b68b3a6f`；压缩包 SHA256 `10B381D2184EBDCAE6682884733E083798436989397B0295BC10435160A9E673`，二进制 SHA256 `63971947D12C71C91D3BEA79153141A2099B3AE76BC4292A4A3F243BC4375303`。这些标识用于复现下载时版本，不代表今天的 latest。

外部适配坐标为 upstream X/Y/Z → PORTCUBE X/Z/Y；旋转必须读取证书 ROTATION 并与源许可和尺寸同时吻合，正方体也不能靠外形推断方向。不支持港序、已有固定放置、方向接触压力、部分原始层级规则时返回 UNSUPPORTED。boxstacks 的相同底面堆叠组限制会压缩搜索空间，适配器如实记录；不能把限制写回货物事实。二进制未配置时返回 EXTERNAL_UNAVAILABLE，没有伪造外部成功或悄悄改用本地结果。

## 统一比较口径

15 个确定性案例 × 5 个求解器 × 2 次独立 Node worker。42 件为项目演示数据，其余为 SYNTHETIC_BENCHMARK，种子 20260922；这些不是工业现场采样集。覆盖同规格高填充、48 件异构、大中小混合、单柜溢出、空洞、限高、固定朝向、不堆叠、两层上限、顶部承重、实际门洞、载重溢出、固定位置、宽度变更。案例原文、输入 hash、单位 mm/kg 和每次布局 hash 全部保存。

所有比较都是给定**一个箱体的有界装载**，不是多箱最少箱数优化；binsUsed 只能是 0 或 1，不能据此声称节省了几个柜。共同约束采用 100% 支撑、源尺寸/数量/方向、真实门洞、禁止重叠/越界、承重、最大层数及有需要时的卸货顺序/固定位置。生产默认最低支撑率仍为 75%，基准通过构造参数提高至 100%，没有放宽生产规则。

独立复验同时调用 SourceConstraintValidator、PlanValidator，并以已有固定货物为前置障碍检查连续 AABB 插入路径。共同 VALID 仅说明该次返回候选通过该比较口径；Native 的 CoG、设备作业、完整卸货后稳定性等额外正式门禁另列 `nativeProductionAdmission`。INVALID 候选不能按装入数量算赢家，UNSUPPORTED 不是装载失败的零分，更不表示数学无解。空方案的 VALID 也不代表完成订单。

SOURCE、COMMERCE 和外部求解器搜索预算为 1500 ms；Native/FastBlock 使用各自有界构造参数，worker 最多 30 s。预算模型并不相同，因此这是**实际可用候选比较**，不是等 CPU 时间竞赛。耗时从 worker 求解入口到函数返回，含按需模块加载，独立验证完成时间另存。内部首次找到合法解没有仪表，`firstValidatedPlanMs=null`；不以最终返回总耗时替代。RSS 是 Node worker 的 process.resourceUsage().maxRSS（KiB→MiB），含运行时和验证；外部子进程峰值内存未捕获，`externalPeakRssMiB=null`，不能用适配器内存冒充 C++ 内存。两次重复不足以构成统计置信区间；开发机并行工作负载会影响时延。

## 正式算法修复与历史项目回归

- 缓存键覆盖完整输入事实、门洞、锁定放置与求解策略；数量总重超载与单件超重分别判断。
- 实际门洞贯通构造、适配与独立验证。旧 Realistic4D 候选若缺方向事实或未过独立门禁，重新求解 V2.5 并保留失败证据；不会把无效旧候选包装成正式方案。
- Cargo、包装归一化和构造输出保留显式 `maximumSupportedWeightKg=0`。同 SKU 列按整列上方累计重量限制层数；最终验证还会沿真实接触图传递整垛载荷，构造失误不能逃过门禁。
- 同卸货组货墙可累计重排；不同卸货组不交换。稀疏货单只有在当前几何有效、CoG 门禁失败且无锁定位置时才提供边界内质量平衡平移候选，再完整复验。平移是新方案事实，明确标记箱端空隙与系固审查，不修改历史保存的坐标。
- 212 件旧质量断言的 4.004 m³ 来自固定 100 mm 截面中点横跨物理边界的数值近似。现在在每个真实 X 面细分后积分，均值/P10 按长度加权；20 mm 窄空洞回归同时证明不会漏掉小于网格的空隙。保持 `<4 m³` 原阈值与原方案布局。该内部空洞指标仍取体素拓扑与截面碎片的较大值，和 `exactVoid.internalVoidMm3` 定义不同，不能混称同一个精确体积。

212/69 件的独立实算保存在 `artifacts/master-rebuild-20260922/algorithm/final-frozen-20260926/project-regression-summary.json` 与 `project-212.json`、`project-69.json`。212 件仍为 212/212，布局 hash `13bcef7385ac9712` 不变，0 硬违规、0 作业阻挡、完整卸货与卸后稳定通过；质量指标 3.94953 m³，另一精确内部空洞分类为 3.16836 m³。69 件为 69/69，平衡候选真实平移 X=932 mm、Z=0，纵向偏移 4.3205%，同样完整复验通过；它不是原先靠深端外观产生的错误放行。两者均为项目模型证据，不代替现场系固批准。

## 选择理由与剩余边界

PackingSolver 在支持的矩形堆叠域有成熟实现与真实可运行证书，值得保留研究适配；但本轮尚未映射卸货组顺序、锁定物插入通道和全套现场作业门禁，也未量得外部峰值内存或内部首个合法解时间，因此不提升为正式解算器。现有 Native/COMMERCE 与版本、重规划和孪生证据链已经衔接。保留 Native 不等于忽略对照：异构、局部支撑 CoG、稀疏重心等案例必须看有效性与业务门禁，不能只看装入率。

所有搜索失败结论都是 `BOUNDED_SEARCH_NOT_IMPOSSIBILITY_PROOF`；尚未证明全局最优、所有货物都可装或多箱最少柜数。几何插入不是叉车转向半径、叉孔、地坪、摩擦、船舶加速度和系固力学的现场证明。额外证据缺失仍应阻止作业放行。

## 复现

在 recovered 根目录用 Node 24 运行 `backend/benchmarks/runMasterBenchmark.js`；PowerShell 可设置 `$env:BENCH_OUTPUT_SUFFIX='my-reproduction'`，独立输出到 algorithm 下，避免覆盖本轮证据。默认 15×5×2；脚本支持 BENCH_CASES / BENCH_SOLVERS / BENCH_REPEATS 进行诊断。外部二进制使用本报告固定 hash 的目录。`backend/benchmarks/summarizeMasterBenchmark.js <输出子目录>` 生成硬件、源码 hash、每案例/求解器统计。历史项目回归可运行 `backend/benchmarks/captureMasterProjectRegression.js`。

## 最终运行结果

以下结果直接由最后冻结源码的原始证据生成；之前的 benchmark.json、final-20260926 与 final-verified-20260926 均保留，含修复前失败和不同时间预算中断点，不能拿旧日志当最终源码的全部通过证据。
<!-- FINAL_RESULTS -->

最终证据目录：`artifacts/master-rebuild-20260922/algorithm/final-frozen-20260926`。150/150 次运行完成；节点 v24.19.0，AMD Ryzen 7 6800H with Radeon Graphics         ，16 逻辑核心，内存 13.69 GiB。这一轮同时运行回归验证，时延只按本机本轮记录解释。

|求解器|共同 VALID|INVALID|UNSUPPORTED|ERROR|有效返回时间范围 ms|Node worker 峰值 MiB|
|---|---:|---:|---:|---:|---:|---:|
|native-v25|28|0|2|0|176.94–11032.29|150.44|
|fast-block|28|0|2|0|11.32–42.35|58.2|
|source|27|1|2|0|12.28–1638.68|88.04|
|packingsolver|26|0|4|0|157.61–1646.88|58.04（仅适配器）|
|commerce|30|0|0|0|120.22–1680.56|133.45|

每格是两次装入数量及有效候选返回耗时均值 ± 总体标准差（ms）；U 为不支持，I 为独立验证失败。两个数不同不能隐去较差的一次。每次利用率、原始时长、布局 hash、内存与违规码见 summary.json 和 runs 下的 row/validation/plan 文件。

|案例|Native V2.5|FastBlock|SOURCE|PackingSolver|COMMERCE|
|---|---|---|---|---|---|
|DEMO-WORKSITE-42|42/42；2508.32 ± 26.74|14/14；20.1 ± 0.66|U/U|U/U|42/42；400.75 ± 33.96|
|identical-high-fill|108/108；10423.97 ± 608.32|108/108；36.15 ± 0.46|108/108；123.96 ± 3.02|108/108；188.93 ± 9.08|108/108；593.1 ± 33.05|
|heterogeneous-48|27/27；2647.44 ± 254.26|27/27；36.15 ± 6.2|35/I(38)；1638.68 ± 0|25/23；1637.79 ± 9.09|39/40；1677.77 ± 2.79|
|mixed-large-small|64/64；3269.82 ± 123.59|64/64；21.56 ± 0.8|64/64；68.05 ± 3.69|64/64；200.55 ± 19.51|64/64；586.84 ± 13.37|
|single-bin-overflow|24/24；1375.98 ± 172.49|24/24；26.57 ± 1.12|24/24；159.61 ± 11.82|24/24；235.67 ± 1.43|24/24；262.68 ± 21|
|cavity-prone|21/21；1467.42 ± 103.35|21/21；24.68 ± 2.09|21/21；44.1 ± 4.6|21/21；241 ± 14.78|21/21；255.38 ± 8.54|
|height-limited|10/10；476.96 ± 39.85|10/10；13.98 ± 1.97|10/10；50.02 ± 5.39|10/10；190.54 ± 4.12|10/10；157.8 ± 17.9|
|fixed-orientation|0/0；178.16 ± 1.23|5/5；17.11 ± 3.39|5/5；13.17 ± 0.88|5/5；159.15 ± 1.55|5/5；120.56 ± 0.35|
|no-stacking|8/8；397.28 ± 5.49|8/8；15.52 ± 4.19|8/8；58.64 ± 2.58|8/8；183.9 ± 11.26|8/8；224.4 ± 7.89|
|maximum-two-layers|16/16；691.96 ± 37.64|16/16；30.93 ± 0.29|16/16；167.26 ± 7.94|16/16；642.62 ± 465.11|16/16；266.66 ± 30.57|
|bearing-limit|16/16；699.29 ± 40.47|16/16；24.12 ± 1.08|16/16；417.8 ± 21.2|16/16；300.13 ± 95.19|16/16；422.15 ± 40.24|
|door-aperture|6/6；368.85 ± 1.67|6/6；22.96 ± 0.13|6/6；51.64 ± 2.38|6/6；184.92 ± 3.43|6/6；173.35 ± 14.3|
|payload-overflow|0/0；284.01 ± 30.76|7/7；23.78 ± 0.54|7/7；67.11 ± 2.12|6/6；316.03 ± 22.77|7/7；189.26 ± 15.52|
|fixed-placement|U/U|U/U|10/10；29.63 ± 0.87|U/U|10/10；156.44 ± 3.55|
|replan-changed-width|10/10；483.9 ± 89.03|10/10；17.68 ± 0.78|10/10；26.33 ± 3.14|10/10；230.75 ± 19.09|10/10；251.51 ± 21.48|

**额外业务门禁不能从共同 VALID 推导。Native 30 次只有 10 次 hardConstraintsPass=true，其中 4 次是零装载空方案；只有 6 次为非空且过 Native 完整业务门禁。** 空方案不代表任务完成。COMMERCE 返回字段的现有定义并不等于 Native 的设备路径、CoG 和卸后稳定全套门禁；其 30 次共同 VALID 不能称为 30 次现场可放行。

|Native 案例（两次结果一致）|装入数|额外门禁|失败或剩余原因|
|---|---:|---|---|
|DEMO-WORKSITE-42|42/42|PASS|本模型全部通过|
|identical-high-fill|108/108|REJECTED|设备/人员作业阻挡6；PORT_ACCESS_BLOCKED|
|heterogeneous-48|27/48|PASS|未装21件，未证明不可装|
|mixed-large-small|64/64|REJECTED|CoG横向0.00%、纵向5.47%；设备/人员作业阻挡2；PORT_ACCESS_BLOCKED|
|single-bin-overflow|24/40|REJECTED|设备/人员作业阻挡8；PORT_ACCESS_BLOCKED；未装16件，未证明不可装|
|cavity-prone|21/21|REJECTED|CoG横向3.97%、纵向8.33%|
|height-limited|10/15|REJECTED|CoG横向3.33%、纵向40.00%；未装5件，未证明不可装|
|fixed-orientation|0/5|PASS|空方案；构造返回 NO_CROSS_SECTION_LAYER_CAPACITY，未完成装载，未证明无解|
|no-stacking|8/12|REJECTED|设备/人员作业阻挡2；PORT_ACCESS_BLOCKED；未装4件，未证明不可装|
|maximum-two-layers|16/24|REJECTED|设备/人员作业阻挡4；PORT_ACCESS_BLOCKED；未装8件，未证明不可装|
|bearing-limit|16/20|REJECTED|设备/人员作业阻挡4；PORT_ACCESS_BLOCKED；未装4件，未证明不可装|
|door-aperture|6/8|PASS|未装2件，未证明不可装|
|payload-overflow|0/20|PASS|空方案；构造返回 NO_CROSS_SECTION_LAYER_CAPACITY，未完成装载，未证明无解|
|fixed-placement|—|UNSUPPORTED|无固定位置种子接口，重规划锁定流程另行验证|
|replan-changed-width|10/10|REJECTED|CoG横向8.75%、纵向37.50%|

SOURCE 异构案例出现 STACK_COG_OUTSIDE_SUPPORT；最终一轮为 35 件有效/38 件无效，受时间预算影响，不能用无效候选装入数展示优胜。外部在纯矩形域有效且部分案例快速，但尚未覆盖主工作流的所有业务合同；这正是未将其提升到生产的证据。基准中的 changed-width 是重解同事实的能力比较，不冒充 retain/local-repair 的状态变更端到端测试；该端到端证据在 DEMO_AND_QA.md。

最终修复后回归：`algorithm/active-verified-tests.json`，7 suites、331/331 PASS（256.579 s），覆盖 V2.5、正式编排器、方向 R1、Cargo、包装、物理指标与新增承重信任边界。`active-final-tests.json` 的两项新增承重失败被保留，修复后的专项 `bearing-final-tests.json` 为23/23，综合复验不再失败。`final-eslint.json` 0 errors。以上为明确的活动范围，不是整个旧后端全量测试已绿；旧缺失模块/数据库/退役算法失败仍见主报告分类。
