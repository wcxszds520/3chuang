import { describe, expect, it } from 'vitest';
import { planQualityTuple, recommendStrategy } from './strategyRecommendation.js';

function plan(strategy, overrides = {}) {
  return {
    totalCargoInput: 212,
    totalCargoCount: 212,
    loadedCargo: Array.from({ length: 212 }, (_, index) => ({ cargoId: `${strategy}-${index}` })),
    validator: { hardViolationCount: 0, checks: { lifo: true, insertion: true } },
    stability: { status: 'STABLE', invalidCount: 0 },
    layoutQuality: { internalVoidVolume: 4_000, lowFillInteriorSliceCount: 6, largestContiguousReserve: 9_000 },
    securing: { status: 'SECURING_REQUIRED', fragmentedSecuringZones: 2, securingRequiredCount: 18 },
    operationFeasibility: { operationPathPass: true, blockedCount: 0 },
    loadDistribution: { centreOfGravity: { guidanceStatus: 'WITHIN_GENERAL_GUIDANCE', lateralOffsetPercent: 0, longitudinalOffsetPercent: 9 } },
    cogOffset: { lateral: 0, longitudinal: 9 },
    metrics: { strategy: strategy.toLowerCase(), loadedVolume: 100_000, operation: { totalCost: 10 }, solveMs: 100, cog: { withinPolicy: true } },
    ...overrides
  };
}

describe('strategy recommendation', () => {
  it('never recommends a blocked or outside-policy strategy over a safe plan', () => {
    const plans = {
      SPACE: plan('SPACE'),
      BALANCE: plan('BALANCE', { loadDistribution: { centreOfGravity: { guidanceStatus: 'OUTSIDE_GUIDANCE', lateralOffsetPercent: 0, longitudinalOffsetPercent: 1 } }, metrics: { strategy: 'balance', loadedVolume: 100_000, operation: { totalCost: 8 }, solveMs: 90, cog: { withinPolicy: false } }, cogOffset: { lateral: 0, longitudinal: 1 } }),
      OPERATION: plan('OPERATION', { operationFeasibility: { operationPathPass: false, blockedCount: 1 }, cogOffset: { lateral: 0, longitudinal: 1 } })
    };
    expect(recommendStrategy(plans)).toBe('SPACE');
    expect(planQualityTuple(plans.OPERATION)[1]).toBe(1);
    expect(planQualityTuple(plans.BALANCE)[7]).toBe(2);
  });

  it('prefers resolved securing and concentrated reserve before CoG and strategy cost', () => {
    const plans = {
      SPACE: plan('SPACE', { securing: { status: 'SECURING_UNRESOLVED', fragmentedSecuringZones: 7, securingRequiredCount: 25 } }),
      BALANCE: plan('BALANCE', { layoutQuality: { internalVoidVolume: 3_900, lowFillInteriorSliceCount: 5, largestContiguousReserve: 9_500 } }),
      OPERATION: plan('OPERATION', { layoutQuality: { internalVoidVolume: 4_100, lowFillInteriorSliceCount: 7, largestContiguousReserve: 8_500 }, cogOffset: { lateral: 0, longitudinal: 1 } })
    };
    expect(recommendStrategy(plans)).toBe('BALANCE');
  });

  it('uses runtime only after safety, CoG, operation, and layout tie', () => {
    const plans = {
      SPACE: plan('SPACE', { cogOffset: { lateral: 0, longitudinal: 10 } }),
      BALANCE: plan('BALANCE', { cogOffset: { lateral: 0, longitudinal: 5.6 }, metrics: { strategy: 'balance', loadedVolume: 100_000, operation: { totalCost: 9 }, solveMs: 120, cog: { withinPolicy: true } } }),
      OPERATION: plan('OPERATION', { cogOffset: { lateral: 0, longitudinal: 5.6 }, metrics: { strategy: 'operation', loadedVolume: 100_000, operation: { totalCost: 9 }, solveMs: 80, cog: { withinPolicy: true } } })
    };
    expect(recommendStrategy(plans)).toBe('OPERATION');
  });
});
