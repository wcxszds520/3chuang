const {buildShipmentReadiness}=require('../../services/realworld/ShipmentReadinessService');
const vgmEvidence=vgm=>buildShipmentReadiness({vgm,actualContainer:{maxGross:30480}}).evidence.find(e=>e.id==='BOX-VGM');
test('keeps incomplete VGM pending and never treats an overweight record as ready',()=>{
  expect(vgmEvidence({declaredVGMKg:12000,method:'METHOD_1'}).status).toBe('DATA_REQUIRED');
  expect(vgmEvidence({declaredVGMKg:12000,method:'OTHER',shipperDeclaration:true}).status).toBe('DATA_REQUIRED');
  expect(vgmEvidence({declaredVGMKg:12000,method:'METHOD_1',shipperDeclaration:true}).status).toBe('READY');
  expect(vgmEvidence({declaredVGMKg:32000,method:'METHOD_1',shipperDeclaration:true}).status).toBe('BLOCKED');
  expect(vgmEvidence({declaredVGMKg:12000,method:'METHOD_1',shipperDeclaration:true}).detail).toContain('不代替');
});
