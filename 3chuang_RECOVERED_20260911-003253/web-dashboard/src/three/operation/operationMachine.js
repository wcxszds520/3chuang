import { buildCargoPath, buildManualEntry, lerpPoint, pointAlongPolyline, validateCargoPath } from './geometry.js';
import { YARD_LEVEL_MM, YARD_ROAD_Z, AISLE_FRONT_MM, buildOperationSlots, groundYAtX, groundAtXZ } from './stagingLayout.js';

import { HANDOFF_PHASES, configureFloorPalletPath, floorPalletPose, validateFloorHandling, forkliftHome } from './floorHandling.js';

export const OPERATION_PHASES = Object.freeze([
  'IDLE',
  'OPENING_DOORS',
  'MOVE_TO_CARGO',
  'ALIGN_FOR_PICKUP',
  'INSERT_FORKS',
  'LIFT_CARGO',
  'MOVE_TO_STAGING',
  'ALIGN_WITH_DOOR',
  'ENTER_CONTAINER',
  'MOVE_INSIDE',
  'ALIGN_WITH_TARGET',
  'LOWER_CARGO',
  'RELEASE_CARGO',
  'REVERSE_OUT',
  'RETURN_FOR_NEXT',
  ...Object.keys(HANDOFF_PHASES),
  'PAUSED',
  'BLOCKED',
  'COMPLETED'
]);

export const PHASE_META = Object.freeze({
  ...HANDOFF_PHASES,
  IDLE: { label: '待机', action: '门关闭，等待开始作业', duration: Infinity },
  OPENING_DOORS: { label: '打开箱门', action: '打开集装箱门端的左右箱门', duration: 1.5 },
  MOVE_TO_CARGO: { label: '驶向货物', action: '叉车沿通道驶向等待区货物', duration: 1.0 },
  ALIGN_FOR_PICKUP: { label: '取货对准', action: '对准货物中心与叉孔方向', duration: 0.4 },
  INSERT_FORKS: { label: '插入货叉', action: '货叉水平插入货物底部', duration: 0.4 },
  LIFT_CARGO: { label: '抬升货物', action: '货叉按目标层高连续抬升', duration: 0.5 },
  MOVE_TO_STAGING: { label: '移至门外', action: '货物随货叉移动到门前对准区', duration: 1.2 },
  ALIGN_WITH_DOOR: { label: '对准门洞', action: '按真实目标 Z 坐标对准门洞', duration: 0.4 },
  ENTER_CONTAINER: { label: '通过门洞', action: '仅通过集装箱后门进入箱内', duration: 0.9 },
  MOVE_INSIDE: { label: '箱内行进', action: '沿当前演示路径驶向真实目标位置', duration: 2.0 },
  ALIGN_WITH_TARGET: { label: '目标对准', action: '对齐装箱算法返回的目标坐标', duration: 0.4 },
  LOWER_CARGO: { label: '落货', action: '货叉下降，货物落到目标层', duration: 0.5 },
  RELEASE_CARGO: { label: '释放货物', action: '抽出货叉并固定货物完成状态', duration: 0.4 },
  REVERSE_OUT: { label: '倒车出箱', action: '叉车沿进入路径反向驶出', duration: 2.0 },
  RETURN_FOR_NEXT: { label: '返回等待区', action: '返回通道并准备下一件货物', duration: 0.8 },
  PAUSED: { label: '已暂停', action: '所有门、叉车和货物坐标保持不变', duration: Infinity },
  BLOCKED: { label: '作业阻断', action: '路径或目标不合法，未移动真实目标', duration: Infinity },
  COMPLETED: { label: '回放完成', action: '回放游标已到末尾；预置状态和被跳过对象不代表实际作业完成', duration: Infinity }
});

const NEXT_PHASE = Object.freeze({
  HANDOFF_LOWER: 'FORK_WITHDRAW', FORK_WITHDRAW: 'JACK_APPROACH', JACK_APPROACH: 'JACK_INSERT', JACK_INSERT: 'JACK_LIFT', JACK_LIFT: 'ENTER_CONTAINER',
  OPENING_DOORS: 'MOVE_TO_CARGO',
  MOVE_TO_CARGO: 'ALIGN_FOR_PICKUP',
  ALIGN_FOR_PICKUP: 'INSERT_FORKS',
  INSERT_FORKS: 'LIFT_CARGO',
  LIFT_CARGO: 'MOVE_TO_STAGING',
  MOVE_TO_STAGING: 'ALIGN_WITH_DOOR',
  ALIGN_WITH_DOOR: 'ENTER_CONTAINER',
  ENTER_CONTAINER: 'MOVE_INSIDE',
  MOVE_INSIDE: 'ALIGN_WITH_TARGET',
  ALIGN_WITH_TARGET: 'LOWER_CARGO',
  LOWER_CARGO: 'RELEASE_CARGO',
  RELEASE_CARGO: 'REVERSE_OUT',
  REVERSE_OUT: 'RETURN_FOR_NEXT'
});

export function buildOperationQueue(loadedCargo = [], container = {}) {
  const minimumZ = loadedCargo.length ? Math.min(...loadedCargo.map((cargo) => Number(cargo.z || 0))) : 0;
  const inferredWidth = Math.max(0, ...loadedCargo.map((cargo) => Number(cargo.z || 0) + Number(cargo.w || cargo.width || 0))) + Math.max(0, minimumZ);
  const containerWidth = Number(container.innerWidth || container.width || inferredWidth);
  const wallDistance = (cargo) => Math.min(Number(cargo.z || 0), Math.max(0, containerWidth - (Number(cargo.z || 0) + Number(cargo.w || cargo.width || 0))));
  return loadedCargo.map((cargo, sourceIndex) => ({ ...cargo, sourceIndex }))
    .sort((a, b) => Number(a.x) - Number(b.x)
      || Number(a.y) - Number(b.y)
      || wallDistance(a) - wallDistance(b)
      || Number(a.z) - Number(b.z)
      || Number(a.loadingIndex || a.sourceIndex) - Number(b.loadingIndex || b.sourceIndex));
}

export class OperationMachine {
  constructor(plan = {}) {
    this.plan = plan;
    this.container = plan.containerInfo || {};
    const audited=plan.businessAudit?.valid&&plan.businessAudit.unloadEvents?.length===(plan.loadedCargo||[]).length;
    const byId=new Map((plan.loadedCargo||[]).map(c=>[c.cargoId,c]));
    this.queue = audited?plan.businessAudit.unloadEvents.slice().reverse().map(e=>byId.get(e.cargoId)):buildOperationQueue(plan.loadedCargo || [], this.container);
    // 待装池确定性布局：queueIndex → 槽位（真实剩余货物的排队位置）。
    this.stagingSlots = buildOperationSlots(this.queue, this.container);
    this.reset();
  }

