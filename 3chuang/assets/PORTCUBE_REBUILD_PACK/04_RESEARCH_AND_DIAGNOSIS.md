# 研究依据、算法线索与设计决定

研究时点：2026-09-10。外部资料与用户项目记录分开处理。以下是设计与研发建议，不是对当前本地代码的实机验收，更不是运输安全认证。

## 一、同条件算法线索

用户提供的 RESULT.md 记录原212件/8623kg/40HQ：深端772→667.695mm，对应整体向深端移动104.305mm；纵向偏移8.266%→9.999985%；贴齐深端的试验值21.099%。旧hash095db720bcd6b519，新hash155f34bf236fc0c8，输入指纹6e71f60a。应读取本地原始方案再次复核这些历史记录。

纯算术（L取历史12032mm）：
- 21.099−8.266＝12.833个百分点。
- 772/L×100＝6.4162234个百分点。
- 772/(L/2)×100＝12.8324468个百分点。
- 104.305/(L/2)×100＝1.7337932个百分点。

解释：结果强烈提示报告值可能按半柜长归一化。它不独立证明算法公式或所用标准一定错误；可能存在项目自定义百分比、不同数据来源/分母等。必须核对输入原值和真正实现。

复核公式应从质量加权毫米坐标开始：x_c＝Σ[m_i·(x_i+l_i/2)]/Σm_i（只适用于x_i为最小角、l_i为已旋转后的纵向尺寸）。内部输入若为中心坐标则不能再加半长。柜内物品重心与含箱体皮重的整柜重心不可混为一谈。

同时输出偏移毫米、除全长的百分比、除半长的百分比；哪一个用于哪种指导必须有定义。不能把项目里半长归一化结果直接套到另一种百分比阈值，也不能仅为了“过线”改分母。若确有口径错误，旧布局要在纠正后的口径下重新评价，不能把数值减半冒充布局空间改善。

即使假设旧21.099%应该按全长变成10.5495%，它也不自动成为完全合格或证明零间距可行；仍需真正重排和完整条件检查。

## 二、现实装载与拼箱边界

CTU Code Annex7 §1.2区分紧密装载和有固定措施的装载；§3.1.4讨论货物重心靠近柜的长度/宽度中部，以及一般与特定情形的偏心指导。不能把“有空隙必然倾倒”“贴后壁必然安全”“≤10%自动全部合格”作为未经条件化的通则。

本项目要优化的是不必要、未受约束、缺乏合理解释的大空区。固定措施必须有实际配置与能力依据，不能靠添加模型或免责声明获得安全通过。

Maersk的实际LCL流程是相容货物在起运地拼装封柜、到目的地拆分。项目中多站点卸货顺序应说明具体应用工况，不应把普通海运挂靠港当作随意开箱卸货地点。

多柜规划：先解决哪件分配哪个柜，再在每个柜里求几何、支撑与作业可行解，最后反馈调整分配。Google OR-Tools基础Bin Packing示例可作为分配层参考，它本身不是三维承重装箱算法。

## 三、产品设计决定（本方案建议）

### 1. 优质模型的增量合并
历史Competition2.5报告记有细节较丰富的集装箱/叉车和多包装cargo-kit。当前场景不可仅按“最新包”选择资产。建立族级映射与材质变体；近景比形体、材质与机械合理性，不比文件日期或面数排行榜。

### 2. 空间工作区
主画布成为工作对象。顶部简洁任务上下文；左侧可折叠订单/柜列表；右侧单检查器承接属性、证据和AI。静态看方案时无巨型时间轴，进入装卸才显现紧凑控制；多柜总览和单柜聚焦连续切换。

### 3. AI输出就是业务成果
询问选柜→组合对比；询问补货→候选空间与影响；询问法规→来源与责任；询问作业→当前物体和步骤。简单问题用清楚短回答，复杂任务展开结果面，不要所有回答都重复同一份“结论/依据/注意事项”长模板。

### 4. 图像先定方向，运行态才验收
优先生成有限的关键参考图，避免无限美术探索。图像不是工程蓝图，不能伪装运行截图。通过Blender实际制作可编辑资产，并在Three.js中同类镜头核对；网页效果和动作不合格则继续改网页/资产。

