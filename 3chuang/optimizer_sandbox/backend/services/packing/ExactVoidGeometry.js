'use strict';

// Integrate actual placement faces. No voxel alignment and no connected
// component bounding box is used as evidence of empty space.
function analyzeExactVoidGeometry(placements = []) {
  const xs = [...new Set(placements.flatMap(item => [item.x, item.x + item.l]))].sort((a, b) => a - b);
  let internalVoidVolume = 0; let nonStackableHeadspaceVolume = 0;
  const headspaceByCargo = {};
  for (let xi = 0; xi < xs.length - 1; xi++) {
    const minX = xs[xi]; const maxX = xs[xi + 1];
    if (maxX - minX < 0.001) continue;
    const active = placements.filter(item => item.x < maxX - 0.001 && item.x + item.l > minX + 0.001);
    if (!active.length) {
      const left = placements.filter(item => Math.abs(item.x + item.l - minX) < 0.001);
      const right = placements.filter(item => Math.abs(item.x - maxX) < 0.001);
      if (left.length && right.length) {
        const width = Math.max(0, Math.min(Math.max(...left.map(item => item.z + item.w)), Math.max(...right.map(item => item.z + item.w)))
          - Math.max(Math.min(...left.map(item => item.z)), Math.min(...right.map(item => item.z))));
        const height = Math.min(Math.max(...left.map(item => item.y + item.h)), Math.max(...right.map(item => item.y + item.h)));
        internalVoidVolume += (maxX - minX) * width * height;
      }
      continue;
    }
    const top = Math.max(...active.map(item => item.y + item.h));
    const zs = [...new Set(active.flatMap(item => [item.z, item.z + item.w]))].sort((a, b) => a - b);
    for (let zi = 0; zi < zs.length - 1; zi++) {
      const minZ = zs[zi]; const maxZ = zs[zi + 1];
      const column = active.filter(item => item.z < maxZ - 0.001 && item.z + item.w > minZ + 0.001);
      const occupied = column.map(item => [item.y, item.y + item.h]);
      const occupiedHeight = unionLength(occupied);
      const area = (maxX - minX) * (maxZ - minZ);
      internalVoidVolume += Math.max(0, top - occupiedHeight) * area;
      const forbidden = column.filter(item => item.stackable === false || item.fragile === true)
        .sort((a, b) => a.y + a.h - b.y - b.h);
      let coveredHeight = occupiedHeight;
      const covered = [...occupied];
      for (const item of forbidden) {
        covered.push([Math.min(top, item.y + item.h), top]);
        const height = unionLength(covered);
        const addedVolume = Math.max(0, height - coveredHeight) * area;
        headspaceByCargo[item.cargoId] = (headspaceByCargo[item.cargoId] || 0) + addedVolume;
        nonStackableHeadspaceVolume += addedVolume;
        coveredHeight = height;
      }
    }
  }
  return { model: 'EXACT_FACE_SLAB_VOID_V1', internalVoidVolume, nonStackableHeadspaceVolume,
    unexplainedVoidVolume: Math.max(0, internalVoidVolume - nonStackableHeadspaceVolume), headspaceByCargo,
    definition: 'Exact empty volume below each occupied depth slab maximum cargo height and between its actual lateral bounds; proven no-stack headspace is separately integrated.' };
}
function unionLength(intervals) {
  const sorted = intervals.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let end = -Infinity; let length = 0;
  for (const [a, b] of sorted) { length += Math.max(0, b - Math.max(a, end)); end = Math.max(end, b); }
  return length;
}
module.exports = { analyzeExactVoidGeometry };
