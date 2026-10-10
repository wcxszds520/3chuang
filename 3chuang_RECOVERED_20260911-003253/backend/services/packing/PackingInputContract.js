'use strict';

function assertInputFacts(cargoList, { allowUnknownWeight = false } = {}) {
  const fail = message => { throw Object.assign(new Error(message), { code: 'PACKING_INPUT_INVALID' }); };
  if (!Array.isArray(cargoList) || !cargoList.length) fail('当前货单不能为空');
  const ids = new Set();
  for (const c of cargoList) {
    if (!c || !c.cargoId || ids.has(String(c.cargoId))) fail('每条货物必须有唯一的货物 ID');
    ids.add(String(c.cargoId));
    if (!['length','width','height'].every(k => c[k] !== null && c[k] !== '' && Number.isFinite(Number(c[k])) && Number(c[k]) > 0)) fail('货物外尺寸必须是大于零的毫米数');
    if (c.quantity === null || c.quantity === '' || !Number.isInteger(Number(c.quantity)) || Number(c.quantity) <= 0) fail('货物件数必须是正整数，不能自动四舍五入');
    const unknown = c.weight == null || c.weight === '';
    if ((unknown && !allowUnknownWeight) || (!unknown && (!Number.isFinite(Number(c.weight)) || Number(c.weight) < 0))) fail('当前求解需要已知的非负包装毛重，缺失质量不能视为零');
  }
}

async function assertBusinessCapabilities(body) {
  const sources = [body.externalDataset?.source, ...(Array.isArray(body.cargoList) ? body.cargoList : []).map(c => c.externalMetadata?.externalSource || c.externalMetadata?.cargoSource)].filter(Boolean);
  if (!sources.length) return;
  const { businessSimulationCapabilities } = await import('../../../shared/externalCapabilities.mjs');
  const unsupported = sources.map(businessSimulationCapabilities).find(c => !c.canSolve);
  if (unsupported) throw Object.assign(new Error('该来源工业约束尚未支持与业务作业规则组合，已阻止正式求解'), { code: 'SOURCE_RULE_UNSUPPORTED', details: unsupported });
}

function assertActualContainerFacts(container) {
  const fail = message => { throw Object.assign(new Error(message), { code: 'PACKING_INPUT_INVALID' }); };
  if (!container || !['innerLength', 'innerWidth', 'innerHeight', 'doorWidth', 'doorHeight'].every(k =>
    container[k] != null && container[k] !== '' && Number.isFinite(Number(container[k])) && Number(container[k]) > 0)) {
    fail('实箱求解需要有效的内长、内宽、内高及门洞宽高，不能用参考尺寸补成实测值');
  }
  if (Number(container.doorWidth) > Number(container.innerWidth) || Number(container.doorHeight) > Number(container.innerHeight)) fail('实箱门洞不能大于箱内宽高');
  const gross = Number(container.maxGross), tare = Number(container.tare);
  if (!Number.isFinite(gross) || !Number.isFinite(tare) || tare <= 0 || gross <= tare) fail('实箱需要有效的铭牌最大总重和皮重，才能核对载重边界');
}

module.exports = { assertInputFacts, assertBusinessCapabilities, assertActualContainerFacts };
