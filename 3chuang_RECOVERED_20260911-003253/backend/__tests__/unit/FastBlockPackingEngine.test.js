const FastBlockPackingEngine = require('../../services/FastBlockPackingEngine');

jest.mock('../../config/database', () => ({
  query: jest.fn()
}));

const AlgorithmOrchestrator = require('../../services/AlgorithmOrchestrator');

const CONTAINER_40GP = {
  id: '40GP',
  typeId: '40GP',
  innerLength: 12032,
  innerWidth: 2352,
  innerHeight: 2393,
  maxWeight: 26000
};

describe('FastBlockPackingEngine', () => {
  test('enforces cumulative max payload and keeps the partial quantity that fits', async () => {
    const engine = new FastBlockPackingEngine({ manualTopFillMaxWeightKg: 200 });
    const result = await engine.generatePackingPlan([
      { cargoId: 'PAYLOAD', name: '载重测试', length: 100, width: 100, height: 100, weight: 10, quantity: 4, stackable: false, maxStackLayers: 1, canRotate: false, portSequence: 1, sku: 'payload' }
    ], { ...CONTAINER_40GP, maxWeight: 25 });
    expect(result.loadedCargo).toHaveLength(2);
    expect(result.unloadedCargo).toHaveLength(2);
    expect(result.unloadedCargo.every((item) => item.reason === 'MAX_PAYLOAD_EXCEEDED')).toBe(true);
    expect(result.totalWeight).toBe(20);
  });

  test('keeps orientation enum and honors rotate, lay-flat and invert semantics', async () => {
    const engine = new FastBlockPackingEngine();
    const result = await engine.generatePackingPlan([
      { cargoId: 'FIXED', name: '固定朝向', length: 300, width: 180, height: 100, weight: 5, quantity: 1, stackable: false, canRotate: false, canLayFlat: false, canInvert: false, portSequence: 1, sku: 'fixed' }
    ], CONTAINER_40GP);
    expect(result.loadedCargo[0]).toMatchObject({ orientation: 'XYZ', inverted: false, l: 300, w: 180, h: 100 });
    expect(result.loadedCargo[0].algorithmMeta.orientation).toBe('XYZ');
  });

  test.each([
    ['fragile support', { fragile: true, stackable: true, maxStackLayers: 3 }, 'FRAGILE_SUPPORT'],
    ['non-stackable support', { fragile: false, stackable: false, maxStackLayers: 1 }, 'NON_STACKABLE_SUPPORT'],
    ['max stack support', { fragile: false, stackable: true, maxStackLayers: 1 }, 'MAX_STACK']
  ])('rejects %s in the deterministic top-fill pass', async (_label, lowerFlags, rejectionCode) => {
    const engine = new FastBlockPackingEngine();
    const container = { typeId: 'TEST', innerLength: 500, innerWidth: 500, innerHeight: 500, maxWeight: 10000 };
    const result = await engine.generatePackingPlan([
      { cargoId: 'BASE', name: '底层', length: 500, width: 500, height: 200, weight: 20, quantity: 1, canRotate: false, portSequence: 1, sku: 'base', ...lowerFlags },
      { cargoId: 'UPPER', name: '上层', length: 500, width: 500, height: 100, weight: 10, quantity: 1, stackable: true, maxStackLayers: 2, canRotate: false, portSequence: 1, sku: 'upper' }
    ], container);
    expect(result.loadedCargo.map((item) => item.sku)).toEqual(['base']);
    expect(result.unloadedCargo.map((item) => item.sku)).toContain('upper');
    expect(engine.constraintRejections.some((entry) => entry.code === rejectionCode)).toBe(true);
  });

  test('rejects an obvious heavy-on-light contact using the configured engineering ratio', async () => {
    const engine = new FastBlockPackingEngine({ manualTopFillMaxWeightKg: 200 });
    const container = { typeId: 'TEST', innerLength: 500, innerWidth: 500, innerHeight: 500, maxWeight: 10000 };
    await engine.generatePackingPlan([
      { cargoId: 'LIGHT', name: '轻货', length: 500, width: 500, height: 200, weight: 10, quantity: 1, stackable: true, maxStackLayers: 3, canRotate: false, portSequence: 1, sku: 'light' },
      { cargoId: 'HEAVY', name: '重货', length: 500, width: 500, height: 100, weight: 100, quantity: 1, stackable: true, maxStackLayers: 2, canRotate: false, portSequence: 1, sku: 'heavy' }
    ], container);
    expect(engine.constraintRejections.some((entry) => entry.code === 'HEAVY_ON_LIGHT')).toBe(true);
  });

  test('packs large same-SKU batches quickly with flat frontend contract', async () => {
    const engine = new FastBlockPackingEngine();
    const cargoList = [
      {
        cargoId: 'AIR',
        name: '空气炸锅',
        length: 400,
        width: 350,
        height: 300,
        weight: 5.5,
        quantity: 600,
        stackable: true,
        maxStackLayers: 4,
        portSequence: 2,
        sku: 'air-fryer',
        destinationPort: '鹿特丹',
        eta: '2026-07-01'
      }
    ];

    const start = Date.now();
    const result = await engine.generatePackingPlan(cargoList, CONTAINER_40GP);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(result.loadedCargo.length).toBe(600);
    expect(result.unloadedCargo.length).toBe(0);
    expect(result.spaceUtilization).toBeGreaterThan(0);

    const first = result.loadedCargo[0];
    expect(first).toHaveProperty('x');
    expect(first).toHaveProperty('y');
    expect(first).toHaveProperty('z');
    expect(first).toHaveProperty('l');
    expect(first).toHaveProperty('h');
    expect(first).toHaveProperty('w');
    expect(first).toHaveProperty('loadingIndex');
    expect(first.batchLabel).toContain('鹿特丹');
  });

  test('keeps all loaded cargo inside the container', async () => {
    const engine = new FastBlockPackingEngine();
    const result = await engine.generatePackingPlan([
      { cargoId: 'A', name: '取暖器', length: 500, width: 400, height: 350, weight: 8, quantity: 180, stackable: true, maxStackLayers: 3, portSequence: 3, sku: 'heater' },
      { cargoId: 'B', name: '电风扇', length: 450, width: 380, height: 320, weight: 6.5, quantity: 200, stackable: true, maxStackLayers: 3, portSequence: 2, sku: 'fan' },
      { cargoId: 'C', name: '微波炉', length: 520, width: 420, height: 310, weight: 12, quantity: 140, stackable: true, maxStackLayers: 2, portSequence: 1, sku: 'microwave' }
    ], CONTAINER_40GP);

    for (const item of result.loadedCargo) {
      expect(item.x).toBeGreaterThanOrEqual(0);
      expect(item.y).toBeGreaterThanOrEqual(0);
      expect(item.z).toBeGreaterThanOrEqual(0);
      expect(item.x + item.l).toBeLessThanOrEqual(CONTAINER_40GP.innerLength + 0.001);
      expect(item.y + item.h).toBeLessThanOrEqual(CONTAINER_40GP.innerHeight + 0.001);
      expect(item.z + item.w).toBeLessThanOrEqual(CONTAINER_40GP.innerWidth + 0.001);
    }
  });

  test('fills geometrically valid side free spaces after the main block pass', async () => {
    const engine = new FastBlockPackingEngine();
    const result = await engine.generatePackingPlan([
      {
        cargoId: 'BIG',
        name: '大型底层箱',
        length: 500,
        width: 850,
        height: 500,
        weight: 18,
        quantity: 48,
        stackable: true,
        maxStackLayers: 1,
        canRotate: false,
        portSequence: 2,
        sku: 'big-base'
      },
      {
        cargoId: 'SMALL',
        name: '小件补缝箱',
        length: 500,
        width: 300,
        height: 300,
        weight: 4,
        quantity: 50,
        stackable: true,
        maxStackLayers: 6,
        portSequence: 2,
        sku: 'small-fill'
      }
    ], CONTAINER_40GP);

    const fillItems = result.loadedCargo.filter(item => item.algorithmMeta && item.algorithmMeta.fillPacked);
    expect(fillItems.length).toBeGreaterThan(0);
    expect(fillItems.every(item => item.algorithmMeta.spacePortSequence === item.portSequence)).toBe(true);
    expect(result.loadedCargo.length).toBeGreaterThan(48);
  });

  test('never uses fill-pass spaces across LIFO port batches', async () => {
    const engine = new FastBlockPackingEngine();
    const result = await engine.generatePackingPlan([
      {
        cargoId: 'EARLY',
        name: '先卸小件',
        length: 420,
        width: 310,
        height: 260,
        weight: 4,
        quantity: 260,
        stackable: true,
        maxStackLayers: 6,
        portSequence: 1,
        sku: 'early-small'
      },
      {
        cargoId: 'LATE',
        name: '后卸大件',
        length: 520,
        width: 980,
        height: 520,
        weight: 16,
        quantity: 56,
        stackable: true,
        maxStackLayers: 1,
        portSequence: 2,
        sku: 'late-base'
      }
    ], CONTAINER_40GP);

    const fillItems = result.loadedCargo.filter(item => item.algorithmMeta && item.algorithmMeta.fillPacked);
    expect(fillItems.every(item => item.algorithmMeta.spacePortSequence === item.portSequence)).toBe(true);
    expect(result.constraintMeta.lifoCompliant).toBe(true);
  });

  test('preserves stable manual and forklift handling semantics in the flat result', async () => {
    const engine = new FastBlockPackingEngine();
    const result = await engine.generatePackingPlan([
      {
        cargoId: 'MANUAL', name: '人工配件箱', sku: 'manual-sku',
        length: 420, width: 310, height: 260, weight: 8, quantity: 6,
        stackable: true, maxStackLayers: 3, portSequence: 1,
        batchId: 'BATCH-A', batchLabel: '人工批次 A', handlingMethod: 'manual',
        handlingPolicy: 'fixed', source: 'official-demo-template', riskNotes: ['人工轻搬']
      },
      {
        cargoId: 'FORK', name: '叉车设备', sku: 'forklift-sku',
        length: 650, width: 780, height: 650, weight: 53, quantity: 3,
        stackable: true, maxStackLayers: 3, portSequence: 1,
        batchId: 'BATCH-B', batchLabel: '叉车批次 B', handlingMethod: 'forklift',
        handlingPolicy: 'fixed', source: 'official-demo-template', riskNotes: ['叉车搬运']
      }
    ], CONTAINER_40GP);

    const manual = result.loadedCargo.find(item => item.sku === 'manual-sku');
    const forklift = result.loadedCargo.find(item => item.sku === 'forklift-sku');
    expect(manual).toMatchObject({ handlingMethod: 'manual', handlingPolicy: 'fixed', batchLabel: '人工批次 A' });
    expect(forklift).toMatchObject({ handlingMethod: 'forklift', handlingPolicy: 'fixed', batchLabel: '叉车批次 B' });
    expect(manual.riskNotes).toEqual(['人工轻搬']);
  });
});

describe('AlgorithmOrchestrator fast-block integration', () => {
  test('auto-selects fast-block for large item counts', async () => {
    const orchestrator = new AlgorithmOrchestrator({ debugMode: false });
    const cargoList = [
      { cargoId: 'A', name: '空气炸锅', length: 400, width: 350, height: 300, weight: 5.5, quantity: 150, stackable: true, maxStackLayers: 4, portSequence: 2, sku: 'air-fryer' }
    ];

    const result = await orchestrator.execute({
      cargoList,
      container: CONTAINER_40GP,
      options: {}
    });

    expect(result.success).toBe(true);
    expect(result.metrics.algorithm_id).toBe('fast-block');
    expect(result.metrics.strategy_used).toBe('fast-block');
    expect(result.loadedCargo.length + result.unloadedCargo.length).toBe(150);
  });
});
