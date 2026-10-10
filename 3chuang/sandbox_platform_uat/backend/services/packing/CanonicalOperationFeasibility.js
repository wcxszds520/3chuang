'use strict';

const DEFAULT_CLEARANCE = Object.freeze({ side: 30, top: 35, bottom: 5, collision: 2 });

function analyzeOperationFeasibility({ placements = [], container: containerInput = {}, clearance: clearanceInput = {} } = {}) {
  const container = normalizeContainer(containerInput);
  const clearance = { ...DEFAULT_CLEARANCE, ...clearanceInput };
  const queue = canonicalLoadingSequence(placements, container);
  const placed = [];
  const reasons = [];
  for (let index = 0; index < queue.length; index++) {
    const cargo = queue[index];
    const result = validateCargoOperation(cargo, container, placed, { clearance });
    if (!result.feasible) reasons.push({ step: index + 1, cargoId: cargo.cargoId, reasons: result.reasons });
    placed.push(cargo);
  }
  return {
    model: 'PORTCUBE_CANONICAL_OPERATION_GEOMETRY_V2_3',
    doorSide: 'higher x coordinate',
    gravityAxis: 'y',
    widthAxis: 'z',
    lengthAxis: 'x',
    cargoInsertionPass: reasons.length === 0,
    forkApproachPass: reasons.every((entry) => entry.reasons.every((reason) => reason.code !== 'APPROACH_CORRIDOR_BLOCKED')),
    doorClearancePass: reasons.every((entry) => entry.reasons.every((reason) => reason.code !== 'DOOR_OPENING_TOO_SMALL' && reason.code !== 'PATH_HITS_DOOR_FRAME')),
    operationPathPass: reasons.length === 0,
    blockedCount: reasons.length,
    blockedCargoIds: reasons.map((entry) => entry.cargoId),
    reasons,
    loadingSequence: queue.map((item) => item.cargoId),
    policy: { ...clearance, dataClassification: 'PROJECT_POLICY' }
  };
}

function validateCargoOperation(cargo, containerInput, placedCargo = [], options = {}) {
  const container = normalizeContainer(containerInput);
  const clearance = { ...DEFAULT_CLEARANCE, ...(options.clearance || {}) };
  const reasons = [];
  const actorValidation = validateActorCargo(cargo);
  if (!actorValidation.valid) reasons.push(...actorValidation.reasons);
  const target = cargoAabb(cargo);
  if (!inside(target, container)) reasons.push(reason('TARGET_OUTSIDE_CONTAINER', '目标位置超出箱内合法边界'));
  const targetCollision = placedCargo.find((placed) => intersects(target, cargoAabb(placed), clearance.collision));
  if (targetCollision) reasons.push(reason('TARGET_COLLIDES_CARGO', `目标位置与已装货物 ${targetCollision.cargoId || targetCollision.sku} 相交`, targetCollision.cargoId));
  const width = positive(cargo.w ?? cargo.width);
  const height = positive(cargo.h ?? cargo.height);
  const availableWidth = container.innerWidth - clearance.side * 2;
  const availableHeight = container.innerHeight - clearance.top - clearance.bottom;
  if (width > availableWidth + 0.001 || height > availableHeight + 0.001) reasons.push(reason('DOOR_OPENING_TOO_SMALL', `货物朝向后 ${width}×${height} mm，超过门洞可用 ${availableWidth}×${availableHeight} mm`));
  const path = buildCanonicalCargoPath(cargo, container, options.queueIndex || 0, clearance);
  const samples = samplePolyline(path.entry, options.sampleStep || 100);
  for (const position of samples) {
    const box = cargoAabb(cargo, position);
    const touchesContainer = box.minX < container.innerLength && box.maxX > 0;
    if (!touchesContainer) continue;
    const blocker = placedCargo.find((placed) => intersects(box, cargoAabb(placed), clearance.collision));
    if (blocker) {
      reasons.push(reason('PATH_COLLIDES_CARGO', `规范插入路径与已装货物 ${blocker.cargoId || blocker.sku} 相交`, blocker.cargoId));
      break;
    }
    if (box.minX < -1) { reasons.push(reason('PATH_HITS_FRONT_WALL', '路径越过低 X 封闭端')); break; }
    if (box.minY < -1) { reasons.push(reason('PATH_BELOW_FLOOR', '路径进入地板下方')); break; }
    if (box.maxY > container.innerHeight + 1) { reasons.push(reason('PATH_HITS_ROOF', '路径与顶板相交')); break; }
    if (box.minZ < -1 || box.maxZ > container.innerWidth + 1) { reasons.push(reason('PATH_HITS_SIDE_WALL', '路径与侧壁相交')); break; }
    const crossesDoor = box.minX < container.innerLength && box.maxX > container.innerLength;
    if (crossesDoor && (box.minZ < clearance.side - 0.001 || box.maxZ > container.innerWidth - clearance.side + 0.001
      || box.minY < clearance.bottom - 0.001 || box.maxY > container.innerHeight - clearance.top + 0.001)) {
      reasons.push(reason('PATH_HITS_DOOR_FRAME', '货物通过高 X 门平面时与项目门框净空相交'));
      break;
    }
  }
  const unique = [...new Map(reasons.map((entry) => [`${entry.code}:${entry.cargoId || ''}`, entry])).values()];
  return { feasible: unique.length === 0, reasons: unique, path };
}

