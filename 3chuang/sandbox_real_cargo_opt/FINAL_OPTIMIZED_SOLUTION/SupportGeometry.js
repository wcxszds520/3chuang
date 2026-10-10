'use strict';

function calculateSupport(candidate, placedCargo = [], toleranceMm = 2) {
  if (Number(candidate.y || 0) <= toleranceMm) return { ratio: 1, supportedArea: Number(candidate.l) * Number(candidate.w), supports: [] };
  const bottomArea = Number(candidate.l || 0) * Number(candidate.w || 0);
  const supports = placedCargo.flatMap((lower) => {
    const top = Number(lower.y || 0) + Number(lower.h || 0);
    if (Math.abs(Number(candidate.y || 0) - top) > toleranceMm) return [];
    const overlapX = overlap(Number(candidate.x), Number(candidate.l), Number(lower.x), Number(lower.l));
    const overlapZ = overlap(Number(candidate.z), Number(candidate.w), Number(lower.z), Number(lower.w));
    const area = overlapX * overlapZ;
    return area > 0 ? [{ cargo: lower, area }] : [];
  });
  const supportedArea = Math.min(bottomArea, supports.reduce((sum, support) => sum + support.area, 0));
  return { ratio: bottomArea > 0 ? supportedArea / bottomArea : 0, supportedArea, supports };
}

function overlap(startA, sizeA, startB, sizeB) {
  return Math.max(0, Math.min(startA + sizeA, startB + sizeB) - Math.max(startA, startB));
}

module.exports = { calculateSupport, overlap };
