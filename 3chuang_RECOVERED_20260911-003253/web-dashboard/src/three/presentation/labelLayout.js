const DEFAULT_GAP = 8;
const DEFAULT_EDGE = 12;

export function layoutProjectedLabels(labels = [], options = {}) {
  const width = Math.max(0, Number(options.width || 0));
  const height = Math.max(0, Number(options.height || 0));
  const gap = Math.max(0, Number(options.gap ?? DEFAULT_GAP));
  const edge = Math.max(0, Number(options.edge ?? DEFAULT_EDGE));
  const insets = options.insets || {};
  const safe = {
    left: Math.max(edge, Number(insets.left ?? edge)),
    top: Math.max(edge, Number(insets.top ?? edge)),
    right: Math.max(edge, Number(insets.right ?? edge)),
    bottom: Math.max(edge, Number(insets.bottom ?? edge))
  };
  const safeWidth = Math.max(0, width - safe.left - safe.right);
  const safeHeight = Math.max(0, height - safe.top - safe.bottom);
  const placed = [];
  const results = new Map();

  labels
    .map((label, index) => ({ ...label, index, priority: Number(label.priority ?? labels.length - index) }))
    .sort((left, right) => right.priority - left.priority || left.index - right.index)
    .forEach((label) => {
      const labelWidth = Math.max(1, Number(label.width || 1));
      const labelHeight = Math.max(1, Number(label.height || 1));
      const base = {
        ...label,
        width: labelWidth,
        height: labelHeight,
        scale: Number(label.scale || 1)
      };
      if (labelWidth > safeWidth || labelHeight > safeHeight) {
        results.set(label.index, { ...base, x: safe.left, y: safe.top, hidden: true });
        return;
      }

      const desiredX = clamp(Number(label.x || 0) - labelWidth / 2, safe.left, width - safe.right - labelWidth);
      const desiredY = clamp(Number(label.y || 0) - labelHeight / 2, safe.top, height - safe.bottom - labelHeight);
      const stepY = labelHeight + gap;
      const stepX = Math.max(labelWidth * 0.55, 24) + gap;
      const candidates = candidateOffsets(stepX, stepY, 6);
      let position = null;

      for (const [offsetX, offsetY] of candidates) {
        const candidate = {
          x: clamp(desiredX + offsetX, safe.left, width - safe.right - labelWidth),
          y: clamp(desiredY + offsetY, safe.top, height - safe.bottom - labelHeight),
          width: labelWidth,
          height: labelHeight
        };
        if (!placed.some((other) => overlaps(candidate, other, gap))) {
          position = candidate;
          break;
        }
      }

      const result = position
        ? { ...base, x: position.x, y: position.y, hidden: false }
        : { ...base, x: desiredX, y: desiredY, hidden: true };
      if (!result.hidden) placed.push(result);
      results.set(label.index, result);
    });

  return labels.map((_label, index) => {
    const { index: _index, priority: _priority, ...result } = results.get(index);
    return result;
  });
}

function candidateOffsets(stepX, stepY, rings) {
  const offsets = [[0, 0]];
  for (let ring = 1; ring <= rings; ring += 1) {
    offsets.push(
      [0, -stepY * ring],
      [0, stepY * ring],
      [-stepX * ring, 0],
      [stepX * ring, 0],
      [-stepX * ring, -stepY * ring],
      [stepX * ring, stepY * ring]
    );
  }
  return offsets;
}

function overlaps(left, right, gap) {
  return left.x < right.x + right.width + gap
    && left.x + left.width + gap > right.x
    && left.y < right.y + right.height + gap
    && left.y + left.height + gap > right.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
