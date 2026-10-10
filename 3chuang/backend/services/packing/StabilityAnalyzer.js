'use strict';

const { normalizeContainer } = require('./PlanMetrics');

const EPSILON = 0.001;

function analyzeStability(placements = [], containerInput = {}, policyInput = {}) {
  const container = normalizeContainer(containerInput);
  const policy = normalizePolicy(policyInput);
  const support = analyzeSupportSystem(placements, container, policy);
  const restraints = analyzeRestraints(placements, container, policy);
  const stacks = analyzeStacks(placements, support, restraints, container, policy);
  const heightProfile = analyzeHeightProfile(placements, container, policy);
  const voidTopology = analyzeVoidTopology(placements, container, policy);

  const byCargoId = {};
  for (const entry of support.cargo) {
    byCargoId[entry.cargoId] = {
      supportRatio: entry.supportRatio,
      supportMargin: entry.supportMargin,
      supportStatus: entry.supportStatus,
      supportPolygon: entry.supportPolygon,
      supportCargoIds: entry.supportCargoIds,
      cargoCoG: entry.cargoCoG,
      stackStability: entry.stackStability,
      restraint: restraints.byCargoId[entry.cargoId] || null,
      slenderness: stacks.byRootCargoId[entry.cargoId]?.slenderness || null,
      riskStatus: riskStatus(entry, stacks.byRootCargoId[entry.cargoId], restraints.byCargoId[entry.cargoId])
    };
  }

  const supportViolations = support.violations;
  const stackViolations = support.stackViolations;
  const slendernessViolations = stacks.violations;
  const violations = [...supportViolations, ...stackViolations, ...slendernessViolations];
  const warnings = [...stacks.warnings];
  const nonGround = support.cargo.filter((entry) => !entry.floorSupported);
  const carrying = support.cargo.filter((entry) => entry.stackStability);
  const minSupportRatio = nonGround.length > 0 ? Math.min(...nonGround.map((entry) => entry.supportRatio)) : 1;
  const minSupportMargin = nonGround.length > 0 ? Math.min(...nonGround.map((entry) => entry.supportMargin)) : null;
  const minStackSupportMargin = carrying.length > 0 ? Math.min(...carrying.map((entry) => entry.stackStability.supportMargin)) : null;
  const contactQuality = calculateContactQuality(support.cargo, restraints.byCargoId, policy);

  return {
    model: 'PORTCUBE_UNSECURED_PACKING_V2_1',
    dataClassification: 'PROJECT_POLICY',
    policy,
    status: violations.length === 0 ? (warnings.length === 0 ? 'STABLE' : 'STABLE_WITH_WARNINGS') : 'INVALID',
    invalidCount: violations.length,
    warningCount: warnings.length,
    violations,
    warnings,
    summary: {
      minSupportRatio,
      minSupportMargin,
      minStackSupportMargin,
      unrestrainedTallStacks: stacks.entries.filter((entry) => entry.status !== 'STABLE').length,
      contactQuality,
      heightVariation: heightProfile.heightVariation,
      heightSmoothnessScore: heightProfile.heightSmoothnessScore,
      largestResidualVolume: voidTopology.largestResidualVolume,
      residualRegionCount: voidTopology.residualRegionCount,
      narrowVoidVolume: voidTopology.narrowVoidVolume,
      enclosedVoidVolume: voidTopology.enclosedVoidVolume
    },
    cargo: byCargoId,
    supportGraph: { edges: support.edges },
    stacks: stacks.entries,
    heightProfile,
    voidTopology
  };
}

