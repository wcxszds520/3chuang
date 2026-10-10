import { describe, expect, it } from 'vitest';

describe('plan projection presentation model', () => {
  it('derives SKU, port, risk and handling views without changing true coordinates', async () => {
    const model = await import('./planProjectionModel.js').catch(() => ({}));
    expect(typeof model.buildProjectionItems).toBe('function');

    const cargo = [
      { cargoId: 'A', sku: 'SKU-A', x: 120, y: 0, z: 40, l: 500, h: 300, w: 400, portSequence: 1, packagingType: 'carton', handlingMethod: 'manual' },
      { cargoId: 'B', sku: 'SKU-B', x: 720, y: 0, z: 40, l: 500, h: 300, w: 400, portSequence: 2, packagingType: 'panel', fragile: true, handlingMethod: 'forklift' }
    ];
    const original = JSON.parse(JSON.stringify(cargo));

    expect(model.buildProjectionItems(cargo, 'sku')[0]).toMatchObject({ cargoId: 'A', visible: true, groupLabel: 'SKU-A' });
    expect(model.buildProjectionItems(cargo, 'port')[0]).toMatchObject({ groupKey: 'port-1', groupLabel: '港序 1' });
    expect(model.buildProjectionItems(cargo, 'risk')[1]).toMatchObject({ risk: true, groupKey: 'risk-attention' });
    expect(model.buildProjectionItems(cargo, 'risk')[0]).toMatchObject({ risk: false, groupKey: 'risk-normal' });
    expect(model.buildProjectionItems(cargo, 'handling')[0]).toMatchObject({ groupKey: 'handling-manual', groupLabel: '人工装箱' });
    expect(model.buildProjectionItems(cargo, 'handling')[1]).toMatchObject({ groupKey: 'handling-forklift', groupLabel: '叉车装箱' });
    expect(model.buildProjectionLegend(model.buildProjectionItems(cargo, 'port'))).toEqual([
      expect.objectContaining({ key: 'port-1', label: '港序 1', count: 1 }),
      expect.objectContaining({ key: 'port-2', label: '港序 2', count: 1 })
    ]);
    expect(cargo).toEqual(original);
  });
});
