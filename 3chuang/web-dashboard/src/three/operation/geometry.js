import { DOOR_REACH_MM, yardLevel, groundYAtX } from './stagingLayout.js';

export const DEFAULT_CLEARANCE = Object.freeze({ side: 30, top: 35, bottom: 5, collision: 2 });

export function deriveContainerGeometry(container) {
  const length = positive(container?.innerLength);
  const width = positive(container?.innerWidth);
  const height = positive(container?.innerHeight);
  const doorWidth=Math.min(width,positive(container?.doorWidth) || width);
  const doorHeight=Math.min(height,positive(container?.doorHeight) || height);
  const doorOffset=(width-doorWidth)/2;
  return {
    length,
    width,
    height,
    doorWidth,doorHeight,
    doorPlaneX: length,
    doorNormal: { x: 1, y: 0, z: 0 },
    doorOpening: {
      minY: DEFAULT_CLEARANCE.bottom,
      maxY: doorHeight - DEFAULT_CLEARANCE.top,
      minZ: doorOffset+DEFAULT_CLEARANCE.side,
      maxZ: doorOffset+doorWidth-DEFAULT_CLEARANCE.side
    },
    inside: { minX: 0, maxX: length, minY: 0, maxY: height, minZ: 0, maxZ: width },
    waitingZone: { minX: length + 2200, maxX: length + 6200, minZ: -1200, maxZ: width + 1200 },
    stagingPoint: { x: length + 1500, y: 0, z: width / 2 }
  };
}

export function cargoAabb(cargo, position = cargo) {
  const x = finite(position?.x);
  const y = finite(position?.y);
  const z = finite(position?.z);
  return {
    minX: x,
    maxX: x + positive(cargo?.l ?? cargo?.length),
    minY: y,
    maxY: y + positive(cargo?.h ?? cargo?.height),
    minZ: z,
    maxZ: z + positive(cargo?.w ?? cargo?.width)
  };
}

export function aabbIntersects(a, b, tolerance = DEFAULT_CLEARANCE.collision) {
  return a.minX < b.maxX - tolerance && a.maxX > b.minX + tolerance
    && a.minY < b.maxY - tolerance && a.maxY > b.minY + tolerance
    && a.minZ < b.maxZ - tolerance && a.maxZ > b.minZ + tolerance;
}

export function isTargetInside(cargo, container, tolerance = 1) {
  const box = cargoAabb(cargo);
  const geometry = deriveContainerGeometry(container);
  return box.minX >= -tolerance && box.maxX <= geometry.length + tolerance
    && box.minY >= -tolerance && box.maxY <= geometry.height + tolerance
    && box.minZ >= -tolerance && box.maxZ <= geometry.width + tolerance;
}

export function fitsDoorOpening(cargo, container, clearance = DEFAULT_CLEARANCE) {
  const geometry = deriveContainerGeometry(container);
  const width = positive(cargo?.w ?? cargo?.width);
  const height = positive(cargo?.h ?? cargo?.height);
  return {
    valid: width <= geometry.doorWidth - clearance.side * 2 && height <= geometry.doorHeight - clearance.top - clearance.bottom,
    availableWidth: geometry.doorWidth - clearance.side * 2,
    availableHeight: geometry.doorHeight - clearance.top - clearance.bottom,
    cargoWidth: width,
    cargoHeight: height
  };
}

export function validateTarget(cargo, container, placedCargo = []) {
  const reasons = [];
  if (!isTargetInside(cargo, container)) reasons.push({ code: 'TARGET_OUTSIDE_CONTAINER', message: '目标位置超出箱内合法边界' });
  const targetBox = cargoAabb(cargo);
  const collision = placedCargo.find((placed) => aabbIntersects(targetBox, cargoAabb(placed)));
  if (collision) reasons.push({ code: 'TARGET_COLLIDES_CARGO', message: `目标位置与已装货物 ${collision.sku || collision.cargoId} 相交`, cargoId: collision.cargoId });
  return { valid: reasons.length === 0, reasons };
}