function analyzeSupportSystem(placements = [], _containerInput = {}, policyInput = {}) {
  const policy = normalizePolicy(policyInput);
  const nodes = placements.map((item, index) => ({ item, key: placementKey(item, index) }));
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
  const directAbove = new Map(nodes.map((node) => [node.key, new Set()]));
  const supportByKey = new Map();
  const edges = [];

  for (const node of nodes) {
    const geometry = supportGeometry(node.item, nodes, policy);
    supportByKey.set(node.key, geometry);
    for (const patch of geometry.patches) {
      directAbove.get(patch.lowerKey)?.add(node.key);
      edges.push({
        supporterId: publicId(nodeByKey.get(patch.lowerKey)?.item, patch.lowerKey),
        supportedId: publicId(node.item, node.key),
        area: patchArea(patch)
      });
    }
  }

  const cargo = [];
  const violations = [];
  const stackViolations = [];
  for (const node of nodes) {
    const geometry = supportByKey.get(node.key);
    const cargoCoG = cargoCog(node.item);
    const supportMargin = signedDistanceToPolygon({ x: cargoCoG.x, z: cargoCoG.z }, geometry.polygon);
    const supportStatus = supportMargin >= -EPSILON && geometry.supportRatio + EPSILON >= policy.supportRatioMin ? 'PASS' : 'FAIL';
    if (!geometry.floorSupported && supportMargin < -EPSILON) {
      violations.push(problem('CARGO_COG_OUTSIDE_SUPPORT', [publicId(node.item, node.key)], {
        supportMargin,
        cargoCoG,
        supportPolygon: geometry.polygon
      }));
    }

    const descendants = collectDescendants(node.key, directAbove);
    let stackStability = null;
    if (descendants.size > 0) {
      const stackNodes = [node.key, ...descendants].map((key) => nodeByKey.get(key)).filter(Boolean);
      const totalMass = stackNodes.reduce((sum, entry) => sum + mass(entry.item), 0);
      const stackCoG = totalMass > 0
        ? stackNodes.reduce((acc, entry) => {
          const cog = cargoCog(entry.item);
          const itemMass = mass(entry.item);
          acc.x += cog.x * itemMass;
          acc.y += cog.y * itemMass;
          acc.z += cog.z * itemMass;
          return acc;
        }, { x: 0, y: 0, z: 0 })
        : { x: 0, y: 0, z: 0 };
      if (totalMass > 0) {
        stackCoG.x /= totalMass;
        stackCoG.y /= totalMass;
        stackCoG.z /= totalMass;
      }
      const stackMargin = signedDistanceToPolygon({ x: stackCoG.x, z: stackCoG.z }, geometry.polygon);
      stackStability = {
        totalMass,
        cogX: stackCoG.x,
        cogY: stackCoG.y,
        cogZ: stackCoG.z,
        supportMargin: stackMargin,
        status: stackMargin >= -EPSILON ? 'PASS' : 'FAIL',
        supportedCargoIds: [...descendants].map((key) => publicId(nodeByKey.get(key)?.item, key))
      };
      if (stackMargin < -EPSILON) {
        stackViolations.push(problem('STACK_COG_OUTSIDE_SUPPORT', [publicId(node.item, node.key)], {
          supportMargin: stackMargin,
          totalMass,
          stackCoG,
          supportPolygon: geometry.polygon,
          supportedCargoIds: stackStability.supportedCargoIds
        }));
      }
    }

    cargo.push({
      cargoId: publicId(node.item, node.key),
      floorSupported: geometry.floorSupported,
      supportRatio: geometry.supportRatio,
      supportedArea: geometry.supportedArea,
      supportMargin,
      supportStatus,
      supportPolygon: geometry.polygon,
      supportCargoIds: geometry.patches.map((patch) => publicId(nodeByKey.get(patch.lowerKey)?.item, patch.lowerKey)),
      cargoCoG,
      stackStability
    });
  }

  return { cargo, violations, stackViolations, edges, directAbove, supportByKey, nodeByKey };
}

function analyzeRestraints(placements = [], containerInput = {}, policyInput = {}) {
  const container = normalizeContainer(containerInput);
  const policy = normalizePolicy(policyInput);
  const byCargoId = {};
  placements.forEach((item, index) => {
    const id = publicId(item, placementKey(item, index));
    byCargoId[id] = {
      left: directionalRestraint(item, placements, container, policy, 'left'),
      right: directionalRestraint(item, placements, container, policy, 'right'),
      rear: directionalRestraint(item, placements, container, policy, 'rear'),
      front: directionalRestraint(item, placements, container, policy, 'front')
    };
  });
  return { byCargoId };
}

