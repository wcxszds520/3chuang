import { describe, expect, it } from 'vitest';
import { cargoFingerprint, cargoTotals, normalizeCargo } from './cargo.js';
import {
  INITIAL_CARGO,
  INITIAL_DATASET_ID,
  INITIAL_ORDER,
  summarizeInitialDataset
} from './initialDataset.js';

describe('initial cargo dataset', () => {
  it('is deterministic and covers the hard business dimensions', () => {
    const first = INITIAL_CARGO.map(normalizeCargo);
    const second = INITIAL_CARGO.map(normalizeCargo);
    const summary = summarizeInitialDataset(first);

    expect(INITIAL_DATASET_ID).toBe('portcube-initial-v1');
    expect(INITIAL_ORDER.orderNo).toBe('NB2026-0824-001');
    expect(first).toEqual(second);
    expect(summary.skuCount).toBeGreaterThanOrEqual(8);
    expect(summary.skuCount).toBeLessThanOrEqual(12);
    expect(summary.destinationPortCount).toBeGreaterThanOrEqual(3);
    expect(summary.batchCount).toBeGreaterThanOrEqual(2);
    expect(summary.attributeCoverage.length).toBeGreaterThanOrEqual(6);
    expect(summary.manualSkus.length).toBeGreaterThanOrEqual(2);
    expect(summary.forkliftSkus.length).toBeGreaterThanOrEqual(2);
    expect(summary.totalPieces).toBeGreaterThan(100);
    expect(summary.totalPieces).toBe(cargoTotals(first).pieces);
    expect(summary.fingerprint).toBe(cargoFingerprint(first, '40HQ'));
    expect(summary).toMatchObject({ skuCount: 10, totalPieces: 212, totalWeightKg: 8623 });
    // Canonical cargo serialization now includes the existing business fields.
    // The underlying legacy fixture remains 10 SKU / 212 pieces / 8623 kg above.
    expect(summary.fingerprint).toBe('203c641e');
  });

  it('uses stable port, batch, source and handling fields on every SKU', () => {
    for (const cargo of INITIAL_CARGO) {
      expect(cargo.destinationPort).toMatch(/^(Hamburg|Rotterdam|Antwerp)$/);
      expect(cargo.portSequence).toBeGreaterThanOrEqual(1);
      expect(cargo.portSequence).toBeLessThanOrEqual(3);
      expect(cargo.batchId).toMatch(/^BATCH-/);
      expect(cargo.batchLabel).toContain('批次');
      expect(['manual', 'forklift']).toContain(cargo.handlingMethod);
      expect(cargo.source).toBe('demo-dataset-a');
      expect(cargo.dataClassification).toBe('DEMO_DATA');
    }
  });

  it('changes the plan fingerprint when batch or handling semantics change', () => {
    const normalized = INITIAL_CARGO.map(normalizeCargo);
    const original = cargoFingerprint(normalized, '40HQ');

    expect(cargoFingerprint(normalized.map((cargo, index) => index === 0 ? { ...cargo, batchId: 'BATCH-CHANGED' } : cargo), '40HQ')).not.toBe(original);
    expect(cargoFingerprint(normalized.map((cargo, index) => index === 0 ? { ...cargo, handlingMethod: 'forklift' } : cargo), '40HQ')).not.toBe(original);
  });
});
