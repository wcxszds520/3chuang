'use strict';

const { attemptLoadBalanceAwareLocalRepair, candidatePairs } = require('../../services/packing/LoadBalanceAwareLocalRepair');

function candidate(placements, cog = 8.2) {
  return {
    loadedCargo: placements,
    validator: { hardViolationCount: 0 }, operationFeasibility: { blockedCount: 0 },
    portAccessibility: { blockedCount: 0, rehandleCount: 0, calls: [] }, mandatoryGateViolationCount: 0,
    metrics: { stability: { invalidCount: 0 }, loadedCount: placements.length },
    loadDistribution: { centreOfGravity: { guidanceStatus: 'PARTICULAR_CIRCUMSTANCES_REVIEW', longitudinalOffsetPercent: cog, lateralOffsetPercent: 0 } },
    voidJustification: { unexplainedVoidVolume: 0 }, layoutQuality: { internalVoidVolume: 0, lowFillInteriorSliceCount: 0 }
  };
}

describe('LoadBalanceAwareLocalRepair', () => {
  const placements = [
    { cargoId: 'heavy', x: 9000, y: 0, z: 0, l: 600, w: 500, h: 500, weight: 200, portSequence: 1, packagingType: 'WOOD_CRATE', handlingMethod: 'forklift' },
    { cargoId: 'light', x: 2000, y: 0, z: 0, l: 600, w: 500, h: 500, weight: 20, portSequence: 1, packagingType: 'WOOD_CRATE', handlingMethod: 'forklift' }
  ];

  test('only proposes same-port, same-compatible-group, equal-envelope swaps', () => {
    expect(candidatePairs(placements)).toHaveLength(1);
    expect(candidatePairs([{ ...placements[0] }, { ...placements[1], portSequence: 2 }])).toHaveLength(0);
    expect(candidatePairs([{ ...placements[0] }, { ...placements[1], l: 700 }])).toHaveLength(0);
  });

  test('promotes a real CoG improvement only after all higher gates are preserved', () => {
    const base = candidate(placements, 8.2);
    const result = attemptLoadBalanceAwareLocalRepair({ baseCandidate: base, evaluate: (moved) => candidate(moved, 4.8) });
    expect(result.promoted).toBe(true);
    expect(result.bestCogPercent).toBe(4.8);
    expect(result.candidate.loadedCargo.find((item) => item.cargoId === 'heavy').x).toBe(2000);
  });
});