function analyzeStacks(placements, support, restraints, container, policy) {
  const entries = [];
  const byRootCargoId = {};
  const violations = [];
  const warnings = [];
  const supportedKeys = new Set(support.edges.map((edge) => edge.supportedId));
  const roots = [...support.nodeByKey.entries()].filter(([key, node]) => number(node.item.y) <= policy.verticalContactToleranceMm
    || !supportedKeys.has(publicId(node.item, key)));
  const rawStacks = roots.map(([rootKey, rootNode]) => {
    const descendants = collectDescendants(rootKey, support.directAbove);
    const stackKeys = new Set([rootKey, ...descendants]);
    const stackNodes = [...stackKeys].map((key) => support.nodeByKey.get(key)).filter(Boolean);
    return { rootKey, rootNode, stackKeys, stackNodes };
  });

  const parent = rawStacks.map((_, index) => index);
  const find = (index) => {
    let current = index;
    while (parent[current] !== current) current = parent[current];
    while (parent[index] !== index) {
      const next = parent[index];
      parent[index] = current;
      index = next;
    }
    return current;
  };
  const unite = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  for (let left = 0; left < rawStacks.length; left++) {
    for (let right = left + 1; right < rawStacks.length; right++) {
      if (stackGroupsTouch(rawStacks[left].stackNodes, rawStacks[right].stackNodes, policy)) unite(left, right);
    }
  }
  const clusters = new Map();
  rawStacks.forEach((stack, index) => {
    const root = find(index);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(stack);
  });

  for (const cluster of clusters.values()) {
    const stackNodes = [...new Map(cluster.flatMap((stack) => stack.stackNodes).map((node) => [node.key, node])).values()];
    const stackKeys = new Set(stackNodes.map((node) => node.key));
    const rootNodes = cluster.map((stack) => stack.rootNode);
    const minX = Math.min(...rootNodes.map((node) => number(node.item.x)));
    const maxX = Math.max(...rootNodes.map((node) => number(node.item.x) + number(node.item.l)));
    const minZ = Math.min(...rootNodes.map((node) => number(node.item.z)));
    const maxZ = Math.max(...rootNodes.map((node) => number(node.item.z) + number(node.item.w)));
    const minY = Math.min(...rootNodes.map((node) => number(node.item.y)));
    const maxTop = stackNodes.reduce((max, node) => Math.max(max, number(node.item.y) + number(node.item.h)), minY);
    const stackHeight = Math.max(0, maxTop - minY);
    const baseLength = Math.max(maxX - minX, EPSILON);
    const baseWidth = Math.max(maxZ - minZ, EPSILON);
    const slenderness = {
      length: stackHeight / baseLength,
      width: stackHeight / baseWidth,
      stackHeight,
      effectiveBaseLength: baseLength,
      effectiveBaseWidth: baseWidth
    };
    const aggregate = aggregateStackRestraint(stackNodes, stackKeys, placements, restraints, policy);
    const widthRisk = slenderness.width > policy.warningSlenderness && !aggregate.lateralBilateral;
    const lengthRisk = slenderness.length > policy.warningSlenderness && !aggregate.longitudinalBilateral;
    const hardWidth = slenderness.width > policy.hardUnrestrainedSlenderness && !aggregate.left && !aggregate.right;
    const hardLength = slenderness.length > policy.hardUnrestrainedSlenderness && !aggregate.rear && !aggregate.front;
    const status = hardWidth || hardLength ? 'INVALID' : (widthRisk || lengthRisk ? 'TALL_FREE_STACK' : 'STABLE');
    const rootCargoIds = cluster.map((stack) => publicId(stack.rootNode.item, stack.rootKey));
    const id = rootCargoIds[0];
    const entry = {
      rootCargoId: id,
      rootCargoIds,
      lateralContactClusterSize: cluster.length,
      cargoIds: stackNodes.map((node) => publicId(node.item, node.key)),
      slenderness,
      restraint: aggregate,
      status
    };
    entries.push(entry);
    for (const rootCargoId of rootCargoIds) byRootCargoId[rootCargoId] = entry;
    if (hardWidth || hardLength) {
      violations.push(problem('FREE_STANDING_TALL_STACK', entry.cargoIds, {
        slenderness,
        restraint: aggregate,
        hardUnrestrainedSlenderness: policy.hardUnrestrainedSlenderness
      }));
    } else if (widthRisk || lengthRisk) {
      warnings.push(problem('FREE_STANDING_TALL_STACK', entry.cargoIds, {
        slenderness,
        restraint: aggregate,
        warningSlenderness: policy.warningSlenderness
      }));
    }
  }
  return { entries, byRootCargoId, violations, warnings };
}

