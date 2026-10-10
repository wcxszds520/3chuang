import { OperationMachine, buildOperationQueue } from './operationMachine.js';
import { validateCargoPath } from './geometry.js';
import { YARD_LEVEL_MM } from './stagingLayout.js';

const EMPTY_APPROACH=['RETURN_FOR_NEXT','REVERSE_OUT'];
const MANUAL_STEPS=['RETURN_FOR_NEXT','REVERSE_OUT','RELEASE_CARGO','LOWER_CARGO','ALIGN_WITH_TARGET','MOVE_INSIDE','ENTER_CONTAINER','ALIGN_WITH_DOOR','MOVE_TO_STAGING','LIFT_CARGO','INSERT_FORKS','ALIGN_FOR_PICKUP','MOVE_TO_CARGO'];
const DEVICE_STEPS=[...MANUAL_STEPS.slice(0,7),'JACK_LIFT','JACK_INSERT','JACK_APPROACH','FORK_WITHDRAW','HANDOFF_LOWER',...MANUAL_STEPS.slice(7)];
const LABELS={RETURN_FOR_NEXT:'接近箱门',REVERSE_OUT:'空载进入取货位',RELEASE_CARGO:'握持 / 插叉',LOWER_CARGO:'提起并离开支撑面',ALIGN_WITH_TARGET:'退出原货位',MOVE_INSIDE:'沿空通道后退搬出',ENTER_CONTAINER:'通过箱门',JACK_LIFT:'地牛放下交接',JACK_INSERT:'地牛抽叉',JACK_APPROACH:'地牛退至等待区',FORK_WITHDRAW:'叉车接近交接位',HANDOFF_LOWER:'叉车提取货物',ALIGN_WITH_DOOR:'门外对准',MOVE_TO_STAGING:'运往卸货暂存位',LIFT_CARGO:'降低货物',INSERT_FORKS:'落位并释放',ALIGN_FOR_PICKUP:'确认落位',MOVE_TO_CARGO:'设备 / 人员返回'};

export function unloadOrder(plan) {
  const cargo=plan.loadedCargo || [];
  if(plan.businessAudit?.valid&&plan.businessAudit.unloadEvents?.length===cargo.length)return plan.businessAudit.unloadEvents.map(e=>e.cargoId);
  // Wall-adjacent boxes load before middle boxes; they must be removed after
  // middle boxes so the door-frame offset cannot clip the neighbouring stack.
  // Keep discharge ports in order and revalidate each physical path below.
  return buildOperationQueue(cargo,plan.containerInfo || {}).reverse()
    .sort((a,b)=>Number(a.portSequence)-Number(b.portSequence)).map(c=>c.cargoId);
}

