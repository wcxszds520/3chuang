import { describe, expect, it } from 'vitest';
import { EXTERNAL_VISUAL_ASSET_MAP, resolveExternalVisualAsset } from './curatedAssets.js';

describe('external visual assets', () => {
  it('maps every approved external visual family to an explicit renderer asset', () => {
    const expected = ['SOURCE_CARTON', 'SOURCE_WOOD_CRATE', 'SOURCE_METAL_CASE', 'SOURCE_PLASTIC_BOX', 'SMALL_INDUSTRIAL_UNIT', 'STANDARD_INDUSTRIAL_UNIT', 'HEAVY_INDUSTRIAL_UNIT', 'LONG_INDUSTRIAL_UNIT', 'GENERIC_BOX_LIGHT', 'GENERIC_BOX_STANDARD', 'GENERIC_BOX_REINFORCED', 'GENERIC_BOX_HEAVY', 'GENERIC_REINFORCED_BOX', 'GENERIC_HEAVY_TRANSPORT_BOX', 'SOURCE_MESH'];
    expected.forEach((family) => expect(EXTERNAL_VISUAL_ASSET_MAP[family]?.asset).toBeTruthy());
    expect(new Set(expected.map((family) => `${EXTERNAL_VISUAL_ASSET_MAP[family].kind}:${EXTERNAL_VISUAL_ASSET_MAP[family].asset}`)).size).toBe(expected.length);
  });

  it('does not collapse ORTEC, THPACK or WTPACK to the carton image', () => {
    ['SMALL_INDUSTRIAL_UNIT', 'GENERIC_BOX_LIGHT', 'GENERIC_REINFORCED_BOX'].forEach((visualFamily) => {
      const asset = resolveExternalVisualAsset({ cargoPresentationProfile: { visualFamily } });
      expect(asset.kind).toBe('css-profile');
      expect(asset.asset).not.toContain('cargo-carton');
    });
  });

  it('preserves the source mesh asset reference for irregular cargo', () => {
    expect(resolveExternalVisualAsset({ cargoPresentationProfile: { visualFamily: 'SOURCE_MESH' }, externalMetadata: { geometryAsset: 'shape-01.obj' } })).toMatchObject({ kind: 'source-mesh', asset: 'shape-01.obj' });
  });
});