function stackGroupsTouch(leftNodes, rightNodes, policy) {
  for (const left of leftNodes) {
    for (const right of rightNodes) {
      const a = left.item;
      const b = right.item;
      const vertical = overlapLength(number(a.y), number(a.y) + number(a.h), number(b.y), number(b.y) + number(b.h));
      if (vertical <= EPSILON) continue;
      const xOverlap = overlapLength(number(a.x), number(a.x) + number(a.l), number(b.x), number(b.x) + number(b.l));
      const zOverlap = overlapLength(number(a.z), number(a.z) + number(a.w), number(b.z), number(b.z) + number(b.w));
      const xGap = Math.max(0, Math.max(number(a.x), number(b.x)) - Math.min(number(a.x) + number(a.l), number(b.x) + number(b.l)));
      const zGap = Math.max(0, Math.max(number(a.z), number(b.z)) - Math.min(number(a.z) + number(a.w), number(b.z) + number(b.w)));
      const xFaceRatio = zOverlap * vertical / Math.max(Math.min(number(a.w) * number(a.h), number(b.w) * number(b.h)), 1);
      const zFaceRatio = xOverlap * vertical / Math.max(Math.min(number(a.l) * number(a.h), number(b.l) * number(b.h)), 1);
      if (xGap <= policy.contactGapToleranceMm + EPSILON && zOverlap > EPSILON && xFaceRatio >= policy.meaningfulContactRatio) return true;
      if (zGap <= policy.contactGapToleranceMm + EPSILON && xOverlap > EPSILON && zFaceRatio >= policy.meaningfulContactRatio) return true;
    }
  }
  return false;
}

function analyzeHeightProfile(placements = [], containerInput = {}, policyInput = {}) {
  const container = normalizeContainer(containerInput);
  const policy = normalizePolicy(policyInput);
  const sliceWidth = policy.heightSliceMm;
  const count = Math.max(1, Math.ceil(container.innerLength / sliceWidth));
  const heights = Array.from({ length: count }, (_, index) => {
    const x0 = index * sliceWidth;
    const x1 = Math.min(container.innerLength, x0 + sliceWidth);
    return placements.reduce((height, item) => overlaps1d(x0, x1, number(item.x), number(item.x) + number(item.l))
      ? Math.max(height, number(item.y) + number(item.h)) : height, 0);
  });
  const occupied = heights.map((height, index) => ({ height, index })).filter((entry) => entry.height > EPSILON);
  const first = occupied[0]?.index ?? 0;
  const last = occupied[occupied.length - 1]?.index ?? -1;
  let heightVariation = 0;
  for (let index = first; index < last; index++) heightVariation += Math.abs(heights[index] - heights[index + 1]);
  const transitions = Math.max(0, last - first);
  const normalizedVariation = transitions > 0 && container.innerHeight > 0
    ? heightVariation / (transitions * container.innerHeight)
    : 0;
  return {
    sliceWidth,
    heights,
    heightVariation,
    heightSmoothnessScore: clamp(1 - normalizedVariation, 0, 1),
    occupiedSliceRange: last >= first ? [first, last] : null
  };
}

