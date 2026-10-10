import { describe, expect, it } from 'vitest';
import { buildOperationQueue, OperationMachine, OPERATION_PHASES } from './operationMachine.js';

const plan = {
  containerInfo: { typeId: 'TEST', innerLength: 6000, innerWidth: 2400, innerHeight: 2600 },
  loadedCargo: [
    { cargoId: 'near', sku: 'NEAR', loadingIndex: 2, x: 4200, y: 0, z: 700, l: 800, w: 600, h: 700, weight: 12 },
    { cargoId: 'deep', sku: 'DEEP', loadingIndex: 1, x: 500, y: 0, z: 700, l: 800, w: 600, h: 700, weight: 12 }
  ]
};

describe('operation machine', () => {
  it('uses a deep-first, bottom-first queue to keep the entry path reachable', () => {
    expect(buildOperationQueue(plan.loadedCargo).map((item) => item.cargoId)).toEqual(['deep', 'near']);
  });

  it('implements every required explicit state name', () => {
    expect(OPERATION_PHASES).toEqual(expect.arrayContaining([
      'IDLE', 'OPENING_DOORS', 'MOVE_TO_CARGO', 'ALIGN_FOR_PICKUP', 'INSERT_FORKS', 'LIFT_CARGO',
      'MOVE_TO_STAGING', 'ALIGN_WITH_DOOR', 'ENTER_CONTAINER', 'MOVE_INSIDE', 'ALIGN_WITH_TARGET',
      'LOWER_CARGO', 'RELEASE_CARGO', 'REVERSE_OUT', 'RETURN_FOR_NEXT', 'PAUSED', 'BLOCKED', 'COMPLETED'
    ]));
  });

  it('opens the doors before any cargo can enter and advances from delta time', () => {
    const machine = new OperationMachine(plan);
    machine.play();
    expect(machine.getSnapshot().phase).toBe('OPENING_DOORS');
    machine.tick(0.5);
    expect(machine.getSnapshot().doorProgress).toBeGreaterThan(0);
    machine.tick(0.25);
    expect(machine.getSnapshot().phase).toBe('OPENING_DOORS');
    for (let index = 0; index < 4; index += 1) machine.tick(0.25);
    expect(machine.getSnapshot().doorProgress).toBe(1);
    expect(machine.getSnapshot().phase).toBe('MOVE_TO_CARGO');
  });

  it('keeps all coordinates stable while paused and resumes the same phase', () => {
    const machine = new OperationMachine(plan);
    machine.play();
    for (let index = 0; index < 8; index += 1) machine.tick(0.25);
    machine.tick(0.4);
    const before = machine.pause();
    expect(before.phase).toBe('PAUSED');
    const frozen = JSON.stringify({ forklift: before.forklift, cargo: before.cargoPose, completed: before.completedCount });
    machine.tick(10);
    const after = machine.getSnapshot();
    expect(JSON.stringify({ forklift: after.forklift, cargo: after.cargoPose, completed: after.completedCount })).toBe(frozen);
    machine.play();
    expect(machine.getSnapshot().phase).toBe('MOVE_TO_CARGO');
  });

  it('supports speed, forward/backward steps, cargo jump and consistent reset', () => {
    const machine = new OperationMachine(plan);
    machine.setSpeed(4);
    expect(machine.getSnapshot().speed).toBe(4);
    machine.setSpeed(16);
    expect(machine.getSnapshot().speed).toBe(16);
    machine.setSpeed(8);
    expect(machine.getSnapshot().speed).toBe(8);
    machine.stepForward();
    expect(machine.getSnapshot().phase).toBe('OPENING_DOORS');
    machine.stepForward();
    expect(machine.getSnapshot().phase).toBe('MOVE_TO_CARGO');
    machine.stepBackward();
    expect(machine.getSnapshot().phase).toBe('OPENING_DOORS');
    machine.jumpToCargo(1);
    expect(machine.getSnapshot()).toMatchObject({ currentIndex: 1, completedCount: 1, doorProgress: 1, phase: 'MOVE_TO_CARGO' });
    machine.reset();
    expect(machine.getSnapshot()).toMatchObject({ phase: 'IDLE', currentIndex: 0, completedCount: 0, doorProgress: 0, speed: 1 });
  });

  it('reconstructs any completed-count timeline snapshot without replaying from zero', () => {
    const machine = new OperationMachine(plan);
    expect(machine.jumpToCompletedCount(0)).toMatchObject({ phase: 'IDLE', completedCount: 0, doorProgress: 0 });
    expect(machine.jumpToCompletedCount(1)).toMatchObject({ phase: 'MOVE_TO_CARGO', completedCount: 1, currentIndex: 1, doorProgress: 1 });
    expect(machine.jumpToCompletedCount(2)).toMatchObject({ phase: 'COMPLETED', completedCount: 2, doorProgress: 1 });
    expect(machine.placedCargo().map((item) => item.cargoId)).toEqual(['deep', 'near']);
  });

  it('reconstructs the competition 212-item boundary states at 0, 1, N-1 and N', () => {
    const loadedCargo = Array.from({ length: 212 }, (_, index) => ({
      cargoId: `cargo-${index + 1}`,
      sku: `SKU-${String(index + 1).padStart(3, '0')}`,
      loadingIndex: index + 1,
      x: (index % 20) * 250,
      y: Math.floor(index / 100) * 500,
      z: Math.floor((index % 100) / 20) * 300,
      l: 200,
      w: 200,
      h: 200,
      weight: 10
    }));
    const machine = new OperationMachine({ ...plan, loadedCargo });
    expect(machine.jumpToCompletedCount(0)).toMatchObject({ phase: 'IDLE', completedCount: 0 });
    expect(machine.jumpToCompletedCount(1)).toMatchObject({ phase: 'MOVE_TO_CARGO', completedCount: 1, currentIndex: 1 });
    expect(machine.jumpToCompletedCount(211)).toMatchObject({ phase: 'MOVE_TO_CARGO', completedCount: 211, currentIndex: 211 });
    expect(machine.jumpToCompletedCount(212)).toMatchObject({ phase: 'COMPLETED', completedCount: 212 });
    expect(machine.placedCargo()).toHaveLength(212);
  });

  it('selects truthful manual and forklift actors while preserving the same target plan', () => {
    const manual = { ...plan.loadedCargo[1], handlingMethod: 'manual' };
    const manualMachine = new OperationMachine({ ...plan, loadedCargo: [manual] });
    manualMachine.stepForward();
    manualMachine.stepForward();
    expect(manualMachine.getSnapshot()).toMatchObject({
      actorType: 'manual',
      actorStage: 'move',
      phaseLabel: '走向货物',
      worker: { stage: 'move' }
    });
    manualMachine.stepForward();
    manualMachine.stepForward();
    manualMachine.stepForward();
    expect(manualMachine.getSnapshot()).toMatchObject({ actorType: 'manual', actorStage: 'lift' });

    const forkliftMachine = new OperationMachine({ ...plan, loadedCargo: [{ ...manual, handlingMethod: 'forklift' }] });
    forkliftMachine.stepForward();
    forkliftMachine.stepForward();
    expect(forkliftMachine.getSnapshot()).toMatchObject({ actorType: 'forklift', actorStage: 'move', phaseLabel: '驶向货物' });
    expect(manualMachine.currentCargo()).toMatchObject({ x: manual.x, y: manual.y, z: manual.z });
  });

  it('keeps the manual worker continuous across every phase boundary', () => {
    const machine = new OperationMachine({ ...plan, loadedCargo: [{ ...plan.loadedCargo[1], handlingMethod: 'manual' }] });
    machine.stepForward();
    while (!['COMPLETED', 'BLOCKED'].includes(machine.phase)) {
      // 节拍为距离驱动：用机器自身的 phaseDuration 推到阶段末。
      machine.phaseElapsed = machine.phaseDuration();
      const before = machine.computePose();
      const after = machine.stepForward();
      expect(Math.hypot(
        before.worker.position.x - after.worker.position.x,
        before.worker.position.y - after.worker.position.y,
        before.worker.position.z - after.worker.position.z
      ), `${machine.phase} worker boundary`).toBeLessThan(0.01);
      expect(angleDistance(before.worker.yaw, after.worker.yaw), `${machine.phase} worker yaw boundary`).toBeLessThan(0.001);
    }
  });

  it('keeps forklift, fork height, cargo pose and heading continuous at phase boundaries', () => {
    const machine = new OperationMachine({ ...plan, loadedCargo: [{...plan.loadedCargo[1],l:1200,w:780,packagingType:'PALLETIZED_CARTONS',forkEntry:'FOUR_WAY',palletJackCompatible:true}] });
    machine.stepForward();
    const distances = [];
    while (!['COMPLETED', 'BLOCKED'].includes(machine.phase)) {
      machine.phaseElapsed = machine.phaseDuration();
      const before = machine.computePose();
      const after = machine.stepForward();
      const positionDistance = Math.hypot(
        before.forklift.position.x - after.forklift.position.x,
        before.forklift.position.y - after.forklift.position.y,
        before.forklift.position.z - after.forklift.position.z
      );
      distances.push(positionDistance);
      expect(positionDistance, `${machine.phase} forklift boundary`).toBeLessThan(0.01);
      expect(Math.abs(before.forklift.forkHeight - after.forklift.forkHeight), `${machine.phase} fork boundary`).toBeLessThan(0.01);
      expect(angleDistance(before.forklift.yaw, after.forklift.yaw), `${machine.phase} yaw boundary`).toBeLessThan(0.001);
      if (before.cargo && after.cargoPose) {
        expect(Math.hypot(
          before.cargo.position.x - after.cargoPose.position.x,
          before.cargo.position.y - after.cargoPose.position.y,
          before.cargo.position.z - after.cargoPose.position.z
        ), `${machine.phase} cargo boundary`).toBeLessThan(0.01);
      }
    }
    expect(distances.length).toBeGreaterThan(10);
  });

  it('enters BLOCKED with a concrete reason and can skip without changing the target', () => {
    const blockedPlan = {
      containerInfo: plan.containerInfo,
      loadedCargo: [{ cargoId: 'wide', sku: 'WIDE', packagingType:'PALLETIZED_CARTONS',forkEntry:'FOUR_WAY',palletJackCompatible:true, x: 500, y: 0, z: 0, l: 1200, w: 2390, h: 700 }]
    };
    const machine = new OperationMachine(blockedPlan);
    machine.play();
    let guard = 0;
    while (machine.getSnapshot().phase !== 'BLOCKED' && guard < 200) {
      machine.tick(0.25);
      guard += 1;
    }
    expect(machine.getSnapshot().phase).toBe('BLOCKED');
    expect(machine.getSnapshot().blockedReasons[0].code).toBe('DOOR_OPENING_TOO_SMALL');
    expect(machine.currentCargo().z).toBe(0);
    machine.skipCurrent();
    expect(machine.getSnapshot()).toMatchObject({ phase: 'COMPLETED', completedCount: 0 });
    expect(machine.getSnapshot().skipped).toHaveLength(1);
  });

  it('blocks incomplete or oversized manual work with recoverable actor-specific reasons', () => {
    const incomplete = new OperationMachine({
      ...plan,
      loadedCargo: [{ ...plan.loadedCargo[1], handlingMethod: 'manual', weight: 0 }]
    });
    incomplete.jumpToCargo(0);
    incomplete.stepForward();
    incomplete.stepForward();
    expect(incomplete.getSnapshot()).toMatchObject({ phase: 'BLOCKED', blockedReasons: [{ code: 'MANUAL_DATA_INCOMPLETE' }] });

    const oversized = new OperationMachine({
      ...plan,
      loadedCargo: [{ ...plan.loadedCargo[1], handlingMethod: 'manual', l: 1600, weight: 12 }]
    });
    oversized.jumpToCargo(0);
    oversized.stepForward();
    oversized.stepForward();
    expect(oversized.getSnapshot()).toMatchObject({ phase: 'BLOCKED', blockedReasons: [{ code: 'MANUAL_CAPACITY_EXCEEDED' }] });
  });
});

function angleDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}