// 人工搬运：货物底面相对脚下支撑面的手持高度（mm）。
export const MANUAL_CARRY_HEIGHT = 850;
// 叉车在场院/坡道上的低位运输高度（货叉距地面，mm）。
export const FORK_TRAVEL_CLEARANCE = 420;

/**
 * 点 (x,z) 处已装货物顶面高度（集装箱局部 mm）。无货物时为箱内地板 0。
 * 人工进箱踩着已装货物向前走，是真实掏装箱作业；该函数给出脚下支撑高度。
 */
export function stowTopAt(x, z, placedCargo = []) {
  let top = 0;
  for (const placed of placedCargo) {
    const px = finite(placed.x);
    const pz = finite(placed.z);
    const pl = positive(placed.l ?? placed.length);
    const pw = positive(placed.w ?? placed.width);
    if (x < px - 40 || x > px + pl + 40 || z < pz - 40 || z > pz + pw + 40) continue;
    top = Math.max(top, finite(placed.y) + positive(placed.h ?? placed.height));
  }
  return top;
}

/**
 * 货物足迹矩形 [x,x+l]×[z,z+w] 下方的最高支撑顶面。
 * 手持搬运时货物有体积，净空必须按整个足迹计算，而不是中心点。
 */
export function stowTopOver(x, z, l, w, placedCargo = []) {
  let top = 0;
  for (const placed of placedCargo) {
    const px = finite(placed.x);
    const pz = finite(placed.z);
    const pl = positive(placed.l ?? placed.length);
    const pw = positive(placed.w ?? placed.width);
    if (x + l <= px + 2 || x >= px + pl - 2 || z + w <= pz + 2 || z >= pz + pw - 2) continue;
    top = Math.max(top, finite(placed.y) + positive(placed.h ?? placed.height));
  }
  return top;
}

export function buildCargoPath(cargo, container, queueIndex = 0, options = {}) {
  const geometry = deriveContainerGeometry(container);
  const l = positive(cargo.l);
  const h = positive(cargo.h);
  const target = { x: finite(cargo.x), y: finite(cargo.y), z: finite(cargo.z) };
  const doorTransitY = clamp(target.y, DEFAULT_CLEARANCE.bottom, Math.max(DEFAULT_CLEARANCE.bottom, geometry.doorHeight - DEFAULT_CLEARANCE.top - h));
  const travelY = target.y;
  const liftOffset = travelY - doorTransitY;
  const cargoWidth = positive(cargo.w);
  const doorZ = clamp(target.z, geometry.doorOpening.minZ, Math.max(geometry.doorOpening.minZ, geometry.doorOpening.maxZ - cargoWidth));
  const slot = options.waitingSlot;
  const waiting = slot
    ? { x: finite(slot.x), y: finite(slot.y), z: finite(slot.z) }
    : {
      x: geometry.length + 3300 + (queueIndex % 4) * 620,
      y: yardLevel(container),
      z: doorZ
    };
  const yardCarryY = Math.max(waiting.y + 60, yardLevel(container) + FORK_TRAVEL_CLEARANCE);
  const waitingLifted = { ...waiting, y: yardCarryY };
  // 门区对准点：位于坡道上段，叉车门架贴近门平面。
  const staging = { x: geometry.length + 400, y: groundYAtX(geometry.length + 400, container) + FORK_TRAVEL_CLEARANCE, z: doorZ };
  // 门口举升点：在门区把货物从低位运输高度举到进箱高度（真实叉车"到位再起升"）。
  const doorTransitLift = { ...staging, y: doorTransitY };
  const doorApproach = { x: geometry.length + 140, y: doorTransitY, z: doorZ };
  const doorInside = { x: Math.max(target.x, Math.max(0, geometry.length - l - DEFAULT_CLEARANCE.side)), y: doorTransitY, z: doorZ };
  const postDoorAligned = { ...doorInside, z: target.z };
  const postDoorLifted = { ...postDoorAligned, y: travelY };
  const insideAligned = { x: target.x, y: travelY, z: target.z };
  const targetHover = { ...target, y: travelY + 80 };
  const home = { x: geometry.length + 4700, y: yardLevel(container), z: geometry.width / 2 };
  // 目标在门区货叉可达范围内时，大型平衡重叉车车身留在门外，仅货叉伸入。
  const entersContainer = target.x + l < geometry.length - DOOR_REACH_MM;
  return {
    home,
    waiting,
    waitingLifted,
    staging,
    doorTransitLift,
    doorApproach,
    doorInside,
    postDoorAligned,
    postDoorLifted,
    insideAligned,
    targetHover,
    target,
    entry: [doorTransitLift, doorApproach, doorInside, postDoorAligned, postDoorLifted, insideAligned, targetHover, target],
    exit: [targetHover, insideAligned, postDoorLifted, postDoorAligned, doorInside, doorApproach, staging],
    travelY,
    liftOffset,
    doorZ,
    yardCarryY,
    entersContainer,
    doorPlaneX: geometry.length,
    containerLength: geometry.length
  };
}

