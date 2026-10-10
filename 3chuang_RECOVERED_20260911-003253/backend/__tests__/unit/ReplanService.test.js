const { replan, diffPlans } = require('../../services/packing/ReplanService');
const { resolveOrientationRules } = require('../../services/packing/OrientationConstraint');

const source = (patch = {}) => ({ cargoId: 'crate', sku: 'CRATE', name: '测试木箱', length: 600, width: 500, height: 400,
  weight: 100, quantity: 1, stackable: false, maxStackLayers: 1, canRotate: false, canInvert: false, canLayFlat: false,
  packagingType: 'WOOD_CRATE', portSequence: 1, ...patch });
function plan(cargo = source(), patch = {}) {
  const o = resolveOrientationRules(cargo).orientations[0].semanticVariants[0];
  return { planId: 'OLD', sourceCode: 'BACKEND_SOLVED', loadedCargo: [{ ...cargo, cargoId: `${cargo.cargoId}_1`, sourceCargoId: cargo.cargoId,
    x: 2649, y: 0, z: 926, l: o.l, w: o.w, h: o.h, orientationId: o.id, canonicalOrientation: o.id,
    orientation: o.legacyLabel, axisMap: o.axisMap, uprightOriginalAxis: o.uprightOriginalAxis, loadingIndex: 1 }], ...patch };
}
const request = (old, next) => ({ containerType: '20GP', previousPlan: plan(old), previousCargo: [old], cargoList: [next],
  caseContext: { caseId: 'ISOLATED_REPLAN_TEST' }, options: { includeAiExplanation: false } });