  reset() {
    this.phase = 'IDLE';
    this.playing = false;
    this.pausedPhase = null;
    this.phaseElapsed = 0;
    this.activePhaseDuration = PHASE_META.IDLE.duration;
    this.speed = 1;
    this.currentIndex = 0;
    this.completedIndices = [];
    this.skipped = [];
    this.blockedReasons = [];
    this.doorProgress = 0;
    this.history = [];
    this.lastEndYaw = null;
    this.actorDistance = {worker:0,forklift:0,jack:0};
    this.lastPose = this.computePose();
    return this.getSnapshot();
  }

  play() {
    if (this.phase === 'COMPLETED' || this.phase === 'BLOCKED') return this.getSnapshot();
    if (!this.queue.length) {
      this.phase = 'COMPLETED';
      return this.getSnapshot();
    }
    if (this.phase === 'PAUSED') this.phase = this.pausedPhase || 'MOVE_TO_CARGO';
    else if (this.phase === 'IDLE') this.enterPhase(this.doorProgress < 1 ? 'OPENING_DOORS' : 'MOVE_TO_CARGO');
    this.pausedPhase = null;
    this.playing = true;
    return this.getSnapshot();
  }

  pause() {
    if (!this.playing || ['IDLE', 'BLOCKED', 'COMPLETED'].includes(this.phase)) return this.getSnapshot();
    this.lastPose = this.computePose();
    this.pausedPhase = this.phase;
    this.phase = 'PAUSED';
    this.playing = false;
    return this.getSnapshot();
  }

  setSpeed(speed) {
    const allowed = [0.5, 1, 2, 4, 8, 16, 32, 64];
    this.speed = allowed.includes(Number(speed)) ? Number(speed) : 1;
    return this.getSnapshot();
  }

