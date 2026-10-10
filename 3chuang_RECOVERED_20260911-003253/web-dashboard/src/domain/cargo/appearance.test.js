import { describe, expect, it } from 'vitest';
import { classifyCargoAppearance } from './appearance.js';

describe('cargo visual classification', () => {
  it.each([
    [{ packagingType: 'CARTON' }, 'carton'],
    [{ packagingType: 'WOOD_CRATE' }, 'crate'],
    [{ packagingType: 'PALLETIZED_CARTONS' }, 'palletized'],
    [{ packagingType: 'WRAPPED_PALLET' }, 'wrapped'],
    [{ packagingType: 'EQUIPMENT_CASE' }, 'equipment_case'],
    [{ packagingType: 'DRUM' }, 'drum'],
    [{ packagingType: 'FIBC_BAG' }, 'fibc'],
    [{ packagingType: 'GENERIC' }, 'generic'],
    [{ packagingType: 'accessory' }, 'carton'],
    [{ packagingType: 'equipment' }, 'equipment_case'],
    [{ wooden: true }, 'crate'],
    [{ fragile: true }, 'generic'],
    [{ heavy: true }, 'generic'],
    [{ stackable: false }, 'generic']
  ])('maps stable attributes to a deterministic appearance', (cargo, expected) => {
    expect(classifyCargoAppearance(cargo).key).toBe(expected);
    expect(classifyCargoAppearance(cargo)).toBe(classifyCargoAppearance({ ...cargo }));
  });
});
