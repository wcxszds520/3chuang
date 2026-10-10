import { describe, expect, it } from 'vitest';
import {
  aabbIntersects,
  buildCargoPath,
  deriveContainerGeometry,
  fitsDoorOpening,
  isTargetInside,
  validateCargoPath,
  validateTarget
} from './geometry.js';

const container = { typeId: 'TEST', innerLength: 6000, innerWidth: 2400, innerHeight: 2600 };
const cargo = { cargoId: 'A', sku: 'A', x: 500, y: 0, z: 600, l: 900, w: 700, h: 800 };

describe('operation geometry', () => {
  it('uses the recorded door opening rather than the taller interior envelope',()=>{
    const box={l:1200,w:1000,h:2350};
    expect(fitsDoorOpening(box,{...container,innerHeight:2698,doorHeight:2280,doorWidth:2340}).valid).toBe(false);
    const geometry=deriveContainerGeometry({...container,innerWidth:2352,doorWidth:2340,doorHeight:2280});
    expect(geometry.doorOpening.minZ).toBe(36);
    expect(geometry.doorOpening.maxZ).toBe(2316);
  });
  it('derives the only door at the higher X coordinate', () => {
    const geometry = deriveContainerGeometry(container);
    expect(geometry.doorPlaneX).toBe(6000);
    expect(geometry.doorNormal).toEqual({ x: 1, y: 0, z: 0 });
    expect(geometry.inside.minX).toBe(0);
  });

  it('checks oriented dimensions against the usable door opening', () => {
    expect(fitsDoorOpening(cargo, container).valid).toBe(true);
    expect(fitsDoorOpening({ ...cargo, w: 2390 }, container).valid).toBe(false);
    expect(fitsDoorOpening({ ...cargo, h: 2580 }, container).valid).toBe(false);
  });

  it('validates internal bounds and target collisions without moving coordinates', () => {
    expect(isTargetInside(cargo, container)).toBe(true);
    expect(isTargetInside({ ...cargo, x: -5 }, container)).toBe(false);
    const blocker = { ...cargo, cargoId: 'B', x: 1000 };
    expect(aabbIntersects({ minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 10 }, { minX: 10, maxX: 20, minY: 0, maxY: 10, minZ: 0, maxZ: 10 })).toBe(false);
    expect(validateTarget(cargo, container, [blocker]).reasons[0].code).toBe('TARGET_COLLIDES_CARGO');
    expect(cargo.x).toBe(500);
  });

  it('accepts a segmented high-X door path and rejects a side-wall shortcut', () => {
    const path = buildCargoPath(cargo, container, 0);
    expect(validateCargoPath(cargo, container, [], path.entry).valid).toBe(true);
    const sideEntry = [
      { x: 7000, y: 100, z: -500 },
      { x: 5000, y: 100, z: -500 },
      { x: cargo.x, y: cargo.y, z: cargo.z }
    ];
    const invalid = validateCargoPath(cargo, container, [], sideEntry);
    expect(invalid.valid).toBe(false);
    expect(invalid.reasons.some((reason) => reason.code === 'PATH_HITS_SIDE_WALL')).toBe(true);
  });

  it('uses a door-safe lateral coordinate before shifting to a wall-adjacent target inside', () => {
    const wallAdjacent = { ...cargo, z: 0 };
    const path = buildCargoPath(wallAdjacent, container, 0);
    expect(path.doorApproach.z).toBeGreaterThan(0);
    expect(path.target.z).toBe(0);
    expect(validateCargoPath(wallAdjacent, container, [], path.entry).valid).toBe(true);
  });

  it('detects an already-loaded obstacle along the entry path', () => {
    const path = buildCargoPath(cargo, container, 0);
    const blocker = { ...cargo, cargoId: 'B', x: 3000, y: path.travelY, z: cargo.z };
    const result = validateCargoPath(cargo, container, [blocker], path.entry);
    expect(result.reasons.some((reason) => reason.code === 'PATH_COLLIDES_CARGO')).toBe(true);
  });
});