  tick(deltaSeconds) {
    if (!this.playing || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return this.getSnapshot();
    const previousPose=this.computePose();
    let remaining = Math.min(deltaSeconds, 0.25) * this.speed;
    let guard = 0;
    while (remaining > 0 && this.playing && guard < 8) {
      guard += 1;
      const duration = this.phaseDuration();
      const available = duration - this.phaseElapsed;
      if (remaining < available) {
        this.phaseElapsed += remaining;
        remaining = 0;
      } else {
        this.phaseElapsed = duration;
        this.lastPose = this.computePose();
        remaining -= Math.max(0, available);
        this.advancePhase();
      }
    }
    this.lastPose = this.computePose();
    for(const key of ['worker','forklift','jack']){
      const a=previousPose[key]?.position,b=this.lastPose[key]?.position;
      if(a&&b)this.actorDistance[key]+=Math.hypot(a.x-b.x,a.z-b.z)*.001;
    }
    return this.getSnapshot();
  }

  stepForward() {
    // A normal next-step action must not silently bypass a failed path check.
    if (this.phase === 'BLOCKED') return this.getSnapshot();
    if (this.phase === 'COMPLETED') return this.getSnapshot();
    if (this.phase === 'PAUSED') {
      this.phase = this.pausedPhase || 'MOVE_TO_CARGO';
      this.pausedPhase = null;
      this.activePhaseDuration = this.computePhaseDuration();
    }
    if (this.phase === 'IDLE') this.enterPhase(this.doorProgress < 1 ? 'OPENING_DOORS' : 'MOVE_TO_CARGO');
    else {
      this.phaseElapsed = this.phaseDuration();
      this.lastPose = this.computePose();
      this.advancePhase();
    }
    this.playing = false;
    this.lastPose = this.computePose();
    return this.getSnapshot();
  }

  stepBackward() {
    const checkpoint = this.history.pop();
    if (!checkpoint) return this.reset();
    this.restoreCheckpoint(checkpoint);
    this.playing = false;
    this.lastPose = this.computePose();
    return this.getSnapshot();
  }

  jumpToCargo(index) {
    const target = Math.max(0, Math.min(this.queue.length - 1, Number(index) || 0));
    this.currentIndex = target;
    this.completedIndices = Array.from({ length: target }, (_, itemIndex) => itemIndex);
    this.skipped = [];
    this.blockedReasons = [];
    this.doorProgress = 1;
    this.phase = 'MOVE_TO_CARGO';
    this.phaseElapsed = 0;
    this.activePhaseDuration = this.computePhaseDuration();
    this.playing = false;
    this.pausedPhase = null;
    this.history = [];
    this.lastEndYaw = null;
    this.actorDistance = {worker:0,forklift:0,jack:0};
    this.lastPose = this.computePose();
    return this.getSnapshot();
  }

  jumpToCompletedCount(count) {
    const completed = Math.max(0, Math.min(this.queue.length, Math.trunc(Number(count) || 0)));
    this.completedIndices = Array.from({ length: completed }, (_, index) => index);
    this.currentIndex = Math.min(completed, Math.max(0, this.queue.length - 1));
    this.skipped = [];
    this.blockedReasons = [];
    this.playing = false;
    this.pausedPhase = null;
    this.phaseElapsed = 0;
    this.history = [];
    this.doorProgress = completed > 0 ? 1 : 0;
    this.phase = completed === this.queue.length ? 'COMPLETED' : completed === 0 ? 'IDLE' : 'MOVE_TO_CARGO';
    this.activePhaseDuration = this.computePhaseDuration();
    this.lastEndYaw = null;
    this.actorDistance = {worker:0,forklift:0,jack:0};
    this.lastPose = this.computePose();
    return this.getSnapshot();
  }

  skipCurrent() {
    if (this.currentIndex >= this.queue.length) return this.getSnapshot();
    this.skipped.push({ index: this.currentIndex, cargoId: this.currentCargo()?.cargoId, reasons: [...this.blockedReasons] });
    this.currentIndex += 1;
    this.blockedReasons = [];
    this.playing = false;
    if (this.currentIndex >= this.queue.length) this.enterPhase('COMPLETED');
    else this.enterPhase('MOVE_TO_CARGO');
    this.lastPose = this.computePose();
    return this.getSnapshot();
  }

  currentCargo() {
    return this.queue[this.currentIndex] || null;
  }

  currentPath() {
    const cargo = this.currentCargo();
    if (!cargo) return null;
    const slot = this.stagingSlots.get(this.currentIndex);
    const path = buildCargoPath(cargo, this.container, this.currentIndex, { waitingSlot: slot });
    if(cargo.handlingMethod!=='manual')configureFloorPalletPath(path,cargo,this.container);
    path.yard = buildYardChoreography(cargo, this.container, path, slot);
    if (cargo.handlingMethod === 'manual') {
      path.manualEntry = buildManualEntry(cargo, this.container, path, this.placedCargo());
      path.validationPath = [...path.manualEntry.approach, path.manualEntry.faceLift, path.manualEntry.hover, path.target];
    } else {
      path.validationPath = path.entry;
    }
    return path;
  }

  placedCargo() {
    return this.completedIndices.map((index) => this.queue[index]).filter(Boolean);
  }

  waitingCargo(limit = 12) {
    return this.queue.slice(this.currentIndex, this.currentIndex + limit).map((cargo, offset) => ({
      cargo,
      position: this.stagingSlots.get(this.currentIndex + offset)
        || buildCargoPath(cargo, this.container, this.currentIndex + offset).waiting,
      queueIndex: this.currentIndex + offset
    }));
  }

  advancePhase() {
    const phase = this.phase;
    this.pushCheckpoint();
    const endPose = this.computePose();
    this.lastEndYaw = endPose.actorType === 'manual' ? endPose.worker.yaw : endPose.forklift.yaw;
    if (phase === 'OPENING_DOORS') this.doorProgress = 1;
    if (phase === 'ALIGN_FOR_PICKUP') {
      const cargo=this.currentCargo();
      const baseValidation=validateActorCargo(cargo);
      const floorValidation=validateFloorHandling(cargo,this.container,this.placedCargo(),this.currentPath());
      const actorValidation={valid:baseValidation.valid&&floorValidation.valid,reasons:[...baseValidation.reasons,...floorValidation.reasons]};
      if (!actorValidation.valid) {
        this.blockedReasons = actorValidation.reasons;
        this.enterPhase('BLOCKED');
        this.playing = false;
        return;
      }
    }
    if (phase === 'ALIGN_WITH_DOOR') {
      const cargo = this.currentCargo();
      const path = this.currentPath();
      const validation = validateCargoPath(cargo, this.container, this.placedCargo(), path.validationPath);
      if (!validation.valid || this.doorProgress < 0.999) {
        this.blockedReasons = validation.valid ? [{ code: 'DOORS_CLOSED', message: '箱门尚未完全打开' }] : validation.reasons;
        this.enterPhase('BLOCKED');
        this.playing = false;
        return;
      }
    }
    if (phase === 'RELEASE_CARGO' && !this.completedIndices.includes(this.currentIndex)) this.completedIndices.push(this.currentIndex);
    if (phase === 'RETURN_FOR_NEXT') {
      this.currentIndex += 1;
      if (this.currentIndex >= this.queue.length) {
        this.enterPhase('COMPLETED');
        this.playing = false;
      } else this.enterPhase('MOVE_TO_CARGO');
      return;
    }
    const next = phase==='ALIGN_WITH_DOOR' && this.currentCargo()?.handlingMethod!=='manual' ? 'HANDOFF_LOWER' : NEXT_PHASE[phase];
    if (next) this.enterPhase(next);
  }

  enterPhase(phase) {
    this.phase = phase;
    this.phaseElapsed = 0;
    this.activePhaseDuration = this.computePhaseDuration();
    if (phase === 'COMPLETED' || phase === 'BLOCKED' || phase === 'IDLE') this.playing = false;
  }

  phaseDuration() {
    const duration = Number(this.activePhaseDuration);
    if (Number.isFinite(duration) && duration > 0) return duration;
    return PHASE_META[this.phase]?.duration ?? Infinity;
  }

  phaseProgress() {
    const duration = this.phaseDuration();
    return Number.isFinite(duration) && duration > 0 ? Math.min(1, this.phaseElapsed / duration) : 0;
  }

  // 作业节拍 = 路径长度 / 作业速度：移动距离长的阶段自然耗时更长，
  // 避免"固定时长导致长距离看起来像飞"。速度单位 mm/s（1x 回放）。
  computePhaseDuration() {
    const cargo = this.currentCargo();
    const path = this.currentPath();
    if (!cargo || !path) return PHASE_META[this.phase]?.duration ?? Infinity;
    const manual = cargo.handlingMethod === 'manual';
    const yard = path.yard;
    const WALK = 1250;
    const CARRY_WALK = 1080;
    const FORK_YARD = 2100;
    const FORK_LOADED = 1700;
    const FORK_INSIDE = 1300;
    const LIFT_RATE = 760;
    const between = (a, b) => Math.hypot(Number(a.x) - Number(b.x), Number(a.y || 0) - Number(b.y || 0), Number(a.z) - Number(b.z));
    const poly = (points) => points.slice(1).reduce((sum, point, index) => sum + between(points[index], point), 0);
    const timed = (distance, rate, floor = 0.45) => Math.max(floor, distance / rate);
    switch (this.phase) {
      case 'MOVE_TO_CARGO': {
        const track = yard?.approach || [manual ? manualHome(this.container) : path.home, manual ? manualPickupStand(path, cargo) : forkliftStandoff(path, cargo)];
        return timed(poly(track), manual ? WALK : FORK_YARD, 0.6);
      }
      case 'ALIGN_FOR_PICKUP': return manual ? 0.5 : 0.55;
      case 'INSERT_FORKS': return manual ? 0.6 : 0.55;
      case 'LIFT_CARGO': return timed(Math.abs(path.waitingLifted.y - path.waiting.y) + (manual ? 260 : 0), LIFT_RATE, 0.5);
      case 'MOVE_TO_STAGING': {
        const track = (manual ? yard?.carryTo : yard?.carryBody) || [path.waitingLifted, path.staging];
        return timed(poly(track), manual ? CARRY_WALK : FORK_LOADED, 0.6);
      }
      case 'ALIGN_WITH_DOOR': return manual ? 0.5 : timed(Math.abs(path.doorTransitLift.y - path.staging.y), LIFT_RATE, 0.5);
      case 'ENTER_CONTAINER': {
        if (manual) return timed(poly(manualEnterPolyline(path)) || 800, 900, 0.8);
        return timed(poly([path.doorTransitLift, path.doorApproach, path.doorInside, path.postDoorAligned]), 1050, 0.8);
      }
      case 'MOVE_INSIDE': {
        if (manual) return timed(poly(manualInsidePolyline(path)) || 600, CARRY_WALK, 0.7);
        return timed(poly([path.postDoorAligned, path.postDoorLifted, path.insideAligned]), FORK_INSIDE, 0.7);
      }
      case 'ALIGN_WITH_TARGET': return timed(manual ? poly([path.manualEntry.face, path.manualEntry.faceLift, path.manualEntry.hover]) : between(path.insideAligned, path.targetHover), manual ? 700 : 900, 0.5);
      case 'LOWER_CARGO': return 0.6;
      case 'RELEASE_CARGO': return 0.55;
      case 'REVERSE_OUT': {
        if (manual) return timed(poly([...manualInsidePolyline(path)].reverse().concat([...manualEnterPolyline(path)].reverse().slice(1))) || 800, WALK, 0.8);
        return timed(poly(path.exit), 1900, 0.8);
      }
      case 'RETURN_FOR_NEXT': {
        if (!manual) {
          const start=floorPalletPose(this,cargo,path,0,'return').jack.position;
          const end=floorPalletPose(this,cargo,path,1,'return').jack.position;
          return timed(Math.abs(end.x-start.x)+Math.abs(end.z-start.z),1050,0.8);
        }
        const from = manual ? (yard?.doorStand || manualDoorStand(this.container, path, cargo)) : path.staging;
        return timed(between(from, yard?.home || (manual ? manualHome(this.container) : path.home)), manual ? WALK : 2400, 0.6);
      }
      default: return PHASE_META[this.phase]?.duration ?? Infinity;
    }
  }

  computePose() {
    if (['PAUSED','BLOCKED'].includes(this.phase) && this.lastPose) return this.lastPose;
    const cargo = this.currentCargo();
    const path = this.currentPath();
    if (!cargo || !path) {
      // 队列耗尽（COMPLETED）：冻结在最后的作业姿态，避免演员瞬移回默认点。
      if (this.lastPose && (this.phase === 'COMPLETED' || this.phase === 'PAUSED')) return this.lastPose;
      const forklift = { position: { x: Number(this.container.innerLength || 0) + 1900, y: YARD_LEVEL_MM, z: Number(this.container.innerWidth || 0) / 2 + 1150 }, yaw: Math.PI / 2, forkHeight: 100, forkExtension: 0 };
      return {
      forklift,
      worker: workerPoseFromForklift(forklift, 'idle', 0, false, false),
      cargo: null,
      attached: false,
      actorType: 'forklift',
      actorStage: 'idle'
      };
    }
    const p = this.phaseProgress();
    const actorType = cargo.handlingMethod === 'manual' ? 'manual' : 'forklift';
    const actorStage = actorStageFor(this.phase);
    if (actorType === 'manual') return this.computeManualPose(cargo, path, p, actorStage);
    return this.computeForkliftPose(cargo, path, p, actorStage);
  }

  // 叉车分支：通道口取货 → 倒车出通道 → 主干通道低位运输 → 门区举升 →
  // （目标超出门区货叉可达范围时）驶上坡道进箱。车身 y 始终 = 当地地面。
  computeForkliftPose(cargo, path, p, actorStage) {
    const handoff=floorPalletPose(this,cargo,path,ease(p),actorStage);
    if(handoff)return handoff;
    const l = Number(cargo.l || 0);
    const w = Number(cargo.w || 0);
    const length = Number(this.container.innerLength || 0);
    const yard = path.yard;
    const bodyFor = (cargoPos) => {
      let x = cargoPos.x + l + 780;
      if (!path.entersContainer) x = Math.max(x, length + 30);
      return { x, y: groundYAtX(x, this.container), z: cargoPos.z + w / 2 };
    };
    const forkUnder = (cargoPos) => cargoPos.y - YARD_LEVEL_MM;
    const pickupFork = yard?.pickupFork || bodyFor(path.waiting);
    const homeFork = yard?.home || { ...path.home, y: groundYAtX(path.home.x, this.container) };
    let cargoPosition = { ...path.waiting };
    let forkliftPosition = { ...homeFork };
    let attached = false;
    let forkExtension = 0;
    let forkHeight = 100;
    let yaw = Math.PI / 2;
    let cargoYaw=Math.PI/2;
    const carrying = () => { attached = true; forkExtension = 1; forkHeight = forkUnder(cargoPosition); forkliftPosition = bodyFor(cargoPosition); yaw = 0; };
    const turnIn = (trackYaw) => {
      const from = this.lastEndYaw ?? Math.PI / 2;
      const blend = Math.min(1, p / 0.18);
      return blend < 1 ? lerpAngle(from, trackYaw, ease(blend)) : trackYaw;
    };

    switch (this.phase) {
      case 'OPENING_DOORS':
      case 'IDLE':
        break;
      case 'MOVE_TO_CARGO': {
        const track = yard?.approach || [homeFork, pickupFork];
        const frame = trackPointYaw(track, ease(p), { reverseYaw: false });
        forkliftPosition = { ...frame.point, y: groundYAtX(frame.point.x, this.container) };
        yaw = turnIn(frame.yaw);
        // 接近过程中货叉预调到堆叠取货高度（真实司机的预见性操作）。
        const targetFork = forkUnder(path.waiting);
        forkHeight = 100 + (targetFork - 100) * ease(p);
        break;
      }
      case 'ALIGN_FOR_PICKUP':
        forkliftPosition = pickupFork;
        yaw = lerpAngle(yawFromTrack(yard?.approach) ?? Math.PI / 2, Math.PI / 2, ease(p));
        forkHeight = forkUnder(path.waiting);
        break;
      case 'INSERT_FORKS':
        forkliftPosition = lerpPoint(pickupFork,yard?.pickupContact||pickupFork,ease(p));
        yaw = Math.PI / 2;
        forkExtension = p;
        forkHeight = forkUnder(path.waiting);
        break;
      case 'LIFT_CARGO':
        cargoPosition = lerpPoint(path.waiting, path.waitingLifted, ease(p));
        forkliftPosition = yard?.pickupContact||pickupFork;
        yaw = Math.PI / 2;
        attached = true;
        forkExtension = 1;
        forkHeight = forkUnder(cargoPosition);
        break;
      case 'MOVE_TO_STAGING': {
        const track = yard?.carryBody || [pickupFork, bodyFor(path.staging)];
        const frame = trackPointYaw(track, ease(p), { backwardHead: true });
        forkliftPosition = { ...frame.point, y: groundYAtX(frame.point.x, this.container) };
        yaw = p>.8 ? lerpAngle(frame.yaw,0,ease((p-.8)/.2)) : frame.yaw;
        const settled = carriedCargo(frame.point, yaw, cargo, 780);
        const liftY0 = Number(path.waitingLifted.y || 0);
        cargoPosition = { ...settled, y: liftY0 + (Number(path.staging.y || 0) - liftY0) * ease(p) };
        attached = true;
        cargoYaw=yaw;
        forkExtension = 1;
        forkHeight = forkUnder(cargoPosition);
        break;
      }
      case 'ALIGN_WITH_DOOR':
        cargoPosition = lerpPoint(path.staging, path.doorTransitLift, ease(p));
        cargoYaw=0;
        carrying();
        break;
      case 'ENTER_CONTAINER':
        cargoPosition = pointAlongPolyline([path.doorTransitLift, path.doorApproach, path.doorInside, path.postDoorAligned], ease(p));
        carrying();
        break;
      case 'MOVE_INSIDE':
        cargoPosition = pointAlongPolyline([path.postDoorAligned, path.postDoorLifted, path.insideAligned], ease(p));
        carrying();
        break;
      case 'ALIGN_WITH_TARGET':
        cargoPosition = lerpPoint(path.insideAligned, path.targetHover, ease(p));
        carrying();
        break;
      case 'LOWER_CARGO':
        cargoPosition = lerpPoint(path.targetHover, path.target, ease(p));
        carrying();
        break;
      case 'RELEASE_CARGO':
        cargoPosition = { ...path.target };
        forkliftPosition = bodyFor(cargoPosition);
        forkExtension = 1 - p; forkHeight = forkUnder(cargoPosition); attached = p < 0.35;
        yaw = 0;
        break;
      case 'REVERSE_OUT': {
        cargoPosition = { ...path.target };
        const point = pointAlongPolyline(path.exit, ease(p));
        forkliftPosition = bodyFor(point);
        const settled = forkUnder(path.target);
        forkHeight = settled + (100 - settled) * ease(p);
        yaw = 0;
        break;
      }
      case 'RETURN_FOR_NEXT': {
        cargoPosition = { ...path.target };
        const track = [bodyFor(path.staging), { x: length + 1900, y: 0, z: YARD_ROAD_Z }, homeFork];
        const frame = trackPointYaw(track, ease(p), { reverseYaw: false });
        forkliftPosition = { ...frame.point, y: groundYAtX(frame.point.x, this.container) };
        const blend = Math.min(1, p / 0.18);
        yaw = blend < 1 ? lerpAngle(0, frame.yaw, ease(blend)) : frame.yaw;
        break;
      }
      case 'BLOCKED':
        cargoPosition = { ...path.staging };
        carrying();
        break;
      default:
        break;
    }
    const carryPose = ['lift', 'carry', 'enter', 'place'].includes(actorStage) && attached;
    const reachPose = ['pickup', 'release'].includes(actorStage);
    const forklift = { position: forkliftPosition, yaw, forkHeight, forkExtension };
    const standby=floorPalletPose({phase:'JACK_APPROACH',container:this.container},cargo,path,0,'idle');
    return {
      forklift,
      worker: {...standby.worker,carryPose,reachPose,stage:'idle'},
      jack:standby.jack,
      cargo: { position: cargoPosition, item: cargo, yaw:cargoYaw },
      attached,
      actorType: 'forklift',
      actorStage
    };
  }

  // 人工分支：工人沿排侧通道步行取货 → 手持搬运（货物持于身前腰部高度）→
  // 箱内沿地面通道前行；高位目标和被占用的人员通道在取货前阻断。
  // 方向约定：门在 +X，进箱 = 向 -X 走（yaw 0），出箱 = 向 +X（yaw π）。
  computeManualPose(cargo, path, p, actorStage) {
    const l = Number(cargo.l || 0);
    const w = Number(cargo.w || 0);
    const yard = path.yard;
    const groundAt = (x, z) => groundAtXZ(x,z,this.container);
    const home = yard?.home || manualHome(this.container);
    const stand = yard?.stand || manualPickupStand(path, cargo);
    const enterLine = manualEnterPolyline(path);
    const insideLine = manualInsidePolyline(path);
    const face = path.manualEntry.face;
    const hover = path.manualEntry.hover;
    const doorStand = yard?.doorStand || { x: enterLine[0].x + l + 260, y: YARD_LEVEL_MM, z: enterLine[0].z + w / 2 };
    const carryStart = yard?.carryStart || { ...path.waiting, y: YARD_LEVEL_MM + 850 };
    const workerGrounded = (point) => ({ ...point, y: groundAt(point.x, point.z) });
    let cargoPosition = { ...path.waiting };
    let workerPosition = workerGrounded(home);
    let attached = false;
    let yaw = Math.PI;
    const moving = { gait: 0 };

    switch (this.phase) {
      case 'OPENING_DOORS':
      case 'IDLE':
        break;
      case 'MOVE_TO_CARGO': {
        const track = yard?.approach || [home, stand];
        const frame = trackPointYaw(track, ease(p), { reverseYaw: false });
        workerPosition = workerGrounded(frame.point);
        const from = this.lastEndYaw ?? Math.PI;
        const blend = Math.min(1, p / 0.18);
        yaw = blend < 1 ? lerpAngle(from, frame.yaw, ease(blend)) : frame.yaw;
        moving.gait = p;
        break;
      }
      case 'ALIGN_FOR_PICKUP':
        workerPosition = workerGrounded(stand);
        yaw = lerpAngle(yawFromTrack(yard?.approach) ?? -Math.PI / 2, -Math.PI / 2, ease(p));
        break;
      case 'INSERT_FORKS':
        workerPosition = workerGrounded(stand);
        yaw = -Math.PI / 2;
        cargoPosition = { ...path.waiting, y: path.waiting.y + 40 * ease(p) };
        attached = p > 0.5;
        break;
      case 'LIFT_CARGO': {
        workerPosition = workerGrounded(stand);
        yaw = -Math.PI / 2;
        cargoPosition = lerpPoint({ ...path.waiting, y: path.waiting.y + 40 }, carryStart, ease(p));
        attached = true;
        break;
      }
      case 'MOVE_TO_STAGING': {
        const track = yard?.carryTo || [stand, doorStand];
        const frame = trackPointYaw(track, ease(p), { reverseYaw: false });
        workerPosition = workerGrounded(frame.point);
        // 从面向货堆（π/2）平滑转向行进方向，避免阶段边界瞬间 90° 转身。
        const blend = Math.min(1, p / 0.15);
        yaw = blend < 1 ? lerpAngle(-Math.PI / 2, frame.yaw, ease(blend)) : frame.yaw;
        const carried = carriedCargo(workerPosition, yaw, cargo, 260);
        const startY = Number(carryStart.y || 0);
        const endY = Number(enterLine[0]?.y ?? (groundAt(workerPosition.x, workerPosition.z) + 850));
        cargoPosition = { ...carried, y: startY + (endY - startY) * ease(p) };
        attached = true;
        moving.gait = p;
        break;
      }
      case 'ALIGN_WITH_DOOR':
        cargoPosition = { ...enterLine[0] };
        workerPosition = workerGrounded(doorStand);
        yaw = 0;
        attached = true;
        break;
      case 'ENTER_CONTAINER': {
        cargoPosition = pointAlongPolyline(enterLine, ease(p));
        workerPosition = workerGrounded({ x: cargoPosition.x + l + 260, z: cargoPosition.z + w / 2 });
        yaw = 0;
        attached = true;
        moving.gait = p;
        break;
      }
      case 'MOVE_INSIDE': {
        cargoPosition = pointAlongPolyline(insideLine, ease(p));
        workerPosition = workerGrounded({ x: cargoPosition.x + l + 260, z: cargoPosition.z + w / 2 });
        yaw = 0;
        attached = true;
        moving.gait = p;
        break;
      }
      case 'ALIGN_WITH_TARGET':
        cargoPosition = pointAlongPolyline([face, path.manualEntry.faceLift, hover], ease(p));
        workerPosition = workerGrounded({ x: cargoPosition.x + l + 260, z: cargoPosition.z + w / 2 });
        yaw = 0;
        attached = true;
        break;
      case 'LOWER_CARGO':
        cargoPosition = lerpPoint(hover, path.target, ease(p));
        workerPosition = workerGrounded({ x: cargoPosition.x + l + 260, z: cargoPosition.z + w / 2 });
        yaw = 0;
        attached = true;
        break;
      case 'RELEASE_CARGO':
        cargoPosition = { ...path.target };
        workerPosition = workerGrounded({ x: path.target.x + l + 260, z: path.target.z + w / 2 });
        yaw = 0;
        attached = p < 0.35;
        break;
      case 'REVERSE_OUT': {
        cargoPosition = { ...path.target };
        const backTrack = [path.target,...insideLine.slice().reverse(),...enterLine.slice().reverse().slice(1)];
        const point = pointAlongPolyline(backTrack, ease(p));
        workerPosition = workerGrounded({ x: point.x + l + 260, z: point.z + w / 2 });
        // 从面向目标（0°）平滑转身走向门口，避免边界瞬间掉头。
        const blend = Math.min(1, p / 0.15);
        yaw = blend < 1 ? lerpAngle(0, Math.PI, ease(blend)) : Math.PI;
        moving.gait = p;
        break;
      }
      case 'RETURN_FOR_NEXT': {
        cargoPosition = { ...path.target };
        const point = lerpPoint(doorStand, home, ease(p));
        workerPosition = workerGrounded(point);
        yaw = lerpAngle(Math.PI, headingFor(doorStand, home), ease(p));
        moving.gait = p;
        break;
      }
      case 'BLOCKED':
        cargoPosition = { ...enterLine[0] };
        workerPosition = workerGrounded(doorStand);
        yaw = 0;
        attached = true;
        break;
      default:
        break;
    }
    const stage = actorStage;
    const carryPose = attached && ['lift', 'carry', 'enter', 'place'].includes(stage);
    const reachPose = ['pickup', 'release'].includes(stage) || (attached && Number(path.target.y || 0) > 1300 && ['place', 'enter'].includes(stage));
    const parkedForklift = {
      position: forkliftHome(this.container),
      yaw: 0,
      forkHeight: 0,
      forkExtension: 0
    };
    return {
      forklift: parkedForklift,
      worker: {
        position: workerPosition,
        yaw,
        gait: ['move', 'carry', 'enter', 'exit', 'return'].includes(stage) ? Math.sin(Math.max(0, Math.min(1, moving.gait)) * Math.PI * 4) : 0,
        carryPose,
        reachPose,
        stage
      },
      cargo: { position: cargoPosition, item: cargo },
      attached,
      actorType: 'manual',
      actorStage: stage
    };
  }

  getSnapshot() {
    const meta = PHASE_META[this.phase] || PHASE_META.IDLE;
    const cargo = this.currentCargo();
    const pose = this.computePose();
    const presentation = actorPresentation(meta, this.phase, cargo);
    return {
      phase: this.phase,
      phaseLabel: presentation.label,
      action: presentation.action,
      playing: this.playing,
      speed: this.speed,
      phaseProgress: this.phaseProgress(),
      currentIndex: Math.min(this.currentIndex, this.queue.length),
      total: this.queue.length,
      completedCount: this.completedIndices.length,
      currentCargo: cargo,
      doorProgress: this.phase === 'OPENING_DOORS' ? Math.max(this.doorProgress, ease(this.phaseProgress())) : this.doorProgress,
      forklift: {...pose.forklift,distanceM:this.actorDistance?.forklift||0},
      worker: {...pose.worker,distanceM:this.actorDistance?.worker||0},
      jack: pose.jack?{...pose.jack,distanceM:this.actorDistance?.jack||0}:null,
      inProgress: Boolean(cargo && !this.completedIndices.includes(this.currentIndex) && !['IDLE','OPENING_DOORS','MOVE_TO_CARGO','ALIGN_FOR_PICKUP','INSERT_FORKS'].includes(this.phase==='PAUSED'?this.pausedPhase:this.phase) && !(this.phase==='BLOCKED'&&!pose.attached)),
      actorType: pose.actorType,
      activeEquipment:pose.activeEquipment || (pose.actorType==='manual'?'manual':'forklift'),
      actorStage: pose.actorStage,
      cargoPose: pose.cargo,
      attached: pose.attached,
      blockedReasons: [...this.blockedReasons],
      skipped: [...this.skipped],
      placedCargo: this.placedCargo(),
      path: this.currentPath()
    };
  }

  pushCheckpoint() {
    this.history.push({
      phase: this.phase,
      phaseElapsed: 0,
      currentIndex: this.currentIndex,
      completedIndices: [...this.completedIndices],
      skipped: [...this.skipped],
      blockedReasons: [...this.blockedReasons],
      doorProgress: this.doorProgress,
      pausedPhase: null,
      actorDistance:{...this.actorDistance}
    });
    if (this.history.length > 200) this.history.shift();
  }

  restoreCheckpoint(checkpoint) {
    Object.assign(this, checkpoint);
  }
}

function workerPoseFromForklift(forklift, stage, progress, carryPose, reachPose) {
  const moving = ['move', 'carry', 'enter', 'exit', 'return'].includes(stage);
  return {
    position: {
      x: Number(forklift.position.x || 0) - 380,
      y: 0,
      z: Number(forklift.position.z || 0)
    },
    yaw: Number(forklift.yaw || 0),
    gait: moving ? Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI * 4) : 0,
    carryPose: Boolean(carryPose),
    reachPose: Boolean(reachPose),
    stage
  };
}

