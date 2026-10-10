const {validateExplanation} = require('../../services/AssistantFactGuard');
const {renderBasis} = require('../../services/AssistantFactGuard');
const context={evidence:[{id:'SPACE-VOID'}]};
const base={conclusion:'指标口径不同，请对照事实卡。',basis:[],cautions:['引用材料是项目摘要，需打开官方来源核对。'],nextSteps:[],sourceIds:['SPACE-VOID']};
test('blocks the observed unsupported original-text claim and metric confusion',()=>{
  expect(validateExplanation({...base,conclusion:'引用为原文。'},context).valid).toBe(false);
  expect(validateExplanation({...base,conclusion:'空间利用率为95.07%。'},context).valid).toBe(false);
  expect(validateExplanation({...base,conclusion:'几何稳定仅指重心。'},context).valid).toBe(false);
  expect(validateExplanation({...base,conclusion:'该货物位于深端净距区。'},context).valid).toBe(false);
  expect(validateExplanation({...base,conclusion:'该货物邻接深端净距区的边界。'},context).valid).toBe(true);
  expect(validateExplanation({...base,conclusion:'货物邻接边界，不位于空隙内。'},context).valid).toBe(true);
  expect(validateExplanation({...base,conclusion:'货物并非位于净距区。'},context).valid).toBe(true);
  expect(validateExplanation({...base,conclusion:'不能认定货物位于空隙内。'},context).valid).toBe(true);
  expect(validateExplanation({...base,conclusion:'不能认定所有余隙已解释；货物位于空隙内。'},context).valid).toBe(false);
});
test('accepts qualitative explanations with known citations, rejects invented citations',()=>{
  expect(validateExplanation(base,context).valid).toBe(true);
  expect(validateExplanation({...base,sourceIds:['made-up']},context).valid).toBe(false);
});
test('permits known container codes and binds labelled numbers to exact fact fields',()=>{
  const ctx={...context,container:'20GP',recommendation:{alternatives:[{type:'40HQ'}]},facts:[{id:'input_weight',label:'订单货物总重',value:1488,unit:'kg'}]};
  const answer={...base,conclusion:'建议20GP，40HQ仍为初筛。',basis:[{text:'核对订单货物总重。',factIds:['input_weight']}]};
  expect(validateExplanation(answer,ctx).valid).toBe(true);
  expect(renderBasis(answer.basis,ctx)[0]).toContain('订单货物总重 1,488 kg');
  expect(validateExplanation({...answer,basis:[{text:'可以装入。',factIds:['invented_capacity']}]},ctx).valid).toBe(false);
  expect(validateExplanation({...answer,conclusion:'利用率1488%。'},ctx).valid).toBe(false);
  expect(validateExplanation({...answer,conclusion:'利用率五成。'},ctx).valid).toBe(false);
});
test('accepts the verified zero estimate with a limitation without accepting invented zeros or positive proof',()=>{
  const answer={...base,conclusion:'未解释空间估算为零，仅说明当前网格未识别出未解释区，不等于所有余隙成因已解释或已证明最优。'};
  const zeroContext={...context,facts:[{id:'unexplained_volume',value:0}]};
  expect(validateExplanation(answer,zeroContext).valid).toBe(true);
  expect(validateExplanation(answer,{...context,facts:[{id:'unexplained_volume',value:0.01}]}).valid).toBe(false);
  expect(validateExplanation(answer,context).valid).toBe(false);
  expect(validateExplanation({...base,conclusion:'所有余隙成因已解释。'},zeroContext).valid).toBe(false);
  expect(validateExplanation({...base,conclusion:'不代表已证明最优；所有余隙成因已解释。'},zeroContext).valid).toBe(false);
  expect(validateExplanation({...base,conclusion:'深端净距为零。'},zeroContext).valid).toBe(false);
});
