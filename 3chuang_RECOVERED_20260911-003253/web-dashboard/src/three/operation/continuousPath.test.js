import { describe, expect, it } from 'vitest';
import { sweptCargoIntersects, validateCargoPath } from './geometry.js';

describe('continuous operation envelope checks', () => {
  const container = { innerLength: 1000, innerWidth: 1000, innerHeight: 1000 };
  const cargo = { cargoId: 'moving', x: 0, y: 10, z: 100, l: 10, w: 100, h: 100 };
  it('detects an obstacle missed by coarse 100 mm samples', () => {
    const start = { x: 1000, y: 10, z: 100 }, end = { x: 0, y: 10, z: 100 };
    const obstacle = { cargoId: 'thin', x: 945, y: 10, z: 100, l: 10, w: 100, h: 100 };
    expect(sweptCargoIntersects(cargo, start, end, obstacle)).toBe(true);
    const result = validateCargoPath(cargo, container, [obstacle], [start, end], { sampleStep: 100 });
    expect(result.reasons.some(reason => reason.code === 'PATH_COLLIDES_CARGO')).toBe(true);
  });
  it('permits a diagonal that does not intersect in time despite overlapping union bounds', () => {
    const start = { x: 900, y: 10, z: 0 }, end = { x: 0, y: 10, z: 900 };
    expect(sweptCargoIntersects(cargo, start, end, { x: 800, y: 10, z: 800, l: 50, w: 50, h: 100 })).toBe(false);
  });
  it('checks the door crossing between sampled points for a thin cargo', () => {
    const item = { ...cargo, x: 800, z: 0 };
    const path = [{ x: 1045, y: 10, z: 0 }, { x: 845, y: 10, z: 0 }, { x: 800, y: 10, z: 50 }];
    expect(validateCargoPath(item, container, [], path, { sampleStep: 1000 }).reasons.some(reason => reason.code === 'PATH_HITS_DOOR_FRAME')).toBe(true);
  });
});