function validateActorCargo(cargo) {
  if (!cargo || cargo.handlingMethod !== 'manual') return { valid: true, reasons: [] };
  const missing = [
    ['长度', cargo.l || cargo.length],
    ['宽度', cargo.w || cargo.width],
    ['高度', cargo.h || cargo.height],
    ['单件重量', cargo.weight]
  ].filter(([, value]) => !Number.isFinite(Number(value)) || Number(value) <= 0).map(([label]) => label);
  if (missing.length) return {
    valid: false,
    reasons: [{ code: 'MANUAL_DATA_INCOMPLETE', message: `人工作业缺少必要属性：${missing.join('、')}，请返回货物清单补齐后重试。` }]
  };
  const length = Number(cargo.l || cargo.length);
  const width = Number(cargo.w || cargo.width);
  const height = Number(cargo.h || cargo.height);
  const weight = Number(cargo.weight);
  if (weight > 25 || length > 1200 || width > 1200 || height > 1000) return {
    valid: false,
    reasons: [{ code: 'MANUAL_CAPACITY_EXCEEDED', message: `人工搬运超出本演示适用边界（${length}×${width}×${height} mm，${weight} kg），请改为叉车或拆分货物。` }]
  };
  return { valid: true, reasons: [] };
}

function actorStageFor(phase) {
  if (['JACK_APPROACH','JACK_INSERT'].includes(phase))return 'move';
  if (phase === 'JACK_LIFT')return 'lift';
  if (phase === 'FORK_WITHDRAW')return 'move';
  if (phase === 'MOVE_TO_CARGO') return 'move';
  if (['ALIGN_FOR_PICKUP', 'INSERT_FORKS'].includes(phase)) return 'pickup';
  if (phase === 'LIFT_CARGO') return 'lift';
  if (['MOVE_TO_STAGING', 'ALIGN_WITH_DOOR'].includes(phase)) return 'carry';
  if (['ENTER_CONTAINER', 'MOVE_INSIDE', 'ALIGN_WITH_TARGET'].includes(phase)) return 'enter';
  if (phase === 'LOWER_CARGO') return 'place';
  if (phase === 'RELEASE_CARGO') return 'release';
  if (phase === 'REVERSE_OUT') return 'exit';
  if (phase === 'RETURN_FOR_NEXT') return 'return';
  if (phase === 'BLOCKED') return 'blocked';
  if (phase === 'COMPLETED') return 'completed';
  if (phase === 'PAUSED') return 'paused';
  return 'idle';
}

