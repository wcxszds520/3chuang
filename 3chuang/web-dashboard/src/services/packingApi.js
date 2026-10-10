import { cargoFingerprint } from '../domain/cargo/cargo.js';
import { getPlanSourceLabel, PLAN_SOURCE_CODES } from '../domain/provenance/planSource.js';
import { apiRequest, unwrapApiData } from './apiClient.js';

export const PACKING_ENDPOINT = '/api/packing/generate';
export const AUTHORITATIVE_ALGORITHM_ID = 'hybrid-v2.5';

export function buildPackingRequest({
  containerType, cargoList, solver = AUTHORITATIVE_ALGORITHM_ID, strategy = 'space', includeAiExplanation = true,
  caseContext = {}, containerMode = 'REFERENCE_PROFILE', actualContainer = null, massEvidence = {}, vgm = {},
  transport = {}, securingInputs = {}, operatorEnvelope = null, dangerousGoodsEvidence = {}, woodPackagingEvidence = {}
}) {
  return {
    containerType,
    cargoList: cargoList.map((cargo) => ({
      cargoId: cargo.cargoId,
      name: cargo.name,
      sku: cargo.sku,
      length: Number(cargo.length),
      width: Number(cargo.width),
      height: Number(cargo.height),
      weight: Number(cargo.weight),
      quantity: Number(cargo.quantity),
      stackable: cargo.stackable !== false,
      canRotate: cargo.canRotate !== false,
      maxStackLayers: Number(cargo.maxStackLayers || 1),
      canInvert: cargo.canInvert === true,
      canLayFlat: cargo.canLayFlat === true,
      packagingType: cargo.packagingType,
      packagingProfile: cargo.packagingProfile || null,
      cargoPhysicalProfile: cargo.cargoPhysicalProfile || null,
      packagingMaterial: cargo.packagingMaterial || null,
      transportUnit: cargo.transportUnit || null,
      orientationPolicy: cargo.orientationPolicy || null,
      maximumSupportedWeightKg: cargo.maximumSupportedWeightKg || cargo.maxSupportedWeight || null,
      maxSupportedWeight: cargo.maxSupportedWeight || null,
      forkEntry: cargo.forkEntry || null,
      woodPackagingClass: cargo.woodPackagingClass || null,
      dangerousGoodsContext: cargo.dangerousGoodsContext || null,
      visualProfile: cargo.visualProfile || null,
      fragile: cargo.fragile === true,
      dangerous: cargo.dangerous === true,
      destinationPort: cargo.destinationPort || null,
      eta: cargo.eta || null,
      portSequence: Number(cargo.portSequence || 1),
      batchId: cargo.batchId || `batch_${Number(cargo.portSequence || 1)}`,
      batchLabel: cargo.batchLabel || null,
      handlingMethod: cargo.handlingMethod || null,
      handlingPolicy: cargo.handlingPolicy || null,
      heavy: cargo.heavy === true,
      wooden: cargo.wooden === true,
      riskNotes: Array.isArray(cargo.riskNotes) ? [...cargo.riskNotes] : [],
      source: cargo.source || null
    })),
    solver,
    strategy,
    caseContext,
    containerMode,
    actualContainer,
    massEvidence,
    vgm,
    transport,
    securingInputs,
    operatorEnvelope,
    dangerousGoodsEvidence,
    woodPackagingEvidence,
    options: { algorithmId: solver, solver, strategy, includeAiExplanation, caseContext }
  };
}

export function normalizeBackendPlan(payload, { containerType, cargoList }) {
  const data = unwrapApiData(payload);
  if (!data || !Array.isArray(data.loadedCargo) || !data.containerInfo) {
    const error = new Error('装箱接口返回结构不完整');
    error.reason = 'contract';
    throw error;
  }
  return {
    ...data,
    loadedCargo: data.loadedCargo.map((cargo) => ({ ...cargo })),
    unloadedCargo: Array.isArray(data.unloadedCargo) ? data.unloadedCargo.map((cargo) => ({ ...cargo })) : [],
    source: 'backend',
    sourceCode: PLAN_SOURCE_CODES.BACKEND_SOLVED,
    sourceLabel: getPlanSourceLabel(PLAN_SOURCE_CODES.BACKEND_SOLVED),
    totalCargoInput: cargoList.reduce((sum, cargo) => sum + Number(cargo.quantity || 0), 0),
    inputFingerprint: cargoFingerprint(cargoList, containerType),
    ext_algorithmId: data.ext_algorithmId || data.metrics?.algorithm_id || AUTHORITATIVE_ALGORITHM_ID,
    ext_strategyUsed: data.ext_strategyUsed || data.metrics?.strategy_used || 'backend',
    validator: data.validator || null,
    admission: data.ext_admission || data.admission || null,
    portAccessibility: data.ext_portAccessibility || data.portAccessibility || null,
    loadDistribution: data.ext_loadDistribution || data.loadDistribution || null,
    voidJustification: data.ext_voidJustification || data.voidJustification || null,
    packagingModel: data.ext_packagingModel || data.packagingModel || null,
    shipmentReadiness: data.ext_shipmentReadiness || data.shipmentReadiness || null,
    placementHash: data.ext_placementHash || data.placementHash || null
  };
}

export async function generatePackingPlan(input, config = {}) {
  const body = buildPackingRequest(input);
  const payload = await apiRequest(PACKING_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: config.signal
  // V2.5 compares three CPU-bound strategies. On a competition laptop the
  // backend may serialize part of that work, so the client must not discard a
  // valid result while the final strategy is still completing.
  }, { fetchImpl: config.fetchImpl, timeoutMs: config.timeoutMs ?? 180_000 });
  return normalizeBackendPlan(payload, input);
}
