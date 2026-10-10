import { describe, expect, it } from 'vitest';
import { groupOperationQueue } from './queueGroups.js';

describe('groupOperationQueue', () => {
  it('groups consecutive SKU/batch runs without changing the machine queue order', () => {
    const queue = [
      { cargoId: 'a-1', sku: 'SKU-A', packagingType: 'carton', portSequence: 2, batchId: 'B-2' },
      { cargoId: 'a-2', sku: 'SKU-A', packagingType: 'carton', portSequence: 2, batchId: 'B-2' },
      { cargoId: 'b-1', sku: 'SKU-B', packagingType: 'wooden', portSequence: 1, batchId: 'B-1' },
      { cargoId: 'a-3', sku: 'SKU-A', packagingType: 'carton', portSequence: 2, batchId: 'B-2' }
    ];

    const groups = groupOperationQueue(queue, {
      currentIndex: 1,
      completedIndices: [0],
      blockedIndex: 2
    });

    expect(groups).toHaveLength(3);
    expect(groups.flatMap((group) => group.items.map(({ index }) => index))).toEqual([0, 1, 2, 3]);
    expect(groups[0]).toMatchObject({
      sku: 'SKU-A',
      name: 'SKU-A',
      packagingLabel: '纸箱',
      portSequence: 2,
      destinationPort: '未指定港口',
      batchId: 'B-2',
      handlingMethod: 'forklift',
      targetZone: '箱内深区',
      firstIndex: 0,
      completedCount: 1,
      isCurrent: true,
      isBlocked: false
    });
    expect(groups[1]).toMatchObject({ isCurrent: false, isBlocked: true, firstIndex: 2 });
    expect(new Set(groups.map((group) => group.key)).size).toBe(groups.length);
  });
});
