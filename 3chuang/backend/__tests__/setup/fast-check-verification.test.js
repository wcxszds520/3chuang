/**
 * Fast-check Integration Verification Test
 * Validates that fast-check is properly installed and configured with Jest
 */

const fc = require('fast-check');

describe('Fast-check Integration', () => {
  test('fast-check library is available', () => {
    expect(fc).toBeDefined();
    expect(typeof fc.assert).toBe('function');
    expect(typeof fc.property).toBe('function');
  });

  test('basic property test runs successfully', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return n + 0 === n;
      }),
      { numRuns: 100 }
    );
  });

  test('property test with multiple generators', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a; // Commutative property
      }),
      { numRuns: 100 }
    );
  });

  test('property test can detect failures', () => {
    expect(() => {
      fc.assert(
        fc.property(fc.integer(), (n) => {
          return n < 0; // This will fail for non-negative integers
        }),
        { numRuns: 10 }
      );
    }).toThrow();
  });

  test('fast-check provides shrinking on failure', () => {
    let errorMessage = '';
    try {
      fc.assert(
        fc.property(fc.array(fc.integer()), (arr) => {
          return arr.length < 5; // Will fail for arrays with 5+ elements
        }),
        { numRuns: 100 }
      );
    } catch (error) {
      errorMessage = error.message;
    }
    
    // Verify that fast-check provides counterexample information
    expect(errorMessage).toContain('Property failed');
  });
});
