'use strict';

function buildSourceIndex(cargoList) {
  const bySku = new Map(), byId = new Map();
  const add = (map, key, cargo) => {
    if (key === undefined || key === null || key === '') return;
    const entries = map.get(String(key)) || [];
    if (!entries.includes(cargo)) entries.push(cargo);
    map.set(String(key), entries);
  };
  for (const cargo of cargoList) {
    add(bySku, cargo.sku, cargo);
    for (const id of [cargo.cargoId, cargo.id]) add(byId, id, cargo);
  }
  return { bySku, byId, cargoList };
}

function bindSource(item, index) {
  const failure = code => ({ source: null, code });
  const explicit = item.sourceCargoId !== undefined && item.sourceCargoId !== null;
  const physicalId = String(item.cargoId || item.instanceId || '');
  // Proven local history: source_<positive integer>, source_unloaded_<integer>,
  // and the external adapter's source__piece_<zero-padded integer>. No startsWith guess.
  let physical = index.byId.get(physicalId) || [];
  if (!physical.length) physical = [...index.byId].filter(([id]) => {
    const suffix = physicalId.slice(id.length);
    return physicalId.startsWith(id) && (/^_[1-9]\d*$/.test(suffix) || /^_unloaded_[1-9]\d*$/.test(suffix) || /^__piece_0*[1-9]\d*$/.test(suffix));
  }).flatMap(([,sources]) => sources);
  physical = [...new Set(physical)];
  const candidates = explicit ? index.byId.get(String(item.sourceCargoId)) || [] : physical.length ? physical : index.bySku.get(String(item.sku || '')) || [];
  if (!candidates.length) return failure('UNKNOWN_SOURCE_CARGO');
  if (candidates.length !== 1) return failure('AMBIGUOUS_SOURCE_CARGO');
  const source = candidates[0];
  if (physical.length && (physical.length !== 1 || physical[0] !== source)) return failure('SOURCE_IDENTITY_CONFLICT');
  if (item.sku !== undefined && item.sku !== null && String(item.sku) !== String(source.sku || '')) return failure('SOURCE_IDENTITY_CONFLICT');
  return { source, code: null };
}

function validateSourceAccounting(placements, unloadedCargo, index) {
  const violations = [];
  const add = (code, item, evidence) => violations.push({code,cargoIds:[item?.cargoId].filter(Boolean),message:code,evidence});
  const counts = new Map(), ids = new Map();
  const groups = [['loaded', placements], ...(unloadedCargo === undefined ? [] : [['unloaded', unloadedCargo]])];
  for (const [kind, items] of groups) for (const item of items) {
    const binding = bindSource(item, index);
    if (binding.code) { add(binding.code,item,{sourceCargoId:item.sourceCargoId,sku:item.sku}); continue; }
    if (!item.cargoId) add('UNKNOWN_PHYSICAL_CARGO_ID',item,{});
    const id = String(item.cargoId);
    if (ids.has(id)) add(ids.get(id) === kind ? 'DUPLICATE_CARGO_ID' : 'LOADED_UNLOADED_ID_CONFLICT',item,{});
    ids.set(id,kind);
    const quantity = kind === 'loaded' ? 1 : item.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1) add('INVALID_UNLOADED_QUANTITY',item,{quantity});
    counts.set(binding.source,(counts.get(binding.source)||0)+quantity);
  }
  for (const source of index.cargoList) {
    const expected = source.quantity ?? 1, actual = counts.get(source)||0;
    if (actual > expected) add('SOURCE_QUANTITY_EXCEEDED',source,{expected,actual});
    if (unloadedCargo !== undefined && actual !== expected) add('QUANTITY_CONSERVATION',source,{expected,actual});
  }
  return violations;
}

module.exports = { buildSourceIndex, bindSource, validateSourceAccounting };
