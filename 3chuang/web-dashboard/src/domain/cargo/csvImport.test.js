import { describe, expect, it } from 'vitest';
import { buildInputCargoCsv, parseCsvRows, previewCargoCsv } from './csvImport.js';

describe('CSV cargo import', () => {
  it('does not grant FIBC stacking from omitted or blank CSV fields', () => {
    const header='name,sku,length,width,height,weight,quantity,destinationPort,packagingType,stackable';
    const preview=previewCargoCsv(header+'\n吨袋,BAG,900,900,1200,800,2,HAM,FIBC_BAG,');
    expect(preview.rows[0].cargo.stackable).toBe(false);
    expect(preview.rows[0].cargo.maxStackLayers).toBe(1);
    const explicit=previewCargoCsv(header+'\n吨袋,BAG,900,900,1200,800,2,HAM,FIBC_BAG,true');
    expect(explicit.rows[0].cargo.stackable).toBe(true);
  });
  it('parses BOM, quoted commas and escaped quotes', () => {
    const rows = parseCsvRows('\uFEFFname,sku,riskNotes\r\n"纸箱, 加固","SKU-""A""","轻放;防潮"');

    expect(rows).toEqual([
      ['name', 'sku', 'riskNotes'],
      ['纸箱, 加固', 'SKU-"A"', '轻放;防潮']
    ]);
  });

  it('maps Chinese and English headers into validated cargo preview rows', () => {
    const csv = [
      '货物名称,SKU,长(mm),宽(mm),高(mm),单重(kg),数量,目的港,包装类型,可堆叠,最大堆叠层数,易碎,港序',
      '空调外机,A-01,780,360,540,28.5,2,Hamburg,equipment,是,3,否,1'
    ].join('\n');

    const preview = previewCargoCsv(csv);
    expect(preview.fatalErrors).toEqual([]);
    expect(preview.summary).toEqual({ total: 1, valid: 1, invalid: 0 });
    expect(preview.rows[0].cargo).toMatchObject({
      name: '空调外机',
      sku: 'A-01',
      length: 780,
      quantity: 2,
      stackable: true,
      fragile: false,
      portSequence: 1
    });
  });

  it('reports missing required headers before any import can occur', () => {
    const preview = previewCargoCsv('name,sku,quantity\n纸箱,A-01,2');

    expect(preview.rows).toEqual([]);
    expect(preview.fatalErrors[0]).toContain('缺少必需列');
    expect(preview.fatalErrors[0]).toContain('length');
  });

  it('keeps row-level validation errors and imports no implicit defaults for required values', () => {
    const csv = [
      'name,sku,length,width,height,weight,quantity,destinationPort',
      '纸箱,A-01,500,400,300,12.5,2,Hamburg',
      '坏数据,A-02,0,400,300,12.5,1.5,Hamburg'
    ].join('\n');

    const preview = previewCargoCsv(csv);
    expect(preview.summary).toEqual({ total: 2, valid: 1, invalid: 1 });
    expect(preview.rows[1].valid).toBe(false);
    expect(preview.rows[1].errors).toMatchObject({ length: '必须大于 0', quantity: '必须为正整数' });
  });

  it('warns about duplicate SKUs while retaining valid rows for explicit confirmation', () => {
    const csv = [
      'name,sku,length,width,height,weight,quantity,destinationPort',
      '纸箱,A-01,500,400,300,12.5,2,Hamburg',
      '纸箱二,A-01,420,320,280,9,3,Hamburg'
    ].join('\n');

    const preview = previewCargoCsv(csv);
    expect(preview.summary.valid).toBe(2);
    expect(preview.rows[0].warnings).toContain('CSV 内存在重复 SKU');
    expect(preview.rows[1].warnings).toContain('CSV 内存在重复 SKU');
  });

  it('exports the stage-three input fields needed to restore the initial order', () => {
    const csv = buildInputCargoCsv([{
      name: '精密配件箱', sku: 'SKU-ACC-01', length: 650, width: 560, height: 520,
      weight: 12, quantity: 60, destinationPort: 'Hamburg', portSequence: 1,
      batchId: 'BATCH-HAM-A', batchLabel: '汉堡港 · 批次 A', handlingMethod: 'manual',
      packagingType: 'accessory', stackable: true, maxStackLayers: 5, fragile: false,
      heavy: false, wooden: false, riskNotes: ['人工轻搬'], source: 'initial-order'
    }]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('批次ID');
    expect(csv).toContain('装卸方式');
    expect(csv).toContain('SKU-ACC-01');
    expect(csv).toContain('BATCH-HAM-A');
    expect(csv).toContain('manual');
  });
});
