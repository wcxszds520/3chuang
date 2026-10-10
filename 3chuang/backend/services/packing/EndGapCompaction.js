'use strict';

const { calculateCoG } = require('./PlanMetrics');

// One bounded translation of the selected topology, not a new packing search.
// Keep the existing guidance class (5/10%) and all relative support relations.
// The caller must re-evaluate every gate before accepting the candidate.
function compactDeepEnd(placements, container, options = {}) {
  if (!placements.length) return null;
  const minX = Math.min(...placements.map(item => Number(item.x)));
  const cog = calculateCoG(placements, container);
  const offset = Math.max(cog.lateral, cog.longitudinal);
  const inheritedLimit = [5, 10].includes(options.guidanceLimitPercent) ? options.guidanceLimitPercent : null;
  if (minX < 1 || (!inheritedLimit && offset > 10.001)) return null;
  const limitPercent = inheritedLimit || (offset <= 5.001 ? 5 : 10);
  if (cog.lateral > limitPercent + 0.001) return null;
  const half = container.innerLength / 2;
  // Round toward the allowed interval, never across its boundary.
  const shiftX = Math.ceil(Math.max(-minX, half - container.innerLength * limitPercent / 100 - cog.x) * 1000) / 1000;
  if (shiftX >= -0.001) return null;
  const cargo = placements.map(item => ({
    ...item,
    x: Math.round((Number(item.x) + shiftX) * 1000) / 1000,
    algorithmMeta: { ...item.algorithmMeta, endGapCompactionShiftX: Number(item.algorithmMeta?.endGapCompactionShiftX || 0) + shiftX }
  }));
  return {
    placements: cargo,
    evidence: {
      model: 'SAME_CLASS_DEEP_END_COMPACTION_V2', normalization:cog.normalization, shiftX,
      previousDeepGapMm: minX, deepGapMm: Math.round((minX + shiftX) * 1000) / 1000,
      guidanceLimitPercent: limitPercent, previousLongitudinalOffsetPercent: cog.longitudinal,
      flushLongitudinalOffsetPercent: Math.abs(cog.x - minX - half) / container.innerLength * 100,
      scope: 'RIGID_TRANSLATION_ONLY',
      limitation: '保持相对布局，按原指导等级压实；空白转移到门端，总容积利用率不变。未证明其他重排方案均不可行。'
    }
  };
}

module.exports = { compactDeepEnd };
