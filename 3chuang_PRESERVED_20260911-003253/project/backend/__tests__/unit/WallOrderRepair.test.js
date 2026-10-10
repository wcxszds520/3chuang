const { reorderedWalls, attemptWallOrderRepair } = require('../../services/packing/WallOrderRepair');
const { calculateCoG } = require('../../services/packing/PlanMetrics');

describe('same-port wall rearrangement', () => {
  const container = { innerLength: 6500, innerWidth: 1000, innerHeight: 2000, maxWeight: 20000 };
  const cargo = [25, 50, 100, 25].flatMap((weight, wall) => [0, 1].map(layer => ({
    cargoId: `${wall}-${layer}`, x: 1000 + wall * 1000, y: layer * 400, z: 0,
    l: 1000, w: 1000, h: 400, weight, portSequence: wall < 2 ? 3 : 1
  })));
  function result(loadedCargo, blocked = 0) {
    const cog = calculateCoG(loadedCargo, container);
    return { loadedCargo, validator: { hardViolationCount: blocked }, operationFeasibility: { blockedCount: 0 },
      portAccessibility: { blockedCount: 0, rehandleCount: 0, calls: [] }, mandatoryGateViolationCount: 0,
      metrics: { loadedCount: loadedCargo.length, stability: { invalidCount: 0 } },
      loadDistribution: { centreOfGravity: { guidanceStatus: Math.max(cog.lateral, cog.longitudinal) <= 5.001 ? 'WITHIN_GENERAL_GUIDANCE' : 'PARTICULAR_CIRCUMSTANCES_REVIEW' } } };
  }
  test('moves whole supporting stacks and never exchanges discharge ports', () => {
    const before = JSON.stringify(cargo);
    const moved = reorderedWalls(cargo, 1).placements;
    for (let wall = 0; wall < 4; wall++) {
      const stack = moved.filter(c => c.cargoId.startsWith(`${wall}-`));
      expect(stack[0].x).toBe(stack[1].x);
      expect(stack.map(c => c.y)).toEqual([0, 400]);
    }
    expect(Math.max(...moved.filter(c => c.portSequence === 3).map(c => c.x + c.l)))
      .toBeLessThanOrEqual(Math.min(...moved.filter(c => c.portSequence === 1).map(c => c.x)));
    expect(JSON.stringify(cargo)).toBe(before);
  });
  test('reduces rear gap without relaxing the original five-percent guidance class', () => {
    const repaired = attemptWallOrderRepair({ baseCandidate: result(cargo), container, evaluate: items => result(items) });
    expect(repaired.promoted).toBe(true);
    expect(repaired.evidence.gapMm).toBeLessThan(1000);
    expect(calculateCoG(repaired.candidate.loadedCargo, container).longitudinal).toBeLessThanOrEqual(5);
  });
  test('rejects a visually tighter candidate when any higher gate worsens', () => {
    const repaired = attemptWallOrderRepair({ baseCandidate: result(cargo), container, evaluate: items => result(items, 1) });
    expect(repaired.promoted).toBe(false);
    expect(repaired.candidate).toBeNull();
  });
  test('does not trade a smaller rear gap for larger unexplained interior cavities', () => {
    const repaired = attemptWallOrderRepair({ baseCandidate: result(cargo), container,
      evaluate: items => ({ ...result(items), voidJustification: { unexplainedVoidVolume: 2e9 } }) });
    expect(repaired.promoted).toBe(false);
    expect(repaired.reason).toBe('INTERNAL_VOID_REGRESSION');
    expect(repaired.evidence.candidateUnexplainedVoidM3).toBe(2);
  });
});
