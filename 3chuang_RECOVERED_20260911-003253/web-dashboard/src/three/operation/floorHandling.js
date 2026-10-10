import { samplePolyline, lerpPoint, pointAlongPolyline, sweptCargoIntersects } from './geometry.js';
import { groundAtXZ, YARD_LEVEL_MM } from './stagingLayout.js';

export const HANDOFF_PHASES = {
  HANDOFF_LOWER: { label:'门外放下托盘',action:'叉车将托盘放在平整交接位，货叉卸载',duration:1.2 },
  FORK_WITHDRAW: { label:'叉车退出交接位',action:'货叉抽离后，叉车退至侧方等候',duration:8.5 },
  JACK_APPROACH: { label:'地牛接近托盘',action:'人员握持地牛把手，沿空通道接近托盘',duration:8 },
  JACK_INSERT: { label:'地牛插入托盘',action:'低位短货叉进入托盘孔位',duration:1.4 },
  JACK_LIFT: { label:'地牛低位抬升',action:'抬起托盘离地，进入箱内输送；坡道能力仍需现场核验',duration:1.2 }
};

export const forkliftHome = container => ({x:Number(container.innerLength)+10400,y:YARD_LEVEL_MM,z:-1500});
export const MANUAL_PLACEMENT_POLICY = Object.freeze({ maximumBaseMm:1100, maximumGripMm:1500, minimumSupportRatio:0.95 });

export function supportFootprintRatio(cargo, placed) {
  const rectangles = placed.filter(c => Math.abs(Number(c.y) + Number(c.h) - Number(cargo.y)) < 1).map(c => ({
    x0: Math.max(Number(cargo.x), Number(c.x)), x1: Math.min(Number(cargo.x) + Number(cargo.l), Number(c.x) + Number(c.l)),
    z0: Math.max(Number(cargo.z), Number(c.z)), z1: Math.min(Number(cargo.z) + Number(cargo.w), Number(c.z) + Number(c.w))
  })).filter(r => r.x1 > r.x0 && r.z1 > r.z0);
  const xs = [...new Set(rectangles.flatMap(r => [r.x0, r.x1]))].sort((a,b) => a-b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const spans = rectangles.filter(r => r.x0 < xs[i] && r.x1 > xs[i-1]).sort((a,b) => a.z0-b.z0);
    let end = -Infinity, width = 0;
    for (const r of spans) { width += Math.max(0, r.z1 - Math.max(end, r.z0)); end = Math.max(end, r.z1); }
    area += (xs[i] - xs[i-1]) * width;
  }
  return area / (Number(cargo.l) * Number(cargo.w));
}

