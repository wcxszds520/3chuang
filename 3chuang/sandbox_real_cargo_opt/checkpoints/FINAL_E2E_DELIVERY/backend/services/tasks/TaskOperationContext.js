'use strict';

const {createHash} = require('crypto');
const {fail} = require('./LoadTaskModel');

const PHASES = {
  IDLE:'准备作业',REVIEW:'完整方案，尚未回放',OPENING_DOORS:'打开箱门',MOVE_TO_CARGO:'接近货物',
  ALIGN_FOR_PICKUP:'取货对准',INSERT_FORKS:'插入货叉',LIFT_CARGO:'抬升货物',MOVE_TO_STAGING:'移至门外',
  ALIGN_WITH_DOOR:'对准箱门',HANDOFF_LOWER:'门外放下托盘',FORK_WITHDRAW:'叉车退出交接位',
  JACK_APPROACH:'地牛接近托盘',JACK_INSERT:'地牛插入托盘',JACK_LIFT:'地牛低位抬升',
  ENTER_CONTAINER:'通过箱门',MOVE_INSIDE:'箱内搬运',ALIGN_WITH_TARGET:'目标对准',LOWER_CARGO:'降低货物',
  RELEASE_CARGO:'释放货物',REVERSE_OUT:'退出箱内',RETURN_FOR_NEXT:'返回等待区',PAUSED:'已暂停',
  BLOCKED:'作业阻断',COMPLETED:'回放完成',UNLOADING:'卸货回放'
};
const BLOCKS = {
  FORK_AXIS_UNVERIFIED:'双向叉孔进叉轴未确认',FORK_AXIS_MISMATCH:'旋转后的叉孔轴不朝向箱门',JACK_INTERFACE_UNVERIFIED:'地牛底轮与运输底座未确认相容',FORKLIFT_SITE_UNVERIFIED:'平齐月台、桥板总承载或箱地板轴载缺少匹配数据',FORKLIFT_CAPACITY_EXCEEDED:'超出叉车参考载荷或自由起升范围',FORKLIFT_DOOR_CLEARANCE:'车身或门架与门洞或箱内净空不匹配',FORKLIFT_PATH_OBSTRUCTED:'叉车底盘、门架或退出通道被占用',
  FORK_INTERFACE_UNVERIFIED:'运输底座或叉孔接口未匹配',HIGH_STOW_UNVERIFIED:'当前设备或人员不能完成目标层高',
  JACK_ENVELOPE_EXCEEDED:'托盘尺寸、质量或载荷中心不匹配所选地牛',PERSON_PATH_OBSTRUCTED:'人员通道被已放置货物占用',
  PLACEMENT_SUPPORT_UNVERIFIED:'目标层缺少已就位的允许承压支撑面',DOOR_OPENING_TOO_SMALL:'货物不能通过门洞',
  PATH_BELOW_FLOOR:'路径低于地板',PATH_COLLIDES_CARGO:'路径与货物碰撞',PATH_HITS_DOOR_FRAME:'路径碰撞门框',
  PATH_HITS_FRONT_WALL:'路径碰撞深端墙',PATH_HITS_ROOF:'路径碰撞顶板',PATH_HITS_SIDE_WALL:'路径碰撞侧墙',
  PATH_INCOMPLETE:'路径不完整',TARGET_COLLIDES_CARGO:'目标位置与货物碰撞',TARGET_OUTSIDE_CONTAINER:'目标位置超出箱内边界',
  DOORS_CLOSED:'箱门未打开',MANUAL_CAPACITY_EXCEEDED:'货物超出当前人工搬运范围',MANUAL_DATA_INCOMPLETE:'人工搬运数据不完整'
};
const UNLOAD_STEPS = {
  RETURN_FOR_NEXT:'接近箱门',REVERSE_OUT:'空载进入取货位',RELEASE_CARGO:'握持 / 插叉',
  LOWER_CARGO:'提起并离开支撑面',ALIGN_WITH_TARGET:'退出原货位',MOVE_INSIDE:'沿空通道后退搬出',
  ENTER_CONTAINER:'通过箱门',JACK_LIFT:'地牛放下交接',JACK_INSERT:'地牛抽叉',JACK_APPROACH:'地牛退至等待区',
  FORK_WITHDRAW:'叉车接近交接位',HANDOFF_LOWER:'叉车提取货物',ALIGN_WITH_DOOR:'门外对准',
  MOVE_TO_STAGING:'运往卸货暂存位',LIFT_CARGO:'降低货物',INSERT_FORKS:'落位并释放',
  ALIGN_FOR_PICKUP:'确认落位',MOVE_TO_CARGO:'设备 / 人员返回'
};

function taskOperationContext(input, container) {
  if (!input) return null;
  const reject = () => fail('回放快照与当前柜方案不匹配，请重新选择当前回放', 'TASK_OPERATION_STALE', 409);
  if (!container || input.planHash !== container.plan.placementHash || !Object.hasOwn(PHASES,input.phase)
    || !['load','unload'].includes(input.direction)) reject();
  const units = new Map(container.plan.loadedCargo.map(p => [p.cargoId,p]));
  const completed = input.completedUnitIds;
  if (!Array.isArray(completed) || new Set(completed).size !== completed.length || completed.some(id => !units.has(id))
    || (input.activeUnitId && !units.has(input.activeUnitId))) reject();
  if (input.phase === 'REVIEW' && completed.length) reject();
  if (input.phase === 'COMPLETED' && completed.length !== units.size) reject();
  const codes = input.blockedCodes || [];
  if (!Array.isArray(codes) || codes.some(code => !Object.hasOwn(BLOCKS,code)) || (codes.length && input.phase !== 'BLOCKED')
    || (input.phase === 'BLOCKED' && !codes.length)) reject();
  const active = units.get(input.activeUnitId);
  const labels=input.direction==='unload' ? UNLOAD_STEPS : PHASES;
  const stepLabel=Object.hasOwn(labels,input.step) ? labels[input.step] : null;
  const operation = {
    source:'CLIENT_REPLAY_SNAPSHOT', scope:'当前页面的参考设备预演；服务端核对方案与身份，未重新执行动画，不代表现场实际装入或出运认可',
    direction:input.direction,phase:input.phase,phaseLabel:['UNLOADING','PAUSED'].includes(input.phase)&&stepLabel ? stepLabel : PHASES[input.phase],playing:input.playing===true,
    step:Object.hasOwn(PHASES,input.step) ? input.step : null,stepLabel,completedCount:completed.length,total:units.size,
    activeUnit:active ? {unitId:active.cargoId,name:active.name,customerName:active.customerName,handlingMethod:active.handlingMethod,l:active.l,w:active.w,h:active.h,weight:active.weight} : null,
    blockedReasons:[...new Set(codes)].map(code => ({code,message:BLOCKS[code]}))
  };
  operation.signature = createHash('sha256').update(JSON.stringify({...operation,completed})).digest('hex').slice(0,16);
  return operation;
}

module.exports = {taskOperationContext};
