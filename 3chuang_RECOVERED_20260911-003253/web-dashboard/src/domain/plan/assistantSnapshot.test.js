import {describe,it,expect} from 'vitest';
import {buildAssistantSnapshot} from './assistantSnapshot.js';
const session={order:{orderNo:'A'},selectedContainerType:'40HQ',cargo:[]};
const plan={planId:'plan-A',sourceCode:'BACKEND_SOLVED',placementHash:'hash-A',containerInfo:{innerLength:1000,innerWidth:1000,innerHeight:1000},loadedCargo:[{cargoId:'one',x:0,y:0,z:0,l:500,w:1000,h:1000,weight:10}],voidJustification:{unexplainedVoidVolume:100000000}};
describe('assistant snapshots',()=>{
  it('keeps volume utilization separate from unexplained space',()=>{
    const snap=buildAssistantSnapshot({session,plan,page:'孪生'});
    expect(snap.facts.find(f=>f.id==='volume_utilization').value).toBe(50);
    expect(snap.facts.find(f=>f.id==='unexplained_volume').value).toBe(0.1);
    expect(snap.boundaries.actualLoadingConfirmed).toBe(false);
    expect(snap.boundaries.sourceMaterialKind).toBe('PROJECT_RULE_SUMMARY');
  });
  it('changes identity with page, plan, and selected object, and ignores supplied fake coordinates',()=>{
    const a=buildAssistantSnapshot({session,plan,page:'孪生'});
    const b=buildAssistantSnapshot({session,plan,page:'规划'});
    const c=buildAssistantSnapshot({session,plan:{...plan,planId:'plan-B'},page:'孪生'});
    const d=buildAssistantSnapshot({session,plan,page:'孪生',extra:{selectedCargo:{cargoId:'one',position:{x:999}}}});
    expect(new Set([a.snapshotId,b.snapshotId,c.snapshotId,d.snapshotId]).size).toBe(4);
    expect(d.selectedObject.position.x).toBe(0);
  });
});