describe('replanning preserves validated positions and revision facts', () => {
  test('weight input change is revalidated in place with fresh totals and immutable old plan', async () => {
    const old = source(), body = request(old, source({ weight: 125 }));
    const saved = JSON.stringify(body.previousPlan), solveFull = jest.fn();
    const result = await replan(body, solveFull);
    expect(result.replan.method).toBe('IN_PLACE_REVALIDATION');
    expect(result.validator.valid).toBe(true);
    expect(result.totalWeight).toBe(125);
    expect(result.replan.diff.counts.unchanged).toBe(1);
    expect(result.replan.diff.entries[0].reasons).toContain('CARGO_INPUT_CHANGED');
    expect(result.planId).not.toBe('OLD');
    expect(result.executionStatus.persistence).toBe('CLIENT_WORKSPACE');
    expect(JSON.stringify(body.previousPlan)).toBe(saved);
    expect(solveFull).not.toHaveBeenCalled();
  });
  test('actual dimensions can change without moving a box only after fresh validation', async () => {
    const old = source();
    const result = await replan(request(old, source({ width: 550 })), jest.fn());
    expect(result.loadedCargo[0].w).toBe(550);
    expect(result.replan.diff.counts.resized).toBe(1);
    expect(result.validator.checks.orientation).toBe(true);
  });
  test('a preview cannot be promoted into a formal old plan', async () => {
    const body = request(source(), source()); body.previousPlan.sourceCode = 'LOCAL_PREVIEW';
    await expect(replan(body, jest.fn())).rejects.toMatchObject({ code: 'REPLAN_INPUT_INVALID' });
  });
  test.each([null, undefined, ''])('missing mass %s cannot be normalized into zero', async weight => {
    await expect(replan(request(source(), source({ weight })), jest.fn())).rejects.toMatchObject({ code: 'PACKING_INPUT_INVALID' });
  });
  test('fractional quantity cannot be silently rounded into one item', async () => {
    await expect(replan(request(source(), source({ quantity: 1.3 })), jest.fn())).rejects.toMatchObject({ code: 'PACKING_INPUT_INVALID' });
  });
  test('unsupported external business constraints cannot bypass the generation gate', async () => {
    await expect(replan({ ...request(source(), source()), externalDataset: { source: 'orlib_wtpack' } }, jest.fn()))
      .rejects.toMatchObject({ code: 'SOURCE_RULE_UNSUPPORTED' });
  });
  test.each(['ACTUAL_CONTAINER', 'actual_container'])('actual payload uses gross minus tare with container mode %s', async containerMode => {
    const old = source(), body = { ...request(old, source({ weight: 900 })), containerMode,
      actualContainer: { innerLength: 5900, innerWidth: 2350, innerHeight: 2390, doorWidth: 2300, doorHeight: 2280, maxGross: 1000, tare: 200 } };
    const fallback = jest.fn().mockRejectedValue(Object.assign(new Error('超过载重'), { code: 'PAYLOAD' }));
    await expect(replan(body, fallback)).rejects.toMatchObject({ code: 'PAYLOAD' });
    expect(fallback).toHaveBeenCalled();
  });
  test('old risk/support evidence is replaced with current independent validation', async () => {
    const body = request(source(), source({ weight: 125 }));
    Object.assign(body.previousPlan.loadedCargo[0], { supportRatio: .01, riskStatus: 'INVALID', placementReason: { forged: true } });
    const next = await replan(body, jest.fn());
    expect(next.loadedCargo[0].supportRatio).toBe(1);
    expect(next.loadedCargo[0].riskStatus).not.toBe('INVALID');
    expect(next.loadedCargo[0].placementReason.forged).toBeUndefined();
    expect(next.portAccessibility.status).toBe('FULL_UNLOAD_PASS');
    expect(next.operationFeasibility.blockedCount).toBe(0);
  });
  test('geometry-valid but unbalanced old positions cannot bypass the production gate', async () => {
    const body = request(source(), source({ weight: 125 }));
    body.previousPlan.loadedCargo[0].x = 0;
    const full = jest.fn().mockRejectedValue(new Error('full solve requested'));
    await expect(replan(body, full)).rejects.toThrow('full solve requested');
    expect(full).toHaveBeenCalledTimes(1);
  });
  test('changed handling mode must pass fresh operation gates even when geometry stays valid', async () => {
    const body = request(source(), source({ handlingMethod: 'manual' }));
    const full = jest.fn().mockRejectedValue(new Error('manual load exceeds project capacity'));
    await expect(replan(body, full)).rejects.toThrow('manual load exceeds project capacity');
    expect(full).toHaveBeenCalledTimes(1);
  });
  test('source benchmark facts cannot be silently changed', async () => {
    await expect(replan({ ...request(source(), source()), solverMode: 'SOURCE_BENCHMARK' }, jest.fn()))
      .rejects.toMatchObject({ code: 'SOURCE_REPLAN_UNSUPPORTED' });
  });
  test('oversized replacement cannot retain old valid status', async () => {
    const body = request(source(), source({ width: 9000 }));
    const full = jest.fn().mockRejectedValue(Object.assign(new Error('尺寸超界'), { code: 'OVERSIZE' }));
    await expect(replan(body, full)).rejects.toMatchObject({ code: 'OVERSIZE' });
    expect(full).toHaveBeenCalledTimes(1);
  });
  test('a full solution cannot silently relocate a fixed physical unit', async () => {
    const old = source(), body = { ...request(old, source({ width: 9000 })), lockedCargoIds: ['crate_1'] };
    const moved = plan(old); moved.loadedCargo[0].x = 700;
    await expect(replan(body, jest.fn().mockResolvedValue(moved))).rejects.toMatchObject({ code: 'LOCKED_CARGO_CONFLICT' });
  });
  test('removed/added/orientation/movement diffs come from physical IDs and geometry', () => {
    const old = plan();
    old.loadedCargo.push({ ...old.loadedCargo[0], cargoId: 'removed_1' });
    const next = plan(); next.loadedCargo[0] = { ...next.loadedCargo[0], x: 500, w: 550, orientationId: 'WLH' };
    next.loadedCargo.push({ ...next.loadedCargo[0], cargoId: 'new_1' });
    const diff = diffPlans(old, next);
    expect(diff.counts).toMatchObject({ moved: 1, removed: 1, added: 1 });
    expect(diff.entries.find(e => e.cargoId === 'crate_1').orientationChanged).toBe(true);
    expect(diff.entries.find(e => e.cargoId === 'crate_1').dimensionsChanged).toBe(true);
    expect(diff.dimensionsChangedCount).toBe(1);
  });
});