### 5. 分阶段但不缩小目标
原212问题、视觉资产、多柜拼柜、全站AI各有独立完成状态。先用一个可运行高质量片段验证艺术方向，再扩展；不能用42件回放或漂亮首页抵消原算法未修复，也不能以算法通过抵消白模/游离门杆。

## 四、官方研究入口

以下链接供执行代理按需复核；不要每个阶段重复全部下载和阅读。

1. OpenAI — Model guidance / Using GPT-6 Astra
https://developers.openai.com/api/docs/guides/latest-model
用途：清除旧项目指令冲突；明确自主执行边界；只做与改动相关的验证。

2. OpenAI — Architectural visualization with Astra（2026-09-04）
https://developers.openai.com/blog/architectural-visualization-with-astra
用途：Blender实际制作、观察渲染并迭代；脚本与GUI结合。不是要求把本项目迁移到Unreal。

3. OpenAI — Computer Use
https://learn.chatgpt.com/docs/computer-use
用途：遵守当前工具接口与权限，用真实浏览器/桌面画面核查；不把DOM验证冒称人眼效果验收。

4. Microsoft — Introducing a new design for Microsoft 365 Copilot（2026-05-28）
https://www.microsoft.com/en-us/microsoft-365/blog/2026/05/28/introducing-a-new-design-for-microsoft-365-copilot/
用途：任务上下文、渐进呈现与业务工作面；不是复制品牌UI。

5. SAP — Conversations / Engagement Layer
https://www.sap.com/design-system/compositional-design-system-and-engagement-layer/engagement-layer/conversations
用途：与当前业务对象和任务一起工作的AI，结果里有操作入口。

6. Shapr3D — Adaptive user interface
https://support.shapr3d.com/hc/en-us/articles/7873882619548-Adaptive-user-interface
用途：随当前选择呈现所需工具；旧发布日期不影响其交互参考价值，不伪称2026新发布。

7. Ant Design X — 官方介绍
https://x.ant.design/components/introduce-cn/
用途：可按现有技术栈选择性借鉴/使用AI界面组件，不强制全站换库。

8. IMO — CTU Code 官方入口
https://www.imo.org/en/ourwork/safety/pages/ctu-code.aspx

9. ILO — CTU Code 官方公开PDF（2014版，2016合刊）
https://www.ilo.org/sites/default/files/wcmsp5/groups/public/@ed_dialogue/@sector/documents/publication/wcms_492710.pdf
用途：Annex7§1.2、§3.1.4等原文核对。PDF页序与印刷页码不同，§3.1.4位于印刷页96、PDF零基页102。后续修订草案不能未经核实当成已生效条款。

10. Maersk — Less-than-Container Load Shipping
https://www.maersk.com/transportation-services/ocean-transport/lcl
用途：真实拼箱业务流程与相容运输服务。

11. EasyCargo — Advanced priority groups settings
https://help.easycargo3d.com/article/97/advanced-priority-groups-settings-
用途：分组、叠放和隔离政策可分开，不把客户ID默认变成几何隔墙。

12. Google OR-Tools — The Bin Packing Problem
https://developers.google.com/optimization/pack/bin_packing
用途：多柜分配层示例；必须另做真正三维与承载/卸货验证。

13. Three.js — Color management
https://threejs.org/manual/en/color-management.html
用途：排查资产导入后颜色/贴图/材质一致性，不预设白模一定是某一种原因。

14. CMIT — 2026电脑版作品提交流程
https://www.cmit.cn/html/liucheng/show-277-45689-1.html
用途：确认实际提交要求、原创与既往获奖作品限制；不是用“商业模板”代替原创设计。若PORTCUBE与用户此前获奖项目属于同一作品，应向组委会确认可参赛性，不能自行认为改名或加功能就豁免。该事项不妨碍本地技术改进，但参赛声明需如实。

## 五、需要保持清楚的未知

没有当前完整仓库的实机检查，不能确认CoG公式已错误、白色具体根因、最新资产是否已正确加载、所有作业是否可执行，或已经实现多柜。文件报告与浏览器截图的不同状态必须由执行代理统一核对。
2027未发布产品不能作为“已被市场验证”的参考；使用本次已查到的实际设计，以及有明确出处的公开预告。
不能保证单个提示词带来某种获奖结果或全球最优解。完成标准是本项目的真实可见改进和可复核数据，而不是夸大标签。
