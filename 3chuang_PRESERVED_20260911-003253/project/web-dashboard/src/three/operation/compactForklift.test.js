import {describe,it,expect} from 'vitest';
import {OperationMachine} from './operationMachine.js';
import {UnloadMachine} from './unloadMachine.js';
import {validateForkInterface} from './forkInterface.js';
import {buildOperationSlots,stagingPresentation} from './stagingLayout.js';

const container={innerLength:5898,innerWidth:2352,innerHeight:2393,doorWidth:2340,doorHeight:2280,
  operationProfile:'COMPACT_FORKLIFT',operationSite:{levelDockConfirmed:true,bridgeCapacityKg:6000,floorAxleCapacityKg:5000}};
const pallet={cargoId:'bottom',sku:'TEST-P',x:1000,y:0,z:676,l:1200,w:1000,h:500,length:1200,width:1000,height:500,weight:260,
  orientation:'XYZ',forkEntry:'TWO_WAY',forkEntryAxis:'LENGTH',palletJackCompatible:false,handlingMethod:'forklift',packagingType:'PALLETIZED_CARTONS',stackable:true};
const plan={containerInfo:container,loadedCargo:[pallet,{...pallet,cargoId:'top',y:500}]};
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
describe('declared fork interfaces and conditional forklift handling',()=>{
  it('spaces two-metre pallets by their rotated receiving envelopes and full queue footprints',()=>{
    const wide=Array.from({length:8},(_,i)=>({...pallet,cargoId:`wide-${i}`,w:2000}));
    const unload=new UnloadMachine({containerInfo:container,loadedCargo:wide});
    const slots=[...unload.stagingSlots.values()];
    for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)expect(Math.abs(slots[i].x-slots[j].x)>=2350||Math.abs(slots[i].z-slots[j].z)>=1550).toBe(true);
    const pickup=buildOperationSlots(wide,container);expect(pickup.get(1).x-pickup.get(0).x).toBe(2350);
    const pool=stagingPresentation(wide,{currentIndex:0,placedCargo:[]},container).representatives;
    for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++)expect(Math.abs(pool[i].slot.x-pool[j].slot.x)>=1200||Math.abs(pool[i].slot.z-pool[j].slot.z)>=2000).toBe(true);
  });
  it('does not silently authorize incompatible jack bases or rotated two-way openings',()=>{
    expect(validateForkInterface(pallet,{jack:true}).reasons[0].code).toBe('JACK_INTERFACE_UNVERIFIED');
    expect(validateForkInterface({...pallet,l:1000,w:1200,orientation:'YXZ'}).reasons[0].code).toBe('FORK_AXIS_MISMATCH');
    expect(validateForkInterface({...pallet,forkEntryAxis:null}).reasons[0].code).toBe('FORK_AXIS_UNVERIFIED');
    expect(validateForkInterface({...pallet,orientation:'YXZ',forkEntry:'FOUR_WAY'}).valid).toBe(true);
  });
  it('requires site load evidence, matching door clearance and an unobstructed chassis corridor',()=>{
    for(const [changes,code] of [[{operationSite:{}},'FORKLIFT_SITE_UNVERIFIED'],[{doorHeight:2000},'FORKLIFT_DOOR_CLEARANCE'],[{operationSite:{...container.operationSite,bridgeCapacityKg:3100}},'FORKLIFT_SITE_UNVERIFIED']]){
      const m=new OperationMachine({...plan,containerInfo:{...container,...changes}});for(let i=0;i<4;i++)m.stepForward();
      expect(m.blockedReasons.map(r=>r.code)).toContain(code);expect(m.completedIndices).toHaveLength(0);
    }
    const m=new OperationMachine({...plan,loadedCargo:[{...pallet,cargoId:'obstacle',x:3500,h:100},pallet]});
    m.placedCargo=()=>[{...pallet,cargoId:'obstacle',x:3500,h:100}];for(let i=0;i<4;i++)m.stepForward();
    expect(m.blockedReasons.map(r=>r.code)).toContain('FORKLIFT_PATH_OBSTRUCTED');
  });
  it('places a supported second pallet, keeps phase positions continuous and reverses the complete cycle',()=>{
    const m=new OperationMachine(plan);m.stepForward();let phases=0;
    while(!['COMPLETED','BLOCKED'].includes(m.phase)&&phases++<80){
      m.phaseElapsed=m.phaseDuration();const end=m.computePose(),phase=m.phase;
      const next=m.stepForward();
      expect(next.phase,next.blockedReasons.map(r=>r.message).join(';')).not.toBe('BLOCKED');
      expect(gap(end.forklift.position,next.forklift.position),`${phase} forklift boundary`).toBeLessThan(.01);
      if(phase!=='RETURN_FOR_NEXT')expect(gap(end.cargo.position,next.cargoPose.position),`${phase} cargo boundary`).toBeLessThan(.01);
      expect(m.currentCargo()?.y||0).toBeLessThanOrEqual(500);
    }
    expect(m.getSnapshot().completedCount).toBe(2);expect(m.phase).toBe('COMPLETED');
    const unload=new UnloadMachine(plan);unload.play();
    for(let frame=0;frame<4000&&unload.phase!=='COMPLETED';frame++){
      const state=unload.tick(.1);expect(state.phase,state.blockedReasons.map(r=>r.message).join(';')).not.toBe('BLOCKED');
      expect(state.jack).toBeNull();expect(state.forklift.position.y).toBe(0);
    }
    expect(unload.getSnapshot().completedCount).toBe(2);expect(plan.loadedCargo.map(c=>c.y)).toEqual([0,500]);
  });
});
