import { classifyCargoAppearance } from '../../domain/cargo/appearance.js';

/**
 * Visual meshes explain a cargo's packaging; they never change its solver
 * envelope. Every descriptor therefore keeps the visual asset lookup separate
 * from the canonical packaging type used by the backend.
 */
export const CARGO_VISUAL_FACTORY = Object.freeze({
  carton: descriptor('CARTON', 'rounded-box', ['cargo_carton'], ['v25_carton_', 'v21_carton_']),
  crate: descriptor('WOOD_CRATE', 'reinforced-box', ['cargo_crate'], ['v25_crate_', 'v21_crate_']),
  palletized: descriptor('PALLETIZED_CARTONS', 'pallet-stack', ['cargo_palletized'], ['v25_palletized_', 'v21_pallet_']),
  wrapped: descriptor('WRAPPED_PALLET', 'wrapped-pallet', ['cargo_wrapped'], ['v25_wrapped_', 'v21_wrap_']),
  equipment_case: descriptor('EQUIPMENT_CASE', 'equipment-case', ['cargo_equipment_case', 'cargo_equipment'], ['v25_equipment_case_', 'v21_case_', 'v21_equipment_']),
  drum: descriptor('DRUM', 'drum', ['cargo_drum'], ['v25_drum_']),
  fibc: descriptor('FIBC_BAG', 'soft-bag', ['cargo_fibc'], ['v25_fibc_']),
  generic: descriptor('GENERIC', 'rounded-box', ['cargo_generic'], ['v25_generic_', 'v21_generic_'])
});

export function cargoVisualDescriptor(cargo = {}) {
  const appearance = classifyCargoAppearance(cargo);
  const descriptorValue = CARGO_VISUAL_FACTORY[appearance.key] || CARGO_VISUAL_FACTORY.generic;
  return Object.freeze({
    ...descriptorValue,
    appearance,
    solverEnvelope: cargo.cargoPhysicalProfile?.solverEnvelope || {
      length: Number(cargo.l || cargo.length || 0),
      width: Number(cargo.w || cargo.width || 0),
      height: Number(cargo.h || cargo.height || 0)
    },
    visualProfile: cargo.packagingProfile?.visualProfile || cargo.cargoPhysicalProfile?.visualProfile || null
  });
}

export function cargoKitDescriptor(appearanceKey) {
  return CARGO_VISUAL_FACTORY[appearanceKey] || CARGO_VISUAL_FACTORY.generic;
}

function descriptor(packagingType, primitive, assetNames, assetPrefixes) {
  return Object.freeze({ packagingType, primitive, assetNames: Object.freeze(assetNames), assetPrefixes: Object.freeze(assetPrefixes) });
}