function analyzeVoidTopology(placements = [], containerInput = {}, policyInput = {}) {
  const container = normalizeContainer(containerInput);
  const policy = normalizePolicy(policyInput);
  if (!(container.innerLength > 0 && container.innerWidth > 0 && container.innerHeight > 0)) {
    return { method: 'deterministic-voxel-door-connectivity', voxelMm: policy.voidVoxelMm, largestResidualVolume: 0, residualRegionCount: 0, narrowVoidVolume: 0, enclosedVoidVolume: 0 };
  }
  const cell = policy.voidVoxelMm;
  const nx = Math.max(1, Math.ceil(container.innerLength / cell));
  const ny = Math.max(1, Math.ceil(container.innerHeight / cell));
  const nz = Math.max(1, Math.ceil(container.innerWidth / cell));
  const total = nx * ny * nz;
  const occupied = new Uint8Array(total);
  const indexOf = (x, y, z) => (x * ny + y) * nz + z;
  for (const item of placements) {
    const x0 = clamp(Math.floor(number(item.x) / cell), 0, nx - 1);
    const x1 = clamp(Math.ceil((number(item.x) + number(item.l)) / cell) - 1, 0, nx - 1);
    const y0 = clamp(Math.floor(number(item.y) / cell), 0, ny - 1);
    const y1 = clamp(Math.ceil((number(item.y) + number(item.h)) / cell) - 1, 0, ny - 1);
    const z0 = clamp(Math.floor(number(item.z) / cell), 0, nz - 1);
    const z1 = clamp(Math.ceil((number(item.z) + number(item.w)) / cell) - 1, 0, nz - 1);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) occupied[indexOf(x, y, z)] = 1;
  }

  const visited = new Uint8Array(total);
  const regions = [];
  const directions = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
    const startIndex = indexOf(x, y, z);
    if (occupied[startIndex] || visited[startIndex]) continue;
    const queue = [[x, y, z]];
    visited[startIndex] = 1;
    let cursor = 0;
    let volume = 0;
    let doorConnected = false;
    let narrowVolume = 0;
    while (cursor < queue.length) {
      const [cx, cy, cz] = queue[cursor++];
      volume += cellVolume(cx, cy, cz, cell, container);
      if (cx === nx - 1) doorConnected = true;
      if (isNarrowCell(cx, cy, cz, occupied, nx, ny, nz, indexOf, cell, policy.narrowVoidWidthMm)) {
        narrowVolume += cellVolume(cx, cy, cz, cell, container);
      }
      for (const [dx, dy, dz] of directions) {
        const tx = cx + dx;
        const ty = cy + dy;
        const tz = cz + dz;
        if (tx < 0 || tx >= nx || ty < 0 || ty >= ny || tz < 0 || tz >= nz) continue;
        const target = indexOf(tx, ty, tz);
        if (occupied[target] || visited[target]) continue;
        visited[target] = 1;
        queue.push([tx, ty, tz]);
      }
    }
    regions.push({ volume, doorConnected, narrowVolume });
  }
  const badRegions = regions.filter((region) => !region.doorConnected);
  return {
    method: 'deterministic-voxel-door-connectivity',
    voxelMm: cell,
    largestResidualVolume: regions.reduce((max, region) => Math.max(max, region.volume), 0),
    residualRegionCount: regions.length,
    narrowVoidVolume: badRegions.reduce((sum, region) => sum + region.narrowVolume, 0),
    enclosedVoidVolume: badRegions.reduce((sum, region) => sum + region.volume, 0),
    doorConnectedRegionCount: regions.filter((region) => region.doorConnected).length
  };
}

function supportGeometry(item, nodes, policy) {
  const floorSupported = number(item.y) <= policy.verticalContactToleranceMm;
  if (floorSupported) {
    const patch = rect(number(item.x), number(item.x) + number(item.l), number(item.z), number(item.z) + number(item.w), null);
    return { floorSupported: true, patches: [], supportedArea: patchArea(patch), supportRatio: 1, polygon: rectanglePolygon(patch) };
  }
  const patches = [];
  for (const lower of nodes) {
    if (lower.item === item) continue;
    if (Math.abs(number(lower.item.y) + number(lower.item.h) - number(item.y)) > policy.verticalContactToleranceMm) continue;
    const x0 = Math.max(number(item.x), number(lower.item.x));
    const x1 = Math.min(number(item.x) + number(item.l), number(lower.item.x) + number(lower.item.l));
    const z0 = Math.max(number(item.z), number(lower.item.z));
    const z1 = Math.min(number(item.z) + number(item.w), number(lower.item.z) + number(lower.item.w));
    if (x1 - x0 > EPSILON && z1 - z0 > EPSILON) patches.push(rect(x0, x1, z0, z1, lower.key));
  }
  const supportedArea = unionArea(patches);
  const bottomArea = Math.max(0, number(item.l) * number(item.w));
  const points = patches.flatMap((patch) => rectanglePolygon(patch));
  return {
    floorSupported: false,
    patches,
    supportedArea,
    supportRatio: bottomArea > 0 ? supportedArea / bottomArea : 0,
    polygon: convexHull(points)
  };
}

