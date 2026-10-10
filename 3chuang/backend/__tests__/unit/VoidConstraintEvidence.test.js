const {analyzeVoidJustification}=require('../../services/packing/VoidJustificationAnalyzer');
const box={innerLength:4000,innerWidth:2000,innerHeight:2000};
const cargo=[{cargoId:'no-stack',x:1000,y:0,z:0,l:1000,w:1000,h:500,stackable:false}];
const region={volume:1500000000,boundsMm:{minX:1000,maxX:2000,minY:500,maxY:2000,minZ:0,maxZ:1000},dimensions:{l:1000,w:1000,h:1500},canFitCargo:true};
const analyze=r=>analyzeVoidJustification({placements:cargo,container:box,layoutQuality:{internalVoidVolume:r.volume,voidRegions:{internal:[r],reserve:[{...region,touchesDoor:true}]}}});
test('separates exact no-stack headspace without inventing an operational corridor',()=>{
  const result=analyze(region);
  expect(result.byClass.NON_STACKABLE_HEADSPACE.volume).toBe(region.volume);
  expect(result.unexplainedVoidVolume).toBe(0);
  expect(result.byClass.PORT_ACCESS.count).toBe(0);
  expect(result.byClass.UNASSESSED_RESERVE.count).toBe(1);
  expect(result.allLargeVoidsJustified).toBe(false);
});
test('does not treat a non-rectangular connected region AABB as empty',()=>{
  const result=analyze({...region,volume:750000000});
  expect(result.byClass.NON_STACKABLE_HEADSPACE.volume).toBe(0);
  expect(result.unexplainedVoidVolume).toBe(750000000);
});
