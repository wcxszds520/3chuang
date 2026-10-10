import { describe, expect, it } from 'vitest';
import { buildDeterministicSpaceCells, buildVisualizationContext, calculateBalance, visualizationColor, weightColor } from './visualizationModes.js';

describe('visualization analytics', () => {
  const container = { innerLength: 1000, innerWidth: 400, innerHeight: 400 };
  const items = [
    { cargoId: 'A', x: 0, y: 0, z: 0, l: 500, w: 200, h: 200, weight: 10, portSequence: 1 },
    { cargoId: 'B', x: 500, y: 0, z: 200, l: 500, w: 200, h: 200, weight: 30, portSequence: 2, dangerous: true }
  ];

  it('derives weight ranges and port colors from the actual placements', () => {
    const context = buildVisualizationContext(items, container);
    expect(context).toMatchObject({ weightMin: 10, weightMax: 30 });
    expect(visualizationColor(items[0], 'port', context)).not.toBe(visualizationColor(items[1], 'port', context));
    expect(weightColor(10, 10, 30)).not.toBe(weightColor(30, 10, 30));
  });

  it('calculates cargo center and signed offsets without fixed scores', () => {
    const balance = calculateBalance(items, container);
    expect(balance.totalWeight).toBe(40);
    expect(balance.cargoCenter.x).toBe(625);
    expect(balance.offset.longitudinalPercent).toBe(25);
  });

  it('builds repeatable empty-space cells solely from placements', () => {
    const first = buildDeterministicSpaceCells(items, container, { x: 2, y: 2, z: 2 });
    const second = buildDeterministicSpaceCells(items, container, { x: 2, y: 2, z: 2 });
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThan(8);
  });
});
