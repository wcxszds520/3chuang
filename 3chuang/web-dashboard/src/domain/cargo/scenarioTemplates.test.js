import { describe, expect, it } from 'vitest';
import { validateCargo } from './cargo.js';
import { getScenarioTemplate, summarizeScenario } from './scenarioTemplates.js';

describe('competition demo datasets', () => {
  it('marks Dataset A as demo data and keeps the 212-piece main flow', () => {
    const dataset = getScenarioTemplate('competition-a');
    const summary = summarizeScenario(dataset.id);

    expect(dataset.dataClassification).toBe('DEMO_DATA');
    expect(summary.totalPieces).toBe(212);
    expect(summary.skuCount).toBe(10);
    expect(summary.destinationPortCount).toBe(3);
    expect(dataset.items.every((item) => item.dataClassification === 'DEMO_DATA')).toBe(true);
  });

  it('keeps Dataset B constraint fields explicit instead of inferring them', () => {
    const dataset = getScenarioTemplate('competition-b');
    const summary = summarizeScenario(dataset.id);

    expect(dataset.dataClassification).toBe('DEMO_DATA');
    expect(summary.totalPieces).toBe(69);
    expect(summary.skuCount).toBe(7);
    expect(dataset.items.some((item) => item.canInvert === false)).toBe(true);
    expect(dataset.items.some((item) => item.fragile)).toBe(true);
    expect(dataset.items.some((item) => item.stackable === false)).toBe(true);
    expect(dataset.items.some((item) => item.heavy)).toBe(true);
    expect(new Set(dataset.items.map((item) => item.destinationPort)).size).toBeGreaterThan(1);
  });

  it('makes Dataset C invalid by construction so generation must be blocked', () => {
    const dataset = getScenarioTemplate('competition-c');
    const invalid = dataset.items.filter((item) => !validateCargo(item).valid);

    expect(dataset.dataClassification).toBe('DEMO_DATA');
    expect(invalid).toHaveLength(dataset.items.length);
    const errors = invalid.map((item) => validateCargo(item).errors);
    expect(errors.some((entry) => entry.width === '必须大于 0')).toBe(true);
    expect(errors.some((entry) => entry.weight === '必须大于 0')).toBe(true);
    expect(errors.some((entry) => entry.quantity === '必须大于 0')).toBe(true);
  });
});