/**
 * 人工搬运的进箱路径：工人在地面通道携货行走，不使用货堆作为人员支撑面。
 * 采样折线用于动画与货物碰撞检查；人员包络另行检查。
 */
export function buildManualEntry(cargo, container, path) {
  const geometry = deriveContainerGeometry(container);
  const l = positive(cargo.l);
  const h = positive(cargo.h);
  const target = path.target;
  const carryCap = Math.max(MANUAL_CARRY_HEIGHT, geometry.height - DEFAULT_CLEARANCE.top - h);
  const carryYAt = (x) => {
    const ground = groundYAtX(x+l+260, container);
    return Math.min(ground + MANUAL_CARRY_HEIGHT, carryCap);
  };
  // 堆叠面：常规 = 目标列门侧 420mm；门边目标回退到 max(目标列, 完全进箱点)，
  // 保证下降段始终落在目标列自身空位内，不切相邻货堆顶角。
  const faceX = target.y > MANUAL_CARRY_HEIGHT-40 ? target.x+l+30 : target.x;
  const startX = geometry.length + 400;
  // z 向滑动在堆叠面（faceX，必然整箱在门内）处以手持高度完成，
  // 滑动段 x 固定，校验以 100mm 采样也不会在门平面处越框。
  const pivotX = faceX;
  const legA = Math.max(1, startX - pivotX);
  const legB = Math.max(1, Math.abs(target.z - path.doorZ));
  const stepsA = Math.max(1, Math.ceil(legA / 450));
  const stepsB = Math.max(1, Math.ceil(legB / 450));
  const samples = [];
  for (let index = 0; index <= stepsA; index += 1) {
    const x = startX - (legA * index) / stepsA;
    samples.push({ x, z: path.doorZ });
  }
  for (let index = 1; index <= stepsB; index += 1) {
    const t = index / stepsB;
    samples.push({ x: pivotX, z: path.doorZ + (target.z - path.doorZ) * t });
  }
  for (const sample of samples) sample.y = carryYAt(sample.x - l / 2, sample.z);
  const hover = { ...target, y: target.y + 40 };
  return {
    approach: samples,
    face: samples.at(-1),
    // 原地举升点：先在堆叠面举到目标层上方，再水平前移，最后落位——
    // 避免斜线下落切进相邻货堆。
    faceLift: { ...samples.at(-1), y: hover.y },
    hover,
    workerStops: samples.map((sample) => ({
      x: sample.x + l + 260,
      z: sample.z + positive(cargo.w) / 2
    }))
  };
}

