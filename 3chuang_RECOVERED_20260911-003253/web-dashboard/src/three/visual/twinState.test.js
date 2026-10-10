import { describe, expect, it } from 'vitest';
import { createTwinObservation, latestObservation, revisionGhosts } from './twinState.js';
import { originalDimensionsM, placementAxisMap } from '../cargo/PrecisionCargoFactory.js';
import { generateLocalPreview } from '../../domain/container/localPreview.js';

describe('separate preview, plan, simulation and reported observation', () => {
  it('renders the actual preview orientation without inventing placement metadata', () => {
    const cargo = { cargoId: 'A', length: 500, width: 900, height: 400, quantity: 1, weight: 5, canRotate: true, stackable: false };
    const preview = generateLocalPreview([cargo], { typeId: 'TEST', innerLength: 1200, innerWidth: 600, innerHeight: 800 });
    const item = preview.loadedCargo[0];
    const before = JSON.stringify(preview);
    expect(item.algorithmMeta.orientation).toBe('YXZ');
    expect(originalDimensionsM(item)).toEqual([.5, .9, .4]);
    expect(placementAxisMap(item)).toEqual({ containerX: 'W', containerY: 'H', containerZ: 'L' });
    expect(item.orientationId).toBeUndefined();
    expect(placementAxisMap({ ...item, orientationId: 'LWH', axisMap: { containerX: 'L', containerY: 'H', containerZ: 'W' } })).toEqual({ containerX: 'W', containerY: 'H', containerZ: 'L' });
    expect(JSON.stringify(preview)).toBe(before);
    expect(() => placementAxisMap({ ...item, algorithmMeta: { orientation: 'YXZ', source: 'backend' } })).toThrow();
  });
  it('requires explicit evidence and never accepts a simulated observation', () => {
    const input = { cargoId: 'A', planId: 'P1', source: 'MANUAL', operator: '仓库记录人', note: '扫码与箱签核对', at: '2026-09-22T05:00:00Z' };
    expect(() => createTwinObservation({ ...input, source: 'SIMULATED' })).toThrow();
    expect(() => createTwinObservation({ ...input, operator: '' })).toThrow();
    expect(() => createTwinObservation({ ...input, source: 'MEASUREMENT', measuredPosition: { x: '', y: 0, z: 0 } })).toThrow();
    const observation = createTwinObservation(input);
    expect(observation.status).toBe('OBSERVED');
    expect(observation.measuredPosition).toBeNull();
    expect(latestObservation([observation], 'P2', 'A')).toBeNull();
    expect(latestObservation([observation], 'P1', 'A')).toEqual(observation);
  });
  it('ghosts removed and changed old positions, preserving solid current data', () => {
    const before = { cargoId: 'A', x: 100, y: 0, z: 50, l: 500, w: 600, h: 700 };
    const after = { ...before, x: 250 };
    const diff = { entries: [{ cargoId: 'A', status: 'moved', before, after }, { cargoId: 'B', status: 'unchanged', before, after }] };
    expect(revisionGhosts(diff)).toHaveLength(1);
    expect(revisionGhosts(diff)[0].position).toEqual(before);
    expect(after.x).toBe(250);
  });
});