export function validateFloorHandling(cargo, container, placed, path) {
  const reasons=[];
  const manual=cargo.handlingMethod==='manual';
  const base=Number(cargo.y||0);
  if (manual && base>1) {
    const grip=base+Math.min(250,Number(cargo.h)*.35);
    if(base>MANUAL_PLACEMENT_POLICY.maximumBaseMm || grip>MANUAL_PLACEMENT_POLICY.maximumGripMm)
      reasons.push({code:'HIGH_STOW_UNVERIFIED',message:`目标底面 ${base} mm 超出本演示站立人工放置范围；需要另行确认高位设备与操作方法。`});
    const supporters=placed.filter(c=>Math.abs(Number(c.y)+Number(c.h)-base)<1);
    if(supportFootprintRatio(cargo,placed)<MANUAL_PLACEMENT_POLICY.minimumSupportRatio || supporters.some(c=>c.stackable===false && c.x<cargo.x+cargo.l && c.x+c.l>cargo.x && c.z<cargo.z+cargo.w && c.z+c.w>cargo.z))
      reasons.push({code:'PLACEMENT_SUPPORT_UNVERIFIED',message:'目标层缺少已就位且允许承压的连续支撑面，暂停取货。'});
  } else if (!manual && base>1) reasons.push({code:'HIGH_STOW_UNVERIFIED',message:`目标底面 ${base} mm：低位地牛不能堆高，需另行验证堆高设备。`});
  const jackCompatible=cargo.packagingType==='PALLETIZED_CARTONS' || cargo.packagingProfile?.palletJackCompatible===true;
  const forkEntry=cargo.forkEntry || cargo.packagingProfile?.forkEntry;
  if(!manual && (!jackCompatible || (forkEntry && !['TWO_WAY','FOUR_WAY'].includes(forkEntry)))) reasons.push({code:'FORK_INTERFACE_UNVERIFIED',message:'未声明与地牛匹配的运输底座及双向/四向叉孔，暂停演示本件搬运。'});
  if(!manual && (Number(cargo.weight)>2000 || Number(cargo.w)<680 || Number(cargo.l)<1170)) reasons.push({code:'JACK_ENVELOPE_EXCEEDED',message:'货物重量或底座尺寸不匹配当前标准地牛（货叉长 1170 mm）；需要匹配其他设备。'});
  if(reasons.length)return {valid:false,reasons};
  const points=manual ? [...path.manualEntry.approach, ...[path.manualEntry.faceLift,path.manualEntry.hover,path.target].filter(Boolean)] : path.entry;
  const l=Number(cargo.l),w=Number(cargo.w);
  const actorPath = points.map(p => ({ x:p.x+l+(manual?80:630), y:0, z:p.z+w/2-230 }));
  const body = { l:360, w:460, h:1820 };
  for (let i=1;i<actorPath.length;i++) {
    const blocker=placed.find(c=>sweptCargoIntersects(body,actorPath[i-1],actorPath[i],c));
    if(blocker){reasons.push({code:'PERSON_PATH_OBSTRUCTED',message:`人员连续扫掠通道被 ${blocker.sku||blocker.cargoId} 占用；不允许踩过货堆。`,cargoId:blocker.cargoId});break;}
  }
  if (!manual && path.exit?.length) {
    // Conservative low-speed envelope for the jack housing behind the pallet.
    // Fork channels and ramp traction still require actual equipment data.
    const housing={l:550,w:680,h:550};
    const exit=path.exit.map(p=>({x:p.x+l+30,y:0,z:p.z+w/2-340}));
    for(let i=1;i<exit.length;i++) {
      const blocker=placed.find(c=>sweptCargoIntersects(housing,exit[i-1],exit[i],c));
      if(blocker){reasons.push({code:'EQUIPMENT_EXIT_OBSTRUCTED',message:`放置后地牛退出包络与 ${blocker.sku||blocker.cargoId} 相交`,cargoId:blocker.cargoId});break;}
    }
  }
  return {valid:!reasons.length,reasons,method:'CONTINUOUS_TRANSLATION_AABB',scope:'standing-person corridor and low-speed jack housing; fork channel geometry and traction unverified'};
}

export function configureFloorPalletPath(path,cargo,container){
  const L=Number(container.innerLength),l=Number(cargo.l);
  const doorWidth=Number(container.doorWidth || container.innerWidth),doorLeft=(Number(container.innerWidth)-doorWidth)/2;
  path.doorZ=Math.max(doorLeft+30,Math.min(Number(cargo.z),doorLeft+doorWidth-Number(cargo.w)-30));
  path.staging={x:L+1800,y:YARD_LEVEL_MM+260,z:Math.min(100,path.doorZ)};
  path.doorTransitLift={...path.staging};
  path.handoff={...path.staging,y:YARD_LEVEL_MM};
  const raised={...path.handoff,y:YARD_LEVEL_MM+40};
  path.doorApproach={...raised,x:L+200,y:40,z:path.doorZ};
  path.doorInside={x:L-l-30,y:40,z:path.doorZ};
  path.postDoorAligned={...path.doorInside,z:cargo.z};
  path.postDoorLifted={...path.postDoorAligned};
  path.insideAligned={...path.target,y:40};
  path.targetHover={...path.target,y:40};
  // Sample the ramp so a horizontal pallet clears the highest ground under it.
  const ramp=samplePolyline([raised,{...raised,x:L+1600,z:path.doorZ},path.doorApproach],100).map(p=>({...p,y:groundAtXZ(p.x,p.z,container)+40}));
  path.jackEntry=[...ramp,path.doorInside,path.postDoorAligned];
  path.entry=[...path.jackEntry,path.insideAligned,path.targetHover,path.target];
  path.exit=[path.insideAligned,path.postDoorAligned,...path.jackEntry.slice(0,-1).reverse()];
}

