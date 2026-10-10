import { aabbIntersects,cargoAabb,samplePolyline,pointAlongPolyline,lerpPoint } from './geometry.js';
import { validateForkInterface } from './forkInterface.js';
import { forkliftHome } from './floorHandling.js';

// Reference data: Linde E16 P 1251, 08/2025, pp.2/5/6. The rendered vehicle is
// a generic asset, not a certified digital replica. Use the larger GLB envelope
// (1190 wide, 2115 high, 1100 forks) and restrict lifting to 1250 mm free lift.
export const COMPACT_FORKLIFT = Object.freeze({id:'COMPACT_FORKLIFT',label:'紧凑叉车 · 平齐月台参考',
  sourceUrl:'https://www.linde-mh.co.uk/media/Datasheets/EN_ds_e16_e20_p_1251_en_b_0825_view.pdf',
  serviceKg:3090,maximumAxleKg:4099,forkLengthMm:1100,widthMm:1190,mastHeightMm:2115,freeLiftMm:1250,
  capacityTable:[[500,1600],[600,1430],[700,1300],[800,1180]]});
export const usesCompactForklift = container => container?.operationProfile==='COMPACT_FORKLIFT';
export const usesFloorJack = (cargo,container) => cargo?.handlingMethod!=='manual'&&!usesCompactForklift(container);

export function configureCompactPath(path,cargo,container){
  const L=Number(container.innerLength),l=Number(cargo.l),z=Number(cargo.z);
  path.entersContainer=true;path.doorZ=z;
  path.staging={x:L+1800,y:200,z};path.doorTransitLift={...path.staging};
  path.doorApproach={x:L+140,y:200,z};
  path.insideAligned={x:Math.max(Number(cargo.x)+l+80,Number(cargo.x)),y:200,z};
  path.doorInside={x:Math.max(path.insideAligned.x,L-l-30),y:200,z};
  path.postDoorAligned={...path.doorInside};path.postDoorLifted={...path.doorInside};
  path.faceLift={...path.insideAligned,y:Number(cargo.y)+60};
  path.targetHover={...path.target,y:Number(cargo.y)+60};
  path.entry=[path.staging,path.doorApproach,path.doorInside,path.insideAligned,path.faceLift,path.targetHover,path.target];
  // Withdraw fully before lowering the empty forks. The inverse unload cycle
  // raises outside the pallet footprint, inserts, and only then lifts the load.
  path.withdraw={...path.target,x:path.target.x+COMPACT_FORKLIFT.forkLengthMm+100};
  path.exit=[path.target,path.withdraw,{...path.withdraw,y:115}, {...path.staging,y:115}];
}

