import LZString from 'lz-string';
import { normalizeCargo, cargoFingerprint } from '../../domain/cargo/cargo.js';
import { createInitialSession, SESSION_SCHEMA_VERSION } from '../../domain/session/initialSession.js';

export const SESSION_STORAGE_KEY = 'portcube.web.session.v1';
const COMPRESSED_PREFIX = 'pc-lz16:';

export function loadSession(storage = globalThis.localStorage) {
  if (!storage) return createInitialSession();
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return createInitialSession();
    const json = raw.startsWith(COMPRESSED_PREFIX)
      ? LZString.decompressFromUTF16(raw.slice(COMPRESSED_PREFIX.length))
      : raw;
    const parsed = JSON.parse(json);
    if (parsed?.schemaVersion !== SESSION_SCHEMA_VERSION || !Array.isArray(parsed.cargo) || !parsed.order?.orderNo) {
      return recoveredSession('当前会话版本不兼容，已安全恢复初始订单。');
    }
    const strategyPlans = hydrateStrategyPlans(parsed);
    const backendPlan = parsed.backendPlan
      || strategyPlans?.[parsed.backendPlanStrategy]
      || strategyPlans?.[String(parsed.selectedStrategy || '').toUpperCase()]
      || Object.values(strategyPlans || {})[0]
      || null;
    const packingCase = hydratePackingCase(parsed.packingCase, strategyPlans);
    const cargo=parsed.cargo.map(normalizeCargo);
    // A nullable fork-axis schema addition is not a changed shipment. Rebind
    // only a previously current plan, and only if removing that new null field
    // exactly reproduces the old fingerprint. Real input edits remain stale.
    const legacyCargo=JSON.parse(JSON.stringify(cargo));
    for(const row of legacyCargo)for(const packaging of [row.packagingProfile,row.cargoPhysicalProfile?.packaging])if(packaging?.forkEntryAxis===null)delete packaging.forkEntryAxis;
    const migratedFingerprint=parsed.backendPlanFingerprint===cargoFingerprint(legacyCargo,parsed.selectedContainerType)
      ?cargoFingerprint(cargo,parsed.selectedContainerType):parsed.backendPlanFingerprint;
    return {
      ...createInitialSession(),
      ...parsed,
      strategyPlans,
      backendPlan,
      backendPlanFingerprint:migratedFingerprint,
      backendPlanStrategy: undefined,
      packingCase,
      strategyPlacementPool: undefined,
      strategySharedPlanFields: undefined,
      strategySharedPlanAliases: undefined,
      strategyPlanAliases: undefined,
      cargo,
      planStatus: backendPlan ? 'ready' : 'preview',
      planError: null,
      aiAuditStatus: parsed.aiAudit ? 'ready' : 'idle',
      aiAuditError: null
    };
  } catch (_error) {
    return recoveredSession('当前会话数据损坏，已安全恢复初始订单。');
  }
}

function recoveredSession(recoveryNotice) {
  return { ...createInitialSession(), recoveryNotice };
}

export function saveSession(session, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    const existing=storage.getItem(SESSION_STORAGE_KEY);
    if(existing)try{
      const saved=JSON.parse(existing.startsWith(COMPRESSED_PREFIX)?LZString.decompressFromUTF16(existing.slice(COMPRESSED_PREFIX.length)):existing);
      if(Date.parse(saved.lastSavedAt)>Date.parse(session.lastSavedAt))return false;
    }catch{/* A recovered session may replace an unreadable local record. */}
    const {
      strategyPlans,
      strategyPlacementPool,
      strategySharedPlanFields,
      strategySharedPlanAliases,
      strategyPlanAliases
    } = compactStrategyPlans(session.strategyPlans);
    const selectedPlanJson=JSON.stringify(session.backendPlan);
    const backendPlanStrategy=session.backendPlan ? Object.entries(session.strategyPlans || {}).find(([,plan])=>plan===session.backendPlan || JSON.stringify(plan)===selectedPlanJson)?.[0] : undefined;
    const packingCase = compactPackingCase(session.packingCase, session.strategyPlans);
    const persisted = {
      ...session,
      strategyPlans,
      strategyPlacementPool,
      strategySharedPlanFields,
      strategySharedPlanAliases,
      strategyPlanAliases,
      packingCase,
      // Omit only an identical plan and store its actual strategy key. An older
      // strategy portfolio must never replace a newly solved current plan.
      backendPlan: backendPlanStrategy ? undefined : session.backendPlan,
      backendPlanStrategy,
      planStatus: session.backendPlan ? 'ready' : 'preview',
      planError: null,
      aiAuditStatus: session.aiAudit ? 'ready' : 'idle',
      aiAuditError: null
    };
    const json = JSON.stringify(persisted);
    storage.setItem(SESSION_STORAGE_KEY, `${COMPRESSED_PREFIX}${LZString.compressToUTF16(json)}`);
    return true;
  } catch (_error) {
    return false;
  }
}

function compactStrategyPlans(input) {
  const entries = Object.entries(input || {}).filter(([, plan]) => plan && typeof plan === 'object');
  if (!entries.length) return { strategyPlans: {}, strategyPlacementPool: undefined };

  const plans = Object.fromEntries(entries.map(([strategy, plan]) => [strategy, { ...plan }]));
  const placementPool = compactPlacementPool(entries, plans);
  const shared = compactSharedPlanFields(plans);
  const strategyPlanAliases = {};
  for (const [strategy, plan] of Object.entries(plans)) {
    const compacted = compactAliases(plan);
    plans[strategy] = compacted.value;
    if (Object.keys(compacted.aliases).length) strategyPlanAliases[strategy] = compacted.aliases;
  }
  const sharedCompacted = compactAliases(shared);

  return {
    strategyPlans: plans,
    strategyPlacementPool: placementPool,
    strategySharedPlanFields: Object.keys(sharedCompacted.value).length ? sharedCompacted.value : undefined,
    strategySharedPlanAliases: Object.keys(sharedCompacted.aliases).length ? sharedCompacted.aliases : undefined,
    strategyPlanAliases: Object.keys(strategyPlanAliases).length ? strategyPlanAliases : undefined
  };
}

