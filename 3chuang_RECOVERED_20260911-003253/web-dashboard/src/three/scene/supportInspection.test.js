import { describe,expect,it } from 'vitest';
import { supportContactPatches } from './supportInspection.js';
import { supportFootprintRatio } from '../operation/floorHandling.js';
describe('geometric support inspection',()=>{
  const cargo={cargoId:'top',x:100,y:500,z:100,l:1000,w:1000,h:500};
  it('clips support at the exact contact height and does not count floating neighbours',()=>{
    const support={cargoId:'base',x:0,y:0,z:0,l:600,w:600,h:500};
    expect(supportContactPatches(cargo,[support,{...support,cargoId:'floating',y:10}])).toEqual([{x:100,y:500,z:100,l:500,w:500,source:'base'}]);
  });
  it('uses union area rather than double-counting overlapping supporters',()=>{
    const support={cargoId:'base',x:100,y:0,z:100,l:600,w:1000,h:500};
    expect(supportFootprintRatio(cargo,[support,{...support,cargoId:'duplicate'}])).toBe(.6);
  });
});