export function floorPalletPose(machine,cargo,path,p,actorStage){
  const phase=machine.phase,W=Number(machine.container.innerWidth);
  const l=Number(cargo.l),w=Number(cargo.w);
  const ground=point=>({...point,y:groundAtXZ(point.x,point.z,machine.container)});
  const forkAt={x:path.staging.x+l+780,y:YARD_LEVEL_MM,z:path.staging.z+w/2};
  // Extract the short pallet completely, then leave on the opposite side of
  // the pickup strip. The stock pool, next pallet and jack operator are at +Z.
  const forkPark=forkliftHome(machine.container);
  const jackAt=point=>ground({x:point.x+l-350,z:point.z+w/2});
  const jackDock=jackAt(path.handoff);
  const jackClear={...jackDock,x:jackDock.x+850};
  const jackPark={x:Number(machine.container.innerLength)+9000,y:YARD_LEVEL_MM,z:W+900};
  const jackTurnRatio=Math.abs(jackPark.z-jackClear.z)/(Math.abs(jackPark.z-jackClear.z)+Math.abs(jackPark.x-jackClear.x));
  let position={...path.handoff},forkliftPosition={...forkPark},jackPosition={...jackPark};
  let attached=false,jackVisible=true,workerVisible=true,jackLift=0,jackYaw=0;
  let forkYaw=0,forkSurface=YARD_LEVEL_MM+85;
  const enter=path.jackEntry;
  const inside=[path.postDoorAligned,path.insideAligned];
  switch(phase){
    case 'HANDOFF_LOWER':
      position=lerpPoint(path.staging,path.handoff,p);forkliftPosition=forkAt;attached=p<1;
      forkSurface=position.y+85;break;
    case 'FORK_WITHDRAW':
      forkliftPosition=pointAlongPolyline([forkAt,{...forkAt,x:forkPark.x},forkPark],p);
      {const corner=(forkPark.x-forkAt.x)/(forkPark.x-forkAt.x+Math.abs(forkPark.z-forkAt.z));forkYaw=emptyTurn(Math.max(0,(p-corner+.03)/(1-corner+.03)),0,-Math.PI/2,0);}
      forkSurface=YARD_LEVEL_MM+85;break;
    case 'JACK_APPROACH':jackPosition=pointAlongPolyline([jackPark,{...jackClear,x:jackPark.x},jackClear],p);jackYaw=jackApproachYaw(p,jackTurnRatio);break;
    case 'JACK_INSERT':jackPosition=lerpPoint(jackClear,jackDock,p);break;
    case 'JACK_LIFT':jackPosition=jackDock;position={...path.handoff,y:path.handoff.y+40*p};jackLift=40*p;attached=true;break;
    case 'ENTER_CONTAINER':position=pointAlongPolyline(enter,p);jackPosition=jackAt(position);attached=true;jackLift=40;break;
    case 'MOVE_INSIDE':position=pointAlongPolyline(inside,p);jackPosition=jackAt(position);attached=true;jackLift=40;break;
    case 'ALIGN_WITH_TARGET':position=path.targetHover;jackPosition=jackAt(position);attached=true;jackLift=40;break;
    case 'LOWER_CARGO':position=lerpPoint(path.targetHover,path.target,p);jackPosition=jackAt(position);attached=true;jackLift=40*(1-p);break;
    case 'RELEASE_CARGO':position=path.target;jackPosition=jackAt(position);attached=false;break;
    case 'REVERSE_OUT':position=path.target;jackPosition=jackAt(pointAlongPolyline(path.exit,p));break;
    case 'RETURN_FOR_NEXT':position=path.target;jackPosition=pointAlongPolyline([jackDock,jackClear,{...jackClear,x:jackPark.x},jackPark],p);jackYaw=jackApproachYaw(1-p,jackTurnRatio*.9);break;
    default:return null;
  }
  const workerPosition=ground({x:jackPosition.x+1160*Math.cos(jackYaw),z:jackPosition.z-1160*Math.sin(jackYaw)});
  if(phase==='HANDOFF_LOWER'||phase==='FORK_WITHDRAW'){jackVisible=true;workerVisible=true;}
  const forklift={position:forkliftPosition,yaw:forkYaw,forkHeight:forkSurface-forkliftPosition.y-85,forkSurface};
  return {forklift,worker:{position:workerPosition,yaw:jackYaw,stage:actorStage,visible:workerVisible,gripJack:true},
    jack:{position:jackPosition,yaw:jackYaw,lift:jackLift,visible:jackVisible},cargo:{position,item:cargo},attached,
    actorType:'forklift',actorStage,activeEquipment:['HANDOFF_LOWER','FORK_WITHDRAW'].includes(phase)?'forklift':'pallet-jack'};
}

function emptyTurn(p,start,turn,end){
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  return p<.5?start+(turn-start)*smooth(p/.5):turn+(end-turn)*smooth((p-.5)/.5);
}
function jackApproachYaw(p,corner){
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  return -Math.PI/2*smooth(p/.1)*(1-smooth((p-corner+.08)/.16));
}
