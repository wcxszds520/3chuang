import { describe, it, expect } from 'vitest';
import { buildInputCargoCsv, previewCargoCsv } from './csvImport.js';

describe('CSV input facts survive export/import', () => {
  const cargo={name:'箱,一',sku:'S-1',length:500,width:400,height:300,weight:12,quantity:2,destinationPort:'Hamburg',portSequence:1,batchId:'BATCH-X',batchLabel:'客户批次',source:'customer-order',packagingType:'carton',stackable:true,maxStackLayers:3,wooden:true,canRotate:false,canLayFlat:false,canInvert:false,dangerous:false,handlingMethod:'manual',riskNotes:['保留批次']};
  it('preserves batch, provenance, wood declaration and orientation permissions',()=>{
    const result=previewCargoCsv(buildInputCargoCsv([cargo]));
    expect(result.ignoredHeaders).toEqual([]);
    expect(result.summary).toEqual({total:1,valid:1,invalid:0});
    expect(result.rows[0].cargo).toMatchObject({...cargo,packagingType:'CARTON'});
  });
  it('rejects a mistyped boolean instead of enabling rotation',()=>{
    const result=previewCargoCsv(buildInputCargoCsv([{...cargo,canRotate:'flase'}]));
    expect(result.summary.invalid).toBe(1);
    expect(result.rows[0].errors.canRotate).toBeTruthy();
  });
  it('retains an explicit nonwood declaration even for an equipment case',()=>{
    const result=previewCargoCsv(buildInputCargoCsv([{...cargo,packagingType:'equipment_case',wooden:false}]));
    expect(result.rows[0].cargo.wooden).toBe(false);
  });
});
