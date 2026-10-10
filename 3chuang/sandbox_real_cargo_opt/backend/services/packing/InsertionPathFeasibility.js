'use strict';

function evaluateInsertionPath(candidate, placedCargo = [], container = {}, tolerance = 0.5) {
  const reasons = [];
  if (Number(candidate.w) > Number(container.innerWidth) || Number(candidate.h) > Number(container.innerHeight)) {
    reasons.push({ code: 'DOOR_OPENING_TOO_SMALL', message: '当前朝向无法通过高 X 门端门洞' });
  }
  const targetEndX = Number(candidate.x) + Number(candidate.l);
  for (const blocker of placedCargo) {
    const blockerStartsBeforeDoor = Number(blocker.x) < Number(container.innerLength) + tolerance;
    const blockerIsOnInsertionSegment = Number(blocker.x) + Number(blocker.l) > targetEndX + tolerance;
    if (!blockerStartsBeforeDoor || !blockerIsOnInsertionSegment) continue;
    if (overlap(candidate.y, candidate.h, blocker.y, blocker.h, tolerance)
      && overlap(candidate.z, candidate.w, blocker.z, blocker.w, tolerance)) {
      reasons.push({ code: 'INSERTION_PATH_COLLISION', cargoId: blocker.cargoId, message: `高 X 门端到目标位置的 AABB 插入路径被 ${blocker.cargoId || blocker.sku} 阻挡` });
      break;
    }
  }
  return { feasible: reasons.length === 0, reasons };
}

function overlap(startA, sizeA, startB, sizeB, tolerance) {
  return Number(startA) < Number(startB) + Number(sizeB) - tolerance
    && Number(startA) + Number(sizeA) > Number(startB) + tolerance;
}

module.exports = { evaluateInsertionPath };
