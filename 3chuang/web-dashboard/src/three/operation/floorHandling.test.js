import {describe,it,expect} from 'vitest';
import {OperationMachine} from './operationMachine.js';
import {stagingPresentation,buildOperationSlots,YARD_LEVEL_MM} from './stagingLayout.js';
import {validateFloorHandling} from './floorHandling.js';

const container={innerLength:12032,innerWidth:2352,innerHeight:2698};
const pallet={cargoId:'p1',x:700,y:0,z:30,l:1200,w:780,h:850,weight:21,handlingMethod:'forklift',packagingType:'PALLETIZED_CARTONS',forkEntry:'FOUR_WAY',palletJackCompatible:true};

describe('floor handling truth and recovery',()=>{
  it('uses an explicitly selected short-fork configuration without resizing the pallet, and checks load moment',()=>{
    const short={...pallet,l:1000,w:900,weight:260,forkEntry:'FOUR_WAY'};
    const base=new OperationMachine({containerInfo:container,loadedCargo:[short]});base.play();
    for(let frame=0;frame<1000&&base.phase!=='BLOCKED';frame++)base.tick(.1);
    expect(base.getSnapshot().blockedReasons[0].code).toBe('JACK_ENVELOPE_EXCEEDED');
    const configured={...container,operationProfile:'SHORT_JACK'};
    const machine=new OperationMachine({containerInfo:configured,loadedCargo:[short]});machine.play();
    for(let frame=0;frame<4000&&machine.phase!=='COMPLETED';frame++){
      const state=machine.tick(.1);expect(state.phase).not.toBe('BLOCKED');
      if(state.jack)expect(state.jack.profileId).toBe('SHORT_JACK');
    }
    expect(machine.getSnapshot().completedCount).toBe(1);expect(short.l).toBe(1000);
    expect(validateFloorHandling({...short,weight:1700},configured,[],{}).reasons[0].code).toBe('JACK_ENVELOPE_EXCEEDED');
  });
  it('carries and places a supported three-layer manual stack while the person remains on the floor',()=>{
    const boxes=Array.from({length:3},(_,i)=>({...pallet,cargoId:`manual-${i}`,y:i*400,l:400,w:500,h:400,weight:8,handlingMethod:'manual',packagingType:'CARTON',stackable:true}));
    const machine=new OperationMachine({containerInfo:container,loadedCargo:boxes});
    machine.play();
    for(let frame=0;frame<3200 && machine.phase!=='COMPLETED';frame++){
      const s=machine.tick(.1);
      expect(s.phase,s.blockedReasons.map(r=>r.message).join(';')).not.toBe('BLOCKED');
      if(s.worker.position.x<container.innerLength)expect(s.worker.position.y).toBe(0);
    }
    expect(machine.getSnapshot().completedCount).toBe(3);
    expect(machine.phase).toBe('COMPLETED');
  });
  it('requires an actual supporting stack before allowing a reachable elevated box',()=>{
    const manual={...pallet,y:650,handlingMethod:'manual',weight:5};
    const missing=validateFloorHandling(manual,container,[],{});
    expect(missing.reasons.map(r=>r.code)).toContain('PLACEMENT_SUPPORT_UNVERIFIED');
  });
  it('runs a floor pallet through an explicit handoff, grounded jack return and exact release',()=>{
    const machine=new OperationMachine({containerInfo:container,loadedCargo:[pallet]});
    const phases=new Set();machine.play();
    let released=false;
    // Include the longer, distance-based empty-jack return. This is simulated
    // playback time, not a wall-clock performance limit.
    for(let frame=0;frame<4800 && machine.phase!=='COMPLETED';frame++){
      const snapshot=machine.tick(1/60);phases.add(snapshot.phase);
      expect(snapshot.phase).not.toBe('BLOCKED');
      expect(snapshot.forklift.position.x).toBeGreaterThan(container.innerLength+1500);
      if(snapshot.jack && snapshot.jack.position.x<container.innerLength)expect(snapshot.jack.position.y).toBe(0);
      const state=stagingPresentation(machine.queue,snapshot,container);
      expect(state.waiting+state.carrying+state.placed).toBe(1);
      if(snapshot.completedCount){released=true;expect(snapshot.cargoPose.position).toEqual({x:pallet.x,y:pallet.y,z:pallet.z});}
      if(snapshot.phase==='MOVE_INSIDE' && snapshot.phaseProgress>.4){
        const before=machine.pause();const frozen=JSON.stringify([before.worker,before.jack,before.forklift,before.cargoPose]);
        const after=machine.tick(10);expect(JSON.stringify([after.worker,after.jack,after.forklift,after.cargoPose])).toBe(frozen);machine.play();
      }
    }
    expect([...phases]).toEqual(expect.arrayContaining(['HANDOFF_LOWER','FORK_WITHDRAW','JACK_APPROACH','JACK_INSERT','JACK_LIFT','ENTER_CONTAINER','REVERSE_OUT','RETURN_FOR_NEXT','COMPLETED']));
    expect(released).toBe(true);
  });
  it('blocks high stow before pickup without moving the target or calling it completed',()=>{
    const high={...pallet,y:850};const m=new OperationMachine({containerInfo:container,loadedCargo:[high]});
    for(let i=0;i<4;i++)m.stepForward();
    expect(m.phase).toBe('BLOCKED');expect(m.getSnapshot().attached).toBe(false);
    expect(m.getSnapshot().cargoPose.position.y).toBe(YARD_LEVEL_MM);
    expect(high.y).toBe(850);m.skipCurrent();
    const state=stagingPresentation(m.queue,m.getSnapshot(),container);
    expect(state.waiting).toBe(1);expect(state.placed).toBe(0);
  });
  it('rejects an occupied personnel corridor even when the carried cargo is above it',()=>{
    const manual={...pallet,handlingMethod:'manual',weight:10};
    const result=validateFloorHandling(manual,container,[{cargoId:'block',x:3000,y:0,z:0,l:800,w:1000,h:600}],{manualEntry:{approach:[{x:2500,y:850,z:30},{x:3500,y:850,z:30}]}});
    expect(result.reasons[0].code).toBe('PERSON_PATH_OBSTRUCTED');
  });
  it('keeps current/next out of the representative pool, restores counts and keeps pickup slots stable',()=>{
    const queue=Array.from({length:80},(_,i)=>({...pallet,cargoId:`c${i}`,packagingType:['A','B','C','D'][Math.floor(i/20)]}));
    const slots=buildOperationSlots(queue,container);
    const before=stagingPresentation(queue,{currentIndex:0,placedCargo:[],inProgress:false},container);
    expect(before.representatives).toHaveLength(16);
    expect(before.representatives.some(e=>[0,1].includes(e.index))).toBe(false);
    const after=stagingPresentation(queue,{currentIndex:1,placedCargo:[queue[0]],inProgress:true},container);
    expect(after.waiting+after.carrying+after.placed).toBe(80);
    expect(slots.get(before.next)).toEqual(slots.get(after.active));
    const reset=stagingPresentation(queue,{currentIndex:0,placedCargo:[],inProgress:false},container);
    expect(reset).toEqual(before);
    for(let i=0;i<before.representatives.length;i++)for(let j=i+1;j<before.representatives.length;j++){
      const a=before.representatives[i].slot,b=before.representatives[j].slot;
      expect(Math.abs(a.x-b.x)>=pallet.l || Math.abs(a.z-b.z)>=pallet.w).toBe(true);
    }
  });
});