function actorPresentation(meta, phase, cargo) {
  if (cargo?.handlingMethod !== 'manual') {
    const jack={ENTER_CONTAINER:['地牛进箱','人员操纵地牛，经门洞送入托盘'],MOVE_INSIDE:['地牛箱内输送','人员与地牛沿当前通道送往目标位置'],LOWER_CARGO:['地牛落货','降低托盘至计划底面，释放承载'],RELEASE_CARGO:['地牛释放','货物保持计划坐标，准备抽出低位货叉'],REVERSE_OUT:['地牛退出','人员拖回空载地牛，沿进入路线退出'],RETURN_FOR_NEXT:['地牛返回','人员将空载地牛送回等候点，准备下一件']};
    const [label,action]=jack[phase]||[];
    return label?{...meta,label,action}:meta;
  }
  const manual = {
    MOVE_TO_CARGO: ['走向货物', '装卸工沿安全通道走向等待区货物'],
    ALIGN_FOR_PICKUP: ['人工取货站位', '装卸工在货物两侧完成抓握站位'],
    INSERT_FORKS: ['俯身握持', '双臂伸出并稳定握持货物底部'],
    LIFT_CARGO: ['人工抬起', '装卸工屈膝抬起轻货并保持贴身搬运'],
    MOVE_TO_STAGING: ['搬运至门外', '装卸工连续步行至门前对准区'],
    ALIGN_WITH_DOOR: ['人工对准门洞', '保持货物水平并对准集装箱后门'],
    ENTER_CONTAINER: ['人工进箱', '装卸工携货连续通过门洞进入箱内'],
    MOVE_INSIDE: ['箱内搬运', '装卸工沿当前演示通道走向真实目标位置'],
    ALIGN_WITH_TARGET: ['人工目标对准', '装卸工按算法坐标对准目标区域'],
    LOWER_CARGO: ['人工放低', '装卸工屈膝将货物连续降至目标层'],
    RELEASE_CARGO: ['完成放置', '双臂松开，货物固定在后端方案坐标'],
    REVERSE_OUT: ['人员退出', '装卸工沿原路径连续退出箱体'],
    RETURN_FOR_NEXT: ['人员返回', '装卸工返回等待区准备下一件货物'],
    BLOCKED: ['人工路径阻断', '人工搬运路径或目标不合法，货物保持原方案位置']
  };
  const [label, action] = manual[phase] || [];
  return label ? { ...meta, label, action } : meta;
}

