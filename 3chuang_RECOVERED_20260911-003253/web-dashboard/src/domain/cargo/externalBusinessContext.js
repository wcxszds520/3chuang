export const DEFAULT_FREIGHT_PROFILE_ID = 'PROFILE_EUROPE_HAMBURG_V1';

export const FREIGHT_BUSINESS_PROFILES = Object.freeze([Object.freeze({
  id: DEFAULT_FREIGHT_PROFILE_ID,
  version: '1.0',
  label: '欧洲 · 宁波 → 汉堡',
  placeOfReceipt: '宁波港前集拼仓',
  portOfLoading: Object.freeze({ code: 'CNNGB', name: '宁波' }),
  portOfDischarge: Object.freeze({ code: 'DEHAM', name: '汉堡' }),
  placeOfDelivery: '汉堡目的地 CFS / 配送节点',
  routeProfile: Object.freeze({
    id: 'HAPAG_LLOYD_NE4_2026_REFERENCE',
    label: '亚洲—北欧 NE4 航线参考',
    ports: Object.freeze(['青岛', '宁波', '丹戎帕拉帕斯', '伦敦门户港', '不来梅哈芬', '汉堡', '鹿特丹', '阿尔赫西拉斯'])
  }),
  routeReference: Object.freeze({
    publisher: 'Hapag-Lloyd',
    title: 'Gemini Network 2026 · NE4',
    url: 'https://www.hapag-lloyd.com/de/company/press/releases/2026/02/gemini-network-2026--targeted-enhancements-build-on-industry-lea.html',
    retrievedAt: '2026-09-11'
  }),
  portContextSource: 'PORTCUBE_TASK_CONFIGURATION_WITH_PUBLIC_ROUTE_REFERENCE'
})]);

export function freightProfile(profileId = DEFAULT_FREIGHT_PROFILE_ID) {
  return FREIGHT_BUSINESS_PROFILES.find((profile) => profile.id === profileId) || FREIGHT_BUSINESS_PROFILES[0];
}

export function createFreightBusinessContext(dataset, instance, options = {}) {
  const profile = freightProfile(options.profileId);
  const customerCount = boundedCount(options.customerCount, 3);
  const orderGroupCount = boundedCount(options.orderGroupCount, customerCount);
  const unloadGroupCount = boundedCount(options.unloadGroupCount, 3);
  const ranked = (instance.items || []).map((item) => ({
    item,
    key: itemKey(dataset, instance, item),
    score: stableHash(itemKey(dataset, instance, item))
  })).sort((left, right) => left.score - right.score || left.key.localeCompare(right.key));
  const assignments = {};
  ranked.forEach(({ item }, rank) => {
    const unloadIndex = rank % unloadGroupCount + 1;
    const customerIndex = rank % customerCount + 1;
    const orderIndex = rank % orderGroupCount + 1;
    const customerId = `EXT-CUSTOMER-${String(customerIndex).padStart(2, '0')}`;
    const orderId = `EXT-ORDER-${String(orderIndex).padStart(2, '0')}`;
    assignments[String(item.externalItemId)] = {
      customerId,
      customerName: `客户 ${letter(customerIndex)}`,
      orderId,
      orderLabel: `订单 ${letter(orderIndex)}`,
      destinationPort: 'Hamburg',
      portSequence: unloadIndex,
      unloadGroup: `UNLOAD-GROUP-${unloadIndex}`,
      unloadGroupLabel: `卸货组 ${unloadIndex}`,
      batchId: `EXT-HAM-G${unloadIndex}`,
      batchLabel: `汉堡 · 卸货组 ${unloadIndex} · 客户 ${letter(customerIndex)}`
    };
  });
  return {
    profileId: profile.id,
    profileVersion: profile.version,
    label: profile.label,
    customerCount,
    orderGroupCount,
    unloadGroupCount,
    placeOfReceipt: profile.placeOfReceipt,
    portOfLoading: { ...profile.portOfLoading },
    portOfDischarge: { ...profile.portOfDischarge },
    placeOfDelivery: profile.placeOfDelivery,
    routeProfile: { ...profile.routeProfile, ports: [...profile.routeProfile.ports] },
    routeReference: { ...profile.routeReference },
    portContextSource: profile.portContextSource,
    assignmentMethod: 'DETERMINISTIC_SOURCE_GROUPING',
    assignments
  };
}

export function solverReadinessFor(source, group) {
  if (source === 'esicup_irregular' || (source === 'orlib_thpack' && ['thpack8', 'thpack9'].includes(group))) return 'BROWSE_ONLY';
  return 'PARTIALLY_SUPPORTED';
}

function itemKey(dataset, instance, item) {
  const sourceGrouping = item.stackingGroup ?? item.sourceFields?.layerDefinition ?? item.externalDataset ?? instance.group ?? '';
  return [dataset.source, instance.id, sourceGrouping, item.externalItemId].map((value) => String(value ?? '')).join('|');
}

function boundedCount(value, fallback) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.min(4, Math.max(2, parsed)) : fallback;
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function letter(index) { return String.fromCharCode(64 + index); }
