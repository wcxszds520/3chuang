'use strict';

const packingPolicy = require('../../config/packingPolicy');
const { evaluateInsertionPath } = require('./InsertionPathFeasibility');
const { calculateCoG, normalizeContainer, volume } = require('./PlanMetrics');
const { analyzeStability } = require('./StabilityAnalyzer');

class PlanValidator {
  constructor(config = {}) {
    this.config = {
      supportRatioMin: packingPolicy.supportRatioMin,
      contactToleranceMm: packingPolicy.contactToleranceMm,
      collisionToleranceMm: packingPolicy.collisionToleranceMm,
      heavyOnLightRatio: packingPolicy.heavyOnLightRatio,
      supportLoadMultiplier: packingPolicy.supportLoadMultiplier,
      lateralLimitPercent: packingPolicy.cog.lateralLimitPercent,
      longitudinalLimitPercent: packingPolicy.cog.longitudinalLimitPercent,
      ...packingPolicy.stability,
      ...config
    };
  }

  validate({ placements = [], cargoList = [], container: containerInput = {} } = {}) {
    const container = normalizeContainer(containerInput);
    const violations = [];
    const warnings = [];
    const sourceIndex = buildSourceIndex(cargoList);
    const orderedByHeight = [...placements].sort((a, b) => number(a.y) - number(b.y) || number(a.x) - number(b.x));

    for (const item of placements) {
      if (!positiveGeometry(item)) {
        violations.push(issue('INVALID_GEOMETRY', [item.cargoId], 'placement 尺寸必须为正数'));
        continue;
      }
      if (number(item.x) < 0 || number(item.y) < 0 || number(item.z) < 0
        || number(item.x) + number(item.l) > container.innerLength + this.config.collisionToleranceMm
        || number(item.y) + number(item.h) > container.innerHeight + this.config.collisionToleranceMm
        || number(item.z) + number(item.w) > container.innerWidth + this.config.collisionToleranceMm) {
        violations.push(issue('OUT_OF_BOUNDS', [item.cargoId], 'placement 超出柜内边界'));
      }
      const source = findSource(item, sourceIndex);
      if (source && !isLegalOrientation(item, source)) {
        violations.push(issue('ORIENTATION', [item.cargoId], 'placement 朝向不符合 canRotate/canLayFlat 约束'));
      }
    }

    for (let left = 0; left < placements.length; left++) {
      for (let right = left + 1; right < placements.length; right++) {
        if (intersectsWithTolerance(placements[left], placements[right], this.config.collisionToleranceMm)) {
          violations.push(issue('COLLISION', [placements[left].cargoId, placements[right].cargoId], '两个 placement 的 AABB 相交'));
        }
      }
    }

    const totalWeight = placements.reduce((sum, item) => sum + number(item.weight), 0);
    if (container.maxWeight > 0 && totalWeight > container.maxWeight + 0.001) {
      violations.push(issue('PAYLOAD', placements.map((item) => item.cargoId), '累计货重超过柜型 max payload', { totalWeight, maxWeight: container.maxWeight }));
    }

    const supportLoads = new Map();
    const supportLinks = new Map();
    const calculatedStackLevels = new Map();
    for (const item of orderedByHeight) {
      if (number(item.y) <= this.config.contactToleranceMm) {
        calculatedStackLevels.set(item.cargoId, 1);
        continue;
      }
      const supports = orderedByHeight.filter((lower) => lower !== item
        && Math.abs(number(lower.y) + number(lower.h) - number(item.y)) <= this.config.contactToleranceMm
        && overlapLength(number(item.x), number(item.l), number(lower.x), number(lower.l)) > 0
        && overlapLength(number(item.z), number(item.w), number(lower.z), number(lower.w)) > 0);
      const rectangles = supports.map((lower) => ({
        x0: Math.max(number(item.x), number(lower.x)),
        x1: Math.min(number(item.x) + number(item.l), number(lower.x) + number(lower.l)),
        z0: Math.max(number(item.z), number(lower.z)),
        z1: Math.min(number(item.z) + number(item.w), number(lower.z) + number(lower.w)),
        lower
      }));
      const supportedArea = unionArea(rectangles);
      supportLinks.set(item.cargoId, rectangles.map(rectangle => ({
        lower: rectangle.lower,
        fraction: supportedArea > 0
          ? Math.max(0, rectangle.x1 - rectangle.x0) * Math.max(0, rectangle.z1 - rectangle.z0) / supportedArea : 0
      })));
      const bottomArea = number(item.l) * number(item.w);
      const supportRatio = bottomArea > 0 ? supportedArea / bottomArea : 0;
      if (supportRatio + 1e-9 < this.config.supportRatioMin) {
        violations.push(issue('SUPPORT', [item.cargoId], '底面积并集支撑率低于项目阈值', { supportRatio, required: this.config.supportRatioMin }));
      }
      let stackLevel = 1;
      for (const rectangle of rectangles) {
        const lower = rectangle.lower;
        stackLevel = Math.max(stackLevel, number(calculatedStackLevels.get(lower.cargoId) || lower.stackLevel || 1) + 1);
        if (lower.fragile === true) violations.push(issue('FRAGILE', [lower.cargoId, item.cargoId], '易碎货物上方禁止承重'));
        if (lower.stackable === false) violations.push(issue('STACK', [lower.cargoId, item.cargoId], '不可堆叠货物上方存在 placement'));
        const lowerWeight = number(lower.weight);
        const upperWeight = number(item.weight);
        const reinforced = lower.wooden === true || /wood|pallet|reinforced|木/i.test(String(lower.packagingType || ''));
        if (!reinforced && lowerWeight > 0 && upperWeight > lowerWeight * this.config.heavyOnLightRatio) {
          violations.push(issue('CARRYING', [lower.cargoId, item.cargoId], '明显重货压轻货'));
        }
      }
      calculatedStackLevels.set(item.cargoId, stackLevel);
    }

    // Transfer the entire supported load down the contact graph, top first.
    // Direct-neighbour mass alone misses loads transmitted through middle boxes.
    const supportedLayers = new Map();
    for (const item of [...orderedByHeight].reverse()) {
      const layers = supportedLayers.get(item.cargoId) || 1;
      const maxLayers = Math.max(1, number(item.maxStackLayers || item.maxStack || 1));
      if (layers > maxLayers) violations.push(issue('MAX_STACK', [item.cargoId], '该货物承托的连续货垛超过 maxStackLayers', { layers, maxLayers }));
      const carried = number(supportLoads.get(item.cargoId));
      const explicitCapacity = number(item.maximumSupportedWeightKg || item.maxSupportedWeight);
      const capacity = explicitCapacity > 0 ? explicitCapacity : Math.max(number(item.weight), 1) * this.config.supportLoadMultiplier;
      if (carried > capacity + 0.001) violations.push(issue('CARRYING', [item.cargoId], '整垛传递载荷超过基础承载规则上限', { load: carried, capacity, model: 'CONTACT_AREA_TRANSITIVE_LOAD_V1' }));
      for (const { lower, fraction } of supportLinks.get(item.cargoId) || []) {
        supportLoads.set(lower.cargoId, number(supportLoads.get(lower.cargoId)) + (number(item.weight) + carried) * fraction);
        supportedLayers.set(lower.cargoId, Math.max(supportedLayers.get(lower.cargoId) || 1, layers + 1));
      }
    }

    const stability = analyzeStability(placements, container, this.config);
    for (const entry of stability.violations) {
      const messages = {
        CARGO_COG_OUTSIDE_SUPPORT: '货物重心投影落在有效支撑多边形之外',
        STACK_COG_OUTSIDE_SUPPORT: '上层货垛组合重心投影落在当前支撑多边形之外',
        FREE_STANDING_TALL_STACK: '无足够双向约束的高细长货垛超过项目硬阈值'
      };
      violations.push(issue(entry.code, entry.cargoIds, messages[entry.code] || '运输稳定性检查失败', entry.evidence));
    }
    for (const entry of stability.warnings) {
      warnings.push(issue(entry.code, entry.cargoIds, '高细长货垛缺少足够双向侧向约束', entry.evidence));
    }

    const lifo = validateLifo(placements, stability.supportGraph.edges);
    violations.push(...lifo.violations);

    const insertionOrder = [...placements].sort((a, b) => number(a.x) - number(b.x) || number(a.y) - number(b.y) || number(a.z) - number(b.z));
    const inserted = [];
    for (const item of insertionOrder) {
      const result = evaluateInsertionPath(item, inserted, container);
      if (!result.feasible) violations.push(issue('INSERTION_PATH', [item.cargoId], '高 X 门端 AABB 插入路径不可行', { reasons: result.reasons }));
      inserted.push(item);
    }

    const cog = calculateCoG(placements, container, totalWeight);
    if (cog.lateral > this.config.lateralLimitPercent + 0.001 || cog.longitudinal > this.config.longitudinalLimitPercent + 0.001) {
      warnings.push(issue('COG_POLICY', [], '重心偏移超过项目策略阈值；CoG 是质量警告而非几何合法性豁免', {
        lateral: cog.lateral,
        longitudinal: cog.longitudinal,
        lateralLimit: this.config.lateralLimitPercent,
        longitudinalLimit: this.config.longitudinalLimitPercent
      }));
    }

    const deduplicated = deduplicateIssues(violations);
    return {
      status: deduplicated.length === 0 ? 'VALID' : 'INVALID',
      valid: deduplicated.length === 0,
      hardViolationCount: deduplicated.length,
      violations: deduplicated,
      warnings: deduplicateIssues(warnings),
      checks: {
        bounds: !deduplicated.some((entry) => entry.code === 'OUT_OF_BOUNDS' || entry.code === 'INVALID_GEOMETRY'),
        collision: !deduplicated.some((entry) => entry.code === 'COLLISION'),
        payload: !deduplicated.some((entry) => entry.code === 'PAYLOAD'),
        orientation: !deduplicated.some((entry) => entry.code === 'ORIENTATION'),
        support: !deduplicated.some((entry) => entry.code === 'SUPPORT'),
        carrying: !deduplicated.some((entry) => entry.code === 'CARRYING'),
        stack: !deduplicated.some((entry) => entry.code === 'STACK' || entry.code === 'MAX_STACK'),
        fragile: !deduplicated.some((entry) => entry.code === 'FRAGILE'),
        lifo: !deduplicated.some((entry) => entry.code === 'LIFO'),
        insertion: !deduplicated.some((entry) => entry.code === 'INSERTION_PATH'),
        stability: !deduplicated.some((entry) => entry.code === 'CARGO_COG_OUTSIDE_SUPPORT'
          || entry.code === 'STACK_COG_OUTSIDE_SUPPORT'
          || entry.code === 'FREE_STANDING_TALL_STACK'),
        cog: {
          lateral: cog.lateral,
          longitudinal: cog.longitudinal,
          withinPolicy: !warnings.some((entry) => entry.code === 'COG_POLICY'),
          dataClassification: 'PROJECT_POLICY'
        }
      },
      stability,
      supportLoads: Object.fromEntries(supportLoads),
      supportLoadModel: 'CONTACT_AREA_TRANSITIVE_LOAD_V1',
      totals: { placements: placements.length, loadedWeight: totalWeight, loadedVolume: placements.reduce((sum, item) => sum + volume(item), 0) }
    };
  }
}

