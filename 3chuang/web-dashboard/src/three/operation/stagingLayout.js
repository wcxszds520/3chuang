// Presentation-only queue sample. Formal coordinates and loading order are untouched.
export const YARD_DROP_MM = 220;
export const YARD_LEVEL_MM = -YARD_DROP_MM;
export const RAMP_RUN_MM = 1500;
export const DOOR_REACH_MM = 1400;
export const AISLE_FRONT_MM = 2000;
export const YARD_ROAD_Z = 300;

export const yardLevel = container => container?.operationProfile==='COMPACT_FORKLIFT'?0:YARD_LEVEL_MM;

export function groundYAtX(x, container = {}) {
  const t = Math.max(0, Math.min(1, (Number(x) - Number(container.innerLength || 0)) / RAMP_RUN_MM));
  return t===0 ? 0 : yardLevel(container) * t;
}

export function groundAtXZ(x, z, container = {}) {
  return z < 0 || z > Number(container.innerWidth || 0) ? yardLevel(container) : groundYAtX(x, container);
}

// The two pickup positions persist when “next” becomes “current”. The pool is
// representative stock, distinct from those two actual units.
export function buildOperationSlots(queue = [], container = {}) {
  const length = Number(container.innerLength || 0);
  const pitch=Math.max(1800,...queue.map(c=>Math.max(Number(c.l),Number(c.w))+350));
  return new Map(queue.map((cargo,index) => {
    const l=Number(cargo.l),w=Number(cargo.w);
    const x=length+3800+(index%2)*pitch,z=1700;
    return [index,{x,y:yardLevel(container),z,channelX:x+l/2,standX:x+l/2,stripZ:z+w+260,
      handlingClass:cargo.handlingMethod==='manual'?'manual':'forklift'}];
  }));
}

export function stagingPresentation(queue, snapshot, container) {
  const placed=new Set((snapshot.placedCargo || []).map(c=>c.cargoId));
  const current=snapshot.currentIndex;
  const active=queue[current] && !placed.has(queue[current].cargoId) ? current : null;
  const carrying=active!==null && Boolean(snapshot.inProgress ?? snapshot.attached);
  const waiting=queue.map((_,i)=>i).filter(i=>!placed.has(queue[i].cargoId) && !(carrying&&i===active));
  const next=waiting.find(i=>i>current) ?? null;
  const groups=new Map();
  for(const i of waiting.filter(i=>i!==active&&i!==next)){
    const key=queue[i].packagingType||'GENERIC';
    if(!groups.has(key))groups.set(key,{key,indices:[]});
    groups.get(key).indices.push(i);
  }
  const representatives=[];
  const xPitch=Math.max(1350,...queue.map(c=>Number(c.l)+250));
  const zPitch=Math.max(1150,...queue.map(c=>Number(c.w)+250));
  [...groups.values()].forEach((group,g)=>{
    group.indices.slice(0,4).forEach((index,j)=>representatives.push({index,slot:{
      x:Number(container.innerLength)+2900+(g%2)*(xPitch*2+500)+(j%2)*xPitch,
      y:yardLevel(container),z:4000+Math.floor(g/2)*(zPitch*2+300)+Math.floor(j/2)*zPitch}}));
  });
  return {active,next,waiting:waiting.length,carrying:carrying?1:0,placed:placed.size,groups:[...groups.values()],representatives};
}

export function stagingGroups(queue = [], current = 0) {
  const groups = new Map();
  queue.forEach((cargo, index) => {
    const key = cargo.packagingType || 'GENERIC';
    if (!groups.has(key)) groups.set(key, {key, indices: [], allIndices: []});
    groups.get(key).allIndices.push(index);
    if (index >= current) groups.get(key).indices.push(index);
  });
  return [...groups.values()].filter(group => group.indices.length);
}

export function representativeStagingIndices(queue = [], current = 0) {
  return stagingGroups(queue, current).flatMap(group => group.indices.slice(0, 2));
}

export function buildStagingLayout(queue = [], container = {}) {
  const slots = new Map();
  const length = Number(container.innerLength || 0);
  const groups = stagingGroups(queue);
  const maxL = Math.max(1200, ...queue.map(c => Number(c.l || c.length || 0)));
  const maxW = Math.max(1000, ...queue.map(c => Number(c.w || c.width || 0)));
  groups.forEach((group, groupIndex) => {
    group.indices.forEach((index, ordinal) => {
      const cargo = queue[index];
      const l = Number(cargo.l || cargo.length || 0);
      const w = Number(cargo.w || cargo.width || 0);
      // Two physical ground slots per real category; unseen units remain in the logical queue.
      const x = length + 2700 + (groupIndex % 2) * (maxL + 1000);
      const z = 1400 + Math.floor(groupIndex / 2) * (maxW * 2 + 750) + (ordinal % 2) * (maxW + 150);
      slots.set(index, {x, y: yardLevel(container), z, handlingClass: cargo.handlingMethod === 'manual' ? 'manual' : 'forklift',
        channelX: x + l / 2, stripZ: z + w + 350, standX: x + l / 2, stackTop: YARD_LEVEL_MM + Number(cargo.h || cargo.height || 0)});
    });
  });
  return slots;
}
