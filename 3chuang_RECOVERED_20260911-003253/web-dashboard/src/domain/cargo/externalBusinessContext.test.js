import { describe, expect, it } from 'vitest';
import { createFreightBusinessContext, DEFAULT_FREIGHT_PROFILE_ID, solverReadinessFor } from './externalBusinessContext.js';

const dataset = { source: 'ortec_alonso_2019' };
const instance = { id: 'ortec-inst3d1', group: 'alonso_2019', items: [
  { externalItemId: '1', externalDataset: 'alonso_2019', sourceFields: { deliveryDay: 0 }, stackingGroup: 1 },
  { externalItemId: '2', externalDataset: 'alonso_2019', sourceFields: { deliveryDay: 2 }, stackingGroup: 2 },
  { externalItemId: '3', externalDataset: 'alonso_2019', sourceFields: { deliveryDay: 1 }, stackingGroup: 1 }
] };

describe('external freight business context', () => {
  it('creates stable customer, order, POD and unload-group assignments', () => {
    const first = createFreightBusinessContext(dataset, instance);
    const second = createFreightBusinessContext(dataset, instance);
    expect(first).toEqual(second);
    expect(first.profileId).toBe(DEFAULT_FREIGHT_PROFILE_ID);
    expect(first.portOfLoading.code).toBe('CNNGB');
    expect(first.portOfDischarge.code).toBe('DEHAM');
    expect(Object.values(first.assignments).map((entry) => entry.destinationPort)).toEqual(['Hamburg', 'Hamburg', 'Hamburg']);
    expect(new Set(Object.values(first.assignments).map((entry) => entry.portSequence))).toEqual(new Set([1, 2, 3]));
  });

  it('does not derive unload order from ORTEC deliveryDay', () => {
    const changed = structuredClone(instance);
    changed.items.forEach((item) => { item.sourceFields.deliveryDay = 99 - item.sourceFields.deliveryDay; });
    expect(createFreightBusinessContext(dataset, changed).assignments).toEqual(createFreightBusinessContext(dataset, instance).assignments);
  });

  it('uses the audited solver-readiness states', () => {
    expect(solverReadinessFor('renault_esicup_2015', 'instancesA')).toBe('PARTIALLY_SUPPORTED');
    expect(solverReadinessFor('orlib_thpack', 'thpack9')).toBe('BROWSE_ONLY');
    expect(solverReadinessFor('esicup_irregular')).toBe('BROWSE_ONLY');
  });
});