function validateLifo(placements, supportEdges = []) {
  const violations = [];
  for (const target of placements) {
    for (const blocker of placements) {
      if (target === blocker || number(blocker.portSequence || 1) <= number(target.portSequence || 1)) continue;
      const blocksDoorCorridor = number(blocker.x) + 1 >= number(target.x) + number(target.l)
        && overlapLength(number(target.y), number(target.h), number(blocker.y), number(blocker.h)) > 0
        && overlapLength(number(target.z), number(target.w), number(blocker.z), number(blocker.w)) > 0;
      if (blocksDoorCorridor) {
        violations.push(issue('LIFO', [target.cargoId, blocker.cargoId], '早卸货物的高 X 门向提取通道被未来港货物阻挡', {
          relationship: 'DOOR_CORRIDOR_BLOCK',
          targetPortSequence: number(target.portSequence || 1),
          blockerPortSequence: number(blocker.portSequence || 1)
        }));
      }
    }
  }
  const byId = new Map(placements.map((item) => [String(item.cargoId), item]));
  for (const edge of supportEdges) {
    const supporter = byId.get(String(edge.supporterId));
    const supported = byId.get(String(edge.supportedId));
    if (supporter && supported && number(supported.portSequence || 1) > number(supporter.portSequence || 1)) {
      violations.push(issue('LIFO', [supporter.cargoId, supported.cargoId], '早卸货物承载未来港货物，无法在不移动未来港货物时提取', {
        relationship: 'SUPPORT_DEPENDENCY_BLOCK',
        supporterPortSequence: number(supporter.portSequence || 1),
        supportedPortSequence: number(supported.portSequence || 1)
      }));
    }
  }
  return { violations };
}

