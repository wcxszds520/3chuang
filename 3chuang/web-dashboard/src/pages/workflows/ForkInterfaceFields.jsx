export default function ForkInterfaceFields({value,onChange}){
  return <fieldset className="task-fork-interface"><legend>底座与进叉接口</legend>
    <label>叉孔形式<select value={value.forkEntry||value.packagingProfile?.forkEntry||''} onChange={e=>onChange('forkEntry',e.target.value)}><option value="">待确认</option><option value="NOT_APPLICABLE">无叉孔</option><option value="TWO_WAY">双向</option><option value="FOUR_WAY">四向</option></select></label>
    <label>双向进叉轴<select value={value.forkEntryAxis??value.packagingProfile?.forkEntryAxis??''} onChange={e=>onChange('forkEntryAxis',e.target.value||null)}><option value="">待确认 / 四向不适用</option><option value="LENGTH">沿输入长度方向</option><option value="WIDTH">沿输入宽度方向</option></select></label>
    <label>地牛底轮与底板<select value={String(value.palletJackCompatible??value.packagingProfile?.palletJackCompatible??'')} onChange={e=>onChange('palletJackCompatible',e.target.value===''?null:e.target.value==='true')}><option value="">未确认相容性</option><option value="true">已确认底轮可通行</option><option value="false">不适配地牛</option></select></label>
  </fieldset>;
}
