const {calculateCoG}=require('../../services/packing/PlanMetrics');
const {analyzeLoadDistribution}=require('../../services/realworld/LoadDistributionAnalyzer');
const c={innerLength:10000,innerWidth:2000,innerHeight:2500,maxWeight:30000};
const at=(x,weight)=>({x:x-500,l:1000,y:0,h:1000,z:500,w:1000,weight});
test('symmetric and unequal known masses use full span, preserving raw coordinates',()=>{
  expect(calculateCoG([at(2500,50),at(7500,50)],c)).toMatchObject({x:5000,longitudinal:0,lateral:0});
  const cog=calculateCoG([at(2500,60),at(7500,40)],c);
  expect(cog).toMatchObject({x:4500,longitudinal:5,offsetMm:{longitudinal:-500},denominatorMm:{longitudinal:10000},legacyHalfSpanPercent:{longitudinal:10}});
  expect(analyzeLoadDistribution({placements:[at(2500,60),at(7500,40)],container:c}).centreOfGravity.guidanceStatus).toBe('WITHIN_GENERAL_GUIDANCE');
});
test('translation changes eccentricity by distance divided by full span',()=>{
  const items=[at(4500,40),at(6000,60)],before=calculateCoG(items,c);
  const after=calculateCoG(items.map(p=>({...p,x:p.x+772})),c);
  expect(after.x-before.x).toBeCloseTo(772,9);
  expect(after.longitudinal-before.longitudinal).toBeCloseTo(7.72,9);
});
test('CTU Annex 7 Appendix 4 published masses reproduce the raw centre',()=>{
  const m=[3500,4200,3700,2200,4900],x=[700,1400,3000,3800,5100];
  const cog=calculateCoG(m.map((mass,i)=>at(x[i],mass)),{...c,innerLength:5900});
  expect(cog.x).toBeCloseTo(52780000/18500,8);
  expect(cog.x/1000).toBeCloseTo(2.85,2);
});