function buildSourceIndex(cargoList) {
  const bySku = new Map();
  const byId = new Map();
  for (const cargo of cargoList) {
    // A repeated SKU is not a unique source, especially across customers.
    if (cargo.sku) bySku.set(String(cargo.sku), bySku.has(String(cargo.sku)) ? null : cargo);
    for (const id of [cargo.cargoId, cargo.id]) if (id !== undefined && id !== null) byId.set(String(id), cargo);
  }
  return { bySku, byId };
}

function findSource(item, index) {
  for (const value of [item.unitId, item.sourceCargoId, item.cargoId]) if (value != null && index.byId.has(String(value))) return index.byId.get(String(value));
  const id = String(item.sourceCargoId || item.cargoId || '');
  // Legacy row expansion suffix only; longest prefix avoids A vs A_B ambiguity.
  for (const [sourceId, cargo] of [...index.byId.entries()].sort((a, b) => b[0].length - a[0].length)) if (id.startsWith(`${sourceId}_`) && /^\d+$/.test(id.slice(sourceId.length + 1))) return cargo;
  if (item.sku && index.bySku.get(String(item.sku))) return index.bySku.get(String(item.sku));
  return null;
}

function isLegalOrientation(item, cargo) {
  return legalOrientations(cargo).some((orientation) => approximately(number(item.l), orientation.l)
    && approximately(number(item.w), orientation.w)
    && approximately(number(item.h), orientation.h));
}

