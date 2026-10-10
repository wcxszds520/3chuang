# PORTCUBE 重构状态（2026-09-10 最终交付）
## 当前阶段与运行环境
- A—F本地产品重构及本轮复验已完成。原212同条件改善、Blender/GLB、真实多柜/追加客户、条件化装卸、全站与任务AI均已接入；剩余工程和外部条件见文末，不宣称全局最优或现场放行。
- 项目D:\cixing\3chuang；01/02已完整读，04按需读；8图均实际看过，03是用户主动删除，勿重建。未发现AGENTS。保留所有既有改动/删除，不reset/commit/push；无主动子代理授权。
- 快照tmp/rebuild-start-20260910-172656，HEAD a175aea9a902c094733ed486d49348f4aca98e1b。仅维护本文件；不要重复全仓/历史报告扫描、FPS或全量测试。
- Node D:\nvm\nodejs\node.exe；Blender D:\blender\blender.exe；Vite4173 PID5480，后端3000 PID63776（已加载叉孔/设备资料/资料不自动通过等改动），日志tmp/rebuild-backend.log/.err。无在跑测试/构建。
- 浏览器：IAB browser1/tab2可见，最终/workspace/tasks，主任务v10、全部柜位/客户归属，已markHandoff。旧tab1已退出工作区到首页，停止旧会话热更新覆盖。单柜保存会话仍为原212正式方案。Chrome此前Debugger unattached，未因该问题重装/改代理；本轮末段实看采用IAB CUA。用户TUN方案不变。
- CUA会话已reset重建：liveTaskTab=cua.getTab('2',{browser:'1'}), workBrowser=cua.getBrowser({id:'1'}), taskDevTab=workBrowser.tabs.get('2'), viewport=workBrowser.capabilities.get('viewport')。完整API文档已读；viewport.set({width,height})/reset，已恢复默认1280×720。UI用CUA；read-only playwright.evaluate可读DOM；勿用evaluate改应用状态。

## 8张参考图映射（均在assets，已实际打开）
- V03 ChatGPT Image Sep 10, 2026, 05_05_59 PM (1).png：集装箱工业蓝青/装配，忽略侧面大洞。
- V01 ChatGPT Image Sep 10, 2026, 05_06_00 PM (2).png：大画布/柜树/单检查器。
- V02 ChatGPT Image Sep 10, 2026, 05_06_01 PM (3).png：多客户候选工作面。
- V04 ChatGPT Image Sep 10, 2026, 05_06_02 PM (4).png：成年工人/工装/手脚接触。
- V05 ChatGPT Image Sep 10, 2026, 05_06_03 PM (5).png：紧凑叉车/门架/机械结构。
- V06 ChatGPT Image Sep 10, 2026, 05_06_03 PM (6).png：地牛/低叉/轮组/叉孔。
- V07 ChatGPT Image Sep 10, 2026, 05_06_04 PM (7).png：纸箱精修。
- V08 ChatGPT Image Sep 10, 2026, 05_06_05 PM (8).png：共享包装图库与中文业务入口。
- 仅借视觉方向，不用参考图数字、客户、可装结论或整张图伪装UI。