export function validateCompactHandling(cargo,container,placed,path){
  const reasons=[...validateForkInterface(cargo).reasons],device=COMPACT_FORKLIFT;
  const site=container.operationSite||{};
  if(site.levelDockConfirmed!==true || !(Number(site.bridgeCapacityKg)>=device.serviceKg+Number(cargo.weight)) || !(Number(site.floorAxleCapacityKg)>=device.maximumAxleKg))
    reasons.push({code:'FORKLIFT_SITE_UNVERIFIED',message:'紧凑叉车工况需要平齐月台确认、桥板总承载及箱地板轴载数据；请在柜资料中补录。参考预演不构成现场放行。'});
  const centre=Number(cargo.l)/2,capacity=device.capacityTable.find(([limit])=>centre<=limit)?.[1];
  if(!capacity||Number(cargo.weight)>capacity||Number(cargo.l)<device.forkLengthMm||Number(cargo.w)<680||Number(cargo.y)+145>device.freeLiftMm)
    reasons.push({code:'FORKLIFT_CAPACITY_EXCEEDED',message:'货物尺寸、载荷中心、质量或目标起升高度超出当前紧凑叉车参考范围；请改用有能力依据的设备或重新规划。'});
  const width=Number(container.innerWidth),doorWidth=Number(container.doorWidth||width),doorLeft=(width-doorWidth)/2;
  const centreZ=Number(cargo.z)+Number(cargo.w)/2,half=device.widthMm/2;
  if(centreZ-half<doorLeft+30||centreZ+half>doorLeft+doorWidth-30||device.mastHeightMm+35>Number(container.doorHeight||container.innerHeight))
    reasons.push({code:'FORKLIFT_DOOR_CLEARANCE',message:'按此货位直线进叉时，叉车车身或门架与门框/侧壁净空不足；本设备不在柜内横移或原地转弯。'});
  if(Number(cargo.y)>1){
    const supporters=placed.filter(c=>Math.abs(Number(c.y)+Number(c.h)-Number(cargo.y))<1);
    const footprint=c=>Math.max(0,Math.min(cargo.x+cargo.l,c.x+c.l)-Math.max(cargo.x,c.x))*Math.max(0,Math.min(cargo.z+cargo.w,c.z+c.w)-Math.max(cargo.z,c.z));
    const area=supporters.reduce((n,c)=>n+footprint(c),0);
    if(area/(cargo.l*cargo.w)<.95||supporters.some(c=>footprint(c)>0&&c.stackable===false))reasons.push({code:'PLACEMENT_SUPPORT_UNVERIFIED',message:'堆高目标缺少已就位且允许承压的连续支撑面。'});
  }
  if(reasons.length)return {valid:false,reasons};
  for(const p of samplePolyline([...path.entry,...path.exit],80)){
    const x=p.x+Number(cargo.l)+780;
    const body={minX:x-740,maxX:x+1303,minY:0,maxY:Math.max(device.mastHeightMm,p.y+1035),minZ:centreZ-half,maxZ:centreZ+half};
    if(body.minX>Number(container.innerLength))continue;
    const blocker=placed.find(c=>aabbIntersects(body,cargoAabb(c)));
    if(blocker){reasons.push({code:'FORKLIFT_PATH_OBSTRUCTED',message:`叉车底盘、门架或退出通道被 ${blocker.sku||blocker.cargoId} 占用；货物可装不等于设备可达。`});break;}
    if(body.maxY+35>Number(container.innerHeight)){reasons.push({code:'FORKLIFT_DOOR_CLEARANCE',message:'起升后的货叉背架超出箱内净高。'});break;}
  }
  return {valid:!reasons.length,reasons};
}

export function compactForkliftPose(machine,cargo,path,p,actorStage){
  const bodyAt=c=>({x:c.x+Number(cargo.l)+780,y:0,z:c.z+Number(cargo.w)/2});
  const phase=machine.phase,home=forkliftHome(machine.container);
  let position={...path.target},body=bodyAt(position),surface=position.y+85,attached=false,yaw=0;
  switch(phase){
    case 'ENTER_CONTAINER':position=pointAlongPolyline([path.staging,path.doorApproach,path.doorInside],p);attached=true;break;
    case 'MOVE_INSIDE':position=lerpPoint(path.doorInside,path.insideAligned,p);attached=true;break;
    case 'ALIGN_WITH_TARGET':position=pointAlongPolyline([path.insideAligned,path.faceLift,path.targetHover],p);attached=true;break;
    case 'LOWER_CARGO':position=lerpPoint(path.targetHover,path.target,p);attached=true;break;
    case 'RELEASE_CARGO':surface=position.y+85-15*p;break;
    case 'REVERSE_OUT':{
      const withdraw=pointAlongPolyline(path.exit,p);body=bodyAt(withdraw);surface=withdraw.y+70;break;
    }
    case 'RETURN_FOR_NEXT':{
      const start=bodyAt(path.staging),corner={...start,x:home.x};
      body=pointAlongPolyline([start,corner,home],p);surface=185;
      const t=Math.max(0,Math.min(1,(p-.7)/.3));yaw=-Math.PI/2*Math.sin(t*Math.PI);break;
    }
    default:return null;
  }
  if(attached){body=bodyAt(position);surface=position.y+85;}
  return {forklift:{position:body,yaw,forkHeight:surface-85,forkSurface:surface,forkExtension:0},
    worker:{position:home,yaw:0,visible:false},jack:null,cargo:{position,item:cargo,yaw:0},attached,actorType:'forklift',actorStage,activeEquipment:'forklift'};
}
