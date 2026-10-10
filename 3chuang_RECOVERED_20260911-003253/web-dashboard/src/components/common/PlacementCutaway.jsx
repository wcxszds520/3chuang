export default function PlacementCutaway({plan,item}) {
  if(!item)return <p>当前方案还没有可展示的落位。</p>;
  const box=plan.containerInfo||{},L=Number(box.innerLength),W=Number(box.innerWidth),H=Number(box.innerHeight);
  const from=Math.max(0,Number(item.x)-400),to=Math.min(L,Number(item.x)+Number(item.l)+650);
  const span=to-from;
  const scale=Math.min(480/(span+W*.55),270/(H+W*.26));
  const offset=(610-(span+W*.55)*scale)/2;
  const project=(x,y,z)=>[offset+(x-from+z*.55)*scale,315-(y+z*.26)*scale];
  const poly=points=>points.map(p=>project(...p).join(',')).join(' ');
  const prism=(c,selected=false)=>{
    const x=Number(c.x),y=Number(c.y),z=Number(c.z),l=Number(c.l),w=Number(c.w),h=Number(c.h);
    return <g key={c.cargoId} stroke={selected?'#146eac':'#9daeb5'} strokeWidth={selected?2:1} fill={selected?'#298be0':'#cad4d6'} opacity={selected?1:.38}>
      <polygon points={poly([[x,y,z],[x+l,y,z],[x+l,y+h,z],[x,y+h,z]])}/>
      <polygon points={poly([[x+l,y,z],[x+l,y,z+w],[x+l,y+h,z+w],[x+l,y+h,z]])} fill={selected?'#145a99':'#a8bdc3'}/>
      <polygon points={poly([[x,y+h,z],[x+l,y+h,z],[x+l,y+h,z+w],[x,y+h,z+w]])} fill={selected?'#81c8ff':'#dde7e9'}/>
    </g>;
  };
  const support=(plan.loadedCargo||[]).filter(c=>c.cargoId!==item.cargoId && Number(c.y)+Number(c.h)<=Number(item.y)+1 && Number(c.x)+Number(c.l)>from && Number(c.x)<to);
  return <figure className="placement-cutaway">
    <figcaption><strong>箱内局部剖视</strong><span>按当前方案尺寸与坐标绘制</span></figcaption>
    <svg viewBox="0 0 610 370" role="img" aria-label={`${item.cargoId} 在箱内的真实落位与支撑关系`}>
      <polygon points={poly([[from,0,0],[to,0,0],[to,0,W],[from,0,W]])} fill="#e0e9e9" stroke="#87a0a8"/>
      <polygon points={poly([[from,0,W],[to,0,W],[to,H,W],[from,H,W]])} fill="#e7eff1" fillOpacity=".5" stroke="#9aacb3" strokeDasharray="4 5"/>
      {support.map(c=>prism(c))}{prism(item,true)}
      <text x="45" y="352" fill="#426270" fontSize="15">X {from.toFixed(0)}–{to.toFixed(0)} mm · 高 X 方向为箱门 →</text>
      <text x="45" y="27" fill="#284d65" fontSize="15">底面 Y = {Number(item.y).toFixed(0)} mm · {Number(item.y)===0?'由箱底支撑':'下层支撑货物以浅色显示'}</text>
    </svg>
    <p>只展开当前对象及下层支撑；上层和前方遮挡已剖去。外观是尺寸包络，蓝色对象没有被单独放大。</p>
  </figure>;
}
