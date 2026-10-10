'use strict';

const { CONTAINERS } = require('./solverBenchmarkCases');

const CHALLENGE_CLASSES = Object.freeze([
  'UNIFORM_CARTONS',
  'MIXED_SKU_SAME_DESTINATION',
  'MIXED_SKU_MULTI_DESTINATION',
  'LARGE_SMALL_FILLER',
  'TALL_SHORT',
  'HEAVY_LIGHT',
  'FRAGILE',
  'NON_STACKABLE',
  'ROTATION_RESTRICTED',
  'MANUAL_FORKLIFT',
  'HIGH_RESIDUAL_VOLUME',
  'DENSE_PACKING',
  'LIFO_CHALLENGE',
  'GAP_FRAGMENTATION_CHALLENGE',
  'CROSS_SECTION_CHALLENGE',
  'OPERATION_INSERTION_CHALLENGE',
  'SECURING_RESERVE_CHALLENGE'
]);

const DIMENSION_SETS = Object.freeze({
  UNIFORM_CARTONS: [[500, 400, 350]],
  MIXED_SKU_SAME_DESTINATION: [[720, 480, 520], [500, 400, 350], [360, 300, 280]],
  MIXED_SKU_MULTI_DESTINATION: [[800, 600, 500], [600, 450, 400], [400, 350, 300]],
  LARGE_SMALL_FILLER: [[1200, 900, 900], [600, 450, 450], [300, 250, 250]],
  TALL_SHORT: [[700, 550, 1200], [700, 550, 450], [450, 350, 300]],
  HEAVY_LIGHT: [[900, 650, 700], [500, 400, 350], [350, 300, 260]],
  FRAGILE: [[650, 500, 500], [500, 400, 350], [350, 300, 260]],
  NON_STACKABLE: [[900, 700, 500], [700, 550, 450], [450, 350, 300]],
  ROTATION_RESTRICTED: [[950, 650, 500], [700, 500, 400], [450, 350, 300]],
  MANUAL_FORKLIFT: [[900, 650, 700], [600, 450, 400], [350, 300, 260]],
  HIGH_RESIDUAL_VOLUME: [[1600, 1000, 1100], [1200, 900, 800], [700, 500, 500]],
  DENSE_PACKING: [[400, 350, 300], [360, 300, 280], [320, 280, 260]],
  LIFO_CHALLENGE: [[1000, 700, 600], [750, 550, 500], [500, 400, 350]],
  GAP_FRAGMENTATION_CHALLENGE: [[1050, 720, 650], [680, 470, 430], [390, 310, 280]],
  CROSS_SECTION_CHALLENGE: [[900, 780, 500], [700, 520, 600], [500, 360, 400], [320, 280, 300]],
  OPERATION_INSERTION_CHALLENGE: [[1100, 900, 850], [800, 650, 650], [500, 400, 350]],
  SECURING_RESERVE_CHALLENGE: [[1400, 850, 900], [900, 600, 600], [500, 400, 400]]
});

/**
 * Competition 2.3 deterministic challenge corpus. These cases are synthetic
 * and deliberately identify their benchmark class; no production cargo IDs
 * or Dataset A SKU values are used.
 */
function buildPhysicalPackingChallengeCases(count = 64) {
  return Array.from({ length: count }, (_, caseIndex) => {
    const challengeClass = CHALLENGE_CLASSES[caseIndex % CHALLENGE_CLASSES.length];
    const seed = 23000 + caseIndex * 131;
    const random = lcg(seed);
    const container = caseIndex % 4 === 0 ? CONTAINERS['20GP'] : CONTAINERS['40HQ'];
    const dimensions = DIMENSION_SETS[challengeClass];
    const skuCount = challengeClass === 'UNIFORM_CARTONS' ? 3 : Math.min(7, Math.max(3, dimensions.length + (caseIndex % 3)));
    const cargoList = Array.from({ length: skuCount }, (_, skuIndex) => {
      const base = dimensions[skuIndex % dimensions.length];
      const dimensionJitter = challengeClass === 'UNIFORM_CARTONS' ? 0 : Math.floor(random() * 3) * 10;
      const portSequence = portFor(challengeClass, skuIndex);
      const fragile = challengeClass === 'FRAGILE' ? skuIndex % 2 === 0 : skuIndex === skuCount - 1 && caseIndex % 5 === 0;
      const stackable = challengeClass === 'NON_STACKABLE' ? skuIndex % 2 !== 0 : !fragile;
      const manual = challengeClass === 'MANUAL_FORKLIFT' && skuIndex % 2 === 1;
      const heavy = challengeClass === 'HEAVY_LIGHT' ? skuIndex % 2 === 0 : base[0] >= 900;
      return {
        cargoId: `PP-${seed}-${skuIndex + 1}`,
        sku: `PP-SKU-${seed}-${skuIndex + 1}`,
        name: `Physical packing challenge ${caseIndex + 1}-${skuIndex + 1}`,
        length: base[0] + dimensionJitter,
        width: base[1] + dimensionJitter,
        height: base[2],
        weight: manual ? 8 + Math.floor(random() * 12) : heavy ? 80 + Math.floor(random() * 80) : 10 + Math.floor(random() * 45),
        quantity: quantityFor(challengeClass, random),
        stackable,
        maxStackLayers: stackable ? 2 + Math.floor(random() * 3) : 1,
        canRotate: challengeClass !== 'ROTATION_RESTRICTED' && skuIndex % 4 !== 0,
        canLayFlat: false,
        canInvert: false,
        fragile,
        packagingType: fragile ? 'protected-carton' : skuIndex % 5 === 0 ? 'wooden' : 'carton',
        wooden: !fragile && skuIndex % 5 === 0,
        handlingMethod: manual ? 'manual' : 'forklift',
        destinationPort: ['Hamburg', 'Rotterdam', 'Antwerp'][portSequence - 1],
        portSequence,
        source: 'competition-2.3-deterministic-challenge',
        dataClassification: 'SYNTHETIC_BENCHMARK'
      };
    });
    return {
      id: `PHYSICAL-${String(caseIndex + 1).padStart(2, '0')}`,
      seed,
      scenario: challengeClass,
      challengeClass,
      dataClassification: 'SYNTHETIC_BENCHMARK',
      container: { ...container },
      cargoList
    };
  });
}

function portFor(challengeClass, skuIndex) {
  if (challengeClass === 'MIXED_SKU_SAME_DESTINATION' || challengeClass === 'UNIFORM_CARTONS') return 1;
  if (['MIXED_SKU_MULTI_DESTINATION', 'LIFO_CHALLENGE'].includes(challengeClass)) return 1 + (skuIndex % 3);
  return 1 + (skuIndex % 2);
}

function quantityFor(challengeClass, random) {
  if (challengeClass === 'HIGH_RESIDUAL_VOLUME' || challengeClass === 'SECURING_RESERVE_CHALLENGE') return 1 + Math.floor(random() * 3);
  if (challengeClass === 'DENSE_PACKING') return 10 + Math.floor(random() * 7);
  return 3 + Math.floor(random() * 6);
}

function lcg(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

module.exports = { buildPhysicalPackingChallengeCases, CHALLENGE_CLASSES };
