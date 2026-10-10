'use strict';

const packingPolicy = require('../../config/packingPolicy');
const { evaluateInsertionPath } = require('./InsertionPathFeasibility');
const { calculateCoG, normalizeContainer, volume } = require('./PlanMetrics');
const { analyzeStability } = require('./StabilityAnalyzer');
const { buildSourceIndex, bindSource, validateSourceAccounting } = require('./CargoSourceIdentity');
const { resolveAllowedOrientations, resolveOrientationRules } = require('./OrientationConstraint');

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

  validate({ placements = [], cargoList = [], unloadedCargo, requireOrientationMetadata = false, container: containerInput = {} } = {}) {
    const container = { ...containerInput, ...normalizeContainer(containerInput) };
    const violations = [];
    const warnings = [];
    const sourceIndex = buildSourceIndex(cargoList);
    // Geometry is the candidate's claim; declared handling/stacking limits are
    // input facts. A placement cannot make a no-stack package stackable or
    // increase its bearing limit by echoing different metadata.
    placements = placements.map(item => {
      const source = findSource(item, sourceIndex);
      if (!source) return item;
      const fields = ['stackable','fragile','maxStackLayers','maxStack','maximumSupportedWeightKg','maxSupportedWeight','wooden','packagingType','portSequence'];
      return {...item,...Object.fromEntries(fields.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]))};
    });
    violations.push(...validateSourceAccounting(placements, unloadedCargo, sourceIndex));
    const ids = new Set();
    for (const item of placements) {
      if (ids.has(String(item.cargoId))) violations.push(issue('DUPLICATE_CARGO_ID', [item.cargoId], '同一实物重复装入'));
      ids.add(String(item.cargoId));
    }
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
      if (source && Math.abs(number(item.weight)-number(source.weight)) > 0.001) {
        violations.push(issue('INPUT_WEIGHT', [item.cargoId], '货物质量与输入不一致'));
      }
      const orientationCheck = source ? validateOrientationConstraints(item, source) : null;
      if (source && (!orientationCheck.valid || (requireOrientationMetadata && !orientationCheck.verified))) {
        violations.push(issue('ORIENTATION', [item.cargoId], 'placement 朝向不符合来源完整方向约束或既有方向策略', {
          ...orientationCheck,
          placementOrientation: item.orientationId || item.orientation || null,
          placementAxisMap: item.axisMap || null,
          allowedOrientationIds: resolveAllowedOrientations(source).flatMap((entry) => entry.equivalentIds || [entry.id])
        }));
      }
    }

    for (let left = 0; left < placements.length; left++) {
      for (let right = left + 1; right < placements.length; right++) {
        const a=placements[left], b=placements[right];
        const sourceA=findSource(a,sourceIndex)||a,sourceB=findSource(b,sourceIndex)||b;
        const declares=(source,other)=>Array.isArray(source.incompatibleWith)
          && source.incompatibleWith.some(id=>[other.cargoId,other.sourceCargoId,other.sku].includes(id));
        if(declares(sourceA,b)||declares(sourceB,a)) violations.push(issue('INCOMPATIBLE_CARGO',[a.cargoId,b.cargoId],'显式不相容货物不能同柜'));
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
      supportLinks.set(item.cargoId, rectangles.map(r => ({ lower: r.lower,
        fraction: supportedArea > 0 ? (r.x1-r.x0)*(r.z1-r.z0)/supportedArea : 0 })));
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
        const lowerLevel = number(calculatedStackLevels.get(lower.cargoId) || lower.stackLevel || 1);
        const maxLayers = Math.max(1, number(lower.maxStackLayers || lower.maxStack || 1));
        if (lowerLevel >= maxLayers) violations.push(issue('MAX_STACK', [lower.cargoId, item.cargoId], '超过 maxStackLayers'));
        const lowerWeight = number(lower.weight);
        const upperWeight = number(item.weight);
        const reinforced = lower.wooden === true || /wood|pallet|reinforced|木/i.test(String(lower.packagingType || ''));
        if (!reinforced && lowerWeight > 0 && upperWeight > lowerWeight * this.config.heavyOnLightRatio) {
          violations.push(issue('CARRYING', [lower.cargoId, item.cargoId], '明显重货压轻货'));
        }
      }
      calculatedStackLevels.set(item.cargoId, stackLevel);
    }

    // Top-down load propagation includes the load already resting on each box.
    // Contact area is the rectangle union; holes are never counted as support.
    const supportedLayers = new Map();
    for (const item of [...orderedByHeight].reverse()) {
      const layers = supportedLayers.get(item.cargoId) || 1;
      const maxLayers = Math.max(1, number(item.maxStackLayers || item.maxStack || 1));
      if (layers > maxLayers) violations.push(issue('MAX_STACK', [item.cargoId], '连续承托层数超过 maxStackLayers', { layers, maxLayers }));
      const carried = number(supportLoads.get(item.cargoId));
      const explicit = item.maximumSupportedWeightKg ?? item.maxSupportedWeight;
      const capacity = explicit !== null && explicit !== undefined && Number.isFinite(Number(explicit))
        ? Number(explicit) : Math.max(number(item.weight), 1) * this.config.supportLoadMultiplier;
      if (carried > capacity + 0.001) violations.push(issue('CARRYING', [item.cargoId], '整垛传递载荷超过承重限值', { load: carried, capacity, model: 'TRANSITIVE_CONTACT_AREA_LOAD' }));
      for (const {lower, fraction} of supportLinks.get(item.cargoId) || []) {
        supportLoads.set(lower.cargoId, number(supportLoads.get(lower.cargoId)) + (number(item.weight)+carried)*fraction);
        supportedLayers.set(lower.cargoId, Math.max(supportedLayers.get(lower.cargoId)||1, layers+1));
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
    if (cog.lateral > this.config.lateralLimitPercent + packingPolicy.cog.comparisonTolerancePercent || cog.longitudinal > this.config.longitudinalLimitPercent + packingPolicy.cog.comparisonTolerancePercent) {
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
        identity: !deduplicated.some((entry) => ['DUPLICATE_CARGO_ID','INPUT_WEIGHT','UNKNOWN_SOURCE_CARGO','AMBIGUOUS_SOURCE_CARGO','SOURCE_IDENTITY_CONFLICT','UNKNOWN_PHYSICAL_CARGO_ID','SOURCE_QUANTITY_EXCEEDED','QUANTITY_CONSERVATION','LOADED_UNLOADED_ID_CONFLICT','INVALID_UNLOADED_QUANTITY'].includes(entry.code)),
        incompatibleCargo: !deduplicated.some((entry) => entry.code === 'INCOMPATIBLE_CARGO'),
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


function findSource(item, index) { return bindSource(item, index).source; }
function legalOrientations(cargo) { return resolveAllowedOrientations(cargo); }

function validateOrientationConstraints(item, cargo) {
  const resolution = resolveOrientationRules(cargo);
  const allowed = resolution.orientations;
  const fail = reason => ({ valid: false, verified: false, reason, ruleStatus: resolution.status, errors: resolution.errors, allowed });
  if (!['ABSENT','VALID'].includes(resolution.status)) return fail('SOURCE_ORIENTATION_' + resolution.status);
  if (![item.l,item.w,item.h].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)) return fail('INVALID_DIMENSIONS');
  const geometryMatches = allowed.flatMap(o => o.semanticVariants).filter(o => approximately(item.l,o.l) && approximately(item.w,o.w) && approximately(item.h,o.h));
  if (!geometryMatches.length) return fail('DIMENSION_PERMUTATION_NOT_ALLOWED');
  const maps = ['axisMap','orientationAxisMap'].filter(key => Object.hasOwn(item,key) && item[key] !== undefined).map(key => item[key]);
  for (const map of maps) {
    if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length !== 3
      || ['containerX','containerY','containerZ'].map(key=>map[key]).sort().join('') !== 'HLW') return fail('INVALID_AXIS_MAP');
  }
  if (maps.some(map => !sameAxisMap(map,maps[0]))) return fail('AXIS_MAP_ALIAS_CONFLICT');
  const ids = ['orientationId','canonicalOrientation'].filter(key => Object.hasOwn(item,key) && item[key] !== undefined).map(key => item[key]);
  const legacyIds = { XYZ:'LWH', YXZ:'WLH', XZY:'LHW', YZX:'WHL', ZXY:'HLW', ZYX:'HWL' };
  if (typeof item.orientation === 'string') {
    if (legacyIds[item.orientation]) ids.push(legacyIds[item.orientation]);
    else if (/^(LWH|WLH|LHW|WHL|HLW|HWL)$/.test(item.orientation)) ids.push(item.orientation);
  }
  if (ids.some(id => typeof id !== 'string' || !/^(LWH|WLH|LHW|WHL|HLW|HWL)$/.test(id))) return fail('INVALID_ORIENTATION_ID');
  if (ids.some(id => id !== ids[0])) return fail('ORIENTATION_ID_ALIAS_CONFLICT');
  const uprightPresent = item.uprightOriginalAxis !== undefined;
  if (uprightPresent && !['L','W','H'].includes(item.uprightOriginalAxis)) return fail('INVALID_UPRIGHT_AXIS');
  if (maps.length && uprightPresent && item.uprightOriginalAxis !== maps[0].containerY) return fail('UPRIGHT_AXIS_MISMATCH');
  // All declarations must select ONE semantic variant; no cross-product of aliases.
  const matches = geometryMatches.filter(o => (!maps.length || sameAxisMap(o.axisMap,maps[0]))
    && (!ids.length || o.id === ids[0]) && (!uprightPresent || o.uprightOriginalAxis === item.uprightOriginalAxis));
  if (!matches.length) return fail(maps.length ? 'ORIGINAL_AXIS_MAPPING_NOT_ALLOWED' : 'ORIENTATION_TUPLE_MISMATCH');
  if (matches.length > 1) return {valid:true,verified:false,reason:'GEOMETRY_ONLY_UNVERIFIED',allowed};
  return {valid:true,verified:true,reason:'ALLOWED_ORIENTATION_RECONSTRUCTED_FROM_SOURCE',reconstructed:matches[0],allowed};
}

function sameAxisMap(left, right) {
  return left?.containerX === right?.containerX && left?.containerY === right?.containerY && left?.containerZ === right?.containerZ;
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
  return [item.l,item.w,item.h].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)
    && [item.x,item.y,item.z].every(value => typeof value === 'number' && Number.isFinite(value));
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
module.exports.validateOrientationConstraints = validateOrientationConstraints;
module.exports.unionArea = unionArea;