function directionalRestraint(item, placements, container, policy, direction) {
  const candidates = [];
  const x0 = number(item.x);
  const x1 = x0 + number(item.l);
  const y0 = number(item.y);
  const y1 = y0 + number(item.h);
  const z0 = number(item.z);
  const z1 = z0 + number(item.w);
  const isWidthDirection = direction === 'left' || direction === 'right';
  const cargoFaceArea = isWidthDirection ? number(item.l) * number(item.h) : number(item.w) * number(item.h);
  const wallGap = direction === 'left' ? z0
    : direction === 'right' ? container.innerWidth - z1
      : direction === 'rear' ? x0 : container.innerLength - x1;
  candidates.push({ source: 'WALL', sourceCargoId: null, gap: Math.max(0, wallGap), contactRatio: 1 });

  for (let index = 0; index < placements.length; index++) {
    const other = placements[index];
    if (other === item) continue;
    const ox0 = number(other.x);
    const ox1 = ox0 + number(other.l);
    const oy0 = number(other.y);
    const oy1 = oy0 + number(other.h);
    const oz0 = number(other.z);
    const oz1 = oz0 + number(other.w);
    let gap = null;
    let overlapArea = 0;
    if (direction === 'left' && oz1 <= z0 + EPSILON) {
      gap = z0 - oz1;
      overlapArea = overlapLength(x0, x1, ox0, ox1) * overlapLength(y0, y1, oy0, oy1);
    } else if (direction === 'right' && oz0 >= z1 - EPSILON) {
      gap = oz0 - z1;
      overlapArea = overlapLength(x0, x1, ox0, ox1) * overlapLength(y0, y1, oy0, oy1);
    } else if (direction === 'rear' && ox1 <= x0 + EPSILON) {
      gap = x0 - ox1;
      overlapArea = overlapLength(z0, z1, oz0, oz1) * overlapLength(y0, y1, oy0, oy1);
    } else if (direction === 'front' && ox0 >= x1 - EPSILON) {
      gap = ox0 - x1;
      overlapArea = overlapLength(z0, z1, oz0, oz1) * overlapLength(y0, y1, oy0, oy1);
    }
    if (gap === null || overlapArea <= EPSILON) continue;
    candidates.push({
      source: 'CARGO',
      sourceCargoId: publicId(other, placementKey(other, index)),
      gap: Math.max(0, gap),
      contactRatio: cargoFaceArea > 0 ? overlapArea / cargoFaceArea : 0
    });
  }
  candidates.sort((a, b) => a.gap - b.gap || b.contactRatio - a.contactRatio || String(a.sourceCargoId || '').localeCompare(String(b.sourceCargoId || '')));
  const nearest = candidates[0] || { source: 'NONE', sourceCargoId: null, gap: Infinity, contactRatio: 0 };
  const withinTolerance = nearest.gap <= policy.contactGapToleranceMm + EPSILON;
  let status = 'FREE';
  if (withinTolerance && nearest.source === 'WALL') status = 'WALL_RESTRAINED';
  else if (withinTolerance && nearest.contactRatio >= policy.meaningfulContactRatio) status = 'CARGO_RESTRAINED';
  else if (withinTolerance && nearest.contactRatio > EPSILON) status = 'PARTIAL_RESTRAINT';
  return {
    gap: nearest.gap,
    contactRatio: nearest.contactRatio,
    source: nearest.source,
    sourceCargoId: nearest.sourceCargoId,
    status,
    strength: withinTolerance && (status === 'WALL_RESTRAINED' || nearest.contactRatio >= policy.strongContactRatio) ? 'STRONG'
      : withinTolerance && nearest.contactRatio >= policy.meaningfulContactRatio ? 'MEANINGFUL'
        : status === 'PARTIAL_RESTRAINT' ? 'PARTIAL' : 'NONE'
  };
}

function aggregateStackRestraint(stackNodes, stackKeys, placements, restraints, policy) {
  const directions = ['left', 'right', 'rear', 'front'];
  const result = Object.fromEntries(directions.map((direction) => [direction, false]));
  for (const node of stackNodes) {
    const id = publicId(node.item, node.key);
    const cargoRestraint = restraints.byCargoId[id];
    if (!cargoRestraint) continue;
    for (const direction of directions) {
      const entry = cargoRestraint[direction];
      const external = !entry.sourceCargoId || !stackKeys.has(entry.sourceCargoId);
      if (external && isMeaningfulRestraint(entry, policy)) result[direction] = true;
    }
  }
  return {
    ...result,
    lateralBilateral: result.left && result.right,
    longitudinalBilateral: result.rear && result.front
  };
}

