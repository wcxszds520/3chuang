import {describe,it,expect} from 'vitest';
import {normalizeCargo,cargoFingerprint,cargoTotals} from './cargo.js';
import {previewCargoCsv,buildInputCargoCsv} from './csvImport.js';
import {COMMERCE_ORDER} from '../../../../shared/commerceOrder.mjs';
import {packagingEvidenceMatches} from '../../../../shared/commerceBusiness.mjs';
import {buildPackingRequest} from '../../services/packingApi.js';
describe('business decisions survive input, persistence fingerprint and requests',()=>{
 it('unknown imported weight remains unknown through normalization and totals',()=>{
  for(const weight of [null,undefined,'']){const row=normalizeCargo({...COMMERCE_ORDER.items[0],weight});expect(row.weight).toBeNull();expect(cargoTotals([row]).weight).toBeNull();}
 });
 it('CSV retains false, priority and unspecified policies distinctly',()=>{
  const rows=[normalizeCargo({...COMMERCE_ORDER.items[0],required:false,allowPartialShipment:false,shipmentPriority:9}),normalizeCargo({...COMMERCE_ORDER.items[2],required:undefined,allowPartialShipment:undefined})];
  const result=previewCargoCsv(buildInputCargoCsv(rows));expect(result.summary.invalid).toBe(0);
  expect(result.rows[0].cargo.required).toBe(false);expect(result.rows[0].cargo.allowPartialShipment).toBe(false);expect(result.rows[0].cargo.shipmentPriority).toBe(9);
  expect(result.rows[1].cargo.required).toBeUndefined();expect(result.rows[1].cargo.allowPartialShipment).toBeUndefined();
 });
 it('changing shipment policy invalidates old plan and reaches API',()=>{
  const row=normalizeCargo({...COMMERCE_ORDER.items[0],allowPartialShipment:false,shipmentPriority:3});
  const hash=cargoFingerprint([row],'40HQ');
  for(const patch of [{allowPartialShipment:true},{shipmentPriority:4},{required:false}])expect(cargoFingerprint([{...row,...patch}],'40HQ')).not.toBe(hash);
  const request=buildPackingRequest({containerType:'40HQ',cargoList:[row],caseContext:COMMERCE_ORDER.caseContext});
  expect(request.cargoList[0].allowPartialShipment).toBe(false);expect(request.cargoList[0].shipmentPriority).toBe(3);
 });
 it('a verification label without a matching dated reference cannot certify packaging',()=>{
  const row=normalizeCargo(COMMERCE_ORDER.items[0]);expect(packagingEvidenceMatches({...row,packagingEvidence:{status:'VERIFIED'}})).toBe(false);
  const keys=['length','width','height','weight','stackable','maxStackLayers','stackLayerScope','handlingMethod','forkEntry','maxSupportedWeight','orientationConstraints'];
  const evidence={status:'VERIFIED',reference:'warehouse-record-1',verifiedBy:'warehouse-reviewer',verifiedAt:'2026-09-16T12:00:00+08:00',profile:Object.fromEntries(keys.map(k=>[k,row[k]]))};
  expect(packagingEvidenceMatches({...row,packagingEvidence:evidence})).toBe(true);
  expect(packagingEvidenceMatches({...row,length:row.length+1,packagingEvidence:evidence})).toBe(false);
 });
});
