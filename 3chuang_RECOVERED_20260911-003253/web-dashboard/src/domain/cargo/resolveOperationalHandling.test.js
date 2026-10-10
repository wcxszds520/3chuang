import { describe, expect, it } from 'vitest';
import { resolveOperationalHandling } from './resolveOperationalHandling.js';

describe('resolveOperationalHandling', () => {
  it('uses confirmed, source, recommended and unknown in strict priority order', () => {
    const base = { externalMetadata: { confirmedHandlingMethod: 'crane', sourceHandlingMethod: 'forklift', operationalHandlingProfile: { preferredEquipment: 'LIFT_ASSIST' } } };
    expect(resolveOperationalHandling(base)).toMatchObject({ effectiveMethod: 'CRANE', status: 'CONFIRMED' });
    expect(resolveOperationalHandling({ externalMetadata: { sourceHandlingMethod: 'forklift', operationalHandlingProfile: { preferredEquipment: 'LIFT_ASSIST' } } })).toMatchObject({ effectiveMethod: 'FORKLIFT', status: 'SOURCE_CONFIRMED' });
    expect(resolveOperationalHandling({ externalMetadata: { operationalHandlingProfile: { preferredEquipment: 'LIFT_ASSIST' } } })).toMatchObject({ effectiveMethod: 'LIFT_ASSIST', status: 'RECOMMENDED_NOT_CONFIRMED' });
    expect(resolveOperationalHandling({ externalMetadata: {} })).toEqual({ sourceMethod: null, recommendedMethod: null, confirmedMethod: null, effectiveMethod: 'UNKNOWN', status: 'UNKNOWN' });
  });

  it('does not mutate or promote the external hard handlingMethod', () => {
    const cargo = { handlingMethod: null, externalMetadata: { operationalHandlingProfile: { primaryMethod: 'MECHANICAL_AID', preferredEquipment: 'FORKLIFT' } } };
    expect(resolveOperationalHandling(cargo).effectiveMethod).toBe('FORKLIFT');
    expect(cargo.handlingMethod).toBeNull();
  });
});
