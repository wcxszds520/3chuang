import { cargoTotals } from '../cargo/cargo.js';
import { getPlanSourceLabel, normalizePlanSource, PLAN_SOURCE_CODES } from '../provenance/planSource.js';

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstFinite(...values) {
  for (const value of values) {
    const number = finiteOrNull(value);
    if (number !== null) return number;
  }
  return null;
}

function stabilityStatus(plan) {
  const explicit = plan?.stability?.status
    || plan?.validator?.stability?.status
    || plan?.ext_stability?.status;
  if (explicit) return String(explicit).toUpperCase();
  if (plan?.validator?.checks?.stability === false) return 'FAIL';
  if (normalizePlanSource(plan) === PLAN_SOURCE_CODES.LOCAL_PREVIEW) return 'PREVIEW';
  return null;
}

export function buildActivePlanViewModel({ session, plan, container }) {
  const source = normalizePlanSource(plan);
  const isLoading = session?.planStatus === 'loading';
  const hasPlan = Boolean(plan && plan.containerInfo && Array.isArray(plan.loadedCargo));
  const isReady = hasPlan && !isLoading;
  const cargoSummary = cargoTotals(session?.cargo || []);
  const loadedCount = isReady
    ? firstFinite(plan.totalCargoCount, plan.loadedCargo.length)
    : null;
  const inputCount = isReady
    ? firstFinite(plan.totalCargoInput, cargoSummary.pieces)
    : null;
  const explicitUnloaded = isReady && Array.isArray(plan.unloadedCargo)
    ? plan.unloadedCargo.length
    : null;
  const inferredUnloaded = loadedCount !== null && inputCount !== null
    ? Math.max(0, inputCount - loadedCount)
    : null;
  const unloadedCount = explicitUnloaded === null
    ? inferredUnloaded
    : Math.max(explicitUnloaded, inferredUnloaded ?? 0);
  const lateralCog = isReady ? finiteOrNull(plan.cogOffset?.lateral) : null;
  const longitudinalCog = isReady ? finiteOrNull(plan.cogOffset?.longitudinal) : null;
  const totalWeight = isReady
    ? firstFinite(plan.totalWeight, plan.loadedCargo.reduce((sum, item) => sum + Number(item.weight || 0), 0))
    : null;
  const maxWeight = finiteOrNull(container?.maxWeight ?? plan?.containerInfo?.maxWeight);
  const layoutQuality = plan?.layoutQuality || plan?.ext_layoutQuality || plan?.metrics?.layoutQuality || null;
  const securing = plan?.securing || plan?.ext_securing || plan?.metrics?.securing || null;
  const operationFeasibility = plan?.operationFeasibility || plan?.ext_operationFeasibility || plan?.metrics?.operationFeasibility || null;
  const voidJustification = plan?.voidJustification || plan?.ext_voidJustification || plan?.metrics?.voidJustification || null;
  const shipmentReadiness = plan?.shipmentReadiness || plan?.ext_shipmentReadiness || null;

  return Object.freeze({
    plan,
    planId: plan?.planId || null,
    isReady,
    isLoading,
    error: session?.planStatus === 'error' ? session.planError || '方案数据不可用' : null,
    status: isLoading ? 'LOADING' : session?.planStatus === 'error' ? 'ERROR' : source,
    source,
    sourceLabel: getPlanSourceLabel(source),
    containerType: plan?.containerInfo?.typeId || container?.typeId || session?.selectedContainerType || null,
    loadedCount,
    inputCount,
    unloadedCount,
    utilization: isReady ? finiteOrNull(plan.spaceUtilization) : null,
    totalWeight,
    maxWeight,
    weightRate: totalWeight !== null && maxWeight !== null && maxWeight > 0
      ? (totalWeight / maxWeight) * 100
      : null,
    cog: isReady ? plan.cog || null : null,
    lateralCog,
    longitudinalCog,
    stability: isReady ? stabilityStatus(plan) : null,
    geometricStability: isReady ? stabilityStatus(plan) : null,
    securingStatus: isReady ? securing?.status || null : null,
    securingRequiredCount: isReady ? finiteOrNull(securing?.securingRequiredCount) : null,
    securingPlaneCount: isReady ? finiteOrNull(securing?.securingPlaneCount) : null,
    operationFeasible: isReady && operationFeasibility
      ? Number(operationFeasibility.blockedCount || 0) === 0 && operationFeasibility.operationPathPass !== false
      : null,
    operationBlockedCount: isReady ? finiteOrNull(operationFeasibility?.blockedCount) : null,
    internalVoidVolume: isReady ? finiteOrNull(layoutQuality?.internalVoidVolume) : null,
    unexplainedVoidVolume: isReady ? finiteOrNull(voidJustification?.unexplainedVoidVolume) : null,
    maxUnexplainedGapMm: isReady ? finiteOrNull(voidJustification?.maxUnexplainedGapMm) : null,
    lowFillInteriorSliceCount: isReady ? finiteOrNull(layoutQuality?.lowFillInteriorSliceCount) : null,
    largestContiguousReserve: isReady ? finiteOrNull(layoutQuality?.largestContiguousReserve) : null,
    layoutQuality,
    securing,
    operationFeasibility,
    voidJustification,
    shipmentReadiness,
    lifoCompliant: isReady && typeof plan.constraintMeta?.lifoCompliant === 'boolean'
      ? plan.constraintMeta.lifoCompliant
      : null,
    algorithm: isReady
      ? plan.ext_algorithmId || plan.metrics?.algorithm_id || plan.algorithmMeta?.algorithmId || null
      : null,
    strategy: isReady
      ? String(plan.ext_strategyUsed || plan.metrics?.strategy_used || session?.selectedStrategy || '').toUpperCase() || null
      : null
  });
}

export function formatPlanMetric(value, { decimals = 0, suffix = '', locale = 'zh-CN' } = {}) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}${suffix}`;
}