function legalOrientations(cargo) {
  const length = number(cargo.length);
  const width = number(cargo.width);
  const height = number(cargo.height);
  const orientationPolicy = String(cargo.orientationPolicy || cargo.cargoPhysicalProfile?.orientationPolicy || '').toUpperCase();
  const fixed = orientationPolicy === 'FIXED_ORIENTATION' || orientationPolicy === 'UPRIGHT_ONLY';
  const fullRotation = orientationPolicy === 'FULL_ROTATION_ALLOWED';
  const candidates = [{ l: length, w: width, h: height, label: 'XYZ' }];
  if (!fixed && cargo.canRotate !== false) candidates.push({ l: width, w: length, h: height, label: 'YXZ' });
  if (fullRotation || cargo.canLayFlat === true) {
    candidates.push({ l: length, w: height, h: width, label: 'XZY' });
    if (cargo.canRotate !== false) candidates.push(
      { l: width, w: height, h: length, label: 'YZX' },
      { l: height, w: length, h: width, label: 'ZXY' },
      { l: height, w: width, h: length, label: 'ZYX' }
    );
  }
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.l}:${candidate.w}:${candidate.h}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return candidate.l > 0 && candidate.w > 0 && candidate.h > 0;
  });
}

function unionArea(rectangles) {
  if (rectangles.length === 0) return 0;
  const xs = [...new Set(rectangles.flatMap((rect) => [rect.x0, rect.x1]))].sort((a, b) => a - b);
  let area = 0;
  for (let index = 0; index < xs.length - 1; index++) {
    const x0 = xs[index];
    const x1 = xs[index + 1];
    if (x1 <= x0) continue;
    const intervals = rectangles
      .filter((rect) => rect.x0 < x1 && rect.x1 > x0)
      .map((rect) => [rect.z0, rect.z1])
      .sort((left, right) => left[0] - right[0]);
    let covered = 0;
    let start = null;
    let end = null;
    for (const interval of intervals) {
      if (start === null) {
        [start, end] = interval;
      } else if (interval[0] <= end) {
        end = Math.max(end, interval[1]);
      } else {
        covered += end - start;
        [start, end] = interval;
      }
    }
    if (start !== null) covered += end - start;
    area += (x1 - x0) * covered;
  }
  return area;
}

function issue(code, cargoIds, message, evidence = {}) {
  return { code, cargoIds: cargoIds.filter(Boolean), message, evidence };
}

function deduplicateIssues(issues) {
  const unique = new Map();
  for (const entry of issues) {
    const key = `${entry.code}:${[...entry.cargoIds].sort().join(',')}:${entry.message}`;
    if (!unique.has(key)) unique.set(key, entry);
  }
  return [...unique.values()];
}

function positiveGeometry(item) {
  return number(item.l) > 0 && number(item.w) > 0 && number(item.h) > 0;
}

function intersectsWithTolerance(a, b, tolerance) {
  return number(a.x) < number(b.x) + number(b.l) - tolerance
    && number(a.x) + number(a.l) > number(b.x) + tolerance
    && number(a.y) < number(b.y) + number(b.h) - tolerance
    && number(a.y) + number(a.h) > number(b.y) + tolerance
    && number(a.z) < number(b.z) + number(b.w) - tolerance
    && number(a.z) + number(a.w) > number(b.z) + tolerance;
}

function overlapLength(startA, sizeA, startB, sizeB) {
  return Math.max(0, Math.min(startA + sizeA, startB + sizeB) - Math.max(startA, startB));
}

function approximately(left, right, tolerance = 0.001) {
  return Math.abs(left - right) <= tolerance;
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = PlanValidator;
module.exports.legalOrientations = legalOrientations;
module.exports.unionArea = unionArea;