function validateActorCargo(cargo) {
  if (!cargo || !['manual', 'team_manual'].includes(cargo.handlingMethod)) return { valid: true, reasons: [] };
  const dimensions = {
    length: positive(cargo.l ?? cargo.length),
    width: positive(cargo.w ?? cargo.width),
    height: positive(cargo.h ?? cargo.height),
    weight: positive(cargo.weight)
  };
  const missing = Object.entries(dimensions).filter(([, value]) => value <= 0).map(([key]) => key);
  if (missing.length > 0) return {
    valid: false,
    reasons: [reason('MANUAL_DATA_INCOMPLETE', `人工搬运缺少必要属性：${missing.join(', ')}`)]
  };
  const isTeamManual = cargo.handlingMethod === 'team_manual';
  if (isTeamManual && cargo.handlingPolicy !== 'derived') return {
    valid: false,
    reasons: [reason('TEAM_MANUAL_POLICY_UNSUPPORTED', '协同人工搬运只能由明确的项目派生策略启用，不能覆盖用户指定的作业方式')]
  };
  const limits = isTeamManual
    ? { weight: 50, length: 1800, width: 1400, height: 1500 }
    : { weight: 25, length: 1200, width: 1200, height: 1000 };
  if (dimensions.weight > limits.weight || dimensions.length > limits.length || dimensions.width > limits.width || dimensions.height > limits.height) return {
    valid: false,
    reasons: [reason(isTeamManual ? 'TEAM_MANUAL_CAPACITY_EXCEEDED' : 'MANUAL_CAPACITY_EXCEEDED', `${isTeamManual ? '协同人工' : '人工'}搬运超出项目作业边界（${dimensions.length}×${dimensions.width}×${dimensions.height} mm，${dimensions.weight} kg）`)]
  };
  return { valid: true, reasons: [] };
}