function isMeaningfulRestraint(entry, policy) {
  return entry && entry.gap <= policy.contactGapToleranceMm + EPSILON
    && (entry.status === 'WALL_RESTRAINED' || entry.contactRatio >= policy.meaningfulContactRatio);
}

function collectDescendants(rootKey, directAbove) {
  const result = new Set();
  const queue = [...(directAbove.get(rootKey) || [])];
  while (queue.length > 0) {
    const key = queue.shift();
    if (result.has(key)) continue;
    result.add(key);
    for (const child of directAbove.get(key) || []) queue.push(child);
  }
  return result;
}

function cargoCog(item) {
  const local = item.cogLocalMm || (item.centerOfGravity?.coordinateSpace === 'LOCAL' ? item.centerOfGravity : null);
  return {
    x: number(item.x) + (Number.isFinite(Number(local?.x)) ? Number(local.x) : number(item.l) / 2),
    y: number(item.y) + (Number.isFinite(Number(local?.y)) ? Number(local.y) : number(item.h) / 2),
    z: number(item.z) + (Number.isFinite(Number(local?.z)) ? Number(local.z) : number(item.w) / 2),
    source: local ? 'CARGO_METADATA' : 'UNIFORM_DENSITY_GEOMETRIC_CENTER'
  };
}

function calculateContactQuality(cargo, restraints, policy) {
  if (cargo.length === 0) return 1;
  return cargo.reduce((sum, entry) => {
    const restraint = restraints[entry.cargoId] || {};
    const meaningfulSides = ['left', 'right', 'rear', 'front'].filter((direction) => isMeaningfulRestraint(restraint[direction], policy)).length;
    const support = clamp(entry.supportRatio, 0, 1);
    return sum + clamp(support * 0.6 + meaningfulSides / 4 * 0.4, 0, 1);
  }, 0) / cargo.length;
}

function riskStatus(entry, stack, restraint) {
  if (entry.supportStatus === 'FAIL' || entry.stackStability?.status === 'FAIL' || stack?.status === 'INVALID') return 'INVALID';
  if (entry.stackStability && entry.stackStability.supportMargin < 20) return 'STACK_COG_WARNING';
  if (!entry.floorSupported && entry.supportMargin < 20) return 'LOW_SUPPORT_MARGIN';
  if (stack?.status === 'TALL_FREE_STACK') return 'TALL_FREE_STACK';
  const directions = restraint ? Object.values(restraint) : [];
  if (directions.length > 0 && directions.filter((direction) => direction.status !== 'FREE').length < 2) return 'LOW_RESTRAINT';
  return 'STABLE';
}

function isNarrowCell(x, y, z, occupied, nx, ny, nz, indexOf, cell, threshold) {
  let spanX = 1;
  for (let tx = x - 1; tx >= 0 && !occupied[indexOf(tx, y, z)]; tx--) spanX++;
  for (let tx = x + 1; tx < nx && !occupied[indexOf(tx, y, z)]; tx++) spanX++;
  let spanZ = 1;
  for (let tz = z - 1; tz >= 0 && !occupied[indexOf(x, y, tz)]; tz--) spanZ++;
  for (let tz = z + 1; tz < nz && !occupied[indexOf(x, y, tz)]; tz++) spanZ++;
  return Math.min(spanX * cell, spanZ * cell) <= threshold + EPSILON;
}

function cellVolume(x, y, z, cell, container) {
  const l = Math.min(cell, container.innerLength - x * cell);
  const h = Math.min(cell, container.innerHeight - y * cell);
  const w = Math.min(cell, container.innerWidth - z * cell);
  return Math.max(0, l * h * w);
}

function signedDistanceToPolygon(point, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return -Infinity;
  let minimum = Infinity;
  for (let index = 0; index < polygon.length; index++) {
    minimum = Math.min(minimum, pointSegmentDistance(point, polygon[index], polygon[(index + 1) % polygon.length]));
  }
  return pointInConvexPolygon(point, polygon) ? minimum : -minimum;
}

