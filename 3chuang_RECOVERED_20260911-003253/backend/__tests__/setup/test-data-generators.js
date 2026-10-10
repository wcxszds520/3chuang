/**
 * Test Data Generators (Arbitraries) for Property-Based Testing
 * 
 * This module provides fast-check arbitraries for generating random test data
 * for the 3D Space Splitting Algorithm implementation.
 * 
 * Spec: 3d-space-splitting-algorithm-implementation
 * Task: 2.2 Create test data generators (arbitraries)
 * Requirements: 20.1
 */

const fc = require('fast-check');
const Cargo = require('../../models/Cargo');
const ContainerType = require('../../models/ContainerType');

/**
 * Standard container type specifications
 * Based on real-world shipping container dimensions
 */
const STANDARD_CONTAINERS = {
  '20GP': {
    typeId: '20GP',
    name: '20英尺标准柜',
    innerLength: 5898,
    innerWidth: 2352,
    innerHeight: 2393,
    maxWeight: 21800,
    description: '适用于普通货物'
  },
  '40GP': {
    typeId: '40GP',
    name: '40英尺标准柜',
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2393,
    maxWeight: 26500,
    description: '适用于大批量普通货物'
  },
  '40HQ': {
    typeId: '40HQ',
    name: '40英尺高柜',
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2698,
    maxWeight: 26000,
    description: '适用于大批量高货物'
  }
};

/**
 * Generate a random cargo item with specified constraints
 * 
 * Dimensions: 100-2000mm (reasonable cargo sizes)
 * Weight: 1-100kg (typical cargo weight range)
 * Quantity: 1-10 (manageable quantities for testing)
 * Constraints: Random fragile, canInvert, canLayFlat flags
 * PortSequence: 1-5 (loading priority, per Cargo model validation)
 * 
 * @returns {fc.Arbitrary<Cargo>} Fast-check arbitrary for Cargo objects
 */
function cargoArbitrary() {
  return fc.record({
    cargoId: fc.uuid(),
    name: fc.oneof(
      fc.constant('空气炸锅'),
      fc.constant('取暖器'),
      fc.constant('电风扇'),
      fc.constant('微波炉'),
      fc.constant('咖啡机'),
      fc.constant('吸尘器'),
      fc.constant('电饭煲'),
      fc.constant('烤箱'),
      fc.string({ minLength: 5, maxLength: 20 })
    ),
    length: fc.integer({ min: 100, max: 2000 }),
    width: fc.integer({ min: 100, max: 2000 }),
    height: fc.integer({ min: 100, max: 2000 }),
    weight: fc.float({ min: 1, max: 100, noNaN: true }),
    quantity: fc.integer({ min: 1, max: 10 }),
    stackable: fc.boolean(),
    maxStackLayers: fc.integer({ min: 1, max: 10 }),
    canInvert: fc.boolean(),
    canLayFlat: fc.boolean(),
    fragile: fc.boolean(),
    eta: fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(ts => new Date(ts)),
    portSequence: fc.integer({ min: 1, max: 5 }),
    cyClosing: fc.option(fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(ts => new Date(ts)), { nil: null }),
    customsDeclaration: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: null })
  }).map(params => new Cargo(params));
}

/**
 * Generate a cargo item with specific weight range
 * Useful for testing heavy cargo constraints (weight >= 20kg)
 * 
 * @param {number} minWeight - Minimum weight in kg
 * @param {number} maxWeight - Maximum weight in kg
 * @returns {fc.Arbitrary<Cargo>} Fast-check arbitrary for Cargo objects with specific weight
 */
function cargoWithWeightArbitrary(minWeight, maxWeight) {
  return fc.record({
    cargoId: fc.uuid(),
    name: fc.string({ minLength: 5, maxLength: 20 }),
    length: fc.integer({ min: 100, max: 2000 }),
    width: fc.integer({ min: 100, max: 2000 }),
    height: fc.integer({ min: 100, max: 2000 }),
    weight: fc.float({ min: Math.fround(minWeight), max: Math.fround(maxWeight), noNaN: true }),
    quantity: fc.integer({ min: 1, max: 10 }),
    stackable: fc.boolean(),
    maxStackLayers: fc.integer({ min: 1, max: 10 }),
    canInvert: fc.boolean(),
    canLayFlat: fc.boolean(),
    fragile: fc.boolean(),
    eta: fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(ts => new Date(ts)),
    portSequence: fc.integer({ min: 1, max: 5 }),
    cyClosing: fc.option(fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(ts => new Date(ts)), { nil: null }),
    customsDeclaration: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: null })
  }).map(params => new Cargo(params));
}

