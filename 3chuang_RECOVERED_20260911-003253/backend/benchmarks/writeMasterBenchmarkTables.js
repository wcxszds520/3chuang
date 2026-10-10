'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const rel='artifacts/master-rebuild-20260922/algorithm/final-frozen-20260926';
const summary=JSON.parse(fs.readFileSync(path.join(root,rel,'summary.json'),'utf8'));
const data=JSON.parse(fs.readFileSync(path.join(root,rel,'benchmark.json'),'utf8'));
if(data.rows.length!==150)throw Error('Final matrix is incomplete');
const solvers=Object.keys(summary.solvers);
let text='<!-- FINAL_RESULTS -->\n\n';
text+=`最终证据目录：\`${rel}\`。150/150 次运行完成；节点 ${summary.node}，${summary.machine.cpu}，${summary.machine.logicalCpus} 逻辑核心，内存 ${summary.machine.systemMemoryGiB} GiB。这一轮同时运行回归验证，时延只按本机本轮记录解释。\n\n`;
text+='|求解器|共同 VALID|INVALID|UNSUPPORTED|ERROR|有效返回时间范围 ms|Node worker 峰值 MiB|\n|---|---:|---:|---:|---:|---:|---:|\n';
for(const [solver,s] of Object.entries(summary.solvers))text+=`|${solver}|${s.status.VALID||0}|${s.status.INVALID||0}|${s.status.UNSUPPORTED||0}|${s.status.ERROR||0}|${s.minValidReturnedMs}–${s.maxValidReturnedMs}|${s.peakWorkerRssMiB}${solver==='packingsolver'?'（仅适配器）':''}|\n`;
text+='\n每格是两次装入数量及有效候选返回耗时均值 ± 总体标准差（ms）；U 为不支持，I 为独立验证失败。两个数不同不能隐去较差的一次。每次利用率、原始时长、布局 hash、内存与违规码见 summary.json 和 runs 下的 row/validation/plan 文件。\n\n';
text+='|案例|Native V2.5|FastBlock|SOURCE|PackingSolver|COMMERCE|\n|---|---|---|---|---|---|\n';
for(const c of summary.cases){
  const cells=solvers.map(s=>{
    const v=c.solvers[s],rows=data.rows.filter(r=>r.caseId===c.caseId&&r.solver===s);
    const counts=rows.map(r=>r.status==='UNSUPPORTED'?'U':r.status==='INVALID'?`I(${r.loadedCount})`:r.status==='ERROR'?'ERROR':String(r.loadedCount)).join('/');
    return `${counts}${v.status.VALID?`；${v.meanValidReturnedMs} ± ${v.stdValidReturnedMs}`:''}`;
  });
  text+=`|${c.caseId}|${cells.join('|')}|\n`;
}
text+='\n**额外业务门禁不能从共同 VALID 推导。Native 30 次只有 10 次 hardConstraintsPass=true，其中 4 次是零装载空方案；只有 6 次为非空且过 Native 完整业务门禁。** 空方案不代表任务完成。COMMERCE 返回字段的现有定义并不等于 Native 的设备路径、CoG 和卸后稳定全套门禁；其 30 次共同 VALID 不能称为 30 次现场可放行。\n\n';
text+='|Native 案例（两次结果一致）|装入数|额外门禁|失败或剩余原因|\n|---|---:|---|---|\n';
for(const r of data.rows.filter(r=>r.solver==='native-v25'&&r.repeat===1)){
  if(!r.resultPath){text+=`|${r.caseId}|—|UNSUPPORTED|无固定位置种子接口，重规划锁定流程另行验证|\n`;continue;}
  const p=JSON.parse(fs.readFileSync(path.join(root,r.resultPath),'utf8')),reasons=[];
  if(!p.validator.checks.cog.withinPolicy)reasons.push(`CoG横向${p.validator.checks.cog.lateral.toFixed(2)}%、纵向${p.validator.checks.cog.longitudinal.toFixed(2)}%`);
  if(p.operationFeasibility.blockedCount)reasons.push(`设备/人员作业阻挡${p.operationFeasibility.blockedCount}`);
  if(p.portAccessibility.status!=='FULL_UNLOAD_PASS')reasons.push(p.portAccessibility.status);
  if(!p.portAccessibility.postUnloadStabilityPass)reasons.push('卸后稳定未通过');
  if(p.mandatoryGateViolationCount)reasons.push(`强制证据门禁${p.mandatoryGateViolationCount}`);
  if(!r.loadedCount)reasons.push('空方案；构造返回 NO_CROSS_SECTION_LAYER_CAPACITY，未完成装载，未证明无解');
  else if(r.loadedCount<r.inputCount)reasons.push(`未装${r.inputCount-r.loadedCount}件，未证明不可装`);
  text+=`|${r.caseId}|${r.loadedCount}/${r.inputCount}|${p.hardConstraintsPass?'PASS':'REJECTED'}|${reasons.join('；')||'本模型全部通过'}|\n`;
}
text+='\nSOURCE 异构案例出现 STACK_COG_OUTSIDE_SUPPORT；最终一轮为 35 件有效/38 件无效，受时间预算影响，不能用无效候选装入数展示优胜。外部在纯矩形域有效且部分案例快速，但尚未覆盖主工作流的所有业务合同；这正是未将其提升到生产的证据。基准中的 changed-width 是重解同事实的能力比较，不冒充 retain/local-repair 的状态变更端到端测试；该端到端证据在 DEMO_AND_QA.md。\n';
text+='\n最终修复后回归：`algorithm/active-verified-tests.json`，7 suites、331/331 PASS（256.579 s），覆盖 V2.5、正式编排器、方向 R1、Cargo、包装、物理指标与新增承重信任边界。`active-final-tests.json` 的两项新增承重失败被保留，修复后的专项 `bearing-final-tests.json` 为23/23，综合复验不再失败。`final-eslint.json` 0 errors。以上为明确的活动范围，不是整个旧后端全量测试已绿；旧缺失模块/数据库/退役算法失败仍见主报告分类。\n';
const file=path.join(root,'ALGORITHM_BENCHMARK.md');
const base=fs.readFileSync(file,'utf8').split('<!-- FINAL_RESULTS -->')[0];
fs.writeFileSync(file,base+text);