function buildCanonicalCargoPath(cargo, containerInput, queueIndex = 0, clearanceInput = {}) {
  const container = normalizeContainer(containerInput);
  const clearance = { ...DEFAULT_CLEARANCE, ...clearanceInput };
  const l = positive(cargo.l ?? cargo.length);
  const h = positive(cargo.h ?? cargo.height);
  const w = positive(cargo.w ?? cargo.width);
  const target = { x: finite(cargo.x), y: finite(cargo.y), z: finite(cargo.z) };
  const doorTransitY = clamp(target.y, clearance.bottom, Math.max(clearance.bottom, container.innerHeight - clearance.top - h));
  const travelY = target.y;
  const liftOffset = travelY - doorTransitY;
  const doorZ = clamp(target.z, clearance.side, Math.max(clearance.side, container.innerWidth - clearance.side - w));
  const waiting = { x: container.innerLength + 3300 + (queueIndex % 4) * 620, y: 0, z: doorZ };
  const waitingLifted = { ...waiting, y: doorTransitY };
  const staging = { x: container.innerLength + 1450, y: doorTransitY, z: doorZ };
  const doorApproach = { x: container.innerLength + 140, y: doorTransitY, z: doorZ };
  // Never carry a door-adjacent target past its own final depth and then move
  // it back toward the door. For stacked cargo that artificial overshoot cuts
  // through its already loaded supporter. The target depth itself is a valid
  // inside staging plane when it is closer to the door than the nominal
  // clearance plane; door-frame clearance is still enforced while crossing.
  const doorInside = { x: Math.max(target.x, Math.max(0, container.innerLength - l - clearance.side)), y: doorTransitY, z: doorZ };
  // Lateral alignment is performed immediately after the cargo clears the
  // door plane, while the high-X staging cross-section is still unoccupied.
  // The old replay moved laterally only at target depth and hit adjacent cargo.
  const postDoorAligned = { ...doorInside, z: target.z };
  const postDoorLifted = { ...postDoorAligned, y: travelY };
  const insideAligned = { x: target.x, y: travelY, z: target.z };
  const targetHover = { ...target, y: travelY };
  return {
    waiting,
    waitingLifted,
    staging,
    doorApproach,
    doorInside,
    postDoorAligned,
    insideAligned,
    targetHover,
    target,
    postDoorLifted,
    entry: [staging, doorApproach, doorInside, postDoorAligned, postDoorLifted, insideAligned, targetHover, target],
    exit: [targetHover, insideAligned, postDoorLifted, postDoorAligned, doorInside, doorApproach, staging],
    travelY,
    liftOffset,
    doorZ
  };
}

function canonicalLoadingSequence(placements, containerInput = {}) {
  const container = normalizeContainer(containerInput);
  const wallDistance = (item) => Math.min(finite(item.z), Math.max(0, container.innerWidth - (finite(item.z) + positive(item.w ?? item.width))));
  return placements.map((item, sourceIndex) => ({ ...item, sourceIndex }))
    .sort((left, right) => finite(left.x) - finite(right.x)
      || finite(left.y) - finite(right.y)
      // At one depth/layer, load wall-adjacent cargo before the centre cargo.
      // This leaves the middle lane open while an outer item performs the
      // small post-door lateral alignment required by the door-frame policy.
      || wallDistance(left) - wallDistance(right)
      || finite(left.z) - finite(right.z)
      || finite(left.loadingIndex ?? left.sourceIndex) - finite(right.loadingIndex ?? right.sourceIndex));
}

function samplePolyline(points, step) {
  const samples = [];
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]; const end = points[index + 1];
    const distance = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
    const count = Math.max(1, Math.ceil(distance / Math.max(1, step)));
    for (let sample = 0; sample <= count; sample++) {
      if (index > 0 && sample === 0) continue;
      const t = sample / count;
      samples.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, z: start.z + (end.z - start.z) * t });
    }
  }
  return samples;
}

function normalizeContainer(container = {}) {
  return { innerLength: positive(container.innerLength ?? container.length), innerWidth: positive(container.innerWidth ?? container.width), innerHeight: positive(container.innerHeight ?? container.height) };
}

function cargoAabb(cargo, position = cargo) {
  return { minX: finite(position.x), maxX: finite(position.x) + positive(cargo.l ?? cargo.length), minY: finite(position.y), maxY: finite(position.y) + positive(cargo.h ?? cargo.height), minZ: finite(position.z), maxZ: finite(position.z) + positive(cargo.w ?? cargo.width) };
}

function inside(box, container, tolerance = 1) {
  return box.minX >= -tolerance && box.maxX <= container.innerLength + tolerance && box.minY >= -tolerance && box.maxY <= container.innerHeight + tolerance && box.minZ >= -tolerance && box.maxZ <= container.innerWidth + tolerance;
}

function intersects(a, b, tolerance) {
  return a.minX < b.maxX - tolerance && a.maxX > b.minX + tolerance && a.minY < b.maxY - tolerance && a.maxY > b.minY + tolerance && a.minZ < b.maxZ - tolerance && a.maxZ > b.minZ + tolerance;
}

function reason(code, message, cargoId) {
  return { code, message, ...(cargoId ? { cargoId } : {}) };
}

function positive(value) { return Math.max(0, finite(value)); }
function finite(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }

module.exports = {
  DEFAULT_CLEARANCE,
  analyzeOperationFeasibility,
  validateCargoOperation,
  buildCanonicalCargoPath,
  canonicalLoadingSequence,
  validateActorCargo
};
