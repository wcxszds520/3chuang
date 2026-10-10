const STRATEGY_ORDER = Object.freeze(['SPACE', 'BALANCE', 'OPERATION']);

export function recommendStrategy(plans = {}) {
  const solved = STRATEGY_ORDER.flatMap((id) => plans[id] ? [{ id, plan: plans[id] }] : []);
  if (solved.length !== STRATEGY_ORDER.length) return null;
  return [...solved].sort((left, right) => compareTuple(planQualityTuple(left.plan), planQualityTuple(right.plan))
    || STRATEGY_ORDER.indexOf(left.id) - STRATEGY_ORDER.indexOf(right.id))[0].id;
}

export function planQualityTuple(plan = {}) {
  const input = number(plan.totalCargoInput);
  const loaded = number(plan.totalCargoCount || plan.loadedCargo?.length);
  const validator = plan.validator || {};
  const stability = plan.stability || validator.stability || plan.ext_stability || {};
  const layout = plan.layoutQuality || plan.ext_layoutQuality || plan.metrics?.layoutQuality || {};
  const securing = plan.securing || plan.ext_securing || plan.metrics?.securing || {};
  const operation = plan.operationFeasibility || plan.ext_operationFeasibility || plan.metrics?.operationFeasibility || {};
  const port = plan.portAccessibility || plan.ext_portAccessibility || plan.metrics?.portAccessibility || {};
  const distribution = plan.loadDistribution || plan.ext_loadDistribution || plan.metrics?.loadDistribution || {};
  const voids = plan.voidJustification || plan.ext_voidJustification || plan.metrics?.voidJustification || {};
  const postUnloadInvalid = (port.calls || []).reduce((sum, call) => sum + number(call.postUnloadStability?.invalidCount), 0);
  return [
    number(validator.hardViolationCount),
    number(operation.blockedCount),
    number(port.blockedCount),
    number(port.rehandleCount),
    postUnloadInvalid,
    number(stability.invalidCount),
    number(plan.constraintMeta?.mandatoryGateViolationCount),
    guidanceRank(distribution.centreOfGravity?.guidanceStatus || plan.metrics?.cog?.guidanceStatus, plan.metrics?.cog?.withinPolicy),
    Math.max(0, input - loaded),
    number(voids.unexplainedVoidVolume),
    number(voids.maxUnexplainedGapMm),
    number(layout.internalVoidVolume),
    -number(layout.crossSectionFillP10),
    number(layout.lowFillInteriorSliceCount),
    -number(layout.contactRatioMean),
    securing.status === 'SECURING_UNRESOLVED' ? 1 : 0,
    number(securing.fragmentedSecuringZones),
    number(securing.securingRequiredCount),
    number(plan.metrics?.operation?.totalCost),
    Math.max(number(distribution.centreOfGravity?.lateralOffsetPercent ?? plan.cogOffset?.lateral), number(distribution.centreOfGravity?.longitudinalOffsetPercent ?? plan.cogOffset?.longitudinal)),
    number(plan.metrics?.solveMs ?? plan.metrics?.elapsed_ms)
  ];
}

function guidanceRank(value, legacyWithinPolicy) {
  if (!value && typeof legacyWithinPolicy === 'boolean') return legacyWithinPolicy ? 0 : 2;
  return ({ WITHIN_GENERAL_GUIDANCE: 0, PARTICULAR_CIRCUMSTANCES_REVIEW: 1, OUTSIDE_GUIDANCE: 2 })[value] ?? 3;
}

function compareTuple(left, right) {
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return left[index] - right[index];
  return 0;
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
