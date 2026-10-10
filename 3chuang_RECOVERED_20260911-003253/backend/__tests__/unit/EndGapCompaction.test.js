const {compactDeepEnd} = require('../../services/packing/EndGapCompaction');
const {calculateCoG} = require('../../services/packing/PlanMetrics');

describe('same-class end-gap compaction', () => {
  const box={innerLength:10000,innerWidth:2000,innerHeight:2500,maxWeight:20000};
  const cargo=[{cargoId:'a',x:2000,y:0,z:0,l:1000,w:2000,h:500,weight:10},{cargoId:'b',x:6200,y:500,z:0,l:1000,w:2000,h:500,weight:10}];
  test('uses the exact boundary without quantization overshoot and preserves relative geometry',()=>{
    const before=JSON.stringify(cargo),r=compactDeepEnd(cargo,box);
    // The mass centre is 4600 mm: 4% of the full 10000 mm span.
    // It belongs to the 5% class, not the retired half-span percentage.
    expect(r.evidence.guidanceLimitPercent).toBe(5);
    expect(r.evidence.shiftX).toBe(-100);
    expect(calculateCoG(r.placements,box).longitudinal).toBeLessThanOrEqual(5);
    expect(r.placements[1].x-r.placements[0].x).toBe(4200);
    expect(r.placements.map(c=>[c.y,c.z,c.l,c.w,c.h,c.weight])).toEqual(cargo.map(c=>[c.y,c.z,c.l,c.w,c.h,c.weight]));
    expect(JSON.stringify(cargo)).toBe(before);
  });
  test('does not relax general guidance to the 10 percent class',()=>{
    const r=compactDeepEnd(cargo.map(c=>({...c,x:c.x+300})),box);
    expect(r.evidence.guidanceLimitPercent).toBe(5);
    expect(calculateCoG(r.placements,box).longitudinal).toBeLessThanOrEqual(5);
  });
  test('does not claim a fix for an already outside-guidance layout or an empty plan',()=>{
    expect(compactDeepEnd(cargo.map(c=>({...c,x:c.x-1000})),box)).toBeNull();
    expect(compactDeepEnd([],box)).toBeNull();
  });
});
