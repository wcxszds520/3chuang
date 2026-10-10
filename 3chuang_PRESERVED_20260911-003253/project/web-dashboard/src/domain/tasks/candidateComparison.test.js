import {expect,it} from 'vitest';
import {groupEquivalentCandidates,candidateRejections} from './candidateComparison.js';

function candidate(id,{cab='NEW',x=0,missing='U2'}={}) {
  return {candidateId:id,label:id,summary:{movedUnits:0},rejected:[{typeId:id,unitIds:['U2'],reason:'尺寸超限'}],
    task:{containers:[{containerId:cab,equipment:{typeId:'20GP'},status:'DRAFT',lockedUnitIds:[],plan:{loadedCargo:[{cargoId:'U1',x,y:0,z:0,l:500,w:400,h:300}]}}],unassigned:[{unitId:missing}]}};
}
it('groups identical placements with generated cabinet IDs and preserves every policy rejection',()=>{
  const groups=groupEquivalentCandidates([candidate('A',{cab:'NEW-A'}),candidate('B',{cab:'NEW-B'})]);
  expect(groups).toHaveLength(1);expect(groups[0].members.map(c=>c.candidateId)).toEqual(['A','B']);
  expect(groups[0].actualLabel).toBe('1 × 20GP');expect(candidateRejections(groups[0])).toHaveLength(2);
});
it('keeps changed geometry, missing-unit identity and existing-cabinet assignment separate',()=>{
  expect(groupEquivalentCandidates([candidate('A'),candidate('B',{x:1}),candidate('C',{missing:'U3'})])).toHaveLength(3);
  expect(groupEquivalentCandidates([candidate('A',{cab:'OLD-A'}),candidate('B',{cab:'OLD-B'})],[{containerId:'OLD-A'},{containerId:'OLD-B'}])).toHaveLength(2);
});
