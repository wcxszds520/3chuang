'use strict';

const BASE_PATTERNS = Object.freeze([
  [[500, 500], [500, 500], [500, 500], [500, 500], [500, 500]],
  [[500, 250], [500, 250], [500, 250], [500, 250], [500, 250], [500, 250], [500, 250]],
  [[600, 400], [600, 400], [400, 600], [400, 400], [400, 400]],
  [[700, 300], [700, 300], [300, 700], [300, 300], [300, 300], [300, 300]],
  [[600, 600], [400, 400], [400, 400], [400, 400], [400, 400]],
  [[450, 550], [550, 450], [450, 450], [550, 550], [300, 450]],
  [[800, 200], [800, 200], [200, 800], [200, 800], [400, 400], [400, 400]],
  [[650, 350], [650, 350], [350, 650], [350, 350], [350, 350], [300, 300]],
  [[750, 250], [750, 250], [250, 750], [250, 750], [500, 250], [500, 250]],
  [[600, 500], [500, 400], [400, 500], [400, 400], [300, 300]]
]);

function buildTinyOracleCases(count = 20) {
  return Array.from({ length: count }, (_, caseIndex) => {
    const scale = caseIndex >= BASE_PATTERNS.length ? 0.9 : 1;
    const pattern = BASE_PATTERNS[caseIndex % BASE_PATTERNS.length];
    const height = 400;
    return {
      id: `TINY-ORACLE-${String(caseIndex + 1).padStart(2, '0')}`,
      seed: 8300 + caseIndex * 53,
      dataClassification: 'SYNTHETIC_TINY_ORACLE',
      container: { typeId: 'TINY', innerLength: 1000, innerWidth: 1000, innerHeight: 500, maxWeight: 10000 },
      cargoList: pattern.map(([length, width], itemIndex) => ({
        cargoId: `TO-${caseIndex + 1}-${itemIndex + 1}`,
        sku: `TINY-${caseIndex + 1}-${itemIndex + 1}`,
        name: `Tiny oracle box ${caseIndex + 1}-${itemIndex + 1}`,
        length: Math.round(length * scale),
        width: Math.round(width * scale),
        height,
        weight: 25,
        quantity: 1,
        stackable: false,
        maxStackLayers: 1,
        canRotate: itemIndex % 3 !== 0,
        canLayFlat: false,
        fragile: false,
        packagingType: 'oracle-floor-box',
        handlingMethod: 'forklift',
        portSequence: 1,
        dataClassification: 'SYNTHETIC_TINY_ORACLE'
      }))
    };
  });
}

module.exports = { buildTinyOracleCases };