## A/B：原212同条件结果
- 不可变输入artifacts/rebuild/original-212-input.json，指纹89619e4594f03ae5ba6e80e0b2caac36457864de135bb216b26c0792dfd213be；NB2026-0824-001，212件/8623kg，40HQ 12032×2352×2698。尺寸/重量/约束未改，不能用42例替代。
- 旧hash155f34bf236fc0c8，深端667.695mm。先修CoG为全内长/宽：旧公式半长约10%，正确全长约5%；纯口径修正不计空间改善。ILO官方CTU Annex7 §3.1.4及Appendix4质量矩已核对：https://www.ilo.org/sites/default/files/wcmsp5/groups/public/@ed_dialogue/@sector/documents/publication/wcms_492710.pdf 。
- LaneStackRepacking接V25，12宽×8步beam/4705状态/5步累计/114件33柱；新hash306d74495eca3804，深端543.77mm（减少123.925），212/8623不变；geometry/operation/port/postunload/stability通过；CoG全长4.99999758%、全宽0.1225464%，利用率79.43不变。正式保存及GUI同条件比较已做。
- 精确货面分段积分ExactVoidGeometry：内部3.01626→2.94021m³，禁压3.01158→2.93553，其余均.00468；旧网格内部3.76636→3.91456、未解释.804366→1.095883，须区分口径，不能说都改善。零深端候选物理可行但其余内部+.2028m³，未选为默认。残余543.77仍需实际系固/进一步优化，勿称零空区完成。
- 核心证据original-212-baseline.json / cog-audit.json / original-212-lane-repacking.json。B相关30项通过；PlanValidator已修承载向根部传递/连续层数。旧无效逐件搜索实验模块已删除，不重做。
- 最新发现并修复单柜持久化：saveSession旧策略组会省略新backendPlan，重载旧hash；compactAliases顶层undefined会报错。现在只去重完全相同方案并记录实际strategy键；PLAN_SUCCESS清退旧策略组、历史保留。sessionStorage7+reducer7（14项）通过。新增已保存案例列表与OPEN_SAVED_CASE；从后台NB2026-0824-001实际打开并reload，仍为212/8623，REQ_1789035199031/hash306d74495eca3804，已实际验证。单柜会话现为原212，入口可随时通过工作对象类型切回。

## C：Blender/Three.js
- assets-src/blender/rebuild_v3/build_assets.py及*.blend/asset-contract.json/previews；13个GLB输出web-dashboard/public/assets/3d/rebuild-v3：6货物家族、工人、叉车、两地牛、20GP/40GP/40HQ。
- 纸箱独立折口/胶带/厚度/标签；工人连续肢体及真实关节/手脚锚点；叉车链条液压轮栓；蓝青集装箱门附件和木地板，无大侧洞（查看模式可剖切）。保留旧木箱/设备/托盘好结构；缠膜重建为12箱外透明薄膜；FIBC扁吊带/布面/曲面接缝。最后FIBC接缝修正已完成网页旋转近看。
- 共享assetManifest/CargoVisualFactory/loadPackagingAsset/PackagingModelViewer已接Landing、CargoEditor、Twin、等待区；8缩略图来自同GLB，packaging-preview-map.json有映射。部件适配保护五金/标签比例和150mm托盘层；6家族×4尺寸24包络审计通过，asset-envelope-audit.json。Landing多包装、拖拽/滚轮及Twin/CargoEditor实际查看过；最终吨袋吊带、曲面接缝已在网页旋转近看，非只导出文件。
- 短叉第13资产pallet_jack_short.glb 946964字节/50网格/5材质，Blender实改800mm货叉、推杆和负载轮，未整体缩放；jack_short_after.png已看。参考官方Ameise PTM 2.0 800mm/2000kg@400mm载荷中心：https://www.jungheinrich-profishop.co.uk/p/ameise-ptm-20-hand-pallet-truck-with-short-forks-42045-197370/ ，通用参考配置，不冒充精确商品复制/现场拥有。

