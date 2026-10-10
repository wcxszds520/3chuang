import { describe, expect, it } from 'vitest';
import { CARGO_VISUAL_FACTORY, cargoVisualDescriptor } from './CargoVisualFactory.js';

describe('CargoVisualFactory V2.5 contract', () => {
  it('maps all eight canonical packaging types to distinct visual families', () => {
    const types = Object.values(CARGO_VISUAL_FACTORY).map((entry) => entry.packagingType);
    expect(new Set(types)).toEqual(new Set([
      'CARTON', 'WOOD_CRATE', 'PALLETIZED_CARTONS', 'WRAPPED_PALLET',
      'EQUIPMENT_CASE', 'DRUM', 'FIBC_BAG', 'GENERIC'
    ]));
  });

  it('preserves the solver envelope as backend truth while choosing a mesh', () => {
    const solverEnvelope = { dimensions: { lengthMm: 1200, widthMm: 800, heightMm: 900 }, truthModel: 'AXIS_ALIGNED_PHYSICAL_ENVELOPE' };
    const descriptor = cargoVisualDescriptor({ packagingType: 'DRUM', cargoPhysicalProfile: { solverEnvelope } });
    expect(descriptor.primitive).toBe('drum');
    expect(descriptor.assetNames).toContain('cargo_drum');
    expect(descriptor.solverEnvelope).toBe(solverEnvelope);
  });
});