/**
 * Generate a heavy cargo item (weight >= 20kg)
 * Used for testing heavy cargo ground constraint (Requirement 7)
 * 
 * @returns {fc.Arbitrary<Cargo>} Fast-check arbitrary for heavy Cargo objects
 */
function heavyCargoArbitrary() {
  return cargoWithWeightArbitrary(20, 100);
}

/**
 * Generate a light cargo item (weight < 20kg)
 * Used for testing non-heavy cargo placement
 * 
 * @returns {fc.Arbitrary<Cargo>} Fast-check arbitrary for light Cargo objects
 */
function lightCargoArbitrary() {
  return cargoWithWeightArbitrary(1, 19.99);
}

/**
 * Generate a fragile cargo item
 * Used for testing fragile cargo no-stacking constraint (Requirement 6)
 * 
 * @returns {fc.Arbitrary<Cargo>} Fast-check arbitrary for fragile Cargo objects
 */
function fragileCargoArbitrary() {
  return fc.record({
    cargoId: fc.uuid(),
    name: fc.string({ minLength: 5, maxLength: 20 }),
    length: fc.integer({ min: 100, max: 2000 }),
    width: fc.integer({ min: 100, max: 2000 }),
    height: fc.integer({ min: 100, max: 2000 }),
    weight: fc.float({ min: 1, max: 100, noNaN: true }),
    quantity: fc.integer({ min: 1, max: 10 }),
    stackable: fc.boolean(),
    maxStackLayers: fc.integer({ min: 1, max: 10 }),
    canInvert: fc.boolean(),
    canLayFlat: fc.boolean(),
    fragile: fc.constant(true), // Always fragile
    eta: fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(ts => new Date(ts)),
    portSequence: fc.integer({ min: 1, max: 5 }),
    cyClosing: fc.option(fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(ts => new Date(ts)), { nil: null }),
    customsDeclaration: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: null })
  }).map(params => new Cargo(params));
}

/**
 * Generate a cargo item with specific rotation constraints
 * 
 * @param {boolean} canInvert - Allow height-width swap
 * @param {boolean} canLayFlat - Allow height-length swap
 * @returns {fc.Arbitrary<Cargo>} Fast-check arbitrary for Cargo with specific rotation constraints
 */
function cargoWithRotationArbitrary(canInvert, canLayFlat) {
  return fc.record({
    cargoId: fc.uuid(),
    name: fc.string({ minLength: 5, maxLength: 20 }),
    length: fc.integer({ min: 100, max: 2000 }),
    width: fc.integer({ min: 100, max: 2000 }),
    height: fc.integer({ min: 100, max: 2000 }),
    weight: fc.float({ min: 1, max: 100, noNaN: true }),
    quantity: fc.integer({ min: 1, max: 10 }),
    stackable: fc.boolean(),
    maxStackLayers: fc.integer({ min: 1, max: 10 }),
    canInvert: fc.constant(canInvert),
    canLayFlat: fc.constant(canLayFlat),
    fragile: fc.boolean(),
    eta: fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(ts => new Date(ts)),
    portSequence: fc.integer({ min: 1, max: 5 }),
    cyClosing: fc.option(fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(ts => new Date(ts)), { nil: null }),
    customsDeclaration: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: null })
  }).map(params => new Cargo(params));
}

/**
 * Generate a cargo item with specific port sequence
 * Used for testing multi-dimensional sorting (Requirement 2)
 * 
 * @param {number} portSequence - Port sequence value (1-5)
 * @returns {fc.Arbitrary<Cargo>} Fast-check arbitrary for Cargo with specific port sequence
 */
function cargoWithPortSequenceArbitrary(portSequence) {
  return fc.record({
    cargoId: fc.uuid(),
    name: fc.string({ minLength: 5, maxLength: 20 }),
    length: fc.integer({ min: 100, max: 2000 }),
    width: fc.integer({ min: 100, max: 2000 }),
    height: fc.integer({ min: 100, max: 2000 }),
    weight: fc.float({ min: 1, max: 100, noNaN: true }),
    quantity: fc.integer({ min: 1, max: 10 }),
    stackable: fc.boolean(),
    maxStackLayers: fc.integer({ min: 1, max: 10 }),
    canInvert: fc.boolean(),
    canLayFlat: fc.boolean(),
    fragile: fc.boolean(),
    eta: fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(ts => new Date(ts)),
    portSequence: fc.constant(portSequence),
    cyClosing: fc.option(fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(ts => new Date(ts)), { nil: null }),
    customsDeclaration: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: null })
  }).map(params => new Cargo(params));
}