## D：多柜、客户与版本
- backend/services/tasks/{LoadTaskModel,MultiContainerPlanner,LoadTaskService,TaskPlannerWorker}及/api/load-tasks；MySQL任务/历史/候选事务+CAS；rowId:Ux稳定实物ID，服务/目的地/拆箱点/时窗/相容性，逐柜V25和独立物理检查；锁定位置不动，封柜禁止修改，未分配保留。上限30柜/5000件。
- V25避免V23重复floor beam，FloorCandidate先排序再保留最佳可行beam；混合7托盘从181秒降到2.3秒且正确门槛不变。worker移出API线程，取消/5分钟上限；V2/CrossSection/FastBlock全链显式unitIds。list先排元数据再读JSON，修MySQL Out of sort memory。
- 主GUI任务TASK_e78dde2c-ac5a-49c8-8d5d-98ba4b7f5f2c“多柜与追加客户 · 实测”：v1 14件未分配；v2 2×20GP=9+5；GUI追加乙2件并应用v3=16件/4000kg、9+7，首柜不动、尾柜重排。v4保存短叉参考（VGM/现场资料均空）。v5确认首柜→v6恢复草案→v7确认→v8锁1件→v9锁9件→v10封柜；备注明确本地功能验收、非现场实际记录。未全装时GUI封柜拒绝且v8不变。
- 主任务当前v10：柜1 SEALED/9锁/hash b8cfbdce88cf3184/方案v1；柜2 DRAFT/7/hash ce0fdf8c9a2c3e79/方案v2；计划几何与v3完全相同。task-api-audit.json验证v1–10历史、数量/身份/几何守恒、旧版本409。
- GUI锁后重算四种策略0移动；不同服务客户→新增柜3，拒绝依据明确封柜和服务/目的地/拆箱点不合；部分可装两行→17/18，两原柜/尾柜8件、首柜不动，40m长件未分配。两组测试均退出未应用，主任务保持16件。
- 已修超尺寸静态筛选及详细拒绝文本，真实可装子集照常求解；GUI复验显示40000×1000×1300超各箱型实际内尺寸。候选用实际柜型组合命名、按实物几何/未分配身份/原柜绑定合并等价布局，保留全部策略拒绝；GUI显示1张“2×20GP，4种策略同布局”，自动聚焦变化尾柜。
- 真实并发脚本tools/rebuild_task_concurrency.cjs：明确TEST-ONLY任务TASK_2545e564-ba25-4efa-b4bd-248fc6e14e01，1纸箱未分配；同baseRevision1两写200/409，最终v2且v1完整；task-concurrency-audit.json。约束独立回归task-constraint-audit.json：锁定满柜部分可装、封柜/服务不兼容新柜、超尺寸拒绝。
- 前端/workspace/tasks有任意行/CSV/预设、客户树/逐柜场景/候选确认/历史/导出/执行备注与依据；柜卡准确显示锁n/总数；错误入弹窗，选择器版本同步。FIBC空/省略stackable默认false，显式true保留。

## E：作业、AI与工作区
- floorHandling STANDARD_JACK/SHORT_JACK按叉长、宽、质量和载荷中心验算；TwinScene加载两套真实地牛GLB/关节。标准设备原尾柜0/7 JACK_ENVELOPE_EXCEEDED（首件旋转后长1000<1170），短叉离线7/7（task-operation-probe-short.json），并已保存v4配置。
- GUI可见tab2正常1×自然跑完该尾柜装载7/7和卸载7/7；阶段多帧观察交接、低位输送、抽叉、返回、独立已卸暂存，无报错，DOM profile SHORT_JACK。不是连续录屏逐帧审阅，不等于212/42全程观看；没有把tick测试冒称观看。
- 此阶段发现的TWO_WAY轴、地牛兼容性及统一HIGH_STOW阻断问题，已在下节“条件化叉车及接口”实质修复并正反例复验；历史7件地牛回放不能替代新增接口条件的验收。
- TaskContext/TaskEvidence/TaskAssistant：后端绑定任务/历史/候选/柜/件及已确认比较溯源；逐柜VGM/CSC/木/设备/系固与逐单文件引用，hash绑定过期不沿用，封柜几何不变。国际规则索引按时窗，未知起点不假设宁波适用，来源摘要与官方定位分开。
- 真deepseek-v4-flash，read_current_task/read_evidence/compare_container_options；数值factIds、来源白名单、对象与版本校验、语义守卫与针对重写；tools/rebuild_task_ai_audit.cjs实际模型6/6通过（task-ai-audit.json，v3快照），GUI法规答案也成功。不能说已实时抓取法规。
- 新TaskOperationContext绑定页面回放hash/实物身份/完成件/已知阶段与阻断，来源CLIENT_REPLAY_SNAPSHOT，非后台重新执行或现场证据；播放时暂停提问请求，暂停后读当前动作，恢复/换对象立即隐藏旧答。GUI初次卸载JACK_LIFT误说叉车起升，已修反向中文动作和逐字动作校验、禁止0完成件推断未开始；GUI重试正确解释“地牛放下交接”和短叉，1次503瞬时失败重试成功，未改网络。
- 工作区单视口flex、柜树/检查器独立滚动；AI答案动作靠前、其余依据/来源折叠，自动滚到答案；预置完整方案跟随镜头回退总览；区域标签缩小/中文。1366×768及1600×900实际截图+DOM无页面溢出、时间栏完整；实际拖拽旋转/滚轮成功，viewport已reset。
- 正确性当前：B30；D模型6/Planner3/Floor1/TaskContext5；C/可视化8、CSV7、floor+unload10、持久化13、候选分组2分批通过；21:25最新生产build和当前新改文件定向lint通过。无全量/FPS/Lighthouse。所有exec测试/构建已结束。

