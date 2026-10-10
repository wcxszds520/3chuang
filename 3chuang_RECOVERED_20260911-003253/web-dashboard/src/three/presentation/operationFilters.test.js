import { describe, expect, it } from 'vitest';
import {
  buildOperationFilterOptions,
  createOperationFilters,
  filterOperationGroups,
  matchesOperationFilters,
  operationItemRisk,
  operationItemState
} from './operationFilters.js';

const queue = [
  { cargoId: 'a', sku: 'SKU-A', batchId: 'B-1', destinationPort: 'Hamburg', portSequence: 1, handlingMethod: 'manual', fragile: true },
  { cargoId: 'b', sku: 'SKU-B', batchId: 'B-2', destinationPort: 'Rotterdam', portSequence: 2, handlingMethod: 'forklift', heavy: true },
  { cargoId: 'c', sku: 'SKU-C', batchId: 'B-2', destinationPort: 'Rotterdam', portSequence: 2, handlingMethod: 'forklift', stackable: false }
];

describe('operation filters', () => {
  it('supports all seven dimensions without changing original queue indices', () => {
    const context = { currentIndex: 1, completedIndices: new Set([0]), blockedIndex: -1 };
    const filters = createOperationFilters({ batch: 'B-2', port: 'Rotterdam', sequence: '2', actor: 'forklift', state: 'current', risk: 'heavy', sku: 'SKU-B' });
    expect(queue.map((item, index) => matchesOperationFilters(item, index, filters, context))).toEqual([false, true, false]);
    const groups = [{ key: 'one', items: queue.map((item, index) => ({ item, index })), firstIndex: 0, completedCount: 1 }];
    expect(filterOperationGroups(groups, filters, context)[0].items.map(({ index }) => index)).toEqual([1]);
  });

  it('classifies visible state and risk deterministically', () => {
    expect(operationItemState(0, { completedIndices: [0], currentIndex: 1 })).toBe('completed');
    expect(operationItemState(1, { completedIndices: [0], currentIndex: 1 })).toBe('current');
    expect(operationItemState(2, { blockedIndex: 2 })).toBe('blocked');
    expect(operationItemRisk(queue[0])).toBe('fragile');
    expect(operationItemRisk(queue[1])).toBe('heavy');
    expect(operationItemRisk(queue[2])).toBe('nonstackable');
  });

  it('builds truthful options from the queue', () => {
    expect(buildOperationFilterOptions(queue)).toMatchObject({
      sku: ['SKU-A', 'SKU-B', 'SKU-C'],
      batch: ['B-1', 'B-2'],
      port: ['Hamburg', 'Rotterdam'],
      sequence: ['1', '2'],
      actor: ['manual', 'forklift']
    });
  });
});

