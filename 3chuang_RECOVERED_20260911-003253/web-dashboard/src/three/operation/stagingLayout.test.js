import { describe, expect, it } from 'vitest';
import { buildStagingLayout, groundYAtX, representativeStagingIndices, stagingGroups, YARD_LEVEL_MM } from './stagingLayout.js';

describe('representative waiting cargo',()=>{
  const container={innerLength:12032,innerWidth:2352};
  const queue=Array.from({length:212},(_,i)=>({cargoId:`c${i}`,l:600,w:800,h:700,packagingType:i%3?'CARTON':'WOOD_CRATE',handlingMethod:'manual'}));
  it('keeps current and next explicit and derives group totals from remaining queue',()=>{
    for(const current of [0,1,106,210,211,212]){
      const sample=representativeStagingIndices(queue,current);
      expect(sample.length).toBeLessThanOrEqual(4);
      if(current<212)expect(sample).toContain(current);
      if(current+1<212)expect(sample).toContain(current+1);
      expect(stagingGroups(queue,current).reduce((n,g)=>n+g.indices.length,0)).toBe(212-current);
    }
  });
  it('grounds representatives without overlap and never edits formal coordinates',()=>{
    const before=JSON.stringify(queue);
    const slots=buildStagingLayout(queue,container);
    const sample=representativeStagingIndices(queue,0);
    for(const i of sample){
      expect(slots.get(i).y).toBe(YARD_LEVEL_MM);
      for(const j of sample.filter(j=>j>i)){
        const a=slots.get(i),b=slots.get(j);
        const overlap=a.x<b.x+queue[j].l && a.x+queue[i].l>b.x && a.z<b.z+queue[j].w && a.z+queue[i].w>b.z;
        expect(overlap).toBe(false);
      }
    }
    expect(JSON.stringify(queue)).toBe(before);
    expect(groundYAtX(container.innerLength+750,container)).toBe(-110);
  });
});
