import { describe, expect, it } from 'vitest';
import {
  cargoDataCompleteness,
  cargoFingerprint,
  cargoTotals,
  normalizeCargo,
  validateCargo
} from './cargo.js';

const VALID = {
  cargoId: 'cargo_1',
  name: ' 标准箱 ',
  sku: ' SKU-01 ',
  length: 500,
  width: 400,
  height: 300,
  weight: 12.5,
  quantity: 4,
  destinationPort: 'Hamburg',
  packagingType: 'carton',
  stackable: true,
  maxStackLayers: 4
};

describe('cargo domain', () => {
  it('normalizes text and derives handling flags without mutating the input', () => {
    const input = { ...VALID, weight: '25', riskNotes: ['轻放'] };
    const normalized = normalizeCargo(input);

    expect(normalized).toMatchObject({
      cargoId: 'cargo_1',
      name: '标准箱',
      sku: 'SKU-01',
      weight: 25,
      heavy: true,
      handlingMethod: 'forklift'
    });
    expect(normalized.riskNotes).not.toBe(input.riskNotes);
  });

  it('rejects fractional quantities instead of silently truncating them', () => {
    const result = validateCargo({ ...VALID, quantity: 1.5 });

    expect(result.valid).toBe(false);
    expect(result.errors.quantity).toBe('必须为正整数');
  });

  it('enforces the single-layer invariant for non-stackable cargo', () => {
    const result = validateCargo({ ...VALID, stackable: false, maxStackLayers: 3 });

    expect(result.valid).toBe(false);
    expect(result.errors.maxStackLayers).toContain('不可堆叠');
  });

  it('computes totals and completeness from the current order only', () => {
    const list = [normalizeCargo(VALID), normalizeCargo({ ...VALID, cargoId: 'cargo_2', quantity: 2, weight: 5 })];

    expect(cargoTotals(list)).toEqual({
      pieces: 6,
      weight: 60,
      volume: 360_000_000
    });
    expect(cargoDataCompleteness(list)).toEqual({ percent: 100, missing: 0, total: 16 });
  });

  it('creates a stable fingerprint that changes with plan-relevant data', () => {
    const list = [normalizeCargo(VALID)];

    expect(cargoFingerprint(list, '40HQ')).toBe(cargoFingerprint(list, '40HQ'));
    expect(cargoFingerprint(list, '40HQ')).not.toBe(cargoFingerprint([{ ...list[0], quantity: 5 }], '40HQ'));
    expect(cargoFingerprint(list, '40HQ')).not.toBe(cargoFingerprint(list, '20GP'));
  });
});