## E/F新增：全站与多柜工作面（本轮已实作）
- Application按明确工作对象类型切换多柜任务/单柜案例，保存模式；多柜的工作台、货物、规划、孪生、出运准备统一同一LoadTasksPage实例，任务/柜位/候选跨页延续；保留单柜案例和同条件原212。顶部唯一AI入口按对象读取，未拆成独立聊天墙。
- TaskOverviewScene：实际逐柜transform＋逐件坐标；共享真实集装箱与按尺寸适配的包装GLB，合并/实例化；全柜总览可拖拽、滚轮、点柜聚焦，取景用computeCameraFrame完整边界。已修首次裁尾柜、近壁遮挡和顶部导航溢出。1600×900实际全柜16件/2柜，客户甲橙、乙青；拖拽/缩放明显改变视角；点柜2有一次CDP点击超时，坐标点击后聚焦成功，没有改插件/网络。
- 颜色全任务统一传到TwinScene；实看发现单柜资产本色稀释客户色，已将owner覆盖设完整并暂时白化材质，切回normal恢复原材质色；实际总览→柜2颜色一致。静态复核隐藏时间轴；进入装卸出现1×/装卸/播放，待机0/7；返回静态恢复全7件且timelineCount=0。最后隐藏静态parked forklift，已下一帧复核actorDisplay=none、sceneMode=review。全部柜位属性已改任务摘要，最后需复看该小修。
- TaskBusinessPanels：工作台当前决策＋客户/订单/柜数；货物按客户订单分组并可编辑、实尺寸GLB适配；出运准备逐柜待办与客户资料，右侧真实条款/责任记录。1366×768实看出运准备，doc=1366×768、中心/检查器独立滚动；1600×900工作台doc无溢出；已reset到默认1280×720。
- 后端reviseRows＋preview rowChanges：保留客户/订单/存活实物ID；删除后再增量不复用旧ID；受影响且无锁柜重新实际求解，回草案、递增柜方案版本、清除不再绑定的柜资料；含任何locked或sealed柜的整行编辑拒绝。候选写入前版本检查、应用事务、历史沿用。变更影响包含增/移/移出；不静默改原件/已锁柜。
- 实际GUI用独立并发测试任务TASK_2545e564-ba25-4efa-b4bd-248fc6e14e01，v2的1件500×400×300/8kg改成2件550×400×300/9kg。预览可跨货物→规划保留，确认v3，1×20GP/hash8f892ed6bcd494cb；API核对原件ID/订单ID保留、v2输入仍1/500/8。主任务v10/16及两hash完全不变。首次预览因开发热更新新增hook重挂而丢失，未写数据；停止改前端后重验闭环成功。
- TaskContext/TaskAssistant新增rowId/selectedRow及row_系统数值，校验任务/货物行/实物归属。实际客户乙ORDER-B提问，deepseek-v4-flash正确解释1000×900×1100/180kg/2件/柜2；改选客户甲立即隐藏旧回答。UI选择行会同步所属柜与实物，未分配行也有独立上下文。
- 单柜Dashboard也换同一真实GLB总览；原212实看木箱/设备箱/纸箱区分明显。SavedCasePicker读取正式后台记录，原输入保留到会话/历史，刷新稳定。
- 新检查：LoadTaskModel8＋MultiContainerPlanner4=12 PASS；TaskContext6 PASS；单柜持久化14 PASS；前后端改动定向lint通过。21:59 build1690 modules/21.86s通过；其后仅TwinScene客户色/静态停机、任务全览属性和中文错误文案小修，需定向lint＋最终build。无全量/FPS。

