'use strict';

function validateExplanation(answer, context) {
  const keys=['conclusion','basis','cautions','nextSteps'];
  const lines=keys.flatMap(key=>Array.isArray(answer[key])?answer[key]:[answer[key]]).map(s=>typeof s==='object'?s?.text:s).filter(s=>typeof s==='string');
  // Quantitative values belong to deterministic fact cards. Do not attempt to
  // match arbitrary numbers to unrelated fields in a large JSON snapshot.
  const codes=new Set([context.container,...(context.recommendation?.alternatives || []).map(a=>a.type)].filter(c=>/^(20GP|40GP|40HQ)$/.test(c)));
  const exactZero=(context.facts || []).some(f=>f.id==='unexplained_volume' && f.value===0);
  const prose=s=>s.replace(/\b(?:20GP|40GP|40HQ)\b/g,code=>codes.has(code)?'柜型':code)
    .replace(/未解释空间估算为零/g,claim=>exactZero?'当前网格未识别出未解释区':claim);
  const numericLine=lines.find(s=>/[\d０-９]|百分之|千分之|[一二三四五六七八九十几]+成|(?:为|是|达|等于|均为)零/.test(prose(s)));
  if(numericLine) return {valid:false,reason:'NUMERIC_CLAIM_OUTSIDE_FACT_CARD',invalidText:numericLine};
  const factIds=new Set((context.facts || []).map(f=>f.id));
  if((answer.basis || []).some(row=>typeof row==='object' && (!Array.isArray(row.factIds) || row.factIds.some(id=>!factIds.has(id))))) return {valid:false,reason:'UNKNOWN_FACT_REFERENCE'};
  if(lines.some(s=>/(?:引用|摘要|这些内容|来源).{0,8}(?:均为|就是|为|是)(?:法规)?原文|几何稳定(?:仅|只)(?:指|是|检查).{0,5}重心/.test(s))) return {valid:false,reason:'UNSUPPORTED_SOURCE_OR_GEOMETRY_CLAIM'};
  if(lines.some(s=>/(?:已经|全部|已实际)(?:完成装箱|实际装箱|可以出运|通过认证)/.test(s))) return {valid:false,reason:'UNSUPPORTED_ACTUAL_APPROVAL'};
  if(lines.some(s=>s.split(/[，。；！？;!?]/).some(clause=>{
    const claim=clause.match(/(?:货物|该物件).{0,12}?(位于|处于|放在|占据).{0,8}(?:净距区|净空区|空隙内)/);
    if(!claim)return false;
    const beforeVerb=clause.slice(0,clause.indexOf(claim[1],claim.index));
    return !/(?:不|并非|不能|不应|不可|未)(?:被|直接|理解为|认为)?$/.test(beforeVerb)
      && !/(?:不能说|不等于|不代表|不能认定|不可推断)[^，。；]*$/.test(beforeVerb);
  }))) return {valid:false,reason:'CARGO_CANNOT_OCCUPY_EMPTY_GAP'};
  const proofClaim=/(?:余隙|空隙|空洞).{0,12}(?:均已解释|全部解释|成因已解释|完全解释)/;
  if(lines.some(s=>s.split(/[，。；！？;!?]/).some(clause=>{
    const claim=clause.match(proofClaim);
    if(!claim)return false;
    const prefix=clause.slice(0,claim.index);
    return !/(?:不能说|不等于|不代表|未证明|不能认定|不可推断)[^，。；]*$/.test(prefix);
  })))return {valid:false,reason:'GRID_ESTIMATE_IS_NOT_GLOBAL_VOID_PROOF'};
  const known=new Set((context.evidence || []).map(e=>e.id));
  if((answer.sourceIds || []).some(id=>!known.has(id))) return {valid:false,reason:'UNKNOWN_CITATION'};
  return {valid:true};
}
function renderBasis(rows, context) {
  const facts=new Map((context.facts || []).map(f=>[f.id,f]));
  return (rows || []).slice(0,4).map(row=>{
    if(typeof row==='string')return row;
    const bound=[...new Set(row.factIds || [])].slice(0,4).map(id=>facts.get(id)).filter(Boolean)
      .map(f=>`${f.label} ${Number(f.value).toLocaleString('zh-CN',{maximumFractionDigits:f.unit==='件'?0:f.unit==='m³'?3:2})} ${f.unit}`);
    return `${row.text}${bound.length?`（${bound.join('；')}）`:''}`;
  });
}
module.exports={validateExplanation,renderBasis};
