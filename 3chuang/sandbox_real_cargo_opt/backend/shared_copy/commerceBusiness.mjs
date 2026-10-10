// Business decisions are separate from geometric feasibility and shipping clearance.
export function arrivalState(cargo, planAt) {
  if (!cargo.arrivedAt) return 'UNKNOWN';
  const arrival = Date.parse(cargo.arrivedAt), cutoff = Date.parse(planAt);
  if (!Number.isFinite(arrival) || !Number.isFinite(cutoff)) return 'INVALID';
  return arrival <= cutoff ? 'ARRIVED' : 'EXPECTED';
}

export const orderKey = cargo => JSON.stringify([cargo.customerId || '', cargo.orderId || cargo.cargoId]);

export function validateOrderPolicies(cargoList) {
  const policies = new Map();
  for (const c of cargoList) {
    if (c.required != null && typeof c.required !== 'boolean') throw Error('必运设定应为是或否：' + c.sku);
    if (c.allowPartialShipment != null && typeof c.allowPartialShipment !== 'boolean') throw Error('拆单许可应为是或否：' + c.sku);
    if (c.shipmentPriority != null && (!Number.isInteger(c.shipmentPriority) || c.shipmentPriority < 0 || c.shipmentPriority > 9)) throw Error('订单优先级应为 0 至 9：' + c.sku);
    if (c.allowPartialShipment != null && (!c.orderId || !c.customerId)) throw Error('请先填写货主与订单号，再设定拆单许可：' + c.sku);
    const key = orderKey(c), signature = JSON.stringify([c.required ?? null, c.allowPartialShipment ?? null, c.shipmentPriority ?? 0]);
    if (policies.has(key) && policies.get(key) !== signature) throw Error('同一订单的必运、拆单许可和优先级必须一致：' + c.orderId);
    policies.set(key, signature);
  }
}

export function assessOrderFulfillment(cargoList, placements) {
  const counts = new Map();
  for (const p of placements) counts.set(p.sourceCargoId, (counts.get(p.sourceCargoId) || 0) + 1);
  const groups = new Map();
  for (const c of cargoList) {
    const key = orderKey(c);
    if (!groups.has(key)) groups.set(key, {key, orderId:c.orderId || null, customerId:c.customerId || null,
      required:c.required === true, allowPartialShipment:c.allowPartialShipment ?? null,
      priority:c.shipmentPriority ?? 0, expected:0, loaded:0,expectedVolumeMm3:0,loadedVolumeMm3:0});
    const g = groups.get(key); g.expected += c.quantity; g.loaded += counts.get(c.cargoId) || 0;
    const volume=c.length*c.width*c.height;g.expectedVolumeMm3+=c.quantity*volume;g.loadedVolumeMm3+=(counts.get(c.cargoId)||0)*volume;
  }
  const orders = [...groups.values()].map(g => ({...g, missing:g.expected-g.loaded,
    status:g.loaded === g.expected ? 'COMPLETE' : g.loaded ? 'PARTIAL' : 'NOT_LOADED'}));
  const splitViolations = orders.filter(g => g.allowPartialShipment === false && g.status === 'PARTIAL');
  const requiredMissing = orders.filter(g => g.required).reduce((n,g) => n+g.missing,0);
  return {orders, splitViolations, requiredMissing, complete:orders.every(g => g.missing === 0),
    policyPass:splitViolations.length === 0,
    shipmentTaskSatisfied:requiredMissing === 0 && splitViolations.length === 0,
    unknownPolicyOrders:orders.filter(g => g.orderId && g.allowPartialShipment === null).length};
}

export function rankCommerceCandidate(candidate, fulfillment) {
  const required = fulfillment.orders.filter(g => g.required);
  // An explicitly splittable replenishment order is not a winner-takes-all set.
  // Respect priority, finish indivisible sets, then maximize shipped required volume.
  const missingOrdersByPriority = Array.from({length:10}, (_,i) => {
    const tier=required.filter(g=>g.priority===9-i);
    return [tier.filter(g=>g.allowPartialShipment===false&&g.missing>0).length,
      tier.reduce((n,g)=>n+(g.expectedVolumeMm3-g.loadedVolumeMm3),0)];
  }).flat();
  return [candidate.validator.valid && candidate.audit.valid ? 0 : 1,
    fulfillment.splitViolations.length, ...missingOrdersByPriority,
    required.reduce((n,g)=>n+(g.expectedVolumeMm3-g.loadedVolumeMm3),0),
    -candidate.loadedVolumeMm3, fulfillment.requiredMissing, candidate.audit.extraClusterCount];
}

export function assessBusinessInputs(cargoList, planAt) {
  const count = state => cargoList.filter(c => arrivalState(c,planAt) === state).reduce((n,c) => n+c.quantity,0);
  const unknownArrivalCount = count('UNKNOWN');
  const unverifiedPackagingRows = cargoList.filter(c => !packagingEvidenceMatches(c)).map(c => c.cargoId);
  return {arrival:{arrivedCount:count('ARRIVED'),expectedCount:count('EXPECTED'),unknownCount:unknownArrivalCount,
    status:unknownArrivalCount ? 'NEEDS_CONFIRMATION' : 'KNOWN'},
    packaging:{status:unverifiedPackagingRows.length ? 'NEEDS_CONFIRMATION' : 'VERIFIED', unverifiedCargoIds:unverifiedPackagingRows}};
}

// A label alone cannot certify a package, and changed physical facts invalidate a prior record.
export function packagingEvidenceMatches(cargo) {
  const e=cargo.packagingEvidence;
  if(e?.status!=='VERIFIED'||typeof e.reference!=='string'||!e.reference.trim()||typeof e.verifiedBy!=='string'||!e.verifiedBy.trim()||!Number.isFinite(Date.parse(e.verifiedAt))||!e.profile||typeof e.profile!=='object')return false;
  const fields=['length','width','height','weight','stackable','maxStackLayers','stackLayerScope','handlingMethod','forkEntry'];
  if(fields.some(k=>!(k in e.profile)||e.profile[k]!==cargo[k]))return false;
  if(e.profile.maxSupportedWeight==null||e.profile.maxSupportedWeight!==(cargo.maximumSupportedWeightKg??cargo.maxSupportedWeight))return false;
  const directions=['lengthVertical','widthVertical','heightVertical'];
  return directions.every(k=>typeof e.profile.orientationConstraints?.[k]==='boolean'&&e.profile.orientationConstraints[k]===cargo.orientationConstraints?.[k]);
}
