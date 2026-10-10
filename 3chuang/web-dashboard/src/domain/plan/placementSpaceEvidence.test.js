import { describe, it, expect } from 'vitest';
import { placementSpaceEvidence } from './placementSpaceEvidence.js';

describe('placement space evidence', () => {
  const containerInfo={innerLength:10000,innerWidth:2000,innerHeight:2500};
  it('does not invent a balance justification without a traced translation', () => {
    const plan={containerInfo,loadedCargo:[{cargoId:'a',x:500,y:0,z:0,l:1000,w:1000,h:500,weight:100}]};
    const before=JSON.stringify(plan);
    expect(placementSpaceEvidence(plan).zones[0].classification).toBe('UNRESOLVED_END_GAP');
    expect(JSON.stringify(plan)).toBe(before);
  });
  it('never draws a headspace box through occupied geometry', () => {
    const bottom={cargoId:'a',x:0,y:0,z:0,l:1000,w:1000,h:500,weight:100,stackable:false};
    const top={cargoId:'b',x:0,y:500,z:0,l:1000,w:1000,h:500,weight:10};
    expect(placementSpaceEvidence({containerInfo,loadedCargo:[bottom]}).zones).toHaveLength(1);
    expect(placementSpaceEvidence({containerInfo,loadedCargo:[bottom,top]}).zones).toHaveLength(0);
  });
});
