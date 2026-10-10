// Entry is along container X. XYZ / YXZ describe the original cargo axes,
// so horizontal rotation must also rotate a two-way base's openings.
export function validateForkInterface(cargo,{jack=false}={}) {
  const p=cargo.packagingProfile||{},entry=cargo.forkEntry||p.forkEntry;
  const reasons=[];
  if(!['TWO_WAY','FOUR_WAY'].includes(entry)) reasons.push({code:'FORK_INTERFACE_UNVERIFIED',message:'请在货物约束中声明双向或四向叉孔；包装名称不能代替进叉接口。'});
  if(entry==='TWO_WAY') {
    const axis=cargo.forkEntryAxis||p.forkEntryAxis;
    const orientation=cargo.orientation || (Number(cargo.l)===Number(cargo.length)&&Number(cargo.w)===Number(cargo.width)?'XYZ':null);
    if(!['LENGTH','WIDTH'].includes(axis)||!['XYZ','YXZ'].includes(orientation)) reasons.push({code:'FORK_AXIS_UNVERIFIED',message:'双向叉孔缺少相对原始长/宽的进叉轴或可靠朝向；请补录后重新求解。'});
    else if((axis==='LENGTH'?'X':'Y')!==orientation[0]) reasons.push({code:'FORK_AXIS_MISMATCH',message:'当前旋转后的双向叉孔不朝向箱门，设备不能沿柜长进叉；请修改允许朝向并重新比较方案。'});
  }
  const compatible=cargo.palletJackCompatible ?? p.palletJackCompatible;
  if(jack&&compatible!==true)reasons.push({code:'JACK_INTERFACE_UNVERIFIED',message:compatible===false?'已声明底座不适配地牛；请选择匹配的叉车工况或修改有依据的底座输入。':'地牛底轮通道、叉孔与底板相容性未声明；请在货物约束中确认。'});
  return {valid:!reasons.length,reasons};
}
