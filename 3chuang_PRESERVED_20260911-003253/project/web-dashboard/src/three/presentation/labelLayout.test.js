import { describe, expect, it } from 'vitest';
import { layoutProjectedLabels } from './labelLayout.js';

describe('layoutProjectedLabels', () => {
  it('keeps visible labels in bounds and separates overlapping projections', () => {
    const labels = Array.from({ length: 4 }, (_, index) => ({
      id: `label-${index}`,
      x: 160,
      y: 100,
      width: 104,
      height: 28,
      priority: 4 - index
    }));
    const result = layoutProjectedLabels(labels, { width: 320, height: 210, gap: 7, edge: 10 });
    const visible = result.filter((label) => !label.hidden);

    expect(visible).toHaveLength(4);
    for (const label of visible) {
      expect(label.x).toBeGreaterThanOrEqual(10);
      expect(label.y).toBeGreaterThanOrEqual(10);
      expect(label.x + label.width).toBeLessThanOrEqual(310);
      expect(label.y + label.height).toBeLessThanOrEqual(200);
    }
    for (let left = 0; left < visible.length; left += 1) {
      for (let right = left + 1; right < visible.length; right += 1) {
        expect(rectanglesOverlap(visible[left], visible[right], 7)).toBe(false);
      }
    }
  });

  it('hides a label that cannot fit inside the safe viewport', () => {
    const [label] = layoutProjectedLabels([
      { id: 'oversized', x: 10, y: 10, width: 500, height: 300 }
    ], { width: 320, height: 200, edge: 12 });

    expect(label.hidden).toBe(true);
  });
});

function rectanglesOverlap(left, right, gap) {
  return left.x < right.x + right.width + gap
    && left.x + left.width + gap > right.x
    && left.y < right.y + right.height + gap
    && left.y + left.height + gap > right.y;
}