export function validateCargoPath(cargo, container, placedCargo = [], path = buildCargoPath(cargo, container).entry, options = {}) {
  const clearance = { ...DEFAULT_CLEARANCE, ...(options.clearance || {}) };
  const reasons = [];
  const doorFit = fitsDoorOpening(cargo, container, clearance);
  if (!doorFit.valid) reasons.push({ code: 'DOOR_OPENING_TOO_SMALL', message: `货物朝向后 ${doorFit.cargoWidth}×${doorFit.cargoHeight} mm，超过门洞可用 ${doorFit.availableWidth}×${doorFit.availableHeight} mm` });
  reasons.push(...validateTarget(cargo, container, placedCargo).reasons);

  if (!Array.isArray(path) || path.length < 2) reasons.push({ code: 'PATH_INCOMPLETE', message: '进入路径缺少必要分段' });
  else {
    const samples = samplePolyline(path, options.sampleStep || 100);
    const geometry = deriveContainerGeometry(container);
    for (const position of samples) {
      const box = cargoAabb(cargo, position);
      const touchesContainer = box.minX < geometry.length && box.maxX > 0;
      const crossesDoor = box.minX < geometry.doorPlaneX && box.maxX > geometry.doorPlaneX;
      if (touchesContainer) {
        const blocker = placedCargo.find((placed) => aabbIntersects(box, cargoAabb(placed), clearance.collision));
        if (blocker) {
          reasons.push({
            code: 'PATH_COLLIDES_CARGO',
            message: `插入路径与已装货物 ${blocker.sku || blocker.cargoId} 相交`,
            cargoId: blocker.cargoId
          });
          break;
        }
        if (box.minX < -1) {
          reasons.push({ code: 'PATH_HITS_FRONT_WALL', message: '路径越过箱体前壁（低 X 端）' });
          break;
        }
        if (box.minY < -1) {
          reasons.push({ code: 'PATH_BELOW_FLOOR', message: '路径进入地板下方' });
          break;
        }
        if (box.maxY > geometry.height + 1) {
          reasons.push({ code: 'PATH_HITS_ROOF', message: '路径与顶板相交' });
          break;
        }
        if (box.minZ < -1 || box.maxZ > geometry.width + 1) {
          reasons.push({ code: 'PATH_HITS_SIDE_WALL', message: '路径与侧壁相交' });
          break;
        }
        if (crossesDoor && (
          box.minZ < geometry.doorOpening.minZ
          || box.maxZ > geometry.doorOpening.maxZ
          || box.minY < geometry.doorOpening.minY
          || box.maxY > geometry.doorOpening.maxY
        )) {
          reasons.push({ code: 'PATH_HITS_DOOR_FRAME', message: '货物通过门平面时与门框相交' });
          break;
        }
      }
    }
  }

  const unique = [...new Map(reasons.map((reason) => [`${reason.code}-${reason.cargoId || ''}`, reason])).values()];
  return { valid: unique.length === 0, reasons: unique, doorFit };
}

export function samplePolyline(points, step = 100) {
  const samples = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const distance = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
    const count = Math.max(1, Math.ceil(distance / Math.max(1, step)));
    for (let sample = 0; sample <= count; sample += 1) {
      if (index > 0 && sample === 0) continue;
      samples.push(lerpPoint(start, end, sample / count));
    }
  }
  return samples;
}

export function lerpPoint(start, end, progress) {
  const t = clamp(progress, 0, 1);
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, z: start.z + (end.z - start.z) * t };
}

export function pointAlongPolyline(points, progress) {
  if (!points.length) return { x: 0, y: 0, z: 0 };
  if (points.length === 1) return { ...points[0] };
  const lengths = points.slice(0, -1).map((point, index) => Math.hypot(points[index + 1].x - point.x, points[index + 1].y - point.y, points[index + 1].z - point.z));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let remaining = clamp(progress, 0, 1) * total;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) return lerpPoint(points[index], points[index + 1], lengths[index] ? remaining / lengths[index] : 1);
    remaining -= lengths[index];
  }
  return { ...points.at(-1) };
}

function positive(value) {
  return Math.max(0, finite(value));
}
function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