function pointInConvexPolygon(point, polygon) {
  let sign = 0;
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const cross = (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
    if (Math.abs(cross) <= EPSILON) continue;
    const current = Math.sign(cross);
    if (sign === 0) sign = current;
    else if (current !== sign) return false;
  }
  return true;
}

function pointSegmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= EPSILON) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz));
}

function convexHull(points) {
  const unique = [...new Map(points.map((point) => [`${round(point.x)}:${round(point.z)}`, { x: number(point.x), z: number(point.z) }])).values()]
    .sort((left, right) => left.x - right.x || left.z - right.z);
  if (unique.length <= 2) return unique;
  const cross = (origin, a, b) => (a.x - origin.x) * (b.z - origin.z) - (a.z - origin.z) * (b.x - origin.x);
  const lower = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= EPSILON) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = unique.length - 1; index >= 0; index--) {
    const point = unique[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= EPSILON) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function unionArea(rectangles) {
  if (rectangles.length === 0) return 0;
  const xs = [...new Set(rectangles.flatMap((entry) => [entry.x0, entry.x1]))].sort((a, b) => a - b);
  let area = 0;
  for (let index = 0; index < xs.length - 1; index++) {
    const x0 = xs[index];
    const x1 = xs[index + 1];
    const intervals = rectangles.filter((entry) => entry.x0 < x1 && entry.x1 > x0)
      .map((entry) => [entry.z0, entry.z1]).sort((a, b) => a[0] - b[0]);
    let start = null;
    let end = null;
    for (const interval of intervals) {
      if (start === null) [start, end] = interval;
      else if (interval[0] <= end + EPSILON) end = Math.max(end, interval[1]);
      else {
        area += (x1 - x0) * (end - start);
        [start, end] = interval;
      }
    }
    if (start !== null) area += (x1 - x0) * (end - start);
  }
  return area;
}

function rectanglePolygon(entry) {
  return [{ x: entry.x0, z: entry.z0 }, { x: entry.x1, z: entry.z0 }, { x: entry.x1, z: entry.z1 }, { x: entry.x0, z: entry.z1 }];
}

function rect(x0, x1, z0, z1, lowerKey) {
  return { x0, x1, z0, z1, lowerKey };
}

function patchArea(entry) {
  return Math.max(0, entry.x1 - entry.x0) * Math.max(0, entry.z1 - entry.z0);
}

function normalizePolicy(input = {}) {
  return {
    supportRatioMin: finite(input.supportRatioMin, 0.75),
    verticalContactToleranceMm: finite(input.verticalContactToleranceMm ?? input.contactToleranceMm, 2),
    contactGapToleranceMm: finite(input.contactGapToleranceMm, 30),
    meaningfulContactRatio: finite(input.meaningfulContactRatio, 0.35),
    strongContactRatio: finite(input.strongContactRatio, 0.60),
    warningSlenderness: finite(input.warningSlenderness, 2.5),
    hardUnrestrainedSlenderness: finite(input.hardUnrestrainedSlenderness, 3.5),
    heightSliceMm: finite(input.heightSliceMm, 200),
    voidVoxelMm: finite(input.voidVoxelMm, 250),
    narrowVoidWidthMm: finite(input.narrowVoidWidthMm, 300)
  };
}

function placementKey(item, index) {
  return String(item.cargoId || item.instanceId || `placement-${index}`);
}

function publicId(item, fallback) {
  return String(item?.cargoId || item?.instanceId || fallback);
}

function problem(code, cargoIds, evidence) {
  return { code, cargoIds: cargoIds.filter(Boolean), evidence };
}

function mass(item) {
  const value = number(item.weight);
  return value > 0 ? value : 1;
}

function overlapLength(a0, a1, b0, b1) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function overlaps1d(a0, a1, b0, b1) {
  return a0 < b1 - EPSILON && a1 > b0 + EPSILON;
}

function finite(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value) {
  return Math.round(number(value) * 1000) / 1000;
}

module.exports = {
  analyzeStability,
  analyzeSupportSystem,
  analyzeRestraints,
  analyzeHeightProfile,
  analyzeVoidTopology,
  signedDistanceToPolygon,
  convexHull,
  normalizePolicy
};
