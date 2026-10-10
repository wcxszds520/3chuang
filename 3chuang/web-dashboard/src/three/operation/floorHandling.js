import { aabbIntersects, cargoAabb, samplePolyline, lerpPoint, pointAlongPolyline } from './geometry.js';
import { groundAtXZ, YARD_LEVEL_MM, yardLevel } from './stagingLayout.js';
import { validateForkInterface } from './forkInterface.js';

export const HANDOFF_PHASES = {
  HANDOFF_LOWER: { label:'门外放下托盘',action:'叉车将托盘放在平整交接位，货叉卸载',duration:1.2 },
  FORK_WITHDRAW: { label:'叉车退出交接位',action:'货叉抽离后，叉车退至侧方等候',duration:8.5 },
  JACK_APPROACH: { label:'地牛接近托盘',action:'人员握持地牛把手，沿空通道接近托盘',duration:8 },
  JACK_INSERT: { label:'地牛插入托盘',action:'低位短货叉进入托盘孔位',duration:1.4 },
  JACK_LIFT: { label:'地牛低位抬升',action:'抬起托盘离地，进入箱内输送；坡道能力仍需现场核验',duration:1.2 }
};

export const forkliftHome = container => ({x:Number(container.innerLength)+10400,y:yardLevel(container),z:-1500});
export const MANUAL_PLACEMENT_POLICY = Object.freeze({ maximumBaseMm:1100, maximumGripMm:1500, minimumSupportRatio:0.95 });
export const FLOOR_EQUIPMENT = Object.freeze({
  STANDARD_JACK:{id:'STANDARD_JACK',label:'标准地牛参考配置',forkLengthMm:1170,minimumPalletWidthMm:680,nominalCapacityKg:2000,loadCentreMm:600},
  SHORT_JACK:{id:'SHORT_JACK',label:'短叉地牛参考配置',forkLengthMm:800,minimumPalletWidthMm:600,nominalCapacityKg:2000,loadCentreMm:400}
});
export const floorEquipment = container => FLOOR_EQUIPMENT[container.operationProfile] || FLOOR_EQUIPMENT.STANDARD_JACK;

export function validateFloorHandling(cargo, container, placed, path) {
  const reasons=[];
  const manual=cargo.handlingMethod==='manual';
  const base=Number(cargo.y||0);
  if (manual && base>1) {
    const grip=base+Math.min(250,Number(cargo.h)*.35);
    if(base>MANUAL_PLACEMENT_POLICY.maximumBaseMm || grip>MANUAL_PLACEMENT_POLICY.maximumGripMm)
      reasons.push({code:'HIGH_STOW_UNVERIFIED',message:`目标底面 ${base} mm 超出本演示站立人工放置范围；需要另行确认高位设备与操作方法。`});
    const supporters=placed.filter(c=>Math.abs(Number(c.y)+Number(c.h)-base)<1);
    const area=supporters.reduce((sum,c)=>sum+Math.max(0,Math.min(cargo.x+cargo.l,c.x+c.l)-Math.max(cargo.x,c.x))*Math.max(0,Math.min(cargo.z+cargo.w,c.z+c.w)-Math.max(cargo.z,c.z)),0);
    if(area/(Number(cargo.l)*Number(cargo.w))<MANUAL_PLACEMENT_POLICY.minimumSupportRatio || supporters.some(c=>c.stackable===false && c.x<cargo.x+cargo.l && c.x+c.l>cargo.x && c.z<cargo.z+cargo.w && c.z+c.w>cargo.z))
      reasons.push({code:'PLACEMENT_SUPPORT_UNVERIFIED',message:'目标层缺少已就位且允许承压的连续支撑面，暂停取货。'});
  } else if (!manual && base>1) reasons.push({code:'HIGH_STOW_UNVERIFIED',message:`目标底面 ${base} mm：低位地牛不能堆高，需另行验证堆高设备。`});
  if(!manual)reasons.push(...validateForkInterface(cargo,{jack:true}).reasons);
  const device=floorEquipment(container);
  const capacity=Math.min(device.nominalCapacityKg,device.nominalCapacityKg*device.loadCentreMm/(Number(cargo.l)/2));
  if(!manual && (Number(cargo.weight)>capacity || Number(cargo.w)<device.minimumPalletWidthMm || Number(cargo.l)<device.forkLengthMm)) reasons.push({code:'JACK_ENVELOPE_EXCEEDED',message:`货物质量、载荷中心或底座尺寸不匹配${device.label}（叉长 ${device.forkLengthMm} mm）；请在柜资料中选择匹配的参考设备，现场能力仍须确认。`});
  if(reasons.length)return {valid:false,reasons};
  const points=manual ? [...path.manualEntry.approach, ...[path.manualEntry.faceLift,path.manualEntry.hover,path.target].filter(Boolean)] : path.entry;
  const l=Number(cargo.l),w=Number(cargo.w);
  for(const p of samplePolyline(points,100)){
    const centre={x:p.x+l+(manual?260:800),z:p.z+w/2};
    if(centre.x>Number(container.innerLength))continue;
    const body={minX:centre.x-180,maxX:centre.x+180,minZ:centre.z-230,maxZ:centre.z+230,minY:0,maxY:1820};
    const blocker=placed.find(c=>aabbIntersects(body,cargoAabb(c)));
    if(blocker){reasons.push({code:'PERSON_PATH_OBSTRUCTED',message:`人员地面通道被 ${blocker.sku||blocker.cargoId} 占用；不再让人物踩过货堆。`});break;}
  }
  return {valid:!reasons.length,reasons};
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
    jack:{position:jackPosition,yaw:jackYaw,lift:jackLift,visible:jackVisible,profileId:floorEquipment(machine.container).id},cargo:{position,item:cargo},attached,
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