## E/F新增：条件化叉车及接口（22:44）
- forkInterface.js：TWO_WAY必须有相对原长/宽的LENGTH/WIDTH叉轴，按XYZ/YXZ映射校验；方向不合/未知独立阻断。palletJackCompatible改为null/true/false三态，包装类别不再覆盖显式false。后/前端画像保留，单柜和多柜表单均有叉孔、进叉轴、地牛底轮条件；行编辑白名单延续。没有修改原212或主任务v10的输入/方案；因此旧主任务历史7件地牛回放不再代表已通过新增叉孔门槛，不暗改锁定行。
- 新compactForklift.js：COMPACT_FORKLIFT平齐月台参考工况，真实低位进箱、堆垛前停车起升、前移/下降、完整抽叉后降低空叉、返回；反向UnloadMachine使用同一连续轨迹，非地牛handoff。验证车身/门架/门洞/升高背架/已放货/支撑/退出路径、叉长/宽/载荷中心/起升范围；平齐月台确认、桥板整车质量和地板轴载缺项或不足时阻断。只开放有条件的平齐月台参考，不宣称适用于现有斜坡/任意设备。
- 参数来源官方Linde E16 P 1251 08/2025 PDF pp2/5/6：https://www.linde-mh.co.uk/media/Datasheets/EN_ds_e16_e20_p_1251_en_b_0825_view.pdf 。服务质量3090kg、满载前轴4099kg、载荷中心500/600/700/800→1600/1430/1300/1180kg；运行几何使用更大的通用GLB1190宽/2115高/1100叉、自由起升保守限1250。通用外观模型，非商品认证复制；Toyota官方残余载荷指南同时核对高度/中心关系：https://toyota-forklifts.co.uk/guides/residual-capacity-guide/ 。旧2019链接404不用。
- Three.js增加现有真实worker GLB坐姿司机，髋/膝/肘两骨IK接座椅、踏板、方向盘，未缩放人体；真实货叉停止虚假伸缩，改为整车插入/退出。平齐月台渲染与路径同高；实际截图发现地面覆盖木地板，已改月台地面开真实箱内孔，木地板恢复。
- 实际GUI创建TASK_77f97ed4-c6bc-4cfb-ac2c-0601126ca792“平齐月台叉车 · 5件堆高验收”：明确测试客户/TEST-FORKLIFT-5，5×1200×2000×500/260kg、双向LENGTH/不可旋转/2层/承重600kg/不适配地牛。真实20GP求解保存v2，hash c90a38a22b078c66，1300kg，3底层+2上层，x614.1/1814.1/3014.1，y0/500，z176。v3柜资料COMPACT_FORKLIFT、6000kg桥板/5000kg轴载是明确TEST-ONLY合成输入，无对应现场证书；其他出运资料留空。
- 发现设备依据任意文字会使PORT-HANDLING变READY，已修为有记录REVIEW_REQUIRED、无记录EXTERNAL_CONFIRMATION_REQUIRED，展示原记录并明确系统未验真；有测试文字也不能自动放行。TaskContext测试覆盖。
- 五件加载已在可见tab2以1×自然5/5，观察低位、上层已落位、叉车进柜/司机/退出/返回并暂停恢复；不是连续逐帧视频。卸货首次发现2000宽托盘转向后固定1700暂存间距重叠，已暂停修正：当前/下一件、池代表与独立卸货位均按实际旋转包络+间隙。修正后重新从头1×卸货，截图已见5个独立暂存托盘互不重叠，5/5最后设备返回并自然COMPLETED，见F最终复验。
- 检查：作业4文件25PASS，新增宽托盘测试后compact/floor/unload14PASS（compact4）；backend画像4+TaskContext7+LoadTaskModel8=19PASS，资料不自动通过修改后TaskContext7再PASS。定向lint通过。22:36左右build1693modules/24.43s PASS；其后暂存动态间距小修未再build。所有exec测试/构建已结束。

