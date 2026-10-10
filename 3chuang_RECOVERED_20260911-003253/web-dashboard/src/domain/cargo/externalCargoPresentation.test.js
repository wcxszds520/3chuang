import { describe, expect, it } from 'vitest';
import { createCargoPresentationProfile, createConstraintSummary, createOperationalHandlingProfile } from './externalCargoPresentation.js';

const box = (overrides = {}) => ({ externalSource: 'OR-Library WTPACK', externalItemId: '1', lengthMm: 1080, widthMm: 760, heightMm: 300, weightKg: 246.24, geometryType: 'BOX', ...overrides });

describe('external cargo presentation and operational handling', () => {
  it('gives SOURCE_EXPLICIT Renault packaging priority over a derived profile', () => {
    const profile = createCargoPresentationProfile(box({ externalSource: 'Renault / ESICUP Challenge 2015', sourceFields: { 'Package material': 'WOOD' }, packagingType: 'WOOD_CRATE' }));
    expect(profile).toMatchObject({ packageLabel: '木质包装', visualFamily: 'SOURCE_WOOD_CRATE', semanticOrigin: 'SOURCE_FACT', sourceMaterial: 'WOOD' });
  });

  it('never turns box benchmarks or ORTEC units into cardboard cartons', () => {
    expect(createCargoPresentationProfile(box()).packageClass).toBe('BOX_MATERIAL_UNKNOWN');
    expect(createCargoPresentationProfile(box({ externalSource: 'OR-Library THPACK', weightKg: null })).visualFamily).not.toBe('SOURCE_CARTON');
    expect(createCargoPresentationProfile(box({ externalSource: 'ORTEC / Alonso 2019', weightKg: 4.63, lengthMm: 254, widthMm: 186, heightMm: 171 }))).toMatchObject({ cargoForm: '规则工业货物单元', visualFamily: 'SMALL_INDUSTRIAL_UNIT' });
  });

  it('deterministically recommends manual handling for a compact light regular unit', () => {
    const item = box({ externalSource: 'ORTEC / Alonso 2019', weightKg: 4.63, lengthMm: 254, widthMm: 186, heightMm: 171 });
    const first = createOperationalHandlingProfile(item);
    expect(first).toMatchObject({ primaryMethod: 'MANUAL', requiresMechanicalAid: false, displayLabel: '人工优先', semanticOrigin: 'PORTCUBE_OPERATION_PROFILE' });
    expect(createOperationalHandlingProfile(item)).toEqual(first);
  });

  it('does not recommend pure manual handling for a heavy or bulky unit', () => {
    const handling = createOperationalHandlingProfile(box());
    expect(handling).toMatchObject({ primaryMethod: 'MECHANICAL_AID', preferredEquipment: 'FORKLIFT', requiresMechanicalAid: true, displayLabel: '叉车优先' });
  });

  it('only enables a pallet jack from pallet or compatible-base evidence', () => {
    expect(createOperationalHandlingProfile(box()).palletJackCompatible).toBeNull();
    expect(createOperationalHandlingProfile(box({ palletAttached: true }))).toMatchObject({ primaryMethod: 'PALLET_JACK', palletJackCompatible: true, palletCompatibility: 'SOURCE_CONFIRMED' });
  });

  it('does not fabricate fork entry when recommending a forklift', () => {
    const handling = createOperationalHandlingProfile(box());
    expect(handling.forkEntry).toBeNull();
    expect(handling.forkInterfaceStatus).toBe('UNKNOWN_REQUIRES_OPERATION_CONFIRMATION');
  });

  it('preserves actual orientation, stacking and pressure constraints in summaries', () => {
    expect(createConstraintSummary(box({ orientationConstraints: { lengthVertical: false, widthVertical: true, heightVertical: true }, loadBearing: { lengthUpright: 0.1 }, loadBearingUnit: 'kg/cm²' }))).toMatchObject({
      entries: ['宽度/高度可竖直', '朝向相关承压'], loadBearingDetail: { lengthUpright: 0.1, unit: 'kg/cm²' }
    });
    expect(createConstraintSummary(box({ externalSource: 'ORTEC / Alonso 2019', orientationConstraints: { x: true, y: false, z: true }, stackingGroup: 4, alwaysOnTop: true, alwaysOnBottom: false })).entries).toEqual(['绕X/Z轴可旋转', '堆叠组 4', '必须上层']);
  });

  it('produces identical presentation profiles for identical inputs', () => {
    const item = box({ externalSource: 'ORTEC / Alonso 2019', lengthMm: 1800, widthMm: 300, heightMm: 250, weightKg: 40 });
    expect(createCargoPresentationProfile(item)).toEqual(createCargoPresentationProfile(item));
    expect(createCargoPresentationProfile(item).visualFamily).toBe('LONG_INDUSTRIAL_UNIT');
  });
});