function hydrateStrategyPlans(parsed) {
  const shared = hydrateAliases(parsed.strategySharedPlanFields || {}, parsed.strategySharedPlanAliases);
  const plans = Object.fromEntries(Object.entries(parsed.strategyPlans || {}).map(([strategy, plan]) => [strategy, {
    ...shared,
    ...hydrateAliases(plan, parsed.strategyPlanAliases?.[strategy])
  }]));
  const pool = parsed.strategyPlacementPool;
  if (!pool?.placementHash || !Array.isArray(pool.loadedCargo)) return plans;
  return Object.fromEntries(Object.entries(plans).map(([strategy, plan]) => [strategy, (
    plan?.placementHash === pool.placementHash
      ? {
        ...plan,
        loadedCargo: hydrateLoadedCargo(pool.loadedCargo, pool.overrides?.[strategy]),
        unloadedCargo: plan.unloadedCargo || pool.unloadedCargo || []
      }
      : plan
  )]));
}

function compactPlacementPool(entries, plans) {
  const [baseStrategy, basePlan] = entries[0];
  const baseLoaded = basePlan.loadedCargo || [];
  const shareGeometry = entries.length > 1
    && basePlan.placementHash
    && entries.every(([, plan]) => (
      plan.placementHash === basePlan.placementHash
      && Array.isArray(plan.loadedCargo)
      && plan.loadedCargo.length === baseLoaded.length
      && plan.loadedCargo.every((cargo, index) => cargo?.cargoId === baseLoaded[index]?.cargoId)
    ));
  if (!shareGeometry) return undefined;

  const overrides = {};
  for (const [strategy, plan] of entries) {
    const strategyOverrides = [];
    plan.loadedCargo.forEach((cargo, index) => {
      const override = diffObject(baseLoaded[index], cargo);
      if (Object.keys(override.set).length || override.remove.length) {
        strategyOverrides.push({ index, ...override });
      }
    });
    if (strategyOverrides.length) overrides[strategy] = strategyOverrides;
    delete plans[strategy].loadedCargo;
  }

  return {
    version: 2,
    placementHash: basePlan.placementHash,
    baseStrategy,
    loadedCargo: baseLoaded,
    unloadedCargo: basePlan.unloadedCargo || [],
    overrides: Object.keys(overrides).length ? overrides : undefined
  };
}

function compactSharedPlanFields(plans) {
  const planValues = Object.values(plans);
  if (planValues.length < 2) return {};
  const commonKeys = Object.keys(planValues[0]).filter((key) => planValues.every((plan) => Object.hasOwn(plan, key)));
  const shared = {};
  for (const key of commonKeys) {
    const baseline = JSON.stringify(planValues[0][key]);
    if (!planValues.slice(1).every((plan) => JSON.stringify(plan[key]) === baseline)) continue;
    shared[key] = planValues[0][key];
    for (const plan of planValues) delete plan[key];
  }
  return shared;
}

function compactAliases(input) {
  const value = {};
  const aliases = {};
  const canonicalByJson = new Map();
  for (const [key, fieldValue] of Object.entries(input || {})) {
    const json = JSON.stringify(fieldValue);
    if (json === undefined) continue;
    const canonical = json.length >= 128 ? canonicalByJson.get(json) : null;
    if (canonical) aliases[key] = canonical;
    else {
      value[key] = fieldValue;
      if (json.length >= 128) canonicalByJson.set(json, key);
    }
  }
  return { value, aliases };
}

function hydrateAliases(input, aliases) {
  const hydrated = { ...(input || {}) };
  for (const [alias, canonical] of Object.entries(aliases || {})) {
    if (Object.hasOwn(hydrated, canonical)) hydrated[alias] = hydrated[canonical];
  }
  return hydrated;
}

function diffObject(base, value) {
  const set = {};
  const remove = [];
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(value || {})]);
  for (const key of keys) {
    if (!Object.hasOwn(value || {}, key)) remove.push(key);
    else if (!Object.hasOwn(base || {}, key) || JSON.stringify(base[key]) !== JSON.stringify(value[key])) set[key] = value[key];
  }
  return { set, remove };
}

function hydrateLoadedCargo(baseLoaded, overrides) {
  const byIndex = new Map((overrides || []).map((override) => [override.index, override]));
  return baseLoaded.map((cargo, index) => {
    const override = byIndex.get(index);
    if (!override) return cargo;
    const hydrated = { ...cargo, ...(override.set || {}) };
    for (const key of override.remove || []) delete hydrated[key];
    return hydrated;
  });
}

function compactPackingCase(packingCase, strategyPlans) {
  if (!packingCase?.packingPlan) return packingCase;
  const match = Object.entries(strategyPlans || {}).find(([, plan]) => (
    plan?.planId && plan.planId === packingCase.packingPlan.planId
  ));
  if (!match) return packingCase;
  const { packingPlan: _packingPlan, ...summary } = packingCase;
  return { ...summary, packingPlanStrategy: match[0] };
}

function hydratePackingCase(packingCase, strategyPlans) {
  if (!packingCase?.packingPlanStrategy) return packingCase;
  const strategy = packingCase.packingPlanStrategy;
  const { packingPlanStrategy: _packingPlanStrategy, ...summary } = packingCase;
  return { ...summary, packingPlan: strategyPlans?.[strategy] || null };
}