## F最终复验与收尾
- 五件叉车样例修正暂存间距后的1×卸货已自然COMPLETED 5/5，装载亦自然5/5；6项资料待办、设备依据“需责任方复核”已GUI确认，浏览器error日志为空。未把测试资料认作真实现场证书。
- LandingTaskSection读取实际选中任务，显示v10/2客户/2订单/2柜/16件、客户色GLB及真实柜位入口。1366×768和1600×900实际拖拽、滚轮放大；滚轮在canvas内时页面scrollY不变。点击柜2进入7件/hash ce0fdf8c9a2c3e79。AI入口正确预填问题并绑定任务，真实deepseek-v4-flash回答区分历史用户选择与当前重新计算，说明12项逐柜待办、2票订单资料；不声称经济最优。
- “办理客户资料”传具体orderId；GUI客户乙准确打开ORDER-B表单，取消未写入虚假资料。首页单柜空间/证据按钮显式切case，来源阅读器→平衡孪生实测绑定212/hash306d74495eca3804；修复误去多柜页和误进重量模式。CTU中文摘要/官方PDF页103/核对日/质量矩公式已展示。
- 单柜会话新增null叉孔轴字段的精确指纹迁移，仅匹配去除此空字段后的旧输入才重新绑定；真实输入修改仍失效。拒绝旧lastSavedAt会话覆盖新保存。旧tab1退回首页；重新打开NB2026-0824-001并reload，正式212/8623/hash保持；后续多次热更新后Landing仍为同一正式事实。sessionStorage9 PASS。
- 正常首页why/包装/求解说明/多柜/孪生四模式/AI/证据均实际打开。修正浅底标题对比、菜单遮柜门、章节后置padding覆盖造成裁切；相机按标题/右侧阅读区保留空间，标准视图完整。移除tab进入视口就自动改分析模式的错误观察器；首页卸载从实际首件/0已卸开始，去掉固定18件。Three运行态初始化强制刷新标签，卸载→标准不残留暂存牌；实际复验。
- 单柜静态复核隐藏回放时间轴；点装载回放显示控制，实际暂停后返回完整212，页面1366×768无溢出。多柜/全柜客户色的工作台最终1280×720无报错，viewport已reset。
- 最终针对性检查：前端新增页面/入口/持久化/三维及后端TaskContext/TaskEvidence/LoadTaskModel/PackagingProfile定向lint零警告；相机3 PASS；前述业务/物理回归均保留。最终生产build1695 modules/21.32s PASS。所有测试/构建结束，Vite4173与后端3000继续运行。
- 最后API核对：原212 REQ_1789035199031/hash306d74495eca3804/8623kg；主任务v10/16件/0未分配、柜1 SEALED9/hash b8cfbdce88cf3184、柜2 DRAFT7/hash ce0fdf8c9a2c3e79，均未被复验改写。未commit/push。

## 明确剩余限制
- 原212深端543.77mm仍在；精确内部空隙改善与旧网格未解释空间增加须分别解释，不声称全部空隙消失、装载率提升或全局最优。155件上层仍涉及派生承载依据，实际包装承载需责任方确认。
- 新叉车正例仅覆盖已声明的平齐月台/桥板/轴载/叉孔/载荷范围；地牛、高位或轴向不合条件按实际门槛阻断。未给原212/已锁主任务悄悄补叉轴和设备资料，未声称原212整队真实装卸全部可执行。
- 实际自然1×完整观察的最终新物理样例为5件，历史短叉7件是在更早接口条件下；浏览器离散观察不是连续逐帧视频。通用GLB不是特定商品的认证数字复制。
- VGM/CSC/木包装/系固、实际设备证书、承运人及码头受理仍需真实外部资料；任务里的装入/封柜记录带本地验收说明，不能视为现场发生或外部放行。法规是有日期的来源索引与本地解释，无实时法规/码头接口。
