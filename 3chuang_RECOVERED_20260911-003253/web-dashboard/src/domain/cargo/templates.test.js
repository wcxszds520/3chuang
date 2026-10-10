import { describe, expect, it } from 'vitest';
import { CARGO_TEMPLATES, cargoFromTemplate, getCargoTemplate } from './templates.js';
import { validateCargo } from './cargo.js';

describe('cargo templates', () => {
  it('ships the complete supported workflow template catalog', () => {
    expect(CARGO_TEMPLATES.map((template) => template.id)).toEqual([
      'air-conditioner',
      'accessory-carton',
      'carton',
      'wood-pallet',
      'fragile-panel',
      'heavy-equipment',
      'air-fryer',
      'electric-kettle',
      'laptop',
      'folding-chair',
      'custom'
    ]);
  });

  it('keeps every preset template valid and leaves custom identity explicit', () => {
    for (const template of CARGO_TEMPLATES.filter(({ id }) => id !== 'custom')) {
      expect(validateCargo(cargoFromTemplate(template.id)).valid, template.id).toBe(true);
    }
    const custom = validateCargo(cargoFromTemplate('custom'));
    expect(custom.errors).toMatchObject({ name: '必填', sku: '必填' });
  });

  it('falls back to custom and clones mutable notes', () => {
    expect(getCargoTemplate('unknown').id).toBe('custom');
    const first = cargoFromTemplate('air-conditioner');
    const second = cargoFromTemplate('air-conditioner');
    expect(first.riskNotes).not.toBe(second.riskNotes);
  });
});