function ease(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

// 工人休息点：门侧人工暂存区旁边，不占用设备通道。
function manualHome(container = {}) {
  const length = Number(container.innerLength || 0);
  return { x: length + 1700, y: YARD_LEVEL_MM, z: -400 };
}

// 取货站位：槽位排侧通道，面向货堆。
function manualPickupStand(path, cargo) {
  return {
    x: path.waiting.x + Number(cargo.l || 0) / 2,
    y: YARD_LEVEL_MM,
    z: path.waiting.z + Number(cargo.w || 0) + 350
  };
}

function manualDoorStand(container, path, cargo) {
  const enterLine = manualEnterPolyline(path);
  const first = enterLine[0] || path.staging;
  return {
    x: first.x + Number(cargo.l || 0) + 260,
    y: YARD_LEVEL_MM,
    z: first.z + Number(cargo.w || 0) / 2
  };
}

// 人工进箱折线按门平面 x=L 切成两段：ENTER_CONTAINER（过门）与 MOVE_INSIDE（箱内）。
// 两段共享门平面交点，保证阶段边界姿态连续。
function manualEnterPolyline(path) {
  return splitManualPolyline(path).enter;
}

function manualInsidePolyline(path) {
  return splitManualPolyline(path).inside;
}

function splitManualPolyline(path) {
  const approach = path.manualEntry?.approach?.length ? path.manualEntry.approach : [path.staging, path.manualEntry?.face || path.insideAligned];
  const plane = Number(path.doorPlaneX ?? path.containerLength ?? approach[0]?.x ?? 0);
  const enter = [approach[0]];
  const inside = [];
  for (let index = 1; index < approach.length; index += 1) {
    const prev = approach[index - 1];
    const point = approach[index];
    if (prev.x > plane && point.x <= plane) {
      const t = (prev.x - plane) / Math.max(1e-6, prev.x - point.x);
      const crossing = lerpPoint(prev, point, t);
      enter.push(crossing);
      inside.push(crossing);
    }
    if (point.x > plane) enter.push(point);
    else inside.push(point);
  }
  if (!inside.length) inside.push(enter.at(-1));
  return { enter, inside };
}

function forkliftStandoff(path, cargo) {
  return {
    x: path.waiting.x + Number(cargo.l || 0) + 760,
    y: YARD_LEVEL_MM,
    z: path.waiting.z + Number(cargo.w || 0) / 2 + 260
  };
}

/**
 * 场院编舞：取货接近路线 / 载货运输路线（body 轨道）。
 * 所有轨道只经过"永远为空"的区域：主干通道、门区净空带、已消费的槽位通道。
 */
function buildYardChoreography(cargo, container, path, slot) {
  if (!slot) return null;
  const length = Number(container.innerLength || 0);
  const l = Number(cargo.l || 0);
  const w = Number(cargo.w || 0);
  const aisleX = length + AISLE_FRONT_MM;
  if (slot.handlingClass === 'manual') {
    const home = manualHome(container);
    const stand = { x: Number(slot.standX ?? (slot.x + l / 2)), y: YARD_LEVEL_MM, z: Number(slot.stripZ ?? (slot.z + w + 350)) };
    const approach = [
      home,
      { x: aisleX, y: YARD_LEVEL_MM, z: home.z },
      { x: aisleX, y: YARD_LEVEL_MM, z: stand.z },
      stand
    ];
    const doorStand = {
      x: length + 400 + l + 260,
      y: YARD_LEVEL_MM,
      z: path.doorZ + w / 2
    };
    const carryTo = [
      stand,
      { x: aisleX, y: YARD_LEVEL_MM, z: stand.z },
      { x: aisleX, y: YARD_LEVEL_MM, z: doorStand.z },
      doorStand
    ];
    const carryStart = { x: stand.x - l / 2, y: YARD_LEVEL_MM + 850, z: stand.z - 260 - w };
    return { kind: 'manual', home, stand, approach, carryTo, doorStand, carryStart };
  }
  const home = forkliftHome(container);
  const channelX = Number(slot.channelX ?? (slot.x + l / 2));
  const pickupContact = { x: channelX, y: YARD_LEVEL_MM, z: Number(slot.z) + (w-l)/2 - 780 };
  const pickupFork = {...pickupContact,z:pickupContact.z-650};
  const approach = [
    home,
    { x: home.x, y: YARD_LEVEL_MM, z: YARD_ROAD_Z },
    { x: channelX, y: YARD_LEVEL_MM, z: YARD_ROAD_Z },
    pickupFork
  ];
  const stagingBody = {
    x: path.staging.x + l + 780,
    y: groundYAtX(path.staging.x + l + 780, container),
    z: path.staging.z + w / 2
  };
  const carryBody = [
    pickupContact,
    { x: channelX, y: YARD_LEVEL_MM, z: YARD_ROAD_Z },
    { x: aisleX, y: YARD_LEVEL_MM, z: YARD_ROAD_Z },
    { x: aisleX, y: YARD_LEVEL_MM, z: path.doorZ + w / 2 },
    stagingBody
  ];
  return { kind: 'forklift', home, pickupFork, pickupContact, approach, carryBody, stagingBody };
}

// 轨道取点 + 该点所在分段的行进朝向。backwardHead：首段为倒车（车头朝轨道反方向）。
function trackPointYaw(track, progress, { backwardHead = false, reverseYaw = false } = {}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const point = pointAlongPolyline(track, clamped);
  const lengths = track.slice(1).map((point2, index) => Math.hypot(point2.x - track[index].x, (point2.y || 0) - (track[index].y || 0), point2.z - track[index].z));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let traveled = clamped * total;
  let segment = 0;
  while (segment < lengths.length - 1 && traveled > lengths[segment]) {
    traveled -= lengths[segment];
    segment += 1;
  }
  let yaw = headingFor(track[segment], track[segment + 1]);
  if (backwardHead && segment === 0) yaw = headingFor(track[1], track[0]);
  if (reverseYaw) yaw += Math.PI;
  // Keep heading continuous through an outdoor manoeuvre. The same parameter
  // drives body, attached cargo and the steering mechanism; pause freezes all.
  const heading=index=>{
    let value=headingFor(track[index],track[index+1]);
    if(backwardHead && index===0)value+=Math.PI;
    return value+(reverseYaw?Math.PI:0);
  };
  const blendLength=Math.min(450,lengths[segment]*.3);
  if(segment>0 && traveled<blendLength)yaw=lerpAngle(lerpAngle(heading(segment-1),yaw,.5),yaw,ease(traveled/blendLength));
  if(segment<lengths.length-1 && lengths[segment]-traveled<blendLength)yaw=lerpAngle(yaw,lerpAngle(yaw,heading(segment+1),.5),ease(1-(lengths[segment]-traveled)/blendLength));
  return { point, yaw };
}

function yawFromTrack(track) {
  if (!track || track.length < 2) return null;
  return headingFor(track.at(-2), track.at(-1));
}

// 货物随 actor 的持握位置（min-corner）：身前 trailerMm + 朝向轴向上货物半边长处。
// 朝向 -X 时等价于 bodyFor 的 cargo.x + l + 780 关系；朝向 ±Z 时用 w 计算。
function carriedCargo(bodyPoint, yaw, cargo, trailerMm) {
  const l = Number(cargo.l || 0);
  const w = Number(cargo.w || 0);
  const forward = { x: -Math.cos(yaw), z: Math.sin(yaw) };
  const extent = cargo.handlingMethod==='manual' ? Math.abs(forward.x) * l + Math.abs(forward.z) * w : l;
  const center = {
    x: bodyPoint.x + forward.x * (trailerMm + extent / 2),
    z: bodyPoint.z + forward.z * (trailerMm + extent / 2)
  };
  return { x: center.x - l / 2, z: center.z - w / 2 };
}

function headingFor(start, end) {
  return Math.atan2(Number(end.z || 0) - Number(start.z || 0), -(Number(end.x || 0) - Number(start.x || 0)));
}

function lerpAngle(start, end, progress) {
  let delta = (end - start + Math.PI) % (Math.PI * 2) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return start + delta * progress;
}