/**
 * Generate a list of cargo items
 * 
 * @param {number} minLength - Minimum number of cargo items (default: 1)
 * @param {number} maxLength - Maximum number of cargo items (default: 50)
 * @returns {fc.Arbitrary<Array<Cargo>>} Fast-check arbitrary for cargo lists
 */
function cargoListArbitrary(minLength = 1, maxLength = 50) {
  return fc.array(cargoArbitrary(), { minLength, maxLength });
}

/**
 * Generate a mixed cargo list with heavy, fragile, and normal items
 * Used for integration testing (Task 7.1)
 * 
 * @param {number} heavyCount - Number of heavy items
 * @param {number} fragileCount - Number of fragile items
 * @param {number} normalCount - Number of normal items
 * @returns {fc.Arbitrary<Array<Cargo>>} Fast-check arbitrary for mixed cargo lists
 */
function mixedCargoListArbitrary(heavyCount, fragileCount, normalCount) {
  return fc.tuple(
    fc.array(heavyCargoArbitrary(), { minLength: heavyCount, maxLength: heavyCount }),
    fc.array(fragileCargoArbitrary(), { minLength: fragileCount, maxLength: fragileCount }),
    fc.array(lightCargoArbitrary(), { minLength: normalCount, maxLength: normalCount })
  ).map(([heavy, fragile, normal]) => [...heavy, ...fragile, ...normal]);
}

/**
 * Generate a standard container type (20GP, 40GP, or 40HQ)
 * 
 * @returns {fc.Arbitrary<ContainerType>} Fast-check arbitrary for ContainerType objects
 */
function containerArbitrary() {
  return fc.oneof(
    fc.constant(new ContainerType(STANDARD_CONTAINERS['20GP'])),
    fc.constant(new ContainerType(STANDARD_CONTAINERS['40GP'])),
    fc.constant(new ContainerType(STANDARD_CONTAINERS['40HQ']))
  );
}

/**
 * Generate a specific container type by name
 * 
 * @param {string} typeName - Container type name ('20GP', '40GP', or '40HQ')
 * @returns {fc.Arbitrary<ContainerType>} Fast-check arbitrary for specific ContainerType
 */
function specificContainerArbitrary(typeName) {
  if (!STANDARD_CONTAINERS[typeName]) {
    throw new Error(`Unknown container type: ${typeName}. Valid types: 20GP, 40GP, 40HQ`);
  }
  return fc.constant(new ContainerType(STANDARD_CONTAINERS[typeName]));
}

/**
 * Generate a 40HQ container (most commonly used for testing)
 * 
 * @returns {fc.Arbitrary<ContainerType>} Fast-check arbitrary for 40HQ ContainerType
 */
function container40HQArbitrary() {
  return specificContainerArbitrary('40HQ');
}

/**
 * Generate a 20GP container
 * 
 * @returns {fc.Arbitrary<ContainerType>} Fast-check arbitrary for 20GP ContainerType
 */
function container20GPArbitrary() {
  return specificContainerArbitrary('20GP');
}

/**
 * Generate a 40GP container
 * 
 * @returns {fc.Arbitrary<ContainerType>} Fast-check arbitrary for 40GP ContainerType
 */
function container40GPArbitrary() {
  return specificContainerArbitrary('40GP');
}

/**
 * Generate a custom container with random dimensions
 * Used for edge case testing
 * 
 * @returns {fc.Arbitrary<ContainerType>} Fast-check arbitrary for custom ContainerType
 */
function customContainerArbitrary() {
  return fc.record({
    typeId: fc.string({ minLength: 4, maxLength: 10 }),
    name: fc.string({ minLength: 5, maxLength: 30 }),
    innerLength: fc.integer({ min: 3000, max: 15000 }),
    innerWidth: fc.integer({ min: 2000, max: 3000 }),
    innerHeight: fc.integer({ min: 2000, max: 3000 }),
    maxWeight: fc.integer({ min: 15000, max: 30000 }),
    description: fc.string({ minLength: 0, maxLength: 50 })
  }).map(params => new ContainerType(params));
}

// Export all arbitraries
module.exports = {
  // Basic cargo generators
  cargoArbitrary,
  cargoWithWeightArbitrary,
  heavyCargoArbitrary,
  lightCargoArbitrary,
  fragileCargoArbitrary,
  cargoWithRotationArbitrary,
  cargoWithPortSequenceArbitrary,
  
  // Cargo list generators
  cargoListArbitrary,
  mixedCargoListArbitrary,
  
  // Container generators
  containerArbitrary,
  specificContainerArbitrary,
  container40HQArbitrary,
  container20GPArbitrary,
  container40GPArbitrary,
  customContainerArbitrary,
  
  // Constants
  STANDARD_CONTAINERS
};
