'use strict';

const { PACKAGING_TYPES, TYPE_DEFAULTS } = require('../services/packing/PackagingProfile');

const VARIANTS = Object.freeze([
  { suffix: 'UPRIGHT', orientationPolicy: 'UPRIGHT_ONLY', stackable: true, maxStackLayers: 2 },
  { suffix: 'ROTATE', orientationPolicy: 'HORIZONTAL_ROTATION_ONLY', stackable: true, maxStackLayers: 3 },
  { suffix: 'NONSTACK', orientationPolicy: 'FIXED_ORIENTATION', stackable: false, maxStackLayers: 1 }
]);

function buildPackagingSemanticCases() {
  const cases = [];
  for (const [typeIndex, packagingType] of PACKAGING_TYPES.entries()) {
    for (const [variantIndex, variant] of VARIANTS.entries()) {
      const id = `PACK-${String(typeIndex * VARIANTS.length + variantIndex + 1).padStart(2, '0')}-${packagingType}-${variant.suffix}`;
      const wooden = ['WOOD_CRATE', 'PALLETIZED_CARTONS', 'WRAPPED_PALLET', 'EQUIPMENT_CASE'].includes(packagingType);
      const manualCapable = ['CARTON', 'DRUM', 'FIBC_BAG', 'GENERIC'].includes(packagingType);
      cases.push({
        id,
        scenario: 'PACKAGING_SEMANTICS',
        expected: {
          packagingType,
          visualAssetKey: TYPE_DEFAULTS[packagingType].visualAssetKey,
          orientationCount: variant.orientationPolicy === 'HORIZONTAL_ROTATION_ONLY' ? 2 : 1,
          stackable: variant.stackable,
          maxStackLayers: variant.maxStackLayers,
          wooden
        },
        container: { typeId: 'PACKAGING-RIG', innerLength: 3600, innerWidth: 2200, innerHeight: 2200, maxWeight: 12000 },
        cargoList: [{
          cargoId: `${id}-CARGO`,
          name: `${packagingType} 语义样件`,
          length: 900 + typeIndex * 10,
          width: 600 + variantIndex * 20,
          height: 500 + typeIndex * 5,
          weight: manualCapable ? 12 : 80 + typeIndex * 10,
          quantity: 3,
          packagingType,
          orientationPolicy: variant.orientationPolicy,
          stackable: variant.stackable,
          maxStackLayers: variant.maxStackLayers,
          maximumSupportedWeightKg: variant.stackable ? 2000 : null,
          fragile: packagingType === 'CARTON' && variantIndex === 2,
          wooden,
          portSequence: 1,
          destinationPort: 'HAM',
          handlingMethod: manualCapable ? 'manual' : 'forklift',
          dataClassification: 'SYNTHETIC_PACKAGING_BENCHMARK'
        }]
      });
    }
  }
  return cases;
}

module.exports = { VARIANTS, buildPackagingSemanticCases };