// Invert the validated handling cycle, not a tween between the box and a tray.
// The original container placements are immutable. Removed goods get their own
// receiving coordinates only after the actor physically releases them there.
export class UnloadMachine {
  constructor(plan={}) {
    this.plan=plan;this.container=plan.containerInfo || {};this.direction='unload';
    const byId=new Map((plan.loadedCargo || []).map(c=>[c.cargoId,c]));
    this.queue=unloadOrder(plan).map(id=>byId.get(id));
    const columns=6,rows=Math.ceil(this.queue.length/columns);
    this.stagingSlots=new Map(this.queue.map((c,i)=>{
      const x=Number(this.container.innerLength)+3400+(i%columns)*1700;
      const z=2200+(rows-1-Math.floor(i/columns))*1400;
      return [i,{x,y:YARD_LEVEL_MM,z,channelX:x+Number(c.l)/2,standX:x+Number(c.l)/2,stripZ:z+Number(c.w)+260,handlingClass:c.handlingMethod==='manual'?'manual':'forklift'}];
    }));
    this.reset();
  }
  reset(){this.speed=1;return this.seek(0);}
  seek(index){
    this.currentIndex=Math.max(0,Math.min(this.queue.length,Math.trunc(Number(index)||0)));
    this.completedIndices=Array.from({length:this.currentIndex},(_,i)=>i);
    this.playing=false;this.phase=this.currentIndex===this.queue.length?'COMPLETED':'IDLE';
    this.blockedReasons=[];this.skipped=[];this.picked=false;this.step=0;this.elapsed=0;
    this.actorDistance={worker:0,forklift:0,jack:0};this.previousPose=null;
    this.prepare();return this.getSnapshot();
  }
  prepare(){
    const cargo=this.queue[this.currentIndex];if(!cargo){this.loader=null;return;}
    this.loader=new OperationMachine({...this.plan,loadedCargo:[cargo]});
    this.loader.stagingSlots=new Map([[0,this.stagingSlots.get(this.currentIndex)]]);
    this.loader.placedCargo=()=>this.remaining().filter(c=>c.cargoId!==cargo.cargoId);
    this.steps=cargo.handlingMethod==='manual'?MANUAL_STEPS:DEVICE_STEPS;
    this.loader.doorProgress=1;
    this.loader.phase='ALIGN_FOR_PICKUP';this.loader.advancePhase();
    if(this.loader.phase==='BLOCKED')this.blockedReasons=[...this.loader.blockedReasons];
    else {
      const path=this.loader.currentPath();
      this.blockedReasons=validateCargoPath(cargo,this.container,this.loader.placedCargo(),path.validationPath).reasons;
    }
    this.durations=this.steps.map(phase=>{this.loader.phase=phase;return this.loader.computePhaseDuration();});
  }
  remaining(){const removed=new Set(this.completedIndices);return this.queue.filter((_,i)=>!removed.has(i));}
  play(){if(this.phase==='COMPLETED')this.seek(0);if(this.blockedReasons.length){this.phase='BLOCKED';this.playing=false;}else{this.phase='UNLOADING';this.playing=true;}return this.getSnapshot();}
  pause(){this.playing=false;return this.getSnapshot();}
  setSpeed(speed){this.speed=Math.max(.5,Math.min(8,Number(speed)||1));return this.getSnapshot();}
  stepForward(){if(this.blockedReasons.length)return this.play();this.advance();this.playing=false;return this.getSnapshot();}
  stepBackward(){return this.seek(Math.max(0,this.currentIndex-1));}
  advance(){
    const phase=this.steps[this.step];
    if(phase==='INSERT_FORKS' && !this.completedIndices.includes(this.currentIndex))this.completedIndices.push(this.currentIndex);
    this.step++;this.elapsed=0;
    if(this.step>=this.steps.length){
      this.currentIndex++;this.step=0;this.picked=false;
      if(this.currentIndex>=this.queue.length){this.phase='COMPLETED';this.playing=false;return;}
      this.prepare();if(this.blockedReasons.length){this.phase='BLOCKED';this.playing=false;}
    }
  }
  tick(delta){
    if(this.playing && this.loader){
      let remaining=Math.max(0,Math.min(.25,Number(delta)||0))*this.speed;
      while(remaining>0 && this.playing){
        const duration=this.durations[this.step];const advance=Math.min(remaining,duration-this.elapsed);
        this.elapsed+=advance;remaining-=advance;
        if(this.elapsed>=duration-1e-8)this.advance();
      }
    }
    const snapshot=this.getSnapshot();
    if(this.playing){
      for(const actor of ['worker','forklift','jack']){
        const a=this.previousPose?.[actor]?.position,b=snapshot[actor]?.position;
        if(a&&b)this.actorDistance[actor]+=Math.hypot(b.x-a.x,b.z-a.z)/1000;
      }
      this.previousPose=snapshot;
    }
    return snapshot;
  }
  getSnapshot(){
    const cargo=this.queue[Math.min(this.currentIndex,this.queue.length-1)] || null;
    let pose=this.lastPose;
    if(this.loader && this.phase!=='COMPLETED'){
      const phase=this.steps[this.step],progress=this.elapsed/this.durations[this.step];
      this.loader.phase=phase;this.loader.phaseElapsed=(1-progress)*this.durations[this.step];this.loader.activePhaseDuration=this.durations[this.step];
      pose=this.loader.computePose();
      if(pose.attached)this.picked=true;
      if(cargo.handlingMethod==='manual' && EMPTY_APPROACH.includes(phase))pose.worker.yaw+=Math.PI;
      pose.actorStage=EMPTY_APPROACH.includes(phase)?'move':phase==='RELEASE_CARGO'?'pickup':phase==='INSERT_FORKS'?'release':pose.attached?'carry':'return';
      this.lastPose=pose;
    }
    const completed=new Set(this.completedIndices);
    const placedCargo=this.queue.flatMap((c,i)=>completed.has(i)?[{...c,...this.stagingSlots.get(i),displayYaw:c.handlingMethod==='manual'?0:Math.PI/2}]:i===this.currentIndex&&this.picked?[]:[c]);
    const fallback={position:{x:Number(this.container.innerLength)+5000,y:YARD_LEVEL_MM,z:0},yaw:0};
    const phaseName=this.steps?.[this.step];
    return {phase:this.phase,phaseLabel:this.phase==='COMPLETED'?'卸货回放完成':this.phase==='BLOCKED'?'卸货作业阻断':LABELS[phaseName] || '准备卸货',
      action:LABELS[phaseName] || '准备卸货',playing:this.playing,speed:this.speed,phaseProgress:this.elapsed/(this.durations?.[this.step]||1),
      currentIndex:this.currentIndex,total:this.queue.length,completedCount:this.completedIndices.length,currentCargo:cargo,
      doorProgress:1,actorType:pose?.actorType || 'manual',actorStage:pose?.actorStage || 'idle',
      activeEquipment:pose?.activeEquipment || (pose?.actorType==='manual'?'manual':'forklift'),
      forklift:{...(pose?.forklift || fallback),distanceM:this.actorDistance.forklift},worker:{...(pose?.worker || fallback),distanceM:this.actorDistance.worker},
      jack:pose?.jack?{...pose.jack,distanceM:this.actorDistance.jack}:null,cargoPose:pose?.cargo || null,attached:pose?.attached || false,
      inProgress:this.picked&&!completed.has(this.currentIndex),blockedReasons:this.blockedReasons,skipped:this.skipped,placedCargo,
      path:this.loader?.currentPath() || null,deliveryTarget:this.stagingSlots.get(this.currentIndex),direction:'unload'};
  }
}
