'use strict';

const PlanValidator = require('../../services/packing/PlanValidator');
const {
  PACKAGING_TYPES,
  canonicalPackagingType,
  normalizeCargoPhysicalProfile
} = require('../../services/packing/PackagingProfile');

describe('CargoPhysicalProfile / PackagingProfile V2.5', () => {
  test('keeps undeclared jack compatibility unknown and preserves explicit fork axes and refusal',()=>{
    const raw={name:'托盘',length:1200,width:1000,height:500,weight:260,quantity:1,packagingType:'PALLETIZED_CARTONS'};
    expect(normalizeCargoPhysicalProfile(raw).palletJackCompatible).toBeNull();
    const normalized=normalizeCargoPhysicalProfile({...raw,forkEntry:'TWO_WAY',forkEntryAxis:'WIDTH',palletJackCompatible:false});
    expect(normalized.packagingProfile.forkEntryAxis).toBe('WIDTH');
    expect(normalizeCargoPhysicalProfile(normalized).palletJackCompatible).toBe(false);
  });
  test('supports all canonical packaging types and traceable legacy aliases', () => {
    expect(PACKAGING_TYPES).toEqual([
      'CARTON', 'WOOD_CRATE', 'PALLETIZED_CARTONS', 'WRAPPED_PALLET',
      'EQUIPMENT_CASE', 'DRUM', 'FIBC_BAG', 'GENERIC'
    ]);
    expect(canonicalPackagingType('wooden')).toBe('WOOD_CRATE');
    expect(canonicalPackagingType('wrapped pallet')).toBe('WRAPPED_PALLET');
    expect(canonicalPackagingType('吨袋')).toBe('FIBC_BAG');
  });

  test('keeps AI packaging suggestions outside solver truth until confirmed', () => {
    const cargo = normalizeCargoPhysicalProfile({
      cargoId: 'AI-1', name: '建议木箱', length: 1000, width: 600, height: 700, weight: 120, quantity: 1,
      packagingProfile: { type: 'WOOD_CRATE', aiSuggested: true }
    });
    expect(cargo.packagingProfile.confirmationStatus).toBe('USER_CONFIRMATION_REQUIRED');
    expect(cargo.cargoPhysicalProfile.solverEnvelope.truthModel).toBe('AXIS_ALIGNED_PHYSICAL_ENVELOPE');
    expect(cargo.visualProfile.assetKey).toBe('cargo_crate');
  });

  test('explicit supported-weight limit is a real carrying hard constraint', () => {
    const lowerCargo = normalizeCargoPhysicalProfile({
      cargoId: 'LOWER', name: '纸箱', length: 1000, width: 1000, height: 500, weight: 100,
      quantity: 1, packagingType: 'CARTON', maxStackLayers: 3, maximumSupportedWeightKg: 50
    });
    const upperCargo = normalizeCargoPhysicalProfile({
      cargoId: 'UPPER', name: '木箱', length: 1000, width: 1000, height: 500, weight: 80,
      quantity: 1, packagingType: 'WOOD_CRATE', maxStackLayers: 2
    });
    const placements = [
      { ...lowerCargo, cargoId: 'LOWER_1', sourceCargoId: 'LOWER', x: 0, y: 0, z: 0, l: 1000, w: 1000, h: 500, stackLevel: 1 },
      { ...upperCargo, cargoId: 'UPPER_1', sourceCargoId: 'UPPER', x: 0, y: 500, z: 0, l: 1000, w: 1000, h: 500, stackLevel: 2 }
    ];
    const result = new PlanValidator().validate({
      placements,
      cargoList: [lowerCargo, upperCargo],
      container: { innerLength: 3000, innerWidth: 2000, innerHeight: 2500, maxWeight: 26000 }
    });
    expect(result.checks.carrying).toBe(false);
    expect(result.violations.some((entry) => entry.code === 'CARRYING' && entry.evidence.capacity === 50)).toBe(true);
  });
});
