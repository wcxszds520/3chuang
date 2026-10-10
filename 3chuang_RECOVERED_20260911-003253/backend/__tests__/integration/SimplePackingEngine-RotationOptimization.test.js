const SimplePackingEngine = require('../../services/SimplePackingEngine');
const ContainerType = require('../../models/ContainerType');
const Cargo = require('../../models/Cargo');
const { noCollisions, allWithinBoundaries, calculateSpaceUtilization } = require('../setup/test-utilities');

describe('Integration Test: Rotation Optimization', () => {
  let engine;
  let container40HQ;

  beforeEach(() => {
    engine = new SimplePackingEngine();
    container40HQ = new ContainerType({
      typeId: '40HQ',
      name: '40英尺高柜',
      innerLength: 12032,
      innerWidth: 2352,
      innerHeight: 2698,
      maxWeight: 26000,
      description: '适用于大批量高货物'
    });
  });

  test('should achieve higher utilization with rotation enabled vs disabled', async () => {
    const cargoList = [];
    for (let i = 1; i <= 150; i++) {
      cargoList.push(new Cargo({
        cargoId: `rotate-${i}`,
        name: `可旋转货物-${i}`,
        length: 1200,
        width: 600,
        height: 800,
        weight: 15.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 10,
        canInvert: true,
        canLayFlat: true,
        fragile: false,
        eta: new Date('2024-06-01'),
        portSequence: 1
      }));
    }

    const resultWithRotation = await engine.generatePackingPlan(cargoList, container40HQ);
    const utilizationWithRotation = calculateSpaceUtilization(resultWithRotation.loadedCargo, container40HQ);
    
    const cargoListNoRotation = cargoList.map(cargo => new Cargo({ ...cargo, canInvert: false, canLayFlat: false }));
    const resultNoRotation = await engine.generatePackingPlan(cargoListNoRotation, container40HQ);
    const utilizationNoRotation = calculateSpaceUtilization(resultNoRotation.loadedCargo, container40HQ);
    
    console.log(`With Rotation: ${resultWithRotation.loadedCargo.length} items, ${utilizationWithRotation.toFixed(2)}%`);
    console.log(`Without Rotation: ${resultNoRotation.loadedCargo.length} items, ${utilizationNoRotation.toFixed(2)}%`);

    expect(utilizationWithRotation).toBeGreaterThanOrEqual(utilizationNoRotation);
    expect(resultWithRotation.loadedCargo.length).toBeGreaterThanOrEqual(resultNoRotation.loadedCargo.length);
    expect(noCollisions(resultWithRotation.loadedCargo)).toBe(true);
    expect(allWithinBoundaries(resultWithRotation.loadedCargo, container40HQ)).toBe(true);
  }, 30000);
});
