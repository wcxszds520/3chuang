export const CONTAINER_CATALOG = Object.freeze({
  '20GP': Object.freeze({
    typeId: '20GP',
    name: '20GP 标准柜',
    shortName: '20GP',
    innerLength: 5898,
    innerWidth: 2352,
    innerHeight: 2393,
    doorWidth: 2340,
    doorHeight: 2280,
    maxWeight: 28300,
    payload: 28300,
    tareWeight: 2180,
    maxGross: 30480,
    isoTypeCode: '22G1',
    mode: 'REFERENCE_PROFILE',
    capacityM3: 33.2,
    source: { authority: 'Maersk', classification: 'CARRIER_REFERENCE', verifiedAt: '2026-08-24', url: 'https://www.maersk.com/~/media_sc9/maersk/local-information/files/europe/greece/import/equipment-flyer.pdf' },
    useCase: '小批量、高密度或试单补货'
  }),
  '40GP': Object.freeze({
    typeId: '40GP',
    name: '40GP 标准柜',
    shortName: '40GP',
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2393,
    doorWidth: 2340,
    doorHeight: 2280,
    maxWeight: 28870,
    payload: 28870,
    tareWeight: 3630,
    maxGross: 32500,
    isoTypeCode: '42G1',
    mode: 'REFERENCE_PROFILE',
    capacityM3: 67.7,
    source: { authority: 'Maersk', classification: 'CARRIER_REFERENCE', verifiedAt: '2026-08-24', url: 'https://www.maersk.com/~/media_sc9/maersk/local-information/files/europe/greece/import/equipment-flyer.pdf' },
    useCase: '标准纸箱、轻工混装和常规整柜'
  }),
  '40HQ': Object.freeze({
    typeId: '40HQ',
    name: '40HQ 高柜',
    shortName: '40HQ',
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2698,
    doorWidth: 2340,
    doorHeight: 2585,
    maxWeight: 28690,
    payload: 28690,
    tareWeight: 3810,
    maxGross: 32500,
    isoTypeCode: '45G1',
    mode: 'REFERENCE_PROFILE',
    capacityM3: 76.4,
    source: { authority: 'Maersk', classification: 'CARRIER_REFERENCE', verifiedAt: '2026-08-24', url: 'https://www.maersk.com/~/media_sc9/maersk/local-information/files/europe/greece/import/equipment-flyer.pdf' },
    useCase: '多 SKU、轻泡货和跨境电商整柜'
  })
});

export const DECISION_CONTAINER_TYPES = Object.freeze(['20GP', '40GP', '40HQ']);

export function getContainer(typeId) {
  return CONTAINER_CATALOG[typeId] || CONTAINER_CATALOG['40HQ'];
}

export function containerVolume(container) {
  return Number(container?.innerLength || 0)
    * Number(container?.innerWidth || 0)
    * Number(container?.innerHeight || 0);
}
