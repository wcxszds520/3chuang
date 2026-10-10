import { describe, expect, it } from 'vitest';
import { buildActivePlanViewModel, formatPlanMetric } from './activePlanViewModel.js';

const plan = {
  planId: 'PLAN-212',
  sourceCode: 'BACKEND_SOLVED',
  containerInfo: { typeId: '40HQ', maxWeight: 28_800 },
  loadedCargo: Array.from({ length: 212 }, (_, index) => ({ cargoId: `C-${index}`, weight: 10 })),
  unloadedCargo: [],
  totalCargoInput: 212,
  totalCargoCount: 212,
  totalWeight: 8623,
  spaceUtilization: 79.43,
  cogOffset: { lateral: 0, longitudinal: 3.5 },
  metrics: { algorithm_id: 'hybrid-v2.3', strategy_used: 'space' },
  stability: { status: 'PASS' },
  layoutQuality: { internalVoidVolume: 3_700_000_000, lowFillInteriorSliceCount: 6, largestContiguousReserve: 8_500_000_000 },
  securing: { status: 'SECURING_REQUIRED', securingRequiredCount: 18, securingPlaneCount: 2 },
  operationFeasibility: { operationPathPass: true, blockedCount: 0 },
  constraintMeta: { lifoCompliant: true }
};

describe('active plan view model', () => {
  it('normalizes every competition fact from the same backend plan', () => {
    const model = buildActivePlanViewModel({
      session: { planStatus: 'ready', selectedStrategy: 'SPACE', cargo: [] },
      plan,
      container: plan.containerInfo
    });
    expect(model).toMatchObject({
      isReady: true,
      source: 'BACKEND_SOLVED',
      loadedCount: 212,
      inputCount: 212,
      unloadedCount: 0,
      utilization: 79.43,
      totalWeight: 8623,
      lateralCog: 0,
      longitudinalCog: 3.5,
      algorithm: 'hybrid-v2.3',
      strategy: 'SPACE',
      stability: 'PASS',
      geometricStability: 'PASS',
      securingStatus: 'SECURING_REQUIRED',
      securingRequiredCount: 18,
      operationFeasible: true,
      operationBlockedCount: 0,
      internalVoidVolume: 3_700_000_000,
      largestContiguousReserve: 8_500_000_000,
      lifoCompliant: true
    });
  });

  it('uses null, never a false zero, while a plan is loading', () => {
    const model = buildActivePlanViewModel({
      session: { planStatus: 'loading', selectedStrategy: 'SPACE', cargo: [] },
      plan,
      container: plan.containerInfo
    });
    expect(model.isReady).toBe(false);
    expect(model.loadedCount).toBeNull();
    expect(model.utilization).toBeNull();
    expect(model.totalWeight).toBeNull();
    expect(formatPlanMetric(model.loadedCount)).toBe('—');
  });

  it('preserves a real numeric zero', () => {
    expect(formatPlanMetric(0, { decimals: 1, suffix: '%' })).toBe('0.0%');
    expect(formatPlanMetric(undefined)).toBe('—');
  });
});
