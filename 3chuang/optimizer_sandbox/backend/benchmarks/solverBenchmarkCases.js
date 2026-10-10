'use strict';

const CONTAINERS = Object.freeze({
  '20GP': Object.freeze({ typeId: '20GP', innerLength: 5898, innerWidth: 2352, innerHeight: 2393, maxWeight: 21770 }),
  '40HQ': Object.freeze({ typeId: '40HQ', innerLength: 12032, innerWidth: 2352, innerHeight: 2698, maxWeight: 26000 })
});

const DIMENSIONS = Object.freeze([
  [320, 280, 260], [400, 350, 300], [500, 400, 350], [600, 500, 450],
  [700, 600, 550], [800, 650, 700], [900, 500, 260], [1000, 800, 900]
]);

const SCENARIOS = Object.freeze([
  'UNIFORM_CARTONS', 'MIXED_DIMENSIONS', 'HEAVY_LIGHT_MIX', 'FRAGILE',
  'NON_STACKABLE', 'RESTRICTED_ROTATION', 'MULTIPLE_PORTS', 'TALL_CARGO',
  'LOW_WIDE_CARGO', 'MANUAL_FORKLIFT', 'SPARSE_FIT', 'DENSE_FIT'
]);

function buildSyntheticBenchmarkCases(count = 48) {
  return Array.from({ length: count }, (_, caseIndex) => {
    const seed = 4100 + caseIndex * 97;
    const random = lcg(seed);
    const container = caseIndex % 3 === 0 ? CONTAINERS['20GP'] : CONTAINERS['40HQ'];
    const scenario = SCENARIOS[caseIndex % SCENARIOS.length];
    const skuCount = scenario === 'UNIFORM_CARTONS' ? 3 : 3 + Math.floor(random() * 5);
    const cargoList = Array.from({ length: skuCount }, (_, skuIndex) => {
      const dims = scenarioDimensions(scenario, skuIndex, random);
      const fragile = scenario === 'FRAGILE' ? skuIndex % 2 === 0 : skuIndex === 1 && caseIndex % 4 === 0;
      const stackable = scenario === 'NON_STACKABLE' ? skuIndex % 2 !== 0 : !fragile && !(skuIndex === 2 && caseIndex % 5 === 0);
      const weight = scenario === 'HEAVY_LIGHT_MIX'
        ? (skuIndex % 2 === 0 ? 95 + Math.floor(random() * 80) : 3 + Math.floor(random() * 8))
        : 4 + Math.floor(random() * 75);
      const portCount = scenario === 'MULTIPLE_PORTS' ? 3 : (caseIndex % 2 === 0 ? 3 : 2);
      const portSequence = 1 + (skuIndex % portCount);
      const restrictedRotation = scenario === 'RESTRICTED_ROTATION';
      return {
        cargoId: `S${seed}-${skuIndex + 1}`,
        sku: `SYN-${seed}-${skuIndex + 1}`,
        name: `固定种子货物 ${seed}-${skuIndex + 1}`,
        length: dims[0],
        width: dims[1],
        height: dims[2],
        weight,
        quantity: scenario === 'SPARSE_FIT' ? 1 + Math.floor(random() * 3)
          : scenario === 'DENSE_FIT' ? 9 + Math.floor(random() * 8)
            : 3 + Math.floor(random() * 9),
        stackable,
        maxStackLayers: stackable ? 2 + Math.floor(random() * 4) : 1,
        canRotate: restrictedRotation ? false : skuIndex % 4 !== 0,
        canLayFlat: !restrictedRotation && skuIndex % 3 === 0 && dims[2] < 800,
        canInvert: false,
        fragile,
        packagingType: skuIndex % 5 === 0 ? 'wooden' : 'carton',
        wooden: skuIndex % 5 === 0,
        handlingMethod: weight >= 20 ? 'forklift' : 'manual',
        destinationPort: ['Hamburg', 'Rotterdam', 'Antwerp'][portSequence - 1],
        portSequence,
        source: 'synthetic-benchmark',
        dataClassification: 'SYNTHETIC_BENCHMARK'
      };
    });
    return {
      id: `SYNTHETIC-${String(caseIndex + 1).padStart(2, '0')}`,
      seed,
      scenario,
      dataClassification: 'SYNTHETIC_BENCHMARK',
      container: { ...container },
      cargoList
    };
  });
}

function scenarioDimensions(scenario, skuIndex, random) {
  if (scenario === 'UNIFORM_CARTONS') return [500, 400, 350];
  if (scenario === 'TALL_CARGO') return skuIndex % 2 === 0 ? [500, 450, 1200] : [700, 500, 900];
  if (scenario === 'LOW_WIDE_CARGO') return skuIndex % 2 === 0 ? [1200, 1000, 260] : [900, 800, 300];
  if (scenario === 'SPARSE_FIT') return skuIndex % 2 === 0 ? [1600, 1000, 1100] : [1200, 900, 800];
  if (scenario === 'DENSE_FIT') return skuIndex % 2 === 0 ? [320, 280, 260] : [400, 350, 300];
  return DIMENSIONS[Math.floor(random() * DIMENSIONS.length)];
}

function lcg(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

module.exports = { buildSyntheticBenchmarkCases, CONTAINERS, SCENARIOS };
